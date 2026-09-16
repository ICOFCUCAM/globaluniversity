// ---------------------------------------------------------------------------
// A REPLACEMENT CERTIFICATE.
//
//   POST /api/certificate/reissue  { action, ... }
//
//     request    the Registrar asks, with a reason and the original
//     authorise  the Vice-Chancellor or the Superadministrator permits it
//     reject     it will not be replaced, with a reason
//
// ---------------------------------------------------------------------------
// "THE SYSTEM MUST NEVER ALLOW SOMEONE TO SIMPLY GENERATE UNLIMITED COPIES"
// ---------------------------------------------------------------------------
//
// The University's §10. One authorisation permits one regeneration, and 101
// holds a unique partial index so that a certificate cannot carry two live
// authorisations at once — three requests approved in the morning and three
// replacements printed in the afternoon would each be individually within the
// rule and collectively the thing it forbids.
//
// ---------------------------------------------------------------------------
// AND AUTHORISING IS NOT SEEING THE DESIGN
// ---------------------------------------------------------------------------
//
// `authorise-certificate-reissue`, not `view-certificate-template`. They were
// one function in an early draft of 101 and the migration's own proof caught
// it: an officer expressly lent the certificate design under the ruling's §4
// exception could also authorise a replacement certificate, which nobody had
// granted and nobody intended.
//
// That is the University's §8 the other way round — holding one authority does
// not confer another — and it is why the Registrar, who may legitimately ASK
// for a replacement, cannot grant one.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

const MIN_DETAIL = 20;
const MIN_NOTE = 10;

/** 101's vocabulary, and the screen offers exactly these. */
const REASONS = ['lost', 'damaged', 'legal-name-change', 'correction'];

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (action === 'request') return ask(request, body);
  if (action !== 'authorise' && action !== 'reject') {
    return bad('unknown-action', 400,
      'A replacement certificate is requested, authorised or rejected.');
  }
  return decide(request, body, action);
}


/** The office that administers the graduate's record asks. */
async function ask(request: Request, body: Record<string, unknown>) {
  const g = await guard(request, 'issue-credential');
  if (!g.ok) {
    return NextResponse.json({
      ok: false, error: g.error,
      detail: 'Requesting a replacement certificate belongs to the offices that administer a '
        + 'graduate’s record.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const original = String(body.original ?? '');
  const reason = String(body.reason ?? '');
  const detail = String(body.detail ?? '').trim();

  if (!original) return bad('no-certificate', 400, 'Which certificate is being replaced?');
  if (!REASONS.includes(reason)) {
    return bad('no-reason', 400, `A replacement is one of: ${REASONS.join(', ')}.`);
  }
  if (detail.length < MIN_DETAIL) {
    return bad('no-detail', 400,
      `Say what happened — at least ${MIN_DETAIL} characters. The Vice-Chancellor reads this `
      + 'and has to decide on it.');
  }

  const { data: cert, error: readError } = await admin
    .from('credentials_issued')
    .select('id, credential_id, kind, holder_name, student_number, status')
    .eq('id', original)
    .maybeSingle();

  if (readError) return bad('cannot-read', 500, readError.message);
  if (!cert) {
    return bad('no-such-certificate', 404,
      'There is no certificate with that id on the register. A replacement for a certificate '
      + 'the University did not issue is not a replacement.');
  }
  if (cert.kind !== 'certificate' && cert.kind !== 'diploma') {
    return bad('not-a-certificate', 400, `That register entry is a ${cert.kind}.`);
  }

  // SAID BEFORE THE DATABASE REFUSES IT. 101's unique partial index holds this
  // whatever calls it; an officer told `unique_violation` learns nothing.
  const { data: live } = await admin
    .from('certificate_reissue_requests')
    .select('id, requested_at')
    .eq('original_credential', original)
    .eq('status', 'authorised')
    .maybeSingle();

  if (live) {
    return bad('already-authorised', 409,
      `${cert.credential_id} already has a replacement authorised and not yet issued. Issue `
      + 'that one, or have it rejected, before asking again — the University does not hold two '
      + 'live authorisations to replace one certificate.');
  }

  const { data, error } = await admin
    .from('certificate_reissue_requests')
    .insert({
      original_credential: original,
      reason,
      detail,
      requested_by: caller.id,
      requested_role: caller.role,
    })
    .select('id')
    .maybeSingle();

  if (error) return bad('not-requested', 500, error.message);

  await audit(admin, {
    action: 'certificate-reissue-requested',
    entityType: 'certificate_reissue_request',
    entityId: data?.id,
    performedBy: caller.id,
    details: {
      original: cert.credential_id, holder: cert.holder_name, reason, detail,
    },
  });

  return NextResponse.json({ ok: true, id: data?.id });
}


/** One of the two offices decides. */
async function decide(request: Request, body: Record<string, unknown>, action: string) {
  const g = await guard(request, 'authorise-certificate-reissue');
  if (!g.ok) {
    return NextResponse.json({
      ok: false, error: g.error,
      detail: 'Only the Vice-Chancellor or the Superadministrator may authorise a replacement '
        + 'certificate. Administering a graduate’s record, verifying their eligibility and '
        + 'issuing their certificate do not carry that authority.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const id = String(body.id ?? '');
  if (!id) return bad('no-request', 400, 'Which request?');

  const note = String(body.note ?? '').trim();
  if (action === 'reject' && note.length < MIN_NOTE) {
    return bad('no-reason', 400,
      `Say why — at least ${MIN_NOTE} characters. The officer who asked has to answer the `
      + 'graduate.');
  }

  const { data: row, error: readError } = await admin
    .from('certificate_reissue_requests')
    .select('id, status, original_credential, reason, requested_by')
    .eq('id', id)
    .maybeSingle();

  if (readError) return bad('cannot-read', 500, readError.message);
  if (!row) return bad('no-such-request', 404, 'There is no reissue request with that id.');
  if (row.status !== 'awaiting-authorisation') {
    return bad('not-waiting', 409, `That request is at “${row.status}”.`);
  }
  if (row.requested_by === caller.id) {
    return bad('your-own', 403,
      'You asked for this replacement, so you cannot also authorise it.');
  }

  const { error: writeError } = await admin
    .from('certificate_reissue_requests')
    .update({
      status: action === 'authorise' ? 'authorised' : 'rejected',
      ...(action === 'authorise'
        ? { authorised_by: caller.id, authorised_at: new Date().toISOString() }
        : { decision_note: note }),
    })
    .eq('id', id)
    .eq('status', 'awaiting-authorisation');

  if (writeError) return bad('not-decided', 409, writeError.message);

  await audit(admin, {
    action: action === 'authorise'
      ? 'certificate-reissue-authorised' : 'certificate-reissue-rejected',
    entityType: 'certificate_reissue_request',
    entityId: id,
    performedBy: caller.id,
    details: { reason: row.reason, ...(action === 'reject' ? { note } : {}) },
  });

  return NextResponse.json({
    ok: true,
    ...(action === 'authorise' ? {
      next: 'Authorised. One replacement may now be issued against this request, and the '
        + 'authorisation is spent when it is.',
    } : {}),
  });
}
