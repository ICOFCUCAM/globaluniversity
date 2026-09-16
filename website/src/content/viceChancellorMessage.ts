// ---------------------------------------------------------------------------
// THE VICE-CHANCELLOR'S MESSAGE IN THE NATIONAL RECTOR PROSPECTUS.
//
// ---------------------------------------------------------------------------
// THIS IS DRAFT COPY. IT IS NOT YET THE VICE-CHANCELLOR'S OWN WORDS.
// ---------------------------------------------------------------------------
//
// The University asked, on 16 September 2026:
//
//     "look at the webpage and write something captivating from the vc"
//
// So this was written, from the University's own published material, to read in
// the Vice-Chancellor's voice WITHOUT INVENTING ANYTHING ABOUT HIM OR ABOUT THE
// UNIVERSITY. It is offered for his approval. He should read it, change
// whatever he wants changed, and either sign it or replace it entirely — and
// when he does, this one file is the only thing that needs editing.
//
// `src/content/welcome.ts` made exactly this arrangement for the Chancellor's
// address and says why: "It is isolated here so the university can paste the
// Chancellor's own words over it in a single edit, without touching any layout
// code."
//
// SEPARATE FROM `nationalRector.ts` ON PURPOSE. That file is the University's
// own text, supplied whole. This is text drafted for them. Running the two
// together in one file would lose the distinction inside a week, and the
// distinction is the whole reason this comment exists — the prospectus test
// counts the two sources separately so that the boundary is measured rather
// than remembered.
//
// ---------------------------------------------------------------------------
// EVERY FACT IN IT, AND WHERE IT COMES FROM
// ---------------------------------------------------------------------------
//
// Nothing below is asserted that the University has not already published.
// Checked line by line against:
//
//   · `src/content/site.ts`         — the mission statement, verbatim in the
//                                     third paragraph; the name, the tagline
//                                     "The Community University"; the
//                                     International Circle of Faith
//                                     affiliation; the Vice-Chancellor's entry
//                                     in `leadership`.
//   · `src/lib/constants.ts`        — the motto, "Nobility, Professionalism &
//                                     Godliness"; the year 2007; vc@iguc.net.
//   · `src/content/universityPlaces.json` — where the University teaches, in
//                                     the words that file uses and with the
//                                     distinctions it insists on: Cameroon has
//                                     campuses; Nigeria is a professional
//                                     development and research centre AND NOT A
//                                     TEACHING CAMPUS; the United States,
//                                     Zambia and South Africa are an
//                                     in-country teaching presence; and online
//                                     worldwide.
//   · `src/content/nationalRector.ts` — the argument of the prospectus itself.
//
// WHAT IS DELIBERATELY ABSENT. No student number. No number of countries. No
// graduate outcome. No ranking. No promise of income. No claim about how many
// National Administrations exist, because none has been established yet and a
// prospectus that implied otherwise would be the first thing a candidate
// discovered was untrue.
// ---------------------------------------------------------------------------

export interface Signed {
  name: string;
  role: string;
  email: string;
  /** Under the signature. What the office is, not what the person has done. */
  office: string;
  title: string;
  paragraphs: string[];
  /** The line the message ends on, set apart. */
  close: string;
}

