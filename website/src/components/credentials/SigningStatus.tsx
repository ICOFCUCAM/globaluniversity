'use client';

// ---------------------------------------------------------------------------
// WHETHER THE UNIVERSITY IS SIGNING, AND SIGNING THE BACK CATALOGUE.
//
// ---------------------------------------------------------------------------
// WHY THIS PANEL EXISTS AT ALL
// ---------------------------------------------------------------------------
//
// Signing is optional and fails silently by design: with no key, credentials
// are issued and sealed exactly as before and simply carry no signature. That
// is the right behaviour — refusing to issue because an optional improvement is
// unconfigured would turn a nicety into an outage — but it has an obvious
// failure mode. An operator who sets the key wrongly, or believes they set it
// and did not, gets a registry that looks completely normal and signs nothing.
//
// So the state is shown, plainly, where the register is managed: whether a key
// is held, which key, and how many credentials still carry no signature.
// ---------------------------------------------------------------------------

import React from 'react';
import { KeyRound, Loader2, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { can } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import { FOCUS, CARD, BTN_SECONDARY } from '@/lib/portalTheme';

interface KeyInfo {
  configured: boolean;
  keyId?: string;
  algorithm?: string;
  note?: string;
  limitations?: string;
}

export default function SigningStatus({ role }: { role?: UserRole }) {
  const [key, setKey] = React.useState<KeyInfo | null>(null);
  const [unsigned, setUnsigned] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  // Hiding it is courtesy; the route checks the capability again.
  const mayBackfill = can(role, 'design-credentials');

  const load = React.useCallback(async () => {
    const info = await fetch('/api/credential/key').then((r) => r.json()).catch(() => null);
    setKey(info ?? { configured: false, note: 'The key endpoint could not be reached.' });

    // HOW MANY ARE UNSIGNED, counted rather than assumed. `head: true` asks for
    // the count without transferring a row.
    const { count, error } = await supabase
      .from('credentials_issued')
      .select('id', { count: 'exact', head: true })
      .is('signature', null);
    setUnsigned(error ? null : (count ?? 0));
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function backfill(dryRun: boolean) {
    setBusy(true);
    setNote(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch('/api/credential/backfill-signatures', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ dryRun }),
      }).then((r) => r.json()).catch(() => null);

      if (!res?.ok) {
        setNote({ tone: 'bad', text: res?.detail ?? res?.error ?? 'It did not run.' });
        return;
      }
      setNote({ tone: 'ok', text: res.message });
      if (!dryRun) await load();
    } finally {
      setBusy(false);
    }
  }

  if (!key) {
    return (
      <div className={`${CARD} p-5`}>
        <p className="flex items-center gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <Loader2 size={14} className="animate-spin" /> Reading the signing state…
        </p>
      </div>
    );
  }

  return (
    <div className={`${CARD} p-5`}>
      <h3 className="flex items-center gap-2 font-heading text-base font-bold text-[#422e59] dark:text-[#e4dcf0]">
        <KeyRound size={17} /> Document signing
      </h3>

      {key.configured ? (
        <>
          <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
            The University holds an {key.algorithm} key. Key id{' '}
            <span className="font-mono">{key.keyId}</span>. Anyone can verify a signed credential
            offline against the{' '}
            <a
              href="/api/credential/key"
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-0.5 underline ${FOCUS}`}
            >
              published public key <ExternalLink size={11} />
            </a>.
          </p>
          {/* SAID HERE TOO, because this panel is where somebody forms their
              belief about what the signature means. */}
          {key.limitations && (
            <p className="mt-2 text-[11px] leading-relaxed text-[#8a8194]">{key.limitations}</p>
          )}
        </>
      ) : (
        <p className="mt-1 flex items-start gap-2 rounded-lg border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-3 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#a07c12]" />
          <span>
            <strong>Nothing is being signed.</strong> {key.note} Credentials are still sealed and
            verify normally through /verify — the seal is the University&rsquo;s primary record —
            but no one can check them without asking this website.
          </span>
        </p>
      )}

      <p className="mt-3 text-xs text-[#6b6076] dark:text-[#9c93ad]">
        {unsigned === null
          ? 'How many credentials carry no signature could not be read.'
          : unsigned === 0
            ? 'Every credential on the register carries a signature.'
            : `${unsigned} credential${unsigned === 1 ? '' : 's'} on the register carry no signature.`}
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

      {mayBackfill && key.configured && (unsigned ?? 0) > 0 && (
        <div className="mt-4">
          <p className="max-w-2xl text-[11px] leading-relaxed text-[#8a8194]">
            Signing the back catalogue adds a signature over each credential&rsquo;s existing
            content hash. <strong>Nothing else changes</strong> — not the hash, not the seal, not a
            single fact — so every document already in a graduate&rsquo;s hand verifies exactly as
            it did. Each one is recorded on the audit trail.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => void backfill(true)}
              disabled={busy}
              className={`${BTN_SECONDARY} text-xs`}
            >
              {busy ? 'Working…' : 'Show me what it would do'}
            </button>
            <button
              onClick={() => void backfill(false)}
              disabled={busy}
              className={`inline-flex items-center gap-2 rounded-xl bg-[#422e59] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 ${FOCUS}`}
            >
              {busy ? <><Loader2 size={13} className="animate-spin" /> Signing…</> : 'Sign them'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
