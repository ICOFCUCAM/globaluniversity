# The National Rector Programme, mapped against the system

The University supplied the National Rector & National Administration Programme
on 16 September 2026 and asked: *"map this out and show me what you have map and
how it is integrated to the ICOF Global University System."*

This is that map, regenerated on 16 September 2026.

**Nothing in it was written by hand.** `scripts/build-programme-map.mjs` reads
100 migrations, 141 tables, 25 roles and
130 capabilities, looks for every artefact each section
claims, and counts the verdict from what it finds. A section cannot be reported
as built while something it depends on is absent, and it cannot go stale,
because it is not a description — it is a query. Run the script again and the
map is true again.

---

## The finding

**Eight of the eleven sections are built and enforced, three are part built.**

The first version of this map, a day before the work started, found six sections
built and every one of them built University-wide: no `national_administrations`
table, no `administration_id` on any row, no role scoped to a country. That was
one seam rather than eleven, and it has been closed.

A nation is now a row. Rows know which nation they belong to. The scoping is
row-level security rather than a screen's good manners, so a page nobody
remembered to guard cannot leak another country's data. The money is split when
it lands, by a trigger, and an administration cannot spend what it was not
allocated.

**Every artefact claimed below was found in the repository.**

---

## The eleven sections

| # | In the programme | Status | What the system has |
|---|---|---|---|
| 1 | **The National Rector** | Built | The role sits below the central offices — the University’s academic authority is not the Rector’s — and above a Dean, because a Rector leads an administration and a Dean leads a faculty within one. Which nation is a row in the register, not a property of the role: the role says what kind of authority, the register says where. 097 refuses to record an administration as established without the agreement it operates under, and refuses whoever creates it to be its own Rector. |
| 2 | **Recruitment & enrolment** | Part built | The admissions pipeline was already built University-wide. 097 attached a nation to a student and made the scoping a row-level rule rather than a screen’s good manners, so a forgotten page cannot leak another country’s applicants. A record may be born into a nation — that is how a Rector recruits — but only into the Rector’s own, and moving a record between nations is the University’s act. |
| 3 | **Staff recommendation** | Built | “The National Rector recommends. ICOF University verifies and appoints.” The capability stops deliberately short of drafting an appointment, and 099 refuses in the database a recommendation decided by whoever made it — the same rule 041 already applied to approvals. |
| 4 | **Tuition & revenue model** | Built | The split is written WHEN THE PAYMENT LANDS, by a trigger, not calculated by a screen when somebody asks — so the ledger is a record of what happened rather than an opinion formed later. An allocation is never rewritten, the parts must add up to the gross, and an agreement cannot be approved by the Rector it pays. |
| 5 | **National Financial Secretary** | Built | A separate role rather than `finance` with a nation attached, because the programme asks for financial authority to be separated from the Rector’s and two people cannot be separated while they share a role. The Secretary records; the Rector authorises; neither can do both on the same expense; and an administration cannot authorise more than it was allocated. |
| 6 | **Your own ICOF office** | Built | The dashboard was always the scoping question wearing a different hat, so it fell out of the other five rather than being built: the same screens ask the same questions and row-level security returns a smaller answer. |
| 7 | **Rector as senior academic** | Built | Neither national office is an academic role. A Rector who also teaches is granted the teaching capabilities through `capability_grants` — governed, audited and with an expiry — because the programme makes it conditional. A condition is a grant, not a role. |
| 8 | **One lecture, many languages** | Part built | Requesting a translation and approving one are separate acts held by different people, so “the AI must not silently rewrite the lecturer’s terminology” is a rule the system enforces rather than a hope. |
| 9 | **One academic standard** | Built | None of this was delegated. The Vice-Chancellor approves a curriculum; results move submit → moderate → approve → publish with no step skippable; credentials issue from an immutable archive. `governs_the_university()` is the line between what a nation may do and what only the centre may. |
| 10 | **A worldwide network** | Part built | `universityPlaces.json` is the public picture — five nations and online delivery, drawn on the homepage map. `national_administrations` is the governing register. Both are correct and they are separate things. |
| 11 | **Not a branch campus** | Built | `universityPlaces.json` already separated a campus from a centre from an in-country presence and said so in as many words. 097 put the same distinction in the database: an administration operates under an agreement with the University, its Rector holds a University appointment, and its students are the University’s students. |

---

## The evidence, artefact by artefact

**1. The National Rector** — Built

`national-rector`, `lead-national-administration`, `establish-national-administration`, `national_administrations`, `my_administration`, `serves_a_national_administration`, `governs_the_university`, `national_administration_creator_is_not_the_rector`, `national-administrations`, `src/components/national/NationalAdministrations.tsx`, `src/app/api/national/administration/route.ts`

