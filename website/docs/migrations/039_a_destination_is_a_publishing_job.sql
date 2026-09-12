-- ===========================================================================
-- 039 — A DESTINATION IS A PUBLISHING JOB, AND IT KEEPS ITS OWN RECEIPT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A destination stops being a state and becomes a job. It gains the
--    platform's own post id, its own scheduled time, a retry count and the time
--    of the last attempt — so "Instagram published, LinkedIn failed, X is
--    scheduled for Saturday" is a thing the row can say rather than a thing
--    somebody works out.
--
-- 2. THE FEATURED IMAGE COLUMNS ARE DROPPED and replaced by a media table.
--    `announcements.image_path` and `image_alt` held exactly one picture, and
--    an announcement about a graduation has more than one. Anything already in
--    them is copied across first, as the first item, so nothing is lost.
--
-- 3. Engagement figures get somewhere to live, and NOTHING IS WRITTEN INTO IT.
--    See section 4 — the table exists, the collection does not, and a
--    communications dashboard showing zeros would be worse than one showing
--    nothing at all.
--
-- ---------------------------------------------------------------------------
-- WHAT ALREADY EXISTED AND IS NOT REBUILT HERE
-- ---------------------------------------------------------------------------
--
-- The connections themselves. 013 built `social_accounts` — per platform, with
-- the University's own scope separate from a person's, the OAuth scopes stored,
-- and the access and refresh tokens held in 017's sealed store with only a
-- POINTER on the row. No social media password is stored anywhere in this
-- system and none can be: there is no column for one.
--
-- The scopes 013's provider registry already names are the ones publishing
-- actually requires — `w_organization_social` for LinkedIn, `tweet.write` for
-- X, `pages_manage_posts` for a Facebook Page — and the screen that connects
-- them is already mounted under Settings.
-- ===========================================================================


-- ===========================================================================
-- 1. THE DESTINATION AS A JOB
-- ===========================================================================

alter table announcement_destinations
  -- THE PLATFORM'S OWN ID, which is a different thing from ours. `social_post_id`
  -- points at the post inside this system; this is what Facebook or LinkedIn
  -- called it. Without it there is no way to fetch engagement for this
  -- announcement, no way to delete the right post when something is retracted,
  -- and no way to prove the publication happened at all.
  add column if not exists platform_post_id text,

  -- PER DESTINATION, NOT PER ANNOUNCEMENT. The portal now and X on Saturday
  -- morning is a real thing a communications office wants, and an announcement
  -- with one scheduled time cannot express it.
  add column if not exists scheduled_for   timestamptz,

  -- HOW MANY TIMES THIS HAS BEEN TRIED. A destination that has failed eleven
  -- times is not the same as one that has failed once, and the difference
  -- decides whether somebody retries it or goes and looks at the connection.
  add column if not exists retry_count     integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

do $$
begin
  -- A retry count cannot run backwards, and a destination that has been tried
  -- has a time it was tried at. Both are the kind of thing that stays true
  -- until one piece of code updates the count without the timestamp.
  if not exists (select 1 from pg_constraint where conname = 'announcement_destinations_attempts') then
    alter table announcement_destinations add constraint announcement_destinations_attempts
      check (retry_count >= 0 and (retry_count = 0 or last_attempt_at is not null));
  end if;

  -- A DELIVERED DESTINATION SAYS WHERE IT LANDED. Not for tidiness: without
  -- the platform's id or a URL, "published to LinkedIn" is a claim with
  -- nothing behind it, and the first person to ask "where?" cannot be answered.
  -- The portal is exempt, because the portal is this system and the
  -- announcement's own id is where it landed.
  if not exists (select 1 from pg_constraint where conname = 'announcement_destinations_receipt') then
    alter table announcement_destinations add constraint announcement_destinations_receipt
      check (
        state <> 'delivered'
        or destination in ('portal', 'website')
        or platform_post_id is not null
        or external_url is not null
      );
  end if;
end $$;

create index if not exists announcement_destinations_due_idx
  on announcement_destinations (scheduled_for)
  where state = 'pending' and scheduled_for is not null;

