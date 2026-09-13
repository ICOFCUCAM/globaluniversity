// ---------------------------------------------------------------------------
// WHAT AN APPOINTMENT LETTER SAYS, AND WHY IT DEPENDS ON THE OFFICE.
//
// ---------------------------------------------------------------------------
// THE PROBLEM THIS SOLVES
// ---------------------------------------------------------------------------
//
// There was one letter. It opened "We are pleased to formally appoint you as
// X", printed a table, printed whatever terms had been typed into the record,
// and closed. It said exactly the same thing to a Lecturer as to the Director
// of Academic Affairs.
//
// That is not a saving. A letter appointing somebody to a senior executive
// office has to say what the office IS — that it carries delegated authority,
// that its holder accounts to the Vice-Chancellor for the exercise of it, that
// substantial amendments are formally documented. A letter appointing a
// Lecturer must say none of those things, because a Lecturer holds no delegated
// authority and a letter implying otherwise is a letter somebody will one day
// wave in an argument about what they were entitled to decide.
//
// So the University asked for wording that changes with the post. This file is
// the register of that wording: one entry per position family, and each entry
// says what that kind of letter opens with, what it calls the section about the
// holder's standing, whether delegated authority is mentioned at all, and what
// it closes with.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE IS NOT ALLOWED TO DO
// ---------------------------------------------------------------------------
//
// GRANT ANYTHING. The University was explicit: the letter must not invent
// powers beyond what has been authorised. Nothing here says what a post may
// authorise, may recommend, or must escalate — those three live in the job
// description, which 048 versions and approves separately, and the letter
// REFERENCES that document rather than restating it.
//
// The distinction is worth being pedantic about, because it is the one that
// fails quietly. "You shall exercise such powers as are assigned to the office
// or formally delegated to you by the Vice-Chancellor" is a statement about
// WHERE authority comes from, and is safe in a template. "You may approve
// expenditure up to USD 5,000" is a grant, and putting it in a template would
// hand it to every holder of every post in that family for ever.
//
// NAME A POST. The families are shapes of office, not offices. What a
// particular post is called, who it reports to and where it sits are in
// `positions` (048) and on the appointment record.
// ---------------------------------------------------------------------------

import type { PositionFamily } from './positions';

// ---------------------------------------------------------------------------
// 1. THE PIECES OF A LETTER THAT VARY
// ---------------------------------------------------------------------------

export interface LetterRegister {
  /**
   * What the letter is about, in the subject line: "APPOINTMENT AS …".
   *
   * A verb rather than a noun where the family calls for it — an academic
   * appointment is "APPOINTMENT TO THE ACADEMIC STAFF" when the post is a
   * teaching one, because that is what the University is doing.
   */
  subject: (title: string) => string;

  /** The sentence that opens the letter, after the salutation. */
  opening: (title: string, university: string) => string;

  /**
   * The heading and prose of the section describing the holder's standing.
   *
   * NULL FOR THE FAMILIES THAT HAVE NO SUCH SECTION. A letter to a member of
   * the support staff that solemnly describes their "status within the
   * executive structure" is a letter nobody wrote on purpose.
   */
  status: { heading: string; paragraphs: string[] } | null;

  /**
   * Whether this family's letter mentions delegated authority at all.
   *
   * THE SINGLE MOST IMPORTANT FLAG IN THIS FILE. It decides whether the letter
   * contains a sentence about exercising the University's authority — and the
   * families where it is false are the families where such a sentence would be
   * untrue.
   */
  carriesDelegatedAuthority: boolean;

  /** What the section listing the post's duties is called. */
  responsibilitiesHeading: string;

  /**
   * The sentence introducing the duties, before the job description's own
   * clauses are printed under it.
   */
  responsibilitiesLead: (title: string) => string;

  /** The heading and prose of the accountability section. */
  accountability: { heading: string; paragraphs: (reportsTo: string) => string[] };

