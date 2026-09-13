-- ===========================================================================
-- 050 — ACCEPTANCE, THE ACTIVATION RULE, AND THE REST OF THE AUDIT TRAIL
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT THE AUDIT FOUND, AND WHAT THIS FIXES
-- ---------------------------------------------------------------------------
--
-- The University asked for a full implementation audit before more code. Of the
-- eleven links it listed for an appointment, nine already existed: person,
-- position, department, initiator, approver, issuer, documents, versions and
-- audit events. TWO DID NOT.
--
-- 1. ACCEPTANCE WAS A TIMESTAMP. `appointments.accepted_at` said WHEN somebody
--    accepted and nothing else — not who, and not WHICH VERSION of the letter
--    they were looking at. An appointee who accepted version 1 and was later
--    sent version 2 with a different salary had, on the record, simply
--    "accepted". That is the fact a dispute turns on.
--
-- 2. FACULTY WAS NOT RECORDED. A department carries one; an appointment to a
--    post that is not in a department carried nothing.
--
-- AND THE AUDIT VOCABULARY WAS SHORT. Of the fifteen actions the University
-- named, `appointment_events` could record nine. Letter viewed, letter
-- downloaded, email sent, email failed, appointment accepted and appointment
-- renewed had no event to be recorded as — so the trail could not show them
-- even though the code was willing to write them.
--
-- ---------------------------------------------------------------------------
-- AND THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- WHEN DOES SOMEBODY BECOME A MEMBER OF STAFF? The University said to keep
-- approved, issued, accepted and active distinct — they now are — and to make
-- the rule configurable rather than assumed.
--
-- `institutional_settings.staff_activation_point` is that rule, seeded to
-- 'accepted'. THIS IS A DEFAULT AND NOT A DECISION: it is the most cautious of
-- the three, because a staff record created on issue exists for somebody who
-- may yet decline. Change it to 'issued' or 'start_date' if the University
-- means something else; the trigger reads the setting rather than hard-coding
-- any of them.
-- ===========================================================================


-- ===========================================================================
-- 1. THE ACCEPTANCE
-- ===========================================================================
--
-- ITS OWN TABLE, NOT A COLUMN. An acceptance is an act by the APPOINTEE — the
-- only act in this whole workflow that is not the University's — and it is the
-- one a dispute turns on. A row can say who, when, from where, and which
-- version of which document they were answering.

create table if not exists appointment_acceptances (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,

  -- WHICH DOCUMENT THEY WERE LOOKING AT. Not a copy of the reference for
  -- convenience: the letter they read is the letter they agreed to, and an
  -- amendment issued afterwards does not retroactively become the thing they
  -- accepted.
  letter_id      uuid not null references appointment_letters (id) on delete restrict,
  reference      text not null,
  version        integer not null check (version >= 1),

  decision       text not null check (decision in ('accepted', 'declined')),

  -- WHO. The appointee's own account where they have one, and their typed name
  -- either way — an appointee accepting by a link in an email may not have a
  -- portal account yet, and refusing the acceptance until they do would mean
  -- the University could not record what actually happened.
  accepted_by    uuid references auth.users (id) on delete set null,
  accepted_name  text not null check (length(btrim(accepted_name)) >= 3),
  accepted_email text,

  -- A DECLINE SAYS WHY, like every other closure in this system.
  reason         text,

  at             timestamptz not null default now()
);

create index if not exists appointment_acceptances_appointment_idx
  on appointment_acceptances (appointment_id, at);

do $$
begin
  -- A DECLINE STATES A REASON.
  if not exists (select 1 from pg_constraint where conname = 'appointment_acceptances_decline_explained') then
    alter table appointment_acceptances add constraint appointment_acceptances_decline_explained
      check (decision <> 'declined' or (reason is not null and length(btrim(reason)) >= 10));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ONE STANDING ANSWER PER APPOINTMENT.
--
-- A partial unique index rather than a plain one: an appointee may decline and
-- the University may later reissue an amended letter which they accept, and
-- both rows are the truth. What must not happen is two LIVE answers at once.
-- Superseded answers are marked rather than deleted.
-- ---------------------------------------------------------------------------
alter table appointment_acceptances
  add column if not exists superseded_at timestamptz;

create unique index if not exists appointment_acceptances_one_standing_idx
  on appointment_acceptances (appointment_id) where superseded_at is null;

