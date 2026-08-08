import { programs as SITE_PROGRAMS } from './site';

// ---------------------------------------------------------------------------
// The programme catalogue.
//
// WHY THIS EXISTS. The award lists on the site were arrays of bare strings —
// `['Computer Networking', 'Software Engineering', …]` — rendered as bullets in
// a beige box. An applicant reading that cannot compare two programmes, cannot
// see what an award is worth, cannot tell how long it takes, and has nowhere to
// go except a form. It reads as a brochure, and a brochure is what a school
// produces; a university produces a CATALOGUE.
//
// A catalogue entry is a record, not a line of text: what the programme is, how
// long it runs, what it is worth, how it is taught, what it leads to, and where
// it continues. That is also what makes an individual page per programme
// possible — which is how every established university is structured and the
// single largest thing that can be done for search visibility, because a page
// that exists can be found and a bullet inside a list cannot.
//
// WHAT IS DELIBERATELY ABSENT, AND WHY THAT MATTERS MORE THAN WHAT IS HERE.
//
//   CREDITS ARE OMITTED WHERE THE UNIVERSITY HAS NOT PUBLISHED THEM. The
//   Diploma in Theology is stated at 120 ECTS on the university's own programme
//   page and is recorded here as such. For the technology and business
//   diplomas no credit figure has ever been published anywhere this system can
//   read, so `credits` is left undefined and the page omits the line rather
//   than printing a number.
//
//   A credit value is a REGULATORY CLAIM. It determines whether another
//   institution grants advanced standing, whether a ministry of education
//   recognises the award, and how much study a student believes they are
//   buying. Inventing one to fill a card on a marketing page would put a figure
//   into the world that the Senate never approved, and it would be quoted back
//   to the university by an applicant who relied on it.
//
//   The same applies to DURATION. "One to two academic years" is the
//   university's own wording for diploma study and is used as the default; a
//   programme is given a specific duration only where one is known.
//
// Careers and pathways are written as what a programme PREPARES a graduate for,
// never as a promise of employment.
// ---------------------------------------------------------------------------

export type AwardLevel =
  | 'Certificate'
  | 'Diploma'
  | "Bachelor's"
  | 'Postgraduate Diploma'
  | "Master's"
  | 'Doctorate';

export interface FacultyProfile {
  id: string;
  name: string;
  /** One sentence on what the faculty is for. Printed under its name. */
  mission: string;
  /** Longer introduction, for the faculty's own section. */
  blurb: string;
}

export interface Programme {
  slug: string;
  title: string;
  facultyId: string;
  award: AwardLevel;
  /** Printed on the card. Defaults to the level's wording when absent. */
  duration?: string;
  /**
   * ECTS credits. UNDEFINED WHERE UNPUBLISHED — see the header. The card omits
   * the line rather than inventing a figure.
   */
  credits?: number;
  /** Where the university has stated the figure. False means seeded, not Senate-approved. */
  creditsPublished?: boolean;
  modes: string[];
  /** One sentence, for the card. */
  summary: string;
  /** The programme's own page. */
  description: string[];
  /** Roles the programme prepares a graduate for — never a promise of work. */
  careers: string[];
  /** The award this one articulates into, if any. */
  pathway?: string;
  /** A single character shown on the card. Readability, not decoration. */
  icon: string;
}

