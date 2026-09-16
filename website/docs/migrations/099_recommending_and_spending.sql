-- ===========================================================================
-- 099 — RECOMMENDING AND SPENDING
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A NATIONAL RECTOR CAN RECOMMEND SOMEBODY FOR A POST, and that is all a
--    recommendation is. It creates no appointment, confers no employment and
--    binds the University to nothing. HR drafts the appointment from it and the
--    Vice-Chancellor approves — three people, which is the programme's own
--    sentence: "The National Rector recommends. ICOF University verifies and
--    appoints."
--
-- 2. A NATIONAL ADMINISTRATION CAN RECORD WHAT IT SPENDS, under the two-level
--    governance the programme draws: the Financial Secretary RECORDS, the
--    Rector AUTHORISES, and NEITHER MAY DO BOTH. An expense recorded and
--    authorised by one person is the thing this separation exists to prevent.
--
-- 3. A DOOR CLOSES: AN ADMINISTRATION CANNOT AUTHORISE MORE THAN IT HAS KEPT.
--    098 computes what each nation keeps of each payment. From now on the
--    authorised expenses in a currency may not exceed the allocations in that
--    same currency. A nation with no revenue agreement has kept nothing, so it
--    can authorise nothing — which follows from 098 and is worth saying out
--    loud before somebody records a month of expenses against it.
--
-- 4. NOTHING IS SEEDED. Both tables are created empty.
--
-- ---------------------------------------------------------------------------
-- WHY A RECOMMENDATION IS NOT A DRAFT APPOINTMENT
-- ---------------------------------------------------------------------------
--
-- It was tempting to let a Rector write an `appointments` row at `draft` and
-- call that the recommendation. It would be wrong twice.
--
-- 041 REFUSES AN APPROVAL BY WHOEVER DRAFTED IT. That rule is what stops one
-- person manufacturing an appointment, and it counts the DRAFTER. Make the
-- Rector the drafter and the University has spent its separation on the wrong
-- person: HR could then approve, and the two offices that are supposed to check
-- each other are the Rector and HR rather than the drafter and the approver.
--
-- AND AN APPOINTMENT REQUIRES THINGS A RECOMMENDATION HAS NOT DECIDED —
-- `employment_type` and `start_date` are NOT NULL, rightly, because an
-- appointment without them is not an appointment. A Rector recommending a
-- lecturer does not yet know either, and a form that demanded them would be
-- asking the Rector to invent the University's terms.
--
-- So a recommendation is its own small thing, and `appointment_id` is where it
-- points once HR has drafted from it.
-- ===========================================================================


-- ===========================================================================
-- 1. THE RECOMMENDATION
-- ===========================================================================

create table if not exists national_staff_recommendations (
  id                uuid primary key default gen_random_uuid(),
  administration_id uuid not null
                    references national_administrations (id) on delete restrict,

  -- ---- Who is being recommended -------------------------------------------
  --
  -- A NAME AND NOT AN ACCOUNT. The person almost never has a login yet — that
  -- is the point of recommending them — and a record that cannot exist until
  -- IT has created an account is a record that lives in somebody's email.
  -- `appointments` made the same decision for the same reason.
  full_name         text not null check (length(btrim(full_name)) >= 3),
  email             text,
  phone             text,

  -- ---- For what -----------------------------------------------------------
  proposed_position text not null check (length(btrim(proposed_position)) >= 3),
  -- The post in the University's own register, where the Rector can name one.
  -- Optional, because a nation may need a post the register does not yet hold
  -- and refusing the recommendation on that basis helps nobody.
  position_id       uuid references positions (id) on delete set null,

  -- WHY. Compulsory, and long enough to be a reason rather than a word.
  -- The office that has to verify this reads it, and "good candidate" is not
  -- something anybody can verify.
  rationale         text not null check (length(btrim(rationale)) >= 20),
  qualifications    text,

  -- ---- Where it has got to ------------------------------------------------
  --
  -- `submitted`  with the University
  -- `accepted`   the University will appoint; HR drafts from here
  -- `declined`   it will not proceed, and `decision_note` says why
  -- `appointed`  an appointment exists; `appointment_id` names it
  status            text not null default 'submitted'
                    check (status in ('submitted', 'accepted', 'declined', 'appointed')),

  recommended_by    uuid references auth.users (id) on delete set null,
  recommended_at    timestamptz not null default now(),

  reviewed_by       uuid references auth.users (id) on delete set null,
  reviewed_at       timestamptz,
  decision_note     text,

  appointment_id    uuid references appointments (id) on delete set null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A DECISION NOBODY EXPLAINED IS ONE NOBODY CAN ACT ON. The Rector reads
  -- this, and if it is going to be declined they need to know whether to
  -- recommend somebody else or to fix this recommendation.
  constraint national_recommendation_declined_says_why
    check (status <> 'declined'
           or (decision_note is not null and length(btrim(decision_note)) >= 10)),

  -- AND AN APPOINTED ONE NAMES THE APPOINTMENT. Otherwise `appointed` is a
  -- word somebody typed rather than a fact with a document behind it — which
  -- is the failure 047 already refuses for appointments themselves.
  constraint national_recommendation_appointed_names_it
    check (status <> 'appointed' or appointment_id is not null)
);

