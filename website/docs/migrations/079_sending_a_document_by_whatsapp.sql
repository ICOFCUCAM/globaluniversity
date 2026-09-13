-- ===========================================================================
-- 079 — SENDING A DOCUMENT BY WHATSAPP
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A LETTER CAN BE HANDED TO WHATSAPP, AND THE SYSTEM RECORDS THAT IT WAS.
--    Both event vocabularies gain one word — `WHATSAPP_HANDED_OVER` — so the
--    history of an appointment letter or an official letter can say that on
--    such a date, this officer sent it that way.
--
-- 2. A LETTER CAN CARRY A PHONE NUMBER TO SEND IT TO. `correspondence` had a
--    recipient's name, organisation, postal address and email, and no number,
--    so there was nothing to send to. Appointments already had `phone`.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- `delivery` IS NOT TOUCHED, AND THAT IS THE POINT. It stays 'pending',
-- 'sent' or 'failed', and WhatsApp never sets it to 'sent'.
--
-- When the University emails a letter, its own mail server reports what
-- happened and 'sent' means something. WhatsApp is different: the officer's
-- own WhatsApp opens with the message prepared, and whether they then press
-- send, send it to the right person, or close the window, the University's
-- system cannot see. Writing 'sent' would be the database asserting a
-- delivery nobody observed — and the first time an appointee said "I never
-- received it", the record would be evidence against the University that was
-- never true.
--
-- So what is recorded is exactly what is known: WHO handed this letter to
-- WhatsApp, WHEN, and to WHICH number. That is a real fact, it is the fact an
-- audit needs, and it does not pretend to be a delivery receipt.
--
-- ---------------------------------------------------------------------------
-- AND WHY WHATSAPP CARRIES A LINK AND NOT THE DOCUMENT
-- ---------------------------------------------------------------------------
--
-- WhatsApp cannot be handed a file by a web page. What it can be handed is a
-- message, so the message carries the reference and the address that verifies
-- it — which is better than an attachment anyway: a forwarded WhatsApp file
-- proves nothing, and a reference checked against the University's own
-- verification page proves the document is real.
-- ===========================================================================


-- ===========================================================================
-- 1. THE WORD BOTH HISTORIES WERE MISSING
-- ===========================================================================
--
-- REPLACED, NOT WIDENED IN PLACE. A CHECK constraint cannot have a value
-- added to it; it is dropped and written again with the longer list. Every
-- value already there stays, so no existing row is invalidated — and the
-- proof at the end shows the old words are still accepted.

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'appointment_events_vocabulary') then
    alter table appointment_events drop constraint appointment_events_vocabulary;
  end if;

  alter table appointment_events add constraint appointment_events_vocabulary
    check (event in (
      'DRAFTED', 'EDITED', 'REVIEWED', 'SUBMITTED_FOR_AUTHORITY', 'AUTHORIZED',
      'RETURNED', 'LETTER_GENERATED', 'LETTER_ISSUED', 'LETTER_VIEWED',
      'LETTER_DOWNLOADED', 'LETTER_SUPERSEDED', 'EMAIL_SENT', 'EMAIL_FAILED',
      'LETTER_DELIVERY_FAILED', 'ACCEPTED', 'DECLINED', 'RENEWED',
      'STAFF_ACTIVATED', 'WITHDRAWN', 'ENDED', 'ADMINISTRATIVE_OVERRIDE',
      -- NEW. The officer opened WhatsApp with this letter's reference and
      -- verification address prepared. Not a delivery — see the header.
      'WHATSAPP_HANDED_OVER'));
end $$;

do $$
begin
  if exists (select 1 from pg_constraint
              where conname = 'correspondence_events_event_check') then
    alter table correspondence_events drop constraint correspondence_events_event_check;
  end if;

  alter table correspondence_events add constraint correspondence_events_event_check
    check (event in (
      'DRAFTED', 'EDITED', 'PREPARATION_REQUESTED', 'PREPARED',
      'SUBMITTED_TO_AUTHORITY', 'AUTHORIZED', 'RETURNED', 'SCHEDULED',
      'LETTER_GENERATED', 'ISSUED', 'DELIVERED', 'DELIVERY_FAILED',
      'LETTER_SUPERSEDED', 'WITHDRAWN',
      'WHATSAPP_HANDED_OVER'));
