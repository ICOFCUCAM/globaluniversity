'use client';

// ---------------------------------------------------------------------------
// ADMINISTRATION → DOCUMENT TEMPLATES.
//
// ---------------------------------------------------------------------------
// THE COLUMN THIS SCREEN EXISTS FOR IS THE EMPTY ONE
// ---------------------------------------------------------------------------
//
// A registry that lists the templates the University has is half a registry.
// The useful half is the document kinds it has NO approved wording for — every
// one of those is a document somebody can be asked to produce, with nothing
// behind it, and the alternative to showing them here is discovering them at
// the moment the document is needed.
//
// So the uncovered kinds are at the top, in amber, with a count. On a fresh
// database that list is nearly all thirty-one, and it should be.
//
// ---------------------------------------------------------------------------
// AND WHY "DELETE" IS NOT OFFERED
// ---------------------------------------------------------------------------
//
// A template that has produced documents is the provenance of every one of
// them. 044 and 051 refuse the delete in the database with `on delete
// restrict`; this screen does not offer a button that the database would
// refuse, and says why in the row rather than in an error afterwards.
//
// Retiring is offered instead: a retired template produces nothing new and
// still accounts for what it produced.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL, FOCUS } from '@/lib/portalTheme';
import { AlertTriangle, Check, FileText, Loader2, Plus } from 'lucide-react';
import {
  TEMPLATE_GROUPS, TEMPLATE_KIND_LABELS, canActivate, canEdit, uncovered, coverageOf,
  whyNotDeletable, MIN_TEMPLATE_NAME, MIN_TEMPLATE_BODY,
  type Coverage, type DocumentTemplate,
} from '@/lib/documentTemplates';

// A SINGLE STRING LITERAL. Concatenation makes supabase-js collapse the
// inferred row type to GenericStringError[], silently.
// eslint-disable-next-line max-len
const COVERAGE = 'kind, active_template_id, name, version, effective_from, activated_at, versions, appointment_letters_issued, correspondence_issued';
// eslint-disable-next-line max-len
const TEMPLATES = 'id, kind, version, name, body, status, effective_from, created_by, activated_by, activated_at, retired_at';

