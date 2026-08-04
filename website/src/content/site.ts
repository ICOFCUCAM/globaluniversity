// ---------------------------------------------------------------------------
// ICOF Global University — site content
//
// This file is the single source of truth for every piece of text and media
// on the site. The wording below was recovered verbatim from the WordPress
// database export (wpst_posts / Elementor page data) supplied from cPanel
// phpMyAdmin — see MIGRATION.md. Injected spam content found in the database
// was excluded. When you are ready to serve content from a database instead,
// keep these shapes and implement the same interface in src/lib/data.ts —
// no page component needs to change.
// ---------------------------------------------------------------------------

export interface Program {
  slug: string;
  title: string;
  level: 'Certificate' | 'Diploma' | 'Bachelor' | 'Master' | 'Doctorate';
  school: string;
  image: string;
  summary: string;
  outcomes: string[];
}

export interface FacultyMember {
  name: string;
  role: string;
  image: string;
  bio: string;
}

export interface EventItem {
  slug: string;
  title: string;
  date: string; // ISO date
  location: string;
  image: string;
  summary: string;
}

export interface NewsItem {
  slug: string;
  title: string;
  category: string;
  image: string;
  excerpt: string;
}

export const site = {
  name: 'ICOF Global University',
  shortName: 'IGUC',
  tagline: 'The Community University of Africa',
  description:
    'ICOF Global University provides access to higher education opportunities that enable students to develop knowledge and skills necessary to achieve their professional goals, improve the performance of their organizations, and provide leadership and service to their communities.',
  url: 'https://iguc.net',
  email: 'info@iguc.net',
  phone: '+237 675 133 426',
  address: 'Opposite Bulu Blind Junction, Buea-Cameroon',
  affiliation: 'International Circle of Faith · accredited by the Ministry of Higher Education since 2007',
  // Legacy applications still hosted on the cPanel server. Keep absolute URLs
  // so the Vercel site can link back to them until each is migrated.
  // Every portal entry resolves inside this site. The legacy cPanel apps
  // (Chamilo LMS, ownCloud, RosarioSIS, transcript service) are reachable at
  // legacy.iguc.net once that subdomain is pointed at the old server.
  portals: [
    { label: 'Student Portal (Registration & Transcripts)', href: '/portal' },
    { label: 'Online Application', href: '/apply' },
    { label: 'E-Learning (LMS)', href: '/portal' },
    { label: 'Administration', href: '/portal' },
    { label: 'Transcripts', href: '/portal' },
  ],
  // Navigation mirrors the WordPress menu structure, including sub-menus.
  nav: [
    { label: 'Home', href: '/' },
    {
      label: 'About',
      href: '/about',
      children: [
        { label: 'About Us', href: '/about' },
        { label: 'Administration', href: '/faculty' },
        { label: 'Governance & Accreditation', href: '/governance' },
        { label: 'Policies', href: '/policies' },
        { label: 'Alumni', href: '/alumni' },
        { label: 'Privacy Policy', href: '/privacy-policy' },
      ],
    },
    {
      label: 'Admission',
      href: '/admissions',
      children: [
        { label: 'Admission Requirements', href: '/admissions' },
        { label: 'Apply Now', href: '/apply' },
        { label: 'Registration', href: '/registration' },
        { label: 'International Students', href: '/international' },
        { label: 'Scholarships & Financial Aid', href: '/scholarships' },
        { label: 'Cost & Tuition', href: '/tuition' },
      ],
    },
    {
      label: 'Degrees & Programs',
      href: '/programs',
      children: [
        { label: 'All Programs', href: '/programs' },
        { label: 'Study Online', href: '/online-learning' },
        { label: "Bachelor's Degrees", href: '/degrees/bachelors-degrees' },
        { label: "Master's Degrees", href: '/degrees/masters-degrees' },
        { label: 'Doctoral', href: '/degrees/doctoral' },
        { label: 'Higher National Diploma (HND)', href: '/degrees/higher-national-diploma-hnd' },
        { label: 'Diploma (Dip)', href: '/degrees/diploma-dip' },
        { label: 'Certificates', href: '/degrees/certificates' },
        { label: 'PPDI-RC', href: '/ppdirc' },
        { label: 'PPDI-RC Application', href: '/ppdi-rc-application' },
        { label: 'Lifelong Learning', href: '/lifelong-learning' },
      ],
    },
    { label: 'Faculties & School', href: '/faculty' },
    { label: 'Research', href: '/research' },
    { label: 'Campus Life', href: '/campus-life' },
    { label: 'Events', href: '/events' },
    {
      label: 'Support Us',
      href: '/support',
      children: [
        { label: 'Support IGUC', href: '/support' },
        { label: 'Donate', href: '/donate' },
        { label: 'Charity', href: '/charity' },
      ],
    },
    { label: 'Contact', href: '/contact' },
  ],
};

