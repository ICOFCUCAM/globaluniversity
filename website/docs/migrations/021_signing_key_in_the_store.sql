-- ===========================================================================
-- 021 — THE SIGNING KEY LIVES IN THE UNIVERSITY'S OWN SECRET STORE
--
-- The University asked: "can't the system keep the key?"
--
-- It can. 017 built a sealed store — AES-256-GCM, row-level security with NO
-- policy at all, so it is unreadable through the publishable key by
-- construction rather than by a rule somebody could later widen. It was built
-- for social tokens. A signing key is the same kind of thing and belongs in the
-- same place.
--
-- This migration does one thing: admits 'signing_key' to the store's list of
-- kinds. That list is closed on purpose, so a value it does not know cannot be
-- written.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES AND DOES NOT REMOVE
-- ---------------------------------------------------------------------------
--
-- IT REMOVES: pasting a multi-line PEM into a hosting dashboard, and redeploying
-- to make it take effect. The key is generated in the portal, kept by the
-- system, and used from the next request onwards.
--
-- IT DOES NOT REMOVE: the need for SECRET_STORE_KEY. Something has to encrypt
-- the store, and that something cannot itself live in the store. So this trades
-- a long multi-line secret for a short single-line one — and if SECRET_STORE_KEY
-- is already set for the social connections, it trades it for nothing at all.
--
-- Saying "the system keeps the key" without that sentence would be selling a
-- guarantee this does not provide.
--
-- ---------------------------------------------------------------------------
-- AND WHAT IT MEANS IF SECRET_STORE_KEY IS LOST
-- ---------------------------------------------------------------------------
--
-- The signing key is unrecoverable. Credentials already signed stay valid and
-- verifiable — their signatures and the public key are unaffected — but nothing
-- can ever be signed with that key again, and a new one has to be generated and
-- published. This is the same exposure the social tokens already carry, and it
-- is the price of the store encrypting anything at all.
--
-- Idempotent. Run it twice; the second run changes nothing.
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con
    from pg_constraint
   where conrelid = 'secret_store'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%kind%'
     and pg_get_constraintdef(oid) ilike '%social_tokens%'
   limit 1;

  if con is not null then
    execute format('alter table secret_store drop constraint %I', con);
  end if;

  alter table secret_store add constraint secret_store_kind_check
    check (kind in ('social_tokens', 'proctoring', 'signing_key', 'other'));
end $$;

-- ===========================================================================
-- PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  -- A well-formed sealed value: three base64url segments, as the store's own
  -- constraint requires. Not a real key — nothing here is ever a real secret.
  fake_sealed constant text := 'AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBB.CCCCCCCCCCCCCCCCCCCC';
begin
  -- ---- A signing key may now be stored --------------------------------
  begin
    insert into secret_store (ref, kind, sealed)
    values ('proof-021', 'signing_key', fake_sealed);
    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then
      raise exception '021 FAILED: a signing key could not be stored (%)', sqlerrm;
    end if;
  end;

  if exists (select 1 from secret_store where ref = 'proof-021') then
    raise exception '021 FAILED: the proof row was left in the store';
  end if;

  -- ---- …and an unknown kind still cannot be ---------------------------
  refused := false;
  begin
    insert into secret_store (ref, kind, sealed)
    values ('proof-021b', 'passwords', fake_sealed);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '021 FAILED: the store accepted a kind outside its vocabulary';
  end if;

  -- ---- AND PLAINTEXT IS STILL REFUSED ---------------------------------
  -- The rule that matters most: a value that does not look sealed is a value
  -- somebody wrote by hand, which for a signing key would be the private key
  -- itself sitting in a database column.
  refused := false;
  begin
    insert into secret_store (ref, kind, sealed)
    values ('proof-021c', 'signing_key', '-----BEGIN PRIVATE KEY-----');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '021 FAILED: an unsealed private key was accepted into the store';
  end if;

  raise notice '021 OK — a signing key may be stored, an unknown kind may not, and a private '
               'key written in plaintext is still refused.';
end $$;

-- ---------------------------------------------------------------------------
-- The store, and whether the University is holding a key in it.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from secret_store where kind = 'signing_key') then
    raise notice 'NO SIGNING KEY IS STORED. Generate one at Credentials -> Register -> Document '
                 'signing, and choose to let the system keep it. Until then, credentials carry '
                 'the University''s seal and verify through /verify exactly as before.';
  end if;
end $$;

select kind, count(*) as stored from secret_store group by kind order by kind;
