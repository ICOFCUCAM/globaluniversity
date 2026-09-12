// ---------------------------------------------------------------------------
// THE INSTITUTION SPEAKING — announcements, and where they are published.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The Announcements page was a noticeboard. It had no table: a notice was a row
// on `documents` with `document_type = 'announcement'` and its text packed into
// a data-URL in the file column, which the module's own header admitted was a
// placeholder "until a dedicated table is provisioned". Anyone whose role
// happened to be `admin` or `lecturer` could post one, there was no approval,
// no record of who wrote what, and nothing that had been said could be found
// again once it was edited.
//
// That is a defensible noticeboard and an indefensible institutional voice. An
// announcement is the University speaking — about a deadline, a closure, a
// graduation, a death. It needs what an admission decision needs, and for the
// same reasons:
//
//   CLEAR AUTHORITY     somebody composed it, somebody else cleared it
//   CONTROLLED ACTION   publishing is an act, not a save
//   IMMUTABLE HISTORY   what was said, and when, survives being edited
//   VERIFIABLE RESULT   where it actually reached, per destination
//
// ---------------------------------------------------------------------------
// AND IT IS NOT A SECOND PUBLISHER
// ---------------------------------------------------------------------------
//
// This repository already has a complete social publishing pipeline — 013 and
// 014 — with connected accounts, per-platform variants, an approval that
// refuses to let an author approve their own post, per-target delivery states
// and retry. Building announcement-to-Facebook separately would be a second
// implementation of the same thing, drifting, with two sets of credentials and
// two ideas of what "published" means.
//
// So an EXTERNAL destination is fulfilled BY that pipeline. Releasing an
// announcement creates a social post carrying the announcement's own approval,
// and the existing machinery delivers it. The announcement is the canonical
// source; the networks are destinations; there is one publisher.
//
// THE APPROVAL IS NOT TAKEN TWICE. An announcement cleared by somebody other
// than its author is cleared; the post it creates carries that approver rather
// than asking for another. What the outward step still requires is the
// capability to publish socially — so the new door does not become a way round
// the authority that already governs the University's outward voice.
// ---------------------------------------------------------------------------

import type { Platform } from './social';

// ---------------------------------------------------------------------------
// 1. THE STATES
// ---------------------------------------------------------------------------

/**
 * Every state an announcement can hold.
 *
 * `retracted` IS NOT `deleted`, and the distinction is the whole reason the
 * word is here. A notice that was published and is now wrong has to come down,
 * and the University has to be able to say that it said it and then took it
 * back. Deleting the row answers the first need and destroys the second — and
 * the copy on Facebook does not disappear because a database row did.
 */
export const ANNOUNCEMENT_STATES = [
  /** Being written. Visible to its author and nobody else. */
  'draft',
  /** Sent for clearance. The author can no longer edit it. */
  'submitted',
  /** Cleared by somebody other than the author. Not yet visible. */
  'approved',
  /** Cleared, and waiting for its own publication time. */
  'scheduled',
  /** Live. */
  'published',
  /** Refused, with a reason. */
  'rejected',
  /** Was live; taken down. The text and the history remain. */
  'retracted',
] as const;

export type AnnouncementState = (typeof ANNOUNCEMENT_STATES)[number];

/** What a reader is told each state means. */
export const STATE_LABELS: Record<AnnouncementState, string> = {
  draft: 'Draft',
  submitted: 'Awaiting clearance',
  approved: 'Cleared to publish',
  scheduled: 'Scheduled',
  published: 'Published',
  rejected: 'Not cleared',
  retracted: 'Retracted',
};

/** States in which the text may still be changed. */
export const EDITABLE: AnnouncementState[] = ['draft', 'rejected'];

/**
 * States a reader outside the office can see.
 *
 * `retracted` is NOT here. A retracted notice stays in the record and comes off
 * the noticeboard; leaving it visible would be publishing something the
 * University has withdrawn.
 */
export const PUBLICLY_VISIBLE: AnnouncementState[] = ['published'];

// ---------------------------------------------------------------------------
// 1b. WHAT IT IS ABOUT, AND WHO IT IS FOR
// ---------------------------------------------------------------------------

/**
 * The categories the University announces under.
 *
 * A CLOSED LIST, because the point of a category is to be the same word twice.
 * A free-text field produces "Admissions", "admission", "ADMISSIONS" and
 * "Admissions Office" within a month, and then nothing can be filtered.
 */
