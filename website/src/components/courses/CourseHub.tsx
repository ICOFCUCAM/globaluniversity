'use client';

// ---------------------------------------------------------------------------
// THE COURSE LEARNING HUB — the door onto four migrations that had none.
//
// ---------------------------------------------------------------------------
// WHAT WAS THERE
// ---------------------------------------------------------------------------
//
// 084 built modules and lessons. 085 built activities and their answer keys.
// 086 built the tutor's citations. 087 made a module unlock only when the one
// before it was finished. The row policies were written carefully — a student
// sees a lesson only where the module is visible, open, unlocked, and they are
// registered on the course — and `my_module_progress` and `my_course_progress`
// were built to report how far through they are.
//
// AND NOT ONE SCREEN READ ANY OF IT. The whole subsystem has been reachable
// only by somebody writing SQL. A student registered on a course had nowhere
// to go and see it.
//
// ---------------------------------------------------------------------------
// WHAT THIS SCREEN HAS TO GET RIGHT
// ---------------------------------------------------------------------------
//
// 1. A LOCKED MODULE IS SHOWN, NOT HIDDEN. 087's unlocking is a sequence, not
//    a secret: a student is entitled to see that Module 3 exists and what has
//    to happen before it opens. Hiding it would make the course look shorter
//    than it is.
//
// 2. THE DATABASE DECIDES WHAT IS READABLE, NOT THIS FILE. The lessons of a
//    locked module do not arrive at all — the policy sees to that — so this
//    screen never has material it is choosing not to draw. It reports the
//    state and asks for nothing it is not entitled to.
//
// 3. PROGRESS IS THE STUDENT'S OWN. `lesson_progress` is written by the
//    student under their own policy, not through a route: nobody else's
//    authority is involved in a person saying they have read something, and a
//    route would be a gate with nothing behind it.
//
//    A MARK OF COMPLETION IS NOT A MARK. Nothing here reaches the academic
//    record; 009's approval chain is what does that, and the screen says so
//    rather than letting a full progress bar look like a pass.
// ---------------------------------------------------------------------------

import React from 'react';
import {
  BookOpen, Lock, CheckCircle2, Circle, Clock, PlayCircle, FileText, Link2,
  CalendarClock, AlertTriangle, RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton,
} from '@/components/ui/portal';
import { BTN_SECONDARY } from '@/lib/portalTheme';
import {
  LESSON_KINDS, lessonKindLabel, lessonProgressPatch, LESSON_COMPLETED,
  type LessonIconName,
} from '@/lib/courseHub';

interface Course { id: string; code: string; title: string }
interface ModuleRow {
  module_id: string; course_id: string; module_title: string; sort_order: number;
  unlocks_after: string | null; unlocked: boolean; items: number; done: number;
  percent: number | null;
}
interface Lesson {
  id: string; module_id: string; kind: string; title: string; summary: string | null;
  estimated_minutes: number | null; requirement: string | null; sort_order: number;
  url: string | null; starts_at: string | null;
}
interface Progress { lesson_id: string; state: string }
interface Activity {
  id: string; module_id: string | null; title: string; kind: string; graded: boolean;
  points: number | null; opens_at: string | null; due_at: string | null;
  closes_at: string | null; instructions: string | null;
}

const when = (iso: string | null) => (iso
  ? new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  : null);

// THE ICON FOR EACH KIND OF LESSON, mapped from the name `courseHub.ts`
// gives it. `LucideIcon` rather than a hand-written prop type: lucide's
// components forward a ref, and a ComponentType that does not mention one
// will not accept them.
const ICONS: Record<LessonIconName, LucideIcon> = {
  play: PlayCircle, file: FileText, link: Link2, calendar: CalendarClock, book: BookOpen,
};

