'use client';

// ---------------------------------------------------------------------------
// SETTINGS -> CONNECTED SOCIAL ACCOUNTS.
//
//   "Individual administrators would only be given the option in their settings
//    to connect theirs."
//
// TWO LISTS ON ONE SCREEN, AND THE DIFFERENCE BETWEEN THEM IS THE POINT.
//
//   THE UNIVERSITY'S ACCOUNTS are shown to every administrator, read-only.
//   Seeing that the institution has a LinkedIn page is not a secret, and
//   knowing which networks exist is what tells an administrator what "publish
//   everywhere" will actually mean. Only the Superadministrator sees a button.
//
//   YOUR ACCOUNTS are yours. Nobody else's appear here — not a count of them,
//   not their handles, not the fact that a colleague has connected anything.
//   The route filters on the caller's own id and the RLS policy on
//   social_accounts filters again underneath it.
//
// WHAT IS DELIBERATELY ABSENT FROM THIS SCREEN. Any view of another
// administrator's connections, for anyone, at any level. The Superadministrator
// governs the institution's accounts and the publishing policy; they do not
// hold a register of which members of staff have linked their personal
// Instagram. That register would be the most sensitive thing in the system and
// it has no use that justifies it.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { can } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import { PLATFORM_PROFILES, type Platform } from '@/lib/social';
import {
  Loader2, Plus, AlertTriangle, Building2, User, Unlink, CheckCircle2, Info,
} from 'lucide-react';

interface Row {
  id: string;
  scope: 'university' | 'personal';
  platform: Platform;
  handle: string;
  displayName: string | null;
  status: string;
  connectedAt: string;
  lastError: string | null;
}

interface Requirement {
  platform: Platform;
  configured: boolean;
  app: string;
  missing: string[];
  note: string;
}

