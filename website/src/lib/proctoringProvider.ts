// ---------------------------------------------------------------------------
// LIVE VIDEO, AUDIO AND SCREEN SHARING — what the University must supply.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SEAM AND NOT AN IMPLEMENTATION
// ---------------------------------------------------------------------------
//
// A proctored examination needs three live media streams per candidate —
// camera, microphone, screen — carried to an examiner who may be on another
// continent, recorded, and stored. That is a WebRTC infrastructure problem:
// TURN servers for candidates behind restrictive networks, a selective
// forwarding unit so one examiner can watch forty sittings without forty
// peer connections, and recording egress to object storage.
//
// It cannot be written into this repository. It is a service the University
// subscribes to — LiveKit, Daily, Twilio Video, Amazon Chime, or a self-hosted
// equivalent — and every one of them needs an account, an API key and a
// decision about where recordings are stored and under whose jurisdiction.
//
// SO THIS FILE DESCRIBES THE CONTRACT AND REPORTS HONESTLY WHEN IT IS UNMET.
// The examination system does everything else: eligibility, identity, device
// checks, the central clock, autosave, events, incidents, findings, marking,
// moderation and the audit trail. What it will not do is draw a camera panel
// with nothing behind it.
//
// A dead video tile on a proctoring console is worse than an honest message.
// The examiner assumes they are watching, the candidate assumes they are being
// watched, and the University assumes it has a recording — and none of it is
// true until somebody looks at a support ticket weeks later.
// ---------------------------------------------------------------------------

export interface ProviderRequirement {
  id: string;
  name: string;
  env: string[];
  note: string;
}

/**
 * The providers this system is designed to sit on.
 *
 * NOT A RECOMMENDATION BETWEEN THEM. The choice turns on things this code
 * cannot know: what the University can pay, whether recordings may leave the
 * country, and whether anyone on staff can run infrastructure. LiveKit is
 * listed first only because it can be self-hosted, which is the option that
 * keeps a candidate's home video inside the institution.
 */
export const PROVIDERS: ProviderRequirement[] = [
  {
    id: 'livekit',
    name: 'LiveKit',
    env: ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'],
    note:
      'Open source and self-hostable, which is the only option that keeps recordings of students’ '
      + 'homes on infrastructure the University controls. Needs somebody who can run it.',
  },
  {
    id: 'daily',
    name: 'Daily',
    env: ['DAILY_API_KEY', 'DAILY_DOMAIN'],
    note: 'Hosted. Fastest to stand up; recordings live on their infrastructure.',
  },
  {
    id: 'twilio',
    name: 'Twilio Video',
    env: ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY', 'TWILIO_API_SECRET'],
    note: 'Hosted, with wide network reach — useful where candidates are on poor connections.',
  },
];

/** Which provider, if any, this deployment is configured for. */
export function configuredProvider(env: NodeJS.ProcessEnv = process.env): ProviderRequirement | null {
  return PROVIDERS.find((p) => p.env.every((key) => Boolean(env[key]?.trim()))) ?? null;
}

export interface ProctoringStatus {
  live: boolean;
  provider: string | null;
  /** What is missing, said so an administrator can act on it. */
  detail: string;
  requirements: ProviderRequirement[];
}

/**
 * The adapter for whichever provider is configured.
 *
 * LiveKit is implemented; Daily and Twilio are listed above as options the
 * University may prefer, and each would be another module exporting the same
 * interface. Returning null rather than throwing keeps "no provider" an
 * ordinary path rather than an exception handler.
 */
export async function proctoringAdapter(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProctoringAdapter | null> {
  const provider = configuredProvider(env);
  if (provider?.id === 'livekit') {
    const { liveKitAdapter } = await import('@/lib/proctoringLiveKit');
    return liveKitAdapter(env);
  }
  return null;
}

export function proctoringStatus(env: NodeJS.ProcessEnv = process.env): ProctoringStatus {
  const provider = configuredProvider(env);
  if (provider) {
    // ONLY LIVEKIT HAS AN ADAPTER. A deployment configured for Daily would
    // otherwise report itself live and then fail to produce a join token — the
    // camera panels would say "Connecting…" for ever.
    const implemented = provider.id === 'livekit';
    return {
      live: implemented,
      provider: provider.name,
      detail: implemented
        ? `Live supervision runs on ${provider.name}.`
        : `${provider.name} is configured, but only LiveKit has an adapter in this system. `
          + 'Either set LiveKit\'s variables instead, or add an adapter for '
          + `${provider.name} against the ProctoringAdapter interface below.`,
      requirements: PROVIDERS,
    };
  }
  return {
    live: false,
    provider: null,
    detail:
      'No live media provider is configured, so camera, microphone and screen sharing cannot be '
      + 'carried to an examiner. Everything else works: eligibility, identity, device checks, the '
      + 'central clock, autosave, events, incidents, findings, marking and the audit trail. '
      + 'Examinations can be sat and marked; they cannot be watched live. '
      + 'See docs/EXAMINATIONS.md.',
    requirements: PROVIDERS,
  };
}

/**
 * WHAT THE PROVIDER ADAPTER WILL HAVE TO DO.
 *
 * Written now, unimplemented, because the shape is what the rest of the system
 * is built against — and because writing it down is how the University's IT
 * staff can evaluate a provider against what is actually needed rather than
 * against a feature list.
 */
export interface ProctoringAdapter {
  /**
   * A room for one sitting, and a token for one participant in it.
   *
   * THE TOKEN IS RETURNED TO THE SERVER, NEVER STORED IN A TABLE. It is
   * short-lived, it grants the holder a live view of somebody's home, and
   * `exam_sessions.session_token_ref` is a pointer into the secret store for
   * exactly that reason.
   */
  joinToken(input: {
    sessionId: string;
    participantId: string;
    role: 'candidate' | 'proctor' | 'observer';
  }): Promise<{ url: string; token: string; expiresAt: string }>;

  /**
   * Begin recording, returning where it will land.
   *
   * The path goes into exam_recordings with a retention date. The recording
   * itself never touches this database.
   */
  startRecording(input: {
    sessionId: string;
    kinds: Array<'camera' | 'screen' | 'audio'>;
  }): Promise<Array<{ kind: string; externalRef: string; storagePath: string }>>;

  stopRecording(input: { sessionId: string }): Promise<void>;

  /**
   * Destroy a recording that has passed its retention date.
   *
   * REQUIRED, NOT OPTIONAL. A university that records its students' homes has
   * taken on an obligation to stop holding them, and a provider that cannot be
   * told to delete is a provider that makes that obligation impossible to meet.
   */
  destroyRecording(input: { externalRef: string }): Promise<void>;
}
