import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Search, Bell, MessageSquare, Sun, Moon, Menu } from 'lucide-react';
import type { UserRole } from '@/lib/types';

interface TopBarProps {
  sidebarCollapsed: boolean;
  onMenuToggle: () => void;
}

export default function TopBar({ sidebarCollapsed, onMenuToggle }: TopBarProps) {
  const { user, session, switchRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const isDemoMode = !session && !!user;

  const [notifications, setNotifications] = useState<{ id: string; text: string; time: string; read: boolean }[]>([]);

  // Live notifications assembled from announcements, assignments and classes.
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

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'left-[72px]' : 'left-64'
      }`}
    >
      <div className="flex items-center gap-4">
        <button onClick={onMenuToggle} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
          <Menu size={20} />
        </button>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search students, courses, results..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-80 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30 focus:border-blue-400 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Role Switcher - Demo Mode Only */}
        {isDemoMode && (
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg p-1">
            <span className="text-[9px] text-amber-600 font-medium px-1.5">DEMO</span>
            {(['admin', 'lecturer', 'student'] as UserRole[]).map((role) => (
              <button
                key={role}
                onClick={() => switchRole(role)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                  user?.role === role
                    ? 'bg-[#422e59] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        )}

        {/* Auth badge for real users */}
        {!isDemoMode && session && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-emerald-700 font-medium capitalize">{user?.role} · Authenticated</span>
          </div>
        )}

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors relative">
          <MessageSquare size={18} />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors relative"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  <span className="text-xs text-blue-600 cursor-pointer hover:underline">Mark all read</span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet.</p>
                  )}
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !n.read ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <p className="text-sm text-gray-700">{n.text}</p>
                      <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#422e59] text-white flex items-center justify-center text-sm font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-700 leading-tight">{user.name}</p>
              <p className="text-[10px] text-gray-400 capitalize">{user.role}{user.matricNo ? ` · ${user.matricNo}` : ''}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
