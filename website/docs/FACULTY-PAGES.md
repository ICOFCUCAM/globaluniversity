# Faculty pages — what is data, what is editorial, what is still missing

Internal note. **Not rendered anywhere on the site.** No route imports this file.

The five faculty pages at `/faculty` and `/faculty/[slug]` are built from data
that already existed in the repository plus the institutional copy the
university supplied. This document records what is *not* derived — so the
university can see exactly what it is being asked to confirm, and nothing is
mistaken for an official statement that never was one.

---

## 1. Page structure

Every faculty page follows the same order. A section with no content behind it
does not render at all, so no faculty shows an empty heading:

| # | Section | Source | Who has it |
|---|---|---|---|
| 1 | Hero banner | `name`, `standsFor`, `image`, `campus` | all 5 |
| 2 | Action bar — Apply, Entry Requirements, Contact | fixed routes | all 5 |
| 3 | Stat band — programmes, courses, online, research areas | counted at build time | all 5 |
| 4 | Two-campuses notice | `sharesProvisionWith` | Theology ×2 |
| 5 | Dean's Welcome | `deansMessage` + roster photo | all 5 |
| 6 | About the Faculty | `about` ?? `description` | all 5 |
| 7 | Purpose, vision and values | `standsForBody`, `pillars`, `vision`, `mission`, `coreValues` | all 5 (Theology has all five fields) |
| 8 | Why Study With Us | `whyStudy` | Theology |
| 9 | Programmes Offered — the ladder | `awards` ∪ `programs` | all 5 |
| 10 | Degree Programmes — cards | `programs` | all 5 |
| 11 | Degrees band | `degrees` | Theology ×2 |
| 12 | Research Strengths | `researchStrengths` | all 5 |
| 13 | Course Catalogue | `courses` | all 5 |
| 14 | Student Experience · Partnerships | `studentExperience`, `partnerships` | Theology |
| 15 | Careers and graduate destinations | `careers`, `graduateDestinations`, `postgraduateNote` | all 5 |
| 16 | Contact | `campus` + shared `contact` | all 5 |
| 17 | Other faculties | derived | all 5 |

The join between faculties, programmes and courses carries **both** naming
spellings (`programSchool` and `courseFaculty`) because three naming systems
disagreed in the source data. Nothing had to be renamed and no existing link
broke. See the header comment in `faculties.ts`.

## 2. Provenance

**Supplied by the university, verbatim:** every dean's message, every "what we
stand for" statement, the pillars, research strengths and graduate
destinations for all five faculties — and for Theology also the About prose,
Vision, Mission, Core Values, Why Study, declared award list, Student
Experience, Partnerships and Careers.

**Recovered from the original site:** names, campuses, photographs, the
administration and lecturer rosters, the programme and course catalogues.

**Derived at build time:** all four figures in the stat band, the programme
cards, the course list, the ladder, and the "N areas of active research" and
"N courses in this faculty" headings. Adding a programme updates the page by
itself; none of these numbers can go stale.

**Editorial, written for this site:** the `description` paragraphs, which now
only appear on faculties that have not supplied an `about`. Theology has, so
Theology no longer shows any editorial prose.

## 3. Not published, deliberately

The university's material proposed two things it did not assert as fact, and
both are held back until confirmed:

- **Academic departments.** "The Faculty **may** be organised into academic
  departments such as: Biblical Studies, Systematic Theology, Historical
  Theology, Practical Theology, Missiology and World Christianity, Christian
  Education, Pastoral Counselling, Leadership and Ministry Studies."
- **Research centres.** "Research Centres (**Recommended**)" — Centre for
  African Theology and World Christianity, Centre for Biblical Research,
  Centre for Contextual Theology, Centre for Peace, Justice and
  Reconciliation, Centre for Digital Ministry and Artificial Intelligence,
  Centre for Leadership and Public Theology, Centre for Mission Studies,
  Centre for Ecotheology and Creation Care.

A prospective student reading a department list or a centre list has no way to
tell a proposal from an existing structure. Confirm either and it goes on the
page the same day.

## 3a. Content drafted for this site, awaiting faculty sign-off

The university asked for the missing awards to be separated out and written up.
The following programme summaries and learning outcomes were **drafted here**,
not supplied by the faculty, and should be reviewed before the site goes live:

| Award | Page |
|---|---|
| Certificate of Christian Education | `/programs/certificate-in-christian-education` |
| Diploma in Christian Leadership | `/programs/diploma-in-christian-leadership` |
| Bachelor of Divinity | `/programs/divinity` (rewritten) |
| Bachelor of Ministry | `/programs/bachelor-of-ministry` |
| Bachelor of Christian Education | `/programs/bachelor-of-christian-education` |
| Master of Divinity | `/programs/master-of-divinity` |
| Masters in Evangelism and Mission | `/programs/masters-evangelism-mission` |
| Master of Arts in Christian Leadership | `/programs/master-of-arts-christian-leadership` |
| Doctor of Philosophy in Theology | `/programs/doctor-of-philosophy-theology` |
| Doctor of Theology | `/programs/doctor-of-theology` |
| Doctor of Ministry | `/programs/doctor-of-ministry` |

