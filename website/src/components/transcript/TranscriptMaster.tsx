'use client';

// ---------------------------------------------------------------------------
// THE MASTER TRANSCRIPT — landscape, after the University's own instrument.
//
// ---------------------------------------------------------------------------
// WHERE THIS LAYOUT COMES FROM
// ---------------------------------------------------------------------------
//
// The University's transcript of 20 January 2017. Landscape A4, a header block
// naming the holder and the award, the grade system printed on the face, and
// the record itself in per-semester blocks of seven columns:
//
//   Subject Codes | Name of Courses | Credit Values | Grade |
//   Credit Earned | Credit GPA | Grade Points
//
// with Semester GPA and GPA Credit Earned closing each block, and Study Total
// Credit, Total Credit Earned and Cumulative GPA closing the document.
//
// That structure is not decoration and it is not arbitrary. A receiving
// university reads a transcript by looking for exactly those columns, and an
// institution that changes them makes its own graduates harder to place. So the
// layout is reproduced; what is added is everything the 2017 sheet could not
// have.
//
// ---------------------------------------------------------------------------
// WHAT THE 2017 SHEET COULD NOT DO, AND THIS DOES
// ---------------------------------------------------------------------------
//
//   A VERIFICATION QR AND CREDENTIAL NUMBER. The original said "Valid 3 for
//   Months" — the only defence available to a paper document is to expire.
//   This one is checkable against the register for as long as the award
//   stands, so it does not need to expire.
//
//   A SEAL CODE IN WORDS, for a reader with no scanner.
//
//   THE SECURITY GROUND, seeded from the credential number, so two transcripts
//   never carry the same pattern and the same one always carries its own.
//
//   A VERSION NUMBER. The register supersedes rather than overwrites, so a
//   corrected transcript says which version it is and the earlier one remains
//   on record.
//
//   A SUPERSEDED BAND and a SPECIMEN overprint, because a document that can be
//   reissued must be able to say it is not the current one.
//
//   THE PROVENANCE OF A TRANSCRIBED RECORD, printed on the face.
//
// ---------------------------------------------------------------------------
// WHAT IS DELIBERATELY *NOT* COPIED FROM THE SCAN
// ---------------------------------------------------------------------------
//
// The institution's name, its offices and its signatories all come from the
// University's current records — `UNIVERSITY` and the credential design — and
// not from the 2017 sheet. That document names an institution as it was styled
// then and officers who held post then. Baking either into a template would
// have the University issuing documents in a former name over signatures of
// people who may no longer hold the office.
// ---------------------------------------------------------------------------

import React from 'react';
import { UNIVERSITY } from '@/lib/constants';
import { GRADING_SCALE } from '@/lib/grading';
import type { CredentialDesign } from '@/lib/credentialTemplate';
import type { TranscriptData } from '@/lib/types';
import { seedFrom, securityGroundUri, microtextBandUri } from '@/lib/credentialArt';

/**
 * The registrar's codes, as printed on the University's own transcript.
 *
 * TRANSCRIBED FROM THE INSTRUMENT, not invented. They belong in
 * `src/content/regulations.ts` beside the grade bands — that file's job is to
 * reproduce what the University publishes — and should move there when the
 * regulations are next revised. They are here for now so the master is
 * complete rather than missing a legend the original carries.
 */
export const REGISTRAR_CODES: { code: string; meaning: string }[] = [
  { code: 'WA', meaning: 'Withdrawal with approval' },
  { code: 'WC', meaning: 'Withdrawal with course' },
  { code: 'W', meaning: 'Withdrawal' },
  { code: 'I', meaning: 'Course incomplete' },
  { code: 'A', meaning: 'Absent' },
  { code: 'N', meaning: 'No credit' },
];

/** How a course sits in the programme. Also from the original. */
export const COURSE_STANDING: { code: string; meaning: string }[] = [
  { code: 'C', meaning: 'Compulsory' },
  { code: 'E', meaning: 'Elective' },
  { code: 'R', meaning: 'Required' },
];

export interface TranscriptMasterData extends TranscriptData {
  /** The register's number for this document. */
  credentialId?: string | null;
  /** The seal in words, for a reader with no scanner. */
  sealCode?: string | null;
  /** Verification QR, as SVG markup. Rendered by the server that signed it. */
  qrSvg?: string | null;
  version?: number | null;
  issuedOn?: string | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  sex?: string | null;
  studentNumber?: string | null;
  creditsEarned?: number | null;
  /** Set when the record was transcribed from an archive rather than derived. */
  transcribedFrom?: string | null;
  superseded?: boolean;
}

const MM = (n: number) => `${n}mm`;