// EACH MISSION SAYS HOW FAR ITS GRADUATES GO.
//
// These read as statements about a department. This is A Global University —
// two campuses, a centre in Nigeria, every programme delivered worldwide — and
// a faculty whose stated purpose stops at the campus gate quietly contradicts
// the identity every other part of the site is building.
//
// A mission is a statement of intent, not a count, so saying that graduates
// serve regionally and internationally claims nothing the registry has to
// evidence. The numbers stay in institutionalFacts.ts, where they are counted.
export const FACULTIES: FacultyProfile[] = [
  {
    id: 'theology',
    name: 'Faculty of Theology',
    mission:
      'Preparing Christian leaders, ministers, missionaries and theologians for service throughout Africa and the world.',
    blurb:
      'The Faculty of Theology grounds students in scripture, church history, doctrine and pastoral practice, and sends them out to serve congregations, missions and communities. Its awards run from the certificate to the doctorate, and each level articulates into the next.',
  },
  {
    id: 'engineering',
    name: 'Faculty of Engineering and Technology',
    mission:
      'Building practitioners who can design, install, maintain and secure the systems modern work depends on — in African economies and in the international market their skills travel to.',
    blurb:
      'The Faculty of Engineering and Technology teaches by doing. Its diploma programmes are short, practical and directed at employment, covering software, networks, databases, hardware and the technical trades that keep an economy running.',
  },
  {
    id: 'business',
    name: 'Faculty of Business Management Science and Administration',
    mission:
      'Training ethical administrators, accountants and managers for enterprise, government and the not-for-profit sector, in Africa and wherever our graduates are called to serve.',
    blurb:
      'The Faculty of Business Management Science and Administration prepares students for the offices where organisations are actually run — finance, administration, project delivery and management — with an emphasis on integrity as well as competence.',
  },
];

FACULTIES.push(
  {
    // ===================================================================
    // THE SCHOOL OF MINISTRY — added on the university's instruction.
    //
    // A new school needs programmes, and inventing programmes is the one
    // thing this repository will not do. So nothing was created: six awards
    // that already existed MOVED here from the Faculty of Theology, chosen on
    // a single distinction the catalogue already draws in its own summaries —
    // whether an award trains somebody to DO the work of ministry or to STUDY
    // the discipline of theology.
    //
    //   Diploma in Ministry — "directed at the work itself: preaching,
    //     pastoral care, discipleship, worship and the ordinary
    //     administration of a congregation"
    //   Diploma in Christian Leadership — governance, stewardship, planning,
    //     conflict, the ethics of authority
    //   Bachelor of Ministry (B.Min.)
    //   Masters in Evangelism and Mission
    //   Master of Arts in Christian Leadership
    //   Doctor of Ministry (D.Min.) — the practitioner doctorate
    //
    // What deliberately did NOT move: Theology, Divinity, Christian
    // Education, Black Liberation Theology, the Ph.D., the D.Th. and the
    // D.S.Th. Those are academic awards in the discipline and the Faculty of
    // Theology keeps them, which is also why its count falls from 18 to 12
    // rather than collapsing.
    //
    // THE ALLOCATION IS A JUDGEMENT AND IT IS FLAGGED. The university asked
    // for the school; it did not say which awards belong to it. This split is
    // defensible from the published summaries and it is reversible in one
    // file — the `school` field in site.ts is the only thing that decides it.
    // If the university wants a different division, that is where it changes.
    // ===================================================================
    id: 'ministry',
    name: 'School of Ministry',
    mission:
      'Forming pastors, evangelists and church leaders for the work itself — the congregation, the mission field and the organisation that carries them.',
    blurb:
      'The School of Ministry trains for practice rather than for the library. Its awards run from the diploma to the practitioner doctorate and cover preaching, pastoral care, discipleship, evangelism, mission and the governance of a growing ministry.',
  },
  {
    id: 'education',
    name: 'Faculty of Education',
    mission:
      'Forming teachers who can hold a classroom and reach the child in it — for schools across Africa and for the diaspora communities that share them.',
    blurb:
      'The Faculty of Education prepares classroom practitioners for primary and special education, with the pedagogy, the subject grounding and the practical placement the work requires.',
  },
);

export const facultyById = (id: string) => FACULTIES.find((f) => f.id === id);

/** The default duration for a diploma, in the university's own words. */
export const DIPLOMA_DURATION = 'One to two academic years';

