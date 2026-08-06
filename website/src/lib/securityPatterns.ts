// ---------------------------------------------------------------------------
// The named security patterns of ICOF Global University.
//
// WHY NAMING THEM MATTERS, AND IT IS NOT BRANDING.
//
// An unnamed pattern cannot be specified, cannot be ordered from a printer,
// cannot be cited in a verification procedure, and cannot be defended if
// somebody copies it. "The background" is not a thing anybody can point at.
// "The ICOF Globe Guilloché, at 30% strength, in brand purple" is an
// instruction a print shop can follow and a registrar can check against.
//
// It is also how a security scheme survives the person who designed it. In ten
// years the question will be "is this the real pattern?", and the answer has to
// live somewhere other than in one designer's memory.
//
// ON THE ™ SYMBOL. It is used here as a claim of use, which is what ™ means and
// all it means — anyone may apply it to a mark they are using in trade, without
// registration. It is NOT ®, which may only be used for a mark actually
// registered with an intellectual-property office, and using ® without a
// registration is an offence in most jurisdictions. If the university wants the
// stronger protection it must register these names; until it does, ™ is the
// honest symbol and the only one that should appear.
//
// WHAT IS ACTUALLY PROTECTABLE. The names, as trade marks, once used and
// preferably registered. The specific artwork, as copyright, automatically. The
// mathematics is not protectable and never has been — a hypotrochoid is a
// hypotrochoid, and that is fine: the protection that matters is the credential
// register, which no amount of copying the pattern gets anybody past.
// ---------------------------------------------------------------------------

export interface SecurityPattern {
  /** The key used in code and in the design record. */
  id: string;
  /** The official name. Use this in specifications, orders and procedures. */
  name: string;
  /** What layer of the document it occupies. */
  role: string;
  /** What it is, in one sentence a printer or a registrar can act on. */
  what: string;
  /** What it defends against — and honestly, including where it does not. */
  defends: string;
  /** Where it is implemented, so the next person can find it. */
  source: string;
}

