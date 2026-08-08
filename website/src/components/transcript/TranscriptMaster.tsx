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
import { UNIVERSITY, IMAGES } from '@/lib/constants';
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
  /** Printed beside the award, as the original sets it. */
  studentAddress?: string | null;
  superseded?: boolean;
}

const MM = (n: number) => `${n}mm`;

// ---------------------------------------------------------------------------
// THE REGISTRAR'S GRID
// ---------------------------------------------------------------------------
//
// A fine grey-black rule, not bold black — the University's specification,
// taken from its own instrument. I had this wrong three times running: dotted
// (that was the photocopier's broken edges), then light grey (that was the
// photocopier's cast), then pure black (an overcorrection).
//
// What it is: internal rules about 1px, clearly visible but restrained; major
// boundaries and the outer border slightly heavier. No rounded corners, no
// shadows, no colour, no dashes. A rigid rectangular grid that reads as
// professionally typeset paper.
//
// AND IT MUST NOT VANISH IN PRINT. Browsers drop light rules when printing
// unless colour adjustment is forced, which is how a grid that looks right on
// screen arrives at the registrar as floating columns of figures. The print
// block below forces it.
// ---------------------------------------------------------------------------
// THE REGISTRAR'S GRID — the University's specification
// ---------------------------------------------------------------------------
//
// A traditional registrar grid, not a modern spreadsheet or a card:
//
//   THIN SOLID MEDIUM-GREY rules carry the structure. One tone, not the
//   two-tone bevel I read into the magnified scan — that relief was the
//   photocopier and the JPEG, and chasing it produced a grid with the right
//   geometry and the wrong character.
//
//   VERTICAL SEPARATORS RUN CONTINUOUSLY the full height of the table, so
//   every column reads as an unbroken course of figures.
//
//   HORIZONTAL RULES ONLY WHERE STRUCTURE CHANGES — under the header, at a
//   semester heading, above the GPA summary. NOT between individual course
//   rows: the entries stay visually open, and the typography carries them.
//
//   MAJOR BOUNDARIES SLIGHTLY HEAVIER — the semester heading and the GPA
//   summary — so the eye finds the sections without the grid shouting.
//
// No rounded corners, shadows, gradients, colour or decoration anywhere.
const RULE = '0.5pt solid #a8a8a8';
/** Section boundaries and the outer border: the same grey, a shade stronger. */
const RULE_MAJOR = '0.7pt solid #8a8a8a';

/**
 * The table's typeface.
 *
 * ARIAL, NOT THE DOCUMENT'S SERIF — and this is the last thing that was
 * wrong. The original was produced in Microsoft Word, whose tables are set in
 * a sans-serif by default, and every figure and course name on it is Arial
 * while the masthead above stays serif. Setting the grid in Georgia made it
 * read as modern typesetting rather than as this instrument, whatever the
 * rules were doing.
 *
 * Helvetica and the generic sans follow it for machines without Arial, which
 * is most of the servers this renders on.
 */
