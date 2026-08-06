// ---------------------------------------------------------------------------
// The figures the university may put in front of a stranger.
//
// WHY THIS FILE IS DERIVED AND NOT TYPED.
//
// The homepage carried four statistics inherited from the WordPress theme:
//
//     7,228   Success Stories
//     1,742   Happy Students
//       213   Courses
//        15   Years Experience
//
// None can be substantiated from anything in this system, and two are checkable
// and wrong. "213 Courses" against a catalogue of forty-one programmes. "15
// Years Experience" against a founding year of 2007 — true in 2022, printed
// ever since, and quietly ageing on the front page of an institution whose
// entire product is accuracy about dates and records.
//
// That is worse than having no statistics. A prospective student cannot check
// "7,228 success stories", but an accreditor can check the arithmetic on the
// other two, and once one number on a homepage is shown to be decorative every
// other number on it becomes decorative too — including the ones on the
// certificate.
//
// So: every figure below is COMPUTED from the catalogue, the constants or the
// founding year. Nothing here can be typed in, none of it can drift out of step
// with the prospectus, and the year count is right every January without anyone
// remembering to change it.
//
// WHAT IS DELIBERATELY ABSENT. Alumni totals, graduate satisfaction, employment
// rates, countries represented, student numbers. Those are the figures that
// would most impress a visitor, and this system holds none of them. A university
// may publish them when its registry can produce them — from the student
// register, the graduation list and the credential register, all of which exist
// and are all currently empty. Until then their absence is the honest state,
// and `PENDING_MEASURES` at the foot of this file records what to publish and
// where each figure will come from.
// ---------------------------------------------------------------------------

import { UNIVERSITY } from '@/lib/constants';
import { ALL_PROGRAMMES } from '@/content/programmeCatalogue';
import { faculties, leadership, faculty, administration } from '@/content/site';

/**
 * Named academic and administrative staff, counted from the rosters this site
 * already publishes with photographs, roles and biographies.
 *
 * This is the answer to "how many academic staff" that the university can
 * actually defend: every one of these people is on the site with a name and a
 * face. A larger figure taken from a payroll nobody can see would impress more
 * and evidence less.
 */
export const namedStaff = [...leadership, ...faculty, ...administration]
  .filter((m, i, all) => all.findIndex((x) => x.name === m.name) === i);

/** Whole years since the university was founded. */
export function yearsEstablished(now: Date = new Date()): number {
  return now.getFullYear() - UNIVERSITY.established;
}

export interface Fact {
  /** The figure, already formatted. */
  value: string;
  label: string;
  /** One line saying where the number comes from, so it can be checked. */
  source: string;
}

/**
 * The proof band beneath the hero.
 *
 * FOUR, not eight. A row of statistics is read as a single gesture — a visitor
 * takes an impression from it, not a dataset — and past about four the
 * impression stops being "substantial" and starts being "padded". The four here
 * are the ones a prospective student actually weighs: is it real, is it
 * recognised, is there something for me, and how far can I go.
 */
export function institutionalFacts(): Fact[] {
  return [
    {
      value: String(UNIVERSITY.established),
      label: 'Established',
      source: 'The university’s founding year.',
    },
    {
      value: `${ALL_PROGRAMMES.length}`,
      label: 'Programmes of study',
      source: 'Counted from the published catalogue, not stated separately.',
    },
    {
      value: String(faculties.items.length),
      label: 'Schools and faculties',
      source: 'The faculties listed on the Faculties page.',
    },
    {
      value: String(namedStaff.length),
      label: 'Academic and administrative staff',
      source: 'Counted from the rosters published on this site, each with a name and a face.',
    },
  ];
}

/**
 * The line under the hero buttons.
 *
 * Shorter than the band and doing a different job: the band is evidence of
 * scale, this is evidence of standing. Every clause is checkable — the
 * accreditation against MINESUP's own register, the location against the
 * university's address, the modes against any programme page.
 */
export const HERO_ASSURANCES: string[] = [
  `Accredited by the Ministry of Higher Education since ${UNIVERSITY.established}`,
  'Campuses in Buea and Douala · Centre in Nigeria',
  'Every programme online, worldwide',
];

/**
 * The five rungs, in order, with what each is for.
 *
 * The durations are the catalogue's, so the ladder on the homepage and the
 * duration on a programme card cannot disagree.
 */
