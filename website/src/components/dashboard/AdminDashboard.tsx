import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { dashboardStats, recentActivities } from '@/lib/sampleData';
import { IMAGES, UNIVERSITY } from '@/lib/constants';
import {
  Users, GraduationCap, BookOpen, Building2, ClipboardList,
  Clock, Award, Monitor, TrendingUp, TrendingDown, ArrowUpRight,
  FileText, PenTool, AlertCircle, CheckCircle2, XCircle
} from 'lucide-react';

const statCards = [
  { label: 'Total Students', value: dashboardStats.totalStudents, icon: <Users size={22} />, color: 'from-blue-500 to-blue-600', change: '+12%' },
  { label: 'Total Lecturers', value: dashboardStats.totalLecturers, icon: <GraduationCap size={22} />, color: 'from-emerald-500 to-emerald-600', change: '+3%' },
  { label: 'Active Courses', value: dashboardStats.totalCourses, icon: <BookOpen size={22} />, color: 'from-purple-500 to-purple-600', change: '+8%' },
  { label: 'Departments', value: dashboardStats.totalDepartments, icon: <Building2 size={22} />, color: 'from-amber-500 to-amber-600', change: '0%' },
  { label: 'Enrollments', value: dashboardStats.activeEnrollments, icon: <ClipboardList size={22} />, color: 'from-cyan-500 to-cyan-600', change: '+15%' },
  { label: 'Pending Results', value: dashboardStats.pendingResults, icon: <Clock size={22} />, color: 'from-red-500 to-red-600', change: '-5%' },
  { label: 'Graduated', value: dashboardStats.graduatedStudents, icon: <Award size={22} />, color: 'from-indigo-500 to-indigo-600', change: '+22%' },
  { label: 'Ongoing Exams', value: dashboardStats.ongoingExams, icon: <PenTool size={22} />, color: 'from-pink-500 to-pink-600', change: '+2' },
];

const activityIcons: Record<string, React.ReactNode> = {
  result: <ClipboardList size={16} className="text-blue-500" />,
  student: <Users size={16} className="text-emerald-500" />,
  lms: <Monitor size={16} className="text-purple-500" />,
  transcript: <FileText size={16} className="text-amber-500" />,
  exam: <PenTool size={16} className="text-pink-500" />,
  certificate: <Award size={16} className="text-indigo-500" />,
};

// Simple bar chart component
function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((val, i) => (
        <div
          key={i}
          className={`flex-1 rounded-t ${color} transition-all duration-500`}
          style={{ height: `${(val / max) * 100}%`, minHeight: '4px' }}
        />
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [dbStudents, setDbStudents] = useState<any[]>([]);
  const [dbCourses, setDbCourses] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      const [studentsRes, coursesRes] = await Promise.all([
        supabase.from('students').select('*, departments(name, code)').limit(10),
        supabase.from('courses').select('*').limit(10),
      ]);
      if (studentsRes.data) setDbStudents(studentsRes.data);
      if (coursesRes.data) setDbCourses(coursesRes.data);
    }
    fetchData();
  }, []);

  const enrollmentData = [45, 62, 78, 55, 89, 72, 95, 88, 76, 92, 85, 98];
  const gpaDistribution = [12, 35, 48, 65, 82, 45, 28];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#422e59] via-[#322244] to-[#3949ab] p-6 text-white">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">Welcome back, Administrator</h1>
          {/* The university's own name, from constants. This read "Federal
              University of Technology" — the name of the template this portal
              was built from — and said so on the live deployment. */}
          <p className="mt-1 text-white/70">Here&apos;s what&apos;s happening at {UNIVERSITY.name} today.</p>
          <div className="flex gap-3 mt-4">
            <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-sm transition-colors">
              View Reports
            </button>
            <button className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm transition-colors backdrop-blur">
              Manage Users
            </button>
          </div>
        </div>
        <img
          src={IMAGES.hero}
          alt="Campus"
          className="absolute right-0 top-0 h-full w-1/3 object-cover opacity-20 rounded-r-2xl"
        />
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-r from-[#322244] to-transparent" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-lg transition-all duration-300 group">
            <div className="flex items-start justify-between">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg`}>
                {stat.icon}
              </div>
              <span className={`text-xs font-medium flex items-center gap-0.5 ${
                stat.change.startsWith('+') ? 'text-emerald-600' : stat.change.startsWith('-') ? 'text-red-500' : 'text-gray-400'
              }`}>
                {stat.change.startsWith('+') ? <TrendingUp size={12} /> : stat.change.startsWith('-') ? <TrendingDown size={12} /> : null}
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-800 mt-3">{stat.value.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrollment Trends */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800">Enrollment Trends</h3>
              <p className="text-xs text-gray-400">Monthly enrollment over the past year</p>
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
              <ArrowUpRight size={12} /> 15.3%
            </span>
          </div>
          <MiniBarChart data={enrollmentData} color="bg-blue-500" />
          <div className="flex justify-between mt-2 text-[10px] text-gray-400">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>

        {/* GPA Distribution */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800">GPA Distribution</h3>
              <p className="text-xs text-gray-400">Current semester student performance</p>
            </div>
          </div>
          <MiniBarChart data={gpaDistribution} color="bg-gradient-to-t from-purple-500 to-purple-400" />
          <div className="flex justify-between mt-2 text-[10px] text-gray-400">
            {['0-1.0', '1.0-1.5', '1.5-2.4', '2.4-3.5', '3.5-4.5', '4.5-5.0', '5.0'].map((r) => (
              <span key={r}>{r}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                <div className="mt-0.5 p-1.5 bg-gray-100 rounded-lg">
                  {activityIcons[activity.type] || <AlertCircle size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">{activity.action}</p>
                  <p className="text-xs text-gray-500 truncate">{activity.detail}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">by {activity.by} · {activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions & DB Students */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Add Student', icon: <Users size={16} />, color: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
                { label: 'Add Course', icon: <BookOpen size={16} />, color: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
                { label: 'Enter Results', icon: <ClipboardList size={16} />, color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
                { label: 'Transcript', icon: <FileText size={16} />, color: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
                { label: 'Certificate', icon: <Award size={16} />, color: 'bg-[#f6f4fa] text-[#422e59] hover:bg-indigo-100' },
                { label: 'Schedule Exam', icon: <PenTool size={16} />, color: 'bg-pink-50 text-pink-600 hover:bg-pink-100' },
              ].map((action, i) => (
                <button
                  key={i}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${action.color}`}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Pending Approvals</h3>
            <div className="space-y-2">
              {[
                { label: 'CSC 301 Results', status: 'pending', count: 85 },
                { label: 'CSC 202 Results', status: 'pending', count: 92 },
                { label: 'New Registrations', status: 'review', count: 15 },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{item.label}</p>
                    <p className="text-[10px] text-gray-400">{item.count} items</p>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-1.5 bg-emerald-100 text-emerald-600 rounded-md hover:bg-emerald-200 transition-colors">
                      <CheckCircle2 size={14} />
                    </button>
                    <button className="p-1.5 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors">
                      <XCircle size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
