// Course catalogue — every course drawn from the university's real program
// lists (Degrees & Programs page) and the PPDI-RC professional catalogue.

// ---------------------------------------------------------------------------
// HOW A COURSE IS TAUGHT — THREE STATES, NOT A BOOLEAN
// ---------------------------------------------------------------------------
//
// This was `online: boolean`, and the catalogue printed a purple ONLINE badge
// wherever it was true and nothing at all where it was false. Forty-four of the
// forty-nine courses were true, so almost every card in the catalogue said
// ONLINE and only ONLINE — which reads as "this is an online university", the
// exact claim the University has ruled against: THE SCHOOL IS NOT ONLY ONLINE.
// It teaches on campus in Buea and Douala and it teaches at a distance.
//
// A boolean cannot say that. It has room for "online" and "not online", and the
// thing that needed saying — both — is the one state it could not hold. So the
// flag is now the fact it was standing in for:
//
//   'campus'  taught on campus only
//   'online'  taught at a distance only
//   'both'    taught both ways — which is most of them
//
// The existing data already carried the distinction: `online: true` meant
// available at a distance, never that the course had been withdrawn from the
// lecture room. So true became 'both' and false became 'campus' — a reading of
// what was recorded rather than a guess at what was meant.
//
// Any course the University teaches at a distance ONLY is one edit here, and
// the badge, the filter and the search index all follow from this one field.
// ---------------------------------------------------------------------------

/** How a course is delivered. */
export type DeliveryMode = 'campus' | 'online' | 'both';

/**
 * What the reader sees. The catalogue badge, the admin table and the search
 * index all read it, so the three cannot say different things about one course.
 *
 * The three strings are the University's own wording, given exactly: Campus,
 * Online, Online / Campus.
 */
export const MODE_LABEL: Record<DeliveryMode, string> = {
  campus: 'Campus',
  online: 'Online',
  both: 'Online / Campus',
};

export interface Course {
  code: string;
  title: string;
  faculty: string;
  level: 'Certificate' | 'Diploma' | 'HND' | 'Bachelor' | 'Master' | 'Doctorate' | 'Professional';
  mode: DeliveryMode;
  summary: string;
}

/** Can it be taken at a distance? True for 'online' and for 'both'. */
export function isOnline(c: Course): boolean {
  return c.mode !== 'campus';
}

/** Is it taught in the lecture room? True for 'campus' and for 'both'. */
export function isOnCampus(c: Course): boolean {
  return c.mode !== 'online';
}

const T = 'Faculty of Theology';
const E = 'Faculty of Education';
const G = 'Engineering & Technology';
const B = 'GIBMAS — Business & Management';
const P = 'PPDI-RC Professional Development';

