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

create unique index if not exists transcript_issues_student_version_idx
  on transcript_issues (student_id, version) where student_id is not null;

create index if not exists transcript_issues_when_idx
  on transcript_issues (issued_at desc);

create index if not exists transcript_issues_officer_idx
  on transcript_issues (issued_by, issued_at desc);

create index if not exists transcript_issues_number_idx
  on transcript_issues (student_number);

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
