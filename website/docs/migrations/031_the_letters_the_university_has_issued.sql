-- ===========================================================================
-- 031 — THE LETTERS THE UNIVERSITY HAS ISSUED, KEPT
--
-- Run after 030. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- The University asked where to check the QR code in a letter it had just
-- issued, and then answered the question itself: if a letter is generated and
-- the sending fails, it should still be in some storage or outbox.
--
-- It was not. The admission package was rendered, handed to the mail server
-- and discarded. Nothing wrote it anywhere, and mail sent over SMTP leaves no
-- copy in a Sent folder — so the only copy of a document the University had
-- signed and sealed lived in the applicant's inbox. When delivery failed,
-- there was no copy at all.
--
-- ---------------------------------------------------------------------------
-- WHY A RE-RENDER IS NOT A SUBSTITUTE, THOUGH IT LOOKS LIKE ONE
-- ---------------------------------------------------------------------------
--
-- The letter can be rebuilt from the record, and while the template is
-- unchanged the rebuild is exact — the seal is an HMAC over the particulars,
-- so the same inputs give the same seal and the same QR.
--
-- That holds only until somebody edits the template. After that, rebuilding
-- produces TODAY'S letter for a student admitted last year: same facts,
-- different document, and a seal computed over the same particulars sitting
-- under wording the University never sent. The stored copy is the record of
-- what was actually issued. The rebuild is a convenience.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MAKES POSSIBLE
-- ---------------------------------------------------------------------------
--
-- An outbox. Every letter carries the outcome of its delivery, so "was this
-- student ever actually told?" is a question with an answer, and a letter that
-- failed to send can be sent again from the copy that was made at the time
-- rather than from a fresh render.
--
-- ---------------------------------------------------------------------------
-- IT IS NOT ON THE API, AND THAT IS DELIBERATE
-- ---------------------------------------------------------------------------
--
-- Row-level security on, no policy: deny-all, reachable only by the server
-- holding the service role. These rows carry a named person's date of birth,
-- nationality and programme. This is the same posture as the audit logs and
-- the secret store, and it is why the Supabase advisor's "RLS Enabled No
-- Policy" finding is the correct state here rather than an oversight.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TABLE
-- ===========================================================================

create table if not exists admission_letters (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references students(id) on delete cascade,
  student_number  text,
  to_email        text,
  /** The date the letter bears, which is what its seal was computed over. */
  issued_on       date,
  /** Whether it went out with a seal. False when CREDENTIAL_SECRET was absent. */
  sealed          boolean not null default false,
  /** The document itself, as the applicant received it. */
  html            text not null,
  delivery        text not null default 'pending'
                    check (delivery in ('pending', 'sent', 'failed')),
  /** The mail server's own words when it refused. */
  delivery_detail text,
  attempts        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists admission_letters_application_idx
  on admission_letters (application_id, created_at desc);

-- THE OUTBOX QUERY'S INDEX. Partial, because the rows worth finding quickly
-- are the few that did not arrive, not the many that did.
create index if not exists admission_letters_undelivered_idx
  on admission_letters (created_at desc) where delivery <> 'sent';

alter table admission_letters enable row level security;

comment on table admission_letters is
  'Every admission package the University has issued, as it was issued. SERVER '
  'ONLY — row-level security is on with no policy, because these rows carry a '
  'named person''s particulars. Kept rather than re-rendered because a rebuild '
  'follows today''s template, and what was sent is what the record has to show.';


-- ===========================================================================
-- 2. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  app uuid;
  letter uuid;
  refused boolean;
begin
 begin
  insert into students (first_name, last_name, matric_no, email, status, student_number)
  values ('Proof', '031', 'PROOF-031', 'proof-031@iguc.net', 'admission_issued', 'ICOF209900931')
  returning id into app;

  -- ---- A LETTER SURVIVES A FAILED DELIVERY ---------------------------
  -- The whole point. Generated, not sent, and still here.
  insert into admission_letters
    (application_id, student_number, to_email, issued_on, sealed, html, delivery, delivery_detail, attempts)
  values (app, 'ICOF209900931', 'proof-031@iguc.net', current_date, true,
          '<html>the letter</html>', 'failed', 'the mail server refused the message', 1)
  returning id into letter;

  if (select html from admission_letters where id = letter) is null then
    raise exception '031 FAILED: the letter was not kept';
  end if;
  if (select count(*) from admission_letters where delivery <> 'sent') < 1 then
    raise exception '031 FAILED: an undelivered letter is not findable as undelivered';
  end if;

  -- ---- AND A RESEND UPDATES IT RATHER THAN LOSING IT ------------------
  update admission_letters
     set delivery = 'sent', delivery_detail = null, attempts = attempts + 1, updated_at = now()
   where id = letter;
  if (select attempts from admission_letters where id = letter) <> 2 then
    raise exception '031 FAILED: the delivery attempts were not counted';
  end if;

  -- ---- THE VOCABULARY IS CLOSED --------------------------------------
  refused := false;
  begin
    update admission_letters set delivery = 'probably' where id = letter;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '031 FAILED: delivery accepts a state nothing can act on';
  end if;

  -- ---- AND IT IS NOT ON THE PUBLIC API --------------------------------
  if not (select relrowsecurity from pg_class where relname = 'admission_letters') then
    raise exception '031 FAILED: row-level security is not enabled on a table of personal particulars';
  end if;
  if exists (select 1 from pg_policies where tablename = 'admission_letters') then
    raise exception '031 FAILED: a policy was added, so these rows are reachable from the API';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '031 OK — a letter survives a failed delivery, is findable as undelivered, counts '
              'its attempts, refuses an unknown delivery state, and is not on the API.';
end $$;


-- ===========================================================================
-- 3. VERIFY
-- ===========================================================================

-- THE OUTBOX. Anything here was generated and did not reach the applicant.
-- Empty is the healthy answer; a row is a student who has been admitted and
-- does not know it, and it is resent from the Admissions approval desk.
select
  l.created_at,
  l.student_number,
  l.to_email,
  l.delivery,
  l.attempts,
  l.delivery_detail
from admission_letters l
where l.delivery <> 'sent'
order by l.created_at desc;