export const PATHWAY = [
  {
    award: 'Certificate',
    duration: 'Up to one year',
    note: 'A focused entry point, or formal recognition of experience you already have.',
    href: '/degrees/certificates',
  },
  {
    award: 'Diploma',
    duration: 'One to two years',
    note: 'Career-ready professional qualification, and advanced standing towards a degree.',
    href: '/degrees/diploma-dip',
  },
  {
    award: 'Bachelor’s',
    duration: 'Three to four years',
    note: 'The full undergraduate degree, and the gateway to graduate study.',
    href: '/degrees/bachelors-degrees',
  },
  {
    award: 'Master’s',
    duration: 'One to two years',
    note: 'Graduate specialisation by coursework or research, at 120 credits.',
    href: '/degrees/masters-degrees',
  },
  {
    award: 'Doctorate',
    duration: 'Three years or more',
    note: 'Supervised original research, examined on a thesis defended before a panel.',
    href: '/degrees/doctoral',
  },
] as const;

/**
 * WHAT THE UNIVERSITY SHOULD PUBLISH NEXT, AND WHERE EACH FIGURE COMES FROM.
 *
 * This is not a wish list. Each of these is the single most persuasive thing a
 * homepage can carry — a number the institution can defend — and each is
 * already derivable from a table in this system the moment that table has rows
 * in it. Listed here so that publishing them is a query rather than a decision
 * about what sounds impressive.
 *
 * NOT ONE OF THESE MAY BE ESTIMATED IN THE MEANTIME. A homepage that says
 * "20,000+ alumni" before the register can produce the list is making a claim
 * an accreditor will ask to see evidenced.
 */
export const CAMPUSES = [
  {
    city: 'Buea',
    country: 'Cameroon',
    address: 'Opposite Bulu Blind Junction, Buea, South West Region',
    role: 'Principal campus and the Faculty of Theology',
    map: 'https://www.google.com/maps/search/?api=1&query=Bulu+Blind+Junction+Buea+Cameroon',
    image: '/images/graduation-2024/grad-2024-procession-hall.jpg',
  },
  {
    city: 'Douala',
    country: 'Cameroon',
    address: 'Littoral Region',
    role: 'School of Theology, Douala',
    map: 'https://www.google.com/maps/search/?api=1&query=Douala+Cameroon',
    image: '/images/graduation-2024/grad-2024-congregation-full.jpg',
  },
  {
    // A CENTRE, NOT A CAMPUS, and the distinction is the point of listing it.
    // An earlier version of the campus section left Nigeria out on the grounds
    // that a partner is not a campus — while the globe two sections below
    // plotted it. One of the two was wrong, and it was the omission: PPDI-RC is
    // part of the university's own network, described as such on this site
    // since before this rebuild. What would be wrong is calling it a campus, so
    // it says what it is.
    city: 'Nigeria',
    country: 'PPDI-RC',
    address: 'Professional development, applied research and training',
    role: 'Professional development centre — not a teaching campus',
    map: null,
    image: '/images/graduation-2024/grad-2024-registration-desk.jpg',
  },
  {
    city: 'Online',
    country: 'Worldwide',
    address: 'Every programme, from anywhere',
    role: 'The student portal, the library and your faculty',
    map: null,
    image: '/images/global.jpg',
  },
] as const;

export const PENDING_MEASURES = [
  {
    figure: 'Graduates to date',
    from: 'count(*) over credentials_issued where kind = award and not revoked',
    blocked: 'No credential has been issued yet. See docs/DEPLOYMENT.md §4.',
  },
  {
    figure: 'Students currently enrolled',
    from: "count(*) over students where status in ('enrolled', 'active')",
    blocked: 'Available as soon as the register carries a real intake.',
  },
  {
    figure: 'Countries represented',
    from: 'count(distinct country) over students',
    blocked:
      'The application form collects nationality; the figure is a query away once there are applications.',
  },
  {
    figure: 'Graduate satisfaction',
    from: 'A survey the university runs and can produce the instrument for.',
    blocked: 'Nothing in this system measures it, and it cannot be inferred.',
  },
  {
    figure: 'Graduate outcomes — employment, ministry, further study',
    from: 'A destinations survey of each graduating cohort, six and twelve months on.',
    blocked: 'There is no graduating cohort yet. This is the figure employers weigh most.',
  },
  {
    figure: 'Research centres and publications',
    from: 'A register of centres, and a publications list maintained by the Research Office.',
    blocked:
      'Neither exists in this system. The Research section of the homepage describes intent and '
      + 'must not be given a count until there is something to count.',
  },
] as const;
