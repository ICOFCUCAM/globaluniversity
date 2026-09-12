-- ===========================================================================
-- 042 — THE FULL APPOINTMENT LIFECYCLE, AND THE STAFF RECORD IT CREATES
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE LIFECYCLE GETS THE STEPS IT WAS MISSING. 041 stopped at `issued`,
--    which conflated four different facts: the letter exists, the letter was
--    sent, the appointee said yes, and the person is actually in post. They
--    come apart constantly — a letter generated and never sent, a letter sent
--    and never answered, an acceptance for a post that starts in three months
--    — and a single state cannot tell a Head of Department whether anybody is
--    coming.
--
-- 2. AN ISSUED APPOINTMENT CAN BE AMENDED, ON THE RECORD. Salaries are
--    corrected and start dates move. Until now the only options were to edit
--    the record under a letter already in somebody's hands, or to withdraw the
--    whole appointment. Neither is what happened.
--
-- 3. THE STAFF RECORD CANNOT BE CREATED BEFORE THE LETTER IS ISSUED. This is
--    the door this migration closes and it is the point of the whole exercise:
--    the system may not represent somebody as a member of staff until the
--    University has actually appointed them. `lecturers` rows could be created
--    by anybody at any time, for anybody, with no appointment behind them.
--
--    Existing staff are NOT affected — a row created before this ran stays
--    exactly as it is. What is refused is a NEW staff row that claims an
--    appointment which has not reached issuance.
-- ===========================================================================


-- ===========================================================================
-- 1. THE LIFECYCLE
-- ===========================================================================
--
--   draft → submitted → approved → letter_generated → issued → accepted → active
--
-- and, when something changes after issuance:
--
--   issued/accepted/active → amendment_requested → approved → letter_generated
--                          → issued  (as a new version; the old letter stays)
--
-- WHY `approved` AND NOT `authorized`. 041 called it authorized and the
-- University calls it approved. The word on the screen and the word in the
-- column being different is how a question gets asked twice and answered
-- differently, so the column moves. The old value is carried across below.

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'appointments'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%status%' and pg_get_constraintdef(oid) like '%draft%'
   limit 1;
  if con is not null then
    execute format('alter table appointments drop constraint %I', con);
  end if;

  -- The rows 041 wrote, renamed before the new constraint refuses them.
  update appointments set status = 'approved' where status = 'authorized';

  alter table appointments add constraint appointments_status_check
    check (status in (
      'draft',
      'submitted',           -- awaiting approval
      'approved',            -- approved by somebody other than the drafter
      'letter_generated',    -- the document exists; nobody has been sent it
      'issued',              -- the letter has gone to the appointee
      'accepted',            -- the appointee has said yes
      'active',              -- in post
      'amendment_requested', -- something changed after issuance
      'declined',            -- the appointee said no
      'withdrawn',           -- the University withdrew it
      'ended'                -- ran its course, or was ended
    ));
end $$;

alter table appointments
  -- WHEN, NOT WHETHER. Each of these is a fact with a date, and a boolean
  -- would answer "did they accept?" while losing "when?", which is the half
  -- that matters when a start date is disputed.
  add column if not exists letter_generated_at timestamptz,
  add column if not exists accepted_at       timestamptz,
  add column if not exists declined_at       timestamptz,
  add column if not exists activated_at      timestamptz,

  -- ---- The amendment path -------------------------------------------------
  add column if not exists amendment_reason     text,
  add column if not exists amendment_requested_at timestamptz,
  add column if not exists amendment_requested_by uuid references auth.users (id) on delete set null,
  -- HOW MANY TIMES THIS APPOINTMENT HAS BEEN AMENDED. Not decoration: an
  -- appointment amended four times is a different conversation from one
  -- amended once, and the letters alone do not say it because a version can
  -- also be a correction of a typographical error.
  add column if not exists amendments integer not null default 0,

  -- ---- The staff record ---------------------------------------------------
  add column if not exists staff_record_id   uuid references lecturers (id) on delete set null,
  add column if not exists staff_activated_at timestamptz;

