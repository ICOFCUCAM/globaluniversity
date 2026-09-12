-- ===========================================================================
-- 046 — THE CORRESPONDENCE HISTORY, AND THE LETTER SOMEBODY ELSE PREPARES
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. OFFICIAL CORRESPONDENCE GETS A HISTORY. 045 built the register and then —
--    this is the omission — left it as the only institutional act in this
--    system with no append-only record of who did what to it. An appointment
--    has `appointment_events`, an announcement has `announcement_events`, a
--    credential has its audit. A letter to a ministry had the row and the row's
--    current state, and nothing that said it had ever been anything else.
--
-- 2. "PREPARE THIS LETTER" BECOMES A REAL ACT. The Vice-Chancellor can hand a
--    letter to an administrator with a brief, before the letter exists. That
--    was not storable: 045 requires forty characters of body, and the whole
--    point of a delegated draft is that the body has not been written yet.
--
-- 3. A REFERENCE CAN BE ALLOCATED WITHOUT A RACE. `next_correspondence_sequence`
--    reads the register rather than the application counting rows and hoping.
--    Two officers issuing at the same second previously had a real chance of
--    both being handed VC-2026-0007.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THE BODY CHECK IS RELAXED FOR EXACTLY ONE STATE. A letter in `preparing` may
-- have no body, because nobody has written it. In every other state — draft
-- included — the forty characters are still required, so the relaxation cannot
-- be used to authorise or issue an empty letter. The state it applies to is the
-- one state from which a letter cannot be authorised at all.
-- ===========================================================================


-- ===========================================================================
-- 1. THE HISTORY
-- ===========================================================================
--
-- The same shape as `appointment_events`, deliberately. A third arrangement for
-- the same job would be a third answer to "what happened to this document", and
-- the person asking is usually asking because something went wrong.

create table if not exists correspondence_events (
  id                uuid primary key default gen_random_uuid(),
  correspondence_id uuid not null references correspondence (id) on delete cascade,

  -- A CLOSED LIST, and 'PREPARATION_REQUESTED' is in it because delegating is
  -- an act of the authority and not a change of status that happened by itself.
  event             text not null check (event in (
                      'DRAFTED', 'EDITED', 'PREPARATION_REQUESTED', 'PREPARED',
                      'SUBMITTED_TO_AUTHORITY', 'AUTHORIZED', 'RETURNED', 'SCHEDULED',
                      'LETTER_GENERATED', 'ISSUED', 'DELIVERED', 'DELIVERY_FAILED',
                      'LETTER_SUPERSEDED', 'WITHDRAWN')),

  actor_id          uuid references auth.users (id) on delete set null,
  actor_email       text,
  actor_role        text,

  previous_state    text,
  new_state         text,
  detail            text,
  metadata          jsonb,

  at                timestamptz not null default now()
);

create index if not exists correspondence_events_letter_idx
  on correspondence_events (correspondence_id, at);

-- ---------------------------------------------------------------------------
-- APPEND-ONLY, ENFORCED RATHER THAN INTENDED.
--
-- A history that can be edited is a history that will be, at the moment
-- somebody most wants it to say something else.
-- ---------------------------------------------------------------------------
create or replace function refuse_correspondence_history_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'The correspondence history cannot be changed. It records what was done and when, and a '
    'record that can be corrected afterwards is not a record.'
    using errcode = 'check_violation';
end $$;

drop trigger if exists correspondence_events_append_only on correspondence_events;
create trigger correspondence_events_append_only
  before update or delete on correspondence_events
  for each row execute function refuse_correspondence_history_edit();


-- ===========================================================================
-- 2. DELEGATED PREPARATION
-- ===========================================================================
--
-- "Prepare this letter", assigned to an administrator. The authority does not
-- move with it: `prepared_by` is recorded, and 045's
-- `correspondence_preparer_is_not_authority` still refuses that person to
-- authorise what they prepared.

alter table correspondence
  -- WHAT THE AUTHORITY ASKED FOR. A delegation with no instruction is not a
  -- delegation; it is a task somebody has to come back and ask about.
  add column if not exists preparation_brief text,
  add column if not exists preparation_requested_by uuid references auth.users (id) on delete set null,
  add column if not exists preparation_requested_at timestamptz,
  add column if not exists prepared_at timestamptz;

-- A letter being prepared has nothing in it yet, so it needs a body it can hold.
alter table correspondence alter column body set default '';

