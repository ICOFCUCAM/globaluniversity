-- ===========================================================================
-- 024 — THE ACADEMIC ADMISSION DECISION IS A RECORD, NOT A COLUMN
--
-- Run after 023. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHAT A TRACE OF THE OLD PATH FOUND
-- ---------------------------------------------------------------------------
--
--   THE DECISION WAS TWO COLUMNS. `decided_by` and `decided_at` hold the LAST
--   decision on the record. Reverse one and its predecessor is gone, so the
--   students table could say who touched the row most recently and could not
--   say who admitted the student.
--
--   TWO ENDPOINTS PRODUCED TWO OUTCOMES. Both admitted; only one generated the
--   admission package. Which document an admitted student received depended on
--   which desk the approver was sitting at.
--
--   THE OFFICE THAT SIGNS COULD NOT DECIDE. The Head of Academic Affairs holds
--   'admit-student' and signs page 1 of every admission letter, and the
--   navigation exposed no admissions queue to that role at all.
--
-- This migration is the database half of the answer: one immutable decision
-- record, one append-only event log, a state vocabulary wide enough to describe
-- the workflow, and a student number that two simultaneous approvals cannot
-- collide on.
--
-- IT CHANGES NO EXISTING ROW AND REMOVES NO EXISTING COLUMN. `decided_by` and
-- `decided_at` stay exactly as they are and keep being written — they are a
-- useful summary of the current decision. What they stop being is the only
-- record of it.
-- ===========================================================================


-- ===========================================================================
-- 1. THE STATE VOCABULARY
--
-- The application's status was an open text column with no constraint, so any
-- string at all could be written to it and several were. The vocabulary below
-- is src/lib/admissionWorkflow.ts, and the two are checked against each other
-- by src/lib/admissionWorkflow.test.mjs — a state the application believes in
-- and the database refuses is a screen that fails at the moment somebody
-- presses the button.
--
-- NOT ADDED AS A CHECK CONSTRAINT ON students.status. There are live rows whose
-- status this migration cannot see, and a constraint that fails to apply would
-- take the whole migration down with it. It is a lookup table instead: the
-- route validates against it, and a value outside it is visible in one query
-- rather than impossible to write.
-- ===========================================================================

create table if not exists admission_states (
  state       text primary key,
  stage       text not null check (stage in
                ('application', 'verification', 'academic', 'issuance', 'enrolment', 'closed')),
  /** What the applicant is told, which is not what the offices see. */
  applicant_label text not null,
  sort_order  integer not null
);

insert into admission_states (state, stage, applicant_label, sort_order) values
  ('draft',                    'application',  'Application started',        10),
  ('applicant',                'application',  'Application received',       20),
  ('under_review',             'verification', 'Application received',       30),
  ('documents_required',       'verification', 'Documents needed',           40),
  ('documents_verified',       'verification', 'Documents verified',         50),
  ('fee_pending',              'verification', 'Awaiting fee confirmation',  60),
  ('fee_paid',                 'verification', 'Under academic review',      70),
  ('ready_for_academic_review','academic',     'Under academic review',      80),
  ('approved',                 'academic',     'Admission approved',         90),
  ('conditional',              'academic',     'Admission approved',        100),
  ('returned',                 'academic',     'Returned for correction',   110),
  ('rejected',                 'closed',       'Application unsuccessful',  120),
  ('admission_issued',         'issuance',     'Admission letter available',130),
  ('enrolled',                 'enrolment',    'Ready for enrolment',       140),
  ('withdrawn',                'closed',       'Withdrawn',                 150)
on conflict (state) do update
  set stage = excluded.stage,
      applicant_label = excluded.applicant_label,
      sort_order = excluded.sort_order;


-- ===========================================================================
-- 2. THE DECISION RECORD
--
-- One row per decision taken, forever. A reversal is a NEW row; the one it
-- reverses is still there, which is the entire point.
-- ===========================================================================

create table if not exists admission_decisions (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references students (id) on delete cascade,

  -- 'approve' | 'conditional' | 'reject' | 'return' — the act.
  decision         text not null check (decision in ('approve', 'conditional', 'reject', 'return')),
  -- The office's own word for what kind of decision this was.
  decision_type    text not null default 'academic'
                     check (decision_type in ('academic', 'administrative-override')),

  decided_by       uuid references profiles (id) on delete set null,
  decided_by_email text,
  -- THE ROLE AT THE TIME, copied rather than joined. A person's role changes;
  -- the office that took the decision does not, and an audit that reports the
  -- Registrar approved something because that person is the Registrar today is
  -- worse than no audit.
  decided_by_role  text,
  decision_date    timestamptz not null default now(),

  reason           text,
  conditions       jsonb,

  previous_status  text,
  new_status       text,

  -- ---------------------------------------------------------------------
  -- THE OVERRIDE, WHEN THE SUPERADMINISTRATOR ACTS IN ANOTHER OFFICE'S PLACE
  --
  -- The University asked that this be possible and highly visible. Both:
  -- possible, so a graduation is not held up because one office is unreachable;
  -- visible, so nobody quietly changes an academic decision.
  -- ---------------------------------------------------------------------
  is_override      boolean not null default false,
  override_of      text,      -- the office whose authority was exercised
  override_reason  text,

  created_at       timestamptz not null default now(),

  -- An override with no reason is not a record of anything.
  constraint admission_decisions_override_reasoned check (
    not is_override
    or (override_reason is not null and length(btrim(override_reason)) >= 20)
  )
);

