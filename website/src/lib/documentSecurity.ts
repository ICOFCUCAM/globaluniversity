// ---------------------------------------------------------------------------
// Making an admission letter hard to forge.
//
// FIRST, WHAT A WATERMARK DOES AND DOES NOT DO.
//
// This document is HTML, and HTML can be edited. Anyone can open the file,
// change a name, and print it. No pattern drawn on the page prevents that, and
// a security feature that only *looks* like one is worse than none, because it
// persuades a reader to trust a document they should have checked.
//
// So the design here is not "make the file tamper-proof" — that is impossible.
// It is: make an altered copy contradict itself, and give the reader something
// to check that only the university can produce.
//
// FOUR LAYERS, EACH DOING DIFFERENT WORK:
//
//   1. A SEALED CODE. An HMAC over the particulars — name, date of birth,
//      student number, application number, programme, issue date — keyed with
//      CREDENTIAL_SECRET, which only the university holds. Change any one of
//      those on the face of the letter and the code no longer matches it. A
//      forger cannot compute a new code without the key, and cannot keep the
//      old one, because it is bound to the values they just changed.
//
//   2. A PERSONALISED WATERMARK. The student's number and the sealed code,
//      tiled across the page behind the text. It is not decoration: it repeats
//      the particulars, so an alteration to the face of the letter leaves the
//      background disagreeing with it in thirty places. Removing the watermark
//      is itself visible, because a genuine letter always carries it.
//
//   3. MICROTEXT. A rule that is a line of 2.4pt text rather than a line. It
//      reads clearly on an original and turns into a smudge on a photocopy or
//      a phone photograph, so a copy is distinguishable from an original.
//
//   4. A VERIFICATION ADDRESS. Printed in full, so a reader who has never heard
//      of this university can check the document without being told where to
//      look. The check is the real control; everything else exists to make the
//      absence of a check conspicuous.
//
// WHAT IT STILL DOES NOT DO. A correct code proves the university sealed these
// particulars. It does not prove the admission still stands — an offer can be
// withdrawn, and there is no issuance record behind /verify yet to say so.
// Language everywhere is "sealed by the university", never "valid".
// ---------------------------------------------------------------------------

import { createHmac } from 'node:crypto';

export interface SealedParticulars {
  fullName: string;
  dateOfBirth?: string;
  studentNumber: string;
  applicationNumber: string;
  programme: string;
  issuedOn: string;
}

export interface DocumentSeal {
  /** Human-readable, spoken over a telephone: ICOF-4K7Q-9XB2-M3TD. */
  code: string;
  /** The full URL a reader can open to check it. */
  verifyUrl: string;
  /** The exact string the code was computed over, printed so it is checkable. */
  sealedFields: string;
  /**
   * True when CREDENTIAL_SECRET is set and long enough. When false the letter
   * says so plainly instead of printing a code that means nothing — an
   * unverifiable code that looks verifiable is the failure this exists to
   * prevent.
   */
  sealed: boolean;
}

/**
 * The alphabet for the printed code.
 *
 * Crockford's, without I, L, O and U. The code gets read aloud down a telephone
 * line by a registrar in one country to a registrar in another, and 0/O and
 * 1/I/L are where that goes wrong. U is dropped because removing it keeps the
 * code from spelling anything unfortunate.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * The particulars, normalised and ordered, as they are sealed.
 *
 * Case and spacing are flattened because "Ndenka  Aaron" and "Ndenka Aaron" are
 * the same person, and a seal that broke on a double space would have a genuine
 * student reported as a forger. Key order is fixed: JSON.stringify preserves
 * insertion order, and the sealed bytes are the serialisation, so the order is
 * part of the format rather than an implementation detail.
 *
 * The `v` field is a version. When the format changes — a particular added, an
 * order altered — old letters must still verify, and they can only do that if
 * the document says which format it was sealed under.
 */
