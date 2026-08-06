-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE GPA ENGINE
--
-- Run after 006_awards_and_graduation.sql. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHY THIS EXISTS, AND IT IS NOT A NEW FEATURE
--
-- The classification engine was already built and already wired. src/lib/grading.ts
-- computes grades, quality points, GPA, CGPA and the class of award from the
-- university's published scale, and it is covered by tests.
-- /api/credential/issue calls getClassification() and REFUSES to issue a
-- certificate when it cannot — the class of a degree is not a field a caller
-- may state.
--
-- Both of those read the cumulative GPA from a table called semester_gpas.
--
-- THAT TABLE WAS NEVER CREATED, AND NOTHING EVER WROTE TO IT. Two call sites
-- select from it; no code path in the entire system inserts or updates a row.
-- So the calculator was correct, the refusal was correct, and the input was
-- empty — every attempt to issue a certificate returned "no-cgpa" and the
-- engine never once fired. From the outside that is indistinguishable from
-- there being no engine at all, which is exactly how it looked.
--
-- This migration creates the table. The route that fills it is
-- /api/results/recompute.
--
-- ---------------------------------------------------------------------------
-- WHAT A ROW MEANS, AND WHY `basis` IS ON IT
--
-- A GPA computed from marks a lecturer has typed but nobody has approved is not
-- the same fact as a GPA computed from marks that have been through the
-- lecturer → HOD → Dean → Registrar chain, and a certificate must never rest on
-- the first. So every row records which it is, and the issuing route accepts
-- only 'approved'.
--
-- Without that column the two are indistinguishable the moment they are stored,
-- and the safe-looking default — compute from whatever is there — is how a
-- university ends up conferring a First on a spreadsheet that was still being
-- edited.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TABLE
-- ===========================================================================

create table if not exists semester_gpas (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references students (id) on delete cascade,

  -- Which semester this row is the GPA for. Taken from the enrolment, because
  -- that is where the university records when a course was taken; a result
  -- carries a mark, not a calendar.
  academic_year    integer not null,
  semester         integer not null,

  -- The semester's own average, and the running cumulative average up to and
  -- including it. Both are stored rather than one derived from the other: a
  -- transcript prints the semester figure beside each term and the cumulative
  -- figure at the foot, and recomputing the running total on every read would
  -- make the two disagree the moment a back-dated result was posted.
  gpa              numeric(4,2) not null check (gpa >= 0 and gpa <= 4),
  cgpa             numeric(4,2) not null check (cgpa >= 0 and cgpa <= 4),

  -- What the averages were computed over. A CGPA without its credit count
  -- cannot be checked by anybody, and a graduation decision needs the credits
  -- anyway.
  credits_attempted integer not null default 0 check (credits_attempted >= 0),
  credits_earned    integer not null default 0 check (credits_earned >= 0),

  -- 'approved'    — every result counted has been through the approval chain.
  --                 Only this may support a certificate.
  -- 'provisional' — at least one unapproved mark was counted. Useful to a
  --                 student and to an adviser; not a basis for conferral.
  basis            text not null default 'provisional'
                     check (basis in ('approved', 'provisional')),

  computed_at      timestamptz not null default now(),
  computed_by      uuid,

  -- One row per student per semester. The recompute route upserts on this, so
  -- posting a late result corrects the row rather than adding a second one that
  -- silently disagrees with the first.
  unique (student_id, academic_year, semester)
);

create index if not exists semester_gpas_student_idx
  on semester_gpas (student_id, academic_year desc, semester desc);


-- ===========================================================================
-- 2. RLS
--
-- A student may read their own averages. Staff who can see results can see the
-- averages computed from them. NOBODY writes from a browser: with RLS on and no
-- write policy, only the service role can, and the only thing holding the
-- service role is /api/results/recompute — which recomputes from the marks
-- rather than accepting a figure.
--
-- That is the whole point. A GPA that can be written directly is a GPA that can
-- be typed, and a classification derived from a typed GPA is a classification
-- somebody chose.
-- ===========================================================================

alter table semester_gpas enable row level security;

drop policy if exists semester_gpas_own_read on semester_gpas;
create policy semester_gpas_own_read on semester_gpas
  for select using (
    -- auth_user_id, NOT user_id. The students table links to auth.users through
    -- auth_user_id (see 000_complete.sql); a policy naming a column that does
    -- not exist fails at CREATE POLICY, so this would have stopped the
    -- migration on its first line of RLS.
    student_id in (select id from students where auth_user_id = auth.uid())
  );

drop policy if exists semester_gpas_staff_read on semester_gpas;
create policy semester_gpas_staff_read on semester_gpas
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                    'vice-chancellor', 'dean', 'hod', 'lecturer')
  );


-- ===========================================================================
-- 3. THE GUARD
--
-- A trigger, because RLS cannot restrict columns and a policy cannot express
-- "this figure must have been computed". The service role bypasses RLS entirely,
-- so without this the one identity that CAN write is also the one identity with
-- no constraint on what it writes.
--
-- It refuses a cumulative average that is lower than the semester average it
-- contains on a student's first recorded semester, which is arithmetically
-- impossible — the CGPA of one semester IS that semester's GPA. It is a cheap
-- check that catches the class of bug where the two are computed in the wrong
-- order or assigned to the wrong column, which is the mistake that would
-- otherwise print a Third on a First Class transcript.
-- ===========================================================================

create or replace function semester_gpas_guard()
returns trigger language plpgsql as $$
declare
  earlier integer;
begin
  select count(*) into earlier
  from semester_gpas g
  where g.student_id = new.student_id
    and (g.academic_year, g.semester) < (new.academic_year, new.semester);

  if earlier = 0 and abs(new.cgpa - new.gpa) > 0.005 then
    raise exception 'semester_gpas: on a student''s first recorded semester the cumulative average must equal the semester average (got gpa=%, cgpa=%). This is arithmetically impossible and means the two were computed in the wrong order or written to the wrong columns.', new.gpa, new.cgpa;
  end if;

  if new.credits_earned > new.credits_attempted then
    raise exception 'semester_gpas: credits_earned (%) exceeds credits_attempted (%). A student cannot pass more credits than they sat.', new.credits_earned, new.credits_attempted;
  end if;

  return new;
end $$;

drop trigger if exists semester_gpas_guard_trg on semester_gpas;
create trigger semester_gpas_guard_trg
  before insert or update on semester_gpas
  for each row execute function semester_gpas_guard();


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

select count(*) as rows_now from semester_gpas;

-- How many students have results but no computed average. Every one of these
-- is a student whose certificate cannot currently be issued.
select count(distinct r.student_id) as students_with_results_but_no_gpa
from results r
where not exists (select 1 from semester_gpas g where g.student_id = r.student_id);


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- 1. Recompute. Nothing is computed by this migration — the marks are the
--    source and the route is the only thing allowed to read them:
--
--      POST /api/results/recompute            { "studentId": "…" }
--      POST /api/results/recompute            { "all": true }
--
--    The Studio's Readiness panel reports how many students still have none.
--
-- 2. Understand what you will get. Results are written by the mark sheet with
--    status 'draft' and NOTHING in this system advances them — the approval
--    chain in src/lib/lifecycle.ts (lecturer → HOD → Dean → Registrar) has no
--    interface. So a recompute today produces rows with basis = 'provisional',
--    and /api/credential/issue will decline them, correctly.
--
--    That is the remaining link and it is a real gap, stated here rather than
--    discovered six weeks later by a registrar with a graduation list.
-- ===========================================================================
