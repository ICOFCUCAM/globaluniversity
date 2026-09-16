-- ===========================================================================
-- 104 — A STAFF RECORD IS NOT A STAFF ACCOUNT
-- ===========================================================================
--
-- The University's ruling, on reading the "Awaiting a staff record" list:
--
--   "Appointment → Accepted → Create Staff Record → Staff Record → Staff
--    Account."
--
--   "The appointment remains part of the person's appointment history, while
--    the staff record becomes their ongoing institutional staff identity."
--
--   "Don't create the staff record automatically at appointment creation. This
--    preserves the distinction between someone who has merely been
--    considered/appointed and someone who has actually entered the
--    university's staff register."
--
-- ---------------------------------------------------------------------------
-- WHAT WAS ACTUALLY WRONG, WHICH IS NARROWER THAN IT LOOKED
-- ---------------------------------------------------------------------------
--
-- The button labelled "Open the staff record" DID create one. 082 and the
-- acceptance page use "open a staff record" in the sense a bank opens an
-- account — and the University read it as "show me the record", which is what
-- the words say to anybody who has not read the migration. The screen offered
-- it on rows where no record existed, so the reading was the reasonable one.
--
-- But under that label one click did FOUR things: staff number, staff register
-- row, login account, teaching record. Two of those are the staff record and
-- two are the account, and the University has now ruled that they are separate
-- stages with separate decisions.
--
-- AND THERE WAS NO DOOR FOR THE EMAIL. The list said "No email recorded —
-- correct the appointment first" and offered no way to correct anything. Six
-- accepted appointees sat behind a disabled button with a instruction and no
-- instrument. That is what the University asked about, and it is the part with
-- no machinery at all behind it.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. NOTHING ALREADY DONE IS UNDONE. No staff record, account or appointment
--    is touched. This adds a view and one refusal.
--
-- 2. A STAFF RECORD CAN NO LONGER BE GIVEN AN ACCOUNT WITH NO EMAIL ADDRESS.
--    The address is the username, and an account without one is a login
--    nobody can reach and a welcome letter nobody receives. Refused by a
--    trigger, so it holds against the service key the application writes with.
--
--    A TRIGGER RATHER THAN A CHECK CONSTRAINT, deliberately. A CHECK is
--    validated against every row already in the table, and 082 backfilled the
--    register from `lecturers` — if one of those rows carries an account and no
--    address, a CHECK would refuse the whole migration and a trigger refuses
--    only the next mistake. The existing rows are the University's to correct,
--    not this migration's to reject.
--
-- 3. THE SECOND STAGE GETS A LIST. `staff_records_awaiting_an_account` is the
--    staff register's equivalent of `appointments_awaiting_staff_record`:
--    people who are on the register and cannot yet sign in. It says of each
--    whether they are ready — which is to say, whether an address is recorded —
--    so the office can see at a glance what is waiting on them rather than
--    discovering it one row at a time.
--
-- ===========================================================================


-- ===========================================================================
-- 1. AN ACCOUNT NEEDS AN ADDRESS
-- ===========================================================================

create or replace function an_account_needs_an_address()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.auth_user_id is not null
     and (new.email is null or length(btrim(new.email)) = 0) then
    raise exception 'A staff account is reached at an email address: the address is the '
                    'username, and the welcome letter goes to it. Record the address on the '
                    'staff record before opening the account.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists an_account_needs_an_address_trg on staff_records;
create trigger an_account_needs_an_address_trg
  before insert or update on staff_records
  for each row execute function an_account_needs_an_address();

comment on function an_account_needs_an_address() is
  'A staff record may exist with no email — somebody on the register who cannot yet sign in. '
  'An ACCOUNT may not: the address is the username and the welcome letter goes to it.';


-- ===========================================================================
-- 2. WHO IS ON THE REGISTER AND CANNOT YET SIGN IN
-- ===========================================================================
--
-- The second stage of the University's three, and it had no list. The first
-- stage has had one since 082 — `appointments_awaiting_staff_record` — and the
-- office could see who was waiting for a record and not who was waiting for an
-- account, because until now those were the same moment.
--
-- `ready` is the column that matters. A record with no address is not waiting
-- on a decision; it is waiting on a fact somebody has to go and get, and the
-- two look identical in a list that does not say so.
-- ---------------------------------------------------------------------------

drop view if exists staff_records_awaiting_an_account;

