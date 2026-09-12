-- ===========================================================================
-- 044 — DOCUMENT TEMPLATES, AND THE LETTERS THAT STAY TIED TO THEM
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. HR gets a template registry: eleven document types, each versioned, each
--    with one active version at a time. A promotion letter stops being an
--    appointment letter with different words typed into it.
--
-- 2. EVERY ISSUED LETTER RECORDS WHICH TEMPLATE VERSION PRODUCED IT, and that
--    version can then never be deleted. This is the rule the University named
--    after Dorothy's admission letter: a document issued in 2026 was produced
--    by the wording of 2026, and a registry that has since replaced that
--    wording cannot explain its own document without it.
--
-- 3. A template is ACTIVATED by somebody other than whoever wrote it, like
--    everything else in this system that goes out under the University's name.
--
-- ---------------------------------------------------------------------------
-- WHY NOT `credential_templates`
-- ---------------------------------------------------------------------------
--
-- 005 built that table with a three-office approval chain: the Registrar, the
-- Academic Office and the Vice Chancellor each sign before a design is
-- published. That is the right ceremony for a degree certificate and the wrong
-- ceremony for a transfer letter — a gate that heavy on an ordinary HR document
-- is a gate that gets routed around, and the routing-around becomes the
-- process.
--
-- So HR templates are their own registry with a real but lighter rule: one
-- other person activates. Same principle, proportionate weight. The two
-- registries share nothing except that idea, deliberately.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TEMPLATES
-- ===========================================================================

create table if not exists document_templates (
  id            uuid primary key default gen_random_uuid(),

  -- THE ELEVEN THE UNIVERSITY NAMED. A closed list, because "Promotion Letter"
  -- and "promotion letter" and "Promotion" as free text produce three
  -- templates and nobody can say which one is in force.
  kind          text not null check (kind in (
                  'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
                  'transfer', 'acting-appointment', 'probation-confirmation',
                  'contract-extension', 'appointment-amendment', 'termination', 'retirement')),

  version       integer not null check (version >= 1),
  name          text not null check (length(btrim(name)) >= 3),

  -- The body, with placeholders the generator fills from the record. Stored as
  -- text rather than a design document: an HR letter is prose, and modelling
  -- prose as a layout tree makes it harder to read and no easier to change.
  body          text not null check (length(btrim(body)) >= 40),

  status        text not null default 'draft' check (status in ('draft', 'active', 'retired')),

  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),

  activated_by  uuid references auth.users (id) on delete set null,
  activated_at  timestamptz,
  retired_at    timestamptz,

  unique (kind, version)
);

create index if not exists document_templates_kind_idx on document_templates (kind, version desc);

-- ONE ACTIVE VERSION PER KIND. Two would mean the generator had to choose, and
-- whichever it chose would be the wrong one half the time — silently, because
-- both are real templates and the letter would look right.
create unique index if not exists document_templates_one_active_idx
  on document_templates (kind) where status = 'active';

do $$
begin
  -- ACTIVATED BY SOMEBODY ELSE. The same rule 005 applies to a certificate
  -- design, 009 to a grade, 038 to an announcement and 041 to an appointment.
  -- A template is the words the University says in every letter of its kind
  -- from now on; one person writing and activating it alone is that rule at
  -- its largest scale, because it applies to everybody appointed afterwards.
  if not exists (select 1 from pg_constraint where conname = 'document_templates_second_pair_of_eyes') then
    alter table document_templates add constraint document_templates_second_pair_of_eyes
      check (activated_by is null or created_by is null or activated_by <> created_by);
  end if;

  -- AN ACTIVE TEMPLATE NAMES WHO ACTIVATED IT AND WHEN.
  if not exists (select 1 from pg_constraint where conname = 'document_templates_activation_recorded') then
    alter table document_templates add constraint document_templates_activation_recorded
      check (status <> 'active' or (activated_by is not null and activated_at is not null));
  end if;
end $$;

-- A TEMPLATE IS NOT EDITED ONCE IT HAS BEEN ACTIVE. A new version is written
-- instead. Editing the words that produced a letter somebody is holding is the
-- same fault as editing the letter, one step removed and harder to see.
create or replace function refuse_active_template_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'draft' then
    return new;                       -- a draft may still be worked on
  end if;
  -- Retiring and activating are changes of status, not of wording.
  if new.body = old.body and new.kind = old.kind and new.version = old.version then
    return new;
  end if;
  raise exception
    'Template "% v%" has been active and its wording cannot be changed. Create a new version: '
    'letters already issued were produced by these words, and a registry that rewrites them '
    'cannot explain its own documents.', old.kind, old.version
    using errcode = 'check_violation';
end $$;

drop trigger if exists document_templates_no_edit on document_templates;
create trigger document_templates_no_edit
  before update on document_templates
  for each row execute function refuse_active_template_edit();

alter table document_templates enable row level security;

