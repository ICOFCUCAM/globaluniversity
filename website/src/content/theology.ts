// ---------------------------------------------------------------------------
// Theology programmes and scholarship — PUBLIC content.
//
// Supplied by the university and reproduced verbatim. Terminology is
// deliberate throughout; do not normalise it.
//
// Split rule established for this site (see docs/CONTENT-VISIBILITY.md):
//   PUBLIC  — programme overviews, objectives, structures, course codes and
//             titles, weekly outlines, assessment methods, admission
//             requirements. All of it is prospectus material.
//   GATED   — prescribed and recommended reading lists, which live in
//             src/content/programmeResources.ts and render only inside the
//             authenticated portal.
// ---------------------------------------------------------------------------

export interface EssayBlock {
  heading?: string;
  subheading?: string;
  paragraphs?: string[];
  points?: { label?: string; text: string }[];
}

// --- Roots of Faith --------------------------------------------------------

export const rootsOfFaith = {
  title: 'Roots of Faith',
  subtitle: 'Jesus as an African in History and Theology',
  intro:
    'The identity of Jesus has been a subject of significant scholarly debate and theological reflection. One compelling perspective that has emerged, particularly within African and African-American theological traditions, is the argument that Jesus was African. This view not only reimagines Jesus’ historical and cultural background but also has profound implications for theology, identity, and social justice. Below, I outline the key arguments supporting the case for Jesus as African, emphasizing historical, cultural, and theological dimensions.',
  blocks: [
    {
      heading: 'Historical and Cultural Context',
      subheading: 'Geographical Proximity and Historical Connections',
      points: [
        {
          label: 'Egyptian Influence',
          text: 'Jesus’ early life, according to the Gospel of Matthew, included a period in Egypt (Matthew 2:13-15). This geographical connection situates Jesus within a historically significant African context. Egypt, as part of the African continent, had profound cultural and historical ties with the broader region.',
        },
        {
          label: 'African Presence in Ancient Israel',
          text: 'Historical evidence suggests substantial interaction between the peoples of Africa and the ancient Near East. This includes trade, migration, and intermarriage, creating a culturally diverse environment in which Jesus was born and raised.',
        },
      ],
    },
    {
      subheading: 'Biblical References to Africa',
      points: [
        {
          label: 'Old Testament',
          text: 'Africa, specifically Egypt and Cush (modern-day Ethiopia and Sudan), plays a significant role in biblical narratives. Figures like Moses, who was raised in the Egyptian royal court, and the Queen of Sheba, who visited Solomon, illustrate the deep connections between Israel and Africa.',
        },
        {
          label: 'New Testament',
          text: 'Simon of Cyrene, who helped Jesus carry the cross, was from Cyrene in North Africa (Mark 15:21). The Ethiopian eunuch’s conversion in Acts 8:27-39 further underscores Africa’s presence in early Christian history.',
        },
      ],
    },
    {
      heading: 'Theological and Symbolic Arguments',
      subheading: 'Representation and Inclusivity',
      points: [
        {
          label: 'African Theological Perspectives',
          text: 'African theologians argue that recognizing Jesus as African challenges Eurocentric interpretations of Christianity and affirms the faith’s universality. This perspective fosters a sense of inclusion and representation for African Christians, allowing them to see themselves in the narrative of salvation.',
        },
        {
          label: 'Liberation Theology',
          text: 'Viewing Jesus as African aligns with liberation theology’s emphasis on Jesus’ identification with the marginalized and oppressed. It reinforces the idea that Jesus stands in solidarity with all people, especially those who have experienced historical injustices such as colonialism and racism.',
        },
      ],
    },
    {
      subheading: 'Cultural Relevance and Empowerment',
      points: [
        {
          label: 'Cultural Identity',
          text: 'For African and African-American communities, an African Jesus resonates with their cultural identity and experiences. It validates their historical narratives and offers a powerful symbol of divine affirmation and empowerment.',
        },
        {
          label: 'Empowerment and Resistance',
          text: 'This perspective provides a theological basis for resistance against racial oppression and injustice. By identifying Jesus as African, communities draw strength and inspiration to confront systemic racism and advocate for social justice.',
        },
      ],
    },
    {
      heading: 'Scholarly and Contemporary Support',
      subheading: 'African Scholarship',
      points: [
        {
          label: 'Kwame Bediako',
          text: 'In his work, Bediako emphasizes the significance of African identity in Christian theology, arguing that African Christianity must be rooted in its cultural and historical context to be authentic and meaningful.',
        },
        {
          label: 'Mercy Amba Oduyoye',
          text: 'Oduyoye’s writings highlight the importance of recognizing African contributions to Christianity and challenge traditional Eurocentric views that marginalize African perspectives.',
        },
      ],
    },
    {
      subheading: 'Contemporary Movements',
      points: [
        {
          label: 'Black Theology',
          text: 'African-American theologians like James Cone have long argued for a black Jesus who identifies with the struggles of black people. This theology seeks to reclaim Christian symbols and narratives for the empowerment of black communities.',
        },
        {
          label: 'Global Christianity',
          text: 'As Christianity continues to grow in Africa and the Global South, reimagining Jesus’ identity in ways that resonate with these communities becomes increasingly important for the global church’s unity and mission.',
        },
      ],
    },
  ] as EssayBlock[],
  conclusion:
    'Arguing that Jesus was African is not merely about historical revisionism but about reclaiming and affirming the diverse cultural and historical contexts that shaped early Christianity. This perspective challenges dominant narratives, fosters inclusivity, and provides theological resources for addressing contemporary issues of race and justice. By exploring Jesus’ identity through an African lens, we enrich our understanding of the faith and affirm the dignity and worth of all people in the global Christian community.',
};

