// ---------------------------------------------------------------------------
// BUILD A SINGLE RUNNABLE FILE FROM SEVERAL MIGRATIONS.
//
//   node scripts/build-migration-run.mjs 006 010 011 012
//   -> docs/migrations/RUN.sql
//
//   node scripts/build-migration-run.mjs --out=RUN-ALL.sql 000 003 004 005 \
//        006 007 008 009 010 011 012
//   -> docs/migrations/RUN-ALL.sql   (the whole schema from nothing)
//
// ===========================================================================
// WHY
// ===========================================================================
//
// The Supabase SQL editor takes one paste. Running four migrations means four
// pastes in the right order, and the failure mode is silent and expensive: a
// tired person runs 011 before 006, gets an error about a missing table, fixes
// the "wrong" thing, and leaves the database half-migrated.
//
// This concatenates them in the order given, with a banner between each so the
// output can be read, and refuses to build if any file it is given contains
// something that cannot survive concatenation.
//
// ===========================================================================
// WHAT IT REFUSES, AND WHY EACH ONE MATTERS
// ===========================================================================
//
//   psql meta-commands (\i, \copy, \set). They are client instructions, not
//   SQL. Pasted into the Supabase editor they are a syntax error at best; in a
//   concatenated file they can silently change the meaning of everything after
//   them.
//
//   begin / commit / rollback. A file that opens its own transaction and one
//   that does not cannot be safely joined — the second file's statements end up
//   inside the first file's transaction, and a failure in file four rolls back
//   file one. Every migration in this repository is written to run
//   statement-by-statement, and this keeps it that way.
//
// It is a build script, not a runner. It does not connect to anything and it
// cannot damage a database. The output is text somebody reads before pasting.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '../docs/migrations');

const argv = process.argv.slice(2);
const outFlag = argv.find((a) => a.startsWith('--out='));
const OUT = outFlag ? outFlag.slice('--out='.length) : 'RUN.sql';
const wanted = argv.filter((a) => !a.startsWith('--'));
if (!wanted.length) {
  console.error('Usage: node scripts/build-migration-run.mjs 006 010 011 012');
  process.exit(1);
}

const all = readdirSync(dir).filter((f) => f.endsWith('.sql'));

const files = wanted.map((n) => {
  const match = all.filter((f) => f.startsWith(`${n}_`));
  if (match.length !== 1) {
    console.error(
      match.length
        ? `Ambiguous: "${n}" matches ${match.join(', ')}`
        : `No migration numbered "${n}" in docs/migrations`,
    );
    process.exit(1);
  }
  return match[0];
});

// 000 IS 001 AND 002 MERGED, and listing it alongside them would run the same
// DDL twice. Harmless — every statement in all three is idempotent — but it
// wastes minutes on a big schema and, worse, it tells whoever reads the output
// that the file is confused about what it contains. Its own header says: "If
// you run this, you do not need either of those files."
if (wanted.includes('000') && (wanted.includes('001') || wanted.includes('002'))) {
  console.error(
    'Refusing to build: 000_complete.sql IS 001 and 002 merged. List 000 alone, '
    + 'or list 001 and 002 without it — never both.',
  );
  process.exit(1);
}

// THE ORDER IS THE ORDER GIVEN, and it is checked rather than trusted. Someone
// typing "011 006" means it, or has made exactly the mistake this file exists
// to prevent — so it is refused rather than silently sorted, because silently
// sorting would hide the typo that revealed the misunderstanding.
const numbers = wanted.map(Number);
if (numbers.some((n, i) => i > 0 && n < numbers[i - 1])) {
  console.error(`Out of order: ${wanted.join(' ')}. Migrations must be listed ascending.`);
  process.exit(1);
}

const FORBIDDEN = [
  [/^\s*\\[a-z]/m, 'a psql meta-command (\\i, \\copy, \\set) — client instruction, not SQL'],
  [/^\s*(begin|commit|rollback)\s*;/im, 'an explicit transaction — cannot be safely concatenated'],
];

const parts = files.map((f) => {
  const sql = readFileSync(join(dir, f), 'utf8');
  for (const [re, why] of FORBIDDEN) {
    if (re.test(sql)) {
      console.error(`Refusing to build: ${f} contains ${why}.`);
      process.exit(1);
    }
  }
  const rule = '='.repeat(75);
  return `\n-- ${rule}\n-- ${rule}\n--\n--   ${f}\n--\n-- ${rule}\n-- ${rule}\n\n${sql}`;
});

