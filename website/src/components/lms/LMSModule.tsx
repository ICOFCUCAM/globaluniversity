import { SampleDataNotice } from '@/components/ui/portal';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { lmsMaterials } from '@/lib/sampleData';
import {
  FileText, Video, Upload, Download, Play, Search,
  FolderOpen, Clock, Users, ExternalLink, Plus, X,
  BookOpen, BarChart3, CheckCircle2
} from 'lucide-react';

export default function LMSModule() {
  const [activeTab, setActiveTab] = useState<'materials' | 'classes' | 'progress'>('materials');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', courseCode: '', type: 'pdf', file: null as File | null });

  const filteredMaterials = lmsMaterials.filter(
    (m) => m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.courseCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [sched, setSched] = useState({ course: '', title: '', lecturer: '', time: '', link: '', status: 'upcoming', attendees: 0 });

  async function loadClasses() {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('document_type', 'live-class')
      .order('uploaded_at', { ascending: false });
    if (data) {
      setLiveClasses(
        (data as any[])
          .map((d) => {
            try {
              return { id: d.id, ...JSON.parse(decodeURIComponent(escape(atob(d.file_url.split('base64,')[1])))) };
            } catch {
              return null;
            }
          })
          .filter(Boolean),
      );
    }
  }

  useEffect(() => {
    loadClasses();
  }, []);

  async function scheduleClass(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from('documents').insert({
      file_name: `${sched.course} · ${sched.title} · ${sched.time}`,
      file_url: `data:application/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify(sched))))}`,
      file_type: 'application/json',
      document_type: 'live-class',
    });
    setShowSchedule(false);
    setSched({ course: '', title: '', lecturer: '', time: '', link: '', status: 'upcoming', attendees: 0 });
    loadClasses();
  }

  const courseProgress = [
    { code: 'CSC 301', title: 'Artificial Intelligence', progress: 78, materials: 12, completed: 9 },
    { code: 'CSC 311', title: 'Machine Learning', progress: 65, materials: 10, completed: 6 },
    { code: 'CSC 202', title: 'Database Management', progress: 92, materials: 15, completed: 14 },
    { code: 'CSC 212', title: 'Web Technologies', progress: 85, materials: 8, completed: 7 },
    { code: 'CSC 303', title: 'Information Security', progress: 45, materials: 11, completed: 5 },
  ];

  function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setShowUploadModal(false);
    setUploadForm({ title: '', courseCode: '', type: 'pdf', file: null });
  }

  return (
    <div className="space-y-6">
      <SampleDataNotice what="sample course material" />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Learning Management System</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Course materials, live classes, and progress tracking</p>
        </div>
        <button onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors shadow-lg shadow-purple-900/20">
          <Upload size={16} /> Upload Material
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { id: 'materials' as const, label: 'Materials', icon: <FolderOpen size={14} /> },
          { id: 'classes' as const, label: 'Live Classes', icon: <Video size={14} /> },
          { id: 'progress' as const, label: 'Progress', icon: <BarChart3 size={14} /> },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-[#422e59] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search materials..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md pl-9 pr-4 py-2 bg-white rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMaterials.map((material) => (
              <div key={material.id} className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-4 hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-xl ${material.type === 'video' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                    {material.type === 'video' ? <Video size={20} /> : <FileText size={20} />}
                  </div>
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{material.courseCode}</span>
                </div>
                <h4 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0] mt-3 group-hover:text-blue-600 transition-colors">{material.title}</h4>
                <div className="flex items-center justify-between mt-3 text-xs text-[#a49bb0] dark:text-[#7b7289]">
                  <span>{material.size}</span>
                  <span>{material.downloads} downloads</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                    {material.type === 'video' ? <Play size={12} /> : <Download size={12} />}
                    {material.type === 'video' ? 'Watch' : 'Download'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Classes Tab */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Live sessions and recorded lectures for your courses</p>
            <button
              onClick={() => setShowSchedule(true)}
              className="flex items-center gap-2 rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-900/20 hover:bg-[#322244]"
            >
              <Plus size={16} /> Schedule Class
            </button>
          </div>
          {liveClasses.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-[#ece7f4] bg-white p-10 text-center text-sm text-gray-400">
              No classes scheduled yet. Use “Schedule Class” to add a live session or publish a recorded lecture.
            </p>
          )}
          {showSchedule && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSchedule(false)}>
              <form onSubmit={scheduleClass} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6">
                <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">Schedule Class / Add Recording</h3>
                {([['course','Course code'],['title','Session title'],['lecturer','Lecturer'],['time','When (e.g. Mon 14:00)'],['link','Meeting or recording URL']] as const).map(([k,label]) => (
                  <input
                    key={k}
                    required={k !== 'link'}
                    placeholder={label}
                    className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35"
                    value={(sched as any)[k]}
                    onChange={(e) => setSched({ ...sched, [k]: e.target.value })}
                  />
                ))}
                <select
                  className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35"
                  value={sched.status}
                  onChange={(e) => setSched({ ...sched, status: e.target.value })}
                >
                  <option value="upcoming">Upcoming live session</option>
                  <option value="live">Live now</option>
                  <option value="recorded">Recorded lecture</option>
                </select>
                <button className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#322244]">
                  Save
                </button>
              </form>
            </div>
          )}
          {liveClasses.map((cls) => (
            <div key={cls.id} className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-5 flex items-center justify-between hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  cls.status === 'live' ? 'bg-red-500 text-white animate-pulse' :
                  cls.status === 'upcoming' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  <Video size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">{cls.course}: {cls.title}</h4>
                    {cls.status === 'live' && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase animate-pulse">Live</span>
                    )}
                  </div>
                  <p className="text-xs text-[#a49bb0] dark:text-[#7b7289] mt-0.5">{cls.lecturer} · {cls.time}</p>
                  {cls.attendees > 0 && (
                    <p className="text-xs text-[#a49bb0] dark:text-[#7b7289] flex items-center gap-1 mt-0.5"><Users size={10} /> {cls.attendees} attendees</p>
                  )}
                </div>
              </div>
              <button className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                cls.status === 'live' ? 'bg-red-500 text-white hover:bg-red-600' :
                cls.status === 'upcoming' ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' :
                'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}>
                {cls.status === 'live' ? <><Play size={14} /> Join Now</> :
                 cls.status === 'upcoming' ? <><Clock size={14} /> Set Reminder</> :
                 <><Play size={14} /> Watch Recording</>}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Progress Tab */}
      {activeTab === 'progress' && (
        <div className="space-y-4">
          {courseProgress.map((course) => (
            <div key={course.code} className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">{course.code} - {course.title}</h4>
                  <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">{course.completed}/{course.materials} materials completed</p>
                </div>
                <span className={`text-lg font-bold ${course.progress >= 80 ? 'text-emerald-600' : course.progress >= 50 ? 'text-blue-600' : 'text-amber-600'}`}>
                  {course.progress}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-700 ${
                    course.progress >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                    course.progress >= 50 ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                    'bg-gradient-to-r from-amber-500 to-amber-400'
                  }`}
                  style={{ width: `${course.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowUploadModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#f0ece4] dark:border-[#2a2333] flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">Upload Material</h3>
              <button onClick={() => setShowUploadModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Course Code</label>
                <input value={uploadForm.courseCode} onChange={(e) => setUploadForm({ ...uploadForm, courseCode: e.target.value })}
                  placeholder="e.g. CSC 301" className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                <input value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select value={uploadForm.type} onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm">
                  <option value="pdf">PDF Document</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">File</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors cursor-pointer">
                  <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Click to upload or drag and drop</p>
                  <p className="text-xs text-[#a49bb0] dark:text-[#7b7289] mt-1">PDF, MP4, DOCX up to 500MB</p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244]">Upload</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
