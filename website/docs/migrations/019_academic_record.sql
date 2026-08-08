-- ===========================================================================
-- 019 — THE ACADEMIC RECORD A REAL TRANSCRIPT IS BUILT FROM
--
-- The University set out what its transcript must carry: study mode and
-- campus, award distinguished from programme and specialization, transfer
-- credits with the institution they came from, every attempt at a repeated
-- course, academic standing, honours, and the conferral of the degree.
--
-- Almost none of that could be recorded. `students` had no study mode, no
-- campus, no specialization, no admission or completion date and no standing;
-- `results` had no notion of a second attempt; there was nowhere at all to put
-- a transfer credit, an honour, or a conferral.
--
-- So the transcript could not have printed those things however it was
-- designed. This is the record; the document follows it.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION REFUSES TO DECIDE
-- ---------------------------------------------------------------------------
--
-- Three of the University's requirements are POLICY, not schema, and this file
-- deliberately does not invent them:
--
--   WHAT A REPEATED COURSE DOES TO THE GPA. "The transcript should indicate
--   whether the first grade remains in GPA, is replaced, is excluded, or is
--   retained as an academic attempt" — and the University added "this should
--   be controlled by the university's academic policy". There is no rule here
--   yet, so `academic_policy.repeat_rule` is NULL and every attempt counts and
--   is shown. A default of 'latest-replaces' would quietly raise the GPA of
--   every student who has ever failed anything, under a rule nobody made.
--
--   WHERE ACADEMIC STANDING TURNS. Warning at 2.0, probation at 1.5 — those
--   are real numbers at real universities and they are not this University's
--   until it says so. Both thresholds are NULL and standing is set by a person
--   until they are stated.
--
--   WHAT EARNS AN HONOUR. Dean's List at what average, over what load. The
--   table records the honour and who awarded it; nothing computes one.
--
-- This follows `awards.cgpa_confirmed`, already in the schema for the same
-- reason: the interface shows the difference between a threshold the
-- University stated and one the system supplied, rather than presenting both
-- as equally authoritative.
--
-- ---------------------------------------------------------------------------
-- AND WHY STANDING DEFAULTS TO NULL RATHER THAN 'GOOD STANDING'
-- ---------------------------------------------------------------------------
--
-- Because a transcript reading "Academic Standing: Good Standing" is the
-- University stating that it has looked at the record and found it sound. For
-- a student nobody has assessed that is not a harmless default; it is a
-- favourable assertion made by a column default. NULL prints nothing, and
-- nothing is what the University has said.
--
-- Idempotent. Run it twice; the second run changes nothing.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. THE STUDENT'S PARTICULARS THE TRANSCRIPT PRINTS
-- ---------------------------------------------------------------------------

