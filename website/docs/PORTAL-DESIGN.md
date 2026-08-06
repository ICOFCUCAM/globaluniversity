# The portal's design rules

Written down because the next person to add a screen will otherwise re-invent
what is here, slightly differently, and the system will drift back to what it
was. Everything below is a rule with a reason; where a reason has stopped
applying, change the rule.

## The one that matters most

**Never render a number the university did not produce.**

This portal was built from a template, and the template's sample data was
rendered identically to real data on the live deployment. Between them, four
screens published:

| Screen | What it claimed |
|---|---|
| Dashboard | 2,847 students, 4,521 graduates, 8,541 enrolments, "+12%" growth |
| Analytics | Six departments the university does not have, with GPAs and pass rates |
| Audit log | Eight fabricated entries, including a grade altered from C to B |
| Sign-in page | "7,228 Success Stories · 1,742 Happy Students" |
| Student dashboard | The signed-in student's **name above another student's CGPA** |
| Certificate | "Status: **Eligible**" — a fixed string, for everyone, always |

None were marked. A dashboard is where an administrator gets the figure they
then quote in a meeting or to a ministry inspector; an audit log is what you
consult precisely when you do not trust what you are being told. A plausible
wrong number is worse than no number, because it will be believed and acted on.

The rules that follow from it:

- A count is a query. If it cannot be counted, it is not shown.
- A trend is computed or it is absent. `'+12%'` as a string literal is a lie
  with a graphic on it.
- Zero is a truthful answer and must be shown as zero, not hidden.
- When the read fails, say the read failed — do not report zero, and do not
  substitute anything.
- Specimens are legitimate (the certificate generator must draw *something*
  before the university has issued one). They carry `<SampleDataNotice />`.

## Grading is the highest-stakes code here

`grading.ts` derives its scale from `content/regulations.ts` and must continue
to. It spent its whole life on a different scale entirely — A at 70, pass at 40,
points out of 5.00 — against a published scale of A at 94, pass at 65, points
out of 4.00. A student scoring 50% was told "C, Good, pass"; under the
university's own regulations 50% is an outright fail.

`npm run test:grading` asserts the eleven bands against the published document,
by hand rather than by importing the same constant. Two of the assertions would
have caught the original fault: 50% must fail, 65% must be the lowest pass.

**Still to be decided by the university:** it publishes a grading scale but has
not adopted degree classification bands. The bands in `CLASSIFICATION_BANDS` are
a reading of a 4.00 scale, not a quotation, and they are the only number on a
certificate that is inferred. They should be adopted formally.

**Also unresolved:** the mark sheet records two components (CA out of 40, exam
out of 60) while the published scheme has four (participation 20, assignments
30, examinations 30, presentations 20). The exam is therefore weighted 60% where
the regulations say 30%, and participation and presentations have nowhere to go.
Either the sheet gains four fields — which needs a schema change — or the
regulations are amended. Result Processing states this on screen.

## Errors are never discarded

Fourteen writes across six screens did `await supabase.from(…).insert(…)` and
never looked at the result: the modal closed, the list refreshed, the work
vanished. Use `write()` from `lib/write.ts`, which reports the database's own
message.

This pattern hid two much larger faults. Results could never be saved at all —
`results` had no unique index matching the upsert's conflict target, so every
save failed — and every audit write from result entry was failing on a type
mismatch, meaning the action most likely to be disputed left no trace. Both were
invisible because nobody checked a return value.

## Dead controls

A control that does nothing is worse than a missing one: a user who clicks and
sees nothing learns not to trust the rest of the interface. This portal shipped
with a search box that searched nothing, a theme toggle that toggled nothing, an
"Update Password" that saved nothing, a "Register Student" that bypassed
admissions entirely, and "Enable 2FA" in confident green with no implementation.

Either wire it or delete it. If the capability belongs to another office, say
which office — a sentence naming the Superadministrator is help; a greyed-out
button is not.

## Colour

Colour is spent, not scattered. The template used eight gradients for eight
statistics, chosen because there were eight.

- **Purple `#422e59` and gold `#c5a55a`** carry identity — masthead, active
  navigation, primary action. Nothing else uses them.
- **Status colours** carry only the meanings in `src/lib/status.ts`. Green is
  not "good", it is `approved`.
- **Everything else is neutral.** Cards are white on a warm field with a
  hairline border, not a shadow. A shadow on every card flattens into noise the
  same way colour does.
