import { NextResponse } from 'next/server';
import { getStore } from '@/academic/lib/data';
import { engine } from '@/academic/lib/ai/engine';
import { currentActor } from '@/academic/lib/session';
import { makeStudyAid, Refused } from '@/academic/lib/service';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await currentActor();
  const body = await request.json();
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
