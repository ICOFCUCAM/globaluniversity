-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE CREDENTIAL REGISTER
--
-- Run this after 000_complete.sql. It is idempotent and destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS THE MOST IMPORTANT PIECE OF THE CREDENTIAL SYSTEM
--
-- Until now the university could SIGN a credential but had no record that it
-- had ISSUED one. Those are different claims, and the difference is the whole
-- of credential security:
--
--   A signature proves the university's key was applied to a string.
--   The register proves the university issued THIS credential, to THIS person,
--   on THIS date — and whether it still stands.
--
-- Without the register, /verify could only ever answer "correctly signed",
-- which is why the code has said exactly that and never "valid". Three things
-- were impossible:
--
--   1. REVOCATION. A degree rescinded for proven misconduct, a certificate
--      issued in error, a transcript superseded — none could be withdrawn. Once
--      signed, a document verified for ever. An institution that cannot revoke
--      a credential cannot be said to control it.
--
--   2. EXISTENCE. A forger who obtained the signing key could mint credentials
--      that verified perfectly, for people who never studied here, and nothing
--      would contradict them. The register does: a credential not on it was not
--      issued, whatever it is signed with.
--
--   3. THE COUNT. The university could not say how many degrees it has awarded,
--      to whom, or under which version of which template. That is a question a
--      regulator asks.
--
-- ---------------------------------------------------------------------------
-- THE HASH, AND WHAT IT IS FOR
--
-- `content_hash` is SHA-256 over the canonical statement of the award — holder,
-- award, classification, programme, date, credential id — computed at issue and
-- never recomputed from a presented document. Verification recomputes it from
-- the REGISTER and compares to the presented one. So:
--
--   presented document = register  →  hash matches      →  authentic
--   presented document altered     →  hash differs      →  altered, and the
--                                                          register says what
--                                                          it should have said
--
-- That last part is what a signature alone cannot do. A broken signature says
-- "something is wrong"; the register says what the correct values were.
-- ===========================================================================


-- ===========================================================================
-- 1. THE REGISTER
-- ===========================================================================

create table if not exists credentials_issued (
  id                uuid primary key default gen_random_uuid(),

  -- The number printed on the document, e.g. IGUC-BTH-26A9-F8K2-P19D.
  --
  -- NOT SEQUENTIAL, and the uniqueness constraint is the only thing that makes
  -- that safe. A sequential number tells a forger what the next one is, and
  -- tells anyone holding two certificates how many the university has ever
  -- issued. The programme code and year are readable because a registrar uses
  -- them; the rest is random.
  credential_id     text not null unique,

  kind              text not null check (kind in (
                      'certificate', 'transcript', 'diploma',
                      'admission-letter', 'student-card', 'completion-letter'
                    )),

  -- restrict, not cascade. A student who holds a credential cannot be deleted
  -- out from under it — the award is a fact about the world that outlives the
  -- record-keeping, and a dangling certificate with no holder is a worse
  -- outcome than a delete that fails.
  student_id        uuid references students (id) on delete restrict,
  student_number    text,

  -- Denormalised on purpose. A certificate states what it stated on the day it
  -- was issued. If the register read the name from `students` at verification
  -- time, a later correction to the record would silently rewrite what a
  -- graduate's certificate appears to say — and the hash would stop matching a
  -- document that was never altered.
  holder_name       text not null,
  award             text,
  classification    text,
  programme         text,

  -- Exactly what was sealed, in the order it was sealed. Kept so a credential
  -- can be re-rendered years later as it was issued, and so the hash can be
  -- audited rather than trusted.
  facts             jsonb not null,
  content_hash      text not null,
  seal_code         text not null,

  -- Which design it was printed under. Templates are versioned and never
  -- edited in place (see 000_complete.sql section 13), so this is enough to
  -- reproduce the document exactly.
  template_version  integer,

  issued_by         uuid references auth.users (id) on delete set null,
  issued_at         timestamptz not null default now(),

  -- 'replaced' is not 'revoked'. A transcript reissued after a mark correction
  -- supersedes its predecessor without the predecessor being fraudulent, and
  -- reporting it as revoked would suggest the holder did something wrong.
  status            text not null default 'issued'
                    check (status in ('issued', 'revoked', 'replaced')),
  revoked_at        timestamptz,
  revoked_by        uuid references auth.users (id) on delete set null,
  revocation_reason text,
  replaced_by       uuid references credentials_issued (id) on delete set null
);

