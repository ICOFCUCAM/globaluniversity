# Read this before integrating

This folder is a **copy of a separate application**, placed here so that the
University can integrate it into its own platform. It is not part of this
repository's WordPress site and not part of `website/`.

It was copied from `icofcucam/university-academic-platform`, branch
`claude/sweet-knuth-er4qqi`, at commit `198759e`. Nothing has been changed on
the way in: the file list is identical to what that repository has committed.

## Two warnings, and the second one matters

**1. `docs/integration/001_lecture_studio.sql` is NOT one of this
repository's migrations.**

The University's migrations live in `website/docs/migrations/`, numbered in a
single sequence, bundled, proved twice against a database shaped like the
University's, and reported by a readiness probe. **This file is none of those
things. It has never been run against any database.** Its number is `001`
because it is the first migration of the *other* application, not because it
belongs anywhere in the University's sequence. Do not put it in that directory,
and do not run it, until it has been through the University's own process —
renumbered, bundled, proved twice, and given a probe.

**2. No vendor in this application has ever been run.**

Not a transcription service, not a speech service, not an object store, not a
live translator, and no language model. Everything is written against an
interface and proved against a fake. `docs/GAPS.md` says so line by line, and
`docs/BUILT.md` says what *is* built with every figure recounted from the
repository by `npm run check:built`.

Read those two together. Neither is complete on its own.

## What this application is

An AI lecture platform for universities:

> Lecturers teach. AI transforms. Students learn.

and one sentence governs all of it —

> **The lecturer-approved master is the source of truth for what was taught. AI
> may transform its language, structure, translation and delivery, but it may
> not alter its substance.**

## Where to start reading

| | |
|---|---|
| `README.md` | what it is and how to run it |
| `docs/ARCHITECTURE.md` | the constitution, the ownership line, the pipeline, provenance |
| `docs/INTEGRATION.md` | **how this mounts inside the University's system** — entity by entity |
| `docs/DELIVERY.md` | recorded → multilingual → lecturer's voice → live audio → lip-sync |
| `docs/BUILT.md` | the audit of what is built |
| `docs/GAPS.md` | the audit of what is not |

## Running it here

```bash
npm install
npm test          # 1,186 checks, no key and no network needed
npm run build
NEXT_PUBLIC_ENABLE_DEMO=true npx next dev
```

It runs with nothing configured: an offline processor stands in for the
language model and stamps every artefact it produces as machine-free, so a
demonstration never shows anybody AI output that no AI wrote.

## About the space in this folder's name

The folder is named as the University asked. Copying it here found a real
defect the moment it arrived — three tests resolved their own directory with a
URL, which percent-encodes, so the space became `%20` and twenty-three checks
failed. That is fixed, and `npm run check:spaces` now runs the whole suite from
a directory with a space in its name so it cannot come back.

If any tooling here still trips on the space, renaming the folder is one
command and nothing inside it depends on the name.
