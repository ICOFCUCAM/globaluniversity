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
  /** Which group it belongs to on the report. */
  area: 'database' | 'credentials' | 'mail' | 'proctoring' | 'social' | 'site' | 'ai';
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

  // --- The credential system ----------------------------------------------
  {
    name: 'CREDENTIAL_SECRET',
    importance: 'required',
    purpose: 'The key every certificate and transcript is sealed with.',
    ifAbsent: 'NOTHING CAN BE ISSUED. The issue routes refuse rather than seal with a fallback, '
      + 'because a credential system that works with a published key is worse than one that is '
      + 'switched off — it produces documents people trust.',
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
      + 'credentials whose QR codes point somewhere else.',
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
    importance: 'optional',
    purpose: 'The assistant feature in the portal. NOTHING TO DO WITH CREDENTIALS — no document '
      + 'is created, signed or verified by a model.',
    ifAbsent: 'The assistant is unavailable. Every other part of the system is unaffected.',
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
}

/** Read the settings against an environment. Values are never returned. */
export function inspect(env: NodeJS.ProcessEnv = process.env): ConfigurationReport {
  const settings: SettingReport[] = SETTINGS.map((s) => {
    const raw = (env[s.name] ?? '').trim();
    return {
      ...s,
      set: raw.length > 0,
      tooShort: raw.length > 0 && Boolean(s.minLength) && raw.length < s.minLength!,
    };
  });

  const exposedSecrets: string[] = [];
  for (const s of SETTINGS) {
    if (s.public) continue;
    // Both the exact public alias and the value having been copied under one.
    const alias = `NEXT_PUBLIC_${s.name}`;
    if ((env[alias] ?? '').trim()) exposedSecrets.push(alias);
  }

  return {
    settings,
    missingRequired: settings.filter((s) => s.importance === 'required' && !s.set).map((s) => s.name),
    missingRecommended: settings
      .filter((s) => s.importance === 'recommended' && !s.set).map((s) => s.name),
    operational: settings.every((s) => s.importance !== 'required' || (s.set && !s.tooShort)),
    exposedSecrets,
  };
}
