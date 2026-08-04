// ---------------------------------------------------------------------------
// ICOF Global University — site content
//
// This file is the single source of truth for every piece of text and media
// on the site. It mirrors what the WordPress database (wpst_posts /
// Elementor page data) held on iguc.net. When you are ready to serve content
// from a database instead, keep these shapes and implement the same interface
// in src/lib/data.ts — no page component needs to change.
//
// Items marked TODO(content) could not be recovered from the repository
// (WordPress stored them only in the MySQL database). Replace them with the
// exact wording from your phpMyAdmin export — see MIGRATION.md.
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
  tagline: 'How Will You Forge Your Future?',
  description:
    'ICOF Global University (International Circle of Faith) offers accredited certificate, diploma, undergraduate and postgraduate programs in theology, ministry, education, technology and business — on campus and online.',
  url: 'https://iguc.net',
  email: 'admission@iguc.net',
  affiliation: 'International Circle of Faith Global Union · est. 1932',
  // Legacy applications still hosted on the cPanel server. Keep absolute URLs
  // so the Vercel site can link back to them until each is migrated.
  portals: [
    { label: 'Online Application', href: 'https://iguc.net/forms/' },
    { label: 'E-Learning (LMS)', href: 'https://iguc.net/online/' },
    { label: 'Student Cloud', href: 'https://iguc.net/igucloud/' },
    { label: 'Administration', href: 'https://iguc.net/administration/' },
    { label: 'Transcripts', href: 'https://iguc.net/transcript/' },
  ],
  nav: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Programs', href: '/programs' },
    { label: 'Admissions', href: '/admissions' },
    { label: 'Faculty', href: '/faculty' },
    { label: 'Campus Life', href: '/campus-life' },
    { label: 'Events', href: '/events' },
    { label: 'Tuition', href: '/tuition' },
    { label: 'Contact', href: '/contact' },
  ],
};

export const hero = {
  title: 'How Will You Forge Your Future?',
  // TODO(content): replace with the exact hero paragraph from the live homepage.
  text: 'ICOF Global University equips men and women for excellence in scholarship, service and spiritual leadership — with accredited programs offered on campus and fully online to students around the world.',
  cta: { label: 'Enroll Today', href: '/admissions' },
  image: '/images/home-hero.jpg',
};

export const quickLinks = [
  { label: 'Events', href: '/events', icon: 'calendar' },
  { label: 'Programs', href: '/programs', icon: 'book' },
  { label: 'Admissions', href: '/admissions', icon: 'award' },
  { label: 'E-Learning', href: 'https://iguc.net/online/', icon: 'laptop' },
  { label: 'Library', href: 'https://iguc.net/igucloud/', icon: 'library' },
  { label: 'Contact', href: '/contact', icon: 'mail' },
];

export const stats = [
  { value: '1932', label: 'Founded (ICOF Global Union)' },
  { value: '16+', label: 'Programs of Study' },
  { value: '1000+', label: 'Graduates Worldwide' },
  { value: '25+', label: 'Nations Represented' },
];

export const about = {
  heading: 'About ICOF Global University',
  // TODO(content): replace with the exact About text from the live site.
  intro:
    'ICOF Global University is the higher-education arm of the International Circle of Faith Global Union. From our founding heritage dating back to 1932, we have pursued one mission: raising leaders of faith, character and competence for the church, the marketplace and the nations.',
  items: [
    {
      title: 'Our History',
      body: 'Rooted in the International Circle of Faith Global Union (est. 1932), the university has grown into a global institution serving students across Africa, Europe, the Americas and Asia.',
    },
    {
      title: 'Our Mission',
      body: 'To provide rigorous, internationally reviewed programs that combine academic excellence with spiritual formation and practical service.',
    },
    {
      title: 'Our Focus',
      body: 'Theology, ministry and divinity alongside education, engineering, technology, business and project management — preparing whole leaders for a whole world.',
    },
    {
      title: 'Our Campus',
      body: 'A vibrant campus community with ceremonies, convocations and fellowship — plus a full e-learning platform for distance students.',
    },
    {
      title: 'Access & Inclusion',
      body: 'Equal opportunities and non-discrimination are institutional policy. Quality assurance follows the ICOF policy framework.',
    },
  ],
  image: '/images/hall.jpg',
};

export const leadership: FacultyMember[] = [
  {
    name: 'The Chancellor', // TODO(content): confirm name/title from live site
    role: 'Chancellor',
    image: '/images/chancellor.jpg',
    bio: 'Provides visionary oversight for the university and the worldwide ICOF family.',
  },
  {
    name: 'Dr. Chama', // TODO(content): confirm full name/title from live site
    role: 'Vice-Chancellor',
    image: '/images/vice-chancellor.png',
    bio: 'Leads academic administration, quality assurance and institutional development.',
  },
];

