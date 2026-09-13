-- ===========================================================================
-- 067 — ONE STUDENT, ONE RECORD
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- NOTHING IS WRITTEN AND NOTHING IS REFUSED. Three views appear, and with them
-- a question the system has never been able to answer: WHERE IS THIS STUDENT
-- UP TO?
--
-- Not "what have they passed" — the transcript answers that, and has for
-- months. The unanswered one is the one a student actually asks: what is left?
-- Which courses of MY programme have I still to take, which am I on now, and
-- how far is that from the award?
--
-- ---------------------------------------------------------------------------
-- WHY THIS COULD NOT BE ASKED BEFORE
-- ---------------------------------------------------------------------------
--
-- It needs three things that arrived separately and only now exist together:
--
--   057 made the CURRICULUM data. Before it, what a programme required was a
--   TypeScript constant compiled into the website, so no query could compare a
--   student's results against it.
--
--   057 also put `programme_version_id` on the student. That is the whole of
--   the University's own ruling that "students remain attached to the
--   curriculum version under which they were admitted" — without it, a student
--   admitted in 2024 would be measured against a curriculum revised in 2026
--   and told they were short of courses that did not exist when they enrolled.
--
--   063 linked a registration to an OFFERING, so "registered" means registered
--   on something that runs, in a term, rather than on the idea of a course.
--
-- ---------------------------------------------------------------------------
-- WHAT `not-taken` MEANS, AND WHY IT IS NOT AN ERROR
-- ---------------------------------------------------------------------------
--
-- A first-year student has not taken the third-year courses, and that is not a
-- finding. `student_curriculum_progress` returns EVERY entry of the student's
-- curriculum with its state, including the ones they have not reached, because
-- a list of only what they have done cannot show what is left — which is the
-- entire question.
--
-- The four states are exact:
--
--   passed      an APPROVED result with a grade point above zero
--   failed      an APPROVED result with a grade point of zero
--   registered  on the roll for it now, no approved result yet
--   not-taken   neither
--
-- A MARK THAT HAS BEEN ENTERED BUT NOT APPROVED IS NOT A PASS. It is a
-- proposal, and a board may yet send it back. Counting it would tell a student
-- they had finished a course the University has not agreed they have finished.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.curriculum_entries') is null then
    raise exception
      'Migration 057 has not been run on this database: there is no curriculum to measure a '
      'student against. Run 057_the_academic_structure.sql first, or run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. WHERE IS THIS STUDENT UP TO, COURSE BY COURSE
-- ===========================================================================
--
-- One row per entry in the curriculum the student was admitted under.
--
-- THE CREDIT IS THE CURRICULUM'S, NOT THE COURSE'S, where the curriculum
-- states one. The same rule `curriculum_progress` applies, and for the same
-- reason: a course may be worth a different number of credits in a different
-- programme, which is exactly why 057 moved the figure onto the entry. Two
-- views disagreeing about what a course is worth is how a student passes a
-- degree on one screen and is six credits short on another.

create or replace view student_curriculum_progress
with (security_invoker = true) as
select s.id                                        as student_id,
       s.programme_version_id,
       e.id                                        as entry_id,
       e.course_id,
       c.code                                      as course_code,
       c.title                                     as course_title,
       e.year,
       e.semester,
       e.requirement,
       coalesce(e.credits, c.credit_unit, 0)       as credits,
       -- THE APPROVED RESULT, IF THERE IS ONE. `distinct on` with the highest
       -- attempt: a resit is a second row for the same course, and the one
       -- that counts is the latest the University approved.
       r.grade,
       r.grade_point,
       r.attempt,
       en.id                                       as enrollment_id,
       en.academic_year                            as taken_in_year,
       en.semester                                 as taken_in_semester,
       case
         when r.id is not null and r.grade_point > 0 then 'passed'
         when r.id is not null                       then 'failed'
         when en.id is not null                      then 'registered'
         else 'not-taken'
       end                                         as state
  from students s
  join curriculum_entries e on e.programme_version_id = s.programme_version_id
  join courses c on c.id = e.course_id
  -- THE LATEST APPROVED ATTEMPT. A student who failed and resat has two rows;
  -- the record shows the one that stands.
  left join lateral (
    select r2.id, r2.grade, r2.grade_point, r2.attempt
      from results r2
     where r2.student_id = s.id
       and r2.course_id = e.course_id
       and r2.status = 'approved'
     order by coalesce(r2.attempt, 1) desc, r2.approved_at desc nulls last
     limit 1
  ) r on true
  -- AND WHETHER THEY ARE ON IT NOW. Registered and not dropped; a dropped
  -- registration is not a course in progress.
  left join lateral (
    select e2.id, e2.academic_year, e2.semester
      from enrollments e2
     where e2.student_id = s.id
       and e2.course_id = e.course_id
       and e2.status = 'registered'
     order by e2.academic_year desc, e2.semester desc
     limit 1
  ) en on true
 where s.programme_version_id is not null;

