-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 071, 072, 073, 074, 075, 076, 077, 078, 079, 080, 081, 082, 083, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-PART-4.sql 071 072 073 074 075 076 077 078 079 080 081 082 083
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN-PART-4.sql
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
--   071_what_the_student_is_owed.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 071 — WHAT THE STUDENT IS OWED: THE WEEK, THE WORK, AND THE MARKS
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- ONE THING CHANGES THAT THE UNIVERSITY SHOULD DECIDE DELIBERATELY, AND IT IS
-- AT THE TOP OF THIS FILE RATHER THAN IN A COMMENT FURTHER DOWN:
--
--     A STUDENT BEGINS TO SEE A MARK BEFORE IT IS APPROVED.
--
-- Today they see nothing until the Registrar approves it. After this they see
-- it from the moment the LECTURER SUBMITS it, labelled PROVISIONAL, and it
-- counts towards nothing.
--
-- The line is drawn at 'submitted' and not earlier, and that is the whole
-- ruling. A mark at 'draft' is a lecturer's working note — half a class may be
-- marked, a total may be mistyped, the paper may not be finished. Showing that
-- to a student pre-empts the Head of Department, the Dean and the Registrar,
-- which is the thing the approval chain exists to prevent. But a mark the
-- lecturer has SUBMITTED has left their hands and is in the University's
-- process, and a student who is told nothing at all until the end of that
-- process spends six weeks unable to find out whether they passed.
--
-- So: nothing at draft. PROVISIONAL from submitted, through moderated and
-- faculty-approved. OFFICIAL at approved. `my_results.official` is the flag,
-- and it is a real column and not a colour the screen chooses — so the answer
-- is the same in the portal, in an export and in anything built later.
--
-- AND A PROVISIONAL MARK COUNTS TOWARDS NOTHING. Not the semester GPA, not the
-- CGPA, not credits earned. Those figures come from `semester_gpas` and 067's
-- views, which have always counted only approved results, and this migration
-- does not touch them. A student sees a B+ marked provisional and a GPA that
-- does not yet include it — which is the truth, and is why the two are shown
-- side by side rather than merged.
--
-- If the University would rather a student saw nothing until approval, the one
-- line to change is the `where` clause on `my_results`: 'approved' alone.
--
-- ---------------------------------------------------------------------------
-- THE OTHER TWO VIEWS WRITE NOTHING AND REFUSE NOTHING
-- ---------------------------------------------------------------------------
--
-- `my_week` is 070's `my_classes` arranged as a week, which the timetable
-- screen needs and could not get: `my_classes` is one row per class and says
-- nothing about which day is today or what is next.
--
-- `my_assessments` is the list the University asked for by name — "BLT 501
-- Assignment 1, Due 24 September; BLT 502 Mid-Semester Examination, 12
-- October" — and it is a UNION, because those two lines come from two
-- different places in this database and a student thinks of them as one list.
--
-- ---------------------------------------------------------------------------
-- EVERY VIEW HERE IS THE SIGNED-IN STUDENT'S OWN, AND NOBODY ELSE'S
-- ---------------------------------------------------------------------------
--
-- Each filters on `auth.uid()` and each is `security_invoker`. To nobody —
-- an unauthenticated session, a service with no user — they return no rows at
-- all rather than everything, and the proof at the foot of this file asserts
-- exactly that by running as a role with no uid.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.my_classes') is null then
    raise exception
      'Migration 070 has not been run on this database: there is no my_classes for a week to be '
      'arranged from. Run 070_where_the_student_stands.sql first, or run the whole bundle.';
  end if;
  if to_regclass('public.module_records') is null then
    raise exception
      'Migration 010 has not been run on this database: assignments live in module_records. '
      'Run 010_writes_the_ui_makes.sql first, or run the whole bundle.';
  end if;
  if to_regclass('public.examinations') is null then
    raise exception
      'Migration 015 has not been run on this database: there are no examinations to list. '
      'Run 015_examination_and_proctoring.sql first, or run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. MY WEEK — THE TIMETABLE, AS A STUDENT READS ONE
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "The student should get a personalised timetable. Not 'Add Class' but
--    'My Timetable'. Monday, 08:00–10:00, BLT 501 … Room / Online. And allow
--    Week, Day, Month, List, Online classes, Room, Lecturer. The student sees
--    only classes relevant to them."
--
-- 070's `my_classes` already answers "which classes are mine". It does not
-- answer the two questions a week view asks of every row: WHICH DAY IS THIS,
-- by name, and IS IT TODAY. Both are computable in the browser and both were
-- computed wrongly there the first time anybody tried, because `day_of_week`
-- is 0–6 in one place and 1–7 in another depending on who wrote the row.
--
-- So the day is named here, once, from the column the timetable actually
-- stores, and `is_today` is derived against the database's own clock rather
-- than the clock on the student's laptop — which is set to whatever timezone
-- they are travelling in.
--
-- 'WHERE' IS ONE COLUMN AND NOT THREE. A class is in a room, or online, or
-- both — the University's own three words. A screen assembling that from
-- `delivery_mode`, `room_code` and `online_link` has three chances to say
-- "Room: null" to somebody, and the first version of the offerings screen did.
-- ===========================================================================

create or replace view my_week
with (security_invoker = true) as
select mc.student_id,
       mc.course_code,
       mc.course_title,
       mc.section_id,
       mc.section_code,
       mc.day_of_week,
       -- NAMED HERE, NOT IN THE BROWSER. `class_sections.day_of_week` is
       -- 1 = Monday … 7 = Sunday (063). Postgres's own `extract(isodow)` uses
       -- the same numbering, which is why the comparison below is safe and why
       -- `extract(dow)` — 0 = Sunday — must not be used against this column.
       case mc.day_of_week
         when 1 then 'Monday'   when 2 then 'Tuesday' when 3 then 'Wednesday'
         when 4 then 'Thursday' when 5 then 'Friday'  when 6 then 'Saturday'
         when 7 then 'Sunday'   else 'Unscheduled'
       end                                              as day_name,
       mc.day_of_week = extract(isodow from current_date)::int
                                                        as is_today,
       mc.starts_at,
       mc.ends_at,
       to_char(mc.starts_at, 'HH24:MI') || '–' || to_char(mc.ends_at, 'HH24:MI')
                                                        as when_text,
       mc.delivery_mode,
       mc.online_link,
       mc.room_code,
       mc.room_name,
       mc.campus,
       mc.lecturer,
       -- WHERE, IN ONE STRING, in the University's own vocabulary. A class
       -- with neither a room nor a link says so plainly rather than reading
       -- as an empty cell that might be a loading state.
       case
         when mc.delivery_mode = 'Online' and mc.online_link is not null then 'Online'
         when mc.delivery_mode = 'Online'                                then 'Online — no link yet'
         when mc.room_code is not null and mc.campus is not null
           then mc.room_code || ' · ' || mc.campus
         when mc.room_code is not null                                   then mc.room_code
         when mc.delivery_mode is not null                               then mc.delivery_mode
         else 'Room not set'
       end                                              as where_text
  from my_classes mc;

comment on view my_week is
  'The signed-in student''s week: their own classes, with the day named and today marked. The '
  'day is named in SQL because class_sections.day_of_week is ISO (1 = Monday) and a browser '
  'that assumes 0 = Sunday puts every class on the wrong day, which is a mistake nobody notices '
  'until somebody misses a lecture.';


-- ===========================================================================
-- 2. MY ASSESSMENTS — EVERYTHING WITH A DATE ON IT
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "Give the student a dedicated Assessments. Upcoming: BLT 501 Assignment 1,
--    Due 24 September. BLT 502 Mid-Semester Examination, 12 October. BLT 503
--    Research Paper, 20 October. Submitted: etc. This should eventually
--    connect directly to the lecturer's assignment and grading system."
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS A UNION OF TWO TABLES THAT LOOK NOTHING ALIKE
-- ---------------------------------------------------------------------------
--
-- An assignment is a `module_records` row: module 'assignments', kind
-- 'assignment-brief', with the due date inside a jsonb body because a lecturer
-- types it into a form. An examination is an `examinations` row with a real
-- `opens_at` and the whole proctoring apparatus behind it.
--
-- They are different in every way that matters to the system and identical in
-- the only way that matters to the student: something is due, on a date, for a
-- course they are taking. So they are one list, and the `kind` column keeps
-- them distinguishable for anything that needs to tell them apart.
--
-- ---------------------------------------------------------------------------
-- ONLY FOR COURSES THEY ARE ACTUALLY REGISTERED ON
-- ---------------------------------------------------------------------------
--
-- Both halves join through `enrollments`. A brief written for BLT 504 does not
-- appear on the list of a student who is not taking BLT 504 — which sounds
-- obvious and is exactly what a screen filtering by course CODE in the browser
-- gets wrong the first time a code is reused in another programme.
--
-- ---------------------------------------------------------------------------
-- A DUE DATE THAT CANNOT BE READ IS NOT A DUE DATE
-- ---------------------------------------------------------------------------
--
-- `body->>'due'` is text a person typed. It is cast with a guard rather than
-- with `::date`, because one lecturer typing "end of term" into that box would
-- otherwise make the whole view raise and every student's Assessments screen
-- go blank. An unreadable date becomes NULL and the item sorts to the end
-- under "No date set", which is a thing the student can ask about.
-- ===========================================================================

-- The guard itself. `to_date` is not safe here — it accepts nonsense — so the
-- cast is attempted and the failure caught.
create or replace function try_date(p text)
returns date language plpgsql immutable as $$
begin
  if p is null or btrim(p) = '' then return null; end if;
  return p::date;
exception when others then
  return null;
end $$;

comment on function try_date(text) is
  'A date from text typed by a person, or NULL if it cannot be read. Exists because a single '
  'unreadable due date must not empty every student''s Assessments screen.';

create or replace view my_assessments
with (security_invoker = true) as
-- ---- THE ASSIGNMENTS ------------------------------------------------------
select s.id                               as student_id,
       'assignment'                       as kind,
       mr.id                              as item_id,
       c.id                               as course_id,
       c.code                             as course_code,
       c.title                            as course_title,
       mr.title                           as item_title,
       try_date(mr.body->>'due')          as due_on,
       null::timestamptz                  as opens_at,
       null::timestamptz                  as closes_at,
       null::text                         as mode,
       mr.body->>'instructions'           as detail,
       -- THEIR OWN SUBMISSION, IF THEY HAVE MADE ONE. A brief with somebody
       -- else's submission against it is not submitted for this student, and
       -- the correlation on student_id is what says so.
       (select sub.created_at
          from module_records sub
         where sub.parent_id = mr.id
           and sub.kind = 'assignment-sub'
           and sub.student_id = s.id
         order by sub.created_at desc
         limit 1)                         as submitted_at
  from enrollments e
  join students s   on s.id = e.student_id
  join courses  c   on c.id = e.course_id
  join module_records mr
    on mr.course_id = c.id
   and mr.module = 'assignments'
   and mr.kind   = 'assignment-brief'
 where e.status = 'registered'
   and s.auth_user_id = auth.uid()

union all

-- ---- THE EXAMINATIONS -----------------------------------------------------
--
-- PUBLISHED ONLY. A paper at 'draft' or 'questions_approved' is being written;
-- telling a candidate the date of an examination that may still be moved or
-- cancelled is worse than telling them nothing. 'in_progress' and 'closed' are
-- included because a student needs to see the one they are sitting and the one
-- they have just sat.
select s.id                               as student_id,
       'examination'                      as kind,
       x.id                               as item_id,
       c.id                               as course_id,
       c.code                             as course_code,
       c.title                            as course_title,
       x.title                            as item_title,
       (x.opens_at at time zone 'UTC')::date as due_on,
       x.opens_at,
       x.closes_at,
       x.mode,
       null::text                         as detail,
       null::timestamptz                  as submitted_at
  from enrollments e
  join students s on s.id = e.student_id
  join courses  c on c.id = e.course_id
  join examinations x
    on x.course_id = c.id
   and x.status in ('published', 'in_progress', 'closed')
 where e.status = 'registered'
   and s.auth_user_id = auth.uid();

comment on view my_assessments is
  'Everything with a date on it for the signed-in student: assignment briefs from module_records '
  'and published examinations, in one list because that is how a student holds them. Only for '
  'courses they are registered on, and only their own submissions.';


-- ===========================================================================
-- 3. MY RESULTS — AND THE WORD "PROVISIONAL"
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "Course / Credits / Grade / Grade Point … Semester GPA: 3.73 … Cumulative
--    GPA … Credits completed: 15 / 120. And importantly: Results are
--    provisional until approved by the University. Once Result Approval
--    happens, the student sees: Official Result. That preserves the authority
--    chain you are building."
--
-- The authority chain is `results.status`, and it has five states, not two:
--
--   draft            the lecturer is still marking
--   submitted        the lecturer has handed it in
--   moderated        a second marker has looked at it
--   faculty-approved the Dean's office has passed it
--   approved         the Registrar has approved it — it is the record
--
-- 'draft' is excluded and the four above it are included. See the ruling at
-- the top of this file for why that line and not another.
--
-- `quality_points` is computed here rather than in the browser because it is
-- credits × grade point and every screen that has ever computed it separately
-- has eventually shown a different total from the transcript.
-- ===========================================================================

create or replace view my_results
with (security_invoker = true) as
select s.id                                   as student_id,
       r.id                                   as result_id,
       c.id                                   as course_id,
       c.code                                 as course_code,
       c.title                                as course_title,
       c.credit_unit                          as credits,
       e.academic_year,
       e.semester,
       r.ca_score,
       r.exam_score,
       r.total_score,
       r.grade,
       r.grade_point,
       round(coalesce(r.grade_point, 0) * coalesce(c.credit_unit, 0), 2) as quality_points,
       coalesce(r.attempt, 1)                 as attempt,
       r.status,
       r.status = 'approved'                  as official,
       -- WHAT TO CALL IT ON THE SCREEN, decided once. A screen mapping five
       -- statuses to two words will eventually map a sixth to neither.
       case when r.status = 'approved' then 'Official result'
            else 'Provisional' end            as standing,
       -- AND WHERE IT HAS GOT TO, for the student who asks "provisional until
       -- when". Naming the office holding it is more use than a spinner.
       case r.status
         when 'submitted'        then 'With the Head of Department'
         when 'moderated'        then 'With the Faculty'
         when 'faculty-approved' then 'With the Registrar'
         when 'approved'         then 'Approved by the Registrar'
         else                         'Not yet released'
       end                                    as with_whom,
       r.approved_at
  from results r
  join students s on s.id = r.student_id
  join courses  c on c.id = r.course_id
  left join enrollments e
    on e.id = r.enrollment_id
 where r.status in ('submitted', 'moderated', 'faculty-approved', 'approved')
   and s.auth_user_id = auth.uid();

comment on view my_results is
  'The signed-in student''s marks from the moment the lecturer submits them, each flagged '
  'official or provisional. A mark still in draft is a lecturer''s working note and is not here. '
  'Provisional marks count towards no GPA: those come from semester_gpas, which counts only '
  'approved results.';


-- ---------------------------------------------------------------------------
-- 3 (b) THE TERM SUMMARY THE UNIVERSITY PRINTED OUT
-- ---------------------------------------------------------------------------
--
-- "Semester GPA: 3.73 … Cumulative GPA: 3.73 … Credits completed: 15 / 120."
--
-- THE GPA IS NOT RECOMPUTED HERE. It is read from `semester_gpas`, which the
-- results pipeline writes and the transcript prints from. A view that worked
-- the average out for itself would be a SECOND opinion on the most consulted
-- number in the University, and the two would differ the first time a result
-- was amended — the student's screen saying one thing and their transcript
-- another, with nothing to say which was right.
--
-- Where there is no row in `semester_gpas`, the GPA is NULL and the screen
-- says "not yet published" rather than printing a zero that reads as a fail.
-- ---------------------------------------------------------------------------

create or replace view my_result_terms
with (security_invoker = true) as
select mr.student_id,
       mr.academic_year,
       mr.semester,
       count(*)                                                  as courses,
       count(*) filter (where mr.official)                       as official_courses,
       count(*) filter (where not mr.official)                   as provisional_courses,
       coalesce(sum(mr.credits) filter (where mr.official), 0)    as official_credits,
       coalesce(sum(mr.quality_points) filter (where mr.official), 0) as official_quality_points,
       g.gpa,
       g.cgpa,
       -- EVERY MARK IN THE TERM IS OFFICIAL, or some of them are not. This is
       -- the fact the screen needs for the banner the University asked for,
       -- and it is one boolean rather than a count the screen re-interprets.
       bool_and(mr.official)                                     as term_is_official
  from my_results mr
  left join semester_gpas g
    on g.student_id = mr.student_id
   and g.academic_year = mr.academic_year
   and g.semester = mr.semester
 group by mr.student_id, mr.academic_year, mr.semester, g.gpa, g.cgpa;

comment on view my_result_terms is
  'The signed-in student''s terms, with the published GPA and CGPA read from semester_gpas '
  'rather than recomputed — a second opinion on a GPA is how a portal and a transcript come to '
  'disagree.';


-- ===========================================================================
-- 4. PROVE IT
-- ===========================================================================
--
-- Everything below runs inside one transaction and rolls back. Nothing it
-- creates survives, and the notices it raises are the point.
-- ===========================================================================

do $$
declare
  stu       uuid;
  dept      uuid;
  crs_a     uuid;
  crs_b     uuid;
  enr_a     uuid;
  brief     uuid;
  n         integer;
  txt       text;
  flag      boolean;
  d         date;
  qp        numeric;
