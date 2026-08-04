import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { IMAGES, UNIVERSITY } from '@/lib/constants';
import type { ViewType, UserRole } from '@/lib/types';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  FileText, Award, Monitor, PenTool, FolderOpen, BarChart3,
  Settings, Shield, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react';

interface MenuItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'student', 'lecturer'] },
  { id: 'students', label: 'Students', icon: <Users size={20} />, roles: ['admin'] },
  { id: 'lecturers', label: 'Lecturers', icon: <GraduationCap size={20} />, roles: ['admin'] },
  { id: 'courses', label: 'Courses', icon: <BookOpen size={20} />, roles: ['admin', 'student', 'lecturer'] },
  { id: 'results', label: 'Results', icon: <ClipboardList size={20} />, roles: ['admin', 'lecturer', 'student'] },
  { id: 'transcript', label: 'Transcript', icon: <FileText size={20} />, roles: ['admin', 'student'] },
  { id: 'certificate', label: 'Certificate', icon: <Award size={20} />, roles: ['admin', 'student'] },
  { id: 'lms', label: 'Learning (LMS)', icon: <Monitor size={20} />, roles: ['admin', 'student', 'lecturer'] },
  { id: 'exams', label: 'Examinations', icon: <PenTool size={20} />, roles: ['admin', 'student', 'lecturer'] },
  { id: 'documents', label: 'Documents', icon: <FolderOpen size={20} />, roles: ['admin', 'student'] },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} />, roles: ['admin'] },
  { id: 'audit', label: 'Audit Logs', icon: <Shield size={20} />, roles: ['admin'] },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} />, roles: ['admin', 'student', 'lecturer'] },
];

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ currentView, onViewChange, collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const filteredItems = menuItems.filter((item) => user && item.roles.includes(user.role));

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-gradient-to-b from-[#0f1a3c] to-[#1a237e] text-white z-40 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <img src={IMAGES.logo} alt="Logo" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold leading-tight truncate">{UNIVERSITY.shortName}</h1>
            <p className="text-[10px] text-blue-200 truncate">University Management</p>
          </div>
        )}
      </div>

      {/* User Info */}
      {user && (
        <div className={`px-4 py-3 border-b border-white/10 ${collapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <img
              src={user.avatar}
              alt={user.name}
              className="w-9 h-9 rounded-full object-cover border-2 border-amber-400 flex-shrink-0"
            />
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-[10px] text-blue-200 capitalize">{user.role}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
              currentView === item.id
                ? 'bg-white/15 text-amber-300 font-semibold shadow-lg shadow-black/10'
                : 'text-blue-100 hover:bg-white/10 hover:text-white'
            } ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="px-2 py-3 border-t border-white/10 space-y-1">
        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut size={20} />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-blue-200 hover:bg-white/10 transition-all ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
