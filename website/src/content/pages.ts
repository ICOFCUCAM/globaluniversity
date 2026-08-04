// ---------------------------------------------------------------------------
// Standalone content pages + degree-level pages, recovered verbatim from the
// WordPress database export (wpst_posts). Rendered by src/app/[slug]/page.tsx
// and src/app/degrees/[slug]/page.tsx.
// ---------------------------------------------------------------------------

export interface ContentSection {
  heading?: string;
  paragraphs?: string[];
  list?: string[];
}

export interface ContentPage {
  slug: string;
  title: string;
  subtitle?: string;
  image: string;
  sections: ContentSection[];
}

export const contentPages: ContentPage[] = [
  {
    slug: 'donate',
    title: 'Donate',
    subtitle: 'Help put smiles on faces — support the work of ICOF Global University.',
    image: '/images/hall.jpg',
    sections: [
      {
        heading: 'Welcome!',
        paragraphs: [
          'Due to the complete absence of religious and theological scholarship in private and state-held universities in Cameroon, Cameroon’s socio-cultural climate can’t be morally pure and humanly conducive when religious scholarship is completely removed from the nation’s scholarly curriculum. Many Cameroonians felt deprived of their rights to embark on higher (post-graduate) religious studies.',
          'ICOF Global University aimed to resolve this puzzle by becoming the first academic/religious institution in Cameroon to take both religious and other academic disciplines to the common people.',
        ],
      },
      {
        heading: 'Donate to Build',
        paragraphs: [
          'Notwithstanding, IGU still suffers major challenges with accommodation and infrastructure as we embark on building our permanent structure. You can assist in making this vision a reality and a blessing to the Kingdom of God.',
          'We therefore appeal for your support to facilitate and enable us to realise our university objective for the greater good of humanity and the Kingdom of God.',
        ],
        list: [
          'University Building Project',
          'Support Pastoral Training',
          'Evangelism & Missions',
          'Support Prisoners',
          'Food & Clean Water Donation',
        ],
      },
      {
        heading: 'How to Donate',
        paragraphs: [
          'To donate to any of these causes, contact us on +237 675 133 426 or write to info@iguc.net and our team will guide you through the giving process.',
        ],
      },
    ],
  },
  {
    slug: 'charity',
    title: 'Charity',
    subtitle: 'Give a little. Change a lot.',
    image: '/images/global.jpg',
    sections: [
      {
        heading: 'Schools',
        paragraphs: [
          'Education is our top priority. Find out how you can contribute to help an individual or community. We support prison education via our partners, we give scholarships to students, and many more ways to support education.',
        ],
      },
      {
        heading: 'Food',
        paragraphs: [
          'We plan to increase the amount of food that we are providing. We visit the prison for support, orphanage homes and small communities to donate food. We say no to hunger — no child deserves to die of hunger.',
        ],
      },
      {
        heading: 'Clothes',
        paragraphs: [
          'We are accepting second-hand clothes in good shape or money donations. We visit communities, villages, prisons and orphanages and donate to those who can’t afford proper dress.',
        ],
      },
      {
        heading: 'Health',
        paragraphs: [
          'The health of every African child is our concern. We visit small communities, villages and prisons for health checks and laboratory screening. We also give proper medication for illnesses and follow up with recovery. We believe not everyone can afford proper medication.',
        ],
      },
      {
        heading: 'Sanitation',
        paragraphs: [
          'Proper sanitation guarantees a better health condition. We are not limited to providing medical attention to a community, village or prison — we also make sure their environment is properly checked and cleaned to avoid common illnesses.',
        ],
      },
      {
        heading: 'Sponsorship',
        paragraphs: [
          'We help to provide the best assistance to children and individuals willing but not able to pursue their dreams. Our sponsorship scheme is via scholarship programs that we offer — not limited to ICOF Global University, but also at the elementary level of education.',
        ],
      },
      {
        heading: 'Recent Causes',
        paragraphs: [
          'Your donation is the biggest part of our budget and makes a huge difference in the lives of these African children. Each donation matters, even the smallest ones. Donate $2 (the average price of a coffee in the USA) and someone’s life will get better!',
        ],
        list: [
          'Our University Building Project — Goal: $1,000,000',
          'Food and Clean Water — Goal: $76,000',
          'School Supplies — Goal: $30,000',
        ],
      },
    ],
  },
  {
    slug: 'support',
    title: 'Support IGUC',
    subtitle: 'Empower change: support ICOF Global University’s vision.',
    image: '/images/grand-ceremony.jpg',
    sections: [
      {
        heading: 'Our Support System',
        paragraphs: [
          'Welcome to ICOF Global University’s community of changemakers! At IGU, we are dedicated to fostering positive transformation in our world, and we invite you to join us on this journey. Your support enables us to embark on several vital initiatives aimed at creating lasting impact.',
        ],
      },
      {
        heading: 'University Construction Project',
        paragraphs: [
          'Join us in our mission to build the future of education! We’re embarking on an ambitious project to create a cutting-edge university campus, a vibrant hub where ideas flourish and innovation takes flight. Together, let’s raise $1,000,000 to bring this vision to life. Every contribution fuels the journey towards a place where knowledge knows no bounds and creativity knows no limits.',
        ],
      },
      {
        heading: 'Missions & Evangelism',
        paragraphs: [
          'At ICOF Global Network, we advocate for a strategic approach to minimize outreach costs by reallocating resources and finances. Instead of investing in travel expenses, your contribution can empower someone to engage directly in outreach activities, amplifying the reach and impact of the Kingdom of God.',
        ],
      },
      {
        heading: 'Build a Well & Provide Fresh Water',
        paragraphs: [
          'Your contribution will bring about life-changing improvements for an estimated 5,000 individuals in Africa. We offer two types of well construction: a basic spring box well, priced at approximately $2,500, and a drilled well, from $10,000, varying by location and depth. Each well is commemorated with a plaque, allowing donors to honor their loved ones.',
        ],
      },
      {
        heading: 'Donate for Church Construction',
        paragraphs: [
          'Picture a place where communities gather, hearts are uplifted, and lives are transformed. Your donation isn’t just an investment in bricks and mortar; it’s an investment in the spiritual growth of individuals and the collective wellbeing of a community.',
        ],
      },
      {
        heading: 'Donate to Send a Child to School',
        paragraphs: [
          'Your compassionate hand can pave the way for an orphan or children in zones of disaster to stride confidently into the realm of learning. By extending your generosity, you offer not just books and uniforms, but a passport to a brighter future.',
        ],
      },
      {
        heading: 'Support the "Called" Through Biblical & Theological Training',
        paragraphs: [
          'Many bright souls yearn for theological education yet are hindered by financial constraints. Our organization offers numerous comprehensive scholarship programs to alleviate this burden. Your support has the power to illuminate the path for one such individual, enabling them to answer their divine calling.',
          '"Generosity is not about how much you give, but how much love you put into giving." — Mother Teresa',
          'Thank you for joining us in our mission to build a better tomorrow. Together, we can achieve greatness. Contact us on +237 675 133 426 or info@iguc.net to give.',
        ],
      },
    ],
  },
  {
    slug: 'ppdirc',
    title: 'PPDI-RC',
    subtitle: 'Personal Professional Development Industry & Resource Center',
    image: '/images/program-business.jpg',
    sections: [
      {
        heading: 'About PPDI-RC',
        paragraphs: [
          'We are delighted to invite you to join the Personal Professional Development Industry and Resource Center (PPDI-RC), where we prioritize your professional and personal development. In today’s ever-changing work environment, it’s essential to stay ahead by continuously learning and evolving. At PPDI-RC, we offer a diverse range of courses designed to equip you with the skills and knowledge needed to excel in your chosen field.',
          'Our center is dedicated to fostering an environment where personal growth translates into increased motivation, improved employee communication, and overall happiness in the workplace. Our programs are designed to meet the growing demand in the industry for companies to support the personal growth of their workforce.',
          'At PPDI-RC, we provide an academic environment that encourages and supports personal and professional growth. Our comprehensive resources, expert faculty, and industry-aligned programs make us the ideal place to advance your career and achieve your personal development goals.',
        ],
      },
      {
        heading: 'Courses',
        list: [
          'Agritourism',
          'Agric Food Development',
          'Food Bank Operations & Development',
          'AgriTech Daycation Program',
          'Digital Business Development',
          'Religious Leadership Development Course',
          'Youth | TeenClub Professional Network & Leadership Course',
          'Youth & Teen Work Management',
          'AI for Teen Leaders & AI for Youth Leaders',
          'Rehabilitation and Disorder Management',
          'Medical Social Work',
          'Digital Social Work Management',
          'Behavior | Temperament Therapy',
          'Community Development & Management',
        ],
      },
      {
        heading: 'Enrollment & Certification',
        paragraphs: [
          'Our courses are free, but for a small fee of ₦6,000 you can receive a certificate upon completion, validating your newly acquired skills and knowledge.',
          'For more information or to apply, please contact Dr. Barnabas Oluwaleye, Director of Studies, Strategy & Relations, at +234 803 428 1308 or WhatsApp +234 708 227 3055, or email orchardsconsult@gmail.com.',
        ],
      },
    ],
  },
  {
    slug: 'policies',
    title: 'Policies',
    subtitle: 'Disciplinary measures at ICOF Global University',
    image: '/images/hall.jpg',
    sections: [
      {
        paragraphs: [
          'ICOF Global University is steadfast in its commitment to fostering a culture of academic integrity, ethical behavior, and safety. Our comprehensive disciplinary measures are designed to address violations of university policies and codes of conduct, ensuring a campus environment conducive to learning and personal development.',
        ],
      },
      {
        heading: 'Code of Conduct',
        paragraphs: [
          'The Code of Conduct at ICOF Global University delineates the expected behaviors and standards for all members of the university community, including students, faculty, and staff:',
        ],
        list: [
          'Academic Integrity: upholding honesty in all academic endeavors, prohibiting plagiarism, cheating, and other forms of academic dishonesty.',
          'Respectful Behavior: promoting mutual respect among community members, prohibiting harassment, bullying, and any form of discriminatory behavior.',
          'Non-Discrimination: ensuring an inclusive environment free from discrimination based on race, gender, sexual orientation, religion, disability, or any other protected characteristic.',
          'Compliance with Laws and Regulations: adhering to local, state, and federal laws, as well as university-specific regulations.',
        ],
      },
      {
        heading: 'Disciplinary Process',
        list: [
          'Investigation: a thorough investigation is conducted to gather all relevant information and evidence.',
          'Assessment: the gathered evidence is assessed to determine whether a violation has occurred and the severity of the infraction.',
          'Decision: based on the findings, a decision is made regarding the appropriate disciplinary action, communicated with its rationale.',
          'Right to Appeal: the parties involved have the right to appeal the decision before an independent panel.',
        ],
      },
      {
        heading: 'Range of Disciplinary Actions',
        list: [
          'Warning: a formal or informal warning outlining the nature of the violation and the consequences of further infractions.',
          'Probation: a period during which specific conditions must be met, possibly with additional monitoring.',
          'Suspension: temporary removal from the university, prohibiting participation in classes and campus activities.',
          'Expulsion: permanent dismissal from the university for the most severe violations.',
        ],
      },
      {
        heading: 'Due Process',
        paragraphs: [
          'ICOF Global University is committed to upholding the principles of due process in all disciplinary proceedings: the right to be heard, the right to present evidence, and the right to appeal. Our commitment to transparency, fairness, and accountability is unwavering.',
        ],
      },
    ],
  },
  {
    slug: 'registration',
    title: 'Registration',
    subtitle: 'Why everyone desires the ICOFGU',
    image: '/images/wp/g-students.jpg',
    sections: [
      {
        heading: 'Exceptional Academic Programs',
        paragraphs: [
          'Our institution boasts a diverse range of rigorous academic programs designed to challenge and inspire students. Whether you’re pursuing a degree in business, science, humanities, or any other field, our curriculum is crafted to provide you with the knowledge and skills necessary to excel in your chosen career path.',
        ],
      },
      {
        heading: 'Expert Faculty',
        paragraphs: [
          'Our faculty members are experts in their respective fields, dedicated to fostering a dynamic learning environment where students can thrive. With their wealth of experience and passion for teaching, they are committed to providing personalized guidance and support to help you reach your full potential.',
        ],
      },
      {
        heading: 'Opportunities for Growth and Development',
        paragraphs: [
          'Beyond the classroom, our school offers numerous opportunities for personal and professional growth. Whether through internships, research projects, study abroad programs, or extracurricular activities, you’ll have the chance to broaden your horizons, gain real-world experience, and build valuable skills that will benefit you both during your time at our institution and beyond graduation.',
        ],
      },
      {
        heading: 'Supportive Community',
        paragraphs: [
          'At our school, you’ll become part of a vibrant and supportive community of students, faculty, staff, and alumni who are committed to your success. Whether you need academic assistance, career guidance, or simply someone to talk to, you’ll find a network of individuals who are eager to help you thrive and succeed.',
          'Ultimately, attending our school is not just about earning a degree — it’s about embarking on a transformative educational journey that will empower you to achieve your goals, make meaningful contributions to society, and lead a fulfilling life.',
        ],
      },
    ],
  },
  {
    slug: 'ppdi-rc-application',
    title: 'PPDI-RC Application',
    subtitle: 'Register for a Personal Professional Development course',
    image: '/images/program-business.jpg',
    sections: [
      {
        heading: 'How to Register',
        paragraphs: [
          'To register for a PPDI-RC course, provide your name, email, phone, the course name and its start date, plus an emergency contact. Courses are free; an optional certificate of completion is available for a small fee of ₦6,000.',
          'Send your registration details to Dr. Barnabas Oluwaleye, Director of Studies, Strategy & Relations — phone +234 803 428 1308, WhatsApp +234 708 227 3055, or email orchardsconsult@gmail.com — and you will receive confirmation with payment instructions for the certificate if desired.',
        ],
      },
      {
        heading: 'Available Courses',
        list: [
          'Agritourism (3 days)',
          'Agric Food Development',
          'Food Bank Operations & Development',
          'AgriTech Daycation Program',
          'Digital Business Development (3 days)',
          'Religious Leadership Development Course',
          'Youth | TeenClub Professional Network & Leadership Course',
          'Youth & Teen Work Management',
          'AI for Teen Leaders & AI for Youth Leaders',
          'Rehabilitation and Disorder Management (5 days)',
          'Medical Social Work',
          'Digital Social Work Management',
          'Behavior | Temperament Therapy',
          'Community Development & Management',
        ],
      },
    ],
  },
  {
    slug: 'research',
    title: 'Research & Innovation',
    subtitle: 'Scholarship in service of the church, the community and the continent.',
    image: '/images/wp/g-decor.jpg',
    sections: [
      {
        paragraphs: [
          'Research at ICOF Global University grows out of our identity: a community of faith and scholarship serving African society. Our faculty and doctoral candidates pursue questions where theology, education, business and technology meet the lived realities of Cameroon and the wider continent.',
        ],
      },
      {
        heading: 'The Dissertation Council',
        paragraphs: [
          'Doctoral scholarship is examined by the Dissertation Council, presided over by Professor Emeritus Arch Bishop Godfred Anyere Tah. Every Doctor of Philosophy, Doctor of Theology and Doctor of Ministry dissertation passes through supervised research, defense and review, holding our doctoral graduates to international standards of academic rigor.',
        ],
      },
      {
        heading: 'Fields of Inquiry',
        list: [
          'Systematic and practical theology in African contexts',
          'Liberation theology and identity politics',
          'Theology and criminology',
          'Christian counseling and behavioral/temperament therapy',
          'Education and inclusive learning',
          'Finance, management and non-profit governance',
          'Community development and rehabilitation',
        ],
      },
      {
        heading: 'PPDI-RC: Applied Research & Development',
        paragraphs: [
          'Through the Personal Professional Development Industry & Resource Center in Nigeria, directed by Prof. Barnabas Oluwaleye, the university pursues applied research and professional training in behavioral therapy, agritourism and agritech, digital business development, medical social work and community development — connecting scholarship directly to industry and community practice.',
        ],
      },
      {
        heading: 'Research Training',
        paragraphs: [
          'Research methods, academic writing and supervised dissertation work are integral to our master\u2019s and doctoral programs. Candidates study with supervisors who publish and practice in their fields, and defend their work before the Dissertation Council. Prospective researchers should review the doctoral admission requirements or contact the Registrar at registrar@iguc.net.',
        ],
      },
    ],
  },
  {
    slug: 'international',
    title: 'International Students',
    subtitle: 'A global family of learners, rooted in Africa and connected worldwide.',
    image: '/images/global.jpg',
    sections: [
      {
        paragraphs: [
          'ICOF Global University belongs to the worldwide fellowship of the International Circle of Faith, with sister colleges, seminaries and ministries across Africa, the Americas, Europe and Asia. Students join us from many nations \u2014 on campus in Buea and Douala, through our center in Nigeria, and online from anywhere in the world.',
        ],
      },
      {
        heading: 'Admission for International Applicants',
        list: [
          'Apply with qualifications comparable to the Cameroon GCE Advanced Level (undergraduate) or an accredited degree (graduate study) from a recognized institution in your country.',
          'Provide proof of English language proficiency.',
          'Hold an approved, valid visa if you intend to reside in Cameroon; fully online study requires no visa.',
          'Complete the free online application; our enrollment representatives guide credential evaluation and transfer of coursework.',
        ],
      },
      {
        heading: 'Studying From Abroad',
        paragraphs: [
          'Master\u2019s and doctoral programs are offered fully online: live classes, course materials, assessments and supervision are delivered through the student portal, and your transcript builds automatically as you study. Graduation ceremonies in Buea welcome international graduates and their families every January.',
        ],
      },
      {
        heading: 'Living in Buea',
        paragraphs: [
          'Buea, in the foothills of Mount Cameroon, is one of Central Africa\u2019s university towns \u2014 anglophone, welcoming and affordable. Single-room student accommodation with kitchen and facilities ranges from 35,000 to 50,000 FCFA per month, and the campus sits opposite Bulu Blind Junction with easy access to the town.',
        ],
      },
      {
        heading: 'Contact International Admissions',
        paragraphs: [
          'Write to admissions@iguc.net or call +237 675 133 426 (WhatsApp available). We respond to every enquiry and can connect you with ICOF representatives in your region.',
        ],
      },
    ],
  },
  {
    slug: 'scholarships',
    title: 'Scholarships & Financial Aid',
    subtitle: 'Earning a degree shouldn\u2019t break the bank.',
    image: '/images/graduates.jpg',
    sections: [
      {
        paragraphs: [
          'We realize each student is unique \u2014 and that includes their financial situation. Alongside flexible payment methods for tuition, the university provides financial aid through scholarship programs announced during the academic year.',
        ],
      },
      {
        heading: 'University Scholarships',
        paragraphs: [
          'Scholarship programs are published on this website and through our social media and newsletters. Awards consider academic merit and financial need. Follow our announcements, or subscribe to updates through the contact page, to know when a scholarship window opens.',
        ],
      },
      {
        heading: 'Support the Called \u2014 Ministry Scholarships',
        paragraphs: [
          'Many bright students called to theological education are hindered by financial constraints. Our comprehensive ministry scholarship program, funded by donors, supports biblical and theological training for those preparing for service. Prospective beneficiaries should write to admissions@iguc.net; donors can give through our Support IGUC initiative.',
        ],
      },
      {
        heading: 'Sponsorship Beyond the University',
        paragraphs: [
          'Through our charity arm, sponsorship extends to elementary education for children and individuals willing but not able to pursue their dreams \u2014 because access to education is part of our mission at every level.',
        ],
      },
      {
        heading: 'Flexible Payment',
        paragraphs: [
          'Tuition can be paid full-time or part-time, with mobile money, bank transfer and cash accepted at the bursary. See Cost & Tuition for the current schedule, or contact the student support office for a personal plan.',
        ],
      },
    ],
  },
  {
    slug: 'lifelong-learning',
    title: 'Lifelong Learning',
    subtitle: 'Short courses and professional development for every stage of your career.',
    image: '/images/program-business.jpg',
    sections: [
      {
        paragraphs: [
          'Education at ICOF Global University does not end at graduation. Through certificate programs, extension courses and the Personal Professional Development Industry & Resource Center (PPDI-RC), we serve working professionals, ministers, entrepreneurs and community leaders who keep learning throughout their careers.',
        ],
      },
      {
        heading: 'Professional Development Courses',
        paragraphs: [
          'PPDI-RC offers short, intensive courses \u2014 typically three to five days \u2014 in fields from Digital Business Development and Agritourism to Rehabilitation & Disorder Management and AI for Youth Leaders. Courses are free to attend; certification is available for a small fee.',
        ],
      },
      {
        heading: 'Certificates & Extension Courses',
        paragraphs: [
          'University certificate programs across theology, education, engineering, technology and business provide credentials you can earn quickly, with study modes that fit around full-time work. Extension courses vary by program \u2014 contact the student support office for the current offering.',
        ],
      },
      {
        heading: 'For Churches & Organizations',
        paragraphs: [
          'We partner with ministries, schools and businesses to train their teams \u2014 from pastoral training programs to management and secretarial upskilling. Write to info@iguc.net to discuss a cohort for your organization.',
        ],
      },
    ],
  },
  {
    slug: 'alumni',
    title: 'Alumni',
    subtitle: 'Once a member of this community, always a member \u2014 wherever in the world you serve.',
    image: '/images/wp/g-graduates.jpg',
    sections: [
      {
        paragraphs: [
          'More than 7,200 success stories have passed through ICOF Global University since 2007 \u2014 ministers, teachers, engineers, managers and counselors now serving congregations, schools, businesses and communities across Africa, Europe, the Americas and Asia. Our alumni are the university\u2019s living argument: evidence that faith and scholarship, formed together, change societies.',
        ],
      },
      {
        heading: 'Stay Connected',
        paragraphs: [
          'We are building a formal alumni network with verified alumni profiles in the student portal, reunion gatherings at the January graduation ceremony in Buea, and regional ICOF chapters worldwide. To register as an alumnus or update your details, write to registrar@iguc.net with your name, graduating class and program.',
        ],
      },
      {
        heading: 'Verify Your Credentials',
        paragraphs: [
          'Employers and institutions can verify ICOF Global University transcripts and certificates instantly: every document we issue carries a signed QR code that resolves at iguc.net/verify. Alumni needing re-issued transcripts should contact the Registrar\u2019s office.',
        ],
      },
      {
        heading: 'Give Back',
        paragraphs: [
          'Alumni giving funds the ministry scholarship program, the university building project and community initiatives from clean-water wells to prison education. Every gift, at any level, extends to the next generation the opportunity you received. Visit Support IGUC or write to info@iguc.net to give.',
        ],
      },
      {
        heading: 'Alumni in Service',
        paragraphs: [
          'Our graduates lead churches and ministries across the ICOF worldwide fellowship, teach in schools and universities, direct businesses and non-profits, and staff this university itself \u2014 several members of our administration and faculty earned their doctorates within the ICOF college network before returning to teach. That circle, from student to leader to teacher, is the university\u2019s proudest tradition.',
        ],
      },
    ],
  },
  {
    slug: 'governance',
    title: 'Governance & Accreditation',
    subtitle: 'How the university is led, and the recognition its degrees carry.',
    image: '/images/wp/g-hall.jpg',
    sections: [
      {
        heading: 'Accreditation',
        paragraphs: [
          'ICOF Global University is accredited by the Ministry of Higher Education of the Republic of Cameroon (www.minesup.gov.cm) and has been continually accredited since 2007, updating its Reaffirmation of Accreditation as the years progress. The university belongs to the International Circle of Faith network of colleges, seminaries and universities, whose institutions span Africa, the Americas, Europe and Asia.',
        ],
      },
      {
        heading: 'University Leadership',
        list: [
          'Chancellor \u2014 Bishop Bernie L Wade, PhD: visionary oversight of the university and the worldwide ICOF family.',
          'President \u2014 Dr. Raymond L Young: institutional strategy and global coordination.',
          'Vice Chancellor \u2014 Prof Chamayah Meyembi: academic administration and institutional development.',
          'Academic Director General \u2014 Prof Aaron Ndenka: academic quality across all faculties.',
          'Registrar \u2014 Prof Lyonga Divine: records, registration and certification.',
          'Dissertation Council \u2014 presided by Professor Emeritus Arch Bishop Godfred Anyere Tah: examination of all doctoral research.',
        ],
      },
      {
        heading: 'Academic Structure',
        paragraphs: [
          'Five schools and faculties carry the university\u2019s teaching mission: the Faculty of Theology in Buea, the School of Theology in Douala, the Faculty of Education, the Faculty of Engineering and Technology, and the Global Institute of Business and Management Science (GIBMAS) \u2014 together with the PPDI-RC professional development center in Nigeria. Each is led by a director accountable to the Academic Director General.',
        ],
      },
      {
        heading: 'Integrity & Accountability',
        paragraphs: [
          'The university operates under a published Code of Conduct covering academic integrity, respectful behavior, non-discrimination and legal compliance, with a structured disciplinary process that guarantees due process \u2014 the right to be heard, to present evidence and to appeal. Every credential we issue carries a signed QR code verifiable at iguc.net/verify, and all portal activity is audit-logged.',
        ],
      },
      {
        heading: 'Quality Assurance',
        paragraphs: [
          'Program reviews, examination moderation and dissertation defense before the Dissertation Council uphold academic standards across campus and online delivery alike. Enquiries regarding governance or accreditation may be addressed to the Registrar at registrar@iguc.net.',
        ],
      },
    ],
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    image: '/images/banner.jpg',
    sections: [
      {
        heading: 'Who We Are',
        paragraphs: ['Our website address is: https://iguc.net.'],
      },
      {
        heading: 'What Personal Data We Collect and Why',
        paragraphs: [
          'Contact and application forms: when you submit a form on this site, we collect the information you provide (such as your name, email address and application details) solely to process your enquiry or application. It is sent to the university’s admissions office and is not shared with third parties.',
          'Media: if you upload images to the website, you should avoid uploading images with embedded location data (EXIF GPS) included. Visitors to the website can download and extract any location data from images on the website.',
          'Embedded content from other websites behaves in the exact same way as if the visitor has visited the other website. These websites may collect data about you, use cookies, embed additional third-party tracking, and monitor your interaction with that embedded content.',
        ],
      },
      {
        heading: 'Your Rights',
        paragraphs: [
          'If you have submitted personal data through this site, you can request to receive an exported file of the personal data we hold about you, or request that we erase it. Contact info@iguc.net for any privacy request.',
        ],
      },
    ],
  },
];

