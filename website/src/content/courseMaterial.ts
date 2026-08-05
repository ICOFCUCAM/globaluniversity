// ---------------------------------------------------------------------------
// STUDENT-ONLY COURSE MATERIAL
//
// Imported ONLY by components rendered inside the authenticated portal. Never
// import this from a route under src/app that renders publicly.
//
// WHY THIS IS GATED AND UNIT TITLES ARE NOT.
// A unit title — "Biblical Geography and Archaeology" — tells a prospective
// student what the course covers. That is prospectus material and is published.
// The text beneath it is the teaching itself: the lecture content an enrolled
// student receives in exchange for fees. Publishing it openly would mean the
// university has written its curriculum and given it away, and would let any
// competing institution lift the syllabus wholesale.
//
// Same principle as the reading lists in programmeResources.ts. Same honest
// limit, too: this is client-side, so it is unpublished rather than secret.
// Assessment weightings are included here because they are operational detail
// students act on; the assessment *methods* are published on the prospectus.
// ---------------------------------------------------------------------------

export interface MaterialUnit {
  number: number;
  title: string;
  sections: { heading: string; body: string[]; list?: string[] }[];
}

export interface CourseMaterial {
  code: string;
  title: string;
  subtitle?: string;
  ects: number;
  /** Units for which full teaching text has been written. */
  units: MaterialUnit[];
  assessment?: { label: string; weight: string; detail?: string[] }[];
  reading?: string[];
  /** Units listed in the handbook but not yet drafted. */
  pending?: string[];
  /** Surfaced in the portal when the document conflicts with the published table. */
  conflictNote?: string;
}

