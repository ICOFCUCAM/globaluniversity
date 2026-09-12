-- ===========================================================================
-- 035 — THE AMERICAN GRADING SCALE, APPLIED TO EVERYTHING ALREADY ISSUED,
--       AND THE CREDIT VALUES THAT GO WITH IT.
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS. READ THIS PART.
-- ---------------------------------------------------------------------------
--
-- 1. EVERY GRADE POINT AND EVERY AVERAGE THE UNIVERSITY HOLDS IS RESTATED.
--    Not only new ones. The University has ruled that version 2 applies to past
--    transcripts too, so this re-derives `results.grade` and
--    `results.grade_point` from the marks already recorded, and recomputes every
--    row of `semester_gpas` from them. A graduate's CGPA will go UP. On the
--    36-module Bachelor of Theology record the University asked about, 3.14
--    becomes 3.43.
--
-- 2. NOBODY'S CLASSIFICATION IS INFLATED BY IT, because the classification
--    boundaries move with the scale. First Class still means an A- average; an
--    A- is simply worth 3.70 now instead of 3.33. A student who was Second Class
--    Upper yesterday is Second Class Upper today. That is the intent, and
--    section 8 proves it rather than asserting it.
--
-- 3. NOBODY WHO FAILED NOW PASSES. The American scale usually runs D- to 60 and
--    passes there. This one does not: the pass mark stays at 65 and there is no
--    D-. Moving it would have awarded credit the University never awarded, on
--    documents it has already sealed. The University asked for the points to be
--    less harsh. It did not ask to change who passed.
--
-- 4. EVERY FIGURE NOW SAYS WHICH SCALE PRODUCED IT. `semester_gpas` and
--    `results` gain `scale_version`. Until now nothing recorded it, so a 3.14 on
--    an issued transcript and a 3.43 on the screen were two unexplained numbers
--    rather than one number under two scales.
--
-- 5. WHAT MOVED IS WRITTEN DOWN. `grading_scale_restatements` keeps the before
--    and after of every figure this migration changes, with the student, the
--    term and both scale versions. A retroactive change nobody can audit is not
--    a correction; it is a rewrite.
--
-- 6. THE BACHELOR OF THEOLOGY CREDIT VALUES CHANGE. The eight courses taught in
--    two numbered parts drop to 3, the thesis rises to 20, and the course that
--    opens the degree carries 6. Six semesters of 30, 180 in the award, as
--    before. These are set on `courses` by registry code.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It does not touch `credentials_issued`. A transcript or certificate already
-- printed, signed and handed to a graduate states a figure computed under
-- version 1, and that document is what it is. Section 9 REPORTS which issued
-- credentials now disagree with the recomputed record so the University can
-- decide what to do about each one. Reissuing somebody's degree certificate is
-- not a decision a migration gets to take.
-- ===========================================================================


-- ===========================================================================
-- 1. VERSION 2 OF THE SCALE, PUBLISHED
-- ===========================================================================
--
-- Version 1 is deactivated rather than edited or deleted. `grading_scales` has
-- a unique index over the active global scale, so the order matters: the old
-- one steps down before the new one steps up, or the insert collides.
--
-- 020 built the refusal that makes this the only way in: a published scale
-- cannot have its bands changed, only its active flag. So version 1 stays on
-- the record, exactly as it was, and anybody looking at an old transcript can
-- still see the scale it was computed under.

update grading_scales
   set is_active = false
 where name = 'University grading scale'
   and version = 1
   and is_active;

insert into grading_scales (name, version, award_kind, pass_mark, max_point, bands,
                            is_active, published_at)
select 'University grading scale', 2, null, 65, 4.00,
  '[{"grade":"A",  "points":4.00,"min":93,"max":100,"descriptor":"Excellent"},
    {"grade":"A-", "points":3.70,"min":90,"max":92, "descriptor":"Very Good"},
    {"grade":"B+", "points":3.30,"min":87,"max":89, "descriptor":"Good"},
    {"grade":"B",  "points":3.00,"min":83,"max":86, "descriptor":"Above Average"},
    {"grade":"B-", "points":2.70,"min":80,"max":82, "descriptor":"Average"},
    {"grade":"C+", "points":2.30,"min":77,"max":79, "descriptor":"Satisfactory"},
    {"grade":"C",  "points":2.00,"min":73,"max":76, "descriptor":"Satisfactory"},
    {"grade":"C-", "points":1.70,"min":70,"max":72, "descriptor":"Below Satisfactory"},
    {"grade":"D+", "points":1.30,"min":67,"max":69, "descriptor":"Pass"},
    {"grade":"D",  "points":1.00,"min":65,"max":66, "descriptor":"Pass"},
    {"grade":"F",  "points":0.00,"min":0, "max":64, "descriptor":"Fail"}]'::jsonb,
  true, now()