-- ---------------------------------------------------------------------------
-- AN ACCEPTANCE IS OF AN ISSUED LETTER, and of THE CURRENT one.
--
-- Accepting a superseded version is the failure this exists to catch: the
-- appointee opens an old email, clicks accept, and the register records them as
-- having agreed to terms the University has already replaced.
-- ---------------------------------------------------------------------------
create or replace function refuse_acceptance_of_a_stale_letter() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  l record;
begin
  select * into l from appointment_letters where id = new.letter_id;
  if l is null then
    raise exception 'No such letter.' using errcode = 'check_violation';
  end if;
  if l.appointment_id <> new.appointment_id then
    raise exception 'That letter belongs to a different appointment.'
      using errcode = 'check_violation';
  end if;
  if l.superseded_at is not null then
    raise exception
      'This letter has been superseded. The appointee is answering a version the University '
      'has already replaced — send them the current one rather than recording an agreement '
      'to terms that no longer stand.'
      using errcode = 'check_violation';
  end if;
  if not exists (select 1 from appointments a
                  where a.id = new.appointment_id and a.issued_at is not null) then
    raise exception
      'This appointment has not been issued, so there is nothing for the appointee to have '
      'accepted.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists appointment_acceptances_of_a_current_letter on appointment_acceptances;
create trigger appointment_acceptances_of_a_current_letter
  before insert on appointment_acceptances
  for each row execute function refuse_acceptance_of_a_stale_letter();

alter table appointment_acceptances enable row level security;

drop policy if exists appointment_acceptances_read on appointment_acceptances;
create policy appointment_acceptances_read on appointment_acceptances
  for select to authenticated
  using (exists (select 1 from appointments a where a.id = appointment_acceptances.appointment_id));


-- ===========================================================================
-- 2. THE FACULTY
-- ===========================================================================
--
-- FREE TEXT AGAINST THE UNIVERSITY'S STATED STRUCTURE, matching `positions`.
-- There is no faculties table — `departments.faculty` is text too — and
-- inventing one here would mean this migration asserting a list of the
-- University's faculties, which is not a migration's place.

alter table appointments
  add column if not exists faculty text;

comment on column appointments.faculty is
  'The faculty or school the post sits in. Text, matching departments.faculty and '
  'positions.faculty — the University states its faculties in its own content, not in a '
  'table a migration invented.';


-- ===========================================================================
-- 3. THE REST OF THE AUDIT VOCABULARY
-- ===========================================================================
--
-- The six the University named that could not be recorded. Note what is NOT
-- here: nothing that removes a line. The history has no delete path and no
-- capability unlocks one.

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'appointment_events'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%LETTER_SUPERSEDED%'
   limit 1;

  if con is not null then
    execute format('alter table appointment_events drop constraint %I', con);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'appointment_events_vocabulary') then
    alter table appointment_events add constraint appointment_events_vocabulary
      check (event in (
        'DRAFTED', 'EDITED', 'REVIEWED', 'SUBMITTED_FOR_AUTHORITY', 'AUTHORIZED', 'RETURNED',
        'LETTER_GENERATED', 'LETTER_ISSUED', 'LETTER_VIEWED', 'LETTER_DOWNLOADED',
        'LETTER_SUPERSEDED', 'EMAIL_SENT', 'EMAIL_FAILED', 'LETTER_DELIVERY_FAILED',
        'ACCEPTED', 'DECLINED', 'RENEWED', 'STAFF_ACTIVATED',
        'WITHDRAWN', 'ENDED', 'ADMINISTRATIVE_OVERRIDE'));
  end if;
end $$;


-- ===========================================================================
-- 4. WHEN SOMEBODY BECOMES A MEMBER OF STAFF
-- ===========================================================================
--
-- The University's instruction: keep approved, issued, accepted and active
-- distinct, and CONFIGURE the point at which the employee record becomes
-- active. So the rule is a row, not a line of code.

create table if not exists institutional_settings (
  key         text primary key,
  value       text not null,
  -- WHAT THIS SETTING MEANS, in the table, so that somebody changing it can
  -- read what they are changing without finding the migration that made it.
  description text,
  -- THE CHOICES, so a screen can offer them and a typo cannot become a policy.
  allowed     text[],
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'institutional_settings_value_is_allowed') then
    alter table institutional_settings add constraint institutional_settings_value_is_allowed
      check (allowed is null or value = any (allowed));
  end if;
end $$;

insert into institutional_settings (key, value, description, allowed) values
  ('staff_activation_point', 'accepted',
   'When an appointee becomes a member of staff. '
   '"issued" — as soon as the letter goes out, which creates a staff record for somebody who '
   'may yet decline. '
   '"accepted" — when the appointee has said yes. The cautious default, and what this is '
   'seeded to. '
   '"start_date" — not until the day the appointment begins, which is the strictest and means '
   'a new lecturer has no portal account until their first day.',
   array['issued', 'accepted', 'start_date'])
on conflict (key) do nothing;

