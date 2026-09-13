import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PortalMasthead, {
  MASTHEAD_BTN_PRIMARY, MASTHEAD_BTN_SECONDARY,
} from '@/components/portal/PortalMasthead';
import { EmptyState } from '@/components/ui/portal';
import { supabase } from '@/lib/supabase';
import { CARD } from '@/lib/portalTheme';
import {
  BookOpen, Users, ClipboardList, Upload, Video,
  Calendar, TrendingUp, ArrowRight, CheckCircle2
} from 'lucide-react';
import type { ViewType } from '@/lib/types';

interface LecturerDashboardProps {
  onNavigate: (view: ViewType) => void;
}

export default function LecturerDashboard({ onNavigate }: LecturerDashboardProps) {
  const { user } = useAuth();

  // -------------------------------------------------------------------------
  // COUNTED FOR THIS LECTURER, NOT INVENTED FOR ANY LECTURER.
  //
  // This screen carried three Computer Science courses — Artificial
  // Intelligence, Final Year Project I, Machine Learning — with 85, 42 and 67
  // students, a timetable placing them in "Hall A" and "Lab 3", and a
  // performance panel reporting 92%, 85% and 95% pass rates. Every figure was a
  // literal in this file. The University teaches none of those courses.
  //
  // The note left here previously said the fix was "to count them, as the
  // administrator's, Registrar's and Finance dashboards now do". This is that.
  //
  // A lecturer is found through `lecturers.auth_user_id`; their courses through
  // `courses.lecturer_id`. Somebody signed in as a lecturer with no lecturer
  // record sees nothing and is told why — which is the true answer, and was
  // previously three courses belonging to nobody.
  // -------------------------------------------------------------------------
  interface AssignedCourse {
    id: string;
    code: string;
    title: string;
    level: number | null;
    students: number;
    resultsSubmitted: boolean;
  }

  const [assignedCourses, setAssignedCourses] = useState<AssignedCourse[] | null>(null);
  const [noLecturerRecord, setNoLecturerRecord] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) { setAssignedCourses([]); return; }

      const { data: lecturer } = await supabase
        .from('lecturers').select('id').eq('auth_user_id', uid).maybeSingle();
      if (!lecturer) { setNoLecturerRecord(true); setAssignedCourses([]); return; }

      const { data: courses } = await supabase
        .from('courses')
        .select('id, code, title, level')
        .eq('lecturer_id', lecturer.id)
        .order('code');

      const rows: AssignedCourse[] = [];
      for (const course of courses ?? []) {
        // `head: true` returns the count without the rows.
        const { count: students } = await supabase
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', course.id)
          .eq('status', 'registered');
        const { count: pending } = await supabase
          .from('results')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', course.id)
          .in('status', ['draft', 'submitted']);
        rows.push({
          id: course.id as string,
          code: course.code as string,
          title: course.title as string,
          level: (course.level as number | null) ?? null,
          students: students ?? 0,
          // SUBMITTED MEANS NOTHING IS WAITING. A course with no results at all
          // is not "submitted" — it has nothing to submit — so this is false
          // until there is at least one result and none of them is outstanding.
          resultsSubmitted: (students ?? 0) > 0 && (pending ?? 0) === 0,
        });
      }
      setAssignedCourses(rows);
    })();
  }, []);

  const totalStudents = (assignedCourses ?? []).reduce((t, c) => t + c.students, 0);
  const resultsPending = (assignedCourses ?? []).filter((c) => !c.resultsSubmitted).length;

  return (
    <div className="space-y-6">
      {/* The lecturer's masthead.

          It was an emerald gradient — a colour belonging to nothing else in
          this system — carrying the line "Department of Computer Science",
          which is not a department this university has. The department is gone
          rather than replaced with a guess: the staff identifier is a fact, and
          the rest of this screen has none to add to it yet. */}
      <PortalMasthead
        eyebrow="Lecturer"
        title={user?.name ? 'Welcome back,' : 'Welcome back'}
        accent={user?.name ?? undefined}
        lead={user?.staffId || undefined}
        actions={
          <>
            <button onClick={() => onNavigate('results')} className={MASTHEAD_BTN_PRIMARY}>
              <ClipboardList size={15} /> Enter results
            </button>
            <button onClick={() => onNavigate('lms')} className={MASTHEAD_BTN_SECONDARY}>
              <Upload size={15} /> Upload materials
            </button>
          </>
        }
      />

      {/* EVERY FIGURE BELOW IS INVENTED. Three assigned courses, 194 students,
          two results pending, twenty-four uploads — none of it counted, and the
          courses named are Computer Science ones this university does not
          teach. Saying so is not a fix; the fix is to count them, as the
          administrator's, Registrar's and Finance dashboards now do. Until
          that is done, a lecturer must not be able to mistake this screen for
          their own record. */}
      {/* Stats — every tile a count, and `—` where there is nothing to count. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Assigned Courses', value: assignedCourses?.length ?? null, icon: <BookOpen size={20} /> },
          { label: 'Students Registered', value: assignedCourses === null ? null : totalStudents, icon: <Users size={20} /> },
          { label: 'Courses With Results Outstanding', value: assignedCourses === null ? null : resultsPending, icon: <ClipboardList size={20} /> },
        ].map((stat, i) => (
          <div key={i} className={`${CARD} p-4`}>
            <div className="w-fit rounded-xl bg-[#faf6ee] p-2.5 text-[#c5a55a] ring-1 ring-[#ece0c4] dark:bg-[#241f2c] dark:ring-[#3d3349]">
              {stat.icon}
            </div>
            <p className="mt-3 font-heading text-2xl font-bold tabular-nums text-[#33234a] dark:text-[#e4dcf0]">
              {stat.value === null ? '—' : stat.value}
            </p>
            <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Assigned Courses */}
      <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27]">
        <div className="px-5 py-4 border-b border-[#f0ece4] dark:border-[#2a2333] flex items-center justify-between">
          <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">My Courses</h3>
          <button onClick={() => onNavigate('courses')} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            View All <ArrowRight size={12} />
          </button>
        </div>
        {/* AN EMPTY LIST SAYS WHICH EMPTY IT IS. "No courses assigned" and
            "you have no lecturer record" are different problems with different
            people to ask, and this screen used to show neither because it
            always had three. */}
        {assignedCourses !== null && assignedCourses.length === 0 && (
          <EmptyState
            icon={<BookOpen size={20} />}
            title={noLecturerRecord ? 'No lecturer record for this account' : 'No courses assigned yet'}
            description={noLecturerRecord
              ? 'This account is signed in as a lecturer but is not linked to a lecturer record, so it has no courses. Human Resources links the two when an appointment is activated.'
              : 'Courses are assigned to a lecturer in Course Management. Nothing has been assigned to you yet.'}
          />
        )}
        <div className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
          {(assignedCourses ?? []).map((course, i) => (
            <div key={i} className="px-5 py-4 flex items-center justify-between transition-colors hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {course.code.split(' ')[1] ?? course.code.slice(0, 3)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">{course.code} - {course.title}</p>
                  <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">{course.students} student{course.students === 1 ? '' : 's'}{course.level ? ` · Level ${course.level}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {course.resultsSubmitted ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={12} /> Submitted
                  </span>
                ) : (
                  <button
                    onClick={() => onNavigate('results')}
                    className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Enter Results
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------------
          TODAY'S SCHEDULE AND PERFORMANCE OVERVIEW ARE GONE.

          The schedule was three fixed rows — 9:00 CSC 301 in Hall A, 11:00
          CSC 401 in the office, 14:00 CSC 311 in Lab 3 — and the performance
          panel reported average marks of 72/65/78 and pass rates of 92/85/95
          from two literal arrays indexed by position.

          Neither can be counted yet. A timetable slot in this system is a JSON
          blob in `module_records` with the lecturer as free text, so nothing
          can ask "what am I teaching today"; a pass rate needs approved
          results, and none have been entered.

          They are removed rather than left with a banner. A lecturer reading
          "92% pass rate" beside their own name does not read the small print
          above it, and a figure nobody measured is the one thing a dashboard
          must never print.
          --------------------------------------------------------------- */}
    </div>
  );
}