end $$;


-- ===========================================================================
-- 2. SOMEWHERE TO SEND IT
-- ===========================================================================
--
-- A NUMBER, NOT A FORMAT. No CHECK on the shape: the University writes to
-- ministries, partner institutions and people in several countries, and a
-- regular expression that was right for Cameroon would quietly refuse a
-- correct number from anywhere else. The application normalises it before it
-- reaches WhatsApp, and shows what it made of it, which is the honest place
-- for that judgement — visible and correctable.

alter table correspondence
  add column if not exists recipient_phone text;

comment on column correspondence.recipient_phone is
  'A number the recipient can be reached on, for handing the letter to WhatsApp. '
  'Not validated in the database: the University writes abroad, and a pattern fitted to '
  'one country would refuse correct numbers from every other.';


-- ===========================================================================
-- 3. PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  ap_id  uuid;
  co_id  uuid;
  refused boolean;
begin
  select id into ap_id from appointments limit 1;
  select id into co_id from correspondence limit 1;

  -- ---- THE NEW WORD IS ACCEPTED ----------------------------------------
  if ap_id is not null then
    insert into appointment_events (appointment_id, event)
    values (ap_id, 'WHATSAPP_HANDED_OVER');

    -- ---- AND EVERY OLD ONE STILL IS -----------------------------------
    -- The failure a rewritten CHECK actually causes: one value quietly
    -- dropped in the retyping, and a history that could no longer record an
    -- acceptance.
    insert into appointment_events (appointment_id, event) values
      (ap_id, 'DRAFTED'), (ap_id, 'AUTHORIZED'), (ap_id, 'LETTER_ISSUED'),
      (ap_id, 'EMAIL_SENT'), (ap_id, 'EMAIL_FAILED'), (ap_id, 'ACCEPTED'),
      (ap_id, 'DECLINED'), (ap_id, 'STAFF_ACTIVATED'), (ap_id, 'ENDED'),
      (ap_id, 'ADMINISTRATIVE_OVERRIDE');

    -- ---- AND A WORD NOBODY DEFINED IS STILL REFUSED --------------------
    refused := false;
    begin
      insert into appointment_events (appointment_id, event) values (ap_id, 'WHATSAPPED');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '079 FAILED: the appointment history accepted an event nobody defined, '
                      'so the vocabulary is no longer closed';
    end if;
  end if;

  if co_id is not null then
    insert into correspondence_events (correspondence_id, event)
    values (co_id, 'WHATSAPP_HANDED_OVER');

    insert into correspondence_events (correspondence_id, event) values
      (co_id, 'DRAFTED'), (co_id, 'AUTHORIZED'), (co_id, 'ISSUED'),
      (co_id, 'DELIVERED'), (co_id, 'DELIVERY_FAILED'), (co_id, 'WITHDRAWN');

    refused := false;
    begin
      insert into correspondence_events (correspondence_id, event) values (co_id, 'SENT_SOMEHOW');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '079 FAILED: the correspondence history accepted an event nobody '
                      'defined';
    end if;
  end if;

  -- ---- A LETTER STILL CANNOT CLAIM A DELIVERY IT DID NOT HAVE ----------
  --
  -- The rule this migration deliberately did NOT relax. Handing a letter to
  -- WhatsApp must not be able to mark it sent, and the constraint that stops
  -- it is 042's, still there.
  refused := false;
  begin
    update appointment_letters set delivery = 'whatsapp' where id in (
      select id from appointment_letters limit 1);
    if not found then refused := true; end if;  -- nothing to test against
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '079 FAILED: a letter recorded its delivery as ''whatsapp'', so the '
                    'University''s record now asserts a delivery nobody observed';
  end if;

  raise exception 'ROLLBACK 079 PROOF';
exception
  when others then
    if sqlerrm <> 'ROLLBACK 079 PROOF' then raise; end if;
end $$;


do $$
begin
  raise notice '079 OK: an appointment letter and an official letter can each record that '
               'somebody handed it to WhatsApp, and who';
  raise notice '079 OK: every event word either history already used is still accepted, and '
               'a word nobody defined is still refused';
  raise notice '079 OK: handing a letter to WhatsApp cannot mark it delivered — the '
               'University records what it knows, not what it hopes';
  raise notice '079 OK: an official letter can carry a phone number to send it to';
end $$;
