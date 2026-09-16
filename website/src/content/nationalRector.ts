// ---------------------------------------------------------------------------
// THE NATIONAL RECTOR — the prospectus, as the University wrote it.
//
// ---------------------------------------------------------------------------
// THIS FILE IS THE UNIVERSITY'S WORDS, NOT A SUMMARY OF THEM
// ---------------------------------------------------------------------------
//
// The University supplied the whole prospectus on 16 September 2026 and asked
// for it to be developed into a book. What is here is that text, set into
// structure so a press can typeset it — parts, chapters, headings, lists,
// diagrams and the application form — and nothing else.
//
// NOTHING HAS BEEN ADDED. Not a campus, not an accreditation, not a founding
// date, not a country beyond the three the University itself gave as examples,
// not a fee, not a percentage of tuition. The standing rule against inventing
// an institutional fact is at its sharpest in a document like this one: a
// prospectus is read by a candidate deciding whether to commit years of their
// professional life, and a sentence nobody at the University wrote would be
// read as a promise the University had made.
//
// Where the text carries a blank — `[Country]`, a rule to sign on — the blank
// is the University's and is preserved as a blank. A prospectus that filled in
// its own country would be a different document.
//
// ---------------------------------------------------------------------------
// WHY IT IS DATA AND NOT HTML
// ---------------------------------------------------------------------------
//
// The same book has to become a bound document for printing, a page to read on
// screen, and a plain-text covering note short enough for WhatsApp. Three
// renderings of one source. Written as HTML it would be one rendering and two
// transcriptions, and a transcription drifts — which is the fault `constants.ts`
// records against the Registrar's name and the Director of Academic Affairs'
// title, twice, in this same codebase.
//
// So the structure is here and the typesetting is in `src/lib/prospectus.ts`.
// ---------------------------------------------------------------------------

import { VICE_CHANCELLORS_MESSAGE, type Signed } from './viceChancellorMessage';

/** A run of prose. */
export interface Paragraph { kind: 'p'; text: string }

/**
 * A line the book sets on its own, larger, because the University set it on its
 * own. "The National Rector builds the national academic community." is not a
 * paragraph that happens to be short; it is the sentence the chapter turns on.
 */
export interface Lead { kind: 'lead'; text: string }

/** A heading inside a chapter. */
export interface Heading { kind: 'h'; text: string }

/** A bulleted list. */
export interface Bullets { kind: 'bullets'; items: string[] }

/**
 * A term and what it means — "Institutional Leadership", "Academic Standing",
 * "Stage One — Application". The University wrote dozens of these and they are
 * the book's most common shape after the paragraph.
 */
export interface Definitions {
  kind: 'defs';
  items: { term: string; text: string }[];
}

/** A sequence with an arrow between each step. */
export interface Flow { kind: 'flow'; steps: string[] }

/** GLOBAL UNIVERSITY + NATIONAL LEADERSHIP = GLOBAL ACADEMIC COMMUNITY. */
export interface Equation { kind: 'equation'; lines: string[] }

/** The National Rector's dashboard, as columns of headings and entries. */
export interface Panel {
  kind: 'panel';
  title: string;
  subtitle?: string;
  columns: { heading: string; items: string[] }[];
}

/** An organisational chart: one root, branches, some with their own children. */
export interface Tree {
  kind: 'tree';
  root: string;
  branches: { label: string; children?: string[] }[];
}

/**
 * The National Rectors network: one university over many administrations.
 *
 * ---------------------------------------------------------------------------
 * THE ADMINISTRATIONS ARE NAMED, AND THE NAMES ARE THE UNIVERSITY'S OWN
 * ---------------------------------------------------------------------------
 *
 * They were not. The figure drew three boxes all reading "National
 * Administration", which the University stopped on 16 September 2026: "why
 * three national administration in three places. is it not suppose to be
 * different?"
 *
 * It is. A network of identical unnamed nodes is not a network, it is one node
 * drawn three times — and the answer was already in this book. Chapter Seven
 * lists the University's own examples:
 *
 *     ICOF Global University — National Administration of Uganda
 *     ICOF Global University — National Administration of Cameroon
 *     ICOF Global University — National Administration of Nigeria
 *
 * Those three, in that order, are what the figure names. Nothing is invented:
 * the countries are the University's, from ten chapters earlier, and a reader
 * who has come this far has already met them as examples.
 *
 * ---------------------------------------------------------------------------
 * AND `under` IS SAID ONCE
 * ---------------------------------------------------------------------------
 *
 * Rectors, Students, Faculty and Finance sit inside every one of them, so the
 * press draws them once in a band beneath — not once per column, which is the
 * other thing the University stopped: "even the information are all same which
 * is bad."
 */
export interface Network {
  kind: 'network';
  root: string;
  /** Each administration, named. Never the same label twice. */
  administrations: string[];
  /** What every one of them contains. Drawn once, under all of them. */
  under: string[];
}

/** A numbered question with the University's own gloss under it. */
export interface Numbered {
  kind: 'numbered';
  items: { n: number; title: string; text?: string }[];
}

/** Lines on a form that a person writes on. */
export interface Fields { kind: 'fields'; items: string[] }

/** An instruction on the form — what to write in the space below. */
export interface Instruction { kind: 'instruction'; text: string }

export type Block =
  | Paragraph | Lead | Heading | Bullets | Definitions | Flow | Equation
  | Panel | Tree | Network | Numbered | Fields | Instruction;

export interface Chapter {
  /** 'ONE', 'TWENTY-TWO' — the University numbered them in words. */
  ordinal: string;
  title: string;
  blocks: Block[];
}

export interface Part {
  /** 'I' … 'XIV'. */
  ordinal: string;
  title: string;
  chapters: Chapter[];
}

export interface Book {
  institution: string;
  title: string;
  subtitle: string;
  /**
   * The Vice-Chancellor's letter, which is the one part of this book NOT
   * supplied by the University.
   *
   * It lives in `viceChancellorMessage.ts` and is draft copy awaiting his
   * approval — see that file's header, and the separate count in
   * `prospectus.test.mjs`, which exists so that the line between "the
   * University wrote this" and "this was drafted for the University" stays
   * measurable rather than remembered.
   */
  viceChancellor: Signed;
  foreword: { title: string; blocks: Block[] };
  parts: Part[];
  /** The application form, which is a section and not a part. */
  final: { label: string; title: string; blocks: Block[] };
  /** The last page — the standing statement of the programme. */
  colophon: { title: string; strapline: string; blocks: Block[] };
}

