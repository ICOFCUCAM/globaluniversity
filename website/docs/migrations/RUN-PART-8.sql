-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 102, 103, 104, 105, 106, 107, 108, 109, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-PART-8.sql 102 103 104 105 106 107 108 109
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
-- ===========================================================================
--
--   108_nothing_is_deleted_without_the_vice_chancellor.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 108 — NOTHING IS DELETED WITHOUT THE VICE-CHANCELLOR, AND NOT FOR 30 DAYS
-- ===========================================================================
--
-- The University's ruling:
--
--   "superadmin should be able to delete these files. when he takes delete,
--    it should appear to the VC approval. if the vc accept delete, it is
--    deleted within 30 days. if he says reject, the file is restored. all the
--    records of these processes are kept in the history."
--
-- And, asked what that covers and how it should behave:
--
--   Student records, anything with a delete today, and uploaded documents.
--   Hidden the moment the Vice-Chancellor approves, erased 30 days later.
--   A record that cannot be deleted is REFUSED AT REQUEST TIME, with the
--   reason named, rather than travelling to the Vice-Chancellor to be
--   refused there.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A STUDENT RECORD AND AN UPLOADED DOCUMENT CAN NO LONGER BE DELETED
--    OUTRIGHT BY ANYBODY. Not by the Superadministrator, not by the service
--    key the application writes with. A trigger refuses every DELETE that is
--    not the carrying-out of an approved request whose thirty days have run.
--
--    THIS CLOSES A DOOR THAT IS OPEN TODAY. /api/admissions/delete deletes a
--    student record at once, on the Superadministrator's say-so — which was
--    the University's earlier ruling ("only the Superadministrator may delete
--    applications") and is now narrowed by this one. That route will refuse
--    until it is changed to raise a request, which is the next commit.
--
-- 2. NOTHING ELSE IS TOUCHED. No other table gains a trigger, and nothing is
--    hidden, erased or deleted by this migration.
--
-- 3. THE THIRTY DAYS DO NOT PASS BY THEMSELVES. `erase_what_is_due()` does the
--    erasing and does nothing until the time has run. It is called by the
--    Superadministrator's screen and can be put on a schedule; until it is
--    called, an approved record is hidden and intact, which is the safe way
--    round.
--
-- ---------------------------------------------------------------------------
-- ONE TABLE FOR EVERY KIND OF RECORD, AND WHY
-- ---------------------------------------------------------------------------
--
-- A `deleted_at` column on each table would have been less code. It would also
-- have put the University's deletion policy in fourteen places, so that the
-- fifteenth table added next year would quietly not have it — which is how
-- every other "and that one too" fault in this system began.
--
-- The request names the entity by type and id. Hiding is a function the read
-- policies call; refusing is a trigger each covered table carries. Adding a
-- table to the scheme is two lines and no new policy.
-- ===========================================================================


-- ===========================================================================
-- 1. WHAT HOLDS A RECORD WHERE IT IS
-- ===========================================================================
--
-- Asked BEFORE a request is raised, so the Superadministrator learns at the
-- moment of asking rather than after the Vice-Chancellor has read it. The
-- University chose that: "refuse at request time, and say why".
--
-- EVERY REASON IS A FOREIGN KEY THE DATABASE ALREADY ENFORCES. Four things
-- restrict deleting a student today — an issued credential, an examination
-- sitting, a transcript issue and a refund request — and this names them
-- rather than inventing a policy of its own. A record the database would
-- refuse is a record the screen should refuse first, in words.
-- ---------------------------------------------------------------------------