create index if not exists admission_decisions_application_idx
  on admission_decisions (application_id, decision_date desc);


-- ===========================================================================
-- 3. THE AUDIT LOG
--
-- Every consequential event, appended. The decision table answers "what was
-- decided"; this answers "what then happened", which is the question asked
-- when a student says they were admitted and never received a letter.
-- ===========================================================================

create table if not exists admission_audit_log (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid references students (id) on delete cascade,
  decision_id    uuid references admission_decisions (id) on delete set null,

  event          text not null check (event in (
    'APPLICATION_SUBMITTED',
    'DOCUMENT_VERIFIED',
    'FEE_CONFIRMED',
    'ACADEMIC_REVIEW_STARTED',
    'ACADEMIC_APPROVED',
    'ACADEMIC_CONDITIONALLY_APPROVED',
    'ACADEMIC_REJECTED',
    'ACADEMIC_RETURNED',
    'ADMISSION_LETTER_GENERATED',
    'ADMISSION_PACKAGE_ISSUED',
    'ACCOUNT_CREATED',
    'WELCOME_EMAIL_SENT',
    'WELCOME_EMAIL_FAILED',
    'ENROLLED',
    'ADMINISTRATIVE_OVERRIDE'
  )),

  actor_id       uuid references profiles (id) on delete set null,
  actor_email    text,
  actor_role     text,
  -- Where from. Recorded because an academic decision is attributable, and
  -- "attributable" means more than a user id when an account is shared.
  actor_ip       text,
  user_agent     text,

  detail         text,
  at             timestamptz not null default now()
);

create index if not exists admission_audit_log_application_idx
  on admission_audit_log (application_id, at desc);
create index if not exists admission_audit_log_event_idx on admission_audit_log (event, at desc);


-- ===========================================================================
-- 4. BOTH ARE APPEND-ONLY
--
-- Enforced by the database rather than by the route that writes them, because
-- a rule living only in application code is bypassed by the next route
-- somebody writes — which is the reasoning migration 005 was built on and it
-- has not stopped being true.
-- ===========================================================================

create or replace function admission_record_immutable() returns trigger
language plpgsql
as $$
begin
  raise exception
    'the admission record is append-only: a decision is changed by recording the next one, not by editing this';
end;
$$;

drop trigger if exists admission_decisions_no_change on admission_decisions;
create trigger admission_decisions_no_change
  before update or delete on admission_decisions
  for each row execute function admission_record_immutable();

drop trigger if exists admission_audit_log_no_change on admission_audit_log;
create trigger admission_audit_log_no_change
  before update or delete on admission_audit_log
  for each row execute function admission_record_immutable();


-- ===========================================================================
-- 5. A STUDENT NUMBER TWO APPROVALS CANNOT COLLIDE ON
--
-- It was derived by reading the highest existing number and adding one. Two
-- approvals a few milliseconds apart read the same highest number and compute
-- the same next one; the loser fails on the unique index and the Head of
-- Academic Affairs sees an error on a decision they have already taken.
--
-- A counter row per intake year, incremented inside the statement that reads
-- it, so the database serialises them. `returning` gives the caller the number
-- it just reserved and nobody else can have.
-- ===========================================================================

create table if not exists student_number_counters (
  year        integer primary key,
  next_value  integer not null default 1
);

create or replace function reserve_student_number(p_year integer) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq integer;
begin
  insert into student_number_counters (year, next_value)
  values (p_year, 2)
  on conflict (year) do update set next_value = student_number_counters.next_value + 1
  returning next_value - 1 into seq;

  return 'ICOF' || p_year::text || lpad(seq::text, 5, '0');
end;
$$;

-- Start each year's counter above anything already issued, so running this on
-- a database with students in it does not reissue a number somebody holds.
do $$
declare
  r record;
begin
  for r in
    select substring(student_number from 5 for 4)::int as yr,
           max(substring(student_number from 9)::int) as top
    from students
    where student_number ~ '^ICOF[0-9]{4}[0-9]{5}$'
    group by 1
  loop
    insert into student_number_counters (year, next_value)
    values (r.yr, r.top + 1)
    on conflict (year) do update
      set next_value = greatest(student_number_counters.next_value, excluded.next_value);
  end loop;
end $$;


-- ===========================================================================
-- 6. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  app uuid;
  dec uuid;
  refused boolean;
  n1 text;
  n2 text;
