// ---------------------------------------------------------------------------
// Is this student entitled to the award?
//
// WHAT WAS THERE BEFORE. The Certificate Generator printed the word "Eligible"
// beside a check that computed nothing, next to a hard-coded 'Bachelor of
// Science' at a university that does not teach one. The credit requirement was
// the number 111, typed into a component — the Bachelor of Theology is 180, so
// it was wrong as well as fixed, and it was compared against a credit total the
// screen had counted from whatever results happened to be loaded.
//
// A registrar looking at that screen was told a graduation decision had been
// made. None had.
//
// WHAT A GRADUATION DECISION ACTUALLY REQUIRES. Four things, and all four have
// to hold:
//
//   1. Credits earned meet the requirement for THAT award — not a number in a
//      component, the one on the award record.
//   2. The cumulative GPA meets the award's minimum.
//   3. No admission condition is outstanding. A conditional offer that was
//      never satisfied means the student was never fully admitted, and
//      conferring a degree on them would ratify the gap rather than close it.
//   4. Fees are cleared. The university's own regulations say a graduating
//      student with an outstanding balance has transcripts, diplomas and
//      degrees held until it is paid.
//
// EVERY ANSWER CARRIES ITS REASONS. A refusal that says "not eligible" tells a
// registrar to go and find out why, which is the work this function exists to
// do. Each check returns what was required, what was found, and what to do —
// so the screen can show a graduate exactly what is outstanding rather than a
// red word.
//
// WHAT THIS DOES NOT DECIDE. Whether the Senate has resolved to confer. That is
// a meeting, not a computation, and no query stands in for it — this establishes
// that a candidate QUALIFIES, and a human still confers.
// ---------------------------------------------------------------------------

export interface AwardRule {
  id: string;
  code: string;
  title: string;
  kind: string;
  creditsRequired: number;
  minCgpa: number;
  /** False when the minimum is the system's default rather than the Senate's. */
  cgpaConfirmed: boolean;
}

export interface GraduationInput {
  award: AwardRule | null;
  /** Credits earned on passed courses only. A failed course earns none. */
  creditsEarned: number;
  cgpa: number | null;
  /** Admission conditions still outstanding, if the offer was conditional. */
  outstandingConditions: { requirement: string; dueBy?: string }[];
  /** Null when the finance record could not be read — not the same as zero. */
  feeBalance: number | null;
  feeCurrency?: string | null;
  status: string;
}

export type CheckState = 'met' | 'unmet' | 'unknown';

export interface Check {
  id: string;
  label: string;
  state: CheckState;
  /** What the rule requires, in words. */
  required: string;
  /** What the record shows. */
  found: string;
  /** What to do when it is not met. Empty when it is. */
  remedy?: string;
}

export interface GraduationVerdict {
  /** True only when every check is 'met'. `unknown` never counts as met. */
  qualifies: boolean;
  checks: Check[];
  /** Set when something could not be established rather than failed. */
  indeterminate: boolean;
  summary: string;
}

export function assessGraduation(input: GraduationInput): GraduationVerdict {
  const checks: Check[] = [];

  // --- The award itself ----------------------------------------------------
  if (!input.award) {
    checks.push({
      id: 'award',
      label: 'Award',
      state: 'unknown',
      required: 'The student must be reading for a named award',
      found: 'No award is linked to this record',
      remedy:
        'Link the student to an award before issuing. Without one there is no credit ' +
        'requirement to measure against and no title to print — the certificate would state ' +
        'whatever was typed into it.',
    });
    return {
      qualifies: false,
      checks,
      indeterminate: true,
      summary: 'No award is linked to this record, so nothing can be assessed.',
    };
  }

  // --- 1. Credits ----------------------------------------------------------
  checks.push({
    id: 'credits',
    label: 'Credits',
    state: input.creditsEarned >= input.award.creditsRequired ? 'met' : 'unmet',
    required: `${input.award.creditsRequired} credits for the ${input.award.title}`,
    found: `${input.creditsEarned} earned`,
    remedy: input.creditsEarned >= input.award.creditsRequired
      ? undefined
      : `${input.award.creditsRequired - input.creditsEarned} credits short. Only passed ` +
        'courses count; a failed course earns none.',
  });

  // --- 2. Cumulative GPA ---------------------------------------------------
  if (input.cgpa === null || !Number.isFinite(input.cgpa)) {
    checks.push({
      id: 'cgpa',
      label: 'Cumulative GPA',
      state: 'unknown',
      required: `At least ${input.award.minCgpa.toFixed(2)}`,
      found: 'No cumulative GPA on record',
      remedy: 'Post the outstanding results and recompute the GPA. A certificate states a class ' +
        'of award, and the class is derived from this figure.',
    });
  } else {
    checks.push({
      id: 'cgpa',
      label: 'Cumulative GPA',
      state: input.cgpa >= input.award.minCgpa ? 'met' : 'unmet',
      required: input.award.cgpaConfirmed
        ? `At least ${input.award.minCgpa.toFixed(2)}`
        : `At least ${input.award.minCgpa.toFixed(2)} — provisional, not yet set by the Senate`,
      found: input.cgpa.toFixed(2),
      remedy: input.cgpa >= input.award.minCgpa
        ? undefined
        : 'Below the minimum for this award. A degree cannot be conferred on it.',
    });
  }

  // --- 3. Admission conditions --------------------------------------------
  checks.push({
    id: 'conditions',
    label: 'Admission conditions',
    state: input.outstandingConditions.length === 0 ? 'met' : 'unmet',
    required: 'No outstanding condition of admission',
    found: input.outstandingConditions.length === 0
      ? 'None outstanding'
      : input.outstandingConditions.map((c) => c.requirement).join('; '),
    remedy: input.outstandingConditions.length === 0
      ? undefined
      : 'A conditional offer that was never satisfied means the student was never fully ' +
        'admitted. Conferring a degree would ratify that gap rather than close it — clear the ' +
        'condition or refer the case.',
  });

  // --- 4. Fees -------------------------------------------------------------
  if (input.feeBalance === null) {
    checks.push({
      id: 'fees',
      label: 'Fees',
      state: 'unknown',
      required: 'No outstanding balance',
      found: 'The finance record could not be read',
      remedy: 'Not the same as a zero balance. Check with the Finance Office before issuing.',
    });
  } else {
    const owed = input.feeBalance > 0;
    checks.push({
      id: 'fees',
      label: 'Fees',
      state: owed ? 'unmet' : 'met',
      required: 'No outstanding balance',
      found: owed
        ? `${input.feeCurrency ?? 'USD'} ${input.feeBalance.toFixed(2)} outstanding`
        : 'Cleared',
      remedy: owed
        ? 'The university’s regulations hold transcripts, diplomas and degrees until fees are ' +
          'paid in full.'
        : undefined,
    });
  }

  const unmet = checks.filter((c) => c.state === 'unmet');
  const unknown = checks.filter((c) => c.state === 'unknown');
  const qualifies = unmet.length === 0 && unknown.length === 0;

  return {
    qualifies,
    checks,
    indeterminate: unknown.length > 0,
    summary: qualifies
      ? `Qualifies for the ${input.award.title}. The Senate confers; this establishes only that ` +
        'the candidate meets the requirements.'
      : unmet.length > 0
        ? `Does not qualify: ${unmet.map((c) => c.label.toLowerCase()).join(', ')}.`
        : `Cannot be determined: ${unknown.map((c) => c.label.toLowerCase()).join(', ')} could ` +
          'not be established. That is not the same as a refusal.',
  };
}
