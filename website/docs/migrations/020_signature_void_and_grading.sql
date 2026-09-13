-- ===========================================================================
-- 020 — A SIGNATURE ANYONE CAN CHECK, VOIDING, AND A GRADING SCALE THE
--       UNIVERSITY CAN CHANGE WITHOUT A DEPLOYMENT
--
-- Three gaps, named honestly in the last review and closed here.
--
-- ---------------------------------------------------------------------------
-- 1. THE SEAL IS A SECRET; THE SIGNATURE IS NOT
-- ---------------------------------------------------------------------------
--
-- Every credential already carries an HMAC seal over its content hash. An HMAC
-- is a SHARED-SECRET construction: it proves a document is genuine only to
-- somebody who holds CREDENTIAL_SECRET, which is the University and nobody
-- else. That is why verification has to go through /verify — the University is
-- the only party that can perform the check.
--
-- A receiving university, a credential evaluator or an immigration officer
-- cannot check it offline, and must trust that the website they are looking at
-- is the University's. For most purposes /verify is enough. For a document
-- handed to an authority that will archive it for thirty years, it is not.
--
-- So each credential now also carries a DETACHED Ed25519 SIGNATURE over the
-- same content hash, made with a private key the University holds and
-- verifiable by anyone with the matching PUBLIC key, which is published. The
-- seal is unchanged and still governs; the signature is an additional,
-- independently checkable statement.
--
-- WHAT THIS IS STILL NOT, and the interface must not claim otherwise: it is not
-- a PAdES or X.509 signature embedded in a PDF, so Adobe Reader will not show a
-- blue tick. Doing that needs a certificate from a public authority the
-- University would have to buy and be audited for. Calling this "digitally
-- signed" without that distinction is the kind of overstatement that gets a
-- registry's documents rejected the first time somebody checks properly.
--
-- ---------------------------------------------------------------------------
-- 2. VOIDING IS NOT REVOKING, AND THE DIFFERENCE MATTERS TO THE HOLDER
-- ---------------------------------------------------------------------------
--
-- REVOKED says the University has withdrawn the award. It is a finding against
-- the holder and it is what /verify reports to anyone who asks.
--
-- VOID says this DOCUMENT should never have existed — issued to the wrong
-- student, issued twice, issued against a record that had not been approved.
-- The holder has done nothing wrong and their award, if they have one, stands.
--
-- Recording both as 'revoked' would put a mark against a student for a
-- registry clerk's mistake, permanently and visibly, on a public verification
-- service. They are separate states.
--
-- Neither deletes anything. The row stays, the reason is required, and both are
-- on the audit trail.
--
-- ---------------------------------------------------------------------------
-- 3. THE GRADING SCALE IS THE UNIVERSITY'S, NOT THE REPOSITORY'S
-- ---------------------------------------------------------------------------
--
-- It lives in src/content/regulations.ts, which means changing a band is a code
-- edit and a deployment — and means a programme that grades differently cannot
-- exist at all. The University asked for it to be configurable.
--
-- The published scale REMAINS THE FALLBACK and is not deleted: a deployment
-- that has not run this migration, or a database with no active scale, still
-- grades exactly as it does today rather than failing or defaulting to nothing.
--
-- AND A SCALE IS VERSIONED, NEVER EDITED. A transcript issued in 2026 was
-- computed under the 2026 bands; rewriting them would change what the
-- University said about a graduate after the fact, which is the same rule the
-- credential templates already follow.
--
-- Idempotent. Run it twice; the second run changes nothing.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. VOIDING, AND THE SIGNATURE
-- ---------------------------------------------------------------------------

alter table credentials_issued
  add column if not exists signature      text,
  -- Which key signed it. A key is eventually rotated, and a signature with no
  -- record of the key it was made with becomes unverifiable the day that
  -- happens.
  add column if not exists signing_key_id text,
  add column if not exists void_reason    text,
  add column if not exists voided_by      uuid,
  add column if not exists voided_at      timestamptz;

-- 'void' joins the existing states. The constraint is replaced rather than
-- added to, because a check constraint cannot be extended in place.
do $$
declare
  con text;
begin
  select conname into con
    from pg_constraint
   where conrelid = 'credentials_issued'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%'
     and pg_get_constraintdef(oid) ilike '%issued%'
   limit 1;

  if con is not null then
    execute format('alter table credentials_issued drop constraint %I', con);
  end if;

  alter table credentials_issued add constraint credentials_issued_status_check
    check (status in ('issued', 'revoked', 'replaced', 'void'));
