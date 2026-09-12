-- ===========================================================================
-- 049 — VERIFICATION, SIGNATURES, AND THE LETTER AS IT WAS WRITTEN
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. AN OFFICIAL LETTER CAN BE CHECKED BY A STRANGER. 042 built the
--    verification view for appointment letters; correspondence had none, so a
--    ministry holding a letter from the Vice-Chancellor could scan its QR code
--    and be told nothing. `correspondence_verification` answers for it.
--
-- 2. A SIGNATURE IMAGE IS A CONTROLLED FEATURE, NOT A FILE ON A PAGE. The
--    University asked that an electronic signature be explicit rather than an
--    image pasted onto every document. `signature_specimens` holds one per
--    officer, switched off until somebody OTHER than its owner enables it, and
--    every letter records which mode it was signed in. An officer's signature
--    that anybody can attach to anything is a forgery kit.
--
-- 3. THE VICE-CHANCELLOR CAN WRITE A LETTER RATHER THAN TYPE ONE. Official
--    correspondence gains `body_format`, so a body can be plain text or the
--    sanitised HTML a rich-text editor produces. Plain stays the default and
--    every existing letter is plain.
--
-- 4. TWO KINDS OF LETTER THE UNIVERSITY NAMED AND THE REGISTER DID NOT HAVE:
--    an Official Response and a Special Assignment.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THE PUBLIC VERIFICATION OF A LETTER NAMES NOBODY. An appointment letter's
-- view already carries the holder and the post, because that is what a bank or
-- an embassy is checking. Correspondence is different: a warning letter and a
-- disciplinary directive are correspondence, and a verification page that
-- printed "To: [name], Subject: Final written warning" would publish a
-- disciplinary record to anybody who scanned the code.
--
-- So `correspondence_verification` carries the reference, the kind, the office,
-- the date, the version and whether it stands — and no recipient, no subject
-- and no body. It answers "is this a genuine, current letter of the University"
-- and refuses to answer anything else.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TWO MISSING KINDS
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'correspondence'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%commendation%'
     and pg_get_constraintdef(oid) like '%directive%'
   limit 1;

  if con is not null then
    execute format('alter table correspondence drop constraint %I', con);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'correspondence_kind_known') then
    alter table correspondence add constraint correspondence_kind_known
      check (kind in (
        'general', 'appointment', 'reappointment', 'promotion', 'invitation',
        'commendation', 'recommendation', 'government', 'university',
        'partnership', 'directive', 'warning', 'authorization',
        'official-response', 'special-assignment', 'special', 'other'));
  end if;
end $$;


-- ===========================================================================
-- 2. THE LETTER AS IT WAS WRITTEN
-- ===========================================================================
--
-- SANITISED BEFORE IT ARRIVES, NOT WHEN IT IS DISPLAYED. The application holds
-- a closed allow-list of tags and strips everything else on the way in, so what
-- is stored is what can safely be printed. Sanitising on the way out would mean
-- the archived bytes and the printed bytes are different documents, and the
-- hash then proves the wrong one.
--
-- A NOTE ON WHY THIS IS NOT A FREE FIELD. The body goes onto a sealed document.
-- Script, style, iframe, event handlers and external references are refused by
-- the application, and this constraint is the database saying the same thing
-- for a caller that forgets — a crude check, deliberately, because a
-- sophisticated one in SQL would be a second sanitiser to keep in step.

