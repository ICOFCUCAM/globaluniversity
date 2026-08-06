// ---------------------------------------------------------------------------
// The security artwork on a certificate.
//
// WHAT THIS IS FOR, AND WHAT IT IS NOT FOR.
//
// None of this stops a determined forger, and it is important to say so before
// describing it. A certificate is a piece of paper; anyone with a scanner and
// an afternoon can produce something that looks like one. Guilloché and
// microtext do not prevent that.
//
// What they do is raise the cost of a CASUAL forgery — the photocopy, the
// Photoshop edit of a genuine scan, the printed-at-home copy — to the point
// where the result is visibly wrong to someone holding a real one beside it,
// and they give a registrar checking a presented document something concrete to
// look for. The real control is the verification in documentSecurity.ts and the
// issuance register behind it. This is the layer that makes the ABSENCE of a
// check conspicuous, and it earns its place on that basis alone.
//
// EVERYTHING HERE IS PURE AND CLIENT-SAFE. No crypto, no Node, no network. The
// same functions run in the Studio preview and in the printed document, so what
// the Superadministrator approves is what a graduate receives — an approximation
// in the preview would be worse than no preview.
//
// EVERYTHING IS DETERMINISTIC. Given the same seed the same pattern comes out,
// so a certificate re-rendered for verification years later is identical to the
// one in the graduate's hand. A random pattern would make every re-render a
// different document.
//
// WHAT SOFTWARE CANNOT DO, and the interface must not pretend otherwise:
//
//   UV / fluorescent ink. This is a printing process — a second pass on a press
//   with invisible ink — not something a browser can emit. `uvLayerSvg` exists
//   and produces the artwork a printer would need for that pass, as a separate
//   file to hand them. It is not a feature of the document; it is a spec for
//   somebody else's machine, and it is labelled as such.
//
//   Intaglio, foil, embossing, security paper, watermarked stock. Same: they
//   belong to whoever prints, and the honest thing is to produce artwork they
//   can use rather than a screen effect that mimics the look.
// ---------------------------------------------------------------------------

import { WORLD, AFRICA } from './worldCoastlines';

/**
 * A tiny deterministic PRNG (mulberry32).
 *
 * Math.random would give a different pattern on every render, so a certificate
 * verified in 2031 would not match the one issued in 2026. Seeded from the
 * credential id, the pattern becomes part of the document: two certificates
 * carry different guilloché, and the same certificate always carries its own.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string, so a credential id can seed the artwork. */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const enc = (svg: string) => `data:image/svg+xml;base64,${btoaSafe(svg)}`;

/** btoa that survives non-Latin-1 characters and works on the server too. */
function btoaSafe(s: string): string {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(s)));
  return Buffer.from(s, 'utf8').toString('base64');
}

/* ------------------------------------------------------------------ */
/* Layer: guilloché                                                     */
/* ------------------------------------------------------------------ */

/**
 * The rosette engraved on banknotes and share certificates.
 *
 * It is a spirograph: a point on a circle rolling inside another circle. Two
 * radii and a phase decide the whole figure, and the reason it is used on
 * securities is that it is trivial to print and very hard to redraw by eye —
 * every crossing is determined by the equation, so a hand copy goes wrong
 * everywhere at once rather than in one visible place.
 */
