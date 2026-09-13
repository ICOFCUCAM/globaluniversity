'use client';

// ---------------------------------------------------------------------------
// ACADEMIC OVERVIEW — the control centre.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "An Academic Overview that acts as a control centre: courses with no
// lecturer, programmes with incomplete curricula, missing results, pending
// approvals."
//
// Every one of those four was unanswerable before this term's work. "Courses
// with no lecturer" needs an offering to hang a lecturer on; "programmes with
// incomplete curricula" needs a programme that is data rather than a TypeScript
// constant; "missing results" needs a registration that knows which class it
// belongs to; "pending approvals" needs an approval chain. 057, 059 and 063
// made all four askable, and this is where they are asked.
//
// ---------------------------------------------------------------------------
// AN ALERT NAMES WHAT TO DO, AND OPENS THE SCREEN THAT DOES IT
// ---------------------------------------------------------------------------
//
// A dashboard that reports "3 problems" and leaves the reader to find them is a
// dashboard that gets ignored by the second week. Every line here says what is
// wrong in a sentence, and the card is the button that opens the screen where
// it is fixed.
//
// ---------------------------------------------------------------------------
// AND IT DOES NOT INVENT A FIGURE
// ---------------------------------------------------------------------------
//
// Every number on this page is counted from a row. Where something cannot be
// counted — because the term has not been set up, or because no rooms have
// been recorded — it says that, rather than showing a zero that reads as
// "nothing wrong".
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, EmptyState, PageHeader, SkeletonRows,
} from '@/components/ui/portal';
import {
  AlertTriangle, CheckCircle2, CalendarClock, ChevronRight, Info,
} from 'lucide-react';
import { within } from './ProgrammeRegister';
import type { ViewType } from '@/lib/types';

// eslint-disable-next-line max-len
const PROGRESS = 'version_id, programme_id, code, award_level, version_label, status, duration_years, semesters_per_year, total_credits, courses_in_curriculum, credits_in_curriculum, credits_against_claim, terms_with_courses, terms_expected';
// eslint-disable-next-line max-len
const ROLL = 'offering_id, course_code, course_title, year_label, starts_in, term_sequence, status, max_enrolment, lecturer, classes, registered, places_left';
const SECTION = 'id, offering_id, code, room_id, lecturer_id, day_of_week, starts_at, ends_at';
const OFFERING = 'id, course_id, academic_year_id, term_sequence, status';
const CLASH = 'kind, section_id, clashes_with, detail';
const YEAR = 'id, label, starts_in, status';
const ENROLMENT = 'id, offering_id, status, academic_year, semester';
const RESULT = 'enrollment_id, status';
const ROOM = 'id, code, active, provisional';

interface Progress {
  version_id: string; programme_id: string; code: string; award_level: string;
  version_label: string; status: string; duration_years: number;
  semesters_per_year: number; total_credits: number | null;
  courses_in_curriculum: number; credits_in_curriculum: number;
  credits_against_claim: number; terms_with_courses: number; terms_expected: number;
}
interface Roll {
  offering_id: string; course_code: string; course_title: string;
  year_label: string; starts_in: number; term_sequence: number; status: string;
  max_enrolment: number | null; lecturer: string | null;
  classes: number; registered: number; places_left: number | null;
}
interface Year { id: string; label: string; starts_in: number; status: string; }

/** One thing that is wrong, said as a sentence, with the screen that fixes it. */
interface Alert {
  key: string;
  tone: 'bad' | 'warn' | 'info';
  count: number;
  headline: string;
  detail: string;
  goTo?: ViewType;
  goLabel?: string;
}

