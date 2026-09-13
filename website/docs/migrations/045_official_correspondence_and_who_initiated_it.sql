-- ===========================================================================
-- 045 — OFFICIAL CORRESPONDENCE, AND WHO STARTED IT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE UNIVERSITY GETS A REGISTER OF ITS OWN OFFICIAL LETTERS. Not
--    appointment letters — those have one — but the correspondence an office
--    originates and finishes: an invitation, a commendation, a letter to a
--    ministry, a directive, a partnership approach. Until now none of it
--    existed in this system at all, which means the University cannot say what
--    it has written to whom.
--
-- 2. WHO INITIATED IS RECORDED SEPARATELY FROM WHO AUTHORISED. The same
--    appointment can arrive two ways — HR proposes it, or the Vice-Chancellor
--    starts it personally — and both are legitimate. What was not possible was
--    telling them apart afterwards, because the record held only who approved.
--
-- 3. A LETTER PREPARED BY SOMEBODY ELSE IS STILL THE AUTHORITY'S LETTER. An
--    administrator may be asked to draft; `prepared_by` records that, and
--    issuing still requires the capability the preparer does not hold. The
--    staff member never becomes the issuing authority.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- WHERE ONE PERSON ORIGINATES AND ISSUES, THERE IS NO SECOND PAIR OF EYES, and
-- this migration does not pretend otherwise. For correspondence that is the
-- point: a letter to a government ministry IS the Vice-Chancellor speaking, and
-- inventing an approver for it would be ceremony.
--
-- For an APPOINTMENT it is a different matter, because an appointment commits
-- the University to paying somebody. 041 refuses an approval by the drafter and
-- that rule stands. A Vice-Chancellor who personally initiates an appointment
-- therefore still needs somebody else to approve it — OR the appointment is
-- recorded as having been made on sole authority, which section 3 makes
-- possible, visible and permanent. The University can do it; what it cannot do
-- is do it quietly.
-- ===========================================================================


-- ===========================================================================
-- 1. THE CORRESPONDENCE
-- ===========================================================================

