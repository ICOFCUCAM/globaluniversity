-- ===========================================================================
-- 076 — ONE TRANSCRIPT, ONE DOWNLOAD; AND CLEARANCE JOINS THE GRADUATION AUDIT
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- 1. A transcript a student has been granted can be downloaded ONCE. After
--    that they can look at the record on screen as always, but another copy
--    means another request — which the Registry sees, decides and can refuse.
--
-- 2. The graduation audit stops saying financial clearance is UNKNOWN. It now
--    reads the clearance 075 lets Finance record, and shows the ledger beside
--    it.
--
-- Nothing already issued is touched. Every transcript request that exists
-- keeps its status, and gets one download rather than none.
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S INSTRUCTION
-- ---------------------------------------------------------------------------
--
-- "Transcript from student must be upon request and only one time to be
-- downloaded by student. After which they can only request."
--
-- ---------------------------------------------------------------------------
-- WHY THE COUNTER IS IN THE DATABASE AND NOT IN THE SCREEN
-- ---------------------------------------------------------------------------
--
-- "Only one time" is a rule about a thing that has already left the building.
-- A screen that hides the button after the first press is not enforcing
-- anything: the request that fetched the document can be replayed, and a
-- student who wants a second copy does not need to be sophisticated to get one
-- — they need to press the browser's back button.
--
-- So the claim is an ATOMIC UPDATE guarded by its own WHERE clause:
--
--     update ... set downloaded = downloaded + 1
--      where id = ? and downloaded < allowed
--     returning ...
--
-- Two requests arriving at the same instant cannot both succeed, because the
-- second one's WHERE clause is evaluated against the first one's committed
-- row. A check-then-act in TypeScript — read the count, compare, then write —
-- has a gap between the read and the write, and two clicks land in it.
--
-- ---------------------------------------------------------------------------
-- AND THE SECOND COPY IS NOT REFUSED, IT IS REDIRECTED
-- ---------------------------------------------------------------------------
--
-- A student who needs another transcript has a real need — they are applying
-- somewhere else. The function does not say "no"; it says the download has
-- been used and a new request is how to get another, and `my_requests` shows
-- them the request they raised. Refusing without a route is how a rule gets
-- worked around rather than followed.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.transcript_requests') is null then
    raise exception 'There is no transcript request pipeline. Run the whole bundle.';
  end if;
  if to_regclass('public.financial_clearance_now') is null then
    raise exception
      'Migration 075 has not been run on this database: there is no financial clearance for the '
      'graduation audit to read. Run the whole bundle.';
  end if;
  if to_regclass('public.my_graduation') is null then
    raise exception 'Migration 074 has not been run. Run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. A GRANTED TRANSCRIPT CARRIES ITS OWN ALLOWANCE
-- ===========================================================================
--
-- `downloads_allowed` IS A COLUMN AND NOT THE CONSTANT 1, because the
-- University will eventually want to grant two — a student applying to two
-- institutions at once — and the alternative is that somebody edits the
-- counter by hand, which leaves no record of the decision.

alter table transcript_requests
  add column if not exists downloads_allowed integer not null default 1,
  add column if not exists downloaded        integer not null default 0,
  add column if not exists first_downloaded_at timestamptz,
  add column if not exists last_downloaded_at  timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'transcript_requests_downloads_sane') then
    alter table transcript_requests add constraint transcript_requests_downloads_sane
      check (downloads_allowed >= 0 and downloaded >= 0
             -- THE RULE ITSELF, AND IT IS A CONSTRAINT RATHER THAN A CONVENTION.
             -- Even something holding the service key cannot put this row into
             -- a state where a student has taken more copies than they were
             -- granted.
             and downloaded <= downloads_allowed);
  end if;
end $$;

comment on column transcript_requests.downloads_allowed is
  'How many times the student may download this transcript. One, unless the Registry deliberately '
  'grants more. A column rather than a hard-coded 1 so that granting two is a recorded decision '
  'instead of somebody editing a counter.';
