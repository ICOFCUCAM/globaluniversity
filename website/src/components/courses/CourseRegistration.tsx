'use client';

// ---------------------------------------------------------------------------
// COURSE REGISTRATION — the screen the system has never had.
//
// ---------------------------------------------------------------------------
// WHAT WAS MISSING
// ---------------------------------------------------------------------------
//
// `enrollments` has existed since migration 001. The results pipeline reads it
// to build a mark sheet, the GPA engine reads it to weight a transcript, and
// the graduation audit reads it to decide whether somebody may be awarded a
// degree. Nothing had ever written a row into it, so all three read a table
// that could only be empty and a student could not be put on a course at all.
//
// `src/lib/prerequisites.ts` has held the eligibility rule for as long, saying
// in its own header that it was published before the screen existed on purpose
// — the alternative being a screen shipped with the rule inlined and untested.
// This is that screen; the rule is applied by the route, not restated here.
//
// ---------------------------------------------------------------------------
// EVERY COURSE CARRIES ITS OWN VERDICT
// ---------------------------------------------------------------------------
//
// A list that shows everything and refuses half of it on submission teaches
// people to submit and see. So the reason a course cannot be taken is printed
// beside the course, before anything is chosen — "You must first pass MIN 101
// Introduction to Christian Ministry" rather than "prerequisites not met".
//
// ---------------------------------------------------------------------------
// ONE SCREEN, TWO READERS
// ---------------------------------------------------------------------------
//
// A student registers themselves. The Registry registers anybody, and the row
// records which of the two it was — those are answerable in different
// directions. The route enforces it; this screen only offers the student
// picker to the people who may use it.
//
// ---------------------------------------------------------------------------
// AND IT REGISTERS AGAINST AN OFFERING, NOT AGAINST A COURSE
// ---------------------------------------------------------------------------
//
// The University drew the distinction: a COURSE is what the catalogue
// describes; an OFFERING is that course running in a named term with a named
// lecturer and a ceiling; a CLASS meets at an hour in a room.
//
// Until 063 this screen registered against the idea of a course. It could not
// say who teaches it, when it meets, or whether there was a place left — and
// a course with twenty seats took two hundred registrations without a murmur.
//
// Now each course carries what it is this term: the lecturer, the hours, and
// how many places remain. FIVE NEW ANSWERS that had nowhere to live before —
// not offered this term, not open yet, closed, cancelled, full — and each of
// them sits beside the course, in a sentence, before anything is chosen.
//
// A TERM NOBODY HAS SET UP YET does not close the door. Where a term has no
// offerings at all the whole catalogue is shown, and the screen says why the
// lecturer and the hours are missing rather than leaving the reader to guess.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { within } from '@/components/academic/ProgrammeRegister';
// ONE DEFINITION OF WHAT AN OFFERING IS, shared with the route that sends it.
// A second copy here would drift the first time a field was added, and the
// screen would silently stop reading something the route was still sending.
import type { OfferedClass, OfferingFacts } from '@/lib/courseOffering';
import { BTN_PRIMARY, BTN_GHOST, INPUT, LABEL, FOCUS } from '@/lib/portalTheme';
import {
  Loader2, Check, AlertTriangle, BookOpen, X, Search, Clock, User, Info,
} from 'lucide-react';

interface Offered {
  id: string;
  code: string;
  title: string;
  creditUnit: number;
  semester: number | null;
  year: number | null;
  eligible: boolean;
  // ELIGIBILITY AND AVAILABILITY ARE TWO DIFFERENT QUESTIONS. A student
  // refused because a class is full has met every academic condition, and
  // telling them "you are not eligible" sends them to the wrong office.
  meetsPrerequisites: boolean;
  unavailable: string | null;
  offering: OfferingFacts | null;
  reasons: string[];
  missing: string[];
  alreadyRegistered: boolean;
  enrollmentId: string | null;
}

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');

/** 'Monday 09:00–11:00', or the plain truth that it meets at no stated hour. */
function whenIsIt(classes: OfferedClass[]): string {
  const timed = classes.filter((c) => c.dayOfWeek !== null);
  if (timed.length === 0) return 'No hours set';
  return timed
    .map((c) => `${DAYS[c.dayOfWeek as number]} ${hhmm(c.startsAt)}–${hhmm(c.endsAt)}`)
    .join(' · ');
}

