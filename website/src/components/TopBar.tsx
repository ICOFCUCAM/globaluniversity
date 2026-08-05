'use client';

// ---------------------------------------------------------------------------
// The portal's top bar.
//
// It shipped with four controls that did nothing at all. The search box
// accepted text into a state variable nothing read. The dark-mode button
// toggled a boolean that was never applied to anything, so the icon changed and
// the screen did not. A message button opened nothing. "Mark all read" was
// styled as a link and had no handler.
//
// Dead controls are worse than missing ones: a user who clicks the moon and
// sees nothing happen learns not to trust the rest of the interface either. So
// the search now navigates, the theme toggle now changes the theme, and the two
// that had no destination are gone rather than mocked up.
//
// The duplicate identity block is gone too. The sidebar already states who is
// signed in and in what role; repeating it in the corner spent the most
// valuable strip of the screen on something the user had just read. That space
// now carries the breadcrumb, which answers the more useful question of where
// they are.
// ---------------------------------------------------------------------------

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';
import { navItemsFor, labelForView, groupForView } from '@/lib/portalNav';
import { FOCUS, INPUT } from '@/lib/portalTheme';
import type { ViewType, UserRole } from '@/lib/types';
import { Search, Bell, Sun, Moon, Menu, CornerDownLeft } from 'lucide-react';

interface TopBarProps {
  sidebarCollapsed: boolean;
  onMenuToggle: () => void;
  currentView: ViewType;
  onViewChange: (v: ViewType) => void;
}

