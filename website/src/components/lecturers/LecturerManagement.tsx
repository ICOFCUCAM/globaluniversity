import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Lecturer } from '@/lib/types';
import { IMAGES } from '@/lib/constants';
import { Search, Plus, Mail, Phone, BookOpen, Eye } from 'lucide-react';

export default function LecturerManagement() {
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data } = await supabase.from('lecturers').select('*, departments(name, code)').order('last_name');
      if (data) setLecturers(data);
      setLoading(false);
    }
    fetch();
  }, []);

  const filtered = lecturers.filter((l) =>
    `${l.first_name} ${l.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.staff_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.specialization || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Lecturer Management</h2>
          <p className="text-sm text-gray-500">{lecturers.length} lecturers across all departments</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors shadow-lg shadow-purple-900/20">
          <Plus size={16} /> Add Lecturer
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search lecturers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((lecturer) => (
            <div key={lecturer.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg transition-all duration-300 group">
              <div className="text-center">
                <img
                  src={lecturer.photo_url || IMAGES.professors[0]}
                  alt={`${lecturer.first_name} ${lecturer.last_name}`}
                  className="w-20 h-20 rounded-full object-cover mx-auto border-3 border-[#ece7f4] group-hover:border-blue-300 transition-colors"
                />
                <h4 className="text-sm font-bold text-gray-800 mt-3">{lecturer.title} {lecturer.first_name} {lecturer.last_name}</h4>
                <p className="text-xs text-gray-400 font-mono">{lecturer.staff_id}</p>
                <p className="text-xs text-blue-600 mt-1">{lecturer.specialization}</p>
                {lecturer.departments && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Dept. of {(lecturer.departments as any).name}</p>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                  <Mail size={12} /> Email
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors">
                  <Eye size={12} /> View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
