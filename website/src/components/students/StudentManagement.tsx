'use client';

// ---------------------------------------------------------------------------
// The student register.
//
// THE CHANGE THAT MATTERS: "Register Student" is gone.
//
// It opened a form that inserted a row with status 'active' — creating an
// enrolled student with no application, no fee, and no decision by the
// Registrar. Every control in src/lib/roles.ts exists to make those three
// things unskippable, and this button skipped all of them from inside the
// system that enforces them. It also stamped `UNI/2026/CS/001` as the matric
// number and defaulted the programme to Computer Science, which this university
// does not teach: both were the template's, not the university's.
//
// A student record is the output of the admissions process, not an input to it.
// The screen now says so and sends the user to the desk that produces one.
//
// Bulk import stays. It is how an existing cohort is brought across from the
// old system — a migration, which is a different act from admitting somebody,
// and one the Registrar performs knowingly.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StudentIDCard from './StudentIDCard';
import BulkImport from './BulkImport';
import StudentPhoto from './StudentPhoto';
import { supabase } from '@/lib/supabase';
import type { Student, ViewType } from '@/lib/types';

import { statusMeta, toUniversal } from '@/lib/status';
import {
  Card, PageHeader, EmptyState, SkeletonRows, TableShell, THead, TBody, Th, Td, Detail,
} from '@/components/ui/portal';
import { BTN_SECONDARY, BTN_GHOST, INPUT, FOCUS } from '@/lib/portalTheme';
import { Search, Download, Upload, Eye, X, Users, Stamp, IdCard } from 'lucide-react';

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'applicant', label: 'Applicants' },
  { value: 'fee_paid', label: 'Fee verified' },
  { value: 'approved', label: 'Admitted' },
  { value: 'conditional', label: 'Conditional' },
  { value: 'active', label: 'Active' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'suspended', label: 'Suspended' },
];

