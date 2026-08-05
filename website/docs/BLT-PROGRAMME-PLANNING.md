# M.A. Black Liberation Theology — internal planning note

**Status: internal. Not published. No route renders this file.**

This is working advice to the university about how to structure the degree. It
is written in the second person, addressed to the institution, and reads as a
proposal rather than as a description of something already in place. Publishing
it on the prospectus would tell prospective students that the programme's shape
is still being decided.

The *substance* of the recommendation — the five pillars — has been carried
onto the public page as the programme's organising framework, stated in the
present tense. The advisory framing around it has not.

---

## Recommendation as received

To establish the programme as academically distinctive, consider organizing it
around five theological pillars that run through every course:

1. **Biblical Theology** — Interpreting Scripture within its historical and
   literary contexts.
2. **Historical Theology** — Examining the development of doctrine and the role
   of Africa and Black communities in Christian history.
3. **Systematic Theology** — Formulating coherent doctrines centered on Yahuah,
   Yahusha, humanity, salvation, and the Assembly.
4. **Black Liberation Theology** — Addressing identity, justice, liberation, and
   the historical experiences of Black people through a theological lens.
5. **Applied Theology** — Equipping graduates to engage in ministry, education,
   public leadership, reconciliation, and social transformation.

This structure gives the degree the breadth expected of a master's programme
while making Black Liberation Theology its distinctive organizing framework
rather than simply one subject among many.

---

## Decision needed from the university

The five pillars are presented publicly as fact — "five pillars run through
every course". If the university has **not** adopted this structure, say so and
the pillars section comes off the public page in one edit
(`src/app/black-liberation-theology/page.tsx`, the "Five Pillars" section, and
`bltPillars` in `src/content/blackLiberationTheology.ts`).

## Where each piece of the programme lives

| Material | Location | Visibility |
|---|---|---|
| Philosophy, overview, aims | `blackLiberationTheology.ts` | Public |
| Course codes, titles, topics | `blackLiberationTheology.ts` | Public |
| Electives, practicals, outcomes | `blackLiberationTheology.ts` | Public |
| Five pillars | `blackLiberationTheology.ts` | Public — pending confirmation |
| Suggested core textbooks | `programmeResources.ts` | **Portal only** |
| This memo | `docs/` | **Never rendered** |