const theology = (
  slug: string, title: string, summary: string, description: string[],
  careers: string[], pathway: string, icon: string,
  // THE FACULTY IS AN ARGUMENT NOW, defaulting to theology.
  //
  // The diploma programmes are built here rather than derived from site.ts, so
  // their faculty was hardcoded — which meant reassigning the Diploma in
  // Ministry and the Diploma in Christian Leadership to the new School of
  // Ministry in site.ts moved four awards and silently left two behind. The
  // homepage reported "4 programmes" for a school that has six, and nothing
  // failed: both numbers were counted correctly from a catalogue that was
  // wrong. Two sources of truth for one fact, and only one of them was edited.
  facultyId: string = 'theology',
): Programme => ({
  slug, title, facultyId, award: 'Diploma',
  // 180, on the university's instruction, correcting the 120 seeded in
  // migration 006. See DIPLOMA_CREDITS below for the note this carries.
  credits: 180, creditsPublished: true,
  duration: DIPLOMA_DURATION,
  modes: ['Online', 'On campus', 'Blended'],
  summary, description, careers, pathway, icon,
});

const tech = (
  slug: string, title: string, summary: string, description: string[],
  careers: string[], pathway: string, icon: string,
): Programme => ({
  slug, title, facultyId: 'engineering', award: 'Diploma',
  // No credit figure published for the technology diplomas. See the header.
  duration: DIPLOMA_DURATION,
  modes: ['On campus', 'Blended'],
  summary, description, careers, pathway, icon,
});

const business = (
  slug: string, title: string, summary: string, description: string[],
  careers: string[], pathway: string, icon: string,
): Programme => ({
  slug, title, facultyId: 'business', award: 'Diploma',
  duration: DIPLOMA_DURATION,
  modes: ['Online', 'On campus', 'Blended'],
  summary, description, careers, pathway, icon,
});

