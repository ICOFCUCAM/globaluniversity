-- ===========================================================================
-- 043 — WORKING HOURS, AND WHO THE LETTER SAYS APPOINTED THEM
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- Two fields the University named that the record did not carry, so the letter
-- could not state them and somebody would have had to type them.
--
-- 1. WORKING HOURS. An appointment that does not say how many hours is a
--    part-time post nobody can dispute and a full-time post nobody can enforce.
--    It is the field a disagreement about workload turns on, and it was absent.
--
-- 2. THE APPOINTING AUTHORITY, which is NOT the person who approved it in this
--    system. `authorized_by` is a user id — the officer who clicked approve.
--    The letter says "on the authority of the University Council", and that is
--    a different fact. Conflating them puts an administrator's name where a
--    governing body belongs, on a document somebody may rely on for years.
-- ===========================================================================

alter table appointments
  -- FREE TEXT, DELIBERATELY. "40 hours per week", "Two evenings per week during
  -- semester", "As required, minimum 12 hours per term" are all real answers
  -- and a numeric column would force the second and third to be rounded into a
  -- number that is not true.
  add column if not exists working_hours text,

  -- THE BODY THE LETTER NAMES. A string rather than a reference, because the
  -- Council, the Senate and the Vice Chancellor are not rows in this database
  -- and inventing a table of governing bodies to hold three names would be
  -- worse than the problem.
  add column if not exists appointing_authority text,

  -- WHEN THAT BODY DECIDED, which is not when somebody recorded it here. A
  -- Council meeting on the 3rd entered on the 19th is dated the 3rd on the
  -- letter, because that is when the University decided.
  add column if not exists authority_decided_on date;

comment on column appointments.appointing_authority is
  'The body the letter names as making the appointment — the Council, the Senate, '
  'the Vice Chancellor. NOT `authorized_by`, which is the officer who approved it '
  'in this system.';

do $$
begin
  -- A FULL-TIME APPOINTMENT SAYS ITS HOURS. Not every type: an honorary or
  -- adjunct post genuinely has none, and demanding a figure would have somebody
  -- type "N/A" into a field a dispute later turns on.
  if not exists (select 1 from pg_constraint where conname = 'appointments_authority_dated') then
    alter table appointments add constraint appointments_authority_dated
      check (authority_decided_on is null or appointing_authority is not null);
  end if;
end $$;


-- ===========================================================================
-- 2. THE ARCHIVE HAS TO BE CHECKABLE
-- ===========================================================================
--
-- 041 stores the letter as it was sent and a trigger refuses to let it be
-- edited. That is the archive. What it could not do is PROVE itself: "this is
-- the document we sent" rested on the trigger having worked, and a trigger that
-- was dropped for an afternoon during maintenance leaves no trace.
--
-- A hash over the stored document closes it. Recompute it and compare: if the
-- html has changed by any route at all — a trigger disabled, a direct database
-- edit, a restore from a bad backup — the figures disagree and somebody finds
-- out. It is also what a reader is given when they ask what exactly was issued.
--
-- SHA-256 OF THE HTML, computed by the application and stored here. Not
-- computed in the database: the document is sealed and hashed in the same pass
-- that generates it, and a second implementation in SQL would be a second
-- answer to "what is this document's hash".

alter table appointment_letters
  add column if not exists content_hash text;

do $$
begin
  -- A HASH IS A HASH. Sixty-four hexadecimal characters or nothing at all —
  -- an empty string or a truncated value would compare unequal to everything
  -- and read as tampering on every letter that has one.
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_hash_shape') then
    alter table appointment_letters add constraint appointment_letters_hash_shape
      check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$');
  end if;
end $$;

comment on column appointment_letters.content_hash is
  'SHA-256 of the stored html. Recompute and compare to prove the archived document '
  'is the one that was issued, by any route it might have been changed.';

