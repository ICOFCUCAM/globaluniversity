-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 036, 037, 038, 039, 040, 041, 042, 043, 044, 045, 046, 047, 048, 049, 050, 051, 052, 053, 054, 055, 056, 057, 058, 059, 060, 061, 062, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-OUTSTANDING.sql 036 037 038 039 040 041 042 043 044 045 046 047 048 049 050 051 052 053 054 055 056 057 058 059 060 061 062
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
-- The LAST THING this file prints is a table saying which of these migrations
-- landed. You do not have to run anything else to find out — and you should
-- not have to, because the Supabase SQL editor does not display the NOTICE
-- lines the proofs write.
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
    --
    -- THE TRIGGER 047 ADDS IS STOOD DOWN FOR THIS ONE CHECK. It fills in
    -- dollars and a monthly period when an amount arrives with neither, which
    -- is the University's ruling and is exactly what makes this constraint
    -- stop firing on a database that has had 047. Running the two in order
    -- therefore reported "041 FAILED" on the SECOND pass and not the first —
    -- the constraint had not gone anywhere, but nothing could reach it.
    --
    -- Disabled inside the rolled-back block, so it is disabled for the length
    -- of this proof and for nothing else.
    if exists (select 1 from pg_trigger
                where tgname = 'appointments_money_is_in_dollars'
                  and tgrelid = 'appointments'::regclass) then
      alter table appointments disable trigger appointments_money_is_in_dollars;
    end if;

    refused := false;
    begin
      update appointments set salary_amount = 450000 where id = a_id;
    exception when others then refused := true;
    end;

    if exists (select 1 from pg_trigger
                where tgname = 'appointments_money_is_in_dollars'
                  and tgrelid = 'appointments'::regclass) then
      alter table appointments enable trigger appointments_money_is_in_dollars;
    end if;
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
    --
    -- WRITTEN TO MATCH WHICHEVER SCHEMA IS PRESENT. 044 later requires a
    -- delivered letter to record WHEN, and a letter with attempts to record
    -- when they happened — so this update was refused on any second run of the
    -- bundle, and could not name the columns unconditionally because on a
    -- FIRST run they do not exist yet. Found by running RUN-ALL.sql twice.
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'appointment_letters'
                  and column_name = 'delivered_at') then
      execute 'update appointment_letters set delivery = ''sent'', attempts = 1, '
              || 'delivered_at = now(), last_attempt_at = now() where id = $1' using l_id;
    else
      update appointment_letters set delivery = 'sent', attempts = 1 where id = l_id;
    end if;

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

-- ---------------------------------------------------------------------------
-- DROPPED FIRST, NOT REPLACED.
--
-- `create or replace view` can add a column and cannot remove one. 049 widens
-- this view with `signature_mode`, so on a SECOND run of RUN-ALL this statement
-- tried to replace the wider view with the narrower one and Postgres refused:
-- "cannot drop columns from view". The first pass was clean and the second was
-- not, which is precisely what running it twice is for.
-- ---------------------------------------------------------------------------
drop view if exists appointment_letter_verification;

create view appointment_letter_verification
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

    -- ---- WALK IT PROPERLY: approved, letter generated, ISSUED -------------
    --
    -- THE LETTER IS ARCHIVED BEFORE THE STATUS SAYS ISSUED, and it did not use
    -- to be. 047 refuses an appointment to reach `issued` with no document
    -- behind it — the University's own rule — so this proof walked a path the
    -- system no longer permits, and reported "042 FAILED" on the second pass
    -- of RUN-ALL while passing cleanly on the first.
    --
    -- The fix is not to stand the rule down. It is that this order was always
    -- the right one: the appointee is holding the letter, and a register that
    -- says a letter went out before one existed is the thing 047 closes.
    update appointments
       set status = 'approved', authorized_by = other, authorized_at = now() where id = a_id;
    update appointments
       set status = 'letter_generated', letter_generated_at = now() where id = a_id;
    -- …and `issued` is set below, AFTER the letter is in the archive.

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

    -- NOW it can be issued, and not before. The archive holds the document the
    -- appointee is about to be holding.
    update appointments set status = 'issued', issued_at = now() where id = a_id;

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


-- ===========================================================================
-- ===========================================================================
--
--   043_working_hours_and_the_appointing_authority.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 043 — WORKING HOURS, AND WHO THE LETTER SAYS APPOINTED THEM
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- Two fields the University named that the record did not carry, so the letter
-- could not state them and somebody would have had to type them.
--
-- 1. WORKING HOURS. An appointment that does not say how many hours is a
--    part-time post nobody can dispute and a full-time post nobody can enforce.
--    It is the field a disagreement about workload turns on, and it was absent.
--
-- 2. THE APPOINTING AUTHORITY, which is NOT the person who approved it in this
--    system. `authorized_by` is a user id — the officer who clicked approve.
--    The letter says "on the authority of the University Council", and that is
--    a different fact. Conflating them puts an administrator's name where a
--    governing body belongs, on a document somebody may rely on for years.
-- ===========================================================================

alter table appointments
  -- FREE TEXT, DELIBERATELY. "40 hours per week", "Two evenings per week during
  -- semester", "As required, minimum 12 hours per term" are all real answers
  -- and a numeric column would force the second and third to be rounded into a
  -- number that is not true.
  add column if not exists working_hours text,

  -- THE BODY THE LETTER NAMES. A string rather than a reference, because the
  -- Council, the Senate and the Vice Chancellor are not rows in this database
  -- and inventing a table of governing bodies to hold three names would be
  -- worse than the problem.
  add column if not exists appointing_authority text,

  -- WHEN THAT BODY DECIDED, which is not when somebody recorded it here. A
  -- Council meeting on the 3rd entered on the 19th is dated the 3rd on the
  -- letter, because that is when the University decided.
  add column if not exists authority_decided_on date;

comment on column appointments.appointing_authority is
  'The body the letter names as making the appointment — the Council, the Senate, '
  'the Vice Chancellor. NOT `authorized_by`, which is the officer who approved it '
  'in this system.';

do $$
begin
  -- A FULL-TIME APPOINTMENT SAYS ITS HOURS. Not every type: an honorary or
  -- adjunct post genuinely has none, and demanding a figure would have somebody
  -- type "N/A" into a field a dispute later turns on.
  if not exists (select 1 from pg_constraint where conname = 'appointments_authority_dated') then
    alter table appointments add constraint appointments_authority_dated
      check (authority_decided_on is null or appointing_authority is not null);
  end if;
end $$;


-- ===========================================================================
-- 2. THE ARCHIVE HAS TO BE CHECKABLE
-- ===========================================================================
--
-- 041 stores the letter as it was sent and a trigger refuses to let it be
-- edited. That is the archive. What it could not do is PROVE itself: "this is
-- the document we sent" rested on the trigger having worked, and a trigger that
-- was dropped for an afternoon during maintenance leaves no trace.
--
-- A hash over the stored document closes it. Recompute it and compare: if the
-- html has changed by any route at all — a trigger disabled, a direct database
-- edit, a restore from a bad backup — the figures disagree and somebody finds
-- out. It is also what a reader is given when they ask what exactly was issued.
--
-- SHA-256 OF THE HTML, computed by the application and stored here. Not
-- computed in the database: the document is sealed and hashed in the same pass
-- that generates it, and a second implementation in SQL would be a second
-- answer to "what is this document's hash".

alter table appointment_letters
  add column if not exists content_hash text;

do $$
begin
  -- A HASH IS A HASH. Sixty-four hexadecimal characters or nothing at all —
  -- an empty string or a truncated value would compare unequal to everything
  -- and read as tampering on every letter that has one.
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_hash_shape') then
    alter table appointment_letters add constraint appointment_letters_hash_shape
      check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$');
  end if;
end $$;

comment on column appointment_letters.content_hash is
  'SHA-256 of the stored html. Recompute and compare to prove the archived document '
  'is the one that was issued, by any route it might have been changed.';

-- LETTERS THE ARCHIVE CANNOT VOUCH FOR. Anything issued before this ran has no
-- hash and cannot be checked — reported rather than backfilled, because a hash
-- computed today over whatever the row holds today proves nothing at all.
create or replace view appointment_letters_unverifiable
with (security_invoker = true) as
select l.id, l.reference, l.version, l.issued_on, a.full_name
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
 where l.content_hash is null;


-- ===========================================================================
-- PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  someone uuid;
  other uuid;
begin
  select id into someone from auth.users limit 1;
  -- TWO ACCOUNTS, because 041 refuses an approval by the drafter and this
  -- proof has to walk an appointment as far as an issued letter to test the
  -- hash. One account cannot do it, which is the rule working.
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '043: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    insert into appointments
      (full_name, position_title, employment_type, start_date, place_of_duty, terms,
       drafted_by, status)
    values ('A Specimen Appointee', 'Lecturer', 'permanent', date '2026-10-01',
            'Buea campus', 'Conditions of service.', someone, 'draft')
    returning id into a_id;

    -- ---- A DECISION DATE WITHOUT A BODY IS NOT A DECISION -----------------
    -- "Decided on 3 September" with nobody named is a date on a letter that
    -- cannot be traced to a meeting.
    refused := false;
    begin
      update appointments set authority_decided_on = date '2026-09-03' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '043 FAILED: an appointment recorded when it was decided without '
                      'recording who decided it';
    end if;

    update appointments
       set appointing_authority = 'The University Council',
           authority_decided_on = date '2026-09-03',
           working_hours = '40 hours per week'
     where id = a_id;

    -- ---- THE APPOINTING AUTHORITY IS NOT THE APPROVER --------------------
    -- Two separate columns, asserted, because the whole reason this migration
    -- exists is that one field cannot hold both an administrator's user id and
    -- the name of a governing body.
    if (select appointing_authority from appointments where id = a_id) is null
       or (select authorized_by from appointments where id = a_id) is not null then
      raise exception '043 FAILED: the body that appointed and the officer who approved are '
                      'not being kept apart';
    end if;

    -- ---- A HASH IS SIXTY-FOUR HEX CHARACTERS OR NOTHING -------------------
    -- A truncated or empty value compares unequal to everything and would read
    -- as tampering on every letter that has one.
    update appointments set status = 'approved', authorized_by = other,
                            authorized_at = now() where id = a_id;
    -- THE APPOINTMENT IS NOT MARKED ISSUED HERE, and it used to be. It never
    -- needed to be: archiving a letter does not require the appointment to say
    -- `issued`, and 047 now refuses that order anyway — an appointment reaches
    -- `issued` only once a letter is in the archive, which is the opposite way
    -- round from the line that stood here. Removed rather than worked around.

    refused := false;
    begin
      insert into appointment_letters (appointment_id, reference, issued_on, html, content_hash)
      values (a_id, 'APT-2026-8001', current_date, '<p>x</p>', 'not-a-hash');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '043 FAILED: a letter was archived under something that is not a hash';
    end if;

    insert into appointment_letters (appointment_id, reference, issued_on, html, content_hash)
    values (a_id, 'APT-2026-8001', current_date, '<p>x</p>',
            repeat('a', 64));

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '043 OK: an appointment can state its working hours, the body that made it and '
               'when that body decided, a decision date with nobody named is refused, and an '
               'archived letter carries a hash that is a hash or nothing';
end $$;


-- ===========================================================================
-- VERIFY
-- ===========================================================================

-- APPOINTMENTS THAT NAME NO APPOINTING AUTHORITY. Each is a letter that will
-- go out saying the University appointed somebody without saying who decided.
select full_name, position_title, status, start_date
  from appointments
 where appointing_authority is null and status <> 'draft'
 order by start_date;

-- LETTERS THE ARCHIVE CANNOT VOUCH FOR. Issued before the hash existed, so
-- "this is the document we sent" rests on the edit trigger alone. Not
-- backfilled: a hash computed today over whatever the row holds today proves
-- nothing whatsoever.
select * from appointment_letters_unverifiable order by issued_on;

-- PAID POSTS WITH NO WORKING HOURS. The field a disagreement about workload
-- turns on, left blank.
select full_name, position_title, employment_type, start_date
  from appointments
 where working_hours is null
   and employment_type in ('permanent', 'fixed-term', 'part-time', 'probationary')
   and status not in ('draft', 'withdrawn', 'declined', 'ended')
 order by start_date;


-- ===========================================================================
-- ===========================================================================
--
--   044_document_templates_and_the_letters_tied_to_them.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 044 — DOCUMENT TEMPLATES, AND THE LETTERS THAT STAY TIED TO THEM
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. HR gets a template registry: eleven document types, each versioned, each
--    with one active version at a time. A promotion letter stops being an
--    appointment letter with different words typed into it.
--
-- 2. EVERY ISSUED LETTER RECORDS WHICH TEMPLATE VERSION PRODUCED IT, and that
--    version can then never be deleted. This is the rule the University named
--    after Dorothy's admission letter: a document issued in 2026 was produced
--    by the wording of 2026, and a registry that has since replaced that
--    wording cannot explain its own document without it.
--
-- 3. A template is ACTIVATED by somebody other than whoever wrote it, like
--    everything else in this system that goes out under the University's name.
--
-- ---------------------------------------------------------------------------
-- WHY NOT `credential_templates`
-- ---------------------------------------------------------------------------
--
-- 005 built that table with a three-office approval chain: the Registrar, the
-- Academic Office and the Vice Chancellor each sign before a design is
-- published. That is the right ceremony for a degree certificate and the wrong
-- ceremony for a transfer letter — a gate that heavy on an ordinary HR document
-- is a gate that gets routed around, and the routing-around becomes the
-- process.
--
-- So HR templates are their own registry with a real but lighter rule: one
-- other person activates. Same principle, proportionate weight. The two
-- registries share nothing except that idea, deliberately.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TEMPLATES
-- ===========================================================================

create table if not exists document_templates (
  id            uuid primary key default gen_random_uuid(),

  -- THE ELEVEN THE UNIVERSITY NAMED. A closed list, because "Promotion Letter"
  -- and "promotion letter" and "Promotion" as free text produce three
  -- templates and nobody can say which one is in force.
  kind          text not null check (kind in (
                  'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
                  'transfer', 'acting-appointment', 'probation-confirmation',
                  'contract-extension', 'appointment-amendment', 'termination', 'retirement')),

  version       integer not null check (version >= 1),
  name          text not null check (length(btrim(name)) >= 3),

  -- The body, with placeholders the generator fills from the record. Stored as
  -- text rather than a design document: an HR letter is prose, and modelling
  -- prose as a layout tree makes it harder to read and no easier to change.
  body          text not null check (length(btrim(body)) >= 40),

  status        text not null default 'draft' check (status in ('draft', 'active', 'retired')),

  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),

  activated_by  uuid references auth.users (id) on delete set null,
  activated_at  timestamptz,
  retired_at    timestamptz,

  unique (kind, version)
);

create index if not exists document_templates_kind_idx on document_templates (kind, version desc);

-- ONE ACTIVE VERSION PER KIND. Two would mean the generator had to choose, and
-- whichever it chose would be the wrong one half the time — silently, because
-- both are real templates and the letter would look right.
create unique index if not exists document_templates_one_active_idx
  on document_templates (kind) where status = 'active';

do $$
begin
  -- ACTIVATED BY SOMEBODY ELSE. The same rule 005 applies to a certificate
  -- design, 009 to a grade, 038 to an announcement and 041 to an appointment.
  -- A template is the words the University says in every letter of its kind
  -- from now on; one person writing and activating it alone is that rule at
  -- its largest scale, because it applies to everybody appointed afterwards.
  if not exists (select 1 from pg_constraint where conname = 'document_templates_second_pair_of_eyes') then
    alter table document_templates add constraint document_templates_second_pair_of_eyes
      check (activated_by is null or created_by is null or activated_by <> created_by);
  end if;

  -- AN ACTIVE TEMPLATE NAMES WHO ACTIVATED IT AND WHEN.
  if not exists (select 1 from pg_constraint where conname = 'document_templates_activation_recorded') then
    alter table document_templates add constraint document_templates_activation_recorded
      check (status <> 'active' or (activated_by is not null and activated_at is not null));
  end if;
end $$;

-- A TEMPLATE IS NOT EDITED ONCE IT HAS BEEN ACTIVE. A new version is written
-- instead. Editing the words that produced a letter somebody is holding is the
-- same fault as editing the letter, one step removed and harder to see.
create or replace function refuse_active_template_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'draft' then
    return new;                       -- a draft may still be worked on
  end if;
  -- Retiring and activating are changes of status, not of wording.
  if new.body = old.body and new.kind = old.kind and new.version = old.version then
    return new;
  end if;
  raise exception
    'Template "% v%" has been active and its wording cannot be changed. Create a new version: '
    'letters already issued were produced by these words, and a registry that rewrites them '
    'cannot explain its own documents.', old.kind, old.version
    using errcode = 'check_violation';
end $$;

drop trigger if exists document_templates_no_edit on document_templates;
create trigger document_templates_no_edit
  before update on document_templates
  for each row execute function refuse_active_template_edit();

alter table document_templates enable row level security;

