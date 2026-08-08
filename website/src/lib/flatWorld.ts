import { WORLD, type Ring } from './worldCoastlines';
import register from '@/content/universityPlaces.json';

// ---------------------------------------------------------------------------
// THE FLAT WORLD.
//
// The azimuthal equidistant projection — the one on the United Nations emblem.
// Centred on the North Pole, cut at 60°S, with 20°E running straight down the
// sheet so that Africa sits at the foot of the figure.
//
// ===========================================================================
// WHY THIS IS ITS OWN MODULE
// ===========================================================================
//
// It was written inside publicCrest.ts, where it drew the world at the centre
// of the university's mark and nothing else could reach it. That is the wrong
// home for it. The projection is the single most reusable piece of visual
// identity this institution has: it is the reason "A Global University" has a
// picture and not just a strapline, and it belongs anywhere the page needs to
// say where this university reaches — the crest, a section ground, a locations
// band, a watermark, a share card.
//
// So it lives here, publicCrest.ts imports it, and the drawing is identical to
// the byte. Anything else that wants the world now asks this module for it
// rather than reimplementing a projection and getting the sign of the sine
// wrong.
//
// ===========================================================================
// WHY THIS PROJECTION AND NOT A GLOBE
// ===========================================================================
//
// A globe shows one hemisphere. Turned to Africa's longitude — which is the
// only orientation this university would use — it shows Africa, Europe, Arabia
// and very little else, and the claim being made is not that the institution is
// in Africa. It is that it is global. This projection puts every continent on
// the disc at once, with Africa at the foot rather than hidden at the edge.
//
// Antarctica is absent because the cut is at 60°S: on an azimuthal equidistant
// projection centred on the pole, the south pole is not a point but the entire
// outer rim, so Antarctica can only be drawn as a smear round the edge. The UN
// emblem makes the same cut for the same reason.
// ---------------------------------------------------------------------------

// THE PROJECTION ITSELF LIVES IN ./azimuthal.ts and is re-exported here
// unchanged, so every existing import of this module keeps working.
//
// It was split out because the homepage's locations map needs the trigonometry
// in the BROWSER, to place six pins over the generated flat-world.svg, and
// importing it from this file would have shipped ten thousand coastline points
// to every visitor in order to compute six coordinates.
export { DOWN_MERIDIAN, SOUTH_CUT, projectFlatWorld } from './azimuthal';
import { SOUTH_CUT, projectFlatWorld } from './azimuthal';

