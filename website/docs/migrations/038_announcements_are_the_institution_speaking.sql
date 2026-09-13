-- ===========================================================================
-- 038 — AN ANNOUNCEMENT IS THE INSTITUTION SPEAKING, SO IT GETS A RECORD
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- Announcements stop being rows on the `documents` table and become records of
-- their own, with an author, a clearance, a publication and a history. Nothing
-- is deleted: section 6 COPIES the existing notices across and leaves the
-- originals exactly where they are, so a bad migration costs a re-run and not
-- the University's noticeboard.
--
-- IT CLOSES A DOOR. Until now anybody whose role was `admin` or `lecturer`
-- could put a notice on the University's noticeboard, alone, instantly, with
-- nobody named. From now on an announcement is composed by one person and
-- cleared by another, and the database refuses a clearance by the author —
-- including a Superadministrator who wrote it. If one person has been posting
-- notices unaided, that stops working on the day this runs, and that is the
-- point rather than a side effect.
--
-- ---------------------------------------------------------------------------
-- WHY IT IS NOT A SECOND PUBLISHER
-- ---------------------------------------------------------------------------
--
-- 013 and 014 already built the social pipeline: connected accounts, per
-- platform variants, an approval that refuses to let an author approve their
-- own post, per-target delivery states and retry. An announcement's EXTERNAL
-- destinations are fulfilled by that pipeline — `announcement_destinations`
-- carries `social_post_id` and the delivery is the post's — rather than by a
-- second set of credentials and a second idea of what published means.
--
-- The announcement is the canonical source. The networks are destinations.
-- There is one publisher.
-- ===========================================================================


-- ===========================================================================
-- 1. THE ANNOUNCEMENT
-- ===========================================================================

