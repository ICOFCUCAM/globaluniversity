-- ===========================================================================
-- 101 — CERTIFICATE TEMPLATE CONFIDENTIALITY
-- ===========================================================================
--
-- The University's ruling, given on 16 September 2026:
--
--   "The official ICOF certificate template, certificate sample, certificate
--    security configuration and associated institutional design assets are
--    restricted university resources. Access shall be limited exclusively to
--    the Vice-Chancellor and SuperAdmin unless expressly authorized by the
--    governing authority of the university. No Registrar, Director of Academic
--    Affairs, National Rector, National Administration, lecturer, student or
--    other university office shall have access to the certificate template or
--    certificate sample through the ordinary university system."
--
-- And, on where that rule has to live:
--
--   "The security restriction should not exist only in the user interface. It
--    should be enforced at the authorization/API/database level. […] A user
--    who does not have the required permission should receive no
--    certificate-template data at all. Simply hiding a button is not
--    sufficient."
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A DOOR CLOSES, AND FOUR OFFICES ARE ON THE OTHER SIDE OF IT. Today
--    `credential_templates` is readable by the Superadministrator, the System
--    Administrator, the Registrar, the Academic Office and the
--    Vice-Chancellor. From now on the CERTIFICATE design is readable by the
--    Vice-Chancellor and the Superadministrator only. The Registrar, the
--    Director of Academic Affairs and the System Administrator lose it.
--
-- 2. THE CERTIFICATE SCREEN THE REGISTRAR USES WILL STOP DRAWING A PREVIEW,
--    because it fetches the design in the BROWSER, with the Registrar's own
--    session, and that fetch will now return nothing. That is the ruling
--    working, not a fault — but it is a visible change on a screen somebody
--    uses, so it belongs here rather than in a surprise.
--
-- 3. ISSUING A CERTIFICATE IS UNAFFECTED. The delivery route reads the design
--    server-side under the service key, which no policy binds. That is
--    already the "Authorized Certificate Engine" the ruling describes: the
--    officer asks for a certificate, the engine holds the design, and the
--    officer never sees it.
--
-- 4. ONLY THE CERTIFICATE. The transcript design is NOT restricted — the
--    ruling is about the certificate, the transcript sheet is a different
--    asset, and the Registrar's transcript screen renders it in the browser.
--    Closing the whole table would have broken transcripts to protect
--    certificates.
--
-- 5. A REISSUE IS AUTHORISED, NOT REPEATED. "The system must never allow
--    someone to simply generate unlimited copies." A replacement certificate
--    needs a request, a reason and an authorisation, and one authorisation
--    permits one regeneration.
--
-- 6. THE VICE-CHANCELLOR CAN FINALLY READ THE CERTIFICATE AUDIT. 013 built
--    `credential_audit_events`, made it append-only, and enabled row-level
--    security on it WITHOUT WRITING A SINGLE POLICY. A table in that state
--    returns nothing to everybody: the complete audit trail the ruling gives
--    the Vice-Chancellor and the Superadministrator has been unreadable by
--    both of them since it was built. Only the service key could see it.
--
-- 7. AND THE VICE-CHANCELLOR CAN READ THE REGISTER OF ISSUED CERTIFICATES.
--    `credentials_issued` has admitted the Superadministrator, the System
--    Administrator, the Registrar and the Academic Office since 004, and not
--    the Vice-Chancellor. Both halves of "complete visibility" were missing
--    and this is the second. Additive: nobody loses the register.
--
-- 8. NOTHING IS SEEDED. One table, one view, some policies.
--
-- ---------------------------------------------------------------------------
-- WHY §4's EXCEPTION IS A GRANT AND NOT A ROLE
-- ---------------------------------------------------------------------------
--
-- "The Director of Academic Affairs should also not have access to the
--  certificate sample/template, UNLESS the VC or SuperAdmin has explicitly
--  granted a separate security permission."
--
-- That is 056's `capability_grants` exactly — who granted what to whom, when,
-- with an expiry and a revocation, and auditable. It is the same shape as the
-- National Rector who also teaches: a condition is a grant, not a role. So the
-- exception is a live grant of `view-certificate-template`, it runs out by
-- itself, and nobody has to remember to take it away.
--
-- AND THE GRANT MUST COME FROM ABOVE. 056 does not record what role the
-- granter held, so a grant is checked here against who the granter IS: if the
-- Registrar could grant this capability, the restriction would last until the
-- first Registrar decided otherwise.
-- ===========================================================================


