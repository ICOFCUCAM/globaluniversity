// ---------------------------------------------------------------------------
// The admissions pipeline.
//
// The university set out how an application actually moves through the
// institution, and it is a two-desk process with a hard gate between the
// desks:
//
//   1. The applicant completes the public application form and pays the
//      application fee. No account exists yet.
//   2. Finance registers the payment. The record is RED until the fee is
//      confirmed and BLUE once it is. Only Finance can turn it blue.
//   3. Turning blue is what makes the record visible to the Office of the
//      Registrar. Before that the Registrar does not see it at all.
//   4. The Registrar examines the application and either approves or declines
//      it. Approval creates the student's account in the management system on
//      the programme they chose at application, and sends them a tailored
//      email carrying their login details and a welcome into that programme.
//
// TWO CONSEQUENCES THIS FILE ENFORCES.
//
// A. A STUDENT CANNOT CREATE THEIR OWN ACCOUNT. Accounts exist only because a
//    Registrar approved an application. Self-signup on the portal is therefore
//    removed, not hidden: an account created by the applicant would bypass
//    both the fee gate and the Registrar's examination, which is the whole
//    control this process exists to apply.
//
// B. THE FEE GATE IS A VISIBILITY GATE, NOT A BADGE. `registrarQueue` filters
//    on `fee_paid`, so an unpaid application is not merely marked differently
//    in the Registrar's list — it is absent from it. Doing this any other way
//    would leave the Registrar able to approve an applicant who has not paid.
// ---------------------------------------------------------------------------

import { supabase } from './supabase';
import type { Student } from './types';

/**
 * Where an application has reached. Stored in `students.status` so the
 * existing Student Management view continues to work unchanged.
 */
export type AdmissionStage =
  | 'applicant' // submitted, payment not yet verified — RED
  | 'fee_paid' // Finance verified the payment — BLUE, visible to the Registrar
  | 'documents_required' // Registrar asked for more documents; back with the applicant
  | 'approved' // Registrar approved; account created and credentials sent
  | 'declined' // Registrar rejected
  | 'active'; // enrolled and studying

/**
 * Payment status is tracked separately from application status because the two
 * genuinely differ: an application can be rejected on academic grounds with the
 * fee correctly paid, and it must still be possible to see that the money was
 * received. Collapsing them would lose that.
 */
export type PaymentStatus = 'pending' | 'verified' | 'refunded';

export interface StageMeta {
  label: string;
  /** What the record looks like in a list. Red and blue are the university's
   *  own terms for unpaid and paid, so they are used literally. */
  tone: 'red' | 'blue' | 'amber' | 'green' | 'grey';
  description: string;
  /** Who may move a record OUT of this stage. */
  actionableBy: 'finance' | 'registrar' | null;
}

export const stages: Record<AdmissionStage, StageMeta> = {
  applicant: {
    label: 'Awaiting fee',
    tone: 'red',
    description:
      'The application has been submitted but the application fee has not been registered. Not visible to the Office of the Registrar.',
    actionableBy: 'finance',
  },
  fee_paid: {
    label: 'Fee paid',
    tone: 'blue',
    description:
      'Finance has confirmed the application fee. The record is now with the Office of the Registrar for examination.',
    actionableBy: 'registrar',
  },
  approved: {
    label: 'Approved',
    tone: 'green',
    description:
      'The Registrar has approved the application. An account has been created on the chosen programme and the credentials emailed to the applicant.',
    actionableBy: null,
  },
  declined: {
    label: 'Declined',
    tone: 'grey',
    description: 'The Registrar declined the application. No account was created.',
    actionableBy: null,
  },
  documents_required: {
    label: 'Documents required',
    tone: 'amber',
    description:
      'The Registrar has asked the applicant for further documents. The record returns for examination once they are uploaded.',
    actionableBy: 'registrar',
  },
  active: {
    label: 'Active student',
    tone: 'green',
    description: 'Registered and studying.',
    actionableBy: null,
  },
};

export function stageOf(student: Pick<Student, 'status'>): AdmissionStage {
  const s = (student.status ?? '').toLowerCase();
  return (s in stages ? s : 'applicant') as AdmissionStage;
}

/** Tailwind classes for a stage chip, keyed by the university's own colours. */
export const stageChipClass: Record<StageMeta['tone'], string> = {
  red: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  grey: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
};

// --- Queues ----------------------------------------------------------------

/** Finance desk: everything waiting for the fee to be registered. */
export async function financeQueue(): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('status', 'applicant')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Student[];
}

/**
 * Registrar desk: only applications Finance has turned blue.
 *
 * This filter IS the gate. An application still red does not appear here, so
 * the Registrar cannot approve an applicant whose fee has not been registered
 * even by mistake.
 */
