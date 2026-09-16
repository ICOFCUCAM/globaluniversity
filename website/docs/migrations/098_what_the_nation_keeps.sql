-- ===========================================================================
-- 098 — WHAT THE NATION KEEPS
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A DOOR CLOSES, AND IT IS THE POINT OF THE FILE. From this moment every
--    payment that names a National Administration is split the instant it is
--    recorded — and WITH NO AGREEMENT IN FORCE, THE WHOLE OF IT GOES TO THE
--    CENTRE. A nation cannot receive a cent before the University has approved
--    the agreement that says what it receives. Nothing is lost: the allocation
--    records why it went where it went, and an agreement approved later
--    governs the payments that follow it, not the ones before.
--
-- 2. REGISTRATION IS NEVER SHARED. The programme is explicit — "Registration
--    fees are allocated to the central ICOF University administration" — so a
--    payment whose purpose is registration allocates 100% to the centre
--    whatever any agreement says, and section 4 refuses an agreement that
--    tries to say otherwise.
--
-- 3. THE MONEY ADDS UP OR THE ROW DOES NOT EXIST. `to_centre + to_nation =
--    gross` is a CHECK constraint, not a convention. A reconciliation that can
--    disagree with itself is not a reconciliation.
--
-- 4. AN ALLOCATION CANNOT BE EDITED. Once written, the amounts are frozen; a
--    correction is a reversal and a new allocation. This is the same rule 043
--    applies to an issued document and for the same reason: a figure somebody
--    can quietly change is a figure nobody can rely on in an audit.
--
-- 5. NOTHING IS ALLOCATED RETROSPECTIVELY. Payments already in the database
--    have no `administration_id` — 097 left every existing row null — so they
--    are the centre's, which is what they have always been. This file writes
--    no allocation for them.
--
-- ---------------------------------------------------------------------------
-- WHY THE SPLIT IS A TRIGGER AND NOT A ROUTE
-- ---------------------------------------------------------------------------
--
-- Because there is more than one way money gets into this database — the
-- Finance desk, a restore, a correction, an import, and whatever the University
-- builds next — and a rule that lives in one route governs one of them.
--
-- The University has learned this in this system already: `reachability.test`
-- exists because things that were correct and connected to nothing kept being
-- found. A split computed in a route is a split that is missing from every
-- other door into `payments`.
--
-- ---------------------------------------------------------------------------
-- AND WHY THE RECTOR CANNOT APPROVE THEIR OWN AGREEMENT
-- ---------------------------------------------------------------------------
--
-- The agreement decides what the Rector's own administration receives. 041
-- refuses an appointment authorised by its drafter, 045 a letter authorised by
-- its preparer, and 097 an administration whose creator made themselves its
-- Rector. This is the fourth of the same rule, applied to the one that decides
-- money.
-- ===========================================================================


-- ===========================================================================
-- 1. THE AGREEMENT
-- ===========================================================================

create table if not exists national_revenue_agreements (
  id               uuid primary key default gen_random_uuid(),
  administration_id uuid not null
                   references national_administrations (id) on delete restrict,

  -- The National Administration Agreement this implements, by reference. 097
  -- already refuses to establish an administration without one; this names the
  -- clause the figures come from, so a dispute has a document to go to.
  reference        text not null check (length(btrim(reference)) between 3 and 120),

  -- ---- WHAT THE NATION KEEPS OF TUITION -----------------------------------
  --
  -- A percentage, two decimals, nothing clever. The University sets it per
  -- administration because the programme says the terms are established in the
  -- agreement, and agreements differ.
  --
  -- ZERO IS ALLOWED AND IS NOT THE SAME AS NO AGREEMENT. An administration on
  -- 0% has been considered and set to nothing; one with no agreement has not
  -- been considered at all, and section 5 treats them differently.
  tuition_share_percent numeric(5,2) not null
                   check (tuition_share_percent >= 0 and tuition_share_percent <= 100),

  -- ---- WHEN IT APPLIES ----------------------------------------------------
  effective_from   date not null,
  effective_to     date,
  constraint national_revenue_agreement_ends_after_it_starts
    check (effective_to is null or effective_to > effective_from),

  status           text not null default 'draft'
                   check (status in ('draft', 'in_force', 'ended')),

  -- ---- WHO APPROVED IT ----------------------------------------------------
  approved_by      uuid references auth.users (id) on delete set null,
  approved_at      timestamptz,

  note             text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- AN AGREEMENT IN FORCE HAS BEEN APPROVED BY SOMEBODY. A draft need not be.
  constraint national_revenue_agreement_in_force_is_approved
    check (status <> 'in_force' or (approved_by is not null and approved_at is not null))
);

