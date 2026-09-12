-- ===========================================================================
-- 030 — EVERY FUNCTION PINS ITS SEARCH PATH, AND THE ONE THAT MATTERS IS
--       TAKEN OFF THE PUBLIC API
--
-- Run after 029. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY — WHAT THE ADVISOR IS ACTUALLY WARNING ABOUT
-- ---------------------------------------------------------------------------
--
-- Supabase's advisor names two dozen functions as "Function Search Path
-- Mutable" and seven as executable by the public. Both come down to the same
-- thing: a function that does not say where it looks for the tables it names
-- can be made to look somewhere else.
--
-- A caller controls `search_path`. A function without one of its own resolves
-- `students` against whatever the caller set — so a caller who creates their
-- own `students` in a schema they control, and puts it first, has the function
-- read and write THEIR table instead of the University's. For a plain function
-- that is a bug; for a SECURITY DEFINER function, which runs with the owner's
-- privileges, it is how a caller borrows those privileges.
--
-- It is not hypothetical for this database. Every append-only guard, every
-- immutability trigger and every separation-of-duties check in these
-- migrations is a function that names tables. They are the rules; a rule that
-- can be pointed at a different table is not a rule.
--
-- ---------------------------------------------------------------------------
-- AND ONE REAL EXPOSURE, NOT A THEORETICAL ONE
-- ---------------------------------------------------------------------------
--
-- `reserve_student_number(integer)` is SECURITY DEFINER, directly callable,
-- and was executable by anon and by every signed-in account. Anybody could
-- call it in a loop and advance the University's student number counter as far
-- as they liked. Nothing would break and nothing would be stolen; the next
-- genuine admission would simply be numbered ICOF2026 09214 instead of
-- ICOF202600003, for ever, with no explanation in any record.
--
-- The application calls it with the service role. Nobody else needs it.
--
-- ---------------------------------------------------------------------------
-- WHAT IS DELIBERATELY LEFT ALONE
-- ---------------------------------------------------------------------------
--
-- `auth_role()` KEEPS ITS EXECUTE GRANT. It is called from inside the
-- row-level-security policies in 000 and 003, and a policy is evaluated as the
-- querying user — so revoking it from `authenticated` would not harden the
-- database, it would stop every member of staff reading anything at all. It
-- gets its search_path pinned like everything else, which is the part that
-- actually matters for it.
--
-- The trigger functions are revoked even though Postgres already refuses to
-- call a trigger function directly. Closing a door that is already shut costs
-- nothing and means the advisor's list reflects the database.
-- ===========================================================================


-- ===========================================================================
-- 1. EVERY FUNCTION IN public PINS ITS SEARCH PATH
--
-- Done by looping over what is actually there rather than by listing names.
-- The advisor named two dozen; a list would be right today and wrong the next
-- time somebody adds a trigger, and this is exactly the kind of rule that is
-- only worth having if it cannot be forgotten.
--
-- `public, pg_temp` with pg_temp LAST is the standard safe form: a temporary
-- table a caller creates cannot shadow a real one.
-- ===========================================================================

do $$
declare
  f record;
  n integer := 0;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and p.prokind = 'f'
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
          where c like 'search_path=%'
       )
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
    n := n + 1;
  end loop;
  raise notice '030 — pinned the search path on % function(s)', n;
end $$;


-- ===========================================================================
-- 2. THE NUMBER RESERVER IS THE SERVER'S ALONE
-- ===========================================================================

do $$
begin
  revoke execute on function public.reserve_student_number(integer) from public;
  revoke execute on function public.reserve_student_number(integer) from anon;
  revoke execute on function public.reserve_student_number(integer) from authenticated;
  grant  execute on function public.reserve_student_number(integer) to service_role;
end $$;

