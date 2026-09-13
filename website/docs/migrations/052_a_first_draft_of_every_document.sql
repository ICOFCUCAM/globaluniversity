-- ===========================================================================
-- 052 — A FIRST DRAFT OF EVERY DOCUMENT THE UNIVERSITY ISSUES
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- All thirty-one document types get a version 1, in DRAFT, with wording in it.
-- The Document Templates screen stops reading "31 of 31 have no active
-- template" and starts reading like a registry with something to edit.
--
-- NOTHING IS ACTIVE. Not one of these produces a document until somebody at
-- the University reads it and activates it, and the screen shows each as a
-- draft waiting for exactly that.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THIS WORDING IS NOT THE UNIVERSITY'S POLICY. It is a starting point written
-- to be edited — the same standing this migration's author has for the job
-- descriptions 048 seeded, and for the same reason: an appointment letter, a
-- termination letter and a written warning are documents produced in a dispute,
-- and none of them should carry a sentence nobody at the University has read.
--
-- AND `created_by` IS DELIBERATELY NULL on every row. 044 refuses a template to
-- be activated by whoever wrote it; nobody at the University wrote these, so
-- any officer holding the capability may activate one. That is the second pair
-- of eyes working rather than being bypassed: the person approving the wording
-- is not the person who drafted it.
--
-- ---------------------------------------------------------------------------
-- THE PLACEHOLDERS
-- ---------------------------------------------------------------------------
--
-- `{{name}}` is filled from the record, never typed. The names below match the
-- columns on `appointments` and `correspondence` — full_name, position_title,
-- unit_name, start_date, and so on. A placeholder nothing fills prints as
-- itself, which is visible and correctable; a blank line is not.
-- ===========================================================================

do $$
declare
  seeded integer := 0;
