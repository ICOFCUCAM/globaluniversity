// Static search index for the public site. Kept alongside the content
// modules so a new page is one entry away from being findable.
import { courses } from './courses';
import { contentPages, degreeLevels } from './pages';
import { programs } from './site';
import { facultyList } from './faculties';

export interface SearchEntry {
  title: string;
  href: string;
  section: string;
  text: string;
}

const pages: SearchEntry[] = [
  { title: 'Home', href: '/', section: 'University', text: 'The Community University of Africa, a global university in Buea, Douala, Nigeria and online worldwide.' },
  { title: "Chancellor's Welcome", href: '/welcome', section: 'University', text: 'Welcome message from the Chancellor Bishop Bernie L Wade PhD, Presiding Bishop of the International Circle of Faith, biography, Vice Chancellor Prof Chamayah Meyembi.' },
  { title: 'About Us', href: '/about', section: 'University', text: 'History, mission and values, accreditation, International Circle of Faith, purpose.' },
  { title: 'Governance & Accreditation', href: '/governance', section: 'University', text: 'Leadership, Chancellor, Vice Chancellor, Registrar, Dissertation Council, quality assurance, Ministry of Higher Education.' },
  { title: 'Schools & Faculties', href: '/faculty', section: 'Academics', text: 'Faculty of Theology Buea, School of Theology Douala, Education, Engineering and Technology, GIBMAS, administration, lecturers.' },
  { title: 'Black Liberation Theology', href: '/black-liberation-theology', section: 'Academics', text: 'Black Liberation Theology master degree, human liberation, Africa, slavery, colonialism, racism, apartheid, neo-colonialism, biblical narrative, African civilizations, salvific and epistemological liberation, Yahuah, justice, reconciliation, archaeology, anthropology, social justice.' },
  { title: 'Bachelor of Theology', href: '/bachelor-of-theology', section: 'Academics', text: 'Bachelor of Theology B.Th. three years 180 ECTS undergraduate degree, Faculty of Theology, BTH101 Introduction to Biblical Studies, Bible Survey Old Testament New Testament, Church History, Evangelism, Christology, full-time part-time online distance learning, ministry chaplaincy missions, research thesis, oral defence.' },
  { title: 'Master of Theology', href: '/master-of-theology', section: 'Academics', text: 'Master of Theology M.Th. African and Black Hebrew theology, contextual theology, ecotheology, creation care, feminist and queer theologies, disability theology, Pauline theology, Global South, thesis, Black Hebrews course, admission requirements.' },
  { title: 'Roots of Faith: Jesus as an African', href: '/roots-of-faith', section: 'Academics', text: 'Jesus as an African, Egypt, Cush, Simon of Cyrene, Ethiopian eunuch, Kwame Bediako, Mercy Amba Oduyoye, James Cone, Black theology, liberation theology, global Christianity, position paper.' },
  { title: 'Research & Innovation', href: '/research', section: 'Academics', text: 'Dissertation Council, doctoral research, PPDI-RC, theology, liberation theology, criminology, counseling.' },
  { title: 'Course Catalogue', href: '/courses', section: 'Academics', text: 'Search all courses by faculty, level and online availability.' },
  { title: 'Degrees & Programs', href: '/programs', section: 'Academics', text: 'Certificates, diplomas, HND, bachelor, master and doctoral programs across all faculties.' },
  { title: 'Study Online', href: '/online-learning', section: 'Academics', text: 'Online learning, live classes, course materials, assignments, exams, transcripts, distance study.' },
  { title: 'Lifelong Learning', href: '/lifelong-learning', section: 'Academics', text: 'Short courses, professional development, certificates, extension courses, training for organisations.' },
  { title: 'Admission Requirements', href: '/admissions', section: 'Admissions', text: 'Entry requirements for certificate, diploma, HND, bachelor, master and doctoral programs, GPA, A-Level, transcripts.' },
  { title: 'Apply Now', href: '/apply', section: 'Admissions', text: 'Free online application form, six steps, personal, academic, program, uploads, review, declaration.' },
  { title: 'International Students', href: '/international', section: 'Admissions', text: 'International admissions, visa, English proficiency, studying from abroad, living in Buea.' },
  { title: 'Scholarships & Financial Aid', href: '/scholarships', section: 'Admissions', text: 'Scholarships, ministry scholarships, sponsorship, financial aid, flexible payment.' },
  { title: 'Cost & Tuition', href: '/tuition', section: 'Admissions', text: 'Tuition fees, full-time, part-time, books, accommodation, student budget, payment methods.' },
  { title: 'Registration', href: '/registration', section: 'Admissions', text: 'Why students choose IGUC, academic programs, expert faculty, supportive community.' },
  { title: 'Campus Life', href: '/campus-life', section: 'Student Life', text: 'Student support services, community engagement, extracurricular activities, facilities, gallery.' },
  { title: 'Events', href: '/events', section: 'Student Life', text: 'Graduation, admission opens, student orientation, important dates, CNPS Hall Buea.' },
  { title: 'News & Announcements', href: '/news', section: 'Student Life', text: 'University news, initiatives, announcements, upcoming dates.' },
  { title: 'Student Portal', href: '/portal', section: 'Portal', text: 'Registration, courses, results, GPA, transcripts, certificates, LMS, assignments, exams, fees, ID cards.' },
  { title: 'Verify a Credential', href: '/verify', section: 'Portal', text: 'Verify transcript or certificate authenticity by QR code.' },
  { title: 'Alumni', href: '/alumni', section: 'Community', text: 'Alumni network, stay connected, verify credentials, give back, alumni in service.' },
  { title: 'Careers at IGUC', href: '/careers', section: 'Community', text: 'Teaching and staff vacancies, faculty recruitment, doctoral supervision, how to apply.' },
  { title: 'Support IGUC', href: '/support', section: 'Community', text: 'University construction project, missions, wells, church construction, scholarships, giving.' },
  { title: 'Donate', href: '/donate', section: 'Community', text: 'Donate to build, pastoral training, evangelism, prisoners, food and clean water.' },
  { title: 'Charity', href: '/charity', section: 'Community', text: 'Schools, food, clothes, health, sanitation, sponsorship, causes.' },
  { title: 'PPDI-RC', href: '/ppdirc', section: 'Academics', text: 'Personal Professional Development Industry and Resource Center Nigeria, professional courses, certification.' },
  { title: 'Institutional Documents', href: '/documents', section: 'University', text: 'Register of institutional documents, academic catalog, prospectus, quality assurance manual, student handbook, research handbook, graduate school handbook, university statutes, strategic plan, research journals, university press, research centres, international office, digital campus, alumni association, accreditation.' },
  { title: 'Academic Catalog', href: '/academic-catalog', section: 'University', text: 'Official academic handbook, chancellor welcome, vice chancellor, history, vision mission core values, governance, faculties, academic calendar, admission requirements, tuition fees, scholarships, student regulations, examination regulations, graduation requirements, degree classifications, academic integrity, research ethics, student services, library, ICT, quality assurance, programmes and course descriptions, download PDF.' },
  { title: 'Policies', href: '/policies', section: 'University', text: 'Code of conduct, academic integrity, disciplinary process, due process, appeals.' },
  { title: 'Contact', href: '/contact', section: 'University', text: 'Phone, email, WhatsApp, address, Buea Cameroon, admissions office.' },
];

