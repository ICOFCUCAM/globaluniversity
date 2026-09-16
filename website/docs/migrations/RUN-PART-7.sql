-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 100, 101, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-PART-7.sql 100 101
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN-PART-7.sql
--
-- Every migration in it is idempotent and destroys nothing, so running it twice
-- is safe. It is NOT wrapped in a transaction: each file is written to run
-- statement by statement, and wrapping them would mean a failure in the last
-- one silently undid the first.
--
-- ---------------------------------------------------------------------------
-- WHAT TO EXPECT IN THE OUTPUT
--
-- Some of these raise NOTICE deliberately — they report on the state they
-- found rather than changing it silently. A notice is information, not a
-- warning. An ERROR is a real failure and stops the run.
--
-- ---------------------------------------------------------------------------
-- AFTERWARDS
--
-- The LAST THING this file prints is a table saying which of these migrations
-- landed. You do not have to run anything else to find out — and you should
-- not have to, because the Supabase SQL editor does not display the NOTICE
-- lines the proofs write.
-- ===========================================================================

-- ===========================================================================
-- ===========================================================================
--
--   100_the_transcript_is_issued_to_a_student_we_have.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 100 — OFFICIAL TRANSCRIPT CONTROL
-- ===========================================================================
--
-- The University's ruling, given on 16 September 2026:
--
--   "An official ICOF transcript shall be generated only from an authorized
--    student academic record maintained within the university's authoritative
--    information system. […] No official transcript shall be generated for a
--    person who is not represented by an authorized student record in the
--    system through the ordinary transcript workflow. Where an exceptional
--    case requires consideration […] the matter shall require validation by
--    the Vice-Chancellor or SuperAdmin before transcript generation is
--    permitted. Every transcript generation shall create an auditable system
--    record […]. The Vice-Chancellor and SuperAdmin shall have continuous
--    access to the transcript audit record."
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A DOOR CLOSES. An official transcript can no longer be recorded for a
--    person who is not a student row, by anybody, including the
--    Superadministrator. The ordinary path requires `student_id`; the only
--    other way in is an approved validation request, and only the
--    Vice-Chancellor or the Superadministrator can approve one.
--
-- 2. EVERY GENERATION IS WRITTEN DOWN AND CANNOT BE UNWRITTEN. A row in
--    `transcript_issues` cannot be updated and cannot be deleted — not
--    corrected, not tidied, not by the office that created it and not by the
--    centre. If a transcript was wrong, the record of it having been generated
--    is still the truth about what happened.
--
-- 3. GENERATING AGAIN NEVER REPLACES. The second transcript for a student is
--    version 2 and the first one stays. The University asked for this in as
--    many words — "the system should not overwrite the previous event" —
--    because an academic record changes over time and the question that has to
--    be answerable later is what was generated, from what record, by whom, and
--    when.
--
-- 4. THE VICE-CHANCELLOR AND THE SUPERADMINISTRATOR EACH ISSUE ALONE. Neither
--    needs the other, and neither needs anybody: "the audit trail is the
--    control, not mandatory dual authorization." The only thing that requires
--    a second person is the EXCEPTION — a transcript for somebody who is not
--    in the register — and there the second person is one of those two.
--
-- 5. A NATIONAL RECTOR CANNOT ISSUE ONE. Not refused by a screen: the office
--    is not in the list a generation row may name.
--
-- 6. NOTHING IS SEEDED. Three tables and a view, all empty. No existing
--    transcript, credential or `transcript_requests` row is touched, moved or
--    re-interpreted.
--
-- 7. ONE THING TO DECIDE. The University's table of who may generate names
--    five offices, and `admin` — the System Administrator — is not among them.
--    It holds `issue-credential` today and has since 004, so this migration
--    admits it rather than quietly removing a power nobody asked to remove.
--    If it should go, it is one word in
--    `transcript_issue_names_an_office`.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS NOT `transcript_requests`
-- ---------------------------------------------------------------------------
--
-- 019 already built `transcript_requests` and 076 gave it a download counter: a
-- STUDENT ASKS FOR a transcript, an office decides, and the download is spent.
-- It has a not-null foreign key to `students`, so it has never been able to
-- name a person who does not exist.
--
-- What it does not record is the GENERATION. A request that reaches `issued`
-- says somebody decided to issue one; it does not say who pressed the button,
-- on what day, from which academic record, as which version, or whether the
-- resulting document was emailed and to whom. And the University's ruling is
-- about the generation, not the asking: a Registrar generating a transcript
-- for a graduate who telephoned has no request row at all.
--
-- So an issue MAY point at the request that prompted it and usually will not.
--
-- ---------------------------------------------------------------------------
-- WHY THE EXCEPTIONAL PATH DOES NOT LET ANYBODY TYPE A TRANSCRIPT
-- ---------------------------------------------------------------------------
--
-- The obvious reading of "the SuperAdmin or VC must validate before it is
-- generated" is a form with a name, a programme and a list of courses on it,
-- countersigned. That would be the very thing the ruling exists to stop: an
-- official transcript carrying information that exists outside the University's
-- authoritative records, with an approval attached.
--
-- So a validation request carries NO ACADEMIC INFORMATION. It carries the
-- claim — a name, a claimed student number, a programme, a year — the reason,
-- and the evidence. Approving it does not create a transcript and does not
-- create a student. It records that the Vice-Chancellor or the
-- Superadministrator has looked at the case and permits the exception, and it
-- is the thing an issue points at when its `student_id` is null.
--
-- The academic content of an exceptional transcript is whatever the University
-- then puts in the student register. There is no route around the register.
-- ===========================================================================


-- ===========================================================================
-- 1. WHO MAY VALIDATE
-- ===========================================================================
--
-- NARROWER THAN `governs_the_university()` ON PURPOSE. That one admits the
-- Registrar, the Academic Office and the Finance Director, which is right for
-- "this is an institutional act rather than a national one" and wrong here:
-- the Registrar is precisely the officer this validation is checking.
--
-- Two roles, named by the University, and no others.
-- ===========================================================================

create or replace function validates_a_transcript_exception(who uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role in ('superadmin', 'vice-chancellor')
       from profiles p
      where p.id = coalesce(who, auth.uid())),
    false);
$$;

comment on function validates_a_transcript_exception(uuid) is
  'The Vice-Chancellor or the Superadministrator, and nobody else. Takes the person '
  'explicitly because the routes act under the service key, where auth.uid() is null and '
  'the caller is recorded in the row rather than held in the session.';


-- ===========================================================================
-- 2. THE EXCEPTIONAL PATH — A VALIDATION REQUEST
-- ===========================================================================

create table if not exists transcript_validation_requests (
  id                 uuid primary key default gen_random_uuid(),

  -- ---- The claim, and it is a claim ---------------------------------------
  --
  -- Named `claimed_` because that is what these are until somebody validates
  -- them. A column called `student_number` on this table would be asserting
  -- the thing the row exists to question.
  claimed_student_number text not null check (length(btrim(claimed_student_number)) >= 3),
  claimed_full_name      text not null check (length(btrim(claimed_full_name)) >= 3),
  claimed_programme      text,
  claimed_year           text,

  -- Where the request comes from, where there is a nation. 097's register.
  administration_id  uuid references national_administrations (id) on delete restrict,

  -- ---- WHY. Compulsory, and long enough to be a case rather than a word.
  -- The Vice-Chancellor reads this and has to decide on it; "not in system" is
  -- not something anybody can decide on.
  reason             text not null check (length(btrim(reason)) >= 30),

  -- ---- The supporting documentation ---------------------------------------
  --
  -- A list of {name, path} against the University's own storage, not a blob
  -- and not a URL somewhere else. Empty is allowed: an officer may have a case
  -- with nothing scanned yet, and refusing to record it would send the case
  -- back into email, which is where this table exists to stop it living.
  evidence           jsonb not null default '[]'::jsonb
                     check (jsonb_typeof(evidence) = 'array'),

  -- ---- Who asked ----------------------------------------------------------
  requested_by       uuid not null references auth.users (id) on delete restrict,
  requested_role     text not null,
  requested_at       timestamptz not null default now(),

  -- ---- Where it has got to ------------------------------------------------
  --
  -- `submitted`  with the Vice-Chancellor or the Superadministrator
  -- `approved`   the exception is permitted; an issue may name this request
  -- `rejected`   it will not proceed
  -- `returned`   sent back for correction, and the officer may resubmit
  status             text not null default 'submitted'
                     check (status in ('submitted', 'approved', 'rejected', 'returned')),
  decided_by         uuid references auth.users (id) on delete restrict,
  decided_at         timestamptz,

  -- A REJECTION OR A RETURN CARRIES A SENTENCE. The officer who raised it has
  -- to know what to do next, and a bare "rejected" tells them to ask again.
  decision_note      text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint transcript_validation_decider_is_not_the_requester
    check (decided_by is null or decided_by <> requested_by),

  constraint transcript_validation_refusal_says_why
    check (status not in ('rejected', 'returned')
           or (decision_note is not null and length(btrim(decision_note)) >= 10)),

  constraint transcript_validation_decided_rows_name_the_decider
    check (status = 'submitted' or (decided_by is not null and decided_at is not null))
);

