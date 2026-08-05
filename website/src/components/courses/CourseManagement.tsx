import React, { useState, useEffect } from 'react';
import { Card, EmptyState, SkeletonRows } from '@/components/ui/portal';
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
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Course Management</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{courses.length} courses across 4 years</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors shadow-lg shadow-purple-900/20">
          <Plus size={16} /> Add Course
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[250px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a49bb0] dark:text-[#7b7289]" />
            <input type="text" placeholder="Search courses..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
          </div>
          <select value={yearFilter} onChange={(e) => setYearFilter(Number(e.target.value))}
            className="px-3 py-2 bg-gray-50 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm">
            <option value={0}>All Years</option>
            <option value={1}>Year 1</option>
            <option value={2}>Year 2</option>
            <option value={3}>Year 3</option>
            <option value={4}>Year 4</option>
          </select>
          <select value={semesterFilter} onChange={(e) => setSemesterFilter(Number(e.target.value))}
            className="px-3 py-2 bg-gray-50 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm">
            <option value={0}>All Semesters</option>
            <option value={1}>First Semester</option>
            <option value={2}>Second Semester</option>
          </select>
        </div>
      </div>

      {/* Course Groups */}
      {loading ? (
        <Card className="overflow-hidden"><SkeletonRows rows={5} cols={3} /></Card>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen size={20} />}
            title="No courses in the catalogue yet"
            description="Courses added here appear in registration, the timetable and the transcript. Codes follow the university's own scheme — BTH101, EDU204 — not the template's CSC numbering."
          />
        </Card>
      ) : (
        Object.entries(grouped).map(([group, groupCourses]) => (
          <div key={group} className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#ece7de] bg-[#faf8f4] dark:border-[#2e2637] dark:bg-[#241f2c] flex items-center justify-between">
              <h3 className="font-semibold text-[#4a4155] dark:text-[#c8c1d4] text-sm">{group}</h3>
              <span className="text-xs text-[#a49bb0] dark:text-[#7b7289]">{groupCourses.length} courses · {groupCourses.reduce((s, c) => s + c.credit_unit, 0)} credits</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {groupCourses.map((course) => (
                <div key={course.id} className="p-4 border border-[#ece7de] dark:border-[#2e2637] rounded-xl hover:shadow-md transition-all duration-300 group cursor-pointer">
                  <div className="flex items-start justify-between">
                    {/* One treatment for every level. The gradient-per-level
                        map made 100-level blue and 400-level pink, which reads
                        as a meaning the university has not assigned. */}
                    <div className="rounded-lg bg-[#422e59] px-2.5 py-1 font-mono text-xs font-bold tabular-nums text-white">
                      {course.code}
                    </div>
                    <span className="text-xs text-[#a49bb0] dark:text-[#7b7289] font-medium">{course.credit_unit} CU</span>
                  </div>
                  <h4 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0] mt-3 transition-colors">{course.title}</h4>
                  <p className="text-xs text-[#a49bb0] dark:text-[#7b7289] mt-1 line-clamp-2">{course.description}</p>
                  <div className="flex items-center gap-3 mt-3 text-[10px] text-[#a49bb0] dark:text-[#7b7289]">
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
            <div className="px-6 py-4 border-b border-[#f0ece4] dark:border-[#2a2333] flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">Add New Course</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-[#f2eee6] dark:hover:bg-[#2a2333]"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddCourse} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad] mb-1">Course Code *</label>
                  <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. BTH101" className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad] mb-1">Credit Units *</label>
                  <input required type="number" min={1} max={6} value={form.credit_unit} onChange={(e) => setForm({ ...form, credit_unit: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad] mb-1">Course Title *</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad] mb-1">Level</label>
                  <select value={form.level} onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm">
                    <option value={100}>100</option><option value={200}>200</option><option value={300}>300</option><option value={400}>400</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad] mb-1">Semester</label>
                  <select value={form.semester} onChange={(e) => setForm({ ...form, semester: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm">
                    <option value={1}>First</option><option value={2}>Second</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad] mb-1">Year</label>
                  <select value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm">
                    <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad] mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 border border-[#ded6c8] dark:border-[#3d3349] rounded-xl text-sm font-medium text-[#6b6076] dark:text-[#9c93ad] hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">Cancel</button>
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
