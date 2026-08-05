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
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can, canActOn, roleLabels, SYSTEM_ROLES } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
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

// Roles this screen offers. Students and applicants are excluded: those come
// from the admissions pipeline, where a paid application and a Registrar
// decision sit behind every account.
const CREATABLE: UserRole[] = [
  'admin', 'registrar', 'finance', 'finance-director', 'admissions-officer',
  'dean', 'hod', 'programme-coordinator', 'lecturer', 'academic-office',
  'library-staff', 'student-affairs', 'chancellor', 'vice-chancellor',
];

export default function AccountManagement() {
  const { user } = useAuth();
  const allowed = can(user?.role, 'create-staff-account');

  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [handover, setHandover] = useState<{ email: string; password: string } | null>(null);

  const [form, setForm] = useState({
    email: '', fullName: '', role: 'lecturer' as UserRole,
    title: '', specialization: '', phone: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, suspended_at, suspension_reason, created_at')
      .order('created_at', { ascending: false });
    setRows((data ?? []) as AccountRow[]);
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

  const filtered = rows.filter((r) =>
    `${r.email ?? ''} ${r.full_name ?? ''} ${r.role}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Accounts</h2>
        <p className="text-sm text-gray-500">
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
      <form onSubmit={createAccount} className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <UserPlus size={16} /> Create a staff account
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          A temporary password is generated on the server and emailed. It is never chosen here and
          never passes through this browser.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="text-xs text-gray-600">Email</span>
            <input required type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">Full name</span>
            <input required value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">Role</span>
            <select value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
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
              <span className="text-xs text-gray-600">Title</span>
              <input value={form.title} placeholder="Dr / Prof / Rev"
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Specialisation</span>
              <input value={form.specialization} placeholder="Systematic Theology"
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Phone</span>
              <input value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </label>
          </div>
        )}

        <button type="submit" disabled={busy === 'create'}
          className="mt-4 flex items-center gap-2 rounded-xl bg-[#422e59] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#322244] disabled:opacity-40">
          {busy === 'create' ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <><UserPlus size={15} /> Create account</>}
        </button>
      </form>

      {/* List --------------------------------------------------------- */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-800">
            All accounts <span className="font-normal text-gray-400">({rows.length})</span>
          </h3>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…"
              className="w-56 rounded-lg border border-gray-200 py-1.5 pl-9 pr-3 text-sm" />
          </div>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const isSelf = r.id === user?.id;
                  const mayAct = !isSelf && canActOn(user?.role, r.role);
                  return (
                    <tr key={r.id} className={r.suspended_at ? 'bg-red-50/40' : undefined}>
                      <td className="px-4 py-2.5 text-gray-800">
                        {r.full_name ?? '—'}
                        {isSelf && <span className="ml-2 text-[11px] text-gray-400">(you)</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{r.email}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          SYSTEM_ROLES.includes(r.role)
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {roleLabels[r.role] ?? r.role}
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
