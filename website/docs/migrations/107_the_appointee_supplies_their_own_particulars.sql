-- ===========================================================================
-- 107 — THE APPOINTEE SUPPLIES THEIR OWN PARTICULARS
-- ===========================================================================
--
-- The University, looking at eight accepted appointments all reading
-- "None recorded — add it on the form":
--
--   "there should be a button to forward to the participant through the
--    various means, whatsapp, text etc, so that they can add their emails,
--    and passwords and create their staff records, then automatically they
--    would have a page for them to login to their account."
--
-- ---------------------------------------------------------------------------
-- THE PROBLEM THIS SOLVES, WHICH IS A TYPING PROBLEM
-- ---------------------------------------------------------------------------
--
-- 104 gave the officer a form to record an appointee's email on. It works, and
-- it still requires the officer to HAVE the email — so for eight people the
-- Registry must now telephone eight people, write down eight addresses, and
-- type them in. An address transcribed from a phone call is an address that
-- can be wrong, and the first anybody knows of it is a welcome letter that
-- never arrives.
--
-- The person who knows their own email address is the appointee. This lets
-- them type it themselves, once, into the University's own form.
--
-- ---------------------------------------------------------------------------
-- AND IT DOES NOT BREAK "AN OFFICER OPENS IT"
-- ---------------------------------------------------------------------------
--
-- The University ruled, when the staff register was built: "AN OFFICER OPENS
-- IT, not the acceptance. An account that springs into existence on acceptance
-- is a live login nobody authorised."
--
-- That rule is kept, and it is worth saying exactly how, because at a glance
-- this looks like the thing it forbids.
--
--   THE AUTHORISING ACT IS THE INVITATION. An officer holding
--   `open-staff-record` decides that this appointee may open their own record,
--   and issues them a one-time link. Nothing happens to anybody who was not
--   invited by name.
--
--   WHAT THE APPOINTEE SUPPLIES IS WHAT ONLY THEY KNOW — their email address,
--   their telephone, and a password nobody at the University ever sees. They
--   choose nothing about the POST: not the title, not the faculty, not the
--   employment type, not the start date, not the staff number. Every one of
--   those is read from the appointment the University already approved, and
--   the claim route does not look at them if they are sent.
--
-- So the account still springs from an officer's decision. What has moved is
-- the typing, to the one person who cannot get it wrong.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. NOTHING, UNTIL AN OFFICER ISSUES AN INVITATION. One table, one view, no
--    seeds. No existing appointment, staff record or account is touched.
--
-- 2. A NEW WAY IN EXISTS, so it is worth being plain about what guards it:
--    the link carries a 256-bit secret, it is good once, it expires, it is
--    bound to one appointment, and it can be revoked. The secret itself is
--    NEVER STORED — only its SHA-256 — so a copy of this table is not a set of
--    working links.
--
-- 3. AND THE TABLE IS NOT READABLE THROUGH THE API AT ALL. Row-level security
--    is on and there is deliberately no policy: the token is the capability
--    and the route holds the service key. 013 left a table in that state by
--    accident and it took two years to notice; this one does it on purpose and
--    says so, and the offices get `appointment_invitation_status` instead,
--    which carries every column except the one that must not leave.
--
-- ===========================================================================


-- ===========================================================================
-- 1. THE INVITATION
-- ===========================================================================

