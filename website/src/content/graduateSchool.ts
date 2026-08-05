// ---------------------------------------------------------------------------
// Graduate school — doctoral programme structures and the thesis module.
//
// SOURCE. The three doctoral structures below, and the thesis preparation
// module, were supplied by the university. Core and elective course lists,
// durations, comprehensive examination arrangements and graduation
// requirements are reproduced as given.
//
// A FOURTH DOCTORATE. The supplied material describes a Doctor of Systematic
// Theology (DSTh) — a distinct award with its own core courses, its own
// electives and its own dissertation. It was not in the faculty's declared
// award list, which named only the Ph.D., the D.Th. and the D.Min. It has been
// added to the catalogue on the strength of this specification, and the
// faculty should confirm it belongs in the official list.
// ---------------------------------------------------------------------------

export interface DoctoralProgramme {
  /** Slug of the matching entry in `programs`. */
  programSlug: string;
  award: string;
  abbreviation: string;
  duration: string;
  overview: string[];
  structure: string;
  coreCourses: string[];
  electiveCourses: string[];
  comprehensiveExams: string;
  dissertation: string;
  graduation: string;
}

export const doctoralProgrammes: DoctoralProgramme[] = [
  {
    programSlug: 'doctor-of-theology',
    award: 'Doctor of Theology',
    abbreviation: 'Th.D.',
    duration: 'Three to five years',
    overview: [
      'The Doctor of Theology (Th.D.) program at ICOF Global University is designed for scholars and practitioners seeking advanced knowledge and expertise in theology and related fields. This comprehensive program combines rigorous academic study with practical application, preparing graduates for leadership roles in academia, ministry, and other professional settings.',
      'Through a blend of coursework, research, and hands-on experience, students engage with complex theological concepts, explore contemporary issues, and develop the skills needed to make significant contributions to their chosen field.',
    ],
    structure:
      'Core courses, elective courses, comprehensive examinations and a doctoral dissertation. Students customise the programme by selecting electives that align with their interests and career goals. Completion typically takes three to five years depending on pace and prior academic background.',
    coreCourses: [
      'Advanced Biblical Studies',
      'Systematic Theology: Contemporary Perspectives',
      'Historical Theology: Tradition and Innovation',
      'Theology and Ethics in a Global Context',
      'Research Methodology for Theological Inquiry',
      'Theological Hermeneutics and Interpretation',
      'Contemporary Issues in Theology and Culture',
      'Seminar in Theological Writing and Publishing',
    ],
    electiveCourses: [
      'Comparative Religions and Worldviews',
      'Theology of Liberation and Social Justice',
      'Spiritual Formation and Discipleship',
      'Ethics in Ministry and Leadership',
      'Theology of Mission and Evangelism',
      'Ecclesiology: The Church in Contemporary Society',
      'Theological Perspectives on Science and Technology',
      'Liturgical Theology and Worship Practices',
    ],
    comprehensiveExams:
      'Taken after the core and elective courses. Written and oral components assess understanding of key theological concepts, critical thinking, and the ability to engage with scholarly literature.',
    dissertation:
      'Original research in the candidate’s area of specialisation, supervised by a faculty advisor. The dissertation must make a significant contribution to the field and demonstrate the capacity for independent scholarly inquiry. Topics range from theological doctrine and biblical interpretation to pastoral theology and practical ministry.',
    graduation:
      'Successful completion of all required coursework, passing the comprehensive examinations, and defence of the dissertation before a faculty committee.',
  },
  {
    programSlug: 'doctor-of-systematic-theology',
    award: 'Doctor of Systematic Theology',
    abbreviation: 'DSTh',
    duration: 'Three to five years',
    overview: [
      'The Doctor of Systematic Theology (DSTh) is a specialised programme equipping scholars and practitioners with advanced expertise in systematic theology. It examines the foundational doctrines of the Christian faith, their historical development, theological implications and contemporary relevance.',
      'Through rigorous academic study, research and practical application, students engage with complex theological concepts, refine their critical thinking, and develop the expertise needed to address theological issues in diverse contexts.',
    ],
    structure:
      'Core courses, elective courses, comprehensive examinations and a doctoral dissertation, spanning three to five years. Electives are selected to match the candidate’s research interests and career aspirations.',
    coreCourses: [
      'Foundations of Systematic Theology',
      'The Doctrine of God: Trinitarian Theology',
      'Christology: The Person and Work of Christ',
      'Pneumatology: The Holy Spirit and the Church',
      'Anthropology and Hamartiology: Human Nature and Sin',
      'Soteriology: Theories of Salvation and Atonement',
      'Eschatology: The Last Things and Future Hope',
      'Contemporary Issues in Systematic Theology',
    ],
    electiveCourses: [
      'Theological Method and Hermeneutics',
      'Historical Theology: Reformation and Post-Reformation Thought',
      'Comparative Theology: Eastern Orthodoxy, Protestantism and Catholicism',
      'Liberation Theology and Social Ethics',
      'Systematic Theology and Science: Dialogue and Integration',
      'Theological Anthropology and Gender Studies',
      'Ecclesiology: The Church and Its Mission',
      'Theology and Philosophy: Critical Engagements',
    ],
    comprehensiveExams:
      'Written essays, oral defences and practical applications, assessing the candidate’s ability to engage critically with systematic theological concepts and to articulate that understanding effectively.',
    dissertation:
      'Original research in a specific area of systematic theology under faculty supervision, contributing new insights or perspectives to the field.',
    graduation:
      'Completion of all required coursework, passing the comprehensive examinations, and defence of the dissertation before a faculty committee.',
  },
  {
    programSlug: 'doctor-of-philosophy-theology',
    award: 'Doctor of Philosophy in Theology',
    abbreviation: 'Ph.D.',
    duration: 'Four to six years',
    overview: [
      'The Doctor of Philosophy (Ph.D.) in Theology is a rigorous and research-intensive programme preparing scholars for leadership in academia, ministry and theological research. It equips students with advanced knowledge, critical thinking and the research methodologies necessary for original scholarly inquiry.',
      'Through interdisciplinary study, students explore diverse theological traditions, engage with contemporary theological debates, and contribute new insights to the broader academic community.',
    ],
    structure:
      'Coursework, comprehensive examinations, dissertation research and defence, typically spanning four to six years. Studies are tailored to the candidate’s research interests under faculty mentorship.',
    coreCourses: [
      'Advanced Theological Methodology',
      'Research Design and Methodologies in Theology',
      'Historical and Contextual Theology',
      'Theological Ethics and Moral Philosophy',
      'Theology and Culture: Interdisciplinary Perspectives',
      'Contemporary Issues in Theological Studies',
      'Advanced Seminar in Theological Hermeneutics',
      'Theology and Science: Dialogues and Challenges',
    ],
    electiveCourses: [
      'Comparative Theology: Eastern and Western Traditions',
      'Systematic Theology: Key Concepts and Debates',
      'Liberation Theology and Social Justice',
      'Philosophy of Religion and Theological Epistemology',
      'Theology of Religions: Pluralism and Dialogue',
      'Ecclesiology: The Church in Historical and Ecumenical Perspective',
      'Biblical Theology: Old Testament and New Testament Perspectives',
      'Theological Aesthetics and Artistic Expression',
    ],
    comprehensiveExams:
      'Written assessments, oral defences and practical applications, demonstrating mastery of the theological field and of research methodology, and readiness for independent research.',
    dissertation:
      'Original research under faculty supervision, making a significant contribution to the field by offering new insights, interpretations or methodologies, defended before a faculty committee.',
    graduation:
      'Completion of all required coursework, passing the comprehensive examinations, and defence of the doctoral dissertation.',
  },
];