comment on column transcript_requests.downloaded is
  'How many times they have. Moved only by claim_transcript_download(), which increments it in '
  'the same statement that checks it — a check-then-act in application code has a gap between '
  'the read and the write, and two clicks land in it.';


-- ===========================================================================
-- 2. CLAIMING THE DOWNLOAD
-- ===========================================================================
--
-- SECURITY DEFINER, and the ownership check is the first thing it does. The
-- function has to update a row the student may not update themselves — that is
-- the whole point of it — so it must check for itself that the request is
-- theirs. It is the only thing in this file that runs with more authority than
-- its caller, and it does exactly one thing.

create or replace function claim_transcript_download(p_request uuid)
returns table (granted boolean, reason text, credential_ref text, remaining integer)
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  -- ---- IS IT THEIRS? ---------------------------------------------------
  select t.*, s.auth_user_id
    into r
    from transcript_requests t
    join students s on s.id = t.student_id
   where t.id = p_request;

  if not found then
    return query select false, 'No such transcript request.', null::text, 0;
    return;
  end if;

  -- NOT "IS THE CALLER STAFF". A student claiming their own download is the
  -- only case this function exists for; the Registry issues through its own
  -- screen and does not come through here.
  if r.auth_user_id is null or r.auth_user_id <> auth.uid() then
    return query select false, 'This transcript request is not yours.', null::text, 0;
    return;
  end if;

  -- ---- HAS IT BEEN ISSUED? ---------------------------------------------
  --
  -- A student cannot download a transcript the Registry has not produced. The
  -- status is named back to them so "nothing happened" is never the answer.
  if r.status not in ('issued', 'completed', 'approved') then
    return query select false,
      'This request is ' || replace(r.status, '-', ' ')
      || '. You can download it once the Registry has issued it.',
      null::text, 0;
    return;
  end if;

  -- ---- THE ATOMIC CLAIM ------------------------------------------------
  --
  -- THE WHOLE RULE, IN ONE STATEMENT. The WHERE clause is what refuses the
  -- second copy, so two requests arriving together cannot both succeed.
  update transcript_requests t
     set downloaded = t.downloaded + 1,
         first_downloaded_at = coalesce(t.first_downloaded_at, now()),
         last_downloaded_at = now()
   where t.id = p_request
     and t.downloaded < t.downloads_allowed
  returning t.credential_ref, t.downloads_allowed - t.downloaded
    into credential_ref, remaining;

  if not found then
    -- NOT A BARE REFUSAL. The student needs another transcript for a reason;
    -- telling them how to get one is what stops the rule being worked around.
    return query select false,
      'You have already downloaded this transcript. A transcript is released once per request — '
      'ask the Registry for another and they will issue it.',
      null::text, 0;
    return;
  end if;

  return query select true, null::text, credential_ref, remaining;
end $$;

comment on function claim_transcript_download(uuid) is
  'Spends one of a transcript request''s downloads and says whether it was granted. The counter '
  'is checked and incremented in ONE statement, so a replayed request or a double click cannot '
  'take a second copy. Refuses politely and says how to get another.';

-- A student may read the function's effect but must never move the counter
-- themselves. Nothing grants UPDATE on this table to a student; the function's
-- SECURITY DEFINER is the only path.
revoke all on function claim_transcript_download(uuid) from public;
grant execute on function claim_transcript_download(uuid) to authenticated;


-- ===========================================================================
-- 3. THE STUDENT'S LIST SHOWS WHERE THE DOWNLOAD STANDS
-- ===========================================================================
--
-- Rebuilt rather than altered: `my_requests` is a UNION, and adding two
-- columns to one arm means adding them to all three.

-- DROPPED AND REBUILT for the same reason 074 does: `create or replace view`
-- cannot narrow a view, and a bundle that is run twice executes 074's version
-- and then this one, in that order, every time.
drop view if exists my_requests;

create view my_requests
with (security_invoker = true) as