comment on table national_revenue_agreements is
  'What each National Administration keeps of the tuition its students pay. '
  'Registration is never shared — see 098 section 5.';

-- ONE AGREEMENT IN FORCE PER ADMINISTRATION AT A TIME. Two would make "what
-- does this nation keep" a question with two answers, which is the state a
-- finance system exists to prevent.
create unique index if not exists national_revenue_agreements_one_in_force
  on national_revenue_agreements (administration_id)
  where status = 'in_force';

create index if not exists national_revenue_agreements_by_administration
  on national_revenue_agreements (administration_id, status);

drop trigger if exists national_revenue_agreements_touch on national_revenue_agreements;
create trigger national_revenue_agreements_touch
  before update on national_revenue_agreements
  for each row execute function set_updated_at();


-- ===========================================================================
-- 2. AND IT IS NOT APPROVED BY THE PERSON IT PAYS
-- ===========================================================================
--
-- A TRIGGER RATHER THAN A CHECK, because the answer is in another table: the
-- Rector of this administration is a column of `national_administrations`, and
-- a CHECK constraint cannot look there.

create or replace function an_agreement_is_not_approved_by_its_rector()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rector uuid;
begin
  if new.approved_by is null then
    return new;
  end if;

  select rector_id into rector
    from national_administrations where id = new.administration_id;

  if rector is not null and rector = new.approved_by then
    raise exception 'A National Rector cannot approve the agreement that decides what their '
                    'own administration keeps. It is approved by the University.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists an_agreement_is_not_approved_by_its_rector_trg
  on national_revenue_agreements;
create trigger an_agreement_is_not_approved_by_its_rector_trg
  before insert or update on national_revenue_agreements
  for each row execute function an_agreement_is_not_approved_by_its_rector();


-- ===========================================================================
-- 3. THE ALLOCATION — ONE PER PAYMENT, AND IT ADDS UP
-- ===========================================================================

create table if not exists revenue_allocations (
  id               uuid primary key default gen_random_uuid(),

  -- ONE ALLOCATION PER PAYMENT. The unique constraint is the whole of the
  -- protection against a payment being counted twice, which is the failure a
  -- national administration would notice last and care about most.
  payment_id       uuid not null unique references payments (id) on delete cascade,

  administration_id uuid not null
                   references national_administrations (id) on delete restrict,
  -- Null where there was no agreement in force. `basis` says so in words.
  agreement_id     uuid references national_revenue_agreements (id) on delete set null,

  gross            numeric(14,2) not null check (gross > 0),
  to_centre        numeric(14,2) not null check (to_centre >= 0),
  to_nation        numeric(14,2) not null check (to_nation >= 0),
  currency         text not null,

  -- WHY IT WENT WHERE IT WENT, in a word a report can group by and a sentence
  -- a Financial Secretary can read.
  --
  --   registration    the centre's in full, always
  --   tuition         split by the agreement in force
  --   no-agreement    the centre's in full, because nothing had been approved
  --   other           anything else the University takes; the centre's
  basis            text not null
                   check (basis in ('registration', 'tuition', 'no-agreement', 'other')),
  note             text,

  allocated_at     timestamptz not null default now(),

  -- =====================================================================
  -- THE MONEY ADDS UP OR THE ROW DOES NOT EXIST.
  -- =====================================================================
  constraint revenue_allocation_adds_up
    check (to_centre + to_nation = gross)
);

comment on table revenue_allocations is
  'How each payment was divided between the centre and a National '
  'Administration. Written by a trigger when the payment lands; never edited.';

create index if not exists revenue_allocations_by_administration
  on revenue_allocations (administration_id, allocated_at desc);