export default function StudentManagement({ onNavigate }: { onNavigate?: (v: ViewType) => void } = {}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [idCardStudent, setIdCardStudent] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    // Columns named, not `*`.
    //
    // `photo_url` now holds the photograph itself as a data URI, about 25 KB a
    // student. On `select *` a five-hundred-student register would pull twelve
    // megabytes to draw five hundred thirty-two-pixel avatars. The list shows
    // initials; the photograph is fetched for the one student who is opened.
    const { data } = await supabase
      .from('students')
      .select('id, matric_no, student_number, first_name, middle_name, last_name, email, phone, date_of_birth, gender, nationality, department_id, program, degree_type, faculty, intake, admission_year, expected_graduation, status, created_at, updated_at, departments(name, code)')
      .order('created_at', { ascending: false });
    setStudents((data ?? []) as unknown as Student[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  /**
   * Open one student, and fetch the photograph the list deliberately left out.
   *
   * The panel opens immediately on the row already in hand, so it never waits
   * on the network; the photograph arrives a moment later. On a failed fetch
   * the panel simply has no photograph, which is what StudentPhoto is built to
   * show.
   */
  const openStudent = useCallback(async (s: Student) => {
    setSelected(s);
    const { data } = await supabase
      .from('students')
      .select('photo_url')
      .eq('id', s.id)
      .maybeSingle();
    if (data?.photo_url) {
      setSelected((cur) => (cur && cur.id === s.id ? { ...cur, photo_url: data.photo_url } : cur));
    }
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      students.filter((s) => {
        const hay = `${s.first_name} ${s.last_name} ${s.matric_no} ${s.email ?? ''} ${(s as any).student_number ?? ''}`.toLowerCase();
        return (!q || hay.includes(q)) && (statusFilter === 'all' || s.status === statusFilter);
      }),
    [students, q, statusFilter],
  );

  /**
   * Export what is on screen, not the whole table.
   *
   * The button had no handler at all before. Exporting the filtered set rather
   * than everything is the behaviour that matches what the user is looking at —
   * someone who has filtered to graduates and pressed Export wants graduates.
   */
  function exportCsv() {
    const cols: Array<[string, (s: any) => string]> = [
      ['Student number', (s) => s.student_number ?? ''],
      ['Matric number', (s) => s.matric_no ?? ''],
      ['First name', (s) => s.first_name ?? ''],
      ['Middle name', (s) => s.middle_name ?? ''],
      ['Last name', (s) => s.last_name ?? ''],
      ['Email', (s) => s.email ?? ''],
      ['Phone', (s) => s.phone ?? ''],
      ['Programme', (s) => [s.degree_type, s.program].filter(Boolean).join(' ')],
      ['Faculty', (s) => s.faculty ?? ''],
      ['Intake', (s) => s.intake ?? ''],
      ['Admission year', (s) => String(s.admission_year ?? '')],
      ['Status', (s) => statusMeta(toUniversal(s.status)).label],
    ];
    // A field containing a comma, quote or newline must be quoted, and inner
    // quotes doubled — otherwise one address with a comma in it shifts every
    // subsequent column of that row by one.
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [
      cols.map(([h]) => esc(h)).join(','),
      ...filtered.map((s) => cols.map(([, get]) => esc(get(s))).join(',')),
    ].join('\r\n');

    // BOM so Excel opens UTF-8 correctly. Without it, any name with an accent
    // in it arrives mangled, which for this university is most of them.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `icof-students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        subtitle={loading ? 'Loading the register…' : `${students.length} on the register`}
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCsv} disabled={filtered.length === 0} className={BTN_SECONDARY}>
              <Download size={15} /> Export {filtered.length !== students.length ? 'these' : 'all'}
            </button>
            <button onClick={() => setShowImport(true)} className={BTN_SECONDARY}>
              <Upload size={15} /> Bulk import
            </button>
          </div>
        }
      />

      {/* Where a student record actually comes from. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8dcc0] bg-[#faf6ee] px-4 py-3 dark:border-[#3d3349] dark:bg-[#241f2c]">
        <p className="text-sm text-[#6b5a2f] dark:text-[#c3b48f]">
          Students are admitted, not added. A record appears here when the Registrar approves a
          paid application — which is what puts a fee and a decision behind every enrolment.
        </p>
        {onNavigate && (
          <button onClick={() => onNavigate('admissions-registrar')} className={BTN_SECONDARY}>
            <Stamp size={15} /> Registrar&apos;s desk
          </button>
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a49bb0]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, student number or email"
              aria-label="Search students"
              className={`${INPUT} pl-9`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className={`${INPUT} w-auto`}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          {(q || statusFilter !== 'all') && (
            <button onClick={() => { setQuery(''); setStatusFilter('all'); }} className={BTN_GHOST}>
              Clear
            </button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={6} cols={5} />
        ) : filtered.length === 0 ? (
          q || statusFilter !== 'all' ? (
            <EmptyState
              icon={<Search size={20} />}
              title="Nothing matches those filters"
              description={`${students.length} students are on the register; none of them match what you have selected.`}
              action={
                <button onClick={() => { setQuery(''); setStatusFilter('all'); }} className={BTN_SECONDARY}>
                  Show all students
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={<Users size={20} />}
              title="No students on the register yet"
              description="Approved applications appear here automatically. To bring an existing cohort across from the old system, use Bulk import."
              action={
                onNavigate && (
                  <button onClick={() => onNavigate('admissions-registrar')} className={BTN_SECONDARY}>
                    <Stamp size={15} /> Go to the Registrar&apos;s desk
                  </button>
                )
              }
            />
          )
        ) : (
          <TableShell>
            <THead>
              <tr>
                <Th>Student</Th>
                <Th>Number</Th>
                <Th>Programme</Th>
                <Th>Intake</Th>
                <Th>Status</Th>
                <Th align="right">·</Th>
              </tr>
            </THead>
            <TBody>
              {filtered.map((s) => {
                const meta = statusMeta(toUniversal(s.status));
                return (
                  <tr key={s.id} className="transition-colors hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">
                    <Td>
                      <div className="flex items-center gap-3">
                        {/* Initials, not a photograph, and never the stock one.
                            This used to fall back to IMAGES.students[0], so every
                            student without a photo showed the same stranger's
                            face beside their real name — a register that looked
                            complete when it was not. Initials are honestly a
                            placeholder; the photograph is on the record. */}
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f2eee6] text-[10px] font-bold text-[#a49bb0] ring-1 ring-[#ece7de] dark:bg-[#2a2333]"
                        >
                          {(s.first_name?.[0] ?? '') + (s.last_name?.[0] ?? '')}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                            {[s.first_name, s.middle_name?.charAt(0) ? `${s.middle_name.charAt(0)}.` : '', s.last_name]
                              .filter(Boolean).join(' ')}
                          </p>
                          <p className="truncate text-xs text-[#a49bb0]">{s.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td numeric className="font-mono text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      {(s as any).student_number || s.matric_no}
                    </Td>
                    <Td className="text-[#6b6076] dark:text-[#9c93ad]">
                      {[s.degree_type, s.program].filter(Boolean).join(' ') || '—'}
                    </Td>
                    <Td numeric className="text-[#6b6076] dark:text-[#9c93ad]">
                      {(s as any).intake || s.admission_year || '—'}
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                        {meta.label}
                      </span>
                    </Td>
                    <Td align="right">
                      {/* One action, and it works. The pencil beside it opened
                          nothing — an edit control that edits nothing is a
                          promise the screen cannot keep. */}
                      <button
                        onClick={() => void openStudent(s)}
                        aria-label={`Open ${s.first_name} ${s.last_name}`}
                        className={BTN_GHOST}
                      >
                        <Eye size={13} /> Open
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </TableShell>
        )}
      </Card>

      {filtered.length > 0 && (
        <p className="text-xs text-[#a49bb0]">
          Showing {filtered.length} of {students.length}.
        </p>
      )}

      {/* Detail */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white dark:bg-[#1f1a27]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-[#f0ece4] p-6 text-center dark:border-[#2a2333]">
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className={`absolute right-4 top-4 rounded-lg p-1.5 text-[#a49bb0] hover:bg-[#f2eee6] dark:hover:bg-[#2a2333] ${FOCUS}`}
              >
                <X size={16} />
              </button>
              <div className="mx-auto w-fit">
                <StudentPhoto
                  studentId={selected.id}
                  photoUrl={selected.photo_url}
                  name={[selected.first_name, selected.last_name].filter(Boolean).join(' ')}
                  onChange={(next) => {
                    setSelected((cur) => (cur ? { ...cur, photo_url: next ?? undefined } : cur));
                    setStudents((list) =>
                      list.map((s) => (s.id === selected.id ? { ...s, photo_url: next ?? undefined } : s)),
                    );
                  }}
                />
              </div>
              <h2 className="mt-3 font-heading text-lg font-bold text-[#33234a] dark:text-[#e4dcf0]">
                {[selected.first_name, selected.middle_name, selected.last_name].filter(Boolean).join(' ')}
              </h2>
              <p className="font-mono text-sm tabular-nums text-[#a49bb0]">
                {(selected as any).student_number || selected.matric_no}
              </p>
            </div>
            <dl className="divide-y divide-[#f0ece4] py-2 dark:divide-[#2a2333]">
              <Detail label="Programme">{[selected.degree_type, selected.program].filter(Boolean).join(' ') || '—'}</Detail>
              <Detail label="Faculty">{(selected as any).faculty || '—'}</Detail>
              <Detail label="Email">{selected.email || '—'}</Detail>
              <Detail label="Phone">{selected.phone || '—'}</Detail>
              <Detail label="Intake">{(selected as any).intake || selected.admission_year || '—'}</Detail>
              <Detail label="Status">{statusMeta(toUniversal(selected.status)).label}</Detail>
            </dl>
            <div className="flex gap-3 p-6 pt-4">
              <button onClick={() => setIdCardStudent(selected)} className={`${BTN_SECONDARY} flex-1`}>
                <IdCard size={15} /> ID card
              </button>
              <button onClick={() => setSelected(null)} className={`${BTN_SECONDARY} flex-1`}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && <BulkImport onClose={() => setShowImport(false)} onDone={fetchStudents} />}
      {idCardStudent && <StudentIDCard student={idCardStudent} onClose={() => setIdCardStudent(null)} />}
    </div>
  );
}
