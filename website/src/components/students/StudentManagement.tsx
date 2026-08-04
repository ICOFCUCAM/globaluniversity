import React, { useState, useEffect } from 'react';
import StudentIDCard from './StudentIDCard';
import { supabase } from '@/lib/supabase';
import type { Student } from '@/lib/types';
import { IMAGES } from '@/lib/constants';
import {
  Search, Plus, Filter, Download, Upload, Eye, Edit2,
  Trash2, ChevronLeft, ChevronRight, X, UserPlus, Check
} from 'lucide-react';

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [idCardStudent, setIdCardStudent] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form state
  const [form, setForm] = useState({
    first_name: '', last_name: '', middle_name: '', email: '', phone: '',
    date_of_birth: '', gender: 'Male', state_of_origin: '', program: 'Computer Science',
    degree_type: 'B.Sc.', admission_year: 2026,
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*, departments(name, code)')
      .order('created_at', { ascending: false });
    if (data) setStudents(data);
    setLoading(false);
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    const deptRes = await supabase.from('departments').select('id').eq('code', 'CS').single();
    if (!deptRes.data) return;

    const count = students.length + 1;
    const matric_no = `UNI/${form.admission_year}/CS/${String(count).padStart(3, '0')}`;

    const { error } = await supabase.from('students').insert({
      ...form,
      matric_no,
      department_id: deptRes.data.id,
      status: 'active',
      photo_url: IMAGES.students[count % 4],
    });

    if (!error) {
      setShowAddModal(false);
      setForm({ first_name: '', last_name: '', middle_name: '', email: '', phone: '', date_of_birth: '', gender: 'Male', state_of_origin: '', program: 'Computer Science', degree_type: 'B.Sc.', admission_year: 2026 });
      fetchStudents();
    }
  }

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.matric_no.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    applicant: 'bg-purple-50 text-purple-700',
    active: 'bg-emerald-50 text-emerald-700',
    graduated: 'bg-blue-50 text-blue-700',
    suspended: 'bg-red-50 text-red-700',
    withdrawn: 'bg-gray-100 text-gray-700',
    deferred: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Student Management</h2>
          <p className="text-sm text-gray-500">Manage student records, registration, and status</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors shadow-lg shadow-purple-900/20"
        >
          <UserPlus size={16} /> Register Student
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[250px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or matric number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30"
          >
            <option value="all">All Status</option>
            <option value="applicant">Applicants (pending review)</option>
            <option value="active">Active</option>
            <option value="graduated">Graduated</option>
            <option value="suspended">Suspended</option>
          </select>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Matric No</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Program</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No students found</td></tr>
              ) : (
                filtered.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={student.photo_url || IMAGES.students[0]}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {student.first_name} {student.middle_name ? student.middle_name.charAt(0) + '.' : ''} {student.last_name}
                          </p>
                          <p className="text-xs text-gray-400">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 font-mono">{student.matric_no}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{student.degree_type} {student.program}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{student.admission_year}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColors[student.status] || 'bg-gray-100 text-gray-600'}`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Register New Student</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
                  <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
                  <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Middle Name</label>
                <input value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label>
                  <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30">
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State of Origin</label>
                <input value={form.state_of_origin} onChange={(e) => setForm({ ...form, state_of_origin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Program</label>
                  <select value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30">
                    <option>Computer Science</option>
                    <option>Software Engineering</option>
                    <option>Business Information Systems</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Admission Year</label>
                  <input type="number" value={form.admission_year} onChange={(e) => setForm({ ...form, admission_year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors">
                  Register Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedStudent(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center border-b border-gray-100">
              <img src={selectedStudent.photo_url || IMAGES.students[0]} alt="" className="w-20 h-20 rounded-full object-cover mx-auto border-4 border-[#ece7f4]" />
              <h3 className="text-lg font-bold text-gray-800 mt-3">
                {selectedStudent.first_name} {selectedStudent.middle_name} {selectedStudent.last_name}
              </h3>
              <p className="text-sm text-gray-500 font-mono">{selectedStudent.matric_no}</p>
            </div>
            <div className="p-6 space-y-3">
              {[
                ['Program', `${selectedStudent.degree_type} ${selectedStudent.program}`],
                ['Email', selectedStudent.email],
                ['Phone', selectedStudent.phone || 'N/A'],
                ['Gender', selectedStudent.gender || 'N/A'],
                ['Admission Year', selectedStudent.admission_year],
                ['Status', selectedStudent.status],
              ].map(([label, value], i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-800 capitalize">{String(value)}</span>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => { setIdCardStudent(selectedStudent); }}
                className="flex-1 px-4 py-2.5 bg-[#422e59] text-[#f7dc79] rounded-xl text-sm font-semibold hover:bg-[#322244] transition-colors">
                🪪 ID Card
              </button>
              <button onClick={() => setSelectedStudent(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {idCardStudent && <StudentIDCard student={idCardStudent} onClose={() => setIdCardStudent(null)} />}
    </div>
  );
}
