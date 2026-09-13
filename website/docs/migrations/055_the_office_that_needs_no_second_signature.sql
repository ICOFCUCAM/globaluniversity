-- ===========================================================================
-- 055 — THE OFFICE THAT NEEDS NO SECOND SIGNATURE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE VICE-CHANCELLOR CAN DRAFT AN APPOINTMENT AND APPROVE IT. So can the
-- Chancellor, and so can a system account. Nobody else can, and the act is
-- marked on the record permanently.
--
-- The University ruled it: "a VC needs no one to approve its letter, even the
-- superadmin." The appointing authority IS the Vice-Chancellor; requiring a
-- second person to countersign the appointing authority's own decision is not
-- a separation of duties, it is asking the office to get permission to do the
-- thing the office is for.
--
-- ---------------------------------------------------------------------------
-- THE ROUTE EXISTED AND COULD NEVER BE TAKEN
-- ---------------------------------------------------------------------------
--
-- 045 built `made_on_sole_authority` for exactly this, with a stated reason and
-- a permanent mark — and then closed with:
--
--     "041's constraint refuses an approval by the drafter outright. An
--      appointment made on sole authority names the same person as initiator
--      and approver but leaves `drafted_by` to whoever prepared it — so the two
--      rules do not collide."
--
-- They did not collide because the second rule could never fire. 045 assumed
-- sole authority meant the Vice-Chancellor DIRECTED an appointment somebody
-- else typed. The University means something simpler: the Vice-Chancellor
-- writes it and approves it, one person, start to finish. `drafted_by =
-- authorized_by`, which 041 refuses flatly.
--
-- So the flag has sat in the schema since 045, written by nothing, guarding a
-- door that was bricked up.
--
-- ---------------------------------------------------------------------------
-- WHAT IS NOT RELAXED, AND THIS IS THE POINT
-- ---------------------------------------------------------------------------
--
-- 041's rule still refuses a self-approval by DEFAULT. An HR officer, a
-- registrar, an administrator drafting and approving their own appointment is
-- refused exactly as before. The only way past it is the flag, the flag is
-- only permitted for the offices that hold the authority, and setting it
-- cannot be undone.
--
-- THE UNIVERSITY CAN DO IT. WHAT IT CANNOT DO IS DO IT QUIETLY. That is 040's
-- shape for emergency publishing and 045's for this, and it does not change
-- because the act has become ordinary rather than exceptional.
--
-- ---------------------------------------------------------------------------
-- AND THE REASON IS NO LONGER DEMANDED
-- ---------------------------------------------------------------------------
--
-- 045 required twenty characters of explanation whenever the flag was set,
-- because it modelled sole authority as an EXCEPTION — the same shape as an
-- emergency publication. The University has now ruled that it is the
-- Vice-Chancellor's ordinary way of working.
--
-- An explanation demanded every time a thing is done normally is a box
-- somebody types a full stop into, and a record full of full stops is worse
-- than no record: it looks like an audit trail and carries nothing. What the
-- University is answerable for is WHO did it and THAT they did it alone, and
-- both are already recorded — permanently, and now unerasably.
--
-- The reason stays available for the day somebody wants to give one.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. A SYSTEM ACCOUNT IS AN OFFICE TOO
-- ---------------------------------------------------------------------------
--
-- 045's office vocabulary has no value for the Superadministrator, who is not
-- an office of the University but is the account that holds every capability.
-- Without this the ruling could not be carried out by the very account the
-- University named in it.

do $$
begin
  if exists (select 1 from pg_constraint
              where conname = 'appointments_initiated_by_office_check') then
    alter table appointments drop constraint appointments_initiated_by_office_check;
  end if;

  alter table appointments add constraint appointments_initiated_by_office_check
    check (initiated_by_office is null or initiated_by_office in
           ('hr', 'vice-chancellor', 'chancellor', 'registrar', 'academic-office', 'system'));
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE DRAFTER MAY APPROVE, BUT ONLY ON SOLE AUTHORITY
-- ---------------------------------------------------------------------------

do $$
begin
  -- REPLACED, NOT DROPPED. The rule still refuses every self-approval that is
  -- not marked; what changes is that being marked is now possible.
  if exists (select 1 from pg_constraint where conname = 'appointments_second_pair_of_eyes') then
    alter table appointments drop constraint appointments_second_pair_of_eyes;
  end if;

  alter table appointments add constraint appointments_second_pair_of_eyes
    check (
      authorized_by is null
      or drafted_by is null
      or authorized_by <> drafted_by
      -- THE ONE WAY THROUGH, and it leaves a mark that cannot be removed.
      or made_on_sole_authority
    );
end $$;

-- ---------------------------------------------------------------------------
-- 3. AND ONLY THE OFFICES THAT HOLD THE AUTHORITY MAY SET IT
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'appointments_sole_authority_explained') then
    alter table appointments drop constraint appointments_sole_authority_explained;
  end if;

  alter table appointments add constraint appointments_sole_authority_explained
    check (
      not made_on_sole_authority
      -- AN HR CLERK TICKING THIS BOX WOULD BE THE WHOLE SEPARATION GONE. 045's
      -- words, and they still hold — the list is simply one longer.
      or initiated_by_office in ('vice-chancellor', 'chancellor', 'system')
    );
