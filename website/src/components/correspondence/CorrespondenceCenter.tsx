'use client';

// ---------------------------------------------------------------------------
// THE CORRESPONDENCE CENTER — where an office writes its own letters.
//
// ---------------------------------------------------------------------------
// WHAT IS DELIBERATELY ABSENT FROM THIS SCREEN
// ---------------------------------------------------------------------------
//
// A "submit for approval" button. Everywhere else in this system composing and
// clearing are two people, and the screen enforces it by making the composer's
// last act a handover. Here the Vice-Chancellor writes a letter and authorises
// it, on this screen, with nobody in between — because a letter to a ministry
// IS the Vice-Chancellor speaking, and an approval step would be inventing an
// authority above the one the University has.
//
// The one thing that is refused: whoever PREPARED a letter cannot authorise it.
// `actionsFor` decides that, not this file, and 045 refuses it again in the
// database for the caller that forgets.
//
// ---------------------------------------------------------------------------
// THE THREE WORKFLOWS ARE ONE FORM
// ---------------------------------------------------------------------------
//
// Issue directly, schedule, save a draft, or hand it to somebody to prepare —
// the University asked for four paths, and they are four buttons under one
// composer rather than four screens. They differ only in what happens after the
// letter is written, and a screen that asked which path you wanted BEFORE you
// had written anything would be asking at the moment you know least.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL, FOCUS } from '@/lib/portalTheme';
import { Plus, Loader2, Send, Clock, Save, UserPlus, AlertTriangle, Eye } from 'lucide-react';
import {
  LETTER_KINDS, KIND_LABELS, OFFICES, OFFICE_LABELS, STATE_LABELS,
  TABS, TAB_LABELS, tabFor, countersFor, actionsFor, objectionsTo, blocks,
  type Correspondence, type Tab, type LetterKind, type Office,
} from '@/lib/correspondence';

type Row = Correspondence & { id: string };

const EMPTY: Correspondence = {
  kind: 'general',
  originating_office: 'vice-chancellor',
  subject: '',
  body: '',
  recipient_name: '',
  recipient_org: '',
  recipient_email: '',
  recipient_address: '',
};