export const DIPLOMA_PROGRAMMES: Programme[] = [
  /* --- Theology ------------------------------------------------------- */
  theology(
    'diploma-in-theology', 'Diploma in Theology',
    'Scripture, doctrine, church history and pastoral practice, for ministry or for further theological study.',
    [
      'The Diploma in Theology is a foundational programme for those who wish to deepen their understanding of Christian thought and practice, whether for personal enrichment, for ministry, or as the groundwork for a degree.',
      'Students are grounded in biblical interpretation, key theological concepts, the history of the church, and the practical skills ministry requires. The programme places particular weight on application: theological insight is tested against real congregational and community contexts rather than left on the page.',
      'It is taught flexibly so that full-time students, working professionals and those with family responsibilities can all take it at a workable pace.',
    ],
    ['Pastoral assistant', 'Church worker', 'Lay preacher', 'Christian education worker'],
    'Bachelor of Theology', '✝',
  ),
  theology(
    'diploma-in-ministry', 'Diploma in Ministry',
    'Practical preparation for pastoral, evangelistic and congregational service.',
    [
      'The Diploma in Ministry is directed at the work itself — preaching, pastoral care, discipleship, worship and the ordinary administration of a congregation.',
      'It suits those already serving in a church who want their practice grounded in study, and those preparing to enter ministry who need both the theology and the craft.',
    ],
    ['Minister in training', 'Pastoral care worker', 'Youth and discipleship leader', 'Missions worker'],
    'Bachelor of Ministry', '🕊',
    'ministry',
  ),
  theology(
    'diploma-in-christian-leadership', 'Diploma in Christian Leadership',
    'Leading congregations, ministries and faith-based organisations with competence and integrity.',
    [
      'The Diploma in Christian Leadership addresses what happens when a ministry grows beyond one person: governance, stewardship of money and people, planning, conflict, and the ethics of authority.',
      'It is built for those who already carry responsibility in a church or a faith-based organisation and need the discipline that responsibility demands.',
    ],
    ['Ministry leader', 'Church administrator', 'Faith-based NGO coordinator', 'Departmental head'],
    'Bachelor of Christian Leadership', '⛪',
    'ministry',
  ),

  /* --- Engineering and Technology ------------------------------------- */
  tech(
    'diploma-in-computer-networking', 'Diploma in Computer Networking',
    'Design, install, configure and secure the networks organisations run on.',
    [
      'This programme covers network fundamentals, addressing and routing, switching, wireless, and the security practice that has to accompany all of it.',
      'Teaching is hands-on: students configure equipment, diagnose faults and document what they have built, because that is what the work consists of.',
    ],
    ['Network technician', 'Network administrator', 'IT support specialist', 'Systems technician'],
    'BSc Computer Networking', '🌐',
  ),
  tech(
    'diploma-in-software-engineering', 'Diploma in Software Engineering',
    'Design, develop and deploy software systems using contemporary languages and methods.',
    [
      'Students learn to program, to structure a system, to work with version control and databases, and to test what they write — the practices that distinguish engineering from coding.',
      'The programme is project-based throughout: every module produces something that runs, and the final work is a system built and defended.',
    ],
    ['Junior software developer', 'Application programmer', 'Quality assurance engineer', 'Support engineer'],
    'BSc Software Engineering', '💻',
  ),
  tech(
    'diploma-in-web-development', 'Diploma in Web Development',
    'Build and maintain the sites and web applications organisations depend on.',
    [
      'Front-end and back-end development, content management, hosting and the security a public-facing system requires.',
      'Students finish with a portfolio of work that can be shown to an employer, which for this field matters more than any transcript.',
    ],
    ['Web developer', 'Webmaster', 'Front-end developer', 'Digital content administrator'],
    'BSc Software Engineering', '🕸',
  ),
  tech(
    'diploma-in-hardware-maintenance', 'Diploma in Hardware Maintenance',
    'Diagnose, repair and maintain computer hardware and peripheral systems.',
    [
      'Component-level diagnosis, repair, upgrade and preventive maintenance of desktop and portable systems, with the electrical safety practice the work requires.',
      'Directed squarely at employment and at self-employment: the skills taught here support a workshop as readily as a salaried post.',
    ],
    ['Hardware technician', 'IT maintenance officer', 'Workshop technician', 'Self-employed repair technician'],
    'BSc Engineering Technology', '🛠',
  ),
  tech(
    'diploma-in-laptop-chipset-technology', 'Diploma in Laptop and Chipset Technology',
    'Board-level diagnosis and repair of portable computing hardware.',
    [
      'A specialist programme in the diagnosis and repair of laptop mainboards — power sequencing, chipset faults, reballing and micro-soldering practice.',
      'It is the deepest hardware programme the faculty offers and assumes a working knowledge of general maintenance.',
    ],
    ['Board-level repair technician', 'Laptop repair specialist', 'Electronics technician'],
    'BSc Engineering Technology', '🔧',
  ),
  tech(
    'diploma-in-database-administration', 'Diploma in Database Administration',
    'Install, secure, tune and recover the databases an organisation cannot lose.',
    [
      'Relational design, SQL, backup and recovery, user administration and performance work, taught on Oracle and transferable to comparable systems.',
      'Recovery is treated as the central skill rather than an appendix: an administrator who cannot restore is not an administrator.',
    ],
    ['Junior database administrator', 'Data operations officer', 'Applications support analyst'],
    'BSc Information Systems', '🗄',
  ),
  tech(
    'diploma-in-air-conditioning-refrigeration', 'Diploma in Air Conditioning and Refrigeration',
    'Install, service and repair refrigeration and climate systems.',
    [
      'Refrigeration cycles, system components, installation practice, fault diagnosis, servicing and the safe handling of refrigerants.',
      'A trade programme in the proper sense — assessed substantially on practical competence.',
    ],
    ['Refrigeration technician', 'HVAC installer', 'Maintenance technician', 'Self-employed contractor'],
    'BSc Engineering Technology', '❄',
  ),
  tech(
    'diploma-in-computerized-accounting', 'Diploma in Computerised Accounting',
    'Keep and report accounts on the systems businesses actually use.',
    [
      'Bookkeeping and accounting practice taught through accounting software: ledgers, payroll, inventory, reporting and the controls that keep the records trustworthy.',
      'It sits between the technology and business faculties and suits those who want the accounting without the full business degree.',
    ],
    ['Accounts clerk', 'Bookkeeper', 'Payroll officer', 'Accounts assistant'],
    'BSc Accountancy', '📊',
  ),
  tech(
    'diploma-in-secretarial-duties', 'Diploma in Secretarial Duties',
    'The administrative practice that keeps an office running.',
    [
      'Office administration, correspondence, records management, scheduling and the software an administrative post requires.',
    ],
    ['Office administrator', 'Administrative assistant', 'Records officer'],
    'Diploma in Executive Secretarial Duties', '🗂',
  ),

  /* --- Business -------------------------------------------------------- */
  business(
    'diploma-in-business-management', 'Diploma in Business Management',
    'Plan, organise and run an enterprise or a department within one.',
    [
      'Management principles, operations, marketing, human resources and the financial literacy any manager needs, taught through cases rather than in the abstract.',
      'Suits those running a business already and those preparing to take responsibility for one.',
    ],
    ['Business administrator', 'Operations supervisor', 'Departmental manager', 'Entrepreneur'],
    'BSc Business Management', '📈',
  ),
  business(
    'diploma-in-project-management', 'Diploma in Project Management',
    'Deliver projects to time, to budget and to specification.',
    [
      'Scope, scheduling, budgeting, risk, procurement and stakeholder management across the life of a project, with the documentation discipline that makes delivery auditable.',
      'Directly useful in construction, development work, IT and the not-for-profit sector.',
    ],
    ['Project officer', 'Project coordinator', 'Programme assistant', 'Site administrator'],
    'BSc Project Management', '📋',
  ),
  business(
    'diploma-in-accountancy', 'Diploma in Accountancy',
    'Prepare, interpret and report financial information to a professional standard.',
    [
      'Financial accounting, cost accounting, taxation principles, and the preparation and interpretation of financial statements.',
      'Built as a foundation for professional accountancy study as well as for employment.',
    ],
    ['Accounts officer', 'Assistant accountant', 'Audit assistant', 'Finance clerk'],
    'BSc Accountancy', '🧮',
  ),
  business(
    'diploma-in-banking-and-finance', 'Diploma in Banking and Finance',
    'The practice of banking, credit and financial services.',
    [
      'Banking operations, credit and lending, financial products, regulation and the customer practice a financial institution depends on.',
    ],
    ['Bank officer', 'Credit assistant', 'Customer relations officer', 'Microfinance officer'],
    'BSc Banking and Finance', '🏦',
  ),
  business(
    'diploma-in-non-profit-management', 'Diploma in Non-Profit Management',
    'Run a charity, a mission or an NGO accountably.',
    [
      'Governance, fundraising, grant management, programme delivery, monitoring and evaluation, and the reporting donors and regulators require.',
      'Written for the sector as it actually operates in this region, where accountability to donors and to beneficiaries is the whole of the job.',
    ],
    ['NGO programme officer', 'Grants administrator', 'Charity administrator', 'Monitoring and evaluation assistant'],
    'BSc Non-Profit Management', '🤝',
  ),
  business(
    'diploma-in-insurance', 'Diploma in Insurance',
    'Underwriting, claims and the practice of insurance business.',
    [
      'Principles of insurance, policy construction, underwriting, claims handling and the regulation of insurance business.',
    ],
    ['Insurance officer', 'Claims assistant', 'Underwriting assistant', 'Insurance agent'],
    'BSc Banking and Finance', '🛡',
  ),
  business(
    'diploma-in-executive-secretarial-duties', 'Diploma in Executive Secretarial Duties',
    'Senior administrative support at executive level.',
    [
      'Advanced office administration, executive correspondence, minute-taking, diary and travel management, and the discretion an executive office requires.',
    ],
    ['Executive assistant', 'Personal assistant', 'Office manager', 'Board secretary'],
    'BSc Business Management', '📇',
  ),
  business(
    'diploma-in-bilingual-secretarial-duties', 'Diploma in Bilingual Secretarial Duties',
    'Executive administration in both English and French.',
    [
      'Administrative practice conducted in both of Cameroon’s official languages: correspondence, translation of routine documents, and bilingual reception and minute-taking.',
      'A directly employable qualification in a bilingual economy and in the international organisations that operate in one.',
    ],
    ['Bilingual secretary', 'Bilingual administrative officer', 'Reception and protocol officer'],
    'BSc Business Management', '🗣',
  ),
];

