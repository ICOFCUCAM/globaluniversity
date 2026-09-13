'use client';

// ---------------------------------------------------------------------------
// THE CONDITIONS OF APPOINTMENT, AND THE SCREEN THAT CHANGES THEM.
//
// ---------------------------------------------------------------------------
// WHY THIS SCREEN HAD TO EXIST
// ---------------------------------------------------------------------------
//
// 078 gave every post in the register twenty-two standard conditions and the
// appointment form fills them in with one click, which is what the University
// asked for. It also left the University with a contract it could not change a
// word of without somebody writing SQL — and conditions the University cannot
// amend are not the University's conditions.
//
// ---------------------------------------------------------------------------
// WHAT IT SHOWS, AND WHY IT IS BY FAMILY
// ---------------------------------------------------------------------------
//
// Eight families, not forty-three posts. The conditions are genuinely common:
// the confidentiality clause is the same for a Registrar and a systems
// administrator, and forty-three copies of it would say four different things
// within a year. A post that genuinely needs its own term gets a set of its
// own, and it REPLACES the family's section by section — the rule 048
// established for job descriptions and 078 reuses here.
//
// ---------------------------------------------------------------------------
// AN ACTIVE SET IS NOT EDITED, IT IS SUPERSEDED
// ---------------------------------------------------------------------------
//
// Somebody was appointed on it. Changing the words underneath them would mean
// the University could not later say what anybody actually accepted. So the
// buttons here offer a NEW VERSION, carrying the current wording, which is
// edited and then put in force by somebody other than its author.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { BTN_PRIMARY, BTN_GHOST, INPUT, LABEL } from '@/lib/portalTheme';
import { AlertTriangle, Check, Loader2, Plus, Trash2, FilePlus2, ChevronRight } from 'lucide-react';
import { POSITION_FAMILIES, FAMILY_LABELS, type PositionFamily } from '@/lib/positions';
import {
  CONDITION_SECTIONS, CONDITION_LABELS, type ConditionSection,
} from '@/lib/appointmentConditions';

// SINGLE STRING LITERALS. Concatenation makes supabase-js collapse the
// inferred type to GenericStringError[], silently.
// eslint-disable-next-line max-len
const SETS = 'id, position_id, family, version, preamble, status, effective_from, created_by, activated_by, activated_at';
const CLAUSES = 'id, set_id, section, ordinal, body';

interface ConditionSet {
  id: string;
  position_id: string | null;
  family: string | null;
  version: number;
  preamble: string | null;
  status: string;
  effective_from: string | null;
  created_by: string | null;
  activated_by: string | null;
  activated_at: string | null;
}

interface ClauseRow {
  id: string;
  set_id: string;
  section: string;
  ordinal: number;
  body: string;
}

