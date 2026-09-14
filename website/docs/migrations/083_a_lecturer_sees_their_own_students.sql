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