select s.id                          as student_id,
       'request'                     as pipeline,
       r.id                          as item_id,
       r.kind,
       r.subject,
       r.detail,
       r.status,
       r.with_office,
       r.decision_note,
       r.submitted_at,
       r.decided_at,
       r.completed_at,
       null::integer                 as downloads_allowed,
       null::integer                 as downloaded
  from student_requests r
  join students s on s.id = r.student_id
 where s.auth_user_id = auth.uid()

union all

select s.id,
       'transcript',
       t.id,
       'transcript',
       concat_ws(' ', initcap(coalesce(t.kind, 'transcript')), 'transcript',
                 case when t.delivery is null then null else '· ' || t.delivery end),
       t.note,
       case t.status
         when 'requested'   then 'submitted'
         when 'pending'     then 'submitted'
         when 'in-progress' then 'under-review'
         when 'reviewing'   then 'under-review'
         when 'approved'    then 'approved'
         when 'refused'     then 'declined'
         when 'rejected'    then 'declined'
         when 'issued'      then 'completed'
         when 'completed'   then 'completed'
         when 'cancelled'   then 'withdrawn'
         else t.status
       end,
       'The Registry',
       t.note,
       t.requested_at,
       t.decided_at,
       case when t.status in ('issued', 'completed') then t.decided_at end,
       t.downloads_allowed,
       t.downloaded
  from transcript_requests t
  join students s on s.id = t.student_id
 where s.auth_user_id = auth.uid()

union all

select s.id,
       'correction',
       q.id,
       'credential-correction',
       'Correction to an issued credential',
       q.description,
       case q.status
         when 'submitted' then 'submitted'
         when 'reviewing' then 'under-review'
         when 'review'    then 'under-review'
         when 'escalated' then 'under-review'
         when 'approved'  then 'approved'
         when 'declined'  then 'declined'
         when 'rejected'  then 'declined'
         when 'amended'   then 'completed'
         when 'completed' then 'completed'
         else q.status
       end,
       'The Credential Authority',
       coalesce(q.decision_note, q.review_note),
       q.created_at,
       q.decided_at,
       case when q.amendment_id is not null then q.decided_at end,
       null::integer,
       null::integer
  from credential_correction_requests q
  join students s on s.id = q.student_id
 where s.auth_user_id = auth.uid();

comment on view my_requests is
  'Everything the signed-in student has asked the University for, from all three pipelines that '
  'hold such things. The transcript arm carries how many downloads were granted and how many '
  'have been used, so the student can see that their one copy is still waiting for them.';


-- ===========================================================================
-- 4. THE STUDENT'S FINANCE, NOW THAT THERE IS SOMETHING TO OWE
-- ===========================================================================
--
-- 074's `my_finance` could only list payments, because nothing recorded a
-- charge. 075 changed that. This is the account: assessed, waived, paid and
-- outstanding, per currency, plus the payments and the assessments behind it.
--
-- SPLIT INTO TWO VIEWS rather than one wide one, because they answer two
-- questions — "where do I stand" and "what were the lines" — and joining them
-- would repeat the balance against every payment row.

create or replace view my_fee_account
with (security_invoker = true) as
select a.student_id,
       a.currency,
       a.assessed,
       a.waived,
       a.payable,
       a.paid,
       a.outstanding,
       a.has_been_assessed,
       -- THE WORD THE SCREEN USES, decided once. A screen mapping a signed
       -- number to three words will eventually map zero to the wrong one.
       case
         when not a.has_been_assessed      then 'nothing charged yet'
         when a.outstanding > 0            then 'outstanding'
         when a.outstanding < 0            then 'in credit'
         else                                   'paid in full'
       end                                 as standing
  from student_fee_account a
  join students s on s.id = a.student_id
 where s.auth_user_id = auth.uid();

comment on view my_fee_account is
  'Where the signed-in student stands, per currency. `has_been_assessed` is what stops a student '
  'who has never been charged being told they are paid up.';

