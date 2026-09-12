// ---------------------------------------------------------------------------
// RETIRED. This route admitted a student, and it is no longer how the
// University admits.
//
//   POST /api/admissions/approve  →  410 Gone
//
// ---------------------------------------------------------------------------
// WHY IT IS GONE
// ---------------------------------------------------------------------------
//
// It was the Registrar's half of an older design in which the Registrar
// approved an application outright, creating the account and sending the
// credentials. The University has since separated verification from the
// academic decision: the Registrar verifies and forwards, the Admissions
// Office assesses and recommends, and Academic Affairs decides.
//
// It was also one of two routes that could admit — and unlike the other, it
// generated no admission package at all. Which document an admitted student
// received depended on which desk the approver happened to be sitting at,
// which is not something institutional policy can be a function of.
//
// Nothing had called it since the Registrar's desk was rewritten; the helper
// that did, `approveApplication`, went with it.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json({
    ok: false,
    error: 'route-retired',
    detail: 'Approving from this route has been retired. The Registrar verifies and forwards; '
      + 'the Admissions Office assesses and recommends; the Head of Academic Affairs decides and '
      + 'signs the letter at Admissions Approval.',
  }, { status: 410 });
}
