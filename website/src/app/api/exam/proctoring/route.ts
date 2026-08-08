// ---------------------------------------------------------------------------
// IS LIVE SUPERVISION AVAILABLE ON THIS DEPLOYMENT?
//
// GET -> { live, provider, detail, requirements }
//
// Asked by the examiner console on load, so the console can say what is true
// rather than drawing camera panels with nothing behind them. See
// src/lib/proctoringProvider.ts for why this is a seam and not an
// implementation.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { proctoringStatus, proctoringAdapter } from '@/lib/proctoringProvider';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const g = await guard(request, 'proctor-examination');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  const status = proctoringStatus();
  const sessionId = new URL(request.url).searchParams.get('sessionId');

  // No sitting named: the console is only asking whether live supervision works
  // at all, so it gets the status and no credentials.
  if (!sessionId || !status.live) return NextResponse.json({ ok: true, ...status });

  const adapter = await proctoringAdapter();
  if (!adapter) return NextResponse.json({ ok: true, ...status });

  try {
    // A TOKEN FOR THIS PROCTOR, THIS ROOM, AND SIX HOURS. Minted per request
    // rather than stored: a join token is a live view into somebody's home, and
    // the shortest-lived thing that works is the right thing.
    const join = await adapter.joinToken({
      sessionId,
      participantId: g.caller.id,
      role: 'proctor',
    });
    return NextResponse.json({ ok: true, ...status, join });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      ...status,
      live: false,
      detail: `The media provider is configured but would not issue a token: ${
        e instanceof Error ? e.message : 'unknown error'}. Nothing is being watched.`,
    });
  }
}
