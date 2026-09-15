-- ===========================================================================
-- 091 — THE PUBLIC KEY CANNOT DESTROY THE UNIVERSITY
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- RUN THIS BEFORE ANYTHING ELSE OUTSTANDING. IT IS THE MOST SERIOUS FINDING
-- OF THE WHOLE AUDIT.
-- ---------------------------------------------------------------------------
--
-- `anon` — the publishable key, which ships in the JavaScript of every page of
-- the website and is readable by anyone who opens the developer tools — holds
-- INSERT, UPDATE, DELETE and TRUNCATE on 172 relations, and so does
-- `authenticated`, which is every student who has ever signed in.
--
-- ROW-LEVEL SECURITY DOES NOT STOP TRUNCATE. This is the part that makes it
-- critical rather than merely untidy. A policy filters the rows a DELETE may
-- reach; TRUNCATE is not a row operation and no policy is consulted at all. So
-- every carefully written policy in this schema — and there are 129 of them —
-- is bypassed completely by one statement.
--
-- Run against a database with these migrations applied, as `anon`, with no
-- account and no sign-in:
--
--     truncate profiles cascade;
--
--     NOTICE:  truncate cascades to table "credential_templates"
--     NOTICE:  truncate cascades to table "admission_openings"
--     NOTICE:  truncate cascades to table "admission_opening_events"
--     NOTICE:  truncate cascades to table "admission_decisions"
--     NOTICE:  truncate cascades to table "admission_audit_log"
--     NOTICE:  truncate cascades to table "credentials_issued"
--     NOTICE:  truncate cascades to table "credential_template_approvals"
--     NOTICE:  truncate cascades to table "credential_types"
--     NOTICE:  truncate cascades to table "credential_amendments"
--     NOTICE:  truncate cascades to table "credential_correction_requests"
--     NOTICE:  truncate cascades to table "credential_audit_events"
--
--     rows after: 0
--
-- Every account, every admission decision, every credential the University has
-- ever issued, and the audit log that would have recorded it — gone, by an
-- unauthenticated request. `students`, `appointments`, `results`,
-- `staff_records`, `exam_sessions` and `audit_logs` are on the same list.
--
-- ---------------------------------------------------------------------------
-- WHERE IT COMES FROM, AND WHY IT IS NOT ANYBODY'S MISTAKE
-- ---------------------------------------------------------------------------
--
-- It is Supabase's default posture for the `public` schema: default privileges
-- grant `anon` and `authenticated` everything on new tables, on the assumption
-- that row-level security is the whole defence. For SELECT, INSERT, UPDATE and
-- DELETE that assumption holds. For TRUNCATE it does not, and nothing in the
-- documentation says so at the point where it matters.
--
-- So no migration in this repository granted it. Every table simply inherited
-- it at creation, and has carried it ever since.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS TAKES AWAY, AND WHAT IT LEAVES ALONE
-- ---------------------------------------------------------------------------
--
-- `anon` LOSES EVERY WRITE. Not narrowed — removed. The public key is for
-- reading what the University publishes: the prospectus, the course catalogue,
-- the fee tariff, the staff directory. It was checked first: no INSERT policy
-- in this schema names `anon`, and the public application form posts to
-- `/api/apply`, which holds the service key. Nothing writes as `anon` today,
-- so nothing stops working.
--
-- `authenticated` LOSES TRUNCATE ONLY. Its INSERT, UPDATE and DELETE are left
-- exactly as they are, because policies govern those and screens depend on
-- them — a student records their own lesson progress, writes their own notes,
-- and posts in their own course's discussion. Those are proved still to work
-- at the foot of this file, because a fix that quietly broke them would be
-- discovered by a student and not by us.
--
-- AND THE DEFAULT IS CHANGED TOO, so the next table created does not inherit
-- the grant and put this back.
-- ===========================================================================


-- ===========================================================================
-- 1. THE PUBLIC KEY WRITES NOTHING
-- ===========================================================================

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;

-- ===========================================================================
-- 2. AND A SIGNED-IN SESSION CANNOT EMPTY A TABLE
-- ===========================================================================
--
-- TRUNCATE, REFERENCES AND TRIGGER, and nothing else. A browser has no use for
-- any of the three: the first empties a table past every policy, and the other
-- two are schema rights that let a session attach things to the University's
-- tables. INSERT, UPDATE and DELETE stay, governed by policy as designed.

