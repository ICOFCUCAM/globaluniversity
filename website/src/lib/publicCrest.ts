import { landPath, graticule } from './flatWorld';

// ---------------------------------------------------------------------------
// THE PUBLIC CREST.
//
// ===========================================================================
// WHY THIS EXISTS AND WHY IT IS NOT credentialArt.ts
// ===========================================================================
//
// The homepage briefly led with the device from src/lib/credentialArt.ts — the
// same figure struck on every certificate this university issues. That was a
// mistake, and it was pointed out as one.
//
// Publishing security artwork on a public page is bad. Publishing it as INLINE
// SVG is considerably worse than publishing a photograph of it. A photograph
// has to be traced. An SVG is in view-source: select, copy, paste, and a forger
// has the university's engraving at unlimited resolution, exact to the last
// control point, for free. Every hour of guilloché maths in that module is
// handed over in a keystroke.
//
// So nothing under src/lib/credentialArt.ts is rendered on any public page. It
// is reached only from the certificate, the transcript and the Studio, all of
// which sit behind the portal. src/lib/publicArt.test.mjs enforces that, so the
// import cannot creep back in during a later redesign.
//
// ===========================================================================
// WHAT IS DELIBERATELY ABSENT HERE
// ===========================================================================
//
// This crest is not a simplified certificate device. It is a different drawing,
// and the differences are the parts that matter:
//
//   NO MICROTEXT. The certificate's legend is set at a size that survives
//   offset printing and dies in a photocopier. This one is set in type a reader
//   can actually read, which is the opposite property.
//
//   NO GUILLOCHÉ. No rosette, no engine-turned interference, no spirograph
//   ground. Those patterns are difficult to redraw by hand and that difficulty
//   IS their function.
//
//   NO HOLDER RING. The certificate carries the graduate's name and credential
//   number in a ring around the device, which is what makes a lifted device
//   specific to one award. There is no holder here to name.
//
//   NO MERIDIAN WEB, no density lattice, no UV register.
//
//   SOLID FORMS, NOT HAIRLINES. The continents are filled and the rules are
//   heavy. An engraving is built from fine line; a logo is built from mass.
//   Set the two side by side and nobody would take one for the other — which is
//   the entire point.
//
// ===========================================================================
// AND THE HONEST FOOTNOTE
// ===========================================================================
//
// None of this is what makes a certificate hard to fake, and the university
// should not believe otherwise. Artwork has never been the control: a forger
// with a good scanner beats any engraving. What decides authenticity here is
// the credential number, the HMAC seal behind it, and the public register at
// /verify that a sceptical employer can check in ten seconds — see
// src/lib/securityPatterns.ts, which is candid about exactly this.
//
// Keeping the device off the homepage is not therefore a security control. It
// is not giving the artwork away for nothing, which is a different and much
// simpler argument, and a sufficient one.
// ---------------------------------------------------------------------------

// The world itself lives in src/lib/flatWorld.ts — the azimuthal equidistant
// projection from the United Nations emblem, Africa at the foot. It was written
// here and has been lifted out, unchanged, because it is the most reusable
// piece of identity this university owns and it should not be reachable only
// through the crest. See that file for why this projection and not a globe, and
// for the sign of the sine that decides whether Eurasia is left or right of
// Africa.

export interface PublicCrestOptions {
  /** Coordinate space. The figure is self-similar, so this is not a size on screen. */
  size?: number;
  /** The ink. Everything is drawn in this one colour at varying opacity. */
  colour?: string;
  /** Set round the top of the band, in readable capitals. */
  name: string;
  /** Set round the foot of the band. */
  footer: string;
  /** Element id prefix, so two crests on one page cannot collide. */
  id?: string;
}

/**
 * A closed circular mark: a heavy double band carrying the university's name in
 * readable capitals, and a filled world at its centre.
 *
 * Pure and deterministic — no randomness, no seed, no dependence on the
 * request. It is called once at module scope on the server and the string it
 * returns is inlined, so nothing here reaches the browser.
 */
