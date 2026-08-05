// Black Liberation Theology — the university's flagship theological programme.
//
// The prose below is supplied by the university and is reproduced verbatim.
// Do not paraphrase, condense or "tidy" it: the terminology is deliberate,
// including the divine name Yahuah. Section headings and pull quotes are
// editorial additions for the page layout only; every sentence of the body is
// the university's own text, in its original order.

export interface BltSection {
  /** Short editorial label used for the page's side index. */
  heading: string;
  paragraphs: string[];
}

export const bltIntro =
  'Human liberation cannot be fully realized without addressing the historical and ongoing oppression of Black people across the world. For centuries, slavery, colonialism, racism, apartheid, and neo-colonialism have shaped political, economic, cultural, educational, and religious systems that continue to influence societies today. Any theological vision that seeks the complete liberation of humanity must therefore confront these realities rather than treat them as secondary concerns.';

export const bltPullQuote =
  'Black Liberation Theology is not merely a theology for Black people; it is a theology for the liberation of all humanity.';

export const bltSections: BltSection[] = [
  {
    heading: 'A Foundation for Human Liberation',
    paragraphs: [
      'Black Liberation Theology begins with the conviction that the liberation of Black people is inseparable from the liberation of humanity itself. It recognizes that the struggle for justice extends beyond politics and economics to include the spiritual, intellectual, historical, and theological dimensions of human existence. Humanity cannot attain genuine freedom while millions remain bound by systems of oppression, distorted historical narratives, and theological interpretations that have legitimized inequality and injustice.',
    ],
  },
  {
    heading: 'Scripture, Africa and the Black World',
    paragraphs: [
      'This theological framework further argues that a faithful understanding of the Bible requires serious engagement with the historical, cultural, and geographical contexts of Africa and the wider Black world. It explores the relationship between the biblical narrative and African civilizations, seeking to recover historical perspectives that have often been overlooked, marginalized, or excluded from mainstream theological scholarship. By revisiting these perspectives, Black Liberation Theology seeks a fuller understanding of Scripture and its message of justice, restoration, and redemption.',
    ],
  },
  {
    heading: 'Salvific and Epistemological Liberation',
    paragraphs: [
      'From this perspective, the emancipation of Black people is fundamental to humanity’s liberation from both a salvific and an epistemological standpoint. Salvation is not limited to the redemption of the soul; it includes the restoration of human dignity, identity, justice, truth, and reconciliation. Likewise, epistemological liberation seeks to free humanity from systems of knowledge that have distorted history, minimized the contributions of Black civilizations, and perpetuated intellectual dependency and cultural alienation.',
    ],
  },
  {
    heading: 'Reclaiming Theology as a Force for Justice',
    paragraphs: [
      'Theology and religion have profoundly shaped civilizations throughout history. While they possess the power to reconcile humanity with Yahuah and promote justice, peace, and righteousness, they have also been manipulated to justify slavery, colonial expansion, racial hierarchy, and exploitation. Black Liberation Theology calls for a critical re-examination of these theological traditions so that theology once again becomes a force for truth, justice, reconciliation, and human flourishing rather than an instrument of oppression.',
    ],
  },
  {
    heading: 'A Renewed Engagement with Africa',
    paragraphs: [
      'To achieve this renewal, Black Liberation Theology calls for a renewed engagement with Africa—the cradle of humanity and one of the principal settings for understanding the origins of civilization and much of the biblical world. It argues that Africa’s historical, cultural, and spiritual significance deserves far greater attention within theological scholarship. Rather than approaching Africa solely through political, ideological, or colonial frameworks, Black Liberation Theology proposes a holistic theological vision that integrates biblical revelation, history, archaeology, anthropology, culture, and social justice.',
    ],
  },
  {
    heading: 'A Theology for All Humanity',
    paragraphs: [
      'Black Liberation Theology is not merely a theology for Black people; it is a theology for the liberation of all humanity. It maintains that when truth is restored, justice is pursued, and the dignity of historically oppressed peoples is affirmed, the entire human family benefits. The liberation of Black people therefore becomes a pathway toward a more just, reconciled, and flourishing world.',
    ],
  },
];

export const bltCommitment = {
  heading: 'The University’s Commitment',
  paragraphs: [
    'ICOF Global University is committed to advancing this vision through innovative theological education, research, and scholarship. By pioneering Black Liberation Theology as an academic discipline, the university seeks to equip scholars, ministers, researchers, policymakers, and community leaders with the knowledge and tools necessary to transform society through biblical truth, historical recovery, intellectual freedom, and holistic human liberation.',
    'Students from every nation are invited to become part of this transformative movement by pursuing a Master’s degree in Black Liberation Theology and related programmes. More than earning a degree, students will join a global academic community dedicated to restoring truth, advancing justice, and contributing to the liberation and renewal of humanity.',
  ],
};

