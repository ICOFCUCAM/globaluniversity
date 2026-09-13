-- ===========================================================================
-- 051 — A TEMPLATE REGISTRY FOR EVERY DOCUMENT THE UNIVERSITY ISSUES
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. OFFICIAL CORRESPONDENCE GETS VERSIONED TEMPLATES, and every issued letter
--    records which version produced it. 044 built the registry for eleven HR
--    documents and gave `appointment_letters` a `template_id` with
--    ON DELETE RESTRICT — the rule that keeps the wording of 2026 attached to a
--    letter issued in 2026. Correspondence had neither. The Vice-Chancellor's
--    letters to ministries were the one document family with no answer to
--    "which wording was in force when we sent this".
--
-- 2. THE OTHER THREE DOCUMENTS OF AN APPOINTMENT PACKAGE become templates too:
--    the Job Description, the Terms and Conditions of Appointment, and the
--    Acceptance of Appointment. The University named four documents and only
--    the first had a template.
--
-- 3. AN APPOINTMENT RECORDS WHICH CONDITIONS OF SERVICE APPLY TO IT. Until now
--    the letter said "the conditions of service in force from time to time",
--    which is true and unusable: an appointee in a dispute needs the version
--    that was in force when they signed, and nothing recorded it.
--
-- 4. A TEMPLATE SAYS WHEN IT TAKES EFFECT. `effective_from`, which the
--    University asked for and 044 did not carry.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- CORRESPONDENCE TEMPLATE KINDS ARE PREFIXED `letter-`, AND THEY HAD TO BE.
-- Three names appear in both vocabularies — 'reappointment', 'promotion' and
-- 'appointment' are HR document types AND kinds of official correspondence.
-- Merged without a prefix, a template written for the Vice-Chancellor's
-- promotion LETTER would be picked up as the template for an HR promotion
-- PACKAGE, and nobody would notice until somebody read the document that came
-- out. Two vocabularies that share three words are not one vocabulary.
-- ===========================================================================


-- ===========================================================================
-- 1. THE KINDS
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'document_templates'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%initial-appointment%'
   limit 1;

  if con is not null then
    execute format('alter table document_templates drop constraint %I', con);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'document_templates_kind_known') then
    alter table document_templates add constraint document_templates_kind_known
      check (kind in (
        -- The eleven HR documents, unchanged. 044's rows keep their kind.
        'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
        'transfer', 'acting-appointment', 'probation-confirmation',
        'contract-extension', 'appointment-amendment', 'termination', 'retirement',

        -- The other three documents of an appointment package. The University
        -- named four and only the letter had a template.
        'job-description', 'terms-and-conditions', 'acceptance-form',

        -- Official correspondence, PREFIXED. Three of these names —
        -- reappointment, promotion, appointment — already mean something else
        -- above, and a template written for one would have been served for the
        -- other.
        'letter-general', 'letter-appointment', 'letter-reappointment',
        'letter-promotion', 'letter-invitation', 'letter-commendation',
        'letter-recommendation', 'letter-government', 'letter-university',
        'letter-partnership', 'letter-directive', 'letter-warning',
        'letter-authorization', 'letter-official-response',
        'letter-special-assignment', 'letter-special', 'letter-other'));
  end if;
end $$;


-- ===========================================================================
-- 2. WHEN A TEMPLATE TAKES EFFECT
-- ===========================================================================

alter table document_templates
  add column if not exists effective_from date;

do $$
begin
  -- AN ACTIVE TEMPLATE HAS A DATE IT CAME INTO FORCE. Not a formality: "which
  -- wording applied in March" is the question a dispute opens with, and a
  -- registry that can only answer "the one that is active now" cannot answer it.
  --
  -- NOT VALID, because 044's existing rows predate the column and refusing to
  -- run over them would leave the whole migration unapplied.
  if not exists (select 1 from pg_constraint where conname = 'document_templates_active_has_a_date') then
    alter table document_templates add constraint document_templates_active_has_a_date
      check (status <> 'active' or effective_from is not null) not valid;
  end if;
end $$;