export async function registrarQueue(): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .in('status', ['fee_paid', 'documents_required'])
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Student[];
}

/**
 * Registrar's third option: ask for more documents. The record stays with the
 * Registrar's queue rather than disappearing, so an applicant who never
 * responds is visible rather than silently lost.
 */
export async function requestDocuments(
  studentId: string,
  opts: { message: string; byUserId: string },
): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({
      status: 'documents_required',
      decision_reason: opts.message,
      decided_by: opts.byUserId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', studentId)
    .in('status', ['fee_paid', 'documents_required']);
  if (error) throw new Error(error.message);
}

/** Everything the two desks have already dealt with, newest first. */
export async function processedApplications(): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .in('status', ['approved', 'declined'])
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Student[];
}

// --- Transitions -----------------------------------------------------------

/**
 * Finance confirms the application fee: red becomes blue.
 *
 * The guard on `status` is deliberate. Without it a stale browser tab could
 * re-run this against a record the Registrar has already approved and drag it
 * back into the queue.
 */
export async function registerFeePayment(
  studentId: string,
  opts: { reference: string; amount: string; currency: string; byUserId: string },
): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({
      status: 'fee_paid',
      payment_status: 'verified',
      fee_currency: opts.currency,
      fee_reference: opts.reference,
      fee_amount: opts.amount,
      fee_registered_by: opts.byUserId,
      fee_registered_at: new Date().toISOString(),
    })
    .eq('id', studentId)
    .eq('status', 'applicant');
  if (error) throw new Error(error.message);
}

/**
 * Registrar declines an application. A reason is required — a declined
 * applicant who is told nothing has no route to fix and reapply.
 */
export async function declineApplication(
  studentId: string,
  opts: { reason: string; byUserId: string },
): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({
      status: 'declined',
      decision_reason: opts.reason,
      decided_by: opts.byUserId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', studentId)
    .in('status', ['fee_paid', 'documents_required']);
  if (error) throw new Error(error.message);
}

/** Registrar defers admission to a later intake. */
export async function deferAdmission(
  studentId: string,
  opts: { reason: string; byUserId: string },
): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({
      status: 'deferred',
      decision_reason: opts.reason,
      decided_by: opts.byUserId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', studentId)
    .in('status', ['fee_paid', 'documents_required']);
  if (error) throw new Error(error.message);
}

/**
 * Registrar moves an applicant to a different programme before admitting them.
 * The record stays in the queue: changing the programme is not a decision on
 * the application, and the Registrar must still approve or reject it.
 */
export async function transferProgramme(
  studentId: string,
  opts: { programme: string; degreeType?: string; byUserId: string },
): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({
      program: opts.programme,
      ...(opts.degreeType ? { degree_type: opts.degreeType } : {}),
      decision_reason: `Programme changed to ${opts.programme} by the Registrar before admission.`,
      decided_by: opts.byUserId,
    })
    .eq('id', studentId)
    .in('status', ['fee_paid', 'documents_required']);
  if (error) throw new Error(error.message);
}

/**
 * Registrar approves. This is the only route by which a student account comes
 * into existence, so it runs server-side: creating an auth user requires the
 * service-role key, which must never reach the browser, and the welcome email
 * carries a password that must not be generated client-side either.
 */
export async function approveApplication(
  studentId: string,
  opts: {
    byUserId: string;
    note?: string;
    /**
     * Conditions attached to a conditional admission. The student is admitted
     * either way; passing conditions records them against the master record so
     * they stay enforceable, rather than living in an email nobody can act on.
     */
    conditions?: { requirement: string; dueBy: string }[];
  },
): Promise<{ ok: boolean; error?: string; email?: string }> {
  const res = await fetch('/api/admissions/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, ...opts }),
  });
  const json = await res.json().catch(() => ({ ok: false, error: 'bad-response' }));
  return json as { ok: boolean; error?: string; email?: string };
}

/**
 * Columns this pipeline adds to `students`. Kept here so the migration and the
 * code that depends on it cannot drift apart — see docs/ADMISSIONS-PIPELINE.md
 * for the SQL, which must be run before the two desks will work.
 */
export const requiredColumns = [
  "payment_status text default 'pending'",
  'fee_currency text',
  'student_number text',
  'fee_reference text',
  'fee_amount text',
  'fee_registered_by uuid',
  'fee_registered_at timestamptz',
  'decision_reason text',
  'decided_by uuid',
  'decided_at timestamptz',
  'account_created_at timestamptz',
  'admission_conditions jsonb',
] as const;