create index if not exists transcript_validation_requests_open_idx
  on transcript_validation_requests (requested_at desc) where status = 'submitted';

create index if not exists transcript_validation_requests_by_officer_idx
  on transcript_validation_requests (requested_by, requested_at desc);

comment on table transcript_validation_requests is
  'The exceptional path. An officer who has evidence that a legitimate student exists but '
  'cannot be found in the register asks the Vice-Chancellor or the Superadministrator to '
  'permit an exception. It carries NO academic information: approving it does not create a '
  'transcript, does not create a student, and does not put a course or a grade anywhere.';


-- ---------------------------------------------------------------------------
-- AND THE DECISION IS THE VICE-CHANCELLOR'S OR THE SUPERADMINISTRATOR'S
--
-- Checks the RECORDED DECIDER rather than the session, which is 099's pattern
-- and the only one that works: these rows are written by a route holding the
-- service key, where `auth.uid()` is null and the caller is in the row.
-- ---------------------------------------------------------------------------

create or replace function a_transcript_exception_is_validated_from_above()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'submitted' then
    -- Resubmission after a return. It goes back to waiting and forgets the
    -- decision, so that a second decision is a decision and not an edit of the
    -- first one.
    new.decided_by := null;
    new.decided_at := null;
    return new;
  end if;

  new.decided_by := coalesce(new.decided_by, auth.uid());
  new.decided_at := coalesce(new.decided_at, now());

  if new.decided_by is null then
    raise exception 'A transcript validation is decided by somebody. Record who.'
      using errcode = 'insufficient_privilege';
  end if;

  if not validates_a_transcript_exception(new.decided_by) then
    raise exception 'Only the Vice-Chancellor or the Superadministrator may validate an '
                    'exceptional transcript. The offices that ask are the offices this '
                    'validation exists to check.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists transcript_validation_is_from_above on transcript_validation_requests;
create trigger transcript_validation_is_from_above
  before update on transcript_validation_requests
  for each row execute function a_transcript_exception_is_validated_from_above();

drop trigger if exists transcript_validation_requests_updated_at
  on transcript_validation_requests;
create trigger transcript_validation_requests_updated_at
  before update on transcript_validation_requests
  for each row execute function set_updated_at();


-- ===========================================================================
-- 3. THE GENERATION ITSELF
-- ===========================================================================

create table if not exists transcript_issues (
  id                    uuid primary key default gen_random_uuid(),

  -- §9 "Generated document identifier". Unique, printed on the document, and
  -- the thing the University quotes when asking what happened.
  document_reference    text not null unique
                        check (document_reference ~ '^TRN-[0-9]{4}-[0-9]{4,}$'),

  -- ---- WHOSE TRANSCRIPT ---------------------------------------------------
  --
  -- THIS IS THE RULING. `on delete restrict`, because a student row that has
  -- had a transcript generated from it is not deletable without the University
  -- deciding what happens to the record of that generation.
  student_id            uuid references students (id) on delete restrict,

  -- The only way `student_id` may be null: an approved exception.
  validation_request_id uuid references transcript_validation_requests (id)
                        on delete restrict,

  -- ---- THE RECORD IT WAS MADE FROM, AS IT WAS AT THAT MOMENT --------------
  --
  -- Copied, not joined. A transcript generated in January and a transcript
  -- generated in September are different documents precisely because the
  -- academic record moved between them, and an audit row that joins to the
  -- live record can only ever show today's answer to a question about March.
  student_number        text not null,
  student_name          text not null,
  programme             text,
  administration_id     uuid references national_administrations (id) on delete restrict,

  -- §9 "Academic record used". The courses, credits, grades, years and
  -- semesters the transcript was built from, exactly as the engine read them.
  academic_record       jsonb not null
                        check (jsonb_typeof(academic_record) = 'object'),

  -- "Source Academic Record: AR-2026-00125" — the University's own example.
  -- The content is in the column above; this is the name the content had, so
  -- that a transcript and the record it came from can be spoken about in one
  -- sentence without quoting the whole thing.
  academic_record_ref   text,

  -- ---- WHO GENERATED IT ---------------------------------------------------
  issued_by             uuid not null references auth.users (id) on delete restrict,
  -- §9 "Officer's role". STORED, NOT JOINED, for the same reason as above: a
  -- Registrar who later becomes a Dean did not generate this as a Dean.
  issued_role           text not null,
  -- §5 and §9. The date AND the time, and neither is typed by anybody: the
  -- default is the only way this column is ever filled, because the row cannot
  -- afterwards be updated.
  issued_at             timestamptz not null default now(),
  -- §9 "IP/session information, where appropriate".
  session_info          jsonb not null default '{}'::jsonb
                        check (jsonb_typeof(session_info) = 'object'),

  -- ---- §14 VERSION --------------------------------------------------------
  --
  -- Per student and monotonic. Set by a trigger, never by a caller.
  version               integer not null check (version >= 1),

  -- ---- THE DOCUMENT -------------------------------------------------------
  --
  -- THE ARCHIVED BYTES, and §12's "the email should use the generated official
  -- document — not a manually uploaded file" is why. Previewing, downloading,
  -- printing and emailing all open this column. A second rendering path would
  -- be a second answer to "what does the transcript say".
  html                  text not null check (length(html) >= 200),

  -- Where it came from, when the student had asked. Usually null: a Registrar
  -- generating one for a graduate who telephoned has no request row.
  transcript_request_id uuid references transcript_requests (id) on delete set null,

  -- ---- AND THE REGISTER ENTRY IT SEALED ----------------------------------
  --
  -- 004's `credentials_issued` row: the same act seen from the other side.
  -- This one records that a transcript WAS GENERATED, by whom and from what;
  -- that one records what the University ISSUED and carries the seal.
  --
  -- THE LINK IS WHAT MAKES §13 POSSIBLE. The delivery route works from the
  -- register entry, so without a column joining the two there is no way to
  -- write "this transcript was emailed" against the generation the
  -- Vice-Chancellor is reading. Nullable, because a generation recorded
  -- without a register entry is still a generation and losing it would be
  -- worse than leaving the column empty.
  credential_id         uuid references credentials_issued (id) on delete restrict,

  created_at            timestamptz not null default now(),

  constraint transcript_issue_names_a_student_or_carries_a_validation
    check (student_id is not null or validation_request_id is not null),

  -- ---- "THE SYSTEM MUST NEVER RECORD MERELY 'SYSTEM GENERATED'" -----------
  --
  -- The University's §6, and `issued_by` being NOT NULL is only half of it: a
  -- row can name a real account and still describe it as something that is not
  -- an office. These are the five the University's own table admits to
  -- "Generate ordinary transcript", plus one.
  --
  -- THE ONE IS `admin`, AND THE UNIVERSITY DID NOT NAME IT. The System
  -- Administrator holds `issue-credential` today and has since 004, so leaving
  -- it out would take away a power they have rather than decline to add one —
  -- a change they did not ask for. It is admitted here and flagged rather than
  -- decided quietly. Delete the one word to close it.
  --
  -- `national-rector` is ABSENT and that is the University's §8: a National
  -- Rector has no transcript issuance authority unless separately delegated.
  constraint transcript_issue_names_an_office
    check (issued_role in ('superadmin', 'admin', 'vice-chancellor',
                           'registrar', 'academic-office'))
);

-- ---------------------------------------------------------------------------
-- AND `credential_id` IS ADDED AGAIN, EXPLICITLY.
--
-- `create table if not exists` DOES NOTHING WHEN THE TABLE IS THERE — not even
-- the new column. This migration was published before the column existed, so a
-- database that ran the earlier version has `transcript_issues` without it, and
-- the create above would skip silently and leave the index below failing on a
-- column that does not exist.
--
-- The bundle test caught exactly this by applying the new bundle to a database
-- built from the previous commit. Every column added to an existing table in
-- this codebase is written as its own `alter table` for the same reason — see
-- 097, where seven of them landed inside a `do` block and nothing reading the
-- SQL could see them.
-- ---------------------------------------------------------------------------

alter table transcript_issues
  add column if not exists credential_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'transcript_issues_credential_id_fkey'
       and conrelid = 'transcript_issues'::regclass) then
    alter table transcript_issues
      add constraint transcript_issues_credential_id_fkey
      foreign key (credential_id) references credentials_issued (id) on delete restrict;
  end if;
