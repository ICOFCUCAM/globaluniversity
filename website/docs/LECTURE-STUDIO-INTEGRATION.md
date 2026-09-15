# Bringing the Lecture Studio into the academic domain

The University's instruction, September 2026:

> My plan is to integrate all of University academic platform inside the
> globaluniversity architecture. I mean all. That is why I asked it to be
> copied so no part would be left.

and the ruling that governs *how*, given earlier in the same month:

> Architect the LMS as part of the University's academic domain rather than as
> an independent application.

Those two together settle the question this file answers. The Lecture Studio
does not arrive as a guest with its own furniture. Where the University already
has a table, the Studio uses the University's; only what has no equivalent
becomes new.

---

## Why this document exists before any SQL is written

`docs/integration/001_lecture_studio.sql` in the vendored folder creates
**22 tables, every one prefixed `ls_`**, and its own `ls_teaches_course` and
`ls_enrolled_on`. That was the right design for a platform mounting itself
inside *any* university — it assumes nothing about the host and brings
everything.

It is the wrong design for this one, because this University already has nine
of those twenty-two, and two of them exactly.

Landing that file as written would give the University:

- two tables holding a reading's author, year, publisher, ISBN and DOI
- two tables holding a submitted assignment and its mark
- two audit trails
- two certificate registers, each with its own verification code and its own
  public verify page
- two functions answering "does this lecturer teach this course?"

Every one of those is the fault this codebase has already met and written down,
in `oneWordOneCount.test.mjs`:

> Two screens counting the same thing is two percentages, and the one a student
> quotes in an appeal will be whichever is higher.

A second certificate register is that fault applied to credentials, where the
stakes are an employer ringing to check a degree.

---

## The reconciliation, table by table

**NEW** — no equivalent in the University's schema. Becomes a table, named in
the University's convention: no `ls_` prefix, because it is not a guest.

| Vendored | Becomes | Why it has no equivalent |
|---|---|---|
| `ls_lectures` | `lectures` | A lecture is a **taught event** — delivered on a date, by a person, with a recording. `course_lessons` is *published content*. One lecture produces several lessons. |
| `ls_artefacts` | `lecture_artefacts` | The pipeline's output, with the state machine — `absent → queued → running → ready → approved → published` — that makes lecturer review enforceable. Nothing here resembles it. |
| `ls_artefact_versions` | `artefact_versions` | Every earlier body, who wrote it, why. The correction history is the product. |
| `ls_lecture_knowledge` | `lecture_knowledge` | The extraction the Course AI retrieves from. `course_content_search` is a *view over content*; this is derived knowledge, which is a different thing. |
| `ls_study_aids` | `study_aids` | Generated revision material. `course_activities` is **authored by a lecturer and graded**; a study aid is neither. |
| `ls_quiz_attempts` | `study_aid_attempts` | **See the note below — this one nearly went the other way.** |
| `ls_recalls` | `study_recalls` | Spaced repetition state. Nothing here has it. |
| `ls_live_sessions` | `live_sessions` | Live translated delivery. `class_sections` schedules a class; this is what happens inside one. |
| `ls_live_segments` | `live_segments` | |
| `ls_live_carried` | `live_carried` | |
| `ls_jobs` | `processing_jobs` | The queue. |
| `ls_run_costs` | `ai_run_costs` | What each model call cost. |
| `ls_usage` | `ai_usage` | Minutes processed per person per period. |
| `ls_notifications` | `notifications` | The University has `announcements` — seven tables of **broadcast**, with destinations, variants and metrics. It has no **personal inbox**, and "your lecture finished processing" is not an announcement. |

**MERGE** — the University already has this. The Studio uses theirs and the
`ls_` table is not created.

| Vendored | Uses instead | Note |
|---|---|---|
| `ls_readings` | `course_lessons` where `kind = 'reading'` | Near-exact duplicate. 084 already carries `author`, `published_year`, `publisher`, `isbn`, `doi`, `citation`, and `requirement` (`primary`/`secondary`/`recommended`) — richer than `ls_readings.required boolean`. |
| `ls_assignments` | `course_activities` | 085 already has the kind, the brief, the due date, the marks and `submission_types`. |
| `ls_submissions` | `activity_submissions` | 085. Merging these is what keeps one gradebook. |
| `ls_audit` | `audit_logs` | One trail, or an investigation reads the wrong one. |
| `ls_certificates` | `documents` + `document_templates` + `credential_audit_events` | The University **already issues, templates, versions, signs and verifies credentials**, with a second-pair-of-eyes rule on activation. A parallel register would be a credential the Registrar cannot see. |
| `ls_settings` | `institutional_settings` | |
| `ls_teaches_course()` | `teaches_this_course()` | 084. Identical intent. |
| `ls_enrolled_on()` | `is_enrolled_on_course()` | 084. Checked rather than assumed: **both take exactly `('registered', 'completed')`**, so no door moves. But 084's is `security definer` with `set search_path = public` and the vendored one is neither — see below. |
| `tutor_conversations`, `tutor_messages`, `tutor_citations` | 086 already created them | The adapter already reads these. `tutor_messages.refused_reason` already carries the refusal the Course AI produces — this seam is **already joined**. |

**EXTEND** — the University's table gains columns.