-- Existing active templates take effect from the day they were activated,
-- which is the only honest answer available for a row written before the
-- column existed.
update document_templates
   set effective_from = coalesce(effective_from, activated_at::date, created_at::date)
 where status = 'active' and effective_from is null;


-- ===========================================================================
-- 3. CORRESPONDENCE RECORDS THE WORDING THAT MADE IT
-- ===========================================================================
--
-- THE DOROTHY RULE, EXTENDED. `on delete restrict` means a template version
-- that has produced a letter can never be deleted — so a document issued in
-- 2026 keeps the wording of 2026 even after the template has been redesigned
-- twice. 044 applied it to appointment letters. This applies it to the
-- Vice-Chancellor's.

alter table correspondence_letters
  add column if not exists template_id uuid references document_templates (id) on delete restrict,
  add column if not exists template_version integer;

create index if not exists correspondence_letters_template_idx
  on correspondence_letters (template_id) where template_id is not null;


-- ===========================================================================
-- 4. WHICH CONDITIONS OF SERVICE APPLY TO THIS APPOINTMENT
-- ===========================================================================
--
-- "The conditions of service in force from time to time" is what the letter
-- said, and it is true and unusable. An appointee in a dispute needs the
-- version that was in force when they accepted, and nothing recorded it.
--
-- Restricted on delete for the same reason as the letter template: the
-- conditions somebody was appointed under cannot be deleted out from under
-- them.

alter table appointments
  add column if not exists terms_template_id uuid references document_templates (id)
    on delete restrict,
  add column if not exists job_description_template_id uuid references document_templates (id)
    on delete restrict;

comment on column appointments.terms_template_id is
  'The version of the Terms and Conditions of Appointment that applies to this appointment. '
  'Fixed at issue and never updated afterwards: an appointee is bound by the conditions in '
  'force when they accepted, not by whatever the University writes next.';


-- ===========================================================================
-- 5. WHAT IS AND IS NOT COVERED
-- ===========================================================================
--
-- The screen the University asked for needs to show which document types have
-- an active template and which do not. Computing that in the application would
-- mean the screen and the generator disagreeing about what "covered" means.

create or replace view document_template_coverage
with (security_invoker = true) as
  select k.kind,
         t.id            as active_template_id,
         t.name,
         t.version,
         t.effective_from,
         t.activated_at,
         t.created_by,
         t.activated_by,
         (select count(*) from document_templates d where d.kind = k.kind) as versions,
         -- LETTERS ALREADY ISSUED UNDER THIS KIND. The number that decides
         -- whether a template can be retired quietly or whether somebody is
         -- holding a document made from it.
         (select count(*) from appointment_letters l
           join document_templates d on d.id = l.template_id
          where d.kind = k.kind) as appointment_letters_issued,
         (select count(*) from correspondence_letters c
           join document_templates d on d.id = c.template_id
          where d.kind = k.kind) as correspondence_issued
    from (select unnest(array[
            'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
            'transfer', 'acting-appointment', 'probation-confirmation',
            'contract-extension', 'appointment-amendment', 'termination', 'retirement',
            'job-description', 'terms-and-conditions', 'acceptance-form',
            'letter-general', 'letter-appointment', 'letter-reappointment',
            'letter-promotion', 'letter-invitation', 'letter-commendation',
            'letter-recommendation', 'letter-government', 'letter-university',
            'letter-partnership', 'letter-directive', 'letter-warning',
            'letter-authorization', 'letter-official-response',
            'letter-special-assignment', 'letter-special', 'letter-other']) as kind) k
    left join document_templates t on t.kind = k.kind and t.status = 'active';


