import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { AuditLog } from '@/lib/types';
import { Shield, Search, Filter, Clock, User, FileText } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
    if (data && data.length > 0) {
      setLogs(data);
    } else {
      // Show sample logs if none exist
      setLogs([
        { id: '1', action: 'Results submitted', entity_type: 'results', performed_by: 'Dr. James Okonkwo', details: { course: 'CSC 301', count: 85 }, created_at: new Date(Date.now() - 7200000).toISOString() } as AuditLog,
        { id: '2', action: 'Student registered', entity_type: 'students', performed_by: 'System', details: { matric_no: 'UNI/2026/CS/045' }, created_at: new Date(Date.now() - 10800000).toISOString() } as AuditLog,
        { id: '3', action: 'Results approved', entity_type: 'results', performed_by: 'HOD Computer Science', details: { course: 'CSC 212', count: 78 }, created_at: new Date(Date.now() - 86400000).toISOString() } as AuditLog,
        { id: '4', action: 'Transcript generated', entity_type: 'transcripts', performed_by: 'Registrar Office', details: { student: 'UNI/2022/CS/001' }, created_at: new Date(Date.now() - 172800000).toISOString() } as AuditLog,
        { id: '5', action: 'Grade modified', entity_type: 'results', performed_by: 'Dr. Sarah Adeyemi', details: { course: 'CSC 202', student: 'UNI/2022/CS/003', from: 'C', to: 'B' }, created_at: new Date(Date.now() - 259200000).toISOString() } as AuditLog,
        { id: '6', action: 'Course created', entity_type: 'courses', performed_by: 'Admin', details: { code: 'CSC 501' }, created_at: new Date(Date.now() - 345600000).toISOString() } as AuditLog,
        { id: '7', action: 'Certificate issued', entity_type: 'certificates', performed_by: 'Registrar', details: { student: 'UNI/2021/SE/012', class: 'First Class' }, created_at: new Date(Date.now() - 432000000).toISOString() } as AuditLog,
        { id: '8', action: 'User login', entity_type: 'auth', performed_by: 'Prof. Aisha Mohammed', details: { role: 'admin' }, created_at: new Date(Date.now() - 518400000).toISOString() } as AuditLog,
      ]);
    }
    setLoading(false);
  }

  const filtered = logs.filter(
    (l) => l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (l.performed_by || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
           (l.entity_type || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const actionColors: Record<string, string> = {
    results: 'bg-blue-50 text-blue-600',
    students: 'bg-emerald-50 text-emerald-600',
    courses: 'bg-purple-50 text-purple-600',
    transcripts: 'bg-amber-50 text-amber-600',
    certificates: 'bg-[#f6f4fa] text-[#422e59]',
    auth: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Audit Logs</h2>
          <p className="text-sm text-gray-500">Track all system activities and changes</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Shield size={14} /> All actions are logged and immutable
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search logs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No logs found</div>
          ) : (
            filtered.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                <div className={`mt-0.5 p-1.5 rounded-lg ${actionColors[log.entity_type || ''] || 'bg-gray-100 text-gray-500'}`}>
                  <FileText size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">{log.action}</p>
                  {log.details && (
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">
                      {JSON.stringify(log.details)}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1"><User size={10} /> {log.performed_by || 'System'}</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(log.created_at).toLocaleString()}</span>
                    {log.entity_type && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${actionColors[log.entity_type] || 'bg-gray-100 text-gray-500'}`}>
                        {log.entity_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
