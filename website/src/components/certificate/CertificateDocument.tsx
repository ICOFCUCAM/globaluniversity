// ---------------------------------------------------------------------------
// The award certificate.
//
// WHAT WAS WRONG WITH THE OLD ONE.
//
// It read like a notification. "This is to certify that … is hereby awarded the
// degree of" is passive and anonymous — nobody confers anything, no authority is
// named, and the document does not say what it IS. Fourteen lines of text were
// stacked at four different sizes with a boxed classification in the middle, and
// the result had the density of a form rather than the weight of an instrument.
//
// The universities whose certificates are recognised without argument — Oxford,
// Yale, Cambridge — do the opposite. Very few words, very large, a great deal of
// space, and the sentence names the body that confers, the authority it acts
// under, and the act itself. This one now reads:
//
//     The Senate of / ICOF GLOBAL UNIVERSITY / under the authority vested in it
//     and in recognition of the successful completion of the prescribed course
//     of study / confers upon / NAME / the Degree of / BACHELOR OF THEOLOGY /
//     with Second Class Honours (Upper Division) / Given this Fifth Day of
//     August, Two Thousand Twenty-Six
//
// The date is spelt out because a numeral is trivially altered and a spelt date
// is not, and because it is what the form has always done.
//
// THE SECURITY LAYERS ARE IN credentialArt.ts, WHICH IS HONEST ABOUT THEM.
// Guilloché, microtext, an engraved seal drawn per document, a patterned ground.
// None of it stops a determined forger. It raises the cost of a casual one and
// gives a registrar something concrete to look at. The control that actually
// decides authenticity is the credential id, the QR, and the issuance register
// behind /verify — and those are the ones a reader is told to use.
//
// EVERY LAYER IS SEEDED FROM THE CREDENTIAL ID, so the artwork is part of the
// document rather than a background applied to all of them: two certificates
// carry different rosettes, and the same certificate always carries its own.
// ---------------------------------------------------------------------------

import React, { forwardRef } from 'react';
import { UNIVERSITY } from '@/lib/constants';
import type { CredentialDesign, Signatory } from '@/lib/credentialTemplate';
import {
  seedFrom, guillocheRosetteUri, guillocheBandUri, microtextBandUri,
  securityGroundUri, ordinalDay, yearInWords,
  ornateFrameUri, waferSealUri,
} from '@/lib/credentialArt';
import { wordingForAward } from '@/lib/awards';

export interface CertificateData {
  fullName: string;
  programme: string;
  degree: string;
  classification: string;
  /**
   * The credential number, e.g. IGUC-BTH-26A9-F8K2-P19D.
   *
   * Never sequential. A sequential number tells a forger what the next one is
   * and tells anyone holding two certificates how many the university has ever
   * issued. The programme code and year are readable because they are useful to
   * a registrar; the rest is random, from /api/credential/issue.
   */
  credentialId: string;
  /** The seal in words, for a reader with no scanner. */
  sealCode?: string | null;
  /** Verification QR, as SVG markup. Rendered by the server that signed it. */
  qrSvg?: string | null;
  issuedOn?: Date;
  /**
   * A replacement for a lost or damaged original.
   *
   * The register has always allowed a credential to be superseded — 'replaced'
   * is one of its three statuses — but the document produced was identical to
   * the one it replaced, so two indistinguishable certificates for one award
   * could be in circulation with nothing on either to say which was which. A
   * university that cannot tell its own duplicate from its own original has
   * lost control of the count.
   *
   * Carries the original's number, because the point of a duplicate is that it
   * refers back.
   */
  duplicateOf?: string | null;
}

/**
 * The printed element's id.
 *
 * Fixed rather than generated, because the print rules above have to name it
 * and a rule cannot reference an id that changes per render. Only one
 * certificate is ever on screen at a time — it is a modal or a preview pane —
 * so a constant is safe and a duplicate would be a bug worth catching.
 */
const DOC_ID = 'icof-certificate';

const PAGE_MM = {
  A4: { portrait: [210, 297], landscape: [297, 210] },
  Letter: { portrait: [216, 279], landscape: [279, 216] },
} as const;

