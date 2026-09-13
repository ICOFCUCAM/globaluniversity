'use client';

// ---------------------------------------------------------------------------
// JOB DESCRIPTIONS — the register of posts, and the wording behind each.
//
// ---------------------------------------------------------------------------
// EIGHT DOCUMENTS, NOT FORTY-SIX
// ---------------------------------------------------------------------------
//
// The University has forty-six posts and eight family profiles. A post's job
// description IS its family's clauses, plus anything the post states for
// itself — and a post's own clause REPLACES the family's for that section
// rather than being appended to it.
//
// So this screen opens on the eight families, because editing one of them is
// how you change the confidentiality clause for every post at once. A post gets
// its own profile only when it genuinely differs, and the button that creates
// one says so.
//
// ---------------------------------------------------------------------------
// WHAT 048 LEFT AND WHY IT IS ALL IN DRAFT
// ---------------------------------------------------------------------------
//
// Migration 048 seeded the eight families with a first draft of the clauses
// every post carries — conduct, confidentiality, reporting, evaluation — and
// what distinguishes each family. Every one is a DRAFT, deliberately: a job
// description states what its holder may authorise and what they are assessed
// on, and it is the document produced when a dismissal is challenged. Nothing
// in it should reach an appointee until the University has read it.
//
// This is the screen for reading and editing it.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL, FOCUS } from '@/lib/portalTheme';
import { AlertTriangle, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  POSITION_FAMILIES, FAMILY_LABELS, JD_SECTIONS, SECTION_LABELS,
  resolveJobDescription, sectionsOf, objectionsToProfile, canActivateProfile,
  type Clause, type Position, type PositionProfile, type JdSection, type PositionFamily,
} from '@/lib/positions';

// eslint-disable-next-line max-len
const POSITIONS = 'id, job_code, title, family, unit_name, faculty, reports_to, indicative_salary_amount, indicative_salary_currency, active';
// eslint-disable-next-line max-len
const PROFILES = 'id, position_id, family, version, job_purpose, status, created_by, activated_by, activated_at';
const CLAUSES = 'profile_id, section, ordinal, body';

type ClauseRow = Clause & { profile_id?: string };