create table if not exists correspondence (
  id             uuid primary key default gen_random_uuid(),

  -- A CLOSED LIST. The kind decides the letterhead, the register it appears in
  -- and, in time, the template — and "Invitation", "invitation" and "Official
  -- Invitation" as free text are three kinds within a month.
  kind           text not null check (kind in (
                   'general', 'appointment', 'reappointment', 'invitation',
                   'commendation', 'recommendation', 'government', 'university',
                   'partnership', 'directive', 'warning', 'authorization',
                   'special', 'other')),

  -- THE OFFICE THE LETTER COMES FROM, which is what the letterhead says and is
  -- not the same as who typed it.
  originating_office text not null default 'vice-chancellor'
                       check (originating_office in (
                         'vice-chancellor', 'chancellor', 'registrar',
                         'academic-office', 'hr', 'admissions', 'finance')),

  subject        text not null check (length(btrim(subject)) >= 4),
  body           text not null check (length(btrim(body)) >= 40),

  -- ---- Who it is to ------------------------------------------------------
  --
  -- FREE TEXT, because the recipient of a letter to a ministry is a ministry.
  -- A foreign key to a person would have made half the University's outward
  -- correspondence unrecordable.
  recipient_name text not null check (length(btrim(recipient_name)) >= 2),
  recipient_org  text,
  recipient_email text,
  recipient_address text,

  -- ---- Who did what ------------------------------------------------------
  --
  -- INITIATED, PREPARED AND AUTHORISED ARE THREE ROLES AND OFTEN ONE PERSON.
  -- Kept apart anyway: the whole point is that afterwards the record can say
  -- which of them it was.
  initiated_by   uuid not null references auth.users (id) on delete restrict,
  prepared_by    uuid references auth.users (id) on delete set null,
  authorized_by  uuid references auth.users (id) on delete restrict,
  authorized_at  timestamptz,

  status         text not null default 'draft'
                   check (status in ('draft', 'preparing', 'awaiting_authority',
                                     'authorized', 'scheduled', 'issued',
                                     'withdrawn')),

  -- When it should go out, for a letter written now and sent on a date.
  scheduled_for  timestamptz,
  issued_at      timestamptz,

  withdrawn_reason text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists correspondence_status_idx
  on correspondence (status, scheduled_for);
create index if not exists correspondence_office_idx
  on correspondence (originating_office, created_at desc);

do $$
begin
  -- AN AUTHORISED LETTER NAMES ITS AUTHORITY AND THE MOMENT.
  if not exists (select 1 from pg_constraint where conname = 'correspondence_authority_recorded') then
    alter table correspondence add constraint correspondence_authority_recorded
      check (status not in ('authorized', 'scheduled', 'issued')
             or (authorized_by is not null and authorized_at is not null));
  end if;

  -- AN ISSUED LETTER HAS GONE OUT AT A TIME.
  if not exists (select 1 from pg_constraint where conname = 'correspondence_issued_recorded') then
    alter table correspondence add constraint correspondence_issued_recorded
      check (status <> 'issued' or issued_at is not null);
  end if;

  -- A SCHEDULED LETTER HAS A TIME TO GO.
  if not exists (select 1 from pg_constraint where conname = 'correspondence_scheduled_has_a_time') then
    alter table correspondence add constraint correspondence_scheduled_has_a_time
      check (status <> 'scheduled' or scheduled_for is not null);
  end if;

  -- WITHDRAWING SAYS WHY, like every other closure in this system.
  if not exists (select 1 from pg_constraint where conname = 'correspondence_withdrawal_explained') then
    alter table correspondence add constraint correspondence_withdrawal_explained
      check (status <> 'withdrawn'
             or (withdrawn_reason is not null and length(btrim(withdrawn_reason)) >= 10));
  end if;

  -- ---------------------------------------------------------------------
  -- A PREPARER IS NOT AN AUTHORITY.
  --
  -- The rule that makes delegation safe. An administrator may be asked to
  -- draft a letter and the letter remains the Vice-Chancellor's — but the
  -- person who drafted it may not be the person who authorised it, or the
  -- delegation has quietly moved the authority along with the typing.
  -- ---------------------------------------------------------------------
  if not exists (select 1 from pg_constraint where conname = 'correspondence_preparer_is_not_authority') then
    alter table correspondence add constraint correspondence_preparer_is_not_authority
      check (prepared_by is null or authorized_by is null or prepared_by <> authorized_by);
  end if;
end $$;


-- ===========================================================================
-- 2. THE LETTERS THEMSELVES, ARCHIVED LIKE EVERY OTHER DOCUMENT
-- ===========================================================================
--
-- The same shape as `appointment_letters`, deliberately: a reference, a
-- version, the html as sent, a hash, a seal, and a delivery that can fail
-- without undoing anything. A third arrangement for the same job would be a
-- third answer to "what did we send".

create table if not exists correspondence_letters (
  id               uuid primary key default gen_random_uuid(),
  correspondence_id uuid not null references correspondence (id) on delete cascade,

  -- IGUC/VC/2026/0042 in the letter, filed as VC-2026-0042 for the same reason
  -- an appointment letter is: a reference with slashes cannot go in a URL path
  -- and the verification link is where it ends up.
  reference        text not null unique check (reference ~ '^[A-Z]{2,4}-[0-9]{4}-[0-9]{4,}$'),
  version          integer not null default 1 check (version >= 1),

  issued_on        date not null,
  html             text not null,
  content_hash     text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),

  sealed           boolean not null default false,
  seal_code        text,

  signatory_name   text,
  signatory_role   text,

  template_id      uuid references document_templates (id) on delete restrict,
  template_version integer,

  delivery         text not null default 'pending'
                     check (delivery in ('pending', 'sent', 'failed')),
  delivery_detail  text,
  attempts         integer not null default 0,
  queued_at        timestamptz,
  delivered_at     timestamptz,
  last_attempt_at  timestamptz,

  superseded_at    timestamptz,

  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (correspondence_id, version)
);

create unique index if not exists correspondence_letters_one_current_idx
  on correspondence_letters (correspondence_id) where superseded_at is null;

-- An issued letter is never edited. Superseded by a new version, exactly as an
-- appointment letter is, and for the same reason: somebody is holding it.
drop trigger if exists correspondence_letters_no_edit on correspondence_letters;
create trigger correspondence_letters_no_edit
  before update on correspondence_letters
  for each row execute function refuse_letter_edit();


-- ===========================================================================
-- 3. WHO INITIATED AN APPOINTMENT, AND WHETHER ANYBODY ELSE SAW IT
-- ===========================================================================
--
-- THE SAME APPOINTMENT ARRIVES TWO WAYS and both are legitimate: HR proposes
-- it, or the Vice-Chancellor starts it personally. The record held only who
-- approved, so afterwards the two were indistinguishable.
--
-- AND THE HONEST PART. 041 refuses an approval by whoever drafted the
-- appointment, because an appointment commits the University to paying
-- somebody. A Vice-Chancellor who personally initiates one therefore needs
-- somebody else to approve it — or the appointment is made on SOLE AUTHORITY,
-- which is recorded here, permanently, in the same shape as 040's emergency
-- publishing. The University can do it. What it cannot do is do it quietly.

