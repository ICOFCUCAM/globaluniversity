// ---------------------------------------------------------------------------
// THE APPOINTEE'S ANSWER.
//
//   GET  /api/appointments/accept?reference=APT-2026-0042&code=ICOF-…
//        → what they are being asked to accept
//   POST /api/appointments/accept
//        { reference, code, decision: 'accepted'|'declined', name, reason? }
//
// ---------------------------------------------------------------------------
// THE ONLY ACT IN THIS WORKFLOW THAT IS NOT THE UNIVERSITY'S
// ---------------------------------------------------------------------------
//
// Everything else in the appointment pipeline is done by an officer holding a
// capability. This is done by the appointee, who very often has no account here
// — a new lecturer has no portal login until they are staff, and 050's rule is
// that they do not become staff until they have accepted. Requiring an account
// would make the sequence impossible.
//
// ---------------------------------------------------------------------------
// SO WHAT PROVES IT IS THEM
// ---------------------------------------------------------------------------
//
// The verification code printed on their letter. It is an HMAC over the
// particulars under the University's signing key: it cannot be guessed, it is
// not in the database as a secret, and it is on the document they were sent and
// nowhere else.
//
// THAT IS EXACTLY AS STRONG AS A SIGNED PAPER LETTER AND NO STRONGER, which is
// the honest position: anybody holding the paper could sign it. It is weaker
// than an authenticated portal action and stronger than an unauthenticated
// link, and the record says which was used. A University wanting more should
// require acceptance in the portal once the appointee has an account — that is
// a policy decision, not a defect in this route.
//
// The acceptance records the name they typed, the moment, and WHICH VERSION of
// which letter they were answering — the fact a dispute turns on when an
// amended letter follows.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { sealAppointment } from '@/lib/appointmentLetter';
import { printedReference } from '@/lib/appointments';
import { UNIVERSITY } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REFERENCE = /^APT-\d{4}-\d{4,}$/;
const MIN_NAME = 3;
const MIN_DECLINE_REASON = 10;

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

type Row = Record<string, unknown>;

// THE CLIENT'S OWN TYPE, NAMED. Writing the parameter as
// `ReturnType<typeof createClient>` looks equivalent and is not: the generic
// defaults resolve differently at the call site and at the declaration, and
// tsc reports "'public' is not assignable to 'never'" — which reads as a bug in
// the query rather than in the annotation.
type Db = SupabaseClient;

function client(): Db | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Find the letter and check the code the appointee presented.
 *
 * THE CODE IS RECOMPUTED, NOT COMPARED TO A STORED ONE. `seal_code` is in the
 * archive, but recomputing it from the appointment's own particulars is the
 * check that also proves the archived row still describes the same appointment
 * — a stored code compared to itself proves only that a string was copied.
 */