/**
 * The ladder of awards.
 *
 * Printed on the catalogue so an applicant looking at a diploma can see where
 * it goes. A student choosing a one-year award wants to know whether it is a
 * dead end, and for this university it is not.
 */
export const PROGRESSION: { award: AwardLevel; note: string }[] = [
  { award: 'Certificate', note: 'Short, focused, professional' },
  { award: 'Diploma', note: 'One to two years — employment or advanced standing' },
  { award: "Bachelor's", note: 'The full undergraduate degree' },
  { award: 'Postgraduate Diploma', note: 'Graduate study, one year' },
  { award: "Master's", note: 'Taught or research' },
  { award: 'Doctorate', note: 'Supervised research and a defended thesis' },
];

export const DIPLOMA_CAREER_SECTORS = [
  'Industry', 'Government', 'Education', 'Churches and missions',
  'Non-governmental organisations', 'Business', 'Information technology', 'Self-employment',
];

/**
 * The prose around the cards, per award level.
 *
 * WHY IT IS DATA AND NOT PARAGRAPHS IN THE COMPONENT. The catalogue was written
 * for the diploma page and its fixed copy said so — "a diploma is not a dead
 * end at this university", "many continue into bachelor's degree study with
 * advanced standing". Rendering that same text on the doctoral page would have
 * told a prospective PhD candidate that their research degree articulates into
 * a bachelor's. One component serving five levels has to be told which level it
 * is serving.
 */
