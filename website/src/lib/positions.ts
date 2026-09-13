// ---------------------------------------------------------------------------
// THE POSTS, AND THE JOB DESCRIPTIONS THEY INHERIT.
//
// ---------------------------------------------------------------------------
// WHY THIS IS INHERITANCE AND NOT FORTY-SIX DOCUMENTS
// ---------------------------------------------------------------------------
//
// The University asked for a job description for every post, and for a
// "reusable template architecture with position-specific clauses" rather than
// duplication. Those are the same requirement read twice, and the answer is a
// family profile plus a post's own.
//
// Forty-six separate documents would be forty-six places holding the
// confidentiality clause. Within a year four of them would say something
// different, and the one that mattered would be whichever got printed onto the
// letter of the person who later challenged their dismissal.
//
// ---------------------------------------------------------------------------
// REPLACES, DOES NOT MERGE
// ---------------------------------------------------------------------------
//
// A post that states its own clauses for a section takes them INSTEAD of the
// family's for that section, and keeps the family's everywhere else. Appending
// would produce a job description that says two things about one duty — and a
// Dean whose financial authority differs from the family's needs the difference
// to be the document, not a contradiction inside it.
//
// The resolution is also a database view (`position_job_description`), and the
// two must agree. `positions.test.mjs` asserts they do, because a screen and a
// letter disagreeing about a job description is the failure this is for.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. THE FAMILIES
// ---------------------------------------------------------------------------

export const POSITION_FAMILIES = [
  'executive', 'academic-administration', 'faculty-leadership',
  'administration', 'student-services', 'ict', 'academic-staff', 'other',
] as const;

export type PositionFamily = (typeof POSITION_FAMILIES)[number];

