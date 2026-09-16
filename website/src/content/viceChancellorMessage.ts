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