export default function JobDescriptions() {
  const { user } = useAuth();
  const mayEdit = can(user?.role, 'approve-credential-design');

  const [posts, setPosts] = useState<Position[]>([]);
  const [profiles, setProfiles] = useState<PositionProfile[]>([]);
  const [clauses, setClauses] = useState<ClauseRow[]>([]);
  const [open, setOpen] = useState<PositionFamily | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [adding, setAdding] = useState<JdSection | null>(null);
  const [draft, setDraft] = useState('');
  const [purpose, setPurpose] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, pr, c] = await Promise.all([
        supabase.from('positions').select(POSITIONS).order('family').order('title'),
        supabase.from('position_profiles').select(PROFILES),
        supabase.from('position_profile_clauses').select(CLAUSES),
      ]);
      if (p.error) throw new Error(p.error.message);
      setPosts((p.data ?? []) as Position[]);
      setProfiles((pr.data ?? []) as PositionProfile[]);
      setClauses((c.data ?? []) as ClauseRow[]);
    } catch (e) {
      // SAID, NOT SWALLOWED. An unreachable database and a University with no
      // posts draw the same empty screen, and only one is a reason to act.
      setNote({ kind: 'bad', text: `The register could not be read: ${String(e)}` });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const familyProfile = useCallback(
    (family: string) => profiles.find(
      (p) => p.family === family && !p.position_id && p.status !== 'superseded'),
    [profiles],
  );

  const clausesOf = useCallback(
    (profileId?: string) => (profileId
      ? clauses.filter((c) => c.profile_id === profileId) : []),
    [clauses],
  );

  const act = async (payload: Record<string, unknown>, label: string) => {
    setBusy(label);
    setNote(null);
    try {
      const j = await authedPost('/api/admin/job-description', payload);
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

  const drafts = useMemo(
    () => profiles.filter((p) => p.status === 'draft').length, [profiles]);

  if (!mayEdit) {
    return (
      <div className="p-6 text-sm text-gray-600">
        A job description states what its holder may authorise and what they are assessed on.
        Your role does not approve them.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Job Descriptions</h1>
        <p className="text-sm text-gray-600">
          {posts.length} posts, {POSITION_FAMILIES.length} families. A post&rsquo;s job
          description is its family&rsquo;s clauses plus anything the post states for itself —
          so editing a family changes every post in it.
        </p>
      </header>

      {note && (
        <div
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${
            note.kind === 'ok'
              ? 'border-green-200 bg-green-50 text-green-900'
              : 'border-amber-300 bg-amber-50 text-amber-900'}`}
        >
          {note.text}
        </div>
      )}

      {drafts > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {drafts} job description{drafts === 1 ? '' : 's'} waiting to be read and approved
          </p>
          <p className="mt-1 text-sm text-amber-900">
            Migration 048 wrote a first draft of each. It is a starting point, not the
            University&rsquo;s policy — read it, edit what should change, and activate it. A
            draft cannot be attached to an appointment.
          </p>
        </div>
      )}

      {POSITION_FAMILIES.map((family) => {
        const profile = familyProfile(family);
        const own = clausesOf(profile?.id);
        const inFamily = posts.filter((p) => p.family === family);
        const isOpen = open === family;
        const objections = profile ? objectionsToProfile(profile, own) : [];

        return (
          <section key={family} className="rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              aria-expanded={isOpen}
              className={`flex w-full flex-wrap items-center gap-3 p-3 text-left ${FOCUS}`}
              onClick={() => {
                setOpen(isOpen ? null : family);
                setPurpose(profile?.job_purpose ?? '');
                setAdding(null);
              }}
            >
              <div className="min-w-[14rem] flex-1">
                <p className="font-medium text-gray-900">{FAMILY_LABELS[family]}</p>
                <p className="text-xs text-gray-500">
                  {inFamily.length} post{inFamily.length === 1 ? '' : 's'} ·{' '}
                  {profile
                    ? <>version {profile.version} ·{' '}
                      <span className={profile.status === 'active'
                        ? 'font-semibold text-green-700' : 'text-amber-700'}>
                        {profile.status === 'active' ? 'IN FORCE' : 'draft'}
                      </span>
                      {' '}· {own.length} clauses</>
                    : <span className="text-amber-700">no job description</span>}
                </p>
              </div>
              <span className="text-xs text-gray-400">{isOpen ? 'Hide' : 'Open'}</span>
            </button>

            {isOpen && profile && (
              <div className="space-y-4 border-t border-gray-100 p-3">
                {/* THE POSTS IT GOVERNS, named, so an officer editing the
                    academic-staff family can see they are editing the terms of
                    every lecturer at the University. */}
                <p className="text-xs text-gray-500">
                  Governs: {inFamily.map((p) => p.title).join(', ') || '—'}
                </p>

                <div>
                  <label className={LABEL} htmlFor={`p-${family}`}>
                    Job purpose — why the post exists
                  </label>
                  <textarea
                    id={`p-${family}`}
                    className={`${INPUT} min-h-[90px]`}
                    value={purpose}
                    disabled={profile.status !== 'draft'}
                    onChange={(e) => setPurpose(e.target.value)}
                  />
                  {profile.status === 'draft' && (
                    <button
                      type="button"
                      className={`${BTN_SECONDARY} ${FOCUS} mt-2`}
                      disabled={busy !== null}
                      onClick={() => void act(
                        { action: 'purpose', id: profile.id, jobPurpose: purpose }, 'purpose')}
                    >
                      Save purpose
                    </button>
                  )}
                </div>

                {/* THE CLAUSES, in the order the document prints them. */}
                {sectionsOf(own).map((section) => (
                  <div key={section}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {SECTION_LABELS[section]}
                    </h3>
                    <ol className="mt-1 space-y-1">
                      {own.filter((c) => c.section === section)
                        .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
                        .map((c) => (
                          <li key={`${section}-${c.ordinal}`}
                            className="flex gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-sm">
                            <span className="text-gray-400">{c.ordinal}.</span>
                            <span className="flex-1">{c.body}</span>
                            {profile.status === 'draft' && (
                              <button
                                type="button"
                                aria-label="Remove this clause"
                                className={`text-gray-400 hover:text-red-600 ${FOCUS}`}
                                disabled={busy !== null}
                                onClick={() => void act({
                                  action: 'remove', id: profile.id,
                                  section, ordinal: c.ordinal,
                                }, 'remove')}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            )}
                          </li>
                        ))}
                    </ol>
                  </div>
                ))}

                {profile.status === 'draft' && (
                  <div className="rounded-lg border border-gray-200 p-3">
                    <label className={LABEL} htmlFor={`s-${family}`}>Add a clause</label>
                    <select
                      id={`s-${family}`}
                      className={INPUT}
                      value={adding ?? ''}
                      onChange={(e) => setAdding((e.target.value || null) as JdSection | null)}
                    >
                      <option value="">Choose a section&hellip;</option>
                      {JD_SECTIONS.map((s) => (
                        <option key={s} value={s}>{SECTION_LABELS[s]}</option>
                      ))}
                    </select>
                    {adding && (
                      <>
                        <textarea
                          className={`${INPUT} mt-2 min-h-[70px]`}
                          value={draft}
                          placeholder="One numbered responsibility, in the University's words."
                          onChange={(e) => setDraft(e.target.value)}
                        />
                        <button
                          type="button"
                          className={`${BTN_SECONDARY} ${FOCUS} mt-2`}
                          disabled={busy !== null || draft.trim().length < 10}
                          onClick={async () => {
                            const next = own.filter((c) => c.section === adding).length + 1;
                            const ok = await act({
                              action: 'clause', id: profile.id,
                              section: adding, ordinal: next, body: draft,
                            }, 'clause');
                            if (ok) { setDraft(''); }
                          }}
                        >
                          <Plus className="h-4 w-4" aria-hidden /> Add
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* WHAT IS MISSING, said before it is approved rather than
                    discovered at a review. The warnings do not block. */}
                {objections.length > 0 && profile.status === 'draft' && (
                  <ul className="space-y-1 text-sm">
                    {objections.map((o) => (
                      <li key={o.code}
                        className={`rounded-md px-2 py-1.5 ${
                          o.blocking ? 'bg-red-50 text-red-900' : 'bg-gray-50 text-gray-600'}`}>
                        {o.message}
                      </li>
                    ))}
                  </ul>
                )}

                {profile.status === 'draft' && (
                  canActivateProfile(profile, user?.id ?? '') ? (
                    <button
                      type="button"
                      className={`${BTN_PRIMARY} ${FOCUS}`}
                      disabled={busy !== null}
                      onClick={() => void act({ action: 'activate', id: profile.id }, 'activate')}
                    >
                      {busy === 'activate'
                        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        : <Check className="h-4 w-4" aria-hidden />} Put in force
                    </button>
                  ) : (
                    // NOBODY ACTIVATES WHAT THEY WROTE. The button is absent for
                    // the author rather than present and refusing.
                    <p className="text-xs text-gray-500">
                      You wrote this version, so somebody else must put it in force.
                    </p>
                  )
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
