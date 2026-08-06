// Chancellor's Welcome
// ---------------------------------------------------------------------------
// The original iguc.net WordPress site opened with a welcome presided over by
// the Chancellor. The exact wording of that address could NOT be recovered:
// the home page's post_content in the database export was overwritten with
// injected spam, and the surrounding Elementor blocks that would have carried
// it did not survive. Everything factual below — titles, doctorates, offices,
// history, email addresses — is taken verbatim from the recovered database.
//
// The address itself (`chancellor.address`) is DRAFT copy, written from the
// university's own published mission, purpose and values statements so that
// the page reads in the Chancellor's voice without inventing claims about him.
// It is isolated here so the university can paste the Chancellor's own words
// over it in a single edit, without touching any layout code.

export interface WelcomeSignatory {
  name: string;
  role: string;
  image: string;
  email: string;
  credentials: string;
  address: string[];
}

export const chancellor: WelcomeSignatory = {
  name: 'Bishop Bernie L Wade, PhD',
  role: 'Chancellor',
  image: '/images/wp/chancellor.jpg',
  email: 'chancellor@iguc.net',
  credentials:
    'Doctorates in theology, divinity, Christian education, non-profit management and pastoral counseling',
  address: [
    'Welcome to ICOF Global University. Whether you have come to this page as a prospective student weighing where to study, as a minister seeking formation, as a parent, or as a partner in the work of education, I am glad you are here.',
    'This university exists for a plain reason. Across Africa and far beyond it, there are men and women with the calling and the capacity for higher study who have never been given the door. We were founded to open that door — to provide access to higher education that enables students to develop the knowledge and skills necessary to achieve their professional goals, to improve the performance of their organizations, and to provide leadership and service to their communities.',
    'We are, by conviction, the Community University. That name is a commitment, not a slogan. It means our classrooms are open to the working adult and the first-generation student. It means our teaching is answerable to the communities our graduates return to serve. And it means that what is learned here is meant to be used — our purpose has always been to bridge the gap between theory and practice, so that knowledge does not stay on the page.',
    'We are also a university of faith. ICOF Global University stands within the International Circle of Faith, whose story reaches back to the Azusa Street revival, and we hold that rigorous scholarship and formed character belong together. Integrity, diversity, excellence, collaboration, nobility, godliness, professionalism and commitment are the values we teach by and the values we expect.',
    'Accredited by the Ministry of Higher Education continuously since 2007, we now teach from Buea and Douala, from our resource centre in Nigeria, and online to students on every continent. Wherever you study with us, you are a full member of this university.',
    'You will be known here. You will be taught by people who have practised what they teach. And you will be sent out equipped. That is our promise to every student who enrolls.',
    'If God has put a purpose in your hand, come and be prepared for it.',
  ],
};

export const viceChancellor = {
  name: 'Prof Chamayah Meyembi',
  role: 'Vice Chancellor',
  image: '/images/wp/vc-meyembi.png',
  email: 'vc@iguc.net',
  note: 'The Vice Chancellor leads the academic administration of the university, supported by the Academic Director General, the Registrar and the Directors of our schools.',
};

// Recovered biography of the Chancellor, as published on the About page.
export const chancellorBio: string[] = [
  'Bernie L. Wade, born on 29 June 1963 in Lakewood, Ohio, is an American minister, entrepreneur and author.',
  'He has served in a variety of roles, including senior pastor and chief operations officer of the Christian Brotherhood — a parachurch ministry of some 28,000 families — president of the Christian World Network, and vice-president of Spread the Spirit of Love.',
  'He is currently the Presiding Bishop of the International Circle of Faith, headquartered in Washington, D.C. Ministries within his oversight include the ICOF Colleges and Seminaries — a network of Christian bible colleges — the Christian Leadership Roundtable, and Children of Azusa Street, a network for those who trace their church history to the Azusa Street movement of 1906.',
  'Bishop Wade holds doctorates in theology, divinity, Christian education, non-profit management and pastoral counseling, and serves as Chancellor of ICOF Global University.',
];

// Short pull-quote used on the home page welcome band.
export const welcomeExcerpt =
  'Across Africa and far beyond it, there are men and women with the calling and the capacity for higher study who have never been given the door. We were founded to open that door.';