export interface LevelCopy {
  lead: string;
  body: string;
  /** The heading and paragraph above the progression ladder. */
  progression: string;
  /** The paragraph under "After graduation". */
  careers: string;
}

export const LEVEL_COPY: Record<AwardLevel, LevelCopy> = {
  Certificate: {
    lead: 'Certificate qualifications',
    body: 'ICOF Global University certificate programmes are short, focused awards for people entering a field, changing direction, or formalising experience they already have — completed in under a year and carrying credit towards a diploma.',
    progression: 'A certificate is a starting point rather than an endpoint. Credit earned may be carried into a diploma programme, and from there into a degree, subject to faculty regulations.',
    careers: 'Certificate holders work in support and assistant roles across these sectors, and many continue into diploma study with credit already earned.',
  },
  Diploma: {
    lead: 'Professional diploma qualifications',
    body: 'ICOF Global University diploma programmes provide practical, career-oriented education designed to equip students with foundational academic knowledge, professional competence and industry-ready skills.',
    progression: 'A diploma is not a dead end at this university. Each award articulates into the next, and a completed diploma may carry advanced standing into a bachelor’s programme subject to faculty regulations.',
    careers: 'Graduates of ICOF Global University diploma programmes go on to work across a range of sectors, and many continue into bachelor’s degree study with advanced standing.',
  },
  "Bachelor's": {
    lead: 'Undergraduate degree programmes',
    body: 'A bachelor’s degree is the university’s full undergraduate award: three to four years of study taken to depth, ending in a substantial piece of independent work and qualifying its holder for graduate study.',
    progression: 'A bachelor’s degree is the gateway to graduate study. Holders may proceed to a postgraduate diploma or directly to a master’s programme, subject to faculty regulations.',
    careers: 'Graduates hold professional and leadership positions across these sectors, and many continue into master’s study.',
  },
  'Postgraduate Diploma': {
    lead: 'Postgraduate diploma programmes',
    body: 'A postgraduate diploma is one year of graduate study for those who hold a first degree and need specialist qualification without committing to a full master’s.',
    progression: 'A postgraduate diploma may be carried into a master’s programme as advanced standing, subject to faculty regulations.',
    careers: 'Holders work in specialist and supervisory roles across these sectors.',
  },
  "Master's": {
    lead: 'Graduate degree programmes',
    body: 'ICOF Global University master’s programmes are graduate awards of 120 credits, taken by coursework or by research, for those who already hold a first degree and are qualifying for senior practice, teaching or doctoral study.',
    progression: 'A master’s degree is the normal qualification for entry to doctoral research. Holders may proceed to a doctoral programme subject to faculty approval of a research proposal and the availability of supervision.',
    careers: 'Graduates hold senior and specialist positions across these sectors, and those intending an academic career normally continue to doctoral research.',
  },
  Doctorate: {
    lead: 'Doctoral research programmes',
    body: 'A doctorate at ICOF Global University is a supervised research degree: three or more years of original work, examined on a thesis defended before a panel. It is the university’s highest award.',
    progression: 'A doctorate is the terminal award. What follows is not a further degree but academic appointment, supervision of others, and publication.',
    careers: 'Doctoral graduates teach, supervise research, lead institutions and publish in their fields.',
  },
};

