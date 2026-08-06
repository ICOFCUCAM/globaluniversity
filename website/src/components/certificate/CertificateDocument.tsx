// ---------------------------------------------------------------------------
// The certificate itself, rendered from a design record rather than from fixed
// styles. Shared by the Certificate Generator (which issues) and the Credential
// Studio (which previews), so that what the Superadministrator sees while
// editing is the same component that later prints — not an approximation of it.
// ---------------------------------------------------------------------------

import React, { forwardRef } from 'react';
import { UNIVERSITY, IMAGES } from '@/lib/constants';
import type { CredentialDesign } from '@/lib/credentialTemplate';

export interface CertificateData {
  fullName: string;
  programme: string;
  degree: string;
  classification: string;
  serial: string;
  issuedOn?: Date;
}

const PAGE_MM = {
  A4: { portrait: [210, 297], landscape: [297, 210] },
  Letter: { portrait: [216, 279], landscape: [279, 216] },
} as const;

const CertificateDocument = forwardRef<HTMLDivElement, {
  design: CredentialDesign;
  data: CertificateData;
  /** Version number, printed in the serial line so a document names its design. */
  version?: number;
}>(function CertificateDocument({ design, data, version }, ref) {
  const [w, h] = PAGE_MM[design.pageSize][design.orientation];
  const issued = data.issuedOn ?? new Date();

  return (
    <div
      ref={ref}
      style={{
        width: `${w}mm`,
        height: `${h}mm`,
        padding: '15mm',
        fontFamily: design.fontFamily,
        position: 'relative',
        backgroundColor: design.paper,
        border: design.border === 'none' ? 'none' : `${design.borderWidthMm}mm solid ${design.brand}`,
        boxSizing: 'border-box',
      }}
    >
      {design.border === 'double' && (
        <>
          <div style={{
            position: 'absolute', top: '8mm', left: '8mm', right: '8mm', bottom: '8mm',
            border: `2px solid ${design.accent}`, borderRadius: '2px',
          }} />
          <div style={{
            position: 'absolute', top: '10mm', left: '10mm', right: '10mm', bottom: '10mm',
            border: `1px solid ${design.accent}`,
          }} />
        </>
      )}

      {design.showSeal && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: design.sealOpacity, zIndex: 0,
        }}>
          <img src={IMAGES.seal} alt="" style={{ width: '200px', height: '200px' }} />
        </div>
      )}

      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', padding: '10mm',
      }}>
        <img src={IMAGES.logo} alt="" style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', marginBottom: '10px' }} />

        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: design.brand, margin: 0, textTransform: 'uppercase', letterSpacing: '4px' }}>
          {UNIVERSITY.name}
        </h1>
        {/* The award is the document most likely to be read on another
            continent, years from now. It names the institution and its seat,
            not the campus the holder happened to attend. */}
        <p style={{ fontSize: '12px', color: design.ink, opacity: 0.75, margin: '4px 0 2px', letterSpacing: '2px' }}>
          {UNIVERSITY.descriptor}
        </p>
        <p style={{ fontSize: '10px', color: design.ink, opacity: 0.6, margin: '0 0 15px', letterSpacing: '1.5px' }}>
          {UNIVERSITY.headquarters}
        </p>

        <div style={{ width: '60px', height: '2px', backgroundColor: design.accent, margin: '5px auto' }} />

        <p style={{ fontSize: '14px', color: design.ink, margin: '15px 0 5px', letterSpacing: '3px', textTransform: 'uppercase' }}>
          {design.wording.certifyLine}
        </p>

        <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: design.brand, margin: '10px 0', fontStyle: 'italic', borderBottom: `2px solid ${design.accent}`, paddingBottom: '5px' }}>
          {data.fullName}
        </h2>

        <p style={{ fontSize: '13px', color: design.ink, margin: '8px 0', letterSpacing: '1px' }}>
          {design.wording.satisfiedLine}
        </p>
        <p style={{ fontSize: '13px', color: design.ink, margin: '4px 0', letterSpacing: '1px' }}>
          {design.wording.awardLine}
        </p>

        <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: design.brand, margin: '12px 0 5px', textTransform: 'uppercase', letterSpacing: '3px' }}>
          {data.degree}
        </h3>
        <p style={{ fontSize: '16px', color: design.ink, margin: '4px 0', fontWeight: 'bold' }}>
          in {data.programme}
        </p>

        <div style={{ margin: '12px 0', padding: '6px 30px', border: `2px solid ${design.accent}`, display: 'inline-block' }}>
          <p style={{ fontSize: '16px', fontWeight: 'bold', color: design.brand, margin: 0, letterSpacing: '2px' }}>
            {data.classification.toUpperCase()}
          </p>
        </div>

        <p style={{ fontSize: '11px', color: design.ink, opacity: 0.8, margin: '8px 0' }}>
          {design.wording.privilegesLine}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', marginTop: '20px', padding: '0 20mm', alignItems: 'flex-end' }}>
          {design.signatories.map((s, i) => (
            <React.Fragment key={`${s.office}-${i}`}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: `1px solid ${design.ink}`, width: '150px', paddingTop: '4px', fontSize: '11px', color: design.ink }}>
                  <strong>{s.name || nameForOffice(s.office)}</strong>
                  <p style={{ margin: '2px 0 0', opacity: 0.75 }}>{s.office}</p>
                </div>
              </div>
              {design.showSeal && i === 0 && design.signatories.length > 1 && (
                <div style={{ textAlign: 'center' }}>
                  <img src={IMAGES.seal} alt="" style={{ width: '60px', height: '60px', opacity: 0.8 }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {design.footnote && (
          <p style={{ fontSize: '10px', color: design.ink, opacity: 0.65, marginTop: '8px' }}>{design.footnote}</p>
        )}
        <p style={{ fontSize: '10px', color: design.ink, opacity: 0.6, marginTop: '10px' }}>
          Date: {issued.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          {' · '}Certificate No: {data.serial}
          {version ? ` · Design v${version}` : ''}
        </p>
      </div>
    </div>
  );
});

/**
 * A signatory left blank falls back to whoever currently holds that office.
 * Leaving the name empty in the template is the sensible default: the office
 * outlives the holder, and a certificate should not need republishing because
 * a Registrar retired.
 */
function nameForOffice(office: string): string {
  const o = office.toLowerCase();
  if (o.includes('vice chancellor')) return UNIVERSITY.viceChancellor;
  if (o.includes('registrar')) return UNIVERSITY.registrar;
  // Any other office — Chancellor, Dean, Provost — has no constant to fall back
  // on, so the template must name the holder. Returning empty leaves the rule
  // and the office, which is the honest failure: a blank name is visibly
  // unfinished, whereas a wrong name is not.
  return '';
}

export default CertificateDocument;