end $$;

alter table transcript_issues
  add column if not exists academic_record_ref text;

create unique index if not exists transcript_issues_student_version_idx
  on transcript_issues (student_id, version) where student_id is not null;

create index if not exists transcript_issues_when_idx
  on transcript_issues (issued_at desc);

create index if not exists transcript_issues_officer_idx
  on transcript_issues (issued_by, issued_at desc);

create index if not exists transcript_issues_number_idx
  on transcript_issues (student_number);

-- ONE GENERATION PER REGISTER ENTRY. Without this the delivery route could
-- find two generations for one sealed transcript and record the send against
-- whichever came back first.
create unique index if not exists transcript_issues_credential_idx
  on transcript_issues (credential_id) where credential_id is not null;

comment on table transcript_issues is
  'One row per official transcript generated, immutable. §9 of the University''s transcript '
  'ruling: student, academic record used, requesting officer and their role, national '
  'administration, date and time, session, version, validation, document identifier.';


-- ---------------------------------------------------------------------------
-- THE EXCEPTION IS APPROVED, OR THERE IS NO EXCEPTION
--
-- The CHECK above says an issue names a student OR a validation. It cannot say
-- that the validation was APPROVED, or that the student number matches what
-- was validated, because a CHECK cannot read another table. This can.
-- ---------------------------------------------------------------------------

create or replace function a_transcript_comes_from_the_register()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  if new.student_id is not null then
    return new;
  end if;

  select status, claimed_student_number, decided_by
    into v
    from transcript_validation_requests
   where id = new.validation_request_id;

  if v is null then
    raise exception 'There is no validation request with that id, so there is no student and '
                    'no exception. An official transcript is generated from a student record.'
      using errcode = 'insufficient_privilege';
  end if;

  if v.status <> 'approved' then
    raise exception 'That transcript validation request is at "%". An exceptional transcript '
                    'may be generated only after the Vice-Chancellor or the Superadministrator '
                    'has approved it.', v.status
      using errcode = 'insufficient_privilege';
  end if;

  -- AND IT IS THE STUDENT THAT WAS VALIDATED. Without this, one approval is a
  -- key to every exceptional transcript anybody wants to generate afterwards.
  if btrim(upper(new.student_number)) <> btrim(upper(v.claimed_student_number)) then
    raise exception 'This transcript is for % but the approved validation is for %. An '
                    'approval covers the case it was given for.',
                    new.student_number, v.claimed_student_number
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists transcript_issue_comes_from_the_register on transcript_issues;
create trigger transcript_issue_comes_from_the_register
  before insert on transcript_issues
  for each row execute function a_transcript_comes_from_the_register();


-- ---------------------------------------------------------------------------
-- §14 — THE VERSION IS THE SYSTEM'S TO COUNT
-- ---------------------------------------------------------------------------

create or replace function the_next_transcript_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Counted from what is there, and whatever the caller sent is discarded.
  -- A form that could choose its own version number could choose 1 again.
  if new.student_id is not null then
    select coalesce(max(version), 0) + 1 into new.version
      from transcript_issues where student_id = new.student_id;
  else
    select coalesce(max(version), 0) + 1 into new.version
      from transcript_issues
     where student_id is null
       and btrim(upper(student_number)) = btrim(upper(new.student_number));
  end if;
  return new;
end;
$$;

drop trigger if exists transcript_issue_version on transcript_issues;
create trigger transcript_issue_version
  before insert on transcript_issues
  for each row execute function the_next_transcript_version();


-- ---------------------------------------------------------------------------
-- §15 — NO SILENT REGENERATION, AND NO QUIET CORRECTION EITHER
--
-- The University asked that generating again must not replace. The version
-- trigger above does that. THIS refuses the other half, which they did not
-- have to ask for: a record of what happened that can be edited afterwards is
-- a record of what somebody currently prefers.
-- ---------------------------------------------------------------------------

create or replace function a_transcript_issue_is_never_rewritten()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'A transcript generation is not deletable. It happened. If it should not '
                    'have, the record of it happening is the University''s evidence of that.'
      using errcode = 'insufficient_privilege';
  end if;
  raise exception 'A transcript generation is not editable — not the date, not the record it '
                  'was made from, not who made it. Generate a new one; it becomes version %.',
                  old.version + 1
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists transcript_issue_is_never_rewritten on transcript_issues;
create trigger transcript_issue_is_never_rewritten
  before update or delete on transcript_issues
  for each row execute function a_transcript_issue_is_never_rewritten();


-- ===========================================================================
-- 4. §13 — AND WHETHER IT WAS SENT
-- ===========================================================================

create table if not exists transcript_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  transcript_issue_id uuid not null references transcript_issues (id) on delete restrict,
  recipient           text not null check (position('@' in recipient) > 1),
  sent_by             uuid not null references auth.users (id) on delete restrict,
  sent_at             timestamptz not null default now(),
  status              text not null default 'sent'
                      check (status in ('sent', 'delivered', 'failed', 'bounced')),
  detail              text,
  created_at          timestamptz not null default now()
);

create index if not exists transcript_deliveries_issue_idx
  on transcript_deliveries (transcript_issue_id, sent_at desc);

comment on table transcript_deliveries is
  '§13 of the transcript ruling. One row per send, so that the Vice-Chancellor and the '
  'Superadministrator can establish not only who generated a transcript but whether it was '
  'subsequently sent, to whom, and whether it arrived.';

-- A DELIVERY IS A FACT TOO. Only the outcome may move afterwards — the mail
-- server reports back later — and the recipient never does. Rewriting the
-- address after the send is exactly the edit this table exists to make
-- impossible.
create or replace function a_delivery_only_learns_its_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'A transcript delivery is not deletable.'
      using errcode = 'insufficient_privilege';
  end if;
  if new.transcript_issue_id is distinct from old.transcript_issue_id
     or new.recipient is distinct from old.recipient
     or new.sent_by    is distinct from old.sent_by
     or new.sent_at    is distinct from old.sent_at then
    raise exception 'Only the delivery status may change after a transcript has been sent. '
                    'Who sent what to whom, and when, is settled.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists transcript_delivery_only_learns_its_outcome on transcript_deliveries;
create trigger transcript_delivery_only_learns_its_outcome
  before update or delete on transcript_deliveries
  for each row execute function a_delivery_only_learns_its_outcome();


-- ===========================================================================
-- 5. §10 — THE AUDIT THE VICE-CHANCELLOR READS
-- ===========================================================================
--
-- `security_invoker`, so the row-level security below is what decides who sees
-- what. A view that reads with the definer's rights would hand every row to
-- every caller and make section 6 decorative.
-- ===========================================================================

create or replace view transcript_audit
with (security_invoker = true) as
select i.id,
       i.document_reference,
       i.issued_at,
       i.version,
       i.student_id,
       i.student_number,
       i.student_name,
       i.programme,
       i.administration_id,
       n.country                          as administration_country,
       i.issued_by,
       p.full_name                        as issued_by_name,
       i.issued_role,

       -- §11's two paths, as one word the audit list can show.
       case
         when i.validation_request_id is not null then 'validated'
         else 'generated'
       end                                as path,
       i.validation_request_id,
       v.decided_by                       as validated_by,
       vp.full_name                       as validated_by_name,
       v.decided_at                       as validated_at,

       -- §13, folded in: the audit screen answers "was it sent" without a
       -- second query, because the question is always asked next.
       d.sends,
       d.last_sent_at,
       d.last_recipient,
       d.last_status                      as delivery_status
  from transcript_issues i
  left join profiles p on p.id = i.issued_by
  left join national_administrations n on n.id = i.administration_id
  left join transcript_validation_requests v on v.id = i.validation_request_id
  left join profiles vp on vp.id = v.decided_by
  left join lateral (
    select count(*)                                   as sends,
           max(sent_at)                               as last_sent_at,
           (array_agg(recipient order by sent_at desc))[1] as last_recipient,
           (array_agg(status    order by sent_at desc))[1] as last_status
      from transcript_deliveries td
     where td.transcript_issue_id = i.id
  ) d on true;

comment on view transcript_audit is
  '§10. Every transcript generated, newest first, with who generated it, by which path, and '
  'whether it was afterwards emailed. Reads under the caller''s own rights: the '
  'Vice-Chancellor and the Superadministrator see all of it, an officer sees what they '
  'generated.';

grant select on transcript_audit to authenticated;


-- ===========================================================================
-- 6. ROW-LEVEL SECURITY
-- ===========================================================================

alter table transcript_validation_requests enable row level security;
alter table transcript_issues              enable row level security;
alter table transcript_deliveries          enable row level security;

