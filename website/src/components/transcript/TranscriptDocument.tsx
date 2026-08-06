// ---------------------------------------------------------------------------
// The academic transcript, rendered from the published design.
//
// WHY THE TRANSCRIPT TAB APPEARED DEAD.
//
// It was not a permission bug, a null template or a crash. The Studio's preview
// pane rendered <CertificateDocument> unconditionally — one line, no branch on
// `kind`. Pressing "Transcript" did change the state, reload that kind's
// versions and swap the wording defaults, but the pane went on drawing a
// certificate, so nothing visible happened and the tab looked broken.
//
// Underneath it was worse than a broken tab. There was no transcript document
// at all: the transcript template could be designed, validated, published and
// versioned, and nothing anywhere could render it. TranscriptGenerator drew its
// own hard-coded layout and never read the template, so a Superadministrator
// could publish three versions of a transcript design and every transcript the
// university issued would ignore all of them.
//
// This is that document. It reads the design, like the certificate does, so
// what is approved in the Studio is what a graduate receives.
//
// WHAT A TRANSCRIPT IS FOR, AND WHY IT LOOKS DIFFERENT FROM A CERTIFICATE.
//
// A certificate is an assertion — one fact, stated with authority, meant to be
// framed. A transcript is evidence: a credential evaluator in another country
// reads every line of it and adds up the credits. So the priorities invert.
// Legibility of the table beats everything; the guilloché that suits a
// certificate is off by default here, because a rosette behind columns of marks
// makes them harder to read and reading them is the document's whole job.
// ---------------------------------------------------------------------------

import React, { forwardRef } from 'react';
import { UNIVERSITY } from '@/lib/constants';
import type { CredentialDesign } from '@/lib/credentialTemplate';
import {
  seedFrom, microtextBandUri, engravedSealUri, securityGroundUri,
} from '@/lib/credentialArt';

export interface TranscriptCourseRow {
  code: string;
  title: string;
  credits: number;
  grade: string;
  points: number;
}

export interface TranscriptTerm {
  label: string;
  courses: TranscriptCourseRow[];
  credits: number;
  gpa: number;
}

export interface TranscriptData {
  fullName: string;
  studentNumber: string;
  dateOfBirth?: string | null;
  programme: string;
  faculty?: string | null;
  admitted?: string | null;
  completed?: string | null;
  terms: TranscriptTerm[];
  totalCredits: number;
  cgpa: number;
  classification?: string | null;
  credentialId: string;
  sealCode?: string | null;
  qrSvg?: string | null;
  issuedOn?: Date;
}

const PAGE_MM = {
  A4: { portrait: [210, 297], landscape: [297, 210] },
  Letter: { portrait: [216, 279], landscape: [279, 216] },
} as const;

const DOC_ID = 'icof-transcript';

