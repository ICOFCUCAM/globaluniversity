'use client';

// ---------------------------------------------------------------------------
// THE STUDENT'S DASHBOARD — where they stand, and the one thing to do next.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "The first screen should immediately tell the student where they stand.
// Welcome, Mabel. Master of Arts in Black Liberation Theology. 2026/27 ·
// Year 1 · Semester 1." Then cards for programme progress, registered
// courses, GPA/CGPA, outstanding requirements, next class, upcoming
// assessment, fees and notifications — and a progress visualisation by year
// and semester.
//
// ---------------------------------------------------------------------------
// WHAT THIS SCREEN USED TO DO, AND WHY THE REWRITE IS NOT COSMETIC
// ---------------------------------------------------------------------------
//
// It showed four quick-action tiles that were the same four for everybody —
// including an applicant with no courses, and a graduate whose degree was
// conferred three years ago. "My Courses" opened the University's course
// CATALOGUE. There was no programme, no progress, no next class and no due
// date anywhere on it.
//
// So it answered "what screens exist" rather than "where am I", which is the
// exact thing the University objected to about the student web as a whole.
//
// ---------------------------------------------------------------------------
// THE STAGE DECIDES THE SCREEN, NOT A LIST OF CARDS
// ---------------------------------------------------------------------------
//
// Everything below hangs off `stage` — 070 decides it in SQL and the whole
// portal reads the same answer. A person whose application is under review
// gets a sentence and no cards at all, because drawing "0 / 0 credits" and an
// empty timetable for them tells them they have a place. A graduate is not
// offered a registration button. A student who has not registered is shown one
// thing, large, and the eight cards can wait until they have.
//
// AND NO FIGURE HERE IS INVENTED. Where a fact is missing — no fee record, no
// approved result, no programme total — the card says so in words rather than
// printing a zero. A zero on a dashboard is read as a measurement.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PortalMasthead from '@/components/portal/PortalMasthead';
import { Card, EmptyState } from '@/components/ui/portal';
import { CARD_INTERACTIVE, FOCUS } from '@/lib/portalTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useJourney } from '@/contexts/JourneyContext';
import { meaningOf } from '@/lib/studentJourney';
import { readWeek, nextClass, type WeekClass } from '@/components/student/MyTimetable';
import {
  readAssessments, bucketOf, readableDate, howSoon, type Assessment,
} from '@/components/student/MyAssessments';
import { termLabel } from '@/components/student/MyResults';
import {
  AlertTriangle, ArrowRight, BadgeCheck, BarChart3, BookOpen, CalendarDays,
  ClipboardCheck, ClipboardList, Clock, GraduationCap, Wallet,
} from 'lucide-react';
import type { ViewType } from '@/lib/types';

interface Props { onNavigate: (view: ViewType) => void }