-- ---- THE VALIDATION REQUESTS ---------------------------------------------

-- The officer who raised it, and the two offices that decide it.
drop policy if exists transcript_validation_read on transcript_validation_requests;
create policy transcript_validation_read on transcript_validation_requests
  for select using (
    validates_a_transcript_exception()
    or requested_by = auth.uid()
  );

drop policy if exists transcript_validation_raise on transcript_validation_requests;
create policy transcript_validation_raise on transcript_validation_requests
  for insert with check (
    requested_by = auth.uid()
    and auth_role() in ('registrar', 'academic-office', 'admin', 'superadmin',
                        'vice-chancellor')
  );

-- DECIDING IS A WRITE AND THE POLICY SAYS SO. The trigger above refuses the
-- wrong decider; this refuses the wrong office reaching the row at all, which
-- is a different question and worth answering separately.
drop policy if exists transcript_validation_decide on transcript_validation_requests;
create policy transcript_validation_decide on transcript_validation_requests
  for update using (
    validates_a_transcript_exception()
    -- An officer may correct and resubmit their own returned request.
    or (requested_by = auth.uid() and status = 'returned')
  ) with check (
    validates_a_transcript_exception()
    or (requested_by = auth.uid() and status = 'submitted')
  );

-- ---- THE ISSUES ----------------------------------------------------------

-- §16: "The Vice-Chancellor and SuperAdmin shall have continuous access to the
-- transcript audit record." Everybody else sees what bears on them: the
-- officer who generated it, the national administration it belongs to, and the
-- student whose transcript it is.
drop policy if exists transcript_issues_read on transcript_issues;
create policy transcript_issues_read on transcript_issues
  for select using (
    validates_a_transcript_exception()
    or auth_role() in ('admin', 'registrar', 'academic-office')
    or issued_by = auth.uid()
    or (administration_id is not null
        and serves_a_national_administration()
        and administration_id = my_administration())
    or exists (select 1 from students s
                where s.id = transcript_issues.student_id
                  and s.auth_user_id = auth.uid())
  );

drop policy if exists transcript_issues_generate on transcript_issues;
create policy transcript_issues_generate on transcript_issues
  for insert with check (
    issued_by = auth.uid()
    and auth_role() in ('registrar', 'academic-office', 'admin', 'superadmin',
                        'vice-chancellor')
  );

-- AND THERE IS NO UPDATE POLICY AND NO DELETE POLICY, deliberately. The
-- trigger refuses both anyway; the absent policies mean a client never reaches
-- the trigger, and the two refusals are independent.

-- ---- THE DELIVERIES ------------------------------------------------------

drop policy if exists transcript_deliveries_read on transcript_deliveries;
create policy transcript_deliveries_read on transcript_deliveries
  for select using (
    validates_a_transcript_exception()
    or auth_role() in ('admin', 'registrar', 'academic-office')
    or sent_by = auth.uid()
  );

drop policy if exists transcript_deliveries_send on transcript_deliveries;
create policy transcript_deliveries_send on transcript_deliveries
  for insert with check (
    sent_by = auth.uid()
    and auth_role() in ('registrar', 'academic-office', 'admin', 'superadmin',
                        'vice-chancellor')
  );

grant select, insert on transcript_validation_requests to authenticated;
grant update          on transcript_validation_requests to authenticated;
grant select, insert  on transcript_issues              to authenticated;
grant select, insert  on transcript_deliveries          to authenticated;


-- ===========================================================================
-- 7. THE PROOF
-- ===========================================================================
--
-- Everything below rolls back. It builds its own people, its own programme and
-- its own student at student number PROOF-100; it competes for nothing the
-- University occupies, writes to none of their rows, and asserts nothing about
-- their data being empty.
-- ===========================================================================

do $$
declare
  vc         uuid := gen_random_uuid();
  reg        uuid := gen_random_uuid();
  daa        uuid := gen_random_uuid();
  lect       uuid := gen_random_uuid();
  student    uuid;
  issue      uuid;
  v_req      uuid;
  delivery   uuid;
  refused    boolean;
  seen       integer;
  got        integer;
  doc        text := repeat('OFFICIAL TRANSCRIPT — PROOF 100. ', 12);
  -- THE YEAR IS 9100 AND THAT IS THE POINT. `document_reference` is unique, and
  -- a proof that takes a reference the University could also take is a proof
  -- that dies on their database the day they reach it. 044 did exactly this
  -- with an active template and had to be rewritten. The University issues
  -- against the current year, so TRN-9100-nnnn is a slot they can never want.