-- ---------------------------------------------------------------------------
-- AND IT IS NEVER EDITED.
--
-- 043 freezes an issued document and 050's audit trail is append-only, for the
-- same reason: a number somebody can quietly change afterwards is a number
-- that proves nothing. A correction is a reversal and a new allocation, which
-- leaves both on the record.
-- ---------------------------------------------------------------------------
create or replace function an_allocation_is_never_rewritten()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.gross is distinct from old.gross
     or new.to_centre is distinct from old.to_centre
     or new.to_nation is distinct from old.to_nation
     or new.currency is distinct from old.currency
     or new.administration_id is distinct from old.administration_id
     or new.payment_id is distinct from old.payment_id then
    raise exception 'An allocation records what was divided and when. Correct it with a '
                    'reversing payment and a new allocation, so both stay on the record.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists an_allocation_is_never_rewritten_trg on revenue_allocations;
create trigger an_allocation_is_never_rewritten_trg
  before update on revenue_allocations
  for each row execute function an_allocation_is_never_rewritten();


-- ===========================================================================
-- 4. REGISTRATION IS NEVER SHARED
-- ===========================================================================
--
-- Stated once, here, so that section 5 and any future reader are reading the
-- same sentence. A payment is registration if its purpose says so; the match
-- is deliberately loose because `payments.purpose` is free text that the
-- Finance desk has been typing into for years.

create or replace function is_registration_money(purpose text)
returns boolean
language sql
immutable
as $$
  select purpose is not null and purpose ~* '(^|[^a-z])registration([^a-z]|$)';
$$;


-- ===========================================================================
-- 5. THE SPLIT, COMPUTED WHEN THE MONEY LANDS
-- ===========================================================================

create or replace function allocate_a_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  deal    national_revenue_agreements%rowtype;
  nation  numeric(14,2);
  why     text;
begin
  -- NO NATION NAMED, NOTHING TO SPLIT. This is every payment the University
  -- has ever taken, and it stays that way.
  if new.administration_id is null then
    return new;
  end if;

  -- REGISTRATION IS THE CENTRE'S, whatever any agreement says.
  if is_registration_money(new.purpose) then
    insert into revenue_allocations
      (payment_id, administration_id, gross, to_centre, to_nation, currency, basis)
    values (new.id, new.administration_id, new.amount, new.amount, 0, new.currency,
            'registration')
    on conflict (payment_id) do nothing;
    return new;
  end if;

  select * into deal from national_revenue_agreements
   where administration_id = new.administration_id
     and status = 'in_force'
     and effective_from <= current_date
     and (effective_to is null or effective_to >= current_date)
   limit 1;

  if not found then
    -- THE DOOR. Nothing approved, so nothing is shared — and the row says why
    -- rather than silently reading as a 0% agreement.
    insert into revenue_allocations
      (payment_id, administration_id, gross, to_centre, to_nation, currency, basis, note)
    values (new.id, new.administration_id, new.amount, new.amount, 0, new.currency,
            'no-agreement',
            'No national revenue agreement was in force on the day this was received.')
    on conflict (payment_id) do nothing;
    return new;
  end if;

  -- ROUNDED TO THE CENT, AND THE CENTRE ABSORBS THE REMAINDER. Computing both
  -- halves by percentage and rounding each would let them miss by a cent, and
  -- `revenue_allocation_adds_up` would then refuse the row — so the nation's
  -- share is rounded and the centre takes what is left. The University is the
  -- party that can carry a cent; a national ledger that will not balance is
  -- somebody's afternoon.
  nation := round(new.amount * deal.tuition_share_percent / 100, 2);

  insert into revenue_allocations
    (payment_id, administration_id, agreement_id, gross, to_centre, to_nation,
     currency, basis)
  values (new.id, new.administration_id, deal.id, new.amount,
          new.amount - nation, nation, new.currency, 'tuition')
  on conflict (payment_id) do nothing;

  return new;
end;
$$;

drop trigger if exists allocate_a_payment_trg on payments;
create trigger allocate_a_payment_trg
  after insert on payments
  for each row execute function allocate_a_payment();


-- ===========================================================================
-- 6. WHAT THE FINANCIAL SECRETARY RECONCILES
-- ===========================================================================
--
-- A VIEW RATHER THAN A TABLE, because a running total stored is a running
-- total that can disagree with the rows under it. This one cannot: it is the
-- rows.