export const SECURITY_PATTERNS: SecurityPattern[] = [
  {
    id: 'device',
    name: 'The ICOF Globe Guilloché™',
    role: 'Primary security pattern — central watermark',
    what:
      'The university’s composed device: a microtext ring carrying the name, descriptor and ' +
      'motto; a register of Central African geometric ornament; twelve nodes joined by chords; ' +
      'laurel at the cardinal points; the world turned so Africa is at its centre with the ' +
      'coastlines engraved; the year of foundation; and the faculty’s emblem. Struck in one of ' +
      'five silhouettes — medallion, cartouche, escutcheon, radiant or banknote panel — at four ' +
      'levels of elaboration, one for each level of award.',
    defends:
      'Casual copying and template substitution. Every element is derived from this ' +
      'institution — its name, its motto, its continent, its year — so the figure cannot be ' +
      'lifted onto another university’s document without announcing whose it is. It does not ' +
      'stop a determined forger with a good scanner; nothing printed does.',
    source: 'src/lib/credentialArt.ts — africanGlobeOfKnowledge()',
  },
  {
    id: 'rosette',
    name: 'The ICOF Academic Rosette™',
    role: 'Alternative central watermark',
    what:
      'Three counter-rotated bands of hypotrochoids over a 180-spoke radial ground — the ' +
      'engine-turning used on banknotes and share certificates, seeded per credential so no two ' +
      'documents carry the same figure.',
    defends:
      'Hand reproduction. Every crossing is determined by the equation, so a drawn copy goes ' +
      'wrong everywhere at once rather than in one place. It is the classical figure and it is ' +
      'not specific to this university, which is why it is the alternative and not the default.',
    source: 'src/lib/credentialArt.ts — guillocheRosette()',
  },
  {
    id: 'border',
    name: 'The ICOF Security Border™',
    role: 'Border pattern',
    what:
      'An engraved gilt frame: an outer fillet, a scroll-and-leaf course, a bead rule and a ' +
      'medallion at each corner, over a three-stop gradient. Redrawn as vector geometry from ' +
      'the university’s own first certificate of 2011.',
    defends:
      'Photocopying, chiefly. Gilt is a gradient rather than a colour, and a copier renders it ' +
      'as one muddy tone — a copied certificate has a visibly flat frame beside a real one.',
    source: 'src/lib/credentialArt.ts — ornateFrame()',
  },
  {
    id: 'mesh',
    name: 'Fine-Line Guilloché Mesh',
    role: 'Background linework',
    what:
      'The paper itself: a lattice of fine waves with a miniature globe and the university’s ' +
      'initials worked into every tile, repeated across the sheet.',
    defends:
      'Copying and scanning. Photocopiers dither fine regular patterns badly, so a copy shows ' +
      'moiré where the original shows an even ground. Under a loupe the tile resolves into ' +
      'hundreds of small globes.',
    source: 'src/lib/credentialArt.ts — securityGround()',
  },
  {
    id: 'microtext',
    name: 'Microtext Security Layer',
    role: 'Hidden authentication',
    what:
      'A rule that is a line of 1.9pt type: the university’s name, its descriptor, its motto ' +
      'and this credential’s own number, repeated the width of the sheet.',
    defends:
      'Distinguishing an original from a copy. It is legible under a loupe and reduces to a ' +
      'grey smear on any photocopy or phone photograph. Because it carries the credential ' +
      'number, a band lifted from a genuine scan carries the original’s number into the forgery.',
    source: 'src/lib/credentialArt.ts — microtextBand()',
  },
  {
    id: 'seal',
    name: 'Embossed University Seal',
    role: 'Official seal',
    what:
      'A red foil wafer, applied by hand to the hard copy. The document leaves a clear disc in ' +
      'the middle for it — no text, no watermark, no ground, no keyline — because a wafer ' +
      'pressed over printed artwork shows a halo of whatever was underneath.',
    defends:
      'Nothing, on its own — and this is the one the interface must be most careful about. ' +
      'Relief is felt, not printed, so software cannot produce it and does not pretend to: ' +
      'what this system supplies is correctly registered clear space and the artwork for the ' +
      'wafer. The security is in the physical application, which is the university’s to do.',
    source: 'src/lib/credentialArt.ts — waferSeal(); CredentialDesign.sealPlacement',
  },
  {
    id: 'uv',
    name: 'UV Security Pass',
    role: 'Invisible layer, printed copies only',
    what:
      'Artwork for a second pass in fluorescent ink, supplied as a separate file for the print ' +
      'shop. Black in that file means ink; it carries no visible-pass artwork.',
    defends:
      'Nothing until a press applies it. A browser cannot emit invisible ink and there is no ' +
      'screen effect equivalent to it, so this is a specification for somebody else’s machine ' +
      'and is offered as a download rather than as a switch. A toggle would imply the ' +
      'university produces something it does not.',
    source: 'src/lib/credentialArt.ts — uvLayerSvg(); Studio → Printing',
  },
  {
    id: 'seal-code',
    name: 'ICOF Credential Seal',
    role: 'Cryptographic authentication',
    what:
      'An HMAC-SHA256 over the award’s canonical particulars, keyed with a secret only the ' +
      'university holds, printed as a twelve-character code and encoded in the QR beside it.',
    defends:
      'Everything the printed layers cannot. This is the control that actually decides ' +
      'authenticity: alter any sealed particular and the code stops matching, and the ' +
      'credential register behind it says whether the document was ever issued and whether it ' +
      'still stands. Every other pattern on this list exists to make the ABSENCE of this check ' +
      'conspicuous.',
    source: 'src/lib/documentSecurity.ts; docs/migrations/004_credential_register.sql',
  },
];

export function patternById(id: string): SecurityPattern | undefined {
  return SECURITY_PATTERNS.find((p) => p.id === id);
}

/** The name to print in a specification for a given watermark setting. */
export function watermarkName(watermark: string): string {
  switch (watermark) {
    case 'device-in-rosette': return 'The ICOF Globe Guilloché™ in Academic Rosette';
    case 'device': return 'The ICOF Globe Guilloché™';
    case 'rosette': return 'The ICOF Academic Rosette™';
    case 'globe': return 'ICOF Graticule';
    case 'globe-in-rosette': return 'ICOF Graticule in Academic Rosette';
    default: return watermark;
  }
}
