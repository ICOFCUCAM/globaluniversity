-- ===========================================================================
-- 075 — WHAT A STUDENT IS CHARGED, AND WHETHER THEY ARE CLEAR
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- A NUMBER APPEARS THAT HAS NEVER EXISTED IN THIS SYSTEM: what a student owes.
--
-- Until now `payments` recorded money IN and nothing recorded money OWED, so
-- the student's finance screen could only ever say "here is what we received"
-- and point at the Finance Office for the rest. After this the University can
-- set its fees, raise them against a student, and the balance is arithmetic on
-- rows rather than a figure somebody quotes from memory.
--
-- NOTHING IS CHARGED TO ANYBODY BY THIS FILE. It creates the tables and seeds
-- no schedule, no item and no assessment. Every student's balance the moment
-- this runs is exactly what it was before: nothing assessed, nothing owed. The
-- University sets its own fees on the Fees screen, and the first figure any
-- student sees is one somebody at the University typed.
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S INSTRUCTION
-- ---------------------------------------------------------------------------
--
-- "For the fees, the superadmin should be able to fix it and it is recorded in
-- the system. Superadmin should be able to affix the fees."
--
-- So the schedule is set by the Superadministrator, and every change to it is
-- an attributable, dated act — `set_by`, `set_at`, and an audit row. A fee is
-- the University telling somebody to pay money; it should never be possible to
-- ask who decided it and have no answer.
--
-- ---------------------------------------------------------------------------
-- WHY AN ASSESSMENT IS A SNAPSHOT AND NOT A LOOKUP
-- ---------------------------------------------------------------------------
--
-- The tempting design is a view: join the student to the schedule that applies
-- to them and compute what they owe. It is fewer tables and it is wrong.
--
-- A schedule changes. When tuition goes from 12,200 to 12,800 in August, every
-- student who was invoiced in January would silently start owing 600 more —
-- including students who have already paid in full, who would go into arrears
-- overnight with no record of why. Their receipts would no longer add up to
-- their invoice and nobody could reconstruct the figure they were originally
-- given.
--
-- So `student_fee_assessments` COPIES the label, the amount and the currency at
-- the moment it is raised. The schedule is what the University charges from now
-- on; the assessment is what this student was actually asked for, and it does
-- not move unless somebody deliberately moves it.
--
-- ---------------------------------------------------------------------------
-- MONEY IS NEVER ADDED ACROSS CURRENCIES
-- ---------------------------------------------------------------------------
--
-- `payments` already permits FCFA, USD, EUR, GBP and NGN, and this system holds
-- no exchange rate — rightly, because an exchange rate is a decision somebody
-- has to make on a date, not a constant.
--
-- So a balance is computed PER CURRENCY. A student assessed in USD who pays in
-- FCFA has two lines, not one, and the screen says so. The alternative — a
-- single total using a rate this file invented — would put a wrong number on a
-- financial screen, which is the one place a wrong number does immediate harm.
--
-- ---------------------------------------------------------------------------
-- AND FINANCIAL CLEARANCE IS A DECISION, NOT A SUBTRACTION
-- ---------------------------------------------------------------------------
--
-- The University asked what is best here. This file implements an answer and
-- the reasoning is worth stating, because it is a judgement rather than a fact.
--
-- Computing clearance — "assessed minus paid is zero, therefore cleared" —
-- fails in both directions. A student who paid cash at a desk that was never
-- keyed in is refused their degree by a machine. A student whose fees were
-- waived by the Vice-Chancellor has a balance for ever and can never be
-- cleared at all.
--
-- Recording it alone — a tick somebody applies — fails differently: nobody has
-- to look at the ledger before ticking, and the tick becomes a formality.
--
-- So BOTH, and they are kept apart on purpose:
--
--   `student_fee_account`  says what the LEDGER says. Always computed, never
--                          stored, cannot be argued with.
--   `financial_clearances` says what FINANCE DECIDED. Dated, attributable,
--                          and REQUIRED for graduation.
--
-- The graduation screen shows the two side by side, so a clearance granted
-- against an outstanding balance is visible as exactly that — with the reason
-- beside it — rather than hidden inside a green tick. That is the same shape as
-- 069's `conferred_despite`, which exists for the same reason.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.payments') is null then
    raise exception
      'There is no payments table for a balance to be struck against. Run the whole bundle.';
  end if;
  if to_regclass('public.programmes') is null then
    raise exception 'Migration 057 has not been run. Run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. WHAT THE UNIVERSITY CHARGES