export function guillocheRosette(
  seed: number,
  size: number,
  colour: string,
  opacity = 0.5,
  /**
   * How many nested bands to draw. Three is the full figure; one is the outer
   * band alone, which is what you want when something else — the globe — is
   * going to sit in the middle of it. Drawing all three under a globe puts a
   * second rosette inside the sphere and the graticule becomes unreadable.
   */
  bandCount = 3,
): string {
  const r = rng(seed);
  const R = size / 2;
  const paths: string[] = [];

  // A hypotrochoid: a point fixed to a small circle rolling inside a large one.
  //   x = (A − b)·cos t + d·cos(((A − b)/b)·t)
  //   y = (A − b)·sin t − d·sin(((A − b)/b)·t)
  //
  // Three things have to be right or it does not look like engine turning.
  //
  // The petal count (A − b)/b must be a WHOLE NUMBER, or the curve never closes
  // and the figure degenerates into a starburst.
  //
  // One curve is not a rosette. What makes the engraving on a share certificate
  // look the way it does is a stack of the same curve with the pen offset
  // stepped a little each time: the curves interfere, and the moiré between
  // them is the figure.
  //
  // And one BAND is not a rosette either — which is what this drew at first. A
  // single ring of petals reads as a decorative motif; a real guilloché is
  // several figures of different periodicity laid over one another at different
  // radii, so the interference happens between the bands as well as within
  // them. Three bands, counter-rotated, with a fine radial ground behind: the
  // pattern stops being something you could sketch and starts being something
  // you would have to solve.
  const bands = [
    { scale: 0.98, petals: 7 + Math.floor(r() * 5), curves: 14, phase: 0 },
    { scale: 0.72, petals: 11 + Math.floor(r() * 6), curves: 12, phase: Math.PI / 5 },
    { scale: 0.46, petals: 5 + Math.floor(r() * 4), curves: 10, phase: Math.PI / 3 },
  ].slice(0, Math.max(1, Math.min(3, bandCount)));

  // The ground: a fine radial engine-turn, the plain lathe work that sits under
  // the figures on a banknote. Cheap to draw, very tedious to fake by hand.
  const spokes = 180;
  const groundPts: string[] = [];
  for (let i = 0; i < spokes; i += 1) {
    const a = (i / spokes) * Math.PI * 2;
    const r0 = R * 0.30;
    const r1 = R * (0.90 + Math.sin(a * 9) * 0.05);
    groundPts.push(
      `M${(R + Math.cos(a) * r0).toFixed(2)},${(R + Math.sin(a) * r0).toFixed(2)} ` +
      `L${(R + Math.cos(a) * r1).toFixed(2)},${(R + Math.sin(a) * r1).toFixed(2)}`,
    );
  }
  if (bandCount >= 3) {
    paths.push(
      `<path d="${groundPts.join(' ')}" fill="none" stroke="${colour}" stroke-width="0.18" ` +
      `stroke-opacity="${(opacity * 0.34).toFixed(3)}"/>`,
    );
  }

  for (const band of bands) {
    const A = R * band.scale;
    const b = A / (band.petals + 1);
    const steps = band.petals * 110;
    for (let n = 0; n < band.curves; n += 1) {
      const d = b * (0.42 + (n / (band.curves - 1)) * 1.28);
      const pts: string[] = [];
      for (let i = 0; i <= steps; i += 1) {
        const t = (i / steps) * Math.PI * 2 * (band.petals + 1) + band.phase;
        const x = R + (A - b) * Math.cos(t) + d * Math.cos(((A - b) / b) * t);
        const y = R + (A - b) * Math.sin(t) - d * Math.sin(((A - b) / b) * t);
        pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      }
      paths.push(
        `<polyline points="${pts.join(' ')}" fill="none" stroke="${colour}" ` +
        `stroke-width="0.26" stroke-opacity="${(opacity * 0.62).toFixed(3)}"/>`,
      );
    }
  }

  // Two concentric hairlines to close the figure, as a lathe would.
  for (const k of [0.995, 0.965]) {
    paths.push(
      `<circle cx="${R}" cy="${R}" r="${(R * k).toFixed(2)}" fill="none" stroke="${colour}" ` +
      `stroke-width="0.3" stroke-opacity="${(opacity * 0.7).toFixed(3)}"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths.join('')}</svg>`;
}

export const guillocheRosetteUri = (seed: number, size: number, colour: string, opacity?: number) =>
  enc(guillocheRosette(seed, size, colour, opacity));

/**
 * The guilloché band that runs along a border.
 *
 * Two sine waves of different frequency, summed and phase-shifted across a
 * stack of lines. Tiles horizontally, so one tile covers any width.
 */
export function guillocheBand(
  seed: number,
  width: number,
  height: number,
  colour: string,
  opacity = 0.45,
): string {
  const r = rng(seed);
  const f1 = 2 + Math.floor(r() * 3);
  const f2 = 5 + Math.floor(r() * 5);
  const lines: string[] = [];

  for (let n = 0; n < 7; n += 1) {
    const phase = (n / 7) * Math.PI * 2;
    const amp = height * 0.30;
    const pts: string[] = [];
    for (let x = 0; x <= width; x += 2) {
      const t = (x / width) * Math.PI * 2;
      const y = height / 2
        + Math.sin(t * f1 + phase) * amp
        + Math.sin(t * f2 + phase * 1.6) * (amp * 0.42);
      pts.push(`${x},${y.toFixed(2)}`);
    }
    lines.push(
      `<polyline points="${pts.join(' ')}" fill="none" stroke="${colour}" ` +
      `stroke-width="0.3" stroke-opacity="${opacity}"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${lines.join('')}</svg>`;
}

export const guillocheBandUri = (seed: number, w: number, h: number, colour: string, opacity?: number) =>
  enc(guillocheBand(seed, w, h, colour, opacity));

/* ------------------------------------------------------------------ */
/* Layer: microtext                                                     */
/* ------------------------------------------------------------------ */

/**
 * A rule that is really a line of type, set at a size a photocopier cannot hold.
 *
 * At 1.2pt this reads under a loupe and reproduces as a grey smear on any copy,
 * which is the whole point: it distinguishes an original from a copy of one.
 * Banks and passport offices use it for that reason and no other.
 *
 * The text repeats the credential id as well as the university's name, so the
 * microtext on one certificate is not the microtext on another — a forger who
 * lifts the band from a genuine scan carries the original's id into it.
 */
export function microtextBand(
  text: string,
  width: number,
  height: number,
  colour: string,
  fontSize = 1.6,
): string {
  const unit = `${text} · `;
  // Overrun the width by a wide margin, then let the viewBox clip it.
  const line = unit.repeat(Math.ceil((width / (unit.length * fontSize * 0.5)) + 2));
  const esc = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<text x="0" y="${(height / 2 + fontSize * 0.36).toFixed(2)}" font-family="Helvetica,Arial,sans-serif" ` +
    `font-size="${fontSize}" letter-spacing="0.1" fill="${colour}" fill-opacity="0.85">${esc}</text></svg>`;
}

export const microtextBandUri = (text: string, w: number, h: number, colour: string, fontSize?: number) =>
  enc(microtextBand(text, w, h, colour, fontSize));

/* ------------------------------------------------------------------ */
/* Layer: the engraved seal                                             */
/* ------------------------------------------------------------------ */

/**
 * The seal, drawn rather than photographed.
 *
 * The old seal was a PNG of the website's favicon, laid on the paper at 5%
 * opacity. Three things were wrong with that: it is a raster, so it softens at
 * print resolution; it is the same file the public site serves, so anyone can
 * download it; and being a flat image, it can be selected and deleted from a
 * PDF in one action.
 *
 * This is vector, drawn from the credential's own seed, and it is built from
 * concentric engraved rings with the university's name set around the
 * circumference — the form of a real embossed seal, where the relief is what
 * you are looking at rather than a picture printed on the surface. It cannot be
 * lifted as a file because there is no file: it is geometry computed per
 * document.
 */
export function engravedSeal(
  seed: number,
  size: number,
  brand: string,
  accent: string,
  legend: string,
  centre: string,
): string {
  const R = size / 2;
  const id = `s${seed.toString(36)}`;
  const rosette = guillocheRosette(seed ^ 0x9e3779b9, size * 0.62, brand, 0.55)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');

  // Legend around the circumference. Repeated twice so it reads whichever way
  // up the seal is looked at, which is how a real die is cut.
  const around = `${legend} ★ `.repeat(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <path id="${id}-arc" d="M ${R},${R} m -${R - size * 0.09},0 a ${R - size * 0.09},${R - size * 0.09} 0 1,1 ${(R - size * 0.09) * 2},0 a ${R - size * 0.09},${R - size * 0.09} 0 1,1 -${(R - size * 0.09) * 2},0"/>
    <radialGradient id="${id}-emboss" cx="38%" cy="34%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.75"/>
      <stop offset="55%" stop-color="${accent}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${brand}" stop-opacity="0.22"/>
    </radialGradient>
  </defs>

  <circle cx="${R}" cy="${R}" r="${R - 0.5}" fill="url(#${id}-emboss)"/>
  <circle cx="${R}" cy="${R}" r="${R - 0.5}" fill="none" stroke="${brand}" stroke-width="${(size * 0.018).toFixed(2)}"/>
  <circle cx="${R}" cy="${R}" r="${(R * 0.90).toFixed(2)}" fill="none" stroke="${accent}" stroke-width="${(size * 0.006).toFixed(2)}"/>
  <circle cx="${R}" cy="${R}" r="${(R * 0.70).toFixed(2)}" fill="none" stroke="${brand}" stroke-width="${(size * 0.010).toFixed(2)}"/>

  <g transform="translate(${R * 0.31},${R * 0.31})">${rosette}</g>

  <text font-family="Georgia,'Times New Roman',serif" font-size="${(size * 0.075).toFixed(2)}"
        letter-spacing="${(size * 0.012).toFixed(2)}" fill="${brand}" fill-opacity="0.92">
    <textPath href="#${id}-arc" startOffset="0">${escapeXml(around)}</textPath>
  </text>

  <text x="${R}" y="${(R + size * 0.035).toFixed(2)}" text-anchor="middle"
        font-family="Georgia,'Times New Roman',serif" font-size="${(size * 0.115).toFixed(2)}"
        font-weight="bold" letter-spacing="${(size * 0.01).toFixed(2)}"
        fill="${brand}" fill-opacity="0.95">${escapeXml(centre)}</text>
</svg>`;
}

export const engravedSealUri = (
  seed: number, size: number, brand: string, accent: string, legend: string, centre: string,
) => enc(engravedSeal(seed, size, brand, accent, legend, centre));

/* ------------------------------------------------------------------ */
/* Layer: the security background                                       */
/* ------------------------------------------------------------------ */

/**
 * The paper.
 *
 * Not a flat cream fill. A fine lattice with the university's initials worked
 * into it, at an opacity that reads as texture at arm's length and as structure
 * under a scanner. Photocopiers dither fine regular patterns badly, so a copy
 * shows moiré where the original shows an even ground.
 */
export function securityGround(
  seed: number,
  tile: number,
  colour: string,
  mark: string,
  opacity = 0.055,
): string {
  const r = rng(seed);
  const parts: string[] = [];

  // The ground was five wavy lines and the university's initials set at an
  // angle. That is a texture, and it did the photocopier job — fine regular
  // pattern, dithers badly on a copy — but it said nothing, and a certificate
  // has only two surfaces that can speak without spending words: the watermark
  // and the paper.
  //
  // The paper now carries the same motif as the watermark, at a twentieth of
  // the size: a small graticule beside the initials, repeated across the whole
  // sheet. Standing back it reads as texture; under a loupe it is hundreds of
  // little globes, which is a thing a forger has to reproduce and a photocopier
  // turns to mud.
  const g = tile * 0.17;
  const gx = tile * 0.20;
  const gy = tile * 0.24;
  parts.push(
    `<g fill="none" stroke="${colour}" stroke-opacity="${(opacity * 1.5).toFixed(3)}" stroke-width="0.22">
      <circle cx="${(gx + g).toFixed(1)}" cy="${(gy + g).toFixed(1)}" r="${g.toFixed(1)}"/>
      <ellipse cx="${(gx + g).toFixed(1)}" cy="${(gy + g).toFixed(1)}" rx="${(g * 0.42).toFixed(1)}" ry="${g.toFixed(1)}"/>
      <ellipse cx="${(gx + g).toFixed(1)}" cy="${(gy + g).toFixed(1)}" rx="${(g * 0.82).toFixed(1)}" ry="${g.toFixed(1)}"/>
      <line x1="${gx.toFixed(1)}" y1="${(gy + g).toFixed(1)}" x2="${(gx + 2 * g).toFixed(1)}" y2="${(gy + g).toFixed(1)}"/>
      <ellipse cx="${(gx + g).toFixed(1)}" cy="${(gy + g).toFixed(1)}" rx="${g.toFixed(1)}" ry="${(g * 0.45).toFixed(1)}"/>
    </g>`,
  );

  // The lathe lines stay. They are what makes the ground read as an even tone
  // at arm's length rather than as a field of separate marks.
  for (let i = 0; i < 5; i += 1) {
    const y = (i / 5) * tile + r() * 2;
    parts.push(
      `<path d="M0,${y.toFixed(1)} Q${(tile / 4).toFixed(1)},${(y - 3).toFixed(1)} ${(tile / 2).toFixed(1)},${y.toFixed(1)} T${tile},${y.toFixed(1)}" ` +
      `fill="none" stroke="${colour}" stroke-width="0.25" stroke-opacity="${(opacity * 6).toFixed(3)}"/>`,
    );
  }

  parts.push(
    `<text x="${(tile * 0.66).toFixed(1)}" y="${(tile * 0.72).toFixed(1)}" text-anchor="middle" ` +
    `transform="rotate(-30 ${(tile * 0.66).toFixed(1)} ${(tile * 0.72).toFixed(1)})" ` +
    `font-family="Georgia,serif" font-size="${(tile * 0.15).toFixed(1)}" letter-spacing="1" ` +
    `fill="${colour}" fill-opacity="${opacity}">${escapeXml(mark)}</text>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}" viewBox="0 0 ${tile} ${tile}">
    ${parts.join('')}
  </svg>`;
}

export const securityGroundUri = (seed: number, tile: number, colour: string, mark: string, opacity?: number) =>
  enc(securityGround(seed, tile, colour, mark, opacity));

/* ------------------------------------------------------------------ */
/* Not a document layer: artwork for the printer                        */
/* ------------------------------------------------------------------ */

/**
 * The UV pass, as a file to hand a printer — NOT a feature of the certificate.
 *
 * Fluorescent ink is applied by a press, on a second pass, with a plate made
 * from artwork like this. A browser cannot emit invisible ink and no screen
 * effect is equivalent to it, so this returns the artwork and nothing else. The
 * Studio offers it as a download for the print shop and says exactly that; it
 * never shows a "UV layer" toggle on the document, because a toggle would imply
 * the university is producing something it is not.
 */
export function uvLayerSvg(credentialId: string, widthMm: number, heightMm: number): string {
  const seed = seedFrom(credentialId);
  const rosette = guillocheRosette(seed, 60, '#000000', 1)
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}">
  <!-- UV / invisible-ink pass for ${escapeXml(credentialId)}.
       Everything in this file prints in fluorescent ink on a separate pass.
       Black here means "ink"; the file carries no visible-pass artwork. -->
  <g transform="translate(${(widthMm / 2 - 30).toFixed(1)},${(heightMm / 2 - 30).toFixed(1)})">${rosette}</g>
  <text x="${widthMm / 2}" y="${heightMm - 14}" text-anchor="middle"
    font-family="Helvetica,Arial,sans-serif" font-size="4" letter-spacing="1.4">${escapeXml(credentialId)}</text>
</svg>`;
}

function escapeXml(v: string): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/* The date, in words                                                   */
/* ------------------------------------------------------------------ */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const ORDINAL_ONES = [
  '', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth',
  'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth',
  'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth',
];
const ORDINAL_TENS: Record<number, string> = { 20: 'Twentieth', 30: 'Thirtieth' };

/** "Fifth", "Twenty-First", "Thirtieth" — the day of the month, spelt. */
export function ordinalDay(day: number): string {
  if (day <= 20) return ORDINAL_ONES[day] ?? String(day);
  if (day % 10 === 0) return ORDINAL_TENS[day] ?? String(day);
  return `${TENS[Math.floor(day / 10)]}-${ORDINAL_ONES[day % 10]}`;
}

/** "Two Thousand Twenty-Six". Good from 2000 to 2099, which is the useful range. */
export function yearInWords(year: number): string {
  if (year < 2000 || year > 2099) return String(year);
  const rest = year - 2000;
  if (rest === 0) return 'Two Thousand';
  if (rest < 20) return `Two Thousand ${ONES[rest]}`;
  const t = TENS[Math.floor(rest / 10)];
  const o = ONES[rest % 10];
  return `Two Thousand ${o ? `${t}-${o}` : t}`;
}

/* ------------------------------------------------------------------ */
/* The ornate frame                                                     */
/* ------------------------------------------------------------------ */

/**
 * The engraved gold border, drawn from the university's own first certificate.
 *
 * WHAT WAS TAKEN FROM IT. The 2011 ICOF certificate is framed by a deep gilt
 * band: an outer fillet, a broad field carrying a repeated scroll-and-leaf
 * motif, a bead course, and a medallion at each corner. That frame is most of
 * why the document reads as an instrument the moment you see it, before a word
 * of it is read — and it is the single largest difference between it and the
 * plain double rule this system was drawing.
 *
 * WHAT WAS NOT TAKEN. It is redrawn, not traced. The original is a raster of a
 * printed sheet, photographed at an angle; scanning and re-using it would have
 * embedded somebody's photograph of a real graduate's certificate into every
 * document the university issues, at whatever resolution the phone managed.
 * This is geometry — it holds at any size, prints at press resolution, and
 * weighs a few kilobytes.
 *
 * The gold is three stops rather than one flat fill, because gilt is not a
 * colour, it is a gradient: the reason a photocopy of a gilded certificate
 * looks obviously wrong is that the copier renders the gradient as a single
 * muddy tone.
 */
export function ornateFrame(
  widthMm: number,
  heightMm: number,
  gold: string,
  deep: string,
  bandMm = 11,
): string {
  const w = widthMm;
  const h = heightMm;
  const b = bandMm;
  const id = `f${Math.round(w)}x${Math.round(h)}`;

  // One tile of the scroll course. A C-scroll, a leaf springing from it, and a
  // lozenge between — the motif that repeats all the way round.
  const tile = 14;
  const motif = `
    <g fill="none" stroke="${deep}" stroke-width="0.55" stroke-linecap="round">
      <path d="M1,${b / 2} C1,${b * 0.18} ${tile * 0.28},${b * 0.16} ${tile * 0.30},${b / 2}
               C${tile * 0.32},${b * 0.84} ${tile * 0.06},${b * 0.82} ${tile * 0.10},${b / 2}"/>
      <path d="M${tile * 0.34},${b / 2} C${tile * 0.44},${b * 0.14} ${tile * 0.60},${b * 0.20} ${tile * 0.64},${b / 2}
               C${tile * 0.60},${b * 0.80} ${tile * 0.44},${b * 0.86} ${tile * 0.34},${b / 2}"/>
      <path d="M${tile * 0.66},${b * 0.30} L${tile * 0.82},${b / 2} L${tile * 0.66},${b * 0.70}
               L${tile * 0.50},${b / 2} Z" stroke-width="0.45"/>
      <circle cx="${tile * 0.92}" cy="${b / 2}" r="0.9" fill="${deep}" stroke="none"/>
    </g>`;

  // A corner medallion: a rosette in a lobed frame, of the kind cast into the
  // corners of an engraved border.
  const medallion = (cx: number, cy: number, r: number) => {
    const petals: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      petals.push(
        `<ellipse cx="${(cx + Math.cos(a) * r * 0.42).toFixed(2)}" cy="${(cy + Math.sin(a) * r * 0.42).toFixed(2)}" ` +
        `rx="${(r * 0.30).toFixed(2)}" ry="${(r * 0.16).toFixed(2)}" ` +
        `transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${(cx + Math.cos(a) * r * 0.42).toFixed(2)} ${(cy + Math.sin(a) * r * 0.42).toFixed(2)})" ` +
        `fill="none" stroke="${deep}" stroke-width="0.4"/>`,
      );
    }
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-gold)" stroke="${deep}" stroke-width="0.5"/>
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.80).toFixed(2)}" fill="none" stroke="${deep}" stroke-width="0.35"/>
      ${petals.join('')}
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.16).toFixed(2)}" fill="${deep}"/>
    </g>`;
  };

  const m = b * 0.92;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%"   stop-color="${gold}" stop-opacity="0.35"/>
      <stop offset="38%"  stop-color="${gold}" stop-opacity="0.95"/>
      <stop offset="62%"  stop-color="${deep}" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="${gold}" stop-opacity="0.45"/>
    </linearGradient>
    <pattern id="${id}-scroll" width="${tile}" height="${b}" patternUnits="userSpaceOnUse">${motif}</pattern>
  </defs>

  <!-- the gilt field, as a frame: a filled rect with the middle cut out by
       fill-rule evenodd, so nothing is painted over the paper. -->
  <path fill="url(#${id}-gold)" fill-rule="evenodd"
        d="M0,0 H${w} V${h} H0 Z M${b},${b} H${w - b} V${h - b} H${b} Z"/>
  <path fill="url(#${id}-scroll)" fill-rule="evenodd"
        d="M0,0 H${w} V${h} H0 Z M${b},${b} H${w - b} V${h - b} H${b} Z"/>

  <!-- fillets: a fine rule either side of the field, and a bead course inside -->
  <rect x="0.6" y="0.6" width="${w - 1.2}" height="${h - 1.2}" fill="none" stroke="${deep}" stroke-width="0.7"/>
  <rect x="${b - 0.5}" y="${b - 0.5}" width="${w - 2 * b + 1}" height="${h - 2 * b + 1}" fill="none" stroke="${deep}" stroke-width="0.7"/>
  <rect x="${b + 1.6}" y="${b + 1.6}" width="${w - 2 * b - 3.2}" height="${h - 2 * b - 3.2}" fill="none" stroke="${deep}" stroke-width="0.35"/>

  ${medallion(m, m, b * 0.62)}
  ${medallion(w - m, m, b * 0.62)}
  ${medallion(m, h - m, b * 0.62)}
  ${medallion(w - m, h - m, b * 0.62)}
</svg>`;
}