comment on table national_staff_recommendations is
  'A National Rector recommending somebody for a post. Not an appointment: HR '
  'drafts from it and the Vice-Chancellor approves.';

create index if not exists national_recommendations_by_administration
  on national_staff_recommendations (administration_id, status);

drop trigger if exists national_staff_recommendations_touch
  on national_staff_recommendations;
create trigger national_staff_recommendations_touch
  before update on national_staff_recommendations
  for each row execute function set_updated_at();


-- ---------------------------------------------------------------------------
-- AND THE RECTOR DOES NOT DECIDE THEIR OWN RECOMMENDATION.
--
-- The fourth application of the rule this system keeps returning to: 041 for
-- an appointment, 045 for a letter, 097 for an administration, 098 for a
-- revenue agreement. A Rector who could accept their own recommendation would
-- be appointing their own staff, which is the one thing the programme's
-- "ICOF verifies and appoints" exists to prevent.
-- ---------------------------------------------------------------------------
create or replace function a_recommendation_is_somebody_elses_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status not in ('accepted', 'declined') then
    return new;
  end if;

  new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
  new.reviewed_at := coalesce(new.reviewed_at, now());

  if new.reviewed_by is not null and new.reviewed_by = old.recommended_by then
    raise exception 'A recommendation is decided by the University, not by the person who made '
                    'it. That is what "the National Rector recommends and ICOF appoints" means.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists a_recommendation_is_somebody_elses_decision_trg
  on national_staff_recommendations;
create trigger a_recommendation_is_somebody_elses_decision_trg
  before update on national_staff_recommendations
  for each row execute function a_recommendation_is_somebody_elses_decision();


-- ===========================================================================
-- 2. WHAT THE ADMINISTRATION SPENDS
-- ===========================================================================

create table if not exists national_expenses (
  id                uuid primary key default gen_random_uuid(),
  administration_id uuid not null
                    references national_administrations (id) on delete restrict,

  -- The programme's own list of what national tuition revenue may be used for.
  -- A vocabulary rather than free text, because "national expenses" as one
  -- undifferentiated pile is a report nobody can answer a question from.
  category          text not null
                    check (category in ('staff', 'academic', 'student-support',
                                        'administration', 'recruitment', 'technology',
                                        'facilities', 'events', 'marketing',
                                        'operations', 'development')),
  description       text not null check (length(btrim(description)) >= 4),
  amount            numeric(14,2) not null check (amount > 0),
  currency          text not null check (currency in ('FCFA','USD','EUR','GBP','NGN')),
  incurred_on       date not null,
  reference         text,

  -- ---- The two levels -----------------------------------------------------
  --
  --   `recorded`    the Financial Secretary has entered it
  --   `authorised`  the Rector has authorised it; it counts against the purse
  --   `rejected`    it will not be paid, and the note says why
  status            text not null default 'recorded'
                    check (status in ('recorded', 'authorised', 'rejected')),

  recorded_by       uuid references auth.users (id) on delete set null,
  recorded_at       timestamptz not null default now(),
  authorised_by     uuid references auth.users (id) on delete set null,
  authorised_at     timestamptz,
  note              text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint national_expense_rejected_says_why
    check (status <> 'rejected'
           or (note is not null and length(btrim(note)) >= 10)),

  -- =======================================================================
  -- THE RECORDER IS NOT THE AUTHORISER.
  -- =======================================================================
  --
  -- The programme draws exactly this: "National Rector — authorizes national
  -- operations — Financial Secretary — records/processes finances". A
  -- constraint rather than a convention, because the whole reason the two
  -- offices are separate roles is that one person doing both is the failure.
  constraint national_expense_recorder_is_not_the_authoriser
    check (authorised_by is null or recorded_by is null
           or authorised_by <> recorded_by)
);

