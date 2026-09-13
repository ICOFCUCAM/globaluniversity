'use client';

// ---------------------------------------------------------------------------
// THE TIMETABLE — a week, drawn from the classes that actually exist.
//
// ---------------------------------------------------------------------------
// WHAT THIS REPLACES, AND WHY THAT MATTERS
// ---------------------------------------------------------------------------
//
// The old Timetable screen kept its own slots: a day, a start, an end and the
// course typed in as free text, stored on the shared documents table. Nothing
// else in the system could read them. The course was a string, so it matched no
// course; the lecturer was a string, so it matched no lecturer; and the room
// was a string, so two classes in the same room at the same hour were two
// strings that happened to be equal and nobody ever compared them.
//
// That is the fault the University named: "isolated utilities, rather than the
// University's actual academic structure." A timetable that shares no rows with
// the courses it schedules cannot detect a conflict, cannot tell a student
// where to be, and cannot tell a lecturer what they are teaching.
//
// This draws `class_sections` — the same rows the registration screen registers
// against and the same rows the offerings screen creates.
//
// ---------------------------------------------------------------------------
// THE THREE CONFLICTS, AND WHERE THEY ARE COMPUTED
// ---------------------------------------------------------------------------
//
// The University named them: "Room conflict. Lecturer conflict. Student-group
// conflict."
//
// All three are computed in `timetable_clashes` (063), once, in SQL — NOT here.
// A screen that does its own overlap arithmetic gets the boundary wrong: two
// classes where one ends exactly as the other begins do not clash, and every
// hand-written version treats them as though they do.
//
// This screen's job is to make a clash impossible to miss: the cell turns red,
// the class says what it collides with, and the count sits at the top of the
// page whether or not the clashing hour is on screen.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, EmptyState, PageHeader, SkeletonRows,
} from '@/components/ui/portal';
import { AlertTriangle, CalendarDays, Info } from 'lucide-react';
import { within } from './ProgrammeRegister';

// eslint-disable-next-line max-len
const SECTION = 'id, offering_id, code, lecturer_id, room_id, day_of_week, starts_at, ends_at, delivery_mode, capacity';
const OFFERING = 'id, course_id, academic_year_id, term_sequence, status, delivery_mode';
const CLASH = 'kind, section_id, clashes_with, detail, day_of_week, starts_at, ends_at';
const YEAR = 'id, label, starts_in, status';
const COURSE = 'id, code, title, credit_unit';
const ROOM = 'id, code, name, capacity';
const LECTURER = 'id, first_name, last_name';

const DAYS = [
  { n: 1, label: 'Monday' }, { n: 2, label: 'Tuesday' }, { n: 3, label: 'Wednesday' },
  { n: 4, label: 'Thursday' }, { n: 5, label: 'Friday' }, { n: 6, label: 'Saturday' },
  { n: 7, label: 'Sunday' },
];

interface Section {
  id: string; offering_id: string; code: string;
  lecturer_id: string | null; room_id: string | null;
  day_of_week: number | null; starts_at: string | null; ends_at: string | null;
  delivery_mode: string | null; capacity: number | null;
}
interface Offering {
  id: string; course_id: string; academic_year_id: string; term_sequence: number;
  status: string; delivery_mode: string;
}
interface Clash {
  kind: string; section_id: string; clashes_with: string; detail: string;
  day_of_week: number; starts_at: string; ends_at: string;
}
interface Year { id: string; label: string; starts_in: number; status: string; }
interface Course { id: string; code: string; title: string; credit_unit: number; }
interface Room { id: string; code: string; name: string | null; capacity: number | null; }
interface Lecturer { id: string; first_name: string; last_name: string; }

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');
/** '09:30:00' as minutes past midnight, for laying a class out in the column. */
const minutes = (t: string | null) => {
  if (!t) return 0;
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
};

