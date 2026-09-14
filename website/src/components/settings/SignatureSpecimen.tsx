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
// SHOW YOU SOMEBODY ELSE'S IMAGE. The image is never returned by any action
// here, not even to the officer who decides whether it may be used. Deciding
// that a signature may be reproduced does not require holding it.
//
// ---------------------------------------------------------------------------
// AND WHY EVERY LETTER PRINTED A BLANK RULE UNTIL NOW
// ---------------------------------------------------------------------------
//
// The University sent an appointment letter with an empty signature line, and
// asked why. The answer was the second half of the same fault this file was
// written to fix: `store` existed and `enable` did not — no screen anywhere
// called it. A specimen could be stored and could never be switched on, so the
// table filled with signatures that no letter could use, and the officer who
// holds the authority to enable one had no way to learn that anybody was
// waiting.
//
// The panel below is that screen. It lists who has stored a specimen and
// whether it is in force, and lets the office that approves the University's
// documents switch one on — never their own, and never without saying on what
// authority.
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

interface Specimen {
  owner_id: string;
  owner_name?: string | null;
  owner_role?: string | null;
  enabled?: boolean;
  enabled_at?: string | null;
  authority?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  isMine?: boolean;
}

/** 049's floor on the stated grounds, repeated here so the button can wait. */
const MIN_AUTHORITY = 20;
const MIN_REASON = 12;

/**
 * The second pair of eyes.
 *
 * DECLARED AT MODULE SCOPE, like everything else in this codebase that renders.
 * A component declared inside another is a new function on every render, React
 * remounts it, and the box you are typing into loses focus after one character.
 * That cost the University a morning on the appointments screen.
 *
 * IT HIDES ITSELF WHERE IT DOES NOT APPLY. The screen does not know the
 * caller's capabilities, so it asks; `list` refuses anybody who may not decide
 * about a signature, and a refusal renders nothing rather than an error. An
 * officer storing their own signature should not be told about a panel they
 * cannot use.
 */
