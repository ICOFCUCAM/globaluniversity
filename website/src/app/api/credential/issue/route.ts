// ---------------------------------------------------------------------------
// Issuing a credential, and revoking one.
//
// This is the route that turns "the university signed a string" into "the
// university issued this credential to this person on this date, and it still
// stands". Everything the Credential Studio designs is a form; this is the act.
//
// POST   issue a credential and write it to the register
// PATCH  revoke one, with a reason
//
// WHAT ISSUING DOES, IN ORDER:
//
//   1. Reads the award facts from the DATABASE, not from the request. The
//      caller names a student; it does not get to say what they were awarded.
//   2. Mints a non-sequential credential number.
//   3. Computes the SHA-256 over the canonical statement of the award.
//   4. Seals it, and renders the QR from the link it signed.
//   5. Writes the register row — which is what makes the credential exist.
//
// The register row is written BEFORE the document is returned. A credential the
// holder possesses but the university has no record of is the exact failure the
// register was built to prevent, and it is better to fail with nothing issued
// than to succeed with something unverifiable.
//
// WHO MAY DO IT. Issuing an award certificate is 'publish-credential-template'
// — a system capability, so the Superadministrator alone. That is deliberately
// tighter than printing one: a certificate is the university's most consequential
// statement about a person, and the office that designs credentials is the
// office that answers for them. Revocation is the same capability, because an
// institution that can withdraw a degree more easily than it can confer one has
// the balance the wrong way round.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import {
  newCredentialId, contentHash, sealAward, awardFields, verificationQrSvg, AWARD_FORMAT,
} from '@/lib/documentSecurity';
import { UNIVERSITY } from '@/lib/constants';
import { getClassification } from '@/lib/grading';
import { awardWording, awardKindOf } from '@/lib/awards';

export const runtime = 'nodejs';

const SITE = process.env.SITE_URL ?? `https://${UNIVERSITY.website.replace(/^www\./, '')}`;

