# Admissions pipeline — how an application becomes a student

> The wider ERP this sits inside is documented at `/erp` and in
> `src/content/erp.ts` — seventeen modules, with an honest status against each.
> The universal status system (`src/lib/status.ts`) and the role hierarchy
> (`src/lib/roles.ts`) are shared by every module and are described there.

Internal note. **Not rendered anywhere on the site.**

The university set out how an application actually moves through the
institution. This records what was built, what must be run against the database
before it works, and the one thing I could not test.

---

## 1. The process, as specified

```
  Applicant completes the public form at /apply and pays the application fee
        │
        │   a students row is written with status 'applicant'  → RED
        ▼
  FINANCE DESK        Financial Admin registers the payment
        │             /portal → Admissions — Finance
        │   status becomes 'fee_paid'                          → BLUE
        ▼
  ── gate ──  turning blue is what makes the record visible to the Registrar
        ▼
  REGISTRAR DESK      Office of the Registrar examines the application
        │             /portal → Admissions — Registrar
        ├─ Request documents → status 'documents_required', stays in the queue
        ├─ Reject   → status 'declined', reason recorded, no account created
        └─ Approve  → student number issued (ICOF{year}{00000})
                      auth account created, status 'approved'
                      welcome email: student number, username, temporary
                      password, programme, faculty, intake
```

## 2. The gate is a filter, not a badge

`registrarQueue()` in `src/lib/admissions.ts` selects `status = 'fee_paid'`.
An unpaid application is therefore **absent** from the Registrar's list, not
merely marked differently in it. This was deliberate: any design where the
Registrar can see an unpaid application is a design where the Registrar can
approve one by mistake.

The same check is repeated server-side in the approval route. The browser sends
only a student id, so the fee gate is verified against the database at the
moment of approval rather than against whatever the page believed when it
loaded. A stale tab cannot approve a record that has since changed.

## 3. Two portals, and what each one is for

| | Admissions Portal `/admissions-portal` | Student Portal `/portal` |
|---|---|---|
| Who | Applicants | Enrolled students and staff |
| Account | Applicant account | Student account |
| Created by | The applicant | The Registrar, automatically, on approval |
| Carries application forms | Yes | **No** |

**A student cannot create their own student account.** The sign-up tab, form and
`handleSignup` handler are deleted from the Student Portal's login screen — not
hidden behind a flag. A student account is created only by the Registrar
approving an application, because an applicant who could create one would bypass
both the fee gate and the Registrar's examination.

An applicant who signs in at `/portal` is turned away with an explanation and
sent to the Admissions Portal, rather than shown an empty student dashboard.
`isEnrolledRole()` in `src/lib/roles.ts` is that check.

## 4. The role matrix is code, not prose

`src/lib/roles.ts` holds the university's role table as a capability matrix.
The specification's **"cannot"** lines are the load-bearing part, and they are
represented as the *absence* of a capability rather than as a UI condition:

| Role | Notably cannot |
|---|---|
| Finance Administrator | `admit-student` — absent from the matrix |
| Registrar Administrator | `verify-payment`, `approve-refund` — absent |
| Applicant | `register-courses`, `view-results`, `access-lms` — absent |

That is the separation of duties: the officer who confirms the money is not the
officer who confers the place, and neither can do the other's job. Both desks
check `can(role, capability)` rather than testing `role === 'admin'`, so the
matrix is the only place a permission is decided.

Eight roles: `admin`, `applicant`, `finance`, `registrar`, `academic-office`,
`dean`, `lecturer`, `student`.

## 4a. Student numbers

Issued at approval in the university's format — `ICOF` + intake year + a
five-digit sequence, e.g. `ICOF202600451`. The sequence is derived from the
highest existing number for that year rather than from a separate counter, so
it cannot drift out of step with the table. The student number is also the
username quoted in the welcome email.

## 5. Database migration — MUST BE RUN BEFORE THE DESKS WORK

**The whole script is `docs/migrations/001_full_schema.sql`.** Paste it into the
Supabase SQL editor and run it once.

It is written to be run against an **empty project as well as an existing one**,
because the project the university supplied is a fresh Supabase project while
the previous data lived on a different host. So it creates the nine tables the
portal reads — `departments`, `profiles`, `students`, `lecturers`, `courses`,
`enrollments`, `results`, `documents`, `audit_logs` — and then adds the fifteen
admissions-pipeline columns, the indexes, the `updated_at` triggers and the RLS
policies.

Every statement is idempotent (`if not exists`, `drop policy if exists` before
each `create policy`) and **nothing in it drops or deletes anything**, so it is
safe to run twice and safe to re-run after an edit.

The column list is also held in code as `requiredColumns` in
`src/lib/admissions.ts`, so the migration and the code that depends on it
cannot drift apart.

## 5a. Pointing at a different Supabase project

The URL and publishable key were hardcoded in `src/lib/supabase.ts`, so moving
the university to a different project meant editing code. They now come from
the environment — see `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # server-side only, never NEXT_PUBLIC_
```

The approval route imports the URL from `src/lib/supabase.ts` rather than
holding its own copy, so the browser client and the server route cannot end up
pointing at different databases — which would create an account in one project
and update a status in another.