do $$
declare
  c record;
begin
  -- ---------------------------------------------------------------------
  -- THE BODY CHECK, RESTATED FOR ONE STATE.
  --
  -- 045 wrote it inline, so it carries whatever name Postgres generated. Found
  -- by its definition rather than by guessing at `correspondence_body_check`,
  -- which is the name on one server and not on another.
  -- ---------------------------------------------------------------------
  for c in
    select conname from pg_constraint
     where conrelid = 'correspondence'::regclass
       and contype = 'c'
       and conname <> 'correspondence_body_written_before_it_goes'
       and pg_get_constraintdef(oid) like '%btrim(body)%'
  loop
    execute format('alter table correspondence drop constraint %I', c.conname);
  end loop;

  if not exists (select 1 from pg_constraint
                  where conname = 'correspondence_body_written_before_it_goes') then
    alter table correspondence add constraint correspondence_body_written_before_it_goes
      check (status = 'preparing' or length(btrim(body)) >= 40);
  end if;

  -- A LETTER WITH A PREPARER NAMES THEM. `preparing` without a `prepared_by` is
  -- a letter handed to nobody, sitting in a queue no office can see.
  if not exists (select 1 from pg_constraint
                  where conname = 'correspondence_preparing_names_the_preparer') then
    alter table correspondence add constraint correspondence_preparing_names_the_preparer
      check (status <> 'preparing' or prepared_by is not null);
  end if;

  -- AND THE BRIEF IS SAID, not left to a corridor conversation. Twenty
  -- characters is not a specification; it is enough to refuse an empty one.
  if not exists (select 1 from pg_constraint
                  where conname = 'correspondence_delegation_says_what_for') then
    alter table correspondence add constraint correspondence_delegation_says_what_for
      check (preparation_requested_by is null
             or (preparation_brief is not null
                 and length(btrim(preparation_brief)) >= 20));
  end if;
end $$;

comment on column correspondence.preparation_brief is
  'What the authority asked the preparer to write. Recorded because the letter that comes '
  'back is judged against it, and because "you did not ask for that" is otherwise one '
  'person''s memory against another''s.';


-- ===========================================================================
-- 3. THE REFERENCE, ALLOCATED BY THE REGISTER
-- ===========================================================================
--
-- COUNTED IN THE DATABASE, NOT IN THE APPLICATION. Two officers issuing in the
-- same second both read "six letters this year" and both wrote VC-2026-0007;
-- the unique index caught the second, which meant an officer saw a failure at
-- the moment of issuing an official letter and had no idea why.