comment on table national_expenses is
  'What a National Administration spends. Recorded by its Financial Secretary, '
  'authorised by its Rector, and never by the same person.';

create index if not exists national_expenses_by_administration
  on national_expenses (administration_id, status, incurred_on desc);

drop trigger if exists national_expenses_touch on national_expenses;
create trigger national_expenses_touch
  before update on national_expenses
  for each row execute function set_updated_at();


-- ===========================================================================
-- 3. AND A NATION CANNOT AUTHORISE WHAT IT WAS NEVER ALLOCATED
-- ===========================================================================
--
-- A TRIGGER, BECAUSE THE ANSWER IS A SUM OVER TWO OTHER TABLES. What the
-- nation has kept is 098's allocations; what it has committed is the expenses
-- already authorised. A CHECK constraint can see neither.
--
-- WITHIN A CURRENCY. Comparing across currencies would need a rate, this
-- system holds none, and inventing one to guard a budget would be inventing
-- the University's money.
--
-- AND IT IS CHECKED ON AUTHORISATION, NOT ON RECORDING. A Financial Secretary
-- must be able to enter an invoice that arrived; whether the administration
-- can carry it is the Rector's decision and this is where that decision is
-- refused.

create or replace function a_nation_spends_what_it_kept()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kept      numeric(14,2);
  committed numeric(14,2);
begin
  if new.status <> 'authorised' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'authorised' then return new; end if;

  select coalesce(sum(to_nation), 0) into kept
    from revenue_allocations
   where administration_id = new.administration_id
     and currency = new.currency;

  select coalesce(sum(amount), 0) into committed
    from national_expenses
   where administration_id = new.administration_id
     and currency = new.currency
     and status = 'authorised'
     and id <> new.id;

  if committed + new.amount > kept then
    raise exception 'This administration has been allocated % % and has already authorised %. '
                    'Authorising % more would commit money it has not received.',
                    kept, new.currency, committed, new.amount
      using errcode = 'check_violation';
  end if;

  new.authorised_by := coalesce(new.authorised_by, auth.uid());
  new.authorised_at := coalesce(new.authorised_at, now());
  return new;
end;
$$;

drop trigger if exists a_nation_spends_what_it_kept_trg on national_expenses;
create trigger a_nation_spends_what_it_kept_trg
  before insert or update on national_expenses
  for each row execute function a_nation_spends_what_it_kept();


-- ===========================================================================
-- 4. THE PURSE
-- ===========================================================================
--
-- What 098's ledger says the nation kept, less what it has authorised. A view
-- for the reason 098 gives about its own: a stored balance is a balance that
-- can disagree with the rows under it.

create or replace view national_purse as
  select
    a.id                                  as administration_id,
    a.country,
    a.name,
    money.currency,
    money.kept,
    coalesce(spend.authorised, 0)         as authorised,
    coalesce(spend.awaiting, 0)           as awaiting_authorisation,
    money.kept - coalesce(spend.authorised, 0) as available
  from national_administrations a
  join (
    select administration_id, currency, sum(to_nation) as kept
      from revenue_allocations group by administration_id, currency
  ) money on money.administration_id = a.id
  left join (
    select administration_id, currency,
           sum(amount) filter (where status = 'authorised') as authorised,
           sum(amount) filter (where status = 'recorded')   as awaiting
      from national_expenses group by administration_id, currency
  ) spend on spend.administration_id = a.id and spend.currency = money.currency;

comment on view national_purse is
  'What each National Administration has kept, authorised and has left, per '
  'currency. Derived from the allocations and the expenses themselves.';


-- ===========================================================================
-- 5. ROW-LEVEL SECURITY
-- ===========================================================================

alter table national_staff_recommendations enable row level security;
alter table national_expenses enable row level security;

-- ---- RECOMMENDATIONS ------------------------------------------------------
--
-- THE OFFICES THAT VERIFY AND APPOINT SEE ALL OF THEM. HR drafts the
-- appointment; without this the queue is empty and the whole chain stops at
-- the Rector's own screen.
drop policy if exists national_recommendations_university on national_staff_recommendations;
create policy national_recommendations_university on national_staff_recommendations
  for all using (
    governs_the_university() or auth_role() in ('hr-officer', 'hr-administrator')
  ) with check (
    governs_the_university() or auth_role() in ('hr-officer', 'hr-administrator')
  );