// --- The Black Hebrews (course) --------------------------------------------

export const blackHebrewsCourse = {
  title: 'The Black Hebrews: Unveiling the True Israelites',
  description:
    'This course delves into the historical, cultural, and theological dimensions of the claim that the original Hebrews and true Israelites were Black. Through a multidisciplinary approach, students will explore biblical narratives, historical evidence, cultural contexts, and contemporary interpretations to understand the identity of the Israelites. The course aims to provide a comprehensive understanding of the ancient Israelite identity, focusing on their possible African heritage and the implications for modern religious and cultural identities.',
  objectives: [
    'To examine biblical texts and their descriptions of the Israelites.',
    'To analyze historical and archaeological evidence regarding the ethnicity and origins of the ancient Hebrews.',
    'To understand the cultural and social contexts of ancient Israel and surrounding regions.',
    'To explore contemporary claims and movements asserting the Black identity of the original Israelites.',
    'To discuss the theological implications of these claims for modern Christianity and Judaism.',
  ],
  parts: [
    {
      part: 'Part 1: Introduction to the Black Hebrew Identity',
      weeks: [
        { week: 'Week 1', title: 'Course Overview and Objectives', topics: ['Introduction to the course', 'Overview of key terms and concepts', 'Importance of historical and cultural context'] },
        { week: 'Week 2', title: 'Biblical Descriptions of the Israelites', topics: ['Key biblical passages describing the physical appearance of the Israelites', 'Analysis of relevant genealogies and ethnic references in the Bible'] },
      ],
    },
    {
      part: 'Part 2: Historical and Archaeological Evidence',
      weeks: [
        { week: 'Week 3', title: 'The Origins of the Hebrews', topics: ['Historical accounts of the early Hebrews', 'Archaeological findings and their interpretations'] },
        { week: 'Week 4', title: 'Ancient Near Eastern Context', topics: ['Interaction between the Israelites and neighboring African civilizations', 'Cultural exchanges and influences'] },
        { week: 'Week 5', title: 'Migration and Dispersal Patterns', topics: ['Historical migration routes of the Israelites', 'Connections to African regions'] },
      ],
    },
    {
      part: 'Part 3: Cultural Context and Identity',
      weeks: [
        { week: 'Week 6', title: 'African Influence in Ancient Israel', topics: ['Evidence of African presence and influence in Israelite culture', 'Comparative analysis with contemporary African cultures'] },
        { week: 'Week 7', title: 'Language and Ethnicity', topics: ['Linguistic connections between Hebrew and African languages', 'Ethnographic studies of ancient Israelites'] },
        { week: 'Week 8', title: 'Art and Iconography', topics: ['Analysis of ancient Israelite art and depictions', 'Comparison with African artistic traditions'] },
      ],
    },
    {
      part: 'Part 4: Contemporary Movements and Theological Implications',
      weeks: [
        { week: 'Week 9', title: 'Modern Claims of Black Hebrew Identity', topics: ['Overview of contemporary Black Hebrew Israelite movements', 'Key figures and their arguments'] },
        { week: 'Week 10', title: 'Theological Perspectives', topics: ['Theological implications of a Black Israelite identity', 'Impact on Christian and Jewish thought'] },
        { week: 'Week 11', title: 'Cultural and Social Impact', topics: ['Influence on modern African and African-American identities', 'Societal reactions and controversies'] },
      ],
    },
    {
      part: 'Part 5: Conclusion and Reflections',
      weeks: [
        { week: 'Week 12', title: 'Course Summary and Reflections', topics: ['Review of key findings and discussions', 'Reflection on the significance of the course', 'Final thoughts and open questions'] },
      ],
    },
  ],
  assessment: [
    'Weekly reading reflections',
    'Midterm essay on historical evidence of Black Hebrews',
    'Research project on a chosen aspect of Black Hebrew identity',
    'Final exam covering course material',
  ],
  note:
    'This course aims to provide a balanced and scholarly exploration of the claims regarding the Black identity of the original Hebrews, encouraging critical thinking and informed discussion among students.',
};

