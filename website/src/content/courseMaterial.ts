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
  title: 'Biblical Studies I: Old Testament Survey',
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

export const courseMaterials: CourseMaterial[] = [bth101Material, bth102Material];
