-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — WHAT LANDED
--
-- Run after RUN.sql. Reads only; changes nothing.
--
-- Each query answers one question the migrations were run to settle. Read the
-- expected value beside each before you read the result — a number you have
-- not predicted is a number you will accept.
-- ===========================================================================

-- 1. THE AWARDS AND THEIR CREDIT VALUES.                    (006, 012)
--
-- Expect: every diploma 120, every bachelor's 180, every master's 120.
-- The University ruled "Diploma is 120. 180 is degree." and "Masters is 120
-- credits." A row disagreeing here is a graduation audit that will refuse the
-- wrong student.
select code, title, kind, credits_required, min_cgpa, cgpa_confirmed
  from awards
 order by kind, code;

-- 2. THE CREDIT RULING, AS A VERDICT RATHER THAN A TABLE TO SQUINT AT.
--
-- Expect: zero rows. Anything returned is an award that disagrees with the
-- ruling, named.
select code, kind, credits_required,
       case kind when 'diploma' then 120 when 'bachelors' then 180
                 when 'masters' then 120 end as should_be
  from awards
 where (kind = 'diploma'   and credits_required <> 120)
    or (kind = 'bachelors' and credits_required <> 180)
    or (kind = 'masters'   and credits_required <> 120);

-- 3. THE SCHOOL OF MINISTRY DEPARTMENT.                          (011)
--
-- Expect: exactly one row, code SOM.
select id, code, name, faculty from departments where code = 'SOM';

-- 4. THE BACHELOR OF MINISTRY, COUNTED.                          (011)
--
-- Expect: 34 courses, 180 ECTS, 6 distinct semester/year pairs.
-- These are the same three numbers the website publishes and the same three
-- the migration asserted at load time. If they differ from 34 / 180, the
-- catalogue and the registry are describing different degrees.
select count(*)                       as courses,
       sum(credit_unit)               as ects,
       count(distinct (year, semester)) as terms,
       min(credit_unit)               as smallest_course,
       max(credit_unit)               as largest_course
  from courses
 where programme_slug = 'bachelor-of-ministry';

-- 5. THE SHAPE OF THE PLAN, TERM BY TERM.                        (011)
--
-- Expect: six rows, every one at 30 ECTS. A standard semester is 30 and six of
-- them are the degree; a term that is not 30 is a plan a student cannot follow.
select year, semester, count(*) as courses, sum(credit_unit) as ects
  from courses
 where programme_slug = 'bachelor-of-ministry'
 group by year, semester
 order by year, semester;

-- 6. THE PREREQUISITE CHAIN.                                     (011)
--
-- Expect: 25 courses with a prerequisite, 1 of them 'any' (BIB 103, which the
-- framework states as "BIB 101 or BIB 102"), 2 with an ECTS threshold
-- (RES 301 at 60, MIN 308 at 120), and 0 co-requisites until the University
-- rules on FIN 201 and COM 302.
--
-- THAT 25 WAS WRITTEN AS 23 AND THE FIRST REAL RUN CORRECTED IT. The figure had
-- been recalled rather than counted, which is precisely the failure this file's
-- own header warns about — "a number you have not predicted is a number you
-- will accept" — reached by the person writing the predictions. Nine of the
-- thirty-four courses are ungated: the six of Semester 1, HIS 101, and RES 301
-- and MIN 308, whose requirement is a credit threshold and not a named course.
--
-- The 'any' count is the one worth reading. Every other prerequisite is a
-- conjunction; if this returns 0 the AND/OR distinction has been lost, and a
-- registry would then refuse a student who has satisfied BIB 103's requirement.
select count(*) filter (where cardinality(prerequisites) > 0) as gated,
       count(*) filter (where requires_mode = 'any')          as disjunctions,
       count(*) filter (where requires_ects is not null)      as credit_thresholds,
       count(*) filter (where cardinality(co_requisites) > 0) as co_requisites
  from courses
 where programme_slug = 'bachelor-of-ministry';

-- 6b. THE CREDIT VALUES ARE ECTS, AND SAY SO.                    (011)
--
-- Expect: one row — ECTS, 34.
--
-- `courses.credit_system` defaults to 'credit_hour', because that is what the
-- catalogue seeded before this programme existed. Five ECTS and five credit
-- hours are not the same quantity, and a row that says 5 without saying which
-- is the one thing a credential evaluator will not accept. If this returns
-- 'credit_hour' the seed has landed with the wrong unit and every transcript
-- drawn from it will understate the degree.
select credit_system, count(*)
  from courses
 where programme_slug = 'bachelor-of-ministry'
 group by credit_system;

-- 7. NO PREREQUISITE POINTS AT A COURSE THAT DOES NOT EXIST.     (011)
--
-- Expect: zero rows. A prerequisite naming a course the registry does not hold
-- is a rule that can never be satisfied, and the student finds out at
-- registration.
select c.code, p.needs
  from courses c
  cross join lateral unnest(c.prerequisites) as p(needs)
 where c.programme_slug = 'bachelor-of-ministry'
   and not exists (select 1 from courses x where x.code = p.needs);

-- 8. THE TERMINOLOGY.                                            (011)
--
-- Expect: three rows — THE 101, THE 102 and BIB 104 — and no course anywhere
-- in this programme containing "Jesus" or "Holy Spirit". The School of
-- Ministry uses Yahuah for the Creator, Yahusha for the Messiah and the Ruach
-- HaQodesh for the Spirit.
select code, title
  from courses
 where programme_slug = 'bachelor-of-ministry'
   and (title ilike '%Yahuah%' or title ilike '%Yahusha%' or title ilike '%Ruach%'
        or description ilike '%Yahuah%' or description ilike '%Yahusha%')
 order by code;

-- 9. …AND NOTHING SLIPPED THROUGH.                               (011)
--
-- Expect: zero rows.
select code, title
  from courses
 where programme_slug = 'bachelor-of-ministry'
   and (title ilike '%Jesus%' or description ilike '%Jesus%'
        or title ilike '%Holy Spirit%' or description ilike '%Holy Spirit%');

-- 10. THE WRITE POLICIES THE INTERFACE NEEDS.                    (010)
--
-- Expect: INSERT and UPDATE policies on courses and payments, and at minimum a
-- SELECT on documents. Migration 010 exists because whole screens of the portal
-- were writing into a database that refused them — quietly, because
-- supabase-js returns an error object rather than throwing, so an unchecked
-- screen shows a spinner and looks like it worked.
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('courses', 'payments', 'documents')
 order by tablename, cmd, policyname;

-- 11. THE COLUMNS THE CURRICULUM NEEDED.                         (011)
--
-- Expect: prerequisites, requires_mode, requires_ects, prerequisite_text,
-- co_requisites, credit_system, programme_slug.
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'courses'
   and column_name in ('prerequisites', 'requires_mode', 'requires_ects',
                       'prerequisite_text', 'co_requisites', 'credit_system',
                       'programme_slug')
 order by column_name;

-- 12. HAS ANYTHING BEEN CONFERRED?                               (004, 012)
--
-- Expect: zero, today. If this is not zero, the credit ruling reached documents
-- the University has already sealed, and whether they need reissue, a
-- corrigendum or nothing at all is a decision for the Senate — not for a
-- migration, which is why 012 raises a notice and does not touch them.
select kind, status, count(*)
  from credentials_issued
 group by kind, status
 order by kind, status;
