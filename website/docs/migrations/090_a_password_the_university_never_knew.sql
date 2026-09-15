-- ===========================================================================
-- 090 — A PASSWORD THE UNIVERSITY NEVER KNEW
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- NOTHING, UNTIL THE DEPLOY THAT GOES WITH IT. This adds one column and one
-- view. Nobody is locked out, no password is reset, no row is altered.
--
-- What it makes possible is the sentence the University has been sending to
-- every admitted student since the admission package was written:
--
--     "You will be required to set a new password on first sign-in."
--
-- That was not true. Nothing recorded whether a password had ever been changed
-- and nothing required it, so the temporary password the system generated and
-- emailed stayed valid indefinitely — sitting in an inbox, and known to
-- whatever sent it.
--
-- A promise in a letter that the software does not keep is the same class of
-- fault as a policy on a table with row-level security switched off: it reads
-- like a protection and has never once been consulted.
--
-- ---------------------------------------------------------------------------
-- WHY A TIMESTAMP AND NOT A BOOLEAN
-- ---------------------------------------------------------------------------
--
-- `must_change_password` would answer today's question and nothing else. A
-- date answers "when did this account last have a password chosen by the
-- person using it", which is the question an audit asks, the one a support
-- desk asks when somebody reports an account they do not recognise, and the
-- one a future policy about expiry would need.
--
-- NULL MEANS NEVER, and that is the state every existing account is in. It is
-- the honest reading: the University has not observed any of them choosing a
-- password, because it never looked.
--
-- ---------------------------------------------------------------------------
-- AND THE ACCOUNT HOLDER MUST NOT BE ABLE TO WRITE IT
-- ---------------------------------------------------------------------------
--
-- This is the whole design. If a session could set `password_set_at = now()`,
-- the gate would be skippable by anyone willing to open the developer tools —
-- and the people most likely to do that are exactly the people the gate is
-- for. So the column is written only by the route that actually changes the
-- password, holding the service key, in the same operation.
--
-- `profiles` grants `authenticated` UPDATE for the ordinary profile fields, so
-- a policy alone will not do: row-level security is ROW-level and cannot
-- protect one column of a row somebody may otherwise edit. A COLUMN-LEVEL
-- revoke can, and that is what this uses — the same wall this schema has met
-- four times, answered the way Postgres actually provides for.
-- ===========================================================================

alter table profiles
  add column if not exists password_set_at timestamptz;

comment on column profiles.password_set_at is
  'When the person using this account last chose their own password. NULL means never — the '
  'account is still on the temporary password the University generated and emailed, and the '
  'portal shows nothing but the change-password screen until it is set. Written only by '
  '/api/account/password with the service key: a session that could write it could skip the gate.';

-- ---------------------------------------------------------------------------
-- THE COLUMN-LEVEL REVOKE.
--
-- `revoke update (column)` takes away the right to write that one column while
-- leaving the rest of the table's UPDATE grant intact. It is the only mechanism
-- that does this — no policy can, because a policy decides about a ROW.
--
-- Ordered after the add so the column exists to be revoked, and written to be
-- safe on a database where the grant was never there.
-- ---------------------------------------------------------------------------
do $$
begin
  execute 'revoke update (password_set_at) on profiles from anon, authenticated';
exception
  -- Nothing to take away is the desired end state, not a failure.
  when undefined_object or invalid_grant_operation then null;
end $$;

grant update (password_set_at) on profiles to service_role;


-- ===========================================================================
-- WHOSE ACCOUNT IS STILL ON A PASSWORD THE UNIVERSITY ISSUED
-- ===========================================================================
--
-- FOR THE OFFICE, NOT FOR THE STUDENT. A Registrar chasing up a cohort that
-- has been admitted and has not signed in needs to see who; the student
-- themselves is told by the portal, which simply will not let them past.
--
-- SELF-FILTERING, because a view runs as its owner and row-level security on
-- `profiles` underneath does not apply to somebody selecting from it. Every
-- `my_*` view in this schema does the same, and 086 explains why at length.
--
-- IT CARRIES NO PASSWORD AND NO ACCOUNT IDENTIFIER. A list of accounts on a
-- known-issued credential is a target list; it names the person, their role
-- and the date, and nothing that helps anybody sign in as them.
drop view if exists accounts_on_a_temporary_password;
create view accounts_on_a_temporary_password as
  select
    p.full_name,
    p.email,
    p.role,
    s.matric_no,
    s.student_number,
    p.created_at as account_opened
  from profiles p
  left join students s on s.auth_user_id = p.id
  where p.password_set_at is null
    and p.suspended_at is null
    and auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                        'admissions-officer', 'hr-administrator');

