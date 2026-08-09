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
}

interface Report {
  ok: boolean;
  authenticated: boolean;
  operational: boolean;
  missingRequired: string[];
  missingRecommended?: string[];
  exposedSecrets?: string[];
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
        </div>
      ))}
    </div>
  );
}
