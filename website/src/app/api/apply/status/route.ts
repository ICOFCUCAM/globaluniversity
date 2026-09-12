// ---------------------------------------------------------------------------
// WHERE IS MY APPLICATION?
//
//   POST /api/apply/status  { applicationNumber, email }
//
// ---------------------------------------------------------------------------
// WHY IT IS A PUBLIC ROUTE AND NOT A PORTAL SCREEN
// ---------------------------------------------------------------------------
//
// An applicant has no account. That is the whole design: accounts exist
// because an admission was issued, so self-signup was removed rather than
// hidden — an applicant who could create an account would bypass both the fee
// gate and the verification. Which means the one person most anxious to know
// where their application has got to is the one person who cannot sign in and
// look.
//
// APPLICANT_STAGES has existed since migration 024 — six stages written in the
// applicant's own words, deliberately vaguer than the internal states — and
// nothing rendered it. The alternative to this route is what happens today:
// they telephone the Registrar.
//
// ---------------------------------------------------------------------------
// WHAT IT WILL NOT SAY
// ---------------------------------------------------------------------------
//
// The applicant's own stage, and nothing else. Never the internal state, never
// a reason, never a decision that has not been sent to them, never anybody's
// name. `admission_processing_failed` is the University's problem to solve and
// not news to break to an applicant while it is being solved, so it reads as
// "Admission approved" like the states either side of it.
//
// BOTH THE REFERENCE AND THE EMAIL MUST MATCH, and a mismatch is answered
// exactly as a miss is. An application number is guessable — they are short
// and sequential-looking — so answering "no such application" differently from
// "that is not your email" would let somebody walk the range and learn who has
// applied.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { APPLICANT_STAGES, applicantStageIndex } from '@/lib/admissionWorkflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The same answer for every kind of miss. See the header. */
const NOT_FOUND = {
  ok: false,
  error: 'not-found',
  detail: 'No application matches that reference and email address. Check both — the reference is '
    + 'on the acknowledgement we sent when you applied.',
};

export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  let body: { applicationNumber?: string; email?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const reference = (body.applicationNumber ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  if (!reference || !email) {
    return NextResponse.json({ ok: false, error: 'reference-and-email-required' }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Matched on BOTH, in one query. Fetching by reference and then comparing the
  // email would make the two failures distinguishable by timing, which is the
  // same leak by a slower route.
  const { data } = await admin
    .from('students')
    .select('first_name, status, program, degree_type, intake, created_at')
    .ilike('matric_no', reference)
    .ilike('email', email)
    .maybeSingle();

  if (!data) return NextResponse.json(NOT_FOUND, { status: 404 });

  const index = applicantStageIndex(data.status);
  const stage = index >= 0 ? APPLICANT_STAGES[index] : null;

  return NextResponse.json({
    ok: true,
    // Their own first name, so the page can be addressed to them and they can
    // see at a glance that it is the right application.
    firstName: data.first_name,
    programme: [data.degree_type, data.program].filter(Boolean).join(' — ') || null,
    intake: data.intake,
    submitted: data.created_at,
    // THE STAGE, NOT THE STATE. What the offices see is the University's
    // business; an applicant asking where their application is needs an answer,
    // not an organisation chart.
    stage: stage ? { key: stage.key, label: stage.label } : null,
    stageIndex: index,
    stages: APPLICANT_STAGES.map((s) => ({ key: s.key, label: s.label })),
  });
}
