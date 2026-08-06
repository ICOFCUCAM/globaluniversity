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

  // ---------------------------------------------------------------------
  // THIS NO LONGER PUBLISHES. IT SUBMITS.
  //
  // The route used to deactivate the current design and insert the new one as
  // active in the same breath, so one account could change the form of words in
  // which the university confers a degree and have every graduate receive it
  // from that moment. That is not a control anyone else can see, let alone
  // object to.
  //
  // The new version is written as a submission, inactive. It becomes the
  // university's certificate when the Registrar, the Academic Office and the
  // Vice Chancellor have each approved it and the Superadministrator publishes
  // — and the database refuses the last step until the first three have
  // happened (005_senate_approval.sql), so this is not a rule the interface
  // asks people to respect.
  // ---------------------------------------------------------------------
  const { data: inserted, error: insErr } = await admin
    .from('credential_templates')
    .insert({
      kind,
      version,
      name,
      design,
      is_active: false,
      lifecycle: 'submitted',
      created_by: caller.id,
      submitted_by: caller.id,
      submitted_at: new Date().toISOString(),
    })
    .select('id, kind, version, name, is_active, lifecycle, submitted_at')
    .single();
  if (insErr) {
    return NextResponse.json({ ok: false, error: `submit-failed: ${insErr.message}` }, { status: 500 });
  }

  const auditErr = await audit(admin, {
    action: 'credential_template.submitted',
    entityType: 'credential_template',
    entityId: inserted.id,
    performedBy: caller.id,
    details: { kind, version, name, by_email: caller.email },
  });

  return NextResponse.json({
    ok: true,
    template: inserted,
    awaiting: ['registrar', 'academic-office', 'vice-chancellor'],
    auditWarning: auditErr ?? undefined,
  });
}

/**
 * PATCH — an approving office records its decision, or the designer publishes.
 *
 *   { templateId, decision: 'approved' | 'rejected', note? }
 *     recorded against the caller's own office. A caller cannot sign for an
 *     office they do not hold: the office is read from their profile, never
 *     from the request. That is the whole of what makes the chain mean
 *     anything.
 *
 *   { templateId, publish: true }
 *     the Superadministrator brings an approved design into force. The database
 *     refuses this while any office is outstanding or has rejected it.
 */
export async function PATCH(request: Request) {
  let body: { templateId?: string; decision?: string; note?: string; publish?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }
  if (!body.templateId) {
    return NextResponse.json({ ok: false, error: 'missing-template-id' }, { status: 400 });
  }

  // -------- publishing --------
  if (body.publish) {
    const g = await guard(request, 'publish-credential-template');
    if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
    const { admin, caller } = g;

    const { data: tpl, error: readErr } = await admin
      .from('credential_templates')
      .select('id, kind, version, name, lifecycle')
      .eq('id', body.templateId)
      .maybeSingle();
    if (readErr || !tpl) {
      return NextResponse.json({ ok: false, error: 'template-not-found' }, { status: 404 });
    }

    // Only one design per kind is in force. Stand the current one down first —
    // the partial unique index allows a single active row per kind, so the
    // other order fails.
    await admin.from('credential_templates')
      .update({ is_active: false })
      .eq('kind', tpl.kind)
      .eq('is_active', true);

    const { error: pubErr } = await admin
      .from('credential_templates')
      .update({
        lifecycle: 'published',
        is_active: true,
        published_at: new Date().toISOString(),
      })
      .eq('id', tpl.id);

    if (pubErr) {
      // The database's own message names which offices are outstanding, which
      // is what the desk needs to read.
      return NextResponse.json({ ok: false, error: 'not-approved', detail: pubErr.message }, { status: 409 });
    }

    const auditErr = await audit(admin, {
      action: 'credential_template.published',
      entityType: 'credential_template',
      entityId: tpl.id,
      performedBy: caller.id,
      details: { kind: tpl.kind, version: tpl.version, name: tpl.name, by_email: caller.email },
    });
    return NextResponse.json({ ok: true, published: tpl, auditWarning: auditErr ?? undefined });
  }

  // -------- approving --------
  //
  // 'approve-credential-design' is held by the three approving offices and by
  // nobody else — see roles.ts. The Superadministrator is deliberately not
  // among them: an approval you give to your own work is a countersignature,
  // not a control.
  const g = await guard(request, 'approve-credential-design');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  if (body.decision !== 'approved' && body.decision !== 'rejected') {
    return NextResponse.json({ ok: false, error: 'decision-must-be-approved-or-rejected' }, { status: 400 });
  }
  if (body.decision === 'rejected' && !body.note?.trim()) {
    return NextResponse.json({
      ok: false,
      error: 'rejection-needs-a-reason',
      detail: 'An office that refuses a design has to say why. The designer cannot answer an ' +
        'objection they have not been told.',
    }, { status: 400 });
  }

  // The office is the caller's own, read from their profile. Taking it from the
  // request would let any approver sign for all three.
  const office = caller.role;
  if (!['registrar', 'academic-office', 'vice-chancellor'].includes(office ?? '')) {
    return NextResponse.json({ ok: false, error: 'not-an-approving-office' }, { status: 403 });
  }

  const { error: appErr } = await admin.from('credential_template_approvals').insert({
    template_id: body.templateId,
    office,
    decision: body.decision,
    decided_by: caller.id,
    note: body.note?.trim() || null,
  });
  if (appErr) {
    return NextResponse.json({
      ok: false,
      error: 'approval-refused',
      detail: appErr.message.includes('duplicate')
        ? 'This office has already recorded a decision on this design. An approval cannot be ' +
          'edited — the submission must be withdrawn and resubmitted.'
        : appErr.message,
    }, { status: 409 });
  }

  const { count } = await admin
    .from('credential_template_approvals')
    .select('office', { count: 'exact', head: true })
    .eq('template_id', body.templateId)
    .eq('decision', 'approved');

  const auditErr = await audit(admin, {
    action: `credential_template.${body.decision}`,
    entityType: 'credential_template',
    entityId: body.templateId,
    performedBy: caller.id,
    details: { office, note: body.note ?? null, by_email: caller.email },
  });

  return NextResponse.json({
    ok: true,
    office,
    decision: body.decision,
    approvals: count ?? 0,
    outstanding: Math.max(0, 3 - (count ?? 0)),
    auditWarning: auditErr ?? undefined,
  });
}