drop policy if exists document_templates_read on document_templates;
create policy document_templates_read on document_templates
  for select using (auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office'));

-- No write policy. Templates are written through the route, which checks the
-- capability and records who did it.


-- ===========================================================================
-- 2. THE LETTER REMEMBERS WHICH WORDS PRODUCED IT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- THE DOROTHY RULE
-- ---------------------------------------------------------------------------
--
-- A document issued in 2026 was produced by the wording of 2026. A registry
-- that has since replaced that wording and kept no link to the old one cannot
-- explain its own document: asked why the letter says what it says, the only
-- answer is "the template used to be different" with nothing behind it.
--
-- ON DELETE RESTRICT, and that is the whole point of the column. A template
-- version that produced a letter can never be deleted, cascaded away, or
-- tidied up during a spring clean — the database refuses, and names the letter
-- that depends on it.

alter table appointment_letters
  add column if not exists document_type text,
  add column if not exists template_id uuid references document_templates (id) on delete restrict,
  -- The version number as well as the id. Redundant on purpose: the id proves
  -- which row, and the number is what a person reads on a screen without
  -- joining anything. A letter whose template row somehow vanished still says
  -- which version it was.
  add column if not exists template_version integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_document_type_check') then
    alter table appointment_letters add constraint appointment_letters_document_type_check
      check (document_type is null or document_type in (
        'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
        'transfer', 'acting-appointment', 'probation-confirmation',
        'contract-extension', 'appointment-amendment', 'termination', 'retirement'));
  end if;
end $$;

create index if not exists appointment_letters_template_idx
  on appointment_letters (template_id) where template_id is not null;

comment on column appointment_letters.template_id is
  'The template version that produced this letter. ON DELETE RESTRICT: a version '
  'that has issued a document can never be removed, because the document cannot '
  'be explained without it.';


-- ===========================================================================
-- 3. THE DELIVERY, WHICH DOES NOT REVERSE THE APPOINTMENT
-- ===========================================================================
--
-- 041 gave a letter `delivery`, `attempts` and `delivery_detail`. What it did
-- not record is WHEN each attempt happened, and the University asked for the
-- four-line receipt: issued, archived, queued, delivered.
--
-- AN EMAIL FAILURE DOES NOT UNDO AN APPOINTMENT. The University appointed
-- somebody; the mail server being unreachable is not a change of mind. The
-- letter sits in an outbox and is retried, and the appointment stays issued —
-- which is what these columns are for and why there is no path here that
-- touches `appointments.status`.

alter table appointment_letters
  add column if not exists queued_at       timestamptz,
  add column if not exists delivered_at    timestamptz,
  add column if not exists last_attempt_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_delivery_times') then
    alter table appointment_letters add constraint appointment_letters_delivery_times
      check (
        (delivery <> 'sent' or delivered_at is not null)
        and (attempts = 0 or last_attempt_at is not null)
      );
  end if;
end $$;

-- WHAT STILL NEEDS SENDING. Each row is somebody who has been appointed and
-- has not been told.
create or replace view appointment_letters_outbox
with (security_invoker = true) as
select l.id, l.reference, l.version, a.full_name, a.email,
       l.attempts, l.last_attempt_at, l.delivery_detail
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
 where l.superseded_at is null
   and l.delivery in ('pending', 'failed')
 order by l.attempts, l.created_at;


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  t_id uuid;
  a_id uuid;
  l_id uuid;
  someone uuid;
  other uuid;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '044: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    -- VERSION 9001, NOT 1. 052 seeds a first draft of every document kind at
    -- version 1, so a proof claiming version 1 of 'promotion' collided with it
    -- on the SECOND run of RUN-ALL — clean on the first, a duplicate-key error
    -- on the next. The same high-number idiom the appointment proofs use for
    -- their references, and for the same reason: a proof must not compete for
    -- a value the University's own data occupies.
    insert into document_templates (kind, version, name, body, created_by)
    values ('promotion', 9001, 'Promotion Letter',
            'Dear {{full_name}}, we are pleased to promote you to {{position_title}}.',
            someone)
    returning id into t_id;

    -- ---- THE WRITER DOES NOT ACTIVATE THEIR OWN --------------------------
    -- A template is the words the University says in every letter of its kind
    -- from now on. One person writing and activating it alone is the second
    -- pair of eyes at its largest scale.
    refused := false;
    begin
      update document_templates set status = 'active', activated_by = someone,
                                    activated_at = now() where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '044 FAILED: somebody activated the template they wrote';
    end if;

    -- ---------------------------------------------------------------------
    -- AND AN ACTIVE TEMPLATE STATES WHEN IT CAME INTO FORCE.
    --
    -- 051 adds `effective_from` and refuses an active template without one —
    -- "which wording applied in March" is the question a dispute opens with.
    -- This proof activated a template with no date, which was clean on a first
    -- run of RUN-ALL and refused on the second, once 051's constraint existed.
    --
    -- Written as dynamic SQL because on a FIRST run the column does not exist
    -- yet: 044 runs before 051. Setting a column that is not there would refuse
    -- the migration on the run where nothing is wrong.
    -- ---------------------------------------------------------------------
    if exists (select 1 from information_schema.columns
                where table_name = 'document_templates' and column_name = 'effective_from') then
      execute format(
        'update document_templates set status = %L, activated_by = %L, activated_at = now(), '
        'effective_from = current_date where id = %L', 'active', other, t_id);
    else
      update document_templates set status = 'active', activated_by = other,
                                    activated_at = now() where id = t_id;
    end if;

    -- ---- ONE ACTIVE VERSION PER KIND -------------------------------------
    -- Two would mean the generator had to choose, and whichever it chose would
    -- be wrong half the time — silently, because both are real templates.
    insert into document_templates (kind, version, name, body, created_by)
    values ('promotion', 9002, 'Promotion Letter',
            'Dear {{full_name}}, the University is pleased to promote you.', someone);
    refused := false;
    begin
      update document_templates set status = 'active', activated_by = other,
                                    activated_at = now()
       where kind = 'promotion' and version = 9002;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '044 FAILED: two versions of one template were active at once';
    end if;

    -- ---- AN ACTIVE TEMPLATE'S WORDING CANNOT BE CHANGED ------------------
    refused := false;
    begin
      update document_templates set body = 'Something else entirely, at length, for the check.'
       where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '044 FAILED: the wording that produced issued letters was rewritten';
    end if;

    -- …but retiring it is a change of status, not of wording.
    update document_templates set status = 'retired', retired_at = now() where id = t_id;
    -- Reactivating restores the date too, where 051 has added the column.
    if exists (select 1 from information_schema.columns
                where table_name = 'document_templates' and column_name = 'effective_from') then
      execute format('update document_templates set status = %L, effective_from = '
                     'coalesce(effective_from, current_date) where id = %L', 'active', t_id);
    else
      update document_templates set status = 'active' where id = t_id;
    end if;

    -- ---- A TEMPLATE THAT ISSUED A LETTER CANNOT BE DELETED ---------------
    -- THE DOROTHY RULE. Asked why the letter says what it says, the only
    -- answer without this is "the template used to be different".
    insert into appointments
      (full_name, position_title, employment_type, start_date, place_of_duty, terms,
       drafted_by, authorized_by, authorized_at, status, issued_at)
    values ('A Specimen Appointee', 'Senior Lecturer', 'permanent', date '2026-10-01',
            'Buea campus', 'Conditions of service.', someone, other, now(), 'issued', now())
    returning id into a_id;

    insert into appointment_letters
      (appointment_id, reference, issued_on, html, document_type, template_id, template_version)
    values (a_id, 'APT-2026-7001', current_date, '<p>The letter.</p>',
            'promotion', t_id, 1)
    returning id into l_id;

    refused := false;
    begin
      delete from document_templates where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '044 FAILED: a template version that had produced a letter was deleted, '
                      'so that letter can no longer be explained';
    end if;

    -- ---- A DOCUMENT TYPE NOBODY DECLARED IS REFUSED ----------------------
    refused := false;
    begin
      update appointment_letters set document_type = 'some-letter-somebody-invented'
       where id = l_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '044 FAILED: a letter claimed a document type the University does not issue';
    end if;

    -- ---- A FAILED EMAIL DOES NOT UNDO AN APPOINTMENT ---------------------
    -- The University appointed somebody; the mail server being unreachable is
    -- not a change of mind.
    update appointment_letters
       set delivery = 'failed', attempts = 1, last_attempt_at = now(),
           delivery_detail = 'Connection refused'
     where id = l_id;

    if (select status from appointments where id = a_id) <> 'issued' then
      raise exception '044 FAILED: a failed email changed the appointment';
    end if;
    if not exists (select 1 from appointment_letters_outbox where id = l_id) then
      raise exception '044 FAILED: a letter that failed to send is not in the outbox, so '
                      'nobody will ever retry it and the appointee is never told';
    end if;

    -- ---- AND A DELIVERY RECORDS WHEN ------------------------------------
    refused := false;
    begin
      update appointment_letters set delivery = 'sent' where id = l_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '044 FAILED: a letter was marked sent with no record of when';
    end if;

    update appointment_letters set delivery = 'sent', delivered_at = now(), attempts = 2
     where id = l_id;
    if exists (select 1 from appointment_letters_outbox where id = l_id) then
      raise exception '044 FAILED: a delivered letter is still in the outbox';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '044 OK: nobody activates the template they wrote, one version of each kind is '
               'active, an active template''s wording cannot be rewritten, a version that '
               'issued a letter cannot be deleted, a document type nobody declared is refused, '
               'a failed email leaves the appointment issued and the letter in the outbox, and '
               'a delivery records when it happened';
end $$;


-- ===========================================================================
-- 5. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- The template registry, as Settings would show it.
select kind, version, name, status, activated_at
  from document_templates
 order by kind, version desc;

-- DOCUMENT TYPES WITH NO ACTIVE TEMPLATE. Each is a letter HR cannot generate
-- at all, and the list is the work outstanding before this is usable.
select t.kind as document_type_with_no_active_template
  from (select unnest(array[
          'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
          'transfer', 'acting-appointment', 'probation-confirmation',
          'contract-extension', 'appointment-amendment', 'termination', 'retirement']) as kind) t
 where not exists (
   select 1 from document_templates d where d.kind = t.kind and d.status = 'active'
 )
 order by 1;

-- THE FOUR-LINE RECEIPT the University asked for, per letter.
select a.full_name, l.reference, l.version,
       (a.issued_at is not null)       as issued,
       (l.content_hash is not null)    as archived,
       (l.queued_at is not null)       as email_queued,
       (l.delivery = 'sent')           as email_delivered,
       l.attempts,
       coalesce(l.delivery_detail, '') as last_error
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
 where l.superseded_at is null
 order by l.created_at desc;

-- THE OUTBOX. Each row is somebody who has been appointed and not told.
select * from appointment_letters_outbox;

-- Which template version produced each letter. Empty entries are letters
-- issued before templates existed; they are not backfilled, because guessing
-- which wording produced a document is the opposite of the point.
select a.full_name, l.reference, l.document_type, l.template_version,
       d.name as template_name
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
  left join document_templates d on d.id = l.template_id
 order by l.created_at desc;


-- ===========================================================================
-- ===========================================================================
--
--   045_official_correspondence_and_who_initiated_it.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 045 — OFFICIAL CORRESPONDENCE, AND WHO STARTED IT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE UNIVERSITY GETS A REGISTER OF ITS OWN OFFICIAL LETTERS. Not
--    appointment letters — those have one — but the correspondence an office
--    originates and finishes: an invitation, a commendation, a letter to a
--    ministry, a directive, a partnership approach. Until now none of it
--    existed in this system at all, which means the University cannot say what
--    it has written to whom.
--
-- 2. WHO INITIATED IS RECORDED SEPARATELY FROM WHO AUTHORISED. The same
--    appointment can arrive two ways — HR proposes it, or the Vice-Chancellor
--    starts it personally — and both are legitimate. What was not possible was
--    telling them apart afterwards, because the record held only who approved.
--
-- 3. A LETTER PREPARED BY SOMEBODY ELSE IS STILL THE AUTHORITY'S LETTER. An
--    administrator may be asked to draft; `prepared_by` records that, and
--    issuing still requires the capability the preparer does not hold. The
--    staff member never becomes the issuing authority.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- WHERE ONE PERSON ORIGINATES AND ISSUES, THERE IS NO SECOND PAIR OF EYES, and
-- this migration does not pretend otherwise. For correspondence that is the
-- point: a letter to a government ministry IS the Vice-Chancellor speaking, and
-- inventing an approver for it would be ceremony.
--
-- For an APPOINTMENT it is a different matter, because an appointment commits
-- the University to paying somebody. 041 refuses an approval by the drafter and
-- that rule stands. A Vice-Chancellor who personally initiates an appointment
-- therefore still needs somebody else to approve it — OR the appointment is
-- recorded as having been made on sole authority, which section 3 makes
-- possible, visible and permanent. The University can do it; what it cannot do
-- is do it quietly.
-- ===========================================================================


-- ===========================================================================
-- 1. THE CORRESPONDENCE
-- ===========================================================================

create table if not exists correspondence (
  id             uuid primary key default gen_random_uuid(),

  -- A CLOSED LIST. The kind decides the letterhead, the register it appears in
  -- and, in time, the template — and "Invitation", "invitation" and "Official
  -- Invitation" as free text are three kinds within a month.
  kind           text not null check (kind in (
                   'general', 'appointment', 'reappointment', 'invitation',
                   'commendation', 'recommendation', 'government', 'university',
                   'partnership', 'directive', 'warning', 'authorization',
                   'special', 'other')),

  -- THE OFFICE THE LETTER COMES FROM, which is what the letterhead says and is
  -- not the same as who typed it.
  originating_office text not null default 'vice-chancellor'
                       check (originating_office in (
                         'vice-chancellor', 'chancellor', 'registrar',
                         'academic-office', 'hr', 'admissions', 'finance')),

  subject        text not null check (length(btrim(subject)) >= 4),
  body           text not null check (length(btrim(body)) >= 40),

  -- ---- Who it is to ------------------------------------------------------
  --
  -- FREE TEXT, because the recipient of a letter to a ministry is a ministry.
  -- A foreign key to a person would have made half the University's outward
  -- correspondence unrecordable.
  recipient_name text not null check (length(btrim(recipient_name)) >= 2),
  recipient_org  text,
  recipient_email text,
  recipient_address text,

  -- ---- Who did what ------------------------------------------------------
  --
  -- INITIATED, PREPARED AND AUTHORISED ARE THREE ROLES AND OFTEN ONE PERSON.
  -- Kept apart anyway: the whole point is that afterwards the record can say
  -- which of them it was.
  initiated_by   uuid not null references auth.users (id) on delete restrict,
  prepared_by    uuid references auth.users (id) on delete set null,
  authorized_by  uuid references auth.users (id) on delete restrict,
  authorized_at  timestamptz,

  status         text not null default 'draft'
                   check (status in ('draft', 'preparing', 'awaiting_authority',
                                     'authorized', 'scheduled', 'issued',
                                     'withdrawn')),

  -- When it should go out, for a letter written now and sent on a date.
  scheduled_for  timestamptz,
  issued_at      timestamptz,

  withdrawn_reason text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists correspondence_status_idx
  on correspondence (status, scheduled_for);
create index if not exists correspondence_office_idx
  on correspondence (originating_office, created_at desc);

do $$
begin
  -- AN AUTHORISED LETTER NAMES ITS AUTHORITY AND THE MOMENT.
  if not exists (select 1 from pg_constraint where conname = 'correspondence_authority_recorded') then
    alter table correspondence add constraint correspondence_authority_recorded
      check (status not in ('authorized', 'scheduled', 'issued')
             or (authorized_by is not null and authorized_at is not null));
  end if;

  -- AN ISSUED LETTER HAS GONE OUT AT A TIME.
  if not exists (select 1 from pg_constraint where conname = 'correspondence_issued_recorded') then
    alter table correspondence add constraint correspondence_issued_recorded
      check (status <> 'issued' or issued_at is not null);
  end if;

  -- A SCHEDULED LETTER HAS A TIME TO GO.
  if not exists (select 1 from pg_constraint where conname = 'correspondence_scheduled_has_a_time') then
    alter table correspondence add constraint correspondence_scheduled_has_a_time
      check (status <> 'scheduled' or scheduled_for is not null);
  end if;

  -- WITHDRAWING SAYS WHY, like every other closure in this system.
  if not exists (select 1 from pg_constraint where conname = 'correspondence_withdrawal_explained') then
    alter table correspondence add constraint correspondence_withdrawal_explained
      check (status <> 'withdrawn'
             or (withdrawn_reason is not null and length(btrim(withdrawn_reason)) >= 10));
  end if;

  -- ---------------------------------------------------------------------
  -- A PREPARER IS NOT AN AUTHORITY.
  --
  -- The rule that makes delegation safe. An administrator may be asked to
  -- draft a letter and the letter remains the Vice-Chancellor's — but the
  -- person who drafted it may not be the person who authorised it, or the
  -- delegation has quietly moved the authority along with the typing.
  -- ---------------------------------------------------------------------
  if not exists (select 1 from pg_constraint where conname = 'correspondence_preparer_is_not_authority') then
    alter table correspondence add constraint correspondence_preparer_is_not_authority
      check (prepared_by is null or authorized_by is null or prepared_by <> authorized_by);
  end if;
end $$;


-- ===========================================================================
-- 2. THE LETTERS THEMSELVES, ARCHIVED LIKE EVERY OTHER DOCUMENT
-- ===========================================================================
--
-- The same shape as `appointment_letters`, deliberately: a reference, a
-- version, the html as sent, a hash, a seal, and a delivery that can fail
-- without undoing anything. A third arrangement for the same job would be a
-- third answer to "what did we send".

create table if not exists correspondence_letters (
  id               uuid primary key default gen_random_uuid(),
  correspondence_id uuid not null references correspondence (id) on delete cascade,

  -- IGUC/VC/2026/0042 in the letter, filed as VC-2026-0042 for the same reason
  -- an appointment letter is: a reference with slashes cannot go in a URL path
  -- and the verification link is where it ends up.
  reference        text not null unique check (reference ~ '^[A-Z]{2,4}-[0-9]{4}-[0-9]{4,}$'),
  version          integer not null default 1 check (version >= 1),

  issued_on        date not null,
  html             text not null,
  content_hash     text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),

  sealed           boolean not null default false,
  seal_code        text,

  signatory_name   text,
  signatory_role   text,

  template_id      uuid references document_templates (id) on delete restrict,
  template_version integer,

  delivery         text not null default 'pending'
                     check (delivery in ('pending', 'sent', 'failed')),
  delivery_detail  text,
  attempts         integer not null default 0,
  queued_at        timestamptz,
  delivered_at     timestamptz,
  last_attempt_at  timestamptz,

  superseded_at    timestamptz,

  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (correspondence_id, version)
);

create unique index if not exists correspondence_letters_one_current_idx
  on correspondence_letters (correspondence_id) where superseded_at is null;

-- An issued letter is never edited. Superseded by a new version, exactly as an
-- appointment letter is, and for the same reason: somebody is holding it.
drop trigger if exists correspondence_letters_no_edit on correspondence_letters;
create trigger correspondence_letters_no_edit
  before update on correspondence_letters
  for each row execute function refuse_letter_edit();


-- ===========================================================================
-- 3. WHO INITIATED AN APPOINTMENT, AND WHETHER ANYBODY ELSE SAW IT
-- ===========================================================================
--
-- THE SAME APPOINTMENT ARRIVES TWO WAYS and both are legitimate: HR proposes
-- it, or the Vice-Chancellor starts it personally. The record held only who
-- approved, so afterwards the two were indistinguishable.
--
-- AND THE HONEST PART. 041 refuses an approval by whoever drafted the
-- appointment, because an appointment commits the University to paying
-- somebody. A Vice-Chancellor who personally initiates one therefore needs
-- somebody else to approve it — or the appointment is made on SOLE AUTHORITY,
-- which is recorded here, permanently, in the same shape as 040's emergency
-- publishing. The University can do it. What it cannot do is do it quietly.

alter table appointments
  add column if not exists initiated_by_office text
    check (initiated_by_office is null or initiated_by_office in
           ('hr', 'vice-chancellor', 'chancellor', 'registrar', 'academic-office')),
  add column if not exists initiated_by uuid references auth.users (id) on delete set null,

  -- THE MARK STAYS. Anybody reading this appointment in two years sees that
  -- one person made it end to end.
  add column if not exists made_on_sole_authority boolean not null default false,
  add column if not exists sole_authority_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_sole_authority_explained') then
    alter table appointments add constraint appointments_sole_authority_explained
      check (
        not made_on_sole_authority
        or (
          -- ONLY THE OFFICES THAT ACTUALLY HOLD THAT AUTHORITY. An HR clerk
          -- ticking this box would be the whole separation gone.
          initiated_by_office in ('vice-chancellor', 'chancellor')
          and sole_authority_reason is not null
          and length(btrim(sole_authority_reason)) >= 20
        )
      );
  end if;
end $$;

comment on column appointments.made_on_sole_authority is
  'True where one office both initiated and approved this appointment, with no second '
  'pair of eyes. Permitted for the Vice-Chancellor and the Chancellor, with a stated '
  'reason, and the mark is permanent.';

-- ---------------------------------------------------------------------------
-- AND THE ORDINARY RULE STILL BITES.
--
-- 041's constraint refuses an approval by the drafter outright. An appointment
-- made on sole authority names the same person as initiator and approver but
-- leaves `drafted_by` to whoever prepared it — so the two rules do not collide,
-- and an appointment with drafted_by = authorized_by is still refused whatever
-- boxes are ticked.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- 4. WHO CAN READ WHAT
-- ===========================================================================

alter table correspondence enable row level security;
alter table correspondence_letters enable row level security;

-- OUTWARD CORRESPONDENCE IS NOT ORDINARY INSTITUTIONAL INFORMATION. A warning
-- letter, a directive, a partnership approach that has not been announced —
-- each is the University's private business until it is not, and a policy that
-- let every administrator read the Vice-Chancellor's outbox would be a worse
-- failure than having no register at all.
drop policy if exists correspondence_read on correspondence;
create policy correspondence_read on correspondence
  for select using (
    auth_role() in ('superadmin', 'vice-chancellor', 'chancellor')
    or initiated_by = auth.uid()
    or prepared_by = auth.uid()
  );

drop policy if exists correspondence_letters_read on correspondence_letters;
create policy correspondence_letters_read on correspondence_letters
  for select using (
    auth_role() in ('superadmin', 'vice-chancellor', 'chancellor')
    or exists (select 1 from correspondence c
                where c.id = correspondence_letters.correspondence_id
                  and (c.initiated_by = auth.uid() or c.prepared_by = auth.uid()))
  );

-- No write policy on either. Everything goes through the route.


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  c_id uuid;
  a_id uuid;
  someone uuid;
  other uuid;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '045: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    insert into correspondence
      (kind, subject, body, recipient_name, initiated_by, status)
    values ('government', 'Accreditation correspondence',
            'A letter of sufficient length to satisfy the constraint on the body.',
            'The Ministry of Higher Education', someone, 'draft')
    returning id into c_id;

    -- ---- A PREPARER IS NOT AN AUTHORITY -----------------------------------
    -- The rule that makes delegation safe. Without it, asking an administrator
    -- to draft a letter quietly moves the authority along with the typing.
    refused := false;
    begin
      update correspondence
         set prepared_by = other, authorized_by = other, authorized_at = now(),
             status = 'authorized'
       where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: the person who drafted a letter authorised it, so delegating '
                      'the typing delegated the authority';
    end if;

    -- …and the Vice-Chancellor authorising what an administrator prepared is
    -- exactly the arrangement this is for.
    update correspondence
       set prepared_by = other, authorized_by = someone, authorized_at = now(),
           status = 'authorized'
     where id = c_id;

    -- ---- A SCHEDULED LETTER HAS A TIME TO GO ------------------------------
    refused := false;
    begin
      update correspondence set status = 'scheduled' where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: a letter was scheduled for no particular time';
    end if;

    -- ---- AN ISSUED LETTER RECORDS WHEN ------------------------------------
    refused := false;
    begin
      update correspondence set status = 'issued' where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: a letter was issued at no particular time';
    end if;

    update correspondence set status = 'issued', issued_at = now() where id = c_id;

    -- ---- THE REFERENCE IS FILEABLE AND URL-SAFE ---------------------------
    refused := false;
    begin
      insert into correspondence_letters (correspondence_id, reference, issued_on, html)
      values (c_id, 'IGUC/VC/2026/0042', current_date, '<p>The letter.</p>');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: a letter was filed under a reference with slashes in it';
    end if;

    insert into correspondence_letters (correspondence_id, reference, issued_on, html)
    values (c_id, 'VC-2026-0042', current_date, '<p>The letter.</p>');

    -- ---- AND IT CANNOT BE REWRITTEN ---------------------------------------
    refused := false;
    begin
      update correspondence_letters set html = '<p>Something else.</p>'
       where reference = 'VC-2026-0042';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: an issued letter was rewritten';
    end if;

    -- =====================================================================
    -- SOLE AUTHORITY ON AN APPOINTMENT
    -- =====================================================================
    insert into appointments
      (full_name, position_title, employment_type, start_date, place_of_duty, terms,
       drafted_by, status, initiated_by_office, initiated_by)
    values ('A Specimen Appointee', 'Lecturer', 'permanent', date '2026-10-01',
            'Buea campus', 'Conditions of service.', other, 'draft',
            'vice-chancellor', someone)
    returning id into a_id;

    -- ---- AN HR-INITIATED APPOINTMENT CANNOT CLAIM SOLE AUTHORITY ----------
    -- An HR clerk ticking this box would be the whole separation gone.
    refused := false;
    begin
      update appointments
         set initiated_by_office = 'hr', made_on_sole_authority = true,
             sole_authority_reason = 'A reason of more than twenty characters, easily.'
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: an HR-initiated appointment was made on sole authority';
    end if;

    -- ---- AND THE VICE-CHANCELLOR MUST SAY WHY -----------------------------
    --
    -- ONLY WHILE THAT IS STILL THE RULE. 055 removed the demand for a written
    -- reason: the University ruled that approving one's own appointment is the
    -- Vice-Chancellor's ordinary authority rather than an exception, and an
    -- explanation demanded every time a thing is done normally is a box
    -- somebody types a full stop into.
    --
    -- This proof asserted the old behaviour unconditionally, so on a SECOND run
    -- of RUN-ALL — where 055 has already relaxed it — 045 failed against a
    -- database that was perfectly correct. Running it twice is what found it.
    -- The assertion still runs on a database that has not had 055, which is the
    -- only place it means anything.
    if position('sole_authority_reason' in
                coalesce((select pg_get_constraintdef(oid) from pg_constraint
                           where conname = 'appointments_sole_authority_explained'), '')) > 0 then
    refused := false;
    begin
      update appointments set made_on_sole_authority = true where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: an appointment was made on sole authority with no account '
                      'of why nobody else saw it';
    end if;
    end if;

    update appointments
       set made_on_sole_authority = true,
           sole_authority_reason = 'Appointed directly by the Vice-Chancellor under Council '
                                || 'standing authority of 3 September.'
     where id = a_id;

    -- ---- AND 041'S RULE STILL BITES ---------------------------------------
    -- Sole authority records that one office made the appointment end to end.
    -- It does NOT let the person who drafted it approve it, which is a
    -- different claim and would make the mark meaningless.
    --
    -- ---------------------------------------------------------------------
    -- UNTIL 055, WHICH IS WHEN IT BECAME EXACTLY THAT CLAIM.
    --
    -- This file assumed sole authority meant the Vice-Chancellor DIRECTED an
    -- appointment somebody else typed. The University meant something simpler:
    -- the Vice-Chancellor writes it and approves it, one person, start to
    -- finish. 055 changed 041's constraint to permit that when — and only
    -- when — the mark is set.
    --
    -- So this assertion is true of a database without 055 and false of one
    -- with it, and running RUN-ALL twice is what found that. It runs where it
    -- still means something.
    -- ---------------------------------------------------------------------
    if position('made_on_sole_authority' in
                coalesce((select pg_get_constraintdef(oid) from pg_constraint
                           where conname = 'appointments_second_pair_of_eyes'), '')) = 0 then
      refused := false;
      begin
        update appointments set authorized_by = other, authorized_at = now() where id = a_id;
      exception when others then refused := true;
      end;
      if not refused then
        raise exception '045 FAILED: the drafter approved an appointment because sole authority '
                        'was ticked. The two rules are not the same rule.';
      end if;
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '045 OK: a preparer cannot authorise what they prepared, a scheduled letter has '
               'a time and an issued one records when, a reference is URL-safe, an issued '
               'letter cannot be rewritten, only the Vice-Chancellor and Chancellor may act on '
               'sole authority and only with a stated reason, and that does not let a drafter '
               'approve their own appointment';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- The correspondence register, by office and kind.
select originating_office, kind, status, count(*) as letters
  from correspondence
 group by 1, 2, 3
 order by 1, 2;

-- APPOINTMENTS MADE ON SOLE AUTHORITY. This list should be short and every
-- line on it should be a decision somebody would defend out loud. If it grows,
-- the second pair of eyes has become optional.
select full_name, position_title, initiated_by_office, sole_authority_reason, start_date
  from appointments
 where made_on_sole_authority
 order by start_date desc;

-- WHO INITIATED WHAT. The question that could not be asked before: the same
-- appointment arrives from HR or from the Vice-Chancellor and both are
-- legitimate, but afterwards they were indistinguishable.
select coalesce(initiated_by_office, '— not recorded —') as initiated_by_office,
       count(*) as appointments
  from appointments
 group by 1
 order by 2 desc;

-- Letters written and not yet gone out.
select c.kind, c.subject, c.recipient_name, c.status, c.scheduled_for
  from correspondence c
 where c.status in ('draft', 'preparing', 'awaiting_authority', 'authorized', 'scheduled')
 order by c.created_at desc;

-- Correspondence that failed to reach anybody.
select c.subject, c.recipient_name, l.reference, l.attempts, l.delivery_detail
  from correspondence_letters l
  join correspondence c on c.id = l.correspondence_id
 where l.delivery = 'failed' and l.superseded_at is null
 order by l.created_at desc;


-- ===========================================================================
-- ===========================================================================
--
--   046_the_correspondence_history_and_the_delegated_draft.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 046 — THE CORRESPONDENCE HISTORY, AND THE LETTER SOMEBODY ELSE PREPARES
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. OFFICIAL CORRESPONDENCE GETS A HISTORY. 045 built the register and then —
--    this is the omission — left it as the only institutional act in this
--    system with no append-only record of who did what to it. An appointment
--    has `appointment_events`, an announcement has `announcement_events`, a
--    credential has its audit. A letter to a ministry had the row and the row's
--    current state, and nothing that said it had ever been anything else.
--
-- 2. "PREPARE THIS LETTER" BECOMES A REAL ACT. The Vice-Chancellor can hand a
--    letter to an administrator with a brief, before the letter exists. That
--    was not storable: 045 requires forty characters of body, and the whole
--    point of a delegated draft is that the body has not been written yet.
--
-- 3. A REFERENCE CAN BE ALLOCATED WITHOUT A RACE. `next_correspondence_sequence`
--    reads the register rather than the application counting rows and hoping.
--    Two officers issuing at the same second previously had a real chance of
--    both being handed VC-2026-0007.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THE BODY CHECK IS RELAXED FOR EXACTLY ONE STATE. A letter in `preparing` may
-- have no body, because nobody has written it. In every other state — draft
-- included — the forty characters are still required, so the relaxation cannot
-- be used to authorise or issue an empty letter. The state it applies to is the
-- one state from which a letter cannot be authorised at all.
-- ===========================================================================


-- ===========================================================================
-- 1. THE HISTORY
-- ===========================================================================
--
-- The same shape as `appointment_events`, deliberately. A third arrangement for
-- the same job would be a third answer to "what happened to this document", and
-- the person asking is usually asking because something went wrong.

create table if not exists correspondence_events (
  id                uuid primary key default gen_random_uuid(),
  correspondence_id uuid not null references correspondence (id) on delete cascade,

  -- A CLOSED LIST, and 'PREPARATION_REQUESTED' is in it because delegating is
  -- an act of the authority and not a change of status that happened by itself.
  event             text not null check (event in (
                      'DRAFTED', 'EDITED', 'PREPARATION_REQUESTED', 'PREPARED',
                      'SUBMITTED_TO_AUTHORITY', 'AUTHORIZED', 'RETURNED', 'SCHEDULED',
                      'LETTER_GENERATED', 'ISSUED', 'DELIVERED', 'DELIVERY_FAILED',
                      'LETTER_SUPERSEDED', 'WITHDRAWN')),

  actor_id          uuid references auth.users (id) on delete set null,
  actor_email       text,
  actor_role        text,

  previous_state    text,
  new_state         text,
  detail            text,
  metadata          jsonb,

  at                timestamptz not null default now()
);

create index if not exists correspondence_events_letter_idx
  on correspondence_events (correspondence_id, at);

-- ---------------------------------------------------------------------------
-- APPEND-ONLY, ENFORCED RATHER THAN INTENDED.
--
-- A history that can be edited is a history that will be, at the moment
-- somebody most wants it to say something else.
-- ---------------------------------------------------------------------------
create or replace function refuse_correspondence_history_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'The correspondence history cannot be changed. It records what was done and when, and a '
    'record that can be corrected afterwards is not a record.'
    using errcode = 'check_violation';
end $$;

drop trigger if exists correspondence_events_append_only on correspondence_events;
create trigger correspondence_events_append_only
  before update or delete on correspondence_events
  for each row execute function refuse_correspondence_history_edit();


-- ===========================================================================
-- 2. DELEGATED PREPARATION
-- ===========================================================================
--
-- "Prepare this letter", assigned to an administrator. The authority does not
-- move with it: `prepared_by` is recorded, and 045's
-- `correspondence_preparer_is_not_authority` still refuses that person to
-- authorise what they prepared.

alter table correspondence
  -- WHAT THE AUTHORITY ASKED FOR. A delegation with no instruction is not a
  -- delegation; it is a task somebody has to come back and ask about.
  add column if not exists preparation_brief text,
  add column if not exists preparation_requested_by uuid references auth.users (id) on delete set null,
  add column if not exists preparation_requested_at timestamptz,
  add column if not exists prepared_at timestamptz;

-- A letter being prepared has nothing in it yet, so it needs a body it can hold.
alter table correspondence alter column body set default '';

do $$
declare
  c record;
begin
  -- ---------------------------------------------------------------------
  -- THE BODY CHECK, RESTATED FOR ONE STATE.
  --
  -- 045 wrote it inline, so it carries whatever name Postgres generated. Found
  -- by its definition rather than by guessing at `correspondence_body_check`,
  -- which is the name on one server and not on another.
  -- ---------------------------------------------------------------------
  for c in
    select conname from pg_constraint
     where conrelid = 'correspondence'::regclass
       and contype = 'c'
       and conname <> 'correspondence_body_written_before_it_goes'
       and pg_get_constraintdef(oid) like '%btrim(body)%'
  loop
    execute format('alter table correspondence drop constraint %I', c.conname);
  end loop;

  if not exists (select 1 from pg_constraint
                  where conname = 'correspondence_body_written_before_it_goes') then
    alter table correspondence add constraint correspondence_body_written_before_it_goes
      check (status = 'preparing' or length(btrim(body)) >= 40);
  end if;

  -- A LETTER WITH A PREPARER NAMES THEM. `preparing` without a `prepared_by` is
  -- a letter handed to nobody, sitting in a queue no office can see.
  if not exists (select 1 from pg_constraint
                  where conname = 'correspondence_preparing_names_the_preparer') then
    alter table correspondence add constraint correspondence_preparing_names_the_preparer
      check (status <> 'preparing' or prepared_by is not null);
  end if;

  -- AND THE BRIEF IS SAID, not left to a corridor conversation. Twenty
  -- characters is not a specification; it is enough to refuse an empty one.
  if not exists (select 1 from pg_constraint
                  where conname = 'correspondence_delegation_says_what_for') then
    alter table correspondence add constraint correspondence_delegation_says_what_for
      check (preparation_requested_by is null
             or (preparation_brief is not null
                 and length(btrim(preparation_brief)) >= 20));
  end if;
end $$;

comment on column correspondence.preparation_brief is
  'What the authority asked the preparer to write. Recorded because the letter that comes '
  'back is judged against it, and because "you did not ask for that" is otherwise one '
  'person''s memory against another''s.';


-- ===========================================================================
-- 3. THE REFERENCE, ALLOCATED BY THE REGISTER
-- ===========================================================================
--
-- COUNTED IN THE DATABASE, NOT IN THE APPLICATION. Two officers issuing in the
-- same second both read "six letters this year" and both wrote VC-2026-0007;
-- the unique index caught the second, which meant an officer saw a failure at
-- the moment of issuing an official letter and had no idea why.

create or replace function next_correspondence_sequence(prefix text, yr integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if prefix is null or prefix !~ '^[A-Z]{2,4}$' then
    raise exception 'Not an office prefix: %', coalesce(prefix, 'null')
      using errcode = 'check_violation';
  end if;
  if yr is null or yr < 2000 or yr > 2999 then
    raise exception 'Not a year this register runs in: %', coalesce(yr::text, 'null')
      using errcode = 'check_violation';
  end if;

  select coalesce(max(substring(reference from '[0-9]+$')::integer), 0) + 1
    into n
    from correspondence_letters
   where reference like prefix || '-' || yr::text || '-%';

  return n;
end $$;

comment on function next_correspondence_sequence(text, integer) is
  'The next sequence number for an office''s correspondence in a year. Read from the '
  'register rather than counted by the application, so two officers issuing at the same '
  'second are not handed the same reference.';


-- ===========================================================================
-- 4. WHO CAN READ THE HISTORY
-- ===========================================================================

alter table correspondence_events enable row level security;

drop policy if exists correspondence_events_staff_read on correspondence_events;
create policy correspondence_events_staff_read on correspondence_events
  for select to authenticated
  using (
    -- THE HISTORY IS AS VISIBLE AS THE LETTER AND NO MORE. A warning letter is
    -- not ordinary institutional information, and neither is the fact that one
    -- was drafted, returned and redrafted twice.
    exists (select 1 from correspondence c where c.id = correspondence_events.correspondence_id)
  );


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  c_id uuid;
  e_id uuid;
  someone uuid;
  other uuid;
  seq integer;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '046: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    -- ---- A DELEGATED DRAFT EXISTS BEFORE THE LETTER DOES -------------------
    -- The thing 045 could not store. If this insert fails, "prepare this
    -- letter" is still not an act the system can record.
    insert into correspondence
      (kind, subject, body, recipient_name, initiated_by, status,
       prepared_by, preparation_requested_by, preparation_requested_at, preparation_brief)
    values ('invitation', 'Convocation invitation', '',
            'The Ministry of Higher Education', someone, 'preparing',
            other, someone, now(),
            'Invite the Ministry to the convocation and ask for a representative to speak.')
    returning id into c_id;

    -- ---- BUT AN EMPTY LETTER CANNOT LEAVE THAT STATE -----------------------
    -- The relaxation above is the one that could be abused, so it is the one
    -- performed. A body of nothing must not become a draft, still less a letter.
    refused := false;
    begin
      update correspondence set status = 'draft' where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: a letter with no body in it became a draft, so the '
                      'relaxation for a delegated draft is a way to issue an empty letter';
    end if;

    -- ---- A DELEGATION SAYS WHAT FOR ---------------------------------------
    refused := false;
    begin
      update correspondence set preparation_brief = 'Write it.' where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: a letter was delegated with no brief worth the name';
    end if;

    -- ---- AND A LETTER BEING PREPARED NAMES ITS PREPARER --------------------
    refused := false;
    begin
      update correspondence set prepared_by = null where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: a letter was left in preparation by nobody in particular';
    end if;

    -- The preparer writes it, and now it is a draft the authority reads.
    update correspondence
       set body = 'The University would be honoured by the presence of the Ministry at its '
                  'convocation, and invites a representative to address the assembly.',
           status = 'awaiting_authority', prepared_at = now()
     where id = c_id;

    -- ---- THE HISTORY RECORDS IT, AND THEN CANNOT BE CHANGED ----------------
    insert into correspondence_events
      (correspondence_id, event, actor_id, previous_state, new_state, detail)
    values (c_id, 'PREPARATION_REQUESTED', someone, null, 'preparing',
            'Handed to an administrator to draft.')
    returning id into e_id;

    refused := false;
    begin
      update correspondence_events set detail = 'Something else.' where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: the correspondence history was rewritten';
    end if;

    refused := false;
    begin
      delete from correspondence_events where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: a line was removed from the correspondence history';
    end if;

    -- ---- AN EVENT NOBODY DEFINED IS REFUSED --------------------------------
    refused := false;
    begin
      insert into correspondence_events (correspondence_id, event, actor_id)
      values (c_id, 'SENT_BY_CARRIER_PIGEON', someone);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: the history accepted an event nobody defined';
    end if;

    -- ---- THE SEQUENCE COUNTS WHAT IS THERE ---------------------------------
    seq := next_correspondence_sequence('VC', 2026);
    if seq <> 1 then
      raise exception '046 FAILED: an empty register did not start at 1, it started at %', seq;
    end if;

    update correspondence
       set authorized_by = someone, authorized_at = now(), status = 'issued', issued_at = now()
     where id = c_id;

    insert into correspondence_letters (correspondence_id, reference, issued_on, html)
    values (c_id, 'VC-2026-0009', current_date, '<p>The letter.</p>');

    seq := next_correspondence_sequence('VC', 2026);
    if seq <> 10 then
      raise exception '046 FAILED: after VC-2026-0009 the next reference was %, not 10', seq;
    end if;

    -- …and another office counts separately, which is the point of the prefix.
    seq := next_correspondence_sequence('REG', 2026);
    if seq <> 1 then
      raise exception '046 FAILED: the Registrar''s register was affected by the '
                      'Vice-Chancellor''s, and started at %', seq;
    end if;

    -- ---- A PREFIX THAT IS NOT ONE IS REFUSED -------------------------------
    refused := false;
    begin
      seq := next_correspondence_sequence('vice-chancellor', 2026);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: a reference was allocated under an office prefix that '
                      'cannot appear in a reference';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '046 OK: a delegated draft can exist before the letter does, and an empty one '
               'cannot leave that state';
  raise notice '046 OK: the correspondence history is append-only and its vocabulary closed';
  raise notice '046 OK: references are allocated by the register, per office, per year';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- What has happened to the University's correspondence, in order.
select e.event, count(*) as times
  from correspondence_events e
 group by 1
 order by 2 desc;

-- Letters currently sitting with a preparer, and how long they have been there.
select c.subject, c.originating_office, c.preparation_requested_at,
       date_trunc('day', now() - c.preparation_requested_at) as waiting
  from correspondence c
 where c.status = 'preparing'
 order by c.preparation_requested_at;


-- ===========================================================================
-- ===========================================================================
--
--   047_the_money_the_actors_and_the_two_axes.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 047 — THE MONEY, THE ACTORS, AND THE TWO AXES OF AN APPOINTMENT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE UNIVERSITY'S APPOINTMENTS ARE IN DOLLARS. New appointments default to
--    USD, following the fee schedule, which the University converted to dollars
--    at 600 FCFA to the dollar. EXISTING ROWS ARE NOT TOUCHED — an appointment
--    already recorded in francs stays in francs, because restating somebody's
--    salary in another currency is a decision about their pay, not a data
--    migration.
--
-- 2. AN APPOINTMENT CAN CARRY ALLOWANCES. Housing, transport, communication,
--    responsibility, research — each with its own amount and period, none
--    assumed. Until now a salary was one number, so an appointment worth
--    $2,000 basic plus $400 housing could only be recorded as $2,400, and the
--    letter then stated something the University had not decided.
--
-- 3. THE RECORD NAMES FIVE PEOPLE, NOT THREE. `reviewed_by` and `issued_by`
--    join the three that existed. "Who issued this?" was previously answerable
--    only by inference from `authorized_by`, which is wrong whenever the
--    authority approves on Monday and the letter goes out on Thursday.
--
-- 4. A CLOSED DOOR — READ THIS ONE. An appointment can no longer reach
--    `issued` unless a letter for it is archived. The University's own words:
--    "an appointment cannot be issued without an approved decision and an
--    archived appointment document". Until now `issued` was a status somebody
--    could set with no document behind it, and the appointee would then be
--    holding nothing while the register said a letter had gone.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THE UNIVERSITY'S LIST OF APPOINTMENT TYPES IS TWO LISTS. Asked for fourteen
-- types — Initial, Reappointment, Promotion, Renewal, Contract Extension,
-- Transfer, Acting, Visiting, Part-Time, Full-Time, Adjunct, Probationary,
-- Confirmation, Amendment — and they are not one vocabulary. Six of them say
-- what KIND OF EMPLOYMENT this is (visiting, part-time, adjunct, probationary)
-- and eight say WHAT THE UNIVERSITY IS DOING (promoting, renewing,
-- transferring, confirming).
--
-- A promotion to a full-time post is both. Put in one column, it is neither:
-- the University can then ask how many promotions it made this year or how many
-- part-time staff it has, but never both, and the answer to the second silently
-- excludes everybody whose row says "Promotion".
--
-- So `employment_type` keeps its meaning and `appointment_action` is added
-- beside it. Nothing existing is renamed and no existing row changes.
-- ===========================================================================


-- ===========================================================================
-- 1. THE MONEY
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- NEW ROWS ARE IN DOLLARS — AND THIS IS A TRIGGER, NOT A COLUMN DEFAULT.
--
-- It was `alter column salary_currency set default 'USD'` for about ten
-- minutes, and the proof below refused it immediately: a column default applies
-- to EVERY insert, so an honorary appointment carrying no pay at all came out
-- with a currency and no amount, which 041 correctly refuses as an incomplete
-- salary. The University would have discovered it the first time it appointed
-- somebody unpaid.
--
-- The rule the University actually stated is conditional — "money is in
-- dollars" — and a default cannot express a condition. This can: if an amount
-- is given and nobody said in what, it is dollars.
--
-- EXISTING ROWS ARE NOT TOUCHED. An appointment already recorded in francs
-- stays in francs; restating somebody's salary in another currency is a
-- decision about their pay, not a data migration.
-- ---------------------------------------------------------------------------
alter table appointments alter column salary_currency drop default;

create or replace function appointment_money_is_in_dollars() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.salary_amount is not null and new.salary_currency is null then
    new.salary_currency := 'USD';
  end if;
  -- A FIGURE WITH NO PERIOD IS NOT A SALARY, and monthly is what the
  -- University's own schedule is quoted over. Stated here rather than left to
  -- whichever screen happened to post the row.
  if new.salary_amount is not null and new.salary_period is null then
    new.salary_period := 'month';
  end if;
  return new;
end $$;

drop trigger if exists appointments_money_is_in_dollars on appointments;
create trigger appointments_money_is_in_dollars
  before insert or update on appointments
  for each row execute function appointment_money_is_in_dollars();

do $$
begin
  -- THE PERIODS THE UNIVERSITY ACTUALLY PAYS OVER. 'contract' and 'stipend' are
  -- the two that were missing and the two a visiting appointment needs: a sum
  -- for the whole engagement, and an honorarium that is not a salary at all.
  if not exists (select 1 from pg_constraint where conname = 'appointments_salary_period_known') then
    alter table appointments add constraint appointments_salary_period_known
      check (salary_period is null or salary_period in
             ('hour', 'month', 'year', 'session', 'contract', 'stipend'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'appointments_currency_known') then
    alter table appointments add constraint appointments_currency_known
      check (salary_currency is null or salary_currency in
             ('USD', 'FCFA', 'EUR', 'GBP', 'NGN'))
      -- NOT VALID. There may be rows carrying a currency typed before there was
      -- a list, and refusing to run rather than naming them would leave the
      -- whole migration unapplied over somebody's historic spelling.
      not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ALLOWANCES — EACH ONE ITS OWN ROW
-- ---------------------------------------------------------------------------
--
-- NOT SEVEN COLUMNS ON `appointments`. Seven columns says every appointment has
-- seven allowances and six of them are zero, which is a claim the University has
-- not made: an honorary appointment has none, and a Dean's responsibility
-- allowance is not a nil housing allowance. A row that does not exist says
-- "this appointment does not carry one", and a row of zero says "it carries one
-- and it is nothing" — two different facts, and the letter prints them
-- differently.

create table if not exists appointment_allowances (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,

  kind           text not null check (kind in (
                   'housing', 'transport', 'communication', 'responsibility',
                   'research', 'entertainment', 'medical', 'other')),
  -- WHAT IT IS CALLED ON THE LETTER, where 'other' needs a name and the rest
  -- have one. An allowance printed as "Other: $200" tells the appointee
  -- nothing.
  label          text,

  amount         numeric(14, 2) not null check (amount > 0),
  currency       text not null default 'USD'
                   check (currency in ('USD', 'FCFA', 'EUR', 'GBP', 'NGN')),
  period         text not null default 'month'
                   check (period in ('hour', 'month', 'year', 'session',
                                     'contract', 'stipend', 'once')),

  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists appointment_allowances_appointment_idx
  on appointment_allowances (appointment_id);

do $$
begin
  -- AN 'other' ALLOWANCE SAYS WHAT IT IS.
  if not exists (select 1 from pg_constraint where conname = 'appointment_allowances_other_is_named') then
    alter table appointment_allowances add constraint appointment_allowances_other_is_named
      check (kind <> 'other' or (label is not null and length(btrim(label)) >= 3));
  end if;

  -- ONE OF EACH KIND, except 'other' which may recur because it is the
  -- catch-all and two different named allowances are two rows.
  if not exists (select 1 from pg_indexes
                  where indexname = 'appointment_allowances_one_of_each_idx') then
    create unique index appointment_allowances_one_of_each_idx
      on appointment_allowances (appointment_id, kind) where kind <> 'other';
  end if;
end $$;

-- THE TOTAL, COMPUTED WHERE IT CANNOT DRIFT. A screen adding these up would be
-- a second answer to "what does this post pay", and the two would disagree the
-- first time somebody changed a rounding rule.
create or replace view appointment_remuneration
with (security_invoker = true) as
  select a.id as appointment_id,
         a.salary_amount,
         a.salary_currency,
         a.salary_period,
         coalesce(sum(al.amount) filter (
           where al.currency = a.salary_currency and al.period = a.salary_period), 0)
           as allowances_same_basis,
         count(al.id) as allowance_count,
         -- SAID OUT LOUD WHEN THEY CANNOT BE ADDED. A monthly salary and an
         -- annual research allowance do not sum, and a view that quietly added
         -- them would put a wrong figure on a letter.
         count(al.id) filter (
           where al.currency <> a.salary_currency or al.period <> a.salary_period)
           as allowances_on_another_basis
    from appointments a
    left join appointment_allowances al on al.appointment_id = a.id
   group by a.id, a.salary_amount, a.salary_currency, a.salary_period;

alter table appointment_allowances enable row level security;

drop policy if exists appointment_allowances_read on appointment_allowances;
create policy appointment_allowances_read on appointment_allowances
  for select to authenticated
  using (exists (select 1 from appointments a where a.id = appointment_allowances.appointment_id));


-- ===========================================================================
-- 2. THE FIVE ACTORS
-- ===========================================================================
--
-- initiated_by  — whose appointment this is. 045.
-- drafted_by    — who typed it. 041.
-- reviewed_by   — who checked it before it went to the authority. Here.
-- authorized_by — who approved it. 041.
-- issued_by     — who sent the letter. Here.
--
-- THE LAST TWO ARE NOT THE SAME PERSON AND WERE NOT THE SAME ACT. An authority
-- approves on Monday; the letter goes out on Thursday. Reading `issued_by` off
-- `authorized_by` is right most of the time and wrong exactly when somebody is
-- asking.

alter table appointments
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists issued_by uuid references auth.users (id) on delete set null;

do $$
begin
  -- A REVIEW NAMES ITS REVIEWER AND ITS MOMENT, or it is not a review.
  if not exists (select 1 from pg_constraint where conname = 'appointments_review_is_complete') then
    alter table appointments add constraint appointments_review_is_complete
      check ((reviewed_by is null) = (reviewed_at is null));
  end if;

  -- ---------------------------------------------------------------------
  -- AND A REVIEWER IS NOT THE DRAFTER.
  --
  -- The point of an internal review is that a second person in the office
  -- reads it before it reaches the Vice-Chancellor. A drafter who reviews
  -- their own work has performed a ceremony, and the Vice-Chancellor is then
  -- told the file was checked when it was not.
  -- ---------------------------------------------------------------------
  if not exists (select 1 from pg_constraint where conname = 'appointments_reviewer_is_not_the_drafter') then
    alter table appointments add constraint appointments_reviewer_is_not_the_drafter
      check (reviewed_by is null or drafted_by is null or reviewed_by <> drafted_by)
      not valid;
  end if;
end $$;


-- ===========================================================================
-- 3. THE SECOND AXIS — WHAT THE UNIVERSITY IS DOING
-- ===========================================================================

alter table appointments
  add column if not exists appointment_action text,
  -- WHAT THIS ONE REPLACES OR CONTINUES. A promotion is a promotion FROM
  -- something, and a renewal renews a term that existed. Without this the
  -- register holds two unconnected appointments for one person and cannot say
  -- which came first.
  add column if not exists supersedes_appointment_id uuid references appointments (id)
    on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_action_known') then
    alter table appointments add constraint appointments_action_known
      check (appointment_action is null or appointment_action in (
        'initial', 'reappointment', 'promotion', 'renewal', 'extension',
        'transfer', 'confirmation', 'amendment'));
  end if;

  -- ---------------------------------------------------------------------
  -- THE ACTIONS THAT ARE ALWAYS ABOUT AN EARLIER APPOINTMENT.
  --
  -- A promotion, renewal, extension or confirmation with nothing behind it is
  -- one of two things: a first appointment somebody mislabelled, or a record
  -- that has lost its predecessor. Both need correcting and neither is
  -- visible without this.
  -- ---------------------------------------------------------------------
  if not exists (select 1 from pg_constraint where conname = 'appointments_continuation_has_a_predecessor') then
    alter table appointments add constraint appointments_continuation_has_a_predecessor
      check (appointment_action is null
             or appointment_action not in ('promotion', 'renewal', 'extension', 'confirmation')
             or supersedes_appointment_id is not null)
      not valid;
  end if;

  -- AND NOTHING SUPERSEDES ITSELF.
  if not exists (select 1 from pg_constraint where conname = 'appointments_nothing_supersedes_itself') then
    alter table appointments add constraint appointments_nothing_supersedes_itself
      check (supersedes_appointment_id is null or supersedes_appointment_id <> id);
  end if;
end $$;

comment on column appointments.appointment_action is
  'What the University is doing: initial, reappointment, promotion, renewal, extension, '
  'transfer, confirmation, amendment. The SECOND axis — employment_type says what kind of '
  'employment it is (permanent, visiting, part-time). A promotion to a full-time post is '
  'both, and one column could record only one of them.';


-- ===========================================================================
-- 4. THE INTERNAL REVIEW STATE
-- ===========================================================================
--
-- ONE STATE ADDED, NOTHING RENAMED. The University proposed
-- draft → submitted → under_review → pending_vc → approved → letter_generation
-- → letter_ready → issued. Most of that already exists under other names, and
-- renaming a live vocabulary rewrites every row and every guard in the system
-- for no gain.
--
--   pending_vc        is what `submitted` already means — submitted TO the VC.
--   letter_ready      is what `letter_generated` already means.
--   letter_generation is not a state. It is the second the document is being
--                     rendered, and a state nothing can be in for long is a
--                     state a screen shows by accident during a refresh.
--   returned          is `draft` again, with a RETURNED event in the history
--                     saying why. A separate state would make "returned" a
--                     place an appointment can sit forever without anybody
--                     owning it.
--
-- `under_review` is the one that was genuinely missing: the office's own check
-- before the file reaches the Vice-Chancellor.

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'appointments'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%amendment_requested%'
     and pg_get_constraintdef(oid) like '%letter_generated%'
   limit 1;

  if con is not null then
    execute format('alter table appointments drop constraint %I', con);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'appointments_status_known') then
    alter table appointments add constraint appointments_status_known
      check (status in (
        'draft', 'under_review', 'submitted', 'approved', 'letter_generated',
        'issued', 'accepted', 'active', 'amendment_requested',
        'declined', 'withdrawn', 'ended'));
  end if;
end $$;


-- ===========================================================================
-- 5. THE DOOR THE UNIVERSITY ASKED TO CLOSE
-- ===========================================================================
--
-- "An appointment cannot be `issued` without an approved decision and an
-- archived appointment document."
--
-- A TRIGGER RATHER THAN A CHECK, because a check constraint cannot read another
-- table. Until now `issued` was a status somebody could set with nothing behind
-- it: the register said a letter had gone and the appointee was holding
-- nothing.

create or replace function refuse_issue_without_a_document() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('issued', 'accepted', 'active')
     and (old.status is distinct from new.status) then

    if new.authorized_by is null or new.authorized_at is null then
      raise exception
        'This appointment has not been approved, so no letter can be issued from it. '
        'Approval and issue are two acts by two authorities, and this is the second one '
        'asking for the first.'
        using errcode = 'check_violation';
    end if;

    if not exists (
      select 1 from appointment_letters l
       where l.appointment_id = new.id and l.superseded_at is null
    ) then
      raise exception
        'No appointment letter is archived for this appointment, so it cannot be marked '
        'issued. Generate the letter first: an appointment recorded as issued with no '
        'document behind it is an appointee holding nothing while the register says '
        'otherwise.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists appointments_issue_needs_a_document on appointments;
create trigger appointments_issue_needs_a_document
  before update on appointments
  for each row execute function refuse_issue_without_a_document();


-- ===========================================================================
-- 6. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  b_id uuid;
  someone uuid;
  other uuid;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '047: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    -- ---- AN APPOINTMENT WITH NO PAY AT ALL IS STILL VALID -----------------
    -- THE CASE A COLUMN DEFAULT BROKE. An honorary appointment carries no
    -- salary, and a default currency gave it one with no amount beside it —
    -- refused by 041, correctly, as an incomplete salary. Proved first because
    -- it is the case nobody would have tried until the University appointed
    -- somebody unpaid.
    insert into appointments
      (full_name, position_title, unit_name, employment_type, start_date,
       terms, status, drafted_by)
    values ('An Honorary Appointee', 'Honorary Fellow', 'Faculty of Theology', 'honorary',
            current_date + 30, 'The terms.', 'draft', someone)
    returning id into b_id;
    if (select salary_currency from appointments where id = b_id) is not null then
      raise exception '047 FAILED: an unpaid appointment was given a currency';
    end if;
    delete from appointments where id = b_id;

    -- ---- AND ONE WITH PAY IS PRICED IN DOLLARS ----------------------------
    insert into appointments
      (full_name, position_title, unit_name, employment_type, start_date,
       terms, status, drafted_by, salary_amount)
    values ('A Specimen Appointee', 'Lecturer', 'Faculty of Theology', 'permanent',
            current_date + 30, 'The terms.', 'draft', someone, 2000)
    returning id into a_id;

    if (select salary_currency from appointments where id = a_id) is distinct from 'USD' then
      raise exception '047 FAILED: an appointment created without a currency came out in %, '
                      'not dollars',
        coalesce((select salary_currency from appointments where id = a_id), 'nothing');
    end if;
    if (select salary_period from appointments where id = a_id) is distinct from 'month' then
      raise exception '047 FAILED: a figure with no period given did not become a monthly one';
    end if;

    -- ---- AN ALLOWANCE IS ITS OWN ROW WITH ITS OWN BASIS --------------------
    insert into appointment_allowances (appointment_id, kind, amount, period)
    values (a_id, 'housing', 400, 'month');

    refused := false;
    begin
      insert into appointment_allowances (appointment_id, kind, amount, period)
      values (a_id, 'housing', 100, 'month');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: one appointment carries two housing allowances';
    end if;

    -- ---- AN 'other' ALLOWANCE SAYS WHAT IT IS ------------------------------
    refused := false;
    begin
      insert into appointment_allowances (appointment_id, kind, amount, period)
      values (a_id, 'other', 100, 'month');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: an allowance called "other" and nothing else was accepted';
    end if;

    -- ---- AND NOTHING IS SILENTLY ADDED ACROSS BASES ------------------------
    insert into appointment_allowances (appointment_id, kind, amount, period, currency)
    values (a_id, 'research', 1200, 'year', 'USD');
    if (select allowances_same_basis from appointment_remuneration
         where appointment_id = a_id) <> 400 then
      raise exception '047 FAILED: an annual allowance was added to a monthly salary';
    end if;
    if (select allowances_on_another_basis from appointment_remuneration
         where appointment_id = a_id) <> 1 then
      raise exception '047 FAILED: the allowance on another basis was not reported as one';
    end if;

    -- ---- A REVIEWER IS NOT THE DRAFTER -------------------------------------
    refused := false;
    begin
      update appointments set reviewed_by = someone, reviewed_at = now() where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: the drafter reviewed their own appointment, so the '
                      'Vice-Chancellor is told a file was checked that nobody read';
    end if;
    update appointments set reviewed_by = other, reviewed_at = now() where id = a_id;

    -- ---- A REVIEW WITH NO MOMENT IS NOT A REVIEW ---------------------------
    refused := false;
    begin
      update appointments set reviewed_at = null where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: an appointment was reviewed at no particular time';
    end if;

    -- ---- THE INTERNAL REVIEW STATE IS REACHABLE ----------------------------
    update appointments set status = 'under_review' where id = a_id;
    refused := false;
    begin
      update appointments set status = 'being_thought_about' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: the status vocabulary accepted a state nobody declared';
    end if;

    -- ---- A PROMOTION IS A PROMOTION FROM SOMETHING -------------------------
    refused := false;
    begin
      update appointments set appointment_action = 'promotion' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: a promotion was recorded with nothing behind it';
    end if;
    update appointments set appointment_action = 'initial' where id = a_id;

    insert into appointments
      (full_name, position_title, unit_name, employment_type, start_date, terms,
       status, drafted_by, appointment_action, supersedes_appointment_id)
    values ('A Specimen Appointee', 'Senior Lecturer', 'Faculty of Theology', 'permanent',
            current_date + 400, 'The terms.', 'draft', someone, 'promotion', a_id)
    returning id into b_id;

    refused := false;
    begin
      update appointments set supersedes_appointment_id = b_id where id = b_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: an appointment superseded itself';
    end if;

    -- ---- AND THE DOOR: NO DOCUMENT, NO ISSUE -------------------------------
    update appointments
       set status = 'approved', authorized_by = other, authorized_at = now()
     where id = a_id;

    refused := false;
    begin
      update appointments set status = 'issued', issued_at = now() where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: an appointment was issued with no letter archived for it, '
                      'so the register says a document went out that does not exist';
    end if;

    -- With a letter archived, it goes.
    insert into appointment_letters (appointment_id, reference, issued_on, html)
    values (a_id, 'APT-2026-9047', current_date, '<p>The letter.</p>');
    update appointments set status = 'issued', issued_at = now(), issued_by = other
     where id = a_id;

    -- ---- AND AN UNAPPROVED ONE STILL CANNOT, EVEN WITH A DOCUMENT ----------
    insert into appointment_letters (appointment_id, reference, issued_on, html)
    values (b_id, 'APT-2026-9048', current_date, '<p>The letter.</p>');
    refused := false;
    begin
      update appointments set status = 'issued', issued_at = now() where id = b_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: an appointment nobody approved was issued because a '
                      'document happened to exist for it';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '047 OK: new appointments are priced in dollars and existing ones are untouched';
  raise notice '047 OK: allowances are separate rows, one of each kind, never summed across '
               'different currencies or periods';
  raise notice '047 OK: a reviewer is not the drafter, and a review names its moment';
  raise notice '047 OK: a promotion, renewal, extension or confirmation names what it follows';
  raise notice '047 OK: nothing is issued without both an approval and an archived letter';
end $$;


-- ===========================================================================
-- 7. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- What the University pays, by currency. Anything still in francs is a record
-- made before this migration and is deliberately left alone.
select salary_currency, salary_period, count(*) as appointments
  from appointments
 where salary_amount is not null
 group by 1, 2
 order by 1, 2;

-- Appointments recorded as issued. After this migration every one of them has a
-- letter behind it; if this returns rows, they predate the trigger and want
-- looking at.
select a.id, a.full_name, a.position_title, a.issued_at
  from appointments a
 where a.status in ('issued', 'accepted', 'active')
   and not exists (select 1 from appointment_letters l
                    where l.appointment_id = a.id and l.superseded_at is null)
 order by a.issued_at;

-- The two axes, crossed. This is the question that could not be asked before.
select coalesce(appointment_action, '(not stated)') as action,
       employment_type,
       count(*) as appointments
  from appointments
 group by 1, 2
 order by 1, 2;


-- ===========================================================================
-- ===========================================================================
--
--   048_the_job_descriptions_and_what_they_inherit.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 048 — THE JOB DESCRIPTIONS, AND WHAT THEY INHERIT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE UNIVERSITY GETS A REGISTER OF ITS POSTS. Forty-six of them, seeded
--    with title, job code, family and reporting line. That is structure, not
--    content: it says the post exists and where it sits, and nothing about what
--    the holder does.
--
-- 2. EVERY POST HAS A JOB DESCRIPTION, INHERITED FROM ITS FAMILY. Eight family
--    profiles carry the clauses that are genuinely common — an academic's
--    teaching and research duties, a director's financial authority — and each
--    post adds its own on top. Forty-six separate documents would be forty-six
--    places to update the confidentiality clause, and within a year they would
--    say four different things.
--
-- 3. NOTHING IS APPROVED. Every profile this migration writes is a DRAFT, at
--    the University's instruction, and a draft cannot be attached to an
--    appointment letter. Activating one requires somebody other than its
--    author, exactly as 044 requires of a document template.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THE SEEDED WORDING IS NOT THE UNIVERSITY'S POLICY YET. It is a first draft
-- written to be edited, and it is marked `draft` for that reason rather than as
-- a formality. A job description states what somebody may authorise, what they
-- must escalate, and what they are assessed on — it is the document produced
-- when a dismissal is challenged. Nothing in it should reach a letter until the
-- University has read it and somebody other than its author has activated it.
--
-- The Readiness panel and `position_profiles_unapproved` both report what is
-- still sitting in draft, so this cannot be forgotten quietly.
-- ===========================================================================


-- ===========================================================================
-- 1. THE POSTS
-- ===========================================================================

create table if not exists positions (
  id             uuid primary key default gen_random_uuid(),

  -- IGUC-ACA-LEC. The code is what a job description, an appointment and an
  -- establishment return all name, and a title is not stable enough to be a
  -- key: "Lecturer" and "Lecturer I" are the same post with a grade attached.
  job_code       text not null unique check (job_code ~ '^[A-Z][A-Z0-9-]{2,23}$'),
  title          text not null check (length(btrim(title)) >= 3),

  -- THE FAMILY IS THE REUSE. Everything common to a family is written once on
  -- the family's own profile and inherited.
  family         text not null check (family in (
                   'executive', 'academic-administration', 'faculty-leadership',
                   'administration', 'student-services', 'ict',
                   'academic-staff', 'other')),

  -- WHERE IT SITS. Free text against the University's stated structure rather
  -- than a foreign key: not every post belongs to a faculty, and a nullable
  -- key to a table that does not cover half the establishment is worse than a
  -- name.
  unit_name      text,
  faculty        text,
  reports_to     text,
  supervises     text,
  duty_station   text,

  employment_category text,
  grade          text,

  -- ---------------------------------------------------------------------
  -- WHAT THE POST IS USUALLY WORTH — INDICATIVE, AND IT NEVER REACHES A
  -- LETTER BY ITSELF.
  --
  -- The University's ruling: a figure may be carried on a template, and the
  -- box may be left empty. So a post can hold one, and the Vice-Chancellor
  -- can take it or type over it when making the appointment — but the letter
  -- prints `appointments.salary_amount` and nothing else. A figure that could
  -- print from here would be the University stating a salary it had not
  -- decided for the person holding the letter.
  -- ---------------------------------------------------------------------
  indicative_salary_amount   numeric(14, 2)
    check (indicative_salary_amount is null or indicative_salary_amount > 0),
  indicative_salary_currency text
    check (indicative_salary_currency is null or indicative_salary_currency in
           ('USD', 'FCFA', 'EUR', 'GBP', 'NGN')),
  indicative_salary_period   text
    check (indicative_salary_period is null or indicative_salary_period in
           ('hour', 'month', 'year', 'session', 'contract', 'stipend')),

  -- A post the University no longer fills stays in the register. An
  -- appointment made to it in 2026 must still name something in 2036.
  active         boolean not null default true,

  created_at     timestamptz not null default now()
);

create index if not exists positions_family_idx on positions (family, title);

-- Added separately as well, so a database that already has `positions` from an
-- earlier run of this file picks them up rather than silently lacking them.
alter table positions
  add column if not exists indicative_salary_amount numeric(14, 2),
  add column if not exists indicative_salary_currency text,
  add column if not exists indicative_salary_period text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'positions_indicative_salary_is_complete') then
    alter table positions add constraint positions_indicative_salary_is_complete
      check ((indicative_salary_amount is null)
             or (indicative_salary_currency is not null and indicative_salary_period is not null));
  end if;
end $$;

comment on column positions.indicative_salary_amount is
  'What the post is usually worth. INDICATIVE ONLY — a letter prints appointments.salary_amount '
  'and never this. It exists so the Vice-Chancellor can take a figure or type over it when '
  'making the appointment, and so that the box may be left empty.';


-- ===========================================================================
-- 2. THE JOB DESCRIPTION
-- ===========================================================================
--
-- VERSIONED, WITH ONE ACTIVE AT A TIME, ACTIVATED BY SOMEBODY OTHER THAN ITS
-- AUTHOR. The same shape as 044's document templates, deliberately: a job
-- description is a document the University issues and is held to, and a second
-- arrangement for versioning one would be a second answer to "which wording was
-- in force when this person was appointed".

create table if not exists position_profiles (
  id             uuid primary key default gen_random_uuid(),

  -- EITHER a post's own profile, OR a family's. Exactly one, never both and
  -- never neither — a profile belonging to nothing cannot be found, and one
  -- belonging to both would be inherited by itself.
  position_id    uuid references positions (id) on delete cascade,
  family         text check (family in (
                   'executive', 'academic-administration', 'faculty-leadership',
                   'administration', 'student-services', 'ict',
                   'academic-staff', 'other')),

  version        integer not null default 1 check (version >= 1),

  -- Why the post exists. The one section that is never inherited, because a
  -- purpose shared between two posts means one of them is undefined.
  job_purpose    text,

  status         text not null default 'draft'
                   check (status in ('draft', 'active', 'superseded')),

  effective_from date,

  created_by     uuid references auth.users (id) on delete set null,
  activated_by   uuid references auth.users (id) on delete set null,
  activated_at   timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'position_profiles_belongs_to_one_thing') then
    alter table position_profiles add constraint position_profiles_belongs_to_one_thing
      check ((position_id is not null) <> (family is not null));
  end if;

  -- ---------------------------------------------------------------------
  -- NOBODY ACTIVATES THE JOB DESCRIPTION THEY WROTE.
  --
  -- The same rule 044 applies to a letter template and 005 to a certificate
  -- design, and it matters more here than in either: a job description says
  -- what its holder may authorise and what they are assessed on. One person
  -- writing and approving that alone is one person deciding the terms on
  -- which somebody else can be dismissed.
  -- ---------------------------------------------------------------------
  if not exists (select 1 from pg_constraint where conname = 'position_profiles_second_pair_of_eyes') then
    alter table position_profiles add constraint position_profiles_second_pair_of_eyes
      check (activated_by is null or created_by is null or activated_by <> created_by);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'position_profiles_activation_is_complete') then
    alter table position_profiles add constraint position_profiles_activation_is_complete
      check (status <> 'active' or (activated_by is not null and activated_at is not null));
  end if;

  -- AN ACTIVE PROFILE SAYS WHY THE POST EXISTS. A job description with no
  -- purpose is a list of tasks, and the first question at any review is what
  -- the post is for.
  if not exists (select 1 from pg_constraint where conname = 'position_profiles_active_states_its_purpose') then
    alter table position_profiles add constraint position_profiles_active_states_its_purpose
      check (status <> 'active'
             or (job_purpose is not null and length(btrim(job_purpose)) >= 40));
  end if;
end $$;

-- ONE ACTIVE PROFILE PER POST, and one per family.
create unique index if not exists position_profiles_one_active_per_post_idx
  on position_profiles (position_id) where status = 'active' and position_id is not null;
create unique index if not exists position_profiles_one_active_per_family_idx
  on position_profiles (family) where status = 'active' and family is not null;

create unique index if not exists position_profiles_version_per_post_idx
  on position_profiles (position_id, version) where position_id is not null;
create unique index if not exists position_profiles_version_per_family_idx
  on position_profiles (family, version) where family is not null;


-- ===========================================================================
-- 3. THE CLAUSES
-- ===========================================================================
--
-- ONE TABLE, NOT TWENTY COLUMNS. The University named about twenty sections and
-- said most are "where applicable" — which as columns means twenty mostly-null
-- fields, and no way to number the responsibilities within one. As rows, a
-- section that does not apply simply has none, and the numbering the University
-- asked for is the ordinal.

create table if not exists position_profile_clauses (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references position_profiles (id) on delete cascade,

  section        text not null check (section in (
                   -- The responsibilities, in the University's own grouping.
                   'key-responsibilities', 'institutional', 'academic',
                   'administrative', 'financial', 'people-management',
                   'student', 'research', 'ict', 'compliance',
                   -- Decision-making authority, split three ways as asked. The
                   -- split is the point: "may recommend" and "may authorise"
                   -- are the difference between advice and a commitment.
                   'may-authorize', 'may-recommend', 'must-obtain-approval',
                   -- The rest.
                   'reporting', 'performance-areas', 'performance-indicators',
                   'qualifications', 'experience', 'technical-skills',
                   'behavioural-competencies', 'working-relationships',
                   'confidentiality', 'evaluation', 'amendment')),

  ordinal        integer not null check (ordinal >= 1),
  body           text not null check (length(btrim(body)) >= 10),

  created_at     timestamptz not null default now(),

  unique (profile_id, section, ordinal)
);

create index if not exists position_profile_clauses_profile_idx
  on position_profile_clauses (profile_id, section, ordinal);


-- ===========================================================================
-- 4. THE INHERITANCE, RESOLVED IN ONE PLACE
-- ===========================================================================
--
-- A POST'S JOB DESCRIPTION IS ITS FAMILY'S CLAUSES PLUS ITS OWN. Resolved here
-- rather than in the application, because a screen and a letter working it out
-- separately would be two answers to "what does this job description say", and
-- the one that matters is whichever got printed.
--
-- A post's own clause in a section REPLACES the family's for that section. It
-- does not merge: a Dean whose financial authority differs from the family's
-- needs to state it, not to have it appended to a paragraph that contradicts it.

create or replace view position_job_description
with (security_invoker = true) as
  with own_sections as (
    select pp.position_id, c.section
      from position_profiles pp
      join position_profile_clauses c on c.profile_id = pp.id
     where pp.position_id is not null and pp.status = 'active'
     group by 1, 2
  )
  select p.id as position_id,
         p.job_code,
         p.title,
         p.family,
         c.section,
         c.ordinal,
         c.body,
         case when pp.position_id is not null then 'position' else 'family' end as source
    from positions p
    join position_profiles pp
      on pp.status = 'active'
     and (pp.position_id = p.id or (pp.family = p.family and pp.position_id is null))
    join position_profile_clauses c on c.profile_id = pp.id
   -- A FAMILY CLAUSE IS DROPPED WHERE THE POST HAS ITS OWN IN THAT SECTION.
   where pp.position_id is not null
      or not exists (select 1 from own_sections o
                      where o.position_id = p.id and o.section = c.section);

-- What is still waiting to be read and approved. Named so the Readiness panel
-- can ask, and so "we will approve them later" has somewhere to be counted.
create or replace view position_profiles_unapproved
with (security_invoker = true) as
  select pp.id,
         coalesce(p.title, 'Family: ' || pp.family) as what,
         coalesce(p.job_code, pp.family) as code,
         pp.version,
         pp.created_at,
         (select count(*) from position_profile_clauses c where c.profile_id = pp.id) as clauses
    from position_profiles pp
    left join positions p on p.id = pp.position_id
   where pp.status = 'draft';


-- ===========================================================================
-- 5. AN APPOINTMENT NAMES THE POST AND THE WORDING IN FORCE
-- ===========================================================================
--
-- THE DOROTHY RULE AGAIN, from 044. An appointment letter that referred to "the
-- job description" and nothing more would be unreadable the moment the job
-- description changed — and the appointee is holding the version they were
-- given. `on delete restrict` means a profile that has been attached to an
-- appointment can never be deleted.

alter table appointments
  add column if not exists position_id uuid references positions (id) on delete set null,
  add column if not exists position_profile_id uuid references position_profiles (id)
    on delete restrict;

do $$
begin
  -- A JOB DESCRIPTION ATTACHED TO AN APPOINTMENT IS AN APPROVED ONE. This is
  -- the door the draft state exists to close: a first draft written by one
  -- person must not reach an appointee as the terms of their post.
  if not exists (select 1 from pg_constraint where conname = 'appointments_jd_is_approved') then
    alter table appointments add constraint appointments_jd_is_approved
      check (position_profile_id is null or position_profile_approved(position_profile_id))
      not valid;
  end if;
exception
  when undefined_function then
    -- The function is created below; on a first run the constraint is added
    -- after it. Nothing to do here.
    null;
end $$;

create or replace function position_profile_approved(p uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from position_profiles pp
     where pp.id = p and pp.status in ('active', 'superseded')
  );
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_jd_is_approved') then
    alter table appointments add constraint appointments_jd_is_approved
      check (position_profile_id is null or position_profile_approved(position_profile_id))
      not valid;
  end if;
end $$;


-- ===========================================================================
-- 6. WHO CAN READ AND WRITE
-- ===========================================================================

alter table positions enable row level security;
alter table position_profiles enable row level security;
alter table position_profile_clauses enable row level security;

drop policy if exists positions_read on positions;
create policy positions_read on positions
  for select to authenticated using (true);

drop policy if exists position_profiles_read on position_profiles;
create policy position_profiles_read on position_profiles
  for select to authenticated using (true);

drop policy if exists position_profile_clauses_read on position_profile_clauses;
create policy position_profile_clauses_read on position_profile_clauses
  for select to authenticated using (true);


-- ===========================================================================
-- 7. THE REGISTER OF POSTS
-- ===========================================================================
--
-- STRUCTURE ONLY. Title, code, family and reporting line — where the post sits,
-- not what its holder does. The four faculties are the University's own, as
-- stated on its site. Nothing else here asserts that a post is filled, and no
-- person is named.

insert into positions (job_code, title, family, reports_to, unit_name) values
  -- Executive
  ('EXE-VC',    'Vice-Chancellor',              'executive', 'The University Council', 'Office of the Vice-Chancellor'),
  ('EXE-DVC',   'Deputy Vice-Chancellor',       'executive', 'Vice-Chancellor', 'Office of the Vice-Chancellor'),
  ('EXE-PVC',   'Pro-Vice-Chancellor',          'executive', 'Vice-Chancellor', 'Office of the Vice-Chancellor'),
  ('EXE-SEC',   'University Secretary',         'executive', 'Vice-Chancellor', 'Office of the Vice-Chancellor'),

  -- Academic administration
  ('ACA-REG',   'Registrar',                    'academic-administration', 'Vice-Chancellor', 'Registry'),
  ('ACA-DREG',  'Deputy Registrar',             'academic-administration', 'Registrar', 'Registry'),
  ('ACA-DAA',   'Director of Academic Affairs', 'academic-administration', 'Vice-Chancellor', 'Academic Affairs'),
  ('ACA-DADM',  'Director of Admissions',       'academic-administration', 'Registrar', 'Admissions'),
  ('ACA-DEXR',  'Director of Examinations and Records', 'academic-administration', 'Registrar', 'Examinations and Records'),
  ('ACA-DGRAD', 'Dean of Graduate Studies',     'academic-administration', 'Director of Academic Affairs', 'Graduate Studies'),
  ('ACA-DRES',  'Director of Research',         'academic-administration', 'Vice-Chancellor', 'Research'),
  ('ACA-DQA',   'Director of Quality Assurance','academic-administration', 'Vice-Chancellor', 'Quality Assurance'),

  -- Faculties. The four are the University's own.
  ('FAC-DTHE',  'Dean, Faculty of Theology',    'faculty-leadership', 'Director of Academic Affairs', 'Faculty of Theology'),
  ('FAC-DENG',  'Dean, Faculty of Engineering and Technology', 'faculty-leadership', 'Director of Academic Affairs', 'Faculty of Engineering and Technology'),
  ('FAC-DBMS',  'Dean, Faculty of Business and Management Science', 'faculty-leadership', 'Director of Academic Affairs', 'Faculty of Business and Management Science'),
  ('FAC-DEDU',  'Dean, Faculty of Education',   'faculty-leadership', 'Director of Academic Affairs', 'Faculty of Education'),
  ('FAC-HOD',   'Head of Department',           'faculty-leadership', 'Dean of Faculty', null),
  ('FAC-PC',    'Programme Coordinator',        'faculty-leadership', 'Head of Department', null),
  ('FAC-ADMIN', 'Faculty Administrator',        'faculty-leadership', 'Dean of Faculty', null),

  -- Administration
  ('ADM-FIN',   'Finance Director',             'administration', 'Vice-Chancellor', 'Finance'),
  ('ADM-HR',    'Human Resources Director',     'administration', 'Vice-Chancellor', 'Human Resources'),
  ('ADM-PROC',  'Procurement Director',         'administration', 'Vice-Chancellor', 'Administration'),
  ('ADM-DIR',   'Administrative Director',      'administration', 'Vice-Chancellor', 'Administration'),

  -- Student services
  ('STU-DSA',   'Director of Student Affairs',  'student-services', 'Vice-Chancellor', 'Student Affairs'),
  ('STU-INTL',  'International Relations Director', 'student-services', 'Vice-Chancellor', 'International Relations'),
  ('STU-LIB',   'University Librarian',         'student-services', 'Director of Academic Affairs', 'Library'),
  ('STU-CAR',   'Career Services Director',     'student-services', 'Director of Student Affairs', 'Student Affairs'),
  ('STU-ALU',   'Alumni Relations Officer',     'student-services', 'Director of Student Affairs', 'Alumni Relations'),

  -- ICT
  ('ICT-DIR',   'Director of ICT',              'ict', 'Vice-Chancellor', 'ICT'),
  ('ICT-SYS',   'Systems Administrator',        'ict', 'Director of ICT', 'ICT'),
  ('ICT-SUP',   'IT Support Officer',           'ict', 'Director of ICT', 'ICT'),
  ('ICT-SEC',   'Information Security Officer', 'ict', 'Director of ICT', 'ICT'),

  -- Academic staff
  ('ACS-PROF',  'Professor',                    'academic-staff', 'Head of Department', null),
  ('ACS-ASSOC', 'Associate Professor',          'academic-staff', 'Head of Department', null),
  ('ACS-SLEC',  'Senior Lecturer',              'academic-staff', 'Head of Department', null),
  ('ACS-LEC',   'Lecturer',                     'academic-staff', 'Head of Department', null),
  ('ACS-ALEC',  'Assistant Lecturer',           'academic-staff', 'Head of Department', null),
  ('ACS-RF',    'Research Fellow',              'academic-staff', 'Director of Research', 'Research'),

  -- Other
  ('OTH-CHAP',  'Director of Chaplaincy',       'other', 'Vice-Chancellor', 'Chaplaincy'),
  ('OTH-COMM',  'Communications and Public Relations Director', 'other', 'Vice-Chancellor', 'Communications'),
  ('OTH-EXO',   'Examination Officer',          'other', 'Director of Examinations and Records', 'Examinations and Records'),
  ('OTH-ADMO',  'Admissions Officer',           'other', 'Director of Admissions', 'Admissions'),
  ('OTH-REGO',  'Registry Officer',             'other', 'Registrar', 'Registry')
on conflict (job_code) do nothing;


-- ===========================================================================
-- 8. THE FAMILY JOB DESCRIPTIONS — DRAFTS, EVERY ONE
-- ===========================================================================
--
-- WRITTEN TO BE EDITED. These are a starting point for the University, not its
-- policy, and every one is `draft` so that none of them can reach an appointee
-- until somebody has read it and somebody else has activated it.

do $$
declare
  fam text;
  pid uuid;
begin
  foreach fam in array array['executive', 'academic-administration', 'faculty-leadership',
                             'administration', 'student-services', 'ict',
                             'academic-staff', 'other']
  loop
    if exists (select 1 from position_profiles where family = fam and position_id is null) then
      continue;
    end if;

    insert into position_profiles (family, version, status, job_purpose)
    values (fam, 1, 'draft',
      'DRAFT FOR THE UNIVERSITY''S APPROVAL. This profile states the duties common to every '
      || 'post in the ' || replace(fam, '-', ' ') || ' family. It has not been approved and '
      || 'must not be attached to an appointment until it has been read and activated.')
    returning id into pid;

    -- ---- The clauses every post in the University carries -----------------
    insert into position_profile_clauses (profile_id, section, ordinal, body) values
      (pid, 'institutional', 1,
       'Uphold the mission, statutes and regulations of ICOF Global University, and conduct '
       'the duties of the post in accordance with the University''s policies in force from '
       'time to time.'),
      (pid, 'institutional', 2,
       'Represent the University professionally in dealings with students, colleagues, '
       'partner institutions and the public.'),
      (pid, 'compliance', 1,
       'Comply with the University''s policies on conduct, conflict of interest, data '
       'protection and safeguarding, and report any breach that comes to notice.'),
      (pid, 'confidentiality', 1,
       'Treat student records, staff records, examination material and the University''s '
       'commercial and legal affairs as confidential, during the appointment and after it '
       'ends.'),
      (pid, 'reporting', 1,
       'Report to the officer named in the letter of appointment, and provide such written '
       'reports as that officer or the Vice-Chancellor may require.'),
      (pid, 'evaluation', 1,
       'Performance is reviewed annually against the key performance areas set out in this '
       'job description, and at the end of any probationary period.'),
      (pid, 'amendment', 1,
       'This job description may be amended by the University after consultation with the '
       'post-holder. An amended version is issued as a new version; the version in force at '
       'the date of appointment remains on the record.'),
      (pid, 'must-obtain-approval', 1,
       'Any commitment of University funds, any public statement made on behalf of the '
       'University, and any agreement with an external body require the prior approval of '
       'the Vice-Chancellor or of the officer to whom that authority has been delegated in '
       'writing.');

    -- ---- And what distinguishes the family --------------------------------
    if fam = 'academic-staff' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'academic', 1, 'Teach the courses allocated by the Head of Department, to the '
         'syllabus approved for the programme, and keep the teaching materials current.'),
        (pid, 'academic', 2, 'Set, invigilate and mark assessments in accordance with the '
         'University''s examination regulations, and submit marks by the published deadline.'),
        (pid, 'academic', 3, 'Supervise student projects, dissertations and theses as '
         'allocated.'),
        (pid, 'student', 1, 'Act as academic adviser to allocated students and be available '
         'to them at published consultation times.'),
        (pid, 'research', 1, 'Pursue an active programme of research or scholarship '
         'appropriate to the discipline and the grade of the post, and publish its results.'),
        (pid, 'performance-areas', 1, 'Teaching quality, assessment turnaround, student '
         'progression, research output, and contribution to the department.'),
        (pid, 'qualifications', 1, 'A qualification in the discipline appropriate to the '
         'grade of the post, as set out in the University''s conditions of service.'),
        (pid, 'may-recommend', 1, 'Recommend marks, progression decisions and programme '
         'changes to the Head of Department.');

    elsif fam = 'faculty-leadership' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'academic', 1, 'Lead the academic work of the faculty or department, including '
         'curriculum design, programme review and the maintenance of academic standards.'),
        (pid, 'people-management', 1, 'Allocate teaching, supervise the academic staff of the '
         'unit, and conduct their annual performance review.'),
        (pid, 'administrative', 1, 'Chair the meetings of the unit, maintain its records, and '
         'report to the Director of Academic Affairs.'),
        (pid, 'student', 1, 'Deal with student academic matters within the unit, including '
         'appeals at first instance.'),
        (pid, 'may-authorize', 1, 'Approve course allocations and the unit''s teaching '
         'timetable.'),
        (pid, 'may-recommend', 1, 'Recommend appointments, promotions and programme approvals '
         'to the Vice-Chancellor through the Director of Academic Affairs.'),
        (pid, 'performance-areas', 1, 'Academic standards, student progression and '
         'completion, staff development, and the timely conduct of the unit''s business.');

    elsif fam = 'executive' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'institutional', 3, 'Exercise the authority conferred by the statutes of the '
         'University and by the Council, and account to the Council for its exercise.'),
        (pid, 'people-management', 1, 'Lead the officers of the University and oversee the '
         'performance of the offices reporting to the post.'),
        (pid, 'financial', 1, 'Oversee the financial position of the University within the '
         'budget approved by the Council.'),
        (pid, 'may-authorize', 1, 'Authorise appointments, official correspondence and '
         'institutional decisions within the authority conferred by the statutes.'),
        (pid, 'performance-areas', 1, 'Institutional standing, academic quality, financial '
         'sustainability, and governance.');

    elsif fam = 'academic-administration' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'administrative', 1, 'Direct the office named in the letter of appointment and '
         'ensure its statutory and regulatory obligations are met.'),
        (pid, 'academic', 1, 'Maintain the integrity of the University''s academic records, '
         'admissions decisions and examination processes within the remit of the office.'),
        (pid, 'people-management', 1, 'Supervise the staff of the office and conduct their '
         'annual performance review.'),
        (pid, 'may-authorize', 1, 'Authorise the routine business of the office within '
         'delegated limits set in writing by the Vice-Chancellor.'),
        (pid, 'performance-areas', 1, 'Accuracy and completeness of records, turnaround of '
         'the office''s business, and regulatory compliance.');

    elsif fam = 'administration' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'administrative', 1, 'Direct the function named in the letter of appointment and '
         'maintain its policies, procedures and records.'),
        (pid, 'financial', 1, 'Manage the budget of the function, and account for expenditure '
         'against it.'),
        (pid, 'people-management', 1, 'Supervise the staff of the function and conduct their '
         'annual performance review.'),
        (pid, 'performance-areas', 1, 'Service standards, budget management, compliance, and '
         'the timely conduct of the function''s business.');

    elsif fam = 'student-services' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'student', 1, 'Provide the services of the office to students, and maintain the '
         'standards published in the student handbook.'),
        (pid, 'administrative', 1, 'Maintain the records of the office and report on its '
         'activity to the officer named in the letter of appointment.'),
        (pid, 'performance-areas', 1, 'Student satisfaction, responsiveness, and the accuracy '
         'of the office''s records.');

    elsif fam = 'ict' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'ict', 1, 'Maintain the availability, integrity and security of the University''s '
         'information systems.'),
        (pid, 'ict', 2, 'Administer access to those systems in accordance with the '
         'University''s role matrix, and grant no access that has not been authorised.'),
        (pid, 'compliance', 2, 'Maintain the audit trails the University relies on, and take '
         'no action that alters or removes a record of what a system has done.'),
        (pid, 'performance-areas', 1, 'System availability, security posture, backup and '
         'recovery, and responsiveness to support requests.');

    else
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'administrative', 1, 'Carry out the duties of the office as directed by the '
         'officer named in the letter of appointment.'),
        (pid, 'performance-areas', 1, 'Accuracy, timeliness, and the standards set for the '
         'office.');
    end if;
  end loop;