comment on view student_curriculum_progress is
  'Every course of the curriculum a student was admitted under, with where they are up to: '
  'passed, failed, registered or not-taken. `not-taken` is not a finding — a first-year student '
  'has not taken the third-year courses — and it is returned because a list of only what has been '
  'done cannot show what is left.';


-- ===========================================================================
-- 2. THE SAME THING, TOTALLED
-- ===========================================================================
--
-- One row per student. What a Registrar needs at a glance and what the record
-- screen opens on.
--
-- EVERY FIGURE IS COUNTED FROM A ROW. `credits_required` is the programme
-- version's own total, not a number typed into a component — that was the
-- fault `graduation.ts` was written to correct, where the Certificate
-- Generator compared against the literal 111 at a University whose Bachelor of
-- Theology is 180.

create or replace view student_academic_record
with (security_invoker = true) as
select s.id                                          as student_id,
       s.matric_no,
       s.student_number,
       -- THE DOUBLE SPACE A NULL MIDDLE NAME LEAVES BEHIND.
       --
       -- Written first as first || ' ' || middle || ' ' || last with coalesce
       -- on each, which reads 'Mabel  Holten' for everybody who has no middle
       -- name — most people. Found by printing it, not by reading it.
       -- `concat_ws` skips nulls, so there is no gap to collapse.
       nullif(trim(both ' ' from
         concat_ws(' ', s.first_name, s.middle_name, s.last_name)), '')
                                                     as full_name,
       s.status,
       s.student_status,
       s.academic_standing,
       s.admission_year,
       s.programme_version_id,
       p.code                                        as programme_code,
       v.name                                        as programme_name,
       v.version_label,
       v.duration_years,
       v.semesters_per_year,
       v.total_credits                               as credits_required,
       -- ---- WHAT THEY HAVE DONE ------------------------------------------
       coalesce(prog.passed, 0)                      as courses_passed,
       coalesce(prog.failed, 0)                      as courses_failed,
       coalesce(prog.registered, 0)                  as courses_registered,
       coalesce(prog.not_taken, 0)                   as courses_outstanding,
       coalesce(prog.credits_earned, 0)              as credits_earned,
       coalesce(prog.credits_registered, 0)          as credits_registered,
       -- HOW FAR FROM THE AWARD. Negative means short. Null where the
       -- programme states no total to measure against — which is a different
       -- thing from being on target, and is why it is not coalesced to zero.
       case when v.total_credits is null then null
            else coalesce(prog.credits_earned, 0) - v.total_credits
       end                                           as credits_against_award,
       -- ---- AND WHAT THE GPA ENGINE LAST COMPUTED ------------------------
       --
       -- READ, NOT RECOMPUTED. `semester_gpas` is written by the recompute
       -- route against the published scale; a view that did its own arithmetic
       -- here would be a second grading scale, and the two would disagree the
       -- first time the Senate changed one.
       g.cgpa,
       g.gpa                                         as last_semester_gpa,
       g.academic_year                               as last_computed_year,
       g.semester                                    as last_computed_semester
  from students s
  left join programme_versions v on v.id = s.programme_version_id
  left join programmes p on p.id = v.programme_id
  left join lateral (
    select count(*) filter (where pr.state = 'passed')                     as passed,
           count(*) filter (where pr.state = 'failed')                     as failed,
           count(*) filter (where pr.state = 'registered')                 as registered,
           count(*) filter (where pr.state = 'not-taken')                  as not_taken,
           coalesce(sum(pr.credits) filter (where pr.state = 'passed'), 0) as credits_earned,
           coalesce(sum(pr.credits) filter (where pr.state = 'registered'), 0)
                                                                          as credits_registered
      from student_curriculum_progress pr
     where pr.student_id = s.id
  ) prog on true
  left join lateral (
    select sg.cgpa, sg.gpa, sg.academic_year, sg.semester
      from semester_gpas sg
     where sg.student_id = s.id
     order by sg.academic_year desc, sg.semester desc
     limit 1
  ) g on true;

comment on view student_academic_record is
  'One row per student: their programme, how far through the curriculum they are, credits earned '
  'against the award, and the GPA the engine last computed. `credits_against_award` is null where '
  'the programme states no total — which is not the same as being on target.';


