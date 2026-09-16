import { NextResponse } from 'next/server';
import { getStore } from '@/academic/lib/data';
import { currentActor } from '@/academic/lib/session';
import { myNotifications, readNotifications } from '@/academic/lib/service';

export async function GET() {
  const actor = await currentActor();
  return NextResponse.json({ notifications: await myNotifications(getStore(), actor) });
}

export async function POST() {
  const actor = await currentActor();
  await readNotifications(getStore(), actor);
  return NextResponse.json({ ok: true });
}
