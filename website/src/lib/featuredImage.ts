// ---------------------------------------------------------------------------
// A PICTURE CHOSEN FROM THE MACHINE IN FRONT OF YOU.
//
// ---------------------------------------------------------------------------
// WHY THE ANNOUNCEMENT FORM ASKED FOR A "STORAGE PATH"
// ---------------------------------------------------------------------------
//
// It was not a limitation of the platform. The composer had a text box labelled
// "Storage path of an uploaded image" — and nothing anywhere in this
// application uploads to a storage bucket. There is no bucket. The field was
// asking for the address of a file in a place that does not exist, so the only
// way to put a picture on an announcement was to host it somewhere else and
// paste a link.
//
// THE ANSWER WAS ALREADY IN THE CODEBASE. `StudentPhoto` faced the same
// question and settled it: downsize in the browser, store the result as a data
// URI on the row. No bucket, no signed URLs, no second system to configure, and
// the picture travels with the record — an announcement exported or replicated
// still has its image.
//
// ---------------------------------------------------------------------------
// WHAT THE BROWSER DOES BEFORE ANYTHING IS STORED
// ---------------------------------------------------------------------------
//
// DOWNSIZES IT. A photograph off a phone is three to six megabytes. Drawn
// through a canvas at 1200px wide it is sixty to a hundred and twenty
// kilobytes, which a row can carry and a page can load.
//
// AND DISCARDS THE METADATA WITH IT. That phone photograph carries EXIF: the
// camera, the timestamp, and very often the GPS coordinates of where it was
// taken. Publishing it to a noticeboard publishes all of that. A canvas
// redraw keeps the pixels and nothing else, which is the real reason this is
// not simply `readAsDataURL`.
// ---------------------------------------------------------------------------

/** Wide enough for a noticeboard card and a social preview, and no wider. */
export const MAX_WIDTH = 1200;

/**
 * The ceiling on what is stored, in bytes of encoded data URI.
 *
 * MEASURED RATHER THAN CHOSEN: a 1200px JPEG at quality 0.82 lands between 60
 * and 160 KB for ordinary photographs. 400 KB is generous room above that and
 * still small enough that a list of twenty announcements is not a download.
 * A picture that will not come under it is refused with the number, so the
 * author knows what to do rather than being told "too large".
 */
export const MAX_BYTES = 400_000;

export const ACCEPTED = 'image/jpeg,image/png,image/webp';

export interface PreparedImage {
  dataUri: string;
  bytes: number;
  width: number;
  height: number;
}

/**
 * Read a chosen file, downsize it, and return it as a data URI.
 *
 * NEVER RESOLVES WITH SOMETHING UNUSABLE. Every failure — a file that is not an
 * image, a canvas the browser would not give, a result over the ceiling —
 * rejects with a sentence the composer can show, because "upload failed" sends
 * somebody to look at their network.
 */
export function prepareFeaturedImage(file: File): Promise<PreparedImage> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('That file is not an image. Choose a JPEG, PNG or WebP.'));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      // NEVER ENLARGED. Scaling a small picture up to 1200px makes a bigger
      // file out of the same detail, which is the worst of both.
      const scale = Math.min(1, MAX_WIDTH / img.width);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('This browser would not open a canvas, so the image could not be '
          + 'prepared. Try a different browser.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // JPEG FOR PHOTOGRAPHS, PNG FOR ANYTHING WITH TRANSPARENCY. A logo
      // re-encoded as JPEG gains a grey box where its background was.
      const transparent = file.type === 'image/png' || file.type === 'image/webp';
      const dataUri = canvas.toDataURL(transparent ? 'image/png' : 'image/jpeg', 0.82);
      const bytes = Math.round((dataUri.length - dataUri.indexOf(',') - 1) * 0.75);

      if (bytes > MAX_BYTES) {
        reject(new Error(
          `That image comes to ${Math.round(bytes / 1024)} KB once resized, and the limit is `
          + `${Math.round(MAX_BYTES / 1024)} KB. A photograph will usually fit; a screenshot `
          + 'or a picture with large flat areas saved as PNG often will not. Save it as a JPEG '
          + 'and try again.',
        ));
        return;
      }

      resolve({ dataUri, bytes, width, height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image. It may be damaged, or saved '
        + 'in a format this browser does not open.'));
    };

    img.src = url;
  });
}

/**
 * Whether a stored value is a picture the page can draw.
 *
 * BOTH FORMS ARE VALID and this is the point of the function: a data URI
 * prepared here, and an http(s) link to a picture hosted elsewhere. The
 * announcement field has held links since before anything could be chosen from
 * a machine, and they must keep working.
 */
export function isDrawable(value: string | null | undefined): boolean {
  const v = (value ?? '').trim();
  return v.startsWith('data:image/') || /^https?:\/\//i.test(v);
}

/** What to call it when somebody asks what is stored. */
export function describeImage(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v) return 'No image';
  if (v.startsWith('data:image/')) {
    const bytes = Math.round((v.length - v.indexOf(',') - 1) * 0.75);
    return `Stored with the announcement · ${Math.round(bytes / 1024)} KB`;
  }
  if (/^https?:\/\//i.test(v)) {
    // SAID OUT LOUD. A linked image is not the University's copy: if whoever
    // hosts it takes it down, the announcement loses its picture and nobody
    // is told.
    return 'Linked from another site — the University does not hold a copy';
  }
  return 'Not a picture this page can draw';
}