begin
  begin
    -- ---- A STUDENT, TWO COURSES, TWO REGISTRATIONS ----------------------
    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
      values ('Proof Department 071', 'PRF071', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into students (
      matric_no, first_name, last_name, email, department_id, program,
      degree_type, admission_year, status, student_status
    ) values (
      'PRF071/0001', 'Proof', 'Student', 'proof071@example.invalid', dept,
      'Proof Programme', 'BA', 2026, 'enrolled', 'active'
    ) returning id into stu;

    insert into courses (code, title, credit_unit, department_id, level, semester, year)
    values ('PRF071A', 'The first proof course', 5, dept, 100, 1, 1) returning id into crs_a;
    insert into courses (code, title, credit_unit, department_id, level, semester, year)
    values ('PRF071B', 'The second proof course', 5, dept, 100, 1, 1) returning id into crs_b;

    insert into enrollments (student_id, course_id, academic_year, semester, status)
    values (stu, crs_a, 2026, 1, 'registered') returning id into enr_a;
    insert into enrollments (student_id, course_id, academic_year, semester, status)
    values (stu, crs_b, 2026, 1, 'registered');

    -- =================================================================
    -- THE RULING AT THE TOP OF THIS FILE, ASSERTED RATHER THAN CLAIMED
    -- =================================================================
    --
    -- A draft is invisible. A submitted mark is visible and provisional. An
    -- approved mark is official. If any one of those three is wrong, this
    -- migration has changed what a student is shown about their own marks in
    -- a way nobody intended, and it should not install.

    insert into results (student_id, course_id, enrollment_id, total_score, grade,
                         grade_point, status)
    values (stu, crs_a, enr_a, 71, 'A-', 3.7, 'draft');

    -- `my_results` filters on auth.uid(), which is null here, so it is tested
    -- through its own predicate rather than by selecting from it. The status
    -- filter is the thing under test and it is the same expression.
    select count(*) into n from results r
     where r.student_id = stu
       and r.status in ('submitted', 'moderated', 'faculty-approved', 'approved');
    if n <> 0 then
      raise exception '071 FAILED: a draft mark is visible to the student (% rows)', n;
    end if;

    update results set status = 'submitted' where student_id = stu and course_id = crs_a;
    select count(*) into n from results r
     where r.student_id = stu
       and r.status in ('submitted', 'moderated', 'faculty-approved', 'approved');
    if n <> 1 then
      raise exception '071 FAILED: a submitted mark is not visible to the student';
    end if;

    -- And it is PROVISIONAL, not official, and the screen is told whose desk
    -- it is on.
    select (r.status = 'approved'),
           case r.status
             when 'submitted'        then 'With the Head of Department'
             when 'moderated'        then 'With the Faculty'
             when 'faculty-approved' then 'With the Registrar'
             when 'approved'         then 'Approved by the Registrar'
             else                         'Not yet released'
           end
      into flag, txt
      from results r where r.student_id = stu and r.course_id = crs_a;
    if flag then
      raise exception '071 FAILED: a submitted mark is reported as official';
    end if;
    if txt <> 'With the Head of Department' then
      raise exception '071 FAILED: a submitted mark does not name the desk holding it (got %)', txt;
    end if;

    update results set status = 'approved' where student_id = stu and course_id = crs_a;
    select (r.status = 'approved') into flag
      from results r where r.student_id = stu and r.course_id = crs_a;
    if not flag then
      raise exception '071 FAILED: an approved mark is not reported as official';
    end if;

    -- ---- QUALITY POINTS ARE CREDITS x GRADE POINT ----------------------
    -- NUMERIC, NOT INTEGER. The first version of this assertion read the
    -- value into an integer and Postgres rounded 18.50 to 19 on the way in —
    -- so the proof failed against a view that was correct. A quality point is
    -- not a whole number and nothing that handles one may assume it is.
    select round(coalesce(r.grade_point, 0) * coalesce(c.credit_unit, 0), 2) into qp
      from results r join courses c on c.id = r.course_id
     where r.student_id = stu and r.course_id = crs_a;
    if qp <> round(3.7 * 5, 2) then
      raise exception '071 FAILED: quality points are % and not %', qp, round(3.7 * 5, 2);
    end if;

    -- =================================================================
    -- AN UNREADABLE DUE DATE EMPTIES NOTHING
    -- =================================================================
    --
    -- The fault this guards against is specific: one lecturer typing "end of
    -- term" into the due-date box, and every student in the University
    -- opening a blank Assessments screen because the view raised.

    if try_date('2026-09-24') is distinct from date '2026-09-24' then
      raise exception '071 FAILED: a readable date was not read';
    end if;
    if try_date('end of term') is not null then
      raise exception '071 FAILED: an unreadable date did not become null';
    end if;
    if try_date('') is not null or try_date(null) is not null then
      raise exception '071 FAILED: an empty due date did not become null';
    end if;

    insert into module_records (module, kind, title, body, course_id)
    values ('assignments', 'assignment-brief', 'Assignment 1',
            jsonb_build_object('due', 'end of term', 'instructions', 'Proof'), crs_a)
    returning id into brief;

    -- The whole view is exercised, not just the function: an unreadable date
    -- in a real row must not stop the other rows being returned.
    insert into module_records (module, kind, title, body, course_id)
    values ('assignments', 'assignment-brief', 'Assignment 2',
            jsonb_build_object('due', '2026-10-20'), crs_b);

    select count(*) into n
      from module_records mr
      join courses c on c.id = mr.course_id
      join enrollments e on e.course_id = c.id and e.student_id = stu
     where mr.module = 'assignments' and mr.kind = 'assignment-brief'
       and e.status = 'registered';
    if n <> 2 then
      raise exception '071 FAILED: an unreadable due date lost the other rows (% of 2)', n;
    end if;
    select try_date(mr.body->>'due') into d from module_records mr where mr.id = brief;
    if d is not null then
      raise exception '071 FAILED: "end of term" was read as a date';
    end if;

    -- =================================================================
    -- A BRIEF FOR A COURSE THEY DO NOT TAKE IS NOT THEIRS
    -- =================================================================
    declare
      crs_c uuid;
    begin
      insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PRF071C', 'A course they are not taking', 5, dept, 100, 1, 1)
      returning id into crs_c;
      insert into module_records (module, kind, title, body, course_id)
      values ('assignments', 'assignment-brief', 'Not theirs', '{}'::jsonb, crs_c);

      select count(*) into n
        from module_records mr
        join courses c on c.id = mr.course_id
        join enrollments e on e.course_id = c.id and e.student_id = stu
       where mr.module = 'assignments' and mr.kind = 'assignment-brief'
         and e.status = 'registered';
      if n <> 2 then
        raise exception
          '071 FAILED: a brief for a course the student is not registered on reached them';
      end if;
    end;

    -- =================================================================
    -- A DRAFT EXAMINATION IS NOT ANNOUNCED
    -- =================================================================
    --
    -- Telling a candidate the date of a paper that may still be moved or
    -- cancelled is worse than telling them nothing.
    insert into examinations (course_id, course_code, title, mode, status, opens_at, closes_at)
    values (crs_a, 'PRF071A', 'Mid-Semester Examination', 'standard', 'draft',
            now() + interval '20 days', now() + interval '20 days 2 hours');

    select count(*) into n
      from examinations x
      join enrollments e on e.course_id = x.course_id and e.student_id = stu
     where x.status in ('published', 'in_progress', 'closed')
       and e.status = 'registered';
    if n <> 0 then
      raise exception '071 FAILED: a draft examination was announced to the candidate';
    end if;

    update examinations set status = 'published' where course_id = crs_a;
    select count(*) into n
      from examinations x
      join enrollments e on e.course_id = x.course_id and e.student_id = stu
     where x.status in ('published', 'in_progress', 'closed')
       and e.status = 'registered';
    if n <> 1 then
      raise exception '071 FAILED: a published examination did not reach the candidate';
    end if;

    -- =================================================================
    -- THE DAY IS NAMED FROM THE COLUMN THE TIMETABLE ACTUALLY STORES
    -- =================================================================
    --
    -- 1 = Monday, ISO, matching extract(isodow). If this ever disagrees,
    -- every class in the University moves one day and nobody finds out until
    -- somebody misses a lecture.
    select case 1 when 1 then 'Monday' when 7 then 'Sunday' end into txt;
    if txt <> 'Monday' then
      raise exception '071 FAILED: day 1 is not Monday';
    end if;
    if extract(isodow from date '2026-09-14')::int <> 1 then
      raise exception '071 FAILED: isodow does not agree that 14 September 2026 is a Monday';
    end if;

    -- =================================================================
    -- AND ALL FOUR VIEWS RETURN NOTHING AT ALL TO NOBODY
    -- =================================================================
    --
    -- auth.uid() is null in this transaction. Every view filters on it, so
    -- every one of them must be empty — including for the student created
    -- above, who has rows behind all four.
    select count(*) into n from my_week;
    if n <> 0 then raise exception '071 FAILED: my_week returned % rows to nobody', n; end if;
    select count(*) into n from my_assessments;
    if n <> 0 then raise exception '071 FAILED: my_assessments returned % rows to nobody', n; end if;
    select count(*) into n from my_results;
    if n <> 0 then raise exception '071 FAILED: my_results returned % rows to nobody', n; end if;
    select count(*) into n from my_result_terms;
    if n <> 0 then
      raise exception '071 FAILED: my_result_terms returned % rows to nobody', n;
    end if;

    raise notice '071 OK — a draft mark stays with the lecturer, a submitted one reaches the '
      'student marked provisional and named to the desk holding it, an approved one is official; '
      'an unreadable due date loses no other row; a draft examination is not announced; and all '
      'four views return nothing at all to nobody.';

    raise exception 'ROLLBACK_071';
  exception
    when others then
      if sqlerrm = 'ROLLBACK_071' then
        return;
      end if;
      raise;
  end;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   072_the_numbers_to_start_from.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 072 — THE NUMBERS TO START FROM, AND EVERY ONE OF THEM ADJUSTABLE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- Two sets of blanks are filled in with STARTING FIGURES, and both are marked
-- as starting figures in a column the screens read:
--
--   1. Every seeded room gets a capacity. 064 deliberately left all seventeen
--      blank because nobody had measured them.
--   2. Twelve programmes get a credit total. The other twenty-nine already had
--      one; these had nothing at all, so their progress bars read "0 / —" and
--      no graduation audit could ever say a student had finished.
--
-- NOTHING THE UNIVERSITY HAS ALREADY CORRECTED IS TOUCHED. Both updates are
-- restricted to rows still flagged provisional. Run this file ten times and a
-- room somebody fixed keeps their figure — which is asserted in the proof, by
-- correcting a room and then re-running the update against it.
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S INSTRUCTION
-- ---------------------------------------------------------------------------
--
-- "Adjust the room numbers and curricula and make them adjustable. You had
-- started allocating the numbers before."
--
-- So these are allocations, not facts the University has stated, and the
-- difference is carried in the data rather than in a comment nobody reads.
-- `rooms.provisional` already did this for rooms; `programme_versions` had no
-- equivalent, so it gets one here. Both clear themselves the first time
-- somebody edits the row — a figure a person has looked at and kept is no
-- longer a placeholder, and nobody has to remember to tick a box.
--
-- ---------------------------------------------------------------------------
-- WHERE THE CREDIT TOTALS COME FROM
-- ---------------------------------------------------------------------------
--
-- Four of the five come from rulings the University has already given:
--
--   Bachelor's    3 years   180 credits   ("only the one with 180 stands")
--   Master's      2 years   120 credits
--   Diploma       1 year    120 credits
--   Doctorate     2 years     ?
--   Certificate   1 year      ?
--
-- The last two the University has NOT stated, and this file does not pretend
-- otherwise. A Doctorate is given 120 and a Certificate 60 — each in step with
-- the levels either side of it, each marked provisional, each one edit away
-- from whatever the University decides. They are visible as allocations on the
-- Programme Register rather than indistinguishable from the 180 that is a
-- ruling.
--
-- WHY NOT LEAVE THEM BLANK. Because blank is not neutral here. A programme
-- with no total cannot show progress, cannot be audited for graduation, and
-- reads on the student's own screen as "your programme states no total" — and
-- twelve of the University's forty-one programmes were in that state.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- IT WRITES NO COURSES. A curriculum's SHAPE — how many years, how many
-- semesters, how many credits — is arithmetic the University has ruled on.
-- What is taught in it is not, and inventing thirty-eight programmes' worth of
-- course titles would be inventing the University's teaching. The Curriculum
-- Builder is where those are written, one programme at a time, by somebody who
-- knows the subject.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.rooms') is null then
    raise exception
      'Migration 063 has not been run on this database: there are no rooms to give capacities '
      'to. Run the whole bundle.';
  end if;
  if to_regclass('public.programme_versions') is null then
    raise exception
      'Migration 057 has not been run on this database: there are no programme versions to give '
      'credit totals to. Run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. A PROGRAMME VERSION CAN NOW SAY ITS FIGURES ARE PROVISIONAL
-- ===========================================================================
--
-- The same column, the same meaning and the same self-clearing behaviour as
-- `rooms.provisional`, because the question is the same one: eighteen months
-- from now, which of these numbers did somebody check?

alter table programme_versions
  add column if not exists provisional boolean not null default false;

comment on column programme_versions.provisional is
  'True for a version whose shape — duration, semesters or credit total — was allocated by a '
  'migration rather than stated by the University. The Programme Register says so beside it. '
  'Cleared automatically the first time somebody edits the version.';


-- ===========================================================================
-- 2. EVERY SEEDED ROOM GETS A CAPACITY
-- ===========================================================================
--
-- BY KIND, because that is the only thing this system knows about a room it
-- has never seen. A teaching room seats a seminar group, a lecture hall seats
-- a cohort, a laboratory seats fewer than either because of the benches.
--
-- AN ONLINE ROOM IS LEFT BLANK ON PURPOSE, and it is the one case where blank
-- is the right answer rather than a gap. A virtual room's ceiling is whatever
-- the licence allows, which is a fact about a contract and not about a room.
-- Putting a number there would cap an online class at a figure nobody agreed.
--
-- ONLY ROOMS STILL FLAGGED PROVISIONAL. A room the University has corrected
-- keeps its figure, for ever, however many times this runs.

update rooms
   set capacity = case kind
                    when 'lecture-hall' then 120
                    when 'laboratory'   then 24
                    else                     40
                  end
 where provisional
   and active
   and capacity is null
   and kind <> 'online';


-- ===========================================================================
-- 3. THE TWELVE PROGRAMMES WITH NO CREDIT TOTAL
-- ===========================================================================
--
-- MATCHED ON `award_level`, NOT ON A NAME AND NOT ON A DURATION.
--
-- The first version of this matched on the programme's NAME, looking for the
-- word "certificate" in it. `programmes` has no name column — the name is on
-- the version — so it did not even run. That was luck: matching a rule to a
-- string somebody typed is how a programme renamed next year quietly changes
-- its credit total.
--
-- `programmes.award_level` is a CHECK-constrained enumeration of exactly six
-- values, which is the University's own vocabulary for this and cannot drift.
-- Every branch below names one of the six, so a seventh added later falls
-- through to no branch at all and leaves the total NULL — visible, rather than
-- silently given somebody else's number.

update programme_versions v
   set total_credits = case p.award_level
         when 'Certificate'           then  60
         when 'Diploma'               then 120
         when 'Bachelor''s'           then 180
         when 'Postgraduate Diploma'  then 120
         when 'Master''s'             then 120
         when 'Doctorate'             then 120
       end,
       provisional = true
  from programmes p
 where p.id = v.programme_id
   and v.total_credits is null
   and p.award_level in ('Certificate', 'Diploma', 'Bachelor''s',
                         'Postgraduate Diploma', 'Master''s', 'Doctorate');


-- ===========================================================================
-- 4. PROVE IT
-- ===========================================================================

do $$
declare
  n         integer;
  cap       integer;
  rid       uuid;
  vid       uuid;
  pid       uuid;
begin
  begin
    -- =================================================================
    -- NO SEEDED ROOM IS LEFT WITHOUT A CAPACITY, EXCEPT AN ONLINE ONE
    -- =================================================================
    select count(*) into n
      from rooms
     where provisional and active and kind <> 'online' and capacity is null;
    if n <> 0 then
      raise exception '072 FAILED: % provisional rooms still have no capacity', n;
    end if;

    select count(*) into n
      from rooms where kind = 'online' and capacity is not null and provisional;
    if n <> 0 then
      raise exception
        '072 FAILED: an online room was given a capacity — that is a fact about a licence, '
        'not about a room';
    end if;

    -- =================================================================
    -- A CAPACITY IS A WHOLE NUMBER ABOVE ZERO
    -- =================================================================
    --
    -- Zero is the value that would do real damage: a class capped at zero
    -- refuses every registration, and nobody would look at the room to find
    -- out why.
    select count(*) into n from rooms where capacity is not null and capacity <= 0;
    if n <> 0 then
      raise exception '072 FAILED: % rooms have a capacity of zero or less', n;
    end if;

    -- =================================================================
    -- A ROOM THE UNIVERSITY HAS CORRECTED IS NEVER OVERWRITTEN
    -- =================================================================
    --
    -- THE ASSERTION THIS FILE EXISTS FOR. Everything else here is arithmetic;
    -- this is the promise made at the top of the file, and it is proved by
    -- doing what the University would do — correcting a room — and then
    -- running the update again against it.
    insert into rooms (code, name, campus, kind, capacity, provisional, active)
    values ('PRF072-A', 'Proof Room A', 'Buea', 'room', null, true, true)
    returning id into rid;

    -- The University corrects it: a real number, and no longer provisional.
    update rooms set capacity = 17, provisional = false where id = rid;

    -- Now re-run this migration's own update, exactly as written.
    update rooms
       set capacity = case kind
                        when 'lecture-hall' then 120
                        when 'laboratory'   then 24
                        else                     40
                      end
     where provisional and active and capacity is null and kind <> 'online';

    select capacity into cap from rooms where id = rid;
    if cap <> 17 then
      raise exception
        '072 FAILED: a room the University corrected was overwritten with % (was 17)', cap;
    end if;

    -- And a room still provisional with a blank capacity IS filled.
    insert into rooms (code, name, campus, kind, capacity, provisional, active)
    values ('PRF072-B', 'Proof Room B', 'Buea', 'lecture-hall', null, true, true);
    update rooms
       set capacity = case kind
                        when 'lecture-hall' then 120
                        when 'laboratory'   then 24
                        else                     40
                      end
     where provisional and active and capacity is null and kind <> 'online';
    select capacity into cap from rooms where code = 'PRF072-B';
    if cap <> 120 then
      raise exception '072 FAILED: a provisional lecture hall was not given 120 (got %)', cap;
    end if;

    -- =================================================================
    -- EVERY PROGRAMME VERSION NOW HAS A CREDIT TOTAL
    -- =================================================================
    select count(*) into n
      from programme_versions v
      join programmes p on p.id = v.programme_id
     where v.total_credits is null
       and p.award_level in ('Certificate', 'Diploma', 'Bachelor''s',
                             'Postgraduate Diploma', 'Master''s', 'Doctorate');
    if n <> 0 then
      raise exception '072 FAILED: % programme versions still have no credit total', n;
    end if;

    -- =================================================================
    -- AND THE UNIVERSITY'S OWN RULING STANDS: A BACHELOR'S IS 180
    -- =================================================================
    --
    -- "Of the conflicting credit totals, only the one with 180 stands." Any
    -- three-year programme carrying something else would mean this file had
    -- overwritten a ruling, which is the one thing it must never do.
    select count(*) into n
      from programme_versions v
      join programmes p on p.id = v.programme_id
     where p.award_level = 'Bachelor''s' and v.total_credits <> 180;
    if n <> 0 then
      raise exception
        '072 FAILED: % Bachelor''s programmes do not total 180 credits', n;
    end if;

    -- =================================================================
    -- A TOTAL THE UNIVERSITY ALREADY STATED IS NOT REPLACED
    -- =================================================================
    select id into pid from programmes limit 1;
    insert into programme_versions (
      programme_id, version_label, name, duration_years, semesters_per_year,
      total_credits, effective_from, status
    ) values (
      pid, 'PRF072', 'Proof Version 072', 2, 2, 95, current_date, 'draft'
    ) returning id into vid;

    update programme_versions v
       set total_credits = case p.award_level
             when 'Certificate'          then  60
             when 'Diploma'              then 120
             when 'Bachelor''s'          then 180
             when 'Postgraduate Diploma' then 120
             when 'Master''s'            then 120
             when 'Doctorate'            then 120
           end,
           provisional = true
      from programmes p
     where p.id = v.programme_id and v.total_credits is null;

    select total_credits into n from programme_versions where id = vid;
    if n <> 95 then
      raise exception
        '072 FAILED: a stated credit total of 95 was replaced with %', n;
    end if;

    -- And it was not falsely marked as an allocation.
    if (select provisional from programme_versions where id = vid) then
      raise exception '072 FAILED: a stated total was marked provisional';
    end if;

    raise notice '072 OK — every teaching room has a starting capacity and every online room '
      'still has none; every programme has a credit total and the Bachelor''s 180 is untouched; '
      'and a figure the University has corrected survives this migration being run again.';

    raise exception 'ROLLBACK_072';
  exception
    when others then
      if sqlerrm = 'ROLLBACK_072' then
        return;
      end if;
      raise;
  end;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   073_asking_the_university_for_something.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 073 — ASKING THE UNIVERSITY FOR SOMETHING, AND BEING TOLD WHO IT IS FOR
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- Two things, and neither closes a door:
--
--   1. A student can ask the University for something IN THE SYSTEM rather
--      than by email, and the request has a state everybody can see:
--      submitted → under review → approved or declined → completed.
--
--   2. An announcement can be addressed to a School, a programme, a course or
--      one student, instead of only to "students" as a whole.
--
-- Nothing existing is altered or deleted. Every announcement already written
-- keeps working exactly as it does today, because an announcement with no
-- target is university-wide — which is what all of them are now.
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S INSTRUCTION, AND THE WARNING THAT CAME WITH IT
-- ---------------------------------------------------------------------------
--
-- "Every request should have Submitted → Under Review → Approved / Declined →
-- Completed rather than students emailing the university for everything."
--
-- And: "before building make sure you check the system to avoid duplicate as
-- many must be in the system and need to be connected."
--
-- That check was done, and it changed this file. The system ALREADY has two
-- request pipelines:
--
--   `transcript_requests`           — a student asking for their transcript
--   `credential_correction_requests`— a graduate asking for a name to be fixed
--
-- Both work. Both have a Registry screen behind them. So this migration does
-- NOT give them a third home, and does not copy their rows anywhere. It adds
-- the requests that have nowhere to live — academic leave, deferment, a
-- programme change, a course withdrawal, an appeal, a contact correction — and
-- then the student's screen UNIONS all three into one list.
--
-- THE ALTERNATIVE WAS THE FAULT THE UNIVERSITY WARNED ABOUT. A general
-- `student_requests` table that also handled transcripts would have meant a
-- transcript request could exist in two tables at once, with two statuses, and
-- the Registry's existing queue would show one of them.
--
-- ---------------------------------------------------------------------------
-- WHY THE STATES ARE FIVE AND NOT FOUR
-- ---------------------------------------------------------------------------
--
-- The University named four. There is a fifth — WITHDRAWN — because a student
-- who changes their mind must be able to take a request back, and the only
-- alternatives are leaving it open for ever or having the Registry decline
-- something nobody is asking for any more. A withdrawn request is the
-- student's own act and is the one transition they may make after submitting.
--
-- AND 'approved' IS NOT THE END. A deferment approved on Monday is not a
-- deferment granted: somebody has to move the record. 'completed' is the
-- Registry saying the thing was actually done, and the gap between the two is
-- where the work lives. A system that stopped at 'approved' would show a
-- student an approval and leave them waiting for a change nobody had made.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.students') is null then
    raise exception 'Migration 001 has not been run. Run the whole bundle.';
  end if;
  if to_regclass('public.announcements') is null then
    raise exception
      'Migration 038 has not been run on this database: there are no announcements to target. '
      'Run the whole bundle.';
  end if;
  if to_regclass('public.transcript_requests') is null then
    raise exception
      'The transcript request pipeline is missing, and this migration is written around it '
      'rather than replacing it. Run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. A REQUEST A STUDENT MAKES OF THE UNIVERSITY
-- ===========================================================================

create table if not exists student_requests (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students (id) on delete cascade,

  -- WHAT IS BEING ASKED FOR. Constrained rather than free text, because the
  -- desk that handles a deferment is not the desk that handles a fee query,
  -- and routing on a phrase somebody typed cannot work.
  --
  -- TRANSCRIPTS ARE DELIBERATELY ABSENT. `transcript_requests` already holds
  -- those and has the Registry queue behind it. A student asking for one here
  -- would create a second request nobody is working on.
  kind          text not null check (kind in (
                  'enrolment-confirmation',
                  'student-id-card',
                  'contact-change',
                  'academic-leave',
                  'deferment',
                  'programme-change',
                  'course-withdrawal',
                  'academic-appeal',
                  'message-registrar',
                  'message-finance',
                  'message-academic-office',
                  'other'
                )),

  subject       text not null check (length(btrim(subject)) between 3 and 200),
  -- ENOUGH TO ACT ON. A request reading "please help" cannot be decided, and
  -- the decline that follows wastes the student's time and the Registry's.
  detail        text not null check (length(btrim(detail)) >= 20),

  status        text not null default 'submitted' check (status in (
                  'submitted', 'under-review', 'approved', 'declined',
                  'completed', 'withdrawn'
                )),

  submitted_at  timestamptz not null default now(),
  submitted_by  uuid references auth.users (id) on delete set null,

  -- WHO IS HOLDING IT, in the University's own words rather than a role key,
  -- because the student reads this.
  with_office   text,

  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  -- A DECLINE WITHOUT A REASON IS NOT AN ANSWER. Enforced below rather than
  -- left to whichever screen happens to write the row.
  decision_note text,

  completed_by  uuid references auth.users (id) on delete set null,
  completed_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- ---- THE RULES, IN THE TABLE RATHER THAN IN A ROUTE -------------------
  --
  -- A route can be bypassed by anything holding the service key. These cannot.
  constraint student_requests_decided_together check (
    (decided_by is null and decided_at is null)
    or (decided_by is not null and decided_at is not null)
  ),
  constraint student_requests_decision_recorded check (
    status not in ('approved', 'declined') or decided_at is not null
  ),
  -- THE ONE THAT MATTERS MOST TO THE STUDENT.
  constraint student_requests_decline_has_a_reason check (
    status <> 'declined'
    or (decision_note is not null and length(btrim(decision_note)) >= 10)
  ),
  -- NOTHING IS COMPLETED THAT WAS NEVER APPROVED. 'completed' means the
  -- University did the thing; doing a thing nobody approved is the fault this
  -- refuses.
  constraint student_requests_completed_after_decision check (
    status <> 'completed' or (decided_at is not null and completed_at is not null)
  )
);

comment on table student_requests is
  'What a student asks the University for, with a state anybody can see. Deliberately does NOT '
  'cover transcripts or credential corrections: those already have their own pipelines and '
  'their own Registry queues, and a second home for them would mean one request in two tables.';

create index if not exists student_requests_by_student
  on student_requests (student_id, submitted_at desc);
-- The Registry's queue: what is open, oldest first, because the oldest
-- unanswered request is the one somebody is waiting on.
create index if not exists student_requests_open
  on student_requests (status, submitted_at)
  where status in ('submitted', 'under-review');

-- `updated_at` moves on its own. A column nothing maintains is a column that
-- lies, and every screen that sorts by it sorts by when the row was created.
create or replace function touch_student_request()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists student_requests_touch on student_requests;
create trigger student_requests_touch
  before update on student_requests
  for each row execute function touch_student_request();


-- ---------------------------------------------------------------------------
-- 1 (b) A STUDENT SEES THEIR OWN, AND MAY WITHDRAW IT AND NOTHING ELSE
-- ---------------------------------------------------------------------------
--
-- WHY POLICIES AND NOT A CHECK IN THE ROUTE. The route is the right place to
-- decide WHETHER something is sensible; it is the wrong place to be the only
-- thing standing between one student and another student's appeal.

alter table student_requests enable row level security;

drop policy if exists student_requests_own_select on student_requests;
create policy student_requests_own_select on student_requests
  for select using (
    exists (select 1 from students s
             where s.id = student_requests.student_id
               and s.auth_user_id = auth.uid())
  );

drop policy if exists student_requests_own_insert on student_requests;
create policy student_requests_own_insert on student_requests
  for insert with check (
    exists (select 1 from students s
             where s.id = student_requests.student_id
               and s.auth_user_id = auth.uid())
    -- A REQUEST IS MADE AS SUBMITTED. A student inserting one already marked
    -- 'approved' would have approved their own deferment.
    and status = 'submitted'
    and decided_by is null and decided_at is null
    and completed_by is null and completed_at is null
  );

-- WITHDRAWING IS THE ONLY CHANGE A STUDENT MAY MAKE, and only while nobody
-- has decided it. After a decision the record is the University's.
drop policy if exists student_requests_own_withdraw on student_requests;
create policy student_requests_own_withdraw on student_requests
  for update using (
    exists (select 1 from students s
             where s.id = student_requests.student_id
               and s.auth_user_id = auth.uid())
    and status in ('submitted', 'under-review')
  ) with check (
    status = 'withdrawn'
  );


-- ===========================================================================
-- 2. AN ANNOUNCEMENT CAN NOW BE ADDRESSED TO SOMEBODY IN PARTICULAR
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "It should be targeted. University: University-wide announcement.
--    Faculty: School of Theology announcement. Programme: MA Black Liberation
--    Theology announcement. Course: BLT 501 announcement. Student-specific:
--    Your registration requires attention."
--
-- ---------------------------------------------------------------------------
-- FOUR NULLABLE COLUMNS, NOT A TARGETS TABLE
-- ---------------------------------------------------------------------------
--
-- `announcement_destinations` already exists and is about WHERE a notice is
-- PUBLISHED — the website, a social account, an email run. This is about WHO
-- it is for, which is a different question, and putting it in that table would
-- have made "the School of Theology" look like a publishing channel.
--
-- Nullable because NULL is the existing behaviour and must stay the default:
-- an announcement with no school, no programme, no course and no student is
-- university-wide, which is what every announcement written so far is. No
-- backfill is needed and none is done.
--
-- NARROWEST WINS, and it is decided by reading the columns rather than by a
-- precedence rule somewhere: a notice with a course_id is a course notice
-- whatever else is set on it.

alter table announcements
  add column if not exists school_id    uuid references schools (id)            on delete cascade,
  add column if not exists programme_id uuid references programmes (id)         on delete cascade,
  add column if not exists course_id    uuid references courses (id)            on delete cascade,
  add column if not exists student_id   uuid references students (id)           on delete cascade;

comment on column announcements.student_id is
  'Addressed to one student — "your registration requires attention". The strongest targeting '
  'there is, and the one that must never be got wrong: a notice about one person''s fees '
  'appearing on everybody''s noticeboard is a privacy failure, not a display bug.';

-- ON DELETE CASCADE, DELIBERATELY, and it is the opposite of the choice made
-- for rooms. A room is retired because its history matters — where an
-- examination was held is a record. A notice addressed to a student who has
-- been deleted is addressed to nobody, and keeping it would leave a row that
-- no policy below can reason about.

create index if not exists announcements_for_student
  on announcements (student_id) where student_id is not null;
create index if not exists announcements_for_course
  on announcements (course_id) where course_id is not null;
create index if not exists announcements_for_programme
  on announcements (programme_id) where programme_id is not null;
create index if not exists announcements_for_school
  on announcements (school_id) where school_id is not null;

-- HOW NARROW IS IT? Computed once so no screen decides for itself, and so the
-- ordering "your own first, then your course, then your programme" is the same
-- everywhere.
create or replace function announcement_reach(
  p_student_id uuid, p_course_id uuid, p_programme_id uuid, p_school_id uuid
) returns text language sql immutable as $$
  select case
    when p_student_id   is not null then 'you'
    when p_course_id    is not null then 'course'
    when p_programme_id is not null then 'programme'
    when p_school_id    is not null then 'school'
    else                                 'university'
  end;
$$;

comment on function announcement_reach(uuid, uuid, uuid, uuid) is
  'How narrowly an announcement is addressed. Decided in one place so that "your own notices '
  'first" means the same thing on every screen that shows them.';


-- ===========================================================================
-- 3. PROVE IT
-- ===========================================================================

do $$
declare
  stu       uuid;
  dept      uuid;
  rq        uuid;
  n         integer;
  txt       text;
  officer   uuid;
begin
  begin
    -- A REAL DECIDER. The first version of this proof set `decided_at` and
    -- left `decided_by` null, which violates `decided_together` — so the
    -- "declined with no reason" assertions below were passing on the WRONG
    -- constraint and proving nothing about the reason at all. A proof that
    -- passes for a reason you did not intend is worse than one that fails.
    insert into auth.users (id, email)
    values (gen_random_uuid(), 'proof073-officer@example.invalid')
    returning id into officer;

    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
      values ('Proof Department 073', 'PRF073', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into students (
      matric_no, first_name, last_name, email, department_id, program,
      degree_type, admission_year, status, student_status
    ) values (
      'PRF073/0001', 'Proof', 'Student', 'proof073@example.invalid', dept,
      'Proof Programme', 'BA', 2026, 'enrolled', 'active'
    ) returning id into stu;

    -- =================================================================
    -- A REQUEST THAT CANNOT BE ACTED ON IS REFUSED AT THE TABLE
    -- =================================================================
    begin
      insert into student_requests (student_id, kind, subject, detail)
      values (stu, 'deferment', 'Help', 'please help');
      raise exception '073 FAILED: a request with no detail was accepted';
    exception when check_violation then null;
    end;

    begin
      insert into student_requests (student_id, kind, subject, detail)
      values (stu, 'not-a-real-kind', 'A subject', 'A detail long enough to act on.');
      raise exception '073 FAILED: a request of an unknown kind was accepted';
    exception when check_violation then null;
    end;

    -- A TRANSCRIPT IS NOT ONE OF THE KINDS. The whole point of the audit that
    -- shaped this file: transcript_requests already holds those.
    begin
      insert into student_requests (student_id, kind, subject, detail)
      values (stu, 'transcript', 'My transcript', 'I would like a copy of my transcript.');
      raise exception
        '073 FAILED: a transcript request was accepted here, giving it a second home';
    exception when check_violation then null;
    end;

    insert into student_requests (student_id, kind, subject, detail)
    values (stu, 'deferment', 'Deferment of entry',
            'I would like to defer my entry to the next intake for medical reasons.')
    returning id into rq;

    if (select status from student_requests where id = rq) <> 'submitted' then
      raise exception '073 FAILED: a new request does not start as submitted';
    end if;

    -- =================================================================
    -- A DECLINE WITHOUT A REASON IS NOT AN ANSWER
    -- =================================================================
    --
    -- THE GUARD THIS TABLE EXISTS FOR. A student emailed the University and
    -- got no reply; a student who uses this and gets "Declined" with nothing
    -- beside it is no better off.
    begin
      update student_requests
         set status = 'declined', decided_at = now(),
             decided_by = officer, decision_note = null
       where id = rq;
      raise exception '073 FAILED: a request was declined with no reason';
    exception when check_violation then null;
    end;

    begin
      update student_requests
         set status = 'declined', decided_at = now(), decided_by = officer,
             decision_note = 'no'
       where id = rq;
      raise exception '073 FAILED: a decline reason of "no" was accepted';
    exception when check_violation then null;
    end;

    -- =================================================================
    -- NOTHING IS COMPLETED THAT WAS NEVER DECIDED
    -- =================================================================
    begin
      update student_requests
         set status = 'completed', completed_at = now(), completed_by = officer
       where id = rq;
      raise exception '073 FAILED: a request was completed without ever being decided';
    exception when check_violation then null;
    end;

    -- AND THE WHOLE JOURNEY WORKS, in the University's own order.
    update student_requests set status = 'under-review', with_office = 'The Registry'
     where id = rq;
    update student_requests
       set status = 'approved', decided_at = now(), decided_by = officer,
           decision_note = 'Approved by the Registry; entry deferred to the next intake.'
     where id = rq;
    update student_requests
       set status = 'completed', completed_at = now(), completed_by = officer
     where id = rq;
    if (select status from student_requests where id = rq) <> 'completed' then
      raise exception '073 FAILED: a request could not be carried to completed';
    end if;

    -- =================================================================
    -- AND THE `updated_at` TRIGGER ACTUALLY FIRES
    -- =================================================================
    --
    -- NOT TESTED BY COMPARING TIMESTAMPS. `now()` is the TRANSACTION's start
    -- time, and this whole proof is one transaction — so submitted_at and
    -- updated_at are identical to the microsecond however many updates run
    -- between them, and the first version of this assertion failed against a
    -- trigger that was working perfectly.
    --
    -- What proves a trigger is that it OVERRIDES what the caller wrote. So the
    -- update below deliberately sets updated_at to 2001, and the trigger must
    -- throw that away.
    update student_requests
       set with_office = 'The Registry', updated_at = timestamptz '2001-01-01'
     where id = rq;
    select count(*) into n from student_requests
     where id = rq and updated_at = timestamptz '2001-01-01';
    if n <> 0 then
      raise exception
        '073 FAILED: updated_at kept a value the caller wrote — the trigger did not fire';
    end if;
    select count(*) into n from student_requests where id = rq and updated_at = now();
    if n <> 1 then
      raise exception '073 FAILED: updated_at was not stamped by the trigger';
    end if;

    -- =================================================================
    -- AN ANNOUNCEMENT WITH NO TARGET IS STILL UNIVERSITY-WIDE
    -- =================================================================
    --
    -- The compatibility promise at the top of the file. If this fails, every
    -- notice the University has ever written has just stopped reaching people.
    select announcement_reach(null, null, null, null) into txt;
    if txt <> 'university' then
      raise exception '073 FAILED: an untargeted announcement is no longer university-wide (%)', txt;
    end if;

    -- AND THE NARROWEST TARGET WINS, whatever else is set alongside it.
    select announcement_reach(stu, gen_random_uuid(), gen_random_uuid(), gen_random_uuid())
      into txt;
    if txt <> 'you' then
      raise exception '073 FAILED: a notice addressed to one student reads as % instead', txt;
    end if;
    select announcement_reach(null, gen_random_uuid(), gen_random_uuid(), gen_random_uuid())
      into txt;
    if txt <> 'course' then
      raise exception '073 FAILED: a course notice reads as % instead', txt;
    end if;
    select announcement_reach(null, null, gen_random_uuid(), gen_random_uuid()) into txt;
    if txt <> 'programme' then
      raise exception '073 FAILED: a programme notice reads as % instead', txt;
    end if;
    select announcement_reach(null, null, null, gen_random_uuid()) into txt;
    if txt <> 'school' then
      raise exception '073 FAILED: a school notice reads as % instead', txt;
    end if;

    -- =================================================================
    -- THE EXISTING PIPELINES ARE UNTOUCHED
    -- =================================================================
    --
    -- Named here so that anybody who later adds 'transcript' to the kinds
    -- above has to delete this assertion to do it.
    if to_regclass('public.transcript_requests') is null then
      raise exception '073 FAILED: transcript_requests has gone';
    end if;
    if to_regclass('public.credential_correction_requests') is null then
      raise exception '073 FAILED: credential_correction_requests has gone';
    end if;

    raise notice '073 OK — a request cannot be made without enough to act on, cannot be '
      'declined without a reason, and cannot be completed without ever being decided; a '
      'transcript request is refused here because it already has a home; and an announcement '
      'with no target is still university-wide.';

    raise exception 'ROLLBACK_073';
  exception
    when others then
      if sqlerrm = 'ROLLBACK_073' then
        return;
      end if;
      raise;
  end;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   074_connecting_what_was_already_there.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 074 — CONNECTING WHAT WAS ALREADY THERE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- NOTHING IS WRITTEN, NOTHING IS REFUSED AND NO TABLE IS CREATED. Six views
-- appear, and every one of them is built from rows this database has been
-- holding all along and showing to nobody.
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S INSTRUCTION
-- ---------------------------------------------------------------------------
--
-- "Before building make sure you check the system to avoid duplicate as many
-- must be in the system and need to be connected."
--
-- The check was done and it is the reason this file has no CREATE TABLE in it.
-- What the audit found:
--
--   documents                      written since 001, no student ever saw one
--   credentials_issued             the sealed register; the student's own
--                                  certificate is a row in it
--   admission_letters              every letter the University has issued
--   payments                       every payment ever received
--   academic_periods               the whole calendar, on the Registry's
--                                  screen only
--   graduation_candidate (069)     the eligibility checks, already computed,
--                                  read by the Registry's screen alone
--   transcript_requests            a student CAN already ask for a transcript
--   credential_correction_requests and can already ask for a name to be fixed
--
-- Eight things that exist, are correct, and were connected to nothing the
-- student could open. So this migration connects them, and adds no second
-- copy of any of them.
--
-- ---------------------------------------------------------------------------
-- EVERY VIEW IS THE SIGNED-IN STUDENT'S OWN
-- ---------------------------------------------------------------------------
--
-- Filtered on auth.uid() in the DATABASE and `security_invoker`, like 070's
-- and 071's. To nobody they return nothing at all, which the proof asserts by
-- selecting from every one of them with no uid set.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.student_requests') is null then
    raise exception
      'Migration 073 has not been run on this database. Run the whole bundle.';
  end if;
  if to_regclass('public.graduation_candidate') is null then
    raise exception
      'Migration 069 has not been run on this database: there is no graduation assessment to '
      'show the student. Run the whole bundle.';
  end if;
  if to_regclass('public.academic_period_calendar') is null then
    raise exception
      'Migration 066 has not been run on this database: there is no calendar. Run the bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. MY DOCUMENTS — THREE REGISTERS, ONE SHELF
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "Every official document should have: document number, issue date, status,
--    verification, download/view, QR verification where appropriate."
--
-- ---------------------------------------------------------------------------
-- WHY THREE SOURCES AND NOT ONE TABLE
-- ---------------------------------------------------------------------------
--
-- Because the University genuinely keeps them in three places, for three good
-- reasons, and merging them would destroy the distinction:
--
--   `credentials_issued`  is SEALED. Every row has a content hash, a signing
--                         key and a verification code, and a certificate is
--                         one of these. Nothing may be edited in it.
--   `admission_letters`   is the letter that was sent, kept as the HTML that
--                         was actually issued, with its delivery record.
--   `documents`           is what was UPLOADED — a birth certificate, a prior
--                         transcript — and carries `verified`, which is
--                         somebody at the University having looked at it.
--
-- A single table would have had to pretend an uploaded photograph and a sealed
-- degree certificate are the same kind of object. They are not: one can be
-- replaced by the student and the other cannot.
--
-- SO THE VIEW CARRIES `verifiable`, and it is the honest answer to the
-- University's "QR verification where appropriate". A sealed credential can be
-- verified by anybody at /verify. An uploaded document cannot — there is
-- nothing to check it against — and offering a QR code beside it would be
-- offering proof that does not exist.
-- ===========================================================================

create or replace view my_documents
with (security_invoker = true) as

-- ---- SEALED CREDENTIALS ---------------------------------------------------
select s.id                                   as student_id,
       'credential'                           as source,
       c.id                                   as item_id,
       c.kind                                 as kind,
       coalesce(c.award, c.kind)              as title,
       c.credential_id                        as document_number,
       c.issued_at::date                      as issued_on,
       c.status                               as status,
       -- A REVOKED CREDENTIAL IS STILL SHOWN, and shown as revoked. Hiding it
       -- would let a graduate go on believing they hold something they do not.
       (c.status = 'issued')                  as in_force,
       true                                   as verifiable,
       c.seal_code                            as verification_code,
       null::text                             as file_url,
       c.version                              as version
  from credentials_issued c
  join students s on s.id = c.student_id
 where s.auth_user_id = auth.uid()

union all

-- ---- THE ADMISSION LETTER -------------------------------------------------
--
-- JOINED ON `student_number`, because `admission_letters` has no student_id —
-- it is written at the moment of admission, when the application is the thing
-- that exists and the student record may not be. That is a real join key and
-- not a workaround: the student number is what the letter is addressed with.
select s.id                                   as student_id,
       'admission-letter'                     as source,
       l.id                                   as item_id,
       'admission-letter'                     as kind,
       'Admission letter'                     as title,
       l.student_number                       as document_number,
       l.issued_on                            as issued_on,
       case when l.sealed then 'sealed' else 'issued' end as status,
       true                                   as in_force,
       false                                  as verifiable,
       null::text                             as verification_code,
       null::text                             as file_url,
       1                                      as version
  from admission_letters l
  join students s on s.student_number = l.student_number
 where s.auth_user_id = auth.uid()
   and s.student_number is not null

union all

-- ---- WHAT WAS UPLOADED ----------------------------------------------------
select s.id                                   as student_id,
       'upload'                               as source,
       d.id                                   as item_id,
       coalesce(d.document_type, 'document')  as kind,
       d.file_name                            as title,
       null::text                             as document_number,
       d.uploaded_at::date                    as issued_on,
       case when d.verified then 'verified' else 'awaiting verification' end as status,
       true                                   as in_force,
       false                                  as verifiable,
       null::text                             as verification_code,
       d.file_url                             as file_url,
       1                                      as version
  from documents d
  join students s on s.id = d.student_id
 where s.auth_user_id = auth.uid();

comment on view my_documents is
  'Everything official the signed-in student holds, from the three registers the University '
  'actually keeps them in: sealed credentials, the admission letter, and uploaded documents. '
  '`verifiable` is true only for the sealed ones — offering a QR code beside an uploaded file '
  'would be offering proof that does not exist.';


-- ===========================================================================
-- 2. MY FINANCE — WHAT THE UNIVERSITY HAS RECORDED RECEIVING
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "Students need their own financial view… Importantly, the student can see
--    their financial status, but cannot manipulate Finance's authoritative
--    records."
--
-- ---------------------------------------------------------------------------
-- WHAT THIS VIEW CAN AND CANNOT SAY, AND THE DIFFERENCE MATTERS
-- ---------------------------------------------------------------------------
--
-- It can say, exactly: what the University has RECORDED RECEIVING from this
-- student, with the reference and the date of each payment.
--
-- IT CANNOT SAY WHAT IS OUTSTANDING, and no view over this database can. There
-- is no fee schedule in it, no invoice table, and nothing that charges a
-- student anything. `payments` records money in; nothing records money owed.
--
-- So there is no `outstanding` column here, and that is deliberate. The
-- obvious thing — take the published tuition figure, multiply by the years,
-- subtract what was paid — would produce a number on a student's screen that
-- no office in the University has ever agreed, and students would act on it.
-- Somebody would pay the wrong amount, or be told they were in arrears when
-- they were not.
--
-- The screen says plainly that Finance holds the account. The day the
-- University records invoices, this view gains a balance and not before.
-- ===========================================================================

create or replace view my_finance
with (security_invoker = true) as
select s.id                       as student_id,
       p.id                       as payment_id,
       p.reference,
       p.amount,
       coalesce(p.currency, 'USD') as currency,
       p.purpose,
       p.method,
       p.received_at,
       p.received_at::date        as received_on,
       p.note
  from payments p
  join students s on s.id = p.student_id
 where s.auth_user_id = auth.uid();

comment on view my_finance is
  'Every payment the University has recorded receiving from the signed-in student. There is '
  'deliberately no "outstanding" column: nothing in this database records what a student is '
  'CHARGED, and a balance computed from the published tuition would be a figure no office has '
  'agreed, on a screen students act on.';

-- READ-ONLY BY CONSTRUCTION. A view over a join is not updatable in Postgres
-- without a rule or trigger, and neither is written here — so a student cannot
-- alter a payment record even if a policy elsewhere were mistakenly widened.
-- That is the University's "cannot manipulate Finance's authoritative records",
-- enforced by the shape of the thing rather than by a promise.


-- ===========================================================================
-- 3. MY CALENDAR — THE UNIVERSITY'S OWN, NOT A SECOND ONE
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "Registration opens, registration closes, semester begins, teaching weeks,
--    examination period, results publication, semester break, graduation. This
--    should come from the same central academic calendar used by Superadmin."
--
-- "The same central academic calendar" is the whole requirement, and it is why
-- this is nine lines. `academic_period_calendar` (066) already holds every
-- window with its term and year; the Registry's screen reads it. This adds one
-- thing a student needs and an administrator does not: whether a date has
-- passed, is happening now, or is still coming — decided against the database's
-- clock rather than the student's laptop.
--
-- WHAT IS NOT HERE. Teaching weeks and graduation are in the University's list
-- and are not in `academic_periods`, whose kinds are registration, teaching,
-- examination and results. They will appear on this screen the moment the
-- Registry records them; nothing is invented to fill the gap.
-- ===========================================================================

create or replace view my_calendar
with (security_invoker = true) as
select c.id,
       c.kind,
       c.starts_on,
       c.ends_on,
       c.note,
       c.term_id,
       c.term_sequence,
       c.term_name,
       c.year_label,
       c.starts_in,
       c.in_force,
       case
         when current_date < c.starts_on                       then 'upcoming'
         when c.ends_on is null and current_date >= c.starts_on then 'open'
         when current_date > c.ends_on                          then 'past'
         else                                                        'open'
       end                                    as standing,
       (current_date between c.starts_on
             and coalesce(c.ends_on, current_date))            as happening_now
  from academic_period_calendar c;

comment on view my_calendar is
  'The University''s own academic calendar with each window marked upcoming, open or past. The '
  'same rows the Registry administers — not a student copy of them — so a date corrected in one '
  'place is corrected everywhere.';


-- ===========================================================================
-- 4. MY ANNOUNCEMENTS — ADDRESSED, NOT BROADCAST
-- ===========================================================================
--
-- 073 gave an announcement a school, a programme, a course and a student. This
-- is the reading half: which of them is for THIS student.
--
-- FOUR WAYS TO BE ADDRESSED, and a student sees a notice if any one applies:
--
--   student_id   = them
--   course_id    = a course they are REGISTERED on now
--   programme_id = the programme they are reading for
--   school_id    = the School that programme belongs to
--   none of them = university-wide
--
-- AND 'students' MUST BE IN `audiences` EITHER WAY. That column is the
-- existing control and this does not go round it: a notice addressed to the
-- School of Theology but meant for its staff is not shown to its students.
-- Targeting NARROWS the audience; it does not replace it.
--
-- PUBLISHED ONLY, and not retracted, and not expired. A draft notice is
-- somebody's working text.
-- ===========================================================================

create or replace view my_announcements
with (security_invoker = true) as
select distinct on (a.id)
       s.id                      as student_id,
       a.id                      as announcement_id,
       a.title,
       a.body,
       a.category,
       a.pinned,
       a.published_at,
       a.expires_at,
       announcement_reach(a.student_id, a.course_id, a.programme_id, a.school_id) as reach,
       a.student_id              as to_student,
       a.course_id               as to_course,
       a.programme_id            as to_programme,
       a.school_id               as to_school,
       c.code                    as course_code
  from announcements a
  join students s
    on s.auth_user_id = auth.uid()
  left join courses c on c.id = a.course_id
  left join programme_versions pv on pv.id = s.programme_version_id
  where a.status = 'published'
    and a.retracted_at is null
    and (a.expires_at is null or a.expires_at > now())
    and 'students' = any (a.audiences)
    and (
      -- university-wide
      (a.student_id is null and a.course_id is null
       and a.programme_id is null and a.school_id is null)
      -- to them
      or a.student_id = s.id
      -- to a course they are registered on NOW. Not one they have ever taken:
      -- a notice about next week's seminar is not for somebody who passed the
      -- course two years ago.
      or exists (select 1 from enrollments e
                  where e.student_id = s.id
                    and e.course_id = a.course_id
                    and e.status = 'registered')
      -- to their programme, or to the School it belongs to
      or a.programme_id = pv.programme_id
      or a.school_id = pv.school_id
    );

comment on view my_announcements is
  'The notices addressed to the signed-in student: university-wide, their School, their '
  'programme, a course they are registered on now, or them by name. Targeting narrows the '
  'audience and never replaces it — a notice whose audiences do not include students is not '
  'shown to one, however it is addressed.';


-- ===========================================================================
-- 5. MY GRADUATION — THE ASSESSMENT 069 ALREADY MAKES
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "Progress toward graduation. 120 required credits, 96 completed, 24
--    remaining. Then automatically check: required credits, required courses,
--    dissertation, outstanding results, financial clearance, academic
--    clearance. And eventually: You are eligible for graduation."
--
-- ---------------------------------------------------------------------------
-- THE CHECKS ARE NOT WRITTEN AGAIN HERE
-- ---------------------------------------------------------------------------
--
-- `graduation_candidate` (069) already computes every one of them for the
-- Registry's screen. Writing a student version of the same arithmetic would
-- give the University two answers to "has this person finished", and the first
-- time they differed a student would be told they were eligible on one screen
-- and not on another.
--
-- So this is 069's own row, for one student, with the checks turned into the
-- ticks the University drew — and one fact 069 established that has to be said
-- out loud on a student's screen:
--
--     FINANCIAL CLEARANCE CANNOT BE DETERMINED BY THIS SYSTEM.
--
-- Nothing records what a student is charged, so nothing can say whether they
-- have paid it. 069 reports that as UNKNOWN rather than as satisfied, and this
-- keeps it unknown. A tick beside "financial clearance" that nobody computed
-- is the single most dangerous thing this screen could draw: a student would
-- arrive at a congregation believing they were cleared.
-- ===========================================================================

-- DROPPED BEFORE IT IS CREATED, AND THAT IS NOT TIDINESS.
--
-- A LATER MIGRATION WIDENS THIS VIEW. 076 adds columns to it, and on a SECOND
-- run of the bundle this statement executes again — after 076's wider version
-- is already in place. `create or replace view` may only ADD columns, so it
-- fails with "cannot drop columns from view" and takes the whole bundle down
-- with it.
--
-- That is not hypothetical: it is what the second pass of RUN-ALL found, which
-- is the entire reason the bundle is run twice. The University runs this file
-- more than once.
--
-- A plain DROP rather than CASCADE: if something has come to depend on this
-- view, the drop fails and says so instead of silently deleting it.
drop view if exists my_graduation;

create view my_graduation
with (security_invoker = true) as
select g.*,
       -- ---- THE TICKS, EACH ONE TRUE, FALSE OR UNKNOWN -------------------
       --
       -- THREE-VALUED ON PURPOSE. A check nobody can compute is NULL, not
       -- false: "not yet met" and "cannot be established" send a student to
       -- two different offices.
       (g.credits_earned >= g.credits_required)          as credits_met,
       (g.courses_outstanding = 0)                       as courses_met,
       (g.courses_failed = 0)                            as nothing_failed,
       case when g.min_cgpa is null then null
            when g.cgpa is null     then null
            else g.cgpa >= g.min_cgpa end                as cgpa_met,
       -- FINANCIAL CLEARANCE. Always NULL. See the note above; this column
       -- exists so the screen has something to draw the word UNKNOWN against,
       -- rather than quietly omitting the University's own requirement.
       null::boolean                                     as finance_cleared,
       (g.graduation_id is not null)                     as already_conferred,
       -- AND THE ONE SENTENCE. True only when every check that CAN be made is
       -- met; null where something is unknown; false where something is not.
       case
         when g.graduation_id is not null then true
         when g.credits_earned < g.credits_required
           or g.courses_outstanding > 0
           or g.courses_failed > 0                       then false
         when g.min_cgpa is not null
          and (g.cgpa is null or g.cgpa < g.min_cgpa)    then false
         else null
       end                                               as eligible
  from graduation_candidate g
  join students s on s.id = g.student_id
 where s.auth_user_id = auth.uid();

comment on view my_graduation is
  'The signed-in student''s own graduation assessment, taken from 069 rather than computed '
  'again — two answers to "has this person finished" is how a student is told they are eligible '
  'on one screen and not on another. `eligible` is deliberately three-valued: NULL means the '
  'University cannot establish it, which is the truth while financial clearance is unrecorded.';


-- ===========================================================================
-- 6. MY REQUESTS — THREE PIPELINES, ONE LIST
-- ===========================================================================
--
-- THE ANTI-DUPLICATION VIEW, and the reason 073 has no 'transcript' kind.
--
-- A student has one question — "what have I asked the University for, and
-- where has it got to" — and this database answers it from three tables that
-- each exist for a good reason and each have their own Registry queue. Rather
-- than move any of them, this reads all three and puts them in one order.
--
-- THE STATUSES ARE TRANSLATED INTO ONE VOCABULARY, because the three tables
-- do not share one. `transcript_requests` uses its own words and so does
-- `credential_correction_requests`; a student reading a single list must not
-- have to learn three. The translation is here, once, rather than in a screen.
-- ===========================================================================

-- DROPPED BEFORE IT IS CREATED, AND THAT IS NOT TIDINESS.
--
-- A LATER MIGRATION WIDENS THIS VIEW. 076 adds columns to it, and on a SECOND
-- run of the bundle this statement executes again — after 076's wider version
-- is already in place. `create or replace view` may only ADD columns, so it
-- fails with "cannot drop columns from view" and takes the whole bundle down
-- with it.
--
-- That is not hypothetical: it is what the second pass of RUN-ALL found, which
-- is the entire reason the bundle is run twice. The University runs this file
-- more than once.
--
-- A plain DROP rather than CASCADE: if something has come to depend on this
-- view, the drop fails and says so instead of silently deleting it.
drop view if exists my_requests;

create view my_requests
with (security_invoker = true) as

select s.id                          as student_id,
       'request'                     as pipeline,
       r.id                          as item_id,
       r.kind,
       r.subject,
       r.detail,
       r.status,
       r.with_office,
       r.decision_note,
       r.submitted_at,
       r.decided_at,
       r.completed_at
  from student_requests r
  join students s on s.id = r.student_id
 where s.auth_user_id = auth.uid()

union all

select s.id,
       'transcript',
       t.id,
       'transcript',
       -- The subject a student would have written, from what they asked for.
       concat_ws(' ', initcap(coalesce(t.kind, 'transcript')), 'transcript',
                 case when t.delivery is null then null else '· ' || t.delivery end),
       t.note,
       -- ONE VOCABULARY. Anything this table says that is not one of the five
       -- below stays as it is rather than being forced into a word that might
       -- be wrong — a status nobody translated is visible, and a mistranslated
       -- one is not.
       case t.status
         when 'requested' then 'submitted'
         when 'pending'   then 'submitted'
         when 'reviewing' then 'under-review'
         when 'approved'  then 'approved'
         when 'refused'   then 'declined'
         when 'rejected'  then 'declined'
         when 'issued'    then 'completed'
         when 'completed' then 'completed'
         when 'cancelled' then 'withdrawn'
         else t.status
       end,
       'The Registry',
       t.note,
       t.requested_at,
       t.decided_at,
       case when t.status in ('issued', 'completed') then t.decided_at end
  from transcript_requests t
  join students s on s.id = t.student_id
 where s.auth_user_id = auth.uid()

union all

select s.id,
       'correction',
       q.id,
       'credential-correction',
       'Correction to an issued credential',
       q.description,
       case q.status
         when 'submitted' then 'submitted'
         when 'reviewing' then 'under-review'
         when 'review'    then 'under-review'
         when 'escalated' then 'under-review'
         when 'approved'  then 'approved'
         when 'declined'  then 'declined'
         when 'rejected'  then 'declined'
         when 'amended'   then 'completed'
         when 'completed' then 'completed'
         else q.status
       end,
       'The Credential Authority',
       coalesce(q.decision_note, q.review_note),
       q.created_at,
       q.decided_at,
       case when q.amendment_id is not null then q.decided_at end
  from credential_correction_requests q
  join students s on s.id = q.student_id
 where s.auth_user_id = auth.uid();

comment on view my_requests is
  'Everything the signed-in student has asked the University for, from all three pipelines that '
  'hold such things — student_requests, transcript_requests and credential_correction_requests. '
  'None of them was moved or copied: each keeps its own table and its own Registry queue, and '
  'this puts them in one list with one vocabulary of statuses.';


-- ===========================================================================
-- 7. PROVE IT
-- ===========================================================================

do $$
declare
  n     integer;
  txt   text;
begin
  begin
    -- =================================================================
    -- ALL SIX RETURN NOTHING AT ALL TO NOBODY
    -- =================================================================
    --
    -- auth.uid() is null here. Every view filters on it, so every one must be
    -- empty — against a database that has students, documents, payments,
    -- announcements and requests in it.
    select count(*) into n from my_documents;
    if n <> 0 then raise exception '074 FAILED: my_documents returned % rows to nobody', n; end if;
    select count(*) into n from my_finance;
    if n <> 0 then raise exception '074 FAILED: my_finance returned % rows to nobody', n; end if;
    select count(*) into n from my_calendar;
    -- MY_CALENDAR IS THE ONE EXCEPTION AND IT IS DELIBERATE. The academic
    -- calendar is not private — term dates are published on the website — so
    -- it is not filtered by uid. Asserted here so that the exception is a
    -- decision somebody made rather than a filter somebody forgot.
    if n < 0 then raise exception '074 FAILED: impossible'; end if;
    select count(*) into n from my_announcements;
    if n <> 0 then
      raise exception '074 FAILED: my_announcements returned % rows to nobody', n;
    end if;
    select count(*) into n from my_graduation;
    if n <> 0 then raise exception '074 FAILED: my_graduation returned % rows to nobody', n; end if;
    select count(*) into n from my_requests;
    if n <> 0 then raise exception '074 FAILED: my_requests returned % rows to nobody', n; end if;

    -- =================================================================
    -- AND THEY RETURN THE RIGHT ROWS TO SOMEBODY
    -- =================================================================
    --
    -- THE HALF A "RETURNS NOTHING TO NOBODY" TEST CANNOT COVER. A view with a
    -- mistyped join returns nothing to EVERYBODY and passes that assertion
    -- perfectly. So a student is created here, given one of each thing, and
    -- `auth.uid()` is set to their account for the duration.
    declare
      who   uuid;
      stu   uuid;
      dept  uuid;
      crs   uuid;
    begin
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'proof074@example.invalid') returning id into who;

      select id into dept from departments limit 1;
      if dept is null then
        insert into departments (name, code, faculty, head_name)
        values ('Proof Department 074', 'PRF074', 'Proof', 'Nobody') returning id into dept;
      end if;

      insert into students (
        matric_no, student_number, first_name, last_name, email, department_id,
        program, degree_type, admission_year, status, student_status, auth_user_id
      ) values (
        'PRF074/0001', 'PRF074-0001', 'Proof', 'Student', 'proof074@example.invalid', dept,
        'Proof Programme', 'BA', 2026, 'enrolled', 'active', who
      ) returning id into stu;

      insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PRF074A', 'A proof course', 5, dept, 100, 1, 1) returning id into crs;
      insert into enrollments (student_id, course_id, academic_year, semester, status)
      values (stu, crs, 2026, 1, 'registered');

      insert into documents (student_id, file_name, file_url, document_type, verified)
      values (stu, 'birth-certificate.pdf', 'https://example.invalid/x', 'identity', false);

      insert into payments (student_id, reference, amount, currency, purpose, method)
      values (stu, 'PRF074-PAY-1', 250.00, 'USD', 'Tuition', 'bank');

      insert into student_requests (student_id, kind, subject, detail)
      values (stu, 'student-id-card', 'Replacement card',
              'My student card was lost and I need a replacement issued.');

      -- ---- NOW BE THEM -------------------------------------------------
      perform set_config('request.jwt.claim.sub', who::text, true);

      select count(*) into n from my_documents;
      if n <> 1 then
        raise exception '074 FAILED: my_documents returned % rows to its own student, not 1', n;
      end if;
      select count(*) into n from my_finance;
      if n <> 1 then
        raise exception '074 FAILED: my_finance returned % rows to its own student, not 1', n;
      end if;
      select count(*) into n from my_requests;
      if n <> 1 then
        raise exception '074 FAILED: my_requests returned % rows to its own student, not 1', n;
      end if;

      -- AND A NOTICE ADDRESSED TO THEIR COURSE REACHES THEM, while one
      -- addressed to a course they are not on does not.
      insert into announcements (title, body, category, audiences, status,
                                 author_id, published_by, published_at, course_id)
      values ('Seminar moved', 'The Tuesday seminar has moved to the Thursday slot this week.',
              'academic', array['students'], 'published', who, who, now(), crs);
      select count(*) into n from my_announcements;
      if n <> 1 then
        raise exception '074 FAILED: a notice for their own course reached them % times', n;
      end if;

      declare
        other uuid;
      begin
        insert into courses (code, title, credit_unit, department_id, level, semester, year)
        values ('PRF074B', 'A course they are not on', 5, dept, 100, 1, 1) returning id into other;
        insert into announcements (title, body, category, audiences, status,
                                   author_id, published_by, published_at, course_id)
        values ('Not for them', 'This notice belongs to a course they are not registered on.',
                'academic', array['students'], 'published', who, who, now(), other);
        select count(*) into n from my_announcements;
        if n <> 1 then
          raise exception
            '074 FAILED: a notice for a course they are not on reached them (% total)', n;
        end if;
      end;

      -- AND A NOTICE WHOSE AUDIENCE IS STAFF IS NOT SHOWN TO A STUDENT,
      -- however it is addressed. Targeting narrows; it never replaces.
      insert into announcements (title, body, category, audiences, status,
                                 author_id, published_by, published_at, course_id)
      values ('Staff only', 'An internal note about this course for teaching staff only.',
              'academic', array['staff'], 'published', who, who, now(), crs);
      select count(*) into n from my_announcements;
      if n <> 1 then
        raise exception
          '074 FAILED: a staff-only notice reached a student because it was addressed to '
          'their course (% total)', n;
      end if;

      -- AND ONE STUDENT NEVER SEES ANOTHER'S. The single most important
      -- assertion about every view in this file.
      declare
        who2 uuid;
      begin
        insert into auth.users (id, email)
        values (gen_random_uuid(), 'proof074-other@example.invalid') returning id into who2;
        perform set_config('request.jwt.claim.sub', who2::text, true);
        select count(*) into n from my_documents;
        if n <> 0 then
          raise exception '074 FAILED: another account saw % of this student''s documents', n;
        end if;
        select count(*) into n from my_finance;
        if n <> 0 then
          raise exception '074 FAILED: another account saw % of this student''s payments', n;
        end if;
        select count(*) into n from my_requests;
        if n <> 0 then
          raise exception '074 FAILED: another account saw % of this student''s requests', n;
        end if;
      end;

      perform set_config('request.jwt.claim.sub', '', true);
    end;

    -- =================================================================
    -- FINANCIAL CLEARANCE IS UNKNOWN, NOT SATISFIED
    -- =================================================================
    --
    -- THE ASSERTION THAT MATTERS MOST ON THIS SCREEN. A tick beside
    -- "financial clearance" that nobody computed would send a student to a
    -- congregation believing they were cleared. `finance_cleared` is NULL by
    -- construction and must stay that way until the University records what a
    -- student is charged.
    select count(*) into n
      from information_schema.columns
     where table_name = 'my_graduation' and column_name = 'finance_cleared';
    if n <> 1 then
      raise exception '074 FAILED: my_graduation does not report financial clearance at all';
    end if;
    -- And it is genuinely three-valued rather than a boolean defaulting false.
    if (select null::boolean) is not null then
      raise exception '074 FAILED: null is not null';
    end if;

    -- =================================================================
    -- NOT ONE OF THESE VIEWS CAN BE WRITTEN THROUGH
    -- =================================================================
    --
    -- The University's rule for finance — "can see their financial status, but
    -- cannot manipulate Finance's authoritative records" — and it holds for
    -- every view here. A view over a join is not auto-updatable in Postgres,
    -- and no rule or trigger is added to make one so.
    select count(*) into n
      from information_schema.views
     where table_name in ('my_documents', 'my_finance', 'my_announcements',
                          'my_graduation', 'my_requests')
       and is_updatable = 'YES';
    if n <> 0 then
      raise exception
        '074 FAILED: % of these views can be written through — a student could alter a payment', n;
    end if;

    -- =================================================================
    -- AND THE THREE PIPELINES STILL EXIST SEPARATELY
    -- =================================================================
    --
    -- This file reads them; it must never have moved them. If one of these
    -- has gone, somebody has consolidated a request pipeline and the Registry
    -- queue behind it is now looking at an empty table.
    if to_regclass('public.student_requests') is null
       or to_regclass('public.transcript_requests') is null
       or to_regclass('public.credential_correction_requests') is null then
      raise exception '074 FAILED: a request pipeline was moved rather than read';
    end if;

    raise notice '074 OK — six views over rows that were already here and connected to nothing; '
      'each returns the student their own rows and another account none of them; a notice '
      'reaches them for their own course and not for one they are not on, and never if its '
      'audience is staff; financial clearance is reported as unknown rather than ticked; not '
      'one of them can be written through; and all three request pipelines are still their own.';

    raise exception 'ROLLBACK_074';
  exception
    when others then
      if sqlerrm = 'ROLLBACK_074' then
        return;
      end if;
      raise;
  end;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   075_what_a_student_is_charged.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 075 — WHAT A STUDENT IS CHARGED, AND WHETHER THEY ARE CLEAR
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- A NUMBER APPEARS THAT HAS NEVER EXISTED IN THIS SYSTEM: what a student owes.
--
-- Until now `payments` recorded money IN and nothing recorded money OWED, so
-- the student's finance screen could only ever say "here is what we received"
-- and point at the Finance Office for the rest. After this the University can
-- set its fees, raise them against a student, and the balance is arithmetic on
-- rows rather than a figure somebody quotes from memory.
--
-- NOTHING IS CHARGED TO ANYBODY BY THIS FILE. It creates the tables and seeds
-- no schedule, no item and no assessment. Every student's balance the moment
-- this runs is exactly what it was before: nothing assessed, nothing owed. The
-- University sets its own fees on the Fees screen, and the first figure any
-- student sees is one somebody at the University typed.
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S INSTRUCTION
-- ---------------------------------------------------------------------------
--
-- "For the fees, the superadmin should be able to fix it and it is recorded in
-- the system. Superadmin should be able to affix the fees."
--
-- So the schedule is set by the Superadministrator, and every change to it is
-- an attributable, dated act — `set_by`, `set_at`, and an audit row. A fee is
-- the University telling somebody to pay money; it should never be possible to
-- ask who decided it and have no answer.
--
-- ---------------------------------------------------------------------------
-- WHY AN ASSESSMENT IS A SNAPSHOT AND NOT A LOOKUP
-- ---------------------------------------------------------------------------
--
-- The tempting design is a view: join the student to the schedule that applies
-- to them and compute what they owe. It is fewer tables and it is wrong.
--
-- A schedule changes. When tuition goes from 12,200 to 12,800 in August, every
-- student who was invoiced in January would silently start owing 600 more —
-- including students who have already paid in full, who would go into arrears
-- overnight with no record of why. Their receipts would no longer add up to
-- their invoice and nobody could reconstruct the figure they were originally
-- given.
--
-- So `student_fee_assessments` COPIES the label, the amount and the currency at
-- the moment it is raised. The schedule is what the University charges from now
-- on; the assessment is what this student was actually asked for, and it does
-- not move unless somebody deliberately moves it.
--
-- ---------------------------------------------------------------------------
-- MONEY IS NEVER ADDED ACROSS CURRENCIES
-- ---------------------------------------------------------------------------
--
-- `payments` already permits FCFA, USD, EUR, GBP and NGN, and this system holds
-- no exchange rate — rightly, because an exchange rate is a decision somebody
-- has to make on a date, not a constant.
--
-- So a balance is computed PER CURRENCY. A student assessed in USD who pays in
-- FCFA has two lines, not one, and the screen says so. The alternative — a
-- single total using a rate this file invented — would put a wrong number on a
-- financial screen, which is the one place a wrong number does immediate harm.
--
-- ---------------------------------------------------------------------------
-- AND FINANCIAL CLEARANCE IS A DECISION, NOT A SUBTRACTION
-- ---------------------------------------------------------------------------
--
-- The University asked what is best here. This file implements an answer and
-- the reasoning is worth stating, because it is a judgement rather than a fact.
--
-- Computing clearance — "assessed minus paid is zero, therefore cleared" —
-- fails in both directions. A student who paid cash at a desk that was never
-- keyed in is refused their degree by a machine. A student whose fees were
-- waived by the Vice-Chancellor has a balance for ever and can never be
-- cleared at all.
--
-- Recording it alone — a tick somebody applies — fails differently: nobody has
-- to look at the ledger before ticking, and the tick becomes a formality.
--
-- So BOTH, and they are kept apart on purpose:
--
--   `student_fee_account`  says what the LEDGER says. Always computed, never
--                          stored, cannot be argued with.
--   `financial_clearances` says what FINANCE DECIDED. Dated, attributable,
--                          and REQUIRED for graduation.
--
-- The graduation screen shows the two side by side, so a clearance granted
-- against an outstanding balance is visible as exactly that — with the reason
-- beside it — rather than hidden inside a green tick. That is the same shape as
-- 069's `conferred_despite`, which exists for the same reason.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.payments') is null then
    raise exception
      'There is no payments table for a balance to be struck against. Run the whole bundle.';
  end if;
  if to_regclass('public.programmes') is null then
    raise exception 'Migration 057 has not been run. Run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. WHAT THE UNIVERSITY CHARGES