const TranscriptDocument = forwardRef<HTMLDivElement, {
  design: CredentialDesign;
  data: TranscriptData;
  version?: number;
  /**
   * Overprint SPECIMEN. Everything the certificate's own note says applies here
   * and applies harder: a transcript is the document a credential evaluator
   * reads line by line, and an indistinguishable copy of one produced from a
   * preview pane is a blank marksheet with the university's name on it.
   */
  specimen?: boolean;
}>(function TranscriptDocument({ design, data, version, specimen }, ref) {
  const [w, h] = PAGE_MM[design.pageSize][design.orientation];
  const issued = data.issuedOn ?? new Date();

  // No credential number, no transcript. The number is what a reader verifies
  // and what seeds the security ground; without it every transcript the
  // university issues carries identical artwork and none of them can be
  // checked. See CertificateDocument, where the same guard is explained at
  // length — the failure is the same and so is the answer.
  const missingId = !data.credentialId?.trim();
  const seed = seedFrom(data.credentialId || 'ICOFGU');
  const sec = design.security;
  const pad = design.borderWidthMm + 9;

  if (missingId && !specimen) {
    return (
      <div
        ref={ref}
        role="alert"
        style={{
          width: `${w}mm`, boxSizing: 'border-box', padding: '30mm', textAlign: 'center',
          fontFamily: design.fontFamily, background: '#fffaf0',
          border: '2mm solid #b45309', color: '#7c2d12',
        }}
      >
        <p style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>No transcript can be rendered</p>
        <p style={{ fontSize: '12.5px', lineHeight: 1.6, margin: '6mm 0 0' }}>
          This document has no credential number. A transcript without one cannot be verified by
          anyone who receives it, and the number is what seeds its security ground. Issue it
          through the register first.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* The page. Portrait A4 by default, margin zero because the document's
          own border runs to the sheet edge. Without this the browser printed a
          transcript at its own defaults and cropped the frame — the same defect
          the certificate had, in the same place, for the same reason. */}
      <style>{`
        @media print {
          @page { size: ${design.pageSize} ${design.orientation}; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          #${DOC_ID}, #${DOC_ID} * { visibility: visible; }
          #${DOC_ID} { position: absolute; left: 0; top: 0; box-shadow: none !important; }
          /* A transcript runs to several pages and a term must not be split
             across a break — a semester's marks read as a block. */
          #${DOC_ID} section { break-inside: avoid; }
        }
      `}</style>
    <div
      id={DOC_ID}
      ref={ref}
      role="article"
      lang="en"
      aria-label={
        `Academic transcript of ${UNIVERSITY.name} for ${data.fullName}, student number ` +
        `${data.studentNumber}, ${data.programme}. Cumulative GPA ${data.cgpa.toFixed(2)}` +
        `${data.classification ? `, ${data.classification}` : ''}. ` +
        `Credential number ${data.credentialId}.`
      }
      style={{
        width: `${w}mm`,
        minHeight: `${h}mm`,
        fontFamily: design.fontFamily,
        position: 'relative',
        backgroundColor: design.paper,
        color: design.ink,
        boxSizing: 'border-box',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {sec.securityGround && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${securityGroundUri(seed, 72, design.brand, UNIVERSITY.shortName, 0.035)}")`,
          backgroundRepeat: 'repeat',
        }} />
      )}
      {design.border !== 'none' && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0,
          border: `${design.borderWidthMm}mm solid ${design.brand}`,
        }} />
      )}

      {specimen && (
        <div
          role="note"
          aria-label="Specimen — not an issued transcript"
          style={{
            position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{
            transform: 'rotate(-28deg)',
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: `${Math.round(Math.min(w, h) * 0.34)}px`,
            fontWeight: 700, letterSpacing: '0.16em',
            color: '#b31217', opacity: 0.13, whiteSpace: 'nowrap',
          }}>
            SPECIMEN
          </span>
        </div>
      )}

      <div style={{ position: 'relative', padding: `${pad}mm`, boxSizing: 'border-box' }}>
        {/* --- Block: university header --------------------------------- */}
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: '5mm' }}>
          {design.showSeal && sec.engravedSeal && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={engravedSealUri(seed, 260, design.brand, design.accent,
                UNIVERSITY.name.toUpperCase(), UNIVERSITY.shortName)}
              alt=""
              style={{ width: '20mm', height: '20mm', flex: '0 0 20mm' }}
            />
          )}
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h1 style={{
              margin: 0, fontSize: '17px', letterSpacing: '0.1em', fontWeight: 700,
              color: design.brand, textTransform: 'uppercase', lineHeight: 1.15,
            }}>
              {UNIVERSITY.name}
            </h1>
            <p style={{ ...meta(design), margin: '1mm 0 0' }}>{UNIVERSITY.descriptor}</p>
            <p style={{ ...meta(design), margin: '0.6mm 0 0', opacity: 0.75 }}>
              {UNIVERSITY.headquarters} · {UNIVERSITY.website}
            </p>
          </div>
          <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
            {sec.qr && data.qrSvg && (
              <div
                style={{ width: '17mm', height: '17mm', background: '#fff', padding: '0.8mm', marginLeft: 'auto' }}
                dangerouslySetInnerHTML={{ __html: data.qrSvg }}
              />
            )}
            <p style={{ ...meta(design), margin: '1mm 0 0', fontSize: '6px' }}>
              VERIFY AT {UNIVERSITY.website.toUpperCase()}/VERIFY
            </p>
          </div>
        </header>

        <div style={{ height: '0.6mm', background: design.brand, margin: '3mm 0 1mm' }} />
        <div style={{ height: '0.3mm', background: design.accent, marginBottom: '4mm' }} />

        <h2 style={{
          margin: 0, textAlign: 'center', fontSize: '12px', fontWeight: 700,
          letterSpacing: '0.28em', textTransform: 'uppercase', color: design.brand,
        }}>
          {design.wording.title}
        </h2>

        {/* --- Block: student information -------------------------------- */}
        <p style={{ ...body(design), margin: '4mm 0 2mm', textAlign: 'center' }}>
          {design.wording.statement}
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', margin: '2mm 0 0' }}>
          <tbody>
            <Pair d={design} k="Name" v={data.fullName} k2="Student number" v2={data.studentNumber} />
            <Pair d={design} k="Date of birth" v={data.dateOfBirth ?? '—'} k2="Faculty" v2={data.faculty ?? '—'} />
            <Pair
              d={design}
              k={design.wording.programmeLead.replace(/^in the /i, 'The ')}
              v={data.programme}
              k2="Period of study"
              v2={[data.admitted, data.completed].filter(Boolean).join(' – ') || '—'}
            />
          </tbody>
        </table>

        {/* --- Block: the record ----------------------------------------- */}
        {data.terms.map((term) => (
          <section key={term.label} style={{ marginTop: '4.5mm', breakInside: 'avoid' }}>
            <p style={{
              ...meta(design), margin: '0 0 1mm', fontWeight: 700, color: design.brand,
              borderBottom: `0.3mm solid ${design.accent}`, paddingBottom: '0.8mm',
            }}>
              {term.label}
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
              <thead>
                <tr>
                  <Th d={design} w="17%">Code</Th>
                  <Th d={design}>Course</Th>
                  <Th d={design} w="10%" align="right">Credits</Th>
                  <Th d={design} w="10%" align="right">Grade</Th>
                  <Th d={design} w="12%" align="right">Points</Th>
                </tr>
              </thead>
              <tbody>
                {term.courses.map((c) => (
                  <tr key={c.code}>
                    <Td d={design} mono>{c.code}</Td>
                    <Td d={design}>{c.title}</Td>
                    <Td d={design} align="right">{c.credits}</Td>
                    <Td d={design} align="right">{c.grade}</Td>
                    <Td d={design} align="right">{c.points.toFixed(2)}</Td>
                  </tr>
                ))}
                <tr>
                  <Td d={design} colSpan={2} bold align="right">Term total</Td>
                  <Td d={design} align="right" bold>{term.credits}</Td>
                  <Td d={design} align="right" bold>GPA</Td>
                  <Td d={design} align="right" bold>{term.gpa.toFixed(2)}</Td>
                </tr>
              </tbody>
            </table>
          </section>
        ))}

        {/* --- Block: the summary ---------------------------------------- */}
        <div style={{
          marginTop: '5mm', padding: '3mm 4mm',
          border: `0.3mm solid ${design.accent}`,
          display: 'flex', justifyContent: 'space-between', gap: '6mm', flexWrap: 'wrap',
        }}>
          <Summary d={design} k="Total credits" v={String(data.totalCredits)} />
          <Summary d={design} k="Cumulative GPA" v={data.cgpa.toFixed(2)} />
          {data.classification && <Summary d={design} k="Classification" v={data.classification} />}
        </div>

        <p style={{ ...body(design), margin: '4mm 0 0', fontStyle: 'italic' }}>
          {design.wording.validity}
        </p>

        {/* --- Block: signature and verification -------------------------- */}
        <div style={{
          marginTop: '8mm', display: 'flex', alignItems: 'flex-end',
          justifyContent: 'space-between', gap: '8mm',
        }}>
          <div style={{ display: 'flex', gap: '10mm' }}>
            {design.signatories.map((s, i) => (
              <div key={`${s.office}-${i}`} style={{ minWidth: '48mm' }}>
                <div style={{
                  borderTop: `0.3mm solid ${design.ink}`, paddingTop: '1.4mm',
                  fontSize: '10px', fontWeight: 700,
                }}>
                  {s.name || (s.office.toLowerCase().includes('registrar') ? UNIVERSITY.registrar : '')}
                </div>
                <div style={{ fontSize: '9px', opacity: 0.7 }}>{s.office}</div>
              </div>
            ))}
          </div>
          <p style={{ ...meta(design), textAlign: 'right', margin: 0 }}>
            Issued {issued.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {sec.microtextBorder && (
          <div style={{
            marginTop: '3mm', height: '1.7mm',
            backgroundImage: `url("${microtextBandUri(
              `${UNIVERSITY.name.toUpperCase()} · ${data.credentialId}`, 300, 6, design.brand, 1.9,
            )}")`,
            backgroundRepeat: 'repeat-x',
            backgroundSize: 'auto 1.7mm',
          }} />
        )}

        <p style={{ ...meta(design), margin: '1.5mm 0 0', fontSize: '6.5px' }}>
          {design.footnote ? `${design.footnote} · ` : ''}
          CREDENTIAL {data.credentialId}
          {data.sealCode ? ` · SEAL ${data.sealCode}` : ''}
          {version ? ` · DESIGN v${version}` : ''}
        </p>
      </div>
    </div>
    </>
  );
});

