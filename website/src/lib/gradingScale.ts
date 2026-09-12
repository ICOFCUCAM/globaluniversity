// ---------------------------------------------------------------------------
// THE GRADING SCALE, WHEN THE UNIVERSITY HOLDS IT RATHER THAN THE REPOSITORY.
//
// ---------------------------------------------------------------------------
// WHY THE PUBLISHED SCALE IS STILL THE FLOOR
// ---------------------------------------------------------------------------
//
// `src/content/regulations.ts` carries the University's published bands, and
// `grading.ts` derives GRADING_SCALE and PASS_MARK from them. Everything in the
// system computes against those today, which is correct and is not being
// replaced — it is being made overridable.
//
// The reason the file remains the fallback rather than being deleted: a
// deployment that has not run migration 020, or one whose `grading_scales`
// table is empty or unreadable, must still grade exactly as it does now. A
// registry that cannot compute a GPA because a table is missing is worse than
// one that computes it from a slightly stale constant — and silently grading
// everything as zero, which is what an empty scale would do, is worse than
// both.
//
// ---------------------------------------------------------------------------
// AND WHY A SCALE IS NEVER EDITED
// ---------------------------------------------------------------------------
//
// A transcript issued in 2026 was computed under the 2026 bands. Rewriting them
// changes what the University said about a graduate after the fact — the same
// reason credential templates are versioned rather than edited, and the
// migration enforces it with a trigger rather than trusting this code.
// ---------------------------------------------------------------------------

import { GRADING_SCALE, PASS_MARK, MAX_GRADE_POINT, type GradeScale } from '@/lib/grading';

export interface Scale {
  bands: GradeScale[];
  passMark: number;
  maxPoint: number;
  /** What to call it on screen. */
  name: string;
  /** True while the published regulations are standing in for a stored row. */
  isFallback: boolean;
}

/** The University's published scale, as the repository carries it. */
export const PUBLISHED_SCALE: Scale = {
  bands: GRADING_SCALE,
  passMark: PASS_MARK,
  maxPoint: MAX_GRADE_POINT,
  name: 'Published regulations',
  isFallback: true,
};

/** A row of `grading_scales`, as loosely as the database hands it over. */
export interface ScaleRow {
  name?: unknown;
  pass_mark?: unknown;
  max_point?: unknown;
  bands?: unknown;
}

const num = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Turn a stored scale into one the rest of the system can use.
 *
 * A ROW THAT DOES NOT PARSE FALLS BACK RATHER THAN THROWING. The alternative
 * is a registry that stops working because somebody published a malformed
 * scale, and a malformed scale is the exact case a fallback exists for.
 *
 * The bands are re-sorted descending by minimum score regardless of the order
 * they were stored in, because `gradeFor` walks them and a scale stored
 * ascending would grade every mark as the lowest band it fits — which is a
 * fault that produces plausible grades and would not be noticed.
 */
export function scaleFromRow(row: ScaleRow | null | undefined): Scale {
  if (!row || !Array.isArray(row.bands) || row.bands.length === 0) return PUBLISHED_SCALE;

  const bands: GradeScale[] = [];
  for (const raw of row.bands as Record<string, unknown>[]) {
    const grade = String(raw?.grade ?? '').trim();
    if (!grade) continue;
    bands.push({
      grade,
      gradePoint: num(raw.points, 0),
      minScore: num(raw.min, 0),
      maxScore: num(raw.max, 100),
      remark: String(raw.descriptor ?? ''),
    });
  }
  if (bands.length === 0) return PUBLISHED_SCALE;

  bands.sort((a, b) => b.minScore - a.minScore);

  return {
    bands,
    passMark: num(row.pass_mark, PASS_MARK),
    maxPoint: num(row.max_point, Math.max(...bands.map((b) => b.gradePoint))),
    name: String(row.name ?? 'University grading scale'),
    isFallback: false,
  };
}

/** The band a mark falls in, under this scale. */
export function gradeFor(scale: Scale, totalScore: number): GradeScale | null {
  return scale.bands.find((b) => totalScore >= b.minScore && totalScore <= b.maxScore) ?? null;
}

/**
 * Whether a mark earns credit under this scale.
 *
 * READS THE SCALE'S OWN PASS MARK, not the published constant. A programme
 * graded on a different scale has a different pass mark by definition, and
 * comparing its marks against 65 is how a student passes on one screen and
 * fails on another.
 */
export function passes(scale: Scale, totalScore: number): boolean {
  return totalScore >= scale.passMark;
}

/**
 * Does a stored scale disagree with the published regulations?
 *
 * SHOWN, NEVER RESOLVED AUTOMATICALLY. Two sources for what a B is worth is a
 * real institutional problem — the website publishes one thing and the registry
 * computes another — and the honest response is to name the disagreement rather
 * than to pick a winner silently.
 */
export function divergesFromPublished(scale: Scale): string[] {
  if (scale.isFallback) return [];
  const differences: string[] = [];

  if (scale.passMark !== PASS_MARK) {
    differences.push(
      `The pass mark is ${scale.passMark}%, and the published regulations state ${PASS_MARK}%.`,
    );
  }
  for (const published of GRADING_SCALE) {
    const stored = scale.bands.find((b) => b.grade === published.grade);
    if (!stored) {
      differences.push(`The published grade ${published.grade} is not on this scale.`);
      continue;
    }
    if (stored.gradePoint !== published.gradePoint) {
      differences.push(
        `${published.grade} is worth ${stored.gradePoint.toFixed(2)} here and `
        + `${published.gradePoint.toFixed(2)} in the published regulations.`,
      );
    }
  }
  return differences;
}
