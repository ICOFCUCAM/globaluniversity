# Border artwork — source files

**Upload border images here.** This folder is *source artwork*, not website
content: it sits outside `public/`, so nothing in it is served to visitors or
shipped in the build. It exists so there is a file on disk to work from.

## Why it has to be a file, and not a chat attachment

An image attached in conversation can be *looked at* — that is how the 2011
certificate and the signage over the door were worked from — but it never
reaches the filesystem, so it cannot be run through a tracer. To convert a
border into vector artwork the file has to be in the repository.

## How to upload

On github.com, on the branch `claude/university-site-vercel-migration-vmsizi`:

    website/assets/borders/  →  Add file  →  Upload files

Then say so, and the file will be pulled, traced and added to the border
catalogue as a named course.

## What to send, best first

| Format | Verdict |
|---|---|
| `.svg` `.ai` `.eps` `.pdf` | **Best.** Already vector. No tracing, no loss. |
| `.png` with transparency | Very good. 2000 px or more on the long edge. |
| `.jpg` flat artwork | Workable. Avoid heavy compression — JPEG noise traces as speckle. |
| Photograph of a printed frame | Last resort. Crop to the frame, shoot square-on, light it evenly. |

An angled photograph traces its own perspective distortion, and a shadow on the
wall behind traces as extra ornament. Neither can be undone afterwards.

## What tracing does and does not do

It captures the **shapes** exactly and discards colour and shading. That is the
intended outcome: the gilt gradient and the lit/shaded relief passes are then
applied from the university's own palette, so a traced border belongs to the
same document as everything else on the sheet instead of carrying the lighting
of whatever room it was photographed in.

## Rights — read this before uploading

**Tracing does not clear rights.** Vectorising someone else's artwork is still
copying it. The university must own the border or hold a licence that permits
use on issued documents.

This matters more here than it would elsewhere: a degree certificate is a
document the university will be standing behind in public for decades, and the
frame on the 2011 certificate may well have come from the printer's own stock
rather than from the university. If the provenance is not known, say so — a
border drawn from geometry is always available and carries no such question.
