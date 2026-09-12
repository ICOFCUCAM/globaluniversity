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
//
// ---------------------------------------------------------------------------
// AND WHICH ONES, NOT ONLY HOW MANY
// ---------------------------------------------------------------------------
//
// The panel used to print a number and stop. "2 credentials on the register
// carry no signature" is unanswerable from the screen it appears on: the
// register beside it lists awards, one entry per credential number, and a
// corrected credential is two rows there and one entry — so the number and the
// list disagree and neither explains the other. Somebody looking at that has to
// decide whether to sign the back catalogue without being able to see what the
// back catalogue is.
//
// The rows are therefore listed, each with the version that makes the
// arithmetic add up. A superseded version counts separately because it was
// separately issued and somebody may still be holding it.
// ---------------------------------------------------------------------------

import React from 'react';
import { KeyRound, Loader2, Check, AlertTriangle, ExternalLink, Copy, Sparkles } from 'lucide-react';
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
  /** 'environment' | 'store' — where the active key is held. */
  keptIn?: string | null;
  retiredKeys?: { keyId: string }[];
}

/** One unsigned document — a version of a credential, not an award. */
interface UnsignedRow {
  id: string;
  credentialRef: string;
  version: number;
  kind: string;
  holderName: string;
  award: string | null;
  status: string;
  issuedAt: string | null;
}

/**
 * How many are listed before the list gives up and says how many more.
 *
 * A university that switches signing on after ten years has a register in the
 * thousands, and printing it into a status panel would bury the two sentences
 * above it.
 */
const SHOW_AT_MOST = 25;