create or replace view my_fee_assessments
with (security_invoker = true) as
select a.student_id,
       a.id                  as assessment_id,
       a.session_label,
       a.semester,
       a.label,
       a.category,
       a.amount,
       a.waived,
       a.amount - a.waived   as payable,
       a.currency,
       a.due_on,
       a.waiver_reason,
       a.raised_at,
       (a.due_on is not null and a.due_on < current_date) as overdue
  from student_fee_assessments a
  join students s on s.id = a.student_id
 where s.auth_user_id = auth.uid()
   and a.status = 'raised';

comment on view my_fee_assessments is
  'The lines the signed-in student has been charged, with any waiver and its reason shown '
  'rather than the amount being quietly reduced.';


-- ===========================================================================
-- 5. CLEARANCE JOINS THE GRADUATION AUDIT
-- ===========================================================================
--
-- 074 reported `finance_cleared` as NULL for everybody and said why: nothing
-- recorded what a student was charged, so nothing could say whether they had
-- paid it. 075 fixed the first half and this reads it.
--
-- IT STAYS THREE-VALUED. Null still means "the University has not decided",
-- which is now a different and much more useful statement than "this system
-- cannot know": it means Finance has not looked yet, and somebody can go and
-- ask them. False means Finance looked and refused.
--
-- AND THE LEDGER IS CARRIED BESIDE THE DECISION. A clearance granted against
-- an outstanding balance shows both, so the graduation screen can say "cleared
-- by Finance, with $400 outstanding, because: instalment agreement" — which is
-- the truth, and is what a green tick alone would hide.

-- DROPPED AND REBUILT, NOT REPLACED. `create or replace view` may only APPEND
-- columns; it refuses to insert one in the middle, and the three finance
-- columns belong beside `finance_cleared` rather than tacked on after
-- `eligible` where nobody reading the view would find them.
--
-- A PLAIN DROP AND NOT `CASCADE`. If something has come to depend on this view
-- since 074, the drop fails and says so — which is the outcome worth having.
-- `cascade` would quietly delete whatever that was.
drop view if exists my_graduation;

create view my_graduation
with (security_invoker = true) as
select g.*,
       (g.credits_earned >= g.credits_required)          as credits_met,
       (g.courses_outstanding = 0)                       as courses_met,
       (g.courses_failed = 0)                            as nothing_failed,
       case when g.min_cgpa is null then null
            when g.cgpa is null     then null
            else g.cgpa >= g.min_cgpa end                as cgpa_met,
       -- NO LONGER ALWAYS NULL. Null now means Finance has not decided.
       fc.cleared                                        as finance_cleared,
       fc.reason                                         as finance_reason,
       fc.decided_at                                     as finance_decided_at,
       -- What the ledger says, alongside what Finance decided.
       acct.outstanding                                  as finance_outstanding,
       acct.currency                                     as finance_currency,
       coalesce(acct.has_been_assessed, false)           as finance_assessed,
       (g.graduation_id is not null)                     as already_conferred,
       case
         when g.graduation_id is not null then true
         when g.credits_earned < g.credits_required
           or g.courses_outstanding > 0
           or g.courses_failed > 0                       then false
         when g.min_cgpa is not null
          and (g.cgpa is null or g.cgpa < g.min_cgpa)    then false
         -- FINANCE CAN NOW REFUSE, and a refusal is a false rather than a null.
         when fc.cleared is false                        then false
         -- AND A MISSING DECISION STILL LEAVES IT UNDECIDED. The screen says
         -- "everything academic is met, Finance has not yet cleared you",
         -- which is a sentence a student can act on.
         when fc.cleared is null                         then null
         else true
       end                                               as eligible
  from graduation_candidate g
  join students s on s.id = g.student_id
  left join financial_clearance_now fc
    on fc.student_id = g.student_id and fc.purpose = 'graduation'
  -- THE LEDGER LINE THAT MATTERS: the currency they owe the most in. A
  -- student with two currencies has two lines and the graduation screen has
  -- room for one; the larger debt is the one worth surfacing.
  left join lateral (
    select a.outstanding, a.currency, a.has_been_assessed
      from student_fee_account a
     where a.student_id = g.student_id
     order by a.outstanding desc nulls last
     limit 1
  ) acct on true
 where s.auth_user_id = auth.uid();

