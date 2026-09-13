// ---------------------------------------------------------------------------
// THE THREE PAY COLUMNS TRAVEL TOGETHER OR NOT AT ALL.
//
// ---------------------------------------------------------------------------
// THE BUG THIS EXISTS FOR
// ---------------------------------------------------------------------------
//
// The University filled in an appointment, left the salary box empty — which
// their own ruling permits — pressed Save as draft, and got:
//
//   not-saved: new row for relation "appointments" violates check constraint
//              "appointments_salary_is_complete"
//
// 047's constraint is ALL THREE OR NONE. The route mapped the three columns
// independently, and the form's currency and period are dropdowns that always
// hold something — so an empty salary box arrived as amount NULL, currency
// 'USD', period 'month'. Half a salary. The database refused the whole record,
// and no appointment could be saved without typing a figure the University did
// not want to commit to.
//
// THE FIRST CASE BELOW IS THAT EXACT REQUEST. It is the one that matters; the
// rest are the neighbours of it.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}`
      + `\n      actual   ${JSON.stringify(actual)}`);
  }
};

// ---------------------------------------------------------------------------
// `appointments.ts` is TypeScript with `@/` imports, so it is bundled first.
// esbuild is already a dependency of the toolchain; the same idiom the nav
// test uses.
// ---------------------------------------------------------------------------
const dir = mkdtempSync(join(tmpdir(), 'pay-'));
const bundle = join(dir, 'appointments.mjs');
const root = new URL('../../', import.meta.url).pathname;

try {
  execFileSync('npx', [
    'esbuild', join(root, 'src/lib/appointments.ts'),
    '--bundle', '--format=esm', '--platform=neutral',
    `--outfile=${bundle}`,
  ], { stdio: 'pipe', cwd: root });
} catch (e) {
  console.error('FAIL  could not bundle src/lib/appointments.ts');
  console.error(String(e.stderr ?? e));
  process.exit(1);
}

const { payColumns } = await import(bundle);

console.log('\nAn empty salary box saves — the case the University hit\n');

{
  // THE EXACT BODY THE FORM SENDS when the salary is left empty: the dropdowns
  // still hold their defaults, because that is what a <select> does.
  const r = payColumns({ salaryAmount: '', salaryCurrency: 'USD', salaryPeriod: 'month' });
  check('an empty amount nulls the currency and the period with it',
    r, { ok: true, pay: { salary_amount: null, salary_currency: null, salary_period: null } });

  // And the row it produces satisfies 047's constraint, stated here the way
  // the database states it.
  const all3 = r.ok && ((r.pay.salary_amount === null && r.pay.salary_currency === null
      && r.pay.salary_period === null)
    || (r.pay.salary_amount !== null && r.pay.salary_currency !== null
      && r.pay.salary_period !== null));
  check('…so the row satisfies appointments_salary_is_complete', all3, true);
}

{
  const r = payColumns({ salaryCurrency: 'FCFA', salaryPeriod: 'year' });
  check('an absent amount does the same',
    r, { ok: true, pay: { salary_amount: null, salary_currency: null, salary_period: null } });
}

console.log('\nA salary that is stated is stated completely\n');

{
  const r = payColumns({ salaryAmount: '2000', salaryCurrency: 'USD', salaryPeriod: 'month' });
  check('all three given, all three kept',
    r, { ok: true, pay: { salary_amount: 2000, salary_currency: 'USD', salary_period: 'month' } });
}

{
  const r = payColumns({ salaryAmount: '2000' });
  check('a figure with no currency is refused', r.ok === false && r.error, 'salary-needs-a-currency');
  check('…and the reason says why it matters',
    /read as dollars by one officer and francs by the next/.test(r.detail ?? ''), true);
}

{
  const r = payColumns({ salaryAmount: '2000', salaryCurrency: 'USD' });
  check('a figure with a currency and no period is refused too',
    r.ok === false && r.error, 'salary-needs-a-currency');
}

console.log('\nAnd a figure nobody can act on is refused rather than stored\n');

{
  check('zero is not a salary',
    payColumns({ salaryAmount: '0', salaryCurrency: 'USD', salaryPeriod: 'month' }).error,
    'bad-salary');
  check('a negative salary is not a salary',
    payColumns({ salaryAmount: '-5', salaryCurrency: 'USD', salaryPeriod: 'month' }).error,
    'bad-salary');
  check('and neither is a word',
    payColumns({ salaryAmount: 'lots', salaryCurrency: 'USD', salaryPeriod: 'month' }).error,
    'bad-salary');
}

{
  check('a currency the University does not record is refused',
    payColumns({ salaryAmount: '10', salaryCurrency: 'BTC', salaryPeriod: 'month' }).error,
    'unknown-currency');
  check('a period nobody defined is refused',
    payColumns({ salaryAmount: '10', salaryCurrency: 'USD', salaryPeriod: 'fortnight' }).error,
    'unknown-period');
}

rmSync(dir, { recursive: true, force: true });

console.log(failures === 0
  ? '\nAll appointment-pay checks passed.'
  : `\n${failures} check(s) failed.`);

process.exit(failures === 0 ? 0 : 1);