export const bth101Material: CourseMaterial = {
  code: 'BTH101',
  title: 'Introduction to Biblical Studies',
  ects: 5,
  units: [
    {
      number: 8,
      title: 'Biblical Geography and Archaeology',
      sections: [
        {
          heading: '8.1 Introduction to Biblical Geography',
          body: [
            'Biblical geography is the study of the physical places, regions, landscapes, and environments connected with the biblical narrative.',
            'The Bible is not a collection of abstract religious ideas separated from history and location. The revelation of Yahuah took place within real places, among real communities, and within historical circumstances.',
            'Understanding geography helps students recognize how climate influenced human activity, land shaped culture, political boundaries affected nations, travel routes influenced the spread of the biblical message, and physical locations contributed to theological meaning.',
            'The land of Scripture is often called the Land of Israel, the Promised Land, Canaan, or the Holy Land. However, the biblical story extends beyond Israel into the wider ancient world, including Egypt, Mesopotamia, Syria, Persia, Asia Minor, Greece, Rome and North Africa.',
          ],
        },
        {
          heading: '8.2 The Importance of Geography in Biblical Interpretation',
          body: [
            'Geography provides important information for understanding biblical events. The wilderness experience of Israel was not merely a geographical journey. It represented dependence upon Yahuah, spiritual testing, covenant formation, and preparation for inheritance.',
            'The mountains, deserts, rivers, and cities of Scripture often carry theological significance.',
          ],
        },
        {
          heading: '8.3 Major Geographical Regions of the Bible',
          body: [
            'Mesopotamia means "land between the rivers", referring primarily to the region between the Tigris and the Euphrates. This region is associated with the early civilizations of humanity, Abraham’s background, and the Babylonian and Assyrian Empires. The biblical narrative begins within this wider world.',
            'Egypt played a major role in biblical history: Joseph’s rise to leadership, Israel’s slavery, the Exodus under Moses, and prophetic interactions with Egypt. Egypt represents both a place of oppression and a place where Yahuah demonstrated His power and deliverance.',
            'The land of Canaan became central to the covenant story. Jerusalem became the spiritual and political centre of Israel — the temple of Solomon, the ministry of prophets, the death and resurrection of Yahusha, and the birth of the early assembly. Bethlehem is associated with King David and the birth of Yahusha the Messiah. Nazareth was the hometown where Yahusha grew up. Galilee was the region where much of Yahusha’s ministry occurred: calling disciples, teaching crowds, performing signs and wonders. Judea was the southern region containing Jerusalem, central during the final ministry of Yahusha, His crucifixion and His resurrection.',
          ],
        },
        {
          heading: '8.4 Biblical Archaeology',
          body: [
            'Biblical archaeology studies material remains connected with biblical history. Archaeology does not replace faith, but it provides valuable historical information about ancient cultures, cities, languages, political systems and religious practices.',
          ],
        },
        {
          heading: '8.5 Important Archaeological Discoveries',
          body: [
            'The Dead Sea Scrolls provide valuable information about ancient Jewish communities, biblical texts, and religious practices before and during the time of Yahusha.',
            'The Tel Dan Inscription contains evidence relating to the historical existence of the House of David.',
            'Archaeological discoveries at the Pool of Bethesda have confirmed the existence of locations mentioned in the Gospel of John. The Pool of Siloam connects with the healing ministry of Yahusha recorded in John 9.',
          ],
        },
      ],
    },
    {
      number: 9,
      title: 'The Cultural Context of the New Testament',
      sections: [
        {
          heading: '9.1 Introduction',
          body: [
            'The New Testament emerged within a complex cultural environment shaped by Judaism, Greek culture, Roman political power and Mediterranean society. Understanding this background is essential for interpreting the message of Yahusha and the early assembly.',
            'The New Testament was written in a world very different from the modern world. Concepts such as Kingdom, Messiah, Son of God, Salvation, Covenant, Temple and Sacrifice carried meanings deeply connected to first-century Jewish and Roman culture.',
          ],
        },
        {
          heading: '9.2 Judaism in the Time of Yahusha',
          body: [
            'The Pharisees emphasized Torah interpretation, religious traditions, personal holiness and resurrection. Yahusha often interacted with Pharisees, challenging interpretations that emphasized external religion without true righteousness.',
            'The Sadducees were associated with temple leadership, priesthood and political influence. They rejected some beliefs accepted by other Jewish groups, including resurrection.',
            'The Essenes were a Jewish community associated with strict religious discipline; the Dead Sea Scrolls are often connected with this community. The Zealots desired liberation from Roman political domination and expected national restoration through resistance.',
          ],
        },
        {
          heading: '9.3 The Temple System',
          body: [
            'The Temple in Jerusalem was central to Jewish religious life. It represented worship, sacrifice, and the presence of Yahuah among His people. The ministry of Yahusha must be understood within this temple context.',
            'The New Testament presents Yahusha as the fulfilment of sacrifice, the true mediator between Yahuah and humanity, and the one who brings a new covenant relationship.',
          ],
        },
        {
          heading: '9.4 The Roman Empire',
          body: [
            'The Roman Empire controlled the Mediterranean world during the time of Yahusha. Roman influence affected politics, economy, transportation, law and military power. The Roman road system helped spread the message of the apostles.',
          ],
        },
        {
          heading: '9.5 Greek Culture and Philosophy',
          body: [
            'Greek culture influenced the intellectual environment of the first century through philosophy, education, language and literature. The New Testament writers communicated the message of Yahusha within a world where Greek thought shaped public discussion.',
          ],
        },
      ],
    },
    {
      number: 10,
      title: 'The Gospels and the Old Testament',
      sections: [
        {
          heading: '10.1–10.2 Yahusha and the Hebrew Scriptures',
          body: [
            'The relationship between the Old Testament and the Gospels is one of the central themes of biblical theology. The Gospel writers present Yahusha as the fulfilment of the promises, patterns, and expectations found throughout the Hebrew Scriptures. The Old Testament provides the foundation for understanding Messiah, Kingdom, Salvation, Covenant and Redemption.',
            'Yahusha did not appear as an isolated historical figure. His life and mission are presented as part of the continuing story of Yahuah’s covenant purposes. The Gospels connect Yahusha with Abraham’s promise, David’s kingdom, the prophetic hope, the suffering servant, and the coming Kingdom.',
          ],
        },
        {
          heading: '10.3–10.6 The Four Gospels',
          body: [
            'Matthew frequently uses the phrase "That it might be fulfilled…", presenting Yahusha as the promised Messiah, the Son of David, and the fulfilment of Israel’s story.',
            'Mark emphasizes Yahusha as the suffering servant. The central message is that the Messiah’s victory comes through sacrifice and obedience.',
            'Luke emphasizes that Yahusha’s mission extends to all people, with themes of compassion, the poor, the marginalized and the nations.',
            'John presents Yahusha as the eternal Word who reveals Yahuah, with major themes of light, life, truth, eternal existence and unity with the Father.',
          ],
        },
      ],
    },
    {
      number: 11,
      title: 'Pauline Theology',
      sections: [
        {
          heading: '11.1–11.2 Paul and his understanding of Yahusha',
          body: [
            'Pauline theology refers to the theological teaching found in the letters attributed to the Apostle Paul. Paul’s writings address salvation, Christ, the Holy Spirit, the Church, faith, grace, resurrection and mission. Paul became one of the most influential interpreters of Yahusha’s life and message.',
            'For Paul, Yahusha is Messiah, Lord, Redeemer, Image of the invisible Yahuah, and the one through whom salvation comes.',
          ],
        },
        {
          heading: '11.3 Salvation in Pauline Theology',
          body: [
            'Paul explains salvation through justification — being declared righteous before Yahuah; redemption — being liberated from slavery to sin; reconciliation — restoration of relationship with Yahuah; and adoption — becoming part of Yahuah’s family.',
          ],
        },
        {
          heading: '11.4–11.5 The Church and Pauline Mission',
          body: [
            'Paul describes the assembly as the Body of Messiah, a spiritual family, and a community of reconciliation. The Church is called to demonstrate the new humanity created through Yahusha.',
            'Paul understood his calling as bringing the message of Yahusha among the nations. His missionary theology emphasized cross-cultural communication, church planting, discipleship and leadership development.',
          ],
        },
      ],
    },
    {
      number: 12,
      title: 'Biblical Hermeneutics and Interpretation',
      sections: [
        {
          heading: '12.1–12.2 Hermeneutics and why correct interpretation matters',
          body: [
            'Hermeneutics is the discipline concerned with the principles, methods, and processes involved in interpreting texts, especially Scripture. The word comes from the Greek hermēneuō, meaning to explain, to interpret, to translate, to make understandable.',
            'The goal of biblical interpretation is not merely to discover information about the Bible but to understand the intended message of Scripture and faithfully apply it to life. A responsible interpreter asks: What did the biblical writer communicate to the original audience? What historical and cultural circumstances shaped the text? What theological truth does the passage reveal about Yahuah? How should this truth be applied today?',
            'Throughout history, incorrect interpretation of Scripture has resulted in false teachings, doctrinal confusion, misuse of biblical authority and harmful practices. 2 Timothy 2:15 teaches believers to rightly divide the word of truth.',
          ],
        },
        {
          heading: '12.3 The Three Worlds of Biblical Interpretation',
          body: [
            'The world behind the text refers to the historical background of Scripture — who wrote it, when, for whom, under what political conditions and cultural practices. Understanding Roman occupation, for example, helps explain many aspects of the Gospel accounts.',
            'The world within the text refers to literary features: words, grammar, structure, style, repeated themes and arguments. A poem must not be interpreted the same way as historical narrative; a prophecy must not be interpreted the same way as a personal letter.',
            'The world in front of the text concerns contemporary application — how the message speaks to today’s culture, society, ethics, human needs and ministry situations. The message of Scripture remains authoritative, but application requires wisdom.',
          ],
        },
        {
          heading: '12.4 Major Biblical Literary Genres',
          body: [
            'Historical narrative (Genesis, Exodus, Acts) communicates theological truths through historical events; the interpreter must consider characters, events, context and authorial purpose.',
            'Poetry (Psalms, Proverbs, Song of Solomon) often uses parallelism, symbolism, metaphor and imagery; a statement in poetry should not always be interpreted literally.',
            'Wisdom literature (Proverbs, Job, Ecclesiastes) explores human existence, suffering, justice and the fear of Yahuah. Prophecy contains calls for repentance, messages of judgment, promises of restoration and future hope.',
            'The Gospels are theological biographies combining historical events, theological interpretation and discipleship instruction. Epistles address specific communities and situations. Apocalyptic literature (Daniel, Revelation) uses symbols, visions, numbers and cosmic imagery to communicate hope, especially during suffering.',
          ],
        },
        {
          heading: '12.5–12.6 The Spirit, and contextual hermeneutics',
          body: [
            'Christian theology recognizes that interpretation requires both intellectual discipline and spiritual dependence. The Spirit of Yahuah illuminates understanding, convicts the heart, guides believers into truth and enables faithful application. However, spiritual interpretation does not replace careful study: a mature interpreter combines prayer, scholarship, historical research and spiritual discernment.',
            'Contextual interpretation recognizes that readers approach Scripture from particular cultural situations. Christians from Africa, Asia, Latin America, Europe and North America may ask different questions of the biblical text because they experience different social realities. Examples include African biblical interpretation, liberation theology, feminist theology, disability theology and ecotheology. The purpose is not to change Scripture but to understand how the eternal message of Yahuah addresses human situations.',
          ],
        },
      ],
    },
    {
      number: 13,
      title: 'Biblical Theology',
      sections: [
        {
          heading: '13.1–13.2 The central story of Scripture',
          body: [
            'Biblical theology is the study of the theological message of Scripture as a unified whole. It asks what the Bible reveals about Yahuah, humanity, creation, redemption and the purpose of history. It differs from systematic theology because it follows the development of theological themes within the biblical story itself.',
            'The Bible presents one great narrative. Creation: Yahuah creates the heavens and the earth, and human beings are created in His image with responsibility over creation. Fall: human rebellion introduces sin, death, separation and brokenness. Covenant: Yahuah establishes covenant relationships with Noah, Abraham, Israel and David. Redemption: through Yahusha the Messiah, Yahuah brings salvation and restoration. New Creation: the Bible ends with the restoration of creation and the establishment of Yahuah’s eternal kingdom.',
          ],
        },
        {
          heading: '13.3–13.4 Major themes and the unity of Scripture',
          body: [
            'The Kingdom of Yahuah represents His rule and authority over creation, involving justice, righteousness, peace and restoration. Covenant describes a committed relationship established by Yahuah — Noahic, Abrahamic, Mosaic, Davidic and New. The expectation of Messiah develops throughout Scripture, presented as King, Deliverer, Servant and Redeemer; the New Testament identifies Yahusha as the fulfilment. Biblical salvation includes deliverance from sin, restoration of relationship with Yahuah, transformation of life and the hope of eternal life.',
            'Although Scripture contains many books written across centuries, biblical theology recognizes a unified purpose: the story of Yahuah’s creation, covenant, redemption and restoration of humanity through Yahusha the Messiah.',
          ],
        },
      ],
    },
    {
      number: 14,
      title: 'Scripture, Doctrine, and Christian Ministry',
      sections: [
        {
          heading: '14.1–14.5 Doctrine drawn from Scripture',
          body: [
            'Christian doctrine develops from the Church’s reflection upon Scripture. Doctrine is not human invention; it is the organized understanding of biblical truth, helping believers understand who Yahuah is, who Yahusha is, what salvation means, and what the Church is called to do.',
            'The Bible reveals Yahuah as eternal, Creator, holy, loving, sovereign and faithful; the doctrine of Yahuah forms the foundation of all theology. Christology examines the identity, incarnation, teachings, death, resurrection and return of Yahusha. Pneumatology covers creation, prophecy, empowerment, spiritual gifts, transformation and mission. Ecclesiology describes the assembly as the body of Messiah, the people of Yahuah, a community of worship and a missionary movement.',
          ],
        },
        {
          heading: '14.6 Scripture and Christian Ministry',
          body: [
            'Biblical knowledge must lead to faithful ministry. The student of Scripture is called to teach truth, serve others, make disciples, demonstrate compassion, promote justice, and proclaim the message of Yahusha.',
          ],
        },
      ],
    },
    {
      number: 15,
      title: 'Global and Contextual Interpretation of Scripture',
      sections: [
        {
          heading: '15.1–15.4 Reading Scripture globally',
          body: [
            'Christianity is now a truly global faith. The majority of Christians today live outside traditional Western centres of Christianity. Therefore, biblical interpretation must recognize the voices of believers from Africa, Asia, Latin America, indigenous communities and global diaspora communities.',
            'African Christians often read Scripture through themes such as community, ancestors and heritage, spiritual reality, healing, liberation, Ubuntu and social responsibility. African theology emphasizes that the Gospel addresses the whole person and the whole community.',
            'Asian theology often engages questions of religious pluralism, poverty, community, spiritual traditions and social harmony. Latin American theology emphasizes justice, the poor, liberation and social transformation.',
          ],
        },
        {
          heading: '15.5 Scripture and Contemporary Challenges',
          body: [
            'The Bible continues to speak to modern issues including human dignity, racism, poverty, environmental destruction, migration, technology, gender questions, disability and political responsibility. The task of theology is to faithfully communicate the truth of Yahuah within every generation.',
          ],
        },
      ],
    },
  ],
  assessment: [
    { label: 'Assignment 1 — Biblical Interpretation Essay', weight: '30%', detail: ['Historical background', 'Literary analysis', 'Theological meaning', 'Contemporary application'] },
    { label: 'Assignment 2 — Biblical Theology Research Paper', weight: '30%', detail: ['One major biblical theme: covenant, kingdom, salvation, Messiah or creation'] },
    { label: 'Final Examination', weight: '40%', detail: ['Knowledge of biblical studies', 'Understanding of interpretation', 'Ability to apply biblical principles'] },
  ],
  reading: [
    'The Holy Scriptures',
    'Gordon Fee & Douglas Stuart, How to Read the Bible for All Its Worth',
    'Walter Kaiser, Toward an Old Testament Theology',
    'George Eldon Ladd, A Theology of the New Testament',
    'N.T. Wright, The New Testament and the People of God',
    'Christopher J.H. Wright, The Mission of Yahuah',
  ],
  pending: ['Units 1–7 teaching text (unit titles published; text not yet drafted)'],
};

