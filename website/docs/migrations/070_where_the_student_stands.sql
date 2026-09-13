-- ===========================================================================
-- 070 — WHERE THE STUDENT STANDS
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- NOTHING IS WRITTEN AND NOTHING IS REFUSED. One function and three views
-- appear, and with them the question the student portal has never been able to
-- ask: WHERE IS THIS STUDENT IN THEIR OWN JOURNEY?
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S INSTRUCTION
-- ---------------------------------------------------------------------------
--
-- "The student web should not simply expose the Superadmin Academic modules.
-- It should be a student-facing academic journey, with information and actions
-- appearing according to the student's actual status."
--
-- That last clause is the architectural requirement, and it cannot be met by a
-- screen. A screen deciding what to show has to work the stage out for itself,
-- from two status columns and a handful of counts — and the dashboard, the
-- navigation, the registration screen and the programme page would each work
-- it out separately and come to differ. The first time they differ, a student
-- is offered a registration button on a screen that also tells them
-- registration has closed.
--
-- So the stage is decided ONCE, in `student_stage()`, and everything reads it.
--
-- ---------------------------------------------------------------------------
-- THE TWO STATUS COLUMNS, AND WHY NEITHER IS THE ANSWER ALONE
-- ---------------------------------------------------------------------------
--
-- `students.status` is the ADMISSION pipeline: draft, applicant, under_review,
-- … admission_issued, enrolled, withdrawn. It answers "how far has this
-- application got".
--
-- `students.student_status` is the ENROLLED LIFE: active, graduated,
-- suspended, withdrawn. It answers "what is this student's standing now".
--
-- Neither answers "what should this person see today". An enrolled, active
-- student with no programme version has nothing to register for; one with a
-- conferred degree is not a student at all any more; one whose registration
-- window has closed and who registered for nothing has a different problem
-- from one who registered for six courses. The stage is the combination.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.student_academic_record') is null then
    raise exception
      'Migration 067 has not been run on this database: there is no academic record for a '
      'journey to be drawn from. Run 067_one_student_one_record.sql first, or run the whole '
      'bundle.';
  end if;
  if to_regclass('public.registration_window') is null then
    raise exception
      'Migration 066 has not been run on this database: there is no registration window. Run '
      '066_when_registration_is_open.sql first, or run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. THE STAGE, DECIDED ONCE
-- ===========================================================================
--
-- Immutable and pure: the same inputs always give the same answer, and it can
-- be called from a view, from a policy, or by an operator checking a case.
--
-- THE ORDER OF THE TESTS IS THE WHOLE LOGIC and it runs from the end
-- backwards, because the later facts overrule the earlier ones. A student with
-- a conferred degree is an alumnus whatever their admission record says; a
-- withdrawal overrules an enrolment; and only after those is it worth asking
-- how far an application got.

create or replace function student_stage(
  p_status          text,
  p_student_status  text,
  p_has_conferral   boolean,
  p_has_programme   boolean,
  p_registered_now  integer
)
returns text
language sql
immutable
as $$
  select case
    -- ---- THE END OF THE JOURNEY, FIRST ---------------------------------
    when p_has_conferral                        then 'alumni'
    when p_student_status = 'graduated'         then 'graduated'
    when p_student_status = 'withdrawn'
      or p_status = 'withdrawn'                 then 'withdrawn'
    when p_student_status = 'suspended'         then 'suspended'

    -- ---- STILL IN THE ADMISSIONS PIPELINE ------------------------------
    --
    -- A PERSON HERE IS NOT YET A STUDENT, and the portal must not offer them
    -- a curriculum, a timetable or a registration button. The Admissions
    -- Portal is where their journey is, and the student portal says so.
    when p_status in ('draft', 'applicant', 'under_review', 'documents_required',
                      'documents_verified', 'fee_pending', 'fee_paid',
                      'registrar_approved', 'ready_for_academic_review',
                      'returned')               then 'applying'
    when p_status in ('rejected', 'declined')   then 'not-admitted'
    when p_status = 'deferred'                  then 'deferred'

    -- ---- ADMITTED, NOT YET ENROLLED ------------------------------------
    --
    -- The offer is made and the place is not yet taken up. 024's `enrolled`
    -- is the act of turning up; until it happens there is an admission letter
    -- to read and an acceptance to make, and nothing academic to do.
    when p_status in ('approved', 'conditional', 'admission_processing',
                      'admission_processing_failed', 'admission_issued')
                                                then 'admitted'

    -- ---- ENROLLED, AND THEN IT DEPENDS ---------------------------------
    --
    -- NO PROGRAMME VERSION IS ITS OWN STAGE, not an error message on a
    -- curriculum page. A student the Registry has not yet attached to a
    -- curriculum has no courses to be recommended, no credits to count and
    -- no progress to draw — and telling them "0 of 0 credits" would say they
    -- had finished.
    when not p_has_programme                    then 'awaiting-programme'
    when coalesce(p_registered_now, 0) > 0      then 'studying'
    else                                             'registering'
  end;