create index if not exists credentials_student_idx  on credentials_issued (student_id);
create index if not exists credentials_kind_idx     on credentials_issued (kind, issued_at desc);
create index if not exists credentials_status_idx   on credentials_issued (status) where status <> 'issued';
create index if not exists credentials_hash_idx     on credentials_issued (content_hash);


-- ===========================================================================
-- 2. A CREDENTIAL CANNOT BE EDITED, ONLY REVOKED
--
-- The register is the university's word on what it has awarded. If the fields
-- on it could be changed, verifying against it would prove nothing that
-- verifying against the document did not — both would say whatever the last
-- person to edit them decided.
--
-- So: the award fields are frozen at issue. Only the revocation columns move,
-- and only in one direction. This binds the service role too, which is the
-- point: the routes hold that key, and a register the most powerful account can
-- rewrite is not a register.
-- ===========================================================================

create or replace function guard_credential_register() returns trigger
language plpgsql
as $$
begin
  if (new.credential_id    is distinct from old.credential_id)
     or (new.kind            is distinct from old.kind)
     or (new.student_id      is distinct from old.student_id)
     or (new.holder_name     is distinct from old.holder_name)
     or (new.award           is distinct from old.award)
     or (new.classification  is distinct from old.classification)
     or (new.programme       is distinct from old.programme)
     or (new.facts           is distinct from old.facts)
     or (new.content_hash    is distinct from old.content_hash)
     or (new.seal_code       is distinct from old.seal_code)
     or (new.template_version is distinct from old.template_version)
     or (new.issued_at       is distinct from old.issued_at)
     or (new.issued_by       is distinct from old.issued_by)
  then
    raise exception 'an issued credential cannot be altered; revoke it and issue a replacement';
  end if;

  -- Revocation is final. Un-revoking would let an institution quietly restore a
  -- credential it had withdrawn, with nothing in the record to show it ever had
  -- — which is precisely the manoeuvre revocation exists to make impossible.
  if old.status = 'revoked' and new.status <> 'revoked' then
    raise exception 'a revoked credential cannot be reinstated; issue a new one';
  end if;

  if new.status = 'revoked' and old.status <> 'revoked' then
    if new.revocation_reason is null or btrim(new.revocation_reason) = '' then
      raise exception 'a revocation must state its reason';
    end if;
    new.revoked_at := coalesce(new.revoked_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists credentials_guard on credentials_issued;
create trigger credentials_guard
  before update on credentials_issued
  for each row execute function guard_credential_register();

-- Deletion is not a correction. A credential that should not have been issued
-- is revoked, with a reason, and the record of both stays.
create or replace function refuse_credential_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'a credential is revoked, never deleted';
end;
$$;

drop trigger if exists credentials_no_delete on credentials_issued;
create trigger credentials_no_delete before delete on credentials_issued
  for each statement execute function refuse_credential_delete();


-- ===========================================================================
-- 3. ROW-LEVEL SECURITY
--
-- RLS on, and deliberately almost no policy. Verification runs through a server
-- route holding the service-role key, which bypasses RLS — so the register does
-- not need to be readable by the browser, and making it readable would publish
-- the name, award and classification of every graduate to anyone holding the
-- publishable key.
--
-- The one policy is the holder's own: a graduate may see their own credentials
-- in the portal. Not anybody else's.
-- ===========================================================================

alter table credentials_issued enable row level security;

drop policy if exists credentials_own on credentials_issued;
create policy credentials_own on credentials_issued
  for select using (
    student_id in (select id from students where auth_user_id = auth.uid())
  );

drop policy if exists credentials_registry_read on credentials_issued;
create policy credentials_registry_read on credentials_issued
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

-- (a) The table and its guards. Expect two triggers.
select tgname from pg_trigger
where tgname in ('credentials_guard', 'credentials_no_delete')
order by tgname;

-- (b) Two policies, and RLS on.
select rowsecurity from pg_tables where tablename = 'credentials_issued';
select policyname, cmd from pg_policies where tablename = 'credentials_issued' order by policyname;

-- (c) Nothing issued yet, on a fresh install. This is the number the university
--     can now answer that it could not before.
select kind, status, count(*) from credentials_issued group by kind, status;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- CREDENTIAL_SECRET must be set in Vercel before the first credential is
-- issued. The register records a seal code computed with it; issue credentials
-- without it and the register fills with rows whose seal column is empty, and
-- they can never be sealed retrospectively without changing what was issued.
-- ===========================================================================
