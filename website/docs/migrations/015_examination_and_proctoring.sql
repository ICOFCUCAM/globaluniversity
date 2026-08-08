-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE DIGITAL EXAMINATION & PROCTORING SYSTEM
--
-- Run after 014_social_approval_and_retry.sql. Idempotent; destroys nothing.
--
-- The third subsystem, and the one with the highest stakes. A social post can
-- be deleted and a certificate can be reissued. An examination result decides
-- whether somebody graduates, and a misconduct finding follows a person for the
-- rest of their professional life.
--
-- ===========================================================================
-- THE ONE DISTINCTION THIS ENTIRE SCHEMA IS BUILT AROUND
-- ===========================================================================
--
-- The University stated it plainly, and it is the most important sentence in
-- the specification:
--
--   "The system should distinguish between EVIDENCE — recordings, screen
--    activity, submitted answers, timestamps — and DECISIONS — examiner flags,
--    misconduct findings, marks, moderation decisions. That distinction is
--    important for academic integrity and appeals."
--
-- So they are different tables with different rules, and the rules are enforced
-- by the database rather than by convention:
--
--   EVIDENCE is APPEND-ONLY. What the camera saw, when the screen share
--   stopped, what the candidate typed at 10:42 and again at 10:43. No UPDATE.
--   No DELETE. Not by an examiner, not by the Examination Officer, not by the
--   Superadministrator, not by anything holding the service-role key.
--
--   DECISIONS are ATTRIBUTABLE AND REVISABLE. A flag can be withdrawn, a mark
--   can be corrected, a misconduct finding can be overturned on appeal — and
--   every change records who, what, when, before, after and why, which is the
--   six-part record the University asked for.
--
-- WHY THIS MATTERS MORE THAN IT SOUNDS. An appeal asks two questions: what
-- actually happened, and was the judgement about it sound. A system that stores
-- both in one editable table cannot answer either — because the evidence may
-- have been revised to fit the finding, and there is no way to tell. Separating
-- them means the University can concede that a judgement was wrong while still
-- standing behind its record of the facts.
--
-- ===========================================================================
-- AN AUTOMATED EVENT IS AN ALERT. IT IS NEVER A FINDING.
-- ===========================================================================
--
--   "AI-generated events should be treated as alerts, not automatic proof of
--    cheating. A human examiner should make the academic-integrity decision."
--
-- This is enforced structurally rather than by policy. `exam_events` — where
-- "second face detected", "candidate left the window", "screen share stopped"
-- are written — HAS NO COLUMN IN WHICH A FINDING COULD BE RECORDED. There is no
-- `is_cheating`, no `verdict`, no `outcome`. The only place a finding can exist
-- is `exam_findings`, whose `decided_by` is NOT NULL and references a real
-- person holding 'determine-misconduct'.
--
-- A schema in which the automated layer cannot express a verdict is a stronger
-- guarantee than a policy saying it should not.
-- ===========================================================================


-- ===========================================================================
-- PART 1 — THE EXAMINATION ITSELF
-- ===========================================================================

-- 1 (a) ---------------------------------------------------------------------
-- WHAT KIND OF EXAMINATION IS THIS?
--
-- Five models, because the University asked that the system "support different
-- examination models rather than forcing every course into one format". A viva
-- voce in systematic theology and a multiple-choice paper in IT are both
-- examinations and share almost nothing operationally: one has a panel and no
-- questions table, the other has two hundred questions and no examiner in the
-- room.
--
-- Folding them into one shape would mean either a paper that carries a
-- meaningless "panel" or a defence that carries a meaningless "time limit".

create table if not exists examinations (
  id              uuid primary key default gen_random_uuid(),

  course_id       uuid references courses (id) on delete restrict,
  -- Denormalised so an examination record still reads correctly if a course is
  -- renamed years later. The examination happened under the title it had.
  course_code     text,
  course_title    text,
  programme       text,

  title           text not null,

  mode            text not null default 'standard' check (mode in (
                    'standard',      -- timed paper, automated supervision
                    'oral',          -- viva voce, live with an examiner
                    'practical',     -- demonstrated skill, observed
                    'defence',       -- dissertation defence, panel
                    'take-home'      -- long window, integrity controls, no camera
                  )),

  -- Minutes. Null for take-home, which uses the window below instead.
  duration_minutes integer,
  opens_at        timestamptz,
  closes_at       timestamptz,

  total_marks     integer not null default 100,
  pass_mark       integer not null default 50,

  -- LAYER 3 OF THE UNIVERSITY'S ANTI-CHEATING MODEL, as data rather than as
  -- code, so an Examination Officer can set it per paper without a deployment.
  randomise_questions boolean not null default false,
  randomise_options   boolean not null default false,
  require_fullscreen  boolean not null default true,
  require_camera      boolean not null default true,
  require_microphone  boolean not null default true,
  require_screen_share boolean not null default true,

  -- WHY A TAKE-HOME EXAMINATION MUST BE ABLE TO SWITCH THESE OFF.
  -- The University explicitly allows "a longer examination window while
  -- requiring submission of work and maintaining academic-integrity controls".
  -- Demanding a camera for seventy-two hours is not an integrity control; it is
  -- a rule nobody can comply with, and rules nobody can comply with are how a
  -- proctoring system loses the confidence of the people it supervises.

  status          text not null default 'draft' check (status in (
                    'draft', 'questions_approved', 'published', 'in_progress',
                    'closed', 'cancelled'
                  )),

  created_by      uuid references auth.users (id) on delete set null,
  approved_by     uuid references auth.users (id) on delete set null,
  approved_at     timestamptz,
  published_by    uuid references auth.users (id) on delete set null,
  published_at    timestamptz,

  created_at      timestamptz not null default now(),

  -- A paper that closes before it opens is a scheduling error worth catching
  -- here rather than at the moment a cohort tries to sit it.
  constraint examinations_window check (opens_at is null or closes_at is null or closes_at > opens_at),
  constraint examinations_pass_mark check (pass_mark >= 0 and pass_mark <= total_marks)
);

