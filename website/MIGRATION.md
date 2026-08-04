# Migrating iguc.net from WordPress/cPanel to Vercel

This folder (`website/`) is a complete, deployable rebuild of the ICOF Global
University public website. It was reconstructed from what the repository
contains: the Elementor **"Education" template kit** the site was built on
(`wp-content/uploads/template-kits/`), the university's real images
(`wp-content/uploads/2020/*`), and the program/contact details recovered from
the online application system (`forms/`).

**What could NOT be recovered from the repo:** the exact wording of each page.
WordPress keeps page content in the MySQL database (`igucmor1_wp905`, table
prefix `wpst_`) on the cPanel server — that database is not in git. Every
place where wording is provisional is marked `TODO(content)` in
`src/content/site.ts`.

---

## Step 1 — Deploy to Vercel (works today)

1. Push this branch to GitHub.
2. In Vercel: **Add New Project → Import** `icofcucam/globaluniversity`.
3. Set **Root Directory** to `website` (Settings → General → Root Directory).
   Framework preset: Next.js (auto-detected). No environment variables needed.
4. Deploy. When you're happy, point the `iguc.net` DNS A/CNAME records at
   Vercel (Project → Settings → Domains) — cPanel keeps serving email and the
   legacy apps.

## Step 2 — Export your content from cPanel (to make pages exact)

Using the tools you already have (see your cPanel screenshot):

**Option A — phpMyAdmin (full database):**
1. cPanel → **phpMyAdmin** → select database **igucmor1_wp905**.
2. **Export** tab → Quick → format **SQL** → Go.
3. Save the file as `wp-export/igucmor1_wp905.sql` in this repo (or share it
   with your developer/Claude session).

**Option B — WordPress export (pages/posts only, much smaller):**
1. `iguc.net/wp-admin` → **Tools → Export → All content** → Download.
2. Save the XML as `wp-export/iguc-content.xml` in this repo.

Then run the extractor to pull every page's text out of the export:

```bash
cd website
node scripts/extract-wp-content.mjs ../wp-export/iguc-content.xml
# → writes readable text of every page/post to content-export/
```

Paste the recovered wording into `src/content/site.ts` (each field is named
after the page/section it feeds). The layout, colors and structure already
match the template kit, so this is purely a copy-editing pass.

## Step 3 — Later: serve content from a database (optional)

All pages read through `src/lib/data.ts`. To move content from the static
file into a database, implement the same functions there against either:

- **Postgres on Vercel** (Neon / Supabase / Vercel Postgres) — recommended;
  import your exported data, then query with `@vercel/postgres`.
- **Your existing cPanel MySQL** — enable *Remote MySQL* in cPanel, set
  `DATABASE_URL` in Vercel env vars, query with `mysql2`. This works but keeps
  the old server as a dependency.

No page component changes either way.

## Legacy apps still on cPanel

These keep running on the old server and are linked from the new site's
"Student Portals" menu until each is migrated:

| App | Path | What it is |
|---|---|---|
| Online application | `/forms/` | Custom PHP application form (emails admission@iguc.net) |
| E-learning | `/online/` | LMS |
| Student cloud | `/igucloud/` | ownCloud file sharing |
| Administration | `/administration/` | Admin system |
| Transcripts | `/transcript/` | Python transcript service |
| Invoicing | `/invoice/` | InvoicePlane |
| Project tracker | `/projectsent/` | ProjectSend |

## ⚠️ Security: the WordPress install is compromised

Evidence found in this repository (do not ignore this):

- `wp-content/uploads/2026/*` is full of **casino-spam images** ("pinco
  casino", "pin-up casino") — classic SEO-spam infection.
- Root `.htaccess` whitelists suspicious PHP files (`goods.php`, `shop.php`,
  `ace.php`, `green.php`, `admin-en_UA.php`, …) that are not part of
  WordPress; `goods.php`/`shop.php` exist in the repo root as 8-byte stubs.
- A junk theme directory `wp-content/themes/ltyazrooxp` exists.
- The root `index.php` is empty (0 bytes) — WordPress's real `index.php`
  never is.
- A 21 MB `error_log` sits in the web root.

Moving the public site to Vercel removes the whole attack surface (static
site, no PHP). Until then: change the cPanel, WordPress-admin and database
passwords, and consider taking a clean backup of the database now, before
the infection worsens. The spam content will also need cleaning out of the
database export before reuse (the extractor script flags posts whose titles
match common spam keywords).
