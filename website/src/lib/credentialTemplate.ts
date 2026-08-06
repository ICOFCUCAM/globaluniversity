// ---------------------------------------------------------------------------
// The design of the university's award certificates and transcripts.
//
// WHY THIS IS DATA AND NOT CSS.
//
// A degree certificate is an assertion the university has made about a person,
// and it survives the university's website by decades. The wording, the seal,
// the signatories and the paper size are the assertion's form, and changing
// them is a decision of the institution — not a styling tweak. Holding them in
// a table means the change has an author, a date and a version.
//
// WHY VERSIONS MATTER MORE THAN THEY LOOK.
//
// /verify checks a credential by QR code. If the design lived only in the
// current code, verifying a certificate issued in 2024 would render it under
// the 2026 design — different wording, different signatories, possibly a
// different classification vocabulary — and it would no longer match the paper
// in the graduate's hand. A holder challenged on authenticity would be shown a
// document that disagrees with theirs, by their own university.
//
// So a template is never edited in place once published. Publishing writes a
// NEW row with the next version number and makes it active; the old row stays
// exactly as it was, and every published version remains renderable forever.
//
// WHAT IS NOT YET WIRED. Nothing currently writes an issuance record: the
// Certificate Generator renders from sample data and no table records that a
// named graduate was awarded a document under version N. Until that exists,
// /verify has nothing to look a version up by. Keeping every version intact is
// the half that had to come first — the design history cannot be reconstructed
// later, whereas the issuance link can be added the day certificates are
// actually issued from real records. Do not describe verification as
// version-accurate until that table exists.
//
// WHO MAY CHANGE IT.
//
// The Superadministrator alone — 'design-credentials' and
// 'publish-credential-template' are in SYSTEM_CAPABILITIES, so no administrator
// holds them. An administrator who could redesign a certificate could alter
// what the university has already attested to.
// ---------------------------------------------------------------------------

export type CredentialKind = 'certificate' | 'transcript';

export interface Signatory {
  /** Printed under the rule, e.g. "Prof. Chamayah Meyembi". */
  name: string;
  /** Printed under the name, e.g. "Vice Chancellor". */
  office: string;
}

export interface CredentialDesign {
  /** Page setup. A4 landscape is the certificate default; portrait for transcripts. */
  pageSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';

  /** Colours, as hex. `ink` is body text; `accent` is the rules and borders. */
  brand: string;
  accent: string;
  ink: string;
  paper: string;

  /** Serif for the document body — certificates are not sans-serif documents. */
  fontFamily: string;

  /** Border treatment. `none` suits transcripts; `double` is the certificate. */
  border: 'none' | 'single' | 'double';
  borderWidthMm: number;

  /** Watermark seal opacity, 0–1. Zero removes it. */
  sealOpacity: number;
  showSeal: boolean;

  /**
   * The fixed wording. These are the sentences the university is committing to,
   * which is exactly why they are editable by one office and no other.
   *
   * A map rather than a fixed shape, because a certificate and a transcript say
   * different things and there is no honest superset of the two. WORDING_KEYS
   * below lists what each kind requires; the Studio renders its fields from that
   * list and validateDesign checks against it, so adding a line to a document
   * means adding one entry in one place.
   */
  wording: Record<string, string>;

  /**
   * The security artwork. See credentialArt.ts, which is candid about what each
   * layer achieves — none of it stops a determined forger, and the real control
   * is the issuance register behind /verify.
   *
   * There is deliberately no `uvLayer` flag. UV ink is applied by a press on a
   * second pass; a browser cannot emit it and a toggle would imply the
   * university produces something it does not. The Studio offers the UV artwork
   * as a file to hand a printer instead.
   */
  security: {
    guilloche: boolean;
    guillocheOpacity: number;
    microtextBorder: boolean;
    securityGround: boolean;
    engravedSeal: boolean;
    /** The verification QR. Off only for a document that is never issued. */
    qr: boolean;
  };

  /** Whose signatures appear, and in what order, left to right. */
  signatories: Signatory[];

  /** Printed small at the foot, before the date and serial. */
  footnote: string;
}

export interface CredentialTemplate {
  id?: string;
  kind: CredentialKind;
  version: number;
  name: string;
  design: CredentialDesign;
  isActive: boolean;
  createdBy?: string | null;
  createdAt?: string;
  publishedAt?: string | null;
}

/**
 * Version 1 — the design already in use, lifted out of CertificateGenerator
 * unchanged so that installing this system alters no document. The first
 * published version must be a faithful copy of what came before it, or every
 * certificate issued to date silently disagrees with its own record.
 */
/**
 * Which lines each kind of document is made of.
 *
 * `label` is what the Superadministrator sees in the Studio; `key` is what the
 * renderer reads. Keeping them together means a line cannot exist in the
 * document without a field to edit it, or a field without a line.
 */
export const WORDING_KEYS: Record<CredentialKind, { key: string; label: string }[]> = {
  certificate: [
    { key: 'senate', label: 'Conferring body' },
    { key: 'authority', label: 'Authority' },
    { key: 'recognition', label: 'Recognition' },
    { key: 'confers', label: 'Conferral' },
    { key: 'degreeLead', label: 'Before the award' },
    { key: 'classificationLead', label: 'Before the classification' },
    { key: 'privileges', label: 'Privileges' },
    { key: 'given', label: 'Date preamble' },
  ],
  transcript: [
    { key: 'title', label: 'Title' },
    { key: 'statement', label: 'Statement of truth' },
    { key: 'programmeLead', label: 'Before the programme' },
    { key: 'validity', label: 'Validity note' },
  ],
};

