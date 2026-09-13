'use client';

// ---------------------------------------------------------------------------
// MY TIMETABLE — the student's own week.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "The student should get a personalised timetable. Not: 'Add Class' but:
// 'My Timetable'. Monday, 08:00–10:00, BLT 501, Introduction to Black
// Liberation Theology, Room / Online … And allow Week, Day, Month, List,
// Online classes, Room, Lecturer. The student sees only classes relevant to
// them."
//
// ---------------------------------------------------------------------------
// "NOT ADD CLASS" IS THE WHOLE INSTRUCTION
// ---------------------------------------------------------------------------
//
// The existing Timetable screen is the Registry's: it builds the University's
// schedule, and its primary control creates a class. A student opening it was
// being handed the tool that writes the timetable rather than the timetable.
//
// This screen cannot write anything. It reads `my_week`, which is the
// signed-in student's own registered classes and nothing else — not their
// programme's, not their year's, THEIRS — and it has no form on it at all.
//
// ---------------------------------------------------------------------------
// THERE IS NO MONTH VIEW, AND THAT IS DELIBERATE
// ---------------------------------------------------------------------------
//
// The University asked for Week, Day, Month and List. Three of those are here.
//
// A month view needs DATED events, and this database does not have any. A
// `class_sections` row is a RECURRING WEEKLY PATTERN — Monday 08:00–10:00,
// every teaching week of the term — with no dates attached. Drawing a calendar
// month from it would mean inventing the dates: repeating the same week four
// or five times across a grid, with no way to know which of those days are
// teaching weeks, which are reading weeks and which fall in the vacation.
//
// A student would then read a class off a square for a date nothing is
// happening on. That is the same fault as the invented schedule this portal
// already shipped once — "CSC 412 Lecture, Today 2:00 PM", for a course the
// University does not teach — and it is not worth repeating for the sake of a
// fourth button.
//
// A month view becomes possible the moment the academic calendar records
// teaching weeks against a term. Until then the honest answer is the note at
// the foot of this screen.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, EmptyState, PageHeader, SkeletonRows } from '@/components/ui/portal';
import { within } from '@/components/academic/ProgrammeRegister';
import { useJourney } from '@/contexts/JourneyContext';
import { meaningOf } from '@/lib/studentJourney';
import {
  AlertTriangle, CalendarDays, MapPin, Monitor, User, Clock, ExternalLink,
} from 'lucide-react';

// eslint-disable-next-line max-len
const WEEK = 'student_id, course_code, course_title, section_id, section_code, day_of_week, day_name, is_today, starts_at, ends_at, when_text, delivery_mode, online_link, room_code, room_name, campus, lecturer, where_text';

export interface WeekClass {
  course_code: string;
  course_title: string;
  section_id: string;
  section_code: string | null;
  day_of_week: number | null;
  day_name: string;
  is_today: boolean | null;
  starts_at: string | null;
  ends_at: string | null;
  when_text: string | null;
  delivery_mode: string | null;
  online_link: string | null;
  room_code: string | null;
  room_name: string | null;
  campus: string | null;
  lecturer: string | null;
  where_text: string;
}