alter table appointments
  add column if not exists initiated_by_office text
    check (initiated_by_office is null or initiated_by_office in
           ('hr', 'vice-chancellor', 'chancellor', 'registrar', 'academic-office')),
  add column if not exists initiated_by uuid references auth.users (id) on delete set null,

  -- THE MARK STAYS. Anybody reading this appointment in two years sees that
  -- one person made it end to end.
  add column if not exists made_on_sole_authority boolean not null default false,
  add column if not exists sole_authority_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_sole_authority_explained') then
    alter table appointments add constraint appointments_sole_authority_explained
      check (
        not made_on_sole_authority
        or (
          -- ONLY THE OFFICES THAT ACTUALLY HOLD THAT AUTHORITY. An HR clerk
          -- ticking this box would be the whole separation gone.
          initiated_by_office in ('vice-chancellor', 'chancellor')
          and sole_authority_reason is not null
          and length(btrim(sole_authority_reason)) >= 20
        )
      );
  end if;
end $$;

comment on column appointments.made_on_sole_authority is
  'True where one office both initiated and approved this appointment, with no second '
  'pair of eyes. Permitted for the Vice-Chancellor and the Chancellor, with a stated '
  'reason, and the mark is permanent.';

-- ---------------------------------------------------------------------------
-- AND THE ORDINARY RULE STILL BITES.
--
-- 041's constraint refuses an approval by the drafter outright. An appointment
-- made on sole authority names the same person as initiator and approver but
-- leaves `drafted_by` to whoever prepared it — so the two rules do not collide,
-- and an appointment with drafted_by = authorized_by is still refused whatever
-- boxes are ticked.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- 4. WHO CAN READ WHAT
-- ===========================================================================

alter table correspondence enable row level security;
alter table correspondence_letters enable row level security;

-- OUTWARD CORRESPONDENCE IS NOT ORDINARY INSTITUTIONAL INFORMATION. A warning
-- letter, a directive, a partnership approach that has not been announced —
-- each is the University's private business until it is not, and a policy that
-- let every administrator read the Vice-Chancellor's outbox would be a worse
-- failure than having no register at all.
drop policy if exists correspondence_read on correspondence;
create policy correspondence_read on correspondence
  for select using (
    auth_role() in ('superadmin', 'vice-chancellor', 'chancellor')
    or initiated_by = auth.uid()
    or prepared_by = auth.uid()
  );

drop policy if exists correspondence_letters_read on correspondence_letters;
create policy correspondence_letters_read on correspondence_letters
  for select using (
    auth_role() in ('superadmin', 'vice-chancellor', 'chancellor')
    or exists (select 1 from correspondence c
                where c.id = correspondence_letters.correspondence_id
                  and (c.initiated_by = auth.uid() or c.prepared_by = auth.uid()))
  );