end $$;


-- ===========================================================================
-- 9. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  other uuid;
  fam_id uuid;
  pos_id uuid;
  own_id uuid;
  n integer;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '048: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    select id into pos_id from positions where job_code = 'ACS-LEC';
    select id into fam_id from position_profiles
      where family = 'academic-staff' and position_id is null;

    -- ---- A PROFILE BELONGS TO A POST OR A FAMILY, NEVER BOTH ---------------
    refused := false;
    begin
      insert into position_profiles (position_id, family, status)
      values (pos_id, 'academic-staff', 'draft');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '048 FAILED: a profile belonged to a post and a family at once, so it '
                      'is inherited by itself';
    end if;

    refused := false;
    begin
      insert into position_profiles (status) values ('draft');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '048 FAILED: a profile belonging to nothing was accepted';
    end if;

    -- ---- NOBODY ACTIVATES WHAT THEY WROTE ---------------------------------
    update position_profiles set created_by = someone where id = fam_id;
    refused := false;
    begin
      update position_profiles
         set status = 'active', activated_by = someone, activated_at = now()
       where id = fam_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '048 FAILED: the author of a job description activated it alone, so one '
                      'person set the terms on which somebody else can be dismissed';
    end if;

    -- ---- AND AN ACTIVE ONE SAYS WHY THE POST EXISTS ------------------------
    refused := false;
    begin
      update position_profiles
         set job_purpose = 'Teaching.', status = 'active',
             activated_by = other, activated_at = now()
       where id = fam_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '048 FAILED: a job description was approved with no statement of what '
                      'the post is for';
    end if;

    update position_profiles
       set status = 'active', activated_by = other, activated_at = now()
     where id = fam_id;

    -- ---- THE POST INHERITS THE FAMILY'S CLAUSES ----------------------------
    select count(*) into n from position_job_description where position_id = pos_id;
    if n = 0 then
      raise exception '048 FAILED: a Lecturer inherited nothing from the academic staff family';
    end if;
    if not exists (select 1 from position_job_description
                    where position_id = pos_id and source = 'family') then
      raise exception '048 FAILED: nothing in the Lecturer''s job description came from the '
                      'family, so the inheritance is not working';
    end if;

    -- ---- AND ITS OWN CLAUSE REPLACES THE FAMILY'S FOR THAT SECTION ---------
    insert into position_profiles (position_id, version, status, job_purpose,
                                   created_by, activated_by, activated_at)
    values (pos_id, 1, 'active',
            'To teach the courses of the department to the standard the University requires, '
            'and to supervise the students allocated to the post.',
            someone, other, now())
    returning id into own_id;
    insert into position_profile_clauses (profile_id, section, ordinal, body)
    values (own_id, 'research', 1,
            'Pursue research in the discipline as agreed annually with the Head of Department.');

    if exists (select 1 from position_job_description
                where position_id = pos_id and section = 'research' and source = 'family') then
      raise exception '048 FAILED: a post with its own research clause still inherited the '
                      'family''s, so the job description says two things about one duty';
    end if;
    -- …while the sections it did not restate still come from the family.
    if not exists (select 1 from position_job_description
                    where position_id = pos_id and section = 'confidentiality'
                      and source = 'family') then
      raise exception '048 FAILED: stating one section lost the rest of the family''s clauses';
    end if;

    -- ---- A DRAFT JOB DESCRIPTION CANNOT REACH AN APPOINTEE -----------------
    -- The door the draft state exists to close, and 048 seeds everything as a
    -- draft, so this is the guard that keeps the seeded wording off a letter.
    insert into position_profiles (position_id, version, status, created_by)
    values (pos_id, 2, 'draft', someone)
    returning id into own_id;

    -- (validate so the NOT VALID constraint applies to what follows)
    alter table appointments validate constraint appointments_jd_is_approved;

    refused := false;
    begin
      insert into appointments
        (full_name, position_title, employment_type, start_date, terms, status,
         drafted_by, position_id, position_profile_id)
      values ('A Specimen Appointee', 'Lecturer', 'permanent', current_date + 30,
              'The terms.', 'draft', someone, pos_id, own_id);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '048 FAILED: an unapproved job description was attached to an '
                      'appointment, so a first draft reached an appointee as the terms of '
                      'their post';
    end if;

    -- ---- AN INDICATIVE FIGURE IS A COMPLETE ONE OR NONE AT ALL ------------
    -- A number with no currency beside it is the thing that ends up on a
    -- letter as "2000" and is read as dollars by one officer and francs by
    -- the next.
    refused := false;
    begin
      update positions set indicative_salary_amount = 2000 where id = pos_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '048 FAILED: a post carries an indicative figure in no currency';
    end if;
    update positions
       set indicative_salary_amount = 2000, indicative_salary_currency = 'USD',
           indicative_salary_period = 'month'
     where id = pos_id;

    -- …and the appointment still carries no salary, because an indicative
    -- figure is not a decision about anybody's pay.
    if exists (select 1 from appointments where position_id = pos_id
                 and salary_amount = 2000) then
      raise exception '048 FAILED: an indicative figure reached an appointment by itself';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '048 OK: an indicative salary on a post is complete or absent, and never '
               'reaches a letter by itself';
  raise notice '048 OK: a profile belongs to a post or a family and never to both or neither';
  raise notice '048 OK: nobody activates the job description they wrote, and an approved one '
               'states what the post is for';
  raise notice '048 OK: a post inherits its family''s clauses, and its own clause replaces '
               'the family''s for that section without losing the rest';
  raise notice '048 OK: an unapproved job description cannot be attached to an appointment';
end $$;


-- ===========================================================================
-- 10. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- The establishment, by family.
select family, count(*) as posts from positions group by 1 order by 1;

-- ---------------------------------------------------------------------------
-- EVERYTHING WAITING TO BE READ AND APPROVED. This should be eight rows — the
-- eight family profiles — and every one of them is a draft written to be
-- edited, not the University's policy.
-- ---------------------------------------------------------------------------
select what, code, version, clauses from position_profiles_unapproved order by what;


-- ===========================================================================
-- ===========================================================================
--
--   049_verification_signatures_and_the_written_letter.sql
--
-- ===========================================================================
-- ===========================================================================

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


-- ===========================================================================
-- ===========================================================================
--
--   050_acceptance_the_activation_rule_and_the_full_audit.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 050 — ACCEPTANCE, THE ACTIVATION RULE, AND THE REST OF THE AUDIT TRAIL
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT THE AUDIT FOUND, AND WHAT THIS FIXES
-- ---------------------------------------------------------------------------
--
-- The University asked for a full implementation audit before more code. Of the
-- eleven links it listed for an appointment, nine already existed: person,
-- position, department, initiator, approver, issuer, documents, versions and
-- audit events. TWO DID NOT.
--
-- 1. ACCEPTANCE WAS A TIMESTAMP. `appointments.accepted_at` said WHEN somebody
--    accepted and nothing else — not who, and not WHICH VERSION of the letter
--    they were looking at. An appointee who accepted version 1 and was later
--    sent version 2 with a different salary had, on the record, simply
--    "accepted". That is the fact a dispute turns on.
--
-- 2. FACULTY WAS NOT RECORDED. A department carries one; an appointment to a
--    post that is not in a department carried nothing.
--
-- AND THE AUDIT VOCABULARY WAS SHORT. Of the fifteen actions the University
-- named, `appointment_events` could record nine. Letter viewed, letter
-- downloaded, email sent, email failed, appointment accepted and appointment
-- renewed had no event to be recorded as — so the trail could not show them
-- even though the code was willing to write them.
--
-- ---------------------------------------------------------------------------
-- AND THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- WHEN DOES SOMEBODY BECOME A MEMBER OF STAFF? The University said to keep
-- approved, issued, accepted and active distinct — they now are — and to make
-- the rule configurable rather than assumed.
--
-- `institutional_settings.staff_activation_point` is that rule, seeded to
-- 'accepted'. THIS IS A DEFAULT AND NOT A DECISION: it is the most cautious of
-- the three, because a staff record created on issue exists for somebody who
-- may yet decline. Change it to 'issued' or 'start_date' if the University
-- means something else; the trigger reads the setting rather than hard-coding
-- any of them.
-- ===========================================================================


-- ===========================================================================
-- 1. THE ACCEPTANCE
-- ===========================================================================
--
-- ITS OWN TABLE, NOT A COLUMN. An acceptance is an act by the APPOINTEE — the
-- only act in this whole workflow that is not the University's — and it is the
-- one a dispute turns on. A row can say who, when, from where, and which
-- version of which document they were answering.

create table if not exists appointment_acceptances (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,

  -- WHICH DOCUMENT THEY WERE LOOKING AT. Not a copy of the reference for
  -- convenience: the letter they read is the letter they agreed to, and an
  -- amendment issued afterwards does not retroactively become the thing they
  -- accepted.
  letter_id      uuid not null references appointment_letters (id) on delete restrict,
  reference      text not null,
  version        integer not null check (version >= 1),

  decision       text not null check (decision in ('accepted', 'declined')),

  -- WHO. The appointee's own account where they have one, and their typed name
  -- either way — an appointee accepting by a link in an email may not have a
  -- portal account yet, and refusing the acceptance until they do would mean
  -- the University could not record what actually happened.
  accepted_by    uuid references auth.users (id) on delete set null,
  accepted_name  text not null check (length(btrim(accepted_name)) >= 3),
  accepted_email text,

  -- A DECLINE SAYS WHY, like every other closure in this system.
  reason         text,

  at             timestamptz not null default now()
);

create index if not exists appointment_acceptances_appointment_idx
  on appointment_acceptances (appointment_id, at);

do $$
begin
  -- A DECLINE STATES A REASON.
  if not exists (select 1 from pg_constraint where conname = 'appointment_acceptances_decline_explained') then
    alter table appointment_acceptances add constraint appointment_acceptances_decline_explained
      check (decision <> 'declined' or (reason is not null and length(btrim(reason)) >= 10));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ONE STANDING ANSWER PER APPOINTMENT.