**2. Recruitment & enrolment** — Part built

`admission_openings`, `admission_decisions`, `admission_letters`, `students`, `enrollments`, `students.administration_id`, `students_national_read`, `administration_is_the_centres_to_set`, `view-national-students`

**3. Staff recommendation** — Built

`appointments`, `appointment_letters`, `appointment_acceptances`, `national_staff_recommendations`, `a_recommendation_is_somebody_elses_decision`, `recommend-national-staff`, `national-staff`, `src/components/national/NationalStaff.tsx`, `src/app/api/national/staff/route.ts`

**4. Tuition & revenue model** — Built

`fee_schedules`, `student_fee_assessments`, `payments`, `national_revenue_agreements`, `revenue_allocations`, `allocate_a_payment`, `is_registration_money`, `an_agreement_is_not_approved_by_its_rector`, `an_allocation_is_never_rewritten`, `national_ledger`, `revenue_allocation_adds_up`

**5. National Financial Secretary** — Built

`national-financial-secretary`, `administer-national-finance`, `view-national-finance`, `national_expenses`, `a_nation_spends_what_it_kept`, `national_expense_recorder_is_not_the_authoriser`, `national_purse`, `national-finance`, `src/components/national/NationalFinance.tsx`, `src/app/api/national/expense/route.ts`

**6. Your own ICOF office** — Built

`national-rectorate`, `src/components/national/NationalRectorate.tsx`, `lead-national-administration`, `national_purse`, `national_ledger`

**7. Rector as senior academic** — Built

`lectures`, `lecture_artefacts`, `course_lessons`, `live_sessions`, `capability_grants`

**8. One lecture, many languages** — Part built

`lectures`, `live_sessions`, `studio-ai-translate`, `request-translation`, `approve-translation`

**9. One academic standard** — Built

`programmes`, `programme_versions`, `curriculum_entries`, `academic_approvals`, `results`, `grading_scales`, `credentials_issued`, `credential_templates`, `governs_the_university`

**10. A worldwide network** — Part built

`src/content/universityPlaces.json`, `national_administrations`

**11. Not a branch campus** — Built

`src/content/universityPlaces.json`, `national_administrations`, `national_administration_established_has_an_agreement`

---

## What is still open

- **§2 Recruitment & enrolment.** No admissions screen sets `administration_id`, so a student admitted today belongs to no nation and the central view is unchanged. Deliberate — nothing that works stops working — but it means the nation is currently attached by hand.
- **§8 One lecture, many languages.** `request-translation` and `approve-translation` are enforced, but they live in the Academic Studio’s own capability list rather than in `roles.ts`. Two vocabularies means a capability can be granted in one and unknown to the other; retiring the vendored folder is what closes it.
- **§10 A worldwide network.** The two lists of countries are not joined. A nation can be established in the register without appearing on the public map, and the map can name a country with no administration behind it. Nothing reconciles them.

These are the gaps the sections declare, and each one is a question this script
asks the repository rather than a note somebody left. When the answer changes
the gap disappears from this list without anybody editing it.

---

## Where the line falls now

**The centre keeps** — and none of it was delegated: `programmes`,
`programme_versions`, `curriculum_entries`, `academic_approvals`,
`results`, `grading_scales`, `credentials_issued`, `credential_templates`,
`examinations`, `document_templates`. `governs_the_university()` is that
line, written once and called from every policy that needs it.

**The nation now holds** — created by 097, 098 and 099:
`national_administrations`, `national_revenue_agreements`,
`revenue_allocations`, `national_staff_recommendations`,
`national_expenses`, and the two views the offices read,
`national_ledger` and `national_purse`.

**The nation now reaches** — existing University-wide tables that carry an
`administration_id` and a national read policy: `students`, `profiles`,
`appointments`, `staff_records`, `payments`, `student_fee_assessments`,
`correspondence`.

---

## The agreement

The programme's closing recommendation — a National Rector Agreement fixing
revenue, appointment powers, degree authority, records, banking, taxation,
termination and data protection — still has its machinery waiting rather than
built. 078's **Conditions of Appointment** carry the twenty-odd clauses a letter
of appointment states, there is a screen for editing them, and they attach to a
post. A National Rector Agreement is a condition set for the national post.

097 already refuses to record an administration as *established* without an
`agreement_reference`, so the database is asking for the document. Nothing yet
produces it.

---

## How to regenerate this

```
cd website
node scripts/build-programme-map.mjs
```

It writes this file and `NATIONAL-RECTOR-PROGRAMME-MAP.html` beside it, and
exits non-zero if a section claims an artefact the repository does not have.