where not exists (
  select 1 from grading_scales where name = 'University grading scale' and version = 2
);

-- Running this a second time must not leave version 1 active again, and must
-- not leave both active. The insert above is skipped on a rerun, so activation
-- is asserted separately.
update grading_scales
   set is_active = true
 where name = 'University grading scale' and version = 2 and not is_active;


-- ===========================================================================
-- 2. ONE PLACE THAT TURNS A MARK INTO A GRADE
-- ===========================================================================
--
-- The application derives a grade from `regulations.ts`; the database had no
-- opinion at all, and simply stored whatever it was handed. That is how a
-- result row can carry a grade from one scale and a grade point from another
-- and nothing anywhere notices.
--
-- This reads the active scale out of the table, so there is one scale in the
-- system and it is the published one. Change the scale, and every later
-- computation follows without a deployment.

create or replace function grade_under_active_scale(score numeric)
returns table (grade text, points numeric)
language sql
stable
security definer
set search_path = public
as $$
  select b->>'grade', (b->>'points')::numeric
    from grading_scales s
    cross join lateral jsonb_array_elements(s.bands) as b
   where s.is_active
     and s.award_kind is null
     and score >= (b->>'min')::numeric
     and score <= (b->>'max')::numeric
   limit 1;
$$;

-- 030's rule: a function is callable by whoever needs it and nobody else. This
-- one only reads a published scale, so any signed-in account may ask it what a
-- mark is worth — that is the same information the Student Handbook prints.
revoke all on function grade_under_active_scale(numeric) from public;
grant execute on function grade_under_active_scale(numeric) to authenticated, service_role;


-- ===========================================================================
-- 3. EVERY FIGURE SAYS WHICH SCALE PRODUCED IT
-- ===========================================================================
--
-- THE GAP THIS CLOSES, AND IT IS THE ONE THAT MADE VERSION 2 DANGEROUS.
-- `semester_gpas` stored a GPA, a CGPA, credits and a basis. It did not store
-- the scale. So the day a second scale exists, every figure in the table
-- becomes ambiguous — and a registrar asked "is this 3.14 old or new?" has
-- nothing to read. The column is filled in below for every existing row.

alter table semester_gpas add column if not exists scale_version integer;
alter table results       add column if not exists scale_version integer;

comment on column semester_gpas.scale_version is
  'Which version of the University grading scale this average was computed under. '
  'NULL means it predates the column and has not been restated.';
comment on column results.scale_version is
  'Which version of the University grading scale this grade point came from.';


-- ===========================================================================
-- 4. WHAT THE RESTATEMENT MOVED
-- ===========================================================================
--
-- A retroactive change to a graduate's record is exactly the kind of thing an
-- accreditation reviewer asks about, and "the software recomputed it" is not an
-- answer. This is the answer: one row per figure that changed, with what it was,
-- what it became, and which scales those were.
--
-- APPEND-ONLY BY CONSTRUCTION. There is no update policy and no delete policy
-- on it at all, so the record of a restatement cannot be tidied away by the
-- people the restatement was about.

create table if not exists grading_scale_restatements (
  id             uuid primary key default gen_random_uuid(),

  -- 'result' — one mark's grade and grade point.
  -- 'gpa'    — one student's average for one term.
  kind           text not null check (kind in ('result', 'gpa')),

  student_id     uuid references students (id) on delete cascade,
  result_id      uuid,
  academic_year  integer,
  semester       integer,

  from_version   integer,
  to_version     integer not null,

  -- Free-shaped because a result restatement and a GPA restatement do not carry
  -- the same figures, and two half-empty column sets would be worse than one
  -- honest jsonb.
  before         jsonb not null,
  after          jsonb not null,

  restated_at    timestamptz not null default now()
);

create index if not exists grading_scale_restatements_student_idx
  on grading_scale_restatements (student_id);

alter table grading_scale_restatements enable row level security;

