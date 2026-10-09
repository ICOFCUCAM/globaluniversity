'use client';

// ---------------------------------------------------------------------------
// Accounts — create staff, assign roles, suspend and reinstate.
// Superadministrator only.
//
// Everything on this screen is done by a server route, never by the browser
// writing to the database. That is not caution for its own sake: the browser
// holds only the publishable key, and the database now refuses to let anyone —
// including a signed-in Superadministrator — write to profiles.role or
// profiles.suspended_at directly. The column privileges were revoked in
// 002_superadmin.sql precisely so that promotion and suspension cannot happen
// except through a route that authorises, records and audits them.
//
// So if this screen breaks, accounts do not become editable by other means.
// They become uneditable, which is the correct direction to fail in.
//
// ---------------------------------------------------------------------------
// AND THE LIST IS SEPARATED, WHICH THE UNIVERSITY HAD TO ASK FOR
// ---------------------------------------------------------------------------
//
//   "all accounts should be separated also likewise" — lecturers, students,
//   other, "and it should also be classified by years".
//
// It was one undifferentiated run of names ordered by creation date with a
// search box over the top. Finding a lecturer meant reading past every
// student, and "who came in this year" could not be asked at all.
//
// THE YEAR IS NOT `created_at`, AND THAT IS THE WHOLE DIFFICULTY. An account
// opened this week for a student admitted two years ago belongs to their
// cohort, not to this week — so the year comes from the admission register for
// a student and from the staff record for a member of staff, and the screen
// says which of the four it read. See `personYear` in `src/lib/people.ts`,
// which both this screen and Studio Control use so that the two cannot drift.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can, canActOn, roleLabels, SYSTEM_ROLES } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import {
  PERSON_KINDS, personKind, personYear, isApplicant, yearsPresent, yearLabel,
  YEAR_BASIS_LABELS, type PersonKind,
} from '@/lib/people';
import {
  ShieldAlert, UserPlus, Ban, RotateCcw, Loader2, Search,
  AlertTriangle, CheckCircle2, KeyRound, Copy,
} from 'lucide-react';

interface AccountRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
}

/** An account with its group and its year worked out once. */
interface Classified extends AccountRow {
  kind: PersonKind;
  year: number;
  basis: keyof typeof YEAR_BASIS_LABELS;
  applicant: boolean;
}

// ---------------------------------------------------------------------------
// ROLES THIS SCREEN OFFERS.
//
// Students and applicants are excluded: those come from the admissions
// pipeline, where a paid application and a Registrar decision sit behind every
// account. The Superadministrator is excluded because `canActOn` refuses it —
// no role outranks the most senior one, so offering it would be offering a
// button that always fails.
//
// ---------------------------------------------------------------------------
// EIGHT ROLES WERE MISSING, AND SIX OF THEM ARE THE SAME SIX AS LAST TIME
// ---------------------------------------------------------------------------
//
// The University asked whether a National Rector account could be created. It
// could not. Nor could a National Financial Secretary, either HR office, or
// any of the four examination offices — eight of the University's twenty-five
// roles had capabilities, screens, a dashboard and a place in the matrix, and
// no way to be given an account at all.
//
// THE ROUTE ACCEPTED THEM THE WHOLE TIME. /api/admin/staff takes any role in
// `roleLabels` and checks `canActOn`; this list was the only refusal, and it
// was a list nothing compared against anything.
//
// `portalCoverage.test.mjs` was written after a fault with the same shape —
// "AN INVIGILATOR SAW ONE MENU ITEM… The two HR offices and all four
// examination offices" — and it counts the NAVIGATION. Those same six roles
// were absent from this list too, and counting one list did not count the
// other. `accountCreation.test.mjs` now counts this one.
// ---------------------------------------------------------------------------
const CREATABLE: UserRole[] = [
  'admin', 'registrar', 'finance', 'finance-director', 'admissions-officer',
  'dean', 'hod', 'programme-coordinator', 'lecturer', 'academic-office',
  'library-staff', 'student-affairs', 'chancellor', 'vice-chancellor',
  // The two HR offices.
  'hr-officer', 'hr-administrator',
  // The four examination offices.
  'exam-officer', 'examiner', 'invigilator', 'moderator',
  // AND THE NATIONAL TIER. 097 gave a National Rector authority over a
  // nation's students and 098 over its money; 103 put both offices in the
  // register of positions so they can be appointed by letter. This is the
  // account that letter is for.
  'national-rector', 'national-financial-secretary',
];