create index if not exists examinations_status_idx on examinations (status, opens_at);
create index if not exists examinations_course_idx on examinations (course_id);


-- 1 (b) ---------------------------------------------------------------------
-- WHO IS SUPERVISING, AND IN WHAT CAPACITY.
--
-- A defence has a chairperson and two examiners; a standard paper has one
-- invigilator watching forty candidates. Both are rows here.
--
-- ROLE IS PER EXAMINATION, NOT PER ACCOUNT. A lecturer may examine one paper
-- and moderate another in the same week — but never both on the same script,
-- which is what the unique constraint and 4(c)'s trigger are for.

create table if not exists examination_officers (
  id              uuid primary key default gen_random_uuid(),
  examination_id  uuid not null references examinations (id) on delete cascade,
  person_id       uuid not null references auth.users (id) on delete restrict,

  role            text not null check (role in (
                    'chair', 'examiner', 'invigilator', 'moderator', 'observer'
                  )),

  assigned_by     uuid references auth.users (id) on delete set null,
  assigned_at     timestamptz not null default now(),

  unique (examination_id, person_id, role)
);

create index if not exists examination_officers_person_idx on examination_officers (person_id);


-- ===========================================================================
-- PART 2 — THE SITTING
-- ===========================================================================

-- 2 (a) ---------------------------------------------------------------------
-- ONE CANDIDATE, ONE EXAMINATION, ONE SESSION.
--
-- The session is the spine of the whole subsystem: identity check, device
-- check, events, answers, marks and findings all hang off it.
--
-- THIS TABLE IS NOT EVIDENCE and does not pretend to be. It carries mutable
-- state — a session is created, then started, then submitted — and every one of
-- those transitions writes an immutable row into `exam_events`. The current
-- state is here for the interface; what happened is over there.

create table if not exists exam_sessions (
  id              uuid primary key default gen_random_uuid(),
  examination_id  uuid not null references examinations (id) on delete restrict,
  student_id      uuid references students (id) on delete restrict,
  -- Denormalised for the same reason as the course title: the record must still
  -- read correctly in five years.
  student_number  text,
  candidate_name  text,

  status          text not null default 'created' check (status in (
                    'created',        -- eligibility verified, nothing checked yet
                    'checks',         -- identity and device checks under way
                    'ready',          -- everything passed, waiting to start
                    'in_progress',
                    'paused',         -- examiner paused it; the clock stops
                    'submitted',
                    'terminated',     -- ended by an examiner, with a reason
                    'abandoned',      -- window closed with no submission
                    'void'            -- annulled after the fact, with a reason
                  )),

  -- THE CLOCK RUNS CENTRALLY. The University asked for this specifically, and
  -- the reason is that a timer running in the candidate's browser is a timer
  -- the candidate can edit. `started_at` plus the examination's duration, less
  -- whatever `paused_ms` has accumulated, is the only authority on time
  -- remaining; the browser displays a countdown it is told.
  started_at      timestamptz,
  submitted_at    timestamptz,
  paused_ms       bigint not null default 0,
  paused_at       timestamptz,
  -- Granted by an examiner, in minutes, always with a reason recorded as a
  -- decision in exam_session_decisions.
  extra_minutes   integer not null default 0,

  -- A POINTER, NEVER THE SECRET. Same discipline as social_accounts.token_ref:
  -- the join token for the proctoring service lives in the secret store, and
  -- this column is the key to look it up. A session token in an application
  -- table is a way into somebody's live camera feed.
  session_token_ref text,

  terminated_by   uuid references auth.users (id) on delete set null,
  termination_reason text,

  created_at      timestamptz not null default now(),

  unique (examination_id, student_id),

  -- A termination with no stated reason is indistinguishable from a fault, and
  -- it is the first thing an appeal asks about.
  constraint exam_sessions_termination_reason check (
    status <> 'terminated' or length(btrim(coalesce(termination_reason, ''))) > 0
  )
);

create index if not exists exam_sessions_exam_idx on exam_sessions (examination_id, status);
create index if not exists exam_sessions_student_idx on exam_sessions (student_id);
create index if not exists exam_sessions_live_idx on exam_sessions (status)
  where status in ('in_progress', 'paused', 'checks', 'ready');