export interface NavItem {
  label: string;
  href: string;
  children?: Array<{ label: string; href: string }>;
}

export const hero = {
  title: 'The Community University of Africa',
  text: 'Educating men and women as skilled professionals in godly principles, morals and ministries worldwide.',
  cta: { label: 'Enroll Today', href: '/admissions' },
  image: '/images/home-hero.jpg',
};

// Hero slider — one slide per message the WordPress homepage rotated through.
export interface HeroSlide {
  title: string;
  text: string;
  cta: { label: string; href: string };
  image: string;
}

export const heroSlides: HeroSlide[] = [
  {
    title: 'The Community University of Africa',
    text: 'Educating men and women as skilled professionals in godly principles, morals and ministries worldwide.',
    cta: { label: 'Enroll Today', href: '/admissions' },
    image: '/images/home-hero.jpg',
  },
  {
    title: 'Donate for Our University Building Project',
    text: 'Join us in building the future of education — a cutting-edge campus where ideas flourish and innovation takes flight. Together, let’s raise $1,000,000 to bring this vision to life.',
    cta: { label: 'Support Us', href: '/contact' },
    image: '/images/hall.jpg',
  },
  {
    title: 'Support Intermissions and Evangelism Worldwide',
    text: 'Empower missions and outreach efforts to reach grassroots levels more effectively, amplifying the reach and impact of the Kingdom of God.',
    cta: { label: 'Learn More', href: '/about' },
    image: '/images/global.jpg',
  },
  {
    title: 'A University in Pursuit of a Brighter Future',
    text: 'Anything you can dream, you can do — and we have the alumni to prove it. Fill out our free online application today.',
    cta: { label: 'Apply Now', href: '/apply' },
    image: '/images/graduation.jpg',
  },
];

export const quickLinks = [
  { label: 'Events & Important Dates', href: '/events', icon: 'calendar' },
  { label: 'Programs', href: '/programs', icon: 'book' },
  { label: 'Admissions', href: '/admissions', icon: 'award' },
  { label: 'Study Online', href: '/online-learning', icon: 'laptop' },
  { label: 'Library', href: '/portal', icon: 'library' },
  { label: 'Contact', href: '/contact', icon: 'mail' },
];

export const stats = [
  { value: '7,228', label: 'Success Stories' },
  { value: '213', label: 'Courses' },
  { value: '1,742', label: 'Happy Students' },
  { value: '15', label: 'Years Experience' },
];

// "Be in Demand with Our Professional Training" section from the live homepage.
export const homeFeatures = {
  heading: 'Be in Demand with Our Professional Training',
  intro:
    'We offer the best professional trainings with well designed courses to prepare you for the job market. We train top level management and entrepreneurs.',
  items: [
    {
      title: 'Build Relevant Skills',
      body: 'A skill set is a combination of abilities, qualities and experiences you can apply to perform tasks well. These can include soft skills such as interpersonal skills, organization and leadership as well as technical skills such as research, computer programming, accounting, writing and more. At ICOF, we don’t just teach in the classrooms, we help you to build relevant skills.',
    },
    {
      title: 'Get The Right Path From The Best Learning Platform',
      body: 'ICOF Global University provides a good learning platform that is engaging and focused on the learner, ensuring that a course becomes something more than just knowledge absorption. It turns the whole idea of learning into a pleasant, immersive experience.',
    },
    {
      title: 'Learn From The Professionals',
      body: 'ICOF Global University prides itself with professional staff who understand the field they lecture in and can give the best practical examples that exist in our day-to-day life.',
    },
  ],
};

