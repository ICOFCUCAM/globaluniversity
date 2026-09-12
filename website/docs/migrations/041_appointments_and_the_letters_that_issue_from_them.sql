-- ===========================================================================
-- 041 — AN APPOINTMENT IS A RECORD; THE LETTER IS GENERATED FROM IT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- The University gets somewhere to record that it has appointed somebody. It
-- had nowhere. `lecturers` holds a name, a department and a specialisation —
-- who teaches what — and `profiles` holds an account. Neither records a
-- POSITION, a start date, an employment type, a probation period, a place of
-- duty, a reporting officer or a salary, which means every appointment letter
-- this University has ever sent was typed by hand into a word processor from
-- facts that lived only in the letter.
--
-- That is the fault. Not that the letters were manual — that the RECORD was the
-- letter. Ask the system today who reports to whom, whose probation ends this
-- month, or what somebody was actually appointed as, and it cannot answer,
-- because the answer is in a .docx on somebody's laptop.
--
-- ---------------------------------------------------------------------------
-- SO THE LETTER BECOMES AN OUTPUT, NOT A SOURCE
-- ---------------------------------------------------------------------------
--
--   appointments            the facts, structured, one row per appointment
--   appointment_letters     what was generated from them, versioned and sealed
--   appointment_events      who did what to it, append-only
--
-- A letter is regenerated from the record, never edited. Editing a generated
-- document is how a letter comes to say something the register does not, and
-- then the University has two answers to the same question with a signature on
-- the wrong one.
--
-- ---------------------------------------------------------------------------
-- THE SAME SEPARATION AS EVERYTHING ELSE
-- ---------------------------------------------------------------------------
--
-- Drafted by one person, AUTHORISED by another, then issued. 005 requires it of
-- a certificate design, 009 of a grade, 014 of a social post, 038 of an
-- announcement. An appointment letter commits the University to paying
-- somebody; one person drafting, authorising and sending it alone is a larger
-- version of the thing every one of those rules exists to prevent.
--
-- ---------------------------------------------------------------------------
-- AND THE SALARY IS NOT VISIBLE TO EVERYONE WHO CAN SEE THE APPOINTMENT
-- ---------------------------------------------------------------------------
--
-- Section 5 puts remuneration behind its own view and its own roles. Who holds
-- which post is ordinary institutional information; what they are paid is not,
-- and a single RLS policy over the whole row would have made the second as
-- visible as the first to every administrator in the University.
-- ===========================================================================


-- ===========================================================================
-- 1. THE APPOINTMENT
-- ===========================================================================