$$;

comment on function student_stage(text, text, boolean, boolean, integer) is
  'Where a student stands, decided once so that the dashboard, the navigation and every screen '
  'agree. Tested from the END BACKWARDS: a conferred degree overrules everything, a withdrawal '
  'overrules an enrolment, and only then does it matter how far an application got.';


-- ===========================================================================
-- 2. MY JOURNEY — ONE ROW, FOR THE PERSON SIGNED IN
-- ===========================================================================
--
-- `security_invoker` AND `auth.uid()`: the row is the signed-in student's own
-- and nobody else's, decided in the database rather than by a screen
-- remembering to filter. A screen that forgets shows one student another's
-- progress on the first page after signing in — which is the single most
-- damaging thing a student portal can do, and this codebase has done it once
-- already with a borrowed CGPA.

create or replace view my_journey
with (security_invoker = true) as
select s.id                                   as student_id,
       s.auth_user_id,
       trim(both ' ' from
         concat_ws(' ', s.first_name, s.middle_name, s.last_name))  as full_name,
       s.first_name,
       s.matric_no,
       s.student_number,
       s.status                               as admission_status,
       s.student_status,
       s.admission_year,

       -- ---- WHERE THEY STAND ---------------------------------------------
       student_stage(
         s.status,
         s.student_status,
         g.id is not null,
         s.programme_version_id is not null,
         coalesce(reg.registered_now, 0)::integer
       )                                      as stage,

       -- ---- THE PROGRAMME ------------------------------------------------
       s.programme_version_id,
       p.code                                 as programme_code,
       v.name                                 as programme_name,
       v.version_label,
       v.duration_years,
       v.semesters_per_year,
       v.total_credits                        as credits_required,
       aw.title                               as award_title,

       -- ---- THE TERM THE UNIVERSITY IS IN --------------------------------
       --
       -- From 065's derived view, not from a stored column. See that
       -- migration: the column was set once and would have said 2026/2027 for
       -- ever.
       t.year_label,
       t.starts_in,
       t.term_sequence,
       t.term_name,

       -- ---- WHICH YEAR OF THE PROGRAMME THEY ARE IN ----------------------
       --
       -- COUNTED FROM THE CREDITS THEY HAVE EARNED, not from the years since
       -- admission. A student who repeated a year is in Year 1 of the
       -- curriculum in their second calendar year, and a portal that counts
       -- calendar years tells them they are in Year 2 and recommends courses
       -- they have not reached.
       --
       -- Null where the programme states no total, because dividing by it
       -- would be inventing a year number.
       case
         when v.total_credits is null or v.duration_years is null then null
         when v.total_credits = 0 then 1
         else least(
           v.duration_years,
           greatest(1, floor(r.credits_earned
                             / (v.total_credits::numeric / v.duration_years))::int + 1))
       end                                    as programme_year,

       -- ---- PROGRESS -----------------------------------------------------
       r.credits_earned,
       r.credits_registered,
       r.credits_against_award,
       r.courses_passed,
       r.courses_failed,
       r.courses_registered,
       r.courses_outstanding,
       r.cgpa,
       r.last_semester_gpa,

       -- ---- WHAT IS TRUE THIS TERM ---------------------------------------
       coalesce(reg.registered_now, 0)        as registered_this_term,
       coalesce(reg.credits_now, 0)           as credits_this_term,
       w.window_recorded                      as registration_window_recorded,
       w.is_open                              as registration_open,
       w.registration_opens,
       w.registration_closes,

       -- ---- AND THE END, WHERE IT HAS COME -------------------------------
       g.id                                   as graduation_id,
       g.conferred_on,
       g.classification
  from students s
  left join student_academic_record r on r.student_id = s.id
  left join programme_versions v on v.id = s.programme_version_id
  left join programmes p on p.id = v.programme_id
  left join awards aw on aw.id = s.award_id
  left join graduation_records g
    on g.student_id = s.id and g.award_id is not distinct from s.award_id
  -- THE TERM, AND IT MAY LEGITIMATELY BE ABSENT. Today can fall outside every
  -- year the calendar covers; a left join says so honestly rather than
  -- dropping the student's whole row.
  left join academic_term_now t on true
  left join registration_window w
    on w.starts_in = t.starts_in and w.term_sequence = t.term_sequence
  left join lateral (
    select count(*)                                        as registered_now,
           coalesce(sum(c.credit_unit), 0)                 as credits_now
      from enrollments e
      join courses c on c.id = e.course_id
     where e.student_id = s.id
       and e.status = 'registered'
       and e.academic_year = t.starts_in
       and e.semester = t.term_sequence
  ) reg on true
 where s.auth_user_id = auth.uid();

