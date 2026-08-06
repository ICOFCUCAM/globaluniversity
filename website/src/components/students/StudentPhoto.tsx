'use client';

// ---------------------------------------------------------------------------
// The student's photograph.
//
// WHY THIS EXISTS. `photo_url` was read in three places and written in none.
// There was no way, anywhere in the portal, to put a photograph on a student
// record — so the identity card fell back to the holder's initials, and the
// register fell back to `IMAGES.students[0]`, a stock photograph of somebody
// who is not a student here. Every student on the register showed the same
// stranger's face, beside their real name and student number.
//
// That is worse than an empty frame. A blank tells a registrar something is
// missing; a plausible face tells them nothing is.
//
// HOW IT STORES IT. Downsized in the browser to a 300×400 passport crop and
// written to `photo_url` as a data URI — roughly 20–30 KB. No storage bucket,
// no signed URLs, no second system to configure, and the photograph travels
// with the row, so a card printed from an exported record still has a face on
// it.
//
// The cost is size: about 25 KB a student, in a column the register used to
// pull with `select *`. Five hundred students would be twelve megabytes fetched
// to draw five hundred thirty-two-pixel avatars, so the register now names its
// columns and leaves this one out — it shows initials — and the photograph is
// fetched for the single student whose record is opened.
//
// The original file is never uploaded. A registrar photographing a student with
// a phone produces a 4 MB image carrying GPS coordinates in its EXIF; drawing
// it through a canvas at 300×400 discards the metadata along with the pixels.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { write, wrote } from '@/lib/write';
import { BTN_GHOST, FOCUS } from '@/lib/portalTheme';

/** Passport proportions: 3:4, the shape every travel document uses. */
const W = 300;
const H = 400;

/**
 * Draw the file into a 300×400 frame, cropping to fill rather than squashing.
 *
 * Squashing a landscape photograph into a portrait frame makes the face wider
 * than the person's, which defeats the one purpose of a photograph on a card.
 */
function toPassportDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas unavailable'));

      const scale = Math.max(W / img.width, H / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      // Centred horizontally; biased to the top vertically, because a portrait
      // has the head in the upper half and a centred crop takes the chin off.
      ctx.drawImage(img, (W - dw) / 2, (H - dh) * 0.25, dw, dh);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('that file could not be read as an image'));
    };
    img.src = url;
  });
}

export default function StudentPhoto({
  studentId,
  photoUrl,
  name,
  onChange,
}: {
  studentId: string;
  photoUrl?: string | null;
  name: string;
  onChange: (next: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function save(next: string | null) {
    setBusy(true);
    const ok = await write(
      supabase.from('students').update({ photo_url: next }).eq('id', studentId),
      next ? 'save the photograph' : 'remove the photograph',
    );
    // Only reflect it on screen if the database took it. Updating the panel on
    // a refused write is how a registrar comes back tomorrow to a card with no
    // face on it and no idea why.
    if (ok) {
      wrote(next ? 'Photograph saved' : 'Photograph removed');
      onChange(next);
    }
    setBusy(false);
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    // 8 MB in, before downsizing. Above that the browser is being asked to
    // decode a raw camera file, and it will simply stall.
    if (file.size > 8 * 1024 * 1024) {
      alert('That image is over 8 MB. Please use a smaller photograph.');
      return;
    }
    setBusy(true);
    try {
      await save(await toPassportDataUri(file));
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={`Photograph of ${name}`}
          className="h-24 w-[72px] rounded-lg object-cover ring-2 ring-[#e8dcc0]"
        />
      ) : (
        <div className="flex h-24 w-[72px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#d8cfc0] bg-[#faf7f1] text-[#a49bb0] dark:border-[#3a3147] dark:bg-[#241d30]">
          <Camera size={18} aria-hidden="true" />
          <span className="px-1 text-center text-[8px] font-semibold uppercase leading-tight tracking-wide">
            No photo
          </span>
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className={`${BTN_GHOST} px-2 py-1 text-[11px] disabled:opacity-40`}
        >
          {busy ? 'Saving…' : photoUrl ? 'Replace' : 'Add photograph'}
        </button>
        {photoUrl && (
          <button
            type="button"
            disabled={busy}
            aria-label="Remove photograph"
            onClick={() => void save(null)}
            className={`rounded-lg p-1 text-[#a49bb0] hover:bg-[#f2eee6] disabled:opacity-40 dark:hover:bg-[#2a2333] ${FOCUS}`}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