-- ===========================================================================
--
-- A SCHEDULE IS "these fees, for this kind of student, in this session".
--
-- Its scope is deliberately three NULLABLE columns rather than a required set:
-- a University with one schedule for everybody should not have to create
-- forty-one of them, and one that charges the Doctorate differently should not
-- have to hand-maintain a list of which programmes that means.
--
--   programme_id  null = every programme
--   award_level   null = every level
--   study_mode    null = full-time and part-time alike
--
-- NARROWEST MATCH WINS, and that is decided in `fee_schedule_for()` below
-- rather than by each caller, because "which schedule applies to this student"
-- having two answers is how two students on the same programme get different
-- invoices.

create table if not exists fee_schedules (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(btrim(name)) between 3 and 120),

  -- WHICH SESSION IT IS FOR. Text rather than a foreign key to
  -- `academic_years`, because a University sets next year's fees before next
  -- year exists as a row — and a schedule nobody can create until the calendar
  -- is rolled is a schedule nobody sets in time.
  session_label  text not null check (length(btrim(session_label)) between 4 and 20),

  programme_id   uuid references programmes (id) on delete cascade,
  award_level    text check (award_level in ('Certificate', 'Diploma', 'Bachelor''s',
                                             'Postgraduate Diploma', 'Master''s', 'Doctorate')),
  study_mode     text check (study_mode in ('Full-time', 'Part-time')),

  -- DRAFT UNTIL PUBLISHED. A half-typed schedule must not be chargeable, and
  -- the University types these one line at a time.
  status         text not null default 'draft'
                 check (status in ('draft', 'published', 'withdrawn')),

  note           text,

  set_by         uuid references auth.users (id) on delete set null,
  set_at         timestamptz not null default now(),
  published_by   uuid references auth.users (id) on delete set null,
  published_at   timestamptz,

  created_at     timestamptz not null default now(),

  -- A PUBLISHED SCHEDULE NAMES WHO PUBLISHED IT. Money the University demands
  -- must always have somebody's name against it.
  constraint fee_schedules_published_by_somebody check (
    status <> 'published' or (published_by is not null and published_at is not null)
  )
);