export const faculty: FacultyMember[] = [
  {
    name: 'Dr. Marcel', // TODO(content): confirm names & titles
    role: 'Faculty',
    image: '/images/faculty-marcel.jpg',
    bio: 'Lecturer, ICOF Global University.',
  },
  {
    name: 'Dr. Ndenka',
    role: 'Faculty',
    image: '/images/faculty-ndenka.jpg',
    bio: 'Lecturer, ICOF Global University.',
  },
  {
    name: 'Dr. Samuel',
    role: 'Faculty',
    image: '/images/faculty-samuel.png',
    bio: 'Lecturer, ICOF Global University.',
  },
  {
    name: 'Dr. Ayuk',
    role: 'Faculty',
    image: '/images/faculty-ayuk.jpg',
    bio: 'Lecturer, ICOF Global University.',
  },
];

// Program list recovered from the live online-application form (forms/index.php):
// levels — PhD, DTh, MA, BSc, Diploma, Certificate; fields — Divinity, Ministry,
// Theology, Primary Education, Special Education, Software Engineering,
// Networking, Business Management, Project Management.
export const programs: Program[] = [
  {
    slug: 'divinity',
    title: 'Divinity',
    level: 'Bachelor',
    school: 'School of Theology & Ministry',
    image: '/images/ceremonial.jpg',
    summary:
      'A comprehensive grounding in biblical studies, doctrine and pastoral practice, preparing graduates for ordained ministry and Christian leadership.',
    outcomes: ['Biblical interpretation', 'Systematic theology', 'Pastoral care', 'Homiletics'],
  },
  {
    slug: 'ministry',
    title: 'Ministry',
    level: 'Master',
    school: 'School of Theology & Ministry',
    image: '/images/grand-ceremony.jpg',
    summary:
      'Advanced ministerial formation for serving leaders — leadership, missions, church administration and practical theology.',
    outcomes: ['Ministry leadership', 'Missiology', 'Church administration', 'Ethics'],
  },
  {
    slug: 'theology',
    title: 'Theology',
    level: 'Doctorate',
    school: 'School of Theology & Ministry',
    image: '/images/graduation.jpg',
    summary:
      'Doctoral research in theology (PhD / DTh) with internationally reviewed supervision, culminating in an original dissertation.',
    outcomes: ['Research methods', 'Advanced doctrine', 'Original dissertation', 'Academic publishing'],
  },
  {
    slug: 'primary-education',
    title: 'Primary Education',
    level: 'Bachelor',
    school: 'School of Education',
    image: '/images/program-education.png',
    summary:
      'Prepares classroom-ready teachers with modern pedagogy, curriculum design and supervised teaching practice.',
    outcomes: ['Pedagogy', 'Curriculum design', 'Classroom management', 'Assessment'],
  },
  {
    slug: 'special-education',
    title: 'Special Education',
    level: 'Bachelor',
    school: 'School of Education',
    image: '/images/students.jpg',
    summary:
      'Equips educators to serve learners with diverse needs through inclusive teaching strategies and intervention design.',
    outcomes: ['Inclusive education', 'Learning assessment', 'Intervention planning', 'Family engagement'],
  },
  {
    slug: 'software-engineering',
    title: 'Software Engineering',
    level: 'Bachelor',
    school: 'School of Science & Technology',
    image: '/images/program-engineering.jpg',
    summary:
      'From programming foundations to full-stack development and software project delivery, with hands-on labs throughout.',
    outcomes: ['Programming', 'Databases', 'Web & mobile development', 'Software project delivery'],
  },
  {
    slug: 'networking',
    title: 'Networking',
    level: 'Diploma',
    school: 'School of Science & Technology',
    image: '/images/program-engineering.jpg',
    summary:
      'Practical computer networking — infrastructure, administration and security for modern organisations.',
    outcomes: ['Network infrastructure', 'System administration', 'Network security', 'Cloud basics'],
  },
  {
    slug: 'business-management',
    title: 'Business Management',
    level: 'Bachelor',
    school: 'School of Business',
    image: '/images/program-business.jpg',
    summary:
      'Core management disciplines — accounting, marketing, operations and strategy — with an entrepreneurial edge.',
    outcomes: ['Management', 'Accounting & finance', 'Marketing', 'Strategy'],
  },
  {
    slug: 'project-management',
    title: 'Project Management',
    level: 'Master',
    school: 'School of Business',
    image: '/images/program-business.jpg',
    summary:
      'Professional project delivery: planning, budgeting, risk and stakeholder management aligned to international standards.',
    outcomes: ['Project planning', 'Risk management', 'Budgeting', 'Leadership'],
  },
];

