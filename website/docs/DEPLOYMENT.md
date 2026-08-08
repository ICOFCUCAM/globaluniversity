# Deploying ICOF Global University

Everything the deployment needs that is not in this repository. Two sections:
the environment variables Vercel holds, and the migrations the database needs,
in order.

---

## 1. Vercel environment variables

Set these under **Project → Settings → Environment Variables**, for
**Production**, **Preview** and **Development** unless a row says otherwise.

Vercel does not restart a running deployment when a variable changes. **After
adding or changing any of these, redeploy.** A variable added without a redeploy
is a variable the running build cannot see, which looks exactly like the
variable being wrong.

### Secret — never in the repository, never prefixed `NEXT_PUBLIC_`

| Variable | What it is | What breaks without it |
|---|---|---|
| `CREDENTIAL_SECRET` | The HMAC key that seals every certificate, transcript and identity card. | `/api/credential/issue` refuses to issue anything. Every verification fails. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role`. Bypasses row-level security. | Every guarded route returns `service-role-key-missing`: admissions approval, mark entry, the approval chain, GPA recompute, credential issue, staff accounts. |
| `SECRET_STORE_KEY` | Seals every stored OAuth token with AES-256-GCM. `openssl rand -base64 48`, minimum 24 characters. | No social account can be connected at all. The flow refuses **before** the consent screen rather than obtaining a permission it cannot store. |
| `SMTP_PASS` | The mailbox password for `SMTP_USER`. | Nothing is emailed: no application notice, no welcome message with a new student's credentials, no credential delivery. The account is still created and the desk warns the Registrar. |
| `META_APP_SECRET`, `X_CLIENT_SECRET`, `LINKEDIN_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `TIKTOK_CLIENT_SECRET` | The registered social applications. See §1a. | That network is not offered as a destination. |
| `LIVEKIT_API_SECRET` | With `LIVEKIT_URL` and `LIVEKIT_API_KEY`, live proctoring. | Examinations can be sat and marked; they cannot be watched live. The console says so. |
| `ANTHROPIC_API_KEY` | Optional. Drafts each network's version of a post. | Posts are fitted to each platform's limit on a sentence boundary instead of rewritten, and the response says which happened. |

**`SECRET_STORE_KEY` is deliberately not `CREDENTIAL_SECRET`.** Rotating this one
costs an afternoon of re-authorising six social connections. Rotating
`CREDENTIAL_SECRET` invalidates every certificate the university has ever
issued. Keeping them separate is what makes this one rotatable at all.

**`CREDENTIAL_SECRET` — generate it, do not invent it.** Any of:

```
openssl rand -base64 48
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
python3 -c "import secrets,base64;print(base64.b64encode(secrets.token_bytes(48)).decode())"
```

Then keep it. It is not a password, it is a **key**: every seal already issued
was computed with it, and changing it invalidates every certificate the
university has ever issued — they will verify as forgeries. Store it wherever
the university keeps things it cannot afford to lose, before it is used to seal
anything.

The route refuses to fall back to a default. That refusal is deliberate — it
used to fall back to `'iguc-credential-dev-secret'`, which meant certificates
sealed with a value published in this repository, verifying perfectly and worth
nothing.

**`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS on every table.** It must never
appear in a variable named `NEXT_PUBLIC_*` — that prefix is what Vercel uses to
decide what to inline into the JavaScript bundle sent to every visitor.

### Public — sent to every browser, and that is fine

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Optional. Falls back to the project hardcoded in `src/lib/supabase.ts`. Set it so a staging deployment can point elsewhere without a code change. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The `anon` / publishable key | Optional, same fallback. Designed to be public; row-level security is what makes it safe, and nothing else. |
| `SITE_URL` | `https://iguc.net` | The absolute origin printed into QR codes, verification links and the admission package. Defaults to the university website in `constants.ts`. **Set it in Production.** A QR code that points at a preview URL is a certificate nobody can verify. |
| `NEXT_PUBLIC_ENABLE_DEMO` | `true` to enable | Leave **unset in Production.** It puts one-click role buttons on the login screen. |

### Mail

| Variable | Value | Notes |
|---|---|---|
| `SMTP_HOST` | `mail.iguc.net` | |
| `SMTP_PORT` | `465` | 465 means implicit TLS. The code sets `secure: true` only for 465, so use 465 or 587 and nothing else. |
| `SMTP_USER` | `registrar@iguc.net` | |
| `SMTP_PASS` | — | Secret. |
| `MAIL_FROM` | Optional | The address students see. Defaults to `SMTP_USER`. Set it only to a domain whose SPF authorises this mail server — a mismatch reads as forged, and a student receiving their password from an unfamiliar address has been handed something indistinguishable from phishing. |
| `APPLY_TO` | `admissions@iguc.net` | Where a submitted application is sent. |