// "School & Faculties" section from the live homepage.
export const homeFaculties = {
  heading: 'School & Faculties',
  intro:
    'Our courses are well designed and structured to fit you into the competitive job market. We pride our students to stand out unique in the job search market with our well designed and structured professional courses in all our faculties.',
  items: [
    { name: 'Faculty of Theology', image: '/images/wp/fac-theology.jpg' },
    { name: 'Faculty of Education', image: '/images/wp/fac-education.png' },
    { name: 'Faculty of Business & Management Science', image: '/images/wp/fac-business.jpg' },
    { name: 'Faculty of Engineering & Technology', image: '/images/wp/fac-engineering.jpg' },
  ],
};

// "Accreditation and Partners" logos from the live homepage.
export const partners = [
  { name: 'ABE', image: '/images/wp/logo-abe.png' },
  { name: 'ICOF-B', image: '/images/wp/logo-b.png' },
  { name: 'CSU', image: '/images/wp/logo-csu.png' },
  { name: 'Global Revival Network', image: '/images/wp/logo-grn.png' },
  { name: 'OTI', image: '/images/wp/logo-oti.png' },
  { name: 'St Chama Foundation', image: '/images/wp/logo-chama.jpg' },
];

// FAQ from the live homepage.
export const homeFaqs = [
  {
    question: 'Is ICOF Global University an accredited university?',
    answer:
      'ICOF Global University is accredited by the Ministry of Higher Education (www.minesup.gov.cm). Since 2007, ICOF Global University has been continually accredited by the Ministry of Higher Education and its predecessor, and continues to update its Reaffirmation of Accreditation as years go by.',
  },
  {
    question: 'What degree programs are offered by ICOF Global University?',
    answer:
      'We offer undergraduate, master’s and doctoral degree programs in many high-demand fields, including business, education, and technology. You can complete your degree online from anywhere or on-campus, depending upon your location. The University also offers certificate programs, as well as individual, test-preparation and non-credit professional development courses.',
  },
  {
    question: 'How long will it take for me to complete a program?',
    answer:
      'Completion time depends on the program you choose and the number of transfer credits applied to the program. Speak with an Enrollment Representative to get detailed information.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Review our admissions requirements to learn about our admissions process. Ready to enroll? Fill out the free online application, or call and speak with a representative to get started.',
  },
  {
    question: 'How do I attend a class online?',
    answer:
      'Attending online class is easy — all you need is a reliable internet connection. You simply log into your classroom to complete assignments, access course materials and resources and interact with faculty and classmates. Class participation is graded based upon your contributions to online discussions, quizzes and exams. This is a great solution for students who might have a difficult time commuting and for those who learn better independently.',
  },
];

export const about = {
  heading: 'About Us',
  intro:
    'The International Circle of Faith (ICOF) represents a contemporary movement committed to reviving and perpetuating the original apostolic message, authority, power, and anointing. With a global reach, ICOF unites ministers and ministries worldwide under a common vision of unity, prioritizing collaboration over division. Emerging from the core principles of ICOF, ICOF Global University endeavors to provide accredited education and training. Since its inception in 2007, our institution has been dedicated to nurturing professionals across various domains, championing excellence in education and service to humanity.',
  items: [
    {
      title: 'Our History',
      body: 'Our mission is to bring together anointed, kingdom-minded New Testament ministers, fulfilling the prayer of Jesus for the Church to be unified as one. Since 2007, ICOF Global University has been dedicated to nurturing professionals across various domains.',
    },
    {
      title: 'Mission & Values',
      body: 'ICOF Global University offers pathways to higher education that empower students to cultivate the knowledge and skills essential for achieving their professional aspirations — driving organizational growth and fostering leadership within their communities.',
    },
    {
      title: 'Our Values',
      body: 'Integrity · Diversity · Excellence · Collaboration · Nobility · Godliness · Professionalism · Commitment.',
    },
    {
      title: 'Accreditation',
      body: 'ICOF Global University is accredited by the Ministry of Higher Education (www.minesup.gov.cm). Since 2007, ICOF Global University has been continually accredited by the Ministry of Higher Education and its predecessor.',
    },
    {
      title: 'Our Purpose',
      body: 'To facilitate cognitive and effective student learning — knowledge, skills, and values — and to promote use of that knowledge in the student’s workplace, bridging the gap between theory and practice.',
    },
  ],
  image: '/images/hall.jpg',
};

