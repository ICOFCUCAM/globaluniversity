# Site images

Everything in this folder is **served publicly** at `/images/<filename>`. Drop a
file in here and it is reachable the moment the site deploys.

    public/images/graduation-2026.jpg   →   /images/graduation-2026.jpg

## How to upload

On github.com, on the branch `claude/university-site-vercel-migration-vmsizi`:

    website/public/images/  →  Add file  →  Upload files

Drag in as many as you like. Then say what each one is *for* — an image nobody
references is dead weight in the build, and the site cannot guess that
`IMG_4821.jpg` is the new Vice Chancellor.

## Where they get used

Images are wired up in two content files, not scattered through the code:

    src/content/site.ts    faculty and administration portraits, faculty cards,
                           hero and section imagery
    src/content/pages.ts   page-by-page content

so changing which photograph a page uses is one edit in one place.

`public/images/wp/` holds the 51 files carried over from the WordPress site.
New material belongs in `public/images/` rather than in there — `wp/` is a
record of what was migrated, and mixing new work into it loses that.

## Naming

Lowercase, hyphens, and say what it is: `chancellor-wade.jpg`,
`graduation-2026-hall.jpg`, `fac-theology-buea.jpg`. Not `IMG_4821.jpg`, and not
`final-FINAL-v2.jpg` — the filename is what appears in the page source and in
every error message about it for the next ten years.

## Size

The whole folder is about 12 MB today and the largest single file is 400 KB.
Keep to that: **under 400 KB, and 2000 px on the long edge is plenty.** Every
one of these is downloaded by every visitor on a phone, and a 4 MB photograph
straight off a camera will do more damage to the site than a small one does
good. Send the large original if you have it and it can be resized here.

## Formats

`.jpg` for photographs. `.png` only where transparency is needed — a logo, a
seal, a cut-out. A photograph saved as PNG is typically five times the size for
no visible gain.

## Rights

Same rule as anywhere: the university needs to own the photograph or have
permission to publish it. That includes photographs of identifiable people —
students and staff on a public website is a consent question, not a technical
one.
