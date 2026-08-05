# Institutional documents — plan, and what only the university can supply

Internal note. **Not rendered anywhere on the site.** No route imports this file.

The university set out fifteen documents an established institution is expected
to hold, and a twelve-step order for producing them. This note records how that
programme is being built, what has been done, and — the part that matters — the
decisions that must come from the university before the rest can be written.

The public face of this is `/documents`, which is generated from
`src/content/institutionalDocuments.ts`. Seventeen entries: the fifteen the
university listed, plus Faculty Handbooks and Digital Campus, which appeared in
the list of fifteen but not in the twelve-step order.

---

## 1. The rule this programme is built on

**A governance document takes effect when a body adopts it, not when it is
written well.** Statutes, degree classifications, examination regulations,
assessment moderation, degree award powers and financial governance are
instruments. Their authority comes from the Board of Trustees, the Senate or
the Academic Board resolving to adopt them.

Drafting plausible text for any of these and publishing it under the
university's name would misrepresent the university's own rules to the people
most entitled to rely on them: a student facing an examination board, and a
reviewer from the Ministry. It would also be the single fastest way to fail an
accreditation visit, because the first question asked of any such document is
*when was this adopted, and by whom*.

So the register shows status honestly, and every unwritten document carries the
list of decisions needed and the body that must take them. The work of
producing each one is then a short list rather than a blank page.

## 2. Done — step 1 of the university's order

**The Academic Catalog** is live at `/academic-catalog`, in twelve parts.

It is **assembled, not authored**. Every section reads from the same content
module the corresponding public page reads from, so the catalog cannot drift
out of step with the site — add a programme and the catalog gains it. Nothing
is retyped.

| Part | Source | State |
|---|---|---|
| I Welcome | `welcome.ts` — Chancellor's address in full, Vice Chancellor | VC address missing |
| II The University | `about`, `site`, `chancellorBio` | complete |
| III Governance | `leadership`, `administration` rosters | statutory bodies missing |
| IV Faculties and Schools | `facultyList` | complete |
| V Academic Calendar | — | **entirely missing** |
| VI Admission Requirements | `admissions`, `degreeLevels[].requirements` | complete |
| VII Tuition, Fees, Scholarships | `tuition`, scholarships page | refund policy missing |
| VIII Student and Examination Regulations | `policies` page | **examination regulations missing** |
| IX Academic Integrity and Research Ethics | `policies` page | ethics procedure missing |
| X Student Services | portal, campus life | library and ICT missing |
| XI Quality Assurance | accreditation fact only | framework missing |
| XII Programmes and Course Descriptions | `programs`, `courses` | credit values missing |

Ten sections carry an "In preparation" notice naming exactly what is required
and, where relevant, which body must adopt it.

**It exports as a PDF.** Print the page and choose "Save as PDF" — the print
stylesheet drops the site chrome, forces a page break before each part, keeps
headings with their content and tables unsplit, and forces `Reveal`-animated
blocks visible so nothing below the fold prints blank. Verified: 30 pages.

## 2a. Done — steps 3 and 4, plus the regulations

**Academic Regulations** (`/academic-regulations`) — the grading scale, special
grades, course classification, GPA rule, study loads and seminar requirements
by level, doctoral entry standard, assessment weightings, the full fee terms,
the miscellaneous fee schedule, sponsor terms, withdrawal rules and the refund
schedule. All supplied by the university and reproduced exactly.

**University Prospectus** (`/prospectus`) — nine parts, assembled like the
catalog. Leads with the Yeshiva style of learning, which is the one thing here
no competing institution can claim.

**Student Handbook** (`/student-handbook`) — nine parts. Rights and
responsibilities are stated in one place for the first time, each traceable to
a commitment the university had already made somewhere else.

**Course lists with codes** — the Diploma of Theology (15 courses, complete)
and the Bachelor of Theology credit-hour structure (Years One and Two,
87 credit hours) now render on their programme pages.