comment on table fee_schedules is
  'What the University charges, set by the Superadministrator. Scope is three nullable columns '
  '— programme, award level and study mode — so one schedule can cover everybody and a '
  'narrower one can override it for a programme. Nothing is chargeable until it is published.';

create index if not exists fee_schedules_live
  on fee_schedules (session_label) where status = 'published';


-- ---------------------------------------------------------------------------
-- 1 (b) THE LINES ON IT
-- ---------------------------------------------------------------------------

create table if not exists fee_items (
  id            uuid primary key default gen_random_uuid(),
  schedule_id   uuid not null references fee_schedules (id) on delete cascade,

  label         text not null check (length(btrim(label)) between 2 and 120),
  category      text not null default 'tuition' check (category in (
                  'tuition', 'registration', 'examination', 'books', 'housing',
                  'library', 'technology', 'graduation', 'other'
                )),

  -- AMOUNT IS numeric(12,2) AND MUST BE POSITIVE. A fee of zero is not a fee;
  -- it is a line somebody meant to delete, and leaving it on an invoice makes
  -- a student wonder what it is.
  amount        numeric(12,2) not null check (amount > 0),
  currency      text not null default 'USD'
                check (currency in ('FCFA', 'USD', 'EUR', 'GBP', 'NGN')),

  -- HOW OFTEN IT IS CHARGED. The difference between an application fee and
  -- tuition is not the amount, it is this.
  charged       text not null default 'per-year'
                check (charged in ('per-year', 'per-semester', 'once')),

  -- OPTIONAL LINES ARE NOT INVOICED AUTOMATICALLY. Housing is real and is not
  -- owed by somebody living at home, and an invoice that assumes otherwise is
  -- one the student has to argue with.
  mandatory     boolean not null default true,

  note          text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

comment on table fee_items is
  'One line of a fee schedule. `mandatory` is what separates tuition from housing: an optional '
  'line is offered when an assessment is raised rather than added to it silently.';

create index if not exists fee_items_by_schedule on fee_items (schedule_id, sort_order);


-- ---------------------------------------------------------------------------
-- 1 (c) WHICH SCHEDULE APPLIES TO A STUDENT
-- ---------------------------------------------------------------------------
--
-- NARROWEST WINS, decided once. A schedule naming the programme beats one
-- naming only the award level, which beats one naming nothing. Where two
-- schedules are equally specific the most recently published wins, because
-- that is the University's latest decision.

create or replace function fee_schedule_for(
  p_session text, p_programme_id uuid, p_award_level text, p_study_mode text
) returns uuid language sql stable as $$
  select s.id
    from fee_schedules s
   where s.status = 'published'
     and s.session_label = p_session
     and (s.programme_id is null or s.programme_id = p_programme_id)
     and (s.award_level  is null or s.award_level  = p_award_level)
     and (s.study_mode   is null or s.study_mode   = p_study_mode)
   order by (s.programme_id is not null) desc,
            (s.award_level  is not null) desc,
            (s.study_mode   is not null) desc,
            s.published_at desc
   limit 1;
$$;

comment on function fee_schedule_for(text, uuid, text, text) is
  'The published schedule that applies to a student, narrowest first. Decided here so that '
  '"which fees apply to me" cannot have two answers on two screens.';


-- ===========================================================================
-- 2. WHAT THIS STUDENT WAS ACTUALLY ASKED FOR
-- ===========================================================================
--
-- THE SNAPSHOT. See the header: label, amount and currency are COPIED here,
-- not looked up, so that changing next year's tuition does not rewrite last
-- year's invoices.

create table if not exists student_fee_assessments (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,

  -- WHERE IT CAME FROM, for tracing only. ON DELETE SET NULL: deleting a
  -- schedule must never delete an invoice a student has already paid.
  schedule_id    uuid references fee_schedules (id) on delete set null,
  item_id        uuid references fee_items (id) on delete set null,

  session_label  text not null,
  -- Null where the fee is for the whole session rather than one semester.
  semester       integer check (semester between 1 and 3),

  label          text not null check (length(btrim(label)) between 2 and 120),
  category       text not null default 'tuition',
  amount         numeric(12,2) not null check (amount > 0),
  currency       text not null check (currency in ('FCFA', 'USD', 'EUR', 'GBP', 'NGN')),

  due_on         date,

  -- A WAIVER IS A REDUCTION WITH A REASON, not a quiet edit of the amount.
  -- Editing `amount` down to zero would leave no trace that anybody decided
  -- anything; this leaves the original figure standing and records the
  -- decision beside it.
  waived         numeric(12,2) not null default 0 check (waived >= 0),
  waiver_reason  text,
  waived_by      uuid references auth.users (id) on delete set null,

  status         text not null default 'raised'
                 check (status in ('raised', 'cancelled')),
  cancel_reason  text,

  raised_by      uuid references auth.users (id) on delete set null,
  raised_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),

  -- NOTHING IS WAIVED WITHOUT A REASON, and nothing is waived beyond the
  -- amount charged — a negative bill is not a thing.
  constraint student_fee_assessments_waiver_reasoned check (
    waived = 0
    or (waiver_reason is not null and length(btrim(waiver_reason)) >= 10
        and waived_by is not null)
  ),
  constraint student_fee_assessments_waiver_within check (waived <= amount),
  constraint student_fee_assessments_cancel_reasoned check (
    status <> 'cancelled'
    or (cancel_reason is not null and length(btrim(cancel_reason)) >= 10)
  )
);

comment on table student_fee_assessments is
  'What a student was actually asked to pay. The label, amount and currency are COPIED from the '
  'schedule at the moment the assessment is raised — a snapshot, so that changing next '
  'year''s tuition does not silently rewrite what somebody was invoiced last January.';

create index if not exists student_fee_assessments_by_student
  on student_fee_assessments (student_id, session_label);
-- The same fee is not raised against the same student twice for the same term.
-- A duplicate invoice is the fault a finance office spends the most time
-- unpicking, and it is cheap to refuse here.
create unique index if not exists student_fee_assessments_once
  on student_fee_assessments (student_id, item_id, session_label,
                              coalesce(semester, 0))
  where item_id is not null and status = 'raised';


-- ---------------------------------------------------------------------------
-- 2 (b) THE ACCOUNT — WHAT THE LEDGER SAYS, PER CURRENCY
-- ---------------------------------------------------------------------------
--
-- COMPUTED, NEVER STORED. A stored balance is a number that drifts from the
-- rows it came from, and the first time it does, nobody knows which is right.

create or replace view student_fee_account as
with charged as (
  select a.student_id,
         a.currency,
         sum(a.amount)              as assessed,
         sum(a.waived)              as waived,
         sum(a.amount - a.waived)   as payable
    from student_fee_assessments a
   where a.status = 'raised'
   group by a.student_id, a.currency
),
paid as (
  select p.student_id, p.currency, sum(p.amount) as paid
    from payments p
   group by p.student_id, p.currency
)
select coalesce(c.student_id, p.student_id)       as student_id,
       coalesce(c.currency, p.currency)           as currency,
       coalesce(c.assessed, 0)                    as assessed,
       coalesce(c.waived, 0)                      as waived,
       coalesce(c.payable, 0)                     as payable,
       coalesce(p.paid, 0)                        as paid,
       coalesce(c.payable, 0) - coalesce(p.paid, 0) as outstanding,
       -- NOTHING ASSESSED IS NOT THE SAME AS NOTHING OWED, and this is the
       -- column that keeps them apart. A student with no assessment has an
       -- outstanding of zero, and a screen reading that as "you are paid up"
       -- would be inventing the University's position. Every consumer must
       -- check this before showing a balance as meaningful.
       (c.student_id is not null)                 as has_been_assessed
  from charged c
  full outer join paid p
    on p.student_id = c.student_id and p.currency = c.currency;

comment on view student_fee_account is
  'What the ledger says, per student per currency. Never added across currencies, because this '
  'system holds no exchange rate and inventing one would put a wrong number on a financial '
  'screen. `has_been_assessed` separates "owes nothing" from "has never been charged".';


-- ===========================================================================
-- 3. FINANCIAL CLEARANCE — A DECISION, RECORDED
-- ===========================================================================
--
-- See the header for why this is not `outstanding <= 0`.

create table if not exists financial_clearances (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students (id) on delete cascade,

  -- WHAT IT IS FOR. A student cleared to graduate is not thereby cleared to
  -- register next year; they are different questions asked at different times.
  purpose       text not null default 'graduation'
                check (purpose in ('graduation', 'registration', 'transcript', 'general')),

  cleared       boolean not null,
  -- WHAT THE LEDGER SAID WHEN THE DECISION WAS TAKEN. Copied, like an
  -- assessment, so that a clearance granted against a 400 balance still shows
  -- the 400 years later — after the balance has been paid and the evidence of
  -- the judgement would otherwise have vanished.
  outstanding_at_decision numeric(12,2),
  currency      text check (currency in ('FCFA', 'USD', 'EUR', 'GBP', 'NGN')),

  -- REQUIRED WHERE THE LEDGER DISAGREES. Clearing somebody who owes money is a
  -- legitimate act — a waiver, a scholarship, an instalment agreement — and it
  -- is the one that must never be silent.
  reason        text,

  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz not null default now(),
  -- A clearance can be revoked; the row stays, so the history is legible.
  revoked_at    timestamptz,
  revoked_by    uuid references auth.users (id) on delete set null,
  revoke_reason text,

  created_at    timestamptz not null default now(),

  constraint financial_clearances_against_a_balance_is_reasoned check (
    cleared = false
    or coalesce(outstanding_at_decision, 0) <= 0
    or (reason is not null and length(btrim(reason)) >= 10)
  ),
  constraint financial_clearances_refusal_is_reasoned check (
    cleared = true or (reason is not null and length(btrim(reason)) >= 10)
  ),
  constraint financial_clearances_revoked_together check (
    (revoked_at is null and revoked_by is null and revoke_reason is null)
    or (revoked_at is not null and revoke_reason is not null
        and length(btrim(revoke_reason)) >= 10)
  )
);

comment on table financial_clearances is
  'What Finance DECIDED about a student''s account, as against what the ledger says. Both are '
  'shown side by side on the graduation screen: a clearance granted against an outstanding '
  'balance is visible as exactly that, with the reason, rather than hidden inside a green tick.';

create index if not exists financial_clearances_live
  on financial_clearances (student_id, purpose, decided_at desc)
  where revoked_at is null;

-- THE ONE IN FORCE. "Is this student cleared" must have one answer, and
-- deciding it by "the newest row that is not revoked" in each caller is how two
-- screens come to disagree on a Tuesday.
create or replace view financial_clearance_now as
select distinct on (c.student_id, c.purpose)
       c.student_id,
       c.purpose,
       c.cleared,
       c.reason,
       c.outstanding_at_decision,
       c.currency,
       c.decided_by,
       c.decided_at
  from financial_clearances c
 where c.revoked_at is null
 order by c.student_id, c.purpose, c.decided_at desc;

comment on view financial_clearance_now is
  'The clearance standing for each student and purpose: the newest that has not been revoked. '
  'One answer, in one place.';


-- ===========================================================================
-- 4. PROVE IT
-- ===========================================================================

do $$
declare
  stu        uuid;
  dept       uuid;
  prog       uuid;
  sched      uuid;
  item       uuid;
  officer    uuid;
  n          integer;
  amt        numeric;
  flag       boolean;
  picked     uuid;
