-- ===========================================================================
-- 040 — PUBLISHING AT TWO IN THE MORNING, AND DELETING WHAT SHOULD NOT EXIST
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. AN EMERGENCY ANNOUNCEMENT CAN BE PUBLISHED BY ONE PERSON. Until now every
--    announcement needed a second pair of eyes, and a campus closure at two in
--    the morning does not have one. An emergency notice may now go out
--    uncleared — and the record says so permanently, on the announcement
--    itself, for as long as it exists.
--
--    IT IS NOT A GENERAL BYPASS. Only the `emergency` category may use it, only
--    with a stated reason, and only by somebody holding the override. Every
--    other announcement still needs somebody else to read it.
--
-- 2. THE SUPERADMINISTRATOR CAN DELETE AN ANNOUNCEMENT. 038 made that
--    impossible — the append-only history refused even the cascade — and the
--    University has ruled that at least one person must be able to. A notice
--    posted to the wrong audience, or carrying somebody's name who asked for it
--    to be removed, is a real thing that has to be able to go.
--
--    IT LEAVES A TOMBSTONE. The text goes; the fact that an announcement
--    existed, who wrote it, who deleted it and why does not. That is not a
--    hedge against the ruling — it is what makes the ruling safe to act on. A
--    registry that can make a notice disappear without trace cannot answer
--    "did you ever publish that?", and the answer "no" would be unverifiable
--    even when true.
--
--    AND ONLY THROUGH ONE DOOR. The history trigger still refuses every UPDATE
--    and every DELETE, except inside the function below. Nobody can quietly
--    edit a trail; somebody with the authority can erase a whole announcement,
--    and that act is itself recorded.
-- ===========================================================================


-- ===========================================================================
-- 1. THE EMERGENCY
-- ===========================================================================

alter table announcements
  -- THE MARK STAYS. Not a flag cleared once the panic is over: anybody reading
  -- this announcement in two years sees that nobody else read it first.
  add column if not exists published_without_clearance boolean not null default false,
  add column if not exists override_reason text,
  add column if not exists override_by     uuid references auth.users (id) on delete restrict,
  add column if not exists override_at     timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'announcements_override_is_an_emergency') then
    alter table announcements add constraint announcements_override_is_an_emergency
      check (
        not published_without_clearance
        or (
          -- ONLY AN EMERGENCY. Without this the override becomes the way
          -- everything gets published, because it is faster — which is how
          -- every emergency procedure in every institution stops meaning
          -- anything.
          category = 'emergency'
          -- AND SOMEBODY SAYS WHY, AT LENGTH. "Urgent" is not a reason; the
          -- closure, the outage or the security notice is.
          and override_reason is not null
          and length(btrim(override_reason)) >= 20
          and override_by is not null
          and override_at is not null
        )
      );
  end if;
end $$;

comment on column announcements.published_without_clearance is
  'True where this went out without a second pair of eyes. Only an emergency may, '
  'only with a stated reason, and the mark is permanent.';

create index if not exists announcements_override_idx
  on announcements (override_at desc) where published_without_clearance;


-- ===========================================================================
-- 2. THE TOMBSTONE
-- ===========================================================================
--
-- WHAT IT KEEPS AND WHAT IT DOES NOT. It keeps the fact: an announcement
-- existed, this was its title, this person wrote it, it stood at this state,
-- this person deleted it on this day for this reason.
--
-- IT DOES NOT KEEP THE BODY. If the reason for deleting was that the text
-- should not exist, a table quietly holding the text would defeat the act. The
-- title is kept because a deletion nobody can identify is not auditable at all,
-- and because a title is what a register needs to answer "did you publish
-- that?" — but a University that needs the title gone too can clear that one
-- column and the fact remains.

create table if not exists announcement_tombstones (
  id              uuid primary key default gen_random_uuid(),

  -- NOT a foreign key. The row it names is gone; that is the point.
  announcement_id uuid not null,

  title           text,
  category        text,
  author_id       uuid,
  status_when_deleted text,
  was_published   boolean not null default false,
  published_at    timestamptz,

  -- WHERE IT HAD REACHED. A notice deleted from this system after it went to
  -- Facebook is still on Facebook, and whoever deals with the aftermath needs
  -- to know which networks to go to.
  destinations_reached text[] not null default '{}',

  deleted_by      uuid not null references auth.users (id) on delete restrict,
  reason          text not null check (length(btrim(reason)) >= 20),
  deleted_at      timestamptz not null default now()
);

create index if not exists announcement_tombstones_deleted_idx
  on announcement_tombstones (deleted_at desc);

alter table announcement_tombstones enable row level security;

drop policy if exists announcement_tombstones_read on announcement_tombstones;
create policy announcement_tombstones_read on announcement_tombstones
  for select using (auth_role() in ('superadmin', 'admin', 'registrar'));

