# The tables no screen reads, classified

The University, September 2026:

> I would not immediately delete or expose those tables. This is exactly where
> Claude needs to distinguish between **A. Orphaned/obsolete tables** and
> **B. Valid domain tables with no UI yet**. So tell Claude to classify those
> tables rather than automatically removing them.

Twenty-four tables and views are referenced nowhere in `src/`. Each was opened
and read before being classified.

**None of them is orphaned. Nothing here should be deleted.**

A third category turned out to be needed, because two of these are waiting on
the University rather than on code.

---

## A — Orphaned or obsolete

**Empty.**

The one thing that looked orphaned is not a table at all: `LMSModule.tsx` is
imported by `AppLayout` and never rendered. That is dead *code*, and its removal
is a deletion of a component, not of anything in the database.

---

## B — Valid domain objects awaiting an interface

### B1. Built this week, deliberately ahead of their screens (084–088)

The Course Learning Hub's data model was landed first so the screens could be
built against something proved. These are protected, tested, and reachable from
nothing *yet* — which is a schedule, not a fault.

| Object | Mig | What it holds |
|---|---|---|
| `course_modules` | 084 | The spine of a course |
| `student_notes` | 084 | Private notes and highlights |
| `course_bookmarks` | 084 | A student's own bookmarks |
| `course_activities` | 085 | Assignments, quizzes, knowledge checks, discussions, reflections |
| `activity_questions` | 085 | Questions within an activity |
| `activity_options` | 085 | What a student may choose — **no answer** |
| `activity_submissions` | 085 | Handed-in work, marks, feedback |
| `submission_answers` | 085 | One student's answers |
| `discussion_posts` | 085 | Course discussion |
| `class_attendance` | 085 | The register |
| `tutor_conversations` | 086 | Course AI Tutor, dark until a key is added |
| `tutor_messages` | 086 | …and what was asked and refused |
| `course_content_search` | 086 | Searching a course, transcripts included |
| `my_next_classes` | 086 | Timetable joined to the LMS lesson |
| `my_attendance` | 086 | A student's own attendance figure |
| `my_course_progress` | 087 | Progress counted from work done |
| `course_progress_for_teaching` | 087 | What a lecturer may see — no `seconds_spent` |

### B2. Older, and genuinely useful the day something reads them

| Object | Mig | What it holds | Note |
|---|---|---|---|
| `my_classes` | 070 | A student's timetable, enrolment-scoped | **Actively duplicated.** `TimetableModule` reads the JSON blob store instead. This view is the correct answer sitting unused beside the wrong one. |
| `financial_clearance_now` | 075 | The clearance standing now, per student and purpose | The admissions gate reads `financial_clearances` directly; this view is the tidier answer to "is this student cleared". |
| `academic_honours` | 019 | Distinctions and prizes on a record | Nothing awards one yet. The column set is right. |
| `academic_standing_events` | 019 | Every change of standing, with the CGPA at the time | Immutable by trigger. Written by 019's own function; no screen shows the history. |
| `announcement_engagement` | 039 | Reach per destination, per metric | Publishing records it; nothing reports on it. |

`lecturer_directory` (088) belongs here too — it was created hours ago as the
public replacement for the closed `lecturers` table, and the public staff page
should be pointed at it.

---

## C — Waiting on a University ruling, not on code

### `academic_policy` (019)

This is the one worth reading twice. It holds the University's **own confirmed
rulings** on progression:

| Column | Meaning |
|---|---|
| `repeat_rule` | How a repeated course counts |
| `repeat_rule_confirmed` | Whether the University has actually said |
| `standing_warning_below` | The CGPA at which a student is warned |
| `standing_probation_below` | The CGPA at which a student goes on probation |
| `hold_on_fee_balance` | Whether a fee balance blocks registration |
| `ruled_on`, `ruled_by` | Who decided, and when |

Nothing reads it. 019's own header explains why, and it is not an oversight:

> *the University has not ruled yet, so `academic_policy.repeat_rule` is NULL and
> every attempt counts*

So the table is doing its job — **recording that no ruling exists** — and
`repeat_rule_confirmed` / `standing_confirmed` are there so nobody mistakes a
default for a decision.

**The thing to notice:** `students.academic_standing` is *displayed* on the
Academic Records screen and *printed on transcripts*, while the thresholds that
would determine it are unread. A standing appears on an official document with
no rule behind it.

That has the same shape as the finding that started this audit — a policy on
`payments` that existed while row-level security was switched off. A rule
recorded and never consulted.

**This needs a decision, not a migration.** The four questions are exactly the
column names above.