grant select on accounts_on_a_temporary_password to authenticated;

comment on view accounts_on_a_temporary_password is
  'Accounts that have never had a password chosen by the person using them — still on the '
  'temporary one the University generated. For the offices that chase them up. Carries no '
  'password and no account id.';


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  stu_user uuid := gen_random_uuid();
  reg_user uuid := gen_random_uuid();
  the_student uuid;
  seen integer;
  grants integer;
begin
  begin
    insert into auth.users (id, email) values
      (stu_user, '090-student@example.test'),
      (reg_user, '090-registrar@example.test');
    insert into profiles (id, email, role, full_name) values
      (stu_user, '090-student@example.test', 'student', 'Never Chose One'),
      (reg_user, '090-registrar@example.test', 'registrar', 'The Registrar')
    on conflict (id) do update set role = excluded.role;

    insert into students (matric_no, first_name, last_name, status, auth_user_id, student_number)
      values ('090/PROOF', 'Never', 'ChoseOne', 'enrolled', stu_user, 'ICOF209000001')
      returning id into the_student;

    -- ---- EVERY EXISTING ACCOUNT READS AS "NEVER" --------------------------
    --
    -- The honest state, and the reason the column is nullable rather than
    -- defaulted to now(): defaulting would silently declare that every account
    -- in the University had chosen its own password, which is the claim this
    -- migration exists because nobody could make.
    select count(*) into seen from profiles
     where id = stu_user and password_set_at is null;
    if seen <> 1 then
      raise exception '090 FAILED: a new account does not read as never having had a password '
                      'chosen, so the gate would let it straight through';
    end if;

    -- =====================================================================
    -- THE ACCOUNT HOLDER CANNOT SKIP THE GATE
    -- =====================================================================
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', stu_user);

    begin
      update profiles set password_set_at = now() where id = stu_user;
      -- An UPDATE that matches no row is not a refusal, so the write is read
      -- back rather than trusted. This is the assertion the whole file rests
      -- on: if it can be written from a session, the gate is decorative.
      reset role;
      if exists (select 1 from profiles where id = stu_user and password_set_at is not null) then
        raise exception '090 FAILED: a signed-in account stamped its own password_set_at, so '
                        'the change-password gate can be skipped from the developer tools';
      end if;
      set local role authenticated;
      execute format('set local request.jwt.claim.sub = %L', stu_user);
    exception
      when insufficient_privilege then null;
    end;

    reset role;

    -- ---- AND THE OFFICE CAN SEE WHO IS STILL ON ONE ------------------------
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', reg_user);
    select count(*) into seen from accounts_on_a_temporary_password
     where student_number = 'ICOF209000001';
    if seen <> 1 then
      raise exception '090 FAILED: the Registrar cannot see an account still on the password '
                      'the University issued, so nobody can chase it up';
    end if;

    -- ---- AND A STUDENT CANNOT READ THAT LIST -------------------------------
    --
    -- A list of accounts known to be on an issued credential is a target list.
    execute format('set local request.jwt.claim.sub = %L', stu_user);
    select count(*) into seen from accounts_on_a_temporary_password;
    if seen <> 0 then
      raise exception '090 FAILED: a student reads the list of accounts still on a temporary '
                      'password — which is a list of accounts worth attacking';
    end if;

    reset role;

    raise exception 'rollback 090 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 090 proof' then raise; end if;
  end;
end $$;


-- ---------------------------------------------------------------------------
-- AND NO BROWSER SESSION HOLDS THE GRANT.
--
-- Asked of the catalogue as well as behaviourally, for the reason 088 learned:
-- the two protections fail independently, and a behavioural check passes while
-- one of them is missing. Here the grant is the one that does not depend on
-- anybody writing a policy correctly.
-- ---------------------------------------------------------------------------
do $$
declare
  writable text;
begin
  select string_agg(distinct grantee, ', ') into writable
    from information_schema.column_privileges
   where table_schema = 'public'
     and table_name = 'profiles'
     and column_name = 'password_set_at'
     and privilege_type = 'UPDATE'
     and grantee in ('anon', 'authenticated');
  if writable is not null then
    raise exception '090 FAILED: % still holds UPDATE on profiles.password_set_at — the gate '
                    'is skippable by anyone who opens the developer tools', writable;
  end if;
end $$;


do $$
begin
  raise notice '090 OK: every account reads as never having chosen its own password, which is '
               'the honest state — nothing was observed, because nothing looked';
  raise notice '090 OK: and the account holder cannot stamp it themselves, so the '
               'change-password gate cannot be skipped from a browser';
  raise notice '090 OK: the offices can see who is still on a password the University issued; '
               'a student cannot read that list';
end $$;