export default function AccountManagement() {
  const { user } = useAuth();
  const allowed = can(user?.role, 'create-staff-account');

  const [rows, setRows] = useState<AccountRow[]>([]);
  // THE TWO REGISTERS THE YEAR COMES OUT OF, keyed by auth user. Read
  // separately rather than joined in the database, because `profiles` is the
  // list and these two only annotate it: an account whose student row or staff
  // record cannot be read still appears, with the year its account was opened
  // and the screen saying so. A join would have dropped it.
  const [admitted, setAdmitted] = useState<Map<string, { year: number | null; applied: string | null }>>(new Map());
  const [started, setStarted] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<PersonKind>('other');
  const [year, setYear] = useState<number | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [handover, setHandover] = useState<{ email: string; password: string } | null>(null);

  const [form, setForm] = useState({
    email: '', fullName: '', role: 'lecturer' as UserRole,
    title: '', specialization: '', phone: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [accounts, students, staff] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, role, suspended_at, suspension_reason, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('students')
        .select('auth_user_id, admission_year, created_at')
        .not('auth_user_id', 'is', null)
        .limit(5000),
      supabase
        .from('staff_records')
        .select('auth_user_id, started_on')
        .not('auth_user_id', 'is', null)
        .limit(2000),
    ]);
    setRows((accounts.data ?? []) as AccountRow[]);

    const byStudent = new Map<string, { year: number | null; applied: string | null }>();
    for (const s of students.data ?? []) {
      const id = String((s as Record<string, unknown>).auth_user_id);
      byStudent.set(id, {
        year: ((s as Record<string, unknown>).admission_year as number | null) ?? null,
        applied: ((s as Record<string, unknown>).created_at as string | null) ?? null,
      });
    }
    setAdmitted(byStudent);

    const byStaff = new Map<string, string | null>();
    for (const r of staff.data ?? []) {
      byStaff.set(
        String((r as Record<string, unknown>).auth_user_id),
        ((r as Record<string, unknown>).started_on as string | null) ?? null,
      );
    }
    setStarted(byStaff);
    setLoading(false);
  }, []);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  async function authed(path: string, body: unknown): Promise<any> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: 'session-expired' };
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy('create');
    setMessage(null);
    setHandover(null);
    const json = await authed('/api/admin/staff', form);
    setBusy(null);

    if (!json.ok) {
      setMessage({ tone: 'bad', text: explain(json.error) });
      return;
    }
    if (json.emailSent) {
      setMessage({
        tone: 'ok',
        text: `Account created. Credentials emailed to ${json.email}${json.staffNumber ? ` · staff number ${json.staffNumber}` : ''}.`,
      });
    } else {
      // The account is real; only delivery failed. Show the password once so it
      // can be handed over another way rather than stranding a new colleague.
      setHandover({ email: json.email, password: json.password });
      setMessage({ tone: 'bad', text: `Account created, but the email did not send (${json.error}). Hand the password over yourself — it is shown once and not stored anywhere you can read it back.` });
    }
    setForm({ email: '', fullName: '', role: 'lecturer', title: '', specialization: '', phone: '' });
    load();
  }

  async function suspend(row: AccountRow) {
    const reinstate = !!row.suspended_at;
    let reason = '';
    if (!reinstate) {
      reason = window.prompt(`Why is ${row.email} being suspended?\n\nThis is recorded in the audit log and cannot be left blank.`) ?? '';
      if (!reason.trim()) return;
    }
    setBusy(row.id);
    setMessage(null);
    const json = await authed('/api/admin/suspend', { userId: row.id, reason, reinstate });
    setBusy(null);
    if (!json.ok) {
      setMessage({ tone: 'bad', text: explain(json.error) });
      return;
    }
    setMessage({
      tone: 'ok',
      text: reinstate
        ? `${row.email} reinstated. They can sign in again immediately.`
        : `${row.email} suspended. Any session they currently hold stops working at the next page load.`,
    });
    load();
  }

  // ---- THE THREE GROUPS AND THE YEARS ----------------------------------
  //
  // Classified once, here, rather than in the render: three tabs, a row of
  // year chips and a count each all ask the same question of the same list,
  // and a count computed one way beside a list filtered another is the oldest
  // bug on any screen in this system.
  const classified: Classified[] = useMemo(() => rows.map((r) => {
    const student = admitted.get(r.id);
    const { year: y, basis } = personYear({
      role: r.role,
      accountOpenedAt: r.created_at,
      admissionYear: student?.year ?? null,
      appliedAt: student?.applied ?? null,
      startedOn: started.get(r.id) ?? null,
    });
    return {
      ...r, kind: personKind(r.role), year: y, basis, applicant: isApplicant(r.role),
    };
  }), [rows, admitted, started]);

  if (!allowed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 flex-shrink-0 text-amber-600" size={20} />
          <div>
            <h2 className="font-semibold text-amber-900">Accounts</h2>
            <p className="mt-1 text-sm text-amber-800">
              Creating accounts, assigning roles and suspending people is held by the
              Superadministrator alone. An administrator who could assign roles could
              make themselves anything, which would end every other separation of duties
              in this system.
            </p>
          </div>
        </div>
      </div>
    );
  }


  // THE SEARCH REACHES ACROSS ALL THREE GROUPS, and the tabs are set aside
  // while it does. Somebody who types a surname wants that person, not that
  // person if they happen to be in the group currently selected — a search
  // that silently searches a third of the register is worse than none.
  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const matching = classified.filter((r) => !searching
    || `${r.email ?? ''} ${r.full_name ?? ''} ${roleLabels[r.role] ?? r.role}`
      .toLowerCase().includes(needle));

  const counts = PERSON_KINDS.map((k) => ({
    ...k,
    count: classified.filter((r) => r.kind === k.kind).length,
  }));

  const inKind = matching.filter((r) => r.kind === kind);
  const years = yearsPresent(inKind, (r) => r.year);
  // A YEAR CHIP THAT IS NO LONGER THERE IS NOT LEFT SELECTED, which would
  // draw an empty table and look like a broken filter.
  const activeYear = year !== 'all' && years.some((y) => y.year === year) ? year : 'all';
  const filtered = searching
    ? matching
    : inKind.filter((r) => activeYear === 'all' || r.year === activeYear);

  const applicantsHere = classified.filter((r) => r.kind === 'student' && r.applicant).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Accounts</h2>
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
          Create staff accounts, and suspend or reinstate anyone below your own rank.
        </p>
      </div>

      {message && (
        <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
          message.tone === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {message.tone === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />}
          <p>{message.text}</p>
        </div>
      )}

      {handover && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <KeyRound size={15} /> Hand these over in person, then close this panel
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-sm">
            <span>{handover.email}</span>
            <span className="rounded bg-white px-2 py-1 ring-1 ring-amber-200">{handover.password}</span>
            <button
              onClick={() => navigator.clipboard?.writeText(handover.password)}
              className="flex items-center gap-1 text-xs font-sans text-amber-800 hover:underline"
            >
              <Copy size={12} /> Copy
            </button>
            <button onClick={() => setHandover(null)} className="text-xs font-sans text-amber-800 hover:underline">
              Done
            </button>
          </div>
        </div>
      )}

      {/* Create ------------------------------------------------------- */}
      <form onSubmit={createAccount} className="rounded-xl border border-[#ded6c8] dark:border-[#3d3349] bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">
          <UserPlus size={16} /> Create a staff account
        </h3>
        <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          A temporary password is generated on the server and emailed. It is never chosen here and
          never passes through this browser.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">Email</span>
            <input required type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ded6c8] dark:border-[#3d3349] px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">Full name</span>
            <input required value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[#ded6c8] dark:border-[#3d3349] px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">Role</span>
            <select value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="mt-1 w-full rounded-lg border border-[#ded6c8] dark:border-[#3d3349] px-3 py-2 text-sm">
              {CREATABLE.filter((r) => canActOn(user?.role, r)).map((r) => (
                <option key={r} value={r}>{roleLabels[r]}</option>
              ))}
            </select>
          </label>
        </div>

        {/* A lecturer needs a teaching record as well as an account, or they
            cannot be allocated a course however correct their role is. */}
        {form.role === 'lecturer' && (
          <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-3 md:grid-cols-3">
            <label className="block">
              <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">Title</span>
              <input value={form.title} placeholder="Dr / Prof / Rev"
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#ded6c8] dark:border-[#3d3349] px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">Specialisation</span>
              <input value={form.specialization} placeholder="Systematic Theology"
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#ded6c8] dark:border-[#3d3349] px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">Phone</span>
              <input value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#ded6c8] dark:border-[#3d3349] px-3 py-2 text-sm" />
            </label>
          </div>
        )}

        <button type="submit" disabled={busy === 'create'}
          className="mt-4 flex items-center gap-2 rounded-xl bg-[#422e59] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#322244] disabled:opacity-40">
          {busy === 'create' ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <><UserPlus size={15} /> Create account</>}
        </button>
      </form>

      {/* List --------------------------------------------------------- */}
      <div className="rounded-xl border border-[#ded6c8] dark:border-[#3d3349] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0ece4] dark:border-[#2a2333] p-4">
          <h3 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">
            All accounts <span className="font-normal text-[#a49bb0] dark:text-[#7b7289]">({rows.length})</span>
          </h3>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a49bb0] dark:text-[#7b7289]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search every group…"
              aria-label="Search every group"
              className="w-56 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] py-1.5 pl-9 pr-3 text-sm" />
          </div>
        </div>

        {/* ---- LECTURERS · STUDENTS · ADMINISTRATION ---------------------
            The three the University named. The count on each tab is taken
            from the same classified list the table below filters, so the
            number and the rows can never be two different answers. */}
        <div className="flex flex-wrap gap-1 border-b border-[#f0ece4] px-4 pt-3 dark:border-[#2a2333]">
          {counts.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => { setKind(k.kind); setYear('all'); }}
              title={k.note}
              aria-current={kind === k.kind && !searching}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                kind === k.kind && !searching
                  ? 'bg-[#f4f2fa] text-[#422e59]'
                  : 'text-[#6b6076] hover:bg-gray-50 dark:text-[#9c93ad]'
              }`}
            >
              {k.label}
              <span className="ml-1.5 text-xs font-normal text-[#a49bb0] dark:text-[#7b7289]">
                {k.count}
              </span>
            </button>
          ))}
        </div>

        {/* ---- AND THE YEARS WITHIN THE CHOSEN GROUP --------------------
            Set aside while a search is running: a search reaches across all
            three groups and every year, and leaving the chips lit would say
            otherwise. */}
        {!searching && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#f0ece4] px-4 py-2.5 dark:border-[#2a2333]">
            <span className="mr-1 text-xs uppercase tracking-wide text-[#a49bb0] dark:text-[#7b7289]">
              Year
            </span>
            <button
              type="button"
              onClick={() => setYear('all')}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                activeYear === 'all'
                  ? 'bg-[#422e59] text-white'
                  : 'bg-gray-100 text-[#6b6076] hover:bg-gray-200 dark:text-[#9c93ad]'
              }`}
            >
              All {inKind.length}
            </button>
            {years.map((y) => (
              <button
                key={y.year}
                type="button"
                onClick={() => setYear(y.year)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  activeYear === y.year
                    ? 'bg-[#422e59] text-white'
                    : 'bg-gray-100 text-[#6b6076] hover:bg-gray-200 dark:text-[#9c93ad]'
                }`}
              >
                {yearLabel(y.year)} {y.count}
              </button>
            ))}
            {years.length === 0 && (
              <span className="text-xs text-[#a49bb0] dark:text-[#7b7289]">
                Nobody is in this group yet.
              </span>
            )}
          </div>
        )}

        {/* AN APPLICANT IS NOT A STUDENT, and is said so rather than folded
            into the count silently. This system refuses to treat an
            application and an admitted student as the same record; the screen
            should not either. */}
        {!searching && kind === 'student' && applicantsHere > 0 && (
          <p className="border-b border-[#f0ece4] bg-[#fdf9f0] px-4 py-2 text-xs text-[#6b6076] dark:border-[#2a2333] dark:text-[#9c93ad]">
            {applicantsHere} of these {applicantsHere === 1 ? 'is an applicant' : 'are applicants'},
            not yet admitted. Their year is the year they applied.
          </p>
        )}

        {searching && (
          <p className="border-b border-[#f0ece4] px-4 py-2 text-xs text-[#6b6076] dark:border-[#2a2333] dark:text-[#9c93ad]">
            Searching every group and every year · {filtered.length}
            {filtered.length === 1 ? ' match' : ' matches'}
          </p>
        )}

        {loading ? (
          <p className="p-6 text-sm text-[#a49bb0] dark:text-[#7b7289]">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-[#6b6076] dark:text-[#9c93ad]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  {/* THE YEAR, AND WHAT IT IS THE YEAR OF. A bare number here
                      would be a guess the reader cannot check: for a student
                      it is the admission year out of the register, for staff
                      the year they started out of their staff record, and
                      only otherwise the year the account was opened. */}
                  <th className="px-4 py-2.5 font-medium">Year</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
                {filtered.map((r) => {
                  const isSelf = r.id === user?.id;
                  const mayAct = !isSelf && canActOn(user?.role, r.role);
                  return (
                    <tr key={r.id} className={r.suspended_at ? 'bg-red-50/40' : undefined}>
                      <td className="px-4 py-2.5 text-[#33234a] dark:text-[#e4dcf0]">
                        {r.full_name ?? '—'}
                        {isSelf && <span className="ml-2 text-[11px] text-[#a49bb0] dark:text-[#7b7289]">(you)</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#6b6076] dark:text-[#9c93ad]">{r.email}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          SYSTEM_ROLES.includes(r.role)
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-gray-100 text-[#6b6076] dark:text-[#9c93ad]'
                        }`}>
                          {roleLabels[r.role] ?? r.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-[#33234a] dark:text-[#e4dcf0]">
                          {yearLabel(r.year)}
                        </span>
                        <span className="ml-1.5 text-[11px] text-[#a49bb0] dark:text-[#7b7289]">
                          {YEAR_BASIS_LABELS[r.basis]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {r.suspended_at ? (
                          <span title={r.suspension_reason ?? ''} className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                            Suspended
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => suspend(r)}
                          disabled={!mayAct || busy === r.id}
                          title={
                            isSelf
                              ? 'You cannot suspend your own account.'
                              : !mayAct
                                ? 'This account is your own rank or above.'
                                : undefined
                          }
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                            r.suspended_at
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-700 hover:bg-red-100'
                          }`}
                        >
                          {busy === r.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : r.suspended_at ? <RotateCcw size={12} /> : <Ban size={12} />}
                          {r.suspended_at ? 'Reinstate' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#a49bb0] dark:text-[#7b7289]">
                      {searching
                        ? 'Nobody in any group matches that.'
                        : 'No accounts in this group and year.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Turn a route's machine-readable error into something a person can act on. */
function explain(error: string): string {
  if (error === 'service-role-key-missing') {
    return 'SUPABASE_SERVICE_ROLE_KEY is not set in Vercel. Nothing was changed.';
  }
  if (error === 'session-expired') return 'Your session has expired. Sign in again.';
  if (error === 'caller-suspended') return 'Your own account has been suspended.';
  if (error === 'cannot-act-on-own-account') return 'You cannot suspend your own account.';
  if (error === 'last-active-superadmin') {
    return 'This is the last active Superadministrator. Suspending it would leave nobody able to reinstate anyone.';
  }
  if (error.startsWith('outranked:')) {
    return 'That account is your own rank or above. Only a more senior system role can act on it.';
  }
  if (error.startsWith('cannot-grant:')) {
    return 'You cannot create an account at your own rank or above.';
  }
  if (error === 'use-admissions-pipeline-for-students') {
    return 'Student accounts come from the admissions pipeline, so that a paid application and a Registrar decision sit behind every one.';
  }
  if (error.startsWith('not-permitted:')) return 'Your role does not hold this capability.';
  return error;
}