| Vendored | Extends | Columns |
|---|---|---|
| `ls_profiles` | `profiles` | `working_language`, `voice_preference`, `audio_speed`, `voice_consent`, `accessibility`, `working_language_history` |

**Count:** 14 new, 9 merged, 1 extended, 2 functions dropped in favour of the
University's, 3 tables already present.

---

## The one that nearly went the wrong way

`ls_quiz_attempts` looks exactly like `activity_submissions`. Both record a
person answering questions and a score out of a total. Merging them is the
obvious move and it is wrong.

`activity_submissions` is **coursework**. It has an answer key it is marked
against (085 put that key in its own table because RLS cannot hide a column), a
marker, a returned date, and it feeds the student's result.

A study-aid quiz is **practice**. The student generated it themselves, they can
take it eleven times, and nobody marks it.

Put them in one table and a student's eleven practice attempts are sitting in
the structure the gradebook reads. Someone would eventually average them.

So they stay apart, and `study_aid_attempts` carries no marker, no answer key
and no return — the absence is the point, and a test should assert it rather
than a comment claiming it.

`ls_progress` versus `lesson_progress` is the same shape of question with the
opposite answer: both record "this person read this thing", nobody is graded on
either, and 087 already built `my_module_progress`, `my_course_progress` and
`course_progress_for_teaching` on top of `lesson_progress` — including the
deliberate omission of `seconds_spent` from what a lecturer sees. Two progress
tables would mean the Studio's screens quietly escape that ruling.

**So `ls_progress` merges into `lesson_progress`**, which gains a nullable
`lecture_id` and the Studio's events. The surveillance ruling then covers the
Studio for free, which is the whole argument for merging.

> **Corrected when 093 was written, by measuring rather than planning.**
> `lesson_progress.lesson_id` is NOT NULL, and once a published artefact *is* a
> `course_lessons` row, the Studio's progress is progress on that lesson.
> **Nothing was added to `lesson_progress` at all** — no `lecture_id`, no new
> events. The merge is cleaner than this paragraph expected.
>
> The cost, stated rather than discovered later: material in somebody's
> **personal** library has no lesson and so no progress record. That is the
> right answer anyway — there is no cohort, no lecturer and nobody to report
> to, and a personal library that tracked its owner would be surveillance with
> an audience of one.

---

## Merging the two predicates fixes a latent fault, rather than just tidying

The vendored `ls_enrolled_on` and `ls_teaches_course` are plain `stable`
functions. The University's are `security definer` with `set search_path`.

That is not a stylistic difference. A policy on `lecture_artefacts` that calls a
non-definer predicate has the predicate's own subquery on `enrollments` and
`students` filtered by *those* tables' policies — so the clause can be
unreachable, and the artefact is refused to a student who is genuinely enrolled.

This codebase has already met that exact fault once: 084's `course_lessons_read`
had a subquery on `course_modules` that was itself filtered by the module
policy, which is why `module_is_open()` and `activity_is_open()` were introduced
as security definer in the first place.

So the merge is not only "one function instead of two". It is the one that
works instead of the one that was never run.

## What this does not decide

- **`lectures` and `course_lessons` are related and the relation is not yet
  drawn.** A published artefact should probably also appear as a
  `course_lessons` row so the existing Learning Hub screens see it — the
  vendored `INTEGRATION.md` suggests exactly this for notes. Which artefacts
  become lessons, and whether the lesson is the artefact or points at it, is a
  design decision for the migration and is called out here so it is made rather
  than defaulted into.
- **RLS has to mirror `src/lib/domain/ownership.ts` policy for policy**, or the
  database is more permissive than the product. That file is the specification
  for the policies in 092.
- **`001_lecture_studio.sql` is not moved into `docs/migrations/`.** It has
  never been run against any database. It is a source to work from, and it
  stays where it is until the University's own process — renumber, bundle,
  prove twice, prove again against `as-the-university-has-it.sql`, add a probe,
  hand it over — has been done.

---

## Where the schema stands

**Done.** All 22 vendored tables are accounted for, across three migrations:

| | |
|---|---|
| **092** | `lectures`, `lecture_artefacts`, `artefact_versions`, `lecture_knowledge` — and the ownership line: an office reads published material, never a draft, and cannot delete a recording |
| **093** | `study_aids`, `study_aid_attempts`, `study_recalls`, `processing_jobs`, `ai_run_costs`, `ai_usage`, `notifications`, six columns on `profiles` — and **publishing writes a `course_lessons` row**, so the Learning Hub shows what the Studio made |
| **094** | `live_sessions`, `live_segments`, `live_carried` — live delivery, which is the one place a student reads unapproved words on purpose |

Merged into what the University already had, and so never created: `ls_readings`
→ `course_lessons`, `ls_assignments` → `course_activities`, `ls_submissions` →
`activity_submissions`, `ls_progress` → `lesson_progress`, `ls_audit` →
`audit_logs`, `ls_certificates` → the credential machinery, `ls_settings` →
`institutional_settings`, `ls_profiles` → `profiles`, and both predicates →
084's.

**The one open question is still open**, and it is a ruling, not a defect:
092's header asks whether an office of the University — the Superadministrator
included — should be able to read a lecturer's unpublished draft. It currently
cannot, following `ownership.ts`. Changing it is one policy.

**What has NOT been done:** none of this is reachable from any screen, and
`getStore()` still returns the in-memory store on every call. That is Phase 3.
