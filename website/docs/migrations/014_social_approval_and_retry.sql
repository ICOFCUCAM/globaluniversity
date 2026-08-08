-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — APPROVAL, SCHEDULING AND RETRY FOR THE COMMAND CENTRE
--
-- Run after 013_social_and_credential_authority.sql. Idempotent; destroys
-- nothing.
--
-- ===========================================================================
-- WHY A POST NEEDS AN APPROVAL STATE OF ITS OWN
-- ===========================================================================
--
-- 013 gave `social_posts` a status: draft, scheduled, publishing, published,
-- partially_failed, failed, cancelled. Every one of those describes what has
-- happened to the post MECHANICALLY — where it is in the pipeline.
--
-- None of them answers the question an approval workflow exists to ask: has a
-- person with the authority to speak for this University read these words and
-- agreed to them?
--
-- Folding approval into the same column would have forced a choice between
-- "approved" and "scheduled" for a post that is both, and would have made
-- "rejected" a sibling of "failed" — conflating an editorial decision with a
-- network timeout. They are different facts about different things, so they
-- are different columns.
--
-- ===========================================================================
-- WHY REJECTION CARRIES A NOTE AND APPROVAL DOES NOT
-- ===========================================================================
--
-- The same asymmetry as the credential correction workflow, for the same
-- reason. An approval needs no explanation — the words stand as written. A
-- rejection without one leaves the author guessing which sentence was the
-- problem, and the usual outcome is the same post resubmitted unchanged.
--
-- ===========================================================================
-- RETRY IS A COUNTER, NOT A NEW ROW
-- ===========================================================================
--
-- When one network refuses a post that five accepted, the fix is to try that
-- one again — not to republish, which would duplicate the announcement on the
-- five that worked. So the target row is re-queued in place and counts its
-- attempts, and `last_attempt_at` and `last_error` say what happened last time.
--
-- A cap is deliberately NOT enforced in the database. A network that is down
-- for a day should be retried tomorrow, and a schema that refused the fourth
-- attempt would turn a temporary outage into a permanent gap in the record.
-- The interface stops offering the button; the database keeps the count.
-- ===========================================================================


-- 1 -------------------------------------------------------------------------
-- APPROVAL.

alter table social_posts add column if not exists approval_state text
  not null default 'draft'
  check (approval_state in ('draft', 'submitted', 'approved', 'rejected'));

alter table social_posts add column if not exists submitted_by  uuid references auth.users (id) on delete set null;
alter table social_posts add column if not exists submitted_at  timestamptz;
alter table social_posts add column if not exists approved_by   uuid references auth.users (id) on delete set null;
alter table social_posts add column if not exists approved_at   timestamptz;
alter table social_posts add column if not exists review_note   text;

-- A rejection a person cannot act on is not a review.
alter table social_posts drop constraint if exists social_posts_rejection_has_note;
alter table social_posts add constraint social_posts_rejection_has_note check (
  approval_state <> 'rejected' or length(btrim(coalesce(review_note, ''))) > 0
);

create index if not exists social_posts_approval_idx
  on social_posts (approval_state, created_at desc);

-- THE AUTHOR IS NOT THE APPROVER.
--
-- The same separation the University required of certificate designs in 005 and
-- of grades in 009: the office that writes does not sign off its own work. An
-- announcement is the institution speaking, and one person composing, approving
-- and publishing it alone is exactly the arrangement that puts an unconsidered
-- sentence on six networks under the University's name.
--
-- ENFORCED IN THE DATABASE rather than in a route, because the route that
-- approves and the route that publishes are different files and will be edited
-- by different people.
create or replace function guard_social_approval() returns trigger
language plpgsql as $$
begin
  if new.approval_state = 'approved'
     and old.approval_state is distinct from 'approved'
     and new.approved_by is not null
     and new.approved_by = new.author_id
  then
    raise exception
      'the author of a post may not approve it. Another administrator must read it first — '
      'that is what the approval step is for.';
  end if;
  return new;
end $$;

drop trigger if exists social_posts_approval_trg on social_posts;
create trigger social_posts_approval_trg
  before update on social_posts
  for each row execute function guard_social_approval();


-- 2 -------------------------------------------------------------------------
-- RETRY.

