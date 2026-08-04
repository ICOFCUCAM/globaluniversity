'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { site } from '@/content/site';

export default function Header() {
  const [open, setOpen] = useState(false);
  const [portalsOpen, setPortalsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-brand-purple text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/site-icon.png"
            alt={`${site.name} crest`}
            width={44}
            height={44}
            className="rounded-full bg-white/90 p-0.5"
          />
          <span className="font-heading text-lg font-bold leading-tight sm:text-xl">
            {site.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-white/90 transition hover:text-brand-gold"
            >
              {item.label}
            </Link>
          ))}
          <div className="relative">
            <button
              onClick={() => setPortalsOpen((v) => !v)}
              className="rounded-full bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
            >
              Student Portals ▾
            </button>
            {portalsOpen && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg bg-white text-brand-ink shadow-xl">
                {site.portals.map((p) => (
                  <a
                    key={p.href}
                    href={p.href}
                    className="block px-4 py-2.5 text-sm hover:bg-brand-cream"
                  >
                    {p.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </nav>

        <button
          className="lg:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="block h-0.5 w-6 bg-white" />
          <span className="mt-1.5 block h-0.5 w-6 bg-white" />
          <span className="mt-1.5 block h-0.5 w-6 bg-white" />
        </button>
      </div>

      {open && (
        <nav className="border-t border-white/10 bg-brand-purple-dark px-4 py-3 lg:hidden">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium text-white/90 hover:text-brand-gold"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 border-t border-white/10 pt-2">
            <p className="py-1 text-xs uppercase tracking-wide text-white/50">Student Portals</p>
            {site.portals.map((p) => (
              <a key={p.href} href={p.href} className="block py-2 text-sm text-white/90 hover:text-brand-gold">
                {p.label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
