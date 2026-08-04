import React, { useState } from 'react';
import {
  BarChart3, TrendingUp, Users, GraduationCap, BookOpen,
  Award, Download, Calendar, Filter
} from 'lucide-react';

function BarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((val, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] font-medium text-gray-500">{val}</span>
          <div className={`w-full rounded-t ${color} transition-all duration-700`} style={{ height: `${(val / max) * 100}%`, minHeight: '4px' }} />
          <span className="text-[9px] text-gray-400 truncate max-w-full">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = (value / max) * 100;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          className="transition-all duration-1000" />
        <text x="50" y="48" textAnchor="middle" className="text-lg font-bold" fill="#1f2937">{pct.toFixed(0)}%</text>
        <text x="50" y="62" textAnchor="middle" className="text-[10px]" fill="#9ca3af">{label}</text>
      </svg>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState('2025/2026');

  const deptPerformance = [
    { name: 'Computer Science', avgGPA: 3.82, students: 450, passRate: 94 },
    { name: 'Software Engineering', avgGPA: 3.65, students: 320, passRate: 91 },
    { name: 'Business Info Systems', avgGPA: 3.41, students: 280, passRate: 88 },
    { name: 'Electrical Engineering', avgGPA: 3.28, students: 390, passRate: 85 },
    { name: 'Mechanical Engineering', avgGPA: 3.15, students: 410, passRate: 83 },
    { name: 'Business Administration', avgGPA: 3.52, students: 520, passRate: 90 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Analytics & Reports</h2>
          <p className="text-sm text-gray-500">Comprehensive academic performance analytics</p>
        </div>
        <div className="flex gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
            <option>2025/2026</option>
            <option>2024/2025</option>
            <option>2023/2024</option>
          </select>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-[#1a237e] text-white rounded-lg text-sm font-medium hover:bg-[#283593] transition-colors">
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Pass Rate', value: '89.3%', change: '+2.1%', icon: <TrendingUp size={20} />, color: 'from-emerald-500 to-emerald-600' },
          { label: 'Average CGPA', value: '3.47', change: '+0.12', icon: <BarChart3 size={20} />, color: 'from-blue-500 to-blue-600' },
          { label: 'First Class', value: '156', change: '+23', icon: <Award size={20} />, color: 'from-amber-500 to-amber-600' },
          { label: 'Graduation Rate', value: '92.1%', change: '+1.8%', icon: <GraduationCap size={20} />, color: 'from-purple-500 to-purple-600' },
        ].map((metric, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${metric.color} text-white shadow-lg w-fit`}>
              {metric.icon}
            </div>
            <p className="text-2xl font-bold text-gray-800 mt-3">{metric.value}</p>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-xs text-gray-500">{metric.label}</p>
              <span className="text-xs font-medium text-emerald-600">{metric.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Enrollment by Year</h3>
          <BarChart
            data={[520, 680, 750, 820, 890, 950]}
            labels={['2020', '2021', '2022', '2023', '2024', '2025']}
            color="bg-blue-500"
          />
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Grade Distribution</h3>
          <BarChart
            data={[156, 420, 680, 520, 180, 45]}
            labels={['A', 'B', 'C', 'D', 'E', 'F']}
            color="bg-purple-500"
          />
        </div>
      </div>

      {/* Donut Charts */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">Classification Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <DonutChart value={156} max={2847} color="#10b981" label="1st Class" />
          <DonutChart value={890} max={2847} color="#3b82f6" label="2nd Upper" />
          <DonutChart value={1200} max={2847} color="#8b5cf6" label="2nd Lower" />
          <DonutChart value={420} max={2847} color="#f59e0b" label="3rd Class" />
          <DonutChart value={181} max={2847} color="#ef4444" label="Pass/Fail" />
        </div>
      </div>

      {/* Department Performance */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Department Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Department</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Students</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Avg GPA</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Pass Rate</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deptPerformance.map((dept, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-gray-800">{dept.name}</td>
                  <td className="px-5 py-3 text-sm text-gray-600 text-center">{dept.students}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="text-sm font-bold text-blue-600">{dept.avgGPA}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 text-center">{dept.passRate}%</td>
                  <td className="px-5 py-3">
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full" style={{ width: `${dept.passRate}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