export default function AppointmentConditions() {
  const { user } = useAuth();
  const mayEdit = can(user?.role, 'approve-credential-design');

  const [sets, setSets] = useState<ConditionSet[]>([]);
  const [clauses, setClauses] = useState<ClauseRow[]>([]);
  const [open, setOpen] = useState<PositionFamily | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<ConditionSection | null>(null);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        supabase.from('appointment_condition_sets').select(SETS)
          .order('family').order('version', { ascending: false }),
        supabase.from('appointment_condition_clauses').select(CLAUSES)
          .order('section').order('ordinal'),
      ]);
      if (s.error) throw new Error(s.error.message);
      setSets((s.data ?? []) as unknown as ConditionSet[]);
      setClauses((c.data ?? []) as unknown as ClauseRow[]);
    } catch (e) {
      // SAID, NOT SWALLOWED. A database nobody can reach and a University with
      // no conditions draw the same empty screen, and only one is a reason to
      // go and do something.
      setNote({ kind: 'bad', text: `The conditions could not be read: ${String(e)}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /**
   * The set a family is currently working from.
   *
   * THE DRAFT IF THERE IS ONE, otherwise the active version. A family with a
   * draft in progress should open on the draft — that is the thing somebody
   * is in the middle of — and the panel says which it is showing.
   */
  const setFor = useCallback((family: string) => {
    const mine = sets.filter((s) => s.family === family && !s.position_id);
    return mine.find((s) => s.status === 'draft')
      ?? mine.find((s) => s.status === 'active')
      ?? null;
  }, [sets]);

  const activeFor = useCallback(
    (family: string) => sets.find(
      (s) => s.family === family && !s.position_id && s.status === 'active') ?? null,
    [sets],
  );

  const clausesOf = useCallback(
    (setId?: string) => (setId ? clauses.filter((c) => c.set_id === setId) : []),
    [clauses],
  );

  const act = async (payload: Record<string, unknown>, label: string) => {
    setBusy(label);
    setNote(null);
    try {
      const j = await authedPost('/api/admin/appointment-conditions', payload);
      if (!j.ok) {
        setNote({ kind: 'bad', text: j.detail ?? j.error ?? 'That was refused.' });
        return false;
      }
      setNote({ kind: 'ok', text: j.detail ?? 'Saved.' });
      await load();
      return true;
    } catch (e) {
      setNote({ kind: 'bad', text: String(e) });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const current = open ? setFor(open) : null;
  const currentClauses = clausesOf(current?.id);
  const editable = current?.status === 'draft';

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#422e59] dark:text-[#e9e2f2]">
          Conditions of appointment
        </h1>
        <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          What the University and a member of staff owe each other. Held for each family of
          posts and filled into every appointment letter, where the officer preparing it can
          still change any word.
        </p>
      </header>

      {note && (
        <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
          note.kind === 'ok'
            ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200'
            : 'bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-200'}`}>
          {note.kind === 'ok'
            ? <Check size={15} className="mt-px shrink-0" />
            : <AlertTriangle size={15} className="mt-px shrink-0" />}
          <span>{note.text}</span>
        </p>
      )}

      {loading && (
        <p role="status" className="flex items-center gap-2 text-sm text-[#6b6076]">
          <Loader2 size={15} className="animate-spin" /> Reading the conditions…
        </p>
      )}

      {!loading && sets.length === 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm
                      text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle size={15} className="mt-px shrink-0" />
          <span>
            The University has no conditions of appointment in the system, so every letter is
            silent about duration, probation, notice and confidentiality. Migration 078 seeds
            them; if it has not been run yet, that is why this is empty.
          </span>
        </p>
      )}

      {/* ---- THE EIGHT FAMILIES ------------------------------------------ */}
      {!loading && sets.length > 0 && (
        <div className="space-y-2">
          {POSITION_FAMILIES.map((family) => {
            const s = setFor(family);
            const n = clausesOf(s?.id).length;
            const isOpen = open === family;
            return (
              <div key={family}
                className="rounded-xl border border-[#e6e0ee] dark:border-[#3a3147]">
                <button type="button"
                  onClick={() => { setOpen(isOpen ? null : family); setAdding(null); }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                  <span className="flex items-center gap-2">
                    <ChevronRight size={15}
                      className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    <span className="font-heading text-sm font-bold text-[#422e59]
                                     dark:text-[#e9e2f2]">
                      {FAMILY_LABELS[family]}
                    </span>
                  </span>
                  <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    {s
                      ? `${n} conditions · version ${s.version} · ${s.status === 'draft'
                        ? 'draft, not in force' : 'in force'}`
                      : 'nothing written'}
                  </span>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-[#e6e0ee] px-4 py-4
                                  dark:border-[#3a3147]">
                    {!s && (
                      <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
                        No conditions are written for this family, so an appointment to one of
                        its posts carries whatever the officer types.
                      </p>
                    )}

                    {s && (
                      <>
                        {/* ---- WHAT STATE IT IS IN --------------------------- */}
                        {s.status === 'active' ? (
                          <p className="rounded-lg bg-[#f6f3fa] px-3 py-2 text-xs
                                        text-[#6b6076] dark:bg-[#2b2536] dark:text-[#9c93ad]">
                            In force{s.effective_from ? ` from ${s.effective_from}` : ''}.
                            People have been appointed on these, so they are not edited in
                            place. Make a new version to change them — the version somebody
                            accepted stays on the record exactly as it was.
                          </p>
                        ) : (
                          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900
                                        dark:bg-amber-500/10 dark:text-amber-200">
                            Version {s.version} is a DRAFT and reaches no letter. The version in
                            force is still{' '}
                            {activeFor(family)
                              ? `version ${activeFor(family)!.version}`
                              : 'nothing'}
                            . Somebody other than whoever wrote this draft puts it in force.
                          </p>
                        )}

                        {/* ---- THE PREAMBLE --------------------------------- */}
                        {s.preamble && (
                          <p className="text-sm italic text-[#4b4356] dark:text-[#b8aec7]">
                            {s.preamble}
                          </p>
                        )}

                        {/* ---- THE CONDITIONS, IN PRINTING ORDER ------------ */}
                        <ol className="space-y-3">
                          {CONDITION_SECTIONS.map((section) => {
                            const mine = currentClauses
                              .filter((c) => c.section === section)
                              .sort((a, b) => a.ordinal - b.ordinal);
                            if (mine.length === 0 && !editable) return null;
                            return (
                              <li key={section}>
                                <p className="text-xs font-bold uppercase tracking-wide
                                              text-[#422e59] dark:text-[#c9b6e6]">
                                  {CONDITION_LABELS[section]}
                                </p>
                                {mine.length === 0 ? (
                                  <p className="text-xs italic text-[#9c93ad]">
                                    nothing written
                                  </p>
                                ) : mine.map((c) => (
                                  <p key={c.id}
                                    className="group flex items-start gap-2 text-sm
                                               text-[#4b4356] dark:text-[#b8aec7]">
                                    <span className="flex-1">{c.body}</span>
                                    {mayEdit && editable && (
                                      <button type="button" title="Remove this condition"
                                        className="opacity-0 transition group-hover:opacity-100"
                                        onClick={() => void act({
                                          action: 'remove', id: s.id,
                                          section: c.section, ordinal: c.ordinal,
                                        }, c.id)}>
                                        <Trash2 size={13} className="text-rose-600" />
                                      </button>
                                    )}
                                  </p>
                                ))}

                                {mayEdit && editable && (
                                  adding === section ? (
                                    <div className="mt-1 space-y-2">
                                      <label htmlFor={`c-${section}`} className={LABEL}>
                                        The condition, in the words it will be read in
                                      </label>
                                      <textarea id={`c-${section}`} rows={3} value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        className={INPUT} />
                                      <div className="flex gap-2">
                                        <button type="button" className={BTN_PRIMARY}
                                          disabled={busy !== null}
                                          onClick={async () => {
                                            const ok = await act({
                                              action: 'clause', id: s.id, section,
                                              ordinal: mine.length + 1, body: draft,
                                            }, `add-${section}`);
                                            if (ok) { setDraft(''); setAdding(null); }
                                          }}>
                                          {busy === `add-${section}`
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : <Check size={14} />} Add
                                        </button>
                                        <button type="button" className={BTN_GHOST}
                                          onClick={() => { setAdding(null); setDraft(''); }}>
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button type="button"
                                      className="mt-1 flex items-center gap-1 text-xs
                                                 text-[#6b6076] hover:underline
                                                 dark:text-[#9c93ad]"
                                      onClick={() => { setAdding(section); setDraft(''); }}>
                                      <Plus size={12} /> Add to {CONDITION_LABELS[section]
                                        .toLowerCase()}
                                    </button>
                                  )
                                )}
                              </li>
                            );
                          })}
                        </ol>

                        {/* ---- THE TWO ACTS -------------------------------- */}
                        {mayEdit && (
                          <div className="flex flex-wrap gap-2 border-t border-[#e6e0ee]
                                          pt-3 dark:border-[#3a3147]">
                            {s.status === 'active' && (
                              <button type="button" className={BTN_GHOST}
                                disabled={busy !== null}
                                onClick={() => void act(
                                  { action: 'fork', setId: s.id }, `fork-${s.id}`)}>
                                {busy === `fork-${s.id}`
                                  ? <Loader2 size={14} className="animate-spin" />
                                  : <FilePlus2 size={14} />} New version to edit
                              </button>
                            )}
                            {s.status === 'draft' && (
                              <button type="button" className={BTN_PRIMARY}
                                disabled={busy !== null}
                                onClick={() => void act(
                                  { action: 'activate', id: s.id }, `act-${s.id}`)}>
                                {busy === `act-${s.id}`
                                  ? <Loader2 size={14} className="animate-spin" />
                                  : <Check size={14} />} Put version {s.version} in force
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!mayEdit && !loading && (
        <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
          You can read the conditions the University appoints on. Changing them is the same
          authority that approves the design of a degree certificate.
        </p>
      )}
    </div>
  );
}
