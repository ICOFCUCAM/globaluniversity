'use client';

// ---------------------------------------------------------------------------
// The Credential Studio — where the university's award certificates and
// transcripts are designed. Superadministrator only.
//
// Two things about this screen are deliberate and easy to mistake for
// omissions:
//
//   1. There is no Save. There is only Publish, and publishing writes a NEW
//      version rather than editing the active one. A design that has issued a
//      certificate is a historical fact; editing it in place would change what
//      the university appears to have attested to, retroactively, for every
//      graduate holding that design. Draft freely — nothing is stored until
//      you publish.
//
//   2. Publishing can be refused. The checks in validateDesign are about
//      legibility rather than taste: text too close in tone to the paper, a
//      signatory with no office, empty wording. A certificate is photocopied,
//      scanned and photographed far more often than it is looked at on a
//      screen, and each of those loses contrast rather than adding it.
// ---------------------------------------------------------------------------

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import {
  defaultDesign,
  validateDesign,
  withDefaults,
  type CredentialDesign,
  type CredentialKind,
} from '@/lib/credentialTemplate';
import CertificateDocument from '@/components/certificate/CertificateDocument';
import {
  Palette, Upload, AlertTriangle, CheckCircle2, History,
  Loader2, Plus, Trash2, RotateCcw, ShieldAlert,
} from 'lucide-react';

interface VersionRow {
  id: string;
  kind: CredentialKind;
  version: number;
  name: string;
  is_active: boolean;
  published_at: string | null;
  design: Partial<CredentialDesign>;
}

const SAMPLE = {
  fullName: 'MEYEMBI, Grace Nalova',
  programme: 'Theology',
  degree: 'Bachelor of Theology',
  classification: 'Second Class Honours (Upper Division)',
  serial: 'CERT/ICOF202600451',
};

