# The ICOF Global University system, audited

Generated on 16 September 2026 by `npm run audit`. Nothing in it is written by hand:
every figure is read from the repository, so this document can be produced
again at any time and will describe the system as it is then.

**214 tables and views · 105 migrations · 25 roles · 129 capabilities · 600 source files.**

---

## 0. What this audit cannot see — and it is the biggest item

**Which migrations the University has actually run.** This sandbox cannot reach
their Supabase project, so every statement below about the database describes
what the REPOSITORY defines, not what is live.

105 migrations exist. 8 bundles are prepared for
running: RUN-PART-1.sql, RUN-PART-2.sql, RUN-PART-3.sql, RUN-PART-4.sql, RUN-PART-5.sql, RUN-PART-6.sql, RUN-PART-7.sql, RUN-PART-8.sql.

This matters more than any other line in this document. Every screen, route and
rule described below assumes tables that may not exist yet, and a system whose
code is ahead of its database fails at the moment somebody uses it rather than
at the moment it is deployed.

**There are two instruments for closing this and neither has been run against
the live database:**

- `docs/migrations/ARE-THEY-ALL-IN.sql` — paste into the Supabase SQL editor and
  it returns one row per migration saying YES or NO. It changes nothing.
- The Readiness panel in Credentials, which reads the same probes from inside the
  portal and reports what is outstanding.

Until one of them is run, everything below is an audit of the plans.

---

## 1. No door — machinery nothing can reach

### 38 tables and views are named nowhere in the application

Each was created by a migration, is protected by row-level security, and is read
by no screen and no route. Grouped by the migration that created them, because
the groups have different answers.

| Migration | Objects | What it means |
|---|---|---|
| 013 | `social_post_metrics` | A helper view nothing has needed yet. |
| 015 | `exam_device_checks`, `exam_identity_checks`, `exam_recordings`, `exam_reports`, `examination_officers` | The proctoring half of the examination system. The exam screens exist; identity checks, device checks, recordings and reports have no interface. |
| 016 | `exam_sessions_mine` | A student-facing examination view with no screen reading it. |
| 019 | `academic_honours`, `academic_policy`, `academic_standing_events` | Academic policy, honours and standing events — the rules a faculty applies, with no screen to set or read them. |
| 024 | `admission_states`, `student_number_counters` | Admission state machinery and the student-number counter, used by the database rather than by a screen. |
| 039 | `announcement_engagement`, `announcement_metrics` | A helper view nothing has needed yet. |
| 043 | `appointment_letters_unverifiable` | A helper view nothing has needed yet. |
| 044 | `appointment_letters_outbox` | A helper view nothing has needed yet. |
| 047 | `appointment_remuneration` | A helper view nothing has needed yet. |
| 048 | `position_profiles_unapproved` | A helper view nothing has needed yet. |
| 050 | `appointments_awaiting_acceptance` | A helper view nothing has needed yet. |
| 057 | `programme_in_force` | A helper view nothing has needed yet. |
| 069 | `graduation_cohort` | A helper view nothing has needed yet. |
| 070 | `my_classes` | A helper view nothing has needed yet. |
| 075 | `financial_clearance_now` | A helper view nothing has needed yet. |
| 084 | `course_bookmarks`, `course_modules`, `student_notes` | The Course Learning Hub. The data model was landed ahead of its screens deliberately, so they could be built against something proved. |
| 085 | `activity_options`, `activity_questions`, `class_attendance`, `discussion_posts`, `submission_answers` | The Course Learning Hub — activities, answers, discussion and attendance. |
| 086 | `course_content_search`, `my_attendance`, `my_next_classes` | The Course Learning Hub — a student’s own classes, attendance and search. |
| 087 | `course_progress_for_teaching`, `my_course_progress` | The Course Learning Hub — progress, for a student and for whoever teaches them. |
| 088 | `lecturer_directory` | The lecturer directory. |
| 102 | `refunds_that_touch_a_nations_share` | A helper view nothing has needed yet. |

**None of these should be deleted.** The University ruled on that when the
question was last asked, and re-reading them confirms it: every one is a valid
domain object, and the two in capitals are machinery this repository built and
left no way to reach.

### 16 capabilities are checked nowhere

A capability that no route and no screen asks for is a permission the University
grants and cannot exercise. Granting one to a new role would change nothing.

- `apply`
- `approve-transfers`
- `assign-proctor`
- `download-transcript`
- `export-data`
- `maintenance-mode`
- `manage-academic-session`
- `manage-hostel`
- `manage-student-welfare`
- `monitor-teaching`
- `pay-fees`
- `reset-user-password`
- `upload-documents`
- `view-all-faculties`
- `view-institutional-finance`
- `view-results`

### Roles served no screen at all

- **Applicant** (`applicant`)

An applicant is turned away from the student portal on purpose — it is for
enrolled students, and there are no application forms in it. Worth naming all the
same, because the role still holds capabilities it therefore cannot exercise here.

---

## 2. Two answers — the same fact stated twice

### The Academic Studio is a second application inside this one

`src/academic` holds 87 files, including its own capability list.
29 capabilities exist there and not in `roles.ts`:

`manage-faculties`, `assign-lecturers`, `manage-enrolment`, `manage-people`, `upload-source-material`, `run-transformation`, `correct-derived-text`, `approve-artefact`, `publish-to-students`, `withdraw-own-material`, `export-own-material`, `request-translation`, `approve-translation`, `set-reading`, `set-assignment`, `mark-assignment`, `submit-assignment`, `issue-certificate`, `view-engagement`, `study-published-material`, `ask-course-ai`, `set-working-language`, `authorise-own-voice`, `registry`, `coordinator`, `lecturer`, `assistant`, `translation-reviewer`, `student`

Two capability vocabularies means a permission can be granted in one and be
unknown to the other. The System Handbook reads both, which is a workaround and
not a fix.

---

## 3. What is already guarded, and by what

This system tests itself more than most, and the audit should say so as plainly
as it says where the gaps are. These run on `npm test` and fail the build:

| Instrument | What it refuses |
|---|---|
| `reachability.test.mjs` | A route no screen calls; a table read by code nothing can write to |
| `portalCoverage.test.mjs` | A capability enforced nowhere, unless the gap is named with a reason |
| `migrationProbes.test.mjs` | A migration with nothing the Readiness panel can look for |
| `bundles.test.mjs` | A bundle that does not apply to a database built from the previous commit |
| `schemaContract.test.mjs` | A column the SQL claims and does not create |
| `handbook.test.mjs` | A handbook that has drifted from the capability matrix |
| `myRecordIsMine.test.mjs` | A "my" screen that reads one row without saying whose |
| `theCertificateSampleIsRestricted.test.mjs` | The certificate design reaching any office but two |
| `transcriptAuthority.test.mjs` | A transcript issued to somebody not in the register |

Every migration proves its own rules in SQL and rolls back, so the rules in Part
VIII of the handbook are a list of things that have been watched to refuse.