export const bth102Material: CourseMaterial = {
  code: 'BTH102',
  title: 'Bible Survey I',
  subtitle: 'The Pentateuch, Historical Books, and the Formation of Yahuah’s Covenant People',
  ects: 5,
  units: [
    {
      number: 1,
      title: 'Introduction to the Old Testament',
      sections: [
        {
          heading: '1.1 The Nature of the Old Testament',
          body: [
            'The Old Testament is the first major division of Christian Scripture and contains the sacred writings preserved by the people of Israel. It reveals the identity of Yahuah, the creation of the world, the origin of humanity, the problem of sin, the establishment of covenant, the history of Israel and the promise of redemption.',
            'The Old Testament presents a consistent message: Yahuah is the Creator who calls humanity into relationship with Him and works throughout history to restore what has been broken.',
          ],
        },
        {
          heading: '1.2 The Old Testament as Covenant History',
          body: [
            'The central theme of the Old Testament is covenant — a relationship established by Yahuah involving commitment, promise, responsibility, blessing and faithfulness.',
          ],
          list: ['Creation Covenant', 'Noahic Covenant', 'Abrahamic Covenant', 'Mosaic Covenant', 'Davidic Covenant', 'New Covenant'],
        },
      ],
    },
    {
      number: 2,
      title: 'The Book of Genesis',
      sections: [
        {
          heading: '2.1 Introduction to Genesis',
          body: [
            'The name Genesis means "Beginning" or "Origin". Genesis provides the foundation for understanding creation, humanity, sin, nations, covenant and redemption.',
            'The book divides into Primeval History (Genesis 1–11): creation, fall, Cain and Abel, the Flood, the Tower of Babel; and Patriarchal History (Genesis 12–50): Abraham, Isaac, Jacob and Joseph.',
          ],
        },
        {
          heading: '2.2 Creation and the Identity of Yahuah',
          body: [
            'Genesis begins with the declaration: "In the beginning Yahuah created the heavens and the earth." The universe exists because of His will and power; creation is not accidental but purposeful.',
            'Genesis repeatedly declares creation to be good, teaching that matter is valuable, the physical world belongs to Yahuah, and humanity has responsibility toward creation.',
            'Genesis 1:26–27 teaches that humanity was created in the image and likeness of Yahuah, establishing human dignity, human responsibility and moral accountability. Every human being possesses value because humanity reflects the Creator.',
          ],
        },
        {
          heading: '2.3–2.4 The Fall and the Promise of Redemption',
          body: [
            'Genesis chapter three describes humanity’s rebellion against Yahuah, with consequences of separation from Yahuah, broken relationships, suffering, death and the corruption of creation. The fall explains the biblical understanding of the human problem: humanity does not merely need education or improvement; humanity needs redemption.',
            'Even after humanity’s rebellion, Yahuah reveals His purpose of restoration. Genesis 3:15 is often understood as the first announcement of future redemption, pointing toward the ultimate defeat of evil through the work of Messiah.',
          ],
        },
      ],
    },
    {
      number: 3,
      title: 'Abraham and the Covenant Promise',
      sections: [
        {
          heading: '3.1–3.3 Calling, covenant, and faith',
          body: [
            'Genesis 12 introduces Abraham as a central figure in biblical history. Yahuah calls Abraham from his homeland and promises a great nation, blessing, a great name, and blessing to all nations.',
            'The covenant with Abraham establishes major biblical themes. The promise of land becomes central to Israel’s identity. The promise of descendants makes Abraham’s line the people through whom Yahuah’s purposes continue. The promise of blessing to nations shows the ultimate purpose was not only Israel’s blessing but blessing for all nations — a theme that develops throughout Scripture and reaches fulfilment through Yahusha the Messiah.',
            'Abraham becomes an example of faith. His relationship with Yahuah demonstrates trust, obedience and dependence upon divine promise.',
          ],
        },
      ],
    },
    {
      number: 4,
      title: 'Moses, the Exodus, and the Covenant at Sinai',
      sections: [
        {
          heading: '4.1–4.3 Egypt, Moses and redemption',
          body: [
            'The descendants of Abraham eventually become enslaved in Egypt. Their suffering leads to Yahuah’s intervention. The Exodus reveals that Yahuah hears suffering, delivers His people, and establishes covenant.',
            'Moses is called by Yahuah to lead Israel out of bondage. His ministry demonstrates prophetic leadership, obedience, and mediation between Yahuah and Israel.',
            'The Exodus becomes the central salvation event of the Old Testament, demonstrating deliverance from slavery, formation of a covenant people, and movement toward inheritance. It becomes a pattern later used to describe spiritual redemption.',
          ],
        },
        {
          heading: '4.4 The Sinai Covenant',
          body: [
            'At Mount Sinai, Yahuah establishes covenant with Israel. The covenant includes the Ten Commandments, worship regulations, social laws and moral instructions. The Law was not given as a method of earning salvation but as guidance for a redeemed people.',
          ],
        },
      ],
    },
    {
      number: 5,
      title: 'The Books of the Law',
      sections: [
        {
          heading: 'Leviticus, Numbers and Deuteronomy',
          body: [
            'Leviticus explains sacrifice, priesthood, holiness and worship. The central message is: "Be holy, for I Yahuah your Elohim am holy."',
            'Numbers describes Israel’s wilderness journey, rebellion, judgment, and the faithfulness of Yahuah.',
            'Deuteronomy contains Moses’ final teachings, with major themes of remembering Yahuah, obeying the covenant, loving Yahuah, and teaching future generations.',
          ],
        },
      ],
    },
  ],
  pending: [
    'Unit 6 — Joshua: Entering the Promised Land',
    'Unit 7 — Judges and the Cycle of Israel’s Failure',
    'Unit 8 — Samuel and the Rise of the Kingdom',
    'Unit 9 — David, Covenant, and Messianic Hope',
    'Unit 10 — Solomon and the Temple',
    'Unit 11 — Divided Kingdom and Prophetic Ministry',
    'Unit 12 — Exile and Restoration',
    'Unit 13 — Old Testament Theology of Messiah',
    'Unit 14 — Theological Themes for Christian Ministry',
    'Unit 15 — Assessment and Bibliography',
  ],
};


// ---------------------------------------------------------------------------
// BTH102 units 6-10 (continuation). Supplied in a later batch whose document
// header reads "BIBLE SURVEY I" — see docs/BTH-HANDBOOK-PLANNING.md for the
// naming conflict with the published 36-course table.
// ---------------------------------------------------------------------------

