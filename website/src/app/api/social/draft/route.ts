// ---------------------------------------------------------------------------
// DRAFTING ONE ANNOUNCEMENT FOR EACH NETWORK.
//
// POST { body, platforms } -> { variants: [{ platform, body, hashtags, source }] }
//
//   "AI should be built into it... The administrator remains in control and
//    approves before publishing."
//
// ---------------------------------------------------------------------------
// WHAT THE ASSISTANT IS AND IS NOT ALLOWED TO DO
// ---------------------------------------------------------------------------
//
// It rewrites the administrator's own words for each platform. It does not
// research the University, does not add context it thinks is missing, and does
// not know anything about this institution that is not in the draft in front of
// it. ASSISTANT_BRIEF in src/lib/social.ts is the instruction, and its first
// rule is "Invent nothing."
//
// That rule is not stylistic. This project's standing constraint is that the
// system may not state accreditation, rankings, student numbers, partnerships,
// campuses or awards the University has not itself stated — and a generated
// sentence becomes a statement BY the University the moment it is published
// under its name. A model asked to make a graduation announcement more
// impressive will reach for exactly those figures, because that is what the
// text it learned from does.
//
// So: the output is marked `source: 'assistant'` all the way into the database,
// the composer shows every draft for reading before anything is sent, and this
// route cannot publish.
//
// ---------------------------------------------------------------------------
// WHEN THERE IS NO MODEL CONFIGURED
// ---------------------------------------------------------------------------
//
// The route does the part that does not need one — fitting the text to each
// platform's limit without cutting a sentence in half — and SAYS that is what
// it did. It does not silently return the same text for every platform and let
// the administrator believe it was tailored, and it does not fail and leave
// them with nothing.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import {
  PLATFORMS, PLATFORM_PROFILES, ASSISTANT_BRIEF, asAssistantDraft,
  type Platform, type Variant,
} from '@/lib/social';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const g = await guard(request, 'compose-social-post');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  let input: { body?: string; platforms?: Platform[] };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const body = (input.body ?? '').trim();
  if (!body) return NextResponse.json({ ok: false, error: 'nothing-to-draft' }, { status: 400 });

  const platforms = (input.platforms ?? []).filter((p) => PLATFORMS.includes(p));
  if (platforms.length === 0) {
    return NextResponse.json({ ok: false, error: 'no-platforms' }, { status: 400 });
  }

  const key = process.env.ANTHROPIC_API_KEY?.trim();

  if (!key) {
    return NextResponse.json({
      ok: true,
      variants: platforms.map((p) => fitToPlatform(body, p)),
      assisted: false,
      note:
        'No writing assistant is configured, so the text has been fitted to each network\'s '
        + 'length without being rewritten. Set ANTHROPIC_API_KEY to have each version drafted '
        + 'properly. Read every one before publishing either way.',
    });
  }

  try {
    const variants = await draftWithModel(key, body, platforms);
    return NextResponse.json({ ok: true, variants, assisted: true });
  } catch (e) {
    // FALL BACK RATHER THAN FAIL. An administrator with an announcement to make
    // should not be blocked because a third-party API is slow — but they must
    // be told that what they are looking at is not what they asked for.
    return NextResponse.json({
      ok: true,
      variants: platforms.map((p) => fitToPlatform(body, p)),
      assisted: false,
      note:
        'The writing assistant did not answer, so the text has only been fitted to each '
        + `network's length. (${e instanceof Error ? e.message : 'unknown error'})`,
    });
  }
}

/**
 * Shorten to fit WITHOUT cutting a sentence in half.
 *
 * The naive version — `text.slice(0, limit)` — is worse than doing nothing. It
 * ends the University's announcement mid-word, usually in the middle of a
 * graduate's name, and it looks like a system fault to every reader.
 *
 * So it drops whole sentences from the end until what remains fits, and only
 * falls back to a word boundary if even the first sentence is too long.
 */
function fitToPlatform(body: string, platform: Platform): Variant {
  const limit = PLATFORM_PROFILES[platform].limit;
  if (body.length <= limit) return asAssistantDraft(platform, body, []);

  const sentences = body.match(/[^.!?]+[.!?]+\s*/g) ?? [body];
  let kept = '';
  for (const s of sentences) {
    if ((kept + s).trim().length > limit - 1) break;
    kept += s;
  }
  kept = kept.trim();

  if (!kept) {
    // Even the first sentence is over. Cut at the last whole word, and mark it
    // — an administrator seeing the ellipsis knows to rewrite rather than send.
    const cut = body.slice(0, limit - 1);
    kept = `${cut.slice(0, cut.lastIndexOf(' '))}…`;
  }

  return asAssistantDraft(platform, kept, []);
}

/**
 * Ask the model for one version per platform, in a single call.
 *
 * ONE CALL, NOT SIX. Six calls is six chances for one to fail and leave the
 * administrator with a half-drafted set, and it costs six times as much for a
 * task the model can do in one pass with better consistency of tone across the
 * versions.
 */
async function draftWithModel(key: string, body: string, platforms: Platform[]): Promise<Variant[]> {
  const spec = platforms.map((p) => {
    const profile = PLATFORM_PROFILES[p];
    return `- ${p}: at most ${profile.limit} characters. ${profile.register} About ${profile.hashtagGuide} hashtags.`;
  }).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: ASSISTANT_BRIEF,
      messages: [{
        role: 'user',
        content:
          `The administrator's draft:\n\n${body}\n\nWrite one version for each of these:\n${spec}\n\n`
          + 'Reply with JSON only, in the form '
          + '{"variants":[{"platform":"x","body":"...","hashtags":["one","two"]}]} '
          + 'and nothing else.',
      }],
    }),
  });

  if (!res.ok) {
    throw new Error(`the assistant replied ${res.status}`);
  }

  const payload = await res.json() as { content?: Array<{ text?: string }> };
  const text = payload.content?.map((c) => c.text ?? '').join('') ?? '';

  // The model was asked for JSON only; take the object even if it wrapped it in
  // prose or a code fence, because failing over a stray backtick would drop a
  // usable draft.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('the assistant did not return JSON');

  const parsed = JSON.parse(text.slice(start, end + 1)) as {
    variants?: Array<{ platform?: string; body?: string; hashtags?: string[] }>;
  };

  const out: Variant[] = [];
  for (const p of platforms) {
    const hit = parsed.variants?.find((v) => v.platform === p);
    // A platform the model skipped falls back to the fitted text rather than
    // being left out — an absent variant publishes the full body, which is the
    // truncation this whole function exists to prevent.
    if (!hit?.body) { out.push(fitToPlatform(body, p)); continue; }

    // TRUST NOTHING ABOUT THE LENGTH. Models overshoot character limits
    // routinely, and an overshoot here would be caught by problemsWith() and
    // block the publication with a message about a limit the administrator did
    // not choose to exceed.
    const fitted = hit.body.length > PLATFORM_PROFILES[p].limit
      ? fitToPlatform(hit.body, p).body
      : hit.body;

    out.push(asAssistantDraft(p, fitted, (hit.hashtags ?? []).slice(0, PLATFORM_PROFILES[p].hashtagGuide * 2)));
  }

  return out;
}
