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
import { can } from '@/lib/roles';
import { UNIVERSITY } from '@/lib/constants';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? UNIVERSITY.website;

export async function POST(request: Request) {
  // The same capability as a certificate. Both put the University's name and
  // seal on a statement about a named person.
  const g = await guard(request, 'issue-credential');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let body: {
    studentId?: string;
    templateVersion?: number;
    /**
     * A record the system never held — a year that predates this database.
     *
     * Typed from a paper register rather than derived from marks, because
     * there are no marks to derive it from. See the block that handles it.
     */
    manual?: {
      holderName?: string;
      studentNumber?: string;
      programme?: string;
      /** Where the figures came from. Required, and printed on the document. */
      sourceRecord?: string;
      /** The award, by title. Decides whether a class is printed at all. */
      award?: string;
      rows?: Array<{
        code?: string; title?: string; creditUnit?: number;
        grade?: string; gradePoint?: number; year?: number; semester?: number;
      }>;
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }
  // -------------------------------------------------------------------------
  // A TRANSCRIPT FOR A YEAR THIS DATABASE NEVER HELD.
  //
  // The University keeps records older than this system. A graduate of 2011
  // asking for a transcript, or another university asking for one on their
  // behalf, cannot be served by deriving it from marks — there are none. It
  // has to be transcribed from the paper register.
  //
  // Everything the approval chain guarantees is therefore ABSENT: no lecturer
  // submitted these marks here, no HOD or Dean approved them, no moderator saw
  // them. That is not a flaw to be hidden; it is a fact about the document,
  // and the safeguard is that it is recorded permanently rather than papered
  // over:
  //
  //   * only the Superadministrator may do it
  //   * the source of the figures must be stated and is printed on the sheet
  //   * `facts.source` is 'transcribed' on the register, for ever
  //   * the audit entry names who transcribed it and from what
  //
  // A transcribed transcript that is indistinguishable from a derived one is
  // the single most dangerous document this system could produce, because it
  // would carry the University's seal over figures nobody in the system ever
  // checked, with nothing to say so.
  // -------------------------------------------------------------------------
  if (body.manual) {
    if (!can(caller.role, 'transcribe-historical-record')) {
      return NextResponse.json({
        ok: false,
        error: 'not-permitted:transcribe-historical-record',
        detail:
          'Transcribing a record from outside this system is the Superadministrator’s alone. '
          + 'These figures were never seen by the approval chain, so the University is standing '
          + 'behind them on the strength of the archive and the person who typed them.',
      }, { status: 403 });
    }
    return transcribe(admin, caller, body);
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
    // The programme decides whether a class of award is printed — a doctoral
    // candidate's transcript must not carry one. Same table the certificate
    // uses, so the two documents cannot disagree.
    award: student.program ?? undefined,
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


/**
 * Transcribe a record from outside this system.
 *
 * SHARES THE REGISTER ENTRY, THE SEAL AND THE AUDIT SHAPE with the derived
 * path above, so a transcribed transcript verifies, versions and corrects
 * exactly like any other. What differs is what is written into `facts.source`
 * and printed on the sheet — and that difference is permanent.
 */
async function transcribe(
  admin: { from: (t: string) => any },
  caller: { id: string; email: string | null; role: string },
  body: { manual?: any; templateVersion?: number },
): Promise<Response> {
  const m = body.manual ?? {};
  const holderName = String(m.holderName ?? '').trim();
  const sourceRecord = String(m.sourceRecord ?? '').trim();
  const rows = Array.isArray(m.rows) ? m.rows : [];

  if (!holderName) {
    return NextResponse.json({ ok: false, error: 'missing-holder' }, { status: 400 });
  }

  // THE PROVENANCE IS NOT OPTIONAL AND A WORD IS NOT PROVENANCE. This is the
  // only thing standing between a sealed University document and "somebody
  // typed it". It is printed on the sheet, so a reader can weigh it.
  if (sourceRecord.length < 12) {
    return NextResponse.json({
      ok: false,
      error: 'missing-source',
      detail:
        'Say where these figures come from — the archived register, its volume and page, or the '
        + 'file reference. It is printed on the transcript and kept on the register, because a '
        + 'sealed document that cannot say where its marks came from is worth less than an '
        + 'unsealed one that can.',
    }, { status: 400 });
  }

  const usable = rows
    .filter((r: any) => String(r.code ?? '').trim() && Number(r.creditUnit) > 0)
    .map((r: any) => ({
      code: String(r.code).trim(),
      title: String(r.title ?? '').trim() || String(r.code).trim(),
      creditUnit: Number(r.creditUnit) || 0,
      grade: String(r.grade ?? '—').trim(),
      gradePoint: Number(r.gradePoint) || 0,
      year: Number(r.year) || 0,
      semester: Number(r.semester) || 0,
    }));

  if (usable.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'no-courses',
      detail: 'No course carried both a code and a credit unit above zero, so there is nothing to '
        + 'transcribe. A sealed transcript with no courses on it states that the holder completed '
        + 'nothing, permanently.',
    }, { status: 400 });
  }

  // The same grouping and arithmetic as the derived path — buildTranscript is
  // reused rather than reimplemented, so a transcribed transcript and a
  // derived one cannot compute a GPA differently.
  const { data: transcript } = buildTranscript({
    student: { first_name: holderName, last_name: '', matric_no: m.studentNumber ?? '' } as never,
    department: { name: m.programme ?? '' } as never,
    // APPLIED ON THE SERVER TOO. The screen suppresses the class for a
    // doctorate, but the screen is not the control — a request that omitted it
    // would otherwise seal "First Class Honours" onto a research degree.
    award: m.award ?? m.programme ?? undefined,
    results: usable.map((c: typeof usable[number]) => ({
      total_score: null,
      grade: c.grade,
      grade_point: c.gradePoint,
      status: 'approved',
      courses: {
        code: c.code, title: c.title, credit_unit: c.creditUnit,
        year: c.year, semester: c.semester,
      },
    })) as never,
  });

  const issuedOn = new Date().toISOString().slice(0, 10);
  const credentialId = newCredentialId('TRANSCRIPT', new Date().getFullYear());

  const facts = {
    credentialId,
    holderName,
    award: `Academic Transcript — ${m.programme ?? 'Programme not recorded'}`,
    classification: transcript.classification,
    programme: m.programme ?? undefined,
    issuedOn,
  };

  const seal = sealAward(facts, SITE);
  if (!seal.sealed) {
    return NextResponse.json({
      ok: false,
      error: 'credential-secret-not-set',
      detail: 'CREDENTIAL_SECRET is not set, so nothing can be sealed.',
    }, { status: 503 });
  }

  // THE PROVENANCE IS INSIDE THE HASH. If it were only a display field,
  // "transcribed from the 2011 register" could be edited off a stored document
  // and the seal would still verify.
  const hash = contentHash(AWARD_FORMAT, 'Academic Transcript (transcribed)', {
    ...awardFields(facts),
    source: 'transcribed',
    source_record: sourceRecord,
    cgpa: transcript.cgpa.toFixed(2),
    courses: usable.map((c: typeof usable[number]) => `${c.year}.${c.semester}:${c.code}:${c.grade}:${c.creditUnit}`).join('|'),
  });

  const { data: registered, error: regErr } = await admin.from('credentials_issued').insert({
    credential_id: credentialId,
    kind: 'transcript',
    // NO student_id. There is no record in this database to point at — that is
    // the whole reason this path exists. Inventing a student row to satisfy a
    // foreign key would put a person on the register who never enrolled here
    // under this system.
    student_number: m.studentNumber ?? null,
    holder_name: holderName,
    award: facts.award,
    classification: transcript.classification,
    programme: m.programme ?? null,
    facts: {
      ...awardFields(facts),
      source: 'transcribed',
      source_record: sourceRecord,
      transcribed_by: caller.email,
      cgpa: transcript.cgpa,
      credits_attempted: transcript.totalCredits,
      credits_earned: transcript.totalCredits,
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

  const auditErr = await audit(admin as never, {
    action: 'credential.transcribed',
    entityType: 'credential',
    entityId: credentialId,
    performedBy: caller.id,
    details: {
      kind: 'transcript',
      source: 'transcribed',
      source_record: sourceRecord,
      holder_name: holderName,
      student_number: m.studentNumber ?? null,
      cgpa: transcript.cgpa,
      courses: usable.length,
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
      creditsEarned: transcript.totalCredits,
      sealCode: seal.code,
      issuedOn,
      transcribed: true,
      omitted: [],
      auditWarning: auditErr
        ? `The credential was issued but the audit entry failed: ${auditErr}`
        : null,
    },
  });
}
