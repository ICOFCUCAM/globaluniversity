import { EmptyState } from '@/components/ui/portal';
import React, { useEffect, useState } from 'react';
import { write } from '@/lib/write';
import { listRecords, saveRecord } from '@/lib/moduleStore';
import {
  FileText, Video, Upload, Play, Search,
  FolderOpen, Clock, Users, ExternalLink, Plus, X,
  BarChart3
} from 'lucide-react';

export default function LMSModule() {
  const [activeTab, setActiveTab] = useState<'materials' | 'classes' | 'progress'>('materials');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', courseCode: '', type: 'pdf', url: '' });

  // -------------------------------------------------------------------------
  // MATERIALS ARE READ, NOT INVENTED.
  //
  // This list was six hardcoded rows: "Introduction to AI - Lecture 1",
  // "SQL Tutorial Complete Guide", "React Framework Masterclass", against
  // course codes CSC 301, CSC 202, CSC 212. The University teaches theology,
  // ministry, education, engineering and business — not one of those courses
  // exists, and the screen carried a banner admitting the rows were samples.
  //
  // A portal that labels its own content as illustrative has told the person
  // using it not to trust the screen. It now reads the same store the live
  // classes on this page already write to, and shows nothing when there is
  // nothing.
  // -------------------------------------------------------------------------
  const [materials, setMaterials] = useState<any[] | null>(null);

  async function loadMaterials() {
    const rows = await listRecords('lms', 'material');
    setMaterials(rows.map((r) => ({ id: r.id, ...(r.body as Record<string, unknown>) })));
  }

  const filteredMaterials = (materials ?? []).filter(
    (m: any) => String(m.title ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      || String(m.courseCode ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [sched, setSched] = useState({ course: '', title: '', lecturer: '', time: '', link: '', status: 'upcoming', attendees: 0 });

  async function loadClasses() {
    // Was `documents`, decoding base64 JSON out of the file_url column and
    // dropping any row that failed to parse. See src/lib/moduleStore.ts: those
    // writes never succeeded, because documents.student_id is NOT NULL and this
    // module never set it.
    const rows = await listRecords('lms', 'live-class');
    setLiveClasses(rows.map((r) => ({ id: r.id, ...(r.body as Record<string, unknown>) })));
  }

  useEffect(() => {
    loadClasses();
    loadMaterials();
  }, []);

  async function scheduleClass(e: React.FormEvent) {
    e.preventDefault();
    if (!(await write(saveRecord({
      module: 'lms',
      kind: 'live-class',
      title: `${sched.course} · ${sched.title} · ${sched.time}`,
      body: { ...sched },
    }), 'schedule the class'))) return;
    setShowSchedule(false);
    setSched({ course: '', title: '', lecturer: '', time: '', link: '', status: 'upcoming', attendees: 0 });
    loadClasses();
  }

  // -------------------------------------------------------------------------
  // THIS USED TO THROW THE FILE AWAY.
  //
  // The whole body was `setShowUploadModal(false)` and a form reset. A lecturer
  // filled the form, pressed Upload, watched the dialog close, and nothing was
  // written anywhere — the most convincing failure a screen can have, because
  // it looks exactly like success.
  //
  // The drop zone was not even a file input. It was a styled <div>, so no file
  // was ever selected to discard.
  //
  // WHAT IT DOES INSTEAD, AND WHAT IT DELIBERATELY DOES NOT CLAIM. There is no
  // storage bucket wired to this application, so it cannot accept a file and it
  // does not pretend to. It records a REFERENCE — the title, the course, the
  // kind and where the material lives — which is exactly what the live classes
  // on this same screen already store, and which survives a reload.
  // -------------------------------------------------------------------------
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!(await write(saveRecord({
      module: 'lms',
      kind: 'material',
      title: `${uploadForm.courseCode} · ${uploadForm.title}`,
      body: {
        courseCode: uploadForm.courseCode,
        title: uploadForm.title,
        type: uploadForm.type,
        url: uploadForm.url,
      },
    }), 'add the material'))) return;
    setShowUploadModal(false);
    setUploadForm({ title: '', courseCode: '', type: 'pdf', url: '' });
    loadMaterials();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Learning Management System</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Course materials, live classes, and progress tracking</p>
        </div>
        <button onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors shadow-lg shadow-purple-900/20">
          <Upload size={16} /> Add Material
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-[#f2eee6] dark:bg-[#2a2333] p-1 w-fit">
        {[
          { id: 'materials' as const, label: 'Materials', icon: <FolderOpen size={14} /> },
          { id: 'classes' as const, label: 'Live Classes', icon: <Video size={14} /> },
          { id: 'progress' as const, label: 'Progress', icon: <BarChart3 size={14} /> },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-[#422e59] shadow-sm' : 'text-[#6b6076] dark:text-[#9c93ad] hover:text-[#4a4155] dark:text-[#c8c1d4]'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a49bb0] dark:text-[#7b7289]" />
            <input type="text" placeholder="Search materials..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md pl-9 pr-4 py-2 bg-white rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
          </div>
          {materials !== null && materials.length === 0 && (
            <EmptyState
              icon={<FolderOpen size={22} />}
              title="No course materials yet"
              description="Material is attached to a course by its lecturer. Use “Add Material” to record lecture notes, a reading or a recording."
            />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMaterials.map((material) => (
              <div key={material.id} className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-4 hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-xl ${material.type === 'video' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                    {material.type === 'video' ? <Video size={20} /> : <FileText size={20} />}
                  </div>
                  <span className="text-[10px] font-medium text-[#a49bb0] dark:text-[#7b7289] bg-gray-50 px-2 py-0.5 rounded-full">{material.courseCode}</span>
                </div>
                <h4 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0] mt-3 group-hover:text-blue-600 transition-colors">{material.title}</h4>
                {/* NO SIZE, NO DOWNLOAD COUNT. Both were invented fields on the
                    sample rows — "2.4 MB", "145 downloads" — and neither is
                    measured anywhere. A figure nobody counts is worse beside
                    real records than absent, because it reads as counted. */}
                <div className="flex gap-2 mt-3">
                  {material.url ? (
                    <a href={String(material.url)} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                      {material.type === 'video' ? <Play size={12} /> : <ExternalLink size={12} />}
                      {material.type === 'video' ? 'Watch' : 'Open'}
                    </a>
                  ) : (
                    <span className="flex-1 px-3 py-2 text-center text-xs text-[#a49bb0] dark:text-[#7b7289]">
                      No link recorded
                    </span>
                  )}
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
            <p className="rounded-2xl border-2 border-dashed border-[#ece7f4] bg-white p-10 text-center text-sm text-[#a49bb0] dark:text-[#7b7289]">
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
                  cls.status === 'upcoming' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-[#6b6076] dark:text-[#9c93ad]'
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
                'bg-gray-50 text-[#6b6076] dark:text-[#9c93ad] hover:bg-gray-100'
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
      {/* ---------------------------------------------------------------
          PROGRESS IS NOT ASSERTED.

          This tab printed five progress bars — Artificial Intelligence 78%,
          Machine Learning 65%, Database Management 92% — as a hardcoded array.
          Nothing measured any of it, the courses do not exist, and a filled
          progress bar is about as confident as an interface gets.

          Real progress needs two things this system does not yet have: course
          material attached to a course, and a record of a student completing a
          piece of it. Until both exist, this says so.
          --------------------------------------------------------------- */}
      {activeTab === 'progress' && (
        <div className="space-y-4">
          <EmptyState
            icon={<BarChart3 size={22} />}
            title="Progress is not being tracked yet"
            description="Progress is measured from material attached to a course and a record of each student working through it. Neither is recorded yet, so there is nothing to report — rather than a figure nobody measured."
          />
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowUploadModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#f0ece4] dark:border-[#2a2333] flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">Add Material</h3>
              <button onClick={() => setShowUploadModal(false)} className="p-1 rounded-lg hover:bg-[#f2eee6] dark:hover:bg-[#2a2333]"><X size={18} /></button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad] mb-1">Course Code</label>
                <input value={uploadForm.courseCode} onChange={(e) => setUploadForm({ ...uploadForm, courseCode: e.target.value })}
                  placeholder="e.g. BIS 220" className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad] mb-1">Title</label>
                <input value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad] mb-1">Type</label>
                <select value={uploadForm.type} onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm">
                  <option value="pdf">PDF Document</option>
                  <option value="video">Video</option>
                </select>
              </div>
              {/* A LINK, NOT A DROP ZONE THAT NEVER TOOK A FILE.
                  What stood here promised "PDF, MP4, DOCX up to 500MB" and was
                  a <div> — not an <input type="file"> — inside a form whose
                  submit handler discarded everything anyway. No storage is
                  wired to this application, so the honest thing is to record
                  where the material actually lives. */}
              <div>
                <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad] mb-1">Where it lives</label>
                <input value={uploadForm.url} onChange={(e) => setUploadForm({ ...uploadForm, url: e.target.value })}
                  placeholder="https://…  link to the document or recording"
                  className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
                <p className="text-xs text-[#a49bb0] dark:text-[#7b7289] mt-1">
                  The University does not host files here yet. This records the material and where to find it.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2.5 border border-[#ded6c8] dark:border-[#3d3349] rounded-xl text-sm font-medium text-[#6b6076] dark:text-[#9c93ad] hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">Cancel</button>
                <button type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244]">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