export const VICE_CHANCELLORS_MESSAGE: Signed = {
  name: 'Prof Chamayah Meyembi',
  role: 'Vice-Chancellor',
  email: 'vc@iguc.net',
  office: 'ICOF Global University',
  title: 'A Letter to the Person Who Will Build It',

  paragraphs: [
    'There is a particular person I hope is reading this, and I would rather describe them '
    + 'than describe the post.',

    'You have taught for years. You know, by name, the students whose lives changed because '
    + 'somebody admitted them — and you know the ones who were never admitted at all, who had '
    + 'the calling and the capacity and never the door. You have sat in meetings where the '
    + 'obstacle was not talent and was not need, but that no institution had yet been built in '
    + 'the place where the talent was. And more than once, you have thought that somebody ought '
    + 'to build one.',

    'This university exists for that reason. We provide access to higher education '
    + 'opportunities that enable students to develop the knowledge and skills necessary to '
    + 'achieve their professional goals, improve the performance of their organizations, and '
    + 'provide leadership and service to their communities. That is our purpose, stated plainly, '
    + 'and it is the only justification a university needs.',

    'We call ourselves the Community University. It is a description of where our graduates '
    + 'go, not a slogan for a wall. We stand within the International Circle of Faith, we have '
    + 'taught under the Ministry of Higher Education since 2007, and we hold that rigorous '
    + 'scholarship and formed character are not rivals.',

    'Today we teach from our campuses in Cameroon, at Buea and Douala. We have an authorised '
    + 'academic presence in the United States, in Zambia and in South Africa. We run a '
    + 'professional development and research centre in Nigeria — a centre, not a campus, and I '
    + 'name the difference because a university that blurs it once will blur everything. And we '
    + 'teach online to students wherever they are, because geography has stopped being a good '
    + 'reason to refuse somebody an education.',

    'What we do not yet have, in most of the world, is a person.',

    'That is what the office of National Rector is. Not an agency. Not a franchise. Not a '
    + 'commission on recruitment. The National Rector is an officer of this university, holding '
    + 'the university’s authority within a nation, building the university’s academic community '
    + 'there, and — where qualified — teaching in it. You will receive the framework: the '
    + 'programmes, the standards, the systems, the degrees, the technology, and a faculty that '
    + 'already spans borders. You will not receive the students. You will have to find the '
    + 'first one yourself, and then the first lecturer, and then the first colleague who '
    + 'believes it can be done in your country.',

    'I will be honest about the first year, because a prospectus that is not honest about the '
    + 'first year is selling something. It is the hard one. There is no cohort to inherit and no '
    + 'reputation to borrow. What there is, is an institution behind you that has done this '
    + 'before, systems that work on the day you are given them, and the plain fact that the '
    + 'people you are trying to reach are already there and already waiting.',

    'Our motto is Nobility, Professionalism and Godliness. We mean all three of them, and we '
    + 'will hold you to all three. The authority this office carries is real, and so is the '
    + 'accountability that comes with it. We are not looking for a representative. We are '
    + 'looking for a builder we can trust with the university’s name in a country we cannot '
    + 'reach without them.',

    'Read the prospectus. It sets out the office, the administration, the academic role, the '
    + 'financial arrangement and the appointment process in full, and the application form is at '
    + 'the back of it. Do not send it to me half-finished; I would rather wait a month for a '
    + 'National Development Plan you have actually thought about.',
  ],

  close: 'If, having read this, you already know the name of the first colleague you would '
    + 'call — then this letter has found the person it was written for. Write to me.',
};


// ---------------------------------------------------------------------------
// AND THE HANDBOOK'S FOREWORD, UNDER THE SAME RULE.
//
// The System Handbook opens over the Vice-Chancellor's name, because a document
// that tells every office in the University what it may and may not do is not
// the software's statement about itself — it is the University's statement, and
// it has to be signed by somebody who can make it.
//
// SO THIS IS DRAFT COPY AWAITING PROF MEYEMBI'S APPROVAL, exactly as the
// message above it is. It is in this file rather than in `systemHandbook.ts`
// for that reason and no other: this file is where the things drafted FOR him
// live, and keeping the line between "the University wrote this" and "this was
// drafted for the University" in one place is what stops it being forgotten.
//
// `handbook.test.mjs` counts these words separately for the same reason.
// ---------------------------------------------------------------------------

export const HANDBOOK_FOREWORD: Signed = {
  name: 'Prof Chamayah Meyembi',
  role: 'Vice-Chancellor',
  email: 'vc@iguc.net',
  office: 'Office of the Vice-Chancellor',
  title: 'On the authority of this handbook',

  paragraphs: [
    'A university runs on people knowing what they may do. Not what they are able to do — what '
    + 'they may. The distance between those two is where institutions lose themselves, and it '
    + 'is usually not lost in a single dramatic act. It is lost in a hundred small ones by '
    + 'people who meant well and did not know.',

    'This handbook closes that distance. It states what every office in this University may do, '
    + 'what it may not, and where the line between the two is drawn — and it does not state it '
    + 'from memory. The parts that describe authority are read out of the system itself every '
    + 'time this document is rebuilt. If a permission moves, this handbook says so on its next '
    + 'printing, whether or not anybody remembered to amend it.',

    'That matters more than it may appear. A handbook that describes a system it has drifted '
    + 'away from is worse than no handbook, because it is quoted. An officer holding a document '
    + 'with the Vice-Chancellor’s name on the front is entitled to assume it is true, and I am '
    + 'not willing to sign one that relies on somebody having remembered.',

    'You will find that several offices in this University are deliberately prevented from '
    + 'doing things they could easily be trusted with. The Registrar cannot see the certificate '
    + 'design. The officer who records an expense cannot authorise it. The person who drafts an '
    + 'appointment cannot approve it. None of these is a comment on the people holding those '
    + 'offices. They are what allows us to say, of any document this University has issued, '
    + 'that more than one person stood behind it — and to say it about a document issued five '
    + 'years ago by people who have since left.',

    'Read Part Two before you act in an office you are new to, and Part Eight before you tell '
    + 'anybody what the system will and will not permit. If something here is wrong, it is '
    + 'either wrong in the system too, in which case tell me, or it is written rather than '
    + 'read, in which case tell me and we will correct it.',
  ],

  close: 'Nobility, Professionalism and Godliness — and the first of those begins with knowing '
    + 'the limits of your own office, and keeping them when nobody is looking.',
};