// --- Master of Theology ----------------------------------------------------

export const masterOfTheology = {
  award: 'Master of Theology (M.Th.)',
  overview:
    'The Master of Theology (M.Th.) program at ICOF Global University is an advanced theological degree designed to equip students with in-depth knowledge and understanding of theological concepts, historical contexts, and contemporary issues in theology. This program emphasizes African and Black Hebrew theology, contextual and ecotheology, feminist and queer theologies, and disability theology, providing a comprehensive and diverse theological education.',
  objectives: [
    { label: 'Develop Advanced Theological Knowledge', text: 'Deepen understanding of biblical theology, historical contexts, and contemporary theological issues.' },
    { label: 'Promote Contextual Theology', text: 'Explore how theology is shaped by and responds to various cultural contexts, particularly in Africa and the Global South.' },
    { label: 'Foster Research and Critical Thinking', text: 'Equip students with the skills to conduct scholarly research and engage in critical theological discussions.' },
    { label: 'Encourage Practical Application', text: 'Apply theological insights to contemporary social, environmental, and ethical issues.' },
    { label: 'Support Interdisciplinary Learning', text: 'Integrate perspectives from different theological traditions, including feminist, queer, and disability theologies.' },
  ],
  structureNote:
    'The Master of Theology program is structured over two years, including core courses, electives, and a thesis requirement. The program is designed to provide a balanced education that combines theoretical knowledge with practical application.',
  semesters: [
    {
      year: 'Year 1',
      label: 'Semester 1',
      courses: [
        { n: 1, title: 'Introduction to Biblical Theology', topics: ['Overview of biblical theology and its significance.', 'Methods of interpreting biblical texts.', 'Relationship between the Old and New Testaments.'] },
        { n: 2, title: 'The Cultural Context of the New Testament', topics: ['Historical and cultural background of the New Testament period.', 'Examination of Greco-Roman, Jewish, and African influences.'] },
        { n: 3, title: 'The Gospels and the Old Testament', topics: ['Exploration of how the Gospels reference and fulfill Old Testament prophecies.', 'Comparative analysis of key themes and narratives.'] },
      ],
    },
    {
      year: 'Year 1',
      label: 'Semester 2',
      courses: [
        { n: 4, title: 'Pauline Theology', topics: ['Study of Paul’s letters and their theological implications.', 'Paul’s views on law, grace, and the church.'] },
        { n: 5, title: 'Theology and Identity: African Contexts', topics: ['Impact of culture on Christian thought in modern Africa.', 'Examination of African theological perspectives and contributions.'] },
        { n: 6, title: 'Contextual Theology for the 21st Century', topics: ['Methods and importance of contextual theology.', 'Case studies from various global contexts.'] },
      ],
    },
    {
      year: 'Year 2',
      label: 'Semester 1',
      courses: [
        { n: 7, title: 'African and Black Hebrew Narratives', topics: ['Exploration of historical claims and evidence regarding Black Hebrew identity.', 'Impact of these narratives on contemporary theological thought.'] },
        { n: 8, title: 'Christianity in Africa and the Global South', topics: ['History and development of Christianity in Africa and the Global South.', 'Key figures and movements in African Christian history.'] },
        { n: 9, title: 'Feminist and Queer Theologies in Africa', topics: ['Examination of feminist and queer theological perspectives within Africa.', 'Contributions of scholars such as Mercy Amba Oduyoye.'] },
      ],
    },
    {
      year: 'Year 2',
      label: 'Semester 2',
      courses: [
        { n: 10, title: 'Ecotheology and Creation Care', topics: ['Theological perspectives on environmental stewardship.', 'Case studies from African contexts on creation care.'] },
        { n: 11, title: 'Disability Theology in Africa', topics: ['Theological approaches to disability within African contexts.', 'Impact of cultural and societal views on disability.'] },
        { n: 12, title: 'Thesis Preparation and Research Methodologies', topics: ['Guidance on developing a research proposal.', 'Introduction to theological research methodologies.'] },
      ],
    },
  ],
  thesis: [
    'Students will complete a thesis on a topic related to African and Black Hebrew theology, under the guidance of a faculty advisor.',
    'The thesis should demonstrate original research and contribute to the academic discourse in the field.',
  ],
  admission: [
    'A bachelor’s degree in theology, religious studies, or a related field.',
    'A minimum GPA requirement as specified by ICOF Global University.',
    'Submission of academic transcripts, a statement of purpose, and letters of recommendation.',
    'An interview may be required.',
  ],
  conclusion:
    'The Master of Theology in African and Black Hebrew Theology at ICOF Global University offers a unique opportunity for students to explore the rich and diverse theological traditions of Africa and the Black Hebrew identity. This program is designed to equip students with the knowledge and skills necessary to engage in meaningful theological discourse and contribute to the global understanding of these important themes.',
};

