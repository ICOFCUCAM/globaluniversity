'use client';

// ---------------------------------------------------------------------------
// The teaching register.
//
// "Add Lecturer" was a button with no handler — it looked like the way to add a
// lecturer and did nothing at all, which is the specific failure that teaches
// staff to stop trusting an interface and go back to email.
//
// It now points at the one route that can actually create one
// (/api/admin/staff, Superadministrator only), and says so plainly to everyone
// else rather than presenting a control they cannot use. Telling someone which
// office to ask is help; a disabled button is not.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import type { Lecturer, ViewType } from '@/lib/types';
import { IMAGES } from '@/lib/constants';
import { Card, PageHeader, EmptyState, Skeleton } from '@/components/ui/portal';
import { BTN_PRIMARY, INPUT, FOCUS } from '@/lib/portalTheme';
import { Search, UserPlus, Mail, GraduationCap, Phone } from 'lucide-react';

export default function LecturerManagement({ onNavigate }: { onNavigate?: (v: ViewType) => void } = {}) {
  const { user } = useAuth();
  const mayCreate = can(user?.role, 'create-staff-account');

  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('lecturers')
      .select('*, departments(name, code)')
      .order('last_name');
    setLecturers((data ?? []) as Lecturer[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? lecturers.filter((l) =>
        `${l.first_name} ${l.last_name} ${l.staff_id} ${l.specialization ?? ''} ${l.email ?? ''}`
          .toLowerCase()
          .includes(q),
      )
    : lecturers;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lecturers"
        subtitle={
          loading
            ? 'Loading the teaching register…'
            : `${lecturers.length} ${lecturers.length === 1 ? 'lecturer' : 'lecturers'} on the register`
        }
        action={
          mayCreate ? (
            <button onClick={() => onNavigate?.('accounts')} className={BTN_PRIMARY}>
              <UserPlus size={15} /> Add a lecturer
            </button>
          ) : (
            <p className="max-w-xs text-right text-xs text-[#8a8194]">
              Lecturer accounts are created by the Superadministrator, who issues the staff number
              and emails the credentials.
            </p>
          )
        }
      />

      <div className="relative max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a49bb0]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, staff number or subject"
          aria-label="Search lecturers"
          className={`${INPUT} pl-9`}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="mx-auto h-16 w-16 rounded-full" />
              <Skeleton className="mx-auto mt-3 h-4 w-32" />
              <Skeleton className="mx-auto mt-2 h-3 w-24" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          {/* The two cases look identical and are not: nobody is registered, or
              a search is hiding everyone. Saying "no lecturers" to someone who
              has just typed a name is how a user concludes the database is
              empty when it is not. */}
          {q ? (
            <EmptyState
              icon={<Search size={20} />}
              title={`Nothing matches “${query.trim()}”`}
              description="Try a surname, a staff number, or the subject they teach."
              action={
                <button onClick={() => setQuery('')} className="text-sm font-medium text-[#422e59] hover:underline">
                  Clear the search
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={<GraduationCap size={20} />}
              title="No lecturers on the register yet"
              description={
                mayCreate
                  ? 'Creating a lecturer account issues a staff number, creates the teaching record and emails the credentials in one step.'
                  : 'Lecturer accounts are created by the Superadministrator.'
              }
              action={
                mayCreate ? (
                  <button onClick={() => onNavigate?.('accounts')} className={BTN_PRIMARY}>
                    <UserPlus size={15} /> Add the first lecturer
                  </button>
                ) : undefined
              }
            />
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((l) => (
            <Card key={l.id} interactive className="p-5 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={l.photo_url || IMAGES.professors[0]}
                alt=""
                className="mx-auto h-16 w-16 rounded-full object-cover ring-1 ring-[#e8dcc0]"
              />
              <h3 className="mt-3 font-heading text-sm font-bold text-[#33234a]">
                {[l.title, l.first_name, l.last_name].filter(Boolean).join(' ')}
              </h3>
              <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[#a49bb0]">{l.staff_id}</p>
              {l.specialization && (
                <p className="mt-1 text-xs text-[#6b6076]">{l.specialization}</p>
              )}
              {l.departments && (
                <p className="mt-0.5 text-[11px] text-[#a49bb0]">
                  {(l.departments as any).name}
                </p>
              )}
              <div className="mt-4 flex justify-center gap-2">
                {/* Real links. These were two buttons captioned Email and View
                    with no handlers between them. */}
                {l.email && (
                  <a
                    href={`mailto:${l.email}`}
                    className={`inline-flex items-center gap-1.5 rounded-lg bg-[#faf6ee] px-3 py-1.5 text-xs font-medium text-[#422e59] transition-colors hover:bg-[#f3ead5] ${FOCUS}`}
                  >
                    <Mail size={12} /> Email
                  </a>
                )}
                {l.phone && (
                  <a
                    href={`tel:${l.phone}`}
                    className={`inline-flex items-center gap-1.5 rounded-lg bg-[#faf6ee] px-3 py-1.5 text-xs font-medium text-[#422e59] transition-colors hover:bg-[#f3ead5] ${FOCUS}`}
                  >
                    <Phone size={12} /> Call
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
