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
  title: 'The Community University of Africa',
  text: 'Educating men and women as skilled professionals in godly principles, morals and ministries worldwide.',
  cta: { label: 'Enroll Today', href: '/admissions' },
  image: '/images/home-hero.jpg',
};

export const quickLinks = [
  { label: 'Events & Important Dates', href: '/events', icon: 'calendar' },
  { label: 'Programs', href: '/programs', icon: 'book' },
  { label: 'Admissions', href: '/admissions', icon: 'award' },
  { label: 'E-Learning', href: 'https://iguc.net/online/', icon: 'laptop' },
  { label: 'Library', href: 'https://iguc.net/igucloud/', icon: 'library' },
  { label: 'Contact', href: '/contact', icon: 'mail' },
];

export const stats = [
  { value: '7,228', label: 'Success Stories' },
  { value: '213', label: 'Courses' },
  { value: '1,742', label: 'Happy Students' },
  { value: '15', label: 'Years Experience' },
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
    image: '/images/chancellor.jpg',
    bio: 'Wade holds doctorates in theology, divinity, Christian education, non-profit management and pastoral counseling. Presiding Bishop of the International Circle of Faith (ICOF). Email: chancellor@iguc.net',
  },
  {
    name: 'Prof Chamayah Meyembi',
    role: 'Vice Chancellor',
    image: '/images/vice-chancellor.png',
    bio: 'Holds a PhD in Theology from International Circle of Faith Colleges, Seminaries and Universities. ICOF Africa Bishop to Youth; elevated to Continental leadership with ICOF in 2010. Email: vc@iguc.net',
  },
];

export const faculty: FacultyMember[] = [
  {
    name: 'Prof Aaron Ndenka',
    role: 'Academic Director General',
    image: '/images/faculty-ndenka.jpg',
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
    image: '/images/faculty-samuel.png',
    bio: 'Holder of Doctor of Divinity from ICOF College Seminary and University USA. Email: dr.skinge@iguc.net',
  },
  {
    name: 'Hoffman Betika Ayuk',
    role: 'Director, School of Business and Management Sciences',
    image: '/images/faculty-ayuk.jpg',
    bio: 'Director of the School of Business and Management Sciences. Email: hoffman@iguc.net',
  },
];

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
  applyUrl: 'https://iguc.net/forms/',
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
