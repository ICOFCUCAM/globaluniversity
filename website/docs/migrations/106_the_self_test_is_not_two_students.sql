-- ===========================================================================
-- 106 — THE SELF-TEST IS NOT TWO STUDENTS
-- ===========================================================================
--
-- The University read their Accounts list and found two of the fifteen:
--
--   selftest-proctor-015@iguc.net    Student   Active
--   selftest-marker-015@iguc.net     Student   Active
--
-- and said: remove them.
--
-- ---------------------------------------------------------------------------
-- WHERE THEY CAME FROM, WHICH IS WORTH KNOWING
-- ---------------------------------------------------------------------------
--
-- Migration 015. Its self-test needs somebody to raise an examination
-- incident, somebody to decide a finding and somebody to enter a mark, so it
-- creates two identities and uses them.
--
-- AND IT DOES NOT ROLL BACK. Every migration from about 040 onwards ends with
-- `raise exception 'ROLLBACK NNN'`, so its proof runs and then vanishes. 015
-- predates that convention: its proof COMMITS. So the University's live
-- database has carried an examination titled "Installation self-test -
-- migration 015", a sitting, an event, an answer, an incident, a finding, a
-- mark and a report since the day 015 ran — and two people who do not exist.
--
-- They showed as STUDENTS because `on_auth_user_created` gives every new
-- account a profile and `student` is what it defaults to. Nobody chose it.
--
-- ---------------------------------------------------------------------------
-- WHAT CAN BE REMOVED, AND WHAT CANNOT
-- ---------------------------------------------------------------------------
--
-- THE ACCOUNTS GO. Deleting the two `profiles` rows takes them off the
-- Accounts list, out of Find-a-person, and out of every screen that lists
-- people — because every one of those reads `profiles`.
--
-- THE `auth.users` ROWS STAY, and this is not a compromise. Three foreign keys
-- point at them with ON DELETE RESTRICT:
--
--   exam_incidents.raised_by
--   exam_findings.decided_by
--   exam_marks.marked_by
--
-- Those are examination evidence. The database refuses to delete a person who
-- raised an incident or entered a mark, and it is right to: an incident whose
-- author has been erased is an incident nobody raised.
--
-- THE SELF-TEST SITTING STAYS TOO, for the same reason and more strongly. 015
-- makes `exam_events` append-only with a trigger — "an examination event was
-- deleted. Evidence is not append-only" is its own failure message — so the
-- sitting cannot be removed without disabling that rule on the live database.
-- That rule is the whole point of 015 and it is not being disabled to tidy a
-- list. The examination is already titled as a self-test and already marked
-- `cancelled`, so it reads as what it is.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE ACCOUNTS LIST GOES FROM FIFTEEN TO THIRTEEN. The two self-test
--    entries disappear from it and from every other list of people.
--
-- 2. NEITHER OF THEM COULD EVER SIGN IN. 015 inserts an id and an email and no
--    password, so there has never been a credential to sign in with. Removing
--    the profile also removes the role, so even a password set by hand later
--    would reach a session with no role and no capability at all.
--
-- 3. NO EXAMINATION RECORD IS TOUCHED. Not the examination, the sitting, the
--    event, the answer, the incident, the finding, the mark or the report.
--
-- 4. IT IS SELF-HEALING. This runs after 015 in the bundle, so a fresh
--    database that runs the whole sequence ends with the self-test done and
--    its two identities off the accounts list.
--
-- ===========================================================================


-- ===========================================================================
-- 1. THE TWO ACCOUNTS
-- ===========================================================================
--
-- MATCHED ON THE IDENTIFIERS 015 WRITES, not on a pattern. 015 inserts them at
-- two fixed uuids ending e1 and e2; matching `email like 'selftest%'` would
-- also catch anything a member of staff had since created with a similar
-- address, and this migration is not entitled to guess about those.
-- ---------------------------------------------------------------------------

do $$
declare
  gone integer;
