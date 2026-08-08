// ---------------------------------------------------------------------------
// THE CREDENTIAL & CERTIFICATE AUTHORITY — the rules, held apart from the
// screens that draw them.
//
// The university asked for a Vice-Chancellor's privilege over every document
// the institution issues: view, edit, correct, reissue, revoke, print, email,
// verify, create templates, create entirely new kinds of credential. And then
// the sentence that governs all of it:
//
//   "But every sensitive action must be permanently audited. The system should
//    never simply overwrite history."
//
// EVERYTHING IN THIS FILE FOLLOWS FROM THAT ONE SENTENCE.
//
// ---------------------------------------------------------------------------
// WHY 'EDIT' IS NOT A FUNCTION IN THIS FILE
// ---------------------------------------------------------------------------
//
// The university wrote EDIT in its list of privileges, and there is no `edit`
// here. That is not an omission and it is not a refusal of the request — it is
// the request, implemented the only way it can be implemented safely.
//
// An issued certificate is not a record of what the university currently
// believes. It is a statement the university made, on a date, sealed with a
// hash that /verify checks. Editing the row changes what the university appears
// to have said in 2024. Every printed copy in circulation now disagrees with
// the register, every QR code resolves to text that is not what was conferred,
// and there is no trace that anything happened.
//
// So EDIT is implemented as AMEND: version 1 becomes Superseded, version 2
// becomes Current, both survive, and the amendment records who changed what and
// why. That is exactly the picture the university drew in point 4 —
//
//     Version 1  Superseded  (name correction)
//     Version 2  Current
//
// — and it is what "the changes he make should automatically register in the
// system" actually requires: a registry entry, not an UPDATE.
//
// The graduate gets a corrected document. The institution keeps a record it can
// defend to an accreditor. Nobody has to choose between the two.
// ---------------------------------------------------------------------------

import type { CredentialKind } from '@/lib/credentialTemplate';

// ---------------------------------------------------------------------------
// 1. WHAT KIND OF INSTRUMENT IS THIS?
// ---------------------------------------------------------------------------

/**
 * "He can also create other kinds of certificate for different role that may
 * not even be academic."
 *
 * THE CATEGORY IS THE MOST IMPORTANT FIELD IN THIS SUBSYSTEM. The university
 * was explicit about the failure it is guarding against: "the system should
 * clearly classify them so nobody mistakes an institutional certificate for an
 * accredited academic degree."
 *
 * That is not a labelling preference. A certificate of appreciation that
 * renders like a degree, verifies like a degree and files like a degree IS a
 * fake degree, whatever its title says — and the university that issued it
 * cannot later explain that it did not mean it that way.
 */
export const CREDENTIAL_CATEGORIES = [
  'academic', 'professional', 'ministry', 'institutional', 'honorary',
] as const;

export type CredentialCategory = (typeof CREDENTIAL_CATEGORIES)[number];

export interface CategoryProfile {
  id: CredentialCategory;
  label: string;
  /** One line, printed on the credential and shown on the verification page. */
  standing: string;
  /** May a credential in this category ever be an academic award? */
  mayBeAcademic: boolean;
  /** What a verifier is told this is, in the words they need. */
  verifierNote: string;
}

export const CATEGORY_PROFILES: Record<CredentialCategory, CategoryProfile> = {
  academic: {
    id: 'academic',
    label: 'Academic award',
    standing: 'An academic award of ICOF Global University.',
    mayBeAcademic: true,
    verifierNote:
      'This is an academic award conferred on completion of an assessed programme of study.',
  },
  professional: {
    id: 'professional',
    label: 'Professional credential',
    standing: 'A professional credential. Not an academic award.',
    mayBeAcademic: false,
    verifierNote:
      'This is a professional credential recording completion of training or continuing '
      + 'professional development. It is not an academic degree, diploma or certificate.',
  },
  ministry: {
    id: 'ministry',
    label: 'Ministry credential',
    standing: 'A ministry credential. Not an academic award.',
    mayBeAcademic: false,
    verifierNote:
      'This is a ministry credential issued in respect of appointment, ordination or '
      + 'commissioning. It is not an academic degree, diploma or certificate.',
  },
  institutional: {
    id: 'institutional',
    label: 'Institutional certificate',
    standing: 'An institutional certificate. Not an academic award.',
    mayBeAcademic: false,
    verifierNote:
      'This is an institutional certificate — of service, participation, appreciation or '
      + 'appointment. It is not an academic degree, diploma or certificate, and it does not '
      + 'carry academic credit.',
  },
  honorary: {
    id: 'honorary',
    label: 'Honorary award',
    standing: 'An honorary award. Conferred by the Senate; not earned by examination.',
    mayBeAcademic: false,
    verifierNote:
      'This is an honorary award conferred by the Senate in recognition of distinction. It '
      + 'was not obtained by examination or by completing a programme of study, and it does '
      + 'not carry academic credit.',
  },
};