**A project `bhpsftesricwotkziokd.supabase.co` was supplied.** Two things are
true about it and both need resolving before it can be used:

1. **It is unreachable from this environment.** The network policy answers 403
   to CONNECT for that host, exactly as it does for the original databasepad
   host. So the migration cannot be run from here and nothing can be tested
   against it here.
2. **It is not in the Supabase account connected over MCP.** That account holds
   seventeen projects and none has this reference, so it cannot be administered
   through the tooling available here either.

Neither is a fault in the project. They mean the migration in §5 has to be run
by someone with access — through the Supabase SQL editor is simplest — and the
first real test has to happen from a machine that can reach it.

## 5b. Verify row-level security BEFORE a real intake

The publishable key `sb_publishable_…` is committed in `src/lib/supabase.ts`
and is sent as the `apikey` header by every visitor's browser. That is what a
publishable key is for, and it is normal — but it means **row-level security is
the only thing standing between the public and the `students` table**, and that
table holds the entire application text in its `address` column: date of birth,
identity numbers, next of kin, medical disclosure, references.

This has never been checked, on this project or the previous one, because
nothing here can reach the host.

**The check.** From any machine with network access — a terminal, or the
browser console on the deployed site:

```bash
curl -s "https://bhpsftesricwotkziokd.supabase.co/rest/v1/students?select=id,email&limit=1" \
  -H "apikey: sb_publishable_lQm8dFmj8PnQinSZooQbVg_WAfKJcGS"
```

- Returns `[]` or a permission error → RLS is on and denying anonymous reads. Good.
- Returns rows → **every applicant's record is public right now.** Stop and fix
  it before anyone applies.

**The fix, if it returns rows.** In the Supabase SQL editor:

```sql
alter table students enable row level security;

-- Staff read through the service role, which bypasses RLS by design, so no
-- policy is needed for the two desks. Applicants get exactly their own row.
create policy students_own_row on students
  for select using (auth.uid() = auth_user_id);
```

That policy needs an `auth_user_id` column linking a student row to its auth
account — part of the applicant-accounts work still outstanding. Until that
exists, the safest position is RLS enabled with **no** select policy: the desks
keep working through the service role and nothing is publicly readable.

Run the same check against `documents`, and against any other table added
later. A table created without RLS is readable by default, and that default is
the single most common way a Supabase project leaks.

## 6. Environment variables

| Variable | Needed for | If absent |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Creating the student's auth account on approval | **The approval route refuses with `service-role-key-missing`.** It does not fall back to the anon key — a fallback would update the status and send a welcome email for an account that was never created. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Sending the welcome email | The account is still created and the status still updated. The route returns `emailSent: false` **and returns the generated password**, and the desk shows a warning saying in as many words that the applicant has not been told. An approved applicant who never hears anything is the worst outcome here, so the password is surfaced rather than lost. |
| `SITE_URL` | The portal link in the email | Falls back to `https://iguc.net`. |

The service-role key must be set as a **server-side** variable. It must never
carry the `NEXT_PUBLIC_` prefix: that key bypasses row-level security on every
table, and prefixing it would ship it to every visitor's browser.

## 7. What I could not test

**The pipeline has not been run end to end.** This sandbox cannot open a
connection to `djotoapomhlavxknwsxw.databasepad.com` — the proxy refuses
CONNECT, as it has throughout this project. Everything here compiles and the
site builds, but the following are unverified against a live database:

- that `students` accepts the new columns after the migration;
- that `nextStudentNumber` issues `ICOF202600001` on an empty year and
  increments correctly thereafter;
- that `auth.admin.createUser` succeeds with the service-role key;
- that the status transitions apply, including the `.eq('status', …)` guards;
- that the welcome email renders correctly in a mail client.

Run one application through the whole path on a staging database before using
this for a real intake. The first thing to check is that approving a record
whose status is neither `fee_paid` nor `documents_required` returns
`409 wrong-stage`.

## 8. Still to be decided

- **What the application fee is.** The desk records a reference and an amount
  as free text, because the fee itself is not in the published schedule. The
  miscellaneous fee schedule lists a late *application* fee of 5,000 FCFA but
  no standard application fee.
- **Whether a rejected applicant, or one asked for documents, is emailed.**
  Both record a message and require one, but neither sends anything yet. The
  specification says the applicant receives an email in both cases; that is the
  same route with two more templates and is the next thing to build.
- **Applicant accounts are not yet backed by auth.** `/admissions-portal`
  explains the process, the statuses and the applicant's rights, and sends
  applicants to `/apply`. The account that lets an applicant sign back in to
  save a part-finished form, re-upload documents and watch their own status
  change is designed for but not built.
- **Document upload on request.** `documents_required` is a real status the
  Registrar can set, but there is no applicant-facing upload against it yet.
- **What the application currently records.** Faculty and intake are now
  columns, but the application form does not yet capture faculty as a separate
  field or intake as a structured value — it collects level, field, campus,
  mode and an intended start. Those need mapping before the welcome email can
  quote a real intake rather than the admission year.
- **Who may reverse an approval.** Nothing in the desks can undo one. That is
  probably right, but it means a mistaken approval needs a documented route.