begin
  -- matric_no is NOT NULL on this table, so the proof row carries one. It is
  -- deleted at the foot of this block; nothing here survives the migration.
  insert into students (first_name, last_name, matric_no, email, status)
  values ('Proof', '024', 'PROOF-024', 'proof-024@iguc.net', 'fee_paid')
  returning id into app;

  -- ---- A decision can be recorded --------------------------------------
  insert into admission_decisions
    (application_id, decision, decided_by_email, decided_by_role, previous_status, new_status)
  values (app, 'approve', 'proof-024@iguc.net', 'academic-office', 'fee_paid', 'approved')
  returning id into dec;

  insert into admission_audit_log (application_id, decision_id, event, actor_email, actor_role)
  values (app, dec, 'ACADEMIC_APPROVED', 'proof-024@iguc.net', 'academic-office');

  -- ---- AND NEITHER CAN BE REWRITTEN ------------------------------------
  refused := false;
  begin
    update admission_decisions set decision = 'reject' where id = dec;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '024 FAILED: an academic decision was edited after the fact';
  end if;

  refused := false;
  begin
    delete from admission_audit_log where application_id = app;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '024 FAILED: an audit entry was deleted';
  end if;

  -- ---- AN OVERRIDE MUST SAY WHY ----------------------------------------
  refused := false;
  begin
    insert into admission_decisions
      (application_id, decision, decision_type, is_override, override_of)
    values (app, 'approve', 'administrative-override', true, 'academic-office');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '024 FAILED: an administrative override was accepted with no reason';
  end if;

  -- …and is accepted when it does.
  insert into admission_decisions
    (application_id, decision, decision_type, is_override, override_of, override_reason,
     decided_by_email, decided_by_role)
  values (app, 'approve', 'administrative-override', true, 'academic-office',
          'Head of Academic Affairs unreachable and the intake closes tomorrow.',
          'superadmin@iguc.net', 'superadmin');

  -- ---- TWO NUMBERS RESERVED IN A ROW ARE DIFFERENT ---------------------
  -- The fault the old read-the-maximum-and-add-one approach had: two approvals
  -- at the same moment read the same maximum.
  n1 := reserve_student_number(2026);
  n2 := reserve_student_number(2026);
  if n1 = n2 then
    raise exception '024 FAILED: the same student number was reserved twice (%)', n1;
  end if;
  if n1 !~ '^ICOF2026[0-9]{5}$' then
    raise exception '024 FAILED: the student number is not in the University format (%)', n1;
  end if;

  -- Clear the proof. Both trails refuse a delete, so the triggers come off for
  -- the length of these statements — done here in the open because that is
  -- exactly the manoeuvre the triggers exist to make visible.
  alter table admission_audit_log disable trigger admission_audit_log_no_change;
  alter table admission_decisions disable trigger admission_decisions_no_change;
  delete from admission_audit_log where application_id = app;
  delete from admission_decisions where application_id = app;
  alter table admission_decisions enable trigger admission_decisions_no_change;
  alter table admission_audit_log enable trigger admission_audit_log_no_change;
  delete from students where id = app;
  delete from student_number_counters where year = 2026 and next_value <= 3;

  raise notice '024 OK — a decision is recorded and cannot be rewritten, an override must say '
               'why, and two student numbers reserved in succession differ.';
end $$;


-- ===========================================================================
-- 7. RLS
--
-- Staff read both. Only the service role writes, through the one decision
-- route, which is guarded by capability.
-- ===========================================================================

alter table admission_decisions enable row level security;
alter table admission_audit_log enable row level security;
alter table admission_states enable row level security;
alter table student_number_counters enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'admission_decisions'
                   and policyname = 'staff read admission decisions') then
    create policy "staff read admission decisions" on admission_decisions
      for select using (auth_role() is not null and auth_role() <> 'student');
  end if;

  if not exists (select 1 from pg_policies where tablename = 'admission_audit_log'
                   and policyname = 'staff read the admission audit log') then
    create policy "staff read the admission audit log" on admission_audit_log
      for select using (auth_role() is not null and auth_role() <> 'student');
  end if;

  -- The state list is what the applicant's own progress bar is labelled from,
  -- so it is readable by anyone. It contains no personal data at all.
  if not exists (select 1 from pg_policies where tablename = 'admission_states'
                   and policyname = 'admission states are public') then
    create policy "admission states are public" on admission_states for select using (true);
  end if;
end $$;
-- student_number_counters gets NO policy: RLS on with none is unreadable and
-- unwritable through the publishable key by construction. Only
-- reserve_student_number(), which is security definer, touches it.


-- ===========================================================================
-- 8. VERIFY
-- ===========================================================================

select stage, count(*) as states from admission_states group by stage order by min(sort_order);

-- Every academic decision the University has taken, most recent first.
select d.decision_date, d.decision, d.decided_by_email, d.decided_by_role,
       d.is_override, d.override_reason, s.first_name, s.last_name
from admission_decisions d
join students s on s.id = d.application_id
order by d.decision_date desc
limit 50;