export default function StudentDashboard({ onNavigate }: Props) {
  const { user } = useAuth();
  const { journey, stage, loading, failed } = useJourney();
  const [classes, setClasses] = useState<WeekClass[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [extrasRead, setExtrasRead] = useState(false);

  const meaning = meaningOf(stage);

  // The week and the work are only read once the student is actually studying.
  // Reading them for an applicant is two round trips whose only answer can be
  // "nothing", and the screen has already decided not to draw them.
  const showsWork = stage === 'studying' || stage === 'registering';

  const loadExtras = useCallback(async () => {
    if (!showsWork) { setExtrasRead(true); return; }
    const [w, a] = await Promise.all([readWeek(), readAssessments()]);
    setClasses(w.classes);
    setAssessments(a.items);
    setExtrasRead(true);
  }, [showsWork]);

  useEffect(() => { if (!loading) void loadExtras(); }, [loading, loadExtras]);

  const today = new Date().toISOString().slice(0, 10);
  const isoDay = ((new Date().getDay() + 6) % 7) + 1;
  const hhmm = new Date().toTimeString().slice(0, 5);

  // Hoisted so the strip below can be drawn without re-asserting it on every
  // row. `journey?.duration_years` does not narrow inside a JSX callback.
  const years = journey?.duration_years ?? 0;
  const perYear = journey?.semesters_per_year ?? 2;

  const next = useMemo(() => nextClass(classes, isoDay, hhmm), [classes, isoDay, hhmm]);
  const nextDue = useMemo(() => {
    const open = assessments
      .filter((a) => {
        const b = bucketOf(a, today);
        return b === 'overdue' || b === 'upcoming';
      })
      .sort((a, b) => (a.due_on ?? '').localeCompare(b.due_on ?? ''));
    return open[0] ?? null;
  }, [assessments, today]);
  const overdue = useMemo(
    () => assessments.filter((a) => bucketOf(a, today) === 'overdue').length,
    [assessments, today],
  );

  // ---- WHO THEY ARE, ON EVERY STAGE ---------------------------------------
  const firstName = journey?.first_name
    ?? (user?.name ?? '').split(/\s+/)[0]
    ?? '';
  const session = journey?.year_label
    ?? (journey?.starts_in ? termLabel(journey.starts_in, null) : null);
  const where = [
    session,
    journey?.programme_year ? `Year ${journey.programme_year}` : null,
    journey?.term_name ?? (journey?.term_sequence ? `Semester ${journey.term_sequence}` : null),
  ].filter(Boolean).join(' · ');

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="Your record could not be read"
          description={`${failed}. If migration 070 has not been run on this database, the view `
            + 'this portal reads does not exist yet. Nothing is wrong with your record.'}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------
          WELCOME, AND WHERE THEY ARE, IN ONE BLOCK.

          The eyebrow is their PROGRAMME rather than the word "Student",
          because "Master of Arts in Black Liberation Theology" is what a
          person wants to see over their own name.
          ------------------------------------------------------------------ */}
      <PortalMasthead
        eyebrow={journey?.programme_name ?? journey?.award_title ?? 'Student'}
        title={firstName ? 'Welcome,' : 'Welcome'}
        accent={firstName || undefined}
        lead={where || journey?.matric_no || journey?.student_number || undefined}
        portrait={user?.avatar}
        facts={loading ? [] : factsFor(journey, stage)}
      />

      {/* ------------------------------------------------------------------
          WHERE YOU STAND, IN A SENTENCE, AND THE ONE NEXT THING.

          This is the whole point of the screen. It is above the cards on
          every stage, and on the stages that have no cards it is the screen.
          ------------------------------------------------------------------ */}
      {!loading && (
        <Card className={`p-5 ${
          meaning.tone === 'attention' ? 'border-[#c5a55a]'
            : meaning.tone === 'ended' ? 'border-[#ded6c8]' : ''
        }`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-base font-bold text-[#422e59] dark:text-[#c8b6e8]">
                {meaning.heading}
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                {meaning.says}
              </p>
              {/* WHOSE MOVE IT IS. Where the next step is not the student's,
                  naming the office is more use than a disabled button. */}
              {meaning.waitingOn && (
                <p className="mt-2 text-xs text-[#a49bb0] dark:text-[#7b7289]">
                  Waiting on: {meaning.waitingOn}
                </p>
              )}
            </div>
            {meaning.whatNext && (
              <button
                onClick={() => onNavigate(meaning.whatNext!.goTo)}
                className={`flex shrink-0 items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2.5
                            text-sm font-semibold text-white transition hover:bg-[#33234a] ${FOCUS}`}
              >
                {meaning.whatNext.label} <ArrowRight size={15} />
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------------
          THE CARDS, ON THE STAGES THAT HAVE THEM.

          A student who has not yet registered gets the block above and
          nothing else: eight cards reading "0", "none" and "no data" beneath
          a message saying "time to register" is a screen arguing with itself.
          ------------------------------------------------------------------ */}
      {!loading && showsWork && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label="Programme progress"
              value={journey?.credits_required
                ? `${pct(journey.credits_earned, journey.credits_required)}%`
                : `${journey?.credits_earned ?? 0}`}
              note={journey?.credits_required
                ? `${journey.credits_earned} of ${journey.credits_required} credits`
                : 'credits earned · your programme states no total'}
              icon={<GraduationCap size={16} />}
              onClick={() => onNavigate('my-programme')}
            />
            <Tile
              label="Registered courses"
              value={String(journey?.courses_registered ?? 0)}
              note={journey?.credits_this_term
                ? `${journey.credits_this_term} credits this semester`
                : 'nothing registered this semester'}
              icon={<BookOpen size={16} />}
              onClick={() => onNavigate('course-registration')}
            />
            <Tile
              label="Cumulative GPA"
              value={journey?.cgpa === null || journey?.cgpa === undefined
                ? '—' : Number(journey.cgpa).toFixed(2)}
              note={journey?.cgpa === null || journey?.cgpa === undefined
                ? 'no approved results yet'
                : journey?.last_semester_gpa !== null && journey?.last_semester_gpa !== undefined
                  ? `last semester ${Number(journey.last_semester_gpa).toFixed(2)}`
                  : 'approved results only'}
              icon={<BarChart3 size={16} />}
              onClick={() => onNavigate('results')}
            />
            <Tile
              label="Still to take"
              value={String(journey?.courses_outstanding ?? 0)}
              note={journey?.courses_failed
                ? `${journey.courses_failed} to repeat`
                : 'courses left in your curriculum'}
              icon={<ClipboardList size={16} />}
              tone={journey?.courses_failed ? 'attention' : 'plain'}
              onClick={() => onNavigate('my-programme')}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* ---- NEXT CLASS ---- */}
            <Panel
              title="Next class"
              icon={<CalendarDays size={15} />}
              onOpen={() => onNavigate('timetable')}
              openLabel="My timetable"
            >
              {!extrasRead ? <Quiet>Reading your timetable…</Quiet>
                : next ? (
                  <>
                    <p className="text-sm font-semibold text-[#422e59] dark:text-[#c8b6e8]">
                      {next.course_code}
                    </p>
                    <p className="text-xs text-[#33234a] dark:text-[#e4dcf0]">{next.course_title}</p>
                    <p className="mt-2 text-xs tabular-nums text-[#6b6076] dark:text-[#9c93ad]">
                      {next.day_name} · {next.when_text ?? 'time not set'}
                    </p>
                    <p className="text-xs text-[#a49bb0]">{next.where_text}</p>
                  </>
                ) : (
                  <Quiet>
                    None of your courses has a class on the timetable yet. The department
                    schedules these.
                  </Quiet>
                )}
            </Panel>

            {/* ---- UPCOMING ASSESSMENT ---- */}
            <Panel
              title={overdue > 0 ? `Assessments · ${overdue} overdue` : 'Next due'}
              icon={<ClipboardCheck size={15} />}
              onOpen={() => onNavigate('assignments')}
              openLabel="All assessments"
              tone={overdue > 0 ? 'attention' : 'plain'}
            >
              {!extrasRead ? <Quiet>Reading your assessments…</Quiet>
                : nextDue ? (
                  <>
                    <p className="text-sm font-semibold text-[#422e59] dark:text-[#c8b6e8]">
                      {nextDue.course_code}
                    </p>
                    <p className="text-xs text-[#33234a] dark:text-[#e4dcf0]">
                      {nextDue.item_title}
                    </p>
                    <p className={`mt-2 text-xs ${
                      bucketOf(nextDue, today) === 'overdue'
                        ? 'font-semibold text-red-700 dark:text-red-300'
                        : 'text-[#6b6076] dark:text-[#9c93ad]'
                    }`}>
                      {readableDate(nextDue.due_on)}
                      {howSoon(nextDue.due_on, today) ? ` · ${howSoon(nextDue.due_on, today)}` : ''}
                    </p>
                  </>
                ) : (
                  <Quiet>Nothing is due. Your lecturers have set no work with a date on it yet.</Quiet>
                )}
            </Panel>

            {/* ---- FEES ----
                NOT INVENTED. This university has not given the portal a fee
                schedule, and a card printing "$0 outstanding" would be read
                as a statement that nothing is owed. It says what it knows. */}
            <Panel
              title="Fees"
              icon={<Wallet size={15} />}
              // WAS 'documents' — the STAFF document manager — and said fees
              // were not in this portal, which stopped being true when 075
              // gave the University a fee schedule. Two stale facts in one
              // card, both found by checking which screens no menu offers.
              onOpen={() => onNavigate('my-finance')}
              openLabel="Fees & payments"
            >
              <Quiet>
                What the University has charged you and what it has recorded receiving. A balance
                appears once fees have been raised against your record.
              </Quiet>
            </Panel>
          </div>

          {/* ------------------------------------------------------------
              THE PROGRESS VISUALISATION THE UNIVERSITY ASKED FOR.

              Year by year, semester by semester. Deliberately not a
              percentage bar: a degree is not a single quantity, and a
              student wants to see WHICH term they are in and how many are
              left after it.
              ------------------------------------------------------------ */}
          {years > 0 ? (
            <Card className="p-5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#a49bb0]">
                Your programme, term by term
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from({ length: years }, (_, y) => y + 1).map((year) => (
                  <div key={year} className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-[#6b6076] dark:text-[#9c93ad]">
                      Y{year}
                    </span>
                    {Array.from({ length: perYear }, (_, s) => s + 1).map((sem) => {
                      const behind = year < (journey?.programme_year ?? 1);
                      const hereYear = year === (journey?.programme_year ?? 1);
                      const done = behind
                        || (hereYear && sem < (journey?.term_sequence ?? 1));
                      const now = hereYear && sem === (journey?.term_sequence ?? 1);
                      return (
                        <span
                          key={sem}
                          title={`Year ${year}, Semester ${sem}`}
                          className={`h-6 w-10 rounded ${
                            now ? 'bg-[#422e59] ring-2 ring-[#c5a55a] ring-offset-1'
                              : done ? 'bg-[#9a86b5]'
                                : 'bg-[#ece7de] dark:bg-[#2e2637]'
                          }`}
                        />
                      );
                    })}
                    {year < years && (
                      <span className="mx-1 text-[#ded6c8]" aria-hidden="true">·</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-[#a49bb0] dark:text-[#7b7289]">
                {journey?.programme_year && journey?.term_sequence
                  ? `You are in Year ${journey.programme_year}, Semester ${journey.term_sequence} of `
                    + `${years} year${years === 1 ? '' : 's'}. `
                  : ''}
                Your year is counted from the credits you have earned, not from how long you have
                been enrolled — so a repeated course does not move you up a year.
              </p>
            </Card>
          ) : null}
        </>
      )}

      {/* ---- THE GRADUATE'S SHELF ---- */}
      {!loading && (stage === 'alumni' || stage === 'graduated') && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Tile
            label="Your award"
            value={journey?.classification ?? (stage === 'alumni' ? 'Conferred' : 'Pending Senate')}
            note={journey?.conferred_on
              ? `Conferred ${readableDate(journey.conferred_on.slice(0, 10))}`
              : 'Awaiting the Senate’s conferral'}
            icon={<BadgeCheck size={16} />}
            onClick={() => onNavigate('my-credentials')}
          />
          <Tile
            label="Credits earned"
            value={String(journey?.credits_earned ?? 0)}
            note={journey?.credits_required ? `of ${journey.credits_required}` : undefined}
            icon={<GraduationCap size={16} />}
            // 'my-graduation' AND NOT 'academic-records'. This tile kept the id
            // it had before the student web was rebuilt, and that id opens the
            // Registry's register of five hundred students with a search box
            // over it. Found by counting which screens no menu offers.
            onClick={() => onNavigate('my-graduation')}
          />
          <Tile
            label="Cumulative GPA"
            value={journey?.cgpa === null || journey?.cgpa === undefined
              ? '—' : Number(journey.cgpa).toFixed(2)}
            note="Final"
            icon={<BarChart3 size={16} />}
            // 'my-transcript' AND NOT 'transcript'. The same fault, and the
            // worse of the two: 'transcript' opens the screen that ISSUES a
            // transcript from a student's record. A graduate pressing their
            // own CGPA tile was being handed the Registry's issuing tool.
            onClick={() => onNavigate('my-transcript')}
          />
        </div>
      )}
    </div>
  );
}

/** Whole percent, and never over 100 — a student with extra credits has 100%. */
function pct(earned: number, required: number): number {
  if (!required) return 0;
  return Math.min(100, Math.round((earned / required) * 100));
}

/**
 * The three figures on the masthead, chosen by stage.
 *
 * NOT THE SAME THREE FOR EVERYBODY. A CGPA over an applicant's name is
 * meaningless; "credits earned: 0" over a graduate's is wrong. Where there is
 * nothing worth putting there, the masthead carries none — which is a better
 * answer than three dashes.
 */
function factsFor(
  j: { cgpa: number | null; credits_earned: number; credits_required: number | null;
    courses_registered: number; classification: string | null } | null,
  stage: string | null,
): { label: string; value: string | number }[] {
  if (!j) return [];
  if (stage === 'alumni' || stage === 'graduated') {
    return [
      ...(j.classification ? [{ label: 'Award', value: j.classification }] : []),
      { label: 'Credits', value: j.credits_earned },
      ...(j.cgpa !== null ? [{ label: 'CGPA', value: Number(j.cgpa).toFixed(2) }] : []),
    ];
  }
  if (stage !== 'studying' && stage !== 'registering') return [];
  return [
    {
      label: j.cgpa !== null ? 'CGPA' : 'No approved results yet',
      value: j.cgpa !== null ? Number(j.cgpa).toFixed(2) : '—',
    },
    {
      label: 'Credits earned',
      value: j.credits_required ? `${j.credits_earned} / ${j.credits_required}` : j.credits_earned,
    },
    { label: 'Courses this semester', value: j.courses_registered },
  ];
}

function Tile({
  label, value, note, icon, onClick, tone = 'plain',
}: {
  label: string; value: string; note?: string; icon: React.ReactNode;
  onClick: () => void; tone?: 'plain' | 'attention';
}) {
  return (
    <button onClick={onClick} className={`${CARD_INTERACTIVE} group p-4 text-left ${FOCUS}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-[#a49bb0]">{label}</p>
        <span className="text-[#c5a55a]">{icon}</span>
      </div>
      <p className={`mt-2 font-heading text-2xl font-bold tabular-nums ${
        tone === 'attention' ? 'text-[#a07c12]' : 'text-[#422e59] dark:text-[#c8b6e8]'
      }`}>
        {value}
      </p>
      {note && <p className="mt-0.5 text-[11px] text-[#a49bb0] dark:text-[#7b7289]">{note}</p>}
    </button>
  );
}

function Panel({
  title, icon, children, onOpen, openLabel, tone = 'plain',
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  onOpen: () => void; openLabel: string; tone?: 'plain' | 'attention';
}) {
  return (
    <Card className={`flex flex-col p-4 ${tone === 'attention' ? 'border-amber-300 dark:border-amber-900' : ''}`}>
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#a49bb0]">
        <span className="text-[#c5a55a]">{icon}</span>{title}
      </h3>
      <div className="mt-2.5 flex-1">{children}</div>
      <button
        onClick={onOpen}
        className={`mt-3 flex items-center gap-1 self-start text-xs font-medium text-[#422e59]
                    hover:underline dark:text-[#c8b6e8] ${FOCUS}`}
      >
        {openLabel} <ArrowRight size={12} />
      </button>
    </Card>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[#a49bb0] dark:text-[#7b7289]">
      <Clock size={12} className="mt-0.5 shrink-0" />{children}
    </p>
  );
}