begin
  insert into auth.users (id, email) values
    (vc,  'proof-100-vc@example.invalid'),
    (reg, 'proof-100-registrar@example.invalid'),
    (daa,  'proof-100-academic@example.invalid'),
    (lect, 'proof-100-lecturer@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (vc,  'proof-100-vc@example.invalid',        'Proof Vice-Chancellor', 'vice-chancellor'),
    (reg, 'proof-100-registrar@example.invalid', 'Proof Registrar',       'registrar'),
    (daa,  'proof-100-academic@example.invalid', 'Proof Academic Office', 'academic-office'),
    (lect, 'proof-100-lecturer@example.invalid', 'Proof Lecturer',        'lecturer')
  on conflict (id) do update set role = excluded.role;

  insert into students (matric_no, first_name, last_name, student_number, status)
    values ('PROOF-100', 'Proof', 'Student', 'ICOF-PROOF-100-00125', 'enrolled')
    returning id into student;

  -- ---- §1 AND §6: THERE IS NO TRANSCRIPT WITHOUT A STUDENT ----------------
  begin
    refused := false;
    insert into transcript_issues
      (document_reference, student_number, student_name, academic_record,
       issued_by, issued_role, html)
      values ('TRN-9100-0001', 'ICOF-NOBODY-00000', 'Nobody At All', '{}'::jsonb,
              reg, 'registrar', doc);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '100 FAILED — a transcript was generated for a person who is not a student';
  end if;
  raise notice '100 OK  a transcript cannot be generated for somebody who is not in the register';

  -- ---- §6: AND IT IS NEVER "SYSTEM GENERATED" -----------------------------
  begin
    refused := false;
    insert into transcript_issues
      (document_reference, student_id, student_number, student_name, academic_record,
       issued_by, issued_role, html)
      values ('TRN-9100-0008', student, 'ICOF-PROOF-100-00125', 'Proof Student',
              '{}'::jsonb, reg, 'system', doc);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '100 FAILED — a transcript was recorded as issued by "system"';
  end if;
  raise notice '100 OK  a transcript names the office that issued it, never "system"';

  -- AND A NATIONAL RECTOR IS NOT ONE OF THOSE OFFICES.
  begin
    refused := false;
    insert into transcript_issues
      (document_reference, student_id, student_number, student_name, academic_record,
       issued_by, issued_role, html)
      values ('TRN-9100-0009', student, 'ICOF-PROOF-100-00125', 'Proof Student',
              '{}'::jsonb, reg, 'national-rector', doc);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '100 FAILED — a National Rector issued a transcript';
  end if;
  raise notice '100 OK  a National Rector has no transcript issuance authority';

  -- ---- THE ORDINARY PATH --------------------------------------------------
  insert into transcript_issues
    (document_reference, student_id, student_number, student_name, programme,
     academic_record, issued_by, issued_role, html)
    values ('TRN-9100-0002', student, 'ICOF-PROOF-100-00125', 'Proof Student',
            'Master of Theology',
            '{"credits_earned": 180, "cgpa": 3.4, "courses": []}'::jsonb,
            reg, 'registrar', doc)
    returning id, version into issue, got;
  if got <> 1 then
    raise exception '100 FAILED — the first transcript was version %, not 1', got;
  end if;
  raise notice '100 OK  the first transcript for a student is version 1';

  -- ---- §5: THE DATE IS THE SYSTEM'S ---------------------------------------
  if (select issued_at::date from transcript_issues where id = issue) <> current_date then
    raise exception '100 FAILED — the transcript was not dated today by the system';
  end if;
  raise notice '100 OK  the generation date is the system''s and nobody typed it';

  -- ---- §14 AND §15: GENERATING AGAIN DOES NOT REPLACE ---------------------
  insert into transcript_issues
    (document_reference, student_id, student_number, student_name,
     academic_record, issued_by, issued_role, html)
    values ('TRN-9100-0003', student, 'ICOF-PROOF-100-00125', 'Proof Student',
            '{"credits_earned": 180, "cgpa": 3.5, "courses": []}'::jsonb,
            daa, 'academic-office', doc)
    returning version into got;
  if got <> 2 then
    raise exception '100 FAILED — the second transcript was version %, not 2', got;
  end if;
  select count(*) into seen from transcript_issues where student_id = student;
  if seen <> 2 then
    raise exception '100 FAILED — generating again left % rows, not 2', seen;
  end if;
  raise notice '100 OK  generating again is version 2 and the first one is still there';

  -- ---- A CALLER CANNOT CHOOSE ITS OWN VERSION -----------------------------
  insert into transcript_issues
    (document_reference, student_id, student_number, student_name,
     academic_record, issued_by, issued_role, html, version)
    values ('TRN-9100-0004', student, 'ICOF-PROOF-100-00125', 'Proof Student',
            '{}'::jsonb, reg, 'registrar', doc, 1)
    returning version into got;
  if got <> 3 then
    raise exception '100 FAILED — a caller asking for version 1 got %, and it should be 3', got;
  end if;
  raise notice '100 OK  a caller cannot choose its own version number';

  -- ---- §15: AND THE RECORD CANNOT BE EDITED OR REMOVED --------------------
  begin
    refused := false;
    update transcript_issues set issued_at = now() - interval '30 days' where id = issue;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '100 FAILED — a transcript generation record was back-dated';
  end if;

  begin
    refused := false;
    delete from transcript_issues where id = issue;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '100 FAILED — a transcript generation record was deleted';
  end if;
  raise notice '100 OK  a generation record can be neither edited nor deleted';

  -- ---- §7 AND §8: THE EXCEPTIONAL PATH ------------------------------------
  insert into transcript_validation_requests
    (claimed_student_number, claimed_full_name, claimed_programme, claimed_year,
     reason, requested_by, requested_role)
    values ('ICOF-UG-2026-00125', 'John Doe', 'Master of Theology', '2025/2026',
            'Admitted through the Uganda administration in 2023; the paper file and the '
            'admission letter are held, but no student record was ever opened.',
            reg, 'registrar')
    returning id into v_req;

  -- An unapproved validation opens nothing.
  begin
    refused := false;
    insert into transcript_issues
      (document_reference, validation_request_id, student_number, student_name,
       academic_record, issued_by, issued_role, html)
      values ('TRN-9100-0005', v_req, 'ICOF-UG-2026-00125', 'John Doe', '{}'::jsonb,
              reg, 'registrar', doc);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '100 FAILED — an exceptional transcript was generated before validation';
  end if;
  raise notice '100 OK  an exceptional transcript waits for the validation';

  -- AND THE REGISTRAR DOES NOT VALIDATE THEIR OWN REQUEST.
  begin
    refused := false;
    update transcript_validation_requests
       set status = 'approved', decided_by = reg where id = v_req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '100 FAILED — the officer who raised the request approved it';
  end if;

  -- NOR DOES THE ACADEMIC OFFICE, WHICH IS NOT THE VICE-CHANCELLOR.
  begin
    refused := false;
    update transcript_validation_requests
       set status = 'approved', decided_by = daa where id = v_req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '100 FAILED — an office other than the VC or Superadministrator validated';
  end if;
  raise notice '100 OK  only the Vice-Chancellor or the Superadministrator validates, and '
               'never the officer who asked';

  update transcript_validation_requests
     set status = 'approved', decided_by = vc where id = v_req;
  raise notice '100 OK  …and the Vice-Chancellor can';

  -- AN APPROVAL COVERS THE CASE IT WAS GIVEN FOR AND NOT THE NEXT ONE.
  begin
    refused := false;
    insert into transcript_issues
      (document_reference, validation_request_id, student_number, student_name,
       academic_record, issued_by, issued_role, html)
      values ('TRN-9100-0006', v_req, 'ICOF-SOMEONE-ELSE-00999', 'Someone Else',
              '{}'::jsonb, reg, 'registrar', doc);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '100 FAILED — one approval generated a transcript for a different person';
  end if;
  raise notice '100 OK  an approval covers the student it was given for';

  insert into transcript_issues
    (document_reference, validation_request_id, student_number, student_name,
     academic_record, issued_by, issued_role, html)
    values ('TRN-9100-0007', v_req, 'ICOF-UG-2026-00125', 'John Doe', '{}'::jsonb,
            reg, 'registrar', doc);
  raise notice '100 OK  and after validation the exceptional transcript is generated';

  -- ---- §13: THE SEND IS RECORDED AND THE ADDRESS IS SETTLED ---------------
  insert into transcript_deliveries (transcript_issue_id, recipient, sent_by)
    values (issue, 'proof-100-student@example.invalid', reg)
    returning id into delivery;

  update transcript_deliveries set status = 'delivered' where id = delivery;

  begin
    refused := false;
    update transcript_deliveries
       set recipient = 'somewhere-else@example.invalid' where id = delivery;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '100 FAILED — the recipient of a sent transcript was rewritten';
  end if;
  raise notice '100 OK  a delivery learns its outcome and nothing else';

  -- ---- §10: AND THE AUDIT ANSWERS BOTH QUESTIONS AT ONCE ------------------
  if (select delivery_status from transcript_audit where id = issue) <> 'delivered' then
    raise exception '100 FAILED — the audit does not show whether the transcript was sent';
  end if;
  if (select path from transcript_audit where document_reference = 'TRN-9100-0007')
     <> 'validated' then
    raise exception '100 FAILED — the audit does not distinguish the exceptional path';
  end if;
  raise notice '100 OK  the audit shows the path taken and whether it was afterwards sent';

  -- ---- §16: CONTINUOUS ACCESS, AND IT IS NOT EVERYBODY'S ------------------
  --
  -- `set local role authenticated` IS THE WHOLE TEST. This block runs as the
  -- owner of these tables, and row-level security does not apply to a table's
  -- owner — so a count taken without changing role is the total, whoever the
  -- JWT claim says is asking, and an assertion about it passes no matter what
  -- the policies say. The first version of this proof did exactly that.
  --
  -- The total is counted first and compared against, rather than written down,
  -- because a hardcoded number is a second thing to get wrong.
  select count(*) into got from transcript_issues;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', vc::text, true);
  select count(*) into seen from transcript_issues;
  reset role;

  if seen <> got then
    raise exception '100 FAILED — the Vice-Chancellor saw % of the % generations', seen, got;
  end if;
  raise notice '100 OK  the Vice-Chancellor reads every transcript ever generated (%)', got;

  -- AND THE CEILING, because a policy nobody has watched refuse anything is a
  -- policy nobody has tested. A lecturer generated none of these, is not the
  -- student on any of them, and serves no national administration.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', lect::text, true);
  select count(*) into seen from transcript_issues;
  reset role;

  if seen <> 0 then
    raise exception '100 FAILED — a lecturer read % transcript generations', seen;
  end if;
  raise notice '100 OK  …and a lecturer reads none of them';

  perform set_config('request.jwt.claim.sub', '', true);

  raise exception 'proof-100-rollback';
exception
  when others then
    if sqlerrm = 'proof-100-rollback' then
      raise notice '100 OK  every proof above rolled back; nothing was kept';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   101_the_certificate_design_is_not_everybodys.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 101 — CERTIFICATE TEMPLATE CONFIDENTIALITY
-- ===========================================================================
--
-- The University's ruling, given on 16 September 2026:
--
--   "The official ICOF certificate template, certificate sample, certificate
--    security configuration and associated institutional design assets are
--    restricted university resources. Access shall be limited exclusively to
--    the Vice-Chancellor and SuperAdmin unless expressly authorized by the
--    governing authority of the university. No Registrar, Director of Academic
--    Affairs, National Rector, National Administration, lecturer, student or
--    other university office shall have access to the certificate template or
--    certificate sample through the ordinary university system."
--
-- And, on where that rule has to live:
--
--   "The security restriction should not exist only in the user interface. It
--    should be enforced at the authorization/API/database level. […] A user
--    who does not have the required permission should receive no
--    certificate-template data at all. Simply hiding a button is not
--    sufficient."
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A DOOR CLOSES, AND FOUR OFFICES ARE ON THE OTHER SIDE OF IT. Today
--    `credential_templates` is readable by the Superadministrator, the System
--    Administrator, the Registrar, the Academic Office and the
--    Vice-Chancellor. From now on the CERTIFICATE design is readable by the
--    Vice-Chancellor and the Superadministrator only. The Registrar, the
--    Director of Academic Affairs and the System Administrator lose it.
--
-- 2. THE CERTIFICATE SCREEN THE REGISTRAR USES WILL STOP DRAWING A PREVIEW,
--    because it fetches the design in the BROWSER, with the Registrar's own
--    session, and that fetch will now return nothing. That is the ruling
--    working, not a fault — but it is a visible change on a screen somebody
--    uses, so it belongs here rather than in a surprise.
--
-- 3. ISSUING A CERTIFICATE IS UNAFFECTED. The delivery route reads the design
--    server-side under the service key, which no policy binds. That is
--    already the "Authorized Certificate Engine" the ruling describes: the
--    officer asks for a certificate, the engine holds the design, and the
--    officer never sees it.
--
-- 4. ONLY THE CERTIFICATE. The transcript design is NOT restricted — the
--    ruling is about the certificate, the transcript sheet is a different
--    asset, and the Registrar's transcript screen renders it in the browser.
--    Closing the whole table would have broken transcripts to protect
--    certificates.
--
-- 5. A REISSUE IS AUTHORISED, NOT REPEATED. "The system must never allow
--    someone to simply generate unlimited copies." A replacement certificate
--    needs a request, a reason and an authorisation, and one authorisation
--    permits one regeneration.
--
-- 6. THE VICE-CHANCELLOR CAN FINALLY READ THE CERTIFICATE AUDIT. 013 built
--    `credential_audit_events`, made it append-only, and enabled row-level
--    security on it WITHOUT WRITING A SINGLE POLICY. A table in that state
--    returns nothing to everybody: the complete audit trail the ruling gives
--    the Vice-Chancellor and the Superadministrator has been unreadable by
--    both of them since it was built. Only the service key could see it.
--
-- 7. AND THE VICE-CHANCELLOR CAN READ THE REGISTER OF ISSUED CERTIFICATES.
--    `credentials_issued` has admitted the Superadministrator, the System
--    Administrator, the Registrar and the Academic Office since 004, and not
--    the Vice-Chancellor. Both halves of "complete visibility" were missing
--    and this is the second. Additive: nobody loses the register.
--
-- 8. NOTHING IS SEEDED. One table, one view, some policies.
--
-- ---------------------------------------------------------------------------
-- WHY §4's EXCEPTION IS A GRANT AND NOT A ROLE
-- ---------------------------------------------------------------------------
--
-- "The Director of Academic Affairs should also not have access to the
--  certificate sample/template, UNLESS the VC or SuperAdmin has explicitly
--  granted a separate security permission."
--
-- That is 056's `capability_grants` exactly — who granted what to whom, when,
-- with an expiry and a revocation, and auditable. It is the same shape as the
-- National Rector who also teaches: a condition is a grant, not a role. So the
-- exception is a live grant of `view-certificate-template`, it runs out by
-- itself, and nobody has to remember to take it away.
--
-- AND THE GRANT MUST COME FROM ABOVE. 056 does not record what role the
-- granter held, so a grant is checked here against who the granter IS: if the
-- Registrar could grant this capability, the restriction would last until the
-- first Registrar decided otherwise.
-- ===========================================================================


-- ===========================================================================
-- 1. WHO SEES THE CERTIFICATE DESIGN
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- THE TWO OFFICES, ONCE.
--
-- 100 asked the same question under the name `validates_a_transcript_exception`
-- because that was what it needed it for. It is the same test, and two copies
-- of one rule is how the two copies come to disagree — so the general one is
-- written here and the transcript-shaped name becomes a wrapper over it,
-- keeping 100's policies and the sentence they read as.
-- ---------------------------------------------------------------------------

create or replace function the_vice_chancellor_or_the_superadministrator(who uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role in ('superadmin', 'vice-chancellor')
       from profiles p
      where p.id = coalesce(who, auth.uid())),
    false);
