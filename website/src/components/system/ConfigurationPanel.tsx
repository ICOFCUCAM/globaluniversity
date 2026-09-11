'use client';

// ---------------------------------------------------------------------------
// WHAT THIS DEPLOYMENT CAN AND CANNOT DO.
//
// Almost every variable in this system is optional by design: mail, signing,
// proctoring and the social networks degrade rather than refuse. That is right,
// and it means an unset one is INVISIBLE — the screens look normal, the buttons
// are there, and the feature is quietly off.
//
// This is where that stops being invisible.
// ---------------------------------------------------------------------------

import React from 'react';
import { Loader2, Check, AlertTriangle, ShieldAlert, Settings2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CARD } from '@/lib/portalTheme';

interface Row {
  name: string;
  area: string;
  importance: 'required' | 'recommended' | 'optional';
  set: boolean;
  tooShort: boolean;
  purpose: string;
  ifAbsent: string;
  minLength?: number;
  /** Present on a variable that is a hazard when set rather than when absent. */
  dangerIfSet?: string;
}

interface Report {
  ok: boolean;
  authenticated: boolean;
  operational: boolean;
  missingRequired: string[];
  missingRecommended?: string[];
  exposedSecrets?: string[];
  dangerouslySet?: string[];
  settings: Row[];
  note?: string;
  error?: string;
}

const AREAS: Record<string, string> = {
  database: 'The database',
  credentials: 'Credentials and sealing',
  mail: 'Outbound mail',
  social: 'Social networks',
  proctoring: 'Live proctoring',
  site: 'The site’s own address',
  ai: 'The assistant',
};

export default function ConfigurationPanel() {
  const [report, setReport] = React.useState<Report | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch('/api/health/config', {
        headers: { authorization: `Bearer ${session.session?.access_token ?? ''}` },
      }).catch(() => null);
      if (!res) { setFailed('The configuration report could not be reached.'); return; }
      const out = await res.json().catch(() => null);
      if (!out) { setFailed('The configuration report returned nothing readable.'); return; }
      // A 503 IS STILL A REPORT — it is the locked-door case, where the Supabase
      // keys are missing and the endpoint answers publicly rather than asking
      // somebody to sign in to be told they cannot sign in.
      if (!out.ok && !out.settings) { setFailed(out.error ?? 'It could not be read.'); return; }
      setReport(out as Report);
    })();
  }, []);

  if (failed) {
    return (
      <div className={`${CARD} p-5`}>
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{failed}</p>
      </div>
    );
  }
  if (!report) {
    return (
      <div className={`${CARD} p-5`}>
        <p className="flex items-center gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <Loader2 size={14} className="animate-spin" /> Reading this deployment’s configuration…
        </p>
      </div>
    );
  }

  const byArea = report.settings.reduce<Record<string, Row[]>>((acc, s) => {
    (acc[s.area] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className={`${CARD} p-5`}>
      <h3 className="flex items-center gap-2 font-heading text-base font-bold text-[#422e59] dark:text-[#e4dcf0]">
        <Settings2 size={17} /> What this deployment is configured to do
      </h3>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
        Read from the running server, not from a document. No value is ever shown — only whether
        something is set.
      </p>

      {/* THE DANGEROUS ONE, FIRST AND LOUDEST. Anything named NEXT_PUBLIC_ is
          compiled into the browser bundle and served to every visitor. The
          service role key under that name hands the world full read and write
          over every record the University holds — and the site looks entirely
          normal. */}
      {(report.exposedSecrets?.length ?? 0) > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong>A secret is published to every visitor.</strong>{' '}
            {report.exposedSecrets!.join(', ')} — anything named NEXT_PUBLIC_ is compiled into the
            browser bundle. Delete it from the host and rotate the key immediately.
          </div>
        </div>
      )}

      {/* SET, AND THAT IS THE PROBLEM. Every other warning on this panel is
          about an absence. A deployment with the demo login enabled is fully
          configured by every other measure and offers one-click administrator
          sign-in to anybody who opens the login page. */}
      {(report.dangerouslySet?.length ?? 0) > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong>Set, and it should not be on this deployment.</strong>
            {report.dangerouslySet!.map((name) => {
              const row = report.settings.find((s) => s.name === name);
              return (
                <p key={name} className="mt-0.5 leading-relaxed">
                  <span className="font-mono">{name}</span> — {row?.dangerIfSet ?? ''}
                </p>
              );
            })}
          </div>
        </div>
      )}

      <div className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-xs ${
        report.operational
          ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
          : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
      }`}>
        {report.operational
          ? <Check size={14} className="mt-0.5 shrink-0" />
          : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
        <span>
          {report.note ?? (report.operational
            ? 'Everything the University cannot run without is set.'
            : `Missing and required: ${report.missingRequired.join(', ')}.`)}
        </span>
      </div>

      {Object.entries(byArea).map(([area, rows]) => (
        <div key={area} className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8a8194]">
            {AREAS[area] ?? area}
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {rows.map((s) => (
              <li key={s.name} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                  s.tooShort ? 'bg-red-500'
                    : s.set ? 'bg-emerald-500'
                      : s.importance === 'required' ? 'bg-red-500'
                        : s.importance === 'recommended' ? 'bg-[#e9c14a]' : 'bg-[#c9c2d2]'
                }`} />
                <div>
                  <span className="font-mono text-[#33234a] dark:text-[#e4dcf0]">{s.name}</span>
                  <span className="ml-2 text-[#8a8194]">
                    {s.tooShort
                      ? `set, but shorter than the ${s.minLength} characters it needs`
                      : s.set ? 'set' : `not set · ${s.importance}`}
                  </span>
                  {/* WHAT THE ABSENCE COSTS, beside the absence. A red dot with
                      no consequence next to it teaches people to ignore red
                      dots. */}
                  {!s.set && (
                    <p className="mt-0.5 max-w-2xl leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                      {s.ifAbsent}
                    </p>
                  )}

                </div>
              </li>
            ))}
          </ul>

          {/* ------------------------------------------------------------
              SET IS NOT THE SAME AS WORKING.

              The dots above say whether three strings are present. They
              cannot tell a correct password from a wrong one, a port the
              host allows from one it blocks, or a sender the provider
              accepts from one it refuses. All of those show green here and
              then fail at the first real admission — by which point the
              student has been admitted, numbered and given an account, and
              is the only person who has not been told.
              ------------------------------------------------------------ */}
          {area === 'mail' && <MailTest />}
        </div>
      ))}
    </div>
  );
}