-- 2 (b) ---------------------------------------------------------------------
-- LAYER 1 AND LAYER 2 — IDENTITY, AND THE ROOM.
--
-- EVIDENCE. Append-only, like everything in part 3.
--
-- The University's layered model puts identity first for a reason: every other
-- control assumes the person in front of the camera is the person on the
-- register. A perfect proctoring session of the wrong human being is worth
-- nothing.
--
-- WHAT IS DELIBERATELY NOT HERE: a biometric template, a face embedding, or
-- anything else that would let this system recognise a person across sittings.
-- The check is "does the face match the ID document presented now", performed
-- and recorded once. Storing a template would make the University the custodian
-- of a biometric database it never asked for and cannot secure, and would
-- outlive the examination by decades.

create table if not exists exam_identity_checks (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  method          text not null check (method in (
                    'photo_id', 'live_comparison', 'known_to_examiner', 'institutional_login'
                  )),

  -- Pointers into storage. Never image data in the database.
  id_image_path   text,
  face_image_path text,

  outcome         text not null check (outcome in ('passed', 'failed', 'overridden')),

  -- WHO SAID SO. Null when an automated comparison ran; NOT NULL when a person
  -- overrode it — because an override is a decision and decisions have owners.
  checked_by      uuid references auth.users (id) on delete set null,
  note            text,

  checked_at      timestamptz not null default now(),

  constraint exam_identity_override_has_owner check (
    outcome <> 'overridden' or (checked_by is not null and length(btrim(coalesce(note, ''))) > 0)
  )
);

create index if not exists exam_identity_session_idx on exam_identity_checks (session_id);


-- 2 (c) ---------------------------------------------------------------------
-- THE DEVICE AND CONNECTION CHECK, before anybody starts.
--
-- EVIDENCE. Recorded so that "my camera failed" can be answered with what the
-- system actually observed at 09:58, rather than with two recollections.

create table if not exists exam_device_checks (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  camera          boolean,
  microphone      boolean,
  screen_share    boolean,
  fullscreen      boolean,

  -- Round-trip milliseconds and downlink estimate at the moment of the check.
  latency_ms      integer,
  downlink_mbps   numeric(6,2),

  user_agent      text,
  platform        text,
  screen_count    integer,

  passed          boolean not null,
  detail          jsonb not null default '{}'::jsonb,
  checked_at      timestamptz not null default now()
);

create index if not exists exam_device_session_idx on exam_device_checks (session_id, checked_at);


-- ===========================================================================
-- PART 3 — EVIDENCE. APPEND-ONLY, ALL OF IT.
-- ===========================================================================

-- 3 (a) ---------------------------------------------------------------------
-- EVERY EVENT, FROM EVERY SOURCE.
--
-- NOTE WHAT THIS TABLE CANNOT SAY. There is no `is_cheating`, no `verdict`, no
-- `misconduct`. An automated detector can record that a second face appeared at
-- 10:42; it cannot record that the candidate cheated, because there is nowhere
-- to put that. See the header.
--
-- `source` distinguishes the three kinds of witness, and the distinction is
-- what an appeal turns on: 'system' saw a signal, 'proctor' saw a person, and
-- 'student' reported something themselves.

create table if not exists exam_events (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  kind            text not null check (kind in (
                    -- Lifecycle
                    'session_created', 'checks_started', 'checks_passed', 'checks_failed',
                    'exam_started', 'exam_paused', 'exam_resumed', 'exam_submitted',
                    'exam_terminated', 'time_extended',
                    -- Layer 2: the room
                    'camera_started', 'camera_stopped', 'camera_blocked',
                    'microphone_muted', 'microphone_unmuted',
                    'screen_share_started', 'screen_share_stopped',
                    -- Layer 3: the examination environment
                    'fullscreen_entered', 'fullscreen_exited',
                    'window_blurred', 'window_focused',
                    'paste_detected', 'navigation_attempt',
                    -- Layer 5: automated detection. ALERTS, NOT FINDINGS.
                    'second_face_detected', 'no_face_detected', 'face_returned',
                    'voice_detected',
                    'connection_lost', 'connection_restored',
                    -- The work
                    'answer_saved', 'question_viewed',
                    -- People
                    'proctor_joined', 'proctor_left', 'proctor_message', 'student_message'
                  )),

  source          text not null check (source in ('system', 'proctor', 'student')),

  -- Advisory only. An examiner sorts by it; nothing acts on it automatically,
  -- and nothing is failed because of it.
  severity        text not null default 'info' check (severity in ('info', 'notice', 'alert')),

  -- Who, when the source is a person. Null for system events.
  actor_id        uuid references auth.users (id) on delete set null,

  detail          jsonb not null default '{}'::jsonb,

  -- SERVER TIME, NOT CLIENT TIME. A clock the candidate controls is not a
  -- timestamp. Where the client's own time matters — for ordering events during
  -- a disconnection — it goes in `detail`, clearly labelled as reported.
  occurred_at     timestamptz not null default now()
);

create index if not exists exam_events_session_idx on exam_events (session_id, occurred_at);
create index if not exists exam_events_alert_idx on exam_events (session_id, occurred_at)
  where severity = 'alert';


