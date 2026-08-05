'use client';

// Programme resources — reading lists and materials for enrolled students.
// Rendered only inside AppLayout, which is only reachable once AuthContext
// reports an authenticated user, so nothing here reaches the public site.
import React from 'react';
import { bltReadingList, readingListNote } from '@/content/programmeResources';
import { bltCurriculum, bltProgramme } from '@/content/blackLiberationTheology';
import { BookMarked, Lock, GraduationCap } from 'lucide-react';

export default function ProgrammeResources() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Programme Resources</h2>
        <p className="text-sm text-gray-500">
          Reading lists and study materials for your programme
        </p>
      </div>

      {/* Make the gating visible: students should know this is theirs. */}
      <div className="flex items-start gap-3 rounded-xl border border-[#ece7f4] bg-[#f6f4fa] p-4">
        <Lock size={16} className="mt-0.5 shrink-0 text-[#422e59]" />
        <p className="text-xs leading-relaxed text-gray-600">
          These materials are provided to enrolled students and are not published on the public
          website. Please do not redistribute them outside the university.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex items-center gap-2.5">
          <GraduationCap size={17} className="text-[#422e59]" />
          <h3 className="font-semibold text-gray-800">{bltProgramme.award}</h3>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {bltProgramme.duration} · {bltProgramme.structure} · {bltProgramme.credits}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {bltCurriculum.map((sem) => (
            <div key={`${sem.year}-${sem.label}`} className="rounded-xl bg-gray-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#e9c14a]">
                {sem.year}
              </p>
              <p className="text-sm font-semibold text-gray-800">{sem.label}</p>
              <ul className="mt-2 space-y-1">
                {sem.modules.map((m) => (
                  <li key={m.code} className="text-xs text-gray-600">
                    <span className="font-mono font-semibold text-[#422e59]">{m.code}</span> {m.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex items-center gap-2.5">
          <BookMarked size={17} className="text-[#422e59]" />
          <h3 className="font-semibold text-gray-800">Core Reading List</h3>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{readingListNote}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {bltReadingList.map((g) => (
            <div key={g.area} className="rounded-xl border border-gray-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#e9c14a]">
                {g.area}
              </p>
              <ul className="mt-2.5 space-y-2">
                {g.works.map((w) => (
                  <li key={w.title + (w.author ?? '')} className="text-sm leading-snug text-gray-700">
                    <span className="font-medium">{w.title}</span>
                    {w.author && <span className="block text-xs text-gray-400">{w.author}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
