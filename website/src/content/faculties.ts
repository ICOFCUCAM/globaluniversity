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
// NOT INVENTED: names, directors, campuses and photographs are all drawn from
// content already recovered from the university's own site. The `standsFor`
// lines are editorial summaries of provision that is already published; they
// are the one place a faculty could say more, and are flagged in
// docs/FACULTY-PAGES.md as the copy the university should replace with its own.
// ---------------------------------------------------------------------------

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
  /** Degree pages belonging to this faculty. */
  degrees?: { label: string; href: string }[];
}

export const facultyList: Faculty[] = [
  {
    slug: 'theology-buea',
    name: 'Faculty of Theology, Buea',
    shortName: 'Theology',
    campus: 'Buea, Cameroon',
    image: '/images/wp/fac-theology.jpg',
    standsFor:
      'The university’s founding faculty, and the largest — biblical studies, doctrine, church history and ministry formation from certificate through to doctorate.',
    description: [
      'The Faculty of Theology is where ICOF Global University began, and it remains the largest body of provision in the institution. It trains ministers, scholars, chaplains, Christian educators and researchers, combining rigorous academic study with spiritual formation and supervised practical ministry.',
      'Teaching runs from certificate level to doctoral research. The faculty is home to the Bachelor of Theology, the Master of Theology and the Master of Arts in Black Liberation Theology, and doctoral work is examined by the Dissertation Council under Professor Emeritus Arch Bishop Godfred Anyere Tah.',
      'The faculty is deliberately not confined to Western theological traditions. African Theology, Contextual Theology and Global Christianity run through the curriculum, and students are introduced to theological voices from Africa, Asia, Latin America, Europe and North America.',
    ],
    programSchool: 'Faculty of Theology',
    courseFaculty: 'Faculty of Theology',
    leadName: 'Rev Momfor Phillip, M.Th',
    degrees: [
      { label: 'Bachelor of Theology', href: '/bachelor-of-theology' },
      { label: 'Master of Theology', href: '/master-of-theology' },
      { label: 'M.A. Black Liberation Theology', href: '/black-liberation-theology' },
      { label: 'Roots of Faith (position paper)', href: '/roots-of-faith' },
    ],
  },
  {
    slug: 'theology-douala',
    name: 'School of Theology, Douala',
    shortName: 'Theology, Douala',
    campus: 'Douala, Cameroon',
    image: '/images/wp/g-hall.jpg',
    standsFor:
      'The university’s Douala campus for theological study, extending the Faculty of Theology’s provision into Cameroon’s largest city.',
    description: [
      'The School of Theology in Douala extends the university’s theological teaching into Cameroon’s largest city and commercial centre, serving students who cannot relocate to Buea.',
      'It operates under the direction of Dr Bongbuen Alando.',
    ],
    leadName: 'Dr Bongbuen Alando',
  },
  {
    slug: 'education',
    name: 'Faculty of Education',
    shortName: 'Education',
    campus: 'Buea, Cameroon',
    image: '/images/wp/fac-education.png',
    standsFor:
      'Classroom-ready teacher formation — pedagogy, curriculum design and supervised teaching practice for primary and secondary education.',
    description: [
      'The Faculty of Education prepares teachers for the classroom rather than for the examination hall. Programmes combine modern pedagogy, curriculum design and assessment with supervised teaching practice in real schools.',
      'Graduates enter primary and secondary teaching, curriculum development, educational administration and teacher training.',
    ],
    programSchool: 'Faculty of Education',
    courseFaculty: 'Faculty of Education',
    leadName: 'Prof Bishop Lawrence Luba',
  },
  {
    slug: 'engineering-technology',
    name: 'Faculty of Engineering and Technology',
    shortName: 'Engineering & Technology',
    campus: 'Buea, Cameroon',
    image: '/images/wp/fac-engineering.jpg',
    standsFor:
      'Applied technical education — engineering, computing and technology programmes built around employability and practical competence.',
    description: [
      'The Faculty of Engineering and Technology teaches applied technical disciplines with a strong emphasis on practical competence and employment. Provision spans diploma, Higher National Diploma and degree level.',
      'Courses are structured around what employers actually require, and the faculty maintains the university’s strongest emphasis on hands-on project work.',
    ],
    programSchool: 'Faculty of Engineering and Technology',
    courseFaculty: 'Engineering & Technology',
    leadName: 'Kamgang Marcel',
  },
  {
    slug: 'gibmas',
    name: 'Global Institute of Business and Management Science',
    shortName: 'GIBMAS',
    campus: 'Buea, Cameroon',
    image: '/images/wp/fac-business.jpg',
    standsFor:
      'Business, management and entrepreneurship — training top-level management and entrepreneurs for African and global markets.',
    description: [
      'The Global Institute of Business and Management Science (GIBMAS) teaches business, management, accounting and entrepreneurship, with an emphasis on preparing students for leadership rather than for entry-level administration.',
      'The institute trains top-level management and entrepreneurs, and its programmes are designed around the realities of doing business in African and global markets.',
    ],
    programSchool: 'Global Institute of Business and Management Science (GIBMAS)',
    courseFaculty: 'GIBMAS — Business & Management',
    leadName: 'Hoffman Betika Ayuk',
  },
];

/** PPDI-RC is a resource centre rather than a faculty; it has its own page. */
export const ppdircCourseFaculty = 'PPDI-RC Professional Development';

export function getFaculty(slug: string) {
  return facultyList.find((f) => f.slug === slug);
}