export default function ConnectedAccounts({ role }: { role?: UserRole }) {
  const [university, setUniversity] = useState<Row[]>([]);
  const [mine, setMine] = useState<Row[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const mayConnectOwn = can(role, 'connect-own-social');
  const mayConnectUniversity = can(role, 'connect-university-social');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/social/connect', {
      headers: { authorization: `Bearer ${session.session?.access_token ?? ''}` },
    });
    const out = await res.json().catch(() => ({ ok: false, error: 'no-reply' }));
    setLoading(false);

    if (!out.ok) {
      setNotReady(out.detail ?? 'Connected accounts could not be read.');
      return;
    }
    setNotReady(null);
    setUniversity(out.university ?? []);
    setMine(out.mine ?? []);
    setRequirements(out.requirements ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // THE CALLBACK REDIRECTS BACK HERE WITH ITS ANSWER. Read once and then
  // cleared from the address bar, so a refresh does not repeat a stale message
  // — and so the detail, which can name a provider's own refusal, is not left
  // sitting in a URL somebody might paste into a support ticket.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('social');
    if (!outcome) return;
    setMessage({
      tone: outcome === 'connected' ? 'ok' : 'bad',
      text: params.get('detail') ?? (outcome === 'connected' ? 'Connected.' : 'The connection failed.'),
    });
    params.delete('social'); params.delete('detail');
    const rest = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
  }, []);

  async function act(payload: Record<string, unknown>, label: string) {
    setBusy(label);
    setMessage(null);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/social/connect', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({ ok: false, error: 'no-reply' }));
    setBusy(null);

    if (!out.ok) {
      setMessage({ tone: 'bad', text: out.detail ?? out.error ?? 'That did not work.' });
      return;
    }
    setMessage({ tone: 'ok', text: out.message ?? 'Done.' });
    void load();
  }

  // -------------------------------------------------------------------------
  // BEGINNING A CONNECTION.
  //
  // TWO STEPS, AND THE FIRST ONE IS WHY THIS EXISTS. Asking for the address is
  // a fetch, because it has to carry the signed-in administrator's token — a
  // plain `window.location.href` to the route carried none, and every click on
  // one of these buttons ended in a blank tab reading `{"error":"no-token"}`.
  //
  // Going to the provider is still a full page navigation. It has to be: the
  // consent screen is where the administrator is told what they are granting,
  // and it cannot be shown inside an XHR.
  // -------------------------------------------------------------------------
  async function beginConnection(platform: Platform, scope: 'university' | 'personal') {
    setBusy(`${scope}:${platform}`);
    setMessage(null);

    const out = await authedPost('/api/social/oauth/start', { platform, scope });

    if (!out.ok || typeof out.url !== 'string') {
      setBusy(null);
      setMessage({
        tone: 'bad',
        text: (out.detail as string | undefined)
          ?? `${PLATFORM_PROFILES[platform].name} could not be reached: ${out.error ?? 'no reply'}.`,
      });
      return;
    }
    // BUSY LEFT SET ON PURPOSE. The navigation is about to replace this page;
    // clearing it would flash the button back to life on the way out.
    window.location.href = out.url;
  }

  if (!mayConnectOwn && !mayConnectUniversity) {
    return (
      <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
        Publishing on behalf of the University is limited to administrators, so there is nothing
        to connect here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {notReady && (
        <div className="flex items-start gap-3 rounded-xl border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-[#a07c12]" />
          <span className="text-[#6b6076] dark:text-[#9c93ad]">{notReady}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className={`rounded-xl p-3 text-sm ${
            message.tone === 'ok'
              ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
              : 'border border-red-600/30 bg-red-600/10 text-red-900 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#422e59] dark:text-[#e4dcf0]">
          <Building2 size={15} /> The University’s accounts
        </h3>
        <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          Connected once by the Superadministrator. You can publish through these without
          holding their credentials, and you never see them.
        </p>

        {loading ? (
          <Loader2 size={16} className="mt-3 animate-spin text-[#9c93ad]" />
        ) : university.length === 0 ? (
          <p className="mt-3 text-sm text-[#6b6076] dark:text-[#9c93ad]">
            No University account is connected yet.
            {mayConnectUniversity
              ? ' Connect each network once below, and every administrator can publish'
                + ' through it from then on.'
              : ' Until the Superadministrator connects one, an announcement can only go out'
                + ' under an administrator’s own account.'}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {university.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                canRevoke={mayConnectUniversity}
                busy={busy === a.id}
                onRevoke={() => void act({ action: 'revoke', accountId: a.id }, a.id)}
              />
            ))}
          </ul>
        )}

        {/* CONNECT, ONCE, FOR THE WHOLE INSTITUTION.
            THIS IS THE BUTTON THAT WAS MISSING. The section above has always
            described accounts "connected once by the Superadministrator" and
            the route has always accepted `scope=university` — but nothing on
            this screen ever asked for that scope, so there was no way to
            connect an institutional account at all. Every button was
            `scope=personal`, under "My accounts".
            A NETWORK ALREADY CONNECTED IS NOT OFFERED AGAIN. Connecting the
            University's LinkedIn twice is not a thing anybody means to do. */}
        {mayConnectUniversity && !loading && (
          <ConnectButtons
            requirements={requirements.filter(
              (r) => !university.some((a) => a.platform === r.platform && a.status !== 'revoked'),
            )}
            scope="university"
            busy={busy}
            onConnect={(p) => void beginConnection(p, 'university')}
          />
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className={mayConnectOwn ? undefined : 'hidden'}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#422e59] dark:text-[#e4dcf0]">
          <User size={15} /> My accounts
        </h3>
        <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          Optional. Connect your own accounts if you want University announcements to be able to
          go out under your name as well — and you choose that per post, not once and for ever.
          Only you can connect or disconnect these.
        </p>

        {loading ? (
          <Loader2 size={16} className="mt-3 animate-spin text-[#9c93ad]" />
        ) : mine.length === 0 ? (
          <p className="mt-3 text-sm text-[#6b6076] dark:text-[#9c93ad]">
            You have not connected any account of your own.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {mine.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                canRevoke
                busy={busy === a.id}
                onRevoke={() => void act({ action: 'revoke', accountId: a.id }, a.id)}
              />
            ))}
          </ul>
        )}

        {!loading && (
          <ConnectButtons
            requirements={requirements}
            scope="personal"
            busy={busy}
            onConnect={(p) => void beginConnection(p, 'personal')}
          />
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* WHAT THE UNIVERSITY STILL HAS TO DO. Shown to the Superadministrator
          only — an ordinary administrator cannot act on any of it, and a list
          of unmet requirements they cannot meet reads as a broken system. */}
      {mayConnectUniversity && requirements.some((r) => !r.configured) && (
        <section className="rounded-xl border border-[#ece7de] bg-[#faf8f4] p-4 dark:border-[#2e2637] dark:bg-[#241f2c]">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#422e59] dark:text-[#e4dcf0]">
            <Info size={15} /> Not yet connectable
          </h3>
          <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
            Each network needs an application registered by the University in its own name. Until
            that exists, nothing can be published to it — and the Command Centre will not offer
            it as a destination rather than failing after the announcement is written.
          </p>
          <ul className="mt-3 space-y-3">
            {requirements.filter((r) => !r.configured).map((r) => (
              <li key={r.platform} className="text-xs">
                <p className="font-semibold text-[#422e59] dark:text-[#e4dcf0]">
                  {PLATFORM_PROFILES[r.platform].name}
                </p>
                <p className="text-[#6b6076] dark:text-[#9c93ad]">{r.app}</p>
                <p className="mt-0.5 text-[#6b6076] dark:text-[#9c93ad]">{r.note}</p>
                <p className="mt-0.5 font-mono text-[#9c93ad]">{r.missing.join('  ')}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[#9c93ad]">Full instructions: docs/SOCIAL-CONNECTIONS.md</p>
        </section>
      )}
    </div>
  );
}

/**
 * One button per network, for one scope.
 *
 * A NETWORK THIS DEPLOYMENT CANNOT REACH IS NOT CLICKABLE. It used to be: the
 * button drew itself greyed, said "· not set up", and then navigated anyway —
 * so the answer to "why is this greyed out?" was a tab full of JSON. Now it
 * refuses in place and the title says which environment variables are missing.
 */
function ConnectButtons({
  requirements, scope, busy, onConnect,
}: {
  requirements: Requirement[];
  scope: 'university' | 'personal';
  busy: string | null;
  onConnect: (platform: Platform) => void;
}) {
  if (requirements.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {requirements.map((r) => {
        const working = busy === `${scope}:${r.platform}`;
        return (
          <button
            key={r.platform}
            type="button"
            disabled={!r.configured || busy !== null}
            onClick={() => onConnect(r.platform)}
            title={r.configured
              ? `Connect ${PLATFORM_PROFILES[r.platform].name}${scope === 'university' ? ' as the University' : ''}`
              : `${r.app} Not yet registered — missing: ${r.missing.join(', ')}`}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed ${
              r.configured
                ? 'border-[#c5a55a]/60 text-[#422e59] disabled:opacity-40 dark:text-[#c5a55a]'
                : 'border-[#ece7de] text-[#9c93ad] dark:border-[#2e2637]'
            }`}
          >
            {working ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {PLATFORM_PROFILES[r.platform].name}
            {!r.configured && <span className="ml-1 opacity-60">· not set up</span>}
          </button>
        );
      })}
    </div>
  );
}

function AccountRow({
  account, canRevoke, busy, onRevoke,
}: {
  account: Row; canRevoke: boolean; busy: boolean; onRevoke: () => void;
}) {
  const live = account.status === 'connected';
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-[#ece7de] p-3 dark:border-[#2e2637]">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-[#422e59] dark:text-[#e4dcf0]">
          {live
            ? <CheckCircle2 size={14} className="text-emerald-600" />
            : <AlertTriangle size={14} className="text-[#a07c12]" />}
          {account.handle}
          <span className="text-xs font-normal text-[#9c93ad]">
            {PLATFORM_PROFILES[account.platform].name}
          </span>
        </p>
        {!live && (
          <p className="mt-0.5 truncate text-xs text-[#a07c12]">
            {account.lastError ?? `This connection is ${account.status} and cannot publish.`}
          </p>
        )}
      </div>
      {canRevoke && account.status !== 'revoked' && (
        <button
          type="button"
          onClick={onRevoke}
          disabled={busy}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[#ece7de] px-2.5 py-1.5 text-xs text-[#6b6076] disabled:opacity-40 dark:border-[#2e2637] dark:text-[#9c93ad]"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
          Disconnect
        </button>
      )}
    </li>
  );
}