-- ===========================================================================
-- 1. WHO SEES THE CERTIFICATE DESIGN
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- THE TWO OFFICES, ONCE.
--
-- 100 asked the same question under the name `validates_a_transcript_exception`
-- because that was what it needed it for. It is the same test, and two copies
-- of one rule is how the two copies come to disagree — so the general one is
-- written here and the transcript-shaped name becomes a wrapper over it,
-- keeping 100's policies and the sentence they read as.
-- ---------------------------------------------------------------------------

create or replace function the_vice_chancellor_or_the_superadministrator(who uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role in ('superadmin', 'vice-chancellor')
       from profiles p
      where p.id = coalesce(who, auth.uid())),
    false);
$$;

create or replace function validates_a_transcript_exception(who uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select the_vice_chancellor_or_the_superadministrator(who);
$$;


-- ---------------------------------------------------------------------------
-- AND SEEING THE DESIGN IS A WIDER QUESTION THAN BEING ONE OF THEM, because
-- §4 lets them lend it out. The two are kept apart deliberately, and the proof
-- below is the reason: written as one function, the express authorisation to
-- LOOK AT the certificate design also became authority to AUTHORISE A
-- REPLACEMENT CERTIFICATE, which nobody granted and nobody intended. That is
-- the University's own §8 the other way round — holding one authority does not
-- confer another.
-- ---------------------------------------------------------------------------

create or replace function sees_the_certificate_design(who uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select the_vice_chancellor_or_the_superadministrator(who)
  or exists (
    -- Or an express authorisation, live, and given by one of those two.
    select 1
      from capability_grants g
      join profiles gp on gp.id = g.granted_by
     where g.grantee_id = coalesce(who, auth.uid())
       and g.capability = 'view-certificate-template'
       and g.revoked_at is null
       and g.expires_at > now()
       and gp.role in ('superadmin', 'vice-chancellor'));
$$;

comment on function sees_the_certificate_design(uuid) is
  'The Vice-Chancellor, the Superadministrator, or somebody one of them has expressly and '
  'temporarily authorised. Nobody else — not the Registrar, not the Director of Academic '
  'Affairs, not a National Rector, not the System Administrator.';


-- ===========================================================================
-- 2. AND THE DATABASE IS WHERE THAT IS ENFORCED
-- ===========================================================================
--
-- PER KIND, NOT PER TABLE. `credential_templates` holds the transcript sheet
-- as well as the certificate, and the Registrar's transcript screen renders
-- that one in the browser with the Registrar's own session. A policy written
-- against the whole table would have taken the University's certificate rule
-- and used it to break transcripts.
-- ===========================================================================

drop policy if exists credential_templates_read on credential_templates;
create policy credential_templates_read on credential_templates
  for select using (
    case
      when kind = 'certificate' then sees_the_certificate_design()
      else auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                           'vice-chancellor')
    end
  );

-- THE APPROVAL QUEUE CARRIES THE SAME PROBLEM. A row saying "this certificate
-- design is awaiting approval" is not the design, but the screen that lists it
-- opens it, and 013 left this table with row-level security on and no policy
-- at all — so it has been readable by nobody but the service key.
drop policy if exists credential_template_approvals_read on credential_template_approvals;
create policy credential_template_approvals_read on credential_template_approvals
  for select using (
    sees_the_certificate_design()
    or exists (select 1 from credential_templates t
                where t.id = credential_template_approvals.template_id
                  and t.kind <> 'certificate')
  );


-- ===========================================================================
-- 3. §10 — A REPLACEMENT IS AUTHORISED, NOT REPEATED
-- ===========================================================================

create table if not exists certificate_reissue_requests (
  id                  uuid primary key default gen_random_uuid(),

  -- WHICH CERTIFICATE. The register row, not a typed reference: a replacement
  -- for a certificate the University did not issue is not a replacement.
  original_credential uuid not null references credentials_issued (id) on delete restrict,

  -- §10's own list.
  reason              text not null
                      check (reason in ('lost', 'damaged', 'legal-name-change', 'correction')),
  detail              text not null check (length(btrim(detail)) >= 20),

  requested_by        uuid not null references auth.users (id) on delete restrict,
  requested_role      text not null,
  requested_at        timestamptz not null default now(),

  status              text not null default 'awaiting-authorisation'
                      check (status in ('awaiting-authorisation', 'authorised',
                                        'rejected', 'spent')),
  authorised_by       uuid references auth.users (id) on delete restrict,
  authorised_at       timestamptz,
  decision_note       text,

  -- ---- "NEVER UNLIMITED COPIES" -------------------------------------------
  --
  -- One authorisation, one regeneration. `spent` is set when the replacement
  -- is issued and `replacement_credential` names it, so the request cannot be
  -- used twice and the pair can be read in either direction afterwards.
  replacement_credential uuid references credentials_issued (id) on delete restrict,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint certificate_reissue_authoriser_is_not_the_requester
    check (authorised_by is null or authorised_by <> requested_by),

  constraint certificate_reissue_refusal_says_why
    check (status <> 'rejected'
           or (decision_note is not null and length(btrim(decision_note)) >= 10)),

  constraint certificate_reissue_authorised_rows_name_the_authoriser
    check (status in ('awaiting-authorisation', 'rejected')
           or (authorised_by is not null and authorised_at is not null)),

  constraint certificate_reissue_spent_names_its_replacement
    check (status <> 'spent' or replacement_credential is not null)
);

create index if not exists certificate_reissue_requests_open_idx
  on certificate_reissue_requests (requested_at desc)
  where status = 'awaiting-authorisation';

create index if not exists certificate_reissue_requests_original_idx
  on certificate_reissue_requests (original_credential, requested_at desc);

-- ONE LIVE AUTHORISATION PER CERTIFICATE. Without this, three requests can be
-- authorised in the morning and three replacements issued in the afternoon,
-- each of them individually within the rule.
create unique index if not exists certificate_reissue_one_live_idx
  on certificate_reissue_requests (original_credential)
  where status = 'authorised';

comment on table certificate_reissue_requests is
  '§10 of the certificate ruling. A replacement certificate is requested with a reason, '
  'authorised by the Vice-Chancellor or the Superadministrator, and the authorisation is '
  'spent when the replacement is issued. The University must never be able to generate '
  'unlimited copies.';


create or replace function a_reissue_is_authorised_from_above()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'spent' then
    if old.status <> 'authorised' then
      raise exception 'A replacement certificate is issued against an authorisation. This '
                      'request is at "%".', old.status
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if new.status = 'awaiting-authorisation' then
    new.authorised_by := null;
    new.authorised_at := null;
    return new;
  end if;

  new.authorised_by := coalesce(new.authorised_by, auth.uid());
  new.authorised_at := coalesce(new.authorised_at, now());

  if new.authorised_by is null then
    raise exception 'A certificate reissue is authorised by somebody. Record who.'
      using errcode = 'insufficient_privilege';
  end if;

  -- THE SAME TWO OFFICES. Reissuing is certificate authority, and §8 of the
  -- transcript ruling is explicit that holding one authority does not confer
  -- another: a Registrar who may issue an ordinary transcript still may not
  -- authorise a replacement certificate.
  -- THE TWO OFFICES THEMSELVES, NOT `sees_the_certificate_design()`. An
  -- officer expressly authorised under §4 to LOOK AT the design has been lent
  -- one power, and authorising a replacement certificate is a different one.
  if not the_vice_chancellor_or_the_superadministrator(new.authorised_by) then
    raise exception 'Only the Vice-Chancellor or the Superadministrator may authorise a '
                    'replacement certificate. Being authorised to view the certificate '
                    'design is not the same authority.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists certificate_reissue_is_from_above on certificate_reissue_requests;
create trigger certificate_reissue_is_from_above
  before update on certificate_reissue_requests
  for each row execute function a_reissue_is_authorised_from_above();

drop trigger if exists certificate_reissue_requests_updated_at on certificate_reissue_requests;
create trigger certificate_reissue_requests_updated_at
  before update on certificate_reissue_requests
  for each row execute function set_updated_at();

alter table certificate_reissue_requests enable row level security;

drop policy if exists certificate_reissue_read on certificate_reissue_requests;
create policy certificate_reissue_read on certificate_reissue_requests
  for select using (
    sees_the_certificate_design()
    or requested_by = auth.uid()
    or auth_role() in ('registrar', 'academic-office')
  );

drop policy if exists certificate_reissue_raise on certificate_reissue_requests;
create policy certificate_reissue_raise on certificate_reissue_requests
  for insert with check (
    requested_by = auth.uid()
    and auth_role() in ('registrar', 'academic-office', 'admin', 'superadmin',
                        'vice-chancellor')
  );

drop policy if exists certificate_reissue_decide on certificate_reissue_requests;
create policy certificate_reissue_decide on certificate_reissue_requests
  for update using (the_vice_chancellor_or_the_superadministrator()
                    or requested_by = auth.uid())
              with check (the_vice_chancellor_or_the_superadministrator()
                    or requested_by = auth.uid());

grant select, insert, update on certificate_reissue_requests to authenticated;


-- ===========================================================================
-- 4. §7 — THE AUDIT TRAIL THE VICE-CHANCELLOR CAN ACTUALLY READ
-- ===========================================================================
--
-- 013 enabled row-level security on `credential_audit_events` and wrote no
-- policy. Row-level security with no policy is not "open by default" — it is
-- CLOSED to everybody, permanently, and only the service key gets past it. So
-- the immutable trail the University is now being promised has been invisible
-- to the two people it is for since the day it was built.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- AND THE REGISTER ITSELF, WHICH IS THE OTHER HALF OF THE SAME GAP.
--
-- `credentials_issued` admits the Superadministrator, the System
-- Administrator, the Registrar and the Academic Office. THE VICE-CHANCELLOR IS
-- NOT ON THAT LIST and never has been. So "the Vice-Chancellor and SuperAdmin
-- can inspect the complete audit trail" was untrue for the Vice-Chancellor in
-- two places at once: the events, which nobody could read, and the register of
-- what was issued, which everybody but them could.
--
-- Found by the proof below asking the Vice-Chancellor to read one certificate
-- and getting none. ADDITIVE: policies are OR'd, so the four offices that can
-- read the register keep reading it exactly as before.
-- ---------------------------------------------------------------------------

drop policy if exists credentials_vice_chancellor_read on credentials_issued;
create policy credentials_vice_chancellor_read on credentials_issued
  for select using (the_vice_chancellor_or_the_superadministrator());


drop policy if exists credential_audit_events_read on credential_audit_events;
create policy credential_audit_events_read on credential_audit_events
  for select using (
    sees_the_certificate_design()
    -- The offices that issue read what they did. They see the event, which is
    -- what happened; they do not see the design, which is what it was made
    -- from. §9: those are different things.
    or actor_id = auth.uid()
    or auth_role() in ('registrar', 'academic-office')
  );

drop policy if exists credential_audit_events_write on credential_audit_events;
create policy credential_audit_events_write on credential_audit_events
  for insert with check (auth.uid() is not null);

grant select, insert on credential_audit_events to authenticated;

-- `credential_amendments` was left in the same state by 013.
drop policy if exists credential_amendments_read on credential_amendments;
create policy credential_amendments_read on credential_amendments
  for select using (
    sees_the_certificate_design()
    or auth_role() in ('registrar', 'academic-office')
  );

grant select on credential_amendments to authenticated;


create or replace view certificate_audit
with (security_invoker = true) as
select c.id,
       c.credential_id                     as certificate_identifier,
       c.kind,
       c.student_id,
       c.student_number,
       c.holder_name                       as student_name,
       c.programme,
       c.award                             as qualification,
       c.classification,
       c.issued_at,
       c.issued_by,
       p.full_name                         as issued_by_name,
       p.role                              as issued_by_role,
       c.status                            as issuance_status,
       c.template_version                  as certificate_version,

       -- §7 "replacement/reissue status", read from the request rather than
       -- inferred from the register: a certificate that replaced another one
       -- and a certificate that was issued twice look identical in
       -- `credentials_issued` alone.
       r.id                                as reissue_request_id,
       r.reason                            as reissue_reason,
       r.status                            as reissue_status,
       r.authorised_by                     as reissue_authorised_by,
       ap.full_name                        as reissue_authorised_by_name,
       r.authorised_at                     as reissue_authorised_at,

       e.events,
       e.last_action,
       e.last_action_at
  from credentials_issued c
  left join profiles p on p.id = c.issued_by
  left join certificate_reissue_requests r on r.replacement_credential = c.id
  left join profiles ap on ap.id = r.authorised_by
  left join lateral (
    select count(*)                                      as events,
           (array_agg(action   order by occurred_at desc))[1] as last_action,
           max(occurred_at)                              as last_action_at
      from credential_audit_events ev
     where ev.credential_id = c.id
  ) e on true
 where c.kind in ('certificate', 'diploma');

comment on view certificate_audit is
  '§7. Every certificate issued, with the officer who issued it, its version, its issuance '
  'status, whether it replaced another certificate and on whose authority. Reads under the '
  'caller''s own rights.';

grant select on certificate_audit to authenticated;


-- ===========================================================================
-- 5. THE PROOF
-- ===========================================================================

do $$
declare
  vc         uuid := gen_random_uuid();
  sup        uuid := gen_random_uuid();
  reg        uuid := gen_random_uuid();
  daa        uuid := gen_random_uuid();
  student    uuid;
  cert       uuid;
  parked     uuid;
  req        uuid;
  refused    boolean;
  seen       integer;
  total      integer;
begin
  insert into auth.users (id, email) values
    (vc,  'proof-101-vc@example.invalid'),
    (sup, 'proof-101-super@example.invalid'),
    (reg, 'proof-101-registrar@example.invalid'),
    (daa, 'proof-101-academic@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (vc,  'proof-101-vc@example.invalid',        'Proof Vice-Chancellor', 'vice-chancellor'),
    (sup, 'proof-101-super@example.invalid',     'Proof Superadmin',      'superadmin'),
    (reg, 'proof-101-registrar@example.invalid', 'Proof Registrar',       'registrar'),
    (daa, 'proof-101-academic@example.invalid',  'Proof Academic Office', 'academic-office')
  on conflict (id) do update set role = excluded.role;

  -- ---- A CERTIFICATE DESIGN OF OUR OWN, AT VERSION 9101 -------------------
  --
  -- NEVER COMPETE FOR WHAT THEIR DATA OCCUPIES. "The active certificate
  -- template" is a unique slot and the University has one in it. 044 died on
  -- exactly this. So the University's active certificate template is PARKED
  -- FIRST, inside the rollback, and put back by it.
  select id into parked from credential_templates
   where kind = 'certificate' and is_active limit 1;
  if parked is not null then
    update credential_templates set is_active = false where id = parked;
  end if;

  insert into credential_templates (kind, version, name, design, is_active, created_by)
    values ('certificate', 9101, 'Proof 101 certificate design',
            '{"proof": "this is the restricted asset"}'::jsonb, true, sup);

  -- ---- §1 AND §8: THE DESIGN IS NOT THE REGISTRAR'S ----------------------
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from credential_templates where kind = 'certificate';
  reset role;
  if seen <> 0 then
    raise exception '101 FAILED — the Registrar read % certificate designs', seen;
  end if;
  raise notice '101 OK  the Registrar receives no certificate-template data at all';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', daa::text, true);
  select count(*) into seen from credential_templates where kind = 'certificate';
  reset role;
  if seen <> 0 then
    raise exception '101 FAILED — the Academic Office read % certificate designs', seen;
  end if;
  raise notice '101 OK  …and neither does the Director of Academic Affairs';

  -- ---- AND IT IS THE VICE-CHANCELLOR'S AND THE SUPERADMINISTRATOR'S ------
  select count(*) into total from credential_templates where kind = 'certificate';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', vc::text, true);
  select count(*) into seen from credential_templates where kind = 'certificate';
  reset role;
  if seen <> total then
    raise exception '101 FAILED — the Vice-Chancellor saw % certificate designs of %',
                    seen, total;
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', sup::text, true);
  select count(*) into seen from credential_templates where kind = 'certificate';
  reset role;
  if seen <> total then
    raise exception '101 FAILED — the Superadministrator saw % certificate designs of %',
                    seen, total;
  end if;
  raise notice '101 OK  the Vice-Chancellor and the Superadministrator each see all % of them',
               total;

  -- ---- §4: AND AN EXPRESS AUTHORISATION LETS ONE THROUGH -----------------
  insert into capability_grants
    (grantee_id, capability, reason, granted_by, expires_at)
    values (daa, 'view-certificate-template',
            'Reviewing the certificate design ahead of the Senate meeting, at the '
            'Vice-Chancellor''s request.',
            vc, now() + interval '7 days');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', daa::text, true);
  select count(*) into seen from credential_templates where kind = 'certificate';
  reset role;
  if seen <> total then
    raise exception '101 FAILED — an expressly authorised officer saw % of %', seen, total;
  end if;
  raise notice '101 OK  an express, expiring authorisation from the Vice-Chancellor opens it';

  -- ---- AND THE REGISTRAR CANNOT WRITE THEMSELVES ONE ---------------------
  insert into capability_grants
    (grantee_id, capability, reason, granted_by, expires_at)
    values (reg, 'view-certificate-template',
            'The Registrar granting the Registrar access to the certificate design.',
            reg, now() + interval '7 days');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from credential_templates where kind = 'certificate';
  reset role;
  if seen <> 0 then
    raise exception '101 FAILED — a self-granted permission opened the certificate design';
  end if;
  raise notice '101 OK  a grant that did not come from above opens nothing';

  -- ---- §4 AND ONLY THE CERTIFICATE ---------------------------------------
  insert into credential_templates (kind, version, name, design, is_active, created_by)
    values ('transcript', 9101, 'Proof 101 transcript design', '{}'::jsonb, false, sup);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from credential_templates
   where kind = 'transcript' and version = 9101;
  reset role;
  if seen <> 1 then
    raise exception '101 FAILED — closing the certificate design also closed the transcript';
  end if;
  raise notice '101 OK  the transcript design is untouched and the Registrar still reads it';

  -- ---- §10: A REPLACEMENT IS AUTHORISED ----------------------------------
  insert into students (matric_no, first_name, last_name, student_number, status)
    values ('PROOF-101', 'Proof', 'Graduate', 'ICOF-PROOF-101-00126', 'enrolled')
    returning id into student;

  insert into credentials_issued
    (credential_id, kind, student_id, student_number, holder_name, programme,
     award, issued_by, facts, content_hash, seal_code)
    values ('IGUC-PROOF-101-0001', 'certificate', student, 'ICOF-PROOF-101-00126',
            'Proof Graduate', 'Master of Theology', 'Master of Theology', reg,
            '{"proof": 101}'::jsonb, 'proof-101-hash', 'PROOF-101')
    returning id into cert;

  insert into certificate_reissue_requests
    (original_credential, reason, detail, requested_by, requested_role)
    values (cert, 'lost',
            'The graduate reports the original was lost in transit and has sworn an affidavit.',
            reg, 'registrar')
    returning id into req;

  -- The Registrar does not authorise their own request.
  begin
    refused := false;
    update certificate_reissue_requests
       set status = 'authorised', authorised_by = reg where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '101 FAILED — the officer who asked for a replacement authorised it';
  end if;

  -- NOR DOES THE ACADEMIC OFFICE — AND THIS IS THE ONE THAT CAUGHT A REAL
  -- FAULT. By this point in the proof the Director of Academic Affairs holds a
  -- live §4 authorisation to view the certificate design, granted by the
  -- Vice-Chancellor a few lines above. Written as one function, that
  -- authorisation ALSO let them authorise a replacement certificate, and this
  -- assertion is what said so.
  begin
    refused := false;
    update certificate_reissue_requests
       set status = 'authorised', authorised_by = daa where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '101 FAILED — an officer authorised to VIEW the certificate design '
                    'authorised a REPLACEMENT certificate';
  end if;
  raise notice '101 OK  a replacement certificate is authorised only from above, and being '
               'lent the design is not that';

  -- And a replacement cannot be issued before it is authorised.
  begin
    refused := false;
    update certificate_reissue_requests set status = 'spent' where id = req;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '101 FAILED — a replacement was issued before it was authorised';
  end if;
  raise notice '101 OK  …and not issued before it is';

  update certificate_reissue_requests
     set status = 'authorised', authorised_by = vc where id = req;

  -- ---- "NEVER UNLIMITED COPIES" ------------------------------------------
  begin
    refused := false;
    insert into certificate_reissue_requests
      (original_credential, reason, detail, requested_by, requested_role,
       status, authorised_by, authorised_at)
      values (cert, 'damaged',
              'A second live authorisation for the same certificate, which is the thing '
              'the University asked to be impossible.',
              daa, 'academic-office', 'authorised', vc, now());
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '101 FAILED — one certificate had two live reissue authorisations';
  end if;
  raise notice '101 OK  one certificate has at most one live authorisation to replace it';

  -- ---- §7: AND THE AUDIT IS READABLE BY THE PEOPLE IT IS FOR -------------
  insert into credential_audit_events
    (credential_id, credential_ref, action, actor_id, actor_role, reason)
    values (cert, 'IGUC-PROOF-101-0001', 'issued', reg, 'registrar', 'Proof 101');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', vc::text, true);
  select count(*) into seen from credential_audit_events where credential_id = cert;
  reset role;
  if seen <> 1 then
    raise exception '101 FAILED — the Vice-Chancellor read % of the certificate audit', seen;
  end if;
  raise notice '101 OK  the Vice-Chancellor can read the certificate audit trail at last';

  -- THE CERTIFICATE ITSELF REPLACED NOTHING, and the audit says so: the
  -- authorisation above is to replace it, not evidence that it was one.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', vc::text, true);
  select count(*) into seen from certificate_audit
   where id = cert and reissue_request_id is null and events = 1;
  reset role;
  if seen <> 1 then
    raise exception '101 FAILED — the audit does not read the certificate as an ordinary issue';
  end if;
  raise notice '101 OK  the audit distinguishes a replacement from an ordinary issue';

  perform set_config('request.jwt.claim.sub', '', true);

  raise exception 'proof-101-rollback';
exception
  when others then
    if sqlerrm = 'proof-101-rollback' then
      raise notice '101 OK  every proof above rolled back; the University''s active '
                   'certificate template is exactly as it was';
    else
      raise;
    end if;
end $$;