export const FAMILY_LABELS: Record<PositionFamily, string> = {
  executive: 'Executive',
  'academic-administration': 'Academic administration',
  'faculty-leadership': 'Faculties',
  administration: 'Administration',
  'student-services': 'Student services',
  ict: 'ICT',
  'academic-staff': 'Academic staff',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// 2. THE SECTIONS OF A JOB DESCRIPTION
// ---------------------------------------------------------------------------
//
// IN THE ORDER THEY ARE PRINTED. The order lives here rather than in the
// database because it is a fact about the document, not about the data, and a
// view that returned rows in printing order would be answering a question about
// layout.

export const JD_SECTIONS = [
  'key-responsibilities', 'institutional', 'academic', 'administrative',
  'financial', 'people-management', 'student', 'research', 'ict', 'compliance',
  'may-authorize', 'may-recommend', 'must-obtain-approval',
  'reporting', 'performance-areas', 'performance-indicators',
  'qualifications', 'experience', 'technical-skills',
  'behavioural-competencies', 'working-relationships',
  'confidentiality', 'evaluation', 'amendment',
] as const;

export type JdSection = (typeof JD_SECTIONS)[number];

export const SECTION_LABELS: Record<JdSection, string> = {
  'key-responsibilities': 'Key Responsibilities',
  institutional: 'Institutional Responsibilities',
  academic: 'Academic Responsibilities',
  administrative: 'Administrative Responsibilities',
  financial: 'Financial and Resource Responsibilities',
  'people-management': 'People Management',
  student: 'Student Responsibilities',
  research: 'Research Responsibilities',
  ict: 'ICT and Digital Responsibilities',
  compliance: 'Compliance Responsibilities',
  // THE THREE THAT ARE THE POINT OF THE DOCUMENT. "May recommend" and "may
  // authorise" are the difference between advice and a commitment of the
  // University, and a job description that blurs them is the one produced when
  // somebody committed it without the authority to.
  'may-authorize': 'May authorise',
  'may-recommend': 'May recommend',
  'must-obtain-approval': 'Must obtain approval',
  reporting: 'Reporting Requirements',
  'performance-areas': 'Key Performance Areas',
  'performance-indicators': 'Key Performance Indicators',
  qualifications: 'Required Qualifications',
  experience: 'Required Experience',
  'technical-skills': 'Professional and Technical Skills',
  'behavioural-competencies': 'Behavioural Competencies',
  'working-relationships': 'Working Relationships',
  confidentiality: 'Confidentiality Requirements',
  evaluation: 'Review and Performance Evaluation',
  amendment: 'Amendment and Review of this Job Description',
};

/** The three sections that together state the post's decision-making authority. */
export const AUTHORITY_SECTIONS: JdSection[] = [
  'may-authorize', 'may-recommend', 'must-obtain-approval',
];

export function isJdSection(v: unknown): v is JdSection {
  return typeof v === 'string' && (JD_SECTIONS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// 3. THE RECORDS
// ---------------------------------------------------------------------------

export interface Position {
  id?: string;
  job_code?: string | null;
  title?: string | null;
  family?: string | null;
  unit_name?: string | null;
  faculty?: string | null;
  reports_to?: string | null;
  supervises?: string | null;
  duty_station?: string | null;
  employment_category?: string | null;
  grade?: string | null;
  /** INDICATIVE ONLY. Never printed on a letter — see `indicativePay`. */
  indicative_salary_amount?: number | null;
  indicative_salary_currency?: string | null;
  indicative_salary_period?: string | null;
  active?: boolean | null;
}

export interface Clause {
  section?: string | null;
  ordinal?: number | null;
  body?: string | null;
  /** 'family' or 'position' — which document this clause came from. */
  source?: string | null;
}

export interface PositionProfile {
  id?: string;
  position_id?: string | null;
  family?: string | null;
  version?: number | null;
  job_purpose?: string | null;
  status?: string | null;
  created_by?: string | null;
  activated_by?: string | null;
}

export const PROFILE_STATES = ['draft', 'active', 'superseded'] as const;
export const MIN_PURPOSE = 40;
export const MIN_CLAUSE = 10;

// ---------------------------------------------------------------------------
// 4. THE RESOLUTION
// ---------------------------------------------------------------------------

/**
 * A post's job description: its family's clauses, with its own replacing them
 * section by section.
 *
 * THE SAME RULE THE VIEW APPLIES, and the test holds them together. Written
 * here as well because a screen that had to query a view to show a preview of
 * an unsaved draft could not, and a second rule invented for that case is how
 * the two come to disagree.
 */
export function resolveJobDescription(
  familyClauses: Clause[], ownClauses: Clause[],
): Clause[] {
  const restated = new Set(ownClauses.map((c) => c.section));
  const kept = familyClauses
    .filter((c) => !restated.has(c.section))
    .map((c) => ({ ...c, source: 'family' }));
  const own = ownClauses.map((c) => ({ ...c, source: 'position' }));
  return order([...kept, ...own]);
}

/** In printing order: by section as the document runs, then by ordinal. */
export function order(clauses: Clause[]): Clause[] {
  const at = (s: unknown) => {
    const i = (JD_SECTIONS as readonly string[]).indexOf(String(s));
    // AN UNKNOWN SECTION SORTS LAST rather than first. A clause the code does
    // not recognise must not open the document.
    return i === -1 ? JD_SECTIONS.length : i;
  };
  return [...clauses].sort((a, b) =>
    at(a.section) - at(b.section) || (a.ordinal ?? 0) - (b.ordinal ?? 0));
}

/** The sections present, in printing order, for a screen that draws headings. */
export function sectionsOf(clauses: Clause[]): JdSection[] {
  const seen = new Set<string>();
  for (const c of order(clauses)) if (c.section) seen.add(String(c.section));
  return JD_SECTIONS.filter((s) => seen.has(s));
}

// ---------------------------------------------------------------------------
// 5. WHAT IS WRONG WITH IT, SAID BEFORE IT IS APPROVED
// ---------------------------------------------------------------------------

export interface JdObjection {
  code: string;
  blocking: boolean;
  message: string;
}

/**
 * Whether this profile is fit to be activated, and what is missing if not.
 *
 * THE BLOCKING ONES ARE WHAT THE DATABASE ALSO REFUSES. The rest are the
 * sections a job description is not much use without — said as advice, because
 * a University that wants to approve a short one for a temporary post should
 * not be stopped by this file.
 */
export function objectionsToProfile(
  p: PositionProfile, clauses: Clause[],
): JdObjection[] {
  const out: JdObjection[] = [];
  const purpose = (p.job_purpose ?? '').trim();

  if (purpose.length < MIN_PURPOSE) {
    out.push({
      code: 'no-purpose',
      blocking: true,
      message: 'Say why the post exists. It is the first question at any review, and a job '
        + 'description without it is a list of tasks.',
    });
  }
  if (clauses.length === 0) {
    out.push({
      code: 'no-clauses',
      blocking: true,
      message: 'A job description with no duties in it describes nothing.',
    });
  }

  const present = new Set(clauses.map((c) => String(c.section)));
  if (!AUTHORITY_SECTIONS.some((s) => present.has(s))) {
    out.push({
      code: 'no-authority-stated',
      blocking: false,
      message: 'Nothing states what the holder may authorise, may recommend, or must escalate. '
        + 'That distinction is what the document is produced for when somebody commits the '
        + 'University without the authority to.',
    });
  }
  for (const [section, why] of [
    ['performance-areas', 'Nothing says what the holder is assessed on, so a review has '
      + 'nothing to measure against.'],
    ['qualifications', 'Nothing states what the post requires, so a recruitment cannot be '
      + 'defended.'],
    ['confidentiality', 'Nothing states what the holder must keep confidential.'],
  ] as [JdSection, string][]) {
    if (!present.has(section)) {
      out.push({ code: `no-${section}`, blocking: false, message: why });
    }
  }
  return out;
}

export function blocksApproval(objections: JdObjection[]): boolean {
  return objections.some((o) => o.blocking);
}

/**
 * Whether this person may activate this profile.
 *
 * NOBODY ACTIVATES WHAT THEY WROTE — the rule 044 applies to a letter template
 * and 005 to a certificate design, and it matters more here. A job description
 * says what its holder may authorise and what they are assessed on. One person
 * writing and approving that alone is one person setting the terms on which
 * somebody else can be dismissed.
 */
export function canActivateProfile(p: PositionProfile, callerId: string): boolean {
  if (p.status !== 'draft') return false;
  if (p.created_by && p.created_by === callerId) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 6. THE INDICATIVE FIGURE
// ---------------------------------------------------------------------------

/**
 * What a post is usually worth, as a line for the person making the appointment.
 *
 * FOR THE SCREEN, NEVER FOR THE LETTER. The University's ruling is that a
 * figure may be carried and the box may be left empty — so the Vice-Chancellor
 * can take this one or type over it, and what prints on the letter is
 * `appointments.salary_amount` and nothing else. A figure that could reach a
 * letter from here would be the University stating a salary it had not decided
 * for the person holding it.
 */
export function indicativePay(p: Position): string | null {
  if (p.indicative_salary_amount == null || !p.indicative_salary_currency) return null;
  const n = Number(p.indicative_salary_amount).toLocaleString('en-US');
  return `${p.indicative_salary_currency} ${n} (indicative)`;
}

/** IGUC/ACS-LEC — how a post is cited on a document. */
export function printedCode(jobCode: string): string {
  return `IGUC/${jobCode.trim().toUpperCase()}`;
}
