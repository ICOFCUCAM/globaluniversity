-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE CREDIT RULING
--
-- Run after 011_school_of_ministry_curriculum.sql. Idempotent; destroys
-- nothing. Safe to run on a fresh database and on one that has been live.
--
-- ---------------------------------------------------------------------------
-- THE RULING
--
--   "Diploma is 120. 180 is degree."
--
-- The University settled a figure that had been stated three different ways:
--
--   120   seeded here by migration 006 when the awards table was created
--   180   instructed afterwards, and published on the site ever since
--   120   restated by the School of Ministry academic framework §25, inside a
--         ladder of Certificate 60, Diploma 120, Bachelor 180, Master 120
--
-- ---------------------------------------------------------------------------
-- WHY A MIGRATION AND NOT AN EDIT TO 006
--
-- 006 has been corrected, and that fixes FRESH installs only. Its insert ends
-- `on conflict (code) do nothing`, which is deliberate: it exists so that
-- re-running the schema never overwrites a credit value the registry has since
-- set by hand. The consequence is that an installation which already ran the
-- 180 version still holds 180 and will go on holding it however many times 006
-- is replayed.
--
-- `awards.credits_required` is not decoration. It is what the graduation audit
-- reads to decide whether a student may be conferred. A database left at 180
-- would refuse to graduate a diploma student who has completed the 120 credits
-- the University now says the award requires — and the refusal would look like
-- an incomplete record rather than a stale figure.
--
-- ---------------------------------------------------------------------------
-- WHAT IS NOT DONE HERE, AND WHY IT IS NOT AN OVERSIGHT
--
-- No credential is reissued and no conferral is revisited. Section 3 checks
-- whether any diploma has in fact been issued under the 180 figure and RAISES
-- A NOTICE if one has, rather than quietly correcting it.
--
-- A credential that has been issued is a document the University has put its
-- seal on and a graduate may already have submitted to an employer or a
-- registrar. Changing the credit it states is a decision for the Senate — it
-- may require reissue, a corrigendum, or nothing at all if the certificate does
-- not print a credit total. A migration must not make that call at 3am on
-- somebody's staging box. So it reports and stops.
-- ===========================================================================

-- 1 ------------------------------------------------------------------------
-- Every diploma award requires 120 credits.
--
-- Matched on `kind`, not on the code 'DTH'. The ruling is about the LEVEL, and
-- a diploma award added next year must not need this migration written again.

update awards
   set credits_required = 120
 where kind = 'diploma'
   and credits_required <> 120;

-- 2 ------------------------------------------------------------------------
-- The bachelor's is 180. Asserted rather than assumed: the ruling names both
-- halves — "180 is degree" — and a bachelor's award seeded at some other value
-- would be just as wrong in the other direction, and just as invisible.

update awards
   set credits_required = 180
 where kind = 'bachelors'
   and credits_required <> 180;

-- 3 ------------------------------------------------------------------------
-- Has anything already been conferred under the old figure?
--
-- A notice, not an exception. This must not block the migration: the ruling
-- should take effect either way, and a university with issued diplomas needs
-- the new figure in place before it can decide what to do about them.

do $$
declare
  n integer;
begin
  if to_regclass('public.credentials_issued') is null then
    raise notice 'No credential register in this database; nothing to check.';
    return;
  end if;

  -- MATCHED ON credentials_issued.kind, NOT ON A JOIN TO awards.
  --
  -- The register does not carry an award_id. It carries `kind` — one of
  -- certificate, transcript, diploma, admission-letter, student-card,
  -- completion-letter — and `award` as free text. That is deliberate in 004: a
  -- credential is a snapshot of what was conferred on the day, and a foreign
  -- key would let a later edit to the awards table change what a sealed
  -- document says it was. So the check reads the register's own word.
  select count(*) into n
    from credentials_issued
   where kind = 'diploma'
     and status <> 'revoked';

  if n > 0 then
    raise notice
      'ATTENTION: % diploma credential(s) were issued before this ruling. The '
      'award now requires 120 credits. Whether those documents need reissue, a '
      'corrigendum, or nothing at all is a decision for the Senate — this '
      'migration has deliberately not touched them.', n;
  else
    raise notice 'No diploma credential has been issued; the ruling is not retrospective.';
  end if;
end $$;

-- 4 ------------------------------------------------------------------------
-- Proof that the ruling landed.

do $$
declare
  bad integer;
begin
  select count(*) into bad
    from awards
   where (kind = 'diploma'   and credits_required <> 120)
      or (kind = 'bachelors' and credits_required <> 180);
  if bad > 0 then
    raise exception '% award(s) still disagree with the credit ruling', bad;
  end if;
end $$;