const TABLE_FACE = 'Arial, Helvetica, "Liberation Sans", sans-serif';

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
  // THE WATERMARK, WHICH WAS MISSING ENTIRELY.
  //
  // The original carries a large central device across the whole sheet — the
  // globe, the ring of the University's words, the motto — printed pale enough
  // to read the marks through. What this had instead was the fine security
  // ground, a repeating tile, which is a different thing serving a different
  // purpose: the ground defeats a flatbed copier, the watermark says whose
  // document this is at arm's length. A transcript needs both.
  // THE UNIVERSITY'S OWN LOGO, from /public, not a generated device. Drawing a
  // globe of my own invention and calling it the watermark put a mark on the
  // document that is not the University's — which is the one thing a watermark
  // must never be.
  // site-icon.png — the Global Revival Network University seal, which is the
  // device the University's own transcript carries. IMAGES.logo is the ICOF
  // arms and a different mark; using it put the wrong seal behind the record.
  const watermark = IMAGES.seal;

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

  // THE LAST SHEET CARRIES THE CLOSING BLOCK, so it cannot also carry two full
  // years — the totals and the signatures then run off the foot of the page and
  // print over the final Semester GPA row. Seen in a render, not reasoned about.
  //
  // The University's own transcript has the same rhythm: two years on the first
  // sheet, the last year alone with the totals and the signatures on the second.
  const last = sheets[sheets.length - 1];
  if (last.length > 1) {
    sheets[sheets.length - 1] = last.slice(0, last.length - 1);
    sheets.push(last.slice(last.length - 1));
  }

  return (
    <div id="icof-transcript">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          #icof-transcript, #icof-transcript * { visibility: visible; }
          #icof-transcript { position: absolute; left: 0; top: 0; }
          /* WITHOUT THIS THE GRID DISAPPEARS. Browsers drop light rules and
             backgrounds when printing unless colour adjustment is forced, and
             a transcript that arrives as floating columns of figures with no
             grid is not a transcript. */
          #icof-transcript, #icof-transcript * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
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
          watermark={watermark}
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
  design, data, specimen, ground, watermark, microtext, ink, rule, years, first, last, page, of,
}: {
  design: CredentialDesign;
  data: TranscriptMasterData;
  specimen?: boolean;
  ground: string; watermark: string; microtext: string; ink: string; rule: string;
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

      {/* Centred, large, and behind everything. Sized to the sheet's height so
          it reads as the paper's own device rather than as an image dropped on
          top of the record. */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', pointerEvents: 'none', overflow: 'hidden',
      }}>
        <img
          src={watermark}
          alt=""
          style={{
            width: MM(165), height: MM(165), objectFit: 'contain',
            // Pale enough to read the marks through, present enough to be seen
            // at arm's length. The original sits at roughly this weight.
            opacity: 0.13,
          }}
        />
      </div>

      {data.superseded && <Overprint text="SUPERSEDED" colour="rgba(160,40,40,.15)" />}
      {specimen && <Overprint text="SPECIMEN" colour="rgba(120,40,40,.13)" />}

      <div style={{
        position: 'relative', border: RULE_MAJOR, padding: MM(3.5),
        height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      }}>
        {/* THE HEADER IS ON THE FIRST SHEET ONLY, as the original does it. A
            second page repeating the whole masthead wastes a third of the
            sheet; what it needs is enough to prove it belongs to the first,
            which is the running head below. */}
        {/* THE MASTHEAD IS ON SHEET ONE ONLY. The original's second page opens
            straight on the Year Three table with no header at all — a running
            head there would be furniture the instrument does not have. The
            credential number in the foot identifies the sheet. */}
        {first && <Masthead design={design} data={data} ink={ink} rule={rule} />}

        {/* THE FULL-WIDTH STRIP the original rules across under the masthead:
            what the institution is, and where to check it. */}
        {first && (
          <p style={{
            margin: 0, borderLeft: RULE, borderRight: RULE, borderBottom: RULE,
            padding: '0.7mm 2mm', fontSize: '6pt', textAlign: 'center', flex: '0 0 auto',
            fontFamily: TABLE_FACE,
          }}>
            {UNIVERSITY.name}. For more information, visit {UNIVERSITY.email} · {UNIVERSITY.website}
          </p>
        )}

        {first && <GradeSystem ink={ink} rule={rule} />}

        {first && data.transcribedFrom && (
          <p style={{
            margin: `${MM(1.8)} 0 0`, border: RULE_MAJOR, background: 'rgba(185,154,62,.08)',
            padding: `${MM(1.2)} ${MM(2)}`, fontSize: '5.8pt', lineHeight: 1.4,
          }}>
            <strong>Transcribed from an archived record.</strong> These marks were not recorded in
            the University’s current academic system and did not pass through its approval chain.
            Source: {data.transcribedFrom}. This document is sealed and may be verified; what it
            attests to is a faithful transcription of that record.
          </p>
        )}

        {/* --- The record: one ruled box per year ---------------------------- */}
        <div style={{ flex: '1 1 auto', marginTop: MM(2), minHeight: 0 }}>
          {years.map((y) => (
            <YearTable
              key={y.year}
              year={y.year}
              semesters={y.semesters}
              ink={ink}
              brand={design.brand}
              yearLabel={y.year ? `Year ${inWords(y.year)}` : 'Unplaced'}
            />
          ))}
        </div>

        {/* --- Closing block, on the last sheet only ----------------------- */}
        {last && (
          <>
            <div style={{ marginTop: MM(4), fontFamily: TABLE_FACE }}>
              <div style={{ display: 'flex', gap: MM(14), fontSize: '9pt', fontWeight: 700 }}>
                <span>Study Total Credit&nbsp;&nbsp;&nbsp;{data.totalCredits}</span>
                <span>Total Credit Earned&nbsp;&nbsp;&nbsp;{data.creditsEarned ?? data.totalCredits}</span>
              </div>
              <div style={{ marginTop: MM(3), fontSize: '11pt', fontWeight: 700 }}>
                Cumulative GPA&nbsp;&nbsp;&nbsp;&nbsp;{data.cgpa.toFixed(2)}
                {data.classification && (
                  <span style={{ marginLeft: MM(10), fontSize: '9pt' }}>{data.classification}</span>
                )}
              </div>

              {/* THE OFFICES, as the original closes: two named on the left,
                  the Registrar's signature line on the right. Every name comes
                  from the credential design, never from the reference sheet —
                  those officers held post in 2020 and may not now. */}
              <div style={{
                marginTop: MM(9), display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-end', gap: MM(6),
              }}>
                <div style={{ fontSize: '9pt', fontWeight: 700 }}>
                  {(design.signatories ?? []).slice(0, 2).map((sig, i) => (
                    <p key={`${sig.name}-${i}`} style={{ margin: i === 0 ? 0 : `${MM(3)} 0 0` }}>
                      {sig.office}: {sig.name}
                    </p>
                  ))}
                </div>

                <div style={{ textAlign: 'left', flex: '0 0 auto' }}>
                  <p style={{ margin: 0, fontSize: '9pt', fontWeight: 700, textAlign: 'center' }}>
                    Registrar
                  </p>
                  <p style={{ margin: `${MM(4)} 0 0`, fontSize: '9pt', fontWeight: 700 }}>
                    Signed<span style={{
                      display: 'inline-block', width: MM(46), borderBottom: `0.8pt solid ${ink}`,
                      marginLeft: MM(1),
                    }} />
                  </p>
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
                  <p style={{ margin: 0, fontSize: '5.2pt', opacity: 0.75 }}>
                    Version {data.version ?? 1} · verify at {UNIVERSITY.website}/verify
                  </p>
                </div>
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
    border: RULE, padding: '0.3mm 1.4mm', verticalAlign: 'top', fontFamily: TABLE_FACE,
  };
  const lab: React.CSSProperties = {
    ...cell, fontSize: '6pt', fontWeight: 400, opacity: 0.9, textAlign: 'left',
    borderBottom: 'none', padding: '0.35mm 1.6mm 0',
  };
  const val: React.CSSProperties = {
    // THE VALUES FILL THE CELL. In the original the particulars are set large
    // and bold and the box is drawn to them; mine had small type floating in a
    // tall box, which is what "the characters completely fill this section"
    // was pointing at.
    ...cell, fontSize: '10pt', fontWeight: 700, borderTop: 'none',
    padding: '0 1.6mm 0.5mm', whiteSpace: 'nowrap', letterSpacing: '.01em',
  };

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'stretch', flex: '0 0 auto',
        border: RULE,
      }}>
      {/* THE CREST, boxed, as the original opens. It was absent entirely —
          the one mark on the sheet that identifies the institution before a
          word of it is read. */}
      <div style={{
        flex: '0 0 auto', borderRight: RULE, padding: MM(0.8),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img src={IMAGES.seal} alt="" style={{ width: MM(21), height: MM(21), objectFit: 'contain' }} />
      </div>

      {/* CENTRED AND FILLING THE BOX, as the benchmark sets it — the name
          across the full width of the cell with the two address lines centred
          beneath it. Left-aligned, the block sat against one edge and left the
          rest of a wide cell empty, which is what "this information is supposed
          to fill the whole box" was pointing at. */}
      <div style={{
        flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', textAlign: 'center', padding: '0.8mm 2mm',
      }}>
        <h1 style={{
          margin: 0, fontSize: '23pt', letterSpacing: '.005em', fontWeight: 400,
          color: design.brand, lineHeight: 1.05, whiteSpace: 'nowrap',
        }}>
          {UNIVERSITY.name}
        </h1>
        <p style={{ margin: '1.1mm 0 0', fontSize: '11pt', color: ink, lineHeight: 1.15 }}>
          {UNIVERSITY.headquarters}
        </p>
        <p style={{ margin: '0.5mm 0 0', fontSize: '11pt', fontWeight: 700, color: ink, lineHeight: 1.15 }}>
          {UNIVERSITY.descriptor}
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

      {/* THE TITLE BAR — a narrow full-width bordered row, not a heading. */}
      <div style={{
        borderLeft: RULE, borderRight: RULE, borderBottom: RULE,
        padding: '0.4mm 2mm', textAlign: 'center', fontSize: '8.5pt', letterSpacing: '.02em',
      }}>
        Student Transcript
      </div>

      {/* THE DEGREE ROW — the award on the left, the holder's address on the
          right, both inside the same rectangular grid. */}
      <div style={{
        borderLeft: RULE, borderRight: RULE, borderBottom: RULE, display: 'flex',
      }}>
        <div style={{ flex: '1 1 0', padding: '0.4mm 2mm 0.7mm', textAlign: 'center', minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '5.8pt', opacity: 0.85 }}>Degree / Diploma Offered</p>
          <p style={{ margin: '0.2mm 0 0', fontSize: '14pt', fontWeight: 700, color: design.brand, lineHeight: 1.1 }}>
            {data.student.degree_type || data.student.program || data.department?.name}
          </p>
        </div>
        <div style={{
          flex: '0 0 42%', borderLeft: RULE, padding: '0.4mm 2mm 0.7mm', fontFamily: TABLE_FACE,
        }}>
          <p style={{ margin: 0, fontSize: '6pt', opacity: 0.9 }}>Student Address</p>
          <p style={{ margin: '0.2mm 0 0', fontSize: '10pt', fontWeight: 700, lineHeight: 1.15 }}>
            {data.studentAddress || '—'}
          </p>
        </div>
      </div>
    </>
  );
}

