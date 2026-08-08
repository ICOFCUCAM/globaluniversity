// ---------------------------------------------------------------------------
// LIVEKIT, AS THE PROCTORING ADAPTER.
//
// The one provider in docs/EXAMINATIONS.md that can be self-hosted, which is
// the only arrangement that keeps recordings of students' homes on
// infrastructure the University controls.
//
// ---------------------------------------------------------------------------
// NO SDK
// ---------------------------------------------------------------------------
//
// A LiveKit join token is a JWT signed with HS256 and a handful of claims. That
// is thirty lines of node:crypto, and adding a dependency for it would mean the
// University carrying a package — and its transitive tree — into every future
// audit of what this system depends on.
//
// The recording calls DO need HTTP, and they are here too. What is not here is
// anything that pretends to work: `startRecording` calls LiveKit's egress
// service and reports what it says.
//
// ---------------------------------------------------------------------------
// THE TOKEN IS SHORT-LIVED AND SCOPED TO ONE ROOM
// ---------------------------------------------------------------------------
//
// Six hours, one room, and a candidate's token cannot publish to anybody else's
// sitting. A long-lived token is a standing invitation into somebody's home; a
// room-scoped one that expires is the difference between an examination and
// surveillance.
// ---------------------------------------------------------------------------

import { createHmac } from 'node:crypto';
import type { ProctoringAdapter } from '@/lib/proctoringProvider';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * A LiveKit access token.
 *
 * `canPublish` differs by role and that difference is the whole access model: a
 * candidate publishes their camera and screen and subscribes to nothing, a
 * proctor subscribes and may speak, an observer only watches. A candidate who
 * could subscribe would see the other candidates in the room.
 */
export function joinToken(input: {
  apiKey: string;
  apiSecret: string;
  room: string;
  identity: string;
  role: 'candidate' | 'proctor' | 'observer';
  ttlSeconds?: number;
}): { token: string; expiresAt: string } {
  const now = Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds ?? 6 * 3600;

  const grants = {
    room: input.room,
    roomJoin: true,
    canPublish: input.role !== 'observer',
    // THE CANDIDATE SUBSCRIBES TO NOTHING. Without this, every candidate in a
    // room can watch every other candidate — which is both a privacy failure
    // and, in an examination, a way to see somebody else's screen.
    canSubscribe: input.role !== 'candidate',
    canPublishData: true,
    hidden: input.role === 'observer',
  };

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: input.apiKey,
    sub: input.identity,
    nbf: now,
    exp: now + ttl,
    jti: `${input.identity}-${now}`,
    video: grants,
  }));

  const signature = createHmac('sha256', input.apiSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return {
    token: `${header}.${payload}.${signature}`,
    expiresAt: new Date((now + ttl) * 1000).toISOString(),
  };
}

/**
 * The adapter, when LiveKit is configured.
 *
 * Returns null rather than throwing when it is not, so the caller's "no
 * provider" path is the ordinary one rather than an exception handler.
 */
export function liveKitAdapter(env: NodeJS.ProcessEnv = process.env): ProctoringAdapter | null {
  const url = env.LIVEKIT_URL?.trim();
  const apiKey = env.LIVEKIT_API_KEY?.trim();
  const apiSecret = env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) return null;

  // The HTTP endpoint, derived from the websocket one so the University sets a
  // single variable. Getting this wrong produces a connection that hangs rather
  // than an error, which is the worst kind of misconfiguration to diagnose.
  const httpBase = url.replace(/^ws/, 'http').replace(/\/$/, '');

  const roomFor = (sessionId: string) => `exam-${sessionId}`;

  /** LiveKit's server API is authenticated with the same JWT, with room admin. */
  const adminToken = () => {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({
      iss: apiKey, sub: apiKey, nbf: now, exp: now + 600,
      video: { roomCreate: true, roomAdmin: true, roomList: true },
    }));
    const sig = createHmac('sha256', apiSecret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
  };

  async function callEgress(path: string, body: unknown) {
    const res = await fetch(`${httpBase}/twirp/livekit.Egress/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken()}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      // LIVEKIT'S OWN WORDS. "Egress is not configured" and "no storage
      // configured" are both common, both fixable, and both indistinguishable
      // from each other in a generic message.
      throw new Error(`LiveKit egress refused: ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : {};
  }

  return {
    async joinToken({ sessionId, participantId, role }) {
      const { token, expiresAt } = joinToken({
        apiKey, apiSecret, room: roomFor(sessionId), identity: participantId, role,
      });
      return { url, token, expiresAt };
    },

    async startRecording({ sessionId, kinds }) {
      const room = roomFor(sessionId);
      const out: Array<{ kind: string; externalRef: string; storagePath: string }> = [];

      for (const kind of kinds) {
        // One egress per stream so camera and screen land as separate files —
        // an appeal usually wants one of them, and a composite would force
        // whoever reviews it to watch both at once.
        const storagePath = `examinations/${sessionId}/${kind}.mp4`;
        const started = await callEgress('StartRoomCompositeEgress', {
          room_name: room,
          layout: kind === 'screen' ? 'single-speaker' : 'grid',
          file_outputs: [{ filepath: storagePath }],
        });
        out.push({ kind, externalRef: String(started.egress_id ?? ''), storagePath });
      }
      return out;
    },

    async stopRecording({ sessionId }) {
      const list = await callEgress('ListEgress', { room_name: roomFor(sessionId), active: true });
      for (const e of list.items ?? []) {
        await callEgress('StopEgress', { egress_id: e.egress_id });
      }
    },

    async destroyRecording({ externalRef }) {
      // DELETION IS THE STORAGE PROVIDER'S JOB, NOT LIVEKIT'S, and saying so is
      // more useful than a call that silently does nothing. LiveKit writes the
      // file and forgets it; whoever owns the bucket removes it. The retention
      // job reads exam_recordings.retention_until and acts against storage.
      throw new Error(
        `LiveKit does not delete recordings — it writes them to the University's storage and has `
        + `no further hold on them. Delete ${externalRef} from the storage bucket, and record the `
        + 'deletion in exam_recordings.destroyed_at. See docs/EXAMINATIONS.md.',
      );
    },
  };
}