export default function CourseHub() {
  const { user } = useAuth();
  const [courses, setCourses] = React.useState<Course[] | null>(null);
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [modules, setModules] = React.useState<ModuleRow[]>([]);
  const [lessons, setLessons] = React.useState<Lesson[]>([]);
  const [progress, setProgress] = React.useState<Progress[]>([]);
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [overall, setOverall] = React.useState<{ percent: number | null; items: number } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  // ---- THE COURSES THEY ARE REGISTERED ON ------------------------------
  //
  // From `enrollments`, which is what registration writes. Not from the
  // curriculum: a student is entitled to the material of the courses they are
  // ON, which is a smaller and more honest set than the courses their
  // programme contains.
  const loadCourses = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('enrollments')
      .select('course_id, courses(id, code, title)')
      .eq('status', 'registered')
      .limit(60);
    if (error) { setNote(error.message); setCourses([]); return; }
    const seen = new Map<string, Course>();
    for (const row of data ?? []) {
      const c = (row as Record<string, unknown>).courses as Course | null;
      if (c?.id) seen.set(c.id, c);
    }
    const list = [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
    setCourses(list);
    if (list.length > 0) setChosen((prev) => prev ?? list[0].id);
  }, []);

  React.useEffect(() => { void loadCourses(); }, [loadCourses]);

  const loadCourse = React.useCallback(async (courseId: string) => {
    setModules([]); setLessons([]); setActivities([]); setOverall(null);
    const [m, l, p, a, o] = await Promise.all([
      supabase.from('my_module_progress').select(
        'module_id, course_id, module_title, sort_order, unlocks_after, unlocked, items, done, percent',
      ).eq('course_id', courseId).order('sort_order'),
      supabase.from('course_lessons').select(
        'id, module_id, kind, title, summary, estimated_minutes, requirement, sort_order, url, starts_at',
      ).eq('course_id', courseId).order('sort_order').limit(500),
      supabase.from('lesson_progress').select('lesson_id, state').limit(2000),
      supabase.from('course_activities').select(
        'id, module_id, title, kind, graded, points, opens_at, due_at, closes_at, instructions',
      ).eq('course_id', courseId).order('due_at').limit(200),
      supabase.from('my_course_progress').select('percent, items').eq('course_id', courseId)
        .maybeSingle(),
    ]);
    setModules((m.data ?? []) as unknown as ModuleRow[]);
    setLessons((l.data ?? []) as unknown as Lesson[]);
    setProgress((p.data ?? []) as unknown as Progress[]);
    setActivities((a.data ?? []) as unknown as Activity[]);
    setOverall((o.data ?? null) as unknown as { percent: number | null; items: number } | null);
  }, []);

  React.useEffect(() => { if (chosen) void loadCourse(chosen); }, [chosen, loadCourse]);

  const stateOf = new Map(progress.map((p) => [p.lesson_id, p.state]));

  async function mark(lesson: Lesson, done: boolean) {
    setBusy(lesson.id); setNote(null);
    // WRITTEN BY THE STUDENT, UNDER THEIR OWN POLICY. `lesson_progress_own`
    // covers every command for their own rows, so there is no route here and
    // no capability to check — saying you have read something is not an act
    // that needs anybody's authority.
    const { data: me } = await supabase.from('students').select('id')
      .eq('auth_user_id', user?.id ?? '').maybeSingle();
    const studentId = (me as Record<string, unknown> | null)?.id;
    if (!studentId) {
      setBusy(null);
      setNote('Your account is not linked to a student record, so progress cannot be kept.');
      return;
    }
    // ON THE UNIQUE INDEX 084 ALREADY BUILT — `lesson_progress_one_per_student_idx`
    // over (lesson_id, student_id) — so pressing the button twice updates the
    // one row rather than making a second and double-counting the module.
    const { error } = await supabase.from('lesson_progress').upsert({
      lesson_id: lesson.id,
      student_id: studentId,
      ...lessonProgressPatch(done),
    }, { onConflict: 'lesson_id,student_id' });
    setBusy(null);
    if (error) { setNote(error.message); return; }
    if (chosen) await loadCourse(chosen);
  }

  if (courses === null) {
    return <div className="p-5"><Skeleton className="h-4 w-1/2" /></div>;
  }

  if (courses.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Course hub" subtitle="The material for the courses you are registered on" />
        <EmptyState
          icon={<BookOpen size={20} />}
          title="You are not registered on any course"
          description="Material appears here once a registration is recorded. Course registration is under Academic."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course hub"
        subtitle="The material for the courses you are registered on, in the order it is meant to be taken"
      />

      {note && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{note}</p></Card>
      )}

      {/* ---- WHICH COURSE ------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        {courses.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setChosen(c.id)}
            aria-current={chosen === c.id}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              chosen === c.id
                ? 'bg-[#422e59] text-white'
                : 'bg-gray-100 text-[#6b6076] hover:bg-gray-200 dark:text-[#9c93ad]'}`}
          >
            {c.code}
          </button>
        ))}
        <button type="button" className={BTN_SECONDARY}
          onClick={() => chosen && void loadCourse(chosen)}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ---- HOW FAR THROUGH ---------------------------------------- */}
      {overall && (
        <Card className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
              {overall.percent ?? 0}% of the material
            </p>
            <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
              {/* A FULL BAR IS NOT A PASS, and the one place somebody might
                  think otherwise is right here, under the number. */}
              This counts the material you have marked as read. It is not a mark and reaches
              no academic record — results come through the approval chain, not from here.
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ece7f3] dark:bg-[#332b3d]">
            <div className="h-full rounded-full bg-[#422e59]"
              style={{ width: `${Math.min(100, Math.max(0, overall.percent ?? 0))}%` }} />
          </div>
        </Card>
      )}

      {modules.length === 0 && (
        <EmptyState
          icon={<BookOpen size={20} />}
          title="Nothing has been published for this course yet"
          description="Modules appear here as the lecturer publishes them."
        />
      )}

      {/* ---- THE MODULES, IN ORDER ---------------------------------- */}
      {modules.map((m) => {
        const mine = lessons.filter((l) => l.module_id === m.module_id);
        const acts = activities.filter((a) => a.module_id === m.module_id);
        const locked = !m.unlocked;
        return (
          <Card key={m.module_id}>
            <CardHeader
              title={m.module_title}
              subtitle={locked
                // A LOCKED MODULE SAYS WHAT OPENS IT. "Locked" with no reason
                // is a door with no handle.
                ? 'Locked until the module before it is finished'
                : `${m.done} of ${m.items} done${m.percent !== null ? ` · ${m.percent}%` : ''}`}
              action={locked
                ? <span className="flex items-center gap-1 text-xs text-[#a3283f]">
                  <Lock size={13} /> Locked
                </span>
                : undefined}
            />

            {/* LOCKED MODULES ARE SHOWN AND NOT HIDDEN. The lessons simply do
                not arrive — the row policy sees to that — so there is nothing
                here this screen is choosing to withhold. */}
            {locked && (
              <p className="px-5 pb-5 text-sm text-[#6b6076] dark:text-[#9c93ad]">
                This module opens when the one before it is complete. It is shown so that you
                can see the whole course; its material is not released yet.
              </p>
            )}

            {!locked && mine.length === 0 && acts.length === 0 && (
              <p className="px-5 pb-5 text-sm text-[#6b6076] dark:text-[#9c93ad]">
                This module is open and has nothing in it yet.
              </p>
            )}

            {!locked && mine.length > 0 && (
              <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">
                {mine.map((l) => {
                  const state = stateOf.get(l.id);
                  const done = state === LESSON_COMPLETED;
                  const Icon = ICONS[LESSON_KINDS[l.kind]?.icon ?? 'book'] ?? BookOpen;
                  return (
                    <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                      <div className="flex min-w-0 gap-3">
                        <Icon size={16} className="mt-0.5 flex-shrink-0 text-[#6b5b8a]" />
                        <div className="min-w-0">
                          <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                            {l.title}
                            {l.requirement === 'required' && (
                              <span className="ml-2 rounded-full bg-[#fdf3e0] px-2 py-0.5 text-[11px] text-[#a86a12]">
                                required
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                            {lessonKindLabel(l.kind)}
                            {l.estimated_minutes ? ` · about ${l.estimated_minutes} min` : ''}
                            {when(l.starts_at) ? ` · ${when(l.starts_at)}` : ''}
                          </p>
                          {l.summary && (
                            <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
                              {l.summary}
                            </p>
                          )}
                          {l.url && (
                            <a href={l.url} target="_blank" rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#422e59] underline dark:text-[#c8b6e8]">
                              <Link2 size={11} /> Open
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy === l.id}
                        onClick={() => void mark(l, !done)}
                        className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                          done
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-[#6b6076] hover:bg-gray-200'}`}
                      >
                        {done ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                        {done ? 'Done' : 'Mark as done'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* ---- AND WHAT IS DUE ---------------------------------- */}
            {!locked && acts.length > 0 && (
              <div className="border-t border-[#ece7f3] dark:border-[#332b3d]">
                <p className="px-5 pt-3 text-xs font-medium uppercase tracking-wide text-[#a49bb0]">
                  To hand in
                </p>
                <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">
                  {acts.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">{a.title}</p>
                        <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                          {a.kind}
                          {a.graded ? ` · graded${a.points ? `, ${a.points} points` : ''}` : ' · not graded'}
                        </p>
                        {a.instructions && (
                          <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
                            {a.instructions}
                          </p>
                        )}
                      </div>
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        <Clock size={12} />
                        {when(a.due_at) ? `due ${when(a.due_at)}` : 'no date set'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        );
      })}

      {/* ANYTHING NOT ATTACHED TO A MODULE. An activity with no module would
          otherwise be invisible, which is how a piece of coursework goes
          unhanded-in. */}
      {activities.filter((a) => !a.module_id).length > 0 && (
        <Card>
          <CardHeader
            title="Not in any module"
            subtitle="Coursework set against the course as a whole"
          />
          <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">
            {activities.filter((a) => !a.module_id).map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">{a.title}</p>
                  <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    {a.kind}{a.graded ? ' · graded' : ' · not graded'}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-[#6b6076] dark:text-[#9c93ad]">
                  <AlertTriangle size={12} />
                  {when(a.due_at) ? `due ${when(a.due_at)}` : 'no date set'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