// ---------------------------------------------------------------------------
// THE LAST QUERY IN THE FILE: DID IT LAND?
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS, AND IT IS AN APOLOGY
// ---------------------------------------------------------------------------
//
// Every one of these migrations proves itself in plpgsql and reports with
// RAISE NOTICE — and the Supabase SQL editor, which is where the University
// actually runs them, DOES NOT DISPLAY NOTICES. So the handover instruction
// "expect four OK notices" named output nobody could see, and the only signal
// available was the absence of a red error.
//
// A proof whose result is invisible in the tool the reader is holding is not a
// proof they have. This appends a plain SELECT — visible in the Results pane
// like any other — that names each migration in the bundle and whether the
// thing it creates is now there.
//
// It reads `to_regclass`, so it asks the database rather than a log.
// ---------------------------------------------------------------------------

/** What each migration creates, so the closing report can look for it. */
const MARKERS = {
  '036': 'admission_audit_log', '037': 'students', '038': 'announcements',
  '039': 'announcement_media', '040': 'announcement_tombstones',
  '041': 'appointments', '042': 'appointment_events',
  // A VIEW, NOT A COLUMN. This said `working_hours`, which 043 adds to
  // `appointments` — and to_regclass looks for a RELATION, so it came back
  // null and the report said 043 had not landed on a database where it plainly
  // had. A false NO sends somebody to re-run a migration that is already
  // applied, which is the one thing this table exists to prevent.
  '043': 'appointment_letters_unverifiable',
  '044': 'document_templates', '045': 'correspondence',
  '046': 'correspondence_events', '047': 'appointment_allowances',
  '048': 'positions', '049': 'signature_specimens',
  '050': 'appointment_acceptances', '051': 'document_template_coverage',

  // ---------------------------------------------------------------------
  // NOT EVERY MIGRATION CREATES A TABLE, and the two below did not appear in
  // this report at all — they were simply absent from this list, so the
  // University's only visible check stopped at 051 and said nothing either
  // way about the two newest files. Silence reads as "fine".
  //
  // So a marker may now be one of three things:
  //   'name'          a relation — table or view
  //   'table.column'  a column, for a migration that only adds columns
  //   'rows:table:predicate'  rows that match, for a migration that only seeds
  // ---------------------------------------------------------------------

  // 052 CREATES NO STRUCTURE AT ALL. It seeds one draft of each of the 31
  // document kinds, so the only honest question is whether those rows are
  // there.
  //
  // `created_by is null` IS THE TEST, and the first attempt — `version = 1` —
  // was wrong in the way that matters: 044 and 051 also produce version-1
  // rows, so the report said YES on a database where 052 had never run. A
  // false YES is worse than no row at all, because it tells the University a
  // migration landed when it did not.
  //
  // Only the seed has no author. Every template a person creates carries the
  // id of whoever created it; these were written by nobody, which is the whole
  // reason 052 can leave them editable by anyone.
  '052': 'rows:document_templates:created_by is null',
  // 053 ADDS THREE COLUMNS TO 048's TABLE. `standing` is the one no earlier
  // migration created — and it is a column, which is exactly the mistake 043
  // made when its marker was `working_hours` and the report said NO on a
  // database where the migration had plainly landed.
  '053': 'positions.standing',
  // 054 adds columns to 001's `enrollments` AND creates a view. The view is
  // the better marker: a relation either exists or it does not, with no
  // information_schema lookup to get wrong.
  '054': 'course_roll',
  // 055 CREATES NOTHING AT ALL. It changes what two CHECK constraints permit
  // and adds a trigger — so neither a relation nor a column nor a seeded row
  // can answer for it, and without a fourth form it would simply be absent
  // from this report, which is how 052 and 053 were missed.
  '055': "def:appointments_second_pair_of_eyes:made_on_sole_authority",
  // 056 rewrites four read policies, widens a role vocabulary, adds a trigger
  // and creates one table. The policies are the substance and none of them is
  // probeable — a restricted row comes back absent, not refused — so the
  // marker is the table, which nothing before this migration creates.
  '056': 'capability_grants',
  // 057 creates six tables; programme_versions is the one nothing else could
  // have made, and the one every later academic feature hangs from.
  '057': 'programme_versions',
  // 058 CREATES NOTHING. It seeds one row into 057's requirements table, so
  // the marker is the row itself.
  '058': "rows:academic_approval_requirements:subject = 'curriculum'",
  '059': 'academic_terms',
  // 060 CREATES NOTHING — it fills 057's register. The marker is the rows.
  '060': 'rows:programmes:true',
  '061': 'rows:programme_versions:true',
  '062': 'curriculum_progress',
  '063': 'course_offerings',
  // 064 CREATES NO TABLE — it adds a column to 063's `rooms` and fills it.
  // `provisional` is the marker: nothing before it had a way to say that a
  // room arrived in a seed rather than from the University.
  '064': 'rooms.provisional',
  // 065 adds no table and no column \u2014 it adds two views and a function.
  // The derived view is the marker.
  '065': 'academic_year_now',
};