export function getContentPage(slug: string): ContentPage | undefined {
  return contentPages.find((p) => p.slug === slug);
}

// ---------------------------------------------------------------------------
// Degree-level pages (Degrees & Programs submenu)
// ---------------------------------------------------------------------------

export interface DegreeLevel {
  slug: string;
  title: string;
  headline: string;
  subtitle: string;
  why: { heading: string; paragraphs: string[] };
  facultyPrograms: Array<{ faculty: string; programs: string[] }>;
  requirements: string[];
  international: string;
  duration?: string;
  image: string;
}

const UNDERGRAD_REQUIREMENTS = [
  'You must have an Advanced Level (A/L) Slip or Certificate from the Cameroon General Certificate of Education Board with appropriate points and subjects depending on the degree program you chose, or hold a comparable qualification from a recognized institution abroad.',
  'Have a minimum of 3 points as shown on the A/L Slip or Certificate.',
  'Meet work experience requirements or have access to an organizational environment, depending on your selected degree program.',
  'Be a citizen or permanent resident of the Republic of Cameroon or hold an approved, valid visa if residing in Cameroon.',
  'Not have been expelled from a previous institution.',
  'Complete all required forms for admission and submit an official A/L Certificate or equivalent.',
];

const TECH_PROGRAMS = [
  'Computer Networking',
  'Software Engineering',
  'Webmaster',
  'Hardware Maintenance',
  'Air Conditioning & Refrigeration',
  'Oracle Database',
  'Laptop Chipsets',
  'Networking',
  'Computerized Accounting',
  'Secretarial Duties',
];