/** Shared with the dashboard's "Next class" card. */
export async function readWeek(): Promise<{ classes: WeekClass[]; failed: string | null }> {
  try {
    const { data, error } = await within(
      supabase.from('my_week').select(WEEK),
    );
    if (error) return { classes: [], failed: error.message };
    return { classes: (data ?? []) as unknown as WeekClass[], failed: null };
  } catch (e) {
    return {
      classes: [],
      failed: e instanceof Error ? e.message : 'Your timetable could not be read.',
    };
  }
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Ordered by day, then by the hour it starts. */
export function inOrder(classes: WeekClass[]): WeekClass[] {
  return [...classes].sort((a, b) => (a.day_of_week ?? 9) - (b.day_of_week ?? 9)
    || (a.starts_at ?? '').localeCompare(b.starts_at ?? ''));
}

/**
 * The next class from a given moment, within the week.
 *
 * WRAPS AROUND ON PURPOSE. On a Friday evening the next class is Monday's, and
 * a function that only looks forward through the week returns nothing and the
 * dashboard says "no more classes" for two days. Searching from today and
 * continuing past Sunday gives the answer a student means by "next".
 */
export function nextClass(
  classes: WeekClass[],
  isoDay: number,
  hhmm: string,
): WeekClass | null {
  const ordered = inOrder(classes.filter((c) => c.day_of_week !== null));
  if (ordered.length === 0) return null;
  const later = ordered.find((c) => (c.day_of_week as number) > isoDay
    || ((c.day_of_week as number) === isoDay && (c.starts_at ?? '') > hhmm));
  return later ?? ordered[0];
}

type Mode = 'week' | 'day' | 'list';

export default function MyTimetable() {
  const { stage } = useJourney();
  const [classes, setClasses] = useState<WeekClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('week');
  const [onlineOnly, setOnlineOnly] = useState(false);

  const load = useCallback(async () => {
    const { classes: c, failed: f } = await readWeek();
    setClasses(c); setFailed(f); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(
    () => inOrder(onlineOnly ? classes.filter((c) => c.delivery_mode === 'Online') : classes),
    [classes, onlineOnly],
  );

  // The browser's day only decides which COLUMN is highlighted and which day
  // the Day view opens on. Whether a row IS today is `is_today`, decided by
  // the database — see the note in 071.
  const todayName = DAYS[(new Date().getDay() + 6) % 7];
  const [day, setDay] = useState(todayName);

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="Your timetable could not be read"
          description={`${failed}. If migration 071 has not been run on this database, the view `
            + 'this screen reads does not exist yet.'}
        />
      </Card>
    );
  }

  if (loading) return <Card className="overflow-hidden"><SkeletonRows rows={6} cols={4} /></Card>;

  const online = classes.filter((c) => c.delivery_mode === 'Online').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="My timetable"
        subtitle={classes.length === 0
          ? 'Your own classes, once you have registered for them'
          : `${classes.length} class${classes.length === 1 ? '' : 'es'} a week`
            + (online > 0 ? ` · ${online} online` : '')}
      />

      {classes.length === 0 ? (
        // NOT AN EMPTY GRID. A week drawn with nothing in it looks like a
        // timetable that has not loaded. The stage says why it is empty —
        // unregistered, or registered on courses nobody has timetabled yet.
        <Card>
          <EmptyState
            icon={<CalendarDays size={20} />}
            title="Nothing is timetabled for you yet"
            description={stage === 'registering' || stage === 'awaiting-programme'
              ? meaningOf(stage).says
              : 'You are registered, but none of your courses has a class on the timetable yet. '
                + 'The department schedules these; nothing is needed from you.'}
          />
        </Card>
      ) : (
        <>
          {/* ---- HOW TO LOOK AT IT ---- */}
          <div className="flex flex-wrap items-center gap-2">
            {(['week', 'day', 'list'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                  mode === m
                    ? 'bg-[#422e59] text-white'
                    : 'border border-[#ded6c8] text-[#6b6076] hover:bg-[#f5f1ea] '
                      + 'dark:border-[#3d3349] dark:text-[#9c93ad] dark:hover:bg-[#2a2333]'
                }`}
              >
                {m}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-[#ded6c8] dark:bg-[#3d3349]" aria-hidden="true" />
            <button
              onClick={() => setOnlineOnly((v) => !v)}
              aria-pressed={onlineOnly}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                onlineOnly
                  ? 'bg-[#422e59] text-white'
                  : 'border border-[#ded6c8] text-[#6b6076] hover:bg-[#f5f1ea] '
                    + 'dark:border-[#3d3349] dark:text-[#9c93ad] dark:hover:bg-[#2a2333]'
              }`}
            >
              <Monitor size={13} /> Online classes
            </button>
            {mode === 'day' && (
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                aria-label="Day"
                className="rounded-lg border border-[#ded6c8] bg-white px-3 py-1.5 text-xs
                           text-[#33234a] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
              >
                {DAYS.map((d) => <option key={d}>{d}</option>)}
              </select>
            )}
          </div>

          {onlineOnly && shown.length === 0 && (
            <Card>
              <EmptyState
                icon={<Monitor size={20} />}
                title="None of your classes is online"
                description="Every class you are registered for meets on campus."
              />
            </Card>
          )}

          {mode === 'week' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {DAYS.slice(0, 5).concat(
                // Saturday and Sunday appear only if something is on them. Two
                // permanently empty columns is two fifths of the grid spent
                // saying nothing.
                DAYS.slice(5).filter((d) => shown.some((c) => c.day_name === d)),
              ).map((d) => {
                const onDay = shown.filter((c) => c.day_name === d);
                const isToday = d === todayName;
                return (
                  <div key={d} className="space-y-2">
                    <h2 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${
                      isToday ? 'text-[#422e59] dark:text-[#c8b6e8]' : 'text-[#a49bb0]'
                    }`}>
                      {d}
                      {isToday && (
                        <span className="rounded-full bg-[#422e59] px-2 py-0.5 text-[10px]
                                         font-medium normal-case tracking-normal text-white">
                          Today
                        </span>
                      )}
                    </h2>
                    {onDay.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-[#ded6c8] p-3 text-center
                                    text-[11px] text-[#c0b8cb] dark:border-[#3d3349]">
                        No classes
                      </p>
                    ) : onDay.map((c) => <ClassCard key={c.section_id} c={c} />)}
                  </div>
                );
              })}
            </div>
          )}

          {mode === 'day' && (
            <div className="space-y-2">
              {shown.filter((c) => c.day_name === day).length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<CalendarDays size={20} />}
                    title={`Nothing on ${day}`}
                    description="You have no classes timetabled on this day."
                  />
                </Card>
              ) : shown.filter((c) => c.day_name === day)
                .map((c) => <ClassCard key={c.section_id} c={c} wide />)}
            </div>
          )}

          {mode === 'list' && (
            <Card className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
              {shown.map((c) => (
                <div key={c.section_id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="w-24 shrink-0 text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">
                    {c.day_name}
                  </span>
                  <span className="w-28 shrink-0 tabular-nums text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    {c.when_text ?? 'Time not set'}
                  </span>
                  <span className="w-20 shrink-0 font-semibold text-[#422e59] dark:text-[#c8b6e8]">
                    {c.course_code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#33234a] dark:text-[#e4dcf0]">
                    {c.course_title}
                  </span>
                  <span className="shrink-0 text-xs text-[#a49bb0]">{c.where_text}</span>
                  <span className="shrink-0 text-xs text-[#a49bb0]">{c.lecturer ?? '—'}</span>
                </div>
              ))}
            </Card>
          )}

          {/* SAID ON THE SCREEN, not only in the source. A student looking for
              a month view should be told why there is not one. */}
          <p className="text-[11px] leading-relaxed text-[#a49bb0] dark:text-[#7b7289]">
            This is your weekly pattern — the same classes each teaching week of the term. There is
            no month view because the University&apos;s timetable records the weekly pattern rather
            than individual dates, and a month drawn from it would show classes on days that are
            not teaching days.
          </p>
        </>
      )}
    </div>
  );
}

function ClassCard({ c, wide = false }: { c: WeekClass; wide?: boolean }) {
  const isOnline = c.delivery_mode === 'Online';
  return (
    <Card className={`p-3 ${wide ? 'flex flex-wrap items-center gap-x-6 gap-y-2' : ''} ${
      c.is_today ? 'border-[#c5a55a]' : ''
    }`}>
      <div className={wide ? 'w-32 shrink-0' : ''}>
        <p className="flex items-center gap-1.5 text-xs font-medium tabular-nums
                      text-[#6b6076] dark:text-[#9c93ad]">
          <Clock size={12} /> {c.when_text ?? 'Time not set'}
        </p>
      </div>
      <div className={wide ? 'min-w-0 flex-1' : 'mt-1.5'}>
        <p className="text-sm font-semibold text-[#422e59] dark:text-[#c8b6e8]">{c.course_code}</p>
        <p className={`text-xs text-[#33234a] dark:text-[#e4dcf0] ${wide ? '' : 'line-clamp-2'}`}>
          {c.course_title}
        </p>
      </div>
      <div className={`${wide ? 'shrink-0 text-right' : 'mt-2'} space-y-0.5`}>
        <p className="flex items-center gap-1.5 text-[11px] text-[#6b6076] dark:text-[#9c93ad]">
          {isOnline ? <Monitor size={11} /> : <MapPin size={11} />}
          {/* THE ONE STRING 071 BUILDS. A screen assembling this from three
              nullable columns has three chances to print "Room: null". */}
          {c.where_text}
        </p>
        {c.lecturer && (
          <p className="flex items-center gap-1.5 text-[11px] text-[#a49bb0]">
            <User size={11} /> {c.lecturer}
          </p>
        )}
        {isOnline && c.online_link && (
          <a
            href={c.online_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#422e59]
                       underline underline-offset-2 dark:text-[#c8b6e8]"
          >
            Join <ExternalLink size={10} />
          </a>
        )}
      </div>
    </Card>
  );
}
