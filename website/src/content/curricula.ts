// ---------------------------------------------------------------------------
// Course lists with codes and credit values, as supplied by the university.
//
// This is the first time any programme on this site has carried real course
// codes and credit values, which is what a programme handbook is built from
// and what a credential evaluator asks for.
//
// SETTLED. The Bachelor of Theology was specified twice, in two incompatible
// systems. The university has confirmed that the 180-ECTS structure governs
// the award. The credit-hour listing below is retained as a supplementary
// course listing — it carries course codes and descriptions the ECTS structure
// does not — but it does not determine the credit a student earns.
//
//   Earlier    36 courses, six per semester across six semesters, every course
//              worth 5 ECTS, totalling 180 ECTS. Published at
//              /bachelor-of-theology and held in bachelorOfTheology.ts.
//   Now        Year 1 and Year 2 listed course by course with US-style credit
//              hours, mostly 3 and occasionally 2, seven or eight courses per
//              semester. Year 3 was not supplied.
//
// The two are still not converted into one another. 180 ECTS is the award;
// the credit hours here describe the same teaching under a different
// accounting, and an invented conversion factor between them would be the one
// number a credential evaluator would reject. The university should state the
// ECTS value of each course in this listing when it is next revised.
// ---------------------------------------------------------------------------

export interface CurriculumCourse {
  code: string;
  title: string;
  credits?: number;
  description?: string;
  objectives?: string[];
}

export interface CurriculumTerm {
  label: string;
  courses: CurriculumCourse[];
}

export interface Curriculum {
  /** Slug of the programme in `programs` this curriculum belongs to. */
  programSlug: string;
  title: string;
  duration: string;
  creditUnit: 'credit hours' | 'ECTS';
  intro?: string[];
  objectives?: string[];
  terms: CurriculumTerm[];
  /** Named where the university supplied a reading list. */
  textbooks?: string[];
  /** Set where the source is incomplete or contested. */
  note?: string;
}

// --- Diploma of Theology ---------------------------------------------------
// Complete as supplied: one year, two semesters, fifteen courses with codes,
// descriptions and objectives. No credit values were given for this programme.