comment on view my_journey is
  'One row: where the signed-in student stands, their programme, the term, their progress and '
  'whether registration is open. Filtered by auth.uid() in the DATABASE — a screen that filters '
  'is a screen that can forget to, and forgetting shows one student another''s progress on the '
  'first page after signing in.';


-- ===========================================================================
-- 3. MY WEEK — WHERE TO BE, AND WHEN
-- ===========================================================================
--
-- The classes of the courses the signed-in student is registered on this term.
-- Possible only because 063 linked a registration to an offering: before it,
-- "registered on BIS 220" named no class, no room and no hour.

create or replace view my_classes
with (security_invoker = true) as
select s.id                          as student_id,
       c.code                        as course_code,
       c.title                       as course_title,
       sec.id                        as section_id,
       sec.code                      as section_code,
       sec.day_of_week,
       sec.starts_at,
       sec.ends_at,
       sec.delivery_mode,
       sec.online_link,
       rm.code                       as room_code,
       rm.name                       as room_name,
       rm.campus,
       coalesce(l.first_name || ' ' || l.last_name, null) as lecturer
  from enrollments e
  join students s on s.id = e.student_id
  join courses c on c.id = e.course_id
  join course_offerings o on o.id = e.offering_id
  join class_sections sec on sec.offering_id = o.id
  left join rooms rm on rm.id = sec.room_id
  left join lecturers l on l.id = coalesce(sec.lecturer_id, o.lecturer_id)
 where e.status = 'registered'
   and sec.day_of_week is not null
   and s.auth_user_id = auth.uid()
   -- THE CLASS THEY ARE IN, where the registration names one. Where it does
   -- not — an offering with a single class attaches automatically, but an
   -- older registration may name none — every class of the offering is shown,
   -- because a student who cannot see any is worse served than one who sees
   -- two and asks.
   and (e.section_id is null or e.section_id = sec.id);

comment on view my_classes is
  'The signed-in student''s timetabled classes this term, with the room and the lecturer. '
  'Possible only since 063: before it a registration named a course and not a class, so no '
  'student could be told where to be.';


-- ===========================================================================
-- 4. MY CURRICULUM — THE DEGREE, AS THE STUDENT READS IT
-- ===========================================================================
--
-- 067's `student_curriculum_progress` for the signed-in student alone, with
-- one column added that only a student's screen needs: whether a course is
-- available to register for NOW.
--
-- The University asked for exactly these four words: "Completed, In Progress,
-- Outstanding, Not Yet Available." The fourth is the one that needed a new
-- fact — a course is not yet available if it is not offered this term, and
-- that is an offering question, not a curriculum one.

create or replace view my_curriculum
with (security_invoker = true) as
select pr.student_id,
       pr.entry_id,
       pr.course_id,
       pr.course_code,
       pr.course_title,
       pr.year,
       pr.semester,
       pr.requirement,
       pr.credits,
       pr.grade,
       pr.grade_point,
       pr.attempt,
       pr.state,
       -- IS IT ON OFFER THIS TERM? Null where there is no current term at all.
       (o.id is not null)            as offered_now,
       o.id                          as offering_id,
       o.status                      as offering_status
  from student_curriculum_progress pr
  join students s on s.id = pr.student_id
  left join academic_term_now t on true
  left join academic_years y on y.starts_in = t.starts_in
  left join course_offerings o
    on o.course_id = pr.course_id
   and o.academic_year_id = y.id
   and o.term_sequence = t.term_sequence
 where s.auth_user_id = auth.uid();