  /** Any conduct obligation particular to this family, added to the common list. */
  conductAdditions: string[];

  /** The paragraph that closes the letter above the signature. */
  closing: (title: string, university: string) => string[];
}

// ---------------------------------------------------------------------------
// 2. THE OBLIGATIONS EVERY LETTER CARRIES
// ---------------------------------------------------------------------------
//
// COMMON BECAUSE THEY ARE COMMON, not because it was convenient. Every one of
// these applies to a cleaner and to the Vice-Chancellor, and a list that varied
// by rank would be saying that integrity does.

export const COMMON_CONDUCT: string[] = [
  'perform your responsibilities diligently and professionally;',
  'comply with applicable University policies, regulations and procedures;',
  'maintain appropriate confidentiality concerning University information;',
  'avoid actual or potential conflicts of interest;',
  'protect the University’s academic and institutional integrity;',
  'maintain appropriate professional relationships with staff and students; and',
  'comply with lawful instructions issued by the Vice-Chancellor and other duly '
    + 'authorized University authorities.',
];

/**
 * The obligation that only applies to somebody who holds authority.
 *
 * SPLIT OUT rather than left in the common list, because "exercise University
 * authority responsibly" in a letter to somebody with none is the same quiet
 * implication this whole file exists to avoid.
 */
export const AUTHORITY_CONDUCT = 'exercise University authority responsibly;';

// ---------------------------------------------------------------------------
// 3. THE REGISTERS
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE UNIVERSITY'S OWN WORDING.
//
// Sections 2 to 13 were written by the University and supplied in full on
// 13 September 2026. Where the text below reads formally, that is because it is
// theirs and not a paraphrase of theirs — an appointment letter is relied upon
// years later by people who were not in the room, and rewording it to sound
// better is how a document stops meaning what was agreed.
//
// The bracketed placeholders in the University's draft — [AMOUNT], [NUMBER],
// [DATE] — are the only parts deliberately not carried across. Each of them is
// a field on the appointment record, and a letter that prints a bracket is a
// letter whose record was incomplete when somebody signed it.
// ---------------------------------------------------------------------------

const executiveStatus = (what: string, advisesOn: string) => ({
  heading: 'Status and Executive Responsibility',
  paragraphs: [
    `You shall provide executive leadership, coordination and oversight of ${what}, subject `
    + 'to the authority of the Vice-Chancellor and the University’s governing instruments.',
    'You shall be expected to provide effective leadership in the administration and development '
    + `of ${what}, and to ensure that its activities are conducted in accordance with approved `
    + 'University policies, regulations, standards and procedures.',
    'You shall exercise such powers and responsibilities as are assigned to the office or '
    + 'formally delegated to you by the Vice-Chancellor.',
    'You shall also advise and support the Vice-Chancellor on matters relating to '
    + `${advisesOn}, and other matters falling within your designated responsibilities.`,
  ],
});

