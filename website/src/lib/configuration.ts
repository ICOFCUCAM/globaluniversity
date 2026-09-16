// ---------------------------------------------------------------------------
// WHAT THIS DEPLOYMENT IS CONFIGURED TO DO, AND WHAT IT SILENTLY CANNOT.
//
// ---------------------------------------------------------------------------
// WHY A LIST IN A DOCUMENT IS NOT ENOUGH
// ---------------------------------------------------------------------------
//
// Almost every variable here is optional by design: outbound mail, signing,
// live proctoring and the social networks all degrade rather than refuse, so
// the University can run without them. That is the right behaviour — a registry
// that will not issue a certificate because a mail server is unconfigured is
// worse than one that issues it and tells you to hand it over in person.
//
// It also means an unset variable is INVISIBLE. The screens look normal, the
// buttons are there, and the feature is simply off. `.env.example` documents
// every one, but a document tells you what could be set, not what IS set on the
// deployment actually serving the University.
//
// So this is the list, once, in code — and /api/health/config reads it against
// the real environment. What is missing, and what each absence costs, in the
// same sentence.
//
// ---------------------------------------------------------------------------
// IT NEVER REPORTS A VALUE
// ---------------------------------------------------------------------------
//
// Only whether something is set, and for the two keys where length is the whole
// point, whether it is long enough. A configuration report that echoed a secret
// would be a way to read the University's secrets from a browser.
// ---------------------------------------------------------------------------

export type Importance = 'required' | 'recommended' | 'optional';

export interface Setting {
  /** The variable name, exactly as it must be typed into the host. */
  name: string;
  importance: Importance;
  /** What it is for, in a sentence. */
  purpose: string;
  /** What happens when it is not set. Never "it breaks" — always what breaks. */
  ifAbsent: string;
  /**
   * Whether this must be readable by the browser.
   *
   * TRUE ONLY FOR NEXT_PUBLIC_ VARIABLES, and it matters: a value marked false
   * that is given a NEXT_PUBLIC_ name is published to every visitor. The
   * service role key under a public name would hand anyone full read and write
   * over the whole database.
   */
  public: boolean;
  /** A minimum length, where a short value is as bad as none. */
  minLength?: number;
  /**
   * Set on a variable that is a HAZARD WHEN PRESENT rather than when absent.
   *
   * Every other row on this report asks "is it set?" and treats absence as the
   * problem. NEXT_PUBLIC_ENABLE_DEMO inverts that: on a developer's machine it
   * is a convenience, and on the production deployment it puts one-click
   * administrator sign-in on the public login page. A report that only ever
   * warns about things being missing cannot say so.
   */
  dangerIfSet?: string;
  /** Which group it belongs to on the report. */
  area: 'database' | 'credentials' | 'mail' | 'proctoring' | 'social' | 'site' | 'ai' | 'studio';
}

