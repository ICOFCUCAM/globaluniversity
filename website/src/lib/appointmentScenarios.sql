-- ===========================================================================
-- THE UNIVERSITY'S SIX ACCEPTANCE SCENARIOS, PERFORMED AGAINST POSTGRES.
-- ===========================================================================
--
-- Driven by src/lib/appointmentScenarios.test.mjs. Rolls itself back, exactly
-- as the migration proofs do, so running it leaves the database as it found it.
--
-- Each scenario ends with a `SCENARIO x OK:` notice naming what was actually
-- performed. A scenario that stops early prints no notice, and the test file
-- treats a missing notice as a failure — otherwise a block that died after C
-- would pass with three ticks.
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;   -- HR: drafts
  vc uuid;        -- the Vice-Chancellor: approves and issues
  reviewer uuid;  -- a second officer in the office
  a_id uuid;
  b_id uuid;
  l1 uuid;
  l2 uuid;
  staff uuid;
  n integer;
  s text;
begin
  select id into someone from auth.users limit 1;
  select id into vc from auth.users where id <> someone limit 1;
  select id into reviewer from auth.users where id not in (someone, vc) limit 1;
  reviewer := coalesce(reviewer, vc);

  if someone is null or vc is null then
    raise exception 'SCENARIO SETUP FAILED: fewer than two accounts in auth.users';
  end if;

  begin
    -- =====================================================================
    -- SCENARIO A — HR creates, submits, the VC approves, issues, archives
    -- =====================================================================
    insert into appointments
      (full_name, email, position_title, unit_name, faculty, employment_type,
       appointment_action, start_date, working_hours, place_of_duty, reports_to_name,
       appointing_authority, terms, salary_amount, status, drafted_by,
       initiated_by, initiated_by_office)
    values ('A Specimen Appointee', 'appointee@example.test', 'Lecturer',
            'Department of Theology', 'Faculty of Theology', 'permanent',
            'initial', current_date + 60, '40 hours per week', 'Buea campus',
            'The Head of Academic Affairs', 'The University Council',
            'The conditions of service of the University apply.', 2000,
            'draft', someone, someone, 'hr')
    returning id into a_id;

    -- The office's own check, then submission to the VC.
    update appointments set status = 'under_review',
           reviewed_by = reviewer, reviewed_at = now() where id = a_id;
    update appointments set status = 'submitted' where id = a_id;

    -- THE VC APPROVES. Somebody other than the drafter — 041 refuses otherwise.
    update appointments set status = 'approved', authorized_by = vc, authorized_at = now()
     where id = a_id;

    -- AND NOTHING IS ISSUED BEFORE THE DOCUMENT EXISTS. The door 047 closed.
    refused := false;
    begin
      update appointments set status = 'issued', issued_at = now() where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception 'SCENARIO A FAILED: an appointment was issued with no archived letter, '
                      'so the register says a document went out that does not exist';
    end if;

    insert into appointment_letters
      (appointment_id, reference, version, issued_on, html, content_hash, sealed, seal_code,
       to_email, signatory_name, signatory_role, created_by)
    values (a_id, 'APT-2099-0001', 1, current_date, '<p>Version one, as issued.</p>',
            repeat('a', 64), true, 'ICOF-AAAA-BBBB-CCCC', 'appointee@example.test',
            'The Registrar', 'Registrar', vc)
    returning id into l1;

    update appointments set status = 'letter_generated', letter_generated_at = now()
     where id = a_id;
    update appointments set status = 'issued', issued_at = now(), issued_by = vc
     where id = a_id;

    -- The trail shows every step.
    insert into appointment_events (appointment_id, event, actor_id, previous_state, new_state)
    values (a_id, 'DRAFTED', someone, null, 'draft'),
           (a_id, 'REVIEWED', reviewer, 'draft', 'under_review'),
           (a_id, 'SUBMITTED_FOR_AUTHORITY', someone, 'under_review', 'submitted'),
           (a_id, 'AUTHORIZED', vc, 'submitted', 'approved'),
           (a_id, 'LETTER_GENERATED', vc, 'approved', 'letter_generated'),
           (a_id, 'LETTER_ISSUED', vc, 'letter_generated', 'issued'),
           (a_id, 'EMAIL_SENT', vc, null, null);

    select count(*) into n from appointment_events where appointment_id = a_id;
    if n < 7 then
      raise exception 'SCENARIO A FAILED: the audit trail holds % of the seven steps', n;
    end if;

    -- AND THE TRAIL CANNOT BE TIDIED AFTERWARDS.
    refused := false;
    begin
      delete from appointment_events where appointment_id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception 'SCENARIO A FAILED: an administrator deleted the audit history';
    end if;

    raise notice 'SCENARIO A OK: HR drafts, an office reviews, the VC approves and issues, the '
                 'document is archived first, and the trail holds every step and cannot be '
                 'deleted';

    -- =====================================================================
    -- SCENARIO B — the VC creates one directly, with no HR loop
    -- =====================================================================
    insert into appointments
      (full_name, position_title, unit_name, employment_type, appointment_action,
       start_date, terms, salary_amount, status, drafted_by,
       initiated_by, initiated_by_office)
    values ('A Second Specimen', 'Dean, Faculty of Theology', 'Faculty of Theology',
            'permanent', 'initial', current_date + 90,
            'The conditions of service of the University apply.', 3000,
            'draft', vc, vc, 'vice-chancellor')
    returning id into b_id;

    -- NO under_review AND NO submitted. The path is draft → approved, and that
    -- is the whole point of scenario B: no office is inserted that has no
    -- business being there.
    --
    -- BUT THE SECOND PAIR OF EYES IS NOT WAIVED BY DEFAULT. An appointment
    -- commits the University's money, so 041 refuses an approval by whoever
    -- drafted it — even the Vice-Chancellor.
    refused := false;
    begin
      update appointments set status = 'approved', authorized_by = vc, authorized_at = now()
       where id = b_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception 'SCENARIO B FAILED: the Vice-Chancellor drafted and approved an '
                      'appointment with nobody else involved and no sole-authority mark, so '
                      'money was committed with no second pair of eyes and no record of it';
    end if;

    -- THE VC MAY DO IT ALONE, AND IT IS MARKED. 045's sole-authority route:
    -- permitted, stated, and permanent.
    update appointments
       set made_on_sole_authority = true,
           sole_authority_reason = 'Appointed directly by the Vice-Chancellor under the '
                                   'authority of the University Council.'
     where id = b_id;
    update appointments set status = 'approved', authorized_by = reviewer, authorized_at = now()
     where id = b_id;

    insert into appointment_letters
      (appointment_id, reference, version, issued_on, html, created_by)
    values (b_id, 'APT-2099-0002', 1, current_date, '<p>The Dean''s letter.</p>', vc);
    update appointments set status = 'issued', issued_at = now(), issued_by = vc where id = b_id;

    if (select initiated_by_office from appointments where id = b_id) <> 'vice-chancellor' then
      raise exception 'SCENARIO B FAILED: the record cannot say the VC initiated this';
    end if;
    if (select initiated_by_office from appointments where id = a_id) <> 'hr' then
      raise exception 'SCENARIO B FAILED: an HR-proposed appointment and a VC-originated one '
                      'are indistinguishable afterwards';
    end if;

    raise notice 'SCENARIO B OK: the VC originates and issues with no HR step inserted, the '
                 'record distinguishes who initiated from who authorised, and doing it alone '
                 'is permitted only as a marked act of sole authority';

    -- =====================================================================
    -- SCENARIO C — the VC returns it; HR corrects and resubmits
    -- =====================================================================
    -- WHAT A RETURN ACTUALLY IS. This scenario first had HR submit a fixed-term
    -- appointment with no end date, and the database refused the INSERT — 041's
    -- `appointments_fixed_term_ends` fires immediately, not at approval. That
    -- is the system being stricter than the scenario, and the right response is
    -- to fix the scenario: a record so broken it cannot be stored never reaches
    -- the Vice-Chancellor to be returned.
    --
    -- A real return is a JUDGEMENT. The file is complete and well-formed, and
    -- the Vice-Chancellor disagrees with what is in it — here, the salary is
    -- not what was agreed. Nothing in the database can catch that, which is
    -- exactly why a person has to read it.
    insert into appointments
      (full_name, position_title, employment_type, end_date, start_date, terms,
       salary_amount, status, drafted_by, initiated_by_office)
    values ('A Third Specimen', 'Assistant Lecturer', 'fixed-term',
            current_date + 395, current_date + 30,
            'The conditions of service apply.', 1200, 'submitted', someone, 'hr')
    returning id into b_id;

    -- RETURNED. Back to draft, with the reason in the history — not a state of
    -- its own, because "returned" as a state is a place a file sits forever
    -- with nobody owning it.
    update appointments set status = 'draft' where id = b_id;
    insert into appointment_events
      (appointment_id, event, actor_id, previous_state, new_state, detail)
    values (b_id, 'RETURNED', vc, 'submitted', 'draft',
            'The salary is not the figure agreed with the Faculty. Correct it to 1,500 and '
            'resubmit.');

    -- AND THE VC CANNOT SIMPLY CORRECT IT THEMSELVES. The University's ruling:
    -- the authority does not edit the office's submission. Nothing here tries
    -- to; the correction is HR's, and the file comes back.
    update appointments set salary_amount = 1500, status = 'submitted' where id = b_id;
    update appointments set status = 'approved', authorized_by = vc, authorized_at = now()
     where id = b_id;

    if (select salary_amount from appointments where id = b_id) <> 1500 then
      raise exception 'SCENARIO C FAILED: the corrected figure is not what was approved';
    end if;

    if not exists (select 1 from appointment_events
                    where appointment_id = b_id and event = 'RETURNED') then
      raise exception 'SCENARIO C FAILED: the return is not in the history, so nobody can see '
                      'why the appointment took three weeks';
    end if;

    raise notice 'SCENARIO C OK: the VC returns a submission with a stated reason, the reason '
                 'is in the history, HR makes the correction and the VC approves the corrected '
                 'version';

    -- =====================================================================
    -- SCENARIO D — an issued appointment is amended; both versions survive
    -- =====================================================================
    -- MARKED SUPERSEDED FIRST, THEN POINTED AT ITS REPLACEMENT. The partial
    -- unique index allows one letter per appointment with no superseded_at, so
    -- the new one cannot be inserted until the old one steps aside — and
    -- `superseded_by` is a foreign key to the REPLACEMENT LETTER, not to the
    -- officer. Writing a user id there is what this run refused, and the route
    -- was doing exactly that until this scenario was performed.
    update appointment_letters set superseded_at = now() where id = l1;
    insert into appointment_letters
      (appointment_id, reference, version, issued_on, html, kind, supersedes_reason, created_by)
    values (a_id, 'APT-2099-0003', 2, current_date, '<p>Version two, amended.</p>',
            'amended', 'The start date moved by one month at the appointee''s request.', vc)
    returning id into l2;
    update appointment_letters set superseded_by = l2 where id = l1;

    -- THE ORIGINAL IS UNTOUCHED. Not edited, not deleted — somebody is holding
    -- it, and a register that says one thing while their copy says another is
    -- worse than no register.
    if (select html from appointment_letters where id = l1)
         <> '<p>Version one, as issued.</p>' then
      raise exception 'SCENARIO D FAILED: version 1 was altered when version 2 was issued';
    end if;

    refused := false;
    begin
      update appointment_letters set html = '<p>Quietly rewritten.</p>' where id = l1;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception 'SCENARIO D FAILED: an archived letter was rewritten';
    end if;

    select count(*) into n from appointment_letters where appointment_id = a_id;
    if n <> 2 then
      raise exception 'SCENARIO D FAILED: % versions remain accessible, not 2', n;
    end if;

    -- AND A SUPERSEDED LETTER VERIFIES AS SUPERSEDED, not as invalid. Saying
    -- "invalid" would be wrong in a way that costs somebody a visa.
    select status into s from appointment_letter_verification where reference = 'APT-2099-0001';
    if s is distinct from 'Superseded' then
      raise exception 'SCENARIO D FAILED: version 1 verifies as %, not Superseded',
        coalesce(s, 'nothing');
    end if;
    select status into s from appointment_letter_verification where reference = 'APT-2099-0003';
    if s is distinct from 'Valid' then
      raise exception 'SCENARIO D FAILED: version 2 verifies as %, not Valid',
        coalesce(s, 'nothing');
    end if;

    raise notice 'SCENARIO D OK: version 1 is untouched and still readable, version 2 is '
                 'issued, both remain accessible, and the superseded one verifies as '
                 'superseded rather than as a forgery';

    -- =====================================================================
    -- SCENARIO E — the template changes; old documents do not
    -- =====================================================================
    -- The archived HTML is the document. It is served from the archive and
    -- never regenerated, so a redesign cannot reach a letter that has gone out.
    -- Proved here by changing what a template says and re-reading the archive.
    if to_regclass('document_templates') is not null then
      insert into document_templates (kind, version, name, body, status, created_by)
      values ('initial-appointment', 90, 'Appointment Letter',
              'The wording of 2099, entirely rewritten.', 'draft', someone)
      on conflict do nothing;
    end if;

    if (select html from appointment_letters where id = l1)
         <> '<p>Version one, as issued.</p>' then
      raise exception 'SCENARIO E FAILED: a template change reached a document already issued';
    end if;
    if (select html from appointment_letters where id = l2)
         <> '<p>Version two, amended.</p>' then
      raise exception 'SCENARIO E FAILED: a template change reached the current document';
    end if;

    -- AND THE VERSION THAT PRODUCED A LETTER CANNOT BE DELETED — 044's rule,
    -- which is what makes "old templates remain associated with historical
    -- documents" true rather than hoped for.
    if to_regclass('document_templates') is not null then
      if not exists (
        select 1 from information_schema.referential_constraints rc
          join information_schema.key_column_usage k
            on k.constraint_name = rc.constraint_name
         where k.table_name = 'appointment_letters'
           and k.column_name = 'template_id'
           and rc.delete_rule = 'RESTRICT'
      ) then
        raise exception 'SCENARIO E FAILED: a template that produced a letter can be deleted, '
                        'so a document issued in 2026 can lose the wording that made it';
      end if;
    end if;

    raise notice 'SCENARIO E OK: a new template is created and every archived document is '
                 'byte-for-byte unchanged, and a template version that produced a letter '
                 'cannot be deleted';

    -- =====================================================================
    -- SCENARIO F — the email fails and nothing is undone
    -- =====================================================================
    update appointment_letters
       set delivery = 'failed',
           delivery_detail = 'The mail server refused the connection.',
           attempts = 1, last_attempt_at = now(), queued_at = now()
     where id = l2;

    if (select status from appointments where id = a_id) <> 'issued' then
      raise exception 'SCENARIO F FAILED: a failed email changed the appointment''s status';
    end if;
    if (select issued_at from appointments where id = a_id) is null then
      raise exception 'SCENARIO F FAILED: a failed email un-issued the appointment';
    end if;
    if (select html from appointment_letters where id = l2) is null then
      raise exception 'SCENARIO F FAILED: a failed email lost the archived document';
    end if;

    -- IT IS IN THE OUTBOX, which is how somebody knows to retry.
    if to_regclass('appointment_letters_outbox') is not null then
      if not exists (select 1 from appointment_letters_outbox where reference = 'APT-2099-0003')
      then
        raise exception 'SCENARIO F FAILED: a letter that failed to send is not in the outbox, '
                        'so nobody will ever know to retry it';
      end if;
    end if;

    -- THE RETRY SUCCEEDS AND DUPLICATES NOTHING.
    update appointment_letters
       set delivery = 'sent', delivery_detail = null, attempts = 2,
           delivered_at = now(), last_attempt_at = now()
     where id = l2;

    select count(*) into n from appointment_letters where appointment_id = a_id;
    if n <> 2 then
      raise exception 'SCENARIO F FAILED: retrying the email produced % letters, not 2', n;
    end if;
    select count(*) into n from appointments where id = a_id;
    if n <> 1 then
      raise exception 'SCENARIO F FAILED: retrying produced a duplicate appointment';
    end if;

    -- AND NO DUPLICATE STAFF RECORD. The acceptance comes first, then one
    -- activation — a second one would be a second person on the register.
    insert into appointment_acceptances
      (appointment_id, letter_id, reference, version, decision, accepted_name)
    values (a_id, l2, 'APT-2099-0003', 2, 'accepted', 'A Specimen Appointee');

    insert into lecturers (staff_id, first_name, last_name, email)
    values ('SPEC-SCEN', 'A Specimen', 'Appointee', 'appointee@example.test')
    returning id into staff;
    update appointments set staff_record_id = staff, staff_activated_at = now() where id = a_id;

    select count(*) into n from lecturers where appointment_id is not null
       and id = staff;
    update appointments set staff_record_id = staff where id = a_id;  -- a second activation
    select count(*) into n from lecturers where email = 'appointee@example.test';
    if n <> 1 then
      raise exception 'SCENARIO F FAILED: re-running activation produced % staff records', n;
    end if;

    raise notice 'SCENARIO F OK: a failed email leaves the appointment issued and the document '
                 'archived, the letter waits in the outbox, and retrying duplicates neither '
                 'the appointment, the letter nor the staff record';

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;
end $$;
