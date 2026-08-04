# ICOF Global University — Vercel Website

Modern rebuild of [iguc.net](https://iguc.net) as a static Next.js site,
faithful to the Elementor **"Education" template kit** the WordPress site was
built on (same palette `#422e59` / `#f7dc79`, same page set, same section
layout) and using the university's real images and program catalog recovered
from this repository.

## Develop

```bash
cd website
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (fully static)
```

## Deploy to Vercel

Import this repo in Vercel and set **Root Directory = `website`**. Everything
else is auto-detected. See [MIGRATION.md](./MIGRATION.md) for the full
WordPress → Vercel migration plan, how to export your content from cPanel
phpMyAdmin, and how to later move content into a database.

## Where things live

| Path | Purpose |
|---|---|
| `src/content/site.ts` | **All text & media** — the one file to edit for content |
| `src/lib/data.ts` | Data access layer (swap to a DB here later, UI untouched) |
| `src/app/*` | Pages: home, about, programs (+detail), admissions, faculty, campus-life, events, tuition, contact |
| `src/components/*` | Header, footer, banners, CTA, section primitives |
| `public/images/*` | Recovered ICOF branding & photos |
| `scripts/extract-wp-content.mjs` | Pulls page text out of a WP XML/SQL export |
