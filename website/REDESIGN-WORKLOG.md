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
- [x] 21. Premium CTA band + cinematic PageBanner (batch 3)
- [x] 22. Contact page cards; portal indigo→purple rebrand (batch 3)
- [x] 23. Program detail redesign + Course JSON-LD + related strip (batch 4)
- [x] 24. Events calendar-leaf badges + Event JSON-LD; Breadcrumb JSON-LD (batch 4)
- [x] 25. Catalog quick filters (batch 5)
- [x] 26. Portal blue/indigo sweep; mobile slide-over drawer (batch 6)
- [x] 27. Global positioning: footprint section, header tagline, multi-currency
        fees, Alumni page (batch 7)
- [x] 28. Login hero IGUC identity + real figures; Governance page (batch 8)
- [x] 29. Perf: AVIF/WebP formats, 30-day image cache (batch 9)

## Remaining (next runs)
- [ ] French-language track (next-intl, /fr routes) — largest remaining item
- [ ] Portal dashboard micro-polish (charts palette, empty states)
- [ ] News/publications archive page fed from a CMS-ready list
- [ ] Lighthouse audit run + fixes on deployed URL

Keep commits small; build must pass before each commit.
