-- ===========================================================================
-- BEHAVIOURAL TEST FOR 013.
--
-- Not "does the trigger exist" — the migration already asserts that. This asks
-- the database to actually do the wrong thing five different ways and checks
-- that it refuses four of them.
--
-- Rolled back at the end. Nothing here persists.
-- ===========================================================================
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@iguc.net'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@iguc.net');

-- Alice and Bob each connect their own X account. The university has one too.
insert into social_accounts (id, scope, owner_id, platform, handle) values
  ('11111111-0000-0000-0000-000000000001', 'personal',
   'aaaaaaaa-0000-0000-0000-000000000001', 'x', '@alice'),
  ('22222222-0000-0000-0000-000000000002', 'personal',
   'bbbbbbbb-0000-0000-0000-000000000002', 'x', '@bob'),
  ('33333333-0000-0000-0000-000000000003', 'university',
   null, 'x', '@icofglobaluni');

-- Alice writes a post and opts her own accounts in.
insert into social_posts (id, author_id, body, include_personal) values
  ('44444444-0000-0000-0000-000000000004',
   'aaaaaaaa-0000-0000-0000-000000000001',
   'Congratulations to the graduating class.', true);

do $$
declare
  refused text;
begin
  -- ---------------------------------------------------------------------
  -- 1. THE ATTACK. Alice's post fans out to BOB's personal account.
  --    "An administrator should never receive the credentials or tokens of
  --    another administrator" — and never their voice either.
  -- ---------------------------------------------------------------------
  refused := null;
  begin
    insert into social_post_targets (post_id, account_id)
    values ('44444444-0000-0000-0000-000000000004',
            '22222222-0000-0000-0000-000000000002');
    raise exception 'FAIL 1: Alice posted as Bob.';
  exception when others then
    refused := sqlerrm;
  end;
  if refused is null or refused like 'FAIL%' then
    raise exception 'FAIL 1: Alice posted as Bob. %', refused;
  end if;
  raise notice 'PASS 1  posting as another administrator refused: %', refused;

  -- ---------------------------------------------------------------------
  -- 2. Alice's own account, with include_personal true. Allowed.
  -- ---------------------------------------------------------------------
  insert into social_post_targets (post_id, account_id)
  values ('44444444-0000-0000-0000-000000000004',
          '11111111-0000-0000-0000-000000000001');
  raise notice 'PASS 2  an author may post to their own connected account';

  -- ---------------------------------------------------------------------
  -- 3. The university account. Allowed, and Alice holds none of its tokens —
  --    "every admin can share their content without connecting".
  -- ---------------------------------------------------------------------
  insert into social_post_targets (post_id, account_id)
  values ('44444444-0000-0000-0000-000000000004',
          '33333333-0000-0000-0000-000000000003');
  raise notice 'PASS 3  any administrator may publish through a university account';

  -- ---------------------------------------------------------------------
  -- 4. CONSENT IS PER POST. Alice turns include_personal off; her own account
  --    must now be refused too. Linking once is not consent forever.
  -- ---------------------------------------------------------------------
  delete from social_post_targets
   where post_id = '44444444-0000-0000-0000-000000000004'
     and account_id = '11111111-0000-0000-0000-000000000001';
  update social_posts set include_personal = false
   where id = '44444444-0000-0000-0000-000000000004';

  refused := null;
  begin
    insert into social_post_targets (post_id, account_id)
    values ('44444444-0000-0000-0000-000000000004',
            '11111111-0000-0000-0000-000000000001');
    raise exception 'FAIL 4: posted to a personal account the author had opted out of.';
  exception when others then
    refused := sqlerrm;
  end;
  if refused is null or refused like 'FAIL%' then
    raise exception 'FAIL 4: %', refused;
  end if;
  raise notice 'PASS 4  opting out blocks the author''s own account: %', refused;

  -- ---------------------------------------------------------------------
  -- 5. A NON-ACADEMIC CREDENTIAL MAY NOT CLAIM TO BE A DEGREE.
  --    "nobody mistakes an institutional certificate for an accredited
  --    academic degree."
  -- ---------------------------------------------------------------------
  refused := null;
  begin
    insert into credential_types (code, name, category, is_academic)
    values ('ORD-CERT', 'Certificate of Ordination', 'ministry', true);
    raise exception 'FAIL 5: a ministry certificate registered itself as academic.';
  exception when others then
    refused := sqlerrm;
  end;
  if refused is null or refused like 'FAIL%' then
    raise exception 'FAIL 5: %', refused;
  end if;
  raise notice 'PASS 5  a non-academic category cannot be flagged academic';

  -- ---------------------------------------------------------------------
  -- 6. An expiring credential must say for how long.
  -- ---------------------------------------------------------------------
  refused := null;
  begin
    insert into credential_types (code, name, category, validity)
    values ('CPD-2Y', 'Continuing Professional Development', 'professional', 'expiring');
    raise exception 'FAIL 6: an expiring credential with no period.';
  exception when others then
    refused := sqlerrm;
  end;
  if refused is null or refused like 'FAIL%' then
    raise exception 'FAIL 6: %', refused;
  end if;
  raise notice 'PASS 6  an expiring credential must carry a period';

  -- ---------------------------------------------------------------------
  -- 7. A rejected correction request must carry a reason a student can read.
  -- ---------------------------------------------------------------------
  refused := null;
  begin
    insert into credential_correction_requests
      (credential_id, requested_by, description, status)
    values (null, 'aaaaaaaa-0000-0000-0000-000000000001', 'x', 'rejected');
    raise exception 'FAIL 7: a rejection with no reason.';
  exception when others then
    refused := sqlerrm;
  end;
  if refused is null or refused like 'FAIL%' then
    raise exception 'FAIL 7: %', refused;
  end if;
  raise notice 'PASS 7  a rejected correction must state why';

  -- ---------------------------------------------------------------------
  -- 8. THE AUDIT TRAIL REFUSES DELETE, not only UPDATE. The migration's own
  --    proof block tests UPDATE; a trail that can be deleted from is just as
  --    useless, and the trigger covers both, so prove both.
  -- ---------------------------------------------------------------------
  insert into credential_audit_events (action, reason) values ('revoked', 'consent-test');
  refused := null;
  begin
    delete from credential_audit_events where reason = 'consent-test';
    raise exception 'FAIL 8: the audit trail accepted a DELETE.';
  exception when others then
    refused := sqlerrm;
  end;
  if refused is null or refused like 'FAIL%' then
    raise exception 'FAIL 8: %', refused;
  end if;
  raise notice 'PASS 8  the audit trail refuses DELETE as well as UPDATE';

  raise notice '--- all eight behavioural checks passed ---';
end $$;

rollback;