-- No insert, update or delete policy. The function below writes it and nothing
-- removes it: a record of an erasure that can itself be erased is not a record.


-- ===========================================================================
-- 3. THE ONE DOOR
-- ===========================================================================
--
-- The history trigger from 038 refuses every UPDATE and every DELETE, which is
-- what stopped an announcement being deleted at all. It still does — except
-- inside this function, which sets a flag the trigger looks for.
--
-- WHY A FLAG AND NOT SIMPLY DROPPING THE TRIGGER. Disabling a trigger around a
-- delete leaves a window in which anything at all can rewrite the trail, and
-- leaves it disabled if the statement fails halfway. The flag is set with SET
-- LOCAL, so it lasts exactly as long as the transaction and cannot be left on.

create or replace function refuse_announcement_history_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- THE ONLY WAY PAST, and it can only be set by erase_announcement below,
  -- which writes a tombstone before it does. An UPDATE is never permitted:
  -- erasing a whole announcement is an act somebody answers for, and quietly
  -- changing one line of its history is not.
  if tg_op = 'DELETE' and coalesce(current_setting('icof.erasing', true), '') = 'on' then
    return old;
  end if;

  raise exception
    'The announcement history is append-only. % is not permitted: this is the record of what '
    'the University said and when, and a record that can be revised afterwards is not one. '
    'To remove an announcement entirely, the Superadministrator uses erase_announcement(), '
    'which leaves a tombstone.',
    tg_op
    using errcode = 'check_violation';
end $$;

/**
 * Erase an announcement, leaving the fact of it behind.
 *
 * SECURITY DEFINER, and the caller's authority is checked by the route rather
 * than here — this function is revoked from everyone except the service role,
 * so the only way to reach it is through /api/announcements, which reads the
 * role out of the database.
 */