create table if not exists announcements (
  id             uuid primary key default gen_random_uuid(),

  title          text not null check (length(btrim(title)) >= 6),
  body           text not null check (length(btrim(body)) >= 20),

  -- ---- What it is about, and who it is for -------------------------------
  --
  -- BOTH CLOSED VOCABULARIES. The point of a category is to be the same word
  -- twice: a free-text field produces "Admissions", "admission", "ADMISSIONS"
  -- and "Admissions Office" within a month, and then nothing can be filtered.
  category       text not null default 'general'
                   check (category in ('general', 'admissions', 'academic', 'finance',
                                       'examination', 'graduation', 'events',
                                       'emergency', 'faculty')),

  -- MORE THAN ONE, AND AT LEAST ONE. An announcement addressed to nobody
  -- reaches nobody, and the array is checked element by element so a typo
  -- cannot create a sixth audience nobody has ever heard of.
  audiences      text[] not null default '{}',

  -- ---- The featured image ------------------------------------------------
  --
  -- ALT TEXT IS REQUIRED WHERE THERE IS AN IMAGE. 013 already requires it of
  -- social media, for the reason it gives: a university publishing an image
  -- with no alt text is publishing something a blind reader cannot see, and
  -- every platform carries the omission onward. Requiring less of the
  -- University's own noticeboard would be an odd place to draw the line.
  image_path     text,
  image_alt      text,

  -- ---- Authority ---------------------------------------------------------
  --
  -- Three people, potentially three different ones, and each recorded. The
  -- author is NOT NULL: a notice the University cannot attribute is a notice
  -- nobody will answer for.
  author_id      uuid not null references auth.users (id) on delete restrict,
  approved_by    uuid references auth.users (id) on delete restrict,
  approved_at    timestamptz,
  published_by   uuid references auth.users (id) on delete restrict,
  published_at   timestamptz,

  rejected_by    uuid references auth.users (id) on delete restrict,
  rejected_at    timestamptz,
  rejection_reason text,

  retracted_by   uuid references auth.users (id) on delete restrict,
  retracted_at   timestamptz,
  retraction_reason text,

  status         text not null default 'draft'
                   check (status in ('draft', 'submitted', 'approved', 'scheduled',
                                     'published', 'rejected', 'retracted')),

  -- ---- Scheduling --------------------------------------------------------
  --
  -- `publish_at` is an instant, stored as one. The TIMEZONE is kept beside it
  -- because "nine o'clock" is what somebody chose and an instant is not: if the
  -- University schedules a notice for 09:00 Africa/Kampala and the row carries
  -- only the UTC instant, nobody afterwards can say whether 06:00Z was meant as
  -- nine in Kampala or seven in London. It is also what a screen needs to show
  -- the choice back unchanged.
  publish_at     timestamptz,
  publish_timezone text not null default 'Africa/Kampala',

  -- When it stops being current. A notice about a closure still pinned in
  -- March is worse than no notice.
  expires_at     timestamptz,

  pinned         boolean not null default false,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists announcements_status_idx on announcements (status, publish_at);
create index if not exists announcements_published_idx
  on announcements (published_at desc) where status = 'published';

-- ---------------------------------------------------------------------------
-- THE AUTHOR MAY NOT CLEAR THEIR OWN ANNOUNCEMENT.
--
-- Enforced here rather than only in the route, because the route is one caller
-- and this is the rule. 005 requires it of a certificate design, 009 of a
-- grade, 014 of a social post; this is the same separation and the same
-- reason. One person writing, clearing and sending alone is how an
-- unconsidered sentence ends up on six networks under the University's name
-- with nobody having read it first.
--
-- IT APPLIES TO THE SUPERADMINISTRATOR TOO. Holding every capability is not
-- the same as being a second pair of eyes.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'announcements_second_pair_of_eyes') then
    alter table announcements add constraint announcements_second_pair_of_eyes
      check (approved_by is null or approved_by <> author_id);
  end if;

  -- A refusal and a retraction each have to say why. "Rejected" with no reason
  -- is a decision nobody can answer for, and the author cannot fix what they
  -- were not told.
  if not exists (select 1 from pg_constraint where conname = 'announcements_reasons_given') then
    alter table announcements add constraint announcements_reasons_given
      check (
        (status <> 'rejected'
          or (rejection_reason is not null and length(btrim(rejection_reason)) >= 12
              and rejected_by is not null))
        and
        (status <> 'retracted'
          or (retraction_reason is not null and length(btrim(retraction_reason)) >= 12
              and retracted_by is not null))
      );
  end if;

  -- A published announcement has a publisher and a time. Without this, a row
  -- can read `published` with no record of who did it or when — which is the
  -- state the noticeboard was in for every notice it ever carried.
  if not exists (select 1 from pg_constraint where conname = 'announcements_audiences_named') then
    alter table announcements add constraint announcements_audiences_named
      check (
        cardinality(audiences) > 0
        and audiences <@ array['students', 'applicants', 'staff', 'alumni', 'public']::text[]
      );
  end if;

  -- ONLY WHILE THE IMAGE LIVES ON THE ANNOUNCEMENT. 039 moves it into
  -- `announcement_media` — one announcement has more than one photograph — and
  -- drops these two columns, taking this constraint with them. Without the
  -- guard, running the bundle a second time tries to put a constraint back on
  -- a column that is deliberately gone, and stops dead.
  --
  -- THE RULE ITSELF DOES NOT LAPSE: 039 carries it to the new table, where the
  -- alt text column is NOT NULL.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'announcements'
                and column_name = 'image_path')
     and not exists (select 1 from pg_constraint where conname = 'announcements_image_described') then
    alter table announcements add constraint announcements_image_described
      check (image_path is null or (image_alt is not null and length(btrim(image_alt)) >= 3));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'announcements_publication_recorded') then
    alter table announcements add constraint announcements_publication_recorded
      check (status <> 'published'
             or (published_by is not null and published_at is not null));
  end if;
end $$;


-- ===========================================================================
-- 2. WHERE IT WAS PUBLISHED, ONE ROW PER DESTINATION
-- ===========================================================================
--
-- ONE FLAG ON THE ANNOUNCEMENT WOULD BE A LIE. "Published" is true when one
-- network accepted it and five refused, and the person who has to fix it needs
-- to know which. This is the same shape the social pipeline already uses for
-- its targets, deliberately: it is the same question.

create table if not exists announcement_destinations (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements (id) on delete cascade,

  -- 'portal' and 'website' are published by this system. The rest name a
  -- social platform and are published by 013's pipeline.
  destination     text not null check (destination in
                    ('portal', 'website', 'facebook', 'instagram', 'x', 'linkedin', 'youtube')),

  state           text not null default 'pending'
                    check (state in ('pending', 'sending', 'delivered', 'failed',
                                     'skipped', 'retracted')),

  -- THE LINK, AND THE REASON THIS IS NOT A SECOND PUBLISHER. An external
  -- destination is fulfilled by a social post; the delivery is that post's and
  -- is not duplicated here.
  social_post_id  uuid,

  -- Where it landed, so somebody can go and look at it.
  external_url    text,
  -- What went wrong, in the platform's own words.
  error           text,

  delivered_at    timestamptz,
  created_at      timestamptz not null default now(),

  -- One row per destination per announcement. Without this, pressing publish
  -- twice sends two copies to Facebook.
  unique (announcement_id, destination)
);

