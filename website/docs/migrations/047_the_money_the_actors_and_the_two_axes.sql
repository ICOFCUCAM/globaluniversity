-- ===========================================================================
-- 047 — THE MONEY, THE ACTORS, AND THE TWO AXES OF AN APPOINTMENT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE UNIVERSITY'S APPOINTMENTS ARE IN DOLLARS. New appointments default to
--    USD, following the fee schedule, which the University converted to dollars
--    at 600 FCFA to the dollar. EXISTING ROWS ARE NOT TOUCHED — an appointment
--    already recorded in francs stays in francs, because restating somebody's
--    salary in another currency is a decision about their pay, not a data
--    migration.
--
-- 2. AN APPOINTMENT CAN CARRY ALLOWANCES. Housing, transport, communication,
--    responsibility, research — each with its own amount and period, none
--    assumed. Until now a salary was one number, so an appointment worth
--    $2,000 basic plus $400 housing could only be recorded as $2,400, and the
--    letter then stated something the University had not decided.
--
-- 3. THE RECORD NAMES FIVE PEOPLE, NOT THREE. `reviewed_by` and `issued_by`
--    join the three that existed. "Who issued this?" was previously answerable
--    only by inference from `authorized_by`, which is wrong whenever the
--    authority approves on Monday and the letter goes out on Thursday.
--
-- 4. A CLOSED DOOR — READ THIS ONE. An appointment can no longer reach
--    `issued` unless a letter for it is archived. The University's own words:
--    "an appointment cannot be issued without an approved decision and an
--    archived appointment document". Until now `issued` was a status somebody
--    could set with no document behind it, and the appointee would then be
--    holding nothing while the register said a letter had gone.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THE UNIVERSITY'S LIST OF APPOINTMENT TYPES IS TWO LISTS. Asked for fourteen
-- types — Initial, Reappointment, Promotion, Renewal, Contract Extension,
-- Transfer, Acting, Visiting, Part-Time, Full-Time, Adjunct, Probationary,
-- Confirmation, Amendment — and they are not one vocabulary. Six of them say
-- what KIND OF EMPLOYMENT this is (visiting, part-time, adjunct, probationary)
-- and eight say WHAT THE UNIVERSITY IS DOING (promoting, renewing,
-- transferring, confirming).
--
-- A promotion to a full-time post is both. Put in one column, it is neither:
-- the University can then ask how many promotions it made this year or how many
-- part-time staff it has, but never both, and the answer to the second silently
-- excludes everybody whose row says "Promotion".
--
-- So `employment_type` keeps its meaning and `appointment_action` is added
-- beside it. Nothing existing is renamed and no existing row changes.
-- ===========================================================================


-- ===========================================================================
-- 1. THE MONEY
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- NEW ROWS ARE IN DOLLARS — AND THIS IS A TRIGGER, NOT A COLUMN DEFAULT.
--
-- It was `alter column salary_currency set default 'USD'` for about ten
-- minutes, and the proof below refused it immediately: a column default applies
-- to EVERY insert, so an honorary appointment carrying no pay at all came out
-- with a currency and no amount, which 041 correctly refuses as an incomplete
-- salary. The University would have discovered it the first time it appointed
-- somebody unpaid.
--
-- The rule the University actually stated is conditional — "money is in
-- dollars" — and a default cannot express a condition. This can: if an amount
-- is given and nobody said in what, it is dollars.
--
-- EXISTING ROWS ARE NOT TOUCHED. An appointment already recorded in francs
-- stays in francs; restating somebody's salary in another currency is a
-- decision about their pay, not a data migration.
-- ---------------------------------------------------------------------------
alter table appointments alter column salary_currency drop default;

create or replace function appointment_money_is_in_dollars() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.salary_amount is not null and new.salary_currency is null then
    new.salary_currency := 'USD';
  end if;
  -- A FIGURE WITH NO PERIOD IS NOT A SALARY, and monthly is what the
  -- University's own schedule is quoted over. Stated here rather than left to
  -- whichever screen happened to post the row.
  if new.salary_amount is not null and new.salary_period is null then
    new.salary_period := 'month';
  end if;
  return new;
end $$;

drop trigger if exists appointments_money_is_in_dollars on appointments;
create trigger appointments_money_is_in_dollars
  before insert or update on appointments
  for each row execute function appointment_money_is_in_dollars();