export const ornateFrameUri = (w: number, h: number, gold: string, deep: string, band?: number) =>
  enc(ornateFrame(w, h, gold, deep, band));

/* ------------------------------------------------------------------ */
/* The wafer seal                                                       */
/* ------------------------------------------------------------------ */

/**
 * The red foil wafer, as on the university's first certificate.
 *
 * A starburst wafer applied over the paper and embossed — the thing a hand
 * reaches for first when someone is deciding whether a document is real,
 * because it is the one feature that is felt rather than seen.
 *
 * Printing it flat cannot reproduce that, and nothing here pretends to: what
 * this gives is the artwork, correctly registered, for a university that
 * applies a real foil wafer over it. Drawn rather than photographed for the
 * same reason as the frame — it is geometry, so it holds at press resolution
 * and cannot be lifted as a file from one document and pasted onto another.
 */
export function waferSeal(
  seed: number,
  size: number,
  colour: string,
  legend: string,
  centre: string,
): string {
  const R = size / 2;
  const id = `w${seed.toString(36)}`;
  const points = 24;
  const outer = R * 0.98;
  const inner = R * 0.80;

  const star: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    star.push(`${(R + Math.cos(a) * r).toFixed(2)},${(R + Math.sin(a) * r).toFixed(2)}`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <!-- The highlight sits in the top-left quadrant and the shadow only at the
         very edge. Running black from the midpoint outwards, as this first did,
         desaturated the whole wafer to grey — foil reads as metal, not as a
         dark version of its own colour. -->
    <radialGradient id="${id}-wax" cx="34%" cy="30%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.62"/>
      <stop offset="26%"  stop-color="${colour}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${colour}" stop-opacity="1"/>
    </radialGradient>
    <path id="${id}-arc" d="M ${R},${R} m -${R * 0.60},0 a ${R * 0.60},${R * 0.60} 0 1,1 ${R * 1.20},0 a ${R * 0.60},${R * 0.60} 0 1,1 -${R * 1.20},0"/>
  </defs>
  <!-- The rim is a stroke, not a gradient stop. A dark stop inside a radial
       gradient reaches the star's points first, so the tips came out silver
       while the middle stayed red — the wafer read as pressed metal rather than
       as foil. -->
  <polygon points="${star.join(' ')}" fill="url(#${id}-wax)"/>
  <polygon points="${star.join(' ')}" fill="none" stroke="#000000" stroke-opacity="0.22" stroke-width="${(size * 0.008).toFixed(2)}"/>
  <circle cx="${R}" cy="${R}" r="${(R * 0.74).toFixed(2)}" fill="none" stroke="#ffffff" stroke-opacity="0.32" stroke-width="${(size * 0.012).toFixed(2)}"/>
  <circle cx="${R}" cy="${R}" r="${(R * 0.46).toFixed(2)}" fill="none" stroke="#ffffff" stroke-opacity="0.24" stroke-width="${(size * 0.020).toFixed(2)}"/>
  <text font-family="Georgia,'Times New Roman',serif" font-size="${(size * 0.072).toFixed(2)}"
        letter-spacing="${(size * 0.014).toFixed(2)}" fill="#ffffff" fill-opacity="0.82">
    <textPath href="#${id}-arc" startOffset="2%">${escapeXml(legend)}</textPath>
  </text>
  <text x="${R}" y="${(R + size * 0.035).toFixed(2)}" text-anchor="middle"
        font-family="Georgia,'Times New Roman',serif" font-size="${(size * 0.11).toFixed(2)}"
        font-weight="bold" fill="#ffffff" fill-opacity="0.9">${escapeXml(centre)}</text>
</svg>`;
}

export const waferSealUri = (seed: number, size: number, colour: string, legend: string, centre: string) =>
  enc(waferSeal(seed, size, colour, legend, centre));

/* ------------------------------------------------------------------ */
/* Layer: the guilloché globe                                           */
/* ------------------------------------------------------------------ */

/**
 * A wireframe globe, engine-turned, for a university whose name is Global.
 *
 * WHY A GLOBE AND NOT MORE ROSETTE. The rosette is a beautiful abstraction and
 * it says nothing. This university is the International Circle of Faith's
 * global university — it teaches in Cameroon, admits from a dozen countries and
 * sends its awards to be read on other continents — and its most-photographed
 * document had no mark of that anywhere on it. A watermark is the one place a
 * document can say what an institution is without spending words on it.
 *
 * WHY IT IS ALSO A BETTER SECURITY FIGURE. A graticule is the same kind of
 * object as a guilloché: every line is determined by an equation, so a hand
 * copy goes wrong everywhere at once rather than in one visible place. It is
 * strictly harder than the rosette, because the meridians are not concentric —
 * their spacing follows a cosine, and getting that wrong is obvious to anyone
 * who has ever looked at a map.
 *
 * HOW IT IS DRAWN. Properly, in three dimensions and projected, rather than as
 * a stack of ellipses that approximate the look. Points on the sphere are
 * rotated about the polar axis to tilt it toward the viewer and projected
 * orthographically; the far hemisphere is drawn at a lower weight, which is how
 * an engraver renders a transparent sphere and is what makes it read as round
 * rather than as a flat target.
 */
export function guillocheGlobe(
  seed: number,
  size: number,
  colour: string,
  opacity = 0.5,
): string {
  const r = rng(seed);
  const R = size / 2;
  const radius = R * 0.86;

  // Axial tilt, so the pole leans toward the reader. 23.4° is the earth's, and
  // using it rather than a round number is the sort of thing that costs nothing
  // and is right.
  const tilt = (23.4 * Math.PI) / 180;
  const spin = r() * Math.PI * 2;

  // Strokes scale with the figure.
  //
  // They were fixed at a third of a unit, which was legible at the size this
  // was first drawn at and vanished on the certificate — a rosette survives
  // being set faint because sixteen overlapping curves read as one mass, and a
  // graticule does not, because its lines are separate by construction. Scaled,
  // and roughly twice as heavy as the rosette's, so the two figures carry
  // similar weight when they are laid over one another.
  const sw = (base: number) => (base * size) / 400;

  const project = (latDeg: number, lonDeg: number) => {
    const la = (latDeg * Math.PI) / 180;
    const lo = (lonDeg * Math.PI) / 180 + spin;
    const x = Math.cos(la) * Math.cos(lo);
    const y = Math.cos(la) * Math.sin(lo);
    const z = Math.sin(la);
    // Rotate about the x-axis to tilt the pole toward the viewer.
    const yt = y * Math.cos(tilt) - z * Math.sin(tilt);
    const zt = y * Math.sin(tilt) + z * Math.cos(tilt);
    return {
      x: R + x * radius,
      y: R - zt * radius,
      // Positive is the near hemisphere. The far side is drawn lighter.
      front: yt >= 0,
    };
  };

  const strokes: string[] = [];
  const emit = (pts: { x: number; y: number; front: boolean }[], width: number) => {
    // Split the curve wherever it crosses the limb, so the near and far halves
    // can carry different weights without one polyline spanning both.
    let run: string[] = [];
    let runFront = pts[0]?.front ?? true;
    const flush = () => {
      if (run.length > 1) {
        strokes.push(
          `<polyline points="${run.join(' ')}" fill="none" stroke="${colour}" ` +
          `stroke-width="${width.toFixed(2)}" ` +
          `stroke-opacity="${(opacity * (runFront ? 0.85 : 0.32)).toFixed(3)}"/>`,
        );
      }
      run = [];
    };
    for (const p of pts) {
      if (p.front !== runFront) { flush(); runFront = p.front; }
      run.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
    }
    flush();
  };

  // Meridians every 15°, which is one hour of longitude.
  for (let lon = 0; lon < 180; lon += 15) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 2) pts.push(project(lat, lon));
    for (let lat = 90; lat >= -90; lat -= 2) pts.push(project(lat, lon + 180));
    emit(pts, sw(lon === 0 ? 1.0 : 0.66));
  }

  // Parallels every 15°, and the tropics and circles at their true latitudes —
  // 23.4 and 66.6 — because a globe with evenly spaced parallels is a diagram
  // and one with the real ones is a globe.
  const parallels = [-66.6, -45, -23.4, 0, 23.4, 45, 66.6];
  for (const lat of parallels) {
    const pts = [];
    for (let lon = 0; lon <= 360; lon += 2) pts.push(project(lat, lon));
    emit(pts, sw(Math.abs(lat) < 0.01 ? 1.05 : 0.62));
  }

  // The limb, and a fine engine-turned ground inside it — the plain lathe work
  // that sits under the figures on a banknote.
  const spokes = 144;
  const ground: string[] = [];
  for (let i = 0; i < spokes; i += 1) {
    const a = (i / spokes) * Math.PI * 2;
    ground.push(
      `M${(R + Math.cos(a) * radius * 0.14).toFixed(2)},${(R + Math.sin(a) * radius * 0.14).toFixed(2)} ` +
      `L${(R + Math.cos(a) * radius * 0.995).toFixed(2)},${(R + Math.sin(a) * radius * 0.995).toFixed(2)}`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <path d="${ground.join(' ')}" fill="none" stroke="${colour}" stroke-width="${sw(0.3).toFixed(2)}"
        stroke-opacity="${(opacity * 0.20).toFixed(3)}"/>
  ${strokes.join('')}
  <circle cx="${R}" cy="${R}" r="${radius.toFixed(2)}" fill="none" stroke="${colour}"
          stroke-width="${sw(1.3).toFixed(2)}" stroke-opacity="${(opacity * 0.95).toFixed(3)}"/>
  <circle cx="${R}" cy="${R}" r="${(radius * 1.045).toFixed(2)}" fill="none" stroke="${colour}"
          stroke-width="${sw(0.5).toFixed(2)}" stroke-opacity="${(opacity * 0.55).toFixed(3)}"/>
</svg>`;
}

export const guillocheGlobeUri = (seed: number, size: number, colour: string, opacity?: number) =>
  enc(guillocheGlobe(seed, size, colour, opacity));

/**
 * The globe set within the rosette — the mark this university's certificate
 * carries by default.
 *
 * The rosette is the security figure and the globe is the institution; laying
 * one inside the other means the watermark does both jobs at once instead of
 * choosing. The rosette is held back to about a third of the globe's weight so
 * it reads as the ground rather than competing with it.
 */
export function globeInRosette(
  seed: number,
  size: number,
  colour: string,
  opacity = 0.5,
): string {
  const inner = size * 0.58;
  // The outer band only. The full three-band figure would put a second rosette
  // inside the sphere and make the graticule unreadable — which is what it did.
  const rosette = guillocheRosette(seed, size, colour, opacity * 0.55, 1)
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const globe = guillocheGlobe(seed ^ 0x5bf03635, inner, colour, opacity)
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const off = ((size - inner) / 2).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${rosette}
  <g transform="translate(${off},${off})">${globe}</g>
</svg>`;
}

export const globeInRosetteUri = (seed: number, size: number, colour: string, opacity?: number) =>
  enc(globeInRosette(seed, size, colour, opacity));

/* ------------------------------------------------------------------ */
/* The institutional device                                             */
/* ------------------------------------------------------------------ */

/**
 * The coastlines, as longitude/latitude pairs.
 *
 * NOT AFRICA ALONE. The first version of this drew only Africa, and that was
 * wrong about the institution: this is a GLOBAL university that calls itself the
 * community university OF Africa — the continent is where it stands, not the
 * limit of where it reaches. A globe showing one continent on an otherwise
 * empty earth says the opposite of what the name says.
 *
 * So it draws the whole hemisphere the reader can see from 20°E: Africa at the
 * centre, Europe above it, Arabia and the Indian subcontinent running off the
 * eastern limb, the Brazilian bulge at the western one. Africa is central
 * because of where the university stands; the rest is there because of where it
 * teaches.
 *
 * Simplified to the point where each shape is unmistakable and no further. Hand
 * placed rather than traced from a shapefile: a shapefile would be megabytes,
 * would need a licence, and would carry more precision than a watermark can
 * print. This is a device, not a survey.
 */
const COASTLINES: [number, number][][] = [
  // Africa. The Gulf of Guinea, the Horn, the Cape and the western bulge are
  // the four features that make the outline recognisable.
  [
    [10.2, 37.1], [15.0, 32.0], [20.0, 32.5], [25.0, 31.5], [30.0, 31.5], [32.5, 31.0],
    [34.0, 28.0], [35.0, 24.0], [37.0, 21.0], [38.5, 18.0], [39.5, 15.0], [43.0, 12.5],
    [48.0, 11.5], [51.4, 11.8], [48.0, 5.0], [44.0, 2.0], [41.0, -2.0], [40.0, -6.0],
    [40.5, -10.5], [40.0, -15.0], [35.0, -20.0], [32.5, -25.0], [30.0, -30.0],
    [27.0, -33.5], [22.0, -34.0], [18.5, -34.4], [17.0, -30.0], [13.5, -23.0],
    [12.0, -17.0], [13.0, -12.0], [12.0, -6.0], [9.5, -1.0], [9.0, 4.0], [5.0, 5.2],
    [0.0, 5.5], [-4.0, 5.0], [-8.0, 4.5], [-13.0, 8.0], [-16.0, 12.0], [-17.5, 15.0],
    [-16.5, 20.0], [-14.0, 25.0], [-10.0, 30.0], [-6.0, 35.9], [0.0, 36.5], [5.0, 37.0],
    [10.2, 37.1],
  ],
  // Europe: Iberia, the Mediterranean, the Black Sea, the Baltic, Scandinavia.
  [
    [-9.5, 43.8], [-9.0, 37.0], [-5.6, 36.0], [0.0, 39.0], [5.0, 43.0], [10.0, 44.0],
    [13.5, 45.5], [16.0, 43.0], [19.0, 42.0], [23.0, 38.0], [27.0, 40.0], [30.0, 41.0],
    [35.0, 44.0], [39.0, 44.0], [37.0, 47.0], [32.0, 46.0], [30.0, 47.0], [31.0, 52.0],
    [28.0, 55.0], [24.0, 57.0], [21.0, 56.0], [19.0, 54.0], [13.0, 54.0], [9.0, 55.0],
    [8.0, 57.0], [11.0, 59.0], [15.0, 65.0], [21.0, 69.0], [27.0, 71.0], [31.0, 70.0],
    [25.0, 65.0], [20.0, 60.0], [16.0, 57.0], [12.0, 55.0], [7.0, 53.0], [3.0, 52.0],
    [-1.0, 50.0], [-4.0, 48.0], [-1.0, 45.0], [-9.5, 43.8],
  ],
  // The British Isles, small but the thing a European reader looks for first.
  [
    [-5.0, 50.0], [-3.0, 51.0], [1.0, 51.5], [1.0, 53.0], [-1.0, 55.0], [-2.0, 57.0],
    [-5.0, 58.5], [-6.0, 56.0], [-5.0, 54.0], [-3.0, 53.0], [-5.0, 52.0], [-5.0, 50.0],
  ],
  // Arabia.
  [
    [43.0, 12.5], [45.0, 13.0], [48.0, 14.0], [52.0, 17.0], [56.0, 22.0], [57.0, 24.0],
    [55.0, 26.5], [51.0, 26.0], [48.0, 29.0], [43.0, 30.0], [39.0, 28.0], [38.0, 24.0],
    [40.0, 20.0], [43.0, 15.0], [43.0, 12.5],
  ],
  // The Indian subcontinent, running off the eastern limb.
  [
    [68.0, 23.5], [72.0, 20.0], [73.5, 16.0], [76.0, 9.0], [78.0, 8.0], [80.0, 13.0],
    [80.5, 16.0], [84.0, 19.0], [87.0, 21.5], [89.0, 22.0],
  ],
  // Madagascar.
  [
    [49.5, -12.5], [50.5, -15.5], [49.0, -18.0], [47.0, -22.0], [45.0, -25.0],
    [43.5, -24.0], [43.5, -20.0], [44.5, -16.0], [46.5, -15.0], [48.5, -13.0],
    [49.5, -12.5],
  ],
  // The Brazilian bulge, at the western limb — the edge of the Americas, which
  // is as much as this face of the earth shows.
  [
    [-35.0, -5.0], [-38.5, -13.0], [-39.0, -18.0], [-42.0, -23.0], [-48.0, -26.0],
    [-52.0, -32.0], [-58.0, -35.0],
  ],
];

/**
 * The world as a flat map, drawn on the azimuthal equidistant projection.
 *
 * WHY THIS PROJECTION AND NOT A RECTANGLE. The device is a roundel. A
 * rectangular world map cropped into a circle loses the corners, which are
 * Alaska and New Zealand — and a map that cuts off land to fit its frame looks
 * like a mistake. The azimuthal equidistant is circular BY CONSTRUCTION: the
 * North Pole is the centre, every meridian a straight radius, every parallel a
 * concentric circle. It is the projection on the United Nations emblem.
 *
 * IT IS CUT AT 60°S, as that emblem is. On this projection the South Pole is
 * not a point but the entire outer rim, so Antarctica could only be drawn as a
 * smear round the edge of the disc.
 *
 * THE ROTATION IS FIXED, not seeded: 20°E runs straight DOWN from the pole, so
 * Africa sits at the foot of the map, centred, on every certificate.
 *
 * WHY THE FIRST VERSION OF THIS READ AS A LOCAL MAP, and what was changed.
 *
 *   The coastlines were the GLOBE's. That data stops at the limb of a sphere
 *   turned to 20°E, because a globe cannot show the other hemisphere — so the
 *   flat map had Africa and Europe in detail and the rest of the world as four
 *   fragments. A world map carrying one hemisphere properly and the other in
 *   pieces does not read as a world. See worldCoastlines.ts.
 *
 *   The land was wire outline over a graticule of almost the same weight, so
 *   the eye could not separate land from sea and the whole disc read as a
 *   target. The land is now FILLED — very lightly — and the graticule is
 *   quieter than the coast at every level.
 *
 *   The meridians converged on the exact centre, which put a black starburst at
 *   the pole. They now stop short of it and the pole is a small open circle,
 *   which is what an engraver would have done.
 *
 * Africa is still drawn heaviest. That is not an accident of the data: it is
 * where this university stands, and the rest of the world is at full strength
 * around it because that is where it teaches.
 */
export function flatWorld(
  seed: number,
  size: number,
  colour: string,
  opacity = 0.5,
): string {
  const R = size / 2;
  const radius = R * 0.86;
  const CUT = -60;          // the southern limit of the map
  const SPAN = 90 - CUT;    // degrees of latitude from pole to rim
  const HUB = 0.055;        // where the meridians stop, as a fraction of radius

  // 20°E points straight down, so Africa is at the foot and centred.
  const project = (latDeg: number, lonDeg: number) => {
    const r = ((90 - latDeg) / SPAN) * radius;
    const a = ((lonDeg - 20) * Math.PI) / 180;
    return { x: R + r * Math.sin(a), y: R + r * Math.cos(a), on: latDeg >= CUT };
  };

  const sw = (base: number) => (base * size) / 400;
  const out: string[] = [];

  // Anything south of the cut is off the map. DROPPED rather than clamped: a
  // clamped point sits on the rim and draws a false coastline round the edge.
  const line = (pts: { x: number; y: number; on: boolean }[], width: number, o: number) => {
    let run: string[] = [];
    const flush = () => {
      if (run.length > 1) {
        out.push(
          `<polyline points="${run.join(' ')}" fill="none" stroke="${colour}" ` +
          `stroke-width="${width.toFixed(2)}" stroke-linejoin="round" ` +
          `stroke-opacity="${(opacity * o).toFixed(3)}"/>`,
        );
      }
      run = [];
    };
    for (const p of pts) {
      if (!p.on) { flush(); continue; }
      run.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
    }
    flush();
  };

  // --- the graticule, under everything and quieter than everything ---------
  for (let lon = 0; lon < 360; lon += 15) {
    const a = ((lon - 20) * Math.PI) / 180;
    out.push(
      `<path d="M${(R + Math.sin(a) * radius * HUB).toFixed(2)},${(R + Math.cos(a) * radius * HUB).toFixed(2)} ` +
      `L${(R + Math.sin(a) * radius).toFixed(2)},${(R + Math.cos(a) * radius).toFixed(2)}" ` +
      `stroke="${colour}" stroke-width="${sw(0.42).toFixed(2)}" ` +
      `stroke-opacity="${(opacity * 0.30).toFixed(3)}"/>`,
    );
  }
  for (let lat = 75; lat >= CUT; lat -= 15) {
    const r = ((90 - lat) / SPAN) * radius;
    out.push(
      `<circle cx="${R}" cy="${R}" r="${r.toFixed(2)}" fill="none" stroke="${colour}" ` +
      `stroke-width="${sw(lat === 0 ? 0.75 : 0.42).toFixed(2)}" ` +
      `stroke-opacity="${(opacity * (lat === 0 ? 0.44 : 0.28)).toFixed(3)}"/>`,
    );
  }
  for (const lat of [23.4, -23.4]) {
    const r = ((90 - lat) / SPAN) * radius;
    out.push(
      `<circle cx="${R}" cy="${R}" r="${r.toFixed(2)}" fill="none" stroke="${colour}" ` +
      `stroke-width="${sw(0.36).toFixed(2)}" stroke-dasharray="${sw(2).toFixed(2)} ${sw(2).toFixed(2)}" ` +
      `stroke-opacity="${(opacity * 0.24).toFixed(3)}"/>`,
    );
  }
  // The pole itself, as an open circle rather than a knot of meridians.
  out.push(
    `<circle cx="${R}" cy="${R}" r="${(radius * HUB).toFixed(2)}" fill="none" stroke="${colour}" ` +
    `stroke-width="${sw(0.42).toFixed(2)}" stroke-opacity="${(opacity * 0.35).toFixed(3)}"/>`,
  );

  // --- the land ------------------------------------------------------------
  //
  // WHY THIS IS HATCHED AND WATER-LINED RATHER THAN FILLED FLAT.
  //
  // A flat tint inside an outline reads as a diagram. Nobody has ever drawn a
  // map that way with a burin, and the eye knows it. The two things that make
  // an engraved map look like a map are older than printing:
  //
  //   HATCHING. The land is not a colour, it is a texture — close parallel
  //   lines cut at a constant angle, dense enough to read as tone from across a
  //   room and separable into lines under a loupe. That is exactly the property
  //   a security ground needs, so it is not decoration bought at a cost.
  //
  //   WATER-LINES. The engraver's convention for sea: two or three lines
  //   following the coast a little way out, each fainter than the last. It is
  //   what makes a coastline read as a shore rather than as a border, and it is
  //   the single strongest signal that a map was drawn rather than generated.
  //
  // The offsets are TRUE VERTEX-NORMAL OFFSETS, not the ring scaled about its
  // centroid. Scaling looks right on a circle and wrong on everything else: on
  // Eurasia it would push the Atlantic coast out by a centimetre and the
  // Kamchatka coast by a millimetre, because those vertices are at wildly
  // different distances from the middle.
  const ringPts = (ring: readonly (readonly [number, number])[]) =>
    ring.map(([lon, lat]) => project(lat, lon)).filter((p) => p.on);

  // Which way is out. Positive shoelace area means one winding, negative the
  // other, and the normal has to be flipped for one of them or the water-lines
  // are drawn INSIDE the land.
  const outward = (pts: { x: number; y: number }[]) => {
    let a = 0;
    for (let i = 0; i < pts.length; i += 1) {
      const q = pts[(i + 1) % pts.length];
      a += pts[i].x * q.y - q.x * pts[i].y;
    }
    return a > 0 ? 1 : -1;
  };

  const offsetRing = (pts: { x: number; y: number }[], d: number) => {
    const sign = outward(pts);
    const n = pts.length;
    return pts.map((p, i) => {
      const a = pts[(i - 1 + n) % n];
      const b = pts[(i + 1) % n];
      // The bisector of the two adjacent edge normals.
      let nx = (b.y - a.y);
      let ny = -(b.x - a.x);
      const len = Math.hypot(nx, ny) || 1;
      nx = (nx / len) * d * sign;
      ny = (ny / len) * d * sign;
      return { x: p.x + nx, y: p.y + ny };
    });
  };

  const clipId = `w${seed.toString(36)}land`;
  const landShapes: string[] = [];

  WORLD.forEach((ring) => {
    const pts = ringPts(ring);
    if (pts.length < 3) return;
    const poly = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    landShapes.push(`<polygon points="${poly}"/>`);

    // Water-lines, outside in, each fainter than the one before it.
    [1.6, 3.4, 5.6].forEach((d, k) => {
      const o = offsetRing(pts, sw(d));
      out.push(
        `<polygon points="${o.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" ` +
        `fill="none" stroke="${colour}" stroke-width="${sw(0.34).toFixed(2)}" ` +
        `stroke-linejoin="round" ` +
        `stroke-opacity="${(opacity * [0.30, 0.20, 0.12][k]).toFixed(3)}"/>`,
      );
    });

    // A whisper of tone under the hatching, so the land does not go pale where
    // the hatch lines happen to fall wide.
    out.push(
      `<polygon points="${poly}" fill="${colour}" ` +
      `fill-opacity="${(opacity * 0.05).toFixed(3)}" stroke="none"/>`,
    );
  });

  // The hatch. ONE family of lines across the whole disc, clipped to every
  // landmass at once — not a set per continent. A clip per landmass would mean
  // eighteen clip paths and eighteen line families for an identical result, and
  // it would let the angle drift between continents, which is the one thing an
  // engraver would never allow.
  const hatch: string[] = [];
  const step = size / 96;
  for (let y = R - radius * 1.5; y <= R + radius * 1.5; y += step) {
    hatch.push(
      `M${(R - radius * 1.5).toFixed(2)},${y.toFixed(2)} L${(R + radius * 1.5).toFixed(2)},${y.toFixed(2)}`,
    );
  }
  out.push(
    `<clipPath id="${clipId}">${landShapes.join('')}</clipPath>` +
    // THE ROTATION GOES INSIDE THE CLIP, in its own group. With both on one
    // element the clip path resolves in that element's user space AFTER its
    // transform — so the land shapes were rotated -32° along with the hatch and
    // the lines came out over open ocean, thirty degrees away from the
    // continent they belonged to.
    `<g clip-path="url(#${clipId})">` +
    `<g transform="rotate(-32 ${R} ${R})">` +
    `<path d="${hatch.join(' ')}" fill="none" stroke="${colour}" ` +
    `stroke-width="${sw(0.34).toFixed(2)}" stroke-opacity="${(opacity * 0.34).toFixed(3)}"/>` +
    `</g></g>`,
  );

  // The coasts last, over the hatch and the water-lines, so the shore is the
  // hardest line on the map. Africa heaviest: it is where this university
  // stands, and the rest of the world is at full strength around it because
  // that is where it teaches.
  WORLD.forEach((ring) => {
    const pts = ring.map(([lon, lat]) => project(lat, lon));
    const africa = ring === AFRICA;
    line(pts, sw(africa ? 1.6 : 1.05), africa ? 1 : 0.85);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${out.join('')}
  <circle cx="${R}" cy="${R}" r="${radius.toFixed(2)}" fill="none" stroke="${colour}"
          stroke-width="${sw(1.3).toFixed(2)}" stroke-opacity="${(opacity * 0.95).toFixed(3)}"/>
  <circle cx="${R}" cy="${R}" r="${(radius * 1.035).toFixed(2)}" fill="none" stroke="${colour}"
          stroke-width="${sw(0.45).toFixed(2)}" stroke-opacity="${(opacity * 0.5).toFixed(3)}"/>
</svg>`;
}

/**
 * The world, turned so that Africa is at the centre of it.
 *
 * THIS IS THE ANSWER TO "the background is generic". A guilloché rosette is
 * beautiful and it is on ten thousand certificate templates. A wireframe globe
 * is better and it is still a stock motif. A world with its coastlines drawn
 * and Africa in the middle belongs to one institution: the International Circle
 * of Faith's GLOBAL university, which calls itself the community university of
 * Africa. Nobody else's document can carry it without saying so.
 *
 * The emphasis matters and the first version got it backwards. Drawing Africa
 * alone on an empty earth says the university's reach stops at the continent,
 * which is the opposite of its name. Africa is central because that is where it
 * stands; the rest of the hemisphere is there because that is where it teaches.
 *
 * The spin is computed rather than random — 20°E faces the viewer — so every
 * certificate shows the same face of the earth. The seed still varies the
 * figure around it, so two documents are not identical.
 */
export function africaGlobe(
  seed: number,
  size: number,
  colour: string,
  opacity = 0.5,
): string {
  const R = size / 2;
  const radius = R * 0.86;
  const tilt = (23.4 * Math.PI) / 180;

  // Put 20°E at the centre of the visible face. In the projection below the
  // near point is at longitude 90°, so the offset is 90 − 20.
  const spin = ((90 - 20) * Math.PI) / 180;

  const project = (latDeg: number, lonDeg: number) => {
    const la = (latDeg * Math.PI) / 180;
    const lo = (lonDeg * Math.PI) / 180 + spin;
    const x = Math.cos(la) * Math.cos(lo);
    const y = Math.cos(la) * Math.sin(lo);
    const z = Math.sin(la);
    const yt = y * Math.cos(tilt) - z * Math.sin(tilt);
    const zt = y * Math.sin(tilt) + z * Math.cos(tilt);
    return { x: R + x * radius, y: R - zt * radius, front: yt >= 0 };
  };

  const sw = (base: number) => (base * size) / 400;
  const out: string[] = [];

  const emit = (pts: { x: number; y: number; front: boolean }[], width: number, near: number, far: number) => {
    let run: string[] = [];
    let runFront = pts[0]?.front ?? true;
    const flush = () => {
      if (run.length > 1) {
        out.push(
          `<polyline points="${run.join(' ')}" fill="none" stroke="${colour}" ` +
          `stroke-width="${width.toFixed(2)}" stroke-linejoin="round" ` +
          `stroke-opacity="${(opacity * (runFront ? near : far)).toFixed(3)}"/>`,
        );
      }
      run = [];
    };
    for (const p of pts) {
      if (p.front !== runFront) { flush(); runFront = p.front; }
      run.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
    }
    flush();
  };

  // The graticule, quieter than before — it is the ground the continent sits on
  // rather than the subject.
  for (let lon = 0; lon < 180; lon += 20) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 2) pts.push(project(lat, lon));
    for (let lat = 90; lat >= -90; lat -= 2) pts.push(project(lat, lon + 180));
    emit(pts, sw(0.5), 0.5, 0.2);
  }
  for (const lat of [-66.6, -45, -23.4, 0, 23.4, 45, 66.6]) {
    const pts = [];
    for (let lon = 0; lon <= 360; lon += 2) pts.push(project(lat, lon));
    emit(pts, sw(Math.abs(lat) < 0.01 ? 0.75 : 0.46), 0.5, 0.2);
  }

  // The land. Drawn at full weight over the graticule — it is the thing the
  // reader is meant to recognise. Africa is drawn heaviest of all: it is the
  // centre of this face and the centre of the university's own description of
  // itself.
  COASTLINES.forEach((shape, i) => {
    const coast = shape.map(([lon, lat]) => project(lat, lon));
    emit(coast, sw(i === 0 ? 1.6 : 1.0), i === 0 ? 1 : 0.7, 0.12);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${out.join('')}
  <circle cx="${R}" cy="${R}" r="${radius.toFixed(2)}" fill="none" stroke="${colour}"
          stroke-width="${sw(1.3).toFixed(2)}" stroke-opacity="${(opacity * 0.95).toFixed(3)}"/>
</svg>`;
}

/**
 * The device: Africa on the globe, in a ring of the university's own words,
 * flanked by laurel, with the year of foundation at the foot.
 *
 * Every element is the institution's rather than a stock ornament — the
 * continent it names itself after, the motto it publishes, the year it was
 * founded. Set as one figure so a forger cannot lift a generic rosette from
 * another template and have it pass.
 *
 * The ring text is real microtext: legible under a loupe on an original,
 * a smear on a photocopy. It is a security feature and a statement of identity
 * in the same stroke, which is the only reason it is worth the space.
 */
export function institutionalDevice(
  seed: number,
  size: number,
  colour: string,
  legend: string[],
  founded: string,
  opacity = 0.5,
): string {
  const R = size / 2;
  const id = `d${seed.toString(36)}`;
  const inner = size * 0.62;
  const off = ((size - inner) / 2).toFixed(2);

  const globe = africaGlobe(seed, inner, colour, opacity)
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

  // Laurel: two branches springing from the foot and curving up either side.
  //
  // A stem with leaves on it, not a scatter of ovals on a circle — which is
  // what the first attempt drew, because the leaves were placed on the arc and
  // nothing joined them. A wreath is read as two branches; without the stem it
  // reads as confetti.
  //
  // It stops at the horizontal on both sides. The upper third of the ring
  // belongs to the university's words, and a wreath that closes over the top
  // would either cover them or force them smaller than a loupe can help with.
  const laurel = (mirror: boolean) => {
    const parts: string[] = [];
    const r = R * 0.845;
    const from = 0.06;
    const to = 0.52;
    const at = (t: number) => {
      const a = Math.PI * (0.5 + (mirror ? -t : t));
      return { a, x: R + Math.cos(a) * r, y: R + Math.sin(a) * r };
    };

    const stem: string[] = [];
    for (let i = 0; i <= 40; i += 1) {
      const pt = at(from + (i / 40) * (to - from));
      stem.push(`${pt.x.toFixed(2)},${pt.y.toFixed(2)}`);
    }
    parts.push(
      `<polyline points="${stem.join(' ')}" fill="none" stroke="${colour}" ` +
      `stroke-width="${(size * 0.0028).toFixed(2)}" stroke-opacity="${(opacity * 0.75).toFixed(3)}"/>`,
    );

    for (let i = 0; i < 11; i += 1) {
      const t = from + ((i + 0.5) / 11) * (to - from);
      const { a, x, y } = at(t);
      // Leaves sit outboard of the stem and lean along it, as they grow.
      const lean = ((a * 180) / Math.PI) + (mirror ? -60 : 60);
      const ox = x + Math.cos(a) * size * 0.028;
      const oy = y + Math.sin(a) * size * 0.028;
      parts.push(
        `<ellipse cx="${ox.toFixed(2)}" cy="${oy.toFixed(2)}" rx="${(size * 0.034).toFixed(2)}" ` +
        `ry="${(size * 0.0125).toFixed(2)}" transform="rotate(${lean.toFixed(1)} ${ox.toFixed(2)} ${oy.toFixed(2)})" ` +
        `fill="none" stroke="${colour}" stroke-width="${(size * 0.0022).toFixed(2)}" ` +
        `stroke-opacity="${(opacity * 0.8).toFixed(3)}"/>`,
      );
    }
    return parts.join('');
  };

  const ringR = R * 0.945;
  // Set over the upper two-thirds of the ring and no further. Text carried all
  // the way round arrives at the foot upside down and runs into the year — and
  // a seal legend that has to be rotated to read is a legend nobody reads.
  const ringText = legend.join('   ·   ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <path id="${id}-ring" d="M ${R},${R} m -${ringR.toFixed(2)},0 a ${ringR.toFixed(2)},${ringR.toFixed(2)} 0 1,1 ${(ringR * 2).toFixed(2)},0 a ${ringR.toFixed(2)},${ringR.toFixed(2)} 0 1,1 -${(ringR * 2).toFixed(2)},0"/>
  </defs>

  <circle cx="${R}" cy="${R}" r="${(R * 0.985).toFixed(2)}" fill="none" stroke="${colour}"
          stroke-width="${(size * 0.004).toFixed(2)}" stroke-opacity="${(opacity * 0.7).toFixed(3)}"/>
  <circle cx="${R}" cy="${R}" r="${(R * 0.905).toFixed(2)}" fill="none" stroke="${colour}"
          stroke-width="${(size * 0.0018).toFixed(2)}" stroke-opacity="${(opacity * 0.45).toFixed(3)}"/>

  <text font-family="Helvetica,Arial,sans-serif" font-size="${(size * 0.026).toFixed(2)}"
        letter-spacing="${(size * 0.006).toFixed(2)}" fill="${colour}"
        fill-opacity="${(opacity * 0.85).toFixed(3)}">
    <textPath href="#${id}-ring" startOffset="12%">${escapeXml(ringText)}</textPath>
  </text>

  ${laurel(false)}${laurel(true)}

  <g transform="translate(${off},${off})">${globe}</g>

  <text x="${R}" y="${(R + R * 0.80).toFixed(2)}" text-anchor="middle"
        font-family="Georgia,serif" font-size="${(size * 0.042).toFixed(2)}"
        letter-spacing="${(size * 0.008).toFixed(2)}" fill="${colour}"
        fill-opacity="${(opacity * 0.8).toFixed(3)}">${escapeXml(founded)}</text>
</svg>`;
}

export const africaGlobeUri = (seed: number, size: number, colour: string, opacity?: number) =>
  enc(africaGlobe(seed, size, colour, opacity));

export const institutionalDeviceUri = (
  seed: number, size: number, colour: string, legend: string[], founded: string, opacity?: number,
) => enc(institutionalDevice(seed, size, colour, legend, founded, opacity));

/* ------------------------------------------------------------------ */
/* The African Globe of Knowledge                                       */
/* ------------------------------------------------------------------ */

/**
 * How elaborate the device is.
 *
 * There is no 'simple' any more, deliberately. The lowest award the university
 * confers is still one of its awards, and a plain ring round a globe is what
 * every certificate generator on the internet produces — starting the ladder
 * there meant the university's diploma looked like a template and only its
 * doctorate looked like an instrument. The floor is now what used to be the
 * middle, and the ceiling has moved up to meet it.
 */
export type DeviceTier = 'standard' | 'elaborate' | 'full' | 'supreme';

/**
 * The silhouette of the device.
 *
 * A closed circle is the obvious form and not always the best one — it reads as
 * a stamp, it repeats the QR's roundness at the other end of the sheet, and on
 * a landscape certificate it leaves the wide margins doing nothing. These are
 * five genuinely different shapes, not five skins:
 *
 *   seal       a struck medallion. The classical answer.
 *   cartouche  an engraved oval, as on a bookplate or a share certificate.
 *   shield     an escutcheon. The most heraldic and the most institutional.
 *   radiant    open rather than closed — rays run off past any boundary, so the
 *              figure has no edge for the eye to stop at.
 *   panel      a banknote vignette: a lozenge panel of interlace, filling the
 *              width rather than sitting as a roundel in the middle.
 */
export type DeviceStyle = 'seal' | 'cartouche' | 'shield' | 'radiant' | 'panel';
export type DeviceEmblem = 'book' | 'gear' | 'compass' | 'torch' | 'none';

/**
 * A ring of geometric ornament drawn from a Central African vocabulary.
 *
 * WHY NOT MORE BANKNOTE GUILLOCHÉ. The rosette is a European engraving
 * tradition — it is what a Swiss security printer draws, and it is what every
 * certificate template on the internet borrows. Using it as the sole ornament
 * on the credential of a university that calls itself the community university
 * of Africa means the document's decoration is from one continent and its
 * identity from another.
 *
 * WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT. It is built from the
 * vocabulary that Central and West African textile and architectural ornament
 * shares — interlocking lozenges, nested chevrons, triangle registers — set out
 * radially. It is NOT a reproduction of any specific motif. Adinkra glyphs,
 * kente patterns and Bamileke wall figures carry meaning, ownership and in some
 * cases sacred use; lifting one to decorate a degree certificate would be
 * taking something that is not the university's to take, and doing it in the
 * name of authenticity. A geometric family is common property; a symbol is not,
 * and the line between them is the whole reason this comment is here.
 *
 * As security artwork it does the same job as a guilloché: every vertex is
 * determined by the sector count and the radii, so a hand copy drifts
 * everywhere at once.
 */
export function africanBand(
  seed: number,
  size: number,
  colour: string,
  sectors: number,
  rOuter: number,
  rInner: number,
  opacity: number,
): string {
  const R = size / 2;
  const parts: string[] = [];
  const step = (Math.PI * 2) / sectors;
  const pt = (a: number, r: number) => `${(R + Math.cos(a) * r).toFixed(2)},${(R + Math.sin(a) * r).toFixed(2)}`;

  for (let i = 0; i < sectors; i += 1) {
    const a0 = i * step - Math.PI / 2;
    const a1 = a0 + step;
    const mid = (a0 + a1) / 2;

    // A lozenge on the sector boundary — the register that runs through almost
    // all of this ornament family.
    parts.push(
      `<polygon points="${pt(a0, rOuter)} ${pt(a0 - step * 0.28, (rOuter + rInner) / 2)} ` +
      `${pt(a0, rInner)} ${pt(a0 + step * 0.28, (rOuter + rInner) / 2)}" ` +
      `fill="none" stroke="${colour}" stroke-width="${(size * 0.0016).toFixed(2)}" ` +
      `stroke-opacity="${(opacity * 0.9).toFixed(3)}"/>`,
    );

    // Nested chevrons pointing outward, three deep.
    for (let k = 0; k < 3; k += 1) {
      const f = 0.22 + k * 0.24;
      const rr = rInner + (rOuter - rInner) * f;
      parts.push(
        `<polyline points="${pt(mid - step * 0.34, rr)} ${pt(mid, rr + (rOuter - rInner) * 0.20)} ` +
        `${pt(mid + step * 0.34, rr)}" fill="none" stroke="${colour}" ` +
        `stroke-width="${(size * 0.0014).toFixed(2)}" stroke-opacity="${(opacity * 0.75).toFixed(3)}"/>`,
      );
    }
  }

  // The two rules that close the register.
  for (const r of [rOuter, rInner]) {
    parts.push(
      `<circle cx="${R}" cy="${R}" r="${r.toFixed(2)}" fill="none" stroke="${colour}" ` +
      `stroke-width="${(size * 0.0018).toFixed(2)}" stroke-opacity="${(opacity * 0.8).toFixed(3)}"/>`,
    );
  }
  return parts.join('');
}