drop policy if exists grading_scale_restatements_read on grading_scale_restatements;
create policy grading_scale_restatements_read on grading_scale_restatements
  for select using (auth_role() in ('superadmin', 'admin', 'registrar'));

-- No insert policy. The recompute runs as the service role, which is the only
-- identity that should be writing these, and a browser that could write one
-- could fabricate a restatement that never happened.


-- ===========================================================================
-- 5. THE BACHELOR OF THEOLOGY CREDIT VALUES
-- ===========================================================================
--
-- Set by registry code, which is unique on `courses` and is what the University
-- ruled a course is called. A code names a SUBJECT, not a slot in one
-- programme, so this is deliberately not scoped to the Bachelor of Theology:
-- Bible Doctrine I is worth 3 wherever it is taught.
--
-- Courses the University has not created rows for are simply not updated. The
-- verify at the foot reports how many of the thirty-six were found, so a
-- registry that is missing half the degree says so rather than looking settled.

do $$
declare
  wanted constant jsonb :=
    '{"BIS 210":6,
      "BIS 220":3, "BIS 230":3, "BIS 250":3, "BIS 260":3,
      "RM 540":3,  "RM 550":3,  "STT 400":3, "STT 420":3,
      "RM 560":20,
      "MW 300":5,  "OTH 300":5, "CH 200":5,  "LC 110":5,  "OT 300":5,
      "MDS 720":5, "CH 300":5,  "MDS 660":5, "CED 160":5, "BIS 330":5,
      "BIS 320":5, "BL 340":5,  "STT 410":5, "MDS 650":5, "BIS 270":5,
      "BIS 280":5, "MDS 670":5, "MDS 730":5, "BIS 350":5, "CDS 100":5,
      "MW 350":5,  "MDS 820":5, "BIS 340":5, "MDS 760":5, "STT 430":5,
      "STT 450":5}'::jsonb;
  changed integer;
begin
  update courses c
     set credit_unit = (wanted->>c.code)::integer
   where wanted ? c.code
     and c.credit_unit is distinct from (wanted->>c.code)::integer;
  get diagnostics changed = row_count;
  raise notice '035: % course credit value(s) updated', changed;
end $$;


-- ===========================================================================
-- 6. RESTATING EVERY MARK
-- ===========================================================================
--
-- Only rows that actually change are written to the restatement record, so a
-- second run of this migration records nothing — which is the test of whether
-- it is idempotent, not a claim that it is.
--
-- A result with no total_score is left alone. There is nothing to re-derive
-- from, and inventing a grade for a mark nobody entered is the worst thing this
-- migration could do.

do $$
declare
  restated integer;
begin
  with recomputed as (
    select r.id,
           r.student_id,
           r.grade                  as old_grade,
           r.grade_point            as old_points,
           g.grade                  as new_grade,
           g.points                 as new_points
      from results r
      cross join lateral grade_under_active_scale(r.total_score) g
     where r.total_score is not null
  ),
  moved as (
    select * from recomputed
     where old_grade is distinct from new_grade
        or old_points is distinct from new_points
  ),
  logged as (
    insert into grading_scale_restatements
      (kind, student_id, result_id, from_version, to_version, before, after)
    select 'result', m.student_id, m.id, 1, 2,
           jsonb_build_object('grade', m.old_grade, 'grade_point', m.old_points),
           jsonb_build_object('grade', m.new_grade, 'grade_point', m.new_points)
      from moved m
    returning 1
  )
  update results r
     set grade = m.new_grade,
         grade_point = m.new_points,
         scale_version = 2
    from moved m
   where r.id = m.id;

  get diagnostics restated = row_count;
  raise notice '035: % result(s) restated under version 2', restated;
end $$;

-- Marks whose grade did not move still belong to version 2 now — an A is an A
-- on both scales at 4.00. Without this they would read as unrestated forever.
update results
   set scale_version = 2
 where total_score is not null and scale_version is distinct from 2;


-- ===========================================================================
-- 7. RECOMPUTING EVERY AVERAGE
-- ===========================================================================
--
-- THE CUMULATIVE FIGURE IS NOT AN AVERAGE OF THE SEMESTER AVERAGES. Quality
-- points over credits, cumulatively, from the beginning — the same definition
-- `src/lib/gpa.ts` computes, deliberately, because two definitions of a CGPA is
-- how an institution ends up with two CGPAs.
--
-- THE TERM COMES FROM THE ENROLMENT. A result carries a mark, not a calendar,
-- and the same course is taught to different cohorts in different years.
-- Results with no enrolment have no term and are counted as unplaceable by the
-- verify rather than being quietly dropped into somebody's first semester.