export default function CredentialStudio() {
  const { user } = useAuth();
  const allowed = can(user?.role, 'design-credentials');

  const [kind, setKind] = useState<CredentialKind>('certificate');
  const [design, setDesign] = useState<CredentialDesign>(defaultDesign('certificate'));
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [versionName, setVersionName] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const problems = useMemo(() => validateDesign(design), [design]);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('credential_templates')
        .select('id, kind, version, name, is_active, published_at, design')
        .eq('kind', kind)
        .order('version', { ascending: false });
      if (!live) return;
      const rows = (data ?? []) as VersionRow[];
      setVersions(rows);
      const active = rows.find((r) => r.is_active);
      setDesign(withDefaults(kind, active?.design ?? null));
      setVersionName('');
      setLoading(false);
    })();
    return () => { live = false; };
  }, [kind]);

  function set<K extends keyof CredentialDesign>(key: K, value: CredentialDesign[K]) {
    setDesign((d) => ({ ...d, [key]: value }));
    setMessage(null);
  }

  function setWording(key: keyof CredentialDesign['wording'], value: string) {
    setDesign((d) => ({ ...d, wording: { ...d.wording, [key]: value } }));
    setMessage(null);
  }

  async function publish() {
    if (problems.length) return;
    if (!versionName.trim()) {
      setMessage({ tone: 'bad', text: 'Give this version a name so it can be referred to later.' });
      return;
    }
    setPublishing(true);
    setMessage(null);

    // The route authorises against the database, not against this screen. The
    // token is the caller's own session; nothing about the role is sent.
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setPublishing(false);
      setMessage({ tone: 'bad', text: 'Your session has expired. Sign in again to publish.' });
      return;
    }

    const res = await fetch('/api/admin/credential-template', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind, name: versionName.trim(), design }),
    });
    const json = await res.json();
    setPublishing(false);

    if (!json.ok) {
      const detail = Array.isArray(json.problems) ? ` — ${json.problems.join(' ')}` : '';
      setMessage({ tone: 'bad', text: `${json.error}${detail}` });
      return;
    }
    setMessage({
      tone: 'ok',
      text: `Published as v${json.template.version}. Every credential issued from now on prints under it; nothing already issued changes.`,
    });
    setVersionName('');
    const { data } = await supabase
      .from('credential_templates')
      .select('id, kind, version, name, is_active, published_at, design')
      .eq('kind', kind)
      .order('version', { ascending: false });
    setVersions((data ?? []) as VersionRow[]);
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 flex-shrink-0 text-amber-600" size={20} />
          <div>
            <h2 className="font-semibold text-amber-900">Credential Studio</h2>
            <p className="mt-1 text-sm text-amber-800">
              The design of the university&apos;s award certificates is held by the
              Superadministrator alone. An administrator who could redesign a
              certificate could alter what the university has already attested to.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">
            <Palette size={20} className="text-[#422e59]" /> Credential Studio
          </h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
            Design the award certificate and transcript. Publishing creates a new version — nothing already issued changes.
          </p>
        </div>
        <div className="flex gap-2">
          {(['certificate', 'transcript'] as CredentialKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition-colors ${
                kind === k ? 'bg-[#422e59] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
          message.tone === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {message.tone === 'ok' ? <CheckCircle2 size={16} className="mt-0.5" /> : <AlertTriangle size={16} className="mt-0.5" />}
          <p>{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
        {/* ------------------------------------------------------------- */}
        {/* Controls                                                       */}
        {/* ------------------------------------------------------------- */}
        <div className="space-y-5">
          <Panel title="Page">
            <Row label="Paper">
              <Select value={design.pageSize} onChange={(v) => set('pageSize', v as CredentialDesign['pageSize'])} options={['A4', 'Letter']} />
            </Row>
            <Row label="Orientation">
              <Select value={design.orientation} onChange={(v) => set('orientation', v as CredentialDesign['orientation'])} options={['landscape', 'portrait']} />
            </Row>
            <Row label="Border">
              <Select value={design.border} onChange={(v) => set('border', v as CredentialDesign['border'])} options={['double', 'single', 'none']} />
            </Row>
            <Row label="Border width">
              <input type="range" min={0} max={10} step={0.5} value={design.borderWidthMm}
                onChange={(e) => set('borderWidthMm', Number(e.target.value))} className="w-full" />
              <span className="w-12 text-right text-xs text-[#6b6076] dark:text-[#9c93ad]">{design.borderWidthMm}mm</span>
            </Row>
          </Panel>

          <Panel title="Colour">
            <Row label="Brand"><Colour value={design.brand} onChange={(v) => set('brand', v)} /></Row>
            <Row label="Accent"><Colour value={design.accent} onChange={(v) => set('accent', v)} /></Row>
            <Row label="Body text"><Colour value={design.ink} onChange={(v) => set('ink', v)} /></Row>
            <Row label="Paper"><Colour value={design.paper} onChange={(v) => set('paper', v)} /></Row>
          </Panel>

          <Panel title="Seal">
            <Row label="Show seal">
              <input type="checkbox" checked={design.showSeal} onChange={(e) => set('showSeal', e.target.checked)} />
            </Row>
            <Row label="Watermark">
              <input type="range" min={0} max={0.4} step={0.01} value={design.sealOpacity}
                onChange={(e) => set('sealOpacity', Number(e.target.value))} className="w-full" disabled={!design.showSeal} />
              <span className="w-12 text-right text-xs text-[#6b6076] dark:text-[#9c93ad]">{Math.round(design.sealOpacity * 100)}%</span>
            </Row>
          </Panel>

          <Panel title="Wording" hint="What the university is committing to. Change with care.">
            <Field label="Opening" value={design.wording.certifyLine} onChange={(v) => setWording('certifyLine', v)} />
            <Field label="Requirements" value={design.wording.satisfiedLine} onChange={(v) => setWording('satisfiedLine', v)} />
            <Field label="Award" value={design.wording.awardLine} onChange={(v) => setWording('awardLine', v)} />
            <Field label="Privileges" value={design.wording.privilegesLine} onChange={(v) => setWording('privilegesLine', v)} />
            <Field label="Footnote" value={design.footnote} onChange={(v) => set('footnote', v)} />
          </Panel>

          <Panel title="Signatories" hint="Leave a name blank to print whoever currently holds the office.">
            {design.signatories.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={s.name}
                  placeholder="Name (optional)"
                  onChange={(e) => {
                    const next = [...design.signatories];
                    next[i] = { ...next[i], name: e.target.value };
                    set('signatories', next);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                />
                <input
                  value={s.office}
                  placeholder="Office"
                  onChange={(e) => {
                    const next = [...design.signatories];
                    next[i] = { ...next[i], office: e.target.value };
                    set('signatories', next);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                />
                <button
                  onClick={() => set('signatories', design.signatories.filter((_, j) => j !== i))}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove signatory"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => set('signatories', [...design.signatories, { name: '', office: '' }])}
              className="flex items-center gap-1.5 text-xs font-medium text-[#422e59] hover:underline"
            >
              <Plus size={13} /> Add signatory
            </button>
          </Panel>

          <button
            onClick={() => setDesign(defaultDesign(kind))}
            className="flex items-center gap-1.5 text-xs text-[#6b6076] dark:text-[#9c93ad] hover:text-gray-700"
          >
            <RotateCcw size={13} /> Reset to the built-in default
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Live preview and publish                                       */}
        {/* ------------------------------------------------------------- */}
        <div className="space-y-4">
          <div className="overflow-auto rounded-xl bg-gray-100 p-6">
            <div style={{ transform: 'scale(0.62)', transformOrigin: 'top left', width: '162%' }}>
              <CertificateDocument design={design} data={SAMPLE} />
            </div>
          </div>

          {problems.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                <AlertTriangle size={15} /> This design cannot be published yet
              </p>
              <ul className="mt-2 space-y-1 text-sm text-red-700">
                {problems.map((p) => <li key={p}>· {p}</li>)}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <label className="block text-xs font-medium text-gray-600">Name this version</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <input
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="e.g. 2026 Senate-approved certificate"
                className="min-w-[240px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <button
                onClick={publish}
                disabled={publishing || problems.length > 0}
                className="flex items-center gap-2 rounded-xl bg-[#422e59] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#322244] disabled:opacity-40"
              >
                {publishing ? <><Loader2 size={15} className="animate-spin" /> Publishing…</> : <><Upload size={15} /> Publish new version</>}
              </button>
            </div>
            <p className="mt-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
              Publishing makes this the design for credentials issued from now on. Versions already
              issued keep their own design — nothing in a graduate&apos;s hand changes.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">
              <History size={15} /> Published versions
            </h3>
            {loading ? (
              <p className="mt-3 text-sm text-gray-400">Loading…</p>
            ) : versions.length === 0 ? (
              <p className="mt-3 text-sm text-[#6b6076] dark:text-[#9c93ad]">
                None yet. Until you publish one, credentials print under the built-in default.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                        v{v.version} · {v.name}
                      </p>
                      <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">
                        {v.published_at ? new Date(v.published_at).toLocaleString('en-GB') : 'not published'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {v.is_active && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>
                      )}
                      <button
                        onClick={() => { setDesign(withDefaults(kind, v.design)); setMessage(null); }}
                        className="text-xs font-medium text-[#422e59] hover:underline"
                      >
                        Load
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers, local to this screen                   */
/* ------------------------------------------------------------------ */

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-[#a49bb0] dark:text-[#7b7289]">{hint}</p>}
      <div className="mt-3 space-y-2.5">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 flex-shrink-0 text-xs text-gray-600">{label}</span>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs capitalize">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Colour({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-1 items-center gap-2">
      <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded border border-gray-200 bg-white" />
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 font-mono text-xs" />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-600">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
        className="mt-1 w-full resize-y rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
    </div>
  );
}