comment on column announcement_destinations.platform_post_id is
  'What the platform called this post. Needed to fetch engagement, to remove the '
  'right post on a retraction, and to show that the publication happened.';


-- ===========================================================================
-- 2. THE MEDIA, WHICH IS MORE THAN ONE PICTURE
-- ===========================================================================
--
-- ALT TEXT IS NOT NULL, exactly as 013 made it for social media, and for the
-- reason given there: a prospective student using a screen reader is exactly
-- the reader the institution is addressing, and a graduation photograph that
-- reaches them as "image" has excluded them from the announcement. Every
-- platform this is published to carries the omission onward.

create table if not exists announcement_media (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements (id) on delete cascade,

  storage_path    text not null,
  kind            text not null default 'image' check (kind in ('image', 'video')),
  alt_text        text not null check (length(btrim(alt_text)) >= 3),

  -- 0 is the featured item — the one a card shows and the one a platform that
  -- accepts a single image is given.
  ordinal         integer not null default 0 check (ordinal >= 0),

  created_at      timestamptz not null default now(),

  unique (announcement_id, ordinal)
);

create index if not exists announcement_media_announcement_idx
  on announcement_media (announcement_id, ordinal);

alter table announcement_media enable row level security;

drop policy if exists announcement_media_read on announcement_media;
create policy announcement_media_read on announcement_media
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
    or exists (select 1 from announcements a
                where a.id = announcement_media.announcement_id and a.status = 'published')
  );

-- The one image the old columns held, moved rather than abandoned.
do $$
declare
  moved integer := 0;
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'announcements'
                and column_name = 'image_path') then
    insert into announcement_media (announcement_id, storage_path, alt_text, ordinal)
    select a.id, a.image_path, coalesce(nullif(btrim(a.image_alt), ''), 'Image'), 0
      from announcements a
     where a.image_path is not null
       and not exists (select 1 from announcement_media m where m.announcement_id = a.id);
    get diagnostics moved = row_count;

    -- DROPPED, so there is one place an announcement's pictures live. Two
    -- would disagree within a month of somebody adding a second image.
    alter table announcements drop column if exists image_path;
    alter table announcements drop column if exists image_alt;
  end if;
  raise notice '039: % featured image(s) moved into the media table', moved;
end $$;


-- ===========================================================================
-- 3. WHAT WAS PUBLISHED, WORD FOR WORD, AT EACH VERSION
-- ===========================================================================
--
-- 038's `announcement_events` already carries `title_then` and `body_then`, so
-- the wording at every step is kept. What it cannot answer is "which version
-- went to LinkedIn" once an announcement has been edited and republished —
-- because the event says what the master said, and LinkedIn received an
-- adaptation of it.
--
-- So a destination records the exact text it was sent. Not a reference to a
-- variant that may since have been rewritten: THE TEXT. This is the only thing
-- in the system that can answer "what does our LinkedIn post actually say"
-- without asking LinkedIn.

alter table announcement_destinations
  add column if not exists published_text text;

comment on column announcement_destinations.published_text is
  'The exact words sent to this destination, kept because a variant can be '
  'rewritten afterwards and a published post cannot.';


-- ===========================================================================
-- 4. ENGAGEMENT — A PLACE FOR IT, AND NOTHING IN IT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- READ THIS BEFORE BUILDING A DASHBOARD ON IT
-- ---------------------------------------------------------------------------
--
-- This table is created empty and NOTHING IN THIS SYSTEM WRITES TO IT YET.
-- Collecting engagement means calling each platform's own API with the
-- University's connected credentials — LinkedIn's organization statistics, the
-- Meta Graph insights, X's post metrics — and that code does not exist.
--
-- The table is here so the shape is settled before anybody writes it, and so
-- the screen can say "not collected" rather than showing a zero. A zero and an
-- unknown look identical on a dashboard and mean completely different things:
-- one says nobody engaged and the other says nobody asked. An institution that
-- reports the first when the second is true is publishing a figure about itself
-- that it made up.
--
-- ---------------------------------------------------------------------------
-- WHY EACH ROW IS ONE MEASUREMENT AND NOT ONE COLUMN PER METRIC
-- ---------------------------------------------------------------------------
--
-- Because the metrics differ per platform and change without notice. A table
-- with `reach`, `reactions`, `impressions`, `reposts`, `views` has a column for
-- every platform's vocabulary and nulls everywhere else, and gains a migration
-- every time a network renames something. And because a metric is a reading at
-- a MOMENT: reach on the day is not reach a week later, and a single number
-- overwritten each time destroys the only interesting thing about it.