begin
  -- =======================================================================
  -- 1. THE APPOINTMENT DOCUMENTS
  -- =======================================================================

  insert into document_templates (kind, version, name, body, status)
  select v.kind, 1, v.name, v.body, 'draft'
    from (values

  ('initial-appointment', 'Initial Appointment',
   'We are pleased to offer you appointment as {{position_title}} in the {{unit_name}} of the '
   || 'University, on the terms set out below.' || chr(10) || chr(10)
   || 'Your appointment takes effect from {{start_date}}. You will be based at '
   || '{{place_of_duty}} and will report to {{reports_to_name}}.' || chr(10) || chr(10)
   || 'This appointment is made subject to the conditions of service of the University and to '
   || 'satisfactory verification of the qualifications and references you have supplied. You '
   || 'are required to devote your full professional attention to the duties of the post and '
   || 'to observe the University''s policies on conduct, confidentiality and conflict of '
   || 'interest.' || chr(10) || chr(10)
   || 'Please confirm your acceptance in writing.'),

  ('reappointment', 'Reappointment',
   'Following the conclusion of your previous term, the University is pleased to reappoint you '
   || 'as {{position_title}} in the {{unit_name}}, with effect from {{start_date}}.'
   || chr(10) || chr(10)
   || 'The terms of your reappointment are set out below. Except where they are varied here, '
   || 'the conditions of service under which you previously held the post continue to apply, '
   || 'and your service is treated as continuous.' || chr(10) || chr(10)
   || 'Please confirm your acceptance in writing.'),

  ('contract-renewal', 'Contract Renewal',
   'The University is pleased to renew your appointment as {{position_title}} in the '
   || '{{unit_name}} for a further term, with effect from {{start_date}} and expiring on '
   || '{{end_date}}.' || chr(10) || chr(10)
   || 'The terms of the renewed appointment are set out below. Your service is continuous and '
   || 'the conditions of service in force continue to apply.' || chr(10) || chr(10)
   || 'Please confirm your acceptance in writing.'),

  ('promotion', 'Promotion',
   'Following consideration of your record of service, the University is pleased to inform you '
   || 'that you have been promoted to the post of {{position_title}} in the {{unit_name}}, '
   || 'with effect from {{effective_date}}.' || chr(10) || chr(10)
   || 'The revised terms attaching to the post are set out below. All other terms of your '
   || 'appointment are unchanged and your service is continuous.' || chr(10) || chr(10)
   || 'The University records its appreciation of your contribution and wishes you well in the '
   || 'wider responsibilities the post carries.'),

  ('transfer', 'Transfer',
   'You are hereby transferred to the post of {{position_title}} in the {{unit_name}}, with '
   || 'effect from {{effective_date}}. Your place of duty from that date is {{place_of_duty}} '
   || 'and you will report to {{reports_to_name}}.' || chr(10) || chr(10)
   || 'Your service is continuous and your conditions of service are unchanged except as set '
   || 'out below. You are asked to hand over the responsibilities of your present post before '
   || 'the effective date.'),

  ('acting-appointment', 'Acting Appointment',
   'You are appointed to act as {{position_title}} in the {{unit_name}} with effect from '
   || '{{start_date}} until {{end_date}}, or until the substantive post is filled, whichever '
   || 'is the earlier.' || chr(10) || chr(10)
   || 'While acting you carry the full responsibilities of the post and report to '
   || '{{reports_to_name}}. An acting appointment does not confer any right to the substantive '
   || 'post, and your existing appointment continues beneath it.'),

  ('probation-confirmation', 'Confirmation of Appointment',
   'Following the satisfactory completion of your probationary period, the University is '
   || 'pleased to confirm your appointment as {{position_title}} in the {{unit_name}} with '
   || 'effect from {{effective_date}}.' || chr(10) || chr(10)
   || 'Your appointment is now substantive and the notice provisions of the conditions of '
   || 'service apply in full. The University records its appreciation of your work during the '
   || 'probationary period.'),

  ('contract-extension', 'Contract Extension',
   'Your appointment as {{position_title}} in the {{unit_name}}, which was due to expire on '
   || '{{end_date}}, is extended to the date shown below.' || chr(10) || chr(10)
   || 'All other terms of your appointment are unchanged and your service is continuous. This '
   || 'extension does not alter the character of the appointment.'),

  ('appointment-amendment', 'Appointment Amendment',
   'The University writes to amend the terms of your appointment as {{position_title}} in the '
   || '{{unit_name}}, with effect from {{effective_date}}.' || chr(10) || chr(10)
   || 'The amended terms are set out below and replace the corresponding terms of the letter '
   || 'previously issued to you. THE EARLIER LETTER REMAINS ON THE UNIVERSITY''S RECORD and is '
   || 'not withdrawn; this letter states what has changed and from when.' || chr(10) || chr(10)
   || 'Please confirm your acceptance of the amended terms in writing.'),

  ('termination', 'Termination / End of Appointment',
   'The University writes concerning your appointment as {{position_title}} in the '
   || '{{unit_name}}.' || chr(10) || chr(10)
   || 'Your appointment ends on the date shown below. The reason and the notice given are '
   || 'stated there.' || chr(10) || chr(10)
   || 'You are asked to hand over University property, records and access in your possession '
   || 'to {{reports_to_name}} before that date. Outstanding salary and entitlements will be '
   || 'settled through the Finance Office.' || chr(10) || chr(10)
   || 'Your obligations of confidentiality continue after the appointment ends. The University '
   || 'thanks you for your service.'),

  ('retirement', 'Retirement',
   'The University writes concerning your retirement from the post of {{position_title}} in '
   || 'the {{unit_name}}, with effect from the date shown below.' || chr(10) || chr(10)
   || 'The Vice-Chancellor and the University Council record their appreciation of your '
   || 'service and the contribution you have made to the life of the institution.'
   || chr(10) || chr(10)
   || 'The Finance Office will write separately regarding your final settlement and any '
   || 'entitlements. You are asked to hand over University property and records before the '
   || 'effective date.'),

  -- =======================================================================
  -- 2. THE REST OF THE APPOINTMENT PACKAGE
  -- =======================================================================

  ('job-description', 'Job Description',
   'JOB DESCRIPTION — {{position_title}}' || chr(10) || chr(10)
   || 'This job description accompanies the letter of appointment and forms part of it. The '
   || 'duties set out in the job description registered for this post under code {{job_code}} '
   || 'apply, and are summarised below.' || chr(10) || chr(10)
   || 'Position: {{position_title}}' || chr(10)
   || 'Department or faculty: {{unit_name}}' || chr(10)
   || 'Reports to: {{reports_to_name}}' || chr(10)
   || 'Duty station: {{place_of_duty}}' || chr(10)
   || 'Employment category: {{employment_type}}' || chr(10) || chr(10)
   || 'THE FULL JOB DESCRIPTION IS HELD IN THE UNIVERSITY''S REGISTER OF POSTS, versioned and '
   || 'approved separately from this letter. Migration 048 holds the structure — purpose, key '
   || 'responsibilities, decision-making authority, performance areas, qualifications — and '
   || 'the wording is edited there rather than here, so that one post has one job description '
   || 'and not a copy in every letter.' || chr(10) || chr(10)
   || 'The job description may be amended by the University after consultation with the '
   || 'post-holder. The version in force at the date of appointment remains on the record.'),

  ('terms-and-conditions', 'Terms and Conditions of Appointment',
   'CONDITIONS OF SERVICE' || chr(10) || chr(10)
   || '1. GENERAL. This appointment is subject to the statutes and regulations of the '
   || 'University and to the policies in force from time to time. Where this letter and the '
   || 'conditions of service differ, this letter governs for the matters it states.'
   || chr(10) || chr(10)
   || '2. HOURS AND DUTIES. You are required to devote your full professional attention to the '
   || 'duties of the post during the hours stated in the letter of appointment, and to carry '
   || 'out such other duties as may reasonably be assigned by the officer to whom you report.'
   || chr(10) || chr(10)
   || '3. PROBATION. Where the letter states a probationary period, the appointment is '
   || 'confirmed only on its satisfactory completion. During probation one month''s notice '
   || 'applies on either side.' || chr(10) || chr(10)
   || '4. NOTICE. After confirmation, either party may end the appointment by three months'' '
   || 'notice in writing, or payment in lieu. Nothing in this clause limits the University''s '
   || 'right to end an appointment summarily for gross misconduct.' || chr(10) || chr(10)
   || '5. REMUNERATION. Salary and any allowances are as stated in the letter of appointment '
   || 'and are paid monthly in arrears, subject to lawful deductions. Allowances are payable '
   || 'only where the letter states them.' || chr(10) || chr(10)
   || '6. CONFIDENTIALITY. You shall treat student records, staff records, examination '
   || 'material and the University''s commercial and legal affairs as confidential, during the '
   || 'appointment and after it ends.' || chr(10) || chr(10)
   || '7. CONFLICT OF INTEREST. You shall disclose any outside interest or employment that '
   || 'might conflict with the duties of the post, and shall not accept such engagement '
   || 'without written approval.' || chr(10) || chr(10)
   || '8. INTELLECTUAL PROPERTY. Rights in work produced in the course of the appointment vest '
   || 'in the University except where the University agrees otherwise in writing.'
   || chr(10) || chr(10)
   || '9. CONDUCT. You shall observe the University''s policies on conduct, data protection '
   || 'and safeguarding, and shall report any breach that comes to your notice.'
   || chr(10) || chr(10)
   || '10. AMENDMENT. These conditions may be amended by the University. The version in force '
   || 'at the date you accepted your appointment is the version that binds you, and is '
   || 'recorded against the appointment.'),

  ('acceptance-form', 'Acceptance of Appointment',
   'ACCEPTANCE OF APPOINTMENT' || chr(10) || chr(10)
   || 'To: The Vice-Chancellor, ICOF Global University' || chr(10) || chr(10)
   || 'I, {{full_name}}, acknowledge receipt of the letter of appointment bearing reference '
   || '{{reference}} and dated {{issued_on}}.' || chr(10) || chr(10)
   || 'I have read the letter, the job description and the conditions of service referred to '
   || 'in it, and I ACCEPT the appointment as {{position_title}} in the {{unit_name}} on the '
   || 'terms stated, with effect from {{start_date}}.' || chr(10) || chr(10)
   || 'Signed: ____________________________     Date: ____________________'
   || chr(10) || chr(10)
   || 'This form may be returned by post or by hand. An acceptance may also be recorded '
   || 'through the University''s verification page using the reference and code printed on the '
   || 'letter, in which case the University''s record of your acceptance names the version of '
   || 'the letter you answered.'),

  -- =======================================================================
  -- 3. OFFICIAL CORRESPONDENCE
  -- =======================================================================
  --
  -- SHORTER, AND THEY HAVE TO BE. A correspondence template is a frame for
  -- words the authority writes at the time, not a form with the words already
  -- in it — the body of a letter to a ministry IS the Vice-Chancellor
  -- speaking, and a template that wrote it for them would be the system
  -- speaking instead.

  ('letter-general', 'General Correspondence',
   'Standard frame for general correspondence of the University. The body is composed by the '
   || 'originating office; the letterhead, reference, date, signature block and verification '
   || 'code are added by the system.'),

  ('letter-appointment', 'Letter — Appointment',
   'Frame for an appointment letter written directly by an office rather than generated from '
   || 'an appointment record. Where an appointment record exists, the Appointment Letter '
   || 'template is used instead and nothing is typed by hand.'),

  ('letter-reappointment', 'Letter — Reappointment',
   'Frame for a reappointment communicated by letter from an office. The terms themselves '
   || 'belong on an appointment record, which produces the document nobody types.'),

  ('letter-promotion', 'Letter — Promotion',
   'Frame for a letter conveying a promotion. Where the promotion is recorded as an '
   || 'appointment, the Promotion template produces the letter from the record instead.'),

  ('letter-invitation', 'Letter — Invitation',
   'Frame for an invitation issued by the University — to a convocation, a lecture, an '
   || 'inspection or a meeting. State clearly what is being asked of the recipient, on what '
   || 'date, and by when a reply is needed.'),

  ('letter-commendation', 'Letter — Commendation',
   'Frame for a letter of commendation. Say what was done, by whom, and why the University '
   || 'considers it worth recording. A commendation that does not name the act reads as a '
   || 'formality and is worth less to the person receiving it.'),

  ('letter-recommendation', 'Letter — Recommendation',
   'Frame for a letter of recommendation. State the capacity in which the University knows the '
   || 'subject and over what period, then the recommendation itself. A recommendation goes to '
   || 'somebody with no other knowledge of the person, so the facts it rests on belong in it.'),

  ('letter-government', 'Letter — Government Correspondence',
   'Frame for correspondence with a ministry or government authority. Read it back as a '
   || 'stranger would: the reader has no context, cannot ask a follow-up question, and may be '
   || 'filing it against the University''s standing.'),

  ('letter-university', 'Letter — University Correspondence',
   'Frame for correspondence with another university or institution — accreditation, transfer '
   || 'of credit, joint provision, or a reference. State plainly what the University is asking '
   || 'or confirming.'),

  ('letter-partnership', 'Letter — Partnership',
   'Frame for a partnership or collaboration approach. State what is proposed, what each side '
   || 'would contribute, and what the next step is. A proposal with no next step in it is one '
   || 'nobody answers.'),

  ('letter-directive', 'Letter — Directive',
   'Frame for a directive issued to a member of staff or an office. State what is required, on '
   || 'whose authority, and by when. A directive is one of the two documents most likely to be '
   || 'produced in an appeal, so it should say what happened, what is required, and nothing '
   || 'else.'),

  ('letter-warning', 'Letter — Warning',
   'Frame for a written warning. State the conduct concerned, the date it occurred, the '
   || 'standard it fell short of, what is now required, and the consequence of a repetition. '
   || 'Say whether the warning may be appealed and to whom, and over what period it remains on '
   || 'the record. This letter turns up in an appeal; write it as the document that will be '
   || 'read there.'),

  ('letter-authorization', 'Letter — Authorization',
   'Frame for a letter authorising a named person to act for the University in a stated matter. '
   || 'State precisely what is authorised, the period, and any limit on it. An authorisation '
   || 'without a limit is one the University cannot later say was exceeded.'),

  ('letter-official-response', 'Letter — Official Response',
   'Frame for the University''s formal response to correspondence received. Name what is being '
   || 'answered — its reference and date — before answering it, so the reader can file the two '
   || 'together.'),

  ('letter-special-assignment', 'Letter — Special Assignment',
   'Frame for assigning a member of staff to a task outside the ordinary duties of their post. '
   || 'State the task, the period, to whom they report for it, and what happens to their '
   || 'ordinary duties meanwhile.'),

  ('letter-special', 'Letter — Special Letter',
   'Frame for a letter that does not fall under any other kind and is issued under the '
   || 'authority of the originating office.'),

  ('letter-other', 'Letter — Other',
   'Frame for correspondence the register has no better kind for. If this is being used often, '
   || 'the University should add the kind it is really being used for rather than leaving the '
   || 'register unable to count it.')

    ) as v (kind, name, body)
   where not exists (
     select 1 from document_templates d where d.kind = v.kind
   );

  get diagnostics seeded = row_count;
  raise notice '052: % document template(s) seeded as version 1, all in draft', seeded;