-- 3 (b) ---------------------------------------------------------------------
-- ANSWERS, WITH THEIR HISTORY.
--
-- EVERY AUTOSAVE IS A ROW. Not an UPDATE to a current answer.
--
-- WHY THIS IS WORTH THE STORAGE. "The system crashed and lost my essay" is the
-- single most common examination dispute, and it is unanswerable if the table
-- holds only the final state. With a row per save, the University can say what
-- the candidate had written at 10:42 and that nothing was received after 10:47
-- — which either supports the candidate or settles the matter.
--
-- It is also the only honest way to hold "answers are automatically saved" as a
-- promise. A promise whose failure leaves no trace is not a promise.

create table if not exists exam_answers (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  question_id     uuid,
  question_number integer,

  -- The answer as given. Text for an essay, an option key for a choice, a
  -- storage path for an uploaded artefact — all as jsonb so a practical
  -- examination and a multiple-choice paper share this table honestly.
  answer          jsonb not null default '{}'::jsonb,

  -- Which save this is, per question. 1, 2, 3… The last one is what was
  -- submitted; the earlier ones are what the candidate was doing.
  revision        integer not null default 1,
  is_final        boolean not null default false,

  saved_at        timestamptz not null default now(),

  unique (session_id, question_id, revision)
);

create index if not exists exam_answers_session_idx on exam_answers (session_id, question_number, revision desc);
create index if not exists exam_answers_final_idx on exam_answers (session_id) where is_final;


-- 3 (c) ---------------------------------------------------------------------
-- RECORDINGS.
--
-- POINTERS ONLY. A camera session is gigabytes of video; it belongs in object
-- storage with its own lifecycle, and the database holds where it is, how long
-- it runs and when it may be destroyed.
--
-- `retention_until` IS NOT OPTIONAL THINKING. A university that records its
-- students' homes has taken on a data-protection obligation, and "we keep it
-- for ever because deleting is hard" is not a lawful answer anywhere this
-- institution teaches. The column exists so the University must choose a period
-- and so a deletion job has something to read.

create table if not exists exam_recordings (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  kind            text not null check (kind in ('camera', 'screen', 'audio', 'room')),

  storage_path    text,
  external_ref    text,

  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  duration_seconds integer,
  size_bytes      bigint,

  -- Set from the University's retention policy at the moment of recording, so a
  -- later change of policy cannot retroactively extend how long a past
  -- candidate's home video is kept.
  retention_until date,
  destroyed_at    timestamptz,
  destroyed_note  text
);

create index if not exists exam_recordings_session_idx on exam_recordings (session_id);
create index if not exists exam_recordings_retention_idx on exam_recordings (retention_until)
  where destroyed_at is null;


-- 3 (d) ---------------------------------------------------------------------
-- THE APPEND-ONLY RULE, ENFORCED.
--
-- One function, four tables. UPDATE and DELETE are refused for every caller —
-- the examiner, the Examination Officer, the Superadministrator, and anything
-- holding the service-role key.
--
-- THE EXCEPTIONS, AND WHY EACH IS SAFE:
--
--   exam_answers may be marked final. `is_final` is a flag set once at
--   submission; nothing about the answer itself may change, and the trigger
--   checks that.
--
--   exam_recordings may be closed and destroyed. A recording that has ended
--   needs `ended_at`; a recording past its retention date needs `destroyed_at`.
--   Neither rewrites what was recorded — one says when it stopped, the other
--   says the University no longer holds it, which is itself a fact worth
--   keeping.

create or replace function exam_evidence_is_append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'Examination evidence is append-only. % on % is refused: a system in which the right '
      'account can revise what a camera recorded cannot support an appeal.', tg_op, tg_table_name;
  end if;

  -- The two narrow, explicitly-reasoned exceptions. Everything else is refused.
  if tg_table_name = 'exam_answers' then
    if new.session_id is distinct from old.session_id
       or new.question_id is distinct from old.question_id
       or new.answer is distinct from old.answer
       or new.revision is distinct from old.revision
       or new.saved_at is distinct from old.saved_at
    then
      raise exception
        'A saved answer cannot be altered. Save a new revision instead — that is what the '
        'revision column is for, and the history is the point.';
    end if;
    return new;
  end if;

  if tg_table_name = 'exam_recordings' then
    if new.session_id is distinct from old.session_id
       or new.kind is distinct from old.kind
       or new.storage_path is distinct from old.storage_path
       or new.started_at is distinct from old.started_at
    then
      raise exception
        'A recording cannot be re-pointed or re-dated. Closing it and recording its destruction '
        'are the only permitted changes.';
    end if;
    return new;
  end if;

  raise exception
    'Examination evidence is append-only. % on % is refused.', tg_op, tg_table_name;
end $$;

drop trigger if exists exam_events_append_only on exam_events;
create trigger exam_events_append_only
  before update or delete on exam_events
  for each row execute function exam_evidence_is_append_only();

drop trigger if exists exam_identity_append_only on exam_identity_checks;
create trigger exam_identity_append_only
  before update or delete on exam_identity_checks
  for each row execute function exam_evidence_is_append_only();

drop trigger if exists exam_device_append_only on exam_device_checks;
create trigger exam_device_append_only
  before update or delete on exam_device_checks
  for each row execute function exam_evidence_is_append_only();

drop trigger if exists exam_answers_append_only on exam_answers;
create trigger exam_answers_append_only
  before update or delete on exam_answers
  for each row execute function exam_evidence_is_append_only();

