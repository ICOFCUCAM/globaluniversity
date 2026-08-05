// ---------------------------------------------------------------------------
// Bachelor of Theology (B.Th.) — Faculty of Theology
//
// PUBLIC content, supplied by the university and reproduced verbatim.
//
// SCOPE NOTE — read before adding to this file.
// The university has fully specified: the qualification details, programme
// description, philosophy, ten aims, ten learning outcomes, the 180-ECTS
// structure table, and Year One Semester One (six courses with codes and
// credit values). Unit outlines exist for those six.
//
// Semester Two and Years Two and Three are described only as counts —
// "six more fully developed courses", "twelve fully developed courses" — with
// no titles, codes or credit values supplied. Those 30 courses are therefore
// NOT in this file and must not be invented. The page states plainly that the
// remaining semesters are in development.
//
// The proposed course-renaming table and the list of recommended additional
// courses are advice to the institution, not published fact. They live in
// docs/BTH-HANDBOOK-PLANNING.md and are rendered by no route.
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
  { year: 'Year One', semester: 'Semester One', credits: 30, published: true },
  { year: 'Year One', semester: 'Semester Two', credits: 30, published: false },
  { year: 'Year Two', semester: 'Semester One', credits: 30, published: false },
  { year: 'Year Two', semester: 'Semester Two', credits: 30, published: false },
  { year: 'Year Three', semester: 'Semester One', credits: 30, published: false },
  { year: 'Year Three', semester: 'Semester Two', credits: 30, published: false },
];

/** Year One, Semester One — the only semester the university has specified. */
export const bthYearOneSemesterOne: BthCourse[] = [
  {
    code: 'BTH101',
    title: 'Introduction to Biblical Studies',
    ects: 5,
    units: [
      'The Nature of Theology',
      'Divine Revelation',
      'The Inspiration of Scripture',
      'The Canon of Scripture',
      'Biblical Authority',
      'Formation of the Old Testament',
      'Formation of the New Testament',
      'Transmission of Scripture',
      'Ancient Bible Manuscripts',
      'Modern Bible Translations',
      'Biblical Geography',
      'Historical Background',
      'Literary Genres',
      'Biblical Interpretation',
      'Application of Scripture',
    ],
  },
  {
    code: 'BTH102',
    title: 'Bible Survey I: The Old Testament',
    ects: 5,
    contents: [
      'Genesis through Malachi',
      'Every biblical book introduced separately',
      'Historical timeline',
      'Major themes',
      'Key theological doctrines',
      'Messianic prophecies',
      'Application',
    ],
  },
  {
    code: 'BTH103',
    title: 'Bible Survey II: The New Testament',
    ects: 5,
    contents: [
      'Matthew through Revelation',
      'Every New Testament book',
      'Historical setting',
      'Major doctrines',
      'Kingdom Theology',
      'Pauline Theology',
      'General Epistles',
      'Apocalyptic Theology',
    ],
  },
  {
    code: 'BTH104',
    title: 'Church History I',
    ects: 5,
    contents: [
      'From Pentecost',
      'Early Church',
      'Church Fathers',
      'Roman Empire',
      'Councils',
      'Canon',
      'Creeds',
      'Persecution',
      'Constantine',
      'Monasticism',
    ],
  },
  {
    code: 'BTH105',
    title: 'Introduction to Evangelism',
    ects: 5,
    contents: [
      'Biblical Theology of Evangelism',
      'Personal Evangelism',
      'Mass Evangelism',
      'Apologetics',
      'Church Planting',
      'Discipleship',
      'Digital Evangelism',
      'Practical Exercises',
    ],
  },
  {
    code: 'BTH106',
    title: 'Christology I',
    ects: 5,
    contents: [
      'Messianic Prophecies',
      'Virgin Birth',
      'Incarnation',
      'Names of Christ',
      'Humanity',
      'Divinity',
      'Miracles',
      'Sinlessness',
      'The Kingdom',
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