-- ===========================================================================
-- 3. A TERM AT A TIME
-- ===========================================================================
--
-- The shape the University asked for: "Year 1 — Semester 1, 30 / 30 credits."
--
-- KEYED ON THE TERM THE COURSE WAS ACTUALLY TAKEN IN, not on the curriculum's
-- year and semester. Those are two different facts and conflating them is a
-- real error: a student who repeats a year takes a Year 1 course in their
-- second year, and a progress sheet that files it under Year 1 shows them
-- passing a term they were not enrolled in.

create or replace view student_term_record
with (security_invoker = true) as
select e.student_id,
       e.academic_year,
       e.semester,
       count(*)                                                  as courses_taken,
       count(*) filter (where r.grade_point > 0)                 as courses_passed,
       count(*) filter (where r.id is not null
                          and r.grade_point = 0)                 as courses_failed,
       count(*) filter (where r.id is null)                      as awaiting_result,
       coalesce(sum(c.credit_unit), 0)                           as credits_attempted,
       coalesce(sum(c.credit_unit) filter (where r.grade_point > 0), 0) as credits_earned,
       g.gpa,
       g.cgpa
  from enrollments e
  join courses c on c.id = e.course_id
  left join lateral (
    select r2.id, r2.grade_point
      from results r2
     where r2.student_id = e.student_id
       and r2.course_id = e.course_id
       and r2.status = 'approved'
     order by coalesce(r2.attempt, 1) desc
     limit 1
  ) r on true
  left join semester_gpas g
    on g.student_id = e.student_id
   and g.academic_year = e.academic_year
   and g.semester = e.semester
 where e.status = 'registered'
 group by e.student_id, e.academic_year, e.semester, g.gpa, g.cgpa;

comment on view student_term_record is
  'A student''s terms, one row each, with credits attempted and earned. Keyed on the term the '
  'course was TAKEN in rather than the curriculum''s year and semester — a student repeating a '
  'year takes a Year 1 course in their second year, and filing it under Year 1 shows them '
  'passing a term they were not enrolled in.';


-- ===========================================================================
-- 4. PROVE IT
-- ===========================================================================

do $$
declare
  v_id      uuid;
  stu       uuid;
  crs_a     uuid;
  crs_b     uuid;
  crs_c     uuid;
  dept      uuid;
  enr       uuid;
  n         integer;
  st        text;
  earned    numeric;