drop trigger if exists exam_recordings_append_only on exam_recordings;
create trigger exam_recordings_append_only
  before update or delete on exam_recordings
  for each row execute function exam_evidence_is_append_only();


-- ===========================================================================
-- PART 4 — DECISIONS. ATTRIBUTABLE, REVISABLE, AND FULLY AUDITED.
-- ===========================================================================

-- 4 (a) ---------------------------------------------------------------------
-- WHAT A PERSON DECIDED ABOUT A SITTING.
--
-- Pausing, resuming, extending time, terminating, voiding. Each is a decision
-- about a candidate's examination and each needs an owner and a reason.
--
-- SEPARATE FROM exam_events even though every one of these also writes an
-- event. The event is the fact that the examination was paused at 10:42; this
-- is the record that Dr Mbeki paused it because the candidate reported a power
-- cut. The first is evidence and cannot change; the second is a judgement and
-- may be revisited.

create table if not exists exam_session_decisions (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  action          text not null check (action in (
                    'started', 'paused', 'resumed', 'time_extended',
                    'terminated', 'voided', 'reinstated', 'identity_overridden'
                  )),

  reason          text not null,
  minutes         integer,

  decided_by      uuid not null references auth.users (id) on delete restrict,
  decided_role    text,
  decided_at      timestamptz not null default now(),

  constraint exam_session_decision_reason check (length(btrim(reason)) > 0)
);

create index if not exists exam_session_decisions_idx on exam_session_decisions (session_id, decided_at);


-- 4 (b) ---------------------------------------------------------------------
-- INCIDENTS AND FINDINGS — AND THE DIFFERENCE BETWEEN THEM.
--
-- AN INCIDENT IS AN OBSERVATION. "The candidate looked off-screen repeatedly
-- between 10:40 and 10:45." An invigilator may record one; it is the narrowest
-- role in the system and this is the only thing it can write.
--
-- A FINDING IS A DETERMINATION. "This constituted academic misconduct." Only a
-- moderator or the Superadministrator may make one, and 4(c) refuses to let the
-- person who raised the incident be the person who determines it.
--
-- THE UNIVERSITY'S OWN INSTRUCTION MADE THIS NECESSARY: automated events are
-- alerts, "a human examiner should make the academic-integrity decision". An
-- incident raised by a proctor is one step above an automated alert and one
-- step below a finding, and collapsing the three would mean a camera glitch
-- could end a degree.

create table if not exists exam_incidents (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  -- The events this observation concerns, if any. An incident may also stand
  -- alone — a proctor saw something the detectors did not.
  event_ids       uuid[] not null default '{}'::uuid[],

  category        text not null check (category in (
                    'identity', 'environment', 'communication', 'materials',
                    'technical', 'conduct', 'other'
                  )),

  description     text not null,
  severity        text not null default 'notice' check (severity in ('notice', 'serious')),

  raised_by       uuid not null references auth.users (id) on delete restrict,
  raised_role     text,
  raised_at       timestamptz not null default now(),

  -- Withdrawn rather than deleted. An invigilator who realises the second face
  -- was a reflection should be able to say so, and the record should show both
  -- the original observation and the correction.
  withdrawn_at    timestamptz,
  withdrawn_by    uuid references auth.users (id) on delete set null,
  withdrawal_note text,

  constraint exam_incident_description check (length(btrim(description)) > 0),
  constraint exam_incident_withdrawal check (
    withdrawn_at is null or length(btrim(coalesce(withdrawal_note, ''))) > 0
  )
);

create index if not exists exam_incidents_session_idx on exam_incidents (session_id, raised_at);


create table if not exists exam_findings (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,
  incident_id     uuid references exam_incidents (id) on delete restrict,

  outcome         text not null check (outcome in (
                    'no_misconduct', 'informal_warning', 'misconduct', 'referred'
                  )),

  -- REQUIRED, AND THE MOST IMPORTANT TEXT IN THIS SUBSYSTEM. A misconduct
  -- finding follows a person for the rest of their professional life. The
  -- reasoning is what an appeal reads.
  reasoning       text not null,

  -- What it did to the mark, if anything. Null means the finding stands on the
  -- record without affecting the result.
  mark_adjustment integer,

  -- NOT NULL. There is no such thing as a finding nobody made — see the header.
  decided_by      uuid not null references auth.users (id) on delete restrict,
  decided_role    text,
  decided_at      timestamptz not null default now(),

  -- An appeal may overturn it. The finding stays; the overturning is recorded
  -- against it, so the record shows both what was decided and that it was
  -- wrong.
  overturned_at   timestamptz,
  overturned_by   uuid references auth.users (id) on delete set null,
  overturn_reason text,

  constraint exam_finding_reasoning check (length(btrim(reasoning)) > 0),
  constraint exam_finding_overturn check (
    overturned_at is null or length(btrim(coalesce(overturn_reason, ''))) > 0
  )
);

create index if not exists exam_findings_session_idx on exam_findings (session_id);


-- 4 (c) ---------------------------------------------------------------------
-- NOBODY DETERMINES THEIR OWN OBSERVATION.
--
-- The invigilator who raised the incident cannot be the person who decides it
-- was misconduct. That is the same separation the University required of
-- certificate designs, of grades and of social posts, and it matters most here:
-- a proctor who has spent forty minutes suspecting a candidate is the worst
-- possible judge of whether the suspicion was justified.

