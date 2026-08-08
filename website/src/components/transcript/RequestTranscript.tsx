'use client';

// ---------------------------------------------------------------------------
// A STUDENT ASKING FOR THEIR OWN TRANSCRIPT.
//
// ---------------------------------------------------------------------------
// WHY THE REQUEST IS NOT THE ISSUE
// ---------------------------------------------------------------------------
//
// The obvious build is a button that mints a transcript on the spot. It is
// wrong, and migration 019 keeps the two apart deliberately.
//
// Issuing a transcript seals a permanent University document and puts it on the
// credential register, where it stays for ever. If a student could do that
// themselves, every misclick would be an irreversible entry, and the register —
// the thing the whole verification system rests on — would fill with documents
// nobody meant to create.
//
// So a student ASKS, and the registry ISSUES. The asking is recorded, can be
// refused with a stated reason, and can sit behind an unpaid fee, without any
// of that touching the sealed record.
//
// ---------------------------------------------------------------------------
// WHAT IT WILL NOT OFFER
// ---------------------------------------------------------------------------
//
// The internal academic record, which carries standing history and registry
// notes that are not part of any document issued to a holder. It is not in
// STUDENT_REQUESTABLE, so it cannot be asked for here — and the route checks
// again rather than trusting this screen.
// ---------------------------------------------------------------------------