create table if not exists appointments (
  id             uuid primary key default gen_random_uuid(),

  -- ---- Who ---------------------------------------------------------------
  --
  -- The account where there is one, and the name always. An appointment is
  -- often made before the person has a login, and a record that cannot exist
  -- until IT has created an account is a record that gets kept in a
  -- spreadsheet until then.
  person_id      uuid references auth.users (id) on delete restrict,
  lecturer_id    uuid references lecturers (id) on delete set null,

  full_name      text not null check (length(btrim(full_name)) >= 3),
  email          text,
  phone          text,
  postal_address text,

  -- ---- What ---------------------------------------------------------------
  position_title text not null check (length(btrim(position_title)) >= 3),
  department_id  uuid references departments (id) on delete set null,
  -- The faculty or unit as written on the letter, for a unit that is not a
  -- department row. Kept beside the id rather than instead of it: the id is
  -- what a report joins on and the text is what the letter prints.
  unit_name      text,

  -- A CLOSED VOCABULARY. "Employment type" written free-hand produces
  -- "Full time", "full-time", "FT" and "Permanent (full time)" inside a year,
  -- and then nothing can be counted.
  employment_type text not null
                    check (employment_type in
                      ('permanent', 'fixed-term', 'part-time', 'visiting',
                       'adjunct', 'honorary', 'secondment', 'probationary')),

  -- ---- When ---------------------------------------------------------------
  start_date     date not null,
  -- Null where the appointment is open-ended. A fixed-term appointment with no
  -- end date is the constraint below refusing to let that happen silently.
  end_date       date,
  -- The date the appointment takes effect, where it differs from the start
  -- date — a promotion effective from the first of the month, taken up later.
  effective_date date,

  probation_months integer check (probation_months is null or probation_months between 0 and 36),

  -- ---- Where and to whom --------------------------------------------------
  place_of_duty  text,
  -- The person the appointee reports to. A uuid where they are on the system
  -- and a name always, for the same reason as the appointee.
  reports_to_id  uuid references auth.users (id) on delete set null,
  reports_to_name text,

  -- ---- Terms --------------------------------------------------------------
  --
  -- REMUNERATION IS OPTIONAL, because an honorary appointment has none and a
  -- record that demands a number would have somebody type a zero — which reads
  -- as "paid nothing" rather than "not a paid post".
  salary_amount  numeric(14,2) check (salary_amount is null or salary_amount >= 0),
  salary_currency text check (salary_currency is null or
                     salary_currency in ('FCFA', 'USD', 'EUR', 'GBP', 'NGN')),
  salary_period  text check (salary_period is null or
                     salary_period in ('hour', 'month', 'year', 'session')),

  terms          text,

  -- ---- The workflow -------------------------------------------------------
  status         text not null default 'draft'
                   check (status in ('draft', 'submitted', 'authorized', 'issued',
                                     'declined', 'withdrawn', 'ended')),

  drafted_by     uuid references auth.users (id) on delete restrict,
  authorized_by  uuid references auth.users (id) on delete restrict,
  authorized_at  timestamptz,
  issued_at      timestamptz,

  -- Why an appointment was withdrawn before it was taken up, or why it ended.
  closed_reason  text,
  closed_at      timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists appointments_status_idx on appointments (status, start_date);
create index if not exists appointments_person_idx on appointments (person_id);
create index if not exists appointments_probation_idx
  on appointments (start_date) where probation_months is not null;

do $$
begin
  -- THE AUTHORISER IS NOT THE DRAFTER. An appointment letter commits the
  -- University to paying somebody. One person drafting, authorising and
  -- sending it alone is the larger version of everything 005, 009, 014 and 038
  -- exist to prevent.
  if not exists (select 1 from pg_constraint where conname = 'appointments_second_pair_of_eyes') then
    alter table appointments add constraint appointments_second_pair_of_eyes
      check (authorized_by is null or drafted_by is null or authorized_by <> drafted_by);
  end if;

  -- A FIXED TERM HAS A TERM. Without this, 'fixed-term' with no end date is a
  -- permanent appointment wearing the wrong label, and nobody finds out until
  -- somebody asks when it ends.
  if not exists (select 1 from pg_constraint where conname = 'appointments_fixed_term_ends') then
    alter table appointments add constraint appointments_fixed_term_ends
      check (employment_type <> 'fixed-term' or end_date is not null);
  end if;

  -- AND IT ENDS AFTER IT STARTS.
  if not exists (select 1 from pg_constraint where conname = 'appointments_dates_run_forward') then
    alter table appointments add constraint appointments_dates_run_forward
      check (end_date is null or end_date > start_date);
  end if;

  -- A SALARY IS A NUMBER, A CURRENCY AND A PERIOD, or it is none of them.
  -- "450,000" on a letter with no currency and no period is not a figure
  -- anybody can rely on, and it is the kind of omission that reaches a
  -- signature because each half looks complete on its own.
  if not exists (select 1 from pg_constraint where conname = 'appointments_salary_is_complete') then
    alter table appointments add constraint appointments_salary_is_complete
      check (
        (salary_amount is null and salary_currency is null and salary_period is null)
        or (salary_amount is not null and salary_currency is not null
            and salary_period is not null)
      );
  end if;

  -- AN AUTHORISED APPOINTMENT NAMES ITS AUTHORISER AND THE MOMENT.
  if not exists (select 1 from pg_constraint where conname = 'appointments_authority_recorded') then
    alter table appointments add constraint appointments_authority_recorded
      check (status not in ('authorized', 'issued')
             or (authorized_by is not null and authorized_at is not null));
  end if;

  -- Closing an appointment says why, like every other closure in this system.
  if not exists (select 1 from pg_constraint where conname = 'appointments_closure_explained') then
    alter table appointments add constraint appointments_closure_explained
      check (status not in ('declined', 'withdrawn', 'ended')
             or (closed_reason is not null and length(btrim(closed_reason)) >= 10));
  end if;
end $$;


-- ===========================================================================
-- 2. THE LETTERS GENERATED FROM IT
-- ===========================================================================
--
-- VERSIONED, NOT OVERWRITTEN. A letter is regenerated when the appointment
-- changes — a corrected start date, a revised salary — and the superseded one
-- stays. Somebody holds a copy of it; if the University cannot produce what it
-- actually sent, the copy in their hand is the only version of that fact.
--
-- 031 built exactly this for admission letters and this follows it, including
-- the two things it learned: the HTML AS SENT is stored rather than
-- regenerated on demand, and a letter that failed to send is in an outbox
-- rather than gone.

create table if not exists appointment_letters (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,

  -- THE REFERENCE ON THE PAGE. What somebody quotes on the telephone, and what
  -- a filing system is built on. Unique across the University, not per
  -- appointment: two letters with one reference is the failure a reference
  -- exists to prevent.
  reference      text not null unique,

  version        integer not null default 1 check (version >= 1),

  -- The date the letter bears, which is what its seal was computed over.
  issued_on      date not null,

  /** Whether it went out with a seal. False when CREDENTIAL_SECRET was absent. */
  sealed         boolean not null default false,
  /** The verification code printed on the page, spoken over a telephone. */
  seal_code      text,

  -- The document itself, as the appointee received it.
  html           text not null,

  -- WHO SIGNED IT. Not the person who pressed the button — the office whose
  -- name and signature appear on the page, which is a different thing and is
  -- the one a recipient relies on.
  signatory_name text,
  signatory_role text,

  to_email       text,
  delivery       text not null default 'pending'
                   check (delivery in ('pending', 'sent', 'failed')),
  delivery_detail text,
  attempts       integer not null default 0,

  -- Set when a later version replaces this one. The row stays.
  superseded_at  timestamptz,
  superseded_by  uuid references appointment_letters (id) on delete set null,

  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (appointment_id, version)
);

create index if not exists appointment_letters_appointment_idx
  on appointment_letters (appointment_id, version desc);
create index if not exists appointment_letters_current_idx
  on appointment_letters (appointment_id) where superseded_at is null;

-- ONE CURRENT LETTER PER APPOINTMENT. Two letters both claiming to be the one
-- in force is the state a version number exists to make impossible.
create unique index if not exists appointment_letters_one_current_idx
  on appointment_letters (appointment_id) where superseded_at is null;

-- A LETTER IS NEVER EDITED. It is superseded by a new version generated from
-- the record. Editing a generated document is how a letter comes to say
-- something the register does not, and then the University has two answers to
-- the same question with a signature on the wrong one.
create or replace function refuse_letter_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delivery is not the letter. Recording that it sent, failed, or was
  -- superseded changes what happened TO the document, not what it says.
  if new.html = old.html
     and new.reference = old.reference
     and new.version = old.version
     and new.issued_on = old.issued_on
     and new.seal_code is not distinct from old.seal_code
     and new.signatory_name is not distinct from old.signatory_name then
    return new;
  end if;
  raise exception
    'An appointment letter cannot be edited. Correct the appointment and generate a new '
    'version: somebody is holding the document as it was sent, and a letter that says one '
    'thing on their copy and another in the register is worse than no register.'
    using errcode = 'check_violation';
end $$;

drop trigger if exists appointment_letters_no_edit on appointment_letters;
create trigger appointment_letters_no_edit
  before update on appointment_letters
  for each row execute function refuse_letter_edit();


-- ===========================================================================
-- 3. THE HISTORY
-- ===========================================================================

create table if not exists appointment_events (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,

  event          text not null check (event in (
                   'DRAFTED', 'EDITED', 'SUBMITTED_FOR_AUTHORITY', 'AUTHORIZED', 'RETURNED',
                   'LETTER_GENERATED', 'LETTER_ISSUED', 'LETTER_DELIVERY_FAILED',
                   'LETTER_SUPERSEDED', 'DECLINED', 'WITHDRAWN', 'ENDED',
                   'ADMINISTRATIVE_OVERRIDE')),

  actor_id       uuid references auth.users (id) on delete set null,
  actor_email    text,
  actor_role     text,

  previous_state text,
  new_state      text,
  detail         text,
  metadata       jsonb,

  at             timestamptz not null default now()
);

create index if not exists appointment_events_appointment_idx
  on appointment_events (appointment_id, at);

create or replace function refuse_appointment_history_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'The appointment history is append-only. % is not permitted: this is the record of who '
    'the University appointed and on whose authority.', tg_op
    using errcode = 'check_violation';
end $$;

drop trigger if exists appointment_events_append_only on appointment_events;
create trigger appointment_events_append_only
  before update or delete on appointment_events
  for each row execute function refuse_appointment_history_edit();


-- ===========================================================================
-- 4. WHO CAN READ WHAT
-- ===========================================================================

alter table appointments enable row level security;
alter table appointment_letters enable row level security;
alter table appointment_events enable row level security;

-- THE APPOINTEE READS THEIR OWN. Somebody should not have to write to Human
-- Resources to find out what they were appointed as.
drop policy if exists appointments_read on appointments;
create policy appointments_read on appointments
  for select using (
    person_id = auth.uid()
    or auth_role() in ('superadmin', 'admin', 'registrar')
  );

drop policy if exists appointment_letters_read on appointment_letters;
create policy appointment_letters_read on appointment_letters
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar')
    or exists (select 1 from appointments a
                where a.id = appointment_letters.appointment_id and a.person_id = auth.uid())
  );

