'use client';

// ---------------------------------------------------------------------------
// ACADEMIC STUDIO CONTROL — who may ask a model to do what.
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S RULING, 16 SEPTEMBER 2026
// ---------------------------------------------------------------------------
//
//     "Submission does not automatically mean AI processing… Each capability
//      should be its own permission, rather than having one broad permission
//      called 'AI Access.' … The VC should be able to authorize a lecturer
//      without requiring the Superadmin to manually intervene every time."
//
// ---------------------------------------------------------------------------
// THIS SCREEN IS A DOOR ONTO SOMETHING THAT HAS EXISTED SINCE 056
// ---------------------------------------------------------------------------
//
// The governed grant system the ruling describes was already built: a named
// person, a named capability, a reason of at least twenty characters, a
// COMPULSORY expiry, no edits, no deletes, and revocation recorded as a new
// dated fact rather than as an erasure.
//
// What it never had was a screen. `/api/admin/capability-grant` has been
// sitting in `NO_SCREEN_YET` — a complete permission system nobody could
// reach. So this is not a new mechanism; it is the first way to use one.
//
// ---------------------------------------------------------------------------
// WHY IT SHOWS WHAT SOMEBODY CANNOT DO
// ---------------------------------------------------------------------------
//
// The University: "The locked functions are visible but unavailable… This is
// better than hiding everything because the lecturer understands what the
// Studio is capable of, while the university retains control."
//
// The same reasoning governs this screen. Every one of the thirteen acts is
// drawn for every person, held or not, because the question an office actually
// arrives with is "what could I give this person?" — and a list of only what
// they already hold cannot answer it.
//
// ---------------------------------------------------------------------------
// AND WHY EVERY ROW SAYS WHERE IT CAME FROM
// ---------------------------------------------------------------------------
//
// A capability is held for one of two quite different reasons: because the
// office carries it, or because somebody granted it to this person, by name,
// until a date. Revoking the second is a click. Revoking the first is not
// possible here at all and should not look as though it is — that is a change
// to what the role is, which lives in the role matrix and is a different act
// with a different authority.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { useAuth } from '@/contexts/AuthContext';
import { can, type Capability } from '@/lib/roles';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL, FOCUS } from '@/lib/portalTheme';
import { AlertTriangle, Check, Loader2, Lock, Search, ShieldCheck, Undo2 } from 'lucide-react';

/**
 * The thirteen acts, and what each one lets somebody do.
 *
 * DUPLICATED FROM `src/academic/lib/studioPermissions.ts` ON PURPOSE — and the
 * duplication is checked rather than trusted. That file runs on the SERVER
 * (it reads the service key to resolve grants) and importing it into a client
 * component would pull a service-role client into the browser bundle.
 *
 * `studioControl.test.mjs` compares the two lists and fails if they drift, so
 * this is a copy that cannot quietly become a second opinion.
 */
const ACTS: { capability: string; label: string; note: string; group: string }[] = [
  { capability: 'studio-submit-lecture', label: 'Write lecture', group: 'Submitting',
    note: 'Type a lecture straight into the Studio.' },
  { capability: 'studio-upload-lecture', label: 'Upload notes, audio or video', group: 'Submitting',
    note: 'Bring in prepared notes, a recording or a video.' },
  { capability: 'studio-record-lecture', label: 'Record audio', group: 'Submitting',
    note: 'Record a lecture in the browser.' },

  { capability: 'studio-ai-transcribe', label: 'Transcribe', group: 'Asking a model',
    note: 'Turn a recording into words. Costs money per hour of audio.' },
  { capability: 'studio-ai-refine', label: 'Refine academic text', group: 'Asking a model',
    note: 'Grammar, structure and headings — never facts. The model may not correct a claim.' },
  { capability: 'studio-ai-translate', label: 'Translate', group: 'Asking a model',
    note: 'Carry an approved lecture into another language. Only ever from the master.' },
  { capability: 'studio-ai-generate-audio', label: 'Generate 15-minute audio', group: 'Asking a model',
    note: 'Synthesise a spoken lesson. The most expensive act here, and it puts a voice in front of a cohort.' },
  { capability: 'studio-ai-generate-revision', label: 'Generate revision materials', group: 'Asking a model',
    note: 'Flashcards, summaries and revision sets.' },
  { capability: 'studio-ai-generate-quiz', label: 'Generate quiz', group: 'Asking a model',
    note: 'Practice questions. Not coursework — nothing generated here is marked.' },

  { capability: 'studio-approve-content', label: 'Approve', group: 'Standing behind it',
    note: 'Say the material is academically sound. The database refuses publication without it.' },
  { capability: 'publish-course-material', label: 'Publish to students', group: 'Standing behind it',
    note: 'Release approved material to the cohort. Writes the lesson a student opens.' },
  { capability: 'studio-replace-content', label: 'Replace a recording', group: 'Standing behind it',
    note: 'Put a different recording behind everything already made from the old one.' },

  { capability: 'studio-manage-ebooks', label: 'Manage the course library', group: 'The library',
    note: 'Required and recommended reading, and what may be read or downloaded.' },
];