comment on view my_graduation is
  'The signed-in student''s graduation assessment from 069, with financial clearance now read '
  'from 075''s record of what Finance DECIDED — and the ledger carried beside it, so a '
  'clearance granted against an outstanding balance is visible as exactly that rather than '
  'hidden inside a green tick. `eligible` stays three-valued: null means nobody has decided.';


-- ===========================================================================
-- 6. PROVE IT
-- ===========================================================================

do $$
declare
  stu      uuid;
  dept     uuid;
  who      uuid;
  officer  uuid;
  req      uuid;
  n        integer;
  ok       boolean;
  why      text;
begin
  begin
    insert into auth.users (id, email)
    values (gen_random_uuid(), 'proof076@example.invalid') returning id into who;
    insert into auth.users (id, email)
    values (gen_random_uuid(), 'proof076-reg@example.invalid') returning id into officer;

    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
      values ('Proof Department 076', 'PRF076', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into students (
      matric_no, first_name, last_name, email, department_id, program,
      degree_type, admission_year, status, student_status, auth_user_id
    ) values (
      'PRF076/0001', 'Proof', 'Student', 'proof076@example.invalid', dept,
      'Proof Programme', 'BA', 2026, 'enrolled', 'active', who
    ) returning id into stu;

    insert into transcript_requests (student_id, requested_by, kind, delivery, status)
    values (stu, who, 'official', 'pdf', 'requested')
    returning id into req;

    perform set_config('request.jwt.claim.sub', who::text, true);

    -- =================================================================
    -- A TRANSCRIPT NOBODY HAS ISSUED CANNOT BE DOWNLOADED
    -- =================================================================
    select granted, reason into ok, why from claim_transcript_download(req);
    if ok then
      raise exception '076 FAILED: a transcript was downloaded before the Registry issued it';
    end if;
    if why is null or why = '' then
      raise exception '076 FAILED: the refusal said nothing';
    end if;

    -- The Registry issues it.
    update transcript_requests
       set status = 'issued', credential_ref = 'PRF076-TRANSCRIPT-1',
           decided_by = officer, decided_at = now()
     where id = req;

    -- =================================================================
    -- THE FIRST DOWNLOAD IS GRANTED
    -- =================================================================
    select granted into ok from claim_transcript_download(req);
    if not ok then
      raise exception '076 FAILED: the one download a student was granted was refused';
    end if;
    select downloaded into n from transcript_requests where id = req;
    if n <> 1 then
      raise exception '076 FAILED: the counter reads % after one download', n;
    end if;

    -- =================================================================
    -- AND THE SECOND IS NOT
    -- =================================================================
    --
    -- THE RULE THE UNIVERSITY ASKED FOR. If this ever passes, a student can
    -- take unlimited sealed transcripts from one request.
    select granted, reason into ok, why from claim_transcript_download(req);
    if ok then
      raise exception '076 FAILED: a second copy of a one-time transcript was released';
    end if;
    if why !~ 'already downloaded' then
      raise exception '076 FAILED: the second refusal did not say why (got: %)', why;
    end if;
    -- AND IT TOLD THEM HOW TO GET ANOTHER. A rule with no route round it is a
    -- rule people work around.
    if why !~ 'another' then
      raise exception '076 FAILED: the refusal did not say how to get another transcript';
    end if;

    select downloaded into n from transcript_requests where id = req;
    if n <> 1 then
      raise exception '076 FAILED: a refused download still moved the counter to %', n;
    end if;

    -- =================================================================
    -- AND THE COUNTER CANNOT BE PUSHED PAST THE ALLOWANCE BY ANYTHING
    -- =================================================================
    --
    -- Not even by something holding the service key and writing directly.
    begin
      update transcript_requests set downloaded = 5 where id = req;
      raise exception '076 FAILED: the download counter was pushed past its allowance';
    exception when check_violation then null;
    end;

    -- A SECOND REQUEST IS A SECOND DOWNLOAD. The University's instruction in
    -- full: "after which they can only request".
    declare
      req2 uuid;
    begin
      insert into transcript_requests (student_id, requested_by, kind, delivery, status,
                                       credential_ref, decided_by, decided_at)
      values (stu, who, 'official', 'pdf', 'issued', 'PRF076-TRANSCRIPT-2', officer, now())
      returning id into req2;
      select granted into ok from claim_transcript_download(req2);
      if not ok then
        raise exception '076 FAILED: a fresh request did not grant a fresh download';
      end if;
    end;

    -- =================================================================
    -- ONE STUDENT CANNOT CLAIM ANOTHER'S TRANSCRIPT
    -- =================================================================
    declare
      other uuid;
      ostu  uuid;
      oreq  uuid;
    begin
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'proof076-other@example.invalid') returning id into other;
      insert into students (
        matric_no, first_name, last_name, email, department_id, program,
        degree_type, admission_year, status, student_status, auth_user_id
      ) values (
        'PRF076/0002', 'Other', 'Student', 'proof076o@example.invalid', dept,
        'Proof Programme', 'BA', 2026, 'enrolled', 'active', other
      ) returning id into ostu;
      insert into transcript_requests (student_id, requested_by, kind, delivery, status,
                                       credential_ref, decided_by, decided_at)
      values (ostu, other, 'official', 'pdf', 'issued', 'PRF076-OTHER', officer, now())
      returning id into oreq;

      -- Still signed in as the FIRST student.
      select granted, reason into ok, why from claim_transcript_download(oreq);
      if ok then
        raise exception
          '076 FAILED: one student downloaded another student''s transcript';
      end if;
      if why !~ 'not yours' then
        raise exception '076 FAILED: the refusal did not say it was somebody else''s';
      end if;
      select downloaded into n from transcript_requests where id = oreq;
      if n <> 0 then
        raise exception '076 FAILED: a refused claim spent another student''s download';
      end if;
    end;

    -- =================================================================
    -- CLEARANCE NOW REACHES THE GRADUATION AUDIT
    -- =================================================================
    --
    -- Null while Finance has not decided; false when they refuse.
    select count(*) into n from my_graduation where finance_cleared is not null;
    if n <> 0 then
      raise exception
        '076 FAILED: financial clearance is reported as decided before Finance has decided it';
    end if;

    insert into financial_clearances (student_id, purpose, cleared, reason, decided_by)
    values (stu, 'graduation', false,
            'Tuition outstanding for the 2026/2027 session.', officer);

    select finance_cleared into ok from my_graduation where student_id = stu;
    if ok is null or ok then
      raise exception '076 FAILED: a refusal by Finance did not reach the graduation audit';
    end if;

    perform set_config('request.jwt.claim.sub', '', true);

    -- AND THE VIEWS STILL RETURN NOTHING TO NOBODY.
    select count(*) into n from my_graduation;
    if n <> 0 then raise exception '076 FAILED: my_graduation returned % rows to nobody', n; end if;
    select count(*) into n from my_fee_account;
    if n <> 0 then raise exception '076 FAILED: my_fee_account returned % rows to nobody', n; end if;
    select count(*) into n from my_fee_assessments;
    if n <> 0 then
      raise exception '076 FAILED: my_fee_assessments returned % rows to nobody', n;
    end if;
    select count(*) into n from my_requests;
    if n <> 0 then raise exception '076 FAILED: my_requests returned % rows to nobody', n; end if;

    raise notice '076 OK — a transcript nobody has issued cannot be downloaded; the one '
      'granted download is released once and the second attempt is refused, told how to get '
      'another, and does not move the counter; the counter cannot be pushed past its allowance '
      'even by a direct write; one student cannot claim another''s; a fresh request grants a '
      'fresh download; and Finance''s decision now reaches the graduation audit.';

    raise exception 'ROLLBACK_076';
  exception
    when others then
      if sqlerrm = 'ROLLBACK_076' then
        perform set_config('request.jwt.claim.sub', '', true);
        return;
      end if;
      perform set_config('request.jwt.claim.sub', '', true);
      raise;
  end;
end $$;
