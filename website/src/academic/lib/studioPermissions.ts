// ---------------------------------------------------------------------------
// MAY THIS PERSON ASK A MODEL TO DO THIS?
//
// The University's ruling of 16 September 2026:
//
//     "Submission does not automatically mean AI processing… Each capability
//      should be its own permission, rather than having one broad permission
//      called 'AI Access.'"
//
// ---------------------------------------------------------------------------
// THIS IS THE BRIDGE, AND IT ONLY GOES ONE WAY
// ---------------------------------------------------------------------------
//
// There are two authorization systems in this repository and they answer
// different questions:
//
//   src/academic/lib/domain/ownership.ts   WHOSE thing is this?
//   src/lib/roles.ts                       WHAT KIND of act is yours?
//
// `ownership.ts` decides that a lecturer may change their own material and not
// a colleague's. It has nothing to say about whether the University is willing
// to spend money on a fifteen-minute audio lesson in nine languages, because
// that is not a question about ownership at all.
//
// So both are asked, and BOTH MUST AGREE. This file answers the second. It
// never widens the first: a person holding every `studio-ai-*` capability
// still cannot touch a colleague's lecture, because `mayAct` refuses them and
// this file is not consulted about that.
//
// ---------------------------------------------------------------------------
// AND IT READS GRANTS, NOT ONLY ROLES
// ---------------------------------------------------------------------------
//
// The University's sketch draws three columns — Lecturers, AUTHORIZED
// lecturers, Academic administration — and the middle one is the interesting
// one. A lecturer does not hold `studio-ai-refine` by being a lecturer; they
// hold it because somebody with authority granted it to them, by name, with a
// reason and an end date.
//
// `capability_grants` (056) is where that lives, and it already does
// everything the ruling asked for: who granted, who received, what, when, when
// it expires, who revoked, and why. Nothing new was built to govern this.
// ---------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';
import { can, type Capability } from '@/lib/roles';
import type { UserRole } from '@/lib/types';

export interface StudioDecision {
  allowed: boolean;
  /** Always set when refused, and written for the person, not the log. */
  reason?: string;
  /** True when the act is possible here but this account has not been given it. */
  needsPermission?: boolean;
}

/**
 * WHAT THE SCREENS SHOW AS LOCKED.
 *
 * The University: "The locked functions are visible but unavailable… This is
 * better than hiding everything because the lecturer understands what the
 * Studio is capable of, while the university retains control over who can
 * execute potentially expensive or sensitive operations."
 *
 * So this list is not only an enforcement table — it is what a screen walks to
 * draw the padlocks, which is why each one carries the words to show.
 */
export const STUDIO_ACTS = [
  { capability: 'studio-submit-lecture', label: 'Write lecture' },
  { capability: 'studio-upload-lecture', label: 'Upload notes, audio or video' },
  { capability: 'studio-record-lecture', label: 'Record audio' },
  { capability: 'studio-ai-transcribe', label: 'Transcribe' },
  { capability: 'studio-ai-refine', label: 'Refine academic text' },
  { capability: 'studio-ai-translate', label: 'Translate' },
  { capability: 'studio-ai-generate-audio', label: 'Generate 15-minute audio' },
  { capability: 'studio-ai-generate-revision', label: 'Generate revision materials' },
  { capability: 'studio-ai-generate-quiz', label: 'Generate quiz' },
  { capability: 'studio-approve-content', label: 'Approve' },
  { capability: 'publish-course-material', label: 'Publish to students' },
  { capability: 'studio-replace-content', label: 'Replace a recording' },
  { capability: 'studio-manage-ebooks', label: 'Manage the course library' },
] as const satisfies ReadonlyArray<{ capability: string; label: string }>;

/**
 * WHICH CAPABILITY A PIPELINE STAGE NEEDS.
 *
 * Keyed on the artefact kinds 092 defines, so adding a stage without deciding
 * who may run it is a type error rather than an open door.
 */