/* ------------------------------------------------------------------ */
/* The other levels, derived from the programme records                 */
/* ------------------------------------------------------------------ */

/**
 * The award levels the university teaches, built from `programs` in site.ts.
 *
 * WHY DERIVED RATHER THAN RETYPED. Those thirty records already carry the
 * title, the level, the faculty, a written summary and the learning outcomes
 * for every award the university offers — everything a catalogue card needs
 * except the credit figure. Typing them again here would have produced a second
 * list to keep in step with the first, and the first time they drifted the site
 * would describe the same degree two ways on two pages.
 *
 * CREDITS COME FROM THE AWARDS TABLE, on the university's instruction. Migration
 * 006 seeds the two figures the university has published — Bachelor of Theology
 * 180 ECTS, Diploma of Theology 120 — and those are used. The curriculum in
 * curricula.ts totals 87 credits over four semesters for the same degree; it is
 * a partial curriculum in different units, and the published figure is the one
 * that governs.
 *
 * Every other award has no published figure, so no figure is printed. See the
 * header of this file for why that matters more than filling the card.
 */
const PUBLISHED_CREDITS: Record<string, number> = {
  'bachelor-of-theology': 180,
  'bachelor-of-ministry': 180,
  'diploma-in-theology': 180,
};

/**
 * A figure the university has set for a whole award level rather than for one
 * programme. Used only where the programme itself has no published figure, so a
 * per-programme number always wins.
 *
 * WHY THE MASTER'S IS HERE AND NOT LISTED SIX TIMES. The university stated 120
 * credits for the master's, not for one master's programme. Writing it once
 * against the level means a seventh master's added next year carries the right
 * figure the day it is added, instead of silently printing no credits until
 * somebody notices the list is short.
 */
const LEVEL_CREDITS: Partial<Record<AwardLevel, number>> = {
  "Master's": 120,
};

/**
 * TWO NOTES THE UNIVERSITY SHOULD SEE RATHER THAN NUMBERS I QUIETLY ADJUSTED.
 *
 * THE DIPLOMA AT 180. Recorded on the university's instruction. Two things
 * follow, and neither is a reason to change it back — they are reasons to look:
 *
 *   Migration 006 seeded the Diploma of Theology at 120 in the `awards` table,
 *   and that table is what the graduation check reads. The migration file is
 *   updated for fresh installs; a database that has already run it needs
 *   `update awards set credits_required = 180 where code = 'DTH';` or the site
 *   will advertise 180 while the system requires 120 to graduate.
 *
 *   180 credits puts the diploma level with the bachelor's, and sits oddly
 *   beside a stated duration of one to two academic years — 180 ECTS is
 *   normally three years of full-time study. If the diploma really runs to 180
 *   the duration wording is what wants revisiting; if the duration is right,
 *   the figure is. The site prints what it was told either way.
 *
 * THE MASTER'S AT 120. Applies to all six master's programmes, including the
 * Master of Project Management, which sits under GIBMAS rather than Theology
 * but is recorded at master's level and so takes the master's figure. If
 * business master's are meant to differ, give that programme its own entry in
 * PUBLISHED_CREDITS above.
 *
 * No master's award has a row in the `awards` table yet, so nothing in the
 * graduation check contradicts this. When one is created it needs
 * `credits_required = 120` or the two will disagree.
 */

const LEVEL_DURATION: Record<string, string> = {
  Certificate: 'Up to one academic year',
  Diploma: DIPLOMA_DURATION,
  Bachelor: 'Three to four academic years',
  Master: 'One to two academic years',
  Doctorate: 'Three or more academic years of supervised research',
};

