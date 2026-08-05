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
  /** Absent until the faculty sets per-course weightings — see the note above. */
  ects?: number;
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
  { year: 'Year One', semester: 'Semester One', courses: 5 },
  { year: 'Year One', semester: 'Semester Two', courses: 5 },
  { year: 'Year Two', semester: 'Semester Three', courses: 5 },
  { year: 'Year Two', semester: 'Semester Four', courses: 5 },
  { year: 'Year Three', semester: 'Semester Five', courses: 5 },
  { year: 'Year Three', semester: 'Semester Six', courses: 7 },
];

export interface BthSemester {
  year: string;
  label: string;
  courses: BthCourse[];
}

/**
 * The programme structure as set out in the university's development brief,
 * which supersedes the earlier 36-course table. It resolves the naming
 * conflict in favour of the written course documents: BTH104 is Bible
 * Doctrine I, BTH105 is Evangelism and Missions, and Semester One carries
 * five courses rather than six.
 *
 * PER-COURSE CREDIT VALUES ARE DELIBERATELY ABSENT. The brief specifies 180
 * ECTS across 32 courses, which does not divide into a whole number, and the
 * semesters are uneven (5,5,5,5,5,7), so a flat 30 ECTS per semester is not
 * achievable either. Rather than invent weightings the faculty has not set,
 * the page states the programme total and marks per-course credit as under
 * review. See docs/BTH-HANDBOOK-PLANNING.md.
 */