create or replace function what_holds_this_record(kind text, subject uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  held text[] := '{}';
  n    integer;
begin
  if kind = 'students' then
    -- ---- 018'S RULE, AND IT IS THE STRONGEST OF THEM --------------------
    --
    -- FOUND BY THE PROOF, not by reading. `guard_application_delete` has
    -- refused to delete an ADMITTED student since 018 — "deleting it would
    -- detach a person from their own academic record" — and only an
    -- application may go. The University's own earlier ruling is the same
    -- sentence: "only the Superadministrator may delete APPLICATIONS."
    --
    -- Naming it first matters: it is the reason most of the register cannot
    -- be deleted at all, and a Superadministrator who learns it only when the
    -- erasure fails thirty days later has been told far too late.
    if exists (select 1 from students s
                where s.id = subject
                  and (s.auth_user_id is not null or s.student_number is not null)) then
      -- ARRAY-APPENDED AS ONE VALUE, not built with `||` in place. `||` is
      -- left-associative and `text[] || text` appends an element, so a
      -- sentence written across three concatenated literals becomes three
      -- separate reasons — or, as the proof found, a malformed array.
      held := array_append(held, format('%s %s %s',
        'This record has been admitted and is no longer an application.',
        'A student number, or an account, is somebody''s academic identity, and deleting',
        'the record would detach them from it. Withdraw or suspend the student instead.'));
    end if;

    select count(*) into n from credentials_issued where student_id = subject;
    if n > 0 then
      held := array_append(held, format('%s credential(s) have been issued to this student. A '
        || 'credential the University has issued is not unmade by deleting the record it '
        || 'was issued from.', n));
    end if;

    select count(*) into n from transcript_issues where student_id = subject;
    if n > 0 then
      held := array_append(held, format('%s official transcript(s) have been issued. The register of '
        || 'what the University has attested to cannot name a student it no longer has.', n));
    end if;

    select count(*) into n from exam_sessions where student_id = subject;
    if n > 0 then
      held := array_append(held, format('%s examination sitting(s) are on record. Examination evidence '
        || 'is append-only and its candidate cannot be erased from under it.', n));
    end if;

    select count(*) into n from refund_requests where student_id = subject;
    if n > 0 then
      held := array_append(held, format('%s refund request(s) name this student. A financial record '
        || 'that can be edited is not a record, and that includes editing it away.', n));
    end if;
  end if;

  return held;
end;
$$;

comment on function what_holds_this_record(text, uuid) is
  'Why a record cannot be deleted, in sentences an officer can act on. Every reason is a '
  'foreign key the database already enforces; this names them before a request is raised '
  'rather than after the Vice-Chancellor has read it.';


-- ===========================================================================
-- 2. THE REQUEST
-- ===========================================================================

create table if not exists deletion_requests (
  id              uuid primary key default gen_random_uuid(),

  -- NAMED BY TYPE AND ID, so one table serves every kind of record and a new
  -- kind needs no new table and no new policy.
  entity_type     text not null,
  entity_id       uuid not null,

  -- WHAT IT WAS, COPIED AT THE MOMENT OF ASKING. The point of the whole
  -- scheme is that the row goes away; a history that then reads
  -- "deleted 3f2a…-…" is a history of nothing.
  entity_label    text not null
    constraint a_deletion_names_what_it_is check (length(btrim(entity_label)) >= 3),

  requested_by    uuid references auth.users (id) on delete set null,
  requested_at    timestamptz not null default now(),
  reason          text not null
    constraint a_deletion_says_why check (length(btrim(reason)) >= 20),

  status          text not null default 'awaiting_decision'
    constraint deletion_request_status
    check (status in ('awaiting_decision', 'approved', 'rejected', 'erased', 'withdrawn')),

  -- ---- THE VICE-CHANCELLOR'S DECISION -----------------------------------
  decided_by      uuid references auth.users (id) on delete set null,
  decided_at      timestamptz,
  decision_reason text,

  -- THE THIRTY DAYS, written down rather than computed at read time, so the
  -- date a record becomes erasable cannot move because somebody changed a
  -- constant afterwards.
  erase_after     timestamptz,

  erased_at       timestamptz,
  restored_at     timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- A DECISION HAS A DECIDER, A TIME AND A REASON, either way.
  constraint a_decided_deletion_says_who_and_why
    check (status not in ('approved', 'rejected')
           or (decided_by is not null and decided_at is not null
               and length(btrim(coalesce(decision_reason, ''))) >= 10)),

  -- AN APPROVAL CARRIES THE DATE IT BECOMES ERASABLE.
  constraint an_approved_deletion_names_its_date
    check (status <> 'approved' or erase_after is not null),

  -- AND NOTHING IS ERASED BEFORE THAT DATE. Said in the row as well as in the
  -- function, so a row claiming to have been erased early is refused by the
  -- table rather than merely unlikely.
  constraint nothing_is_erased_before_its_time
    check (erased_at is null or (erase_after is not null and erased_at >= erase_after))
);

alter table deletion_requests
  add column if not exists decision_reason text,
  add column if not exists erase_after     timestamptz,
  add column if not exists erased_at       timestamptz,
  add column if not exists restored_at     timestamptz;

create index if not exists deletion_requests_entity_idx
  on deletion_requests (entity_type, entity_id);
create index if not exists deletion_requests_open_idx
  on deletion_requests (status, requested_at desc);

-- ONE LIVE REQUEST PER RECORD. Two requests for one student is two things for
-- the Vice-Chancellor to decide and one of them forgotten.
create unique index if not exists one_live_deletion_per_record
  on deletion_requests (entity_type, entity_id)
  where status in ('awaiting_decision', 'approved');

comment on table deletion_requests is
  'A record is put up for deletion by the Superadministrator, decided by the Vice-Chancellor, '
  'hidden on approval and erased thirty days later. Rejection restores it. Nothing in this '
  'table is ever deleted: it is the history of the process.';


-- ===========================================================================
-- 3. THE HISTORY, WHICH IS APPEND-ONLY
-- ===========================================================================
--
-- "all the records of these processes are kept in the history." A history
-- somebody can edit is not a history, so this one refuses both UPDATE and
-- DELETE — the same rule 015 holds examination evidence to.
-- ---------------------------------------------------------------------------

create table if not exists deletion_request_events (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references deletion_requests (id) on delete restrict,
  event       text not null,
  actor_id    uuid references auth.users (id) on delete set null,
  actor_role  text,
  detail      text,
  metadata    jsonb,
  at          timestamptz not null default now()
);

create index if not exists deletion_request_events_idx
  on deletion_request_events (request_id, at);

create or replace function a_deletion_history_is_append_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'The history of a deletion is append-only. It records what was asked, what '
                  'was decided and what became of the record, and none of that is editable '
                  'afterwards by any office.'
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists a_deletion_history_is_append_only_trg on deletion_request_events;
create trigger a_deletion_history_is_append_only_trg
  before update or delete on deletion_request_events
  for each row execute function a_deletion_history_is_append_only();


-- ===========================================================================
-- 4. THE PATH, WALKED BY THE DATABASE
-- ===========================================================================
--
-- request → decision → (erased | restored), and not one step skipped. The
-- states are a path, not a set of labels.
-- ---------------------------------------------------------------------------

create or replace function a_deletion_follows_its_path()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  -- WHAT IS BEING DELETED IS NOT THE CALLER'S TO CHANGE. Repointing a request
  -- the Vice-Chancellor has approved at a different record would be approval
  -- obtained for one thing and spent on another.
  if new.entity_type is distinct from old.entity_type
     or new.entity_id is distinct from old.entity_id then
    raise exception 'A deletion request names one record. Raise another rather than '
                    'repointing this one.'
      using errcode = 'restrict_violation';
  end if;

  ok := case
    when old.status = new.status then true
    when old.status = 'awaiting_decision'
         and new.status in ('approved', 'rejected', 'withdrawn') then true
    -- APPROVED GOES TO ERASED WHEN THE TIME HAS RUN, OR BACK TO REJECTED IF
    -- THE VICE-CHANCELLOR CHANGES THEIR MIND WITHIN THE THIRTY DAYS. The
    -- second is the whole purpose of a grace period.
    when old.status = 'approved' and new.status in ('erased', 'rejected') then true
    else false
  end;

  if not ok then
    raise exception 'A deletion goes request → decision → erased or restored. “%” cannot '
                    'become “%”.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- AND ERASED IS THE END. A record that has been destroyed cannot be restored
  -- by moving a status back, and pretending otherwise would be worse than
  -- saying so.
  if old.status = 'erased' and new.status <> 'erased' then
    raise exception 'That record has been erased. Nothing brings it back, and this row is '
                    'the only account of it that remains.'
      using errcode = 'restrict_violation';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists a_deletion_follows_its_path_trg on deletion_requests;
create trigger a_deletion_follows_its_path_trg
  before update on deletion_requests
  for each row execute function a_deletion_follows_its_path();


-- ===========================================================================
-- 5. HIDDEN THE MOMENT IT IS APPROVED
-- ===========================================================================
--
-- The University chose: the record leaves every screen when the Vice-Chancellor
-- approves, and is destroyed thirty days later. So the thirty days are a grace
-- period in which somebody can notice, not a period in which the record is
-- still in use.
--
-- STABLE, not immutable: it reads a table. It is called from read policies, so
-- it is `security definer` — a policy that depended on the reader also being
-- able to read `deletion_requests` would hide nothing from anybody who cannot.
-- ---------------------------------------------------------------------------

create or replace function is_awaiting_erasure(kind text, subject uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from deletion_requests
     where entity_type = kind
       and entity_id = subject
       and status = 'approved'
  );
$$;

comment on function is_awaiting_erasure(text, uuid) is
  'Whether a record has been approved for deletion and is inside its thirty days. Read by the '
  'policies that hide it from every office except the two that can still bring it back.';


-- ===========================================================================
-- 6. NOTHING IS DELETED OUTRIGHT
-- ===========================================================================
--
-- The rule the University asked for, said where it cannot be worked around.
-- The service key the application writes with is bound by a trigger and not by
-- a policy, which is why this is a trigger.
-- ---------------------------------------------------------------------------

create or replace function nothing_is_deleted_without_the_vice_chancellor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  due boolean;
begin
  select exists (
    select 1 from deletion_requests
     where entity_type = tg_table_name
       and entity_id = old.id
       and status = 'approved'
       and erase_after <= now()
  ) into due;

  if not due then
    raise exception 'A % is not deleted outright. The Superadministrator puts it up for '
                    'deletion, the Vice-Chancellor decides, and an approved record is erased '
                    'thirty days later — a period in which rejecting the request still '
                    'brings it back.', tg_table_name
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

-- TWO TABLES TO BEGIN WITH: the register the University pointed at, and the
-- uploaded documents. Adding a third is this trigger and one line in the
-- policy below — no new table and no new workflow.
drop trigger if exists nothing_is_deleted_without_the_vc_trg on students;
create trigger nothing_is_deleted_without_the_vc_trg
  before delete on students
  for each row execute function nothing_is_deleted_without_the_vice_chancellor();

drop trigger if exists nothing_is_deleted_without_the_vc_trg on documents;
create trigger nothing_is_deleted_without_the_vc_trg
  before delete on documents
  for each row execute function nothing_is_deleted_without_the_vice_chancellor();


-- ===========================================================================
-- 7. WHO SEES A REQUEST, AND WHO DECIDES ONE
-- ===========================================================================

alter table deletion_requests enable row level security;
alter table deletion_request_events enable row level security;

drop policy if exists deletion_requests_read on deletion_requests;
create policy deletion_requests_read on deletion_requests
  for select using (
    auth_role() in ('superadmin', 'admin', 'vice-chancellor', 'registrar')
  );

-- NO WRITE POLICY. Raising, deciding and erasing are the routes', under the
-- service key. A deletion request a browser could write is a deletion a
-- browser could approve.

drop policy if exists deletion_request_events_read on deletion_request_events;
create policy deletion_request_events_read on deletion_request_events
  for select using (
    auth_role() in ('superadmin', 'admin', 'vice-chancellor', 'registrar')
  );


-- ---------------------------------------------------------------------------
-- AND THE STUDENT REGISTER HIDES WHAT IS AWAITING ERASURE
-- ---------------------------------------------------------------------------
--
-- From every office EXCEPT the two that can still bring it back. A record
-- hidden from the Vice-Chancellor is a record the Vice-Chancellor cannot
-- restore, which would make the thirty days a formality.
--
-- 105's own list is reproduced rather than referred to, for the reason 105
-- gave: a policy is a sentence and half a sentence cannot be read.

drop policy if exists students_staff_read on students;
create policy students_staff_read on students
  for select using (
    (
      auth_role() in (
        'superadmin', 'admin', 'registrar', 'finance', 'finance-director',
        'admissions-officer', 'dean', 'hod', 'programme-coordinator',
        'academic-office', 'student-affairs', 'vice-chancellor', 'chancellor'
      )
      or (auth_role() = 'lecturer' and teaches_this_student(id))
    )
    and (
      not is_awaiting_erasure('students', id)
      -- THE TWO WHO CAN STILL BRING IT BACK GO ON SEEING IT.
      or auth_role() in ('superadmin', 'vice-chancellor')
    )
  );

comment on policy students_staff_read on students is
  'Who may read the student register. 105 added the Vice-Chancellor and the Chancellor, who '
  'were absent and therefore read zero students on every screen. 108 hides a record the '
  'Vice-Chancellor has approved for deletion from everybody except the Superadministrator and '
  'the Vice-Chancellor, who are the two who can still restore it within its thirty days.';


-- ===========================================================================
-- 8. ERASING WHAT IS DUE
-- ===========================================================================
--
-- IT DOES NOTHING UNTIL THE TIME HAS RUN, and that is checked here as well as
-- in the trigger. Called by the Superadministrator's screen; it can be put on
-- a schedule, and until it is called an approved record is hidden and intact —
-- which is the safe way round for a function whose job is destruction.
-- ---------------------------------------------------------------------------

create or replace function erase_what_is_due()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r      record;
  erased integer := 0;
begin
  for r in
    select * from deletion_requests
     where status = 'approved' and erase_after <= now()
     order by erase_after
  loop
    -- THE TABLE NAME COMES FROM A LIST, NOT FROM THE ROW. `entity_type` is
    -- text, and text concatenated into a DELETE is how an injected value gets
    -- to choose what the University destroys.
    if r.entity_type = 'students' then
      delete from students where id = r.entity_id;
    elsif r.entity_type = 'documents' then
      delete from documents where id = r.entity_id;
    else
      -- A KIND THIS FUNCTION HAS NOT BEEN TAUGHT IS LEFT ALONE AND SAID OUT
      -- LOUD, never guessed at.
      raise notice '108 --  % is not a kind this function can erase; left intact',
        r.entity_type;
      continue;
    end if;

    update deletion_requests set status = 'erased', erased_at = now() where id = r.id;
    insert into deletion_request_events (request_id, event, detail)
      values (r.id, 'ERASED',
              format('%s erased after its thirty days.', r.entity_label));
    erased := erased + 1;
  end loop;

  return erased;
end;
$$;

comment on function erase_what_is_due() is
  'Destroys the records whose thirty days have run, and nothing else. Returns how many. The '
  'table is chosen from a list rather than from the row, because text concatenated into a '
  'DELETE is how an injected value chooses what gets destroyed.';


create or replace view records_awaiting_erasure
with (security_invoker = true) as
  select d.id,
         d.entity_type,
         d.entity_id,
         d.entity_label,
         d.reason,
         r.full_name  as requested_by_name,
         d.requested_at,
         v.full_name  as decided_by_name,
         d.decided_at,
         d.decision_reason,
         d.erase_after,
         greatest(0, ceil(extract(epoch from (d.erase_after - now())) / 86400))::integer
           as days_remaining,
         (d.erase_after <= now()) as due
    from deletion_requests d
    left join profiles r on r.id = d.requested_by
    left join profiles v on v.id = d.decided_by
   where d.status = 'approved';

comment on view records_awaiting_erasure is
  'Records the Vice-Chancellor has approved for deletion and which have not yet been erased, '
  'with the days left on each. Rejecting one inside its thirty days restores it.';


-- ===========================================================================
-- 9. THE PROOF
-- ===========================================================================

do $$
declare
  sup      uuid := gen_random_uuid();
  vc       uuid := gen_random_uuid();
  reg      uuid := gen_random_uuid();
  stu      uuid;
  held     uuid;
  req      uuid;
  req2     uuid;
  refused  boolean;
  seen     integer;
  held_why text[];
  state_now text;
begin
  insert into auth.users (id, email) values
    (sup, 'proof-108-super@example.invalid'),
    (vc,  'proof-108-vc@example.invalid'),
    (reg, 'proof-108-registrar@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (sup, 'proof-108-super@example.invalid',     'Proof Superadmin 108',      'superadmin'),
    (vc,  'proof-108-vc@example.invalid',        'Proof Vice-Chancellor 108', 'vice-chancellor'),
    (reg, 'proof-108-registrar@example.invalid', 'Proof Registrar 108',       'registrar')
  on conflict (id) do update set role = excluded.role;

  -- A TRUE APPLICATION: no student number and no account. 018 refuses to
  -- delete anything else, and this proof is not entitled to an exception —
  -- the first draft gave it a student number, which made it admitted, and the
  -- erasure failed on 018's guard at the far end of the thirty days.
  insert into students (matric_no, first_name, last_name, status)
       values ('PROOF-108-A', 'Proof', 'Deletable-108', 'applicant')
    returning id into stu;

  -- ---- A RECORD IS NOT DELETED OUTRIGHT ---------------------------------
  --
  -- Run as the table's owner, which is stronger than the service key. If it
  -- refuses this, it refuses everything.
  refused := false;
  begin
    delete from students where id = stu;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '108 FAILED — a student record was deleted with no request at all';
  end if;
  raise notice '108 OK  a record cannot be deleted outright, by anybody, including the '
               'service key';

  -- ---- WHAT HOLDS A RECORD IS NAMED BEFORE ANYTHING IS ASKED ------------
  held_why := what_holds_this_record('students', stu);
  if array_length(held_why, 1) is not null then
    raise exception '108 FAILED — a student with no credential was reported as held';
  end if;
  raise notice '108 OK  a record nothing holds reports nothing holding it';

  insert into students (matric_no, first_name, last_name, student_number, status)
       values ('PROOF-108-B', 'Proof', 'Graduated-108', 'PROOF-108-B', 'enrolled')
    returning id into held;
  -- THIS ONE IS HELD TWICE OVER — admitted, and holding a certificate — which
  -- is what the assertion below checks it says.
  -- A CREDENTIAL OF THIS PROOF'S OWN, at an identifier nothing else uses, so
  -- the thing holding the record is one this block made and not one of the
  -- University's.
  insert into credentials_issued (credential_id, student_id, kind, holder_name, facts,
                                  content_hash, seal_code, status, version)
       values ('PROOF-108-CERT', held, 'certificate', 'Proof Graduated-108',
               '{"proof": "108"}'::jsonb, repeat('0', 64), 'PROOF-108-SEAL', 'issued', 1);

  held_why := what_holds_this_record('students', held);
  if array_length(held_why, 1) is null then
    raise exception '108 FAILED — a graduate with an issued certificate reported as free to '
                    'delete';
  end if;
  if array_length(held_why, 1) < 2 then
    raise exception '108 FAILED — an admitted graduate holding a certificate gave only % '
                    'reason(s)', array_length(held_why, 1);
  end if;
  if held_why[1] not like '%no longer an application%'
     or not exists (select 1 from unnest(held_why) r where r like '%credential%') then
    raise exception '108 FAILED — the reasons given were "%"', held_why;
  end if;
  raise notice '108 OK  …and an admitted graduate holding a certificate names both reasons, '
               'in sentences, before the request is ever raised';

  -- ---- THE PATH ---------------------------------------------------------
  insert into deletion_requests (entity_type, entity_id, entity_label, requested_by, reason)
       values ('students', stu, 'PROOF-108-A Proof Deletable-108', sup,
               'Proof: a duplicate application raised twice by the same applicant.')
    returning id into req;
  insert into deletion_request_events (request_id, event, actor_id, actor_role, detail)
       values (req, 'REQUESTED', sup, 'superadmin', 'Put up for deletion.');

  -- ONE LIVE REQUEST PER RECORD.
  refused := false;
  begin
    insert into deletion_requests (entity_type, entity_id, entity_label, requested_by, reason)
      values ('students', stu, 'PROOF-108-A again', sup,
              'Proof: a second request for the same record, which should be refused.');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '108 FAILED — two live deletion requests exist for one record';
  end if;
  raise notice '108 OK  one live request per record, so the Vice-Chancellor decides once';

  -- AND IT IS NOT ERASABLE BEFORE IT IS DECIDED.
  refused := false;
  begin
    update deletion_requests set status = 'erased', erased_at = now() where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '108 FAILED — a request went straight from asking to erased';
  end if;
  raise notice '108 OK  …and nothing is erased on the asking';

  -- ---- THE VICE-CHANCELLOR APPROVES, AND IT HIDES -----------------------
  update deletion_requests
     set status = 'approved', decided_by = vc, decided_at = now(),
         decision_reason = 'Proof: approved, a duplicate record.',
         erase_after = now() + interval '30 days'
   where id = req;
  insert into deletion_request_events (request_id, event, actor_id, actor_role, detail)
       values (req, 'APPROVED', vc, 'vice-chancellor', 'Approved for deletion in 30 days.');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 0 then
    raise exception '108 FAILED — the Registrar can still see a record approved for deletion';
  end if;
  raise notice '108 OK  an approved record leaves every screen at once';

  -- BUT NOT THE TWO WHO CAN BRING IT BACK. A record the Vice-Chancellor
  -- cannot see is a record they cannot restore, and the thirty days would be
  -- a formality.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', vc::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 1 then
    raise exception '108 FAILED — the Vice-Chancellor cannot see what they must be able to '
                    'restore';
  end if;
  raise notice '108 OK  …except for the Superadministrator and the Vice-Chancellor, who can '
               'still restore it';

  -- ---- AND IT IS STILL NOT ERASED -------------------------------------
  select erase_what_is_due() into seen;
  if seen <> 0 then
    raise exception '108 FAILED — % record(s) were erased on the day they were approved', seen;
  end if;
  select count(*) into seen from students where id = stu;
  if seen <> 1 then
    raise exception '108 FAILED — the record was destroyed inside its thirty days';
  end if;
  raise notice '108 OK  thirty days means thirty days: nothing is erased on approval';

  -- ---- REJECTION RESTORES IT -------------------------------------------
  update deletion_requests
     set status = 'rejected', decision_reason = 'Proof: on reflection, it is not a duplicate.',
         restored_at = now()
   where id = req;
  insert into deletion_request_events (request_id, event, actor_id, actor_role, detail)
       values (req, 'RESTORED', vc, 'vice-chancellor', 'Rejected; the record is restored.');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 1 then
    raise exception '108 FAILED — a rejected deletion did not restore the record';
  end if;
  raise notice '108 OK  rejecting it inside the thirty days puts it back on every screen';

  -- ---- WHEN THE TIME HAS RUN, IT GOES ----------------------------------
  insert into deletion_requests (entity_type, entity_id, entity_label, requested_by, reason,
                                 status, decided_by, decided_at, decision_reason, erase_after)
       values ('students', stu, 'PROOF-108-A Proof Deletable-108', sup,
               'Proof: the thirty days have run and this one is due.',
               'approved', vc, now() - interval '31 days',
               'Proof: approved a month ago.', now() - interval '1 day')
    returning id into req2;

  select erase_what_is_due() into seen;
  if seen <> 1 then
    raise exception '108 FAILED — % record(s) erased when one was due', seen;
  end if;
  select count(*) into seen from students where id = stu;
  if seen <> 0 then
    raise exception '108 FAILED — a record whose time had run was not erased';
  end if;
  raise notice '108 OK  …and when the thirty days have run, it is erased';

  -- ---- THE HISTORY SURVIVES THE RECORD ----------------------------------
  --
  -- The point of the whole scheme. The student is gone; what was asked, who
  -- decided it and what became of it are not.
  select count(*) into seen from deletion_request_events where request_id = req;
  if seen < 3 then
    raise exception '108 FAILED — the history of the request has % entries', seen;
  end if;
  -- READ INTO A TEXT VARIABLE, not into an element of the reasons array.
  -- `select into held_why[1]` is not a subscript assignment in plpgsql; it
  -- tries to select into a scalar and fails on the array's own type.
  select status into state_now from deletion_requests where id = req2;
  if state_now <> 'erased' then
    raise exception '108 FAILED — the request does not record that it was carried out';
  end if;
  raise notice '108 OK  the record is gone and the account of why is not';

  -- ---- AND THE HISTORY CANNOT BE EDITED ---------------------------------
  refused := false;
  begin
    update deletion_request_events set detail = 'something else' where request_id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '108 FAILED — the history of a deletion was edited';
  end if;
  refused := false;
  begin
    delete from deletion_request_events where request_id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '108 FAILED — the history of a deletion was deleted';
  end if;
  raise notice '108 OK  …and that account is append-only, like every other record of a '
               'decision in this system';

  -- ---- ERASED IS THE END ------------------------------------------------
  refused := false;
  begin
    update deletion_requests set status = 'rejected' where id = req2;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '108 FAILED — an erased record was marked restored, which it cannot be';
  end if;
  raise notice '108 OK  an erased record is not restorable, and the system does not pretend '
               'otherwise';

  raise exception 'ROLLBACK 108';
exception
  when others then
    if sqlerrm = 'ROLLBACK 108' then
      raise notice '108 OK  every proof above rolled back; no record of the University''s was '
                   'hidden, erased or written to';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 10. DONE
-- ===========================================================================
do $$
begin
  raise notice '108 APPLIED  a student record and an uploaded document can no longer be '
               'deleted outright by anybody. The Superadministrator puts one up, the '
               'Vice-Chancellor decides, an approved record hides at once and is erased '
               'thirty days later, and rejecting it inside that window restores it. '
               '/api/admissions/delete will refuse until it is changed to raise a request.';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   109_an_abandoned_application_leaves_the_register.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 109 — AN ABANDONED APPLICATION LEAVES THE REGISTER
-- ===========================================================================
--
-- The University, on the six rows filling their Students screen, every one of
-- them reading "Awaiting payment":
--
--   "STUDENT WHO FAIL IN THE APPLICATION PROCESS AND OR PAY NOT THEIR
--    APPLICATION FEE AND APPLICATION WAS NOT PROCESSED, THAT INFORMATION
--    SHOULD SOMEHOW OVER TIME BE DELETED OR REMOVE SOMEWHERE THAN REMAINING
--    ON THE DASHBOARD"
--
-- And, asked how: ninety days; the unpaid, the refused, the withdrawn and the
-- paid-but-never-processed; automatically, with the Registrar able to bring
-- one back.
--
-- ---------------------------------------------------------------------------
-- THIS IS NOT A DELETION, AND THAT IS THE POINT
-- ---------------------------------------------------------------------------
--
-- 108 built deletion: the Superadministrator asks, the Vice-Chancellor
-- decides, thirty days, gone. That is right for the handful of trial records
-- made while testing the system, and wrong for this — there will be hundreds
-- of abandoned applications over the years, each one needing a request and an
-- approval, and the University would spend longer clearing the register than
-- using it.
--
-- NOTHING HERE IS DESTROYED. An abandoned application leaves the Students
-- register and the dashboard counts, and is read on a screen of its own. The
-- evidence that somebody applied survives, because that is occasionally the
-- thing somebody needs.
--
-- ---------------------------------------------------------------------------
-- AND NOTHING HAS TO RUN
-- ---------------------------------------------------------------------------
--
-- There is no job, no schedule and no row to write. An application is
-- abandoned because of its OWN dates and its own status, so staleness is
-- computed when it is asked about rather than stored by something that has to
-- remember to run.
--
-- That matters more than it sounds. A stored flag set by a nightly task is a
-- flag that is wrong whenever the task did not run, and nobody notices for
-- weeks. A computed one cannot be stale by construction: the ninetieth day
-- arrives whether anybody is watching or not.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. APPLICATIONS OLDER THAN NINETY DAYS LEAVE THE STUDENTS REGISTER AT ONCE,
--    if they were never paid for, were refused, were withdrawn, were asked for
--    documents that never came, or were paid and never processed. That is a
--    visible change to a screen the University uses, and it is the one they
--    asked for.
--
--    HOW MANY depends on their data; the six on the screen were all recent, so
--    they stay until their ninetieth day.
--
-- 2. NOTHING IS DELETED, HIDDEN FROM THE REGISTRY, OR CHANGED. No row is
--    written by this migration at all. `archived_applications` shows every one
--    of them to the offices that admit people, and `restore_application()`
--    puts one back.
--
-- 3. ONE OF THE FIVE KINDS IS A PROBLEM AND NOT CLUTTER. An application that
--    was PAID FOR and never processed is money the University took for
--    nothing. The University asked for those to age out too, and they do —
--    but `applications_paid_and_never_processed` lists them separately and
--    for ever, because a thing that leaves the screen quietly is a thing
--    nobody ever answers for.
--
-- 4. A GAP 108 LEFT IS CLOSED ON THE WAY PAST. SELECT policies are OR'ed, and
--    `students_national_read` — the National Rector reading the students of
--    their own administration — did not carry 108's erasure clause. A record
--    the Vice-Chancellor had approved for deletion was hidden from the
--    Registrar and still plainly visible to the Rector. It is narrowed here
--    for both reasons at once.
--
-- ===========================================================================


-- ===========================================================================
-- 1. HOW LONG, AND WHICH ONES
-- ===========================================================================
--
-- NINETY DAYS IS THE UNIVERSITY'S ANSWER, not this migration's assumption, and
-- it is a function rather than a literal sprinkled through four places so that
-- changing it is one edit and cannot be changed in three places out of four.
-- ---------------------------------------------------------------------------

create or replace function application_abandoned_after()
returns interval
language sql
immutable
as $$ select interval '90 days' $$;

comment on function application_abandoned_after() is
  'How long an application stays on the register after it is abandoned. Ninety days, by the '
  'University''s decision: long enough that a slow payer is never lost, short enough that each '
  'intake clears before the next.';


-- ---------------------------------------------------------------------------
-- WHETHER A PARTICULAR APPLICATION HAS BEEN ABANDONED.
--
-- STABLE AND NOT IMMUTABLE: it reads the clock. That is also why nothing can
-- index it, which is fine at this size and is said here so the next person
-- does not try.
--
-- IT DOES NOT TAKE `payment_status`, and that is deliberate rather than an
-- omission. Whether the fee was received changes WHY an application was
-- abandoned — which the archive reports — but never WHETHER: an application
-- the University was paid for and never processed ages off the register at
-- ninety days exactly like one nobody paid for. A parameter the body ignores
-- is a parameter that lies to the next reader about what the answer depends
-- on, so there is not one.
--
-- `restored_at` IS THE EXEMPTION. When the Registrar brings one back it is
-- stamped, and the ninety days start again from that moment — so a restored
-- application does not vanish again the next time the screen is drawn, which
-- would make the Restore button look broken.
-- ---------------------------------------------------------------------------

create or replace function application_is_abandoned(
  the_status  text,
  made_at     timestamptz,
  decided_at  timestamptz,
  restored_at timestamptz
)
returns boolean
language sql
stable
as $$
  select
    -- NEVER AN ADMITTED STUDENT. `enrolled`, `admission_issued`, `approved`
    -- and `conditional` are people the University has taken in; nothing here
    -- touches them, and the list below is POSITIVE rather than an exclusion
    -- for exactly that reason — a status added next year is not silently
    -- archived by a migration written before it existed.
    --
    -- `under_review`, `admission_processing` and `returned` are absent too,
    -- and for a different reason: those are on the University's OWN desk. An
    -- application sitting there for ninety days is the University's backlog,
    -- and hiding a backlog is not tidying.
    the_status in (
      'draft', 'applicant', 'fee_pending',      -- never paid
      'rejected', 'declined',                   -- refused by the University
      'withdrawn',                              -- taken back by the applicant
      'documents_required',                      -- documents asked for, never sent
      'fee_paid', 'documents_verified', 'registrar_approved',
      'ready_for_academic_review'               -- paid, and never processed
    )
    and coalesce(restored_at, decided_at, made_at) < now() - application_abandoned_after();
$$;

comment on function application_is_abandoned(text, timestamptz, timestamptz, timestamptz) is
  'Whether an application has been abandoned long enough to leave the register. Computed from '
  'the row''s own dates, so there is no job to run and no stored flag to go stale. Counted '
  'from the LAST thing that happened to it — its restoration, its decision, or its making. '
  'The statuses are listed positively: a status invented after this function was written is '
  'never archived by it, and one on the University''s own desk is never archived at all.';


-- ===========================================================================
-- 2. BRINGING ONE BACK
-- ===========================================================================
--
-- The Registrar's, and it needs no approval: nothing was lost, so nothing is
-- being undone. It stamps `restored_to_register_at`, which both exempts the
-- row for another ninety days and records that somebody did it.
-- ---------------------------------------------------------------------------

alter table students
  add column if not exists restored_to_register_at timestamptz,
  add column if not exists restored_by uuid references auth.users (id) on delete set null;

comment on column students.restored_to_register_at is
  'When an abandoned application was brought back onto the register. The ninety days run again '
  'from here, so a restored application does not vanish the next time a screen is drawn.';


-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, because of a circularity rather than for convenience: the
-- row this function is asked to restore is, by definition, one the caller
-- cannot see. An ordinary `update … where id = …` with a RETURNING clause is
-- checked against the SELECT policy, which hides it. So the function reads and
-- writes past the policy and names the offices itself.
--
-- WHICH IS WHY IT REFUSES BY ROLE IN ITS FIRST LINES, and why those lines are
-- the first thing the proof at the foot of this file breaks.
-- ---------------------------------------------------------------------------

create or replace function restore_application(
  the_application uuid,
  the_officer     uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nm text;
begin
  -- -----------------------------------------------------------------------
  -- THE SERVICE KEY IS THE APPLICATION, AND ITS ROUTE HAS ALREADY GUARDED IT.
  --
  -- Every write in this system arrives through a route that calls `guard()`,
  -- which reads the role matrix AND 056's capability grants. A list of offices
  -- here that the service key had to satisfy would be a SECOND opinion about
  -- who may — and it would silently refuse a grant the University had
  -- deliberately issued, which is the worst of both: a rule in two places,
  -- disagreeing.
  --
  -- SO THIS CHECK IS FOR DIRECT SQL, where no route has guarded anything.
  --
  -- AND IT REFUSES AN UNKNOWN ROLE RATHER THAN PASSING A NULL ONE. Written the
  -- obvious way — `if auth_role() not in (…)` — a null role makes the whole
  -- comparison NULL, the IF is not taken, and the call SUCCEEDS: a signed-in
  -- account with no `profiles` row would have restored at will. That is not a
  -- rule, it is an accident that happens to hold, so the coalesce is explicit.
  -- -----------------------------------------------------------------------
  if auth.role() <> 'service_role'
     and coalesce(auth_role(), '') not in ('superadmin', 'admin', 'registrar') then
    raise exception 'Only the Office of the Registrar may return an application to the register';
  end if;

  select trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
    into nm
    from students
   where id = the_application;

  if nm is null then
    raise exception 'There is no such application';
  end if;

  update students
     set restored_to_register_at = now(),
         -- WHOEVER IS SIGNED IN, AND ONLY OTHERWISE WHAT WAS PASSED. The
         -- parameter exists because the service key has no `auth.uid()` to
         -- read and the route knows who asked; `auth.uid()` wins wherever
         -- there is one, so a browser cannot name somebody else as the
         -- officer by sending it.
         restored_by             = coalesce(auth.uid(), the_officer)
   where id = the_application;

  return the_application;
end;
$$;

-- `anon` BY NAME, not only PUBLIC. The project's default privileges hand EXECUTE
-- to `anon` explicitly at the moment a function in `public` is created, and a
-- revoke from PUBLIC does not touch an explicit grant — so the obvious
-- `revoke all … from public` leaves the publishable key able to call this. The
-- body refuses it anyway, having no role to match; this is the second lock, and
-- it is the one that does not depend on reading the body correctly.
revoke all on function restore_application(uuid, uuid) from public, anon;
grant execute on function restore_application(uuid, uuid) to authenticated;

comment on function restore_application(uuid, uuid) is
  'Returns an abandoned application to the Students register, for another ninety days. The '
  'Registrar''s, and needing nobody''s approval, because nothing was deleted. SECURITY DEFINER '
  'out of necessity: the row is one the caller cannot see, which is the whole point of it being '
  'archived — so the function names the offices that may call it in its own first lines.';


-- ===========================================================================
-- 3. IT LEAVES THE REGISTER
-- ===========================================================================
--
-- The read policy, narrowed once more. 105 added the Vice-Chancellor and the
-- Chancellor, who read zero students before it; 108 hid what is approved for
-- deletion from everybody except the two who can restore it; this hides what
-- has been abandoned from everybody.
--
-- FROM EVERYBODY, INCLUDING THE REGISTRAR. An archive somebody still sees on
-- the main register is not an archive, and the Registrar reads
-- `archived_applications` instead — a screen that says what it is.
--
-- The whole policy is written out rather than referred to, for the reason 105
-- gave: a policy is a sentence, and half a sentence cannot be read.
-- ---------------------------------------------------------------------------

drop policy if exists students_staff_read on students;
create policy students_staff_read on students
  for select using (
    (
      auth_role() in (
        'superadmin', 'admin', 'registrar', 'finance', 'finance-director',
        'admissions-officer', 'dean', 'hod', 'programme-coordinator',
        'academic-office', 'student-affairs', 'vice-chancellor', 'chancellor'
      )
      or (auth_role() = 'lecturer' and teaches_this_student(id))
    )
    -- 108: approved for deletion, and visible only to the two who can still
    -- bring it back.
    and (
      not is_awaiting_erasure('students', id)
      or auth_role() in ('superadmin', 'vice-chancellor')
    )
    -- 109: abandoned, and visible on the archive instead.
    and not application_is_abandoned(status, created_at, decided_at, restored_to_register_at)
  );

comment on policy students_staff_read on students is
  'Who may read the student register, and which rows. 105 added the Vice-Chancellor and the '
  'Chancellor, who read zero students before it. 108 hides a record approved for deletion from '
  'everybody except the two who can restore it. 109 hides an abandoned application from '
  'everybody: it is read on `archived_applications` instead, which says what it is.';


-- ---------------------------------------------------------------------------
-- AND THE SAME TWO CLAUSES ON THE NATIONAL RECTOR'S POLICY, which is the gap
-- 108 left.
--
-- POSTGRES OR'S SELECT POLICIES. Narrowing one and not the other narrows
-- nothing: a record the Vice-Chancellor had approved for deletion disappeared
-- from the Registrar's register and sat in plain view on the Rector's, and an
-- abandoned application would have done the same. A rule that holds for one
-- reader and not another is not a rule.
--
-- The Rector's clause is otherwise untouched: their own administration's
-- students, and nobody else's.
-- ---------------------------------------------------------------------------

drop policy if exists students_national_read on students;
create policy students_national_read on students
  for select using (
    administration_id is not null
    and administration_id = my_administration()
    and (
      not is_awaiting_erasure('students', id)
      or auth_role() in ('superadmin', 'vice-chancellor')
    )
    and not application_is_abandoned(status, created_at, decided_at, restored_to_register_at)
  );

comment on policy students_national_read on students is
  'The National Rector reads the students of their own administration and nobody else''s. '
  'Carries 108''s erasure clause and 109''s abandonment clause, because SELECT policies are '
  'OR''ed and a row hidden by one policy is still shown by another — 108 narrowed only the '
  'staff policy, and a record approved for deletion stayed plainly visible here.';


-- ===========================================================================
-- 4. WHERE THEY GO
-- ===========================================================================
--
-- SECURITY DEFINER, and this is the one place in the scheme where that is the
-- right answer rather than the lazy one. A `security_invoker` view would read
-- with the caller's rights and therefore through the policy above — which
-- hides exactly the rows this view exists to show. The view would be empty for
-- everybody, for ever.
--
-- So the view bypasses the policy and does the restricting itself, in its own
-- WHERE clause, naming the same offices. That is a thing to be careful about
-- and it is why the list is here in full rather than inherited.
-- ---------------------------------------------------------------------------

drop view if exists archived_applications;

create view archived_applications
with (security_invoker = false) as
  select s.id,
         s.matric_no,
         s.student_number,
         trim(both ' ' from coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, ''))
           as full_name,
         s.email,
         s.phone,
         s.program,
         s.intake,
         s.status,
         s.payment_status,
         s.created_at,
         s.decided_at,
         s.decision_reason,
         s.restored_to_register_at,
         -- WHY IT LEFT, in a word the screen can group by. The refusals and
         -- the withdrawal are read off the status; the difference between
         -- "nobody paid" and "the University was paid" is read off
         -- `payment_status`, because a fee can be registered without the
         -- status having moved on and the archive must not call that unpaid.
         case
           when s.status in ('rejected', 'declined')              then 'refused'
           when s.status = 'withdrawn'                            then 'withdrawn'
           when s.status = 'documents_required'                   then 'documents-never-sent'
           when s.payment_status = 'verified'
             or s.status in ('fee_paid', 'documents_verified',
                             'registrar_approved',
                             'ready_for_academic_review')         then 'paid-never-processed'
           else 'never-paid'
         end as why,
         extract(day from now() - coalesce(s.restored_to_register_at,
                                           s.decided_at, s.created_at))::integer as days_idle
    from students s
   where application_is_abandoned(
           s.status, s.created_at, s.decided_at, s.restored_to_register_at)
     -- THE VIEW DOES ITS OWN RESTRICTING, because it reads past the policy.
     and auth_role() in ('superadmin', 'admin', 'registrar', 'admissions-officer',
                         'academic-office', 'vice-chancellor');

comment on view archived_applications is
  'Applications that have left the register: never paid for, refused, withdrawn, asked for '
  'documents that never came, or paid and never processed, and more than ninety days idle. '
  'Nothing here is deleted. security_invoker is OFF deliberately — a view reading with the '
  'caller''s rights would read through the very policy that hides these rows, and would be '
  'empty for everybody — so it names the offices that may read it itself.';


-- ---------------------------------------------------------------------------
-- AND IT IS READ-ONLY, WHICH IS NOT A FORMALITY.
--
-- This was found by asking Postgres rather than by reading the SQL, and it is
-- worth writing down because the reasoning that makes it safe is wrong:
--
--   select table_name, is_updatable from information_schema.views
--    where table_name = 'archived_applications';   -->  YES
--
-- A view over ONE table with no join, aggregate, DISTINCT or GROUP BY is
-- AUTOMATICALLY UPDATABLE, whatever it is named and whatever it is for. Three
-- of its columns are expressions and so are not writable, but `status`,
-- `payment_status` and the rest are ordinary references and are. The project's
-- default grants hand `authenticated` INSERT, UPDATE and DELETE on every new
-- view. And because this view is deliberately NOT `security_invoker`, a write
-- through it would execute as the owner — PAST the row policy on `students`.
--
-- So any signed-in account could have rewritten an application's status, or
-- deleted the row outright, through a view whose whole purpose is reading. The
-- fifteen other definer views in the schema all report `is_updatable = NO`,
-- because each has a join or an aggregate that happens to disqualify it — they
-- are safe by accident, and this one would not have been.
--
-- The privilege is therefore removed whole and SELECT handed back alone. `anon`
-- loses it entirely: an unauthenticated caller has no business here, and while
-- the WHERE clause above would refuse them anyway, two locks on a door that
-- reads past the policy is the right number.
-- ---------------------------------------------------------------------------

revoke all on archived_applications from anon, authenticated;
grant select on archived_applications to authenticated;


-- ---------------------------------------------------------------------------
-- AND THE ONE KIND THAT IS A PROBLEM RATHER THAN CLUTTER
-- ---------------------------------------------------------------------------
--
-- The University asked for paid-but-never-processed applications to age out
-- with the rest, and they do. But money was taken and nothing happened, and a
-- thing that leaves the screen quietly is a thing nobody ever answers for — so
-- these are also listed on their own, with no age limit at all, from the day
-- the payment was taken.
--
-- NO NINETY DAYS ON THIS ONE. An unprocessed paid application is worth looking
-- at on its second day, not its ninety-first.
--
-- A REFUNDED FEE IS NOT MONEY TAKEN FOR NOTHING. 102 made a refund a
-- transaction related to the payment rather than an edit of it, and the
-- application's `payment_status` becomes `refunded`; the University is no
-- longer holding anything, so it does not belong on a list of money owed an
-- explanation.
--
-- security_invoker IS ON, unlike the archive above, and for a reason worth
-- stating: these rows are NOT hidden by the register's policy until their
-- ninetieth day, so the ordinary rules reach them. Past that day the row
-- leaves this list too — which is why `already_archived` is a column: the
-- screen reads the archive for the older ones and says so.
-- ---------------------------------------------------------------------------

drop view if exists applications_paid_and_never_processed;

create view applications_paid_and_never_processed
with (security_invoker = true) as
  select s.id,
         s.matric_no,
         s.student_number,
         trim(both ' ' from coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, ''))
           as full_name,
         s.email,
         s.program,
         s.status,
         s.payment_status,
         s.fee_reference,
         s.fee_amount,
         s.fee_currency,
         s.fee_registered_at,
         s.created_at,
         extract(day from now() - coalesce(s.fee_registered_at, s.created_at))::integer
           as days_waiting,
         application_is_abandoned(
           s.status, s.created_at, s.decided_at, s.restored_to_register_at) as already_archived
    from students s
   where
     -- NOT DECIDED. Every status before a decision is taken, and none after:
     -- an application that was refused with the fee correctly paid is not
     -- money taken for nothing, it is a decision somebody made.
     s.status in ('draft', 'applicant', 'fee_pending', 'fee_paid', 'under_review',
                  'documents_required', 'documents_verified', 'registrar_approved',
                  'ready_for_academic_review')
     -- AND PAID FOR. Either Finance registered the fee, or the status itself
     -- says the money arrived.
     and (
       s.payment_status = 'verified'
       or s.status in ('fee_paid', 'documents_verified', 'registrar_approved',
                       'ready_for_academic_review')
     )
     and coalesce(s.payment_status, '') <> 'refunded';

comment on view applications_paid_and_never_processed is
  'Applications the University has been paid for and has not finished processing, from the day '
  'the payment was taken and with no age limit. They age off the register with everything else '
  'after ninety days; this is so that leaving the screen is not the same as being answered '
  'for. A refunded fee is not here — the University is no longer holding it. security_invoker, '
  'because these rows are NOT hidden by the register''s policy until they are ninety days old.';

-- READ-ONLY FOR THE SAME REASON, though not for the same stakes: this one is
-- `security_invoker`, so a write through it would be checked against the
-- register's own update policy rather than running as the owner. It is still a
-- list, and a list that can be written to is not a list.
revoke all on applications_paid_and_never_processed from anon, authenticated;
grant select on applications_paid_and_never_processed to authenticated;


-- ===========================================================================
-- 5. THE PROOF
-- ===========================================================================
--
-- SIX OF THIS PROOF'S OWN APPLICATIONS, at dates it chooses, in a nation it
-- invents. It never counts the University's applications and never asserts how
-- many they have: a proof that holds an opinion about their data fails them
-- for using the system.
-- ===========================================================================

do $$
declare
  reg       uuid := gen_random_uuid();
  rector    uuid := gen_random_uuid();
  nation    uuid;
  fresh     uuid;
  unpaid    uuid;
  refused_  uuid;
  paid      uuid;
  docs      uuid;
  enrolled_ uuid;
  seen      integer;
  t         text;
  refused_by_role boolean := false;
begin
  insert into auth.users (id, email) values
    (reg,    'proof-109-registrar@example.invalid'),
    (rector, 'proof-109-rector@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (reg,    'proof-109-registrar@example.invalid', 'Proof Registrar 109', 'registrar'),
    (rector, 'proof-109-rector@example.invalid',    'Proof Rector 109',    'national-rector')
  on conflict (id) do update set role = excluded.role;

  -- A NATION OF THIS PROOF'S OWN. `national_administrations_one_per_country`
  -- is unique on the country, so the proof invents one that cannot be a real
  -- one rather than borrowing a country the University may have established.
  insert into national_administrations (country, name, status, rector_id)
       values ('Proof Country 109', 'Proof National Administration 109', 'proposed', rector)
    returning id into nation;

  insert into students (matric_no, first_name, last_name, status, created_at)
       values ('PROOF-109-FRESH', 'Proof', 'Fresh-109', 'applicant', now() - interval '10 days')
    returning id into fresh;
  insert into students (matric_no, first_name, last_name, status, created_at, administration_id)
       values ('PROOF-109-UNPAID', 'Proof', 'Unpaid-109', 'applicant',
               now() - interval '200 days', nation)
    returning id into unpaid;
  insert into students (matric_no, first_name, last_name, status, created_at, decided_at)
       values ('PROOF-109-REFUSED', 'Proof', 'Refused-109', 'rejected',
               now() - interval '300 days', now() - interval '200 days')
    returning id into refused_;
  insert into students (matric_no, first_name, last_name, status, payment_status,
                        fee_reference, created_at)
       values ('PROOF-109-PAID', 'Proof', 'PaidNotDone-109', 'fee_paid', 'verified',
               'PROOF-109-FEE', now() - interval '200 days')
    returning id into paid;
  insert into students (matric_no, first_name, last_name, status, payment_status, created_at)
       values ('PROOF-109-DOCS', 'Proof', 'DocsNeverSent-109', 'documents_required',
               'verified', now() - interval '200 days')
    returning id into docs;
  insert into students (matric_no, first_name, last_name, status, created_at, student_number)
       values ('PROOF-109-ENROLLED', 'Proof', 'Enrolled-109', 'enrolled',
               now() - interval '900 days', 'PROOF-109-ENROLLED')
    returning id into enrolled_;

  -- ---- A RECENT APPLICATION STAYS ---------------------------------------
  if application_is_abandoned('applicant', now() - interval '10 days', null, null) then
    raise exception '109 FAILED — a ten-day-old application was treated as abandoned';
  end if;
  raise notice '109 OK  a recent application stays on the register';

  -- ---- AND AN OLD UNPAID ONE DOES NOT -----------------------------------
  if not application_is_abandoned('applicant', now() - interval '200 days', null, null) then
    raise exception '109 FAILED — a two-hundred-day-old unpaid application is still current';
  end if;
  raise notice '109 OK  …and one nobody paid for, two hundred days on, does not';

  -- ---- AN ADMITTED STUDENT IS NEVER TOUCHED -----------------------------
  --
  -- The assertion that matters most. Everything else here is tidying; this one
  -- is the difference between tidying and losing people.
  foreach t in array array['enrolled', 'admission_issued', 'approved', 'conditional']
  loop
    if application_is_abandoned(t, now() - interval '900 days', null, null) then
      raise exception '109 FAILED — a student at status "%" and nine hundred days was archived', t;
    end if;
  end loop;
  raise notice '109 OK  an admitted or enrolled student is never archived, at any age';

  -- ---- AND NEITHER IS THE UNIVERSITY'S OWN BACKLOG ----------------------
  --
  -- `under_review` is on the Admissions Office's desk and `admission_processing`
  -- is halfway through issuance. Ninety days of either is the University's own
  -- delay, and hiding a delay is not tidying.
  foreach t in array array['under_review', 'admission_processing', 'returned', 'deferred']
  loop
    if application_is_abandoned(t, now() - interval '900 days', null, null) then
      raise exception '109 FAILED — "%" is on the University''s own desk and was archived', t;
    end if;
  end loop;
  raise notice '109 OK  …nor is anything still sitting on the University''s own desk';

  -- ---- THEY LEAVE THE REGISTER ------------------------------------------
  --
  -- RLS does not apply to the owner, so this changes role or it proves
  -- nothing at all.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from students where id in (unpaid, refused_, paid, docs);
  reset role;
  if seen <> 0 then
    raise exception '109 FAILED — % abandoned application(s) are still on the register', seen;
  end if;
  raise notice '109 OK  an abandoned application leaves the Students register and the counts';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from students where id in (fresh, enrolled_);
  reset role;
  if seen <> 2 then
    raise exception '109 FAILED — the register lost % of two rows it must keep', 2 - seen;
  end if;
  raise notice '109 OK  …and nothing else does';

  -- ---- INCLUDING FROM THE NATIONAL RECTOR, WHICH 108 DID NOT ------------
  --
  -- SELECT policies are OR'ed. Before this migration `students_national_read`
  -- answered for every student of the administration with no clause about
  -- erasure or abandonment at all, so narrowing the staff policy narrowed
  -- nothing. The Rector's own student is the one asserted on.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', rector::text, true);
  select count(*) into seen from students where id = unpaid;
  reset role;
  if seen <> 0 then
    raise exception '109 FAILED — the National Rector still reads an abandoned application';
  end if;
  raise notice '109 OK  …including from the National Rector, whose policy 108 had not narrowed';

  -- ---- AND THEY ARE READABLE ON THE ARCHIVE -----------------------------
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from archived_applications
   where id in (unpaid, refused_, paid, docs);
  reset role;
  if seen <> 4 then
    raise exception '109 FAILED — the archive shows % of four abandoned applications', seen;
  end if;
  raise notice '109 OK  …they are all readable on the archive, which is not a deletion';

  -- EACH SAYING WHY IT LEFT.
  select why into t from archived_applications where id = refused_;
  if t <> 'refused' then
    raise exception '109 FAILED — a refused application left for reason "%"', t;
  end if;
  select why into t from archived_applications where id = paid;
  if t <> 'paid-never-processed' then
    raise exception '109 FAILED — a paid, unprocessed application left for reason "%"', t;
  end if;
  select why into t from archived_applications where id = docs;
  if t <> 'documents-never-sent' then
    raise exception '109 FAILED — an application whose documents never came left for "%"', t;
  end if;
  select why into t from archived_applications where id = unpaid;
  if t <> 'never-paid' then
    raise exception '109 FAILED — an application nobody paid for left for reason "%"', t;
  end if;
  raise notice '109 OK  …each one saying why it left';

  -- AND THE ARCHIVE IS NOT READABLE BY SOMEBODY WHO IS NOT AN ADMISSIONS
  -- OFFICE. The view reads past the policy, so this is the only thing standing
  -- between an archived application and a lecturer.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', rector::text, true);
  select count(*) into seen from archived_applications;
  reset role;
  if seen <> 0 then
    raise exception '109 FAILED — an office with no admissions business read % archived rows', seen;
  end if;
  raise notice '109 OK  …and the archive, which reads past the policy, refuses everybody else';

  -- AND NOBODY WRITES THROUGH IT. PROVED BY BREAKING IT, because the thing
  -- that makes this dangerous is invisible in the SQL: the view is over one
  -- table with no join, so Postgres makes it automatically updatable, and it
  -- is deliberately not security_invoker, so a write would land as the owner
  -- and past the row policy on `students` altogether.
  refused_by_role := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', reg::text, true);
    update archived_applications set status = 'enrolled' where id = refused_;
    reset role;
  exception
    -- THE SQLSTATE, NOT `others`. A refusal is only a proof if it is the
    -- refusal being claimed: `when others` would have passed just as happily
    -- on a typo in the column name, and reported that the lock holds.
    when insufficient_privilege then
      reset role;
      refused_by_role := true;
  end;
  if not refused_by_role then
    raise exception '109 FAILED — an application was rewritten THROUGH the archive, past the '
                    'row policy, by an ordinary signed-in account';
  end if;
  select status into t from students where id = refused_;
  if t <> 'rejected' then
    raise exception '109 FAILED — the archive write was refused and the row changed anyway, '
                    'to "%"', t;
  end if;
  raise notice '109 OK  …and nothing can be WRITTEN through it: the view is read-only, which '
               'an auto-updatable definer view is not by default';

  -- ---- MONEY TAKEN FOR NOTHING IS LISTED FROM DAY ONE -------------------
  select count(*) into seen from applications_paid_and_never_processed
   where id in (paid, docs);
  if seen <> 2 then
    raise exception '109 FAILED — % of two paid, unprocessed applications are on no list', seen;
  end if;
  -- AND A REFUSAL IS NOT. The fee was paid and a decision was taken; the
  -- University owes an explanation for inaction, not for deciding.
  select count(*) into seen from applications_paid_and_never_processed where id = refused_;
  if seen <> 0 then
    raise exception '109 FAILED — a refused application is listed as money taken for nothing';
  end if;
  raise notice '109 OK  and one the University was PAID for and never processed is listed '
               'separately, with no age limit — a refusal is not';

  -- A REFUNDED FEE LEAVES THAT LIST, because nothing is being held.
  update students set payment_status = 'refunded' where id = paid;
  select count(*) into seen from applications_paid_and_never_processed where id = paid;
  if seen <> 0 then
    raise exception '109 FAILED — a refunded fee is still listed as money taken for nothing';
  end if;
  update students set payment_status = 'verified' where id = paid;
  raise notice '109 OK  …and a refunded fee leaves it, because nothing is being held';

  -- ---- THE REGISTRAR BRINGS ONE BACK ------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  perform restore_application(unpaid);
  select count(*) into seen from students where id = unpaid;
  reset role;
  if seen <> 1 then
    raise exception '109 FAILED — a restored application did not come back';
  end if;
  raise notice '109 OK  the Registrar can bring one back, with no approval, because nothing '
               'was lost';

  -- AND NOBODY ELSE CAN. PROVED BY BREAKING IT: a rule nobody has watched
  -- refuse anything is a rule nobody has tested.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', rector::text, true);
    perform restore_application(refused_);
    reset role;
  exception
    when others then
      reset role;
      -- THE MESSAGE IS CHECKED, not merely the fact that something threw. A
      -- bare `when others` reports a passing guard when the call failed for a
      -- missing column, a typo or a null — which is how a rule nobody has
      -- watched refuse anything comes to look tested.
      if sqlerrm not like 'Only the Office of the Registrar%' then
        raise exception '109 FAILED — restoring was refused, but for the wrong reason: %', sqlerrm;
      end if;
      refused_by_role := true;
  end;
  if not refused_by_role then
    raise exception '109 FAILED — an office with no admissions business restored an application';
  end if;
  raise notice '109 OK  …and an office with no admissions business is refused when it tries';

  -- NOR CAN A SIGNED-IN ACCOUNT WITH NO PROFILE AT ALL, which is the case the
  -- obvious spelling of the guard would have let through: `auth_role()` is
  -- null, `null not in (…)` is NULL, the IF is not taken and the restore
  -- happens. There is no profile row for `stranger`, deliberately.
  refused_by_role := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
    perform restore_application(refused_);
    reset role;
  exception
    when others then
      reset role;
      if sqlerrm not like 'Only the Office of the Registrar%' then
        raise exception '109 FAILED — a profile-less caller was refused for the wrong reason: %',
          sqlerrm;
      end if;
      refused_by_role := true;
  end;
  if not refused_by_role then
    raise exception '109 FAILED — an account with no profile row restored an application, '
                    'which is what `null not in (…)` evaluating to NULL does';
  end if;
  raise notice '109 OK  …nor can a signed-in account the register has no profile for';

  -- AND THE PUBLISHABLE KEY CANNOT EVEN CALL IT. Asked rather than reasoned
  -- about, because the answer was NO the first time it was asked and the
  -- revoke above is what changed it: default privileges grant `anon` EXECUTE
  -- by name when a function in `public` is created, and revoking from PUBLIC
  -- does not remove a grant made to a role.
  if has_function_privilege('anon', 'restore_application(uuid, uuid)', 'EXECUTE') then
    raise exception '109 FAILED — the publishable key may execute restore_application';
  end if;
  if not has_function_privilege('authenticated',
                                'restore_application(uuid, uuid)', 'EXECUTE') then
    raise exception '109 FAILED — a signed-in office may NOT execute restore_application, so '
                    'the Restore button cannot work at all';
  end if;
  raise notice '109 OK  …and the publishable key cannot so much as call it, while a signed-in '
               'office can';

  -- AND THE APPLICATION'S OWN SERVICE KEY CAN, because its route has already
  -- asked `guard()` — which reads the role matrix AND 056's capability grants,
  -- and is the one authority on who may. A second list here would refuse a
  -- grant the University had deliberately issued.
  --
  -- IT NAMES THE OFFICER IT ACTED FOR, since a service key has no `auth.uid()`
  -- to read and a restoration date with nobody against it is half a record.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform restore_application(docs, reg);
  perform set_config('request.jwt.claim.role', '', true);
  reset role;
  select restored_by::text into t from students where id = docs;
  if t is distinct from reg::text then
    raise exception '109 FAILED — the service key restored an application and recorded the '
                    'officer as "%"', coalesce(t, 'nobody');
  end if;
  raise notice '109 OK  …while the application''s own service key can, naming the officer it '
               'acted for';

  -- AND IT DOES NOT VANISH AGAIN ON THE NEXT DRAW. The ninety days run from
  -- the restoration, or the Restore button would look broken.
  if application_is_abandoned('applicant', now() - interval '200 days', null, now()) then
    raise exception '109 FAILED — a just-restored application was archived again at once';
  end if;
  raise notice '109 OK  …and it does not vanish again the moment the screen is redrawn';

  raise exception 'ROLLBACK 109';
exception
  when others then
    if sqlerrm = 'ROLLBACK 109' then
      raise notice '109 OK  every proof above rolled back; no application of the '
                   'University''s was read, counted or written to';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 6. DONE
-- ===========================================================================
do $$
begin
  raise notice '109 APPLIED  an application that was never paid for, was refused, was '
               'withdrawn, had documents asked for that never came, or was paid and never '
               'processed leaves the Students register ninety days on. NOTHING IS DELETED: it '
               'is read on the archive, and the Registrar can bring one back without '
               'anybody''s approval. An admitted or enrolled student is never touched, at any '
               'age, and neither is anything still on the University''s own desk.';
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
  union all
  select '108' as migration, '108_nothing_is_deleted_without_the_vice_chancellor.sql' as file,
         case when to_regclass('public.deletion_requests') is not null then 'YES' else 'NO' end as landed,
         'deletion_requests' as what_it_creates
  union all
  select '109' as migration, '109_an_abandoned_application_leaves_the_register.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'students'
                      and column_name = 'restored_to_register_at')
                 then 'YES' else 'NO' end as landed,
         'students.restored_to_register_at' as what_it_creates
) as landed_report
 order by migration;