export interface CredentialType {
  id: string;
  code: string;
  name: string;
  category: CredentialCategory;
  isAcademic: boolean;
  templateId?: string | null;
  eligibility?: string | null;
  issuingRole: string;
  validity: 'permanent' | 'expiring';
  validityMonths?: number | null;
  verificationEnabled: boolean;
  status: 'draft' | 'active' | 'retired';
}

/**
 * Everything wrong with a proposed credential type.
 *
 * MIRRORS THE DATABASE CONSTRAINTS IN 013 EXACTLY, and exists so the person
 * typing the form is told before they submit rather than being handed a
 * constraint-violation message from Postgres. The database is the control; this
 * is the courtesy. Both are needed and neither replaces the other.
 */
export function problemsWithType(t: Partial<CredentialType>): string[] {
  const problems: string[] = [];

  if (!t.name?.trim()) problems.push('The credential needs a name.');
  if (!t.code?.trim()) problems.push('The credential needs a short code, used in its number.');
  else if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(t.code))
    problems.push('The code should be upper-case letters, digits and hyphens — it is printed in the credential number.');

  if (!t.category) problems.push('Choose a category. This decides what a verifier is told the document is.');

  if (t.isAcademic && t.category && !CATEGORY_PROFILES[t.category].mayBeAcademic) {
    problems.push(
      `A ${CATEGORY_PROFILES[t.category].label.toLowerCase()} cannot be marked as an academic award. `
      + 'That is the confusion this classification exists to prevent.',
    );
  }

  if (t.validity === 'expiring' && !t.validityMonths) {
    problems.push('An expiring credential must say for how long it is valid.');
  }
  if (t.validity === 'expiring' && t.validityMonths != null && t.validityMonths < 1) {
    problems.push('A validity period must be at least one month.');
  }

  return problems;
}

/**
 * What the verification page says this document is.
 *
 * SHOWN ON EVERY VERIFICATION, INCLUDING THE ACADEMIC ONES. An employer
 * checking a Bachelor of Theology and an employer checking a Certificate of
 * Appreciation must see the same field filled in differently — not a note that
 * appears only on the non-academic ones, which reads as a disclaimer and gets
 * skimmed.
 */
export function standingOf(type: Pick<CredentialType, 'category'>): string {
  return CATEGORY_PROFILES[type.category].verifierNote;
}

// ---------------------------------------------------------------------------
// 2. VERSIONS — "Never destroy the previous certificate"
// ---------------------------------------------------------------------------

export type VersionState = 'current' | 'superseded' | 'revoked';

export interface CredentialVersion {
  id: string;
  /** STABLE ACROSS VERSIONS. The award's number — not the document's. */
  credentialRef: string;
  version: number;
  supersedesId?: string | null;
  state: VersionState;
  issuedAt: string;
  /** What changed, relative to the version before it. Null on version 1. */
  reason?: string | null;
  documentHash?: string | null;
}

/**
 * The history of one award, newest first.
 *
 * THE NUMBER DOES NOT CHANGE BETWEEN VERSIONS and that is the point of point 9.
 * A QR code was printed on version 1 and handed to an employer. If version 2
 * carried a new number, that QR would resolve to a document the university had
 * marked superseded and the employer would be told, in effect, that the
 * graduate's certificate is not valid — when in fact the university corrected
 * a spelling.
 *
 * So the number identifies the AWARD. The version identifies what the
 * university has said about it. Scanning an old QR finds the award, reports
 * that this print is superseded, and shows the current one.
 */
export function historyOf(versions: CredentialVersion[]): CredentialVersion[] {
  return [...versions].sort((a, b) => b.version - a.version);
}

export function currentVersion(versions: CredentialVersion[]): CredentialVersion | null {
  return historyOf(versions).find((v) => v.state !== 'superseded') ?? null;
}

export interface VerificationAnswer {
  found: boolean;
  /** What the scanned document is. */
  scanned?: CredentialVersion;
  /** What the university currently says. Differs from `scanned` after a correction. */
  current?: CredentialVersion;
  outcome: 'valid' | 'superseded' | 'revoked' | 'not-found';
  /** The sentence shown to whoever scanned it. */
  message: string;
}