/** The disciplines the programme deliberately draws together. */
export const bltDisciplines = [
  'Biblical revelation',
  'History',
  'Archaeology',
  'Anthropology',
  'Culture',
  'Social justice',
];

/** Who the university states the programme is designed to equip. */
export const bltAudience = [
  'Scholars',
  'Ministers',
  'Researchers',
  'Policymakers',
  'Community leaders',
];

// ---------------------------------------------------------------------------
// PUBLIC CURRICULUM
//
// Everything below this line is prospectus material and is safe on the open
// site: course codes, titles, topic outlines, credit weight, learning
// outcomes, practical requirements. Universities publish all of this — a
// prospective student cannot choose a degree they are not allowed to read.
//
// What deliberately does NOT live here:
//   · the suggested core textbook list  → src/content/programmeResources.ts,
//     rendered only inside the authenticated portal
//   · the internal structuring memo      → docs/BLT-PROGRAMME-PLANNING.md,
//     never rendered by any route
// ---------------------------------------------------------------------------

export interface BltModule {
  code: string;
  title: string;
  topics: string[];
  /** Set where the module is a choice rather than a taught topic list. */
  note?: string;
}

export interface BltSemester {
  year: 'Year One' | 'Year Two';
  label: string;
  modules: BltModule[];
}

export const bltProgramme = {
  award: 'Master of Arts (M.A.) in Black Liberation Theology',
  duration: '2 years',
  structure: '4 semesters',
  credits: '120 ECTS (or equivalent)',
  overview: [
    'The Master of Arts in Black Liberation Theology is a multidisciplinary postgraduate degree that examines theology through the historical, biblical, philosophical, cultural, and socio-political experiences of Black people. The programme seeks to equip scholars, ministers, educators, researchers, policymakers, and community leaders to interpret Scripture within its historical context while addressing contemporary issues of justice, identity, reconciliation, and human liberation.',
    'The programme integrates Systematic Theology, Biblical Studies, Church History, African History, Hermeneutics, Ethics, Philosophy, Leadership, and Social Transformation into one coherent theological framework.',
  ],
};

/** The five pillars running through every course. */
export const bltPillars = [
  {
    name: 'Biblical Theology',
    body: 'Interpreting Scripture within its historical and literary contexts.',
  },
  {
    name: 'Historical Theology',
    body: 'Examining the development of doctrine and the role of Africa and Black communities in Christian history.',
  },
  {
    name: 'Systematic Theology',
    body: 'Formulating coherent doctrines centered on Yahuah, Yahusha, humanity, salvation, and the Assembly.',
  },
  {
    name: 'Black Liberation Theology',
    body: 'Addressing identity, justice, liberation, and the historical experiences of Black people through a theological lens.',
  },
  {
    name: 'Applied Theology',
    body: 'Equipping graduates to engage in ministry, education, public leadership, reconciliation, and social transformation.',
  },
];

