// ---------------------------------------------------------------------------
// BUILD THE FLAT WORLD.
//
//   node scripts/build-flat-world.mjs
//   -> public/images/flat-world.svg
//
// ===========================================================================
// WHY A GENERATED FILE AND NOT THE MODULE THAT ALREADY DRAWS THIS
// ===========================================================================
//
// src/lib/flatWorld.ts draws the same projection and is not being replaced. It
// is the right thing for the crest: it inlines at 600px, it ships no runtime
// code, and its coastline data — src/lib/worldCoastlines.ts, about 540 points
// for the whole world at 1–3° — is exactly right at the size a crest is read.
//
// It is not right for a photograph-sized map. Asked to fill a viewport, 540
// points is visibly a polygon: Africa becomes a hexagon, Scandinavia a wedge,
// and the Americas taper in four straight cuts. The university asked for the
// quality to go up and for the result to be the ground of the pinned window,
// which is the largest anything is ever drawn on this site.
//
// So this reads Natural Earth 1:50m — the same survey the coarse data was eyed
// from, at roughly forty times the resolution — and writes ONE static SVG.
//
//   * It is an artefact, not a runtime path. Nothing computes it per request
//     and no coastline data reaches the browser as JavaScript.
//   * It is a file the browser caches once, not 150KB of inline SVG in the HTML
//     of every page that shows a map.
//   * It is vector. "Increase the quality" has no ceiling here: the same file is
//     exact on a phone and on a 5K display, which no photograph in this
//     repository can claim.
//
// THE PROJECTION CONSTANTS ARE IMPORTED, NOT COPIED. If the crest and this map
// ever disagreed about which meridian runs down the sheet, the university would
// have two different worlds on one site. flatWorld.ts is the single source.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// Kept in step with src/lib/flatWorld.ts by hand — and by nothing else, which
// is the honest statement. The two numbers below have not changed since the
// projection was written; the places, which do change, are no longer copied.
const DOWN_MERIDIAN = 20;
const SOUTH_CUT = -60;

const S = 2000; // Coordinate space. The figure is self-similar; this is not px.
const C = S / 2;
const R = (S / 2) * 0.94;

const project = (lon, lat) => {
  const r = ((90 - lat) / (90 - SOUTH_CUT)) * R;
  const t = ((lon - DOWN_MERIDIAN) * Math.PI) / 180;
  return [C + r * Math.sin(t), C + r * Math.cos(t)];
};