begin
  begin
    -- ---- A PROGRAMME VERSION OF ITS OWN, WITH THREE COURSES IN IT -------
    --
    -- CREATED RATHER THAN BORROWED. The first version of this proof took the
    -- oldest existing programme version and asserted the progress view
    -- returned three rows. It returned eighteen, because 062 had already
    -- written fifteen courses into that curriculum — the assertion was
    -- measuring the seed, not the view.
    --
    -- A proof that shares state with the data it is running against is a proof
    -- whose result depends on what else has been seeded, which is no proof.
    declare
      prog_id uuid;
    begin
      insert into programmes (code, award_level, status)
        values ('proof-067-programme', 'Diploma', 'draft')
        returning id into prog_id;
      insert into programme_versions
        (programme_id, version_label, name, duration_years, semesters_per_year,
         total_credits, status, effective_from)
        values (prog_id, 'v-proof', 'A Proof Programme', 1, 2, 13, 'draft', date '2026-08-15')
        returning id into v_id;
    end;

    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
        values ('Proof 067', 'P067', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PROOF-067-A', 'A Passed Course', 4, dept, 100, 1, 1) returning id into crs_a;
    insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PROOF-067-B', 'A Failed Course', 4, dept, 100, 1, 1) returning id into crs_b;
    insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PROOF-067-C', 'An Untaken Course', 4, dept, 100, 2, 1) returning id into crs_c;

    insert into curriculum_entries (programme_version_id, course_id, year, semester, requirement, credits)
      values (v_id, crs_a, 1, 1, 'core', 5),   -- NOTE: 5, not the course's 4
             (v_id, crs_b, 1, 1, 'core', 4),
             (v_id, crs_c, 1, 2, 'core', 4);

    insert into students (matric_no, first_name, last_name, email, department_id,
                          program, degree_type, admission_year, status, programme_version_id)
      values ('PROOF/067/1', 'A', 'Candidate', 'proof-067@example.test', dept,
              'Proof', 'Proof', 2026, 'enrolled', v_id)
      returning id into stu;

    -- ---- PASSED, FAILED, REGISTERED, NOT TAKEN -------------------------
    insert into enrollments (student_id, course_id, academic_year, semester, status)
      values (stu, crs_a, 2026, 1, 'registered') returning id into enr;
    insert into results (student_id, course_id, enrollment_id, grade, grade_point, status)
      values (stu, crs_a, enr, 'A', 4.0, 'approved');

    insert into enrollments (student_id, course_id, academic_year, semester, status)
      values (stu, crs_b, 2026, 1, 'registered') returning id into enr;
    insert into results (student_id, course_id, enrollment_id, grade, grade_point, status)
      values (stu, crs_b, enr, 'F', 0.0, 'approved');

    select count(*) into n from student_curriculum_progress where student_id = stu;
    if n <> 3 then
      raise exception
        '067 FAILED: the curriculum has 3 courses and the progress view returned %', n;
    end if;

    select state into st from student_curriculum_progress
      where student_id = stu and course_id = crs_a;
    if st <> 'passed' then raise exception '067 FAILED: a passed course reads %', st; end if;

    select state into st from student_curriculum_progress
      where student_id = stu and course_id = crs_b;
    if st <> 'failed' then raise exception '067 FAILED: a failed course reads %', st; end if;

    -- THE ONE THAT MATTERS MOST: a course the student has not reached must
    -- still appear, because a list of only what has been done cannot show
    -- what is left.
    select state into st from student_curriculum_progress
      where student_id = stu and course_id = crs_c;
    if st <> 'not-taken' then
      raise exception '067 FAILED: an untaken course reads % rather than not-taken', st;
    end if;

    -- ---- THE CURRICULUM'S CREDIT, NOT THE COURSE'S ----------------------
    --
    -- PROOF-067-A is worth 4 in the catalogue and 5 in this curriculum. The
    -- record must count 5: that is the whole reason 057 put the figure on the
    -- entry, and a view reading the course's own number would disagree with
    -- `curriculum_progress` about whether a degree is complete.
    select credits_earned into earned from student_academic_record where student_id = stu;
    if earned <> 5 then
      raise exception
        '067 FAILED: credits earned came to % — the curriculum says PROOF-067-A is worth 5, the '
        'catalogue says 4, and the curriculum governs', earned;
    end if;

    -- ---- AN UNAPPROVED MARK IS NOT A PASS -------------------------------
    --
    -- PROVE THE RULE BY BREAKING IT. A mark entered and not yet approved is a
    -- proposal; counting it tells a student they have finished a course the
    -- University has not agreed they have finished.
    insert into enrollments (student_id, course_id, academic_year, semester, status)
      values (stu, crs_c, 2026, 2, 'registered') returning id into enr;
    insert into results (student_id, course_id, enrollment_id, grade, grade_point, status)
      values (stu, crs_c, enr, 'A', 4.0, 'draft');

    select state into st from student_curriculum_progress
      where student_id = stu and course_id = crs_c;
    if st <> 'registered' then
      raise exception
        '067 FAILED: a course with an UNAPPROVED mark reads % — an unapproved mark is a proposal, '
        'not a pass', st;
    end if;

    select credits_earned into earned from student_academic_record where student_id = stu;
    if earned <> 5 then
      raise exception '067 FAILED: an unapproved mark added % credits to the record', earned - 5;
    end if;

    -- ---- A NULL MIDDLE NAME LEAVES NO DOUBLE SPACE ----------------------
    --
    -- The proof student has no middle name, which is the ordinary case. The
    -- first version of this view read 'A  Candidate'.
    if exists (select 1 from student_academic_record
                where student_id = stu and full_name like '%  %') then
      raise exception
        '067 FAILED: a student with no middle name reads with a double space in their name';
    end if;
    if (select full_name from student_academic_record where student_id = stu)
       <> 'A Candidate' then
      raise exception '067 FAILED: the name reads "%"',
        (select full_name from student_academic_record where student_id = stu);
    end if;

    -- ---- AND THE TERM VIEW COUNTS THE TERM IT WAS TAKEN IN --------------
    select courses_taken into n from student_term_record
      where student_id = stu and academic_year = 2026 and semester = 1;
    if n <> 2 then
      raise exception '067 FAILED: 2026 semester 1 shows % courses, not 2', n;
    end if;

    select courses_outstanding into n from student_academic_record where student_id = stu;
    if n <> 0 then
      raise exception
        '067 FAILED: every course is now taken and % are still counted outstanding', n;
    end if;

    raise notice '067 OK — a student''s whole curriculum is visible including what they have not '
                 'reached; the curriculum''s credit governs over the catalogue''s; an unapproved '
                 'mark is not a pass; and a term counts the courses taken in it.';

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;
end $$;
