// ---------------------------------------------------------------------------
// Bachelor of Theology (B.Th.) — Faculty of Theology
//
// PUBLIC content, supplied by the university and reproduced verbatim.
//
// SCOPE NOTE — read before editing.
// The university has now supplied the COMPLETE 36-course structure across all
// six semesters (BTH101-BTH312). That table supersedes the earlier partial
// specification and is published in full.
//
// It also supersedes it in ways that are NOT simple renames. See
// docs/BTH-HANDBOOK-PLANNING.md for the reconciliation record:
//   · BTH105 and BTH106 are now DIFFERENT COURSES, not renamed ones.
//     Evangelism moved to BTH110, Christology I to BTH109.
//   · BTH101's units 8-15 were replaced wholesale.
//
// VISIBILITY. Course codes, titles, credit values and unit TITLES are public.
// The unit TEXT — the actual teaching material, e.g. "8.1 Introduction to
// Biblical Geography" and the prose under it — is course content that enrolled
// students receive. It lives in src/content/courseMaterial.ts and renders only
// inside the authenticated portal, on the same principle as reading lists.
// ---------------------------------------------------------------------------

export interface BthCourse {
  code: string;
  title: string;
  ects: number;
  /** Unit-by-unit outline where the university has supplied one. */
  units?: string[];
  /** Indicative content where a full unit list is not yet written. */
  contents?: string[];
}

export const bth = {
  award: 'Bachelor of Theology (B.Th.)',
  faculty: 'Faculty of Theology',
  duration: 'Three (3) Years',
  credits: '180 ECTS',
  studyMode: 'Full-Time, Part-Time, Online and Distance Learning',
  nqf: 'NQF Equivalent: Level 7 Bachelor’s Degree',
};

export const bthDescription = [
  'The Bachelor of Theology (B.Th.) at ICOF Global University is a comprehensive undergraduate degree designed to prepare students for Christian ministry, biblical scholarship, theological research, leadership, missions, chaplaincy, Christian education, and community transformation. The programme combines rigorous academic study with spiritual formation and practical ministry, enabling graduates to understand the Christian faith from biblical, historical, theological, pastoral, and missiological perspectives.',
  'The curriculum is grounded in the authority of the Holy Scriptures and seeks to develop students who are biblically knowledgeable, spiritually mature, intellectually competent, ethically responsible, and mission-oriented. Throughout the programme, students are introduced to the historical, literary, cultural, and theological foundations of Christianity while also engaging contemporary issues facing the global Church.',
  'Unlike many traditional theology programmes that focus exclusively on Western theological traditions, the Bachelor of Theology at ICOF Global University embraces the global nature of Christianity. Students explore African Theology, Contextual Theology, Global Christianity, Biblical Theology, Church History, Christian Ethics, Systematic Theology, Missiology, Leadership Studies, Pastoral Care, and Christian Education. The programme recognizes the tremendous growth of Christianity in Africa, Asia, and Latin America and equips students to minister effectively within diverse cultural contexts.',
  'Particular emphasis is placed upon the integration of theological knowledge with practical ministry. Students participate in supervised ministry placements, evangelistic outreaches, preaching laboratories, teaching practice, leadership development, and community engagement projects. These experiences enable students to translate classroom learning into effective ministry skills.',
  'The programme also develops students’ research abilities through progressive courses in academic writing, research methodology, biblical interpretation, and theological inquiry. During the final year, every student undertakes an independent research thesis under faculty supervision, demonstrating competence in theological investigation and scholarly writing.',
  'Graduates of the Bachelor of Theology will possess a broad understanding of Christian doctrine, biblical interpretation, church history, Christian leadership, and pastoral ministry. They will be prepared to serve as pastors, evangelists, missionaries, Christian educators, chaplains, ministry leaders, church administrators, and researchers. The programme also provides an excellent academic foundation for postgraduate studies including the Master of Theology (M.Th.), Master of Divinity (M.Div.), Master of Arts in Theology, and Doctoral programmes.',
];

