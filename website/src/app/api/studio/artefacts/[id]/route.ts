import { NextResponse } from 'next/server';
import { mayRunStudioAct } from '@/academic/lib/studioPermissions';
import type { Capability } from '@/lib/roles';
import { getStore } from '@/academic/lib/data';
import { currentActor } from '@/academic/lib/session';
import { approve, editArtefact, publish, Refused, withdraw } from '@/academic/lib/service';

/**
 * The review layer, as four verbs. Each one goes through `mayAct` inside the
 * service — this route does not decide anything, it only names the act.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const body = await request.json();

  // ---- APPROVING, PUBLISHING AND REPLACING ARE THREE PERMISSIONS --------
  //
  // Approval is the act 092 enforces in the database: nothing reaches
  // `published` without first being `approved` by a named person. Publishing
  // is `publish-course-material`, which the lecturer already holds and which
  // since 093 literally writes the `course_lessons` row a student opens.
  // Replacing a recording is neither, and is separate because it destroys the
  // source everything else was made from.
  //
  // `edit` IS NOT HERE ON PURPOSE. Correcting the words of your own material
  // is what a lecturer is FOR, and `ownership.ts` already refuses it to
  // everybody else. Putting a grantable permission in front of a lecturer
  // fixing their own sentence would be the University taking authorship, which
  // is the one thing this whole design refuses to do.
  const NEEDED: Record<string, string> = {
    approve: 'studio-approve-content',
    publish: 'publish-course-material',
    withdraw: 'publish-course-material',
    // `replace` IS NOT LISTED, because this route has no `replace` action to
    // trigger it — a recording is replaced today by uploading another one.
    // Naming it here made `studio-replace-content` LOOK consulted while
    // nothing could reach it, which is the shape of fault this whole file is
    // about. It goes in when the act does.
  };
  const needed = NEEDED[String(body.action ?? '')];
  if (needed) {
    const may = await mayRunStudioAct(actor.id, needed as Capability);
    if (!may.allowed) {
      return NextResponse.json({
        error: may.reason, needsPermission: may.needsPermission === true, capability: needed,
      }, { status: 403 });
    }
  }

  try {
    switch (body.action) {
      case 'edit':
        return NextResponse.json({ artefact: await editArtefact(store, actor, params.id, body.body, body.note) });
      case 'approve':
        return NextResponse.json({ artefact: await approve(store, actor, params.id) });
      case 'publish':
        return NextResponse.json({ artefact: await publish(store, actor, params.id) });
      case 'withdraw':
        return NextResponse.json({ artefact: await withdraw(store, actor, params.id) });
      default:
        return NextResponse.json({ error: `Unknown action ${body.action}.` }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Refused) return NextResponse.json({ error: error.why }, { status: 403 });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
