import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PortalMasthead, {
  MASTHEAD_BTN_PRIMARY, MASTHEAD_BTN_SECONDARY,
} from '@/components/portal/PortalMasthead';
import { SampleDataNotice } from '@/components/ui/portal';
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

  const assignedCourses = [
    { code: 'CSC 301', title: 'Artificial Intelligence', students: 85, resultsSubmitted: true, level: 300 },
    { code: 'CSC 401', title: 'Final Year Project I', students: 42, resultsSubmitted: false, level: 400 },
    { code: 'CSC 311', title: 'Machine Learning', students: 67, resultsSubmitted: false, level: 300 },
  ];

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
      <SampleDataNotice what="figures and courses" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Assigned Courses', value: 3, icon: <BookOpen size={20} /> },
          { label: 'Total Students', value: 194, icon: <Users size={20} /> },
          { label: 'Results Pending', value: 2, icon: <ClipboardList size={20} /> },
          { label: 'Materials Uploaded', value: 24, icon: <Upload size={20} /> },
        ].map((stat, i) => (
          <div key={i} className={`${CARD} p-4`}>
            <div className="w-fit rounded-xl bg-[#faf6ee] p-2.5 text-[#c5a55a] ring-1 ring-[#ece0c4] dark:bg-[#241f2c] dark:ring-[#3d3349]">
              {stat.icon}
            </div>
            <p className="mt-3 font-heading text-2xl font-bold tabular-nums text-[#33234a] dark:text-[#e4dcf0]">{stat.value}</p>
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
        <div className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
          {assignedCourses.map((course, i) => (
            <div key={i} className="px-5 py-4 flex items-center justify-between transition-colors hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {course.code.split(' ')[1]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">{course.code} - {course.title}</p>
                  <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">{course.students} students · Level {course.level}</p>
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

      {/* Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-5">
          <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0] mb-3">Today's Schedule</h3>
          <div className="space-y-3">
            {[
              { time: '9:00 AM', course: 'CSC 301', type: 'Lecture', room: 'Hall A' },
              { time: '11:00 AM', course: 'CSC 401', type: 'Supervision', room: 'Office' },
              { time: '2:00 PM', course: 'CSC 311', type: 'Lab Session', room: 'Lab 3' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-center min-w-[60px]">
                  <p className="text-xs font-bold text-blue-600">{item.time}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#4a4155] dark:text-[#c8c1d4]">{item.course} - {item.type}</p>
                  <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">{item.room}</p>
                </div>
                <button className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                  <Video size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-5">
          <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0] mb-3">Performance Overview</h3>
          <div className="space-y-3">
            {assignedCourses.map((course, i) => {
              const avgScore = [72, 65, 78][i];
              const passRate = [92, 85, 95][i];
              return (
                <div key={i} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-[#4a4155] dark:text-[#c8c1d4]">{course.code}</p>
                    <span className="text-xs text-[#a49bb0] dark:text-[#7b7289]">Avg: {avgScore}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${passRate}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#a49bb0] dark:text-[#7b7289] mt-1">{passRate}% pass rate</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