export const CAPABILITY_FOR_STAGE: Record<string, Capability> = {
  transcript: 'studio-ai-transcribe' as Capability,
  corrected_text: 'studio-ai-refine' as Capability,
  knowledge_extract: 'studio-ai-refine' as Capability,
  structured_notes: 'studio-ai-refine' as Capability,
  teaching_script: 'studio-ai-generate-audio' as Capability,
  audio_15min: 'studio-ai-generate-audio' as Capability,
  revision_materials: 'studio-ai-generate-revision' as Capability,
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // NO KEY IS NOT "NO GRANTS". Reporting an empty set here would silently
  // refuse every authorised lecturer and look exactly like a permission that
  // was never given, so it says what happened instead.
  if (!url || !key) {
    throw new Error(
      'The Academic Studio cannot read capability grants: SUPABASE_SERVICE_ROLE_KEY is not set. '
      + 'Refusing rather than reporting that this account has been granted nothing, which is '
      + 'indistinguishable from a permission nobody gave.',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * THE UNIVERSITY'S ANSWER TO "WHAT IS THIS PERSON", read here rather than
 * passed in.
 *
 * `currentActor()` returns the STUDIO's role — one of its six, about what
 * somebody may do inside a lecture. The capability matrix is keyed on the
 * University's twenty-three. Threading the second through every call site
 * would put a copy of the answer in thirteen routes, and a copy is a thing
 * that goes stale.
 */
async function universityRoleOf(personId: string): Promise<UserRole | null> {
  const { data, error } = await serviceClient()
    .from('profiles').select('role').eq('id', personId).maybeSingle();
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data?.role as UserRole | undefined) ?? null;
}

/** The grants in force for one person, right now. */
async function grantedTo(personId: string): Promise<Set<string>> {
  const { data, error } = await serviceClient()
    .from('capability_grants')
    .select('capability, expires_at, revoked_at')
    .eq('grantee_id', personId)
    .is('revoked_at', null);
  if (error) throw new Error(`capability_grants: ${error.message}`);

  const now = Date.now();
  return new Set(
    (data ?? [])
      .filter((row) => new Date(String(row.expires_at)).getTime() > now)
      .map((row) => String(row.capability)),
  );
}

/**
 * The one door for "is this act available to this account".
 *
 * It reads `profiles.role` itself — the University's answer, not the Studio's
 * six. The Studio's roles say what somebody is inside a lecture; this question
 * is about the institution's permission to act, and they are not the same
 * question.
 */
export async function mayRunStudioAct(
  personId: string,
  capability: Capability,
): Promise<StudioDecision> {
  const universityRole = await universityRoleOf(personId);
  if (universityRole && can(universityRole, capability)) return { allowed: true };

  const granted = await grantedTo(personId);
  if (granted.has(capability)) return { allowed: true };

  const act = STUDIO_ACTS.find((a) => a.capability === capability);
  return {
    allowed: false,
    needsPermission: true,
    reason: act
      ? `${act.label} — permission required. Your account has not been granted this. The `
        + 'Vice-Chancellor or the Superadministrator can authorise it for you, with a reason and '
        + 'an end date recorded.'
      : 'Your account does not hold that.',
  };
}

/**
 * The whole padlock row for a screen, in one call.
 *
 * Returns every act the Studio can perform with whether THIS account may run
 * it — so the screen draws all thirteen and locks the ones that are not
 * available, rather than hiding them. Hiding a capability teaches a lecturer
 * the Studio cannot do something it can.
 */
export async function studioActsFor(
  personId: string,
): Promise<Array<{ capability: string; label: string; allowed: boolean }>> {
  const [universityRole, granted] = await Promise.all([
    universityRoleOf(personId), grantedTo(personId),
  ]);
  return STUDIO_ACTS.map((act) => ({
    capability: act.capability,
    label: act.label,
    allowed: Boolean(universityRole && can(universityRole, act.capability as Capability))
      || granted.has(act.capability),
  }));
}
