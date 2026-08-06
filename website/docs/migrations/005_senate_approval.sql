-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — SENATE APPROVAL OF CREDENTIAL DESIGNS
--
-- Run after 004_credential_register.sql. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- DO NOT RUN THIS YET, AND DO NOT TREAT IT AS GOVERNANCE UNTIL YOU DO.
--
-- This file is the schema half: the lifecycle column, the approvals table, the
-- immutability guard and the publication gate. The application half is not
-- built — there are no routes to submit a design for approval or to record an
-- office's decision, and the existing publish route INSERTS a new template row
-- rather than updating one, so the publication trigger below never fires for it.
--
-- Running this today therefore changes nothing about who can publish. It would
-- create the appearance of an approval chain with no chain, which is worse than
-- having neither — an administrator reading the schema would conclude the
-- control exists.
--
-- Run it when the submit and approve routes land. Until then it is a design
-- committed for review, and it is marked as such rather than left out, because
-- the next person to pick this up needs the shape as much as the code.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- WHY
--
-- Until now one account could design a degree certificate and publish it, and
-- from that moment every graduate of the university received it. The
-- Superadministrator is the designer — that part is right — but a design is not
-- a piece of styling: it is the form of words in which the university confers a
-- degree, the offices that sign it, and the seal it carries. An institution
-- where one person can change that alone has no governance over its own awards,
-- whatever its statutes say.
--
-- So publishing is now the end of a chain rather than a button:
--
--   Superadministrator designs   →  submits
--   Registrar                    →  approves
--   Academic Office              →  approves
--   Vice Chancellor              →  approves
--   Superadministrator           →  publishes
--
-- Four offices, each recorded with who, when, and any note. The publishing
-- route refuses a design that is not approved by all three, and the refusal is
-- in the database rather than in the interface — an approval workflow enforced
-- only in the browser is a suggestion.
--
-- WHY THE ACADEMIC OFFICE AND NOT AN 'ACADEMIC SECRETARY'. There is no such
-- role in this system; 'academic-office' is the nearest and is the office that
-- actually holds academic regulations here. Adding a role for a post that may
-- not exist would put an approval step in the chain that nobody could ever
-- satisfy, and the design would be unpublishable for ever.
--
-- WHY THE DESIGNER IS NOT ONE OF THE THREE. They authored it. An approval you
-- give to your own work is a countersignature, not a control — and a chain
-- where the first and last steps are the same person, with their own approval
-- in the middle, reads as governance while providing none.
-- ===========================================================================


-- ===========================================================================
-- 1. TEMPLATE LIFECYCLE
-- ===========================================================================

alter table credential_templates
  -- draft      — being designed; nothing has been asked of anyone
  -- submitted  — put to the approving offices
  -- approved   — all three have signed; may be published
  -- published  — in force, or was; never editable again
  -- withdrawn  — submitted and then pulled, or rejected
  add column if not exists lifecycle    text not null default 'draft',
  add column if not exists submitted_by uuid references auth.users (id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_reason text;

alter table credential_templates drop constraint if exists credential_templates_lifecycle_valid;
alter table credential_templates add constraint credential_templates_lifecycle_valid
  check (lifecycle in ('draft', 'submitted', 'approved', 'published', 'withdrawn'));

-- Anything already published predates this file and is published by definition.
update credential_templates set lifecycle = 'published'
where is_active = true or published_at is not null;


-- ===========================================================================
-- 2. THE APPROVALS
--
-- One row per office per template. The unique index is what makes an approval
-- an approval: an office signs once, and signing twice is the same signature
-- rather than two.
-- ===========================================================================

create table if not exists credential_template_approvals (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references credential_templates (id) on delete cascade,
  office       text not null check (office in ('registrar', 'academic-office', 'vice-chancellor')),
  decision     text not null check (decision in ('approved', 'rejected')),
  decided_by   uuid references auth.users (id) on delete set null,
  decided_at   timestamptz not null default now(),
  note         text,
  unique (template_id, office)
);

create index if not exists template_approvals_template_idx
  on credential_template_approvals (template_id);

-- An approval, once given, is a fact. It may be withdrawn by withdrawing the
-- whole submission — which resets the chain and makes every office sign again —
-- but it cannot be quietly edited into something else afterwards.
create or replace function guard_template_approval() returns trigger
language plpgsql as $$
begin
  raise exception 'an approval cannot be edited; withdraw the submission and resubmit';
end;
$$;

drop trigger if exists template_approvals_immutable on credential_template_approvals;
create trigger template_approvals_immutable
  before update on credential_template_approvals
  for each row execute function guard_template_approval();


-- ===========================================================================
-- 3. PUBLISHING REQUIRES THE CHAIN
--
-- Enforced here, not in the route. A workflow that lives only in application
-- code is bypassed by the next route somebody writes.
-- ===========================================================================

create or replace function guard_template_publication() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  signed integer;
begin
  if new.lifecycle = 'published' and coalesce(old.lifecycle, '') <> 'published' then
    select count(distinct office) into signed
    from credential_template_approvals
    where template_id = new.id and decision = 'approved';

    if signed < 3 then
      raise exception
        'this design has % of 3 approvals; the Registrar, the Academic Office and the Vice Chancellor must each approve before it can be published',
        signed;
    end if;

    if exists (
      select 1 from credential_template_approvals
      where template_id = new.id and decision = 'rejected'
    ) then
      raise exception 'this design has been rejected by an approving office and cannot be published';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists credential_templates_publication on credential_templates;
create trigger credential_templates_publication
  before update on credential_templates
  for each row execute function guard_template_publication();


-- ===========================================================================
-- 4. ROW-LEVEL SECURITY
-- ===========================================================================

alter table credential_template_approvals enable row level security;

-- The approving offices see what is in front of them; everyone who can read a
-- template can see who has signed it. An approval chain nobody can inspect is
-- not governance either.
drop policy if exists template_approvals_read on credential_template_approvals;
create policy template_approvals_read on credential_template_approvals
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office', 'vice-chancellor', 'chancellor')
  );

-- Writes go through the server route, which checks that the caller holds the
-- office they are signing for. Deliberately no INSERT policy: with RLS on and
-- none, only the service role can record an approval, so nobody can sign on
-- another office's behalf from a browser.


-- ===========================================================================
-- 5. VERIFY
-- ===========================================================================

-- (a) The lifecycle column, with everything already live marked published.
select lifecycle, count(*) from credential_templates group by lifecycle;

-- (b) Both guards installed. Expect two rows.
select tgname from pg_trigger
where tgname in ('credential_templates_publication', 'template_approvals_immutable')
order by tgname;

-- (c) Nothing awaiting approval on a fresh install.
select t.kind, t.version, t.name, t.lifecycle, count(a.id) as approvals
from credential_templates t
left join credential_template_approvals a on a.template_id = t.id and a.decision = 'approved'
group by t.id, t.kind, t.version, t.name, t.lifecycle
order by t.kind, t.version desc;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- Three accounts must exist and hold their roles, or no design can ever be
-- published again:
--
--   registrar         — already appointed
--   academic-office   — appoint one:  update profiles set role = 'academic-office' where lower(email) = '…';
--   vice-chancellor   — appoint one:  update profiles set role = 'vice-chancellor' where lower(email) = '…';
--
-- The designs already in force are unaffected: they were marked published by
-- section 1 and the guard only fires on a transition INTO published.
-- ===========================================================================
