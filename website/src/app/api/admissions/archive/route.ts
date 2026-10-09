// ---------------------------------------------------------------------------
// BRINGING AN AGED-OFF APPLICATION BACK ONTO THE REGISTER.
//
//   POST /api/admissions/archive  { action: 'restore', id, reason }
//
// ---------------------------------------------------------------------------
// WHY THERE IS NO 'archive' ACTION
// ---------------------------------------------------------------------------
//
// Because nothing archives anything. 109 computes staleness from the row's own
// dates, so an application leaves the register on its ninetieth idle day
// whether anybody is watching or not. There is no button, no nightly job and
// no stored flag — which is the point: a flag set by a task that did not run is
// wrong, and nobody notices for weeks.
//
// So this route has one action, and it is the exception rather than the rule.
//
// ---------------------------------------------------------------------------
// AND WHY IT GOES THROUGH A DATABASE FUNCTION RATHER THAN AN UPDATE
// ---------------------------------------------------------------------------
//
// Circularity. The row being restored is, by definition, one the caller cannot
// see — that is what being archived MEANS. An ordinary
// `update students … where id = …` returning the row is checked against the
// SELECT policy, which hides it, so the update would report nothing updated
// and the button would look broken.
//
// 109's `restore_application()` is SECURITY DEFINER for exactly that reason,
// and it names the three offices itself. That matters more than the convenience:
// the service key this route holds bypasses every policy, so if the refusal
// lived only in `guard()` below, a second route written next year that forgot
// to guard would silently work. The database refuses the same people this
// route does.
//
// ---------------------------------------------------------------------------
// NOTHING IS UNDONE, SO NOBODY APPROVES IT
// ---------------------------------------------------------------------------
//
// This is not 108's deletion. No row was destroyed, no document was removed,
// and there is no Vice-Chancellor in the path — asking two offices to agree
// before a record can be looked at again would be a ceremony around a thing
// that never happened. The University's answer when asked was "it happens by
// itself, Registrar can restore".
//
// WHAT IS KEPT: who restored it and when, on the row, because the ninety days
// start again from that moment and a date with no name against it is half a
// record.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { ARCHIVE_AFTER_DAYS } from '@/lib/applicationArchive';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESTORE = 'restore-archived-application' as Capability;

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (action !== 'restore') {
    return bad('unknown-action', 400,
      'The only action here is `restore`. Nothing archives an application — it leaves the '
      + `register by itself on its ${ARCHIVE_AFTER_DAYS}th idle day.`);
  }

  const g = await guard(request, RESTORE);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Returning an application to the register is the Office of the Registrar’s. '
        + 'Any office that can read the archive can ask for one back; the Registry puts it '
        + 'back, because the register is the Registry’s.',
    }, { status: g.status });
  }

  const id = String(body.id ?? '');
  if (!id) return bad('no-record', 400, 'Which application?');

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return bad('service-role-key-missing', 500);
  const admin = createClient(
    SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // ---- WHAT IT IS, READ BEFORE IT IS TOUCHED -----------------------------
  //
  // So that the reply can name the person rather than a uuid. The service key
  // reads past the policy that hides the row, which is the one thing it is for
  // here.
  const { data: before, error: readError } = await admin
    .from('students')
    .select('id, first_name, last_name, matric_no, status')
    .eq('id', id)
    .maybeSingle();
  if (readError) return bad('read-failed', 500, readError.message);
  if (!before) return bad('no-such-application', 404, 'There is no such application.');

  const name = [before.first_name, before.last_name].filter(Boolean).join(' ').trim()
    || String(before.matric_no ?? 'The application');

  // ---- AND RESTORED THROUGH 109'S FUNCTION -------------------------------
  //
  // NOT A DIRECT UPDATE, even though the service key could do one. The
  // function is where the three offices are named, and a route that wrote the
  // columns itself would be a second opinion about who may — which is how the
  // screen and the database come to refuse different people.
  const { error } = await admin.rpc('restore_application', { the_application: id });
  if (error) {
    return bad('restore-failed', 400, error.message);
  }

  return NextResponse.json({
    ok: true,
    detail: `${name} is back on the Students register. It will age off again after `
      + `${ARCHIVE_AFTER_DAYS} days of nothing further happening, counted from today — so `
      + 'whatever was outstanding has that long.',
  });
}
