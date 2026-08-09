// ---------------------------------------------------------------------------
// THE MASTER TRANSCRIPT — landscape, after the University's own instrument.
//
// NO 'use client' DIRECTIVE, DELIBERATELY. This component has no state, no
// effects and no handlers — it is a pure function of its props — and dropping
// the directive is what lets the DELIVERY ROUTE render it on the server with
// renderToStaticMarkup. That is the whole point: the sheet a registrar previews
// and the sheet a graduate receives by email are now the same code, not two
// implementations that drift.
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
import { GRADING_SCALE, MAX_GRADE_POINT } from '@/lib/grading';
import { specialGrades, courseClassification } from '@/content/regulations';
import type { CredentialDesign } from '@/lib/credentialTemplate';
import { paginate, transferAccepted } from '@/lib/transcriptMaster';
import type { TranscriptMasterData } from '@/lib/transcriptMaster';
import { profileFor } from '@/lib/transcriptTypes';

export type { TranscriptMasterData } from '@/lib/transcriptMaster';
import { seedFrom, securityGroundUri, microtextBandUri } from '@/lib/credentialArt';

/**
 * The registrar's codes, as the University PUBLISHES them.
 *
 * NOT AS THE 2017 SHEET ABBREVIATES THEM. That instrument prints 'A' for absent
 * and 'N' for no credit; the University's published regulations set the same
 * ideas as 'NG' (no grade) and 'NC' (no credit), and there is no 'A' at all.
 *
 * A legend on a transcript exists so a stranger can look a letter up. Printing
 * letters that do not appear in the regulations they would look them up in is
 * the one way a legend can be worse than no legend — so the regulations win,
 * and this reads from `src/content/regulations.ts` rather than holding a second
 * copy that can drift from it.
 */
export const REGISTRAR_CODES: { code: string; meaning: string }[] = specialGrades.map((g) => ({
  code: g.code,
  // The published meaning is a sentence; the sheet has room for the term.
  meaning: g.meaning.split('—')[0].trim(),
}));

/** How a course sits in the programme, from the same published source. */
export const COURSE_STANDING: { code: string; meaning: string }[] = courseClassification.map((c) => ({
  code: c.code,
  meaning: c.name,
}));

const MM = (n: number) => `${n}mm`;

/**
 * Where an image resolves from.
 *
 * '/images/site-icon.png' is right in a browser pointed at the site and wrong
 * everywhere else. An emailed transcript is opened from a desktop, often years
 * later, with no site behind it — so the delivery route passes an absolute
 * origin and the crest still arrives. Anything already absolute, including a
 * data: URI, is left exactly as it is.
 */
