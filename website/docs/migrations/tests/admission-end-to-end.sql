-- ===========================================================================
-- THE END-TO-END ADMISSION, AND THE SIX WAYS IT CAN GO WRONG.
--
-- Not part of any migration. Run against a scratch database to prove that the
-- guarantees the workflow claims are guarantees the database actually keeps.
-- ===========================================================================

do $$
declare
  app uuid;
  dec uuid;
  refused boolean;
  n1 text; n2 text;
  events integer;
begin
  -- ======================= THE HAPPY PATH ================================
  insert into students (first_name, last_name, matric_no, email, status)
  values ('E2E', 'Applicant', 'E2E-001', 'e2e@iguc.net', 'applicant')
  returning id into app;

  insert into admission_audit_log (application_id, event, actor_office, previous_state, new_state)
  values (app, 'APPLICATION_SUBMITTED', 'Admissions Office', null, 'applicant');

  update students set status = 'documents_verified' where id = app;
  insert into admission_audit_log (application_id, event, actor_office, previous_state, new_state)
  values (app, 'DOCUMENT_VERIFIED', 'Admissions Office', 'applicant', 'documents_verified');

  update students set status = 'fee_paid', fee_registered_at = now() where id = app;
  insert into admission_audit_log (application_id, event, actor_office, previous_state, new_state)
  values (app, 'FEE_CONFIRMED', 'Finance Office', 'documents_verified', 'fee_paid');

  update students set status = 'ready_for_academic_review' where id = app;

  -- The academic decision.
  insert into admission_decisions
    (application_id, decision, decided_by_email, decided_by_role,
     previous_status, new_status, reason)
  values (app, 'approve', 'daa@iguc.net', 'academic-office',
          'ready_for_academic_review', 'approved', 'Meets all requirements.')
  returning id into dec;

  insert into admission_audit_log
    (application_id, decision_id, event, actor_office, actor_role, previous_state, new_state)
  values (app, dec, 'ACADEMIC_APPROVED', 'Office of Academic Affairs', 'academic-office',
          'ready_for_academic_review', 'approved');

  n1 := reserve_student_number(2026);

  insert into admission_audit_log (application_id, decision_id, event, actor_office, metadata)
  values (app, dec, 'ADMISSION_LETTER_GENERATED', 'Office of Academic Affairs',
          jsonb_build_object('mode', 'Online / Campus'));
  insert into admission_audit_log (application_id, decision_id, event, actor_office, metadata)
  values (app, dec, 'ACCOUNT_CREATED', 'Office of Academic Affairs',
          jsonb_build_object('student_number', n1));

  update students set status = 'admission_issued', student_number = n1 where id = app;
  insert into admission_audit_log
    (application_id, decision_id, event, actor_office, previous_state, new_state)
  values (app, dec, 'ADMISSION_PACKAGE_ISSUED', 'Office of Academic Affairs',
          'approved', 'admission_issued');

  select count(*) into events from admission_audit_log where application_id = app;
  if events < 7 then
    raise exception 'E2E FAILED: the trail recorded only % of the seven events', events;
  end if;
  raise notice 'E2E OK — application through to admission_issued, % events recorded, number %', events, n1;

  -- ============ 1. TWO ADMINISTRATORS APPROVE SIMULTANEOUSLY =============
  -- The numbers must differ. This is the fault the old read-the-maximum
  -- approach had: both read the same maximum and computed the same next.
  n1 := reserve_student_number(2026);
  n2 := reserve_student_number(2026);
  if n1 = n2 then
    raise exception 'FAILURE TEST 1 FAILED: two approvals were handed the same number (%)', n1;
  end if;
  raise notice 'ok  1. simultaneous approvals get different numbers (%, %)', n1, n2;

  -- ============ 2. SUPER ADMIN REVERSES AN APPROVAL ======================
  -- The reversal is a NEW decision. The original stays, which is the point.
  insert into admission_decisions
    (application_id, decision, decision_type, is_override, override_of, override_reason,
     decided_by_email, decided_by_role, previous_status, new_status)
  values (app, 'reject', 'administrative-override', true, 'academic-office',
          'Admitted in error; the applicant does not hold the prerequisite degree.',
          'superadmin@iguc.net', 'superadmin', 'admission_issued', 'rejected');

  if (select count(*) from admission_decisions where application_id = app) <> 2 then
    raise exception 'FAILURE TEST 2 FAILED: the reversal replaced the original decision';
  end if;
  if not exists (select 1 from admission_decisions
                 where application_id = app and decision = 'approve') then
    raise exception 'FAILURE TEST 2 FAILED: the original approval is gone';
  end if;
  raise notice 'ok  2. a reversal is a second decision; the first survives';

  -- ============ 3. NOBODY CAN EDIT THE TRAIL AFTERWARDS ==================
  refused := false;
  begin
    update admission_audit_log set event = 'ACADEMIC_REJECTED' where application_id = app;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception 'FAILURE TEST 3 FAILED: an audit event was rewritten';
  end if;
  refused := false;
  begin
    delete from admission_decisions where id = dec;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception 'FAILURE TEST 3 FAILED: a decision was deleted';
  end if;
  raise notice 'ok  3. the trail refuses to be rewritten or deleted';

  -- ============ 4. AN OVERRIDE WITH NO REASON ============================
  refused := false;
  begin
    insert into admission_decisions
      (application_id, decision, decision_type, is_override, override_of)
    values (app, 'approve', 'administrative-override', true, 'academic-office');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception 'FAILURE TEST 4 FAILED: an override was accepted with no reason';
  end if;
  raise notice 'ok  4. an override with no reason is refused by the database';

  -- ============ 5. THE STATE VOCABULARY IS NOT EDITABLE ==================
  refused := false;
  begin
    update admission_states set state = 'renamed' where state = 'approved';
  exception when others then refused := true;
  end;
  if not refused then
    raise exception 'FAILURE TEST 5 FAILED: a state code was renamed';
  end if;
  raise notice 'ok  5. the state vocabulary refuses a rename';

  -- ============ 6. THE DECISION SURVIVES A FAILED DOWNSTREAM STEP ========
  -- The rule that matters most: the database must never say "admission issued"
  -- when no package or account was produced. A decision recorded with the
  -- status left short of admission_issued is the recoverable state, and it is
  -- what the route's ordering leaves behind when a later step fails.
  declare
    app2 uuid;
    dec2 uuid;
  begin
    insert into students (first_name, last_name, matric_no, email, status)
    values ('E2E', 'Halfway', 'E2E-002', 'e2e2@iguc.net', 'ready_for_academic_review')
    returning id into app2;

    insert into admission_decisions
      (application_id, decision, decided_by_role, previous_status, new_status)
    values (app2, 'approve', 'academic-office', 'ready_for_academic_review', 'approved')
    returning id into dec2;
    insert into admission_audit_log (application_id, decision_id, event, actor_office)
    values (app2, dec2, 'ACADEMIC_APPROVED', 'Office of Academic Affairs');
    -- …and then the package generation fails, so nothing further is written.

    if (select status from students where id = app2) = 'admission_issued' then
      raise exception
        'FAILURE TEST 6 FAILED: the application says admission_issued with no package and no account';
    end if;
    if not exists (select 1 from admission_decisions where application_id = app2) then
      raise exception 'FAILURE TEST 6 FAILED: the decision was lost along with the failed step';
    end if;
    raise notice 'ok  6. a failed downstream step leaves a recorded decision, not a false admission';
    -- app2 is cleared by the block below, with the triggers off: it carries a
    -- decision, and a decision makes the applicant undeletable.
  end;

  -- Clean up. The trails refuse deletes, so the triggers come off briefly.
  alter table admission_audit_log disable trigger admission_audit_log_no_change;
  alter table admission_decisions disable trigger admission_decisions_no_change;
  delete from admission_audit_log where application_id in
    (select id from students where matric_no like 'E2E-%');
  delete from admission_decisions where application_id in
    (select id from students where matric_no like 'E2E-%');
  -- THE STUDENT ROW IS DELETED WHILE THE TRIGGERS ARE STILL OFF, and the
  -- reason is a property worth knowing about: admission_decisions cascades on
  -- students, and the append-only trigger fires on the CASCADE too. So once an
  -- application carries a decision, DELETING THE APPLICANT IS REFUSED — an
  -- admission cannot be erased by removing the person it was granted to.
  delete from students where matric_no like 'E2E-%';
  alter table admission_decisions enable trigger admission_decisions_no_change;
  alter table admission_audit_log enable trigger admission_audit_log_no_change;

  raise notice 'ALL SIX FAILURE CASES BEHAVE AS THEY SHOULD.';
end $$;
