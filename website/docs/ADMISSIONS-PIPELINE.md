# Admissions pipeline — how an application becomes a student

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
        ├─ Decline → status 'declined', reason recorded, no account created
        └─ Approve → account created on the programme chosen at application
                     tailored welcome email sent with matric no, username,
                     password and a welcome into that programme
                     status 'approved'
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

## 3. Self-signup has been removed from the portal

**A student cannot create their own account.** The sign-up tab, the sign-up
form and the `handleSignup` handler are deleted from `LoginScreen.tsx`, not
hidden behind a flag. In their place the login card carries a short note
directing applicants to `/apply`.

This follows from the specification rather than being a separate decision: if
an applicant can create an account themselves, they bypass both the fee gate
and the Registrar's examination, which are the only two controls in the
process.

`signup()` remains in `AuthContext` and is now unused by any UI. It was left in
place rather than deleted so that reinstating a sign-up route is a deliberate
act, but nothing calls it.

## 4. Two new roles

`UserRole` gains `finance` and `registrar`. They are separate roles rather than
flavours of `admin` because the control this process depends on is that the
desk registering the fee is **not** the desk that admits the student. `admin`
sees both desks; `finance` sees only its own; `registrar` sees its own and the
student register.

## 5. Database migration — MUST BE RUN BEFORE THE DESKS WORK

The pipeline adds columns to `students`. Run this against the project database:

```sql
alter table students
  add column if not exists fee_reference      text,
  add column if not exists fee_amount         text,
  add column if not exists fee_registered_by  uuid,
  add column if not exists fee_registered_at  timestamptz,
  add column if not exists decision_reason    text,
  add column if not exists decided_by         uuid,
  add column if not exists decided_at         timestamptz,
  add column if not exists account_created_at timestamptz;

-- The two queues are read on every page load of the desks.
create index if not exists students_status_created_idx
  on students (status, created_at);
```

The list is also held in code as `requiredColumns` in `src/lib/admissions.ts`,
so the migration and the code that depends on it cannot drift apart.

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

- that `students` accepts the eight new columns after the migration;
- that `auth.admin.createUser` succeeds with the service-role key;
- that the status transitions apply, including the `.eq('status', …)` guards;
- that the welcome email renders correctly in a mail client.

Run one application through the whole path on a staging database before using
this for a real intake. The first thing to check is that approving a record
whose status is not `fee_paid` returns `409 wrong-stage`.

## 8. Still to be decided

- **What the application fee is.** The desk records a reference and an amount
  as free text, because the fee itself is not in the published schedule. The
  miscellaneous fee schedule lists a late *application* fee of 5,000 FCFA but
  no standard application fee.
- **Whether a declined applicant is emailed.** Decline records a reason and
  requires one, but sends nothing. If applicants should be told, say so and I
  will add it — it is the same route with a different template.
- **Matriculation numbers.** The application currently generates an
  application number and reuses it as `matric_no`. Whether an approved student
  should receive a new, properly formatted matriculation number at approval is
  a decision for the Registrar.
- **Who may reverse an approval.** Nothing in the desks can undo one. That is
  probably right, but it means a mistaken approval needs a documented route.