do $$
begin
  -- THE PERIODS THE UNIVERSITY ACTUALLY PAYS OVER. 'contract' and 'stipend' are
  -- the two that were missing and the two a visiting appointment needs: a sum
  -- for the whole engagement, and an honorarium that is not a salary at all.
  if not exists (select 1 from pg_constraint where conname = 'appointments_salary_period_known') then
    alter table appointments add constraint appointments_salary_period_known
      check (salary_period is null or salary_period in
             ('hour', 'month', 'year', 'session', 'contract', 'stipend'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'appointments_currency_known') then
    alter table appointments add constraint appointments_currency_known
      check (salary_currency is null or salary_currency in
             ('USD', 'FCFA', 'EUR', 'GBP', 'NGN'))
      -- NOT VALID. There may be rows carrying a currency typed before there was
      -- a list, and refusing to run rather than naming them would leave the
      -- whole migration unapplied over somebody's historic spelling.
      not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ALLOWANCES — EACH ONE ITS OWN ROW
-- ---------------------------------------------------------------------------
--
-- NOT SEVEN COLUMNS ON `appointments`. Seven columns says every appointment has
-- seven allowances and six of them are zero, which is a claim the University has
-- not made: an honorary appointment has none, and a Dean's responsibility
-- allowance is not a nil housing allowance. A row that does not exist says
-- "this appointment does not carry one", and a row of zero says "it carries one
-- and it is nothing" — two different facts, and the letter prints them
-- differently.

create table if not exists appointment_allowances (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,

  kind           text not null check (kind in (
                   'housing', 'transport', 'communication', 'responsibility',
                   'research', 'entertainment', 'medical', 'other')),
  -- WHAT IT IS CALLED ON THE LETTER, where 'other' needs a name and the rest
  -- have one. An allowance printed as "Other: $200" tells the appointee
  -- nothing.
  label          text,

  amount         numeric(14, 2) not null check (amount > 0),
  currency       text not null default 'USD'
                   check (currency in ('USD', 'FCFA', 'EUR', 'GBP', 'NGN')),
  period         text not null default 'month'
                   check (period in ('hour', 'month', 'year', 'session',
                                     'contract', 'stipend', 'once')),

  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists appointment_allowances_appointment_idx
  on appointment_allowances (appointment_id);

do $$
begin
  -- AN 'other' ALLOWANCE SAYS WHAT IT IS.
  if not exists (select 1 from pg_constraint where conname = 'appointment_allowances_other_is_named') then
    alter table appointment_allowances add constraint appointment_allowances_other_is_named
      check (kind <> 'other' or (label is not null and length(btrim(label)) >= 3));
  end if;

  -- ONE OF EACH KIND, except 'other' which may recur because it is the
  -- catch-all and two different named allowances are two rows.
  if not exists (select 1 from pg_indexes
                  where indexname = 'appointment_allowances_one_of_each_idx') then
    create unique index appointment_allowances_one_of_each_idx
      on appointment_allowances (appointment_id, kind) where kind <> 'other';
  end if;
end $$;

-- THE TOTAL, COMPUTED WHERE IT CANNOT DRIFT. A screen adding these up would be
-- a second answer to "what does this post pay", and the two would disagree the
-- first time somebody changed a rounding rule.
create or replace view appointment_remuneration
with (security_invoker = true) as
  select a.id as appointment_id,
         a.salary_amount,
         a.salary_currency,
         a.salary_period,
         coalesce(sum(al.amount) filter (
           where al.currency = a.salary_currency and al.period = a.salary_period), 0)
           as allowances_same_basis,
         count(al.id) as allowance_count,
         -- SAID OUT LOUD WHEN THEY CANNOT BE ADDED. A monthly salary and an
         -- annual research allowance do not sum, and a view that quietly added
         -- them would put a wrong figure on a letter.
         count(al.id) filter (
           where al.currency <> a.salary_currency or al.period <> a.salary_period)
           as allowances_on_another_basis
    from appointments a
    left join appointment_allowances al on al.appointment_id = a.id
   group by a.id, a.salary_amount, a.salary_currency, a.salary_period;

alter table appointment_allowances enable row level security;

drop policy if exists appointment_allowances_read on appointment_allowances;
create policy appointment_allowances_read on appointment_allowances
  for select to authenticated
  using (exists (select 1 from appointments a where a.id = appointment_allowances.appointment_id));


-- ===========================================================================
-- 2. THE FIVE ACTORS
-- ===========================================================================
--
-- initiated_by  — whose appointment this is. 045.
-- drafted_by    — who typed it. 041.
-- reviewed_by   — who checked it before it went to the authority. Here.
-- authorized_by — who approved it. 041.
-- issued_by     — who sent the letter. Here.
--
-- THE LAST TWO ARE NOT THE SAME PERSON AND WERE NOT THE SAME ACT. An authority
-- approves on Monday; the letter goes out on Thursday. Reading `issued_by` off
-- `authorized_by` is right most of the time and wrong exactly when somebody is
-- asking.

alter table appointments
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists issued_by uuid references auth.users (id) on delete set null;

do $$
begin
  -- A REVIEW NAMES ITS REVIEWER AND ITS MOMENT, or it is not a review.
  if not exists (select 1 from pg_constraint where conname = 'appointments_review_is_complete') then
    alter table appointments add constraint appointments_review_is_complete
      check ((reviewed_by is null) = (reviewed_at is null));
  end if;

  -- ---------------------------------------------------------------------
  -- AND A REVIEWER IS NOT THE DRAFTER.
  --
  -- The point of an internal review is that a second person in the office
  -- reads it before it reaches the Vice-Chancellor. A drafter who reviews
  -- their own work has performed a ceremony, and the Vice-Chancellor is then
  -- told the file was checked when it was not.
  -- ---------------------------------------------------------------------
  if not exists (select 1 from pg_constraint where conname = 'appointments_reviewer_is_not_the_drafter') then
    alter table appointments add constraint appointments_reviewer_is_not_the_drafter
      check (reviewed_by is null or drafted_by is null or reviewed_by <> drafted_by)
      not valid;
  end if;
end $$;


-- ===========================================================================
-- 3. THE SECOND AXIS — WHAT THE UNIVERSITY IS DOING
-- ===========================================================================

alter table appointments
  add column if not exists appointment_action text,
  -- WHAT THIS ONE REPLACES OR CONTINUES. A promotion is a promotion FROM
  -- something, and a renewal renews a term that existed. Without this the
  -- register holds two unconnected appointments for one person and cannot say
  -- which came first.
  add column if not exists supersedes_appointment_id uuid references appointments (id)
    on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_action_known') then
    alter table appointments add constraint appointments_action_known
      check (appointment_action is null or appointment_action in (
        'initial', 'reappointment', 'promotion', 'renewal', 'extension',
        'transfer', 'confirmation', 'amendment'));
  end if;

  -- ---------------------------------------------------------------------
  -- THE ACTIONS THAT ARE ALWAYS ABOUT AN EARLIER APPOINTMENT.
  --
  -- A promotion, renewal, extension or confirmation with nothing behind it is
  -- one of two things: a first appointment somebody mislabelled, or a record
  -- that has lost its predecessor. Both need correcting and neither is
  -- visible without this.
  -- ---------------------------------------------------------------------
  if not exists (select 1 from pg_constraint where conname = 'appointments_continuation_has_a_predecessor') then
    alter table appointments add constraint appointments_continuation_has_a_predecessor
      check (appointment_action is null
             or appointment_action not in ('promotion', 'renewal', 'extension', 'confirmation')
             or supersedes_appointment_id is not null)
      not valid;
  end if;

  -- AND NOTHING SUPERSEDES ITSELF.
  if not exists (select 1 from pg_constraint where conname = 'appointments_nothing_supersedes_itself') then
    alter table appointments add constraint appointments_nothing_supersedes_itself
      check (supersedes_appointment_id is null or supersedes_appointment_id <> id);
  end if;
end $$;

comment on column appointments.appointment_action is
  'What the University is doing: initial, reappointment, promotion, renewal, extension, '
  'transfer, confirmation, amendment. The SECOND axis — employment_type says what kind of '
  'employment it is (permanent, visiting, part-time). A promotion to a full-time post is '
  'both, and one column could record only one of them.';


-- ===========================================================================
-- 4. THE INTERNAL REVIEW STATE
-- ===========================================================================
--
-- ONE STATE ADDED, NOTHING RENAMED. The University proposed
-- draft → submitted → under_review → pending_vc → approved → letter_generation
-- → letter_ready → issued. Most of that already exists under other names, and
-- renaming a live vocabulary rewrites every row and every guard in the system
-- for no gain.
--
--   pending_vc        is what `submitted` already means — submitted TO the VC.
--   letter_ready      is what `letter_generated` already means.
--   letter_generation is not a state. It is the second the document is being
--                     rendered, and a state nothing can be in for long is a
--                     state a screen shows by accident during a refresh.
--   returned          is `draft` again, with a RETURNED event in the history
--                     saying why. A separate state would make "returned" a
--                     place an appointment can sit forever without anybody
--                     owning it.
--
-- `under_review` is the one that was genuinely missing: the office's own check
-- before the file reaches the Vice-Chancellor.

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'appointments'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%amendment_requested%'
     and pg_get_constraintdef(oid) like '%letter_generated%'
   limit 1;

  if con is not null then
    execute format('alter table appointments drop constraint %I', con);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'appointments_status_known') then
    alter table appointments add constraint appointments_status_known
      check (status in (
        'draft', 'under_review', 'submitted', 'approved', 'letter_generated',
        'issued', 'accepted', 'active', 'amendment_requested',
        'declined', 'withdrawn', 'ended'));
  end if;
end $$;


-- ===========================================================================
-- 5. THE DOOR THE UNIVERSITY ASKED TO CLOSE
-- ===========================================================================
--
-- "An appointment cannot be `issued` without an approved decision and an
-- archived appointment document."
--
-- A TRIGGER RATHER THAN A CHECK, because a check constraint cannot read another
-- table. Until now `issued` was a status somebody could set with nothing behind
-- it: the register said a letter had gone and the appointee was holding
-- nothing.

create or replace function refuse_issue_without_a_document() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('issued', 'accepted', 'active')
     and (old.status is distinct from new.status) then

    if new.authorized_by is null or new.authorized_at is null then
      raise exception
        'This appointment has not been approved, so no letter can be issued from it. '
        'Approval and issue are two acts by two authorities, and this is the second one '
        'asking for the first.'
        using errcode = 'check_violation';
    end if;

    if not exists (
      select 1 from appointment_letters l
       where l.appointment_id = new.id and l.superseded_at is null
    ) then
      raise exception
        'No appointment letter is archived for this appointment, so it cannot be marked '
        'issued. Generate the letter first: an appointment recorded as issued with no '
        'document behind it is an appointee holding nothing while the register says '
        'otherwise.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists appointments_issue_needs_a_document on appointments;
create trigger appointments_issue_needs_a_document
  before update on appointments
  for each row execute function refuse_issue_without_a_document();


-- ===========================================================================
-- 6. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  b_id uuid;
  someone uuid;
  other uuid;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '047: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    -- ---- AN APPOINTMENT WITH NO PAY AT ALL IS STILL VALID -----------------
    -- THE CASE A COLUMN DEFAULT BROKE. An honorary appointment carries no
    -- salary, and a default currency gave it one with no amount beside it —
    -- refused by 041, correctly, as an incomplete salary. Proved first because
    -- it is the case nobody would have tried until the University appointed
    -- somebody unpaid.
    insert into appointments
      (full_name, position_title, unit_name, employment_type, start_date,
       terms, status, drafted_by)
    values ('An Honorary Appointee', 'Honorary Fellow', 'Faculty of Theology', 'honorary',
            current_date + 30, 'The terms.', 'draft', someone)
    returning id into b_id;
    if (select salary_currency from appointments where id = b_id) is not null then
      raise exception '047 FAILED: an unpaid appointment was given a currency';
    end if;
    delete from appointments where id = b_id;

    -- ---- AND ONE WITH PAY IS PRICED IN DOLLARS ----------------------------
    insert into appointments
      (full_name, position_title, unit_name, employment_type, start_date,
       terms, status, drafted_by, salary_amount)
    values ('A Specimen Appointee', 'Lecturer', 'Faculty of Theology', 'permanent',
            current_date + 30, 'The terms.', 'draft', someone, 2000)
    returning id into a_id;

    if (select salary_currency from appointments where id = a_id) is distinct from 'USD' then
      raise exception '047 FAILED: an appointment created without a currency came out in %, '
                      'not dollars',
        coalesce((select salary_currency from appointments where id = a_id), 'nothing');
    end if;
    if (select salary_period from appointments where id = a_id) is distinct from 'month' then
      raise exception '047 FAILED: a figure with no period given did not become a monthly one';
    end if;

    -- ---- AN ALLOWANCE IS ITS OWN ROW WITH ITS OWN BASIS --------------------
    insert into appointment_allowances (appointment_id, kind, amount, period)
    values (a_id, 'housing', 400, 'month');

    refused := false;
    begin
      insert into appointment_allowances (appointment_id, kind, amount, period)
      values (a_id, 'housing', 100, 'month');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: one appointment carries two housing allowances';
    end if;

    -- ---- AN 'other' ALLOWANCE SAYS WHAT IT IS ------------------------------
    refused := false;
    begin
      insert into appointment_allowances (appointment_id, kind, amount, period)
      values (a_id, 'other', 100, 'month');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: an allowance called "other" and nothing else was accepted';
    end if;

    -- ---- AND NOTHING IS SILENTLY ADDED ACROSS BASES ------------------------
    insert into appointment_allowances (appointment_id, kind, amount, period, currency)
    values (a_id, 'research', 1200, 'year', 'USD');
    if (select allowances_same_basis from appointment_remuneration
         where appointment_id = a_id) <> 400 then
      raise exception '047 FAILED: an annual allowance was added to a monthly salary';
    end if;
    if (select allowances_on_another_basis from appointment_remuneration
         where appointment_id = a_id) <> 1 then
      raise exception '047 FAILED: the allowance on another basis was not reported as one';
    end if;

    -- ---- A REVIEWER IS NOT THE DRAFTER -------------------------------------
    refused := false;
    begin
      update appointments set reviewed_by = someone, reviewed_at = now() where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: the drafter reviewed their own appointment, so the '
                      'Vice-Chancellor is told a file was checked that nobody read';
    end if;
    update appointments set reviewed_by = other, reviewed_at = now() where id = a_id;

    -- ---- A REVIEW WITH NO MOMENT IS NOT A REVIEW ---------------------------
    refused := false;
    begin
      update appointments set reviewed_at = null where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: an appointment was reviewed at no particular time';
    end if;

    -- ---- THE INTERNAL REVIEW STATE IS REACHABLE ----------------------------
    update appointments set status = 'under_review' where id = a_id;
    refused := false;
    begin
      update appointments set status = 'being_thought_about' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: the status vocabulary accepted a state nobody declared';
    end if;

    -- ---- A PROMOTION IS A PROMOTION FROM SOMETHING -------------------------
    refused := false;
    begin
      update appointments set appointment_action = 'promotion' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: a promotion was recorded with nothing behind it';
    end if;
    update appointments set appointment_action = 'initial' where id = a_id;

    insert into appointments
      (full_name, position_title, unit_name, employment_type, start_date, terms,
       status, drafted_by, appointment_action, supersedes_appointment_id)
    values ('A Specimen Appointee', 'Senior Lecturer', 'Faculty of Theology', 'permanent',
            current_date + 400, 'The terms.', 'draft', someone, 'promotion', a_id)
    returning id into b_id;

    refused := false;
    begin
      update appointments set supersedes_appointment_id = b_id where id = b_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: an appointment superseded itself';
    end if;

    -- ---- AND THE DOOR: NO DOCUMENT, NO ISSUE -------------------------------
    update appointments
       set status = 'approved', authorized_by = other, authorized_at = now()
     where id = a_id;

    refused := false;
    begin
      update appointments set status = 'issued', issued_at = now() where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: an appointment was issued with no letter archived for it, '
                      'so the register says a document went out that does not exist';
    end if;

    -- With a letter archived, it goes.
    insert into appointment_letters (appointment_id, reference, issued_on, html)
    values (a_id, 'APT-2026-9047', current_date, '<p>The letter.</p>');
    update appointments set status = 'issued', issued_at = now(), issued_by = other
     where id = a_id;

    -- ---- AND AN UNAPPROVED ONE STILL CANNOT, EVEN WITH A DOCUMENT ----------
    insert into appointment_letters (appointment_id, reference, issued_on, html)
    values (b_id, 'APT-2026-9048', current_date, '<p>The letter.</p>');
    refused := false;
    begin
      update appointments set status = 'issued', issued_at = now() where id = b_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '047 FAILED: an appointment nobody approved was issued because a '
                      'document happened to exist for it';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '047 OK: new appointments are priced in dollars and existing ones are untouched';
  raise notice '047 OK: allowances are separate rows, one of each kind, never summed across '
               'different currencies or periods';
  raise notice '047 OK: a reviewer is not the drafter, and a review names its moment';
  raise notice '047 OK: a promotion, renewal, extension or confirmation names what it follows';
  raise notice '047 OK: nothing is issued without both an approval and an archived letter';
end $$;


-- ===========================================================================
-- 7. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- What the University pays, by currency. Anything still in francs is a record
-- made before this migration and is deliberately left alone.
select salary_currency, salary_period, count(*) as appointments
  from appointments
 where salary_amount is not null
 group by 1, 2
 order by 1, 2;

-- Appointments recorded as issued. After this migration every one of them has a
-- letter behind it; if this returns rows, they predate the trigger and want
-- looking at.
select a.id, a.full_name, a.position_title, a.issued_at
  from appointments a
 where a.status in ('issued', 'accepted', 'active')
   and not exists (select 1 from appointment_letters l
                    where l.appointment_id = a.id and l.superseded_at is null)
 order by a.issued_at;

-- The two axes, crossed. This is the question that could not be asked before.
select coalesce(appointment_action, '(not stated)') as action,
       employment_type,
       count(*) as appointments
  from appointments
 group by 1, 2
 order by 1, 2;
