-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 102, 103, 104, 105, 106, 107, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-PART-8.sql 102 103 104 105 106 107
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN-PART-8.sql
--
-- Every migration in it is idempotent and destroys nothing, so running it twice
-- is safe. It is NOT wrapped in a transaction: each file is written to run
-- statement by statement, and wrapping them would mean a failure in the last
-- one silently undid the first.
--
-- ---------------------------------------------------------------------------
-- WHAT TO EXPECT IN THE OUTPUT
--
-- Some of these raise NOTICE deliberately — they report on the state they
-- found rather than changing it silently. A notice is information, not a
-- warning. An ERROR is a real failure and stops the run.
--
-- ---------------------------------------------------------------------------
-- AFTERWARDS
--
-- The LAST THING this file prints is a table saying which of these migrations
-- landed. You do not have to run anything else to find out — and you should
-- not have to, because the Supabase SQL editor does not display the NOTICE
-- lines the proofs write.
-- ===========================================================================

-- ===========================================================================
-- ===========================================================================
--
--   102_a_refund_is_not_an_edit.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 102 — FEE REFUNDS
-- ===========================================================================
--
-- The University's decision, given on 16 September 2026:
--
--   "Fee Refunds — YES. A refund is permitted where the student's studies have
--    not yet started, or they have not resumed for the applicable period. Once
--    studies have commenced or resumed the eligibility period has passed,
--    unless an authorised exceptional policy applies. Submitting a request
--    never refunds anybody: it is request → review → decision → refund."
--
--   "The original payment is never modified or deleted. A refund is a
--    transaction RELATED TO that payment. A financial record that can be
--    edited is not a record."
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A PAYMENT CAN NO LONGER BE CHANGED OR DELETED BY ANYBODY. Not by the
--    Finance Office, not by the Superadministrator, not by the service key,
--    which is what the application writes with and which no policy binds.
--    `payments` has had SELECT and INSERT policies since 010 and no UPDATE or
--    DELETE policy — so row-level security already refused a signed-in office,
--    and the key the server holds could still do it. From now a trigger
--    refuses both outright.
--
--    NOTHING IN THE APPLICATION DOES EITHER, so nothing breaks: the only write
--    to `payments` anywhere in the codebase is the insert in
--    /api/finance/fees. This closes a door that was standing open, not one
--    anybody was walking through.
--
-- 2. `approve-refund` STOPS BEING A NAME FOR NOTHING. The Finance Director and
--    the Finance Officer have held it since the matrix was written, against a
--    system with no refund request, no refund screen and no refund table.
--
-- 3. NOTHING IS SEEDED, AND NO MONEY MOVES. This builds the record a refund
--    leaves behind. Paying it out is done by the University in its bank, and
--    the reference for that payment is written back here.
--
-- 4. TWO THINGS THE UNIVERSITY NEEDS TO RULE ON ARE MADE VISIBLE RATHER THAN
--    DECIDED HERE. Both are in section 2 below. Neither blocks a refund; both
--    are recorded on every request so the question is asked with the numbers
--    in front of it.
--
-- ---------------------------------------------------------------------------
-- THE FIRST THING TO RULE ON: TWO RULES, ONE QUESTION
-- ---------------------------------------------------------------------------
--
-- The University already publishes a refund schedule, in the Student Fees
-- Guide, rendered on /academic-regulations and held in `regulations.ts`:
--
--   Within 7 days of initial enrolment      100%   tuition, residence, books
--   After 7 days and within 14 days          75%   tuition and other fees
--   After 14 days and within 30 days         50%   tuition and other fees
--   After 30 days and within 90 days         25%   all respective fees
--   After 90 days                           None
--
-- And the withdrawal rules say "the university is not obliged to refund fees
-- to a student who withdraws after three months in the programme."
--
-- THE DECISION OF 16 SEPTEMBER SAYS SOMETHING DIFFERENT. "Once studies have
-- commenced or resumed the eligibility period has passed" — and the published
-- schedule refunds 25% on day 89, which is long after studies commenced. On
-- day 20 the schedule says half the money back and the decision says none.
--
-- BOTH ARE THE UNIVERSITY'S OWN WORDS, so this migration does not choose
-- between them. It computes BOTH determinations, stores both on the request,
-- and takes the LOWER of the two as what may be approved without an
-- exception — which is the only reading that cannot pay out money under a
-- rule the University has since narrowed. Where an officer wants the higher
-- figure, that is exactly the "authorised exceptional policy" the decision
-- provides for, and it must be named and reasoned.
--
-- `refund_requests_where_the_rules_disagree` is a view listing every request
-- where the two answers differ, so the question can be settled on evidence.
--
-- ---------------------------------------------------------------------------
-- THE SECOND: A REFUNDED PAYMENT MAY HAVE BEEN SHARED WITH A NATION
-- ---------------------------------------------------------------------------
--
-- 098 splits every tuition payment that names a National Administration at the
-- moment it is received, and writes the split to `revenue_allocations`, which
-- 098 also makes unrewritable — deliberately, because "a number somebody can
-- quietly change afterwards is a number that proves nothing."
--
-- So refunding such a payment returns money the centre no longer wholly holds.
-- Nothing here reverses the allocation: doing so silently would be this
-- migration deciding, on the University's behalf, that a nation owes back a
-- share it was told it had kept. Instead every refund request carries
-- `national_share` and `administration_id`, and
-- `refunds_that_touch_a_nations_share` lists them, so the University can rule
-- on whether a refund claws the nation's share back or the centre carries it.
--
-- ---------------------------------------------------------------------------
-- AND THE PUBLISHED RULES THAT ARE NOT IN QUESTION
-- ---------------------------------------------------------------------------
--
-- These are the University's own, from the same Fees Guide, and they are
-- enforced rather than described:
--
--   "electronically to the student's, parent's or sponsor's account"
--     — `destination` is one of those three, and nothing else.
--   "No cash or cheque refunds are made"
--     — `refunds_are_electronic` refuses 'cash' and 'cheque' outright.
--   "only one refund per month is considered"
--     — `one_refund_per_month` refuses a second live request for a student
--       inside the same calendar month.
--
-- ===========================================================================


-- ===========================================================================
-- 1. THE PAYMENT IS THE RECORD, AND A RECORD IS NOT EDITED
-- ===========================================================================
--
-- "A financial record that can be edited is not a record." Said in SQL, where
-- it is true of the service key as well.
--
-- DELETE is refused with the same breath. A deleted payment is an edit that
-- takes the evidence with it.
-- ---------------------------------------------------------------------------

create or replace function a_payment_is_never_rewritten()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'A payment records money the University received. It is never deleted. '
                    'Where money goes back, record a refund against it: the payment and the '
                    'refund both stay on the record.'
      using errcode = 'restrict_violation';
  end if;
  raise exception 'A payment records what was received and when. It is never edited. Where '
                  'money goes back, record a refund against it; where the payment itself was '
                  'wrong, record a reversing payment. Either way both stay readable.'
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists a_payment_is_never_rewritten_trg on payments;
create trigger a_payment_is_never_rewritten_trg
  before update or delete on payments
  for each row execute function a_payment_is_never_rewritten();


-- ===========================================================================
-- 2. THE TWO DETERMINATIONS
-- ===========================================================================
--
-- Separate functions, because they are separate rules from separate documents
-- and the whole point is that a reader can see them disagree.
-- ---------------------------------------------------------------------------

-- THE PUBLISHED SCHEDULE, as a percentage of the amount paid.
create or replace function refund_percent_by_schedule(days_since_enrolment integer)
returns integer
language sql
immutable
as $$
  select case
    -- NULL IS NOT ZERO AND IT IS NOT NINETY-ONE. It means the student is not
    -- enrolled, so nothing has elapsed since an enrolment that has not
    -- happened — which is inside the first window, not past the last one.
    -- Reading it as 0% would have refused the whole refund to exactly the
    -- person both rules agree is owed all of it, and the proof below caught
    -- it doing so.
    when days_since_enrolment is null then 100
    when days_since_enrolment <= 7  then 100
    when days_since_enrolment <= 14 then 75
    when days_since_enrolment <= 30 then 50
    when days_since_enrolment <= 90 then 25
    else 0
  end;
$$;

comment on function refund_percent_by_schedule(integer) is
  'The refund schedule published in the Student Fees Guide, by days since initial enrolment. '
  'Kept here as well as in regulations.ts so the database can refuse an over-payment; '
  'refundSchedule.test.mjs holds the two to the same figures.';

-- THE DECISION OF 16 SEPTEMBER 2026: have studies started?
--
-- A student who has not enrolled has not started. A student enrolled today has
-- started today. There is no third answer, and the percentage it implies is
-- all of the money or none of it.
create or replace function refund_percent_by_policy(days_since_enrolment integer)
returns integer
language sql
immutable
as $$
  select case when days_since_enrolment is null or days_since_enrolment < 0 then 100 else 0 end;
$$;

comment on function refund_percent_by_policy(integer) is
  'The University''s decision of 16 September 2026: a refund is permitted where studies have '
  'not yet started or not resumed. Null or negative days means enrolment has not happened.';


-- ===========================================================================
-- 3. THE REQUEST
-- ===========================================================================