/** A small emblem for the faculty, at the foot of the device. */
function emblemPath(kind: DeviceEmblem, cx: number, cy: number, r: number, colour: string, opacity: number): string {
  const sw = (r * 0.09).toFixed(2);
  const st = `fill="none" stroke="${colour}" stroke-width="${sw}" stroke-opacity="${opacity.toFixed(3)}"`;
  switch (kind) {
    case 'book':
      // An open book. Theology and Education.
      return `<g ${st}>
        <path d="M${cx - r},${cy - r * 0.5} Q${cx - r * 0.5},${cy - r * 0.8} ${cx},${cy - r * 0.45}
                 Q${cx + r * 0.5},${cy - r * 0.8} ${cx + r},${cy - r * 0.5}
                 L${cx + r},${cy + r * 0.6} Q${cx + r * 0.5},${cy + r * 0.3} ${cx},${cy + r * 0.65}
                 Q${cx - r * 0.5},${cy + r * 0.3} ${cx - r},${cy + r * 0.6} Z"/>
        <line x1="${cx}" y1="${cy - r * 0.45}" x2="${cx}" y2="${cy + r * 0.65}"/>
      </g>`;
    case 'gear':
      // Engineering and Technology.
      return `<g ${st}>
        <circle cx="${cx}" cy="${cy}" r="${(r * 0.45).toFixed(2)}"/>
        ${Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return `<line x1="${(cx + Math.cos(a) * r * 0.6).toFixed(2)}" y1="${(cy + Math.sin(a) * r * 0.6).toFixed(2)}" ` +
                 `x2="${(cx + Math.cos(a) * r).toFixed(2)}" y2="${(cy + Math.sin(a) * r).toFixed(2)}"/>`;
        }).join('')}
      </g>`;
    case 'compass':
      // Business and Management: the dividers, not the magnetic compass.
      return `<g ${st}>
        <path d="M${cx},${cy - r} L${cx - r * 0.55},${cy + r * 0.75}"/>
        <path d="M${cx},${cy - r} L${cx + r * 0.55},${cy + r * 0.75}"/>
        <circle cx="${cx}" cy="${cy - r}" r="${(r * 0.12).toFixed(2)}"/>
        <path d="M${cx - r * 0.34},${cy + r * 0.15} A${(r * 0.4).toFixed(2)},${(r * 0.4).toFixed(2)} 0 0 0 ${cx + r * 0.34},${cy + r * 0.15}"/>
      </g>`;
    case 'torch':
      return `<g ${st}>
        <path d="M${cx},${cy - r} Q${cx + r * 0.42},${cy - r * 0.45} ${cx},${cy - r * 0.1}
                 Q${cx - r * 0.42},${cy - r * 0.45} ${cx},${cy - r} Z"/>
        <rect x="${(cx - r * 0.16).toFixed(2)}" y="${(cy - r * 0.05).toFixed(2)}" width="${(r * 0.32).toFixed(2)}" height="${(r * 0.95).toFixed(2)}"/>
      </g>`;
    default:
      return '';
  }
}