export const CATEGORIES = [
  'general', 'admissions', 'academic', 'finance', 'examination',
  'graduation', 'events', 'emergency', 'faculty',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  general: 'General',
  admissions: 'Admissions',
  academic: 'Academic',
  finance: 'Finance',
  examination: 'Examination',
  graduation: 'Graduation',
  events: 'Events',
  emergency: 'Emergency',
  faculty: 'Faculty',
};

export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);
}

/**
 * Who an announcement is addressed to. More than one, and at least one.
 *
 * AUDIENCE IS NOT DESTINATION, and keeping them apart is the difference
 * between "students need to know this" and "put it on Instagram". A notice
 * addressed to Staff can still be published to the portal only; a notice
 * addressed to the Public and sent nowhere public is a notice nobody will see.
 * The screen shows both because they answer different questions.
 */
export const AUDIENCES = ['students', 'applicants', 'staff', 'alumni', 'public'] as const;

export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  students: 'Students',
  applicants: 'Applicants',
  staff: 'Staff',
  alumni: 'Alumni',
  public: 'Public',
};

export function isAudience(v: unknown): v is Audience {
  return typeof v === 'string' && (AUDIENCES as readonly string[]).includes(v);
}

/**
 * PUBLIC IS A DECISION, NOT A TICK BOX LIKE THE OTHERS.
 *
 * The first four are people the University already has a relationship with and
 * who reach the notice by signing in. `public` means anybody at all, including
 * people who have never applied and journalists — and once something is said
 * publicly it cannot be unsaid by clearing a checkbox. The screen says so.
 */
export function reachesTheWorld(audiences: string[]): boolean {
  return audiences.includes('public');
}

// ---------------------------------------------------------------------------
// 2. THE EVENTS — the history that survives an edit
// ---------------------------------------------------------------------------

export const ANNOUNCEMENT_EVENTS = [
  'DRAFTED',
  'EDITED',
  'SUBMITTED_FOR_CLEARANCE',
  'APPROVED',
  'REJECTED',
  'SCHEDULED',
  'PUBLISHED',
  'RETRACTED',
  /** A destination was added or removed before release. */
  'DESTINATIONS_CHANGED',
  /** Sent outward: one social post created per external destination. */
  'RELEASED_EXTERNALLY',
  /** One destination reported back. */
  'DESTINATION_DELIVERED',
  'DESTINATION_FAILED',
  /** The Superadministrator acting in another office's place. Always visible. */
  'ADMINISTRATIVE_OVERRIDE',
] as const;

export type AnnouncementEvent = (typeof ANNOUNCEMENT_EVENTS)[number];

// ---------------------------------------------------------------------------
// 3. THE DESTINATIONS
// ---------------------------------------------------------------------------
//
// THE PORTAL IS NOT OPTIONAL AND IS NOT A CHOICE. It is where the announcement
// IS; the rest are copies of it sent elsewhere. Modelling it as one destination
// among eight would allow an announcement published to Facebook and nowhere in
// the University's own system, which is exactly the arrangement this replaces —
// the institution's canonical record living on somebody else's server.

export interface Destination {
  /** What the operator sees. */
  label: string;
  /**
   * 'internal' — this system publishes it directly.
   * 'external' — the social pipeline publishes it, on a connected account.
   */
  kind: 'internal' | 'external';
  /** The social platform this maps to, for external destinations. */
  platform?: Platform;
  /** Said on the screen, before the click. */
  note: string;
}

export const DESTINATIONS = {
  portal: {
    label: 'IGUC Portal',
    kind: 'internal',
    note: 'Always. This is where the announcement is; every other destination is '
      + 'a copy of it sent elsewhere.',
  },
  website: {
    label: 'Website news',
    kind: 'internal',
    note: 'The public news section. Visible to anyone, including people who have never '
      + 'applied — write it for them as well.',
  },
  facebook: {
    label: 'Facebook Page',
    kind: 'external',
    platform: 'facebook',
    note: 'Published on the University’s connected Page.',
  },
  instagram: {
    label: 'Instagram',
    kind: 'external',
    platform: 'instagram',
    note: 'Requires an image. Instagram does not accept a text-only post.',
  },
  x: {
    label: 'X',
    kind: 'external',
    platform: 'x',
    note: 'Short. The text is cut to the platform’s limit and you are shown where.',
  },
  linkedin: {
    label: 'LinkedIn Page',
    kind: 'external',
    platform: 'linkedin',
    note: 'Published as the organisation, not as the person signed in.',
  },
  youtube: {
    label: 'YouTube',
    kind: 'external',
    platform: 'youtube',
    note: 'Video only. A written announcement cannot be published here.',
  },
} as const satisfies Record<string, Destination>;

export type DestinationKey = keyof typeof DESTINATIONS;