const CertificateDocument = forwardRef<HTMLDivElement, {
  design: CredentialDesign;
  data: CertificateData;
  /** Version number, printed in the foot so a document names its own design. */
  version?: number;
  /**
   * Studio only. Marks the area kept clear for the hand-affixed wafer so the
   * designer can see it. Never set when issuing: a keyline printed under a
   * wafer shows as a ring round its edge.
   */
  previewGuides?: boolean;
  /**
   * Overprint SPECIMEN across the face.
   *
   * Set for anything that is not an issued credential: the Studio preview, a
   * design under review, a sample. It is not decoration — a certificate is a
   * document whose whole value is that it cannot be produced casually, and a
   * system that lets a designer print an indistinguishable copy of one from a
   * preview pane has handed out a blank.
   */
  specimen?: boolean;
}>(function CertificateDocument({ design, data, version, previewGuides, specimen }, ref) {
  const [w, h] = PAGE_MM[design.pageSize][design.orientation];
  const issued = data.issuedOn ?? new Date();
  const seed = seedFrom(data.credentialId || 'ICOFGU');
  const sec = design.security;

  // The sentence follows the kind of award. The template supplies the house
  // style; this supplies the three clauses that would otherwise be false on a
  // diploma ("the Degree of") or meaningless on a doctorate ("with Second Class
  // Honours"). See awards.ts.
  const aw = wordingForAward(data.degree);

  // The signatories divide either side of the seal, as they do on the
  // university's own certificate: Chancellor and President to the left, Vice
  // Chancellor and Registrar to the right, with the wafer between them.
  const half = Math.ceil(design.signatories.length / 2);
  const leftSigs = design.signatories.slice(0, half);
  const rightSigs = design.signatories.slice(half);
  const reserved = design.sealPlacement !== 'printed';

  // Blackletter is set in mixed case, never capitals.
  //
  // Uppercase blackletter is close to unreadable — the capitals in a fraktur
  // face are elaborate display forms meant to open a word, not to stand in a
  // row of their own. The university's own first certificate sets the name as
  // "ICOF Global University" for exactly that reason, and forcing capitals here
  // would produce a title nobody could read at a glance.
  const blackletter = /unifraktur|fraktur|blackletter|old english|cloister/i
    .test(design.titleFont ?? '');

  // The name is set to fit, not to a fixed size.
  //
  // 40px suits "Grace Nalova Meyembi". It does not suit "Emmanuella Chiamaka
  // Nwachukwu-Adeyemi Oluwatosin", which at 40px is 300mm wide on a 297mm sheet
  // — so the one name on the document that must be legible was the one certain
  // to break it. Wrapping is worse than shrinking here: a conferral reads as one
  // line, and a name split across two on a degree certificate looks like a
  // mistake rather than a layout.
  //
  // The steps are coarse on purpose. Continuous scaling would give every
  // graduate a slightly different size, and a stack of certificates from one
  // ceremony should look like a set.
  const nameLength = data.fullName.trim().length;
  const nameSize = nameLength <= 22 ? 42
    : nameLength <= 30 ? 36
    : nameLength <= 40 ? 30
    : nameLength <= 52 ? 25
    : 21;

  const given = `${design.wording.given} ${ordinalDay(issued.getDate())} Day of ` +
    `${issued.toLocaleDateString('en-GB', { month: 'long' })}, ${yearInWords(issued.getFullYear())}`;

  return (
    <>
      {/* The page.
          Without this a browser prints an A4 landscape certificate onto
          portrait stock at its own default margins — so the document came out
          scaled, cropped at the frame, and centred on nothing. There is no way
          to set page size from an element; @page is the only mechanism, and it
          has to be emitted alongside the document rather than sit in a global
          stylesheet, because the size follows the design the Superadministrator
          chose.

          margin: 0 because the certificate IS the page. Its frame runs to the
          sheet edge, and any margin the browser adds is white paper outside a
          border that was drawn to be the border. */}
      <style>{`
        @media print {
          @page { size: ${design.pageSize} ${design.orientation}; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          #${DOC_ID}, #${DOC_ID} * { visibility: visible; }
          #${DOC_ID} {
            position: absolute; left: 0; top: 0;
            box-shadow: none !important;
          }
        }
      `}</style>
    <div
      id={DOC_ID}
      ref={ref}
      style={{
        width: `${w}mm`,
        height: `${h}mm`,
        fontFamily: design.fontFamily,
        position: 'relative',
        backgroundColor: design.paper,
        color: design.ink,
        boxSizing: 'border-box',
        overflow: 'hidden',
        // Backgrounds are the security layers. Browsers drop them when printing
        // unless told otherwise, and a security feature that vanishes on the
        // printed copy is not one.
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Layer 0 — the ground. Not a flat fill: a fine lattice with the
          university's initials worked into it, which photocopiers dither badly. */}
      {sec.securityGround && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${securityGroundUri(seed, 72, design.brand, UNIVERSITY.shortName, 0.05)}")`,
          backgroundRepeat: 'repeat',
        }} />
      )}

      {/* The clear zone for the hand-affixed wafer.
          The watermark was moved off it and the guilloché sized to clear it,
          but the security ground still tiled straight through — it is inset: 0
          — and so did the microtext course along the foot. Both would show as a
          ring of pattern round the edge of a wafer pressed over them, which is
          exactly the halo the reservation exists to prevent.

          A disc of paper, painted after the ground and before the text, is the
          simplest thing that cannot be got wrong by a later layer: anything
          drawn beneath it is hidden, and the text above it is unaffected. */}
      {reserved && sec.securityGround && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: `${design.borderWidthMm + 11}mm`,
            transform: 'translateX(-50%)',
            width: '36mm',
            height: '36mm',
            borderRadius: '50%',
            background: design.paper,
          }}
        />
      )}

      {/* Layer 1 — the guilloché rosette, large and faint, behind the text. */}
      {sec.guilloche && (
        <div style={{
          position: 'absolute',
          // Raised off centre. The lower middle is kept clear for the wafer, and
          // a watermark under it would show as a halo round the seal's edge.
          top: '40%', left: '50%',
          transform: 'translate(-50%, -50%)',
          // Visible as texture, not as decoration competing with the text. Below
          // about 0.2 it disappears entirely on a laser printer, which is where
          // it matters most — a watermark nobody can see is not a watermark.
          opacity: sec.guillocheOpacity * 0.19,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={guillocheRosetteUri(seed, 520, design.brand, 1)}
            alt=""
            // Sized and placed to clear the foot. The wafer is affixed in the
            // middle of that row, and a watermark reaching under it would show
            // as a halo round the seal's edge.
            style={{ width: `${Math.min(w, h) * 0.62}mm`, height: `${Math.min(w, h) * 0.62}mm` }}
          />
        </div>
      )}

      {/* Layer 2 — the frame.
          'ornate' is the engraved gilt border redrawn from the university's own
          first certificate: an outer fillet, a scroll-and-leaf course, a bead
          rule and a medallion at each corner. It is most of why that document
          reads as an instrument before a word of it has been read, and it is
          the largest single difference between it and the plain double rule
          this system was drawing.

          Redrawn, not traced. The original is a photograph of a printed sheet
          taken at an angle; re-using it would embed somebody's snapshot of a
          real graduate's certificate into every document the university issues. */}
      {design.border === 'ornate' && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${ornateFrameUri(w, h, design.accent, '#8a6d1f', design.borderWidthMm)}")`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
        }} />
      )}
      {design.border !== 'none' && design.border !== 'ornate' && (
        <div style={{
          position: 'absolute', inset: 0,
          border: `${design.borderWidthMm}mm solid ${design.brand}`,
        }} />
      )}
      {/* A band of guilloché running round the frame, drawn as four strips.
          It was one filled box with a second box of paper laid over the middle
          to punch it out — and that opaque box painted over the ground and the
          rosette underneath, so the centre of every certificate came out blank.
          Four strips cover the ring and nothing else, which is what was wanted
          in the first place. mask-composite would be tidier but it is the kind
          of property that renders in one browser and not the next, and a
          security border that appears on some printers only is worse than one
          that is always there. */}
      {design.border === 'double' && sec.guilloche && (() => {
        const band = guillocheBandUri(seed ^ 0x51, 300, 14, design.accent, 0.9);
        const edge = design.borderWidthMm;
        const thick = 6;
        const common: React.CSSProperties = {
          position: 'absolute',
          backgroundImage: `url("${band}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: `auto ${thick}mm`,
          opacity: sec.guillocheOpacity,
        };
        return (
          <>
            <div style={{ ...common, top: `${edge}mm`, left: `${edge}mm`, right: `${edge}mm`, height: `${thick}mm` }} />
            <div style={{ ...common, bottom: `${edge}mm`, left: `${edge}mm`, right: `${edge}mm`, height: `${thick}mm` }} />
            <div style={{ ...common, top: `${edge + thick}mm`, bottom: `${edge + thick}mm`, left: `${edge}mm`, width: `${thick}mm` }} />
            <div style={{ ...common, top: `${edge + thick}mm`, bottom: `${edge + thick}mm`, right: `${edge}mm`, width: `${thick}mm` }} />
          </>
        );
      })()}

      {design.border !== 'none' && design.border !== 'ornate' && (
        <div style={{
          position: 'absolute',
          inset: `${design.borderWidthMm + 7.5}mm`,
          border: `0.4mm solid ${design.accent}`,
        }} />
      )}

      {/* Layer 3 — microtext. Reads under a loupe, smears on a photocopier, and
          repeats this certificate's own id so a band lifted from a genuine scan
          carries the original's number into the forgery. */}
      {sec.microtextBorder && (
        <div style={{
          position: 'absolute',
          left: `${design.borderWidthMm + 8.5}mm`,
          right: `${design.borderWidthMm + 8.5}mm`,
          bottom: `${design.borderWidthMm + 5.4}mm`,
          height: '1.7mm',
          backgroundImage: `url("${microtextBandUri(
            `${UNIVERSITY.name.toUpperCase()} · ${data.credentialId}`, 300, 6, design.brand, 1.9,
          )}")`,
          backgroundRepeat: 'repeat-x',
          backgroundSize: 'auto 1.7mm',
        }} />
      )}

      {/* SPECIMEN.
          Drawn above every other layer and below nothing, at an opacity that
          survives a photocopy — the point of the mark is that it is still there
          on the copy somebody made of the copy. Rendered only when the caller
          asks for it: an issued certificate must never carry it, and a preview
          must never be without it. */}
      {specimen && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{
            transform: 'rotate(-24deg)',
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: `${Math.round(Math.min(w, h) * 0.42)}px`,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: '#b31217',
            opacity: 0.14,
            whiteSpace: 'nowrap',
          }}>
            SPECIMEN
          </span>
        </div>
      )}

      {/* ---- The instrument ---------------------------------------------- */}
      <div style={{
        position: 'relative',
        height: '100%',
        boxSizing: 'border-box',
        padding: `${design.borderWidthMm + 14}mm ${design.borderWidthMm + 20}mm ${design.borderWidthMm + 11}mm`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
      <div style={{
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      }}>
        <p style={{ ...small(design), margin: 0, letterSpacing: '0.28em' }}>
          {design.wording.senate}
        </p>

        <h1 style={{
          margin: '2.5mm 0 0',
          fontFamily: design.titleFont || design.fontFamily,
          fontSize: blackletter ? '44px' : '30px',
          fontWeight: 400,
          // Blackletter is drawn tight; the wide tracking that suits spaced
          // roman capitals pulls it apart into disconnected shapes.
          letterSpacing: blackletter ? '0.02em' : '0.16em',
          color: design.brand,
          textTransform: blackletter ? 'none' : 'uppercase',
          lineHeight: blackletter ? 1.05 : 1.1,
        }}>
          {UNIVERSITY.name}
        </h1>
        <p style={{ ...small(design), margin: '1.6mm 0 0', letterSpacing: '0.22em', opacity: 0.7 }}>
          {UNIVERSITY.descriptor}
        </p>

        <div style={{ width: '22mm', height: '0.4mm', background: design.accent, margin: '4mm 0 0' }} />

        <p style={{ ...body(design), margin: '5mm 0 0', maxWidth: '150mm', lineHeight: 1.7 }}>
          {design.wording.authority}
          <br />
          {aw.recognition}
        </p>

        <p style={{ ...small(design), margin: '5mm 0 0', letterSpacing: '0.3em' }}>
          {aw.confers}
        </p>

        {/* The name. The largest thing on the page by a wide margin — this is
            the one fact the document exists to state. */}
        <p style={{
          margin: '3mm 0 0',
          fontSize: `${nameSize}px`,
          lineHeight: 1.12,
          fontWeight: 400,
          letterSpacing: '0.05em',
          color: design.brand,
          textTransform: 'uppercase',
          maxWidth: '210mm',
        }}>
          {data.fullName}
        </p>

        <p style={{ ...small(design), margin: '5mm 0 0', letterSpacing: '0.3em' }}>
          {aw.lead}
        </p>

        <p style={{
          margin: '2.5mm 0 0',
          fontSize: '25px',
          fontWeight: 700,
          letterSpacing: '0.13em',
          color: design.brand,
          textTransform: 'uppercase',
          lineHeight: 1.2,
        }}>
          {data.degree}
        </p>

        {/* The field of study.
            `programme` was on CertificateData from the first version of this
            file, was passed in by both callers, and was never once rendered —
            so every certificate the system could produce named the award and
            omitted the subject. "Bachelor of Theology" is the degree; "in
            Theology" is what it is in, and a credential evaluator reads the
            second as carefully as the first. The university's own certificate
            carries it.

            Omitted when the programme merely repeats the award — "Bachelor of
            Theology, in Theology" is noise, not precision. */}
        {data.programme && !awardNamesProgramme(data.degree, data.programme) && (
          <p style={{ ...body(design), margin: '2mm 0 0', fontSize: '15px' }}>
            in {data.programme}
          </p>
        )}

        {aw.classified && data.classification && (
          // No box round it. The rule under the degree carries the eye down; a
          // bordered panel in the middle of a certificate reads as a form field.
          <p style={{ ...body(design), margin: '2.5mm 0 0', fontSize: '14px', fontStyle: 'italic' }}>
            {design.wording.classificationLead} {data.classification}
          </p>
        )}

        <p style={{ ...small(design), margin: '4.5mm 0 0', opacity: 0.85, maxWidth: '140mm' }}>
          {design.wording.privileges}
        </p>

        <p style={{ ...body(design), margin: '5mm 0 0', fontSize: '12.5px', fontStyle: 'italic' }}>
          {given}
        </p>

        {/* A duplicate says so on its face, and names what it replaces.
            Set plainly rather than as a stamp: it is a statement of fact about
            this copy, not an accusation about the holder, and most duplicates
            are issued because an original was lost in a house fire. */}
        {data.duplicateOf && (
          <p style={{
            ...small(design),
            margin: '3.5mm 0 0',
            letterSpacing: '0.2em',
            color: design.brand,
            opacity: 0.9,
          }}>
            Duplicate — issued in place of {data.duplicateOf}
          </p>
        )}

      </div>

        {/* ---- The foot: seal, signatures, verification ------------------- */}
        <div style={{
          marginTop: '6mm',
          width: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '5mm',
        }}>
          {/* The seal, drawn per document rather than a PNG anyone can download.
              See credentialArt.ts — it is geometry, not a file, so it cannot be
              lifted, and it is vector, so it holds at print resolution. */}
          {/* --- Signatures either side, the seal between -----------------
              This is the arrangement on the university's own certificate:
              Chancellor and President to the left, Vice Chancellor and
              Registrar to the right, with the wafer in the middle.

              The middle is left as clear paper. The university affixes a real
              foil wafer to the hard copy there, and a wafer pressed over
              printed artwork sits proud of it and shows a halo of whatever was
              underneath — so nothing is drawn in that area at all, not the
              watermark, not the guilloché, not a keyline. The dashed marker is
              a Studio guide and never prints. */}
          <SignatureColumn design={design} sigs={leftSigs} />

          <div style={{
            flex: '0 0 38mm',
            alignSelf: 'stretch',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: '2mm',
          }}>
            {reserved ? (
              previewGuides ? (
                <div style={{
                  width: '32mm', height: '32mm', borderRadius: '50%',
                  border: `0.4mm dashed ${design.accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  textAlign: 'center', fontSize: '6.5px', lineHeight: 1.25,
                  letterSpacing: '0.06em', color: design.accent,
                  fontFamily: 'Helvetica, Arial, sans-serif', padding: '2mm',
                }}>
                  SPACE RESERVED<br />FOR THE SEAL
                </div>
              ) : (
                <div style={{ width: '32mm', height: '32mm' }} />
              )
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={waferSealUri(seed, 300, design.sealColour || '#b31217',
                  `${UNIVERSITY.name.toUpperCase()} · `, UNIVERSITY.shortName)}
                alt=""
                style={{ width: '30mm', height: '30mm' }}
              />
            )}
          </div>

          <SignatureColumn design={design} sigs={rightSigs} />

          {/* Verification. The only thing on this page that settles the
              question, and printed as prominently as the seal. */}
          <div style={{ width: '26mm', flex: '0 0 26mm', textAlign: 'right' }}>
            {sec.qr && data.qrSvg ? (
              <div
                style={{ width: '22mm', height: '22mm', marginLeft: 'auto', background: '#fff', padding: '1mm' }}
                dangerouslySetInnerHTML={{ __html: data.qrSvg }}
              />
            ) : sec.qr ? (
              <div style={{
                width: '22mm', height: '22mm', marginLeft: 'auto',
                border: `0.3mm dashed ${design.ink}`, opacity: 0.4,
                fontSize: '6px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', textAlign: 'center', padding: '1mm',
              }}>
                NOT ISSUED — NO VERIFICATION CODE
              </div>
            ) : null}
            <p style={{ fontSize: '6px', letterSpacing: '0.06em', margin: '1.2mm 0 0', opacity: 0.75 }}>
              VERIFY AT {UNIVERSITY.website.toUpperCase()}/VERIFY
            </p>
          </div>
        </div>

        <p style={{
          fontSize: '7.5px',
          letterSpacing: '0.06em',
          margin: '3mm 0 0',
          opacity: 0.7,
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}>
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

/**
 * One column of signatories, stacked.
 *
 * Stacked rather than side by side because "ICOF Chancellor & International
 * Presiding Bishop" needs a line to itself at this size, and an office
 * abbreviated to fit is an office misnamed.
 */
function SignatureColumn({ design, sigs }: { design: CredentialDesign; sigs: Signatory[] }) {
  if (!sigs.length) return <div style={{ flex: '1 1 0' }} />;
  return (
    <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5mm' }}>
      {sigs.map((s, i) => (
        <div key={`${s.office}-${i}`}>
          <div style={{
            borderTop: `0.3mm solid ${design.ink}`,
            paddingTop: '1.5mm',
            fontSize: '10.5px',
            fontWeight: 700,
            color: design.ink,
          }}>
            {s.name || nameForOffice(s.office)}
          </div>
          <div style={{ fontSize: '8.5px', opacity: 0.72, marginTop: '0.4mm', lineHeight: 1.3 }}>
            {s.office}
          </div>
        </div>
      ))}
    </div>
  );
}

const body = (d: CredentialDesign): React.CSSProperties => ({
  fontSize: '13px',
  color: d.ink,
  lineHeight: 1.6,
});

const small = (d: CredentialDesign): React.CSSProperties => ({
  fontSize: '10px',
  color: d.ink,
  textTransform: 'uppercase',
  fontFamily: 'Helvetica, Arial, sans-serif',
});

/**
 * Does the award's own title already name the programme?
 *
 * "Bachelor of Theology" in "Theology" adds nothing and reads as a stutter on a
 * document with this much white space around it. "Bachelor of Arts" in
 * "Christian Counselling" is the case the line exists for.
 */
function awardNamesProgramme(award: string, programme: string): boolean {
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  const a = norm(award);
  const p = norm(programme);
  return !!p && a.includes(p);
}

/**
 * A signatory left blank falls back to whoever currently holds that office.
 * Leaving the name empty in the template is the sensible default: the office
 * outlives the holder, and a certificate should not need republishing because a
 * Registrar retired.
 */
function nameForOffice(office: string): string {
  const o = office.toLowerCase();
  // Order matters: 'vice chancellor' contains 'chancellor', so the narrower
  // office has to be tested first or the Vice Chancellor's rule would carry the
  // Chancellor's name.
  if (o.includes('vice chancellor')) return UNIVERSITY.viceChancellor;
  if (o.includes('chancellor')) return UNIVERSITY.chancellor;
  if (o.includes('president')) return UNIVERSITY.president;
  if (o.includes('registrar')) return UNIVERSITY.registrar;
  if (o.includes('academic affairs')) return UNIVERSITY.headOfAcademicAffairs;
  // Any other office — Chancellor, Dean, Provost — has no constant to fall back
  // on, so the template must name the holder. Returning empty leaves the rule
  // and the office, which is the honest failure: a blank name is visibly
  // unfinished, whereas a wrong name is not.
  return '';
}

export default CertificateDocument;
