// ---------------------------------------------------------------------------
// BACHELOR OF MINISTRY (B.Min.) — School of Ministry
//
// 180 ECTS · three academic years · six semesters.
//
// PUBLIC content, supplied by the university as an official academic framework
// and reproduced here. This is the second programme on this site to carry a
// complete course structure with codes, credit values and prerequisites — the
// Bachelor of Theology being the first — and it is the first to carry a
// prerequisite chain at all.
//
// ===========================================================================
// WHAT IS REPRODUCED AND WHAT IS DERIVED
// ===========================================================================
//
// Every course code, title, ECTS value, prerequisite, description, learning
// outcome, topic list and assessment weight below is the university's. Nothing
// is paraphrased into existence and nothing is filled in where the framework
// was silent — a course with no assessment breakdown carries none here, and the
// page says so rather than inventing a plausible one.
//
// What IS derived: the totals. Semester loads, the programme total and the
// component-table total are computed from the courses, never typed. That is the
// same rule the rest of this site follows for counts, and it is the reason the
// four findings below could be found at all.
//
// ===========================================================================
// FOUR THINGS THE FRAMEWORK CANNOT YET DO, AND THEY ARE NOT EDITED OUT
// ===========================================================================
//
// The arithmetic is sound. Six semesters of exactly 30 ECTS, 180 in total, and
// the component table also sums to 180. Thirty-four courses, no duplicated
// code, and every prerequisite names a course that exists in the plan.
//
// Four things do not reconcile, all of them academic decisions rather than
// typing errors, and all of them are recorded in BMIN_OPEN_QUESTIONS below and
// published on the page rather than quietly corrected. This repository does not
// invent institutional facts, and a prerequisite chain is an institutional
// fact: changing one changes what a student is allowed to enrol in.
//
//   1. Two prerequisites are unsatisfiable as written. FIN 201 requires
//      ADM 201 and both sit in Semester 4; COM 302 requires MIS 301 and both
//      sit in Semester 5. A student cannot complete a course before a course
//      they are taking at the same time.
//
//   2. The fourteen specialization tracks have no ECTS home. The component
//      table allocates 12 ECTS to "Elective/Specialization Studies" and §12
//      says a specialization is taken "as part of the elective/specialization
//      requirement" — but all six semesters are filled with required courses.
//      There is no slot to put a track in without exceeding 180 ECTS.
//
//   3. COM is two different subjects. COM 101 and COM 301 are Communication;
//      COM 302 is Community Development. A transcript reading "COM 301,
//      COM 302" states a two-part communications sequence that the student did
//      not take, and a credential evaluator reads transcripts, not prospectuses.
//
//   4. The track courses are numbered at 400 level in a programme whose own
//      levels run 100 to 300. On a three-year, 180-ECTS bachelor, a 400-level
//      code conventionally signals postgraduate or fourth-year study.
//
// None of the four is a reason to withhold the programme, and the framework is
// published in full. They are flagged because the university asked for an
// academic framework it could take to approval, and these are the four things
// an approval panel would raise first.
// ---------------------------------------------------------------------------

export interface BminAssessment {
  item: string;
  /** Percentage of the course mark. */
  weight: number;
}

export interface BminCourse {
  code: string;
  title: string;
  ects: number;
  /** The prerequisite exactly as the framework states it, including "None". */
  prerequisite: string;
  /**
   * The course codes inside that sentence, for the progression check.
   *
   * Written out rather than parsed from the prose: "BIB 101 or BIB 102" and
   * "MIN 101, BIB 103" mean different things to a registrar, and a regular
   * expression that treats them alike would pass a check it should fail.
   */
  requires: string[];
  /** Where the requirement is a credit threshold rather than a named course. */
  requiresEcts?: number;
  description?: string;
  outcomes?: string[];
  topics?: string[];
  /** A stated practical requirement beyond the assessment breakdown. */
  practical?: string;
  /** Omitted where the framework gave no breakdown. Never invented. */
  assessment?: BminAssessment[];
}

export interface BminSemester {
  label: string;
  year: string;
  courses: BminCourse[];
}

export const bmin = {
  award: 'Bachelor of Ministry (B.Min.)',
  school: 'School of Ministry',
  credits: '180 ECTS',
  duration: 'Three academic years · six semesters',
  modes: 'On-campus, online, blended and approved distance learning',
  language: 'English',
  orientation: 'Biblical, theological, practical, professional and missional formation',
  principle:
    'The Bachelor of Ministry is designed to form ministers who are biblically grounded, '
    + 'theologically competent, spiritually mature, ethically responsible, professionally '
    + 'capable and practically effective in the Church and society.',
};

export const bminIdentity = [
  'The School of Ministry of ICOF Global University exists to equip men and women for effective Christian service, leadership and ministry in the Church, Christian organizations, missions and wider society.',
  'The School recognizes that contemporary ministry extends beyond the pulpit. Effective ministry requires biblical knowledge, theological understanding, spiritual formation, leadership, administration, communication, technology, financial stewardship, education, pastoral care, evangelism and practical service.',
];

/** The integration the curriculum is built on, in the framework's own terms. */
export const bminIntegration = [
  'Bible', 'Theology', 'Spiritual Formation', 'Ministry Practice',
  'Leadership', 'Professional Skills', 'Technology', 'Mission',
];