revoke truncate, references, trigger
  on all tables in schema public from authenticated;


-- ===========================================================================
-- 3. AND THE NEXT TABLE DOES NOT INHERIT IT
-- ===========================================================================
--
-- Without this the fix lasts until the next `create table`. Default privileges
-- belong to the role that creates the object — `postgres` in a Supabase
-- project and in the local harness alike — so they are altered for that role
-- explicitly rather than for whoever happens to be running this file.
--
-- WRAPPED, because `alter default privileges for role postgres` needs to be
-- that role or a superuser. In the Supabase SQL editor it is; if it ever is
-- not, the revokes above still stand and this says plainly that the default
-- was left as it was, rather than failing the whole migration.

do $$
begin
  execute 'alter default privileges for role postgres in schema public '
          'revoke insert, update, delete, truncate, references, trigger on tables from anon';
  execute 'alter default privileges for role postgres in schema public '
          'revoke truncate, references, trigger on tables from authenticated';
  raise notice '091: the default for new tables no longer grants these rights';
exception
  when insufficient_privilege or undefined_object then
    raise warning '091: the revokes were applied, but the DEFAULT for NEW tables could not be '
                  'changed from this role. Re-run this file as the owner (postgres), or the '
                  'next table created will inherit the grant again.';
end $$;


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================
--
-- BOTH HALVES. That the public key can no longer destroy anything, and that
-- everything a signed-in student legitimately writes still writes — because a
-- fix that quietly broke the portal would be found by a student, not by us.

do $$
declare
  stu_user uuid := gen_random_uuid();
  the_student uuid;
  the_course uuid;
  the_module uuid;
  the_lesson uuid;
  before_rows integer;
  seen integer;