// --- Thesis preparation and research methodologies -------------------------

export interface ModuleUnit {
  n: number;
  title: string;
  topics: { heading: string; points: string[] }[];
}

export const thesisModule = {
  code: 'S12',
  title: 'Thesis Preparation and Research Methodologies',
  description:
    'This module equips students with the skills and knowledge to develop a research proposal and conduct independent research in theology. Emphasis is placed on understanding theological research methodologies, structuring a research project, and adhering to academic standards in writing and presentation.',
  objectives: [
    'Provide a comprehensive understanding of the process of developing a research proposal.',
    'Introduce students to various theological research methodologies.',
    'Enhance the ability to critically evaluate theological sources and data.',
    'Guide students in structuring and organising their thesis.',
    'Familiarise students with academic standards and ethical considerations in theological research.',
  ],
  units: [
    {
      n: 1,
      title: 'Introduction to Research in Theology',
      topics: [
        {
          heading: 'Overview of theological research',
          points: [
            'Definition and importance of research in theology.',
            'Types of theological research: historical, systematic, practical and comparative.',
            'The role of research in advancing theological knowledge and practice.',
          ],
        },
        {
          heading: 'The research process',
          points: [
            'Identifying a research question, literature review, methodology, data collection, analysis and conclusion.',
            'The importance of originality and of contribution to the field.',
          ],
        },
      ],
    },
    {
      n: 2,
      title: 'Developing a Research Proposal',
      topics: [
        { heading: 'Identifying a research topic', points: ['Criteria for selecting a topic.', 'Sources of inspiration for research topics in theology.'] },
        { heading: 'Research questions and objectives', points: ['Crafting clear and concise research questions.', 'Defining objectives and hypotheses.'] },
        { heading: 'Conducting a literature review', points: ['Purpose of a literature review.', 'Finding and evaluating sources.', 'Synthesising existing research to identify gaps and justify the question.'] },
        { heading: 'Designing the methodology', points: ['Choosing an appropriate methodology.', 'Qualitative and quantitative methods.', 'Case studies, ethnography, textual analysis and other theological methods.'] },
        { heading: 'Structuring the proposal', points: ['Introduction, literature review, methodology, expected outcomes, timeline and bibliography.', 'Writing a compelling and coherent proposal.'] },
      ],
    },
    {
      n: 3,
      title: 'Theological Research Methodologies',
      topics: [
        { heading: 'Qualitative methods', points: ['Interviews, focus groups and participant observation.', 'Coding, thematic analysis and narrative analysis.'] },
        { heading: 'Quantitative methods', points: ['Surveys and questionnaires.', 'Statistical analysis and interpretation.'] },
        { heading: 'Textual analysis and exegesis', points: ['Approaches to biblical exegesis.', 'Hermeneutical methods and their application.'] },
        { heading: 'Historical and comparative methods', points: ['The historical-critical method.', 'Comparative theology: principles and practices.'] },
      ],
    },
    {
      n: 4,
      title: 'Data Collection and Analysis',
      topics: [
        { heading: 'Ethical considerations', points: ['Informed consent and confidentiality.', 'Addressing ethical dilemmas in research.'] },
        { heading: 'Data collection techniques', points: ['Designing and conducting interviews and surveys.', 'Archival research and document analysis.'] },
        { heading: 'Analysis and interpretation', points: ['Techniques for analysing qualitative and quantitative data.', 'Drawing meaningful conclusions from findings.'] },
      ],
    },
    {
      n: 5,
      title: 'Writing and Presenting the Thesis',
      topics: [
        { heading: 'Structuring the thesis', points: ['Introduction, literature review, methodology, results, discussion and conclusion.', 'Clarity, coherence and academic style.'] },
        { heading: 'Academic writing standards', points: ['Referencing and citation styles (APA, Chicago).', 'Avoiding plagiarism and maintaining academic integrity.'] },
        { heading: 'Presentation skills', points: ['Preparing for oral defences and presentations.', 'Effective communication of research findings.'] },
      ],
    },
  ] as ModuleUnit[],
  assessment: [
    { component: 'Research proposal — question and objectives, literature review, methodology, clarity', weight: '40%' },
    { component: 'Research methodology assignment — application of theological research methods, critical analysis of sources', weight: '30%' },
    { component: 'Final presentation — effectiveness, clarity and response to questions', weight: '30%' },
  ],
  readings: [
    'Swinton, J., & Mowat, H. (2016). Practical Theology and Qualitative Research. London: SCM Press.',
    'Creswell, J. W. (2014). Research Design: Qualitative, Quantitative, and Mixed Methods Approaches. Los Angeles: SAGE Publications.',
    'Silverman, D. (2013). Doing Qualitative Research: A Practical Handbook. London: SAGE Publications.',
    'Turabian, K. L. (2018). A Manual for Writers of Research Papers, Theses, and Dissertations. Chicago: University of Chicago Press.',
  ],
};