// --- Portfolio overview, Diploma, Bachelor ---------------------------------

export const theologyPortfolio = [
  'The programs and courses offered by ICOF Global University encompass a wide spectrum of theological studies, catering to the diverse needs and interests of students. At the core of these offerings is the Master of Theology program, a comprehensive and rigorous course designed to delve deeply into various theological disciplines. From biblical theology to African theology, ecotheology to disability theology, students engage with a rich tapestry of theological thought and practice.',
  'The Bachelor of Theology program serves as a foundational pathway for those beginning their theological journey, providing essential knowledge across biblical studies, church history, systematic theology, and practical ministry skills. Meanwhile, the Diploma in Theology offers a condensed version of theological education, ideal for individuals seeking basic training or personal enrichment.',
  'One notable aspect of ICOF’s curriculum is its emphasis on contextual theology, reflected in specialized courses and certificates. These offerings explore how theology intersects with diverse cultural, social, and ecological contexts, equipping students to engage with theological issues in relevant and meaningful ways.',
  'Additionally, the university offers focused seminars and workshops on topics such as missiology, feminist and queer theology, ecotheology, and disability theology. These initiatives provide opportunities for in-depth exploration and critical reflection on pressing theological and societal issues, fostering a holistic understanding of theology’s role in contemporary contexts.',
  'Overall, ICOF Global University’s programs and courses aim to empower students with a deep understanding of theology while nurturing their capacity for critical thinking, ethical reflection, and practical application in various ministry and community contexts.',
];

