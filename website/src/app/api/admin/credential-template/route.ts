// ---------------------------------------------------------------------------
// Publish a credential design. Superadministrator only.
//
// Publishing never edits the active row. It writes a new version and switches
// which one is active, so a certificate issued last year keeps rendering under
// the design it was issued under. See the header of src/lib/credentialTemplate.ts
// for why that is not optional.
//
// The design is validated server-side even though the studio validates as you
// type: the studio is a convenience, and this is the rule.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import { validateDesign, withDefaults, type CredentialKind } from '@/lib/credentialTemplate';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const g = await guard(request, 'publish-credential-template');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let body: { kind?: CredentialKind; name?: string; design?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const kind = body.kind;
  if (kind !== 'certificate' && kind !== 'transcript') {
    return NextResponse.json({ ok: false, error: 'kind-must-be-certificate-or-transcript' }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name) {
    // A version with no name is a version nobody can refer to in a decision.
    return NextResponse.json({ ok: false, error: 'name-required' }, { status: 422 });
  }

  const design = withDefaults(kind, body.design as never);
  const problems = validateDesign(design);
  if (problems.length) {
    return NextResponse.json({ ok: false, error: 'invalid-design', problems }, { status: 422 });
  }

  const { data: latest } = await admin
    .from('credential_templates')
    .select('version')
    .eq('kind', kind)
    .order('version', { ascending: false })
    .limit(1);
  const version = ((latest?.[0]?.version as number | undefined) ?? 0) + 1;

  // Deactivate first, then insert active. The partial unique index in the
  // migration allows only one active row per kind, so doing it the other way
  // round would fail on the insert.
  const { error: deactErr } = await admin
    .from('credential_templates')
    .update({ is_active: false })
    .eq('kind', kind)
    .eq('is_active', true);
  if (deactErr) {
    return NextResponse.json({ ok: false, error: `deactivate-failed: ${deactErr.message}` }, { status: 500 });
  }

  const { data: inserted, error: insErr } = await admin
    .from('credential_templates')
    .insert({
      kind,
      version,
      name,
      design,
      is_active: true,
      created_by: caller.id,
      published_at: new Date().toISOString(),
    })
    .select('id, kind, version, name, is_active, published_at')
    .single();
  if (insErr) {
    return NextResponse.json({ ok: false, error: `publish-failed: ${insErr.message}` }, { status: 500 });
  }

  const auditErr = await audit(admin, {
    action: 'credential_template.published',
    entityType: 'credential_template',
    entityId: inserted.id,
    performedBy: caller.id,
    details: { kind, version, name, by_email: caller.email },
  });

  return NextResponse.json({ ok: true, template: inserted, auditWarning: auditErr ?? undefined });
}