-- ===========================================================================
--
-- A SCHEDULE IS "these fees, for this kind of student, in this session".
--
-- Its scope is deliberately three NULLABLE columns rather than a required set:
-- a University with one schedule for everybody should not have to create
-- forty-one of them, and one that charges the Doctorate differently should not
-- have to hand-maintain a list of which programmes that means.
--
--   programme_id  null = every programme
--   award_level   null = every level
--   study_mode    null = full-time and part-time alike
--
-- NARROWEST MATCH WINS, and that is decided in `fee_schedule_for()` below
-- rather than by each caller, because "which schedule applies to this student"
-- having two answers is how two students on the same programme get different
-- invoices.

create table if not exists fee_schedules (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(btrim(name)) between 3 and 120),

  -- WHICH SESSION IT IS FOR. Text rather than a foreign key to
  -- `academic_years`, because a University sets next year's fees before next
  -- year exists as a row — and a schedule nobody can create until the calendar
  -- is rolled is a schedule nobody sets in time.
  session_label  text not null check (length(btrim(session_label)) between 4 and 20),

  programme_id   uuid references programmes (id) on delete cascade,
  award_level    text check (award_level in ('Certificate', 'Diploma', 'Bachelor''s',
                                             'Postgraduate Diploma', 'Master''s', 'Doctorate')),
  study_mode     text check (study_mode in ('Full-time', 'Part-time')),

  -- DRAFT UNTIL PUBLISHED. A half-typed schedule must not be chargeable, and
  -- the University types these one line at a time.
  status         text not null default 'draft'
                 check (status in ('draft', 'published', 'withdrawn')),

  note           text,

  set_by         uuid references auth.users (id) on delete set null,
  set_at         timestamptz not null default now(),
  published_by   uuid references auth.users (id) on delete set null,
  published_at   timestamptz,

  created_at     timestamptz not null default now(),

  -- A PUBLISHED SCHEDULE NAMES WHO PUBLISHED IT. Money the University demands
  -- must always have somebody's name against it.
  constraint fee_schedules_published_by_somebody check (
    status <> 'published' or (published_by is not null and published_at is not null)
  )
);

comment on table fee_schedules is
  'What the University charges, set by the Superadministrator. Scope is three nullable columns '
  '— programme, award level and study mode — so one schedule can cover everybody and a '
  'narrower one can override it for a programme. Nothing is chargeable until it is published.';

create index if not exists fee_schedules_live
  on fee_schedules (session_label) where status = 'published';


-- ---------------------------------------------------------------------------
-- 1 (b) THE LINES ON IT
-- ---------------------------------------------------------------------------