create or replace function next_correspondence_sequence(prefix text, yr integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if prefix is null or prefix !~ '^[A-Z]{2,4}$' then
    raise exception 'Not an office prefix: %', coalesce(prefix, 'null')
      using errcode = 'check_violation';
  end if;
  if yr is null or yr < 2000 or yr > 2999 then
    raise exception 'Not a year this register runs in: %', coalesce(yr::text, 'null')
      using errcode = 'check_violation';
  end if;

  select coalesce(max(substring(reference from '[0-9]+$')::integer), 0) + 1
    into n
    from correspondence_letters
   where reference like prefix || '-' || yr::text || '-%';

  return n;
end $$;

comment on function next_correspondence_sequence(text, integer) is
  'The next sequence number for an office''s correspondence in a year. Read from the '
  'register rather than counted by the application, so two officers issuing at the same '
  'second are not handed the same reference.';


-- ===========================================================================
-- 4. WHO CAN READ THE HISTORY
-- ===========================================================================

alter table correspondence_events enable row level security;

drop policy if exists correspondence_events_staff_read on correspondence_events;
create policy correspondence_events_staff_read on correspondence_events
  for select to authenticated
  using (
    -- THE HISTORY IS AS VISIBLE AS THE LETTER AND NO MORE. A warning letter is
    -- not ordinary institutional information, and neither is the fact that one
    -- was drafted, returned and redrafted twice.
    exists (select 1 from correspondence c where c.id = correspondence_events.correspondence_id)
  );


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  c_id uuid;
  e_id uuid;
  someone uuid;
  other uuid;
  seq integer;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '046: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    -- ---- A DELEGATED DRAFT EXISTS BEFORE THE LETTER DOES -------------------
    -- The thing 045 could not store. If this insert fails, "prepare this
    -- letter" is still not an act the system can record.
    insert into correspondence
      (kind, subject, body, recipient_name, initiated_by, status,
       prepared_by, preparation_requested_by, preparation_requested_at, preparation_brief)
    values ('invitation', 'Convocation invitation', '',
            'The Ministry of Higher Education', someone, 'preparing',
            other, someone, now(),
            'Invite the Ministry to the convocation and ask for a representative to speak.')
    returning id into c_id;

    -- ---- BUT AN EMPTY LETTER CANNOT LEAVE THAT STATE -----------------------
    -- The relaxation above is the one that could be abused, so it is the one
    -- performed. A body of nothing must not become a draft, still less a letter.
    refused := false;
    begin
      update correspondence set status = 'draft' where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: a letter with no body in it became a draft, so the '
                      'relaxation for a delegated draft is a way to issue an empty letter';
    end if;

    -- ---- A DELEGATION SAYS WHAT FOR ---------------------------------------
    refused := false;
    begin
      update correspondence set preparation_brief = 'Write it.' where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: a letter was delegated with no brief worth the name';
    end if;

    -- ---- AND A LETTER BEING PREPARED NAMES ITS PREPARER --------------------
    refused := false;
    begin
      update correspondence set prepared_by = null where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: a letter was left in preparation by nobody in particular';
    end if;

    -- The preparer writes it, and now it is a draft the authority reads.
    update correspondence
       set body = 'The University would be honoured by the presence of the Ministry at its '
                  'convocation, and invites a representative to address the assembly.',
           status = 'awaiting_authority', prepared_at = now()
     where id = c_id;

    -- ---- THE HISTORY RECORDS IT, AND THEN CANNOT BE CHANGED ----------------
    insert into correspondence_events
      (correspondence_id, event, actor_id, previous_state, new_state, detail)
    values (c_id, 'PREPARATION_REQUESTED', someone, null, 'preparing',
            'Handed to an administrator to draft.')
    returning id into e_id;

    refused := false;
    begin
      update correspondence_events set detail = 'Something else.' where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: the correspondence history was rewritten';
    end if;

    refused := false;
    begin
      delete from correspondence_events where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: a line was removed from the correspondence history';
    end if;

    -- ---- AN EVENT NOBODY DEFINED IS REFUSED --------------------------------
    refused := false;
    begin
      insert into correspondence_events (correspondence_id, event, actor_id)
      values (c_id, 'SENT_BY_CARRIER_PIGEON', someone);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: the history accepted an event nobody defined';
    end if;

    -- ---- THE SEQUENCE COUNTS WHAT IS THERE ---------------------------------
    seq := next_correspondence_sequence('VC', 2026);
    if seq <> 1 then
      raise exception '046 FAILED: an empty register did not start at 1, it started at %', seq;
    end if;

    update correspondence
       set authorized_by = someone, authorized_at = now(), status = 'issued', issued_at = now()
     where id = c_id;

    insert into correspondence_letters (correspondence_id, reference, issued_on, html)
    values (c_id, 'VC-2026-0009', current_date, '<p>The letter.</p>');

    seq := next_correspondence_sequence('VC', 2026);
    if seq <> 10 then
      raise exception '046 FAILED: after VC-2026-0009 the next reference was %, not 10', seq;
    end if;

    -- …and another office counts separately, which is the point of the prefix.
    seq := next_correspondence_sequence('REG', 2026);
    if seq <> 1 then
      raise exception '046 FAILED: the Registrar''s register was affected by the '
                      'Vice-Chancellor''s, and started at %', seq;
    end if;

    -- ---- A PREFIX THAT IS NOT ONE IS REFUSED -------------------------------
    refused := false;
    begin
      seq := next_correspondence_sequence('vice-chancellor', 2026);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '046 FAILED: a reference was allocated under an office prefix that '
                      'cannot appear in a reference';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '046 OK: a delegated draft can exist before the letter does, and an empty one '
               'cannot leave that state';
  raise notice '046 OK: the correspondence history is append-only and its vocabulary closed';
  raise notice '046 OK: references are allocated by the register, per office, per year';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- What has happened to the University's correspondence, in order.
select e.event, count(*) as times
  from correspondence_events e
 group by 1
 order by 2 desc;

-- Letters currently sitting with a preparer, and how long they have been there.
select c.subject, c.originating_office, c.preparation_requested_at,
       date_trunc('day', now() - c.preparation_requested_at) as waiting
  from correspondence c
 where c.status = 'preparing'
 order by c.preparation_requested_at;
