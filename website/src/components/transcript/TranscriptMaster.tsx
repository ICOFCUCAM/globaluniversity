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

/**
 * How many academic years fit on a sheet.
 *
 * TWO, AS THE ORIGINAL SETS IT. The University's own transcript runs Year One
 * and Year Two on the first sheet and Year Three, the totals and the signatures
 * on the second. Fitting a three-year record onto one page would mean type too
 * small to read under a photocopier, which is how most transcripts are actually
 * received.
 */
const YEARS_PER_SHEET = 2;

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

  // PAGINATED BY YEAR, not by however many blocks happen to fit. A year is the
  // unit a transcript is read in, and a sheet that breaks Year Two across two
  // pages is one a registrar has to reassemble.
  const sheets: (typeof data.years)[] = [];
  for (let i = 0; i < data.years.length; i += YEARS_PER_SHEET) {
    sheets.push(data.years.slice(i, i + YEARS_PER_SHEET));
  }
  if (sheets.length === 0) sheets.push([]);

  return (
    <div id="icof-transcript">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          #icof-transcript, #icof-transcript * { visibility: visible; }
          #icof-transcript { position: absolute; left: 0; top: 0; }
          .icof-sheet { box-shadow: none !important; margin: 0 !important; }
          /* EACH SHEET ITS OWN PAGE. Without this the browser flows them
             together and the second year's block is cut in half by the fold. */
          .icof-sheet + .icof-sheet { break-before: page; page-break-before: always; }
        }
      `}</style>

      {sheets.map((yearsOnSheet, i) => (
        <Sheet
          key={i}
          design={design}
          data={data}
          specimen={specimen}
          ground={ground}
          microtext={microtext}
          ink={ink}
          rule={rule}
          years={yearsOnSheet}
          first={i === 0}
          last={i === sheets.length - 1}
          page={i + 1}
          of={sheets.length}
        />
      ))}
    </div>
  );
}

function Sheet({
  design, data, specimen, ground, microtext, ink, rule, years, first, last, page, of,
}: {
  design: CredentialDesign;
  data: TranscriptMasterData;
  specimen?: boolean;
  ground: string; microtext: string; ink: string; rule: string;
  years: TranscriptMasterData['years'];
  first: boolean; last: boolean; page: number; of: number;
}) {
  return (
    <div
      className="icof-sheet"
      style={{
        width: MM(297), height: MM(210), background: '#fdfcf8', position: 'relative',
        padding: MM(7), fontFamily: design.fontFamily ?? 'Georgia, "Times New Roman", serif',
        color: ink, boxSizing: 'border-box', marginBottom: MM(6), overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, backgroundImage: `url("${ground}")`, pointerEvents: 'none',
      }} />

      {data.superseded && <Overprint text="SUPERSEDED" colour="rgba(160,40,40,.15)" />}
      {specimen && <Overprint text="SPECIMEN" colour="rgba(120,40,40,.13)" />}

      <div style={{
        position: 'relative', border: `1pt solid ${rule}`, padding: MM(3.5),
        height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      }}>
        {/* THE HEADER IS ON THE FIRST SHEET ONLY, as the original does it. A
            second page repeating the whole masthead wastes a third of the
            sheet; what it needs is enough to prove it belongs to the first,
            which is the running head below. */}
        {first ? (
          <Masthead design={design} data={data} ink={ink} rule={rule} />
        ) : (
          <RunningHead data={data} design={design} rule={rule} />
        )}

        {/* THE FULL-WIDTH STRIP the original rules across under the masthead:
            what the institution is, and where to check it. */}
        {first && (
          <p style={{
            margin: `${MM(1.6)} 0 0`, border: `0.5pt solid ${ink}`, padding: '0.9mm 2mm',
            fontSize: '6.2pt', textAlign: 'center', flex: '0 0 auto',
          }}>
            {UNIVERSITY.name}. For more information, visit {UNIVERSITY.email} · {UNIVERSITY.website}
          </p>
        )}

        {first && <GradeSystem ink={ink} rule={rule} />}

        {first && data.transcribedFrom && (
          <p style={{
            margin: `${MM(1.8)} 0 0`, border: `0.6pt solid ${rule}`, background: 'rgba(185,154,62,.08)',
            padding: `${MM(1.2)} ${MM(2)}`, fontSize: '5.8pt', lineHeight: 1.4,
          }}>
            <strong>Transcribed from an archived record.</strong> These marks were not recorded in
            the University’s current academic system and did not pass through its approval chain.
            Source: {data.transcribedFrom}. This document is sealed and may be verified; what it
            attests to is a faithful transcription of that record.
          </p>
        )}

        {/* --- The record: a row per year, a column per semester ------------ */}
        <div style={{ flex: '1 1 auto', marginTop: MM(2), minHeight: 0 }}>
          {years.map((y) => (
            <div key={y.year} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: MM(2.5), marginBottom: MM(2),
            }}>
              {[0, 1].map((slot) => {
                const s2 = y.semesters[slot];
                return s2 ? (
                  <SemesterBlock
                    key={slot}
                    s={s2}
                    ink={ink}
                    rule={rule}
                    brand={design.brand}
                    // Named on the first block of the year only, as the
                    // original does — it labels the row, not each half of it.
                    yearLabel={slot === 0 ? (y.year ? `Year ${inWords(y.year)}` : 'Unplaced') : ''}
                    termLabel={`${slot === 0 ? 'First' : 'Second'} Semester`}
                  />
                ) : <div key={slot} />;
              })}
            </div>
          ))}
        </div>

        {/* --- Closing block, on the last sheet only ----------------------- */}
        {last && (
          <>
            <div style={{
              borderTop: `1pt solid ${rule}`, paddingTop: MM(1.4),
              display: 'flex', gap: MM(7), fontSize: '8.6pt', flexWrap: 'wrap',
            }}>
              <span>Study total credit <strong>{data.totalCredits}</strong></span>
              <span>Total credit earned <strong>{data.creditsEarned ?? data.totalCredits}</strong></span>
              <span>Cumulative GPA <strong>{data.cgpa.toFixed(2)}</strong></span>
              {data.classification && <span>Classification <strong>{data.classification}</strong></span>}
            </div>

            <div style={{
              marginTop: MM(2.5), display: 'flex', alignItems: 'flex-end',
              justifyContent: 'space-between', gap: MM(3),
            }}>
              <div style={{ display: 'flex', gap: MM(4), flexWrap: 'wrap' }}>
                {(design.signatories ?? []).slice(0, 3).map((sig, i) => (
                  <div key={`${sig.name}-${i}`} style={{
                    borderTop: `0.6pt solid ${ink}`, paddingTop: MM(1),
                    minWidth: MM(38), textAlign: 'center',
                  }}>
                    <p style={{ margin: 0, fontSize: '6.4pt', fontWeight: 700 }}>{sig.name}</p>
                    <p style={{ margin: 0, fontSize: '5.6pt', opacity: 0.75 }}>{sig.office}</p>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
                {data.qrSvg
                  ? <div dangerouslySetInnerHTML={{ __html: data.qrSvg }} />
                  : <div style={{
                    width: MM(15), height: MM(15), border: `0.5pt dashed ${rule}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '4.6pt', opacity: 0.6, margin: '0 auto',
                  }}>QR on issue</div>}
                <p style={{ margin: `${MM(0.7)} 0 0`, fontSize: '5.6pt', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                  {data.credentialId ?? 'not yet issued'}
                </p>
                {data.sealCode && (
                  <p style={{ margin: 0, fontSize: '5.2pt', opacity: 0.75 }}>Seal {data.sealCode}</p>
                )}
                {/* NO EXPIRY. The 2017 sheet said "Valid 3 for Months" because
                    going stale is a paper document's only defence. This one is
                    checkable against the register for as long as the award
                    stands. */}
                <p style={{ margin: 0, fontSize: '5.2pt', opacity: 0.75 }}>
                  Version {data.version ?? 1} · verify at {UNIVERSITY.website}/verify
                </p>
              </div>
            </div>
          </>
        )}

        <div style={{
          marginTop: MM(1.2), height: MM(2.2), backgroundImage: `url("${microtext}")`,
          backgroundRepeat: 'repeat-x', opacity: 0.55, flex: '0 0 auto',
        }} />
        <p style={{ margin: `${MM(0.8)} 0 0`, fontSize: '5.2pt', textAlign: 'center', opacity: 0.7 }}>
          Issued without erasure or alteration. Any unauthorised modification renders it invalid.
          {' '}{UNIVERSITY.email} · {UNIVERSITY.website} · Page {page} of {of}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Overprint({ text, colour }: { text: string; colour: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', pointerEvents: 'none',
    }}>
      <span style={{
        fontSize: '54pt', color: colour, fontWeight: 'bold',
        transform: 'rotate(-22deg)', letterSpacing: '.14em',
      }}>{text}</span>
    </div>
  );
}