function sealedPayload(p: SealedParticulars): Record<string, string> {
  const norm = (v: string | undefined) =>
    String(v ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  return {
    v: 'ICOFGU-ADMISSION-V1',
    document: 'Offer of Admission',
    name: norm(p.fullName),
    date_of_birth: norm(p.dateOfBirth),
    student_number: norm(p.studentNumber),
    application_number: norm(p.applicationNumber),
    programme: norm(p.programme),
    issued: norm(p.issuedOn),
  };
}

/** The exact string the seal is computed over, printable for checking. */
export function canonicalise(p: SealedParticulars): string {
  return JSON.stringify(sealedPayload(p));
}

function secret(): string | null {
  const s = process.env.CREDENTIAL_SECRET;
  if (!s || s.length < 32) return null;
  return s;
}

/**
 * Seal the particulars.
 *
 * Twelve characters from the alphabet above is sixty bits — far short of the
 * full digest, and deliberately so. This code is transcribed by hand and read
 * over the telephone; a sixty-four character hex string would be copied wrong
 * more often than it would be copied right, and a check nobody completes
 * protects nobody. Sixty bits is not a key, it is a check digit against
 * alteration: a forger who cannot query the university has no way to find a
 * second set of particulars that seals to the same code.
 *
 * The full digest still travels in the verification link, so the machine check
 * is done at full strength and only the human check is shortened.
 */
export function sealParticulars(p: SealedParticulars, siteUrl: string): DocumentSeal {
  const data = canonicalise(p);
  const key = secret();

  // The signed bytes are the base64url payload itself, not the JSON behind it.
  // That is what GET /api/credential verifies — it re-signs the `d` parameter
  // and compares — so signing anything else would produce a letter whose QR the
  // university's own verification page rejects. One document, one signature,
  // one thing that checks it.
  const payload = Buffer.from(data, 'utf8').toString('base64url');

  if (!key) {
    return {
      code: '',
      verifyUrl: `${siteUrl}/verify`,
      sealedFields: data,
      sealed: false,
    };
  }

  const digest = createHmac('sha256', key).update(payload).digest();
  let code = '';
  for (let i = 0; i < 12; i += 1) {
    code += ALPHABET[digest[i] % ALPHABET.length];
  }
  const grouped = `ICOF-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;

  return {
    code: grouped,
    verifyUrl: `${siteUrl}/verify?d=${payload}&s=${digest.toString('hex')}`,
    sealedFields: data,
    sealed: true,
  };
}

/**
 * Re-seal and compare. This is what a check of a presented letter runs.
 *
 * Whole-string comparison of a code the presenter chose is not a timing risk
 * worth defending here — the code is printed on a document they already hold —
 * but the comparison is written to run over the full length anyway rather than
 * short-circuit, because the habit is cheap and the exception is not.
 */
export function sealMatches(p: SealedParticulars, siteUrl: string, presented: string): boolean {
  const expected = sealParticulars(p, siteUrl);
  if (!expected.sealed) return false;
  const a = expected.code.toUpperCase();
  const b = String(presented ?? '').toUpperCase().replace(/\s+/g, '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const xmlEsc = (v: string) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The watermark, as an SVG tile encoded into a data URI.
 *
 * Two things are drawn on top of each other:
 *
 *   - a guilloche — the interference pattern of two overlaid sine curves, the
 *     figure engraved on banknotes and share certificates. It is here for the
 *     reason it is there: a curve of that kind is easy to print and awkward to
 *     redraw by hand, and its absence from a copy is noticeable.
 *   - the student's number and the sealed code, set diagonally and repeated.
 *
 * Returned as a data URI so the document stays a single file with no request
 * to any server — a letter opened on an aeroplane, or in five years when this
 * deployment is gone, looks the same as it did the day it was issued.
 */
export function watermarkDataUri(studentNumber: string, code: string): string {
  const label = xmlEsc([studentNumber, code].filter(Boolean).join('  ·  '));

  // One period of the guilloche, traced as a polyline. Two sines of different
  // frequency and amplitude summed: the sum is what makes the figure hard to
  // reproduce by eye, because neither component is separately visible.
  const wave = (phase: number, amp: number): string => {
    const pts: string[] = [];
    for (let x = 0; x <= 360; x += 4) {
      const r = (x * Math.PI) / 180;
      const y = 90 + Math.sin(r * 2 + phase) * amp + Math.sin(r * 5 + phase * 1.7) * (amp / 2.4);
      pts.push(`${x},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="180" viewBox="0 0 360 180">
  <g fill="none" stroke="#422e59" stroke-opacity="0.055" stroke-width="0.7">
    ${[0, 0.9, 1.8, 2.7, 3.6].map((p) => `<polyline points="${wave(p, 26)}"/>`).join('')}
  </g>
  <text x="180" y="96" transform="rotate(-24 180 96)"
        font-family="Helvetica,Arial,sans-serif" font-size="13" letter-spacing="2.4"
        text-anchor="middle" fill="#422e59" fill-opacity="0.075">${label}</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/**
 * The microtext rule: a line that is really a sentence.
 *
 * Repeated enough times to overrun any page width, then clipped. It is set at
 * 2.4pt, which is legible in an original print and reproduces as a grey smear
 * on a photocopier or a phone camera — which is the whole point, and the reason
 * the caption beneath it tells the reader to look.
 */
export function microtext(studentNumber: string, code: string): string {
  const unit = `ICOF GLOBAL UNIVERSITY · OFFICE OF ADMISSIONS · ${studentNumber} · ${code || 'UNSEALED'} · `;
  return unit.repeat(24);
}

/**
 * The QR code that carries the verification link.
 *
 * Rendered to SVG here, on the server, rather than left as a link for the
 * reader to type. The printed code is what a person checks by telephone; this
 * is what they check in four seconds with the camera they are already holding,
 * and the difference between those two decides whether the check happens at
 * all.
 *
 * SVG rather than a raster: it stays sharp at any print size, weighs a few
 * kilobytes, and needs no external request — the letter remains one file.
 * Error correction is set to M, which tolerates roughly 15% of the symbol being
 * lost. A letter that has been folded through the QR still scans.
 */
export async function verificationQrSvg(url: string, size = 96): Promise<string> {
  // Imported here rather than at the top of the file. Next refuses a static
  // import of react-dom/server anywhere in a module that might be reached from
  // a client component, and it is right to: the check exists because shipping a
  // server renderer to a browser is both a size and a security problem. Inside
  // the function, on a route that already declares runtime = 'nodejs', it is
  // exactly what it looks like — server-side rendering of an SVG.
  const [{ createElement }, { renderToStaticMarkup }, { QRCodeSVG }] = await Promise.all([
    import('react'),
    import('react-dom/server'),
    import('qrcode.react'),
  ]);
  return renderToStaticMarkup(
    createElement(QRCodeSVG, { value: url, size, level: 'M', marginSize: 1 }),
  );
}
