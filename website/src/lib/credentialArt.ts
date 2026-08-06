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
  ];

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
  paths.push(
    `<path d="${groundPts.join(' ')}" fill="none" stroke="${colour}" stroke-width="0.18" ` +
    `stroke-opacity="${(opacity * 0.34).toFixed(3)}"/>`,
  );

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
  const lines: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const y = (i / 5) * tile + r() * 2;
    lines.push(
      `<path d="M0,${y.toFixed(1)} Q${(tile / 4).toFixed(1)},${(y - 3).toFixed(1)} ${(tile / 2).toFixed(1)},${y.toFixed(1)} T${tile},${y.toFixed(1)}" ` +
      `fill="none" stroke="${colour}" stroke-width="0.25" stroke-opacity="${opacity * 6}"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}" viewBox="0 0 ${tile} ${tile}">
    ${lines.join('')}
    <text x="${tile / 2}" y="${tile / 2}" text-anchor="middle" transform="rotate(-30 ${tile / 2} ${tile / 2})"
      font-family="Georgia,serif" font-size="${(tile * 0.16).toFixed(1)}" letter-spacing="1"
      fill="${colour}" fill-opacity="${opacity}">${escapeXml(mark)}</text>
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