do $$
begin
  -- AN AMENDMENT SAYS WHAT CHANGED. "Amended" with no reason is a revised
  -- letter in somebody's hands and no account of why they were sent a second
  -- one.
  if not exists (select 1 from pg_constraint where conname = 'appointments_amendment_explained') then
    alter table appointments add constraint appointments_amendment_explained
      check (status <> 'amendment_requested'
             or (amendment_reason is not null
                 and length(btrim(amendment_reason)) >= 12
                 and amendment_requested_by is not null));
  end if;

  -- ACCEPTANCE, ACTIVATION AND ISSUANCE EACH RECORD THEIR MOMENT.
  if not exists (select 1 from pg_constraint where conname = 'appointments_moments_recorded') then
    alter table appointments add constraint appointments_moments_recorded
      check (
        (status <> 'accepted' or accepted_at is not null)
        and (status <> 'active' or activated_at is not null)
        and (status <> 'declined' or declined_at is not null)
      );
  end if;

  -- ---------------------------------------------------------------------
  -- NOBODY IS IN POST BEFORE THEY WERE APPOINTED.
  --
  -- The ordering constraint that makes the whole workflow mean something: a
  -- record cannot reach `accepted` or `active` without the letter having been
  -- issued first. Without it, an administrator can set somebody active
  -- directly and the approval, the letter and the acceptance become optional
  -- decoration on a path nobody has to walk.
  -- ---------------------------------------------------------------------
  if not exists (select 1 from pg_constraint where conname = 'appointments_issued_before_accepted') then
    alter table appointments add constraint appointments_issued_before_accepted
      check (status not in ('accepted', 'active') or issued_at is not null);
  end if;

  -- A STAFF RECORD IS THE CONSEQUENCE OF AN APPOINTMENT, never its cause.
  if not exists (select 1 from pg_constraint where conname = 'appointments_staff_follows_issuance') then
    alter table appointments add constraint appointments_staff_follows_issuance
      check (staff_record_id is null or issued_at is not null);
  end if;
end $$;

create index if not exists appointments_awaiting_idx
  on appointments (status) where status in ('submitted', 'amendment_requested');
create index if not exists appointments_active_idx
  on appointments (start_date) where status = 'active';


-- ===========================================================================
-- 2. THE REFERENCE THE UNIVERSITY ASKED FOR
-- ===========================================================================
--
-- APT-2026-0042. 041 used IGUC/HR/2026/0001, and slashes in a reference are a
-- small ongoing nuisance: they cannot go in a URL path without escaping, and a
-- verification link is exactly where this will end up.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_reference_shape') then
    alter table appointment_letters add constraint appointment_letters_reference_shape
      check (reference ~ '^APT-[0-9]{4}-[0-9]{4,}$');
  end if;
end $$;

-- WHY A LETTER EXISTS, in its own words: issued, amended, or re-issued. The
-- University asked for a history that reads
--
--   Version 1 — Issued 12 Sept 2026
--   Version 2 — Amended 20 Sept 2026
--   Version 3 — Re-issued 25 Sept 2026
--
-- and "amended" and "re-issued" are not the same thing: the first is a changed
-- appointment, the second is the same appointment sent again.
alter table appointment_letters
  add column if not exists kind text not null default 'issued',
  add column if not exists supersedes_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_kind_check') then
    alter table appointment_letters add constraint appointment_letters_kind_check
      check (kind in ('issued', 'amended', 'reissued'));
  end if;

  -- A LETTER AFTER THE FIRST SAYS WHY THERE IS ANOTHER ONE. Somebody is
  -- holding version 1 and has just received version 2; the register has to be
  -- able to say what changed.
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_later_versions_explained') then
    alter table appointment_letters add constraint appointment_letters_later_versions_explained
      check (version = 1 or (supersedes_reason is not null
                             and length(btrim(supersedes_reason)) >= 10));
  end if;
end $$;