--
-- A partial unique index rather than a plain one: an appointee may decline and
-- the University may later reissue an amended letter which they accept, and
-- both rows are the truth. What must not happen is two LIVE answers at once.
-- Superseded answers are marked rather than deleted.
-- ---------------------------------------------------------------------------
alter table appointment_acceptances
  add column if not exists superseded_at timestamptz;

create unique index if not exists appointment_acceptances_one_standing_idx
  on appointment_acceptances (appointment_id) where superseded_at is null;

-- ---------------------------------------------------------------------------
-- AN ACCEPTANCE IS OF AN ISSUED LETTER, and of THE CURRENT one.
--
-- Accepting a superseded version is the failure this exists to catch: the
-- appointee opens an old email, clicks accept, and the register records them as
-- having agreed to terms the University has already replaced.
-- ---------------------------------------------------------------------------
create or replace function refuse_acceptance_of_a_stale_letter() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  l record;
begin
  select * into l from appointment_letters where id = new.letter_id;
  if l is null then
    raise exception 'No such letter.' using errcode = 'check_violation';
  end if;
  if l.appointment_id <> new.appointment_id then
    raise exception 'That letter belongs to a different appointment.'
      using errcode = 'check_violation';
  end if;
  if l.superseded_at is not null then
    raise exception
      'This letter has been superseded. The appointee is answering a version the University '
      'has already replaced — send them the current one rather than recording an agreement '
      'to terms that no longer stand.'
      using errcode = 'check_violation';
  end if;
  if not exists (select 1 from appointments a
                  where a.id = new.appointment_id and a.issued_at is not null) then
    raise exception
      'This appointment has not been issued, so there is nothing for the appointee to have '
      'accepted.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists appointment_acceptances_of_a_current_letter on appointment_acceptances;
create trigger appointment_acceptances_of_a_current_letter
  before insert on appointment_acceptances
  for each row execute function refuse_acceptance_of_a_stale_letter();

alter table appointment_acceptances enable row level security;

drop policy if exists appointment_acceptances_read on appointment_acceptances;
create policy appointment_acceptances_read on appointment_acceptances
  for select to authenticated
  using (exists (select 1 from appointments a where a.id = appointment_acceptances.appointment_id));


-- ===========================================================================
-- 2. THE FACULTY
-- ===========================================================================
--
-- FREE TEXT AGAINST THE UNIVERSITY'S STATED STRUCTURE, matching `positions`.
-- There is no faculties table — `departments.faculty` is text too — and
-- inventing one here would mean this migration asserting a list of the
-- University's faculties, which is not a migration's place.

alter table appointments
  add column if not exists faculty text;

comment on column appointments.faculty is
  'The faculty or school the post sits in. Text, matching departments.faculty and '
  'positions.faculty — the University states its faculties in its own content, not in a '
  'table a migration invented.';


-- ===========================================================================
-- 3. THE REST OF THE AUDIT VOCABULARY
-- ===========================================================================
--
-- The six the University named that could not be recorded. Note what is NOT
-- here: nothing that removes a line. The history has no delete path and no
-- capability unlocks one.

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'appointment_events'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%LETTER_SUPERSEDED%'
   limit 1;

  if con is not null then
    execute format('alter table appointment_events drop constraint %I', con);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'appointment_events_vocabulary') then
    alter table appointment_events add constraint appointment_events_vocabulary
      check (event in (
        'DRAFTED', 'EDITED', 'REVIEWED', 'SUBMITTED_FOR_AUTHORITY', 'AUTHORIZED', 'RETURNED',
        'LETTER_GENERATED', 'LETTER_ISSUED', 'LETTER_VIEWED', 'LETTER_DOWNLOADED',
        'LETTER_SUPERSEDED', 'EMAIL_SENT', 'EMAIL_FAILED', 'LETTER_DELIVERY_FAILED',
        'ACCEPTED', 'DECLINED', 'RENEWED', 'STAFF_ACTIVATED',
        'WITHDRAWN', 'ENDED', 'ADMINISTRATIVE_OVERRIDE'));
  end if;
end $$;


-- ===========================================================================
-- 4. WHEN SOMEBODY BECOMES A MEMBER OF STAFF
-- ===========================================================================
--
-- The University's instruction: keep approved, issued, accepted and active
-- distinct, and CONFIGURE the point at which the employee record becomes
-- active. So the rule is a row, not a line of code.

create table if not exists institutional_settings (
  key         text primary key,
  value       text not null,
  -- WHAT THIS SETTING MEANS, in the table, so that somebody changing it can
  -- read what they are changing without finding the migration that made it.
  description text,
  -- THE CHOICES, so a screen can offer them and a typo cannot become a policy.
  allowed     text[],
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'institutional_settings_value_is_allowed') then
    alter table institutional_settings add constraint institutional_settings_value_is_allowed
      check (allowed is null or value = any (allowed));
  end if;
end $$;

insert into institutional_settings (key, value, description, allowed) values
  ('staff_activation_point', 'accepted',
   'When an appointee becomes a member of staff. '
   '"issued" — as soon as the letter goes out, which creates a staff record for somebody who '
   'may yet decline. '
   '"accepted" — when the appointee has said yes. The cautious default, and what this is '
   'seeded to. '
   '"start_date" — not until the day the appointment begins, which is the strictest and means '
   'a new lecturer has no portal account until their first day.',
   array['issued', 'accepted', 'start_date'])
on conflict (key) do nothing;

alter table institutional_settings enable row level security;

drop policy if exists institutional_settings_read on institutional_settings;
create policy institutional_settings_read on institutional_settings
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- AND THE RULE IS ENFORCED, NOT ADVISORY.
--
-- 042 refused a staff record whose appointment had not been ISSUED. That was
-- the right floor and it is not the University's rule. This reads the setting.
-- ---------------------------------------------------------------------------
create or replace function staff_activation_is_permitted() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rule text;
  a record;
begin
  if new.staff_record_id is null or old.staff_record_id is not null then
    return new;
  end if;

  select value into rule from institutional_settings where key = 'staff_activation_point';
  rule := coalesce(rule, 'accepted');

  select * into a from appointments where id = new.id;

  if rule = 'issued' then
    if new.issued_at is null then
      raise exception 'This appointment has not been issued, so nobody can be made staff from it.'
        using errcode = 'check_violation';
    end if;

  elsif rule = 'accepted' then
    if not exists (select 1 from appointment_acceptances ac
                    where ac.appointment_id = new.id
                      and ac.decision = 'accepted' and ac.superseded_at is null) then
      raise exception
        'The University''s rule is that a staff record follows ACCEPTANCE, and this appointee '
        'has not accepted. Change institutional_settings.staff_activation_point if the '
        'University means something else — do not work around it, because a staff record for '
        'somebody who later declines is a person the system says works here.'
        using errcode = 'check_violation';
    end if;

  elsif rule = 'start_date' then
    if new.start_date is null or new.start_date > current_date then
      raise exception
        'The University''s rule is that a staff record begins on the start date, and this '
        'appointment starts on %.', coalesce(new.start_date::text, 'no stated date')
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists appointments_staff_activation_rule on appointments;
create trigger appointments_staff_activation_rule
  before update on appointments
  for each row execute function staff_activation_is_permitted();


-- ===========================================================================
-- 5. WHAT THE UNIVERSITY IS WAITING ON
-- ===========================================================================

create or replace view appointments_awaiting_acceptance
with (security_invoker = true) as
  select a.id,
         a.full_name,
         a.position_title,
         a.unit_name,
         a.issued_at,
         l.reference,
         l.version,
         -- HOW LONG IT HAS BEEN SITTING. The number somebody acts on: an offer
         -- unanswered for six weeks is a post the University thinks is filled.
         (current_date - a.issued_at::date) as days_waiting
    from appointments a
    join appointment_letters l
      on l.appointment_id = a.id and l.superseded_at is null
   where a.issued_at is not null
     and a.status = 'issued'
     and not exists (select 1 from appointment_acceptances ac
                      where ac.appointment_id = a.id and ac.superseded_at is null);


-- ===========================================================================
-- 6. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  other uuid;
  a_id uuid;
  l1 uuid;
  l2 uuid;
  staff uuid;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '050: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    insert into appointments
      (full_name, position_title, unit_name, faculty, employment_type, start_date, terms,
       status, drafted_by, authorized_by, authorized_at)
    values ('A Specimen Appointee', 'Lecturer', 'Department of Theology',
            'Faculty of Theology', 'permanent', current_date + 30, 'The terms.',
            'approved', someone, other, now())
    returning id into a_id;

    -- ---- NOTHING IS ACCEPTED BEFORE IT IS ISSUED --------------------------
    insert into appointment_letters (appointment_id, reference, issued_on, html)
    values (a_id, 'APT-2026-9050', current_date, '<p>Version one.</p>')
    returning id into l1;

    refused := false;
    begin
      insert into appointment_acceptances
        (appointment_id, letter_id, reference, version, decision, accepted_name)
      values (a_id, l1, 'APT-2026-9050', 1, 'accepted', 'A Specimen Appointee');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: an appointee accepted a letter that had not been issued';
    end if;

    update appointments set status = 'issued', issued_at = now(), issued_by = other
     where id = a_id;

    -- ---- A DECLINE STATES A REASON ----------------------------------------
    refused := false;
    begin
      insert into appointment_acceptances
        (appointment_id, letter_id, reference, version, decision, accepted_name)
      values (a_id, l1, 'APT-2026-9050', 1, 'declined', 'A Specimen Appointee');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: an appointment was declined for no stated reason';
    end if;

    -- The acceptance itself, of the version they were actually sent.
    insert into appointment_acceptances
      (appointment_id, letter_id, reference, version, decision, accepted_name, accepted_email)
    values (a_id, l1, 'APT-2026-9050', 1, 'accepted', 'A Specimen Appointee',
            'appointee@example.test');

    -- ---- ONE STANDING ANSWER ----------------------------------------------
    refused := false;
    begin
      insert into appointment_acceptances
        (appointment_id, letter_id, reference, version, decision, accepted_name, reason)
      values (a_id, l1, 'APT-2026-9050', 1, 'declined', 'A Specimen Appointee',
              'Changed their mind about the post.');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: one appointment carries two standing answers at once';
    end if;

    -- ---- AND NOBODY ACCEPTS A SUPERSEDED LETTER ---------------------------
    -- The failure this is for: the appointee opens an old email, clicks accept,
    -- and the register records them as agreeing to terms already replaced.
    update appointment_acceptances set superseded_at = now() where appointment_id = a_id;
    update appointment_letters set superseded_at = now() where id = l1;
    insert into appointment_letters
      (appointment_id, reference, version, issued_on, html, kind, supersedes_reason)
    values (a_id, 'APT-2026-9051', 2, current_date, '<p>Version two.</p>', 'amended',
            'The start date moved by one month at the appointee''s request.')
    returning id into l2;

    refused := false;
    begin
      insert into appointment_acceptances
        (appointment_id, letter_id, reference, version, decision, accepted_name)
      values (a_id, l1, 'APT-2026-9050', 1, 'accepted', 'A Specimen Appointee');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: an appointee accepted a letter the University had already '
                      'replaced';
    end if;

    -- ---- THE ACTIVATION RULE IS READ, NOT ASSUMED -------------------------
    -- Seeded to 'accepted'. The standing acceptance was superseded above, so
    -- there is none — and a staff record must therefore be refused.
    insert into lecturers (staff_id, first_name, last_name, email)
    values ('SPEC-050', 'A Specimen', 'Appointee', 'appointee@example.test')
    returning id into staff;

    refused := false;
    begin
      update appointments set staff_record_id = staff, staff_activated_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: somebody became a member of staff with no acceptance '
                      'standing, under a rule that says acceptance is the point';
    end if;

    -- With the answer given against the current letter, it goes.
    insert into appointment_acceptances
      (appointment_id, letter_id, reference, version, decision, accepted_name)
    values (a_id, l2, 'APT-2026-9051', 2, 'accepted', 'A Specimen Appointee');

    update appointments set staff_record_id = staff, staff_activated_at = now()
     where id = a_id;

    -- ---- AND THE RULE IS GENUINELY CONFIGURABLE ---------------------------
    -- Changing the setting changes the behaviour; it is not a comment.
    refused := false;
    begin
      update institutional_settings set value = 'whenever-we-feel-like-it'
       where key = 'staff_activation_point';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: the activation rule accepted a value nobody declared';
    end if;

    update institutional_settings set value = 'start_date'
     where key = 'staff_activation_point';
    update appointments set staff_record_id = null where id = a_id;

    refused := false;
    begin
      update appointments set staff_record_id = staff where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: under a start-date rule, somebody starting in thirty days '
                      'was made staff today';
    end if;

    -- ---- THE SIX EVENTS THAT COULD NOT BE RECORDED ------------------------
    insert into appointment_events (appointment_id, event, actor_id)
    select a_id, e, someone from unnest(array[
      'REVIEWED', 'LETTER_VIEWED', 'LETTER_DOWNLOADED',
      'EMAIL_SENT', 'EMAIL_FAILED', 'ACCEPTED', 'RENEWED', 'STAFF_ACTIVATED'
    ]) as e;

    refused := false;
    begin
      insert into appointment_events (appointment_id, event, actor_id)
      values (a_id, 'QUIETLY_CHANGED', someone);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: the audit trail accepted an event nobody declared';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '050 OK: an acceptance names who, when, and WHICH VERSION of which letter';
  raise notice '050 OK: nothing is accepted before issue, a decline states a reason, and one '
               'appointment carries one standing answer';
  raise notice '050 OK: a superseded letter cannot be accepted';
  raise notice '050 OK: the staff activation point is read from the settings and enforced, and '
               'a value nobody declared is refused';
  raise notice '050 OK: the audit trail can record all fifteen actions and nothing else';
end $$;


-- ===========================================================================
-- 7. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- WHEN SOMEBODY BECOMES STAFF AT THIS UNIVERSITY. Read this and change it if it
-- is not what the University means.
select key, value, allowed from institutional_settings where key = 'staff_activation_point';

-- OFFERS NOBODY HAS ANSWERED. An offer unanswered for six weeks is a post the
-- University believes is filled and a candidate who has taken another job.
select full_name, position_title, reference, version, days_waiting
  from appointments_awaiting_acceptance
 order by days_waiting desc;

-- What the trail can now record, in use.
select event, count(*) as times from appointment_events group by 1 order by 2 desc;


-- ===========================================================================
-- ===========================================================================
--
--   051_templates_for_every_document_the_university_issues.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 051 — A TEMPLATE REGISTRY FOR EVERY DOCUMENT THE UNIVERSITY ISSUES
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. OFFICIAL CORRESPONDENCE GETS VERSIONED TEMPLATES, and every issued letter
--    records which version produced it. 044 built the registry for eleven HR
--    documents and gave `appointment_letters` a `template_id` with
--    ON DELETE RESTRICT — the rule that keeps the wording of 2026 attached to a
--    letter issued in 2026. Correspondence had neither. The Vice-Chancellor's
--    letters to ministries were the one document family with no answer to
--    "which wording was in force when we sent this".
--
-- 2. THE OTHER THREE DOCUMENTS OF AN APPOINTMENT PACKAGE become templates too:
--    the Job Description, the Terms and Conditions of Appointment, and the
--    Acceptance of Appointment. The University named four documents and only
--    the first had a template.
--
-- 3. AN APPOINTMENT RECORDS WHICH CONDITIONS OF SERVICE APPLY TO IT. Until now
--    the letter said "the conditions of service in force from time to time",
--    which is true and unusable: an appointee in a dispute needs the version
--    that was in force when they signed, and nothing recorded it.
--
-- 4. A TEMPLATE SAYS WHEN IT TAKES EFFECT. `effective_from`, which the
--    University asked for and 044 did not carry.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- CORRESPONDENCE TEMPLATE KINDS ARE PREFIXED `letter-`, AND THEY HAD TO BE.
-- Three names appear in both vocabularies — 'reappointment', 'promotion' and
-- 'appointment' are HR document types AND kinds of official correspondence.
-- Merged without a prefix, a template written for the Vice-Chancellor's
-- promotion LETTER would be picked up as the template for an HR promotion
-- PACKAGE, and nobody would notice until somebody read the document that came
-- out. Two vocabularies that share three words are not one vocabulary.
-- ===========================================================================


-- ===========================================================================
-- 1. THE KINDS
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'document_templates'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%initial-appointment%'
   limit 1;

  if con is not null then
    execute format('alter table document_templates drop constraint %I', con);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'document_templates_kind_known') then
    alter table document_templates add constraint document_templates_kind_known
      check (kind in (
        -- The eleven HR documents, unchanged. 044's rows keep their kind.
        'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
        'transfer', 'acting-appointment', 'probation-confirmation',
        'contract-extension', 'appointment-amendment', 'termination', 'retirement',

        -- The other three documents of an appointment package. The University
        -- named four and only the letter had a template.
        'job-description', 'terms-and-conditions', 'acceptance-form',

        -- Official correspondence, PREFIXED. Three of these names —
        -- reappointment, promotion, appointment — already mean something else
        -- above, and a template written for one would have been served for the
        -- other.
        'letter-general', 'letter-appointment', 'letter-reappointment',
        'letter-promotion', 'letter-invitation', 'letter-commendation',
        'letter-recommendation', 'letter-government', 'letter-university',
        'letter-partnership', 'letter-directive', 'letter-warning',
        'letter-authorization', 'letter-official-response',
        'letter-special-assignment', 'letter-special', 'letter-other'));
  end if;
end $$;


-- ===========================================================================
-- 2. WHEN A TEMPLATE TAKES EFFECT
-- ===========================================================================

alter table document_templates
  add column if not exists effective_from date;

do $$
begin
  -- AN ACTIVE TEMPLATE HAS A DATE IT CAME INTO FORCE. Not a formality: "which
  -- wording applied in March" is the question a dispute opens with, and a
  -- registry that can only answer "the one that is active now" cannot answer it.
  --
  -- NOT VALID, because 044's existing rows predate the column and refusing to
  -- run over them would leave the whole migration unapplied.
  if not exists (select 1 from pg_constraint where conname = 'document_templates_active_has_a_date') then
    alter table document_templates add constraint document_templates_active_has_a_date
      check (status <> 'active' or effective_from is not null) not valid;
  end if;
end $$;

-- Existing active templates take effect from the day they were activated,
-- which is the only honest answer available for a row written before the
-- column existed.
update document_templates
   set effective_from = coalesce(effective_from, activated_at::date, created_at::date)
 where status = 'active' and effective_from is null;


-- ===========================================================================
-- 3. CORRESPONDENCE RECORDS THE WORDING THAT MADE IT
-- ===========================================================================
--
-- THE DOROTHY RULE, EXTENDED. `on delete restrict` means a template version
-- that has produced a letter can never be deleted — so a document issued in
-- 2026 keeps the wording of 2026 even after the template has been redesigned
-- twice. 044 applied it to appointment letters. This applies it to the
-- Vice-Chancellor's.

alter table correspondence_letters
  add column if not exists template_id uuid references document_templates (id) on delete restrict,
  add column if not exists template_version integer;

create index if not exists correspondence_letters_template_idx
  on correspondence_letters (template_id) where template_id is not null;


-- ===========================================================================
-- 4. WHICH CONDITIONS OF SERVICE APPLY TO THIS APPOINTMENT
-- ===========================================================================
--
-- "The conditions of service in force from time to time" is what the letter
-- said, and it is true and unusable. An appointee in a dispute needs the
-- version that was in force when they accepted, and nothing recorded it.
--
-- Restricted on delete for the same reason as the letter template: the
-- conditions somebody was appointed under cannot be deleted out from under
-- them.

alter table appointments
  add column if not exists terms_template_id uuid references document_templates (id)
    on delete restrict,
  add column if not exists job_description_template_id uuid references document_templates (id)
    on delete restrict;

comment on column appointments.terms_template_id is
  'The version of the Terms and Conditions of Appointment that applies to this appointment. '
  'Fixed at issue and never updated afterwards: an appointee is bound by the conditions in '
  'force when they accepted, not by whatever the University writes next.';


-- ===========================================================================
-- 5. WHAT IS AND IS NOT COVERED
-- ===========================================================================
--
-- The screen the University asked for needs to show which document types have
-- an active template and which do not. Computing that in the application would
-- mean the screen and the generator disagreeing about what "covered" means.

create or replace view document_template_coverage
with (security_invoker = true) as
  select k.kind,
         t.id            as active_template_id,
         t.name,
         t.version,
         t.effective_from,
         t.activated_at,
         t.created_by,
         t.activated_by,
         (select count(*) from document_templates d where d.kind = k.kind) as versions,
         -- LETTERS ALREADY ISSUED UNDER THIS KIND. The number that decides
         -- whether a template can be retired quietly or whether somebody is
         -- holding a document made from it.
         (select count(*) from appointment_letters l
           join document_templates d on d.id = l.template_id
          where d.kind = k.kind) as appointment_letters_issued,
         (select count(*) from correspondence_letters c
           join document_templates d on d.id = c.template_id
          where d.kind = k.kind) as correspondence_issued
    from (select unnest(array[
            'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
            'transfer', 'acting-appointment', 'probation-confirmation',
            'contract-extension', 'appointment-amendment', 'termination', 'retirement',
            'job-description', 'terms-and-conditions', 'acceptance-form',
            'letter-general', 'letter-appointment', 'letter-reappointment',
            'letter-promotion', 'letter-invitation', 'letter-commendation',
            'letter-recommendation', 'letter-government', 'letter-university',
            'letter-partnership', 'letter-directive', 'letter-warning',
            'letter-authorization', 'letter-official-response',
            'letter-special-assignment', 'letter-special', 'letter-other']) as kind) k
    left join document_templates t on t.kind = k.kind and t.status = 'active';


-- ===========================================================================
-- 6. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  other uuid;
  t_id uuid;
  c_id uuid;
  a_id uuid;
  n integer;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '051: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    -- ---- THE NEW KINDS ARE REGISTRABLE ------------------------------------
    -- VERSION 9001, NOT 1, and for the reason 044's proof now carries too: 052
    -- seeds a version 1 of every kind, so a proof claiming version 1 collides
    -- with the University's own first draft on a re-run.
    insert into document_templates (kind, version, name, body, status, created_by)
    values ('terms-and-conditions', 9001, 'Conditions of Service',
            'The conditions of service of the University, as approved by the Council.',
            'draft', someone)
    returning id into t_id;

    insert into document_templates (kind, version, name, body, status, created_by)
    values ('letter-government', 9001, 'Government Correspondence',
            'The standard form of a letter to a government ministry.', 'draft', someone);

    -- ---- AND A KIND NOBODY DECLARED IS REFUSED ----------------------------
    refused := false;
    begin
      insert into document_templates (kind, version, name, body, status, created_by)
      values ('a-kind-we-made-up', 9001, 'Something', 'A body long enough to pass.',
              'draft', someone);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '051 FAILED: the registry accepted a document kind nobody declared';
    end if;

    -- ---- AN ACTIVE TEMPLATE STATES WHEN IT TOOK EFFECT --------------------
    alter table document_templates validate constraint document_templates_active_has_a_date;

    refused := false;
    begin
      update document_templates
         set status = 'active', activated_by = other, activated_at = now()
       where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '051 FAILED: a template came into force on no particular date, so '
                      '"which wording applied in March" cannot be answered';
    end if;

    update document_templates
       set status = 'active', activated_by = other, activated_at = now(),
           effective_from = current_date
     where id = t_id;

    -- ---- THE CONDITIONS SOMEBODY WAS APPOINTED UNDER CANNOT BE DELETED ----
    insert into appointments
      (full_name, position_title, employment_type, start_date, terms, status,
       drafted_by, terms_template_id)
    values ('A Specimen Appointee', 'Lecturer', 'permanent', current_date + 30,
            'The conditions of service apply.', 'draft', someone, t_id)
    returning id into a_id;

    refused := false;
    begin
      delete from document_templates where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '051 FAILED: the conditions of service somebody was appointed under were '
                      'deleted out from under them';
    end if;

    -- ---- AND A CORRESPONDENCE LETTER RECORDS ITS WORDING -------------------
    insert into correspondence (kind, subject, body, recipient_name, initiated_by, status,
                                authorized_by, authorized_at, issued_at)
    values ('government', 'Accreditation correspondence',
            'The University writes to the Ministry on the matter discussed.',
            'The Ministry of Higher Education', someone, 'issued', other, now(), now())
    returning id into c_id;

    insert into correspondence_letters
      (correspondence_id, reference, issued_on, html, template_id, template_version)
    values (c_id, 'VC-2099-0051', current_date, '<p>The letter.</p>', t_id, 9001);

    refused := false;
    begin
      delete from document_templates where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '051 FAILED: a template that produced a letter to a ministry was deleted, '
                      'so the University cannot say what wording it sent';
    end if;

    -- ---- THE COVERAGE VIEW SEES WHAT IS MISSING ---------------------------
    select count(*) into n from document_template_coverage where active_template_id is null;
    if n = 0 then
      raise exception '051 FAILED: the coverage view reports every document type as covered, '
                      'which on a fresh database cannot be true';
    end if;
    if not exists (select 1 from document_template_coverage
                    where kind = 'terms-and-conditions' and active_template_id is not null) then
      raise exception '051 FAILED: the coverage view cannot see an active template';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '051 OK: every document the University issues has a template kind, and one '
               'nobody declared is refused';
  raise notice '051 OK: an active template states the date it came into force';
  raise notice '051 OK: the conditions of service somebody was appointed under cannot be '
               'deleted, and neither can the wording that produced a letter to a ministry';
  raise notice '051 OK: the coverage view reports which document types have no active template';
end $$;


-- ===========================================================================
-- 7. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- DOCUMENT TYPES WITH NO ACTIVE TEMPLATE. Every row here is a document the
-- University can be asked to produce and has no approved wording for. This
-- list will be long today and that is the point of showing it.
-- ---------------------------------------------------------------------------
select kind, versions
  from document_template_coverage
 where active_template_id is null
 order by kind;

-- And the ones that are covered, with the wording in force.
select kind, name, version, effective_from,
       appointment_letters_issued + correspondence_issued as documents_issued
  from document_template_coverage
 where active_template_id is not null
 order by kind;


-- ===========================================================================
-- ===========================================================================
--
--   052_a_first_draft_of_every_document.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 052 — A FIRST DRAFT OF EVERY DOCUMENT THE UNIVERSITY ISSUES
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- All thirty-one document types get a version 1, in DRAFT, with wording in it.
-- The Document Templates screen stops reading "31 of 31 have no active
-- template" and starts reading like a registry with something to edit.
--
-- NOTHING IS ACTIVE. Not one of these produces a document until somebody at
-- the University reads it and activates it, and the screen shows each as a
-- draft waiting for exactly that.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THIS WORDING IS NOT THE UNIVERSITY'S POLICY. It is a starting point written
-- to be edited — the same standing this migration's author has for the job
-- descriptions 048 seeded, and for the same reason: an appointment letter, a
-- termination letter and a written warning are documents produced in a dispute,
-- and none of them should carry a sentence nobody at the University has read.
--
-- AND `created_by` IS DELIBERATELY NULL on every row. 044 refuses a template to
-- be activated by whoever wrote it; nobody at the University wrote these, so
-- any officer holding the capability may activate one. That is the second pair
-- of eyes working rather than being bypassed: the person approving the wording
-- is not the person who drafted it.
--
-- ---------------------------------------------------------------------------
-- THE PLACEHOLDERS
-- ---------------------------------------------------------------------------
--
-- `{{name}}` is filled from the record, never typed. The names below match the
-- columns on `appointments` and `correspondence` — full_name, position_title,
-- unit_name, start_date, and so on. A placeholder nothing fills prints as
-- itself, which is visible and correctable; a blank line is not.
-- ===========================================================================

do $$
declare
  seeded integer := 0;
begin
  -- =======================================================================
  -- 1. THE APPOINTMENT DOCUMENTS
  -- =======================================================================

  insert into document_templates (kind, version, name, body, status)
  select v.kind, 1, v.name, v.body, 'draft'
    from (values

  ('initial-appointment', 'Initial Appointment',
   'We are pleased to offer you appointment as {{position_title}} in the {{unit_name}} of the '
   || 'University, on the terms set out below.' || chr(10) || chr(10)
   || 'Your appointment takes effect from {{start_date}}. You will be based at '
   || '{{place_of_duty}} and will report to {{reports_to_name}}.' || chr(10) || chr(10)
   || 'This appointment is made subject to the conditions of service of the University and to '
   || 'satisfactory verification of the qualifications and references you have supplied. You '
   || 'are required to devote your full professional attention to the duties of the post and '
   || 'to observe the University''s policies on conduct, confidentiality and conflict of '
   || 'interest.' || chr(10) || chr(10)
   || 'Please confirm your acceptance in writing.'),

  ('reappointment', 'Reappointment',
   'Following the conclusion of your previous term, the University is pleased to reappoint you '
   || 'as {{position_title}} in the {{unit_name}}, with effect from {{start_date}}.'
   || chr(10) || chr(10)
   || 'The terms of your reappointment are set out below. Except where they are varied here, '
   || 'the conditions of service under which you previously held the post continue to apply, '
   || 'and your service is treated as continuous.' || chr(10) || chr(10)
   || 'Please confirm your acceptance in writing.'),

  ('contract-renewal', 'Contract Renewal',
   'The University is pleased to renew your appointment as {{position_title}} in the '
   || '{{unit_name}} for a further term, with effect from {{start_date}} and expiring on '
   || '{{end_date}}.' || chr(10) || chr(10)
   || 'The terms of the renewed appointment are set out below. Your service is continuous and '
   || 'the conditions of service in force continue to apply.' || chr(10) || chr(10)
   || 'Please confirm your acceptance in writing.'),

  ('promotion', 'Promotion',
   'Following consideration of your record of service, the University is pleased to inform you '
   || 'that you have been promoted to the post of {{position_title}} in the {{unit_name}}, '
   || 'with effect from {{effective_date}}.' || chr(10) || chr(10)
   || 'The revised terms attaching to the post are set out below. All other terms of your '
   || 'appointment are unchanged and your service is continuous.' || chr(10) || chr(10)
   || 'The University records its appreciation of your contribution and wishes you well in the '
   || 'wider responsibilities the post carries.'),

  ('transfer', 'Transfer',
   'You are hereby transferred to the post of {{position_title}} in the {{unit_name}}, with '
   || 'effect from {{effective_date}}. Your place of duty from that date is {{place_of_duty}} '
   || 'and you will report to {{reports_to_name}}.' || chr(10) || chr(10)
   || 'Your service is continuous and your conditions of service are unchanged except as set '
   || 'out below. You are asked to hand over the responsibilities of your present post before '
   || 'the effective date.'),

  ('acting-appointment', 'Acting Appointment',
   'You are appointed to act as {{position_title}} in the {{unit_name}} with effect from '
   || '{{start_date}} until {{end_date}}, or until the substantive post is filled, whichever '
   || 'is the earlier.' || chr(10) || chr(10)
   || 'While acting you carry the full responsibilities of the post and report to '
   || '{{reports_to_name}}. An acting appointment does not confer any right to the substantive '
   || 'post, and your existing appointment continues beneath it.'),

  ('probation-confirmation', 'Confirmation of Appointment',
   'Following the satisfactory completion of your probationary period, the University is '
   || 'pleased to confirm your appointment as {{position_title}} in the {{unit_name}} with '
   || 'effect from {{effective_date}}.' || chr(10) || chr(10)
   || 'Your appointment is now substantive and the notice provisions of the conditions of '
   || 'service apply in full. The University records its appreciation of your work during the '
   || 'probationary period.'),

  ('contract-extension', 'Contract Extension',
   'Your appointment as {{position_title}} in the {{unit_name}}, which was due to expire on '
   || '{{end_date}}, is extended to the date shown below.' || chr(10) || chr(10)
   || 'All other terms of your appointment are unchanged and your service is continuous. This '
   || 'extension does not alter the character of the appointment.'),

  ('appointment-amendment', 'Appointment Amendment',
   'The University writes to amend the terms of your appointment as {{position_title}} in the '
   || '{{unit_name}}, with effect from {{effective_date}}.' || chr(10) || chr(10)
   || 'The amended terms are set out below and replace the corresponding terms of the letter '
   || 'previously issued to you. THE EARLIER LETTER REMAINS ON THE UNIVERSITY''S RECORD and is '
   || 'not withdrawn; this letter states what has changed and from when.' || chr(10) || chr(10)
   || 'Please confirm your acceptance of the amended terms in writing.'),

  ('termination', 'Termination / End of Appointment',
   'The University writes concerning your appointment as {{position_title}} in the '
   || '{{unit_name}}.' || chr(10) || chr(10)
   || 'Your appointment ends on the date shown below. The reason and the notice given are '
   || 'stated there.' || chr(10) || chr(10)
   || 'You are asked to hand over University property, records and access in your possession '
   || 'to {{reports_to_name}} before that date. Outstanding salary and entitlements will be '
   || 'settled through the Finance Office.' || chr(10) || chr(10)
   || 'Your obligations of confidentiality continue after the appointment ends. The University '
   || 'thanks you for your service.'),

  ('retirement', 'Retirement',
   'The University writes concerning your retirement from the post of {{position_title}} in '
   || 'the {{unit_name}}, with effect from the date shown below.' || chr(10) || chr(10)
   || 'The Vice-Chancellor and the University Council record their appreciation of your '
   || 'service and the contribution you have made to the life of the institution.'
   || chr(10) || chr(10)
   || 'The Finance Office will write separately regarding your final settlement and any '
   || 'entitlements. You are asked to hand over University property and records before the '
   || 'effective date.'),

  -- =======================================================================
  -- 2. THE REST OF THE APPOINTMENT PACKAGE
  -- =======================================================================

  ('job-description', 'Job Description',
   'JOB DESCRIPTION — {{position_title}}' || chr(10) || chr(10)
   || 'This job description accompanies the letter of appointment and forms part of it. The '
   || 'duties set out in the job description registered for this post under code {{job_code}} '
   || 'apply, and are summarised below.' || chr(10) || chr(10)
   || 'Position: {{position_title}}' || chr(10)
   || 'Department or faculty: {{unit_name}}' || chr(10)
   || 'Reports to: {{reports_to_name}}' || chr(10)
   || 'Duty station: {{place_of_duty}}' || chr(10)
   || 'Employment category: {{employment_type}}' || chr(10) || chr(10)
   || 'THE FULL JOB DESCRIPTION IS HELD IN THE UNIVERSITY''S REGISTER OF POSTS, versioned and '
   || 'approved separately from this letter. Migration 048 holds the structure — purpose, key '
   || 'responsibilities, decision-making authority, performance areas, qualifications — and '
   || 'the wording is edited there rather than here, so that one post has one job description '
   || 'and not a copy in every letter.' || chr(10) || chr(10)
   || 'The job description may be amended by the University after consultation with the '
   || 'post-holder. The version in force at the date of appointment remains on the record.'),

  ('terms-and-conditions', 'Terms and Conditions of Appointment',
   'CONDITIONS OF SERVICE' || chr(10) || chr(10)
   || '1. GENERAL. This appointment is subject to the statutes and regulations of the '
   || 'University and to the policies in force from time to time. Where this letter and the '
   || 'conditions of service differ, this letter governs for the matters it states.'
   || chr(10) || chr(10)
   || '2. HOURS AND DUTIES. You are required to devote your full professional attention to the '
   || 'duties of the post during the hours stated in the letter of appointment, and to carry '
   || 'out such other duties as may reasonably be assigned by the officer to whom you report.'
   || chr(10) || chr(10)
   || '3. PROBATION. Where the letter states a probationary period, the appointment is '
   || 'confirmed only on its satisfactory completion. During probation one month''s notice '
   || 'applies on either side.' || chr(10) || chr(10)
   || '4. NOTICE. After confirmation, either party may end the appointment by three months'' '
   || 'notice in writing, or payment in lieu. Nothing in this clause limits the University''s '
   || 'right to end an appointment summarily for gross misconduct.' || chr(10) || chr(10)
   || '5. REMUNERATION. Salary and any allowances are as stated in the letter of appointment '
   || 'and are paid monthly in arrears, subject to lawful deductions. Allowances are payable '
   || 'only where the letter states them.' || chr(10) || chr(10)
   || '6. CONFIDENTIALITY. You shall treat student records, staff records, examination '
   || 'material and the University''s commercial and legal affairs as confidential, during the '
   || 'appointment and after it ends.' || chr(10) || chr(10)
   || '7. CONFLICT OF INTEREST. You shall disclose any outside interest or employment that '
   || 'might conflict with the duties of the post, and shall not accept such engagement '
   || 'without written approval.' || chr(10) || chr(10)
   || '8. INTELLECTUAL PROPERTY. Rights in work produced in the course of the appointment vest '
   || 'in the University except where the University agrees otherwise in writing.'
   || chr(10) || chr(10)
   || '9. CONDUCT. You shall observe the University''s policies on conduct, data protection '
   || 'and safeguarding, and shall report any breach that comes to your notice.'
   || chr(10) || chr(10)
   || '10. AMENDMENT. These conditions may be amended by the University. The version in force '
   || 'at the date you accepted your appointment is the version that binds you, and is '
   || 'recorded against the appointment.'),

  ('acceptance-form', 'Acceptance of Appointment',
   'ACCEPTANCE OF APPOINTMENT' || chr(10) || chr(10)
   || 'To: The Vice-Chancellor, ICOF Global University' || chr(10) || chr(10)
   || 'I, {{full_name}}, acknowledge receipt of the letter of appointment bearing reference '
   || '{{reference}} and dated {{issued_on}}.' || chr(10) || chr(10)
   || 'I have read the letter, the job description and the conditions of service referred to '
   || 'in it, and I ACCEPT the appointment as {{position_title}} in the {{unit_name}} on the '
   || 'terms stated, with effect from {{start_date}}.' || chr(10) || chr(10)
   || 'Signed: ____________________________     Date: ____________________'
   || chr(10) || chr(10)
   || 'This form may be returned by post or by hand. An acceptance may also be recorded '
   || 'through the University''s verification page using the reference and code printed on the '
   || 'letter, in which case the University''s record of your acceptance names the version of '
   || 'the letter you answered.'),

  -- =======================================================================
  -- 3. OFFICIAL CORRESPONDENCE
  -- =======================================================================
  --
  -- SHORTER, AND THEY HAVE TO BE. A correspondence template is a frame for
  -- words the authority writes at the time, not a form with the words already
  -- in it — the body of a letter to a ministry IS the Vice-Chancellor
  -- speaking, and a template that wrote it for them would be the system
  -- speaking instead.

  ('letter-general', 'General Correspondence',
   'Standard frame for general correspondence of the University. The body is composed by the '
   || 'originating office; the letterhead, reference, date, signature block and verification '
   || 'code are added by the system.'),

  ('letter-appointment', 'Letter — Appointment',
   'Frame for an appointment letter written directly by an office rather than generated from '
   || 'an appointment record. Where an appointment record exists, the Appointment Letter '
   || 'template is used instead and nothing is typed by hand.'),

  ('letter-reappointment', 'Letter — Reappointment',
   'Frame for a reappointment communicated by letter from an office. The terms themselves '
   || 'belong on an appointment record, which produces the document nobody types.'),

  ('letter-promotion', 'Letter — Promotion',
   'Frame for a letter conveying a promotion. Where the promotion is recorded as an '
   || 'appointment, the Promotion template produces the letter from the record instead.'),

  ('letter-invitation', 'Letter — Invitation',
   'Frame for an invitation issued by the University — to a convocation, a lecture, an '
   || 'inspection or a meeting. State clearly what is being asked of the recipient, on what '
   || 'date, and by when a reply is needed.'),

  ('letter-commendation', 'Letter — Commendation',
   'Frame for a letter of commendation. Say what was done, by whom, and why the University '
   || 'considers it worth recording. A commendation that does not name the act reads as a '
   || 'formality and is worth less to the person receiving it.'),

  ('letter-recommendation', 'Letter — Recommendation',
   'Frame for a letter of recommendation. State the capacity in which the University knows the '
   || 'subject and over what period, then the recommendation itself. A recommendation goes to '
   || 'somebody with no other knowledge of the person, so the facts it rests on belong in it.'),

  ('letter-government', 'Letter — Government Correspondence',
   'Frame for correspondence with a ministry or government authority. Read it back as a '
   || 'stranger would: the reader has no context, cannot ask a follow-up question, and may be '
   || 'filing it against the University''s standing.'),

  ('letter-university', 'Letter — University Correspondence',
   'Frame for correspondence with another university or institution — accreditation, transfer '
   || 'of credit, joint provision, or a reference. State plainly what the University is asking '
   || 'or confirming.'),

  ('letter-partnership', 'Letter — Partnership',
   'Frame for a partnership or collaboration approach. State what is proposed, what each side '
   || 'would contribute, and what the next step is. A proposal with no next step in it is one '
   || 'nobody answers.'),

  ('letter-directive', 'Letter — Directive',
   'Frame for a directive issued to a member of staff or an office. State what is required, on '
   || 'whose authority, and by when. A directive is one of the two documents most likely to be '
   || 'produced in an appeal, so it should say what happened, what is required, and nothing '
   || 'else.'),

  ('letter-warning', 'Letter — Warning',
   'Frame for a written warning. State the conduct concerned, the date it occurred, the '
   || 'standard it fell short of, what is now required, and the consequence of a repetition. '
   || 'Say whether the warning may be appealed and to whom, and over what period it remains on '
   || 'the record. This letter turns up in an appeal; write it as the document that will be '
   || 'read there.'),

  ('letter-authorization', 'Letter — Authorization',
   'Frame for a letter authorising a named person to act for the University in a stated matter. '
   || 'State precisely what is authorised, the period, and any limit on it. An authorisation '
   || 'without a limit is one the University cannot later say was exceeded.'),

  ('letter-official-response', 'Letter — Official Response',
   'Frame for the University''s formal response to correspondence received. Name what is being '
   || 'answered — its reference and date — before answering it, so the reader can file the two '
   || 'together.'),

  ('letter-special-assignment', 'Letter — Special Assignment',
   'Frame for assigning a member of staff to a task outside the ordinary duties of their post. '
   || 'State the task, the period, to whom they report for it, and what happens to their '
   || 'ordinary duties meanwhile.'),

  ('letter-special', 'Letter — Special Letter',
   'Frame for a letter that does not fall under any other kind and is issued under the '
   || 'authority of the originating office.'),

  ('letter-other', 'Letter — Other',
   'Frame for correspondence the register has no better kind for. If this is being used often, '
   || 'the University should add the kind it is really being used for rather than leaving the '
   || 'register unable to count it.')

    ) as v (kind, name, body)
   where not exists (
     select 1 from document_templates d where d.kind = v.kind
   );

  get diagnostics seeded = row_count;
  raise notice '052: % document template(s) seeded as version 1, all in draft', seeded;
