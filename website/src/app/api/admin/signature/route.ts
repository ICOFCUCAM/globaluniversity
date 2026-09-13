// ---------------------------------------------------------------------------
// THE SPECIMEN SIGNATURE — storing one, and switching it on.
//
//   POST /api/admin/signature  { action, ... }
//
//   store   { image, ownerName, ownerRole }   your own; always arrives OFF
//   enable  { ownerId, authority }            somebody ELSE's, on stated grounds
//   revoke  { ownerId, reason }               switch one off again
//   mine    {}                                what you have stored, without the image
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS, AND IT IS AN AUDIT FINDING
// ---------------------------------------------------------------------------
//
// 049 created `signature_specimens` — one per officer, off until somebody other
// than its owner enables it, with the authority for that written down. Both
// letter routes read it and reproduce the image over the signature rule.
//
// NOTHING EVER WROTE IT. No route, no screen, in the whole application. The
// read path was live code against a table that could only ever be empty, so the
// Vice-Chancellor's signature could not reach a letter no matter what was in
// the database — and the question "can the VC's saved signature be affixed?"
// had the answer "the code to affix it has been there all along, and there is
// no way to put one in".
//
// ---------------------------------------------------------------------------
// WHO MAY DO WHAT, AND WHY IT IS SPLIT
// ---------------------------------------------------------------------------
//
// STORING IS YOUR OWN BUSINESS. Anyone who signs a University document may put
// their own specimen in. It arrives switched off and is useless until somebody
// else turns it on, so storing one grants nothing.
//
// ENABLING IS SOMEBODY ELSE'S. `approve-credential-design` — the same authority
// that approves what a University document looks like, because that is what
// this is: a decision about the University's documents. The database refuses
// self-enabling outright, so this is two locks on one door.
//
// A specimen signature is a standing authority to reproduce somebody's
// signature on documents they may never see. It is the single most forgeable
// object in this system, and it is the one thing here that nobody may grant
// themselves.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

type Row = Record<string, unknown>;

// NOT EXPORTED. A Next.js route file may export only its handlers and the
// runtime flags — anything else fails the build with "does not match the
// required types of a Next.js Route", which is a confusing way to be told you
// put a constant in the wrong file.
/** What 049 requires of the stated grounds. */
const MIN_AUTHORITY = 20;

/**
 * The ceiling on a stored signature.
 *
 * MEASURED AGAINST WHAT IT IS FOR. A signature is drawn at about 150 × 50
 * points on the page; a 600px-wide PNG is more than a printer can use. 200 KB
 * is generous for that and small enough that reading a letter's row does not
 * drag an image the size of a photograph behind it.
 */
const MAX_SIGNATURE_BYTES = 200_000;

