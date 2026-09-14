-- ===========================================================================
-- 082 — THE STAFF REGISTER, AND THE JOIN THAT WAS NEVER THERE
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE UNIVERSITY HAS A STAFF REGISTER. It did not. `lecturers` is the
--    nearest thing and it is teaching-shaped — specialization, department,
--    course allocation — and the staff number ICOFSTF2026001 is derived from
--    it. So a Dean, a Director of Academic Affairs, a Finance Officer or a
--    Registrar appointed by this University received AN ACCOUNT AND NO STAFF
--    NUMBER, because the only table that issues one is the one for people who
--    teach. The University's ruling: every appointee gets a staff number.
--
-- 2. AND AN APPOINTMENT IS JOINED TO THE PERSON IT APPOINTED. Until now the
--    two were separate acts with nothing between them. An appointee accepted
--    their letter, the acceptance page told them "Human Resources will open
--    your staff record", and somebody RETYPED their name, email, title and
--    department into a form — the exact fault the appointment letter exists to
--    prevent. A name typed twice is a name that can differ, and then the
--    University has two answers and a signature on the wrong one.
--
-- 3. NOTHING IS OPENED AUTOMATICALLY. The University's ruling: an officer
--    opens it. An acceptance puts somebody on a list; a person decides.
--
-- 4. AND NOT BEFORE THEY HAVE ACCEPTED. 050's rule, enforced here in the
--    database rather than only in a route: being appointed and being on the
--    staff register are two separate things, and the second follows the first.
--
-- NO ACCOUNT IS CREATED BY THIS FILE. Accounts live in `auth.users` and are
-- made by the service role at the moment an officer opens the record. This is
-- the register they are recorded in.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- THE REGISTER
-- ---------------------------------------------------------------------------

