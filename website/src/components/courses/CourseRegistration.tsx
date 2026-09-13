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
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { BTN_PRIMARY, BTN_GHOST, INPUT, LABEL, FOCUS } from '@/lib/portalTheme';
import {
  Loader2, Check, AlertTriangle, BookOpen, X, Search,
} from 'lucide-react';

interface Offered {
  id: string;
  code: string;
  title: string;
  creditUnit: number;
  semester: number | null;
  year: number | null;
  eligible: boolean;
  reasons: string[];
  missing: string[];
  alreadyRegistered: boolean;
  enrollmentId: string | null;
}

interface Student {
  id: string;
  first_name: string | null;
  last_name: string | null;
  matric_no: string | null;
}

const STUDENTS = 'id, first_name, last_name, matric_no';

/** The academic year a registration defaults to. */
const thisYear = () => new Date().getFullYear();

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
  const [year, setYear] = useState(String(thisYear()));
  const [semester, setSemester] = useState('1');

  const [offered, setOffered] = useState<Offered[] | null>(null);
  const [passed, setPassed] = useState<string[]>([]);
  const [credits, setCredits] = useState(0);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
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
    const out = await authedPost('/api/enrolment', {
      action: 'offer',
      ...(studentId ? { studentId } : {}),
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
    setChosen(new Set());
  }, [studentId]);

  useEffect(() => {
    // A STUDENT NEEDS NO PICKER. The route finds their own record from their
    // sign-in, so the screen can ask immediately.
    if (!isRegistry) void loadOffer();
  }, [isRegistry, loadOffer]);

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
        <div className="space-y-1.5">
          <label htmlFor="cr-year" className={LABEL}>Academic year</label>
          <input id="cr-year" type="number" min="2000" max="2100" value={year}
            onChange={(e) => setYear(e.target.value)} className={INPUT} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cr-sem" className={LABEL}>Semester</label>
          <select id="cr-sem" value={semester} onChange={(e) => setSemester(e.target.value)}
            className={INPUT}>
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
                      {/* THE REASON, BESIDE THE COURSE. One sentence per
                          reason, naming what is missing. */}
                      {!c.eligible && c.reasons.length > 0 && (
                        <span className="mt-1 block text-xs text-[#a07c12]">
                          {c.reasons.join(' ')}
                        </span>
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
