-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 036, 037, 038, 039, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-OUTSTANDING.sql 036 037 038 039
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN-OUTSTANDING.sql
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
-- Run docs/migrations/VERIFY.sql to see what landed.
-- ===========================================================================

-- ===========================================================================
-- ===========================================================================
--
--   036_the_steps_nothing_could_write.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 036 — THE THREE STATES THE UNIVERSITY DECLARED AND NOTHING COULD WRITE
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- Two new events are admitted to the audit trail's vocabulary, and with them
-- three states become reachable for the first time since 024 declared them:
--
--   under_review        The Admissions Office has opened the application. Until
--                       now a file somebody was working on and a file nobody
--                       had touched were the same value, so "why has this sat
--                       for three weeks" had no answer in the system.
--   fee_pending         Finance has ASKED for the fee. `applicant` means nobody
--                       has asked. An applicant chased for money they were
--                       never asked for is what the absence of this cost.
--   documents_verified  The documents were checked and accepted. Verification
--                       was recorded only by its absence — a record stopped
--                       being `documents_required` — so "checked and accepted"
--                       and "nobody has looked" were indistinguishable.
--
-- Nothing moves on its own. No existing application changes state; this widens
-- a CHECK constraint so the controls that write these states are accepted.
--
-- ---------------------------------------------------------------------------
-- WHY A CONSTRAINT AND NOT JUST CODE
-- ---------------------------------------------------------------------------
--
-- `admission_audit_log.event` is a closed vocabulary on purpose: an event
-- outside it fails the insert. That is the right failure, because the
-- alternative is an act that happened and was not recorded. The routes write
-- the trail as part of the step, so without this the step is refused rather
-- than silently unrecorded — which is why the application's own test suite
-- fails until this migration exists.
-- ===========================================================================

do $$
begin
  if exists (select 1 from pg_constraint
              where conname = 'admission_audit_log_event_check') then
    alter table admission_audit_log drop constraint admission_audit_log_event_check;
  end if;

  alter table admission_audit_log add constraint admission_audit_log_event_check
    check (event in (
      'APPLICATION_SUBMITTED',
      -- The two new ones. Both name an office DOING something rather than
      -- something having happened to the application, which is the distinction
      -- the three states exist to record.
      'ADMISSION_OPENED', 'FEE_REQUESTED',
      'DOCUMENT_VERIFIED', 'FEE_CONFIRMED',
      'FORWARDED_FOR_ACADEMIC_REVIEW',
      'ACADEMIC_REVIEW_STARTED', 'ACADEMIC_APPROVED',
      'ACADEMIC_CONDITIONALLY_APPROVED', 'ACADEMIC_REJECTED', 'ACADEMIC_RETURNED',
      'RETURNED_TO_OFFICE', 'REOPENED_FOR_REEVALUATION',
      'ISSUANCE_STARTED', 'ISSUANCE_FAILED', 'ISSUANCE_RETRIED',
      'ADMISSION_LETTER_GENERATED', 'ADMISSION_PACKAGE_ISSUED',
      'ACCOUNT_CREATED', 'WELCOME_EMAIL_SENT', 'WELCOME_EMAIL_FAILED',
      'ENROLLED', 'WITHDRAWN', 'ADMINISTRATIVE_OVERRIDE'
    ));
end $$;


-- ===========================================================================
-- PERFORMING THE RULES
-- ===========================================================================
--
-- Both directions. A vocabulary that accepts everything is not a vocabulary,
-- and one that refuses the thing it was widened for is a migration that did not
-- take — and the difference between those two is invisible from reading the
-- SQL, which is why this runs it.

do $$
declare
  app_id uuid;
  refused boolean;
begin
  -- A row to hang the proof on. Any application will do; if the University has
  -- none yet there is nothing to prove against and the checks are skipped
  -- rather than faked against an invented student.
  select id into app_id from students limit 1;
  if app_id is null then
    raise notice '036: no applications yet, so the trail could not be exercised';
    return;
  end if;

  -- ---- The new events are accepted ----------------------------------------
  begin
    insert into admission_audit_log (application_id, event, previous_state, new_state, detail)
    values (app_id, 'ADMISSION_OPENED', 'applicant', 'under_review', 'PROOF'),
           (app_id, 'FEE_REQUESTED',    'applicant', 'fee_pending',  'PROOF');
    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then
      raise exception '036 FAILED: the new events are still refused by the constraint (%)', sqlerrm;
    end if;
  end;

  -- ---- AND AN INVENTED ONE IS STILL REFUSED -------------------------------
  -- The half of this that matters. Widening a vocabulary by removing the
  -- constraint would pass every test above and leave the trail able to record
  -- anything at all.
  refused := false;
  begin
    insert into admission_audit_log (application_id, event, previous_state, new_state)
    values (app_id, 'SOMEBODY_JUST_MADE_THIS_UP', 'applicant', 'under_review');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '036 FAILED: the audit trail accepted an event nobody declared. The '
                    'vocabulary is no longer closed.';
  end if;

  raise notice '036 OK: the trail records the two new steps and still refuses an invented one';
end $$;

-- The three states are declared, which they have been since 024, and now
-- something can write them.
do $$
declare
  missing text;
begin
  select string_agg(s, ', ') into missing
    from unnest(array['under_review', 'fee_pending', 'documents_verified']) s
   where not exists (select 1 from admission_states a where a.state = s);
  if missing is not null then
    raise exception '036 FAILED: % is not in admission_states, so nothing can be put into it',
      missing;
  end if;
  raise notice '036 OK: under_review, fee_pending and documents_verified are reachable';
end $$;


-- ===========================================================================
-- VERIFY
-- ===========================================================================