create view staff_records_awaiting_an_account
with (security_invoker = true) as
  select s.id              as staff_record_id,
         s.staff_number,
         s.full_name,
         s.email,
         s.phone,
         s.position_title,
         s.position_id,
         s.family,
         s.faculty,
         s.department_id,
         s.employment_type,
         s.started_on,
         s.status,
         s.appointment_id,
         s.opened_by,
         s.opened_at,
         s.created_at,
         (s.email is not null and length(btrim(s.email)) > 0) as ready
    from staff_records s
   where s.auth_user_id is null;

comment on view staff_records_awaiting_an_account is
  'People on the staff register who cannot yet sign in. The second stage of appointment → '
  'staff record → staff account, and it had no list because until 104 the record and the '
  'account were opened in one act. `ready` says whether an email address is recorded: without '
  'one there is no username to give them and no address to send the welcome letter to.';


-- ===========================================================================
-- 3. THE PROOF
-- ===========================================================================

do $$
declare
  appt     uuid;
  rec      uuid;
  who      uuid := gen_random_uuid();
  refused  boolean;
  seen     integer;
  isready  boolean;
begin
  insert into auth.users (id, email) values (who, 'proof-104@example.invalid');

  -- ---- A STAFF RECORD WITH NO ADDRESS IS ALLOWED -------------------------
  --
  -- Which is the whole point of the split: somebody is on the register before
  -- anybody has their email. The old single act could not express that state.
  insert into staff_records (staff_number, full_name, position_title, employment_type)
       values ('PROOF-104-A', 'Proof Appointee 104', 'Proof Post 104', 'permanent')
    returning id into rec;
  raise notice '104 OK  a person can be on the staff register before their address is known';

  -- ---- AND THEY APPEAR ON THE SECOND-STAGE LIST, MARKED NOT READY --------
  select count(*), bool_and(ready) into seen, isready
    from staff_records_awaiting_an_account where staff_record_id = rec;
  if seen <> 1 then
    raise exception '104 FAILED — a record with no account did not reach the list';
  end if;
  if isready then
    raise exception '104 FAILED — a record with no address was reported ready for an account';
  end if;
  raise notice '104 OK  …and is listed as awaiting an account, and as not yet ready for one';

  -- ---- THE GUARD, WATCHED REFUSING ---------------------------------------
  --
  -- Run as the table's owner, which row-level security does not apply to. If
  -- it refuses this it refuses the service key the application writes with.
  refused := false;
  begin
    update staff_records set auth_user_id = who where id = rec;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '104 FAILED — an account was opened on a record with no email address';
  end if;
  raise notice '104 OK  an account cannot be opened on a record with no email address';

  -- AND AN EMPTY STRING IS NOT AN ADDRESS EITHER. A form that submits a blank
  -- field sends '' rather than null, and a guard that only checks for null is
  -- a guard the next form walks straight through.
  refused := false;
  begin
    update staff_records set email = '   ', auth_user_id = who where id = rec;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '104 FAILED — whitespace was accepted as an email address';
  end if;
  raise notice '104 OK  …and neither blank nor whitespace passes for one';

  -- ---- WITH AN ADDRESS, THE ACCOUNT OPENS --------------------------------
  --
  -- The ceiling as well as the floor: a guard that refuses everything is not a
  -- guard, it is an outage.
  update staff_records set email = 'proof-104-a@example.invalid' where id = rec;

  select bool_and(ready) into isready
    from staff_records_awaiting_an_account where staff_record_id = rec;
  if not isready then
    raise exception '104 FAILED — a record with an address was still reported not ready';
  end if;

  update staff_records set auth_user_id = who where id = rec;
  raise notice '104 OK  …and with one recorded, the account opens';

  -- ---- AND THEY LEAVE THE LIST -------------------------------------------
  select count(*) into seen
    from staff_records_awaiting_an_account where staff_record_id = rec;
  if seen <> 0 then
    raise exception '104 FAILED — somebody with an account is still awaiting one';
  end if;
  raise notice '104 OK  …and they drop off the list the moment they can sign in';

  raise exception 'ROLLBACK 104';
exception
  when others then
    if sqlerrm = 'ROLLBACK 104' then
      raise notice '104 OK  every proof above rolled back; no staff record was written to';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 4. DONE
-- ===========================================================================
do $$
begin
  raise notice '104 APPLIED  the staff record and the staff account are two stages. An '
               'account can no longer be opened on a record with no email address, and the '
               'office can see who is waiting for one.';
end $$;
