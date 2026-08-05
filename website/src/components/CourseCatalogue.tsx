'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { courses, faculties, levels, type Course } from '@/content/courses';

export default function CourseCatalogue() {
  const [q, setQ] = useState('');
  const [faculty, setFaculty] = useState('all');
  const [level, setLevel] = useState('all');
  const [onlineOnly, setOnlineOnly] = useState(false);

  const results = useMemo(
    () =>
      courses.filter((c: Course) => {
        const text = `${c.code} ${c.title} ${c.summary}`.toLowerCase();
        return (
          (q === '' || text.includes(q.toLowerCase())) &&
          (faculty === 'all' || c.faculty === faculty) &&
          (level === 'all' || c.level === level) &&
          (!onlineOnly || c.online)
        );
      }),
    [q, faculty, level, onlineOnly],
  );

  const field =
    'rounded-xl border border-brand-sand bg-white px-4 py-2.5 text-sm text-brand-purple focus:border-brand-gold-deep focus:outline-none';

  return (
    <div>
      <div className="mb-10 rounded-2xl border border-brand-sand bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="course-search">
            Search courses
          </label>
          <input
            id="course-search"
            type="search"
            placeholder="Search courses by title, code or keyword…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`${field} min-w-[240px] flex-1`}
          />
          <select aria-label="Filter by faculty" value={faculty} onChange={(e) => setFaculty(e.target.value)} className={field}>
            <option value="all">All faculties</option>
            {faculties.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select aria-label="Filter by level" value={level} onChange={(e) => setLevel(e.target.value)} className={field}>
            <option value="all">All levels</option>
            {levels.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm font-medium text-brand-purple">
            <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
            Online only
          </label>
        </div>
        <p className="mt-3 text-xs text-brand-muted">
          {results.length} of {courses.length} courses
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {results.map((c) => (
          <article
            key={c.code}
            className="flex h-full flex-col rounded-2xl border border-brand-sand bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-xs font-bold tracking-wider text-brand-gold-deep">{c.code}</span>
              {c.online && (
                <span className="rounded-full bg-brand-purple px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-gold">
                  Online
                </span>
              )}
            </div>
            <h3 className="mt-2 font-heading text-lg font-bold text-brand-purple">{c.title}</h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-muted">
              {c.level} · {c.faculty}
            </p>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-brand-muted">{c.summary}</p>
            <Link
              href="/apply"
              className="mt-5 inline-block rounded-full bg-brand-gold px-5 py-2 text-center font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
            >
              Apply for this course
            </Link>
          </article>
        ))}
      </div>

      {results.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-brand-sand bg-white p-12 text-center text-brand-muted">
          No courses match your search. Try a different keyword or clear the filters.
        </p>
      )}
    </div>
  );
}