end $$;

-- A VOID DOCUMENT MUST SAY WHY. "Voided" with no reason is a document that
-- vanished from use with nobody accountable for the decision.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'credentials_issued_void_check') then
    alter table credentials_issued add constraint credentials_issued_void_check
      check (status <> 'void'
             or (void_reason is not null and length(btrim(void_reason)) >= 12
                 and voided_by is not null and voided_at is not null));
  end if;
end $$;

create index if not exists credentials_void_idx
  on credentials_issued (voided_at) where status = 'void';

-- ---------------------------------------------------------------------------
-- 1b. 'voided' JOINS THE AUDITED ACTIONS
-- ---------------------------------------------------------------------------
--
-- The audit table's action list is a closed vocabulary on purpose: an action
-- outside it fails the insert, which is the right failure, because the
-- alternative is an act that happened and was not recorded. Voiding is a new
-- act, so it has to be admitted to the list — and the route writes the trail
-- BEFORE it changes the document, so without this the void would have been
-- refused rather than silently unrecorded.

do $$
declare
  con text;
begin
  select conname into con
    from pg_constraint
   where conrelid = 'credential_audit_events'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%action%'
     and pg_get_constraintdef(oid) ilike '%reinstated%'
   limit 1;

  if con is not null then
    execute format('alter table credential_audit_events drop constraint %I', con);
  end if;

  alter table credential_audit_events add constraint credential_audit_events_action_check
    check (action in
      ('issued', 'corrected', 'reissued', 'revoked', 'reinstated', 'voided',
       'printed', 'emailed', 'template_created', 'template_published',
       'type_created', 'correction_requested', 'correction_reviewed',
       'correction_approved', 'correction_rejected'));
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE GRADING SCALE, VERSIONED
-- ---------------------------------------------------------------------------

create table if not exists grading_scales (
  id            uuid primary key default gen_random_uuid(),

  name          text not null,
  version       integer not null default 1,

  -- NULL applies to the whole University. A value scopes the scale to one
  -- award kind, so a doctorate can be graded differently from a certificate
  -- without a second system.
  award_kind    text,

  -- The lowest mark that earns credit, under this scale.
  pass_mark     numeric(5,2) not null,
  -- The top of the scale, so a GPA can be printed over its own denominator.
  max_point     numeric(3,2) not null,

  -- [{ grade, points, min, max, descriptor }, …] in descending order.
  bands         jsonb not null,

  is_active     boolean not null default false,
  published_by  uuid,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),

  unique (name, version)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'grading_scales_kind_check') then
    alter table grading_scales add constraint grading_scales_kind_check
      check (award_kind is null or award_kind in
             ('doctorate', 'masters', 'bachelors', 'diploma', 'certificate'));
  end if;

  -- A SCALE WITH NO BANDS WOULD GRADE EVERY MARK AS NOTHING.
  if not exists (select 1 from pg_constraint where conname = 'grading_scales_bands_check') then
    alter table grading_scales add constraint grading_scales_bands_check
      check (jsonb_typeof(bands) = 'array' and jsonb_array_length(bands) > 0);
  end if;
end $$;

-- ONE ACTIVE SCALE PER SCOPE. Two would mean two answers to "what is a B",
-- and which one applied would depend on row order.
create unique index if not exists grading_scales_active_global_idx
  on grading_scales ((true)) where is_active and award_kind is null;
create unique index if not exists grading_scales_active_kind_idx
  on grading_scales (award_kind) where is_active and award_kind is not null;

-- A PUBLISHED SCALE IS NEVER EDITED. Publishing a change writes a new version;
-- the old one stays exactly as it was, because a transcript issued under it was
-- computed with those bands and rewriting them changes what the University said
-- about a graduate after the fact.
create or replace function refuse_published_scale_edit() returns trigger
language plpgsql as $$
begin
  if old.published_at is null then
    return new;                       -- a draft may still be worked on
  end if;
  -- Activating and deactivating are the only permitted changes.
  if new.name = old.name
     and new.version = old.version
     and new.award_kind is not distinct from old.award_kind
     and new.pass_mark = old.pass_mark
     and new.max_point = old.max_point
     and new.bands = old.bands then
    return new;
  end if;
  raise exception
    'Grading scale "% v%" has been published and cannot be edited. Publish a new '
    'version instead: a transcript issued under this scale was computed with these '
    'bands, and changing them alters what the University said about a graduate '
    'after the fact.', old.name, old.version
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists grading_scales_no_edit on grading_scales;
create trigger grading_scales_no_edit
  before update on grading_scales
  for each row execute function refuse_published_scale_edit();

