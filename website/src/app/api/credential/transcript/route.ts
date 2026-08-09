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
  newCredentialId, contentHash, sealAward, awardFields, AWARD_FORMAT, verificationQrSvg,
} from '@/lib/documentSecurity';
import { buildTranscript, canIssueTranscript, creditsEarned } from '@/lib/transcript';
import { can } from '@/lib/roles';
import { signContentHash } from '@/lib/documentSignature';
import { UNIVERSITY } from '@/lib/constants';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? UNIVERSITY.website;

/**
 * The study modes the University teaches in, as migration 019 constrains them.
 *
 * CHECKED ON THE SERVER as well as offered in a dropdown. A value outside this
 * list would be sealed onto a transcript describing a mode of study the
 * University does not offer.
 */
const MODES = ['on-campus', 'online', 'distance', 'blended'];

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
      /**
       * The name in the three columns the sheet prints.
       *
       * Typed apart rather than split from `holderName`, because a surname is
       * not recoverable from a full name — two-word surnames are ordinary, and
       * a wrong guess prints the wrong word under "Surname" on a sealed
       * document that cannot be corrected without reissuing it.
       */
      surname?: string;
      firstNames?: string;
      middleName?: string;
      studentNumber?: string;
      programme?: string;
      /** Where the figures came from. Required, and printed on the document. */
      sourceRecord?: string;
      /** The award, by title. Decides whether a class is printed at all. */
      award?: string;
      /**
       * THE DATE THE UNIVERSITY IS RECORDED AS HAVING ISSUED THIS.
       *
       * A transcript transcribed for a 2011 graduate may legitimately need to
       * bear a date in the past — the University did issue them a record then,
       * and a document dated today misrepresents when it was made.
       *
       * It does NOT back-date the register. `issued_at` on the row is the
       * moment this was actually written, and the audit entry records both, so
       * the trail cannot be used to claim the University issued something
       * before it did.
       */
      issuedOn?: string;
      dateOfBirth?: string;
      placeOfBirth?: string;
      sex?: string;
      studentAddress?: string;
      /** on-campus | online | distance | blended. Never assumed. */
      modeOfStudy?: string;
      campus?: string;
      specialization?: string;
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

  // The result is cast below: a `.select()` built by concatenation is a plain
  // string to the generated Supabase types, so they infer nothing from it. The
  // columns are named explicitly in the query and every one exists in the
  // schema — schemaContract.test.mjs checks exactly that.
  const { data: studentRow, error: readErr } = await admin
    .from('students')
    // THE IDENTITY THE TRANSCRIPT PRINTS, not just the name and the programme.
    // Migration 019 added study mode, campus, specialization and the admission
    // and completion dates precisely so the sheet could carry them — and this
    // query did not select one of them, so every derived transcript printed a
    // dash where the University's own record had an answer.
    .select('id, student_number, matric_no, first_name, middle_name, last_name, program, status, '
      + 'date_of_birth, place_of_birth, gender, nationality, address, '
      + 'campus, mode_of_study, specialization, admitted_on, completed_on, academic_standing, '
      + 'admission_year, expected_graduation')
    .eq('id', body.studentId)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ ok: false, error: `lookup-failed: ${readErr.message}` }, { status: 500 });
  }
  if (!studentRow) {
    return NextResponse.json({ ok: false, error: 'student-not-found' }, { status: 404 });
  }
  const student = studentRow as unknown as Record<string, any>;

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

  // SIGNED WITH THE UNIVERSITY'S OWN KEY, so the document can be checked by
  // somebody who has never heard of this website. Absent key, absent signature,
  // and the credential is issued and sealed exactly as before — see
  // documentSignature.ts for why refusing here would be the wrong trade.
  const signed = signContentHash(hash);

  const { data: registered, error: regErr } = await admin.from('credentials_issued').insert({
    credential_id: credentialId,
    kind: 'transcript',
    signature: signed.signature,
    signing_key_id: signed.keyId,
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
      // THE NAME IN THREE PARTS, because the transcript prints Surname, First
      // Names and Middle Name as three columns and a single string cannot be
      // split back with certainty. "Grace Nalova Meyembi" is one surname or
      // two depending on the family, and guessing puts the wrong word under
      // "Surname" on a sealed document.
      holder_surname: student.last_name ?? '',
      holder_first_names: student.first_name ?? '',
      holder_middle_name: student.middle_name ?? '',
      // SEALED WITH THE RECORD, not read at render time. A student who moves
      // campus after graduating must not retrospectively change the campus on
      // a transcript the University already issued.
      //
      // THE STUDY MODE IS NOT ASSUMED. The University teaches on campus, online
      // and at a distance; a transcript that omits which one leaves a receiving
      // institution to guess, and one that defaults to 'online' tells them
      // something about the holder that may be false.
      campus: student.campus ?? null,
      mode_of_study: student.mode_of_study ?? null,
      specialization: student.specialization ?? null,
      nationality: student.nationality ?? null,
      date_of_birth: student.date_of_birth ?? null,
      place_of_birth: student.place_of_birth ?? null,
      sex: student.gender ?? null,
      student_address: student.address ?? null,
      admitted_on: student.admitted_on ?? null,
      completed_on: student.completed_on ?? null,
      academic_standing: student.academic_standing ?? null,
      degree_status: student.status === 'graduated' ? 'Completed'
        : student.status === 'withdrawn' ? 'Withdrawn' : 'In progress',
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
      // THE QR THE DOCUMENT WILL CARRY, returned so the screen that just issued
      // it shows the real code rather than the "QR on issue" placeholder. The
      // printed and emailed copies always had one; the preview did not, so a
      // registrar looking at a sealed transcript saw a dashed box and could not
      // tell whether the QR had failed.
      qrSvg: await verificationQrSvg(
        `${SITE}/verify?id=${encodeURIComponent(credentialId)}`, 104,
      ).catch(() => null),
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
  const surname = String(m.surname ?? '').trim();
  const firstNames = String(m.firstNames ?? '').trim();
  const middleName = String(m.middleName ?? '').trim();
  // The parts are the record; the full name is assembled from them so the two
  // can never disagree. A caller that only knows the whole name still works.
  const holderName = [firstNames, middleName, surname].filter(Boolean).join(' ')
    || String(m.holderName ?? '').trim();
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
    student: {
      first_name: firstNames || holderName,
      middle_name: middleName,
      last_name: surname,
      matric_no: m.studentNumber ?? '',
    } as never,
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

  const today = new Date().toISOString().slice(0, 10);
  // THE DOCUMENT'S DATE, which may be in the past. Refused if it is in the
  // future: a transcript the University has not yet issued is not a record.
  const backDated = String(m.issuedOn ?? '').trim();
  if (backDated && backDated > today) {
    return NextResponse.json({
      ok: false,
      error: 'issue-date-in-the-future',
      detail: 'A transcript cannot bear a date the University has not reached. Historical records '
        + 'may be back-dated; forward-dated ones cannot be issued.',
    }, { status: 400 });
  }
  const issuedOn = backDated || today;
  const credentialId = newCredentialId('TRANSCRIPT', Number(issuedOn.slice(0, 4)) || new Date().getFullYear());

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

  const signed = signContentHash(hash);

  const { data: registered, error: regErr } = await admin.from('credentials_issued').insert({
    credential_id: credentialId,
    kind: 'transcript',
    signature: signed.signature,
    signing_key_id: signed.keyId,
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
      date_of_birth: m.dateOfBirth ?? null,
      place_of_birth: m.placeOfBirth ?? null,
      sex: m.sex ?? null,
      student_address: m.studentAddress ?? null,
      // NOT DEFAULTED. A blank study mode prints nothing; a guessed one states
      // how somebody studied, which is a fact about them the archive may not
      // support.
      mode_of_study: MODES.includes(String(m.modeOfStudy ?? '')) ? m.modeOfStudy : null,
      campus: m.campus ?? null,
      specialization: m.specialization ?? null,
      // BOTH DATES ON THE RECORD. The document bears `issued_on`; this says
      // when the row was actually written, so a back-dated transcript can
      // never be read as evidence the University issued it then.
      transcribed_on: today,
      holder_surname: surname,
      holder_first_names: firstNames,
      holder_middle_name: middleName,
      cgpa: transcript.cgpa,
      credits_attempted: transcript.totalCredits,
      // EARNED IS NOT ATTEMPTED. This recorded every credit as earned, so a
      // transcribed record carrying an F printed the same figure in both
      // totals and overstated what the holder had passed. A transcribed row
      // has no percentage to compare against a pass mark, so the grade point
      // is the evidence: zero points is a fail on the University's scale.
      credits_earned: usable.reduce(
        (t: number, c: typeof usable[number]) => (c.gradePoint > 0 ? t + c.creditUnit : t),
        0,
      ),
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
      document_dated: issuedOn,
      actually_written: today,
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
      qrSvg: await verificationQrSvg(
        `${SITE}/verify?id=${encodeURIComponent(credentialId)}`, 104,
      ).catch(() => null),
      issuedOn,
      transcribed: true,
      omitted: [],
      auditWarning: auditErr
        ? `The credential was issued but the audit entry failed: ${auditErr}`
        : null,
    },
  });
}