function issuedOn(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SigningStatus({ role }: { role?: UserRole }) {
  const [key, setKey] = React.useState<KeyInfo | null>(null);
  const [unsigned, setUnsigned] = React.useState<number | null>(null);
  const [unsignedRows, setUnsignedRows] = React.useState<UnsignedRow[]>([]);
  const [unsignedError, setUnsignedError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  // SHOWN ONCE AND NEVER STORED. Held in this component's state only, so it is
  // gone the moment the screen is left.
  const [minted, setMinted] = React.useState<{
    keyId: string; privateKeyPem: string; warning: string; kept: boolean;
    keepError: string | null; rotationNote: string | null; environmentOverrides: string | null;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Hiding it is courtesy; the route checks the capability again.
  const mayBackfill = can(role, 'design-credentials');

  const load = React.useCallback(async () => {
    const info = await fetch('/api/credential/key').then((r) => r.json()).catch(() => null);
    setKey(info ?? { configured: false, note: 'The key endpoint could not be reached.' });

    // WHICH ONES ARE UNSIGNED, counted rather than assumed. `count: 'exact'`
    // returns the true total even though only a page of rows is fetched, so the
    // sentence stays right when the list is truncated.
    const { data, count, error } = await supabase
      .from('credentials_issued')
      .select('id, credential_id, version, kind, holder_name, award, status, issued_at',
        { count: 'exact' })
      .is('signature', null)
      // OLDEST FIRST, which is the order the backfill signs them in. A list in
      // one order beside a button that works in another is a small lie.
      .order('issued_at', { ascending: true })
      .limit(SHOW_AT_MOST);

    if (error) {
      setUnsigned(null);
      setUnsignedRows([]);
      // THE COMMONEST CAUSE BY FAR is a database that has not had 020 run on
      // it, where there is no signature column to be null. Saying "could not be
      // read" and leaving it there sends somebody hunting a permissions problem
      // that does not exist.
      setUnsignedError(
        /signature/i.test(error.message)
          ? 'The register has no signature column yet. Run '
            + 'docs/migrations/020_signature_void_and_grading.sql (or RUN-ALL.sql) and reload.'
          : error.message,
      );
      return;
    }

    setUnsignedError(null);
    setUnsigned(count ?? (data?.length ?? 0));
    setUnsignedRows((data ?? []).map((r: Record<string, any>) => ({
      id: String(r.id),
      credentialRef: r.credential_id,
      version: r.version ?? 1,
      kind: r.kind,
      holderName: r.holder_name,
      award: r.award ?? null,
      status: r.status,
      issuedAt: r.issued_at ?? null,
    })));
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function makeKey() {
    setBusy(true);
    setNote(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch('/api/credential/key/new', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.session?.access_token ?? ''}`,
        },
        // THE SYSTEM KEEPS IT. Nothing to paste, nothing to redeploy.
        body: JSON.stringify({ keep: true }),
      }).then((r) => r.json()).catch(() => null);
      if (!res?.ok) {
        setNote({ tone: 'bad', text: res?.detail ?? res?.error ?? 'A key could not be generated.' });
        return;
      }
      setMinted({
        keyId: res.keyId,
        privateKeyPem: res.privateKeyPem,
        warning: res.warning,
        kept: Boolean(res.kept),
        keepError: res.keepError ?? null,
        rotationNote: res.rotationNote ?? null,
        environmentOverrides: res.environmentOverrides ?? null,
      });
      if (res.kept) await load();
    } finally {
      setBusy(false);
    }
  }

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
            <span className="font-mono">{key.keyId}</span>
            {key.keptIn === 'store'
              ? ', kept by the system in its own sealed store'
              : key.keptIn === 'environment' ? ', from CREDENTIAL_SIGNING_KEY' : ''}
            {(key.retiredKeys?.length ?? 0) > 0
              && `. ${key.retiredKeys!.length} retired key${key.retiredKeys!.length === 1 ? '' : 's'} `
                + 'still published, so credentials signed before the rotation still verify'}. Anyone can verify a signed credential
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
        <>
          <p className="mt-1 flex items-start gap-2 rounded-lg border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-3 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#a07c12]" />
            <span>
              <strong>Nothing is being signed.</strong> {key.note} Credentials are still sealed and
              verify normally through /verify — the seal is the University&rsquo;s primary record —
              but no one can check them without asking this website.
            </span>
          </p>

          {mayBackfill && !minted && (
            <div className="mt-3">
              <button
                onClick={() => void makeKey()}
                disabled={busy}
                className={`inline-flex items-center gap-2 rounded-xl bg-[#422e59] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 ${FOCUS}`}
              >
                {busy
                  ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
                  : <><Sparkles size={13} /> Generate a signing key</>}
              </button>
              {/* THE BETTER OPTION IS NAMED, not hidden. A key made in a
                  terminal never touches a network; this one is generated on the
                  University's own server and shown over TLS to one signed-in
                  person. That is worse than a terminal and much better than an
                  online generator or a key emailed by somebody else. */}
              <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-[#8a8194]">
                Generated on the University&rsquo;s own server, shown once, and stored nowhere. If
                you have a terminal, <code>npm run make-signing-key</code> is better still — a key
                made there never crosses a network at all.
              </p>
            </div>
          )}
        </>
      )}

      {/* --- The key, shown once ---------------------------------------- */}
      {minted && (
        <div className="mt-4 rounded-xl border border-[#422e59]/30 bg-[#faf8f4] p-4 dark:border-[#c5a55a]/40 dark:bg-[#241d2e]">
          <p className="text-xs font-semibold text-[#33234a] dark:text-[#e4dcf0]">
            Your signing key · id <span className="font-mono">{minted.keyId}</span>
          </p>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#a07c12]">
            <strong>{minted.warning}</strong>
          </p>
          {minted.keepError && (
            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-red-800 dark:text-red-300">
              The system could not keep this key: {minted.keepError} Paste it into your host as
              CREDENTIAL_SIGNING_KEY instead, using the steps below.
            </p>
          )}
          {minted.rotationNote && (
            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
              {minted.rotationNote}
            </p>
          )}
          {minted.environmentOverrides && (
            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-[#a07c12]">
              {minted.environmentOverrides}
            </p>
          )}

          <textarea
            readOnly
            value={minted.privateKeyPem.trim()}
            rows={4}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-2 w-full rounded-lg border border-[#ded6c8] bg-white p-2 font-mono text-[10px] leading-snug dark:border-[#3d3349] dark:bg-[#1f1a27]"
          />

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => {
                void navigator.clipboard.writeText(minted.privateKeyPem.trim());
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
              className={`${BTN_SECONDARY} inline-flex items-center gap-1.5 text-xs`}
            >
              <Copy size={12} /> {copied ? 'Copied' : 'Copy the key'}
            </button>
            <button
              onClick={() => setMinted(null)}
              className={`${BTN_SECONDARY} text-xs`}
            >
              I have saved it — hide it
            </button>
          </div>

          {/* THE STEPS ARE FOR THE CASE WHERE THE SYSTEM COULD NOT KEEP IT.
              When it did, there is nothing to do — printing four steps beside a
              key that is already working would have somebody dutifully pasting
              it into Vercel for no reason. */}
          {minted.kept ? (
            <p className="mt-3 text-[11px] leading-relaxed text-emerald-900 dark:text-emerald-200">
              <strong>Nothing further to do.</strong> The University is signing with this key from
              the next credential onwards — no environment variable, no redeploy. Sign the
              credentials already on the register with the button below.
            </p>
          ) : (
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
            <li>
              In Vercel: <strong>Settings → Environment Variables → Add New</strong>. Name it{' '}
              <code className="font-mono">CREDENTIAL_SIGNING_KEY</code> and paste the key above,
              including the BEGIN and END lines.
            </li>
            <li>
              <strong>Redeploy.</strong> A new variable does not reach a deployment that is already
              running.
            </li>
            <li>
              Come back to this screen. It should read <em>The University holds an Ed25519 key</em>{' '}
              with id <span className="font-mono">{minted.keyId}</span>.
            </li>
            <li>
              Then <strong>Sign them</strong> below, to sign the credentials already on the
              register.
            </li>
          </ol>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-[#6b6076] dark:text-[#9c93ad]">
        {unsigned === null
          ? `Which credentials carry no signature could not be read. ${unsignedError ?? ''}`
          : unsigned === 0
            ? 'Every credential on the register carries a signature.'
            : `${unsigned} credential${unsigned === 1 ? '' : 's'} on the register carry no signature`
              + `${unsigned > SHOW_AT_MOST ? `, the oldest ${SHOW_AT_MOST} of them below` : ''}`
              // The colon only when something follows it.
              + `${unsignedRows.length > 0 ? ':' : '.'}`}
      </p>

      {/* --- WHICH ONES --------------------------------------------------
          Listed rather than counted, because the count alone cannot be
          checked against anything. */}
      {unsignedRows.length > 0 && (
        <>
          <div className="mt-2 overflow-x-auto rounded-xl border border-[#e6e0d6] dark:border-[#3d3349]">
            <table className="w-full min-w-[34rem] border-collapse text-left text-[11px]">
              <thead>
                <tr className="bg-[#faf8f4] text-[10px] uppercase tracking-wide text-[#8a8194] dark:bg-[#241d2e]">
                  <th className="px-3 py-2 font-semibold">Credential</th>
                  <th className="px-3 py-2 font-semibold">Holder</th>
                  <th className="px-3 py-2 font-semibold">Document</th>
                  <th className="px-3 py-2 font-semibold">Issued</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {unsignedRows.map((r) => (
                  <tr key={r.id} className="border-t border-[#eee9e0] dark:border-[#332b3f]">
                    <td className="px-3 py-2 align-top font-mono text-[10px] text-[#422e59] dark:text-[#e4dcf0]">
                      {r.credentialRef}
                      {/* THE VERSION IS WHY THE COUNT AND THE REGISTER DISAGREE.
                          Two versions of one credential number are two documents
                          to sign and one entry in the list beside this. */}
                      {r.version > 1 && (
                        <span className="ml-1 rounded bg-[#422e59]/10 px-1 py-px text-[9px] font-sans font-semibold text-[#422e59] dark:bg-[#c5a55a]/20 dark:text-[#e4dcf0]">
                          v{r.version}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-[#33234a] dark:text-[#e4dcf0]">
                      {r.holderName}
                      {r.award && (
                        <span className="block text-[10px] text-[#8a8194]">{r.award}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top capitalize text-[#6b6076] dark:text-[#9c93ad]">
                      {r.kind.replace(/-/g, ' ')}
                    </td>
                    <td className="px-3 py-2 align-top whitespace-nowrap text-[#6b6076] dark:text-[#9c93ad]">
                      {issuedOn(r.issuedAt)}
                    </td>
                    <td className="px-3 py-2 align-top capitalize text-[#6b6076] dark:text-[#9c93ad]">
                      {r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(unsigned ?? 0) > unsignedRows.length && (
            <p className="mt-1.5 text-[11px] text-[#8a8194]">
              …and {(unsigned ?? 0) - unsignedRows.length} more, not shown. Signing works through
              the whole register, not only the rows listed here.
            </p>
          )}

          {/* SAID ONLY WHEN IT APPLIES. Explaining superseded versions to
              somebody whose list has none is noise. */}
          {unsignedRows.some((r) => r.version > 1) && (
            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-[#8a8194]">
              A credential number appearing twice is not a duplicate: it is an earlier version and
              the correction that replaced it. Both were issued, both may be in somebody&rsquo;s
              hand, and both are signed separately — which is why this count can exceed the number
              of entries in the register beside it.
            </p>
          )}
        </>
      )}

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