create or replace function guard_exam_finding() returns trigger
language plpgsql as $$
declare
  raiser uuid;
begin
  if new.incident_id is null then return new; end if;

  select raised_by into raiser from exam_incidents where id = new.incident_id;

  if raiser is not null and raiser = new.decided_by then
    raise exception
      'The person who raised this incident cannot be the person who determines it. An '
      'academic-integrity finding needs a second reader — someone who watched a candidate for '
      'forty minutes suspecting them is the worst judge of whether the suspicion was justified.';
  end if;

  return new;
end $$;

drop trigger if exists exam_findings_second_reader on exam_findings;
create trigger exam_findings_second_reader
  before insert on exam_findings
  for each row execute function guard_exam_finding();


-- 4 (d) ---------------------------------------------------------------------
-- MARKS AND MODERATION.
--
-- The University already has a grade approval chain — 009 built it, with four
-- offices and a state machine — and this does NOT replace it. An examination
-- mark flows into `results` and travels the existing chain to publication. What
-- lives here is the examination-specific part: who marked this script, what the
-- moderator made of it, and how the two differ.
--
-- INTEGRATION RATHER THAN A SECOND SYSTEM. The University's point 7 asked for
-- exactly this, and a parallel marks table that did not reach the transcript
-- would be the most expensive kind of wrong: everything would appear to work.

create table if not exists exam_marks (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  -- Per question where the paper is marked question by question; null for a
  -- single overall mark, as in a viva.
  question_id     uuid,
  question_number integer,

  mark            numeric(6,2) not null,
  out_of          numeric(6,2) not null,
  comment         text,

  marked_by       uuid not null references auth.users (id) on delete restrict,
  marked_at       timestamptz not null default now(),

  -- Set when a moderator has looked at this script.
  moderated_by    uuid references auth.users (id) on delete set null,
  moderated_at    timestamptz,
  moderated_mark  numeric(6,2),
  moderation_note text,

  -- Where the examination mark ends up in the University's existing chain.
  result_id       uuid references results (id) on delete set null,

  constraint exam_marks_range check (mark >= 0 and mark <= out_of),
  constraint exam_marks_moderated_range check (
    moderated_mark is null or (moderated_mark >= 0 and moderated_mark <= out_of)
  ),
  -- A moderator who changes a mark says why. One who agrees need not.
  constraint exam_marks_moderation_note check (
    moderated_mark is null or moderated_mark = mark
    or length(btrim(coalesce(moderation_note, ''))) > 0
  ),
  unique (session_id, question_id)
);

create index if not exists exam_marks_session_idx on exam_marks (session_id);


-- A MODERATOR MAY NOT MODERATE THEIR OWN MARKING.
create or replace function guard_exam_moderation() returns trigger
language plpgsql as $$
begin
  if new.moderated_by is not null and new.moderated_by = new.marked_by then
    raise exception
      'A mark cannot be moderated by the person who awarded it. Moderation is a second opinion, '
      'and there is no second opinion in one head.';
  end if;
  return new;
end $$;

drop trigger if exists exam_marks_second_marker on exam_marks;
create trigger exam_marks_second_marker
  before insert or update on exam_marks
  for each row execute function guard_exam_moderation();


-- 4 (e) ---------------------------------------------------------------------
-- THE EXAMINER'S REPORT.
--
-- One per examiner per session, written after the sitting. This is the document
-- an appeal panel reads first, and it is a decision rather than evidence: it is
-- the examiner's account, and it may be revised before it is submitted.

create table if not exists exam_reports (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  narrative       text not null,
  recommendation  text check (recommendation in (
                    'accept', 'accept_with_note', 'refer_for_misconduct', 'void_and_resit'
                  )),

  author_id       uuid not null references auth.users (id) on delete restrict,
  author_role     text,

  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (session_id, author_id)
);

-- ONCE SUBMITTED, IT IS FIXED. Before that it is a draft the author may edit.
-- A report that can be rewritten after the outcome is known is not a report.
create or replace function guard_exam_report() returns trigger
language plpgsql as $$
begin
  if old.submitted_at is not null then
    if new.narrative is distinct from old.narrative
       or new.recommendation is distinct from old.recommendation
       or new.submitted_at is distinct from old.submitted_at
    then
      raise exception
        'A submitted examiner report cannot be edited. If it was wrong, record an addendum — '
        'a report rewritten after the outcome is known is not a report.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists exam_reports_immutable on exam_reports;
create trigger exam_reports_immutable
  before update on exam_reports
  for each row execute function guard_exam_report();


-- ===========================================================================
-- PART 5 — WHO → WHAT → WHEN → BEFORE → AFTER → REASON
-- ===========================================================================
--
-- The University's own six-part record, as a table. Every sensitive action in
-- this subsystem writes one, and — like the credential audit trail in 013 — it
-- is append-only against every caller including the Superadministrator.
--
-- BEFORE AND AFTER ARE THE PART MOST SYSTEMS OMIT. "The mark was changed" is
-- not an audit record; "the mark was changed from 58 to 62 by Dr Achebe on 4
-- March because the second script page had not been uploaded when it was first
-- marked" is. Without the before-state, an audit trail can only tell you that
-- something happened, which is the one thing everybody already knows.