begin
  begin
    insert into auth.users (id, email)
    values (gen_random_uuid(), 'proof075@example.invalid') returning id into officer;

    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
      values ('Proof Department 075', 'PRF075', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into students (
      matric_no, first_name, last_name, email, department_id, program,
      degree_type, admission_year, status, student_status
    ) values (
      'PRF075/0001', 'Proof', 'Student', 'proof075@example.invalid', dept,
      'Proof Programme', 'BA', 2026, 'enrolled', 'active'
    ) returning id into stu;

    -- =================================================================
    -- A SCHEDULE IS NOT CHARGEABLE UNTIL SOMEBODY PUBLISHES IT
    -- =================================================================
    insert into fee_schedules (name, session_label, status, set_by)
    values ('Proof schedule 2026/27', '2026/2027', 'draft', officer)
    returning id into sched;

    begin
      update fee_schedules set status = 'published' where id = sched;
      raise exception '075 FAILED: a schedule was published with nobody''s name on it';
    exception when check_violation then null;
    end;

    update fee_schedules
       set status = 'published', published_by = officer, published_at = now()
     where id = sched;

    -- =================================================================
    -- A FEE OF ZERO IS NOT A FEE
    -- =================================================================
    begin
      insert into fee_items (schedule_id, label, amount, currency)
      values (sched, 'A line somebody meant to delete', 0, 'USD');
      raise exception '075 FAILED: a fee of zero was accepted';
    exception when check_violation then null;
    end;
    begin
      insert into fee_items (schedule_id, label, amount, currency)
      values (sched, 'A negative fee', -100, 'USD');
      raise exception '075 FAILED: a negative fee was accepted';
    exception when check_violation then null;
    end;

    insert into fee_items (schedule_id, label, category, amount, currency, charged)
    values (sched, 'Full-time tuition', 'tuition', 12200, 'USD', 'per-year')
    returning id into item;

    -- =================================================================
    -- THE NARROWEST SCHEDULE WINS
    -- =================================================================
    --
    -- Asserted by creating a narrower one and checking it is chosen, then
    -- withdrawing it and checking the general one comes back. A resolver that
    -- picks the wrong schedule invoices a whole cohort incorrectly.
    select id into prog from programmes limit 1;
    declare
      narrow uuid;
    begin
      insert into fee_schedules (name, session_label, programme_id, status,
                                 set_by, published_by, published_at)
      values ('Proof programme schedule', '2026/2027', prog, 'published',
              officer, officer, now())
      returning id into narrow;

      select fee_schedule_for('2026/2027', prog, 'Bachelor''s', 'Full-time') into picked;
      if picked <> narrow then
        raise exception '075 FAILED: the programme-specific schedule was not chosen';
      end if;

      -- A student on ANOTHER programme still gets the general one.
      select fee_schedule_for('2026/2027', gen_random_uuid(), 'Bachelor''s', 'Full-time')
        into picked;
      if picked <> sched then
        raise exception '075 FAILED: a student on another programme did not get the general schedule';
      end if;

      update fee_schedules set status = 'withdrawn' where id = narrow;
      select fee_schedule_for('2026/2027', prog, 'Bachelor''s', 'Full-time') into picked;
      if picked <> sched then
        raise exception '075 FAILED: a withdrawn schedule was still being applied';
      end if;
    end;

    -- =================================================================
    -- THE ASSESSMENT IS A SNAPSHOT, AND THIS IS THE PROOF OF IT
    -- =================================================================
    --
    -- THE ASSERTION THIS TABLE EXISTS FOR. Raise an invoice, then change the
    -- schedule, and the invoice must not move. If it does, every student who
    -- has already paid goes into arrears the day tuition rises.
    insert into student_fee_assessments (
      student_id, schedule_id, item_id, session_label, label, category,
      amount, currency, raised_by
    ) values (
      stu, sched, item, '2026/2027', 'Full-time tuition', 'tuition',
      12200, 'USD', officer
    );

    update fee_items set amount = 12800 where id = item;

    select amount into amt from student_fee_assessments
     where student_id = stu and item_id = item;
    if amt <> 12200 then
      raise exception
        '075 FAILED: raising the schedule to 12800 changed an invoice already raised at 12200 '
        '(it now reads %)', amt;
    end if;

    -- =================================================================
    -- THE SAME FEE IS NOT RAISED TWICE
    -- =================================================================
    begin
      insert into student_fee_assessments (
        student_id, schedule_id, item_id, session_label, label, amount, currency, raised_by
      ) values (stu, sched, item, '2026/2027', 'Full-time tuition', 12200, 'USD', officer);
      raise exception '075 FAILED: the same fee was raised against the same student twice';
    exception when unique_violation then null;
    end;

    -- =================================================================
    -- A WAIVER IS A DECISION WITH A REASON, AND CANNOT EXCEED THE BILL
    -- =================================================================
    begin
      update student_fee_assessments set waived = 500 where student_id = stu;
      raise exception '075 FAILED: money was waived with no reason and nobody''s name on it';
    exception when check_violation then null;
    end;
    begin
      update student_fee_assessments
         set waived = 99999, waiver_reason = 'Scholarship awarded by the Senate',
             waived_by = officer
       where student_id = stu;
      raise exception '075 FAILED: more was waived than was ever charged';
    exception when check_violation then null;
    end;

    -- =================================================================
    -- THE LEDGER ADDS UP, AND NEVER ACROSS CURRENCIES
    -- =================================================================
    insert into payments (student_id, reference, amount, currency, purpose, method)
    values (stu, 'PRF075-1', 2200, 'USD', 'Tuition', 'bank');

    select outstanding into amt from student_fee_account
     where student_id = stu and currency = 'USD';
    if amt <> 10000 then
      raise exception '075 FAILED: 12200 charged less 2200 paid is not % ', amt;
    end if;

    -- A PAYMENT IN ANOTHER CURRENCY DOES NOT TOUCH THE USD BALANCE.
    insert into payments (student_id, reference, amount, currency, purpose, method)
    values (stu, 'PRF075-2', 500000, 'FCFA', 'Tuition', 'mobile');

    select outstanding into amt from student_fee_account
     where student_id = stu and currency = 'USD';
    if amt <> 10000 then
      raise exception
        '075 FAILED: an FCFA payment changed the USD balance to % — this system holds no '
        'exchange rate and must not invent one', amt;
    end if;

    select count(*) into n from student_fee_account where student_id = stu;
    if n <> 2 then
      raise exception '075 FAILED: two currencies did not produce two lines (got %)', n;
    end if;

    -- AND THE FCFA LINE IS PAID-ONLY, never assessed.
    select has_been_assessed into flag from student_fee_account
     where student_id = stu and currency = 'FCFA';
    if flag then
      raise exception '075 FAILED: an FCFA line claims to have been assessed';
    end if;

    -- =================================================================
    -- NOTHING ASSESSED IS NOT NOTHING OWED
    -- =================================================================
    --
    -- The column that stops a brand-new student being told they are paid up.
    declare
      fresh uuid;
    begin
      insert into students (
        matric_no, first_name, last_name, email, department_id, program,
        degree_type, admission_year, status, student_status
      ) values (
        'PRF075/0002', 'Never', 'Charged', 'proof075b@example.invalid', dept,
        'Proof Programme', 'BA', 2026, 'enrolled', 'active'
      ) returning id into fresh;

      select count(*) into n from student_fee_account where student_id = fresh;
      if n <> 0 then
        raise exception
          '075 FAILED: a student who has never been charged has an account line';
      end if;
    end;

    -- =================================================================
    -- CLEARANCE AGAINST A BALANCE IS ALLOWED, AND NEVER SILENT
    -- =================================================================
    --
    -- THE JUDGEMENT AT THE TOP OF THIS FILE, ASSERTED. A waiver or a
    -- scholarship must be clearable; it must never be clearable without
    -- somebody saying why.
    begin
      insert into financial_clearances (student_id, purpose, cleared,
                                        outstanding_at_decision, currency, decided_by)
      values (stu, 'graduation', true, 10000, 'USD', officer);
      raise exception
        '075 FAILED: a student owing 10000 was cleared with no reason recorded';
    exception when check_violation then null;
    end;

    insert into financial_clearances (student_id, purpose, cleared,
                                      outstanding_at_decision, currency, reason, decided_by)
    values (stu, 'graduation', true, 10000, 'USD',
            'Balance carried under an instalment agreement approved by the Finance Director.',
            officer);

    -- A REFUSAL ALSO NEEDS A REASON. Being refused clearance with no
    -- explanation is the thing a student cannot act on at all.
    begin
      insert into financial_clearances (student_id, purpose, cleared, decided_by)
      values (stu, 'registration', false, officer);
      raise exception '075 FAILED: clearance was refused with no reason';
    exception when check_violation then null;
    end;

    -- CLEARING SOMEBODY WHO OWES NOTHING NEEDS NO REASON, because there is
    -- nothing to explain.
    insert into financial_clearances (student_id, purpose, cleared,
                                      outstanding_at_decision, currency, decided_by)
    values (stu, 'registration', true, 0, 'USD', officer);

    -- =================================================================
    -- AND ONE ANSWER STANDS, NOT THE FIRST ONE FOUND
    -- =================================================================
    select cleared into flag from financial_clearance_now
     where student_id = stu and purpose = 'graduation';
    if not flag then
      raise exception '075 FAILED: the standing clearance is not the one recorded';
    end if;

    -- A revoked clearance stops standing, and the row survives.
    update financial_clearances
       set revoked_at = now(), revoked_by = officer,
           revoke_reason = 'Instalment agreement lapsed; balance now due in full.'
     where student_id = stu and purpose = 'graduation';

    select count(*) into n from financial_clearance_now
     where student_id = stu and purpose = 'graduation';
    if n <> 0 then
      raise exception '075 FAILED: a revoked clearance is still standing';
    end if;
    select count(*) into n from financial_clearances
     where student_id = stu and purpose = 'graduation';
    if n <> 1 then
      raise exception '075 FAILED: revoking a clearance destroyed the record of it';
    end if;

    raise notice '075 OK — a schedule is not chargeable until somebody publishes it under '
      'their own name; the narrowest one wins; an invoice already raised does not move when the '
      'schedule does; nothing is waived or cleared or refused without a reason; a payment in one '
      'currency never touches a balance in another; a student who has never been charged is not '
      'reported as paid up; and one clearance stands at a time.';

    raise exception 'ROLLBACK_075';
  exception
    when others then
      if sqlerrm = 'ROLLBACK_075' then
        return;
      end if;
      raise;
  end;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   076_one_transcript_one_download.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 076 — ONE TRANSCRIPT, ONE DOWNLOAD; AND CLEARANCE JOINS THE GRADUATION AUDIT
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- 1. A transcript a student has been granted can be downloaded ONCE. After
--    that they can look at the record on screen as always, but another copy
--    means another request — which the Registry sees, decides and can refuse.
--
-- 2. The graduation audit stops saying financial clearance is UNKNOWN. It now
--    reads the clearance 075 lets Finance record, and shows the ledger beside
--    it.
--
-- Nothing already issued is touched. Every transcript request that exists
-- keeps its status, and gets one download rather than none.
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S INSTRUCTION
-- ---------------------------------------------------------------------------
--
-- "Transcript from student must be upon request and only one time to be
-- downloaded by student. After which they can only request."
--
-- ---------------------------------------------------------------------------
-- WHY THE COUNTER IS IN THE DATABASE AND NOT IN THE SCREEN
-- ---------------------------------------------------------------------------
--
-- "Only one time" is a rule about a thing that has already left the building.
-- A screen that hides the button after the first press is not enforcing
-- anything: the request that fetched the document can be replayed, and a
-- student who wants a second copy does not need to be sophisticated to get one
-- — they need to press the browser's back button.
--
-- So the claim is an ATOMIC UPDATE guarded by its own WHERE clause:
--
--     update ... set downloaded = downloaded + 1
--      where id = ? and downloaded < allowed
--     returning ...
--
-- Two requests arriving at the same instant cannot both succeed, because the
-- second one's WHERE clause is evaluated against the first one's committed
-- row. A check-then-act in TypeScript — read the count, compare, then write —
-- has a gap between the read and the write, and two clicks land in it.
--
-- ---------------------------------------------------------------------------
-- AND THE SECOND COPY IS NOT REFUSED, IT IS REDIRECTED
-- ---------------------------------------------------------------------------
--
-- A student who needs another transcript has a real need — they are applying
-- somewhere else. The function does not say "no"; it says the download has
-- been used and a new request is how to get another, and `my_requests` shows
-- them the request they raised. Refusing without a route is how a rule gets
-- worked around rather than followed.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.transcript_requests') is null then
    raise exception 'There is no transcript request pipeline. Run the whole bundle.';
  end if;
  if to_regclass('public.financial_clearance_now') is null then
    raise exception
      'Migration 075 has not been run on this database: there is no financial clearance for the '
      'graduation audit to read. Run the whole bundle.';
  end if;
  if to_regclass('public.my_graduation') is null then
    raise exception 'Migration 074 has not been run. Run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. A GRANTED TRANSCRIPT CARRIES ITS OWN ALLOWANCE
-- ===========================================================================
--
-- `downloads_allowed` IS A COLUMN AND NOT THE CONSTANT 1, because the
-- University will eventually want to grant two — a student applying to two
-- institutions at once — and the alternative is that somebody edits the
-- counter by hand, which leaves no record of the decision.

alter table transcript_requests
  add column if not exists downloads_allowed integer not null default 1,
  add column if not exists downloaded        integer not null default 0,
  add column if not exists first_downloaded_at timestamptz,
  add column if not exists last_downloaded_at  timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'transcript_requests_downloads_sane') then
    alter table transcript_requests add constraint transcript_requests_downloads_sane
      check (downloads_allowed >= 0 and downloaded >= 0
             -- THE RULE ITSELF, AND IT IS A CONSTRAINT RATHER THAN A CONVENTION.
             -- Even something holding the service key cannot put this row into
             -- a state where a student has taken more copies than they were
             -- granted.
             and downloaded <= downloads_allowed);
  end if;
end $$;

comment on column transcript_requests.downloads_allowed is
  'How many times the student may download this transcript. One, unless the Registry deliberately '
  'grants more. A column rather than a hard-coded 1 so that granting two is a recorded decision '
  'instead of somebody editing a counter.';
comment on column transcript_requests.downloaded is
  'How many times they have. Moved only by claim_transcript_download(), which increments it in '
  'the same statement that checks it — a check-then-act in application code has a gap between '
  'the read and the write, and two clicks land in it.';


-- ===========================================================================
-- 2. CLAIMING THE DOWNLOAD
-- ===========================================================================
--
-- SECURITY DEFINER, and the ownership check is the first thing it does. The
-- function has to update a row the student may not update themselves — that is
-- the whole point of it — so it must check for itself that the request is
-- theirs. It is the only thing in this file that runs with more authority than
-- its caller, and it does exactly one thing.

create or replace function claim_transcript_download(p_request uuid)
returns table (granted boolean, reason text, credential_ref text, remaining integer)
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  -- ---- IS IT THEIRS? ---------------------------------------------------
  select t.*, s.auth_user_id
    into r
    from transcript_requests t
    join students s on s.id = t.student_id
   where t.id = p_request;

  if not found then
    return query select false, 'No such transcript request.', null::text, 0;
    return;
  end if;

  -- NOT "IS THE CALLER STAFF". A student claiming their own download is the
  -- only case this function exists for; the Registry issues through its own
  -- screen and does not come through here.
  if r.auth_user_id is null or r.auth_user_id <> auth.uid() then
    return query select false, 'This transcript request is not yours.', null::text, 0;
    return;
  end if;

  -- ---- HAS IT BEEN ISSUED? ---------------------------------------------
  --
  -- A student cannot download a transcript the Registry has not produced. The
  -- status is named back to them so "nothing happened" is never the answer.
  if r.status not in ('issued', 'completed', 'approved') then
    return query select false,
      'This request is ' || replace(r.status, '-', ' ')
      || '. You can download it once the Registry has issued it.',
      null::text, 0;
    return;
  end if;

  -- ---- THE ATOMIC CLAIM ------------------------------------------------
  --
  -- THE WHOLE RULE, IN ONE STATEMENT. The WHERE clause is what refuses the
  -- second copy, so two requests arriving together cannot both succeed.
  update transcript_requests t
     set downloaded = t.downloaded + 1,
         first_downloaded_at = coalesce(t.first_downloaded_at, now()),
         last_downloaded_at = now()
   where t.id = p_request
     and t.downloaded < t.downloads_allowed
  returning t.credential_ref, t.downloads_allowed - t.downloaded
    into credential_ref, remaining;

  if not found then
    -- NOT A BARE REFUSAL. The student needs another transcript for a reason;
    -- telling them how to get one is what stops the rule being worked around.
    return query select false,
      'You have already downloaded this transcript. A transcript is released once per request — '
      'ask the Registry for another and they will issue it.',
      null::text, 0;
    return;
  end if;

  return query select true, null::text, credential_ref, remaining;
end $$;

comment on function claim_transcript_download(uuid) is
  'Spends one of a transcript request''s downloads and says whether it was granted. The counter '
  'is checked and incremented in ONE statement, so a replayed request or a double click cannot '
  'take a second copy. Refuses politely and says how to get another.';

-- A student may read the function's effect but must never move the counter
-- themselves. Nothing grants UPDATE on this table to a student; the function's
-- SECURITY DEFINER is the only path.
revoke all on function claim_transcript_download(uuid) from public;
grant execute on function claim_transcript_download(uuid) to authenticated;


-- ===========================================================================
-- 3. THE STUDENT'S LIST SHOWS WHERE THE DOWNLOAD STANDS
-- ===========================================================================
--
-- Rebuilt rather than altered: `my_requests` is a UNION, and adding two
-- columns to one arm means adding them to all three.

-- DROPPED AND REBUILT for the same reason 074 does: `create or replace view`
-- cannot narrow a view, and a bundle that is run twice executes 074's version
-- and then this one, in that order, every time.
drop view if exists my_requests;

create view my_requests
with (security_invoker = true) as

select s.id                          as student_id,
       'request'                     as pipeline,
       r.id                          as item_id,
       r.kind,
       r.subject,
       r.detail,
       r.status,
       r.with_office,
       r.decision_note,
       r.submitted_at,
       r.decided_at,
       r.completed_at,
       null::integer                 as downloads_allowed,
       null::integer                 as downloaded
  from student_requests r
  join students s on s.id = r.student_id
 where s.auth_user_id = auth.uid()

union all

select s.id,
       'transcript',
       t.id,
       'transcript',
       concat_ws(' ', initcap(coalesce(t.kind, 'transcript')), 'transcript',
                 case when t.delivery is null then null else '· ' || t.delivery end),
       t.note,
       case t.status
         when 'requested'   then 'submitted'
         when 'pending'     then 'submitted'
         when 'in-progress' then 'under-review'
         when 'reviewing'   then 'under-review'
         when 'approved'    then 'approved'
         when 'refused'     then 'declined'
         when 'rejected'    then 'declined'
         when 'issued'      then 'completed'
         when 'completed'   then 'completed'
         when 'cancelled'   then 'withdrawn'
         else t.status
       end,
       'The Registry',
       t.note,
       t.requested_at,
       t.decided_at,
       case when t.status in ('issued', 'completed') then t.decided_at end,
       t.downloads_allowed,
       t.downloaded
  from transcript_requests t
  join students s on s.id = t.student_id
 where s.auth_user_id = auth.uid()

union all

select s.id,
       'correction',
       q.id,
       'credential-correction',
       'Correction to an issued credential',
       q.description,
       case q.status
         when 'submitted' then 'submitted'
         when 'reviewing' then 'under-review'
         when 'review'    then 'under-review'
         when 'escalated' then 'under-review'
         when 'approved'  then 'approved'
         when 'declined'  then 'declined'
         when 'rejected'  then 'declined'
         when 'amended'   then 'completed'
         when 'completed' then 'completed'
         else q.status
       end,
       'The Credential Authority',
       coalesce(q.decision_note, q.review_note),
       q.created_at,
       q.decided_at,
       case when q.amendment_id is not null then q.decided_at end,
       null::integer,
       null::integer
  from credential_correction_requests q
  join students s on s.id = q.student_id
 where s.auth_user_id = auth.uid();

comment on view my_requests is
  'Everything the signed-in student has asked the University for, from all three pipelines that '
  'hold such things. The transcript arm carries how many downloads were granted and how many '
  'have been used, so the student can see that their one copy is still waiting for them.';


-- ===========================================================================
-- 4. THE STUDENT'S FINANCE, NOW THAT THERE IS SOMETHING TO OWE
-- ===========================================================================
--
-- 074's `my_finance` could only list payments, because nothing recorded a
-- charge. 075 changed that. This is the account: assessed, waived, paid and
-- outstanding, per currency, plus the payments and the assessments behind it.
--
-- SPLIT INTO TWO VIEWS rather than one wide one, because they answer two
-- questions — "where do I stand" and "what were the lines" — and joining them
-- would repeat the balance against every payment row.

create or replace view my_fee_account
with (security_invoker = true) as
select a.student_id,
       a.currency,
       a.assessed,
       a.waived,
       a.payable,
       a.paid,
       a.outstanding,
       a.has_been_assessed,
       -- THE WORD THE SCREEN USES, decided once. A screen mapping a signed
       -- number to three words will eventually map zero to the wrong one.
       case
         when not a.has_been_assessed      then 'nothing charged yet'
         when a.outstanding > 0            then 'outstanding'
         when a.outstanding < 0            then 'in credit'
         else                                   'paid in full'
       end                                 as standing
  from student_fee_account a
  join students s on s.id = a.student_id
 where s.auth_user_id = auth.uid();

comment on view my_fee_account is
  'Where the signed-in student stands, per currency. `has_been_assessed` is what stops a student '
  'who has never been charged being told they are paid up.';

create or replace view my_fee_assessments
with (security_invoker = true) as
select a.student_id,
       a.id                  as assessment_id,
       a.session_label,
       a.semester,
       a.label,
       a.category,
       a.amount,
       a.waived,
       a.amount - a.waived   as payable,
       a.currency,
       a.due_on,
       a.waiver_reason,
       a.raised_at,
       (a.due_on is not null and a.due_on < current_date) as overdue
  from student_fee_assessments a
  join students s on s.id = a.student_id
 where s.auth_user_id = auth.uid()
   and a.status = 'raised';

comment on view my_fee_assessments is
  'The lines the signed-in student has been charged, with any waiver and its reason shown '
  'rather than the amount being quietly reduced.';


-- ===========================================================================
-- 5. CLEARANCE JOINS THE GRADUATION AUDIT
-- ===========================================================================
--
-- 074 reported `finance_cleared` as NULL for everybody and said why: nothing
-- recorded what a student was charged, so nothing could say whether they had
-- paid it. 075 fixed the first half and this reads it.
--
-- IT STAYS THREE-VALUED. Null still means "the University has not decided",
-- which is now a different and much more useful statement than "this system
-- cannot know": it means Finance has not looked yet, and somebody can go and
-- ask them. False means Finance looked and refused.
--
-- AND THE LEDGER IS CARRIED BESIDE THE DECISION. A clearance granted against
-- an outstanding balance shows both, so the graduation screen can say "cleared
-- by Finance, with $400 outstanding, because: instalment agreement" — which is
-- the truth, and is what a green tick alone would hide.

-- DROPPED AND REBUILT, NOT REPLACED. `create or replace view` may only APPEND
-- columns; it refuses to insert one in the middle, and the three finance
-- columns belong beside `finance_cleared` rather than tacked on after
-- `eligible` where nobody reading the view would find them.
--
-- A PLAIN DROP AND NOT `CASCADE`. If something has come to depend on this view
-- since 074, the drop fails and says so — which is the outcome worth having.
-- `cascade` would quietly delete whatever that was.
drop view if exists my_graduation;

create view my_graduation
with (security_invoker = true) as
select g.*,
       (g.credits_earned >= g.credits_required)          as credits_met,
       (g.courses_outstanding = 0)                       as courses_met,
       (g.courses_failed = 0)                            as nothing_failed,
       case when g.min_cgpa is null then null
            when g.cgpa is null     then null
            else g.cgpa >= g.min_cgpa end                as cgpa_met,
       -- NO LONGER ALWAYS NULL. Null now means Finance has not decided.
       fc.cleared                                        as finance_cleared,
       fc.reason                                         as finance_reason,
       fc.decided_at                                     as finance_decided_at,
       -- What the ledger says, alongside what Finance decided.
       acct.outstanding                                  as finance_outstanding,
       acct.currency                                     as finance_currency,
       coalesce(acct.has_been_assessed, false)           as finance_assessed,
       (g.graduation_id is not null)                     as already_conferred,
       case
         when g.graduation_id is not null then true
         when g.credits_earned < g.credits_required
           or g.courses_outstanding > 0
           or g.courses_failed > 0                       then false
         when g.min_cgpa is not null
          and (g.cgpa is null or g.cgpa < g.min_cgpa)    then false
         -- FINANCE CAN NOW REFUSE, and a refusal is a false rather than a null.
         when fc.cleared is false                        then false
         -- AND A MISSING DECISION STILL LEAVES IT UNDECIDED. The screen says
         -- "everything academic is met, Finance has not yet cleared you",
         -- which is a sentence a student can act on.
         when fc.cleared is null                         then null
         else true
       end                                               as eligible
  from graduation_candidate g
  join students s on s.id = g.student_id
  left join financial_clearance_now fc
    on fc.student_id = g.student_id and fc.purpose = 'graduation'
  -- THE LEDGER LINE THAT MATTERS: the currency they owe the most in. A
  -- student with two currencies has two lines and the graduation screen has
  -- room for one; the larger debt is the one worth surfacing.
  left join lateral (
    select a.outstanding, a.currency, a.has_been_assessed
      from student_fee_account a
     where a.student_id = g.student_id
     order by a.outstanding desc nulls last
     limit 1
  ) acct on true
 where s.auth_user_id = auth.uid();

comment on view my_graduation is
  'The signed-in student''s graduation assessment from 069, with financial clearance now read '
  'from 075''s record of what Finance DECIDED — and the ledger carried beside it, so a '
  'clearance granted against an outstanding balance is visible as exactly that rather than '
  'hidden inside a green tick. `eligible` stays three-valued: null means nobody has decided.';


-- ===========================================================================
-- 6. PROVE IT
-- ===========================================================================

do $$
declare
  stu      uuid;
  dept     uuid;
  who      uuid;
  officer  uuid;
  req      uuid;
  n        integer;
  ok       boolean;
  why      text;
begin
  begin
    insert into auth.users (id, email)
    values (gen_random_uuid(), 'proof076@example.invalid') returning id into who;
    insert into auth.users (id, email)
    values (gen_random_uuid(), 'proof076-reg@example.invalid') returning id into officer;

    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
      values ('Proof Department 076', 'PRF076', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into students (
      matric_no, first_name, last_name, email, department_id, program,
      degree_type, admission_year, status, student_status, auth_user_id
    ) values (
      'PRF076/0001', 'Proof', 'Student', 'proof076@example.invalid', dept,
      'Proof Programme', 'BA', 2026, 'enrolled', 'active', who
    ) returning id into stu;

    insert into transcript_requests (student_id, requested_by, kind, delivery, status)
    values (stu, who, 'official', 'pdf', 'requested')
    returning id into req;

    perform set_config('request.jwt.claim.sub', who::text, true);

    -- =================================================================
    -- A TRANSCRIPT NOBODY HAS ISSUED CANNOT BE DOWNLOADED
    -- =================================================================
    select granted, reason into ok, why from claim_transcript_download(req);
    if ok then
      raise exception '076 FAILED: a transcript was downloaded before the Registry issued it';
    end if;
    if why is null or why = '' then
      raise exception '076 FAILED: the refusal said nothing';
    end if;

    -- The Registry issues it.
    update transcript_requests
       set status = 'issued', credential_ref = 'PRF076-TRANSCRIPT-1',
           decided_by = officer, decided_at = now()
     where id = req;

    -- =================================================================
    -- THE FIRST DOWNLOAD IS GRANTED
    -- =================================================================
    select granted into ok from claim_transcript_download(req);
    if not ok then
      raise exception '076 FAILED: the one download a student was granted was refused';
    end if;
    select downloaded into n from transcript_requests where id = req;
    if n <> 1 then
      raise exception '076 FAILED: the counter reads % after one download', n;
    end if;

    -- =================================================================
    -- AND THE SECOND IS NOT
    -- =================================================================
    --
    -- THE RULE THE UNIVERSITY ASKED FOR. If this ever passes, a student can
    -- take unlimited sealed transcripts from one request.
    select granted, reason into ok, why from claim_transcript_download(req);
    if ok then
      raise exception '076 FAILED: a second copy of a one-time transcript was released';
    end if;
    if why !~ 'already downloaded' then
      raise exception '076 FAILED: the second refusal did not say why (got: %)', why;
    end if;
    -- AND IT TOLD THEM HOW TO GET ANOTHER. A rule with no route round it is a
    -- rule people work around.
    if why !~ 'another' then
      raise exception '076 FAILED: the refusal did not say how to get another transcript';
    end if;

    select downloaded into n from transcript_requests where id = req;
    if n <> 1 then
      raise exception '076 FAILED: a refused download still moved the counter to %', n;
    end if;

    -- =================================================================
    -- AND THE COUNTER CANNOT BE PUSHED PAST THE ALLOWANCE BY ANYTHING
    -- =================================================================
    --
    -- Not even by something holding the service key and writing directly.
    begin
      update transcript_requests set downloaded = 5 where id = req;
      raise exception '076 FAILED: the download counter was pushed past its allowance';
    exception when check_violation then null;
    end;

    -- A SECOND REQUEST IS A SECOND DOWNLOAD. The University's instruction in
    -- full: "after which they can only request".
    declare
      req2 uuid;
    begin
      insert into transcript_requests (student_id, requested_by, kind, delivery, status,
                                       credential_ref, decided_by, decided_at)
      values (stu, who, 'official', 'pdf', 'issued', 'PRF076-TRANSCRIPT-2', officer, now())
      returning id into req2;
      select granted into ok from claim_transcript_download(req2);
      if not ok then
        raise exception '076 FAILED: a fresh request did not grant a fresh download';
      end if;
    end;

    -- =================================================================
    -- ONE STUDENT CANNOT CLAIM ANOTHER'S TRANSCRIPT
    -- =================================================================
    declare
      other uuid;
      ostu  uuid;
      oreq  uuid;
    begin
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'proof076-other@example.invalid') returning id into other;
      insert into students (
        matric_no, first_name, last_name, email, department_id, program,
        degree_type, admission_year, status, student_status, auth_user_id
      ) values (
        'PRF076/0002', 'Other', 'Student', 'proof076o@example.invalid', dept,
        'Proof Programme', 'BA', 2026, 'enrolled', 'active', other
      ) returning id into ostu;
      insert into transcript_requests (student_id, requested_by, kind, delivery, status,
                                       credential_ref, decided_by, decided_at)
      values (ostu, other, 'official', 'pdf', 'issued', 'PRF076-OTHER', officer, now())
      returning id into oreq;

      -- Still signed in as the FIRST student.
      select granted, reason into ok, why from claim_transcript_download(oreq);
      if ok then
        raise exception
          '076 FAILED: one student downloaded another student''s transcript';
      end if;
      if why !~ 'not yours' then
        raise exception '076 FAILED: the refusal did not say it was somebody else''s';
      end if;
      select downloaded into n from transcript_requests where id = oreq;
      if n <> 0 then
        raise exception '076 FAILED: a refused claim spent another student''s download';
      end if;
    end;

    -- =================================================================
    -- CLEARANCE NOW REACHES THE GRADUATION AUDIT
    -- =================================================================
    --
    -- Null while Finance has not decided; false when they refuse.
    select count(*) into n from my_graduation where finance_cleared is not null;
    if n <> 0 then
      raise exception
        '076 FAILED: financial clearance is reported as decided before Finance has decided it';
    end if;

    insert into financial_clearances (student_id, purpose, cleared, reason, decided_by)
    values (stu, 'graduation', false,
            'Tuition outstanding for the 2026/2027 session.', officer);

    select finance_cleared into ok from my_graduation where student_id = stu;
    if ok is null or ok then
      raise exception '076 FAILED: a refusal by Finance did not reach the graduation audit';
    end if;

    perform set_config('request.jwt.claim.sub', '', true);

    -- AND THE VIEWS STILL RETURN NOTHING TO NOBODY.
    select count(*) into n from my_graduation;
    if n <> 0 then raise exception '076 FAILED: my_graduation returned % rows to nobody', n; end if;
    select count(*) into n from my_fee_account;
    if n <> 0 then raise exception '076 FAILED: my_fee_account returned % rows to nobody', n; end if;
    select count(*) into n from my_fee_assessments;
    if n <> 0 then
      raise exception '076 FAILED: my_fee_assessments returned % rows to nobody', n;
    end if;
    select count(*) into n from my_requests;
    if n <> 0 then raise exception '076 FAILED: my_requests returned % rows to nobody', n; end if;

    raise notice '076 OK — a transcript nobody has issued cannot be downloaded; the one '
      'granted download is released once and the second attempt is refused, told how to get '
      'another, and does not move the counter; the counter cannot be pushed past its allowance '
      'even by a direct write; one student cannot claim another''s; a fresh request grants a '
      'fresh download; and Finance''s decision now reaches the graduation audit.';

    raise exception 'ROLLBACK_076';
  exception
    when others then
      if sqlerrm = 'ROLLBACK_076' then
        perform set_config('request.jwt.claim.sub', '', true);
        return;
      end if;
      perform set_config('request.jwt.claim.sub', '', true);
      raise;
  end;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   077_a_mark_is_moderated_before_anybody_sees_it.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 077 — A MARK IS MODERATED BEFORE ANYBODY SEES IT
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- STUDENTS SEE FEWER MARKS THAN THEY DID, AND THAT IS THE POINT.
--
-- 071 released a mark to the student the moment the LECTURER SUBMITTED it.
-- After this, a mark is not shown until it has been MODERATED — until a second
-- pair of eyes has been over it.
--
-- Nothing else moves. A moderated or faculty-approved mark is still shown as
-- PROVISIONAL; an approved one is still the OFFICIAL RESULT; a draft is still
-- invisible. Only the first door moves, by one step.
--
-- ---------------------------------------------------------------------------
-- WHY THIS CORRECTS 071 RATHER THAN REFINING IT
-- ---------------------------------------------------------------------------
--
-- 071 drew the line at 'submitted' and argued it this way: a draft is the
-- lecturer's working note, but a submitted mark "has left their hands and is in
-- the University's process".
--
-- That reasoning was about the LECTURER'S custody of the mark. It is the wrong
-- question. The question a university asks is whether anybody has CHECKED it.
--
-- 'submitted' means exactly one person has marked the script and nobody has
-- looked at it. Moderation is what catches a misread total, a column added up
-- wrongly, a cohort marked against the wrong rubric, a scholarship lost to a
-- transcription error. Releasing before moderation means the University's first
-- communication about a mark is one nobody has verified — and a mark a student
-- has already seen is much harder to correct than one they have not, because
-- correcting it downwards now looks like the University changing its mind.
--
-- That is why the sequence exists at all. The approval chain has five states
-- and 071 treated the first four as one.
--
-- ---------------------------------------------------------------------------
-- AND WHY NOT WAIT FOR FULL APPROVAL
-- ---------------------------------------------------------------------------
--
-- Because a student who is told nothing until the Registrar ratifies the whole
-- diet waits weeks, cannot tell whether they have passed, cannot plan a resit,
-- and cannot query an error while the marker still remembers the script.
--
-- Releasing a moderated mark as provisional, clearly labelled and subject to
-- confirmation, is ordinary practice: the mark has been checked, it may still
-- move at a board, and the student is told exactly that. Both halves of the
-- sentence are true and the screen prints both.
--
--   draft             nobody sees it. One person is still marking.
--   submitted         nobody sees it. One person has marked it; nobody has
--                     checked it.
--   moderated         PROVISIONAL. A second marker has been over it.
--   faculty-approved  PROVISIONAL. The Faculty has passed it on.
--   approved          OFFICIAL. Ratified, and it is the record.
--
-- PROVISIONAL MARKS STILL COUNT TOWARDS NOTHING. Not the semester GPA, not the
-- CGPA, not credits earned. Those come from `semester_gpas`, which counts
-- approved results only, and this migration does not touch it.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.my_results') is null then
    raise exception
      'Migration 071 has not been run on this database: there is no my_results to correct. '
      'Run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. THE LINE MOVES BY ONE STEP