alter table grading_scales enable row level security;

drop policy if exists grading_scales_read on grading_scales;
create policy grading_scales_read on grading_scales
  for select using (auth.uid() is not null);

-- THE SUPERADMINISTRATOR ALONE. A grading scale decides every classification
-- the University awards; it sits with the credential design, not with
-- operations.
drop policy if exists grading_scales_write on grading_scales;
create policy grading_scales_write on grading_scales
  for insert with check (auth_role() = 'superadmin');

drop policy if exists grading_scales_update on grading_scales;
create policy grading_scales_update on grading_scales
  for update using (auth_role() = 'superadmin') with check (auth_role() = 'superadmin');

-- ---------------------------------------------------------------------------
-- 3. SEEDING THE PUBLISHED SCALE, SO NOTHING CHANGES ON THE DAY THIS RUNS
-- ---------------------------------------------------------------------------
--
-- The bands below are the University's published regulations, transcribed —
-- the same eleven the repository already carries. Seeding them means the table
-- and the code agree from the first minute, and the University can then publish
-- a version 2 rather than starting from an empty screen.

insert into grading_scales (name, version, award_kind, pass_mark, max_point, bands,
                            is_active, published_at)
select 'University grading scale', 1, null, 65, 4.00,
  '[{"grade":"A",  "points":4.00,"min":94,"max":100,"descriptor":"Excellent"},
    {"grade":"A-", "points":3.33,"min":91,"max":93, "descriptor":"Very Good"},
    {"grade":"B+", "points":3.00,"min":89,"max":90, "descriptor":"Good"},
    {"grade":"B",  "points":2.67,"min":85,"max":88, "descriptor":"Above Average"},
    {"grade":"B-", "points":2.33,"min":81,"max":84, "descriptor":"Average"},
    {"grade":"C+", "points":2.00,"min":77,"max":80, "descriptor":"Satisfactory"},
    {"grade":"C",  "points":1.67,"min":73,"max":76, "descriptor":"Satisfactory"},
    {"grade":"C-", "points":1.33,"min":70,"max":72, "descriptor":"Below Satisfactory"},
    {"grade":"D+", "points":1.00,"min":67,"max":69, "descriptor":"Pass"},
    {"grade":"D",  "points":0.67,"min":65,"max":66, "descriptor":"Pass"},
    {"grade":"F",  "points":0.00,"min":0, "max":64, "descriptor":"Fail"}]'::jsonb,
  true, now()
where not exists (select 1 from grading_scales where name = 'University grading scale' and version = 1);

-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  scale_id uuid;
  active_id uuid;
  refused boolean;