const FACULTY_ID: Record<string, string> = {
  'Faculty of Theology': 'theology',
  // Added on the university's instruction to open a School of Ministry. See
  // the FACULTIES entry below for what moved into it and what did not.
  'School of Ministry': 'ministry',
  'Faculty of Education': 'education',
  'Faculty of Engineering and Technology': 'engineering',
  'Global Institute of Business and Management Science (GIBMAS)': 'business',
};

const LEVEL_AWARD: Record<string, AwardLevel> = {
  Certificate: 'Certificate',
  Diploma: 'Diploma',
  Bachelor: "Bachelor's",
  Master: "Master's",
  Doctorate: 'Doctorate',
};

const LEVEL_ICON: Record<string, string> = {
  Certificate: '📜', Diploma: '🎓', Bachelor: '🎓', Master: '📘', Doctorate: '⚗',
};

/** Every award the university offers, as catalogue entries. */
export const ALL_PROGRAMMES: Programme[] = (() => {
  const derived: Programme[] = SITE_PROGRAMS
    // The diplomas written by hand above are richer — they carry a pathway, a
    // longer description and their own icon. Where both exist the hand-written
    // entry wins, and the derived one is dropped rather than producing two
    // records with one slug.
    .filter((sp) => !DIPLOMA_PROGRAMMES.some((d) => d.slug === sp.slug))
    .map((sp) => {
      const award = LEVEL_AWARD[sp.level] ?? 'Certificate';
      // Programme first, then the level, then nothing at all. Never a guess.
      const credits = PUBLISHED_CREDITS[sp.slug] ?? LEVEL_CREDITS[award];
      return {
      slug: sp.slug,
      title: sp.title,
      facultyId: FACULTY_ID[sp.school] ?? 'theology',
      award,
      duration: LEVEL_DURATION[sp.level],
      credits,
      creditsPublished: credits !== undefined,
      modes: ['Online', 'On campus', 'Blended'],
      // The record's summary is a paragraph. The card wants a sentence.
      summary: sp.summary.split('. ')[0].replace(/\.$/, '') + '.',
      description: [sp.summary],
      // The outcomes are what the programme covers, which is not the same thing
      // as what it prepares you for — so they are labelled as study areas on the
      // page rather than silently relabelled as careers.
      careers: sp.outcomes,
      icon: LEVEL_ICON[sp.level] ?? '🎓',
      };
    });
  return [...DIPLOMA_PROGRAMMES, ...derived];
})();

export const programmesByAward = (award: AwardLevel) =>
  ALL_PROGRAMMES.filter((p) => p.award === award);

export const programmeBySlug = (slug: string) =>
  ALL_PROGRAMMES.find((p) => p.slug === slug);

export const programmesByFaculty = (facultyId: string, award?: AwardLevel) =>
  ALL_PROGRAMMES.filter((p) => p.facultyId === facultyId && (!award || p.award === award));

// ---------------------------------------------------------------------------
// ONE PROGRAMME, ONE URL.
//
// Two routes can render a single programme. /programs/<slug> is the older page
// and the richer one — it carries the curriculum table, the hero photograph and
// the related-programmes rail — and it is the one search engines have already
// indexed. /programmes/<slug> is the catalogue's own page, written for the
// hand-authored diplomas that have no record in site.ts and therefore no
// /programs page at all.
//
// For three programmes — the theology, ministry and Christian leadership
// diplomas — both existed, which is a defect and not a convenience: two URLs
// serving the same degree split the ranking between them, and an applicant who
// finds one has no way of knowing the other says more. The older, richer page
// wins; the catalogue links to it, and /programmes/<slug> redirects there
// rather than 404ing, because the duplicate was live and may be linked.
// ---------------------------------------------------------------------------

const SITE_SLUGS = new Set(SITE_PROGRAMS.map((p) => p.slug));

/** True when /programs/<slug> renders this programme, so /programmes must not. */
export const hasProgramPage = (slug: string) => SITE_SLUGS.has(slug);

/** The one canonical URL for a programme. Use this everywhere it is linked. */
export const programmeHref = (slug: string) =>
  SITE_SLUGS.has(slug) ? `/programs/${slug}` : `/programmes/${slug}`;