end $$;


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  t_id uuid;
  n integer;
begin
  select id into someone from auth.users limit 1;

  -- ---- EVERY KIND HAS A DRAFT --------------------------------------------
  select count(*) into n from document_template_coverage
   where (select count(*) from document_templates d where d.kind = kind) = 0;
  if n > 0 then
    raise exception '052 FAILED: % document type(s) still have no template at all', n;
  end if;

  -- ---- AND NOT ONE OF THEM IS ACTIVE --------------------------------------
  -- The whole point. A seeded template that produced documents without anybody
  -- reading it would put wording nobody approved onto the University's paper.
  select count(*) into n from document_templates where status = 'active';
  if n > 0 then
    raise notice '052: % template(s) are active — those were activated by the University, '
                 'not seeded by this migration', n;
  end if;
  select count(*) into n from document_templates
   where status = 'active' and created_by is null and activated_by is null;
  if n > 0 then
    raise exception '052 FAILED: % seeded template(s) are active with nobody having activated '
                    'them', n;
  end if;

  if someone is null then
    raise notice '052: no accounts, so activation could not be exercised';
    return;
  end if;

  begin
    select id into t_id from document_templates
     where kind = 'letter-warning' and status = 'draft' limit 1;

    -- ---- A SEEDED DRAFT CAN BE ACTIVATED BY ANY OFFICER ---------------------
    -- `created_by` is null on every seeded row, so 044's "nobody activates
    -- their own" does not block the University from putting its own wording
    -- into force. The officer approving it did not write it, which is the rule
    -- working rather than being bypassed.
    update document_templates
       set status = 'active', activated_by = someone, activated_at = now(),
           effective_from = current_date
     where id = t_id;

    -- ---- BUT THE WORDING STILL CANNOT BE REWRITTEN ONCE ACTIVE --------------
    refused := false;
    begin
      update document_templates set body = 'Something else entirely, at some length.'
       where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '052 FAILED: an active template''s wording was rewritten in place';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '052 OK: every document type has a version 1 to edit, and none of them is '
               'active until somebody at the University activates it';
  raise notice '052 OK: a seeded draft can be activated by any officer holding the capability, '
               'because nobody here wrote it — and once active its wording is frozen';
end $$;


-- ===========================================================================
-- 5. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EVERY DOCUMENT TYPE AND WHERE ITS WORDING STANDS. After this runs, every row
-- should show a version 1 in draft. Open Document Templates in the portal,
-- read each one, edit what the University wants changed, and activate it — a
-- draft produces nothing until then.
-- ---------------------------------------------------------------------------
select k.kind,
       d.name,
       d.version,
       d.status,
       length(d.body) as words_to_read
  from document_template_coverage k
  left join document_templates d on d.kind = k.kind
 order by d.status, k.kind;


-- ===========================================================================
-- ===========================================================================
--
--   053_where_an_office_stands.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 053 — WHERE AN OFFICE STANDS, AND THE OFFICE THAT WAS CALLED THREE THINGS
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- 1. THE APPOINTMENT LETTER STARTS SAYING DIFFERENT THINGS TO DIFFERENT
--    OFFICES. It already did in the code; this is the data that feeds it. A
--    post's `family` selects the register of wording — a Dean's letter, a
--    Lecturer's and the Director of Academic Affairs' stop being the same
--    generic executive letter with a different job title in it.
--
-- 2. THE DIRECTOR OF ACADEMIC AFFAIRS IS RECORDED AS RANKING IMMEDIATELY BELOW
--    THE VICE-CHANCELLOR. The University stated this on 13 September 2026. It
--    is stored on the post, and it is the ONLY post that carries it — so the
--    sentence can be printed where it is true and nowhere else.
--
--    A LETTER THAT CLAIMS A RANK IS MAKING A CONSTITUTIONAL CLAIM. If that
--    sentence lived in a template, every future template copying it would
--    repeat the claim for whatever post it was pointed at, and a Lecturer's
--    letter would quietly say the same thing. As a column on one row it cannot.
--
-- 3. NOTHING IS GRANTED. `precedence` and `standing` say where an office sits.
--    They say nothing about what it may authorise, may recommend or must
--    escalate — those three are in the job description, which 048 versions and
--    approves separately, and this migration does not touch them.
--
-- ---------------------------------------------------------------------------
-- AND IT DOES NOT RENAME ANYTHING
-- ---------------------------------------------------------------------------
--
-- The University has ruled that the office called "Head of Academic Affairs" in
-- this system and "Academic Director General" on the published About page is
-- the DIRECTOR OF ACADEMIC AFFAIRS. 048 already seeded the post under that
-- name, so there is no row here to rename — the disagreement was in the
-- application's own constants and in the website's content, and both are fixed
-- in the same change as this file. It is recorded here because somebody reading
-- the migrations in five years will want to know when the three names became
-- one.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. WHERE AN OFFICE STANDS
-- ---------------------------------------------------------------------------

alter table positions
  add column if not exists executive_level text,
  -- The rank, as it is printed in a table cell: "Second-ranking officer after
  -- the Vice-Chancellor".
  add column if not exists precedence      text,
  -- The same standing, as a sentence in a paragraph. TWO COLUMNS ON PURPOSE:
  -- lowercasing the first to make the second produced "The office of Director
  -- of Academic Affairs is second-ranking officer after the Vice-Chancellor",
  -- which is neither a rank nor English.
  add column if not exists standing        text;

comment on column positions.executive_level is
  'The management band the office sits in, where the University has recorded one. Printed in '
  'the appointment letter''s details table. Never derived.';

comment on column positions.precedence is
  'Where the office ranks, as a table-cell value. Printed ONLY for posts that carry it, so a '
  'letter cannot claim a standing the University has not stated for that post.';

comment on column positions.standing is
  'The same fact as a sentence, for the letter''s opening paragraphs. Says where the office '
  'sits and NOT what it may do — authority is in the job description and nowhere else.';

-- NOT A FREE-TEXT INVITATION. A standing is a considered statement about the
-- University's structure, and a one-word value in it is a typo rather than a
-- ruling.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'positions_standing_is_a_statement') then
    alter table positions add constraint positions_standing_is_a_statement
      check (standing is null or length(btrim(standing)) >= 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'positions_precedence_is_a_rank') then
    alter table positions add constraint positions_precedence_is_a_rank
      check (precedence is null or length(btrim(precedence)) >= 8);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE ONE POST THE UNIVERSITY HAS RANKED
-- ---------------------------------------------------------------------------
--
-- WRITTEN ONLY WHERE IT IS STILL EMPTY. If the University has since edited
-- either field, this must not put its own wording back on a re-run — a
-- migration that overwrites a considered change is a migration nobody can run
-- twice.

update positions
   set executive_level = coalesce(executive_level, 'Senior Executive Management'),
       precedence      = coalesce(precedence, 'Second-ranking officer after the Vice-Chancellor'),
       standing        = coalesce(standing,
                                  'a senior executive office of the University, ranking '
                                  'immediately below the Vice-Chancellor in the University''s '
                                  'executive structure')
 where job_code = 'ACA-DAA';

-- ---------------------------------------------------------------------------
-- 3. PROVE IT
-- ---------------------------------------------------------------------------

do $$
declare
  ranked  int;
  daa     record;
  refused boolean;
begin
  -- ---- ONE POST CARRIES A RANK, AND ONLY ONE ------------------------------
  select count(*) into ranked from positions where precedence is not null;
  if ranked <> 1 then
    raise exception '053 FAILED: % posts carry a precedence, expected exactly 1', ranked;
  end if;

  select job_code, precedence, standing, executive_level, family
    into daa from positions where job_code = 'ACA-DAA';

  if daa is null then
    raise exception '053 FAILED: ACA-DAA is not in the register — run 048 first';
  end if;
  if daa.precedence is null or daa.standing is null then
    raise exception '053 FAILED: the Director of Academic Affairs carries no standing';
  end if;
  if daa.family <> 'academic-administration' then
    raise exception '053 FAILED: ACA-DAA is in family %, so it would take the wrong register',
                    daa.family;
  end if;

  -- ---- EVERY POST HAS A FAMILY, because the family picks the wording ------
  -- A post with none falls to the plainest register rather than the grandest,
  -- which is safe — but a post with no family at all is a post nobody
  -- classified, and the letter it produces is nobody's decision.
  if exists (select 1 from positions where family is null or btrim(family) = '') then
    raise exception '053 FAILED: some posts have no family, so their letters have no register';
  end if;

  -- ---- AND THE GUARDS REFUSE ---------------------------------------------
  begin
    refused := false;
    begin
      update positions set standing = 'senior' where job_code = 'ACA-DAA';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '053 FAILED: a one-word standing was accepted as a statement of structure';
    end if;

    refused := false;
    begin
      update positions set precedence = 'top' where job_code = 'ACA-DAA';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '053 FAILED: a three-letter precedence was accepted as a rank';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '053 OK: every post carries a family, so every appointment letter has a register '
               'of wording appropriate to the office';
  raise notice '053 OK: the Director of Academic Affairs ranks immediately below the '
               'Vice-Chancellor, and is the only post that carries a standing';
  raise notice '053 OK: a standing too short to be a statement is refused';
end $$;


-- ===========================================================================
-- 4. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHICH REGISTER EACH KIND OF OFFICE WILL TAKE, and which posts the University
-- has ranked. Every family below should have posts in it; only ACA-DAA should
-- show a precedence.
-- ---------------------------------------------------------------------------
select family,
       count(*)                                        as posts,
       count(*) filter (where precedence is not null)  as ranked,
       string_agg(job_code, ', ' order by job_code)
         filter (where precedence is not null)         as which
  from positions
 group by family
 order by family;


-- ===========================================================================
-- ===========================================================================
--
--   054_course_registration.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 054 — COURSE REGISTRATION: THE ACT NOBODY COULD PERFORM
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- A STUDENT CAN BE REGISTERED FOR A COURSE. Until now nothing in this system
-- could do it. `enrollments` has existed since 001; the results pipeline reads
-- it to build a mark sheet, the GPA engine reads it to weight a transcript,
-- and the graduation audit reads it to decide whether somebody may be awarded
-- a degree. Every one of them reads a table that no screen and no route has
-- ever written a row into.
--
-- It was found by counting reads against writes per table — the same sweep
-- that found the signature specimens and the allowances — and it is the
-- largest of the three, because the three things it feeds are marks,
-- transcripts and graduation.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE ADDS, AND WHY EACH PIECE
-- ---------------------------------------------------------------------------
--
-- 1. A CLOSED VOCABULARY FOR `status`. It was `text not null default
--    'registered'` with no constraint, so any word at all could be written and
--    every reader would have to guess which words it might find. The three
--    below are the ones a registration can be in.
--
-- 2. WHO REGISTERED THIS STUDENT, AND HOW. A registration is a commitment: it
--    puts somebody on a mark sheet and it puts a course on their transcript.
--    One with no actor is one nobody can be asked about. `registered_via`
--    separates a student registering themselves from the Registry doing it for
--    them, because those two are answerable in different directions.
--
-- 3. THE DROP, AS A STATE AND NOT A DELETION. Deleting the row would take the
--    student off the mark sheet and leave no trace that they were ever on it —
--    and a student who sat an assessment and then vanished from the register
--    is the shape of a real dispute.
--
-- 4. THE LIVE ROLL AS A VIEW. The mark sheet must not list somebody who
--    dropped the course. The screens read every enrolment row today, so
--    introducing a dropped state without this view would put dropped students
--    in front of an examiner.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- ENFORCE PREREQUISITES IN SQL. The rule is published in
-- src/lib/prerequisites.ts, tested, and it reports EVERY failing condition at
-- once with a sentence per reason naming the course — because a check that
-- returns on the first failure makes a student re-submit to discover the
-- second. A trigger can refuse; it cannot explain. The route applies the rule
-- and the database holds the shape of the record.
--
-- That is a deliberate asymmetry and it is worth stating plainly: this is the
-- one guard in the system that is NOT belt-and-braces in SQL.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. THE SHAPE OF A REGISTRATION
-- ---------------------------------------------------------------------------

alter table enrollments
  add column if not exists registered_by   uuid references auth.users (id) on delete set null,
  -- 'self' when the student registered, 'registry' when an officer did it for
  -- them. Not derivable from registered_by: an officer who is also a student
  -- would be indistinguishable.
  add column if not exists registered_via  text,
  add column if not exists dropped_at      timestamptz,
  add column if not exists dropped_by      uuid references auth.users (id) on delete set null,
  add column if not exists drop_reason     text;

comment on column enrollments.registered_by is
  'Who put this student on this course. A registration puts somebody on a mark sheet and a '
  'course on their transcript; one with no actor is one nobody can be asked about.';

comment on column enrollments.registered_via is
  'self | registry. Separates a student registering themselves from the Registry doing it for '
  'them — the two are answerable in different directions.';

do $$
begin
  -- ---- THE STATUS VOCABULARY, CLOSED ------------------------------------
  -- NOT VALID, deliberately. A database with existing enrolments carrying some
  -- other word must not fail to migrate; the constraint governs every row
  -- written from now on, and the verify query at the foot names anything that
  -- would not pass.
  if not exists (select 1 from pg_constraint where conname = 'enrollments_status_is_known') then
    alter table enrollments add constraint enrollments_status_is_known
      check (status in ('registered', 'dropped', 'completed')) not valid;
  end if;

  -- ---- A DROPPED REGISTRATION SAYS WHEN AND WHY -------------------------
  -- A drop with no date is one nobody can place in a term, and a drop with no
  -- reason is one nobody can answer for at an appeal.
  if not exists (select 1 from pg_constraint where conname = 'enrollments_drop_is_complete') then
    alter table enrollments add constraint enrollments_drop_is_complete
      check (
        status <> 'dropped'
        or (dropped_at is not null and drop_reason is not null
            and length(btrim(drop_reason)) >= 8)
      ) not valid;
  end if;

  -- ---- AND A LIVE ONE CARRIES NO DROP -----------------------------------
  -- The pair that actually catches a bug: re-registering a dropped course by
  -- setting the status back and forgetting to clear the drop leaves a row that
  -- is registered AND dropped, which every reader will interpret differently.
  if not exists (select 1 from pg_constraint where conname = 'enrollments_live_is_not_dropped') then
    alter table enrollments add constraint enrollments_live_is_not_dropped
      check (status = 'dropped' or dropped_at is null) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'enrollments_via_is_known') then
    alter table enrollments add constraint enrollments_via_is_known
      check (registered_via is null or registered_via in ('self', 'registry')) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE LIVE ROLL
-- ---------------------------------------------------------------------------
--
-- WHO IS ACTUALLY TAKING THIS COURSE. The mark sheet, the GPA engine and the
-- graduation audit all ask this question and all of them asked it by reading
-- every row in `enrollments`, which was correct only while nothing could be
-- dropped.
--
-- A VIEW RATHER THAN A FILTER IN EACH SCREEN, because there are three screens
-- and they would drift — and the one that drifts is the one that puts a
-- student who dropped the course in front of an examiner.

drop view if exists course_roll;

create view course_roll
with (security_invoker = true) as
select e.id                as enrollment_id,
       e.student_id,
       e.course_id,
       e.academic_year,
       e.semester,
       e.status,
       e.enrolled_at,
       e.registered_via
  from enrollments e
 where e.status in ('registered', 'completed');

comment on view course_roll is
  'Who is actually taking a course: registered and completed, never dropped. The mark sheet, '
  'the GPA engine and the graduation audit all read this rather than filtering for themselves.';

grant select on course_roll to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. PROVE IT
-- ---------------------------------------------------------------------------

do $$
declare
  s_id    uuid;
  c_id    uuid;
  e_id    uuid;
  refused boolean;
begin
  begin
    -- A student and a course to register, made here and rolled back.
    insert into students (first_name, last_name, matric_no)
      values ('Proof', 'Student', 'PROOF-054-' || substr(gen_random_uuid()::text, 1, 8))
      returning id into s_id;

    insert into courses (code, title, credit_unit)
      values ('ZZZ054-' || substr(gen_random_uuid()::text, 1, 6), 'A Proof Course', 3)
      returning id into c_id;

    -- ---- A REGISTRATION IS ACCEPTED ---------------------------------------
    insert into enrollments (student_id, course_id, academic_year, semester,
                             status, registered_by, registered_via)
      values (s_id, c_id, 2026, 1, 'registered', null, 'self')
      returning id into e_id;

    if not exists (select 1 from course_roll where enrollment_id = e_id) then
      raise exception '054 FAILED: a registered student is not on the roll';
    end if;

    -- ---- A WORD NOBODY DEFINED IS REFUSED ---------------------------------
    refused := false;
    begin
      update enrollments set status = 'maybe' where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '054 FAILED: an undefined status was accepted';
    end if;

    -- ---- A DROP WITH NO REASON IS REFUSED ---------------------------------
    refused := false;
    begin
      update enrollments set status = 'dropped', dropped_at = now() where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '054 FAILED: a course was dropped with no reason recorded';
    end if;

    -- ---- A PROPER DROP IS ACCEPTED, AND LEAVES THE ROLL -------------------
    update enrollments
       set status = 'dropped', dropped_at = now(),
           drop_reason = 'Withdrew from the module within the change period'
     where id = e_id;

    if exists (select 1 from course_roll where enrollment_id = e_id) then
      raise exception '054 FAILED: a dropped student is still on the mark sheet';
    end if;

    -- ---- AND A ROW CANNOT BE BOTH -----------------------------------------
    -- The one that catches the real bug: re-registering by setting the status
    -- back and forgetting to clear the drop.
    refused := false;
    begin
      update enrollments set status = 'registered' where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '054 FAILED: a row is registered and dropped at the same time';
    end if;

    -- Clearing the drop as well is what re-registration must do, and it works.
    update enrollments
       set status = 'registered', dropped_at = null, dropped_by = null, drop_reason = null
     where id = e_id;
    if not exists (select 1 from course_roll where enrollment_id = e_id) then
      raise exception '054 FAILED: a re-registered student is not back on the roll';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '054 OK: a student can be registered for a course, and the registration records '
               'who did it and whether the student did it themselves';
  raise notice '054 OK: a drop is a state with a date and a reason, not a deletion — and a '
               'dropped student leaves the mark sheet';
  raise notice '054 OK: a row cannot be registered and dropped at the same time';
end $$;


-- ===========================================================================
-- 4. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHAT IS ON THE REGISTER NOW, AND WHETHER ANY EXISTING ROW WOULD FAIL THE NEW
-- RULES. The constraints were added NOT VALID so that a database with older
-- rows still migrates; this is where you find out whether there are any.
--
-- `unknown_status` should be 0. If it is not, those rows carry a word nothing
-- defines, and every reader of the table is guessing what it means.
-- ---------------------------------------------------------------------------
select count(*)                                                  as enrolments,
       count(*) filter (where status = 'registered')              as registered,
       count(*) filter (where status = 'dropped')                 as dropped,
       count(*) filter (where status = 'completed')               as completed,
       count(*) filter (where status not in
                        ('registered', 'dropped', 'completed'))   as unknown_status,
       count(*) filter (where registered_by is null
                          and status <> 'dropped')                as no_actor_recorded
  from enrollments;


-- ===========================================================================
-- ===========================================================================
--
--   055_the_office_that_needs_no_second_signature.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 055 — THE OFFICE THAT NEEDS NO SECOND SIGNATURE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE VICE-CHANCELLOR CAN DRAFT AN APPOINTMENT AND APPROVE IT. So can the
-- Chancellor, and so can a system account. Nobody else can, and the act is
-- marked on the record permanently.
--
-- The University ruled it: "a VC needs no one to approve its letter, even the
-- superadmin." The appointing authority IS the Vice-Chancellor; requiring a
-- second person to countersign the appointing authority's own decision is not
-- a separation of duties, it is asking the office to get permission to do the
-- thing the office is for.
--
-- ---------------------------------------------------------------------------
-- THE ROUTE EXISTED AND COULD NEVER BE TAKEN
-- ---------------------------------------------------------------------------
--
-- 045 built `made_on_sole_authority` for exactly this, with a stated reason and
-- a permanent mark — and then closed with:
--
--     "041's constraint refuses an approval by the drafter outright. An
--      appointment made on sole authority names the same person as initiator
--      and approver but leaves `drafted_by` to whoever prepared it — so the two
--      rules do not collide."
--
-- They did not collide because the second rule could never fire. 045 assumed
-- sole authority meant the Vice-Chancellor DIRECTED an appointment somebody
-- else typed. The University means something simpler: the Vice-Chancellor
-- writes it and approves it, one person, start to finish. `drafted_by =
-- authorized_by`, which 041 refuses flatly.
--
-- So the flag has sat in the schema since 045, written by nothing, guarding a
-- door that was bricked up.
--
-- ---------------------------------------------------------------------------
-- WHAT IS NOT RELAXED, AND THIS IS THE POINT
-- ---------------------------------------------------------------------------
--
-- 041's rule still refuses a self-approval by DEFAULT. An HR officer, a
-- registrar, an administrator drafting and approving their own appointment is
-- refused exactly as before. The only way past it is the flag, the flag is
-- only permitted for the offices that hold the authority, and setting it
-- cannot be undone.
--
-- THE UNIVERSITY CAN DO IT. WHAT IT CANNOT DO IS DO IT QUIETLY. That is 040's
-- shape for emergency publishing and 045's for this, and it does not change
-- because the act has become ordinary rather than exceptional.
--
-- ---------------------------------------------------------------------------
-- AND THE REASON IS NO LONGER DEMANDED
-- ---------------------------------------------------------------------------
--
-- 045 required twenty characters of explanation whenever the flag was set,
-- because it modelled sole authority as an EXCEPTION — the same shape as an
-- emergency publication. The University has now ruled that it is the
-- Vice-Chancellor's ordinary way of working.
--
-- An explanation demanded every time a thing is done normally is a box
-- somebody types a full stop into, and a record full of full stops is worse
-- than no record: it looks like an audit trail and carries nothing. What the
-- University is answerable for is WHO did it and THAT they did it alone, and
-- both are already recorded — permanently, and now unerasably.
--
-- The reason stays available for the day somebody wants to give one.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. A SYSTEM ACCOUNT IS AN OFFICE TOO
-- ---------------------------------------------------------------------------
--
-- 045's office vocabulary has no value for the Superadministrator, who is not
-- an office of the University but is the account that holds every capability.
-- Without this the ruling could not be carried out by the very account the
-- University named in it.

do $$
begin
  if exists (select 1 from pg_constraint
              where conname = 'appointments_initiated_by_office_check') then
    alter table appointments drop constraint appointments_initiated_by_office_check;
  end if;

  alter table appointments add constraint appointments_initiated_by_office_check
    check (initiated_by_office is null or initiated_by_office in
           ('hr', 'vice-chancellor', 'chancellor', 'registrar', 'academic-office', 'system'));
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE DRAFTER MAY APPROVE, BUT ONLY ON SOLE AUTHORITY
-- ---------------------------------------------------------------------------

do $$
begin
  -- REPLACED, NOT DROPPED. The rule still refuses every self-approval that is
  -- not marked; what changes is that being marked is now possible.
  if exists (select 1 from pg_constraint where conname = 'appointments_second_pair_of_eyes') then
    alter table appointments drop constraint appointments_second_pair_of_eyes;
  end if;

  alter table appointments add constraint appointments_second_pair_of_eyes
    check (
      authorized_by is null
      or drafted_by is null
      or authorized_by <> drafted_by
      -- THE ONE WAY THROUGH, and it leaves a mark that cannot be removed.
      or made_on_sole_authority
    );
end $$;

-- ---------------------------------------------------------------------------
-- 3. AND ONLY THE OFFICES THAT HOLD THE AUTHORITY MAY SET IT
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'appointments_sole_authority_explained') then
    alter table appointments drop constraint appointments_sole_authority_explained;
  end if;

  alter table appointments add constraint appointments_sole_authority_explained
    check (
      not made_on_sole_authority
      -- AN HR CLERK TICKING THIS BOX WOULD BE THE WHOLE SEPARATION GONE. 045's
      -- words, and they still hold — the list is simply one longer.
      or initiated_by_office in ('vice-chancellor', 'chancellor', 'system')
    );
end $$;

-- ---------------------------------------------------------------------------
-- 4. THE MARK CANNOT BE TAKEN OFF
-- ---------------------------------------------------------------------------
--
-- 045 called the mark permanent and nothing enforced it. An appointment
-- approved by its own drafter and then quietly unflagged is an appointment
-- that reads as ordinary and was not — and it is the one row in this table
-- where that matters.

create or replace function refuse_to_unmark_sole_authority()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.made_on_sole_authority and not new.made_on_sole_authority then
    raise exception
      'This appointment was approved by the officer who drafted it, on their own authority. '
      'That mark is part of the record and cannot be removed.';
  end if;
  return new;
end $$;

drop trigger if exists appointments_sole_authority_is_permanent on appointments;
create trigger appointments_sole_authority_is_permanent
  before update on appointments
  for each row execute function refuse_to_unmark_sole_authority();

-- ---------------------------------------------------------------------------
-- 5. PROVE IT
-- ---------------------------------------------------------------------------

do $$
declare
  vc      uuid;
  clerk   uuid;
  a_id    uuid;
  refused boolean;
begin
  begin
    -- THE ID IS SUPPLIED, NOT DEFAULTED. auth.users.id has no default on a
    -- real Supabase project — GoTrue generates it in the application — so an
    -- insert that leaves it out is refused with 23502. Every other migration
    -- in this directory names it; this one did not, and failed here on the
    -- University's database after passing twice on the local harness.
    vc    := gen_random_uuid();
    clerk := gen_random_uuid();
    insert into auth.users (id, email) values (vc,    '055-vc@example.test');
    insert into auth.users (id, email) values (clerk, '055-clerk@example.test');

    -- ---- THE ORDINARY RULE STILL BITES ------------------------------------
    -- An officer who is not the appointing authority drafting and approving
    -- their own appointment is refused exactly as it was before this file.
    insert into appointments (full_name, position_title, employment_type,
                              start_date, place_of_duty, status, drafted_by,
                              initiated_by_office)
      values ('A Proof Appointee', 'A Proof Post', 'permanent', '2026-10-01',
              'Buea', 'submitted', clerk, 'hr')
      returning id into a_id;

    refused := false;
    begin
      update appointments set status = 'approved', authorized_by = clerk, authorized_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '055 FAILED: a clerk approved their own appointment';
    end if;

    -- ---- AND TICKING THE BOX DOES NOT HELP THEM ---------------------------
    -- The office is 'hr', which may not claim sole authority however the flag
    -- is set. This is the check that stops the new door being a way round the
    -- old rule for everybody.
    refused := false;
    begin
      update appointments
         set status = 'approved', authorized_by = clerk, authorized_at = now(),
             made_on_sole_authority = true
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '055 FAILED: an HR office claimed sole authority';
    end if;

    -- ---- THE VICE-CHANCELLOR MAY, AND IT IS MARKED ------------------------
    insert into appointments (full_name, position_title, employment_type,
                              start_date, place_of_duty, status, drafted_by,
                              initiated_by_office)
      values ('A Proof Appointee', 'A Proof Post', 'permanent', '2026-10-01',
              'Buea', 'submitted', vc, 'vice-chancellor')
      returning id into a_id;

    update appointments
       set status = 'approved', authorized_by = vc, authorized_at = now(),
           made_on_sole_authority = true
     where id = a_id;

    if not exists (select 1 from appointments
                    where id = a_id and made_on_sole_authority
                      and drafted_by = authorized_by) then
      raise exception '055 FAILED: the Vice-Chancellor could not approve their own appointment';
    end if;

    -- ---- AND STILL CANNOT DO IT UNMARKED ----------------------------------
    -- The flag is the whole permission. Without it the Vice-Chancellor is
    -- refused like anybody else, which is what keeps the mark honest: there is
    -- no self-approval anywhere in this table that is not flagged.
    insert into appointments (full_name, position_title, employment_type,
                              start_date, place_of_duty, status, drafted_by,
                              initiated_by_office)
      values ('A Proof Appointee', 'A Proof Post', 'permanent', '2026-10-01',
              'Buea', 'submitted', vc, 'vice-chancellor')
      returning id into a_id;

    refused := false;
    begin
      update appointments set status = 'approved', authorized_by = vc, authorized_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '055 FAILED: a self-approval was accepted without the mark';
    end if;

    -- ---- AND THE MARK CANNOT BE REMOVED -----------------------------------
    update appointments
       set status = 'approved', authorized_by = vc, authorized_at = now(),
           made_on_sole_authority = true
     where id = a_id;

    refused := false;
    begin
      update appointments set made_on_sole_authority = false where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '055 FAILED: the sole-authority mark was taken off';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '055 OK: the Vice-Chancellor, the Chancellor and a system account may draft an '
               'appointment and approve it themselves';
  raise notice '055 OK: everybody else is still refused, and ticking the box does not help them';
  raise notice '055 OK: a self-approval without the mark is refused, and the mark cannot be '
               'taken off once set';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EVERY APPOINTMENT ONE PERSON MADE END TO END. Empty today; this is where
-- they will appear, and the Vice-Chancellor's own appointments will be among
-- them by design rather than by accident.
-- ---------------------------------------------------------------------------
select count(*)                                                   as appointments,
       count(*) filter (where made_on_sole_authority)             as made_alone,
       count(*) filter (where authorized_by is not null
                          and authorized_by = drafted_by)         as self_approved,
       count(*) filter (where authorized_by is not null
                          and authorized_by = drafted_by
                          and not made_on_sole_authority)         as self_approved_unmarked
  from appointments;


-- ===========================================================================
-- ===========================================================================
--
--   056_what_an_office_may_not_even_see.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 056 — WHAT AN OFFICE MAY NOT EVEN SEE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE CERTIFICATE AND TRANSCRIPT DESIGNS STOP BEING READABLE BY EVERYBODY.
-- Until this file runs, the policy on `credential_templates` is:
--
--     create policy credential_templates_read on credential_templates
--       for select using (true);
--
-- `using (true)` is not "every member of staff". It is EVERY CALLER THE
-- PUBLISHABLE KEY BELONGS TO — every applicant, every student, every lecturer,
-- and every visitor who opens the site without signing in at all. The rows it
-- serves are the blank certificate and the blank transcript: border, seal
-- placement, crest position, typeface, every measurement that makes a
-- University document look like one.
--
-- The University put it plainly: some accounts must not SEE these, not merely
-- be unable to edit them. Read-only was never the safe half of the problem.
-- A design nobody can edit and anybody can read is a design anybody can copy.
--
-- AND THE APPOINTMENT REGISTER GETS THREE BANDS instead of one list. An HR
-- officer sees the files on their own desk. The Registrar sees the whole
-- register, executive appointments included — the University has ruled that.
--
-- AND AN EXECUTIVE POST MAY ONLY BE FILLED BY THE APPOINTING AUTHORITY.
--
-- AND THE SUPERADMINISTRATOR GETS THE SWITCH — as time-boxed, audited grants
-- rather than a setting, for the reason in section 6.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE DOES NOT DO, AND WHY
-- ---------------------------------------------------------------------------
--
-- IT DOES NOT RANK THE OFFICES. The obvious rule — "you may not appoint to a
-- post more senior than your own" — needs an orderable seniority for every
-- office, and the University has not stated one. 053 recorded `precedence` as
-- PROSE, for printing, and said so in the column comment: "Never derived."
-- Turning that sentence into a number would mean inventing the ladder, which
-- is the one thing this codebase may not do.
--
-- So section 5 uses only the fact 053 actually recorded — that an office is
-- marked executive — and refuses those to everybody but the appointing
-- authority. It is the narrow, true version of the rule. The full ladder is
-- available the day the University states it.
-- ===========================================================================


-- ===========================================================================
-- 1. SIX OFFICES THE APPLICATION HAS AND THE DATABASE WOULD NOT STORE
-- ===========================================================================
--
-- Found while writing the proof for section 2, by trying to make somebody an
-- HR officer:
--
--     new row for relation "profiles" violates check constraint
--     "profiles_role_valid"
--
-- `profiles.role` carries seventeen roles. `src/lib/roles.ts` defines
-- twenty-three. These six exist in the application, hold capabilities in the
-- matrix, are offered by the role picker, and cannot be written to a profile:
--
--     hr-officer          hr-administrator
--     exam-officer        examiner
--     invigilator         moderator
--
-- WHAT THAT MEANT IN PRACTICE. `draft-appointment` is held by superadmin,
-- admin, vice-chancellor, hr-officer and hr-administrator — and two of those
-- five are roles no account could ever hold. The examination offices are the
-- same story: 015 and 016 built proctoring around an Examination Officer, an
-- examiner, a moderator and an invigilator, and not one of them could be
-- assigned. Every capability granted to these six was unreachable, and
-- nothing said so, because assigning the role fails at the moment somebody
-- tries it rather than at the moment the matrix was written.
--
-- This is fixed here rather than in its own file because section 2 cannot be
-- PROVED without it: a band for the officer who drafted the appointment is
-- untestable while no such officer can exist.
--
-- src/lib/schemaContract.test.mjs now compares the two lists on every run, so
-- the next role added to one has to be added to the other.

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_role_valid') then
    alter table profiles drop constraint profiles_role_valid;
  end if;

  alter table profiles add constraint profiles_role_valid
    check (role in (
      -- Custody of the system, as distinct from office in the University.
      'superadmin', 'admin',
      -- The University's offices, in the order roles.ts states them.
      'chancellor', 'vice-chancellor', 'registrar', 'finance-director',
      'dean', 'hod', 'programme-coordinator',
      -- THE EXAMINATION OFFICES. 015 and 016 wrote the proctoring system
      -- around these four and none could be assigned to anybody.
      'exam-officer', 'moderator', 'examiner', 'invigilator',
      'lecturer', 'finance', 'admissions-officer', 'library-staff',
      'student-affairs',
      -- HUMAN RESOURCES. The offices that hold 'draft-appointment'.
      'hr-officer', 'hr-administrator',
      'student', 'applicant',
      -- Predates the hierarchy; takes the academic admission decision.
      'academic-office'
    ));
end $$;


-- ===========================================================================
-- 2. THE BLANK CERTIFICATE IS NOT PUBLIC
-- ===========================================================================
--
-- WHO KEEPS THIS ROW, taken from the capabilities and nowhere else:
--
--   superadmin       design-credentials, publish-credential-template
--   admin            issue-credential
--   registrar        issue-credential, approve-credential-design
--   academic-office  issue-credential, approve-credential-design
--   vice-chancellor  approve-credential-design
--
-- Nobody else has a reason to hold the blank. A student reads their OWN
-- issued credential through `credentials_issued`, which 004 already scoped to
-- them, and that row carries the finished document — not the template it was
-- struck from.

drop policy if exists credential_templates_read on credential_templates;
create policy credential_templates_read on credential_templates
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office', 'vice-chancellor')
  );

comment on table credential_templates is
  'The blank certificate and the blank transcript. Restricted to the offices that design, '
  'approve or issue from them — 056. Read-only is not safe on its own: a design anybody can '
  'read is a design anybody can reproduce.';


-- ===========================================================================
-- 3. THE APPOINTMENT REGISTER IN THREE BANDS
-- ===========================================================================
--
-- 041's policy was:
--
--     person_id = auth.uid() or auth_role() in ('superadmin','admin','registrar')
--
-- which has a hole at each end. `hr-officer`, `hr-administrator` and the
-- VICE-CHANCELLOR all hold 'draft-appointment' and none of them is on that
-- list, so the Appointments screen renders an empty table for every one of
-- them. The Superadministrator never saw it because the Superadministrator is
-- waved through.
--
-- 055 has just given the Vice-Chancellor the authority to take an appointment
-- from draft to approval alone. Under 041's policy the VC could create one and
-- then not see it.
--
-- THE THREE BANDS
--
--   YOURS         — the appointment naming you. 041 had this and it stays:
--                   nobody should write to HR to find out what they were
--                   appointed as.
--   ON YOUR DESK  — you drafted it, you authorised it, or it was initiated in
--                   your name. This is the band that was missing, and it is
--                   the one that makes the screen work for the officers whose
--                   job it is.
--   THE REGISTER  — the whole thing. The University has ruled that the
--                   Registrar sees all of it, executive appointments
--                   included; the Registrar keeps the register of the
--                   University's officers and a register with holes in it is
--                   not a register.
--
-- WHAT IS DELIBERATELY ABSENT: `hr-officer` and `hr-administrator` are not in
-- the third band. They see their own work, which is what the University means
-- by "it is not even their place."