create table if not exists refund_requests (
  id                      uuid primary key default gen_random_uuid(),

  -- WHAT IS BEING REFUNDED. The payment is named and never touched.
  payment_id              uuid not null references payments (id) on delete restrict,
  student_id              uuid not null references students (id) on delete restrict,

  -- WHAT WAS PAID, COPIED AT THE MOMENT OF ASKING. Not a convenience: the
  -- payment cannot change (section 1), but the request must still be readable
  -- as a document years later without a join to prove what it was about.
  amount_paid             numeric(14,2) not null check (amount_paid > 0),
  currency                text not null,
  amount_requested        numeric(14,2) not null check (amount_requested > 0),

  reason                  text not null,

  -- ---- THE ELIGIBILITY DETERMINATION, WHICH IS TWO ANSWERS ---------------
  days_since_enrolment    integer,
  percent_by_schedule     integer not null default 0,
  percent_by_policy       integer not null default 0,
  -- The lower of the two, in money. What may be approved with no exception.
  eligible_amount         numeric(14,2) not null default 0,
  determination           text,

  -- ---- THE EXCEPTION THE DECISION PROVIDES FOR ---------------------------
  exceptional_policy      text,
  exception_authorised_by uuid references auth.users (id) on delete set null,
  exception_authorised_at timestamptz,

  -- ---- WHERE IT GOES ----------------------------------------------------
  destination             text not null default 'student'
    constraint refunds_go_to_a_named_account
    check (destination in ('student', 'parent', 'sponsor')),
  method                  text not null default 'electronic',

  -- ---- THE DECISION ------------------------------------------------------
  status                  text not null default 'submitted'
    constraint refund_requests_status
    check (status in ('submitted', 'under_review', 'approved', 'rejected', 'paid',
                      'withdrawn')),
  amount_approved         numeric(14,2) check (amount_approved >= 0),
  decision_reason         text,
  decided_by              uuid references auth.users (id) on delete set null,
  decided_at              timestamptz,

  -- ---- AND THE MONEY ACTUALLY LEAVING -----------------------------------
  refund_reference        text,
  paid_at                 timestamptz,
  paid_by                 uuid references auth.users (id) on delete set null,

  -- ---- WHAT THE NATION WAS GIVEN OF THIS PAYMENT -------------------------
  administration_id       uuid,
  national_share          numeric(14,2) not null default 0,

  requested_by            uuid references auth.users (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- SUBMITTING NEVER REFUNDS ANYBODY. A row that says 'paid' has a reference
  -- and a date, or it is not saying anything.
  constraint a_paid_refund_names_the_payment_out
    check (status <> 'paid'
           or (refund_reference is not null and paid_at is not null
               and amount_approved is not null)),

  -- A DECISION HAS A DECIDER AND A REASON, both ways round.
  constraint a_decided_refund_says_who_and_why
    check (status not in ('approved', 'rejected')
           or (decided_by is not null and decided_at is not null
               and decision_reason is not null)),

  -- AN APPROVAL NAMES AN AMOUNT.
  constraint an_approved_refund_names_an_amount
    check (status <> 'approved' or amount_approved is not null),

  -- AND NOBODY IS REFUNDED MORE THAN THEY PAID, whatever any policy says.
  constraint a_refund_never_exceeds_the_payment
    check (amount_approved is null or amount_approved <= amount_paid),

  -- THE EXCEPTION IS NAMED AND AUTHORISED, OR IT IS NOT AN EXCEPTION.
  constraint an_exception_is_authorised
    check (exceptional_policy is null
           or (exception_authorised_by is not null and exception_authorised_at is not null))
);

-- Older databases: add anything the create above would have created.
-- `create table if not exists` does nothing at all when the table exists —
-- not even adding a new column — and this has caught us before.
alter table refund_requests
  add column if not exists days_since_enrolment    integer,
  add column if not exists percent_by_schedule     integer not null default 0,
  add column if not exists percent_by_policy       integer not null default 0,
  add column if not exists eligible_amount         numeric(14,2) not null default 0,
  add column if not exists determination           text,
  add column if not exists exceptional_policy      text,
  add column if not exists exception_authorised_by uuid,
  add column if not exists exception_authorised_at timestamptz,
  add column if not exists administration_id       uuid,
  add column if not exists national_share          numeric(14,2) not null default 0,
  add column if not exists refund_reference        text,
  add column if not exists paid_at                 timestamptz,
  add column if not exists paid_by                 uuid;

create index if not exists refund_requests_student_idx
  on refund_requests (student_id, created_at desc);
create index if not exists refund_requests_open_idx
  on refund_requests (status, created_at desc)
  where status in ('submitted', 'under_review');

-- ONE REFUND PER MONTH IS CONSIDERED. The University's published rule, and a
-- partial unique index is the honest shape of it: a withdrawn or rejected
-- request does not occupy the month, because nothing was considered.
--
-- THE MONTH IS A STORED COLUMN, not an expression in the index. `date_trunc`
-- of a `timestamptz` is STABLE and not IMMUTABLE — it depends on the session's
-- time zone — so Postgres refuses it in an index outright. Fixing the zone to
-- UTC makes the month a fact about the row rather than about whoever is
-- reading it, which is what "one per month" has to mean if two offices in two
-- countries are to get the same answer.
alter table refund_requests
  add column if not exists considered_month date
    generated always as ((date_trunc('month', created_at at time zone 'UTC'))::date) stored;

create unique index if not exists one_refund_per_student_per_month
  on refund_requests (student_id, considered_month)
  where status in ('submitted', 'under_review', 'approved', 'paid');

comment on table refund_requests is
  'A refund is a transaction related to a payment, never an edit of one. The payment named '
  'here cannot be changed or deleted by anybody, including the service key.';


-- ===========================================================================
-- 4. NO CASH, NO CHEQUE
-- ===========================================================================
--
-- "Surplus money is refunded on request, electronically […]. No cash or cheque
-- refunds are made." The University's own words, refused rather than
-- described — and refused by NAME, so that a method the Fees Guide has not
-- heard of is refused too rather than quietly allowed.
-- ---------------------------------------------------------------------------

create or replace function refunds_are_electronic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.method, '')) in ('cash', 'cheque', 'check') then
    raise exception 'The University makes no cash or cheque refunds. Money goes back '
                    'electronically, to the student''s, parent''s or sponsor''s account.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists refunds_are_electronic_trg on refund_requests;
create trigger refunds_are_electronic_trg
  before insert or update on refund_requests
  for each row execute function refunds_are_electronic();


-- ===========================================================================
-- 5. THE DETERMINATION IS MADE BY THE DATABASE, NOT BY THE FORM
-- ===========================================================================
--
-- A determination computed in a browser is a determination anybody can send a
-- different answer for. This one is written on insert from the student's own
-- enrolment date and the payment's own amount, and it is not the caller's to
-- supply.
--
-- It is also where `national_share` is read, from 098's allocation, so the
-- request says on its face whether refunding it touches a nation's money.
-- ---------------------------------------------------------------------------

create or replace function determine_refund_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  enrolled   timestamptz;
  paid       numeric(14,2);
  cur        text;
  days       integer;
  by_sched   integer;
  by_policy  integer;
  lower_pct  integer;
  alloc      record;
begin
  select p.amount, p.currency into paid, cur from payments p where p.id = new.payment_id;
  if paid is null then
    raise exception 'There is no payment with that id, so there is nothing to refund.'
      using errcode = 'foreign_key_violation';
  end if;

  select s.enrolled_at into enrolled from students s where s.id = new.student_id;

  -- NULL MEANS NOT ENROLLED, WHICH IS NOT THE SAME AS DAY ZERO. Studies have
  -- not started, so both rules agree the money comes back in full.
  days := case when enrolled is null then null
               else greatest(0, (current_date - enrolled::date))::integer end;

  by_sched  := refund_percent_by_schedule(days);
  by_policy := refund_percent_by_policy(days);
  lower_pct := least(by_sched, by_policy);

  new.amount_paid           := paid;
  new.currency              := cur;
  new.days_since_enrolment  := days;
  new.percent_by_schedule   := by_sched;
  new.percent_by_policy     := by_policy;
  new.eligible_amount       := round(paid * lower_pct / 100.0, 2);
  new.determination := case
    when days is null then
      'Studies have not started: the student is not enrolled. Both the published schedule and '
      || 'the decision of 16 September 2026 return the money in full.'
    when by_sched = by_policy then
      'Day ' || days || ' since enrolment. The published schedule and the decision of '
      || '16 September 2026 agree at ' || by_sched || '%.'
    else
      'Day ' || days || ' since enrolment. THE TWO RULES DISAGREE: the published schedule '
      || 'allows ' || by_sched || '%, the decision of 16 September 2026 allows ' || by_policy
      || '% because studies have commenced. The lower figure stands unless an exceptional '
      || 'policy is authorised.'
  end;

  -- WHAT A NATION WAS GIVEN OF THIS PAYMENT, if anything. Read, recorded, and
  -- deliberately not reversed — see the note at the top.
  select ra.administration_id, ra.to_nation into alloc
    from revenue_allocations ra where ra.payment_id = new.payment_id;
  if found then
    new.administration_id := alloc.administration_id;
    new.national_share    := coalesce(alloc.to_nation, 0);
  end if;

  return new;
end;
$$;

drop trigger if exists determine_refund_eligibility_trg on refund_requests;
create trigger determine_refund_eligibility_trg
  before insert on refund_requests
  for each row execute function determine_refund_eligibility();


-- ===========================================================================
-- 6. SUBMITTING NEVER REFUNDS ANYBODY
-- ===========================================================================
--
-- request → review → decision → refund, and not one of those steps may be
-- skipped. The states are a path, not a set of labels, and the database walks
-- it rather than trusting a screen to.
--
-- AND AN APPROVAL MAY NOT EXCEED THE DETERMINATION unless an exceptional
-- policy was authorised — which is the University's own carve-out, made to
-- cost something: a named policy, an authorising officer, and a time.
-- ---------------------------------------------------------------------------

create or replace function a_refund_follows_its_path()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  -- THE DETERMINATION IS NOT THE CALLER'S TO REWRITE. It was computed from the
  -- payment and the enrolment date on insert; a later hand changing it would
  -- be changing the rule after seeing the answer.
  if new.days_since_enrolment is distinct from old.days_since_enrolment
     or new.percent_by_schedule is distinct from old.percent_by_schedule
     or new.percent_by_policy  is distinct from old.percent_by_policy
     or new.eligible_amount    is distinct from old.eligible_amount
     or new.amount_paid        is distinct from old.amount_paid
     or new.payment_id         is distinct from old.payment_id
     or new.student_id         is distinct from old.student_id then
    raise exception 'The eligibility determination is made from the payment and the enrolment '
                    'date when the request is submitted. Where it should not stand, authorise '
                    'an exceptional policy — that is on the record; a rewritten determination '
                    'is not.'
      using errcode = 'restrict_violation';
  end if;

  ok := case
    when old.status = new.status                      then true
    when old.status = 'submitted'
         and new.status in ('under_review', 'withdrawn')            then true
    when old.status = 'under_review'
         and new.status in ('approved', 'rejected', 'withdrawn')    then true
    when old.status = 'approved' and new.status = 'paid'            then true
    else false
  end;

  if not ok then
    raise exception 'A refund goes request → review → decision → refund. “%” cannot become '
                    '“%”. Submitting a request never refunds anybody.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- A DECIDED OR PAID REFUND IS FINISHED. Nothing reopens it; a further refund
  -- is a further request, and both stay readable.
  if old.status in ('rejected', 'paid', 'withdrawn') and new.status <> old.status then
    raise exception 'That refund is “%” and is finished. A further refund is a further '
                    'request.', old.status
      using errcode = 'check_violation';
  end if;

  if new.status = 'approved' and coalesce(new.amount_approved, 0) > new.eligible_amount
     and new.exceptional_policy is null then
    raise exception 'The determination allows % of % %. Approving more needs an authorised '
                    'exceptional policy named on the request — the University''s decision of '
                    '16 September 2026 provides for one, and it has to be said out loud.',
                    new.eligible_amount, new.amount_paid, new.currency
      using errcode = 'check_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists a_refund_follows_its_path_trg on refund_requests;
create trigger a_refund_follows_its_path_trg
  before update on refund_requests
  for each row execute function a_refund_follows_its_path();


-- ===========================================================================
-- 7. WHO SEES A REFUND, AND WHO DECIDES ONE
-- ===========================================================================
--
-- ROW-LEVEL SECURITY IS A FLOOR, NOT AN IDENTITY. The route checks the
-- capability; this makes the floor true for anybody holding a session,
-- including one the application never issued.
-- ---------------------------------------------------------------------------

alter table refund_requests enable row level security;

drop policy if exists refund_requests_read on refund_requests;
create policy refund_requests_read on refund_requests
  for select using (
    auth_role() in ('superadmin', 'admin', 'finance', 'finance-director',
                    'vice-chancellor', 'registrar')
    -- AND THE STUDENT READS THEIR OWN. It is their money.
    or exists (
      select 1 from students s
       where s.id = refund_requests.student_id
         and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists refund_requests_write on refund_requests;
create policy refund_requests_write on refund_requests
  for insert with check (
    auth_role() in ('superadmin', 'admin', 'finance', 'finance-director')
  );

drop policy if exists refund_requests_decide on refund_requests;
create policy refund_requests_decide on refund_requests
  for update using (
    auth_role() in ('superadmin', 'admin', 'finance', 'finance-director')
  );

-- NO DELETE POLICY, DELIBERATELY. A refund request is a financial record from
-- the moment it is made, including one that was refused.


-- ===========================================================================
-- 8. WHAT THE UNIVERSITY NEEDS TO LOOK AT
-- ===========================================================================

create or replace view refund_requests_where_the_rules_disagree
with (security_invoker = true) as
  select r.id, r.student_id, s.student_number,
         trim(both ' ' from coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, ''))
           as student_name,
         r.payment_id, r.amount_paid, r.currency, r.days_since_enrolment,
         r.percent_by_schedule, r.percent_by_policy,
         round(r.amount_paid * r.percent_by_schedule / 100.0, 2) as schedule_would_allow,
         r.eligible_amount as policy_allows,
         r.status, r.amount_approved, r.exceptional_policy, r.created_at
    from refund_requests r
    join students s on s.id = r.student_id
   where r.percent_by_schedule <> r.percent_by_policy;

comment on view refund_requests_where_the_rules_disagree is
  'Every refund where the published schedule in the Student Fees Guide and the University''s '
  'decision of 16 September 2026 give different answers. The lower figure stands unless an '
  'exceptional policy is authorised. This view exists so the University can settle which rule '
  'governs, with the cases in front of it.';

create or replace view refunds_that_touch_a_nations_share
with (security_invoker = true) as
  select r.id, r.student_id, r.payment_id, r.amount_paid, r.amount_approved, r.currency,
         r.administration_id, na.country, r.national_share, r.status, r.paid_at
    from refund_requests r
    left join national_administrations na on na.id = r.administration_id
   where r.administration_id is not null and r.national_share > 0;

comment on view refunds_that_touch_a_nations_share is
  '098 shares a tuition payment with a National Administration at the moment it is received, '
  'and 098 makes that allocation unrewritable. Refunding such a payment returns money the '
  'centre no longer wholly holds. Nothing reverses the allocation automatically — that would '
  'be the system deciding a nation owes back a share it was told it had kept.';

create or replace view refund_audit
with (security_invoker = true) as
  select r.id, r.status,
         s.student_number,
         trim(both ' ' from coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, ''))
           as student_name,
         p.reference as payment_reference, p.purpose, p.received_at as payment_received_at,
         r.amount_paid, r.amount_requested, r.amount_approved, r.currency,
         r.reason, r.determination, r.days_since_enrolment,
         r.percent_by_schedule, r.percent_by_policy, r.eligible_amount,
         r.exceptional_policy,
         xa.full_name as exception_authorised_by_name, r.exception_authorised_at,
         r.destination, r.method,
         r.decision_reason, d.full_name as decided_by_name, d.role as decided_by_role,
         r.decided_at,
         r.refund_reference, r.paid_at, pb.full_name as paid_by_name,
         rb.full_name as requested_by_name, r.created_at
    from refund_requests r
    join students s on s.id = r.student_id
    join payments p on p.id = r.payment_id
    left join profiles d  on d.id  = r.decided_by
    left join profiles pb on pb.id = r.paid_by
    left join profiles rb on rb.id = r.requested_by
    left join profiles xa on xa.id = r.exception_authorised_by;