comment on function public.reserve_student_number(integer) is
  'Reserves the next student number for an intake year, above every number '
  'already issued. SERVICE ROLE ONLY — it advances a counter, so a caller who '
  'could run it could push the University''s numbering arbitrarily far forward '
  'with nothing in any record to say why. Revoked from anon and authenticated '
  'in 030.';


-- ===========================================================================
-- 3. THE TRIGGER FUNCTIONS, WHICH NOBODY CALLS DIRECTLY
-- ===========================================================================

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  unpinned integer;
  refused  boolean;
begin
 begin
  -- ---- EVERY FUNCTION IS PINNED --------------------------------------
  select count(*) into unpinned
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prokind = 'f'
     and not exists (select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) c
                      where c like 'search_path=%');
  if unpinned <> 0 then
    raise exception '030 FAILED: % function(s) still resolve tables against the caller''s search path', unpinned;
  end if;

  -- ---- THE RESERVER IS OFF THE PUBLIC API ----------------------------
  if has_function_privilege('anon', 'public.reserve_student_number(integer)', 'EXECUTE') then
    raise exception '030 FAILED: anon can still advance the student number counter';
  end if;
  if has_function_privilege('authenticated', 'public.reserve_student_number(integer)', 'EXECUTE') then
    raise exception '030 FAILED: a signed-in account can still advance the student number counter';
  end if;
  if not has_function_privilege('service_role', 'public.reserve_student_number(integer)', 'EXECUTE') then
    raise exception '030 FAILED: the server can no longer reserve a student number, so no admission could be issued';
  end if;

  -- ---- AND auth_role() IS STILL REACHABLE ----------------------------
  -- THE ONE THAT MUST NOT BE REVOKED. Every RLS policy in 000 and 003 calls
  -- it, and a policy runs as the querying user. Revoking it would not harden
  -- the database; it would stop every member of staff reading anything.
  if not has_function_privilege('authenticated', 'public.auth_role()', 'EXECUTE') then
    raise exception '030 FAILED: auth_role() was revoked, which breaks every row-level-security policy';
  end if;

  -- ---- THE GUARDS STILL GUARD ----------------------------------------
  -- Pinning a search path could in principle break a function that relied on
  -- resolving something outside `public`. Rather than assume, one of the
  -- rewritten triggers is made to refuse: 025's lock on the state vocabulary.
  refused := false;
  begin
    insert into admission_states (state, stage, applicant_label, label, sort_order)
    values ('invented_by_030', 'closed', 'x', 'x', 998);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '030 FAILED: the state vocabulary lock stopped refusing after its search path was pinned';
  end if;

  -- And 023's trail is still append-only.
  refused := false;
  begin
    insert into admission_opening_events (programme_code, action, actor_role)
    values ('PROOF-030', 'opened', 'academic-office');
    update admission_opening_events set action = 'closed' where programme_code = 'PROOF-030';
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '030 FAILED: the admission opening trail stopped being append-only';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '030 OK — every function pins its search path, the number reserver is the '
              'server''s alone, auth_role() is untouched, and the guards still refuse.';
end $$;


-- ===========================================================================
-- 5. VERIFY
-- ===========================================================================

-- Should return no rows. Each one would be a function resolving table names
-- against whatever the caller set.
select p.oid::regprocedure as function_without_a_pinned_search_path
from pg_proc p join pg_namespace s on s.oid = p.pronamespace
where s.nspname = 'public' and p.prokind = 'f'
  and not exists (select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) c
                   where c like 'search_path=%');

-- Who may run the two SECURITY DEFINER functions that are callable directly.
-- reserve_student_number: service_role only. auth_role: everybody, on purpose.
select
  f.name,
  has_function_privilege('anon',          f.name, 'EXECUTE') as anon_may_run,
  has_function_privilege('authenticated', f.name, 'EXECUTE') as signed_in_may_run,
  has_function_privilege('service_role',  f.name, 'EXECUTE') as service_role_may_run
from (values
  ('public.reserve_student_number(integer)'),
  ('public.auth_role()')
) as f(name);