/** Master's-level requirements, as published on the M.Th. syllabus. */
export const mastersRequirements = [
  'Complete all assigned readings before class discussions.',
  'Participate actively in class discussions and online forums.',
  'Write a 5,000-word research paper on a topic related to the course content.',
  'Prepare and deliver a presentation on a selected theological issue.',
  'Complete a comprehensive final examination covering all course modules.',
];

/**
 * What the university has not supplied. Rendered on the handbook rather than
 * filled in: a research student needs to know who supervises them and what
 * happens at a viva, and neither can be inferred from a course list.
 */
export const graduateSchoolGaps = [
  {
    title: 'Supervisor responsibilities',
    needs: [
      'How a supervisor is allocated, and whether a second supervisor is appointed',
      'The minimum frequency of supervision meetings, and what record is kept',
      'What a candidate may expect in turnaround time on submitted work',
      'The route to change supervisor',
    ],
  },
  {
    title: 'Viva voce procedure',
    needs: [
      'Composition of the examination panel, and whether an external examiner sits on it',
      'The possible outcomes — pass, pass with minor corrections, major corrections, resubmission, fail',
      'The period allowed for corrections after a viva',
      'The appeal route against a viva outcome',
    ],
  },
  {
    title: 'Thesis formatting and length',
    needs: [
      'Word limits by award — Master’s, Th.D., DSTh and Ph.D.',
      'Required citation standard by faculty. The thesis module names APA and Chicago; one should be mandated.',
      'Formatting standard: margins, spacing, front matter, binding and deposit copies',
      'Whether an electronic copy is deposited, and where',
    ],
  },
  {
    title: 'Progression and time limits',
    needs: [
      'Maximum registration period, and grounds for extension',
      'Annual progress review — who conducts it and what happens on an unsatisfactory outcome',
      'Rules on suspension of study',
    ],
  },
];