/**
 * The African Globe of Knowledge — the university's security device.
 *
 * A single engraved figure rather than a stack of borrowed ornaments. From
 * across a room it reads as a seal; under a loupe it resolves into microtext,
 * geometric register and graticule. That is the test a security device has to
 * pass, and a watermark that looks like clip art laid behind the text fails it
 * however good the clip art is.
 *
 * WHAT IS IN IT, OUTSIDE IN:
 *
 *   a microtext ring carrying the university's name, descriptor and motto
 *   a register of Central African geometric ornament — see africanBand
 *   twelve nodes joined by chords: the faculties, and the network between them
 *   laurel sprigs at the four cardinal points
 *   the world, turned so Africa is at its centre, coastlines engraved
 *   the year of foundation, and the faculty's emblem
 *
 * TIERS. A diploma and a doctorate should not carry the same device — the
 * university's highest award ought to be recognisable as its highest award
 * across a room. `standard` is the floor and already carries the network and
 * the emblem; `elaborate` adds a guilloché collar, `full` adds radiating rays,
 * `supreme` adds a second register of ornament outside the first. It is the
 * same device throughout, so the identity holds; only the elaboration changes.
 *
 * STYLES. The tier says how much is worked into the figure. The style says what
 * shape it is struck in, and the two are independent: a certificate in `shield`
 * and a doctorate in `shield` are the same silhouette at two levels of work.
 * See DeviceStyle for why a closed circle is not automatically the right answer.
 */