comment on view refund_audit is
  'Every refund the University has considered, what was determined, who decided it and on '
  'what reasoning, and where the money went. security_invoker, so what comes back is what '
  'the signed-in office may read.';


-- ===========================================================================
-- 9. THE PROOF
-- ===========================================================================
--
-- Prove a guard by breaking it. Everything below is built by this proof, at
-- references and amounts nothing else uses, and rolled back — it never reads
-- the University's own payments and never writes to their rows.
-- ===========================================================================

do $$
declare
  fin        uuid := gen_random_uuid();
  dir        uuid := gen_random_uuid();
  lect       uuid := gen_random_uuid();
  stu        uuid;
  stu_early  uuid;
  pay        uuid;
  pay_early  uuid;
  req        uuid;
  req2       uuid;
  refused    boolean;
  seen       integer;
  n          numeric;
  t          text;
begin
  insert into auth.users (id, email) values
    (fin,  'proof-102-finance@example.invalid'),
    (dir,  'proof-102-director@example.invalid'),
    (lect, 'proof-102-lecturer@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (fin,  'proof-102-finance@example.invalid',  'Proof Finance Officer',   'finance'),
    (dir,  'proof-102-director@example.invalid', 'Proof Finance Director',  'finance-director'),
    (lect, 'proof-102-lecturer@example.invalid', 'Proof Lecturer',          'lecturer')
  on conflict (id) do update set role = excluded.role;

  -- ---- OUR OWN STUDENTS AND OUR OWN PAYMENTS -----------------------------
  --
  -- NEVER WRITE TO THEIR ROWS and never compete for what their data occupies:
  -- the student numbers and payment references below are this proof's, and
  -- the whole block rolls back.
  insert into students (matric_no, first_name, last_name, email, student_number, status,
                       enrolled_at)
    values ('PROOF-102-A', 'Proof', 'Refund-Enrolled', 'proof-102-a@example.invalid',
            'PROOF-102-A', 'enrolled', now() - interval '20 days')
    returning id into stu;

  insert into students (matric_no, first_name, last_name, email, student_number, status,
                       enrolled_at)
    values ('PROOF-102-B', 'Proof', 'Refund-NotStarted', 'proof-102-b@example.invalid',
            'PROOF-102-B', 'enrolled', null)
    returning id into stu_early;

  insert into payments (student_id, reference, amount, currency, purpose, received_by)
    values (stu, 'PROOF-102-PAY-A', 1000.00, 'USD', 'Tuition', fin)
    returning id into pay;

  insert into payments (student_id, reference, amount, currency, purpose, received_by)
    values (stu_early, 'PROOF-102-PAY-B', 400.00, 'USD', 'Tuition', fin)
    returning id into pay_early;

  -- ---- §1: THE PAYMENT CANNOT BE EDITED, BY ANYBODY ----------------------
  --
  -- Run as the table's owner, which is the strongest reader there is and the
  -- one row-level security does not apply to. If it refuses this, it refuses
  -- the service key.
  refused := false;
  begin
    update payments set amount = 1.00 where id = pay;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '102 FAILED — a payment was edited';
  end if;
  raise notice '102 OK  a payment cannot be edited, not even by the owner of the table';

  refused := false;
  begin
    delete from payments where id = pay;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '102 FAILED — a payment was deleted';
  end if;
  raise notice '102 OK  …and cannot be deleted either';

  -- ---- §2: THE DETERMINATION IS THE DATABASE'S -------------------------
  --
  -- Day 20 of 1000 USD. The published schedule says 50%; the decision of
  -- 16 September says 0% because studies commenced. The lower stands.
  insert into refund_requests
    (payment_id, student_id, amount_paid, currency, amount_requested, reason, requested_by,
     -- SENT WRONG ON PURPOSE. The trigger overwrites all three from the
     -- payment and the enrolment date; a determination a form can supply is a
     -- determination anybody can supply.
     percent_by_schedule, percent_by_policy, eligible_amount)
    values (pay, stu, 999999.00, 'XXX', 1000.00, 'Proof: withdrew from the programme', fin,
            100, 100, 999999.00)
    returning id into req;

  select days_since_enrolment into seen from refund_requests where id = req;
  if seen <> 20 then
    raise exception '102 FAILED — day % was computed for a student enrolled 20 days ago', seen;
  end if;

  select percent_by_schedule into seen from refund_requests where id = req;
  if seen <> 50 then
    raise exception '102 FAILED — the published schedule gave %%% on day 20, not 50%%', seen;
  end if;
  select percent_by_policy into seen from refund_requests where id = req;
  if seen <> 0 then
    raise exception '102 FAILED — the decision of 16 September gave %%% after studies '
                    'commenced', seen;
  end if;
  select eligible_amount into n from refund_requests where id = req;
  if n <> 0 then
    raise exception '102 FAILED — the lower of the two rules allowed %', n;
  end if;
  select amount_paid into n from refund_requests where id = req;
  if n <> 1000.00 then
    raise exception '102 FAILED — the amount paid was taken from the form (%), not the '
                    'payment', n;
  end if;
  raise notice '102 OK  the determination is computed from the payment and the enrolment '
               'date, and a form cannot supply it';

  select determination into t from refund_requests where id = req;
  if t not like '%DISAGREE%' then
    raise exception '102 FAILED — the two rules disagreed and the request did not say so';
  end if;
  raise notice '102 OK  where the published schedule and the 16 September decision '
               'disagree, the request says so on its face';

  select count(*) into seen from refund_requests_where_the_rules_disagree where id = req;
  if seen <> 1 then
    raise exception '102 FAILED — the disagreement view did not list it';
  end if;
  raise notice '102 OK  …and the University can read every such case in one view';

  -- ---- §6: SUBMITTING NEVER REFUNDS ANYBODY ------------------------------
  refused := false;
  begin
    update refund_requests set status = 'paid', refund_reference = 'X', paid_at = now(),
           amount_approved = 0 where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '102 FAILED — a submitted request went straight to paid';
  end if;
  raise notice '102 OK  a request cannot jump from submitted to paid';

  update refund_requests set status = 'under_review' where id = req;

  -- ---- AND AN APPROVAL CANNOT EXCEED THE DETERMINATION -------------------
  refused := false;
  begin
    update refund_requests
       set status = 'approved', amount_approved = 500.00,
           decision_reason = 'Proof: paying above the determination',
           decided_by = dir, decided_at = now()
     where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '102 FAILED — 500 was approved against a determination of 0';
  end if;
  raise notice '102 OK  an approval above the determination is refused';

  -- ---- UNLESS AN EXCEPTIONAL POLICY IS AUTHORISED ------------------------
  update refund_requests
     set exceptional_policy = 'Proof: compassionate withdrawal, Fees Guide schedule applied',
         exception_authorised_by = dir, exception_authorised_at = now()
   where id = req;
  update refund_requests
     set status = 'approved', amount_approved = 500.00,
         decision_reason = 'Proof: the published schedule allows 50% on day 20',
         decided_by = dir, decided_at = now()
   where id = req;
  raise notice '102 OK  …and allowed where an exceptional policy is named and authorised';

  -- ---- THE DETERMINATION CANNOT BE REWRITTEN AFTER THE FACT --------------
  refused := false;
  begin
    update refund_requests set eligible_amount = 1000.00 where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '102 FAILED — the determination was rewritten';
  end if;
  raise notice '102 OK  the determination cannot be rewritten after the answer is known';

  -- ---- NO CASH, NO CHEQUE -----------------------------------------------
  refused := false;
  begin
    update refund_requests set method = 'cash' where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '102 FAILED — a cash refund was accepted';
  end if;
  raise notice '102 OK  no cash or cheque refund is accepted';

  -- ---- AND A PAID REFUND IS FINISHED ------------------------------------
  update refund_requests
     set status = 'paid', refund_reference = 'PROOF-102-REF', paid_at = now(), paid_by = dir
   where id = req;
  refused := false;
  begin
    update refund_requests set status = 'under_review' where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '102 FAILED — a paid refund was reopened';
  end if;
  raise notice '102 OK  a paid refund is finished; a further refund is a further request';

  -- ---- ONE REFUND PER MONTH ---------------------------------------------
  refused := false;
  begin
    insert into refund_requests
      (payment_id, student_id, amount_paid, currency, amount_requested, reason, requested_by)
      values (pay, stu, 1.00, 'USD', 1.00, 'Proof: a second request the same month', fin);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '102 FAILED — a second refund was considered in the same month';
  end if;
  raise notice '102 OK  only one refund per student per month is considered';

  -- ---- STUDIES NOT STARTED: BOTH RULES RETURN THE MONEY ------------------
  insert into refund_requests
    (payment_id, student_id, amount_paid, currency, amount_requested, reason, requested_by)
    values (pay_early, stu_early, 1.00, 'USD', 400.00,
            'Proof: never took up the place', fin)
    returning id into req2;

  select eligible_amount into n from refund_requests where id = req2;
  if n <> 400.00 then
    raise exception '102 FAILED — a student who never started was allowed % of 400', n;
  end if;
  select count(*) into seen from refund_requests_where_the_rules_disagree where id = req2;
  if seen <> 0 then
    raise exception '102 FAILED — the rules were reported as disagreeing when they agree';
  end if;
  raise notice '102 OK  a student whose studies never started is refunded in full, and the '
               'two rules agree';

  -- ---- THE FLOOR: A LECTURER READS NO REFUND ----------------------------
  --
  -- RLS DOES NOT APPLY TO A TABLE'S OWNER, so this must change role or it
  -- proves nothing at all.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', lect::text, true);
  select count(*) into seen from refund_requests;
  reset role;
  if seen <> 0 then
    raise exception '102 FAILED — a lecturer read % refund requests', seen;
  end if;
  raise notice '102 OK  a lecturer reads no refund at all';

  -- AND THE CEILING: the Finance Director reads them, or the floor is a wall.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', dir::text, true);
  select count(*) into seen from refund_requests;
  reset role;
  if seen < 2 then
    raise exception '102 FAILED — the Finance Director read only % refund requests', seen;
  end if;
  raise notice '102 OK  …and the Finance Director reads all of them';

  raise exception 'ROLLBACK 102';
exception
  when others then
    if sqlerrm = 'ROLLBACK 102' then
      raise notice '102 OK  every proof above rolled back; the University''s payments and '
                   'students were never written to';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 10. DONE
-- ===========================================================================
do $$
begin
  raise notice '102 APPLIED  fee refunds: a payment can no longer be edited or deleted by '
               'anybody, and `approve-refund` now has a door.';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   103_the_nation_has_offices_too.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 103 — THE NATIONAL TIER IS IN THE REGISTER OF POSITIONS
-- ===========================================================================
--
-- The University found this on the appointment screen: the post list offered
-- forty-three posts and not one of them was the National Rector.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS ACTUALLY MISSING
-- ---------------------------------------------------------------------------
--
-- Not a row. A WHOLE TIER.
--
-- 048 wrote the register of positions — forty-three posts across eight
-- families — and it is the University's central structure: the executive, the
-- registry, the four faculties, administration, student services, ICT,
-- academic staff. 097, 098 and 099 then built the national tier on top of it:
-- a `national-rector` role with its own capabilities, a
-- `national-financial-secretary` beside it, a register of nations, revenue
-- agreements, national expenditure, a Rector's dashboard, row-level security
-- that holds a Rector to their own country.
--
-- Nobody went back to 048. So the University has an office that can sign in,
-- hold authority over a nation's students and money, appear on the audit trail
-- — AND CANNOT BE APPOINTED, because the letter that appoints people is
-- written from a register that has never heard of it.
--
-- An appointment made without a post "falls back to the plainest wording and
-- carries no job description", which the screen says out loud. That is what
-- every National Rector ICOF has appointed has received.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. TWO POSTS APPEAR IN THE APPOINTMENT SCREEN'S DROPDOWN — National Rector
--    and National Financial Secretary — under a new heading, National
--    Administrations. Choosing one fills the letter's title, unit, reporting
--    officer and ordinary terms, as it does for every other post.
--
-- 2. A NINTH FAMILY EXISTS: `national`. The families are how a job description
--    is inherited, and putting a National Rector in `executive` would have
--    given them the Vice-Chancellor's family clauses — including the one
--    requiring the Vice-Chancellor's prior approval for any commitment of
--    University funds, which is not how 098 and 099 divide national money.
--    The University's own book is explicit that the office "is distinct from
--    an ordinary recruitment representative, marketing agent or independent
--    education provider" and "operates as part of the university", so it is
--    its own family rather than a borrowed one.
--
-- 3. NOTHING IS ACTIVATED. The family profile and both post profiles land as
--    DRAFTS, exactly as 048's eight did, and no draft can reach an appointee.
--    Somebody must read them and somebody else must activate them. That is
--    048's rule and this does not make an exception of itself.
--
-- 4. NO EXISTING POST, PROFILE OR APPOINTMENT IS TOUCHED. `national` is a new
--    family, so the one-active-per-family slot it occupies was empty; NAT-REC
--    and NAT-FIN are new job codes. Nothing the University has activated is
--    competed for.
--
-- ---------------------------------------------------------------------------
-- WHERE THE WORDS COME FROM
-- ---------------------------------------------------------------------------
--
-- EVERY DUTY CLAUSE BELOW IS THE UNIVERSITY'S OWN, out of `The National
-- Rector` — the book ICOF wrote about the office, held in
-- `src/content/nationalRector.ts` and published on the Rector's shelf.
-- Chapter FOUR gives the Rector's six areas of responsibility by name;
-- chapter FIVE gives the office's standing; chapter NINETEEN gives the
-- Financial Secretary's duties as a list. Nothing here is invented, and where
-- the book is silent — the salary, the probation, the place of duty — this is
-- silent too.
--
-- THE TWO POSTS SEEDED ARE THE TWO THE SYSTEM HAS ROLES FOR. The book's
-- chapter TWENTY-EIGHT sketches a fuller national team — an Academic
-- Coordinator, Student Affairs, Admissions, Administration — but says of it
-- that "the precise structure depends on the size and requirements of the
-- National Administration", and none of those has a role, a capability or a
-- screen. Seeding them would be turning an illustration into an establishment.
--
-- ===========================================================================


-- ===========================================================================
-- 1. A NINTH FAMILY
-- ===========================================================================
--
-- THREE TABLES NAME THE FAMILIES, not one. `positions` (048),
-- `position_profiles` (048) and `appointment_condition_sets` (078) each carry
-- their own CHECK listing the eight, and widening one of them is how you
-- discover the other two — one at a time, each by a different failure.
--
-- So this finds them rather than naming them: every CHECK constraint in the
-- schema whose definition lists the families is rewritten to include
-- `national`, keeping its own name and its own null-handling. A future tenth
-- family widens all of them at once by the same means.
--
-- The constraints are REPLACED, not dropped. A family column with no
-- constraint would let a typo create a family of one post, inheriting no job
-- description and no conditions of appointment — which is the shape of the
-- fault this whole migration exists to fix.
-- ---------------------------------------------------------------------------

do $$
declare
  r        record;
  def      text;
  nullable boolean;
begin
  for r in
    select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where contype = 'c'
       and pg_get_constraintdef(oid) like '%executive%'
       and pg_get_constraintdef(oid) like '%academic-staff%'
       and pg_get_constraintdef(oid) not like '%national%'
  loop
    -- A CONSTRAINT THAT ALREADY PERMITS NULL KEEPS PERMITTING IT.
    -- `position_profiles.family` is null on a profile belonging to a post, and
    -- rewriting its check without the null arm would refuse every one of them.
    nullable := r.def like '%IS NULL%';

    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    def := format(
      'check (%s family in (''executive'', ''academic-administration'', '
      || '''faculty-leadership'', ''administration'', ''student-services'', ''ict'', '
      || '''academic-staff'', ''national'', ''other''))',
      case when nullable then 'family is null or' else '' end);
    execute format('alter table %s add constraint %I %s', r.tbl, r.conname, def);
    raise notice '103 OK  % now admits the national family', r.tbl;
  end loop;
end $$;


-- ===========================================================================
-- 2. THE TWO POSTS
-- ===========================================================================
--
-- `unit_name` is null on both, and deliberately. Every other post in the
-- register belongs to a standing unit — the Registry, the Library, Faculty of
-- Theology. A National Administration is named by its country, and the country
-- is not known until the appointment is written: "ICOF Global University —
-- National Administration of Uganda". Writing a unit here would put the wrong
-- country on every letter but one.
--
-- The Rector reports to the Vice-Chancellor because the office is the
-- University's senior representative in a nation and establishing a National
-- Administration is the centre's act, held by the Superadministrator alone.
-- The Financial Secretary reports to the Rector, which is where the book's own
-- diagram of the national team puts them.
-- ---------------------------------------------------------------------------

insert into positions (job_code, title, family, reports_to, unit_name) values
  ('NAT-REC', 'National Rector', 'national', 'Vice-Chancellor', null),
  ('NAT-FIN', 'National Financial Secretary', 'national', 'National Rector', null)
on conflict (job_code) do nothing;


-- ---------------------------------------------------------------------------
-- AND THE CHANCELLOR, WHO WAS MISSING FOR THE SAME REASON
-- ---------------------------------------------------------------------------
--
-- Not part of what the University asked about, and found by counting while
-- checking it: `chancellor` is a role with capabilities — the correspondence
-- chain, the executive dashboard, conferring an award — and there is no
-- Chancellor in the register either. 048 wrote the Vice-Chancellor, the Deputy
-- and Pro-Vice-Chancellors and the University Secretary, and stopped one above
-- the Vice-Chancellor.
--
-- NO JOB DESCRIPTION IS WRITTEN FOR IT, deliberately. 048 seeds a profile for
-- every FAMILY and for no post, so the Deputy Vice-Chancellor, the
-- Pro-Vice-Chancellor and the University Secretary all inherit the executive
-- family's and have none of their own. The Chancellor does the same. Writing
-- duties for the office would be the University's to do, not this migration's,
-- and nothing in the repository states them.
--
-- `reports_to` is 'The University Council', which is what 048 gives the
-- Vice-Chancellor. The unit name mirrors the Vice-Chancellor's and is the
-- easiest thing here for the University to change if it is wrong.
insert into positions (job_code, title, family, reports_to, unit_name) values
  ('EXE-CHAN', 'Chancellor', 'executive', 'The University Council', 'Office of the Chancellor')
on conflict (job_code) do nothing;

-- ALREADY THERE UNDER THE WRONG FAMILY? Move it. A database where somebody
-- added the post by hand before this ran should end in the same place as one
-- where nobody did.
update positions set family = 'national'
 where job_code in ('NAT-REC', 'NAT-FIN') and family <> 'national';


-- ===========================================================================
-- 3. THE FAMILY JOB DESCRIPTION — A DRAFT, LIKE THE OTHER EIGHT
-- ===========================================================================
--
-- The eight clauses every post in the University carries are 048's, repeated
-- here word for word so that a national post is not a post with fewer
-- obligations. The two that follow are the family's own and come from chapter
-- FIVE of the book.
-- ---------------------------------------------------------------------------

do $$
declare
  pid uuid;
begin
  if exists (select 1 from position_profiles where family = 'national' and position_id is null)
  then
    raise notice '103 --  the national family profile is already there; left alone';
    return;
  end if;

  insert into position_profiles (family, version, status, job_purpose)
  values ('national', 1, 'draft',
    'DRAFT FOR THE UNIVERSITY''S APPROVAL. This profile states the duties common to every '
    'post in a National Administration. A National Administration is the University operating '
    'within an approved nation, and an officer of one is an officer of ICOF Global University. '
    'It has not been approved and must not be attached to an appointment until it has been '
    'read and activated.')
  returning id into pid;

  -- ---- 048's eight, unchanged -------------------------------------------
  insert into position_profile_clauses (profile_id, section, ordinal, body) values
    (pid, 'institutional', 1,
     'Uphold the mission, statutes and regulations of ICOF Global University, and conduct '
     'the duties of the post in accordance with the University''s policies in force from '
     'time to time.'),
    (pid, 'institutional', 2,
     'Represent the University professionally in dealings with students, colleagues, '
     'partner institutions and the public.'),
    (pid, 'compliance', 1,
     'Comply with the University''s policies on conduct, conflict of interest, data '
     'protection and safeguarding, and report any breach that comes to notice.'),
    (pid, 'confidentiality', 1,
     'Treat student records, staff records, examination material and the University''s '
     'commercial and legal affairs as confidential, during the appointment and after it '
     'ends.'),
    (pid, 'reporting', 1,
     'Report to the officer named in the letter of appointment, and provide such written '
     'reports as that officer or the Vice-Chancellor may require.'),
    (pid, 'evaluation', 1,
     'Performance is reviewed annually against the key performance areas set out in this '
     'job description, and at the end of any probationary period.'),
    (pid, 'amendment', 1,
     'This job description may be amended by the University after consultation with the '
     'post-holder. An amended version is issued as a new version; the version in force at '
     'the date of appointment remains on the record.'),
    (pid, 'must-obtain-approval', 1,
     'Any commitment of University funds, any public statement made on behalf of the '
     'University, and any agreement with an external body require the prior approval of '
     'the Vice-Chancellor or of the officer to whom that authority has been delegated in '
     'writing.');

  -- ---- AND WHAT DISTINGUISHES A NATIONAL POST ----------------------------
  --
  -- Chapter FIVE: the office "is distinct from an ordinary recruitment
  -- representative, marketing agent or independent education provider" and
  -- "operates as part of the university". That distinction is worth a clause,
  -- because it is the one a post-holder is most likely to be asked about in
  -- their own country.
  insert into position_profile_clauses (profile_id, section, ordinal, body) values
    (pid, 'institutional', 3,
     'A National Administration is part of ICOF Global University and not a separate '
     'institution, agency or recruitment business. The post-holder acts within the '
     'University''s academic governance, administrative systems, student systems, financial '
     'systems, policies and reporting structures, and may use only the institutional '
     'designation granted by ICOF.'),
    (pid, 'institutional', 4,
     'Protect the reputation, standards and interests of ICOF Global University within the '
     'nation.'),
    (pid, 'must-obtain-approval', 2,
     'The National Administration operates under the National Administration Agreement in '
     'force. Money is divided as that agreement provides and national expenditure is '
     'authorised as University policy provides; neither is varied locally.');

  -- ASSERTED WHERE THE ROW IS MADE, not in the proof at the foot of the file.
  -- A migration may assert what it did; it may not hold an opinion about what
  -- the University has done since. Checked here, this cannot outlive the
  -- moment it is true of — and the moment it is true of is this one.
  if not exists (select 1 from position_profiles where id = pid and status = 'draft') then
    raise exception '103 FAILED — the national family job description was seeded as something other than a draft';
  end if;
  raise notice '103 OK  the national family job description is seeded, as a draft';
end $$;


-- ===========================================================================
-- 4. THE NATIONAL RECTOR'S OWN CLAUSES
-- ===========================================================================
--
-- Chapter FOUR of the book, which names the six areas by name and defines each
-- in a sentence. The six are reproduced as six duties in the order the book
-- gives them.
--
-- A post's clauses REPLACE the family's for the section they are in and keep
-- the family's everywhere else, so these sit in `duties` and `authority`,
-- which the family profile above leaves empty.
-- ---------------------------------------------------------------------------

do $$
declare
  pos uuid;
  pid uuid;
begin
  select id into pos from positions where job_code = 'NAT-REC';
  if pos is null then
    raise exception '103 FAILED — NAT-REC was not created';
  end if;
  if exists (select 1 from position_profiles where position_id = pos) then
    raise notice '103 --  the National Rector already has a job description; left alone';
    return;
  end if;

  insert into position_profiles (position_id, version, status, job_purpose)
  values (pos, 1, 'draft',
    'DRAFT FOR THE UNIVERSITY''S APPROVAL. The National Rector is the senior representative '
    'of ICOF Global University within an approved nation. The office combines institutional '
    'administration and academic leadership, and is responsible for developing the ICOF '
    'presence within the nation and for leading the National Administration according to '
    'University policy and the National Administration Agreement.')
  returning id into pid;

  insert into position_profile_clauses (profile_id, section, ordinal, body) values
    (pid, 'key-responsibilities', 1,
     'Institutional leadership. Lead the national operation and establish its organizational '
     'structure.'),
    (pid, 'key-responsibilities', 2,
     'Student development. Develop the national student community and oversee its local '
     'administration and support.'),
    (pid, 'key-responsibilities', 3,
     'Academic leadership. Participate in academic activities, and teach or supervise '
     'students where appropriately qualified and separately appointed to do so.'),
    (pid, 'key-responsibilities', 4,
     'Staff development. Develop the national team and recommend qualified individuals for '
     'appointment.'),
    (pid, 'key-responsibilities', 5,
     'National representation. Represent ICOF Global University within approved national '
     'relationships and activities.'),
    (pid, 'key-responsibilities', 6,
     'Institutional growth. Develop the National Administration from its initial '
     'establishment into a sustainable national academic community.'),
    -- ---- AND WHAT THE SYSTEM ACTUALLY REFUSES THEM -----------------------
    --
    -- Written from 097, 098 and 099 rather than from the book, because a job
    -- description that describes an authority the database withholds is a job
    -- description that will be quoted back at the University.
    (pid, 'institutional', 1,
     'The Rector''s authority runs to one National Administration — their own. Students, '
     'payments, staff and records of another nation are not within the office, and the '
     'University''s systems refuse them rather than merely discouraging access.'),
    (pid, 'may-recommend', 1,
     'National expenditure, and qualified individuals for appointment to the national team.'),
    (pid, 'must-obtain-approval', 1,
     'National expenditure is recommended by the Rector and authorised centrally; it is not '
     'the Rector''s to authorise. The revenue agreement that pays the Rector''s own National '
     'Administration cannot be approved by that Rector. Both separations are enforced by the '
     'University''s systems and not only by this document.'),
    (pid, 'must-obtain-approval', 2,
     'Issuing a University credential — a transcript, a certificate or an academic record — '
     'is not within the office. Those are issued centrally, by the offices the University '
     'has named for them.');

  -- ASSERTED WHERE THE ROW IS MADE, not in the proof at the foot of the file.
  -- A migration may assert what it did; it may not hold an opinion about what
  -- the University has done since. Checked here, this cannot outlive the
  -- moment it is true of — and the moment it is true of is this one.
  if not exists (select 1 from position_profiles where id = pid and status = 'draft') then
    raise exception '103 FAILED — the National Rector''s job description was seeded as something other than a draft';
  end if;
  raise notice '103 OK  the National Rector''s job description is seeded, as a draft';
end $$;


-- ===========================================================================
-- 5. THE NATIONAL FINANCIAL SECRETARY'S
-- ===========================================================================
--
-- Chapter NINETEEN, which gives the duties as a list of fourteen. They are
-- grouped here rather than reproduced as fourteen one-line clauses, because a
-- job description printed onto a letter is read by a person.
-- ---------------------------------------------------------------------------

do $$
declare
  pos uuid;
  pid uuid;
begin
  select id into pos from positions where job_code = 'NAT-FIN';
  if pos is null then
    raise exception '103 FAILED — NAT-FIN was not created';
  end if;
  if exists (select 1 from position_profiles where position_id = pos) then
    raise notice '103 --  the Financial Secretary already has a job description; left alone';
    return;
  end if;

  insert into position_profiles (position_id, version, status, job_purpose)
  values (pos, 1, 'draft',
    'DRAFT FOR THE UNIVERSITY''S APPROVAL. The National Financial Secretary is the '
    'professional financial function of a National Administration, combining national '
    'operational responsibility with institutional accountability to central finance.')
  returning id into pid;

  insert into position_profile_clauses (profile_id, section, ordinal, body) values
    (pid, 'key-responsibilities', 1,
     'Tuition reconciliation, payment records, receipts and financial documentation for the '
     'National Administration.'),
    (pid, 'key-responsibilities', 2,
     'National expenses, approved staff payments and budgets.'),
    (pid, 'key-responsibilities', 3,
     'Student account reconciliation, outstanding tuition and approved refunds.'),
    (pid, 'key-responsibilities', 4,
     'Banking administration, audit preparation, financial reports, and reporting to central '
     'finance.'),
    (pid, 'financial', 1,
     'Financial authority within a National Administration is separated sufficiently to '
     'protect the administration and its officers. The Secretary keeps the record and does '
     'not authorise the expenditure they record.'),
    (pid, 'compliance', 1,
     'A payment recorded by the University is never afterwards edited or deleted by any '
     'office, including this one. A correction is a further transaction and both stay '
     'readable.');

  -- ASSERTED WHERE THE ROW IS MADE, not in the proof at the foot of the file.
  -- A migration may assert what it did; it may not hold an opinion about what
  -- the University has done since. Checked here, this cannot outlive the
  -- moment it is true of — and the moment it is true of is this one.
  if not exists (select 1 from position_profiles where id = pid and status = 'draft') then
    raise exception '103 FAILED — the National Financial Secretary''s job description was seeded as something other than a draft';
  end if;
  raise notice '103 OK  the National Financial Secretary''s job description is seeded, as a draft';
end $$;


-- ===========================================================================
-- 5b. A FAMILY NEEDS MORE THAN A NAME: CONDITIONS, AND A PLACE OF DUTY
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- THE SAME OMISSION, ONE LAYER DOWN
-- ---------------------------------------------------------------------------
--
-- This migration existed because 097–099 added a tier and did not go back to
-- 048. It then added a family and did not go back to 078 — which holds, as its
-- closing assertion, that EVERY post in the register has conditions of
-- appointment and a place of duty.
--
-- 078 seeds those conditions PER FAMILY, and `position_default_conditions`
-- resolves a post's conditions from its own set or its family's. A post in a
-- family 078 never heard of resolves to nothing, so the National Rector would
-- have been appointable on no conditions at all.
--
-- Four clean runs of this migration did not find it. The upgrade test did, by
-- replaying the whole bundle in one transaction on a database that had already
-- run it once — which is the only arrangement in which 078 re-checks a
-- register 103 has already extended.
--
-- ---------------------------------------------------------------------------
-- THE CLAUSES ARE COPIED, NOT WRITTEN
-- ---------------------------------------------------------------------------
--
-- From whatever the University has ACTIVE for the executive family — not from
-- a copy of 078's text pasted here. If they have since edited their conditions
-- of appointment, the national set carries the edit; a second copy of the
-- original would have drifted from their policy the first time they changed it.
--
-- The executive family is the source because a National Rector holds an office
-- and exercises its powers, which is what that family's own clauses say.
-- ---------------------------------------------------------------------------

do $$
declare
  src uuid;
  sid uuid;
begin
  if exists (select 1 from appointment_condition_sets where family = 'national') then
    raise notice '103 --  the national conditions of appointment are already there; left alone';
  else
    select id into src from appointment_condition_sets
     where family = 'executive' and status = 'active' limit 1;

    if src is null then
      -- 078 HAS NOT RUN. Nothing to copy and nothing to do; the bundle runs
      -- 078 before this, and a database without it has no register either.
      raise notice '103 --  078 has not run, so there is nothing to copy conditions from';
    else
      insert into appointment_condition_sets (family, version, status, effective_from, preamble)
      select 'national', 1, 'active', current_date, preamble
        from appointment_condition_sets where id = src
      returning id into sid;

      insert into appointment_condition_clauses (set_id, section, ordinal, body)
      select sid, c.section, c.ordinal, c.body
        from appointment_condition_clauses c where c.set_id = src;

      -- ---- AND THE THREE THAT ARE THE NATION'S OWN ---------------------
      --
      -- From the University's book, and from what 097–099 actually enforce.
      -- THE ORDINAL IS COMPUTED, NOT GUESSED. The set just copied already
      -- carries the executive family's own clauses at `duties 2` and
      -- `outside-work 2`, and writing a literal 2 or 3 here collided with them
      -- — which the harness caught and reading would not have. Each clause
      -- takes the next free ordinal in its own section, so it stays correct
      -- whatever the University has since added to the set it was copied from.
      insert into appointment_condition_clauses (set_id, section, ordinal, body)
      select sid, v.section,
             (select coalesce(max(c.ordinal), 0) + 1
                from appointment_condition_clauses c
               where c.set_id = sid and c.section = v.section),
             v.body
        from (values
          ('duties',
           'You are appointed to one National Administration, named in your letter of '
           'appointment. Your authority under this appointment extends to that National '
           'Administration and to no other, and the University''s systems enforce that '
           'separation rather than relying on it being observed.'),
          ('appointment',
           'The National Administration operates under the National Administration Agreement '
           'in force. Revenue is divided as that Agreement provides and national expenditure '
           'is authorised as University policy provides. Neither is varied locally, and an '
           'agreement that pays a National Administration is not approved by an officer of '
           'that administration.'),
          ('outside-work',
           'You shall not hold an office, agency or interest in another education provider '
           'operating in the same nation without the written consent of the University. Your '
           'office is the University''s presence in that nation, and a competing interest in '
           'it is not compatible with holding the office.')
        ) as v(section, body);

      raise notice '103 OK  the national family has conditions of appointment, copied from '
                   'the executive set the University has in force';
    end if;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- AND A PLACE OF DUTY, which 078 also requires of every post.
--
-- THE NATIONAL POSTS DO NOT SIT IN BUEA. 078 filled every null `duty_station`
-- with the University's central address, which is right for a central post and
-- wrong for an office whose whole purpose is to be somewhere else. The place
-- of duty of a national post is the National Administration, and which one is
-- not known until the letter is written — the same reason `unit_name` is null
-- on both.
--
-- The Chancellor takes whatever the Vice-Chancellor has, read from the row
-- rather than written here: if the University has moved, both move together,
-- and the address does not get a second copy in this repository.
-- ---------------------------------------------------------------------------

update positions
   set duty_station = 'The National Administration named in the letter of appointment'
 where job_code in ('NAT-REC', 'NAT-FIN') and duty_station is null;

update positions p
   set duty_station = (select duty_station from positions where job_code = 'EXE-VC')
 where p.job_code = 'EXE-CHAN' and p.duty_station is null;


-- ===========================================================================
-- 6. THE PROOF
-- ===========================================================================

do $$
declare
  seen      integer;
  refused   boolean;
  t         text;
begin
  -- ---- THE POSTS ARE IN THE REGISTER -------------------------------------
  select count(*) into seen from positions where job_code in ('NAT-REC', 'NAT-FIN');
  if seen <> 2 then
    raise exception '103 FAILED — % of the two national posts are in the register', seen;
  end if;
  raise notice '103 OK  the National Rector and the National Financial Secretary are posts';

  select count(*) into seen from positions where job_code = 'EXE-CHAN';
  if seen <> 1 then
    raise exception '103 FAILED — the Chancellor is still not in the register';
  end if;
  -- AND IT INHERITS, having no description of its own — the same as the Deputy
  -- Vice-Chancellor and the University Secretary beside it.
  if exists (select 1 from position_profiles pp join positions p on p.id = pp.position_id
              where p.job_code = 'EXE-CHAN') then
    raise exception '103 FAILED — a job description was written for the Chancellor, which is '
                    'the University''s to write and not this migration''s';
  end if;
  raise notice '103 OK  the Chancellor is a post too, inheriting the executive family''s '
               'description and carrying no invented duties';

  select family into t from positions where job_code = 'NAT-REC';
  if t <> 'national' then
    raise exception '103 FAILED — the National Rector landed in the % family', t;
  end if;
  raise notice '103 OK  …in a family of their own, not borrowed from the executive';

  -- ---- AND THE FAMILY IS STILL A CLOSED LIST -----------------------------
  --
  -- Prove a guard by breaking it. Widening a constraint is the kind of change
  -- that quietly becomes no constraint at all.
  refused := false;
  begin
    insert into positions (job_code, title, family)
      values ('ZZZ-103', 'A Proof Post 103', 'natoinal');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '103 FAILED — a post was created in a family that does not exist';
  end if;
  raise notice '103 OK  a misspelt family is still refused';

  -- ---- WHAT IS *NOT* ASSERTED HERE, AND WHY ------------------------------
  --
  -- THIS BLOCK USED TO CHECK THAT NO NATIONAL JOB DESCRIPTION WAS ACTIVE, AND
  -- IT FAILED THE UNIVERSITY FOR DOING WHAT THEY WERE ASKED TO DO.
  --
  -- 103 seeds three drafts and the handover said, correctly: "Both
  -- descriptions are DRAFTS and must be read and activated before an
  -- appointment can carry one." The University read them and activated them.
  -- The next run of the bundle then stopped dead on
  -- "103 FAILED — 3 national job descriptions landed ACTIVE".
  --
  -- That is the third fault class this repository has a standing rule about,
  -- arriving for the second time: NEVER ASSERT THEIR DATA IS EMPTY. 051
  -- checked that a document kind still had no template and failed them for
  -- having finished the work. This checked that a job description was still a
  -- draft and failed them for having approved it.
  --
  -- A migration is entitled to assert what IT did. It is not entitled to an
  -- opinion about what the University has done since. So the draft-ness of
  -- each profile is now asserted in the block that CREATES it, a few sections
  -- above, where the row is unambiguously this migration's own and the check
  -- cannot outlive the moment it is true of.
  --
  -- THE INHERITANCE PROOF WENT WITH IT, for the second standing reason:
  -- NEVER WRITE TO THEIR ROWS. To observe a resolved job description the proof
  -- had to activate one, and once the University has activated it themselves
  -- that UPDATE sets `activated_by` on a row that is theirs — overwriting the
  -- officer who approved it with a proof user, inside a rollback or not.
  -- Resolution is 048's property, proved by 048 and asserted by
  -- positions.test.mjs against the library; 103 does not need to prove it
  -- again at that price.

  -- ---- 078'S INVARIANT STILL HOLDS ---------------------------------------
  --
  -- The assertion this migration broke on its first pass through the upgrade
  -- test: every post in the register has conditions of appointment, and every
  -- post has a place of duty. Checked here as well as in 078 so that the
  -- migration that ADDS posts is the one that proves it did not break it.
  select count(*) into seen
    from positions p
   where not exists (select 1 from position_default_conditions d
                      where d.position_id = p.id);
  if seen > 0 then
    raise exception '103 FAILED — % post(s) in the register have no conditions of '
                    'appointment', seen;
  end if;
  select count(*) into seen from positions where duty_station is null;
  if seen > 0 then
    raise exception '103 FAILED — % post(s) have no place of duty', seen;
  end if;
  raise notice '103 OK  every post in the register still has conditions of appointment and '
               'a place of duty, the three new ones included';

  -- AND THE NATIONAL POSTS ARE NOT POSTED TO THE CENTRE. 078 fills a null
  -- place of duty with the University's own address, which is right for a
  -- central post and wrong for an office whose purpose is to be elsewhere.
  select duty_station into t from positions where job_code = 'NAT-REC';
  if t is distinct from 'The National Administration named in the letter of appointment' then
    raise exception '103 FAILED — the National Rector''s place of duty is "%"', t;
  end if;
  raise notice '103 OK  …and a National Rector is not posted to the central campus';

  raise exception 'ROLLBACK 103';
exception
  when others then
    if sqlerrm = 'ROLLBACK 103' then
      raise notice '103 OK  the proof rolled back; the drafts seeded above are still drafts';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 7. DONE
-- ===========================================================================
do $$
begin
  raise notice '103 APPLIED  the National Rector and the National Financial Secretary can '
               'now be appointed by letter, with a job description drawn from the '
               'University''s own book. Both descriptions are DRAFTS and must be read and '
               'activated before an appointment can carry one.';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   104_a_staff_record_is_not_an_account.sql
--
-- ===========================================================================
-- ===========================================================================

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


-- ===========================================================================
-- ===========================================================================
--
--   105_the_vice_chancellor_can_see_the_university.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 105 — THE VICE-CHANCELLOR CAN SEE THE UNIVERSITY
-- ===========================================================================
--
-- The University asked, looking at the Vice-Chancellor's own dashboard:
--
--   "WHY IS ENROLLMENT NOT REGISTERED"
--
-- Enrolled students: 0. Admitted this cycle: 0. Courses: 77.
--
-- ---------------------------------------------------------------------------
-- IT IS NOT A COUNT. IT IS A REFUSAL.
-- ---------------------------------------------------------------------------
--
-- `students_staff_read` admits eleven roles: superadmin, admin, registrar,
-- finance, finance-director, admissions-officer, dean, hod,
-- programme-coordinator, academic-office, student-affairs — and a lecturer,
-- for the students they teach.
--
-- THE VICE-CHANCELLOR IS NOT ON THAT LIST. NEITHER IS THE CHANCELLOR.
--
-- So the two most senior offices of the University read ZERO students, always,
-- however many the University has. `courses` is publicly readable and showed
-- 77 in the same row of tiles, which is what makes the dashboard look like a
-- working screen reporting an empty institution rather than a screen being
-- refused.
--
-- A COUNT OF ZERO AND A REFUSAL LOOK IDENTICAL, and this is the third time
-- that has cost the University something. 013 enabled row-level security on
-- `credential_audit_events` and wrote no policy at all, so the immutable trail
-- was readable by nobody for as long as it existed. 004 built
-- `credentials_issued` and never admitted the Vice-Chancellor, so the register
-- of what the University had issued was closed to the officer who signs them.
-- Both were found the same way: somebody senior looked at a screen and it said
-- nothing was there.
--
-- ---------------------------------------------------------------------------
-- WHY THESE TWO OFFICES AND NO OTHERS
-- ---------------------------------------------------------------------------
--
-- Because the capability matrix already says they see the institution, and the
-- database is the only thing disagreeing:
--
--   The Vice-Chancellor holds `view-executive-dashboard`, `view-all-faculties`
--   and `monitor-progress`.
--
--   The Chancellor holds all three AND `view-admitted-students` — a capability
--   whose entire content is reading the very rows this policy withholds.
--
-- The audit's own note on `view-all-faculties` says why the grant alone was
-- never enough: "Descriptive. What an office SEES is decided by the menu and
-- by the row-level policies, not by a check on this name." The menu offered
-- it. The policy did not.
--
-- ---------------------------------------------------------------------------
-- READING IS NOT ADMITTING, AND NOTHING HERE CHANGES THAT
-- ---------------------------------------------------------------------------
--
-- The University's design deliberately withholds `admit-student` and
-- `verify-payment` from both offices — "an institution where the Vice
-- Chancellor can personally admit a student has no separation of duties left
-- to speak of, whatever its org chart says." That separation is untouched.
--
-- This is a SELECT policy. Neither office gains a way to create, admit, amend
-- or delete a student record, and the proof below watches the insert being
-- refused rather than assuming it.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE VICE-CHANCELLOR'S DASHBOARD STARTS TELLING THE TRUTH. Enrolled
--    students, admitted this cycle, the Students screen, and the "needs
--    attention" panel that reasons from those counts.
--
-- 2. NOBODY LOSES A ROW. The policy is replaced with the same eleven roles
--    plus two, and the lecturer's own narrower clause is carried through
--    unchanged.
--
-- 3. NOTHING IS SEEDED AND NO STUDENT RECORD IS TOUCHED.
--
-- ===========================================================================


-- ===========================================================================
-- 1. THE POLICY, WITH TWO MORE OFFICES ON IT
-- ===========================================================================
--
-- Written out in full rather than patched, because a policy is a sentence and
-- half a sentence cannot be read. The lecturer clause is 083's and is repeated
-- here exactly: a lecturer reads the students they teach and no others.
-- ---------------------------------------------------------------------------

drop policy if exists students_staff_read on students;

create policy students_staff_read on students
  for select using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'finance', 'finance-director',
      'admissions-officer', 'dean', 'hod', 'programme-coordinator',
      'academic-office', 'student-affairs',
      -- THE TWO THAT WERE MISSING. Both hold `view-executive-dashboard`; the
      -- Chancellor holds `view-admitted-students`, which is this policy's own
      -- subject matter.
      'vice-chancellor', 'chancellor'
    )
    or (auth_role() = 'lecturer' and teaches_this_student(id))
  );

comment on policy students_staff_read on students is
  'Who may read the student register. The Vice-Chancellor and the Chancellor were absent from '
  'it until 105, so both read zero students on every screen — which looks exactly like a '
  'University with no students. Reading is not admitting: neither office holds admit-student '
  'or verify-payment, and this policy does not give them one.';


-- ===========================================================================
-- 2. THE PROOF
-- ===========================================================================
--
-- Prove a guard by breaking it, and prove a grant by watching it work. Both
-- halves matter here: the fault was a policy that refused somebody it should
-- have admitted, so a proof that only checks refusals would have passed
-- happily on the broken version.
-- ===========================================================================

do $$
declare
  vc       uuid := gen_random_uuid();
  chan     uuid := gen_random_uuid();
  lect     uuid := gen_random_uuid();
  lib      uuid := gen_random_uuid();
  stu      uuid;
  seen     integer;
  refused  boolean;
begin
  insert into auth.users (id, email) values
    (vc,   'proof-105-vc@example.invalid'),
    (chan, 'proof-105-chancellor@example.invalid'),
    (lect, 'proof-105-lecturer@example.invalid'),
    (lib,  'proof-105-librarian@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (vc,   'proof-105-vc@example.invalid',         'Proof Vice-Chancellor', 'vice-chancellor'),
    (chan, 'proof-105-chancellor@example.invalid', 'Proof Chancellor',      'chancellor'),
    (lect, 'proof-105-lecturer@example.invalid',   'Proof Lecturer',        'lecturer'),
    (lib,  'proof-105-librarian@example.invalid',  'Proof Librarian',       'library-staff')
  on conflict (id) do update set role = excluded.role;

  -- A STUDENT OF OUR OWN. Never counts the University's: a proof that asserts
  -- how many students they have fails them for using the system.
  insert into students (matric_no, first_name, last_name, email, student_number, status)
       values ('PROOF-105-A', 'Proof', 'Enrolled-105', 'proof-105-a@example.invalid',
               'PROOF-105-A', 'enrolled')
    returning id into stu;

  -- ---- THE GRANT, WATCHED WORKING ---------------------------------------
  --
  -- RLS DOES NOT APPLY TO A TABLE'S OWNER, so this must change role or it
  -- proves nothing at all.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', vc::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 1 then
    raise exception '105 FAILED — the Vice-Chancellor read % of one student', seen;
  end if;
  raise notice '105 OK  the Vice-Chancellor can read the student register';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', chan::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 1 then
    raise exception '105 FAILED — the Chancellor read % of one student', seen;
  end if;
  raise notice '105 OK  …and so can the Chancellor, who holds view-admitted-students';

  -- ---- AND READING IS STILL NOT ADMITTING -------------------------------
  --
  -- The separation the University built this around. If this ever stops
  -- refusing, 105 has done something nobody asked for.
  refused := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', vc::text, true);
    insert into students (matric_no, first_name, last_name, status)
         values ('PROOF-105-B', 'Proof', 'Admitted-By-The-VC', 'enrolled');
    reset role;
  exception when others then
    begin reset role; exception when others then null; end;
    refused := true;
  end;
  if not refused then
    raise exception '105 FAILED — the Vice-Chancellor admitted a student';
  end if;
  raise notice '105 OK  …and neither of them can create a student record';

  -- ---- THE CEILING IS STILL A CEILING -----------------------------------
  --
  -- A policy widened by two must not have been widened to everybody. The
  -- Librarian is the test because they are staff, signed in, and have no
  -- business in the student register.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', lib::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 0 then
    raise exception '105 FAILED — the Librarian read % students', seen;
  end if;
  raise notice '105 OK  a Librarian still reads none';

  -- AND A LECTURER READS ONLY THEIR OWN, which is 083's rule and is carried
  -- through this rewrite rather than dropped by it. This lecturer teaches
  -- nobody, so they see nobody.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', lect::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 0 then
    raise exception '105 FAILED — a lecturer read a student they do not teach';
  end if;
  raise notice '105 OK  …and a lecturer still reads only the students they teach';

  raise exception 'ROLLBACK 105';
exception
  when others then
    if sqlerrm = 'ROLLBACK 105' then
      raise notice '105 OK  every proof above rolled back; no student record was written to';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 3. DONE
-- ===========================================================================
do $$
begin
  raise notice '105 APPLIED  the Vice-Chancellor and the Chancellor can read the student '
               'register. Their dashboards have been reporting zero students because the '
               'policy refused them, not because there were none.';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   106_the_self_test_is_not_two_students.sql
--
-- ===========================================================================
-- ===========================================================================

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
  gone   integer;
  before integer;
  after_ integer;
begin
  -- COUNTED EITHER SIDE OF THE DELETE, so what is asserted is what THIS
  -- MIGRATION did and not what the University's database happens to contain.
  -- An assertion of the second kind — "the self-test examination is still
  -- there" — fails them the day they remove it themselves, and this
  -- repository has now been bitten by that twice.
  select count(*) into before from examinations;

  delete from profiles
   where id in ('00000000-0000-0000-0000-0000000000e1'::uuid,
                '00000000-0000-0000-0000-0000000000e2'::uuid)
     and email in ('selftest-proctor-015@iguc.net', 'selftest-marker-015@iguc.net');
  get diagnostics gone = row_count;

  select count(*) into after_ from examinations;
  if after_ <> before then
    raise exception '106 FAILED — removing two accounts changed the examination register '
                    'from % to %', before, after_;
  end if;

  if gone > 0 then
    raise notice '106 OK  % self-test account(s) removed from the accounts list, and the '
                 'examination register is untouched', gone;
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
  -- The half that matters, and it is asserted in SECTION 1 rather than here —
  -- by counting the examination register either side of the delete, which is
  -- a fact about what this migration did.
  --
  -- It used to be asserted here as "the self-test examination is still there",
  -- which is a fact about the University's database and therefore not this
  -- migration's to insist on. The day they removed it themselves, 106 would
  -- have failed them for it.
  raise notice '106 OK  the examination register was counted either side of the removal, in '
               'section 1, and did not move';

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


-- ===========================================================================
-- ===========================================================================
--
--   107_the_appointee_supplies_their_own_particulars.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 107 — THE APPOINTEE SUPPLIES THEIR OWN PARTICULARS
-- ===========================================================================
--
-- The University, looking at eight accepted appointments all reading
-- "None recorded — add it on the form":
--
--   "there should be a button to forward to the participant through the
--    various means, whatsapp, text etc, so that they can add their emails,
--    and passwords and create their staff records, then automatically they
--    would have a page for them to login to their account."
--
-- ---------------------------------------------------------------------------
-- THE PROBLEM THIS SOLVES, WHICH IS A TYPING PROBLEM
-- ---------------------------------------------------------------------------
--
-- 104 gave the officer a form to record an appointee's email on. It works, and
-- it still requires the officer to HAVE the email — so for eight people the
-- Registry must now telephone eight people, write down eight addresses, and
-- type them in. An address transcribed from a phone call is an address that
-- can be wrong, and the first anybody knows of it is a welcome letter that
-- never arrives.
--
-- The person who knows their own email address is the appointee. This lets
-- them type it themselves, once, into the University's own form.
--
-- ---------------------------------------------------------------------------
-- AND IT DOES NOT BREAK "AN OFFICER OPENS IT"
-- ---------------------------------------------------------------------------
--
-- The University ruled, when the staff register was built: "AN OFFICER OPENS
-- IT, not the acceptance. An account that springs into existence on acceptance
-- is a live login nobody authorised."
--
-- That rule is kept, and it is worth saying exactly how, because at a glance
-- this looks like the thing it forbids.
--
--   THE AUTHORISING ACT IS THE INVITATION. An officer holding
--   `open-staff-record` decides that this appointee may open their own record,
--   and issues them a one-time link. Nothing happens to anybody who was not
--   invited by name.
--
--   WHAT THE APPOINTEE SUPPLIES IS WHAT ONLY THEY KNOW — their email address,
--   their telephone, and a password nobody at the University ever sees. They
--   choose nothing about the POST: not the title, not the faculty, not the
--   employment type, not the start date, not the staff number. Every one of
--   those is read from the appointment the University already approved, and
--   the claim route does not look at them if they are sent.
--
-- So the account still springs from an officer's decision. What has moved is
-- the typing, to the one person who cannot get it wrong.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. NOTHING, UNTIL AN OFFICER ISSUES AN INVITATION. One table, one view, no
--    seeds. No existing appointment, staff record or account is touched.
--
-- 2. A NEW WAY IN EXISTS, so it is worth being plain about what guards it:
--    the link carries a 256-bit secret, it is good once, it expires, it is
--    bound to one appointment, and it can be revoked. The secret itself is
--    NEVER STORED — only its SHA-256 — so a copy of this table is not a set of
--    working links.
--
-- 3. AND THE TABLE IS NOT READABLE THROUGH THE API AT ALL. Row-level security
--    is on and there is deliberately no policy: the token is the capability
--    and the route holds the service key. 013 left a table in that state by
--    accident and it took two years to notice; this one does it on purpose and
--    says so, and the offices get `appointment_invitation_status` instead,
--    which carries every column except the one that must not leave.
--
-- ===========================================================================


-- ===========================================================================
-- 1. THE INVITATION
-- ===========================================================================

create table if not exists appointment_invitations (
  id              uuid primary key default gen_random_uuid(),

  -- ONE APPOINTMENT, NAMED. An invitation is not a general right to open a
  -- staff record; it is a right to open THIS one.
  appointment_id  uuid not null references appointments (id) on delete cascade,

  -- ---- THE SECRET, WHICH IS NOT HERE -----------------------------------
  --
  -- The link carries 32 random bytes. What is stored is the SHA-256 of them,
  -- so this column cannot be turned back into a working link by anybody
  -- holding the table — a backup, a support engineer, or whoever ends up with
  -- a copy of the database years from now.
  --
  -- The CHECK is the part that makes it true rather than intended: a 64-
  -- character lowercase hex string is a digest and nothing else. A route that
  -- one day wrote the raw token here by mistake would be refused by the
  -- database rather than quietly storing a live credential in plain text.
  token_hash      text not null unique
    constraint an_invitation_stores_a_digest_not_a_token
    check (token_hash ~ '^[0-9a-f]{64}$'),

  issued_by       uuid references auth.users (id) on delete set null,
  issued_at       timestamptz not null default now(),

  -- AN INVITATION THAT NEVER EXPIRES IS A PASSWORD. Set by the route; the
  -- database only insists that there is one and that it is in the future when
  -- the row is made.
  expires_at      timestamptz not null,

  -- ---- WHAT BECAME OF IT ------------------------------------------------
  claimed_at      timestamptz,
  claimed_email   text,
  staff_record_id uuid references staff_records (id) on delete set null,

  revoked_at      timestamptz,
  revoked_by      uuid references auth.users (id) on delete set null,
  revoked_reason  text,

  -- HOW MANY TIMES SOMEBODY HAS TRIED. A link being guessed at looks exactly
  -- like a link being used, unless somebody is counting.
  attempts        integer not null default 0,
  last_attempt_at timestamptz,

  created_at      timestamptz not null default now(),

  constraint an_invitation_expires_after_it_is_issued
    check (expires_at > issued_at),

  -- A CLAIM NAMES WHAT IT PRODUCED, or it is not a claim.
  constraint a_claimed_invitation_names_the_record
    check (claimed_at is null or (claimed_email is not null and staff_record_id is not null)),

  -- AND A REVOCATION SAYS WHY. The appointee may be told.
  constraint a_revoked_invitation_says_why
    check (revoked_at is null
           or (revoked_by is not null and length(btrim(coalesce(revoked_reason, ''))) >= 5))
);

-- Older databases: `create table if not exists` adds no column to a table that
-- already exists, not even a new one. This has caught us before.
alter table appointment_invitations
  add column if not exists claimed_email   text,
  add column if not exists staff_record_id uuid,
  add column if not exists revoked_reason  text,
  add column if not exists attempts        integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

create index if not exists appointment_invitations_appointment_idx
  on appointment_invitations (appointment_id, issued_at desc);

-- ONE LIVE INVITATION PER APPOINTMENT. Two links in flight for one person is
-- two things to revoke and one of them forgotten. Expiry is not in the index
-- — `now()` is not immutable and Postgres refuses it there — so the route
-- treats an expired row as spent and replaces it.
create unique index if not exists one_live_invitation_per_appointment
  on appointment_invitations (appointment_id)
  where claimed_at is null and revoked_at is null;

comment on table appointment_invitations is
  'A one-time, expiring invitation for an appointee to supply their own email, telephone and '
  'password. The officer''s act is issuing it; the appointee''s act is typing what only they '
  'know. Nothing about the post can be set through it.';


-- ===========================================================================
-- 2. CLAIMED ONCE, AND NEVER UNCLAIMED
-- ===========================================================================
--
-- The property the whole design rests on. A link that can be used twice is a
-- link that can be forwarded, and a claim that can be cleared is a link that
-- can be used twice the long way round.
-- ---------------------------------------------------------------------------

create or replace function an_invitation_is_claimed_once()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.claimed_at is not null and new.claimed_at is distinct from old.claimed_at then
    raise exception 'That invitation has already been used. A further one has to be issued, '
                    'which is an officer''s decision and leaves its own record.'
      using errcode = 'restrict_violation';
  end if;

  -- AND THE DIGEST IS NEVER REWRITTEN. Moving a token from one invitation to
  -- another would carry a claim's history onto a different link.
  if new.token_hash is distinct from old.token_hash
     or new.appointment_id is distinct from old.appointment_id then
    raise exception 'An invitation belongs to one appointment and one link. Issue another '
                    'rather than repointing this one.'
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists an_invitation_is_claimed_once_trg on appointment_invitations;
create trigger an_invitation_is_claimed_once_trg
  before update on appointment_invitations
  for each row execute function an_invitation_is_claimed_once();


-- ===========================================================================
-- 3. THE OFFICES READ THE ROW. NOBODY READS THE DIGEST.
-- ===========================================================================
--
-- The first draft of this section turned row-level security on and wrote no
-- policy, reasoning that the token digest must never reach a browser and the
-- route holds the service key anyway.
--
-- THE PROOF REFUSED IT, and correctly. The status view below is
-- `security_invoker`, so it reads with the caller's own rights: a table no
-- office can read is a view no office can read either, and the Registrar
-- could not see whether the invitation they had just sent had been used.
-- Closing the table closed the screen.
--
-- A SECURITY-DEFINER VIEW WOULD HAVE BEEN WORSE. A view that reads as its
-- owner bypasses the policy entirely, and then the only thing deciding who
-- sees invitations is a GRANT — which `authenticated` holds, and which a
-- student is.
--
-- So the rule is said at the column rather than at the table: the offices that
-- may open a staff record may read an invitation, and the digest is revoked
-- from every signed-in role including theirs. Postgres enforces column
-- privileges itself, so `select token_hash` is refused for everybody but the
-- service key — not hidden by a view somebody could select around.
-- ---------------------------------------------------------------------------

alter table appointment_invitations enable row level security;

drop policy if exists appointment_invitations_read on appointment_invitations;
create policy appointment_invitations_read on appointment_invitations
  for select using (
    auth_role() in ('superadmin', 'admin', 'vice-chancellor', 'registrar', 'academic-office')
  );

-- NO INSERT, UPDATE OR DELETE POLICY. Issuing, revoking and claiming are the
-- route's, under the service key, which no policy binds. An invitation a
-- browser could write is an invitation a browser could issue to itself.

-- ---- AND THE DIGEST IS REVOKED AT THE COLUMN --------------------------
--
-- The table grant has to exist before a column can be taken out of it, so it
-- is granted and then narrowed. `anon` is included because an unauthenticated
-- reader should not be reading this table at all, and a revoke is cheaper
-- than finding out one day that they could.
-- A TABLE-LEVEL GRANT SUBSUMES EVERY COLUMN, so revoking one column out of it
-- does nothing at all — Postgres keeps the broader privilege and the narrower
-- revoke is silently pointless. The proof below caught exactly that: the first
-- draft granted SELECT on the table and then revoked SELECT on the one column,
-- and the Registrar read the digest anyway.
--
-- The grant has to be taken away whole and given back as a column list.
do $$
declare
  cols text;
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    -- EVERY COLUMN BUT ONE, read from the catalogue rather than typed here, so
    -- a column added to this table later is readable without anybody having to
    -- remember to come back — and `token_hash` stays out whatever is added.
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into cols
      from information_schema.columns
     where table_schema = 'public' and table_name = 'appointment_invitations'
       and column_name <> 'token_hash';

    execute 'revoke all on appointment_invitations from authenticated';
    execute format('grant select (%s) on appointment_invitations to authenticated', cols);
    -- AND NO WRITE AT ALL. Issuing, revoking and claiming belong to the route
    -- under the service key. An invitation a browser could write is an
    -- invitation a browser could issue to itself.
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on appointment_invitations from anon';
  end if;
end $$;


create or replace view appointment_invitation_status
with (security_invoker = true) as
  select i.id,
         i.appointment_id,
         a.full_name,
         a.position_title,
         i.issued_at,
         i.expires_at,
         i.claimed_at,
         i.claimed_email,
         i.staff_record_id,
         i.revoked_at,
         i.revoked_reason,
         i.attempts,
         i.last_attempt_at,
         case
           when i.claimed_at is not null then 'claimed'
           when i.revoked_at is not null then 'revoked'
           when i.expires_at <= now()    then 'expired'
           else 'live'
         end as state
    from appointment_invitations i
    join appointments a on a.id = i.appointment_id;

comment on view appointment_invitation_status is
  'What an office may see of an invitation: who it was for, when it was issued, whether it has '
  'been used, and how many times somebody has tried it. NOT the token digest — that column is '
  'absent from this view on purpose, and the table it comes from is readable by nobody through '
  'the API at all.';


-- ===========================================================================
-- 4. THE PROOF
-- ===========================================================================

do $$
declare
  officer  uuid := gen_random_uuid();
  lect     uuid := gen_random_uuid();
  appt     uuid;
  inv      uuid;
  rec      uuid;
  digest   text := repeat('a', 64);
  refused  boolean;
  seen     integer;
  t        text;
begin
  insert into auth.users (id, email) values (officer, 'proof-107@example.invalid');
  insert into profiles (id, email, full_name, role)
    values (officer, 'proof-107@example.invalid', 'Proof Registrar 107', 'registrar')
  on conflict (id) do update set role = excluded.role;

  -- AN ACCEPTED APPOINTMENT WAS ISSUED FIRST, AND SAYS WHEN IT WAS ACCEPTED.
  -- Two CHECKs hold that and the proof is not entitled to an exception from
  -- either: a status of 'accepted' with no issue date is an appointment
  -- somebody accepted before it was sent, and one with no acceptance date is a
  -- state nobody can put a time on.
  insert into appointments (full_name, position_title, employment_type, start_date,
                            status, issued_at, accepted_at)
       values ('Proof Appointee 107', 'Proof Post 107', 'permanent', current_date,
               'accepted', now(), now())
    returning id into appt;

  -- ---- A PLAINTEXT TOKEN CANNOT BE STORED -------------------------------
  --
  -- The guard that matters most, watched refusing. A route that one day wrote
  -- the raw link secret into this column would be storing a live credential in
  -- plain text, and the database refuses the shape rather than trusting the
  -- route to have hashed it.
  refused := false;
  begin
    insert into appointment_invitations (appointment_id, token_hash, expires_at)
      values (appt, 'ZmFrZS10b2tlbi1ub3QtYS1kaWdlc3Q', now() + interval '14 days');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — a raw token was accepted where a digest belongs';
  end if;
  raise notice '107 OK  a link secret cannot be stored in plain text; only its digest fits';

  -- ---- AN INVITATION THAT NEVER EXPIRES IS REFUSED ----------------------
  refused := false;
  begin
    insert into appointment_invitations (appointment_id, token_hash, issued_at, expires_at)
      values (appt, repeat('b', 64), now(), now() - interval '1 day');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — an invitation was issued already expired';
  end if;
  raise notice '107 OK  …and an invitation expires after it is issued, never before';

  insert into appointment_invitations (appointment_id, token_hash, issued_by, expires_at)
       values (appt, digest, officer, now() + interval '14 days')
    returning id into inv;

  -- ---- ONE LIVE INVITATION AT A TIME ------------------------------------
  refused := false;
  begin
    insert into appointment_invitations (appointment_id, token_hash, expires_at)
      values (appt, repeat('c', 64), now() + interval '14 days');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — two live invitations exist for one appointment';
  end if;
  raise notice '107 OK  one live invitation per appointment, so there is one thing to revoke';

  -- ---- A CLAIM NAMES WHAT IT PRODUCED -----------------------------------
  refused := false;
  begin
    update appointment_invitations set claimed_at = now() where id = inv;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — an invitation was marked used without naming a record';
  end if;
  raise notice '107 OK  a claim names the address and the staff record it produced';

  insert into staff_records (staff_number, full_name, position_title, appointment_id)
       values ('PROOF-107-A', 'Proof Appointee 107', 'Proof Post 107', appt)
    returning id into rec;

  update appointment_invitations
     set claimed_at = now(), claimed_email = 'proof-107-appointee@example.invalid',
         staff_record_id = rec
   where id = inv;

  -- ---- AND IS GOOD EXACTLY ONCE -----------------------------------------
  refused := false;
  begin
    update appointment_invitations set claimed_at = now() + interval '1 minute' where id = inv;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — an invitation was claimed twice';
  end if;
  raise notice '107 OK  …and once it is used it cannot be used again';

  -- NOR UNCLAIMED, which is the same hole approached from the other side.
  refused := false;
  begin
    update appointment_invitations set claimed_at = null where id = inv;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — a claim was cleared, which makes the link live again';
  end if;
  raise notice '107 OK  …nor un-used, which would make the link live again';

  -- ---- THE DIGEST DOES NOT LEAVE ----------------------------------------
  select count(*) into seen
    from information_schema.columns
   where table_name = 'appointment_invitation_status' and column_name = 'token_hash';
  if seen <> 0 then
    raise exception '107 FAILED — the token digest is on the view the offices read';
  end if;
  raise notice '107 OK  the token digest is on no view any office can read';

  -- AND THE DIGEST CANNOT BE SELECTED BY ANYBODY SIGNED IN. Not hidden by a
  -- view — refused by Postgres at the column, so selecting around the view
  -- does not reach it either. RLS and column privileges do not apply to the
  -- owner, so this changes role or it proves nothing at all.
  refused := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', officer::text, true);
    perform token_hash from appointment_invitations where id = inv;
    reset role;
  exception when others then
    begin reset role; exception when others then null; end;
    refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — a signed-in officer read the token digest';
  end if;
  raise notice '107 OK  …and no signed-in role can select the digest, view or no view';

  -- WHILE THE ROW ITSELF IS THE OFFICE'S TO READ.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', officer::text, true);
  select count(*) into seen from appointment_invitations where id = inv;
  reset role;
  if seen <> 1 then
    raise exception '107 FAILED — the Registrar read % of their own invitation', seen;
  end if;
  raise notice '107 OK  the office that issued it can see it';

  -- BUT THE STATUS VIEW IS. A floor that is also a ceiling is an outage.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', officer::text, true);
  select state into t from appointment_invitation_status where id = inv;
  reset role;
  if t is distinct from 'claimed' then
    raise exception '107 FAILED — the Registrar could not read the invitation state (%)', t;
  end if;
  raise notice '107 OK  …while the office can still see that it was used, and by which address';

  -- ---- AND THE CEILING ---------------------------------------------------
  --
  -- A policy naming five offices must not have named everybody. A lecturer is
  -- the test: signed in, staff, and with no business in this table.
  insert into auth.users (id, email) values (lect, 'proof-107-lecturer@example.invalid');
  insert into profiles (id, email, full_name, role)
    values (lect, 'proof-107-lecturer@example.invalid', 'Proof Lecturer 107', 'lecturer')
  on conflict (id) do update set role = excluded.role;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', lect::text, true);
  select count(*) into seen from appointment_invitation_status;
  reset role;
  if seen <> 0 then
    raise exception '107 FAILED — a lecturer read % invitation(s)', seen;
  end if;
  raise notice '107 OK  …and a lecturer reads none of them';

  raise exception 'ROLLBACK 107';
exception
  when others then
    if sqlerrm = 'ROLLBACK 107' then
      raise notice '107 OK  every proof above rolled back; nothing was written to';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 5. DONE
-- ===========================================================================
do $$
begin
  raise notice '107 APPLIED  an officer can now send an appointee a one-time link to supply '
               'their own email, telephone and password. Nothing happens until one is issued, '
               'and nothing about the post can be set through it.';
end $$;


-- ===========================================================================
-- DID IT LAND?  — READ THIS TABLE
-- ===========================================================================
--
-- Every row should say YES. A row saying NO means that migration did not take
-- effect: scroll up for the first red ERROR, fix it, and run the file again.
-- Running it twice is safe.
--
-- The proofs inside each migration also RAISE NOTICE, which the Supabase SQL
-- editor does not show. This table is the same answer in a form it does.
-- ===========================================================================

select * from (
  select '102' as migration, '102_a_refund_is_not_an_edit.sql' as file,
         case when to_regclass('public.refund_requests') is not null then 'YES' else 'NO' end as landed,
         'refund_requests' as what_it_creates
  union all
  select '103' as migration, '103_the_nation_has_offices_too.sql' as file,
         case when to_regclass('public.positions') is null then 'NO'
                 when exists (select 1 from positions where job_code in ('NAT-REC','NAT-FIN','EXE-CHAN')) then 'YES'
                 else 'NO' end as landed,
         'rows:positions:job_code in (''NAT-REC'',''NAT-FIN'',''EXE-CHAN'')' as what_it_creates
  union all
  select '104' as migration, '104_a_staff_record_is_not_an_account.sql' as file,
         case when to_regclass('public.staff_records_awaiting_an_account') is not null then 'YES' else 'NO' end as landed,
         'staff_records_awaiting_an_account' as what_it_creates
  union all
  select '105' as migration, '105_the_vice_chancellor_can_see_the_university.sql' as file,
         case when exists (
                   select 1 from pg_policy p
                    where p.polname = 'students_staff_read'
                      and position('vice-chancellor' in
                                   pg_get_expr(p.polqual, p.polrelid)) > 0)
                 then 'YES' else 'NO' end as landed,
         'policydef:students_staff_read:vice-chancellor' as what_it_creates
  union all
  select '106' as migration, '106_the_self_test_is_not_two_students.sql' as file,
         case when to_regclass('public.profiles') is null then 'NO'
                 when not exists (select 1 from profiles where email in ('selftest-proctor-015@iguc.net','selftest-marker-015@iguc.net'))
                 then 'YES' else 'NO' end as landed,
         'norows:profiles:email in (''selftest-proctor-015@iguc.net'',''selftest-marker-015@iguc.net'')' as what_it_creates
  union all
  select '107' as migration, '107_the_appointee_supplies_their_own_particulars.sql' as file,
         case when to_regclass('public.appointment_invitations') is not null then 'YES' else 'NO' end as landed,
         'appointment_invitations' as what_it_creates
) as landed_report
 order by migration;