## 2b. Eight errors found in the source documents

Recorded on `/academic-regulations` Part VIII rather than silently corrected,
because correcting a regulation is the university's act. The two that matter
most:

- **§1.9 of the Fees Guide is headed "Cost of Doctorates and PhDs at GRU
  UNIVERSITY".** GRU is not ICOF. The section appears adapted from another
  institution's document with the name left in. The heading is not reproduced
  on this site; the body is, because it reads as ICOF policy throughout.
- **Two incompatible B.Th. structures.** 36 courses × 5 ECTS = 180 ECTS, versus
  Years One and Two in credit hours totalling 87. ECTS and credit hours are not
  interchangeable. Both are recorded, neither converted — an invented
  conversion is the one number a credential evaluator would reject.

Also recorded: the Fees Guide is marked "Preliminary Copy"; the DBA fee is
quoted with no currency for a year commencing 2016; tuition is USD on the site
and FCFA in the Fees Guide; the grading scale has no 3.67 point; B+ spans only
two percentage points; degree classification bands are still missing; and the
doctoral seminar totals imply two years without saying so.

## 3. The five things blocking most of the rest

Almost every remaining document waits on one of these. They are listed in the
order that unblocks the most work:

1. **The academic calendar.** Term dates, registration windows, examination
   periods, graduation dates. Blocks: Catalog Part V, every faculty handbook,
   every programme handbook.
2. **Examination and award regulations.** The marking scale and pass mark are
   now published. Still missing: examination entry conditions, conduct,
   absence, resit and when a supplementary examination is granted; **degree
   classification bands**; credit minimums and residency per award; and the
   appeal route. Degree classification is now the single largest gap — the
   university can grade a course but cannot yet say what class of degree a
   given GPA earns.
3. **Course lists and credit values** for the eleven awards written up in
   `FACULTY-PAGES.md` §3a. Blocks: all programme handbooks, Catalog Part XII.
4. **The quality assurance framework.** Programme approval route, review
   cycles, whether external examiners are appointed. Blocks: the QA Manual, and
   it is the document an accreditation body reads most closely.
5. **Adoption of the Statutes** by the Board of Trustees. Blocks: the Statutes
   themselves and Catalog Part III's governance section.

## 4. What can be built without waiting

- **University Prospectus** (step 3). Mostly assembly, like the catalog —
  faculties, programmes, campuses, admissions and scholarships all exist. Needs
  accommodation detail, alumni profiles the university will name, and
  print-resolution photography.
- **Student Handbook** (step 4). The code of conduct, disciplinary process and
  due process already exist and can be lifted. Needs the attendance policy, the
  complaints procedure, and a decision on whether a dress code and a student
  government exist.
- **Faculty Handbooks.** The dean's welcome, research strengths and graduate
  destinations are published for all five faculties. Needs practicum hours,
  ministry requirements and whether chapel attendance is compulsory.

## 5. What was deliberately not done

- **Twenty-one research centres** were proposed across four faculties. None is
  published. A centre with no director and no researchers is a heading, and
  publishing it as a research unit would not survive the first question asked
  about it. Confirm a director for any centre and it goes up.
- **Six research journals** were proposed by title. A journal is its editorial
  board, its ISSN and its peer review policy — not its title. Registered in the
  register, not announced.
- **Academic departments** for the Faculty of Theology — the university's own
  wording was "the Faculty *may* be organised into departments such as…". See
  `FACULTY-PAGES.md` §3.
- **A "Download Prospectus" button.** There is no prospectus file. The catalog
  is downloadable because printing it produces a real document; a button that
  404s is worse than no button.

## 6. Where the register lives

`src/content/institutionalDocuments.ts`. To move a document forward: add its
`href` when a route exists, change `status`, and strike items off `needs` as
the university supplies them. The counts on `/documents` derive from the array,
so the page updates itself.