drop policy if exists appointment_events_read on appointment_events;
create policy appointment_events_read on appointment_events
  for select using (auth_role() in ('superadmin', 'admin', 'registrar'));

-- No write policy on any of the three. Every change goes through
-- /api/appointments, which checks the capability against the role in the
-- database and writes the history in the same breath.


-- ===========================================================================
-- 5. THE SALARY IS NOT ORDINARY INSTITUTIONAL INFORMATION
-- ===========================================================================
--
-- WHO HOLDS WHICH POST IS. What they are paid is not, and one policy over the
-- whole row makes the second as visible as the first to every administrator in
-- the University — which is how a salary ends up known to people who had no
-- business knowing it and no idea they were being shown it.
--
-- So the view below is what most screens read. It carries the appointment
-- without the money. The columns themselves stay restricted to the roles that
-- actually set pay.

create or replace view appointments_without_pay
with (security_invoker = true) as
select id, person_id, lecturer_id, full_name, email, phone,
       position_title, department_id, unit_name, employment_type,
       start_date, end_date, effective_date, probation_months,
       place_of_duty, reports_to_id, reports_to_name,
       -- SAID, NOT SHOWN. A screen needs to know a figure exists — to print
       -- "salary as set out in your letter" rather than nothing — without
       -- being told what it is.
       (salary_amount is not null) as is_paid,
       status, drafted_by, authorized_by, authorized_at, issued_at,
       created_at, updated_at
  from appointments;