create or replace view national_ledger as
  select
    a.id                          as administration_id,
    a.country,
    a.name,
    a.status,
    r.currency,
    count(r.id)                   as payments_allocated,
    coalesce(sum(r.gross), 0)     as gross_received,
    coalesce(sum(r.to_nation), 0) as kept_by_the_nation,
    coalesce(sum(r.to_centre), 0) as remitted_to_the_centre,
    count(*) filter (where r.basis = 'no-agreement') as awaiting_an_agreement,
    max(r.allocated_at)           as last_allocation
  from national_administrations a
  left join revenue_allocations r on r.administration_id = a.id
  group by a.id, a.country, a.name, a.status, r.currency;

comment on view national_ledger is
  'What each National Administration has received and what was remitted, from '
  'the allocations themselves. `awaiting_an_agreement` counts money that went '
  'to the centre because nothing had been approved.';


-- ===========================================================================
-- 7. ROW-LEVEL SECURITY
-- ===========================================================================

alter table national_revenue_agreements enable row level security;
alter table revenue_allocations enable row level security;

-- WRITING AN AGREEMENT IS THE CENTRE'S.
drop policy if exists national_revenue_agreements_centre on national_revenue_agreements;
create policy national_revenue_agreements_centre on national_revenue_agreements
  for all using (governs_the_university()) with check (governs_the_university());

-- AND A NATION READS ITS OWN. A Rector who cannot see the terms they operate
-- under is being asked to run an administration on trust.
drop policy if exists national_revenue_agreements_own on national_revenue_agreements;
create policy national_revenue_agreements_own on national_revenue_agreements
  for select using (administration_id = my_administration());

drop policy if exists revenue_allocations_centre on revenue_allocations;
create policy revenue_allocations_centre on revenue_allocations
  for all using (governs_the_university()) with check (governs_the_university());

drop policy if exists revenue_allocations_own on revenue_allocations;
create policy revenue_allocations_own on revenue_allocations
  for select using (administration_id = my_administration());

grant select on national_ledger to authenticated;


-- ===========================================================================
-- 8. THE PROOF
-- ===========================================================================

do $$
declare
  centre    uuid := gen_random_uuid();
  rector    uuid := gen_random_uuid();
  nation    uuid;
  deal      uuid;
  appt      uuid;
  pay       uuid;
  student   uuid;
  alloc     revenue_allocations%rowtype;
  refused   boolean;