export const REGISTERS: Record<PositionFamily, LetterRegister> = {
  // -------------------------------------------------------------------------
  executive: {
    subject: (t) => `Appointment as ${t}`,
    opening: (t, u) =>
      `I am pleased, on behalf of ${u}, to formally appoint you as ${t}.`,
    status: executiveStatus(
      'the functions of your office',
      'the administration and development of the University',
    ),
    carriesDelegatedAuthority: true,
    responsibilitiesHeading: 'Principal Areas of Responsibility',
    responsibilitiesLead: () =>
      'Without limiting the detailed duties contained in your Job Description and Terms of '
      + 'Reference, your responsibilities shall include, where formally assigned to the office:',
    accountability: {
      heading: 'Reporting and Accountability',
      paragraphs: (to) => [
        `You shall report to ${to} and shall be accountable for the effective discharge of the `
        + 'responsibilities assigned to your office.',
        'You shall provide such reports, recommendations and other information as may reasonably '
        + 'be required.',
        // THE SENTENCE THAT STOPS A LETTER BECOMING A TRANSFER OF POWER. Every
        // executive letter carries it, and it is the reason the rest of the
        // section can be written plainly.
        'Nothing in this appointment shall be interpreted as transferring authority reserved '
        + 'exclusively to the Vice-Chancellor or to another University authority under the '
        + 'University’s governing instruments.',
      ],
    },
    conductAdditions: [AUTHORITY_CONDUCT],
    closing: (t, u) => [
      `The University trusts that you will discharge the responsibilities of the office of ${t} `
      + 'with professionalism, integrity and diligence.',
      `We look forward to your leadership and contribution to the continued development of ${u}.`,
    ],
  },

  // -------------------------------------------------------------------------
  'academic-administration': {
    subject: (t) => `Appointment as ${t}`,
    opening: (t, u) =>
      `I am pleased, on behalf of ${u}, to formally appoint you as ${t}.`,
    status: executiveStatus(
      'the University’s academic affairs',
      'academic administration, academic development, quality and student academic affairs',
    ),
    carriesDelegatedAuthority: true,
    responsibilitiesHeading: 'Principal Areas of Responsibility',
    responsibilitiesLead: () =>
      'Without limiting the detailed duties contained in your Job Description and Terms of '
      + 'Reference, your responsibilities shall include the appropriate oversight and '
      + 'coordination of the University’s academic affairs, including, where formally assigned '
      + 'to the office:',
    accountability: {
      heading: 'Reporting and Accountability',
      paragraphs: (to) => [
        `You shall report directly to ${to} and shall be accountable for the effective discharge `
        + 'of the responsibilities assigned to your office.',
        'You shall provide such reports, recommendations, academic assessments and other '
        + 'information as may reasonably be required.',
        'You shall work collaboratively with the Registrar, the Finance Office, the Admissions '
        + 'Office, the Deans, the academic departments and other University offices in matters '
        + 'requiring institutional coordination.',
        'Nothing in this appointment shall be interpreted as transferring authority reserved '
        + 'exclusively to the Vice-Chancellor or to another University authority under the '
        + 'University’s governing instruments.',
      ],
    },
    conductAdditions: [AUTHORITY_CONDUCT],
    closing: (t, u) => [
      `The University trusts that you will discharge the responsibilities of the office of ${t} `
      + 'with professionalism, integrity, diligence and commitment to the academic mission of '
      + 'the University.',
      'We look forward to your leadership and contribution to the continued development of the '
      + `academic programmes, academic standards and institutional objectives of ${u}.`,
    ],
  },

  // -------------------------------------------------------------------------
  'faculty-leadership': {
    subject: (t) => `Appointment as ${t}`,
    opening: (t, u) =>
      `I am pleased, on behalf of ${u}, to formally appoint you as ${t}.`,
    status: {
      heading: 'Status and Academic Leadership',
      paragraphs: [
        'You shall lead the academic work of your faculty or department, including curriculum '
        + 'design, programme review and the maintenance of academic standards, subject to the '
        + 'University’s governing instruments and approved academic policies.',
        'You shall exercise such powers and responsibilities as are assigned to the office or '
        + 'formally delegated to you.',
      ],
    },
    carriesDelegatedAuthority: true,
    responsibilitiesHeading: 'Principal Areas of Responsibility',
    responsibilitiesLead: (t) =>
      `Without limiting the detailed duties contained in your job description, the ${t} is `
      + 'responsible for:',
    accountability: {
      heading: 'Reporting and Accountability',
      paragraphs: (to) => [
        `You shall report to ${to} and shall be accountable for the academic conduct and standards `
        + 'of your unit.',
        'You shall chair the meetings of the unit, maintain its records, and report on its '
        + 'business as required.',
      ],
    },
    conductAdditions: [AUTHORITY_CONDUCT],
    closing: (t, u) => [
      'The University trusts that you will lead your unit with professionalism, integrity and '
      + 'academic rigour.',
      `We look forward to your contribution to the academic standing of ${u}.`,
    ],
  },

  // -------------------------------------------------------------------------
  // THE TEACHING LETTER. No executive status section, no delegated authority,
  // and a closing about scholarship rather than leadership — because a Lecturer
  // is appointed to teach and to research, and a letter that says otherwise
  // describes a different job.
  'academic-staff': {
    subject: (t) => `Appointment to the Academic Staff — ${t}`,
    opening: (t, u) =>
      `I am pleased, on behalf of ${u}, to offer you appointment to the academic staff of the `
      + `University as ${t}.`,
    status: {
      heading: 'Academic Duties',
      paragraphs: [
        'You shall teach the courses allocated to you, to the syllabus approved for the '
        + 'programme, and shall set, invigilate and mark assessments in accordance with the '
        + 'University’s examination regulations.',
        'You shall pursue an active programme of research or scholarship appropriate to your '
        + 'discipline and to the grade of the post.',
      ],
    },
    carriesDelegatedAuthority: false,
    responsibilitiesHeading: 'Duties of the Post',
    responsibilitiesLead: () =>
      'Without limiting the detailed duties contained in your job description, your duties '
      + 'include:',
    accountability: {
      heading: 'Reporting',
      paragraphs: (to) => [
        `You shall report to ${to} in respect of your teaching, assessment and supervisory `
        + 'duties.',
        'You shall submit marks, reports and returns by the published deadlines.',
      ],
    },
    conductAdditions: [
      'uphold academic integrity in teaching, assessment, supervision and research; and',
      'observe the University’s examination regulations, including those governing the '
      + 'security of assessment materials.',
    ],
    closing: (t, u) => [
      'The University trusts that you will discharge your teaching and scholarly duties with '
      + 'professionalism and integrity.',
      `We look forward to your contribution to the teaching and scholarship of ${u}.`,
    ],
  },

  // -------------------------------------------------------------------------
  administration: {
    subject: (t) => `Appointment as ${t}`,
    opening: (t, u) =>
      `I am pleased, on behalf of ${u}, to formally appoint you as ${t}.`,
    status: {
      heading: 'Duties of the Post',
      paragraphs: [
        'You shall carry out the administrative duties of the post in accordance with the '
        + 'University’s policies, regulations and approved procedures.',
      ],
    },
    carriesDelegatedAuthority: false,
    responsibilitiesHeading: 'Principal Duties',
    responsibilitiesLead: () =>
      'Without limiting the detailed duties contained in your job description, your duties '
      + 'include:',
    accountability: {
      heading: 'Reporting',
      paragraphs: (to) => [
        `You shall report to ${to} and shall be accountable for the duties assigned to the post.`,
      ],
    },
    conductAdditions: [],
    closing: (t, u) => [
      'The University trusts that you will carry out the duties of the post with professionalism '
      + 'and integrity.',
      `We look forward to your contribution to the work of ${u}.`,
    ],
  },

  // -------------------------------------------------------------------------
  'student-services': {
    subject: (t) => `Appointment as ${t}`,
    opening: (t, u) =>
      `I am pleased, on behalf of ${u}, to formally appoint you as ${t}.`,
    status: {
      heading: 'Duties of the Post',
      paragraphs: [
        'You shall provide the services of your office to the students of the University in '
        + 'accordance with the University’s policies, regulations and approved procedures.',
      ],
    },
    carriesDelegatedAuthority: false,
    responsibilitiesHeading: 'Principal Duties',
    responsibilitiesLead: () =>
      'Without limiting the detailed duties contained in your job description, your duties '
      + 'include:',
    accountability: {
      heading: 'Reporting',
      paragraphs: (to) => [
        `You shall report to ${to} and shall be accountable for the duties assigned to the post.`,
      ],
    },
    conductAdditions: [
      'maintain the confidentiality of student information and observe the University’s '
      + 'requirements governing student records.',
    ],
    closing: (t, u) => [
      'The University trusts that you will carry out the duties of the post with professionalism '
      + 'and care for the students in your charge.',
      `We look forward to your contribution to the student experience at ${u}.`,
    ],
  },

  // -------------------------------------------------------------------------
  ict: {
    subject: (t) => `Appointment as ${t}`,
    opening: (t, u) =>
      `I am pleased, on behalf of ${u}, to formally appoint you as ${t}.`,
    status: {
      heading: 'Duties of the Post',
      paragraphs: [
        'You shall maintain the University’s information systems, their availability and their '
        + 'security, in accordance with the University’s policies and approved procedures.',
      ],
    },
    carriesDelegatedAuthority: false,
    responsibilitiesHeading: 'Principal Duties',
    responsibilitiesLead: () =>
      'Without limiting the detailed duties contained in your job description, your duties '
      + 'include:',
    accountability: {
      heading: 'Reporting',
      paragraphs: (to) => [
        `You shall report to ${to} and shall be accountable for the duties assigned to the post.`,
      ],
    },
    conductAdditions: [
      // THE ONE THAT MATTERS FOR THIS FAMILY. Administrative access to a
      // student record system is access to every student's record, and the
      // letter should say so at the moment the access is granted.
      'access University systems and the data they hold only as required for the duties of the '
      + 'post, and observe the University’s requirements governing personal data.',
    ],
    closing: (t, u) => [
      'The University trusts that you will carry out the duties of the post with professionalism '
      + 'and care for the systems and data in your charge.',
      `We look forward to your contribution to the work of ${u}.`,
    ],
  },

  // -------------------------------------------------------------------------
  // THE FALLBACK, AND IT IS DELIBERATELY THE PLAINEST OF THE EIGHT. A post
  // nobody has classified gets a correct, modest letter rather than an
  // executive one — an unclassified post inheriting the grandest wording is
  // precisely the accident this file is built to prevent.
  other: {
    subject: (t) => `Appointment as ${t}`,
    opening: (t, u) =>
      `I am pleased, on behalf of ${u}, to formally appoint you as ${t}.`,
    status: null,
    carriesDelegatedAuthority: false,
    responsibilitiesHeading: 'Duties of the Post',
    responsibilitiesLead: () =>
      'Without limiting the detailed duties contained in your job description, your duties '
      + 'include:',
    accountability: {
      heading: 'Reporting',
      paragraphs: (to) => [
        `You shall report to ${to} and shall be accountable for the duties assigned to the post.`,
      ],
    },
    conductAdditions: [],
    closing: (t, u) => [
      'The University trusts that you will carry out the duties of the post with professionalism '
      + 'and integrity.',
      `We look forward to your contribution to the work of ${u}.`,
    ],
  },
};

/**
 * The register for a family, falling back to the plainest one.
 *
 * FALLS BACK DOWN, NEVER UP. An unrecognised family — a value from a future
 * migration this build has not seen — gets `other`, which grants nothing and
 * claims nothing. The alternative, defaulting to the family the post most
 * resembles, would mean a typo in a seed producing an executive letter.
 */
export function registerFor(family: string | null | undefined): LetterRegister {
  return REGISTERS[(family ?? 'other') as PositionFamily] ?? REGISTERS.other;
}

/** The conduct list for a family: the common obligations plus its own. */
export function conductFor(register: LetterRegister): string[] {
  const common = [...COMMON_CONDUCT];
  if (register.carriesDelegatedAuthority) {
    // Inserted before the final two, so the list still reads as a list rather
    // than having its "and" in the middle.
    common.splice(common.length - 2, 0, AUTHORITY_CONDUCT);
  }
  const extra = register.conductAdditions.filter((c) => c !== AUTHORITY_CONDUCT);
  return [...common, ...extra];
}