export default function AcademicOverview({
  onNavigate,
}: {
  onNavigate?: (v: ViewType) => void;
}) {
  const [years, setYears] = useState<Year[]>([]);
  // Whether the calendar has ANSWERED, as against being empty. See the
  // year picker below: the two look identical and mean opposite things.
  const [calendarRead, setCalendarRead] = useState(false);
  const [yearId, setYearId] = useState('');
  const [term, setTerm] = useState(1);

  const [progress, setProgress] = useState<Progress[]>([]);
  const [roll, setRoll] = useState<Roll[]>([]);
  const [clashCount, setClashCount] = useState(0);
  const [sectionsNoDay, setSectionsNoDay] = useState(0);
  const [sectionsNoRoom, setSectionsNoRoom] = useState(0);
  const [roomCount, setRoomCount] = useState(0);
  // Rooms that arrived in 064's seed and nobody has looked at yet.
  const [placeholderRooms, setPlaceholderRooms] = useState(0);
  const [awaitingResults, setAwaitingResults] = useState<number | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data, error } = await within(
          supabase.from('academic_years').select(YEAR).order('starts_in'),
        );
        if (!live) return;
        setCalendarRead(true);
        if (error) { setFailed(error.message); setLoading(false); return; }
        const ys = (data ?? []) as unknown as Year[];
        setYears(ys);
        const current = ys.find((y) => y.status === 'current') ?? ys[0];
        if (current) setYearId(current.id);
        else setLoading(false);
      } catch (e) {
        if (live) {
          setCalendarRead(true);
          setFailed(e instanceof Error ? e.message : 'The calendar could not be read.');
          setLoading(false);
        }
      }
    })();
    return () => { live = false; };
  }, []);

  const load = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const year = years.find((y) => y.id === yearId);

      const [prog, offs, rms] = await within(Promise.all([
        supabase.from('curriculum_progress').select(PROGRESS),
        supabase.from('course_offerings').select(OFFERING)
          .eq('academic_year_id', yearId).eq('term_sequence', term),
        supabase.from('rooms').select(ROOM).eq('active', true),
      ]));
      if (prog.error) { setFailed(prog.error.message); setLoading(false); return; }

      const offerings = (offs.data ?? []) as unknown as { id: string; course_id: string }[];
      const offIds = offerings.map((o) => o.id);
      const courseIds = offerings.map((o) => o.course_id);

      const [rl, secs] = await within(Promise.all([
        year
          ? supabase.from('course_offering_roll').select(ROLL)
            .eq('starts_in', year.starts_in).eq('term_sequence', term)
          : Promise.resolve({ data: [], error: null }),
        offIds.length === 0
          ? Promise.resolve({ data: [], error: null })
          : supabase.from('class_sections').select(SECTION).in('offering_id', offIds),
      ]));

      const sections = (secs.data ?? []) as unknown as {
        id: string; room_id: string | null; day_of_week: number | null;
      }[];

      const { data: clashRows } = sections.length === 0
        ? { data: [] }
        : await within(
          supabase.from('timetable_clashes').select(CLASH)
            .in('section_id', sections.map((s) => s.id)),
        );

      // ---- MISSING RESULTS ------------------------------------------------
      //
      // A REGISTRATION WITH NO APPROVED RESULT, in a term whose registration
      // has closed. Counted through `results.enrollment_id` rather than
      // through (student, course): a student who passed this course two years
      // ago has a result, and matching on the course alone would call this
      // term's registration marked when it is not.
      //
      // TWO BOUNDED READS, no list of thousands of ids in a URL: the results
      // are found by the term's COURSES (tens of them), and the registrations
      // by the term.
      let outstanding: number | null = null;
      if (year && offIds.length > 0) {
        const [{ data: enrRows }, { data: resRows }] = await within(Promise.all([
          supabase.from('enrollments').select(ENROLMENT)
            .in('offering_id', offIds).eq('status', 'registered'),
          supabase.from('results').select(RESULT)
            .in('course_id', courseIds).eq('status', 'approved'),
        ]));
        const marked = new Set(
          ((resRows ?? []) as { enrollment_id: string | null }[])
            .map((r) => r.enrollment_id).filter(Boolean) as string[],
        );
        outstanding = ((enrRows ?? []) as { id: string }[])
          .filter((e) => !marked.has(e.id)).length;
      }

      // ---- PENDING APPROVALS ----------------------------------------------
      const { count: waiting } = await within(
        supabase.from('programme_versions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'board_review'),
      );

      setFailed(null);
      setProgress((prog.data ?? []) as unknown as Progress[]);
      setRoll((rl.data ?? []) as unknown as Roll[]);
      setClashCount((clashRows ?? []).length);
      setSectionsNoDay(sections.filter((s) => s.day_of_week === null).length);
      setSectionsNoRoom(sections.filter((s) => s.room_id === null).length);
      const roomRows = (rms.data ?? []) as unknown as { provisional: boolean }[];
      setRoomCount(roomRows.length);
      setPlaceholderRooms(roomRows.filter((r) => r.provisional).length);
      setAwaitingResults(outstanding);
      setPendingApprovals(waiting ?? 0);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The academic register could not be read.');
    }
    setLoading(false);
  }, [yearId, term, years]);

  useEffect(() => { void load(); }, [load]);

  const year = years.find((y) => y.id === yearId);

  // -------------------------------------------------------------------------
  // THE ALERTS.
  //
  // Built as data rather than as markup, so an alert that does not apply is
  // absent rather than rendered as a zero. A control centre showing "0 courses
  // with no lecturer" alongside "0 conflicts" trains the eye to skip the list.
  // -------------------------------------------------------------------------
  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    const live = roll.filter((r) => r.status !== 'cancelled');

    const noLecturer = live.filter((r) => !r.lecturer);
    if (noLecturer.length > 0) {
      out.push({
        key: 'no-lecturer',
        tone: 'bad',
        count: noLecturer.length,
        headline: `${noLecturer.length} course${noLecturer.length === 1 ? '' : 's'} offered with no lecturer`,
        detail: `${noLecturer.slice(0, 4).map((r) => r.course_code).join(', ')}`
          + `${noLecturer.length > 4 ? ` and ${noLecturer.length - 4} more` : ''}. `
          + 'A course with no lecturer has nobody to set the work, nobody to mark it and nobody '
          + 'the students can ask.',
        goTo: 'course-offerings',
        goLabel: 'Assign lecturers',
      });
    }

    const noClasses = live.filter((r) => r.classes === 0);
    if (noClasses.length > 0) {
      out.push({
        key: 'no-classes',
        tone: 'warn',
        count: noClasses.length,
        headline: `${noClasses.length} offering${noClasses.length === 1 ? '' : 's'} with no class scheduled`,
        detail: 'The course runs this term but meets at no hour, so it appears on no timetable '
          + 'and no student can be told where to be.',
        goTo: 'course-offerings',
        goLabel: 'Schedule classes',
      });
    }

    if (clashCount > 0) {
      out.push({
        key: 'clashes',
        tone: 'bad',
        count: clashCount,
        headline: `${clashCount} timetable conflict${clashCount === 1 ? '' : 's'}`,
        detail: 'A room booked twice, a lecturer in two places, or a cohort required to attend '
          + 'two compulsory classes at the same hour.',
        goTo: 'timetable',
        goLabel: 'Open the timetable',
      });
    }

    if (sectionsNoDay > 0) {
      out.push({
        key: 'no-day',
        tone: 'warn',
        count: sectionsNoDay,
        headline: `${sectionsNoDay} class${sectionsNoDay === 1 ? '' : 'es'} with no day or hour`,
        detail: 'Created but never timetabled. They are on no timetable and can clash with '
          + 'nothing, because they meet at no time.',
        goTo: 'course-offerings',
        goLabel: 'Set the hours',
      });
    }

    // A ROOM CLASH CANNOT BE DETECTED FOR A CLASS IN NO ROOM, and that is
    // worth saying rather than reporting a clean timetable.
    if (roomCount === 0 && live.length > 0) {
      out.push({
        key: 'no-rooms',
        tone: 'info',
        count: 0,
        headline: 'No rooms are recorded',
        detail: 'Until rooms exist, a class can be scheduled but not placed — and a room '
          + 'double-booking cannot be detected, because no class is in a room. Migration 064 '
          + 'seeds seventeen to start from.',
        goTo: 'rooms',
        goLabel: 'Open rooms',
      });
    }

    // ---- THE PLACEHOLDER ROOMS --------------------------------------------
    //
    // 064 made up these room codes because the University asked for room
    // numbers to be given. They are on campuses it states, but the numbers are
    // not real — and a made-up room code is exactly the kind of thing that
    // stops looking made-up after a fortnight. So it is said here, on the
    // control centre, every time somebody opens it, until they are checked.
    //
    // IT CLEARS ITSELF: editing a room clears its flag, and the alert stops
    // appearing when the last one is gone.
    if (placeholderRooms > 0) {
      out.push({
        key: 'placeholder-rooms',
        tone: 'info',
        count: placeholderRooms,
        headline: `${placeholderRooms} room${placeholderRooms === 1 ? ' is a placeholder' : 's are placeholders'}`,
        detail: 'The codes were made up so classes could be given somewhere to be, and none of '
          + 'them claims a capacity. Editing a room is what marks it as checked — a student '
          + 'should not be sent to a door nobody has confirmed exists.',
        goTo: 'rooms',
        goLabel: 'Check the rooms',
      });
    }

    if (roomCount > 0 && sectionsNoRoom > 0) {
      out.push({
        key: 'no-room',
        tone: 'info',
        count: sectionsNoRoom,
        headline: `${sectionsNoRoom} class${sectionsNoRoom === 1 ? '' : 'es'} with no room`,
        detail: 'Online classes need none. For the rest, a room clash cannot be detected for a '
          + 'class that is in no room.',
        goTo: 'course-offerings',
        goLabel: 'Place them',
      });
    }

    const full = live.filter((r) => r.places_left !== null && r.places_left <= 0);
    if (full.length > 0) {
      out.push({
        key: 'full',
        tone: 'warn',
        count: full.length,
        headline: `${full.length} offering${full.length === 1 ? '' : 's'} full`,
        detail: `${full.map((r) => r.course_code).slice(0, 5).join(', ')}. Nobody else can `
          + 'register. Raise the ceiling, or add a second class.',
        goTo: 'course-offerings',
        goLabel: 'Review capacity',
      });
    }

    // ---- THE CURRICULA -----------------------------------------------------
    //
    // A programme claiming 180 credits whose curriculum adds to 174 is a
    // programme nobody can graduate from — and today that is discovered by a
    // student in their final year.
    const short = progress.filter(
      (p) => p.total_credits !== null && p.credits_against_claim !== 0,
    );
    if (short.length > 0) {
      out.push({
        key: 'credits',
        tone: 'bad',
        count: short.length,
        headline: `${short.length} curricul${short.length === 1 ? 'um' : 'a'} that do not add up`,
        detail: `${short.slice(0, 4).map((p) => p.code).join(', ')}`
          + `${short.length > 4 ? ` and ${short.length - 4} more` : ''}. `
          + 'The courses in the curriculum are worth more or less than the programme claims, so '
          + 'a student following it cannot reach the total the award requires.',
        goTo: 'programmes-register',
        goLabel: 'Open the register',
      });
    }

    const empty = progress.filter((p) => p.courses_in_curriculum === 0);
    if (empty.length > 0) {
      out.push({
        key: 'empty',
        tone: 'warn',
        count: empty.length,
        headline: `${empty.length} programme${empty.length === 1 ? '' : 's'} with no curriculum at all`,
        detail: 'The programme is on the register but nothing has been placed in it. It cannot be '
          + 'taught, timetabled or examined until the courses are written into it.',
        goTo: 'curriculum-builder',
        goLabel: 'Build a curriculum',
      });
    }

    const gappy = progress.filter(
      (p) => p.courses_in_curriculum > 0 && p.terms_with_courses < p.terms_expected,
    );
    if (gappy.length > 0) {
      out.push({
        key: 'gaps',
        tone: 'warn',
        count: gappy.length,
        headline: `${gappy.length} curricul${gappy.length === 1 ? 'um has' : 'a have'} empty semesters`,
        detail: 'A semester with no courses in it is a semester a student on this programme has '
          + 'nothing to register for.',
        goTo: 'curriculum-builder',
        goLabel: 'Fill the gaps',
      });
    }

    if (pendingApprovals > 0) {
      out.push({
        key: 'approvals',
        tone: 'info',
        count: pendingApprovals,
        headline: `${pendingApprovals} curricul${pendingApprovals === 1 ? 'um' : 'a'} awaiting approval`,
        detail: 'Sent for approval and not yet signed. It is the Vice-Chancellor who signs a '
          + 'curriculum, and nothing in it is in force until they do.',
        goTo: 'programmes-register',
        goLabel: 'See what is waiting',
      });
    }

    if (awaitingResults !== null && awaitingResults > 0) {
      out.push({
        key: 'results',
        tone: 'warn',
        count: awaitingResults,
        headline: `${awaitingResults} registration${awaitingResults === 1 ? '' : 's'} with no approved result`,
        detail: 'Students registered this term whose mark has not been entered, or has been '
          + 'entered and not yet approved. Until it is approved it counts towards nothing.',
        goTo: 'results',
        goLabel: 'Open results',
      });
    }

    return out;
  }, [roll, progress, clashCount, sectionsNoDay, sectionsNoRoom, roomCount,
    placeholderRooms, pendingApprovals, awaitingResults]);

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="The academic register could not be read"
          description={`${failed}. If migrations 057, 059 and 063 have not been run on this `
            + 'database, the tables this page counts do not exist yet.'}
        />
      </Card>
    );
  }

  const live = roll.filter((r) => r.status !== 'cancelled');
  const registered = live.reduce((n, r) => n + r.registered, 0);
  const published = progress.filter((p) => p.status === 'published').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic overview"
        subtitle="What is running this term, and everything about it that needs attention."
      />

      <Card className="flex flex-wrap items-end gap-4 p-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[#a49bb0]">
            Academic year
          </span>
          <select
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            className="rounded-xl border border-[#ded6c8] bg-white px-3 py-2 text-sm
                       dark:border-[#3d3349] dark:bg-[#241f2c]"
          >
            {/* "NO ACADEMIC YEARS RECORDED" IS A FINDING, NOT A LOADING
                STATE — and this said it before the calendar had answered,
                which is a screen stating as fact something it has not yet
                asked. Rendered and read at 1440x950: the sentence was on the
                page while the skeleton below it was still drawing. */}
            {years.length === 0 && (
              <option value="">
                {calendarRead ? 'No academic years recorded' : 'Reading the calendar…'}
              </option>
            )}
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}{y.status === 'current' ? ' — current' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[#a49bb0]">
            Semester
          </span>
          <select
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="rounded-xl border border-[#ded6c8] bg-white px-3 py-2 text-sm
                       dark:border-[#3d3349] dark:bg-[#241f2c]"
          >
            <option value={1}>Semester 1</option>
            <option value={2}>Semester 2</option>
          </select>
        </label>
      </Card>

      {loading && <Card className="overflow-hidden"><SkeletonRows rows={5} cols={4} /></Card>}

      {!loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Figure
              value={progress.length}
              label="Programme versions"
              note={`${published} in force`}
            />
            <Figure
              value={live.length}
              label="Courses offered this term"
              note={live.length === 0 ? 'The term is not set up' : `${year?.label ?? ''} semester ${term}`}
            />
            <Figure
              value={registered}
              label="Registrations this term"
              note={registered === 0 ? 'Nobody has registered yet' : 'Across every offering'}
            />
            <Figure
              value={clashCount}
              label="Timetable conflicts"
              note={clashCount === 0 ? 'None' : 'Room, lecturer or cohort'}
              tone={clashCount > 0 ? 'bad' : 'ok'}
            />
          </div>

          {live.length === 0 && (
            <Card className="flex items-start gap-2 p-4 text-sm text-[#6b6076] dark:text-[#9c93ad]">
              <CalendarClock size={16} className="mt-0.5 shrink-0" />
              <span>
                Nothing is offered in {year?.label ?? 'this year'}, semester {term}. Until a course
                is offered, nobody can register against a class — the registration screen falls
                back to the whole catalogue and says so.
              </span>
            </Card>
          )}

          {alerts.length === 0 && live.length > 0 && (
            <Card className="flex items-start gap-3 border-emerald-200 bg-emerald-50 p-5
                             dark:border-emerald-900 dark:bg-emerald-950/30">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
              <div>
                <h2 className="font-heading text-sm font-bold text-emerald-800 dark:text-emerald-200">
                  Nothing needs attention
                </h2>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                  Every offering has a lecturer and a class, no two classes collide, every
                  curriculum adds up to what its programme claims, and nothing is waiting to be
                  signed.
                </p>
              </div>
            </Card>
          )}

          {alerts.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                             dark:text-[#c8b6e8]">
                Needs attention
              </h2>
              {alerts.map((a) => (
                <AlertCard key={a.key} alert={a} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Figure({
  value, label, note, tone = 'plain',
}: {
  value: number; label: string; note?: string; tone?: 'plain' | 'ok' | 'bad';
}) {
  return (
    <Card className="p-5">
      <p className={`font-heading text-3xl font-bold tabular-nums ${
        tone === 'bad' ? 'text-red-600 dark:text-red-400'
          : tone === 'ok' ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-[#422e59] dark:text-[#c8b6e8]'
      }`}>
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-[#33234a] dark:text-[#e4dcf0]">{label}</p>
      {note && <p className="mt-0.5 text-[11px] text-[#a49bb0] dark:text-[#7b7289]">{note}</p>}
    </Card>
  );
}

function AlertCard({
  alert, onNavigate,
}: {
  alert: Alert; onNavigate?: (v: ViewType) => void;
}) {
  const tones = {
    bad: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
    warn: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
    info: 'border-[#ded6c8] bg-[#faf8f4] dark:border-[#3d3349] dark:bg-[#241f2c]',
  };
  const text = {
    bad: 'text-red-800 dark:text-red-200',
    warn: 'text-amber-800 dark:text-amber-200',
    info: 'text-[#33234a] dark:text-[#e4dcf0]',
  };
  const Icon = alert.tone === 'info' ? Info : AlertTriangle;

  return (
    <div className={`flex flex-wrap items-start gap-3 rounded-2xl border p-4 ${tones[alert.tone]}`}>
      <Icon size={16} className={`mt-0.5 shrink-0 ${text[alert.tone]}`} />
      <div className="min-w-0 flex-1">
        <h3 className={`text-sm font-semibold ${text[alert.tone]}`}>{alert.headline}</h3>
        <p className={`mt-1 text-xs opacity-90 ${text[alert.tone]}`}>{alert.detail}</p>
      </div>
      {alert.goTo && onNavigate && (
        <button
          onClick={() => onNavigate(alert.goTo as ViewType)}
          className={`flex shrink-0 items-center gap-1 rounded-xl border border-current/20 px-3
                      py-1.5 text-xs font-medium ${text[alert.tone]} hover:bg-white/50
                      dark:hover:bg-black/20`}
        >
          {alert.goLabel} <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}