begin
  insert into auth.users (id, email) values
    (centre, 'proof-098-centre@example.invalid'),
    (rector, 'proof-098-rector@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (centre, 'proof-098-centre@example.invalid', 'Proof Finance Director', 'finance-director'),
    (rector, 'proof-098-rector@example.invalid', 'Proof Rector',           'national-rector')
  on conflict (id) do update set role = excluded.role;

  insert into appointments (person_id, full_name, position_title,
                            employment_type, start_date, end_date, status)
    values (rector, 'Proof Rector', 'National Rector',
            'fixed-term', current_date, current_date + 1095, 'draft')
    returning id into appt;

  insert into national_administrations
    (country, name, created_by, rector_id, rector_appointment_id,
     agreement_reference, status)
    values ('Erewhon', 'ICOF Global University — National Administration of Erewhon',
            centre, rector, appt, 'NRA-PROOF-098', 'established')
    returning id into nation;

  insert into students (matric_no, first_name, last_name, administration_id)
    values ('PROOF-098', 'Proof', 'Erewhon', nation) returning id into student;

  -- ---- WITH NO AGREEMENT, THE CENTRE KEEPS EVERYTHING --------------------
  insert into payments (student_id, reference, amount, currency, purpose,
                        administration_id)
    values (student, 'PROOF-098-TUITION-A', 1000.00, 'USD', 'Tuition, first instalment',
            nation)
    returning id into pay;

  select * into alloc from revenue_allocations where payment_id = pay;
  if alloc.basis <> 'no-agreement' or alloc.to_nation <> 0 or alloc.to_centre <> 1000.00 then
    raise exception '098 FAILED — a nation was paid with no agreement in force (% / % / %)',
      alloc.basis, alloc.to_nation, alloc.to_centre;
  end if;
  raise notice '098 OK  with no agreement in force the whole payment stays with the centre';

  -- ---- THE RECTOR CANNOT APPROVE THEIR OWN TERMS -------------------------
  begin
    refused := false;
    insert into national_revenue_agreements
      (administration_id, reference, tuition_share_percent, effective_from,
       status, approved_by, approved_at, created_by)
      values (nation, 'NRA-PROOF-098', 70, current_date, 'in_force',
              rector, now(), centre);
  exception when insufficient_privilege then
    refused := true;
  end;
  if not refused then
    raise exception '098 FAILED — a Rector approved the agreement that pays their own nation';
  end if;
  raise notice '098 OK  a Rector cannot approve the agreement that pays their own nation';

  -- ---- an agreement the University approved ------------------------------
  insert into national_revenue_agreements
    (administration_id, reference, tuition_share_percent, effective_from,
     status, approved_by, approved_at, created_by)
    values (nation, 'NRA-PROOF-098', 70, current_date, 'in_force',
            centre, now(), centre)
    returning id into deal;

  -- ---- TUITION SPLITS BY THE AGREEMENT -----------------------------------
  insert into payments (student_id, reference, amount, currency, purpose,
                        administration_id)
    values (student, 'PROOF-098-TUITION-B', 1000.00, 'USD', 'Tuition, second instalment',
            nation)
    returning id into pay;

  select * into alloc from revenue_allocations where payment_id = pay;
  if alloc.basis <> 'tuition' or alloc.to_nation <> 700.00 or alloc.to_centre <> 300.00 then
    raise exception '098 FAILED — tuition split as % / % / % rather than 700 to the nation',
      alloc.basis, alloc.to_nation, alloc.to_centre;
  end if;
  raise notice '098 OK  tuition splits by the agreement in force';

  -- ---- REGISTRATION IS NEVER SHARED --------------------------------------
  insert into payments (student_id, reference, amount, currency, purpose,
                        administration_id)
    values (student, 'PROOF-098-REG', 250.00, 'USD', 'Registration fee', nation)
    returning id into pay;

  select * into alloc from revenue_allocations where payment_id = pay;
  if alloc.basis <> 'registration' or alloc.to_nation <> 0 then
    raise exception '098 FAILED — registration was shared with a nation (% / %)',
      alloc.basis, alloc.to_nation;
  end if;
  raise notice '098 OK  registration is the centre''s even under a 70%% agreement';

  -- ---- AND THE ROW CANNOT BE REWRITTEN -----------------------------------
  begin
    refused := false;
    update revenue_allocations set to_nation = 250.00, to_centre = 0 where payment_id = pay;
  exception when restrict_violation then
    refused := true;
  end;
  if not refused then
    raise exception '098 FAILED — an allocation was rewritten after the fact';
  end if;
  raise notice '098 OK  an allocation cannot be rewritten';

  -- ---- AND IT HAS TO ADD UP ----------------------------------------------
  begin
    refused := false;
    insert into revenue_allocations
      (payment_id, administration_id, gross, to_centre, to_nation, currency, basis)
      values (pay, nation, 100, 10, 10, 'USD', 'other');
  exception when check_violation then
    refused := true;
  when unique_violation then
    -- the payment already has one; use a fresh payment to test the sum
    refused := false;
  end;
  if not refused then
    insert into payments (student_id, reference, amount, currency, purpose)
      values (student, 'PROOF-098-SUM', 100.00, 'USD', 'Other') returning id into pay;
    begin
      refused := false;
      insert into revenue_allocations
        (payment_id, administration_id, gross, to_centre, to_nation, currency, basis)
        values (pay, nation, 100, 10, 10, 'USD', 'other');
    exception when check_violation then
      refused := true;
    end;
  end if;
  if not refused then
    raise exception '098 FAILED — an allocation was accepted whose halves do not make the whole';
  end if;
  raise notice '098 OK  an allocation whose halves do not make the whole is refused';

  -- ---- THE LEDGER READS THE ROWS -----------------------------------------
  if (select kept_by_the_nation from national_ledger
       where administration_id = nation and currency = 'USD') <> 700.00 then
    raise exception '098 FAILED — the ledger does not agree with the allocations';
  end if;
  raise notice '098 OK  the ledger is the allocations and agrees with them';

  raise exception 'proof-098-rollback';
exception
  when others then
    if sqlerrm = 'proof-098-rollback' then
      raise notice '098 OK  every proof above rolled back; nothing was kept';
    else
      raise;
    end if;
end $$;