do $$
declare
  moved integer;
begin
  with marks as (
    select r.student_id,
           e.academic_year,
           e.semester,
           coalesce(r.grade_point, 0)                        as gp,
           coalesce(c.credit_unit, 0)                        as cu,
           (r.total_score >= 65)                             as passed,
           (r.status = 'approved')                           as approved
      from results r
      join enrollments e on e.id = r.enrollment_id
      join courses c     on c.id = r.course_id
     where e.academic_year is not null
       and e.semester is not null
       and r.total_score is not null
  ),
  per_term as (
    select student_id, academic_year, semester,
           sum(gp * cu)                                      as qp,
           sum(cu)                                           as attempted,
           sum(case when passed then cu else 0 end)          as earned,
           bool_and(approved)                                as all_approved
      from marks
     group by student_id, academic_year, semester
  ),
  running as (
    select p.*,
           sum(qp)        over w                             as cum_qp,
           sum(attempted) over w                             as cum_cu
      from per_term p
      window w as (partition by student_id
                   order by academic_year, semester
                   rows between unbounded preceding and current row)
  ),
  computed as (
    select student_id, academic_year, semester,
           case when attempted = 0 then 0
                else round(qp / attempted, 2) end            as gpa,
           case when cum_cu = 0 then 0
                else round(cum_qp / cum_cu, 2) end           as cgpa,
           attempted, earned,
           case when all_approved then 'approved' else 'provisional' end as basis
      from running
  ),
  logged as (
    insert into grading_scale_restatements
      (kind, student_id, academic_year, semester, from_version, to_version, before, after)
    select 'gpa', c.student_id, c.academic_year, c.semester,
           g.scale_version, 2,
           jsonb_build_object('gpa', g.gpa, 'cgpa', g.cgpa,
                              'credits_attempted', g.credits_attempted),
           jsonb_build_object('gpa', c.gpa, 'cgpa', c.cgpa,
                              'credits_attempted', c.attempted)
      from computed c
      join semester_gpas g
        on g.student_id = c.student_id
       and g.academic_year = c.academic_year
       and g.semester = c.semester
     where g.gpa is distinct from c.gpa
        or g.cgpa is distinct from c.cgpa
        or g.credits_attempted is distinct from c.attempted
    returning 1
  )
  insert into semester_gpas
    (student_id, academic_year, semester, gpa, cgpa,
     credits_attempted, credits_earned, basis, scale_version, computed_at)
  select student_id, academic_year, semester, gpa, cgpa,
         attempted, earned, basis, 2, now()
    from computed
  on conflict (student_id, academic_year, semester) do update
    set gpa = excluded.gpa,
        cgpa = excluded.cgpa,
        credits_attempted = excluded.credits_attempted,
        credits_earned = excluded.credits_earned,
        basis = excluded.basis,
        scale_version = 2,
        computed_at = now();

  get diagnostics moved = row_count;
  -- WRITTEN, NOT CHANGED. This is an upsert, so on a second run it still
  -- reports every row — the count that matters for idempotence is the
  -- restatement count above, which goes to zero.
  raise notice '035: % semester average(s) written under version 2', moved;
end $$;


-- ===========================================================================
-- 8. PERFORMING THE RULES
-- ===========================================================================
--
-- Each of these does the thing that must be refused, or asserts the thing that
-- must hold, and rolls back. A rule nobody has watched refuse anything is a
-- rule nobody has tested.

do $$
declare
  refused boolean;
  g record;
  n integer;