export const diplomaOfTheologyCurriculum: Curriculum = {
  programSlug: 'diploma-in-theology',
  title: 'Diploma of Theology',
  duration: '1 year',
  creditUnit: 'credit hours',
  intro: [
    'The Diploma of Theology at ICOF Global University is designed to provide students with a foundational understanding of Christian theology, biblical studies, and practical ministry skills. This program combines academic rigor with practical application, preparing students for various roles in ministry and church leadership.',
    'Through a comprehensive curriculum, students will engage with core theological concepts, develop skills in biblical interpretation, and understand the historical and contemporary contexts of Christian faith.',
  ],
  objectives: [
    'Equip students with a foundational knowledge of Christian doctrines and biblical studies.',
    'Develop skills in interpreting and applying biblical texts.',
    'Provide an understanding of the historical development of the Christian church.',
    'Prepare students for effective ministry and evangelism.',
    'Foster ethical and theological reflection on contemporary issues in ministry.',
  ],
  note:
    'Credit values were not supplied for this programme. The fifteen courses below are complete and carry the university’s own codes, descriptions and objectives.',
  terms: [
    {
      label: 'Semester One',
      courses: [
        {
          code: 'BIS 250',
          title: 'Bible Doctrine I',
          description:
            'An introduction to the fundamental doctrines of the Christian faith, including the nature of God, the Trinity, creation, sin, and salvation.',
          objectives: [
            'Understand key Christian doctrines and their biblical foundations.',
            'Analyze the historical development and theological significance of core doctrines.',
            'Apply doctrinal knowledge to contemporary Christian life and ministry.',
          ],
        },
        {
          code: 'MW 300',
          title: 'Evangelism (Intro)',
          description:
            'A foundational course on the principles and practices of evangelism, exploring various methods and strategies for sharing the Christian faith.',
          objectives: [
            'Understand the biblical basis for evangelism.',
            'Develop practical skills for effective evangelistic outreach.',
            'Evaluate different evangelistic approaches and their effectiveness.',
          ],
        },
        {
          code: 'CH 200',
          title: 'Church History',
          description:
            'A survey of the history of the Christian church from its inception to the present day, focusing on key events, figures, and movements.',
          objectives: [
            'Trace the development of the Christian church through different historical periods.',
            'Identify significant figures and events that shaped church history.',
            'Analyze the impact of historical developments on contemporary Christianity.',
          ],
        },
        {
          code: 'EN 101',
          title: 'Use of English',
          description:
            'A course designed to enhance students’ proficiency in English, focusing on grammar, composition, and effective communication skills.',
          objectives: [
            'Improve grammar and writing skills.',
            'Develop effective oral and written communication abilities.',
            'Apply English proficiency to academic and ministry contexts.',
          ],
        },
        {
          code: 'OTH 300',
          title: 'Old Testament History',
          description:
            'An overview of the historical books of the Old Testament, exploring the history of Israel from the conquest of Canaan to the post-exilic period.',
          objectives: [
            'Understand the historical context of the Old Testament narrative.',
            'Analyze key events and figures in Israel’s history.',
            'Apply historical insights to the interpretation of Old Testament texts.',
          ],
        },
        {
          code: 'LC 110',
          title: 'Christology I',
          description:
            'An in-depth study of the person and work of Jesus Christ, examining biblical, historical, and theological perspectives on Christology.',
          objectives: [
            'Understand the biblical foundations of Christology.',
            'Explore historical debates and developments in the understanding of Christ.',
            'Articulate a coherent Christological perspective.',
          ],
        },
      ],
    },
    {
      label: 'Semester Two',
      courses: [
        {
          code: 'MDS 760',
          title: 'Demonology',
          description:
            'A study of the biblical and theological understanding of demons, spiritual warfare, and the believer’s authority in Christ.',
          objectives: [
            'Understand the biblical teachings on demons and spiritual warfare.',
            'Analyze different theological perspectives on demonology.',
            'Develop practical approaches to spiritual warfare in ministry.',
          ],
        },
        {
          code: 'MW 350',
          title: 'Missiology',
          description:
            'An introduction to the study of Christian mission, exploring biblical foundations, historical developments, and contemporary practices.',
          objectives: [
            'Understand the biblical basis for mission.',
            'Analyze historical and contemporary mission strategies.',
            'Develop practical skills for cross-cultural ministry.',
          ],
        },
        {
          code: 'BL 300',
          title: 'Epistle I',
          description:
            'A study of selected New Testament epistles, focusing on their historical context, theological themes, and practical application.',
          objectives: [
            'Understand the historical context and purpose of the epistles.',
            'Analyze key theological themes in the epistles.',
            'Apply the teachings of the epistles to contemporary Christian life.',
          ],
        },
        {
          code: 'CED 180',
          title: 'Soteriology I',
          description:
            'An exploration of the doctrine of salvation, examining biblical teachings, historical developments, and contemporary theological perspectives.',
          objectives: [
            'Understand the biblical foundations of salvation.',
            'Analyze different theological perspectives on soteriology.',
            'Articulate a coherent understanding of the doctrine of salvation.',
          ],
        },
        {
          code: 'MDS 640',
          title: 'Ministerial Ethics',
          description:
            'A course on the ethical issues faced in ministry, exploring biblical principles, ethical theories, and practical applications.',
          objectives: [
            'Understand the ethical principles relevant to Christian ministry.',
            'Analyze ethical dilemmas and develop appropriate responses.',
            'Apply ethical principles to real-life ministry situations.',
          ],
        },
        {
          code: 'NT 330',
          title: 'Romans',
          description:
            'An in-depth study of the Epistle to the Romans, focusing on its historical context, theological themes, and contemporary relevance.',
          objectives: [
            'Understand the historical and cultural context of Romans.',
            'Analyze key theological themes in the epistle.',
            'Apply the teachings of Romans to contemporary Christian life and ministry.',
          ],
        },
        {
          code: 'OT 300',
          title: 'Pentateuch',
          description:
            'A study of the first five books of the Old Testament, exploring their historical context, literary features, and theological significance.',
          objectives: [
            'Understand the historical and literary context of the Pentateuch.',
            'Analyze key themes and narratives in the Pentateuch.',
            'Apply the teachings of the Pentateuch to contemporary faith and practice.',
          ],
        },
        {
          code: 'BL 160',
          title: 'Tabernacle',
          description:
            'A detailed study of the Old Testament Tabernacle, examining its construction, significance, and typological relevance to the New Testament.',
          objectives: [
            'Understand the design and function of the Tabernacle.',
            'Analyze the theological significance of the Tabernacle.',
            'Explore the typological connections between the Tabernacle and New Testament teachings.',
          ],
        },
        {
          code: 'MDS 880',
          title: 'Faith',
          description:
            'An exploration of the biblical concept of faith, examining its definition, development, and practical application in the life of the believer.',
          objectives: [
            'Understand the biblical foundations of faith.',
            'Analyze the development of faith in biblical characters.',
            'Apply the principles of faith to personal and communal Christian life.',
          ],
        },
      ],
    },
  ],
  textbooks: [
    'Wayne Grudem, Bible Doctrine',
    'Justo L. González, The Story of Christianity',
    'D. A. Carson and Douglas J. Moo, Introducing the New Testament',
    'John H. Sailhamer, The Pentateuch as Narrative',
  ],
};