export async function POST(request: Request) {
  const g = await guard(request, 'publish-credential-template');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let body: {
    studentId?: string;
    award?: string;
    templateVersion?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }
  if (!body.studentId || !body.award?.trim()) {
    return NextResponse.json({ ok: false, error: 'missing-student-or-award' }, { status: 400 });
  }

  const { data: student, error: readErr } = await admin
    .from('students')
    .select('id, student_number, matric_no, first_name, middle_name, last_name, program, status')
    .eq('id', body.studentId)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ ok: false, error: `lookup-failed: ${readErr.message}` }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json({ ok: false, error: 'student-not-found' }, { status: 404 });
  }

  // A certificate is a statement that someone completed a programme. Issuing one
  // to a record that is not marked graduated would be the university attesting
  // to something its own register denies.
  if (String(student.status ?? '').toLowerCase() !== 'graduated') {
    return NextResponse.json({
      ok: false,
      error: 'not-graduated',
      detail:
        `This record stands at "${student.status}". A degree certificate states that the holder ` +
        'completed the programme; it cannot be issued before the record says so.',
    }, { status: 409 });
  }

  // ---------------------------------------------------------------------
  // THE CLASSIFICATION IS COMPUTED, NEVER SUPPLIED.
  //
  // It used to be a field on the request body. That meant the caller stated
  // what class of degree the university was awarding — so the difference
  // between a Second Class and a First was a value in a JSON payload, decided
  // by whoever pressed the button rather than by the marks. An issuing route
  // that accepts the classification is not issuing a credential; it is
  // transcribing an assertion.
  //
  // It now comes from the student's cumulative GPA, through the same
  // classification bands the regulations publish and the transcript prints. A
  // certificate and a transcript for the same graduate cannot now disagree,
  // because there is one function and both call it.
  // ---------------------------------------------------------------------
  const { data: gpaRow, error: gpaErr } = await admin
    .from('semester_gpas')
    .select('cgpa, basis, academic_year, semester')
    .eq('student_id', student.id)
    .order('academic_year', { ascending: false })
    .order('semester', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (gpaErr) {
    return NextResponse.json({ ok: false, error: `gpa-lookup-failed: ${gpaErr.message}` }, { status: 500 });
  }
  const cgpa = Number(gpaRow?.cgpa);
  if (!gpaRow || !Number.isFinite(cgpa)) {
    // Refusing is the only honest answer. A certificate states a class of
    // degree; with no cumulative GPA on the record there is nothing to state,
    // and printing one without a classification — or with a guessed one —
    // would have the university attesting to a result it has not computed.
    return NextResponse.json({
      ok: false,
      error: 'no-cgpa',
      detail:
        'This student has no cumulative GPA on record, so the class of the award cannot be ' +
        'determined. A certificate states a classification and the university does not guess it. ' +
        'Post the results and recompute the GPA before issuing.',
    }, { status: 409 });
  }
  // A PROVISIONAL average may not confer a degree.
  //
  // basis is 'approved' only when every mark counted has been through the
  // lecturer → HOD → Dean → Registrar chain. Marks are saved as drafts and
  // stay there until somebody approves them, so an average computed today is
  // provisional — useful to the student and to their adviser, and not a thing
  // the university may put its seal on. There is no such thing as a
  // mostly-approved average.
  if (gpaRow.basis !== 'approved') {
    return NextResponse.json({
      ok: false,
      error: 'provisional-cgpa',
      detail:
        'This student\'s cumulative GPA was computed from marks that have not been approved. A ' +
        'certificate states a class of degree and the university cannot attest to one on draft ' +
        'marks. Take the results through the approval chain, recompute, and issue.',
    }, { status: 409 });
  }

  const classification = getClassification(cgpa);

  const holderName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(' ');
  const issuedOn = new Date().toISOString().slice(0, 10);
  const credentialId = newCredentialId(body.award, new Date().getFullYear());

  const facts = {
    credentialId,
    holderName,
    award: body.award.trim(),
    classification,
    programme: student.program ?? undefined,
    issuedOn,
  };

  const seal = sealAward(facts, SITE);
  if (!seal.sealed) {
    // Refusing is the right answer. An unsealed certificate on the register is a
    // row that can never be sealed afterwards without changing what was issued,
    // so it would be permanently unverifiable.
    return NextResponse.json({
      ok: false,
      error: 'credential-secret-not-set',
      detail:
        'CREDENTIAL_SECRET is not set on the server, so nothing can be sealed. A certificate ' +
        'issued now could never be verified, and could not be sealed later without changing ' +
        'what was issued. Set the key and issue again.',
    }, { status: 503 });
  }

  const hash = contentHash(AWARD_FORMAT, 'Degree Certificate', awardFields(facts));

  // The register row first. A credential in a graduate's hand that the
  // university has no record of is the failure this whole system exists to
  // prevent — better to fail with nothing issued.
  const { error: regErr } = await admin.from('credentials_issued').insert({
    credential_id: credentialId,
    kind: 'certificate',
    student_id: student.id,
    student_number: student.student_number ?? student.matric_no,
    holder_name: holderName,
    award: facts.award,
    classification: facts.classification ?? null,
    programme: facts.programme ?? null,
    facts: awardFields(facts),
    content_hash: hash,
    seal_code: seal.code,
    template_version: body.templateVersion ?? null,
    issued_by: caller.id,
  });
  if (regErr) {
    return NextResponse.json({
      ok: false,
      error: `not-registered: ${regErr.message}`,
      detail: 'Nothing was issued. The credential register refused the entry.',
    }, { status: 500 });
  }

  const auditErr = await audit(admin, {
    action: 'credential.issued',
    entityType: 'credential',
    entityId: credentialId,
    performedBy: caller.id,
    details: {
      student_id: student.id, award: facts.award, hash,
      cgpa, classification, by_email: caller.email,
    },
  });

  return NextResponse.json({
    ok: true,
    credential: {
      credentialId,
      holderName,
      award: facts.award,
      classification: facts.classification ?? null,
      programme: facts.programme ?? null,
      issuedOn,
      // The wording the certificate prints for this award. A degree is
      // "admitted to the Degree of"; a diploma is not a degree and saying so
      // would be false on its face.
      wording: awardWording(awardKindOf(facts.award)),
      cgpa,
      contentHash: hash,
      sealCode: seal.code,
      // The short form. See DocumentSeal.shortVerifyUrl: the long URL encodes
      // as an 87-module QR, which at the size a certificate can spare is a
      // quarter of a millimetre a module and does not scan off paper.
      qrSvg: await verificationQrSvg(seal.shortVerifyUrl, 84),
    },
    auditWarning: auditErr ?? undefined,
  });
}

export async function PATCH(request: Request) {
  const g = await guard(request, 'revoke-credential');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let body: { credentialId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }
  if (!body.credentialId || !body.reason?.trim()) {
    // The database enforces this too. It is checked here as well so the desk
    // gets a sentence rather than a Postgres exception.
    return NextResponse.json({
      ok: false,
      error: 'missing-credential-or-reason',
      detail: 'A revocation must state its reason. It becomes part of the permanent record.',
    }, { status: 400 });
  }

  const { data: row, error } = await admin
    .from('credentials_issued')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by: caller.id,
      revocation_reason: body.reason.trim(),
    })
    .eq('credential_id', body.credentialId)
    .eq('status', 'issued')
    .select('credential_id, holder_name, award')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: `revocation-refused: ${error.message}` }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({
      ok: false,
      error: 'not-revocable',
      detail: 'No credential with that number is currently issued. It may already be revoked — ' +
        'and a revoked credential cannot be revoked again, or reinstated.',
    }, { status: 409 });
  }

  const auditErr = await audit(admin, {
    action: 'credential.revoked',
    entityType: 'credential',
    entityId: body.credentialId,
    performedBy: caller.id,
    details: { reason: body.reason.trim(), holder: row.holder_name, by_email: caller.email },
  });

  return NextResponse.json({ ok: true, revoked: row, auditWarning: auditErr ?? undefined });
}