comment on view my_curriculum is
  'The signed-in student''s own curriculum with where they are up to, plus whether each course is '
  'actually on offer this term. The University''s four words — Completed, In Progress, '
  'Outstanding, Not Yet Available — and the fourth needed the offering, not the curriculum.';


-- ===========================================================================
-- 5. PROVE IT
-- ===========================================================================

do $$
declare
  st  text;
begin
  begin
    -- ---- THE STAGE FUNCTION, AT EVERY TURN ------------------------------
    --
    -- Asserted directly rather than through the view, because the view needs a
    -- signed-in user and a migration has none. The function is where the logic
    -- is; the view only feeds it.

    -- A conferred degree overrules everything, including a withdrawal.
    st := student_stage('withdrawn', 'withdrawn', true, true, 0);
    if st <> 'alumni' then
      raise exception '070 FAILED: a graduate with a conferral reads "%" rather than alumni', st;
    end if;

    -- A withdrawal overrules an enrolment.
    st := student_stage('enrolled', 'withdrawn', false, true, 3);
    if st <> 'withdrawn' then
      raise exception '070 FAILED: a withdrawn student reads "%"', st;
    end if;

    -- AN APPLICANT IS NOT A STUDENT. This is the one that matters most for
    -- the portal: offering a curriculum, a timetable or a registration button
    -- to somebody whose application is still under review is the portal
    -- telling them they have a place.
    st := student_stage('under_review', null, false, false, 0);
    if st <> 'applying' then
      raise exception '070 FAILED: an application under review reads "%"', st;
    end if;

    st := student_stage('admission_issued', null, false, false, 0);
    if st <> 'admitted' then
      raise exception '070 FAILED: an issued admission reads "%"', st;
    end if;

    -- ENROLLED WITH NO CURRICULUM IS ITS OWN STAGE, not an error on a
    -- progress page. Without this the student is shown "0 of 0 credits",
    -- which reads as a completed degree.
    st := student_stage('enrolled', 'active', false, false, 0);
    if st <> 'awaiting-programme' then
      raise exception
        '070 FAILED: an enrolled student with no curriculum reads "%" rather than '
        'awaiting-programme', st;
    end if;

    st := student_stage('enrolled', 'active', false, true, 0);
    if st <> 'registering' then
      raise exception '070 FAILED: an enrolled student with no registrations reads "%"', st;
    end if;

    st := student_stage('enrolled', 'active', false, true, 6);
    if st <> 'studying' then
      raise exception '070 FAILED: a student registered on six courses reads "%"', st;
    end if;

    -- A NULL COUNT IS NOT SIX. A student whose registrations could not be
    -- counted must not be told they are studying.
    st := student_stage('enrolled', 'active', false, true, null);
    if st <> 'registering' then
      raise exception '070 FAILED: a null registration count reads "%"', st;
    end if;

    -- A suspension is not a withdrawal and is not a graduation.
    st := student_stage('enrolled', 'suspended', false, true, 3);
    if st <> 'suspended' then
      raise exception '070 FAILED: a suspended student reads "%"', st;
    end if;

    -- And a refused application says so rather than reading as an applicant
    -- still waiting.
    st := student_stage('rejected', null, false, false, 0);
    if st <> 'not-admitted' then
      raise exception '070 FAILED: a refused application reads "%"', st;
    end if;

    -- ---- THE VIEWS EXIST AND ARE EMPTY WITHOUT A SIGNED-IN USER ---------
    --
    -- `auth.uid()` is null in a migration, so every one of these must return
    -- NOTHING. If any returned rows, the filter is not doing its job and one
    -- student would see another's.
    if (select count(*) from my_journey) <> 0 then
      raise exception
        '070 FAILED: my_journey returned rows with no signed-in user. The auth.uid() filter is '
        'not filtering, and every student would see every other student''s progress.';
    end if;
    if (select count(*) from my_classes) <> 0 then
      raise exception '070 FAILED: my_classes returned rows with no signed-in user';
    end if;
    if (select count(*) from my_curriculum) <> 0 then
      raise exception '070 FAILED: my_curriculum returned rows with no signed-in user';
    end if;

    raise notice '070 OK — the stage is decided once and reads correctly at every turn of the '
                 'journey; a conferral overrules a withdrawal; an applicant is not a student; '
                 'and all three views return nothing at all to nobody.';

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;
end $$;