alter table correspondence
  add column if not exists body_format text not null default 'plain';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'correspondence_body_format_known') then
    alter table correspondence add constraint correspondence_body_format_known
      check (body_format in ('plain', 'html'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'correspondence_body_carries_no_script') then
    alter table correspondence add constraint correspondence_body_carries_no_script
      check (
        body_format <> 'html'
        -- `\y`, NOT `\b`. Postgres regular expressions read `\b` as a
        -- backspace character, not a word boundary — so the first version of
        -- this constraint matched nothing at all and the proof below walked a
        -- script straight into the body of an official letter. It took one run
        -- to find, which is the argument for performing a guard rather than
        -- reading it.
        or (body !~* '<\s*(script|style|iframe|object|embed|form|link|meta)\y'
            and body !~* '\son[a-z]+\s*=')
      );
  end if;
end $$;

comment on column correspondence.body_format is
  'plain or html. HTML is what a rich-text editor produced, sanitised by the application '
  'against a closed allow-list BEFORE it was stored — so the archived bytes and the printed '
  'bytes are the same document and the hash proves the one that went out.';


-- ===========================================================================
-- 3. SIGNATURES — AN EXPLICIT, CONTROLLED FEATURE
-- ===========================================================================
--
-- The University's instruction: "make it an explicit controlled feature rather
-- than simply placing an image of a signature onto every document."
--
-- So a specimen is off until switched on, switched on by somebody other than
-- the person whose signature it is, and usable only by that person. An
-- officer's signature image that any administrator can attach to any document
-- is not a signature; it is a forgery kit with an audit trail.

create table if not exists signature_specimens (
  id            uuid primary key default gen_random_uuid(),

  -- WHOSE SIGNATURE IT IS. One per person: two specimens for one officer means
  -- two signatures on the University's documents and no way to say which is
  -- theirs.
  owner_id      uuid not null unique references auth.users (id) on delete cascade,
  owner_name    text not null check (length(btrim(owner_name)) >= 3),
  owner_role    text not null check (length(btrim(owner_role)) >= 2),

  -- A data URI. Held in the row rather than in storage because it is small,
  -- because it must not be fetchable by URL, and because a signature reachable
  -- over HTTP is a signature anybody can download.
  image         text check (image is null or image like 'data:image/%'),

  -- OFF UNTIL SWITCHED ON.
  enabled       boolean not null default false,
  enabled_by    uuid references auth.users (id) on delete set null,
  enabled_at    timestamptz,
  -- Why the University permitted it. A specimen signature is a standing
  -- authority to sign in somebody's name, and one nobody explained is one
  -- nobody can withdraw with confidence.
  authority     text,

  revoked_at    timestamptz,
  revoked_reason text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$
begin
  -- NOBODY ENABLES THEIR OWN. The same second pair of eyes this system requires
  -- of a certificate design, a letter template and a job description — and here
  -- the thing being approved is the ability to reproduce somebody's signature.
  if not exists (select 1 from pg_constraint where conname = 'signature_specimens_second_pair_of_eyes') then
    alter table signature_specimens add constraint signature_specimens_second_pair_of_eyes
      check (enabled_by is null or enabled_by <> owner_id);
  end if;

  -- AN ENABLED SPECIMEN NAMES WHO ENABLED IT, WHEN, ON WHAT AUTHORITY, AND HAS
  -- AN IMAGE TO USE.
  if not exists (select 1 from pg_constraint where conname = 'signature_specimens_enabling_is_complete') then
    alter table signature_specimens add constraint signature_specimens_enabling_is_complete
      check (
        not enabled
        or (enabled_by is not null and enabled_at is not null and image is not null
            and authority is not null and length(btrim(authority)) >= 20)
      );
  end if;

  -- A REVOKED SPECIMEN IS NOT ENABLED.
  if not exists (select 1 from pg_constraint where conname = 'signature_specimens_revoked_is_off') then
    alter table signature_specimens add constraint signature_specimens_revoked_is_off
      check (revoked_at is null or not enabled);
  end if;
end $$;

alter table signature_specimens enable row level security;

-- NOBODY READS SOMEBODY ELSE'S SPECIMEN. Not HR, not an administrator. The
-- letter generator runs with the service role and reads it for the person who
-- is signing; nothing else has a reason to see the image at all.
drop policy if exists signature_specimens_own on signature_specimens;
create policy signature_specimens_own on signature_specimens
  for select to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- AND EVERY LETTER RECORDS HOW IT WAS SIGNED
-- ---------------------------------------------------------------------------
--
-- "Signed by [name] / Title / Authorization date" — the three the University
-- asked to be recorded, plus the one that matters afterwards: whether the
-- document carries a reproduced signature or a typed name over a rule.

alter table appointment_letters
  add column if not exists signature_mode text not null default 'typed',
  add column if not exists signature_specimen_id uuid references signature_specimens (id)
    on delete restrict,
  add column if not exists authorized_on date;

alter table correspondence_letters
  add column if not exists signature_mode text not null default 'typed',
  add column if not exists signature_specimen_id uuid references signature_specimens (id)
    on delete restrict,
  add column if not exists authorized_on date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_signature_mode_known') then
    alter table appointment_letters add constraint appointment_letters_signature_mode_known
      check (signature_mode in ('typed', 'specimen')
             and (signature_mode <> 'specimen' or signature_specimen_id is not null));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'correspondence_letters_signature_mode_known') then
    alter table correspondence_letters add constraint correspondence_letters_signature_mode_known
      check (signature_mode in ('typed', 'specimen')
             and (signature_mode <> 'specimen' or signature_specimen_id is not null));
  end if;
end $$;


-- ===========================================================================
-- 4. WHAT A STRANGER IS TOLD
-- ===========================================================================
--
-- THIS VIEW NAMES NOBODY, and that is the whole design of it. A warning letter
-- and a disciplinary directive are correspondence. A verification page printing
-- "To: [name] — Subject: Final written warning" would publish a disciplinary
-- record to anybody who scanned the code off a document lying on a desk.
--
-- It answers one question: is this a genuine, current letter of the University.

-- ---------------------------------------------------------------------------
-- DROPPED FIRST, NOT REPLACED. `create or replace view` cannot remove a column,
-- and on the SECOND run of RUN-ALL 042 recreates the appointment view in its
-- own narrower shape and then this file tries to widen it again — which
-- Postgres refuses with "cannot drop columns from view". The first pass was
-- clean and the second was not, which is exactly what running it twice is for.
-- ---------------------------------------------------------------------------
drop view if exists correspondence_verification;

create view correspondence_verification
with (security_invoker = false) as
select l.reference,
       'Official Correspondence'::text as document,
       -- The KIND is safe and useful — a reader is checking a letter they are
       -- already holding, and it tells them the register agrees with the
       -- letterhead in front of them.
       c.kind,
       c.originating_office            as office,
       l.issued_on                     as issued,
       l.version,
       case
         -- A SUPERSEDED LETTER IS NOT A FORGERY, and saying so would be wrong
         -- in a way that costs somebody a contract. It was genuine and has
         -- been replaced.
         when l.superseded_at is not null then 'Superseded'
         when c.status = 'withdrawn' then 'Withdrawn'
         when c.status <> 'issued' then 'Not issued'
         else 'Valid'
       end                             as status,
       (select max(v.version) from correspondence_letters v
         where v.correspondence_id = l.correspondence_id) as current_version,
       l.signature_mode
  from correspondence_letters l
  join correspondence c on c.id = l.correspondence_id;

comment on view correspondence_verification is
  'What the QR code on an official letter resolves to. Carries no recipient, no subject and '
  'no body: a warning letter is correspondence, and a verification page that named the '
  'recipient would publish a disciplinary record to anybody who scanned the code.';

grant select on correspondence_verification to anon, authenticated, service_role;

-- The appointment view gains the signature mode too, so a reader can be told
-- whether the document they hold carries a reproduced signature.
drop view if exists appointment_letter_verification;

create view appointment_letter_verification
with (security_invoker = false) as
select l.reference,
       'Appointment Letter'::text             as document,
       a.full_name                            as holder,
       a.position_title                       as position,
       coalesce(a.unit_name, '')              as unit,
       l.issued_on                            as issued,
       l.version,
       case
         when l.superseded_at is not null then 'Superseded'
         when a.status in ('withdrawn', 'declined') then 'Not in force'
         when a.status = 'ended' then 'Ended'
         else 'Valid'
       end                                    as status,
       (select max(v.version) from appointment_letters v
         where v.appointment_id = l.appointment_id) as current_version,
       l.signature_mode
  from appointment_letters l
  join appointments a on a.id = l.appointment_id;

grant select on appointment_letter_verification to anon, authenticated, service_role;


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  other uuid;
  c_id uuid;
  s_id uuid;
  found text;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '049: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    -- ---- THE TWO NEW KINDS ARE FILEABLE -----------------------------------
    insert into correspondence (kind, subject, body, recipient_name, initiated_by, status)
    values ('official-response', 'Response to the Ministry',
            'The University responds to the correspondence received last month as follows.',
            'The Ministry of Higher Education', someone, 'draft')
    returning id into c_id;

    insert into correspondence (kind, subject, body, recipient_name, initiated_by, status)
    values ('special-assignment', 'Special assignment',
            'You are assigned to the task described below for the period stated.',
            'A Specimen Officer', someone, 'draft');

    -- ---- A RICH-TEXT BODY CANNOT CARRY A SCRIPT ---------------------------
    -- The body goes onto a sealed document. This is the database saying what
    -- the application's sanitiser says, for the caller that forgets.
    refused := false;
    begin
      update correspondence
         set body_format = 'html',
             body = '<p>Dear Minister,</p><script>alert(1)</script><p>Yours sincerely.</p>'
       where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '049 FAILED: a script reached the body of an official letter';
    end if;

    refused := false;
    begin
      update correspondence
         set body_format = 'html',
             body = '<p onclick="steal()">Dear Minister, the University writes as follows.</p>'
       where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '049 FAILED: an event handler reached the body of an official letter';
    end if;

    -- …and ordinary marked-up prose is fine.
    update correspondence
       set body_format = 'html',
           body = '<p>Dear Minister,</p><p>The University writes to confirm the '
                  || 'arrangements discussed, and <strong>accepts</strong> the timetable '
                  || 'proposed.</p>'
     where id = c_id;

    -- ---- NOBODY ENABLES THEIR OWN SIGNATURE -------------------------------
    insert into signature_specimens (owner_id, owner_name, owner_role, image)
    values (someone, 'The Vice-Chancellor', 'Vice-Chancellor',
            'data:image/png;base64,iVBORw0KGgo=')
    returning id into s_id;

    refused := false;
    begin
      update signature_specimens
         set enabled = true, enabled_by = someone, enabled_at = now(),
             authority = 'Approved by the University Council on the date stated.'
       where id = s_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '049 FAILED: an officer switched on the reproduction of their own '
                      'signature, so one person created a standing authority to sign in '
                      'their own name';
    end if;

    -- ---- AND ENABLING ONE SAYS ON WHAT AUTHORITY --------------------------
    refused := false;
    begin
      update signature_specimens
         set enabled = true, enabled_by = other, enabled_at = now()
       where id = s_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '049 FAILED: a specimen signature was switched on with no authority '
                      'stated, so nobody can say on what basis it may be withdrawn';
    end if;

    update signature_specimens
       set enabled = true, enabled_by = other, enabled_at = now(),
           authority = 'Approved by the University Council on the date stated.'
     where id = s_id;

    -- ---- A LETTER SIGNED BY SPECIMEN NAMES THE SPECIMEN -------------------
    refused := false;
    begin
      update correspondence_letters set signature_mode = 'specimen'
       where reference = 'VC-2026-0042';
    exception when others then refused := true;
    end;
    -- (the row may not exist on this database; what matters is that a mode of
    -- 'specimen' with no specimen is refused, proved directly below)

    insert into correspondence (kind, subject, body, recipient_name, initiated_by,
                                status, authorized_by, authorized_at, issued_at)
    values ('invitation', 'Convocation invitation',
            'The University would be honoured by your presence at its convocation.',
            'A Specimen Guest', someone, 'issued', other, now(), now())
    returning id into c_id;

    refused := false;
    begin
      insert into correspondence_letters
        (correspondence_id, reference, issued_on, html, signature_mode)
      values (c_id, 'VC-2026-9049', current_date, '<p>The letter.</p>', 'specimen');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '049 FAILED: a letter claims a reproduced signature and names no '
                      'specimen, so nobody can say whose signature is on it';
    end if;

    insert into correspondence_letters
      (correspondence_id, reference, issued_on, html, signature_mode, signature_specimen_id)
    values (c_id, 'VC-2026-9049', current_date, '<p>The letter.</p>', 'specimen', s_id);

    -- ---- AND THE STRANGER IS TOLD ENOUGH, AND NO MORE ---------------------
    select status into found from correspondence_verification where reference = 'VC-2026-9049';
    if found is distinct from 'Valid' then
      raise exception '049 FAILED: an issued letter verifies as %', coalesce(found, 'nothing');
    end if;

    -- THE PRIVACY CHECK, PERFORMED RATHER THAN ASSERTED IN A COMMENT.
    if exists (
      select 1 from information_schema.columns
       where table_name = 'correspondence_verification'
         and column_name in ('recipient_name', 'recipient_org', 'recipient_email',
                             'subject', 'body', 'recipient_address')
    ) then
      raise exception '049 FAILED: the public verification of a letter carries the recipient '
                      'or the subject, so scanning a warning letter publishes a disciplinary '
                      'record';
    end if;

    -- A withdrawn letter says so rather than reading as a forgery.
    update correspondence set status = 'withdrawn',
           withdrawn_reason = 'Superseded by a later decision of the University.'
     where id = c_id;
    select status into found from correspondence_verification where reference = 'VC-2026-9049';
    if found is distinct from 'Withdrawn' then
      raise exception '049 FAILED: a withdrawn letter verifies as %', coalesce(found, 'nothing');
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '049 OK: an official response and a special assignment are fileable kinds';
  raise notice '049 OK: a rich-text body cannot carry a script, a style block or an event '
               'handler onto a sealed document';
  raise notice '049 OK: nobody switches on the reproduction of their own signature, and '
               'enabling one states the authority for it';
  raise notice '049 OK: a letter claiming a reproduced signature names whose it is';
  raise notice '049 OK: a stranger can check a letter, and is told no recipient and no subject';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- Every letter a stranger could be holding, and what they would be told.
select reference, kind, office, issued, version, status
  from correspondence_verification
 order by issued desc, reference;

-- SPECIMEN SIGNATURES IN FORCE. Each one is a standing authority to reproduce
-- somebody's signature on a University document. If this list is longer than
-- the University expects, that is the thing to act on today.
select owner_name, owner_role, enabled, enabled_at, authority
  from signature_specimens
 where enabled
 order by owner_name;
