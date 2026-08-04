import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Course } from '@/lib/types';
import {
  Search, Plus, Filter, BookOpen, Clock, Users, X, ChevronDown
} from 'lucide-react';

export default function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState(0);
  const [semesterFilter, setSemesterFilter] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ code: '', title: '', credit_unit: 3, level: 100, semester: 1, year: 1, description: '' });

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    setLoading(true);
    const { data } = await supabase.from('courses').select('*').order('year').order('semester').order('code');
    if (data) setCourses(data);
    setLoading(false);
  }

  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault();
    const deptRes = await supabase.from('departments').select('id').eq('code', 'CS').single();
    if (!deptRes.data) return;
    const { error } = await supabase.from('courses').insert({ ...form, department_id: deptRes.data.id });
    if (!error) {
      setShowAddModal(false);
      setForm({ code: '', title: '', credit_unit: 3, level: 100, semester: 1, year: 1, description: '' });
      fetchCourses();
    }
  }

  const filtered = courses.filter((c) => {
    const matchesSearch = c.code.toLowerCase().includes(searchQuery.toLowerCase()) || c.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = yearFilter === 0 || c.year === yearFilter;
    const matchesSem = semesterFilter === 0 || c.semester === semesterFilter;
    return matchesSearch && matchesYear && matchesSem;
  });

  // Group by year and semester
  const grouped = filtered.reduce((acc, course) => {
    const key = `Year ${course.year} - ${course.semester === 1 ? 'First' : 'Second'} Semester`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(course);
    return acc;
  }, {} as Record<string, Course[]>);

  const levelColors: Record<number, string> = {
    100: 'from-blue-500 to-blue-600',
    200: 'from-emerald-500 to-emerald-600',
    300: 'from-purple-500 to-purple-600',
    400: 'from-amber-500 to-amber-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Course Management</h2>
          <p className="text-sm text-gray-500">{courses.length} courses across 4 years</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors shadow-lg shadow-blue-500/20">
          <Plus size={16} /> Add Course
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[250px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search courses..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <select value={yearFilter} onChange={(e) => setYearFilter(Number(e.target.value))}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <option value={0}>All Years</option>
            <option value={1}>Year 1</option>
            <option value={2}>Year 2</option>
            <option value={3}>Year 3</option>
            <option value={4}>Year 4</option>
          </select>
          <select value={semesterFilter} onChange={(e) => setSemesterFilter(Number(e.target.value))}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <option value={0}>All Semesters</option>
            <option value={1}>First Semester</option>
            <option value={2}>Second Semester</option>
          </select>
        </div>
      </div>

      {/* Course Groups */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading courses...</div>
      ) : (
        Object.entries(grouped).map(([group, groupCourses]) => (
          <div key={group} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-700 text-sm">{group}</h3>
              <span className="text-xs text-gray-400">{groupCourses.length} courses · {groupCourses.reduce((s, c) => s + c.credit_unit, 0)} credits</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {groupCourses.map((course) => (
                <div key={course.id} className="p-4 border border-gray-100 rounded-xl hover:shadow-md transition-all duration-300 group cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className={`px-2.5 py-1 rounded-lg bg-gradient-to-r ${levelColors[course.level] || 'from-gray-500 to-gray-600'} text-white text-xs font-bold`}>
                      {course.code}
                    </div>
                    <span className="text-xs text-gray-400 font-medium">{course.credit_unit} CU</span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-800 mt-3 group-hover:text-blue-600 transition-colors">{course.title}</h4>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{course.description}</p>
                  <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1"><Clock size={10} /> Level {course.level}</span>
                    <span>Sem {course.semester}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Add Course Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Add New Course</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddCourse} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Course Code *</label>
                  <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. CSC 501" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Credit Units *</label>
                  <input required type="number" min={1} max={6} value={form.credit_unit} onChange={(e) => setForm({ ...form, credit_unit: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Course Title *</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Level</label>
                  <select value={form.level} onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value={100}>100</option><option value={200}>200</option><option value={300}>300</option><option value={400}>400</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Semester</label>
                  <select value={form.semester} onChange={(e) => setForm({ ...form, semester: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value={1}>First</option><option value={2}>Second</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                  <select value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244]">Add Course</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