/* --- small local helpers ------------------------------------------- */

const body = (d: CredentialDesign): React.CSSProperties => ({ fontSize: '10.5px', lineHeight: 1.55, color: d.ink });
const meta = (d: CredentialDesign): React.CSSProperties => ({
  fontSize: '8px', letterSpacing: '0.14em', textTransform: 'uppercase',
  fontFamily: 'Helvetica, Arial, sans-serif', color: d.ink,
});

function Pair({ d, k, v, k2, v2 }: { d: CredentialDesign; k: string; v: string; k2: string; v2: string }) {
  const key: React.CSSProperties = { padding: '1.2mm 0', width: '17%', opacity: 0.65, fontSize: '9px', verticalAlign: 'top' };
  const val: React.CSSProperties = { padding: '1.2mm 0', width: '33%', fontWeight: 700, verticalAlign: 'top' };
  return (
    <tr style={{ borderBottom: `0.2mm solid ${d.accent}55` }}>
      <td style={key}>{k}</td><td style={val}>{v}</td>
      <td style={key}>{k2}</td><td style={val}>{v2}</td>
    </tr>
  );
}

function Th({ d, children, w, align }: { d: CredentialDesign; children: React.ReactNode; w?: string; align?: 'right' }) {
  return (
    <th style={{
      width: w, textAlign: align ?? 'left', padding: '1.2mm 1mm',
      fontSize: '7.5px', letterSpacing: '0.12em', textTransform: 'uppercase',
      fontFamily: 'Helvetica, Arial, sans-serif', color: d.ink, opacity: 0.7,
      borderBottom: `0.2mm solid ${d.ink}44`,
    }}>{children}</th>
  );
}

function Td({ d, children, align, bold, mono, colSpan }: {
  d: CredentialDesign; children: React.ReactNode; align?: 'right';
  bold?: boolean; mono?: boolean; colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} style={{
      textAlign: align ?? 'left', padding: '1.1mm 1mm',
      fontWeight: bold ? 700 : 400,
      fontFamily: mono ? "'Courier New', Courier, monospace" : undefined,
      borderBottom: `0.15mm solid ${d.accent}44`,
      color: d.ink,
    }}>{children}</td>
  );
}

function Summary({ d, k, v }: { d: CredentialDesign; k: string; v: string }) {
  return (
    <div>
      <p style={{ ...meta(d), margin: 0, fontSize: '7.5px', opacity: 0.7 }}>{k}</p>
      <p style={{ margin: '0.8mm 0 0', fontSize: '14px', fontWeight: 700, color: d.brand }}>{v}</p>
    </div>
  );
}

export default TranscriptDocument;