export default function CorrespondenceCenter() {
  const { user } = useAuth();
  const mayCompose = can(user?.role, 'compose-correspondence');
  const mayAuthorize = can(user?.role, 'authorize-correspondence');
  const mayIssue = can(user?.role, 'issue-correspondence');
  const mayPrepare = can(user?.role, 'prepare-correspondence');

  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<Tab>('drafts');
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<Correspondence>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/correspondence', { credentials: 'include' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? 'not-read');
      setRows(j.letters as Row[]);
    } catch (e) {
      // SAID, NOT SWALLOWED. The sandbox cannot reach the University's
      // database and this screen then shows an empty register, which looks
      // exactly like an institution that has never written a letter.
      setMessage({ kind: 'bad', text: `The register could not be read: ${String(e)}` });
      setRows([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counters = useMemo(() => countersFor(rows ?? []), [rows]);
  const shown = useMemo(
    () => (rows ?? []).filter((r) => tabFor(r) === tab), [rows, tab]);

  // EVERYTHING WRONG WITH IT, WHILE IT IS BEING WRITTEN. Not at the moment of
  // issuing, which is the moment the author has stopped reading.
  const objections = useMemo(() => objectionsTo(draft), [draft]);
  const ready = !blocks(objections);

  const post = async (payload: Record<string, unknown>, label: string) => {
    setBusy(label);
    setMessage(null);
    try {
      const r = await fetch('/api/correspondence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) {
        setMessage({ kind: 'bad', text: j.detail ?? j.error ?? 'That was refused.' });
        return null;
      }
      setMessage({ kind: 'ok', text: j.detail ?? 'Done.' });
      await load();
      return j as Record<string, unknown>;
    } catch (e) {
      setMessage({ kind: 'bad', text: String(e) });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const payload = {
      action: editingId ? 'edit' : 'draft',
      ...(editingId ? { id: editingId } : {}),
      kind: draft.kind,
      office: draft.originating_office,
      subject: draft.subject,
      body: draft.body,
      recipientName: draft.recipient_name,
      recipientOrg: draft.recipient_org,
      recipientEmail: draft.recipient_email,
      recipientAddress: draft.recipient_address,
    };
    const j = await post(payload, 'save');
    if (j && typeof j.id === 'string') setEditingId(j.id);
    return j?.id as string | undefined;
  };

  /**
   * Write it, clear it and send it — the path the University asked for.
   *
   * THREE CALLS, NOT ONE. Saving, authorising and issuing are three acts with
   * three history entries, and collapsing them into a single endpoint would
   * mean a failure halfway through left no record of how far it got.
   */
  const issueDirectly = async () => {
    const id = editingId ?? await save();
    if (!id) return;
    const a = await post({ action: 'authorize', id }, 'issue');
    if (!a) return;
    const done = await post({ action: 'issue', id }, 'issue');
    if (done) {
      setComposing(false);
      setDraft(EMPTY);
      setEditingId(null);
      setTab('issued');
    }
  };

  if (!mayCompose && !mayPrepare) {
    return (
      <div className="p-6 text-sm text-gray-600">
        Official correspondence is written by the office it comes from. Your role does not
        compose or prepare it.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Correspondence</h1>
          <p className="text-sm text-gray-600">
            The University&rsquo;s own official letters, and the register of what was sent.
          </p>
        </div>
        {mayCompose && (
          <button
            type="button"
            className={`${BTN_PRIMARY} ${FOCUS}`}
            onClick={() => { setComposing(true); setDraft(EMPTY); setEditingId(null); }}
          >
            <Plus className="h-4 w-4" aria-hidden /> New Official Letter
          </button>
        )}
      </header>

      {message && (
        <div
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.kind === 'ok'
              ? 'border-green-200 bg-green-50 text-green-900'
              : 'border-amber-300 bg-amber-50 text-amber-900'}`}
        >
          {message.text}
        </div>
      )}

      {/* ------------------------------------------------------------------
          THE COMPOSER
          ------------------------------------------------------------------ */}
      {composing && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="c-kind">Letter type</label>
              <select
                id="c-kind"
                className={INPUT}
                value={String(draft.kind ?? '')}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as LetterKind })}
              >
                {LETTER_KINDS.map((k) => (
                  <option key={k} value={k}>{KIND_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="c-office">Originating office</label>
              <select
                id="c-office"
                className={INPUT}
                value={String(draft.originating_office ?? '')}
                onChange={(e) =>
                  setDraft({ ...draft, originating_office: e.target.value as Office })}
              >
                {OFFICES.map((o) => (
                  <option key={o} value={o}>{OFFICE_LABELS[o]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="c-to">Addressed to</label>
              <input
                id="c-to" className={INPUT} value={String(draft.recipient_name ?? '')}
                onChange={(e) => setDraft({ ...draft, recipient_name: e.target.value })}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="c-org">Organisation</label>
              <input
                id="c-org" className={INPUT} value={String(draft.recipient_org ?? '')}
                onChange={(e) => setDraft({ ...draft, recipient_org: e.target.value })}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="c-addr">Postal address</label>
              <input
                id="c-addr" className={INPUT} value={String(draft.recipient_address ?? '')}
                onChange={(e) => setDraft({ ...draft, recipient_address: e.target.value })}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="c-email">Email address</label>
              <input
                id="c-email" type="email" className={INPUT}
                value={String(draft.recipient_email ?? '')}
                onChange={(e) => setDraft({ ...draft, recipient_email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="c-subject">Subject</label>
            <input
              id="c-subject" className={INPUT} value={String(draft.subject ?? '')}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="c-body">The letter</label>
            <textarea
              id="c-body" className={`${INPUT} min-h-[240px] font-serif`}
              value={String(draft.body ?? '')}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-500">
              The letterhead, reference number, date, signature block and verification code are
              added by the system. Write only the letter.
            </p>
          </div>

          {/* THE OBJECTIONS, SEPARATED INTO THE ONES THAT STOP IT AND THE ONES
              THAT ARE ADVICE. A screen that shows both as errors teaches the
              author to read neither. */}
          {objections.length > 0 && (
            <ul className="space-y-1 text-sm">
              {objections.map((o) => (
                <li
                  key={o.code}
                  className={`flex gap-2 rounded-md px-2 py-1.5 ${
                    o.blocking ? 'bg-red-50 text-red-900' : 'bg-gray-50 text-gray-700'}`}
                >
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      o.blocking ? 'text-red-600' : 'text-gray-400'}`}
                    aria-hidden
                  />
                  <span>{o.message}</span>
                </li>
              ))}
            </ul>
          )}

          {/* ----------------------------------------------------------------
              THE FOUR PATHS
              ---------------------------------------------------------------- */}
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <button
              type="button" className={`${BTN_SECONDARY} ${FOCUS}`}
              onClick={() => setPreviewing((v) => !v)}
            >
              <Eye className="h-4 w-4" aria-hidden /> {previewing ? 'Hide preview' : 'Preview'}
            </button>
            <button
              type="button" className={`${BTN_SECONDARY} ${FOCUS}`}
              disabled={busy !== null}
              onClick={() => void save()}
            >
              {busy === 'save'
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                : <Save className="h-4 w-4" aria-hidden />} Save draft
            </button>
            {mayCompose && editingId && (
              <button
                type="button" className={`${BTN_SECONDARY} ${FOCUS}`}
                disabled={busy !== null}
                onClick={() => {
                  const to = window.prompt('Who is to prepare it? (their account id)');
                  if (!to) return;
                  const brief = window.prompt('What is the letter to say?');
                  if (!brief) return;
                  void post({ action: 'delegate', id: editingId, preparedBy: to, brief },
                    'delegate');
                }}
              >
                <UserPlus className="h-4 w-4" aria-hidden /> Delegate preparation
              </button>
            )}
            {mayAuthorize && (
              <button
                type="button" className={`${BTN_SECONDARY} ${FOCUS}`}
                disabled={busy !== null || !ready}
                onClick={async () => {
                  const id = editingId ?? await save();
                  if (!id) return;
                  const at = window.prompt('When should it go? (e.g. 2026-10-01T09:00)');
                  if (!at) return;
                  await post({ action: 'schedule', id, at }, 'schedule');
                }}
              >
                <Clock className="h-4 w-4" aria-hidden /> Schedule
              </button>
            )}
            {mayAuthorize && mayIssue && (
              <button
                type="button" className={`${BTN_PRIMARY} ${FOCUS}`}
                disabled={busy !== null || !ready}
                onClick={() => void issueDirectly()}
              >
                {busy === 'issue'
                  ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  : <Send className="h-4 w-4" aria-hidden />} Authorise and issue
              </button>
            )}
            <button
              type="button" className={`${BTN_SECONDARY} ${FOCUS}`}
              onClick={() => { setComposing(false); setDraft(EMPTY); setEditingId(null); }}
            >
              Cancel
            </button>
          </div>

          {/* THE PREVIEW IS THE LETTER'S OWN SHAPE, not a styled copy of the
              form. What it cannot show is the reference and the verification
              code, because neither exists until the letter is issued — and
              inventing a specimen reference here would put a number on a screen
              that never appears on the document. */}
          {previewing && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 font-serif text-sm">
              <p className="text-xs uppercase tracking-wide text-purple-800">
                {OFFICE_LABELS[draft.originating_office as Office]}
              </p>
              <p className="mt-4 font-semibold">
                {KIND_LABELS[draft.kind as LetterKind]}
              </p>
              <p className="mt-3">{draft.recipient_name || '—'}</p>
              {draft.recipient_org && <p>{draft.recipient_org}</p>}
              {draft.recipient_address && <p>{draft.recipient_address}</p>}
              <p className="mt-3">Dear {draft.recipient_name || '—'},</p>
              <p className="mt-2 font-semibold">{draft.subject || '—'}</p>
              <p className="mt-2 whitespace-pre-wrap">{draft.body}</p>
              <p className="mt-6 text-xs text-gray-500">
                Reference, date, signature block and verification code are added on issue.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------
          THE BOARD
          ------------------------------------------------------------------ */}
      <nav className="flex flex-wrap gap-2" aria-label="Correspondence">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-current={tab === t ? 'page' : undefined}
            className={`rounded-full px-3 py-1.5 text-sm ${FOCUS} ${
              tab === t ? 'bg-purple-900 text-white' : 'bg-gray-100 text-gray-700'}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]} <span className="opacity-70">{counters[t]}</span>
          </button>
        ))}
      </nav>

      {rows === null ? (
        <p className="text-sm text-gray-500">Reading the register&hellip;</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing under {TAB_LABELS[tab]}.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {shown.map((r) => {
            const offered = actionsFor(r, user?.id ?? '', {
              compose: mayCompose, authorize: mayAuthorize, issue: mayIssue,
            });
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-[14rem] flex-1">
                  <p className="font-medium text-gray-900">{r.subject}</p>
                  <p className="text-xs text-gray-500">
                    {KIND_LABELS[r.kind as LetterKind]} · to {r.recipient_name}
                    {r.recipient_org ? ` (${r.recipient_org})` : ''} ·{' '}
                    {STATE_LABELS[r.status as keyof typeof STATE_LABELS] ?? r.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {offered.includes('edit') && (
                    <button
                      type="button" className={`${BTN_SECONDARY} ${FOCUS}`}
                      onClick={() => {
                        setDraft(r); setEditingId(r.id); setComposing(true);
                      }}
                    >
                      Open
                    </button>
                  )}
                  {offered.includes('handback') && (
                    <button
                      type="button" className={`${BTN_PRIMARY} ${FOCUS}`}
                      disabled={busy !== null}
                      onClick={() => void post({ action: 'handback', id: r.id }, 'handback')}
                    >
                      Hand back
                    </button>
                  )}
                  {offered.includes('authorize') && (
                    <button
                      type="button" className={`${BTN_SECONDARY} ${FOCUS}`}
                      disabled={busy !== null}
                      onClick={() => void post({ action: 'authorize', id: r.id }, 'authorize')}
                    >
                      Authorise
                    </button>
                  )}
                  {offered.includes('issue') && (
                    <button
                      type="button" className={`${BTN_PRIMARY} ${FOCUS}`}
                      disabled={busy !== null}
                      onClick={() => void post({ action: 'issue', id: r.id }, 'issue')}
                    >
                      Issue
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