function Masthead({
  design, data, ink, rule,
}: { design: CredentialDesign; data: TranscriptMasterData; ink: string; rule: string }) {
  // A BORDERED GRID READ ACROSS, not a stack of label/value pairs. The original
  // sets Surname, First Names and Middle Name as three columns with the heading
  // above each value, and boxes the student number and sex apart at the right.
  // Reading down a list is not the same document.
  const cell: React.CSSProperties = {
    border: `0.5pt solid ${ink}`, padding: '0.6mm 1.4mm', verticalAlign: 'top',
  };
  const lab: React.CSSProperties = {
    ...cell, fontSize: '5.6pt', fontWeight: 400, opacity: 0.85, textAlign: 'left',
    borderBottom: 'none', paddingBottom: 0,
  };
  const val: React.CSSProperties = {
    ...cell, fontSize: '8.4pt', fontWeight: 700, borderTop: 'none', paddingTop: '0.2mm',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'flex', gap: MM(3), alignItems: 'flex-start', flex: '0 0 auto' }}>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: '15pt', letterSpacing: '.01em', fontWeight: 400, color: design.brand }}>
          {UNIVERSITY.name}
        </h1>
        <p style={{ margin: '0.4mm 0 0', fontSize: '6.4pt', fontWeight: 700, color: ink }}>
          {UNIVERSITY.headquarters}
        </p>
        <p style={{ margin: '0.2mm 0 0', fontSize: '6.4pt', fontWeight: 700, color: ink }}>
          {UNIVERSITY.descriptor}
        </p>
        <p style={{ margin: '2.2mm 0 0', fontSize: '7pt', letterSpacing: '.06em' }}>
          Student Transcript
        </p>
        <p style={{ margin: '1.4mm 0 0', fontSize: '5.4pt', opacity: 0.8 }}>
          Degree / Diploma Offered
        </p>
        <p style={{ margin: '0.3mm 0 0', fontSize: '12pt', fontWeight: 700, color: design.brand }}>
          {data.student.degree_type || data.student.program || data.department?.name}
        </p>
      </div>

      <table style={{ borderCollapse: 'collapse', flex: '0 0 auto' }}>
        <tbody>
          <tr>
            <th style={lab}>Surname</th><th style={lab}>First Names</th><th style={lab}>Middle Name</th>
            <th style={lab}>Stu No</th>
          </tr>
          <tr>
            <td style={val}>{data.student.last_name || '—'}</td>
            <td style={val}>{data.student.first_name || '—'}</td>
            <td style={val}>{(data.student as { middle_name?: string }).middle_name || '—'}</td>
            <td style={{ ...val, fontFamily: 'ui-monospace, Menlo, monospace' }}>
              {data.studentNumber ?? data.student.matric_no ?? '—'}
            </td>
          </tr>
          <tr>
            <th style={lab}>Date of Birth</th><th style={lab}>Place of Birth</th>
            <th style={lab}>Sex</th><th style={lab}>Date of Issue</th>
          </tr>
          <tr>
            <td style={val}>{data.dateOfBirth || '—'}</td>
            <td style={val}>{data.placeOfBirth || '—'}</td>
            <td style={val}>{data.sex || '—'}</td>
            <td style={val}>{data.issuedOn || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * The running head on sheets after the first.
 *
 * Enough to prove the sheet belongs to the first — the holder, the award and
 * the credential number — without repeating a masthead that would cost a third
 * of the page. A loose second sheet with no identification on it is a second
 * sheet that gets attached to the wrong transcript.
 */
function RunningHead({
  data, design, rule,
}: { data: TranscriptMasterData; design: CredentialDesign; rule: string }) {
  return (
    <div style={{
      flex: '0 0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      gap: MM(4), borderBottom: `0.6pt solid ${rule}`, paddingBottom: MM(1.2),
    }}>
      <span style={{ fontSize: '8pt', fontWeight: 700, color: design.brand }}>
        {UNIVERSITY.name} · Student Transcript (continued)
      </span>
      <span style={{ fontSize: '6.4pt' }}>
        {data.student.last_name} {data.student.first_name} ·{' '}
        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
          {data.studentNumber ?? data.student.matric_no}
        </span>
        {' '}· {data.credentialId ?? 'not yet issued'}
      </span>
    </div>
  );
}

function GradeSystem({ ink, rule }: { ink: string; rule: string }) {
  // VERTICAL LISTS IN TWO BOXES, as the original prints them — "AVERAGE" down
  // the left in two sub-columns, the registrar's codes down the right. Set
  // inline as running text it reads as a footnote; the original gives it the
  // weight of a key, because that is what it is.
  const half = Math.ceil(GRADING_SCALE.length / 2);
  const box: React.CSSProperties = {
    border: `0.5pt solid ${ink}`, padding: '1.2mm 1.8mm', fontSize: '5.7pt', lineHeight: 1.5,
  };
  return (
    <div style={{
      marginTop: MM(1.8), display: 'flex', gap: MM(2), flex: '0 0 auto', alignItems: 'stretch',
    }}>
      <div style={{ ...box, display: 'flex', gap: MM(3) }}>
        {[GRADING_SCALE.slice(0, half), GRADING_SCALE.slice(half)].map((col, i) => (
          <div key={i}>
            {i === 0 && (
              <p style={{ margin: '0 0 0.4mm', fontSize: '5.6pt', letterSpacing: '.1em', opacity: 0.8 }}>
                AVERAGE
              </p>
            )}
            {i !== 0 && <p style={{ margin: '0 0 0.4mm', fontSize: '4.8pt' }}>&nbsp;</p>}
            {col.map((g) => (
              <div key={g.grade} style={{ whiteSpace: 'nowrap' }}>
                <strong style={{ display: 'inline-block', width: MM(4) }}>{g.grade}</strong>
                {g.gradePoint.toFixed(2)}GPA {g.minScore}–{g.maxScore}%
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ ...box, display: 'flex', gap: MM(3) }}>
        <div>
          <p style={{ margin: '0 0 0.4mm', fontSize: '5.6pt', letterSpacing: '.1em', opacity: 0.8 }}>
            GRADE SYSTEM
          </p>
          {REGISTRAR_CODES.map((c) => (
            <div key={c.code} style={{ whiteSpace: 'nowrap' }}>
              <strong style={{ display: 'inline-block', width: MM(4) }}>{c.code}</strong>
              0GPA {c.meaning.toUpperCase()}
            </div>
          ))}
        </div>
        <div>
          <p style={{ margin: '0 0 0.4mm', fontSize: '4.8pt' }}>&nbsp;</p>
          {COURSE_STANDING.map((c) => (
            <div key={c.code} style={{ whiteSpace: 'nowrap' }}>
              <strong style={{ display: 'inline-block', width: MM(4) }}>{c.code}:</strong>
              {c.meaning.toUpperCase()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SemesterBlock({
  s, ink, rule, brand, yearLabel, termLabel,
}: {
  s: TranscriptMasterData['years'][number]['semesters'][number];
  ink: string; rule: string; brand: string;
  yearLabel?: string; termLabel: string;
}) {
  // A TWO-ROW HEADER, as the original sets it. "Year One" sits ABOVE "Subject
  // Codes" and the term above "Name of Courses", while each numeric heading is
  // one tall cell spanning both rows. Flattening it to a single row of column
  // names — which is what the first version did — loses the thing that makes
  // this a register rather than a spreadsheet.
  const box = `0.4pt solid ${ink}`;
  const th: React.CSSProperties = {
    fontSize: '5.8pt', padding: '0.7mm 1mm', border: box, textAlign: 'left',
    color: ink, fontWeight: 700, verticalAlign: 'bottom', lineHeight: 1.15,
  };
  const td: React.CSSProperties = {
    fontSize: '7pt', padding: '0.5mm 1mm', color: ink,
    borderLeft: box, borderRight: box,
  };
  const num: React.CSSProperties = { ...td, textAlign: 'right' };
  const foot: React.CSSProperties = { ...td, fontWeight: 700, borderTop: box, borderBottom: box };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '17%' }} /><col />
        <col style={{ width: '9%' }} /><col style={{ width: '9%' }} />
        <col style={{ width: '9%' }} /><col style={{ width: '9%' }} /><col style={{ width: '10%' }} />
      </colgroup>
      <thead>
        <tr>
          {/* The year names the block; the term names the sitting. */}
          <th style={{ ...th, fontSize: '6.6pt', color: brand, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {yearLabel ?? ''}
          </th>
          <th style={{ ...th, fontSize: '6.6pt', color: brand }}>{termLabel}</th>
          <th style={{ ...th, textAlign: 'right' }} rowSpan={2}>Credit<br />Values</th>
          <th style={{ ...th, textAlign: 'right' }} rowSpan={2}>Grade</th>
          <th style={{ ...th, textAlign: 'right' }} rowSpan={2}>Credit<br />Earned</th>
          <th style={{ ...th, textAlign: 'right' }} rowSpan={2}>Credit<br />GPA</th>
          <th style={{ ...th, textAlign: 'right' }} rowSpan={2}>Grade<br />Points</th>
        </tr>
        <tr>
          <th style={th}>Subject<br />Codes</th>
          <th style={th}>Name of Courses</th>
        </tr>
      </thead>
      <tbody>
        {s.courses.map((c) => (
          <tr key={c.code}>
            <td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace' }}>{c.code}</td>
            <td style={td}>{c.title}</td>
            <td style={num}>{c.creditUnit}</td>
            <td style={num}>{c.grade}</td>
            {/* Credit earned is not credit value: a failed course is attempted
                and not earned, and the original prints both. */}
            <td style={num}>{c.gradePoint > 0 ? c.creditUnit : 0}</td>
            <td style={num}>{c.gradePoint > 0 ? c.creditUnit : 0}</td>
            {/* The grade point, not the quality point. */}
            <td style={num}>{c.gradePoint.toFixed(2)}</td>
          </tr>
        ))}
        {/* One closing row: credits on the left, the GPA on the right, both
            labelled — as the original rules it. */}
        <tr>
          <td colSpan={2} style={foot}>GPA Credit Earned</td>
          <td colSpan={2} style={{ ...foot, textAlign: 'right' }}>{s.totalCredits}</td>
          <td colSpan={2} style={foot}>Semester GPA</td>
          <td style={{ ...foot, textAlign: 'right' }}>{s.gpa.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Particular({
  label, value, rule, mono,
}: { label: string; value: React.ReactNode; rule: string; mono?: boolean }) {
  return (
    <tr>
      <th style={{
        textAlign: 'left', fontSize: '5pt', textTransform: 'uppercase', letterSpacing: '.06em',
        padding: '0.45mm 1.6mm 0.45mm 0', opacity: 0.7, fontWeight: 400,
        borderBottom: `0.2pt solid ${rule}33`, whiteSpace: 'nowrap',
      }}>{label}</th>
      <td style={{
        fontSize: '6.2pt', fontWeight: 700, padding: '0.45mm 0', whiteSpace: 'nowrap',
        borderBottom: `0.2pt solid ${rule}33`,
        fontFamily: mono ? 'ui-monospace, Menlo, monospace' : undefined,
      }}>{value || '—'}</td>
    </tr>
  );
}

function Legend({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: MM(88) }}>
      <p style={{ margin: 0, fontSize: '5pt', textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7 }}>
        {title}
      </p>
      <p style={{ margin: '0.5mm 0 0', fontSize: '5.2pt', lineHeight: 1.45 }}>{children}</p>
    </div>
  );
}

/** "One", "Two", "Three" — as the original labels its years. */
function inWords(n: number): string {
  return ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'][n] ?? String(n);
}