export const bltCurriculum: BltSemester[] = [
  {
    year: 'Year One',
    label: 'Semester One',
    modules: [
      {
        code: 'BLT 501',
        title: 'Introduction to Black Liberation Theology',
        topics: ['History and Development', 'Definitions and Scope', 'Major Thinkers', 'Theology and Liberation', 'Contemporary Challenges'],
      },
      {
        code: 'BLT 502',
        title: 'Old Testament Foundations',
        topics: ['Africa in the Old Testament', 'Biblical Geography', 'Hebrew Worldview', 'Covenants', 'Law and Justice'],
      },
      {
        code: 'BLT 503',
        title: 'New Testament Foundations',
        topics: ['Yahusha and the Kingdom', 'Liberation in the Gospels', 'Pauline Theology', 'Early Assembly', 'Mission and Justice'],
      },
      {
        code: 'BLT 504',
        title: 'Systematic Theology I',
        topics: ['Doctrine of Yahuah', 'Divine Revelation', 'Creation', 'Humanity', 'Sin', 'Covenant Theology'],
      },
      {
        code: 'BLT 505',
        title: 'Biblical Hermeneutics',
        topics: ['Principles of Interpretation', 'Historical Context', 'Literary Analysis', 'African Biblical Interpretation', 'Contemporary Application'],
      },
      {
        code: 'BLT 506',
        title: 'Academic Research Methods',
        topics: ['Research Design', 'Academic Writing', 'Citation Systems', 'Literature Review', 'Qualitative Research'],
      },
    ],
  },
  {
    year: 'Year One',
    label: 'Semester Two',
    modules: [
      {
        code: 'BLT 511',
        title: 'Systematic Theology II',
        topics: ['Yahusha the Messiah', 'Salvation', 'The Set-Apart Spirit', 'The Assembly', 'Eschatology'],
      },
      {
        code: 'BLT 512',
        title: 'African History and Biblical Civilization',
        topics: ['Ancient Africa', 'Nile Valley Civilizations', 'Cush', 'Egypt', 'Ethiopia', 'Kingdoms of Africa'],
      },
      {
        code: 'BLT 513',
        title: 'History of Christianity in Africa',
        topics: ['Early African Church', 'Desert Fathers', 'Ethiopian Christianity', 'North African Christianity', 'Colonial Missions'],
      },
      {
        code: 'BLT 514',
        title: 'Philosophy and Black Consciousness',
        topics: ['African Philosophy', 'Identity', 'Human Dignity', 'Liberation Philosophy', 'Epistemology'],
      },
      {
        code: 'BLT 515',
        title: 'Theology and Social Justice',
        topics: ['Poverty', 'Racism', 'Colonialism', 'Neo-colonialism', 'Human Rights', 'Public Theology'],
      },
      {
        code: 'BLT 516',
        title: 'Seminar I',
        topics: [],
        note: 'Students present theological research papers.',
      },
    ],
  },
  {
    year: 'Year Two',
    label: 'Semester Three',
    modules: [
      {
        code: 'BLT 601',
        title: 'Advanced Black Liberation Theology',
        topics: ['Contemporary Issues', 'Global Black Experience', 'Liberation Models', 'Comparative Theology'],
      },
      {
        code: 'BLT 602',
        title: 'Biblical Languages',
        topics: ['Biblical Hebrew', 'Biblical Greek'],
        note: 'Choose one.',
      },
      {
        code: 'BLT 603',
        title: 'Theology and Leadership',
        topics: ['Servant Leadership', 'Church Administration', 'Organizational Development', 'Conflict Resolution', 'Strategic Planning'],
      },
      {
        code: 'BLT 604',
        title: 'Ethics and Public Policy',
        topics: ['Christian Ethics', 'Government', 'Economics', 'Justice', 'Human Development'],
      },
      {
        code: 'BLT 605',
        title: 'African Indigenous Knowledge Systems',
        topics: ['African Cosmology', 'Traditional Religion', 'Indigenous Ethics', 'Community', 'Oral Traditions'],
      },
      {
        code: 'BLT 606',
        title: 'Seminar II',
        topics: [],
        note: 'Conference presentations and publication preparation.',
      },
    ],
  },
  {
    year: 'Year Two',
    label: 'Semester Four',
    modules: [
      {
        code: 'BLT 691',
        title: 'Master’s Dissertation',
        topics: [],
        note: 'Original research (25,000–40,000 words). Students defend their dissertation before an academic panel.',
      },
    ],
  },
];

/** Students choose four. */
export const bltElectives = [
  'Women in Black Theology',
  'Comparative Religion',
  'Archaeology and the Bible',
  'Hebrew Language II',
  'Greek Language II',
  'Church Planting',
  'Pastoral Counselling',
  'Peace and Conflict Studies',
  'African Political Theology',
  'Theology of Development',
  'Human Rights Law',
  'Theology of Education',
  'Missiology',
  'Digital Theology',
  'Media and Religion',
  'African Economic Systems',
  'Biblical Archaeology',
  'Environmental Theology',
  'Theology of Migration',
  'Religion and International Relations',
];

export const bltPracticals = [
  'Community engagement project',
  'Teaching practicum',
  'Research publication',
  'Academic conference presentation',
  'Ministry placement',
  'Leadership internship',
];

export const bltOutcomes = [
  'Demonstrate advanced knowledge of Black Liberation Theology.',
  'Interpret biblical texts using sound historical and theological methods.',
  'Critically evaluate theological traditions and their social implications.',
  'Conduct independent academic research.',
  'Develop theological responses to contemporary global issues.',
  'Lead faith-based and community organizations effectively.',
  'Publish scholarly work in theology and related disciplines.',
  'Apply theology to reconciliation, justice, peacebuilding, and community transformation.',
];