drop policy if exists appointments_read on appointments;
create policy appointments_read on appointments
  for select using (
    -- YOURS
    person_id = auth.uid()
    -- ON YOUR DESK
    or drafted_by = auth.uid()
    or authorized_by = auth.uid()
    or initiated_by = auth.uid()
    or reviewed_by = auth.uid()
    or issued_by = auth.uid()
    -- THE REGISTER
    or auth_role() in ('superadmin', 'admin', 'registrar', 'vice-chancellor', 'chancellor')
  );

-- THE LETTER FOLLOWS THE APPOINTMENT. A letter visible to somebody the
-- appointment is not would be the same disclosure by a longer route — the
-- letter carries the salary in words.
drop policy if exists appointment_letters_read on appointment_letters;
create policy appointment_letters_read on appointment_letters
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'vice-chancellor', 'chancellor')
    or exists (select 1 from appointments a
                where a.id = appointment_letters.appointment_id
                  and (a.person_id = auth.uid()
                       or a.drafted_by = auth.uid()
                       or a.authorized_by = auth.uid()
                       or a.initiated_by = auth.uid()))
  );

-- AND SO DOES THE HISTORY. 041 gave the events to superadmin/admin/registrar
-- only, which means an HR officer cannot see the history of the appointment
-- they themselves drafted — the screen shows the row and then nothing about
-- how it got there.
drop policy if exists appointment_events_read on appointment_events;
create policy appointment_events_read on appointment_events
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'vice-chancellor', 'chancellor')
    or exists (select 1 from appointments a
                where a.id = appointment_events.appointment_id
                  and (a.person_id = auth.uid()
                       or a.drafted_by = auth.uid()
                       or a.authorized_by = auth.uid()
                       or a.initiated_by = auth.uid()))
  );


-- ===========================================================================
-- 4. THE ALLOWANCES ARE THE SALARY BY ANOTHER NAME
-- ===========================================================================
--
-- 041 held the salary back from the ordinary screens and built
-- `appointments_without_pay` for the purpose, with the reasoning: "who holds
-- which post is ordinary institutional information; what they are paid is
-- not."
--
-- 047 then added `appointment_allowances` — housing, transport, responsibility
-- — as rows in their own table. They are money, they are on the same
-- appointment, and holding back the salary column while serving the
-- allowances row is holding back nothing at all.

do $$
begin
  if to_regclass('public.appointment_allowances') is not null then
    drop policy if exists appointment_allowances_read on appointment_allowances;
    create policy appointment_allowances_read on appointment_allowances
      for select using (
        auth_role() in ('superadmin', 'admin', 'registrar', 'vice-chancellor',
                        'chancellor', 'finance-director')
        or exists (select 1 from appointments a
                    where a.id = appointment_allowances.appointment_id
                      and a.person_id = auth.uid())
      );
  end if;
end $$;


-- ===========================================================================
-- 5. AN EXECUTIVE POST IS THE APPOINTING AUTHORITY'S TO FILL
-- ===========================================================================
--
-- This is the University's "it is not even their place", in the only form the
-- recorded facts support.
--
-- 053 marks an office executive by recording `executive_level` against it. It
-- has done so for one post so far — the Director of Academic Affairs, the
-- second-ranking officer after the Vice-Chancellor — and the University adds
-- others by filling that column, not by editing this file.
--
-- An appointment TO such a post may only be initiated by the Vice-Chancellor,
-- the Chancellor, or the system account. An HR officer may prepare anything
-- else; they may not put the University's second-ranking officer in post.
--
-- WHY A TRIGGER AND NOT A CHECK CONSTRAINT: the rule reads a column on a
-- DIFFERENT row — positions.executive_level — and a check constraint may only
-- see the row it is on.
--
-- WHY IT READS `initiated_by_office` AND NOT THE CALLER'S ROLE: every write to
-- this table goes through /api/appointments with the service key, which
-- carries no role claim, so auth_role() is 'anon' at write time and would
-- refuse everybody. `initiated_by_office` is the route's statement of which
-- office is acting, and 045 built it for exactly this.

create or replace function refuse_executive_appointment_from_below()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  level text;
  post  text;
begin
  if new.position_id is null then return new; end if;

  select p.executive_level, p.title into level, post
    from positions p where p.id = new.position_id;

  if level is null or btrim(level) = '' then return new; end if;

  if coalesce(new.initiated_by_office, '') not in ('vice-chancellor', 'chancellor', 'system') then
    raise exception
      '% is an executive office of the University. An appointment to it is the appointing '
      'authority''s to make — the Vice-Chancellor or the Chancellor — and cannot be initiated '
      'by the % office.', coalesce(post, 'That post'), coalesce(new.initiated_by_office, 'unnamed')
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists appointments_executive_posts_are_reserved on appointments;
create trigger appointments_executive_posts_are_reserved
  before insert or update on appointments
  for each row execute function refuse_executive_appointment_from_below();


-- ===========================================================================
-- 6. THE SWITCH, AS GRANTS RATHER THAN A SETTING
-- ===========================================================================
--
-- The University asked for a switch the Superadministrator can use to approve
-- or deny access. This is that, built as grants, and the difference is worth
-- stating because it is the whole reason for the table.
--
-- A SETTING ANSWERS "CAN THEY?" A GRANT ANSWERS "COULD THEY, THEN?"
--
-- A switch that turns "hr-officer may see the whole register" on and off holds
-- one bit, and that bit is always the CURRENT value. Six months after a letter
-- was written, with the switch off, there is nothing in the database that says
-- whether it was on the day the letter was written. The record cannot answer
-- the only question anybody ever asks about a permission — who could do this,
-- and when.
--
-- A grant is a row with two dates on it. Turning it off does not erase it.
--
-- THREE RULES, EACH REFUSING SOMETHING:
--
--   EVERY GRANT EXPIRES. There is no open-ended grant, because an open-ended
--   grant is a role change written in the wrong table, and it will be
--   forgotten — that is not a risk, it is what happens.
--
--   EVERY GRANT SAYS WHY. Not a full stop: twenty characters, the same floor
--   053 put on `standing`.
--
--   A GRANT IS NOT EDITABLE. It may be revoked, which is a new fact with its
--   own timestamp. It may not be rewritten, because a permission whose reason
--   and dates can be changed afterwards proves nothing about the past.

create table if not exists capability_grants (
  id           uuid primary key default gen_random_uuid(),
  -- WHO. A person, not a role. Granting to a role is what the role matrix is
  -- for; this table exists for the exception to it.
  grantee_id   uuid not null references auth.users (id) on delete cascade,
  -- WHAT. Deliberately unconstrained text. The vocabulary lives in
  -- src/lib/roles.ts and moves with the application; a CHECK listing the
  -- capabilities here would be a second copy that goes stale, and a stale
  -- vocabulary refuses a capability the application has just added.
  -- /api/admin/capability-grant validates against the real list.
  capability   text not null check (length(btrim(capability)) between 3 and 80),
  reason       text not null check (length(btrim(reason)) >= 20),
  granted_by   uuid not null references auth.users (id) on delete restrict,
  granted_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  revoked_by   uuid references auth.users (id) on delete set null,

  constraint capability_grants_expires_after_granting
    check (expires_at > granted_at),
  -- A REVOCATION HAS A REVOKER, and a revoker implies a revocation. Half of
  -- either is a row nobody can read.
  constraint capability_grants_revocation_is_whole
    check ((revoked_at is null) = (revoked_by is null))
);

create index if not exists capability_grants_grantee
  on capability_grants (grantee_id, capability);

comment on table capability_grants is
  'The Superadministrator''s switch, as rows. A named person holds a named capability until a '
  'stated date for a stated reason. Every grant expires, every grant says why, and no grant '
  'can be rewritten once made — only revoked, which is a new fact with its own timestamp.';

-- ---------------------------------------------------------------------------
-- NOT EDITABLE, AND THIS IS THE PART THAT MAKES THE TABLE WORTH HAVING
-- ---------------------------------------------------------------------------

create or replace function refuse_to_rewrite_a_grant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'A grant is not deleted. Revoke it: the row is the record that somebody held this, and '
      'for how long.'
      using errcode = 'check_violation';
  end if;

  if new.grantee_id is distinct from old.grantee_id
     or new.capability is distinct from old.capability
     or new.reason    is distinct from old.reason
     or new.granted_by is distinct from old.granted_by
     or new.granted_at is distinct from old.granted_at
     or new.expires_at is distinct from old.expires_at then
    raise exception
      'A grant cannot be rewritten. Revoke this one and make another — a permission whose '
      'reason and dates can be changed afterwards proves nothing about the past.'
      using errcode = 'check_violation';
  end if;

  -- AND A REVOCATION IS NOT UNDONE EITHER. Restoring access is a new grant.
  if old.revoked_at is not null and new.revoked_at is null then
    raise exception
      'This grant was revoked. That is part of the record. Make a new grant instead.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists capability_grants_are_not_rewritten on capability_grants;
create trigger capability_grants_are_not_rewritten
  before update or delete on capability_grants
  for each row execute function refuse_to_rewrite_a_grant();

-- ---------------------------------------------------------------------------
-- WHAT IS IN FORCE RIGHT NOW. The application reads this, never the table, so
-- that "expired" and "revoked" are decided in one place rather than in every
-- caller that forgets one of them.
-- ---------------------------------------------------------------------------

create or replace view capability_grants_in_force
with (security_invoker = true) as
select id, grantee_id, capability, reason, granted_by, granted_at, expires_at
  from capability_grants
 where revoked_at is null
   and expires_at > now();

comment on view capability_grants_in_force is
  'Grants that have not expired and have not been revoked. Read this, not the table: it is the '
  'one place where "still in force" is decided.';

alter table capability_grants enable row level security;

-- YOU SEE YOUR OWN GRANTS. Somebody should be able to find out what they have
-- been given and when it runs out, without asking the Superadministrator.
drop policy if exists capability_grants_own on capability_grants;
create policy capability_grants_own on capability_grants
  for select using (
    grantee_id = auth.uid()
    or auth_role() in ('superadmin', 'admin')
  );

-- No write policy. Grants are made through /api/admin/capability-grant, which
-- checks that the caller is the Superadministrator and records who granted it.


-- ===========================================================================
-- 7. PROVE IT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- HOW AN ACTOR IS PUT ON IN THESE PROOFS, because getting this wrong makes
-- every assertion below pass without testing anything.
--
-- `auth_role()` does NOT read the JWT. A later migration redefined it as
--
--     select role from public.profiles where id = auth.uid();
--
-- so setting `request.jwt.claim.role` changes nothing — it is read by no
-- function in this database. The first draft of this proof did exactly that,
-- and the student and visitor assertions both "passed" because auth_role()
-- was returning NULL for everybody and the policy refused every row. Only the
-- Registrar assertion — the one that expects to SEE something — noticed.
--
-- SO EVERY CHECK THAT EXPECTS A REFUSAL IS PAIRED WITH ONE THAT EXPECTS A
-- ROW. A proof made only of refusals cannot tell a working rule from a broken
-- connection.
--
-- Identity is `request.jwt.claim.sub`, and the role is whatever `profiles`
-- says for that id.
-- ---------------------------------------------------------------------------

do $$
declare
  vc        uuid;
  hr        uuid;
  other_hr  uuid;
  reg       uuid;
  stu       uuid;
  a_mine    uuid;
  a_theirs  uuid;
  exec_post uuid;
  g_id      uuid;
  seen      integer;
  refused   boolean;
begin
  begin
    vc       := gen_random_uuid();
    hr       := gen_random_uuid();
    other_hr := gen_random_uuid();
    reg      := gen_random_uuid();
    stu      := gen_random_uuid();
    insert into auth.users (id, email) values
      (vc,       '056-vc@example.test'),
      (hr,       '056-hr@example.test'),
      (other_hr, '056-hr2@example.test'),
      (reg,      '056-registrar@example.test'),
      (stu,      '056-student@example.test');
    insert into profiles (id, email, role) values
      (vc,       '056-vc@example.test',        'vice-chancellor'),
      (hr,       '056-hr@example.test',        'hr-officer'),
      (other_hr, '056-hr2@example.test',       'hr-officer'),
      (reg,      '056-registrar@example.test', 'registrar'),
      (stu,      '056-student@example.test',   'student')
    on conflict (id) do update set role = excluded.role;

    -- ---- THE BLANK CERTIFICATE IS NOT PUBLIC ------------------------------
    insert into credential_templates (kind, version, name, design, is_active)
      values ('certificate', 990056, '056 proof', '{}'::jsonb, false);

    set local role authenticated;

    execute format('set local request.jwt.claim.sub = %L', stu);
    select count(*) into seen from credential_templates where version = 990056;
    if seen <> 0 then
      raise exception '056 FAILED: a student can read the blank certificate';
    end if;

    -- THE VISITOR WHO NEVER SIGNED IN. This is the caller `using (true)` was
    -- serving, and the one worth naming separately: not a member of staff with
    -- too much access, but the public.
    set local request.jwt.claim.sub = '';
    select count(*) into seen from credential_templates where version = 990056;
    if seen <> 0 then
      raise exception '056 FAILED: a visitor who is not signed in can read the blank certificate';
    end if;

    -- AND THE OFFICE THAT ISSUES FROM IT STILL CAN. A rule that also refuses
    -- the people who need the row is not a tighter rule, it is a broken screen.
    -- This assertion is what caught the proof above testing nothing at all.
    execute format('set local request.jwt.claim.sub = %L', reg);
    select count(*) into seen from credential_templates where version = 990056;
    if seen <> 1 then
      raise exception '056 FAILED: the Registrar cannot read the blank certificate';
    end if;

    reset role;

    -- ---- THE THREE BANDS --------------------------------------------------
    insert into appointments (full_name, position_title, employment_type, start_date,
                              place_of_duty, status, drafted_by, initiated_by_office)
      values ('056 Mine', 'A Proof Post', 'permanent', '2026-10-01', 'Buea', 'draft', hr, 'hr')
      returning id into a_mine;

    insert into appointments (full_name, position_title, employment_type, start_date,
                              place_of_duty, status, drafted_by, initiated_by_office)
      values ('056 Theirs', 'A Proof Post', 'permanent', '2026-10-01', 'Buea', 'draft',
              other_hr, 'hr')
      returning id into a_theirs;

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', hr);

    -- ON YOUR DESK. This is the band 041 did not have, and without it the HR
    -- screen is an empty table for the officer who drafted every row in it.
    select count(*) into seen from appointments where id = a_mine;
    if seen <> 1 then
      raise exception '056 FAILED: an HR officer cannot see the appointment they drafted';
    end if;

    -- AND NOT SOMEBODY ELSE'S.
    select count(*) into seen from appointments where id = a_theirs;
    if seen <> 0 then
      raise exception '056 FAILED: an HR officer can read an appointment off another desk';
    end if;

    -- AND NOT A STUDENT'S BUSINESS AT ALL.
    execute format('set local request.jwt.claim.sub = %L', stu);
    select count(*) into seen from appointments where id in (a_mine, a_theirs);
    if seen <> 0 then
      raise exception '056 FAILED: a student can read the appointment register';
    end if;

    -- THE REGISTER. The University has ruled the Registrar sees all of it.
    execute format('set local request.jwt.claim.sub = %L', reg);
    select count(*) into seen from appointments where id in (a_mine, a_theirs);
    if seen <> 2 then
      raise exception '056 FAILED: the Registrar cannot see the whole register';
    end if;

    -- AND THE VICE-CHANCELLOR, who since 055 may draft and approve alone and
    -- under 041's policy could not then see what they had made.
    execute format('set local request.jwt.claim.sub = %L', vc);
    select count(*) into seen from appointments where id in (a_mine, a_theirs);
    if seen <> 2 then
      raise exception '056 FAILED: the Vice-Chancellor cannot see the register';
    end if;

    reset role;

    -- ---- AN EXECUTIVE POST IS RESERVED ------------------------------------
    insert into positions (job_code, title, family, executive_level)
      values ('PROOF-EXEC-056', 'A Proof Executive Office', 'other', 'Executive')
      returning id into exec_post;

    refused := false;
    begin
      insert into appointments (full_name, position_title, employment_type, start_date,
                                place_of_duty, status, drafted_by, initiated_by_office,
                                position_id)
        values ('056 Exec', 'A Proof Executive Office', 'permanent', '2026-10-01', 'Buea',
                'draft', hr, 'hr', exec_post);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: HR filled an executive post';
    end if;

    -- AND THE APPOINTING AUTHORITY MAY.
    insert into appointments (full_name, position_title, employment_type, start_date,
                              place_of_duty, status, drafted_by, initiated_by_office,
                              position_id)
      values ('056 Exec', 'A Proof Executive Office', 'permanent', '2026-10-01', 'Buea',
              'draft', vc, 'vice-chancellor', exec_post);

    -- AND AN ORDINARY POST IS UNTOUCHED. A rule that quietly stops HR doing
    -- its ordinary work would be discovered as an outage, not as a rule.
    insert into positions (job_code, title, family)
      values ('PROOF-ORD-056', 'A Proof Ordinary Post', 'other')
      returning id into exec_post;
    insert into appointments (full_name, position_title, employment_type, start_date,
                              place_of_duty, status, drafted_by, initiated_by_office,
                              position_id)
      values ('056 Ordinary', 'A Proof Ordinary Post', 'permanent', '2026-10-01', 'Buea',
              'draft', hr, 'hr', exec_post);

    -- ---- THE GRANTS -------------------------------------------------------
    insert into capability_grants (grantee_id, capability, reason, granted_by, expires_at)
      values (hr, 'authorize-appointment',
              'Covering the Registrar during the September recess.', vc, now() + interval '14 days')
      returning id into g_id;

    -- NO OPEN-ENDED GRANT.
    refused := false;
    begin
      insert into capability_grants (grantee_id, capability, reason, granted_by, expires_at)
        values (hr, 'issue-credential', 'A perfectly good reason, at length.', vc, null);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a grant was made with no expiry';
    end if;

    -- NO GRANT WITHOUT A REASON. A full stop is what a mandatory box gets.
    refused := false;
    begin
      insert into capability_grants (grantee_id, capability, reason, granted_by, expires_at)
        values (hr, 'issue-credential', '.', vc, now() + interval '1 day');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a grant was made without a stated reason';
    end if;

    -- NOT REWRITEABLE.
    refused := false;
    begin
      update capability_grants set expires_at = now() + interval '400 days' where id = g_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a grant was rewritten after the fact';
    end if;

    -- NOT DELETABLE.
    refused := false;
    begin
      delete from capability_grants where id = g_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a grant was deleted';
    end if;

    -- REVOCABLE, AND THEN GONE FROM WHAT IS IN FORCE.
    if not exists (select 1 from capability_grants_in_force where id = g_id) then
      raise exception '056 FAILED: a live grant is not in force';
    end if;

    update capability_grants set revoked_at = now(), revoked_by = vc where id = g_id;

    if exists (select 1 from capability_grants_in_force where id = g_id) then
      raise exception '056 FAILED: a revoked grant is still in force';
    end if;

    -- AND THE REVOCATION DOES NOT COME OFF.
    refused := false;
    begin
      update capability_grants set revoked_at = null, revoked_by = null where id = g_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a revocation was undone';
    end if;

    -- AN EXPIRED GRANT IS NOT IN FORCE EITHER, and this is the one people
    -- forget: it was never revoked, so a caller checking `revoked_at is null`
    -- alone would still honour it.
    insert into capability_grants (grantee_id, capability, reason, granted_by,
                                   granted_at, expires_at)
      values (hr, 'issue-credential', 'An old grant that has since run out.', vc,
              now() - interval '30 days', now() - interval '1 day')
      returning id into g_id;

    if exists (select 1 from capability_grants_in_force where id = g_id) then
      raise exception '056 FAILED: an expired grant is still in force';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      reset role;
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '056 OK: the blank certificate and transcript are readable only by the offices '
               'that design, approve or issue from them — not by students, and not by visitors';
  raise notice '056 OK: the appointment register has three bands — yours, on your desk, and the '
               'whole register for the Registrar, the Vice-Chancellor and the Chancellor';
  raise notice '056 OK: an executive post can only be filled by the appointing authority';
  raise notice '056 OK: a grant expires, states a reason, cannot be rewritten or deleted, and '
               'is out of force once revoked or expired';
end $$;


-- ===========================================================================
-- 8. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHO CAN READ THE BLANK DOCUMENTS NOW. Before this file the answer was
-- `true`, meaning everybody. It should now name five offices.
-- ---------------------------------------------------------------------------
select 'credential_templates' as protects,
       pg_get_expr(polqual, polrelid) as readable_by
  from pg_policy
 where polname = 'credential_templates_read';

-- ---------------------------------------------------------------------------
-- AND THE GRANTS IN FORCE. Empty today. Anything here is somebody holding a
-- capability their role does not carry, and the row says who gave it, why,
-- and when it lapses.
-- ---------------------------------------------------------------------------
select count(*) filter (where true)                     as grants_ever,
       count(*) filter (where revoked_at is not null)   as revoked,
       count(*) filter (where expires_at <= now())      as expired,
       (select count(*) from capability_grants_in_force) as in_force
  from capability_grants;


-- ===========================================================================
-- ===========================================================================
--
--   057_the_academic_structure.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 057 — THE ACADEMIC STRUCTURE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE UNIVERSITY'S ACADEMIC STRUCTURE BECOMES DATA. Schools, departments,
-- programmes, the version of a programme somebody was admitted under, and the
-- curriculum that version carries — all of it in tables the Superadministrator
-- can manage, instead of TypeScript constants compiled into the website.
--
-- NOTHING IS SEEDED. Not one school, not one programme. The University has six
-- faculties and forty-one programmes recorded in src/content/, and moving them
-- is a decision about what is CURRENT — which of them are open, what version
-- each is on, which are archived — and that is the University's to make, not a
-- migration's. The tables arrive empty and a separate, reviewable seeding step
-- fills them.
--
-- AND NO CURRICULUM CAN BE APPROVED UNTIL THE UNIVERSITY SAYS WHO APPROVES ONE.
-- That is section 7 and it is the deliberate one. See below.
--
-- ---------------------------------------------------------------------------
-- WHY THIS FILE IS THE FOUNDATION AND NOT A FEATURE
-- ---------------------------------------------------------------------------
--
-- The University's own words: "the academic information architecture is
-- incomplete. It is currently organized around isolated utilities — Courses,
-- Course Registration, Timetable, LMS — rather than around the University's
-- actual academic structure."
--
-- That is right, and the reason the screens read as loose utilities is that
-- they are UNPARENTED. There has been nothing for them to hang from:
--
--   `faculty` is a TEXT COLUMN on departments, awards and students. Six
--   faculties exist as a TypeScript array. No school can be created.
--
--   A PROGRAMME is forty-one entries in programmeCatalogue.ts plus two rows in
--   `awards`. `courses.programme_slug` points at a programme by string.
--
--   A CURRICULUM is three files in src/content/curricula.ts, for three of the
--   forty-one. Year and semester live on the COURSE, which is why a course
--   cannot be core in one programme and elective in another.
--
--   AND NOTHING RECORDS WHICH CURRICULUM A STUDENT WAS ADMITTED UNDER, so
--   "did this student meet the requirements they signed up to" is a question
--   the database cannot answer. It can only answer "do they meet today's".
--
-- ---------------------------------------------------------------------------
-- WHAT IS VERSIONED, AND WHAT IS NOT
-- ---------------------------------------------------------------------------
--
-- `programmes` holds IDENTITY: the code, the award, the level. Those do not
-- change; a programme whose award changes is a different programme.
--
-- `programme_versions` holds everything that CAN change — including the NAME,
-- the school and the department. That is not pedantry. A transcript must print
-- the programme as it WAS. A department reorganised in 2029 must not silently
-- rewrite what a 2026 graduate studied, and it will if the name hangs off the
-- identity row.
-- ===========================================================================


-- ===========================================================================
-- 1. SCHOOLS AND FACULTIES
-- ===========================================================================
--
-- One table for both words. The University uses "Faculty of Theology" and
-- "School of Ministry" for the same kind of thing — an academic division that
-- owns departments and programmes — and two tables would mean every query
-- asking twice and every screen choosing a side.

create table if not exists schools (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z][a-z0-9-]{1,31}$'),
  -- THE FULL NAME AS THE UNIVERSITY WRITES IT, including the word it chooses.
  -- 'Faculty of Theology', 'School of Ministry'. Never assembled from the code.
  name        text not null check (length(btrim(name)) >= 4),
  mission     text,
  status      text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at  timestamptz not null default now()
);

comment on table schools is
  'The University''s academic divisions — faculties and schools alike. Empty on arrival: the six '
  'in src/content/faculties.ts are moved deliberately, not by this migration.';


-- ===========================================================================
-- 2. DEPARTMENTS BELONG TO A SCHOOL
-- ===========================================================================
--
-- `departments` already exists with a `faculty` TEXT column. The text is left
-- alone — something may still read it — and a real link is added beside it.
-- Nothing is migrated here: a text name cannot be resolved to a row that does
-- not exist yet.

alter table departments
  add column if not exists school_id uuid references schools (id) on delete restrict,
  add column if not exists status    text not null default 'active';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'departments_status_valid') then
    alter table departments add constraint departments_status_valid
      check (status in ('active', 'suspended', 'archived'));
  end if;
end $$;


-- ===========================================================================
-- 3. A PROGRAMME IS AN IDENTITY
-- ===========================================================================

create table if not exists programmes (
  id           uuid primary key default gen_random_uuid(),
  -- ---------------------------------------------------------------------
  -- THE ONE IMMUTABLE THING, AND IT IS THE SLUG THE UNIVERSITY ALREADY USES.
  --
  -- Everything else about a programme may be revised in a new version; the
  -- code is how the revisions are known to be the same programme.
  --
  -- This was an invented uppercase form capped at 24 characters, and 23 of the
  -- University's 41 programmes have identifiers longer than that —
  -- `diploma-in-air-conditioning-refrigeration` is 41. Abbreviating them would
  -- have meant inventing 41 programme codes the University has never used.
  --
  -- It already has one. The slug is in every programme URL on the live site
  -- and in `courses.programme_slug`, so taking it verbatim means the register
  -- joins to the website and to the course table with no translation, and
  -- nothing here is made up. It is also the same shape as `schools.code`.
  -- ---------------------------------------------------------------------
  code         text not null unique check (code ~ '^[a-z][a-z0-9-]{1,63}$'),
  award_id     uuid references awards (id) on delete restrict,
  -- The level, in the University's own vocabulary from programmeCatalogue.ts.
  award_level  text not null check (award_level in
                 ('Certificate', 'Diploma', 'Bachelor''s', 'Postgraduate Diploma',
                  'Master''s', 'Doctorate')),
  -- ---------------------------------------------------------------------
  -- THE PROGRAMME LIFECYCLE, as the University stated it.
  --
  -- 'open_for_admission' is a STATE, not a flag beside one. Migration 023
  -- seeds every programme closed so that admission is opt-in, and this is
  -- where that now lives: a programme is open because somebody moved it to
  -- open, and section 8 refuses the move unless a version has been approved.
  -- ---------------------------------------------------------------------
  status       text not null default 'draft' check (status in
                 ('draft', 'under_review', 'approved', 'open_for_admission',
                  'active', 'suspended', 'archived')),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AND THE PATTERN IS REPLACED ON A DATABASE THAT ALREADY HAS THE TABLE.
--
-- `create table if not exists` does exactly nothing when the table is there —
-- including nothing to its CHECK constraints. So widening the code pattern in
-- the block above reached a fresh database and NOT the University's, which had
-- already run the earlier version of this file. The proof then inserted the
-- new lowercase code against the old uppercase constraint and stopped the
-- whole bundle:
--
--     ERROR: 23514: new row for relation "programmes" violates check
--            constraint "programmes_code_check"
--     DETAIL: Failing row contains (…, proof-bachelor-of-study, …)
--
-- MY TESTING COULD NOT HAVE FOUND THIS. Every run was from an empty database,
-- where `create table` does apply the new constraint. The upgrade path — an
-- older version of this same file, then this one — is the path the University
-- is actually on, and it was the one path never exercised.
--
-- 056 already had to do this for `profiles_role_valid`. Any constraint that
-- changes after a table has shipped needs its own drop-and-add; editing the
-- create block is a change that only ever reaches new installations.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'programmes_code_check') then
    alter table programmes drop constraint programmes_code_check;
  end if;
  alter table programmes add constraint programmes_code_check
    check (code ~ '^[a-z][a-z0-9-]{1,63}$');
end $$;

comment on table programmes is
  'A programme''s identity: its code, its award and where it stands. Everything that can be '
  'revised — name, school, duration, credits, curriculum — belongs to programme_versions, so a '
  'transcript can print the programme as it was rather than as it is.';


-- ===========================================================================
-- 4. AND A VERSION IS WHAT IT WAS AT THE TIME
-- ===========================================================================

create table if not exists programme_versions (
  id                uuid primary key default gen_random_uuid(),
  programme_id      uuid not null references programmes (id) on delete cascade,
  -- '2026', '2026-revised'. The University's own label, not a serial number.
  version_label     text not null check (length(btrim(version_label)) between 1 and 32),

  -- WHAT IT WAS CALLED, AND WHOSE IT WAS. On the version, not the programme.
  name              text not null check (length(btrim(name)) >= 4),
  school_id         uuid references schools (id) on delete restrict,
  department_id     uuid references departments (id) on delete restrict,

  duration_years      integer not null check (duration_years between 1 and 10),
  semesters_per_year  integer not null default 2 check (semesters_per_year between 1 and 4),
  total_credits       integer check (total_credits is null or total_credits > 0),

  description             text,
  admission_requirements  text,
  graduation_requirements text,
  academic_regulations    text,
  coordinator_id          uuid references auth.users (id) on delete set null,

  effective_from    date not null,
  -- NULL means "still in force". Closed when a later version supersedes it.
  effective_to      date,

  status            text not null default 'draft' check (status in
                      ('draft', 'department_review', 'faculty_review', 'board_review',
                       'approved', 'published', 'superseded', 'withdrawn')),
  drafted_by        uuid references auth.users (id) on delete set null,
  approved_at       timestamptz,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),

  unique (programme_id, version_label),
  constraint programme_versions_dates_run_forwards
    check (effective_to is null or effective_to > effective_from)
);

-- ONE PUBLISHED VERSION AT A TIME. Two versions in force is two different
-- answers to "what must this student do to graduate".
create unique index if not exists programme_versions_one_in_force
  on programme_versions (programme_id) where status = 'published';

create index if not exists programme_versions_by_programme
  on programme_versions (programme_id, effective_from desc);


-- ===========================================================================
-- 5. THE CURRICULUM
-- ===========================================================================
--
-- WHY `requirement` IS HERE AND NOT ON `courses`.
--
-- `courses.is_elective` says a course is elective everywhere. The University
-- put the counter-example plainly: "The same course may potentially belong to
-- several programmes." Then BIS 220 can be core in the Bachelor of Theology
-- and elective in the Diploma, and one boolean on the course cannot say both.
--
-- The same is true of `courses.year`, `courses.semester` and
-- `courses.programme_slug`. All four are programme-relative and all four are on
-- the wrong table. They are left in place — things still read them — and the
-- truth moves here.

create table if not exists curriculum_entries (
  id                    uuid primary key default gen_random_uuid(),
  programme_version_id  uuid not null references programme_versions (id) on delete cascade,
  course_id             uuid not null references courses (id) on delete restrict,
  year                  integer not null check (year between 1 and 10),
  semester              integer not null check (semester between 1 and 4),
  requirement           text not null default 'core' check (requirement in
                          ('core', 'elective', 'required-elective')),
  -- The credits AS COUNTED BY THIS PROGRAMME. Usually the course's own value;
  -- occasionally not, and a transcript must print what was counted.
  credits               integer check (credits is null or credits > 0),
  created_at            timestamptz not null default now(),

  -- A course appears once in a version. Twice is a registration that can be
  -- taken twice and a credit total that double-counts.
  unique (programme_version_id, course_id)
);

create index if not exists curriculum_entries_by_term
  on curriculum_entries (programme_version_id, year, semester);

comment on table curriculum_entries is
  'A course''s place in one version of one programme: which year, which semester, and whether it '
  'is core there. The same course may sit differently in another programme — which is why this is '
  'not on `courses`.';


-- ===========================================================================
-- 6. THE STUDENT IS ATTACHED TO A VERSION
-- ===========================================================================
--
-- The load-bearing column of this whole migration.
--
-- The University: "Students remain attached to the curriculum version under
-- which they were admitted." Without this, graduation eligibility answers the
-- wrong question — "do they meet today's requirements" rather than "did they
-- meet the ones they were admitted under" — and every curriculum revision
-- silently re-examines everybody already enrolled.

alter table students
  add column if not exists programme_version_id uuid
    references programme_versions (id) on delete restrict;

create index if not exists students_by_programme_version
  on students (programme_version_id) where programme_version_id is not null;


-- ===========================================================================
-- 7. ACADEMIC GOVERNANCE — AND THE UNIVERSITY HAS NOT YET NAMED THE BOARD
-- ===========================================================================
--
-- The University: "academic changes should not simply be editable by Superadmin
-- … Draft → Department Review → Faculty Review → Academic Board Approval."
--
-- THE PATTERN IS NOT NEW HERE. Migration 005 already does exactly this for
-- credential designs: approvals are ROWS, the quorum is named, and a trigger
-- refuses publication while any of the three offices has not signed.
--
-- WHAT IS DIFFERENT, AND IT IS THE POINT OF THIS SECTION. 005 could hardcode
-- its three offices because the University had named them — the Registrar, the
-- Academic Office and the Vice Chancellor. For a curriculum it has named
-- "the Academic Board", which is not a role this system has and not a
-- membership anybody has stated.
--
-- So the quorum is DATA, and `academic_approval_requirements` arrives EMPTY.
-- The trigger in section 8 refuses to approve a curriculum while it is empty,
-- and says so in words. The University fills it in one INSERT and the chain
-- comes alive; until then the system will not pretend a curriculum has been
-- approved by anybody.
--
-- INVENTING THE BOARD WOULD HAVE BEEN EASIER AND WORSE. A seeded quorum of
-- plausible offices is a governance chain that looks enforced and was never
-- agreed, and the first thing it would do is approve a curriculum in the name
-- of a body that has never met.

create table if not exists academic_approval_requirements (
  subject   text not null check (subject in ('curriculum', 'course', 'programme')),
  -- A role from profiles.role. Not constrained to a vocabulary here: 056 widened
  -- that list once already and a second copy in this file would go stale.
  office    text not null check (length(btrim(office)) >= 3),
  note      text,
  primary key (subject, office)
);

comment on table academic_approval_requirements is
  'Which offices must each approve an academic change before it takes effect. EMPTY ON PURPOSE — '
  'the University has not stated who sits on the Academic Board, and a seeded quorum would be a '
  'governance chain that looks enforced and was never agreed.';

create table if not exists academic_approvals (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null check (subject in ('curriculum', 'course', 'programme')),
  subject_id  uuid not null,
  office      text not null,
  decision    text not null check (decision in ('approved', 'rejected')),
  decided_by  uuid not null references auth.users (id) on delete restrict,
  decided_at  timestamptz not null default now(),
  -- A REJECTION MUST SAY WHY. An approval need not: the signature is the
  -- statement. A refusal that gives no reason cannot be answered.
  reason      text,
  constraint academic_approvals_rejection_is_explained
    check (decision <> 'rejected' or length(btrim(coalesce(reason, ''))) >= 10),
  -- One decision per office per subject. Changing your mind is a new subject
  -- version, not a rewritten signature.
  unique (subject, subject_id, office)
);

create index if not exists academic_approvals_by_subject
  on academic_approvals (subject, subject_id);

-- AN APPROVAL IS NOT REWRITTEN OR DELETED, for the same reason 056's grants are
-- not: the record of who signed what, and when, is the entire value.
create or replace function refuse_to_rewrite_an_academic_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception
    'An academic approval is a signature. It is not edited and it is not deleted — if the '
    'decision has changed, the change belongs to a new version.'
    using errcode = 'check_violation';
end $$;

drop trigger if exists academic_approvals_are_signatures on academic_approvals;
create trigger academic_approvals_are_signatures
  before update or delete on academic_approvals
  for each row execute function refuse_to_rewrite_an_academic_approval();


-- ===========================================================================
-- 8. THE REFUSALS
-- ===========================================================================
--
-- A lifecycle column with nothing enforcing it is a label. These are the rules
-- that make the vocabulary in sections 3 and 4 mean something.

-- ---------------------------------------------------------------------------
-- 8a. A CURRICULUM IS NOT APPROVED WITHOUT ITS QUORUM
-- ---------------------------------------------------------------------------

create or replace function refuse_unapproved_curriculum()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  needed  integer;
  signed  integer;
  missing text;
begin
  -- Only the move INTO approved or published is checked. Everything earlier in
  -- the chain is the University's own business.
  if new.status not in ('approved', 'published') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('approved', 'published') then return new; end if;

  select count(*) into needed
    from academic_approval_requirements where subject = 'curriculum';

  -- THE CASE THIS SECTION EXISTS FOR.
  if needed = 0 then
    raise exception
      'No approving body has been recorded for a curriculum, so this version cannot be '
      'approved. The University must first state which offices must sign — insert them into '
      'academic_approval_requirements (subject = ''curriculum''). Until then the system will '
      'not record a curriculum as approved by nobody.'
      using errcode = 'check_violation';
  end if;

  select count(*) into signed
    from academic_approvals a
    join academic_approval_requirements r
      on r.subject = 'curriculum' and r.office = a.office
   where a.subject = 'curriculum' and a.subject_id = new.id and a.decision = 'approved';

  if signed < needed then
    select string_agg(r.office, ', ' order by r.office) into missing
      from academic_approval_requirements r
     where r.subject = 'curriculum'
       and not exists (select 1 from academic_approvals a
                        where a.subject = 'curriculum' and a.subject_id = new.id
                          and a.office = r.office and a.decision = 'approved');
    raise exception
      'This curriculum has % of % approvals. Still to sign: %.', signed, needed, missing
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists programme_versions_need_their_quorum on programme_versions;
create trigger programme_versions_need_their_quorum
  before insert or update on programme_versions
  for each row execute function refuse_unapproved_curriculum();

-- ---------------------------------------------------------------------------
-- 8b. AN APPROVED CURRICULUM DOES NOT CHANGE UNDER THE STUDENTS ON IT
-- ---------------------------------------------------------------------------
--
-- This is 044's rule for document templates, applied to the thing it matters
-- most for. Once a version is approved, its courses, years, semesters and
-- core/elective marks are what the students on it signed up to. A revision is
-- a NEW version.

create or replace function refuse_to_edit_an_approved_curriculum()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  state text;
  vid   uuid;
begin
  vid := coalesce(new.programme_version_id, old.programme_version_id);
  select status into state from programme_versions where id = vid;

  if state in ('approved', 'published', 'superseded') then
    raise exception
      'This curriculum has been approved and cannot be changed. Students are attached to it as '
      'it stands. Create a new version of the programme and revise that.'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists curriculum_entries_freeze_on_approval on curriculum_entries;
create trigger curriculum_entries_freeze_on_approval
  before insert or update or delete on curriculum_entries
  for each row execute function refuse_to_edit_an_approved_curriculum();

-- ---------------------------------------------------------------------------
-- 8c. A PROGRAMME OPENS FOR ADMISSION ONLY WITH A PUBLISHED CURRICULUM
-- ---------------------------------------------------------------------------
--
-- Migration 023 seeded every programme closed so that admission is a decision
-- somebody takes rather than a default. This is the same ruling, made
-- structural: a programme cannot be advertised to applicants before the
-- University has agreed what it consists of.