create table if not exists exam_audit_events (
  id              uuid primary key default gen_random_uuid(),

  session_id      uuid references exam_sessions (id) on delete set null,
  examination_id  uuid references examinations (id) on delete set null,
  -- Kept as text so the row survives the session being removed and can still
  -- say which sitting it concerned.
  subject_ref     text,

  action          text not null,

  -- The six parts.
  actor_id        uuid references auth.users (id) on delete set null,
  actor_role      text,
  actor_email     text,
  before_state    jsonb,
  after_state     jsonb,
  reason          text,

  ip              inet,
  user_agent      text,
  occurred_at     timestamptz not null default now()
);

create index if not exists exam_audit_session_idx on exam_audit_events (session_id, occurred_at desc);
create index if not exists exam_audit_actor_idx on exam_audit_events (actor_id, occurred_at desc);

create or replace function exam_audit_is_append_only() returns trigger
language plpgsql as $$
begin
  raise exception
    'exam_audit_events is append-only. % is refused: an audit trail the most powerful account '
    'can edit is not an audit trail of that account.', tg_op;
end $$;

drop trigger if exists exam_audit_no_update on exam_audit_events;
create trigger exam_audit_no_update
  before update or delete on exam_audit_events
  for each row execute function exam_audit_is_append_only();


-- ===========================================================================
-- PART 6 — ROW-LEVEL SECURITY
-- ===========================================================================
--
-- Everything off by default. Writes are made by guarded API routes running as
-- the service role, in the pattern 009 established.
--
-- The exceptions below are the ones that are genuinely row predicates: a
-- candidate reading their own sitting and their own answers. Those belong in
-- the database rather than in a route, because a rule enforced here cannot be
-- forgotten by the next route somebody writes — and "a student can read another
-- student's examination answers" is not a bug anyone wants to explain.

alter table examinations            enable row level security;
alter table examination_officers    enable row level security;
alter table exam_sessions           enable row level security;
alter table exam_identity_checks    enable row level security;
alter table exam_device_checks      enable row level security;
alter table exam_events             enable row level security;
alter table exam_answers            enable row level security;
alter table exam_recordings         enable row level security;
alter table exam_session_decisions  enable row level security;
alter table exam_incidents          enable row level security;
alter table exam_findings           enable row level security;
alter table exam_marks              enable row level security;
alter table exam_reports            enable row level security;
alter table exam_audit_events       enable row level security;

-- A published examination is public knowledge to the cohort: what it is, when
-- it opens, how long it runs. The QUESTIONS are not here — they live in
-- module_records and are released by the route at the moment the sitting
-- starts, which is the control that matters.
drop policy if exists examinations_published_read on examinations;
create policy examinations_published_read on examinations
  for select using (status in ('published', 'in_progress', 'closed'));

-- A candidate may read their own sitting and their own answers, and nobody
-- else's.
drop policy if exists exam_sessions_own_read on exam_sessions;
create policy exam_sessions_own_read on exam_sessions
  for select using (
    student_id in (select id from students where auth_user_id = auth.uid())
  );

drop policy if exists exam_answers_own_read on exam_answers;
create policy exam_answers_own_read on exam_answers
  for select using (
    session_id in (
      select s.id from exam_sessions s
      join students st on st.id = s.student_id
      where st.auth_user_id = auth.uid()
    )
  );


-- ===========================================================================
-- PART 7 — PROOF THAT IT LANDED, AND THAT IT DOES WHAT IT CLAIMS
-- ===========================================================================
--
-- Existence checks are not enough — 013 shipped with a proof block that passed
-- while the operation the subsystem existed for was impossible. So this block
-- performs the rules: it tries to rewrite evidence, tries to have a proctor
-- judge their own incident, and tries to have an examiner moderate their own
-- mark. All three must be refused.

do $$
declare
  n integer;
  refused boolean;
  ex uuid;
  sess uuid;
  ev uuid;
  inc uuid;
  proctor uuid := '00000000-0000-0000-0000-0000000000e1';
  marker  uuid := '00000000-0000-0000-0000-0000000000e2';
