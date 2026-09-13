'use client';

// ---------------------------------------------------------------------------
// SETTINGS → MY SIGNATURE.
//
// ---------------------------------------------------------------------------
// WHY THIS SCREEN DID NOT EXIST, AND WHAT THAT COST
// ---------------------------------------------------------------------------
//
// 049 built `signature_specimens`: one per officer, off until somebody else
// enables it, with the grounds written down. The appointment-letter route and
// the correspondence route both read it and reproduce the image over the
// signature rule.
//
// Nothing ever wrote to it. No route, no screen. So the reading code was live
// against a table that could only be empty, and the Vice-Chancellor's saved
// signature could not reach a letter however much the system appeared to
// support it. The audit found it by counting reads and writes per table:
// `signature_specimens`, read in two places, written in none.
//
// ---------------------------------------------------------------------------
// WHAT THIS SCREEN WILL NOT DO
// ---------------------------------------------------------------------------
//
// SWITCH YOUR OWN SIGNATURE ON. You store it; somebody holding the authority
// that approves the University's documents turns it on, and says on what
// grounds. The database refuses self-enabling outright and the route refuses it
// again in plainer words — because a specimen signature is a standing authority
// to reproduce your signature on documents you may never see.
//
// SHOW YOU SOMEBODY ELSE'S. The row is readable only by its owner and by the
// service role that prints the letter. There is no screen anywhere that lists
// the University's signatures, and there should not be.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { authedPost } from '@/lib/authedFetch';
import { BTN_PRIMARY, BTN_GHOST, INPUT, LABEL } from '@/lib/portalTheme';
import {
  Loader2, CheckCircle2, AlertTriangle, PenLine, Upload, ShieldCheck,
} from 'lucide-react';

/** Wide enough for a printer at the 150pt it is drawn at, and no wider. */
const MAX_WIDTH = 600;
const MAX_BYTES = 200_000;

interface Stored {
  stored: boolean;
  owner_name?: string | null;
  owner_role?: string | null;
  enabled?: boolean;
  enabled_at?: string | null;
  authority?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
}

/**
 * Read the chosen file, downsize it, and return a PNG data URI.
 *
 * PNG ALWAYS, NEVER JPEG. A signature is ink on white with nothing in between,
 * and JPEG puts a grey halo around every stroke — which on a formal document
 * reads as a photocopy of a photocopy. PNG also keeps transparency where the
 * officer has cut the signature out, so it sits on the rule rather than in a
 * white box over it.
 */