export function africanGlobeOfKnowledge(opts: {
  seed: number;
  size: number;
  colour: string;
  legend: string[];
  founded: string;
  tier?: DeviceTier;
  style?: DeviceStyle;
  emblem?: DeviceEmblem;
  opacity?: number;
  /**
   * What sits at the heart of the figure.
   *
   * 'globe' is the world turned to Africa — the device's subject.
   * 'void' leaves the centre as bare paper inside a struck collet, so the
   * university's own foil wafer is affixed THERE, in the middle of its own
   * device, rather than in a separate blank circle further down the sheet.
   */
  centre?: 'globe' | 'void';
  /**
   * Which world the device carries.
   *
   * 'flat' is the azimuthal equidistant map — the UN-emblem projection, cut at
   * 60°S, with 20°E running straight down so Africa is at the foot. 'globe' is
   * the orthographic sphere it replaced.
   */
  world?: 'flat' | 'globe';
  /** The sheet's colour, for the vacant centre. Must match the stock. */
  paper?: string;
  /**
   * The holder's own ring: their name and their credential number, set in
   * microtext and repeated round the figure.
   *
   * WHY THIS IS WORTH THE TROUBLE. Every other element of the device is the
   * same on every certificate the university issues, which means a device
   * lifted from a genuine scan is a valid device for any forgery built on it.
   * A ring carrying the holder's name is not: it makes the artwork specific to
   * ONE award, so lifting it carries the original holder's name into the copy —
   * where a registrar comparing the ring against the conferral will find them
   * disagreeing. It is the same argument as the microtext course along the
   * foot, applied to the one figure a forger is most likely to reuse.
   */
  holder?: { name: string; credentialId: string } | null;
}): string {
  const { seed, size, colour, legend, founded } = opts;
  const tier = opts.tier ?? 'standard';
  const style = opts.style ?? 'seal';
  const emblem = opts.emblem ?? 'none';
  const opacity = opts.opacity ?? 1;
  const centre = opts.centre ?? 'globe';
  const world = opts.world ?? 'flat';
  const holder = opts.holder ?? null;
  const paper = opts.paper ?? '#fffdf5';
  const R = size / 2;
  // The whole style name, not its initial. 'seal' and 'shield' both begin with
  // s, so two devices on one page — a Studio preview beside a gallery, a sheet
  // of specimens — minted the same element id, and the shield's <textPath>
  // resolved to the FIRST match in the document: the seal's circle. The legend
  // came out running down the side of the wrong figure. An id that is unique
  // "in practice" is not unique.
  const id = `k${seed.toString(36)}${style}${tier}${centre}${world}`;
  const f = tierFlags(tier);
  const L: string[] = [];
  const sw = (v: number) => (size * v).toFixed(2);

  // --- rays -------------------------------------------------------------
  // On 'radiant' they run past the outer boundary, which is the whole point of
  // that style: the figure has no edge for the eye to stop at.
  if (f.rays || style === 'radiant') {
    const reach = style === 'radiant' ? 1.30 : 0.99;
    const rays: string[] = [];
    const n = style === 'radiant' ? 96 : 72;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const long = i % 6 === 0;
      const r1 = R * (long ? reach : reach * 0.86);
      rays.push(
        `M${(R + Math.cos(a) * R * 0.30).toFixed(2)},${(R + Math.sin(a) * R * 0.30).toFixed(2)} ` +
        `L${(R + Math.cos(a) * r1).toFixed(2)},${(R + Math.sin(a) * r1).toFixed(2)}`,
      );
    }
    L.push(
      `<path d="${rays.join(' ')}" fill="none" stroke="${colour}" stroke-width="${sw(0.0013)}" ` +
      `stroke-opacity="${(opacity * (style === 'radiant' ? 0.28 : 0.34)).toFixed(3)}"/>`,
    );
  }

  // --- the outer frame, which is what makes the five styles different -----
  // 0.895, not 0.955.
  //
  // TEXT ON A PATH IS DRAWN OUTWARD FROM IT. The legend at 0.955R with a
  // 0.022-size face reached 0.986R, and the doctorate's second register ran
  // from 0.965R to 0.995R — so on the university's highest award the ornament
  // was printed straight through its own name. It is the one tier where that
  // could happen and the one tier where it matters most.
  //
  // The whole stack moved inward to make room, with a clear gap between every
  // course. Outward: nodes 0.700, laurel 0.720, holder's ring 0.765 (text to
  // 0.792), African register 0.805–0.875, legend path 0.895 (text to 0.926),
  // doctoral register 0.935–0.985, rim 0.998.
  const ringR = R * 0.895;
  const ringText = legend.join('   ·   ');
  const microRing = (pathD: string) =>
    `<path id="${id}-ring" fill="none" d="${pathD}"/>` +
    `<text font-family="Helvetica,Arial,sans-serif" font-size="${sw(0.022)}" ` +
    `letter-spacing="${sw(0.0048)}" fill="${colour}" fill-opacity="${(opacity * 0.85).toFixed(3)}">` +
    `<textPath href="#${id}-ring" startOffset="9%">${escapeXml(ringText)}</textPath></text>`;

  // A legend on an open path — an arc or a straight rule — rather than round a
  // closed circle. Set centred at the middle of the path and two-thirds the
  // ring size, because an open path has a finite measure: overflow is not
  // wrapped by SVG, it is silently discarded, so text that does not fit simply
  // vanishes off the end.
  const arcLegend = (pathD: string) =>
    `<path id="${id}-ring" fill="none" d="${pathD}"/>` +
    `<text font-family="Helvetica,Arial,sans-serif" font-size="${sw(0.0135)}" ` +
    `letter-spacing="${sw(0.0021)}" text-anchor="middle" fill="${colour}" ` +
    `fill-opacity="${(opacity * 0.85).toFixed(3)}">` +
    `<textPath href="#${id}-ring" startOffset="50%">${escapeXml(ringText)}</textPath></text>`;

  const circleD = (r: number) =>
    `M ${R},${R} m -${r.toFixed(2)},0 a ${r.toFixed(2)},${r.toFixed(2)} 0 1,1 ${(r * 2).toFixed(2)},0 ` +
    `a ${r.toFixed(2)},${r.toFixed(2)} 0 1,1 -${(r * 2).toFixed(2)},0`;

  if (style === 'seal' || style === 'radiant') {
    // The rim. Every tier gets one, so the figure has a defined edge rather
    // than trailing off into the paper — and so the doctoral register has
    // something to sit inside instead of being the outermost thing on the
    // sheet.
    L.push(
      `<circle cx="${R}" cy="${R}" r="${(R * 0.998).toFixed(2)}" fill="none" stroke="${colour}" ` +
      `stroke-width="${sw(0.0026)}" stroke-opacity="${(opacity * 0.7).toFixed(3)}"/>`,
    );
    if (style === 'seal') L.push(microRing(circleD(ringR)));
    L.push(africanBand(seed, size, colour, f.sectors, R * 0.875, R * 0.805, opacity));
    if (f.doubleRegister) {
      L.push(africanBand(seed ^ 0x9d, size, colour, Math.round(f.sectors * 1.4), R * 0.985, R * 0.935, opacity * 0.75));
    }
  }

  if (style === 'cartouche') {
    // An engraved oval. Wider than tall, which suits a landscape sheet — a
    // circle in the middle of a 297mm page leaves both margins idle.
    const rx = R * 0.96;
    const ry = R * 0.70;
    L.push(microRing(
      `M ${(R - rx).toFixed(2)},${R} a ${rx.toFixed(2)},${ry.toFixed(2)} 0 1,1 ${(rx * 2).toFixed(2)},0 ` +
      `a ${rx.toFixed(2)},${ry.toFixed(2)} 0 1,1 -${(rx * 2).toFixed(2)},0`,
    ));
    for (const k of [0.905, 0.80]) {
      L.push(
        `<polyline points="${ellipsePts(R, R, rx * k, ry * k).join(' ')}" fill="none" ` +
        `stroke="${colour}" stroke-width="${sw(0.0018)}" stroke-opacity="${(opacity * 0.8).toFixed(3)}"/>`,
      );
    }
    // Lozenges round the oval, in place of the radial register a circle takes.
    const lz: string[] = [];
    const count = f.sectors;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 - Math.PI / 2;
      const cx = R + Math.cos(a) * rx * 0.8525;
      const cy = R + Math.sin(a) * ry * 0.8525;
      const d = size * 0.016;
      lz.push(
        `<polygon points="${(cx).toFixed(2)},${(cy - d).toFixed(2)} ${(cx + d * 0.55).toFixed(2)},${cy.toFixed(2)} ` +
        `${(cx).toFixed(2)},${(cy + d).toFixed(2)} ${(cx - d * 0.55).toFixed(2)},${cy.toFixed(2)}" ` +
        `fill="none" stroke="${colour}" stroke-width="${sw(0.0016)}" stroke-opacity="${(opacity * 0.8).toFixed(3)}"/>`,
      );
    }
    L.push(lz.join(''));
  }

  if (style === 'shield') {
    // Sized to clear the chief legend above it and the frame below. At 0.98 the
    // shoulders ran off the top of the figure.
    const w = size * 0.80;
    const h = size * 0.88;
    const cy = R * 1.10;
    L.push(
      `<path d="${shieldPath(R, cy, w, h)}" fill="none" stroke="${colour}" ` +
      `stroke-width="${sw(0.005)}" stroke-opacity="${(opacity * 0.9).toFixed(3)}"/>`,
      `<path d="${shieldPath(R, cy, w * 0.91, h * 0.91)}" fill="none" stroke="${colour}" ` +
      `stroke-width="${sw(0.002)}" stroke-opacity="${(opacity * 0.6).toFixed(3)}"/>`,
    );
    // The chief: the band across the head of a shield, and the reason this
    // silhouette reads as arms rather than as a box. Without the division line
    // the outline is four straight sides at watermark opacity, which is a
    // rectangle to anyone glancing at it.
    const chiefY = cy - h / 2 + h * 0.155;
    L.push(
      `<path d="M${(R - w / 2).toFixed(2)},${chiefY.toFixed(2)} L${(R + w / 2).toFixed(2)},${chiefY.toFixed(2)}" ` +
      `stroke="${colour}" stroke-width="${sw(0.0028)}" stroke-opacity="${(opacity * 0.75).toFixed(3)}"/>`,
    );
    // The legend rides a shallow arc above the shield rather than a ring round
    // it. It CANNOT use microRing: that font is scaled to a full circumference
    // of about 3× the figure's width, and on a half-arc a third of the legend
    // ran off the end of the path and was dropped mid-word — which is how the
    // first render came out reading "SIONALIS" in the top corner.
    // A SHALLOW arc — radius 2.4R, not 1.3R. The tighter curve rose 0.40R above
    // its own endpoints, which put the crown of the legend outside the figure's
    // box entirely and the ends of it off the top of the sheet.
    L.push(arcLegend(
      `M ${(R - R * 0.94).toFixed(2)},${(R * 0.36).toFixed(2)} ` +
      `A ${(R * 2.4).toFixed(2)},${(R * 2.4).toFixed(2)} 0 0 1 ${(R + R * 0.94).toFixed(2)},${(R * 0.36).toFixed(2)}`,
    ));
  }

  if (style === 'panel') {
    // A banknote vignette: a wide lozenge panel of interlace. It fills the
    // measure instead of sitting as a roundel, which is what a central vignette
    // on a security document actually does.
    const hw = R * 0.98;
    const hh = R * 0.56;
    const pts = [
      `${R},${(R - hh).toFixed(2)}`,
      `${(R + hw * 0.66).toFixed(2)},${(R - hh).toFixed(2)}`,
      `${(R + hw).toFixed(2)},${R}`,
      `${(R + hw * 0.66).toFixed(2)},${(R + hh).toFixed(2)}`,
      `${R},${(R + hh).toFixed(2)}`,
      `${(R - hw * 0.66).toFixed(2)},${(R + hh).toFixed(2)}`,
      `${(R - hw).toFixed(2)},${R}`,
      `${(R - hw * 0.66).toFixed(2)},${(R - hh).toFixed(2)}`,
    ].join(' ');
    L.push(
      `<polygon points="${pts}" fill="none" stroke="${colour}" stroke-width="${sw(0.004)}" ` +
      `stroke-opacity="${(opacity * 0.85).toFixed(3)}"/>`,
    );
    // Interlace across the panel: two counter-running wave families.
    const mesh: string[] = [];
    for (let k = -6; k <= 6; k += 1) {
      const pts2: string[] = [];
      for (let x = -hw; x <= hw; x += 4) {
        const y = Math.sin((x / hw) * Math.PI * 2 + k * 0.5) * hh * 0.34 + k * (hh / 9);
        pts2.push(`${(R + x).toFixed(2)},${(R + y).toFixed(2)}`);
      }
      mesh.push(
        `<polyline points="${pts2.join(' ')}" fill="none" stroke="${colour}" ` +
        `stroke-width="${sw(0.0014)}" stroke-opacity="${(opacity * 0.55).toFixed(3)}"/>`,
      );
    }
    L.push(`<g clip-path="url(#${id}-clip)">${mesh.join('')}</g>`,
      `<clipPath id="${id}-clip"><polygon points="${pts}"/></clipPath>`);
    // The legend runs UNDER the panel, not over it. Above, it landed on the
    // same baseline as the certificate's own first line and read as a second
    // heading in a lighter grey — a watermark may sit behind body text, but it
    // must never look like type somebody left there by mistake. Below the panel
    // it falls into the clear band above the signature row.
    L.push(arcLegend(
      `M ${(R - hw).toFixed(2)},${(R + hh + size * 0.045).toFixed(2)} ` +
      `L ${(R + hw).toFixed(2)},${(R + hh + size * 0.045).toFixed(2)}`,
    ));
  }

  // --- the holder's ring --------------------------------------------------
  // Set inside the institutional legend and inside the African register, so the
  // figure reads outside in: the university, its ornament, then the person.
  //
  // REPEATED TO FILL THE CIRCUMFERENCE rather than written once. A legend that
  // runs a third of the way round and stops looks like a caption; repeated, it
  // is a course of microtext, which is what it is for. The repeat count is
  // computed from the measure so the ring is full at any size — a fixed count
  // would crowd at one diameter and leave a gap at another, and a gap in a
  // microtext course is exactly where a forger's join would be hidden.
  if (holder && holder.name.trim()) {
    const hr = R * 0.765;
    const fs = size * 0.019;
    const ls = size * 0.004;
    const unit = `${holder.name.toUpperCase()}   ·   ${holder.credentialId}   ·   `;
    // ~0.55em average advance for capitals in a humanist sans, plus tracking.
    const per = unit.length * (fs * 0.55 + ls);
    const reps = Math.max(1, Math.min(6, Math.round((2 * Math.PI * hr) / per)));
    L.push(
      `<path id="${id}-holder" fill="none" d="${circleD(hr)}"/>` +
      `<text font-family="Helvetica,Arial,sans-serif" font-size="${fs.toFixed(2)}" ` +
      `letter-spacing="${ls.toFixed(2)}" fill="${colour}" ` +
      `fill-opacity="${(opacity * 0.8).toFixed(3)}">` +
      `<textPath href="#${id}-holder" startOffset="0%">${escapeXml(unit.repeat(reps))}</textPath></text>`,
    );
  }

  // --- the network, on every tier now ------------------------------------
  if (f.network) {
    const nodes = 12;
    const nr = style === 'cartouche' ? R * 0.58 : style === 'panel' ? R * 0.46 : R * 0.700;
    const chords: string[] = [];
    for (let i = 0; i < nodes; i += 1) {
      const a = (i / nodes) * Math.PI * 2 - Math.PI / 2;
      const ry = style === 'cartouche' ? nr * 0.74 : style === 'panel' ? nr * 0.66 : nr;
      const x = R + Math.cos(a) * nr;
      const y = (style === 'shield' ? R * 1.0 : R) + Math.sin(a) * ry;
      L.push(
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${sw(0.0075)}" fill="none" ` +
        `stroke="${colour}" stroke-width="${sw(0.0018)}" stroke-opacity="${(opacity * 0.85).toFixed(3)}"/>`,
      );
      for (const skip of [5, 7]) {
        const b = (((i + skip) % nodes) / nodes) * Math.PI * 2 - Math.PI / 2;
        chords.push(
          `M${x.toFixed(2)},${y.toFixed(2)} L${(R + Math.cos(b) * nr).toFixed(2)},` +
          `${((style === 'shield' ? R * 1.0 : R) + Math.sin(b) * ry).toFixed(2)}`,
        );
      }
    }
    L.push(
      `<path d="${chords.join(' ')}" fill="none" stroke="${colour}" stroke-width="${sw(0.0011)}" ` +
      `stroke-opacity="${(opacity * 0.30).toFixed(3)}"/>`,
    );
  }

  // --- laurel, at the cardinal points (not on the panel, which has no rim) --
  if (style !== 'panel') {
    for (let c = 0; c < 4; c += 1) {
      const a = (c / 4) * Math.PI * 2 + Math.PI / 2;
      const rr = style === 'cartouche' ? R * 0.62 : R * 0.720;
      const bx = R + Math.cos(a) * rr;
      const by = R + Math.sin(a) * (style === 'cartouche' ? rr * 0.72 : rr);
      const leaves: string[] = [];
      for (let k = -2; k <= 2; k += 1) {
        if (k === 0) continue;
        const off = k * size * 0.021;
        const lx = bx + Math.cos(a + Math.PI / 2) * off;
        const ly = by + Math.sin(a + Math.PI / 2) * off;
        leaves.push(
          `<ellipse cx="${lx.toFixed(2)}" cy="${ly.toFixed(2)}" rx="${sw(0.019)}" ry="${sw(0.0075)}" ` +
          `transform="rotate(${((a * 180) / Math.PI + (k > 0 ? 55 : -55)).toFixed(1)} ${lx.toFixed(2)} ${ly.toFixed(2)})" ` +
          `fill="none" stroke="${colour}" stroke-width="${sw(0.0018)}" stroke-opacity="${(opacity * 0.8).toFixed(3)}"/>`,
        );
      }
      L.push(leaves.join(''));
    }
  }

  // --- the collar ---------------------------------------------------------
  if (f.collar) {
    L.push(
      // Very light indeed. At 0.13 the fourteen overlapping curves compounded
      // into a dark scalloped ring that buried the globe in all five styles —
      // the collar is meant to be felt at the edge of vision, and the thing at
      // the centre is the subject.
      guillocheRosette(seed ^ 0x2f, size * 0.70, colour, opacity * 0.045, 1)
        .replace(/^<svg[^>]*>/, `<g transform="translate(${sw(0.17)},${sw(0.17)})">`)
        .replace(/<\/svg>$/, '</g>'),
    );
  }

  // --- the centre ---------------------------------------------------------
  // Either the world, or a vacant setting for the wafer.
  //
  // 'void' is not "the globe, hidden". It is a MOUNT: everything the device
  // carries stays — ring, register, network, laurel, collar, rays — and the
  // middle is left as bare paper with a collet struck round it, so the seal the
  // university presses by hand lands inside its own device rather than in a
  // blank circle beside it.
  //
  // The clear disc is painted LAST, in the paper's colour, over whatever the
  // earlier layers put there. The collar is a rosette centred on the figure and
  // the rays start at 0.30R, so both run through the middle; suppressing them
  // one by one would mean every future layer had to remember this rule. Paint
  // the hole instead, and no layer can get it wrong.
  // The vacant centre is drawn LARGER than the globe it replaces. The globe is
  // a subject the ornament surrounds; the seat is a fitting the ornament has to
  // clear. At the globe's 0.60 a 44mm mount left a 26mm seat, and the wafer the
  // university actually presses is 30mm — it would have overhung the collet.
  const innerK = centre === 'void'
    ? (style === 'panel' ? 0.58 : style === 'shield' ? 0.62 : 0.68)
    : (style === 'panel' ? 0.50 : style === 'shield' ? 0.54 : 0.60);
  const inner = size * innerK;
  const gx = ((size - inner) / 2).toFixed(2);
  const gy = (style === 'shield' ? size * 0.255 : (size - inner) / 2).toFixed(2);
  if (centre === 'globe') {
    L.push(
      `<g transform="translate(${gx},${gy})">` +
      (world === 'flat' ? flatWorld : africaGlobe)(seed, inner, colour, opacity)
        .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') +
      `</g>`,
    );
  } else {
    const cyv = style === 'shield' ? size * 0.255 + inner / 2 : R;
    const rv = inner / 2;
    L.push(
      `<circle cx="${R}" cy="${cyv.toFixed(2)}" r="${rv.toFixed(2)}" fill="${paper}"/>`,
      // The collet: a bead rule at the seat, a fillet outside it, and a course
      // of small radial ticks between — the setting a struck medal is mounted
      // in. Without it the middle reads as an omission rather than a fitting.
      `<circle cx="${R}" cy="${cyv.toFixed(2)}" r="${rv.toFixed(2)}" fill="none" stroke="${colour}" ` +
      `stroke-width="${sw(0.0042)}" stroke-opacity="${(opacity * 0.9).toFixed(3)}"/>`,
      `<circle cx="${R}" cy="${cyv.toFixed(2)}" r="${(rv * 1.075).toFixed(2)}" fill="none" stroke="${colour}" ` +
      `stroke-width="${sw(0.0016)}" stroke-opacity="${(opacity * 0.6).toFixed(3)}"/>`,
    );
    const ticks: string[] = [];
    const tn = 72;
    for (let i = 0; i < tn; i += 1) {
      const a = (i / tn) * Math.PI * 2;
      ticks.push(
        `M${(R + Math.cos(a) * rv * 1.012).toFixed(2)},${(cyv + Math.sin(a) * rv * 1.012).toFixed(2)} ` +
        `L${(R + Math.cos(a) * rv * 1.062).toFixed(2)},${(cyv + Math.sin(a) * rv * 1.062).toFixed(2)}`,
      );
    }
    L.push(
      `<path d="${ticks.join(' ')}" fill="none" stroke="${colour}" stroke-width="${sw(0.0014)}" ` +
      `stroke-opacity="${(opacity * 0.55).toFixed(3)}"/>`,
    );
  }

  // --- year and emblem ----------------------------------------------------
  const yearY = style === 'shield' ? R * 1.56 : style === 'panel' ? R + R * 0.44 : R + R * 0.62;
  L.push(
    `<text x="${R}" y="${yearY.toFixed(2)}" text-anchor="middle" font-family="Georgia,serif" ` +
    `font-size="${sw(0.038)}" letter-spacing="${sw(0.007)}" fill="${colour}" ` +
    `fill-opacity="${(opacity * 0.8).toFixed(3)}">${escapeXml(founded)}</text>`,
  );
  if (emblem !== 'none') {
    L.push(emblemPath(emblem, R, yearY + size * 0.055, size * 0.026, colour, opacity * 0.7));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${L.join('')}</svg>`;
}

export const africanGlobeOfKnowledgeUri = (o: Parameters<typeof africanGlobeOfKnowledge>[0]) =>
  enc(africanGlobeOfKnowledge(o));

/**
 * The device set inside the guilloché rosette.
 *
 * WHAT THIS IS AND WHY IT EXISTS. The old watermark was a plain wireframe
 * graticule inside a scalloped rosette band. The band was the good part of it —
 * it is the engine-turning, and it is what makes the sheet read as a security
 * document at arm's length. What sat inside it was a stock globe that said
 * nothing about this institution.
 *
 * So the band stays and the stock globe goes. In its place is the university's
 * own device — the ring of its words, the register of African ornament, the
 * twelve faculties and their chords, the laurel, the world turned to Africa,
 * the year of foundation and the faculty's emblem — at whatever tier the award
 * calls for and in whichever of the five silhouettes the university has chosen.
 *
 * The result carries both: the guilloché is felt round the outside, and the
 * thing it surrounds belongs to this university and to no other.
 *
 * TWO BANDS, NOT ONE. globeInRosette used a single band because a second one
 * ran inside the sphere and made the graticule unreadable. That constraint does
 * not apply here — the device is set at 0.62, well inside both bands — and one
 * band alone is too slight to be felt behind a full page of type.
 */
export function deviceInRosette(
  opts: Parameters<typeof africanGlobeOfKnowledge>[0],
): string {
  const { seed, size, colour } = opts;
  const opacity = opts.opacity ?? 1;
  // 0.66 and 0.45. At 0.62 with the band at 0.55 the engine-turning swamped the
  // thing it is meant to surround — the device read as a detail caught in a web
  // rather than as the subject. The band is the setting; the device is what is
  // set in it, and the eye has to land on the device first.
  const inner = size * 0.66;
  const band = guillocheRosette(seed, size, colour, opacity * 0.45, 2)
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const device = africanGlobeOfKnowledge({ ...opts, size: inner })
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const off = ((size - inner) / 2).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${size} ${size}">${band}<g transform="translate(${off},${off})">${device}</g></svg>`;
}