$$;

create or replace function validates_a_transcript_exception(who uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select the_vice_chancellor_or_the_superadministrator(who);
$$;


-- ---------------------------------------------------------------------------
-- AND SEEING THE DESIGN IS A WIDER QUESTION THAN BEING ONE OF THEM, because
-- §4 lets them lend it out. The two are kept apart deliberately, and the proof
-- below is the reason: written as one function, the express authorisation to
-- LOOK AT the certificate design also became authority to AUTHORISE A
-- REPLACEMENT CERTIFICATE, which nobody granted and nobody intended. That is
-- the University's own §8 the other way round — holding one authority does not
-- confer another.
-- ---------------------------------------------------------------------------

create or replace function sees_the_certificate_design(who uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select the_vice_chancellor_or_the_superadministrator(who)
  or exists (
    -- Or an express authorisation, live, and given by one of those two.
    select 1
      from capability_grants g
      join profiles gp on gp.id = g.granted_by
     where g.grantee_id = coalesce(who, auth.uid())
       and g.capability = 'view-certificate-template'
       and g.revoked_at is null
       and g.expires_at > now()
       and gp.role in ('superadmin', 'vice-chancellor'));
$$;

comment on function sees_the_certificate_design(uuid) is
  'The Vice-Chancellor, the Superadministrator, or somebody one of them has expressly and '
  'temporarily authorised. Nobody else — not the Registrar, not the Director of Academic '
  'Affairs, not a National Rector, not the System Administrator.';


-- ===========================================================================
-- 2. AND THE DATABASE IS WHERE THAT IS ENFORCED
-- ===========================================================================
--
-- PER KIND, NOT PER TABLE. `credential_templates` holds the transcript sheet
-- as well as the certificate, and the Registrar's transcript screen renders
-- that one in the browser with the Registrar's own session. A policy written
-- against the whole table would have taken the University's certificate rule
-- and used it to break transcripts.
-- ===========================================================================

drop policy if exists credential_templates_read on credential_templates;
create policy credential_templates_read on credential_templates
  for select using (
    case
      when kind = 'certificate' then sees_the_certificate_design()
      else auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                           'vice-chancellor')
    end
  );

-- THE APPROVAL QUEUE CARRIES THE SAME PROBLEM. A row saying "this certificate
-- design is awaiting approval" is not the design, but the screen that lists it
-- opens it, and 013 left this table with row-level security on and no policy
-- at all — so it has been readable by nobody but the service key.
drop policy if exists credential_template_approvals_read on credential_template_approvals;
create policy credential_template_approvals_read on credential_template_approvals
  for select using (
    sees_the_certificate_design()
    or exists (select 1 from credential_templates t
                where t.id = credential_template_approvals.template_id
                  and t.kind <> 'certificate')
  );


-- ===========================================================================
-- 3. §10 — A REPLACEMENT IS AUTHORISED, NOT REPEATED
-- ===========================================================================

create table if not exists certificate_reissue_requests (
  id                  uuid primary key default gen_random_uuid(),

  -- WHICH CERTIFICATE. The register row, not a typed reference: a replacement
  -- for a certificate the University did not issue is not a replacement.
  original_credential uuid not null references credentials_issued (id) on delete restrict,

  -- §10's own list.
  reason              text not null
                      check (reason in ('lost', 'damaged', 'legal-name-change', 'correction')),
  detail              text not null check (length(btrim(detail)) >= 20),

  requested_by        uuid not null references auth.users (id) on delete restrict,
  requested_role      text not null,
  requested_at        timestamptz not null default now(),

  status              text not null default 'awaiting-authorisation'
                      check (status in ('awaiting-authorisation', 'authorised',
                                        'rejected', 'spent')),
  authorised_by       uuid references auth.users (id) on delete restrict,
  authorised_at       timestamptz,
  decision_note       text,

  -- ---- "NEVER UNLIMITED COPIES" -------------------------------------------
  --
  -- One authorisation, one regeneration. `spent` is set when the replacement
  -- is issued and `replacement_credential` names it, so the request cannot be
  -- used twice and the pair can be read in either direction afterwards.
  replacement_credential uuid references credentials_issued (id) on delete restrict,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint certificate_reissue_authoriser_is_not_the_requester
    check (authorised_by is null or authorised_by <> requested_by),

  constraint certificate_reissue_refusal_says_why
    check (status <> 'rejected'
           or (decision_note is not null and length(btrim(decision_note)) >= 10)),

  constraint certificate_reissue_authorised_rows_name_the_authoriser
    check (status in ('awaiting-authorisation', 'rejected')
           or (authorised_by is not null and authorised_at is not null)),

  constraint certificate_reissue_spent_names_its_replacement
    check (status <> 'spent' or replacement_credential is not null)
);

create index if not exists certificate_reissue_requests_open_idx
  on certificate_reissue_requests (requested_at desc)
  where status = 'awaiting-authorisation';

create index if not exists certificate_reissue_requests_original_idx
  on certificate_reissue_requests (original_credential, requested_at desc);

-- ONE LIVE AUTHORISATION PER CERTIFICATE. Without this, three requests can be
-- authorised in the morning and three replacements issued in the afternoon,
-- each of them individually within the rule.
create unique index if not exists certificate_reissue_one_live_idx
  on certificate_reissue_requests (original_credential)
  where status = 'authorised';

comment on table certificate_reissue_requests is
  '§10 of the certificate ruling. A replacement certificate is requested with a reason, '
  'authorised by the Vice-Chancellor or the Superadministrator, and the authorisation is '
  'spent when the replacement is issued. The University must never be able to generate '
  'unlimited copies.';


create or replace function a_reissue_is_authorised_from_above()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'spent' then
    if old.status <> 'authorised' then
      raise exception 'A replacement certificate is issued against an authorisation. This '
                      'request is at "%".', old.status
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if new.status = 'awaiting-authorisation' then
    new.authorised_by := null;
    new.authorised_at := null;
    return new;
  end if;

  new.authorised_by := coalesce(new.authorised_by, auth.uid());
  new.authorised_at := coalesce(new.authorised_at, now());

  if new.authorised_by is null then
    raise exception 'A certificate reissue is authorised by somebody. Record who.'
      using errcode = 'insufficient_privilege';
  end if;

  -- THE SAME TWO OFFICES. Reissuing is certificate authority, and §8 of the
  -- transcript ruling is explicit that holding one authority does not confer
  -- another: a Registrar who may issue an ordinary transcript still may not
  -- authorise a replacement certificate.
  -- THE TWO OFFICES THEMSELVES, NOT `sees_the_certificate_design()`. An
  -- officer expressly authorised under §4 to LOOK AT the design has been lent
  -- one power, and authorising a replacement certificate is a different one.
  if not the_vice_chancellor_or_the_superadministrator(new.authorised_by) then
    raise exception 'Only the Vice-Chancellor or the Superadministrator may authorise a '
                    'replacement certificate. Being authorised to view the certificate '
                    'design is not the same authority.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists certificate_reissue_is_from_above on certificate_reissue_requests;
create trigger certificate_reissue_is_from_above
  before update on certificate_reissue_requests
  for each row execute function a_reissue_is_authorised_from_above();

drop trigger if exists certificate_reissue_requests_updated_at on certificate_reissue_requests;
create trigger certificate_reissue_requests_updated_at
  before update on certificate_reissue_requests
  for each row execute function set_updated_at();

alter table certificate_reissue_requests enable row level security;

drop policy if exists certificate_reissue_read on certificate_reissue_requests;
create policy certificate_reissue_read on certificate_reissue_requests
  for select using (
    sees_the_certificate_design()
    or requested_by = auth.uid()
    or auth_role() in ('registrar', 'academic-office')
  );

drop policy if exists certificate_reissue_raise on certificate_reissue_requests;
create policy certificate_reissue_raise on certificate_reissue_requests
  for insert with check (
    requested_by = auth.uid()
    and auth_role() in ('registrar', 'academic-office', 'admin', 'superadmin',
                        'vice-chancellor')
  );

drop policy if exists certificate_reissue_decide on certificate_reissue_requests;
create policy certificate_reissue_decide on certificate_reissue_requests
  for update using (the_vice_chancellor_or_the_superadministrator()
                    or requested_by = auth.uid())
              with check (the_vice_chancellor_or_the_superadministrator()
                    or requested_by = auth.uid());

grant select, insert, update on certificate_reissue_requests to authenticated;


-- ===========================================================================
-- 4. §7 — THE AUDIT TRAIL THE VICE-CHANCELLOR CAN ACTUALLY READ
-- ===========================================================================
--
-- 013 enabled row-level security on `credential_audit_events` and wrote no
-- policy. Row-level security with no policy is not "open by default" — it is
-- CLOSED to everybody, permanently, and only the service key gets past it. So
-- the immutable trail the University is now being promised has been invisible
-- to the two people it is for since the day it was built.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- AND THE REGISTER ITSELF, WHICH IS THE OTHER HALF OF THE SAME GAP.
--
-- `credentials_issued` admits the Superadministrator, the System
-- Administrator, the Registrar and the Academic Office. THE VICE-CHANCELLOR IS
-- NOT ON THAT LIST and never has been. So "the Vice-Chancellor and SuperAdmin
-- can inspect the complete audit trail" was untrue for the Vice-Chancellor in
-- two places at once: the events, which nobody could read, and the register of
-- what was issued, which everybody but them could.
--
-- Found by the proof below asking the Vice-Chancellor to read one certificate
-- and getting none. ADDITIVE: policies are OR'd, so the four offices that can
-- read the register keep reading it exactly as before.
-- ---------------------------------------------------------------------------

drop policy if exists credentials_vice_chancellor_read on credentials_issued;
create policy credentials_vice_chancellor_read on credentials_issued
  for select using (the_vice_chancellor_or_the_superadministrator());


drop policy if exists credential_audit_events_read on credential_audit_events;
create policy credential_audit_events_read on credential_audit_events
  for select using (
    sees_the_certificate_design()
    -- The offices that issue read what they did. They see the event, which is
    -- what happened; they do not see the design, which is what it was made
    -- from. §9: those are different things.
    or actor_id = auth.uid()
    or auth_role() in ('registrar', 'academic-office')
  );

drop policy if exists credential_audit_events_write on credential_audit_events;
create policy credential_audit_events_write on credential_audit_events
  for insert with check (auth.uid() is not null);

grant select, insert on credential_audit_events to authenticated;

-- `credential_amendments` was left in the same state by 013.
drop policy if exists credential_amendments_read on credential_amendments;
create policy credential_amendments_read on credential_amendments
  for select using (
    sees_the_certificate_design()
    or auth_role() in ('registrar', 'academic-office')
  );

grant select on credential_amendments to authenticated;


create or replace view certificate_audit
with (security_invoker = true) as
select c.id,
       c.credential_id                     as certificate_identifier,
       c.kind,
       c.student_id,
       c.student_number,
       c.holder_name                       as student_name,
       c.programme,
       c.award                             as qualification,
       c.classification,
       c.issued_at,
       c.issued_by,
       p.full_name                         as issued_by_name,
       p.role                              as issued_by_role,
       c.status                            as issuance_status,
       c.template_version                  as certificate_version,

       -- §7 "replacement/reissue status", read from the request rather than
       -- inferred from the register: a certificate that replaced another one
       -- and a certificate that was issued twice look identical in
       -- `credentials_issued` alone.
       r.id                                as reissue_request_id,
       r.reason                            as reissue_reason,
       r.status                            as reissue_status,
       r.authorised_by                     as reissue_authorised_by,
       ap.full_name                        as reissue_authorised_by_name,
       r.authorised_at                     as reissue_authorised_at,

       e.events,
       e.last_action,
       e.last_action_at
  from credentials_issued c
  left join profiles p on p.id = c.issued_by
  left join certificate_reissue_requests r on r.replacement_credential = c.id
  left join profiles ap on ap.id = r.authorised_by
  left join lateral (
    select count(*)                                      as events,
           (array_agg(action   order by occurred_at desc))[1] as last_action,
           max(occurred_at)                              as last_action_at
      from credential_audit_events ev
     where ev.credential_id = c.id
  ) e on true
 where c.kind in ('certificate', 'diploma');

comment on view certificate_audit is
  '§7. Every certificate issued, with the officer who issued it, its version, its issuance '
  'status, whether it replaced another certificate and on whose authority. Reads under the '
  'caller''s own rights.';

grant select on certificate_audit to authenticated;


-- ===========================================================================
-- 5. THE PROOF
-- ===========================================================================

do $$
declare
  vc         uuid := gen_random_uuid();
  sup        uuid := gen_random_uuid();
  reg        uuid := gen_random_uuid();
  daa        uuid := gen_random_uuid();
  student    uuid;
  cert       uuid;
  parked     uuid;
  req        uuid;
  refused    boolean;
  seen       integer;
  total      integer;
begin
  insert into auth.users (id, email) values
    (vc,  'proof-101-vc@example.invalid'),
    (sup, 'proof-101-super@example.invalid'),
    (reg, 'proof-101-registrar@example.invalid'),
    (daa, 'proof-101-academic@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (vc,  'proof-101-vc@example.invalid',        'Proof Vice-Chancellor', 'vice-chancellor'),
    (sup, 'proof-101-super@example.invalid',     'Proof Superadmin',      'superadmin'),
    (reg, 'proof-101-registrar@example.invalid', 'Proof Registrar',       'registrar'),
    (daa, 'proof-101-academic@example.invalid',  'Proof Academic Office', 'academic-office')
  on conflict (id) do update set role = excluded.role;

  -- ---- A CERTIFICATE DESIGN OF OUR OWN, AT VERSION 9101 -------------------
  --
  -- NEVER COMPETE FOR WHAT THEIR DATA OCCUPIES. "The active certificate
  -- template" is a unique slot and the University has one in it. 044 died on
  -- exactly this. So the University's active certificate template is PARKED
  -- FIRST, inside the rollback, and put back by it.
  select id into parked from credential_templates
   where kind = 'certificate' and is_active limit 1;
  if parked is not null then
    update credential_templates set is_active = false where id = parked;
  end if;

  insert into credential_templates (kind, version, name, design, is_active, created_by)
    values ('certificate', 9101, 'Proof 101 certificate design',
            '{"proof": "this is the restricted asset"}'::jsonb, true, sup);

  -- ---- §1 AND §8: THE DESIGN IS NOT THE REGISTRAR'S ----------------------
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from credential_templates where kind = 'certificate';
  reset role;
  if seen <> 0 then
    raise exception '101 FAILED — the Registrar read % certificate designs', seen;
  end if;
  raise notice '101 OK  the Registrar receives no certificate-template data at all';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', daa::text, true);
  select count(*) into seen from credential_templates where kind = 'certificate';
  reset role;
  if seen <> 0 then
    raise exception '101 FAILED — the Academic Office read % certificate designs', seen;
  end if;
  raise notice '101 OK  …and neither does the Director of Academic Affairs';

  -- ---- AND IT IS THE VICE-CHANCELLOR'S AND THE SUPERADMINISTRATOR'S ------
  select count(*) into total from credential_templates where kind = 'certificate';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', vc::text, true);
  select count(*) into seen from credential_templates where kind = 'certificate';
  reset role;
  if seen <> total then
    raise exception '101 FAILED — the Vice-Chancellor saw % certificate designs of %',
                    seen, total;
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', sup::text, true);
  select count(*) into seen from credential_templates where kind = 'certificate';
  reset role;
  if seen <> total then
    raise exception '101 FAILED — the Superadministrator saw % certificate designs of %',
                    seen, total;
  end if;
  raise notice '101 OK  the Vice-Chancellor and the Superadministrator each see all % of them',
               total;

  -- ---- §4: AND AN EXPRESS AUTHORISATION LETS ONE THROUGH -----------------
  insert into capability_grants
    (grantee_id, capability, reason, granted_by, expires_at)
    values (daa, 'view-certificate-template',
            'Reviewing the certificate design ahead of the Senate meeting, at the '
            'Vice-Chancellor''s request.',
            vc, now() + interval '7 days');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', daa::text, true);
  select count(*) into seen from credential_templates where kind = 'certificate';
  reset role;
  if seen <> total then
    raise exception '101 FAILED — an expressly authorised officer saw % of %', seen, total;
  end if;
  raise notice '101 OK  an express, expiring authorisation from the Vice-Chancellor opens it';

  -- ---- AND THE REGISTRAR CANNOT WRITE THEMSELVES ONE ---------------------
  insert into capability_grants
    (grantee_id, capability, reason, granted_by, expires_at)
    values (reg, 'view-certificate-template',
            'The Registrar granting the Registrar access to the certificate design.',
            reg, now() + interval '7 days');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from credential_templates where kind = 'certificate';
  reset role;
  if seen <> 0 then
    raise exception '101 FAILED — a self-granted permission opened the certificate design';
  end if;
  raise notice '101 OK  a grant that did not come from above opens nothing';

  -- ---- §4 AND ONLY THE CERTIFICATE ---------------------------------------
  insert into credential_templates (kind, version, name, design, is_active, created_by)
    values ('transcript', 9101, 'Proof 101 transcript design', '{}'::jsonb, false, sup);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from credential_templates
   where kind = 'transcript' and version = 9101;
  reset role;
  if seen <> 1 then
    raise exception '101 FAILED — closing the certificate design also closed the transcript';
  end if;
  raise notice '101 OK  the transcript design is untouched and the Registrar still reads it';

  -- ---- §10: A REPLACEMENT IS AUTHORISED ----------------------------------
  insert into students (matric_no, first_name, last_name, student_number, status)
    values ('PROOF-101', 'Proof', 'Graduate', 'ICOF-PROOF-101-00126', 'enrolled')
    returning id into student;

  insert into credentials_issued
    (credential_id, kind, student_id, student_number, holder_name, programme,
     award, issued_by, facts, content_hash, seal_code)
    values ('IGUC-PROOF-101-0001', 'certificate', student, 'ICOF-PROOF-101-00126',
            'Proof Graduate', 'Master of Theology', 'Master of Theology', reg,
            '{"proof": 101}'::jsonb, 'proof-101-hash', 'PROOF-101')
    returning id into cert;

  insert into certificate_reissue_requests
    (original_credential, reason, detail, requested_by, requested_role)
    values (cert, 'lost',
            'The graduate reports the original was lost in transit and has sworn an affidavit.',
            reg, 'registrar')
    returning id into req;

  -- The Registrar does not authorise their own request.
  begin
    refused := false;
    update certificate_reissue_requests
       set status = 'authorised', authorised_by = reg where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '101 FAILED — the officer who asked for a replacement authorised it';
  end if;

  -- NOR DOES THE ACADEMIC OFFICE — AND THIS IS THE ONE THAT CAUGHT A REAL
  -- FAULT. By this point in the proof the Director of Academic Affairs holds a
  -- live §4 authorisation to view the certificate design, granted by the
  -- Vice-Chancellor a few lines above. Written as one function, that
  -- authorisation ALSO let them authorise a replacement certificate, and this
  -- assertion is what said so.
  begin
    refused := false;
    update certificate_reissue_requests
       set status = 'authorised', authorised_by = daa where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '101 FAILED — an officer authorised to VIEW the certificate design '
                    'authorised a REPLACEMENT certificate';
  end if;
  raise notice '101 OK  a replacement certificate is authorised only from above, and being '
               'lent the design is not that';

  -- And a replacement cannot be issued before it is authorised.
  begin
    refused := false;
    update certificate_reissue_requests set status = 'spent' where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '101 FAILED — a replacement was issued before it was authorised';
  end if;
  raise notice '101 OK  …and not issued before it is';

  update certificate_reissue_requests
     set status = 'authorised', authorised_by = vc where id = req;

  -- ---- "NEVER UNLIMITED COPIES" ------------------------------------------
  begin
    refused := false;
    insert into certificate_reissue_requests
      (original_credential, reason, detail, requested_by, requested_role,
       status, authorised_by, authorised_at)
      values (cert, 'damaged',
              'A second live authorisation for the same certificate, which is the thing '
              'the University asked to be impossible.',
              daa, 'academic-office', 'authorised', vc, now());
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '101 FAILED — one certificate had two live reissue authorisations';
  end if;
  raise notice '101 OK  one certificate has at most one live authorisation to replace it';

  -- ---- §7: AND THE AUDIT IS READABLE BY THE PEOPLE IT IS FOR -------------
  insert into credential_audit_events
    (credential_id, credential_ref, action, actor_id, actor_role, reason)
    values (cert, 'IGUC-PROOF-101-0001', 'issued', reg, 'registrar', 'Proof 101');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', vc::text, true);
  select count(*) into seen from credential_audit_events where credential_id = cert;
  reset role;
  if seen <> 1 then
    raise exception '101 FAILED — the Vice-Chancellor read % of the certificate audit', seen;
  end if;
  raise notice '101 OK  the Vice-Chancellor can read the certificate audit trail at last';

  -- THE CERTIFICATE ITSELF REPLACED NOTHING, and the audit says so: the
  -- authorisation above is to replace it, not evidence that it was one.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', vc::text, true);
  select count(*) into seen from certificate_audit
   where id = cert and reissue_request_id is null and events = 1;
  reset role;
  if seen <> 1 then
    raise exception '101 FAILED — the audit does not read the certificate as an ordinary issue';
  end if;
  raise notice '101 OK  the audit distinguishes a replacement from an ordinary issue';

  perform set_config('request.jwt.claim.sub', '', true);

  raise exception 'proof-101-rollback';
exception
  when others then
    if sqlerrm = 'proof-101-rollback' then
      raise notice '101 OK  every proof above rolled back; the University''s active '
                   'certificate template is exactly as it was';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- DID IT LAND?  — READ THIS TABLE
-- ===========================================================================
--
-- Every row should say YES. A row saying NO means that migration did not take
-- effect: scroll up for the first red ERROR, fix it, and run the file again.
-- Running it twice is safe.
--
-- The proofs inside each migration also RAISE NOTICE, which the Supabase SQL
-- editor does not show. This table is the same answer in a form it does.
-- ===========================================================================

select * from (
  select '100' as migration, '100_the_transcript_is_issued_to_a_student_we_have.sql' as file,
         case when to_regclass('public.transcript_issues') is not null then 'YES' else 'NO' end as landed,
         'transcript_issues' as what_it_creates
  union all
  select '101' as migration, '101_the_certificate_design_is_not_everybodys.sql' as file,
         case when to_regclass('public.certificate_reissue_requests') is not null then 'YES' else 'NO' end as landed,
         'certificate_reissue_requests' as what_it_creates
) as landed_report
 order by migration;