interface Student {
  id: string;
  first_name: string | null;
  last_name: string | null;
  matric_no: string | null;
}

const STUDENTS = 'id, first_name, last_name, matric_no';

/**
 * THE TERM A REGISTRATION DEFAULTS TO, ASKED OF THE CALENDAR.
 *
 * This used to be
 *
 *     const thisYear = () => new Date().getFullYear();
 *
 * which is the CALENDAR year, and the University's academic year is not. On
 * the western calendar it runs 15 August to 14 August, so Semester 1 straddles
 * New Year — and a student registering in December filed under 2026 while one
 * registering for THE SAME SEMESTER in January filed under 2027.
 *
 * `semester_gpas` is keyed on (student_id, academic_year, semester), so that
 * student's grade point average was computed twice for one term, each time
 * over half their courses.
 *
 * 059 puts the answer in the database — `academic_term_now` — so every screen
 * and route asks one question and gets one answer instead of each reaching for
 * the clock and being wrong in January in its own way.
 */
interface TermNow {
  year_label: string;
  starts_in: number;
  term_sequence: number;
  term_name: string;
}

export default function CourseRegistration() {
  const { user } = useAuth();
  const mayRegister = can(user?.role, 'register-courses');
  // THE REGISTRY, by the capability that already means "sees other students'
  // registrations". Inventing a second one would give the University two
  // answers to the same question.
  const isRegistry = can(user?.role, 'view-registered-students');

  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState('');
  const [query, setQuery] = useState('');
  // EMPTY UNTIL THE CALENDAR ANSWERS. A default guessed from the clock is the
  // bug this replaced; a blank field that fills itself a moment later is
  // honest, and the route already refuses a registration with no term.
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [term, setTerm] = useState<TermNow | null>(null);
  const [noCalendar, setNoCalendar] = useState(false);
  const [calendarFailed, setCalendarFailed] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // A DEADLINE ON THE READ, and not as a sandbox workaround.
      //
      // Without one this drew 'Reading the calendar…' indefinitely — found by
      // rendering it, not by reading it. supabase-js reports an error when the
      // server answers badly and simply NEVER SETTLES when nothing answers at
      // all, so a paused project, a dropped network or a DNS failure all end
      // here as a sentence that is true for a second and a lie for an hour.
      try {
        const { data, error } = await within(
          supabase
            .from('academic_term_now')
            .select('year_label, starts_in, term_sequence, term_name')
            .maybeSingle(),
        );
        // THE ERROR WAS BEING DISCARDED, and that is the whole of this bug.
        //
        // Destructuring `{ data }` alone makes a FAILED READ and an EMPTY
        // CALENDAR indistinguishable: both arrive as data === null. Rendered
        // against a database it could not reach, this screen said "Today falls
        // in no academic year the calendar covers" — a confident statement
        // about the University's calendar, made by a screen that had not
        // managed to look at it.
        if (error) { setCalendarFailed(error.message); return; }
        if (!data) { setNoCalendar(true); return; }
        const t = data as unknown as TermNow;
        setTerm(t);
        setYear(String(t.starts_in));
        setSemester(String(t.term_sequence));
      } catch (e) {
        // NOT THE SAME FACT AS AN EMPTY CALENDAR, and not reported as though
        // it were. "Today falls in no academic year" is a finding about the
        // University; "the calendar could not be read" is a finding about the
        // database, and sending somebody to fix the first when it is the
        // second wastes their afternoon.
        setCalendarFailed(e instanceof Error ? e.message : 'The calendar could not be read.');
      }
    })();
  }, []);

  const [offered, setOffered] = useState<Offered[] | null>(null);
  const [passed, setPassed] = useState<string[]>([]);
  const [credits, setCredits] = useState(0);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // WHICH CLASS, where an offering has more than one. Keyed by course.
  const [sections, setSections] = useState<Record<string, string>>({});
  // Whether this term has been set up at all — see the file header.
  const [offeringsConfigured, setOfferingsConfigured] = useState(true);
  // WHETHER REGISTRATION IS OPEN, answered by 066's view through the route.
  // The screen does not compute it: a screen that thinks registration is open
  // while the route thinks it is closed produces a form that submits and is
  // refused, which is a support ticket for every single user.
  const [window_, setWindow] = useState<{
    open: boolean; recorded: boolean;
    opens: string | null; closes: string | null; mayRegisterAnyway: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [dropping, setDropping] = useState<string | null>(null);
  const [dropReason, setDropReason] = useState('');

  // ---- The register of students, for the Registry only --------------------
  useEffect(() => {
    if (!isRegistry) return;
    void (async () => {
      const { data } = await supabase.from('students').select(STUDENTS)
        .order('last_name').limit(500);
      setStudents((data ?? []) as unknown as Student[]);
    })();
  }, [isRegistry]);

  // ---- What this student may take -----------------------------------------
  const loadOffer = useCallback(async () => {
    setBusy(true);
    setNote(null);
    // THE TERM GOES WITH THE QUESTION. Without it the route has no term in
    // which to look for offerings and can only answer from the catalogue —
    // which is how this screen used to ask, and why it could never say who
    // teaches a course or whether there was a place left on it.
    const out = await authedPost('/api/enrolment', {
      action: 'offer',
      ...(studentId ? { studentId } : {}),
      ...(year ? { academicYear: Number(year) } : {}),
      ...(semester ? { semester: Number(semester) } : {}),
    });
    setBusy(false);

    if (!out.ok) {
      setOffered(null);
      setNote({
        kind: 'bad',
        text: (out.detail as string | undefined) ?? String(out.error ?? 'That could not be read.'),
      });
      return;
    }
    setOffered((out.courses ?? []) as Offered[]);
    setPassed((out.passed ?? []) as string[]);
    setCredits(Number(out.creditsEarned ?? 0));
    setOfferingsConfigured(out.offeringsConfigured !== false);
    setWindow((out.registration ?? null) as typeof window_);
    setChosen(new Set());
    setSections({});
  }, [studentId, year, semester]);

  useEffect(() => {
    // A STUDENT NEEDS NO PICKER. The route finds their own record from their
    // sign-in, so the screen can ask immediately — but not before the calendar
    // has answered, or the question is asked about no term at all.
    if (!isRegistry && year && semester) void loadOffer();
  }, [isRegistry, loadOffer, year, semester]);

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return offered ?? [];
    return (offered ?? []).filter((c) =>
      c.code.toUpperCase().includes(q) || c.title.toUpperCase().includes(q));
  }, [offered, query]);

  const chosenCredits = useMemo(
    () => (offered ?? []).filter((c) => chosen.has(c.id))
      .reduce((n, c) => n + Number(c.creditUnit ?? 0), 0),
    [offered, chosen],
  );

  async function register() {
    setBusy(true);
    setNote(null);
    const out = await authedPost('/api/enrolment', {
      action: 'register',
      ...(studentId ? { studentId } : {}),
      courseIds: Array.from(chosen),
      academicYear: Number(year),
      semester: Number(semester),
      // WHICH CLASS, where the student chose one. An offering with exactly one
      // class needs no choice and the route picks it rather than leaving the
      // link half made.
      sections,
    });
    setBusy(false);

    if (!out.ok) {
      // EVERY REASON AT ONCE. The route refuses the whole set and lists each
      // course with its own reasons, so nothing else comes back on a second
      // attempt.
      const refused = (out.refused ?? []) as { code: string; reasons: string[] }[];
      setNote({
        kind: 'bad',
        text: refused.length > 0
          ? refused.map((r) => `${r.code}: ${r.reasons.join(' ')}`).join('  ·  ')
          : (out.detail as string | undefined) ?? String(out.error ?? 'That was refused.'),
      });
      return;
    }
    setNote({ kind: 'ok', text: (out.detail as string | undefined) ?? 'Registered.' });
    void loadOffer();
  }

  async function drop(enrollmentId: string) {
    setBusy(true);
    setNote(null);
    const out = await authedPost('/api/enrolment', {
      action: 'drop', enrollmentId, reason: dropReason,
    });
    setBusy(false);
    setDropping(null);
    setDropReason('');
    setNote({
      kind: out.ok ? 'ok' : 'bad',
      text: (out.detail as string | undefined) ?? String(out.error ?? 'That did not work.'),
    });
    if (out.ok) void loadOffer();
  }

  if (!mayRegister) {
    return (
      <div className="p-6 text-sm text-[#6b6076] dark:text-[#9c93ad]">
        Registering for courses is done by the student, or by the Registry on their behalf.
        Your role does neither.
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e9e2f2]">
          Course registration
        </h1>
        <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          A registration puts the student on the mark sheet for the course, and puts the course
          on their transcript once the result is approved.
        </p>
      </header>

      {note && (
        <div role="status" className={`rounded-xl border p-3 text-sm ${
          note.kind === 'ok'
            ? 'border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
            : 'border-amber-400/40 bg-amber-50 text-amber-900 dark:bg-[#241f2c] dark:text-[#c3b48f]'
        }`}
        >
          {note.text}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      <section className="grid gap-4 sm:grid-cols-4">
        {isRegistry && (
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="cr-student" className={LABEL}>Student</label>
            <select id="cr-student" value={studentId} className={INPUT}
              onChange={(e) => { setStudentId(e.target.value); setOffered(null); }}>
              <option value="">Choose a student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {[s.last_name, s.first_name].filter(Boolean).join(', ')}
                  {s.matric_no ? ` — ${s.matric_no}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {/* -----------------------------------------------------------
            THE TERM, NAMED THE WAY THE UNIVERSITY NAMES IT.

            The University's own objection: registration "shouldn't simply say:
            Academic year: 2026. It should know: 2026/2027 — Semester 1."

            So the term is stated in full, from the calendar, and the integer
            underneath it — which is what `enrollments.academic_year` actually
            stores — is shown as the supporting detail rather than as the whole
            answer. 2026 means the year the term OPENED in, which is why a
            January registration still reads 2026.
            ----------------------------------------------------------- */}
        <div className="space-y-1.5">
          <span className={LABEL}>Term</span>
          {term ? (
            <div className="rounded-lg border border-[#ded6c8] bg-[#faf8f4] px-3 py-2
                            dark:border-[#3d3349] dark:bg-[#241f2c]">
              <p className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                {term.year_label} — {term.term_name}
              </p>
              <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">
                Filed under academic year {term.starts_in}
              </p>
            </div>
          ) : calendarFailed ? (
            <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2
                          text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30
                          dark:text-amber-200">
              The academic calendar could not be read, so a registration cannot be dated.
              {' '}{calendarFailed}
            </p>
          ) : noCalendar ? (
            <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2
                          text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30
                          dark:text-amber-200">
              Today falls in no academic year the calendar covers, so a registration cannot be
              dated. The academic calendar is set in Academic Structure.
            </p>
          ) : (
            <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">Reading the calendar…</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cr-sem" className={LABEL}>Semester</label>
          {/* CHANGING THE SEMESTER DISCARDS THE ANSWER, because what is on
              offer belongs to a term: the lecturer, the hours and the places
              left are all different in the other one. */}
          <select id="cr-sem" value={semester} className={INPUT}
            onChange={(e) => { setSemester(e.target.value); setOffered(null); }}>
            <option value="1">First</option>
            <option value="2">Second</option>
          </select>
        </div>
      </section>

      {isRegistry && (
        <button type="button" className={BTN_GHOST} disabled={!studentId || busy}
          onClick={() => void loadOffer()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Show what this student may take
        </button>
      )}

      {/* ------------------------------------------------------------------ */}
      {offered && (
        <>
          {/* WHAT THE RULE IS WORKING FROM, said out loud. A student refused a
              course because of a credit threshold should be able to see the
              number the University is counting rather than guess at it. */}
          <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
            {passed.length} course{passed.length === 1 ? '' : 's'} passed · {credits} credits
            earned{passed.length > 0 ? ` · ${passed.join(', ')}` : ''}
          </p>

          {/* -------------------------------------------------------------
              A TERM NOBODY HAS SET UP YET.

              Not an error and not silence. The whole catalogue is shown so
              registration still works, and the reason the lecturer and the
              hours are blank is stated rather than left to be guessed at.
              ------------------------------------------------------------- */}
          {/* -------------------------------------------------------------
              THE DEADLINE.

              A student outside the window is refused by the route, so the
              screen says so BEFORE they choose fifteen courses and press a
              button. The Registry is not refused — late registration is a real
              act, and one the system performs and records rather than leaving
              to paper — so they are told what will be recorded instead.

              NO WINDOW RECORDED IS NOT A CLOSED WINDOW, and nothing is drawn
              in that case: an absent deadline is the normal state of a term
              nobody has dated, not a problem to report.
              ------------------------------------------------------------- */}
          {window_ && window_.recorded && !window_.open && (
            <p className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
              window_.mayRegisterAnyway
                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
            }`}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {window_.mayRegisterAnyway
                  ? `Registration for this semester closed${window_.closes ? ` on ${window_.closes}` : ''}. `
                    + 'You may still register a student — it will be recorded on their record as a '
                    + 'late registration.'
                  : `Registration for this semester closed${window_.closes ? ` on ${window_.closes}` : ''}. `
                    + 'Write to the Registry, who can still register you.'}
              </span>
            </p>
          )}
          {window_ && window_.recorded && window_.open && window_.closes && (
            <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50
                          p-3 text-xs text-emerald-800 dark:border-emerald-900
                          dark:bg-emerald-950/30 dark:text-emerald-200">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>Registration is open until {window_.closes}.</span>
            </p>
          )}

          {!offeringsConfigured && (
            <p className="flex items-start gap-2 rounded-xl border border-[#ded6c8] bg-[#faf8f4]
                          p-3 text-xs text-[#6b6076] dark:border-[#3d3349] dark:bg-[#241f2c]
                          dark:text-[#9c93ad]">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>
                No course has been offered in {term ? `${term.year_label} — ${term.term_name}` : 'this term'} yet,
                so the whole catalogue is shown. Nothing here has a lecturer, an hour or a place
                limit until the term is set up on the Course offerings screen — and a registration
                made now records the course but not the class.
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[14rem]">
              <Search size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9c93ad]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a course by code or title"
                aria-label="Find a course"
                className={`${INPUT} pl-9`} />
            </div>
            <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
              {chosen.size} chosen · {chosenCredits} credits
            </p>
            <button type="button" className={BTN_PRIMARY} disabled={busy || chosen.size === 0}
              onClick={() => void register()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Register {chosen.size > 0 ? `${chosen.size} course${chosen.size === 1 ? '' : 's'}` : ''}
            </button>
          </div>

          <ul className="space-y-2">
            {visible.length === 0 && (
              <li className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
                No course matches that.
              </li>
            )}
            {visible.map((c) => (
              <li key={c.id}
                className={`rounded-xl border p-3 ${
                  c.alreadyRegistered
                    ? 'border-emerald-600/30 bg-emerald-600/5'
                    : c.eligible
                      ? 'border-[#e8e2f0] dark:border-[#332b3d]'
                      : 'border-[#ece7de] bg-[#faf8f4] dark:border-[#2e2637] dark:bg-[#241f2c]'
                }`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <label className="flex min-w-0 flex-1 items-start gap-3">
                    {/* A COURSE THAT CANNOT BE TAKEN IS NOT SELECTABLE, rather
                        than selectable and refused later. */}
                    <input type="checkbox"
                      className={`mt-1 ${FOCUS}`}
                      disabled={!c.eligible || c.alreadyRegistered}
                      checked={chosen.has(c.id)}
                      onChange={(e) => {
                        const next = new Set(chosen);
                        if (e.target.checked) next.add(c.id); else next.delete(c.id);
                        setChosen(next);
                      }} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[#422e59] dark:text-[#e4dcf0]">
                        {c.code} — {c.title}
                      </span>
                      <span className="block text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        {c.creditUnit} credits
                        {c.year ? ` · year ${c.year}` : ''}
                        {c.semester ? ` · semester ${c.semester}` : ''}
                      </span>

                      {/* --------------------------------------------------
                          WHAT THIS COURSE IS THIS TERM.

                          The lecturer, the hours and the places left — none of
                          which a catalogue can answer, because none of them is
                          a property of the course. They belong to the
                          offering, and this is the first time this screen has
                          had one to read.
                          -------------------------------------------------- */}
                      {c.offering && (
                        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1
                                         text-xs text-[#6b6076] dark:text-[#9c93ad]">
                          <span className="flex items-center gap-1">
                            <User size={11} />
                            {c.offering.lecturer ?? 'No lecturer assigned'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {whenIsIt(c.offering.classes)}
                          </span>
                          <span>{c.offering.deliveryMode}</span>
                          {c.offering.campus && <span>{c.offering.campus}</span>}
                          <span className={
                            c.offering.placesLeft !== null && c.offering.placesLeft <= 3
                              ? 'font-medium text-[#a07c12]' : ''
                          }>
                            {/* NULL IS NOT ZERO. An offering with no ceiling
                                has no places left to count. */}
                            {c.offering.maxEnrolment === null
                              ? `${c.offering.registered} registered · no limit`
                              : `${c.offering.placesLeft} of ${c.offering.maxEnrolment} places left`}
                          </span>
                        </span>
                      )}

                      {/* THE REASON, BESIDE THE COURSE. One sentence per
                          reason, naming what is missing. A course refused
                          because the class is full is called out separately
                          from one refused on prerequisites — they send the
                          student to two different offices. */}
                      {!c.meetsPrerequisites && c.missing.length >= 0
                        && c.reasons.filter((r) => r !== c.unavailable).length > 0 && (
                        <span className="mt-1 block text-xs text-[#a07c12]">
                          {c.reasons.filter((r) => r !== c.unavailable).join(' ')}
                        </span>
                      )}
                      {c.unavailable && (
                        <span className="mt-1 block text-xs font-medium text-[#a07c12]">
                          {c.unavailable}
                        </span>
                      )}

                      {/* A CHOICE OF CLASS, only where there is one to make.
                          An offering with a single class needs no picker and
                          the route attaches it without being asked. */}
                      {c.offering && c.offering.classes.length > 1
                        && c.eligible && !c.alreadyRegistered && (
                        <select
                          value={sections[c.id] ?? ''}
                          aria-label={`Class for ${c.code}`}
                          onChange={(e) => setSections({ ...sections, [c.id]: e.target.value })}
                          className={`${INPUT} mt-2 text-xs`}
                        >
                          <option value="">Any class</option>
                          {c.offering.classes.map((s) => (
                            <option key={s.id} value={s.id}>
                              Class {s.code}
                              {s.dayOfWeek
                                ? ` — ${DAYS[s.dayOfWeek]} ${hhmm(s.startsAt)}–${hhmm(s.endsAt)}`
                                : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </span>
                  </label>

                  {c.alreadyRegistered && (
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs
                                       font-medium text-emerald-800 dark:text-emerald-300">
                        Registered
                      </span>
                      <button type="button" className={BTN_GHOST} disabled={busy}
                        onClick={() => {
                          setDropping(dropping === c.enrollmentId ? null : c.enrollmentId);
                          setDropReason('');
                        }}>
                        <X size={13} /> Drop
                      </button>
                    </span>
                  )}
                </div>

                {/* DROPPING ASKS WHY, AND WILL NOT PROCEED WITHOUT ONE. The
                    reason stays on the record beside the registration it
                    undoes, and it is the first thing asked at an appeal. */}
                {dropping && dropping === c.enrollmentId && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t
                                  border-[#ece7de] pt-3 dark:border-[#2e2637]">
                    <input value={dropReason} onChange={(e) => setDropReason(e.target.value)}
                      placeholder="Why is this course being dropped?"
                      aria-label="Reason for dropping"
                      className={`${INPUT} flex-1 min-w-[14rem] text-xs`} />
                    <button type="button" className={BTN_GHOST}
                      disabled={busy || dropReason.trim().length < 8}
                      onClick={() => void drop(c.enrollmentId as string)}>
                      Confirm the drop
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {!offered && !busy && isRegistry && (
        <p className="flex items-center gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <BookOpen size={15} /> Choose a student to see what they may register for.
        </p>
      )}

      {!offered && busy && (
        <p className="flex items-center gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <Loader2 size={15} className="animate-spin" /> Reading the catalogue…
        </p>
      )}

      {offered && offered.length === 0 && (
        <p className="flex items-start gap-2 text-sm text-[#a07c12]">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          There are no courses in the catalogue, so there is nothing to register for.
        </p>
      )}
    </div>
  );
}