export const leadership: FacultyMember[] = [
  {
    name: 'Bishop Bernie L Wade, PhD',
    role: 'Chancellor',
    image: '/images/wp/chancellor.jpg',
    bio: 'Wade holds doctorates in theology, divinity, Christian education, non-profit management and pastoral counseling. Presiding Bishop of the International Circle of Faith (ICOF). Email: chancellor@iguc.net',
  },
  {
    name: 'Prof Chamayah Meyembi',
    role: 'Vice Chancellor',
    image: '/images/wp/vc-meyembi.png',
    bio: 'Holds a PhD in Theology from International Circle of Faith Colleges, Seminaries and Universities. ICOF Africa Bishop to Youth; elevated to Continental leadership with ICOF in 2010. Email: vc@iguc.net',
  },
];

export const faculty: FacultyMember[] = [
  {
    name: 'Prof Aaron Ndenka',
    role: 'Academic Director General',
    image: '/images/wp/ndenka.jpg',
    bio: 'Holds a PhD in Finance from the University of Buea and a PhD in Systematic Theology from ICOF College and University. Former lecturer at the University of Buea. Email: gad@iguc.net',
  },
  {
    name: 'Kamgang Marcel',
    role: 'Director, School of Technology and Engineering',
    image: '/images/faculty-marcel.jpg',
    bio: 'Director of the School of Technology and Engineering. Email: kamgang.marcel@iguc.net',
  },
  {
    name: 'Dr Samuel Kinge',
    role: 'Director of Exams',
    image: '/images/wp/samuel-kinge.png',
    bio: 'Holder of Doctor of Divinity from ICOF College Seminary and University USA. Email: dr.skinge@iguc.net',
  },
  {
    name: 'Hoffman Betika Ayuk',
    role: 'Director, School of Business and Management Sciences',
    image: '/images/faculty-ayuk.jpg',
    bio: 'Director of the School of Business and Management Sciences. Email: hoffman@iguc.net',
  },
];