import React from 'react';
import { FileText, Loader2, Check, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { STUDENT_REQUESTABLE, TRANSCRIPT_PROFILES, type TranscriptKind } from '@/lib/transcriptTypes';
import { INPUT, LABEL, FOCUS, CARD } from '@/lib/portalTheme';

type Delivery = 'pdf' | 'print' | 'both';

interface Existing {
  id: string;
  kind: string;
  delivery: string;
  status: string;
  requested_at: string;
  note: string | null;
  credential_ref: string | null;
}

const DELIVERY_LABEL: Record<Delivery, string> = {
  pdf: 'A digital PDF, emailed to me',
  print: 'A printed copy, collected or posted',
  both: 'Both',
};

export default function RequestTranscript({ studentId }: { studentId?: string | null }) {
  const [kind, setKind] = React.useState<TranscriptKind>('official');
  const [delivery, setDelivery] = React.useState<Delivery>('pdf');
  const [busy, setBusy] = React.useState(false);
  const [mine, setMine] = React.useState<Existing[] | null>(null);
  const [note, setNote] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const load = React.useCallback(async () => {
    if (!studentId) { setMine([]); return; }
    const { data, error } = await supabase
      .from('transcript_requests')
      .select('id, kind, delivery, status, requested_at, note, credential_ref')
      .eq('student_id', studentId)
      .order('requested_at', { ascending: false })
      .limit(10);
    if (error) {
      // THE ERROR IS SHOWN, not swallowed into an empty list. "You have made no
      // requests" and "your requests could not be read" look identical to a
      // student and mean opposite things.
      setMine([]);
      setNote({ tone: 'bad', text: `Your requests could not be read: ${error.message}` });
      return;
    }
    setMine((data ?? []) as Existing[]);
  }, [studentId]);

  React.useEffect(() => { void load(); }, [load]);

  /** Is there already one outstanding of this kind? */
  const pending = (mine ?? []).find(
    (r) => r.kind === kind && (r.status === 'requested' || r.status === 'in-progress'),
  );

  async function submit() {
    if (!studentId || pending) return;
    setBusy(true);
    setNote(null);
    try {
      const { error } = await supabase.from('transcript_requests').insert({
        student_id: studentId,
        kind,
        delivery,
      });
      if (error) {
        setNote({ tone: 'bad', text: `The request could not be recorded: ${error.message}` });
        return;
      }
      setNote({
        tone: 'ok',
        text: 'Your request is with the Registrar. You will be told when it is issued, and it '
          + 'will appear in your documents.',
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!studentId) {
    return (
      <div className={`${CARD} p-5`}>
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
          Your student record could not be identified, so a transcript cannot be requested here.
          The Registrar can issue one directly.
        </p>
      </div>
    );
  }

  const profile = TRANSCRIPT_PROFILES[kind];

  return (
    <div className={`${CARD} p-5`}>
      <h3 className="flex items-center gap-2 font-heading text-base font-bold text-[#422e59] dark:text-[#e4dcf0]">
        <FileText size={17} /> Request an official transcript
      </h3>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
        The Registrar issues it from your approved results. Requesting does not itself produce a
        document — a transcript is a sealed University record, and only the registry may create
        one.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Which document</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as TranscriptKind)}
            className={`${INPUT} mt-1`}
          >
            {STUDENT_REQUESTABLE.map((k) => (
              <option key={k} value={k}>{TRANSCRIPT_PROFILES[k].label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={LABEL}>How you would like it</span>
          <select
            value={delivery}
            onChange={(e) => setDelivery(e.target.value as Delivery)}
            className={`${INPUT} mt-1`}
          >
            {(Object.keys(DELIVERY_LABEL) as Delivery[]).map((d) => (
              <option key={d} value={d}>{DELIVERY_LABEL[d]}</option>
            ))}
          </select>
        </label>
      </div>

      {/* WHAT THEY ARE ASKING FOR, IN THE DOCUMENT'S OWN WORDS. A student
          choosing "unofficial" because it sounds quicker should read, before
          they ask, that it cannot be verified and no employer will take it. */}
      <p className={`mt-3 rounded-lg p-3 text-[11px] leading-relaxed ${
        profile.sealed
          ? 'bg-[#f2eee6] text-[#6b6076] dark:bg-[#2a2333] dark:text-[#9c93ad]'
          : 'border border-[#e9c14a]/40 bg-[#e9c14a]/10 text-[#6b6076] dark:text-[#9c93ad]'
      }`}>
        {profile.statement}
      </p>

      {note && (
        <p role="status" className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-xs ${
          note.tone === 'ok'
            ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
            : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
        }`}>
          {note.tone === 'ok' ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
          {note.text}
        </p>
      )}

      <div className="mt-4">
        <button
          onClick={() => void submit()}
          disabled={busy || Boolean(pending)}
          className={`inline-flex items-center gap-2 rounded-xl bg-[#422e59] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#322244] disabled:opacity-40 ${FOCUS}`}
        >
          {busy ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><FileText size={15} /> Request it</>}
        </button>
        {/* A DEAD BUTTON WITH NO EXPLANATION IS THE FAULT THIS PROJECT KEEPS
            FINDING. A second request for a document already in the queue would
            put the registry to the same work twice. */}
        {pending && (
          <p className="mt-2 text-[11px] text-[#8a8194]">
            You already have a {TRANSCRIPT_PROFILES[kind].label.toLowerCase()} outstanding,
            requested on {String(pending.requested_at).slice(0, 10)}. Choose a different document,
            or wait for that one.
          </p>
        )}
      </div>

      {/* --- What has been asked for before ----------------------------- */}
      {(mine?.length ?? 0) > 0 && (
        <div className="mt-5">
          <p className={LABEL}>Your requests</p>
          <ul className="mt-2 space-y-1.5">
            {mine!.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                <Clock size={12} className="shrink-0" />
                <span>{String(r.requested_at).slice(0, 10)}</span>
                <span>·</span>
                <span>{TRANSCRIPT_PROFILES[r.kind as TranscriptKind]?.label ?? r.kind}</span>
                <span>·</span>
                <span className={
                  r.status === 'issued' ? 'font-semibold text-emerald-800 dark:text-emerald-300'
                    : r.status === 'refused' ? 'font-semibold text-red-800 dark:text-red-300'
                      : 'font-semibold'
                }>{r.status}</span>
                {r.credential_ref && <span className="font-mono">{r.credential_ref}</span>}
                {/* A REFUSAL SHOWS ITS REASON. The database requires one; a
                    screen that then hides it puts the student back to guessing. */}
                {r.status === 'refused' && r.note && <span className="italic">— {r.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