async function letterFor(admin: Db, reference: string, code: string) {
  const { data: letter } = await admin
    .from('appointment_letters')
    // eslint-disable-next-line max-len
    .select('id, appointment_id, reference, version, issued_on, seal_code, sealed, superseded_at')
    .eq('reference', reference)
    .maybeSingle();
  if (!letter) return { error: 'no-such-letter' as const };

  const l = letter as Row;
  if (l.superseded_at) return { error: 'superseded' as const, letter: l };

  const { data: appointment } = await admin
    .from('appointments')
    // eslint-disable-next-line max-len
    .select('id, full_name, position_title, unit_name, faculty, start_date, issued_at, status, email')
    .eq('id', l.appointment_id as string)
    .maybeSingle();
  if (!appointment) return { error: 'no-such-appointment' as const };

  const a = appointment as Row;
  if (!a.issued_at) return { error: 'not-issued' as const };

  const presented = code.trim().toUpperCase();
  let expected = String(l.seal_code ?? '');
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${UNIVERSITY.website}`;
    expected = sealAppointment(
      a, reference, String(l.issued_on), siteUrl,
    ).code;
  } catch {
    // The signing secret is not configured. Fall back to the archived code —
    // which is weaker and is why `sealed` is reported back to the caller.
  }

  if (!expected || presented !== expected.toUpperCase()) {
    return { error: 'wrong-code' as const };
  }
  return { letter: l, appointment: a };
}

// ===========================================================================
// GET — what am I being asked to accept?
// ===========================================================================

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = (url.searchParams.get('reference') ?? '').trim().toUpperCase();
  const code = url.searchParams.get('code') ?? '';

  if (!REFERENCE.test(reference)) return bad('not-a-reference', 400);
  const admin = client();
  if (!admin) return bad('service-role-key-missing', 500);

  const found = await letterFor(admin, reference, code);
  if ('error' in found && found.error) {
    return bad(found.error, found.error === 'wrong-code' ? 403 : 404,
      found.error === 'superseded'
        ? 'This letter has been replaced by a later version. The University has sent you the '
          + 'current one — please answer that rather than this.'
        : undefined);
  }

  const a = found.appointment as Row;
  const l = found.letter as Row;

  const { data: standing } = await admin.from('appointment_acceptances')
    .select('decision, at, version')
    .eq('appointment_id', a.id as string)
    .is('superseded_at', null)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    reference,
    printed: printedReference(reference),
    version: l.version,
    // THE TERMS THEY ARE AGREEING TO, from the record — not the salary, which
    // is on the letter they are holding and not in a response that could be
    // logged by a proxy between here and them.
    name: a.full_name,
    position: a.position_title,
    unit: a.unit_name,
    faculty: a.faculty,
    startDate: a.start_date,
    // ALREADY ANSWERED IS NOT AN ERROR. An appointee who clicks the link twice
    // should be told what they already said, not shown a failure.
    ...(standing ? { alreadyAnswered: standing } : {}),
  });
}

// ===========================================================================
// POST — the answer
// ===========================================================================

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const reference = String(body.reference ?? '').trim().toUpperCase();
  const code = String(body.code ?? '');
  const decision = String(body.decision ?? '');
  const name = String(body.name ?? '').trim();
  const reason = String(body.reason ?? '').trim();

  if (!REFERENCE.test(reference)) return bad('not-a-reference', 400);
  if (decision !== 'accepted' && decision !== 'declined') return bad('unknown-decision', 400);
  if (name.length < MIN_NAME) {
    return bad('no-name', 400,
      'Type your name. It is the record of who answered, and an acceptance by nobody is not '
      + 'an acceptance.');
  }
  if (decision === 'declined' && reason.length < MIN_DECLINE_REASON) {
    return bad('decline-needs-a-reason', 400,
      'Please say why. The University needs to know whether to re-advertise the post or to '
      + 'correct something in the offer.');
  }

  const admin = client();
  if (!admin) return bad('service-role-key-missing', 500);

  const found = await letterFor(admin, reference, code);
  if ('error' in found && found.error) {
    return bad(found.error, found.error === 'wrong-code' ? 403 : 404,
      found.error === 'superseded'
        ? 'This letter has been replaced. Answering it would record you as agreeing to terms '
          + 'the University has already changed — please answer the current version.'
        : undefined);
  }

  const a = found.appointment as Row;
  const l = found.letter as Row;

  // ALREADY ANSWERED. Returned rather than refused, and NOT overwritten: an
  // appointee clicking twice must not produce two answers, and the first one
  // stands until the University supersedes it by issuing a new version.
  const { data: standing } = await admin.from('appointment_acceptances')
    .select('decision, at, version')
    .eq('appointment_id', a.id as string)
    .is('superseded_at', null)
    .maybeSingle();
  if (standing) {
    const s = standing as Row;
    return NextResponse.json({
      ok: true,
      alreadyAnswered: true,
      decision: s.decision,
      at: s.at,
      detail: `You have already ${s.decision === 'accepted' ? 'accepted' : 'declined'} this `
        + 'appointment. Contact the University if that was not what you intended.',
    });
  }

  const { error } = await admin.from('appointment_acceptances').insert({
    appointment_id: a.id as string,
    letter_id: l.id as string,
    reference,
    version: Number(l.version ?? 1),
    decision,
    accepted_name: name,
    accepted_email: (a.email as string | null) ?? null,
    ...(decision === 'declined' ? { reason } : {}),
  });
  if (error) return bad(`not-recorded: ${error.message}`, 500);

  const now = new Date().toISOString();
  await admin.from('appointments').update(
    decision === 'accepted'
      ? { status: 'accepted', accepted_at: now, updated_at: now }
      : { status: 'declined', declined_at: now, closed_reason: reason, closed_at: now,
          updated_at: now },
  ).eq('id', a.id as string);

  await admin.from('appointment_events').insert({
    appointment_id: a.id as string,
    event: decision === 'accepted' ? 'ACCEPTED' : 'DECLINED',
    // NO ACTOR ID. The appointee is not a user of this system, and inventing
    // one would put an officer's name against the appointee's own act.
    actor_email: (a.email as string | null) ?? null,
    actor_role: 'appointee',
    previous_state: 'issued',
    new_state: decision,
    detail: decision === 'declined' ? reason : name,
    metadata: { reference, version: l.version, answeredAs: name },
  });

  return NextResponse.json({
    ok: true,
    decision,
    reference,
    version: l.version,
    detail: decision === 'accepted'
      // SAID PLAINLY, because it is the thing appointees ask next. 050's rule
      // is configurable and this is what it is set to.
      ? 'Your acceptance is recorded against this version of the letter. Human Resources will '
        + 'open your staff record; being appointed and being on the staff register are two '
        + 'separate steps.'
      : 'Your decision is recorded and the University has been notified.',
  });
}