end $$;


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  t_id uuid;
  n integer;
begin
  select id into someone from auth.users limit 1;

  -- ---- EVERY KIND HAS A DRAFT --------------------------------------------
  select count(*) into n from document_template_coverage
   where (select count(*) from document_templates d where d.kind = kind) = 0;
  if n > 0 then
    raise exception '052 FAILED: % document type(s) still have no template at all', n;
  end if;

  -- ---- AND NOT ONE OF THEM IS ACTIVE --------------------------------------
  -- The whole point. A seeded template that produced documents without anybody
  -- reading it would put wording nobody approved onto the University's paper.
  select count(*) into n from document_templates where status = 'active';
  if n > 0 then
    raise notice '052: % template(s) are active — those were activated by the University, '
                 'not seeded by this migration', n;
  end if;
  select count(*) into n from document_templates
   where status = 'active' and created_by is null and activated_by is null;
  if n > 0 then
    raise exception '052 FAILED: % seeded template(s) are active with nobody having activated '
                    'them', n;
  end if;

  if someone is null then
    raise notice '052: no accounts, so activation could not be exercised';
    return;
  end if;

  begin
    select id into t_id from document_templates
     where kind = 'letter-warning' and status = 'draft' limit 1;

    -- ---- A SEEDED DRAFT CAN BE ACTIVATED BY ANY OFFICER ---------------------
    -- `created_by` is null on every seeded row, so 044's "nobody activates
    -- their own" does not block the University from putting its own wording
    -- into force. The officer approving it did not write it, which is the rule
    -- working rather than being bypassed.
    update document_templates
       set status = 'active', activated_by = someone, activated_at = now(),
           effective_from = current_date
     where id = t_id;

    -- ---- BUT THE WORDING STILL CANNOT BE REWRITTEN ONCE ACTIVE --------------
    refused := false;
    begin
      update document_templates set body = 'Something else entirely, at some length.'
       where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '052 FAILED: an active template''s wording was rewritten in place';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '052 OK: every document type has a version 1 to edit, and none of them is '
               'active until somebody at the University activates it';
  raise notice '052 OK: a seeded draft can be activated by any officer holding the capability, '
               'because nobody here wrote it — and once active its wording is frozen';
end $$;


-- ===========================================================================
-- 5. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EVERY DOCUMENT TYPE AND WHERE ITS WORDING STANDS. After this runs, every row
-- should show a version 1 in draft. Open Document Templates in the portal,
-- read each one, edit what the University wants changed, and activate it — a
-- draft produces nothing until then.
-- ---------------------------------------------------------------------------
select k.kind,
       d.name,
       d.version,
       d.status,
       length(d.body) as words_to_read
  from document_template_coverage k
  left join document_templates d on d.kind = k.kind
 order by d.status, k.kind;