create index if not exists announcement_destinations_state_idx
  on announcement_destinations (state) where state in ('pending', 'sending', 'failed');

-- The social_post_id is a real reference where the pipeline exists. Added
-- separately so a database that somehow lacks 013 still gets the table.
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'social_posts')
     and not exists (select 1 from pg_constraint
                      where conname = 'announcement_destinations_post_fk') then
    alter table announcement_destinations
      add constraint announcement_destinations_post_fk
      foreign key (social_post_id) references social_posts (id) on delete set null;
  end if;
end $$;


-- ===========================================================================
-- 2b. THE SAME ANNOUNCEMENT, IN EACH PLATFORM'S OWN VOICE
-- ===========================================================================
--
-- THE MASTER IS THE ANNOUNCEMENT; THESE ARE ADAPTATIONS OF IT. The same words
-- do not work everywhere: X takes a fraction of what LinkedIn does, Instagram
-- expects a caption and hashtags under an image, and LinkedIn is read by people
-- assessing the institution professionally. Publishing one block of text to all
-- of them means it was written for one of them and tolerated by the rest.
--
-- A PLATFORM WITH NO VARIANT FALLS BACK TO THE MASTER, deliberately. The
-- alternative — requiring a variant per destination — would mean an urgent
-- notice could not go out until somebody had rewritten it five times. The
-- master is always publishable; a variant is an improvement on it.
--
-- `source` RECORDS WHETHER A PERSON WROTE IT. An assistant draft that nobody
-- read is a different thing from a sentence somebody chose, and the University
-- publishing the first under its own name without knowing which is which is
-- the failure this column exists to prevent. `edited_by` is set when a human
-- changes an assistant draft, which makes it theirs.