// Full administration roster as published on the live About page.
export const administration: FacultyMember[] = [
  {
    name: 'Bishop Bernie L Wade, PhD',
    role: 'Chancellor',
    image: '/images/wp/chancellor.jpg',
    bio: 'Wade holds doctorates in theology, divinity, Christian education, non-profit management and pastoral counseling. Presiding Bishop of the International Circle of Faith (ICOF). Email: chancellor@iguc.net',
  },
  {
    name: 'Dr. Raymond L Young',
    role: 'President',
    image: '',
    bio: 'Founder and Global Coordinator of the Global Revival Network. A professional educator and tenured university faculty member for 18 years, teaching computer science and business. Email: president@iguc.net',
  },
  {
    name: 'Prof Chamayah Meyembi',
    role: 'Vice Chancellor',
    image: '/images/wp/vc-meyembi.png',
    bio: 'Holds a PhD in Theology from International Circle of Faith Colleges, Seminaries and Universities. ICOF Africa Bishop to Youth; elevated to Continental leadership with ICOF in 2010. Email: vc@iguc.net',
  },
  {
    name: 'Prof Aaron Ndenka',
    role: 'Academic Director General',
    image: '/images/wp/ndenka.jpg',
    bio: 'Holds a PhD in Finance from the University of Buea and a PhD in Systematic Theology from ICOF College and University. Former lecturer at the University of Buea; lecturer at the Bamenda University of Technology. Email: gad@iguc.net',
  },
  {
    name: 'Dr Bishop Tembi Alfred Tembi',
    role: 'Ministerial Association Presiding Bishop of Cameroon',
    image: '/images/wp/tembi.jpg',
    bio: 'ICOF Ministerial Association Presiding Bishop of Cameroon & RECOMA. Email: bishoptembi@iguc.net',
  },
  {
    name: 'Arch Bishop Prof Godfred Anyere Tah',
    role: 'Professor Emeritus & President of the Dissertation Council',
    image: '/images/wp/godfred-tah.png',
    bio: 'Teacher, Counselor, Motivational Speaker, President and Chancellor at Ambassador Seminary & University. Email: godfrey@iguc.net',
  },
  {
    name: 'Prof Lyonga Divine',
    role: 'Registrar',
    image: '/images/wp/lyonga-divine.png',
    bio: 'Master’s in Religious Studies and Theology from the Nation’s University; PhD in Theology from ICOF Global University. Lecturer at the Apostolic Bible Institute. Email: registrar@iguc.net',
  },
  {
    name: 'Rev Tchamou Nico Tonga, BTh',
    role: 'Head of Admission',
    image: '/images/wp/nico-tonga.png',
    bio: 'Holder of Doctor of Divinity from ICOF College Seminary and University USA. Email: admissions@iguc.net',
  },
  {
    name: 'Dr Samuel Kinge',
    role: 'Director of Exams',
    image: '/images/wp/samuel-kinge.png',
    bio: 'Holder of Doctor of Divinity from ICOF College Seminary and University USA. Email: dr.skinge@iguc.net',
  },
  {
    name: 'Prof Bishop Lawrence Luba',
    role: 'Director of School of Education',
    image: '/images/wp/lawrence-luba.jpg',
    bio: 'Postgraduate Ambassador. Email: prof.lawrenceluba@iguc.net',
  },
  {
    name: 'Rev Momfor Phillip, M.Th',
    role: 'Dean of Studies (Faculty of Theology)',
    image: '/images/wp/momfor.jpg',
    bio: 'Lecturer at IGUC; General Overseer of Christ Glory and Grace Mission. Email: faculty.theology@iguc.net',
  },
  {
    name: 'Dr Bongbuen Alando',
    role: 'Director of School of Theology (Douala)',
    image: '/images/wp/alando.png',
    bio: 'Masters and PhD holder from ICOF College and University. Founder and Chairman of the Reconciled Church of Christ; professor at ICOF Global University. Email: dr.mbonguen@iguc.net',
  },
  {
    name: 'Prof. Barnabas Oluwaleye',
    role: 'PPDI-RC, Nigeria',
    image: '/images/wp/barnabas.jpg',
    bio: 'Professor of Psychology and Behavior/Temperament Therapy — Personal Professional Development Industry & Resource Center, Nigeria. Email: ppdirc@iguc.net',
  },
  {
    name: 'Prof Emmanuel Dangana',
    role: 'Professor of Theology',
    image: '/images/wp/dangana.jpg',
    bio: 'Email: profd@iguc.net',
  },
  {
    name: 'Dr Wake Jeo',
    role: 'Liberation Theology and Identity Politics',
    image: '/images/wp/wake-jeo.jpg',
    bio: 'Associate Professor at ICOF Global University, USA. Email: wajeo@iguc.net',
  },
  {
    name: 'Prof Sunday Ayah',
    role: 'Theology and Criminology',
    image: '',
    bio: 'ICOF Global University, USA. Email: profachi@iguc.net',
  },
  {
    name: 'Hoffman Betika Ayuk',
    role: 'Director of School of Business and Management Sciences',
    image: '/images/faculty-ayuk.jpg',
    bio: 'Director of the School of Business and Management Sciences. Email: hoffman@iguc.net',
  },
  {
    name: 'Kamgang Marcel',
    role: 'Director of School of Technology and Engineering',
    image: '/images/faculty-marcel.jpg',
    bio: 'Director of the School of Technology and Engineering. Email: kamgang.marcel@iguc.net',
  },
  {
    name: 'Forchu Venelda',
    role: 'Secretary',
    image: '',
    bio: 'Holder of both advanced and A-level, and a National Diploma in Secretarial Duties. Email: info@iguc.net',
  },
];

// "Our Lecturers" section from the live About page.
export const lecturers: FacultyMember[] = [
  { name: 'Rev Dr Gerald Mukwelle', role: 'Lecturer', image: '', bio: '' },
  { name: 'Rev Momfor Phillip', role: 'Lecturer', image: '', bio: '' },
  { name: 'Prof Bishop Lawrence Luba', role: 'Lecturer', image: '', bio: '' },
  { name: 'Pastor Solomon Njie', role: 'Lecturer', image: '', bio: '' },
  { name: 'Rev Sama Raphael Ndaghu', role: 'Lecturer', image: '', bio: '' },
];

