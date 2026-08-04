# ICOF Global University — 2036 Platform Roadmap

Feature assessment (August 2026) and the staged path to a best-in-class,
futuristic university platform. Phases are ordered by impact-per-effort and
by what each one unlocks next.

## Where the platform stands today

**Public site (38 pages, static, global CDN):** full WordPress content
restored; hero slider; dropdown navigation; 6-step online application
emailing admissions; degree-level pages; donate/charity/support; faculties
with full administration roster; SEO (sitemap, robots, schema.org
CollegeOrUniversity), Open Graph/Twitter cards, installable web-app
manifest, security headers, WhatsApp chat button, Vercel Analytics.

**Student portal (/portal, integrated):** authentication with roles
(student / lecturer / admin + demo modes); student registration &
management; departments, courses, enrollments; lecturer management; exams;
result processing with automated GPA & semester GPA; transcript generator;
certificates; documents; LMS; analytics dashboard; audit logs — backed by a
hosted Postgres-compatible database.

## Phase 1 — Operational foundation (weeks)

- [ ] **SMTP env vars in Vercel** so the /apply wizard delivers to
      admission@iguc.net (SMTP_HOST/PORT/USER/PASS).
- [ ] **Custom domain + subdomains**: iguc.net → Vercel; portal.iguc.net →
      cPanel (keeps /forms, /online, /igucloud alive during transition).
- [ ] **Database ownership review**: move the portal's database under a
      university-controlled account (Supabase project or Vercel Postgres);
      re-issue keys; enable row-level security policies per role.
- [ ] **Admissions pipeline**: /apply submissions write into the portal
      database (status: pending) so admissions staff review, approve and
      convert applicants to students in one place — no more email-only flow.
- [ ] **French translation (i18n)**: Cameroon is bilingual; next-intl with
      /fr routes doubles the site's reach.

## Phase 2 — Student services (1–2 months)

- [ ] **Tuition payments with Mobile Money**: MTN MoMo + Orange Money APIs
      (the old WordPress site already had momopay tables — the intent
      existed). Fee schedules per program, instalments, receipts,
      automatic reconciliation into the portal.
- [ ] **Timetable & attendance**: class scheduling per course/semester,
      lecturer attendance capture (QR code scan in class), student
      attendance reports feeding eligibility rules.
- [ ] **Notifications**: email + SMS (Twilio/Africa's Talking) + WhatsApp
      Business API for admission decisions, fee reminders, results release.
- [ ] **Student ID cards**: generated PDF/print cards with QR codes tied to
      the portal profile.
- [ ] **Offline-first PWA**: service worker caching so the portal works on
      unstable connections — critical for students on mobile data.

## Phase 3 — Academic depth (2–4 months)

- [ ] **Full LMS expansion**: course materials, assignment submission with
      deadlines, plagiarism-similarity checks, discussion threads, live
      class links (integrate the existing Chamilo content or migrate it).
- [ ] **Online examinations**: timed quizzes, question banks, randomized
      papers, invigilation flags (tab-switch detection), automatic marking
      feeding directly into result processing.
- [ ] **Verifiable credentials**: every transcript/certificate carries a QR
      code + public verification page (hash stored server-side) so
      employers and other universities verify authenticity instantly —
      optionally anchored on a public blockchain for tamper-evidence.
- [ ] **Alumni module**: alumni directory, verified alumni logins,
      donations tied to the payment stack.

## Phase 4 — The 2036 tier (ongoing)

- [ ] **AI academic advisor**: a Claude-powered assistant inside the portal
      that answers admissions questions, guides course selection against
      degree requirements, drafts study plans from a student's results, and
      gives staff natural-language analytics ("show enrollment trends by
      faculty").
- [ ] **Predictive analytics**: early-warning models for at-risk students
      (attendance + grades + fee status), enrollment forecasting,
      program-demand dashboards.
- [ ] **AI admissions triage**: document OCR + completeness checks on
      uploaded certificates before staff review.
- [ ] **Voice & low-bandwidth access**: USSD/SMS result checking for
      students without smartphones.
- [ ] **Multi-campus support**: Buea, Douala, Nigeria (PPDI-RC) and online
      campuses as first-class entities with per-campus reporting.

## Standing engineering practices

- Keep the content layer (`src/content/*` → `src/lib/data.ts`) swappable to
  a database without touching pages.
- Every new feature lands with audit-log coverage and role checks.
- Lighthouse budget: 90+ performance/accessibility/SEO on every deploy.