/**
 * What a verifier is told when they scan a particular version.
 *
 * "Credential Superseded — a corrected version has been issued." That is the
 * university's own wording in point 9 and it is the right wording: it does not
 * say the graduate's certificate is fake, and it does not pretend nothing
 * happened. It says the document in your hand has been replaced, and here is
 * what replaced it.
 */
export function verify(scannedId: string, versions: CredentialVersion[]): VerificationAnswer {
  const scanned = versions.find((v) => v.id === scannedId);
  if (!scanned) {
    return { found: false, outcome: 'not-found', message: 'No credential matches this reference.' };
  }

  const current = currentVersion(versions) ?? undefined;

  if (scanned.state === 'revoked' || current?.state === 'revoked') {
    return {
      found: true, scanned, current, outcome: 'revoked',
      message: 'This credential has been revoked by the University and is not valid.',
    };
  }

  if (scanned.state === 'superseded') {
    return {
      found: true, scanned, current, outcome: 'superseded',
      message:
        `Credential superseded. Version ${scanned.version} was replaced by version ${current?.version ?? '—'}`
        + `${current?.reason ? ` (${current.reason})` : ''}. The award itself stands; use the current version.`,
    };
  }

  return {
    found: true, scanned, current, outcome: 'valid',
    message: `Valid. Version ${scanned.version}, issued ${scanned.issuedAt.slice(0, 10)}.`,
  };
}

/**
 * The next version, given the one being corrected.
 *
 * DOES NOT MUTATE ITS INPUT. It returns the pair — the old row as it must
 * become, and the new row — because the caller has to write both in one
 * transaction. A function that returned only the new version would make it easy
 * to write it and forget to supersede the old one, leaving two current
 * versions of the same award, which is worse than having edited in place.
 */