// Schools & Faculties as listed on the live Faculties page.
export const faculties = {
  heading: 'Schools & Faculties',
  intro:
    'ICOF Global University has a number of faculties with various programs. Our courses are well designed and structured to fit you into the competitive job market. We pride our students to stand out unique with our well designed and structured professional courses in all our faculties.',
  items: [
    'Faculty of Theology Buea',
    'School of Theology Douala',
    'Faculty of Education',
    'Faculty of Engineering and Technology',
    'Global Institute of Business and Management Science (GIBMAS)',
  ],
  instructors: {
    heading: 'Instructors who practice what they teach!',
    paragraphs: [
      'At ICOF Global University, our professors are called instructors because rather than professing knowledge, they’ve lived it. Our instructors are skilled professionals with advanced education.',
      'Raise your virtual hand when you have a question, even if it’s after hours. You’ll receive a personal reply from your instructor — not a teacher’s assistant. If you need a little one-on-one help, we also offer tutoring services in math or reading 7 days a week.',
      'Confidence isn’t something you get from textbooks or theory. Our instructors turn theory into skills you can put into practice right away — after all, they know firsthand what works and what doesn’t.',
    ],
  },
  fastFacts: [
    { value: '15', label: 'years average of professional experience we bring to the classroom' },
    { value: '12', label: 'years average teaching instruction at ICOF Global University' },
    { value: '100%', label: 'student internship placement to fortune companies' },
  ],
};

// Full program catalog as published on the live Degrees & Programs page,
// organised under the university's faculties:
// Faculty of Theology (Buea) · School of Theology (Douala) · Faculty of
// Education · Faculty of Engineering and Technology · Global Institute of
// Business and Management Science (GIBMAS).
export const programs: Program[] = [
  {
    slug: 'divinity',
    title: 'Divinity',
    level: 'Bachelor',
    school: 'Faculty of Theology',
    image: '/images/ceremonial.jpg',
    summary:
      'A comprehensive grounding in biblical studies, doctrine and pastoral practice, preparing graduates for ordained ministry and Christian leadership.',
    outcomes: ['Biblical interpretation', 'Systematic theology', 'Pastoral care', 'Homiletics'],
  },
  {
    slug: 'ministry',
    title: 'Ministry',
    level: 'Master',
    school: 'Faculty of Theology',
    image: '/images/grand-ceremony.jpg',
    summary:
      'Advanced ministerial formation for serving leaders — Master of Divinity and Masters in Evangelism and Mission tracks covering leadership, missions, church administration and practical theology.',
    outcomes: ['Ministry leadership', 'Missiology', 'Church administration', 'Ethics'],
  },
  {
    slug: 'theology',
    title: 'Theology',
    level: 'Doctorate',
    school: 'Faculty of Theology',
    image: '/images/graduation.jpg',
    summary:
      'Doctoral research in theology — Doctor of Philosophy, Doctor of Theology and Doctor of Ministry (Christian Counseling & Administration) — culminating in an original dissertation.',
    outcomes: ['Research methods', 'Advanced doctrine', 'Original dissertation', 'Academic publishing'],
  },
  {
    slug: 'primary-education',
    title: 'Primary Education',
    level: 'Bachelor',
    school: 'Faculty of Education',
    image: '/images/program-education.png',
    summary:
      'Prepares classroom-ready teachers with modern pedagogy, curriculum design and supervised teaching practice.',
    outcomes: ['Pedagogy', 'Curriculum design', 'Classroom management', 'Assessment'],
  },
  {
    slug: 'special-education',
    title: 'Special Education',
    level: 'Bachelor',
    school: 'Faculty of Education',
    image: '/images/students.jpg',
    summary:
      'Equips educators to serve learners with diverse needs through inclusive teaching strategies and intervention design.',
    outcomes: ['Inclusive education', 'Learning assessment', 'Intervention planning', 'Family engagement'],
  },
  {
    slug: 'software-engineering',
    title: 'Software Engineering',
    level: 'Bachelor',
    school: 'Faculty of Engineering and Technology',
    image: '/images/program-engineering.jpg',
    summary:
      'From programming foundations to full-stack development and software project delivery, with hands-on labs throughout. Related tracks include Webmaster, Oracle Database and Computerized Accounting.',
    outcomes: ['Programming', 'Databases', 'Web & mobile development', 'Software project delivery'],
  },
  {
    slug: 'networking',
    title: 'Computer Networking',
    level: 'Diploma',
    school: 'Faculty of Engineering and Technology',
    image: '/images/program-engineering.jpg',
    summary:
      'Practical computer networking — infrastructure, administration and security for modern organisations. Related tracks include Hardware Maintenance, Laptop Chipsets and Air Conditioning & Refrigeration.',
    outcomes: ['Network infrastructure', 'System administration', 'Network security', 'Hardware maintenance'],
  },
  {
    slug: 'business-management',
    title: 'Business Management',
    level: 'Bachelor',
    school: 'Global Institute of Business and Management Science (GIBMAS)',
    image: '/images/program-business.jpg',
    summary:
      'Core management disciplines — Business Management, Non-Profit Management, Banking and Finance, Accountancy, Insurance and Secretarial Studies — with an entrepreneurial edge.',
    outcomes: ['Management', 'Banking & finance', 'Accountancy', 'Marketing'],
  },
  {
    slug: 'project-management',
    title: 'Project Management',
    level: 'Master',
    school: 'Global Institute of Business and Management Science (GIBMAS)',
    image: '/images/program-business.jpg',
    summary:
      'Professional project delivery: planning, budgeting, risk and stakeholder management aligned to international standards.',
    outcomes: ['Project planning', 'Risk management', 'Budgeting', 'Leadership'],
  },
];