const bth102Continuation: MaterialUnit[] = [
  {
    number: 6,
    title: 'Joshua: Entering the Promised Land',
    sections: [
      { heading: '6.1–6.3 Joshua, successor and leader', body: [
        'The Book of Joshua continues the story of Yahuah’s covenant faithfulness after the death of Moses, describing the transition of leadership from Moses to Joshua and the entrance of Israel into the land promised to Abraham, Isaac and Jacob. Joshua demonstrates an important theological truth: the promises of Yahuah depend upon His faithfulness, but His people are called to respond through faith and obedience.',
        'Joshua had previously served as a servant of Moses, a military leader, and one of the twelve spies sent into Canaan. Unlike the majority of spies who feared the inhabitants of the land, Joshua and Caleb trusted the promise of Yahuah. His leadership was based upon trust in Yahuah, knowledge of His word, and courage in difficult circumstances.',
        'Yahuah commands Joshua: "Be strong and courageous." This command was not based on human ability but on the presence of Yahuah. Leadership in biblical theology begins with relationship with Yahuah before it begins with human ability.',
      ] },
      { heading: '6.4–6.7 Jordan, conquest, Rahab and covenant renewal', body: [
        'The crossing of the Jordan River parallels the earlier crossing of the Red Sea. Both events demonstrate divine intervention, deliverance and a new beginning, confirming that the same Yahuah who delivered Israel from Egypt continues to guide His people.',
        'The conquest narratives describe Israel’s entry into the Promised Land — the battle of Jericho, the defeat of Ai, and the covenant renewal at Mount Ebal and Mount Gerizim. The conquest must be understood within the larger biblical theme of judgment, covenant and redemption. The land was not given because Israel was superior but because of the covenant purposes of Yahuah.',
        'The story of Rahab demonstrates that faithfulness to Yahuah is not based only on ethnic identity. Rahab, a woman from Jericho, acknowledged the power of Yahuah and became part of Israel’s story — demonstrating the mercy of Yahuah, the possibility of transformation, and the universal purpose of redemption.',
        'Joshua ends with a call for Israel to remain faithful: "As for me and my house, we will serve Yahuah." This statement represents the central choice of covenant life.',
      ] },
    ],
  },
  {
    number: 7,
    title: 'Judges: The Cycle of Failure and Restoration',
    sections: [
      { heading: '7.1–7.2 The cycle and its message', body: [
        'The Book of Judges describes the period between Joshua’s leadership and the establishment of Israel’s monarchy, characterized by repeated cycles: Israel turns away from Yahuah; Yahuah allows oppression; Israel cries for deliverance; Yahuah raises a judge; Israel experiences restoration; the cycle repeats.',
        'The central message is that humanity cannot achieve lasting righteousness without faithful relationship with Yahuah. The repeated failure of Israel reveals the seriousness of sin, the need for righteous leadership, and the need for divine redemption.',
      ] },
      { heading: '7.3–7.4 Major judges and the need for a king', body: [
        'Deborah demonstrates that Yahuah can use unexpected individuals for His purposes, serving as prophetess, judge and leader; her story challenges cultural assumptions about leadership and demonstrates divine calling. Gideon’s story emphasizes dependence upon Yahuah rather than human strength — Yahuah reduces Gideon’s army to demonstrate that victory comes from Him. Samson represents both divine calling and human weakness, demonstrating the consequences of disobedience, the patience of Yahuah, and the possibility of restoration.',
        'Judges repeatedly states: "In those days there was no king in Israel; everyone did what was right in his own eyes." The biblical narrative moves toward the establishment of kingship, ultimately pointing toward the perfect reign of Messiah.',
      ] },
    ],
  },
  {
    number: 8,
    title: 'Samuel and the Rise of the Kingdom',
    sections: [
      { heading: '8.1–8.4 Samuel, Saul and David', body: [
        'Samuel represents the transition between the period of judges and the monarchy, serving as prophet, spiritual leader and judge. His ministry emphasized hearing and obeying the voice of Yahuah.',
        'Israel demanded a king like other nations. Their request revealed a desire for political security and lack of trust in Yahuah’s leadership. However, Yahuah used even this situation to advance His purposes.',
        'Saul was chosen as Israel’s first king. His early leadership showed promise, but his reign was eventually marked by disobedience, pride and rejection of divine instruction. Saul demonstrates that leadership without obedience to Yahuah leads to failure.',
        'David becomes one of the most important figures in biblical history — shepherd, warrior, king and worshipper. His significance is not based on perfection but on his relationship with Yahuah.',
      ] },
    ],
  },
  {
    number: 9,
    title: 'David, the Davidic Covenant, and Messianic Hope',
    sections: [
      { heading: '9.1–9.4 Kingdom, covenant, foreshadowing and Psalms', body: [
        'David establishes Jerusalem as the centre of Israel’s kingdom. His reign represents political unity, military strength and worship development.',
        'In 2 Samuel 7, Yahuah establishes a covenant with David promising a lasting dynasty, a kingdom, and a throne established forever. This promise becomes one of the foundations of messianic expectation.',
        'David’s life points forward to Yahusha the Messiah: David as shepherd, king and chosen one; Yahusha as Good Shepherd, King of Kings and Anointed Messiah.',
        'Many Psalms reveal worship, prayer, suffering, hope and trust in Yahuah. The Psalms became central in Israel’s worship and continue to shape Christian spirituality.',
      ] },
    ],
  },
  {
    number: 10,
    title: 'Solomon, Wisdom, and the Temple',
    sections: [
      { heading: '10.1–10.4 Reign, temple, wisdom and theology', body: [
        'Solomon succeeded David and became known for wisdom, wealth and temple construction. His reign represented a period of peace and prosperity.',
        'The construction of the Temple represented worship, covenant relationship, and the presence of Yahuah among His people. The Temple became central to Israel’s religious identity.',
        'Solomon’s wisdom included leadership, judgment, understanding and instruction. However, later in life Solomon compromised through idolatry, political alliances and foreign influences. His failure demonstrates that wisdom without faithfulness is incomplete.',
        'The Temple points toward greater realities: the dwelling presence of Yahuah, the need for purification, and the relationship between heaven and earth. The New Testament develops the theme of Yahuah’s presence among His people through Yahusha and the Spirit.',
      ] },
    ],
  },
  {
    number: 11,
    title: 'The Divided Kingdom and the Prophetic Ministry of Yahuah',
    sections: [
      { heading: '11.1–11.4 Division, north and south', body: [
        'After the reign of Solomon the united kingdom entered a period of political division and spiritual decline, dividing into the Northern Kingdom (Israel) and the Southern Kingdom (Judah). The prophetic ministry developed strongly during this period: prophets were raised by Yahuah to call Israel back to covenant faithfulness, expose injustice, condemn idolatry, announce judgment, proclaim restoration and reveal future messianic hope.',
        'After Solomon’s death his son Rehoboam became king; his harsh leadership caused the northern tribes to separate under Jeroboam. The kingdom divided around 931 BC.',
        'The Northern Kingdom consisted of ten tribes with Samaria as capital, characterized by political instability, multiple royal dynasties, idolatry and false worship systems. Jeroboam established alternative worship centres at Bethel and Dan, an attempt to prevent people returning to Jerusalem that violated covenant worship.',
        'Judah consisted mainly of Judah, Benjamin and the priestly community connected to Jerusalem, preserving the Davidic line and Temple worship. Important righteous kings included Hezekiah and Josiah.',
      ] },
      { heading: '11.5–11.7 Elijah and Elisha', body: [
        'Elijah ministered during the reign of King Ahab and Queen Jezebel. The central conflict was between worship of Yahuah and worship of Baal.',
        'The confrontation at Mount Carmel demonstrated that Yahuah alone is the true Elohim, revealing the sovereignty of Yahuah, the emptiness of idolatry, and the responsibility of Yahuah’s people to remain faithful.',
        'Elisha continued Elijah’s prophetic ministry, emphasizing compassion, healing, divine provision and restoration. Miracles through Elisha demonstrated that Yahuah was active among His people even during national decline.',
      ] },
      { heading: '11.8–11.12 The writing prophets', body: [
        'Isaiah ministered in Judah during a period of international crisis. His message included the holiness of Yahuah, judgment against sin, hope of restoration and the coming Messiah. Isaiah 7:14 speaks of Yahuah’s presence with His people; Isaiah 53 describes the servant who suffers for the sins of others, understood in Christian theology as pointing toward the suffering and redemption accomplished through Yahusha the Messiah.',
        'Jeremiah ministered before and during the Babylonian exile, warning of judgment, calling to repentance and offering hope for restoration. He announced a future covenant where Yahuah would write His law upon human hearts.',
        'Ezekiel ministered among the exiles in Babylon. Major themes include the departure of Yahuah’s glory because of rebellion, the restoration of Yahuah’s presence, a renewed people and a transformed heart. Important visions include the valley of dry bones and the restored temple vision.',
        'The twelve minor prophets are called "minor" because of the shorter length of their writings, not because their message was less important. Hosea used his marriage relationship as a symbol of Yahuah’s relationship with unfaithful Israel. Amos strongly condemned social injustice: true worship must include righteousness and justice. Micah announced judgment but also hope — justice, mercy and humility before Yahuah — and contains a prophecy concerning Bethlehem. Malachi addressed spiritual decline after the exile, calling for faithful worship, covenant commitment and preparation for Yahuah’s future work.',
      ] },
    ],
  },
  {
    number: 12,
    title: 'Exile, Judgment, and Restoration',
    sections: [
      { heading: '12.1–12.4 The exiles', body: [
        'Because of persistent rebellion and idolatry, Yahuah allowed foreign nations to conquer Israel. The exile involved loss of land, destruction of Jerusalem, destruction of the Temple, and removal of many people to foreign lands.',
        'The Northern Kingdom fell to Assyria in 722 BC. The Assyrians were known for military power, forced migration policies and political domination. The fall of Israel demonstrated the seriousness of covenant rebellion.',
        'Judah fell to Babylon in 586 BC; King Nebuchadnezzar destroyed Jerusalem and the Temple. The exile created theological questions: Had Yahuah abandoned His people? Were His promises broken? Could restoration happen? The prophets answered that Yahuah had not abandoned His covenant purposes.',
        'Daniel demonstrates faithful obedience in a foreign empire, teaching loyalty to Yahuah above political pressure, wisdom in public service, and hope in Yahuah’s kingdom.',
      ] },
      { heading: '12.5–12.6 Restoration and its meaning', body: [
        'After Babylon fell to Persia, King Cyrus allowed Jewish exiles to return. Zerubbabel led the rebuilding of the Temple; Ezra focused on teaching Torah and restoring spiritual identity; Nehemiah rebuilt Jerusalem’s walls and promoted social reform.',
        'The exile reveals the holiness of Yahuah — He does not ignore rebellion; the justice of Yahuah — actions have consequences; and the mercy of Yahuah — judgment is not the final word. Restoration remains possible because of covenant faithfulness.',
      ] },
    ],
  },
  {
    number: 13,
    title: 'Old Testament Messianic Hope',
    sections: [
      { heading: '13.1–13.5 The developing expectation', body: [
        'The word Messiah means "Anointed One". The Messiah was expected to bring deliverance, kingdom restoration, justice, peace and redemption.',
        'The Torah contains early promises pointing toward redemption: the promise of victory over evil, the blessing of the nations through Abraham, and the expectation of a coming prophet like Moses.',
        'The Davidic covenant created expectation of a future king whose reign would never end — Son of David, righteous ruler, shepherd of Yahuah’s people. The prophets developed themes of a suffering servant, a righteous king, a restored kingdom and a renewed covenant.',
        'The New Testament presents Yahusha as the fulfilment of the Old Testament story: the covenant promises, the prophetic expectations, the sacrificial system and the kingdom hope.',
      ] },
    ],
  },
  {
    number: 14,
    title: 'Old Testament Theology and Christian Ministry',
    sections: [
      { heading: '14.1–14.3 Preaching, ethics and mission', body: [
        'The Old Testament provides essential material for ministry. Preachers must communicate the character of Yahuah, the seriousness of sin, the hope of redemption and the call to faithful living.',
        'The Old Testament teaches principles concerning justice, compassion, care for the poor, integrity, family responsibility and community life.',
        'Yahuah’s mission begins in Genesis. The calling of Abraham included blessing all nations. Israel was called to be a priestly kingdom, a light to the nations, and a witness of Yahuah’s character. This mission reaches its fulfilment through Yahusha and the global mission of the assembly.',
      ] },
    ],
  },
];