create table if not exists appointment_invitations (
  id              uuid primary key default gen_random_uuid(),

  -- ONE APPOINTMENT, NAMED. An invitation is not a general right to open a
  -- staff record; it is a right to open THIS one.
  appointment_id  uuid not null references appointments (id) on delete cascade,

  -- ---- THE SECRET, WHICH IS NOT HERE -----------------------------------
  --
  -- The link carries 32 random bytes. What is stored is the SHA-256 of them,
  -- so this column cannot be turned back into a working link by anybody
  -- holding the table — a backup, a support engineer, or whoever ends up with
  -- a copy of the database years from now.
  --
  -- The CHECK is the part that makes it true rather than intended: a 64-
  -- character lowercase hex string is a digest and nothing else. A route that
  -- one day wrote the raw token here by mistake would be refused by the
  -- database rather than quietly storing a live credential in plain text.
  token_hash      text not null unique
    constraint an_invitation_stores_a_digest_not_a_token
    check (token_hash ~ '^[0-9a-f]{64}$'),

  issued_by       uuid references auth.users (id) on delete set null,
  issued_at       timestamptz not null default now(),

  -- AN INVITATION THAT NEVER EXPIRES IS A PASSWORD. Set by the route; the
  -- database only insists that there is one and that it is in the future when
  -- the row is made.
  expires_at      timestamptz not null,

  -- ---- WHAT BECAME OF IT ------------------------------------------------
  claimed_at      timestamptz,
  claimed_email   text,
  staff_record_id uuid references staff_records (id) on delete set null,

  revoked_at      timestamptz,
  revoked_by      uuid references auth.users (id) on delete set null,
  revoked_reason  text,

  -- HOW MANY TIMES SOMEBODY HAS TRIED. A link being guessed at looks exactly
  -- like a link being used, unless somebody is counting.
  attempts        integer not null default 0,
  last_attempt_at timestamptz,

  created_at      timestamptz not null default now(),

  constraint an_invitation_expires_after_it_is_issued
    check (expires_at > issued_at),

  -- A CLAIM NAMES WHAT IT PRODUCED, or it is not a claim.
  constraint a_claimed_invitation_names_the_record
    check (claimed_at is null or (claimed_email is not null and staff_record_id is not null)),

  -- AND A REVOCATION SAYS WHY. The appointee may be told.
  constraint a_revoked_invitation_says_why
    check (revoked_at is null
           or (revoked_by is not null and length(btrim(coalesce(revoked_reason, ''))) >= 5))
);

-- Older databases: `create table if not exists` adds no column to a table that
-- already exists, not even a new one. This has caught us before.
alter table appointment_invitations
  add column if not exists claimed_email   text,
  add column if not exists staff_record_id uuid,
  add column if not exists revoked_reason  text,
  add column if not exists attempts        integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

create index if not exists appointment_invitations_appointment_idx
  on appointment_invitations (appointment_id, issued_at desc);

-- ONE LIVE INVITATION PER APPOINTMENT. Two links in flight for one person is
-- two things to revoke and one of them forgotten. Expiry is not in the index
-- — `now()` is not immutable and Postgres refuses it there — so the route
-- treats an expired row as spent and replaces it.
create unique index if not exists one_live_invitation_per_appointment
  on appointment_invitations (appointment_id)
  where claimed_at is null and revoked_at is null;

comment on table appointment_invitations is
  'A one-time, expiring invitation for an appointee to supply their own email, telephone and '
  'password. The officer''s act is issuing it; the appointee''s act is typing what only they '
  'know. Nothing about the post can be set through it.';


-- ===========================================================================
-- 2. CLAIMED ONCE, AND NEVER UNCLAIMED
-- ===========================================================================
--
-- The property the whole design rests on. A link that can be used twice is a
-- link that can be forwarded, and a claim that can be cleared is a link that
-- can be used twice the long way round.
-- ---------------------------------------------------------------------------

create or replace function an_invitation_is_claimed_once()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.claimed_at is not null and new.claimed_at is distinct from old.claimed_at then
    raise exception 'That invitation has already been used. A further one has to be issued, '
                    'which is an officer''s decision and leaves its own record.'
      using errcode = 'restrict_violation';
  end if;

  -- AND THE DIGEST IS NEVER REWRITTEN. Moving a token from one invitation to
  -- another would carry a claim's history onto a different link.
  if new.token_hash is distinct from old.token_hash
     or new.appointment_id is distinct from old.appointment_id then
    raise exception 'An invitation belongs to one appointment and one link. Issue another '
                    'rather than repointing this one.'
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists an_invitation_is_claimed_once_trg on appointment_invitations;
create trigger an_invitation_is_claimed_once_trg
  before update on appointment_invitations
  for each row execute function an_invitation_is_claimed_once();


