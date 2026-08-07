// ---------------------------------------------------------------------------
// Faculties and schools — the university's academic structure as real records.
//
// WHY THIS FILE EXISTS. `faculties.items` in site.ts was an array of five
// strings. That is why /faculty rendered five name chips and nothing else:
// there was nothing else to render. Every other piece of the picture existed
// but could not be joined to it — twelve programmes tagged by `school`,
// thirty-nine courses tagged by `faculty`, directors sitting in the
// administration roster, and four faculty photographs in /public.
//
// Three naming systems disagreed, which is what actually blocked the join:
//
//   faculties.items   "Faculty of Engineering and Technology"
//   programs.school   "Faculty of Engineering and Technology"
//   courses.faculty   "Engineering & Technology"
//
//   faculties.items   "Global Institute of Business and Management Science (GIBMAS)"
//   programs.school   "Global Institute of Business and Management Science (GIBMAS)"
//   courses.faculty   "GIBMAS — Business & Management"
//
// Each faculty now carries BOTH spellings — `programSchool` and
// `courseFaculty` — so nothing has to be renamed in either source file and
// no existing link breaks. The helpers at the bottom do the joining.
//
// PROVENANCE. The dean's messages, the "stands for" statements, the pillars,
// research strengths and graduate destinations — and for Theology also the
// About, Vision, Mission, Core Values, Why Study, declared award list,
// Student Experience, Partnerships and Careers — were supplied by the
// university in its own words and are reproduced verbatim. Names, campuses
// and photographs are drawn from content recovered from the university's own
// site.
//
// NOT PUBLISHED, deliberately. The same material also proposed academic
// departments ("The Faculty MAY be organised into academic departments such
// as…") and research centres ("Research Centres (RECOMMENDED)"). Both are
// proposals, not statements of fact, and a prospective student reading a
// department list has no way to tell the difference. They are recorded in
// docs/FACULTY-PAGES.md awaiting confirmation rather than rendered as though
// they already exist.
// ---------------------------------------------------------------------------

/** One award the faculty says it offers, at a given level. */
export interface FacultyAward {
  title: string;
  level: 'Certificate' | 'Diploma' | 'Bachelor' | 'Master' | 'Doctorate';
  /**
   * Slug of the matching entry in `programs`. An award the faculty has
   * declared but for which no programme record exists yet carries no slug —
   * the page then renders it as plain text and says details are to follow.
   * Never invent a slug to make a chip clickable.
   */
  slug?: string;
}

export interface Faculty {
  slug: string;
  /** Full name as the university publishes it. */
  name: string;
  /** Short form for cards and breadcrumbs. */
  shortName: string;
  campus: string;
  image: string;
  /** One line — what this faculty is for. */
  standsFor: string;
  /** Longer description shown on the faculty's own page. */
  description: string[];
  /** Matches `school` on entries in `programs`. */
  programSchool?: string;
  /** Matches `faculty` on entries in `courses`. */
  courseFaculty?: string;
  /** Name of the director or dean, as listed in `administration`. */
  leadName?: string;
  /** What the lead is called here — "Dean", "Director", "Campus Director". */
  leadTitle?: string;
  /** The dean's own welcome, in their words. */
  deansMessage?: string[];
  /** Longer "About the Faculty" prose, where the faculty has supplied it. */
  about?: string[];
  /** Expansion of `standsFor` — the paragraphs beneath the one-liner. */
  standsForBody?: string[];
  /** The pillars the "stands for" statement rests on. */
  pillars?: string[];
  vision?: string;
  mission?: string[];
  coreValues?: string[];
  whyStudy?: string[];
  /** The faculty's own declared list of awards, by level. */
  awards?: FacultyAward[];
  researchStrengths?: string[];
  /** Learning beyond the lecture room. */
  studentExperience?: string[];
  /** Bodies the faculty collaborates with. */
  partnerships?: string[];
  /** Fields graduates enter. */
  careers?: string[];
  /** Roles graduates hold. */
  graduateDestinations?: string[];
  /**
   * Where graduates go on to study. Named per faculty rather than written into
   * the page, because the onward disciplines differ: Theology's graduates read
   * missiology, Engineering's do not.
   */
  postgraduateNote?: string;
  /** Degree pages belonging to this faculty. */
  degrees?: { label: string; href: string }[];
  /**
   * Slug of the faculty whose programmes and courses this one also delivers.
   * Set where a school is a second campus teaching the same provision rather
   * than a separate body of study — the university confirmed Buea and Douala
   * share their materials. Both pages then show the same programmes and
   * courses, and each says plainly that it does, so a prospective student is
   * never left wondering whether the two lists differ.
   */
  sharesProvisionWith?: string;
}

