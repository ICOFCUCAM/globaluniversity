// ---------------------------------------------------------------------------
// RETIRED. This route admitted a student, and it is no longer how the
// University admits.
//
//   POST /api/admissions/admit  →  410 Gone
//
// ---------------------------------------------------------------------------
// WHY IT IS GONE
// ---------------------------------------------------------------------------
//
// It created the account and emailed the admission package FROM THE ADMISSIONS
// OFFICE, over a letter signed by ACADEMIC AFFAIRS — an office that never saw
// the button. So the office that assessed an application was also the office
// that admitted, and the signature on the document belonged to neither act.
//
// It was also one of two routes that could admit, and they left different
// terminal states: this one stopped at `approved`, the current one reaches
// `admission_issued`. Mabel Jemimah Holten and Dorothy Lukwago sit in different
// states today for exactly that reason, and the University asked why.
//
// The Admissions Office now FORWARDS an application, with its recommendation,
// to Admissions Approval. The Head of Academic Affairs decides and signs.
//
// ---------------------------------------------------------------------------
// WHY IT REFUSES RATHER THAN NOT EXISTING
// ---------------------------------------------------------------------------
//
// A deleted route is a 404, which a stale browser tab reports as "not found" —
// indistinguishable from a typo or an outage, and it teaches nobody anything.
// This says what happened and what to do instead, and it appears in the logs,
// so if something is still calling it that fact is visible rather than
// inferred.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json({
    ok: false,
    error: 'route-retired',
    detail: 'Admitting from the Admissions Office has been retired. That office now forwards an '
      + 'application, with its recommendation, to Admissions Approval — and the Head of Academic '
      + 'Affairs takes the decision and signs the letter. Reload the page to get the current '
      + 'screen.',
  }, { status: 410 });
}