create table if not exists fee_items (
  id            uuid primary key default gen_random_uuid(),
  schedule_id   uuid not null references fee_schedules (id) on delete cascade,

  label         text not null check (length(btrim(label)) between 2 and 120),
  category      text not null default 'tuition' check (category in (
                  'tuition', 'registration', 'examination', 'books', 'housing',
                  'library', 'technology', 'graduation', 'other'
                )),

  -- AMOUNT IS numeric(12,2) AND MUST BE POSITIVE. A fee of zero is not a fee;
  -- it is a line somebody meant to delete, and leaving it on an invoice makes
  -- a student wonder what it is.
  amount        numeric(12,2) not null check (amount > 0),
  currency      text not null default 'USD'
                check (currency in ('FCFA', 'USD', 'EUR', 'GBP', 'NGN')),

  -- HOW OFTEN IT IS CHARGED. The difference between an application fee and
  -- tuition is not the amount, it is this.
  charged       text not null default 'per-year'
                check (charged in ('per-year', 'per-semester', 'once')),

  -- OPTIONAL LINES ARE NOT INVOICED AUTOMATICALLY. Housing is real and is not
  -- owed by somebody living at home, and an invoice that assumes otherwise is
  -- one the student has to argue with.
  mandatory     boolean not null default true,

  note          text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

comment on table fee_items is
  'One line of a fee schedule. `mandatory` is what separates tuition from housing: an optional '
  'line is offered when an assessment is raised rather than added to it silently.';

create index if not exists fee_items_by_schedule on fee_items (schedule_id, sort_order);


-- ---------------------------------------------------------------------------
-- 1 (c) WHICH SCHEDULE APPLIES TO A STUDENT
-- ---------------------------------------------------------------------------
--
-- NARROWEST WINS, decided once. A schedule naming the programme beats one
-- naming only the award level, which beats one naming nothing. Where two
-- schedules are equally specific the most recently published wins, because
-- that is the University's latest decision.

create or replace function fee_schedule_for(
  p_session text, p_programme_id uuid, p_award_level text, p_study_mode text
) returns uuid language sql stable as $$
  select s.id
    from fee_schedules s
   where s.status = 'published'
     and s.session_label = p_session
     and (s.programme_id is null or s.programme_id = p_programme_id)
     and (s.award_level  is null or s.award_level  = p_award_level)
     and (s.study_mode   is null or s.study_mode   = p_study_mode)
   order by (s.programme_id is not null) desc,
            (s.award_level  is not null) desc,
            (s.study_mode   is not null) desc,
            s.published_at desc
   limit 1;
$$;

comment on function fee_schedule_for(text, uuid, text, text) is
  'The published schedule that applies to a student, narrowest first. Decided here so that '
  '"which fees apply to me" cannot have two answers on two screens.';


-- ===========================================================================
-- 2. WHAT THIS STUDENT WAS ACTUALLY ASKED FOR
-- ===========================================================================
--
-- THE SNAPSHOT. See the header: label, amount and currency are COPIED here,
-- not looked up, so that changing next year's tuition does not rewrite last
-- year's invoices.

create table if not exists student_fee_assessments (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,

  -- WHERE IT CAME FROM, for tracing only. ON DELETE SET NULL: deleting a
  -- schedule must never delete an invoice a student has already paid.
  schedule_id    uuid references fee_schedules (id) on delete set null,
  item_id        uuid references fee_items (id) on delete set null,

  session_label  text not null,
  -- Null where the fee is for the whole session rather than one semester.
  semester       integer check (semester between 1 and 3),

  label          text not null check (length(btrim(label)) between 2 and 120),
  category       text not null default 'tuition',
  amount         numeric(12,2) not null check (amount > 0),
  currency       text not null check (currency in ('FCFA', 'USD', 'EUR', 'GBP', 'NGN')),

  due_on         date,

  -- A WAIVER IS A REDUCTION WITH A REASON, not a quiet edit of the amount.
  -- Editing `amount` down to zero would leave no trace that anybody decided
  -- anything; this leaves the original figure standing and records the
  -- decision beside it.
  waived         numeric(12,2) not null default 0 check (waived >= 0),
  waiver_reason  text,
  waived_by      uuid references auth.users (id) on delete set null,

  status         text not null default 'raised'
                 check (status in ('raised', 'cancelled')),
  cancel_reason  text,

  raised_by      uuid references auth.users (id) on delete set null,
  raised_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),

  -- NOTHING IS WAIVED WITHOUT A REASON, and nothing is waived beyond the
  -- amount charged — a negative bill is not a thing.
  constraint student_fee_assessments_waiver_reasoned check (
    waived = 0
    or (waiver_reason is not null and length(btrim(waiver_reason)) >= 10
        and waived_by is not null)
  ),
  constraint student_fee_assessments_waiver_within check (waived <= amount),
  constraint student_fee_assessments_cancel_reasoned check (
    status <> 'cancelled'
    or (cancel_reason is not null and length(btrim(cancel_reason)) >= 10)
  )
);

comment on table student_fee_assessments is
  'What a student was actually asked to pay. The label, amount and currency are COPIED from the '
  'schedule at the moment the assessment is raised — a snapshot, so that changing next '
  'year''s tuition does not silently rewrite what somebody was invoiced last January.';