---

## 1a. The six social applications, and one media provider

**None of these can be generated.** Each is an application the University
registers in its own name, submitted for review, and granted specific
permissions. That is a series of forms filled in by a person with authority to
act for the institution. `docs/SOCIAL-CONNECTIONS.md` lists the exact scopes per
network, what takes weeks, and the thing that catches people out.

| Network | Variables | The part that takes time |
|---|---|---|
| Facebook + Instagram + Threads | `META_APP_ID`, `META_APP_SECRET` | Meta App Review, for publishing permissions. Weeks. The Instagram account must be Business or Creator and linked to the Page — a personal account cannot be published to by any API, by anyone. |
| X | `X_CLIENT_ID`, `X_CLIENT_SECRET` | None, but check the tier's monthly post allowance against graduation week. |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | Posting **as the organisation** needs the Community Management API, requested separately and granted per page. |
| YouTube | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google verification. Until it passes, uploads can only be **private**. |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | An audit. Until it passes, the API can only place a video in the account's drafts. |

Plus `SOCIAL_REDIRECT_URI=https://iguc.net/api/social/oauth/callback`, registered
as the redirect address with **all six**. A mismatch here is the commonest cause
of a failed connection; the provider's own words are carried back to the screen.

Live proctoring needs `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` —
LiveKit is the only provider with an adapter here, and the only one that can be
self-hosted, which is the sole option that keeps recordings of students' homes
on infrastructure the University controls.

Until a network's application exists it is not offered as a destination, and a
post with no provider configured is logged as **queued**. It is never reported
as published.

---

## 2. Migrations, in order

**On a database that is already live, run one file: `docs/migrations/RUN.sql`.**
It carries 006 and 010 through 018 in order. Paste the whole file into the
Supabase SQL editor and run it once, or

```
psql "<connection string>" -f docs/migrations/RUN.sql
```

Every migration in it is idempotent and destroys nothing, so running it twice is
safe, and so is running it when some of it has already landed. It is
deliberately **not** wrapped in a transaction: each file runs statement by
statement, and wrapping them would mean a failure in the last one silently
undoing the first.

**On an empty project, run `docs/migrations/RUN-ALL.sql` instead** — 000 through
018. Read its header first: 000 appoints two administrators and can only appoint
accounts that already exist, so create them in Authentication → Users first.

Afterwards run `docs/migrations/VERIFY.sql`, which makes 25 checks and reports
what actually landed rather than what should have.

Some of these raise `NOTICE` deliberately — they report on the state they found
rather than changing it silently. A notice is information. An `ERROR` is a real
failure and stops the run.

The individual files, for reference:

| # | File | What it does |
|---|---|---|
| 000 | `000_complete.sql` | The whole schema. Run on a new project. |
| 001 | `001_full_schema.sql` | Superseded by 000. Skip on a new project. |
| 002 | `002_superadmin.sql` | The Superadministrator role and account custody. |
| 003 | `003_pipeline_rls.sql` | Admissions pipeline policies. |
| 004 | `004_credential_register.sql` | The issued-credential register and revocation. |
| 005 | `005_senate_approval.sql` | Three-office approval of credential **designs**. |
| 006 | `006_awards_and_graduation.sql` | The award catalogue and the graduation check. |
| 007 | `007_gpa_engine.sql` | `semester_gpas` — where averages are written. |
| 008 | `008_admission_openings.sql` | What the university is currently admitting to. |
| 009 | `009_results_approval.sql` | **The grade approval chain.** States, per-stage actors, the append-only transition log, the staff read policy on `results`, and the trigger enforcing four distinct signatories. |
| 010 | `010_writes_the_ui_makes.sql` | **The writes the interface makes.** Policies for `courses`, `payments` and `documents`, and `module_records` for the seven portal modules. |
| 011 | `011_school_of_ministry_curriculum.sql` | The School of Ministry curriculum. |
| 012 | `012_credit_framework.sql` | The credit framework the awards are counted in. |
| 013 | `013_social_and_credential_authority.sql` | **Eleven tables.** The social pipeline (accounts, posts, media, per-network targets, variants, metrics) with the trigger that refuses a personal target without per-post consent — and the Credential Authority, including the fix that made amendment possible at all: `credentials_issued.credential_id` was `UNIQUE`, so a second version could never be written. Now unique on `(credential_id, version)`, with a trigger enforcing the supersession chain. |
| 014 | `014_social_approval_and_retry.sql` | Approval state kept **separate from** pipeline status, a trigger refusing self-approval, rejection notes, and the retry index. |
| 015 | `015_examination_and_proctoring.sql` | **Fourteen tables, split along the line that matters.** Evidence — events, answers, recordings, identity and device checks — is append-only, enforced by triggers, not by convention. Decisions — session determinations, incidents, findings, marks, reports — are made by people and recorded as theirs. Second reader on findings, second marker on marks, reports immutable once signed. |
| 016 | `016_examination_papers.sql` | The paper each candidate actually saw, set once and never again. Replaces the own-read policy with a view that omits the paper column, because the paper carries the answer key. |
| 017 | `017_secret_store.sql` | AES-256-GCM sealed tokens. RLS enabled and **no policy at all** — unreadable through the publishable key by construction rather than by a rule somebody could later widen. The migration asserts no policy exists, so adding one fails the check on purpose. |
| 018 | `018_delete_application.sql` | **Who may delete an application: the Superadministrator alone.** Nobody could before — `students` had no DELETE policy and RLS refuses an operation with no policy — but "refused because nobody wrote the policy" is silently undone by the next person who widens something unrelated. A trigger backs it for service-role callers, and refuses an admitted student's row outright: withdrawal is a status, not a deletion. |