drop policy if exists document_templates_read on document_templates;
create policy document_templates_read on document_templates
  for select using (auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office'));

-- No write policy. Templates are written through the route, which checks the
-- capability and records who did it.


-- ===========================================================================
-- 2. THE LETTER REMEMBERS WHICH WORDS PRODUCED IT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- THE DOROTHY RULE
-- ---------------------------------------------------------------------------
--
-- A document issued in 2026 was produced by the wording of 2026. A registry
-- that has since replaced that wording and kept no link to the old one cannot
-- explain its own document: asked why the letter says what it says, the only
-- answer is "the template used to be different" with nothing behind it.
--
-- ON DELETE RESTRICT, and that is the whole point of the column. A template
-- version that produced a letter can never be deleted, cascaded away, or
-- tidied up during a spring clean — the database refuses, and names the letter
-- that depends on it.

alter table appointment_letters
  add column if not exists document_type text,
  add column if not exists template_id uuid references document_templates (id) on delete restrict,
  -- The version number as well as the id. Redundant on purpose: the id proves
  -- which row, and the number is what a person reads on a screen without
  -- joining anything. A letter whose template row somehow vanished still says
  -- which version it was.
  add column if not exists template_version integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_document_type_check') then
    alter table appointment_letters add constraint appointment_letters_document_type_check
      check (document_type is null or document_type in (
        'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
        'transfer', 'acting-appointment', 'probation-confirmation',
        'contract-extension', 'appointment-amendment', 'termination', 'retirement'));
  end if;
end $$;

create index if not exists appointment_letters_template_idx
  on appointment_letters (template_id) where template_id is not null;

comment on column appointment_letters.template_id is
  'The template version that produced this letter. ON DELETE RESTRICT: a version '
  'that has issued a document can never be removed, because the document cannot '
  'be explained without it.';


-- ===========================================================================
-- 3. THE DELIVERY, WHICH DOES NOT REVERSE THE APPOINTMENT
-- ===========================================================================
--
-- 041 gave a letter `delivery`, `attempts` and `delivery_detail`. What it did
-- not record is WHEN each attempt happened, and the University asked for the
-- four-line receipt: issued, archived, queued, delivered.
--
-- AN EMAIL FAILURE DOES NOT UNDO AN APPOINTMENT. The University appointed
-- somebody; the mail server being unreachable is not a change of mind. The
-- letter sits in an outbox and is retried, and the appointment stays issued —
-- which is what these columns are for and why there is no path here that
-- touches `appointments.status`.

alter table appointment_letters
  add column if not exists queued_at       timestamptz,
  add column if not exists delivered_at    timestamptz,
  add column if not exists last_attempt_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_delivery_times') then
    alter table appointment_letters add constraint appointment_letters_delivery_times
      check (
        (delivery <> 'sent' or delivered_at is not null)
        and (attempts = 0 or last_attempt_at is not null)
      );
  end if;
end $$;

-- WHAT STILL NEEDS SENDING. Each row is somebody who has been appointed and
-- has not been told.
create or replace view appointment_letters_outbox
with (security_invoker = true) as
select l.id, l.reference, l.version, a.full_name, a.email,
       l.attempts, l.last_attempt_at, l.delivery_detail
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
 where l.superseded_at is null
   and l.delivery in ('pending', 'failed')
 order by l.attempts, l.created_at;


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  t_id uuid;
  a_id uuid;
  l_id uuid;
  someone uuid;
  other uuid;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '044: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    insert into document_templates (kind, version, name, body, created_by)
    values ('promotion', 1, 'Promotion Letter',
            'Dear {{full_name}}, we are pleased to promote you to {{position_title}}.',
            someone)
    returning id into t_id;

    -- ---- THE WRITER DOES NOT ACTIVATE THEIR OWN --------------------------
    -- A template is the words the University says in every letter of its kind
    -- from now on. One person writing and activating it alone is the second
    -- pair of eyes at its largest scale.
    refused := false;
    begin
      update document_templates set status = 'active', activated_by = someone,
                                    activated_at = now() where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '044 FAILED: somebody activated the template they wrote';
    end if;

    update document_templates set status = 'active', activated_by = other,
                                  activated_at = now() where id = t_id;

    -- ---- ONE ACTIVE VERSION PER KIND -------------------------------------
    -- Two would mean the generator had to choose, and whichever it chose would
    -- be wrong half the time — silently, because both are real templates.
    insert into document_templates (kind, version, name, body, created_by)
    values ('promotion', 2, 'Promotion Letter',
            'Dear {{full_name}}, the University is pleased to promote you.', someone);
    refused := false;
    begin
      update document_templates set status = 'active', activated_by = other,
                                    activated_at = now()
       where kind = 'promotion' and version = 2;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '044 FAILED: two versions of one template were active at once';
    end if;

    -- ---- AN ACTIVE TEMPLATE'S WORDING CANNOT BE CHANGED ------------------
    refused := false;
    begin
      update document_templates set body = 'Something else entirely, at length, for the check.'
       where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '044 FAILED: the wording that produced issued letters was rewritten';
    end if;

    -- …but retiring it is a change of status, not of wording.
    update document_templates set status = 'retired', retired_at = now() where id = t_id;
    update document_templates set status = 'active' where id = t_id;

    -- ---- A TEMPLATE THAT ISSUED A LETTER CANNOT BE DELETED ---------------
    -- THE DOROTHY RULE. Asked why the letter says what it says, the only
    -- answer without this is "the template used to be different".
    insert into appointments
      (full_name, position_title, employment_type, start_date, place_of_duty, terms,
       drafted_by, authorized_by, authorized_at, status, issued_at)
    values ('A Specimen Appointee', 'Senior Lecturer', 'permanent', date '2026-10-01',
            'Buea campus', 'Conditions of service.', someone, other, now(), 'issued', now())
    returning id into a_id;

    insert into appointment_letters
      (appointment_id, reference, issued_on, html, document_type, template_id, template_version)
    values (a_id, 'APT-2026-7001', current_date, '<p>The letter.</p>',
            'promotion', t_id, 1)
    returning id into l_id;

    refused := false;
    begin
      delete from document_templates where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '044 FAILED: a template version that had produced a letter was deleted, '
                      'so that letter can no longer be explained';
    end if;

    -- ---- A DOCUMENT TYPE NOBODY DECLARED IS REFUSED ----------------------
    refused := false;
    begin
      update appointment_letters set document_type = 'some-letter-somebody-invented'
       where id = l_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '044 FAILED: a letter claimed a document type the University does not issue';
    end if;

    -- ---- A FAILED EMAIL DOES NOT UNDO AN APPOINTMENT ---------------------
    -- The University appointed somebody; the mail server being unreachable is
    -- not a change of mind.
    update appointment_letters
       set delivery = 'failed', attempts = 1, last_attempt_at = now(),
           delivery_detail = 'Connection refused'
     where id = l_id;

    if (select status from appointments where id = a_id) <> 'issued' then
      raise exception '044 FAILED: a failed email changed the appointment';
    end if;
    if not exists (select 1 from appointment_letters_outbox where id = l_id) then
      raise exception '044 FAILED: a letter that failed to send is not in the outbox, so '
                      'nobody will ever retry it and the appointee is never told';
    end if;

    -- ---- AND A DELIVERY RECORDS WHEN ------------------------------------
    refused := false;
    begin
      update appointment_letters set delivery = 'sent' where id = l_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '044 FAILED: a letter was marked sent with no record of when';
    end if;

    update appointment_letters set delivery = 'sent', delivered_at = now(), attempts = 2
     where id = l_id;
    if exists (select 1 from appointment_letters_outbox where id = l_id) then
      raise exception '044 FAILED: a delivered letter is still in the outbox';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '044 OK: nobody activates the template they wrote, one version of each kind is '
               'active, an active template''s wording cannot be rewritten, a version that '
               'issued a letter cannot be deleted, a document type nobody declared is refused, '
               'a failed email leaves the appointment issued and the letter in the outbox, and '
               'a delivery records when it happened';
end $$;


-- ===========================================================================
-- 5. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- The template registry, as Settings would show it.
select kind, version, name, status, activated_at
  from document_templates
 order by kind, version desc;

-- DOCUMENT TYPES WITH NO ACTIVE TEMPLATE. Each is a letter HR cannot generate
-- at all, and the list is the work outstanding before this is usable.
select t.kind as document_type_with_no_active_template
  from (select unnest(array[
          'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
          'transfer', 'acting-appointment', 'probation-confirmation',
          'contract-extension', 'appointment-amendment', 'termination', 'retirement']) as kind) t
 where not exists (
   select 1 from document_templates d where d.kind = t.kind and d.status = 'active'
 )
 order by 1;

-- THE FOUR-LINE RECEIPT the University asked for, per letter.
select a.full_name, l.reference, l.version,
       (a.issued_at is not null)       as issued,
       (l.content_hash is not null)    as archived,
       (l.queued_at is not null)       as email_queued,
       (l.delivery = 'sent')           as email_delivered,
       l.attempts,
       coalesce(l.delivery_detail, '') as last_error
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
 where l.superseded_at is null
 order by l.created_at desc;

-- THE OUTBOX. Each row is somebody who has been appointed and not told.
select * from appointment_letters_outbox;

-- Which template version produced each letter. Empty entries are letters
-- issued before templates existed; they are not backfilled, because guessing
-- which wording produced a document is the opposite of the point.
select a.full_name, l.reference, l.document_type, l.template_version,
       d.name as template_name
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
  left join document_templates d on d.id = l.template_id
 order by l.created_at desc;