begin
  delete from profiles
   where id in ('00000000-0000-0000-0000-0000000000e1'::uuid,
                '00000000-0000-0000-0000-0000000000e2'::uuid)
     and email in ('selftest-proctor-015@iguc.net', 'selftest-marker-015@iguc.net');
  get diagnostics gone = row_count;

  if gone > 0 then
    raise notice '106 OK  % self-test account(s) removed from the accounts list', gone;
  else
    raise notice '106 --  the self-test accounts are already off the list; nothing to do';
  end if;
end $$;


-- ===========================================================================
-- 2. THE PROOF
-- ===========================================================================
--
-- Two halves. That the accounts are gone, and that nothing else is — because
-- a migration asked to tidy a list is exactly the kind that quietly takes an
-- examination record with it.
-- ===========================================================================

do $$
declare
  seen     integer;
  refused  boolean;
begin
  -- ---- THE ACCOUNTS ARE OFF THE LIST -------------------------------------
  select count(*) into seen from profiles
   where id in ('00000000-0000-0000-0000-0000000000e1'::uuid,
                '00000000-0000-0000-0000-0000000000e2'::uuid);
  if seen <> 0 then
    raise exception '106 FAILED — % self-test account(s) are still on the accounts list', seen;
  end if;
  raise notice '106 OK  neither self-test identity appears as an account any more';

  -- ---- AND HAVE NO ROLE, SO NO CAPABILITY --------------------------------
  --
  -- `auth_role()` reads `profiles`. With no row there is no role, so even an
  -- account somebody later gave a password to would sign in holding nothing.
  select count(*) into seen from profiles
   where email in ('selftest-proctor-015@iguc.net', 'selftest-marker-015@iguc.net');
  if seen <> 0 then
    raise exception '106 FAILED — a self-test identity still carries a role';
  end if;
  raise notice '106 OK  …and carries no role, so a session as one holds nothing';

  -- ---- THE EVIDENCE IS UNTOUCHED -----------------------------------------
  --
  -- The half that matters. 015's self-test sitting is a permanent part of the
  -- University's examination record because 015 makes it so, and this
  -- migration must not have removed any of it while removing two rows from a
  -- different table.
  select count(*) into seen from examinations
   where title = 'Installation self-test - migration 015';
  if seen <> 1 then
    raise exception '106 FAILED — the self-test examination is no longer there (%)', seen;
  end if;

  select count(*) into seen from exam_events;
  if seen < 1 then
    raise exception '106 FAILED — examination evidence was removed';
  end if;
  raise notice '106 OK  the self-test examination record is untouched, as 015 requires';

  -- ---- AND THE PEOPLE THE EVIDENCE NAMES ARE STILL THERE ------------------
  select count(*) into seen from auth.users
   where id in ('00000000-0000-0000-0000-0000000000e1'::uuid,
                '00000000-0000-0000-0000-0000000000e2'::uuid);
  if seen <> 2 then
    raise exception '106 FAILED — an identity named by examination evidence was deleted';
  end if;
  raise notice '106 OK  …and the identities its incidents and marks name are still there';

  -- ---- WHICH IS WHY THE PROFILE WAS THE THING TO REMOVE -------------------
  --
  -- Watched refusing, so the reasoning in the header is a fact rather than a
  -- claim: deleting the account itself is refused by the evidence pointing at
  -- it.
  refused := false;
  begin
    delete from auth.users where id = '00000000-0000-0000-0000-0000000000e1'::uuid;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '106 FAILED — an identity named by an examination incident was deletable, '
                    'which means the evidence does not hold its author';
  end if;
  raise notice '106 OK  deleting the identity itself is refused by the evidence that names it';

  raise exception 'ROLLBACK 106';
exception
  when others then
    if sqlerrm = 'ROLLBACK 106' then
      raise notice '106 OK  the proof rolled back; the removal in section 1 stands';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 3. DONE
-- ===========================================================================
do $$
begin
  raise notice '106 APPLIED  the two self-test identities are off the accounts list. Their '
               'examination record stays, because 015 makes evidence append-only and that '
               'rule is not being disabled to tidy a list.';
end $$;
