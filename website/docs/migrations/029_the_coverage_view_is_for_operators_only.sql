-- ===========================================================================
-- 029 — THE STATUS COVERAGE VIEW IS AN OPERATOR'S TOOL, NOT A PUBLIC ONE
--
-- Run after 028. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- Supabase's own advisor flagged this, at CRITICAL, and it is right:
--
--   Security Definer View — public.admission_status_coverage
--
-- 027 added that view to answer "which statuses actually exist in the table,
-- and does the vocabulary know them?" — a question an operator asks in the SQL
-- editor while diagnosing why an application is invisible.
--
-- A Postgres view runs with its OWNER's privileges unless told otherwise, so
-- it reads `students` past that table's row-level security. That is exactly
-- what makes it useful to an operator and exactly what makes it wrong to leave
-- reachable by everybody: the view has NO `where` clause of its own, so any
-- signed-in account — a student — could read it through the API and learn the
-- shape of the University's entire admissions pipeline. Not names, but how
-- many people applied, how many were rejected, how many are stuck.
--
-- THE VIEW IS NOT THE PROBLEM; ITS AUDIENCE IS. It stays, and it is taken off
-- the public API.
--
-- ---------------------------------------------------------------------------
-- WHY exam_sessions_mine IS LEFT ALONE, THOUGH THE ADVISOR NAMES IT TOO
-- ---------------------------------------------------------------------------
--
-- That view is security-definer ON PURPOSE and must stay that way. Migration
-- 016 DROPPED the policy that let a candidate read their own row in
-- exam_sessions — because that row carries the answer key of their own paper —
-- and put this view in its place. The view carries its own gate,
-- `where st.auth_user_id = auth.uid()`, and omits the key.
--
-- So a candidate reads their sitting through the view and has no other route
-- to it. Making it security-invoker would return nothing to them and no
-- candidate could see the examination they are sitting. The advisor is
-- flagging a pattern; here the pattern is the mechanism.
--
-- The difference between the two is one line: that view filters by the caller
-- and mine did not.
-- ===========================================================================


-- ===========================================================================
-- 1. OFF THE PUBLIC API
--
-- PostgREST serves whatever `anon` and `authenticated` may select. Revoking is
-- what removes it; the view itself is untouched and still readable by the
-- service role, which is how the Readiness panel probes for 027 and how an
-- operator reads it in the SQL editor.
-- ===========================================================================

do $$
begin
  if to_regclass('public.admission_status_coverage') is null then
    raise exception '029 FAILED: admission_status_coverage is missing — run 027 first';
  end if;

  revoke all on public.admission_status_coverage from anon;
  revoke all on public.admission_status_coverage from authenticated;

  -- Stated rather than assumed. The service role is what the application's
  -- admin routes hold, and the probe in src/lib/migrationProbes.ts reads this
  -- view through it; a revoke that caught it too would turn the Readiness
  -- panel's report of 027 from "applied" into "outstanding".
  grant select on public.admission_status_coverage to service_role;
end $$;

comment on view public.admission_status_coverage is
  'OPERATORS ONLY — revoked from anon and authenticated in 029. Every status '
  'actually present in students, and whether admission_states declares it. It '
  'reads past row-level security and carries no filter of its own, so it must '
  'not be reachable through the public API. Rows with in_vocabulary = false are '
  'records the admissions screens may not be able to show; the enrolled-student '
  'statuses (active, graduated, suspended) appear there legitimately, because '
  'students.status carries both vocabularies.';


-- ===========================================================================
-- 2. PERFORMING THE RULES
-- ===========================================================================

do $$
begin
  -- THE ADVISOR'S FINDING, CHECKED RATHER THAN ASSUMED CLOSED.
  if has_table_privilege('anon', 'public.admission_status_coverage', 'SELECT') then
    raise exception '029 FAILED: anon can still read the coverage view';
  end if;
  if has_table_privilege('authenticated', 'public.admission_status_coverage', 'SELECT') then
    raise exception '029 FAILED: a signed-in account can still read the coverage view';
  end if;

  -- AND THE ONE THAT MUST STILL WORK. Revoking too widely would break the
  -- Readiness panel rather than only the leak.
  if not has_table_privilege('service_role', 'public.admission_status_coverage', 'SELECT') then
    raise exception '029 FAILED: the service role can no longer read the coverage view, so the '
                    'Readiness panel would report 027 as outstanding';
  end if;

  -- exam_sessions_mine IS DELIBERATELY UNTOUCHED. Asserted so that a future
  -- migration written to satisfy the advisor in bulk has to notice this one
  -- first: revoking it would leave candidates unable to read their own sitting.
  if to_regclass('public.exam_sessions_mine') is not null
     and not has_table_privilege('authenticated', 'public.exam_sessions_mine', 'SELECT') then
    raise exception '029 FAILED: candidates can no longer read their own examination sitting';
  end if;

  raise notice '029 OK — the coverage view is readable by the service role and by nobody else, '
               'and candidates can still read their own sitting.';
end $$;


-- ===========================================================================
-- 3. VERIFY
-- ===========================================================================

-- Who may read each of the two views the advisor named. `admission_status_
-- coverage` should be true for service_role only; `exam_sessions_mine` should
-- be true for authenticated, because that view is how a candidate reads their
-- own examination and it filters by the caller.
select
  v.view_name,
  has_table_privilege('anon',          'public.' || v.view_name, 'SELECT') as anon_may_read,
  has_table_privilege('authenticated', 'public.' || v.view_name, 'SELECT') as signed_in_may_read,
  has_table_privilege('service_role',  'public.' || v.view_name, 'SELECT') as service_role_may_read
from (values ('admission_status_coverage'), ('exam_sessions_mine')) as v(view_name)
where to_regclass('public.' || v.view_name) is not null;