Each file ends with `select` statements that verify what it did, and 013
onwards *perform* their rules rather than checking a trigger exists — the proof
block writes a second credential version, attempts a self-approval, tries to
update a piece of evidence. Read the output rather than assuming.

### One correction that no migration can make for you

Migration 006 seeds the Diploma of Theology at 180 credits. It uses
`on conflict (code) do nothing`, so **re-running it will not correct a database
that already holds the old figure of 120**. If 006 was run before that change:

```sql
update awards set credits_required = 180 where code = 'DTH';
```

Without it the site advertises 180 and the graduation check requires 120.

---

## 3. People, before a term's marks are due

Roles are appointed in **Settings → Roles** by the Superadministrator.

### Required for a degree to be conferrable

The grade approval chain needs **four different people**. Nobody may sign the
same class twice, at any step — enforced by the API and again by a trigger in
migration 009, so it holds for anything holding the service-role key.

| Role | Step |
|---|---|
| `lecturer` | Enters marks and submits the class |
| `hod` | Moderates |
| `dean` | Approves for the faculty |
| `registrar` | Approves for publication; GPAs recompute here |

If one person holds two of these, classes stop at that point. That is the
design, not a fault: four approvals from one person is one opinion recorded four
times. `academic-office` also holds publication, as a fallback for an unstaffed
Registry — it holds **only** that last step, so it cannot walk a class through
alone.

### Required to publish a credential design

Migration 005 requires three offices to approve a design before it can be
published: `registrar`, `academic-office`, `vice-chancellor`. **Appoint all
three before running 005** — without them no design can be published, and the
certificate currently in force simply stays in force.

### Who issues a certificate

`registrar` and `academic-office`. This used to be the Superadministrator alone,
which meant nobody in the university could confer a degree.

---

## 4. First run through, to prove it works

1. Create a course — **Courses**. (Needs 010.)
2. Enrol a student on it.
3. A lecturer enters marks — **Grade book** — and presses **Save draft**, then
   **Submit for moderation**. (Needs 009 and 010.)
4. The Head of Department opens **Records → Result approval** and moderates.
5. The Dean approves for the faculty.
6. The Registrar approves for publication. The averages recompute in the same
   request — the screen says how many.
7. Issue the certificate — **Certificate**. It will now succeed; before step 6
   it returns `provisional-cgpa`, correctly.
8. Scan the QR code. It should resolve on `SITE_URL` and verify.

If step 7 still refuses, run `GET /api/admin/readiness` — it reports which of
the secret, the migrations, the averages and the appointed offices is missing,
with the remedy for each.

---

## 5. What has never been verified from here

This sandbox has no network route to the database host, so **no check in this
repository has ever run against the live schema.** Every claim about policies is
a claim about the migration files as written, including the automated one
(`npm run test:policies`).

Two things are worth doing from a machine that can reach the project, before a
real intake:

- Confirm `students` is **not** readable with the publishable key. If it is,
  every applicant's record is public, including the application text stored in
  the address column. The query is in `docs/ADMISSIONS-PIPELINE.md` §5b.
- Run the verification `select`s at the foot of 009 and 010 and read the output.