export const bthCurriculum: BthSemester[] = [
  {
    year: 'Year One',
    label: 'Semester One',
    courses: [
      { code: 'BTH101', title: 'Introduction to Biblical Studies', units: [
        'The Nature of Theology', 'Divine Revelation', 'The Inspiration of Scripture',
        'The Canon of Scripture', 'Biblical Authority', 'Formation of the Old Testament',
        'Formation of the New Testament', 'Biblical Geography and Archaeology',
        'The Cultural Context of the New Testament', 'The Gospels and the Old Testament',
        'Pauline Theology', 'Biblical Hermeneutics and Interpretation', 'Biblical Theology',
        'Scripture, Doctrine, and Christian Ministry',
        'Global and Contextual Interpretation of Scripture',
      ] },
      { code: 'BTH102', title: 'Bible Survey I', units: [
        'Introduction to the Old Testament', 'The Book of Genesis', 'Abraham and the Covenant Promise',
        'Moses, the Exodus, and the Covenant at Sinai', 'The Books of the Law',
        'Joshua: Entering the Promised Land', 'Judges: The Cycle of Failure and Restoration',
        'Samuel and the Rise of the Kingdom', 'David, the Davidic Covenant, and Messianic Hope',
        'Solomon, Wisdom, and the Temple', 'The Divided Kingdom and the Prophetic Ministry',
        'Exile, Judgment, and Restoration', 'Old Testament Messianic Hope',
        'Old Testament Theology and Christian Ministry',
      ] },
      { code: 'BTH103', title: 'Bible Survey II', units: [
        'Introduction to the Prophetic Movement', 'Isaiah: The Holy King and the Suffering Servant',
        'Jeremiah: Judgment and the New Covenant', 'Ezekiel: The Glory and Restoration of Yahuah',
        'Daniel: The Kingdom of Yahuah Among the Nations', 'Job: Suffering, Faith, and Sovereignty',
        'Psalms: Worship and Spiritual Life', 'Proverbs, Ecclesiastes, and Song of Songs',
        'The Cultural, Historical, and Religious Context of the New Testament',
        'The Identity of Yahusha the Messiah', 'The Kingdom of Yahuah in the Teaching of Yahusha',
        'The Miracles and Signs of Yahusha', 'The Death, Resurrection, and Ascension of Yahusha',
        'The Book of Acts and the Birth of the New Covenant Community',
        'Pentecost, Mission, Africa, and the Global Expansion of the Assembly',
      ] },
      { code: 'BTH104', title: 'Bible Doctrine I', units: [
        'What is Theology?', 'Sources for Theological Reflection', 'Revelation and the Word of Yahuah',
        'The Existence and Nature of Yahuah', 'The Triune Nature of Yahuah', 'Yahuah as Creator',
        'The Creation and Identity of Humanity', 'Human Dignity, Race, and Identity',
        'Gender, Community, and Relationship', 'Disability Theology and the Image of Yahuah',
        'The Fall of Humanity and the Corruption of the Image',
        'Evil, Suffering, and the Problem of Humanity', 'Salvation in the Purpose of Yahuah',
        'Covenant Theology', 'Redemption and the Restoration of Creation',
      ] },
      { code: 'BTH105', title: 'Evangelism and Missions Introduction' },
    ],
  },
  {
    year: 'Year One',
    label: 'Semester Two',
    courses: [
      { code: 'BTH106', title: 'Bible Doctrine II', contents: ['Pneumatology', 'Ecclesiology', 'Eschatology', 'Angelology', 'Demonology', 'Spiritual warfare', 'Kingdom theology'] },
      { code: 'BTH107', title: 'Old Testament History and Theology', contents: ['Patriarchs', 'Exodus', 'Israel’s covenant identity', 'Kingdom period', 'Prophets', 'Exile', 'Restoration'] },
      { code: 'BTH108', title: 'Christology I', contents: ['Identity of Yahusha', 'Messianic prophecy', 'Incarnation', 'Humanity and divinity', 'Kingdom ministry', 'African and global interpretations of Yahusha'] },
      { code: 'BTH109', title: 'Pentateuch Studies', contents: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Covenant theology', 'Torah and Christian theology'] },
      { code: 'BTH110', title: 'Christian Psychology and Human Relations', contents: ['Human personality', 'Spiritual formation', 'Pastoral relationships', 'Emotional maturity', 'Family systems', 'Conflict resolution'] },
    ],
  },
  {
    year: 'Year Two',
    label: 'Semester Three',
    courses: [
      { code: 'BTH201', title: 'Hermeneutics and Biblical Interpretation', contents: ['Principles of interpretation', 'Historical-critical method', 'Literary interpretation', 'Canonical interpretation', 'Contextual interpretation', 'African hermeneutics', 'Liberation hermeneutics', 'Feminist hermeneutics', 'Postcolonial interpretation', 'Hebrew and Greek background'] },
      { code: 'BTH202', title: 'Homiletics I', contents: ['Theology of preaching', 'Biblical preaching', 'Sermon preparation', 'Expository preaching', 'Prophetic preaching', 'Contextual preaching', 'Preaching in African churches'] },
      { code: 'BTH203', title: 'Christian Ethics', contents: ['Biblical morality', 'Justice', 'Human dignity', 'Bioethics', 'Sexual ethics', 'Economic ethics', 'Political responsibility'] },
      { code: 'BTH204', title: 'Christian Education', contents: ['Teaching ministry', 'Discipleship', 'Curriculum development', 'Adult education', 'Children ministry'] },
      { code: 'BTH205', title: 'Research Methodology I', contents: ['Academic research', 'Theology research methods', 'Citation styles', 'Literature review', 'Research proposal writing'] },
    ],
  },
  {
    year: 'Year Two',
    label: 'Semester Four',
    courses: [
      { code: 'BTH206', title: 'Systematic Theology I', contents: ['Doctrine of Yahuah', 'Trinity', 'Scripture', 'Creation', 'Humanity', 'Sin', 'Revelation'] },
      { code: 'BTH207', title: 'Epistles Studies', contents: ['Pauline theology', 'Hebrews', 'General Epistles', 'New Covenant theology'] },
      { code: 'BTH208', title: 'Pneumatology', contents: ['Holy Spirit theology', 'Gifts of the Spirit', 'Pentecostal theology', 'Spiritual formation', 'Mission empowerment'] },
      { code: 'BTH209', title: 'Spiritual Leadership', contents: ['Biblical leadership models', 'Servant leadership', 'Pastoral leadership', 'Organizational leadership', 'Ethical leadership'] },
      { code: 'BTH210', title: 'Research Methodology II', contents: ['Advanced theological research', 'Thesis preparation', 'Academic writing'] },
    ],
  },
  {
    year: 'Year Three',
    label: 'Semester Five',
    courses: [
      { code: 'BTH301', title: 'Advanced Hermeneutics' },
      { code: 'BTH302', title: 'Acts and Apostolic Mission', contents: ['Pentecost', 'Early assembly', 'Paul', 'Peter', 'African Christianity', 'Global mission'] },
      { code: 'BTH303', title: 'Spiritual Formation', contents: ['Prayer', 'Worship', 'Holiness', 'Character formation', 'Discipleship'] },
      { code: 'BTH304', title: 'Missiology and Global Christianity', contents: ['Biblical mission', 'Historical mission', 'Catholic mission', 'Protestant mission', 'Evangelical mission', 'Pentecostal mission', 'African mission', 'Asian theology', 'Latin American theology'] },
      { code: 'BTH305', title: 'ICT, Technology and Global Ministry', contents: ['Digital ministry', 'Artificial intelligence and theology', 'Online churches', 'Technology ethics', 'Global communication'] },
    ],
  },
  {
    year: 'Year Three',
    label: 'Semester Six',
    courses: [
      { code: 'BTH306', title: 'Advanced Homiletics' },
      { code: 'BTH307', title: 'Family Theology and Marriage Studies' },
      { code: 'BTH308', title: 'Spiritual Warfare and Demonology' },
      { code: 'BTH309', title: 'Systematic Theology II', contents: ['Christology', 'Salvation', 'Ecclesiology', 'Eschatology'] },
      { code: 'BTH310', title: 'African Theology and Contextual Theology', contents: ['African Theology', 'Contextual Theology', 'Liberation Theology', 'Identity and Biblical Interpretation'] },
      { code: 'BTH311', title: 'Ecotheology and Creation Care', contents: ['Creation theology', 'Environmental responsibility', 'Climate justice', 'African ecological perspectives'] },
      { code: 'BTH312', title: 'Bachelor Thesis and Defense', contents: ['Research proposal', 'Literature review', 'Methodology', 'Thesis writing', 'Oral defense'] },
    ],
  },
];

/** Specialised electives named in the development brief. */
export const bthElectives = [
  'African Biblical Theology',
  'Black Liberation Theology',
  'Jesus, Africa and Hebrew Identity Studies',
  'Religion, Identity and Populism',
];

/** The ten fields the programme integrates, per the programme vision. */
export const bthIntegrates = [
  'Biblical Theology', 'Systematic Theology', 'Historical Theology', 'Practical Theology',
  'Missiology', 'Contextual Theology', 'African Theology', 'Global Christianity',
  'Christian Leadership', 'Research Methodology',
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
