-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE SOCIAL PIPELINE AND THE CREDENTIAL AUTHORITY
--
-- Run after 012_credit_framework.sql. Idempotent; destroys nothing.
--
-- Two of the three subsystems the university asked for. The third — proctored
-- online examinations — is deliberately absent: the university said "i will
-- give you details", and a schema written ahead of that specification would
-- have to be migrated away from rather than extended.
--
-- ===========================================================================
-- 1. THE SOCIAL PIPELINE
-- ===========================================================================
--
--   "administrators to create social media contents about the university and
--    post it and it immediately automate to all the university social media
--    accounts and also the administrator personal account provided they
--    connects it. The super admin can connect the system to all the social
--    medias and every admin can share their content without connecting.
--    individual administrators would only be given the option in their
--    settings to connect theirs."
--
-- THAT IS TWO KINDS OF ACCOUNT AND THEY MUST NOT SHARE A TABLE BY ACCIDENT.
-- A university account belongs to the institution: the Superadministrator
-- connects it once and every administrator may publish through it without
-- holding its credentials. A personal account belongs to a person: only that
-- person may connect it, only that person may revoke it, and nobody else may
-- publish through it — not the Superadministrator, not another administrator,
-- not a scheduled job acting on their behalf.
--
-- `scope` carries the distinction and a CHECK enforces the consequence: a
-- university account has no owner, a personal account must have one.
--
-- CONSENT IS PER POST, NOT PER CONNECTION. An administrator who once linked
-- their own account has not agreed that every future university announcement
-- goes out under their name for the rest of their employment. So the fan-out
-- ledger records each target explicitly, and section 1(d) refuses at the
-- database level to create a personal target for anyone but the post's author.
--
-- NO TOKEN IS STORED HERE. `token_ref` is a pointer into the secret store.
-- An OAuth refresh token is a standing permission to speak as the university;
-- putting one in an application table means every future SELECT bug, every
-- over-broad RLS policy and every database export is a credential leak.
--
-- ===========================================================================
-- 2. THE CREDENTIAL AUTHORITY
-- ===========================================================================
--
--   "the superadmin should have a special privilege to edit any version of the
--    certificates or degrees and print while forwarding the digital copy to
--    the student through email... the changes he make should automatically
--    register in the system. He is more of the VC of the university. He can
--    also create other kinds of certificate for different role that may not
--    even be academic."
--
-- AN ISSUED CREDENTIAL IS NEVER EDITED IN PLACE, and this is the one design
-- decision in this file that is not negotiable. 004_credential_register.sql
-- built the register on the principle that a sealed document is a statement
-- the university made on a date, and its content hash is what /verify checks.
-- Editing the row would change what the university appears to have said in
-- 2024, break every seal already in circulation, and leave no trace that a
-- correction ever happened.
--
-- So a correction SUPERSEDES. The original is marked 'replaced', a new
-- credential is issued with a new number and a new hash, and an amendment row
-- records who changed what, why, and which document replaced which. That is
-- what "the changes he make should automatically register in the system"
-- actually requires — a registry entry, not an UPDATE.
-- ===========================================================================


-- 1 (a) ---------------------------------------------------------------------
-- The accounts the system may speak through.

