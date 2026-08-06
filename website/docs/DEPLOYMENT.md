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

### Not needed

There are no mail, storage or payment provider keys. The admission package is
generated in-process and delivered through Supabase; nothing else calls out.

---

## 2. Migrations, in order

Run each in the Supabase SQL editor, in this order, waiting for one to finish
before starting the next. Each is idempotent and destroys nothing, so re-running
one is safe.

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

Each file ends with `select` statements that verify what it did. Read the
output rather than assuming.

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
