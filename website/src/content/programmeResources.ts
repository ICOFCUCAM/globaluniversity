// ---------------------------------------------------------------------------
// STUDENT-ONLY PROGRAMME RESOURCES
//
// This module is imported ONLY by components rendered inside the authenticated
// portal (/portal). It must never be imported by a route under src/app that
// renders publicly — doing so would ship the reading list into the static HTML
// of an open page, where anyone could read it without enrolling.
//
// Why the reading list is gated rather than published:
//   · a prescribed reading list is part of what a student pays for, and it is
//     the most-copied element of any curriculum;
//   · titles here are marked "suggested" and are still under review, so
//     publishing them would advertise a list the university may change;
//   · book lists date quickly, and a stale one on the open site reads worse
//     than none at all.
//
// The course codes, titles, topics and learning outcomes are NOT gated — those
// are prospectus material and live in blackLiberationTheology.ts.
//
// HONEST LIMIT OF THIS GATE. Verified against the build: this list appears in
// no public HTML page, and in none of the JS chunks a public page loads. It is
// in a lazily-loaded portal chunk, so it is not in the initial /portal payload
// either. That means it is not published, not indexed and not casually
// discoverable — which is the right bar for a reading list.
//
// It is NOT a hard secret. Anyone who found the chunk URL could fetch it
// without signing in, because it is still client-side code. If anything truly
// confidential is ever added here — assessment weightings, marking rubrics,
// exam material, named placement contacts — it must move out of this file and
// be fetched at runtime from the database behind a row-level-security policy,
// the way announcements and question banks already are.
// ---------------------------------------------------------------------------

export interface ReadingGroup {
  area: string;
  works: { title: string; author?: string }[];
}

export const bltReadingList: ReadingGroup[] = [
  {
    area: 'Systematic Theology',
    works: [
      { title: 'Christian Theology', author: 'Millard J. Erickson' },
      { title: 'Systematic Theology', author: 'Wayne Grudem' },
      { title: 'Systematic Theology', author: 'John Frame' },
    ],
  },
  {
    area: 'Black Theology',
    works: [
      { title: 'A Black Theology of Liberation' },
      { title: 'Black Theology and Black Power' },
      { title: 'Jesus and the Disinherited' },
    ],
  },
  {
    area: 'African Theology',
    works: [
      { title: 'African Religions and Philosophy' },
      { title: 'Theology Brewed in an African Pot' },
      { title: 'Introduction to African Religion' },
    ],
  },
  {
    area: 'Biblical Studies',
    works: [
      { title: 'The Hebrew Bible (Old Testament)' },
      { title: 'The Greek New Testament' },
      { title: 'Biblical dictionaries, lexicons, and commentaries' },
    ],
  },
];

export const readingListNote =
  'Suggested core texts, provided to enrolled students. This list is under academic review and may be revised before each intake — always check here rather than relying on a saved copy.';

// --- The Black Hebrews (course) — recommended reading ----------------------
// Gated for the same reasons as the M.A. list, plus one specific to this
// course: several of these titles are contested within mainstream biblical
// scholarship and are set here as primary sources for critical examination,
// not as settled fact. Read without the seminar around them — which is what a
// public bibliography invites — they read as the university's endorsement.

export const blackHebrewsReading: ReadingGroup[] = [
  {
    area: 'Recommended Reading',
    works: [
      { title: 'From Babylon to Timbuktu: A History of the Ancient Black Races Including the Black Hebrews', author: 'Rudolph R. Windsor' },
      { title: 'Hebrewisms of West Africa: From Nile to Niger with the Jews', author: 'Joseph J. Williams' },
      { title: 'The Black Biblical Heritage', author: 'John L. Johnson' },
      { title: "We the Black Jews: Witness to the 'White Jewish Race' Myth Volume I", author: 'Yosef A.A. Ben-Jochannan' },
    ],
  },
];

export const blackHebrewsReadingNote =
  'Set texts for critical examination in seminar. Several of these works advance claims that are contested within mainstream biblical scholarship; the course requires you to weigh them against the archaeological and historical evidence rather than to accept them.';

// --- Master of Theology — selected reading list ----------------------------

export const mthReading: ReadingGroup[] = [
  {
    area: 'Biblical Theology',
    works: [
      { title: 'Theology and Identity: The Impact of Culture upon Christian Thought in the Second Century and in Modern Africa (1992). Oxford: Regnum Books.', author: 'Bediako, K.' },
      { title: 'Essays in Contextual Theology (2018). Leiden: Brill.', author: 'Bevans, S. B.' },
    ],
  },
  {
    area: 'African Theology',
    works: [
      { title: "Introducing African Women's Theology (2001). Sheffield: Sheffield Academic Press.", author: 'Oduyoye, M. A.' },
      { title: 'Homosexuality, Ubuntu, and Otherness in the African Church (2016).', author: 'Bongmba, E.' },
    ],
  },
  {
    area: 'Ecotheology',
    works: [
      { title: 'A Primer in Ecotheology: Theology for a Fragile Earth (2017). Eugene, OR: Cascade.', author: 'Deane-Drummond, C.' },
      { title: 'Christian Mission and Earth Care: An African Case Study (2015). Oxford: Regnum Books.', author: 'Daneel, M.' },
    ],
  },
  {
    area: 'Disability Theology',
    works: [
      { title: 'The Bible, Disability, and the Church: A New Vision of the People of God (2011). Grand Rapids: Eerdmans.', author: 'Yong, A.' },
      { title: 'Lazarus, Come Out!: How Contextual Bible Study Can Empower the Disabled (2011).', author: 'Lees, J.' },
    ],
  },
];

export const mthReadingNote =
  'Selected reading for the Master of Theology. Provided to enrolled students; check here each semester rather than relying on a saved copy.';