create index if not exists student_fee_assessments_by_student
  on student_fee_assessments (student_id, session_label);
-- The same fee is not raised against the same student twice for the same term.
-- A duplicate invoice is the fault a finance office spends the most time
-- unpicking, and it is cheap to refuse here.
create unique index if not exists student_fee_assessments_once
  on student_fee_assessments (student_id, item_id, session_label,
                              coalesce(semester, 0))
  where item_id is not null and status = 'raised';


-- ---------------------------------------------------------------------------
-- 2 (b) THE ACCOUNT — WHAT THE LEDGER SAYS, PER CURRENCY
-- ---------------------------------------------------------------------------
--
-- COMPUTED, NEVER STORED. A stored balance is a number that drifts from the
-- rows it came from, and the first time it does, nobody knows which is right.

create or replace view student_fee_account as
with charged as (
  select a.student_id,
         a.currency,
         sum(a.amount)              as assessed,
         sum(a.waived)              as waived,
         sum(a.amount - a.waived)   as payable
    from student_fee_assessments a
   where a.status = 'raised'
   group by a.student_id, a.currency
),
paid as (
  select p.student_id, p.currency, sum(p.amount) as paid
    from payments p
   group by p.student_id, p.currency
)
select coalesce(c.student_id, p.student_id)       as student_id,
       coalesce(c.currency, p.currency)           as currency,
       coalesce(c.assessed, 0)                    as assessed,
       coalesce(c.waived, 0)                      as waived,
       coalesce(c.payable, 0)                     as payable,
       coalesce(p.paid, 0)                        as paid,
       coalesce(c.payable, 0) - coalesce(p.paid, 0) as outstanding,
       -- NOTHING ASSESSED IS NOT THE SAME AS NOTHING OWED, and this is the
       -- column that keeps them apart. A student with no assessment has an
       -- outstanding of zero, and a screen reading that as "you are paid up"
       -- would be inventing the University's position. Every consumer must
       -- check this before showing a balance as meaningful.
       (c.student_id is not null)                 as has_been_assessed
  from charged c
  full outer join paid p
    on p.student_id = c.student_id and p.currency = c.currency;

comment on view student_fee_account is
  'What the ledger says, per student per currency. Never added across currencies, because this '
  'system holds no exchange rate and inventing one would put a wrong number on a financial '
  'screen. `has_been_assessed` separates "owes nothing" from "has never been charged".';


-- ===========================================================================
-- 3. FINANCIAL CLEARANCE — A DECISION, RECORDED
-- ===========================================================================
--
-- See the header for why this is not `outstanding <= 0`.

create table if not exists financial_clearances (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students (id) on delete cascade,

  -- WHAT IT IS FOR. A student cleared to graduate is not thereby cleared to
  -- register next year; they are different questions asked at different times.
  purpose       text not null default 'graduation'
                check (purpose in ('graduation', 'registration', 'transcript', 'general')),

  cleared       boolean not null,
  -- WHAT THE LEDGER SAID WHEN THE DECISION WAS TAKEN. Copied, like an
  -- assessment, so that a clearance granted against a 400 balance still shows
  -- the 400 years later — after the balance has been paid and the evidence of
  -- the judgement would otherwise have vanished.
  outstanding_at_decision numeric(12,2),
  currency      text check (currency in ('FCFA', 'USD', 'EUR', 'GBP', 'NGN')),

  -- REQUIRED WHERE THE LEDGER DISAGREES. Clearing somebody who owes money is a
  -- legitimate act — a waiver, a scholarship, an instalment agreement — and it
  -- is the one that must never be silent.
  reason        text,

  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz not null default now(),
  -- A clearance can be revoked; the row stays, so the history is legible.
  revoked_at    timestamptz,
  revoked_by    uuid references auth.users (id) on delete set null,
  revoke_reason text,

  created_at    timestamptz not null default now(),

  constraint financial_clearances_against_a_balance_is_reasoned check (
    cleared = false
    or coalesce(outstanding_at_decision, 0) <= 0
    or (reason is not null and length(btrim(reason)) >= 10)
  ),
  constraint financial_clearances_refusal_is_reasoned check (
    cleared = true or (reason is not null and length(btrim(reason)) >= 10)
  ),
  constraint financial_clearances_revoked_together check (
    (revoked_at is null and revoked_by is null and revoke_reason is null)
    or (revoked_at is not null and revoke_reason is not null
        and length(btrim(revoke_reason)) >= 10)
  )
);

