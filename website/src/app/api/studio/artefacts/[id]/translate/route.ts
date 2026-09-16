import { NextResponse } from 'next/server';
import { mayRunStudioAct } from '@/academic/lib/studioPermissions';
import type { Capability } from '@/lib/roles';
import { getStore } from '@/academic/lib/data';
import { engine } from '@/academic/lib/ai/engine';
import { currentActor } from '@/academic/lib/session';
import { approveTranslation, Refused, translateArtefact } from '@/academic/lib/service';

/**
 * Translate an APPROVED artefact into one more language, or vouch for a
 * translation somebody has read. Both go through the service, which holds the
 * gate: a draft is not translated, and a language the actor cannot read is not
 * approved by them.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  const body = await request.json();
  // ---- THE UNIVERSITY'S PERMISSION, NOT ONLY THE OWNER'S RIGHT ----------
  //
  // `ownership.ts` decides whose material this is. This decides whether the
  // University is willing to have the act performed at all — the ruling of
  // 16 September 2026, which separated submitting from generating. Both are
  // asked, and both must agree.
  const may = await mayRunStudioAct(actor.id, 'studio-ai-translate' as Capability);
  if (!may.allowed) {
    return NextResponse.json({
      error: may.reason, needsPermission: may.needsPermission === true,
    }, { status: 403 });
  }


  try {
    if (body.action === 'approve') {
      return NextResponse.json({ artefact: await approveTranslation(getStore(), actor, params.id) });
    }
    const artefact = await translateArtefact(getStore(), engine(), actor, params.id, body.language);
    return NextResponse.json({ artefact });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