bth102Material.units.push(...bth102Continuation);
bth102Material.pending = undefined;
bth102Material.assessment = [
  { label: 'Assignment One — Old Testament Book Study', weight: '30%', detail: ['Historical background', 'Major themes', 'Theological message', 'Ministry application'] },
  { label: 'Assignment Two — Covenant Theology Essay', weight: '30%', detail: ['"The Development of Yahuah\u2019s Covenant Plan from Abraham to Yahusha the Messiah"'] },
  { label: 'Final Examination', weight: '40%', detail: ['Knowledge of Old Testament history', 'Understanding of theological themes', 'Connecting Old and New Testament revelation'] },
];
bth102Material.reading = [
  'The Holy Scriptures',
  'Gordon Wenham, Exploring the Old Testament',
  'Walter Kaiser, The Promise-Plan of Yahuah',
  'Christopher J.H. Wright, The Mission of Yahuah',
  'Tremper Longman III, An Introduction to the Old Testament',
  'John Goldingay, Old Testament Theology',
  'Eugene Merrill, Kingdom of Priests',
];


// ---------------------------------------------------------------------------
// BTH103 and BTH104 as supplied. NOTE: these documents carry titles and
// semester placements that CONFLICT with the published 36-course table:
//   · doc BTH103 = "Bible Survey II", "First Year - Second Semester"
//     table BTH103 = "Biblical Studies II: New Testament Survey", Semester 1
//   · doc BTH104 = "Bible Doctrine I", "First Year - Second Semester"
//     table BTH104 = "Church History I", Semester 1
// The `conflictNote` field surfaces this to staff inside the portal so nobody
// teaches from a document whose code may be reassigned. Resolution pending —
// see docs/BTH-HANDBOOK-PLANNING.md.
// ---------------------------------------------------------------------------

