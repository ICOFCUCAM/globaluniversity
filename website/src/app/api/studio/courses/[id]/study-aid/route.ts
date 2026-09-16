import { NextResponse } from 'next/server';
import { mayRunStudioAct } from '@/academic/lib/studioPermissions';
import type { Capability } from '@/lib/roles';
import { getStore } from '@/academic/lib/data';
import { engine } from '@/academic/lib/ai/engine';
import { currentActor } from '@/academic/lib/session';
import { makeStudyAid, Refused } from '@/academic/lib/service';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  const body = await request.json();
  // ---- THE UNIVERSITY'S PERMISSION, NOT ONLY THE OWNER'S RIGHT ----------
  //
  // `ownership.ts` decides whose material this is. This decides whether the
  // University is willing to have the act performed at all — the ruling of
  // 16 September 2026, which separated submitting from generating. Both are
  // asked, and both must agree.
  // A TEST AND A REVISION SET ARE DIFFERENT PERMISSIONS. The University's
  // sketch lists 'Generate quiz' and 'AI Revision Materials' as separate
  // rows, so they are separate here: a lecturer may be trusted to build a
  // practice quiz and not to generate an audio revision.
  const may = await mayRunStudioAct(actor.id, (body.kind === 'test' ? 'studio-ai-generate-quiz' : 'studio-ai-generate-revision') as Capability);
  if (!may.allowed) {
    return NextResponse.json({
      error: may.reason, needsPermission: may.needsPermission === true,
    }, { status: 403 });
  }


  try {
    const aid = await makeStudyAid(getStore(), engine(), actor, params.id, {
      kind: body.kind,
      lectures: body.lectures ?? null,
      questions: body.questions,
      minutes: body.minutes,
      language: body.language,
    });
    return NextResponse.json({ aid });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