end $$;

-- ---------------------------------------------------------------------------
-- 4. THE MARK CANNOT BE TAKEN OFF
-- ---------------------------------------------------------------------------
--
-- 045 called the mark permanent and nothing enforced it. An appointment
-- approved by its own drafter and then quietly unflagged is an appointment
-- that reads as ordinary and was not — and it is the one row in this table
-- where that matters.

create or replace function refuse_to_unmark_sole_authority()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.made_on_sole_authority and not new.made_on_sole_authority then
    raise exception
      'This appointment was approved by the officer who drafted it, on their own authority. '
      'That mark is part of the record and cannot be removed.';
  end if;
  return new;
end $$;

drop trigger if exists appointments_sole_authority_is_permanent on appointments;
create trigger appointments_sole_authority_is_permanent
  before update on appointments
  for each row execute function refuse_to_unmark_sole_authority();

-- ---------------------------------------------------------------------------
-- 5. PROVE IT
-- ---------------------------------------------------------------------------

do $$
declare
  vc      uuid;
  clerk   uuid;
  a_id    uuid;
  refused boolean;
begin
  begin
    insert into auth.users (email) values ('055-vc@example.test') returning id into vc;
    insert into auth.users (email) values ('055-clerk@example.test') returning id into clerk;

    -- ---- THE ORDINARY RULE STILL BITES ------------------------------------
    -- An officer who is not the appointing authority drafting and approving
    -- their own appointment is refused exactly as it was before this file.
    insert into appointments (full_name, position_title, employment_type,
                              start_date, place_of_duty, status, drafted_by,
                              initiated_by_office)
      values ('A Proof Appointee', 'A Proof Post', 'permanent', '2026-10-01',
              'Buea', 'submitted', clerk, 'hr')
      returning id into a_id;

    refused := false;
    begin
      update appointments set status = 'approved', authorized_by = clerk, authorized_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '055 FAILED: a clerk approved their own appointment';
    end if;

    -- ---- AND TICKING THE BOX DOES NOT HELP THEM ---------------------------
    -- The office is 'hr', which may not claim sole authority however the flag
    -- is set. This is the check that stops the new door being a way round the
    -- old rule for everybody.
    refused := false;
    begin
      update appointments
         set status = 'approved', authorized_by = clerk, authorized_at = now(),
             made_on_sole_authority = true
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '055 FAILED: an HR office claimed sole authority';
    end if;

    -- ---- THE VICE-CHANCELLOR MAY, AND IT IS MARKED ------------------------
    insert into appointments (full_name, position_title, employment_type,
                              start_date, place_of_duty, status, drafted_by,
                              initiated_by_office)
      values ('A Proof Appointee', 'A Proof Post', 'permanent', '2026-10-01',
              'Buea', 'submitted', vc, 'vice-chancellor')
      returning id into a_id;

    update appointments
       set status = 'approved', authorized_by = vc, authorized_at = now(),
           made_on_sole_authority = true
     where id = a_id;

    if not exists (select 1 from appointments
                    where id = a_id and made_on_sole_authority
                      and drafted_by = authorized_by) then
      raise exception '055 FAILED: the Vice-Chancellor could not approve their own appointment';
    end if;

    -- ---- AND STILL CANNOT DO IT UNMARKED ----------------------------------
    -- The flag is the whole permission. Without it the Vice-Chancellor is
    -- refused like anybody else, which is what keeps the mark honest: there is
    -- no self-approval anywhere in this table that is not flagged.
    insert into appointments (full_name, position_title, employment_type,
                              start_date, place_of_duty, status, drafted_by,
                              initiated_by_office)
      values ('A Proof Appointee', 'A Proof Post', 'permanent', '2026-10-01',
              'Buea', 'submitted', vc, 'vice-chancellor')
      returning id into a_id;

    refused := false;
    begin
      update appointments set status = 'approved', authorized_by = vc, authorized_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '055 FAILED: a self-approval was accepted without the mark';
    end if;

    -- ---- AND THE MARK CANNOT BE REMOVED -----------------------------------
    update appointments
       set status = 'approved', authorized_by = vc, authorized_at = now(),
           made_on_sole_authority = true
     where id = a_id;

    refused := false;
    begin
      update appointments set made_on_sole_authority = false where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '055 FAILED: the sole-authority mark was taken off';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '055 OK: the Vice-Chancellor, the Chancellor and a system account may draft an '
               'appointment and approve it themselves';
  raise notice '055 OK: everybody else is still refused, and ticking the box does not help them';
  raise notice '055 OK: a self-approval without the mark is refused, and the mark cannot be '
               'taken off once set';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EVERY APPOINTMENT ONE PERSON MADE END TO END. Empty today; this is where
-- they will appear, and the Vice-Chancellor's own appointments will be among
-- them by design rather than by accident.
-- ---------------------------------------------------------------------------
select count(*)                                                   as appointments,
       count(*) filter (where made_on_sole_authority)             as made_alone,
       count(*) filter (where authorized_by is not null
                          and authorized_by = drafted_by)         as self_approved,
       count(*) filter (where authorized_by is not null
                          and authorized_by = drafted_by
                          and not made_on_sole_authority)         as self_approved_unmarked
  from appointments;
