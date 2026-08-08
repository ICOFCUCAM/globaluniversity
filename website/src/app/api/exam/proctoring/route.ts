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
import { proctoringStatus } from '@/lib/proctoringProvider';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const g = await guard(request, 'proctor-examination');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  return NextResponse.json({ ok: true, ...proctoringStatus() });
}