-- 013 ALREADY HAD MOST OF THIS. `attempts`, `last_error`, `external_url` and
-- `external_post_id` are on social_post_targets already, and the first draft of
-- this file re-added all four — a no-op that read as new work.
--
-- WHAT IS GENUINELY MISSING is `last_attempt_at`. Without it, "when did this
-- last fail" cannot be answered, and a retry queue that cannot say how long a
-- destination has been failing is a list rather than a queue.
--
-- The draft that removed the redundant columns removed this one too, and the
-- local database did not complain — because the FIRST draft had already added
-- it there. Only rebuilding the whole schema from empty caught it. That is what
-- the from-scratch run of RUN-ALL.sql is for, and it is why "it worked when I
-- re-ran it" is not evidence about a migration.
alter table social_post_targets add column if not exists last_attempt_at timestamptz;

-- THE COLUMN IS `status`, NOT `state`. Worth writing down, because the
-- TypeScript that reads this table called it `state` and used four values the
-- CHECK constraint does not accept — so the fan-out insert failed and nothing
-- could ever be published. See TargetState in src/lib/social.ts.
create index if not exists social_post_targets_retry_idx
  on social_post_targets (status, last_attempt_at)
  where status = 'failed';


-- WHAT THE ATTACHMENT ACTUALLY IS.
--
-- social_post_media has storage_path and alt_text but no way to say whether the
-- file is a photograph or a video. That distinction is load-bearing rather than
-- decorative: Instagram cannot publish without an image, YouTube and TikTok
-- cannot publish without a video, and the composer blocks a post that would be
-- refused by the network. Without this column it has nothing to test.
alter table social_post_media add column if not exists kind text
  not null default 'image' check (kind in ('image', 'video'));


-- 3 -------------------------------------------------------------------------
-- THE CALENDAR.
--
-- No new table. A content calendar is a QUERY over posts that have a date —
-- `scheduled_for` for what is planned, `published_at` for what went out — and a
-- second table holding "calendar entries" would immediately be able to disagree
-- with the posts it claimed to describe.
--
-- This index is what makes the month view a scan of a few rows rather than of
-- the whole publication history.
create index if not exists social_posts_calendar_idx
  on social_posts (coalesce(scheduled_for, published_at, created_at) desc);


-- 4 -------------------------------------------------------------------------
-- Proof that it landed.

do $$
declare
  n integer;
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'social_posts'
     and column_name in ('approval_state', 'submitted_by', 'submitted_at',
                         'approved_by', 'approved_at', 'review_note');
  if n <> 6 then
    raise exception 'Expected 6 approval columns on social_posts, found %', n;
  end if;

  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'social_post_targets'
     and column_name in ('attempts', 'last_attempt_at', 'last_error', 'external_url');
  if n <> 4 then
    raise exception 'Expected the retry columns on social_post_targets, found %', n;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'social_post_media' and column_name = 'kind'
  ) then
    raise exception 'social_post_media has no kind column; the composer cannot tell an image from a video.';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'social_posts_approval_trg') then
    raise exception 'The self-approval guard is missing; one person could write, approve and publish alone.';
  end if;

  -- PROVE THE GUARD, rather than trusting that the trigger exists. 013 shipped
  -- with an existence check that passed while the operation it described was
  -- impossible; that is not repeated here.
  declare
    author uuid := '00000000-0000-0000-0000-0000000000aa';
    post   uuid;
    refused boolean := false;
  begin
    insert into auth.users (id, email)
    values (author, 'selftest-014@iguc.net')
    on conflict (id) do nothing;

    insert into social_posts (author_id, body, approval_state)
    values (author, 'Installation self-test - migration 014.', 'submitted')
    returning id into post;

    begin
      update social_posts
         set approval_state = 'approved', approved_by = author, approved_at = now()
       where id = post;
    exception when others then
      if sqlerrm like '%may not approve it%' then refused := true; else raise; end if;
    end;

    if not refused then
      raise exception 'An author was allowed to approve their own post. Refusing to complete.';
    end if;

    -- A post is not a sealed document; deleting the self-test row is fine and
    -- leaves the publication history clean.
    delete from social_posts where id = post;
    delete from auth.users where id = author;
  end;

  raise notice 'Command Centre approval and retry installed. Self-approval is refused, proven at install.';
end $$;