comment on view appointments_without_pay is
  'Every appointment without the remuneration. What somebody holds is ordinary '
  'institutional information; what they are paid is not, and a single policy over '
  'the table would make the second as visible as the first.';


-- ===========================================================================
-- 6. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  l_id uuid;
  someone uuid;
  other uuid;
  later_version_sql text;
begin
  -- ---------------------------------------------------------------------
  -- THE INSERT FOR A VERSION AFTER THE FIRST, BUILT TO MATCH THE SCHEMA.
  --
  -- 042 adds `supersedes_reason` and requires it on any version above 1 — a
  -- revised letter has to say why somebody is holding a second one. On a FIRST
  -- run of the bundle that column does not exist yet, because 041 runs before
  -- 042; on a SECOND run it does, and the constraint refuses an insert without
  -- it. Naming the column unconditionally fails the first case, omitting it
  -- fails the second.
  --
  -- Found by running RUN-ALL.sql twice, which is the only way either half of
  -- this shows up.
  -- ---------------------------------------------------------------------
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'appointment_letters'
                and column_name = 'supersedes_reason') then
    later_version_sql :=
      'insert into appointment_letters (appointment_id, reference, version, issued_on, html, '
      || 'supersedes_reason) values ($1, $2, $3, current_date, ''<p>A later letter.</p>'', '
      || '''The start date was corrected.'')';
  else
    later_version_sql :=
      'insert into appointment_letters (appointment_id, reference, version, issued_on, html) '
      || 'values ($1, $2, $3, current_date, ''<p>A later letter.</p>'')';
  end if;

  select id into someone from auth.users limit 1;
  if someone is null then
    raise notice '041: no accounts yet, so the rules could not be exercised against one';
    return;
  end if;
  select id into other from auth.users where id <> someone limit 1;

  begin
    insert into appointments
      (full_name, position_title, employment_type, start_date, drafted_by, status)
    values ('A Specimen Appointee', 'Lecturer in Theology', 'permanent',
            date '2026-10-01', someone, 'draft')
    returning id into a_id;

    -- ---- THE DRAFTER CANNOT AUTHORISE THEIR OWN --------------------------
    -- An appointment letter commits the University to paying somebody.
    refused := false;
    begin
      update appointments set status = 'authorized', authorized_by = someone,
                              authorized_at = now() where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: the person who drafted an appointment authorised it. The '
                      'second pair of eyes is not a rule, it is a comment.';
    end if;

    -- ---- A FIXED TERM HAS A TERM -----------------------------------------
    -- Otherwise it is a permanent appointment wearing the wrong label, and
    -- nobody finds out until somebody asks when it ends.
    refused := false;
    begin
      update appointments set employment_type = 'fixed-term' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: a fixed-term appointment was recorded with no end date';
    end if;

    -- ---- AND IT ENDS AFTER IT STARTS -------------------------------------
    refused := false;
    begin
      update appointments set end_date = date '2025-01-01' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: an appointment ended before it began';
    end if;

    -- ---- A SALARY IS A NUMBER, A CURRENCY AND A PERIOD --------------------
    -- "450,000" with no currency and no period is not a figure anybody can
    -- rely on, and each half looks complete on its own, which is how the
    -- omission reaches a signature.
    --
    -- THE TRIGGER 047 ADDS IS STOOD DOWN FOR THIS ONE CHECK. It fills in
    -- dollars and a monthly period when an amount arrives with neither, which
    -- is the University's ruling and is exactly what makes this constraint
    -- stop firing on a database that has had 047. Running the two in order
    -- therefore reported "041 FAILED" on the SECOND pass and not the first —
    -- the constraint had not gone anywhere, but nothing could reach it.
    --
    -- Disabled inside the rolled-back block, so it is disabled for the length
    -- of this proof and for nothing else.
    if exists (select 1 from pg_trigger
                where tgname = 'appointments_money_is_in_dollars'
                  and tgrelid = 'appointments'::regclass) then
      alter table appointments disable trigger appointments_money_is_in_dollars;
    end if;

    refused := false;
    begin
      update appointments set salary_amount = 450000 where id = a_id;
    exception when others then refused := true;
    end;

    if exists (select 1 from pg_trigger
                where tgname = 'appointments_money_is_in_dollars'
                  and tgrelid = 'appointments'::regclass) then
      alter table appointments enable trigger appointments_money_is_in_dollars;
    end if;
    if not refused then
      raise exception '041 FAILED: a salary was recorded with no currency and no period';
    end if;

    update appointments
       set salary_amount = 450000, salary_currency = 'FCFA', salary_period = 'month'
     where id = a_id;

    -- ---- AND IT IS NOT IN THE ORDINARY VIEW ------------------------------
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'appointments_without_pay'
         and column_name in ('salary_amount', 'salary_currency', 'salary_period')
    ) then
      raise exception '041 FAILED: the pay-free view carries the pay. Who holds which post is '
                      'ordinary information; what they are paid is not.';
    end if;
    if not (select is_paid from appointments_without_pay where id = a_id) then
      raise exception '041 FAILED: the view cannot even say that a salary exists, so a letter '
                      'cannot say "as set out above" without being shown the figure';
    end if;

    -- ---- A CLOSURE SAYS WHY ----------------------------------------------
    refused := false;
    begin
      update appointments set status = 'withdrawn' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: an appointment was withdrawn with no reason recorded';
    end if;

    -- ---- A LETTER CANNOT BE EDITED ---------------------------------------
    --
    -- The references below are APT-YYYY-NNNN. 041 shipped with IGUC/HR/2026/…
    -- and 042 later constrained the shape, so on any second run of the bundle
    -- this proof was refused by a rule added after it. Found by running
    -- RUN-ALL.sql twice; the shape 042 requires is used from the start.
    insert into appointment_letters
      (appointment_id, reference, issued_on, html, created_by)
    values (a_id, 'APT-2026-9001', current_date, '<p>The letter as sent.</p>', someone)
    returning id into l_id;

    refused := false;
    begin
      update appointment_letters set html = '<p>Something else entirely.</p>' where id = l_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: an issued letter was rewritten. Somebody is holding the '
                      'document as it was sent.';
    end if;

    -- …but recording that it was delivered is not editing it.
    --
    -- WRITTEN TO MATCH WHICHEVER SCHEMA IS PRESENT. 044 later requires a
    -- delivered letter to record WHEN, and a letter with attempts to record
    -- when they happened — so this update was refused on any second run of the
    -- bundle, and could not name the columns unconditionally because on a
    -- FIRST run they do not exist yet. Found by running RUN-ALL.sql twice.
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'appointment_letters'
                  and column_name = 'delivered_at') then
      execute 'update appointment_letters set delivery = ''sent'', attempts = 1, '
              || 'delivered_at = now(), last_attempt_at = now() where id = $1' using l_id;
    else
      update appointment_letters set delivery = 'sent', attempts = 1 where id = l_id;
    end if;

    -- ---- TWO LETTERS CANNOT BOTH BE THE CURRENT ONE -----------------------
    refused := false;
    begin
      execute later_version_sql using a_id, 'APT-2026-9002', 2;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: two letters both claim to be the one in force';
    end if;

    -- Superseding the first makes room for the second, which is the point of
    -- a version rather than an edit.
    update appointment_letters set superseded_at = now() where id = l_id;
    execute later_version_sql using a_id, 'APT-2026-9002', 2;

    -- ---- A REFERENCE IS UNIQUE ACROSS THE UNIVERSITY ----------------------
    refused := false;
    begin
      execute later_version_sql using a_id, 'APT-2026-9002', 3;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: two letters carry one reference, which is the single thing '
                      'a reference exists to prevent';
    end if;

    -- ---- THE HISTORY IS APPEND-ONLY ---------------------------------------
    insert into appointment_events (appointment_id, event, new_state) values (a_id, 'DRAFTED', 'draft');
    refused := false;
    begin
      update appointment_events set detail = 'something else' where appointment_id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '041 FAILED: the appointment history could be rewritten';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '041 OK: a drafter cannot authorise their own appointment, a fixed term has a '
               'term, dates run forward, a salary is a figure with a currency and a period and '
               'is absent from the ordinary view, a closure states a reason, an issued letter '
               'cannot be edited or duplicated, a reference is unique, and the history is '
               'append-only';
end $$;


-- ===========================================================================
-- 7. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- Every appointment, without the pay.
select full_name, position_title, employment_type, start_date, end_date,
       status, is_paid
  from appointments_without_pay
 order by start_date desc;

-- PROBATIONS ENDING IN THE NEXT SIXTY DAYS. The question the University could
-- not ask at all before today, because the answer was in a word processor file.
select full_name, position_title, start_date,
       (start_date + (probation_months || ' months')::interval)::date as probation_ends
  from appointments
 where probation_months is not null
   and status = 'issued'
   and (start_date + (probation_months || ' months')::interval)::date
       between current_date and current_date + 60
 order by 4;

-- FIXED TERMS ENDING IN THE NEXT NINETY DAYS.
select full_name, position_title, end_date
  from appointments
 where end_date is not null and status = 'issued'
   and end_date between current_date and current_date + 90
 order by end_date;

-- The letters, current version first, and which were superseded.
select a.full_name, l.reference, l.version, l.issued_on, l.sealed, l.delivery,
       (l.superseded_at is null) as is_current
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
 order by a.full_name, l.version desc;

-- LETTERS THAT DID NOT REACH ANYBODY. Generated, sealed, and sitting in the
-- outbox. Each is somebody who has not been told they were appointed.
select a.full_name, a.email, l.reference, l.attempts, l.delivery_detail
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
 where l.delivery = 'failed' and l.superseded_at is null
 order by l.created_at desc;
