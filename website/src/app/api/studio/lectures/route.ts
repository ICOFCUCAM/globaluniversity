import { NextResponse } from 'next/server';
import { mayRunStudioAct } from '@/academic/lib/studioPermissions';
import type { Capability } from '@/lib/roles';
import { getQueue, getStore } from '@/academic/lib/data';
import { engine } from '@/academic/lib/ai/engine';
import { currentActor } from '@/academic/lib/session';
import { addLecture, addSource, Refused } from '@/academic/lib/service';
import { planFor } from '@/academic/lib/jobs/plan';
import { drain } from '@/academic/lib/jobs/worker';

/**
 * A lecture arrives. The recording or the transcript is stored, the pipeline
 * is QUEUED rather than run, and this returns — a ninety-minute lecture is not
 * processed inside an HTTP request.
 *
 * In this deployment the worker is then drained in the background of the same
 * process, which is honest for one installation and is the seam where a real
 * broker goes. See src/lib/jobs/queue.ts.
 */
export async function POST(request: Request) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json();
  // ---- THE UNIVERSITY'S PERMISSION, NOT ONLY THE OWNER'S RIGHT ----------
  //
  // `ownership.ts` decides whose material this is; this decides whether the
  // University is willing to have the act performed at all. The ruling of
  // 16 September 2026 separated submitting from generating, and both halves
  // of it have to be asked on the request, not only drawn on the screen.
  // A TYPED LECTURE AND AN UPLOADED RECORDING ARE DIFFERENT ACTS. The
  // University lists 'Write lecture' and 'Upload audio' as separate rows,
  // and they are: one costs nothing and one puts a file on the University's
  // storage that something will later be asked to transcribe.
  const may = await mayRunStudioAct(actor.id, (body.transcript ? 'studio-submit-lecture' : 'studio-upload-lecture') as Capability);
  if (!may.allowed) {
    return NextResponse.json({
      error: may.reason, needsPermission: may.needsPermission === true,
    }, { status: 403 });
  }


  try {
    const lecture = await addLecture(store, actor, body.courseId, {
      title: body.title,
      abstract: body.abstract,
      minutes: body.minutes,
      personal: body.personal,
    });

    const from: 'recording' | 'transcript' = body.transcript ? 'transcript' : 'recording';
    await addSource(store, actor, lecture.id, {
      kind: from,
      body: body.transcript,
      mediaPath: body.mediaPath,
      seconds: body.minutes ? body.minutes * 60 : undefined,
    });

    const plan = planFor({ have: [from], context: lecture.context, from });
    await getQueue().add(plan.map((kind, position) => ({
      lectureId: lecture.id,
      courseId: lecture.courseId,
      kind,
      actorId: actor.id,
      actorRole: actor.role,
      position,
      options: body.options,
    })));

    // Fire and forget: the page polls the pipeline rather than waiting here.
    void drain(store, engine(), getQueue());

    return NextResponse.json({ lecture, queued: plan });
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