create table if not exists announcement_variants (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements (id) on delete cascade,

  platform        text not null check (platform in
                    ('facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'threads')),

  body            text not null,
  hashtags        text[] not null default '{}',

  source          text not null default 'human' check (source in ('human', 'assistant')),
  edited_by       uuid references auth.users (id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One adaptation per platform. Two would mean the system had to choose, and
  -- whichever it chose would be the wrong one half the time.
  unique (announcement_id, platform)
);

create index if not exists announcement_variants_announcement_idx
  on announcement_variants (announcement_id);

alter table announcement_variants enable row level security;

drop policy if exists announcement_variants_read on announcement_variants;
create policy announcement_variants_read on announcement_variants
  for select using (auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office'));


-- ===========================================================================
-- 3. THE HISTORY, WHICH SURVIVES AN EDIT
-- ===========================================================================
--
-- The noticeboard had none. A notice edited after publication simply became a
-- different notice, and what the University had actually said on the Tuesday
-- was gone. This keeps it.
--
-- APPEND-ONLY, ENFORCED. Not by convention, not by nobody having written an
-- UPDATE yet — by a trigger that refuses one. A history that can be edited is
-- a history that will be, on the day somebody wishes it said something else.

create table if not exists announcement_events (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements (id) on delete cascade,

  event           text not null check (event in (
                    'DRAFTED', 'EDITED', 'SUBMITTED_FOR_CLEARANCE', 'APPROVED', 'REJECTED',
                    'SCHEDULED', 'PUBLISHED', 'RETRACTED', 'DESTINATIONS_CHANGED',
                    'RELEASED_EXTERNALLY', 'DESTINATION_DELIVERED', 'DESTINATION_FAILED',
                    'ADMINISTRATIVE_OVERRIDE')),

  actor_id        uuid references auth.users (id) on delete set null,
  actor_email     text,
  actor_role      text,

  previous_state  text,
  new_state       text,

  -- THE TEXT AS IT STOOD. This is what makes the history worth keeping: the
  -- announcement row carries the current wording, and these carry what it said
  -- at each step, so "what did we actually publish on Tuesday" has an answer.
  title_then      text,
  body_then       text,

  detail          text,
  metadata        jsonb,

  at              timestamptz not null default now()
);

create index if not exists announcement_events_announcement_idx
  on announcement_events (announcement_id, at);

create or replace function refuse_announcement_history_edit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'The announcement history is append-only. % is not permitted: this is the record of what '
    'the University said and when, and a record that can be revised afterwards is not one.',
    tg_op
    using errcode = 'check_violation';
end $$;

drop trigger if exists announcement_events_append_only on announcement_events;
create trigger announcement_events_append_only
  before update or delete on announcement_events
  for each row execute function refuse_announcement_history_edit();


-- ===========================================================================
-- 4. WHO CAN READ AND WRITE
-- ===========================================================================

alter table announcements enable row level security;
alter table announcement_destinations enable row level security;
alter table announcement_events enable row level security;

-- ANYBODY SIGNED IN READS A PUBLISHED ANNOUNCEMENT. That is what publishing
-- means. A draft is visible to its author and to the offices that clear them —
-- a half-written notice about a closure appearing on a student's dashboard is
-- the failure this separation exists to prevent.
drop policy if exists announcements_read on announcements;
create policy announcements_read on announcements
  for select using (
    status = 'published'
    or author_id = auth.uid()
    or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );

drop policy if exists announcement_destinations_read on announcement_destinations;
create policy announcement_destinations_read on announcement_destinations
  for select using (auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office'));

drop policy if exists announcement_events_read on announcement_events;
create policy announcement_events_read on announcement_events
  for select using (auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office'));

-- NO WRITE POLICY ON ANY OF THE THREE, and that is deliberate. Every state
-- change goes through /api/announcements, which checks the capability against
-- the role in the database and writes the history in the same breath. A browser
-- that could update `status` directly could publish without clearing and
-- without leaving a trace, which is the entire arrangement this replaces.


-- ===========================================================================
-- 5. THE CAPABILITIES THIS NEEDS
-- ===========================================================================
--
-- Named here for the reader; the matrix that grants them is src/lib/roles.ts,
-- which is where every other capability in this system lives.
--
--   compose-announcement   write and submit one
--   approve-announcement   clear somebody else's
--   publish-announcement   put a cleared one live, and take it down
--
-- Releasing outward requires 'publish-social-post' AS WELL, on purpose: the
-- new door must not become a way round the authority that already governs the
-- University's outward voice.


-- ===========================================================================
-- 6. THE NOTICES ALREADY ON THE BOARD
-- ===========================================================================
--
-- COPIED, NOT MOVED. The originals stay on `documents` exactly as they are. If
-- this migration is wrong, the cost is running it again rather than the
-- University's noticeboard.
--
-- They arrive as `published`, because they are: they have been on the board.
-- What they cannot have is a clearance, since nobody ever gave one — so
-- `approved_by` stays null and the history says plainly where they came from.
-- Inventing an approver to make the row look tidy would be recording a
-- decision that nobody took.

do $$
declare
  moved integer := 0;
  r record;
  new_id uuid;
  payload jsonb;
  a_title text;
  a_body text;
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'documents') then
    raise notice '038: no documents table, so there is no old noticeboard to copy';
    return;
  end if;

  for r in
    select d.* from documents d
     where d.document_type = 'announcement'
       and not exists (
         select 1 from announcement_events e
          where e.event = 'DRAFTED'
            and e.metadata->>'copied_from_document' = d.id::text
       )
  loop
    -- The body was packed into a data-URL as JSON. Anything that will not
    -- decode is copied as plain text under its document title rather than
    -- dropped: a notice nobody can read is still a notice that was posted.
    begin
      payload := convert_from(
        decode(regexp_replace(r.file_url, '^data:[^,]*,', ''), 'base64'), 'UTF8')::jsonb;
    exception when others then
      payload := null;
    end;

    a_title := coalesce(nullif(btrim(coalesce(payload->>'title', r.file_name)), ''), 'Untitled notice');
    a_body  := coalesce(nullif(btrim(coalesce(payload->>'body', '')), ''),
                        'The text of this notice could not be read from the old noticeboard.');

    -- The new table requires a title of 6 and a body of 20. A notice shorter
    -- than that is padded with a statement of fact rather than refused, because
    -- refusing would mean losing it.
    if length(a_title) < 6 then a_title := a_title || ' (notice)'; end if;
    if length(a_body) < 20 then
      a_body := a_body || E'\n\n(Copied from the previous noticeboard.)';
    end if;

    insert into announcements
      (title, body, audiences, author_id, status, published_by, published_at,
       pinned, created_at)
    values
      (a_title, a_body,
       -- THE OLD BOARD HAD ONE FREE-TEXT AUDIENCE and its words are not this
       -- vocabulary — 'All', 'Lecturers', 'Faculty of Theology'. Mapping them
       -- by guesswork would put notices in front of people they were never
       -- addressed to, so every copied notice is addressed to the audiences
       -- that can already see the portal and the old wording is kept in the
       -- history below rather than translated.
       array['students', 'staff']::text[],
       -- The uploader if there is one. `documents` has no author column in
       -- every deployment, so this falls back to the announcement's own
       -- creator being unknown — and the NOT NULL forces the issue, so a row
       -- with nobody attributable is skipped and reported rather than
       -- attributed to whoever happens to run this.
       coalesce(r.student_id, null),
       'published', null, r.uploaded_at,
       coalesce((payload->>'pinned')::boolean, false),
       r.uploaded_at)
    returning id into new_id;

    insert into announcement_destinations (announcement_id, destination, state, delivered_at)
    values (new_id, 'portal', 'delivered', r.uploaded_at);

    insert into announcement_events
      (announcement_id, event, new_state, title_then, body_then, detail, metadata, at)
    values
      (new_id, 'DRAFTED', 'published', a_title, a_body,
       'Copied from the previous noticeboard, where it was stored as a document. It was '
       || 'published without a recorded clearance because the old page had none.',
       jsonb_build_object('copied_from_document', r.id), r.uploaded_at);

    moved := moved + 1;
  end loop;

  raise notice '038: % notice(s) copied from the old noticeboard', moved;
exception when not_null_violation then
  -- The author is NOT NULL and the old rows may not name one. Reported rather
  -- than worked around: a notice the University cannot attribute is exactly
  -- what this migration exists to stop, and inventing an author to get the
  -- copy through would be the first thing it did wrong.
  raise notice '038: the old noticeboard has notices with no identifiable author. They were '
               'left where they are; see the verify at the foot.';
end $$;


-- ===========================================================================
-- 7. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  a_id uuid;
  someone uuid;
begin
  select id into someone from auth.users limit 1;
  if someone is null then
    raise notice '038: no accounts yet, so the rules could not be exercised against one';
    return;
  end if;

  -- EVERYTHING BELOW ROLLS BACK. It has to: the history trigger refuses a
  -- DELETE, including the one a cascade from `announcements` would perform, so
  -- a proof announcement with any history cannot be tidied away afterwards.
  --
  -- That is not an inconvenience to work around, it is the rule working. An
  -- announcement the University has acted on cannot be deleted, by anybody,
  -- ever — it is retracted instead, and the record stands. The proof therefore
  -- does its work inside a savepoint and undoes it.
  begin

  insert into announcements (title, body, author_id, status, audiences)
  values ('Proof 038 announcement', 'A body long enough to satisfy the constraint on length.',
          someone, 'draft', array['staff']::text[])
  returning id into a_id;

  -- ---- THE AUTHOR CANNOT CLEAR THEIR OWN ---------------------------------
  -- The rule the whole arrangement rests on. Watched refusing.
  refused := false;
  begin
    update announcements set status = 'approved', approved_by = someone, approved_at = now()
     where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: an author cleared their own announcement. The second pair of '
                    'eyes is not a rule, it is a comment.';
  end if;

  -- ---- A REFUSAL HAS TO SAY WHY ------------------------------------------
  refused := false;
  begin
    update announcements set status = 'rejected' where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: an announcement was rejected with no reason and no rejector';
  end if;

  -- ---- A PUBLICATION RECORDS WHO AND WHEN --------------------------------
  refused := false;
  begin
    update announcements set status = 'published' where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: an announcement was published with nobody recorded as having '
                    'published it';
  end if;

  -- ---- AN ANNOUNCEMENT IS ADDRESSED TO SOMEBODY --------------------------
  refused := false;
  begin
    update announcements set audiences = '{}'::text[] where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: an announcement was addressed to nobody at all';
  end if;

  refused := false;
  begin
    update announcements set audiences = array['everyone_everywhere']::text[] where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: an audience nobody declared was accepted';
  end if;

  -- ---- AN IMAGE IS DESCRIBED ---------------------------------------------
  --
  -- ONLY WHILE THE IMAGE LIVES ON THE ANNOUNCEMENT. 039 moves it into
  -- `announcement_media` and drops these columns, because one announcement has
  -- more than one photograph — and it carries the same rule there, on a NOT
  -- NULL column. Running the bundle a second time used to stop dead here,
  -- proving a rule about a column that no longer existed.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'announcements'
                and column_name = 'image_path') then
    refused := false;
    begin
      execute 'update announcements set image_path = ''announcements/x.jpg'' where id = $1'
        using a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '038 FAILED: an image was attached with no alt text, which every network '
                      'this is published to would carry onward';
    end if;
  end if;

  -- ---- ONE ADAPTATION PER PLATFORM ---------------------------------------
  -- Two would mean the system had to choose between them, and whichever it
  -- chose would be the wrong one half the time.
  insert into announcement_variants (announcement_id, platform, body)
  values (a_id, 'x', 'Short version.');
  refused := false;
  begin
    insert into announcement_variants (announcement_id, platform, body)
    values (a_id, 'x', 'A different short version.');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: two adaptations were stored for one platform, so which one '
                    'gets published is a coin toss';
  end if;

  -- ---- AND IT SAYS WHETHER A PERSON WROTE IT -----------------------------
  refused := false;
  begin
    update announcement_variants set source = 'somewhere_else'
     where announcement_id = a_id and platform = 'x';
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: a variant could claim an origin nobody declared. Whether the '
                    'University wrote a sentence or merely accepted one is not optional.';
  end if;

  -- ---- THE HISTORY CANNOT BE REWRITTEN -----------------------------------
  insert into announcement_events (announcement_id, event, new_state, detail)
  values (a_id, 'DRAFTED', 'draft', 'Proof');

  refused := false;
  begin
    update announcement_events set detail = 'something else' where announcement_id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: the announcement history could be edited';
  end if;

  refused := false;
  begin
    delete from announcement_events where announcement_id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: the announcement history could be deleted';
  end if;

  -- ---- ONE DESTINATION ROW PER DESTINATION -------------------------------
  -- Without this, pressing publish twice sends two copies to Facebook.
  insert into announcement_destinations (announcement_id, destination) values (a_id, 'facebook');
  refused := false;
  begin
    insert into announcement_destinations (announcement_id, destination) values (a_id, 'facebook');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: the same destination could be added twice, so an announcement '
                    'could be published to one network twice over';
  end if;

  -- AND AN ANNOUNCEMENT WITH HISTORY CANNOT BE DELETED AT ALL.
  -- The cascade from the parent is still a DELETE on the events, and the
  -- trigger does not care who asked. Worth watching, because it is the
  -- strongest thing this migration does and it is easy to assume a cascade is
  -- exempt.
  refused := false;
  begin
    delete from announcements where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '038 FAILED: an announcement with a history was deleted outright. '
                    'Retraction is the only way something published comes down.';
  end if;

  raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '038 OK: an author cannot clear their own notice, a refusal states a reason, a '
               'publication names its publisher, the history cannot be rewritten and a '
               'destination cannot be added twice, an announcement is addressed to a real '
               'audience, an image is described, one adaptation is kept per platform and it '
               'says who wrote it, and a notice with a history cannot be deleted at all';
end $$;


-- ===========================================================================
-- 8. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- What is on the board now, by state.
select status, count(*) as announcements
  from announcements
 group by status
 order by count(*) desc;

-- Where published announcements actually reached.
select d.destination, d.state, count(*) as rows
  from announcement_destinations d
 group by d.destination, d.state
 order by d.destination, d.state;

-- NOTICES THAT COULD NOT BE COPIED. Each of these is a notice on the old board
-- that names nobody, so the new table — which requires an author — will not
-- take it. They are still on `documents` and still readable; decide whether
-- each is worth re-posting under a named author.
select d.id, d.file_name, d.uploaded_at
  from documents d
 where d.document_type = 'announcement'
   and not exists (
     select 1 from announcement_events e
      where e.event = 'DRAFTED' and e.metadata->>'copied_from_document' = d.id::text
   )
 order by d.uploaded_at desc;

-- THE ADAPTATIONS, and which platforms fall back to the master. A platform
-- with no row here is published the master text, which is always allowed —
-- but it is worth seeing which ones.
select a.title,
       v.platform,
       v.source,
       length(v.body) as characters,
       cardinality(v.hashtags) as hashtags
  from announcements a
  join announcement_variants v on v.announcement_id = a.id
 order by a.created_at desc, v.platform;

-- The append-only guard is actually attached.
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'announcement_events'::regclass and not tgisinternal;
