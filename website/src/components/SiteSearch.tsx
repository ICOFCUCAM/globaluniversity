'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { searchIndex } from '@/content/searchIndex';

/** Command-palette style site search: ⌘K / Ctrl-K, or the header button. */
export default function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    return searchIndex
      .map((e) => {
        const title = e.title.toLowerCase();
        let score = 0;
        if (title === term) score = 100;
        else if (title.startsWith(term)) score = 60;
        else if (title.includes(term)) score = 40;
        else if (e.text.toLowerCase().includes(term)) score = 15;
        return { e, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((r) => r.e);
  }, [q]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search the site"
        className="whitespace-nowrap rounded-full border border-white/30 px-3 py-2 text-[12px] font-semibold text-white/90 transition hover:border-brand-gold hover:text-brand-gold"
      >
        Search
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-24"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Site search"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-brand-sand px-5 py-4">
              <span aria-hidden="true" className="text-brand-muted"></span>
              <input
                ref={inputRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search programs, admissions, courses, people…"
                className="w-full bg-transparent text-brand-purple placeholder:text-brand-muted/60 focus:outline-none"
              />
              <kbd className="hidden rounded border border-brand-sand px-1.5 py-0.5 text-[10px] text-brand-muted sm:block">ESC</kbd>
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {q.trim().length < 2 && (
                <p className="px-5 py-8 text-center text-sm text-brand-muted">
                  Type at least two characters. Try “doctoral”, “scholarship”, “transcript” or “theology”.
                </p>
              )}
              {q.trim().length >= 2 && results.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-brand-muted">
                  Nothing found for “{q}”. Try another term, or{' '}
                  <Link href="/contact" onClick={() => setOpen(false)} className="font-semibold text-brand-gold-deep underline">
                    contact us
                  </Link>
                  .
                </p>
              )}
              {results.map((r) => (
                <Link
                  key={r.href + r.title + r.section}
                  href={r.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-brand-cream px-5 py-3 transition last:border-0 hover:bg-brand-cream"
                >
                  <p className="font-heading text-sm font-semibold text-brand-purple">{r.title}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-gold-ink">
                    {r.section}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