/** The SQL that answers "is this one here?", for each of the three forms. */
function landedTest(marker) {
  // A CONSTRAINT'S OWN DEFINITION, for a migration that only changes what is
  // permitted. `pg_get_constraintdef` renders the CHECK as text, so asking
  // whether the new clause is in it is asking the database what rule it is
  // actually enforcing — not what some log says was run.
  if (marker.startsWith('def:')) {
    const [, name, needle] = marker.split(':');
    return `case when exists (
                   select 1 from pg_constraint
                    where conname = '${name}'
                      and position('${needle}' in pg_get_constraintdef(oid)) > 0)
                 then 'YES' else 'NO' end`;
  }
  if (marker.startsWith('rows:')) {
    const [, table, predicate] = marker.split(':');
    return `case when to_regclass('public.${table}') is null then 'NO'
                 when exists (select 1 from ${table} where ${predicate}) then 'YES'
                 else 'NO' end`;
  }
  if (marker.includes('.')) {
    const [table, column] = marker.split('.');
    return `case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = '${table}'
                      and column_name = '${column}')
                 then 'YES' else 'NO' end`;
  }
  return `case when to_regclass('public.${marker}') is not null then 'YES' else 'NO' end`;
}

function landedReport(files) {
  // ---------------------------------------------------------------------
  // A MIGRATION WITH NO MARKER STOPS THE BUILD.
  //
  // This used to `.filter(([n]) => MARKERS[n])` and say nothing, so a
  // migration nobody had added a marker for was simply absent from the
  // report — and the report is the only thing the University can actually
  // SEE, because the Supabase editor does not display notices.
  //
  // It has now happened three times: 052, 053, and 056. Each time the bundle
  // built, ran, applied correctly, and produced a table that quietly did not
  // mention the newest migration — which is the exact shape of "it worked"
  // and "it did not run" being indistinguishable.
  //
  // Refusing here costs one line in MARKERS. Not refusing costs somebody
  // reading a table of YESes and believing it covers everything.
  // ---------------------------------------------------------------------
  // SCOPED TO THE ERA THE REPORT COVERS. MARKERS begins at the migration this
  // table was introduced for; everything before it predates the report and was
  // never listed. Demanding markers for those retroactively would refuse to
  // build RUN-ALL at all — which is how this check failed the first time it was
  // written. The floor is the lowest key in MARKERS, so it moves by itself if
  // the table is ever trimmed.
  const firstReported = Object.keys(MARKERS).sort()[0];
  const unmarked = files
    .map((f) => [f.slice(0, 3), f])
    .filter(([n]) => n >= firstReported && !MARKERS[n]);
  if (unmarked.length > 0) {
    console.error(
      `\nNo marker for ${unmarked.length === 1 ? 'this migration' : 'these migrations'}:\n`
      + unmarked.map(([n, f]) => `  ${n}  ${f}`).join('\n')
      + '\n\nAdd one to MARKERS in scripts/build-migration-run.mjs naming something the\n'
      + 'migration creates that no earlier one does. Without it the migration is missing\n'
      + 'from the DID IT LAND? table, which is the only output the Supabase SQL editor\n'
      + 'shows — a silent failure would look exactly like a success.\n',
    );
    process.exit(1);
  }

  const rows = files
    .map((f) => [f.slice(0, 3), f])
    // The pre-report migrations are skipped, not refused — the check above has
    // already refused anything from 036 on that has no marker, so whatever is
    // dropped here is only ever the historical schema.
    .filter(([n]) => MARKERS[n])
    .map(([n, f]) => `  select '${n}' as migration, '${f.replace(/'/g, "''")}' as file,
         ${landedTest(MARKERS[n])} as landed,
         '${MARKERS[n].replace(/'/g, "''")}' as what_it_creates`);

  if (rows.length === 0) return '';

  // ONE SELECT PER MIGRATION, UNION'd — rather than a VALUES list and a single
  // expression over it. A VALUES list can only carry a string, so every row had
  // to be tested the same way, which is why a migration that added a column
  // instead of a table could not be reported on at all.
  return `-- ===========================================================================
-- DID IT LAND?  — READ THIS TABLE
-- ===========================================================================
--
-- Every row should say YES. A row saying NO means that migration did not take
-- effect: scroll up for the first red ERROR, fix it, and run the file again.
-- Running it twice is safe.
--
-- The proofs inside each migration also RAISE NOTICE, which the Supabase SQL
-- editor does not show. This table is the same answer in a form it does.
-- ===========================================================================

select * from (
${rows.join('\n  union all\n')}
) as landed_report
 order by migration;
`;
}