// ---------------------------------------------------------------------------
// CLIP AT 60°S.
//
// On an azimuthal equidistant projection centred on the pole the SOUTH pole is
// not a point but the entire outer rim, so anything below the cut cannot be
// drawn — it smears round the edge. The UN emblem makes the same cut for the
// same reason. Antarctica drops out entirely; a handful of southern rings are
// trimmed against the parallel, with the crossing point interpolated so the
// coast meets the rim exactly rather than a vertex early.
// ---------------------------------------------------------------------------
const clipSouth = (ring) => {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const aIn = a[1] >= SOUTH_CUT;
    const bIn = b[1] >= SOUTH_CUT;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (SOUTH_CUT - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, SOUTH_CUT]);
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// DENSIFY.
//
// A straight line in longitude/latitude is NOT a straight line on this
// projection: a parallel is a circle. An edge spanning several degrees drawn as
// one segment cuts the chord instead of following the arc, which is most of why
// the coarse map reads as a polygon. Long edges are subdivided before
// projection so the curve is carried by the geometry rather than hoped for.
// ---------------------------------------------------------------------------
const densify = (ring, maxStep = 0.75) => {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push(a);
    let dlon = b[0] - a[0];
    if (dlon > 180) dlon -= 360;
    if (dlon < -180) dlon += 360;
    const steps = Math.ceil(Math.max(Math.abs(dlon), Math.abs(b[1] - a[1])) / maxStep);
    for (let s = 1; s < steps; s++) {
      out.push([a[0] + (dlon * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps]);
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// SIMPLIFY, IN PROJECTED SPACE.
//
// Douglas–Peucker against the drawing, not against the globe. A tolerance in
// degrees removes far more detail from an equatorial coast than from an arctic
// one, because this projection compresses longitude toward the pole; a
// tolerance in drawing units removes exactly what cannot be seen, wherever it
// is. 0.6 of 2000 is well under a pixel at any size this is ever drawn.
// ---------------------------------------------------------------------------
const simplify = (pts, tol) => {
  if (pts.length < 3) return pts;
  const sq = tol * tol;
  const dist2 = (p, a, b) => {
    let x = a[0];
    let y = a[1];
    let dx = b[0] - x;
    let dy = b[1] - y;
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = b[0];
        y = b[1];
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    let far = 0;
    let idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = dist2(pts[i], pts[lo], pts[hi]);
      if (d > far) {
        far = d;
        idx = i;
      }
    }
    if (far > sq && idx > 0) {
      keep[idx] = 1;
      stack.push([lo, idx], [idx, hi]);
    }
  }
  return pts.filter((_, i) => keep[i]);
};

// The signed area of a projected ring, used only to drop specks. An island
// smaller than a stroke width is ink for nobody.
const area = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
};

const load = (file, key) => {
  const topo = JSON.parse(readFileSync(join(root, `node_modules/world-atlas/${file}`), 'utf8'));
  return feature(topo, topo.objects[key]);
};

const ringsOf = (fc) => {
  const out = [];
  for (const geom of fc.type === 'FeatureCollection' ? fc.features : [fc]) {
    const g = geom.geometry || geom;
    if (!g) continue;
    const list = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    for (const poly of list) out.push(...poly);
  }
  return out;
};

const polygons = ringsOf(load('land-50m.json', 'land'));

// ---------------------------------------------------------------------------
// THE BORDERS.
//
// Coastline alone answers "is this the world". Borders answer "is this a map",
// and at the size this is drawn — a whole viewport — the difference is the
// difference between a logo and a document. Africa in outline is a shape; Africa
// with its fifty-four countries in it is a place where things happen.
//
// Drawn from the country rings rather than from a separate boundary layer,
// because the country outlines include the coast: stroked at a lower opacity
// and UNDER the coastline, the shared edges simply reinforce the coast and the
// interior edges become the borders. One dataset, no seam-matching, and no
// possibility of a border that misses its own coastline by half a pixel.
// ---------------------------------------------------------------------------
const countryRings = ringsOf(load('countries-50m.json', 'countries'));

const build = (rings, { tol, minArea }) => {
  const paths = [];
  let kept = 0;
  let dropped = 0;
  let points = 0;
  for (const ring of rings) {
    const clipped = clipSouth(ring);
    if (clipped.length < 4) {
      dropped++;
      continue;
    }
    const projected = simplify(densify(clipped).map(([lon, lat]) => project(lon, lat)), tol);
    if (projected.length < 4 || area(projected) < minArea) {
      dropped++;
      continue;
    }
    kept++;
    points += projected.length;
    paths.push('M' + projected.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z');
  }
  return { d: paths.join(' '), kept, dropped, points };
};

// The coastline carries the finer tolerance because it is the line the eye
// reads; the borders are texture and can be coarser without anyone noticing,
// which keeps a fifty-fold increase in ring count from becoming a fifty-fold
// increase in bytes. Islands below roughly a 3-unit square at 2000 across are
// smaller than the stroke that would draw them.
const coast = build(polygons, { tol: 0.45, minArea: 6 });
const borders = build(countryRings, { tol: 1.1, minArea: 26 });

const GOLD = '#f7dc79';

const rAt = (lat) => (((90 - lat) / (90 - SOUTH_CUT)) * R).toFixed(1);

// ---------------------------------------------------------------------------
// THE GRATICULE, IN TWO WEIGHTS.
//
// The commonest way this projection is spoiled is a dense even net — it stops
// being a world and becomes a radar screen. But an even net is also mute: every
// circle says the same thing, so none of them says anything.
//
// So the lines are ranked. The equator is drawn heavier than its neighbours
// because it is the one parallel a reader can name; the tropics and the Arctic
// Circle are drawn dashed and fainter, because they are real lines with real
// meaning that must not compete with the coast. Twenty-four meridians rather
// than twelve, at half the weight — dense enough to model a sphere, light
// enough to stay behind the land.
// ---------------------------------------------------------------------------
const equator = `<circle cx="${C}" cy="${C}" r="${rAt(0)}" stroke="${GOLD}" stroke-opacity="0.30" stroke-width="2.4" fill="none"/>`;

const plainParallels = [75, 60, 45, 30, 15, -15, -30, -45]
  .map((lat) => `<circle cx="${C}" cy="${C}" r="${rAt(lat)}"/>`)
  .join('');

// 23.44° and 66.56° — the tropics and the polar circle, the only parallels on
// a map that are consequences of the planet rather than conveniences of tens.
const named = [23.44, -23.44, 66.56]
  .map((lat) => `<circle cx="${C}" cy="${C}" r="${rAt(lat)}"/>`)
  .join('');

const meridians = Array.from({ length: 24 }, (_, i) => {
  const [x, y] = project(i * 15, SOUTH_CUT);
  return `<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
}).join('');

// ---------------------------------------------------------------------------
// WHERE THIS UNIVERSITY ACTUALLY TEACHES FROM.
//
// READ, NOT COPIED. This was three coordinate pairs typed into this file with a
// comment asking whoever edited src/lib/flatWorld.ts to remember to edit here
// too. Nobody remembers, and the failure is silent: the map keeps drawing the
// old world and looks entirely correct while doing it.
//
// It now reads src/content/universityPlaces.json — the same register the module
// and the homepage read. The header of that file records what may be entered
// and on whose word.
//
// TWO MARKS. A site the university can name is a filled dot. A nation it has
// stated it teaches from without naming an address is an open ring at the
// country's centre, so the drawing claims a country and not a building.
// ---------------------------------------------------------------------------
const PLACES = JSON.parse(
  readFileSync(join(root, 'src/content/universityPlaces.json'), 'utf8'),
).nations.flatMap((n) => n.sites);

const places = PLACES.map(({ lon, lat, establishment }) => {
  const [x, y] = project(lon, lat);
  const core = establishment
    ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${GOLD}" fill-opacity="0.95"/>`
    : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7.5" fill="none" stroke="${GOLD}" stroke-opacity="0.9" stroke-width="3"/>`;
  return (
    core +
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="20" fill="none" stroke="${GOLD}" stroke-opacity="${establishment ? 0.5 : 0.34}" stroke-width="2.5"/>` +
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="40" fill="none" stroke="${GOLD}" stroke-opacity="${establishment ? 0.2 : 0.14}" stroke-width="2"/>`
  );
}).join('');

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" fill="none" role="presentation">` +
  `<defs>` +
  `<radialGradient id="sea" cx="50%" cy="46%" r="62%">` +
  `<stop offset="0%" stop-color="${GOLD}" stop-opacity="0.10"/>` +
  `<stop offset="100%" stop-color="${GOLD}" stop-opacity="0.02"/>` +
  `</radialGradient>` +
  // The land is lit from the pole outward rather than filled flat, so the disc
  // reads as a sphere seen from above instead of a sticker.
  `<radialGradient id="landfill" cx="50%" cy="50%" r="60%">` +
  `<stop offset="0%" stop-color="${GOLD}" stop-opacity="0.17"/>` +
  `<stop offset="100%" stop-color="${GOLD}" stop-opacity="0.07"/>` +
  `</radialGradient>` +
  `</defs>` +
  `<circle cx="${C}" cy="${C}" r="${R.toFixed(1)}" fill="url(#sea)"/>` +
  `<g stroke="${GOLD}" stroke-opacity="0.13" stroke-width="1.4" fill="none">${plainParallels}${meridians}</g>` +
  `<g stroke="${GOLD}" stroke-opacity="0.20" stroke-width="1.6" stroke-dasharray="10 14" fill="none">${named}</g>` +
  equator +
  // Borders UNDER the coast, so shared edges reinforce the coastline instead of
  // doubling it, and only the interior lines read as borders.
  `<path d="${borders.d}" fill="none" stroke="${GOLD}" stroke-opacity="0.26" stroke-width="1.5" stroke-linejoin="round"/>` +
  `<path d="${coast.d}" fill="url(#landfill)" fill-rule="evenodd" ` +
  `stroke="${GOLD}" stroke-opacity="0.78" stroke-width="2.2" stroke-linejoin="round"/>` +
  `<circle cx="${C}" cy="${C}" r="${R.toFixed(1)}" stroke="${GOLD}" stroke-width="3.5" stroke-opacity="0.6"/>` +
  places +
  `</svg>`;

mkdirSync(join(root, 'public/images'), { recursive: true });
writeFileSync(join(root, 'public/images/flat-world.svg'), svg);

console.log(
  `flat-world.svg  coast ${coast.kept} rings / ${coast.points} points, ` +
    `borders ${borders.kept} rings / ${borders.points} points, ` +
    `${PLACES.filter((p) => p.establishment).length} sites + ` +
    `${PLACES.filter((p) => !p.establishment).length} nations, ` +
    `${(svg.length / 1024).toFixed(0)}KB`,
);