function SpecimensAwaiting() {
  const [rows, setRows] = useState<Specimen[] | null>(null);
  /** Whether `list` answered at all. Undecided until it has. */
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [authority, setAuthority] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  // MAY-NOT-SEE AND NOTHING-TO-SEE ARE DIFFERENT ANSWERS.
  //
  // They were the same one, and the Superadministrator asked "why is the
  // signature of the University not in superadmin?" — it was, and it was
  // invisible, because no officer had stored a specimen and an empty list
  // rendered as nothing at all. A panel that disappears when it has nothing to
  // report disappears exactly when somebody goes looking for it, and the reader
  // concludes the feature was never built.
  //
  // `null` here means not permitted, and renders nothing. An empty ARRAY means
  // permitted and empty, and says so.
  const load = useCallback(async () => {
    const out = await authedPost('/api/admin/signature', { action: 'list' });
    // NOT PERMITTED IS NOT AN ERROR. It is the ordinary case for most of the
    // people who open this screen.
    if (!out.ok) { setRows(null); setAllowed(false); return; }
    setAllowed(true);
    setRows((out.specimens ?? []) as Specimen[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(ownerId: string, action: 'enable' | 'revoke') {
    setBusy(ownerId);
    setNote(null);
    const out = await authedPost('/api/admin/signature', {
      action,
      ownerId,
      ...(action === 'enable'
        ? { authority: authority[ownerId] ?? '' }
        : { reason: reason[ownerId] ?? '' }),
    });
    setBusy(null);
    setNote({
      tone: out.ok ? 'ok' : 'bad',
      text: (out.detail as string | undefined) ?? String(out.error ?? 'That did not work.'),
    });
    if (out.ok) {
      setAuthority((a) => ({ ...a, [ownerId]: '' }));
      setReason((r) => ({ ...r, [ownerId]: '' }));
      void load();
    }
  }

  // NOTHING AT ALL only for an officer who may not decide about a signature,
  // and only once we know that. Before the answer arrives, nothing is drawn —
  // a panel that flashes into view and vanishes is worse than one that waits.
  if (allowed !== true || rows === null) return null;

  return (
    <div className="space-y-4 border-t border-[#ece7de] pt-6 dark:border-[#2e2637]">
      <div>
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">
          <ShieldCheck size={18} /> Signatures of the University
        </h3>
        <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          A stored signature appears on nothing until it is switched on here. Until somebody does,
          every letter that officer issues prints an empty rule.
        </p>
      </div>

      {note && (
        <div role="status" className={`rounded-xl p-3 text-sm ${
          note.tone === 'ok'
            ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
            : 'border border-red-600/30 bg-red-600/10 text-red-900 dark:text-red-200'
        }`}
        >
          {note.text}
        </div>
      )}

      {rows.length === 0 && (
        <div className="rounded-xl border border-[#ece7de] p-4 text-sm dark:border-[#2e2637]">
          <p className="flex items-center gap-2 font-medium text-[#a07c12]">
            <AlertTriangle size={15} /> No officer has stored a signature yet
          </p>
          <p className="mt-1 text-[#6b6076] dark:text-[#9c93ad]">
            There is nothing here to switch on, and every letter the University issues will print
            an empty rule for signing by hand. An officer stores their own under
            <strong> Settings → My signature</strong>; it then appears here for a second officer
            to put in force.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((s) => (
          <li key={s.owner_id}
            className="rounded-xl border border-[#ece7de] p-4 dark:border-[#2e2637]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                {s.owner_name || 'An officer'}
                {s.owner_role ? <span className="font-normal text-[#6b6076] dark:text-[#9c93ad]">{` — ${s.owner_role}`}</span> : null}
              </p>
              {s.enabled ? (
                <span className="flex items-center gap-1 text-sm text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 size={14} /> In force
                  {s.enabled_at ? ` since ${String(s.enabled_at).slice(0, 10)}` : ''}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-[#a07c12]">
                  <AlertTriangle size={14} /> Not in force
                </span>
              )}
            </div>

            {s.enabled && s.authority && (
              <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                On the authority of: {s.authority}
              </p>
            )}
            {!s.enabled && s.revoked_at && (
              <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                Withdrawn on {String(s.revoked_at).slice(0, 10)}
                {s.revoked_reason ? `: ${s.revoked_reason}` : ''}
              </p>
            )}

            {/* NOT YOUR OWN. Said here rather than discovered by pressing a
                button — 049 refuses it in the database and the route refuses it
                again, and a control that looks live and then explains itself is
                a control that wasted somebody's time. */}
            {s.isMine ? (
              <p className="mt-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                This is yours. You cannot switch on your own — it is a standing permission to
                reproduce your signature on documents you may never see.
              </p>
            ) : s.enabled ? (
              <div className="mt-3 space-y-2">
                <label htmlFor={`rev-${s.owner_id}`} className={LABEL}>
                  Withdraw it, and say why
                </label>
                <input id={`rev-${s.owner_id}`} className={INPUT}
                  value={reason[s.owner_id] ?? ''}
                  onChange={(e) => setReason((r) => ({ ...r, [s.owner_id]: e.target.value }))}
                  placeholder="e.g. Left the University on 30 September" />
                <button type="button" className={BTN_GHOST}
                  disabled={busy === s.owner_id || (reason[s.owner_id] ?? '').trim().length < MIN_REASON}
                  onClick={() => void act(s.owner_id, 'revoke')}>
                  {busy === s.owner_id ? <Loader2 size={14} className="animate-spin" /> : null}
                  Withdraw
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <label htmlFor={`auth-${s.owner_id}`} className={LABEL}>
                  On what authority — a minute, a decision, an instruction
                </label>
                <input id={`auth-${s.owner_id}`} className={INPUT}
                  value={authority[s.owner_id] ?? ''}
                  onChange={(e) => setAuthority((a) => ({ ...a, [s.owner_id]: e.target.value }))}
                  placeholder="e.g. Minute 12 of Council, 3 September 2026" />
                <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                  A standing permission nobody explained is one nobody can withdraw with
                  confidence later.
                </p>
                <button type="button" className={BTN_PRIMARY}
                  disabled={busy === s.owner_id
                    || (authority[s.owner_id] ?? '').trim().length < MIN_AUTHORITY}
                  onClick={() => void act(s.owner_id, 'enable')}>
                  {busy === s.owner_id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <ShieldCheck size={14} />}
                  Switch it on
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
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

      // ---------------------------------------------------------------
      // THE PAPER IS NOT PART OF THE SIGNATURE.
      //
      // The University uploaded a signature and it came out on the letter
      // as a small mark inside a WHITE BOX, sitting beside the rule instead
      // of on it — because the image was stored exactly as it arrived. A
      // signature is photographed or scanned on paper, so what arrives is a
      // rectangle of white with a little ink somewhere in the middle, and
      // the white is opaque: it covers the rule it is supposed to cross.
      //
      // So the paper is made transparent, ON A RAMP rather than a cliff. A
      // hard threshold would leave every stroke with a hard jagged edge
      // where the anti-aliased pixels were cut off; the ramp keeps the soft
      // edge of a pen line.
      // ---------------------------------------------------------------
      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;
      // Above PAPER it is paper; below INK it is certainly a stroke. Between
      // them the pixel keeps a share of its opacity.
      const PAPER = 238;
      const INK = 170;
      let minX = w; let minY = h; let maxX = -1; let maxY = -1;

      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const i = ((y * w) + x) * 4;
          // Perceived lightness. A blue ballpoint is darker than its red
          // channel alone suggests, and a plain average loses it.
          const lum = (0.299 * px[i]) + (0.587 * px[i + 1]) + (0.114 * px[i + 2]);
          let alpha = px[i + 3];
          if (lum >= PAPER) alpha = 0;
          else if (lum > INK) alpha = Math.round(alpha * ((PAPER - lum) / (PAPER - INK)));
          px[i + 3] = alpha;
          if (alpha > 24) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX < 0) {
        reject(new Error('There is no signature in that image — every pixel is as light as '
          + 'paper. Photograph the signature in good light, or scan it, and try again.'));
        return;
      }

      ctx.putImageData(data, 0, 0);

      // ---------------------------------------------------------------
      // AND THEN CROPPED TO THE INK.
      //
      // "The signature is too small." It was: the mark occupied a fraction
      // of a mostly-empty rectangle, and the stylesheet scales the
      // RECTANGLE to fit the rule — so the more paper somebody
      // photographed, the smaller their signature printed. Cropping to the
      // ink makes the printed size depend on the signature rather than on
      // how the photograph was framed.
      //
      // A THIN MARGIN IS KEPT so the strokes are not clipped flush.
      // ---------------------------------------------------------------
      const pad = Math.max(2, Math.round((maxX - minX) * 0.02));
      const cx = Math.max(0, minX - pad);
      const cy = Math.max(0, minY - pad);
      const cw = Math.min(w - cx, (maxX - minX) + 1 + (pad * 2));
      const ch = Math.min(h - cy, (maxY - minY) + 1 + (pad * 2));

      const trimmed = document.createElement('canvas');
      trimmed.width = cw;
      trimmed.height = ch;
      const tctx = trimmed.getContext('2d');
      if (!tctx) {
        reject(new Error('This browser would not open a canvas, so the image could not be '
          + 'prepared.'));
        return;
      }
      tctx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);

      const dataUri = trimmed.toDataURL('image/png');
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
  // WHETHER THIS OFFICER HAS A SIGNATURE OF THEIR OWN TO MANAGE.
  //
  // The Registrar and the Academic Office reach this screen to decide about
  // OTHER people's specimens; they may not issue a letter, so they may not
  // store one either, and `mine` refuses them. That refusal is the ordinary
  // case for them, not a fault — showing it as a red banner would tell an
  // officer something is broken at the moment they arrive to do their job.
  const [mayStore, setMayStore] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const out = await authedPost('/api/admin/signature', { action: 'mine' });
    setLoading(false);
    if (!out.ok) {
      if (String(out.error ?? '').startsWith('not-permitted')) {
        setMayStore(false);
        return;
      }
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
      {/* THE OWN-SIGNATURE HALF, for an officer who issues letters. Hidden
          entirely from the Registrar and the Academic Office, who come here to
          decide about somebody else's and have none of their own to keep. */}
      {mayStore && (
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
      )}

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

      {mayStore && (
      <>
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

      </>
      )}

      {/* THE HALF THAT WAS MISSING. Storing a signature was never enough: until
          somebody switches it on, every letter prints an empty rule. This
          renders nothing for an officer who may not make that decision. */}
      <SpecimensAwaiting />
    </div>
  );
}
