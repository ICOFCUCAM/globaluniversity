// ---------------------------------------------------------------------------
// ISSUING A TRANSCRIPT.
//
// POST { studentId, templateVersion? }
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SEPARATE ROUTE FROM THE CERTIFICATE
// ---------------------------------------------------------------------------
//
// Not because the plumbing differs — the register entry, the seal and the audit
// entry below are deliberately identical to /api/credential/issue, because a
// second issuance path with its own audit behaviour is how a trail ends up with
// holes in it.
//
// It is separate because the ELIGIBILITY RULE IS THE OPPOSITE. A certificate may
// only be issued to a graduate: it states that someone completed a programme,
// and issuing one before the record says so is the University attesting to
// something its own register denies. A transcript is issued to a student who
// has NOT finished — for a visa, a transfer application, an employer, a
// scholarship — and refusing one until graduation would make it useless for
// every purpose a transcript actually serves.
//
// Folding both into one route would have meant a conditional around the single
// most important check in the certificate route, which is exactly where a
// conditional should not be.
//
// ---------------------------------------------------------------------------
// THE MARKS ARE READ HERE, NEVER ACCEPTED FROM THE CALLER
// ---------------------------------------------------------------------------
//
// The browser builds a transcript to display. The document that gets SEALED is
// built again, on the server, from the database. Otherwise the seal attests to
// whatever the client posted, and a sealed transcript with invented marks is
// strictly worse than an unsealed one — it carries the University's guarantee.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import {
  newCredentialId, contentHash, sealAward, awardFields, AWARD_FORMAT,
} from '@/lib/documentSecurity';
import { buildTranscript, canIssueTranscript, creditsEarned } from '@/lib/transcript';
import { UNIVERSITY } from '@/lib/constants';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? UNIVERSITY.website;

export async function POST(request: Request) {
  // The same capability as a certificate. Both put the University's name and
  // seal on a statement about a named person.
  const g = await guard(request, 'issue-credential');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let body: { studentId?: string; templateVersion?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }
  if (!body.studentId) {
    return NextResponse.json({ ok: false, error: 'missing-student' }, { status: 400 });
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

  // NOTE THE ABSENCE OF A GRADUATION CHECK. See the header — that absence is
  // the reason this route exists, not an oversight.

  const { data: results, error: resErr } = await admin
    .from('results')
    .select('total_score, grade, grade_point, status, courses(code, title, credit_unit, year, semester)')
    .eq('student_id', student.id);

  if (resErr) {
    return NextResponse.json({
      ok: false,
      error: `results-unreadable: ${resErr.message}`,
      detail: 'Nothing was issued. A transcript sealed from a partial read of the marks would '
        + 'understate the student’s record permanently.',
    }, { status: 500 });
  }

  const { data: transcript, omitted } = buildTranscript({
    student: student as never,
    department: { id: '', name: student.program ?? '' } as never,
    results: (results ?? []) as never,
  });

  const refusal = canIssueTranscript(transcript);
  if (refusal) {
    return NextResponse.json({ ok: false, error: 'nothing-to-transcribe', detail: refusal }, { status: 409 });
  }

  const holderName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(' ');
  const issuedOn = new Date().toISOString().slice(0, 10);
  const credentialId = newCredentialId('TRANSCRIPT', new Date().getFullYear());
  const earned = creditsEarned((results ?? []) as never);

  // WHAT THE SEAL COVERS. For a certificate it is the award and the class. For
  // a transcript it must cover the figures a reader relies on — the CGPA, the
  // credits and the class — because those are what a forger would alter. The
  // course list itself is covered through the content hash below.
  const facts = {
    credentialId,
    holderName,
    award: `Academic Transcript — ${student.program ?? 'Programme not recorded'}`,
    classification: transcript.classification,
    programme: student.program ?? undefined,
    issuedOn,
  };

  const seal = sealAward(facts, SITE);
  if (!seal.sealed) {
    return NextResponse.json({
      ok: false,
      error: 'credential-secret-not-set',
      detail: 'CREDENTIAL_SECRET is not set on the server, so nothing can be sealed. A transcript '
        + 'issued now could never be verified, and could not be sealed later without changing what '
        + 'was issued. Set the key and issue again.',
    }, { status: 503 });
  }

  // THE COURSE LIST IS IN THE HASH. Sealing only the summary would leave every
  // line of the transcript alterable while the seal still verified — which is
  // the one thing a transcript is read for.
  const hash = contentHash(AWARD_FORMAT, 'Academic Transcript', {
    ...awardFields(facts),
    cgpa: transcript.cgpa.toFixed(2),
    credits_attempted: String(transcript.totalCredits),
    credits_earned: String(earned),
    courses: transcript.years
      .flatMap((y) => y.semesters.flatMap((s) => s.courses.map(
        (c) => `${y.year}.${s.semester}:${c.code}:${c.grade}:${c.creditUnit}`,
      )))
      .join('|'),
  });

  const { data: registered, error: regErr } = await admin.from('credentials_issued').insert({
    credential_id: credentialId,
    kind: 'transcript',
    student_id: student.id,
    student_number: student.student_number ?? student.matric_no,
    holder_name: holderName,
    award: facts.award,
    classification: transcript.classification,
    programme: student.program ?? null,
    // The whole snapshot, so the document can be re-rendered exactly as issued
    // years later even if the marks are since corrected.
    facts: {
      ...awardFields(facts),
      cgpa: transcript.cgpa,
      credits_attempted: transcript.totalCredits,
      credits_earned: earned,
      years: transcript.years,
    },
    content_hash: hash,
    seal_code: seal.code,
    template_version: body.templateVersion ?? null,
    issued_by: caller.id,
  }).select('id').single();

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
      kind: 'transcript',
      student_id: student.id,
      hash,
      cgpa: transcript.cgpa,
      classification: transcript.classification,
      credits_attempted: transcript.totalCredits,
      credits_earned: earned,
      // RECORDED, BECAUSE IT EXPLAINS THE DOCUMENT. If six results were still
      // in the approval chain, this transcript is a snapshot that omits them,
      // and in a year nobody will remember why the totals look low.
      omitted,
      by_email: caller.email,
    },
  });

  return NextResponse.json({
    ok: true,
    credential: {
      id: registered?.id ?? null,
      credentialId,
      holderName,
      cgpa: transcript.cgpa,
      classification: transcript.classification,
      creditsAttempted: transcript.totalCredits,
      creditsEarned: earned,
      sealCode: seal.code,
      issuedOn,
      omitted,
      // Not a failure of the issue — the credential is on the register either
      // way — but the caller must be told the trail is incomplete.
      auditWarning: auditErr
        ? `The credential was issued but the audit entry failed: ${auditErr}`
        : null,
    },
  });
}