export const SETTINGS: Setting[] = [
  // --- Without these the University has no database -----------------------
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    importance: 'required',
    purpose: 'Which Supabase project holds the University’s records.',
    ifAbsent: 'Nothing works. No sign-in, no register, no records — the portal cannot reach a '
      + 'database at all.',
    public: true,
    area: 'database',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    importance: 'required',
    purpose: 'The publishable key the browser signs in with. Row-level security governs what it '
      + 'may then see.',
    ifAbsent: 'Nobody can sign in — not a student, not the Registrar, not the '
      + 'Superadministrator. The public site still renders; the portal is unreachable.',
    public: true,
    area: 'database',
  },
  {
    // Supabase's newer name for the same key. Accepted as an alternative to
    // NEXT_PUBLIC_SUPABASE_ANON_KEY, so a project created after the rename
    // works without anybody having to know there was one. Either will do;
    // neither being set is what breaks.
    name: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    importance: 'optional',
    purpose: 'An alternative spelling of the publishable key, under Supabase’s newer name.',
    ifAbsent: 'Nothing, as long as NEXT_PUBLIC_SUPABASE_ANON_KEY is set. One of the two must be.',
    public: true,
    area: 'database',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    importance: 'required',
    purpose: 'The server-side key. Every route that issues, seals, verifies or audits uses it, '
      + 'because the register is deliberately unreadable from the browser.',
    ifAbsent: 'No credential can be issued, verified, printed or emailed, and /verify cannot '
      + 'answer anyone. The rest of the portal appears to work.',
    // NEVER PUBLIC. This key bypasses every row-level-security policy in the
    // database. Under a NEXT_PUBLIC_ name it is handed to every visitor.
    public: false,
    area: 'database',
  },

  // --- Producing a PDF ------------------------------------------------------
  {
    name: 'CHROMIUM_PATH',
    importance: 'optional',
    purpose: 'The path to a Chromium binary, for rendering a letter to PDF. Set it only where '
      + 'the machine already has a browser — a developer’s machine, a container that bundles '
      + 'one. On Vercel it is left unset and the serverless Chromium pack is used instead.',
    ifAbsent: 'Nothing is lost on a normal deployment: the serverless pack is the default path '
      + 'and is what production uses. Where NEITHER is available the letter is still issued, '
      + 'still archived and still opens — as HTML, which prints to the identical A4 document '
      + 'through the browser’s own dialogue — and the email carries the HTML copy instead of '
      + 'the PDF. Losing the PDF never means losing the letter.',
    public: false,
    area: 'credentials',
  },

  // --- The credential system ----------------------------------------------
  {
    name: 'CREDENTIAL_SECRET',
    importance: 'required',
    purpose: 'The key every certificate and transcript is sealed with.',
    ifAbsent: 'NO CERTIFICATE OR TRANSCRIPT CAN BE ISSUED. Those routes refuse rather than seal '
      + 'with a fallback, because a credential system that works with a published key is worse '
      + 'than one switched off — it produces documents people trust. '
      + 'ADMISSION LETTERS ARE THE EXCEPTION and it is deliberate: an admission letter is not a '
      + 'credential and is not on the register, so it still issues, unsealed, rather than holding '
      + 'up an intake. Nothing on its face says it is unsealed, so the audit trail records '
      + '`sealed: false` against every letter issued that way — see the decision route.',
    public: false,
    minLength: 32,
    area: 'credentials',
  },
  {
    name: 'CREDENTIAL_SIGNING_KEY',
    importance: 'recommended',
    purpose: 'An Ed25519 private key. Adds a detached signature that anyone can verify offline, '
      + 'without the University’s cooperation, against the public key at /api/credential/key.',
    ifAbsent: 'Credentials are still issued, sealed and verifiable through /verify — that is the '
      + 'University’s primary record. They simply cannot be checked by a receiving institution '
      + 'without trusting this website.',
    public: false,
    minLength: 40,
    area: 'credentials',
  },
  {
    name: 'SECRET_STORE_KEY',
    importance: 'recommended',
    purpose: 'A 32-byte key that encrypts the social network tokens held in the database.',
    ifAbsent: 'No social account can be connected, because a token cannot be stored safely. '
      + 'Everything else is unaffected.',
    public: false,
    minLength: 32,
    area: 'social',
  },

  // --- The site’s own address ---------------------------------------------
  {
    name: 'NEXT_PUBLIC_SITE_URL',
    importance: 'recommended',
    purpose: 'The University’s own address, used in QR codes, verification links and the '
      + 'absolute image URLs on an emailed transcript.',
    ifAbsent: 'Falls back to https://iguc.net. A deployment served from any other address issues '
      + 'credentials whose QR codes point somewhere else. NOTE that most of the system reads '
      + 'SITE_URL, below — this one is read only by the credential routes.',
    public: true,
    area: 'site',
  },
  {
    // ---------------------------------------------------------------------
    // THE ONE THE ADMISSION LETTER ACTUALLY READS, and it was not on this
    // report at all. Somebody setting up a deployment from this panel would
    // have set NEXT_PUBLIC_SITE_URL, seen everything green, and sent admission
    // letters whose sign-in link came from a hard-coded fallback.
    // ---------------------------------------------------------------------
    name: 'SITE_URL',
    importance: 'recommended',
    purpose: 'The address the portal is served from. The admission letter’s sign-in link, the '
      + 'identity card and the staff welcome email are all built from it.',
    ifAbsent: 'Falls back to https://iguc.net. An admission letter would then tell every new '
      + 'student to sign in at an address the portal may not answer on.',
    public: false,
    area: 'site',
  },
  {
    // NOT A SECRET AND NOT MISSING — a hazard when present. See `dangerIfSet`.
    name: 'NEXT_PUBLIC_ENABLE_DEMO',
    importance: 'optional',
    purpose: 'Adds one-click role buttons to the login screen, for development only.',
    ifAbsent: 'Nothing, which is what it should be on the University’s deployment. The demo '
      + 'buttons are compiled out entirely.',
    dangerIfSet: 'The login page offers one-click sign-in as an administrator, to anybody who '
      + 'opens it. Delete this variable from the host and redeploy.',
    public: true,
    area: 'site',
  },

  // --- Outbound mail --------------------------------------------------------
  {
    name: 'SMTP_HOST',
    importance: 'recommended',
    purpose: 'The mail server credentials are emailed through.',
    ifAbsent: 'The Email button reports that outbound mail is not configured and sends nothing. '
      + 'Printing and PDFs are unaffected.',
    public: false,
    area: 'mail',
  },
  {
    // ---------------------------------------------------------------------
    // THIS DECIDES WHETHER THE CONNECTION IS ENCRYPTED, which is why it is on
    // the report rather than left as an implementation detail. 465 is implicit
    // TLS and anything else upgrades with STARTTLS, so a wrong value is a
    // silent downgrade rather than an error.
    // ---------------------------------------------------------------------
    name: 'SMTP_PORT',
    importance: 'optional',
    purpose: 'The port to send on, and therefore the encryption: 465 is implicit TLS, 587 '
      + 'upgrades with STARTTLS.',
    ifAbsent: 'Falls back to 587. A provider that requires 465 will refuse or hang, because the '
      + 'connection would not be encrypted from the start.',
    public: false,
    area: 'mail',
  },
  {
    name: 'SMTP_USER',
    importance: 'recommended',
    purpose: 'The account that sends.',
    ifAbsent: 'Outbound mail is off: the Email button on a credential reports that mail is not '
      + 'configured and sends nothing. Printing and PDFs are unaffected.',
    public: false,
    area: 'mail',
  },
  {
    name: 'SMTP_PASS',
    importance: 'recommended',
    purpose: 'Its password.',
    ifAbsent: 'Outbound mail is off: the Email button on a credential reports that mail is not '
      + 'configured and sends nothing. Printing and PDFs are unaffected.',
    public: false,
    area: 'mail',
  },
  {
    name: 'MAIL_FROM',
    importance: 'optional',
    purpose: 'The address graduates see a credential arrive from.',
    ifAbsent: 'Falls back to SMTP_USER.',
    public: false,
    area: 'mail',
  },
  {
    name: 'APPLY_TO',
    importance: 'optional',
    purpose: 'Where a submitted application form is emailed inside the University.',
    ifAbsent: 'The application is still recorded and still appears on the Finance desk; nobody is '
      + 'emailed to say it arrived.',
    public: false,
    area: 'mail',
  },

  // --- Live proctoring ------------------------------------------------------
  {
    name: 'LIVEKIT_URL',
    importance: 'optional',
    purpose: 'The proctoring server. LiveKit is the only provider with an adapter here, and the '
      + 'only one that can be self-hosted — which is the sole option that keeps recordings of '
      + 'students’ homes on infrastructure the University controls.',
    ifAbsent: 'Live proctoring is unavailable. Examinations still run; they are not watched live.',
    public: false,
    area: 'proctoring',
  },
  {
    name: 'LIVEKIT_API_KEY',
    importance: 'optional',
    purpose: 'Its key.',
    ifAbsent: 'Live proctoring is unavailable. Examinations still run and are still recorded as '
      + 'evidence; they are not watched live.',
    public: false,
    area: 'proctoring',
  },
  {
    name: 'LIVEKIT_API_SECRET',
    importance: 'optional',
    purpose: 'Its secret.',
    ifAbsent: 'Live proctoring is unavailable. Examinations still run and are still recorded as '
      + 'evidence; they are not watched live.',
    public: false,
    area: 'proctoring',
  },

  // --- The assistant --------------------------------------------------------
  {
    name: 'ANTHROPIC_API_KEY',
    // RAISED FROM `optional` WHEN THE ACADEMIC STUDIO ARRIVED. One key, two
    // uses, and the second is not a convenience: without it no lecture is ever
    // transformed. A second row was written for the Studio and then removed —
    // two rows for one variable is the fault this whole integration has been
    // closing, and a reader setting one and not the other would be setting the
    // same thing twice.
    importance: 'recommended',
    purpose: 'Two things. The assistant feature in the portal, and the Academic Studio\u2019s '
      + 'transformation of a lecture into corrected text, notes, a teaching script and revision '
      + 'material. NOTHING TO DO WITH CREDENTIALS \u2014 no document is created, signed or '
      + 'verified by a model.',
    ifAbsent: 'The assistant is unavailable, and the Studio transforms nothing with a model: its '
      + 'offline processor stands in and STAMPS every artefact, so nobody approves machine prose '
      + 'believing a machine wrote it. Records, results and credentials are unaffected.',
    public: false,
    area: 'ai',
  },
  {
    name: 'ANTHROPIC_MODEL',
    importance: 'optional',
    purpose: 'Which model the social-post assistant drafts with.',
    ifAbsent: 'A sensible default is used. Set it only to pin a particular model.',
    public: false,
    area: 'ai',
  },

  // -------------------------------------------------------------------------
  // THE ACADEMIC STUDIO
  //
  // Twenty-seven variables arrived with it and NOT ONE was on this report,
  // which is exactly what configuration.test.mjs exists to catch, and did.
  //
  // NONE IS MARKED `required`, deliberately. On this report `required` means
  // the University does not operate — no sign-in, no records. The Studio is an
  // addition: without it admissions, results and credentials are untouched.
  // Marking its variables required would have made the whole institution read
  // as inoperable because an AI feature was unconfigured, and a report that
  // cries wolf is one people stop reading.
  //
  // The severity lives in `ifAbsent`, which is what that field is for.
  // -------------------------------------------------------------------------
  {
    name: 'ACADEMIC_STORE',
    importance: 'recommended',
    purpose: 'Which store the Academic Studio reads: `supabase` for the University\u2019s own database, '
      + '`memory` for the built-in demonstration.',
    ifAbsent: 'THE STUDIO SERVES THE DEMONSTRATION COURSE TO EVERYBODY \u2014 invented lectures, under '
      + 'the University\u2019s name, with no error anywhere. If you read one row on this page, '
      + 'read this one.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_SESSION_MODE',
    importance: 'recommended',
    purpose: 'How the Studio learns who is asking: `supabase` behind the portal\u2019s own sign-in, '
      + '`header` behind another host\u2019s, `demo` for the switcher.',
    ifAbsent: 'The Studio falls back to the DEMONSTRATION SWITCHER, where whoever opens it chooses whose '
      + 'eyes to look through \u2014 a lecturer\u2019s included.',
    public: false,
    area: 'studio',
  },
  {
    name: 'SUPABASE_JWT_SECRET',
    importance: 'recommended',
    purpose: 'Verifies the access token a signed-in person presents to the Studio.',
    ifAbsent: 'The Studio cannot verify a session and refuses every request. It does NOT wave people '
      + 'through; that refusal is deliberate.',
    public: false,
    minLength: 20,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_UNIVERSITY_NAME',
    importance: 'recommended',
    purpose: 'The institution\u2019s name, as it appears on the Studio\u2019s screens.',
    ifAbsent: 'Every Studio page refuses to render rather than showing a name this system made up under '
      + 'the University\u2019s letterhead.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_UNIVERSITY_SHORT_NAME',
    importance: 'recommended',
    purpose: 'The short form of the institution\u2019s name.',
    ifAbsent: 'As above \u2014 the Studio refuses rather than inventing one.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_UNIVERSITY_ID',
    importance: 'recommended',
    purpose: 'The institution\u2019s identifier inside the Studio.',
    ifAbsent: 'As above \u2014 the Studio refuses rather than inventing one.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_AI_MODEL',
    importance: 'optional',
    purpose: 'Which Claude model the Studio\u2019s transformation runs on.',
    ifAbsent: 'The Studio uses its own default model. Transformation still happens; which '
      + 'model did it is recorded on every artefact either way.',
    public: false,
    area: 'ai',
  },
  {
    name: 'ANTHROPIC_AUTH_TOKEN',
    importance: 'optional',
    purpose: 'An alternative to ANTHROPIC_API_KEY where a gateway issues tokens.',
    ifAbsent: 'Nothing, unless the deployment uses a gateway instead of a key.',
    public: false,
    area: 'ai',
  },
  {
    name: 'ACADEMIC_TRANSCRIBER',
    importance: 'recommended',
    purpose: 'Which service turns a recording into words. THERE IS NO DEFAULT VENDOR.',
    ifAbsent: 'A lecturer can upload a recording and nothing ever comes out of it. The Studio says so '
      + 'rather than failing obscurely, but no audio is transcribed.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_TRANSCRIBER_KEY',
    importance: 'recommended',
    purpose: 'The transcription service\u2019s key.',
    ifAbsent: 'As above \u2014 no recording is transcribed.',
    public: false,
    minLength: 8,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_TRANSCRIBER_MODEL',
    importance: 'optional',
    purpose: 'Which transcription model to ask for.',
    ifAbsent: 'The service\u2019s own default is used.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_SPEECH',
    importance: 'recommended',
    purpose: 'Which service reads a lesson aloud. THERE IS NO DEFAULT VENDOR.',
    ifAbsent: 'No fifteen-minute audio lesson is produced, in any language. The written material is '
      + 'unaffected.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_SPEECH_KEY',
    importance: 'recommended',
    purpose: 'The speech service\u2019s key.',
    ifAbsent: 'As above \u2014 no audio is produced.',
    public: false,
    minLength: 8,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_SPEECH_MODEL',
    importance: 'optional',
    purpose: 'Which speech model to ask for.',
    ifAbsent: 'The service\u2019s own default is used.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_S3_BUCKET',
    importance: 'recommended',
    purpose: 'Where recordings and generated audio are stored.',
    ifAbsent: 'Media is written to local disk, which a serverless deployment discards between requests \u2014 '
      + 'so a recording uploaded today may be gone tomorrow.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_S3_ENDPOINT',
    importance: 'recommended',
    purpose: 'The object store\u2019s endpoint.',
    ifAbsent: 'As above \u2014 media falls back to local disk.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_S3_KEY_ID',
    importance: 'recommended',
    purpose: 'The object store\u2019s access key id.',
    ifAbsent: 'As above \u2014 media falls back to local disk.',
    public: false,
    minLength: 8,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_S3_SECRET',
    importance: 'recommended',
    purpose: 'The object store\u2019s secret.',
    ifAbsent: 'As above \u2014 media falls back to local disk.',
    public: false,
    minLength: 8,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_S3_REGION',
    importance: 'optional',
    purpose: 'The object store\u2019s region.',
    ifAbsent: 'A default is used; some providers require it.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_S3_PATH_STYLE',
    importance: 'optional',
    purpose: 'Use path-style URLs, which some S3-compatible providers require.',
    ifAbsent: 'Virtual-host style is used.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_MEDIA_DIR',
    importance: 'optional',
    purpose: 'Where media goes when no object store is configured.',
    ifAbsent: 'A directory under the working tree is used.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_DATA_DIR',
    importance: 'optional',
    purpose: 'Where the DEMONSTRATION store persists between restarts.',
    ifAbsent: 'The demonstration resets on every restart. Irrelevant when ACADEMIC_STORE=supabase.',
    public: false,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_SESSION_SECRET',
    importance: 'optional',
    purpose: 'Signs the identity a host passes across, when ACADEMIC_SESSION_MODE=header.',
    ifAbsent: 'Header mode refuses every request. Irrelevant in supabase or demo mode.',
    public: false,
    minLength: 20,
    area: 'studio',
  },
  {
    name: 'ACADEMIC_LIVE',
    importance: 'optional',
    purpose: 'Enables live translated delivery of a class.',
    ifAbsent: 'Live sessions are unavailable. Recorded lectures are unaffected.',
    public: false,
    area: 'studio',
  },
  {
    name: 'OPENAI_API_KEY',
    importance: 'optional',
    purpose: 'An alternative transformation vendor, behind the same interface.',
    ifAbsent: 'Nothing, unless the deployment chooses it over Claude.',
    public: false,
    area: 'ai',
  },
  {
    name: 'OPENAI_ENDPOINT',
    importance: 'optional',
    purpose: 'That vendor\u2019s endpoint.',
    ifAbsent: 'Its default is used.',
    public: false,
    area: 'ai',
  },
  {
    name: 'OPENAI_MODEL',
    importance: 'optional',
    purpose: 'Which of its models to ask for.',
    ifAbsent: 'Its default is used.',
    public: false,
    area: 'ai',
  },
  {
    name: 'GEMINI_API_KEY',
    importance: 'optional',
    purpose: 'An alternative transformation vendor, behind the same interface.',
    ifAbsent: 'Nothing, unless the deployment chooses it.',
    public: false,
    area: 'ai',
  },
  {
    name: 'GEMINI_ENDPOINT',
    importance: 'optional',
    purpose: 'That vendor\u2019s endpoint.',
    ifAbsent: 'Its default is used.',
    public: false,
    area: 'ai',
  },
  {
    name: 'GEMINI_MODEL',
    importance: 'optional',
    purpose: 'Which of its models to ask for.',
    ifAbsent: 'Its default is used.',
    public: false,
    area: 'ai',
  },
];