export const courses: Course[] = [
  // Theology — Buea & Douala
  { code: 'THE-BA', title: 'Bachelor of Theology', faculty: T, level: 'Bachelor', mode: 'both', summary: 'Biblical languages, exegesis, systematic theology and church history, forming ministers and scholars for service.' },
  { code: 'BDIV', title: 'Bachelor of Divinity', faculty: T, level: 'Bachelor', mode: 'both', summary: 'The theological route to ordination: biblical languages, exegesis and systematic doctrine studied in depth.' },
  { code: 'BMIN', title: 'Bachelor of Ministry', faculty: T, level: 'Bachelor', mode: 'both', summary: 'The practical route to ministry, with supervised placement throughout — preaching, pastoral care, administration and mission.' },
  { code: 'CED-BA', title: 'Bachelor of Christian Education', faculty: T, level: 'Bachelor', mode: 'both', summary: 'Teaching and discipleship within the local church: curriculum, pedagogy and spiritual formation.' },
  { code: 'THE-MA', title: 'Master of Theology', faculty: T, level: 'Master', mode: 'both', summary: 'Advanced study in doctrine, hermeneutics and theological method, with supervised research.' },
  { code: 'DIV-MA', title: 'Master of Divinity', faculty: T, level: 'Master', mode: 'both', summary: 'Comprehensive ministerial formation — preaching, pastoral care, liturgy and church administration.' },
  { code: 'EVM-MA', title: 'Masters in Evangelism and Mission', faculty: T, level: 'Master', mode: 'both', summary: 'Missiology, cross-cultural communication and the practice of evangelism in contemporary contexts.' },
  { code: 'MACL', title: 'Master of Arts in Christian Leadership', faculty: T, level: 'Master', mode: 'both', summary: 'Leadership as the object of study: organisational strategy, governance, ethics and a supervised leadership research project.' },
  { code: 'BLT-MA', title: 'Master of Arts in Black Liberation Theology', faculty: T, level: 'Master', mode: 'both', summary: 'Biblical revelation, history, archaeology, anthropology and social justice, pioneered at ICOF as an academic discipline.' },
  { code: 'PHD-TH', title: 'Doctor of Philosophy (Theology)', faculty: T, level: 'Doctorate', mode: 'both', summary: 'Original doctoral research examined by the Dissertation Council, culminating in a defended thesis.' },
  { code: 'DSTH', title: 'Doctor of Systematic Theology', faculty: T, level: 'Doctorate', mode: 'both', summary: 'Trinitarian theology, Christology, pneumatology, anthropology, soteriology and eschatology, examined by dissertation.' },
  { code: 'DTH', title: 'Doctor of Theology', faculty: T, level: 'Doctorate', mode: 'both', summary: 'Advanced doctrinal scholarship for those teaching and leading within the church.' },
  { code: 'DMIN', title: 'Doctor of Ministry', faculty: T, level: 'Doctorate', mode: 'both', summary: 'Professional doctorate in Christian counseling and church administration for practising ministers.' },
  { code: 'CERT-TH', title: 'Certificate of Theology', faculty: T, level: 'Certificate', mode: 'both', summary: 'Foundational biblical studies for lay leaders and those beginning ministerial training.' },
  { code: 'CERT-CE', title: 'Certificate of Christian Education', faculty: T, level: 'Certificate', mode: 'both', summary: 'Introductory training for Sunday school teachers, youth workers and church educators.' },
  { code: 'DIP-TH', title: 'Diploma in Theology', faculty: T, level: 'Diploma', mode: 'both', summary: 'A condensed theological education: key theological concepts, biblical interpretation, church history and practical ministry skills.' },
  { code: 'DIP-MIN', title: 'Diploma in Ministry', faculty: T, level: 'Diploma', mode: 'both', summary: 'Practical ministerial formation for serving church workers — preaching, pastoral care, administration and evangelism.' },
  { code: 'DIP-CL', title: 'Diploma in Christian Leadership', faculty: T, level: 'Diploma', mode: 'both', summary: 'Servant leadership, governance, team building and stewardship for those leading churches and Christian organisations.' },

  // Education
  { code: 'EDU-PRI', title: 'Primary Education', faculty: E, level: 'Bachelor', mode: 'campus', summary: 'Classroom-ready teacher preparation: pedagogy, curriculum design, assessment and supervised practice.' },
  { code: 'EDU-SPE', title: 'Special Education', faculty: E, level: 'Bachelor', mode: 'campus', summary: 'Inclusive teaching strategies, learning assessment and intervention design for learners with diverse needs.' },

  // Engineering & Technology
  { code: 'SWE', title: 'Software Engineering', faculty: G, level: 'Bachelor', mode: 'both', summary: 'Programming foundations through full-stack development, databases and software project delivery.' },
  { code: 'NET', title: 'Computer Networking', faculty: G, level: 'Diploma', mode: 'both', summary: 'Network infrastructure, administration and security for modern organisations.' },
  { code: 'WEB', title: 'Webmaster', faculty: G, level: 'Diploma', mode: 'both', summary: 'Website construction, deployment and maintenance, including content and performance management.' },
  { code: 'ORA', title: 'Oracle Database', faculty: G, level: 'Certificate', mode: 'both', summary: 'Relational database design, SQL and administration on Oracle systems.' },
  { code: 'HWM', title: 'Hardware Maintenance', faculty: G, level: 'Certificate', mode: 'campus', summary: 'Diagnosis, repair and preventive maintenance of computer systems and peripherals.' },
  { code: 'LCH', title: 'Laptop Chipsets', faculty: G, level: 'Certificate', mode: 'campus', summary: 'Board-level laptop repair: chipset diagnosis, rework and component replacement.' },
  { code: 'ACR', title: 'Air Conditioning & Refrigeration', faculty: G, level: 'Certificate', mode: 'campus', summary: 'Installation, servicing and fault-finding on air-conditioning and refrigeration systems.' },
  { code: 'CAC', title: 'Computerized Accounting', faculty: G, level: 'Diploma', mode: 'both', summary: 'Accounting practice using computerised ledgers, payroll and reporting systems.' },

  // Business & Management
  { code: 'BUS-MGT', title: 'Business Management', faculty: B, level: 'Bachelor', mode: 'both', summary: 'Management, operations, marketing and strategy with an entrepreneurial orientation.' },
  { code: 'PRJ-MGT', title: 'Project Management', faculty: B, level: 'Master', mode: 'both', summary: 'Planning, budgeting, risk and stakeholder management aligned to international standards.' },
  { code: 'NPM', title: 'Non-Profit Management', faculty: B, level: 'Bachelor', mode: 'both', summary: 'Governance, fundraising and programme management for charities, churches and NGOs.' },
  { code: 'BNF', title: 'Banking and Finance', faculty: B, level: 'Bachelor', mode: 'both', summary: 'Financial institutions, credit, investment analysis and financial regulation.' },
  { code: 'ACC', title: 'Accountancy', faculty: B, level: 'Bachelor', mode: 'both', summary: 'Financial and management accounting, audit principles and taxation.' },
  { code: 'INS', title: 'Insurance Policy', faculty: B, level: 'Diploma', mode: 'both', summary: 'Underwriting, claims, risk assessment and insurance regulation.' },
  { code: 'SEC-EX', title: 'Executive Secretarial Duties', faculty: B, level: 'Diploma', mode: 'both', summary: 'Office administration, correspondence, records management and executive support.' },
  { code: 'SEC-BI', title: 'Bilingual Secretarial Duties', faculty: B, level: 'Diploma', mode: 'both', summary: 'Secretarial practice in English and French for bilingual working environments.' },

  // PPDI-RC professional courses
  { code: 'PPD-AGT', title: 'Agritourism', faculty: P, level: 'Professional', mode: 'both', summary: 'Three days bridging agriculture and tourism: marketing, customer service and farm-visitor experiences.' },
  { code: 'PPD-AFD', title: 'Agric Food Development', faculty: P, level: 'Professional', mode: 'both', summary: 'Food production, processing and value-chain development for agricultural enterprises.' },
  { code: 'PPD-FBO', title: 'Food Bank Operations & Development', faculty: P, level: 'Professional', mode: 'both', summary: 'Establishing and running food bank operations serving vulnerable communities.' },
  { code: 'PPD-DBD', title: 'Digital Business Development', faculty: P, level: 'Professional', mode: 'both', summary: 'Three days on online marketing, e-commerce strategy and digital branding.' },
  { code: 'PPD-RLD', title: 'Religious Leadership Development', faculty: P, level: 'Professional', mode: 'both', summary: 'Leadership practice for ministers and church officers in growing congregations.' },
  { code: 'PPD-YTL', title: 'Youth & Teen Leadership Network', faculty: P, level: 'Professional', mode: 'both', summary: 'Professional networking and leadership formation for youth and teen club leaders.' },
  { code: 'PPD-AIY', title: 'AI for Youth & Teen Leaders', faculty: P, level: 'Professional', mode: 'both', summary: 'Practical artificial intelligence literacy and tools for those leading young people.' },
  { code: 'PPD-RDM', title: 'Rehabilitation and Disorder Management', faculty: P, level: 'Professional', mode: 'both', summary: 'Five days on managing rehabilitation programmes for NGOs, medical social workers and wellness practitioners.' },
  { code: 'PPD-MSW', title: 'Medical Social Work', faculty: P, level: 'Professional', mode: 'both', summary: 'Social work practice within health settings, patient advocacy and community referral.' },
  { code: 'PPD-DSW', title: 'Digital Social Work Management', faculty: P, level: 'Professional', mode: 'both', summary: 'Managing social-work casework and outreach through digital platforms.' },
  { code: 'PPD-BTT', title: 'Behaviour & Temperament Therapy', faculty: P, level: 'Professional', mode: 'both', summary: 'Assessment and therapeutic approaches to behaviour and temperament, led by Prof. Barnabas Oluwaleye.' },
  { code: 'PPD-CDM', title: 'Community Development & Management', faculty: P, level: 'Professional', mode: 'both', summary: 'Designing, funding and managing community development initiatives.' },
];

export const faculties = [T, E, G, B, P];
export const levels: Course['level'][] = ['Certificate', 'Diploma', 'HND', 'Bachelor', 'Master', 'Doctorate', 'Professional'];