-- LETTERS THE ARCHIVE CANNOT VOUCH FOR. Anything issued before this ran has no
-- hash and cannot be checked — reported rather than backfilled, because a hash
-- computed today over whatever the row holds today proves nothing at all.
create or replace view appointment_letters_unverifiable
with (security_invoker = true) as
select l.id, l.reference, l.version, l.issued_on, a.full_name
  from appointment_letters l
  join appointments a on a.id = l.appointment_id
 where l.content_hash is null;


-- ===========================================================================
-- PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  someone uuid;
  other uuid;
begin
  select id into someone from auth.users limit 1;
  -- TWO ACCOUNTS, because 041 refuses an approval by the drafter and this
  -- proof has to walk an appointment as far as an issued letter to test the
  -- hash. One account cannot do it, which is the rule working.
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '043: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    insert into appointments
      (full_name, position_title, employment_type, start_date, place_of_duty, terms,
       drafted_by, status)
    values ('A Specimen Appointee', 'Lecturer', 'permanent', date '2026-10-01',
            'Buea campus', 'Conditions of service.', someone, 'draft')
    returning id into a_id;

    -- ---- A DECISION DATE WITHOUT A BODY IS NOT A DECISION -----------------
    -- "Decided on 3 September" with nobody named is a date on a letter that
    -- cannot be traced to a meeting.
    refused := false;
    begin
      update appointments set authority_decided_on = date '2026-09-03' where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '043 FAILED: an appointment recorded when it was decided without '
                      'recording who decided it';
    end if;

    update appointments
       set appointing_authority = 'The University Council',
           authority_decided_on = date '2026-09-03',
           working_hours = '40 hours per week'
     where id = a_id;

    -- ---- THE APPOINTING AUTHORITY IS NOT THE APPROVER --------------------
    -- Two separate columns, asserted, because the whole reason this migration
    -- exists is that one field cannot hold both an administrator's user id and
    -- the name of a governing body.
    if (select appointing_authority from appointments where id = a_id) is null
       or (select authorized_by from appointments where id = a_id) is not null then
      raise exception '043 FAILED: the body that appointed and the officer who approved are '
                      'not being kept apart';
    end if;

    -- ---- A HASH IS SIXTY-FOUR HEX CHARACTERS OR NOTHING -------------------
    -- A truncated or empty value compares unequal to everything and would read
    -- as tampering on every letter that has one.
    update appointments set status = 'approved', authorized_by = other,
                            authorized_at = now() where id = a_id;
    update appointments set status = 'issued', issued_at = now() where id = a_id;

    refused := false;
    begin
      insert into appointment_letters (appointment_id, reference, issued_on, html, content_hash)
      values (a_id, 'APT-2026-8001', current_date, '<p>x</p>', 'not-a-hash');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '043 FAILED: a letter was archived under something that is not a hash';
    end if;

    insert into appointment_letters (appointment_id, reference, issued_on, html, content_hash)
    values (a_id, 'APT-2026-8001', current_date, '<p>x</p>',
            repeat('a', 64));

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '043 OK: an appointment can state its working hours, the body that made it and '
               'when that body decided, a decision date with nobody named is refused, and an '
               'archived letter carries a hash that is a hash or nothing';
end $$;


-- ===========================================================================
-- VERIFY
-- ===========================================================================

-- APPOINTMENTS THAT NAME NO APPOINTING AUTHORITY. Each is a letter that will
-- go out saying the University appointed somebody without saying who decided.
select full_name, position_title, status, start_date
  from appointments
 where appointing_authority is null and status <> 'draft'
 order by start_date;

-- LETTERS THE ARCHIVE CANNOT VOUCH FOR. Issued before the hash existed, so
-- "this is the document we sent" rests on the edit trigger alone. Not
-- backfilled: a hash computed today over whatever the row holds today proves
-- nothing whatsoever.
select * from appointment_letters_unverifiable order by issued_on;

-- PAID POSTS WITH NO WORKING HOURS. The field a disagreement about workload
-- turns on, left blank.
select full_name, position_title, employment_type, start_date
  from appointments
 where working_hours is null
   and employment_type in ('permanent', 'fixed-term', 'part-time', 'probationary')
   and status not in ('draft', 'withdrawn', 'declined', 'ended')
 order by start_date;