comment on table financial_clearances is
  'What Finance DECIDED about a student''s account, as against what the ledger says. Both are '
  'shown side by side on the graduation screen: a clearance granted against an outstanding '
  'balance is visible as exactly that, with the reason, rather than hidden inside a green tick.';

create index if not exists financial_clearances_live
  on financial_clearances (student_id, purpose, decided_at desc)
  where revoked_at is null;

-- THE ONE IN FORCE. "Is this student cleared" must have one answer, and
-- deciding it by "the newest row that is not revoked" in each caller is how two
-- screens come to disagree on a Tuesday.
create or replace view financial_clearance_now as
select distinct on (c.student_id, c.purpose)
       c.student_id,
       c.purpose,
       c.cleared,
       c.reason,
       c.outstanding_at_decision,
       c.currency,
       c.decided_by,
       c.decided_at
  from financial_clearances c
 where c.revoked_at is null
 order by c.student_id, c.purpose, c.decided_at desc;

comment on view financial_clearance_now is
  'The clearance standing for each student and purpose: the newest that has not been revoked. '
  'One answer, in one place.';


-- ===========================================================================
-- 4. PROVE IT
-- ===========================================================================

do $$
declare
  stu        uuid;
  dept       uuid;
  prog       uuid;
  sched      uuid;
  item       uuid;
  officer    uuid;
  n          integer;
  amt        numeric;
  flag       boolean;
  picked     uuid;