function GradeSystem({ ink, rule }: { ink: string; rule: string }) {
  // FIVE COLUMNS SPREAD EDGE TO EDGE, not a block bunched on the left with the
  // right half empty. The original distributes the key across the full width
  // of the sheet — the bands in three groups, the registrar's codes in the
  // centre under GRADE SYSTEM, and the standing codes hard right.
  const col: React.CSSProperties = {
    fontSize: '6pt', lineHeight: 1.5, fontFamily: TABLE_FACE, whiteSpace: 'nowrap',
    flex: '0 0 auto',
  };
  const head: React.CSSProperties = {
    margin: '0 0 0.3mm', fontSize: '6.4pt', letterSpacing: '.04em', fontWeight: 700,
  };
  const spacer = <p style={{ ...head, visibility: 'hidden' }}>&nbsp;</p>;

  // The bands as the original groups them: five, three, three.
  const g1 = GRADING_SCALE.slice(0, 5);
  const g2 = GRADING_SCALE.slice(5, 8);
  const g3 = GRADING_SCALE.slice(8);

  const band = (g: typeof GRADING_SCALE[number]) => (
    <div key={g.grade}>
      <strong style={{ display: 'inline-block', width: MM(5) }}>{g.grade}</strong>
      {g.gradePoint.toFixed(2)}GPA {g.minScore}–{g.maxScore}%
    </div>
  );

  return (
    <div style={{
      borderLeft: RULE, borderRight: RULE, borderBottom: RULE,
      padding: '0.8mm 2.5mm', display: 'flex', flex: '0 0 auto',
      // EDGE TO EDGE. This is the property that was wrong.
      justifyContent: 'space-between', alignItems: 'flex-start', gap: MM(2),
    }}>
      <div style={col}>{spacer}{g1.map(band)}</div>
      <div style={col}>{spacer}{g2.map(band)}</div>
      <div style={col}>
        <p style={head}>AVERAGE</p>
        {g3.map(band)}
      </div>
      <div style={col}>
        <p style={head}>GRADE SYSTEM</p>
        {REGISTRAR_CODES.slice(0, 5).map((c) => (
          <div key={c.code}>
            <strong style={{ display: 'inline-block', width: MM(6) }}>{c.code}</strong>
            0GPA&nbsp;&nbsp;{c.meaning.toUpperCase()}
          </div>
        ))}
      </div>
      <div style={col}>
        {spacer}
        {REGISTRAR_CODES.slice(5).map((c) => (
          <div key={c.code}>
            <strong style={{ display: 'inline-block', width: MM(5) }}>{c.code}</strong>
            0GPA&nbsp;&nbsp;{c.meaning.toUpperCase()}
          </div>
        ))}
        {COURSE_STANDING.map((c) => (
          <div key={c.code}>
            <strong style={{ display: 'inline-block', width: MM(5) }}>{c.code}:</strong>
            {c.meaning.toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One academic year: both semesters inside a SINGLE ruled box.
 *
 * ---------------------------------------------------------------------------
 * THE LINES ARE THE THING, AND THEY ARE NOT ORDINARY
 * ---------------------------------------------------------------------------
 *
 * Three properties of the original's ruling, each of which I had wrong before:
 *
 *   ONE BOX PER YEAR, NOT TWO. The first and second semesters share an outer
 *   border and a single full-width closing row that reads
 *   "GPA Credit Earned 24 · Semester GPA 2.96 · GPA Credit Earned 26 ·
 *   Semester GPA 3.25" straight across. Two side-by-side boxes with their own
 *   footers is a different document.
 *
 *   HAIRLINES. 0.25pt, not the 0.4pt I had. At 0.4 the grid dominates the
 *   figures; the original's rules are almost incidental, which is why the eye
 *   reads the marks first.
 *
 *   NO HORIZONTAL RULES BETWEEN COURSES. Verticals run the full height of the
 *   block, horizontals appear only under the header and above the footer, so
 *   each column reads as a continuous list of figures.
 */
function YearTable({
  year, semesters, ink, brand, yearLabel,
}: {
  year: number;
  semesters: TranscriptMasterData['years'][number]['semesters'];
  ink: string; brand: string; yearLabel: string;
}) {
  const hair = RULE;
  const th: React.CSSProperties = {
    fontSize: '6.2pt', padding: '0.55mm 1mm', textAlign: 'left',
    color: ink, fontWeight: 400, verticalAlign: 'bottom', lineHeight: 1.15,
    fontFamily: TABLE_FACE,
    // A semester heading is a major boundary: heavier above, and the header
    // closes with a heavier rule beneath it.
    borderTop: RULE_MAJOR,
    borderBottom: RULE_MAJOR,
    borderLeft: RULE,
    borderRight: RULE,
  };
  const td: React.CSSProperties = {
    fontSize: '7.4pt', padding: '0.32mm 1mm', color: ink, fontFamily: TABLE_FACE,
    // VERTICALS ONLY. No horizontal rule between course rows — the entries
    // stay open and the typography carries them.
    borderLeft: RULE,
    borderRight: RULE,
  };
  const num: React.CSSProperties = { ...td, textAlign: 'right' };
  const foot: React.CSSProperties = {
    ...td, fontSize: '7pt', padding: '0.7mm 1mm',
    // The GPA summary is a major boundary at both edges.
    borderTop: RULE_MAJOR,
    borderBottom: RULE_MAJOR,
  };

  const pair = [semesters[0], semesters[1]];
  const rows = Math.max(pair[0]?.courses.length ?? 0, pair[1]?.courses.length ?? 0);

  const headFor = (i: number, s?: typeof pair[number]) => (
    <>
      <th style={{ ...th, fontSize: '6pt', color: brand, borderTop: hair }}>
        {i === 0 ? yearLabel : `Year ${inWords(year)}`}
      </th>
      <th style={{ ...th, fontSize: '6pt', color: brand, borderTop: hair }}>
        {i === 0 ? 'First' : 'Second'} Semester
      </th>
      {['Credit\nValues', 'Grade', 'Credit\nEarned', 'Credit\nGPA', 'Grade\nPoints'].map((h) => (
        <th key={h} rowSpan={2} style={{ ...th, textAlign: 'right', borderTop: hair, borderBottom: hair }}>
          {h.split('\n').map((line, k) => <React.Fragment key={k}>{line}<br /></React.Fragment>)}
        </th>
      ))}
    </>
  );

  return (
    <table style={{
      width: '100%',
      // COLLAPSED, so the vertical separators run continuously the full
      // height of the table rather than doubling at every cell edge.
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
      marginBottom: MM(2.5),
    }}>
      <colgroup>
        {[0, 1].map((i) => (
          <React.Fragment key={i}>
            <col style={{ width: '7%' }} /><col style={{ width: '15%' }} />
            <col style={{ width: '5.6%' }} /><col style={{ width: '5%' }} />
            <col style={{ width: '5.6%' }} /><col style={{ width: '5.2%' }} />
            <col style={{ width: '5.6%' }} />
          </React.Fragment>
        ))}
      </colgroup>
      <thead>
        <tr>{headFor(0, pair[0])}{headFor(1, pair[1])}</tr>
        <tr>
          {[0, 1].map((i) => (
            <React.Fragment key={i}>
              <th style={{ ...th, borderBottom: hair }}>Subject<br />Codes</th>
              <th style={{ ...th, borderBottom: hair }}>Name of Courses</th>
            </React.Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r}>
            {[0, 1].map((i) => {
              const c = pair[i]?.courses[r];
              return (
                <React.Fragment key={i}>
                  <td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace' }}>{c?.code ?? ''}</td>
                  <td style={td}>{c?.title ?? ''}</td>
                  <td style={num}>{c ? c.creditUnit : ''}</td>
                  <td style={num}>{c ? c.grade : ''}</td>
                  {/* Credit earned is not credit value — a failed course is
                      attempted and not earned, and the original prints both. */}
                  <td style={num}>{c ? (c.gradePoint > 0 ? c.creditUnit : 0) : ''}</td>
                  <td style={num}>{c ? (c.gradePoint > 0 ? c.creditUnit : 0) : ''}</td>
                  {/* The grade point, not the quality point. */}
                  <td style={num}>{c ? c.gradePoint.toFixed(2) : ''}</td>
                </React.Fragment>
              );
            })}
          </tr>
        ))}
        {/* ONE ROW ACROSS BOTH SEMESTERS. */}
        <tr>
          {[0, 1].map((i) => (
            <React.Fragment key={i}>
              <td colSpan={2} style={foot}>GPA Credit Earned</td>
              <td style={{ ...foot, textAlign: 'right' }}>{pair[i]?.totalCredits ?? ''}</td>
              <td colSpan={3} style={foot}>Semester GPA</td>
              <td style={{ ...foot, textAlign: 'right' }}>{pair[i] ? pair[i]!.gpa.toFixed(2) : ''}</td>
            </React.Fragment>
          ))}
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