export default function TranscriptMaster({
  design, data, specimen,
}: {
  design: CredentialDesign;
  data: TranscriptMasterData;
  specimen?: boolean;
}) {
  const seed = seedFrom(data.credentialId ?? 'IGUC-SPECIMEN');
  const ground = securityGroundUri(seed, 96, design.brand, UNIVERSITY.shortName, 0.05);
  const microtext = microtextBandUri(
    `${UNIVERSITY.name} · ${data.credentialId ?? 'SPECIMEN'} · `, 900, 10, design.accent, 3.4,
  );

  const ink = design.ink ?? '#241a30';
  const rule = design.accent ?? '#b99a3e';

  // Two semesters side by side, as the original sets them — a year reads
  // across, which is how a registrar compares one term against the next.
  const blocks = data.years.flatMap((y) => y.semesters.map((s) => ({ year: y.year, ...s })));

  const th: React.CSSProperties = {
    fontSize: '5.4pt', textTransform: 'uppercase', letterSpacing: '.04em',
    padding: '0.6mm 0.8mm', borderBottom: `0.5pt solid ${rule}`, textAlign: 'left',
    color: ink, fontWeight: 700,
  };
  const td: React.CSSProperties = {
    fontSize: '6pt', padding: '0.45mm 0.8mm', borderBottom: '0.2pt solid rgba(0,0,0,.10)',
    color: ink,
  };
  const num: React.CSSProperties = { ...td, textAlign: 'right' };

  return (
    <div
      id="icof-transcript"
      style={{
        width: MM(297), minHeight: MM(210), background: '#fdfcf8', position: 'relative',
        padding: MM(8), fontFamily: design.fontFamily ?? 'Georgia, "Times New Roman", serif',
        color: ink, boxSizing: 'border-box',
      }}
    >
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          #icof-transcript, #icof-transcript * { visibility: visible; }
          #icof-transcript { position: absolute; left: 0; top: 0; box-shadow: none !important; }
        }
      `}</style>

      {/* The security ground, seeded from the credential number. */}
      <div style={{
        position: 'absolute', inset: 0, backgroundImage: `url("${ground}")`,
        opacity: 1, pointerEvents: 'none',
      }} />

      {data.superseded && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: '54pt', color: 'rgba(160,40,40,.15)', fontWeight: 'bold',
            transform: 'rotate(-22deg)', letterSpacing: '.12em',
          }}>SUPERSEDED</span>
        </div>
      )}

      {specimen && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: '58pt', color: 'rgba(120,40,40,.13)', fontWeight: 'bold',
            transform: 'rotate(-22deg)', letterSpacing: '.16em',
          }}>SPECIMEN</span>
        </div>
      )}

      <div style={{ position: 'relative', border: `1pt solid ${rule}`, padding: MM(4), minHeight: MM(194) }}>

        {/* --- Header ------------------------------------------------------ */}
        <div style={{ display: 'flex', gap: MM(4), alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <h1 style={{
              margin: 0, fontSize: '15pt', letterSpacing: '.02em', fontWeight: 400, color: design.brand,
            }}>
              {UNIVERSITY.name}
            </h1>
            <p style={{ margin: '0.6mm 0 0', fontSize: '6.4pt', color: ink, opacity: 0.8 }}>
              {UNIVERSITY.headquarters} · {UNIVERSITY.descriptor}
            </p>
            <p style={{ margin: '2.5mm 0 0', fontSize: '7pt', letterSpacing: '.18em', textTransform: 'uppercase' }}>
              Student Transcript
            </p>
            <p style={{ margin: '0.4mm 0 0', fontSize: '5.8pt', letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.7 }}>
              Degree / diploma offered
            </p>
            <p style={{ margin: '0.6mm 0 0', fontSize: '11.5pt', fontWeight: 700, color: design.brand }}>
              {data.student.degree_type || data.student.program || data.department?.name}
            </p>
          </div>

          {/* The holder's particulars, boxed as the original sets them. */}
          <table style={{ borderCollapse: 'collapse', fontSize: '6pt', flex: '0 0 auto' }}>
            <tbody>
              <Particular label="Surname" value={data.student.last_name} rule={rule} />
              <Particular label="First names" value={data.student.first_name} rule={rule} />
              <Particular label="Middle name" value={(data.student as { middle_name?: string }).middle_name ?? '—'} rule={rule} />
              <Particular label="Student no." value={data.studentNumber ?? data.student.matric_no} rule={rule} mono />
              <Particular label="Date of birth" value={data.dateOfBirth ?? '—'} rule={rule} />
              <Particular label="Place of birth" value={data.placeOfBirth ?? '—'} rule={rule} />
              <Particular label="Sex" value={data.sex ?? '—'} rule={rule} />
              <Particular label="Date of issue" value={data.issuedOn ?? '—'} rule={rule} />
            </tbody>
          </table>
        </div>

        {/* --- The grade system, on the face ------------------------------- */}
        <div style={{
          marginTop: MM(2.5), display: 'flex', gap: MM(4), flexWrap: 'wrap',
          borderTop: `0.5pt solid ${rule}`, borderBottom: `0.5pt solid ${rule}`, padding: `${MM(1.4)} 0`,
        }}>
          <Legend title="Grade system">
            {GRADING_SCALE.map((g) => (
              <span key={g.grade} style={{ marginRight: MM(2.6) }}>
                <strong>{g.grade}</strong> {g.gradePoint.toFixed(2)} · {g.minScore}–{g.maxScore}%
              </span>
            ))}
          </Legend>
          <Legend title="Registrar’s codes">
            {REGISTRAR_CODES.map((c) => (
              <span key={c.code} style={{ marginRight: MM(2.2) }}>
                <strong>{c.code}</strong> {c.meaning}
              </span>
            ))}
            {COURSE_STANDING.map((c) => (
              <span key={c.code} style={{ marginRight: MM(2.2) }}>
                <strong>{c.code}:</strong> {c.meaning}
              </span>
            ))}
          </Legend>
        </div>

        {/* THE PROVENANCE OF A TRANSCRIBED RECORD, on the face rather than only
            in the database. A safeguard a reader cannot see is not a safeguard
            for the reader. */}
        {data.transcribedFrom && (
          <p style={{
            margin: `${MM(2)} 0 0`, border: `0.6pt solid ${rule}`, background: 'rgba(185,154,62,.08)',
            padding: `${MM(1.4)} ${MM(2)}`, fontSize: '6pt', lineHeight: 1.45,
          }}>
            <strong>Transcribed from an archived record.</strong> These marks were not recorded in
            the University’s current academic system and did not pass through its approval chain.
            Source: {data.transcribedFrom}. This document is sealed and may be verified; what it
            attests to is a faithful transcription of that record.
          </p>
        )}

        {/* --- The record ---------------------------------------------------- */}
        <div style={{
          marginTop: MM(2.5), display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)', gap: `${MM(2)} ${MM(3)}`, flex: '1 1 auto',
          alignContent: 'start',
        }}>
          {blocks.map((b) => (
            <div key={`${b.year}-${b.semester}`} style={{ breakInside: 'avoid' }}>
              <p style={{
                margin: 0, fontSize: '6pt', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.06em', color: design.brand,
              }}>
                {b.year ? `Year ${b.year} · ` : ''}Semester {b.semester || '—'}
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: MM(0.8) }}>
                <thead>
                  <tr>
                    {/* THE ORIGINAL'S SEVEN COLUMNS, in its order and with its
                        meanings. The first draft of this collapsed two of them
                        and printed quality points under "Grade Points" — 9.99
                        where the University's own transcript prints 3.33. A
                        receiving registrar reads these columns by name; getting
                        one wrong makes the sheet unreadable to the people it
                        exists for. */}
                    <th style={th}>Code</th>
                    <th style={th}>Name of course</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cr val</th>
                    <th style={{ ...th, textAlign: 'right' }}>Grade</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cr earn</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cr GPA</th>
                    <th style={{ ...th, textAlign: 'right' }}>Gr pts</th>
                  </tr>
                </thead>
                <tbody>
                  {b.courses.map((c) => (
                    <tr key={c.code}>
                      <td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace' }}>{c.code}</td>
                      <td style={td}>{c.title}</td>
                      <td style={num}>{c.creditUnit}</td>
                      <td style={num}>{c.grade}</td>
                      {/* CREDIT EARNED IS NOT CREDIT VALUE. A failed course is
                          attempted and not earned, and the original prints both
                          columns precisely so the difference is legible. */}
                      <td style={num}>{c.gradePoint > 0 ? c.creditUnit : 0}</td>
                      <td style={num}>{c.gradePoint > 0 ? c.creditUnit : 0}</td>
                      {/* THE GRADE POINT, not the quality point. See above. */}
                      <td style={num}>{c.gradePoint.toFixed(2)}</td>
                    </tr>
                  ))}
                  {/* Two figures, as the original closes each block: how many
                      credits counted toward the GPA, and the GPA itself. */}
                  <tr>
                    <td colSpan={2} style={{ ...td, fontWeight: 700, borderTop: `0.5pt solid ${rule}` }}>
                      GPA credit earned
                    </td>
                    <td colSpan={3} style={{ ...num, fontWeight: 700, borderTop: `0.5pt solid ${rule}` }}>
                      {b.totalCredits}
                    </td>
                    <td colSpan={2} style={{ ...num, fontWeight: 700, borderTop: `0.5pt solid ${rule}` }}>
                      Semester GPA {b.gpa.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* --- Totals -------------------------------------------------------- */}
        <div style={{
          marginTop: MM(3), borderTop: `1pt solid ${rule}`, paddingTop: MM(1.6),
          display: 'flex', gap: MM(6), fontSize: '7pt', flexWrap: 'wrap',
        }}>
          <span>Study total credit <strong>{data.totalCredits}</strong></span>
          <span>Total credit earned <strong>{data.creditsEarned ?? data.totalCredits}</strong></span>
          <span>Cumulative GPA <strong>{data.cgpa.toFixed(2)}</strong></span>
          {/* Printed only when the award carries one — a doctorate is passed,
              not classified. `classificationFor` decides; this only renders. */}
          {data.classification && <span>Classification <strong>{data.classification}</strong></span>}
        </div>

        {/* --- Attestation, seal and verification ---------------------------- */}
        <div style={{
          marginTop: MM(3), display: 'flex', alignItems: 'flex-end',
          justifyContent: 'space-between', gap: MM(4),
        }}>
          {(design.signatories ?? []).slice(0, 4).map((sig, i) => (
            <div key={`${sig.name}-${i}`} style={{
              borderTop: `0.6pt solid ${ink}`, paddingTop: MM(1), minWidth: MM(48), textAlign: 'center',
            }}>
              <p style={{ margin: 0, fontSize: '6.6pt', fontWeight: 700 }}>{sig.name}</p>
              <p style={{ margin: 0, fontSize: '5.8pt', opacity: 0.75 }}>{sig.office}</p>
            </div>
          ))}

          <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
            {data.qrSvg
              ? <div dangerouslySetInnerHTML={{ __html: data.qrSvg }} />
              : <div style={{
                width: MM(16), height: MM(16), border: `0.5pt dashed ${rule}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '4.6pt', opacity: 0.6,
              }}>QR on issue</div>}
            <p style={{ margin: `${MM(0.8)} 0 0`, fontSize: '5.8pt', fontFamily: 'ui-monospace, Menlo, monospace' }}>
              {data.credentialId ?? 'not yet issued'}
            </p>
            {data.sealCode && (
              <p style={{ margin: 0, fontSize: '5.4pt', opacity: 0.75 }}>Seal {data.sealCode}</p>
            )}
            <p style={{ margin: 0, fontSize: '5.4pt', opacity: 0.75 }}>
              {/* NO EXPIRY. The 2017 sheet said "Valid 3 for Months" because a
                  paper document's only defence is to go stale. This one is
                  checkable against the register for as long as the award
                  stands, so it does not need to expire. */}
              Version {data.version ?? 1} · verify at {UNIVERSITY.website}/verify
            </p>
          </div>
        </div>

        {/* Microtext along the foot: legible under a glass, a grey line to a
            photocopier. It raises the cost of a casual forgery and nothing
            more — the register behind /verify is the control. */}
        <div style={{
          marginTop: MM(1.6), height: MM(2.4), backgroundImage: `url("${microtext}")`,
          backgroundRepeat: 'repeat-x', opacity: 0.55,
        }} />

        <p style={{ margin: `${MM(1)} 0 0`, fontSize: '5.4pt', textAlign: 'center', opacity: 0.7 }}>
          Issued without erasure or alteration. Any unauthorised modification renders it invalid.
          {' '}{UNIVERSITY.email} · {UNIVERSITY.website}
        </p>
      </div>
    </div>
  );
}

function Particular({
  label, value, rule, mono,
}: { label: string; value: React.ReactNode; rule: string; mono?: boolean }) {
  return (
    <tr>
      <th style={{
        textAlign: 'left', fontSize: '5.2pt', textTransform: 'uppercase', letterSpacing: '.06em',
        padding: '0.5mm 1.6mm 0.5mm 0', opacity: 0.7, fontWeight: 400,
        borderBottom: `0.2pt solid ${rule}33`, whiteSpace: 'nowrap',
      }}>{label}</th>
      <td style={{
        fontSize: '6.4pt', fontWeight: 700, padding: '0.5mm 0', whiteSpace: 'nowrap',
        borderBottom: `0.2pt solid ${rule}33`,
        fontFamily: mono ? 'ui-monospace, Menlo, monospace' : undefined,
      }}>{value || '—'}</td>
    </tr>
  );
}

function Legend({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: MM(90) }}>
      <p style={{
        margin: 0, fontSize: '5.2pt', textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7,
      }}>{title}</p>
      <p style={{ margin: '0.6mm 0 0', fontSize: '5.4pt', lineHeight: 1.5 }}>{children}</p>
    </div>
  );
}