create table if not exists announcement_metrics (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references announcement_destinations (id) on delete cascade,

  -- The platform's own name for it, lowercased: 'reach', 'impressions',
  -- 'reactions', 'likes', 'comments', 'shares', 'reposts', 'views', 'clicks'.
  -- NOT a closed vocabulary, on purpose: a CHECK constraint here would mean a
  -- migration every time a network invents a metric, and the cost of an unknown
  -- metric name is that a screen does not know how to label it.
  metric         text not null check (length(btrim(metric)) > 0),
  value          bigint not null check (value >= 0),

  -- WHEN THIS WAS TRUE, which is not when it was written. A reading taken at
  -- noon and stored at midnight is a reading from noon.
  measured_at    timestamptz not null,
  collected_at   timestamptz not null default now(),

  -- Which reading this is, so a chart can be drawn and a correction does not
  -- overwrite the thing it corrects.
  unique (destination_id, metric, measured_at)
);

create index if not exists announcement_metrics_destination_idx
  on announcement_metrics (destination_id, metric, measured_at desc);

alter table announcement_metrics enable row level security;

drop policy if exists announcement_metrics_read on announcement_metrics;
create policy announcement_metrics_read on announcement_metrics
  for select using (auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office'));

-- No write policy. Figures about the University's own reach are written by the
-- collector running as the service role, never by a browser — a number about
-- the institution that somebody could type is not a measurement.

-- The most recent reading of each metric, which is what a dashboard wants and
-- what it would otherwise compute wrongly.
create or replace view announcement_engagement
with (security_invoker = true) as
select distinct on (m.destination_id, m.metric)
       d.announcement_id,
       d.destination,
       m.metric,
       m.value,
       m.measured_at
  from announcement_metrics m
  join announcement_destinations d on d.id = m.destination_id
 order by m.destination_id, m.metric, m.measured_at desc;


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  d_id uuid;
  someone uuid;
begin
  select id into someone from auth.users limit 1;
  if someone is null then
    raise notice '039: no accounts yet, so the rules could not be exercised against one';
    return;
  end if;

  begin
    insert into announcements (title, body, author_id, status, audiences)
    values ('Proof 039 announcement', 'A body long enough to satisfy the length constraint.',
            someone, 'draft', array['staff']::text[])
    returning id into a_id;

    insert into announcement_destinations (announcement_id, destination)
    values (a_id, 'linkedin') returning id into d_id;

    -- ---- A DELIVERED DESTINATION SAYS WHERE IT LANDED --------------------
    -- "Published to LinkedIn" with nothing behind it cannot be answered when
    -- somebody asks "where?".
    refused := false;
    begin
      update announcement_destinations set state = 'delivered' where id = d_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '039 FAILED: a destination was marked delivered with no platform post id '
                      'and no URL, so the publication cannot be shown to anybody';
    end if;

    -- …and with one, it is accepted.
    update announcement_destinations
       set state = 'delivered', platform_post_id = 'urn:li:share:12345'
     where id = d_id;

    -- The portal is exempt, because the portal is this system.
    insert into announcement_destinations (announcement_id, destination, state)
    values (a_id, 'portal', 'delivered');

    -- ---- A RETRY COUNT IMPLIES AN ATTEMPT --------------------------------
    refused := false;
    begin
      update announcement_destinations set retry_count = 3 where id = d_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '039 FAILED: a destination was tried three times at no particular time';
    end if;

    -- ---- MEDIA IS DESCRIBED ----------------------------------------------
    refused := false;
    begin
      insert into announcement_media (announcement_id, storage_path, alt_text)
      values (a_id, 'a/b.jpg', '');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '039 FAILED: an image was stored with no description, and every network '
                      'this is published to would carry that omission onward';
    end if;

    insert into announcement_media (announcement_id, storage_path, alt_text, ordinal)
    values (a_id, 'a/b.jpg', 'Graduands on the steps of the main hall', 0);

    -- ---- ONE FEATURED ITEM -----------------------------------------------
    refused := false;
    begin
      insert into announcement_media (announcement_id, storage_path, alt_text, ordinal)
      values (a_id, 'a/c.jpg', 'A different photograph', 0);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '039 FAILED: two images claimed to be the featured one, so which a card '
                      'shows is a coin toss';
    end if;

    -- ---- A MEASUREMENT IS A READING AT A MOMENT ---------------------------
    insert into announcement_metrics (destination_id, metric, value, measured_at)
    values (d_id, 'impressions', 100, now() - interval '1 day');
    insert into announcement_metrics (destination_id, metric, value, measured_at)
    values (d_id, 'impressions', 400, now());

    if (select count(*) from announcement_metrics where destination_id = d_id) <> 2 then
      raise exception '039 FAILED: the later reading replaced the earlier one instead of '
                      'joining it, so the only interesting thing about a metric is gone';
    end if;
    if (select value from announcement_engagement
         where destination = 'linkedin' and metric = 'impressions') <> 400 then
      raise exception '039 FAILED: the engagement view did not return the most recent reading';
    end if;

    -- A negative reading is not a reading.
    refused := false;
    begin
      insert into announcement_metrics (destination_id, metric, value, measured_at)
      values (d_id, 'likes', -5, now());
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '039 FAILED: a negative engagement figure was accepted';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '039 OK: a delivered destination shows where it landed, a retry count implies an '
               'attempt, media is described and has one featured item, and a measurement is a '
               'reading at a moment rather than a number that overwrites itself';
end $$;

-- AND THE ENGAGEMENT TABLE IS EMPTY, which is the honest state until somebody
-- writes the collector. A dashboard built on this must say "not collected"
-- rather than "0" — they look identical and mean opposite things.
do $$
declare
  n integer;
begin
  select count(*) into n from announcement_metrics;
  if n = 0 then
    raise notice '039: no engagement has been collected. Nothing writes to '
                 'announcement_metrics yet — the collector for each platform''s API is not '
                 'built, and a screen must say so rather than show zeros.';
  else
    raise notice '039: % engagement reading(s) already collected', n;
  end if;
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- The publishing board: every destination of every announcement, as a job.
select a.title,
       d.destination,
       d.state,
       d.retry_count,
       d.scheduled_for,
       coalesce(d.platform_post_id, d.external_url) as receipt,
       left(coalesce(d.error, ''), 80) as error
  from announcements a
  join announcement_destinations d on d.announcement_id = a.id
 order by a.created_at desc, d.destination;

-- DESTINATIONS THAT NEED A PERSON. Failed, or tried more than twice.
select a.title, d.destination, d.retry_count, d.last_attempt_at, d.error
  from announcement_destinations d
  join announcements a on a.id = d.announcement_id
 where d.state = 'failed' or d.retry_count > 2
 order by d.retry_count desc;

-- Anything due to go out.
select a.title, d.destination, d.scheduled_for
  from announcement_destinations d
  join announcements a on a.id = d.announcement_id
 where d.state = 'pending' and d.scheduled_for is not null
 order by d.scheduled_for;

-- Engagement, latest reading per metric. Empty until a collector exists.
select * from announcement_engagement order by announcement_id, destination, metric;

-- The connected accounts publishing depends on, and whether each is usable.
-- Nothing here is a password: 013 keeps a POINTER to the token in 017's store.
select platform, scope, handle, status, token_expires_at, cardinality(scopes) as scopes_granted
  from social_accounts
 where scope = 'university'
 order by platform;
