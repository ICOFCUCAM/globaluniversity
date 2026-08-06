// ---------------------------------------------------------------------------
// Issuing a student identity card.
//
// WHY A ROUTE, WHEN THE CARD IS DRAWN IN THE BROWSER.
//
// The card used to be rendered entirely from the row the register happened to
// be holding, and its QR encoded that same row. So the QR confirmed nothing:
// a scanner read back whatever the card said. Change the name in the browser's
// memory before printing and the QR agreed with the change.
//
// A card is only worth scanning if what comes back is what the UNIVERSITY
// holds, not what the machine that printed it said. So the card is issued
// here: this route reads the student from the database with the service-role
// key, decides whether a card may be issued at all, computes the expiry, and
// seals the result. The browser draws what it is given and cannot add to it.
//
// WHAT IS SEALED, AND WHY THE EXPIRY IS IN IT.
//
// Name, date of birth, student number, programme, issue date and expiry, under
// CREDENTIAL_SECRET. The expiry matters most: a card is worth forging mainly to
// extend it — a withdrawn student wanting another year of library access and
// examination entry changes one date. Sealed, that change breaks the code.
//
// WHAT IT STILL DOES NOT DO. A valid seal proves the university issued a card
// with these particulars and this expiry. It does not prove the holder is still
// enrolled today: a student suspended the week after the card was printed
// carries a card that still verifies. Closing that needs /verify to check the
// register live rather than only re-computing the signature, which needs an
// issuance record this system does not yet have. /verify says "sealed", never
// "valid", for exactly this reason.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { sealCard, verificationQrSvg, newCredentialId, contentHash } from '@/lib/documentSecurity';
import { UNIVERSITY } from '@/lib/constants';

export const runtime = 'nodejs';

/**
 * A card is issued on registration, by the office that keeps the register.
 *
 * 'create-student-record' is the Registrar's, and the Administrator and
 * Superadministrator hold it too. Finance does not, and neither does the
 * Admissions Office: admitting somebody and issuing them an identity document
 * are different acts, and the second one follows registration.
 */
const CAPABILITY = 'create-student-record' as const;

/** The statuses that are not yet — or no longer — a registered student. */
const NOT_ENROLLED = new Set([
  'applicant', 'fee_paid', 'registrar_approved', 'documents_required',
  'rejected', 'deferred', 'withdrawn', 'suspended',
]);

const SITE = process.env.SITE_URL ?? `https://${UNIVERSITY.website.replace(/^www\./, '')}`;

