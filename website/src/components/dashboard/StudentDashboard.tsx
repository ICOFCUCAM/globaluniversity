import React from 'react';
import MyWeek from './MyWeek';
import { useAuth } from '@/contexts/AuthContext';
import { sampleTranscriptData } from '@/lib/sampleData';
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
  const data = sampleTranscriptData;

  // Calculate current semester results
  const currentYear = data.years[data.years.length - 1];
  const currentSem = currentYear?.semesters[currentYear.semesters.length - 1];

  const semesterGPAs = data.years.flatMap((y) =>
    y.semesters.map((s, si) => ({
      label: `Y${y.year}S${s.semester}`,
      gpa: s.gpa,
    }))
  );

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-[#422e59] to-[#3949ab] rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-blue-200 text-sm">Welcome back,</p>
          <h1 className="text-2xl font-bold mt-1">{user?.name}</h1>
          <p className="text-blue-200 text-sm mt-1">{user?.matricNo} · B.Sc. Computer Science</p>
          <div className="flex gap-6 mt-4">
            <div>
              <p className="text-3xl font-bold text-amber-300">{data.cgpa}</p>
              <p className="text-xs text-blue-200">Current CGPA</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-300">{data.totalCredits}</p>
              <p className="text-xs text-blue-200">Credits Earned</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-300 mt-1">{getClassificationShort(data.cgpa)}</p>
              <p className="text-xs text-blue-200">Classification</p>
            </div>
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
            className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-lg transition-all duration-300 group text-left"
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

      {/* GPA Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0] mb-4">GPA Progress</h3>
          <div className="flex items-end gap-2 h-32">
            {semesterGPAs.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-gray-600">{s.gpa}</span>
                <div
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all duration-500"
                  style={{ height: `${(s.gpa / 5) * 100}%` }}
                />
                <span className="text-[9px] text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Current Semester Courses */}
        <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27]">
          <div className="px-5 py-4 border-b border-[#f0ece4] dark:border-[#2a2333] flex items-center justify-between">
            <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">Current Semester</h3>
            <span className="text-xs text-[#a49bb0] dark:text-[#7b7289]">Year 4, Semester 2</span>
          </div>
          <div className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
            {currentSem?.courses.map((course, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{course.code}</p>
                  <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">{course.title}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${getGPAColor(course.gradePoint)}`}>{course.grade}</span>
                  <p className="text-[10px] text-gray-400">{course.creditUnit} CU</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming */}
      <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-5">
        <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0] mb-3">Upcoming Schedule</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { title: 'CSC 412 Lecture', time: 'Today, 2:00 PM', type: 'Live Class', color: 'border-l-blue-500' },
            { title: 'CSC 414 Assignment Due', time: 'Tomorrow, 11:59 PM', type: 'Assignment', color: 'border-l-amber-500' },
            { title: 'CSC 411 Project Defense', time: 'April 15, 9:00 AM', type: 'Exam', color: 'border-l-red-500' },
          ].map((item, i) => (
            <div key={i} className={`p-3 bg-gray-50 rounded-lg border-l-4 ${item.color}`}>
              <p className="text-sm font-medium text-gray-700">{item.title}</p>
              <p className="text-xs text-[#a49bb0] dark:text-[#7b7289] mt-1 flex items-center gap-1">
                <Clock size={10} /> {item.time}
              </p>
              <span className="text-[10px] font-medium text-gray-500 mt-1 inline-block">{item.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