export const bthPhilosophy = [
  'The Bachelor of Theology is founded upon the conviction that all truth originates in God and that Holy Scripture is the inspired, authoritative, and trustworthy revelation of God for faith, life, and ministry. The programme affirms Jesus Christ as the incarnate Son of God, the Savior of the world, and the Head of the Church. It recognizes the Holy Spirit as the divine teacher who empowers believers for holy living, ministry, and mission.',
  'The programme seeks to unite academic excellence with spiritual formation. Theology is not viewed merely as an academic discipline but as the study of God that transforms both the mind and the character of the learner. Students are encouraged to develop intellectual competence, spiritual maturity, ethical integrity, servant leadership, and compassionate ministry.',
  'The curriculum reflects the belief that Christian theology must engage both the historical foundations of the faith and the contemporary realities of society. Students therefore examine biblical texts within their historical and cultural contexts while also considering the challenges of globalization, secularization, poverty, injustice, technological advancement, interreligious dialogue, environmental stewardship, and cultural diversity.',
  'The programme also recognizes that Christianity is a global faith expressed through many cultures. Consequently, students are introduced to theological voices from Africa, Asia, Latin America, Europe, and North America, enabling them to appreciate both the unity and diversity of the worldwide Church.',
];

export const bthAims = [
  'Provide a comprehensive understanding of the Old and New Testaments.',
  'Equip students with sound knowledge of Christian doctrine based upon biblical teaching.',
  'Develop competence in biblical interpretation using accepted hermeneutical principles.',
  'Prepare students for pastoral ministry, evangelism, missions, teaching, chaplaincy, and Christian leadership.',
  'Cultivate spiritual maturity through worship, discipleship, prayer, and Christian service.',
  'Introduce students to the historical development of Christianity from the apostolic period to the contemporary Church.',
  'Equip students to address contemporary theological, ethical, and social issues from a biblical perspective.',
  'Develop effective communicators of God’s Word through preaching and teaching.',
  'Prepare graduates for postgraduate theological studies and lifelong learning.',
  'Promote servant leadership that reflects the character and ministry of Jesus Christ.',
];

export const bthOutcomes = [
  'Demonstrate comprehensive knowledge of the Old and New Testaments.',
  'Interpret biblical texts using historical, grammatical, literary, and theological methods.',
  'Explain major Christian doctrines and their biblical foundations.',
  'Evaluate the historical development of Christian theology and the Church.',
  'Apply biblical principles to pastoral ministry, leadership, missions, counseling, and Christian education.',
  'Conduct independent theological research using appropriate academic methodologies.',
  'Communicate biblical truth effectively through preaching, teaching, writing, and discipleship.',
  'Analyze contemporary theological, ethical, and cultural issues from a Christian worldview.',
  'Demonstrate leadership characterized by integrity, humility, accountability, and service.',
  'Engage constructively with people from different cultural, social, and religious backgrounds.',
];

export const bthStructure = [
  { year: 'Year One', semester: 'Semester One', credits: 30 },
  { year: 'Year One', semester: 'Semester Two', credits: 30 },
  { year: 'Year Two', semester: 'Semester Three', credits: 30 },
  { year: 'Year Two', semester: 'Semester Four', credits: 30 },
  { year: 'Year Three', semester: 'Semester Five', credits: 30 },
  { year: 'Year Three', semester: 'Semester Six', credits: 30 },
];

export interface BthSemester {
  year: string;
  label: string;
  courses: BthCourse[];
}

/**
 * The complete 36-course, 180-ECTS structure as supplied by the university.
 * Every course is 5 ECTS; six courses per semester; six semesters.
 */
