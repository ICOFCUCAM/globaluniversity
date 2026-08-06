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
      'Building practitioners who can design, install, maintain and secure the systems that modern work depends on.',
    blurb:
      'The Faculty of Engineering and Technology teaches by doing. Its diploma programmes are short, practical and directed at employment, covering software, networks, databases, hardware and the technical trades that keep an economy running.',
  },
  {
    id: 'business',
    name: 'Faculty of Business Management Science and Administration',
    mission:
      'Training ethical administrators, accountants and managers for enterprise, government and the not-for-profit sector.',
    blurb:
      'The Faculty of Business Management Science and Administration prepares students for the offices where organisations are actually run — finance, administration, project delivery and management — with an emphasis on integrity as well as competence.',
  },
];

export const facultyById = (id: string) => FACULTIES.find((f) => f.id === id);

/** The default duration for a diploma, in the university's own words. */
export const DIPLOMA_DURATION = 'One to two academic years';

const theology = (
  slug: string, title: string, summary: string, description: string[],
  careers: string[], pathway: string, icon: string,
): Programme => ({
  slug, title, facultyId: 'theology', award: 'Diploma',
  // 120 ECTS is the figure on the university's own programme page.
  credits: 120, creditsPublished: true,
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

export const programmeBySlug = (slug: string) =>
  DIPLOMA_PROGRAMMES.find((p) => p.slug === slug);

export const programmesByFaculty = (facultyId: string) =>
  DIPLOMA_PROGRAMMES.filter((p) => p.facultyId === facultyId);