export default function DocumentTemplates() {
  const { user } = useAuth();
  // THE SAME CAPABILITY THAT APPROVES A CREDENTIAL DESIGN. A template decides
  // what every future document of its kind says, which is the same order of
  // act as approving the design of a degree certificate.
  const mayManage = can(user?.role, 'approve-credential-design');

  const [coverage, setCoverage] = useState<Coverage[] | null>(null);
  const [rows, setRows] = useState<DocumentTemplate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [composing, setComposing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', body: '', effectiveFrom: '' });

  const load = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([
        supabase.from('document_template_coverage').select(COVERAGE).order('kind'),
        supabase.from('document_templates').select(TEMPLATES).order('kind').order('version',
          { ascending: false }),
      ]);
      if (c.error) throw new Error(c.error.message);
      setCoverage((c.data ?? []) as Coverage[]);
      setRows((t.data ?? []) as DocumentTemplate[]);
    } catch (e) {
      // SAID, NOT SWALLOWED. An unreachable database and a University with no
      // templates look identical on this screen, and only one of them is a
      // reason to start writing wording.
      setNote({ kind: 'bad', text: `The registry could not be read: ${String(e)}` });
      setCoverage([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const byKind = useMemo(() => {
    const m = new Map<string, Coverage>();
    for (const c of coverage ?? []) m.set(String(c.kind), c);
    return m;
  }, [coverage]);

  const versionsOf = useCallback(
    (kind: string) => rows.filter((r) => r.kind === kind), [rows]);

  const missing = useMemo(() => uncovered(coverage ?? []), [coverage]);
  const counts = useMemo(() => coverageOf(coverage ?? []), [coverage]);

  const act = async (payload: Record<string, unknown>, label: string) => {
    setBusy(label);
    setNote(null);
    try {
      const r = await fetch('/api/admin/document-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) {
        setNote({ kind: 'bad', text: j.detail ?? j.error ?? 'That was refused.' });
        return false;
      }
      setNote({ kind: 'ok', text: j.detail ?? 'Done.' });
      await load();
      return true;
    } catch (e) {
      setNote({ kind: 'bad', text: String(e) });
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!mayManage) {
    return (
      <div className="p-6 text-sm text-gray-600">
        Document templates decide the wording of every document the University issues. Your role
        does not approve them.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Document Templates</h1>
        <p className="text-sm text-gray-600">
          The wording of every document the University issues, versioned. A version that has
          produced a document is never deleted — somebody is holding it.
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

      {/* ------------------------------------------------------------------
          WHAT HAS NO APPROVED WORDING. The half of the registry that matters.
          ------------------------------------------------------------------ */}
      {coverage !== null && missing.length > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {missing.length} of {counts.total} document types have no active template
          </p>
          <p className="mt-1 text-sm text-amber-900">
            Each is a document the University can be asked to produce with no approved wording
            behind it. Writing one is the work; this list is what is outstanding.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((k) => (
              <li
                key={k}
                className="rounded-full bg-white/70 px-2.5 py-1 text-xs text-amber-900"
              >
                {TEMPLATE_KIND_LABELS[k] ?? k}
              </li>
            ))}
          </ul>
        </section>
      )}

      {coverage === null ? (
        <p className="text-sm text-gray-500">Reading the registry&hellip;</p>
      ) : TEMPLATE_GROUPS.map((group) => (
        <section key={group.label} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {group.label}
          </h2>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {group.kinds.map((kind) => {
              const c = byKind.get(kind);
              const versions = versionsOf(kind);
              const active = versions.find((v) => v.status === 'active');
              const undeletable = c ? whyNotDeletable(c) : null;
              return (
                <li key={kind} className="p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <FileText
                      className={`h-4 w-4 shrink-0 ${
                        active ? 'text-green-600' : 'text-gray-300'}`}
                      aria-hidden
                    />
                    <div className="min-w-[14rem] flex-1">
                      <p className="font-medium text-gray-900">
                        {TEMPLATE_KIND_LABELS[kind] ?? kind}
                      </p>
                      <p className="text-xs text-gray-500">
                        {active
                          ? <>
                            {active.name} · version {active.version} ·{' '}
                            <span className="font-semibold text-green-700">ACTIVE</span>
                            {active.effective_from ? ` · from ${active.effective_from}` : ''}
                          </>
                          : <span className="text-amber-700">No active template</span>}
                        {versions.length > 1 ? ` · ${versions.length} versions` : ''}
                      </p>
                      {/* WHY IT CANNOT BE DELETED, said in the row rather than
                          as an error after the button is pressed. */}
                      {undeletable && (
                        <p className="mt-1 text-xs text-gray-500">{undeletable}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`${BTN_SECONDARY} ${FOCUS}`}
                      onClick={() => {
                        setComposing(composing === kind ? null : kind);
                        setDraft({ name: active?.name ?? '', body: '', effectiveFrom: '' });
                      }}
                    >
                      <Plus className="h-4 w-4" aria-hidden />{' '}
                      {active ? 'New version' : 'Write one'}
                    </button>
                  </div>

                  {/* The drafts waiting for somebody else to activate them. */}
                  {versions.filter((v) => v.status === 'draft').map((v) => (
                    <div
                      key={v.id}
                      className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm"
                    >
                      <span className="flex-1">
                        {v.name} · version {v.version} ·{' '}
                        <span className="text-gray-500">draft</span>
                      </span>
                      {/* NOBODY ACTIVATES WHAT THEY WROTE. The button is absent
                          for the author rather than present and refusing. */}
                      {canActivate(v, user?.id ?? '') ? (
                        <button
                          type="button"
                          className={`${BTN_PRIMARY} ${FOCUS}`}
                          disabled={busy !== null}
                          onClick={() => void act({
                            action: 'activate',
                            id: v.id,
                            effectiveFrom: v.effective_from
                              ?? new Date().toISOString().slice(0, 10),
                          }, 'activate')}
                        >
                          {busy === 'activate'
                            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            : <Check className="h-4 w-4" aria-hidden />} Activate
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {v.created_by === user?.id
                            ? 'You wrote this. Somebody else must activate it.'
                            : canEdit(v) ? '' : 'Not activatable.'}
                        </span>
                      )}
                    </div>
                  ))}

                  {composing === kind && (
                    <form
                      className="mt-3 space-y-3 rounded-lg border border-gray-200 p-3"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const ok = await act({
                          action: 'draft',
                          kind,
                          name: draft.name,
                          body: draft.body,
                          effectiveFrom: draft.effectiveFrom || null,
                        }, 'draft');
                        if (ok) setComposing(null);
                      }}
                    >
                      <div>
                        <label className={LABEL} htmlFor={`n-${kind}`}>Name</label>
                        <input
                          id={`n-${kind}`} className={INPUT} value={draft.name}
                          minLength={MIN_TEMPLATE_NAME}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={LABEL} htmlFor={`b-${kind}`}>The wording</label>
                        <textarea
                          id={`b-${kind}`} className={`${INPUT} min-h-[160px] font-serif`}
                          value={draft.body} minLength={MIN_TEMPLATE_BODY}
                          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={LABEL} htmlFor={`d-${kind}`}>
                          In force from
                        </label>
                        <input
                          id={`d-${kind}`} type="date" className={INPUT}
                          value={draft.effectiveFrom}
                          onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className={`${BTN_PRIMARY} ${FOCUS}`}
                          disabled={busy !== null}>
                          Save as draft
                        </button>
                        <button type="button" className={`${BTN_SECONDARY} ${FOCUS}`}
                          onClick={() => setComposing(null)}>
                          Cancel
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        It is saved as a draft. Somebody other than you activates it — a template
                        decides what every future document of this kind says.
                      </p>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