alter table students
  add column if not exists place_of_birth  text,
  -- The teaching location. A university with more than one must say which one
  -- taught the programme: a receiving institution assessing the award needs to
  -- know where the study happened, and "ICOF Global University" alone does not
  -- answer it.
  add column if not exists campus          text,
  add column if not exists mode_of_study   text,
  -- Distinguished from `program`. The University asked that the award, the
  -- programme and the specialization be three lines, "particularly important
  -- when you eventually have many specializations".
  add column if not exists specialization  text,
  -- DATES, not years. `admission_year` is an integer and cannot express
  -- "September 2023", which is what a transcript prints and what a credential
  -- evaluator compares against a visa.
  add column if not exists admitted_on     date,
  add column if not exists completed_on    date,
  add column if not exists academic_standing text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_mode_of_study_check') then
    alter table students add constraint students_mode_of_study_check
      check (mode_of_study is null or mode_of_study in
             ('on-campus', 'online', 'distance', 'blended'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'students_academic_standing_check') then
    alter table students add constraint students_academic_standing_check
      check (academic_standing is null or academic_standing in
             ('good-standing', 'warning', 'probation', 'suspended',
              'graduated', 'withdrawn', 'dismissed'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE UNIVERSITY'S ACADEMIC POLICY — ONE ROW, MOSTLY EMPTY ON PURPOSE
-- ---------------------------------------------------------------------------

create table if not exists academic_policy (
  -- Exactly one row, enforced below. A policy table with two rows is a
  -- university with two policies and no way to tell which applies.
  id                       boolean primary key default true check (id),

  -- WHAT A REPEATED COURSE DOES. NULL until the University rules.
  repeat_rule              text,
  repeat_rule_confirmed    boolean not null default false,

  -- WHERE STANDING TURNS. NULL until the University rules.
  standing_warning_below   numeric(3,2),
  standing_probation_below numeric(3,2),
  standing_confirmed       boolean not null default false,

  -- Whether a transcript may be issued to a student with an unpaid balance.
  -- The University's own regulations say documents are held until it is paid;
  -- this records whether that is enforced by the system or by the counter.
  hold_on_fee_balance      boolean not null default false,

  ruled_on                 date,
  ruled_by                 text,
  updated_at               timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'academic_policy_repeat_rule_check') then
    alter table academic_policy add constraint academic_policy_repeat_rule_check
      check (repeat_rule is null or repeat_rule in
             ('all-attempts-count',   -- every attempt is in the GPA
              'latest-replaces',      -- the most recent attempt replaces earlier ones
              'best-replaces',        -- the highest attempt replaces earlier ones
              'excluded-from-gpa'));  -- earlier attempts are shown but not counted
  end if;

  -- A CONFIRMED RULE MUST BE A RULE. `confirmed = true` with `repeat_rule`
  -- NULL would be the system reporting that the University has ruled, when it
  -- has recorded nothing.
  if not exists (select 1 from pg_constraint where conname = 'academic_policy_confirmed_check') then
    alter table academic_policy add constraint academic_policy_confirmed_check
      check ((not repeat_rule_confirmed or repeat_rule is not null)
         and (not standing_confirmed
              or (standing_warning_below is not null
                  and standing_probation_below is not null)));
  end if;
end $$;

insert into academic_policy (id) values (true) on conflict (id) do nothing;

alter table academic_policy enable row level security;

drop policy if exists academic_policy_read on academic_policy;
create policy academic_policy_read on academic_policy
  for select using (auth.uid() is not null);

-- ONLY THE SUPERADMINISTRATOR. A rule that decides how every GPA in the
-- University is computed is not an operational setting.
drop policy if exists academic_policy_write on academic_policy;
create policy academic_policy_write on academic_policy
  for update using (auth_role() = 'superadmin') with check (auth_role() = 'superadmin');

-- ---------------------------------------------------------------------------
-- 3. EVERY ATTEMPT AT A COURSE IS KEPT
-- ---------------------------------------------------------------------------
--
-- "The system should retain every attempt." It could not: nothing in `results`
-- distinguished a second sitting from the first, so a repeat was recorded by
-- editing the original row and the failure ceased to exist.

alter table results
  add column if not exists attempt integer not null default 1,
  -- What this attempt does to the GPA, once the University has a rule. NULL
  -- means the rule has not been applied to this row — which, while
  -- `repeat_rule` is NULL, is every row, and the transcript says so rather
  -- than implying a policy.
  add column if not exists gpa_disposition text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'results_attempt_check') then
    alter table results add constraint results_attempt_check check (attempt >= 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'results_gpa_disposition_check') then
    alter table results add constraint results_gpa_disposition_check
      check (gpa_disposition is null or gpa_disposition in ('counts', 'replaced', 'excluded'));
  end if;
end $$;

create index if not exists results_student_course_attempt_idx
  on results (student_id, course_id, attempt);

-- ---------------------------------------------------------------------------
-- 4. TRANSFER CREDIT
-- ---------------------------------------------------------------------------
--
-- "The student should not have to lose the history of where previous credits
-- came from." A credit accepted from elsewhere is a DECISION of this
-- University about another institution's teaching, and it is recorded as
-- somebody's decision, with the institution named.

create table if not exists transfer_credits (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,

  -- Where it came from. Named on the transcript, because a credit with no
  -- source is a credit a receiving institution cannot weigh.
  institution    text not null,
  course_code    text,
  course_title   text not null,
  credits        numeric(5,2) not null check (credits > 0),

  -- What this University accepted, which may be less than what was offered.
  accepted       boolean not null default false,
  credits_accepted numeric(5,2) check (credits_accepted >= 0),

  -- Whether it counts toward the award, and toward which one.
  award_id       uuid references awards (id) on delete set null,

  -- WHOSE DECISION IT WAS. Required when accepted: a credit that appears on a
  -- sealed transcript with nobody's name against the decision is a credit
  -- nobody can be asked about.
  decided_by     uuid,
  decided_on     date,
  note           text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transfer_credits_decided_check') then
    alter table transfer_credits add constraint transfer_credits_decided_check
      check (not accepted or (decided_by is not null and decided_on is not null
                              and credits_accepted is not null));
  end if;
end $$;

create index if not exists transfer_credits_student_idx on transfer_credits (student_id);

alter table transfer_credits enable row level security;

drop policy if exists transfer_credits_read on transfer_credits;
create policy transfer_credits_read on transfer_credits
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                    'programme-coordinator', 'dean', 'hod')
    or exists (select 1 from students s
                where s.id = transfer_credits.student_id and s.auth_user_id = auth.uid())
  );

drop policy if exists transfer_credits_write on transfer_credits;
create policy transfer_credits_write on transfer_credits
  for insert with check (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );

drop policy if exists transfer_credits_update on transfer_credits;
create policy transfer_credits_update on transfer_credits
  for update using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );

-- ---------------------------------------------------------------------------
-- 5. HONOURS AND DISTINCTIONS
-- ---------------------------------------------------------------------------
--
-- Recorded, never computed. Nothing in this migration decides that a student
-- has made the Dean's List, because the University has not said what earns it.

create table if not exists academic_honours (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,

  kind           text not null,
  title          text not null,
  academic_year  text,
  semester       integer,
  awarded_on     date not null,
  awarded_by     uuid,
  note           text,
  created_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'academic_honours_kind_check') then
    alter table academic_honours add constraint academic_honours_kind_check
      check (kind in ('deans-list', 'distinction', 'excellence',
                      'scholarship', 'award', 'recognition'));
  end if;
end $$;

create index if not exists academic_honours_student_idx on academic_honours (student_id);

alter table academic_honours enable row level security;

drop policy if exists academic_honours_read on academic_honours;
create policy academic_honours_read on academic_honours
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                    'programme-coordinator', 'dean', 'hod')
    or exists (select 1 from students s
                where s.id = academic_honours.student_id and s.auth_user_id = auth.uid())
  );

drop policy if exists academic_honours_write on academic_honours;
create policy academic_honours_write on academic_honours
  for insert with check (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );

-- ---------------------------------------------------------------------------
-- 6. CONFERRAL — WHAT TIES THE TRANSCRIPT TO THE DEGREE
-- ---------------------------------------------------------------------------
--
-- "Conferred: 15 July 2027 · Senate approval date · Convocation date · Degree
-- certificate number." A conferral is an act of the Senate, so the date it
-- resolved is not optional decoration — it is the authority for the award, and
-- a conferral recorded without it says the University granted a degree with no
-- record of deciding to.

create table if not exists graduation_records (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references students (id) on delete cascade,
  award_id           uuid references awards (id) on delete set null,

  senate_approved_on date not null,
  conferred_on       date not null,
  convocation_on     date,

  classification     text,
  -- The University's own sequence for the graduating cohort.
  graduation_number  text,
  -- Links the transcript to the certificate on the credential register.
  certificate_credential_id text,

  recorded_by        uuid,
  created_at         timestamptz not null default now(),

  -- One conferral of one award to one student. A second is a reissue of the
  -- certificate, not a second degree.
  unique (student_id, award_id)
);

do $$
begin
  -- A DEGREE CANNOT BE CONFERRED BEFORE THE SENATE RESOLVED TO CONFER IT.
  if not exists (select 1 from pg_constraint where conname = 'graduation_records_order_check') then
    alter table graduation_records add constraint graduation_records_order_check
      check (conferred_on >= senate_approved_on);
  end if;
end $$;

create index if not exists graduation_records_student_idx on graduation_records (student_id);

alter table graduation_records enable row level security;

drop policy if exists graduation_records_read on graduation_records;
create policy graduation_records_read on graduation_records
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                    'programme-coordinator', 'dean', 'vice-chancellor')
    or exists (select 1 from students s
                where s.id = graduation_records.student_id and s.auth_user_id = auth.uid())
  );

drop policy if exists graduation_records_write on graduation_records;
create policy graduation_records_write on graduation_records
  for insert with check (
    auth_role() in ('superadmin', 'registrar', 'academic-office', 'vice-chancellor')
  );

-- ---------------------------------------------------------------------------
-- 7. ACADEMIC STANDING IS A HISTORY, NOT A FIELD
-- ---------------------------------------------------------------------------
--
-- `students.academic_standing` is where the record stands today. This is how
-- it got there, and it is APPEND-ONLY: a student moved from probation to good
-- standing has a history that matters to them, and a column alone erases it
-- every time it is set.

create table if not exists academic_standing_events (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,
  from_standing  text,
  to_standing    text not null,
  reason         text not null,
  cgpa_at_change numeric(3,2),
  decided_by     uuid,
  decided_at     timestamptz not null default now()
);

