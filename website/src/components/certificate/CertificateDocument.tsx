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

import React, { forwardRef, useMemo } from 'react';
import { UNIVERSITY } from '@/lib/constants';
import type { CredentialDesign, Signatory } from '@/lib/credentialTemplate';
import {
  seedFrom, guillocheRosetteUri, guillocheBandUri, microtextBandUri,
  securityGroundUri, ordinalDay, yearInWords,
  ornateFrameUri, waferSealUri, guillocheGlobeUri, globeInRosetteUri,
  institutionalDeviceUri,
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
  /**
   * The university's own registration reference, e.g. ICOFGU/BA202308.
   *
   * Distinct from the credential number and printed alongside it, because they
   * answer different questions. The credential number is the verification key —
   * random, unguessable, meaningless to a human. The registration reference is
   * the university's filing: it says which award and which year, and it is what
   * a registrar quotes when pulling the paper file. The 2011 certificate
   * carries one and this system had no field for it.
   */
  registrationNo?: string | null;
  /**
   * The title of the thesis, for a research degree.
   *
   * A doctorate is not conferred on a programme, it is conferred on a piece of
   * work — and the certificate for one that does not name the work is missing
   * the thing that distinguishes it from every other doctorate the university
   * has awarded. Ignored for taught awards, where there is no thesis and a
   * blank line would be a gap in the middle of the conferral.
   */
  thesisTitle?: string | null;
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

  // A certificate with no credential number cannot be verified by anyone who
  // receives it, and the number is what seeds every security layer on it — so
  // without one the guilloché, the wafer and the microtext are identical on
  // every document the university produces, which is worse than having none.
  //
  // It used to fall back to seeding from the literal string 'ICOFGU' and print
  // a blank where the number goes. That failed silently, in the one direction
  // that matters: the document still looked exactly like a certificate.
  const missingId = !data.credentialId?.trim();

  // Bleed and trim. See CredentialDesign.bleedMm.
  //
  // The sheet is drawn oversize by the bleed on every side and the artwork runs
  // into it, so a guillotine falling a millimetre inside the trim line still
  // cuts through printed frame rather than through white paper. The trim marks
  // sit in the bleed area itself, which is the part that gets cut away — a mark
  // inside the trim would be printed on the finished certificate.
  const bleed = Math.max(0, design.bleedMm ?? 0);
  const sheetW = w + bleed * 2;
  const sheetH = h + bleed * 2;
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

  // The name is set to fit the sheet it is printed on.
  //
  // 40px suits "Grace Nalova Meyembi" on a landscape A4. It does not suit
  // "Emmanuella Chiamaka Nwachukwu-Adeyemi Oluwatosin", and it does not suit
  // either of them on a PORTRAIT sheet, which is 87mm narrower — the first
  // version of this counted characters and ignored the page, so a perfectly
  // ordinary three-part name broke onto two lines in portrait while the code
  // was satisfied it had fitted.
  //
  // Wrapping is worse than shrinking: a conferral reads as one line, and a name
  // split across two on a degree certificate looks like a mistake rather than a
  // layout.
  //
  // 0.75em average advance. MEASURED, not guessed: uppercase Georgia with the
  // 0.05em tracking this line carries runs 0.66–0.70em for ordinary names and
  // 0.99em for a name of nothing but Ws. 0.75 clears the realistic range with
  // enough margin that a wide name shrinks a step early rather than overrunning
  // — the failure modes are not symmetrical. A name one step too small is
  // slightly quiet; a name one step too large wraps, and a conferral split
  // across two lines reads as a mistake.
  //
  // Estimating rather than measuring in the DOM is deliberate: measurement does
  // not work during server rendering, and it would make the document's layout
  // depend on when it happened to be rendered.
  const printableMm = w - 2 * (design.borderWidthMm + 20);
  const printablePx = printableMm * 3.7795;
  const nameChars = Math.max(1, data.fullName.trim().length);
  const LADDER = [42, 38, 34, 30, 26, 22, 19];
  const nameSize = LADDER.find((size) => nameChars * size * 0.75 <= printablePx)
    ?? LADDER[LADDER.length - 1];

  const given = `${design.wording.given} ${ordinalDay(issued.getDate())} Day of ` +
    `${issued.toLocaleDateString('en-GB', { month: 'long' })}, ${yearInWords(issued.getFullYear())}`;

  // The artwork, computed once per set of inputs rather than per render.
  //
  // Each of these traces thousands of points, serialises an SVG and base64s it:
  // the rosette alone is three bands of sixteen curves at 110 steps a petal,
  // and the frame carries a pattern tile plus four medallions. They were all
  // being rebuilt on every render — so in the Studio, where the design changes
  // on every keystroke of a colour field, the whole set was regenerated for each
  // character typed, and the preview visibly stuttered.
  //
  // The dependencies are the values the artwork is actually derived from. Seed
  // is in every one of them because the artwork is per-credential by design:
  // two certificates carry different figures, and memoising across them would
  // be the bug this list prevents.
  const art = useMemo(() => ({
    ground: securityGroundUri(seed, 72, design.brand, UNIVERSITY.shortName, 0.05),
    // The watermark figure. 'globe-in-rosette' is the university's own mark;
    // see CredentialDesign.security.watermark for why a globe and not more
    // rosette.
    rosette: sec.watermark === 'device'
      ? institutionalDeviceUri(seed, 600, design.brand, [
          UNIVERSITY.name.toUpperCase(),
          UNIVERSITY.descriptor.toUpperCase(),
        ], romanYear(UNIVERSITY.established), 1)
      : sec.watermark === 'globe'
        ? guillocheGlobeUri(seed, 520, design.brand, 1)
        : sec.watermark === 'rosette'
          ? guillocheRosetteUri(seed, 520, design.brand, 1)
          : globeInRosetteUri(seed, 560, design.brand, 1),
    // Sheet size and a band widened by the bleed, so the trim falls through
    // the gilt rather than beside it.
    frame: ornateFrameUri(sheetW, sheetH, design.accent, '#8a6d1f', design.borderWidthMm + bleed),
    band: guillocheBandUri(seed ^ 0x51, 300, 14, design.accent, 0.9),
    // The microtext course now carries the university's own words as well as
    // the credential number. Under a loupe it reads as the institution; on a
    // photocopy it is a grey smear. Both of those are the point.
    micro: microtextBandUri(
      [
        UNIVERSITY.name.toUpperCase(),
        UNIVERSITY.descriptor.toUpperCase(),
        UNIVERSITY.motto.toUpperCase(),
        data.credentialId,
      ].join(' · '),
      300, 6, design.brand, 1.9,
    ),
    wafer: waferSealUri(seed, 300, design.sealColour || '#b31217',
      `${UNIVERSITY.name.toUpperCase()} · `, UNIVERSITY.shortName),
  }), [
    seed, sheetW, sheetH, bleed, design.brand, design.accent, design.borderWidthMm,
    design.sealColour, data.credentialId, sec.watermark,
  ]);

  if (missingId && !specimen) {
    return (
      <div
        ref={ref}
        role="alert"
        style={{
          width: `${w}mm`, height: `${h}mm`, boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '30mm', textAlign: 'center',
          fontFamily: design.fontFamily, background: '#fffaf0',
          border: '2mm solid #b45309', color: '#7c2d12',
        }}
      >
        <div>
          <p style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
            No certificate can be rendered
          </p>
          <p style={{ fontSize: '13px', lineHeight: 1.6, margin: '6mm 0 0' }}>
            This document has no credential number. A certificate without one cannot be verified by
            anyone who receives it, and the number is what seeds the guilloché, the wafer and the
            microtext — without it every certificate the university issues would carry identical
            security artwork. Issue the credential through the register first.
          </p>
        </div>
      </div>
    );
  }

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
          @page { size: ${bleed ? `${sheetW}mm ${sheetH}mm` : `${design.pageSize} ${design.orientation}`}; margin: 0; }
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
      // The document announces what it is and what it says.
      //
      // It was a stack of unlabelled divs: a screen reader met an image with no
      // alt, then a heading, then loose paragraphs, and could not tell that any
      // of it was a certificate — let alone whose. Graduates read their own
      // credentials, and some of them do it with a screen reader.
      //
      // `article` rather than a bare region: it is a self-contained document,
      // which is precisely what the role means.
      role="article"
      lang="en"
      aria-label={
        `${data.duplicateOf ? 'Duplicate degree certificate' : 'Degree certificate'} of ` +
        `${UNIVERSITY.name}, conferring ${data.degree}` +
        `${aw.classified && data.classification ? ` with ${data.classification}` : ''}` +
        ` upon ${data.fullName}. Credential number ${data.credentialId}.`
      }
      style={{
        // The document is drawn at the BLEED size, not the trim size, and the
        // frame is inset by the bleed — so the gilt runs off every edge and the
        // trim falls through it.
        width: `${sheetW}mm`,
        height: `${sheetH}mm`,
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
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${art.ground}")`,
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
            bottom: `${bleed + design.borderWidthMm + 11}mm`,
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
        <div aria-hidden="true" style={{
          position: 'absolute',
          // Raised off centre. The lower middle is kept clear for the wafer, and
          // a watermark under it would show as a halo round the seal's edge.
          top: '40%', left: '50%',
          transform: 'translate(-50%, -50%)',
          // Visible as texture, not as decoration competing with the text. Below
          // about 0.2 it disappears entirely on a laser printer, which is where
          // it matters most — a watermark nobody can see is not a watermark.
          // A graticule needs more weight than a rosette to read at the same
          // distance: sixteen overlapping curves make a mass, seven separate
          // meridians do not.
          opacity: sec.guillocheOpacity * (sec.watermark === 'rosette' ? 0.19 : 0.30),
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={art.rosette}
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
      {/* Drawn at the SHEET size, not the trim size, and the band is widened by
          the bleed. So the gilt starts at the very edge of the oversize sheet
          and the guillotine cuts THROUGH it — which is the whole point. Insetting
          the frame to the trim line, as this first did, left blank paper in the
          bleed area and reproduced exactly the white sliver bleed exists to
          prevent. After trimming, the visible band is borderWidthMm again. */}
      {design.border === 'ornate' && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${art.frame}")`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
        }} />
      )}
      {design.border !== 'none' && design.border !== 'ornate' && (
        <div style={{
          position: 'absolute', inset: 0,
          border: `${design.borderWidthMm + bleed}mm solid ${design.brand}`,
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
        const band = art.band;
        const edge = bleed + design.borderWidthMm;
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
          inset: `${bleed + design.borderWidthMm + 7.5}mm`,
          border: `0.4mm solid ${design.accent}`,
        }} />
      )}

      {/* Layer 3 — microtext. Reads under a loupe, smears on a photocopier, and
          repeats this certificate's own id so a band lifted from a genuine scan
          carries the original's number into the forgery. */}
      {sec.microtextBorder && (
        <div aria-hidden="true" style={{
          position: 'absolute',
          left: `${bleed + design.borderWidthMm + 8.5}mm`,
          right: `${bleed + design.borderWidthMm + 8.5}mm`,
          bottom: `${bleed + design.borderWidthMm + 5.4}mm`,
          height: '1.7mm',
backgroundImage: `url("${art.micro}")`,
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
        <div role="note" aria-label="Specimen — not an issued credential" style={{
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
      {/* Trim marks, in the bleed area — which is the part that gets cut off.
          A mark drawn inside the trim line would be printed on the finished
          certificate, which is the mistake this is most often made with. */}
      {bleed > 0 && previewGuides !== true && (
        <div aria-hidden="true">
          {([[0, 0], [1, 0], [0, 1], [1, 1]] as [number, number][]).map(([xi, yi]) => (
            <React.Fragment key={`${xi}-${yi}`}>
              <div style={{
                position: 'absolute', background: '#000',
                width: `${Math.max(2, bleed - 1)}mm`, height: '0.2mm',
                [xi ? 'right' : 'left']: 0,
                top: `${bleed + (yi ? h : 0)}mm`,
              }} />
              <div style={{
                position: 'absolute', background: '#000',
                height: `${Math.max(2, bleed - 1)}mm`, width: '0.2mm',
                [yi ? 'bottom' : 'top']: 0,
                left: `${bleed + (xi ? w : 0)}mm`,
              }} />
            </React.Fragment>
          ))}
        </div>
      )}

      <div style={{
        position: 'relative',
        height: '100%',
        boxSizing: 'border-box',
        padding: `${bleed + design.borderWidthMm + 14}mm ${bleed + design.borderWidthMm + 20}mm ${bleed + design.borderWidthMm + 11}mm`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
      {/* The conferral, optically centred rather than mathematically.
          `justify-content: center` puts the block in the middle of the space
          left after the foot, which on a landscape sheet is close enough. On a
          portrait sheet — 87mm taller and no wider — it left a hand's width of
          empty paper between the date and the signatures, and the text sat high
          with nothing under it.

          Centring on the optical centre instead: slightly above the true middle,
          which is where the eye expects the mass of a framed document to sit.
          The extra space then falls above and below in the proportion a
          typographer would have set it. */}
      <div style={{
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingBottom: h > w ? '6%' : '0',
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

        {/* The thesis, for a research degree.
            A doctorate is conferred on a body of work, not on a programme, and
            a doctoral certificate that does not name the work omits the one
            thing that distinguishes it from every other doctorate the
            university has awarded. Set in italic quotation, as a title is. */}
        {aw.namesThesis && data.thesisTitle && (
          <p style={{
            ...body(design),
            margin: '3mm 0 0',
            fontSize: '12px',
            fontStyle: 'italic',
            maxWidth: '190mm',
            lineHeight: 1.45,
          }}>
            for the thesis “{data.thesisTitle}”
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

        {/* The attestation, then the date.
            "In witness whereof" is the clause that makes the signatures and
            seal below it operative — the sentence in which the named officers
            attest. Without it four signatures sit under a statement nobody has
            said they are vouching for. It runs into the date because they are
            one sentence: we have placed our names and seal, given this day. */}
        <p style={{
          ...body(design),
          margin: '5mm 0 0',
          fontSize: '11.5px',
          maxWidth: '175mm',
          lineHeight: 1.55,
        }}>
          {design.wording.attestation}
          {design.wording.attestation?.trim() ? ', ' : ''}
          <span style={{ fontStyle: 'italic' }}>{given.charAt(0).toLowerCase() + given.slice(1)}</span>
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
                src={art.wafer}
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
                style={{ width: '24mm', height: '24mm', marginLeft: 'auto', background: '#fff', padding: '1.2mm' }}
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

        {/* The foot, wrapping rather than overrunning.
            Five values were concatenated onto one line with no width limit: a
            footnote, the registration reference, the credential number, the
            seal and the design version. With the footnote left empty — as it is
            by default — that fits. Set a footnote of any length and the line
            runs off the sheet, silently, because nothing here was ever measured.

            The identifiers are grouped and set to wrap, and the footnote is
            given its own line: it is a sentence, and the codes are not. */}
        <div style={{
          margin: '3mm 0 0',
          maxWidth: '100%',
          fontFamily: 'Helvetica, Arial, sans-serif',
          opacity: 0.7,
        }}>
          {design.footnote && (
            <p style={{
              fontSize: '7.5px',
              letterSpacing: '0.04em',
              margin: '0 0 1mm',
              lineHeight: 1.4,
            }}>
              {design.footnote}
            </p>
          )}
          <p style={{
            fontSize: '7.5px',
            letterSpacing: '0.06em',
            margin: 0,
            lineHeight: 1.5,
            wordBreak: 'break-word',
          }}>
            {[
              data.registrationNo ? `REG. NO. ${data.registrationNo}` : null,
              `CREDENTIAL ${data.credentialId}`,
              data.sealCode ? `SEAL ${data.sealCode}` : null,
              version ? `DESIGN v${version}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
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

/**
 * The year of foundation, in roman.
 *
 * On a device rather than in the body text, where it would be affectation.
 * Every seal cut for a university since the fifteenth century carries the year
 * this way, and a device that carried 2007 in arabic numerals would look like a
 * logo rather than a seal.
 */
function romanYear(year: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = year;
  let out = '';
  for (const [value, sym] of table) {
    while (n >= value) { out += sym; n -= value; }
  }
  return out;
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