Each carries a one-paragraph summary and four learning outcomes — the shape of
the award, not a curriculum. **No course lists, credit values or durations have
been invented.** Those must come from the faculty.

**Divinity and Ministry are held apart deliberately**, on the university's
instruction that they are separate awards. Throughout, Divinity is the
theological route — biblical languages, exegesis, systematic doctrine, leading
toward ordination and scholarship — and Ministry is the practical route —
preaching, pastoral care, administration, mission, with supervised placement,
for those already serving. Each page states the distinction explicitly so the
two cannot be read as the same degree renamed.

## 4. The ladder, and the discrepancies it exposed

Section 9 shows one numbered rung per level the faculty awards at. Each rung is
the **union** of what the faculty declares (`awards`) and what the catalogue
holds (`programs`), so neither source can silently drop an award the other
knows about. Duplicates are removed by title *and* by target page — several
catalogue entries are umbrellas, and without the second test the M.Div would
appear once by name and again inside "Ministry".

Awards the faculty declares but which have no programme record yet render as
dashed chips reading **"Details to follow"** rather than as dead links, and the
page states how many there are.

Putting the two lists side by side surfaced five discrepancies. The university
has now resolved all five:

1. **Certificate level — confirmed.** The Faculty does award at certificate
   level. The supplied About text read "from Diploma through Doctor of
   Philosophy"; "Diploma" was corrected to "Certificate" there and in the
   matching `whyStudy` line. Those are the **only two edits made to any copy
   the faculties sent.**
2. **Black Liberation Theology — added** to the declared award list as the
   Master of Arts in Black Liberation Theology.
3. **Divinity and Ministry are separate awards** at every level, not two names
   for one degree. See §3a for how the distinction is drawn.
4. **Doctor of Theology — added** to the declared list alongside the Ph.D. and
   the D.Min.
5. **All eleven previously undescribed awards now have pages.** Nothing renders
   as "Details to follow" any more. The chip state remains in the component for
   the next award declared before it is written up.

Both umbrella entries were split as a consequence. "Ministry" had stood for the
M.Div and the Masters in Evangelism and Mission at once, and "Theology" for the
Ph.D., the D.Th. and the D.Min. `/programs/ministry` and `/programs/theology`
were live routes and are in the sitemap, so both redirect permanently (301) to
the award each was named for — see `next.config.mjs`.

The Faculty of Theology now holds **sixteen programmes across five levels**, up
from six across three.

## 5. Still outstanding

- **Certificate of Arts, Certificate of Science, Bachelor of Arts, Bachelor of
  Science.** These four appear in the recovered content and are still listed on
  `/degrees/certificates` and `/degrees/bachelors-degrees`, but they are *not*
  in the Faculty of Theology's award list and have no programme page. Unlike
  the eleven awards written up in §3a, there was nothing to write from: an
  "Arts" or "Science" award inside a theology faculty could mean almost
  anything, and guessing a whole field is different in kind from describing the
  shape of a named degree. **Tell me what each covers and I will write them.**
  Until then the faculty ladder shows two certificate awards while the
  certificates page lists four — a visible mismatch, left visible on purpose.
- **Course lists for the eleven new awards.** Every page states the shape of
  its award and four learning outcomes. None states a course list, credit
  value or duration, because none was supplied.
- **Prospectus PDF.** The proposed hero included a "Download Prospectus"
  button. No prospectus file exists, so no button was added — a download that
  404s is worse than no download. Supply the PDF and the button appears.
- **Academic staff per faculty.** The lecturer roster carries no faculty tag,
  so a faculty page cannot list its own teaching staff. It shows the dean and
  links to the full roster. Tag the roster and the section can be built.
- **News & Events, Research Publications, FAQs.** Three sections of the
  proposed structure that no faculty has content for. `/news` and `/events`
  exist university-wide but nothing is faculty-tagged.
- **Certificate awards on the HND page.** `/degrees/higher-national-diploma-hnd`
  lists *Certificate of Christian Education, of Arts, of Theology and of
  Science* under Faculty of Theology. Those are certificate names on an HND
  page. Verified against the recovered `wpst_posts` export: the original site
  had it this way. Left **exactly as recovered** rather than rewritten on a
  guess; the same four now also appear on `/degrees/certificates`.
- **Buea and Douala.** The university confirmed the two campuses share their
  materials, recorded via `sharesProvisionWith`. Both pages show identical
  programmes and courses and each says so. If provision ever diverges, remove
  the field and give Douala its own `programSchool`.