create index if not exists academic_standing_events_student_idx
  on academic_standing_events (student_id, decided_at desc);

create or replace function refuse_standing_mutation() returns trigger
language plpgsql as $$
begin
  raise exception
    'academic_standing_events is append-only. A standing that can be edited '
    'after the fact is not a record of what the University decided; it is a '
    'record of what somebody last wanted it to say.'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists academic_standing_events_no_update on academic_standing_events;
create trigger academic_standing_events_no_update
  before update or delete on academic_standing_events
  for each row execute function refuse_standing_mutation();

alter table academic_standing_events enable row level security;

drop policy if exists academic_standing_events_read on academic_standing_events;
create policy academic_standing_events_read on academic_standing_events
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                    'programme-coordinator', 'dean', 'hod')
    or exists (select 1 from students s
                where s.id = academic_standing_events.student_id
                  and s.auth_user_id = auth.uid())
  );

drop policy if exists academic_standing_events_write on academic_standing_events;
create policy academic_standing_events_write on academic_standing_events
  for insert with check (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );

-- ---------------------------------------------------------------------------
-- 8. A STUDENT ASKING FOR THEIR OWN TRANSCRIPT
-- ---------------------------------------------------------------------------
--
-- "Request Official Transcript — Digital PDF / Printed copy / Both."
--
-- A REQUEST IS NOT AN ISSUE. This table holds the asking; the credential
-- register holds the document. Keeping them apart is what lets a request be
-- refused, queued behind a fee, or fulfilled twice, without any of that
-- touching the sealed record.