export const diplomaInTheology = {
  title: 'Diploma in Theology',
  paragraphs: [
    'Embark on a transformative journey of faith and learning with the Diploma in Theology offered by ICOF Global University. This program serves as a foundational stepping stone for individuals passionate about deepening their understanding of theology and exploring the rich tapestry of Christian thought and practice.',
    'The Diploma in Theology is meticulously crafted to provide students with a solid grounding in key theological concepts, biblical interpretation, church history, and practical ministry skills. Whether you are pursuing personal enrichment, preparing for ministry roles, or seeking to lay a strong foundation for further theological studies, this program offers a dynamic and enriching educational experience.',
    'Through engaging coursework, interactive learning activities, and supportive faculty guidance, students will delve into the depths of theological inquiry and discover the relevance of faith in today’s world. From exploring the sacred texts of Scripture to grappling with complex theological questions, students will be equipped with the tools and knowledge needed to navigate the diverse landscapes of contemporary theology.',
    'One of the hallmarks of the Diploma in Theology is its emphasis on practical application. Beyond theoretical learning, students will have the opportunity to apply their theological insights to real-world contexts, preparing them to serve effectively in ministry, leadership, and community engagement.',
    'At ICOF Global University, we believe that theological education should be accessible to all who seek it. That’s why our Diploma in Theology is designed to accommodate the needs of students from diverse backgrounds and walks of life. Whether you are a full-time student, a working professional, or a busy parent, our flexible learning options allow you to pursue your theological studies at your own pace and convenience.',
    'Join us on this transformative educational journey as we explore the depths of theology, cultivate spiritual growth, and equip ourselves to make a positive impact in the world. Enroll in the Diploma in Theology at ICOF Global University and embark on a path of discovery, inspiration, and transformation.',
  ],
};

export const bachelorOfTheology = {
  title: 'Bachelor of Theology',
  paragraphs: [
    'Welcome to the Bachelor of Theology program at ICOF Global University, where passion for theological inquiry meets academic excellence. This program offers a comprehensive and enriching educational experience for individuals seeking to deepen their understanding of theology and pursue a range of ministry and leadership roles within the Christian community.',
    'The Bachelor of Theology program is designed to provide students with a robust foundation in theological studies, equipping them with the knowledge, skills, and values necessary for effective ministry and service. Whether you are called to pastoral leadership, missions, counseling, or theological education, this program will empower you to engage thoughtfully and critically with the rich theological traditions of the Christian faith.',
    'At the heart of the Bachelor of Theology program is a commitment to holistic education that integrates rigorous academic inquiry with spiritual formation and practical application. Through a diverse range of courses spanning biblical studies, church history, systematic theology, and practical ministry, students will explore the breadth and depth of Christian theology while nurturing their own spiritual growth and maturity.',
    'One of the distinguishing features of the Bachelor of Theology program is its emphasis on experiential learning and hands-on ministry training. Through internships, practicums, and service-learning opportunities, students will have the chance to apply their theological knowledge in real-world contexts, gaining valuable practical experience and developing essential ministry skills.',
    'Moreover, the Bachelor of Theology program at ICOF Global University is designed to be accessible and flexible, accommodating the needs of students from diverse backgrounds and life situations. Whether you are a recent high school graduate, a working professional, or a busy parent, our flexible learning options and supportive academic environment ensure that you can pursue your theological education on your own terms.',
    'Join us on a journey of discovery, exploration, and transformation as we delve into the profound mysteries of theology and seek to understand God’s redemptive work in the world. Enroll in the Bachelor of Theology program at ICOF Global University and prepare yourself for a lifetime of faithful service, ministry, and leadership in the church and beyond.',
  ],
};
