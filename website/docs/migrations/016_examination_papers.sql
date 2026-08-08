-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — RECORDING THE PAPER EACH CANDIDATE WAS GIVEN
--
-- Run after 015_examination_and_proctoring.sql. Idempotent; destroys nothing.
--
-- ===========================================================================
-- WHY THE SEED IS NOT ENOUGH
-- ===========================================================================
--
-- 015 gave every sitting an id, and src/lib/examPaper.ts derives the question
-- and option order from it. That makes a paper reproducible while the sitting
-- is live: a candidate who refreshes gets the same arrangement, because the
-- same seed over the same bank produces the same result.
--
-- It stops being true the moment the bank changes. A question withdrawn after
-- the sitting — because it was ambiguous, which is exactly the case an appeal
-- is about — leaves the same seed producing a DIFFERENT paper. The University
-- would then be unable to show what it actually asked, in the one situation
-- where being able to show it matters.
--
-- So the resolved paper is recorded on the session: the questions, in the order
-- delivered, with the options in the order delivered.
--
-- ===========================================================================
-- IT IS EVIDENCE, SO IT IS WRITTEN ONCE
-- ===========================================================================
--
-- `paper` may go from null to a value exactly once. After that it cannot be
-- changed or cleared, by anyone — the same rule 015 applies to events, answers
-- and recordings, for the same reason. A paper that can be rewritten after the
-- sitting is not a record of what was asked; it is a record of what somebody
-- would prefer to have asked.
--
-- The column lives on exam_sessions rather than in a table of its own because
-- it is one document per sitting with no independent life. The set-once trigger
-- is what gives it the immutability the evidence tables get from being
-- append-only.
--
-- ===========================================================================
-- THE ANSWER KEY IS IN HERE, AND THAT IS FINE
-- ===========================================================================
--
-- The recorded paper carries `correct` for each objective question — which
-- option was right, at the position THIS candidate saw it. Marking needs it,
-- and an appeal needs it more.
--
-- It is safe because exam_sessions has one RLS policy, added in 015, letting a
-- candidate read their OWN session — and that would expose the key of their own
-- paper. So this migration narrows that policy: a candidate may read their
-- sitting, and the `paper` column is served to them only through
-- /api/exam/questions, which strips the key with forCandidate(). A view does
-- the narrowing rather than trusting every future route to remember.
-- ===========================================================================


-- 1 -------------------------------------------------------------------------

alter table exam_sessions add column if not exists paper jsonb;
alter table exam_sessions add column if not exists paper_built_at timestamptz;

create or replace function guard_exam_paper_once() returns trigger
language plpgsql as $$
begin
  if old.paper is not null and new.paper is distinct from old.paper then
    raise exception
      'The paper a candidate was given cannot be changed. It is the record of what the '
      'University actually asked, and an appeal about an ambiguous question is exactly the '
      'situation in which it must not have been rewritten.';
  end if;

  if new.paper is not null and old.paper is null then
    new.paper_built_at := coalesce(new.paper_built_at, now());
  end if;

  return new;
end $$;

drop trigger if exists exam_sessions_paper_once on exam_sessions;
create trigger exam_sessions_paper_once
  before update on exam_sessions
  for each row execute function guard_exam_paper_once();


-- 2 -------------------------------------------------------------------------
-- WHAT A CANDIDATE MAY READ OF THEIR OWN SITTING.
--
-- Everything except the paper. 015's policy let them select the whole row,
-- which after section 1 would include the answer key — readable with the
-- publishable key and a single query, by the one person who must not have it.
--
-- A VIEW RATHER THAN A NARROWER POLICY, because PostgREST column-level grants
-- are easy to widen by accident and a view is explicit about what it exposes.
-- The old row policy is dropped so there is one way in, not two.

create or replace view exam_sessions_mine as
  select
    s.id, s.examination_id, s.student_id, s.student_number, s.candidate_name,
    s.status, s.started_at, s.submitted_at, s.paused_ms, s.paused_at,
    s.extra_minutes, s.created_at,
    -- Whether a paper has been built, but never the paper itself.
    (s.paper is not null) as paper_ready
  from exam_sessions s
  join students st on st.id = s.student_id
  where st.auth_user_id = auth.uid();

drop policy if exists exam_sessions_own_read on exam_sessions;


-- 3 -------------------------------------------------------------------------
-- Proof.

do $$
declare
  ex uuid;
  sess uuid;
  refused boolean := false;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'exam_sessions' and column_name = 'paper'
  ) then
    raise exception 'exam_sessions has no paper column.';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'exam_sessions_paper_once') then
    raise exception 'The set-once guard on the recorded paper is missing.';
  end if;

  -- PERFORM THE RULE. Reuse 015's self-test sitting rather than making another.
  select id into ex from examinations
   where title = 'Installation self-test - migration 015' limit 1;

  if ex is not null then
    select id into sess from exam_sessions where examination_id = ex limit 1;
  end if;

  if sess is not null then
    update exam_sessions set paper = '{"seed":"selftest","questions":[]}'::jsonb
     where id = sess and paper is null;

    begin
      update exam_sessions set paper = '{"seed":"rewritten","questions":[]}'::jsonb
       where id = sess;
    exception when others then
      if sqlerrm like '%cannot be changed%' then refused := true; else raise; end if;
    end;

    if not refused then
      raise exception 'A recorded examination paper was rewritten. It is not set-once.';
    end if;
  end if;

  raise notice 'Recorded papers installed. A paper is written once and cannot be rewritten;';
  raise notice 'candidates read their sitting through exam_sessions_mine, which omits the answer key.';
end $$;