begin
  begin
    insert into auth.users (id, email) values (stu_user, '091-student@example.test');
    insert into profiles (id, email, role) values (stu_user, '091-student@example.test', 'student')
      on conflict (id) do update set role = excluded.role;
    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('091/PROOF', 'Signed', 'In', 'enrolled', stu_user) returning id into the_student;

    insert into courses (code, title) values ('ZZZ 9091', 'A Course For The 091 Proof')
      returning id into the_course;
    insert into enrollments (student_id, course_id, status)
      values (the_student, the_course, 'registered');
    insert into course_modules (course_id, title, visible)
      values (the_course, 'Module for the 091 proof', true) returning id into the_module;
    insert into course_lessons (module_id, course_id, kind, title, body, visible)
      values (the_module, the_course, 'text', 'A lesson', 'Body.', true)
      returning id into the_lesson;

    select count(*) into before_rows from profiles;

    -- =====================================================================
    -- THE PUBLIC KEY
    -- =====================================================================
    set local role anon;
    set local request.jwt.claim.sub = '';

    -- TRUNCATE, which is the finding. Asserted by COUNTING THE ROWS BACK
    -- rather than by trusting the refusal: a statement that succeeded and
    -- emptied the table would otherwise have to raise to be noticed.
    begin
      execute 'truncate profiles cascade';
    exception when insufficient_privilege then null;
    end;
    reset role;
    select count(*) into seen from profiles;
    if seen <> before_rows then
      raise exception '091 FAILED: the public key truncated profiles — % rows became %, and it '
                      'cascades through admission decisions, credentials and the audit log',
                      before_rows, seen;
    end if;

    set local role anon;
    set local request.jwt.claim.sub = '';

    begin
      execute 'delete from students';
    exception when insufficient_privilege then null;
    end;
    reset role;
    if not exists (select 1 from students where id = the_student) then
      raise exception '091 FAILED: the public key deleted the student register';
    end if;

    set local role anon;
    set local request.jwt.claim.sub = '';
    begin
      execute format('insert into profiles (id, email, role) values (%L, %L, %L)',
                     gen_random_uuid(), '091-forged@example.test', 'superadmin');
      raise exception '091 FAILED: the public key created an account — and gave it the '
                      'Superadministrator role';
    exception when insufficient_privilege then null;
    end;

    -- =====================================================================
    -- A SIGNED-IN STUDENT CANNOT EMPTY A TABLE EITHER
    -- =====================================================================
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', stu_user);

    begin
      execute 'truncate course_lessons cascade';
    exception when insufficient_privilege then null;
    end;
    reset role;
    if not exists (select 1 from course_lessons where id = the_lesson) then
      raise exception '091 FAILED: a signed-in student truncated the course lessons — every '
                      'policy in this schema is bypassed by that one statement';
    end if;

    -- =====================================================================
    -- AND EVERYTHING THEY LEGITIMATELY WRITE STILL WRITES
    -- =====================================================================
    --
    -- The other half, and the half a careless revoke would break. 084 gives a
    -- student their own progress and their own notes to write directly,
    -- deliberately: progress is written every few seconds while a video plays,
    -- and routing that through a service key would put the University's
    -- highest privilege behind its highest-frequency write.
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', stu_user);

    -- WRAPPED SO THE REFUSAL IS OURS. Revoking INSERT from `authenticated`
    -- along with TRUNCATE — the obvious over-correction, and the one somebody
    -- will reach for — makes Postgres raise "permission denied for table
    -- lesson_progress", which is true and says nothing about what it costs.
    -- This names it: the student portal stops working.
    begin
      insert into lesson_progress (lesson_id, student_id, state)
        values (the_lesson, the_student, 'started');
    exception
      when insufficient_privilege then
        raise exception '091 FAILED: a student can no longer record their own lesson progress. '
                        'Only TRUNCATE is to be taken from a signed-in session — its INSERT, '
                        'UPDATE and DELETE are governed by policy and the portal depends on them';
    end;
    select count(*) into seen from lesson_progress where student_id = the_student;
    if seen <> 1 then
      raise exception '091 FAILED: a student can no longer record their own lesson progress';
    end if;

    update lesson_progress set state = 'completed', completed_at = now()
     where lesson_id = the_lesson and student_id = the_student;
    if not exists (select 1 from lesson_progress
                    where student_id = the_student and state = 'completed') then
      raise exception '091 FAILED: a student can no longer mark a lesson complete';
    end if;

    insert into student_notes (student_id, course_id, lesson_id, body)
      values (the_student, the_course, the_lesson, 'A note the student wrote.');
    if not exists (select 1 from student_notes where student_id = the_student) then
      raise exception '091 FAILED: a student can no longer write their own notes';
    end if;

    delete from student_notes where student_id = the_student;
    if exists (select 1 from student_notes where student_id = the_student) then
      raise exception '091 FAILED: a student can no longer delete their own note';
    end if;

    reset role;

    raise exception 'rollback 091 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 091 proof' then raise; end if;
  end;
end $$;


-- ---------------------------------------------------------------------------
-- AND THE CATALOGUE AGREES.
--
-- Asked separately, because the behavioural proof above reaches the tables it
-- happened to name and this reaches all 172. A single table left behind is a
-- single table that can still be emptied.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  examples text;
begin
  select count(*), string_agg(distinct table_name, ', ' order by table_name)
    into n, examples
    from (
      select table_name from information_schema.role_table_grants
       where table_schema = 'public'
         and grantee = 'anon'
         and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
       limit 8
    ) t;
  if n > 0 then
    raise exception '091 FAILED: the publishable key still holds writes on %, including %',
                    n, examples;
  end if;

  select count(*), string_agg(distinct table_name, ', ' order by table_name)
    into n, examples
    from (
      select table_name from information_schema.role_table_grants
       where table_schema = 'public'
         and grantee = 'authenticated'
         and privilege_type = 'TRUNCATE'
       limit 8
    ) t;
  if n > 0 then
    raise exception '091 FAILED: a signed-in session still holds TRUNCATE on %, including % — '
                    'no policy is consulted on a truncate', n, examples;
  end if;
end $$;


do $$
begin
  raise notice '091 OK: the publishable key can no longer insert, update, delete or TRUNCATE '
               'anything — and it never could write anything legitimately, so nothing breaks';
  raise notice '091 OK: no signed-in session can empty a table past every policy in the schema';
  raise notice '091 OK: and a student still records their own progress, writes their own notes '
               'and deletes them, exactly as before';
end $$;
