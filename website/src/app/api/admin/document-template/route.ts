// ---------------------------------------------------------------------------
// THE TEMPLATE REGISTRY — writing wording, and putting it in force.
//
//   POST /api/admin/document-template  { action, ... }
//
//   draft    { kind, name, body, effectiveFrom? }   → approve-credential-design
//   activate { id, effectiveFrom }                  → approve-credential-design
//   retire   { id, reason }                         → approve-credential-design
//
// ---------------------------------------------------------------------------
// THE CAPABILITY IS THE ONE THAT APPROVES A CERTIFICATE DESIGN
// ---------------------------------------------------------------------------
//
// Not a new capability. A template decides what every future document of its
// kind says, which is the same order of act as approving the design of a degree
// certificate — and 005 already established who may do that. Inventing a
// parallel permission would mean two answers to "who decides the University's
// wording".
//
// ---------------------------------------------------------------------------
// NOBODY ACTIVATES WHAT THEY WROTE
// ---------------------------------------------------------------------------
//
// 044 refuses it in the database and this refuses it here, with a message that
// says why rather than a bare 403. It is the same rule 005 applies to a
// certificate design and 048 to a job description, and here the thing being
// approved is the wording of every letter the University will send.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import type { Capability } from '@/lib/roles';
import {
  isTemplateKind, canActivate, MIN_TEMPLATE_NAME, MIN_TEMPLATE_BODY,
} from '@/lib/documentTemplates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line max-len
const COLUMNS = 'id, kind, version, name, body, status, effective_from, created_by, activated_by, activated_at, retired_at';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

type Row = Record<string, unknown>;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (!['draft', 'activate', 'retire'].includes(action)) {
    return bad('unknown-action', 400, 'They are: draft, activate, retire.');
  }

  const g = await guard(request, 'approve-credential-design' as Capability);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { caller } = g;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return bad('service-role-key-missing', 500);
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // =========================================================================
  // DRAFT — a new version of a kind's wording
  // =========================================================================
  if (action === 'draft') {
    const kind = String(body.kind ?? '');
    const name = String(body.name ?? '').trim();
    const text = String(body.body ?? '').trim();

    if (!isTemplateKind(kind)) {
      return bad('unknown-kind', 400,
        'That is not a document the University issues. The registry is a closed list so that '
        + 'a template cannot be written for a document nothing will ever ask for.');
    }
    if (name.length < MIN_TEMPLATE_NAME) return bad('no-name', 400, 'Give the wording a name.');
    if (text.length < MIN_TEMPLATE_BODY) {
      return bad('no-body', 400, 'A template with nothing in it produces a document with '
        + 'nothing in it.');
    }

    // THE NEXT VERSION, READ FROM THE REGISTRY. Counting in the application
    // would let two officers drafting at the same moment both write version 3.
    const { data: latest } = await admin.from('document_templates')
      .select('version').eq('kind', kind)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    const version = Number((latest as Row | null)?.version ?? 0) + 1;

    const { data, error } = await admin.from('document_templates').insert({
      kind,
      version,
      name,
      body: text,
      status: 'draft',
      effective_from: body.effectiveFrom ? String(body.effectiveFrom) : null,
      created_by: caller.id,
    }).select(COLUMNS).single();

    if (error || !data) return bad(`not-saved: ${error?.message ?? 'no row'}`, 500);

    return NextResponse.json({
      ok: true,
      id: (data as Row).id,
      version,
      detail: `Saved as version ${version}, in draft. It produces nothing until somebody other `
        + 'than you activates it.',
    });
  }

  const { data: found } = await admin.from('document_templates')
    .select(COLUMNS).eq('id', String(body.id ?? '')).maybeSingle();
  const template = found as Row | null;
  if (!template) return bad('template-not-found', 404);

  // =========================================================================
  // ACTIVATE — put it in force
  // =========================================================================
  if (action === 'activate') {
    if (!canActivate(template, caller.id)) {
      return bad(
        template.created_by === caller.id ? 'cannot-activate-your-own' : 'not-a-draft',
        409,
        template.created_by === caller.id
          ? 'You wrote this wording, so you cannot also be the one who puts it in force. A '
            + 'template decides what every future document of its kind says.'
          : `This template is ${String(template.status)}.`,
      );
    }

    const effectiveFrom = String(body.effectiveFrom ?? '').trim()
      || new Date().toISOString().slice(0, 10);

    const now = new Date().toISOString();
    // THE PREVIOUS VERSION IS RETIRED, NOT DELETED. It produced documents and
    // remains the provenance of every one of them — 044 and 051 refuse the
    // delete, and this does not attempt one.
    await admin.from('document_templates')
      .update({ status: 'retired', retired_at: now })
      .eq('kind', template.kind as string).eq('status', 'active');

    const { error } = await admin.from('document_templates').update({
      status: 'active',
      activated_by: caller.id,
      activated_at: now,
      effective_from: effectiveFrom,
    }).eq('id', template.id as string);
    if (error) return bad(`not-activated: ${error.message}`, 500);

    return NextResponse.json({
      ok: true,
      detail: `Version ${template.version} is in force from ${effectiveFrom}. Documents already `
        + 'issued are untouched: each keeps the version that produced it, and that version can '
        + 'never be deleted.',
    });
  }

  // =========================================================================
  // RETIRE — stop producing from it, keep accounting for it
  // =========================================================================
  if (action === 'retire') {
    if (template.status === 'retired') return bad('already-retired', 409);
    const { error } = await admin.from('document_templates').update({
      status: 'retired', retired_at: new Date().toISOString(),
    }).eq('id', template.id as string);
    if (error) return bad(`not-retired: ${error.message}`, 500);
    return NextResponse.json({
      ok: true,
      detail: 'Retired. It produces nothing new and still accounts for what it produced — the '
        + 'documents made from it keep naming it.',
    });
  }

  return bad('unknown-action', 400);
}