begin
  -- ---- A published scale cannot be edited --------------------------------
  select id into scale_id from grading_scales
   where name = 'University grading scale' and version = 1;

  refused := false;
  begin
    update grading_scales set pass_mark = 50 where id = scale_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '020 FAILED: a published grading scale could be edited';
  end if;

  -- …but activating and deactivating it still work.
  --
  -- ON WHICHEVER SCALE IS CURRENTLY ACTIVE, NOT ON VERSION 1. This proof used
  -- to name version 1 and switch it off and back on, which was correct for
  -- exactly as long as version 1 was the only scale the University had. 035
  -- published version 2 and deactivated version 1 — and re-running this file
  -- after that turned version 1 back on while version 2 was still on, which the
  -- unique index over the active global scale refuses. So a bundle that had
  -- been run once could not be run twice, and the failure pointed at 020 rather
  -- than at the assumption inside it.
  --
  -- Found by running RUN-ALL.sql a second time. A migration is not idempotent
  -- because it says so.
  select id into active_id from grading_scales
   where name = 'University grading scale' and is_active and award_kind is null;
  if active_id is null then active_id := scale_id; end if;

  update grading_scales set is_active = false where id = active_id;
  update grading_scales set is_active = true  where id = active_id;

  -- ---- Two active global scales are impossible ---------------------------
  refused := false;
  begin
    insert into grading_scales (name, version, pass_mark, max_point, bands, is_active)
    values ('A second opinion', 1, 50, 5.00,
            '[{"grade":"A","points":5.00,"min":70,"max":100}]'::jsonb, true);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '020 FAILED: the University had two active grading scales at once';
  end if;

  -- ---- A scale with no bands is refused ----------------------------------
  refused := false;
  begin
    insert into grading_scales (name, version, pass_mark, max_point, bands)
    values ('Empty', 1, 50, 4.00, '[]'::jsonb);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '020 FAILED: a grading scale with no bands was accepted';
  end if;

  -- ---- Voiding requires a reason and an author ---------------------------
  refused := false;
  begin
    -- `facts` IS SUPPLIED SO THE REFUSAL IS THE ONE BEING TESTED. Without it
    -- the insert failed on a NOT NULL column and the proof passed for the
    -- wrong reason — a green check that proves nothing is worse than none.
    insert into credentials_issued
      (credential_id, kind, holder_name, award, facts, content_hash, seal_code, status)
    values ('IGUC-VOID-PROOF-020', 'transcript', 'Proof', 'Proof',
            '{}'::jsonb, 'deadbeef', 'PROOF-CODE', 'void');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '020 FAILED: a credential was voided with no reason recorded';
  end if;

  -- …and is accepted when it carries one.
  --
  -- ROLLED BACK RATHER THAN DELETED. A credential is never deleted — 004's
  -- own trigger refuses it, correctly — so a proof row inserted here would
  -- stay on the University's register for ever as a document that never
  -- existed. The insert happens inside a subtransaction that is unwound by
  -- raising, so the rule is genuinely exercised and the register is untouched.
  begin
    insert into credentials_issued
      (credential_id, kind, holder_name, award, facts, content_hash, seal_code,
       status, void_reason, voided_by, voided_at)
    values ('IGUC-VOID-PROOF-020', 'transcript', 'Proof', 'Proof',
            '{}'::jsonb, 'deadbeef', 'PROOF-CODE', 'void',
            'Issued against the wrong student record', gen_random_uuid(), now());

    if not exists (select 1 from credentials_issued
                    where credential_id = 'IGUC-VOID-PROOF-020' and status = 'void') then
      raise exception '020 FAILED: a properly reasoned void was not accepted';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  if exists (select 1 from credentials_issued where credential_id = 'IGUC-VOID-PROOF-020') then
    raise exception '020 FAILED: the proof row was left on the register';
  end if;

  -- ---- The trail accepts a void, and still refuses an invented action ----
  refused := false;
  begin
    insert into credential_audit_events (credential_ref, action, actor_role)
    values ('IGUC-PROOF-020', 'deleted', 'superadmin');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '020 FAILED: the audit trail accepted an action outside its vocabulary';
  end if;

  begin
    insert into credential_audit_events (credential_ref, action, actor_role, reason)
    values ('IGUC-PROOF-020', 'voided', 'superadmin', 'Proof that voided is auditable');
    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then
      raise exception '020 FAILED: a void could not be written to the audit trail (%)', sqlerrm;
    end if;
  end;

  raise notice '020 OK — a published scale cannot be edited, the University cannot hold two '
               'active scales, an empty scale is refused, voiding requires a stated reason '
               'and a named author, and ''voided'' is an auditable action.';
end $$;

-- ---------------------------------------------------------------------------
-- 5. WHAT THE UNIVERSITY STILL HAS TO DO
-- ---------------------------------------------------------------------------

do $$
declare
  signed integer;
  total  integer;
begin
  select count(*) filter (where signature is not null), count(*)
    into signed, total
    from credentials_issued;

  if total > 0 and signed = 0 then
    raise notice 'NOTHING IS SIGNED YET. Set CREDENTIAL_SIGNING_KEY on the server and reissue, '
                 'or run the backfill in docs/DEPLOYMENT.md. Credentials issued before the key '
                 'existed keep their HMAC seal and verify normally through /verify; they simply '
                 'carry no independently checkable signature.';
  end if;
end $$;

select 'credentials_issued' as object,
       count(*) filter (where column_name in
             ('signature','signing_key_id','void_reason','voided_by','voided_at')) as columns_added
  from information_schema.columns
 where table_schema = 'public' and table_name = 'credentials_issued'
union all
select 'grading_scales rows', count(*)::bigint from grading_scales;
