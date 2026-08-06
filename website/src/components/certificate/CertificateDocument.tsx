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
import type { CredentialDesign } from '@/lib/credentialTemplate';
import {
  seedFrom, guillocheRosetteUri, guillocheBandUri, microtextBandUri,
  engravedSealUri, securityGroundUri, ordinalDay, yearInWords,
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
}

const PAGE_MM = {
  A4: { portrait: [210, 297], landscape: [297, 210] },
  Letter: { portrait: [216, 279], landscape: [279, 216] },
} as const;

const CertificateDocument = forwardRef<HTMLDivElement, {
  design: CredentialDesign;
  data: CertificateData;
  /** Version number, printed in the foot so a document names its own design. */
  version?: number;
}>(function CertificateDocument({ design, data, version }, ref) {
  const [w, h] = PAGE_MM[design.pageSize][design.orientation];
  const issued = data.issuedOn ?? new Date();
  const seed = seedFrom(data.credentialId || 'ICOFGU');
  const sec = design.security;

  // The sentence follows the kind of award. The template supplies the house
  // style; this supplies the three clauses that would otherwise be false on a
  // diploma ("the Degree of") or meaningless on a doctorate ("with Second Class
  // Honours"). See awards.ts.
  const aw = wordingForAward(data.degree);

  const given = `${design.wording.given} ${ordinalDay(issued.getDate())} Day of ` +
    `${issued.toLocaleDateString('en-GB', { month: 'long' })}, ${yearInWords(issued.getFullYear())}`;

  return (
    <div
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

      {/* Layer 1 — the guilloché rosette, large and faint, behind the text. */}
      {sec.guilloche && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          // Visible as texture, not as decoration competing with the text. Below
          // about 0.2 it disappears entirely on a laser printer, which is where
          // it matters most — a watermark nobody can see is not a watermark.
          opacity: sec.guillocheOpacity * 0.26,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={guillocheRosetteUri(seed, 520, design.brand, 1)}
            alt=""
            style={{ width: `${Math.min(w, h) * 0.78}mm`, height: `${Math.min(w, h) * 0.78}mm` }}
          />
        </div>
      )}

      {/* Layer 2 — the border. The outer rule, then a guilloché band, then a
          hairline: three edges a scan has to reproduce rather than one. */}
      {design.border !== 'none' && (
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

      {design.border !== 'none' && (
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
          fontSize: '30px',
          fontWeight: 400,
          letterSpacing: '0.16em',
          color: design.brand,
          textTransform: 'uppercase',
          lineHeight: 1.1,
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
          fontSize: '40px',
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

      </div>

        {/* ---- The foot: seal, signatures, verification ------------------- */}
        <div style={{
          marginTop: '6mm',
          width: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '8mm',
        }}>
          {/* The seal, drawn per document rather than a PNG anyone can download.
              See credentialArt.ts — it is geometry, not a file, so it cannot be
              lifted, and it is vector, so it holds at print resolution. */}
          <div style={{ width: '32mm', flex: '0 0 32mm', textAlign: 'left' }}>
            {design.showSeal && sec.engravedSeal && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={engravedSealUri(seed, 300, design.brand, design.accent,
                  UNIVERSITY.name.toUpperCase(), UNIVERSITY.shortName)}
                alt=""
                style={{ width: '30mm', height: '30mm', opacity: 0.95 }}
              />
            )}
          </div>

          <div style={{
            flex: '1 1 auto',
            display: 'flex',
            justifyContent: 'space-evenly',
            alignItems: 'flex-end',
            gap: '6mm',
          }}>
            {design.signatories.map((s, i) => (
              <div key={`${s.office}-${i}`} style={{ minWidth: '42mm' }}>
                <div style={{
                  borderTop: `0.3mm solid ${design.ink}`,
                  paddingTop: '1.6mm',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: design.ink,
                }}>
                  {s.name || nameForOffice(s.office)}
                </div>
                <div style={{ fontSize: '9.5px', opacity: 0.7, marginTop: '0.6mm' }}>{s.office}</div>
              </div>
            ))}
          </div>

          {/* Verification. The only thing on this page that settles the
              question, and it is printed as prominently as the seal. */}
          <div style={{ width: '32mm', flex: '0 0 32mm', textAlign: 'right' }}>
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
            <p style={{ fontSize: '6.5px', letterSpacing: '0.08em', margin: '1.2mm 0 0', opacity: 0.75 }}>
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
  );
});

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
 * A signatory left blank falls back to whoever currently holds that office.
 * Leaving the name empty in the template is the sensible default: the office
 * outlives the holder, and a certificate should not need republishing because a
 * Registrar retired.
 */
function nameForOffice(office: string): string {
  const o = office.toLowerCase();
  if (o.includes('vice chancellor')) return UNIVERSITY.viceChancellor;
  if (o.includes('registrar')) return UNIVERSITY.registrar;
  if (o.includes('academic affairs')) return UNIVERSITY.headOfAcademicAffairs;
  // Any other office — Chancellor, Dean, Provost — has no constant to fall back
  // on, so the template must name the holder. Returning empty leaves the rule
  // and the office, which is the honest failure: a blank name is visibly
  // unfinished, whereas a wrong name is not.
  return '';
}

export default CertificateDocument;