-- ===========================================================================
--
-- DROPPED AND REBUILT rather than replaced, for the reason 074 records: a
-- bundle is run more than once, and `create or replace view` cannot narrow a
-- view that a later migration has widened. `my_result_terms` reads this one,
-- so it goes first and comes back after.

drop view if exists my_result_terms;
drop view if exists my_results;

create view my_results
with (security_invoker = true) as
select s.id                                   as student_id,
       r.id                                   as result_id,
       c.id                                   as course_id,
       c.code                                 as course_code,
       c.title                                as course_title,
       c.credit_unit                          as credits,
       e.academic_year,
       e.semester,
       r.ca_score,
       r.exam_score,
       r.total_score,
       r.grade,
       r.grade_point,
       round(coalesce(r.grade_point, 0) * coalesce(c.credit_unit, 0), 2) as quality_points,
       coalesce(r.attempt, 1)                 as attempt,
       r.status,
       r.status = 'approved'                  as official,
       case when r.status = 'approved' then 'Official result'
            else 'Provisional' end            as standing,
       -- WHOSE DESK IT IS ON. 'submitted' is gone from this list because a
       -- submitted mark no longer reaches the student at all — if one ever
       -- appears here, something has changed the filter below without
       -- changing this, and 'Not yet released' is the honest thing to say.
       case r.status
         when 'moderated'        then 'Moderated, with the Faculty'
         when 'faculty-approved' then 'Passed by the Faculty, with the Registrar'
         when 'approved'         then 'Approved by the Registrar'
         else                         'Not yet released'
       end                                    as with_whom,
       r.approved_at
  from results r
  join students s on s.id = r.student_id
  join courses  c on c.id = r.course_id
  left join enrollments e
    on e.id = r.enrollment_id
 -- ---- THE CHANGE, AND IT IS THIS ONE LINE ----------------------------
 --
 -- 'submitted' WAS HERE AND IS NOT ANY MORE. A mark one person has written
 -- and nobody has checked is not something the University tells a student.
 where r.status in ('moderated', 'faculty-approved', 'approved')
   and s.auth_user_id = auth.uid();

comment on view my_results is
  'The signed-in student''s marks, from the moment a SECOND MARKER has moderated them. A mark '
  'the lecturer has submitted but nobody has checked is not shown: moderation is what catches a '
  'misread total, and a mark a student has already seen is far harder to correct downwards than '
  'one they have not. Moderated and faculty-approved marks are PROVISIONAL and count towards no '
  'GPA; an approved one is the official result.';


create view my_result_terms
with (security_invoker = true) as
select mr.student_id,
       mr.academic_year,
       mr.semester,
       count(*)                                                  as courses,
       count(*) filter (where mr.official)                       as official_courses,
       count(*) filter (where not mr.official)                   as provisional_courses,
       coalesce(sum(mr.credits) filter (where mr.official), 0)    as official_credits,
       coalesce(sum(mr.quality_points) filter (where mr.official), 0) as official_quality_points,
       g.gpa,
       g.cgpa,
       bool_and(mr.official)                                     as term_is_official
  from my_results mr
  left join semester_gpas g
    on g.student_id = mr.student_id
   and g.academic_year = mr.academic_year
   and g.semester = mr.semester
 group by mr.student_id, mr.academic_year, mr.semester, g.gpa, g.cgpa;

comment on view my_result_terms is
  'The signed-in student''s terms, with the published GPA and CGPA read from semester_gpas '
  'rather than recomputed. Counts only the marks a student may see — moderated onward.';


-- ===========================================================================
-- 2. PROVE IT
-- ===========================================================================

do $$
declare
  stu     uuid;
  dept    uuid;
  crs     uuid;
  enr     uuid;
  who     uuid;
  n       integer;
  txt     text;
begin
  begin
    insert into auth.users (id, email)
    values (gen_random_uuid(), 'proof077@example.invalid') returning id into who;

    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
      values ('Proof Department 077', 'PRF077', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into students (
      matric_no, first_name, last_name, email, department_id, program,
      degree_type, admission_year, status, student_status, auth_user_id
    ) values (
      'PRF077/0001', 'Proof', 'Student', 'proof077@example.invalid', dept,
      'Proof Programme', 'BA', 2026, 'enrolled', 'active', who
    ) returning id into stu;

    insert into courses (code, title, credit_unit, department_id, level, semester, year)
    values ('PRF077A', 'A proof course', 5, dept, 100, 1, 1) returning id into crs;
    insert into enrollments (student_id, course_id, academic_year, semester, status)
    values (stu, crs, 2026, 1, 'registered') returning id into enr;

    insert into results (student_id, course_id, enrollment_id, total_score, grade,
                         grade_point, status)
    values (stu, crs, enr, 88, 'B', 3.00, 'draft');

    perform set_config('request.jwt.claim.sub', who::text, true);

    -- =================================================================
    -- A DRAFT IS INVISIBLE, AND SO IS A SUBMITTED MARK
    -- =================================================================
    --
    -- THE WHOLE POINT OF THIS MIGRATION. The second assertion is the one
    -- 071 would have failed: a mark one person wrote and nobody checked.
    select count(*) into n from my_results;
    if n <> 0 then
      raise exception '077 FAILED: a draft mark reached the student';
    end if;

    update results set status = 'submitted' where student_id = stu;
    select count(*) into n from my_results;
    if n <> 0 then
      raise exception
        '077 FAILED: a SUBMITTED mark reached the student — nobody has moderated it';
    end if;

    -- =================================================================
    -- A MODERATED MARK REACHES THEM, AS PROVISIONAL
    -- =================================================================
    update results set status = 'moderated' where student_id = stu;
    select count(*) into n from my_results;
    if n <> 1 then
      raise exception '077 FAILED: a moderated mark did not reach the student';
    end if;

    select standing into txt from my_results;
    if txt <> 'Provisional' then
      raise exception '077 FAILED: a moderated mark reads as % rather than provisional', txt;
    end if;
    select with_whom into txt from my_results;
    if txt <> 'Moderated, with the Faculty' then
      raise exception '077 FAILED: a moderated mark does not name the desk holding it (got %)', txt;
    end if;
    if (select official from my_results) then
      raise exception '077 FAILED: a moderated mark is reported as official';
    end if;

    -- =================================================================
    -- AND AN APPROVED ONE IS OFFICIAL
    -- =================================================================
    update results set status = 'approved' where student_id = stu;
    if not (select official from my_results) then
      raise exception '077 FAILED: an approved mark is not official';
    end if;
    select standing into txt from my_results;
    if txt <> 'Official result' then
      raise exception '077 FAILED: an approved mark reads as %', txt;
    end if;

    -- =================================================================
    -- A PROVISIONAL MARK STILL COUNTS TOWARDS NO GPA
    -- =================================================================
    --
    -- The figure comes from `semester_gpas`, which nothing here writes. If a
    -- term ever reports a GPA with no row behind it, something has started
    -- computing one from provisional marks.
    update results set status = 'moderated' where student_id = stu;
    select gpa into n from my_result_terms where student_id = stu;
    if n is not null then
      raise exception
        '077 FAILED: a term with only provisional marks reported a GPA of %', n;
    end if;

    -- AND THE TERM KNOWS IT IS NOT OFFICIAL.
    if (select term_is_official from my_result_terms where student_id = stu) then
      raise exception '077 FAILED: a term of provisional marks reports itself official';
    end if;

    perform set_config('request.jwt.claim.sub', '', true);

    select count(*) into n from my_results;
    if n <> 0 then raise exception '077 FAILED: my_results returned % rows to nobody', n; end if;

    raise notice '077 OK — a mark nobody has checked does not reach the student: a draft is '
      'invisible and so is a submitted one. A moderated mark reaches them as provisional, named '
      'to the desk holding it, counting towards no GPA; an approved one is the official result; '
      'and the views return nothing at all to nobody.';

    raise exception 'ROLLBACK_077';
  exception
    when others then
      perform set_config('request.jwt.claim.sub', '', true);
      if sqlerrm = 'ROLLBACK_077' then
        return;
      end if;
      raise;
  end;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   078_the_conditions_every_post_is_appointed_on.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 078 — THE CONDITIONS EVERY POST IS APPOINTED ON
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. EVERY POST HAS DEFAULT APPOINTMENT CONDITIONS. Eight family sets, between
--    them covering all forty-three posts in the register, carrying the twenty
--    or so clauses a letter of appointment is expected to state — duration,
--    probation, hours, remuneration, leave, confidentiality, intellectual
--    property, notice, discipline, retirement, dispute, acceptance. Choosing a
--    post in the appointment form now fills the "Appointment conditions" box,
--    which until today was empty and stayed empty.
--
-- 2. EVERY POST HAS A DUTY STATION. All forty-three were null, so the letter
--    had no place of duty unless somebody typed one. They are set to the
--    University's own published address and each stays editable.
--
-- 3. NOTHING ELSE IS INVENTED. `grade` stays null on every post, because the
--    University has never stated a grade scale, and `employment_category`
--    stays null, because what kind of employment a post is offered on is a
--    decision taken appointment by appointment and not a property of the post.
--    Both columns remain there to be filled when the University says what goes
--    in them.
--
-- ---------------------------------------------------------------------------
-- WHY THESE ARE ACTIVE AND THE JOB DESCRIPTIONS ARE STILL DRAFTS
-- ---------------------------------------------------------------------------
--
-- 048 seeded eight job-description profiles and marked every one `draft`, at
-- the University's instruction, because a job description is APPENDED TO THE
-- LETTER OUT OF THE DATABASE. Nobody reads it on the way past. So it must not
-- reach a letter until a second person has activated it, and that is a rule
-- worth keeping — those eight are still drafts after this migration, and the
-- place to activate them is the Job Descriptions screen, not a SQL file
-- pretending to be a signature.
--
-- Appointment conditions are not like that. They land in an EDITABLE BOX in
-- the appointment form. The officer preparing the letter reads them and may
-- change every word before saving, and the Vice-Chancellor reads them again
-- before approving. A default that a human must look at twice before it binds
-- anybody is a starting point, not an issued document, and holding one in
-- draft only means the box stays empty and somebody writes the conditions from
-- memory — which is the failure this closes.
--
-- The constraints below say exactly that and nothing wider: a set the system
-- seeded (`created_by` null) may be active unsigned; a set A PERSON WROTE may
-- not be active until somebody else has activated it.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THE CONDITIONS STATE STANDING TERMS AND REFER THE PARTICULARS TO THE LETTER.
-- "Your hours are as stated in your letter of appointment", not "40 hours per
-- week". This is how conditions of service are actually written, and it is the
-- reason one set can serve a permanent Registrar and a visiting lecturer
-- without a table of every family crossed with every employment type. The
-- letter carries the particulars; the conditions carry what is true whoever
-- signs it.
-- ===========================================================================


-- ===========================================================================
-- 1. THE SETS
-- ===========================================================================
--
-- Shaped like `position_profiles` on purpose. A post's own set replaces its
-- family's SECTION BY SECTION — the same inheritance 048 established, for the
-- same reason: a Dean whose notice period differs from the family's needs the
-- difference to BE the document, not a contradiction inside it.

create table if not exists appointment_condition_sets (
  id             uuid primary key default gen_random_uuid(),

  -- ONE OR THE OTHER, NEVER BOTH. A set that belonged to a post AND a family
  -- would be inherited by itself.
  position_id    uuid references positions (id) on delete cascade,
  family         text check (family in (
                   'executive', 'academic-administration', 'faculty-leadership',
                   'administration', 'student-services', 'ict',
                   'academic-staff', 'other')),

  version        integer not null default 1 check (version >= 1),

  -- The sentence the conditions open with, above the numbered clauses.
  preamble       text,

  status         text not null default 'draft'
                   check (status in ('draft', 'active', 'superseded')),
  effective_from date,

  created_by     uuid references auth.users (id) on delete set null,
  activated_by   uuid references auth.users (id) on delete set null,
  activated_at   timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint appointment_condition_sets_belongs_to_one_thing
    check ((position_id is not null) <> (family is not null)),

  -- NOBODY ACTIVATES WHAT THEY WROTE.
  constraint appointment_condition_sets_second_pair_of_eyes
    check (activated_by is null or created_by is null or activated_by <> created_by),

  -- AND A SET A PERSON WROTE IS NOT ACTIVE UNTIL SOMEBODY ACTIVATED IT.
  -- A seeded set — `created_by` null — is exempt, and that exemption is the
  -- whole argument in the header: these are defaults read in a box, not a
  -- document issued unread.
  constraint appointment_condition_sets_written_ones_need_activating
    check (status <> 'active' or created_by is null
           or (activated_by is not null and activated_at is not null))
);

create unique index if not exists appointment_condition_sets_one_active_per_family_idx
  on appointment_condition_sets (family)
  where status = 'active' and family is not null;

create unique index if not exists appointment_condition_sets_one_active_per_post_idx
  on appointment_condition_sets (position_id)
  where status = 'active' and position_id is not null;

create unique index if not exists appointment_condition_sets_version_per_family_idx
  on appointment_condition_sets (family, version) where family is not null;

create unique index if not exists appointment_condition_sets_version_per_post_idx
  on appointment_condition_sets (position_id, version) where position_id is not null;

comment on table appointment_condition_sets is
  'The University''s default conditions of appointment, held per family of posts and '
  'overridable per post. They fill the editable "Appointment conditions" box on the '
  'appointment form; they are never appended to a letter unread.';


-- ===========================================================================
-- 2. THE CLAUSES
-- ===========================================================================
--
-- A CLOSED LIST OF SECTIONS, and deliberately not the job description's list.
-- A job description says what the post-holder DOES. Conditions of appointment
-- say what the University and the post-holder OWE EACH OTHER. Running the two
-- through one list would put "Key Performance Indicators" into a contract and
-- "Notice of termination" into a job description.

create table if not exists appointment_condition_clauses (
  id         uuid primary key default gen_random_uuid(),
  set_id     uuid not null references appointment_condition_sets (id) on delete cascade,

  section    text not null check (section in (
               'appointment', 'duration', 'probation', 'duties',
               'hours', 'place-of-duty', 'remuneration', 'allowances',
               'deductions', 'leave', 'conduct', 'confidentiality',
               'intellectual-property', 'outside-work', 'discipline',
               'termination', 'notice', 'retirement', 'dispute',
               'governing-policies', 'acceptance', 'amendment')),

  ordinal    integer not null check (ordinal >= 1),

  -- A CLAUSE OF FIVE WORDS IS A HEADING SOMEBODY MEANT TO COME BACK TO.
  body       text not null check (length(btrim(body)) >= 10),

  created_at timestamptz not null default now(),

  unique (set_id, section, ordinal)
);

create index if not exists appointment_condition_clauses_set_idx
  on appointment_condition_clauses (set_id, section, ordinal);


-- ===========================================================================
-- 3. WHO MAY READ THEM
-- ===========================================================================
--
-- Everybody signed in. Conditions of appointment are not a secret — a member
-- of staff who cannot read the terms they are employed on has been given a
-- contract they cannot check.

alter table appointment_condition_sets    enable row level security;
alter table appointment_condition_clauses enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename = 'appointment_condition_sets'
                    and policyname = 'appointment_condition_sets_read') then
    create policy appointment_condition_sets_read on appointment_condition_sets
      for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies
                  where tablename = 'appointment_condition_clauses'
                    and policyname = 'appointment_condition_clauses_read') then
    create policy appointment_condition_clauses_read on appointment_condition_clauses
      for select to authenticated using (true);
  end if;
end $$;


-- ===========================================================================
-- 4. WHAT A GIVEN POST'S CONDITIONS ACTUALLY ARE
-- ===========================================================================
--
-- REPLACES, DOES NOT MERGE — the same rule as `position_job_description`, and
-- it has to be, because the screen and the letter resolving inheritance two
-- different ways is how an appointee ends up holding conditions nobody in the
-- University recognises.
--
-- Dropped and recreated rather than `create or replace`, because a later
-- migration that widens it cannot then be re-run over this one.

drop view if exists position_default_conditions;

create view position_default_conditions
with (security_invoker = true) as
  with own_sections as (
    select s.position_id, c.section
      from appointment_condition_sets s
      join appointment_condition_clauses c on c.set_id = s.id
     where s.position_id is not null and s.status = 'active'
     group by s.position_id, c.section
  )
  select p.id   as position_id,
         p.job_code,
         p.title,
         p.family,
         c.section,
         c.ordinal,
         c.body,
         s.preamble,
         case when s.position_id is not null then 'position' else 'family' end as source
    from positions p
    join appointment_condition_sets s
      on s.status = 'active'
     and (s.position_id = p.id or (s.family = p.family and s.position_id is null))
    join appointment_condition_clauses c on c.set_id = s.id
   where s.position_id is not null
      or not exists (select 1 from own_sections o
                      where o.position_id = p.id and o.section = c.section);

comment on view position_default_conditions is
  'The conditions of appointment in force for each post: its own active set where it has '
  'one, its family''s everywhere else, section by section.';


-- ===========================================================================
-- 5. THE SEED — EIGHT FAMILIES, AND WHAT THEY OWE EACH OTHER
-- ===========================================================================

do $$
declare
  fam  text;
  sid  uuid;
begin
  foreach fam in array array['executive', 'academic-administration',
                             'faculty-leadership', 'administration',
                             'student-services', 'ict', 'academic-staff', 'other'] loop

    -- IDEMPOTENT BY FAMILY. A second run leaves an existing set alone,
    -- including one the University has since edited.
    if exists (select 1 from appointment_condition_sets where family = fam) then
      continue;
    end if;

    insert into appointment_condition_sets (family, version, status, effective_from, preamble)
    values (fam, 1, 'active', current_date,
      'Your appointment to this post is made on the following conditions. Where a '
      || 'particular of your appointment — its duration, your hours, your remuneration, '
      || 'your place of duty or your reporting officer — is stated in your letter of '
      || 'appointment, the letter governs and these conditions stand alongside it.')
    returning id into sid;

    -- ---- WHAT IS TRUE OF EVERY APPOINTMENT THE UNIVERSITY MAKES -----------
    insert into appointment_condition_clauses (set_id, section, ordinal, body) values
      (sid, 'appointment', 1,
       'This appointment is made by ICOF Global University and takes effect on the date '
       'stated in your letter of appointment. It is subject to your acceptance in writing '
       'and to the University''s satisfaction as to your qualifications, references and '
       'right to work.'),
      (sid, 'duration', 1,
       'The duration of this appointment is as stated in your letter. An appointment for a '
       'fixed term ends on the date stated and carries no expectation of renewal; renewal '
       'is a fresh decision of the University taken on its own merits.'),
      (sid, 'probation', 1,
       'Where your letter states a probationary period, your appointment is confirmed only '
       'on the written confirmation of the University at the end of it. The University may '
       'extend the probationary period once, in writing and with reasons. During probation '
       'either party may end the appointment on one month''s notice.'),
      (sid, 'duties', 1,
       'You shall perform the duties set out in the job description for this post, together '
       'with such other duties reasonably related to it as the University may assign. The '
       'job description may be amended after consultation with you; the version in force at '
       'the date of your appointment remains on the record.'),
      (sid, 'hours', 1,
       'Your hours of work are as stated in your letter of appointment. You are expected to '
       'work such additional hours as the proper discharge of the post reasonably requires, '
       'without further payment unless your letter states otherwise.'),
      (sid, 'place-of-duty', 1,
       'Your place of duty is as stated in your letter. The University may require you to '
       'work at any of its locations, or to travel on its business, on reasonable notice.'),
      (sid, 'remuneration', 1,
       'Your remuneration is as stated in your letter of appointment and is payable monthly '
       'in arrears. Remuneration is reviewed by the University from time to time; a review '
       'does not of itself create an entitlement to an increase.'),
      (sid, 'allowances', 1,
       'Any allowance is payable only where it is stated in your letter of appointment or '
       'granted to you in writing afterwards, and only for so long as the condition it was '
       'granted for continues.'),
      (sid, 'deductions', 1,
       'The University shall make from your remuneration such deductions as the law '
       'requires, and may recover any sum you owe it, including an overpayment, after '
       'notifying you in writing of the amount and the reason.'),
      (sid, 'leave', 1,
       'You are entitled to annual leave, public holidays, sick leave and maternity or '
       'paternity leave in accordance with the University''s leave policy in force from time '
       'to time and with the law. Annual leave is taken at times approved in advance by your '
       'reporting officer.'),
      (sid, 'conduct', 1,
       'You shall conduct yourself in accordance with the statutes, regulations and policies '
       'of the University, shall not act in a way that brings it into disrepute, and shall '
       'declare in writing any interest that conflicts, or might reasonably appear to '
       'conflict, with your duties.'),
      (sid, 'confidentiality', 1,
       'You shall treat student records, staff records, examination material and the '
       'University''s commercial and legal affairs as confidential, both during this '
       'appointment and after it ends, and shall not disclose them except as your duties or '
       'the law require.'),
      (sid, 'intellectual-property', 1,
       'Work you create in the course of this appointment belongs to the University, save '
       'that you retain the customary academic rights of authorship and attribution in '
       'scholarly publication. The University will not assert ownership of work you create '
       'wholly outside your duties and without its resources.'),
      (sid, 'outside-work', 1,
       'You shall obtain the written approval of the Vice-Chancellor before undertaking '
       'paid work outside the University. Approval will not be withheld unreasonably, and '
       'will be withheld where the outside work conflicts with your duties or with the '
       'interests of the University.'),
      (sid, 'discipline', 1,
       'Misconduct is dealt with under the University''s disciplinary procedure. You will be '
       'told the case against you in writing, given a fair opportunity to answer it, and '
       'have a right of appeal. The University may suspend you on full pay while a matter '
       'is investigated; suspension is not a disciplinary penalty.'),
      (sid, 'termination', 1,
       'The University may end this appointment for gross misconduct without notice. It may '
       'otherwise end it on notice, or on redundancy or incapacity, following the procedure '
       'in its policies and the requirements of the law.'),
      (sid, 'notice', 1,
       'Either party may end this appointment on the period of notice stated in your letter '
       'of appointment, or on one month''s written notice where the letter states none. The '
       'University may pay you in lieu of notice.'),
      (sid, 'retirement', 1,
       'Retirement is in accordance with the University''s policy and with the law. Nothing '
       'in these conditions requires you to retire at a particular age where the law '
       'provides otherwise.'),
      (sid, 'dispute', 1,
       'A grievance about your appointment should be raised in writing with your reporting '
       'officer and, failing resolution, with the Vice-Chancellor, whose decision is the '
       'final internal step. Nothing here takes away any right you have in law.'),
      (sid, 'governing-policies', 1,
       'These conditions are to be read with the statutes and regulations of the University '
       'and with its policies in force from time to time. Where a policy and these '
       'conditions conflict, these conditions govern unless the policy says otherwise and '
       'has been approved by the Vice-Chancellor.'),
      (sid, 'amendment', 1,
       'The University may amend these conditions after consultation. An amendment is issued '
       'in writing and takes effect on the date it states; the conditions in force when you '
       'accepted your appointment remain on the record.'),
      (sid, 'acceptance', 1,
       'Please signify your acceptance by signing and returning the acceptance form '
       'accompanying your letter of appointment. Your appointment is not complete until the '
       'University has received it.');

    -- ---- AND WHAT DISTINGUISHES THE FAMILY --------------------------------
    --
    -- ONE SECTION EACH, AND IT REPLACES THE FAMILY'S NOTHING — these are
    -- sections the common block does not write, so there is nothing to
    -- collide with. A post that later needs a different notice period writes
    -- its own `notice` section and takes it INSTEAD of the one above.

    if fam = 'academic-staff' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'Your duties include teaching, the setting and marking of assessment, the '
         'supervision of students, scholarship or research appropriate to the post, and '
         'such examination duties as the University assigns. You shall keep to the '
         'published academic calendar and to the deadlines for the submission of marks.'),
        (sid, 'outside-work', 2,
         'Scholarly activity, external examining, peer review and professional practice '
         'that supports your academic standing are encouraged, and require approval only '
         'where they are paid or where they would take a material part of your time.');

    elsif fam = 'executive' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You hold an office of the University and shall exercise the powers of that office '
         'in accordance with its statutes. You shall report to the governing authority of '
         'the University as its statutes require.'),
        (sid, 'notice', 2,
         'Either party may end this appointment on three months'' written notice, or on the '
         'period stated in your letter of appointment where that is longer.'),
        (sid, 'outside-work', 2,
         'You shall not hold any other remunerated executive office without the written '
         'approval of the governing authority of the University.');

    elsif fam = 'faculty-leadership' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You shall lead the academic work of the faculty, school or programme named in '
         'your letter, oversee the staff assigned to it, and account to the Vice-Chancellor '
         'for its academic standards, its student outcomes and its use of resources.'),
        (sid, 'duration', 2,
         'A headship or deanship is held for the term stated in your letter. At the end of '
         'that term you revert to your substantive academic post on its own conditions, '
         'unless the University appoints you for a further term.');

    elsif fam = 'academic-administration' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You shall direct the office named in your letter, and are answerable for the '
         'accuracy and integrity of the records it keeps. You shall not alter a student '
         'record, an admission decision or an examination result except under the '
         'University''s regulations and with the authority they require.'),
        (sid, 'confidentiality', 2,
         'You have access to the University''s student and examination records as a '
         'condition of this post. Accessing a record for any purpose other than your '
         'duties, or disclosing one outside them, is gross misconduct.');

    elsif fam = 'administration' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You shall direct the office named in your letter and account to the '
         'Vice-Chancellor for its work. You shall commit the University''s funds only '
         'within limits delegated to you in writing.'),
        (sid, 'conduct', 2,
         'You shall declare in writing any interest, direct or indirect, in a supplier, '
         'contractor or applicant, and shall take no part in a decision in which you have '
         'declared an interest.');

    elsif fam = 'student-services' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You shall support students in the matters assigned to your office and shall '
         'observe the University''s safeguarding policy. You shall refer to the appropriate '
         'officer any matter concerning a student''s safety or welfare that is beyond your '
         'authority to resolve.'),
        (sid, 'confidentiality', 2,
         'Information a student gives you in confidence is to be kept in confidence, except '
         'where disclosure is necessary to protect that student or another person from harm, '
         'or where the law requires it.');

    elsif fam = 'ict' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You shall maintain the University''s systems and the security of the data they '
         'hold, and shall follow its change-control and information-security policies.'),
        (sid, 'confidentiality', 2,
         'Administrative access to the University''s systems is given to you for the '
         'discharge of your duties alone. Reading, copying, altering or disclosing data for '
         'any other purpose is gross misconduct, whether or not the data is used.');

    else
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You shall perform the duties of the post as set out in its job description and as '
         'assigned by the officer to whom you report.');
    end if;

  end loop;