export default function TopBar({
  sidebarCollapsed, onMenuToggle, currentView, onViewChange,
}: TopBarProps) {
  const { user, session, switchRole } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [openSearch, setOpenSearch] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // next-themes resolves on the client. Rendering the icon before that would
  // emit one theme on the server and another on hydration.
  useEffect(() => setMounted(true), []);

  const isDemoMode = !session && !!user;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return navItemsFor(user?.role)
      .filter((i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q))
      .slice(0, 7);
  }, [query, user?.role]);

  useEffect(() => setHighlight(0), [query]);

  // Ctrl/Cmd-K focuses search, the convention every system this size uses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        setOpenSearch(true);
      }
      if (e.key === 'Escape') setOpenSearch(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function choose(view: ViewType) {
    onViewChange(view);
    setQuery('');
    setOpenSearch(false);
    searchRef.current?.blur();
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % results.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h - 1 + results.length) % results.length); }
    if (e.key === 'Enter') { e.preventDefault(); choose(results[highlight].id); }
  }

  const [notifications, setNotifications] = useState<
    { id: string; text: string; time: string; read: boolean }[]
  >([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('documents')
        .select('id, file_name, file_url, document_type, uploaded_at')
        .in('document_type', ['announcement', 'assignment-brief', 'live-class'])
        .order('uploaded_at', { ascending: false })
        .limit(8);
      const ago = (iso: string) => {
        const h = Math.round((Date.now() - new Date(iso).getTime()) / 36e5);
        if (h < 1) return 'just now';
        if (h < 24) return `${h}h ago`;
        return `${Math.round(h / 24)}d ago`;
      };
      setNotifications(
        (data ?? []).map((d: any) => {
          let text = d.file_name as string;
          try {
            const j = JSON.parse(decodeURIComponent(escape(atob(d.file_url.split('base64,')[1]))));
            if (d.document_type === 'announcement') text = `Announcement: ${j.title}`;
            else if (d.document_type === 'assignment-brief') text = `New assignment: ${j.title}${j.due ? ` (due ${j.due})` : ''}`;
            else text = `Class: ${j.title} — ${j.time ?? ''}`;
          } catch {
            /* fall back to file name */
          }
          return {
            id: d.id,
            text,
            time: ago(d.uploaded_at),
            read: (Date.now() - new Date(d.uploaded_at).getTime()) / 36e5 > 24,
          };
        }),
      );
    })();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const group = groupForView(currentView);

  return (
    <header
      className={`fixed right-0 top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#ece7de] bg-white/90 px-5 backdrop-blur transition-[left] duration-200 ${
        sidebarCollapsed ? 'left-[68px]' : 'left-64'
      }`}
    >
      <div className="flex min-w-0 items-center gap-4">
        <button
          onClick={onMenuToggle}
          aria-label="Toggle navigation"
          className={`rounded-lg p-2 text-[#6b6076] transition-colors hover:bg-[#f2eee6] lg:hidden ${FOCUS}`}
        >
          <Menu size={18} />
        </button>

        {/* Where you are. */}
        <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
          <ol className="flex items-center gap-2 text-sm">
            {group && (
              <>
                <li className="text-[#a49bb0]">{group}</li>
                <li className="text-[#d5cec0]" aria-hidden="true">/</li>
              </>
            )}
            <li className="truncate font-heading font-bold text-[#422e59]">
              {labelForView(currentView)}
            </li>
          </ol>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {/* Search that navigates. */}
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a49bb0]" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpenSearch(true); }}
            onFocus={() => setOpenSearch(true)}
            onBlur={() => window.setTimeout(() => setOpenSearch(false), 120)}
            onKeyDown={onSearchKey}
            placeholder="Jump to…"
            aria-label="Jump to a screen"
            className={`${INPUT} w-40 pl-9 pr-10 sm:w-56 lg:w-72`}
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-[#e4ddd0] bg-[#faf8f4] px-1.5 py-0.5 text-[10px] text-[#a49bb0] sm:block">
            ⌘K
          </kbd>

          {openSearch && query.trim() && (
            <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-xl border border-[#ece7de] bg-white shadow-xl">
              {results.length === 0 ? (
                <p className="px-4 py-5 text-center text-sm text-[#a49bb0]">
                  Nothing matches “{query.trim()}”.
                </p>
              ) : (
                <ul>
                  {results.map((r, i) => (
                    <li key={r.id}>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); choose(r.id); }}
                        onMouseEnter={() => setHighlight(i)}
                        className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors ${
                          i === highlight ? 'bg-[#faf6ee]' : 'hover:bg-[#faf8f4]'
                        }`}
                      >
                        <span className="text-[#c5a55a]">{r.icon}</span>
                        <span className="min-w-0 flex-1 truncate text-[#33234a]">{r.label}</span>
                        <span className="text-[10px] uppercase tracking-wide text-[#a49bb0]">{r.group}</span>
                        {i === highlight && <CornerDownLeft size={12} className="text-[#a49bb0]" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Demo role switcher. Only ever visible without a real session. */}
        {isDemoMode && (
          <div className="hidden items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 p-1 lg:flex">
            <span className="px-1.5 text-[9px] font-semibold tracking-wide text-amber-700">DEMO</span>
            {(['superadmin', 'admin', 'lecturer', 'student'] as UserRole[]).map((role) => (
              <button
                key={role}
                onClick={() => switchRole(role)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${
                  user?.role === role ? 'bg-[#422e59] text-white' : 'text-amber-800 hover:bg-amber-100'
                }`}
              >
                {role === 'superadmin' ? 'super' : role}
              </button>
            ))}
          </div>
        )}

        {/* A theme toggle that changes the theme. */}
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className={`rounded-lg p-2 text-[#6b6076] transition-colors hover:bg-[#f2eee6] ${FOCUS}`}
        >
          {mounted && resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowNotifications((s) => !s)}
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            className={`relative rounded-lg p-2 text-[#6b6076] transition-colors hover:bg-[#f2eee6] ${FOCUS}`}
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#c5a55a] px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-[#ece7de] bg-white shadow-xl">
                <div className="border-b border-[#f0ece4] px-4 py-3">
                  <h2 className="font-heading text-sm font-bold text-[#422e59]">Notifications</h2>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-[#a49bb0]">
                      Nothing new. Announcements, assignments and class notices appear here.
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`border-b border-[#f7f4ee] px-4 py-3 last:border-0 ${!n.read ? 'bg-[#faf6ee]' : ''}`}
                      >
                        <p className="text-sm leading-snug text-[#33234a]">{n.text}</p>
                        <p className="mt-1 text-xs text-[#a49bb0]">{n.time}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