export interface SettingReport extends Setting {
  set: boolean;
  /** True when it is set but shorter than the minimum it needs. */
  tooShort: boolean;
}

export interface ConfigurationReport {
  settings: SettingReport[];
  missingRequired: string[];
  missingRecommended: string[];
  /** True when everything the University cannot run without is present. */
  operational: boolean;
  /**
   * Variables given a NEXT_PUBLIC_ name that must never have one.
   *
   * THE MOST DANGEROUS MISCONFIGURATION THERE IS. Anything prefixed
   * NEXT_PUBLIC_ is compiled into the browser bundle and served to every
   * visitor. `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` would hand the world full
   * read and write over every record the University holds, and the site would
   * look completely normal.
   */
  exposedSecrets: string[];
  /**
   * Variables that are a hazard BECAUSE they are set.
   *
   * The rest of this report asks whether something is missing. A deployment
   * with NEXT_PUBLIC_ENABLE_DEMO set is fully configured by every other
   * measure and offers one-click administrator sign-in to any visitor, so
   * "everything is set" is exactly the wrong answer to give about it.
   */
  dangerouslySet: string[];
}

/** Read the settings against an environment. Values are never returned. */
// ---------------------------------------------------------------------------
// WHICH COMMIT IS ACTUALLY RUNNING.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The University reported that two fixes had not taken effect and guessed the
// branch might need merging. It did not — the commits were pushed and the
// deployment simply had not rebuilt on them — but there was no way for anybody
// to establish that from the portal, and no way for me to establish it either.
// The question "is the thing I am looking at the code that was written?" was
// unanswerable by everyone involved, so it was answered by guessing.
//
// Vercel sets these on every build when "System Environment Variables" is
// enabled. Read here rather than read from a file committed at build time,
// because a stamp the repository writes is a stamp that can be stale in
// exactly the case it is needed for.
// ---------------------------------------------------------------------------