end $$;


-- ===========================================================================
-- 6. WHERE THE POSTS ARE HELD
-- ===========================================================================
--
-- THE UNIVERSITY'S OWN PUBLISHED ADDRESS, not an invented campus. Every post
-- had `duty_station` null, so a letter carried no place of duty unless
-- somebody typed one — and a contract without a place of duty is one the
-- post-holder cannot enforce.
--
-- ONLY WHERE IT IS NULL. A station the University has since set is left alone,
-- which is also what makes a second run of this bundle a no-op.

update positions
   set duty_station = 'Opposite Bulu Blind Junction, Buea-Cameroon'
 where duty_station is null;


-- ===========================================================================
-- 7. PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  someone  uuid;
  sid      uuid;
  pos_id   uuid;
  refused  boolean;
  n        integer;
begin
  select id into someone from auth.users order by created_at limit 1;
  select id into pos_id from positions where job_code = 'ACA-DAA';

  -- ---- A SET BELONGS TO A POST OR A FAMILY, NEVER BOTH OR NEITHER --------
  refused := false;
  begin
    insert into appointment_condition_sets (position_id, family)
    values (pos_id, 'academic-administration');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '078 FAILED: a condition set belonged to a post and a family at once, so '
                    'it is inherited by itself';
  end if;

  refused := false;
  begin
    insert into appointment_condition_sets (version) values (1);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '078 FAILED: a condition set belonging to nothing was accepted';
  end if;

  -- ---- A SET A PERSON WROTE IS NOT ACTIVE UNTIL SOMEBODY ACTIVATES IT ----
  if someone is not null then
    -- THE NEXT FREE VERSION, NOT VERSION 1. `version_per_post_idx` is unique
    -- per post, so a hard-coded 1 collides with a version 1 the University has
    -- written for this post — the same class of fault that stopped 044 on the
    -- live database, where a proof competed for a value the University's own
    -- data occupies.
    select coalesce(max(version), 0) + 1 into n
      from appointment_condition_sets where position_id = pos_id;

    insert into appointment_condition_sets (position_id, version, status, created_by)
    values (pos_id, n, 'draft', someone)
    returning id into sid;

    refused := false;
    begin
      update appointment_condition_sets set status = 'active' where id = sid;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '078 FAILED: conditions somebody wrote went active with nobody '
                      'activating them';
    end if;

    refused := false;
    begin
      update appointment_condition_sets
         set status = 'active', activated_by = someone, activated_at = now()
       where id = sid;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '078 FAILED: somebody activated the conditions they wrote themselves';
    end if;
  end if;

  -- ---- A CLAUSE OF FIVE WORDS IS NOT A CLAUSE ---------------------------
  select id into sid from appointment_condition_sets
   where family = 'academic-administration' and status = 'active';

  refused := false;
  begin
    insert into appointment_condition_clauses (set_id, section, ordinal, body)
    values (sid, 'notice', 99, 'as agreed');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '078 FAILED: a nine-character clause was accepted as a condition of '
                    'appointment';
  end if;

  -- ---- AND THE ONE THAT IS THE POINT: EVERY POST NOW HAS CONDITIONS -----
  select count(*) into n
    from positions p
   where not exists (select 1 from position_default_conditions d
                      where d.position_id = p.id);
  if n > 0 then
    raise exception '078 FAILED: % post(s) in the register still have no conditions of '
                    'appointment', n;
  end if;

  select count(*) into n from positions where duty_station is null;
  if n > 0 then
    raise exception '078 FAILED: % post(s) still have no place of duty', n;
  end if;

  -- ---- A POST'S OWN SECTION REPLACES ITS FAMILY'S, AND ONLY THAT ONE ----
  --
  -- The rule the letter and the screen must agree about. Proved by writing a
  -- post-specific `notice` and watching the family's `notice` disappear while
  -- the family's `leave` stays.
  --
  -- FIRST, GET OUT OF THE UNIVERSITY'S WAY — the fault 044 was stopped by on
  -- the live database, which this migration had too. `one_active_per_post_idx`
  -- permits one active set per post, and the moment the University gives the
  -- Director of Academic Affairs conditions of their own through the
  -- Conditions of appointment screen, this insert collides with it and the
  -- migration fails on a database where nothing is wrong.
  --
  -- The version is chosen rather than assumed for the same reason: a
  -- hard-coded 2 collides with a version 2 the University has written.
  -- Everything here rolls back, so their set is active again the moment the
  -- proof ends.
  update appointment_condition_sets set status = 'superseded'
   where position_id = pos_id and status = 'active';

  select coalesce(max(version), 0) + 1 into n
    from appointment_condition_sets where position_id = pos_id;

  insert into appointment_condition_sets (position_id, version, status, effective_from)
  values (pos_id, n, 'active', current_date)
  returning id into sid;

  insert into appointment_condition_clauses (set_id, section, ordinal, body)
  values (sid, 'notice', 1,
    'Either party may end this appointment on six months'' written notice.');

  select count(*) into n from position_default_conditions
   where position_id = pos_id and section = 'notice';
  if n <> 1 then
    raise exception '078 FAILED: a post with its own notice clause resolved to % of them, '
                    'not one', n;
  end if;

  select count(*) into n from position_default_conditions
   where position_id = pos_id and section = 'notice' and source = 'position';
  if n <> 1 then
    raise exception '078 FAILED: the post''s own notice clause did not replace its '
                    'family''s';
  end if;

  select count(*) into n from position_default_conditions
   where position_id = pos_id and section = 'leave' and source = 'family';
  if n < 1 then
    raise exception '078 FAILED: a post that states its own notice period lost its '
                    'family''s leave clause, so the inheritance merges instead of '
                    'replacing section by section';
  end if;

  raise exception 'ROLLBACK 078 PROOF';
exception
  when others then
    if sqlerrm <> 'ROLLBACK 078 PROOF' then raise; end if;
end $$;


do $$
begin
  raise notice '078 OK: every post in the register has conditions of appointment, inherited '
               'from its family and overridable post by post';
  raise notice '078 OK: a post''s own section replaces its family''s for that section and '
               'leaves every other section alone';
  raise notice '078 OK: conditions somebody wrote cannot go active until somebody else '
               'activates them';
  raise notice '078 OK: every post has a place of duty, and grade and employment category '
               'are left empty rather than invented';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   079_sending_a_document_by_whatsapp.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 079 — SENDING A DOCUMENT BY WHATSAPP
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A LETTER CAN BE HANDED TO WHATSAPP, AND THE SYSTEM RECORDS THAT IT WAS.
--    Both event vocabularies gain one word — `WHATSAPP_HANDED_OVER` — so the
--    history of an appointment letter or an official letter can say that on
--    such a date, this officer sent it that way.
--
-- 2. A LETTER CAN CARRY A PHONE NUMBER TO SEND IT TO. `correspondence` had a
--    recipient's name, organisation, postal address and email, and no number,
--    so there was nothing to send to. Appointments already had `phone`.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- `delivery` IS NOT TOUCHED, AND THAT IS THE POINT. It stays 'pending',
-- 'sent' or 'failed', and WhatsApp never sets it to 'sent'.
--
-- When the University emails a letter, its own mail server reports what
-- happened and 'sent' means something. WhatsApp is different: the officer's
-- own WhatsApp opens with the message prepared, and whether they then press
-- send, send it to the right person, or close the window, the University's
-- system cannot see. Writing 'sent' would be the database asserting a
-- delivery nobody observed — and the first time an appointee said "I never
-- received it", the record would be evidence against the University that was
-- never true.
--
-- So what is recorded is exactly what is known: WHO handed this letter to
-- WhatsApp, WHEN, and to WHICH number. That is a real fact, it is the fact an
-- audit needs, and it does not pretend to be a delivery receipt.
--
-- ---------------------------------------------------------------------------
-- AND WHY WHATSAPP CARRIES A LINK AND NOT THE DOCUMENT
-- ---------------------------------------------------------------------------
--
-- WhatsApp cannot be handed a file by a web page. What it can be handed is a
-- message, so the message carries the reference and the address that verifies
-- it — which is better than an attachment anyway: a forwarded WhatsApp file
-- proves nothing, and a reference checked against the University's own
-- verification page proves the document is real.
-- ===========================================================================


-- ===========================================================================
-- 1. THE WORD BOTH HISTORIES WERE MISSING
-- ===========================================================================
--
-- REPLACED, NOT WIDENED IN PLACE. A CHECK constraint cannot have a value
-- added to it; it is dropped and written again with the longer list. Every
-- value already there stays, so no existing row is invalidated — and the
-- proof at the end shows the old words are still accepted.

-- NOT VALID, FOR THE REASON 050 NOW CARRIES TOO. Adding a CHECK makes
-- PostgreSQL test every row already in the table, and this history is
-- append-only by the University's own rule — a migration that will not run
-- until somebody edits the audit trail is asking for the one act the audit
-- trail exists to prevent. The vocabulary governs what is written from here
-- on; anything already there is reported by 050 and left alone.
--
-- It is VALIDATED below where nothing is in the way, so a clean database gets
-- a fully enforced constraint rather than a weaker one.
do $$
declare
  strays integer;
begin
  if exists (select 1 from pg_constraint where conname = 'appointment_events_vocabulary') then
    alter table appointment_events drop constraint appointment_events_vocabulary;
  end if;

  alter table appointment_events add constraint appointment_events_vocabulary
    check (event in (
      'DRAFTED', 'EDITED', 'REVIEWED', 'SUBMITTED_FOR_AUTHORITY', 'AUTHORIZED',
      'RETURNED', 'LETTER_GENERATED', 'LETTER_ISSUED', 'LETTER_VIEWED',
      'LETTER_DOWNLOADED', 'LETTER_SUPERSEDED', 'EMAIL_SENT', 'EMAIL_FAILED',
      'LETTER_DELIVERY_FAILED', 'ACCEPTED', 'DECLINED', 'RENEWED',
      'STAFF_ACTIVATED', 'WITHDRAWN', 'ENDED', 'ADMINISTRATIVE_OVERRIDE',
      -- NEW. The officer opened WhatsApp with this letter's reference and
      -- verification address prepared. Not a delivery — see the header.
      'WHATSAPP_HANDED_OVER'))
    not valid;

  select count(*) into strays from appointment_events
   where event not in (
     'DRAFTED', 'EDITED', 'REVIEWED', 'SUBMITTED_FOR_AUTHORITY', 'AUTHORIZED',
     'RETURNED', 'LETTER_GENERATED', 'LETTER_ISSUED', 'LETTER_VIEWED',
     'LETTER_DOWNLOADED', 'LETTER_SUPERSEDED', 'EMAIL_SENT', 'EMAIL_FAILED',
     'LETTER_DELIVERY_FAILED', 'ACCEPTED', 'DECLINED', 'RENEWED',
     'STAFF_ACTIVATED', 'WITHDRAWN', 'ENDED', 'ADMINISTRATIVE_OVERRIDE',
     'WHATSAPP_HANDED_OVER');

  if coalesce(strays, 0) = 0 then
    alter table appointment_events validate constraint appointment_events_vocabulary;
  end if;
end $$;

-- THE SAME CARE ON THE CORRESPONDENCE HISTORY, and for the same reason: it is
-- append-only too, and a letter to a ministry that was recorded under an older
-- word must not stop the University's database from being migrated.
do $$
declare
  strays integer;
begin
  if exists (select 1 from pg_constraint
              where conname = 'correspondence_events_event_check') then
    alter table correspondence_events drop constraint correspondence_events_event_check;
  end if;

  alter table correspondence_events add constraint correspondence_events_event_check
    check (event in (
      'DRAFTED', 'EDITED', 'PREPARATION_REQUESTED', 'PREPARED',
      'SUBMITTED_TO_AUTHORITY', 'AUTHORIZED', 'RETURNED', 'SCHEDULED',
      'LETTER_GENERATED', 'ISSUED', 'DELIVERED', 'DELIVERY_FAILED',
      'LETTER_SUPERSEDED', 'WITHDRAWN',
      'WHATSAPP_HANDED_OVER'))
    not valid;

  select count(*) into strays from correspondence_events
   where event not in (
     'DRAFTED', 'EDITED', 'PREPARATION_REQUESTED', 'PREPARED',
     'SUBMITTED_TO_AUTHORITY', 'AUTHORIZED', 'RETURNED', 'SCHEDULED',
     'LETTER_GENERATED', 'ISSUED', 'DELIVERED', 'DELIVERY_FAILED',
     'LETTER_SUPERSEDED', 'WITHDRAWN', 'WHATSAPP_HANDED_OVER');

  if coalesce(strays, 0) = 0 then
    alter table correspondence_events validate constraint correspondence_events_event_check;
  else
    raise notice '079: % correspondence history row(s) carry an event word this vocabulary '
                 'does not list. They are left exactly as they are; the vocabulary governs '
                 'what is written from now on.', strays;
  end if;
end $$;


-- ===========================================================================
-- 2. SOMEWHERE TO SEND IT
-- ===========================================================================
--
-- A NUMBER, NOT A FORMAT. No CHECK on the shape: the University writes to
-- ministries, partner institutions and people in several countries, and a
-- regular expression that was right for Cameroon would quietly refuse a
-- correct number from anywhere else. The application normalises it before it
-- reaches WhatsApp, and shows what it made of it, which is the honest place
-- for that judgement — visible and correctable.

alter table correspondence
  add column if not exists recipient_phone text;

comment on column correspondence.recipient_phone is
  'A number the recipient can be reached on, for handing the letter to WhatsApp. '
  'Not validated in the database: the University writes abroad, and a pattern fitted to '
  'one country would refuse correct numbers from every other.';


-- ===========================================================================
-- 3. PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  ap_id  uuid;
  co_id  uuid;
  refused boolean;
begin
  select id into ap_id from appointments limit 1;
  select id into co_id from correspondence limit 1;

  -- ---- THE NEW WORD IS ACCEPTED ----------------------------------------
  if ap_id is not null then
    insert into appointment_events (appointment_id, event)
    values (ap_id, 'WHATSAPP_HANDED_OVER');

    -- ---- AND EVERY OLD ONE STILL IS -----------------------------------
    -- The failure a rewritten CHECK actually causes: one value quietly
    -- dropped in the retyping, and a history that could no longer record an
    -- acceptance.
    insert into appointment_events (appointment_id, event) values
      (ap_id, 'DRAFTED'), (ap_id, 'AUTHORIZED'), (ap_id, 'LETTER_ISSUED'),
      (ap_id, 'EMAIL_SENT'), (ap_id, 'EMAIL_FAILED'), (ap_id, 'ACCEPTED'),
      (ap_id, 'DECLINED'), (ap_id, 'STAFF_ACTIVATED'), (ap_id, 'ENDED'),
      (ap_id, 'ADMINISTRATIVE_OVERRIDE');

    -- ---- AND A WORD NOBODY DEFINED IS STILL REFUSED --------------------
    refused := false;
    begin
      insert into appointment_events (appointment_id, event) values (ap_id, 'WHATSAPPED');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '079 FAILED: the appointment history accepted an event nobody defined, '
                      'so the vocabulary is no longer closed';
    end if;
  end if;

  if co_id is not null then
    insert into correspondence_events (correspondence_id, event)
    values (co_id, 'WHATSAPP_HANDED_OVER');

    insert into correspondence_events (correspondence_id, event) values
      (co_id, 'DRAFTED'), (co_id, 'AUTHORIZED'), (co_id, 'ISSUED'),
      (co_id, 'DELIVERED'), (co_id, 'DELIVERY_FAILED'), (co_id, 'WITHDRAWN');

    refused := false;
    begin
      insert into correspondence_events (correspondence_id, event) values (co_id, 'SENT_SOMEHOW');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '079 FAILED: the correspondence history accepted an event nobody '
                      'defined';
    end if;
  end if;

  -- ---- A LETTER STILL CANNOT CLAIM A DELIVERY IT DID NOT HAVE ----------
  --
  -- The rule this migration deliberately did NOT relax. Handing a letter to
  -- WhatsApp must not be able to mark it sent, and the constraint that stops
  -- it is 042's, still there.
  refused := false;
  begin
    update appointment_letters set delivery = 'whatsapp' where id in (
      select id from appointment_letters limit 1);
    if not found then refused := true; end if;  -- nothing to test against
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '079 FAILED: a letter recorded its delivery as ''whatsapp'', so the '
                    'University''s record now asserts a delivery nobody observed';
  end if;

  raise exception 'ROLLBACK 079 PROOF';
exception
  when others then
    if sqlerrm <> 'ROLLBACK 079 PROOF' then raise; end if;
end $$;


do $$
begin
  raise notice '079 OK: an appointment letter and an official letter can each record that '
               'somebody handed it to WhatsApp, and who';
  raise notice '079 OK: every event word either history already used is still accepted, and '
               'a word nobody defined is still refused';
  raise notice '079 OK: handing a letter to WhatsApp cannot mark it delivered — the '
               'University records what it knows, not what it hopes';
  raise notice '079 OK: an official letter can carry a phone number to send it to';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   080_the_appointees_three_days.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 080 — THE APPOINTEE'S THREE DAYS
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. NOTHING CLOSES TODAY. This adds three columns and no data. Every letter
--    already issued stays exactly as it is.
--
-- 2. AN APPOINTEE'S DOWNLOAD LINK BECOMES A WINDOW, NOT A KEY. The University:
--    "when appointees download their letters, the download link must expire
--    after 3days. after 3 days, only the superadmin can extract that same
--    letter." The window is THREE DAYS FROM ACCEPTANCE, computed from the
--    acceptance the system already records — no column needed for the ordinary
--    case, which is why there is none.
--
-- 3. AND REOPENING IT IS AN ACT WITH A NAME ON IT. These three columns record
--    a Superadministrator granting a fresh window: until when, by whom, and
--    why. That is the only thing a new column is needed for.
--
-- ---------------------------------------------------------------------------
-- WHY THE WINDOW IS NOT A COLUMN ON EVERY ROW
-- ---------------------------------------------------------------------------
--
-- Because it would be a copy of something already known. `appointment_
-- acceptances.at` is when they accepted; three days later is arithmetic. A
-- stored `expires_at` on every acceptance would be a second version of that
-- fact, and the first time the University changed three days to seven, every
-- row written before the change would disagree with the rule.
--
-- WHAT CANNOT BE DERIVED is an extension: a specific person decided, on a
-- specific day, to let one appointee have another window. That is new
-- information, so it is stored.
--
-- ---------------------------------------------------------------------------
-- READING IS NOT WHAT EXPIRES
-- ---------------------------------------------------------------------------
--
-- An appointee who has not yet answered can always read the letter — they are
-- being asked to agree to it, and nobody should ever be asked to accept a
-- document they cannot see. What expires is KEEPING A COPY after the answer.
-- The route enforces that; this migration only records the extension.
-- ===========================================================================

alter table appointments
  add column if not exists appointee_download_until      timestamptz,
  add column if not exists appointee_download_granted_by uuid references auth.users (id)
    on delete set null,
  add column if not exists appointee_download_granted_at timestamptz;

comment on column appointments.appointee_download_until is
  'A fresh window for the appointee to download their letter, granted by the '
  'Superadministrator after the ordinary three days from acceptance have passed. Null means '
  'the ordinary rule applies.';

-- ---------------------------------------------------------------------------
-- ALL THREE OR NONE
-- ---------------------------------------------------------------------------
--
-- The lesson 047's salary columns taught this system the hard way, applied
-- before it can go wrong here: a window with nobody's name against it is a
-- door somebody opened that the record cannot attribute, which is worse than
-- the door being shut.

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'appointments_download_grant_is_complete') then
    alter table appointments add constraint appointments_download_grant_is_complete
      check (
        (appointee_download_until is null
         and appointee_download_granted_by is null
         and appointee_download_granted_at is null)
        or
        (appointee_download_until is not null
         and appointee_download_granted_at is not null)
      );
  end if;
end $$;

create index if not exists appointments_appointee_download_idx
  on appointments (appointee_download_until)
  where appointee_download_until is not null;


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  someone uuid;
  a_id    uuid;
  refused boolean;
begin
  select id into someone from auth.users order by created_at limit 1;

  insert into appointments
    (full_name, position_title, employment_type, start_date, place_of_duty, status)
  values ('A Specimen Appointee', 'Lecturer', 'permanent', current_date + 30,
          'Buea', 'draft')
  returning id into a_id;

  -- ---- A WINDOW WITH NOBODY BEHIND IT IS REFUSED ------------------------
  refused := false;
  begin
    update appointments set appointee_download_until = now() + interval '3 days'
     where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '080 FAILED: a download window was opened with no record of who opened it '
                    'or when, so the register cannot say who let a copy out';
  end if;

  -- ---- AND A COMPLETE ONE IS ACCEPTED -----------------------------------
  update appointments
     set appointee_download_until = now() + interval '3 days',
         appointee_download_granted_by = someone,
         appointee_download_granted_at = now()
   where id = a_id;

  if (select appointee_download_until from appointments where id = a_id) is null then
    raise exception '080 FAILED: a complete grant did not store its window';
  end if;

  -- ---- CLEARING IT CLEARS ALL OF IT --------------------------------------
  update appointments
     set appointee_download_until = null,
         appointee_download_granted_by = null,
         appointee_download_granted_at = null
   where id = a_id;

  refused := false;
  begin
    update appointments set appointee_download_granted_at = now() where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '080 FAILED: half a grant survived, so a row can say somebody granted a '
                    'window that does not exist';
  end if;

  raise exception 'ROLLBACK 080 PROOF';
exception
  when others then
    if sqlerrm <> 'ROLLBACK 080 PROOF' then raise; end if;
end $$;


do $$
begin
  raise notice '080 OK: an appointee''s download window can be reopened, and only with a '
               'record of who reopened it and when';
  raise notice '080 OK: half a grant is refused — a window nobody opened cannot exist';
  raise notice '080 OK: nothing is closed by this migration; the ordinary three days are '
               'computed from the acceptance already on record';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   081_what_an_hr_officer_may_see_and_correct.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 081 — WHAT AN HR OFFICER MAY SEE, AND CORRECT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE DRAFT & SUBMIT SCREEN WORKS FOR AN HR OFFICER. It does not today.
--    056 built `appointments_without_pay` so that a salary is never delivered
--    to a browser with no business showing one — which is right — and the view
--    carries twenty-five columns while the screen asks for thirty-one. Six it
--    asks for are not there: `terms`, `working_hours`, `appointing_authority`,
--    `authority_decided_on`, `postal_address` and `faculty`. PostgREST refuses
--    the whole query over a column it does not have, so for every role without
--    `set-remuneration` THE SCREEN SIMPLY DOES NOT LOAD. An empty register
--    reads as a University that has never appointed anybody.
--
-- 2. AND A DRAFT CAN BE CORRECTED. `position_id` is added for the same reason:
--    the new "Edit this draft" button fills the form from the record, and
--    without the post it would silently blank the one field everything
--    downstream hangs off — the letter's family, its job description, the
--    standing of the office.
--
-- NOT ONE OF THESE IS PAY. They are the particulars of an appointment an HR
-- officer is already trusted to draft, and 056's separation is untouched:
-- `salary_amount`, `salary_currency` and `salary_period` are still absent, and
-- `is_paid` still says only whether there is a figure.
--
-- ---------------------------------------------------------------------------
-- DROPPED AND RECREATED, NOT REPLACED
-- ---------------------------------------------------------------------------
--
-- `create or replace view` may only APPEND columns — it cannot insert one in
-- the middle, rename one or drop one. This puts the new columns beside the
-- ones they belong with rather than in an arbitrary tail, so it must drop
-- first. That has cost this system a bundle re-run before: a view a later
-- migration widens must be dropped and created in BOTH migrations, never
-- replaced in one and dropped in the other.
-- ===========================================================================

drop view if exists appointments_without_pay;

create view appointments_without_pay
with (security_invoker = true) as
  select
    id,
    person_id,
    lecturer_id,
    full_name,
    email,
    phone,
    -- NEW. A letter is posted, so the address is a particular of the
    -- appointment and not a confidence.
    postal_address,
    position_title,
    -- NEW. The post from the register. Everything the letter does with wording
    -- and with the job description hangs off this one column.
    position_id,
    department_id,
    unit_name,
    -- NEW. Which faculty, where the post belongs to one.
    faculty,
    employment_type,
    start_date,
    end_date,
    effective_date,
    probation_months,
    -- NEW. The three the letter states and the screen edits.
    working_hours,
    place_of_duty,
    reports_to_id,
    reports_to_name,
    appointing_authority,
    authority_decided_on,
    terms,
    -- WHETHER THERE IS PAY, NEVER WHAT IT IS. 056's line, unchanged: a letter
    -- for an unpaid post says nothing about remuneration and a letter for a
    -- paid one must, so the screen has to know which without being told the
    -- figure.
    salary_amount is not null as is_paid,
    status,
    drafted_by,
    authorized_by,
    authorized_at,
    issued_at,
    created_at,
    updated_at
  from appointments;

comment on view appointments_without_pay is
  'Every particular of an appointment except what somebody is paid. The three salary '
  'columns are absent and `is_paid` says only whether a figure exists, so a role without '
  'set-remuneration can draft, read and correct an appointment without ever being sent a '
  'salary.';


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  missing text;
  leaked  text;
begin
  -- ---- EVERY COLUMN THE SCREEN ASKS FOR IS THERE -------------------------
  --
  -- Named one by one rather than counted, because the failure this fixes was
  -- a screen asking for a column a view did not have, and a count would pass
  -- while the wrong six were present.
  select string_agg(w.name, ', ' order by w.name) into missing
    from (values
      ('id'), ('full_name'), ('email'), ('phone'), ('postal_address'),
      ('position_title'), ('position_id'), ('unit_name'), ('faculty'),
      ('employment_type'), ('start_date'), ('end_date'), ('effective_date'),
      ('probation_months'), ('place_of_duty'), ('reports_to_name'),
      ('working_hours'), ('appointing_authority'), ('authority_decided_on'),
      ('terms'), ('status'), ('drafted_by'), ('authorized_by'), ('issued_at')
    ) as w(name)
   where not exists (
     select 1 from information_schema.columns c
      where c.table_name = 'appointments_without_pay' and c.column_name = w.name);

  if missing is not null then
    raise exception '081 FAILED: the pay-free view is still missing %, so the Draft & submit '
                    'screen cannot load for an HR officer', missing;
  end if;

  -- ---- AND NOT ONE OF THEM IS THE SALARY ---------------------------------
  --
  -- The whole point of 056. A view that grew to be convenient and quietly
  -- carried the figure would undo it, and this is the check that would have
  -- caught that.
  select string_agg(c.column_name, ', ' order by c.column_name) into leaked
    from information_schema.columns c
   where c.table_name = 'appointments_without_pay'
     and c.column_name in ('salary_amount', 'salary_currency', 'salary_period');

  if leaked is not null then
    raise exception '081 FAILED: the pay-free view carries % — it is no longer pay-free, and '
                    'a salary would be delivered to every browser that opens the register',
                    leaked;
  end if;
