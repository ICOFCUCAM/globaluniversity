import { SampleDataNotice } from '@/components/ui/portal';
import React, { useEffect, useState } from 'react';
import MyWeek from './MyWeek';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getGPAColor, getClassificationShort } from '@/lib/grading';
import {
  BookOpen, ClipboardList, FileText, Award, Monitor,
  Calendar, TrendingUp, Clock, Download, ArrowRight
} from 'lucide-react';
import type { ViewType } from '@/lib/types';

interface StudentDashboardProps {
  onNavigate: (view: ViewType) => void;
}

export default function StudentDashboard({ onNavigate }: StudentDashboardProps) {
  const { user } = useAuth();

  /**
   * The signed-in student's own record.
   *
   * This screen printed the signed-in student's NAME above another student's
   * CGPA, credits and classification, taken from sampleTranscriptData, and
   * described their programme as "B.Sc. Computer Science" — a subject this
   * university does not teach. A student saw their own name over a grade point
   * average that was not theirs, on the first screen after signing in, and had
   * no reason to doubt it.
   *
   * A wrong CGPA shown to the person it purports to describe is the single most
   * damaging thing a student portal can do. It is the number they use to decide
   * whether to retake a course, apply for a scholarship, or graduate.
   */
  const [record, setRecord] = useState<any | null>(null);
  const [approved, setApproved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    let live = true;
    (async () => {
      const { data: student } = await supabase
        .from('students')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      // Only approved results count towards a CGPA. A mark still in draft is a
      // lecturer's working note, and showing it to the student as their grade
      // pre-empts the HOD, the Dean and the Registrar.
      const { data: results } = student
        ? await supabase
            .from('results')
            .select('total_score, grade, grade_point, courses(code, title, credit_unit)')
            .eq('student_id', student.id)
            .eq('status', 'approved')
        : { data: [] as any[] };

      if (!live) return;
      setRecord(student ?? null);
      setApproved(results ?? []);
      setLoading(false);
    })();
    return () => { live = false; };
  }, [user?.id]);

  const credits = approved.reduce((sum, r: any) => sum + (r.courses?.credit_unit ?? 0), 0);
  const cgpa = credits > 0
    ? Number(
        (approved.reduce((sum, r: any) => sum + (r.grade_point ?? 0) * (r.courses?.credit_unit ?? 0), 0) / credits)
          .toFixed(2),
      )
    : null;
  const programme = record
    ? [record.degree_type, record.program].filter(Boolean).join(' ')
    : '';

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-[#422e59] to-[#3949ab] rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-blue-200 text-sm">Welcome back,</p>
          <h1 className="text-2xl font-bold mt-1">{user?.name}</h1>
          <p className="mt-1 text-sm text-white/70">
            {record?.student_number || user?.matricNo || '—'}
            {programme ? ` · ${programme}` : ''}
          </p>
          <div className="mt-4 flex flex-wrap gap-6">
            <div>
              <p className="text-3xl font-bold tabular-nums text-amber-300">
                {loading ? '…' : cgpa !== null ? cgpa.toFixed(2) : '—'}
              </p>
              <p className="text-xs text-white/60">
                {cgpa !== null ? 'CGPA' : 'No approved results yet'}
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold tabular-nums text-emerald-300">{loading ? '…' : credits}</p>
              <p className="text-xs text-white/60">Credits earned</p>
            </div>
            {cgpa !== null && (
              <div>
                <p className="mt-1 text-lg font-bold text-amber-300">{getClassificationShort(cgpa)}</p>
                <p className="text-xs text-white/60">Standing</p>
              </div>
            )}
          </div>
        </div>
        <div className="absolute right-6 top-6 w-20 h-20 rounded-full border-4 border-amber-400/30 flex items-center justify-center">
          <img src={user?.avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
        </div>
      </div>

      <MyWeek />


      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'My Courses', icon: <BookOpen size={20} />, color: 'from-blue-500 to-blue-600', view: 'courses' as ViewType },
          { label: 'View Results', icon: <ClipboardList size={20} />, color: 'from-emerald-500 to-emerald-600', view: 'results' as ViewType },
          { label: 'Transcript', icon: <FileText size={20} />, color: 'from-amber-500 to-amber-600', view: 'transcript' as ViewType },
          { label: 'LMS Portal', icon: <Monitor size={20} />, color: 'from-purple-500 to-purple-600', view: 'lms' as ViewType },
        ].map((action, i) => (
          <button
            key={i}
            onClick={() => onNavigate(action.view)}
            className="bg-white rounded-xl p-4 border border-[#ece7de] dark:border-[#2e2637] hover:shadow-lg transition-all duration-300 group text-left"
          >
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${action.color} text-white shadow-lg w-fit`}>
              {action.icon}
            </div>
            <p className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0] mt-3">{action.label}</p>
            <div className="flex items-center gap-1 text-xs text-[#a49bb0] dark:text-[#7b7289] mt-1 group-hover:text-blue-500 transition-colors">
              <span>Open</span>
              <ArrowRight size={12} />
            </div>
          </button>
        ))}
      </div>

      {/* The student's own approved results. The GPA-progress chart that stood
          here plotted another student's semester GPAs on a 5.00 axis; both the
          data and the axis were wrong. A per-semester series needs results to
          carry a semester, which they do not yet, so this lists what has
          actually been approved rather than drawing a shape. */}
      <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27]">
        <div className="flex items-center justify-between border-b border-[#f0ece4] px-5 py-4 dark:border-[#2a2333]">
          <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">Your approved results</h3>
          <span className="text-xs text-[#a49bb0]">
            {approved.length} course{approved.length === 1 ? '' : 's'} · {credits} credits
          </span>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-[#a49bb0]">Loading your record…</p>
        ) : !record ? (
          <p className="px-5 py-8 text-center text-sm text-[#6b6076] dark:text-[#9c93ad]">
            No student record is linked to this account yet. If you have just been admitted, the
            Registrar&apos;s office links it when your enrolment is completed.
          </p>
        ) : approved.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#6b6076] dark:text-[#9c93ad]">
            Nothing approved yet. Marks appear here once your lecturer has submitted them and they
            have been approved — a mark still being entered is not a result.
          </p>
        ) : (
          <div className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
            {approved.map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                    {r.courses?.code ?? '—'}
                  </p>
                  <p className="truncate text-xs text-[#a49bb0]">{r.courses?.title ?? ''}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`text-sm font-bold ${getGPAColor(r.grade_point ?? 0)}`}>
                    {r.grade ?? '—'}
                  </span>
                  <p className="text-[10px] tabular-nums text-[#a49bb0]">
                    {r.courses?.credit_unit ?? 0} credits
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The schedule block that stood here listed "CSC 412 Lecture, Today
          2:00 PM" and two more like it — a course this university does not
          teach, at a time nobody scheduled. It is removed rather than relabelled:
          a timetable is not a decoration, and an invented one sends a student to
          a room at an hour when nothing is happening. It returns when the
          timetable module holds real sessions. */}
    </div>
  );
}