const out = `-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS ${wanted.join(', ')}, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs ${outFlag ? outFlag + ' ' : ''}${wanted.join(' ')}
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/${OUT}
--
-- Every migration in it is idempotent and destroys nothing, so running it twice
-- is safe. It is NOT wrapped in a transaction: each file is written to run
-- statement by statement, and wrapping them would mean a failure in the last
-- one silently undid the first.
--
-- ---------------------------------------------------------------------------
-- WHAT TO EXPECT IN THE OUTPUT
--
-- Some of these raise NOTICE deliberately — they report on the state they
-- found rather than changing it silently. A notice is information, not a
-- warning. An ERROR is a real failure and stops the run.
--
${wanted.includes('000') ? `-- ---------------------------------------------------------------------------
-- BEFORE YOU RUN THIS ONE — it starts from an empty database
--
-- 000_complete.sql appoints two administrators, and it can only appoint an
-- account that already exists. Create them first:
--
--   Dashboard -> Authentication -> Users -> Add user   (tick "Auto Confirm User")
--     superadmin@iguc.net   system custody
--     tchamer@aol.com       day-to-day administration
--
-- Running the file before they exist is harmless. It simply appoints nobody,
-- and you re-run that section afterwards.
--
-- AND AFTERWARDS, DO THE SECURITY CHECK at the foot of 000. Until it passes,
-- any signed-in student can make themselves a Superadministrator from the
-- browser console. That is not a formality.
--
` : ''}-- ---------------------------------------------------------------------------
-- AFTERWARDS
--
-- The LAST THING this file prints is a table saying which of these migrations
-- landed. You do not have to run anything else to find out — and you should
-- not have to, because the Supabase SQL editor does not display the NOTICE
-- lines the proofs write.
-- ===========================================================================
${parts.join('\n')}

${landedReport(files)}
`;

// ---------------------------------------------------------------------------
// --report-only — THE CHECK WITHOUT THE MIGRATIONS
//
// "How can I check if all migrations are in place?" had no short answer. The
// DID IT LAND? table exists, but only at the foot of a bundle — so asking the
// question meant re-running half a megabyte of DDL to read twenty lines at the
// end of it. Safe, because every migration is idempotent, but nobody should
// have to run a migration to find out whether they need to.
//
// This emits the report alone: reads nothing but the catalogue, writes
// nothing, and comes from the same MARKERS table as the bundles, so it cannot
// drift from what they check.
// ---------------------------------------------------------------------------
if (argv.includes('--report-only')) {
  const reportOnly = `-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — ARE ALL THE MIGRATIONS IN PLACE?
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs --report-only
--
-- ---------------------------------------------------------------------------
-- READS ONLY. CHANGES NOTHING.
--
-- Paste the whole file into the Supabase SQL editor and run it. It asks the
-- database catalogue what exists and reports one line per migration. It
-- creates nothing, alters nothing and drops nothing, so it is safe to run at
-- any time, as often as you like, on a live database.
--
-- ---------------------------------------------------------------------------
-- HOW TO READ THE RESULT
--
--   landed = YES   the thing that migration creates is there.
--   landed = NO    it is not. That migration has not been run.
--
-- A NO with YESes after it is the case worth stopping on: migrations are
-- written to run in order, and a gap means something later was applied to a
-- database that was missing what it assumed. Run RUN-OUTSTANDING.sql, which is
-- idempotent and will skip everything already present.
--
-- WHAT THIS CANNOT TELL YOU. It checks that each migration's marker exists —
-- not that every statement inside it succeeded. A migration that created its
-- table and then failed on a later statement reports YES. The bundles' own
-- proofs are what cover that, and they stop the run on failure.
-- ===========================================================================

${landedReport(files)}
`;
  writeFileSync(join(dir, 'ARE-THEY-ALL-IN.sql'), reportOnly);
  console.log(`docs/migrations/ARE-THEY-ALL-IN.sql  ${files.length} migrations reported on`);
  process.exit(0);
}

writeFileSync(join(dir, OUT), out);
console.log(`docs/migrations/${OUT}  ${files.length} files, ${(out.length / 1024).toFixed(1)}KB`);
console.log(`  ${files.join('\n  ')}`);
