'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { site, type NavItem } from '@/content/site';
import { fr } from '@/content/fr';
import SiteSearch from './SiteSearch';
import ThemeToggle from './ThemeToggle';
import Crest from './Crest';

function DesktopItem({ item }: { item: NavItem }) {
  const hasMenu = Boolean(item.groups?.length || item.children?.length);
  if (!hasMenu) {
    return (
      <Link
        href={item.href}
        className="whitespace-nowrap px-1 py-2 text-sm font-medium text-white/90 transition hover:text-brand-gold"
      >
        {item.label}
      </Link>
    );
  }

  const cols = item.groups?.length ?? 1;
  return (
    <div className="group relative">
      <Link
        href={item.href}
        className="whitespace-nowrap px-1 py-2 text-sm font-medium text-white/90 transition group-hover:text-brand-gold group-focus-within:text-brand-gold"
      >
        {item.label} <span aria-hidden="true" className="text-[10px]">▾</span>
      </Link>
      <div
        // focus-within as well as hover: without it a keyboard user tabbing
        // through the bar can never open a mega-menu.
        className={`invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${
          cols >= 3 ? 'w-[46rem]' : cols === 2 ? 'w-[34rem]' : 'w-64'
        }`}
      >
        <div className="overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
          <div className="h-1 bg-gradient-to-r from-brand-gold-deep via-brand-gold to-brand-gold-deep" />
          {item.groups ? (
            <div className={`grid gap-x-6 gap-y-5 p-6 ${cols >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {item.groups.map((g) => (
                <div key={g.heading}>
                  <p className="mb-2 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold-deep">
                    {g.heading}
                  </p>
                  <ul className="space-y-1">
                    {g.items.map((c) => (
                      <li key={c.href + c.label}>
                        <Link
                          href={c.href}
                          className="block rounded-md px-2 py-1.5 text-sm text-brand-ink transition hover:bg-brand-cream hover:text-brand-purple"
                        >
                          {c.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-2">
              {item.children?.map((c) => (
                <Link
                  key={c.href + c.label}
                  href={c.href}
                  className="block px-4 py-2.5 text-sm text-brand-ink hover:bg-brand-cream"
                >
                  {c.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [portalsOpen, setPortalsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [elevated, setElevated] = useState(false);
  const pathname = usePathname() ?? '/';
  const isFr = pathname === '/fr' || pathname.startsWith('/fr/');
  const nav = (isFr ? fr.nav : site.nav) as NavItem[];
  const applyLabel = isFr ? fr.common.applyNow : 'Apply Now';
  const portalsLabel = isFr ? fr.common.studentPortal : 'Portals';
  const langHref = isFr ? '/' : '/fr';
  const langLabel = isFr ? 'EN' : 'FR';

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setElevated(window.scrollY > 8);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 text-white transition-all duration-500 ${
        elevated
          ? 'bg-brand-purple-dark/90 shadow-2xl shadow-brand-purple-dark/40 backdrop-blur-xl supports-[backdrop-filter]:bg-brand-purple-dark/75'
          : 'bg-brand-purple shadow-md'
      }`}
    >
      {/* Reading progress — a single scaled element, written from the same
          rAF that drives the elevation state. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-gradient-to-r from-brand-gold-deep via-brand-gold to-brand-gold-deep transition-transform duration-150"
        style={{ transform: `scaleX(${progress})` }}
      />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:bg-brand-gold focus:px-4 focus:py-2 focus:text-brand-purple"
      >
        Skip to content
      </a>

      {/* Audience utility bar */}
      <div className="hidden border-b border-white/10 bg-brand-purple-dark/60 lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-5 px-4 py-1.5 text-[11px] font-medium tracking-wide text-white/70">
          <span className="mr-auto text-brand-gold/90">
            A Global University · Buea · Douala · Nigeria · Online Worldwide
          </span>
          <Link href="/admissions" className="hover:text-brand-gold">Prospective Students</Link>
          <Link href="/portal" className="hover:text-brand-gold">Current Students</Link>
          <Link href="/international" className="hover:text-brand-gold">International</Link>
          <Link href="/faculty" className="hover:text-brand-gold">Faculty &amp; Staff</Link>
          <Link href="/alumni" className="hover:text-brand-gold">Alumni &amp; Giving</Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3">
        <Link href={isFr ? '/fr' : '/'} className="flex shrink-0 items-center gap-3">
          <Crest size={44} priority />
          <span className="font-heading text-sm font-bold leading-tight md:hidden">ICOF Global</span>
          <span className="hidden font-heading text-base font-bold leading-tight md:block xl:text-lg">
            {site.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main">
          {nav.map((item) => (
            <DesktopItem key={item.label} item={item} />
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <SiteSearch />
          <Link
            href="/apply"
            className="whitespace-nowrap rounded-full bg-brand-gold px-4 py-2 text-[13px] font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
          >
            {applyLabel}
          </Link>
          <div className="relative">
            <button
              onClick={() => setPortalsOpen((v) => !v)}
              aria-expanded={portalsOpen}
              aria-haspopup="true"
              className="whitespace-nowrap rounded-full border border-brand-gold px-3 py-2 text-[13px] font-semibold text-brand-gold transition hover:bg-brand-gold hover:text-brand-purple"
            >
              {portalsLabel} ▾
            </button>
            {portalsOpen && (
              <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-lg bg-white text-brand-ink shadow-xl">
                {site.portals.map((p) => (
                  <a key={p.href} href={p.href} className="block px-4 py-2.5 text-sm hover:bg-brand-cream">
                    {p.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          <Link
            href={langHref}
            hrefLang={isFr ? 'en' : 'fr'}
            aria-label={isFr ? 'Switch to English' : 'Passer en français'}
            className="whitespace-nowrap rounded-full border border-white/30 px-2.5 py-2 text-[12px] font-semibold text-white/90 transition hover:border-brand-gold hover:text-brand-gold"
          >
            {langLabel}
          </Link>
          {/* Beside the language switch, because both are the same kind of
              control: how you would like to read this, not where you would like
              to go. Hidden below lg — on a phone it competes with the menu
              button for the one bit of masthead a thumb can reach, and the
              system default is right for almost everybody there. */}
          <ThemeToggle className="hidden xl:inline-flex" />
        </div>

        <button className="lg:hidden" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span className="block h-0.5 w-6 bg-white" />
          <span className="mt-1.5 block h-0.5 w-6 bg-white" />
          <span className="mt-1.5 block h-0.5 w-6 bg-white" />
        </button>
      </div>

      {/* Mobile drawer */}
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

            {nav.map((item) => {
              const links = item.groups ? item.groups.flatMap((g) => g.items) : item.children;
              return links?.length ? (
                <div key={item.label}>
                  <button
                    onClick={() => setExpanded((e) => (e === item.label ? null : item.label))}
                    aria-expanded={expanded === item.label}
                    className="flex w-full items-center justify-between py-2.5 text-sm font-medium text-white/90 hover:text-brand-gold"
                  >
                    {item.label}
                    <span aria-hidden="true" className={`text-xs transition ${expanded === item.label ? 'rotate-180' : ''}`}>
                      ▾
                    </span>
                  </button>
                  {expanded === item.label && (
                    <div className="ml-3 border-l border-white/10 pl-3">
                      {item.groups
                        ? item.groups.map((g) => (
                            <div key={g.heading} className="mb-2">
                              <p className="py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold/80">
                                {g.heading}
                              </p>
                              {g.items.map((c) => (
                                <Link
                                  key={c.href + c.label}
                                  href={c.href}
                                  onClick={() => setOpen(false)}
                                  className="block py-1.5 text-sm text-white/80 hover:text-brand-gold"
                                >
                                  {c.label}
                                </Link>
                              ))}
                            </div>
                          ))
                        : item.children?.map((c) => (
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
                  className="block py-2.5 text-sm font-medium text-white/90 hover:text-brand-gold"
                >
                  {item.label}
                </Link>
              );
            })}

            <Link
              href="/apply"
              onClick={() => setOpen(false)}
              className="mt-4 block rounded-full bg-brand-gold px-4 py-2.5 text-center text-sm font-semibold text-brand-purple"
            >
              {applyLabel}
            </Link>
            <Link
              href={langHref}
              hrefLang={isFr ? 'en' : 'fr'}
              onClick={() => setOpen(false)}
              className="mt-2 block rounded-full border border-white/30 px-4 py-2 text-center text-sm font-semibold text-white/90"
            >
              {isFr ? 'English' : 'Français'}
            </Link>
            <div className="mt-3 border-t border-white/10 pt-3">
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