-- ===========================================================================
-- 6. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  other uuid;
  t_id uuid;
  c_id uuid;
  a_id uuid;
  n integer;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '051: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    -- ---- THE NEW KINDS ARE REGISTRABLE ------------------------------------
    -- VERSION 9001, NOT 1, and for the reason 044's proof now carries too: 052
    -- seeds a version 1 of every kind, so a proof claiming version 1 collides
    -- with the University's own first draft on a re-run.
    insert into document_templates (kind, version, name, body, status, created_by)
    values ('terms-and-conditions', 9001, 'Conditions of Service',
            'The conditions of service of the University, as approved by the Council.',
            'draft', someone)
    returning id into t_id;

    insert into document_templates (kind, version, name, body, status, created_by)
    values ('letter-government', 9001, 'Government Correspondence',
            'The standard form of a letter to a government ministry.', 'draft', someone);

    -- ---- AND A KIND NOBODY DECLARED IS REFUSED ----------------------------
    refused := false;
    begin
      insert into document_templates (kind, version, name, body, status, created_by)
      values ('a-kind-we-made-up', 9001, 'Something', 'A body long enough to pass.',
              'draft', someone);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '051 FAILED: the registry accepted a document kind nobody declared';
    end if;

    -- ---- AN ACTIVE TEMPLATE STATES WHEN IT TOOK EFFECT --------------------
    alter table document_templates validate constraint document_templates_active_has_a_date;

    refused := false;
    begin
      update document_templates
         set status = 'active', activated_by = other, activated_at = now()
       where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '051 FAILED: a template came into force on no particular date, so '
                      '"which wording applied in March" cannot be answered';
    end if;

    update document_templates
       set status = 'active', activated_by = other, activated_at = now(),
           effective_from = current_date
     where id = t_id;

    -- ---- THE CONDITIONS SOMEBODY WAS APPOINTED UNDER CANNOT BE DELETED ----
    insert into appointments
      (full_name, position_title, employment_type, start_date, terms, status,
       drafted_by, terms_template_id)
    values ('A Specimen Appointee', 'Lecturer', 'permanent', current_date + 30,
            'The conditions of service apply.', 'draft', someone, t_id)
    returning id into a_id;

    refused := false;
    begin
      delete from document_templates where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '051 FAILED: the conditions of service somebody was appointed under were '
                      'deleted out from under them';
    end if;

    -- ---- AND A CORRESPONDENCE LETTER RECORDS ITS WORDING -------------------
    insert into correspondence (kind, subject, body, recipient_name, initiated_by, status,
                                authorized_by, authorized_at, issued_at)
    values ('government', 'Accreditation correspondence',
            'The University writes to the Ministry on the matter discussed.',
            'The Ministry of Higher Education', someone, 'issued', other, now(), now())
    returning id into c_id;

    insert into correspondence_letters
      (correspondence_id, reference, issued_on, html, template_id, template_version)
    values (c_id, 'VC-2099-0051', current_date, '<p>The letter.</p>', t_id, 9001);

    refused := false;
    begin
      delete from document_templates where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '051 FAILED: a template that produced a letter to a ministry was deleted, '
                      'so the University cannot say what wording it sent';
    end if;

    -- ---- THE COVERAGE VIEW SEES WHAT IS MISSING ---------------------------
    select count(*) into n from document_template_coverage where active_template_id is null;
    if n = 0 then
      raise exception '051 FAILED: the coverage view reports every document type as covered, '
                      'which on a fresh database cannot be true';
    end if;
    if not exists (select 1 from document_template_coverage
                    where kind = 'terms-and-conditions' and active_template_id is not null) then
      raise exception '051 FAILED: the coverage view cannot see an active template';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '051 OK: every document the University issues has a template kind, and one '
               'nobody declared is refused';
  raise notice '051 OK: an active template states the date it came into force';
  raise notice '051 OK: the conditions of service somebody was appointed under cannot be '
               'deleted, and neither can the wording that produced a letter to a ministry';
  raise notice '051 OK: the coverage view reports which document types have no active template';
end $$;


-- ===========================================================================
-- 7. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- DOCUMENT TYPES WITH NO ACTIVE TEMPLATE. Every row here is a document the
-- University can be asked to produce and has no approved wording for. This
-- list will be long today and that is the point of showing it.
-- ---------------------------------------------------------------------------
select kind, versions
  from document_template_coverage
 where active_template_id is null
 order by kind;

-- And the ones that are covered, with the wording in force.
select kind, name, version, effective_from,
       appointment_letters_issued + correspondence_issued as documents_issued
  from document_template_coverage
 where active_template_id is not null
 order by kind;
