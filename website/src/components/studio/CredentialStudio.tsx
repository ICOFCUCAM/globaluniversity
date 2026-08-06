'use client';

// ---------------------------------------------------------------------------
// The Credential Studio.
//
// WHAT THIS SCREEN IS FOR, AND WHAT IT WAS BEFORE.
//
// It was a page designer. The left rail offered Paper, Orientation, Border and
// Colours — desktop-publishing controls — and a registrar does not think in
// those terms. They think: how does this university issue a credential nobody
// can forge, and how do I withdraw one that should not stand?
//
// The rail is now organised round that question. Design is one section of it
// rather than the whole screen, and it sits beside the security layers, the
// signatories, the version history and the register of what has actually been
// issued.
//
// SECTIONS THAT DO NOT EXIST ARE NOT SHOWN. A rail of seventeen entries where
// eleven open an empty pane is worse than a rail of six that work — it makes a
// system look finished when it is not, and the person who finds out is a
// registrar who needed the eleventh. What is not built is listed, once, under
// "Not built yet", with what each would need.
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
import { FOCUS } from '@/lib/portalTheme';
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
import TranscriptDocument from '@/components/transcript/TranscriptDocument';
import { uvLayerSvg } from '@/lib/credentialArt';
import ApprovalQueue from './ApprovalQueue';
import { WORDING_KEYS, TITLE_FONTS } from '@/lib/credentialTemplate';
import {
  Palette, Upload, AlertTriangle, CheckCircle2, History, Award, FileText,
  Loader2, Plus, Trash2, RotateCcw, ShieldAlert, ShieldCheck, PenLine,
  Stamp, Download, ListChecks, Construction, Printer, Lock,
} from 'lucide-react';

/**
 * The rail. Every entry here opens something real; see the header for why
 * there is no entry for anything that does not.
 */
const SECTIONS = [
  { id: 'certificate', label: 'Certificate template', icon: Award, kind: 'certificate' as CredentialKind },
  { id: 'transcript', label: 'Transcript template', icon: FileText, kind: 'transcript' as CredentialKind },
  { id: 'security', label: 'Security features', icon: ShieldCheck },
  { id: 'signatories', label: 'Signatures & seal', icon: PenLine },
  { id: 'wording', label: 'Wording', icon: Stamp },
  { id: 'approvals', label: 'Senate approval', icon: ShieldCheck },
  { id: 'versions', label: 'Version control', icon: History },
  { id: 'print', label: 'Printing', icon: Download },
  { id: 'readiness', label: 'Readiness', icon: ListChecks },
  { id: 'gaps', label: 'Not built yet', icon: Construction },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const SAMPLE_TRANSCRIPT = {
  fullName: 'Grace Nalova Meyembi',
  studentNumber: 'ICOF202600451',
  dateOfBirth: '14 March 2004',
  programme: 'Bachelor of Theology',
  faculty: 'Faculty of Theology and Christian Counselling',
  admitted: 'September 2023',
  completed: 'July 2026',
  terms: [
    {
      label: 'Year 1 · First Semester',
      courses: [
        { code: 'THE101', title: 'Introduction to Systematic Theology', credits: 3, grade: 'A', points: 4.0 },
        { code: 'BIB105', title: 'Old Testament Survey', credits: 3, grade: 'A-', points: 3.67 },
        { code: 'CCN110', title: 'Foundations of Christian Counselling', credits: 3, grade: 'B+', points: 3.33 },
      ],
      credits: 9,
      gpa: 3.67,
    },
    {
      label: 'Year 1 · Second Semester',
      courses: [
        { code: 'THE102', title: 'Doctrine of God', credits: 3, grade: 'A', points: 4.0 },
        { code: 'BIB106', title: 'New Testament Survey', credits: 3, grade: 'B+', points: 3.33 },
      ],
      credits: 6,
      gpa: 3.67,
    },
  ],
  totalCredits: 15,
  cgpa: 3.67,
  classification: 'First Class Honours',
  credentialId: 'IGUC-TRN-26A9-F8K2-P19D',
  sealCode: 'ICOF-7T2M-XQ4V-K93B',
};

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
  fullName: 'Grace Nalova Meyembi',
  programme: 'Theology',
  degree: 'Bachelor of Theology',
  classification: 'Second Class Honours (Upper Division)',
  credentialId: 'IGUC-BTH-26A9-F8K2-P19D',
  sealCode: 'ICOF-7T2M-XQ4V-K93B',
};

