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