export const DESTINATION_KEYS = Object.keys(DESTINATIONS) as DestinationKey[];

/** The one destination that is not a choice. */
export const CANONICAL_DESTINATION: DestinationKey = 'portal';

export function isDestination(key: string): key is DestinationKey {
  return Object.prototype.hasOwnProperty.call(DESTINATIONS, key);
}

export function externalDestinations(): DestinationKey[] {
  return DESTINATION_KEYS.filter((k) => DESTINATIONS[k].kind === 'external');
}

/**
 * Where an announcement actually goes, given what was chosen.
 *
 * The portal is added whether it was chosen or not. A caller that forgets it,
 * or a screen that offers it as a tick box somebody can clear, cannot produce
 * an announcement that exists only on a social network.
 */
export function resolveDestinations(chosen: string[]): DestinationKey[] {
  const set = new Set<DestinationKey>([CANONICAL_DESTINATION]);
  for (const c of chosen) if (isDestination(c)) set.add(c);
  return DESTINATION_KEYS.filter((k) => set.has(k));
}

// ---------------------------------------------------------------------------
// 4. PER-DESTINATION DELIVERY
// ---------------------------------------------------------------------------
//
// The same shape the social pipeline already uses for its targets, because it
// is the same question: this went to six places and what happened at each.
// "Published" as a single flag on the announcement would be true when one
// network accepted it and five refused.

export const DELIVERY_STATES = [
  'pending', 'sending', 'delivered', 'failed', 'skipped', 'retracted',
] as const;

export type DeliveryState = (typeof DELIVERY_STATES)[number];

/**
 * What to tell the operator about a set of destinations, in one sentence.
 *
 * NEVER "published" WHEN SOMETHING FAILED. The whole point of recording each
 * destination separately is lost if the summary rounds it up.
 */
export function describeDelivery(states: DeliveryState[]): string {
  if (states.length === 0) return 'Nowhere yet.';
  const n = (s: DeliveryState) => states.filter((x) => x === s).length;
  const delivered = n('delivered');
  const failed = n('failed');
  const waiting = n('pending') + n('sending');

  if (failed > 0 && delivered > 0) {
    return `Published to ${delivered}, failed at ${failed}. The failures can be tried again.`;
  }
  if (failed > 0) return `Failed at all ${failed}. Nothing was published.`;
  if (waiting > 0 && delivered > 0) return `Published to ${delivered}, ${waiting} still going.`;
  if (waiting > 0) return `Going out to ${waiting}.`;
  if (delivered > 0) return `Published to all ${delivered}.`;
  return 'Nothing was sent.';
}

// ---------------------------------------------------------------------------
// 5. WHO MAY DO WHAT
// ---------------------------------------------------------------------------
//
// THE AUTHOR MAY NOT CLEAR THEIR OWN ANNOUNCEMENT. The same separation 005
// requires of a certificate design, 009 of a grade and 014 of a social post,
// and it is not ceremony: one person writing, clearing and sending alone is how
// an unconsidered sentence ends up on six networks under the University's name,
// with nobody who read it first.

export const MIN_REJECTION_REASON = 12;
export const MIN_RETRACTION_REASON = 12;

/** The least an announcement can say and still be worth clearing. */
export const MIN_TITLE = 6;
export const MIN_BODY = 20;

export interface AnnouncementLike {
  id?: string;
  status?: string | null;
  author_id?: string | null;
  approved_by?: string | null;
  title?: string | null;
  body?: string | null;
  category?: string | null;
  audiences?: string[] | null;
}

/**
 * A picture or a video on an announcement.
 *
 * ALT TEXT IS NOT OPTIONAL and the database agrees — 039 makes the column NOT
 * NULL, exactly as 013 did for social media. A prospective student using a
 * screen reader is exactly the reader the institution is addressing, and a
 * graduation photograph that reaches them as "image" has excluded them from the
 * announcement. Every platform this is published to carries the omission
 * onward.
 */
export interface AnnouncementMedia {
  storage_path: string;
  alt_text: string;
  kind?: 'image' | 'video';
  ordinal?: number;
}

export function canEdit(a: AnnouncementLike): boolean {
  return EDITABLE.includes(a.status as AnnouncementState);
}

export function canSubmit(a: AnnouncementLike): boolean {
  return (a.status === 'draft' || a.status === 'rejected')
    && (a.title ?? '').trim().length >= MIN_TITLE
    && (a.body ?? '').trim().length >= MIN_BODY;
}

/**
 * Whether this person may take the clearance decision on this announcement.
 *
 * Refuses the author by name, not by role. A Superadministrator who wrote the
 * notice is still its author, and holding every capability does not make
 * somebody a second pair of eyes.
 */
