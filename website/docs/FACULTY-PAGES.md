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

Putting the two lists side by side surfaced five things that need a decision:

1. **"Diploma through Ph.D." vs the Certificate rung.** The supplied About text
   says the Faculty "offers programmes from Diploma through Doctor of
   Philosophy (Ph.D.)". But the recovered content lists a Certificate of
   Theology, `CERT-TH` is in the course catalogue, and the faculty's older
   description read "certificate through to doctorate". The ladder therefore
   opens with a Certificate rung that the About paragraph appears to deny.
   **Which is right — does the Faculty award at certificate level or not?**
2. **Black Liberation Theology is missing from the declared award list.** It is
   in the catalogue, it has its own page, and it is described elsewhere as
   pioneered at ICOF. The ladder still shows it. Should it be added to the
   Faculty's official award list, or has it moved?
3. **Divinity vs Bachelor of Ministry.** The catalogue has a bachelor's in
   "Divinity"; the declared list has a "Bachelor of Ministry (B.Min.)". These
   may be the same award under two names, or two awards. They are shown
   separately because merging them would be a guess.
4. **Doctor of Theology (D.Th.)** is in the course catalogue and named on the
   doctoral degree page, but not in the declared list, which names only the
   D.Min. and the Ph.D.
5. **Three awards have no curriculum:** Diploma in Christian Leadership,
   Bachelor of Ministry, Master of Arts in Christian Leadership. Plus Diploma
   in Ministry, confirmed earlier but still without a course list.

## 5. Still outstanding

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