create table if not exists transcript_requests (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,
  requested_by   uuid,
  requested_at   timestamptz not null default now(),

  kind           text not null default 'official',
  delivery       text not null default 'pdf',

  status         text not null default 'requested',
  -- Set when it is fulfilled. Points at credentials_issued.credential_id.
  credential_ref text,
  decided_by     uuid,
  decided_at     timestamptz,
  note           text
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transcript_requests_kind_check') then
    alter table transcript_requests add constraint transcript_requests_kind_check
      check (kind in ('official', 'unofficial', 'interim', 'graduation',
                      'academic-record', 'external-evaluation'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transcript_requests_delivery_check') then
    alter table transcript_requests add constraint transcript_requests_delivery_check
      check (delivery in ('pdf', 'print', 'both'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transcript_requests_status_check') then
    alter table transcript_requests add constraint transcript_requests_status_check
      check (status in ('requested', 'in-progress', 'issued', 'refused', 'cancelled'));
  end if;

  -- A REFUSAL MUST SAY WHY. A request declined with no note is a student told
  -- no by a system with nobody to ask.
  if not exists (select 1 from pg_constraint where conname = 'transcript_requests_refusal_check') then
    alter table transcript_requests add constraint transcript_requests_refusal_check
      check (status <> 'refused' or (note is not null and length(btrim(note)) >= 8));
  end if;
end $$;

create index if not exists transcript_requests_student_idx
  on transcript_requests (student_id, requested_at desc);
create index if not exists transcript_requests_open_idx
  on transcript_requests (status) where status in ('requested', 'in-progress');

alter table transcript_requests enable row level security;

drop policy if exists transcript_requests_read on transcript_requests;
create policy transcript_requests_read on transcript_requests
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
    or exists (select 1 from students s
                where s.id = transcript_requests.student_id and s.auth_user_id = auth.uid())
  );

-- A STUDENT MAY ASK FOR THEIR OWN, AND ONLY THEIR OWN.
drop policy if exists transcript_requests_own_insert on transcript_requests;
create policy transcript_requests_own_insert on transcript_requests
  for insert with check (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
    or exists (select 1 from students s
                where s.id = transcript_requests.student_id and s.auth_user_id = auth.uid())
  );

-- BUT ONLY THE REGISTRY DECIDES ONE. A student who could update their own
-- request could mark it issued.
drop policy if exists transcript_requests_decide on transcript_requests;
create policy transcript_requests_decide on transcript_requests
  for update using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  ) with check (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );

-- ===========================================================================
-- 9. PERFORMING THE RULES, RATHER THAN ASSERTING THAT TRIGGERS EXIST
--
-- Every check below does the thing the rule forbids and expects to be
-- refused. A test that reads pg_trigger proves a trigger is attached; it does
-- not prove the trigger does what its name says.
-- ===========================================================================

do $$
declare
  s_id uuid;
  ev_id uuid;
  refused boolean;
begin
  -- A student to test against, removed at the end.
  insert into students (matric_no, first_name, last_name, status)
  values ('MIG019/PROOF', 'Migration', 'Proof', 'applicant')
  returning id into s_id;

  -- ---- Standing history cannot be rewritten ------------------------------
  insert into academic_standing_events (student_id, to_standing, reason)
  values (s_id, 'probation', 'Proof of the append-only rule')
  returning id into ev_id;

  refused := false;
  begin
    update academic_standing_events set to_standing = 'good-standing' where id = ev_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: a standing event could be edited after the fact';
  end if;

  refused := false;
  begin
    delete from academic_standing_events where id = ev_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: a standing event could be deleted';
  end if;

  -- ---- An accepted transfer credit must name who accepted it -------------
  refused := false;
  begin
    insert into transfer_credits (student_id, institution, course_title, credits, accepted)
    values (s_id, 'Another University', 'Old Testament Survey', 6, true);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: a credit was accepted with nobody''s name against it';
  end if;

  -- …and is accepted normally when it does.
  insert into transfer_credits (student_id, institution, course_title, credits,
                                accepted, credits_accepted, decided_by, decided_on)
  values (s_id, 'Another University', 'Old Testament Survey', 6,
          true, 6, gen_random_uuid(), current_date);

  -- ---- A degree cannot be conferred before the Senate resolved -----------
  refused := false;
  begin
    insert into graduation_records (student_id, senate_approved_on, conferred_on)
    values (s_id, current_date, current_date - 1);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: a degree was conferred before the Senate approved it';
  end if;

  -- ---- A refused request must say why ------------------------------------
  refused := false;
  begin
    insert into transcript_requests (student_id, status) values (s_id, 'refused');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: a request was refused with no reason recorded';
  end if;

  -- ---- The policy row cannot claim a ruling it does not hold -------------
  refused := false;
  begin
    update academic_policy set repeat_rule_confirmed = true, repeat_rule = null;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: the policy reported a ruling with no rule recorded';
  end if;

  -- ---- Study mode is a closed list ---------------------------------------
  refused := false;
  begin
    update students set mode_of_study = 'correspondence' where id = s_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: an unknown study mode was accepted';
  end if;

  -- Clean up. The standing event resists deletion by design, so the student
  -- row is removed with the trigger disabled for this transaction only.
  set constraints all immediate;
  alter table academic_standing_events disable trigger academic_standing_events_no_update;
  delete from academic_standing_events where student_id = s_id;
  alter table academic_standing_events enable trigger academic_standing_events_no_update;
  delete from transfer_credits where student_id = s_id;
  delete from transcript_requests where student_id = s_id;
  delete from students where id = s_id;

  raise notice '019 OK — standing is append-only, an accepted credit names its decider, a '
               'conferral cannot precede the Senate, a refusal states its reason, the policy '
               'cannot claim an unrecorded ruling, and study mode is a closed list.';
end $$;

-- ---------------------------------------------------------------------------
-- 10. WHAT THE UNIVERSITY STILL HAS TO RULE ON
-- ---------------------------------------------------------------------------

do $$
declare
  p record;
begin
  select * into p from academic_policy where id;

  if not p.repeat_rule_confirmed then
    raise notice 'OUTSTANDING RULING — repeated courses. `academic_policy.repeat_rule` is not '
                 'set, so every attempt counts toward the GPA and every attempt is printed. '
                 'Set it to one of all-attempts-count / latest-replaces / best-replaces / '
                 'excluded-from-gpa when the University rules, and set repeat_rule_confirmed.';
  end if;

  if not p.standing_confirmed then
    raise notice 'OUTSTANDING RULING — academic standing. No threshold is recorded, so standing '
                 'is whatever a person sets and nothing is computed. A transcript shows no '
                 'standing at all until one is recorded against the student.';
  end if;
end $$;

-- What landed.
select 'students'                  as object, count(*) as columns_added from information_schema.columns
 where table_schema = 'public' and table_name = 'students'
   and column_name in ('place_of_birth','campus','mode_of_study','specialization',
                       'admitted_on','completed_on','academic_standing')
union all
select 'results', count(*) from information_schema.columns
 where table_schema = 'public' and table_name = 'results'
   and column_name in ('attempt','gpa_disposition')
union all
select 'new tables', count(*) from information_schema.tables
 where table_schema = 'public'
   and table_name in ('academic_policy','transfer_credits','academic_honours',
                      'graduation_records','academic_standing_events','transcript_requests');