create table if not exists social_accounts (
  id              uuid primary key default gen_random_uuid(),

  -- 'university' — the institution's own account, connected once by the
  -- Superadministrator and usable by every administrator.
  -- 'personal'   — an administrator's own account, connected by them alone.
  scope           text not null check (scope in ('university', 'personal')),

  -- Null for a university account; the owner for a personal one. The CHECK
  -- below is what stops a personal account existing without a person, which
  -- would make it publishable by anybody.
  owner_id        uuid references auth.users (id) on delete cascade,

  platform        text not null check (platform in
                    ('facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'threads')),

  -- What a human sees when choosing where to post.
  handle          text not null,
  display_name    text,
  avatar_url      text,

  -- The platform's own id for the page/profile, used when publishing.
  external_id     text,

  -- A POINTER, NOT A TOKEN. See the header. The secret store holds the access
  -- and refresh tokens; this column holds the key to look them up.
  token_ref       text,
  token_expires_at timestamptz,
  scopes          text[] not null default '{}'::text[],

  status          text not null default 'connected'
                    check (status in ('connected', 'expired', 'revoked', 'error')),
  last_error      text,

  connected_by    uuid references auth.users (id) on delete set null,
  connected_at    timestamptz not null default now(),
  revoked_at      timestamptz,

  constraint social_accounts_scope_owner check (
    (scope = 'university' and owner_id is null)
    or (scope = 'personal' and owner_id is not null)
  )
);

-- One connection per platform per owner. A second Facebook page for the
-- university is a second row with a different external_id, which is why the
-- key includes it.
create unique index if not exists social_accounts_unique
  on social_accounts (scope, coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), platform, coalesce(external_id, handle));

create index if not exists social_accounts_owner_idx on social_accounts (owner_id) where owner_id is not null;


-- 1 (b) ---------------------------------------------------------------------
-- The content itself. One post, many destinations.

create table if not exists social_posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references auth.users (id) on delete restrict,

  body            text not null,
  link_url        text,

  -- Set by the author: do they also want this on their own connected
  -- accounts? Recorded on the POST, not inferred from the connection, because
  -- linking an account once is not consent for every future announcement.
  include_personal boolean not null default false,

  scheduled_for   timestamptz,

  status          text not null default 'draft'
                    check (status in ('draft', 'scheduled', 'publishing', 'published', 'partially_failed', 'failed', 'cancelled')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  published_at    timestamptz
);

create index if not exists social_posts_status_idx on social_posts (status, scheduled_for);
create index if not exists social_posts_author_idx on social_posts (author_id);

create table if not exists social_post_media (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references social_posts (id) on delete cascade,
  storage_path text not null,
  -- REQUIRED, not optional. A university publishing an image with no alt text
  -- is publishing something a blind reader cannot see, and every platform
  -- carries the omission onward.
  alt_text    text not null,
  ordinal     integer not null default 0
);

create index if not exists social_post_media_post_idx on social_post_media (post_id, ordinal);


-- 1 (c) ---------------------------------------------------------------------
-- The fan-out ledger: one row per account this post is going to.
--
-- A post that succeeds on four platforms and fails on the fifth is not
-- "published" and is not "failed". Without a row per destination there is
-- nowhere to record that, and the administrator is left refreshing a page that
-- says nothing useful.

create table if not exists social_post_targets (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references social_posts (id) on delete cascade,
  account_id     uuid not null references social_accounts (id) on delete restrict,

  status         text not null default 'pending'
                   check (status in ('pending', 'sending', 'posted', 'failed', 'skipped')),
  attempts       integer not null default 0,
  external_post_id text,
  external_url   text,
  last_error     text,

  queued_at      timestamptz not null default now(),
  posted_at      timestamptz,

  unique (post_id, account_id)
);

create index if not exists social_post_targets_pending_idx
  on social_post_targets (status) where status in ('pending', 'sending');


-- 1 (d) ---------------------------------------------------------------------
-- NOBODY POSTS TO SOMEBODY ELSE'S ACCOUNT.
--
-- Enforced in the database, not in the interface. A trigger, because the rule
-- spans two tables and a CHECK constraint cannot see across a foreign key.
--
-- This is the rule that protects a member of staff from having the university
-- speak in their name, and it is exactly the kind of rule that survives in a
-- specification and dies in a refactor unless the database holds it.

create or replace function social_target_consent() returns trigger
  language plpgsql as $$
declare
  acct social_accounts%rowtype;
  post social_posts%rowtype;
begin
  select * into acct from social_accounts where id = new.account_id;
  select * into post from social_posts   where id = new.post_id;

  if acct.scope = 'personal' then
    if acct.owner_id is distinct from post.author_id then
      raise exception
        'A personal social account may only be a target of its own owner''s post '
        '(account owner %, post author %)', acct.owner_id, post.author_id;
    end if;
    if not post.include_personal then
      raise exception
        'This post is not marked to include personal accounts; the author must opt in per post.';
    end if;
  end if;

  if acct.status <> 'connected' then
    raise exception 'Social account % is %, not connected', acct.id, acct.status;
  end if;

  return new;
end $$;

drop trigger if exists social_target_consent_trg on social_post_targets;
create trigger social_target_consent_trg
  before insert or update on social_post_targets
  for each row execute function social_target_consent();


-- 1 (e) ---------------------------------------------------------------------
-- ONE POST, MANY VOICES.
--
-- "Create once -> review once -> publish everywhere" does NOT mean publishing
-- identical text everywhere. LinkedIn wants a paragraph, X wants a sentence,
-- Instagram wants a caption and hashtags, and a university that posts the same
-- 400 words to all six reads as a bot on five of them.
--
-- So the post holds the INTENT and a variant holds what each platform actually
-- receives. A variant with no row falls back to the post body, which is what
-- makes the simple case simple.
--
-- `source` records whether a human wrote it or the assistant drafted it. That
-- is not bookkeeping: the university asked that "the administrator remains in
-- control and approves before publishing", and an approval means nothing if
-- nobody can tell afterwards which words were generated.

create table if not exists social_post_variants (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references social_posts (id) on delete cascade,
  platform     text not null check (platform in
                 ('facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'threads')),

  body         text not null,
  hashtags     text[] not null default '{}'::text[],

  source       text not null default 'human' check (source in ('human', 'assistant')),
  -- Edited by a human after the assistant drafted it. Distinct from 'human',
  -- because "reviewed and changed" is a different fact from "written from
  -- scratch" and the audit answer differs.
  edited_by    uuid references auth.users (id) on delete set null,
  approved_by  uuid references auth.users (id) on delete set null,
  approved_at  timestamptz,

  created_at   timestamptz not null default now(),
  unique (post_id, platform)
);


-- 1 (f) ---------------------------------------------------------------------
-- Engagement, pulled back from each platform after publication.
--
-- A SNAPSHOT TABLE, NOT A RUNNING TOTAL. Every platform revises its own
-- numbers — a like is withdrawn, a video's view count is recounted — and a
-- single mutable "likes" column loses the history every time it is refreshed.
-- Rows are cheap; a chart of reach over the week after a graduation
-- announcement is not reconstructible from a number that was overwritten.

create table if not exists social_post_metrics (
  id           uuid primary key default gen_random_uuid(),
  target_id    uuid not null references social_post_targets (id) on delete cascade,
  captured_at  timestamptz not null default now(),
  impressions  integer,
  reach        integer,
  likes        integer,
  comments     integer,
  shares       integer,
  clicks       integer,
  video_views  integer,
  raw          jsonb not null default '{}'::jsonb
);

create index if not exists social_post_metrics_target_idx
  on social_post_metrics (target_id, captured_at desc);


-- 2 (a) ---------------------------------------------------------------------
-- CREDENTIAL TYPES — what kinds of instrument this university awards.
--
-- "Create New Credential... name, category, template, eligibility, authority,
-- validity, verification." This is the table that makes the system not a
-- degree printer: a Certificate of Excellence in Christian Leadership and a
-- Bachelor of Theology are both credentials and must never be confused.
--
-- `category` IS THE GUARD AGAINST THE WORST FAILURE THIS SYSTEM COULD HAVE.
-- The university was explicit: "the system should clearly classify them so
-- nobody mistakes an institutional certificate for an accredited academic
-- degree." A certificate of appreciation that renders like a degree, verifies
-- like a degree and is filed like a degree IS a fake degree, whatever the
-- title says. So the category is required, constrained, and carried onto the
-- issued credential and into verification.

create table if not exists credential_types (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null,

  category       text not null check (category in
                   ('academic', 'professional', 'ministry', 'institutional', 'honorary')),

  -- Academic awards say so, in a boolean, so that no query has to parse a
  -- category string to answer "is this a degree".
  is_academic    boolean not null default false,

  template_id    uuid references credential_templates (id) on delete set null,

  -- Who may receive it, and who may confer it. Free-form prose for the first
  -- because eligibility is a policy sentence; a role for the second because it
  -- is enforced.
  eligibility    text,
  issuing_role   text not null default 'registrar',

  validity       text not null default 'permanent'
                   check (validity in ('permanent', 'expiring')),
  validity_months integer,

  verification_enabled boolean not null default true,

  status         text not null default 'draft'
                   check (status in ('draft', 'active', 'retired')),

  created_by     uuid references auth.users (id) on delete set null,
  approved_by    uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),

  -- An expiring credential with no period is a credential that never expires
  -- while claiming to.
  constraint credential_types_validity check (
    validity = 'permanent' or (validity = 'expiring' and validity_months is not null)
  ),
  -- An academic award in a non-academic category is the confusion this table
  -- exists to prevent.
  constraint credential_types_academic_category check (
    (is_academic and category = 'academic') or (not is_academic)
  )
);


-- 2 (b) ---------------------------------------------------------------------
-- THE TEMPLATE STUDIO EXTENDS THE EXISTING LIBRARY. IT DOES NOT REPLACE IT.
--
-- THIS SECTION WAS WRONG WHEN FIRST WRITTEN AND THE DATABASE CAUGHT IT. It
-- opened with `create table if not exists credential_templates (...)` carrying
-- a fresh design — code, title, category, layout, status. That table already
-- exists: 000_complete.sql built it and 005_senate_approval.sql gave it a
-- publication gate. So the CREATE silently did nothing, every column named in
-- it was absent, and the migration failed on the next line with "column status
-- does not exist".
--
-- Silently. That is the part worth keeping in the file. `if not exists` turns
-- a redefinition into a no-op, so a second, incompatible design for a table
-- that already holds published certificate artwork raises nothing at all — the
-- error surfaced two statements later on an index, pointing at the wrong
-- cause. Had 013 not touched `status`, this would have shipped, and the
-- application would have been written against columns the database has never
-- had.
--
-- WHAT IS ALREADY THERE, AND WHY NONE OF IT MAY BE THROWN AWAY:
--
--   design jsonb          the artwork, as data
--   kind                  'certificate' | 'transcript'
--   version, is_active    versioned, with one active design per kind
--   lifecycle             draft -> submitted -> approved -> published -> withdrawn
--   credential_templates_immutable    a published design cannot be edited
--   credential_templates_publication  three offices — Registrar, Academic
--                                     Office, Vice Chancellor — must each
--                                     approve before it may be published
--
-- That last trigger is the university's own separation of duties, written in
-- 005. The Superadministrator asked for the power to design certificates; that
-- is granted. The power to design one AND publish it alone was not asked for
-- and is not given here.
--
-- WHAT THIS MIGRATION ADDS. Two things, both additive:
--
--   type_id   which credential type this design is the artwork for, so that a
--             new type created under point 6 can carry its own certificate
--             rather than borrowing the one design allowed per `kind`.
--   fields    the merge fields the design declares — {{student.full_name}},
--             {{credential.number}} — named explicitly rather than discovered
--             by scanning the artwork, so the studio can tell an author that a
--             field will render blank BEFORE the document is sealed.

alter table credential_templates add column if not exists type_id uuid
  references credential_types (id) on delete restrict;
alter table credential_templates add column if not exists fields jsonb not null default '[]'::jsonb;

-- ONE ACTIVE DESIGN PER TYPE, not one per kind.
--
-- 000 declared `unique (kind) where is_active`, which was right when there
-- were exactly two kinds and no types. Under point 6 the university may create
-- a Certificate of Ordination and a Certificate of Appreciation, and both are
-- kind='certificate'; the old index would let only one of them have artwork.
--
-- coalesce, not NULLS NOT DISTINCT: the latter is Postgres 15+, and this file
-- should not be the reason a migration fails on an older instance. The
-- sentinel groups every untyped design together, which preserves exactly the
-- old rule for the house certificate and transcript.
drop index if exists credential_templates_one_active;
create unique index if not exists credential_templates_one_active_per_type
  on credential_templates (kind, coalesce(type_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_active;


-- 2 (c) ---------------------------------------------------------------------
-- The amendment register.
--
-- A CORRECTION SUPERSEDES; IT DOES NOT OVERWRITE. See the header. The original
-- credential keeps its number, its hash and its date and is marked 'replaced';
-- a new credential is issued; this row is the link between them and the reason.

create table if not exists credential_amendments (
  id                   uuid primary key default gen_random_uuid(),

  original_id          uuid not null references credentials_issued (id) on delete restrict,
  replacement_id       uuid references credentials_issued (id) on delete set null,

  -- What actually changed, field by field, as {field: {from, to}}. A reason
  -- alone is not an audit trail — the question asked years later is "what did
  -- it say before", and only this column answers it.
  changes              jsonb not null default '{}'::jsonb,

  -- Why. Free text and REQUIRED: a correction to a person's name or award on a
  -- sealed document without a stated reason is indistinguishable from tampering.
  reason               text not null,

  amended_by           uuid not null references auth.users (id) on delete restrict,
  amended_at           timestamptz not null default now(),

  -- "forwarding the digital copy to the student through email"
  emailed_to           text,
  emailed_at           timestamptz,
  printed_at           timestamptz,

  constraint credential_amendments_reason_not_blank check (length(btrim(reason)) > 0)
);

create index if not exists credential_amendments_original_idx on credential_amendments (original_id);



-- 2 (d) ---------------------------------------------------------------------
-- VERSIONING ON THE ISSUED CREDENTIAL.
--
-- The register already had `replaced_by` and a 'replaced' status. What it did
-- not have is a version NUMBER and a link backwards, and without those the
-- history the university drew — "Version 1, superseded, name correction ->
-- Version 2, current" — cannot be rendered, because there is no way to ask a
-- credential which number it is or what it came from.
--
-- `credential_id` stays STABLE ACROSS VERSIONS. IGUC-BTH-2026-00125 is the
-- award; v1 and v2 are what the university has said about it. A QR code
-- printed on v1 must resolve to the award and be told the current version — 
-- see the university's point 9 — which is impossible if each version invents
-- a new number.

alter table credentials_issued add column if not exists version        integer not null default 1;
alter table credentials_issued add column if not exists supersedes_id  uuid references credentials_issued (id) on delete set null;
alter table credentials_issued add column if not exists type_id        uuid references credential_types (id) on delete set null;
alter table credentials_issued add column if not exists template_id    uuid references credential_templates (id) on delete set null;

-- THE COLUMNS ABOVE WERE NOT ENOUGH, AND THE DATABASE PROVED IT.
--
-- 004 declared `credential_id text not null unique`. That single word made the
-- entire versioning design impossible: version 2 of IGUC-BTH-2026-00125 is a
-- second row carrying the same credential_id, and the unique constraint refuses
-- it. Adding the columns, the index and the foreign key all succeeded; the
-- first actual amendment would have failed with "duplicate key value violates
-- unique constraint", months later, in front of a graduate waiting for a
-- corrected certificate.
--
-- Nothing in the first draft of this migration would have caught that. It
-- asserted that tables existed and that triggers existed — not that the one
-- operation the whole subsystem is FOR could be performed. Section 3 now
-- performs it.
--
-- WHY THE CONSTRAINT IS REPLACED RATHER THAN DROPPED. 004's reasoning for it
-- still holds: a credential number is random rather than sequential, and
-- uniqueness is what makes that safe. So the guarantee is preserved and
-- narrowed — one row per (number, version) instead of one row per number — and
-- the version chain trigger below supplies what the narrower constraint alone
-- would lose: that two rows sharing a number are genuinely the same award,
-- rather than two different awards that collided.

alter table credentials_issued drop constraint if exists credentials_issued_credential_id_key;

create unique index if not exists credentials_issued_ref_version
  on credentials_issued (credential_id, version);

create index if not exists credentials_issued_version_idx
  on credentials_issued (credential_id, version desc);

-- THE VERSION CHAIN MUST BE A CHAIN.
--
-- Without this, `unique (credential_id, version)` would let two unrelated
-- awards share a number as long as their version numbers differed — which is
-- worse than the constraint it replaced, because /verify resolves by number and
-- would show one graduate's award as a version of another's.
--
-- A CHECK constraint cannot express this: it needs to look at another row. So
-- it is a trigger, and it enforces three things —
--
--   version 1 is an original and supersedes nothing
--   version n > 1 supersedes something
--   what it supersedes is the previous version OF THE SAME AWARD
create or replace function guard_credential_version() returns trigger
language plpgsql as $$
declare
  prior record;
begin
  if new.version < 1 then
    raise exception 'a credential version is 1 or greater; got %', new.version;
  end if;

  if new.version = 1 then
    if new.supersedes_id is not null then
      raise exception 'version 1 of a credential is an original and cannot supersede anything';
    end if;
    return new;
  end if;

  if new.supersedes_id is null then
    raise exception
      'version % of % must say which version it replaces. A correction that does not point at '
      'what it corrected is an edit with extra steps.', new.version, new.credential_id;
  end if;

  select credential_id, version into prior
    from credentials_issued where id = new.supersedes_id;

  if prior is null then
    raise exception 'the credential this version supersedes does not exist';
  end if;

  if prior.credential_id is distinct from new.credential_id then
    raise exception
      'version % claims number % but supersedes %, which is a different award. '
      'Two awards must never share a credential number.',
      new.version, new.credential_id, prior.credential_id;
  end if;

  if prior.version <> new.version - 1 then
    raise exception
      'version % must supersede version %, not version %. The history has to be continuous or '
      'it cannot be read back.', new.version, new.version - 1, prior.version;
  end if;

  return new;
end $$;

drop trigger if exists credentials_version_chain on credentials_issued;
create trigger credentials_version_chain
  before insert on credentials_issued
  for each row execute function guard_credential_version();


-- 2 (e) ---------------------------------------------------------------------
-- THE CORRECTION REQUEST. Students do not edit their own credentials.
--
-- The route the university drew: student requests -> registrar reviews ->
-- escalated if required -> Credential Authority approves -> new version.
-- Every one of those is a state, and the states are the point: a correction
-- that skips review is an edit, and an edit to a sealed document is the thing
-- this whole design exists to prevent.

create table if not exists credential_correction_requests (
  id             uuid primary key default gen_random_uuid(),
  credential_id  uuid not null references credentials_issued (id) on delete restrict,
  student_id     uuid references students (id) on delete set null,
  requested_by   uuid not null references auth.users (id) on delete restrict,

  description    text not null,
  -- What the student says it should say, field by field. Proposed, never
  -- applied: the authority decides what is actually changed.
  proposed       jsonb not null default '{}'::jsonb,
  evidence       text[] not null default '{}'::text[],

  status         text not null default 'submitted' check (status in
                   ('submitted', 'under_review', 'escalated', 'approved', 'rejected', 'withdrawn')),

  reviewed_by    uuid references auth.users (id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text,

  escalated_at   timestamptz,
  decided_by     uuid references auth.users (id) on delete set null,
  decided_at     timestamptz,
  decision_note  text,

  -- Filled when the correction produces a new version.
  amendment_id   uuid references credential_amendments (id) on delete set null,

  created_at     timestamptz not null default now(),

  constraint correction_description_not_blank check (length(btrim(description)) > 0),
  -- A rejection with no reason is a decision a student cannot appeal.
  constraint correction_rejection_has_note check (
    status <> 'rejected' or length(btrim(coalesce(decision_note, ''))) > 0
  )
);

create index if not exists correction_requests_status_idx
  on credential_correction_requests (status, created_at desc);


-- 2 (f) ---------------------------------------------------------------------
-- THE AUDIT TRAIL, AND IT IS IMMUTABLE IN THE DATABASE.
--
-- "Every important action should produce an immutable audit event." Immutable
-- is a word most systems use to mean "we do not have an edit screen for it".
-- Here it means the database refuses: a trigger blocks UPDATE and DELETE on
-- this table for every caller, including the service role and including the
-- Superadministrator.
--
-- That is the point. An audit trail the most powerful account can edit is not
-- an audit trail of that account, and the most powerful account is precisely
-- the one this table exists to hold to the record.

create table if not exists credential_audit_events (
  id             uuid primary key default gen_random_uuid(),

  credential_id  uuid references credentials_issued (id) on delete set null,
  -- Kept as TEXT as well, because the row must survive the credential being
  -- deleted and still say which award it was about.
  credential_ref text,

  action         text not null check (action in
                   ('issued', 'corrected', 'reissued', 'revoked', 'reinstated',
                    'printed', 'emailed', 'template_created', 'template_published',
                    'type_created', 'correction_requested', 'correction_reviewed',
                    'correction_approved', 'correction_rejected')),

  from_version   integer,
  to_version     integer,
  reason         text,

  actor_id       uuid references auth.users (id) on delete set null,
  actor_role     text,
  actor_email    text,
  ip             inet,
  user_agent     text,

  document_hash  text,
  detail         jsonb not null default '{}'::jsonb,

  occurred_at    timestamptz not null default now()
);

create index if not exists credential_audit_credential_idx
  on credential_audit_events (credential_id, occurred_at desc);
create index if not exists credential_audit_actor_idx
  on credential_audit_events (actor_id, occurred_at desc);

create or replace function credential_audit_is_append_only() returns trigger
  language plpgsql as $$
begin
  raise exception
    'credential_audit_events is append-only. % is refused: an audit trail that can be '
    'rewritten is not an audit trail of whoever can rewrite it.', tg_op;
end $$;

drop trigger if exists credential_audit_no_update on credential_audit_events;
create trigger credential_audit_no_update
  before update or delete on credential_audit_events
  for each row execute function credential_audit_is_append_only();


-- 2 (g) ---------------------------------------------------------------------
-- ROW-LEVEL SECURITY, FOR EVERY TABLE THIS FILE ADDS.
--
-- Every one of them is off-limits by default. The writes are made by guarded
-- API routes running as the service role, in the pattern 009 established for
-- results: the rules are about WHO the caller is and WHICH STEP they are on,
-- and neither is expressible as a row predicate.
--
-- The exceptions below are the ones that ARE row predicates — a person reading
-- their own connections, a student reading their own correction request — and
-- those belong here rather than in a route, because a rule enforced by the
-- database cannot be forgotten by the next route somebody writes.
--
-- NOTE ON `credential_templates`: not listed. 000 already enabled RLS on it and
-- gave it a public read policy. It is left exactly as it was.

alter table social_accounts                enable row level security;
alter table social_posts                   enable row level security;
alter table social_post_media              enable row level security;
alter table social_post_targets            enable row level security;
alter table social_post_variants           enable row level security;
alter table social_post_metrics            enable row level security;
alter table credential_types               enable row level security;
alter table credential_amendments          enable row level security;
alter table credential_correction_requests enable row level security;
alter table credential_audit_events        enable row level security;

-- YOUR OWN CONNECTIONS, AND ONLY YOURS.
--
-- This is the university's "An administrator should never receive the
-- credentials or tokens of another administrator" written as a row predicate.
-- `owner_id = auth.uid()` is false for every university account (owner_id is
-- null there) and false for every other person's, so a signed-in administrator
-- reading this table sees their own connections and nothing else — including
-- when the route that queried it forgot a WHERE clause.
drop policy if exists social_accounts_own_read on social_accounts;
create policy social_accounts_own_read on social_accounts
  for select using (owner_id = auth.uid());

-- Revoking your own connection is yours alone and needs no route.
drop policy if exists social_accounts_own_revoke on social_accounts;
create policy social_accounts_own_revoke on social_accounts
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- A credential type is public knowledge — what awards this university makes is
-- exactly the thing a verifier needs to read.
drop policy if exists credential_types_public_read on credential_types;
create policy credential_types_public_read on credential_types
  for select using (status = 'active');

-- A student may see their own correction requests and no one else's.
drop policy if exists correction_requests_own_read on credential_correction_requests;
create policy correction_requests_own_read on credential_correction_requests
  for select using (requested_by = auth.uid());


-- 3 -------------------------------------------------------------------------
-- Proof that it landed.

do $$
declare
  n integer;
  ok boolean;
begin
  select count(*) into n from information_schema.tables
   where table_schema = 'public'
     and table_name in ('social_accounts', 'social_posts', 'social_post_media',
                        'social_post_targets', 'social_post_variants',
                        'social_post_metrics', 'credential_templates',
                        'credential_types', 'credential_amendments',
                        'credential_correction_requests', 'credential_audit_events');
  if n <> 11 then
    raise exception 'Expected 11 tables for the two subsystems, found %', n;
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'social_target_consent_trg') then
    raise exception 'The personal-account consent trigger is missing; a member of staff could be posted as.';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'credential_audit_no_update') then
    raise exception 'The audit trail is editable. That is not an audit trail.';
  end if;

  -- THE COLUMNS, NOT JUST THE TABLES. The first draft of this file assumed
  -- `create table if not exists credential_templates` had created what it
  -- described; the table already existed, the CREATE did nothing, and none of
  -- its columns were there. Counting tables would not have caught that. So
  -- check that the two columns 2(b) adds are actually present.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'credential_templates'
       and column_name in ('type_id', 'fields')
     group by table_name having count(*) = 2
  ) then
    raise exception
      'credential_templates is missing type_id and/or fields. The Template Studio cannot bind a design to a credential type.';
  end if;

  -- And that the three-office publication gate from 005 is still standing.
  -- Nothing in this file touches it, which is exactly why it is worth
  -- asserting: a later migration that dropped and recreated the table would
  -- take the gate with it and nothing else would notice.
  if not exists (select 1 from pg_trigger where tgname = 'credential_templates_publication') then
    raise exception
      'The three-office approval gate on template publication is gone. A design could be published without the Registrar, the Academic Office or the Vice Chancellor.';
  end if;

  -- Prove the append-only rule rather than trusting the trigger exists.
  --
  -- THE ROW THIS LEAVES BEHIND IS DELIBERATE AND CANNOT BE REMOVED — that is
  -- what append-only means, and it applies to this migration as much as to the
  -- Vice-Chancellor. The first entry in the University's credential audit trail
  -- is the record that the audit trail was installed and proven on the day it
  -- was installed. That is a reasonable thing for it to say.
  insert into credential_audit_events (action, reason)
  values ('issued', 'Installation self-test - migration 013. The audit trail was proven append-only at install.');
  begin
    update credential_audit_events set reason = 'tampered'
     where reason like 'Installation self-test%';
    raise exception 'The audit trail accepted an UPDATE. Refusing to complete.';
  exception when others then
    if sqlerrm like '%append-only%' then
      ok := true;
    else
      raise;
    end if;
  end;

  -- ---------------------------------------------------------------------
  -- PROVE THAT A CREDENTIAL CAN ACTUALLY BE AMENDED.
  --
  -- Everything above this point checks that things EXIST. This checks that the
  -- one operation the whole subsystem is for can be performed — because the
  -- first draft of this migration passed every existence check while making
  -- amendment impossible. `credential_id` was UNIQUE, so version 2 of an award
  -- could never be written, and nothing said so until an amendment was
  -- attempted. That would have been months later, in front of a graduate.
  --
  -- So: issue a certificate, correct it, and confirm both versions survive.
  -- Then revoke and delete the test rows — which the register refuses, so they
  -- are marked instead and carry a holder name that says what they are.
  -- ---------------------------------------------------------------------
  declare
    v1 uuid;
    v2 uuid;
    ref text := 'IGUC-SELFTEST-013';
  begin
    -- Clear anything a previous run left, so this is idempotent. The register
    -- refuses DELETE by design, so a prior self-test is reused rather than
    -- removed: the unique index on (credential_id, version) makes a second
    -- insert of the same pair fail, which would look like the bug this block
    -- exists to detect.
    select id into v1 from credentials_issued where credential_id = ref and version = 1;

    if v1 is null then
      insert into credentials_issued
        (credential_id, kind, holder_name, facts, content_hash, seal_code, version)
      values (ref, 'certificate', 'Installation self-test - migration 013',
              '{}'::jsonb, 'selftest-v1', 'selftest-v1', 1)
      returning id into v1;
    end if;

    select id into v2 from credentials_issued where credential_id = ref and version = 2;

    if v2 is null then
      begin
        insert into credentials_issued
          (credential_id, kind, holder_name, facts, content_hash, seal_code, version, supersedes_id)
        values (ref, 'certificate', 'Installation self-test - migration 013 (corrected)',
                '{}'::jsonb, 'selftest-v2', 'selftest-v2', 2, v1)
        returning id into v2;
      exception when unique_violation then
        raise exception
          'A CREDENTIAL CANNOT BE AMENDED. Version 2 was refused because credential_id is still '
          'uniquely constrained on its own. Every correction the University makes would fail. %', sqlerrm;
      end;
    end if;

    -- Both versions must survive. That is "never destroy the previous
    -- certificate", checked rather than asserted.
    if (select count(*) from credentials_issued where credential_id = ref) <> 2 then
      raise exception 'Amendment did not leave two versions. The previous certificate was destroyed.';
    end if;

    -- And the chain must refuse a version that claims to belong to another award.
    begin
      insert into credentials_issued
        (credential_id, kind, holder_name, facts, content_hash, seal_code, version, supersedes_id)
      values ('IGUC-SELFTEST-013-OTHER', 'certificate', 'Should not exist',
              '{}'::jsonb, 'x', 'x', 3, v2);
      raise exception 'Two different awards were allowed to share a version chain.';
    exception when others then
      if sqlerrm not like '%different award%' then raise; end if;
    end;

    -- Mark the self-test rows so nobody mistakes them for a real award. They
    -- cannot be deleted — the register refuses deletion, on purpose.
    update credentials_issued
       set status = 'revoked',
           revocation_reason = 'Installation self-test row from migration 013. Not a real credential.'
     where credential_id = ref and status <> 'revoked';
  end;

  raise notice 'Social pipeline and Credential Authority installed: 11 tables, consent enforced, audit trail append-only.';
  raise notice 'Amendment proven: a credential can be corrected to version 2 and version 1 survives.';
  raise notice 'Proctored examinations are NOT in this migration - awaiting the university''s specification.';
end $$;