-- ===========================================================================
-- 3. WHAT THE QR CODE RESOLVES TO
-- ===========================================================================
--
-- A READER OF THE DOCUMENT IS NOT A USER OF THE SYSTEM. Somebody checking an
-- appointment letter is a bank, an embassy or another university, and they get
-- exactly what the University is willing to say publicly about a document
-- somebody has handed them: that it is genuine, whose it is, what post, and
-- when it was issued.
--
-- WHAT IT DOES NOT CARRY: the salary, the terms, the address, the reporting
-- officer. A verification page that answered "what is this person paid" to
-- anybody holding a photograph of their letter would be a data breach with a
-- QR code on it.

-- ---------------------------------------------------------------------------
-- DROPPED FIRST, NOT REPLACED.
--
-- `create or replace view` can add a column and cannot remove one. 049 widens
-- this view with `signature_mode`, so on a SECOND run of RUN-ALL this statement
-- tried to replace the wider view with the narrower one and Postgres refused:
-- "cannot drop columns from view". The first pass was clean and the second was
-- not, which is precisely what running it twice is for.
-- ---------------------------------------------------------------------------
drop view if exists appointment_letter_verification;

create view appointment_letter_verification
with (security_invoker = false) as
select l.reference,
       'Appointment Letter'::text            as document,
       a.full_name                            as holder,
       a.position_title                       as position,
       coalesce(a.unit_name, '')              as unit,
       l.issued_on                            as issued,
       l.version,
       case
         -- A SUPERSEDED LETTER IS NOT INVALID, and saying so would be wrong in
         -- a way that costs somebody a visa. It was genuine and it has been
         -- replaced; the reader is told which version is current.
         when l.superseded_at is not null then 'Superseded'
         when a.status in ('withdrawn', 'declined') then 'Not in force'
         when a.status = 'ended' then 'Ended'
         else 'Valid'
       end                                    as status,
       (select max(v.version) from appointment_letters v
         where v.appointment_id = l.appointment_id) as current_version
  from appointment_letters l
  join appointments a on a.id = l.appointment_id;

comment on view appointment_letter_verification is
  'What the QR code on an appointment letter resolves to. Carries no salary, no '
  'terms and no contact details: a reader of the document is a bank or an embassy, '
  'not a user of the system.';

grant select on appointment_letter_verification to anon, authenticated, service_role;


-- ===========================================================================
-- 4. THE STAFF RECORD FOLLOWS THE APPOINTMENT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- THE DOOR THIS CLOSES
-- ---------------------------------------------------------------------------
--
-- A `lecturers` row could be created by anybody, for anybody, at any time, with
-- no appointment behind it. So the system could represent somebody as a member
-- of staff — with a department, a portal account and a place in the timetable —
-- whom the University had never appointed.
--
-- From now on a staff record created FROM an appointment requires that
-- appointment to have reached issuance. Rows that already exist are untouched,
-- and a row created with no appointment at all is still permitted, because the
-- University has staff who predate this system and refusing them would make it
-- unusable on the first day.
--
-- WHAT IS REFUSED is the specific dangerous thing: claiming an appointment that
-- has not been issued.

alter table lecturers
  add column if not exists appointment_id uuid references appointments (id) on delete set null;

create unique index if not exists lecturers_appointment_idx
  on lecturers (appointment_id) where appointment_id is not null;