function asset(path: string, base?: string): string {
  if (!base) return path;
  if (/^[a-z]+:/i.test(path)) return path;
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

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
  const watermark = data.sealSrc ?? asset(IMAGES.seal, data.assetBase);

  const microtext = microtextBandUri(
    `${UNIVERSITY.name} · ${data.credentialId ?? 'SPECIMEN'} · `, 900, 10, design.accent, 3.4,
  );

  const ink = design.ink ?? '#241a30';
  const rule = design.accent ?? '#b99a3e';

  // PAGINATED BY YEAR, not by however many blocks happen to fit. A year is the
  // unit a transcript is read in, and a sheet that breaks Year Two across two
  // pages is one a registrar has to reassemble.
  //
  // THE RULE LIVES IN transcriptMaster.ts, not here, because the preview
  // wrappers need the sheet count to size their box — and a second copy of the
  // rule in a screen is how a preview ends up disagreeing with the document.
  //
  // AND THE CLOSING BLOCK IS NOT ALWAYS ONE SLOT. Once it carries transfer
  // credits, honours or a conferral it is three further ruled blocks, and it
  // takes a sheet of its own rather than being squeezed beside a year.
  const profile = profileFor(data.transcriptKind);
  const closingSlots =
    (data.transferCredits?.length ?? 0) > 0
    || (data.honours?.length ?? 0) > 0
    || (profile.showsGraduation && data.conferral)
    || (profile.showsStandingHistory && (data.standingHistory?.length ?? 0) > 0)
      ? 2 : 1;
  const sheets = paginate(data.years, closingSlots);

  return (
    <div id="icof-transcript" className="icof-document">
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
          /* A PREVIEW IS SCALED DOWN TO FIT A SCREEN. A PRINT IS NOT.
             Without this the sheet printed at whatever percentage the screen
             happened to be showing it at — a transcript on two-thirds of an A4
             page — because a transform on an ancestor scales the print too, and
             because it becomes the containing block for the absolute
             positioning above. Both are undone here. */
          .icof-scale { transform: none !important; }
          .icof-preview-box {
            width: auto !important; height: auto !important; overflow: visible !important;
          }
        }
      `}</style>

      {sheets.map((sheet, i) => (
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
          profile={profile}
          years={sheet.years}
          first={i === 0}
          last={sheet.closing}
          page={i + 1}
          of={sheets.length}
        />
      ))}
    </div>
  );
}

function Sheet({
  design, data, specimen, profile, ground, watermark, microtext, ink, rule,
  years, first, last, page, of,
}: {
  design: CredentialDesign;
  data: TranscriptMasterData;
  specimen?: boolean;
  profile: ReturnType<typeof profileFor>;
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
            // 7%. IT WAS 13, AND THAT WAS TOO MUCH — on a sheet where the
            // record ends halfway down, the device read as an illustration
            // rather than as the paper's own mark, and the University asked for
            // "a very light, large seal behind the academic table… it should
            // never interfere with reading the grades".
            opacity: 0.07,
          }}
        />
      </div>

      {data.superseded && <Overprint text="SUPERSEDED" colour="rgba(160,40,40,.15)" />}
      {specimen && <Overprint text="SPECIMEN" colour="rgba(120,40,40,.13)" />}
      {/* UNOFFICIAL and INTERNAL are bands, not footnotes. A copy whose status
          can be cropped off is a copy that will be. */}
      {!specimen && profile.overprint && (
        <Overprint text={profile.overprint} colour="rgba(120,40,40,.13)" />
      )}

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
        {/* THE RUNNING HEAD, ON EVERY SHEET INCLUDING THE FIRST.
            The 2017 instrument has none — its second page opens straight on
            Year Three — and I left it out for that reason. The University has
            since ruled otherwise, and it is right: pages are separated,
            photocopied and faxed one at a time, and a middle sheet with no
            institution, no student number and no page count is a sheet nobody
            can place. It names the document too, so an unofficial copy says
            what it is on every page rather than only the one carrying the
            band. */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: MM(4), fontSize: '6pt', fontFamily: TABLE_FACE, letterSpacing: '.02em',
          borderBottom: RULE, paddingBottom: MM(0.8), marginBottom: MM(1.2), flex: '0 0 auto',
        }}>
          <span><strong>{UNIVERSITY.name}</strong> — {profile.title}</span>
          <span>
            {data.studentNumber ? `Student No. ${data.studentNumber} · ` : ''}
            {data.credentialId ? `${data.credentialId} · ` : ''}
            Page {page} of {of}
          </span>
        </div>

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

        {/* WHAT THE READER IS HOLDING, IN A SENTENCE. Every kind has one. A
            document that does not say what it is invites the reader to assume
            the strongest reading of it, and for an unofficial copy that
            assumption is the whole risk. */}
        {first && (
          <p style={{
            margin: 0, borderLeft: RULE, borderRight: RULE, borderBottom: RULE,
            padding: '0.7mm 2mm', fontSize: '5.6pt', lineHeight: 1.4, flex: '0 0 auto',
            fontFamily: TABLE_FACE,
            background: profile.sealed ? 'transparent' : 'rgba(160,40,40,.06)',
          }}>
            {profile.statement}
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
        {/* THE RECORD TAKES THE HEIGHT IT NEEDS, no more. It used to be the
            flexible element, which pushed the totals to the bottom of the last
            sheet and left a hand's width of blank paper between the final
            Semester GPA row and the Study Total Credit line. The closing block
            below flexes instead: the totals follow the record, and only the
            signatures fall to the foot, where a signature belongs. */}
        <div style={{ flex: '0 0 auto', marginTop: MM(2), minHeight: 0 }}>
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
            <div style={{
              marginTop: MM(3), fontFamily: TABLE_FACE,
              flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0,
            }}>
              {/* --- Credits accepted from elsewhere ---------------------- */}
              {/* NOT FOLDED INTO A SEMESTER. These were taught and examined by
                  another institution; putting them in a semester table would
                  have this University reporting a mark it never awarded. They
                  are counted separately, and the institution is named, because
                  a credit with no source is one a receiving registrar cannot
                  weigh. */}
              {(data.transferCredits?.length ?? 0) > 0 && (
                <TransferBlock credits={data.transferCredits!} ink={ink} />
              )}

              {/* --- The summary a stranger reads first -------------------- */}
              <AcademicSummary data={data} ink={ink} brand={design.brand} />

              {/* --- Honours, recorded rather than computed ---------------- */}
              {(data.honours?.length ?? 0) > 0 && (
                <div style={{ marginTop: MM(2.5), border: RULE, padding: `${MM(1)} ${MM(2)}` }}>
                  <p style={{ margin: 0, fontSize: '6pt', letterSpacing: '.08em', opacity: 0.85 }}>
                    HONOURS AND DISTINCTIONS
                  </p>
                  {data.honours!.map((h, i) => (
                    <p key={`${h.title}-${i}`} style={{ margin: '0.4mm 0 0', fontSize: '7.4pt' }}>
                      <strong>{h.title}</strong>
                      {h.academicYear ? ` · ${h.academicYear}` : ''}
                      {h.awardedOn ? ` · awarded ${h.awardedOn}` : ''}
                    </p>
                  ))}
                </div>
              )}

              {/* --- The conferral, which is an act of the Senate ---------- */}
              {profile.showsGraduation && data.conferral && (
                <ConferralBlock conferral={data.conferral} brand={design.brand} />
              )}

              {/* --- Registry-only material ------------------------------- */}
              {profile.showsStandingHistory && (data.standingHistory?.length ?? 0) > 0 && (
                <div style={{ marginTop: MM(2.5), border: RULE, padding: `${MM(1)} ${MM(2)}` }}>
                  <p style={{ margin: 0, fontSize: '6pt', letterSpacing: '.08em', opacity: 0.85 }}>
                    ACADEMIC STANDING HISTORY — INTERNAL
                  </p>
                  {data.standingHistory!.map((e, i) => (
                    <p key={i} style={{ margin: '0.3mm 0 0', fontSize: '6.6pt' }}>
                      {e.decidedAt} · {e.from ? `${e.from} → ` : ''}{e.to} · {e.reason}
                    </p>
                  ))}
                </div>
              )}
              {profile.showsInternalNotes && data.internalNotes && (
                <p style={{
                  margin: `${MM(2)} 0 0`, border: RULE, padding: `${MM(1)} ${MM(2)}`,
                  fontSize: '6.6pt', lineHeight: 1.4,
                }}>
                  <strong>Registry note.</strong> {data.internalNotes}
                </p>
              )}

              {/* --- What a repeated course does to the average ------------ */}
              {/* PRINTED WHEN THE UNIVERSITY HAS A RULE, and printed as an
                  absence when it does not. A transcript showing one course
                  twice with two grades, silent on which counts, is a document
                  the reader has to guess at — and the two readings can differ
                  by a class of award. */}
              {hasRepeat(data) && (
                <p style={{
                  margin: `${MM(2)} 0 0`, fontSize: '5.8pt', lineHeight: 1.4, opacity: 0.9,
                }}>
                  <strong>Repeated courses. </strong>
                  {data.repeatRule
                    ?? 'This record contains more than one attempt at a course. The University has '
                     + 'not yet published a rule on how repeated attempts affect the cumulative '
                     + 'average, so every attempt shown is included in it.'}
                </p>
              )}

              {/* END OF RECORD. A registrar's convention, and not decoration:
                  it is what stops a sheet being added to a transcript after
                  issue. Without it, page 2 of 2 ending mid-table and page 2 of
                  3 look the same to a reader holding only the pages they were
                  given. */}
              <p style={{
                margin: `${MM(3)} 0 0`, fontSize: '6.4pt', letterSpacing: '.16em',
                textAlign: 'center', fontFamily: TABLE_FACE,
                borderTop: RULE, paddingTop: MM(1),
              }}>
                * * *  END OF TRANSCRIPT  * * *
              </p>

              {/* WHAT THIS DOCUMENT COVERS AND WHEN. A transcript is routinely
                  issued mid-programme — for a visa, a transfer, a scholarship —
                  and one that does not say so reads as a final record that is
                  mysteriously short. It also states the approval rule, because
                  a reader comparing this against another sheet needs to know
                  that marks still in the chain are absent by design. */}
              {/* AND IT MUST NOT CONTRADICT THE BLOCK ABOVE IT. This sentence
                  read "…not in itself a statement that an award has been
                  conferred" directly beneath a DEGREE AWARDED block stating the
                  conferral date and the Senate's resolution. One of the two was
                  wrong on every graduation transcript. The disclaimer belongs
                  to a record with no conferral on it, which is what it was
                  written for. */}
              <p style={{
                margin: `${MM(2)} 0 0`, fontSize: '5.6pt', lineHeight: 1.45,
                fontFamily: TABLE_FACE, opacity: 0.85,
              }}>
                This is the holder’s record as it stood on the date of issue, and covers only
                results approved by the University.
                {data.conferral
                  ? ' The award named above was conferred by the Senate on the date stated.'
                  : ' It is not in itself a statement that the programme has been completed or '
                    + 'that an award has been conferred.'}
              </p>

              {/* THE OFFICES, as the original closes: two named on the left,
                  the Registrar's signature line on the right. Every name comes
                  from the credential design, never from the reference sheet —
                  those officers held post in 2020 and may not now.
                  WITH A FALLBACK, because a design with no signatories was
                  printing an empty column where the offices belong. The
                  University's own record of who holds the two offices stands in
                  until the Studio's Signatures & seal panel is filled. */}
              {/* The gap that carries the signatures to the foot of the sheet. */}
              <div style={{ flex: '1 1 auto', minHeight: MM(6) }} />

              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-end', gap: MM(6),
              }}>
                <div style={{ fontSize: '9pt', fontWeight: 700 }}>
                  {signatoriesFor(design).map((sig, i) => (
                    <p key={`${sig.office}-${i}`} style={{ margin: i === 0 ? 0 : `${MM(3)} 0 0` }}>
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
    ...cell, fontSize: '5.6pt', fontWeight: 400, opacity: 0.9, textAlign: 'left',
    borderBottom: 'none', padding: '0.3mm 1.6mm 0',
  };
  const val: React.CSSProperties = {
    // THE VALUES FILL THE CELL. In the original the particulars are set large
    // and bold and the box is drawn to them; mine had small type floating in a
    // tall box, which is what "the characters completely fill this section"
    // was pointing at.
    //
    // 9pt, NOT 10. The grid now carries twelve particulars rather than eight —
    // nationality, campus, study mode and the admission date were added — and
    // at 10pt a long campus name pushed the block wider than the masthead.
    ...cell, fontSize: '9pt', fontWeight: 700, borderTop: 'none',
    padding: '0 1.6mm 0.4mm', whiteSpace: 'nowrap', letterSpacing: '.01em',
  };

  const profile = profileFor(data.transcriptKind);

  /** Two rows of the grid: four headings, then the four values under them. */
  const band = (cells: [string, React.ReactNode][], key: string) => (
    <React.Fragment key={key}>
      <tr>{cells.map(([label]) => <th key={label} style={lab}>{label}</th>)}</tr>
      <tr>
        {cells.map(([label, value]) => (
          <td
            key={label}
            style={label === 'Stu No'
              ? { ...val, fontFamily: 'ui-monospace, Menlo, monospace' }
              : val}
          >
            {value || '—'}
          </td>
        ))}
      </tr>
    </React.Fragment>
  );

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
        <img
          src={data.sealSrc ?? asset(IMAGES.seal, data.assetBase)}
          alt=""
          style={{ width: MM(21), height: MM(21), objectFit: 'contain' }}
        />
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
          margin: 0, fontSize: '21pt', letterSpacing: '.005em', fontWeight: 400,
          color: design.brand, lineHeight: 1.05, whiteSpace: 'nowrap',
        }}>
          {UNIVERSITY.name}
        </h1>
        <p style={{ margin: '1mm 0 0', fontSize: '10pt', color: ink, lineHeight: 1.15 }}>
          {UNIVERSITY.headquarters}
        </p>
        <p style={{ margin: '0.4mm 0 0', fontSize: '10pt', fontWeight: 700, color: ink, lineHeight: 1.15 }}>
          {UNIVERSITY.descriptor}
        </p>
        {/* THE TEACHING LOCATION, where it differs from the seat of the
            University. A receiving institution assessing the award needs to
            know where the study happened, and the name of the University alone
            does not answer it. */}
        {data.campus && (
          <p style={{ margin: '0.4mm 0 0', fontSize: '8pt', color: ink, lineHeight: 1.15, fontFamily: TABLE_FACE }}>
            Teaching location: {data.campus}
          </p>
        )}
      </div>

      <table style={{ borderCollapse: 'separate', borderSpacing: '0.5pt', flex: '0 0 auto' }}>
        <tbody>
          {band([
            ['Surname', data.student.last_name],
            ['First Names', data.student.first_name],
            ['Middle Name', (data.student as { middle_name?: string }).middle_name],
            ['Stu No', data.studentNumber ?? data.student.matric_no],
          ], 'names')}
          {band([
            ['Date of Birth', data.dateOfBirth],
            ['Place of Birth', data.placeOfBirth],
            ['Sex', data.sex],
            ['Nationality', data.nationality],
          ], 'birth')}
          {band([
            ['Admitted', data.admittedOn],
            ['Completed', data.completedOn],
            ['Study Mode', modeLabel(data.modeOfStudy)],
            ['Date of Issue', data.issuedOn],
          ], 'dates')}
        </tbody>
      </table>
      </div>

      {/* THE TITLE BAR — a narrow full-width bordered row, not a heading. It
          names the DOCUMENT rather than the genre, so an interim transcript and
          a final one are not both headed "Student Transcript". */}
      <div style={{
        borderLeft: RULE, borderRight: RULE, borderBottom: RULE,
        padding: '0.4mm 2mm', textAlign: 'center', fontSize: '8.5pt', letterSpacing: '.02em',
      }}>
        {profile.title}
      </div>

      {/* THE PROGRAMME, AS THREE THINGS AND NOT ONE.
          The award is the instrument, the programme is the field, the
          specialization is the concentration within it — and a sheet that
          prints only "Bachelor of Theology" leaves a receiving institution
          unable to tell a general degree from a specialised one. The University
          asked for this explicitly, and said why: it matters most once there
          are many specializations. */}
      <div style={{
        borderLeft: RULE, borderRight: RULE, borderBottom: RULE, display: 'flex',
      }}>
        <div style={{ flex: '1 1 0', padding: '0.4mm 2mm 0.7mm', textAlign: 'center', minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '5.8pt', opacity: 0.85 }}>Award Conferred / Programme of Study</p>
          <p style={{ margin: '0.2mm 0 0', fontSize: '13pt', fontWeight: 700, color: design.brand, lineHeight: 1.1 }}>
            {data.award || data.student.degree_type || data.student.program || data.department?.name}
          </p>
        </div>

        <div style={{
          flex: '0 0 30%', borderLeft: RULE, padding: '0.4mm 2mm 0.7mm', fontFamily: TABLE_FACE,
          fontSize: '6.4pt', lineHeight: 1.35, minWidth: 0,
        }}>
          <Field label="Programme" value={data.programme || data.student.program} />
          <Field label="Specialization" value={data.specialization} />
          <Field label="Faculty" value={data.faculty || data.department?.faculty} />
          <Field label="Academic Period" value={data.academicPeriod} />
        </div>

        <div style={{
          flex: '0 0 26%', borderLeft: RULE, padding: '0.4mm 2mm 0.7mm', fontFamily: TABLE_FACE,
          minWidth: 0,
        }}>
          <p style={{ margin: 0, fontSize: '6pt', opacity: 0.9 }}>Student Address</p>
          <p style={{ margin: '0.2mm 0 0', fontSize: '8.5pt', fontWeight: 700, lineHeight: 1.2 }}>
            {data.studentAddress || '—'}
          </p>
        </div>
      </div>
    </>
  );
}

/** A label and its value on one line, for the compact programme column. */
function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <p style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <span style={{ opacity: 0.8 }}>{label}: </span>
      <strong>{value || '—'}</strong>
    </p>
  );
}

/** The study mode in the words a reader outside the University uses. */
function modeLabel(mode: string | null | undefined): string {
  switch (mode) {
    case 'on-campus': return 'On-campus';
    case 'online':    return 'Online';
    case 'distance':  return 'Distance';
    case 'blended':   return 'Blended';
    default:          return '';
  }
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
/**
 * A subject code as the University prints it: the area, then the number,
 * standing in two columns.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT JUST A STRING IN A CELL
 * ---------------------------------------------------------------------------
 *
 * On the University's own transcript the code column is read down, not across.
 * The prefixes line up on the left and the numbers line up beside them:
 *
 *     BIS   220        BL    130
 *     BIS   230        BL    160
 *     MW    300        CED   110
 *     OTH   300        MDS   650
 *
 * That is what lets a registrar see at a glance that four of this semester's
 * courses are Biblical Studies, and it is the whole point of a scheme where the
 * prefix carries the meaning. Set as one string — "BIS 220", "MDS 650",
 * "OTH 300" — the numbers wander with the width of the letters and the column
 * reads as a list of tokens instead.
 *
 * A fixed inline-block for the area does it: every number starts at the same
 * place whatever the prefix, on screen and on paper, without a second real
 * column that would have to be threaded through every header and footer row.
 *
 * NOT MONOSPACE, which is what it used to be. The University's transcript is
 * set in one face throughout; a typewriter face in one column announces that a
 * computer wrote that column.
 *
 * A code with no area — a legacy BTH101, or something typed by hand into the
 * transcription screen — is printed exactly as given. Splitting it on a guess
 * would be rewriting somebody's archive to fit a layout.
 */
export function SubjectCode({ code }: { code?: string }) {
  if (!code) return null;
  const parts = /^([A-Za-z]{2,4})\s+(\S.*)$/.exec(code.trim());
  if (!parts) return <>{code}</>;
  return (
    <>
      {/* Wide enough for the longest area the University uses. At 4.6mm OTH
          and MDS ran straight into their numbers — "OTH300" — which is worse
          than not aligning at all, because it reads as a different code. */}
      <span style={{ display: 'inline-block', width: '6.4mm' }}>{parts[1]}</span>
      {parts[2]}
    </>
  );
}

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
      // ---------------------------------------------------------------------
      // SEPARATE, NOT COLLAPSED — AND THE DIFFERENCE IS THE WHOLE LOOK OF THE
      // SHEET.
      // ---------------------------------------------------------------------
      //
      // This was collapsed, with a comment defending it: "so the vertical
      // separators run continuously rather than doubling at every cell edge."
      // That was a preference, and the University's transcript is not built on
      // it. On the real sheet every cell is its own ruled box, so each boundary
      // between two cells is TWO hairlines with a thread of paper between them:
      //
      //     │ BIS  220 ││ Bible Survey I  ││ 3 │
      //                 ↑ two rules, not one
      //
      // Collapsing merges those into a single rule. It looks tidier and it
      // looks like a different institution's document — which is the one thing
      // a transcript may not do, because the grid is part of what a registrar
      // recognises before they read a word of it.
      //
      // The spacing runs BOTH WAYS. On the sheet the GPA band is a box with
      // paper showing above and below it, and the semester heading under it is
      // another box again. Horizontally it doubles the verticals; vertically it
      // costs a fraction of a millimetre of leading between course rows and
      // draws nothing there, because the body cells carry no top or bottom rule
      // — which is why the entries in a semester still run on unbroken.
      borderCollapse: 'separate',
      borderSpacing: '0.5pt',
      tableLayout: 'fixed',
      marginBottom: MM(2.5),
    }}>
      <colgroup>
        {[0, 1].map((i) => (
          <React.Fragment key={i}>
            {/* The code column holds an area and a number standing apart, so it
                is wider than a column holding one token would need to be —
                which is why the University's own sheet gives it the room. */}
            <col style={{ width: '8.4%' }} /><col style={{ width: '13.6%' }} />
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
                  <td style={td}><SubjectCode code={c?.code} /></td>
                  <td style={td}>{c?.title ?? ''}</td>
                  <td style={num}>{c ? c.creditUnit : ''}</td>
                  <td style={num}>{c ? c.grade : ''}</td>
                  {/* Credit earned is not credit value — a failed course is
                      attempted and not earned, and the original prints both. */}
                  <td style={num}>{c ? (c.gradePoint > 0 ? c.creditUnit : 0) : ''}</td>
                  {/* CREDIT GPA IS CREDIT × GRADE POINT — the quality point.
                      This column printed the credit earned a second time, so
                      two of the seven columns carried the same figure on every
                      row and the sheet lost the one number that lets a reader
                      check the Semester GPA for themselves: these sum to the
                      total the GPA is divided from. A column that duplicates
                      its neighbour is a column that says nothing. */}
                  <td style={num}>{c ? c.qualityPoint.toFixed(2) : ''}</td>
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

/**
 * Credits accepted from another institution.
 *
 * NAMED, NOT TOTALLED. "Transfer credit: 24" tells a receiving registrar
 * nothing they can act on; the institution and the course are what let them
 * decide whether to accept the same credit onward.
 */
function TransferBlock({
  credits, ink,
}: { credits: readonly NonNullable<TranscriptMasterData['transferCredits']>[number][]; ink: string }) {
  const th: React.CSSProperties = {
    fontSize: '5.8pt', fontWeight: 400, textAlign: 'left', padding: '0.4mm 1mm',
    borderBottom: RULE_MAJOR, borderLeft: RULE, borderRight: RULE, color: ink,
  };
  const td: React.CSSProperties = {
    fontSize: '7pt', padding: '0.3mm 1mm', borderLeft: RULE, borderRight: RULE, color: ink,
  };

  return (
    <table style={{
      width: '100%', borderCollapse: 'separate', borderSpacing: '0.5pt', tableLayout: 'fixed',
      fontFamily: TABLE_FACE, marginBottom: MM(2.5), border: RULE_MAJOR,
    }}>
      <colgroup>
        <col style={{ width: '26%' }} /><col style={{ width: '12%' }} />
        <col style={{ width: '34%' }} /><col style={{ width: '14%' }} />
        <col style={{ width: '14%' }} />
      </colgroup>
      <thead>
        <tr>
          <th style={th}>Transfer Credit — Institution</th>
          <th style={th}>Course Code</th>
          <th style={th}>Course Title</th>
          <th style={{ ...th, textAlign: 'right' }}>Credits Offered</th>
          <th style={{ ...th, textAlign: 'right' }}>Credits Accepted</th>
        </tr>
      </thead>
      <tbody>
        {credits.map((c, i) => (
          <tr key={`${c.institution}-${i}`}>
            <td style={td}>{c.institution}</td>
            <td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace' }}>{c.courseCode || '—'}</td>
            <td style={td}>{c.courseTitle}</td>
            <td style={{ ...td, textAlign: 'right' }}>{c.credits}</td>
            {/* A REFUSED CREDIT IS SHOWN AS REFUSED, not omitted and not zero.
                Zero reads as an arithmetic result; "not accepted" is a
                decision, and the student is entitled to see that it was made. */}
            <td style={{ ...td, textAlign: 'right' }}>
              {c.accepted ? c.creditsAccepted : 'not accepted'}
            </td>
          </tr>
        ))}
        <tr>
          <td colSpan={4} style={{ ...td, borderTop: RULE_MAJOR, fontWeight: 700, padding: '0.6mm 1mm' }}>
            Total transfer credit accepted toward the programme
          </td>
          <td style={{
            ...td, borderTop: RULE_MAJOR, fontWeight: 700, textAlign: 'right', padding: '0.6mm 1mm',
          }}>
            {transferAccepted(credits)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * The block an employer, a registrar or an immigration officer reads first.
 *
 * EVERY FIGURE IS LABELLED IN FULL. "Credits: 180" is ambiguous between
 * attempted and earned, and the difference is the entire question for a
 * student who has failed something. The GPA carries its scale — 3.42 out of
 * 4.00 — because a reader abroad cannot assume the denominator, and a 3.42
 * on a 5.00 scale is a different student.
 */
function AcademicSummary({
  data, ink, brand,
}: { data: TranscriptMasterData; ink: string; brand: string }) {
  const cell: React.CSSProperties = {
    fontSize: '7.4pt', padding: '0.5mm 2mm', borderLeft: RULE, borderRight: RULE, color: ink,
  };
  const head: React.CSSProperties = {
    // LEFT, EXPLICITLY. A `th` centres by default, so every heading floated
    // away from the figure beneath it and the block read as two unrelated rows.
    ...cell, fontSize: '5.8pt', fontWeight: 400, opacity: 0.85, borderBottom: 'none',
    padding: '0.5mm 2mm 0', textAlign: 'left',
  };
  const value: React.CSSProperties = {
    ...cell, fontWeight: 700, borderTop: 'none', padding: '0 2mm 0.6mm',
  };

  const transfer = transferAccepted(data.transferCredits);

  return (
    <div style={{ border: RULE_MAJOR, fontFamily: TABLE_FACE }}>
      <p style={{
        margin: 0, padding: '0.5mm 2mm', fontSize: '6.2pt', letterSpacing: '.1em',
        borderBottom: RULE, fontWeight: 700,
      }}>
        ACADEMIC SUMMARY
      </p>
      <table style={{
        width: '100%', borderCollapse: 'separate', borderSpacing: '0.5pt', tableLayout: 'fixed',
      }}>
        <tbody>
          <tr>
            <th style={head}>Credits attempted</th>
            <th style={head}>Credits earned</th>
            {/* AND WHETHER IT IS COUNTED IN THE TWO FIGURES TO ITS LEFT.
                It is not: those total the courses this University taught and
                examined. A reader who assumes otherwise is out by the whole
                transfer block. */}
            {transfer > 0 && <th style={head}>Transfer credit (not in the totals at left)</th>}
            <th style={head}>Cumulative GPA</th>
            <th style={head}>Academic standing</th>
            <th style={head}>Degree status</th>
          </tr>
          <tr>
            <td style={value}>{data.totalCredits}</td>
            <td style={value}>{data.creditsEarned ?? data.totalCredits}</td>
            {transfer > 0 && <td style={value}>{transfer}</td>}
            <td style={{ ...value, color: brand }}>
              {data.cgpa.toFixed(2)} / {MAX_GRADE_POINT.toFixed(2)}
            </td>
            {/* NOTHING, NOT "UNKNOWN", when the University has not assessed
                the record. See standingLabel. */}
            <td style={value}>{data.academicStanding || '—'}</td>
            <td style={value}>{data.degreeStatus || '—'}</td>
          </tr>
        </tbody>
      </table>
      {data.classification && (
        <p style={{
          margin: 0, padding: '0.5mm 2mm 0.8mm', fontSize: '8pt', fontWeight: 700,
          borderTop: RULE, color: brand,
        }}>
          Classification: {data.classification}
        </p>
      )}
    </div>
  );
}

/**
 * The conferral.
 *
 * THE SENATE'S DATE IS PRINTED BESIDE THE CONFERRAL DATE, because the Senate
 * resolving to confer is the authority for the award and the conferral is its
 * execution. A degree date with no resolution behind it is the University
 * asserting an award it cannot show it decided to make.
 */
function ConferralBlock({
  conferral, brand,
}: { conferral: NonNullable<TranscriptMasterData['conferral']>; brand: string }) {
  return (
    <div style={{
      marginTop: MM(2.5), border: RULE_MAJOR, padding: `${MM(1)} ${MM(2)}`,
      fontFamily: TABLE_FACE,
    }}>
      <p style={{ margin: 0, fontSize: '6.2pt', letterSpacing: '.1em', fontWeight: 700 }}>
        DEGREE AWARDED
      </p>
      <p style={{ margin: '0.5mm 0 0', fontSize: '11pt', fontWeight: 700, color: brand, lineHeight: 1.1 }}>
        {conferral.award}
      </p>
      <p style={{ margin: '0.5mm 0 0', fontSize: '7pt', lineHeight: 1.4 }}>
        Conferred {conferral.conferredOn}
        {conferral.senateApprovedOn && ` · by resolution of the Senate of ${conferral.senateApprovedOn}`}
        {conferral.convocationOn && ` · presented at convocation ${conferral.convocationOn}`}
        {conferral.classification && ` · ${conferral.classification}`}
      </p>
      {(conferral.graduationNumber || conferral.certificateCredentialId) && (
        <p style={{ margin: '0.3mm 0 0', fontSize: '6.2pt', fontFamily: 'ui-monospace, Menlo, monospace' }}>
          {conferral.graduationNumber && `Graduation no. ${conferral.graduationNumber}`}
          {conferral.graduationNumber && conferral.certificateCredentialId && ' · '}
          {conferral.certificateCredentialId && `Certificate ${conferral.certificateCredentialId}`}
        </p>
      )}
    </div>
  );
}

/** Is any course on this record sat more than once? */
function hasRepeat(data: TranscriptMasterData): boolean {
  const seen = new Set<string>();
  for (const y of data.years) {
    for (const sem of y.semesters) {
      for (const c of sem.courses) {
        if (seen.has(c.code)) return true;
        seen.add(c.code);
      }
    }
  }
  return false;
}

/**
 * The two offices printed at the close.
 *
 * The published design is the authority. When it names nobody — which is every
 * deployment until the Studio's Signatures & seal panel is filled in — the
 * University's own record of who holds the offices stands in, rather than the
 * sheet printing a blank where two names belong. Neither list is ever taken
 * from the 2017 reference scan.
 */
function signatoriesFor(design: CredentialDesign): { name: string; office: string }[] {
  const named = (design.signatories ?? []).filter((s) => s.name?.trim());
  if (named.length > 0) return named.slice(0, 2);
  return [
    { office: 'Vice-Chancellor', name: UNIVERSITY.viceChancellor },
    { office: 'Registrar', name: UNIVERSITY.registrar },
  ];
}

/** "One", "Two", "Three" — as the original labels its years. */
function inWords(n: number): string {
  return ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'][n] ?? String(n);
}


/**
 * The sheet, scaled to fit a screen.
 *
 * WHY THIS IS A COMPONENT AND NOT THREE INLINE WRAPPERS. Each screen that
 * previewed the transcript wrapped it in its own `transform: scale(...)`, and
 * each got the same two faults: a transform does not shrink the element's
 * layout box, so every preview left a screen's worth of blank space beneath it;
 * and a transform on an ancestor scales the PRINT as well, so pressing print
 * from a preview produced an A4 sheet with the transcript on two-thirds of it.
 *
 * The box below is sized from the same pagination the document uses, and the
 * print block above undoes both the scale and the box.
 */
export function TranscriptPreview({
  design, data, specimen, scale = 0.72,
}: {
  design: CredentialDesign;
  data: TranscriptMasterData;
  specimen?: boolean;
  scale?: number;
}) {
  const sheets = paginate(data.years).length;
  return (
    <div
      className="icof-preview-box"
      style={{
        width: `calc(297mm * ${scale})`,
        // 210mm of sheet plus the 6mm gap each one carries beneath it.
        height: `calc(216mm * ${sheets} * ${scale})`,
        overflow: 'hidden',
      }}
    >
      <div className="icof-scale" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <TranscriptMaster design={design} data={data} specimen={specimen} />
      </div>
    </div>
  );
}