export function publicCrest(opts: PublicCrestOptions): string {
  const S = opts.size ?? 600;
  const colour = opts.colour ?? '#f7dc79';
  const id = opts.id ?? 'crest';
  const c = S / 2;
  const R = S / 2;

  // The band. Heavy rule outside, hairline inside, type between them. The
  // weights are what let the mark survive being shrunk to a favicon: a band of
  // three equal rules turns to mush, a band of contrasting rules does not.
  const rOuter = R * 0.985;
  const rBandIn = R * 0.775;
  const rLegend = R * 0.886;
  const rMap = R * 0.700;

  const arc = (r: number, a0: number, a1: number, sweep: 0 | 1) => {
    const p = (a: number) => {
      const t = (a * Math.PI) / 180;
      return `${(c + r * Math.cos(t)).toFixed(1)},${(c + r * Math.sin(t)).toFixed(1)}`;
    };
    return `M${p(a0)}A${r.toFixed(1)},${r.toFixed(1)} 0 0 ${sweep} ${p(a1)}`;
  };

  // Top runs left-to-right over the crown. The foot is drawn BACKWARDS — from
  // the lower left round to the lower right the short way — because a path laid
  // clockwise through the bottom carries its text upside down.
  const topArc = arc(rLegend, 194, 346, 1);
  const footArc = arc(rLegend, 166, 14, 0);

  // Graticule: parallels at 60°N, 30°N, the equator and 30°S, and a meridian
  // every thirty degrees. Enough to read as a map, not enough to become a net.
  const grat = graticule(c, c, rMap);
  const land = landPath(c, c, rMap);

  // Two lozenges, at the SIDES only — where the top legend ends and the footer
  // begins. They are the punctuation of the band: without them the name and the
  // footer run into each other and the ring reads as one broken sentence.
  //
  // Not four, one per quarter — the top and bottom quarters are where the type
  // is, not where the gaps are, so a lozenge there lands in the crown of the
  // name and in the middle of the footer: FOUND◆D 2007.
  const lozenges = [0, 180]
    .map((a) => {
      const t = (a * Math.PI) / 180;
      const x = c + rLegend * Math.cos(t);
      const y = c + rLegend * Math.sin(t);
      const s = S * 0.016;
      return `<path d="M${x.toFixed(1)},${(y - s).toFixed(1)}L${(x + s).toFixed(1)},${y.toFixed(1)}`
        + `L${x.toFixed(1)},${(y + s).toFixed(1)}L${(x - s).toFixed(1)},${y.toFixed(1)}Z"/>`;
    })
    .join('');

  const type = (S * 0.0455).toFixed(1);
  const track = (S * 0.0115).toFixed(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" `
    + `fill="none" stroke="${colour}" role="presentation">`
    + `<defs>`
    + `<path id="${id}-top" d="${topArc}"/>`
    + `<path id="${id}-foot" d="${footArc}"/>`
    + `<radialGradient id="${id}-sea" cx="50%" cy="46%" r="62%">`
    + `<stop offset="0%" stop-color="${colour}" stop-opacity="0.13"/>`
    + `<stop offset="100%" stop-color="${colour}" stop-opacity="0.03"/>`
    + `</radialGradient>`
    + `</defs>`

    // The band.
    + `<circle cx="${c}" cy="${c}" r="${rOuter.toFixed(1)}" stroke-width="${(S * 0.0165).toFixed(1)}"/>`
    + `<circle cx="${c}" cy="${c}" r="${(rOuter - S * 0.026).toFixed(1)}" stroke-width="${(S * 0.0035).toFixed(1)}" stroke-opacity="0.6"/>`
    + `<circle cx="${c}" cy="${c}" r="${rBandIn.toFixed(1)}" stroke-width="${(S * 0.0105).toFixed(1)}"/>`

    // The legend. dominant-baseline is set to middle so the type sits on the
    // arc's centre line rather than standing on it — on a circular band the
    // difference is the whole optical alignment.
    + `<g fill="${colour}" stroke="none" font-family="Georgia,'Times New Roman',serif" `
    + `font-size="${type}" font-weight="700" letter-spacing="${track}" text-anchor="middle">`
    + `<text dominant-baseline="middle"><textPath href="#${id}-top" startOffset="50%">${esc(opts.name)}</textPath></text>`
    + `<text dominant-baseline="middle"><textPath href="#${id}-foot" startOffset="50%">${esc(opts.footer)}</textPath></text>`
    + `</g>`
    + `<g fill="${colour}" stroke="none" fill-opacity="0.9">${lozenges}</g>`

    // The world.
    + `<circle cx="${c}" cy="${c}" r="${rMap.toFixed(1)}" fill="url(#${id}-sea)" stroke="none"/>`
    + `<g stroke="${colour}" stroke-opacity="0.34" stroke-width="${(S * 0.0028).toFixed(2)}">${grat}</g>`
    + `<path d="${land}" fill="${colour}" fill-opacity="0.92" fill-rule="evenodd" `
    + `stroke="${colour}" stroke-width="${(S * 0.0035).toFixed(2)}" stroke-linejoin="round"/>`
    + `<circle cx="${c}" cy="${c}" r="${rMap.toFixed(1)}" stroke-width="${(S * 0.0055).toFixed(2)}" stroke-opacity="0.75"/>`
    + `</svg>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