/** Connect, authenticate, and send one message to the signed-in user. */
function MailTest() {
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<
    { ok: boolean; stage?: string; detail?: string; to?: string } | null
  >(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch('/api/health/mail-test', {
        method: 'POST',
        headers: { authorization: `Bearer ${session.session?.access_token ?? ''}` },
      }).catch(() => null);
      const out = res ? await res.json().catch(() => null) : null;
      setResult(out ?? {
        ok: false,
        detail: 'The test could not be reached. The deployment may still be building.',
      });
    } finally {
      setBusy(false);
    }
  }

  // WHICH STEP FAILED, NAMED. "Invalid login" and "connection timed out" need
  // completely different fixes, and one generic failure message sends somebody
  // to check the wrong one.
  const STAGE: Record<string, string> = {
    configuration: 'Not configured',
    connection: 'The mail server refused the connection',
    recipient: 'Nowhere to send it',
    delivery: 'The message was not accepted',
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => void run()}
        disabled={busy}
        className="rounded-lg border border-[#ded6c8] bg-white px-3 py-1.5 text-xs font-semibold text-[#422e59] transition-colors hover:bg-[#faf6ee] disabled:opacity-60 dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
      >
        {busy ? 'Sending…' : 'Send a test message to my address'}
      </button>
      <p className="mt-1 text-[11px] leading-relaxed text-[#8a8194]">
        Goes only to the address on your own account, never to one typed in — the University’s
        mail server should not be able to send arbitrary text to an arbitrary recipient.
      </p>

      {result && (
        <div className={`mt-2 flex items-start gap-2 rounded-lg p-3 text-xs ${
          result.ok
            ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
            : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
        }`}>
          {result.ok
            ? <Check size={14} className="mt-0.5 shrink-0" />
            : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
          <div>
            <strong>
              {result.ok
                ? `Sent to ${result.to}.`
                : STAGE[result.stage ?? ''] ?? 'The test did not succeed.'}
            </strong>
            {result.detail && <p className="mt-0.5 leading-relaxed">{result.detail}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