create or replace function staff_follows_an_issued_appointment() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
begin
  if new.appointment_id is null then
    return new;
  end if;

  select status, issued_at, full_name into a from appointments where id = new.appointment_id;
  if not found then
    raise exception 'No appointment with id %', new.appointment_id using errcode = 'foreign_key_violation';
  end if;

  if a.issued_at is null then
    raise exception
      'This appointment has not been issued, so % cannot be made a member of staff from it. '
      'The University appoints somebody, sends them the letter, and the staff record follows — '
      'a staff record created first is a person the system says works here on nobody''s '
      'authority.', coalesce(a.full_name, 'this person')
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists lecturers_follow_appointments on lecturers;
create trigger lecturers_follow_appointments
  before insert or update of appointment_id on lecturers
  for each row execute function staff_follows_an_issued_appointment();


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  l_id uuid;
  someone uuid;
  other uuid;
  st text;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '042: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    insert into appointments
      (full_name, position_title, employment_type, start_date, place_of_duty, terms,
       drafted_by, status)
    values ('A Specimen Appointee', 'Lecturer in Theology', 'permanent', date '2026-10-01',
            'Buea campus', 'Subject to the conditions of service.', someone, 'draft')
    returning id into a_id;

    -- ---- NOBODY IS ACTIVE BEFORE THEY WERE APPOINTED ---------------------
    -- The ordering rule that makes the rest mean anything. Without it an
    -- administrator sets somebody active directly and the approval, the letter
    -- and the acceptance are decoration on a path nobody has to walk.
    for st in select unnest(array['accepted', 'active']) loop
      refused := false;
      begin
        execute 'update appointments set status = $1, accepted_at = now(), activated_at = now() '
                'where id = $2' using st, a_id;
      exception when others then refused := true;
      end;
      if not refused then
        raise exception '042 FAILED: an appointment reached % with no letter ever issued', st;
      end if;
    end loop;

    -- ---- AN AMENDMENT SAYS WHAT CHANGED ----------------------------------
    refused := false;
    begin
      update appointments set status = 'amendment_requested' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '042 FAILED: an appointment was amended with no reason and nobody asking';
    end if;

    -- ---- WALK IT PROPERLY: approved, letter generated, ISSUED -------------
    --
    -- THE LETTER IS ARCHIVED BEFORE THE STATUS SAYS ISSUED, and it did not use
    -- to be. 047 refuses an appointment to reach `issued` with no document
    -- behind it — the University's own rule — so this proof walked a path the
    -- system no longer permits, and reported "042 FAILED" on the second pass
    -- of RUN-ALL while passing cleanly on the first.
    --
    -- The fix is not to stand the rule down. It is that this order was always
    -- the right one: the appointee is holding the letter, and a register that
    -- says a letter went out before one existed is the thing 047 closes.
    update appointments
       set status = 'approved', authorized_by = other, authorized_at = now() where id = a_id;
    update appointments
       set status = 'letter_generated', letter_generated_at = now() where id = a_id;
    -- …and `issued` is set below, AFTER the letter is in the archive.

    -- ---- THE REFERENCE IS THE SHAPE THE UNIVERSITY ASKED FOR --------------
    refused := false;
    begin
      insert into appointment_letters (appointment_id, reference, issued_on, html)
      values (a_id, 'IGUC/HR/2026/0001', current_date, '<p>x</p>');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '042 FAILED: a letter was filed under a reference that is not APT-YYYY-NNNN';
    end if;

    insert into appointment_letters (appointment_id, reference, issued_on, html, kind)
    values (a_id, 'APT-2026-0042', current_date, '<p>Version one.</p>', 'issued')
    returning id into l_id;

    -- NOW it can be issued, and not before. The archive holds the document the
    -- appointee is about to be holding.
    update appointments set status = 'issued', issued_at = now() where id = a_id;

    -- ---- A SECOND VERSION SAYS WHY THERE IS ONE ---------------------------
    -- Somebody is holding version 1 and has just been sent version 2.
    update appointment_letters set superseded_at = now() where id = l_id;
    refused := false;
    begin
      insert into appointment_letters
        (appointment_id, reference, version, issued_on, html, kind)
      values (a_id, 'APT-2026-0043', 2, current_date, '<p>Version two.</p>', 'amended');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '042 FAILED: a revised letter was issued with no account of what changed';
    end if;

    insert into appointment_letters
      (appointment_id, reference, version, issued_on, html, kind, supersedes_reason)
    values (a_id, 'APT-2026-0043', 2, current_date, '<p>Version two.</p>', 'amended',
            'The start date moved to the first of November.');

    -- ---- WHAT A READER OF THE DOCUMENT IS TOLD ----------------------------
    if (select status from appointment_letter_verification where reference = 'APT-2026-0043')
       <> 'Valid' then
      raise exception '042 FAILED: the current letter does not verify as valid';
    end if;
    -- A SUPERSEDED LETTER IS NOT INVALID. Saying so would be wrong in a way
    -- that costs somebody a visa: it was genuine and it has been replaced.
    if (select status from appointment_letter_verification where reference = 'APT-2026-0042')
       <> 'Superseded' then
      raise exception '042 FAILED: a replaced letter reports as something other than superseded';
    end if;
    -- AND IT CARRIES NO SALARY. A verification page that answered "what is
    -- this person paid" to anybody holding a photograph of their letter would
    -- be a data breach with a QR code on it.
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'appointment_letter_verification'
         and column_name in ('salary_amount', 'salary_currency', 'terms', 'postal_address',
                             'email', 'phone', 'reports_to_name')
    ) then
      raise exception '042 FAILED: the public verification view carries private terms';
    end if;

    -- ---- THE STAFF RECORD FOLLOWS THE APPOINTMENT -------------------------
    -- A staff record created first is a person the system says works here on
    -- nobody's authority.
    insert into appointments
      (full_name, position_title, employment_type, start_date, place_of_duty, terms,
       drafted_by, status)
    values ('Not Yet Appointed', 'Lecturer', 'permanent', date '2027-01-01',
            'Buea campus', 'Conditions of service.', someone, 'draft')
    returning id into l_id;

    refused := false;
    begin
      insert into lecturers (staff_id, first_name, last_name, appointment_id)
      values ('PROOF-042-A', 'Not Yet', 'Appointed', l_id);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '042 FAILED: somebody became a member of staff from an appointment that '
                      'had never been issued';
    end if;

    -- …and from an issued one it works.
    insert into lecturers (staff_id, first_name, last_name, appointment_id)
    values ('PROOF-042-B', 'A Specimen', 'Appointee', a_id);

    -- A staff record with NO appointment is still allowed: the University has
    -- staff who predate this system, and refusing them would make it unusable
    -- on the first day.
    insert into lecturers (staff_id, first_name, last_name)
    values ('PROOF-042-C', 'Predates', 'ThisSystem');

    -- ---- ONE STAFF RECORD PER APPOINTMENT ---------------------------------
    refused := false;
    begin
      insert into lecturers (staff_id, first_name, last_name, appointment_id)
      values ('PROOF-042-D', 'A Second', 'Record', a_id);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '042 FAILED: one appointment produced two members of staff';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '042 OK: nobody is accepted or active before a letter was issued, an amendment '
               'states what changed, a reference is APT-YYYY-NNNN, a revised letter accounts '
               'for itself, a superseded letter verifies as superseded rather than invalid, '
               'the public view carries no salary, and a staff record cannot be created from '
               'an appointment that was never issued';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- The board: every appointment and where it has reached.
select full_name, position_title, employment_type, status, start_date,
       issued_at is not null as letter_issued,
       accepted_at, activated_at, amendments
  from appointments
 order by created_at desc;

-- THE LETTER HISTORY, as the University asked to read it.
select a.full_name, l.reference, l.version,
       initcap(l.kind) || ' ' || to_char(l.issued_on, 'DD Mon YYYY') as entry,
       coalesce(l.supersedes_reason, '') as why,
       (l.superseded_at is null) as is_current
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
 order by a.full_name, l.version;

-- What a QR code resolves to, for every letter.
select * from appointment_letter_verification order by reference;

-- STAFF RECORDS WITH NO APPOINTMENT BEHIND THEM. Permitted — the University
-- has staff who predate this system — but worth knowing about, because each is
-- somebody the register cannot explain.
select staff_id, first_name, last_name, status
  from lecturers
 where appointment_id is null
 order by created_at;

-- Appointments issued and never answered. Each is somebody who has not replied.
select full_name, position_title, issued_at
  from appointments
 where status = 'issued' and accepted_at is null and declined_at is null
 order by issued_at;