export function amend(
  previous: CredentialVersion,
  change: { reason: string; documentHash?: string | null; issuedAt?: string },
): { superseded: CredentialVersion; created: CredentialVersion } {
  if (!change.reason?.trim()) {
    throw new Error('An amendment needs a stated reason. A correction to a sealed document without one is indistinguishable from tampering.');
  }
  if (previous.state === 'revoked') {
    // Matches the register's own rule from 004: revocation is final, and the
    // remedy is a new award rather than an un-revocation nobody can see.
    throw new Error('A revoked credential cannot be amended. Revocation is final; issue a new award instead.');
  }

  return {
    superseded: { ...previous, state: 'superseded' },
    created: {
      id: `${previous.credentialRef}-v${previous.version + 1}`,
      credentialRef: previous.credentialRef, // STABLE. See above.
      version: previous.version + 1,
      supersedesId: previous.id,
      state: 'current',
      issuedAt: change.issuedAt ?? new Date().toISOString(),
      reason: change.reason.trim(),
      documentHash: change.documentHash ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// 3. THE CORRECTION REQUEST — "Students should not directly edit their
//    credentials"
// ---------------------------------------------------------------------------

export const CORRECTION_STATES = [
  'submitted', 'under_review', 'escalated', 'approved', 'rejected', 'withdrawn',
] as const;

export type CorrectionState = (typeof CORRECTION_STATES)[number];

/**
 * Who may move a correction request, and to where.
 *
 * A STATE MACHINE RATHER THAN A SET OF BUTTONS, for the same reason the grade
 * approval chain in resultsWorkflow.ts is one: the route the university drew
 * has four steps and the value is entirely in the fact that they are four
 * different people. A correction that skips review is an edit, and an edit to a
 * sealed document is what this whole subsystem exists to prevent.
 *
 * Note what the STUDENT may do: submit, and withdraw. Nothing else. They cannot
 * approve their own correction and they cannot escalate it past a reviewer who
 * said no — which is the request the university made in one sentence, written
 * out as a table so it cannot be half-implemented.
 */
export const CORRECTION_TRANSITIONS: Record<
  CorrectionState,
  Array<{ to: CorrectionState; roles: string[]; label: string }>
> = {
  submitted: [
    { to: 'under_review', roles: ['registrar', 'academic-office', 'superadmin'], label: 'Begin review' },
    { to: 'withdrawn', roles: ['student'], label: 'Withdraw' },
  ],
  under_review: [
    { to: 'escalated', roles: ['registrar', 'academic-office'], label: 'Escalate to the Credential Authority' },
    { to: 'approved', roles: ['superadmin', 'vice-chancellor'], label: 'Approve and issue a corrected version' },
    { to: 'rejected', roles: ['registrar', 'academic-office', 'superadmin'], label: 'Reject' },
    { to: 'withdrawn', roles: ['student'], label: 'Withdraw' },
  ],
  escalated: [
    { to: 'approved', roles: ['superadmin', 'vice-chancellor'], label: 'Approve and issue a corrected version' },
    { to: 'rejected', roles: ['superadmin', 'vice-chancellor'], label: 'Reject' },
  ],
  approved: [],
  rejected: [],
  withdrawn: [],
};

export interface CorrectionMove {
  from: CorrectionState;
  to: CorrectionState;
  role: string;
  /** Required when rejecting. See below. */
  note?: string | null;
}

export interface MoveResult {
  allowed: boolean;
  reason?: string;
}

/**
 * May this person make this move?
 *
 * THE REJECTION NOTE IS REQUIRED and that is not bureaucracy. A student whose
 * correction is refused with no reason has nothing to appeal and nothing to
 * fix; they will submit the same request again, and the office will refuse it
 * again. The note is what makes the refusal actionable, and migration 013
 * enforces it as a CHECK constraint so it cannot be skipped by a route.
 */
export function canMove(move: CorrectionMove): MoveResult {
  const available = CORRECTION_TRANSITIONS[move.from];
  if (!available) return { allowed: false, reason: `${move.from} is not a state this request can be in.` };

  if (available.length === 0) {
    return { allowed: false, reason: `A ${move.from} request is closed and cannot be moved again.` };
  }

  const transition = available.find((t) => t.to === move.to);
  if (!transition) {
    return {
      allowed: false,
      reason: `A ${move.from.replace('_', ' ')} request cannot go straight to ${move.to}.`,
    };
  }

  if (!transition.roles.includes(move.role)) {
    return {
      allowed: false,
      reason: `${move.role} may not ${transition.label.toLowerCase()}. That is for the ${transition.roles.join(' or the ')}.`,
    };
  }

  if (move.to === 'rejected' && !move.note?.trim()) {
    return {
      allowed: false,
      reason: 'A rejection must say why, so the student knows whether to appeal it or correct it.',
    };
  }

  return { allowed: true };
}

/** What this role can do with a request in this state — used to draw the buttons. */
export function movesFor(state: CorrectionState, role: string) {
  return (CORRECTION_TRANSITIONS[state] ?? []).filter((t) => t.roles.includes(role));
}

// ---------------------------------------------------------------------------
// 4. THE TEMPLATE STUDIO'S MERGE FIELDS
// ---------------------------------------------------------------------------

export interface MergeField {
  token: string;
  label: string;
  /** Where it comes from, so the Studio can say why a field is blank. */
  source: string;
  /** Present on every credential, or only on some? */
  always: boolean;
}

/**
 * The fields a template may place, exactly as the university listed them.
 *
 * A CLOSED LIST, not a free-text token. `{{student.full_name}}` resolves
 * because it is here; `{{student.fullname}}` does not, and the Studio says so
 * while the design is being edited. The alternative — accept any token and
 * resolve what you can — puts the failure on the printed certificate, where a
 * graduate finds "{{student.fullnme}}" in place of their name at the ceremony.
 */
export const MERGE_FIELDS: MergeField[] = [
  { token: 'student.full_name', label: 'Student’s full name', source: 'The student register.', always: true },
  { token: 'student.matric_no', label: 'Matriculation number', source: 'The student register.', always: true },
  { token: 'programme.name', label: 'Programme', source: 'The programme catalogue.', always: true },
  { token: 'programme.faculty', label: 'Faculty or school', source: 'The programme catalogue.', always: true },
  { token: 'credential.title', label: 'Award or credential title', source: 'The credential type.', always: true },
  { token: 'credential.number', label: 'Credential number', source: 'Issued by the register.', always: true },
  { token: 'credential.version', label: 'Version', source: 'The register. Prints “Version 2” only after a correction.', always: true },
  { token: 'credential.category', label: 'Classification', source: 'The credential type — academic, ministry, institutional…', always: true },
  { token: 'date.conferred', label: 'Date conferred', source: 'The graduation record.', always: true },
  { token: 'date.issued', label: 'Date issued', source: 'The register.', always: true },
  { token: 'result.classification', label: 'Classification of the award', source: 'The results record. Blank on non-academic credentials.', always: false },
  { token: 'result.gpa', label: 'Cumulative GPA', source: 'The GPA engine. Blank on non-academic credentials.', always: false },
  { token: 'result.credits', label: 'Credits earned', source: 'The results record. Blank on non-academic credentials.', always: false },
  { token: 'signatory.vice_chancellor', label: 'Vice-Chancellor', source: 'The leadership roster.', always: true },
  { token: 'signatory.registrar', label: 'Registrar', source: 'The leadership roster.', always: true },
  { token: 'university.name', label: 'University name', source: 'System constants.', always: true },
  { token: 'university.seal', label: 'Seal', source: 'System constants.', always: true },
  { token: 'verify.url', label: 'Verification address', source: 'Generated per credential.', always: true },
  { token: 'verify.qr', label: 'Verification QR code', source: 'Generated per credential.', always: true },
];

const TOKEN_PATTERN = /\{\{\s*([a-z_]+\.[a-z_]+)\s*\}\}/g;

export interface FieldReport {
  used: string[];
  /** Tokens the template asks for that this system cannot supply. */
  unknown: string[];
  /** Fields that may legitimately render blank, so the author is not surprised. */
  conditional: string[];
}

/**
 * Which merge fields a template actually uses, and which of them are a problem.
 *
 * RUN BEFORE PUBLICATION, NOT AT PRINT TIME. A template is approved by three
 * offices and then used for every graduand in a cohort; discovering a
 * misspelled token on the two-hundredth certificate means two hundred
 * documents to reissue, each of which is a version-2 amendment with a reason
 * that reads "the university misspelled its own field name".
 */
export function fieldsUsedBy(source: string): FieldReport {
  const known = new Set(MERGE_FIELDS.map((f) => f.token));
  const optional = new Set(MERGE_FIELDS.filter((f) => !f.always).map((f) => f.token));

  // exec in a loop rather than matchAll: the project compiles below ES2015
  // iteration, and matchAll's iterator needs downlevelIteration. `lastIndex`
  // is reset first because TOKEN_PATTERN is a module-level /g regex and carries
  // its position between calls — the classic way this function returns
  // different answers for the same input on the second call.
  const used: string[] = [];
  TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_PATTERN.exec(source)) !== null) {
    const token = match[1];
    if (!used.includes(token)) used.push(token);
  }

  return {
    used,
    unknown: used.filter((t) => !known.has(t)),
    conditional: used.filter((t) => optional.has(t)),
  };
}

/**
 * Fill a template's tokens from a record.
 *
 * A MISSING VALUE RENDERS AS A VISIBLE MARKER, NOT AS AN EMPTY STRING. An empty
 * string produces a certificate with a blank where the classification should be
 * — which looks like a design choice and gets sealed. `[ classification ]`
 * looks like a mistake, because it is one, and it gets caught in the proof.
 */
export function render(source: string, values: Record<string, string | null | undefined>): string {
  return source.replace(TOKEN_PATTERN, (_whole, token: string) => {
    const value = values[token];
    if (value == null || value === '') return `[ ${token.split('.').pop()?.replace(/_/g, ' ')} ]`;
    return value;
  });
}

// ---------------------------------------------------------------------------
// 5. THE AUDIT TRAIL
// ---------------------------------------------------------------------------

/**
 * Every action that must produce a permanent record.
 *
 * MATCHES THE CHECK CONSTRAINT IN MIGRATION 013. If a route writes an action
 * that is not in this list, the insert fails — which is the right failure,
 * because the alternative is an action that happened and was not recorded.
 */
export const AUDIT_ACTIONS = [
  'issued', 'corrected', 'reissued', 'revoked', 'reinstated',
  'printed', 'emailed', 'template_created', 'template_published',
  'type_created', 'correction_requested', 'correction_reviewed',
  'correction_approved', 'correction_rejected',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEvent {
  id: string;
  credentialRef?: string | null;
  action: AuditAction;
  fromVersion?: number | null;
  toVersion?: number | null;
  reason?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  ip?: string | null;
  occurredAt: string;
}

/**
 * One line of the trail, in the words the university used in point 10.
 *
 * WRITTEN FOR SOMEBODY WHO WAS NOT THERE. An audit trail is read years later,
 * usually by an accreditor or a lawyer, and "UPDATE credentials_issued SET
 * version=2" tells them nothing. "Vice-Chancellor corrected version 1 to
 * version 2 — surname corrected following student request #4471" is the same
 * event, and it answers the question they came to ask.
 */
export function describeEvent(e: AuditEvent): string {
  const who = e.actorRole ? `${e.actorRole}${e.actorEmail ? ` (${e.actorEmail})` : ''}` : 'The system';
  const ref = e.credentialRef ? ` ${e.credentialRef}` : '';
  const why = e.reason ? ` — ${e.reason}` : '';

  switch (e.action) {
    case 'issued':
      return `${who} issued${ref}${why}`;
    case 'corrected':
      return `${who} corrected${ref} from version ${e.fromVersion} to version ${e.toVersion}${why}`;
    case 'reissued':
      return `${who} reissued${ref} as version ${e.toVersion}${why}`;
    case 'revoked':
      return `${who} revoked${ref}${why}`;
    case 'reinstated':
      return `${who} reinstated${ref}${why}`;
    case 'printed':
      return `${who} printed${ref}${e.toVersion ? ` version ${e.toVersion}` : ''}`;
    case 'emailed':
      return `${who} emailed${ref} to the student${why}`;
    case 'template_created':
      return `${who} created a certificate design${why}`;
    case 'template_published':
      return `${who} published a certificate design${why}`;
    case 'type_created':
      return `${who} created a new kind of credential${why}`;
    case 'correction_requested':
      return `A correction was requested against${ref}${why}`;
    case 'correction_reviewed':
      return `${who} reviewed the correction request against${ref}${why}`;
    case 'correction_approved':
      return `${who} approved the correction against${ref}${why}`;
    case 'correction_rejected':
      return `${who} rejected the correction against${ref}${why}`;
    default:
      return `${who} acted on${ref}`;
  }
}

/**
 * Which actions the Authority screen treats as requiring a stated reason.
 *
 * NOT ALL OF THEM. Printing a certificate is auditable and needs no
 * justification — it happens at every graduation. Revoking one changes a
 * person's standing in the world and must never appear in the trail as a bare
 * fact with no explanation attached.
 */
export const REASON_REQUIRED: AuditAction[] = [
  'corrected', 'reissued', 'revoked', 'reinstated', 'correction_rejected',
];

export function needsReason(action: AuditAction): boolean {
  return REASON_REQUIRED.includes(action);
}

// ---------------------------------------------------------------------------
// 6. WHAT THE AUTHORITY MAY DO TO A GIVEN DOCUMENT
// ---------------------------------------------------------------------------

export type AuthorityAction =
  | 'view' | 'amend' | 'reissue' | 'revoke' | 'print' | 'email' | 'verify';

/**
 * The privilege list from point 3, as a function of the document's state.
 *
 * WHY A REVOKED CREDENTIAL CAN STILL BE VIEWED AND VERIFIED. Those are the two
 * things a revoked credential is FOR. Someone is holding a printed copy; the
 * register has to be able to tell them it is no longer valid. Hiding the record
 * would mean the university could not answer the question at all.
 *
 * THERE IS NO 'REINSTATE', AND THIS FUNCTION USED TO OFFER ONE. It was mine,
 * not the university's — the twelve-point specification lists VIEW EDIT CORRECT
 * REISSUE REVOKE PRINT EMAIL VERIFY and no reinstatement — and the register has
 * refused it since 004:
 *
 *   "a revoked credential cannot be reinstated; issue a new one"
 *
 * with the reason stated there: un-revoking would let an institution quietly
 * restore a credential it had withdrawn, with nothing in the record to show it
 * ever had. That is precisely the manoeuvre revocation exists to make
 * impossible.
 *
 * So the button would have been drawn, pressed, and refused by the database.
 * The remedy for a revocation made in error is a new award with a new number,
 * which leaves both the revocation and the correction on the record.
 */
export function actionsFor(version: CredentialVersion, role: string): AuthorityAction[] {
  const isAuthority = role === 'superadmin' || role === 'vice-chancellor';
  const base: AuthorityAction[] = ['view', 'verify'];

  if (!isAuthority) {
    // The Registrar prints and emails; they do not amend or revoke.
    if (role === 'registrar') return [...base, 'print', 'email'];
    return base;
  }

  switch (version.state) {
    case 'current':
      return [...base, 'amend', 'reissue', 'revoke', 'print', 'email'];
    case 'superseded':
      // Printing a superseded version is deliberately still allowed: a registry
      // sometimes has to produce the document as it stood. It prints with its
      // superseded marking, which is why it is safe.
      return [...base, 'print'];
    case 'revoked':
      // Nothing further. See above — revocation is final by design.
      return base;
    default:
      return base;
  }
}

export type { CredentialKind };
