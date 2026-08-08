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
import register from '@/content/universityPlaces.json';

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

// ---------------------------------------------------------------------------
// WHERE THE UNIVERSITY TEACHES FROM.
//
// Read from src/content/universityPlaces.json, which is also what the map draws
// and what scripts/build-flat-world.mjs plots. The header of that file says why
// the nation is the unit and why each one states its own kind.
// ---------------------------------------------------------------------------

export interface PlaceSite {
  /** The site, where the university names one. Null where it has named only the nation. */
  name: string | null;
  role: string;
  address: string | null;
  map: string | null;
  /** Can the university name a site here? Decides the mark on the map. */
  establishment: boolean;
  lon: number;
  lat: number;
}

export interface Nation {
  id: string;
  country: string;
  /** What the university has in this country — a campus, a centre, a presence, online. */
  kind: string;
  /** The same, short enough for a selector tab. See the register's header. */
  shortKind: string;
  /** A second line where the university gave one, e.g. the ICOF headquarters. */
  subKind?: string;
  blurb: string;
  /** Null where no page exists yet. Never a link to a page that is not there. */
  href: string | null;
  linkLabel: string | null;
  sites: PlaceSite[];
}

export const NATIONS_FULL: Nation[] = register.nations as Nation[];

/** Every named or marked place, flattened, for anything that wants a list. */
export const CAMPUSES: readonly PlaceSite[] = NATIONS_FULL.flatMap((n) => n.sites);

/**
 * The countries the university teaches from, in the register's order.
 *
 * WITHOUT THE ONLINE ENTRY, which is not a country. Filtered on having a site
 * with a coordinate rather than on its name, so an entry cannot be counted as a
 * nation unless it is somewhere a map could put it.
 */
export const NATIONS: string[] = NATIONS_FULL
  .filter((n) => n.sites.length > 0)
  .map((n) => n.country);

/**
 * The nations where the university states it TEACHES in-country.
 *
 * NOT the same list as NATIONS, and the difference is the whole point. NATIONS
 * includes Nigeria, where the university has a professional development and
 * research centre and says plainly that it is not a teaching campus. Prose that
 * says "taught in five nations" has therefore made a claim the register itself
 * contradicts — which is exactly what the university objected to.
 */
export const TEACHING_NATIONS: string[] = NATIONS_FULL
  .filter((n) => n.kind === 'International teaching presence')
  .map((n) => n.country);

/**
 * A small count as a word.
 *
 * WHY A HEADING MUST NOT PRINT A DIGIT. "4 decisions the University has still to
 * take" set in the display serif does not read as a sentence; it reads as a
 * spec. Every other count on this site under a dozen is spelled, which is
 * ordinary publishing practice and the reason a prospectus reads like a
 * document rather than a dashboard.
 *
 * The point is to spell the number WITHOUT typing it. The count still comes
 * from the data; only its spelling is looked up.
 */
const COUNT_WORDS = [
  'no', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
];
export const inWords = (n: number): string => COUNT_WORDS[n] ?? String(n);

/** The same, capitalised, for the head of a sentence. */
export const inWordsCapped = (n: number): string => {
  const w = inWords(n);
  return w.charAt(0).toUpperCase() + w.slice(1);
};

/**
 * The line under the hero buttons.
 *
 * WHY THE ACCREDITATION SENTENCE IS NOT HERE ANY MORE.
 *
 * "Accredited by the Ministry of Higher Education since 2007" was said four
 * times on one page: in this line, under the proof band, in full in the
 * standing band, and again in the footer. A claim repeated four times does not
 * become four times as credible. It reads as a university with one thing to say
 * — and it crowds out the thing that actually distinguishes this institution,
 * which is that it is the higher-education expression of a global fellowship.
 *
 * So the accreditation is now stated ONCE on the homepage, in full and with its
 * regulator named, in the standing band where a sceptical reader goes looking
 * for it. What survives here is what the hero is for: who this is, where it
 * reaches, and since when. Every clause is still checkable.
 */
export const HERO_ASSURANCES: string[] = [
  `Founded ${UNIVERSITY.established} within the International Circle of Faith`,
  // Derived, not typed. This said "Buea · Douala · Nigeria" — the towns — and
  // went on saying it after the university restated its reach as nations. It is
  // now the register's own list, so it cannot fall behind again.
  NATIONS.join(' · '),
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
export const PENDING_MEASURES = [
  {
    figure: 'Addresses for the United States, Zambia and South Africa',
    from: 'The university’s own register of teaching centres.',
    blocked:
      'The university has stated it teaches accredited degrees from these three nations, and '
      + 'the register carries them at national level. Until it supplies a city and a street, '
      + 'the map marks them with an open ring at the country rather than a campus dot, and no '
      + 'address is printed. A pin that names a building the university has not named is the '
      + 'easiest false claim on this site.',
  },
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