const BUSINESS_PROGRAMS = [
  'Executive Secretarial Duties',
  'Bilingual Secretarial Duties',
  'Business Management',
  'Project Management',
  'Non-Profit Management',
  'Banking and Finance',
  'Accountancy',
  'Insurance Policy',
];

export const degreeLevels: DegreeLevel[] = [
  {
    slug: 'bachelors-degrees',
    title: "Bachelor's Degrees",
    headline: 'Open doors with a bachelor’s degree',
    subtitle: 'Take the next step by earning a bachelor’s degree from ICOF Global University.',
    why: {
      heading: 'Why go to our school',
      paragraphs: [
        'Having a bachelor’s degree has become increasingly important. Even if you’re already working in your chosen field, not having a college education can stand between you and advancement opportunities. ICOF Global University has degree programs designed with the needs of working adults in mind.',
        'We put higher education within reach of working adults like you with convenient and flexible programs. You can earn a BS or BA online, on-campus at selected locations and according to your schedule. With a wide range of offerings, we can help you meet your next challenge and rise to your full potential.',
      ],
    },
    facultyPrograms: [
      {
        faculty: 'Faculty of Theology',
        programs: ['Bachelor of Christian Education', 'Bachelor of Arts', 'Bachelor of Theology', 'Bachelor of Science'],
      },
      { faculty: 'Engineering and Technology', programs: TECH_PROGRAMS.map((p) => `Bachelor’s of ${p}`) },
      { faculty: 'Business Management Science and Administration', programs: BUSINESS_PROGRAMS.map((p) => `Bachelor’s in ${p}`) },
      { faculty: 'Faculty of Education', programs: ['Primary Education', 'Special Education'] },
    ],
    requirements: UNDERGRAD_REQUIREMENTS,
    international: 'Proof of English language.',
    image: '/images/graduation.jpg',
  },
  {
    slug: 'masters-degrees',
    title: "Master's Degrees",
    headline: 'Go further with a Master’s degree',
    subtitle: 'Earn your degree without putting your life on hold.',
    why: {
      heading: 'Why further your education',
      paragraphs: [
        'An advanced degree can be an important stepping stone in your career. Not only does it help distinguish you from the crowd, it shows your commitment to your field. Going back to school, however, might seem impossible with all of your professional and family obligations.',
        'We have master’s programs designed to fit into your busy schedule, with both online and on-campus classes available. Our students enjoy access to valuable learning resources and a regularly updated curriculum taught by dedicated and experienced faculty. Earn your degree without putting your entire life on hold with ICOF Global University.',
      ],
    },
    facultyPrograms: [
      { faculty: 'Faculty of Theology', programs: ['Master of Theology', 'Master of Divinity', 'Masters in Evangelism and Mission'] },
      { faculty: 'Faculty of Engineering and Technology', programs: ['Contact admissions for current offerings'] },
      { faculty: 'Business Management Science and Administration', programs: ['Project Management', 'Business Management'] },
    ],
    requirements: [
      'You must have an undergraduate degree from an approved, regionally or nationally accredited college or university, or hold a comparable degree from a recognized institution abroad.',
      'Have a cumulative GPA of 2.5 (on a 4.0 scale) as shown on the undergraduate degree transcript.',
      'Meet work experience requirements or have access to an organizational environment, depending on your selected degree program.',
      'Be a citizen or permanent resident of the Republic of Cameroon or hold an approved, valid visa if residing in Cameroon.',
      'Not have been expelled from a previous institution.',
      'Complete all required forms for admission and submit an official undergraduate degree posted transcript.',
    ],
    international: 'Proof of English language.',
    duration: '2 years',
    image: '/images/grand-ceremony.jpg',
  },
  {
    slug: 'doctoral',
    title: 'Doctoral',
    headline: 'Earn your doctoral degree',
    subtitle: 'Your future as a leader in your field is within reach.',
    why: {
      heading: 'Why excel in your education',
      paragraphs: [
        'Pursuing a doctoral degree can help position you to be a leader in your field and to contribute to its body of knowledge. Our degrees focus on today’s challenging business and organizational needs, from addressing critical social issues to developing solutions to accelerate community building and industry growth.',
        'We are a dedicated doctoral school that puts students in the center of an effective ecosystem of experts, resources and tools as they rise to the pinnacle of their education. A vibrant community of researchers and scholars helps you stand out in your field. Just as importantly, our flexible online courses let you work towards your doctorate anywhere at any time.',
      ],
    },
    facultyPrograms: [
      { faculty: 'Faculty of Theology', programs: ['Doctor of Philosophy', 'Doctor of Theology', 'Doctor of Ministry (Christian Counseling & Administration)'] },
    ],
    requirements: [
      'You must have a graduate degree from an approved, regionally or nationally accredited college or university, or hold a comparable degree from a recognized foreign institution.',
      'Have a minimum cumulative GPA of 3.0 as shown on the graduate degree transcript.',
      'Meet work experience requirements or have access to an organizational environment, depending on your selected degree program.',
      'Be a citizen or permanent resident of the Republic of Cameroon or hold an approved, valid visa if residing in Cameroon.',
      'Not have been expelled from a previous institution.',
      'Complete all required forms for admission and submit an official graduate degree posted transcript.',
    ],
    international: 'Proof of English language.',
    duration: '2 years',
    image: '/images/ceremonial.jpg',
  },
  {
    slug: 'higher-national-diploma-hnd',
    title: 'Higher National Diploma (HND)',
    headline: 'Build professional skills with an HND',
    subtitle: 'Practical, career-focused programs to make you job-ready.',
    why: {
      heading: 'Why choose an HND',
      paragraphs: [
        'Our Higher National Diploma programs are well designed and structured to fit you into the competitive job market. We pride our students to stand out unique with our professional courses in all our faculties.',
      ],
    },
    facultyPrograms: [
      {
        faculty: 'Faculty of Theology',
        programs: ['Certificate of Christian Education', 'Certificate of Arts', 'Certificate of Theology', 'Certificate of Science'],
      },
      { faculty: 'Engineering and Technology', programs: TECH_PROGRAMS },
      { faculty: 'Business Management Science and Administration', programs: BUSINESS_PROGRAMS },
    ],
    requirements: UNDERGRAD_REQUIREMENTS,
    international: 'Proof of English language.',
    image: '/images/students.jpg',
  },
  {
    slug: 'diploma-dip',
    title: 'Diploma (Dip)',
    headline: 'Start strong with a Diploma',
    subtitle: 'Focused programs that get you working sooner.',
    why: {
      heading: 'Why choose a Diploma',
      paragraphs: [
        'Our Diploma programs offer practical, focused training across engineering, technology and business disciplines — a fast route into employment or a stepping stone to a full degree.',
      ],
    },
    facultyPrograms: [
      { faculty: 'Engineering and Technology', programs: TECH_PROGRAMS },
      { faculty: 'Business Management Science and Administration', programs: BUSINESS_PROGRAMS },
    ],
    requirements: UNDERGRAD_REQUIREMENTS,
    international: 'Proof of English language.',
    image: '/images/program-engineering.jpg',
  },
  {
    slug: 'certificates',
    title: 'Certificates',
    headline: 'Certificates that count',
    subtitle: 'Short, professional programs to sharpen your skills.',
    why: {
      heading: 'Why earn a Certificate',
      paragraphs: [
        'The University offers certificate programs, as well as individual, test-preparation and non-credit professional development courses — practical credentials you can earn quickly.',
      ],
    },
    facultyPrograms: [
      { faculty: 'Engineering and Technology', programs: TECH_PROGRAMS },
      { faculty: 'Business Management Science and Administration', programs: BUSINESS_PROGRAMS },
    ],
    requirements: UNDERGRAD_REQUIREMENTS,
    international: 'Proof of English language.',
    image: '/images/program-education.png',
  },
];

export function getDegreeLevel(slug: string): DegreeLevel | undefined {
  return degreeLevels.find((d) => d.slug === slug);
}