export default function CredentialStudio() {
  const { user } = useAuth();
  const allowed = can(user?.role, 'design-credentials');
  // An approving office is not a designer and must not become one — but it has
  // to be able to reach the queue, read what it is being asked to sign, and
  // sign it. Without this the Registrar could not open the screen the approval
  // chain was built for, and the governance would exist only in the database.
  const approver = can(user?.role, 'approve-credential-design');

  const [section, setSection] = useState<SectionId>('certificate');
  const [kind, setKind] = useState<CredentialKind>('certificate');
  const [design, setDesign] = useState<CredentialDesign>(defaultDesign('certificate'));
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [versionName, setVersionName] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const problems = useMemo(() => validateDesign(design, kind), [design, kind]);

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

  function setWording(key: string, value: string) {
    setDesign((d) => ({ ...d, wording: { ...d.wording, [key]: value } }));
    setMessage(null);
  }

  function setSecurity<K extends keyof CredentialDesign['security']>(
    key: K, value: CredentialDesign['security'][K],
  ) {
    setDesign((d) => ({ ...d, security: { ...d.security, [key]: value } }));
    setMessage(null);
  }

  /**
   * The UV artwork, as a file for the print shop.
   *
   * A download rather than a toggle, for the reason given in credentialArt.ts:
   * fluorescent ink is a press operation, and a switch on this screen would
   * imply the university produces something it does not.
   */
  function downloadUvArtwork() {
    const [pw, ph] = design.orientation === 'landscape' ? [297, 210] : [210, 297];
    const svg = uvLayerSvg('IGUC-SPECIMEN-0000-0000-0000', pw, ph);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `icof-uv-layer-${kind}.svg`;
    a.click();
    URL.revokeObjectURL(url);
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

  // An approver sees the queue and nothing else. The design controls, the
  // wording, the security features and the publish button are the designer's,
  // and showing them to an approver would blur the one line the chain draws.
  if (!allowed && approver) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">
            <ShieldCheck size={20} /> Credential approvals
          </h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
            Designs submitted for the university&apos;s approval. You are one of the three offices
            that must sign before a design can be published.
          </p>
        </div>
        <ApprovalQueue />
      </div>
    );
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

  const preview = kind === 'transcript'
    ? <TranscriptDocument design={design} data={SAMPLE_TRANSCRIPT} specimen />
    : <CertificateDocument design={design} data={SAMPLE} previewGuides specimen />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">
          <Palette size={20} /> Credential Studio
        </h2>
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
          The design, the security features and the issuing rules for every credential the
          university awards. Publishing creates a new version — nothing already issued changes.
        </p>
      </div>

      {message && (
        <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
          message.tone === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {message.tone === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <p>{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[210px_1fr]">
        {/* ---- The rail ------------------------------------------------- */}
        <nav className="space-y-0.5 lg:sticky lg:top-4 lg:self-start">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const active = section === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  setSection(sec.id);
                  if ('kind' in sec && sec.kind) setKind(sec.kind);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${FOCUS} ${
                  active
                    ? 'bg-[#422e59] font-semibold text-white'
                    : 'text-[#4a4155] hover:bg-[#f2eee6] dark:text-[#c8c1d4] dark:hover:bg-[#2a2333]'
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="min-w-0 truncate">{sec.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ---- The pane ------------------------------------------------- */}
        <div className="min-w-0 space-y-5">
          {/* Which document the settings sections are editing. Without this a
              Superadministrator can change a security setting and have no idea
              whether they just changed it on the certificate or the transcript. */}
          {section !== 'gaps' && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#ded6c8] bg-white p-2.5 dark:border-[#3d3349] dark:bg-[#241d30]">
              <span className="px-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">Editing</span>
              {(['certificate', 'transcript'] as CredentialKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${FOCUS} ${
                    kind === k
                      ? 'bg-[#422e59] text-white'
                      : 'bg-[#f2eee6] text-[#6b6076] hover:bg-[#e9e3d7] dark:bg-[#2a2333] dark:text-[#9c93ad]'
                  }`}
                >
                  {k}
                </button>
              ))}
              {loading && <Loader2 size={14} className="animate-spin text-[#a49bb0]" />}
            </div>
          )}

          {(section === 'certificate' || section === 'transcript') && (
            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[300px_1fr]">
              <div className="space-y-4">
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

                <Panel
                  title="Type"
                  hint="The title takes its own face. A blackletter body would be unreadable; the face belongs on the university's name and nowhere else."
                >
                  {TITLE_FONTS.map((f) => (
                    <label key={f.label} className="flex cursor-pointer items-start gap-2.5 rounded-lg p-1.5 hover:bg-[#faf8f4] dark:hover:bg-[#2a2333]">
                      <input
                        type="radio"
                        name="titleFont"
                        checked={design.titleFont === f.stack}
                        onChange={() => set('titleFont', f.stack)}
                        className="mt-1 h-3.5 w-3.5 shrink-0 accent-[#422e59]"
                      />
                      <span className="min-w-0">
                        <span
                          className="block text-[15px] text-[#33234a] dark:text-[#e4dcf0]"
                          style={{ fontFamily: f.stack }}
                        >
                          ICOF Global University
                        </span>
                        <span className="block text-[11px] text-[#6b6076] dark:text-[#9c93ad]">{f.label}</span>
                        {f.note && (
                          <span className="mt-0.5 block text-[10px] leading-relaxed text-[#a49bb0]">{f.note}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </Panel>

                <Panel title="Colour">
                  <Row label="Brand"><Colour value={design.brand} onChange={(v) => set('brand', v)} /></Row>
                  <Row label="Accent"><Colour value={design.accent} onChange={(v) => set('accent', v)} /></Row>
                  <Row label="Body text"><Colour value={design.ink} onChange={(v) => set('ink', v)} /></Row>
                  <Row label="Paper"><Colour value={design.paper} onChange={(v) => set('paper', v)} /></Row>
                </Panel>

                <button
                  onClick={() => setDesign(defaultDesign(kind))}
                  className="flex items-center gap-1.5 text-xs text-[#6b6076] hover:text-[#4a4155] dark:text-[#9c93ad]"
                >
                  <RotateCcw size={13} /> Reset to the built-in default
                </button>
              </div>

              <div className="space-y-4">
                <PreviewFrame kind={kind}>{preview}</PreviewFrame>
                <Publisher
                  problems={problems}
                  versionName={versionName}
                  setVersionName={setVersionName}
                  publish={publish}
                  publishing={publishing}
                />
              </div>
            </div>
          )}

          {section === 'security' && (
            <div className="space-y-4">
              <Panel
                title="Security features"
                hint="What each of these actually achieves is documented in credentialArt.ts, and it is less than the names suggest. None of it stops a determined forger. The control that decides authenticity is the credential number, the QR and the register behind them."
              >
                <Toggle
                  label="Guilloché"
                  detail="The engraved rosette used on banknotes and share certificates. Seeded from each credential's own number, so two documents never carry the same figure."
                  checked={design.security.guilloche}
                  onChange={(v) => setSecurity('guilloche', v)}
                />
                <Row label="Strength">
                  <input type="range" min={0.1} max={1} step={0.05} value={design.security.guillocheOpacity}
                    onChange={(e) => setSecurity('guillocheOpacity', Number(e.target.value))}
                    className="w-full" disabled={!design.security.guilloche} />
                  <span className="w-12 text-right text-xs text-[#6b6076]">{Math.round(design.security.guillocheOpacity * 100)}%</span>
                </Row>
                <Toggle
                  label="Microtext border"
                  detail="A rule that is really a line of 1.9pt type carrying this credential's number. Legible under a loupe, a grey smear on any photocopy — which is how an original is told from a copy."
                  checked={design.security.microtextBorder}
                  onChange={(v) => setSecurity('microtextBorder', v)}
                />
                <Toggle
                  label="Security ground"
                  detail="A fine lattice with the university's initials worked into it, instead of flat paper. Photocopiers dither regular fine patterns badly, so a copy shows moiré where the original shows an even ground."
                  checked={design.security.securityGround}
                  onChange={(v) => setSecurity('securityGround', v)}
                />
                <Toggle
                  label="Engraved seal"
                  detail="Vector, drawn per document from its credential number. The old seal was the website's favicon at 5% opacity — a raster anyone could download, and a flat image a PDF editor can delete in one action."
                  checked={design.security.engravedSeal}
                  onChange={(v) => setSecurity('engravedSeal', v)}
                />
                <Toggle
                  label="Verification QR"
                  detail="The only feature here that settles anything. Turning it off makes the design unpublishable, and that is deliberate."
                  checked={design.security.qr}
                  onChange={(v) => setSecurity('qr', v)}
                />
              </Panel>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
                <p className="font-semibold">There is no UV toggle, and there should not be.</p>
                <p className="mt-1.5">
                  Fluorescent ink is applied by a press on a second pass. A browser cannot emit it,
                  and a switch here would suggest the university is producing something it is not.
                  The artwork a printer needs for that pass is under <strong>Printing</strong>.
                </p>
              </div>

              <PreviewFrame kind={kind}>{preview}</PreviewFrame>
              <Publisher
                problems={problems} versionName={versionName} setVersionName={setVersionName}
                publish={publish} publishing={publishing}
              />
            </div>
          )}

          {section === 'signatories' && (
            <div className="space-y-4">
              <Panel
                title="The seal"
                hint="The university affixes a foil wafer to the hard copy by hand. The document leaves that area as clear paper, because a wafer pressed over printed artwork shows a halo of whatever was underneath."
              >
                <Row label="On the document">
                  <Select
                    value={design.sealPlacement}
                    onChange={(v) => set('sealPlacement', v as CredentialDesign['sealPlacement'])}
                    options={['reserved', 'printed']}
                  />
                </Row>
                <p className="text-[11px] leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                  {design.sealPlacement === 'printed'
                    ? 'The wafer is printed. Use this only for a copy that will never be sealed by hand — an electronic duplicate, or a specimen.'
                    : 'Space is left clear in the middle for a real wafer. This is the university’s practice, and it is what the hard copy expects.'}
                </p>
                <Row label="Wafer colour">
                  <Colour value={design.sealColour} onChange={(v) => set('sealColour', v)} />
                </Row>
                <Row label="Show seal">
                  <input type="checkbox" checked={design.showSeal} onChange={(e) => set('showSeal', e.target.checked)} />
                </Row>
                <Row label="Watermark">
                  <input type="range" min={0} max={0.4} step={0.01} value={design.sealOpacity}
                    onChange={(e) => set('sealOpacity', Number(e.target.value))} className="w-full" disabled={!design.showSeal} />
                  <span className="w-12 text-right text-xs text-[#6b6076]">{Math.round(design.sealOpacity * 100)}%</span>
                </Row>
              </Panel>

              <Panel title="Signatories" hint="Leave a name blank to print whoever currently holds the office. The office outlives the holder, and a certificate should not need republishing because a Registrar retired.">
                {design.signatories.map((sig, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={sig.name}
                      placeholder="Name (optional)"
                      onChange={(e) => {
                        const next = [...design.signatories];
                        next[i] = { ...next[i], name: e.target.value };
                        set('signatories', next);
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-[#ded6c8] px-2 py-1.5 text-xs dark:border-[#3d3349]"
                    />
                    <input
                      value={sig.office}
                      placeholder="Office"
                      onChange={(e) => {
                        const next = [...design.signatories];
                        next[i] = { ...next[i], office: e.target.value };
                        set('signatories', next);
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-[#ded6c8] px-2 py-1.5 text-xs dark:border-[#3d3349]"
                    />
                    <button
                      onClick={() => set('signatories', design.signatories.filter((_, j) => j !== i))}
                      className="rounded-lg p-1.5 text-[#a49bb0] hover:bg-red-50 hover:text-red-600"
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

              <PreviewFrame kind={kind}>{preview}</PreviewFrame>
              <Publisher
                problems={problems} versionName={versionName} setVersionName={setVersionName}
                publish={publish} publishing={publishing}
              />
            </div>
          )}

          {section === 'wording' && (
            <div className="space-y-4">
              <Panel
                title={`Wording — ${kind}`}
                hint="These are the sentences the university is committing to, which is exactly why one office edits them and no other."
              >
                {WORDING_KEYS[kind].map(({ key, label }) => (
                  <Field
                    key={key}
                    label={label}
                    value={design.wording[key] ?? ''}
                    onChange={(v) => setWording(key, v)}
                  />
                ))}
                <Field label="Footnote" value={design.footnote} onChange={(v) => set('footnote', v)} />
              </Panel>
              <PreviewFrame kind={kind}>{preview}</PreviewFrame>
              <Publisher
                problems={problems} versionName={versionName} setVersionName={setVersionName}
                publish={publish} publishing={publishing}
              />
            </div>
          )}

          {section === 'approvals' && (
            <ApprovalQueue
              onPreview={(k, d) => {
                // Read it in the editor rather than in a modal. An approver
                // signing off a certificate should see it the way it will be
                // printed, at the size the preview offers, not as a thumbnail.
                setKind(k);
                setDesign(d);
                setSection(k === 'transcript' ? 'transcript' : 'certificate');
              }}
            />
          )}

          {section === 'versions' && (
            <div className="rounded-xl border border-[#ded6c8] bg-white p-4 dark:border-[#3d3349] dark:bg-[#241d30]">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">
                <History size={15} /> Published {kind} designs
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                A published design is never edited. Publishing writes a new row and makes it active;
                every earlier version stays exactly as it was, so a credential issued in 2026 can
                still be rendered as it was issued in 2036.
              </p>
              {loading ? (
                <p className="mt-3 text-sm text-[#a49bb0]">Loading…</p>
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
                        <p className="text-xs text-[#a49bb0]">
                          {v.published_at ? new Date(v.published_at).toLocaleString('en-GB') : 'not published'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {v.is_active && (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>
                        )}
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-[#f2eee6] px-2.5 py-0.5 text-[11px] font-semibold text-[#6b6076] dark:bg-[#2a2333] dark:text-[#9c93ad]"
                          title="A published design is immutable. Nothing can alter it — not this screen, not an administrator, not the service role."
                        >
                          <Lock size={10} /> Locked
                        </span>
                        {/* "Load into editor" read as though the published
                            version were about to be edited. It never was — a
                            published row is immutable in the database
                            (000_complete.sql section 13) and submitting always
                            writes a new version. The label described the wrong
                            act, which is the kind of thing that makes a
                            Superadministrator afraid to touch a control that is
                            perfectly safe. */}
                        <button
                          onClick={() => {
                            setDesign(withDefaults(kind, v.design));
                            setMessage({
                              tone: 'ok',
                              text: `Copied v${v.version} into the editor as a new draft. v${v.version} itself is locked and cannot be altered; submitting from here creates a new version.`,
                            });
                            setSection(kind === 'transcript' ? 'transcript' : 'certificate');
                          }}
                          className="text-xs font-medium text-[#422e59] hover:underline"
                        >
                          Duplicate as draft
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {section === 'print' && (
            <div className="space-y-4">
              <Panel title="Printing" hint="What a print shop needs that a browser cannot produce.">
                <p className="text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                  The document prints from the browser at the page size set under the template, with
                  backgrounds forced on — the security layers are backgrounds, and browsers drop
                  those on print by default. A security feature that vanishes on the printed copy is
                  not one, so the document sets <code>print-color-adjust: exact</code>.
                </p>
                <button
                  onClick={downloadUvArtwork}
                  className="mt-1 flex items-center gap-2 rounded-lg border border-[#ded6c8] px-3 py-2 text-xs font-medium text-[#422e59] hover:bg-[#f2eee6] dark:border-[#3d3349]"
                >
                  <Download size={14} /> Download UV / invisible-ink artwork (SVG)
                </button>
                <p className="text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                  Hand this to the printer for the fluorescent pass. Black in that file means ink;
                  it carries no visible-pass artwork. It is a specification for someone else&apos;s
                  press, not a feature of the document — which is why it is a download and not a
                  switch.
                </p>
              </Panel>
            </div>
          )}

          {section === 'readiness' && <Readiness />}

          {section === 'gaps' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#ded6c8] bg-white p-5 dark:border-[#3d3349] dark:bg-[#241d30]">
                <h3 className="flex items-center gap-2 font-heading text-base font-bold text-[#33234a] dark:text-[#e4dcf0]">
                  <Construction size={17} /> Not built yet
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                  These belong in a credential management system and are not here. They are listed
                  rather than shown as empty tabs, because a rail where half the entries open
                  nothing makes a system look finished when it is not — and the person who finds
                  out is a registrar who needed one of them.
                </p>
                <ul className="mt-4 space-y-3">
                  {NOT_BUILT.map((g) => (
                    <li key={g.title} className="border-l-2 border-[#e8dcc0] pl-3">
                      <p className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">{g.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">{g.needs}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers, local to this screen                   */
/* ------------------------------------------------------------------ */

/**
 * The preview.
 *
 * The one line that made the Transcript tab look dead was here: this pane
 * rendered CertificateDocument regardless of `kind`, so switching document type
 * changed the state and the versions list and produced no visible effect. The
 * caller now passes the right document; this only frames it.
 *
 * A4 landscape is 297mm — about 1120px — which no pane on this screen is wide
 * enough to hold, so it is scaled down and the scale is stated. A preview that
 * silently crops is worse than one that is visibly small.
 */
function PreviewFrame({ kind, children }: { kind: CredentialKind; children: React.ReactNode }) {
  // Fit, or true size.
  //
  // Fit is the useful default — the whole document at once, which is how a
  // designer judges balance. But a certificate is a printed object and some
  // decisions cannot be made at half size: whether the microtext resolves,
  // whether the seal code can be read, whether the frame's scroll course is
  // too busy at 11mm. Those are exactly the decisions that get made wrongly
  // and then discovered on paper.
  const [trueSize, setTrueSize] = React.useState(false);
  const fit = kind === 'transcript' ? 0.55 : 0.5;
  const scale = trueSize ? 1 : fit;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-[#ded6c8] p-0.5 dark:border-[#3d3349]">
          {([['Fit', false], ['Actual size', true]] as [string, boolean][]).map(([label, v]) => (
            <button
              key={label}
              onClick={() => setTrueSize(v)}
              className={`rounded-md px-3 py-1 text-[11px] font-medium transition-colors ${FOCUS} ${
                trueSize === v
                  ? 'bg-[#422e59] text-white'
                  : 'text-[#6b6076] hover:bg-[#f2eee6] dark:text-[#9c93ad] dark:hover:bg-[#2a2333]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-[#ded6c8] px-3 py-1.5 text-[11px] font-medium text-[#422e59] transition-colors hover:bg-[#f2eee6] dark:border-[#3d3349] dark:text-[#c8c1d4] ${FOCUS}`}
        >
          <Printer size={13} /> Print this proof
        </button>
      </div>

      <div className="overflow-auto rounded-xl bg-[#f2eee6] p-5 dark:bg-[#2a2333]">
        <div style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${100 / scale}%`,
          // At actual size the sheet is wider than any pane on this screen, so
          // the container has to be told it is — otherwise the transform
          // overflows silently and the right-hand third of the document is
          // simply unreachable.
          height: trueSize ? undefined : 'auto',
        }}>
          {children}
        </div>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-[#a49bb0]">
        {trueSize
          ? 'Actual printed size — scroll to see the whole sheet. This is what the microtext and the seal code look like on paper.'
          : `Shown at ${Math.round(fit * 100)}% of printed size.`}
        {' '}Sample data, overprinted SPECIMEN — no real credential is issued from this screen.
      </p>
    </div>
  );
}

function Publisher({ problems, versionName, setVersionName, publish, publishing }: {
  problems: string[];
  versionName: string;
  setVersionName: (v: string) => void;
  publish: () => void;
  publishing: boolean;
}) {
  return (
    <>
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
      <div className="rounded-xl border border-[#ded6c8] bg-white p-4 dark:border-[#3d3349] dark:bg-[#241d30]">
        <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">Name this version</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder="e.g. 2026 Senate-approved certificate"
            className="min-w-[220px] flex-1 rounded-lg border border-[#ded6c8] px-3 py-2 text-sm dark:border-[#3d3349]"
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
    </>
  );
}

function Toggle({ label, detail, checked, onChange }: {
  label: string; detail: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-[#faf8f4] dark:hover:bg-[#2a2333]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#422e59]"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-[#33234a] dark:text-[#e4dcf0]">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">{detail}</span>
      </span>
    </label>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#ded6c8] dark:border-[#3d3349] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-[#a49bb0] dark:text-[#7b7289]">{hint}</p>}
      <div className="mt-3 space-y-2.5">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 flex-shrink-0 text-xs text-[#6b6076] dark:text-[#9c93ad]">{label}</span>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="flex-1 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] px-2 py-1.5 text-xs capitalize">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Colour({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-1 items-center gap-2">
      <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded border border-[#ded6c8] dark:border-[#3d3349] bg-white" />
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] px-2 py-1.5 font-mono text-xs" />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-[#6b6076] dark:text-[#9c93ad]">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
        className="mt-1 w-full resize-y rounded-lg border border-[#ded6c8] dark:border-[#3d3349] px-2 py-1.5 text-xs" />
    </div>
  );
}

/**
 * What a credential management system should have and this one does not.
 *
 * Written out rather than implied by empty tabs. Each entry says what it would
 * take, because "coming soon" is not information and the next person to pick
 * this up needs the dependency, not the promise.
 */
const NOT_BUILT: { title: string; needs: string }[] = [
  {
    title: 'Award types',
    needs: 'A table of the degrees the university confers — code, title, credit requirement, ' +
      'minimum CGPA — so a certificate can be issued against a rule rather than a typed string. ' +
      'The Certificate Generator currently hard-codes "Bachelor of Science" for every graduate.',
  },
  {
    title: 'Issuing rules and automation',
    needs: 'The graduation check: credits earned against the requirement for that specific ' +
      'programme, minimum CGPA, outstanding admission conditions, fees cleared. None of the four ' +
      'is wired, which is why the Generator still shows a word that was always going to say Eligible.',
  },
  {
    title: 'Diplomas, letters, badges, microcredentials',
    needs: 'Each is a document kind with its own fields. The register (004) already accepts ' +
      'them — the enum lists diploma, admission-letter, student-card, completion-letter — but no ' +
      'template or renderer exists for any of them.',
  },
  {
    title: 'Compare and restore versions',
    needs: 'A field-by-field diff between two published designs. Loading an old version into the ' +
      'editor works today; seeing what changed between v2 and v3 without loading both does not.',
  },
  {
    title: 'Print queue and batch issue',
    needs: 'Issuing a cohort in one operation, with a record of which sheets printed and which ' +
      'failed. Today a credential is issued one at a time.',
  },
  {
    title: 'Cryptographic PDF signing (PAdES)',
    needs: 'A real PDF signature needs an X.509 certificate from a recognised CA and a PDF ' +
      'toolchain, neither of which this deployment has. The HMAC seal is sound for verification ' +
      'against this university’s own /verify, but a PDF reader will not show a signature panel ' +
      'and the interface must not claim it does.',
  },
];

/**
 * Whether this university can actually issue a credential today.
 *
 * Four things have to hold, and every one of them has been communicated so far
 * as a sentence in a handover note. A note is not a control: somebody reads it
 * once, does three of the four, and the system carries on looking finished —
 * because a missing environment variable does not announce itself, it makes one
 * button quietly refuse six weeks later.
 *
 * Each item carries its own remedy, because "not ready" is the beginning of the
 * question rather than the answer to it.
 */
function Readiness() {
  const [items, setItems] = React.useState<
    { id: string; label: string; state: string; detail: string; remedy?: string }[] | null
  >(null);
  const [problem, setProblem] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) { setProblem('Your session has expired.'); return; }
      const res = await fetch('/api/admin/readiness', {
        headers: { authorization: `Bearer ${token}` },
      }).then((r) => r.json()).catch(() => null);
      if (res?.ok) setItems(res.items);
      else setProblem(res?.error ?? 'The readiness check could not be run.');
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#ded6c8] bg-white p-4 dark:border-[#3d3349] dark:bg-[#241d30]">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">
          <ListChecks size={15} /> Can the university issue a credential today?
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
          Four things have to be true, and none of them announces itself when it is not. A missing
          signing key does not error — it makes one button refuse, weeks after somebody read the
          setup note and did three of the four.
        </p>
      </div>

      {problem && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{problem}</div>
      )}

      {items === null ? (
        <p className="text-sm text-[#a49bb0]">Checking…</p>
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li
              key={i.id}
              className={`rounded-xl border p-4 ${
                i.state === 'ready' ? 'border-emerald-200 bg-emerald-50/60'
                  : i.state === 'missing' ? 'border-red-200 bg-red-50'
                    : 'border-amber-200 bg-amber-50'
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-[#2f2838]">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  i.state === 'ready' ? 'bg-emerald-100 text-emerald-700'
                    : i.state === 'missing' ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}>
                  {i.state === 'ready' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                </span>
                {i.label}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[#4a4155]">{i.detail}</p>
              {i.remedy && (
                <p className="mt-2 text-xs leading-relaxed text-[#6b6076]">{i.remedy}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