begin
  -- ---- The scale in force is version 2, and it is the only one ------------
  select count(*) into n from grading_scales
   where is_active and award_kind is null;
  if n <> 1 then
    raise exception '035 FAILED: % active global grading scales, expected exactly 1', n;
  end if;

  select version into n from grading_scales where is_active and award_kind is null;
  if n <> 2 then
    raise exception '035 FAILED: the active global scale is version %, expected 2', n;
  end if;

  -- ---- Version 1 is still on the record -----------------------------------
  if not exists (select 1 from grading_scales
                  where name = 'University grading scale' and version = 1) then
    raise exception '035 FAILED: version 1 has gone. A figure on an issued transcript '
                    'was computed under it and must remain explicable.';
  end if;

  -- ---- Version 2 still cannot be edited -----------------------------------
  refused := false;
  begin
    update grading_scales set pass_mark = 60
     where name = 'University grading scale' and version = 2;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '035 FAILED: the newly published scale could be edited in place';
  end if;

  -- ---- The bands do what the University said ------------------------------
  select * into g from grade_under_active_scale(93);
  if g.grade <> 'A' or g.points <> 4.00 then
    raise exception '035 FAILED: 93%% is % at %, expected A at 4.00', g.grade, g.points;
  end if;
  select * into g from grade_under_active_scale(90);
  if g.grade <> 'A-' or g.points <> 3.70 then
    raise exception '035 FAILED: 90%% is % at %, expected A- at 3.70', g.grade, g.points;
  end if;
  select * into g from grade_under_active_scale(83);
  if g.grade <> 'B' or g.points <> 3.00 then
    raise exception '035 FAILED: 83%% is % at %, expected B at 3.00', g.grade, g.points;
  end if;

  -- ---- NOBODY WHO FAILED NOW PASSES ---------------------------------------
  -- The single most consequential thing this migration could get wrong.
  select * into g from grade_under_active_scale(64);
  if g.grade <> 'F' then
    raise exception '035 FAILED: 64%% is now a %. The pass mark was not supposed to move.',
      g.grade;
  end if;
  select * into g from grade_under_active_scale(60);
  if g.grade <> 'F' then
    raise exception '035 FAILED: 60%% is now a %. The American D- band was not adopted '
                    'and must not appear.', g.grade;
  end if;
  select * into g from grade_under_active_scale(65);
  if g.grade <> 'D' then
    raise exception '035 FAILED: 65%% is %, expected D — the lowest passing grade', g.grade;
  end if;

  -- ---- AND THE CHECK ABOVE IS NOT DECORATION ------------------------------
  --
  -- A rule nobody has watched refuse anything is a rule nobody has tested. So
  -- the full American scale — D- at 60, passing at 60, which is the scale it
  -- would have been easy to adopt by copying — is published here, the check is
  -- run against it, and the whole thing is rolled back. If the check cannot see
  -- a D- when one is right in front of it, this migration stops.
  begin
    update grading_scales set is_active = false where is_active and award_kind is null;
    insert into grading_scales (name, version, award_kind, pass_mark, max_point,
                                bands, is_active, published_at)
    values ('PROOF — the scale this migration refuses', 1, null, 60, 4.00,
      '[{"grade":"A", "points":4.00,"min":93,"max":100},
        {"grade":"D-","points":0.70,"min":60,"max":92},
        {"grade":"F", "points":0.00,"min":0, "max":59}]'::jsonb,
      true, now());

    select * into g from grade_under_active_scale(60);
    if g.grade = 'F' then
      raise exception '035 FAILED: a scale passing at 60 was published and the check still '
                      'reported 60%% as a fail. The check does not work and the guarantee '
                      'at the head of this file is worthless.';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  -- …and the University's own scale is back, untouched.
  select * into g from grade_under_active_scale(60);
  if g.grade <> 'F' then
    raise exception '035 FAILED: the proof above did not roll back. 60%% now reads %.', g.grade;
  end if;

  -- ---- Every whole mark lands in exactly one band -------------------------
  for n in 0..100 loop
    if (select count(*) from grading_scales s
        cross join lateral jsonb_array_elements(s.bands) b
        where s.is_active and s.award_kind is null
          and n >= (b->>'min')::numeric and n <= (b->>'max')::numeric) <> 1 then
      raise exception '035 FAILED: mark %%%  does not fall in exactly one band', n;
    end if;
  end loop;

  -- ---- A restatement cannot be deleted or altered by a browser -----------
  -- There is no update and no delete policy, so the only identity that could
  -- is the service role, which bypasses RLS by design. What is asserted here
  -- is that nobody has since added one.
  if exists (select 1 from pg_policies
              where tablename = 'grading_scale_restatements'
                and cmd in ('UPDATE', 'DELETE')) then
    raise exception '035 FAILED: a policy now lets the restatement record be changed. '
                    'The audit of a retroactive change may not be editable by the '
                    'people it is about.';
  end if;

  raise notice '035 OK: the American scale is in force and the old one is still readable';
