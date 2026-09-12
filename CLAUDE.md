# Working on the ICOF Global University system

## Migrations are handed over, never waited for

**The moment a migration is written, give the University the file to run — in the
same message, without being asked.**

This has now gone wrong twice, in two different ways, and both times the
University had to ask:

- *"why do you want me to always ask for migration to run?"* — the list of what
  was outstanding lived in a commit message. The answer was to make the system
  say it: `src/lib/migrationProbes.ts` reads the database and the Readiness panel
  in Credentials reports what has not been run.
- *"always generate the migration for me to run. why always wait for me to ask?"*
  — the file itself was written, committed and pushed, and then sat in the
  repository while the conversation moved on to something else.

A migration nobody runs is not a change to the system. It is a file. The work is
not finished when it is committed; it is finished when the person who has to run
it is holding it.

### So, every time a migration is added or changed

1. Rebuild the bundles, both of them:

   ```
   cd website
   node scripts/build-migration-run.mjs --out=RUN-OUTSTANDING.sql <the outstanding ones>
   node scripts/build-migration-run.mjs --out=RUN-ALL.sql <every one, in order>
   ```

2. Prove it against Postgres rather than reading it. There is a local harness at
   `/var/tmp/pgtest` — load `supabase-stub.sql`, then the migrations up to the
   one before, then the bundle. **Run it twice.** Idempotent is a claim until the
   second run is clean.

3. Add a probe to `src/lib/migrationProbes.ts` naming something the migration
   creates that no earlier migration created, so the Readiness panel can see it.
   `src/lib/migrationProbes.test.mjs` fails if the newest migration has none.

4. **Hand it over in the reply.** Attach the bundle, give the raw GitHub link,
   and paste the new migration into the message. Say what the expected output
   looks like — which `NNN OK` notices appear — so a silent failure is visible.

5. Say plainly what changes for the University the moment it runs. If it closes
   a door (023 seeds every programme closed), that belongs at the top of the
   reply, not in a comment in the SQL.

## The rest of the standing rules

- **Never invent an institutional fact.** No accreditation, campus, programme,
  faculty member, partnership, ranking, statistic, award, or date of founding
  that the University has not stated. `src/lib/constants.ts` and
  `src/content/site.ts` are where the facts live; if it is not there, ask.
- **No image is used twice.** `src/components/portal/portalMasthead.test.mjs`
  holds the two portal photographs to one caller each.
- **Never commit a secret.** Not a signing key, not a service-role key, not in a
  test fixture, not in a comment.
- **A specimen never carries a real graduate's identity.**
- **Measure, do not assume.** Nearly every real defect in this codebase was found
  by rendering the thing and reading the pixels, the computed style or the page
  count — not by reading the source. Screenshots and `getComputedStyle` over
  reasoning about CSS.
- **Prove a guard by breaking it.** A rule nobody has watched refuse anything is
  a rule nobody has tested. The migrations do this in SQL and roll back; the
  test files do it by asserting the refusal.

## University rulings already given

- A Bachelor's degree is **three years**; a Doctorate is **two**.
- Where two documents disagree, **the 2020 transcript governs**.
- Of the conflicting credit totals, **only the one with 180 stands**.
- **The school is not only online.** Delivery is `Campus`, `Online`, or
  `Online / Campus` — those exact words.
- **Only the Superadministrator may delete applications.**
- The Head of Academic Affairs takes the academic admission decision and signs
  page 1 of the letter. Finance is a gate, not an authority.

## Running things

- `npm test` runs every suite; `npm run build` must compile before any commit.
- Demo mode: `NEXT_PUBLIC_ENABLE_DEMO=true npx next dev`. The role switcher
  buttons are lowercase (`super`).
- Chromium for Playwright is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- The sandbox cannot reach the University's Supabase project, so database-backed
  screens hang and then fail. That is the environment, not the code.
