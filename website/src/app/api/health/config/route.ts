// ---------------------------------------------------------------------------
// WHAT IS SET ON THIS DEPLOYMENT, AND WHAT EACH ABSENCE COSTS.
//
// GET /api/health/config
//
// ---------------------------------------------------------------------------
// WHY IT IS NOT PUBLIC
// ---------------------------------------------------------------------------
//
// Knowing which of a system's secrets are unset is reconnaissance. "Mail is off
// and there is no signing key" tells somebody where to push. So this is the
// Superadministrator's, like the rest of the system's own state.
//
// WITH ONE EXCEPTION, and it is the case that actually matters. If the Supabase
// keys are missing, NOBODY CAN SIGN IN — so requiring a sign-in to be told that
// signing in is impossible would be a locked door with the key inside. In that
// state alone it answers publicly, and it discloses nothing a visitor could not
// already deduce from a portal that will not load.
//
// It never returns a value. Only whether something is set, and for two keys
// whether it is long enough.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, adminClient } from '@/lib/adminAuth';
import { inspect, deploymentStamp } from '@/lib/configuration';

export const runtime = 'nodejs';
// ALWAYS FRESH. A cached configuration report is a report about a deployment
// that may no longer exist, read by somebody deciding whether their change
// took effect.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const report = inspect();

  // The locked-door case. `adminClient()` returns null exactly when the
  // Supabase keys are absent, which is the one state where nobody can
  // authenticate to ask this question.
  if (!adminClient()) {
    return NextResponse.json({
      ok: false,
      authenticated: false,
      operational: false,
      missingRequired: report.missingRequired,
      note:
        'The Supabase keys are not set on this deployment, so nobody can sign in and this report '
        + 'cannot ask who you are. Set the variables below and everything else becomes visible '
        + 'to the Superadministrator.',
      // `area` IS PART OF THE ROW, and dropping it here made the panel render
      // its group heading as "UNDEFINED" — the fault was invisible in every
      // other branch, because they keep the field. A response shaped
      // differently from the one the caller normally gets is a response the
      // caller has not been written for.
      settings: report.settings
        .filter((s) => s.area === 'database')
        .map(({ name, area, importance, set, tooShort, purpose, ifAbsent }) => ({
          name, area, importance, set, tooShort, purpose, ifAbsent,
        })),
    }, { status: 503 });
  }

  const g = await guard(request, 'design-credentials');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  return NextResponse.json({
    ok: true,
    authenticated: true,
    // WHICH COMMIT IS RUNNING. First, because every other answer on this page
    // describes a deployment, and the first thing to establish is which one.
    deployment: deploymentStamp(),
    operational: report.operational,
    missingRequired: report.missingRequired,
    missingRecommended: report.missingRecommended,
    // NAMED LOUDLY AND FIRST. A secret compiled into the browser bundle is the
    // one misconfiguration where the site looks entirely normal and the whole
    // database is readable by anyone who opens the developer tools.
    exposedSecrets: report.exposedSecrets,
    // Set and dangerous, as opposed to missing. Carried beside exposedSecrets
    // because the panel treats them the same way: loudly, and above the list.
    dangerouslySet: report.dangerouslySet,
    // EVERY FIELD THE PANEL READS MUST SURVIVE THIS MAP. Dropping `area` once
    // made the panel render its group heading as "UNDEFINED"; `dangerIfSet` is
    // the same hazard, and losing it would turn the red warning into a red
    // warning with no sentence in it.
    settings: report.settings.map(
      ({ name, area, importance, set, tooShort, purpose, ifAbsent, minLength, dangerIfSet }) => ({
        name, area, importance, set, tooShort, purpose, ifAbsent, minLength, dangerIfSet,
      }),
    ),
  });
}