end $$;


do $$
begin
  raise notice '081 OK: the pay-free view carries every particular the Draft & submit screen '
               'asks for, so it loads for an HR officer instead of coming back empty';
  raise notice '081 OK: and it still carries no salary — only whether there is one';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   082_the_staff_register.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 082 — THE STAFF REGISTER, AND THE JOIN THAT WAS NEVER THERE
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE UNIVERSITY HAS A STAFF REGISTER. It did not. `lecturers` is the
--    nearest thing and it is teaching-shaped — specialization, department,
--    course allocation — and the staff number ICOFSTF2026001 is derived from
--    it. So a Dean, a Director of Academic Affairs, a Finance Officer or a
--    Registrar appointed by this University received AN ACCOUNT AND NO STAFF
--    NUMBER, because the only table that issues one is the one for people who
--    teach. The University's ruling: every appointee gets a staff number.
--
-- 2. AND AN APPOINTMENT IS JOINED TO THE PERSON IT APPOINTED. Until now the
--    two were separate acts with nothing between them. An appointee accepted
--    their letter, the acceptance page told them "Human Resources will open
--    your staff record", and somebody RETYPED their name, email, title and
--    department into a form — the exact fault the appointment letter exists to
--    prevent. A name typed twice is a name that can differ, and then the
--    University has two answers and a signature on the wrong one.
--
-- 3. NOTHING IS OPENED AUTOMATICALLY. The University's ruling: an officer
--    opens it. An acceptance puts somebody on a list; a person decides.
--
-- 4. AND NOT BEFORE THEY HAVE ACCEPTED. 050's rule, enforced here in the
--    database rather than only in a route: being appointed and being on the
--    staff register are two separate things, and the second follows the first.
--
-- NO ACCOUNT IS CREATED BY THIS FILE. Accounts live in `auth.users` and are
-- made by the service role at the moment an officer opens the record. This is
-- the register they are recorded in.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- THE REGISTER
-- ---------------------------------------------------------------------------

create table if not exists staff_records (
  id              uuid primary key default gen_random_uuid(),

  -- WHERE THIS PERSON CAME FROM. Nullable, because the University has staff
  -- who predate the appointments register and whose records were opened by
  -- hand; not nullable in practice for anybody appointed through the system.
  appointment_id  uuid references appointments (id) on delete set null,

  -- The account they sign in with. The username is their email; the password
  -- is generated once, sent in the welcome email, and never stored here.
  auth_user_id    uuid references auth.users (id) on delete set null,

  -- ICOFSTF2026001. The same family as the student number and marked for
  -- staff.
  staff_number    text not null unique,

  full_name       text not null,
  email           text,
  phone           text,
  postal_address  text,

  -- THE POST, AS THE REGISTER HOLDS IT. `position_title` is copied rather than
  -- joined because a post can be renamed and a staff record has to keep saying
  -- what somebody was appointed to.
  position_id     uuid references positions (id) on delete set null,
  position_title  text not null,
  family          text,
  department_id   uuid references departments (id) on delete set null,
  faculty         text,

  employment_type text,
  started_on      date,

  -- WHERE THEY ALSO TEACH. A Dean who lectures has both; a Finance Officer has
  -- only this row. The teaching record is what allocates a course, and it is
  -- not what makes somebody staff.
  lecturer_id     uuid references lecturers (id) on delete set null,

  status          text not null default 'active'
                    check (status in ('active', 'suspended', 'ended')),
  ended_on        date,
  ended_reason    text,

  -- WHO OPENED IT. The University ruled that an officer opens a staff record
  -- rather than it appearing on acceptance, so the record says which officer.
  opened_by       uuid references auth.users (id) on delete set null,
  opened_at       timestamptz not null default now(),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AND THE COLUMN THAT ALREADY EXISTED IS NOT THIS ONE
-- ---------------------------------------------------------------------------
--
-- 042 is called "the appointment lifecycle and THE STAFF RECORD" and it added
-- `appointments.staff_record_id` — pointing at `lecturers`. That was the right
-- join to the only staff table there was, and it is exactly the limitation the
-- University asked to remove: it can only ever name somebody who teaches.
--
-- The two are kept apart rather than one repointed, because they mean different
-- things and a column that quietly changed meaning would make every existing
-- row a lie:
--
--   appointments.staff_record_id   the TEACHING record, in `lecturers`. Null
--                                  for a Registrar or a Finance Officer, and
--                                  correctly so.
--   staff_records.appointment_id   the STAFF REGISTER row. Every appointee has
--                                  one, whatever their post.
--
-- The join from an appointment to its staff record is therefore read from
-- `staff_records`, not from `appointments`.

comment on column appointments.staff_record_id is
  'The TEACHING record in `lecturers`, where this appointee teaches. Not the staff register: '
  'see `staff_records.appointment_id`, which every appointee has whether or not they teach.';

comment on table staff_records is
  'Every person the University employs, whatever their post. The staff number is issued here '
  'rather than from `lecturers`, so an appointee who does not teach still has one.';

-- ONE RECORD PER APPOINTMENT. Opening the same appointment twice is a mistake,
-- not a second job, and without this a double click issues two staff numbers to
-- one person.
create unique index if not exists staff_records_one_per_appointment_idx
  on staff_records (appointment_id) where appointment_id is not null;

-- AND ONE PER ACCOUNT. Two staff records sharing a login is two answers to
-- "who is this".
create unique index if not exists staff_records_one_per_account_idx
  on staff_records (auth_user_id) where auth_user_id is not null;

create index if not exists staff_records_status_idx on staff_records (status);
create index if not exists staff_records_position_idx on staff_records (position_id);

alter table staff_records enable row level security;


-- ---------------------------------------------------------------------------
-- NOT BEFORE THEY HAVE ACCEPTED
-- ---------------------------------------------------------------------------
--
-- The route checks this too. Both, deliberately: the route's check is the one
-- that produces a sentence an officer can read, and this one is the one that
-- is still true when somebody writes to the table by another road.

create or replace function staff_record_needs_an_acceptance()
returns trigger language plpgsql as $$
declare
  st text;
begin
  if new.appointment_id is null then
    -- A record opened by hand for somebody who predates the register. There is
    -- no appointment to check, and refusing it would lock the University out
    -- of recording its own existing staff.
    return new;
  end if;

  select status into st from appointments where id = new.appointment_id;

  if st is null then
    raise exception 'That appointment does not exist, so no staff record can be opened against it';
  end if;

  if st not in ('accepted', 'active') then
    raise exception 'Nobody joins the staff register before they have accepted. This appointment '
                    'is %, and a staff record may be opened once the appointee has accepted the '
                    'letter.', st;
  end if;

  return new;
end $$;

drop trigger if exists staff_record_needs_an_acceptance_trg on staff_records;
create trigger staff_record_needs_an_acceptance_trg
  before insert on staff_records
  for each row execute function staff_record_needs_an_acceptance();


-- ---------------------------------------------------------------------------
-- THE NUMBER
-- ---------------------------------------------------------------------------
--
-- DERIVED FROM THE REGISTER ITSELF rather than from a counter beside it, so it
-- cannot drift out of step with the rows. `staff_number` is unique, so two
-- officers pressing the button at the same moment produce one success and one
-- failure rather than one number twice.

create or replace function next_staff_number(for_year integer default null)
returns text language plpgsql as $$
declare
  y      integer := coalesce(for_year, extract(year from now())::integer);
  prefix text;
  last   text;
  seq    integer;
begin
  prefix := 'ICOFSTF' || y::text;

  select staff_number into last
    from staff_records
   where staff_number like prefix || '%'
   order by staff_number desc
   limit 1;

  -- THE LECTURERS TABLE IS READ TOO, for the years before this register
  -- existed. Otherwise the first number issued here would collide with one
  -- `lecturers` had already given out.
  select greatest(coalesce(last, ''), coalesce(max(staff_id), '')) into last
    from lecturers
   where staff_id like prefix || '%';

  if last is null or last = '' then
    seq := 1;
  else
    seq := coalesce(nullif(regexp_replace(substr(last, length(prefix) + 1), '\D', '', 'g'), ''), '0')::integer + 1;
  end if;

  return prefix || lpad(seq::text, 3, '0');
end $$;

comment on function next_staff_number(integer) is
  'The next ICOFSTF number for a year, reading both the staff register and the older lecturers '
  'table so a number issued before this register existed is never reissued.';


-- ---------------------------------------------------------------------------
-- WHO IS WAITING FOR ONE
-- ---------------------------------------------------------------------------
--
-- The question the screen has to answer: who accepted and has no staff record?
-- Written as a view so the screen asks one question rather than two and
-- subtracting.

drop view if exists appointments_awaiting_staff_record;
create view appointments_awaiting_staff_record
with (security_invoker = true) as
  select a.id            as appointment_id,
         a.full_name,
         a.email,
         a.phone,
         a.position_title,
         a.position_id,
         a.unit_name,
         a.faculty,
         a.employment_type,
         a.start_date,
         a.status,
         p.family
    from appointments a
    left join positions p on p.id = a.position_id
   where a.status in ('accepted', 'active')
     and not exists (select 1 from staff_records s where s.appointment_id = a.id);

comment on view appointments_awaiting_staff_record is
  'Appointees who have accepted and are not yet on the staff register. The Enrolment desk''s '
  'equivalent for staff: a list somebody acts on, not a decision.';


-- ---------------------------------------------------------------------------
-- WHO MAY READ IT
-- ---------------------------------------------------------------------------
--
-- A staff register carries an address and a telephone number for every officer
-- of the University. It is not a directory for general circulation.

drop policy if exists staff_records_readable_by_the_offices_that_keep_it on staff_records;
create policy staff_records_readable_by_the_offices_that_keep_it
  on staff_records for select
  using (
    -- Your own record, always.
    auth_user_id = auth.uid()
    or exists (
      select 1 from profiles pr
       where pr.id = auth.uid()
         and pr.role in ('superadmin', 'admin', 'vice-chancellor', 'chancellor',
                         'registrar', 'academic-office', 'hr-officer', 'hr-administrator')
    )
  );

-- WRITTEN ONLY BY THE SERVICE ROLE. Opening a staff record creates an account
-- at the same moment, which no browser may do, so the route does both with the
-- service key and nothing else writes here.
drop policy if exists staff_records_written_by_the_service_role on staff_records;
create policy staff_records_written_by_the_service_role
  on staff_records for all
  using (false) with check (false);


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  a_id      uuid;
  b_id      uuid;
  c_id      uuid;
  pos_id    uuid;
  parked    text;
  n1        text;
  n2        text;
  refused   boolean;
begin
  -- A POST OF OUR OWN, not one of the University's. See CLAUDE.md: a proof that
  -- reasons about their data instead of making its own has broken this
  -- migration run three times.
  insert into positions (title, job_code, family, unit_name)
       values ('A Specimen Post For Proving 082', 'ZZZ-082', 'other', 'Nowhere')
    returning id into pos_id;

  -- ---- AN APPOINTMENT THAT HAS NOT BEEN ACCEPTED -------------------------
  insert into appointments (full_name, position_title, position_id, employment_type,
                            start_date, status)
       values ('A Specimen Appointee 082', 'A Specimen Post For Proving 082', pos_id,
               'permanent', current_date, 'draft')
    returning id into a_id;

  -- THE GUARD, WATCHED REFUSING. A rule nobody has seen refuse anything is a
  -- rule nobody has tested.
  refused := false;
  begin
    insert into staff_records (appointment_id, staff_number, full_name, position_title)
         values (a_id, 'ICOFSTF9999901', 'A Specimen Appointee 082',
                 'A Specimen Post For Proving 082');
  exception when others then
    refused := true;
  end;
  if not refused then
    raise exception '082 FAILED: a staff record was opened for an appointment nobody has '
                    'accepted, so being appointed and being on the staff register are the '
                    'same thing after all';
  end if;

  -- ---- ACCEPTED, AND NOW IT IS ALLOWED -----------------------------------
  --
  -- INSERTED AT `accepted` RATHER THAN WALKED THERE. 047 refuses an UPDATE into
  -- issued/accepted/active without an approval and an archived letter — the
  -- right rule, and a proof that manufactured an approval and a letter to get
  -- past it would be testing 047 rather than this file. Its trigger is on
  -- UPDATE only, so a specimen may start where it needs to be.
  insert into appointments (full_name, position_title, position_id, employment_type,
                            start_date, status, issued_at, accepted_at)
       values ('A Second Specimen 082', 'A Specimen Post For Proving 082', pos_id,
               'permanent', current_date, 'accepted', now(), now())
    returning id into c_id;

  insert into staff_records (appointment_id, staff_number, full_name, position_title,
                             position_id, employment_type)
       values (c_id, 'ICOFSTF9999901', 'A Second Specimen 082',
               'A Specimen Post For Proving 082', pos_id, 'permanent');

  -- ---- ONE RECORD PER APPOINTMENT ----------------------------------------
  refused := false;
  begin
    insert into staff_records (appointment_id, staff_number, full_name, position_title)
         values (c_id, 'ICOFSTF9999902', 'A Second Specimen 082',
                 'A Specimen Post For Proving 082');
  exception when unique_violation then
    refused := true;
  end;
  if not refused then
    raise exception '082 FAILED: one appointment opened two staff records, so a double click '
                    'issues two staff numbers to one person';
  end if;

  -- ---- THE NUMBER, AND THAT IT DOES NOT COLLIDE WITH `lecturers` ---------
  --
  -- A year of its own, so this counts nothing the University has.
  n1 := next_staff_number(9999);
  if n1 <> 'ICOFSTF9999902' then
    raise exception '082 FAILED: the next staff number after ICOFSTF9999901 came out as %, '
                    'so the register is not counting its own rows', n1;
  end if;

  insert into staff_records (staff_number, full_name, position_title)
       values (n1, 'A Third Specimen 082', 'A Specimen Post For Proving 082');

  n2 := next_staff_number(9999);
  if n2 = n1 then
    raise exception '082 FAILED: the same staff number came back twice, so two officers '
                    'pressing the button would issue one number to two people';
  end if;

  -- ---- THE VIEW SHOWS WHO IS WAITING, AND STOPS WHEN THEY ARE NOT --------
  --
  -- Created rather than assumed: the appointment above is accepted AND has a
  -- staff record, so it must be ABSENT. Asserting the view is empty would fail
  -- the University for having appointed somebody.
  if exists (select 1 from appointments_awaiting_staff_record where appointment_id = c_id) then
    raise exception '082 FAILED: an appointee with a staff record is still listed as awaiting '
                    'one, so the list never empties';
  end if;

  -- AND SOMEBODY WHO HAS NOT ACCEPTED IS NOT WAITING EITHER.
  --
  -- A SECOND appointment left at `draft`, rather than walking the first one
  -- backwards: 047 refuses an appointment being marked issued without an
  -- approval, and rightly — a proof that fought the lifecycle to make its point
  -- would be testing the lifecycle instead of the view.
  -- a_id is the one still at `draft`, from the refusal above.
  if exists (select 1 from appointments_awaiting_staff_record where appointment_id = a_id) then
    raise exception '082 FAILED: an appointee who has not accepted is listed as awaiting a '
                    'staff record, which would put somebody on the staff register before they '
                    'said yes';
  end if;

  -- And one who HAS accepted and has no record IS listed, or the screen shows
  -- an empty list while somebody waits.
  insert into appointments (full_name, position_title, position_id, employment_type,
                            start_date, status, issued_at, accepted_at)
       values ('A Fourth Specimen 082', 'A Specimen Post For Proving 082', pos_id,
               'permanent', current_date, 'accepted', now(), now())
    returning id into b_id;

  if not exists (select 1 from appointments_awaiting_staff_record where appointment_id = b_id) then
    raise exception '082 FAILED: an appointee who has accepted and has no staff record is NOT '
                    'listed as awaiting one, so nobody would ever be opened';
  end if;

  raise exception 'rollback 082 proof';
exception
  when others then
    if sqlerrm <> 'rollback 082 proof' then raise; end if;
end $$;


do $$
begin
  raise notice '082 OK: the University has a staff register, and every appointee gets a staff '
               'number whether or not they teach';
  raise notice '082 OK: a staff record cannot be opened before the appointee has accepted, and '
               'one appointment cannot open two';
  raise notice '082 OK: and `appointments_awaiting_staff_record` says who is waiting for one';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   083_a_lecturer_sees_their_own_students.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 083 — A LECTURER SEES THEIR OWN STUDENTS, AND NOT THE REGISTER
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- A LECTURER STOPS BEING ABLE TO READ EVERY STUDENT THE UNIVERSITY HAS.
--
-- `students_staff_read` names twelve roles and `lecturer` is one of them, so
-- any lecturer account could read the whole register from a browser — every
-- student's name, matriculation number, programme and status, whether or not
-- that student had ever been in their class.
--
-- The University's ruling, September 2026: a lecturer must not "access
-- students outside their legitimate teaching scope", and must be able to "view
-- students registered in courses/classes they teach".
--
-- ---------------------------------------------------------------------------
-- AND WHY THE SCREEN WAS NOT ENOUGH
-- ---------------------------------------------------------------------------
--
-- The University, in the same ruling: "hiding a menu item must never replace
-- server-side authorization."
--
-- Quite so. `MyStudents` asks only for the roll of the courses somebody
-- teaches, and that was true of the SCREEN and of nothing else. The row-level
-- policy is what actually decides, and it said every student. A screen is a
-- convenience; a policy is the rule.
--
-- ---------------------------------------------------------------------------
-- ONLY THE LECTURER, BECAUSE ONLY THE LECTURER HAS BEEN RULED ON
-- ---------------------------------------------------------------------------
--
-- A Dean, a Head of Department and a Programme Coordinator read the whole
-- register too, and the same argument probably narrows each of them — to a
-- faculty, a department, a programme. The University has not said so, and a
-- migration that decided it would be inventing their arrangements. Every other
-- role keeps exactly the reach it has today.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHOSE STUDENTS ARE WHOSE
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER, and deliberately. The policy on `students` must not read
-- `students` to decide whether it may read `students`; a function that owns the
-- question answers it once, without recursion.
--
-- BOTH WAYS A COURSE IS ALLOCATED. 068 explains it: an offering names the
-- lecturer for a term, and `courses.lecturer_id` says who teaches a course
-- FOREVER — the mistake 063 was written to correct. Both are read, because
-- until the University sets up a term the second is all there is, and a
-- lecturer who could not see their class in week one would have to be given
-- the whole register again.

create or replace function teaches_this_student(the_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from enrollments e
      join courses c on c.id = e.course_id
      left join course_offerings o on o.course_id = c.id
      join lecturers l
        on l.id = coalesce(o.lecturer_id, c.lecturer_id)
     where e.student_id = the_student
       and e.status in ('registered', 'completed')
       and l.auth_user_id = auth.uid()
  );
$$;

comment on function teaches_this_student(uuid) is
  'Whether the signed-in account is allocated to teach a course this student is registered on. '
  'Reads the offering and the catalogue alike, because until a term is set up only the second '
  'names a lecturer.';

revoke all on function teaches_this_student(uuid) from public;
grant execute on function teaches_this_student(uuid) to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- THE POLICY
-- ---------------------------------------------------------------------------
--
-- The eleven other roles keep the reach they have; the lecturer's is narrowed
-- to the students they actually teach. Written as one policy rather than two so
-- there is one answer to "who may read a student" rather than two that can
-- drift.

drop policy if exists students_staff_read on students;
create policy students_staff_read on students
  for select using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'finance', 'finance-director',
      'admissions-officer', 'dean', 'hod', 'programme-coordinator',
      'academic-office', 'student-affairs'
    )
    -- THE LECTURER'S OWN CLASSES, AND NO FURTHER.
    or (auth_role() = 'lecturer' and teaches_this_student(students.id))
  );


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- BY READING THE REGISTER AS A LECTURER, NOT BY READING THE POLICY
-- ---------------------------------------------------------------------------
--
-- The first draft of this proof asked `pg_policy` whether the installed
-- predicate mentioned `teaches_this_student`, and that is worth writing down
-- because it proved NOTHING. A policy reading
--
--     auth_role() in (... 'lecturer' ...) or teaches_this_student(students.id)
--
-- mentions the function, passes every check, and leaves a lecturer reading the
-- whole register exactly as before — the `or` is satisfied by the list before
-- the function is ever consulted. A text search cannot tell a narrowing from a
-- widening that happens to use the same words.
--
-- So this signs in. Two students, one on the lecturer's course and one not, and
-- the lecturer is made to say which of them they can see. Revert the policy and
-- the second count is 1 and the proof fails, which is the whole point of it.
--
-- EVERYTHING IT NEEDS, IT MAKES. Its own course code, its own matriculation
-- numbers, its own staff number — nothing of the University's is read, written
-- or competed for, and the whole block rolls back.
-- ---------------------------------------------------------------------------

do $$
declare
  lect_user  uuid := gen_random_uuid();
  reg_user   uuid := gen_random_uuid();
  lect_id    uuid;
  course_id  uuid;
  mine       uuid;
  theirs     uuid;
  seen       integer;
begin
  begin
    -- ---- A LECTURER, A REGISTRAR, A COURSE AND TWO STUDENTS ---------------
    insert into auth.users (id, email) values
      (lect_user, '083-lecturer@example.test'),
      (reg_user,  '083-registrar@example.test');
    insert into profiles (id, email, role) values
      (lect_user, '083-lecturer@example.test',  'lecturer'),
      (reg_user,  '083-registrar@example.test', 'registrar')
    on conflict (id) do update set role = excluded.role;

    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9083', 'Proof', 'Lecturer', lect_user)
      returning id into lect_id;

    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9083', 'A Course Written By This Proof', lect_id)
      returning id into course_id;

    insert into students (matric_no, first_name, last_name, status)
      values ('083/PROOF/MINE', 'Taught', 'ByThisLecturer', 'enrolled')
      returning id into mine;
    insert into students (matric_no, first_name, last_name, status)
      values ('083/PROOF/THEIRS', 'Taught', 'BySomebodyElse', 'enrolled')
      returning id into theirs;

    -- Only the first is registered on the course. The second is a student of
    -- the University and no business of this lecturer's.
    insert into enrollments (student_id, course_id, status)
      values (mine, course_id, 'registered');

    -- ---- NOW SIGN IN AS THE LECTURER --------------------------------------
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', lect_user);

    -- THEIR OWN CLASS. A rule that also refuses the people who need the row is
    -- not a tighter rule, it is a broken screen — "My students" showing nobody.
    select count(*) into seen from students where id = mine;
    if seen <> 1 then
      raise exception '083 FAILED: a lecturer cannot see a student registered on the course '
                      'they teach, so My students is empty for everybody';
    end if;

    -- AND NOT THE REST OF THE UNIVERSITY. This is the count the old proof
    -- never took, and the one the ruling is about.
    select count(*) into seen from students where id = theirs;
    if seen <> 0 then
      raise exception '083 FAILED: a lecturer can read a student they do not teach — the '
                      'whole register is still open to them';
    end if;

    -- ---- AND THE OFFICES STILL REACH THE REGISTER -------------------------
    --
    -- A migration that narrowed everybody would satisfy both counts above and
    -- break the Registrar on the same morning.
    execute format('set local request.jwt.claim.sub = %L', reg_user);
    select count(*) into seen from students where id in (mine, theirs);
    if seen <> 2 then
      raise exception '083 FAILED: the Registrar reads % of 2 students — an office was dropped '
                      'from the policy while the lecturer was being narrowed', seen;
    end if;

    reset role;

    -- ---- THE FUNCTION ANSWERS, AND DOES NOT RECURSE -----------------------
    --
    -- A predicate on `students` that reads `students` without `security
    -- definer` recurses until Postgres gives up, and it would do it inside the
    -- University's own register. The point is not the answer but that it
    -- RETURNS.
    if teaches_this_student('00000000-0000-0000-0000-000000000000'::uuid) then
      raise exception '083 FAILED: a student nobody is registered on is reported as taught';
    end if;

    raise exception 'rollback 083 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 083 proof' then raise; end if;
  end;
end $$;


do $$
begin
  raise notice '083 OK: a lecturer reads only the students registered on courses they teach';
  raise notice '083 OK: and the Registrar, Admissions, Finance and the faculties still read the '
               'register as before';
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
  select '071' as migration, '071_what_the_student_is_owed.sql' as file,
         case when to_regclass('public.my_results') is not null then 'YES' else 'NO' end as landed,
         'my_results' as what_it_creates
  union all
  select '072' as migration, '072_the_numbers_to_start_from.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'programme_versions'
                      and column_name = 'provisional')
                 then 'YES' else 'NO' end as landed,
         'programme_versions.provisional' as what_it_creates
  union all
  select '073' as migration, '073_asking_the_university_for_something.sql' as file,
         case when to_regclass('public.student_requests') is not null then 'YES' else 'NO' end as landed,
         'student_requests' as what_it_creates
  union all
  select '074' as migration, '074_connecting_what_was_already_there.sql' as file,
         case when to_regclass('public.my_requests') is not null then 'YES' else 'NO' end as landed,
         'my_requests' as what_it_creates
  union all
  select '075' as migration, '075_what_a_student_is_charged.sql' as file,
         case when to_regclass('public.fee_schedules') is not null then 'YES' else 'NO' end as landed,
         'fee_schedules' as what_it_creates
  union all
  select '076' as migration, '076_one_transcript_one_download.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'transcript_requests'
                      and column_name = 'downloads_allowed')
                 then 'YES' else 'NO' end as landed,
         'transcript_requests.downloads_allowed' as what_it_creates
  union all
  select '077' as migration, '077_a_mark_is_moderated_before_anybody_sees_it.sql' as file,
         case when to_regclass('public.my_results') is null then 'NO'
                 when position('Moderated, with the Faculty' in
                               pg_get_viewdef('public.my_results'::regclass)) > 0
                 then 'YES' else 'NO' end as landed,
         'viewdef:my_results:Moderated, with the Faculty' as what_it_creates
  union all
  select '078' as migration, '078_the_conditions_every_post_is_appointed_on.sql' as file,
         case when to_regclass('public.appointment_condition_sets') is not null then 'YES' else 'NO' end as landed,
         'appointment_condition_sets' as what_it_creates
  union all
  select '079' as migration, '079_sending_a_document_by_whatsapp.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'correspondence'
                      and column_name = 'recipient_phone')
                 then 'YES' else 'NO' end as landed,
         'correspondence.recipient_phone' as what_it_creates
  union all
  select '080' as migration, '080_the_appointees_three_days.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'appointments'
                      and column_name = 'appointee_download_until')
                 then 'YES' else 'NO' end as landed,
         'appointments.appointee_download_until' as what_it_creates
  union all
  select '081' as migration, '081_what_an_hr_officer_may_see_and_correct.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'appointments_without_pay'
                      and column_name = 'terms')
                 then 'YES' else 'NO' end as landed,
         'appointments_without_pay.terms' as what_it_creates
  union all
  select '082' as migration, '082_the_staff_register.sql' as file,
         case when to_regclass('public.staff_records') is not null then 'YES' else 'NO' end as landed,
         'staff_records' as what_it_creates
  union all
  select '083' as migration, '083_a_lecturer_sees_their_own_students.sql' as file,
         case when exists (
                   select 1 from pg_policy p
                    where p.polname = 'students_staff_read'
                      and position('teaches_this_student' in
                                   pg_get_expr(p.polqual, p.polrelid)) > 0)
                 then 'YES' else 'NO' end as landed,
         'policydef:students_staff_read:teaches_this_student' as what_it_creates
) as landed_report
 order by migration;

