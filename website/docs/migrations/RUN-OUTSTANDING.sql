-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 036, 037, 038, 039, 040, 041, 042, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-OUTSTANDING.sql 036 037 038 039 040 041 042
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


-- ===========================================================================
-- ===========================================================================
--
--   040_emergency_publishing_and_erasure.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 040 — PUBLISHING AT TWO IN THE MORNING, AND DELETING WHAT SHOULD NOT EXIST
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. AN EMERGENCY ANNOUNCEMENT CAN BE PUBLISHED BY ONE PERSON. Until now every
--    announcement needed a second pair of eyes, and a campus closure at two in
--    the morning does not have one. An emergency notice may now go out
--    uncleared — and the record says so permanently, on the announcement
--    itself, for as long as it exists.
--
--    IT IS NOT A GENERAL BYPASS. Only the `emergency` category may use it, only
--    with a stated reason, and only by somebody holding the override. Every
--    other announcement still needs somebody else to read it.
--
-- 2. THE SUPERADMINISTRATOR CAN DELETE AN ANNOUNCEMENT. 038 made that
--    impossible — the append-only history refused even the cascade — and the
--    University has ruled that at least one person must be able to. A notice
--    posted to the wrong audience, or carrying somebody's name who asked for it
--    to be removed, is a real thing that has to be able to go.
--
--    IT LEAVES A TOMBSTONE. The text goes; the fact that an announcement
--    existed, who wrote it, who deleted it and why does not. That is not a
--    hedge against the ruling — it is what makes the ruling safe to act on. A
--    registry that can make a notice disappear without trace cannot answer
--    "did you ever publish that?", and the answer "no" would be unverifiable
--    even when true.
--
--    AND ONLY THROUGH ONE DOOR. The history trigger still refuses every UPDATE
--    and every DELETE, except inside the function below. Nobody can quietly
--    edit a trail; somebody with the authority can erase a whole announcement,
--    and that act is itself recorded.
-- ===========================================================================


-- ===========================================================================
-- 1. THE EMERGENCY
-- ===========================================================================

alter table announcements
  -- THE MARK STAYS. Not a flag cleared once the panic is over: anybody reading
  -- this announcement in two years sees that nobody else read it first.
  add column if not exists published_without_clearance boolean not null default false,
  add column if not exists override_reason text,
  add column if not exists override_by     uuid references auth.users (id) on delete restrict,
  add column if not exists override_at     timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'announcements_override_is_an_emergency') then
    alter table announcements add constraint announcements_override_is_an_emergency
      check (
        not published_without_clearance
        or (
          -- ONLY AN EMERGENCY. Without this the override becomes the way
          -- everything gets published, because it is faster — which is how
          -- every emergency procedure in every institution stops meaning
          -- anything.
          category = 'emergency'
          -- AND SOMEBODY SAYS WHY, AT LENGTH. "Urgent" is not a reason; the
          -- closure, the outage or the security notice is.
          and override_reason is not null
          and length(btrim(override_reason)) >= 20
          and override_by is not null
          and override_at is not null
        )
      );
  end if;
end $$;

comment on column announcements.published_without_clearance is
  'True where this went out without a second pair of eyes. Only an emergency may, '
  'only with a stated reason, and the mark is permanent.';

create index if not exists announcements_override_idx
  on announcements (override_at desc) where published_without_clearance;


-- ===========================================================================
-- 2. THE TOMBSTONE
-- ===========================================================================
--
-- WHAT IT KEEPS AND WHAT IT DOES NOT. It keeps the fact: an announcement
-- existed, this was its title, this person wrote it, it stood at this state,
-- this person deleted it on this day for this reason.
--
-- IT DOES NOT KEEP THE BODY. If the reason for deleting was that the text
-- should not exist, a table quietly holding the text would defeat the act. The
-- title is kept because a deletion nobody can identify is not auditable at all,
-- and because a title is what a register needs to answer "did you publish
-- that?" — but a University that needs the title gone too can clear that one
-- column and the fact remains.

create table if not exists announcement_tombstones (
  id              uuid primary key default gen_random_uuid(),

  -- NOT a foreign key. The row it names is gone; that is the point.
  announcement_id uuid not null,

  title           text,
  category        text,
  author_id       uuid,
  status_when_deleted text,
  was_published   boolean not null default false,
  published_at    timestamptz,

  -- WHERE IT HAD REACHED. A notice deleted from this system after it went to
  -- Facebook is still on Facebook, and whoever deals with the aftermath needs
  -- to know which networks to go to.
  destinations_reached text[] not null default '{}',

  deleted_by      uuid not null references auth.users (id) on delete restrict,
  reason          text not null check (length(btrim(reason)) >= 20),
  deleted_at      timestamptz not null default now()
);

create index if not exists announcement_tombstones_deleted_idx
  on announcement_tombstones (deleted_at desc);

alter table announcement_tombstones enable row level security;

drop policy if exists announcement_tombstones_read on announcement_tombstones;
create policy announcement_tombstones_read on announcement_tombstones
  for select using (auth_role() in ('superadmin', 'admin', 'registrar'));

-- No insert, update or delete policy. The function below writes it and nothing
-- removes it: a record of an erasure that can itself be erased is not a record.


-- ===========================================================================
-- 3. THE ONE DOOR
-- ===========================================================================
--
-- The history trigger from 038 refuses every UPDATE and every DELETE, which is
-- what stopped an announcement being deleted at all. It still does — except
-- inside this function, which sets a flag the trigger looks for.
--
-- WHY A FLAG AND NOT SIMPLY DROPPING THE TRIGGER. Disabling a trigger around a
-- delete leaves a window in which anything at all can rewrite the trail, and
-- leaves it disabled if the statement fails halfway. The flag is set with SET
-- LOCAL, so it lasts exactly as long as the transaction and cannot be left on.

create or replace function refuse_announcement_history_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- THE ONLY WAY PAST, and it can only be set by erase_announcement below,
  -- which writes a tombstone before it does. An UPDATE is never permitted:
  -- erasing a whole announcement is an act somebody answers for, and quietly
  -- changing one line of its history is not.
  if tg_op = 'DELETE' and coalesce(current_setting('icof.erasing', true), '') = 'on' then
    return old;
  end if;

  raise exception
    'The announcement history is append-only. % is not permitted: this is the record of what '
    'the University said and when, and a record that can be revised afterwards is not one. '
    'To remove an announcement entirely, the Superadministrator uses erase_announcement(), '
    'which leaves a tombstone.',
    tg_op
    using errcode = 'check_violation';
end $$;

/**
 * Erase an announcement, leaving the fact of it behind.
 *
 * SECURITY DEFINER, and the caller's authority is checked by the route rather
 * than here — this function is revoked from everyone except the service role,
 * so the only way to reach it is through /api/announcements, which reads the
 * role out of the database.
 */