export const admissions = {
  heading: 'Anything you can dream, you can do',
  intro:
    'And we have the alumni to prove it. Join our number of working adults who had the courage to pursue their degrees and the determination to earn them. If you’re considering taking classes with us at ICOF Global University, please take a moment and glance through the admissions requirements below. Requirements may vary by college and degree level. Our team of enrollment representatives are available to walk through the entire application process with you — clarifying admissions requirements, transferring coursework and explaining the financial commitment. Fill out our free online application today.',
  applyUrl: '/apply',
  email: 'admissions@iguc.net',
  steps: [
    {
      title: 'Certificate · Diploma · HND',
      body: 'Hold an Advanced Level (A/L) Slip or Certificate from the Cameroon GCE Board (minimum 3 points) or a comparable qualification from a recognized institution abroad, and complete all required admission forms. International students: proof of English language.',
    },
    {
      title: 'Undergraduate (Bachelor’s)',
      body: 'Hold an A/L Slip or Certificate with appropriate points and subjects for your chosen program, be a citizen or resident of Cameroon (or hold a valid visa), and submit an official A/L Certificate or equivalent with your application.',
    },
    {
      title: 'Master’s',
      body: 'Hold an undergraduate degree from an accredited college or university (or a comparable foreign degree) with a cumulative GPA of 2.5 on a 4.0 scale, and submit an official undergraduate transcript.',
    },
    {
      title: 'Doctoral',
      body: 'Hold a graduate degree from an accredited college or university (or comparable foreign degree) with a minimum cumulative GPA of 3.0, and submit an official graduate transcript.',
    },
  ],
  image: '/images/admission-process.jpg',
  banner: '/images/admission-banner.jpg',
};

export const tuition = {
  heading: 'Cost & Tuition',
  intro:
    'At ICOF Global University, we realize each student is unique and that includes their financial situation. We offer flexible methods to cover your tuition costs. Going to college is a big step, but you don’t have to go it alone — earning a degree shouldn’t break the bank.',
  rows: [
    { program: 'Full-time tuition (per year)', fee: '$12,200 (living at home or on campus) · $12,000 (students with dependents)' },
    { program: 'Part-time tuition (per year)', fee: '$6,600 · $6,400 (students with dependents)' },
    { program: 'Books & supplies', fee: '$500' },
    { program: 'Student housing (single room, toilet & kitchen)', fee: '35,000 – 50,000 FCFA per month' },
    { program: 'Extension courses', fee: 'Varies by program — email admissions@iguc.net' },
  ],
  note: 'We provide financial aid through scholarships — follow our announcements and newsletters to know when a scholarship program is published. Online courses are offered for master’s and doctoral programs.',
};