/** One landmass as a closed SVG path. */
export function ringPath(ring: Ring, cx: number, cy: number, radius: number): string {
  const pts = ring.map(([lon, lat]) => {
    const [x, y] = projectFlatWorld(lon, lat, cx, cy, radius);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${pts.join('L')}Z`;
}

/** Every landmass, as one path. Use fill-rule="evenodd". */
export function landPath(cx: number, cy: number, radius: number): string {
  return WORLD.map((ring) => ringPath(ring, cx, cy, radius)).join(' ');
}

/**
 * Parallels and meridians.
 *
 * Four parallels and twelve meridians: enough to read as a map, not enough to
 * become a net. A denser graticule is the most common way this projection is
 * spoiled — it stops being a world and becomes a radar screen.
 */
export function graticule(cx: number, cy: number, radius: number): string {
  const parallels = [60, 30, 0, -30]
    .map((lat) => `<circle cx="${cx}" cy="${cy}" r="${(((90 - lat) / (90 - SOUTH_CUT)) * radius).toFixed(1)}"/>`)
    .join('');
  const meridians = Array.from({ length: 12 }, (_, i) => {
    const [x, y] = projectFlatWorld(i * 30, SOUTH_CUT, cx, cy, radius);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  }).join('');
  return parallels + meridians;
}

/**
 * Where the university is, in degrees.
 *
 * ONLY PLACES THE UNIVERSITY ACTUALLY TEACHES FROM — and the list is no longer
 * written here. It is read from src/content/universityPlaces.json, which is the
 * same file the homepage's campuses list renders and the same file the
 * generated flat-world.svg plots, so a place cannot be added to the words
 * without appearing on the map, or to the map without appearing in the words.
 * The header of that file records what may be entered and on whose word.
 *
 * TWO KINDS OF MARK, BECAUSE THERE ARE TWO STRENGTHS OF CLAIM. Buea, Douala and
 * the Nigerian centre are sites the university can name, and they are drawn as
 * filled dots. The United States, Zambia and South Africa are nations the
 * university has stated it teaches accredited degrees from without yet naming an
 * address in them, and they are drawn as open rings at the country's centre. A
 * filled pin reads as an establishment — a building, at that spot. An open ring
 * in the middle of a country reads as the country, which is the claim actually
 * being made. Drawing the second as the first would be the easiest false
 * statement on this site to make and the hardest for a reader to catch.
 */
export const UNIVERSITY_PLACES: {
  name: string;
  kind: string;
  establishment: boolean;
  lon: number;
  lat: number;
}[] = register.nations.flatMap((n) =>
  n.sites.map((p) => ({
    name: p.name ?? n.country,
    kind: n.kind,
    establishment: p.establishment,
    lon: p.lon,
    lat: p.lat,
  })),
);

export interface FlatWorldOptions {
  /** Coordinate space. The figure is self-similar; this is not a size on screen. */
  size?: number;
  /** The ink. Everything is drawn in this one colour at varying opacity. */
  colour?: string;
  /** Fraction of the box the disc occupies. */
  inset?: number;
  /** Draw the graticule? */
  showGraticule?: boolean;
  /** Fill the landmasses, or leave them as outline only. */
  fillLand?: boolean;
  /** Land fill opacity. */
  landOpacity?: number;
  /** Mark the university's own locations. */
  places?: boolean;
  /** Element id prefix, so two maps on one page cannot collide. */
  id?: string;
}

/**
 * A standalone flat world, as a string of SVG.
 *
 * Pure and deterministic — no randomness, no dependence on the request — so it
 * can be called once at module scope on the server and inlined, and nothing
 * here ever reaches the browser.
 */
export function flatWorldSvg(opts: FlatWorldOptions = {}): string {
  const S = opts.size ?? 600;
  const colour = opts.colour ?? '#f7dc79';
  const id = opts.id ?? 'world';
  const c = S / 2;
  const R = (S / 2) * (opts.inset ?? 0.94);
  const landOp = opts.landOpacity ?? 0.9;

  const grat = opts.showGraticule === false
    ? ''
    : `<g stroke="${colour}" stroke-opacity="0.3" stroke-width="${(S * 0.0028).toFixed(2)}" fill="none">`
      + `${graticule(c, c, R)}</g>`;

  // TWO CIRCLES EACH, EITHER WAY — a site is a filled dot inside a ring; a
  // nation is an open ring inside a ring. Keeping the circle count equal is not
  // tidiness: flatWorld.test.mjs proves the pins are drawn by diffing the circle
  // count against the same figure with places off, and a mark that spent a
  // different number of circles would make that test unable to count anything.
  const pins = opts.places
    ? `<g>${UNIVERSITY_PLACES.map((p) => {
        const [x, y] = projectFlatWorld(p.lon, p.lat, c, c, R);
        const inner = p.establishment
          ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(S * 0.011).toFixed(1)}" `
            + `fill="${colour}"/>`
          : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(S * 0.011).toFixed(1)}" `
            + `fill="none" stroke="${colour}" stroke-opacity="0.8" stroke-width="${(S * 0.005).toFixed(2)}"/>`;
        return inner
          + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(S * 0.026).toFixed(1)}" `
          + `fill="none" stroke="${colour}" stroke-opacity="${p.establishment ? '0.55' : '0.32'}" `
          + `stroke-width="${(S * 0.004).toFixed(2)}"/>`;
      }).join('')}</g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" `
    + `fill="none" role="presentation">`
    + `<defs><radialGradient id="${id}-sea" cx="50%" cy="46%" r="62%">`
    + `<stop offset="0%" stop-color="${colour}" stop-opacity="0.13"/>`
    + `<stop offset="100%" stop-color="${colour}" stop-opacity="0.03"/>`
    + `</radialGradient></defs>`
    + `<circle cx="${c}" cy="${c}" r="${R.toFixed(1)}" fill="url(#${id}-sea)"/>`
    + grat
    + `<path d="${landPath(c, c, R)}" fill="${opts.fillLand === false ? 'none' : colour}" `
    + `fill-opacity="${landOp}" fill-rule="evenodd" stroke="${colour}" `
    + `stroke-width="${(S * 0.0035).toFixed(2)}" stroke-linejoin="round"/>`
    + `<circle cx="${c}" cy="${c}" r="${R.toFixed(1)}" stroke="${colour}" `
    + `stroke-width="${(S * 0.0055).toFixed(2)}" stroke-opacity="0.7"/>`
    + pins
    + `</svg>`;
}
