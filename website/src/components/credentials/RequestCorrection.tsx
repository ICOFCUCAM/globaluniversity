'use client';

// ---------------------------------------------------------------------------
// ASKING THE UNIVERSITY TO CORRECT SOMETHING ON YOUR CREDENTIAL.
//
//   "Students may request corrections and provide supporting documentation,
//    but they must never directly modify an issued credential."
//
// THE HALF OF THE WORKFLOW THAT WAS MISSING. The Registry's queue, the state
// machine, the routes and the audit trail were all built; the student had no
// way to raise a request at all. A correction workflow that only staff can
// enter is a queue that stays empty while graduates telephone the office —
// which is the situation the workflow was meant to replace.
//
// ---------------------------------------------------------------------------
// WHY THIS FORM CANNOT CHANGE ANYTHING
// ---------------------------------------------------------------------------
//
// Everything the student types is a PROPOSAL. It is stored in `proposed`,
// shown to the reviewer beside what the register actually says, and never
// applied by anything. The Authority decides what is changed, and
// /api/credential/amend recomputes the difference from the register rather than
// trusting the student's column.
//
// So the wording is careful. The button says "Send request", not "Save"; the
// fields say "should read", not "name"; and the confirmation says the
// credential is unchanged and still valid, because a graduate who has just
// reported an error on their degree needs to be told that the degree is fine.
//
// ---------------------------------------------------------------------------
// SUPPORTING DOCUMENTATION
// ---------------------------------------------------------------------------
//
// Recorded as references rather than uploaded here. The Registry has to sight
// an original — a birth certificate, a deed poll, a marriage certificate — and
// a scan attached to a web form is not that. What this captures is WHAT the
// student is offering, so the office knows what to ask for when they reply.
// Uploading files into the credential record would suggest the evidence had
// been accepted when it has only been mentioned.
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, FileWarning, CheckCircle2, XCircle } from 'lucide-react';

/** What a student may ask to have corrected. Matches CORRECTABLE in the amend route. */
const FIELDS = [
  { key: 'holder_name', label: 'My name should read' },
  { key: 'programme', label: 'The programme should read' },
  { key: 'award', label: 'The award should read' },
  { key: 'classification', label: 'The classification should read' },
] as const;

export default function RequestCorrection({
  credentialId, reference, onDone,
}: {
  credentialId: string;
  reference: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [proposed, setProposed] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const filled = Object.values(proposed).filter((v) => v.trim()).length;

  async function submit() {
    setBusy(true);
    setResult(null);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/credential/correction', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        credentialId,
        description: [description.trim(), evidence.trim() && `Evidence offered: ${evidence.trim()}`]
          .filter(Boolean).join('\n\n'),
        proposed: Object.fromEntries(
          Object.entries(proposed).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]),
        ),
      }),
    });
    const out = await res.json().catch(() => ({ ok: false, error: 'no-reply' }));
    setBusy(false);

    if (!out.ok) {
      setResult({ ok: false, text: out.detail ?? out.error ?? 'The request could not be sent.' });
      return;
    }
    setResult({ ok: true, text: out.message });
    setOpen(false);
    setDescription(''); setProposed({}); setEvidence('');
    onDone?.();
  }

  if (result) {
    return (
      <div
        role="status"
        className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm ${
          result.ok
            ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
            : 'border border-red-600/30 bg-red-600/10 text-red-900 dark:text-red-200'
        }`}
      >
        {result.ok ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
          : <XCircle size={16} className="mt-0.5 flex-shrink-0" />}
        <span>
          {result.text}
          {result.ok && (
            <button
              type="button"
              onClick={() => setResult(null)}
              className="ml-2 underline"
            >
              Close
            </button>
          )}
        </span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#6b6076] underline underline-offset-2 dark:text-[#9c93ad]"
      >
        <FileWarning size={12} /> Something on this is wrong
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[#ece7de] bg-[#fbfaf7] p-4 dark:border-[#2e2637] dark:bg-[#17131d]">
      <div>
        <p className="text-sm font-semibold text-[#241a30] dark:text-[#f3efe7]">
          Ask the Registry to correct {reference}
        </p>
        <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          Nothing you type here changes your credential. It goes to the Registry, who check it
          against your student record and decide. Your credential stays valid throughout.
        </p>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-[#241a30] dark:text-[#f3efe7]">
          What is wrong with it?
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="e.g. My surname is spelled Nkenge on the certificate. It is Nkeng on my birth certificate and on my passport."
          className="mt-1 w-full rounded-lg border border-[#ece7de] bg-white p-2 text-sm dark:border-[#2e2637] dark:bg-[#1b1723] dark:text-[#f3efe7]"
        />
      </label>

      <fieldset>
        <legend className="text-xs font-medium text-[#241a30] dark:text-[#f3efe7]">
          What should it say? Fill in only what is wrong.
        </legend>
        <div className="mt-1.5 space-y-1.5">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex items-center gap-2">
              <span className="w-44 flex-shrink-0 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                {f.label}
              </span>
              <input
                value={proposed[f.key] ?? ''}
                onChange={(e) => setProposed((s) => ({ ...s, [f.key]: e.target.value }))}
                className="min-w-0 flex-1 rounded-lg border border-[#ece7de] bg-white p-1.5 text-sm dark:border-[#2e2637] dark:bg-[#1b1723] dark:text-[#f3efe7]"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-xs font-medium text-[#241a30] dark:text-[#f3efe7]">
          What can you show them?
        </span>
        <input
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="e.g. Birth certificate and passport"
          className="mt-1 w-full rounded-lg border border-[#ece7de] bg-white p-2 text-sm dark:border-[#2e2637] dark:bg-[#1b1723] dark:text-[#f3efe7]"
        />
        <span className="mt-1 block text-xs text-[#9c93ad]">
          Name the documents rather than attaching them. The Registry will tell you how to present
          the originals — a scan cannot be sighted.
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !description.trim() || filled === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[#241a30] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-[#e9c14a] dark:text-[#241a30]"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Send request
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-[#ece7de] px-4 py-2 text-sm text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]"
        >
          Cancel
        </button>
      </div>
      {description.trim() && filled === 0 && (
        <p className="text-xs text-[#a07c12]">
          Say what it should say as well as what is wrong — the Registry cannot act on a
          description alone.
        </p>
      )}
    </div>
  );
}
