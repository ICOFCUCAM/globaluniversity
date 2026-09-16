import { NextResponse } from 'next/server';
import { getQueue, getStore } from '@/academic/lib/data';
import { engine } from '@/academic/lib/ai/engine';
import { currentActor } from '@/academic/lib/session';
import { Refused, runStage } from '@/academic/lib/service';
import { CAPABILITY_FOR_STAGE, mayRunStudioAct } from '@/academic/lib/studioPermissions';

/** Run one stage now. The lecturer pressed a button; they are watching. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json().catch(() => ({}));

  // ---- MAY THIS ACCOUNT ASK A MODEL TO DO THIS? --------------------------
  //
  // The University's ruling of 16 September 2026: submitting a lecture and
  // running a model on it are different acts, and the second one is granted
  // rather than assumed. Each stage has its own capability, so "may transcribe
  // but may not generate audio" is a sentence this system can hold.
  //
  // CHECKED HERE AND NOT ONLY ON THE SCREEN. The screen draws a padlock, which
  // is for the person; this is for the request. A hidden button is not a rule,
  // and this route is reachable without one.
  //
  // A STAGE WITH NO CAPABILITY IS REFUSED, not waved through. Adding a stage
  // to the pipeline and forgetting to say who may run it should stop the
  // stage, not open it.
  const needed = CAPABILITY_FOR_STAGE[String(body.kind ?? '')];
  if (!needed) {
    return NextResponse.json({
      error: `No capability is recorded for the stage “${String(body.kind ?? '')}”, so the `
        + 'Academic Studio will not run it. Name it in CAPABILITY_FOR_STAGE.',
    }, { status: 403 });
  }
  const may = await mayRunStudioAct(actor.id, needed);
  if (!may.allowed) {
    return NextResponse.json({
      error: may.reason, needsPermission: may.needsPermission === true, capability: needed,
    }, { status: 403 });
  }

  try {
    const artefact = await runStage(store, engine(), actor, params.id, body.kind, {
      mode: body.mode, persona: body.persona, revision: body.revision,
      // The approved master is immutable in substance: writing over it takes a
      // second, explicit act, and the service refuses without this.
      regenerate: body.regenerate === true,
    });
    // A transformation failure is recorded ON the artefact, not thrown: the
    // lecturer has to be able to read what the model actually said.
    return NextResponse.json({ artefact }, { status: artefact.state === 'failed' ? 200 : 200 });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ jobs: await getQueue().forLecture(params.id) });
}
