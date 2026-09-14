-- ===========================================================================
-- 081 — WHAT AN HR OFFICER MAY SEE, AND CORRECT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE DRAFT & SUBMIT SCREEN WORKS FOR AN HR OFFICER. It does not today.
--    056 built `appointments_without_pay` so that a salary is never delivered
--    to a browser with no business showing one — which is right — and the view
--    carries twenty-five columns while the screen asks for thirty-one. Six it
--    asks for are not there: `terms`, `working_hours`, `appointing_authority`,
--    `authority_decided_on`, `postal_address` and `faculty`. PostgREST refuses
--    the whole query over a column it does not have, so for every role without
--    `set-remuneration` THE SCREEN SIMPLY DOES NOT LOAD. An empty register
--    reads as a University that has never appointed anybody.
--
-- 2. AND A DRAFT CAN BE CORRECTED. `position_id` is added for the same reason:
--    the new "Edit this draft" button fills the form from the record, and
--    without the post it would silently blank the one field everything
--    downstream hangs off — the letter's family, its job description, the
--    standing of the office.
--
-- NOT ONE OF THESE IS PAY. They are the particulars of an appointment an HR
-- officer is already trusted to draft, and 056's separation is untouched:
-- `salary_amount`, `salary_currency` and `salary_period` are still absent, and
-- `is_paid` still says only whether there is a figure.
--
-- ---------------------------------------------------------------------------
-- DROPPED AND RECREATED, NOT REPLACED
-- ---------------------------------------------------------------------------
--
-- `create or replace view` may only APPEND columns — it cannot insert one in
-- the middle, rename one or drop one. This puts the new columns beside the
-- ones they belong with rather than in an arbitrary tail, so it must drop
-- first. That has cost this system a bundle re-run before: a view a later
-- migration widens must be dropped and created in BOTH migrations, never
-- replaced in one and dropped in the other.
-- ===========================================================================

drop view if exists appointments_without_pay;

create view appointments_without_pay
with (security_invoker = true) as
  select
    id,
    person_id,
    lecturer_id,
    full_name,
    email,
    phone,
    -- NEW. A letter is posted, so the address is a particular of the
    -- appointment and not a confidence.
    postal_address,
    position_title,
    -- NEW. The post from the register. Everything the letter does with wording
    -- and with the job description hangs off this one column.
    position_id,
    department_id,
    unit_name,
    -- NEW. Which faculty, where the post belongs to one.
    faculty,
    employment_type,
    start_date,
    end_date,
    effective_date,
    probation_months,
    -- NEW. The three the letter states and the screen edits.
    working_hours,
    place_of_duty,
    reports_to_id,
    reports_to_name,
    appointing_authority,
    authority_decided_on,
    terms,
    -- WHETHER THERE IS PAY, NEVER WHAT IT IS. 056's line, unchanged: a letter
    -- for an unpaid post says nothing about remuneration and a letter for a
    -- paid one must, so the screen has to know which without being told the
    -- figure.
    salary_amount is not null as is_paid,
    status,
    drafted_by,
    authorized_by,
    authorized_at,
    issued_at,
    created_at,
    updated_at
  from appointments;

comment on view appointments_without_pay is
  'Every particular of an appointment except what somebody is paid. The three salary '
  'columns are absent and `is_paid` says only whether a figure exists, so a role without '
  'set-remuneration can draft, read and correct an appointment without ever being sent a '
  'salary.';


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  missing text;
  leaked  text;
begin
  -- ---- EVERY COLUMN THE SCREEN ASKS FOR IS THERE -------------------------
  --
  -- Named one by one rather than counted, because the failure this fixes was
  -- a screen asking for a column a view did not have, and a count would pass
  -- while the wrong six were present.
  select string_agg(w.name, ', ' order by w.name) into missing
    from (values
      ('id'), ('full_name'), ('email'), ('phone'), ('postal_address'),
      ('position_title'), ('position_id'), ('unit_name'), ('faculty'),
      ('employment_type'), ('start_date'), ('end_date'), ('effective_date'),
      ('probation_months'), ('place_of_duty'), ('reports_to_name'),
      ('working_hours'), ('appointing_authority'), ('authority_decided_on'),
      ('terms'), ('status'), ('drafted_by'), ('authorized_by'), ('issued_at')
    ) as w(name)
   where not exists (
     select 1 from information_schema.columns c
      where c.table_name = 'appointments_without_pay' and c.column_name = w.name);

  if missing is not null then
    raise exception '081 FAILED: the pay-free view is still missing %, so the Draft & submit '
                    'screen cannot load for an HR officer', missing;
  end if;

  -- ---- AND NOT ONE OF THEM IS THE SALARY ---------------------------------
  --
  -- The whole point of 056. A view that grew to be convenient and quietly
  -- carried the figure would undo it, and this is the check that would have
  -- caught that.
  select string_agg(c.column_name, ', ' order by c.column_name) into leaked
    from information_schema.columns c
   where c.table_name = 'appointments_without_pay'
     and c.column_name in ('salary_amount', 'salary_currency', 'salary_period');

  if leaked is not null then
    raise exception '081 FAILED: the pay-free view carries % — it is no longer pay-free, and '
                    'a salary would be delivered to every browser that opens the register',
                    leaked;
  end if;
end $$;


do $$
begin
  raise notice '081 OK: the pay-free view carries every particular the Draft & submit screen '
               'asks for, so it loads for an HR officer instead of coming back empty';
  raise notice '081 OK: and it still carries no salary — only whether there is one';
end $$;