export const bminPhilosophy = [
  'The School is founded upon the conviction that Christian ministers must be both formed and equipped.',
  'Academic knowledge without character can produce competent but ineffective leadership. Spiritual passion without knowledge can produce instability and error. Ministry skill without biblical grounding can produce activity without sound foundation.',
];

export const bminVision =
  'To equip a generation of biblically grounded, spiritually formed and professionally capable ministers who serve the Church and transform communities locally, nationally and globally.';

export const bminMission =
  'The School of Ministry prepares Christian leaders through rigorous biblical and theological education, spiritual formation, practical ministry training, professional development, supervised field experience and research.';

export const bminAim =
  'The Bachelor of Ministry programme aims to produce graduates capable of exercising Christian ministry responsibly in churches, missions, Christian organizations, educational institutions, community initiatives, media organizations and other ministry contexts.';

export const bminObjectives = [
  'Interpret the Bible using appropriate hermeneutical principles.',
  'Explain major Christian doctrines.',
  'Understand the history and development of Christianity.',
  'Demonstrate spiritual maturity and ethical integrity.',
  'Develop and communicate biblical sermons and lessons.',
  'Practice pastoral care and basic Christian counseling.',
  'Evangelize effectively in diverse contexts.',
  'Make and develop disciples.',
  'Understand the biblical foundations of five-fold ministry.',
  'Exercise responsible Christian leadership.',
  'Establish and manage ministry programmes.',
  'Administer churches and Christian organizations.',
  'Manage financial resources ethically.',
  'Use digital technology in ministry.',
  'Develop Christian media and communications.',
  'Work effectively with children and young people.',
  'Understand missions and cross-cultural ministry.',
  'Participate in community development.',
  'Conduct basic theological and ministry research.',
  'Integrate academic learning with practical ministry.',
];

export const bminGraduateProfile = [
  {
    letter: 'A',
    dimension: 'Biblical competence',
    body: 'Ability to understand, interpret and communicate Scripture.',
  },
  {
    letter: 'B',
    dimension: 'Theological competence',
    body: 'Ability to understand and articulate Christian faith and doctrine.',
  },
  {
    letter: 'C',
    dimension: 'Spiritual competence',
    body: 'Ability to cultivate prayer, worship, character, discernment and spiritual discipline.',
  },
  {
    letter: 'D',
    dimension: 'Ministry competence',
    body: 'Ability to preach, teach, evangelize, disciple, counsel, lead worship and serve communities.',
  },
  {
    letter: 'E',
    dimension: 'Organizational competence',
    body: 'Ability to lead teams, administer organizations, manage finances, use technology and develop sustainable ministry systems.',
  },
];

/**
 * The component table from §8.
 *
 * This is the framework's statement of how 180 ECTS is distributed across the
 * curriculum's parts. It sums to 180 and the semester plan sums to 180, but
 * they are two different distributions of the same total — see finding 2 in
 * BMIN_OPEN_QUESTIONS. Published as supplied, with the total computed.
 */
export const bminComponents: { component: string; ects: number }[] = [
  { component: 'Biblical Studies', ects: 24 },
  { component: 'Theology & Christian Thought', ects: 24 },
  { component: 'Spiritual Formation', ects: 12 },
  { component: 'Ministry Practice', ects: 30 },
  { component: 'Leadership & Administration', ects: 18 },
  { component: 'Missions & Community Ministry', ects: 18 },
  { component: 'Professional & Digital Ministry', ects: 18 },
  { component: 'Research & Academic Development', ects: 12 },
  { component: 'Elective/Specialization Studies', ects: 12 },
  { component: 'Practicum & Capstone', ects: 12 },
];

// ---------------------------------------------------------------------------
// THE SIX SEMESTERS.
// ---------------------------------------------------------------------------

