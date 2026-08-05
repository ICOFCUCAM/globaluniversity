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

## Premiumization batch 10 (commits premium 1-10)
- [x] News & Announcements archive page + nav
- [x] Reading-progress bar + back-to-top control
- [x] Branded selection, smooth anchors, clean print output
- [x] Branded route-transition loading state
- [x] Footer action bar (apply / portal / verify / news / privacy)
- [x] FAQPage structured data (rich-result eligible)
- [x] Sitemap coverage for news + verify; header scroll elevation
- [x] Hero carousel pause-on-hover + ARIA

## Premiumization batch 11-20 (French track + careers)
- [x] French content module (src/content/fr.ts) — faithful translations
- [x] /fr French homepage (hero, overview, pillars, campuses, stats, CTA)
- [x] /fr/a-propos, /fr/admission, /fr/programmes, /fr/contact
- [x] Bilingual header: French nav on /fr, 🌐 language switcher (desktop+mobile)
- [x] hreflang alternates + French routes in sitemap
- [x] Careers page (faculty/staff recruitment, all schools + PPDI-RC)
- [x] Portal empty/loading states refined to brand styling
- [x] Footer: Careers + Français links

## Remaining (next runs)
- [ ] Extend French edition to remaining pages (research, scholarships, alumni)
- [ ] Lighthouse audit run + fixes on deployed URL
- [ ] Portal dashboard chart palette alignment

Keep commits small; build must pass before each commit.


---

## 2036 direction — commits 39–77

A second pass over the home page, moving it from "well-built university site"
to a distinct visual language. Full documentation in `DESIGN-SYSTEM.md`.

**Foundations** — fluid `clamp()` display scale, lift/gold shadow tokens,
tabular figures, one site-wide gold focus ring, global reduced-motion guard.

**The atmosphere layer** — `Aurora` (drifting colour fields on 26/32/38s offset
cycles), `Grain` (300-byte inline SVG noise), `LightShaft` (volumetric beams),
`Seam` (luminous band joins). Applied to every dark band.

**Signature interactions** — cursor-tracked `Spotlight` across nine card grids,
one listener per group coalesced to a frame; `Magnetic` controls; `KineticText`
headings assembling word by word; the `Crest` in a 60s conic ring.

**New bands** — statistics rebuilt as conic progress rings with orbiting nodes;
a counter-travelling ribbon of real program names; a live chapter rail tracking
fourteen sections; the diary threaded on a gradient timeline.

**Corrections found by screenshotting the built page, not by the build**
— hero ghost text, four competing `h1`s, a ragged pull-quote, an accreditation
panel that wrapped and orphaned a divider, aurora washing out the entire lower
page, and a CTA heading rendering as empty space. Each is written up in
DESIGN-SYSTEM.md under "Rules learned the hard way".

**Measured, not assumed** — 32 blurred compositing layers reduced to 26 and 41
animations to 35 via `content-visibility`, reduced blur radii and per-band field
counts, with no visible change. Reduced-motion: zero animations running, all 56
kinetic words settled. No horizontal overflow at 390, 768 or 1440.