- **Every status chip prints its label as well as its colour.** Dark red against
  red, and black against grey, are not separable by colour for a large minority
  of readers.
- **The field is warm, not blue-grey.** A student moving from the prospectus to
  the portal should not feel they have changed institution.

Tokens live in `src/lib/portalTheme.ts`. Use them; do not write a new grey.

## Dark theme

Real, not an inversion. Every token carries both. The identity colours do not
invert — a university's colours are not a function of the reader's OS setting.
A screen built from tokens is legible in both without knowing which is in force.

## Numbers

Anything a reader compares down a column is `tabular-nums`. Proportional digits
make 1,111 narrower than 8,888, so a column stops lining up and cannot be
scanned. This covers GPAs, fees, credit totals, student numbers and dates.

Dates are printed as dates. `2007-08-14` is the date input's storage format, not
a way of writing a birthday.

## States

Every screen that loads data needs four, and most shipped with one:

1. **Loading** — a skeleton in the shape of what is coming, not the word
   "Loading…". The layout must not jump when data lands.
2. **Empty** — say what would be here and what produces it.
3. **Filtered to nothing** — *distinct from empty*. "No students" shown to
   someone who has just typed a surname is how a user concludes the database is
   empty when it is full.
4. **Failed** — say so. Never fall back to sample data.

## Structure

- Navigation is grouped by the university's divisions of work — Admissions,
  Academic, Teaching, Records — not by the order screens were built.
- The rail is a flex column with only the nav scrolling, so Sign Out cannot be
  pushed off the bottom of the screen. It was, at every viewport under ~900px.
- Below `lg` the rail is a drawer, not a narrow column. A fixed 256px rail on a
  390px phone leaves 134px of content.
- Every screen sits inside `ScreenBoundary`. One null phone number should not
  unmount the navigation.
- `/portal` owns the whole viewport. The public masthead and footer are
  suppressed there and nowhere else (`SiteChrome`).

## Accessibility

- Focus rings are `focus-visible`, applied from the `FOCUS` token — the browser
  default is a blue halo belonging to no part of this palette.
- The portal has a skip link. Staff spend hours here; twenty-five tab stops
  before the content, on every navigation, is the more consequential omission
  than the same fault on a marketing page.
- Group headings in the nav are real headings, so a screen reader can move
  between sections instead of hearing twenty-five buttons.
- Anything conveyed by colour is also conveyed by text.

## Credentials

Certificate and transcript designs are **versioned and immutable once
published**. Publishing writes a new row and switches which is active; editing
in place would change what the university appears to have attested to, for every
graduate already holding that design. The database enforces it
(`credential_templates_immutable`).

Only the Superadministrator may publish one. See `docs/migrations/002_superadmin.sql`.

## Known structural problems

**Receipts are stored in the wrong table.** `FeeModule` writes each payment
into `documents` as base64-encoded JSON in `file_url`, with a human-readable
label in `file_name`. A financial record held that way cannot be queried,
summed or reconciled in SQL, and is invisible to any audit that does not know
the encoding. Totals on screen were originally computed by regex over the
filename — which contains the student's name, so a name with a digit or a
middle dot in it silently dropped that payment from the total.

The reading is fixed; the storage is not. It needs a `payments` table
(student_id, amount numeric, currency, method, purpose, received_by,
received_at, reference) and a migration. Until that exists, treat the fee
figures as indicative and reconcile against the receipts themselves.

## Credential signing

`CREDENTIAL_SECRET` is required. Without it, signing and verification both
refuse — deliberately. The route previously fell back to a literal committed to
this repository, so anyone who read the file could forge a signature the
university's own `/verify` page would confirm. Signing is also authenticated
now: it was an open POST endpoint that would sign any payload for anyone.

A valid signature proves the institution signed the payload. It does **not**
prove the credential was issued or that it still stands — there is no issuance
record to check against. Say "correctly signed", not "valid", until there is.

## What is still outstanding

- No issuance record exists, so `/verify` cannot yet render a credential under
  the version it was issued under. Do not describe verification as
  version-accurate until that table exists.
- Grade distribution, classification and pass rates are not drawn anywhere. They
  need approved results to compute from.
- Two-factor authentication is not implemented.
- `sampleData` still backs the transcript, certificate, LMS, exam and student
  dashboard screens. Each is labelled; each should be replaced by live records.
