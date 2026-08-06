// ---------------------------------------------------------------------------
// Is the credential system actually able to issue anything?
//
// WHY THIS EXISTS. Four things have to be true before this university can issue
// a credential anybody can verify, and every one of them has been communicated
// so far as a sentence in a handover note:
//
//   CREDENTIAL_SECRET set          — or nothing can be sealed
//   SUPABASE_SERVICE_ROLE_KEY set  — or no admin route works at all
//   the register exists            — migration 004
//   the three approving offices appointed — or no design can ever be published
//
// A note is not a control. Someone reads it once, does three of the four, and
// the system carries on looking finished — because a missing environment
// variable does not announce itself, it just makes one button quietly refuse
// six weeks later.
//
// This turns each of them into something the Studio can show, with the exact
// remedy beside it. It reports state; it changes nothing.
//
// WHAT IT DELIBERATELY DOES NOT RETURN. The value of any secret, its length, or
// any part of it. Only whether it is set and long enough. A readiness endpoint
// that leaks the shape of a signing key is a worse problem than the one it
// solves.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';

export const runtime = 'nodejs';

export interface ReadinessItem {
  id: string;
  label: string;
  state: 'ready' | 'missing' | 'unknown';
  detail: string;
  remedy?: string;
}

export async function GET(request: Request) {
  // 'configure-system' is the Superadministrator's. The state of the
  // university's signing key is not an ordinary administrative fact.
  const g = await guard(request, 'configure-system');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin } = g;

  const items: ReadinessItem[] = [];

  const secret = process.env.CREDENTIAL_SECRET ?? '';
  items.push({
    id: 'credential-secret',
    label: 'Signing key',
    state: secret.length >= 32 ? 'ready' : 'missing',
    detail: secret.length >= 32
      ? 'Set. Credentials can be sealed and verified.'
      : secret
        ? 'Set but too short. Under 32 characters is refused as no key at all.'
        : 'Not set. Nothing can be sealed.',
    remedy: secret.length >= 32 ? undefined :
      'Set CREDENTIAL_SECRET in Vercel — server-side, never NEXT_PUBLIC_. Generate one with ' +
      '`openssl rand -hex 32`. Set it BEFORE the first credential is issued: changing it later ' +
      'invalidates the seal on every document already issued under the old one.',
  });

  items.push({
    id: 'service-role',
    label: 'Service-role key',
    state: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').length > 0 ? 'ready' : 'missing',
    detail: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').length > 0
      ? 'Set. The admin routes can reach the database.'
      : 'Not set. Every /api/admin route refuses.',
    remedy: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').length > 0 ? undefined :
      'Set SUPABASE_SERVICE_ROLE_KEY in Vercel, server-side. You would not be reading this ' +
      'without it, so if you can see this message it is set.',
  });

  // The register. Probed with a head-only count so nothing is transferred.
  const { error: regErr } = await admin
    .from('credentials_issued')
    .select('id', { count: 'exact', head: true });
  items.push({
    id: 'register',
    label: 'Credential register',
    state: regErr ? 'missing' : 'ready',
    detail: regErr
      ? `The credentials_issued table could not be read: ${regErr.message}`
      : 'Present. Credentials can be issued, verified and revoked.',
    remedy: regErr
      ? 'Run docs/migrations/004_credential_register.sql in the Supabase SQL editor.'
      : undefined,
  });

  const { error: awardErr, count: awardCount } = await admin
    .from('awards')
    .select('id', { count: 'exact', head: true })
    .eq('active', true);
  items.push({
    id: 'awards',
    label: 'Award catalogue',
    state: awardErr ? 'missing' : (awardCount ?? 0) > 0 ? 'ready' : 'missing',
    detail: awardErr
      ? `The awards table could not be read: ${awardErr.message}`
      : `${awardCount ?? 0} award${awardCount === 1 ? '' : 's'} on the catalogue.`,
    remedy: awardErr
      ? 'Run docs/migrations/006_awards_and_graduation.sql.'
      : (awardCount ?? 0) > 0 ? undefined
        : 'No awards are defined, so no certificate can state what it confers.',
  });

  // The GPA engine's input.
  //
  // The classification engine has been built and wired since the credential
  // register went in — /api/credential/issue computes the class from the
  // cumulative GPA and refuses without one. It reads semester_gpas, a table that
  // was never created and that nothing ever wrote to. Two readers, no writer: a
  // correct calculator with an empty input, which from outside is
  // indistinguishable from no engine at all.
  const { error: gpaErr, count: gpaCount } = await admin
    .from('semester_gpas')
    .select('id', { count: 'exact', head: true });
  const { count: approvedCount } = await admin
    .from('semester_gpas')
    .select('id', { count: 'exact', head: true })
    .eq('basis', 'approved');
  items.push({
    id: 'gpa',
    label: 'Grade point averages',
    state: gpaErr ? 'missing' : (approvedCount ?? 0) > 0 ? 'ready' : 'missing',
    detail: gpaErr
      ? `The semester_gpas table could not be read: ${gpaErr.message}`
      : `${gpaCount ?? 0} average(s) computed, ${approvedCount ?? 0} on approved marks.`,
    remedy: gpaErr
      ? 'Run docs/migrations/007_gpa_engine.sql, then POST /api/results/recompute with { "all": true }.'
      : (gpaCount ?? 0) === 0
        ? 'No averages have been computed, so every certificate will be refused with "no-cgpa". '
          + 'POST /api/results/recompute with { "all": true }.'
        : (approvedCount ?? 0) === 0
          ? 'Every average is provisional — computed from marks nobody has approved — and a '
            + 'certificate cannot rest on those. The approval chain (lecturer → HOD → Dean → '
            + 'Registrar) has no interface yet; marks are saved as drafts and stay there. That is '
            + 'the remaining link between marks and a conferrable degree.'
          : undefined,
  });

  // The three approving offices. Without all three, no design can ever be
  // published again — which is a state worth surfacing before somebody spends
  // an afternoon designing one.
  const OFFICES = ['registrar', 'academic-office', 'vice-chancellor'] as const;
  const { data: holders, error: roleErr } = await admin
    .from('profiles')
    .select('role')
    .in('role', OFFICES as unknown as string[])
    .is('suspended_at', null);

  if (roleErr) {
    items.push({
      id: 'offices',
      label: 'Approving offices',
      state: 'unknown',
      detail: `The roles could not be read: ${roleErr.message}`,
    });
  } else {
    const held = new Set((holders ?? []).map((h: { role: string }) => h.role));
    const absent = OFFICES.filter((o) => !held.has(o));
    items.push({
      id: 'offices',
      label: 'Approving offices',
      state: absent.length === 0 ? 'ready' : 'missing',
      detail: absent.length === 0
        ? 'All three offices are appointed. A design can complete the approval chain.'
        : `Not appointed: ${absent.join(', ')}.`,
      remedy: absent.length === 0 ? undefined :
        'No credential design can be published until all three are appointed — the database ' +
        'refuses it. The design currently in force stays in force, so nothing breaks; it simply ' +
        `cannot be changed. Appoint with: update profiles set role = '${absent[0]}' where lower(email) = '…';`,
    });
  }

  return NextResponse.json({
    ok: true,
    ready: items.every((i) => i.state === 'ready'),
    items,
  });
}