export function canDecide(a: AnnouncementLike, callerId: string): boolean {
  return a.status === 'submitted' && a.author_id !== callerId;
}

export function canPublish(a: AnnouncementLike): boolean {
  return a.status === 'approved' || a.status === 'scheduled';
}

/** Only something that is live can be taken down. */
export function canRetract(a: AnnouncementLike): boolean {
  return a.status === 'published' || a.status === 'scheduled';
}

/**
 * Whether this announcement may be sent to the networks.
 *
 * PUBLISHED FIRST, ALWAYS. The University's own portal carries it before
 * anybody else does — otherwise a student reads about their own institution on
 * Instagram and finds nothing when they sign in.
 */
export function canReleaseExternally(a: AnnouncementLike): boolean {
  return a.status === 'published';
}

// ---------------------------------------------------------------------------
// 6. WHAT WOULD GO WRONG, SAID BEFORE THE CLICK
// ---------------------------------------------------------------------------
//
// Returned as a list rather than one at a time: somebody fixing an announcement
// should be told everything that is wrong with it, not sent back for the second
// problem after fixing the first.

export interface Objection {
  code: string;
  /** Whether this stops the action or merely warns. */
  blocking: boolean;
  message: string;
}

export function objectionsTo(
  a: AnnouncementLike,
  chosen: string[],
  opts: {
    media?: AnnouncementMedia[];
    connected?: Partial<Record<Platform, boolean>>;
  } = {},
): Objection[] {
  const out: Objection[] = [];
  const title = (a.title ?? '').trim();
  const body = (a.body ?? '').trim();

  if (title.length < MIN_TITLE) {
    out.push({
      code: 'title-too-short',
      blocking: true,
      message: 'Give it a title somebody scanning a list can recognise.',
    });
  }
  if (body.length < MIN_BODY) {
    out.push({
      code: 'body-too-short',
      blocking: true,
      message: 'An announcement of a few words tends to raise more questions than it '
        + 'answers. Say what changed, for whom, and from when.',
    });
  }

  if (!isCategory(a.category)) {
    out.push({
      code: 'no-category',
      blocking: true,
      message: 'Choose a category. It is what lets somebody find this again in a year, and '
        + 'what decides whether an emergency notice is treated as one.',
    });
  }
  const audiences = a.audiences ?? [];
  if (audiences.length === 0) {
    out.push({
      code: 'no-audience',
      blocking: true,
      message: 'Say who this is for. An announcement addressed to nobody reaches nobody.',
    });
  }
  if (audiences.some((x) => !isAudience(x))) {
    out.push({
      code: 'unknown-audience',
      blocking: true,
      message: 'One of the audiences is not one the University uses.',
    });
  }

  // AN IMAGE WITHOUT ALT TEXT IS AN IMAGE A BLIND READER CANNOT SEE, and every
  // platform carries the omission onward. Said here so it is caught on the
  // screen; 039 makes the column NOT NULL so it cannot be got round.
  const media = opts.media ?? [];
  if (media.some((m) => !(m.alt_text ?? '').trim())) {
    out.push({
      code: 'image-without-alt-text',
      blocking: true,
      message: 'Describe every image in a sentence. Without it, a reader using a screen reader '
        + 'gets nothing at all, and every network this is published to repeats the omission.',
    });
  }

  // NOT BLOCKING, BECAUSE IT IS A DECISION AND NOT A MISTAKE. Said out loud
  // because it is the one choice on this screen that cannot be taken back by
  // unticking it later.
  if (reachesTheWorld(audiences)) {
    out.push({
      code: 'addressed-to-the-public',
      blocking: false,
      message: 'This is addressed to the public — anybody at all, including people who have '
        + 'never applied. Read it once more as a stranger would.',
    });
  }

  for (const key of resolveDestinations(chosen)) {
    const d: Destination = DESTINATIONS[key];
    if (d.kind !== 'external' || !d.platform) continue;

    if (opts.connected && opts.connected[d.platform] === false) {
      out.push({
        code: `not-connected:${key}`,
        blocking: true,
        message: `${d.label} is not connected. Connect the University’s account in Settings `
          + 'before choosing it as a destination.',
      });
    }
    // INSTAGRAM AND YOUTUBE REFUSE TEXT. Said here rather than discovered when
    // the platform returns an error hours later and somebody has to work out
    // which of six destinations the message was about.
    if (d.platform === 'instagram' && media.length === 0) {
      out.push({
        code: 'instagram-needs-an-image',
        blocking: true,
        message: 'Instagram does not accept a post without an image. Add one, or take '
          + 'Instagram off the list.',
      });
    }
    if (d.platform === 'youtube') {
      out.push({
        code: 'youtube-needs-video',
        blocking: true,
        message: 'YouTube publishes video. A written announcement cannot go there.',
      });
    }
  }

  return out;
}