export const campusLife = {
  heading: 'Campus Life',
  intro:
    'Experience a new life with us, as we walk you through your academic journey. At ICOF Global University, we recognize that a vibrant campus life is integral to the college experience. Our campus serves as more than just an academic hub; it is a dynamic community where students can engage, connect, and grow both academically and personally — with student support services, community engagement, extracurricular activities, and modern facilities and amenities.',
  gallery: [
    { image: '/images/wp/g-grads.jpg', caption: 'Our graduates' },
    { image: '/images/wp/g-celebration.jpg', caption: 'Celebration day' },
    { image: '/images/wp/g-hall.jpg', caption: 'University hall' },
    { image: '/images/wp/g-students.jpg', caption: 'Our students' },
    { image: '/images/wp/g-student-celebration.jpg', caption: 'Student celebration' },
    { image: '/images/wp/g-decor.jpg', caption: 'Ceremony decor' },
    { image: '/images/wp/g-pict.jpg', caption: 'Campus moments' },
    { image: '/images/wp/g-award2.jpg', caption: 'Award ceremony' },
    { image: '/images/wp/g-prayer.jpg', caption: 'Prayer session' },
    { image: '/images/wp/g-graduates.jpg', caption: 'Graduating class' },
    { image: '/images/wp/g-greets.jpg', caption: 'Greetings & fellowship' },
    { image: '/images/wp/g-2024a.jpg', caption: 'Graduation 2024' },
    { image: '/images/wp/g-2024b.jpg', caption: 'Graduation 2024' },
    { image: '/images/wp/g-2024c.jpg', caption: 'Graduation 2024' },
  ],
};

export const events: EventItem[] = [
  {
    slug: 'graduation',
    title: 'Graduation',
    date: '2027-01-01',
    location: 'CNPS Hall, Mile 17, Buea',
    image: '/images/graduation.jpg',
    summary: 'The annual graduation ceremony — January 01, at 09:00 AM, CNPS Hall, Mile 17, Buea.',
  },
  {
    slug: 'student-orientation',
    title: 'Student Orientation',
    date: '2026-10-12',
    location: 'CNPS Hall, Mile 17, Buea',
    image: '/images/students.jpg',
    summary: 'Orientation for new students — October 12, at 09:00 AM, CNPS Hall, Mile 17, Buea.',
  },
  {
    slug: 'admission-opens',
    title: 'Admission Opens',
    date: '2027-07-10',
    location: 'Opposite Bulu Blind Junction, Buea-Cameroon',
    image: '/images/admission-banner.jpg',
    summary: 'Admissions open for the new academic year — July 10, at 08:30 AM.',
  },
];

export const news: NewsItem[] = [
  {
    slug: 'university-construction-project',
    title: 'University Construction Project',
    category: 'Support IGUC',
    image: '/images/hall.jpg',
    excerpt:
      'Join us in our mission to build the future of education — an ambitious project to create a cutting-edge university campus. Together, let’s raise $1,000,000 to bring this vision to life.',
  },
  {
    slug: 'missions-and-evangelism',
    title: 'Missions & Evangelism',
    category: 'Support IGUC',
    image: '/images/global.jpg',
    excerpt:
      'Support intermissions and evangelism worldwide — empowering missions and outreach efforts to reach grassroots levels more effectively.',
  },
  {
    slug: 'scholarships-for-the-called',
    title: 'Support the Called Through Biblical & Theological Training',
    category: 'Support IGUC',
    image: '/images/graduates.jpg',
    excerpt:
      'Our comprehensive scholarship programs help those called to theological education overcome financial constraints. Your support illuminates their path.',
  },
];

export const contact = {
  heading: 'Visit Us',
  email: 'info@iguc.net',
  phone: '+237 675 133 426',
  address: 'Opposite Bulu Blind Junction, Buea-Cameroon',
  intro:
    'Welcome! ICOF Global University provides access to higher education opportunities that enable students to develop knowledge and skills necessary to achieve their professional goals, improve the performance of their organizations, and provide leadership and service to their communities. Call us 24×7 on +237 675 133 426, or write to info@iguc.net.',
};

export const cta = {
  title: 'Your Future Starts Here.',
  text: 'Position yourself for success at an accredited university where you can work toward your future one course at a time. Fill out a request form and we will help you start on the right track.',
  button: { label: 'Enroll Today', href: '/admissions' },
};