export const bminSemesters: BminSemester[] = [
  {
    year: 'Year One — Biblical and Ministry Foundations',
    label: 'Semester 1',
    courses: [
      {
        code: 'MIN 101',
        title: 'Introduction to Christian Ministry',
        ects: 5,
        prerequisite: 'None',
        requires: [],
        description:
          'Introduces the nature, purpose and practice of Christian ministry. Students examine ministry as calling, service, stewardship and leadership.',
        outcomes: [
          'Define Christian ministry.',
          'Explain different ministry functions.',
          'Identify personal ministry gifts and interests.',
          'Describe biblical models of servant leadership.',
          'Develop a preliminary personal ministry-development plan.',
        ],
        assessment: [
          { item: 'Reflective assignments', weight: 20 },
          { item: 'Ministry case study', weight: 20 },
          { item: 'Class participation', weight: 10 },
          { item: 'Examination', weight: 50 },
        ],
      },
      {
        code: 'BIB 101',
        title: 'Old Testament Survey',
        ects: 5,
        prerequisite: 'None',
        requires: [],
        description:
          'A comprehensive introduction to the books, historical development, major themes, theology and ministry significance of the Old Testament.',
        outcomes: [
          'Identify the major sections of the Old Testament.',
          'Explain major biblical narratives.',
          'Understand covenant, kingdom, law, prophecy and wisdom.',
          'Trace major theological themes.',
          'Apply Old Testament principles responsibly to Christian ministry.',
        ],
        assessment: [
          { item: 'Reading assignments', weight: 15 },
          { item: 'Biblical research project', weight: 25 },
          { item: 'Examination', weight: 60 },
        ],
      },
      {
        code: 'BIB 102',
        title: 'New Testament Survey',
        ects: 5,
        prerequisite: 'None',
        requires: [],
        description:
          'Study of the Gospels, Acts, Pauline writings, General Epistles and Revelation.',
        outcomes: [
          'Explain the historical setting of the New Testament.',
          'Identify major literary genres.',
          'Explain the ministry of Jesus.',
          'Describe the development of the early Church.',
          'Identify major theological themes.',
        ],
        assessment: [
          { item: 'Reading portfolio', weight: 20 },
          { item: 'Research assignment', weight: 20 },
          { item: 'Examination', weight: 60 },
        ],
      },
      {
        code: 'THE 101',
        title: 'Introduction to Christian Doctrine',
        ects: 5,
        prerequisite: 'None',
        requires: [],
        description:
          'Introduction to foundational Christian doctrines including God, humanity, sin, Christ, salvation, Holy Spirit, Church and final things.',
        assessment: [
          { item: 'Essays', weight: 30 },
          { item: 'Class presentations', weight: 10 },
          { item: 'Examination', weight: 60 },
        ],
      },
      {
        code: 'SFM 101',
        title: 'Spiritual Formation and Christian Character',
        ects: 5,
        prerequisite: 'None',
        requires: [],
        description:
          'Develops spiritual disciplines and Christian character through prayer, Scripture, worship, fasting, service, accountability and reflection.',
        practical: 'Students maintain a supervised spiritual formation journal.',
        assessment: [
          { item: 'Formation journal', weight: 30 },
          { item: 'Practical participation', weight: 30 },
          { item: 'Reflective paper', weight: 20 },
          { item: 'Oral assessment', weight: 20 },
        ],
      },
      {
        code: 'COM 101',
        title: 'Communication for Ministry',
        ects: 5,
        prerequisite: 'None',
        requires: [],
        description:
          'Develops written, oral, interpersonal and public communication skills for Christian ministry.',
        topics: [
          'Public speaking',
          'Interpersonal communication',
          'Storytelling',
          'Presentation',
          'Conflict communication',
          'Digital communication',
        ],
        assessment: [
          { item: 'Presentations', weight: 40 },
          { item: 'Written communication', weight: 20 },
          { item: 'Practical examination', weight: 40 },
        ],
      },
    ],
  },
  {
    year: 'Year One — Biblical and Ministry Foundations',
    label: 'Semester 2',
    courses: [
      {
        code: 'BIB 103',
        title: 'Biblical Interpretation and Hermeneutics',
        ects: 5,
        prerequisite: 'BIB 101 or BIB 102',
        requires: ['BIB 101', 'BIB 102'],
        description:
          'Students learn principles of biblical interpretation, context, genre, observation, interpretation and application.',
      },
      {
        code: 'THE 102',
        title: 'Theology of God, Christ and the Holy Spirit',
        ects: 5,
        prerequisite: 'THE 101',
        requires: ['THE 101'],
        description: 'Study of Trinitarian theology, Christology and Pneumatology.',
      },
      {
        code: 'BIB 104',
        title: 'Life and Ministry of Jesus Christ',
        ects: 5,
        prerequisite: 'BIB 102',
        requires: ['BIB 102'],
        description:
          'Study of the person, teaching, ministry, death, resurrection and mission of Jesus.',
      },
      {
        code: 'MIN 102',
        title: 'Prayer, Worship and Spiritual Disciplines',
        ects: 5,
        prerequisite: 'SFM 101',
        requires: ['SFM 101'],
        description:
          'Practical development of prayer, worship, fasting, meditation, spiritual disciplines and corporate spiritual life.',
      },
      {
        code: 'HIS 101',
        title: 'Church History I',
        ects: 5,
        prerequisite: 'None',
        requires: [],
        description: 'From the early Church through the Reformation.',
      },
      {
        code: 'MIN 103',
        title: 'Introduction to Preaching and Teaching',
        ects: 5,
        prerequisite: 'COM 101',
        requires: ['COM 101'],
        description:
          'Introduction to sermon preparation, Bible teaching, lesson planning and public ministry.',
      },
    ],
  },
  {
    year: 'Year Two — Ministry Formation',
    label: 'Semester 3',
    courses: [
      {
        code: 'MIN 201',
        title: 'Five-Fold Ministry',
        ects: 5,
        prerequisite: 'MIN 101, BIB 103',
        requires: ['MIN 101', 'BIB 103'],
        description:
          'Apostolic · Prophetic · Evangelistic · Pastoral · Teaching. Students examine the biblical foundations, functions, responsibilities, strengths and potential abuses associated with five-fold ministry.',
        outcomes: [
          'Explain the biblical basis of five-fold ministry.',
          'Distinguish offices, gifts and functions.',
          'Understand ministry collaboration.',
          'Identify healthy ministry accountability.',
          'Develop a personal ministry pathway.',
        ],
      },
      {
        code: 'MIN 202',
        title: 'Pastoral Ministry and Shepherding',
        ects: 5,
        prerequisite: 'MIN 101',
        requires: ['MIN 101'],
        topics: [
          'Shepherding', 'Visitation', 'Baptism', 'Communion', 'Weddings',
          'Funerals', 'Membership care', 'Crisis response', 'Pastoral ethics',
        ],
      },
      {
        code: 'EVG 201',
        title: 'Evangelism and Discipleship',
        ects: 5,
        prerequisite: 'MIN 101',
        requires: ['MIN 101'],
        description: 'Students develop practical evangelism and disciple-making skills.',
        practical: 'Supervised evangelism and discipleship activity.',
      },
      {
        code: 'THE 201',
        title: 'Theology of the Church',
        ects: 5,
        prerequisite: 'THE 102',
        requires: ['THE 102'],
        description:
          'Ecclesiology, Church identity, leadership, sacraments/ordinances, mission and community.',
      },
      {
        code: 'LEA 201',
        title: 'Christian Leadership',
        ects: 5,
        prerequisite: 'MIN 101',
        requires: ['MIN 101'],
        description: 'Leadership theory integrated with biblical servant leadership.',
        topics: [
          'Vision', 'Team building', 'Delegation', 'Decision-making',
          'Conflict', 'Accountability', 'Organizational culture',
        ],
      },
      {
        code: 'MUS 201',
        title: 'Worship and Music Ministry',
        ects: 5,
        prerequisite: 'MIN 101',
        requires: ['MIN 101'],
        description: 'For worship leaders, musicians, singers and worship coordinators.',
        topics: [
          'Theology of worship', 'Worship leadership', 'Music ministry',
          'Choir administration', 'Song selection', 'Worship planning',
          'Technical production', 'Worship-team ethics',
        ],
      },
    ],
  },
  {
    year: 'Year Two — Ministry Formation',
    label: 'Semester 4',
    courses: [
      {
        code: 'MIN 203',
        title: 'Apostolic Leadership and Church Planting',
        ects: 5,
        prerequisite: 'MIN 201',
        requires: ['MIN 201'],
        description:
          'Students study church planting, ministry multiplication, organizational development and apostolic leadership.',
      },
      {
        code: 'MIN 204',
        title: 'Prophetic Ministry and Spiritual Discernment',
        ects: 5,
        prerequisite: 'MIN 201',
        requires: ['MIN 201'],
        topics: [
          'Biblical prophecy', 'Prophetic ministry', 'Discernment',
          'Accountability', 'Ethics', 'Avoiding manipulation and spiritual abuse',
        ],
      },
      {
        code: 'MIN 205',
        title: 'Christian Education and Discipleship',
        ects: 5,
        prerequisite: 'MIN 103',
        requires: ['MIN 103'],
        description: 'Design and management of Christian educational programmes.',
      },
      {
        code: 'PAS 201',
        title: 'Pastoral Care and Christian Counseling',
        ects: 5,
        prerequisite: 'MIN 202',
        requires: ['MIN 202'],
        description:
          'Introduction to pastoral counseling, grief, marriage, family, crisis and referral practices.',
      },
      {
        code: 'ADM 201',
        title: 'Church Administration and Management',
        ects: 5,
        prerequisite: 'LEA 201',
        requires: ['LEA 201'],
        topics: [
          'Church structures', 'Governance', 'Records', 'Human resources',
          'Meetings', 'Policies', 'Planning', 'Risk management', 'Ministry operations',
        ],
      },
      {
        code: 'FIN 201',
        title: 'Christian Finance and Stewardship',
        ects: 5,
        // AS WRITTEN. ADM 201 is in this same semester; see finding 1.
        prerequisite: 'ADM 201',
        requires: ['ADM 201'],
        topics: [
          'Biblical stewardship', 'Church budgeting', 'Financial controls',
          'Fundraising', 'Accountability', 'Financial reporting', 'Ethical management',
        ],
      },
    ],
  },
  {
    year: 'Year Three — Professional, Missional and Specialized Ministry',
    label: 'Semester 5',
    courses: [
      {
        code: 'MIS 301',
        title: 'Missions and Cross-Cultural Ministry',
        ects: 5,
        prerequisite: 'EVG 201',
        requires: ['EVG 201'],
        description:
          'Study of missions, culture, contextualization, global Christianity and cross-cultural communication.',
      },
      {
        code: 'COM 301',
        title: 'Christian Media and Communications',
        ects: 5,
        prerequisite: 'COM 101',
        requires: ['COM 101'],
        topics: [
          'Photography', 'Video', 'Broadcasting', 'Social media', 'Podcasting',
          'Christian journalism', 'Digital storytelling', 'Communication strategy',
        ],
      },
      {
        code: 'ITM 301',
        title: 'Information Technology for Ministry',
        ects: 5,
        prerequisite: 'COM 101',
        requires: ['COM 101'],
        description: 'A distinctive modern ministry course.',
        topics: [
          'Church information systems', 'Websites', 'Online services', 'Streaming',
          'Church management systems', 'Cybersecurity awareness', 'Digital records',
          'AI-assisted ministry', 'Online discipleship', 'Digital evangelism',
        ],
      },
      {
        code: 'YTH 301',
        title: 'Youth and Children’s Ministry',
        ects: 5,
        prerequisite: 'MIN 205',
        requires: ['MIN 205'],
        description:
          'Developmentally appropriate ministry for children, adolescents and young adults.',
      },
      {
        code: 'COM 302',
        title: 'Community Development and Social Ministry',
        ects: 5,
        // AS WRITTEN. MIS 301 is in this same semester; see finding 1. The COM
        // prefix is finding 3.
        prerequisite: 'MIS 301',
        requires: ['MIS 301'],
        description:
          'Students explore Christian responses to poverty, education, health, social justice, community development and humanitarian needs.',
      },
      {
        code: 'RES 301',
        title: 'Research Methods for Ministry',
        ects: 5,
        prerequisite: 'At least 60 ECTS completed',
        requires: [],
        requiresEcts: 60,
        topics: [
          'Research design', 'Literature review', 'Qualitative research',
          'Quantitative research', 'Interviews', 'Surveys', 'Ethics',
          'Academic writing', 'Citation',
        ],
      },
    ],
  },
  {
    year: 'Year Three — Professional, Missional and Specialized Ministry',
    label: 'Semester 6',
    courses: [
      {
        code: 'MIN 306',
        title: 'Advanced Ministry Leadership',
        ects: 5,
        prerequisite: 'LEA 201, MIN 203',
        requires: ['LEA 201', 'MIN 203'],
        description: 'Advanced organizational and spiritual leadership.',
      },
      {
        code: 'MIN 307',
        title: 'Ministry Ethics, Governance and Accountability',
        ects: 5,
        prerequisite: 'ADM 201',
        requires: ['ADM 201'],
        topics: [
          'Ministerial ethics', 'Power and authority', 'Sexual ethics',
          'Financial accountability', 'Safeguarding', 'Governance',
          'Transparency', 'Conflict of interest', 'Leadership accountability',
        ],
      },
      {
        code: 'MIN 308',
        title: 'Ministry Practicum',
        ects: 10,
        prerequisite: 'Minimum 120 ECTS',
        requires: [],
        requiresEcts: 120,
        description: 'Supervised practical ministry placement.',
      },
      {
        code: 'RES 302',
        title: 'Bachelor Ministry Research Project',
        ects: 10,
        prerequisite: 'RES 301',
        requires: ['RES 301'],
        description:
          'Students conduct an approved research project addressing a significant biblical, theological, ministry, organizational or community issue.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// THE SPECIALIZATION TRACKS.
//
// Fourteen, lettered A to N. The framework describes them as tracks the School
// "should eventually offer" and as electives — see finding 2, which is that the
// six-semester plan contains no elective slot to take one in.
// ---------------------------------------------------------------------------

export interface BminTrack {
  letter: string;
  name: string;
  courses: { code: string; title: string }[];
  /** Where the framework named the roles a track prepares for. */
  prepares?: string[];
  /** Where the framework attached a caution or a note to the track. */
  note?: string;
}

export const bminTracks: BminTrack[] = [
  {
    letter: 'A',
    name: 'Apostolic Leadership & Church Planting',
    courses: [
      { code: 'APL 401', title: 'Apostolic Theology' },
      { code: 'APL 402', title: 'Church Planting Strategies' },
      { code: 'APL 403', title: 'Multiplication and Movement Leadership' },
      { code: 'APL 404', title: 'Apostolic Organization and Networks' },
    ],
    prepares: [
      'Church planting', 'Network leadership', 'Ministry development',
      'Regional leadership', 'Mission expansion',
    ],
  },
  {
    letter: 'B',
    name: 'Prophetic Ministry',
    courses: [
      { code: 'PRP 401', title: 'Biblical Prophetic Ministry' },
      { code: 'PRP 402', title: 'Prophetic Discernment' },
      { code: 'PRP 403', title: 'Prophetic Ethics and Accountability' },
      { code: 'PRP 404', title: 'Prophetic Ministry in the Contemporary Church' },
    ],
  },
  {
    letter: 'C',
    name: 'Evangelism & Missions',
    courses: [
      { code: 'MIS 401', title: 'Advanced Evangelism' },
      { code: 'MIS 402', title: 'Cross-Cultural Missions' },
      { code: 'MIS 403', title: 'Mission Strategy and Church Multiplication' },
      { code: 'MIS 404', title: 'Global Mission Practicum' },
    ],
  },
  {
    letter: 'D',
    name: 'Pastoral Ministry',
    courses: [
      { code: 'PAS 401', title: 'Advanced Pastoral Leadership' },
      { code: 'PAS 402', title: 'Marriage and Family Ministry' },
      { code: 'PAS 403', title: 'Crisis and Grief Ministry' },
      { code: 'PAS 404', title: 'Pastoral Practicum' },
    ],
  },
  {
    letter: 'E',
    name: 'Teaching & Christian Education',
    courses: [
      { code: 'EDM 401', title: 'Theology of Christian Education' },
      { code: 'EDM 402', title: 'Curriculum Development' },
      { code: 'EDM 403', title: 'Teaching Ministry' },
      { code: 'EDM 404', title: 'Christian Education Practicum' },
    ],
  },
  {
    letter: 'F',
    name: 'Worship & Music Ministry',
    courses: [
      { code: 'WOR 401', title: 'Advanced Worship Leadership' },
      { code: 'WOR 402', title: 'Music Ministry Administration' },
      { code: 'WOR 403', title: 'Worship Production and Technology' },
      { code: 'WOR 404', title: 'Worship Ministry Practicum' },
    ],
  },
  {
    letter: 'G',
    name: 'Prayer & Intercession',
    courses: [
      { code: 'PRI 401', title: 'Theology of Prayer' },
      { code: 'PRI 402', title: 'Intercession and Spiritual Formation' },
      { code: 'PRI 403', title: 'Prayer Ministry Leadership' },
      { code: 'PRI 404', title: 'Prayer Ministry Practicum' },
    ],
  },
  {
    letter: 'H',
    name: 'Christian Counseling & Pastoral Care',
    courses: [
      { code: 'COU 401', title: 'Advanced Christian Counseling' },
      { code: 'COU 402', title: 'Marriage and Family Ministry' },
      { code: 'COU 403', title: 'Trauma, Grief and Crisis Care' },
      { code: 'COU 404', title: 'Pastoral Counseling Practicum' },
    ],
    note:
      'The programme should clearly distinguish pastoral counseling from regulated clinical or psychological practice where professional licensure is required.',
  },
  {
    letter: 'I',
    name: 'Church Administration & Management',
    courses: [
      { code: 'ADM 401', title: 'Advanced Church Administration' },
      { code: 'ADM 402', title: 'Human Resource Management in Ministry' },
      { code: 'ADM 403', title: 'Strategic Planning for Churches' },
      { code: 'ADM 404', title: 'Ministry Operations Practicum' },
    ],
  },
  {
    letter: 'J',
    name: 'Christian Finance & Stewardship',
    courses: [
      { code: 'FIN 401', title: 'Advanced Ministry Finance' },
      { code: 'FIN 402', title: 'Church Accounting' },
      { code: 'FIN 403', title: 'Fundraising and Resource Development' },
      { code: 'FIN 404', title: 'Financial Governance and Audit' },
    ],
  },
  {
    letter: 'K',
    name: 'Media & Digital Ministry',
    courses: [
      { code: 'MED 401', title: 'Digital Ministry Strategy' },
      { code: 'MED 402', title: 'Christian Broadcasting' },
      { code: 'MED 403', title: 'Social Media and Digital Evangelism' },
      { code: 'MED 404', title: 'Media Production Practicum' },
    ],
  },
  {
    letter: 'L',
    name: 'IT & Technology Ministry',
    courses: [
      { code: 'ITM 401', title: 'Church Technology Systems' },
      { code: 'ITM 402', title: 'Digital Transformation for Ministry' },
      { code: 'ITM 403', title: 'Artificial Intelligence and Ministry' },
      { code: 'ITM 404', title: 'Cybersecurity and Digital Ethics' },
    ],
    prepares: [
      'Church management systems', 'Websites', 'Streaming platforms',
      'Online learning', 'Digital archives', 'AI assistants',
      'Digital evangelism', 'Cybersecurity', 'Data management',
    ],
    note: 'One of the School’s distinctive future-facing tracks.',
  },
  {
    letter: 'M',
    name: 'Youth & Children’s Ministry',
    courses: [
      { code: 'YCM 401', title: 'Theology of Children and Youth Ministry' },
      { code: 'YCM 402', title: 'Youth Leadership' },
      { code: 'YCM 403', title: 'Children’s Ministry Development' },
      { code: 'YCM 404', title: 'Youth and Children’s Ministry Practicum' },
    ],
  },
  {
    letter: 'N',
    name: 'Christian Entrepreneurship',
    courses: [
      { code: 'ENT 401', title: 'Christian Entrepreneurship' },
      { code: 'ENT 402', title: 'Social Enterprise and Kingdom Business' },
      { code: 'ENT 403', title: 'Innovation and Leadership' },
      { code: 'ENT 404', title: 'Entrepreneurship Practicum' },
    ],
  },
];

// ---------------------------------------------------------------------------
// THE FIVE-FOLD MODEL.
//
// The framework's own formulation: five functions taught as interdependent
// rather than as five separate programmes.
// ---------------------------------------------------------------------------

export const bminFiveFold = [
  { function: 'Apostolic', verb: 'Build', body: 'Church planting, systems, pioneering, multiplication and strategic leadership.' },
  { function: 'Prophetic', verb: 'Discern', body: 'Biblical proclamation, spiritual discernment, justice, truth and accountability.' },
  { function: 'Evangelistic', verb: 'Reach', body: 'Evangelism, missions, outreach and multiplication of disciples.' },
  { function: 'Pastoral', verb: 'Shepherd', body: 'Care, protection, healing, discipleship and community.' },
  { function: 'Teaching', verb: 'Ground', body: 'Scripture, doctrine, Christian education and theological formation.' },
];

export const bminFiveFoldPrinciple =
  'The healthiest ministry environment allows these functions to work together rather than compete with one another.';

/** §15 — the ministries the Church needs beyond the five-fold functions. */
export const bminSupportSpecialisations = [
  { name: 'Worship', body: 'Singers, musicians, worship leaders and production teams.' },
  { name: 'Giving & Stewardship', body: 'Financial stewardship, fundraising and resource development.' },
  { name: 'Administration', body: 'Church operations, records, governance and organizational systems.' },
  { name: 'IT Ministry', body: 'Technology, websites, digital systems, AI and cybersecurity.' },
  { name: 'Media', body: 'Video, photography, broadcasting, social media and communications.' },
  { name: 'Education', body: 'Sunday school, Bible school, discipleship and Christian education.' },
  { name: 'Youth', body: 'Youth leadership and adolescent discipleship.' },
  { name: 'Children', body: 'Children’s discipleship and educational ministry.' },
  { name: 'Prayer', body: 'Intercession and prayer leadership.' },
  { name: 'Missions', body: 'Cross-cultural ministry and missions.' },
  { name: 'Community Development', body: 'Christian social action and community transformation.' },
];

export const bminSupportPrinciple = 'The ministry of the Church is larger than the pulpit.';

// ---------------------------------------------------------------------------
// PRACTICUM, ASSESSMENT AND FORMATION.
// ---------------------------------------------------------------------------

export const bminPracticum = {
  principle: 'The practicum is a central component of the programme. It should not be treated as simply another classroom course.',
  settings: [
    'Church', 'Mission', 'Christian organization', 'School',
    'Community development project', 'Media ministry', 'Worship ministry',
    'Christian NGO', 'Administrative ministry', 'Digital ministry',
    'Other approved ministry setting',
  ],
  activities: [
    'Preaching', 'Teaching', 'Evangelism', 'Discipleship', 'Worship',
    'Prayer ministry', 'Children’s ministry', 'Youth ministry',
    'Administration', 'Media', 'IT', 'Missions', 'Community development',
    'Pastoral visitation', 'Leadership', 'Event organization',
  ],
  portfolio: [
    'Ministry placement agreement.',
    'Supervisor evaluation.',
    'Ministry activity log.',
    'Reflective journal.',
    'Evidence of ministry projects.',
    'Ministry development plan.',
    'Final practicum report.',
    'Oral presentation.',
  ],
};

/**
 * §16 — indicative weight ranges, not per-course marks.
 *
 * These are ranges the School applies across the programme; the per-course
 * breakdowns are on the courses themselves, where the framework supplied them.
 */
export const bminAssessmentFramework = [
  { kind: 'Written examinations', range: '30–50%' },
  { kind: 'Research papers', range: '10–30%' },
  { kind: 'Practical ministry', range: '20–40%' },
  { kind: 'Presentations', range: '10–20%' },
  { kind: 'Projects', range: '10–30%' },
  { kind: 'Ministry journals', range: '10–20%' },
  { kind: 'Practicum evaluation', range: '40–60%' },
  { kind: 'Capstone/dissertation', range: '100% of designated course' },
];

export const bminAssessmentPrinciple =
  'Assessment should measure both what the student knows and what the student can actually do.';

export const bminFormationPortfolio = [
  'Spiritual development', 'Ministry calling', 'Sermons', 'Teaching plans',
  'Evangelism experience', 'Discipleship experience', 'Leadership experience',
  'Ministry projects', 'Community service', 'Practicum',
  'Personal reflections', 'Supervisor evaluations', 'Professional development',
];

export const bminEntry = [
  'A recognized secondary/high-school qualification or equivalent.',
  'Evidence of ability to undertake university-level study.',
  'Application documentation required by the University.',
  'Where applicable, recognition of prior learning or approved transfer credit.',
];

export const bminEntryNote =
  'The University may establish alternative admission routes for mature applicants, ministers and applicants with substantial professional or ministry experience, subject to institutional regulations.';

export const bminProgression = [
  'Successfully complete required courses.',
  'Meet prerequisite requirements.',
  'Complete practical ministry requirements.',
  'Complete the practicum.',
  'Complete the research project.',
  'Satisfy University graduation requirements.',
];

export const bminRpl = {
  intro: 'The School may establish a formal Recognition of Prior Learning (RPL) framework. Relevant prior learning may include:',
  items: [
    'Previous university study', 'Bible school', 'Seminary training',
    'Ministry certificates', 'Professional qualifications',
    'Documented ministry experience',
  ],
  note: 'Credit should be awarded only through the University’s approved academic procedures and assessment mechanisms.',
};

export const bminIntegrity = [
  'Academic honesty', 'Proper citation', 'Original work',
  'Respect for intellectual property', 'Responsible use of AI',
  'Honest reporting of research', 'Professional conduct',
];

export const bminIntegrityNote =
  'Use of artificial intelligence should support learning rather than replace the student’s own academic responsibility.';

export const bminEthics = [
  'Integrity', 'Accountability', 'Humility', 'Respect', 'Confidentiality',
  'Financial responsibility', 'Appropriate use of authority',
  'Sexual and relational integrity', 'Protection of vulnerable persons',
  'Responsible leadership', 'Respect for the law',
  'Respect for institutional governance',
];

export const bminSafeguarding = [
  'Children', 'Vulnerable adults', 'Abuse prevention',
  'Reporting responsibilities', 'Boundaries', 'Pastoral confidentiality',
  'Appropriate ministerial relationships', 'Digital safeguarding',
];

export const bminCapstoneRequirements = [
  'Identification of a ministry problem.',
  'Literature review.',
  'Biblical/theological analysis.',
  'Research methodology.',
  'Data or ministry evidence.',
  'Analysis.',
  'Practical recommendations.',
  'Academic presentation.',
];

export const bminCapstoneTopics = [
  'Church growth', 'Discipleship', 'African Christianity', 'Evangelism',
  'Youth ministry', 'Worship', 'Digital ministry', 'AI and the Church',
  'Church administration', 'Christian leadership', 'Missions',
  'Pastoral care', 'Christian education', 'Community transformation',
  'Theology and African society',
];

/**
 * §25 — the ladder the School should build.
 *
 * PUBLISHED AS INTENT, NOT AS PROVISION. Four of these awards exist on this
 * site now; the rest are the School's stated academic progression and are
 * labelled as proposed on the page. A university that lists a doctorate it does
 * not yet run has said something an applicant may act on.
 */
export const bminLadder = [
  { award: 'Certificate in Ministry', credits: '60 ECTS', body: 'Foundation-level ministry education.' },
  { award: 'Diploma in Ministry', credits: '120 ECTS', body: 'Professional ministry preparation.' },
  { award: 'Bachelor of Ministry', credits: '180 ECTS', body: 'Comprehensive undergraduate ministry education.' },
  { award: 'Master of Ministry', credits: '120 ECTS', body: 'Advanced professional ministry leadership and specialization.' },
  { award: 'Master of Theology', credits: '120 ECTS', body: 'Advanced theological scholarship.' },
  { award: 'Doctor of Ministry', credits: 'Professional doctorate', body: 'Professional doctoral ministry programme.' },
  { award: 'PhD in Theology / Ministry', credits: 'Research doctorate', body: 'Subject to the University’s doctoral regulations and applicable academic requirements.' },
];

export const bminMastersSpecialisations = [
  'Strategic Church Leadership', 'Apostolic Leadership', 'Pastoral Theology',
  'Evangelism and Missions', 'Christian Education', 'Worship Leadership',
  'Christian Counseling', 'Church Administration', 'Digital Ministry',
  'Christian Media', 'Community Transformation', 'African Christian Leadership',
];

export const bminDistinctive = {
  formula: [
    'Biblical depth', 'theological rigour', 'spiritual formation',
    'practical ministry', 'professional competence', 'technology', 'mission',
  ],
  trains: [
    'apostles', 'prophets', 'evangelists', 'teachers', 'worship leaders',
    'missionaries', 'counselors', 'educators', 'administrators',
    'financial stewards', 'media ministers', 'IT ministers', 'youth leaders',
    'children’s workers', 'entrepreneurs', 'community leaders',
  ],
  statement: 'The School of Ministry should not become simply another Bible school.',
};

// ---------------------------------------------------------------------------
// THE FOUR OPEN QUESTIONS.
//
// Published, not buried. Each is a decision only the university can make, each
// is the kind of thing an approval panel raises first, and each has a
// recommended resolution so the decision is a yes or a no rather than a piece
// of homework.
// ---------------------------------------------------------------------------

export interface BminOpenQuestion {
  id: string;
  finding: string;
  detail: string;
  recommendation: string;
}

export const BMIN_OPEN_QUESTIONS: BminOpenQuestion[] = [
  {
    id: 'same-semester-prerequisites',
    finding: 'Two prerequisites cannot be satisfied as written.',
    detail:
      'FIN 201 Christian Finance and Stewardship names ADM 201 as its prerequisite, and both are in Semester 4. '
      + 'COM 302 Community Development and Social Ministry names MIS 301, and both are in Semester 5. '
      + 'A student cannot complete a course before one they are taking in the same term, so as written no student can enrol in either course on the published plan.',
    recommendation:
      'Redesignate both as co-requisites — taken alongside rather than before. That preserves the academic intent, which is plainly that the finance course builds on the administration course, without moving either course between semesters or disturbing the 30-ECTS balance.',
  },
  {
    id: 'no-elective-slot',
    finding: 'The fourteen specialization tracks have nowhere to go.',
    detail:
      'The component table allocates 12 ECTS to Elective/Specialization Studies, and §12 says a specialization is taken as part of that requirement. '
      + 'But all six semesters are filled to 30 ECTS with required courses, and a track is four courses. '
      + 'A student cannot take a specialization without exceeding 180 ECTS or displacing a required course, so at present the tracks are describable but not enrollable.',
    recommendation:
      'Designate specific Year Three slots as elective. Semesters 5 and 6 are where the specialised courses already sit, and converting a defined number of ECTS there into elective capacity would make the tracks real without changing the total. Which courses become optional is an academic judgement for the School, so no slot has been designated here.',
  },
  {
    id: 'com-prefix-collision',
    finding: 'COM is used for two different subjects.',
    detail:
      'COM 101 Communication for Ministry and COM 301 Christian Media and Communications are communication courses. '
      + 'COM 302 Community Development and Social Ministry is not. '
      + 'On a transcript, “COM 301, COM 302” reads as a two-part communications sequence, and a transcript is what a credential evaluator or a receiving university actually reads.',
    recommendation:
      'Give Community Development its own prefix — CDV 301 or SOC 301 — before the first cohort is enrolled. Renumbering a course after a transcript has been issued is a records problem for the lifetime of the award.',
  },
  {
    id: 'track-course-levels',
    finding: 'The track courses are numbered above the programme’s own ceiling.',
    detail:
      'The required curriculum runs 100 to 300 across three years. Every specialization track course is numbered at 400 — APL 401, PRP 401, ITM 401 and so on. '
      + 'On a three-year, 180-ECTS bachelor a 400-level code conventionally signals fourth-year or postgraduate study.',
    recommendation:
      'Renumber the track courses at 300 level if they are undergraduate electives within the B.Min., or state explicitly that they are shared with the Master of Ministry and carry postgraduate level. Either answer is defensible; leaving it unstated is the thing that is not.',
  },
];

// ---------------------------------------------------------------------------
// DERIVED FIGURES. Counted, never typed.
// ---------------------------------------------------------------------------

export const semesterEcts = (s: BminSemester): number =>
  s.courses.reduce((n, c) => n + c.ects, 0);

export const bminTotalEcts: number = bminSemesters.reduce((n, s) => n + semesterEcts(s), 0);

export const bminCourseCount: number = bminSemesters.reduce((n, s) => n + s.courses.length, 0);

export const bminComponentTotal: number = bminComponents.reduce((n, c) => n + c.ects, 0);

export const bminTrackCourseCount: number = bminTracks.reduce((n, t) => n + t.courses.length, 0);

/** Every course in the plan, flattened, in the order it is taught. */
export const bminAllCourses: BminCourse[] = bminSemesters.flatMap((s) => s.courses);