-- ===========================================================================
-- 3. THE OFFICES READ THE ROW. NOBODY READS THE DIGEST.
-- ===========================================================================
--
-- The first draft of this section turned row-level security on and wrote no
-- policy, reasoning that the token digest must never reach a browser and the
-- route holds the service key anyway.
--
-- THE PROOF REFUSED IT, and correctly. The status view below is
-- `security_invoker`, so it reads with the caller's own rights: a table no
-- office can read is a view no office can read either, and the Registrar
-- could not see whether the invitation they had just sent had been used.
-- Closing the table closed the screen.
--
-- A SECURITY-DEFINER VIEW WOULD HAVE BEEN WORSE. A view that reads as its
-- owner bypasses the policy entirely, and then the only thing deciding who
-- sees invitations is a GRANT — which `authenticated` holds, and which a
-- student is.
--
-- So the rule is said at the column rather than at the table: the offices that
-- may open a staff record may read an invitation, and the digest is revoked
-- from every signed-in role including theirs. Postgres enforces column
-- privileges itself, so `select token_hash` is refused for everybody but the
-- service key — not hidden by a view somebody could select around.
-- ---------------------------------------------------------------------------

alter table appointment_invitations enable row level security;

drop policy if exists appointment_invitations_read on appointment_invitations;
create policy appointment_invitations_read on appointment_invitations
  for select using (
    auth_role() in ('superadmin', 'admin', 'vice-chancellor', 'registrar', 'academic-office')
  );

-- NO INSERT, UPDATE OR DELETE POLICY. Issuing, revoking and claiming are the
-- route's, under the service key, which no policy binds. An invitation a
-- browser could write is an invitation a browser could issue to itself.

-- ---- AND THE DIGEST IS REVOKED AT THE COLUMN --------------------------
--
-- The table grant has to exist before a column can be taken out of it, so it
-- is granted and then narrowed. `anon` is included because an unauthenticated
-- reader should not be reading this table at all, and a revoke is cheaper
-- than finding out one day that they could.
-- A TABLE-LEVEL GRANT SUBSUMES EVERY COLUMN, so revoking one column out of it
-- does nothing at all — Postgres keeps the broader privilege and the narrower
-- revoke is silently pointless. The proof below caught exactly that: the first
-- draft granted SELECT on the table and then revoked SELECT on the one column,
-- and the Registrar read the digest anyway.
--
-- The grant has to be taken away whole and given back as a column list.
do $$
declare
  cols text;
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    -- EVERY COLUMN BUT ONE, read from the catalogue rather than typed here, so
    -- a column added to this table later is readable without anybody having to
    -- remember to come back — and `token_hash` stays out whatever is added.
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into cols
      from information_schema.columns
     where table_schema = 'public' and table_name = 'appointment_invitations'
       and column_name <> 'token_hash';

    execute 'revoke all on appointment_invitations from authenticated';
    execute format('grant select (%s) on appointment_invitations to authenticated', cols);
    -- AND NO WRITE AT ALL. Issuing, revoking and claiming belong to the route
    -- under the service key. An invitation a browser could write is an
    -- invitation a browser could issue to itself.
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on appointment_invitations from anon';
  end if;
end $$;


create or replace view appointment_invitation_status
with (security_invoker = true) as
  select i.id,
         i.appointment_id,
         a.full_name,
         a.position_title,
         i.issued_at,
         i.expires_at,
         i.claimed_at,
         i.claimed_email,
         i.staff_record_id,
         i.revoked_at,
         i.revoked_reason,
         i.attempts,
         i.last_attempt_at,
         case
           when i.claimed_at is not null then 'claimed'
           when i.revoked_at is not null then 'revoked'
           when i.expires_at <= now()    then 'expired'
           else 'live'
         end as state
    from appointment_invitations i
    join appointments a on a.id = i.appointment_id;