function prepare(file: File): Promise<{ dataUri: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('That file is not an image. Scan or photograph your signature and save '
        + 'it as a PNG.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_WIDTH / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('This browser would not open a canvas, so the image could not be '
          + 'prepared.'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUri = canvas.toDataURL('image/png');
      const bytes = Math.round((dataUri.length - dataUri.indexOf(',') - 1) * 0.75);
      if (bytes > MAX_BYTES) {
        reject(new Error(
          `That comes to ${Math.round(bytes / 1024)} KB and the limit is `
          + `${Math.round(MAX_BYTES / 1024)} KB. A photograph of a whole page will not fit — `
          + 'crop it to the signature itself.',
        ));
        return;
      }
      resolve({ dataUri, bytes });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

export default function SignatureSpecimen({
  defaultName, defaultRole,
}: { defaultName?: string; defaultRole?: string }) {
  const [stored, setStored] = useState<Stored | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState(defaultName ?? '');
  const [role, setRole] = useState(defaultRole ?? '');
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const out = await authedPost('/api/admin/signature', { action: 'mine' });
    setLoading(false);
    if (!out.ok) {
      setMessage({
        tone: 'bad',
        text: (out.detail as string | undefined) ?? String(out.error ?? 'That could not be read.'),
      });
      return;
    }
    const s = out as unknown as Stored;
    setStored(s);
    if (s.owner_name) setName(s.owner_name);
    if (s.owner_role) setRole(s.owner_role);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function choose(file: File) {
    setMessage(null);
    try {
      const { dataUri } = await prepare(file);
      setImage(dataUri);
    } catch (e) {
      setMessage({ tone: 'bad', text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function save() {
    if (!image) return;
    setBusy(true);
    setMessage(null);
    const out = await authedPost('/api/admin/signature', {
      action: 'store', image, ownerName: name, ownerRole: role,
    });
    setBusy(false);
    setMessage({
      tone: out.ok ? 'ok' : 'bad',
      text: (out.detail as string | undefined) ?? String(out.error ?? 'That did not work.'),
    });
    if (out.ok) { setImage(null); void load(); }
  }

  if (loading) return <Loader2 size={18} className="animate-spin text-[#9c93ad]" />;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">
          <PenLine size={18} /> My signature
        </h3>
        <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          Stored here, it is reproduced above the signature rule on the letters you issue. It is
          held with your record and never fetched over the network, so it prints in an email
          client that blocks images and on a document opened offline.
        </p>
      </div>

      {message && (
        <div role="status" className={`rounded-xl p-3 text-sm ${
          message.tone === 'ok'
            ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
            : 'border border-red-600/30 bg-red-600/10 text-red-900 dark:text-red-200'
        }`}
        >
          {message.text}
        </div>
      )}

      {/* WHERE IT STANDS. Three states and they are genuinely different: not
          stored, stored but off, and in force. The middle one is the one an
          officer needs explaining, because they have done everything they can
          and nothing appears on their letters. */}
      <div className="rounded-xl border border-[#ece7de] p-4 dark:border-[#2e2637]">
        {!stored?.stored ? (
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
            Nothing stored. Your letters print a ruled line for you to sign by hand, which is a
            correct document — this only saves you signing each one.
          </p>
        ) : stored.enabled ? (
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 size={15} /> In force
            </p>
            <p className="text-[#6b6076] dark:text-[#9c93ad]">
              Reproduced on the documents you issue
              {stored.enabled_at ? ` since ${String(stored.enabled_at).slice(0, 10)}` : ''}.
            </p>
            {stored.authority && (
              <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                On the authority of: {stored.authority}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2 font-medium text-[#a07c12]">
              <AlertTriangle size={15} /> Stored, and switched off
            </p>
            <p className="text-[#6b6076] dark:text-[#9c93ad]">
              {stored.revoked_at
                ? `It was withdrawn on ${String(stored.revoked_at).slice(0, 10)}${
                  stored.revoked_reason ? `: ${stored.revoked_reason}` : ''}.`
                : 'It appears on nothing yet. You cannot switch on your own — a specimen '
                  + 'signature is a standing permission to reproduce your signature on documents '
                  + 'you may never see, so somebody holding the authority that approves the '
                  + 'University’s documents has to enable it and say on what grounds.'}
            </p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="sig-name" className={LABEL}>Name, as it is printed</label>
            <input id="sig-name" value={name} onChange={(e) => setName(e.target.value)}
              className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sig-role" className={LABEL}>Office, as it is printed beneath</label>
            <input id="sig-role" value={role} onChange={(e) => setRole(e.target.value)}
              className={INPUT} placeholder="e.g. Vice-Chancellor" />
          </div>
        </div>

        <div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void choose(file);
              e.target.value = '';
            }} />
          <button type="button" className={BTN_GHOST} onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> {image ? 'Choose a different image' : 'Choose an image'}
          </button>
          <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
            Sign on white paper, photograph or scan it, and crop to the signature. PNG keeps the
            strokes clean; a JPEG puts a grey halo round every one of them.
          </p>
        </div>

        {image && (
          <div className="rounded-xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637]">
            <p className="mb-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
              As it will appear on the rule:
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" style={{ maxHeight: 60 }} />
            <div className="mt-2 border-t border-[#422e59] pt-1 text-xs text-[#422e59]">
              <strong>{name || 'Your name'}</strong><br />{role || 'Your office'}
            </div>
          </div>
        )}

        <button type="button" className={BTN_PRIMARY}
          disabled={busy || !image || name.trim().length < 3 || role.trim().length < 2}
          onClick={() => void save()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Store it
        </button>

        {/* SAID BEFORE THEY PRESS IT, not after. Replacing an approved image
            switches it off again — the approval was of that image, not of the
            person — and an officer who discovers that afterwards has silently
            unsigned their own letters. */}
        {stored?.enabled && (
          <p className="text-xs text-[#a07c12]">
            Your signature is in force. Storing a different image switches it off until somebody
            approves the new one — the approval was of the image, not of you.
          </p>
        )}
      </div>
    </div>
  );
}