-- AND A NATION SEES ITS OWN.
drop policy if exists national_recommendations_own_read on national_staff_recommendations;
create policy national_recommendations_own_read on national_staff_recommendations
  for select using (administration_id = my_administration());

-- A RECTOR WRITES THEIR OWN, AND ONLY INTO THEIR OWN NATION. `with check` is
-- what makes the second half true: without it a Rector could insert a row
-- naming another administration and then never see it again — which is worse
-- than being refused, because nobody would know it was there.
drop policy if exists national_recommendations_own_write on national_staff_recommendations;
create policy national_recommendations_own_write on national_staff_recommendations
  for insert with check (
    administration_id = my_administration()
    and auth_role() = 'national-rector'
  );

-- ---- EXPENSES -------------------------------------------------------------
drop policy if exists national_expenses_university on national_expenses;
create policy national_expenses_university on national_expenses
  for all using (governs_the_university()) with check (governs_the_university());

drop policy if exists national_expenses_own_read on national_expenses;
create policy national_expenses_own_read on national_expenses
  for select using (administration_id = my_administration());

-- THE SECRETARY RECORDS.
drop policy if exists national_expenses_secretary_write on national_expenses;
create policy national_expenses_secretary_write on national_expenses
  for insert with check (
    administration_id = my_administration()
    and auth_role() = 'national-financial-secretary'
  );

-- THE RECTOR AUTHORISES. A separate policy from the one above, on a separate
-- command, held by a separate role — which is the two-level governance, said
-- in the only place that can actually enforce it.
drop policy if exists national_expenses_rector_authorises on national_expenses;
create policy national_expenses_rector_authorises on national_expenses
  for update using (
    administration_id = my_administration() and auth_role() = 'national-rector'
  ) with check (
    administration_id = my_administration()
  );

grant select on national_purse to authenticated;


-- ===========================================================================
-- 6. THE PROOF
-- ===========================================================================

do $$
declare
  centre     uuid := gen_random_uuid();
  rector     uuid := gen_random_uuid();
  secretary  uuid := gen_random_uuid();
  nation     uuid;
  appt       uuid;
  student    uuid;
  rec        uuid;
  spend      uuid;
  refused    boolean;
  seen       integer;