export const DEFAULT_CERTIFICATE_DESIGN: CredentialDesign = {
  pageSize: 'A4',
  orientation: 'landscape',
  brand: '#422e59',
  accent: '#c5a55a',
  // Near-black, not grey. #444 on cream is what a certificate looks like when
  // it has been photocopied twice; the original should start darker than that.
  ink: '#241c30',
  paper: '#fffdf5',
  fontFamily: "Georgia, 'Times New Roman', Times, serif",
  border: 'double',
  borderWidthMm: 3,
  sealOpacity: 0.05,
  showSeal: true,
  // The conferral, in the form the older universities use: the body that
  // confers, the authority it acts under, the act itself, and the date in
  // words. It reads as an instrument rather than as a notification, which is
  // what it is.
  wording: {
    senate: 'The Senate of',
    authority: 'under the authority vested in it',
    recognition: 'and in recognition of the successful completion of the prescribed course of study',
    confers: 'confers upon',
    degreeLead: 'the Degree of',
    classificationLead: 'with',
    privileges: 'with all the rights, privileges and responsibilities thereunto appertaining',
    given: 'Given this',
  },
  signatories: [
    { name: '', office: 'Vice Chancellor' },
    { name: '', office: 'Registrar' },
  ],
  footnote: '',
  security: {
    guilloche: true,
    guillocheOpacity: 0.5,
    microtextBorder: true,
    securityGround: true,
    engravedSeal: true,
    qr: true,
  },
};

export const DEFAULT_TRANSCRIPT_DESIGN: CredentialDesign = {
  ...DEFAULT_CERTIFICATE_DESIGN,
  orientation: 'portrait',
  border: 'single',
  borderWidthMm: 1,
  sealOpacity: 0.04,
  wording: {
    title: 'Official Academic Transcript',
    statement: 'The record set out below is a true statement of the academic performance of',
    programmeLead: 'in the programme of',
    validity: 'This transcript is invalid without the seal of the University.',
  },
  signatories: [{ name: '', office: 'Registrar' }],
  footnote: 'Issued under the seal of ICOF Global University. Verify at iguc.net/verify.',
  security: {
    ...DEFAULT_CERTIFICATE_DESIGN.security,
    // A transcript is a table. A rosette behind columns of marks makes them
    // harder to read, and legibility of the marks is the document's whole job.
    guilloche: false,
    engravedSeal: true,
  },
};

export function defaultDesign(kind: CredentialKind): CredentialDesign {
  return kind === 'transcript' ? DEFAULT_TRANSCRIPT_DESIGN : DEFAULT_CERTIFICATE_DESIGN;
}

/**
 * Merge a stored design over the default.
 *
 * Stored rows are JSON and may predate a field added later. Falling back
 * field-by-field means an older template renders with the current default for
 * anything it does not mention, rather than rendering with `undefined` — which
 * on a certificate means a blank where the university's name should be.
 */
export function withDefaults(
  kind: CredentialKind,
  stored: Partial<CredentialDesign> | null | undefined,
): CredentialDesign {
  const base = defaultDesign(kind);
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    wording: { ...base.wording, ...(stored.wording ?? {}) },
    security: { ...base.security, ...(stored.security ?? {}) },
    signatories: stored.signatories?.length ? stored.signatories : base.signatories,
  };
}

/**
 * Reject a design that would produce an unreadable or unusable document before
 * it can be published. Returns the problems; an empty array means publishable.
 *
 * This is deliberately about legibility and completeness rather than taste. A
 * certificate with a two-millimetre margin or white text on white paper is not
 * a stylistic choice anyone needs to defend — it is a document that cannot be
 * issued, and it should fail at the moment of publishing rather than at the
 * moment a graduate opens it.
 */
export function validateDesign(d: CredentialDesign, kind: CredentialKind = 'certificate'): string[] {
  const problems: string[] = [];
  const hex = /^#[0-9a-fA-F]{6}$/;

  for (const [field, value] of Object.entries({
    brand: d.brand, accent: d.accent, ink: d.ink, paper: d.paper,
  })) {
    if (!hex.test(value)) problems.push(`${field} must be a six-digit hex colour, e.g. #422e59.`);
  }
  if (hex.test(d.ink) && hex.test(d.paper) && contrast(d.ink, d.paper) < 4.5) {
    problems.push(
      'Body text and paper are too close in tone to read (contrast below 4.5:1). ' +
      'A certificate is often photocopied and scanned, which loses contrast rather than adding it.',
    );
  }
  if (d.borderWidthMm < 0 || d.borderWidthMm > 10) {
    problems.push('Border width must be between 0 and 10 mm.');
  }
  if (d.sealOpacity < 0 || d.sealOpacity > 1) {
    problems.push('Seal opacity must be between 0 and 1.');
  }
  if (d.signatories.length === 0) {
    problems.push('A credential needs at least one signatory.');
  }
  if (d.signatories.some((s) => !s.office.trim())) {
    problems.push('Every signatory needs an office. A signature over a blank line attests to nothing.');
  }
  // Only the lines this kind of document actually prints. A stored design may
  // carry keys from another kind — checking those would refuse a perfectly good
  // certificate because a transcript field it never renders is blank.
  for (const { key, label } of WORDING_KEYS[kind]) {
    if (!(d.wording[key] ?? '').trim()) problems.push(`"${label}" cannot be empty.`);
  }
  if (!d.security.qr) {
    problems.push(
      'A credential without a verification code cannot be checked by anyone who receives it. ' +
      'Turn the QR back on, or this design can only be used for documents that are never issued.',
    );
  }
  return problems;
}

/** WCAG relative-luminance contrast ratio between two hex colours. */
function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
