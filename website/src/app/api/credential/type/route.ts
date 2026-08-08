// ---------------------------------------------------------------------------
// REGISTERING A NEW KIND OF CREDENTIAL.
//
// POST { name, code, category, isAcademic, eligibility, validity, validityMonths }
//
//   "He can also create other kinds of certificate for different role that may
//    not even be academic."
//   "the system should clearly classify them so nobody mistakes an
//    institutional certificate for an accredited academic degree."
//
// THE SECOND SENTENCE IS WHY THIS ROUTE IS NOT A THIN INSERT. The University
// wants to issue certificates of ordination, of service, of appointment, of
// appreciation. Every one of those is a real institutional act and deserves a
// proper document. None of them is a degree, and the moment one of them
// verifies like a degree the University has issued a fake degree — whatever the
// title on it says, and whatever anybody intended.
//
// So `category` is required, constrained here and in the database, and carried
// onto every credential issued under this type and into what a verifier is
// shown. `is_academic` may only be true in the academic category, checked in
// three places: the form, this route, and a CHECK constraint in migration 013.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import {
  problemsWithType, CREDENTIAL_CATEGORIES, CATEGORY_PROFILES,
  type CredentialCategory,
} from '@/lib/credentialAuthority';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const g = await guard(request, 'create-credential-type');
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: g.error?.startsWith('not-permitted')
        ? 'Creating a new kind of credential is held by the Superadministrator. What the '
          + 'University may award is an institutional decision, not an administrative one.'
        : undefined,
    }, { status: g.status });
  }
  const { admin, caller } = g;

  let input: {
    name?: string; code?: string; category?: string; isAcademic?: boolean;
    eligibility?: string; validity?: 'permanent' | 'expiring'; validityMonths?: number;
  };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  if (!input.category || !CREDENTIAL_CATEGORIES.includes(input.category as CredentialCategory)) {
    return NextResponse.json({
      ok: false,
      error: 'bad-category',
      detail: `Category must be one of: ${CREDENTIAL_CATEGORIES.join(', ')}.`,
    }, { status: 400 });
  }

  const category = input.category as CredentialCategory;

  const proposed = {
    name: input.name,
    code: input.code,
    category,
    isAcademic: Boolean(input.isAcademic),
    validity: input.validity ?? 'permanent',
    validityMonths: input.validityMonths,
  };

  // THE SAME VALIDATOR THE FORM RAN. Not a second, subtly different copy — the
  // form and the route disagreeing is how a rule ends up being enforced in one
  // place and not the other.
  const problems = problemsWithType(proposed);
  if (problems.length > 0) {
    return NextResponse.json({ ok: false, error: 'invalid', detail: problems.join(' ') }, { status: 422 });
  }

  const { data, error } = await admin
    .from('credential_types')
    .insert({
      code: proposed.code!.trim(),
      name: proposed.name!.trim(),
      category,
      is_academic: proposed.isAcademic,
      eligibility: input.eligibility?.trim() || null,
      validity: proposed.validity,
      validity_months: proposed.validity === 'expiring' ? proposed.validityMonths : null,
      // DRAFT, NOT ACTIVE. A new kind of credential is a statement about what
      // this University awards; it goes live when somebody has looked at it,
      // not the instant it is typed. The public read policy on this table only
      // exposes active types, so a draft is invisible outside the portal.
      status: 'draft',
      created_by: caller.id,
    })
    .select('id, code, name')
    .single();

  if (error) {
    return NextResponse.json({
      ok: false,
      error: 'not-created',
      detail: error.message.includes('duplicate')
        ? `A credential type with the code ${proposed.code} already exists.`
        : error.message.includes('does not exist')
          ? 'Run docs/migrations/013_social_and_credential_authority.sql.'
          : error.message,
    }, { status: 500 });
  }

  await admin.from('credential_audit_events').insert({
    action: 'type_created',
    reason: `${data.name} (${data.code}) — ${CATEGORY_PROFILES[category].label}`,
    actor_id: caller.id,
    actor_role: caller.role,
    actor_email: caller.email,
    detail: { type_id: data.id, category, is_academic: proposed.isAcademic },
  });

  return NextResponse.json({
    ok: true,
    id: data.id,
    message:
      `${data.name} registered as a draft. A verifier will be told: `
      + `"${CATEGORY_PROFILES[category].verifierNote}"`,
  });
}
