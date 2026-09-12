// ---------------------------------------------------------------------------
// WHERE THE INK ACTUALLY IS ON A SIGNING PAD.
//
// ---------------------------------------------------------------------------
// WHY A SIGNATURE HAS TO BE TRIMMED BEFORE IT IS KEPT
// ---------------------------------------------------------------------------
//
// Nobody signs in the middle of the box. They start where their hand lands,
// which is usually left of centre and high, and they use about a third of the
// space. Keep the canvas as drawn and the document gets an image that is mostly
// nothing, with the strokes floating somewhere inside it — so the signature
// prints small, sits off the rule, and moves depending on where the officer
// happened to start.
//
// Cropping to the ink makes the image BE the signature. It can then be sized
// against the rule like any other mark, and two officers signing in different
// corners of the pad produce documents that look the same.
//
// The arithmetic is here rather than in the component because it is the part
// that can be got wrong quietly — an off-by-one in the bounds crops a stroke,
// and the person who finds out is a graduate holding a certificate with a
// clipped signature on it.
// ---------------------------------------------------------------------------

export interface InkBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The smallest rectangle containing every mark, plus a margin.
 *
 * `alpha` is one byte per pixel — the alpha channel of the canvas, row by row.
 * A pad starts fully transparent and only the strokes are painted, so alpha is
 * exactly "is there ink here", with no threshold to guess at.
 *
 * Returns null when nothing was drawn. That is not an error: it is the answer
 * to "did anybody sign", and the caller must not save an empty image as a
 * signature — a blank PNG on the rule is worse than no image, because the rule
 * then cannot be signed by hand either.
 */
export function inkBounds(
  alpha: Uint8Array | Uint8ClampedArray | number[],
  width: number,
  height: number,
  padding = 0,
): InkBounds | null {
  if (width <= 0 || height <= 0) return null;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      // ANY ink at all, not "mostly opaque". The tail of a stroke and the
      // anti-aliased edge of a thin line are both faint, and a threshold set
      // above zero clips exactly the parts of a signature that are hardest to
      // reproduce and most characteristic of a hand.
      if (alpha[row + x] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;

  // The margin is clamped to the canvas rather than allowed to run outside it,
  // because a crop rectangle that starts at -8 silently shifts the whole image
  // in some browsers and throws in others.
  const pad = Math.max(0, Math.floor(padding));
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return {
    x,
    y,
    width: Math.min(width, maxX + 1 + pad) - x,
    height: Math.min(height, maxY + 1 + pad) - y,
  };
}

/**
 * Is there enough here to be a signature?
 *
 * A stray tap while reaching for the mouse leaves one dot, and saving it would
 * put a full stop on every certificate the University issues. Two millimetres
 * of travel in either direction is less than any signature and more than any
 * accident.
 */
export function looksSigned(bounds: InkBounds | null, minSpanPx = 24): boolean {
  if (!bounds) return false;
  return bounds.width >= minSpanPx || bounds.height >= minSpanPx;
}
