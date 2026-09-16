# The National Rector Programme, mapped against the system

The University supplied the National Rector & National Administration Programme
on 16 September 2026 and asked: *"map this out and show me what you have map and
how it is integrated to the ICOF Global University System."*

This is that map. Everything in it was read out of the repository — 150 tables,
96 migrations, 23 roles — rather than recalled. There is a rendered version of
the same map alongside this file.

---

## The finding

**Six of the eleven sections are already built and working.** Every one of them
is built University-wide, and the system has no idea that nations exist.

There is no `national_administrations` table, no `administration_id` on any row,
and no role scoped to a country. Across the whole schema the only trace of a
country is `nationality`, which appears three times and is a fact about a
*student*, not an operating unit.

So a Registrar is the Registrar of the University, not of Uganda. A finance
officer sees every payment the University has ever taken.

**That is the seam, and it is one seam rather than eleven.**

---

## The eleven sections

| # | In the programme | Status | What the system actually has |
|---|---|---|---|
| 1 | The National Rector | **Not built** | 23 roles in `roles.ts`; none is a National Rector and none is scoped to anywhere. But the delegation machinery exists: `capability_grants` (056) records who granted what to whom, when, with expiry and revocation, and Studio Control is a working screen over it. |
| 2 | Recruitment & enrolment | **Built** | `admission_openings`, `admission_decisions`, `admission_letters`, `admission_audit_log`, `students`, `enrollments`. The Director of Academic Affairs takes the academic decision; Finance is a gate, not an authority. Nothing records which nation brought a student in. |
| 3 | Staff recommendation | **Built** | `appointments` → `appointment_letters` → `appointment_acceptances`, over `positions`, `position_profiles` and `appointment_condition_sets`. 041 already refuses an approval by whoever drafted it — the recommend-and-verify split the programme describes is enforced in the database. |
| 4 | Tuition & revenue model | **Half built** | Charging works: `fee_schedules`, `fee_items`, `student_fee_assessments`, `payments`, `receipt_counters`, `financial_clearances`. Sharing the money does not exist at all — no allocation, no split, no remittance, no national account. The word "revenue" appears nowhere in the schema. |
| 5 | National Financial Secretary | **Not built** | `finance` and `finance-director` roles and a clearance step exist, but there is no national ledger and nothing to be a secretary *of*. Follows section 4; cannot precede it. |
| 6 | Your own ICOF office | **Shell only** | The workspace is real — `portalNav.tsx` builds a sidebar per role, `AppLayout` draws the screens. What a Rector would see is the whole University. The dashboard is the scoping question wearing a different hat. |
| 7 | Rector as senior academic | **Built** | The Academic Studio: `lectures`, `lecture_artefacts`, `course_lessons`, `live_sessions`, and 095's rule that the University accepts a submission before any model runs on it. |
| 8 | One lecture, many languages | **Built** | The most complete section of the eleven. `studio-ai-translate`, a course's `offeredLanguages`, a person's `working_language`, voice consent, and `request-translation`/`approve-translation` as separate acts. "The AI must not silently rewrite the lecturer's terminology" is already a rule the database enforces. |
| 9 | One academic standard | **Built** | The Vice-Chancellor approves a curriculum (058); results move submit → moderate → approve → publish with no step skippable; credentials issue from an immutable archive; 056 governs what an office may not even see. |
| 10 | A worldwide network | **Presentational** | `universityPlaces.json` holds five nations and online delivery and the public site draws them on a map. It is a picture of where the University teaches — it governs nothing, and no student, payment or member of staff is attached to any of it. |
| 11 | Not a branch campus | **Already honoured** | `universityPlaces.json` separates a campus from a centre from an in-country presence and says so: "Nigeria is a professional development and research centre, not a teaching campus." Section 11 is the policy that file was already written to. |

---

## Where the seam falls

**Central — what ICOF keeps.** Built, enforced, and already the authority the
model depends on: `programmes`, `programme_versions`, `curriculum_entries`,
`academic_approvals`, `results`, `grading_scales`, `credentials_issued`,
`credential_templates`, `examinations`, `students`, `document_templates`.

**The nation — what does not exist.** `national_administrations`,
`administration_id`, a `national-rector` role, `national_revenue_agreements`,
`revenue_allocations`, a national ledger. Every one absent.

**National — what a Rector would lead.** All built, all University-wide:
`admission_openings`, `admission_decisions`, `enrollments`, `appointments`,
`positions`, `staff_records`, `payments`, `student_fee_assessments`, `lectures`,
`live_sessions`, `correspondence`, `announcements`. These are the tables that
would carry the nation, once there is a nation to carry.

---

## What integration takes

In this order. Each step is small; the order is not negotiable.

1. **A nation becomes a thing the database knows about.** One table —
   `national_administrations`: the country, its name, its status, its Rector,
   the agreement it operates under. Until this row exists nothing else here can
   be written.

2. **Rows learn which nation they belong to.** An `administration_id` on
   students, applications, appointments, payments, fee assessments,
   correspondence. Nullable at first, so the University's existing records stay
   exactly as they are and nothing that works today stops working.

3. **The scoping is row-level, so it belongs in row-level security.** This
   codebase's own rule: a policy decides about a *row*. "A Rector sees their own
   nation's students" is a row question, and RLS is the right instrument — which
   also means a forgotten screen cannot leak another country's data, because the
   refusal is in the database and not in the page.

4. **Then the money, and only then.** A revenue agreement per administration, an
   allocation written when a payment lands, and a national ledger the Financial
   Secretary reconciles. Sections 4 and 5 are one piece of work and the largest
   single item on this list.

5. **The dashboard falls out of the other four.** Once rows know their nation and
   RLS enforces it, the Rector's dashboard is the existing screens asking the
   same questions and getting a smaller answer. The cheapest step, not the first.

---

## The agreement already has machinery

The programme's closing recommendation — a National Rector Agreement fixing
revenue, appointment powers, degree authority, records, banking, taxation,
termination and data protection — does not need to be built from nothing.

Migration 078 created **Conditions of Appointment**: eight condition sets
covering all forty-three posts, carrying the twenty-odd clauses a letter of
appointment states — duration, probation, remuneration, confidentiality,
intellectual property, termination. There is a screen for editing them and they
attach to a post.

**A National Rector Agreement is a condition set for a new post.** That is a
day's work on top of machinery that already exists, not a new system.

---

## What this map is not

It is not a plan and nothing here has been built. It is an account of where the
programme and the system currently stand in relation to each other, so that the
decision about what to build next is taken against facts rather than against an
impression.