// --- Bachelor of Theology, credit-hour structure ---------------------------
// Years One and Two as supplied. Year Three was not included in the source.

export const bachelorOfTheologyCreditCurriculum: Curriculum = {
  programSlug: 'bachelor-of-theology',
  title: 'Bachelor of Theology — supplementary course schedule',
  duration: 'Three years',
  creditUnit: 'credit hours',
  note:
    'The 180-ECTS structure published at /bachelor-of-theology governs this award — the university has confirmed it. The listing below is a supplementary course schedule for Years One and Two, supplied with course codes and descriptions that the ECTS structure does not carry. Year Three has not been supplied, and the ECTS value of each course below has not been stated.',
  terms: [
    {
      label: 'Year One · First Semester',
      courses: [
        { code: 'BIS 220', title: 'Bible Survey I', credits: 3, description: 'An introduction to the Bible, exploring its historical, literary, and theological aspects, laying the foundation for understanding the Old and New Testaments.' },
        { code: 'BIS 250', title: 'Bible Doctrine I', credits: 3, description: 'Introduction to key Christian doctrines, including the nature of God, the Trinity, and the work of Christ.' },
        { code: 'MW 300', title: 'Evangelism (Intro)', credits: 3, description: 'Principles and methods of evangelism, covering biblical foundations, historical approaches and contemporary strategies.' },
        { code: 'CH 200', title: 'Church History', credits: 3, description: 'Overview of the development of the Christian church from its inception to the present.' },
        { code: 'EN 101', title: 'Use of English', credits: 3, description: 'Grammar, composition and communication skills essential for academic success and ministry.' },
        { code: 'OTH 300', title: 'Old Testament History', credits: 3, description: 'The historical books of the Old Testament, from the conquest of Canaan to the post-exilic period.' },
        { code: 'LC 110', title: 'Christology I', credits: 3, description: 'The person and work of Jesus Christ, examined from biblical, historical and theological perspectives.' },
      ],
    },
    {
      label: 'Year One · Second Semester',
      courses: [
        { code: 'BIS 230', title: 'Bible Survey II', credits: 3, description: 'Continuation of Bible Survey I, covering the New Testament in detail.' },
        { code: 'BIS 260', title: 'Bible Doctrine II', credits: 3, description: 'Further exploration of Christian doctrines, including salvation, the church and eschatology.' },
        { code: 'BL 300', title: 'Epistle I', credits: 3, description: 'Selected New Testament epistles, with emphasis on exegesis and theological reflection.' },
        { code: 'CED 180', title: 'Soteriology I', credits: 3, description: 'The doctrine of salvation, including justification, sanctification and glorification.' },
        { code: 'MDS 640', title: 'Ministerial Ethics', credits: 3, description: 'Ethical issues in ministry: pastoral integrity, confidentiality and ethical decision-making.' },
        { code: 'NT 330', title: 'Romans', credits: 3, description: 'In-depth study of the Epistle to the Romans and its implications for Christian life and ministry.' },
        { code: 'OT 300', title: 'Pentateuch', credits: 3, description: 'The first five books of the Old Testament and their foundational role in the biblical canon.' },
        { code: 'LC 120', title: 'Christology II', credits: 3, description: 'Christ’s role in salvation history and in contemporary theology.' },
      ],
    },
    {
      label: 'Year Two · First Semester',
      courses: [
        { code: 'BIS 320', title: 'Homiletics', credits: 3, description: 'The art and practice of preaching: homiletical theory, rhetorical skills and sermon delivery.' },
        { code: 'BL 310', title: 'Epistle II', credits: 3, description: 'Continued study of the New Testament epistles and their application to contemporary Christian life.' },
        { code: 'CDS 140', title: 'Tithing & Stewardship', credits: 2, description: 'Biblical principles of tithing and stewardship and their application in the church today.' },
        { code: 'CED 160', title: 'Christian Education', credits: 3, description: 'Curriculum development, teaching methods and educational philosophy for the church.' },
        { code: 'ETP 450', title: 'Prophecy (Daniel & Revelation)', credits: 3, description: 'The prophetic books of Daniel and Revelation, their historical context and eschatological themes.' },
        { code: 'EN 140', title: 'Creative Writings', credits: 3, description: 'Techniques for writing fiction and non-fiction, developing creativity and effective communication.' },
        { code: 'RM 540', title: 'Research Methodology I', credits: 3, description: 'Qualitative and quantitative research techniques and their application in theological studies.' },
        { code: 'NT 470', title: 'Hebrews', credits: 3, description: 'The Epistle to the Hebrews, its Christology and its relevance for Christian faith and practice.' },
      ],
    },
    {
      label: 'Year Two · Second Semester',
      courses: [
        { code: 'BL 130', title: 'Epistle III', credits: 2, description: 'Further study of the New Testament epistles, developing exegetical skill and theological reflection.' },
        { code: 'BL 160', title: 'Tabernacle', credits: 3, description: 'The Old Testament Tabernacle: construction, significance and typological relevance.' },
        { code: 'CED 110', title: 'Soteriology II', credits: 3, description: 'Election, atonement and the work of the Holy Spirit in salvation.' },
        { code: 'MDS 650', title: 'Spiritual Leadership I', credits: 3, description: 'Principles of spiritual leadership: character development, vision casting and leadership skills.' },
        { code: 'MPR 520', title: 'Spiritual Gifts I', credits: 3, description: 'Spiritual gifts in the New Testament, their purpose and their use in the church today.' },
        { code: 'MDS 750', title: 'Church Planting', credits: 2, description: 'Mission strategy, team building and community engagement in church planting.' },
        { code: 'STT 400', title: 'Systematic Theology I', credits: 3, description: 'The doctrine of God, Christology and pneumatology, approached systematically.' },
      ],
    },
  ],
};

export const curricula: Curriculum[] = [diplomaOfTheologyCurriculum, bachelorOfTheologyCreditCurriculum];

export function getCurriculum(programSlug: string) {
  return curricula.find((c) => c.programSlug === programSlug);
}

/** Total credits where every course in a term carries a value. */
export function termCredits(term: CurriculumTerm): number | undefined {
  if (term.courses.some((c) => c.credits === undefined)) return undefined;
  return term.courses.reduce((n, c) => n + (c.credits ?? 0), 0);
}