begin
  begin
    insert into auth.users (id, email)
    values (gen_random_uuid(), 'proof075@example.invalid') returning id into officer;

    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
      values ('Proof Department 075', 'PRF075', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into students (
      matric_no, first_name, last_name, email, department_id, program,
      degree_type, admission_year, status, student_status
    ) values (
      'PRF075/0001', 'Proof', 'Student', 'proof075@example.invalid', dept,
      'Proof Programme', 'BA', 2026, 'enrolled', 'active'
    ) returning id into stu;

    -- =================================================================
    -- A SCHEDULE IS NOT CHARGEABLE UNTIL SOMEBODY PUBLISHES IT
    -- =================================================================
    insert into fee_schedules (name, session_label, status, set_by)
    values ('Proof schedule 2026/27', '2026/2027', 'draft', officer)
    returning id into sched;

    begin
      update fee_schedules set status = 'published' where id = sched;
      raise exception '075 FAILED: a schedule was published with nobody''s name on it';
    exception when check_violation then null;
    end;

    update fee_schedules
       set status = 'published', published_by = officer, published_at = now()
     where id = sched;

    -- =================================================================
    -- A FEE OF ZERO IS NOT A FEE
    -- =================================================================
    begin
      insert into fee_items (schedule_id, label, amount, currency)
      values (sched, 'A line somebody meant to delete', 0, 'USD');
      raise exception '075 FAILED: a fee of zero was accepted';
    exception when check_violation then null;
    end;
    begin
      insert into fee_items (schedule_id, label, amount, currency)
      values (sched, 'A negative fee', -100, 'USD');
      raise exception '075 FAILED: a negative fee was accepted';
    exception when check_violation then null;
    end;

    insert into fee_items (schedule_id, label, category, amount, currency, charged)
    values (sched, 'Full-time tuition', 'tuition', 12200, 'USD', 'per-year')
    returning id into item;

    -- =================================================================
    -- THE NARROWEST SCHEDULE WINS
    -- =================================================================
    --
    -- Asserted by creating a narrower one and checking it is chosen, then
    -- withdrawing it and checking the general one comes back. A resolver that
    -- picks the wrong schedule invoices a whole cohort incorrectly.
    select id into prog from programmes limit 1;
    declare
      narrow uuid;
    begin
      insert into fee_schedules (name, session_label, programme_id, status,
                                 set_by, published_by, published_at)
      values ('Proof programme schedule', '2026/2027', prog, 'published',
              officer, officer, now())
      returning id into narrow;

      select fee_schedule_for('2026/2027', prog, 'Bachelor''s', 'Full-time') into picked;
      if picked <> narrow then
        raise exception '075 FAILED: the programme-specific schedule was not chosen';
      end if;

      -- A student on ANOTHER programme still gets the general one.
      select fee_schedule_for('2026/2027', gen_random_uuid(), 'Bachelor''s', 'Full-time')
        into picked;
      if picked <> sched then
        raise exception '075 FAILED: a student on another programme did not get the general schedule';
      end if;

      update fee_schedules set status = 'withdrawn' where id = narrow;
      select fee_schedule_for('2026/2027', prog, 'Bachelor''s', 'Full-time') into picked;
      if picked <> sched then
        raise exception '075 FAILED: a withdrawn schedule was still being applied';
      end if;
    end;

    -- =================================================================
    -- THE ASSESSMENT IS A SNAPSHOT, AND THIS IS THE PROOF OF IT
    -- =================================================================
    --
    -- THE ASSERTION THIS TABLE EXISTS FOR. Raise an invoice, then change the
    -- schedule, and the invoice must not move. If it does, every student who
    -- has already paid goes into arrears the day tuition rises.
    insert into student_fee_assessments (
      student_id, schedule_id, item_id, session_label, label, category,
      amount, currency, raised_by
    ) values (
      stu, sched, item, '2026/2027', 'Full-time tuition', 'tuition',
      12200, 'USD', officer
    );

    update fee_items set amount = 12800 where id = item;

    select amount into amt from student_fee_assessments
     where student_id = stu and item_id = item;
    if amt <> 12200 then
      raise exception
        '075 FAILED: raising the schedule to 12800 changed an invoice already raised at 12200 '
        '(it now reads %)', amt;
    end if;

    -- =================================================================
    -- THE SAME FEE IS NOT RAISED TWICE
    -- =================================================================
    begin
      insert into student_fee_assessments (
        student_id, schedule_id, item_id, session_label, label, amount, currency, raised_by
      ) values (stu, sched, item, '2026/2027', 'Full-time tuition', 12200, 'USD', officer);
      raise exception '075 FAILED: the same fee was raised against the same student twice';
    exception when unique_violation then null;
    end;

    -- =================================================================
    -- A WAIVER IS A DECISION WITH A REASON, AND CANNOT EXCEED THE BILL
    -- =================================================================
    begin
      update student_fee_assessments set waived = 500 where student_id = stu;
      raise exception '075 FAILED: money was waived with no reason and nobody''s name on it';
    exception when check_violation then null;
    end;
    begin
      update student_fee_assessments
         set waived = 99999, waiver_reason = 'Scholarship awarded by the Senate',
             waived_by = officer
       where student_id = stu;
      raise exception '075 FAILED: more was waived than was ever charged';
    exception when check_violation then null;
    end;

    -- =================================================================
    -- THE LEDGER ADDS UP, AND NEVER ACROSS CURRENCIES
    -- =================================================================
    insert into payments (student_id, reference, amount, currency, purpose, method)
    values (stu, 'PRF075-1', 2200, 'USD', 'Tuition', 'bank');

    select outstanding into amt from student_fee_account
     where student_id = stu and currency = 'USD';
    if amt <> 10000 then
      raise exception '075 FAILED: 12200 charged less 2200 paid is not % ', amt;
    end if;

    -- A PAYMENT IN ANOTHER CURRENCY DOES NOT TOUCH THE USD BALANCE.
    insert into payments (student_id, reference, amount, currency, purpose, method)
    values (stu, 'PRF075-2', 500000, 'FCFA', 'Tuition', 'mobile');

    select outstanding into amt from student_fee_account
     where student_id = stu and currency = 'USD';
    if amt <> 10000 then
      raise exception
        '075 FAILED: an FCFA payment changed the USD balance to % — this system holds no '
        'exchange rate and must not invent one', amt;
    end if;

    select count(*) into n from student_fee_account where student_id = stu;
    if n <> 2 then
      raise exception '075 FAILED: two currencies did not produce two lines (got %)', n;
    end if;

    -- AND THE FCFA LINE IS PAID-ONLY, never assessed.
    select has_been_assessed into flag from student_fee_account
     where student_id = stu and currency = 'FCFA';
    if flag then
      raise exception '075 FAILED: an FCFA line claims to have been assessed';
    end if;

    -- =================================================================
    -- NOTHING ASSESSED IS NOT NOTHING OWED
    -- =================================================================
    --
    -- The column that stops a brand-new student being told they are paid up.
    declare
      fresh uuid;
    begin
      insert into students (
        matric_no, first_name, last_name, email, department_id, program,
        degree_type, admission_year, status, student_status
      ) values (
        'PRF075/0002', 'Never', 'Charged', 'proof075b@example.invalid', dept,
        'Proof Programme', 'BA', 2026, 'enrolled', 'active'
      ) returning id into fresh;

      select count(*) into n from student_fee_account where student_id = fresh;
      if n <> 0 then
        raise exception
          '075 FAILED: a student who has never been charged has an account line';
      end if;
    end;

    -- =================================================================
    -- CLEARANCE AGAINST A BALANCE IS ALLOWED, AND NEVER SILENT
    -- =================================================================
    --
    -- THE JUDGEMENT AT THE TOP OF THIS FILE, ASSERTED. A waiver or a
    -- scholarship must be clearable; it must never be clearable without
    -- somebody saying why.
    begin
      insert into financial_clearances (student_id, purpose, cleared,
                                        outstanding_at_decision, currency, decided_by)
      values (stu, 'graduation', true, 10000, 'USD', officer);
      raise exception
        '075 FAILED: a student owing 10000 was cleared with no reason recorded';
    exception when check_violation then null;
    end;

    insert into financial_clearances (student_id, purpose, cleared,
                                      outstanding_at_decision, currency, reason, decided_by)
    values (stu, 'graduation', true, 10000, 'USD',
            'Balance carried under an instalment agreement approved by the Finance Director.',
            officer);

    -- A REFUSAL ALSO NEEDS A REASON. Being refused clearance with no
    -- explanation is the thing a student cannot act on at all.
    begin
      insert into financial_clearances (student_id, purpose, cleared, decided_by)
      values (stu, 'registration', false, officer);
      raise exception '075 FAILED: clearance was refused with no reason';
    exception when check_violation then null;
    end;

    -- CLEARING SOMEBODY WHO OWES NOTHING NEEDS NO REASON, because there is
    -- nothing to explain.
    insert into financial_clearances (student_id, purpose, cleared,
                                      outstanding_at_decision, currency, decided_by)
    values (stu, 'registration', true, 0, 'USD', officer);

    -- =================================================================
    -- AND ONE ANSWER STANDS, NOT THE FIRST ONE FOUND
    -- =================================================================
    select cleared into flag from financial_clearance_now
     where student_id = stu and purpose = 'graduation';
    if not flag then
      raise exception '075 FAILED: the standing clearance is not the one recorded';
    end if;

    -- A revoked clearance stops standing, and the row survives.
    update financial_clearances
       set revoked_at = now(), revoked_by = officer,
           revoke_reason = 'Instalment agreement lapsed; balance now due in full.'
     where student_id = stu and purpose = 'graduation';

    select count(*) into n from financial_clearance_now
     where student_id = stu and purpose = 'graduation';
    if n <> 0 then
      raise exception '075 FAILED: a revoked clearance is still standing';
    end if;
    select count(*) into n from financial_clearances
     where student_id = stu and purpose = 'graduation';
    if n <> 1 then
      raise exception '075 FAILED: revoking a clearance destroyed the record of it';
    end if;

    raise notice '075 OK — a schedule is not chargeable until somebody publishes it under '
      'their own name; the narrowest one wins; an invoice already raised does not move when the '
      'schedule does; nothing is waived or cleared or refused without a reason; a payment in one '
      'currency never touches a balance in another; a student who has never been charged is not '
      'reported as paid up; and one clearance stands at a time.';

    raise exception 'ROLLBACK_075';
  exception
    when others then
      if sqlerrm = 'ROLLBACK_075' then
        return;
      end if;
      raise;
  end;
end $$;
