-- ===========================================================================
-- 058 — THE VICE-CHANCELLOR APPROVES A CURRICULUM
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- CURRICULUM APPROVAL BECOMES POSSIBLE. Since 057 no curriculum could be
-- approved by anybody, including the Superadministrator, because
-- `academic_approval_requirements` was empty and the system refuses to record
-- a curriculum as approved by nobody. This names the office: the
-- Vice-Chancellor.
--
-- The University's ruling, in full: "the VC approves a corriculum."
--
-- ---------------------------------------------------------------------------
-- ONE OFFICE, AND SAY SO PLAINLY
-- ---------------------------------------------------------------------------
--
-- The chain the University drew earlier was
--
--     Draft → Department Review → Faculty Review → Academic Board Approval
--
-- and it named the Vice-Chancellor when asked who approves. So this seeds ONE
-- required office rather than three. The Head of Department and the Dean are
-- not omitted by accident and they are not out of the picture — the version
-- still moves through `department_review` and `faculty_review`, which is where
-- their scrutiny sits. What this table holds is narrower: the signature that
-- GATES the move to approved.
--
-- IF THE UNIVERSITY MEANT THEIR SIGNATURES TO GATE IT TOO, it is one statement
-- and the chain tightens immediately, with no code change anywhere:
--
--     insert into academic_approval_requirements (subject, office) values
--       ('curriculum', 'hod'), ('curriculum', 'dean')
--     on conflict do nothing;
--
-- That is the whole point of 057 holding the quorum as data. Adding an office
-- is an INSERT, not a migration and not a deployment.
--
-- ---------------------------------------------------------------------------
-- AND IT IS STILL NOT SOLE AUTHORITY
-- ---------------------------------------------------------------------------
--
-- 055 lets the Vice-Chancellor draft an appointment letter and approve it
-- alone, marked permanently, because the appointing authority IS theirs.
--
-- This is a different thing wearing a similar shape, and the difference
-- matters. The Vice-Chancellor approving a curriculum is an office signing a
-- register that records the signature, the date and the version signed. Nobody
-- can later say a curriculum was approved without saying who approved it and
-- when — and 057 refuses to let that signature be edited or deleted
-- afterwards.
--
-- `made_on_sole_authority` belongs to appointments and does not appear here.
-- ===========================================================================

insert into academic_approval_requirements (subject, office, note)
values ('curriculum', 'vice-chancellor',
        'The University''s ruling: the Vice-Chancellor approves a curriculum. A version moves '
        'through department and faculty review before reaching this signature; this is the '
        'signature that gates approval.')
on conflict (subject, office) do nothing;


-- ===========================================================================
-- PROVE IT
-- ===========================================================================

do $$
declare
  vc      uuid;
  officer uuid;
  sch     uuid;
  dept    uuid;
  prog    uuid;
  ver     uuid;
  refused boolean;
  msg     text;
begin
  begin
    vc      := gen_random_uuid();
    officer := gen_random_uuid();
    insert into auth.users (id, email) values
      (vc, '058-vc@example.test'), (officer, '058-officer@example.test');

    insert into schools (code, name) values ('proof-058', 'A Proof School of Study')
      returning id into sch;
    insert into departments (name, code, faculty, school_id)
      values ('A Proof Department', 'P58', 'A Proof School of Study', sch) returning id into dept;
    insert into programmes (code, award_level) values ('PROOF-058', 'Doctorate')
      returning id into prog;

    -- A DOCTORATE IS TWO YEARS. The University's ruling, and the first row in
    -- this system to record it as a number rather than as a sentence on a
    -- marketing page.
    insert into programme_versions
      (programme_id, version_label, name, school_id, department_id,
       duration_years, semesters_per_year, total_credits, effective_from, drafted_by)
    values (prog, '2026', 'A Proof Doctor of Study', sch, dept,
            2, 2, null, current_date, officer)
    returning id into ver;

    -- ---- WITHOUT THE VICE-CHANCELLOR, NO ----------------------------------
    refused := false;
    begin
      update programme_versions set status = 'approved' where id = ver;
    exception when others then refused := true; msg := sqlerrm;
    end;
    if not refused then
      raise exception '058 FAILED: a curriculum was approved without the Vice-Chancellor';
    end if;
    if position('vice-chancellor' in msg) = 0 then
      raise exception '058 FAILED: the refusal does not name the Vice-Chancellor: %', msg;
    end if;

    -- AND ANOTHER OFFICE'S SIGNATURE IS NOT A SUBSTITUTE. This is the check
    -- that matters: a registrar signing in good faith must not satisfy a
    -- requirement the University placed on the Vice-Chancellor.
    insert into academic_approvals (subject, subject_id, office, decision, decided_by)
      values ('curriculum', ver, 'registrar', 'approved', officer);

    refused := false;
    begin
      update programme_versions set status = 'approved' where id = ver;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '058 FAILED: another office stood in for the Vice-Chancellor';
    end if;

    -- ---- WITH IT, YES -----------------------------------------------------
    insert into academic_approvals (subject, subject_id, office, decision, decided_by)
      values ('curriculum', ver, 'vice-chancellor', 'approved', vc);

    update programme_versions set status = 'approved', approved_at = now() where id = ver;

    if not exists (select 1 from programme_versions where id = ver and status = 'approved') then
      raise exception '058 FAILED: the Vice-Chancellor approved it and it was still refused';
    end if;

    -- AND THE RECORD SAYS WHO. An approval nobody can attribute is the thing
    -- this whole chain exists to prevent.
    if not exists (select 1 from academic_approvals
                    where subject = 'curriculum' and subject_id = ver
                      and office = 'vice-chancellor' and decided_by = vc) then
      raise exception '058 FAILED: the approval does not record who gave it';
    end if;

    -- ---- AND IT CANNOT BE TAKEN BACK QUIETLY ------------------------------
    refused := false;
    begin
      delete from academic_approvals
       where subject_id = ver and office = 'vice-chancellor';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '058 FAILED: the Vice-Chancellor''s signature was deleted';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '058 OK: a curriculum cannot be approved without the Vice-Chancellor, and no '
               'other office stands in for that signature';
  raise notice '058 OK: with it the version approves, the record names who signed and when, '
               'and the signature cannot be deleted afterwards';
end $$;


-- ===========================================================================
-- VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHO MUST SIGN AN ACADEMIC CHANGE. One row: curriculum, vice-chancellor.
--
-- Add the Head of Department and the Dean here if their scrutiny is meant to
-- GATE approval rather than precede it. No deployment is needed — 057 holds
-- this as data precisely so the University can tighten its own chain.
-- ---------------------------------------------------------------------------
select subject, office, note
  from academic_approval_requirements
 order by subject, office;