const GROUPS = ['Submitting', 'Asking a model', 'Standing behind it', 'The library'];

interface Person { id: string; name: string; email: string; role: string }
interface Grant {
  id: string; capability: string; reason: string;
  granted_at: string; expires_at: string; revoked_at: string | null;
}

/** 056 refuses a grant with no expiry, so the form cannot offer "forever". */
const DEFAULT_DAYS = 90;

export default function StudioControl() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [term, setTerm] = useState('');
  const [chosen, setChosen] = useState<Person | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);

  const [reason, setReason] = useState('');
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [wanted, setWanted] = useState<string | null>(null);

  // WHO MAY BE ON THIS SCREEN AT ALL. Both authorities open it: the
  // Superadministrator's broad one, and the Vice-Chancellor's narrow one.
  const mayGrant = Boolean(user?.role
    && (can(user.role, 'assign-roles' as Capability)
      || can(user.role, 'grant-studio-permission' as Capability)));

  const loadPeople = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .order('full_name');
    setPeople((data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.full_name ?? row.email ?? 'Unnamed account'),
      email: String(row.email ?? ''),
      role: String(row.role ?? ''),
    })));
  }, []);

  useEffect(() => { void loadPeople(); }, [loadPeople]);

  const loadGrants = useCallback(async (person: Person) => {
    setBusy('loading');
    const result = await authedPost('/api/admin/capability-grant',
      { action: 'list', granteeId: person.id, capability: 'studio-' });
    setBusy(null);
    if (!result.ok) {
      setNote({ kind: 'bad', text: result.error ?? 'The grants could not be read.' });
      return;
    }
    setGrants(((result.data as { grants?: Grant[] } | undefined)?.grants) ?? []);
  }, []);

  const choose = async (person: Person) => {
    setChosen(person); setGrants([]); setNote(null); setWanted(null); setReason('');
    await loadGrants(person);
  };

  /** A grant in force right now: not revoked, and not yet expired. */
  const live = useMemo(() => {
    const now = Date.now();
    const out = new Map<string, Grant>();
    for (const g of grants) {
      if (g.revoked_at) continue;
      if (new Date(g.expires_at).getTime() <= now) continue;
      out.set(g.capability, g);
    }
    return out;
  }, [grants]);

  const submitGrant = async () => {
    if (!chosen || !wanted) return;
    setBusy('granting'); setNote(null);
    const result = await authedPost('/api/admin/capability-grant', {
      action: 'grant', granteeId: chosen.id, capability: wanted, reason, days,
    });
    setBusy(null);
    if (!result.ok) {
      setNote({ kind: 'bad', text: result.error ?? 'It was not granted.' });
      return;
    }
    setNote({ kind: 'ok', text: `Granted to ${chosen.name}, until ${new Date(Date.now() + days * 86400000).toLocaleDateString()}.` });
    setWanted(null); setReason('');
    await loadGrants(chosen);
  };

  const revoke = async (grant: Grant) => {
    if (!chosen) return;
    setBusy(grant.id); setNote(null);
    const result = await authedPost('/api/admin/capability-grant',
      { action: 'revoke', id: grant.id, capability: grant.capability });
    setBusy(null);
    if (!result.ok) {
      setNote({ kind: 'bad', text: result.error ?? 'It was not revoked.' });
      return;
    }
    await loadGrants(chosen);
  };

  const matches = people.filter((p) => {
    if (!term.trim()) return true;
    const t = term.toLowerCase();
    return p.name.toLowerCase().includes(t) || p.email.toLowerCase().includes(t);
  }).slice(0, 40);

  if (!mayGrant) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={16} className="mr-2 inline" />
          Studio Control is held by the Superadministrator and the Vice-Chancellor. Your account
          does not carry either authority.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#57549a]">
          Academic Studio
        </p>
        <h1 className="text-2xl font-semibold text-[#322244]">Studio Control</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Lecturers provide the teaching. The University controls the transformation. Submitting a
          lecture and asking a model to work on it are different acts, and the second one is given
          by name — with a reason, and until a date.
        </p>
      </header>

      {note && (
        <div className={`rounded-lg border p-3 text-sm ${note.kind === 'ok'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
          : 'border-rose-300 bg-rose-50 text-rose-900'}`}>
          {note.kind === 'ok' ? <Check size={16} className="mr-2 inline" />
            : <AlertTriangle size={16} className="mr-2 inline" />}
          {note.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[20rem,1fr]">
        {/* ---- WHO ------------------------------------------------------ */}
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-3">
            <label className={LABEL} htmlFor="studio-control-search">Find a person</label>
            <div className="relative mt-1">
              <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                id="studio-control-search"
                className={`${INPUT} pl-8`}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Name or email address"
              />
            </div>
          </div>
          <ul className="max-h-[28rem] overflow-y-auto">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => void choose(p)}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 ${FOCUS} ${
                    chosen?.id === p.id ? 'bg-[#f4f2fa] font-semibold' : ''}`}
                >
                  <span className="text-[#322244]">{p.name}</span>
                  <span className="text-xs text-slate-500">{p.role || 'no role'}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="p-3 text-sm text-slate-500">Nobody matches that.</li>
            )}
          </ul>
        </section>

        {/* ---- WHAT THEY MAY DO ----------------------------------------- */}
        <section>
          {!chosen && (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              Choose a person to see what the Studio will let them do, and what it will not.
            </div>
          )}

          {chosen && (
            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-lg font-semibold text-[#322244]">{chosen.name}</h2>
                <p className="text-sm text-slate-600">{chosen.role || 'no role'} · {chosen.email}</p>
              </div>

              {busy === 'loading' && (
                <p className="text-sm text-slate-500">
                  <Loader2 size={14} className="mr-2 inline animate-spin" />
                  Reading what has been granted…
                </p>
              )}

              {GROUPS.map((group) => (
                <div key={group} className="rounded-lg border border-slate-200 bg-white">
                  <h3 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-[#322244]">
                    {group}
                  </h3>
                  <ul className="divide-y divide-slate-100">
                    {ACTS.filter((a) => a.group === group).map((act) => {
                      const grant = live.get(act.capability);
                      return (
                        <li key={act.capability} className="flex items-start gap-3 px-4 py-3">
                          <span className="mt-0.5">
                            {grant
                              ? <ShieldCheck size={16} className="text-emerald-600" />
                              : <Lock size={16} className="text-slate-400" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#322244]">{act.label}</p>
                            <p className="text-xs text-slate-500">{act.note}</p>
                            {grant && (
                              <p className="mt-1 text-xs text-emerald-700">
                                Granted until {new Date(grant.expires_at).toLocaleDateString()} —
                                {' '}{grant.reason}
                              </p>
                            )}
                          </div>
                          {grant ? (
                            <button
                              onClick={() => void revoke(grant)}
                              disabled={busy === grant.id}
                              className={`${BTN_SECONDARY} shrink-0 text-xs`}
                            >
                              {busy === grant.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : <><Undo2 size={13} className="mr-1 inline" />Revoke</>}
                            </button>
                          ) : (
                            <button
                              onClick={() => { setWanted(act.capability); setReason(''); }}
                              className={`${BTN_SECONDARY} shrink-0 text-xs`}
                            >
                              Grant
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              {/* ---- THE GRANT ITSELF ---------------------------------- */}
              {wanted && (
                <div className="rounded-lg border border-[#57549a] bg-[#f8f7fc] p-4">
                  <h3 className="text-sm font-semibold text-[#322244]">
                    Grant “{ACTS.find((a) => a.capability === wanted)?.label}” to {chosen.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    A grant cannot be edited afterwards and cannot be deleted. Revoking it later is
                    a new, dated fact — so six months from now the record still says who could do
                    this, and when.
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,10rem]">
                    <div>
                      <label className={LABEL} htmlFor="studio-grant-reason">
                        Why (at least 20 characters — the database refuses less)
                      </label>
                      <textarea
                        id="studio-grant-reason"
                        className={`${INPUT} mt-1 min-h-[4.5rem]`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Preparing the Semester 2 lecture series in French and Portuguese."
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="studio-grant-days">For how long</label>
                      <select
                        id="studio-grant-days"
                        className={`${INPUT} mt-1`}
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                      >
                        <option value={30}>30 days</option>
                        <option value={60}>60 days</option>
                        <option value={90}>90 days</option>
                      </select>
                      <p className="mt-1 text-xs text-slate-500">
                        There is no “forever”. A permission that never lapses is one nobody
                        revisits.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => void submitGrant()}
                      disabled={busy === 'granting' || reason.trim().length < 20}
                      className={BTN_PRIMARY}
                    >
                      {busy === 'granting'
                        ? <><Loader2 size={14} className="mr-2 inline animate-spin" />Granting…</>
                        : 'Grant it'}
                    </button>
                    <button onClick={() => setWanted(null)} className={BTN_SECONDARY}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ---- WHAT HAPPENED BEFORE ------------------------------ */}
              {grants.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white">
                  <h3 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-[#322244]">
                    Everything ever granted to {chosen.name}
                  </h3>
                  <ul className="divide-y divide-slate-100 text-xs">
                    {grants.map((g) => (
                      <li key={g.id} className="px-4 py-2">
                        <span className="font-medium text-[#322244]">
                          {ACTS.find((a) => a.capability === g.capability)?.label ?? g.capability}
                        </span>
                        {' — '}
                        {new Date(g.granted_at).toLocaleDateString()}
                        {' to '}
                        {new Date(g.expires_at).toLocaleDateString()}
                        {g.revoked_at && (
                          <span className="text-rose-700">
                            {' · revoked '}{new Date(g.revoked_at).toLocaleDateString()}
                          </span>
                        )}
                        <span className="block text-slate-500">{g.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