export const facultyList: Faculty[] = [
  {
    slug: 'theology-buea',
    name: 'Faculty of Theology',
    shortName: 'Theology',
    campus: 'Buea, Cameroon',
    image: '/images/wp/fac-theology.jpg',
    standsFor:
      'To develop biblically grounded, spiritually mature, academically competent and mission-oriented Christian leaders for the global Church.',
    description: [
      'The Faculty of Theology is where ICOF Global University began, and it remains the largest body of provision in the institution. It trains ministers, scholars, chaplains, Christian educators and researchers, combining rigorous academic study with spiritual formation and supervised practical ministry.',
      'Teaching runs from certificate level to doctoral research. The faculty is home to the Bachelor of Theology, the Master of Theology and the Master of Arts in Black Liberation Theology, and doctoral work is examined by the Dissertation Council under Professor Emeritus Arch Bishop Godfred Anyere Tah.',
      'The faculty is deliberately not confined to Western theological traditions. African Theology, Contextual Theology and Global Christianity run through the curriculum, and students are introduced to theological voices from Africa, Asia, Latin America, Europe and North America.',
    ],
    about: [
      'The Faculty of Theology at ICOF Global University is one of the University’s founding faculties and has served as a centre for biblical scholarship, ministerial formation, and Christian leadership for many years. Established to equip men and women for effective ministry in Africa and throughout the world, the Faculty combines rigorous academic study with spiritual formation and practical ministry.',
      // "Diploma" in the supplied text; corrected to "Certificate" on the
      // university's confirmation that the Faculty does award at certificate
      // level. This and the matching line in `whyStudy` are the only two edits
      // made to any copy the faculties sent.
      'The Faculty offers programmes from Certificate through Doctor of Philosophy (Ph.D.), preparing pastors, missionaries, theologians, educators, chaplains, counsellors, and Christian leaders for service in churches, educational institutions, humanitarian organisations, and public life.',
      'Students engage deeply with the Holy Scriptures, Christian doctrine, church history, biblical languages, pastoral ministry, missiology, ethics, contextual theology, African theology, and leadership while developing research skills appropriate for postgraduate study and lifelong ministry.',
      'Graduates become part of a growing international network of Christian leaders serving across Africa, Europe, North America, Asia, Latin America, and the Middle East.',
    ],
    deansMessage: [
      'Welcome to the Faculty of Theology of ICOF Global University.',
      'For many years, our Faculty has been committed to preparing men and women who faithfully interpret the Holy Scriptures, serve the Body of Messiah with integrity, and provide transformational leadership to churches and communities around the world. Our mission is not simply to educate students academically, but to form disciples, scholars, pastors, missionaries, educators, and Christian leaders whose lives reflect the character of Yahusha the Messiah.',
      'Our curriculum combines biblical studies, systematic theology, church history, missiology, pastoral ministry, contextual theology, African theology, leadership, and research. Students are challenged to think critically, engage contemporary issues biblically, and minister effectively within diverse cultural contexts.',
      'Whether you are preparing for pastoral ministry, missionary service, theological research, chaplaincy, Christian education, or leadership in public life, the Faculty of Theology provides a learning environment that integrates scholarship, spiritual formation, and practical ministry.',
      'We invite you to join a global community committed to serving Yahuah through knowledge, faith, and compassionate leadership.',
    ],
    standsForBody: [
      'The Faculty of Theology exists to develop biblically grounded, spiritually mature, academically competent, and mission-oriented Christian leaders for the global Church.',
      'The Faculty affirms that theology must not remain within the classroom but must shape worship, discipleship, social transformation, and faithful witness in every nation.',
    ],
    pillars: [
      'Biblical authority and faithful interpretation of Scripture.',
      'Academic excellence in theological scholarship.',
      'Spiritual formation and Christian character.',
      'Practical ministry and servant leadership.',
      'Global mission and contextual engagement.',
    ],
    vision:
      'To be a globally recognised centre of excellence in theological education, biblical scholarship, Christian leadership, and transformational ministry, equipping servant leaders who faithfully proclaim the Gospel and contribute to the flourishing of churches and societies worldwide.',
    mission: [
      'Provide biblically grounded and academically rigorous theological education.',
      'Prepare pastors, missionaries, educators, and Christian leaders for effective ministry.',
      'Promote research addressing the challenges facing the Church and society.',
      'Foster spiritual maturity, ethical leadership, and servant ministry.',
      'Equip graduates to engage cultures with wisdom, compassion, and biblical conviction.',
    ],
    coreValues: [
      'Biblical Authority',
      'Academic Excellence',
      'Spiritual Formation',
      'Integrity',
      'Servant Leadership',
      'Innovation',
      'Global Mission',
      'Community Engagement',
      'Diversity and Inclusion',
      'Lifelong Learning',
    ],
    whyStudy: [
      'Internationally structured programmes',
      'Flexible online and campus learning',
      'Experienced faculty and ministry practitioners',
      'Practical ministry placements',
      'Research-led teaching',
      'Affordable tuition',
      'Global student community',
      'Strong emphasis on leadership development',
      'Integration of faith, scholarship, and ministry',
      // "Diploma to Ph.D." in the supplied text — see the note on `about`.
      'Clear progression from Certificate to Ph.D.',
    ],
    // Every award the faculty offers, each with its own page. The university
    // confirmed the certificate level, added Black Liberation Theology to the
    // list, and confirmed that Divinity and Ministry are separate awards at
    // every level rather than two names for one degree.
    awards: [
      { title: 'Certificate of Theology', level: 'Certificate', slug: 'certificate-in-theology' },
      { title: 'Certificate of Christian Education', level: 'Certificate', slug: 'certificate-in-christian-education' },
      { title: 'Diploma in Theology', level: 'Diploma', slug: 'diploma-in-theology' },
      { title: 'Bachelor of Theology (B.Th.)', level: 'Bachelor', slug: 'bachelor-of-theology' },
      { title: 'Bachelor of Divinity (B.D.)', level: 'Bachelor', slug: 'divinity' },
      { title: 'Bachelor of Christian Education', level: 'Bachelor', slug: 'bachelor-of-christian-education' },
      { title: 'Master of Theology (M.Th.)', level: 'Master', slug: 'master-of-theology' },
      { title: 'Master of Divinity (M.Div.)', level: 'Master', slug: 'master-of-divinity' },
      { title: 'Master of Arts in Black Liberation Theology', level: 'Master', slug: 'black-liberation-theology' },
      { title: 'Doctor of Philosophy (Ph.D.) in Theology', level: 'Doctorate', slug: 'doctor-of-philosophy-theology' },
      { title: 'Doctor of Theology (D.Th.)', level: 'Doctorate', slug: 'doctor-of-theology' },
      { title: 'Doctor of Systematic Theology (DSTh)', level: 'Doctorate', slug: 'doctor-of-systematic-theology' },
    ],
    researchStrengths: [
      'Biblical Theology',
      'Old and New Testament Studies',
      'Systematic Theology',
      'African Theology',
      'Contextual Theology',
      'Church History',
      'Missiology and World Christianity',
      'Pentecostal and Charismatic Studies',
      'Practical Theology',
      'Christian Leadership',
      'Christian Ethics',
      'Biblical Languages',
      'Public Theology',
      'Religion and Society',
      'Peace, Justice and Reconciliation',
      'Ecotheology',
      'Digital Ministry and Artificial Intelligence',
      'African Biblical Interpretation',
    ],
    studentExperience: [
      'Chapel services',
      'Prayer retreats',
      'Community outreach',
      'Mission internships',
      'Leadership conferences',
      'Student theological societies',
      'Research seminars',
      'Ministry practicums',
      'International conferences',
      'Community service initiatives',
    ],
    partnerships: [
      'Churches',
      'Bible colleges',
      'Universities',
      'Seminaries',
      'Mission agencies',
      'NGOs',
      'Research institutes',
      'Christian publishers',
    ],
    careers: [
      'Church ministry',
      'Missions',
      'Christian education',
      'Chaplaincy',
      'Higher education',
      'Non-profit leadership',
      'Community development',
      'Public policy',
      'Publishing',
      'Media',
      'Research',
      'Humanitarian work',
      'Counselling',
      'Leadership development',
    ],
    graduateDestinations: [
      'Pastors',
      'Evangelists',
      'Missionaries',
      'Church Planters',
      'Bishops',
      'Christian Educators',
      'Seminary Lecturers',
      'Chaplains',
      'Researchers',
      'Bible Translators',
      'Community Development Practitioners',
      'NGO Leaders',
      'Humanitarian Workers',
      'Public Servants',
      'Christian Media Professionals',
    ],
    postgraduateNote:
      'Many graduates continue to Master’s and Doctoral studies in Theology, Biblical Studies, Religious Studies, Education, Leadership, or Missiology.',
    programSchool: 'Faculty of Theology',
    courseFaculty: 'Faculty of Theology',
    sharesProvisionWith: 'theology-douala',
    leadName: 'Rev Momfor Phillip, M.Th',
    leadTitle: 'Dean',
    degrees: [
      { label: 'Bachelor of Theology', href: '/bachelor-of-theology' },
      { label: 'Master of Theology', href: '/master-of-theology' },
      { label: 'M.A. Black Liberation Theology', href: '/black-liberation-theology' },
      { label: 'Roots of Faith (position paper)', href: '/roots-of-faith' },
    ],
  },
  {
    // =====================================================================
    // THE SCHOOL OF MINISTRY — opened on the university's instruction.
    //
    // Nothing here is invented. The six awards below MOVED from the Faculty
    // of Theology's list; they are the same six the `school` field now points
    // here in site.ts, and the division is the one the catalogue's own
    // summaries already drew — training to DO the work of ministry, as
    // against studying the discipline of theology. The Faculty of Theology
    // keeps Theology, Divinity, Christian Education, Black Liberation
    // Theology and its three research doctorates.
    //
    // The prose is written from those six programme records and from what the
    // university already publishes about ministerial formation. It claims no
    // dean, no campus of its own, no partnerships and no research centres,
    // because none of those are on record for it — a new school with an
    // invented faculty roster would be the worst thing this page could carry.
    // =====================================================================
    slug: 'school-of-ministry',
    name: 'School of Ministry',
    shortName: 'Ministry',
    campus: 'Buea, Cameroon · Online worldwide',
    image: '/images/graduation-2024/grad-2024-hooding.jpg',
    standsFor:
      'To form pastors, evangelists and church leaders for the work itself — the congregation, the mission field, and the organisation that carries them.',
    description: [
      'The School of Ministry trains for practice rather than for the library. Where the Faculty of Theology reads the discipline, this school prepares the people who will stand in a pulpit on Sunday, sit with a family in a crisis on Monday, and answer to a board on Tuesday.',
      'Its awards run from the diploma to the practitioner doctorate, and each level articulates into the next. Teaching covers preaching, pastoral care, discipleship, worship, evangelism and mission, together with the governance, stewardship and ethics of authority that a growing ministry demands of whoever leads it.',
      'Most of its students are already serving. The school is built around that: study is available online and on campus in Buea, and admission is enrolment, so a minister may begin from the date of their offer without standing down from the work they are being trained for.',
    ],
    programSchool: 'School of Ministry',
    awards: [
      { title: 'Diploma in Ministry', level: 'Diploma', slug: 'diploma-in-ministry' },
      { title: 'Diploma in Christian Leadership', level: 'Diploma', slug: 'diploma-in-christian-leadership' },
      { title: 'Bachelor of Ministry (B.Min.)', level: 'Bachelor', slug: 'bachelor-of-ministry' },
      { title: 'Masters in Evangelism and Mission', level: 'Master', slug: 'masters-evangelism-mission' },
      { title: 'Master of Arts in Christian Leadership', level: 'Master', slug: 'master-of-arts-christian-leadership' },
      { title: 'Doctor of Ministry (D.Min.)', level: 'Doctorate', slug: 'doctor-of-ministry' },
    ],
    careers: [
      'Pastoral ministry',
      'Church planting and mission',
      'Evangelism',
      'Chaplaincy',
      'Denominational and ministry administration',
      'Faith-based organisations',
    ],
  },
  {
    slug: 'theology-douala',
    name: 'School of Theology, Douala',
    shortName: 'Theology, Douala',
    campus: 'Douala, Cameroon',
    image: '/images/wp/g-hall.jpg',
    standsFor:
      'To make quality theological education accessible while maintaining the academic standards and spiritual formation that define ICOF Global University.',
    description: [
      'The School of Theology in Douala teaches the Faculty of Theology’s programmes in Cameroon’s largest city and commercial centre, for students who cannot relocate to Buea.',
      'The two campuses share their materials. A student in Douala studies the same courses, sits the same assessments and receives the same award as a student in Buea; only the location differs.',
      'The Douala campus operates under the direction of Dr Bongbuen Alando.',
    ],
    deansMessage: [
      'The School of Theology at the Douala Campus extends the mission of ICOF Global University by providing quality theological education to students within Douala and surrounding regions.',
      'The campus delivers the same academic standards, curriculum, assessments, and qualifications as the Buea campus while providing accessible education within a dynamic urban environment.',
      'We are committed to preparing ministers, church leaders, educators, and missionaries who will faithfully serve the Church and society.',
    ],
    standsForBody: [
      'The Douala Campus exists to make quality theological education accessible while maintaining the academic standards and spiritual formation that define ICOF Global University.',
      'Students benefit from contextual ministry experiences alongside rigorous academic study.',
    ],
    researchStrengths: [
      'Urban Mission',
      'Church Leadership',
      'African Christianity',
      'Contextual Theology',
      'Pentecostal Studies',
      'Community Development',
      'Youth Ministry',
      'Church Planting',
    ],
    graduateDestinations: [
      'Pastors',
      'Evangelists',
      'Missionaries',
      'Christian Educators',
      'Chaplains',
      'Church Administrators',
      'Community Development Practitioners',
      'Researchers',
      'Ministry Leaders',
    ],
    programSchool: 'Faculty of Theology',
    courseFaculty: 'Faculty of Theology',
    sharesProvisionWith: 'theology-buea',
    leadName: 'Dr Bongbuen Alando',
    leadTitle: 'Campus Director',
    degrees: [
      { label: 'Bachelor of Theology', href: '/bachelor-of-theology' },
      { label: 'Master of Theology', href: '/master-of-theology' },
      { label: 'M.A. Black Liberation Theology', href: '/black-liberation-theology' },
    ],
  },
  {
    slug: 'education',
    name: 'Faculty of Education',
    shortName: 'Education',
    campus: 'Buea, Cameroon',
    image: '/images/wp/fac-education.png',
    standsFor:
      'To produce reflective educators who inspire learning, promote innovation and contribute to sustainable educational development.',
    description: [
      'The Faculty of Education prepares teachers for the classroom rather than for the examination hall. Programmes combine modern pedagogy, curriculum design and assessment with supervised teaching practice in real schools.',
      'Graduates enter primary and secondary teaching, curriculum development, educational administration and teacher training.',
    ],
    deansMessage: [
      'Education transforms individuals, communities, and nations. At the Faculty of Education, we prepare teachers and educational leaders who combine professional excellence with ethical responsibility and a commitment to lifelong learning.',
      'Our programmes equip graduates with contemporary teaching methods, educational research skills, curriculum development expertise, classroom management competencies, and digital literacy required for twenty-first-century education.',
      'We believe that effective teachers shape not only academic success but also the moral and social development of future generations.',
    ],
    standsForBody: [
      'The Faculty of Education is committed to producing reflective educators who inspire learning, promote innovation, and contribute to sustainable educational development.',
      'Our programmes integrate educational theory with supervised professional practice, preparing graduates for diverse educational environments.',
    ],
    researchStrengths: [
      'Curriculum Development',
      'Teacher Education',
      'Educational Leadership',
      'Educational Psychology',
      'Inclusive Education',
      'Educational Technology',
      'Assessment and Evaluation',
      'Policy Studies',
      'Adult Education',
      'Community Education',
    ],
    graduateDestinations: [
      'Teachers',
      'School Administrators',
      'Curriculum Specialists',
      'Education Officers',
      'Researchers',
      'Educational Consultants',
      'Instructional Designers',
      'NGO Education Coordinators',
      'University Lecturers',
    ],
    programSchool: 'Faculty of Education',
    courseFaculty: 'Faculty of Education',
    leadName: 'Prof Bishop Lawrence Luba',
    leadTitle: 'Dean',
  },
  {
    slug: 'engineering-technology',
    name: 'Faculty of Engineering and Technology',
    shortName: 'Engineering & Technology',
    campus: 'Buea, Cameroon',
    image: '/images/wp/fac-engineering.jpg',
    standsFor:
      'To develop engineers and technology professionals capable of designing, building, maintaining and improving the systems that advance industry, infrastructure and society.',
    description: [
      'The Faculty of Engineering and Technology teaches applied technical disciplines with a strong emphasis on practical competence and employment. Provision spans diploma, Higher National Diploma and degree level.',
      'Courses are structured around what employers actually require, and the faculty maintains the university’s strongest emphasis on hands-on project work.',
    ],
    deansMessage: [
      'Innovation drives national development. The Faculty of Engineering and Technology prepares graduates who combine technical expertise, creativity, ethical leadership, and practical problem-solving.',
      'Students engage in project-based learning, laboratory practice, research, and industry collaboration to address real-world engineering and technological challenges.',
    ],
    standsForBody: [
      'The Faculty develops engineers and technology professionals capable of designing, building, maintaining, and improving systems that advance industry, infrastructure, and society.',
      'Innovation, sustainability, entrepreneurship, and professional integrity are central to our mission.',
    ],
    researchStrengths: [
      'Computer Science',
      'Artificial Intelligence',
      'Cybersecurity',
      'Software Engineering',
      'Renewable Energy',
      'Electrical Engineering',
      'Mechanical Engineering',
      'Civil Engineering',
      'Internet of Things',
      'Robotics',
      'Smart Cities',
      'Data Science',
    ],
    graduateDestinations: [
      'Software Engineers',
      'Network Engineers',
      'Cybersecurity Analysts',
      'Systems Administrators',
      'Data Scientists',
      'Civil Engineers',
      'Electrical Engineers',
      'Mechanical Engineers',
      'Technology Consultants',
      'Entrepreneurs',
      'Researchers',
    ],
    programSchool: 'Faculty of Engineering and Technology',
    courseFaculty: 'Engineering & Technology',
    leadName: 'Kamgang Marcel',
    leadTitle: 'Dean',
  },
  {
    slug: 'gibmas',
    name: 'Global Institute of Business and Management Science',
    shortName: 'GIBMAS',
    campus: 'Buea, Cameroon',
    image: '/images/wp/fac-business.jpg',
    standsFor:
      'To develop ethical business leaders equipped to operate successfully within local, regional and global economies.',
    description: [
      'The Global Institute of Business and Management Science (GIBMAS) teaches business, management, accounting and entrepreneurship, with an emphasis on preparing students for leadership rather than for entry-level administration.',
      'The institute trains top-level management and entrepreneurs, and its programmes are designed around the realities of doing business in African and global markets.',
    ],
    deansMessage: [
      'Business leadership requires vision, integrity, innovation, and strategic thinking. The Global Institute of Business and Management Science prepares graduates to lead organisations, create enterprises, and contribute to sustainable economic development.',
      'Our programmes integrate management theory with practical business experience and entrepreneurial thinking.',
    ],
    standsForBody: [
      'The Institute develops ethical business leaders equipped to operate successfully within local, regional, and global economies.',
      'Students acquire knowledge in management, finance, marketing, entrepreneurship, innovation, and organisational leadership.',
    ],
    researchStrengths: [
      'Strategic Management',
      'Entrepreneurship',
      'Human Resource Management',
      'Marketing',
      'International Business',
      'Accounting',
      'Finance',
      'Project Management',
      'Supply Chain Management',
      'Digital Business',
      'Corporate Governance',
    ],
    graduateDestinations: [
      'Business Managers',
      'Entrepreneurs',
      'Financial Analysts',
      'Project Managers',
      'Human Resource Managers',
      'Marketing Executives',
      'Consultants',
      'Business Researchers',
      'Public Administrators',
      'Corporate Executives',
    ],
    programSchool: 'Global Institute of Business and Management Science (GIBMAS)',
    courseFaculty: 'GIBMAS — Business & Management',
    leadName: 'Hoffman Betika Ayuk',
    leadTitle: 'Director',
  },
];

/** PPDI-RC is a resource centre rather than a faculty; it has its own page. */
export const ppdircCourseFaculty = 'PPDI-RC Professional Development';

export function getFaculty(slug: string) {
  return facultyList.find((f) => f.slug === slug);
}