-- The vocabulary as it now stands.
select unnest(string_to_array(
         replace(replace(substring(pg_get_constraintdef(oid)
           from '\((.*)\)$'), '''', ''), ' ', ''), ',')) as event_now_allowed
  from pg_constraint where conname = 'admission_audit_log_event_check';

-- How many applications sit in each of the three, which should be 0 today and
-- stop being 0 the first time somebody opens a file.
select a.state, a.applicant_label, count(s.id) as applications
  from admission_states a
  left join students s on s.status = a.state
 where a.state in ('under_review', 'fee_pending', 'documents_verified')
 group by a.state, a.applicant_label
 order by a.state;


-- ===========================================================================
-- ===========================================================================
--
--   037_a_student_is_not_an_application.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 037 — `students.status` WAS TWO COLUMNS WEARING ONE NAME
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS. READ THIS PART.
-- ---------------------------------------------------------------------------
--
-- 1. EVERY GRADUATED, ACTIVE AND SUSPENDED ROW CHANGES ITS `status`. They
--    become `enrolled` — which is what they always were, because you cannot
--    graduate from a university you were never enrolled at — and what became of
--    them moves to the new `student_status` column. A query filtering
--    `status = 'graduated'` returns nothing after this and must read
--    `student_status` instead. The application already does.
--
-- 2. NOTHING IS LOST AND NOTHING IS GUESSED. Section 3 records every row it
--    moves, before and after, in `student_status_split`. The one genuinely
--    ambiguous value — `withdrawn` — is decided by evidence on the row rather
--    than by preference, and the rows it could not decide are reported.
--
-- 3. `students.status` GETS A CHECK CONSTRAINT FOR THE FIRST TIME. It never had
--    one. That is how three states could be written by the pipeline for years
--    while being absent from the vocabulary, and how `active` could sit in a
--    column of admission states without anything objecting. It is added NOT
--    VALID: it governs every new write immediately and does not refuse to run
--    because of a row somebody typed in 2024. 027's coverage view already
--    reports the strays.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS WORTH A MIGRATION
-- ---------------------------------------------------------------------------
--
-- Two vocabularies shared one column and two of the words appeared in both.
--
--   `withdrawn`  an applicant who wrote to say they no longer wanted the place,
--                and a student who left in their second year. 034 gave the
--                Registrar a withdrawal action that writes this word, so from
--                that day the two became genuinely indistinguishable — and one
--                of them is a place that could have gone to somebody else while
--                the other is a student who needs a transcript.
--   `deferred`   an offer held to a later intake, and something that was
--                supposed to describe a student. Only the first is real.
--
-- And it forced a worse thing. Conferring a degree set `status = 'graduated'`,
-- which OVERWROTE `enrolled`. The University's own record of having admitted
-- and enrolled somebody was destroyed by the act of graduating them.
-- ===========================================================================


-- ===========================================================================
-- 1. THE SECOND COLUMN
-- ===========================================================================
--
-- NULL until enrolment, deliberately. Somebody who has not enrolled is not yet
-- a student, and a default of 'active' would say the University teaches every
-- applicant who ever filled in the form.

alter table students add column if not exists student_status text;

comment on column students.student_status is
  'What became of this student: active, graduated, suspended or withdrawn. NULL '
  'until they enrol, because an applicant is not a student. The admission '
  'pipeline lives in `status` and is settled history once enrolment is recorded.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_student_status_check') then
    alter table students add constraint students_student_status_check
      check (student_status is null
             or student_status in ('active', 'graduated', 'suspended', 'withdrawn'));
  end if;
end $$;

create index if not exists students_student_status_idx
  on students (student_status) where student_status is not null;


-- ===========================================================================
-- 2. WHAT WAS MOVED
-- ===========================================================================
--
-- A column split that cannot be audited is a column split nobody can undo. One
-- row per student moved, with both values before and both after.

create table if not exists student_status_split (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,
  status_before  text,
  status_after   text,
  student_status_after text,
  /** How the row was decided, in words, for the ambiguous ones especially. */
  because        text not null,
  split_at       timestamptz not null default now()
);

create index if not exists student_status_split_student_idx
  on student_status_split (student_id);

alter table student_status_split enable row level security;

drop policy if exists student_status_split_read on student_status_split;
create policy student_status_split_read on student_status_split
  for select using (auth_role() in ('superadmin', 'admin', 'registrar'));

-- No insert, update or delete policy. The service role writes it and nobody
-- edits the record of what was moved.


-- ===========================================================================
-- 3. THE SPLIT
-- ===========================================================================
--
-- Only rows whose `status` is one of the four student words are touched. An
-- application sitting at `fee_paid` is not a student and is left exactly alone.
--
-- `withdrawn` IS THE ONLY HARD ONE, and it is decided by evidence rather than
-- by preference: a row with an enrolment date or a student number was a
-- student when they left, and a row with neither was an applicant. Rows that
-- carry neither piece of evidence stay applicants, because under-counting the
-- student body is the safe way to be wrong — the alternative is conferring
-- studenthood on somebody who never had it.

do $$
declare
  moved integer;
begin
  with decided as (
    select s.id,
           s.status as status_before,
           case
             when s.status in ('active', 'graduated', 'suspended') then 'enrolled'
             when s.status = 'withdrawn'
              and (s.enrolled_at is not null or s.student_number is not null) then 'enrolled'
             else s.status
           end as status_after,
           case
             when s.status in ('active', 'graduated', 'suspended') then s.status
             when s.status = 'withdrawn'
              and (s.enrolled_at is not null or s.student_number is not null) then 'withdrawn'
             else null
           end as student_status_after,
           case
             when s.status in ('active', 'graduated', 'suspended')
               then 'Was a student word in the admission column. The admission state can only '
                 || 'have been `enrolled`: you cannot graduate from, be suspended by or be '
                 || 'active at a university you were never enrolled at.'
             when s.status = 'withdrawn' and s.enrolled_at is not null
               then 'Withdrew after enrolment — `enrolled_at` is set — so this is a student '
                 || 'who left, not an applicant who declined.'
             when s.status = 'withdrawn' and s.student_number is not null
               then 'Withdrew holding a student number, so the University had already made '
                 || 'them a student.'
             when s.status = 'withdrawn'
               then 'Withdrew with no enrolment date and no student number, so they were an '
                 || 'applicant who stepped away. Left as an admission outcome.'
             else 'Not a student word. Untouched.'
           end as because
      from students s
     where s.status in ('active', 'graduated', 'suspended', 'withdrawn')
       -- Already split. A second run must move nothing.
       and s.student_status is null
       and not (s.status = 'withdrawn'
                and s.enrolled_at is null and s.student_number is null)
  ),
  logged as (
    insert into student_status_split
      (student_id, status_before, status_after, student_status_after, because)
    select id, status_before, status_after, student_status_after, because from decided
    returning 1
  )
  update students s
     set status = d.status_after,
         student_status = d.student_status_after
    from decided d
   where s.id = d.id;

  get diagnostics moved = row_count;
  raise notice '037: % student row(s) split into an admission state and a student status', moved;
end $$;

-- Anybody the Registrar has enrolled and who has no student status yet is
-- active. Written separately because it is a different statement: the rows
-- above were MIS-FILED, these were simply never asked the question.
update students
   set student_status = 'active'
 where status = 'enrolled' and student_status is null;


-- ===========================================================================
-- 4. `students.status` FINALLY GETS A VOCABULARY
-- ===========================================================================
--
-- NOT VALID, and that is the considered choice rather than the lazy one. A
-- validating constraint would refuse to be created at all if one row in years
-- of data carried a status nobody remembers writing, and the migration would
-- fail with a message about a single row instead of doing its job. NOT VALID
-- governs every write from this second onward, which is what stops the next
-- unnamed state, and 027's `admission_status_coverage` view already reports
-- anything historic that does not fit.
--
-- Run `alter table students validate constraint students_status_check;` once
-- the coverage view is clean, and it becomes a full constraint with no rewrite.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_status_check') then
    alter table students add constraint students_status_check
      check (status in (
        'draft', 'applicant', 'under_review', 'documents_required', 'documents_verified',
        'fee_pending', 'fee_paid', 'registrar_approved', 'ready_for_academic_review',
        'approved', 'conditional', 'rejected', 'declined', 'deferred', 'returned',
        'admission_processing', 'admission_processing_failed', 'admission_issued',
        'enrolled', 'withdrawn'
      )) not valid;
  end if;
end $$;


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  n integer;
  sid uuid;
begin
  -- ---- No student word is left in the admission column --------------------
  select count(*) into n from students
   where status in ('active', 'graduated', 'suspended');
  if n > 0 then
    raise exception '037 FAILED: % row(s) still carry a student status in `status`', n;
  end if;

  -- ---- A GRADUATE IS STILL RECORDED AS HAVING BEEN ENROLLED ---------------
  -- The thing the old column destroyed. Conferring a degree overwrote the
  -- enrolment, so the University's record that it had admitted and enrolled
  -- somebody was erased by the act of graduating them.
  select count(*) into n from students
   where student_status = 'graduated' and status <> 'enrolled';
  if n > 0 then
    raise exception '037 FAILED: % graduate(s) are not recorded as having been enrolled', n;
  end if;

  -- ---- An invented student status is refused ------------------------------
  select id into sid from students limit 1;
  if sid is not null then
    refused := false;
    begin
      update students set student_status = 'expelled' where id = sid;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '037 FAILED: `student_status` accepted a value nobody declared. The '
                      'vocabulary is not closed, which is how the old column went wrong.';
    end if;

    -- ---- And so is an invented admission state ---------------------------
    -- `students.status` has never had a constraint. This is the first time it
    -- refuses anything, and it is worth watching it do so.
    refused := false;
    begin
      update students set status = 'somebody_just_made_this_up' where id = sid;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '037 FAILED: `students.status` still accepts any text at all. The '
                      'constraint did not take.';
    end if;
  end if;

  raise notice '037 OK: the two vocabularies are in two columns and each refuses the other''s '
               'inventions';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- What was moved, and why. Empty on a second run.
select status_before, status_after, student_status_after, count(*) as rows, min(because) as because
  from student_status_split
 group by 1, 2, 3
 order by 1;

-- The roll, as the University can now state it in one query rather than four
-- guessed values.
select coalesce(student_status, '— not a student —') as student_status,
       count(*) as people
  from students
 group by 1
 order by 2 desc;

-- WITHDRAWALS THAT COULD NOT BE DECIDED. Rows left as applicant withdrawals
-- because they carry neither an enrolment date nor a student number. If any of
-- these were students who left, set their student_status by hand — this
-- migration will not guess.
select id, first_name, last_name, matric_no, withdrawn_at
  from students
 where status = 'withdrawn' and student_status is null
 order by withdrawn_at desc nulls last;

-- Statuses the vocabulary does not know, from 027's view. The constraint is NOT
-- VALID until this is empty.
select * from admission_status_coverage where not in_vocabulary;


-- ===========================================================================
-- ===========================================================================
--
--   038_announcements_are_the_institution_speaking.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 038 — AN ANNOUNCEMENT IS THE INSTITUTION SPEAKING, SO IT GETS A RECORD
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- Announcements stop being rows on the `documents` table and become records of
-- their own, with an author, a clearance, a publication and a history. Nothing
-- is deleted: section 6 COPIES the existing notices across and leaves the
-- originals exactly where they are, so a bad migration costs a re-run and not
-- the University's noticeboard.
--
-- IT CLOSES A DOOR. Until now anybody whose role was `admin` or `lecturer`
-- could put a notice on the University's noticeboard, alone, instantly, with
-- nobody named. From now on an announcement is composed by one person and
-- cleared by another, and the database refuses a clearance by the author —
-- including a Superadministrator who wrote it. If one person has been posting
-- notices unaided, that stops working on the day this runs, and that is the
-- point rather than a side effect.
--
-- ---------------------------------------------------------------------------
-- WHY IT IS NOT A SECOND PUBLISHER
-- ---------------------------------------------------------------------------
--
-- 013 and 014 already built the social pipeline: connected accounts, per
-- platform variants, an approval that refuses to let an author approve their
-- own post, per-target delivery states and retry. An announcement's EXTERNAL
-- destinations are fulfilled by that pipeline — `announcement_destinations`
-- carries `social_post_id` and the delivery is the post's — rather than by a
-- second set of credentials and a second idea of what published means.
--
-- The announcement is the canonical source. The networks are destinations.
-- There is one publisher.
-- ===========================================================================


-- ===========================================================================
-- 1. THE ANNOUNCEMENT
-- ===========================================================================

create table if not exists announcements (
  id             uuid primary key default gen_random_uuid(),

  title          text not null check (length(btrim(title)) >= 6),
  body           text not null check (length(btrim(body)) >= 20),

  -- ---- What it is about, and who it is for -------------------------------
  --
  -- BOTH CLOSED VOCABULARIES. The point of a category is to be the same word
  -- twice: a free-text field produces "Admissions", "admission", "ADMISSIONS"
  -- and "Admissions Office" within a month, and then nothing can be filtered.
  category       text not null default 'general'
                   check (category in ('general', 'admissions', 'academic', 'finance',
                                       'examination', 'graduation', 'events',
                                       'emergency', 'faculty')),

  -- MORE THAN ONE, AND AT LEAST ONE. An announcement addressed to nobody
  -- reaches nobody, and the array is checked element by element so a typo
  -- cannot create a sixth audience nobody has ever heard of.
  audiences      text[] not null default '{}',

  -- ---- The featured image ------------------------------------------------
  --
  -- ALT TEXT IS REQUIRED WHERE THERE IS AN IMAGE. 013 already requires it of
  -- social media, for the reason it gives: a university publishing an image
  -- with no alt text is publishing something a blind reader cannot see, and
  -- every platform carries the omission onward. Requiring less of the
  -- University's own noticeboard would be an odd place to draw the line.
  image_path     text,
  image_alt      text,

  -- ---- Authority ---------------------------------------------------------
  --
  -- Three people, potentially three different ones, and each recorded. The
  -- author is NOT NULL: a notice the University cannot attribute is a notice
  -- nobody will answer for.
  author_id      uuid not null references auth.users (id) on delete restrict,
  approved_by    uuid references auth.users (id) on delete restrict,
  approved_at    timestamptz,
  published_by   uuid references auth.users (id) on delete restrict,
  published_at   timestamptz,

  rejected_by    uuid references auth.users (id) on delete restrict,
  rejected_at    timestamptz,
  rejection_reason text,

  retracted_by   uuid references auth.users (id) on delete restrict,
  retracted_at   timestamptz,
  retraction_reason text,

  status         text not null default 'draft'
                   check (status in ('draft', 'submitted', 'approved', 'scheduled',
                                     'published', 'rejected', 'retracted')),

  -- ---- Scheduling --------------------------------------------------------
  --
  -- `publish_at` is an instant, stored as one. The TIMEZONE is kept beside it
  -- because "nine o'clock" is what somebody chose and an instant is not: if the
  -- University schedules a notice for 09:00 Africa/Kampala and the row carries
  -- only the UTC instant, nobody afterwards can say whether 06:00Z was meant as
  -- nine in Kampala or seven in London. It is also what a screen needs to show
  -- the choice back unchanged.
  publish_at     timestamptz,
  publish_timezone text not null default 'Africa/Kampala',

  -- When it stops being current. A notice about a closure still pinned in
  -- March is worse than no notice.
  expires_at     timestamptz,

  pinned         boolean not null default false,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists announcements_status_idx on announcements (status, publish_at);
create index if not exists announcements_published_idx
  on announcements (published_at desc) where status = 'published';

-- ---------------------------------------------------------------------------
-- THE AUTHOR MAY NOT CLEAR THEIR OWN ANNOUNCEMENT.
--
-- Enforced here rather than only in the route, because the route is one caller
-- and this is the rule. 005 requires it of a certificate design, 009 of a
-- grade, 014 of a social post; this is the same separation and the same
-- reason. One person writing, clearing and sending alone is how an
-- unconsidered sentence ends up on six networks under the University's name
-- with nobody having read it first.
--
-- IT APPLIES TO THE SUPERADMINISTRATOR TOO. Holding every capability is not
-- the same as being a second pair of eyes.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'announcements_second_pair_of_eyes') then
    alter table announcements add constraint announcements_second_pair_of_eyes
      check (approved_by is null or approved_by <> author_id);
  end if;

  -- A refusal and a retraction each have to say why. "Rejected" with no reason
  -- is a decision nobody can answer for, and the author cannot fix what they
  -- were not told.
  if not exists (select 1 from pg_constraint where conname = 'announcements_reasons_given') then
    alter table announcements add constraint announcements_reasons_given
      check (
        (status <> 'rejected'
          or (rejection_reason is not null and length(btrim(rejection_reason)) >= 12
              and rejected_by is not null))
        and
        (status <> 'retracted'
          or (retraction_reason is not null and length(btrim(retraction_reason)) >= 12
              and retracted_by is not null))
      );
  end if;

  -- A published announcement has a publisher and a time. Without this, a row
  -- can read `published` with no record of who did it or when — which is the
  -- state the noticeboard was in for every notice it ever carried.
  if not exists (select 1 from pg_constraint where conname = 'announcements_audiences_named') then
    alter table announcements add constraint announcements_audiences_named
      check (
        cardinality(audiences) > 0
        and audiences <@ array['students', 'applicants', 'staff', 'alumni', 'public']::text[]
      );
  end if;

  -- ONLY WHILE THE IMAGE LIVES ON THE ANNOUNCEMENT. 039 moves it into
  -- `announcement_media` — one announcement has more than one photograph — and
  -- drops these two columns, taking this constraint with them. Without the
  -- guard, running the bundle a second time tries to put a constraint back on
  -- a column that is deliberately gone, and stops dead.
  --
  -- THE RULE ITSELF DOES NOT LAPSE: 039 carries it to the new table, where the
  -- alt text column is NOT NULL.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'announcements'
                and column_name = 'image_path')
     and not exists (select 1 from pg_constraint where conname = 'announcements_image_described') then
    alter table announcements add constraint announcements_image_described
      check (image_path is null or (image_alt is not null and length(btrim(image_alt)) >= 3));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'announcements_publication_recorded') then
    alter table announcements add constraint announcements_publication_recorded
      check (status <> 'published'
             or (published_by is not null and published_at is not null));
  end if;
end $$;


-- ===========================================================================
-- 2. WHERE IT WAS PUBLISHED, ONE ROW PER DESTINATION
-- ===========================================================================
--
-- ONE FLAG ON THE ANNOUNCEMENT WOULD BE A LIE. "Published" is true when one
-- network accepted it and five refused, and the person who has to fix it needs
-- to know which. This is the same shape the social pipeline already uses for
-- its targets, deliberately: it is the same question.

create table if not exists announcement_destinations (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements (id) on delete cascade,

  -- 'portal' and 'website' are published by this system. The rest name a
  -- social platform and are published by 013's pipeline.
  destination     text not null check (destination in
                    ('portal', 'website', 'facebook', 'instagram', 'x', 'linkedin', 'youtube')),

  state           text not null default 'pending'
                    check (state in ('pending', 'sending', 'delivered', 'failed',
                                     'skipped', 'retracted')),

  -- THE LINK, AND THE REASON THIS IS NOT A SECOND PUBLISHER. An external
  -- destination is fulfilled by a social post; the delivery is that post's and
  -- is not duplicated here.
  social_post_id  uuid,

  -- Where it landed, so somebody can go and look at it.
  external_url    text,
  -- What went wrong, in the platform's own words.
  error           text,

  delivered_at    timestamptz,
  created_at      timestamptz not null default now(),

  -- One row per destination per announcement. Without this, pressing publish
  -- twice sends two copies to Facebook.
  unique (announcement_id, destination)
);

create index if not exists announcement_destinations_state_idx
  on announcement_destinations (state) where state in ('pending', 'sending', 'failed');

-- The social_post_id is a real reference where the pipeline exists. Added
-- separately so a database that somehow lacks 013 still gets the table.
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'social_posts')
     and not exists (select 1 from pg_constraint
                      where conname = 'announcement_destinations_post_fk') then
    alter table announcement_destinations
      add constraint announcement_destinations_post_fk
      foreign key (social_post_id) references social_posts (id) on delete set null;
  end if;
end $$;


-- ===========================================================================
-- 2b. THE SAME ANNOUNCEMENT, IN EACH PLATFORM'S OWN VOICE
-- ===========================================================================
--
-- THE MASTER IS THE ANNOUNCEMENT; THESE ARE ADAPTATIONS OF IT. The same words
-- do not work everywhere: X takes a fraction of what LinkedIn does, Instagram
-- expects a caption and hashtags under an image, and LinkedIn is read by people
-- assessing the institution professionally. Publishing one block of text to all
-- of them means it was written for one of them and tolerated by the rest.
--
-- A PLATFORM WITH NO VARIANT FALLS BACK TO THE MASTER, deliberately. The
-- alternative — requiring a variant per destination — would mean an urgent
-- notice could not go out until somebody had rewritten it five times. The
-- master is always publishable; a variant is an improvement on it.
--
-- `source` RECORDS WHETHER A PERSON WROTE IT. An assistant draft that nobody
-- read is a different thing from a sentence somebody chose, and the University
-- publishing the first under its own name without knowing which is which is
-- the failure this column exists to prevent. `edited_by` is set when a human
-- changes an assistant draft, which makes it theirs.

create table if not exists announcement_variants (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements (id) on delete cascade,

  platform        text not null check (platform in
                    ('facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'threads')),

  body            text not null,
  hashtags        text[] not null default '{}',

  source          text not null default 'human' check (source in ('human', 'assistant')),
  edited_by       uuid references auth.users (id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One adaptation per platform. Two would mean the system had to choose, and
  -- whichever it chose would be the wrong one half the time.
  unique (announcement_id, platform)
);

create index if not exists announcement_variants_announcement_idx
  on announcement_variants (announcement_id);

alter table announcement_variants enable row level security;

drop policy if exists announcement_variants_read on announcement_variants;
create policy announcement_variants_read on announcement_variants
  for select using (auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office'));


-- ===========================================================================
-- 3. THE HISTORY, WHICH SURVIVES AN EDIT
-- ===========================================================================
--
-- The noticeboard had none. A notice edited after publication simply became a
-- different notice, and what the University had actually said on the Tuesday
-- was gone. This keeps it.
--
-- APPEND-ONLY, ENFORCED. Not by convention, not by nobody having written an
-- UPDATE yet — by a trigger that refuses one. A history that can be edited is
-- a history that will be, on the day somebody wishes it said something else.

create table if not exists announcement_events (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements (id) on delete cascade,

  event           text not null check (event in (
                    'DRAFTED', 'EDITED', 'SUBMITTED_FOR_CLEARANCE', 'APPROVED', 'REJECTED',
                    'SCHEDULED', 'PUBLISHED', 'RETRACTED', 'DESTINATIONS_CHANGED',
                    'RELEASED_EXTERNALLY', 'DESTINATION_DELIVERED', 'DESTINATION_FAILED',
                    'ADMINISTRATIVE_OVERRIDE')),

  actor_id        uuid references auth.users (id) on delete set null,
  actor_email     text,
  actor_role      text,

  previous_state  text,
  new_state       text,

  -- THE TEXT AS IT STOOD. This is what makes the history worth keeping: the
  -- announcement row carries the current wording, and these carry what it said
  -- at each step, so "what did we actually publish on Tuesday" has an answer.
  title_then      text,
  body_then       text,

  detail          text,
  metadata        jsonb,

  at              timestamptz not null default now()
);

create index if not exists announcement_events_announcement_idx
  on announcement_events (announcement_id, at);

create or replace function refuse_announcement_history_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'The announcement history is append-only. % is not permitted: this is the record of what '
    'the University said and when, and a record that can be revised afterwards is not one.',
    tg_op
    using errcode = 'check_violation';
end $$;

drop trigger if exists announcement_events_append_only on announcement_events;
create trigger announcement_events_append_only
  before update or delete on announcement_events
  for each row execute function refuse_announcement_history_edit();


-- ===========================================================================
-- 4. WHO CAN READ AND WRITE
-- ===========================================================================

alter table announcements enable row level security;
alter table announcement_destinations enable row level security;
alter table announcement_events enable row level security;

-- ANYBODY SIGNED IN READS A PUBLISHED ANNOUNCEMENT. That is what publishing
-- means. A draft is visible to its author and to the offices that clear them —
-- a half-written notice about a closure appearing on a student's dashboard is
-- the failure this separation exists to prevent.
drop policy if exists announcements_read on announcements;
create policy announcements_read on announcements
  for select using (
    status = 'published'
    or author_id = auth.uid()
    or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );

drop policy if exists announcement_destinations_read on announcement_destinations;
create policy announcement_destinations_read on announcement_destinations
  for select using (auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office'));

drop policy if exists announcement_events_read on announcement_events;
create policy announcement_events_read on announcement_events
  for select using (auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office'));

-- NO WRITE POLICY ON ANY OF THE THREE, and that is deliberate. Every state
-- change goes through /api/announcements, which checks the capability against
-- the role in the database and writes the history in the same breath. A browser
-- that could update `status` directly could publish without clearing and
-- without leaving a trace, which is the entire arrangement this replaces.


-- ===========================================================================
-- 5. THE CAPABILITIES THIS NEEDS
-- ===========================================================================
--
-- Named here for the reader; the matrix that grants them is src/lib/roles.ts,
-- which is where every other capability in this system lives.
--
--   compose-announcement   write and submit one
--   approve-announcement   clear somebody else's
--   publish-announcement   put a cleared one live, and take it down
--
-- Releasing outward requires 'publish-social-post' AS WELL, on purpose: the
-- new door must not become a way round the authority that already governs the
-- University's outward voice.


-- ===========================================================================
-- 6. THE NOTICES ALREADY ON THE BOARD
-- ===========================================================================
--
-- COPIED, NOT MOVED. The originals stay on `documents` exactly as they are. If
-- this migration is wrong, the cost is running it again rather than the
-- University's noticeboard.
--
-- They arrive as `published`, because they are: they have been on the board.
-- What they cannot have is a clearance, since nobody ever gave one — so
-- `approved_by` stays null and the history says plainly where they came from.
-- Inventing an approver to make the row look tidy would be recording a
-- decision that nobody took.

do $$
declare
  moved integer := 0;
  r record;
  new_id uuid;
  payload jsonb;
  a_title text;
  a_body text;
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'documents') then
    raise notice '038: no documents table, so there is no old noticeboard to copy';
    return;
  end if;

  for r in
    select d.* from documents d
     where d.document_type = 'announcement'
       and not exists (
         select 1 from announcement_events e
          where e.event = 'DRAFTED'
            and e.metadata->>'copied_from_document' = d.id::text
       )
  loop
    -- The body was packed into a data-URL as JSON. Anything that will not
    -- decode is copied as plain text under its document title rather than
    -- dropped: a notice nobody can read is still a notice that was posted.
    begin
      payload := convert_from(
        decode(regexp_replace(r.file_url, '^data:[^,]*,', ''), 'base64'), 'UTF8')::jsonb;
    exception when others then
      payload := null;
    end;

    a_title := coalesce(nullif(btrim(coalesce(payload->>'title', r.file_name)), ''), 'Untitled notice');
    a_body  := coalesce(nullif(btrim(coalesce(payload->>'body', '')), ''),
                        'The text of this notice could not be read from the old noticeboard.');

    -- The new table requires a title of 6 and a body of 20. A notice shorter
    -- than that is padded with a statement of fact rather than refused, because
    -- refusing would mean losing it.
    if length(a_title) < 6 then a_title := a_title || ' (notice)'; end if;
    if length(a_body) < 20 then
      a_body := a_body || E'\n\n(Copied from the previous noticeboard.)';
    end if;

    insert into announcements
      (title, body, audiences, author_id, status, published_by, published_at,
       pinned, created_at)
    values
      (a_title, a_body,
       -- THE OLD BOARD HAD ONE FREE-TEXT AUDIENCE and its words are not this
       -- vocabulary — 'All', 'Lecturers', 'Faculty of Theology'. Mapping them
       -- by guesswork would put notices in front of people they were never
       -- addressed to, so every copied notice is addressed to the audiences
       -- that can already see the portal and the old wording is kept in the
       -- history below rather than translated.
       array['students', 'staff']::text[],
       -- The uploader if there is one. `documents` has no author column in
       -- every deployment, so this falls back to the announcement's own
       -- creator being unknown — and the NOT NULL forces the issue, so a row
       -- with nobody attributable is skipped and reported rather than
       -- attributed to whoever happens to run this.
       coalesce(r.student_id, null),
       'published', null, r.uploaded_at,
       coalesce((payload->>'pinned')::boolean, false),
       r.uploaded_at)
    returning id into new_id;

    insert into announcement_destinations (announcement_id, destination, state, delivered_at)
    values (new_id, 'portal', 'delivered', r.uploaded_at);

    insert into announcement_events
      (announcement_id, event, new_state, title_then, body_then, detail, metadata, at)
    values
      (new_id, 'DRAFTED', 'published', a_title, a_body,
       'Copied from the previous noticeboard, where it was stored as a document. It was '
       || 'published without a recorded clearance because the old page had none.',
       jsonb_build_object('copied_from_document', r.id), r.uploaded_at);

    moved := moved + 1;
  end loop;

  raise notice '038: % notice(s) copied from the old noticeboard', moved;
exception when not_null_violation then
  -- The author is NOT NULL and the old rows may not name one. Reported rather
  -- than worked around: a notice the University cannot attribute is exactly
  -- what this migration exists to stop, and inventing an author to get the
  -- copy through would be the first thing it did wrong.
  raise notice '038: the old noticeboard has notices with no identifiable author. They were '
               'left where they are; see the verify at the foot.';
end $$;


-- ===========================================================================
-- 7. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  someone uuid;
begin
  select id into someone from auth.users limit 1;
  if someone is null then
    raise notice '038: no accounts yet, so the rules could not be exercised against one';
    return;
  end if;

  -- EVERYTHING BELOW ROLLS BACK. It has to: the history trigger refuses a
  -- DELETE, including the one a cascade from `announcements` would perform, so
  -- a proof announcement with any history cannot be tidied away afterwards.
  --
  -- That is not an inconvenience to work around, it is the rule working. An
  -- announcement the University has acted on cannot be deleted, by anybody,
  -- ever — it is retracted instead, and the record stands. The proof therefore
  -- does its work inside a savepoint and undoes it.
  begin

  insert into announcements (title, body, author_id, status, audiences)
  values ('Proof 038 announcement', 'A body long enough to satisfy the constraint on length.',
          someone, 'draft', array['staff']::text[])
  returning id into a_id;

  -- ---- THE AUTHOR CANNOT CLEAR THEIR OWN ---------------------------------
  -- The rule the whole arrangement rests on. Watched refusing.
  refused := false;
  begin
    update announcements set status = 'approved', approved_by = someone, approved_at = now()
     where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: an author cleared their own announcement. The second pair of '
                    'eyes is not a rule, it is a comment.';
  end if;

  -- ---- A REFUSAL HAS TO SAY WHY ------------------------------------------
  refused := false;
  begin
    update announcements set status = 'rejected' where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: an announcement was rejected with no reason and no rejector';
  end if;

  -- ---- A PUBLICATION RECORDS WHO AND WHEN --------------------------------
  refused := false;
  begin
    update announcements set status = 'published' where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: an announcement was published with nobody recorded as having '
                    'published it';
  end if;

  -- ---- AN ANNOUNCEMENT IS ADDRESSED TO SOMEBODY --------------------------
  refused := false;
  begin
    update announcements set audiences = '{}'::text[] where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: an announcement was addressed to nobody at all';
  end if;

  refused := false;
  begin
    update announcements set audiences = array['everyone_everywhere']::text[] where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: an audience nobody declared was accepted';
  end if;

  -- ---- AN IMAGE IS DESCRIBED ---------------------------------------------
  --
  -- ONLY WHILE THE IMAGE LIVES ON THE ANNOUNCEMENT. 039 moves it into
  -- `announcement_media` and drops these columns, because one announcement has
  -- more than one photograph — and it carries the same rule there, on a NOT
  -- NULL column. Running the bundle a second time used to stop dead here,
  -- proving a rule about a column that no longer existed.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'announcements'
                and column_name = 'image_path') then
    refused := false;
    begin
      execute 'update announcements set image_path = ''announcements/x.jpg'' where id = $1'
        using a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '038 FAILED: an image was attached with no alt text, which every network '
                      'this is published to would carry onward';
    end if;
  end if;

  -- ---- ONE ADAPTATION PER PLATFORM ---------------------------------------
  -- Two would mean the system had to choose between them, and whichever it
  -- chose would be the wrong one half the time.
  insert into announcement_variants (announcement_id, platform, body)
  values (a_id, 'x', 'Short version.');
  refused := false;
  begin
    insert into announcement_variants (announcement_id, platform, body)
    values (a_id, 'x', 'A different short version.');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: two adaptations were stored for one platform, so which one '
                    'gets published is a coin toss';
  end if;

  -- ---- AND IT SAYS WHETHER A PERSON WROTE IT -----------------------------
  refused := false;
  begin
    update announcement_variants set source = 'somewhere_else'
     where announcement_id = a_id and platform = 'x';
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: a variant could claim an origin nobody declared. Whether the '
                    'University wrote a sentence or merely accepted one is not optional.';
  end if;

  -- ---- THE HISTORY CANNOT BE REWRITTEN -----------------------------------
  insert into announcement_events (announcement_id, event, new_state, detail)
  values (a_id, 'DRAFTED', 'draft', 'Proof');

  refused := false;
  begin
    update announcement_events set detail = 'something else' where announcement_id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: the announcement history could be edited';
  end if;

  refused := false;
  begin
    delete from announcement_events where announcement_id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: the announcement history could be deleted';
  end if;

  -- ---- ONE DESTINATION ROW PER DESTINATION -------------------------------
  -- Without this, pressing publish twice sends two copies to Facebook.
  insert into announcement_destinations (announcement_id, destination) values (a_id, 'facebook');
  refused := false;
  begin
    insert into announcement_destinations (announcement_id, destination) values (a_id, 'facebook');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: the same destination could be added twice, so an announcement '
                    'could be published to one network twice over';
  end if;

  -- AND AN ANNOUNCEMENT WITH HISTORY CANNOT BE DELETED AT ALL.
  -- The cascade from the parent is still a DELETE on the events, and the
  -- trigger does not care who asked. Worth watching, because it is the
  -- strongest thing this migration does and it is easy to assume a cascade is
  -- exempt.
  refused := false;
  begin
    delete from announcements where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: an announcement with a history was deleted outright. '
                    'Retraction is the only way something published comes down.';
  end if;

  raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '038 OK: an author cannot clear their own notice, a refusal states a reason, a '
               'publication names its publisher, the history cannot be rewritten and a '
               'destination cannot be added twice, an announcement is addressed to a real '
               'audience, an image is described, one adaptation is kept per platform and it '
               'says who wrote it, and a notice with a history cannot be deleted at all';
end $$;


-- ===========================================================================
-- 8. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- What is on the board now, by state.
select status, count(*) as announcements
  from announcements
 group by status
 order by count(*) desc;

-- Where published announcements actually reached.
select d.destination, d.state, count(*) as rows
  from announcement_destinations d
 group by d.destination, d.state
 order by d.destination, d.state;

-- NOTICES THAT COULD NOT BE COPIED. Each of these is a notice on the old board
-- that names nobody, so the new table — which requires an author — will not
-- take it. They are still on `documents` and still readable; decide whether
-- each is worth re-posting under a named author.
select d.id, d.file_name, d.uploaded_at
  from documents d
 where d.document_type = 'announcement'
   and not exists (
     select 1 from announcement_events e
      where e.event = 'DRAFTED' and e.metadata->>'copied_from_document' = d.id::text
   )
 order by d.uploaded_at desc;

-- THE ADAPTATIONS, and which platforms fall back to the master. A platform
-- with no row here is published the master text, which is always allowed —
-- but it is worth seeing which ones.
select a.title,
       v.platform,
       v.source,
       length(v.body) as characters,
       cardinality(v.hashtags) as hashtags
  from announcements a
  join announcement_variants v on v.announcement_id = a.id
 order by a.created_at desc, v.platform;

-- The append-only guard is actually attached.
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'announcement_events'::regclass and not tgisinternal;


-- ===========================================================================
-- ===========================================================================
--
--   039_a_destination_is_a_publishing_job.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 039 — A DESTINATION IS A PUBLISHING JOB, AND IT KEEPS ITS OWN RECEIPT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A destination stops being a state and becomes a job. It gains the
--    platform's own post id, its own scheduled time, a retry count and the time
--    of the last attempt — so "Instagram published, LinkedIn failed, X is
--    scheduled for Saturday" is a thing the row can say rather than a thing
--    somebody works out.
--
-- 2. THE FEATURED IMAGE COLUMNS ARE DROPPED and replaced by a media table.
--    `announcements.image_path` and `image_alt` held exactly one picture, and
--    an announcement about a graduation has more than one. Anything already in
--    them is copied across first, as the first item, so nothing is lost.
--
-- 3. Engagement figures get somewhere to live, and NOTHING IS WRITTEN INTO IT.
--    See section 4 — the table exists, the collection does not, and a
--    communications dashboard showing zeros would be worse than one showing
--    nothing at all.
--
-- ---------------------------------------------------------------------------
-- WHAT ALREADY EXISTED AND IS NOT REBUILT HERE
-- ---------------------------------------------------------------------------
--
-- The connections themselves. 013 built `social_accounts` — per platform, with
-- the University's own scope separate from a person's, the OAuth scopes stored,
-- and the access and refresh tokens held in 017's sealed store with only a
-- POINTER on the row. No social media password is stored anywhere in this
-- system and none can be: there is no column for one.
--
-- The scopes 013's provider registry already names are the ones publishing
-- actually requires — `w_organization_social` for LinkedIn, `tweet.write` for
-- X, `pages_manage_posts` for a Facebook Page — and the screen that connects
-- them is already mounted under Settings.
-- ===========================================================================


-- ===========================================================================
-- 1. THE DESTINATION AS A JOB
-- ===========================================================================

alter table announcement_destinations
  -- THE PLATFORM'S OWN ID, which is a different thing from ours. `social_post_id`
  -- points at the post inside this system; this is what Facebook or LinkedIn
  -- called it. Without it there is no way to fetch engagement for this
  -- announcement, no way to delete the right post when something is retracted,
  -- and no way to prove the publication happened at all.
  add column if not exists platform_post_id text,

  -- PER DESTINATION, NOT PER ANNOUNCEMENT. The portal now and X on Saturday
  -- morning is a real thing a communications office wants, and an announcement
  -- with one scheduled time cannot express it.
  add column if not exists scheduled_for   timestamptz,

  -- HOW MANY TIMES THIS HAS BEEN TRIED. A destination that has failed eleven
  -- times is not the same as one that has failed once, and the difference
  -- decides whether somebody retries it or goes and looks at the connection.
  add column if not exists retry_count     integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

do $$
begin
  -- A retry count cannot run backwards, and a destination that has been tried
  -- has a time it was tried at. Both are the kind of thing that stays true
  -- until one piece of code updates the count without the timestamp.
  if not exists (select 1 from pg_constraint where conname = 'announcement_destinations_attempts') then
    alter table announcement_destinations add constraint announcement_destinations_attempts
      check (retry_count >= 0 and (retry_count = 0 or last_attempt_at is not null));
  end if;

  -- A DELIVERED DESTINATION SAYS WHERE IT LANDED. Not for tidiness: without
  -- the platform's id or a URL, "published to LinkedIn" is a claim with
  -- nothing behind it, and the first person to ask "where?" cannot be answered.
  -- The portal is exempt, because the portal is this system and the
  -- announcement's own id is where it landed.
  if not exists (select 1 from pg_constraint where conname = 'announcement_destinations_receipt') then
    alter table announcement_destinations add constraint announcement_destinations_receipt
      check (
        state <> 'delivered'
        or destination in ('portal', 'website')
        or platform_post_id is not null
        or external_url is not null
      );
  end if;
end $$;

create index if not exists announcement_destinations_due_idx
  on announcement_destinations (scheduled_for)
  where state = 'pending' and scheduled_for is not null;

comment on column announcement_destinations.platform_post_id is
  'What the platform called this post. Needed to fetch engagement, to remove the '
  'right post on a retraction, and to show that the publication happened.';


-- ===========================================================================
-- 2. THE MEDIA, WHICH IS MORE THAN ONE PICTURE
-- ===========================================================================
--
-- ALT TEXT IS NOT NULL, exactly as 013 made it for social media, and for the
-- reason given there: a prospective student using a screen reader is exactly
-- the reader the institution is addressing, and a graduation photograph that
-- reaches them as "image" has excluded them from the announcement. Every
-- platform this is published to carries the omission onward.

create table if not exists announcement_media (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements (id) on delete cascade,

  storage_path    text not null,
  kind            text not null default 'image' check (kind in ('image', 'video')),
  alt_text        text not null check (length(btrim(alt_text)) >= 3),

  -- 0 is the featured item — the one a card shows and the one a platform that
  -- accepts a single image is given.
  ordinal         integer not null default 0 check (ordinal >= 0),

  created_at      timestamptz not null default now(),

  unique (announcement_id, ordinal)
);

create index if not exists announcement_media_announcement_idx
  on announcement_media (announcement_id, ordinal);

alter table announcement_media enable row level security;

drop policy if exists announcement_media_read on announcement_media;
create policy announcement_media_read on announcement_media
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
    or exists (select 1 from announcements a
                where a.id = announcement_media.announcement_id and a.status = 'published')
  );

-- The one image the old columns held, moved rather than abandoned.
do $$
declare
  moved integer := 0;
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'announcements'
                and column_name = 'image_path') then
    insert into announcement_media (announcement_id, storage_path, alt_text, ordinal)
    select a.id, a.image_path, coalesce(nullif(btrim(a.image_alt), ''), 'Image'), 0
      from announcements a
     where a.image_path is not null
       and not exists (select 1 from announcement_media m where m.announcement_id = a.id);
    get diagnostics moved = row_count;

    -- DROPPED, so there is one place an announcement's pictures live. Two
    -- would disagree within a month of somebody adding a second image.
    alter table announcements drop column if exists image_path;
    alter table announcements drop column if exists image_alt;
  end if;
  raise notice '039: % featured image(s) moved into the media table', moved;
end $$;


-- ===========================================================================
-- 3. WHAT WAS PUBLISHED, WORD FOR WORD, AT EACH VERSION
-- ===========================================================================
--
-- 038's `announcement_events` already carries `title_then` and `body_then`, so
-- the wording at every step is kept. What it cannot answer is "which version
-- went to LinkedIn" once an announcement has been edited and republished —
-- because the event says what the master said, and LinkedIn received an
-- adaptation of it.
--
-- So a destination records the exact text it was sent. Not a reference to a
-- variant that may since have been rewritten: THE TEXT. This is the only thing
-- in the system that can answer "what does our LinkedIn post actually say"
-- without asking LinkedIn.

alter table announcement_destinations
  add column if not exists published_text text;

comment on column announcement_destinations.published_text is
  'The exact words sent to this destination, kept because a variant can be '
  'rewritten afterwards and a published post cannot.';


-- ===========================================================================
-- 4. ENGAGEMENT — A PLACE FOR IT, AND NOTHING IN IT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- READ THIS BEFORE BUILDING A DASHBOARD ON IT
-- ---------------------------------------------------------------------------
--
-- This table is created empty and NOTHING IN THIS SYSTEM WRITES TO IT YET.
-- Collecting engagement means calling each platform's own API with the
-- University's connected credentials — LinkedIn's organization statistics, the
-- Meta Graph insights, X's post metrics — and that code does not exist.
--
-- The table is here so the shape is settled before anybody writes it, and so
-- the screen can say "not collected" rather than showing a zero. A zero and an
-- unknown look identical on a dashboard and mean completely different things:
-- one says nobody engaged and the other says nobody asked. An institution that
-- reports the first when the second is true is publishing a figure about itself
-- that it made up.
--
-- ---------------------------------------------------------------------------
-- WHY EACH ROW IS ONE MEASUREMENT AND NOT ONE COLUMN PER METRIC
-- ---------------------------------------------------------------------------
--
-- Because the metrics differ per platform and change without notice. A table
-- with `reach`, `reactions`, `impressions`, `reposts`, `views` has a column for
-- every platform's vocabulary and nulls everywhere else, and gains a migration
-- every time a network renames something. And because a metric is a reading at
-- a MOMENT: reach on the day is not reach a week later, and a single number
-- overwritten each time destroys the only interesting thing about it.

create table if not exists announcement_metrics (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references announcement_destinations (id) on delete cascade,

  -- The platform's own name for it, lowercased: 'reach', 'impressions',
  -- 'reactions', 'likes', 'comments', 'shares', 'reposts', 'views', 'clicks'.
  -- NOT a closed vocabulary, on purpose: a CHECK constraint here would mean a
  -- migration every time a network invents a metric, and the cost of an unknown
  -- metric name is that a screen does not know how to label it.
  metric         text not null check (length(btrim(metric)) > 0),
  value          bigint not null check (value >= 0),

  -- WHEN THIS WAS TRUE, which is not when it was written. A reading taken at
  -- noon and stored at midnight is a reading from noon.
  measured_at    timestamptz not null,
  collected_at   timestamptz not null default now(),

  -- Which reading this is, so a chart can be drawn and a correction does not
  -- overwrite the thing it corrects.
  unique (destination_id, metric, measured_at)
);

create index if not exists announcement_metrics_destination_idx
  on announcement_metrics (destination_id, metric, measured_at desc);

alter table announcement_metrics enable row level security;

drop policy if exists announcement_metrics_read on announcement_metrics;
create policy announcement_metrics_read on announcement_metrics
  for select using (auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office'));

-- No write policy. Figures about the University's own reach are written by the
-- collector running as the service role, never by a browser — a number about
-- the institution that somebody could type is not a measurement.

-- The most recent reading of each metric, which is what a dashboard wants and
-- what it would otherwise compute wrongly.
create or replace view announcement_engagement
with (security_invoker = true) as
select distinct on (m.destination_id, m.metric)
       d.announcement_id,
       d.destination,
       m.metric,
       m.value,
       m.measured_at
  from announcement_metrics m
  join announcement_destinations d on d.id = m.destination_id
 order by m.destination_id, m.metric, m.measured_at desc;


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  d_id uuid;
  someone uuid;
begin
  select id into someone from auth.users limit 1;
  if someone is null then
    raise notice '039: no accounts yet, so the rules could not be exercised against one';
    return;
  end if;

  begin
    insert into announcements (title, body, author_id, status, audiences)
    values ('Proof 039 announcement', 'A body long enough to satisfy the length constraint.',
            someone, 'draft', array['staff']::text[])
    returning id into a_id;

    insert into announcement_destinations (announcement_id, destination)
    values (a_id, 'linkedin') returning id into d_id;

    -- ---- A DELIVERED DESTINATION SAYS WHERE IT LANDED --------------------
    -- "Published to LinkedIn" with nothing behind it cannot be answered when
    -- somebody asks "where?".
    refused := false;
    begin
      update announcement_destinations set state = 'delivered' where id = d_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '039 FAILED: a destination was marked delivered with no platform post id '
                      'and no URL, so the publication cannot be shown to anybody';
    end if;

    -- …and with one, it is accepted.
    update announcement_destinations
       set state = 'delivered', platform_post_id = 'urn:li:share:12345'
     where id = d_id;

    -- The portal is exempt, because the portal is this system.
    insert into announcement_destinations (announcement_id, destination, state)
    values (a_id, 'portal', 'delivered');

    -- ---- A RETRY COUNT IMPLIES AN ATTEMPT --------------------------------
    refused := false;
    begin
      update announcement_destinations set retry_count = 3 where id = d_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '039 FAILED: a destination was tried three times at no particular time';
    end if;

    -- ---- MEDIA IS DESCRIBED ----------------------------------------------
    refused := false;
    begin
      insert into announcement_media (announcement_id, storage_path, alt_text)
      values (a_id, 'a/b.jpg', '');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '039 FAILED: an image was stored with no description, and every network '
                      'this is published to would carry that omission onward';
    end if;

    insert into announcement_media (announcement_id, storage_path, alt_text, ordinal)
    values (a_id, 'a/b.jpg', 'Graduands on the steps of the main hall', 0);

    -- ---- ONE FEATURED ITEM -----------------------------------------------
    refused := false;
    begin
      insert into announcement_media (announcement_id, storage_path, alt_text, ordinal)
      values (a_id, 'a/c.jpg', 'A different photograph', 0);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '039 FAILED: two images claimed to be the featured one, so which a card '
                      'shows is a coin toss';
    end if;

    -- ---- A MEASUREMENT IS A READING AT A MOMENT ---------------------------
    insert into announcement_metrics (destination_id, metric, value, measured_at)
    values (d_id, 'impressions', 100, now() - interval '1 day');
    insert into announcement_metrics (destination_id, metric, value, measured_at)
    values (d_id, 'impressions', 400, now());

    if (select count(*) from announcement_metrics where destination_id = d_id) <> 2 then
      raise exception '039 FAILED: the later reading replaced the earlier one instead of '
                      'joining it, so the only interesting thing about a metric is gone';
    end if;
    if (select value from announcement_engagement
         where destination = 'linkedin' and metric = 'impressions') <> 400 then
      raise exception '039 FAILED: the engagement view did not return the most recent reading';
    end if;

    -- A negative reading is not a reading.
    refused := false;
    begin
      insert into announcement_metrics (destination_id, metric, value, measured_at)
      values (d_id, 'likes', -5, now());
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '039 FAILED: a negative engagement figure was accepted';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '039 OK: a delivered destination shows where it landed, a retry count implies an '
               'attempt, media is described and has one featured item, and a measurement is a '
               'reading at a moment rather than a number that overwrites itself';
end $$;

-- AND THE ENGAGEMENT TABLE IS EMPTY, which is the honest state until somebody
-- writes the collector. A dashboard built on this must say "not collected"
-- rather than "0" — they look identical and mean opposite things.
do $$
declare
  n integer;
begin
  select count(*) into n from announcement_metrics;
  if n = 0 then
    raise notice '039: no engagement has been collected. Nothing writes to '
                 'announcement_metrics yet — the collector for each platform''s API is not '
                 'built, and a screen must say so rather than show zeros.';
  else
    raise notice '039: % engagement reading(s) already collected', n;
  end if;
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- The publishing board: every destination of every announcement, as a job.
select a.title,
       d.destination,
       d.state,
       d.retry_count,
       d.scheduled_for,
       coalesce(d.platform_post_id, d.external_url) as receipt,
       left(coalesce(d.error, ''), 80) as error
  from announcements a
  join announcement_destinations d on d.announcement_id = a.id
 order by a.created_at desc, d.destination;

-- DESTINATIONS THAT NEED A PERSON. Failed, or tried more than twice.
select a.title, d.destination, d.retry_count, d.last_attempt_at, d.error
  from announcement_destinations d
  join announcements a on a.id = d.announcement_id
 where d.state = 'failed' or d.retry_count > 2
 order by d.retry_count desc;

-- Anything due to go out.
select a.title, d.destination, d.scheduled_for
  from announcement_destinations d
  join announcements a on a.id = d.announcement_id
 where d.state = 'pending' and d.scheduled_for is not null
 order by d.scheduled_for;

-- Engagement, latest reading per metric. Empty until a collector exists.
select * from announcement_engagement order by announcement_id, destination, metric;

-- The connected accounts publishing depends on, and whether each is usable.
-- Nothing here is a password: 013 keeps a POINTER to the token in 017's store.
select platform, scope, handle, status, token_expires_at, cardinality(scopes) as scopes_granted
  from social_accounts
 where scope = 'university'
 order by platform;