const p = (text: string): Paragraph => ({ kind: 'p', text });
const lead = (text: string): Lead => ({ kind: 'lead', text });
const h = (text: string): Heading => ({ kind: 'h', text });
const bullets = (...items: string[]): Bullets => ({ kind: 'bullets', items });
const defs = (...items: { term: string; text: string }[]): Definitions =>
  ({ kind: 'defs', items });
const flow = (...steps: string[]): Flow => ({ kind: 'flow', steps });
const fields = (...items: string[]): Fields => ({ kind: 'fields', items });
const instruction = (text: string): Instruction => ({ kind: 'instruction', text });


// ===========================================================================
// THE BOOK
// ===========================================================================

export const NATIONAL_RECTOR: Book = {
  institution: 'ICOF Global University',
  title: 'The National Rector',
  subtitle: 'A Global University. A National Academic Community. Your Leadership.',

  // DRAFTED FOR HIM, NOT BY HIM — see viceChancellorMessage.ts.
  viceChancellor: VICE_CHANCELLORS_MESSAGE,

  // -------------------------------------------------------------------------
  foreword: {
    title: 'Foreword',
    blocks: [
      p('Higher education has always been shaped by geography.'),
      p('Universities were established in particular cities. Students travelled to those '
        + 'universities. Lecturers taught within physical campuses. Academic communities '
        + 'developed around buildings, libraries and lecture halls.'),
      p('The digital transformation of education has changed what is possible.'),
      p('A university can now bring together lecturers, researchers and students who live '
        + 'thousands of kilometres apart. Academic programmes can be delivered digitally. '
        + 'Students can participate in international classrooms without leaving their country. '
        + 'Technology can remove language barriers that once limited access to global '
        + 'scholarship.'),
      p('ICOF Global University is developing its institutional model around this possibility.'),
      p('The university is building a global academic community supported by nationally led '
        + 'administrations.'),
      lead('The National Rector is central to this model.'),
      p('A National Rector is not simply an agent of the university. The office exists to '
        + 'establish and lead the university’s presence within a nation; to develop its student '
        + 'community; to build an academic and administrative team; to represent the university '
        + 'within approved national relationships; and, where academically qualified, to '
        + 'participate directly in teaching and scholarship.'),
      p('The central university provides the academic framework, programmes, technology, '
        + 'institutional systems and global infrastructure.'),
      p('The National Rector provides leadership where the university meets the nation.'),
      p('This creates a relationship between global academic reach and national leadership.'),
      p('The purpose of this prospectus is to set out that opportunity in full.'),
      p('It explains the office of National Rector, the National Administration, student '
        + 'enrollment, staffing, financial administration, academic participation, technology, '
        + 'multilingual learning, institutional governance, development and the process through '
        + 'which qualified candidates may apply.'),
      p('The programme is intended for people who want to participate in the development of '
        + 'higher education at institutional level.'),
      p('It is for academics and educational leaders who have the qualifications, experience, '
        + 'relationships and determination to build.'),
      lead('ICOF Global University provides the global platform.'),
      lead('The National Rector builds the national academic community.'),
    ],
  },

  // -------------------------------------------------------------------------
  parts: [
    {
      ordinal: 'I',
      title: 'The Global University',
      chapters: [
        {
          ordinal: 'ONE',
          title: 'A University Without Geographical Limits',
          blocks: [
            p('ICOF Global University is organized around a global model of higher education.'),
            p('Its academic community is not defined by one city or one physical location. '
              + 'Students and lecturers may participate from different nations while remaining '
              + 'connected through the same university.'),
            p('The university’s digital infrastructure provides the common environment through '
              + 'which students access programmes, academic materials, learning activities, '
              + 'assessments and university services.'),
            p('This structure allows ICOF to develop a network of national academic communities '
              + 'while maintaining a single institutional identity.'),
            p('The university therefore operates through two complementary dimensions.'),
            h('The Global University'),
            p('The central university provides the common institutional foundation:'),
            bullets(
              'academic programmes', 'academic standards', 'university regulations',
              'degree requirements', 'quality assurance', 'central academic governance',
              'student records', 'degree administration', 'global faculty',
              'learning technology', 'digital student services',
              'multilingual learning infrastructure', 'institutional resources',
            ),
            h('The National Administration'),
            p('The National Administration provides the local institutional presence:'),
            bullets(
              'national student recruitment', 'student support', 'national administration',
              'local academic activities', 'national staff development',
              'institutional relationships', 'approved partnerships', 'national events',
              'local financial administration', 'national community development',
            ),
            p('Neither replaces the other.'),
            lead('The central university provides unity.'),
            lead('The National Administration provides local leadership.'),
          ],
        },
        {
          ordinal: 'TWO',
          title: 'The Global Academic Community',
          blocks: [
            p('ICOF Global University connects students and academics through a common academic '
              + 'environment.'),
            p('A student does not have to be physically located beside a lecturer to become part '
              + 'of that lecturer’s academic community.'),
            p('A lecturer may teach students located in several nations.'),
            p('A student may study courses delivered by academics located in different countries.'),
            p('A National Administration may provide the local support structure through which '
              + 'students participate in the global university.'),
            p('This creates an academic model with three levels of participation:'),
            defs(
              { term: 'Local',
                text: 'Students have a national point of contact through their National '
                  + 'Administration.' },
              { term: 'Global',
                text: 'Students have access to programmes, lecturers and academic resources '
                  + 'belonging to the wider university.' },
              { term: 'Digital',
                text: 'Students use the university’s technology to access learning, '
                  + 'administration and academic services.' },
            ),
            lead('The National Rector is the person who connects these three dimensions within '
              + 'the nation.'),
          ],
        },
        {
          ordinal: 'THREE',
          title: 'Why National Administrations Exist',
          blocks: [
            p('A global university cannot serve every nation effectively by operating entirely '
              + 'from one central office.'),
            p('Students live within different educational environments.'),
            p('They speak different languages.'),
            p('They have different professional networks.'),
            p('They require local communication and support.'),
            p('They participate in different national communities.'),
            p('Academic leaders within each country understand these environments in ways that a '
              + 'distant central office cannot reproduce.'),
            p('ICOF therefore establishes National Administrations as a mechanism for local '
              + 'leadership within a global institution.'),
            p('The National Administration is the recognized national operating structure through '
              + 'which ICOF develops its student and academic community within an approved '
              + 'country.'),
            p('It provides the university with a local institutional presence while keeping the '
              + 'national operation connected to the central university.'),
            p('The model is therefore:'),
            { kind: 'equation',
              lines: ['GLOBAL UNIVERSITY', '+', 'NATIONAL LEADERSHIP', '=',
                'GLOBAL ACADEMIC COMMUNITY'] },
          ],
        },
      ],
    },

    {
      ordinal: 'II',
      title: 'The National Rector',
      chapters: [
        {
          ordinal: 'FOUR',
          title: 'The Office of National Rector',
          blocks: [
            p('The National Rector is the senior representative of ICOF Global University within '
              + 'an approved nation.'),
            p('The official designation may be:'),
            lead('National Rector & Senior Lecturer'),
            lead('ICOF Global University — [Country]'),
            p('where the individual holds the appropriate academic appointment.'),
            p('The office combines institutional administration and academic leadership.'),
            p('The National Rector is responsible for developing the ICOF presence within the '
              + 'nation and for leading the National Administration according to university '
              + 'policy and the National Administration Agreement.'),
            p('The office encompasses:'),
            defs(
              { term: 'Institutional Leadership',
                text: 'The National Rector leads the national operation and establishes its '
                  + 'organizational structure.' },
              { term: 'Student Development',
                text: 'The National Rector develops the national student community and oversees '
                  + 'its local administration and support.' },
              { term: 'Academic Leadership',
                text: 'The National Rector participates in academic activities and may teach or '
                  + 'supervise students where appropriately qualified and appointed.' },
              { term: 'Staff Development',
                text: 'The National Rector develops the national team and recommends qualified '
                  + 'individuals for appointment.' },
              { term: 'National Representation',
                text: 'The National Rector represents ICOF within approved national '
                  + 'relationships and activities.' },
              { term: 'Institutional Growth',
                text: 'The National Rector is responsible for developing the National '
                  + 'Administration from its initial establishment into a sustainable national '
                  + 'academic community.' },
            ),
            p('The office therefore carries both responsibility and opportunity.'),
            lead('The National Rector is expected to build.'),
          ],
        },
        {
          ordinal: 'FIVE',
          title: 'The Status of the National Rector',
          blocks: [
            p('The National Rector occupies a formal position within the ICOF institutional '
              + 'structure.'),
            p('The position is distinct from an ordinary recruitment representative, marketing '
              + 'agent or independent education provider.'),
            lead('The National Rector operates as part of the university.'),
            p('The office is connected to the central university through:'),
            bullets(
              'institutional appointment', 'academic governance', 'administrative systems',
              'student systems', 'financial systems', 'university policies',
              'reporting structures', 'global academic activities',
              'institutional communications',
            ),
            p('The National Rector may represent the university in approved national settings '
              + 'and may use the institutional designation granted by ICOF.'),
            p('The office carries responsibility for protecting the reputation, standards and '
              + 'interests of ICOF within the nation.'),
          ],
        },
        {
          ordinal: 'SIX',
          title: 'The Person ICOF Appoints',
          blocks: [
            p('The National Rector position is intended for a person capable of establishing an '
              + 'academic institution within a national environment.'),
            p('Academic qualification is therefore important, but qualification alone is not '
              + 'sufficient.'),
            p('The candidate should demonstrate the ability to lead people, develop '
              + 'relationships, organize operations and build a student community.'),
            p('ICOF may consider candidates with backgrounds including:'),
            bullets(
              'senior university teaching', 'senior lecturing', 'professorial work',
              'academic administration', 'university leadership', 'educational management',
              'research', 'professional education', 'institutional development',
            ),
            p('The candidate should possess a combination of:'),
            defs(
              { term: 'Academic Standing',
                text: 'The candidate should have an academic background appropriate to the '
                  + 'office and, where the position includes a Senior Lecturer appointment, meet '
                  + 'the relevant academic requirements.' },
              { term: 'Leadership Capacity',
                text: 'The candidate should be capable of establishing and managing a national '
                  + 'organization.' },
              { term: 'Professional Reputation',
                text: 'The candidate should demonstrate conduct appropriate to representing a '
                  + 'university.' },
              { term: 'National Relationships',
                text: 'The candidate should have the ability to establish relationships with '
                  + 'students, academics, institutions, organizations and other relevant '
                  + 'communities.' },
              { term: 'Institutional Vision',
                text: 'The candidate should understand how to develop a sustainable academic '
                  + 'operation rather than merely conduct short-term recruitment.' },
              { term: 'Commitment',
                text: 'The National Administration requires active leadership. The candidate '
                  + 'should have the time and willingness to develop it.' },
            ),
          ],
        },
      ],
    },

    {
      ordinal: 'III',
      title: 'Building the National Administration',
      chapters: [
        {
          ordinal: 'SEVEN',
          title: 'Your National University Office',
          blocks: [
            p('Upon appointment, the National Rector receives access to a dedicated '
              + 'administrative environment within the ICOF digital university platform.'),
            p('The National Administration is identified by country.'),
            p('Examples include:'),
            bullets(
              'ICOF Global University — National Administration of Uganda',
              'ICOF Global University — National Administration of Cameroon',
              'ICOF Global University — National Administration of Nigeria',
            ),
            p('The National Rector’s workspace provides access to the functions required for the '
              + 'national operation.'),
            p('The exact permissions depend on the office held and the policies governing the '
              + 'National Administration.'),
            p('Core administrative areas include:'),
            defs(
              { term: 'Students', text: 'National student records and student administration.' },
              { term: 'Admissions', text: 'Applicant management and enrollment support.' },
              { term: 'Staff', text: 'National academic and administrative personnel.' },
              { term: 'Academic',
                text: 'Courses, teaching responsibilities and approved academic activities.' },
              { term: 'Finance',
                text: 'National tuition information, financial administration and reporting.' },
              { term: 'Communications',
                text: 'Communication with students and national stakeholders.' },
              { term: 'Reports',
                text: 'Operational, enrollment, academic and financial reporting.' },
              { term: 'Administration',
                text: 'National settings and authorized institutional functions.' },
            ),
            p('The National Rector therefore receives an institutional operating environment '
              + 'rather than having to construct a separate university administration system.'),
          ],
        },
        {
          ordinal: 'EIGHT',
          title: 'Developing the National Student Community',
          blocks: [
            p('The National Rector’s primary institutional responsibility is the development of '
              + 'the national student community.'),
            p('The National Administration may conduct organized activities to introduce '
              + 'prospective students to ICOF and assist them through the application and '
              + 'enrollment process.'),
            p('These activities may include:'),
            bullets(
              'information sessions', 'academic seminars', 'recruitment campaigns',
              'institutional presentations', 'student orientation', 'community outreach',
              'partnerships', 'professional networks', 'educational events',
              'digital campaigns', 'student support',
            ),
            p('The National Rector establishes the relationship between the student and the '
              + 'university at the national level.'),
            p('A student should know:'),
            bullets(
              'Where do I go for help?',
              'Who represents the university in my country?',
              'Who can guide me through the university’s programmes?',
              'Who can connect me with the wider ICOF academic community?',
            ),
            lead('The National Administration answers those questions.'),
          ],
        },
        {
          ordinal: 'NINE',
          title: 'Student Enrollment',
          blocks: [
            p('The national student journey is integrated into the global university system.'),
            p('A typical process is:'),
            flow('Prospective Student', 'National Administration', 'Application',
              'University Admissions Process', 'Registration', 'Enrollment', 'Learning',
              'Assessment', 'Progression', 'Graduation'),
            p('The National Rector and national team provide local assistance throughout this '
              + 'process while the central university maintains the institutional academic '
              + 'framework.'),
            p('This creates a clear division of responsibility.'),
            lead('The National Administration develops access.'),
            lead('The university maintains academic standards.'),
            lead('The student receives one coherent university experience.'),
          ],
        },
        {
          ordinal: 'TEN',
          title: 'Building the National Academic Team',
          blocks: [
            p('The National Rector is not expected to remain a one-person administration.'),
            p('As the student community develops, the National Rector may recommend qualified '
              + 'people for national positions.'),
            p('Potential appointments include:'),
            bullets(
              'Senior Lecturers', 'Lecturers', 'Adjunct Lecturers', 'Tutors',
              'Academic Coordinators', 'Programme Coordinators', 'Student Affairs Officers',
              'Admissions Officers', 'Administrative Officers', 'Finance Secretaries',
              'Student Support Officers', 'Communications personnel',
              'Other approved national positions',
            ),
            p('The National Rector identifies the people required to develop the national '
              + 'operation.'),
            p('ICOF maintains the university’s qualification and appointment standards.'),
            p('The principle is:'),
            lead('National Leadership Builds the Team.'),
            lead('University Standards Protect the Institution.'),
            p('This gives the National Rector the ability to create an organization suited to the '
              + 'needs of the country without creating a separate academic standard for each '
              + 'nation.'),
          ],
        },
      ],
    },

    {
      ordinal: 'IV',
      title: 'Academic Leadership',
      chapters: [
        {
          ordinal: 'ELEVEN',
          title: 'The National Rector as Academic',
          blocks: [
            p('The National Rector may also hold an academic appointment within ICOF.'),
            p('Where the individual’s qualifications meet the applicable requirements, the office '
              + 'may be designated:'),
            lead('National Rector & Senior Lecturer'),
            p('or another appropriate academic title.'),
            p('This allows the National Rector to remain directly involved in academic life.'),
            p('The National Rector may, according to appointment and academic responsibility:'),
            bullets(
              'teach', 'supervise students', 'conduct seminars', 'participate in research',
              'contribute to scholarly activities', 'mentor students',
              'participate in academic conferences',
              'contribute recommendations concerning academic development',
              'support academic staff',
              'participate in approved examinations and assessment activities',
            ),
            p('The office therefore does not require an academic leader to abandon scholarship in '
              + 'order to lead.'),
            lead('The National Rector can build the institution while remaining part of its '
              + 'academic life.'),
          ],
        },
        {
          ordinal: 'TWELVE',
          title: 'The Global Faculty',
          blocks: [
            p('ICOF’s faculty community extends beyond national borders.'),
            p('A National Administration does not need to create every programme or course '
              + 'independently.'),
            p('The national student community can participate in programmes delivered through the '
              + 'wider university.'),
            p('This creates opportunities for collaboration between:'),
            bullets(
              'national lecturers', 'central faculty', 'international lecturers', 'researchers',
              'academic coordinators', 'visiting academics',
            ),
            p('A National Rector can therefore develop local academic capacity while also '
              + 'connecting students to the wider ICOF faculty.'),
            lead('The national academic community becomes part of the global academic community.'),
          ],
        },
        {
          ordinal: 'THIRTEEN',
          title: 'The Global Classroom',
          blocks: [
            p('The ICOF learning environment is designed for international participation.'),
            p('A lecturer may teach from one country while students participate from many others.'),
            p('The original academic course remains the authoritative source for the learning '
              + 'experience.'),
            p('The digital platform can then provide students with additional learning support.'),
            p('A course may therefore move through the following structure:'),
            flow('Lecturer', 'Original Academic Content', 'ICOF Learning Platform',
              'Language Selection', 'Student Learning Materials',
              'Notes · Quizzes · Study Guides · Revision'),
            p('This allows the university to serve students who do not share the lecturer’s first '
              + 'language.'),
          ],
        },
        {
          ordinal: 'FOURTEEN',
          title: 'Multilingual Learning',
          blocks: [
            p('Language should not unnecessarily prevent a qualified student from participating '
              + 'in global higher education.'),
            p('ICOF’s technology can support students by adapting learning materials into their '
              + 'selected learning language.'),
            p('The lecturer may provide the original course in one language.'),
            p('Students may select another supported language for their learning materials.'),
            p('The system can assist in producing:'),
            bullets(
              'lecture notes', 'summaries', 'study guides', 'quizzes', 'revision material',
              'flashcards', 'explanations', 'terminology support',
            ),
            p('The original lecturer content remains connected to the generated learning '
              + 'material.'),
            lead('This distinction is fundamental.'),
            p('The technology is an accessibility and learning layer.'),
            p('It does not replace the lecturer’s academic authority.'),
            p('The result is a university capable of bringing academic teaching across language '
              + 'boundaries while maintaining a common academic source.'),
          ],
        },
      ],
    },

    {
      ordinal: 'V',
      title: 'National Authority',
      chapters: [
        {
          ordinal: 'FIFTEEN',
          title: 'What the National Rector Leads',
          blocks: [
            p('The National Rector leads the national operation within the authority delegated by '
              + 'ICOF.'),
            p('The office may include responsibility for:'),
            defs(
              { term: 'National Administration',
                text: 'Managing the day-to-day national operation.' },
              { term: 'Student Development',
                text: 'Developing and supporting the national student body.' },
              { term: 'Recruitment',
                text: 'Building awareness and attracting qualified prospective students.' },
              { term: 'Staff Development',
                text: 'Recommending and developing the national team.' },
              { term: 'Academic Participation',
                text: 'Teaching and participating in academic activities where qualified.' },
              { term: 'National Partnerships',
                text: 'Developing approved relationships within the country.' },
              { term: 'Events',
                text: 'Organizing national academic and institutional activities.' },
              { term: 'Communications',
                text: 'Representing ICOF through approved national communications.' },
              { term: 'Finance',
                text: 'Overseeing the approved financial administration of the national '
                  + 'operation.' },
              { term: 'Institutional Growth',
                text: 'Developing the national administration toward long-term sustainability.' },
            ),
            p('The National Rector’s authority is exercised within the university’s statutes, '
              + 'policies and National Administration Agreement.'),
          ],
        },
        {
          ordinal: 'SIXTEEN',
          title: 'What Remains With the Central University',
          blocks: [
            p('National leadership does not create a separate university.'),
            p('The central university retains authority over matters necessary to maintain one '
              + 'institutional and academic standard.'),
            p('These include:'),
            bullets(
              'university-wide academic standards', 'degree requirements',
              'institutional regulations', 'degree issuance', 'central academic governance',
              'academic integrity', 'quality assurance', 'central student records',
              'university-wide academic policies', 'institutional identity', 'central systems',
              'other matters reserved to the university by its governing instruments',
            ),
            p('The distinction is deliberate.'),
            lead('The National Rector has national operational authority.'),
            lead('The central university retains institutional academic authority.'),
            p('This protects both sides of the model.'),
            p('The National Rector can lead.'),
            p('The university remains one university.'),
          ],
        },
        {
          ordinal: 'SEVENTEEN',
          title: 'National Representation',
          blocks: [
            p('The National Rector serves as an official point of institutional contact for ICOF '
              + 'within the country.'),
            p('Subject to university authorization, the National Rector may engage with:'),
            bullets(
              'educational institutions', 'academic organizations', 'professional bodies',
              'businesses', 'community organizations',
              'churches and faith-based organizations where appropriate',
              'research organizations', 'educational networks',
              'prospective institutional partners',
            ),
            p('The purpose of these relationships is to develop academic access, collaboration, '
              + 'student opportunities and institutional presence.'),
            p('The National Rector represents ICOF’s institutional identity and is expected to '
              + 'conduct all national activities in accordance with university standards.'),
          ],
        },
      ],
    },

    {
      ordinal: 'VI',
      title: 'The National Economic Model',
      chapters: [
        {
          ordinal: 'EIGHTEEN',
          title: 'A Financially Sustainable National Administration',
          blocks: [
            p('A National Administration must be capable of supporting its own development.'),
            p('ICOF therefore establishes a national tuition-revenue model through which an '
              + 'approved National Administration can participate in the financial resources '
              + 'generated by the students it serves.'),
            p('The model distinguishes between central registration revenue and national tuition '
              + 'revenue.'),
            defs(
              { term: 'Registration Fee',
                text: 'The registration fee is allocated to the central university according to '
                  + 'the university’s approved fee structure.' },
              { term: 'Tuition',
                text: 'Tuition associated with students administered through an approved '
                  + 'National Administration is allocated according to the financial terms '
                  + 'established in the National Administration Agreement.' },
            ),
            p('The agreement defines:'),
            bullets(
              'the revenue allocation', 'permitted national expenditure', 'financial reporting',
              'banking arrangements', 'staff compensation', 'administrative expenses',
              'institutional development', 'central obligations', 'audit requirements',
              'applicable financial controls',
            ),
            p('This creates a direct connection between the development of the national student '
              + 'community and the resources available to develop the National Administration.'),
            p('The National Rector therefore has an institutional reason to build sustainably.'),
            lead('More students create a larger academic community.'),
            lead('A larger academic community supports greater staffing and services.'),
            lead('Greater staffing and services strengthen the national institution.'),
          ],
        },
        {
          ordinal: 'NINETEEN',
          title: 'The National Financial Office',
          blocks: [
            p('Each National Administration may establish a professional financial function.'),
            p('The National Rector may recommend or appoint a National Financial Secretary, '
              + 'subject to the applicable ICOF requirements.'),
            p('The Financial Secretary may be responsible for:'),
            bullets(
              'tuition reconciliation', 'payment records', 'receipts',
              'financial documentation', 'national expenses', 'approved staff payments',
              'budgets', 'financial reports', 'student account reconciliation',
              'outstanding tuition', 'approved refunds', 'banking administration',
              'audit preparation', 'reporting to central finance',
            ),
            p('Financial authority should be separated sufficiently to protect the national '
              + 'administration and its officers.'),
            p('The financial structure therefore combines national operational responsibility '
              + 'with institutional accountability.'),
          ],
        },
        {
          ordinal: 'TWENTY',
          title: 'The National Rector’s Financial Interest',
          blocks: [
            p('The National Administration is designed to give its leadership a genuine economic '
              + 'foundation.'),
            p('The National Rector’s personal compensation is established separately from student '
              + 'tuition ownership.'),
            p('The National Administration receives and administers revenue according to its '
              + 'approved agreement with ICOF.'),
            p('The National Rector may receive:'),
            bullets(
              'salary', 'leadership compensation', 'approved allowances',
              'revenue-based compensation', 'other contractual benefits',
            ),
            p('according to the applicable National Administration Agreement.'),
            p('This distinction protects the university’s finances and provides clarity for the '
              + 'National Rector.'),
            p('The objective is straightforward:'),
            lead('The National Rector should be rewarded for building and leading a successful '
              + 'national university operation.'),
          ],
        },
      ],
    },

    {
      ordinal: 'VII',
      title: 'The ICOF Digital University',
      chapters: [
        {
          ordinal: 'TWENTY-ONE',
          title: 'The Technology Platform',
          blocks: [
            p('The National Rector does not need to build an independent university information '
              + 'system.'),
            p('ICOF provides the digital infrastructure connecting the global university.'),
            p('The platform can integrate:'),
            bullets(
              'student administration', 'admissions', 'academic programmes', 'courses',
              'lecturers', 'assessments', 'learning materials', 'multilingual learning',
              'finance', 'communications', 'reporting', 'national administration',
            ),
            p('The National Rector operates through the functions assigned to the National '
              + 'Administration.'),
            p('This allows a national academic leader to concentrate on building the institution, '
              + 'rather than spending years developing its underlying software infrastructure.'),
          ],
        },
        {
          ordinal: 'TWENTY-TWO',
          title: 'The National Rector Dashboard',
          blocks: [
            p('The National Rector’s administrative environment provides a national view of the '
              + 'university operation.'),
            p('A typical dashboard may present:'),
            {
              kind: 'panel',
              title: 'ICOF Global University',
              subtitle: 'National Administration — [Country]',
              columns: [
                { heading: 'Students',
                  items: ['Active', 'New', 'Applicants', 'Graduating'] },
                { heading: 'Academic',
                  items: ['Lecturers', 'Programmes', 'Courses', 'Academic Activities'] },
                { heading: 'Finance',
                  items: ['Tuition', 'Payments', 'Outstanding', 'National Expenses'] },
                { heading: 'Administration',
                  items: ['Staff', 'Admissions', 'Communications', 'Reports'] },
              ],
            },
            p('The dashboard becomes the operational centre of the National Rector’s office.'),
            p('The national leader can see the development of the administration and direct '
              + 'attention toward areas requiring action.'),
          ],
        },
        {
          ordinal: 'TWENTY-THREE',
          title: 'A Global University in a Single Digital Environment',
          blocks: [
            p('The digital model means that the university can maintain a common institutional '
              + 'infrastructure even while operating across many nations.'),
            p('The student in one nation and the student in another may use the same university '
              + 'platform.'),
            p('The lecturer may teach students across several countries.'),
            p('The National Rector manages the national community through the same global '
              + 'infrastructure.'),
            p('Central administrators maintain the university-wide systems.'),
            lead('The result is a unified digital university with nationally administered '
              + 'communities.'),
          ],
        },
      ],
    },

    {
      ordinal: 'VIII',
      title: 'One University',
      chapters: [
        {
          ordinal: 'TWENTY-FOUR',
          title: 'One University — One Academic Standard',
          blocks: [
            p('The National Administration model is built on one principle:'),
            lead('One University. One Academic Standard. Many Nations.'),
            p('National administrations do not create different academic standards.'),
            p('A student enrolled through one National Administration remains a student of ICOF '
              + 'Global University.'),
            p('Academic programmes remain part of the university.'),
            p('Degrees remain governed by the university.'),
            p('Academic requirements remain governed by the university.'),
            p('Quality assurance remains a university responsibility.'),
            p('National leadership determines how the university develops locally.'),
            p('Central academic governance determines the standards under which the university '
              + 'operates.'),
            p('This allows ICOF to expand internationally without fragmenting its academic '
              + 'identity.'),
          ],
        },
        {
          ordinal: 'TWENTY-FIVE',
          title: 'The Global National Rectors Network',
          blocks: [
            p('National Rectors form part of a wider leadership network within ICOF Global '
              + 'University.'),
            p('Each Rector leads an approved National Administration.'),
            p('Each National Administration serves its national student community.'),
            p('Each remains connected to the central university.'),
            p('The structure is:'),
            {
              kind: 'network',
              root: 'ICOF Global University',
              // THE THREE THE UNIVERSITY NAMED IN CHAPTER SEVEN, in its order.
              administrations: [
                'National Administration of Uganda',
                'National Administration of Cameroon',
                'National Administration of Nigeria',
              ],
              under: ['Rectors', 'Students', 'Faculty', 'Finance'],
            },
            p('The National Rector network creates institutional communication across countries.'),
            p('National leaders can participate in global university meetings, academic '
              + 'initiatives and institutional programmes as authorized by ICOF.'),
            p('The national communities remain distinct in administration while united in '
              + 'institutional identity.'),
          ],
        },
      ],
    },

    {
      ordinal: 'IX',
      title: 'Building the National Institution',
      chapters: [
        {
          ordinal: 'TWENTY-SIX',
          title: 'The First Stage: Establishment',
          blocks: [
            p('The first responsibility of a newly appointed National Rector is to establish the '
              + 'National Administration.'),
            p('This includes:'),
            bullets(
              'completing institutional onboarding',
              'establishing the national administrative structure',
              'identifying the first staff',
              'developing a national student recruitment plan',
              'establishing communication channels',
              'developing institutional relationships',
              'understanding the available academic programmes',
              'preparing the first student intake',
              'establishing financial procedures',
              'activating the national digital workspace',
            ),
            p('The National Rector begins with a defined institutional framework and develops it '
              + 'according to national conditions.'),
          ],
        },
        {
          ordinal: 'TWENTY-SEVEN',
          title: 'The Second Stage: Student Community',
          blocks: [
            p('The National Administration’s first student cohort establishes its academic '
              + 'community.'),
            p('The National Rector develops:'),
            bullets(
              'orientation', 'student support', 'academic communication', 'local events',
              'seminars', 'mentoring', 'student engagement', 'progression support',
            ),
            p('Students become the foundation of the national operation.'),
            p('The objective is not simply enrollment.'),
            lead('It is the development of an active academic community.'),
          ],
        },
        {
          ordinal: 'TWENTY-EIGHT',
          title: 'The Third Stage: Academic Team',
          blocks: [
            p('As enrollment develops, the National Rector expands the academic and '
              + 'administrative team.'),
            p('The national team may develop from a small founding structure into a substantial '
              + 'academic organization.'),
            p('For example:'),
            {
              kind: 'tree',
              root: 'National Rector',
              branches: [
                { label: 'Academic Coordinator',
                  children: ['Senior Lecturers', 'Lecturers', 'Tutors'] },
                { label: 'Student Affairs' },
                { label: 'Admissions' },
                { label: 'Administration' },
                { label: 'Financial Secretary' },
              ],
            },
            p('The precise structure depends on the size and requirements of the National '
              + 'Administration.'),
            p('Growth should follow institutional need.'),
          ],
        },
        {
          ordinal: 'TWENTY-NINE',
          title: 'The Fourth Stage: National Academic Community',
          blocks: [
            p('A mature National Administration becomes more than an enrollment operation.'),
            lead('It develops an academic culture.'),
            p('This may include:'),
            bullets(
              'national lectures', 'seminars', 'research activities', 'student societies',
              'academic conferences', 'professional events', 'faculty meetings',
              'public lectures', 'academic partnerships', 'community education',
              'collaborative research',
            ),
            p('The National Rector becomes responsible for developing an environment in which '
              + 'students and academics identify with the university as an academic institution.'),
          ],
        },
        {
          ordinal: 'THIRTY',
          title: 'The Fifth Stage: Institutional Expansion',
          blocks: [
            p('A successful National Administration can develop its operations as its academic '
              + 'community grows.'),
            p('Expansion may include:'),
            bullets(
              'additional programmes', 'additional faculty', 'additional administrative staff',
              'increased student services', 'stronger institutional partnerships',
              'national academic events', 'research initiatives', 'professional education',
              'physical facilities where appropriate',
              'an ICOF centre or other approved institutional presence',
            ),
            p('Any physical campus or regulated educational operation must comply with applicable '
              + 'national law and ICOF’s institutional requirements.'),
            p('The National Administration therefore provides a pathway for institutional '
              + 'development without requiring every country to begin with a physical campus.'),
          ],
        },
      ],
    },

    {
      ordinal: 'X',
      title: 'The National Rector’s Professional Life',
      chapters: [
        {
          ordinal: 'THIRTY-ONE',
          title: 'Leadership and Scholarship',
          blocks: [
            p('The National Rector occupies a position at the intersection of leadership and '
              + 'scholarship.'),
            p('The office provides an academic leader with an opportunity to:'),
            bullets(
              'Teach students.', 'Develop lecturers.', 'Build academic programmes.',
              'Develop institutional partnerships.', 'Lead a national university community.',
              'Participate in global academic activities.',
            ),
            p('This combination distinguishes the National Rector from an ordinary administrative '
              + 'appointment.'),
            p('The position is designed for people who want to build an institution while '
              + 'remaining intellectually engaged.'),
          ],
        },
        {
          ordinal: 'THIRTY-TWO',
          title: 'Professional Recognition',
          blocks: [
            p('The National Rector’s institutional designation establishes a formal leadership '
              + 'role within ICOF.'),
            p('The title communicates three things:'),
            bullets(
              'Academic standing.',
              'National institutional responsibility.',
              'Membership of the ICOF global leadership structure.',
            ),
            p('The title is used according to the appointment granted by ICOF and the '
              + 'university’s governing documents.'),
            p('National Rectors are expected to protect the credibility associated with that '
              + 'position through professional conduct and faithful adherence to university '
              + 'standards.'),
          ],
        },
      ],
    },

    {
      ordinal: 'XI',
      title: 'Joining ICOF',
      chapters: [
        {
          ordinal: 'THIRTY-THREE',
          title: 'Why the National Rector Role Exists',
          blocks: [
            p('ICOF Global University is establishing National Administrations because global '
              + 'higher education requires both international infrastructure and local '
              + 'leadership.'),
            p('The central university cannot replace the knowledge, relationships and leadership '
              + 'of an academic who understands their own nation.'),
            p('At the same time, a national academic community benefits from connection to a '
              + 'wider university.'),
            lead('The National Rector brings those two realities together.'),
            p('The office provides a qualified academic leader with the institutional framework '
              + 'to:'),
            bullets(
              'establish a national university community', 'recruit and support students',
              'build an academic team', 'participate in teaching',
              'develop national partnerships', 'administer national operations',
              'develop financial sustainability',
              'connect students to global academic resources',
              'participate in an international university network',
            ),
          ],
        },
        {
          ordinal: 'THIRTY-FOUR',
          title: 'The National Development Plan',
          blocks: [
            p('Every applicant should submit a National Development Plan describing how they '
              + 'intend to establish ICOF within their country.'),
            p('The plan should address:'),
            {
              kind: 'numbered',
              items: [
                { n: 1, title: 'National Academic Vision',
                  text: 'What should ICOF’s presence in the country accomplish?' },
                { n: 2, title: 'Student Development',
                  text: 'Who are the intended student communities?' },
                { n: 3, title: 'Recruitment Strategy',
                  text: 'How will prospective students be reached?' },
                { n: 4, title: 'Academic Development',
                  text: 'What academic areas have strong potential?' },
                { n: 5, title: 'Staff Development',
                  text: 'What academics and administrators can form the founding team?' },
                { n: 6, title: 'Partnerships',
                  text: 'Which institutions and organizations may become relevant partners?' },
                { n: 7, title: 'Financial Sustainability',
                  text: 'How will the National Administration develop a sustainable operation?' },
                { n: 8, title: 'First-Year Objectives',
                  text: 'What should be established during the first year?' },
                { n: 9, title: 'Growth Objectives',
                  text: 'What should the National Administration become over three to five '
                    + 'years?' },
              ],
            },
            p('The National Development Plan allows ICOF to understand not only the applicant’s '
              + 'qualifications but also their ability to build.'),
          ],
        },
      ],
    },

    {
      ordinal: 'XII',
      title: 'Appointment',
      chapters: [
        {
          ordinal: 'THIRTY-FIVE',
          title: 'The Application Process',
          blocks: [
            p('The National Rector appointment process consists of several stages.'),
            h('Stage One — Application'),
            p('The candidate submits:'),
            bullets(
              'curriculum vitae', 'academic qualifications', 'professional history',
              'leadership experience', 'references', 'National Development Plan',
              'statement of interest', 'proposed national strategy',
            ),
            h('Stage Two — Academic Review'),
            p('ICOF reviews the candidate’s academic qualifications and professional background.'),
            h('Stage Three — Leadership Review'),
            p('The candidate’s capacity to lead a National Administration is assessed.'),
            h('Stage Four — National Development Presentation'),
            p('The candidate presents their plan for developing ICOF within the country.'),
            h('Stage Five — Appointment Decision'),
            p('Successful candidates receive a formal appointment subject to the applicable '
              + 'university requirements and agreement.'),
            h('Stage Six — Institutional Onboarding'),
            p('The appointed Rector receives access to the relevant ICOF systems and '
              + 'institutional resources.'),
            h('Stage Seven — National Launch'),
            p('The National Administration begins its formal development.'),
          ],
        },
        {
          ordinal: 'THIRTY-SIX',
          title: 'The National Rector Agreement',
          blocks: [
            p('Appointment as National Rector is governed by a formal agreement.'),
            p('The agreement establishes the relationship between the National Rector, the '
              + 'National Administration and ICOF Global University.'),
            p('It should address:'),
            bullets(
              'appointment', 'authority', 'responsibilities', 'academic role',
              'staff recommendations', 'student administration', 'financial arrangements',
              'tuition revenue', 'registration revenue', 'expenses', 'reporting', 'banking',
              'taxation', 'data protection', 'institutional identity', 'use of the ICOF name',
              'academic standards', 'quality assurance', 'confidentiality',
              'intellectual property', 'termination', 'succession', 'dispute resolution',
            ),
            p('The agreement provides certainty for both ICOF and the National Rector.'),
            p('It defines the framework within which the national institution is built.'),
          ],
        },
      ],
    },

    {
      ordinal: 'XIII',
      title: 'The National Rector Charter',
      chapters: [
        {
          ordinal: 'THIRTY-SEVEN',
          title: 'Principles of the Office',
          blocks: [
            p('Every National Rector operates according to the following institutional '
              + 'principles:'),
            defs(
              { term: 'One University',
                text: 'The National Administration belongs to ICOF Global University.' },
              { term: 'One Academic Standard',
                text: 'Academic standards apply across the university.' },
              { term: 'Local Leadership',
                text: 'National communities are led by people who understand their national '
                  + 'environment.' },
              { term: 'Student First',
                text: 'Students remain the central purpose of the institution.' },
              { term: 'Academic Integrity',
                text: 'Academic work must be conducted with integrity.' },
              { term: 'Financial Accountability',
                text: 'National resources must be properly administered and reported.' },
              { term: 'Professional Leadership',
                text: 'The National Rector represents the university with professionalism.' },
              { term: 'Institutional Development',
                text: 'The National Rector is responsible for building a sustainable national '
                  + 'operation.' },
              { term: 'Global Collaboration',
                text: 'National Administrations remain connected to the wider ICOF academic '
                  + 'community.' },
            ),
          ],
        },
        {
          ordinal: 'THIRTY-EIGHT',
          title: 'The Responsibility of Leadership',
          blocks: [
            p('The National Rector receives meaningful authority.'),
            p('That authority carries corresponding responsibility.'),
            p('The Rector is responsible for:'),
            bullets(
              'protecting students', 'protecting the university’s reputation',
              'maintaining professional standards', 'following university regulations',
              'maintaining accurate administration', 'safeguarding financial resources',
              'recommending qualified staff', 'supporting academic quality',
              'reporting accurately',
              'respecting the authority of central university governance',
              'developing the national operation responsibly',
            ),
            lead('The purpose of delegated authority is to enable leadership — not to remove '
              + 'accountability.'),
          ],
        },
      ],
    },

    {
      ordinal: 'XIV',
      title: 'The Opportunity',
      chapters: [
        {
          ordinal: 'THIRTY-NINE',
          title: 'Building Something That Lasts',
          blocks: [
            p('The National Rector position is fundamentally an institutional development '
              + 'opportunity.'),
            p('The successful Rector builds an organization that can continue beyond its founding '
              + 'stage.'),
            p('The first student becomes part of a growing academic community.'),
            p('The first lecturer becomes part of a developing faculty.'),
            p('The first financial office becomes the foundation of national administration.'),
            p('The first academic seminar becomes part of a national academic culture.'),
            p('The first partnership becomes part of the university’s national network.'),
            p('The National Rector’s work is therefore measured not only by immediate activity, '
              + 'but by what the National Administration becomes.'),
          ],
        },
        {
          ordinal: 'FORTY',
          title: 'The National Rector’s Place in ICOF',
          blocks: [
            p('A National Rector is both locally established and globally connected.'),
            p('The Rector leads:'),
            lead('ICOF Global University — National Administration of [Country]'),
            p('while remaining part of:'),
            lead('ICOF Global University'),
            p('The national identity and global identity therefore operate together.'),
            lead('The National Rector has a country.'),
            lead('The university has a world.'),
          ],
        },
      ],
    },
  ],

  // -------------------------------------------------------------------------
  final: {
    label: 'Final Section',
    title: 'Application for National Rector',
    blocks: [
      lead('ICOF Global University'),
      lead('National Rector & Senior Lecturer'),
      fields('National Administration', 'Country'),

      h('Applicant Information'),
      fields(
        'Full Name', 'Academic Title', 'Current Institution', 'Country',
        'Academic Discipline', 'Highest Qualification', 'Years of Academic Experience',
        'Years of Leadership / Administrative Experience',
      ),

      h('Academic Profile'),
      instruction('Provide a summary of your academic career, teaching experience, research, '
        + 'publications, professional memberships and institutional responsibilities.'),

      h('Leadership Profile'),
      instruction('Describe the organizations, institutions, academic communities or '
        + 'professional networks you have led or developed.'),

      h('National Development Plan'),
      instruction('Provide your proposed plan for establishing and developing ICOF Global '
        + 'University within your country.'),
      p('Address:'),
      {
        kind: 'numbered',
        items: [
          { n: 1, title: 'Student recruitment' },
          { n: 2, title: 'Academic development' },
          { n: 3, title: 'Founding staff' },
          { n: 4, title: 'National partnerships' },
          { n: 5, title: 'Student support' },
          { n: 6, title: 'Financial sustainability' },
          { n: 7, title: 'First-year objectives' },
          { n: 8, title: 'Three-year development' },
          { n: 9, title: 'Long-term institutional development' },
        ],
      },

      h('Why You'),
      instruction('Explain why you are prepared to lead the ICOF National Administration in your '
        + 'country.'),

      h('Declaration'),
      p('I confirm that the information submitted in this application is accurate and complete.'),
      p('I understand that appointment as National Rector is subject to academic, professional, '
        + 'institutional and other requirements established by ICOF Global University.'),
      p('I understand that the National Rector operates within the authority delegated by ICOF '
        + 'Global University and is responsible for maintaining the standards and integrity of '
        + 'the university within the National Administration.'),
      fields('Applicant Signature', 'Date'),
    ],
  },

  // -------------------------------------------------------------------------
  colophon: {
    title: 'National Rector Programme',
    strapline: 'One University. One Academic Standard. Many Nations.',
    blocks: [
      p('ICOF Global University is establishing a network of National Administrations led by '
        + 'qualified academic and educational leaders.'),
      lead('The National Rector provides the leadership.'),
      lead('The National Administration provides the national academic community.'),
      lead('The global university provides the academic and technological infrastructure.'),
      p('Students gain access to a university that extends beyond national borders.'),
      p('Applications for National Rector are considered on the basis of academic qualification, '
        + 'leadership capacity, institutional vision, professional integrity and the applicant’s '
        + 'ability to develop a sustainable national academic community.'),
      h('Application for National Rector'),
      fields('National Administration of', 'Applicant'),
    ],
  },
};


/**
 * Every chapter in reading order, with the part it belongs to.
 *
 * The table of contents needs this and so does the test that checks nothing was
 * dropped between the University's text and the printed book.
 */
export function chaptersInOrder(book: Book = NATIONAL_RECTOR):
{ part: Part; chapter: Chapter; number: number }[] {
  const out: { part: Part; chapter: Chapter; number: number }[] = [];
  let n = 0;
  for (const part of book.parts) {
    for (const chapter of part.chapters) out.push({ part, chapter, number: ++n });
  }
  return out;
}