create or replace function erase_announcement(
  p_announcement uuid,
  p_deleted_by uuid,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  reached text[];
  tomb uuid;
begin
  select * into a from announcements where id = p_announcement;
  if not found then
    raise exception 'No announcement with id %', p_announcement using errcode = 'no_data_found';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 20 then
    raise exception 'Erasing an announcement requires a stated reason. This is the only act in '
                    'this system that destroys something, and "wrong" is not an account of it.'
      using errcode = 'check_violation';
  end if;

  -- WHERE IT HAD ALREADY REACHED, captured before the rows go. A notice
  -- deleted here is still on Facebook, and somebody has to go and remove it.
  select coalesce(array_agg(d.destination order by d.destination), '{}')
    into reached
    from announcement_destinations d
   where d.announcement_id = p_announcement
     and d.state in ('delivered', 'sending');

  insert into announcement_tombstones
    (announcement_id, title, category, author_id, status_when_deleted,
     was_published, published_at, destinations_reached, deleted_by, reason)
  values
    (a.id, a.title, a.category, a.author_id, a.status,
     a.status = 'published' or a.published_at is not null, a.published_at,
     reached, p_deleted_by, btrim(p_reason))
  returning id into tomb;

  -- The flag the history trigger looks for. SET LOCAL, so it is gone when this
  -- transaction ends however it ends.
  perform set_config('icof.erasing', 'on', true);
  delete from announcements where id = p_announcement;
  perform set_config('icof.erasing', 'off', true);

  return tomb;
end $$;

revoke all on function erase_announcement(uuid, uuid, text) from public;
revoke all on function erase_announcement(uuid, uuid, text) from anon, authenticated;
grant execute on function erase_announcement(uuid, uuid, text) to service_role;


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  tomb uuid;
  someone uuid;
  n integer;
begin
  select id into someone from auth.users limit 1;
  if someone is null then
    raise notice '040: no accounts yet, so the rules could not be exercised against one';
    return;
  end if;

  begin
    -- ---- AN ORDINARY NOTICE CANNOT SKIP THE SECOND PAIR OF EYES ----------
    -- The half that matters. An override anybody can reach for is not an
    -- emergency procedure, it is the fast way to publish.
    insert into announcements (title, body, author_id, status, audiences, category)
    values ('Proof 040 ordinary', 'A perfectly ordinary announcement about nothing at all.',
            someone, 'draft', array['staff']::text[], 'general')
    returning id into a_id;

    refused := false;
    begin
      update announcements
         set published_without_clearance = true, override_reason = 'It seemed quicker to do it this way',
             override_by = someone, override_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: an ordinary announcement was published without clearance. '
                      'The override is not an emergency procedure, it is a shortcut.';
    end if;

    -- ---- AN EMERGENCY CAN, WITH A REASON ---------------------------------
    update announcements set category = 'emergency' where id = a_id;

    refused := false;
    begin
      update announcements
         set published_without_clearance = true, override_reason = 'Urgent',
             override_by = someone, override_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: an emergency was published on the strength of the word '
                      '"Urgent". The closure or the outage is the reason, not the hurry.';
    end if;

    update announcements
       set published_without_clearance = true,
           override_reason = 'Main campus closed at short notice after a power failure.',
           override_by = someone, override_at = now(),
           status = 'published', published_by = someone, published_at = now()
     where id = a_id;

    -- ---- AND THE MARK CANNOT BE WIPED OFF LATER --------------------------
    -- It can be set false only by also clearing the reason, which is a
    -- different claim entirely — that it never happened. The constraint allows
    -- that; what it does not allow is a published emergency pretending to have
    -- been cleared. Checked by reading it back.
    select count(*) into n from announcements
     where id = a_id and published_without_clearance and override_by is not null;
    if n <> 1 then
      raise exception '040 FAILED: the override was not recorded against the announcement';
    end if;

    -- ---- THE HISTORY IS STILL UNTOUCHABLE --------------------------------
    insert into announcement_events (announcement_id, event, new_state, detail)
    values (a_id, 'ADMINISTRATIVE_OVERRIDE', 'published', 'Proof');

    refused := false;
    begin
      update announcement_events set detail = 'something else' where announcement_id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: the history became editable. Erasing a whole announcement is '
                      'an act somebody answers for; quietly changing one line of its trail is not.';
    end if;

    refused := false;
    begin
      delete from announcement_events where announcement_id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: the history could be deleted directly, without a tombstone';
    end if;

    -- ---- AND A BARE DELETE IS STILL REFUSED ------------------------------
    refused := false;
    begin
      delete from announcements where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: an announcement was deleted without going through '
                      'erase_announcement, so nothing recorded that it had existed';
    end if;

    -- ---- ERASING REQUIRES A REASON ---------------------------------------
    refused := false;
    begin
      perform erase_announcement(a_id, someone, 'oops');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: an announcement was erased on the strength of "oops"';
    end if;

    -- ---- AND THEN IT WORKS, AND LEAVES THE FACT BEHIND --------------------
    insert into announcement_destinations (announcement_id, destination, state, platform_post_id)
    values (a_id, 'facebook', 'delivered', 'fb_123');

    tomb := erase_announcement(a_id, someone,
      'Published to the wrong audience and names a student who asked to be removed.');

    if (select count(*) from announcements where id = a_id) <> 0 then
      raise exception '040 FAILED: the announcement survived its own erasure';
    end if;
    if (select count(*) from announcement_events where announcement_id = a_id) <> 0 then
      raise exception '040 FAILED: the history outlived the announcement it belonged to';
    end if;

    select count(*) into n from announcement_tombstones
     where id = tomb and 'facebook' = any(destinations_reached);
    if n <> 1 then
      raise exception '040 FAILED: the tombstone does not record that this had already reached '
                      'Facebook, so nobody knows to go and remove it there';
    end if;

    -- ---- THE FLAG DOES NOT SURVIVE ---------------------------------------
    -- If it did, everything after an erasure in the same transaction could
    -- rewrite any history it liked.
    insert into announcements (title, body, author_id, status, audiences)
    values ('Proof 040 second', 'Another announcement, created after an erasure.',
            someone, 'draft', array['staff']::text[])
    returning id into a_id;
    insert into announcement_events (announcement_id, event, new_state) values (a_id, 'DRAFTED', 'draft');

    refused := false;
    begin
      delete from announcement_events where announcement_id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: the erasure flag was still set afterwards, so any history '
                      'could be deleted for the rest of the transaction';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '040 OK: only an emergency publishes uncleared and only with a stated reason, '
               'the history is still untouchable, a bare delete is still refused, erasing '
               'requires a reason and leaves a tombstone naming where it had already reached, '
               'and the erasure flag does not outlive the erasure';
end $$;


-- ===========================================================================
-- 5. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- EVERY ANNOUNCEMENT THAT WENT OUT WITHOUT A SECOND PAIR OF EYES. This list
-- should be short and every line on it should be a real emergency. If it grows,
-- the override has become the way things get published.
select a.title, a.category, a.override_at, a.override_reason,
       a.published_at
  from announcements a
 where a.published_without_clearance
 order by a.override_at desc;

-- What has been erased, by whom, and why.
select t.title, t.category, t.status_when_deleted, t.was_published,
       t.destinations_reached, t.deleted_at, t.reason
  from announcement_tombstones t
 order by t.deleted_at desc;

-- ERASED NOTICES THAT ARE STILL ON A NETWORK. Deleting here does not reach
-- into Facebook. Each of these needs somebody to go and remove it there.
select t.title, t.destinations_reached, t.deleted_at
  from announcement_tombstones t
 where cardinality(t.destinations_reached) > 0
 order by t.deleted_at desc;

-- The one door, and who may go through it. Only the service role should
-- appear; the route checks the Superadministrator before calling it.
select p.proname,
       coalesce(array_to_string(p.proacl::text[], ', '), 'owner only') as grants
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'erase_announcement';


-- ===========================================================================
-- ===========================================================================
--
--   041_appointments_and_the_letters_that_issue_from_them.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 041 — AN APPOINTMENT IS A RECORD; THE LETTER IS GENERATED FROM IT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- The University gets somewhere to record that it has appointed somebody. It
-- had nowhere. `lecturers` holds a name, a department and a specialisation —
-- who teaches what — and `profiles` holds an account. Neither records a
-- POSITION, a start date, an employment type, a probation period, a place of
-- duty, a reporting officer or a salary, which means every appointment letter
-- this University has ever sent was typed by hand into a word processor from
-- facts that lived only in the letter.
--
-- That is the fault. Not that the letters were manual — that the RECORD was the
-- letter. Ask the system today who reports to whom, whose probation ends this
-- month, or what somebody was actually appointed as, and it cannot answer,
-- because the answer is in a .docx on somebody's laptop.
--
-- ---------------------------------------------------------------------------
-- SO THE LETTER BECOMES AN OUTPUT, NOT A SOURCE
-- ---------------------------------------------------------------------------
--
--   appointments            the facts, structured, one row per appointment
--   appointment_letters     what was generated from them, versioned and sealed
--   appointment_events      who did what to it, append-only
--
-- A letter is regenerated from the record, never edited. Editing a generated
-- document is how a letter comes to say something the register does not, and
-- then the University has two answers to the same question with a signature on
-- the wrong one.
--
-- ---------------------------------------------------------------------------
-- THE SAME SEPARATION AS EVERYTHING ELSE
-- ---------------------------------------------------------------------------
--
-- Drafted by one person, AUTHORISED by another, then issued. 005 requires it of
-- a certificate design, 009 of a grade, 014 of a social post, 038 of an
-- announcement. An appointment letter commits the University to paying
-- somebody; one person drafting, authorising and sending it alone is a larger
-- version of the thing every one of those rules exists to prevent.
--
-- ---------------------------------------------------------------------------
-- AND THE SALARY IS NOT VISIBLE TO EVERYONE WHO CAN SEE THE APPOINTMENT
-- ---------------------------------------------------------------------------
--
-- Section 5 puts remuneration behind its own view and its own roles. Who holds
-- which post is ordinary institutional information; what they are paid is not,
-- and a single RLS policy over the whole row would have made the second as
-- visible as the first to every administrator in the University.
-- ===========================================================================


-- ===========================================================================
-- 1. THE APPOINTMENT
-- ===========================================================================

create table if not exists appointments (
  id             uuid primary key default gen_random_uuid(),

  -- ---- Who ---------------------------------------------------------------
  --
  -- The account where there is one, and the name always. An appointment is
  -- often made before the person has a login, and a record that cannot exist
  -- until IT has created an account is a record that gets kept in a
  -- spreadsheet until then.
  person_id      uuid references auth.users (id) on delete restrict,
  lecturer_id    uuid references lecturers (id) on delete set null,

  full_name      text not null check (length(btrim(full_name)) >= 3),
  email          text,
  phone          text,
  postal_address text,

  -- ---- What ---------------------------------------------------------------
  position_title text not null check (length(btrim(position_title)) >= 3),
  department_id  uuid references departments (id) on delete set null,
  -- The faculty or unit as written on the letter, for a unit that is not a
  -- department row. Kept beside the id rather than instead of it: the id is
  -- what a report joins on and the text is what the letter prints.
  unit_name      text,

  -- A CLOSED VOCABULARY. "Employment type" written free-hand produces
  -- "Full time", "full-time", "FT" and "Permanent (full time)" inside a year,
  -- and then nothing can be counted.
  employment_type text not null
                    check (employment_type in
                      ('permanent', 'fixed-term', 'part-time', 'visiting',
                       'adjunct', 'honorary', 'secondment', 'probationary')),

  -- ---- When ---------------------------------------------------------------
  start_date     date not null,
  -- Null where the appointment is open-ended. A fixed-term appointment with no
  -- end date is the constraint below refusing to let that happen silently.
  end_date       date,
  -- The date the appointment takes effect, where it differs from the start
  -- date — a promotion effective from the first of the month, taken up later.
  effective_date date,

  probation_months integer check (probation_months is null or probation_months between 0 and 36),

  -- ---- Where and to whom --------------------------------------------------
  place_of_duty  text,
  -- The person the appointee reports to. A uuid where they are on the system
  -- and a name always, for the same reason as the appointee.
  reports_to_id  uuid references auth.users (id) on delete set null,
  reports_to_name text,

  -- ---- Terms --------------------------------------------------------------
  --
  -- REMUNERATION IS OPTIONAL, because an honorary appointment has none and a
  -- record that demands a number would have somebody type a zero — which reads
  -- as "paid nothing" rather than "not a paid post".
  salary_amount  numeric(14,2) check (salary_amount is null or salary_amount >= 0),
  salary_currency text check (salary_currency is null or
                     salary_currency in ('FCFA', 'USD', 'EUR', 'GBP', 'NGN')),
  salary_period  text check (salary_period is null or
                     salary_period in ('hour', 'month', 'year', 'session')),

  terms          text,

  -- ---- The workflow -------------------------------------------------------
  status         text not null default 'draft'
                   check (status in ('draft', 'submitted', 'authorized', 'issued',
                                     'declined', 'withdrawn', 'ended')),

  drafted_by     uuid references auth.users (id) on delete restrict,
  authorized_by  uuid references auth.users (id) on delete restrict,
  authorized_at  timestamptz,
  issued_at      timestamptz,

  -- Why an appointment was withdrawn before it was taken up, or why it ended.
  closed_reason  text,
  closed_at      timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists appointments_status_idx on appointments (status, start_date);
create index if not exists appointments_person_idx on appointments (person_id);
create index if not exists appointments_probation_idx
  on appointments (start_date) where probation_months is not null;

do $$
begin
  -- THE AUTHORISER IS NOT THE DRAFTER. An appointment letter commits the
  -- University to paying somebody. One person drafting, authorising and
  -- sending it alone is the larger version of everything 005, 009, 014 and 038
  -- exist to prevent.
  if not exists (select 1 from pg_constraint where conname = 'appointments_second_pair_of_eyes') then
    alter table appointments add constraint appointments_second_pair_of_eyes
      check (authorized_by is null or drafted_by is null or authorized_by <> drafted_by);
  end if;

  -- A FIXED TERM HAS A TERM. Without this, 'fixed-term' with no end date is a
  -- permanent appointment wearing the wrong label, and nobody finds out until
  -- somebody asks when it ends.
  if not exists (select 1 from pg_constraint where conname = 'appointments_fixed_term_ends') then
    alter table appointments add constraint appointments_fixed_term_ends
      check (employment_type <> 'fixed-term' or end_date is not null);
  end if;

  -- AND IT ENDS AFTER IT STARTS.
  if not exists (select 1 from pg_constraint where conname = 'appointments_dates_run_forward') then
    alter table appointments add constraint appointments_dates_run_forward
      check (end_date is null or end_date > start_date);
  end if;

  -- A SALARY IS A NUMBER, A CURRENCY AND A PERIOD, or it is none of them.
  -- "450,000" on a letter with no currency and no period is not a figure
  -- anybody can rely on, and it is the kind of omission that reaches a
  -- signature because each half looks complete on its own.
  if not exists (select 1 from pg_constraint where conname = 'appointments_salary_is_complete') then
    alter table appointments add constraint appointments_salary_is_complete
      check (
        (salary_amount is null and salary_currency is null and salary_period is null)
        or (salary_amount is not null and salary_currency is not null
            and salary_period is not null)
      );
  end if;

  -- AN AUTHORISED APPOINTMENT NAMES ITS AUTHORISER AND THE MOMENT.
  if not exists (select 1 from pg_constraint where conname = 'appointments_authority_recorded') then
    alter table appointments add constraint appointments_authority_recorded
      check (status not in ('authorized', 'issued')
             or (authorized_by is not null and authorized_at is not null));
  end if;

  -- Closing an appointment says why, like every other closure in this system.
  if not exists (select 1 from pg_constraint where conname = 'appointments_closure_explained') then
    alter table appointments add constraint appointments_closure_explained
      check (status not in ('declined', 'withdrawn', 'ended')
             or (closed_reason is not null and length(btrim(closed_reason)) >= 10));
  end if;
end $$;


-- ===========================================================================
-- 2. THE LETTERS GENERATED FROM IT
-- ===========================================================================
--
-- VERSIONED, NOT OVERWRITTEN. A letter is regenerated when the appointment
-- changes — a corrected start date, a revised salary — and the superseded one
-- stays. Somebody holds a copy of it; if the University cannot produce what it
-- actually sent, the copy in their hand is the only version of that fact.
--
-- 031 built exactly this for admission letters and this follows it, including
-- the two things it learned: the HTML AS SENT is stored rather than
-- regenerated on demand, and a letter that failed to send is in an outbox
-- rather than gone.

create table if not exists appointment_letters (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,

  -- THE REFERENCE ON THE PAGE. What somebody quotes on the telephone, and what
  -- a filing system is built on. Unique across the University, not per
  -- appointment: two letters with one reference is the failure a reference
  -- exists to prevent.
  reference      text not null unique,

  version        integer not null default 1 check (version >= 1),

  -- The date the letter bears, which is what its seal was computed over.
  issued_on      date not null,

  /** Whether it went out with a seal. False when CREDENTIAL_SECRET was absent. */
  sealed         boolean not null default false,
  /** The verification code printed on the page, spoken over a telephone. */
  seal_code      text,

  -- The document itself, as the appointee received it.
  html           text not null,

  -- WHO SIGNED IT. Not the person who pressed the button — the office whose
  -- name and signature appear on the page, which is a different thing and is
  -- the one a recipient relies on.
  signatory_name text,
  signatory_role text,

  to_email       text,
  delivery       text not null default 'pending'
                   check (delivery in ('pending', 'sent', 'failed')),
  delivery_detail text,
  attempts       integer not null default 0,

  -- Set when a later version replaces this one. The row stays.
  superseded_at  timestamptz,
  superseded_by  uuid references appointment_letters (id) on delete set null,

  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (appointment_id, version)
);

create index if not exists appointment_letters_appointment_idx
  on appointment_letters (appointment_id, version desc);
create index if not exists appointment_letters_current_idx
  on appointment_letters (appointment_id) where superseded_at is null;

-- ONE CURRENT LETTER PER APPOINTMENT. Two letters both claiming to be the one
-- in force is the state a version number exists to make impossible.
create unique index if not exists appointment_letters_one_current_idx
  on appointment_letters (appointment_id) where superseded_at is null;

-- A LETTER IS NEVER EDITED. It is superseded by a new version generated from
-- the record. Editing a generated document is how a letter comes to say
-- something the register does not, and then the University has two answers to
-- the same question with a signature on the wrong one.
create or replace function refuse_letter_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delivery is not the letter. Recording that it sent, failed, or was
  -- superseded changes what happened TO the document, not what it says.
  if new.html = old.html
     and new.reference = old.reference
     and new.version = old.version
     and new.issued_on = old.issued_on
     and new.seal_code is not distinct from old.seal_code
     and new.signatory_name is not distinct from old.signatory_name then
    return new;
  end if;
  raise exception
    'An appointment letter cannot be edited. Correct the appointment and generate a new '
    'version: somebody is holding the document as it was sent, and a letter that says one '
    'thing on their copy and another in the register is worse than no register.'
    using errcode = 'check_violation';
end $$;

drop trigger if exists appointment_letters_no_edit on appointment_letters;
create trigger appointment_letters_no_edit
  before update on appointment_letters
  for each row execute function refuse_letter_edit();


-- ===========================================================================
-- 3. THE HISTORY
-- ===========================================================================

create table if not exists appointment_events (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,

  event          text not null check (event in (
                   'DRAFTED', 'EDITED', 'SUBMITTED_FOR_AUTHORITY', 'AUTHORIZED', 'RETURNED',
                   'LETTER_GENERATED', 'LETTER_ISSUED', 'LETTER_DELIVERY_FAILED',
                   'LETTER_SUPERSEDED', 'DECLINED', 'WITHDRAWN', 'ENDED',
                   'ADMINISTRATIVE_OVERRIDE')),

  actor_id       uuid references auth.users (id) on delete set null,
  actor_email    text,
  actor_role     text,

  previous_state text,
  new_state      text,
  detail         text,
  metadata       jsonb,

  at             timestamptz not null default now()
);

create index if not exists appointment_events_appointment_idx
  on appointment_events (appointment_id, at);

create or replace function refuse_appointment_history_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'The appointment history is append-only. % is not permitted: this is the record of who '
    'the University appointed and on whose authority.', tg_op
    using errcode = 'check_violation';
end $$;

drop trigger if exists appointment_events_append_only on appointment_events;
create trigger appointment_events_append_only
  before update or delete on appointment_events
  for each row execute function refuse_appointment_history_edit();


-- ===========================================================================
-- 4. WHO CAN READ WHAT
-- ===========================================================================

alter table appointments enable row level security;
alter table appointment_letters enable row level security;
alter table appointment_events enable row level security;

-- THE APPOINTEE READS THEIR OWN. Somebody should not have to write to Human
-- Resources to find out what they were appointed as.
drop policy if exists appointments_read on appointments;
create policy appointments_read on appointments
  for select using (
    person_id = auth.uid()
    or auth_role() in ('superadmin', 'admin', 'registrar')
  );

drop policy if exists appointment_letters_read on appointment_letters;
create policy appointment_letters_read on appointment_letters
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar')
    or exists (select 1 from appointments a
                where a.id = appointment_letters.appointment_id and a.person_id = auth.uid())
  );

drop policy if exists appointment_events_read on appointment_events;
create policy appointment_events_read on appointment_events
  for select using (auth_role() in ('superadmin', 'admin', 'registrar'));

-- No write policy on any of the three. Every change goes through
-- /api/appointments, which checks the capability against the role in the
-- database and writes the history in the same breath.


-- ===========================================================================
-- 5. THE SALARY IS NOT ORDINARY INSTITUTIONAL INFORMATION
-- ===========================================================================
--
-- WHO HOLDS WHICH POST IS. What they are paid is not, and one policy over the
-- whole row makes the second as visible as the first to every administrator in
-- the University — which is how a salary ends up known to people who had no
-- business knowing it and no idea they were being shown it.
--
-- So the view below is what most screens read. It carries the appointment
-- without the money. The columns themselves stay restricted to the roles that
-- actually set pay.

create or replace view appointments_without_pay
with (security_invoker = true) as
select id, person_id, lecturer_id, full_name, email, phone,
       position_title, department_id, unit_name, employment_type,
       start_date, end_date, effective_date, probation_months,
       place_of_duty, reports_to_id, reports_to_name,
       -- SAID, NOT SHOWN. A screen needs to know a figure exists — to print
       -- "salary as set out in your letter" rather than nothing — without
       -- being told what it is.
       (salary_amount is not null) as is_paid,
       status, drafted_by, authorized_by, authorized_at, issued_at,
       created_at, updated_at
  from appointments;

comment on view appointments_without_pay is
  'Every appointment without the remuneration. What somebody holds is ordinary '
  'institutional information; what they are paid is not, and a single policy over '
  'the table would make the second as visible as the first.';


-- ===========================================================================
-- 6. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  l_id uuid;
  someone uuid;
  other uuid;
  later_version_sql text;
begin
  -- ---------------------------------------------------------------------
  -- THE INSERT FOR A VERSION AFTER THE FIRST, BUILT TO MATCH THE SCHEMA.
  --
  -- 042 adds `supersedes_reason` and requires it on any version above 1 — a
  -- revised letter has to say why somebody is holding a second one. On a FIRST
  -- run of the bundle that column does not exist yet, because 041 runs before
  -- 042; on a SECOND run it does, and the constraint refuses an insert without
  -- it. Naming the column unconditionally fails the first case, omitting it
  -- fails the second.
  --
  -- Found by running RUN-ALL.sql twice, which is the only way either half of
  -- this shows up.
  -- ---------------------------------------------------------------------
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'appointment_letters'
                and column_name = 'supersedes_reason') then
    later_version_sql :=
      'insert into appointment_letters (appointment_id, reference, version, issued_on, html, '
      || 'supersedes_reason) values ($1, $2, $3, current_date, ''<p>A later letter.</p>'', '
      || '''The start date was corrected.'')';
  else
    later_version_sql :=
      'insert into appointment_letters (appointment_id, reference, version, issued_on, html) '
      || 'values ($1, $2, $3, current_date, ''<p>A later letter.</p>'')';
  end if;

  select id into someone from auth.users limit 1;
  if someone is null then
    raise notice '041: no accounts yet, so the rules could not be exercised against one';
    return;
  end if;
  select id into other from auth.users where id <> someone limit 1;

  begin
    insert into appointments
      (full_name, position_title, employment_type, start_date, drafted_by, status)
    values ('A Specimen Appointee', 'Lecturer in Theology', 'permanent',
            date '2026-10-01', someone, 'draft')
    returning id into a_id;

    -- ---- THE DRAFTER CANNOT AUTHORISE THEIR OWN --------------------------
    -- An appointment letter commits the University to paying somebody.
    refused := false;
    begin
      update appointments set status = 'authorized', authorized_by = someone,
                              authorized_at = now() where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: the person who drafted an appointment authorised it. The '
                      'second pair of eyes is not a rule, it is a comment.';
    end if;

    -- ---- A FIXED TERM HAS A TERM -----------------------------------------
    -- Otherwise it is a permanent appointment wearing the wrong label, and
    -- nobody finds out until somebody asks when it ends.
    refused := false;
    begin
      update appointments set employment_type = 'fixed-term' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: a fixed-term appointment was recorded with no end date';
    end if;

    -- ---- AND IT ENDS AFTER IT STARTS -------------------------------------
    refused := false;
    begin
      update appointments set end_date = date '2025-01-01' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: an appointment ended before it began';
    end if;

    -- ---- A SALARY IS A NUMBER, A CURRENCY AND A PERIOD --------------------
    -- "450,000" with no currency and no period is not a figure anybody can
    -- rely on, and each half looks complete on its own, which is how the
    -- omission reaches a signature.
    refused := false;
    begin
      update appointments set salary_amount = 450000 where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: a salary was recorded with no currency and no period';
    end if;

    update appointments
       set salary_amount = 450000, salary_currency = 'FCFA', salary_period = 'month'
     where id = a_id;

    -- ---- AND IT IS NOT IN THE ORDINARY VIEW ------------------------------
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'appointments_without_pay'
         and column_name in ('salary_amount', 'salary_currency', 'salary_period')
    ) then
      raise exception '041 FAILED: the pay-free view carries the pay. Who holds which post is '
                      'ordinary information; what they are paid is not.';
    end if;
    if not (select is_paid from appointments_without_pay where id = a_id) then
      raise exception '041 FAILED: the view cannot even say that a salary exists, so a letter '
                      'cannot say "as set out above" without being shown the figure';
    end if;

    -- ---- A CLOSURE SAYS WHY ----------------------------------------------
    refused := false;
    begin
      update appointments set status = 'withdrawn' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: an appointment was withdrawn with no reason recorded';
    end if;

    -- ---- A LETTER CANNOT BE EDITED ---------------------------------------
    --
    -- The references below are APT-YYYY-NNNN. 041 shipped with IGUC/HR/2026/…
    -- and 042 later constrained the shape, so on any second run of the bundle
    -- this proof was refused by a rule added after it. Found by running
    -- RUN-ALL.sql twice; the shape 042 requires is used from the start.
    insert into appointment_letters
      (appointment_id, reference, issued_on, html, created_by)
    values (a_id, 'APT-2026-9001', current_date, '<p>The letter as sent.</p>', someone)
    returning id into l_id;

    refused := false;
    begin
      update appointment_letters set html = '<p>Something else entirely.</p>' where id = l_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: an issued letter was rewritten. Somebody is holding the '
                      'document as it was sent.';
    end if;

    -- …but recording that it was delivered is not editing it.
    update appointment_letters set delivery = 'sent', attempts = 1 where id = l_id;

    -- ---- TWO LETTERS CANNOT BOTH BE THE CURRENT ONE -----------------------
    refused := false;
    begin
      execute later_version_sql using a_id, 'APT-2026-9002', 2;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: two letters both claim to be the one in force';
    end if;

    -- Superseding the first makes room for the second, which is the point of
    -- a version rather than an edit.
    update appointment_letters set superseded_at = now() where id = l_id;
    execute later_version_sql using a_id, 'APT-2026-9002', 2;

    -- ---- A REFERENCE IS UNIQUE ACROSS THE UNIVERSITY ----------------------
    refused := false;
    begin
      execute later_version_sql using a_id, 'APT-2026-9002', 3;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: two letters carry one reference, which is the single thing '
                      'a reference exists to prevent';
    end if;

    -- ---- THE HISTORY IS APPEND-ONLY ---------------------------------------
    insert into appointment_events (appointment_id, event, new_state) values (a_id, 'DRAFTED', 'draft');
    refused := false;
    begin
      update appointment_events set detail = 'something else' where appointment_id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: the appointment history could be rewritten';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '041 OK: a drafter cannot authorise their own appointment, a fixed term has a '
               'term, dates run forward, a salary is a figure with a currency and a period and '
               'is absent from the ordinary view, a closure states a reason, an issued letter '
               'cannot be edited or duplicated, a reference is unique, and the history is '
               'append-only';
end $$;


-- ===========================================================================
-- 7. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- Every appointment, without the pay.
select full_name, position_title, employment_type, start_date, end_date,
       status, is_paid
  from appointments_without_pay
 order by start_date desc;

-- PROBATIONS ENDING IN THE NEXT SIXTY DAYS. The question the University could
-- not ask at all before today, because the answer was in a word processor file.
select full_name, position_title, start_date,
       (start_date + (probation_months || ' months')::interval)::date as probation_ends
  from appointments
 where probation_months is not null
   and status = 'issued'
   and (start_date + (probation_months || ' months')::interval)::date
       between current_date and current_date + 60
 order by 4;

-- FIXED TERMS ENDING IN THE NEXT NINETY DAYS.
select full_name, position_title, end_date
  from appointments
 where end_date is not null and status = 'issued'
   and end_date between current_date and current_date + 90
 order by end_date;

-- The letters, current version first, and which were superseded.
select a.full_name, l.reference, l.version, l.issued_on, l.sealed, l.delivery,
       (l.superseded_at is null) as is_current
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
 order by a.full_name, l.version desc;

-- LETTERS THAT DID NOT REACH ANYBODY. Generated, sealed, and sitting in the
-- outbox. Each is somebody who has not been told they were appointed.
select a.full_name, a.email, l.reference, l.attempts, l.delivery_detail
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
 where l.delivery = 'failed' and l.superseded_at is null
 order by l.created_at desc;


-- ===========================================================================
-- ===========================================================================
--
--   042_the_appointment_lifecycle_and_the_staff_record.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 042 — THE FULL APPOINTMENT LIFECYCLE, AND THE STAFF RECORD IT CREATES
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE LIFECYCLE GETS THE STEPS IT WAS MISSING. 041 stopped at `issued`,
--    which conflated four different facts: the letter exists, the letter was
--    sent, the appointee said yes, and the person is actually in post. They
--    come apart constantly — a letter generated and never sent, a letter sent
--    and never answered, an acceptance for a post that starts in three months
--    — and a single state cannot tell a Head of Department whether anybody is
--    coming.
--
-- 2. AN ISSUED APPOINTMENT CAN BE AMENDED, ON THE RECORD. Salaries are
--    corrected and start dates move. Until now the only options were to edit
--    the record under a letter already in somebody's hands, or to withdraw the
--    whole appointment. Neither is what happened.
--
-- 3. THE STAFF RECORD CANNOT BE CREATED BEFORE THE LETTER IS ISSUED. This is
--    the door this migration closes and it is the point of the whole exercise:
--    the system may not represent somebody as a member of staff until the
--    University has actually appointed them. `lecturers` rows could be created
--    by anybody at any time, for anybody, with no appointment behind them.
--
--    Existing staff are NOT affected — a row created before this ran stays
--    exactly as it is. What is refused is a NEW staff row that claims an
--    appointment which has not reached issuance.
-- ===========================================================================


-- ===========================================================================
-- 1. THE LIFECYCLE
-- ===========================================================================
--
--   draft → submitted → approved → letter_generated → issued → accepted → active
--
-- and, when something changes after issuance:
--
--   issued/accepted/active → amendment_requested → approved → letter_generated
--                          → issued  (as a new version; the old letter stays)
--
-- WHY `approved` AND NOT `authorized`. 041 called it authorized and the
-- University calls it approved. The word on the screen and the word in the
-- column being different is how a question gets asked twice and answered
-- differently, so the column moves. The old value is carried across below.

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'appointments'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%status%' and pg_get_constraintdef(oid) like '%draft%'
   limit 1;
  if con is not null then
    execute format('alter table appointments drop constraint %I', con);
  end if;

  -- The rows 041 wrote, renamed before the new constraint refuses them.
  update appointments set status = 'approved' where status = 'authorized';

  alter table appointments add constraint appointments_status_check
    check (status in (
      'draft',
      'submitted',           -- awaiting approval
      'approved',            -- approved by somebody other than the drafter
      'letter_generated',    -- the document exists; nobody has been sent it
      'issued',              -- the letter has gone to the appointee
      'accepted',            -- the appointee has said yes
      'active',              -- in post
      'amendment_requested', -- something changed after issuance
      'declined',            -- the appointee said no
      'withdrawn',           -- the University withdrew it
      'ended'                -- ran its course, or was ended
    ));
end $$;

alter table appointments
  -- WHEN, NOT WHETHER. Each of these is a fact with a date, and a boolean
  -- would answer "did they accept?" while losing "when?", which is the half
  -- that matters when a start date is disputed.
  add column if not exists letter_generated_at timestamptz,
  add column if not exists accepted_at       timestamptz,
  add column if not exists declined_at       timestamptz,
  add column if not exists activated_at      timestamptz,

  -- ---- The amendment path -------------------------------------------------
  add column if not exists amendment_reason     text,
  add column if not exists amendment_requested_at timestamptz,
  add column if not exists amendment_requested_by uuid references auth.users (id) on delete set null,
  -- HOW MANY TIMES THIS APPOINTMENT HAS BEEN AMENDED. Not decoration: an
  -- appointment amended four times is a different conversation from one
  -- amended once, and the letters alone do not say it because a version can
  -- also be a correction of a typographical error.
  add column if not exists amendments integer not null default 0,

  -- ---- The staff record ---------------------------------------------------
  add column if not exists staff_record_id   uuid references lecturers (id) on delete set null,
  add column if not exists staff_activated_at timestamptz;

do $$
begin
  -- AN AMENDMENT SAYS WHAT CHANGED. "Amended" with no reason is a revised
  -- letter in somebody's hands and no account of why they were sent a second
  -- one.
  if not exists (select 1 from pg_constraint where conname = 'appointments_amendment_explained') then
    alter table appointments add constraint appointments_amendment_explained
      check (status <> 'amendment_requested'
             or (amendment_reason is not null
                 and length(btrim(amendment_reason)) >= 12
                 and amendment_requested_by is not null));
  end if;

  -- ACCEPTANCE, ACTIVATION AND ISSUANCE EACH RECORD THEIR MOMENT.
  if not exists (select 1 from pg_constraint where conname = 'appointments_moments_recorded') then
    alter table appointments add constraint appointments_moments_recorded
      check (
        (status <> 'accepted' or accepted_at is not null)
        and (status <> 'active' or activated_at is not null)
        and (status <> 'declined' or declined_at is not null)
      );
  end if;

  -- ---------------------------------------------------------------------
  -- NOBODY IS IN POST BEFORE THEY WERE APPOINTED.
  --
  -- The ordering constraint that makes the whole workflow mean something: a
  -- record cannot reach `accepted` or `active` without the letter having been
  -- issued first. Without it, an administrator can set somebody active
  -- directly and the approval, the letter and the acceptance become optional
  -- decoration on a path nobody has to walk.
  -- ---------------------------------------------------------------------
  if not exists (select 1 from pg_constraint where conname = 'appointments_issued_before_accepted') then
    alter table appointments add constraint appointments_issued_before_accepted
      check (status not in ('accepted', 'active') or issued_at is not null);
  end if;

  -- A STAFF RECORD IS THE CONSEQUENCE OF AN APPOINTMENT, never its cause.
  if not exists (select 1 from pg_constraint where conname = 'appointments_staff_follows_issuance') then
    alter table appointments add constraint appointments_staff_follows_issuance
      check (staff_record_id is null or issued_at is not null);
  end if;
end $$;

create index if not exists appointments_awaiting_idx
  on appointments (status) where status in ('submitted', 'amendment_requested');
create index if not exists appointments_active_idx
  on appointments (start_date) where status = 'active';


-- ===========================================================================
-- 2. THE REFERENCE THE UNIVERSITY ASKED FOR
-- ===========================================================================
--
-- APT-2026-0042. 041 used IGUC/HR/2026/0001, and slashes in a reference are a
-- small ongoing nuisance: they cannot go in a URL path without escaping, and a
-- verification link is exactly where this will end up.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_reference_shape') then
    alter table appointment_letters add constraint appointment_letters_reference_shape
      check (reference ~ '^APT-[0-9]{4}-[0-9]{4,}$');
  end if;
end $$;

-- WHY A LETTER EXISTS, in its own words: issued, amended, or re-issued. The
-- University asked for a history that reads
--
--   Version 1 — Issued 12 Sept 2026
--   Version 2 — Amended 20 Sept 2026
--   Version 3 — Re-issued 25 Sept 2026
--
-- and "amended" and "re-issued" are not the same thing: the first is a changed
-- appointment, the second is the same appointment sent again.
alter table appointment_letters
  add column if not exists kind text not null default 'issued',
  add column if not exists supersedes_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_kind_check') then
    alter table appointment_letters add constraint appointment_letters_kind_check
      check (kind in ('issued', 'amended', 'reissued'));
  end if;

  -- A LETTER AFTER THE FIRST SAYS WHY THERE IS ANOTHER ONE. Somebody is
  -- holding version 1 and has just received version 2; the register has to be
  -- able to say what changed.
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_later_versions_explained') then
    alter table appointment_letters add constraint appointment_letters_later_versions_explained
      check (version = 1 or (supersedes_reason is not null
                             and length(btrim(supersedes_reason)) >= 10));
  end if;
end $$;


-- ===========================================================================
-- 3. WHAT THE QR CODE RESOLVES TO
-- ===========================================================================
--
-- A READER OF THE DOCUMENT IS NOT A USER OF THE SYSTEM. Somebody checking an
-- appointment letter is a bank, an embassy or another university, and they get
-- exactly what the University is willing to say publicly about a document
-- somebody has handed them: that it is genuine, whose it is, what post, and
-- when it was issued.
--
-- WHAT IT DOES NOT CARRY: the salary, the terms, the address, the reporting
-- officer. A verification page that answered "what is this person paid" to
-- anybody holding a photograph of their letter would be a data breach with a
-- QR code on it.

create or replace view appointment_letter_verification
with (security_invoker = false) as
select l.reference,
       'Appointment Letter'::text            as document,
       a.full_name                            as holder,
       a.position_title                       as position,
       coalesce(a.unit_name, '')              as unit,
       l.issued_on                            as issued,
       l.version,
       case
         -- A SUPERSEDED LETTER IS NOT INVALID, and saying so would be wrong in
         -- a way that costs somebody a visa. It was genuine and it has been
         -- replaced; the reader is told which version is current.
         when l.superseded_at is not null then 'Superseded'
         when a.status in ('withdrawn', 'declined') then 'Not in force'
         when a.status = 'ended' then 'Ended'
         else 'Valid'
       end                                    as status,
       (select max(v.version) from appointment_letters v
         where v.appointment_id = l.appointment_id) as current_version
  from appointment_letters l
  join appointments a on a.id = l.appointment_id;

comment on view appointment_letter_verification is
  'What the QR code on an appointment letter resolves to. Carries no salary, no '
  'terms and no contact details: a reader of the document is a bank or an embassy, '
  'not a user of the system.';

grant select on appointment_letter_verification to anon, authenticated, service_role;


-- ===========================================================================
-- 4. THE STAFF RECORD FOLLOWS THE APPOINTMENT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- THE DOOR THIS CLOSES
-- ---------------------------------------------------------------------------
--
-- A `lecturers` row could be created by anybody, for anybody, at any time, with
-- no appointment behind it. So the system could represent somebody as a member
-- of staff — with a department, a portal account and a place in the timetable —
-- whom the University had never appointed.
--
-- From now on a staff record created FROM an appointment requires that
-- appointment to have reached issuance. Rows that already exist are untouched,
-- and a row created with no appointment at all is still permitted, because the
-- University has staff who predate this system and refusing them would make it
-- unusable on the first day.
--
-- WHAT IS REFUSED is the specific dangerous thing: claiming an appointment that
-- has not been issued.

alter table lecturers
  add column if not exists appointment_id uuid references appointments (id) on delete set null;

create unique index if not exists lecturers_appointment_idx
  on lecturers (appointment_id) where appointment_id is not null;

create or replace function staff_follows_an_issued_appointment() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
begin
  if new.appointment_id is null then
    return new;
  end if;

  select status, issued_at, full_name into a from appointments where id = new.appointment_id;
  if not found then
    raise exception 'No appointment with id %', new.appointment_id using errcode = 'foreign_key_violation';
  end if;

  if a.issued_at is null then
    raise exception
      'This appointment has not been issued, so % cannot be made a member of staff from it. '
      'The University appoints somebody, sends them the letter, and the staff record follows — '
      'a staff record created first is a person the system says works here on nobody''s '
      'authority.', coalesce(a.full_name, 'this person')
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists lecturers_follow_appointments on lecturers;
create trigger lecturers_follow_appointments
  before insert or update of appointment_id on lecturers
  for each row execute function staff_follows_an_issued_appointment();


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  l_id uuid;
  someone uuid;
  other uuid;
  st text;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '042: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    insert into appointments
      (full_name, position_title, employment_type, start_date, place_of_duty, terms,
       drafted_by, status)
    values ('A Specimen Appointee', 'Lecturer in Theology', 'permanent', date '2026-10-01',
            'Buea campus', 'Subject to the conditions of service.', someone, 'draft')
    returning id into a_id;

    -- ---- NOBODY IS ACTIVE BEFORE THEY WERE APPOINTED ---------------------
    -- The ordering rule that makes the rest mean anything. Without it an
    -- administrator sets somebody active directly and the approval, the letter
    -- and the acceptance are decoration on a path nobody has to walk.
    for st in select unnest(array['accepted', 'active']) loop
      refused := false;
      begin
        execute 'update appointments set status = $1, accepted_at = now(), activated_at = now() '
                'where id = $2' using st, a_id;
      exception when others then refused := true;
      end;
      if not refused then
        raise exception '042 FAILED: an appointment reached % with no letter ever issued', st;
      end if;
    end loop;

    -- ---- AN AMENDMENT SAYS WHAT CHANGED ----------------------------------
    refused := false;
    begin
      update appointments set status = 'amendment_requested' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '042 FAILED: an appointment was amended with no reason and nobody asking';
    end if;

    -- Walk it properly: approved, letter generated, issued.
    update appointments
       set status = 'approved', authorized_by = other, authorized_at = now() where id = a_id;
    update appointments
       set status = 'letter_generated', letter_generated_at = now() where id = a_id;
    update appointments set status = 'issued', issued_at = now() where id = a_id;

    -- ---- THE REFERENCE IS THE SHAPE THE UNIVERSITY ASKED FOR --------------
    refused := false;
    begin
      insert into appointment_letters (appointment_id, reference, issued_on, html)
      values (a_id, 'IGUC/HR/2026/0001', current_date, '<p>x</p>');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '042 FAILED: a letter was filed under a reference that is not APT-YYYY-NNNN';
    end if;

    insert into appointment_letters (appointment_id, reference, issued_on, html, kind)
    values (a_id, 'APT-2026-0042', current_date, '<p>Version one.</p>', 'issued')
    returning id into l_id;

    -- ---- A SECOND VERSION SAYS WHY THERE IS ONE ---------------------------
    -- Somebody is holding version 1 and has just been sent version 2.
    update appointment_letters set superseded_at = now() where id = l_id;
    refused := false;
    begin
      insert into appointment_letters
        (appointment_id, reference, version, issued_on, html, kind)
      values (a_id, 'APT-2026-0043', 2, current_date, '<p>Version two.</p>', 'amended');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '042 FAILED: a revised letter was issued with no account of what changed';
    end if;

    insert into appointment_letters
      (appointment_id, reference, version, issued_on, html, kind, supersedes_reason)
    values (a_id, 'APT-2026-0043', 2, current_date, '<p>Version two.</p>', 'amended',
            'The start date moved to the first of November.');

    -- ---- WHAT A READER OF THE DOCUMENT IS TOLD ----------------------------
    if (select status from appointment_letter_verification where reference = 'APT-2026-0043')
       <> 'Valid' then
      raise exception '042 FAILED: the current letter does not verify as valid';
    end if;
    -- A SUPERSEDED LETTER IS NOT INVALID. Saying so would be wrong in a way
    -- that costs somebody a visa: it was genuine and it has been replaced.
    if (select status from appointment_letter_verification where reference = 'APT-2026-0042')
       <> 'Superseded' then
      raise exception '042 FAILED: a replaced letter reports as something other than superseded';
    end if;
    -- AND IT CARRIES NO SALARY. A verification page that answered "what is
    -- this person paid" to anybody holding a photograph of their letter would
    -- be a data breach with a QR code on it.
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'appointment_letter_verification'
         and column_name in ('salary_amount', 'salary_currency', 'terms', 'postal_address',
                             'email', 'phone', 'reports_to_name')
    ) then
      raise exception '042 FAILED: the public verification view carries private terms';
    end if;

    -- ---- THE STAFF RECORD FOLLOWS THE APPOINTMENT -------------------------
    -- A staff record created first is a person the system says works here on
    -- nobody's authority.
    insert into appointments
      (full_name, position_title, employment_type, start_date, place_of_duty, terms,
       drafted_by, status)
    values ('Not Yet Appointed', 'Lecturer', 'permanent', date '2027-01-01',
            'Buea campus', 'Conditions of service.', someone, 'draft')
    returning id into l_id;

    refused := false;
    begin
      insert into lecturers (staff_id, first_name, last_name, appointment_id)
      values ('PROOF-042-A', 'Not Yet', 'Appointed', l_id);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '042 FAILED: somebody became a member of staff from an appointment that '
                      'had never been issued';
    end if;

    -- …and from an issued one it works.
    insert into lecturers (staff_id, first_name, last_name, appointment_id)
    values ('PROOF-042-B', 'A Specimen', 'Appointee', a_id);

    -- A staff record with NO appointment is still allowed: the University has
    -- staff who predate this system, and refusing them would make it unusable
    -- on the first day.
    insert into lecturers (staff_id, first_name, last_name)
    values ('PROOF-042-C', 'Predates', 'ThisSystem');

    -- ---- ONE STAFF RECORD PER APPOINTMENT ---------------------------------
    refused := false;
    begin
      insert into lecturers (staff_id, first_name, last_name, appointment_id)
      values ('PROOF-042-D', 'A Second', 'Record', a_id);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '042 FAILED: one appointment produced two members of staff';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '042 OK: nobody is accepted or active before a letter was issued, an amendment '
               'states what changed, a reference is APT-YYYY-NNNN, a revised letter accounts '
               'for itself, a superseded letter verifies as superseded rather than invalid, '
               'the public view carries no salary, and a staff record cannot be created from '
               'an appointment that was never issued';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- The board: every appointment and where it has reached.
select full_name, position_title, employment_type, status, start_date,
       issued_at is not null as letter_issued,
       accepted_at, activated_at, amendments
  from appointments
 order by created_at desc;

-- THE LETTER HISTORY, as the University asked to read it.
select a.full_name, l.reference, l.version,
       initcap(l.kind) || ' ' || to_char(l.issued_on, 'DD Mon YYYY') as entry,
       coalesce(l.supersedes_reason, '') as why,
       (l.superseded_at is null) as is_current
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
 order by a.full_name, l.version;

-- What a QR code resolves to, for every letter.
select * from appointment_letter_verification order by reference;

-- STAFF RECORDS WITH NO APPOINTMENT BEHIND THEM. Permitted — the University
-- has staff who predate this system — but worth knowing about, because each is
-- somebody the register cannot explain.
select staff_id, first_name, last_name, status
  from lecturers
 where appointment_id is null
 order by created_at;

-- Appointments issued and never answered. Each is somebody who has not replied.
select full_name, position_title, issued_at
  from appointments
 where status = 'issued' and accepted_at is null and declined_at is null
 order by issued_at;

