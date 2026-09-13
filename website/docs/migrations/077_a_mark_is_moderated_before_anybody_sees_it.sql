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