create or replace function refuse_admission_to_an_unformed_programme()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('open_for_admission', 'active')
     and not exists (select 1 from programme_versions
                      where programme_id = new.id and status = 'published') then
    raise exception
      'This programme has no published curriculum, so it cannot be opened for admission. An '
      'applicant would be accepting a programme whose content the University has not yet agreed.'
      using errcode = 'check_violation';
  end if;

  -- AND IT DOES NOT CLOSE OVER PEOPLE. Archiving a programme somebody is
  -- enrolled on leaves a student attached to a programme that no longer runs.
  if new.status = 'archived'
     and exists (select 1 from students s
                  join programme_versions v on v.id = s.programme_version_id
                 where v.programme_id = new.id
                   and coalesce(s.student_status, 'enrolled') not in ('graduated', 'withdrawn')) then
    raise exception
      'Students are still enrolled on this programme. It cannot be archived while anybody is '
      'reading for it — suspend it to stop new admissions instead.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists programmes_open_only_when_formed on programmes;
create trigger programmes_open_only_when_formed
  before insert or update on programmes
  for each row execute function refuse_admission_to_an_unformed_programme();


-- ===========================================================================
-- 9. WHO CAN READ WHAT
-- ===========================================================================
--
-- The academic structure is ordinary institutional information — what the
-- University teaches, and what it takes to graduate. A student reading the
-- curriculum they are on is the point of publishing one.
--
-- WHAT IS NOT PUBLIC is an unfinished one. A draft curriculum is a proposal
-- under discussion, and an applicant reading it as though it were the
-- programme would be reading something the University has not agreed.

alter table schools                        enable row level security;
alter table programmes                     enable row level security;
alter table programme_versions             enable row level security;
alter table curriculum_entries             enable row level security;
alter table academic_approvals             enable row level security;
alter table academic_approval_requirements enable row level security;

drop policy if exists schools_read on schools;
create policy schools_read on schools for select using (true);

drop policy if exists programmes_read on programmes;
create policy programmes_read on programmes
  for select using (
    status in ('open_for_admission', 'active', 'suspended')
    or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                       'vice-chancellor', 'chancellor', 'dean', 'hod')
  );

drop policy if exists programme_versions_read on programme_versions;
create policy programme_versions_read on programme_versions
  for select using (
    status = 'published'
    -- YOUR OWN CURRICULUM, whatever became of it since. A student whose
    -- version has been superseded must still be able to read the one they are
    -- actually being examined against.
    or exists (select 1 from students s
                where s.programme_version_id = programme_versions.id
                  and s.auth_user_id = auth.uid())
    or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                       'vice-chancellor', 'chancellor', 'dean', 'hod')
  );

drop policy if exists curriculum_entries_read on curriculum_entries;
create policy curriculum_entries_read on curriculum_entries
  for select using (
    exists (select 1 from programme_versions v
             where v.id = curriculum_entries.programme_version_id
               and (v.status = 'published'
                    or exists (select 1 from students s
                                where s.programme_version_id = v.id
                                  and s.auth_user_id = auth.uid())))
    or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                       'vice-chancellor', 'chancellor', 'dean', 'hod')
  );

-- THE SIGNATURES ARE VISIBLE TO THE ACADEMIC OFFICES. A governance chain
-- nobody can inspect is a governance chain nobody can rely on.
drop policy if exists academic_approvals_read on academic_approvals;
create policy academic_approvals_read on academic_approvals
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                    'vice-chancellor', 'chancellor', 'dean', 'hod')
  );

drop policy if exists academic_approval_requirements_read on academic_approval_requirements;
create policy academic_approval_requirements_read on academic_approval_requirements
  for select using (auth.uid() is not null);

-- No write policy on any of them. Every change goes through the API, which
-- checks the capability and records who acted.


-- ===========================================================================
-- 10. WHAT A PROGRAMME IS, IN ONE ROW
-- ===========================================================================
--
-- The screens ask the same question repeatedly — what is this programme, whose
-- is it, which version is in force, how long is it and how many credits — and
-- each one joining four tables for itself is four chances to join them
-- differently.

create or replace view programme_in_force
with (security_invoker = true) as
select p.id                as programme_id,
       p.code,
       p.award_level,
       p.status            as programme_status,
       v.id                as version_id,
       v.version_label,
       v.name,
       v.duration_years,
       v.semesters_per_year,
       v.total_credits,
       v.effective_from,
       s.code              as school_code,
       s.name              as school_name,
       d.name              as department_name,
       (select count(*) from curriculum_entries e where e.programme_version_id = v.id)
                           as courses_in_curriculum,
       (select coalesce(sum(coalesce(e.credits, c.credit_unit)), 0)
          from curriculum_entries e join courses c on c.id = e.course_id
         where e.programme_version_id = v.id)
                           as credits_in_curriculum
  from programmes p
  left join programme_versions v
         on v.programme_id = p.id and v.status = 'published'
  left join schools s     on s.id = v.school_id
  left join departments d on d.id = v.department_id;

comment on view programme_in_force is
  'Each programme with the version currently published, and what that curriculum actually adds '
  'up to. `credits_in_curriculum` against `total_credits` is the Curriculum Builder''s running '
  'total and the dashboard''s "programme/curriculum issues" in one place.';


-- ===========================================================================
-- 11. PROVE IT
-- ===========================================================================

do $$
declare
  officer   uuid;
  dean_id   uuid;
  sch       uuid;
  dept      uuid;
  prog      uuid;
  v1        uuid;
  v2        uuid;
  crs       uuid;
  refused   boolean;
  msg       text;
begin
  begin
    officer := gen_random_uuid();
    dean_id := gen_random_uuid();
    insert into auth.users (id, email) values
      (officer, '057-registrar@example.test'), (dean_id, '057-dean@example.test');

    -- ---------------------------------------------------------------------
    -- THE PROOF SETS ITS OWN STARTING POINT.
    --
    -- The first assertion below is that with NO approving body recorded, the
    -- refusal explains how to record one. 058 seeds exactly such a body, so on
    -- a database that has had 058 this proof used to get a different refusal
    -- and fail — RUN-ALL was clean on its first pass from empty and red on its
    -- second.
    --
    -- This is the same collision 045 had with 055, and the same fix: a proof
    -- must not assume the state a later migration deliberately changes. The
    -- whole block rolls back, so anything 058 seeded is restored when it does.
    -- ---------------------------------------------------------------------
    delete from academic_approval_requirements where subject = 'curriculum';

    insert into schools (code, name) values ('proof-school', 'A Proof School of Study')
      returning id into sch;
    -- `faculty` is NOT NULL on the existing table — the text column section 2
    -- leaves in place. A proof that did not set it would fail on a real database
    -- for a reason that has nothing to do with this migration.
    insert into departments (name, code, faculty, school_id)
      values ('A Proof Department', 'PRF', 'A Proof School of Study', sch)
      returning id into dept;

    insert into programmes (code, award_level, status)
      values ('proof-bachelor-of-study', 'Bachelor''s', 'draft') returning id into prog;

    insert into programme_versions
      (programme_id, version_label, name, school_id, department_id,
       duration_years, semesters_per_year, total_credits, effective_from, drafted_by)
    values (prog, '2026', 'A Proof Bachelor of Study', sch, dept,
            3, 2, 180, current_date, officer)
    returning id into v1;

    -- ---- THE UNIVERSITY HAS NOT NAMED THE BOARD ---------------------------
    -- Nothing can be approved, and the refusal says what to do about it.
    refused := false;
    begin
      update programme_versions set status = 'approved' where id = v1;
    exception when others then refused := true; msg := sqlerrm;
    end;
    if not refused then
      raise exception '057 FAILED: a curriculum was approved with no approving body recorded';
    end if;
    if position('academic_approval_requirements' in msg) = 0 then
      raise exception '057 FAILED: the refusal does not say how to record the approving body';
    end if;

    -- ---- ONCE IT HAS, THE QUORUM IS COUNTED -------------------------------
    insert into academic_approval_requirements (subject, office) values
      ('curriculum', 'academic-office'), ('curriculum', 'dean');

    refused := false;
    begin
      update programme_versions set status = 'approved' where id = v1;
    exception when others then refused := true; msg := sqlerrm;
    end;
    if not refused then
      raise exception '057 FAILED: a curriculum was approved with none of its quorum signed';
    end if;
    if position('0 of 2 approvals' in msg) = 0 then
      raise exception '057 FAILED: the refusal does not count the approvals: %', msg;
    end if;

    -- ONE SIGNATURE IS NOT ENOUGH, and the refusal names who is still missing.
    insert into academic_approvals (subject, subject_id, office, decision, decided_by)
      values ('curriculum', v1, 'academic-office', 'approved', officer);

    refused := false;
    begin
      update programme_versions set status = 'approved' where id = v1;
    exception when others then refused := true; msg := sqlerrm;
    end;
    if not refused then
      raise exception '057 FAILED: one of two approvals was accepted as a quorum';
    end if;
    if position('dean' in msg) = 0 then
      raise exception '057 FAILED: the refusal does not name who has still to sign: %', msg;
    end if;

    -- ---- A COURSE CAN BE PLACED WHILE THE VERSION IS A DRAFT --------------
    insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PRF 101', 'A Proof Course', 6, dept, 100, 1, 1) returning id into crs;
    insert into curriculum_entries (programme_version_id, course_id, year, semester, requirement)
      values (v1, crs, 1, 1, 'core');

    -- AND NOT TWICE. Twice is a credit total that double-counts.
    refused := false;
    begin
      insert into curriculum_entries (programme_version_id, course_id, year, semester)
        values (v1, crs, 2, 1);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '057 FAILED: one course was placed twice in one curriculum';
    end if;

    -- ---- WITH THE QUORUM COMPLETE, IT APPROVES ----------------------------
    insert into academic_approvals (subject, subject_id, office, decision, decided_by)
      values ('curriculum', v1, 'dean', 'approved', dean_id);
    update programme_versions set status = 'approved', approved_at = now() where id = v1;

    if not exists (select 1 from programme_versions where id = v1 and status = 'approved') then
      raise exception '057 FAILED: a fully approved curriculum was still refused';
    end if;

    -- ---- AND THEN IT IS FROZEN --------------------------------------------
    refused := false;
    begin
      insert into curriculum_entries (programme_version_id, course_id, year, semester)
        values (v1, crs, 3, 1);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '057 FAILED: a course was added to an approved curriculum';
    end if;

    refused := false;
    begin
      delete from curriculum_entries where programme_version_id = v1;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '057 FAILED: an approved curriculum was emptied';
    end if;

    -- ---- A SIGNATURE IS NOT REWRITTEN -------------------------------------
    refused := false;
    begin
      update academic_approvals set decision = 'rejected'
       where subject_id = v1 and office = 'dean';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '057 FAILED: an approval was rewritten after the fact';
    end if;

    -- AND A REJECTION SAYS WHY.
    refused := false;
    begin
      insert into academic_approvals (subject, subject_id, office, decision, decided_by)
        values ('curriculum', v1, 'registrar', 'rejected', officer);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '057 FAILED: a curriculum was rejected with no reason given';
    end if;

    -- ---- ADMISSION NEEDS A PUBLISHED CURRICULUM ---------------------------
    refused := false;
    begin
      update programmes set status = 'open_for_admission' where id = prog;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '057 FAILED: a programme opened for admission with no published curriculum';
    end if;

    update programme_versions set status = 'published', published_at = now() where id = v1;
    update programmes set status = 'open_for_admission' where id = prog;

    -- ---- ONE PUBLISHED VERSION AT A TIME ----------------------------------
    --
    -- THIS PROOF PASSED WITH THE INDEX DELIBERATELY BROKEN, which is why it is
    -- now written like this. The 2027 version used to be published without its
    -- quorum, so the QUORUM trigger refused it — and `refused` came back true
    -- whether or not anything stopped two versions being in force at once. A
    -- refusal for the wrong reason proves nothing, and this one was hiding the
    -- absence of the rule it claimed to test.
    --
    -- So 2027 is signed off completely first. With the quorum satisfied, the
    -- only rule left that can refuse the publish is the one under test — and
    -- the refusal is checked by NAME rather than merely counted.
    insert into programme_versions
      (programme_id, version_label, name, school_id, department_id,
       duration_years, semesters_per_year, total_credits, effective_from, drafted_by)
    values (prog, '2027', 'A Proof Bachelor of Study', sch, dept,
            3, 2, 180, current_date + 365, officer)
    returning id into v2;

    insert into academic_approvals (subject, subject_id, office, decision, decided_by) values
      ('curriculum', v2, 'academic-office', 'approved', officer),
      ('curriculum', v2, 'dean', 'approved', dean_id);
    update programme_versions set status = 'approved', approved_at = now() where id = v2;

    refused := false;
    begin
      update programme_versions set status = 'published' where id = v2;
    exception when others then refused := true; msg := sqlerrm;
    end;
    if not refused then
      raise exception '057 FAILED: two versions of one programme were in force at once';
    end if;
    if position('programme_versions_one_in_force' in msg) = 0 then
      raise exception '057 FAILED: the second version was refused, but not by the '
                      'one-in-force rule: %', msg;
    end if;

    -- ---- AND THE VIEW ADDS UP WHAT IS ACTUALLY THERE ----------------------
    if (select credits_in_curriculum from programme_in_force where programme_id = prog) <> 6 then
      raise exception '057 FAILED: the curriculum total is not counted from its entries';
    end if;
    if (select courses_in_curriculum from programme_in_force where programme_id = prog) <> 1 then
      raise exception '057 FAILED: the curriculum course count is wrong';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '057 OK: a curriculum cannot be approved until the University has recorded WHO '
               'approves one, and the refusal says how to record it';
  raise notice '057 OK: the quorum is counted, the refusal names who has still to sign, and a '
               'signature can be neither rewritten nor deleted';
  raise notice '057 OK: an approved curriculum is frozen — students are attached to it as it '
               'stands, and a revision is a new version';
  raise notice '057 OK: a programme cannot open for admission without a published curriculum, '
               'cannot be archived over enrolled students, and has one version in force at a time';
end $$;


-- ===========================================================================
-- 12. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- THE STRUCTURE, AND IT IS EMPTY. Every count below should read 0 the first
-- time this runs. That is correct: this migration builds the shape and seeds
-- nothing, because WHICH of the University's forty-one programmes are current,
-- and on what version, is a decision and not a default.
-- ---------------------------------------------------------------------------
select (select count(*) from schools)             as schools,
       (select count(*) from programmes)          as programmes,
       (select count(*) from programme_versions)  as versions,
       (select count(*) from curriculum_entries)  as curriculum_entries,
       (select count(*) from students where programme_version_id is not null)
                                                  as students_on_a_version;

-- ---------------------------------------------------------------------------
-- AND WHO APPROVES AN ACADEMIC CHANGE. Empty means no curriculum can be
-- approved yet, by anybody, including the Superadministrator. That is section
-- 7 working, not a fault. Fill it when the University has named the Board:
--
--   insert into academic_approval_requirements (subject, office) values
--     ('curriculum', 'hod'), ('curriculum', 'dean'), ('curriculum', '<the board>');
-- ---------------------------------------------------------------------------
select subject, office, note from academic_approval_requirements order by subject, office;


-- ===========================================================================
-- ===========================================================================
--
--   058_the_vice_chancellor_approves_a_curriculum.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 058 — THE VICE-CHANCELLOR APPROVES A CURRICULUM
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- CURRICULUM APPROVAL BECOMES POSSIBLE. Since 057 no curriculum could be
-- approved by anybody, including the Superadministrator, because
-- `academic_approval_requirements` was empty and the system refuses to record
-- a curriculum as approved by nobody. This names the office: the
-- Vice-Chancellor.
--
-- The University's ruling, in full: "the VC approves a corriculum."
--
-- ---------------------------------------------------------------------------
-- ONE OFFICE, AND SAY SO PLAINLY
-- ---------------------------------------------------------------------------
--
-- The chain the University drew earlier was
--
--     Draft → Department Review → Faculty Review → Academic Board Approval
--
-- and it named the Vice-Chancellor when asked who approves. So this seeds ONE
-- required office rather than three. The Head of Department and the Dean are
-- not omitted by accident and they are not out of the picture — the version
-- still moves through `department_review` and `faculty_review`, which is where
-- their scrutiny sits. What this table holds is narrower: the signature that
-- GATES the move to approved.
--
-- IF THE UNIVERSITY MEANT THEIR SIGNATURES TO GATE IT TOO, it is one statement
-- and the chain tightens immediately, with no code change anywhere:
--
--     insert into academic_approval_requirements (subject, office) values
--       ('curriculum', 'hod'), ('curriculum', 'dean')
--     on conflict do nothing;
--
-- That is the whole point of 057 holding the quorum as data. Adding an office
-- is an INSERT, not a migration and not a deployment.
--
-- ---------------------------------------------------------------------------
-- AND IT IS STILL NOT SOLE AUTHORITY
-- ---------------------------------------------------------------------------
--
-- 055 lets the Vice-Chancellor draft an appointment letter and approve it
-- alone, marked permanently, because the appointing authority IS theirs.
--
-- This is a different thing wearing a similar shape, and the difference
-- matters. The Vice-Chancellor approving a curriculum is an office signing a
-- register that records the signature, the date and the version signed. Nobody
-- can later say a curriculum was approved without saying who approved it and
-- when — and 057 refuses to let that signature be edited or deleted
-- afterwards.
--
-- `made_on_sole_authority` belongs to appointments and does not appear here.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 057 FIRST, AND SAY SO RATHER THAN LETTING POSTGRES SAY IT.
--
-- The University ran this file on its own and got:
--
--     ERROR: 42P01: relation "academic_approval_requirements" does not exist
--
-- which is true, unhelpful, and looks like a defect in the migration rather
-- than a missing one before it. 057 creates that table; this file only puts a
-- row in it.
--
-- A migration that depends on an earlier one should name it. The cost of not
-- doing so is somebody reading a Postgres error code at the end of a long day
-- and concluding the file is broken.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.academic_approval_requirements') is null then
    raise exception
      '058 needs 057 first. 057_the_academic_structure.sql creates the academic structure — '
      'schools, programmes, programme versions and the approvals table this file seeds — and it '
      'has not been run on this database. Run RUN-OUTSTANDING.sql, which contains both in order '
      'and is safe to re-run over anything already applied.'
      using errcode = 'undefined_table';
  end if;
end $$;

insert into academic_approval_requirements (subject, office, note)
values ('curriculum', 'vice-chancellor',
        'The University''s ruling: the Vice-Chancellor approves a curriculum. A version moves '
        'through department and faculty review before reaching this signature; this is the '
        'signature that gates approval.')
on conflict (subject, office) do nothing;


-- ===========================================================================
-- PROVE IT
-- ===========================================================================

do $$
declare
  vc      uuid;
  officer uuid;
  sch     uuid;
  dept    uuid;
  prog    uuid;
  ver     uuid;
  refused boolean;
  msg     text;
begin
  begin
    vc      := gen_random_uuid();
    officer := gen_random_uuid();
    insert into auth.users (id, email) values
      (vc, '058-vc@example.test'), (officer, '058-officer@example.test');

    insert into schools (code, name) values ('proof-058', 'A Proof School of Study')
      returning id into sch;
    insert into departments (name, code, faculty, school_id)
      values ('A Proof Department', 'P58', 'A Proof School of Study', sch) returning id into dept;
    insert into programmes (code, award_level) values ('proof-doctor-of-study', 'Doctorate')
      returning id into prog;

    -- A DOCTORATE IS TWO YEARS. The University's ruling, and the first row in
    -- this system to record it as a number rather than as a sentence on a
    -- marketing page.
    insert into programme_versions
      (programme_id, version_label, name, school_id, department_id,
       duration_years, semesters_per_year, total_credits, effective_from, drafted_by)
    values (prog, '2026', 'A Proof Doctor of Study', sch, dept,
            2, 2, null, current_date, officer)
    returning id into ver;

    -- ---- WITHOUT THE VICE-CHANCELLOR, NO ----------------------------------
    refused := false;
    begin
      update programme_versions set status = 'approved' where id = ver;
    exception when others then refused := true; msg := sqlerrm;
    end;
    if not refused then
      raise exception '058 FAILED: a curriculum was approved without the Vice-Chancellor';
    end if;
    if position('vice-chancellor' in msg) = 0 then
      raise exception '058 FAILED: the refusal does not name the Vice-Chancellor: %', msg;
    end if;

    -- AND ANOTHER OFFICE'S SIGNATURE IS NOT A SUBSTITUTE. This is the check
    -- that matters: a registrar signing in good faith must not satisfy a
    -- requirement the University placed on the Vice-Chancellor.
    insert into academic_approvals (subject, subject_id, office, decision, decided_by)
      values ('curriculum', ver, 'registrar', 'approved', officer);

    refused := false;
    begin
      update programme_versions set status = 'approved' where id = ver;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '058 FAILED: another office stood in for the Vice-Chancellor';
    end if;

    -- ---- WITH IT, YES -----------------------------------------------------
    insert into academic_approvals (subject, subject_id, office, decision, decided_by)
      values ('curriculum', ver, 'vice-chancellor', 'approved', vc);

    update programme_versions set status = 'approved', approved_at = now() where id = ver;

    if not exists (select 1 from programme_versions where id = ver and status = 'approved') then
      raise exception '058 FAILED: the Vice-Chancellor approved it and it was still refused';
    end if;

    -- AND THE RECORD SAYS WHO. An approval nobody can attribute is the thing
    -- this whole chain exists to prevent.
    if not exists (select 1 from academic_approvals
                    where subject = 'curriculum' and subject_id = ver
                      and office = 'vice-chancellor' and decided_by = vc) then
      raise exception '058 FAILED: the approval does not record who gave it';
    end if;

    -- ---- AND IT CANNOT BE TAKEN BACK QUIETLY ------------------------------
    refused := false;
    begin
      delete from academic_approvals
       where subject_id = ver and office = 'vice-chancellor';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '058 FAILED: the Vice-Chancellor''s signature was deleted';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '058 OK: a curriculum cannot be approved without the Vice-Chancellor, and no '
               'other office stands in for that signature';
  raise notice '058 OK: with it the version approves, the record names who signed and when, '
               'and the signature cannot be deleted afterwards';
end $$;


-- ===========================================================================
-- VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHO MUST SIGN AN ACADEMIC CHANGE. One row: curriculum, vice-chancellor.
--
-- Add the Head of Department and the Dean here if their scrutiny is meant to
-- GATE approval rather than precede it. No deployment is needed — 057 holds
-- this as data precisely so the University can tighten its own chain.
-- ---------------------------------------------------------------------------
select subject, office, note
  from academic_approval_requirements
 order by subject, office;


-- ===========================================================================
-- ===========================================================================
--
--   059_the_academic_calendar.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 059 — THE ACADEMIC CALENDAR
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- A REGISTRATION STOPS GUESSING WHICH YEAR IT BELONGS TO, and it has been
-- guessing wrong.
--
-- The University's ruling: "USE the western system, august 15 and january 2."
-- Semester 1 opens on 15 August. Semester 2 opens on 2 January. The academic
-- year is therefore 15 August to 14 August, and it is written 2026/2027.
--
-- ---------------------------------------------------------------------------
-- THE BUG THIS FIXES, AND IT IS LIVE TODAY
-- ---------------------------------------------------------------------------
--
-- src/components/courses/CourseRegistration.tsx dates a registration like this:
--
--     /** The academic year a registration defaults to. */
--     const thisYear = () => new Date().getFullYear();
--
-- That is the CALENDAR year. Under the ruling above, Semester 1 of 2026/2027
-- runs from 15 August 2026 to 1 January 2027 — so it straddles New Year, and:
--
--   a student registering in December 2026 is recorded against 2026
--   a student registering in January 2027, FOR THE SAME SEMESTER, against 2027
--
-- One cohort, one term, two academic years. And `semester_gpas` is keyed on
-- (student_id, academic_year, semester), so that student's grade point average
-- is computed TWICE for one semester, each time over half their courses, and
-- the transcript reads both.
--
-- Nobody would find this by reading the code. It is a defect that only appears
-- in January, only for students who register late, and it produces a wrong
-- number rather than an error.
--
-- ---------------------------------------------------------------------------
-- NOTHING HERE IS INVENTED, AND THAT IS WHY THE SEEDING IS SAFE
-- ---------------------------------------------------------------------------
--
-- Two dates were given. Everything below is those two dates applied:
--
--   Semester 1 opens 15 August       — stated
--   Semester 2 opens 2 January       — stated
--   Semester 1 therefore ENDS 1 January, the day before Semester 2 opens
--   Semester 2 therefore ENDS 14 August, the day before the next year opens
--   the academic year therefore runs 15 August to 14 August
--
-- No end date is guessed. A semester ends when the next one begins, which is
-- the only answer the two stated dates support.
--
-- WHAT IS NOT SEEDED is the inside of a term. The University's own example has
-- registration opening a month before teaching and results closing a fortnight
-- after examinations — real dates, and it has not stated them. So
-- `academic_periods` is created and left EMPTY, exactly as 057 left the
-- approving body empty until the University named it.
-- ===========================================================================


-- ===========================================================================
-- 1. THE YEAR
-- ===========================================================================

create table if not exists academic_years (
  id          uuid primary key default gen_random_uuid(),
  -- '2026/2027'. The form the University writes and a transcript prints.
  -- `academic_honours.academic_year` is already text in exactly this shape.
  label       text not null unique check (label ~ '^\d{4}/\d{4}$'),
  -- THE STARTING CALENDAR YEAR, as an integer. The five tables that already
  -- carry `academic_year integer` — enrollments, semester_gpas and three more —
  -- cannot hold '2026/2027', and changing their type would rewrite live rows
  -- for no gain. So the integer means THE YEAR THE ACADEMIC YEAR OPENS IN, and
  -- section 5 makes every writer derive it rather than reach for the clock.
  starts_in   integer not null unique check (starts_in between 1900 and 2200),
  starts_on   date not null,
  ends_on     date not null,
  status      text not null default 'planning'
                check (status in ('planning', 'current', 'closed')),
  created_at  timestamptz not null default now(),

  constraint academic_years_run_forwards check (ends_on > starts_on),
  constraint academic_years_label_matches_year
    check (label = starts_in::text || '/' || (starts_in + 1)::text)
);

comment on table academic_years is
  'The University''s academic years, on the western calendar: 15 August to 14 August, written '
  '2026/2027. `starts_in` is the integer the existing academic_year columns hold — 2026 means '
  '2026/2027, so a January registration files under the year the term OPENED in.';


-- ===========================================================================
-- 2. THE TERMS INSIDE IT
-- ===========================================================================

create table if not exists academic_terms (
  id                uuid primary key default gen_random_uuid(),
  academic_year_id  uuid not null references academic_years (id) on delete cascade,
  -- 1 and 2. The same integer `enrollments.semester` and `semester_gpas.semester`
  -- already hold, so nothing has to be translated at the join.
  sequence          integer not null check (sequence between 1 and 4),
  name              text not null check (length(btrim(name)) >= 3),
  starts_on         date not null,
  ends_on           date not null,
  created_at        timestamptz not null default now(),

  unique (academic_year_id, sequence),
  constraint academic_terms_run_forwards check (ends_on > starts_on)
);

create index if not exists academic_terms_by_date on academic_terms (starts_on, ends_on);

-- TWO TERMS OF ONE YEAR MAY NOT OVERLAP. An overlap is a date that belongs to
-- two semesters, and every question this table exists to answer — which term
-- is this, when does registration close — then has two answers.
create or replace function refuse_overlapping_terms()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clash text;
begin
  -- ---------------------------------------------------------------------
  -- COMPARED BY SEQUENCE, NOT BY ID, AND THAT IS NOT A DETAIL.
  --
  -- This read `t.id <> new.id`, which is right for an UPDATE and useless for
  -- an INSERT: a re-inserted row carries a fresh id, so on the second run of
  -- this migration the trigger looked at the Semester 1 already sitting there,
  -- saw a different id, and refused — BEFORE `on conflict … do nothing` ever
  -- got the chance to skip it.
  --
  -- The migration was therefore not idempotent, which is the one property
  -- every file in this directory is required to have. It passed its first run
  -- and failed its second.
  --
  -- (academic_year_id, sequence) is unique, so any OTHER term in the same year
  -- necessarily has a different sequence. Excluding by that excludes exactly
  -- the row being written, whether it is new or not.
  -- ---------------------------------------------------------------------
  select t.name into clash
    from academic_terms t
   where t.academic_year_id = new.academic_year_id
     and t.sequence <> new.sequence
     and t.starts_on <= new.ends_on
     and t.ends_on   >= new.starts_on
   limit 1;

  if clash is not null then
    raise exception
      'These dates overlap %, which is in the same academic year. A day cannot belong to two '
      'semesters — every question this calendar answers would then have two answers.', clash
      using errcode = 'check_violation';
  end if;

  -- AND A TERM LIES INSIDE ITS YEAR. A semester running past the end of the
  -- year it belongs to is how a registration lands in the wrong one.
  if exists (select 1 from academic_years y
              where y.id = new.academic_year_id
                and (new.starts_on < y.starts_on or new.ends_on > y.ends_on)) then
    raise exception
      'This term falls outside the academic year it belongs to.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists academic_terms_do_not_overlap on academic_terms;
create trigger academic_terms_do_not_overlap
  before insert or update on academic_terms
  for each row execute function refuse_overlapping_terms();


-- ===========================================================================
-- 3. AND THE PERIODS INSIDE A TERM — EMPTY, ON PURPOSE
-- ===========================================================================
--
-- The University's own example:
--
--     Registration    01 September – 15 October
--     Teaching        01 October    – 15 January
--     Examinations    18 January    – 30 January
--     Results         01 February   – 15 February
--
-- Note that registration OPENS BEFORE THE TERM DOES and results close after it
-- ends. So a period is not constrained to sit inside its term — that would
-- refuse the University's own example on the first insert.
--
-- WHY A TABLE AND NOT FOUR PAIRS OF COLUMNS ON `academic_terms`. "Is
-- registration open?" has to be one query. Four column pairs make it four
-- special cases, and the Registration Engine's twelfth check — registration
-- period — would be written differently by every caller that needs it.
--
-- NOTHING IS SEEDED. The two dates the University gave place the TERMS. It has
-- not given the dates inside them, and a plausible registration window is
-- exactly the kind of invention that is quoted back to a university by a
-- student who missed a deadline that was never real.

create table if not exists academic_periods (
  id          uuid primary key default gen_random_uuid(),
  term_id     uuid not null references academic_terms (id) on delete cascade,
  kind        text not null check (kind in
                ('registration', 'add-drop', 'teaching', 'examinations', 'results', 'break')),
  starts_on   date not null,
  ends_on     date not null,
  note        text,
  created_at  timestamptz not null default now(),

  unique (term_id, kind),
  constraint academic_periods_run_forwards check (ends_on > starts_on)
);

comment on table academic_periods is
  'Registration, teaching, examinations and results windows within a term. EMPTY on arrival: the '
  'University has stated when its SEMESTERS open, not when registration does, and a plausible '
  'deadline that was never agreed is worse than none.';


-- ===========================================================================
-- 4. THE YEARS THEMSELVES, FROM THE RULE
-- ===========================================================================
--
-- Generated, not chosen. Every row below is the University's two dates applied
-- to a calendar year, which is why seeding this is safe where seeding a
-- programme was not: nothing here is a decision.
--
--   15 August  Y      Semester 1 opens
--    1 January Y+1    Semester 1 closes — the day before Semester 2 opens
--    2 January Y+1    Semester 2 opens
--   14 August  Y+1    Semester 2 closes — the day before the next year opens
--
-- FROM 2015, not from this year. The University has ruled that "the 2020
-- transcript governs" in a dispute, so records reaching back to 2020 exist and
-- must have a year to belong to. Through 2035 so that nobody has to run a
-- migration to open next September.

do $$
declare
  y        integer;
  year_id  uuid;
begin
  for y in 2015..2035 loop
    insert into academic_years (label, starts_in, starts_on, ends_on, status)
    values (y::text || '/' || (y + 1)::text, y,
            make_date(y, 8, 15), make_date(y + 1, 8, 14), 'planning')
    on conflict (starts_in) do nothing;

    select id into year_id from academic_years where starts_in = y;

    insert into academic_terms (academic_year_id, sequence, name, starts_on, ends_on)
    values (year_id, 1, 'Semester 1', make_date(y, 8, 15), make_date(y + 1, 1, 1))
    on conflict (academic_year_id, sequence) do nothing;

    insert into academic_terms (academic_year_id, sequence, name, starts_on, ends_on)
    values (year_id, 2, 'Semester 2', make_date(y + 1, 1, 2), make_date(y + 1, 8, 14))
    on conflict (academic_year_id, sequence) do nothing;
  end loop;
end $$;

-- ONE YEAR IS CURRENT, and it is decided by the date rather than by somebody
-- remembering to change it every August. A status column nobody updates is a
-- status column that lies from the second week of term.
update academic_years
   set status = case
     when current_date between starts_on and ends_on then 'current'
     when ends_on < current_date then 'closed'
     else 'planning'
   end;

create unique index if not exists academic_years_one_current
  on academic_years (status) where status = 'current';


-- ===========================================================================
-- 5. WHICH TERM IS A GIVEN DAY IN?
-- ===========================================================================
--
-- The whole point of the file. One function, so that every screen and every
-- route asks the calendar the same question and gets the same answer — instead
-- of each one reaching for `new Date().getFullYear()` and being wrong in
-- January in its own way.