export interface DeploymentStamp {
  /** The commit the running build was made from, short form. */
  commit: string | null;
  /** The branch it came from — which is how "should this be merged?" is answered. */
  branch: string | null;
  /** Its subject line, so the commit is recognisable without looking it up. */
  message: string | null;
  /** 'production', 'preview' or 'development'. */
  environment: string | null;
  /** Absent when the system variables are switched off in the host. */
  available: boolean;
}

export function deploymentStamp(env: NodeJS.ProcessEnv = process.env): DeploymentStamp {
  const sha = (env.VERCEL_GIT_COMMIT_SHA ?? '').trim();
  return {
    commit: sha ? sha.slice(0, 9) : null,
    branch: (env.VERCEL_GIT_COMMIT_REF ?? '').trim() || null,
    // Only the subject. A full commit body would run to paragraphs in this
    // codebase and the panel needs one line.
    message: ((env.VERCEL_GIT_COMMIT_MESSAGE ?? '').trim().split('\n')[0] || null),
    environment: (env.VERCEL_ENV ?? '').trim() || null,
    available: Boolean(sha),
  };
}

export function inspect(env: NodeJS.ProcessEnv = process.env): ConfigurationReport {
  const settings: SettingReport[] = SETTINGS.map((s) => {
    const raw = (env[s.name] ?? '').trim();
    return {
      ...s,
      set: raw.length > 0,
      tooShort: raw.length > 0 && Boolean(s.minLength) && raw.length < s.minLength!,
    };
  });

  // Names that are DECLARED public settings in their own right. Without this,
  // adding SITE_URL made NEXT_PUBLIC_SITE_URL — a legitimate, separately
  // declared browser variable — read as a leaked copy of it, purely because one
  // name is the other with a prefix. A false alarm here is not harmless: this
  // warning tells somebody to rotate a key, and one that cries wolf is one
  // people learn to dismiss on the day it is real.
  const legitimatelyPublic = new Set(SETTINGS.filter((s) => s.public).map((s) => s.name));

  const exposedSecrets: string[] = [];
  for (const s of SETTINGS) {
    if (s.public) continue;
    // Both the exact public alias and the value having been copied under one.
    const alias = `NEXT_PUBLIC_${s.name}`;
    if (legitimatelyPublic.has(alias)) continue;
    if ((env[alias] ?? '').trim()) exposedSecrets.push(alias);
  }

  // THE INVERTED CHECK. Everything else here warns about an absence; these
  // warn about a presence, and the only one so far is the demo login.
  const dangerouslySet = settings.filter((s) => s.dangerIfSet && s.set).map((s) => s.name);

  return {
    settings,
    dangerouslySet,
    missingRequired: settings.filter((s) => s.importance === 'required' && !s.set).map((s) => s.name),
    missingRecommended: settings
      .filter((s) => s.importance === 'recommended' && !s.set).map((s) => s.name),
    operational: settings.every((s) => s.importance !== 'required' || (s.set && !s.tooShort)),
    exposedSecrets,
  };
}