export const searchIndex: SearchEntry[] = [
  ...pages,
  // Faculty pages carry the dean's message, research strengths, careers and
  // graduate destinations now. Searching for "chaplaincy" or "cybersecurity"
  // should reach the faculty that teaches it, so all of it is indexed.
  ...facultyList.map((f) => ({
    title: f.name,
    href: `/faculty/${f.slug}`,
    section: 'Faculties',
    text: [
      f.shortName,
      f.campus,
      f.standsFor,
      (f.about ?? f.description).join(' '),
      (f.deansMessage ?? []).join(' '),
      (f.researchStrengths ?? []).join(' '),
      (f.careers ?? []).join(' '),
      (f.graduateDestinations ?? []).join(' '),
      (f.coreValues ?? []).join(' '),
      (f.awards ?? []).map((a) => a.title).join(' '),
      f.leadName ?? '',
    ].join(' '),
  })),
  ...programs.map((p) => ({
    title: p.title,
    href: `/programs/${p.slug}`,
    section: 'Programs',
    text: `${p.level} ${p.school} ${p.summary} ${p.outcomes.join(' ')}`,
  })),
  ...degreeLevels.map((d) => ({
    title: d.title,
    href: `/degrees/${d.slug}`,
    section: 'Programs',
    text: `${d.headline} ${d.subtitle} ${d.why.paragraphs.join(' ')}`,
  })),
  ...contentPages
    .filter((c) => !pages.some((p) => p.href === `/${c.slug}`))
    .map((c) => ({
      title: c.title,
      href: `/${c.slug}`,
      section: 'Pages',
      text: `${c.subtitle ?? ''} ${c.sections.map((s) => `${s.heading ?? ''} ${(s.paragraphs ?? []).join(' ')}`).join(' ')}`,
    })),
  ...courses.map((c) => ({
    title: c.title,
    href: '/courses',
    section: `Course · ${c.code}`,
    text: `${c.level} ${c.faculty} ${c.summary} ${c.online ? 'online' : 'on campus'}`,
  })),
];
