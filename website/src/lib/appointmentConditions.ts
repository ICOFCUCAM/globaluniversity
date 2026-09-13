// ---------------------------------------------------------------------------
// THE CONDITIONS A POST IS APPOINTED ON.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS AT ALL
// ---------------------------------------------------------------------------
//
// The appointment form has a box labelled "Appointment conditions". Until 078
// it was empty, it stayed empty, and nothing in the system had anything to put
// in it. The University said so plainly: "just with the letter and empty
// conditions it cannot match the sample you generated earlier."
//
// A letter of appointment with no conditions is not a short contract. It is a
// contract in which the duration, the probation, the notice period, the
// confidentiality obligation and the intellectual property position are all
// unstated — and every one of those is a term somebody eventually needs to
// point at.
//
// ---------------------------------------------------------------------------
// A DEFAULT, IN A BOX, THAT A HUMAN READS
// ---------------------------------------------------------------------------
//
// These are NOT appended to a letter out of the database the way a job
// description is. They are rendered into an editable textarea where the
// officer preparing the letter can change every word, and the Vice-Chancellor
// reads them again before approving. That is the whole reason 078 seeds them
// active while 048's job descriptions are still drafts — the difference is
// whether anybody looks at it on the way past.
//
// ---------------------------------------------------------------------------
// THE ORDER LIVES HERE, NOT IN THE DATABASE
// ---------------------------------------------------------------------------
//
// Same argument as `JD_SECTIONS` in `positions.ts`: the order clauses are
// printed in is a fact about the document, and a view that returned rows in
// printing order would be answering a question about layout. The database
// resolves WHICH clauses apply; this decides what they look like.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. THE SECTIONS, IN THE ORDER A CONTRACT STATES THEM
// ---------------------------------------------------------------------------
//
// Roughly: what this is, how long it lasts, what you do, what you are paid,
// what you may not do, and how it ends. A reader looking for the notice period
// should not have to pass the intellectual property clause to reach it, and a
// reader looking for what they are paid should find it before either.

export const CONDITION_SECTIONS = [
  'appointment', 'duration', 'probation', 'duties',
  'hours', 'place-of-duty',
  'remuneration', 'allowances', 'deductions', 'leave',
  'conduct', 'confidentiality', 'intellectual-property', 'outside-work',
  'discipline', 'termination', 'notice', 'retirement',
  'dispute', 'governing-policies', 'amendment', 'acceptance',
] as const;

export type ConditionSection = (typeof CONDITION_SECTIONS)[number];

export const CONDITION_LABELS: Record<ConditionSection, string> = {
  appointment: 'Appointment',
  duration: 'Duration of appointment',
  probation: 'Probation',
  duties: 'Duties',
  hours: 'Hours of work',
  'place-of-duty': 'Place of duty',
  remuneration: 'Remuneration',
  allowances: 'Allowances',
  deductions: 'Deductions',
  leave: 'Leave',
  conduct: 'Conduct and conflict of interest',
  confidentiality: 'Confidentiality',
  'intellectual-property': 'Intellectual property',
  'outside-work': 'Outside work',
  discipline: 'Discipline',
  termination: 'Termination',
  notice: 'Notice',
  retirement: 'Retirement',
  dispute: 'Grievance and dispute',
  'governing-policies': 'Governing statutes and policies',
  amendment: 'Amendment of these conditions',
  acceptance: 'Acceptance',
};

export function isConditionSection(v: unknown): v is ConditionSection {
  return typeof v === 'string' && (CONDITION_SECTIONS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// 2. WHAT THE VIEW RETURNS
// ---------------------------------------------------------------------------

/** One resolved clause, as `position_default_conditions` hands it over. */
export interface ConditionClause {
  section: string;
  ordinal: number;
  body: string;
  preamble?: string | null;
  /** 'position' where the post states its own, 'family' where it inherits. */
  source?: string | null;
}

/** The columns to select. A single string literal, because supabase-js needs one. */
export const CONDITION_COLUMNS = 'section, ordinal, body, preamble, source';

// ---------------------------------------------------------------------------
// 3. TURNING THEM INTO THE TEXT THAT GOES IN THE BOX
// ---------------------------------------------------------------------------

/**
 * Render resolved clauses as the numbered conditions of a letter.
 *
 * NUMBERED BY SECTION, NOT BY CLAUSE. "Clause 7" in a dispute needs to mean one
 * thing, and a section with two clauses is still one condition with two
 * sentences — numbering each sentence separately would make the sixth condition
 * of a Dean's letter and the sixth of a lecturer's refer to different subjects.
 *
 * A SECTION THIS FILE DOES NOT KNOW IS STILL PRINTED, at the end, under its own
 * raw name. Dropping it would mean a condition the University wrote in the
 * database silently failing to reach the letter, which is the worse failure of
 * the two.
 */
export function renderConditions(rows: ConditionClause[]): string {
  if (rows.length === 0) return '';

  const known = (CONDITION_SECTIONS as readonly string[]);
  const rank = (s: string) => {
    const i = known.indexOf(s);
    return i === -1 ? known.length : i;
  };

  // Group by section, keeping each section's clauses in ordinal order.
  const bySection = new Map<string, ConditionClause[]>();
  for (const r of rows) {
    const list = bySection.get(r.section) ?? [];
    list.push(r);
    bySection.set(r.section, list);
  }

  const sections = Array.from(bySection.keys()).sort((a, b) => {
    const d = rank(a) - rank(b);
    return d !== 0 ? d : a.localeCompare(b);
  });

  const preamble = rows.find((r) => r.preamble && r.preamble.trim())?.preamble?.trim();

  const out: string[] = [];
  if (preamble) out.push(preamble, '');

  sections.forEach((section, i) => {
    const label = isConditionSection(section)
      ? CONDITION_LABELS[section]
      // A section the database has and this file does not: print the raw name
      // rather than nothing, so it is visible and can be labelled next.
      : section.replace(/-/g, ' ').replace(/^./, (c: string) => c.toUpperCase());

    const clauses = [...(bySection.get(section) ?? [])]
      .sort((a, b) => a.ordinal - b.ordinal);

    out.push(`${i + 1}. ${label.toUpperCase()}`);
    for (const c of clauses) out.push(`   ${c.body.trim()}`);
    out.push('');
  });

  return out.join('\n').trimEnd();
}

/**
 * How many conditions a rendering carries, for a screen that wants to say so.
 *
 * COUNTS SECTIONS, matching what `renderConditions` numbers. A screen that said
 * "24 conditions" over a letter numbered to 22 would be reporting on something
 * the reader cannot see.
 */
export function countConditions(rows: ConditionClause[]): number {
  return new Set(rows.map((r) => r.section)).size;
}
