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
  { title: 'Home', href: '/', section: 'University', text: 'The Community University, a global university in Buea, Douala, Nigeria and online worldwide.' },
  { title: "Chancellor's Welcome", href: '/welcome', section: 'University', text: 'Welcome message from the Chancellor Bishop Bernie L Wade PhD, Presiding Bishop of the International Circle of Faith, biography, Vice Chancellor Prof Chamayah Meyembi.' },
  { title: 'About Us', href: '/about', section: 'University', text: 'History, mission and values, accreditation, International Circle of Faith, purpose.' },
  { title: 'Governance & Accreditation', href: '/governance', section: 'University', text: 'Leadership, Chancellor, Vice Chancellor, Registrar, Dissertation Council, quality assurance, Ministry of Higher Education.' },
  { title: 'Schools & Faculties', href: '/faculty', section: 'Academics', text: 'Faculty of Theology Buea, School of Ministry Douala, Education, Engineering and Technology, GIBMAS, administration, lecturers.' },
  { title: 'Black Liberation Theology', href: '/black-liberation-theology', section: 'Academics', text: 'Black Liberation Theology master degree, human liberation, Africa, slavery, colonialism, racism, apartheid, neo-colonialism, biblical narrative, African civilizations, salvific and epistemological liberation, Yahuah, justice, reconciliation, archaeology, anthropology, social justice.' },
  { title: 'Bachelor of Theology', href: '/bachelor-of-theology', section: 'Academics', text: 'Bachelor of Theology B.Th. three years 180 ECTS undergraduate degree, Faculty of Theology, BTH101 Introduction to Biblical Studies, Bible Survey Old Testament New Testament, Church History, Evangelism, Christology, full-time part-time online distance learning, ministry chaplaincy missions, research thesis, oral defence.' },
  { title: 'Bachelor of Ministry', href: '/bachelor-of-ministry', section: 'Academics', text: 'Bachelor of Ministry B.Min. three years 180 ECTS six semesters 34 courses, School of Ministry, MIN101 Introduction to Christian Ministry, BIB101 Old Testament Survey, BIB102 New Testament Survey, THE101 Christian Doctrine, Yahuah the Creator, Yahusha the Messiah, Ruach HaQodesh, theology of Yahuah Yahusha and the Ruach HaQodesh, life and ministry of Yahusha, SFM101 spiritual formation, COM101 communication, hermeneutics, five-fold ministry apostolic prophetic evangelistic pastoral teaching, preaching, evangelism discipleship, worship and music ministry, pastoral care and counseling, church administration, Christian finance and stewardship, missions cross-cultural, Christian media, information technology for ministry, youth and children, community development, research methods, MIN308 ministry practicum, RES302 research project, fourteen specialization tracks, church planting, prayer and intercession, digital ministry, AI, cybersecurity, entrepreneurship, safeguarding, ministerial ethics, recognition of prior learning, certificate diploma bachelor master doctor of ministry.' },
  { title: 'Master of Theology', href: '/master-of-theology', section: 'Academics', text: 'Master of Theology M.Th. African and Black Hebrew theology, contextual theology, ecotheology, creation care, feminist and queer theologies, disability theology, Pauline theology, Global South, thesis, Black Hebrews course, admission requirements.' },
  { title: 'Roots of Faith: Jesus as an African', href: '/roots-of-faith', section: 'Academics', text: 'Jesus as an African, Egypt, Cush, Simon of Cyrene, Ethiopian eunuch, Kwame Bediako, Mercy Amba Oduyoye, James Cone, Black theology, liberation theology, global Christianity, position paper.' },
  { title: 'Research & Innovation', href: '/research', section: 'Academics', text: 'Dissertation Council, doctoral research, PPDI-RC, theology, liberation theology, criminology, counseling.' },
  { title: 'Course Catalogue', href: '/courses', section: 'Academics', text: 'Search all courses by faculty, level and online availability.' },
  { title: 'Degrees & Programs', href: '/programs', section: 'Academics', text: 'Certificates, diplomas, HND, bachelor, master and doctoral programs across all faculties.' },
  { title: 'Study Online', href: '/online-learning', section: 'Academics', text: 'Online learning, live classes, course materials, assignments, exams, transcripts, distance study.' },
  { title: 'Lifelong Learning', href: '/lifelong-learning', section: 'Academics', text: 'Short courses, professional development, certificates, extension courses, training for organisations.' },
  { title: 'Admission Requirements', href: '/admissions', section: 'Admissions', text: 'Entry requirements for certificate, diploma, HND, bachelor, master and doctoral programs, GPA, A-Level, transcripts.' },
  { title: 'Admissions Portal', href: '/admissions-portal', section: 'Admissions', text: 'Admissions portal applicant account track application status payment verification finance office registrar approve reject request documents student number welcome email, not the student portal, applicants cannot register courses or view grades.' },
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
  { title: 'Academic Regulations', href: '/academic-regulations', section: 'University', text: 'Grading scale grade points GPA A B C D F pass mark 65%, special grades W WA WC I NG NC, compulsory elective required course classification, study load subjects per year, seminars, doctoral entry 3.25 GPA, assessment weightings participation assignments examinations presentations research paper, fees late registration penalty bounced cheque, miscellaneous fees transcripts certificate student ID supplementary exams, withdrawal refund schedule 100% 75% 50% 25%, scholarships bursaries.' },
  { title: 'Student Handbook', href: '/student-handbook', section: 'University', text: 'Student rights responsibilities code of conduct academic misconduct discipline attendance grades progress fees withdrawal refunds complaints appeals graduation process.' },
  { title: 'University Prospectus', href: '/prospectus', section: 'University', text: 'Why ICOF, Yeshiva style of learning, campuses Buea Douala online, faculties, degree programmes certificate diploma bachelor master doctorate, student life, international students, admissions, fees scholarships, contact, prospectus download.' },
  { title: 'Graduate School Handbook', href: '/graduate-school-handbook', section: 'Academics', text: 'Postgraduate admission, master degree seminars, doctoral entry 68% GPA 3.25, Doctor of Theology Th.D., Doctor of Systematic Theology DSTh, Doctor of Philosophy PhD, core courses electives, comprehensive examinations, dissertation defence, thesis preparation research methodologies qualitative quantitative exegesis, APA Chicago citation, viva voce, supervisor.' },
  { title: 'University ERP', href: '/erp', section: 'University', text: 'Enterprise resource planning system blueprint, seventeen modules admissions finance registrar student portal course registration lecturer HOD dean examination library LMS hostel human resources research alumni executive dashboard, universal status system colours grey red orange blue yellow purple green dark red black gold, role hierarchy chancellor vice chancellor registrar finance director deans heads of department programme coordinators lecturers.' },
  { title: 'Enterprise Architecture', href: '/erp/architecture', section: 'University', text: 'Enterprise architecture blueprint, board of trustees chancellor vice chancellor registrar finance academic affairs ICT services, student lifecycle thirteen stages prospective application payment verification admission registration learning assessment graduation alumni, seven offices, conditional admission, grade approval chain lecturer HOD dean registrar, graduation degree audit senate, AI layer.' },
  { title: 'Policies', href: '/policies', section: 'University', text: 'Code of conduct, academic integrity, disciplinary process, due process, appeals.' },
  { title: 'Contact', href: '/contact', section: 'University', text: 'Phone, email, WhatsApp, address, Buea Cameroon, admissions office.' },
];

export const searchIndex: SearchEntry[] = [
  ...pages,
  // Faculty pages carry the dean's message, research strengths, careers and
  // graduate destinations now. Searching for "chaplaincy" or "cybersecurity"
  // should reach the faculty that teaches it, so all of it is indexed.
  ...facultyList.map((f) => ({
    title: `${f.shortName} Faculty Handbook`,
    href: `/faculty/${f.slug}/handbook`,
    section: 'Faculties',
    text: `Faculty handbook ${f.name} dean welcome programmes course descriptions assessment grading practicum ministry chapel research expectations graduation requirements contact.`,
  })),
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