export const bth103Material: CourseMaterial = {
  code: 'BTH103',
  title: 'Bible Survey II',
  subtitle: 'The Prophets, Wisdom Literature, Gospels, Acts, and the Development of the New Covenant Community',
  ects: 5,
  // Reconciled: the development brief confirms BTH103 = Bible Survey II in
  // Semester One. The document's own header said Semester Two with BTH102 as
  // prerequisite, which the brief overrides — flagged for the faculty.
  conflictNote:
    'Reconciled as Bible Survey II. One point outstanding: this document states Semester Two with BTH102 as prerequisite, while the programme structure places both in Semester One. The prerequisite cannot stand as written.',
  units: [
    { number: 1, title: 'Introduction to the Prophetic Movement', sections: [
      { heading: '1.1–1.3 The prophet, the covenant, and two dimensions', body: [
        'A prophet was not merely someone who predicted future events. The biblical prophet was a messenger called by Yahuah to communicate His will: calling people back to covenant faithfulness, exposing injustice, warning against idolatry, announcing judgment, proclaiming restoration and revealing Yahuah’s purposes. The Hebrew concept of prophecy emphasizes speaking on behalf of Yahuah.',
        'The prophets functioned within the covenant relationship between Yahuah and Israel. Their message was often "Return to Yahuah." They reminded Israel that worship without obedience was unacceptable, religious rituals without righteousness were meaningless, and covenant relationship required faithfulness.',
        'Biblical prophecy contains two major dimensions: an immediate historical message addressing real situations in the prophet’s own generation — political corruption, social injustice, idolatry, national crisis — and a future messianic fulfilment pointing toward Messiah, kingdom restoration and final redemption.',
      ] },
    ] },
    { number: 2, title: 'Isaiah: The Holy King and the Suffering Servant', sections: [
      { heading: '2.1–2.3 Background, holiness and messianic vision', body: [
        'Isaiah ministered during the eighth century BC during a time of political uncertainty. Assyria threatened the nations, and Judah faced spiritual decline. His ministry emphasized the holiness of Yahuah, the need for repentance and the hope of salvation.',
        'Isaiah 6 records Isaiah’s vision of the heavenly throne. The proclamation "Holy, holy, holy" reveals Yahuah’s absolute purity, His greatness above creation, and humanity’s need for cleansing.',
        'Isaiah presents the coming Messiah as the promised child, the righteous ruler and the suffering servant. Isaiah 9 presents the coming ruler whose kingdom brings peace, justice and righteousness. Isaiah 53 describes a servant who suffers on behalf of others — rejection, suffering, sacrifice, healing, restoration — understood in Christian theology as pointing toward Yahusha’s sacrificial work.',
      ] },
    ] },
    { number: 3, title: 'Jeremiah: Judgment and the New Covenant', sections: [
      { heading: '3.1–3.3 Calling, the human heart, and the new covenant', body: [
        'Jeremiah was called during a difficult period when Judah was moving toward destruction. His ministry required courage, faithfulness and perseverance.',
        'Jeremiah identified that Israel’s greatest problem was not merely political but spiritual: a rebellious heart, unfaithfulness, and rejection of Yahuah’s ways.',
        'Jeremiah 31 contains the promise of a new covenant. Yahuah declares that He will write His law upon hearts, establish a renewed relationship, and forgive iniquity. This becomes foundational for New Testament understanding of salvation through Yahusha.',
      ] },
    ] },
    { number: 4, title: 'Ezekiel: The Glory and Restoration of Yahuah', sections: [
      { heading: '4.1–4.3 Exile theology, glory, and the new heart', body: [
        'Ezekiel ministered among the Jewish exiles in Babylon. The exile created a crisis: if Jerusalem and the Temple are destroyed, where is Yahuah? Ezekiel’s answer: Yahuah is not limited to a geographical location; He remains sovereign even among the nations.',
        'Ezekiel describes visions of Yahuah’s glory, revealing divine sovereignty, divine holiness and divine presence.',
        'Ezekiel 36 promises transformation: a new heart, a new spirit, cleansing from sin and restored relationship. This points toward the work of the Spirit in the New Covenant.',
      ] },
    ] },
    { number: 5, title: 'Daniel: The Kingdom of Yahuah Among the Nations', sections: [
      { heading: '5.1–5.3 Context, faithfulness and kingdom vision', body: [
        'Daniel lived during the Babylonian exile, serving within a foreign empire while remaining faithful to Yahuah.',
        'Daniel demonstrates spiritual courage, integrity, prayer and loyalty to Yahuah.',
        'Daniel’s visions reveal that earthly kingdoms rise and fall, but the kingdom of Yahuah remains forever. This theme becomes central in Yahusha’s proclamation of the Kingdom.',
      ] },
    ] },
    { number: 6, title: 'Job: Suffering, Faith, and the Sovereignty of Yahuah', sections: [
      { heading: '6.1–6.3 The question of suffering', body: [
        'The Book of Job explores one of humanity’s deepest questions: why do righteous people suffer?',
        'Job teaches that human understanding is limited, Yahuah remains sovereign, and faith must continue even during suffering.',
        'Job discovers that knowing Yahuah is greater than receiving explanations for every circumstance.',
      ] },
    ] },
    { number: 7, title: 'Psalms: Worship and Spiritual Life', sections: [
      { heading: '7.1–7.2 Purpose and messianic Psalms', body: [
        'The Psalms express the complete human experience before Yahuah: praise, lament, prayer, repentance, thanksgiving and hope.',
        'Some Psalms point toward Messiah, with themes of the righteous king, the suffering servant and the victorious ruler.',
      ] },
    ] },
    { number: 8, title: 'Proverbs, Ecclesiastes, and Song of Songs', sections: [
      { heading: 'Wisdom literature', body: [
        'Proverbs teaches practical wisdom based on "the fear of Yahuah", including moral living, justice, discipline and relationships.',
        'Ecclesiastes explores meaning, human limitation and the temporary nature of earthly achievements. The conclusion: true meaning is found in reverence toward Yahuah.',
        'Song of Songs celebrates covenant love, marriage and faithfulness.',
      ] },
    ] },
    { number: 9, title: 'The Cultural, Historical, and Religious Context of the New Testament', sections: [
      { heading: '9.1–9.3 The world of Yahusha', body: [
        'The New Testament developed within the interaction of Hebrew Israelite religious traditions, Second Temple Judaism, Roman imperial rule, Greek language and philosophy, African and Mediterranean civilizations, and ancient Near Eastern cultural patterns.',
        'Yahusha was born within the people of Israel and lived within the traditions of the Hebrew Scriptures — the Torah, the Prophets, the Psalms, the covenant promises and the expectation of Messiah. The Gospel writers present Him as the continuation and fulfilment of Yahuah’s covenant relationship with Israel: Son of David, Son of Abraham, King of Israel, Messiah, Redeemer.',
        'Galilee was where Yahusha grew up and conducted much of His ministry. Samaria lay between Galilee and Judea; relations between Jews and Samaritans were often tense, yet Yahusha demonstrated that the purposes of Yahuah extended beyond social boundaries. Judea contained Jerusalem — Temple ministry, final teachings, crucifixion and resurrection.',
      ] },
      { heading: '9.4–9.6 Second Temple Judaism, religious groups and Rome', body: [
        'The Jewish religious world was shaped by Temple worship, synagogue communities, Torah interpretation, messianic expectations and religious debates.',
        'The Pharisees emphasized Torah interpretation, religious obedience, resurrection and community holiness; Yahusha’s criticism was not against Scripture or obedience but against hypocrisy and placing human traditions above the heart of Yahuah. The Sadducees were connected with the Temple priesthood, political leadership and Jerusalem’s elite, and rejected certain beliefs including resurrection. The Essenes were associated with separation from corrupt society, religious purity and expectation of divine intervention. The Zealots sought freedom from Roman domination through resistance.',
        'Rome controlled government, military power, taxation and public order, creating economic inequality, political tension and desire for liberation. Many Jews expected Messiah to be a political deliverer who would overthrow Rome; Yahusha revealed that His Kingdom was greater than earthly political systems.',
      ] },
    ] },
    { number: 10, title: 'The Identity of Yahusha the Messiah', sections: [
      { heading: '10.1–10.6 Christology', body: [
        'Christology is the theological study of the person and work of Yahusha the Messiah. The central question of the New Testament is: who is Yahusha? The biblical answer involves His humanity, divine identity, messianic mission, kingdom authority and redemptive work.',
        'The Hebrew concept of Messiah means "the Anointed One". Kings, priests and prophets were anointed for divine service. The Messiah would restore righteousness, establish Yahuah’s Kingdom, bring salvation and defeat evil.',
        'Yahuah promised Abraham: "Through your seed all nations shall be blessed." The New Testament presents Yahusha as the fulfilment of this promise, His mission extending beyond one nation to all peoples. Yahuah promised David that his throne would endure; the Gospels repeatedly identify Yahusha as "Son of David".',
        'The Gospel of John introduces Yahusha as the Word who was with Yahuah from the beginning, revealing His eternal significance, His role in creation, and His unique relationship with Yahuah. The New Testament also emphasizes that Yahusha truly entered human existence — birth, growth, hunger, weariness, suffering, death — allowing Him to fully identify with humanity.',
      ] },
      { heading: '10.7 The African and Historical Discussion of Yahusha’s Identity', body: [
        'Yahusha was a first-century Jewish man from the land of Israel, located within the broader African and Near Eastern world. The ancient world did not operate according to modern racial categories; peoples were identified through family lineage, language, geography, culture and covenant identity.',
        'The biblical world included strong connections between Israel and Africa: Abraham’s family history involved Egypt, Israel lived in Egypt for generations, Egypt appears throughout biblical history, and the early Christian movement spread rapidly into Africa.',
        'The study of Yahusha’s identity therefore requires attention to Hebrew ancestry, African geography, ancient Mediterranean history, and colonial interpretations of biblical images. A responsible theological approach recognizes the historical context of Yahusha while also examining how different communities across Africa and the global South have understood and expressed His identity.',
      ] },
    ] },
    { number: 11, title: 'The Kingdom of Yahuah in the Teaching of Yahusha', sections: [
      { heading: '11.1–11.4 Kingdom, parables and the marginalized', body: [
        'The primary message of Yahusha was: "The Kingdom of Yahuah has come near." The Kingdom refers to Yahuah’s reign, His authority, His restoration of creation, and His justice and righteousness.',
        'Yahusha taught that the Kingdom was present — revealed through His teachings, miracles, authority over evil and presence among humanity — and future, because complete restoration awaits the final fulfilment of Yahuah’s purposes.',
        'The Parable of the Sower teaches that the response to Yahuah’s word determines spiritual fruitfulness. The Parable of the Good Samaritan teaches that love of neighbour crosses social boundaries. The Parable of the Prodigal Son teaches that Yahuah’s mercy restores the repentant.',
        'A major theme of Yahusha’s ministry was His concern for those excluded by society — the poor, the sick, women, children, foreigners and socially rejected people — revealing the inclusive nature of Yahuah’s Kingdom.',
      ] },
    ] },
    { number: 12, title: 'The Miracles and Signs of Yahusha', sections: [
      { heading: '12.1–12.4 Purpose and kinds of sign', body: [
        'Biblical miracles are not merely demonstrations of supernatural power. They reveal the identity of Yahusha, the compassion of Yahuah, the arrival of the Kingdom and the restoration of creation.',
        'Yahusha healed blindness, paralysis, disease and spiritual oppression; these acts demonstrated that the Kingdom brings restoration. He demonstrated authority over storms, nature, disease and death.',
        'The raising of the dead pointed toward the ultimate victory over death accomplished through His resurrection.',
      ] },
    ] },
    { number: 13, title: 'The Death, Resurrection, and Ascension of Yahusha the Messiah', sections: [
      { heading: '13.1–13.3 Centrality, Passover and the Last Supper', body: [
        'The apostles consistently proclaimed that Yahusha died according to the Scriptures, was buried, was raised from the dead, appeared to witnesses, was exalted by Yahuah, and will return to complete the restoration of all things.',
        'The death of Yahusha occurred during the Passover period. The Exodus story included a lamb without defect, deliverance through blood, freedom from bondage and formation of a covenant people. The New Testament presents Yahusha as the fulfilment of this pattern: the Lamb of Yahuah, the Passover sacrifice, the one who brings final deliverance.',
        'Before His death, Yahusha shared a final meal with His disciples, connecting with the prophetic promise of the New Covenant: forgiveness of sins, restoration of relationship with Yahuah, transformation of the heart, and a renewed people.',
      ] },
      { heading: '13.4–13.5 The cross and its meanings', body: [
        'Crucifixion was a Roman method of execution designed to punish criminals, demonstrate imperial power and create public shame. Yet the New Testament presents the cross not as defeat but as victory: sin is confronted, reconciliation is accomplished, redemption is offered, and the love of Yahuah is revealed.',
        'Christian theology has developed several understandings. Sacrificial: Yahusha’s death understood through the Old Testament sacrificial system pointing toward cleansing, forgiveness and restoration. Redemption: liberation from bondage to sin, death and spiritual slavery. Reconciliation: restoring broken relationship between humanity and Yahuah, and between human beings. Victory: over evil, sin, death and the powers of darkness.',
      ] },
      { heading: '13.6–13.9 Resurrection and ascension', body: [
        'The resurrection is the foundation of apostolic preaching. Without resurrection, the message of the Gospel loses its foundation. It declares that Yahusha is Messiah, death has been defeated, Yahuah has vindicated His Son, and new creation has begun.',
        'The Gospel accounts testify that the tomb was found empty. Resurrection appearances include Mary Magdalene, the disciples, Peter, the apostles and a large number of witnesses. The resurrection transformed frightened disciples into bold witnesses.',
        'The resurrection is not merely a return to ordinary life. It represents victory over death, the beginning of new creation, and hope for believers united with Yahusha.',
        'After His resurrection, Yahusha ascended. The ascension means exaltation by Yahuah, enthronement as King, continuation of His ministry, and preparation for His return.',
      ] },
    ] },
    { number: 14, title: 'The Book of Acts and the Birth of the New Covenant Community', sections: [
      { heading: '14.1–14.6 Spirit, Pentecost, and the early assembly', body: [
        'The Book of Acts records the continuation of Yahusha’s ministry through the work of the Holy Spirit and the early assembly. The major theme is: "The Gospel moves from Jerusalem to the nations."',
        'Before His ascension, Yahusha promised that the disciples would receive power from the Holy Spirit, enabling them to witness, teach, heal, establish communities and cross cultural boundaries.',
        'Pentecost marks the public beginning of the New Covenant community — divine empowerment, prophetic fulfilment, unity among nations and mission expansion.',
        'The first believers formed a community characterized by the teaching of the apostles, fellowship, prayer, sharing resources, worship and care for the needy. The assembly was not merely a religious gathering but a new covenant family.',
        'Peter became a major leader, demonstrating courageous preaching, healing ministry, defence of the faith and opening the door to Gentile inclusion. Stephen was one of the first servants appointed by the assembly; his martyrdom resulted in persecution, but persecution caused believers to spread into new regions — the mission of Yahuah advances even through difficulty.',
      ] },
      { heading: '14.7–14.9 Philip, the African connection, and Paul', body: [
        'The ministry of Philip includes one of the earliest recorded encounters between the Gospel and an African believer. Acts 8 describes Philip meeting an Ethiopian official. This account is significant because the Gospel reaches Africa early in the apostolic period, African participation in Christianity is part of the biblical story, and the message of Yahusha crosses ethnic and geographical boundaries.',
        'Paul became one of the most influential missionaries of the early assembly — evangelism, church planting, theological teaching and leadership development — travelling throughout Asia Minor, Greece, Macedonia and Rome.',
        'Paul understood mission as participation in Yahuah’s purpose to bless all nations, emphasizing the unity of Jews and Gentiles in Messiah, transformation through the Spirit, and the formation of mature communities.',
      ] },
    ] },
    { number: 15, title: 'Pentecost, Mission, Africa, and the Global Expansion of the Assembly', sections: [
      { heading: '15.1–15.3 Universal mission and early African Christianity', body: [
        'Before His ascension, Yahusha commissioned His disciples to make disciples among all nations — proclamation, teaching, baptism, discipleship and social transformation.',
        'Africa has a deep and ancient relationship with biblical faith: Abraham’s relationship with Egypt, Israel’s history in Egypt, prophetic references to African nations, the Ethiopian official in Acts, and early African Christian communities.',
        'Christian communities developed early in Egypt, North Africa and Ethiopia. Important African Christian traditions include Alexandrian Christianity, Coptic Christianity, Ethiopian Christianity and North African theological schools. African theologians contributed significantly to early Christian thought — Tertullian, Cyprian, Athanasius and Augustine.',
      ] },
      { heading: '15.4–15.5 Culture, identity and contextual theology', body: [
        'The early assembly demonstrated that the message of Yahusha was not restricted to one culture. The Gospel entered African, Asian, European and Middle Eastern cultures, each wrestling with the question: how can the eternal message of Yahuah be faithfully expressed within a particular culture?',
        'A major challenge for global Christianity is understanding the relationship between Scripture, culture, identity and history. Contextual theology asks how the Gospel speaks within different communities. African theology, Asian theology, Latin American theology and other contextual approaches seek to answer this question.',
      ] },
    ] },
  ],
  assessment: [
    { label: 'Assignment One — Prophetic Theology Research Paper', weight: '30%', detail: ['Historical background', 'Main message', 'Theological contribution', 'Contemporary relevance'] },
    { label: 'Assignment Two — Gospel Theology Essay', weight: '30%', detail: ['"The Identity and Mission of Yahusha the Messiah in the Four Gospels"'] },
    { label: 'Final Examination', weight: '40%', detail: ['Biblical history', 'Theological themes', 'Mission development', 'Scripture interpretation'] },
  ],
  reading: [
    'The Holy Scriptures',
    'George Eldon Ladd, A Theology of the New Testament',
    'N.T. Wright, Jesus and the Victory of Yahuah',
    'Craig Keener, The Historical Jesus of the Gospels',
    'F.F. Bruce, The Book of Acts',
    'Kwame Bediako, Theology and Identity',
    'Mercy Amba Oduyoye, Introducing African Women’s Theology',
    'Stephen Bevans, Contextual Theology',
  ],
};


