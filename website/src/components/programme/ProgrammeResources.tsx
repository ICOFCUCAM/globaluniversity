'use client';

// Programme resources — reading lists and materials for enrolled students.
// Rendered only inside AppLayout, which is only reachable once AuthContext
// reports an authenticated user, so nothing here reaches the public site.
import React from 'react';
import {
  bltReadingList,
  readingListNote,
  blackHebrewsReading,
  blackHebrewsReadingNote,
  mthReading,
  mthReadingNote,
} from '@/content/programmeResources';
import { bltCurriculum, bltProgramme } from '@/content/blackLiberationTheology';
import { courseMaterials } from '@/content/courseMaterial';
import { BookMarked, Lock, GraduationCap, FileText } from 'lucide-react';

function ReadingSection({
  title,
  note,
  groups,
}: {
  title: string;
  note: string;
  groups: { area: string; works: { title: string; author?: string }[] }[];
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6">
      <div className="flex items-center gap-2.5">
        <BookMarked size={17} className="text-[#422e59]" />
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{note}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.area} className="rounded-xl border border-gray-100 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#e9c14a]">{g.area}</p>
            <ul className="mt-2.5 space-y-2">
              {g.works.map((w) => (
                <li key={w.title + (w.author ?? '')} className="text-sm leading-snug text-gray-700">
                  {w.author && <span className="font-medium text-gray-800">{w.author} </span>}
                  <span>{w.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

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

      {/* Full teaching material — the syllabus text itself */}
      {courseMaterials.map((m) => (
        <section key={m.code} className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="flex items-center gap-2.5">
            <FileText size={17} className="text-[#422e59]" />
            <h3 className="font-semibold text-gray-800">
              <span className="font-mono text-[#e9c14a]">{m.code}</span> {m.title}
            </h3>
            <span className="ml-auto text-xs text-gray-400">{m.ects} ECTS</span>
          </div>
          {m.subtitle && <p className="mt-1 text-xs italic text-gray-500">{m.subtitle}</p>}

          <div className="mt-5 space-y-2">
            {m.units.map((u) => (
              <details key={u.number} className="group rounded-xl border border-gray-100">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <span className="font-mono text-xs font-bold text-[#e9c14a]">
                    {String(u.number).padStart(2, '0')}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-gray-800">{u.title}</span>
                  <span aria-hidden="true" className="text-xs text-gray-400 transition group-open:rotate-180">▾</span>
                </summary>
                <div className="space-y-4 px-4 pb-5 pt-1">
                  {u.sections.map((s) => (
                    <div key={s.heading}>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#422e59]">{s.heading}</p>
                      {s.body.map((b, bi) => (
                        <p key={bi} className="mt-2 text-[13px] leading-relaxed text-gray-600">{b}</p>
                      ))}
                      {s.list && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {s.list.map((l) => (
                            <li key={l} className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] text-gray-600">{l}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>

          {m.assessment && (
            <div className="mt-5 rounded-xl bg-gray-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#e9c14a]">Assessment</p>
              <ul className="mt-2.5 space-y-2">
                {m.assessment.map((a) => (
                  <li key={a.label} className="text-sm text-gray-700">
                    <span className="font-medium">{a.label}</span>
                    <span className="ml-2 font-mono text-xs font-bold text-[#422e59]">{a.weight}</span>
                    {a.detail && <span className="block text-xs text-gray-500">{a.detail.join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {m.reading && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#e9c14a]">Required reading</p>
              <ul className="mt-2 space-y-1">
                {m.reading.map((r) => (
                  <li key={r} className="text-[13px] text-gray-600">{r}</li>
                ))}
              </ul>
            </div>
          )}

          {m.pending && (
            <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
              Still being written: {m.pending.join('; ')}.
            </p>
          )}
        </section>
      ))}

      <ReadingSection
        title="M.A. Black Liberation Theology — Core Reading"
        note={readingListNote}
        groups={bltReadingList}
      />
      <ReadingSection
        title="Master of Theology — Selected Reading"
        note={mthReadingNote}
        groups={mthReading}
      />
      <ReadingSection
        title="The Black Hebrews — Recommended Reading"
        note={blackHebrewsReadingNote}
        groups={blackHebrewsReading}
      />
    </div>
  );
}