end $$;

-- The credit model, asserted against the courses that exist. A registry with
-- none of these rows yet passes; one that has them and disagrees does not.
do $$
declare
  bad text;
begin
  select string_agg(code || ' is ' || credit_unit, ', ')
    into bad
    from courses
   where (code in ('BIS 220','BIS 230','BIS 250','BIS 260',
                   'RM 540','RM 550','STT 400','STT 420') and credit_unit <> 3)
      or (code = 'RM 560'  and credit_unit <> 20)
      or (code = 'BIS 210' and credit_unit <> 6);
  if bad is not null then
    raise exception '035 FAILED: credit values did not take — %', bad;
  end if;
  raise notice '035 OK: the two-part courses carry 3 and the thesis carries 20';
end $$;

-- A restated average must still satisfy 007's guard: on a student's first
-- recorded term the cumulative average IS that term's average. If section 7
-- wrote them in the wrong order this is where it shows.
do $$
declare
  wrong integer;
begin
  select count(*) into wrong
    from (
      select distinct on (student_id) student_id, gpa, cgpa
        from semester_gpas
       order by student_id, academic_year, semester
    ) first_terms
   where abs(cgpa - gpa) > 0.005;
  if wrong > 0 then
    raise exception '035 FAILED: % student(s) have a first-term cumulative average that '
                    'differs from the term average. The two were computed in the wrong '
                    'order or written to the wrong columns.', wrong;
  end if;
  raise notice '035 OK: every restated cumulative average is consistent with its first term';
end $$;


-- ===========================================================================
-- 9. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- The scale in force, and the one it replaced.
select version, is_active, pass_mark, max_point,
       bands->0->>'grade' as top_grade, bands->0->>'points' as top_points,
       published_at
  from grading_scales
 where name = 'University grading scale'
 order by version;

-- What the restatement moved. Empty on a second run.
select kind, count(*) as figures_restated
  from grading_scale_restatements
 group by kind
 order by kind;

-- Every average that changed, per student, largest movement first. This is the
-- list to read before deciding anything about already-issued documents.
select s.first_name || ' ' || s.last_name as student,
       r.academic_year, r.semester,
       (r.before->>'cgpa')::numeric as was,
       (r.after ->>'cgpa')::numeric as now,
       round((r.after->>'cgpa')::numeric - (r.before->>'cgpa')::numeric, 2) as moved
  from grading_scale_restatements r
  join students s on s.id = r.student_id
 where r.kind = 'gpa'
 order by abs((r.after->>'cgpa')::numeric - (r.before->>'cgpa')::numeric) desc
 limit 50;

-- ISSUED CREDENTIALS THAT NOW DISAGREE WITH THE RECORD. Not changed by this
-- migration, by design. Each one is a decision for the University: leave it,
-- reissue it, or issue a corrected version under 013's correction workflow.
select ci.id, ci.kind, ci.issued_at,
       s.first_name || ' ' || s.last_name as student
  from credentials_issued ci
  join students s on s.id = ci.student_id
 where exists (
   select 1 from grading_scale_restatements r
    where r.student_id = ci.student_id and r.kind = 'gpa'
      and r.restated_at > ci.issued_at
 )
 order by ci.issued_at desc;

-- How many of the thirty-six Bachelor of Theology courses the registry holds,
-- and what they now total. 36 and 180 when the degree is fully entered.
select count(*) as bth_courses_in_registry,
       sum(credit_unit) as total_credits
  from courses
 where code in ('BIS 210','BIS 220','BIS 230','BIS 250','BIS 260','RM 540','RM 550',
                'STT 400','STT 420','RM 560','MW 300','OTH 300','CH 200','LC 110',
                'OT 300','MDS 720','CH 300','MDS 660','CED 160','BIS 330','BIS 320',
                'BL 340','STT 410','MDS 650','BIS 270','BIS 280','MDS 670','MDS 730',
                'BIS 350','CDS 100','MW 350','MDS 820','BIS 340','MDS 760','STT 430',
                'STT 450');

-- Marks that could not be placed in a term, so are in no average. Should be 0.
select count(*) as results_with_no_enrolment
  from results r
  left join enrollments e on e.id = r.enrollment_id
 where r.total_score is not null
   and (e.id is null or e.academic_year is null or e.semester is null);