export const bth104Material: CourseMaterial = {
  code: 'BTH104',
  title: 'Bible Doctrine I',
  subtitle: 'Foundations of Theology: Yahuah, Scripture, Creation, Humanity, Sin, and Redemption',
  ects: 5,
  // Reconciled: the development brief confirms BTH104 = Bible Doctrine I.
  conflictNote:
    'Reconciled as Bible Doctrine I. Two points outstanding: this document states Semester Two with BTH102 and BTH103 as prerequisites, while the structure places all three in Semester One; and its content overlaps BTH106 Bible Doctrine II, BTH206 Systematic Theology I and BTH309 Systematic Theology II.',
  units: [
    { number: 1, title: 'What is Theology?', sections: [
      { heading: '1.1–1.3 Definition, knowledge and purpose', body: [
        'The word theology comes from two Greek words: Theos (God) and Logos (word, study, reasoning or discourse). Theology therefore refers to the disciplined study of Yahuah and His relationship with creation. However, biblical theology is more than academic investigation: true theology involves knowing Yahuah, understanding His revelation, and responding in worship and obedience.',
        'Theology begins with Yahuah’s self-revelation. Human beings cannot discover Yahuah through human ability alone. Yahuah makes Himself known through creation, Scripture, history, covenant relationship, Yahusha the Messiah and the Holy Spirit.',
        'The purpose of theology is worship — the more humanity understands Yahuah, the greater the response of worship; transformation — true theology changes character, producing holiness, love, justice and compassion; and mission — understanding Yahuah’s purpose leads believers into participation in His mission.',
      ] },
    ] },
    { number: 2, title: 'Sources for Theological Reflection', sections: [
      { heading: '2.1–2.4 Scripture, tradition, reason and experience', body: [
        'The foundation of Christian theology is the written revelation of Yahuah found in Scripture, revealing who Yahuah is, His purposes, His covenant relationship and His plan of redemption. Scripture is not merely a historical document but a theological witness to Yahuah’s activity.',
        'Tradition includes early theological writings, creeds, confessions and interpretations of previous generations. Tradition can provide wisdom but must remain accountable to Scripture.',
        'Yahuah created humanity with the ability to think and reflect. Reason helps believers understand Scripture, answer questions and engage culture; however, human reasoning remains limited and must submit to divine revelation.',
        'Personal and communal experience — prayer, worship, spiritual transformation, mission experience — contributes to theological reflection, but must always be tested by Scripture.',
      ] },
    ] },
    { number: 3, title: 'Revelation and the Word of Yahuah', sections: [
      { heading: '3.1–3.5 General and special revelation, inspiration, authority, interpretation', body: [
        'General revelation refers to what Yahuah reveals through creation and human existence. Psalm 19 declares that creation reveals the glory of Yahuah; through creation humanity can recognize divine power, order and wisdom.',
        'Special revelation refers to Yahuah’s specific communication through Scripture, prophets and Yahusha the Messiah, providing knowledge of salvation, covenant and redemption.',
        'The doctrine of inspiration teaches that Scripture originates from Yahuah. The biblical writers wrote within their historical context, their language and their personality, yet Scripture communicates Yahuah’s intended message.',
        'Scripture possesses authority because its ultimate source is Yahuah, functioning as a guide for faith, a foundation for doctrine and a standard for ethical living. Interpretation requires careful attention to historical context, literary form, original language and theological purpose.',
      ] },
    ] },
    { number: 4, title: 'The Existence and Nature of Yahuah', sections: [
      { heading: '4.1–4.3 Reality, names and attributes', body: [
        'Biblical faith begins with the confession that Yahuah exists. The Scriptures do not begin by proving His existence but by declaring His reality: "In the beginning Yahuah created the heavens and the earth."',
        'Biblical names reveal character and identity. YHWH (Yahuah) reveals covenant faithfulness and eternal existence — self-existent, faithful, keeping His promises. Elohim emphasizes power, authority and Creator identity. Adonai expresses lordship, sovereignty and authority.',
        'The attributes of Yahuah describe His nature: eternal, existing beyond time with no beginning and no end; omnipotent, possessing unlimited power; omniscient, possessing complete knowledge; holy, absolute purity and uniqueness; just, acting according to perfect righteousness; loving, revealed through covenant, mercy and redemption; and faithful, remaining true to His promises.',
      ] },
    ] },
    { number: 5, title: 'The Triune Nature of Yahuah', sections: [
      { heading: '5.1–5.5 Father, Son and Spirit', body: [
        'Christian theology traditionally understands Yahuah as one divine being revealed as Father, Son and Holy Spirit. This doctrine is called the Trinity.',
        'Scripture teaches there is one Yahuah, yet also reveals that the Father acts as Yahuah, Yahusha the Messiah reveals divine identity, and the Holy Spirit acts with divine authority.',
        'The Father is revealed as Creator, covenant maker and source of redemption. Yahusha reveals Yahuah’s character and accomplishes redemption as Messiah, Redeemer, King and Mediator. The Spirit gives life, empowers believers, guides the assembly and transforms humanity.',
      ] },
    ] },
    { number: 6, title: 'Yahuah as Creator', sections: [
      { heading: '6.1–6.3 Creation, glory and humanity’s role', body: [
        'Genesis presents Yahuah as the Creator of all things. Creation is ordered, purposeful and good.',
        'Creation exists to reveal His wisdom, His power and His goodness.',
        'Human beings are created within creation but given a unique responsibility: to steward creation, cultivate the earth and reflect Yahuah’s character.',
      ] },
    ] },
    { number: 7, title: 'The Creation and Identity of Humanity', sections: [
      { heading: '7.1–7.4 Imago Dei', body: [
        'Genesis 1:26–27 states that humanity was created in the image and likeness of Yahuah — one of the most important foundations of biblical anthropology. It answers fundamental questions: who are human beings? what is the purpose of human existence? what gives humanity dignity? what responsibility does humanity have toward creation and one another?',
        'Biblical anthropology does not define humanity primarily through race, wealth, social status, political power, education or physical ability. Instead, human identity begins with relationship to the Creator.',
        'Imago Dei does not mean that human beings physically resemble Yahuah. Rather, humanity reflects Yahuah through moral responsibility, spiritual capacity, relational ability, creative activity and stewardship authority. The image represents a visible representation or reflection; likeness emphasizes similarity and relationship.',
        'In the ancient world, kings placed images of themselves in territories to represent their authority. Genesis presents humanity as representatives of the King of the universe, called to exercise responsible authority, care for creation, establish justice and reflect divine character.',
      ] },
    ] },
    { number: 8, title: 'Human Dignity, Race, and Identity', sections: [
      { heading: '8.1–8.4 Unity, Africa, racism and the Kingdom', body: [
        'The biblical account teaches that all humanity originates from Yahuah. Therefore, every person possesses dignity because they bear the image of Yahuah. Human value is not determined by ethnic background, nationality, social position or economic status.',
        'A biblical theology of humanity must recognize the importance of Africa within the biblical story: Egypt as a major civilization connected to Israel’s history, African nations appearing in prophetic writings, the Ethiopian official receiving the Gospel in Acts, and early African participation in Christian history. African theological reflection has often emphasized community, relationship, human dignity and the interconnectedness of life.',
        'Racism contradicts the doctrine of the image of Yahuah because it denies the equal dignity given by the Creator. A biblical understanding of humanity rejects systems that dehumanize people, create superiority and inferiority based on ethnicity, or exploit others. The Gospel announces reconciliation among peoples through Yahusha the Messiah.',
        'The Kingdom of Yahuah restores the dignity damaged by sin. The mission of the assembly includes defending human dignity, pursuing justice, caring for vulnerable people and proclaiming reconciliation.',
      ] },
    ] },
    { number: 9, title: 'Gender, Community, and Relationship', sections: [
      { heading: '9.1–9.4 Relational beings, male and female, African women’s theology, gender justice', body: [
        'Humanity was not created for isolation. Genesis declares: "It is not good that humanity should be alone." Human beings are created for relationship with Yahuah, relationship with others, and community life.',
        'Genesis teaches that both male and female are created in the image of Yahuah. Therefore both possess equal dignity, both participate in Yahuah’s purposes, and both have spiritual value.',
        'African women’s theology has contributed important reflections on the experience of women in African communities, the relationship between faith and culture, and the dignity of women before Yahuah. The work of theologians such as Mercy Amba Oduyoye highlights the importance of listening to voices that have historically been marginalized.',
        'The assembly is called to demonstrate the values of the Kingdom through respect, justice, service and mutual responsibility.',
      ] },
    ] },
    { number: 10, title: 'Disability Theology and the Image of Yahuah', sections: [
      { heading: '10.1–10.4 Dignity, Scripture, the assembly and inclusion', body: [
        'A biblical understanding of humanity must include persons with disabilities. Because every person bears the image of Yahuah, disability does not diminish human value.',
        'The Scriptures reveal Yahuah’s concern for those who experience physical limitation, social exclusion and economic vulnerability. Yahusha’s ministry repeatedly included healing and restoration.',
        'The assembly must not view persons with disabilities as objects of charity only. They are full members of the covenant community, bearers of Yahuah’s image, and participants in ministry.',
        'A biblical community should remove barriers that prevent participation: physical accessibility, social acceptance, leadership opportunities and recognition of spiritual gifts.',
      ] },
    ] },
    { number: 11, title: 'The Fall of Humanity and the Corruption of the Image', sections: [
      { heading: '11.1–11.4 Sin, the fall, its nature and original sin', body: [
        'The biblical doctrine of sin explains the broken condition of humanity. Sin is not merely wrong actions; it represents rebellion against Yahuah, broken relationship and distortion of human identity.',
        'Genesis three describes humanity’s disobedience, with consequences of separation from Yahuah, shame, death, conflict and corruption of creation.',
        'Sin affects every dimension of human existence. Spiritually it separates humanity from fellowship with Yahuah. Morally it corrupts human choices and desires. Socially it produces violence, oppression and injustice. In creation it damages humanity’s relationship with the earth.',
        'Christian theology uses the term "original sin" to describe humanity’s inherited condition of brokenness: humanity enters a world already affected by the consequences of Adam’s rebellion.',
      ] },
    ] },
    { number: 12, title: 'Evil, Suffering, and the Problem of Humanity', sections: [
      { heading: '12.1–12.3 The reality of evil and the biblical response', body: [
        'The existence of evil raises important theological questions: why does suffering exist? why do innocent people suffer? how can Yahuah remain good in a broken world?',
        'Theology commonly distinguishes moral evil — caused by human choices such as violence, corruption and exploitation — from natural evil, the suffering connected to the broken condition of creation such as disease, natural disasters and death.',
        'The biblical response is not denial of suffering but the promise of redemption. Yahuah acts through covenant faithfulness, prophetic hope, Yahusha’s victory and final restoration.',
      ] },
    ] },
    { number: 13, title: 'Salvation in the Purpose of Yahuah', sections: [
      { heading: '13.1–13.3 Meaning, Old Testament and fulfilment', body: [
        'Salvation means deliverance and restoration. Biblical salvation includes forgiveness, reconciliation, transformation and restoration of creation.',
        'The Old Testament reveals salvation through deliverance from Egypt, covenant promises, sacrificial worship and prophetic hope.',
        'The New Testament presents Yahusha as the fulfilment of Yahuah’s salvation plan. Through Him sin is forgiven, humanity is reconciled, and new life begins.',
      ] },
    ] },
    { number: 14, title: 'Covenant Theology', sections: [
      { heading: '14.1–14.2 Meaning and the major covenants', body: [
        'A covenant is a relationship established by commitment and promise. Biblical covenants reveal Yahuah’s desire to relate with humanity.',
        'The Noahic Covenant is Yahuah’s promise to preserve creation. The Abrahamic Covenant is His promise to bless nations through Abraham’s seed. The Mosaic Covenant is His covenant relationship with Israel through Torah. The Davidic Covenant is His promise of an everlasting kingdom. The New Covenant is fulfilled through Yahusha the Messiah.',
      ] },
    ] },
    { number: 15, title: 'Redemption and the Restoration of Creation', sections: [
      { heading: '15.1–15.3 Beyond individual salvation, creation care, new creation', body: [
        'Biblical redemption includes more than saving individuals. Yahuah’s purpose includes restoration of humanity, relationships, communities and creation itself.',
        'Because humanity was created to steward creation, believers have responsibility toward the earth. Ecotheology emphasizes environmental responsibility, justice, sustainable living and care for Yahuah’s creation.',
        'The biblical story ends not with escape from creation but with restoration. Revelation presents renewed creation, restored relationship with Yahuah, and justice and peace.',
      ] },
    ] },
  ],
  assessment: [
    { label: 'Assignment One — Doctrine of Humanity Essay', weight: '30%', detail: ['"Humanity Created in the Image of Yahuah: A Biblical Response to Human Dignity, Racism, Disability, and Social Injustice"'] },
    { label: 'Assignment Two — Covenant Theology Research Paper', weight: '30%', detail: ['"From Abraham to Yahusha: The Development of Yahuah’s Covenant Purpose in Scripture"'] },
    { label: 'Final Examination', weight: '40%', detail: ['Biblical doctrine', 'Systematic theology', 'Application to ministry'] },
  ],
  reading: [
    'The Holy Scriptures',
    'Wayne Grudem, Systematic Theology',
    'Millard Erickson, Christian Theology',
    'Stanley Grenz, Theology for the Community of Yahuah',
    'Stephen Bevans, Contextual Theology',
    'Kwame Bediako, Theology and Identity',
    'Mercy Amba Oduyoye, Introducing African Women’s Theology',
    'Catherine Keller, God and Creation',
  ],
};

export const courseMaterials: CourseMaterial[] = [bth101Material, bth102Material, bth103Material, bth104Material];
