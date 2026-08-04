import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';

export const runtime = 'nodejs';

// Signs and verifies academic credentials (transcripts, certificates) so a
// QR code on the document can be checked publicly at /verify. Set
// CREDENTIAL_SECRET in Vercel env vars for production-grade signatures.
const secret = () => process.env.CREDENTIAL_SECRET ?? 'iguc-credential-dev-secret';

const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('hex').slice(0, 24);

export async function POST(request: Request) {
  const { data } = await request.json().catch(() => ({}));
  if (typeof data !== 'string' || !data || data.length > 2000) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.json({ ok: true, sig: sign(data) });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = url.searchParams.get('d') ?? '';
  const sig = url.searchParams.get('s') ?? '';
  const valid = !!data && !!sig && sign(data) === sig;
  let payload: unknown = null;
  if (valid) {
    try {
      payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    } catch {
      return NextResponse.json({ ok: true, valid: false });
    }
  }
  return NextResponse.json({ ok: true, valid, payload });
}