export function blocks(objections: Objection[]): boolean {
  return objections.some((o) => o.blocking);
}

// ---------------------------------------------------------------------------
// 7. THE SAME ANNOUNCEMENT IN EACH PLATFORM'S OWN VOICE
// ---------------------------------------------------------------------------
//
// THE MASTER IS THE ANNOUNCEMENT; THESE ARE ADAPTATIONS OF IT. The same words
// do not work everywhere. X takes a fraction of what LinkedIn does, Instagram
// expects a caption under an image, and LinkedIn is read by people assessing
// the institution professionally. One block of text published to all of them
// was written for one and tolerated by the rest.
//
// THE LIMITS AND THE REGISTERS ARE NOT RESTATED HERE. `PLATFORM_PROFILES` in
// social.ts already holds them, with a comment explaining that they are
// third-party facts that change and must live in one place. A second copy here
// would be wrong within a year of X moving its limit again.

import { PLATFORM_PROFILES, type Variant } from './social';

export interface VariantDraft extends Variant {
  /** True where nothing has been written and the master will be published. */
  fallsBackToMaster: boolean;
}

/**
 * What each platform would actually receive, given the master and whatever
 * adaptations exist.
 *
 * A PLATFORM WITH NO VARIANT GETS THE MASTER, deliberately. Requiring one per
 * destination would mean an urgent notice could not go out until somebody had
 * rewritten it five times, and urgency is exactly when that rewriting does not
 * happen. The master is always publishable; a variant is an improvement on it.
 */
export function previewFor(
  master: { title?: string | null; body?: string | null },
  variants: Variant[],
  chosen: string[],
): { platform: Platform; label: string; text: string; over: number; draft: VariantDraft }[] {
  const masterText = `${(master.title ?? '').trim()}\n\n${(master.body ?? '').trim()}`.trim();

  return resolveDestinations(chosen)
    .map((key) => ({ key, d: DESTINATIONS[key] as Destination }))
    .filter((x) => x.d.kind === 'external' && x.d.platform)
    .map(({ key, d }) => {
      const platform = d.platform!;
      const found = variants.find((v) => v.platform === platform);
      const tags = found?.hashtags ?? [];
      const base = found?.body?.trim() ? found.body : masterText;
      const text = tags.length
        ? `${base}\n\n${tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')}`
        : base;

      return {
        platform,
        label: d.label,
        text,
        // OVER THE LIMIT IS SHOWN AS A NUMBER, not as a disabled button. A
        // greyed-out Publish leaves somebody staring at six destinations with
        // no idea which one objected.
        over: Math.max(0, text.length - PLATFORM_PROFILES[platform].limit),
        draft: {
          platform,
          body: found?.body ?? masterText,
          hashtags: tags,
          source: found?.source ?? 'human',
          editedBy: found?.editedBy ?? null,
          fallsBackToMaster: !found?.body?.trim(),
        },
        key,
      };
    });
}

/**
 * A starting point for each platform, derived from the master.
 *
 * DERIVED, NOT INVENTED. This trims the master to what the platform accepts and
 * marks it as a starting point; it does not write new sentences. Generating
 * copy is the assistant's job and `ASSISTANT_BRIEF` in social.ts is the brief
 * it works to — but a function that silently produced different words under the
 * University's name, with no record that a machine wrote them, is the thing
 * `source` exists to prevent. Everything this returns is marked `assistant` so
 * that a person accepting it unchanged is visible in the record.
 */
export function startingVariants(
  master: { title?: string | null; body?: string | null },
  chosen: string[],
): Variant[] {
  const title = (master.title ?? '').trim();
  const body = (master.body ?? '').trim();

  return previewFor(master, [], chosen).map(({ platform }) => {
    const limit = PLATFORM_PROFILES[platform].limit;
    const full = `${title}\n\n${body}`.trim();
    // CUT AT A SENTENCE, NEVER MID-WORD. A university publishing half a
    // sentence is worse than one publishing a short one.
    let text = full;
    if (text.length > limit) {
      const cut = text.slice(0, limit - 1);
      const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
      text = (end > limit / 3 ? cut.slice(0, end + 1) : cut).trim();
    }
    return { platform, body: text, hashtags: [], source: 'assistant' as const, editedBy: null };
  });
}