begin
  select count(*) into n from information_schema.tables
   where table_schema = 'public'
     and table_name in ('examinations', 'examination_officers', 'exam_sessions',
                        'exam_identity_checks', 'exam_device_checks', 'exam_events',
                        'exam_answers', 'exam_recordings', 'exam_session_decisions',
                        'exam_incidents', 'exam_findings', 'exam_marks',
                        'exam_reports', 'exam_audit_events');
  if n <> 14 then
    raise exception 'Expected 14 examination tables, found %', n;
  end if;

  -- THE AUTOMATED LAYER MUST NOT BE ABLE TO EXPRESS A VERDICT.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'exam_events'
       and column_name in ('is_cheating', 'verdict', 'misconduct', 'outcome')
  ) then
    raise exception
      'exam_events has gained a column in which a finding could be recorded. An automated event '
      'is an alert, never proof — the academic-integrity decision belongs to a person.';
  end if;

  insert into auth.users (id, email) values
    (proctor, 'selftest-proctor-015@iguc.net'),
    (marker,  'selftest-marker-015@iguc.net')
  on conflict (id) do nothing;

  -- IDEMPOTENT. The first draft inserted a fresh examination and session on
  -- every run, and since evidence cannot be deleted, re-running the migration
  -- would have left a trail of self-test sittings in the University's own
  -- examination record. A prior self-test is reused instead.
  select id into ex from examinations
   where title = 'Installation self-test - migration 015' limit 1;

  if ex is null then
    insert into examinations (title, mode, status)
    values ('Installation self-test - migration 015', 'standard', 'cancelled')
    returning id into ex;
  end if;

  select id into sess from exam_sessions where examination_id = ex limit 1;

  if sess is null then
    insert into exam_sessions (examination_id, candidate_name, status)
    values (ex, 'Installation self-test', 'in_progress')
    returning id into sess;
  end if;

  -- The session must be live for the rules below to be exercised; it is set
  -- back to void at the end.
  update exam_sessions set status = 'in_progress' where id = sess;

  -- 1. EVIDENCE CANNOT BE REWRITTEN.
  insert into exam_events (session_id, kind, source, severity)
  values (sess, 'second_face_detected', 'system', 'alert')
  returning id into ev;

  refused := false;
  begin
    update exam_events set severity = 'info' where id = ev;
  exception when others then
    if sqlerrm like '%append-only%' then refused := true; else raise; end if;
  end;
  if not refused then
    raise exception 'An examination event was altered. Evidence is not append-only.';
  end if;

  refused := false;
  begin
    delete from exam_events where id = ev;
  exception when others then
    if sqlerrm like '%append-only%' then refused := true; else raise; end if;
  end;
  if not refused then
    raise exception 'An examination event was deleted. Evidence is not append-only.';
  end if;

  -- 2. AN ANSWER CANNOT BE EDITED, BUT MAY BE MARKED FINAL.
  insert into exam_answers (session_id, question_number, answer, revision)
  values (sess, 1, '{"text":"first"}'::jsonb, 1)
  on conflict (session_id, question_id, revision) do nothing;

  refused := false;
  begin
    update exam_answers set answer = '{"text":"tampered"}'::jsonb where session_id = sess;
  exception when others then
    if sqlerrm like '%cannot be altered%' then refused := true; else raise; end if;
  end;
  if not refused then
    raise exception 'A saved answer was rewritten. The revision history is not trustworthy.';
  end if;

  update exam_answers set is_final = true where session_id = sess;

  -- 3. THE PERSON WHO RAISED AN INCIDENT CANNOT DETERMINE IT.
  select id into inc from exam_incidents where session_id = sess limit 1;
  if inc is null then
    insert into exam_incidents (session_id, category, description, raised_by)
    values (sess, 'environment', 'Self-test observation.', proctor)
    returning id into inc;
  end if;

  refused := false;
  begin
    insert into exam_findings (session_id, incident_id, outcome, reasoning, decided_by)
    values (sess, inc, 'misconduct', 'Self-test.', proctor);
  exception when others then
    if sqlerrm like '%second reader%' then refused := true; else raise; end if;
  end;
  if not refused then
    raise exception 'A proctor determined their own incident. There is no second reader.';
  end if;

  -- …and a different person may.
  if not exists (select 1 from exam_findings where session_id = sess) then
    insert into exam_findings (session_id, incident_id, outcome, reasoning, decided_by)
    values (sess, inc, 'no_misconduct', 'Self-test: a second reader may decide.', marker);
  end if;

  -- 4. AN EXAMINER CANNOT MODERATE THEIR OWN MARK.
  insert into exam_marks (session_id, question_number, mark, out_of, marked_by)
  values (sess, 1, 55, 100, marker)
  on conflict (session_id, question_id) do nothing;

  refused := false;
  begin
    update exam_marks set moderated_by = marker, moderated_mark = 70,
                          moderation_note = 'Self-test.'
     where session_id = sess;
  exception when others then
    if sqlerrm like '%second opinion%' then refused := true; else raise; end if;
  end;
  if not refused then
    raise exception 'An examiner moderated their own mark.';
  end if;

  -- 5. THE AUDIT TRAIL IS APPEND-ONLY.
  -- APPEND-ONLY MEANS EVERY RUN LEAVES A ROW, and that is correct: each run
  -- genuinely did prove the rules on that date.
  insert into exam_audit_events (session_id, action, reason)
  values (sess, 'installation.self_test',
          'Migration 015 proved the examination rules at install.');

  refused := false;
  begin
    update exam_audit_events set reason = 'tampered' where session_id = sess;
  exception when others then
    if sqlerrm like '%append-only%' then refused := true; else raise; end if;
  end;
  if not refused then
    raise exception 'The examination audit trail accepted an UPDATE.';
  end if;

  -- Clean up what CAN be cleaned. The evidence rows cannot be deleted — that is
  -- the point — so the self-test session is marked void and stays, labelled.
  update exam_sessions
     set status = 'void'
   where id = sess;
  update examinations set status = 'cancelled' where id = ex;

  raise notice 'Examination & Proctoring installed: 14 tables.';
  raise notice 'Proven at install: evidence cannot be rewritten or deleted; a saved answer cannot be edited;';
  raise notice 'a proctor cannot determine their own incident; an examiner cannot moderate their own mark.';
  raise notice 'The self-test session is marked void and remains - its evidence rows cannot be deleted, by design.';
end $$;