-- No write policy on either. Everything goes through the route.


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  c_id uuid;
  a_id uuid;
  someone uuid;
  other uuid;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '045: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    insert into correspondence
      (kind, subject, body, recipient_name, initiated_by, status)
    values ('government', 'Accreditation correspondence',
            'A letter of sufficient length to satisfy the constraint on the body.',
            'The Ministry of Higher Education', someone, 'draft')
    returning id into c_id;

    -- ---- A PREPARER IS NOT AN AUTHORITY -----------------------------------
    -- The rule that makes delegation safe. Without it, asking an administrator
    -- to draft a letter quietly moves the authority along with the typing.
    refused := false;
    begin
      update correspondence
         set prepared_by = other, authorized_by = other, authorized_at = now(),
             status = 'authorized'
       where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: the person who drafted a letter authorised it, so delegating '
                      'the typing delegated the authority';
    end if;

    -- …and the Vice-Chancellor authorising what an administrator prepared is
    -- exactly the arrangement this is for.
    update correspondence
       set prepared_by = other, authorized_by = someone, authorized_at = now(),
           status = 'authorized'
     where id = c_id;

    -- ---- A SCHEDULED LETTER HAS A TIME TO GO ------------------------------
    refused := false;
    begin
      update correspondence set status = 'scheduled' where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: a letter was scheduled for no particular time';
    end if;

    -- ---- AN ISSUED LETTER RECORDS WHEN ------------------------------------
    refused := false;
    begin
      update correspondence set status = 'issued' where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: a letter was issued at no particular time';
    end if;

    update correspondence set status = 'issued', issued_at = now() where id = c_id;

    -- ---- THE REFERENCE IS FILEABLE AND URL-SAFE ---------------------------
    refused := false;
    begin
      insert into correspondence_letters (correspondence_id, reference, issued_on, html)
      values (c_id, 'IGUC/VC/2026/0042', current_date, '<p>The letter.</p>');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: a letter was filed under a reference with slashes in it';
    end if;

    insert into correspondence_letters (correspondence_id, reference, issued_on, html)
    values (c_id, 'VC-2026-0042', current_date, '<p>The letter.</p>');

    -- ---- AND IT CANNOT BE REWRITTEN ---------------------------------------
    refused := false;
    begin
      update correspondence_letters set html = '<p>Something else.</p>'
       where reference = 'VC-2026-0042';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: an issued letter was rewritten';
    end if;

    -- =====================================================================
    -- SOLE AUTHORITY ON AN APPOINTMENT
    -- =====================================================================
    insert into appointments
      (full_name, position_title, employment_type, start_date, place_of_duty, terms,
       drafted_by, status, initiated_by_office, initiated_by)
    values ('A Specimen Appointee', 'Lecturer', 'permanent', date '2026-10-01',
            'Buea campus', 'Conditions of service.', other, 'draft',
            'vice-chancellor', someone)
    returning id into a_id;

    -- ---- AN HR-INITIATED APPOINTMENT CANNOT CLAIM SOLE AUTHORITY ----------
    -- An HR clerk ticking this box would be the whole separation gone.
    refused := false;
    begin
      update appointments
         set initiated_by_office = 'hr', made_on_sole_authority = true,
             sole_authority_reason = 'A reason of more than twenty characters, easily.'
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: an HR-initiated appointment was made on sole authority';
    end if;

    -- ---- AND THE VICE-CHANCELLOR MUST SAY WHY -----------------------------
    refused := false;
    begin
      update appointments set made_on_sole_authority = true where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: an appointment was made on sole authority with no account '
                      'of why nobody else saw it';
    end if;

    update appointments
       set made_on_sole_authority = true,
           sole_authority_reason = 'Appointed directly by the Vice-Chancellor under Council '
                                || 'standing authority of 3 September.'
     where id = a_id;

    -- ---- AND 041'S RULE STILL BITES ---------------------------------------
    -- Sole authority records that one office made the appointment end to end.
    -- It does NOT let the person who drafted it approve it, which is a
    -- different claim and would make the mark meaningless.
    refused := false;
    begin
      update appointments set authorized_by = other, authorized_at = now() where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '045 FAILED: the drafter approved an appointment because sole authority '
                      'was ticked. The two rules are not the same rule.';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '045 OK: a preparer cannot authorise what they prepared, a scheduled letter has '
               'a time and an issued one records when, a reference is URL-safe, an issued '
               'letter cannot be rewritten, only the Vice-Chancellor and Chancellor may act on '
               'sole authority and only with a stated reason, and that does not let a drafter '
               'approve their own appointment';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- The correspondence register, by office and kind.
select originating_office, kind, status, count(*) as letters
  from correspondence
 group by 1, 2, 3
 order by 1, 2;

-- APPOINTMENTS MADE ON SOLE AUTHORITY. This list should be short and every
-- line on it should be a decision somebody would defend out loud. If it grows,
-- the second pair of eyes has become optional.
select full_name, position_title, initiated_by_office, sole_authority_reason, start_date
  from appointments
 where made_on_sole_authority
 order by start_date desc;

-- WHO INITIATED WHAT. The question that could not be asked before: the same
-- appointment arrives from HR or from the Vice-Chancellor and both are
-- legitimate, but afterwards they were indistinguishable.
select coalesce(initiated_by_office, '— not recorded —') as initiated_by_office,
       count(*) as appointments
  from appointments
 group by 1
 order by 2 desc;

-- Letters written and not yet gone out.
select c.kind, c.subject, c.recipient_name, c.status, c.scheduled_for
  from correspondence c
 where c.status in ('draft', 'preparing', 'awaiting_authority', 'authorized', 'scheduled')
 order by c.created_at desc;

-- Correspondence that failed to reach anybody.
select c.subject, c.recipient_name, l.reference, l.attempts, l.delivery_detail
  from correspondence_letters l
  join correspondence c on c.id = l.correspondence_id
 where l.delivery = 'failed' and l.superseded_at is null
 order by l.created_at desc;