export default function TimetableGrid() {
  const [years, setYears] = useState<Year[]>([]);
  // Whether the calendar has ANSWERED, as against being empty. See the
  // year picker below: the two look identical and mean opposite things.
  const [calendarRead, setCalendarRead] = useState(false);
  // The year the DATES say it is — see the note where it is read.
  const [currentYearId, setCurrentYearId] = useState<string | null>(null);
  const [yearId, setYearId] = useState('');
  const [term, setTerm] = useState(1);

  const [sections, setSections] = useState<Section[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);

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
        // WHICH YEAR IS IT? ASKED OF THE DATES, NOT OF A STORED COLUMN.
        //
        // This read `status === 'current'`. 059 set that column ONCE, with
        // current_date, on the day the migration ran — under a comment saying
        // the date decides it. It decided it once. On 15 August 2027 the
        // column would still have said 2026/2027, and this screen would have
        // opened on last year's data and said nothing at all.
        //
        // 065's `academic_year_now` derives it from the dates every time it is
        // asked, so it cannot go stale. The stored status is the fallback and
        // the first year is the fallback's fallback — both only reached if 065
        // has not been run.
        const { data: nowRow } = await within(
          supabase.from('academic_year_now').select(YEAR).maybeSingle(),
        ).catch(() => ({ data: null }));
        const derived = (nowRow ?? null) as unknown as Year | null;
        const current = (derived && ys.find((y) => y.id === derived.id))
          ?? ys.find((y) => y.status === 'current')
          ?? ys[0];
        setCurrentYearId(current?.id ?? null);
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
      const { data: offRows, error } = await within(
        supabase.from('course_offerings').select(OFFERING)
          .eq('academic_year_id', yearId).eq('term_sequence', term),
      );
      if (error) { setFailed(error.message); setLoading(false); return; }
      const offs = (offRows ?? []) as unknown as Offering[];
      const ids = offs.map((o) => o.id);

      const [secs, crs, rms, lects] = await within(Promise.all([
        ids.length === 0
          ? Promise.resolve({ data: [], error: null })
          : supabase.from('class_sections').select(SECTION).in('offering_id', ids),
        supabase.from('courses').select(COURSE).limit(1000),
        supabase.from('rooms').select(ROOM).order('code'),
        supabase.from('lecturers').select(LECTURER),
      ]));

      const secRows = (secs.data ?? []) as unknown as Section[];
      const { data: clashRows } = secRows.length === 0
        ? { data: [] }
        : await within(
          supabase.from('timetable_clashes').select(CLASH)
            .in('section_id', secRows.map((s) => s.id)),
        );

      setFailed(null);
      setOfferings(offs);
      setSections(secRows);
      setClashes((clashRows ?? []) as unknown as Clash[]);
      setCourses((crs.data ?? []) as unknown as Course[]);
      setRooms((rms.data ?? []) as unknown as Room[]);
      setLecturers((lects.data ?? []) as unknown as Lecturer[]);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The timetable could not be read.');
    }
    setLoading(false);
  }, [yearId, term]);

  useEffect(() => { void load(); }, [load]);

  const offeringById = useMemo(() => new Map(offerings.map((o) => [o.id, o])), [offerings]);
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const lecturerById = useMemo(() => new Map(lecturers.map((l) => [l.id, l])), [lecturers]);

  const clashesBySection = useMemo(() => {
    const m = new Map<string, Clash[]>();
    for (const c of clashes) {
      const list = m.get(c.section_id) ?? [];
      list.push(c);
      m.set(c.section_id, list);
    }
    return m;
  }, [clashes]);

  // A class with no day is not on the timetable — it is a class somebody has
  // not finished setting up, and it is counted separately rather than dropped
  // silently.
  const timetabled = useMemo(
    () => sections.filter((s) => s.day_of_week !== null),
    [sections],
  );
  const untimetabled = sections.length - timetabled.length;

  // THE HOURS DRAWN ARE THE HOURS USED. A grid fixed at 08:00–18:00 hides an
  // evening class and wastes half the page on a University that starts at ten.
  const [first, last] = useMemo(() => {
    if (timetabled.length === 0) return [8, 18];
    const starts = timetabled.map((s) => Math.floor(minutes(s.starts_at) / 60));
    const ends = timetabled.map((s) => Math.ceil(minutes(s.ends_at) / 60));
    return [Math.min(...starts), Math.max(...ends)];
  }, [timetabled]);

  const days = useMemo(() => {
    const used = new Set(timetabled.map((s) => s.day_of_week as number));
    // Monday to Friday always, plus any weekend day something is scheduled on.
    return DAYS.filter((d) => d.n <= 5 || used.has(d.n));
  }, [timetabled]);

  const labelOf = useCallback((s: Section) => {
    const o = offeringById.get(s.offering_id);
    const c = o ? courseById.get(o.course_id) : undefined;
    return c?.code ?? '—';
  }, [offeringById, courseById]);

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="The timetable could not be read"
          description={`${failed}. If migrations 059 and 063 have not been run on this database, `
            + 'the academic calendar and the class tables do not exist yet.'}
        />
      </Card>
    );
  }

  const year = years.find((y) => y.id === yearId);
  const rowHeight = 56; // px per hour

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable"
        subtitle="Every class that meets this term, and every conflict between them."
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
                {y.label}{y.id === currentYearId ? ' — current' : ''}
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

      {/* ------------------------------------------------------------------
          THE CONFLICTS, AT THE TOP, WHETHER OR NOT THE HOUR IS ON SCREEN.

          A clash drawn only in the cell is a clash nobody finds on a page
          that scrolls. Each one is named in the University's own terms: room,
          lecturer, cohort.
          ------------------------------------------------------------------ */}
      {clashes.length > 0 && (
        <Card className="border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30">
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold text-red-800
                         dark:text-red-200">
            <AlertTriangle size={16} />
            {clashes.length} conflict{clashes.length === 1 ? '' : 's'} in this timetable
          </h2>
          <ul className="mt-3 space-y-1.5">
            {clashes.map((c, i) => {
              const s = sections.find((x) => x.id === c.section_id);
              return (
                <li key={`${c.section_id}-${c.kind}-${c.clashes_with}-${i}`}
                  className="text-xs text-red-800 dark:text-red-200">
                  <span className="font-semibold">
                    {DAYS[c.day_of_week - 1]?.label} {hhmm(c.starts_at)}–{hhmm(c.ends_at)}
                  </span>
                  {' · '}
                  {c.kind === 'room' && <>Room <strong>{c.detail}</strong> is booked for two classes at once</>}
                  {c.kind === 'lecturer' && <><strong>{c.detail}</strong> is timetabled to teach two classes at once</>}
                  {c.kind === 'cohort' && <>Students of <strong>{c.detail}</strong> must attend two compulsory classes at once</>}
                  {s && <> — {labelOf(s)} class {s.code}</>}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-red-700 dark:text-red-300">
            Nothing here was refused. A term being rearranged passes through overlapping states;
            these are shown so they are not left behind when the rearranging stops.
          </p>
        </Card>
      )}

      {untimetabled > 0 && (
        <Card className="flex items-start gap-2 border-amber-200 bg-amber-50 p-4 text-xs
                         text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            {untimetabled} class{untimetabled === 1 ? '' : 'es'} in this term
            {untimetabled === 1 ? ' has' : ' have'} no day or hour set, so
            {untimetabled === 1 ? ' it is' : ' they are'} on no timetable and no student can be
            told where to be. Set the hour on the Course offerings screen.
          </span>
        </Card>
      )}

      {loading && <Card className="overflow-hidden"><SkeletonRows rows={6} cols={5} /></Card>}

      {!loading && timetabled.length === 0 && (
        <Card>
          <EmptyState
            icon={<CalendarDays size={20} />}
            title={`Nothing is timetabled in ${year?.label ?? 'this year'}, semester ${term}`}
            description="A class appears here once a course is offered and the class is given a day
                         and an hour. Both are done on the Course offerings screen."
          />
        </Card>
      )}

      {!loading && timetabled.length > 0 && (
        <Card className="overflow-hidden p-0">
          {/* THE GRID SCROLLS SIDEWAYS ON A NARROW SCREEN rather than
              compressing seven columns into a phone and becoming unreadable. */}
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div
                className="grid border-b border-[#f0ece4] dark:border-[#2a2333]"
                style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
              >
                <div />
                {days.map((d) => (
                  <div key={d.n}
                    className="border-l border-[#f0ece4] px-2 py-2 text-center text-xs font-semibold
                               text-[#422e59] dark:border-[#2a2333] dark:text-[#c8b6e8]">
                    {d.label}
                  </div>
                ))}
              </div>

              <div
                className="relative grid"
                style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
              >
                {/* The hour rail. */}
                <div>
                  {Array.from({ length: last - first }, (_, i) => first + i).map((h) => (
                    <div key={h} style={{ height: rowHeight }}
                      className="border-b border-[#f6f3ed] pr-2 pt-1 text-right text-[10px]
                                 tabular-nums text-[#a49bb0] dark:border-[#221d2a] dark:text-[#7b7289]">
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {days.map((d) => (
                  <div key={d.n} className="relative border-l border-[#f0ece4] dark:border-[#2a2333]">
                    {Array.from({ length: last - first }, (_, i) => (
                      <div key={i} style={{ height: rowHeight }}
                        className="border-b border-[#f6f3ed] dark:border-[#221d2a]" />
                    ))}

                    {timetabled.filter((s) => s.day_of_week === d.n).map((s) => {
                      const top = ((minutes(s.starts_at) - first * 60) / 60) * rowHeight;
                      const height = Math.max(
                        22,
                        ((minutes(s.ends_at) - minutes(s.starts_at)) / 60) * rowHeight - 3,
                      );
                      const mess = clashesBySection.get(s.id) ?? [];
                      const room = s.room_id ? roomById.get(s.room_id) : undefined;
                      const lect = s.lecturer_id ? lecturerById.get(s.lecturer_id) : undefined;
                      return (
                        <div
                          key={s.id}
                          title={[
                            labelOf(s),
                            `Class ${s.code}`,
                            `${hhmm(s.starts_at)}–${hhmm(s.ends_at)}`,
                            room ? `Room ${room.code}` : 'No room',
                            lect ? `${lect.first_name} ${lect.last_name}` : 'No lecturer',
                            ...mess.map((m) => `CLASH: ${m.kind} — ${m.detail}`),
                          ].join('\n')}
                          style={{ top, height }}
                          className={`absolute inset-x-1 overflow-hidden rounded-lg border px-1.5 py-1
                                      text-[10px] leading-tight ${
                            mess.length > 0
                              ? 'border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200'
                              : 'border-[#ded6c8] bg-[#f4efe6] text-[#33234a] dark:border-[#3d3349] dark:bg-[#2a2333] dark:text-[#e4dcf0]'
                          }`}
                        >
                          <p className="truncate font-semibold">
                            {mess.length > 0 && <AlertTriangle size={9} className="mr-0.5 inline" />}
                            {labelOf(s)} {s.code}
                          </p>
                          <p className="truncate">{hhmm(s.starts_at)}–{hhmm(s.ends_at)}</p>
                          <p className="truncate text-[9px] opacity-80">
                            {room?.code ?? 'No room'}
                            {lect ? ` · ${lect.last_name}` : ''}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
