// ---------------------------------------------------------------------------
// The Credential Authority — can history be overwritten, and can a certificate
// of appreciation pass for a degree?
//
// Run with:  node src/lib/credentialAuthority.test.mjs
//
// WHY THIS FILE EXISTS. Two of the university's instructions in the twelve-point
// specification are absolute, and both fail invisibly:
//
//   "Never destroy the previous certificate."
//   "the system should clearly classify them so nobody mistakes an
//    institutional certificate for an accredited academic degree."
//
// The first fails invisibly because an overwrite looks exactly like a
// correction from the inside — the graduate gets the right document either way,
// and the difference only surfaces years later when an accreditor asks what the
// certificate said before and the answer is that nobody knows.
//
// The second fails invisibly because the wrong classification produces a
// perfectly good-looking certificate. Nobody complains about a Certificate of
// Appreciation that verifies as an academic award; it is the holder's advantage
// and the university's liability, and it is discovered by a third party.
//
// So this file goes at both from the outside: it tries to overwrite, tries to
// mis-classify, tries to skip steps in the correction workflow, and tries to
// approve one's own request.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok    ${label}`);
  }
}

// esbuild with the `@` alias, the same way certificate.test.mjs and
// flatWorld.test.mjs load a module that imports across the tree. Plain tsc
// cannot resolve `@/lib/...` and fails with "cannot find module", which says
// nothing about the code under test.
const root = new URL('../..', import.meta.url).pathname;
const out = join(root, '.test-build', 'authority');
mkdirSync(out, { recursive: true });
const bundle = join(out, 'authority.mjs');
execFileSync('npx', [
  'esbuild', new URL('./credentialAuthority.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
]);
const A = await import(bundle);

// ---------------------------------------------------------------------------
console.log('\nA correction supersedes. It never overwrites.\n');

const v1 = {
  id: 'IGUC-BTH-2026-00125-v1',
  credentialRef: 'IGUC-BTH-2026-00125',
  version: 1,
  state: 'current',
  issuedAt: '2026-07-18T10:00:00.000Z',
  documentHash: 'hash-one',
};

const { superseded, created } = A.amend(v1, {
  reason: 'Surname corrected following student request #4471',
  documentHash: 'hash-two',
  issuedAt: '2026-08-08T09:00:00.000Z',
});

check('the original is not mutated', v1.state, 'current');
check('…it is returned separately, marked superseded', superseded.state, 'superseded');
check('…and keeps its own hash, so the seal it was issued under still checks out', superseded.documentHash, 'hash-one');
check('…and keeps its own issue date', superseded.issuedAt, '2026-07-18T10:00:00.000Z');

check('the new version is version 2', created.version, 2);
check('…and points back at what it replaced', created.supersedesId, v1.id);
check('…and records why', created.reason, 'Surname corrected following student request #4471');

// THE POINT OF POINT 9.
check(
  'the credential NUMBER is the same on both versions',
  [superseded.credentialRef, created.credentialRef],
  ['IGUC-BTH-2026-00125', 'IGUC-BTH-2026-00125'],
);

let threw = null;
try { A.amend(v1, { reason: '   ' }); } catch (e) { threw = e.message; }
check('an amendment with no stated reason is refused', /stated reason/.test(threw ?? ''), true);

threw = null;
try { A.amend({ ...v1, state: 'revoked' }, { reason: 'x' }); } catch (e) { threw = e.message; }
check('a revoked credential cannot be quietly amended back into existence', /revoked/.test(threw ?? ''), true);

console.log('\nA QR printed on version 1 still finds the award\n');

const history = [superseded, created];

check(
  'scanning the OLD document reports superseded, not invalid',
  A.verify(v1.id, history).outcome,
  'superseded',
);
check(
  '…and the sentence says the award stands',
  /The award itself stands/.test(A.verify(v1.id, history).message),
  true,
);
check(
  '…and names the version that replaced it',
  /Version 1 was replaced by version 2/.test(A.verify(v1.id, history).message),
  true,
);
check(
  '…and carries the reason across, so the employer is not left guessing',
  /Surname corrected following student request #4471/.test(A.verify(v1.id, history).message),
  true,
);
check('scanning the current document reports valid', A.verify(created.id, history).outcome, 'valid');
check('an unknown reference is not found', A.verify('made-up', history).outcome, 'not-found');

const revokedHistory = [superseded, { ...created, state: 'revoked' }];
check(
  'once the award is revoked, even the old print reports revoked rather than superseded',
  A.verify(v1.id, revokedHistory).outcome,
  'revoked',
);

check('the current version is the one that is not superseded', A.currentVersion(history).version, 2);
check('history is newest first', A.historyOf(history).map((v) => v.version), [2, 1]);

console.log('\nNobody mistakes an institutional certificate for a degree\n');

check(
  'a ministry credential cannot be flagged academic',
  A.problemsWithType({ name: 'Certificate of Ordination', code: 'ORD', category: 'ministry', isAcademic: true, validity: 'permanent' }).length,
  1,
);
check(
  'an honorary award cannot be flagged academic either',
  A.problemsWithType({ name: 'Doctor of Divinity, honoris causa', code: 'DD-HC', category: 'honorary', isAcademic: true, validity: 'permanent' }).length,
  1,
);
check(
  'an academic award may be',
  A.problemsWithType({ name: 'Bachelor of Theology', code: 'BTH', category: 'academic', isAcademic: true, validity: 'permanent' }),
  [],
);
check(
  'an expiring credential with no period is refused',
  A.problemsWithType({ name: 'CPD', code: 'CPD', category: 'professional', validity: 'expiring' }).length,
  1,
);
check(
  'a lower-case code is refused, because the code is printed in the number',
  A.problemsWithType({ name: 'Service', code: 'svc', category: 'institutional', validity: 'permanent' }).length,
  1,
);

// EVERY category gets a verifier note, including the academic one.
check(
  'every category tells a verifier what the document is',
  A.CREDENTIAL_CATEGORIES.filter((c) => !A.CATEGORY_PROFILES[c]?.verifierNote),
  [],
);
check(
  'only the academic category may carry an academic award',
  A.CREDENTIAL_CATEGORIES.filter((c) => A.CATEGORY_PROFILES[c].mayBeAcademic),
  ['academic'],
);
check(
  'a non-academic verifier note says in plain words that it is not a degree',
  ['professional', 'ministry', 'institutional', 'honorary']
    .filter((c) => !/not an academic degree|not earned|does not carry academic credit/i.test(A.CATEGORY_PROFILES[c].verifierNote)),
  [],
);

console.log('\nA student cannot correct their own certificate\n');

const move = (from, to, role, note) => A.canMove({ from, to, role, note }).allowed;

check('a student may submit and then withdraw', move('submitted', 'withdrawn', 'student'), true);
check('a student may NOT approve their own request', move('submitted', 'approved', 'student'), false);
check('…nor from under review', move('under_review', 'approved', 'student'), false);
check('…nor escalate it themselves', move('under_review', 'escalated', 'student'), false);

check('the registrar begins the review', move('submitted', 'under_review', 'registrar'), true);
check('the registrar may NOT approve — that is the Authority', move('under_review', 'approved', 'registrar'), false);
check('the registrar may escalate', move('under_review', 'escalated', 'registrar'), true);
check('the Authority approves', move('under_review', 'approved', 'superadmin'), true);
check('the Vice-Chancellor approves', move('escalated', 'approved', 'vice-chancellor'), true);

check('a submitted request cannot skip straight to approved by anyone', move('submitted', 'approved', 'superadmin'), false);
check('an approved request is closed', move('approved', 'rejected', 'superadmin'), false);
check('a rejected request is closed', move('rejected', 'approved', 'superadmin'), false);

check('a rejection with no note is refused', move('under_review', 'rejected', 'registrar'), false);
check('…and with one, allowed', move('under_review', 'rejected', 'registrar', 'The register matches the birth certificate supplied at admission.'), true);
check(
  '…and the refusal explains why the note is needed',
  /whether to appeal it or correct it/.test(A.canMove({ from: 'under_review', to: 'rejected', role: 'registrar' }).reason),
  true,
);

check(
  'the buttons a registrar sees on a request under review',
  A.movesFor('under_review', 'registrar').map((m) => m.to).sort(),
  ['escalated', 'rejected'],
);
check(
  'the buttons a student sees on the same request',
  A.movesFor('under_review', 'student').map((m) => m.to),
  ['withdrawn'],
);
check('a closed request offers nobody any buttons', A.movesFor('approved', 'superadmin'), []);

console.log('\nA template cannot be published with a field this system cannot fill\n');

const good = 'This is to certify that {{student.full_name}} was awarded the {{credential.title}} on {{date.conferred}}.';
check('the fields used are found', A.fieldsUsedBy(good).used, ['student.full_name', 'credential.title', 'date.conferred']);
check('…and none is unknown', A.fieldsUsedBy(good).unknown, []);

check(
  'a misspelled token is caught before publication, not on the certificate',
  A.fieldsUsedBy('Awarded to {{student.fullnme}}').unknown,
  ['student.fullnme'],
);
check(
  'a field that may render blank is flagged as conditional',
  A.fieldsUsedBy('with {{result.classification}}').conditional,
  ['result.classification'],
);
check(
  'whitespace inside the braces is tolerated',
  A.fieldsUsedBy('{{ student.full_name }}').used,
  ['student.full_name'],
);
check('a repeated token is listed once', A.fieldsUsedBy('{{date.issued}} {{date.issued}}').used, ['date.issued']);

// THE SECOND CALL MUST GIVE THE SAME ANSWER AS THE FIRST. The token pattern is
// a module-level /g regex, and a /g regex carries `lastIndex` between calls —
// so without an explicit reset, checking two templates in a row silently misses
// fields in the second one. The Studio checks every template in the library on
// one screen, which is exactly the loop that would hit it.
check(
  'checking a second template does not resume from where the first left off',
  [A.fieldsUsedBy(good).used.length, A.fieldsUsedBy(good).used.length, A.fieldsUsedBy(good).used.length],
  [3, 3, 3],
);

check(
  'rendering fills what it has',
  A.render(good, {
    'student.full_name': 'Emmanuel Nkeng',
    'credential.title': 'Bachelor of Theology',
    'date.conferred': '18 July 2026',
  }),
  'This is to certify that Emmanuel Nkeng was awarded the Bachelor of Theology on 18 July 2026.',
);
check(
  'a missing value renders as a visible marker, not as a blank that gets sealed',
  A.render('with {{result.classification}}', {}),
  'with [ classification ]',
);

console.log('\nThe audit trail reads as English, for somebody who was not there\n');

check(
  'a correction names the versions and the reason',
  A.describeEvent({
    id: '1', credentialRef: 'IGUC-BTH-2026-00125', action: 'corrected',
    fromVersion: 1, toVersion: 2, reason: 'Surname corrected following request #4471',
    actorRole: 'vice-chancellor', actorEmail: 'vc@iguc.net', occurredAt: '2026-08-08',
  }),
  'vice-chancellor (vc@iguc.net) corrected IGUC-BTH-2026-00125 from version 1 to version 2 — Surname corrected following request #4471',
);
check(
  'a revocation without a reason still names who did it',
  A.describeEvent({ id: '2', credentialRef: 'X-1', action: 'revoked', actorRole: 'superadmin', occurredAt: '2026-08-08' }),
  'superadmin revoked X-1',
);
check('printing needs no justification', A.needsReason('printed'), false);
check('emailing needs none either', A.needsReason('emailed'), false);
check('revoking does', A.needsReason('revoked'), true);
check('correcting does', A.needsReason('corrected'), true);
check('rejecting a student’s correction does', A.needsReason('correction_rejected'), true);

console.log('\nWhat the Authority may do depends on the state of the document\n');

const cur = { ...created, state: 'current' };
check(
  'the Authority may amend, reissue, revoke, print and email a current credential',
  A.actionsFor(cur, 'superadmin').sort(),
  ['amend', 'email', 'print', 'reissue', 'revoke', 'verify', 'view'],
);
check(
  'a superseded version may be viewed, verified and printed — but never amended again',
  A.actionsFor({ ...cur, state: 'superseded' }, 'superadmin').sort(),
  ['print', 'verify', 'view'],
);
check(
  'a revoked credential may still be viewed and verified, because that is what it is for',
  A.actionsFor({ ...cur, state: 'revoked' }, 'superadmin').sort(),
  ['reinstate', 'verify', 'view'],
);
check(
  'the Registrar prints and emails; they do not amend or revoke',
  A.actionsFor(cur, 'registrar').sort(),
  ['email', 'print', 'verify', 'view'],
);
check(
  'a student may only view and verify',
  A.actionsFor(cur, 'student').sort(),
  ['verify', 'view'],
);
check(
  'a lecturer gets no more than a student',
  A.actionsFor(cur, 'lecturer').sort(),
  ['verify', 'view'],
);

console.log('\nThe library and the migration agree\n');

const sql = readFileSync(join(root, 'docs/migrations/013_social_and_credential_authority.sql'), 'utf8');

const actionsInDb = (sql.match(/action\s+text not null check \(action in\s*\n?([\s\S]*?)\)\),/) ?? [])[1];
check(
  'every audit action the code writes is one the database accepts',
  A.AUDIT_ACTIONS.filter((a) => !new RegExp(`'${a}'`).test(actionsInDb ?? '')),
  [],
);

const categoriesInDb = (sql.match(/category\s+text not null check \(category in\s*\n?\s*\(([^)]+)\)/) ?? [])[1];
check(
  'every category the code offers is one the database accepts',
  A.CREDENTIAL_CATEGORIES.filter((c) => !new RegExp(`'${c}'`).test(categoriesInDb ?? '')),
  [],
);

const statesInDb = (sql.match(/status\s+text not null default 'submitted' check \(status in\s*\n?\s*\(([^)]+)\)/) ?? [])[1];
check(
  'every correction state the code can reach is one the database accepts',
  A.CORRECTION_STATES.filter((s) => !new RegExp(`'${s}'`).test(statesInDb ?? '')),
  [],
);

console.log(failures === 0
  ? '\nNothing is overwritten, nothing is misclassified, and no student corrects their own record.'
  : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
