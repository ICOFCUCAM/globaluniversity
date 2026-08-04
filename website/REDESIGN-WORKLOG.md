# World-Class Redesign — Autonomous Worklog

Mandate: elevate the ICOF Global University platform to top-tier
international university standard (MIT/Oxford class). Up to 100 commits,
push every ~10. Preserve all real institutional facts (names, programs,
contacts, history, accreditation); elevate design, content and UX around
them. Never fabricate rankings or named alumni; recognition = real
accreditation + ICOF global network.

## Design system (decided)
- Typography: Fraunces (serif display, institutional) via next/font as
  `--font-display`; Inter as `--font-sans` body. font-heading → serif.
- Palette stays purple #422e59 / gold #f7dc79 heritage; add tonal ramps
  (purple 50-950) and `ink`/`paper` neutrals in tailwind config.
- Rhythm: sections py-20/28, max-w-7xl, eyebrow labels (small caps gold),
  serif display headings, 65ch body measure.
- Motion: Reveal component (IntersectionObserver, fade-up, respects
  prefers-reduced-motion); subtle hover lifts; no gimmicks.
- Components: Button (primary gold / outline / ghost), Eyebrow,
  SectionHeading (serif + rule), Stat, CardLink.

## Phases / checklist
- [x] 1. Worklog + plan committed
- [x] 2. Fonts via next/font + tailwind tonal ramps + base styles
- [x] 3. Core UI kit: Button, Eyebrow, Reveal, refreshed Section/SectionHeading
- [x] 4. Header: utility audience bar (Prospective / Current / Alumni /
        International), refined mega-dropdowns, skip-link
- [x] 5. Footer: audience columns (Study, Research, Community, Contact) — done in 4
- [x] 6-9. Homepage full redesign, top-university section order:
        Hero (cinematic) → Overview → Why IGUC →
        Schools & Faculties → Programs → Research & Innovation (Dissertation
        Council, PPDI-RC) → Admissions → International Students → Online
        Learning → Campus Life → Success (real stats) →
        Recognition (accreditation) → News → CTA (events/partners live on
        their own pages; quick-links bar retained)
- [x] 10. Push batch 1 (commits 1-9)
- [x] 11. /research page (Dissertation Council, PPDI-RC, theology research,
        grounded content)
- [x] 12. /international page (bilingual Cameroon, ICOF worldwide network,
        visa/English requirements from admissions data)
- [x] 13. /scholarships page (real: scholarships exist per tuition FAQ;
        Support the Called program)
- [ ] 14. /governance + /accreditation pages (real administration,
        Ministry of Higher Ed) — deferred (roster on /faculty, accreditation on /about)
- [x] 15. /careers + /lifelong-learning (PPDI-RC framing)  → /lifelong-learning done; careers deferred
- [x] 16. Page-level polish pass: degree/content pages with new system — inherited via Section/SectionHeading/Cta/PageBanner refresh
- [x] 17. A11y: skip link, focus-visible, aria-expanded on menus,
        contrast audit (done in 4; contrast via darker gold-deep #b8860b tokens where needed)
- [x] 18. SEO: BreadcrumbList JSON-LD on program pages (via layout), per-page
        descriptions audit (new pages all have metadata)
- [x] 19. Perf: image `sizes` on grids (key grids), fewer layout shifts (aspect ratios), build check
- [x] 20. Push batch 2 (commits 10-19) — pushed to branch + main
- [ ] 21+. Portal design polish (Sidebar/TopBar brand alignment), further
        content depth per section, mobile nav refinement.

Keep commits small; build must pass before each commit.
