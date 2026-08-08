// ---------------------------------------------------------------------------
// THE PROJECTION, ON ITS OWN.
//
// Azimuthal equidistant, centred on the North Pole, cut at 60°S, with 20°E
// running straight down the sheet — the projection on the United Nations
// emblem, and the university's own.
//
// ===========================================================================
// WHY IT IS SEPARATED FROM flatWorld.ts
// ===========================================================================
//
// flatWorld.ts DRAWS the world: it imports ten thousand coastline points and
// the places register, and it builds SVG. That is right for the crest, which is
// rendered once on the server.
//
// The locations map on the homepage needs something much smaller. It shows the
// generated flat-world.svg as an image and positions its own pins over it, in
// the browser, so that selecting a nation can move a highlight. For that it
// needs THREE LINES OF TRIGONOMETRY and nothing else — and importing them from
// flatWorld.ts would have sent the entire coastline dataset to every visitor's
// browser to compute six coordinates.
//
// So the maths lives here, flatWorld.ts re-exports it unchanged, and the client
// component imports this file. One source, no duplication, and no atlas in the
// bundle.
//
// THE PINS MUST LAND ON THE DRAWN MAP. scripts/build-flat-world.mjs plots the
// same coordinates with its own copy of these two constants, at inset 0.94.
// A client asking for cx=cy=50, radius=47 gets percentages that line up with
// that drawing exactly — 47 being 94% of the half-width. Change the inset there
// and the overlay drifts, silently, by a few pixels per pin.
// ---------------------------------------------------------------------------

/** The meridian that runs straight down the sheet. Africa sits on it. */
export const DOWN_MERIDIAN = 20;

/** The southern cut. Everything below this latitude is off the disc. */
export const SOUTH_CUT = -60;

/**
 * Longitude and latitude to a point on the disc.
 *
 * WHICH WAY EAST TURNS. Seen from above the North Pole, longitude increases
 * ANTICLOCKWISE — and on a screen, where y grows downward, anticlockwise from
 * straight-down is towards the right. So east of 20°E swings right: Asia to the
 * right of Africa, the Americas to the upper left.
 *
 * Get the sign of the sine wrong and this becomes the view from INSIDE the
 * globe. It still looks like a world, which is exactly why a mirrored map
 * survives review: nobody double-checks a continent they recognise. The test is
 * Eurasia to the RIGHT of Africa, and src/lib/flatWorld.test.mjs states it.
 */
export function projectFlatWorld(
  lon: number,
  lat: number,
  cx: number,
  cy: number,
  radius: number,
): [number, number] {
  const r = ((90 - lat) / (90 - SOUTH_CUT)) * radius;
  const t = ((lon - DOWN_MERIDIAN) * Math.PI) / 180;
  return [cx + r * Math.sin(t), cy + r * Math.cos(t)];
}