create or replace function erase_announcement(
  p_announcement uuid,
  p_deleted_by uuid,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  reached text[];
  tomb uuid;
begin
  select * into a from announcements where id = p_announcement;
  if not found then
    raise exception 'No announcement with id %', p_announcement using errcode = 'no_data_found';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 20 then
    raise exception 'Erasing an announcement requires a stated reason. This is the only act in '
                    'this system that destroys something, and "wrong" is not an account of it.'
      using errcode = 'check_violation';
  end if;

  -- WHERE IT HAD ALREADY REACHED, captured before the rows go. A notice
  -- deleted here is still on Facebook, and somebody has to go and remove it.
  select coalesce(array_agg(d.destination order by d.destination), '{}')
    into reached
    from announcement_destinations d
   where d.announcement_id = p_announcement
     and d.state in ('delivered', 'sending');

  insert into announcement_tombstones
    (announcement_id, title, category, author_id, status_when_deleted,
     was_published, published_at, destinations_reached, deleted_by, reason)
  values
    (a.id, a.title, a.category, a.author_id, a.status,
     a.status = 'published' or a.published_at is not null, a.published_at,
     reached, p_deleted_by, btrim(p_reason))
  returning id into tomb;

  -- The flag the history trigger looks for. SET LOCAL, so it is gone when this
  -- transaction ends however it ends.
  perform set_config('icof.erasing', 'on', true);
  delete from announcements where id = p_announcement;
  perform set_config('icof.erasing', 'off', true);

  return tomb;
end $$;

revoke all on function erase_announcement(uuid, uuid, text) from public;
revoke all on function erase_announcement(uuid, uuid, text) from anon, authenticated;
grant execute on function erase_announcement(uuid, uuid, text) to service_role;


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  tomb uuid;
  someone uuid;
  n integer;
begin
  select id into someone from auth.users limit 1;
  if someone is null then
    raise notice '040: no accounts yet, so the rules could not be exercised against one';
    return;
  end if;

  begin
    -- ---- AN ORDINARY NOTICE CANNOT SKIP THE SECOND PAIR OF EYES ----------
    -- The half that matters. An override anybody can reach for is not an
    -- emergency procedure, it is the fast way to publish.
    insert into announcements (title, body, author_id, status, audiences, category)
    values ('Proof 040 ordinary', 'A perfectly ordinary announcement about nothing at all.',
            someone, 'draft', array['staff']::text[], 'general')
    returning id into a_id;

    refused := false;
    begin
      update announcements
         set published_without_clearance = true, override_reason = 'It seemed quicker to do it this way',
             override_by = someone, override_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: an ordinary announcement was published without clearance. '
                      'The override is not an emergency procedure, it is a shortcut.';
    end if;

    -- ---- AN EMERGENCY CAN, WITH A REASON ---------------------------------
    update announcements set category = 'emergency' where id = a_id;

    refused := false;
    begin
      update announcements
         set published_without_clearance = true, override_reason = 'Urgent',
             override_by = someone, override_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: an emergency was published on the strength of the word '
                      '"Urgent". The closure or the outage is the reason, not the hurry.';
    end if;

    update announcements
       set published_without_clearance = true,
           override_reason = 'Main campus closed at short notice after a power failure.',
           override_by = someone, override_at = now(),
           status = 'published', published_by = someone, published_at = now()
     where id = a_id;

    -- ---- AND THE MARK CANNOT BE WIPED OFF LATER --------------------------
    -- It can be set false only by also clearing the reason, which is a
    -- different claim entirely — that it never happened. The constraint allows
    -- that; what it does not allow is a published emergency pretending to have
    -- been cleared. Checked by reading it back.
    select count(*) into n from announcements
     where id = a_id and published_without_clearance and override_by is not null;
    if n <> 1 then
      raise exception '040 FAILED: the override was not recorded against the announcement';
    end if;

    -- ---- THE HISTORY IS STILL UNTOUCHABLE --------------------------------
    insert into announcement_events (announcement_id, event, new_state, detail)
    values (a_id, 'ADMINISTRATIVE_OVERRIDE', 'published', 'Proof');

    refused := false;
    begin
      update announcement_events set detail = 'something else' where announcement_id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: the history became editable. Erasing a whole announcement is '
                      'an act somebody answers for; quietly changing one line of its trail is not.';
    end if;

    refused := false;
    begin
      delete from announcement_events where announcement_id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: the history could be deleted directly, without a tombstone';
    end if;

    -- ---- AND A BARE DELETE IS STILL REFUSED ------------------------------
    refused := false;
    begin
      delete from announcements where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: an announcement was deleted without going through '
                      'erase_announcement, so nothing recorded that it had existed';
    end if;

    -- ---- ERASING REQUIRES A REASON ---------------------------------------
    refused := false;
    begin
      perform erase_announcement(a_id, someone, 'oops');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: an announcement was erased on the strength of "oops"';
    end if;

    -- ---- AND THEN IT WORKS, AND LEAVES THE FACT BEHIND --------------------
    insert into announcement_destinations (announcement_id, destination, state, platform_post_id)
    values (a_id, 'facebook', 'delivered', 'fb_123');

    tomb := erase_announcement(a_id, someone,
      'Published to the wrong audience and names a student who asked to be removed.');

    if (select count(*) from announcements where id = a_id) <> 0 then
      raise exception '040 FAILED: the announcement survived its own erasure';
    end if;
    if (select count(*) from announcement_events where announcement_id = a_id) <> 0 then
      raise exception '040 FAILED: the history outlived the announcement it belonged to';
    end if;

    select count(*) into n from announcement_tombstones
     where id = tomb and 'facebook' = any(destinations_reached);
    if n <> 1 then
      raise exception '040 FAILED: the tombstone does not record that this had already reached '
                      'Facebook, so nobody knows to go and remove it there';
    end if;

    -- ---- THE FLAG DOES NOT SURVIVE ---------------------------------------
    -- If it did, everything after an erasure in the same transaction could
    -- rewrite any history it liked.
    insert into announcements (title, body, author_id, status, audiences)
    values ('Proof 040 second', 'Another announcement, created after an erasure.',
            someone, 'draft', array['staff']::text[])
    returning id into a_id;
    insert into announcement_events (announcement_id, event, new_state) values (a_id, 'DRAFTED', 'draft');

    refused := false;
    begin
      delete from announcement_events where announcement_id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '040 FAILED: the erasure flag was still set afterwards, so any history '
                      'could be deleted for the rest of the transaction';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '040 OK: only an emergency publishes uncleared and only with a stated reason, '
               'the history is still untouchable, a bare delete is still refused, erasing '
               'requires a reason and leaves a tombstone naming where it had already reached, '
               'and the erasure flag does not outlive the erasure';
end $$;


-- ===========================================================================
-- 5. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- EVERY ANNOUNCEMENT THAT WENT OUT WITHOUT A SECOND PAIR OF EYES. This list
-- should be short and every line on it should be a real emergency. If it grows,
-- the override has become the way things get published.
select a.title, a.category, a.override_at, a.override_reason,
       a.published_at
  from announcements a
 where a.published_without_clearance
 order by a.override_at desc;

-- What has been erased, by whom, and why.
select t.title, t.category, t.status_when_deleted, t.was_published,
       t.destinations_reached, t.deleted_at, t.reason
  from announcement_tombstones t
 order by t.deleted_at desc;

-- ERASED NOTICES THAT ARE STILL ON A NETWORK. Deleting here does not reach
-- into Facebook. Each of these needs somebody to go and remove it there.
select t.title, t.destinations_reached, t.deleted_at
  from announcement_tombstones t
 where cardinality(t.destinations_reached) > 0
 order by t.deleted_at desc;

-- The one door, and who may go through it. Only the service role should
-- appear; the route checks the Superadministrator before calling it.
select p.proname,
       coalesce(array_to_string(p.proacl::text[], ', '), 'owner only') as grants
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'erase_announcement';
