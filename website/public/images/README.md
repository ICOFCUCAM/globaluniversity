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

## `portal-hero.png` — the management system's masthead

The band across the top of every dashboard reads its photograph from exactly
one path:

    public/images/portal-hero.png

Upload it under **that name**, in lowercase, with no spaces or commas. A file
committed as `ChatGPT Image Aug 9, 2026, 06_56_24 PM.png` is served at a URL
full of `%20` and `%2C`, which works right up until something in the chain
does not encode it.

Three things worth knowing before choosing the picture:

- **It is texture, not a subject.** The band blends it on luminosity over the
  university's aubergine, so what survives is its light and shade, not its
  colour, and nothing in it is legible as a scene. Faces, text and detail are
  all lost by design — that is what keeps the masthead the university's colour
  whatever is uploaded. Choose for shape and contrast, not for content.
- **This is the one full-width band the audit below permits.** Because the
  picture is texture and sits under a heavy wash, a source softer than 1600px
  does not read as soft the way a full-bleed hero does. It should still be
  1600px or wider if you have it.
- **If the file is absent, nothing breaks.** The band renders as the wash
  alone — darker and plainer, and completely intact. There is no placeholder
  to remove and no broken image to explain.

A photograph is normally `.jpg`, not `.png` (see Formats above). The path ends
`.png` because that is what the university had to hand. If the PNG comes in over
400 KB, save it as `portal-hero.jpg` instead and change the single line naming
it in `src/lib/constants.ts`.

## Rights

Same rule as anywhere: the university needs to own the photograph or have
permission to publish it. That includes photographs of identifiable people —
students and staff on a public website is a consent question, not a technical
one.


---

## PHOTOGRAPHY AUDIT — what may be used where

Ninety-seven photographs; **three exceed 1600px wide**, and two of those three
must not be used at all.

| File | Size | Verdict |
|---|---|---|
| `wp/footer-building.jpg` | 2560×1754 | **DO NOT USE.** A Cambridge college. An African university showing an English quadrangle as its own backdrop reads as borrowing someone else's campus. Removed from the footer, the CTA band and the French homepage. |
| `landing-bg.jpg` | 1920×1080 | **Avoid.** Stock: hands on a laptop, nowhere in particular, no connection to this university. |
| `wp/sunday-ayah.jpg` | 2035×2048 | Portrait. Fine at portrait sizes. |

Everything authentic — the 2024 congregation, the campus, the faculty — is
**1080×720 or smaller**.

### The rule

**Show a photograph at the size its pixels can carry. Build anything larger out
of vector.**

- Contained frames up to ~500px displayed: fine, even at 2× device pixel ratio.
- Card headers up to ~600px: acceptable.
- **Full-bleed heroes and full-width bands: no.** A 972px source across a
  1440px viewport is a 1.5× upscale before the pixel ratio doubles it. This is
  why the old hero looked soft, and why it is now typographic — see
  `src/components/home/Hero.tsx`.

### What would change this

One commissioned photography session: the campus, a classroom, a laboratory, a
library, faculty teaching. Shot at 3000px or wider. That single change unlocks
full-bleed imagery across the whole site and is the highest-value thing the
university can do for the design that no amount of code can substitute for.