export const admissions = {
  heading: 'Admissions',
  intro:
    'Applying to ICOF Global University is straightforward. Complete the online application, upload your supporting documents, and our admissions office will guide you the rest of the way.',
  applyUrl: 'https://iguc.net/forms/',
  email: 'admission@iguc.net',
  steps: [
    { title: '1 · Choose a Program', body: 'Browse the catalog and select your level — certificate to doctorate.' },
    { title: '2 · Apply Online', body: 'Complete the application form with your personal, academic and program details.' },
    { title: '3 · Submit Documents', body: 'Upload transcripts, identification and references for review.' },
    { title: '4 · Receive Your Offer', body: 'The admissions office reviews your file and emails your admission decision.' },
  ],
  image: '/images/admission-process.jpg',
  banner: '/images/admission-banner.jpg',
};

export const tuition = {
  heading: 'Tuition & Costs',
  // TODO(content): replace with the exact fee schedule from the live site / bursar.
  intro:
    'ICOF Global University is committed to accessible education. Tuition varies by program and level; the schedule below is indicative — contact the admissions office for the current fee structure and payment plans.',
  rows: [
    { program: 'Certificate programs', fee: 'Contact admissions' },
    { program: 'Diploma programs', fee: 'Contact admissions' },
    { program: 'Bachelor degrees', fee: 'Contact admissions' },
    { program: 'Master degrees', fee: 'Contact admissions' },
    { program: 'Doctoral degrees (PhD / DTh)', fee: 'Contact admissions' },
  ],
  note: 'Scholarships and payment plans may be available. Email admission@iguc.net for details.',
};

export const campusLife = {
  heading: 'Campus Life',
  intro:
    'From convocations and graduation ceremonies to fellowship and community outreach, life at ICOF Global University is vibrant, international and full of purpose.',
  gallery: [
    { image: '/images/graduates.jpg', caption: 'Graduating class celebration' },
    { image: '/images/grand-ceremony.jpg', caption: 'Grand ceremony' },
    { image: '/images/hall.jpg', caption: 'University hall' },
    { image: '/images/students.jpg', caption: 'Student community' },
    { image: '/images/ceremonial.jpg', caption: 'Ceremonial procession' },
    { image: '/images/global.jpg', caption: 'A global family' },
    { image: '/images/campus-global.jpg', caption: 'International delegation' },
    { image: '/images/graduation.jpg', caption: 'Commencement day' },
  ],
};

export const events: EventItem[] = [
  // TODO(content): replace with real upcoming events from the WP database
  // (wpst_posts where post_type = event / tribe_events, or the events page).
  {
    slug: 'graduation-ceremony',
    title: 'Graduation & Convocation Ceremony',
    date: '2026-11-28',
    location: 'University Hall',
    image: '/images/graduation.jpg',
    summary: 'The annual conferment of degrees, diplomas and certificates on our graduating class.',
  },
  {
    slug: 'admissions-open-day',
    title: 'Admissions Open Day',
    date: '2026-09-12',
    location: 'Main Campus & Online',
    image: '/images/admission-banner.jpg',
    summary: 'Meet faculty, tour programs and get help with your application — on campus or via live stream.',
  },
  {
    slug: 'leadership-summit',
    title: 'ICOF Global Leadership Summit',
    date: '2026-10-05',
    location: 'Main Auditorium',
    image: '/images/grand-ceremony.jpg',
    summary: 'A gathering of ICOF leaders and scholars from around the world.',
  },
];

export const news: NewsItem[] = [
  // TODO(content): replace with real posts from the WP database (wpst_posts).
  {
    slug: 'new-academic-session',
    title: 'New Academic Session Now Enrolling',
    category: 'Admissions',
    image: '/images/students.jpg',
    excerpt: 'Applications are open for the new academic session across all schools and levels.',
  },
  {
    slug: 'elearning-platform',
    title: 'Study From Anywhere With Our E-Learning Platform',
    category: 'Online Learning',
    image: '/images/banner.jpg',
    excerpt: 'Distance students can access lectures, materials and assessments fully online.',
  },
  {
    slug: 'graduation-highlights',
    title: 'Highlights From Our Latest Graduation',
    category: 'Campus',
    image: '/images/graduates.jpg',
    excerpt: 'Celebrating the achievements of our newest graduates and their families.',
  },
];

export const contact = {
  heading: 'Contact Us',
  email: 'admission@iguc.net',
  // TODO(content): add campus address & phone from the live site footer.
  address: 'ICOF Global University',
  intro:
    'We would love to hear from you. Reach the admissions office by email, or use the online application portal to begin your journey.',
};

export const cta = {
  title: 'Your Future Starts Here.',
  text: 'Join a global community of scholars and leaders. Applications are open for the next academic session.',
  button: { label: 'Enroll Today', href: '/admissions' },
};