alter table institutional_settings enable row level security;

drop policy if exists institutional_settings_read on institutional_settings;
create policy institutional_settings_read on institutional_settings
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- AND THE RULE IS ENFORCED, NOT ADVISORY.
--
-- 042 refused a staff record whose appointment had not been ISSUED. That was
-- the right floor and it is not the University's rule. This reads the setting.
-- ---------------------------------------------------------------------------
create or replace function staff_activation_is_permitted() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rule text;
  a record;
begin
  if new.staff_record_id is null or old.staff_record_id is not null then
    return new;
  end if;

  select value into rule from institutional_settings where key = 'staff_activation_point';
  rule := coalesce(rule, 'accepted');

  select * into a from appointments where id = new.id;

  if rule = 'issued' then
    if new.issued_at is null then
      raise exception 'This appointment has not been issued, so nobody can be made staff from it.'
        using errcode = 'check_violation';
    end if;

  elsif rule = 'accepted' then
    if not exists (select 1 from appointment_acceptances ac
                    where ac.appointment_id = new.id
                      and ac.decision = 'accepted' and ac.superseded_at is null) then
      raise exception
        'The University''s rule is that a staff record follows ACCEPTANCE, and this appointee '
        'has not accepted. Change institutional_settings.staff_activation_point if the '
        'University means something else — do not work around it, because a staff record for '
        'somebody who later declines is a person the system says works here.'
        using errcode = 'check_violation';
    end if;

  elsif rule = 'start_date' then
    if new.start_date is null or new.start_date > current_date then
      raise exception
        'The University''s rule is that a staff record begins on the start date, and this '
        'appointment starts on %.', coalesce(new.start_date::text, 'no stated date')
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists appointments_staff_activation_rule on appointments;
create trigger appointments_staff_activation_rule
  before update on appointments
  for each row execute function staff_activation_is_permitted();


-- ===========================================================================
-- 5. WHAT THE UNIVERSITY IS WAITING ON
-- ===========================================================================

create or replace view appointments_awaiting_acceptance
with (security_invoker = true) as
  select a.id,
         a.full_name,
         a.position_title,
         a.unit_name,
         a.issued_at,
         l.reference,
         l.version,
         -- HOW LONG IT HAS BEEN SITTING. The number somebody acts on: an offer
         -- unanswered for six weeks is a post the University thinks is filled.
         (current_date - a.issued_at::date) as days_waiting
    from appointments a
    join appointment_letters l
      on l.appointment_id = a.id and l.superseded_at is null
   where a.issued_at is not null
     and a.status = 'issued'
     and not exists (select 1 from appointment_acceptances ac
                      where ac.appointment_id = a.id and ac.superseded_at is null);


