-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 102, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-PART-8.sql 102
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
) as landed_report
 order by migration;