begin
  insert into auth.users (id, email) values
    (centre,    'proof-099-centre@example.invalid'),
    (rector,    'proof-099-rector@example.invalid'),
    (secretary, 'proof-099-secretary@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (centre,    'proof-099-centre@example.invalid',    'Proof Registrar', 'registrar'),
    (rector,    'proof-099-rector@example.invalid',    'Proof Rector',    'national-rector'),
    (secretary, 'proof-099-secretary@example.invalid', 'Proof Secretary',
     'national-financial-secretary')
  on conflict (id) do update set role = excluded.role;

  insert into appointments (person_id, full_name, position_title,
                            employment_type, start_date, end_date, status)
    values (rector, 'Proof Rector', 'National Rector',
            'fixed-term', current_date, current_date + 1095, 'draft')
    returning id into appt;

  insert into national_administrations
    (country, name, created_by, rector_id, rector_appointment_id,
     agreement_reference, status)
    values ('Lilliput', 'ICOF Global University — National Administration of Lilliput',
            centre, rector, appt, 'NRA-PROOF-099', 'established')
    returning id into nation;

  update profiles set administration_id = nation where id = secretary;

  -- ---- A RECOMMENDATION IS NOT AN APPOINTMENT ----------------------------
  insert into national_staff_recommendations
    (administration_id, full_name, proposed_position, rationale, recommended_by)
    values (nation, 'A Candidate', 'Lecturer in Theology',
            'Has taught the subject for eleven years at a neighbouring institution.', rector)
    returning id into rec;

  if (select count(*) from appointments where full_name = 'A Candidate') <> 0 then
    raise exception '099 FAILED — recommending somebody created an appointment';
  end if;
  raise notice '099 OK  a recommendation creates no appointment and binds nobody';

  -- ---- AND THE RECTOR DOES NOT DECIDE IT ----------------------------------
  begin
    refused := false;
    update national_staff_recommendations
       set status = 'accepted', reviewed_by = rector where id = rec;
  exception when insufficient_privilege then
    refused := true;
  end;
  if not refused then
    raise exception '099 FAILED — a Rector accepted their own recommendation';
  end if;
  raise notice '099 OK  a Rector cannot decide their own recommendation';

  update national_staff_recommendations
     set status = 'accepted', reviewed_by = centre where id = rec;
  raise notice '099 OK  …and the University can';

  -- ---- DECLINING SAYS WHY -------------------------------------------------
  begin
    refused := false;
    update national_staff_recommendations
       set status = 'declined', reviewed_by = centre, decision_note = 'no' where id = rec;
  exception when check_violation then
    refused := true;
  end;
  if not refused then
    raise exception '099 FAILED — a recommendation was declined with no reason';
  end if;
  raise notice '099 OK  declining a recommendation requires a reason the Rector can read';

  -- ---- SPENDING -----------------------------------------------------------
  --
  -- The nation has been allocated nothing yet, so it can authorise nothing.
  insert into national_expenses
    (administration_id, category, description, amount, currency, incurred_on, recorded_by)
    values (nation, 'operations', 'Office rent, first quarter', 300.00, 'USD',
            current_date, secretary)
    returning id into spend;
  raise notice '099 OK  the Financial Secretary can record an expense before it is authorised';

  begin
    refused := false;
    update national_expenses
       set status = 'authorised', authorised_by = rector where id = spend;
  exception when check_violation then
    refused := true;
  end;
  if not refused then
    raise exception '099 FAILED — a nation authorised money it had never been allocated';
  end if;
  raise notice '099 OK  a nation cannot authorise what it was never allocated';

  -- ---- give it some money, through 098's own machinery --------------------
  insert into students (matric_no, first_name, last_name, administration_id)
    values ('PROOF-099', 'Proof', 'Lilliput', nation) returning id into student;
  insert into national_revenue_agreements
    (administration_id, reference, tuition_share_percent, effective_from,
     status, approved_by, approved_at, created_by)
    values (nation, 'NRA-PROOF-099', 50, current_date, 'in_force', centre, now(), centre);
  insert into payments (student_id, reference, amount, currency, purpose, administration_id)
    values (student, 'PROOF-099-TUITION', 1000.00, 'USD', 'Tuition', nation);

  if (select kept from national_purse
       where administration_id = nation and currency = 'USD') <> 500.00 then
    raise exception '099 FAILED — the purse does not agree with the allocation';
  end if;
  raise notice '099 OK  the purse is what 098 allocated — 500 of 1000 at 50%%';

  -- ---- NOW IT CAN AUTHORISE, AND NOT BY THE PERSON WHO RECORDED IT --------
  begin
    refused := false;
    update national_expenses
       set status = 'authorised', authorised_by = secretary where id = spend;
  exception when check_violation then
    refused := true;
  end;
  if not refused then
    raise exception '099 FAILED — the Secretary recorded an expense and authorised it';
  end if;
  raise notice '099 OK  whoever records an expense may not authorise it';

  update national_expenses
     set status = 'authorised', authorised_by = rector where id = spend;

  if (select available from national_purse
       where administration_id = nation and currency = 'USD') <> 200.00 then
    raise exception '099 FAILED — the purse did not fall by the authorised expense';
  end if;
  raise notice '099 OK  authorising it leaves 200 of the 500 available';

  -- ---- AND THE CEILING HOLDS ----------------------------------------------
  insert into national_expenses
    (administration_id, category, description, amount, currency, incurred_on,
     recorded_by, status, authorised_by)
    values (nation, 'staff', 'Salaries', 250.00, 'USD', current_date, secretary,
            'recorded', null)
    returning id into spend;
  begin
    refused := false;
    update national_expenses
       set status = 'authorised', authorised_by = rector where id = spend;
  exception when check_violation then
    refused := true;
  end;
  if not refused then
    raise exception '099 FAILED — a nation authorised 250 with 200 available';
  end if;
  raise notice '099 OK  and it cannot authorise 250 with 200 left';

  -- ---- ONE NATION'S RECORDS ARE NOT ANOTHER'S ----------------------------
  perform set_config('request.jwt.claim.sub', secretary::text, true);
  set local role authenticated;
  select count(*) into seen from national_expenses;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);

  if seen <> 2 then
    raise exception '099 FAILED — the Secretary saw % expense rows, not their nation''s 2', seen;
  end if;
  raise notice '099 OK  a Financial Secretary reads their own nation''s expenses';

  raise exception 'proof-099-rollback';
exception
  when others then
    if sqlerrm = 'proof-099-rollback' then
      raise notice '099 OK  every proof above rolled back; nothing was kept';
    else
      raise;
    end if;
end $$;
