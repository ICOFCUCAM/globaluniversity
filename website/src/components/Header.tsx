'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { site, type NavItem } from '@/content/site';

function DesktopItem({ item }: { item: NavItem }) {
  if (!item.children) {
    return (
      <Link
        href={item.href}
        className="whitespace-nowrap text-[13px] font-medium text-white/90 transition hover:text-brand-gold"
      >
        {item.label}
      </Link>
    );
  }
  return (
    <div className="group relative">
      <Link
        href={item.href}
        className="whitespace-nowrap text-[13px] font-medium text-white/90 transition group-hover:text-brand-gold"
      >
        {item.label} <span className="text-[10px]">▾</span>
      </Link>
      <div className="invisible absolute left-0 top-full z-50 w-64 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100">
        <div className="overflow-hidden rounded-lg bg-white text-brand-ink shadow-xl ring-1 ring-black/5">
          {item.children.map((c) => (
            <Link key={c.href + c.label} href={c.href} className="block px-4 py-2.5 text-sm hover:bg-brand-cream">
              {c.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [portalsOpen, setPortalsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const nav = site.nav as NavItem[];

  return (
    <header className="sticky top-0 z-50 bg-brand-purple text-white shadow-lg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:bg-brand-gold focus:px-4 focus:py-2 focus:text-brand-purple">
        Skip to content
      </a>
      <div className="hidden border-b border-white/10 bg-brand-purple-dark/60 lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-5 px-4 py-1.5 text-[11px] font-medium tracking-wide text-white/70">
          <span className="mr-auto text-brand-gold/90">The Community University of Africa · Buea, Cameroon</span>
          <Link href="/admissions" className="hover:text-brand-gold">Prospective Students</Link>
          <Link href="/portal" className="hover:text-brand-gold">Current Students</Link>
          <Link href="/international" className="hover:text-brand-gold">International</Link>
          <Link href="/faculty" className="hover:text-brand-gold">Faculty &amp; Staff</Link>
          <Link href="/support" className="hover:text-brand-gold">Alumni &amp; Giving</Link>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Image
            src="/images/site-icon.png"
            alt={`${site.name} crest`}
            width={44}
            height={44}
            className="rounded-full bg-white/90 p-0.5"
          />
          <span className="hidden font-heading text-base font-bold leading-tight md:block xl:text-lg">{site.name}</span>
        </Link>

        <nav className="hidden items-center gap-3 lg:flex">
          {nav.map((item) => (
            <DesktopItem key={item.label} item={item} />
          ))}
          <Link
            href="/apply"
            className="whitespace-nowrap rounded-full bg-brand-gold px-3 py-2 text-[13px] font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
          >
            Apply Now
          </Link>
          <div className="relative">
            <button
              onClick={() => setPortalsOpen((v) => !v)}
              aria-expanded={portalsOpen}
              aria-haspopup="true"
              className="whitespace-nowrap rounded-full border border-brand-gold px-3 py-2 text-[13px] font-semibold text-brand-gold transition hover:bg-brand-gold hover:text-brand-purple"
            >
              Student Portals ▾
            </button>
            {portalsOpen && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg bg-white text-brand-ink shadow-xl">
                {site.portals.map((p) => (
                  <a key={p.href} href={p.href} className="block px-4 py-2.5 text-sm hover:bg-brand-cream">
                    {p.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </nav>

        <button className="lg:hidden" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span className="block h-0.5 w-6 bg-white" />
          <span className="mt-1.5 block h-0.5 w-6 bg-white" />
          <span className="mt-1.5 block h-0.5 w-6 bg-white" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <nav className="absolute right-0 top-0 h-full w-80 max-w-[85vw] overflow-y-auto bg-brand-purple-dark px-5 pb-8 pt-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-heading text-sm font-bold text-brand-gold">Menu</span>
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white hover:bg-white/20"
              >
                ✕
              </button>
            </div>
          {nav.map((item) =>
            item.children ? (
              <div key={item.label}>
                <button
                  onClick={() => setExpanded((e) => (e === item.label ? null : item.label))}
                  className="flex w-full items-center justify-between py-2 text-sm font-medium text-white/90 hover:text-brand-gold"
                >
                  {item.label}
                  <span className={`text-xs transition ${expanded === item.label ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {expanded === item.label && (
                  <div className="ml-3 border-l border-white/10 pl-3">
                    {item.children.map((c) => (
                      <Link
                        key={c.href + c.label}
                        href={c.href}
                        onClick={() => setOpen(false)}
                        className="block py-2 text-sm text-white/80 hover:text-brand-gold"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block py-2 text-sm font-medium text-white/90 hover:text-brand-gold"
              >
                {item.label}
              </Link>
            ),
          )}
          <Link
            href="/apply"
            onClick={() => setOpen(false)}
            className="mt-3 block rounded-full bg-brand-gold px-4 py-2 text-center text-sm font-semibold text-brand-purple"
          >
            Apply Now
          </Link>
          <div className="mt-2 border-t border-white/10 pt-2">
            <p className="py-1 text-xs uppercase tracking-wide text-white/50">Student Portals</p>
            {site.portals.map((p) => (
              <a key={p.href} href={p.href} className="block py-2 text-sm text-white/90 hover:text-brand-gold">
                {p.label}
              </a>
            ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