export async function POST(request: Request) {
  const g = await guard(request, CAPABILITY);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin } = g;

  let body: { studentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }
  if (!body.studentId) {
    return NextResponse.json({ ok: false, error: 'missing-student-id' }, { status: 400 });
  }

  const { data: student, error } = await admin
    .from('students')
    .select('id, matric_no, student_number, first_name, middle_name, last_name, date_of_birth, program, degree_type, status, photo_url')
    .eq('id', body.studentId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: `lookup-failed: ${error.message}` }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json({ ok: false, error: 'student-not-found' }, { status: 404 });
  }

  // The two reasons a card is refused, returned together rather than one at a
  // time — a registrar fixing a record should be told everything that is
  // missing, not sent back for the second thing after fixing the first.
  const refusals: { code: string; message: string }[] = [];
  if (NOT_ENROLLED.has(String(student.status ?? '').toLowerCase())) {
    refusals.push({
      code: 'not-enrolled',
      message:
        `This record stands at "${student.status}". A student card is issued on registration, ` +
        'after the Admissions Office has admitted the applicant — a card issued before that says ' +
        'the university has accepted someone it has not.',
    });
  }
  if (!student.photo_url) {
    refusals.push({
      code: 'no-photograph',
      message:
        'There is no photograph on file. A card without a face cannot be checked against the ' +
        'person carrying it, which is the only thing it is for. Add a photograph to the student ' +
        'record and print the card again.',
    });
  }
  if (refusals.length) {
    return NextResponse.json({ ok: false, error: 'cannot-issue', refusals }, { status: 409 });
  }

  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(' ');
  const idNumber = student.student_number || student.matric_no;
  const programme = [student.degree_type, student.program].filter(Boolean).join(' · ');

  // One year from today, renewed on registration for the following semester.
  // Issued today, because a card is issued when it is printed — not when the
  // holder was admitted, which is what the old seven-year window measured from.
  const issued = new Date();
  const expires = new Date(issued);
  expires.setFullYear(expires.getFullYear() + 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const dateOfBirth = student.date_of_birth
    ? new Date(student.date_of_birth).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      }).toUpperCase()
    : undefined;

  // ---------------------------------------------------------------------
  // THE CARD GOES ON THE REGISTER.
  //
  // It did not, and that broke the scan. The QR carried the full signed
  // payload, which encodes as an 83-module symbol — 0.23mm a module at the
  // 19mm a card can spare, against the ~0.5mm a phone camera needs off card
  // stock. Unreadable at the gate, the library desk and the examination hall
  // the card exists for, and unreadable in a way that looks exactly like a
  // working QR.
  //
  // Shortening the URL to the student number seemed to fix it and was worse: a
  // short URL resolves against the credential register, and a card that is not
  // ON the register resolves to "no credential with this number has been
  // issued". A genuine card would have scanned as a forgery.
  //
  // So the card is registered, like every other credential. The register's kind
  // enum has allowed 'student-card' since it was written. Three things follow
  // that are worth having in their own right: a scan resolves to the
  // university's record rather than to the card's own copy of it, a lost card
  // can be REVOKED, and the university can say how many are in circulation.
  // ---------------------------------------------------------------------
  const credentialId = newCredentialId('Student Card', issued.getFullYear());

  const seal = sealCard(
    {
      credentialId,
      fullName,
      dateOfBirth,
      studentNumber: idNumber,
      programme,
      issuedOn: iso(issued),
      expiresOn: iso(expires),
    },
    SITE,
  );

  if (seal.sealed) {
    // Superseding rather than duplicating: a student holds one current card, so
    // reissuing marks the previous one replaced. Without this the register
    // would fill with every card a student had ever been given, all of them
    // reading as current.
    await admin
      .from('credentials_issued')
      .update({ status: 'replaced' })
      .eq('student_id', student.id)
      .eq('kind', 'student-card')
      .eq('status', 'issued');

    const { error: regErr } = await admin.from('credentials_issued').insert({
      credential_id: credentialId,
      kind: 'student-card',
      student_id: student.id,
      student_number: idNumber,
      holder_name: fullName,
      programme,
      facts: {
        name: fullName, date_of_birth: dateOfBirth ?? '', student_number: idNumber,
        programme, issued: iso(issued), expires: iso(expires),
      },
      content_hash: contentHash('ICOFGU-CARD-V1', 'Student Identity Card', {
        name: fullName, date_of_birth: dateOfBirth, student_number: idNumber,
        programme, issued: iso(issued), expires: iso(expires),
      }),
      seal_code: seal.code,
    });
    if (regErr) {
      // Refuse rather than hand over a card the register has no row for — it
      // would scan as "not issued", which is the failure this whole change
      // exists to prevent.
      return NextResponse.json({
        ok: false,
        error: `not-registered: ${regErr.message}`,
        detail: 'No card was issued. The credential register refused the entry.',
      }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    credentialId,
    card: {
      fullName,
      idNumber,
      dateOfBirth: dateOfBirth ?? null,
      programme,
      photoUrl: student.photo_url,
      issuedOn: iso(issued),
      expiresOn: iso(expires),
    },
    seal: {
      sealed: seal.sealed,
      code: seal.code,
      // Rendered here rather than in the browser: the QR must encode the link
      // this route computed, and a QR the page builds for itself is a QR the
      // page could build for anything.
      // The short form. The signed payload encodes as an 83-module symbol,
      // which at the 19mm a card can spare is 0.23mm a module — well under the
      // 0.5mm a phone camera needs off a printed card, so the QR on every card
      // issued would have failed to scan at the gate it was made for.
      qrSvg: seal.sealed ? await verificationQrSvg(seal.shortVerifyUrl, 64) : null,
    },
  });
}
