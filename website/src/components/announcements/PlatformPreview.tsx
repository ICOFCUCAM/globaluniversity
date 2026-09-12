'use client';

// ---------------------------------------------------------------------------
// WHAT EACH NETWORK WILL ACTUALLY RECEIVE, SHOWN BEFORE IT IS SENT.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT DECORATION
// ---------------------------------------------------------------------------
//
// Publishing to five networks at once is publishing five things. They differ by
// length, by whether an image is required, and by whether hashtags belong — and
// until somebody sees the five, "publish to 5 destinations" is a button pressed
// on trust. The mistakes it catches are not subtle: a sentence cut in half at
// X's limit, an Instagram post with no picture, a LinkedIn post written in the
// register of a student notice.
//
// THE TEXT IS THE REAL TEXT. `previewFor` returns exactly what the publisher
// will send — the variant where one exists, the master where it does not, with
// the hashtags appended the way they will be appended. A preview built from a
// different code path than the publisher is a preview of something else, and
// that is the worst possible kind: it is trusted.
//
// THE CARDS ARE DELIBERATELY PLAIN. They are not imitations of Facebook's
// chrome. A convincing mock of another company's interface invites somebody to
// judge whether it looks right rather than whether it reads right, and the
// second is the only question this screen can actually answer.
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Sparkles, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { BTN_SECONDARY, INPUT } from '@/lib/portalTheme';
import { previewFor, type AnnouncementMedia } from '@/lib/announcements';
import { PLATFORM_PROFILES, type Variant } from '@/lib/social';

export default function PlatformPreview({
  master,
  media,
  destinations,
  variants,
  onVariants,
}: {
  master: { title: string; body: string };
  media: AnnouncementMedia[];
  destinations: string[];
  variants: Variant[];
  onVariants: (v: Variant[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const cards = previewFor(master, variants, destinations);
  if (cards.length === 0) {
    return (
      <p className="rounded-xl bg-[#f7f4f0] px-4 py-3 text-sm text-[#6b6076] dark:bg-[#241f2c]
                    dark:text-[#9c93ad]">
        No external destination is chosen, so there is nothing to preview. The portal shows the
        announcement as it is written above.
      </p>
    );
  }

  /**
   * Ask the writing assistant for a version per platform.
   *
   * IT CALLS THE ROUTE THE SOCIAL COMPOSER ALREADY USES. That route holds the
   * brief, the model, the per-platform limits and — the part that matters — the
   * honest fallback: with no assistant configured it fits the text to length
   * without rewriting it and SAYS SO. A second generator here would be a second
   * brief, drifting from the first, and two ideas of how the University sounds.
   */
  async function generate() {
    setBusy(true);
    setNote(null);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch('/api/social/draft', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sess.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        body: `${master.title}\n\n${master.body}`.trim(),
        platforms: cards.map((c) => c.platform),
      }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);

    if (!json?.ok) {
      setNote(json?.error === 'not-permitted:compose-social-post'
        ? 'Drafting versions uses the social composer, and your role does not hold it. Write '
          + 'each version by hand below, or ask somebody who does.'
        : json?.detail ?? json?.error ?? 'No versions were drafted.');
      return;
    }
    onVariants(json.variants as Variant[]);
    // SAID EVERY TIME, not only on failure. A version nobody read is the thing
    // `source` exists to make visible, and an administrator who believes the
    // assistant wrote something considered when it merely cut the text at a
    // full stop is about to publish that belief.
    setNote(json.note ?? 'Drafted. Read every one before publishing — they go out under the '
      + 'University’s name, not the assistant’s.');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
          What each network will receive. {cards.length} destination
          {cards.length === 1 ? '' : 's'}.
        </p>
        <button type="button" disabled={busy} onClick={() => void generate()}
          className={BTN_SECONDARY}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Drafting…</>
            : <><Sparkles size={14} /> Generate platform versions</>}
        </button>
      </div>

      {note && (
        <p className="flex items-start gap-2 rounded-lg bg-[#faf6ee] px-3 py-2 text-xs
                      text-[#6b5a2f] dark:bg-[#241f2c] dark:text-[#c3b48f]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {note}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => {
          const profile = PLATFORM_PROFILES[c.platform];
          const needsImage = profile.requiresMedia === 'image' && media.length === 0;
          return (
            <article key={c.platform}
              className="overflow-hidden rounded-xl border border-[#e8e2f0] bg-white
                         dark:border-[#332b3d] dark:bg-[#1c1823]">
              <header className="flex items-center justify-between border-b border-[#f0ece4]
                                 px-4 py-2 dark:border-[#2a2333]">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#422e59]
                                 dark:text-[#c9b6e6]">{c.label}</span>
                <span className={`text-xs ${c.over > 0 ? 'font-semibold text-red-700'
                  : 'text-[#6b6076] dark:text-[#9c93ad]'}`}>
                  {c.text.length} / {profile.limit}
                </span>
              </header>

              <div className="space-y-3 p-4">
                {media.length > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-[#f7f4f0] px-3 py-2
                                  text-xs text-[#6b6076] dark:bg-[#241f2c] dark:text-[#9c93ad]">
                    <ImageIcon size={13} />
                    {/* THE ALT TEXT, not the picture. It is the part that is
                        usually wrong and never looked at, and the only way to
                        check it is to read it. */}
                    <span className="truncate">{media[0].alt_text}</span>
                  </div>
                )}

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#4a4155]
                              dark:text-[#c8c1d4]">{c.text}</p>

                {c.draft.fallsBackToMaster && (
                  <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    No version written for {c.label}, so it receives the announcement as it
                    stands. That is allowed — an urgent notice should not wait for five
                    rewrites.
                  </p>
                )}
                {c.draft.source === 'assistant' && !c.draft.fallsBackToMaster && (
                  // NAMED, because a sentence nobody chose going out under the
                  // University's name is precisely what this is here to prevent.
                  <p className="text-xs text-amber-800 dark:text-[#c3b48f]">
                    Drafted, not written. Edit it and it becomes yours.
                  </p>
                )}
                {c.over > 0 && (
                  <p className="text-xs font-semibold text-red-700">
                    {c.over} characters too long. {c.label} will cut it, and a university
                    publishing half a sentence is worse than one publishing a short one.
                  </p>
                )}
                {needsImage && (
                  <p className="text-xs font-semibold text-red-700">
                    {c.label} will not accept a post without an image.
                  </p>
                )}

                {editing === c.platform ? (
                  <textarea
                    autoFocus
                    rows={5}
                    className={`${INPUT} text-sm`}
                    defaultValue={c.draft.body}
                    onBlur={(e) => {
                      const rest = variants.filter((v) => v.platform !== c.platform);
                      onVariants([...rest, {
                        platform: c.platform,
                        body: e.target.value,
                        hashtags: c.draft.hashtags,
                        // EDITING MAKES IT THEIRS. The record stops saying a
                        // machine wrote this the moment a person changes it.
                        source: 'human',
                        editedBy: null,
                      }]);
                      setEditing(null);
                    }}
                  />
                ) : (
                  <button type="button" onClick={() => setEditing(c.platform)}
                    className="text-xs font-medium text-[#422e59] hover:underline
                               dark:text-[#c9b6e6]">
                    Write a version for {c.label}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