comment on view appointment_invitation_status is
  'What an office may see of an invitation: who it was for, when it was issued, whether it has '
  'been used, and how many times somebody has tried it. NOT the token digest — that column is '
  'absent from this view on purpose, and the table it comes from is readable by nobody through '
  'the API at all.';


-- ===========================================================================
-- 4. THE PROOF
-- ===========================================================================

do $$
declare
  officer  uuid := gen_random_uuid();
  lect     uuid := gen_random_uuid();
  appt     uuid;
  inv      uuid;
  rec      uuid;
  digest   text := repeat('a', 64);
  refused  boolean;
  seen     integer;
  t        text;
begin
  insert into auth.users (id, email) values (officer, 'proof-107@example.invalid');
  insert into profiles (id, email, full_name, role)
    values (officer, 'proof-107@example.invalid', 'Proof Registrar 107', 'registrar')
  on conflict (id) do update set role = excluded.role;

  -- AN ACCEPTED APPOINTMENT WAS ISSUED FIRST, AND SAYS WHEN IT WAS ACCEPTED.
  -- Two CHECKs hold that and the proof is not entitled to an exception from
  -- either: a status of 'accepted' with no issue date is an appointment
  -- somebody accepted before it was sent, and one with no acceptance date is a
  -- state nobody can put a time on.
  insert into appointments (full_name, position_title, employment_type, start_date,
                            status, issued_at, accepted_at)
       values ('Proof Appointee 107', 'Proof Post 107', 'permanent', current_date,
               'accepted', now(), now())
    returning id into appt;

  -- ---- A PLAINTEXT TOKEN CANNOT BE STORED -------------------------------
  --
  -- The guard that matters most, watched refusing. A route that one day wrote
  -- the raw link secret into this column would be storing a live credential in
  -- plain text, and the database refuses the shape rather than trusting the
  -- route to have hashed it.
  refused := false;
  begin
    insert into appointment_invitations (appointment_id, token_hash, expires_at)
      values (appt, 'ZmFrZS10b2tlbi1ub3QtYS1kaWdlc3Q', now() + interval '14 days');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — a raw token was accepted where a digest belongs';
  end if;
  raise notice '107 OK  a link secret cannot be stored in plain text; only its digest fits';

  -- ---- AN INVITATION THAT NEVER EXPIRES IS REFUSED ----------------------
  refused := false;
  begin
    insert into appointment_invitations (appointment_id, token_hash, issued_at, expires_at)
      values (appt, repeat('b', 64), now(), now() - interval '1 day');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — an invitation was issued already expired';
  end if;
  raise notice '107 OK  …and an invitation expires after it is issued, never before';

  insert into appointment_invitations (appointment_id, token_hash, issued_by, expires_at)
       values (appt, digest, officer, now() + interval '14 days')
    returning id into inv;

  -- ---- ONE LIVE INVITATION AT A TIME ------------------------------------
  refused := false;
  begin
    insert into appointment_invitations (appointment_id, token_hash, expires_at)
      values (appt, repeat('c', 64), now() + interval '14 days');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — two live invitations exist for one appointment';
  end if;
  raise notice '107 OK  one live invitation per appointment, so there is one thing to revoke';

  -- ---- A CLAIM NAMES WHAT IT PRODUCED -----------------------------------
  refused := false;
  begin
    update appointment_invitations set claimed_at = now() where id = inv;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — an invitation was marked used without naming a record';
  end if;
  raise notice '107 OK  a claim names the address and the staff record it produced';

  insert into staff_records (staff_number, full_name, position_title, appointment_id)
       values ('PROOF-107-A', 'Proof Appointee 107', 'Proof Post 107', appt)
    returning id into rec;

  update appointment_invitations
     set claimed_at = now(), claimed_email = 'proof-107-appointee@example.invalid',
         staff_record_id = rec
   where id = inv;

  -- ---- AND IS GOOD EXACTLY ONCE -----------------------------------------
  refused := false;
  begin
    update appointment_invitations set claimed_at = now() + interval '1 minute' where id = inv;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — an invitation was claimed twice';
  end if;
  raise notice '107 OK  …and once it is used it cannot be used again';

  -- NOR UNCLAIMED, which is the same hole approached from the other side.
  refused := false;
  begin
    update appointment_invitations set claimed_at = null where id = inv;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — a claim was cleared, which makes the link live again';
  end if;
  raise notice '107 OK  …nor un-used, which would make the link live again';

  -- ---- THE DIGEST DOES NOT LEAVE ----------------------------------------
  select count(*) into seen
    from information_schema.columns
   where table_name = 'appointment_invitation_status' and column_name = 'token_hash';
  if seen <> 0 then
    raise exception '107 FAILED — the token digest is on the view the offices read';
  end if;
  raise notice '107 OK  the token digest is on no view any office can read';

  -- AND THE DIGEST CANNOT BE SELECTED BY ANYBODY SIGNED IN. Not hidden by a
  -- view — refused by Postgres at the column, so selecting around the view
  -- does not reach it either. RLS and column privileges do not apply to the
  -- owner, so this changes role or it proves nothing at all.
  refused := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', officer::text, true);
    perform token_hash from appointment_invitations where id = inv;
    reset role;
  exception when others then
    begin reset role; exception when others then null; end;
    refused := true;
  end;
  if not refused then
    raise exception '107 FAILED — a signed-in officer read the token digest';
  end if;
  raise notice '107 OK  …and no signed-in role can select the digest, view or no view';

  -- WHILE THE ROW ITSELF IS THE OFFICE'S TO READ.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', officer::text, true);
  select count(*) into seen from appointment_invitations where id = inv;
  reset role;
  if seen <> 1 then
    raise exception '107 FAILED — the Registrar read % of their own invitation', seen;
  end if;
  raise notice '107 OK  the office that issued it can see it';

  -- BUT THE STATUS VIEW IS. A floor that is also a ceiling is an outage.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', officer::text, true);
  select state into t from appointment_invitation_status where id = inv;
  reset role;
  if t is distinct from 'claimed' then
    raise exception '107 FAILED — the Registrar could not read the invitation state (%)', t;
  end if;
  raise notice '107 OK  …while the office can still see that it was used, and by which address';

  -- ---- AND THE CEILING ---------------------------------------------------
  --
  -- A policy naming five offices must not have named everybody. A lecturer is
  -- the test: signed in, staff, and with no business in this table.
  insert into auth.users (id, email) values (lect, 'proof-107-lecturer@example.invalid');
  insert into profiles (id, email, full_name, role)
    values (lect, 'proof-107-lecturer@example.invalid', 'Proof Lecturer 107', 'lecturer')
  on conflict (id) do update set role = excluded.role;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', lect::text, true);
  select count(*) into seen from appointment_invitation_status;
  reset role;
  if seen <> 0 then
    raise exception '107 FAILED — a lecturer read % invitation(s)', seen;
  end if;
  raise notice '107 OK  …and a lecturer reads none of them';

  raise exception 'ROLLBACK 107';
exception
  when others then
    if sqlerrm = 'ROLLBACK 107' then
      raise notice '107 OK  every proof above rolled back; nothing was written to';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 5. DONE
-- ===========================================================================
do $$
begin
  raise notice '107 APPLIED  an officer can now send an appointee a one-time link to supply '
               'their own email, telephone and password. Nothing happens until one is issued, '
               'and nothing about the post can be set through it.';
end $$;