export const deviceInRosetteUri = (o: Parameters<typeof africanGlobeOfKnowledge>[0]) =>
  enc(deviceInRosette(o));

/* ------------------------------------------------------------------ */
/* Five silhouettes for the device                                      */
/* ------------------------------------------------------------------ */

/** Points on an ellipse, for the cartouche. */
function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 180): string[] {
  const pts: string[] = [];
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${(cx + Math.cos(a) * rx).toFixed(2)},${(cy + Math.sin(a) * ry).toFixed(2)}`);
  }
  return pts;
}

/**
 * The outline of an escutcheon — a heraldic shield.
 *
 * Straight chief, straight flanks to two-thirds, then curved to a point. The
 * proportions are the ones used on academic arms rather than the squatter
 * shape used on sports crests; a shield too wide reads as a badge.
 */
function shieldPath(cx: number, cy: number, w: number, h: number): string {
  const l = cx - w / 2;
  const r = cx + w / 2;
  const t = cy - h / 2;
  const b = cy + h / 2;
  const shoulder = t + h * 0.62;
  return `M${l},${t} L${r},${t} L${r},${shoulder} ` +
         `C${r},${b - h * 0.12} ${cx + w * 0.26},${b} ${cx},${b} ` +
         `C${cx - w * 0.26},${b} ${l},${b - h * 0.12} ${l},${shoulder} Z`;
}

/**
 * Which register a tier draws. Pulled out so the five styles agree about what
 * "elaborate" means — otherwise each silhouette would drift into its own
 * private idea of the hierarchy, and a master's would be busier than a
 * doctorate on one style and quieter on another.
 */
function tierFlags(tier: DeviceTier) {
  return {
    network: true,                                        // every tier, now
    collar: tier === 'elaborate' || tier === 'full' || tier === 'supreme',
    rays: tier === 'full' || tier === 'supreme',
    doubleRegister: tier === 'supreme',
    sectors: tier === 'standard' ? 20 : tier === 'elaborate' ? 24 : 28,
  };
}