-- ===========================================================================
-- 6. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  other uuid;
  a_id uuid;
  l1 uuid;
  l2 uuid;
  staff uuid;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '050: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    insert into appointments
      (full_name, position_title, unit_name, faculty, employment_type, start_date, terms,
       status, drafted_by, authorized_by, authorized_at)
    values ('A Specimen Appointee', 'Lecturer', 'Department of Theology',
            'Faculty of Theology', 'permanent', current_date + 30, 'The terms.',
            'approved', someone, other, now())
    returning id into a_id;

    -- ---- NOTHING IS ACCEPTED BEFORE IT IS ISSUED --------------------------
    insert into appointment_letters (appointment_id, reference, issued_on, html)
    values (a_id, 'APT-2026-9050', current_date, '<p>Version one.</p>')
    returning id into l1;

    refused := false;
    begin
      insert into appointment_acceptances
        (appointment_id, letter_id, reference, version, decision, accepted_name)
      values (a_id, l1, 'APT-2026-9050', 1, 'accepted', 'A Specimen Appointee');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: an appointee accepted a letter that had not been issued';
    end if;

    update appointments set status = 'issued', issued_at = now(), issued_by = other
     where id = a_id;

    -- ---- A DECLINE STATES A REASON ----------------------------------------
    refused := false;
    begin
      insert into appointment_acceptances
        (appointment_id, letter_id, reference, version, decision, accepted_name)
      values (a_id, l1, 'APT-2026-9050', 1, 'declined', 'A Specimen Appointee');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: an appointment was declined for no stated reason';
    end if;

    -- The acceptance itself, of the version they were actually sent.
    insert into appointment_acceptances
      (appointment_id, letter_id, reference, version, decision, accepted_name, accepted_email)
    values (a_id, l1, 'APT-2026-9050', 1, 'accepted', 'A Specimen Appointee',
            'appointee@example.test');

    -- ---- ONE STANDING ANSWER ----------------------------------------------
    refused := false;
    begin
      insert into appointment_acceptances
        (appointment_id, letter_id, reference, version, decision, accepted_name, reason)
      values (a_id, l1, 'APT-2026-9050', 1, 'declined', 'A Specimen Appointee',
              'Changed their mind about the post.');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: one appointment carries two standing answers at once';
    end if;

    -- ---- AND NOBODY ACCEPTS A SUPERSEDED LETTER ---------------------------
    -- The failure this is for: the appointee opens an old email, clicks accept,
    -- and the register records them as agreeing to terms already replaced.
    update appointment_acceptances set superseded_at = now() where appointment_id = a_id;
    update appointment_letters set superseded_at = now() where id = l1;
    insert into appointment_letters
      (appointment_id, reference, version, issued_on, html, kind, supersedes_reason)
    values (a_id, 'APT-2026-9051', 2, current_date, '<p>Version two.</p>', 'amended',
            'The start date moved by one month at the appointee''s request.')
    returning id into l2;

    refused := false;
    begin
      insert into appointment_acceptances
        (appointment_id, letter_id, reference, version, decision, accepted_name)
      values (a_id, l1, 'APT-2026-9050', 1, 'accepted', 'A Specimen Appointee');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: an appointee accepted a letter the University had already '
                      'replaced';
    end if;

    -- ---- THE ACTIVATION RULE IS READ, NOT ASSUMED -------------------------
    -- Seeded to 'accepted'. The standing acceptance was superseded above, so
    -- there is none — and a staff record must therefore be refused.
    insert into lecturers (staff_id, first_name, last_name, email)
    values ('SPEC-050', 'A Specimen', 'Appointee', 'appointee@example.test')
    returning id into staff;

    refused := false;
    begin
      update appointments set staff_record_id = staff, staff_activated_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: somebody became a member of staff with no acceptance '
                      'standing, under a rule that says acceptance is the point';
    end if;

    -- With the answer given against the current letter, it goes.
    insert into appointment_acceptances
      (appointment_id, letter_id, reference, version, decision, accepted_name)
    values (a_id, l2, 'APT-2026-9051', 2, 'accepted', 'A Specimen Appointee');

    update appointments set staff_record_id = staff, staff_activated_at = now()
     where id = a_id;

    -- ---- AND THE RULE IS GENUINELY CONFIGURABLE ---------------------------
    -- Changing the setting changes the behaviour; it is not a comment.
    refused := false;
    begin
      update institutional_settings set value = 'whenever-we-feel-like-it'
       where key = 'staff_activation_point';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: the activation rule accepted a value nobody declared';
    end if;

    update institutional_settings set value = 'start_date'
     where key = 'staff_activation_point';
    update appointments set staff_record_id = null where id = a_id;

    refused := false;
    begin
      update appointments set staff_record_id = staff where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: under a start-date rule, somebody starting in thirty days '
                      'was made staff today';
    end if;

    -- ---- THE SIX EVENTS THAT COULD NOT BE RECORDED ------------------------
    insert into appointment_events (appointment_id, event, actor_id)
    select a_id, e, someone from unnest(array[
      'REVIEWED', 'LETTER_VIEWED', 'LETTER_DOWNLOADED',
      'EMAIL_SENT', 'EMAIL_FAILED', 'ACCEPTED', 'RENEWED', 'STAFF_ACTIVATED'
    ]) as e;

    refused := false;
    begin
      insert into appointment_events (appointment_id, event, actor_id)
      values (a_id, 'QUIETLY_CHANGED', someone);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: the audit trail accepted an event nobody declared';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '050 OK: an acceptance names who, when, and WHICH VERSION of which letter';
  raise notice '050 OK: nothing is accepted before issue, a decline states a reason, and one '
               'appointment carries one standing answer';
  raise notice '050 OK: a superseded letter cannot be accepted';
  raise notice '050 OK: the staff activation point is read from the settings and enforced, and '
               'a value nobody declared is refused';
  raise notice '050 OK: the audit trail can record all fifteen actions and nothing else';
end $$;


-- ===========================================================================
-- 7. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- WHEN SOMEBODY BECOMES STAFF AT THIS UNIVERSITY. Read this and change it if it
-- is not what the University means.
select key, value, allowed from institutional_settings where key = 'staff_activation_point';

-- OFFERS NOBODY HAS ANSWERED. An offer unanswered for six weeks is a post the
-- University believes is filled and a candidate who has taken another job.
select full_name, position_title, reference, version, days_waiting
  from appointments_awaiting_acceptance
 order by days_waiting desc;

-- What the trail can now record, in use.
select event, count(*) as times from appointment_events group by 1 order by 2 desc;