export const bthCurriculum: BthSemester[] = [
  {
    year: 'Year 1',
    label: 'Semester 1',
    courses: [
      { code: 'BTH101', title: 'Introduction to Biblical Studies', ects: 5, units: [
        'The Nature of Theology',
        'Divine Revelation',
        'The Inspiration of Scripture',
        'The Canon of Scripture',
        'Biblical Authority',
        'Formation of the Old Testament',
        'Formation of the New Testament',
        'Biblical Geography and Archaeology',
        'The Cultural Context of the New Testament',
        'The Gospels and the Old Testament',
        'Pauline Theology',
        'Biblical Hermeneutics and Interpretation',
        'Biblical Theology',
        'Scripture, Doctrine, and Christian Ministry',
        'Global and Contextual Interpretation of Scripture',
      ] },
      { code: 'BTH102', title: 'Biblical Studies I: Old Testament Survey', ects: 5, units: [
        'Introduction to the Old Testament',
        'The Book of Genesis',
        'Abraham and the Covenant Promise',
        'Moses, the Exodus, and the Covenant at Sinai',
        'The Books of the Law',
        'Joshua: Entering the Promised Land',
        'Judges and the Cycle of Israel’s Failure',
        'Samuel and the Rise of the Kingdom',
        'David, Covenant, and Messianic Hope',
        'Solomon and the Temple',
        'Divided Kingdom and Prophetic Ministry',
        'Exile and Restoration',
        'Old Testament Theology of Messiah',
        'Theological Themes for Christian Ministry',
        'Assessment and Bibliography',
      ] },
      { code: 'BTH103', title: 'Biblical Studies II: New Testament Survey', ects: 5 },
      { code: 'BTH104', title: 'Church History I', ects: 5 },
      { code: 'BTH105', title: 'Introduction to Christian Doctrine', ects: 5 },
      { code: 'BTH106', title: 'Academic Writing and Study Skills', ects: 5 },
    ],
  },
  {
    year: 'Year 1',
    label: 'Semester 2',
    courses: [
      { code: 'BTH107', title: 'Pentateuch', ects: 5 },
      { code: 'BTH108', title: 'Historical Books of the Old Testament', ects: 5 },
      { code: 'BTH109', title: 'Christology I', ects: 5 },
      { code: 'BTH110', title: 'Evangelism and Discipleship', ects: 5 },
      { code: 'BTH111', title: 'Christian Ethics', ects: 5 },
      { code: 'BTH112', title: 'Introduction to Biblical Hebrew', ects: 5 },
    ],
  },
  {
    year: 'Year 2',
    label: 'Semester 3',
    courses: [
      { code: 'BTH201', title: 'Pauline Theology', ects: 5 },
      { code: 'BTH202', title: 'Synoptic Gospels', ects: 5 },
      { code: 'BTH203', title: 'Biblical Hermeneutics', ects: 5 },
      { code: 'BTH204', title: 'Homiletics I', ects: 5 },
      { code: 'BTH205', title: 'Research Methodology', ects: 5 },
      { code: 'BTH206', title: 'Philosophy of Religion', ects: 5 },
    ],
  },
  {
    year: 'Year 2',
    label: 'Semester 4',
    courses: [
      { code: 'BTH207', title: 'Pneumatology', ects: 5 },
      { code: 'BTH208', title: 'Systematic Theology I', ects: 5 },
      { code: 'BTH209', title: 'Church History II', ects: 5 },
      { code: 'BTH210', title: 'Christian Leadership', ects: 5 },
      { code: 'BTH211', title: 'Introduction to New Testament Greek', ects: 5 },
      { code: 'BTH212', title: 'Missiology and World Christianity', ects: 5 },
    ],
  },
  {
    year: 'Year 3',
    label: 'Semester 5',
    courses: [
      { code: 'BTH301', title: 'Johannine Literature', ects: 5 },
      { code: 'BTH302', title: 'Advanced Hermeneutics', ects: 5 },
      { code: 'BTH303', title: 'Systematic Theology II', ects: 5 },
      { code: 'BTH304', title: 'African Theology', ects: 5 },
      { code: 'BTH305', title: 'Contextual Theology', ects: 5 },
      { code: 'BTH306', title: 'Pastoral Care and Counseling', ects: 5 },
    ],
  },
  {
    year: 'Year 3',
    label: 'Semester 6',
    courses: [
      { code: 'BTH307', title: 'Eschatology', ects: 5 },
      { code: 'BTH308', title: 'Church Administration and Governance', ects: 5 },
      { code: 'BTH309', title: 'Christian Apologetics', ects: 5 },
      { code: 'BTH310', title: 'Contemporary Issues in Theology', ects: 5 },
      { code: 'BTH311', title: 'Ministry Internship', ects: 5 },
      { code: 'BTH312', title: 'Undergraduate Research Thesis', ects: 5 },
    ],
  },
];

/** Final-year requirements the university has stated. */
export const bthFinalYear = [
  'Research Thesis',
  'Ministry Internship',
  'Oral Defence',
];

/** Roles the university states graduates are prepared for. */
export const bthCareers = [
  'Pastors',
  'Evangelists',
  'Missionaries',
  'Christian educators',
  'Chaplains',
  'Ministry leaders',
  'Church administrators',
  'Researchers',
];

/** Postgraduate routes the university names. */
export const bthProgression = [
  { label: 'Master of Theology (M.Th.)', href: '/master-of-theology' },
  { label: 'Master of Divinity (M.Div.)', href: '/programs/ministry' },
  { label: 'Master of Arts in Theology', href: '/degrees/masters-degrees' },
  { label: 'Doctoral programmes', href: '/degrees/doctoral' },
];