// THE CAPABILITY PER ACTION. `store` and `mine` are deliberately the lowest
// bar in this file: they concern nobody but the caller.
const CAPABILITY: Record<string, Capability> = {
  store: 'issue-appointment-letter' as Capability,
  mine: 'issue-appointment-letter' as Capability,
  enable: 'approve-credential-design' as Capability,
  revoke: 'approve-credential-design' as Capability,
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  const capability = CAPABILITY[action];
  if (!capability) {
    return bad('unknown-action', 400,
      `Not a signature action. They are: ${Object.keys(CAPABILITY).join(', ')}.`);
  }

  const g = await guard(request, capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: action === 'enable' || action === 'revoke'
        ? 'Switching a specimen signature on is held by the office that approves what the '
          + 'University’s documents look like. It is not something anybody does for themselves.'
        : undefined,
    }, { status: g.status });
  }
  const { caller } = g;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return bad('service-role-key-missing', 500);
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // =========================================================================
  // MINE — what have I got, and is it on?
  // =========================================================================
  //
  // THE IMAGE IS NOT RETURNED. A screen showing whether a signature is stored
  // does not need the signature, and an endpoint that hands one back is an
  // endpoint somebody will eventually call from somewhere else.
  if (action === 'mine') {
    const { data } = await admin.from('signature_specimens')
      .select('owner_name, owner_role, enabled, enabled_at, authority, revoked_at, revoked_reason, updated_at')
      .eq('owner_id', caller.id).maybeSingle();

    const s = data as Row | null;
    return NextResponse.json({
      ok: true,
      stored: Boolean(s),
      ...(s ?? {}),
    });
  }

  // =========================================================================
  // STORE — your own, and it arrives switched off
  // =========================================================================
  if (action === 'store') {
    const image = String(body.image ?? '');
    const ownerName = String(body.ownerName ?? '').trim();
    const ownerRole = String(body.ownerRole ?? '').trim();

    if (!image.startsWith('data:image/')) {
      return bad('not-an-image', 400,
        'A specimen signature is stored as the image itself, not as a link. A signature '
        + 'fetched over the network is one anybody can download, and one that fails to load '
        + 'leaves a letter that looks unsigned.');
    }
    const bytes = Math.round((image.length - image.indexOf(',') - 1) * 0.75);
    if (bytes > MAX_SIGNATURE_BYTES) {
      return bad('too-large', 400,
        `That image comes to ${Math.round(bytes / 1024)} KB and the limit is `
        + `${Math.round(MAX_SIGNATURE_BYTES / 1024)} KB. A signature is drawn about 150 points `
        + 'wide on the page; a photograph of one is far more than a printer can use.');
    }
    if (ownerName.length < 3 || ownerRole.length < 2) {
      return bad('who-is-signing', 400,
        'The name and the office go with the specimen, because they are what is printed under '
        + 'it. A signature with no office beneath it does not say who signed.');
    }

    // ---------------------------------------------------------------------
    // REPLACING AN IMAGE SWITCHES IT OFF AGAIN.
    //
    // This is the rule that matters in the whole file. Without it, an officer
    // whose specimen has been approved could store a DIFFERENT image over it
    // and keep the approval — so the second pair of eyes would have approved
    // one signature and authorised another. The approval is of the image, not
    // of the person.
    // ---------------------------------------------------------------------
    const { data: existing } = await admin.from('signature_specimens')
      .select('id, enabled, image').eq('owner_id', caller.id).maybeSingle();
    const prior = existing as Row | null;
    const changed = !prior || prior.image !== image;

    const { error } = await admin.from('signature_specimens').upsert({
      owner_id: caller.id,
      owner_name: ownerName,
      owner_role: ownerRole,
      image,
      ...(changed ? {
        enabled: false, enabled_by: null, enabled_at: null, authority: null,
      } : {}),
      revoked_at: null,
      revoked_reason: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id' });

    if (error) return bad(`not-stored: ${error.message}`, 500);

    return NextResponse.json({
      ok: true,
      detail: changed && prior?.enabled
        ? 'Stored, and switched off again. The approval was of the previous image, so this one '
          + 'needs approving before it appears on anything.'
        : 'Stored, and switched off. It appears on nothing until somebody other than you '
          + 'enables it — you cannot enable your own.',
    });
  }

  // =========================================================================
  // ENABLE — somebody else's, on stated grounds
  // =========================================================================
  if (action === 'enable') {
    const ownerId = String(body.ownerId ?? '');
    const authority = String(body.authority ?? '').trim();

    if (!ownerId) return bad('no-owner', 400);

    // REFUSED HERE AS WELL AS IN THE DATABASE. 049's constraint would catch
    // this, and a constraint violation reaches the officer as a wall of SQL —
    // this is the same refusal in the University's own words.
    if (ownerId === caller.id) {
      return bad('cannot-enable-your-own', 409,
        'You cannot switch on your own specimen signature. It is a standing authority to '
        + 'reproduce your signature on documents you may never see, and it needs a second '
        + 'pair of eyes for the same reason a certificate design does.');
    }
    if (authority.length < MIN_AUTHORITY) {
      return bad('no-authority', 400,
        'Say on what authority the University permits this — a minute, a decision, an '
        + 'instruction. A standing permission nobody explained is one nobody can withdraw '
        + 'with confidence later.');
    }

    const { data: found } = await admin.from('signature_specimens')
      .select('id, owner_name, image, revoked_at').eq('owner_id', ownerId).maybeSingle();
    const spec = found as Row | null;
    if (!spec) {
      return bad('nothing-stored', 404,
        'That officer has not stored a specimen signature, so there is nothing to switch on.');
    }
    if (!spec.image) return bad('no-image', 409, 'That specimen has no image.');

    const { error } = await admin.from('signature_specimens').update({
      enabled: true,
      enabled_by: caller.id,
      enabled_at: new Date().toISOString(),
      authority,
      revoked_at: null,
      revoked_reason: null,
      updated_at: new Date().toISOString(),
    }).eq('owner_id', ownerId);

    if (error) return bad(`not-enabled: ${error.message}`, 500);

    return NextResponse.json({
      ok: true,
      detail: `${String(spec.owner_name ?? 'That officer')}’s signature will now be reproduced `
        + 'on the documents they issue. It stays on until somebody revokes it, and replacing '
        + 'the image switches it off again.',
    });
  }

  // =========================================================================
  // REVOKE
  // =========================================================================
  if (action === 'revoke') {
    const ownerId = String(body.ownerId ?? '');
    const reason = String(body.reason ?? '').trim();
    if (!ownerId) return bad('no-owner', 400);
    if (reason.length < 12) {
      return bad('no-reason', 400,
        'Say why it is being withdrawn. It goes on the record beside the permission it undoes.');
    }

    const { error } = await admin.from('signature_specimens').update({
      enabled: false,
      revoked_at: new Date().toISOString(),
      revoked_reason: reason,
      updated_at: new Date().toISOString(),
    }).eq('owner_id', ownerId);

    if (error) return bad(`not-revoked: ${error.message}`, 500);

    // DOCUMENTS ALREADY ISSUED ARE NOT TOUCHED, and should not be. They were
    // signed under a permission that stood at the time, and the archive holds
    // the bytes that were sent. Revoking changes what happens next.
    return NextResponse.json({
      ok: true,
      detail: 'Withdrawn. Documents already issued keep the signature they were issued with — '
        + 'they were signed under a permission that stood at the time, and the archive holds '
        + 'exactly what was sent.',
    });
  }

  return bad('unknown-action', 400);
}
