# Faculty pages — what is data, what is editorial, what is still missing

Internal note. **Not rendered anywhere on the site.** No route imports this file.

The five faculty pages at `/faculty` and `/faculty/[slug]` are built almost
entirely from data that already existed in the repository. This document
records the three things that are *not* — so the university can see exactly
what it is being asked to confirm, and nothing is mistaken for an official
statement that never was one.

---

## 1. Where each piece of a faculty page comes from

| On the page | Source | Status |
|---|---|---|
| Name, campus, photograph | `src/content/faculties.ts` | Recovered from the university's own site |
| Programme cards | `src/content/site.ts` → `programs`, joined on `programSchool` | Derived — never typed on the page |
| Course list | `src/content/courses.ts`, joined on `courseFaculty` | Derived |
| Stat band (programmes / courses / online / degree routes) | Counted at build time | Derived — cannot go stale |
| Study pathway ladder | Grouped from the same programme records | Derived |
| Director | `administration` roster, matched by name | Recovered |
| `standsFor` and `description` | Written for this site | **Editorial — replace with the faculty's own words** |

The join carries **both** naming spellings (`programSchool` and
`courseFaculty`) because three naming systems disagreed in the source data.
Nothing had to be renamed and no existing link broke. See the header comment
in `faculties.ts`.

## 2. Copy the university should replace

The `standsFor` line and the `description` paragraphs on each of the five
faculties are editorial summaries of provision that is already published
elsewhere on the site. They are accurate but they are not the faculty's voice.
Each faculty should supply its own:

- a one-line statement of what the faculty is for (`standsFor`)
- two or three paragraphs of description
- a dean's or director's message
- research strengths
- where graduates go

The last three have no field yet; they are the natural Phase 4 of these pages.

## 3. The study pathway ladder, and what it exposed

Each faculty page shows a numbered ladder — one rung per award level the
faculty actually teaches at, built by grouping that faculty's programmes by
`level`. A level with no programme behind it does not appear, so the ladder can
never claim provision that does not exist.

Building it made a real gap visible. The Faculty of Theology's own description
has always read "certificate through to doctorate", but the catalogue held only
Bachelor, Master and Doctorate entries. Two rungs were missing:

- **Diploma in Theology** — the university's full introduction to this award
  was already published on `/degrees/diploma-dip`, with no award behind it to
  point at. On the original WordPress site the Diploma page carried a "Faculty
  of Theology" tab that was **empty**; the gap is inherited, not new.
- **Certificate in Theology** — `CERT-TH` existed in the course catalogue and
  the four certificate awards were listed in the recovered content, but no
  programme record carried them.

Both are now in `programs`, and the Diploma and Certificates degree-level pages
list the Faculty of Theology alongside the other faculties.

## 4. Open questions for the university

1. **Diploma in Ministry.** Confirmed by the university as an existing award
   and now listed, but the faculty has not supplied its course list, credit
   value or duration. Nothing beyond the shape of the award is stated on the
   site. Please supply the curriculum, or say if the award should be withdrawn.
2. **Certificate awards on the HND page.** The recovered content lists
   *Certificate of Christian Education, of Arts, of Theology and of Science*
   under Faculty of Theology on `/degrees/higher-national-diploma-hnd`. Those
   are certificate names on a Higher National Diploma page. This looks like an
   error on the original site. It has been left **exactly as recovered** rather
   than silently rewritten, and the same four awards are now also listed on
   `/degrees/certificates`. Please confirm whether the HND entry should be
   removed, or whether the faculty genuinely awards an HND and its titles are
   simply missing.
3. **Ministry below Master level.** Ministry now runs Diploma → Master →
   Doctorate. Whether a Certificate in Ministry and a Bachelor in Ministry also
   exist is unknown; nothing in the recovered content attests to either, so
   neither has been invented.
4. **School of Theology, Douala.** The university confirmed the two campuses
   share their materials, and this is recorded via `sharesProvisionWith`. Both
   pages therefore show identical programmes and courses and each says so
   plainly. If provision ever diverges, remove the field and give Douala its
   own `programSchool` value.