create table if not exists staff_records (
  id              uuid primary key default gen_random_uuid(),

  -- WHERE THIS PERSON CAME FROM. Nullable, because the University has staff
  -- who predate the appointments register and whose records were opened by
  -- hand; not nullable in practice for anybody appointed through the system.
  appointment_id  uuid references appointments (id) on delete set null,

  -- The account they sign in with. The username is their email; the password
  -- is generated once, sent in the welcome email, and never stored here.
  auth_user_id    uuid references auth.users (id) on delete set null,

  -- ICOFSTF2026001. The same family as the student number and marked for
  -- staff.
  staff_number    text not null unique,

  full_name       text not null,
  email           text,
  phone           text,
  postal_address  text,

  -- THE POST, AS THE REGISTER HOLDS IT. `position_title` is copied rather than
  -- joined because a post can be renamed and a staff record has to keep saying
  -- what somebody was appointed to.
  position_id     uuid references positions (id) on delete set null,
  position_title  text not null,
  family          text,
  department_id   uuid references departments (id) on delete set null,
  faculty         text,

  employment_type text,
  started_on      date,

  -- WHERE THEY ALSO TEACH. A Dean who lectures has both; a Finance Officer has
  -- only this row. The teaching record is what allocates a course, and it is
  -- not what makes somebody staff.
  lecturer_id     uuid references lecturers (id) on delete set null,

  status          text not null default 'active'
                    check (status in ('active', 'suspended', 'ended')),
  ended_on        date,
  ended_reason    text,

  -- WHO OPENED IT. The University ruled that an officer opens a staff record
  -- rather than it appearing on acceptance, so the record says which officer.
  opened_by       uuid references auth.users (id) on delete set null,
  opened_at       timestamptz not null default now(),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AND THE COLUMN THAT ALREADY EXISTED IS NOT THIS ONE
-- ---------------------------------------------------------------------------
--
-- 042 is called "the appointment lifecycle and THE STAFF RECORD" and it added
-- `appointments.staff_record_id` — pointing at `lecturers`. That was the right
-- join to the only staff table there was, and it is exactly the limitation the
-- University asked to remove: it can only ever name somebody who teaches.
--
-- The two are kept apart rather than one repointed, because they mean different
-- things and a column that quietly changed meaning would make every existing
-- row a lie:
--
--   appointments.staff_record_id   the TEACHING record, in `lecturers`. Null
--                                  for a Registrar or a Finance Officer, and
--                                  correctly so.
--   staff_records.appointment_id   the STAFF REGISTER row. Every appointee has
--                                  one, whatever their post.
--
-- The join from an appointment to its staff record is therefore read from
-- `staff_records`, not from `appointments`.

comment on column appointments.staff_record_id is
  'The TEACHING record in `lecturers`, where this appointee teaches. Not the staff register: '
  'see `staff_records.appointment_id`, which every appointee has whether or not they teach.';

comment on table staff_records is
  'Every person the University employs, whatever their post. The staff number is issued here '
  'rather than from `lecturers`, so an appointee who does not teach still has one.';

-- ONE RECORD PER APPOINTMENT. Opening the same appointment twice is a mistake,
-- not a second job, and without this a double click issues two staff numbers to
-- one person.
create unique index if not exists staff_records_one_per_appointment_idx
  on staff_records (appointment_id) where appointment_id is not null;

-- AND ONE PER ACCOUNT. Two staff records sharing a login is two answers to
-- "who is this".
create unique index if not exists staff_records_one_per_account_idx
  on staff_records (auth_user_id) where auth_user_id is not null;

create index if not exists staff_records_status_idx on staff_records (status);
create index if not exists staff_records_position_idx on staff_records (position_id);

alter table staff_records enable row level security;


-- ---------------------------------------------------------------------------
-- NOT BEFORE THEY HAVE ACCEPTED
-- ---------------------------------------------------------------------------
--
-- The route checks this too. Both, deliberately: the route's check is the one
-- that produces a sentence an officer can read, and this one is the one that
-- is still true when somebody writes to the table by another road.

create or replace function staff_record_needs_an_acceptance()
returns trigger language plpgsql as $$
declare
  st text;
begin
  if new.appointment_id is null then
    -- A record opened by hand for somebody who predates the register. There is
    -- no appointment to check, and refusing it would lock the University out
    -- of recording its own existing staff.
    return new;
  end if;

  select status into st from appointments where id = new.appointment_id;

  if st is null then
    raise exception 'That appointment does not exist, so no staff record can be opened against it';
  end if;

  if st not in ('accepted', 'active') then
    raise exception 'Nobody joins the staff register before they have accepted. This appointment '
                    'is %, and a staff record may be opened once the appointee has accepted the '
                    'letter.', st;
  end if;

  return new;
end $$;

drop trigger if exists staff_record_needs_an_acceptance_trg on staff_records;
create trigger staff_record_needs_an_acceptance_trg
  before insert on staff_records
  for each row execute function staff_record_needs_an_acceptance();


-- ---------------------------------------------------------------------------
-- THE NUMBER
-- ---------------------------------------------------------------------------
--
-- DERIVED FROM THE REGISTER ITSELF rather than from a counter beside it, so it
-- cannot drift out of step with the rows. `staff_number` is unique, so two
-- officers pressing the button at the same moment produce one success and one
-- failure rather than one number twice.

create or replace function next_staff_number(for_year integer default null)
returns text language plpgsql as $$
declare
  y      integer := coalesce(for_year, extract(year from now())::integer);
  prefix text;
  last   text;
  seq    integer;
begin
  prefix := 'ICOFSTF' || y::text;

  select staff_number into last
    from staff_records
   where staff_number like prefix || '%'
   order by staff_number desc
   limit 1;

  -- THE LECTURERS TABLE IS READ TOO, for the years before this register
  -- existed. Otherwise the first number issued here would collide with one
  -- `lecturers` had already given out.
  select greatest(coalesce(last, ''), coalesce(max(staff_id), '')) into last
    from lecturers
   where staff_id like prefix || '%';

  if last is null or last = '' then
    seq := 1;
  else
    seq := coalesce(nullif(regexp_replace(substr(last, length(prefix) + 1), '\D', '', 'g'), ''), '0')::integer + 1;
  end if;

  return prefix || lpad(seq::text, 3, '0');
end $$;

comment on function next_staff_number(integer) is
  'The next ICOFSTF number for a year, reading both the staff register and the older lecturers '
  'table so a number issued before this register existed is never reissued.';


-- ---------------------------------------------------------------------------
-- WHO IS WAITING FOR ONE
-- ---------------------------------------------------------------------------
--
-- The question the screen has to answer: who accepted and has no staff record?
-- Written as a view so the screen asks one question rather than two and
-- subtracting.

drop view if exists appointments_awaiting_staff_record;
create view appointments_awaiting_staff_record
with (security_invoker = true) as
  select a.id            as appointment_id,
         a.full_name,
         a.email,
         a.phone,
         a.position_title,
         a.position_id,
         a.unit_name,
         a.faculty,
         a.employment_type,
         a.start_date,
         a.status,
         p.family
    from appointments a
    left join positions p on p.id = a.position_id
   where a.status in ('accepted', 'active')
     and not exists (select 1 from staff_records s where s.appointment_id = a.id);

comment on view appointments_awaiting_staff_record is
  'Appointees who have accepted and are not yet on the staff register. The Enrolment desk''s '
  'equivalent for staff: a list somebody acts on, not a decision.';


-- ---------------------------------------------------------------------------
-- WHO MAY READ IT
-- ---------------------------------------------------------------------------
--
-- A staff register carries an address and a telephone number for every officer
-- of the University. It is not a directory for general circulation.

drop policy if exists staff_records_readable_by_the_offices_that_keep_it on staff_records;
create policy staff_records_readable_by_the_offices_that_keep_it
  on staff_records for select
  using (
    -- Your own record, always.
    auth_user_id = auth.uid()
    or exists (
      select 1 from profiles pr
       where pr.id = auth.uid()
         and pr.role in ('superadmin', 'admin', 'vice-chancellor', 'chancellor',
                         'registrar', 'academic-office', 'hr-officer', 'hr-administrator')
    )
  );

-- WRITTEN ONLY BY THE SERVICE ROLE. Opening a staff record creates an account
-- at the same moment, which no browser may do, so the route does both with the
-- service key and nothing else writes here.
drop policy if exists staff_records_written_by_the_service_role on staff_records;
create policy staff_records_written_by_the_service_role
  on staff_records for all
  using (false) with check (false);


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  a_id      uuid;
  b_id      uuid;
  c_id      uuid;
  pos_id    uuid;
  parked    text;
  n1        text;
  n2        text;
  refused   boolean;
begin
  -- A POST OF OUR OWN, not one of the University's. See CLAUDE.md: a proof that
  -- reasons about their data instead of making its own has broken this
  -- migration run three times.
  insert into positions (title, job_code, family, unit_name)
       values ('A Specimen Post For Proving 082', 'ZZZ-082', 'other', 'Nowhere')
    returning id into pos_id;

  -- ---- AN APPOINTMENT THAT HAS NOT BEEN ACCEPTED -------------------------
  insert into appointments (full_name, position_title, position_id, employment_type,
                            start_date, status)
       values ('A Specimen Appointee 082', 'A Specimen Post For Proving 082', pos_id,
               'permanent', current_date, 'draft')
    returning id into a_id;

  -- THE GUARD, WATCHED REFUSING. A rule nobody has seen refuse anything is a
  -- rule nobody has tested.
  refused := false;
  begin
    insert into staff_records (appointment_id, staff_number, full_name, position_title)
         values (a_id, 'ICOFSTF9999901', 'A Specimen Appointee 082',
                 'A Specimen Post For Proving 082');
  exception when others then
    refused := true;
  end;
  if not refused then
    raise exception '082 FAILED: a staff record was opened for an appointment nobody has '
                    'accepted, so being appointed and being on the staff register are the '
                    'same thing after all';
  end if;

  -- ---- ACCEPTED, AND NOW IT IS ALLOWED -----------------------------------
  --
  -- INSERTED AT `accepted` RATHER THAN WALKED THERE. 047 refuses an UPDATE into
  -- issued/accepted/active without an approval and an archived letter — the
  -- right rule, and a proof that manufactured an approval and a letter to get
  -- past it would be testing 047 rather than this file. Its trigger is on
  -- UPDATE only, so a specimen may start where it needs to be.
  insert into appointments (full_name, position_title, position_id, employment_type,
                            start_date, status, issued_at, accepted_at)
       values ('A Second Specimen 082', 'A Specimen Post For Proving 082', pos_id,
               'permanent', current_date, 'accepted', now(), now())
    returning id into c_id;

  insert into staff_records (appointment_id, staff_number, full_name, position_title,
                             position_id, employment_type)
       values (c_id, 'ICOFSTF9999901', 'A Second Specimen 082',
               'A Specimen Post For Proving 082', pos_id, 'permanent');

  -- ---- ONE RECORD PER APPOINTMENT ----------------------------------------
  refused := false;
  begin
    insert into staff_records (appointment_id, staff_number, full_name, position_title)
         values (c_id, 'ICOFSTF9999902', 'A Second Specimen 082',
                 'A Specimen Post For Proving 082');
  exception when unique_violation then
    refused := true;
  end;
  if not refused then
    raise exception '082 FAILED: one appointment opened two staff records, so a double click '
                    'issues two staff numbers to one person';
  end if;

  -- ---- THE NUMBER, AND THAT IT DOES NOT COLLIDE WITH `lecturers` ---------
  --
  -- A year of its own, so this counts nothing the University has.
  n1 := next_staff_number(9999);
  if n1 <> 'ICOFSTF9999902' then
    raise exception '082 FAILED: the next staff number after ICOFSTF9999901 came out as %, '
                    'so the register is not counting its own rows', n1;
  end if;

  insert into staff_records (staff_number, full_name, position_title)
       values (n1, 'A Third Specimen 082', 'A Specimen Post For Proving 082');

  n2 := next_staff_number(9999);
  if n2 = n1 then
    raise exception '082 FAILED: the same staff number came back twice, so two officers '
                    'pressing the button would issue one number to two people';
  end if;

  -- ---- THE VIEW SHOWS WHO IS WAITING, AND STOPS WHEN THEY ARE NOT --------
  --
  -- Created rather than assumed: the appointment above is accepted AND has a
  -- staff record, so it must be ABSENT. Asserting the view is empty would fail
  -- the University for having appointed somebody.
  if exists (select 1 from appointments_awaiting_staff_record where appointment_id = c_id) then
    raise exception '082 FAILED: an appointee with a staff record is still listed as awaiting '
                    'one, so the list never empties';
  end if;

  -- AND SOMEBODY WHO HAS NOT ACCEPTED IS NOT WAITING EITHER.
  --
  -- A SECOND appointment left at `draft`, rather than walking the first one
  -- backwards: 047 refuses an appointment being marked issued without an
  -- approval, and rightly — a proof that fought the lifecycle to make its point
  -- would be testing the lifecycle instead of the view.
  -- a_id is the one still at `draft`, from the refusal above.
  if exists (select 1 from appointments_awaiting_staff_record where appointment_id = a_id) then
    raise exception '082 FAILED: an appointee who has not accepted is listed as awaiting a '
                    'staff record, which would put somebody on the staff register before they '
                    'said yes';
  end if;

  -- And one who HAS accepted and has no record IS listed, or the screen shows
  -- an empty list while somebody waits.
  insert into appointments (full_name, position_title, position_id, employment_type,
                            start_date, status, issued_at, accepted_at)
       values ('A Fourth Specimen 082', 'A Specimen Post For Proving 082', pos_id,
               'permanent', current_date, 'accepted', now(), now())
    returning id into b_id;

  if not exists (select 1 from appointments_awaiting_staff_record where appointment_id = b_id) then
    raise exception '082 FAILED: an appointee who has accepted and has no staff record is NOT '
                    'listed as awaiting one, so nobody would ever be opened';
  end if;

  raise exception 'rollback 082 proof';
exception
  when others then
    if sqlerrm <> 'rollback 082 proof' then raise; end if;
end $$;


do $$
begin
  raise notice '082 OK: the University has a staff register, and every appointee gets a staff '
               'number whether or not they teach';
  raise notice '082 OK: a staff record cannot be opened before the appointee has accepted, and '
               'one appointment cannot open two';
  raise notice '082 OK: and `appointments_awaiting_staff_record` says who is waiting for one';
end $$;