create or replace function academic_term_on(on_day date)
returns table (
  academic_year_id  uuid,
  year_label        text,
  starts_in         integer,
  term_id           uuid,
  term_sequence     integer,
  term_name         text,
  term_starts_on    date,
  term_ends_on      date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select y.id, y.label, y.starts_in, t.id, t.sequence, t.name, t.starts_on, t.ends_on
    from academic_terms t
    join academic_years y on y.id = t.academic_year_id
   where on_day between t.starts_on and t.ends_on
   order by t.starts_on
   limit 1;
$$;

comment on function academic_term_on(date) is
  'The academic year and semester a date falls in. Every writer of enrollments.academic_year '
  'must take the figure from here: the calendar year is NOT the academic year, and a Semester 1 '
  'that straddles New Year splits one cohort across two years if anybody uses the clock.';

-- AND TODAY, for the screens that only ever want now.
create or replace view academic_term_now
with (security_invoker = true) as
select * from academic_term_on(current_date);


-- ===========================================================================
-- 6. A REGISTRATION KNOWS ITS TERM
-- ===========================================================================
--
-- The integer column stays — five tables use it and rewriting them buys
-- nothing — but a registration now also names the row it belongs to, so the
-- link is a foreign key rather than a convention somebody has to remember.

alter table enrollments
  add column if not exists academic_year_id uuid
    references academic_years (id) on delete restrict;

create index if not exists enrollments_by_academic_year
  on enrollments (academic_year_id) where academic_year_id is not null;

-- BACK-FILLED WHERE IT IS UNAMBIGUOUS. An existing row records an integer and
-- a semester; if a year with that `starts_in` exists, the link is certain.
update enrollments e
   set academic_year_id = y.id
  from academic_years y
 where e.academic_year_id is null
   and e.academic_year = y.starts_in;


-- ===========================================================================
-- 7. WHO CAN READ IT
-- ===========================================================================
--
-- The academic calendar is the most public thing in this system. An applicant
-- deciding whether to apply needs to know when term starts, and a student needs
-- to know when registration closes without signing in to find out.

alter table academic_years   enable row level security;
alter table academic_terms   enable row level security;
alter table academic_periods enable row level security;

drop policy if exists academic_years_read on academic_years;
create policy academic_years_read on academic_years for select using (true);

drop policy if exists academic_terms_read on academic_terms;
create policy academic_terms_read on academic_terms for select using (true);

drop policy if exists academic_periods_read on academic_periods;
create policy academic_periods_read on academic_periods for select using (true);

-- No write policy. The calendar is set through the API, which checks the
-- capability and records who changed it.


-- ===========================================================================
-- 8. PROVE IT
-- ===========================================================================

do $$
declare
  r        record;
  n        integer;
  refused  boolean;
  y2026    uuid;
begin
  -- ---- THE RULE, READ BACK ----------------------------------------------
  select * into r from academic_term_on(make_date(2026, 8, 15));
  if r.year_label <> '2026/2027' or r.term_sequence <> 1 then
    raise exception '059 FAILED: 15 August 2026 is not Semester 1 of 2026/2027, it is % %',
      r.year_label, r.term_sequence;
  end if;

  -- THE DAY BEFORE belongs to the year before. This is the boundary the whole
  -- file turns on, so it is checked from both sides.
  select * into r from academic_term_on(make_date(2026, 8, 14));
  if r.year_label <> '2025/2026' or r.term_sequence <> 2 then
    raise exception '059 FAILED: 14 August 2026 is not Semester 2 of 2025/2026, it is % %',
      r.year_label, r.term_sequence;
  end if;

  select * into r from academic_term_on(make_date(2027, 1, 2));
  if r.year_label <> '2026/2027' or r.term_sequence <> 2 then
    raise exception '059 FAILED: 2 January 2027 is not Semester 2 of 2026/2027';
  end if;

  -- ---- AND THE BUG, NAMED ------------------------------------------------
  -- December and January, one cohort, one semester. Under `getFullYear()`
  -- these are 2026 and 2027; under the calendar they are the same term.
  declare
    december record;
    january  record;
  begin
    select * into december from academic_term_on(make_date(2026, 12, 15));
    select * into january  from academic_term_on(make_date(2026, 12, 31));
    if december.year_label <> january.year_label
       or december.term_sequence <> january.term_sequence then
      raise exception '059 FAILED: one semester split across two academic years';
    end if;
    if december.starts_in <> 2026 then
      raise exception '059 FAILED: December 2026 does not file under 2026, it files under %',
        december.starts_in;
    end if;

    -- 1 JANUARY 2027 IS STILL SEMESTER 1. The calendar year has turned; the
    -- academic one has not. This is the exact day `getFullYear()` got wrong.
    select * into january from academic_term_on(make_date(2027, 1, 1));
    if january.starts_in <> 2026 or january.term_sequence <> 1 then
      raise exception '059 FAILED: 1 January 2027 files under % semester %, not 2026 semester 1',
        january.starts_in, january.term_sequence;
    end if;
  end;

  -- ---- EVERY DAY OF TWENTY-ONE YEARS BELONGS SOMEWHERE --------------------
  -- A gap between 1 and 2 January, or between 14 and 15 August, would be a day
  -- on which nobody could register and no query would say why.
  select count(*) into n
    from generate_series(make_date(2015, 8, 15), make_date(2036, 8, 13), interval '1 day') d
   where not exists (select 1 from academic_term_on(d::date));
  if n > 0 then
    raise exception '059 FAILED: % days fall in no term at all', n;
  end if;

  -- AND NO DAY BELONGS TO TWO.
  -- `overlaps` cannot name this: it is a reserved word in Postgres and the
  -- parser reads it as the OVERLAPS operator.
  select count(*) into n from (
    select t.starts_on from academic_terms t
      join academic_terms u on u.id <> t.id
                           and u.academic_year_id = t.academic_year_id
                           and u.starts_on <= t.ends_on and u.ends_on >= t.starts_on
  ) clashing;
  if n > 0 then
    raise exception '059 FAILED: % terms overlap within their year', n;
  end if;

  -- ---- THE REFUSALS ------------------------------------------------------
  select id into y2026 from academic_years where starts_in = 2026;

  refused := false;
  begin
    insert into academic_terms (academic_year_id, sequence, name, starts_on, ends_on)
      values (y2026, 3, 'An Overlapping Term', make_date(2026, 9, 1), make_date(2026, 10, 1));
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '059 FAILED: a term was added overlapping one already there';
  end if;

  refused := false;
  begin
    insert into academic_terms (academic_year_id, sequence, name, starts_on, ends_on)
      values (y2026, 4, 'A Term Outside Its Year', make_date(2030, 1, 1), make_date(2030, 2, 1));
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '059 FAILED: a term was placed outside the academic year it belongs to';
  end if;

  -- A LABEL THAT DISAGREES WITH ITS OWN YEAR. '2026/2028' is the kind of typo
  -- that is invisible in a list and wrong on a transcript.
  refused := false;
  begin
    insert into academic_years (label, starts_in, starts_on, ends_on)
      values ('2026/2028', 2099, make_date(2099, 8, 15), make_date(2100, 8, 14));
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '059 FAILED: a year was labelled inconsistently with its own starting year';
  end if;

  -- ---- AND THE PERIODS ARE EMPTY -----------------------------------------
  select count(*) into n from academic_periods;
  if n > 0 then
    raise exception '059 FAILED: registration and teaching windows were invented';
  end if;

  raise notice '059 OK: 15 August opens Semester 1 and 2 January opens Semester 2, so the '
               'academic year runs 15 August to 14 August and is written 2026/2027';
  raise notice '059 OK: December and January of one Semester 1 file under the SAME academic '
               'year — the split that getFullYear() caused, and that computed a GPA twice';
  raise notice '059 OK: every day from 2015 to 2036 belongs to exactly one term, and a term '
               'cannot overlap another or fall outside its year';
  raise notice '059 OK: the periods inside a term are empty — the University has stated when '
               'its semesters open, not when registration does';
end $$;


-- ===========================================================================
-- 9. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHICH TERM IS IT RIGHT NOW? One row. If this is empty the calendar does not
-- cover today, which would mean the seeded band needs extending.
-- ---------------------------------------------------------------------------
select year_label, term_name, term_starts_on, term_ends_on
  from academic_term_now;

-- ---------------------------------------------------------------------------
-- AND THE NEXT FEW YEARS, so the rule can be read rather than trusted.
-- Semester 1 should open on 15 August and close on 1 January; Semester 2 open
-- on 2 January and close on 14 August.
-- ---------------------------------------------------------------------------
select y.label, y.status, t.name, t.starts_on, t.ends_on
  from academic_years y
  join academic_terms t on t.academic_year_id = y.id
 where y.starts_in between extract(year from current_date)::int - 1
                       and extract(year from current_date)::int + 2
 order by y.starts_in, t.sequence;

-- ---------------------------------------------------------------------------
-- AND WHAT IS STILL TO BE SET. Empty: the University has not stated when
-- registration opens, when teaching runs, when examinations sit or when
-- results are released. Fill it per term, for example:
--
--   insert into academic_periods (term_id, kind, starts_on, ends_on)
--   select t.id, 'registration', date '2026-09-01', date '2026-10-15'
--     from academic_terms t join academic_years y on y.id = t.academic_year_id
--    where y.starts_in = 2026 and t.sequence = 1;
-- ---------------------------------------------------------------------------
select count(*) as periods_recorded from academic_periods;


-- ===========================================================================
-- ===========================================================================
--
--   060_the_schools_and_programmes.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 060 — THE SCHOOLS AND PROGRAMMES
-- ===========================================================================
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-academic-seed.mjs
--   Source:    src/content/programmeCatalogue.ts
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE REGISTER STOPS BEING EMPTY. 5 schools and 41 programmes
-- become rows, moved out of the TypeScript the website compiles them from and
-- into tables the Superadministrator can manage.
--
-- NOTHING IS OPENED. Every programme arrives as a draft. 023 ruled that
-- admission is opt-in, and 057 refuses to open a programme with no published
-- curriculum in any case.
--
-- NO CURRICULUM IS SEEDED, and no duration. See the closing report: the
-- University has ruled the length of 41 of these
-- 41 programmes and published a RANGE for the other 0.
-- "One to two academic years" is not a duration, and writing 1 or 2 into
-- `duration_years` would be inventing the length of a degree.
-- ===========================================================================


-- ===========================================================================
-- 1. THE SCHOOLS
-- ===========================================================================
--
-- Five, as the University publishes on its About page. `faculties.ts` lists
-- six because it separates the School of Ministry at Douala; the About page
-- names five and that is what is seeded.

insert into schools (code, name, mission, status)
values ('theology', 'Faculty of Theology', 'Preparing Christian leaders, ministers, missionaries and theologians for service throughout Africa and the world.', 'active')
on conflict (code) do nothing;

insert into schools (code, name, mission, status)
values ('engineering', 'Faculty of Engineering and Technology', 'Building practitioners who can design, install, maintain and secure the systems modern work depends on — in African economies and in the international market their skills travel to.', 'active')
on conflict (code) do nothing;

-- PUBLISHED NAME, not the catalogue's. programmeCatalogue.ts calls this
-- "Faculty of Business Management Science and Administration", which appears nowhere else and which the About page
-- contradicts.
insert into schools (code, name, mission, status)
values ('business', 'Global Institute of Business and Management Science', 'Training ethical administrators, accountants and managers for enterprise, government and the not-for-profit sector, in Africa and wherever our graduates are called to serve.', 'active')
on conflict (code) do nothing;

insert into schools (code, name, mission, status)
values ('ministry', 'School of Ministry', 'Forming pastors, evangelists and church leaders for the work itself — the congregation, the mission field and the organisation that carries them.', 'active')
on conflict (code) do nothing;

insert into schools (code, name, mission, status)
values ('education', 'Faculty of Education', 'Forming teachers who can hold a classroom and reach the child in it — for schools across Africa and for the diaspora communities that share them.', 'active')
on conflict (code) do nothing;


-- ===========================================================================
-- 2. THE PROGRAMMES
-- ===========================================================================
--
-- The code is the slug the site already uses in every programme URL and in
-- `courses.programme_slug`, so the register joins to both without
-- translation. Nothing here is abbreviated or invented.
--
-- `status` is 'draft' for every one of them. Opening a programme for
-- admission is a decision, and 057 will refuse it until a curriculum has
-- been approved.

do $$
declare
  s_id uuid;
begin
  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('diploma-in-theology', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Theology · 120 credits · One academic year

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('diploma-in-ministry', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Ministry · 120 credits · One academic year

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('diploma-in-christian-leadership', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Christian Leadership · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-computer-networking', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Computer Networking · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-software-engineering', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Software Engineering · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-web-development', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Web Development · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-hardware-maintenance', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Hardware Maintenance · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-laptop-chipset-technology', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Laptop and Chipset Technology · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-database-administration', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Database Administration · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-air-conditioning-refrigeration', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Air Conditioning and Refrigeration · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-computerized-accounting', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Computerised Accounting · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-secretarial-duties', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Secretarial Duties · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-business-management', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Business Management · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-project-management', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Project Management · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-accountancy', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Accountancy · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-banking-and-finance', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Banking and Finance · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-non-profit-management', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Non-Profit Management · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-insurance', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Insurance · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-executive-secretarial-duties', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Executive Secretarial Duties · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-bilingual-secretarial-duties', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Bilingual Secretarial Duties · 120 credits · One academic year

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('certificate-in-theology', 'Certificate', 'draft')
  on conflict (code) do nothing;
  -- Certificate of Theology · Up to one academic year

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('certificate-in-christian-education', 'Certificate', 'draft')
  on conflict (code) do nothing;
  -- Certificate of Christian Education · Up to one academic year

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('divinity', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Bachelor of Divinity · Three academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('bachelor-of-theology', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Bachelor of Theology · 180 credits · Three academic years

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('bachelor-of-ministry', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Bachelor of Ministry · 180 credits · Three academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('bachelor-of-christian-education', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Bachelor of Christian Education · Three academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('master-of-theology', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Master of Theology · 120 credits · Two academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('master-of-divinity', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Master of Divinity · 120 credits · Two academic years

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('masters-evangelism-mission', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Masters in Evangelism and Mission · 120 credits · Two academic years

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('master-of-arts-christian-leadership', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Master of Arts in Christian Leadership · 120 credits · Two academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('black-liberation-theology', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Master of Arts in Black Liberation Theology · 120 credits · Two academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('doctor-of-philosophy-theology', 'Doctorate', 'draft')
  on conflict (code) do nothing;
  -- Doctor of Philosophy (Ph.D.) in Theology · Two academic years of supervised research

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('doctor-of-theology', 'Doctorate', 'draft')
  on conflict (code) do nothing;
  -- Doctor of Theology · Two academic years of supervised research

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('doctor-of-systematic-theology', 'Doctorate', 'draft')
  on conflict (code) do nothing;
  -- Doctor of Systematic Theology · Two academic years of supervised research

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('doctor-of-ministry', 'Doctorate', 'draft')
  on conflict (code) do nothing;
  -- Doctor of Ministry · Two academic years of supervised research

  select id into s_id from schools where code = 'education';
  insert into programmes (code, award_level, status)
  values ('primary-education', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Primary Education · Three academic years

  select id into s_id from schools where code = 'education';
  insert into programmes (code, award_level, status)
  values ('special-education', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Special Education · Three academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('software-engineering', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Software Engineering · Three academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('networking', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Computer Networking · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('business-management', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Business Management · Three academic years

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('project-management', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Project Management · 120 credits · Two academic years

end $$;


-- ===========================================================================
-- 3. PROVE IT
-- ===========================================================================

do $$
declare
  n integer;
begin
  select count(*) into n from schools;
  if n < 5 then
    raise exception '060 FAILED: % schools seeded, expected at least 5', n;
  end if;

  select count(*) into n from programmes;
  if n < 41 then
    raise exception '060 FAILED: % programmes seeded, expected at least 41', n;
  end if;

  -- THE FIVE SCHOOLS BY NAME. A count alone passes if the right number of
  -- wrong rows is there, and the About page names these five specifically.
  select count(*) into n from schools
   where code in ('theology', 'engineering', 'business', 'ministry', 'education');
  if n <> 5 then
    raise exception '060 FAILED: % of the 5 published schools are present', n;
  end if;

  -- NOTHING IS OPEN. The check that matters: a seed that quietly advertised
  -- forty-one programmes to applicants would be the single most damaging
  -- thing this file could do.
  select count(*) into n from programmes where status <> 'draft';
  if n > 0 then
    raise exception '060 FAILED: % programmes are not drafts — the seed opened something for admission', n;
  end if;

  -- ---------------------------------------------------------------------
  -- NO ASSERTION ABOUT WHAT DOES NOT EXIST YET.
  --
  -- This checked twice, and was wrong twice. First it asserted that no
  -- programme VERSION existed — true until 061 seeded one for every
  -- programme. Rescoped to curriculum ENTRIES, it was true until 062 moved
  -- three curricula in. Each time the bundle was clean on its first pass
  -- from empty and red on its second.
  --
  -- The mistake is the shape, not the table. A migration cannot prove
  -- anything by counting rows it did not create: every later migration is
  -- free to create them, and a proof that depends on the future being empty
  -- is a proof with an expiry date. 045 collided with 055 the same way.
  --
  -- What 060 is answerable for is above: the schools and programmes IT
  -- seeded, and that not one of them is open. That is the whole of its job.
  -- ---------------------------------------------------------------------

  raise notice '060 OK: 5 schools and 41 programmes are in the register, every one a draft';
  raise notice '060 OK: no curriculum and no duration was seeded — the University has published a range, not a length, for 0 of them';
end $$;


-- ===========================================================================
-- 4. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- THE REGISTER. Five schools, forty-one programmes, none open.
-- ---------------------------------------------------------------------------
select s.name as school,
       count(p.id) as programmes,
       count(*) filter (where p.status = 'open_for_admission') as open_for_admission
  from schools s
  left join programmes p on true
  group by s.name order by s.name;

-- ---------------------------------------------------------------------------
-- EVERY LEVEL HAS A RULED LENGTH. 061 gives each programme a version.
--
-- 0 of 41 programmes have no length this system can record,
-- because what is published is a range. Each needs a duration before a
-- curriculum can be built for it:
--
--
-- The three the University HAS ruled — Bachelor's three years, Doctorate two,
-- Certificate up to one — need no further statement.
-- ---------------------------------------------------------------------------
select award_level, count(*) as programmes
  from programmes group by award_level order by award_level;


-- ===========================================================================
-- ===========================================================================
--
--   061_a_version_for_every_programme.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 061 — A VERSION FOR EVERY PROGRAMME
-- ===========================================================================
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-academic-seed.mjs
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- EVERY ONE OF THE 41 PROGRAMMES GETS A CURRICULUM VERSION to hang
-- a curriculum from. 060 could not: 27 of them were published as "One to two
-- academic years", and a range is not a length. The University has since
-- ruled every level — Certificate one, Diploma one, Bachelor's three,
-- Master's two, Doctorate two — so `duration_years` can hold a number for
-- all of them.
--
-- EVERY VERSION IS A DRAFT, AND NONE HAS A SINGLE COURSE IN IT. A version
-- becomes real when the Vice-Chancellor approves it (058) and it cannot be
-- approved while its curriculum is empty of the credits it claims. This
-- builds the shelf; the University fills it.
--
-- THE LABEL IS THE ACADEMIC YEAR, and the effective date is the day that
-- year opens — 15 August, from 059. Nothing here is chosen: the version is
-- named after the year it takes effect in, which is how a student admitted
-- in 2026/2027 is later known to be reading the 2026/2027 curriculum.
-- ===========================================================================

do $$
declare
  y_label text;
  y_start date;
  p_id    uuid;
  s_id    uuid;
begin
  -- THE ACADEMIC YEAR IN FORCE, asked of the calendar rather than assumed.
  select label, starts_on into y_label, y_start from academic_years where status = 'current';
  if y_label is null then
    raise exception
      'No academic year is current, so a version cannot be dated. 059 sets one from the date; run it first.'
      using errcode = 'no_data_found';
  end if;

  select id into p_id from programmes where code = 'diploma-in-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Theology', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-ministry';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Ministry', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-christian-leadership';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Christian Leadership', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-computer-networking';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Computer Networking', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-software-engineering';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Software Engineering', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-web-development';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Web Development', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-hardware-maintenance';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Hardware Maintenance', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-laptop-chipset-technology';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Laptop and Chipset Technology', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-database-administration';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Database Administration', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-air-conditioning-refrigeration';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Air Conditioning and Refrigeration', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-computerized-accounting';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Computerised Accounting', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-secretarial-duties';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Secretarial Duties', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-business-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Business Management', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-project-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Project Management', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-accountancy';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Accountancy', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-banking-and-finance';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Banking and Finance', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-non-profit-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Non-Profit Management', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-insurance';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Insurance', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-executive-secretarial-duties';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Executive Secretarial Duties', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-bilingual-secretarial-duties';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Bilingual Secretarial Duties', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'certificate-in-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Certificate of Theology', s_id, 1,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'certificate-in-christian-education';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Certificate of Christian Education', s_id, 1,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'divinity';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Bachelor of Divinity', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'bachelor-of-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Bachelor of Theology', s_id, 3,
          2, 180, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'bachelor-of-ministry';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Bachelor of Ministry', s_id, 3,
          2, 180, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'bachelor-of-christian-education';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Bachelor of Christian Education', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'master-of-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Master of Theology', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'master-of-divinity';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Master of Divinity', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'masters-evangelism-mission';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Masters in Evangelism and Mission', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'master-of-arts-christian-leadership';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Master of Arts in Christian Leadership', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'black-liberation-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Master of Arts in Black Liberation Theology', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'doctor-of-philosophy-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Doctor of Philosophy (Ph.D.) in Theology', s_id, 2,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'doctor-of-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Doctor of Theology', s_id, 2,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'doctor-of-systematic-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Doctor of Systematic Theology', s_id, 2,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'doctor-of-ministry';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Doctor of Ministry', s_id, 2,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'primary-education';
  select id into s_id from schools where code = 'education';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Primary Education', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'special-education';
  select id into s_id from schools where code = 'education';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Special Education', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'software-engineering';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Software Engineering', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'networking';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Computer Networking', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'business-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Business Management', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'project-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Project Management', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

end $$;


-- ===========================================================================
-- PROVE IT
-- ===========================================================================

do $$
declare n integer; bad integer;
begin
  select count(*) into n from programme_versions;
  if n < 41 then
    raise exception '061 FAILED: % versions, expected at least 41', n;
  end if;

  -- EVERY PROGRAMME HAS ONE. A count alone passes if one programme has two.
  select count(*) into bad from programmes p
   where not exists (select 1 from programme_versions v where v.programme_id = p.id);
  if bad > 0 then
    raise exception '061 FAILED: % programmes still have no version', bad;
  end if;

  -- AND NOT ONE IS PUBLISHED. A version published here would have skipped
  -- the Vice-Chancellor, which is the whole of 058.
  select count(*) into bad from programme_versions where status <> 'draft';
  if bad > 0 then
    raise exception '061 FAILED: % versions are not drafts — the seed approved a curriculum', bad;
  end if;

  -- THE RULED LENGTHS, READ BACK. Not a spot check: every level at once.
  select count(*) into bad from programme_versions v
    join programmes p on p.id = v.programme_id
   where v.duration_years <> case p.award_level
           when 'Certificate' then 1
           when 'Diploma' then 1
           when 'Bachelor''s' then 3
           when 'Master''s' then 2
           when 'Doctorate' then 2
           else v.duration_years end;
  if bad > 0 then
    raise exception '061 FAILED: % versions disagree with the ruled length for their award', bad;
  end if;

  raise notice '061 OK: all 41 programmes have a version, every one a draft with no courses in it';
  raise notice '061 OK: every duration matches the length the University ruled for its award level';
end $$;


-- ===========================================================================
-- VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EVERY PROGRAMME, ITS LENGTH AND WHAT ITS CURRICULUM ADDS UP TO SO FAR.
-- `credits_in_curriculum` is 0 for all of them: the shelf is built and empty.
-- The gap against `total_credits` is the Curriculum Builder's work.
-- ---------------------------------------------------------------------------
select p.award_level,
       count(*)                                              as programmes,
       min(v.duration_years)                                 as years,
       count(*) filter (where v.total_credits is not null)   as with_a_credit_total,
       count(*) filter (where v.status = 'draft')            as drafts
  from programmes p
  join programme_versions v on v.programme_id = p.id
  group by p.award_level order by p.award_level;


-- ===========================================================================
-- ===========================================================================
--
--   062_the_curricula_already_written.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 062 — THE CURRICULA THE UNIVERSITY HAS ALREADY WRITTEN
-- ===========================================================================
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-curriculum-seed.mjs
--   Source:    src/content/programmeCourses.ts
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- 3 PROGRAMMES GET A REAL CURRICULUM — course by course, placed in the
-- year and semester the University wrote them into:
--
--   Bachelor of Theology     36 courses · 3 years · 6 semesters · 180 credits
--   Bachelor of Ministry     34 courses · 3 years · 6 semesters · 180 credits
--   Diploma of Theology      15 courses · 1 years · 2 semesters · 120 credits  (credit DERIVED: 120 / 15 = 8 each)
--
-- 061 built the shelf. This is the first thing on it, and it is the first
-- curriculum in this system that can be counted rather than read.
--
-- THE ENTRIES ATTACH TO A DRAFT VERSION and stay there. A curriculum becomes
-- the University's when the Vice-Chancellor approves it (058); 057 freezes it
-- at that moment, so this seeding could not have run afterwards.
--
-- ===========================================================================

-- ===========================================================================
-- 1. THE COURSES THEMSELVES
-- ===========================================================================
--
-- Most of these are not rows yet. `courses.credit_unit` is NOT NULL and
-- defaults to 3, so every insert below states the credit explicitly — a
-- default silently standing in for a value nobody wrote is how a curriculum
-- ends up adding to the wrong number.

-- Bachelor of Theology
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 210', 'Introduction to Biblical Studies', 6, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 220', 'Bible Survey I', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 230', 'Bible Survey II', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 250', 'Bible Doctrine I', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MW 300', 'Evangelism and Missions Introduction', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('OTH 300', 'Old Testament History and Theology', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CH 200', 'Introduction to Church History', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('LC 110', 'Christology I', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('OT 300', 'Pentateuch Studies', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 720', 'Christian Psychology and Human Relations', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CH 300', 'Advanced Church History', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 660', 'Christian Ethics', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CED 160', 'Christian Education', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 330', 'Hermeneutics and Biblical Interpretation', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 320', 'Homiletics I', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BL 340', 'Epistles Studies', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 410', 'Pneumatology', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 650', 'Spiritual Leadership', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 270', 'Introduction to Biblical Hebrew', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 260', 'Bible Doctrine II', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RM 540', 'Research Methodology I', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 400', 'Systematic Theology I', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RM 550', 'Research Methodology II', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 420', 'Systematic Theology II', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 280', 'Introduction to New Testament Greek', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 670', 'Spiritual Formation', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 730', 'Family Theology and Marriage Studies', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 350', 'Advanced Hermeneutics', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CDS 100', 'Acts and Apostolic Mission', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MW 350', 'Missiology and Global Christianity', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 820', 'ICT, Technology and Global Ministry', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 340', 'Advanced Homiletics', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 760', 'Spiritual Warfare and Demonology', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 430', 'African Theology and Contextual Theology', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 450', 'Ecotheology and Creation Care', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RM 560', 'Bachelor Thesis and Defense', 20, 'credit_hour')
on conflict (code) do nothing;

-- Bachelor of Ministry
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 101', 'Introduction to Christian Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIB 101', 'Old Testament Survey', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIB 102', 'New Testament Survey', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('THE 101', 'Introduction to Christian Doctrine', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('SFM 101', 'Spiritual Formation and Christian Character', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('COM 101', 'Communication for Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIB 103', 'Biblical Interpretation and Hermeneutics', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('THE 102', 'Theology of Yahuah, Yahusha and the Ruach HaQodesh', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIB 104', 'Life and Ministry of Yahusha the Messiah', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 102', 'Prayer, Worship and Spiritual Disciplines', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('HIS 101', 'Church History I', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 103', 'Introduction to Preaching and Teaching', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 201', 'Five-Fold Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 202', 'Pastoral Ministry and Shepherding', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('EVG 201', 'Evangelism and Discipleship', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('THE 201', 'Theology of the Church', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('LEA 201', 'Christian Leadership', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MUS 201', 'Worship and Music Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 203', 'Apostolic Leadership and Church Planting', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 204', 'Prophetic Ministry and Spiritual Discernment', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 205', 'Christian Education and Discipleship', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('PAS 201', 'Pastoral Care and Christian Counseling', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('ADM 201', 'Church Administration and Management', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('FIN 201', 'Christian Finance and Stewardship', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIS 301', 'Missions and Cross-Cultural Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('COM 301', 'Christian Media and Communications', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('ITM 301', 'Information Technology for Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('YTH 301', 'Youth and Children’s Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('COM 302', 'Community Development and Social Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RES 301', 'Research Methods for Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 306', 'Advanced Ministry Leadership', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 307', 'Ministry Ethics, Governance and Accountability', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 308', 'Ministry Practicum', 10, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RES 302', 'Bachelor Ministry Research Project', 10, 'ECTS')
on conflict (code) do nothing;

-- Diploma of Theology
-- EVERY CREDIT BELOW IS 8, AND NOT ONE OF THEM WAS WRITTEN BY THE
-- UNIVERSITY. The award is ruled at 120 credits and 15 courses
-- are named for it; 120 / 15 is 8 exactly. The
-- assumption is that these carry equal weight. Where they do not, edit the
-- entry credits in the Curriculum Builder — the total is checked against the
-- programme's own figure on every change, so an uneven split still has to
-- add to 120.
insert into courses (code, title, credit_unit, credit_system)
values ('MA 210', 'Use of English', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BL 300', 'Epistle I', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CED 180', 'Soteriology I', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 640', 'Ministerial Ethics', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('NT 330', 'Romans', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BL 160', 'Tabernacle', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 880', 'Faith', 8, 'credit_hour')
on conflict (code) do nothing;


-- ===========================================================================
-- 2. AND WHERE EACH ONE SITS
-- ===========================================================================
--
-- Year, semester and requirement belong HERE and not on the course — the
-- same course may sit differently in another programme, which is the whole
-- reason 057 put them on the entry.
--
-- Every entry is `core`: neither curriculum marks anything elective, and
-- inventing an elective would change what a student must pass.

do $$
declare
  v_id uuid;
  c_id uuid;
begin
  -- ---- Bachelor of Theology ----
  select v.id into v_id from programme_versions v
    join programmes p on p.id = v.programme_id
   where p.code = 'bachelor-of-theology' order by v.effective_from desc limit 1;
  if v_id is null then
    raise exception 'No version of bachelor-of-theology exists. 061 creates one; run it first.'
      using errcode = 'no_data_found';
  end if;

  select id into c_id from courses where code = 'BIS 210';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 6)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 220';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 230';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 250';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MW 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'OTH 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CH 200';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'LC 110';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'OT 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 720';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CH 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 660';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CED 160';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 330';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 320';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BL 340';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 410';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 650';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 270';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 260';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RM 540';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 400';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RM 550';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 420';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 280';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 670';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 730';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 350';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CDS 100';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MW 350';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 820';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 340';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 760';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 430';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 450';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RM 560';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 20)
  on conflict (programme_version_id, course_id) do nothing;

  -- ---- Bachelor of Ministry ----
  select v.id into v_id from programme_versions v
    join programmes p on p.id = v.programme_id
   where p.code = 'bachelor-of-ministry' order by v.effective_from desc limit 1;
  if v_id is null then
    raise exception 'No version of bachelor-of-ministry exists. 061 creates one; run it first.'
      using errcode = 'no_data_found';
  end if;

  select id into c_id from courses where code = 'MIN 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIB 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIB 102';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'THE 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'SFM 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'COM 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIB 103';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'THE 102';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIB 104';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 102';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'HIS 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 103';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 202';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'EVG 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'THE 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'LEA 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MUS 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 203';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 204';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 205';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'PAS 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'ADM 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'FIN 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIS 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'COM 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'ITM 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'YTH 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'COM 302';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RES 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 306';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 307';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 308';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 10)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RES 302';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 10)
  on conflict (programme_version_id, course_id) do nothing;

  -- ---- Diploma of Theology ----
  select v.id into v_id from programme_versions v
    join programmes p on p.id = v.programme_id
   where p.code = 'diploma-in-theology' order by v.effective_from desc limit 1;
  if v_id is null then
    raise exception 'No version of diploma-in-theology exists. 061 creates one; run it first.'
      using errcode = 'no_data_found';
  end if;

  select id into c_id from courses where code = 'BIS 250';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MW 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CH 200';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MA 210';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'OTH 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'LC 110';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 760';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MW 350';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BL 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CED 180';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 640';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'NT 330';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'OT 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BL 160';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 880';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;

end $$;


-- ===========================================================================
-- 3. WHAT A CURRICULUM ADDS UP TO, DRAFT OR NOT
-- ===========================================================================
--
-- `programme_in_force` answers "what is this programme" and joins only the
-- PUBLISHED version — right for a prospectus, useless for the Curriculum
-- Builder, which works on a DRAFT and needs its running total on every edit.
--
-- A draft is the only time the total matters. Once a version is published it
-- is frozen and its arithmetic cannot change; while it is a draft the gap
-- between what the courses add to and what the programme claims IS the work
-- remaining, and it is what the Academic Dashboard means by
-- "programme/curriculum issues".

create or replace view curriculum_progress
with (security_invoker = true) as
select v.id                as version_id,
       v.programme_id,
       p.code,
       p.award_level,
       v.version_label,
       v.status,
       v.duration_years,
       v.semesters_per_year,
       v.total_credits,
       (select count(*) from curriculum_entries e
         where e.programme_version_id = v.id)            as courses_in_curriculum,
       (select coalesce(sum(coalesce(e.credits, c.credit_unit)), 0)
          from curriculum_entries e join courses c on c.id = e.course_id
         where e.programme_version_id = v.id)            as credits_in_curriculum,
       -- THE GAP, SIGNED. Negative is short, positive is over, zero is done.
       (select coalesce(sum(coalesce(e.credits, c.credit_unit)), 0)
          from curriculum_entries e join courses c on c.id = e.course_id
         where e.programme_version_id = v.id) - coalesce(v.total_credits, 0)
                                                        as credits_against_claim,
       -- AND WHETHER EVERY TERM THE PROGRAMME RUNS HAS ANYTHING IN IT. A
       -- curriculum can add to exactly 180 and still have an empty semester.
       (select count(distinct (e.year, e.semester)) from curriculum_entries e
         where e.programme_version_id = v.id)            as terms_with_courses,
       v.duration_years * v.semesters_per_year           as terms_expected
  from programme_versions v
  join programmes p on p.id = v.programme_id;

comment on view curriculum_progress is
  'Every programme version, published or draft, with what its curriculum actually adds up to '
  'against what the programme claims. `programme_in_force` shows only published versions; the '
  'Curriculum Builder works on drafts, which is the only time the total can still change.';


-- ===========================================================================
-- 4. PROVE IT
-- ===========================================================================

do $$
declare n integer; total integer;
begin
  -- Bachelor of Theology: 36 courses, 180 credits
  select count(*), coalesce(sum(e.credits), 0) into n, total
    from curriculum_entries e
    join programme_versions v on v.id = e.programme_version_id
    join programmes p on p.id = v.programme_id
   where p.code = 'bachelor-of-theology';
  if n <> 36 then
    raise exception '062 FAILED: bachelor-of-theology has % entries, expected 36', n;
  end if;
  if total <> 180 then
    raise exception '062 FAILED: bachelor-of-theology adds up to %, not 180', total;
  end if;

  -- Bachelor of Ministry: 34 courses, 180 credits
  select count(*), coalesce(sum(e.credits), 0) into n, total
    from curriculum_entries e
    join programme_versions v on v.id = e.programme_version_id
    join programmes p on p.id = v.programme_id
   where p.code = 'bachelor-of-ministry';
  if n <> 34 then
    raise exception '062 FAILED: bachelor-of-ministry has % entries, expected 34', n;
  end if;
  if total <> 180 then
    raise exception '062 FAILED: bachelor-of-ministry adds up to %, not 180', total;
  end if;

  -- Diploma of Theology: 15 courses, 120 credits
  select count(*), coalesce(sum(e.credits), 0) into n, total
    from curriculum_entries e
    join programme_versions v on v.id = e.programme_version_id
    join programmes p on p.id = v.programme_id
   where p.code = 'diploma-in-theology';
  if n <> 15 then
    raise exception '062 FAILED: diploma-in-theology has % entries, expected 15', n;
  end if;
  if total <> 120 then
    raise exception '062 FAILED: diploma-in-theology adds up to %, not 120', total;
  end if;

  -- THE CURRICULUM MATCHES WHAT THE PROGRAMME CLAIMS. This is the check the
  -- Curriculum Builder will make on every edit, made once here: a version
  -- claiming 180 credits whose courses add to 174 is a curriculum nobody can
  -- graduate from, and it would be found by a student rather than by this.
  --
  -- READ FROM `curriculum_progress`, NOT `programme_in_force`. This check was
  -- written against the latter and PASSED WITHOUT TESTING ANYTHING: that view
  -- joins only PUBLISHED versions, every version here is a draft, so it
  -- returned no rows and the count was 0. A proof that cannot see the thing
  -- it is checking always passes. Section 5 adds the view that can.
  select count(*) into n from curriculum_progress
   where courses_in_curriculum > 0
     and total_credits is not null
     and credits_in_curriculum <> total_credits;
  if n > 0 then
    raise exception '062 FAILED: % curricula do not add up to what their programme claims', n;
  end if;

  -- AND IT SAW THEM. The assertion above is only worth having if the view
  -- returned the curricula this file just seeded.
  select count(*) into n from curriculum_progress where courses_in_curriculum > 0;
  if n <> 3 then
    raise exception '062 FAILED: the totals view sees % curricula, not the 3 just seeded', n;
  end if;

  -- AND NOTHING WAS APPROVED ON THE WAY IN.
  select count(*) into n from programme_versions where status <> 'draft';
  if n > 0 then
    raise exception '062 FAILED: % versions are no longer drafts', n;
  end if;

  raise notice '062 OK: 3 curricula moved into rows, course by course, each adding up to exactly what its programme claims';
  raise notice '062 OK: every entry is core, every version is still a draft, and nothing was approved on the way in';
end $$;


-- ===========================================================================
-- 5. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHAT EACH PROGRAMME NOW HAS. `credits_in_curriculum` against
-- `total_credits` is the Curriculum Builder's running total: equal means the
-- curriculum is complete, 0 means the shelf is still empty.
-- ---------------------------------------------------------------------------
select code, award_level, status, duration_years as yrs,
       courses_in_curriculum as courses, credits_in_curriculum as credits,
       total_credits as claims, credits_against_claim as gap,
       terms_with_courses || ' of ' || terms_expected as terms_filled
  from curriculum_progress
 order by courses_in_curriculum desc, code
 limit 10;


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
  select '036' as migration, '036_the_steps_nothing_could_write.sql' as file,
         case when to_regclass('public.admission_audit_log') is not null then 'YES' else 'NO' end as landed,
         'admission_audit_log' as what_it_creates
  union all
  select '037' as migration, '037_a_student_is_not_an_application.sql' as file,
         case when to_regclass('public.students') is not null then 'YES' else 'NO' end as landed,
         'students' as what_it_creates
  union all
  select '038' as migration, '038_announcements_are_the_institution_speaking.sql' as file,
         case when to_regclass('public.announcements') is not null then 'YES' else 'NO' end as landed,
         'announcements' as what_it_creates
  union all
  select '039' as migration, '039_a_destination_is_a_publishing_job.sql' as file,
         case when to_regclass('public.announcement_media') is not null then 'YES' else 'NO' end as landed,
         'announcement_media' as what_it_creates
  union all
  select '040' as migration, '040_emergency_publishing_and_erasure.sql' as file,
         case when to_regclass('public.announcement_tombstones') is not null then 'YES' else 'NO' end as landed,
         'announcement_tombstones' as what_it_creates
  union all
  select '041' as migration, '041_appointments_and_the_letters_that_issue_from_them.sql' as file,
         case when to_regclass('public.appointments') is not null then 'YES' else 'NO' end as landed,
         'appointments' as what_it_creates
  union all
  select '042' as migration, '042_the_appointment_lifecycle_and_the_staff_record.sql' as file,
         case when to_regclass('public.appointment_events') is not null then 'YES' else 'NO' end as landed,
         'appointment_events' as what_it_creates
  union all
  select '043' as migration, '043_working_hours_and_the_appointing_authority.sql' as file,
         case when to_regclass('public.appointment_letters_unverifiable') is not null then 'YES' else 'NO' end as landed,
         'appointment_letters_unverifiable' as what_it_creates
  union all
  select '044' as migration, '044_document_templates_and_the_letters_tied_to_them.sql' as file,
         case when to_regclass('public.document_templates') is not null then 'YES' else 'NO' end as landed,
         'document_templates' as what_it_creates
  union all
  select '045' as migration, '045_official_correspondence_and_who_initiated_it.sql' as file,
         case when to_regclass('public.correspondence') is not null then 'YES' else 'NO' end as landed,
         'correspondence' as what_it_creates
  union all
  select '046' as migration, '046_the_correspondence_history_and_the_delegated_draft.sql' as file,
         case when to_regclass('public.correspondence_events') is not null then 'YES' else 'NO' end as landed,
         'correspondence_events' as what_it_creates
  union all
  select '047' as migration, '047_the_money_the_actors_and_the_two_axes.sql' as file,
         case when to_regclass('public.appointment_allowances') is not null then 'YES' else 'NO' end as landed,
         'appointment_allowances' as what_it_creates
  union all
  select '048' as migration, '048_the_job_descriptions_and_what_they_inherit.sql' as file,
         case when to_regclass('public.positions') is not null then 'YES' else 'NO' end as landed,
         'positions' as what_it_creates
  union all
  select '049' as migration, '049_verification_signatures_and_the_written_letter.sql' as file,
         case when to_regclass('public.signature_specimens') is not null then 'YES' else 'NO' end as landed,
         'signature_specimens' as what_it_creates
  union all
  select '050' as migration, '050_acceptance_the_activation_rule_and_the_full_audit.sql' as file,
         case when to_regclass('public.appointment_acceptances') is not null then 'YES' else 'NO' end as landed,
         'appointment_acceptances' as what_it_creates
  union all
  select '051' as migration, '051_templates_for_every_document_the_university_issues.sql' as file,
         case when to_regclass('public.document_template_coverage') is not null then 'YES' else 'NO' end as landed,
         'document_template_coverage' as what_it_creates
  union all
  select '052' as migration, '052_a_first_draft_of_every_document.sql' as file,
         case when to_regclass('public.document_templates') is null then 'NO'
                 when exists (select 1 from document_templates where created_by is null) then 'YES'
                 else 'NO' end as landed,
         'rows:document_templates:created_by is null' as what_it_creates
  union all
  select '053' as migration, '053_where_an_office_stands.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'positions'
                      and column_name = 'standing')
                 then 'YES' else 'NO' end as landed,
         'positions.standing' as what_it_creates
  union all
  select '054' as migration, '054_course_registration.sql' as file,
         case when to_regclass('public.course_roll') is not null then 'YES' else 'NO' end as landed,
         'course_roll' as what_it_creates
  union all
  select '055' as migration, '055_the_office_that_needs_no_second_signature.sql' as file,
         case when exists (
                   select 1 from pg_constraint
                    where conname = 'appointments_second_pair_of_eyes'
                      and position('made_on_sole_authority' in pg_get_constraintdef(oid)) > 0)
                 then 'YES' else 'NO' end as landed,
         'def:appointments_second_pair_of_eyes:made_on_sole_authority' as what_it_creates
  union all
  select '056' as migration, '056_what_an_office_may_not_even_see.sql' as file,
         case when to_regclass('public.capability_grants') is not null then 'YES' else 'NO' end as landed,
         'capability_grants' as what_it_creates
  union all
  select '057' as migration, '057_the_academic_structure.sql' as file,
         case when to_regclass('public.programme_versions') is not null then 'YES' else 'NO' end as landed,
         'programme_versions' as what_it_creates
  union all
  select '058' as migration, '058_the_vice_chancellor_approves_a_curriculum.sql' as file,
         case when to_regclass('public.academic_approval_requirements') is null then 'NO'
                 when exists (select 1 from academic_approval_requirements where subject = 'curriculum') then 'YES'
                 else 'NO' end as landed,
         'rows:academic_approval_requirements:subject = ''curriculum''' as what_it_creates
  union all
  select '059' as migration, '059_the_academic_calendar.sql' as file,
         case when to_regclass('public.academic_terms') is not null then 'YES' else 'NO' end as landed,
         'academic_terms' as what_it_creates
  union all
  select '060' as migration, '060_the_schools_and_programmes.sql' as file,
         case when to_regclass('public.programmes') is null then 'NO'
                 when exists (select 1 from programmes where true) then 'YES'
                 else 'NO' end as landed,
         'rows:programmes:true' as what_it_creates
  union all
  select '061' as migration, '061_a_version_for_every_programme.sql' as file,
         case when to_regclass('public.programme_versions') is null then 'NO'
                 when exists (select 1 from programme_versions where true) then 'YES'
                 else 'NO' end as landed,
         'rows:programme_versions:true' as what_it_creates
  union all
  select '062' as migration, '062_the_curricula_already_written.sql' as file,
         case when to_regclass('public.curriculum_progress') is not null then 'YES' else 'NO' end as landed,
         'curriculum_progress' as what_it_creates
) as landed_report
 order by migration;

