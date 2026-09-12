'use client';

// ---------------------------------------------------------------------------
// ACADEMIC AFFAIRS — ADMISSIONS APPROVAL.
//
// The desk of the Head of Academic Affairs, which did not exist. That office
// held 'admit-student' and its signature is printed on page 1 of every
// admission letter, and the navigation put it on none of the three admissions
// screens: the capability was granted and the door was not built.
//
// ---------------------------------------------------------------------------
// WHAT THIS SCREEN IS NOT
// ---------------------------------------------------------------------------
//
// It is not the Admissions Office's screen with an extra button. That office
// verifies documents, chases what is missing and assesses eligibility; this one
// takes the academic decision and nothing else. Putting both on one screen
// would offer the verification controls to the deciding office and the decision
// to the verifying one, which is the separation the pipeline exists to keep.
//
// There are no Finance controls here either. Finance confirms the fee — it is a
// GATE the application must pass, not an authority over the academic decision —
// so this screen reads the fee state and cannot change it.
//
// ---------------------------------------------------------------------------
// WHY THE BUTTON SAYS "APPROVE & ISSUE ADMISSION"
// ---------------------------------------------------------------------------
//
// Because that is what it does. Pressing it records an immutable decision,
// generates the signed admission package, reserves a student number, creates
// the account, and emails the applicant. "Approve" understates an action with
// six consequences, and a control that understates itself is pressed by people
// who have not decided yet.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { courses, MODE_LABEL } from '@/content/courses';
import {
  ACADEMIC_DECISIONS, DECISION_CHECKS, canDecide, canRetryIssuance, ISSUANCE_STEPS,
  statesForDesk, RETURN_TARGETS, issuanceProgress,
  type AcademicDecision, type DecisionRefusal, type ReturnTarget,
} from '@/lib/admissionWorkflow';
import { stages, stageOf, stageChipClass } from '@/lib/admissions';
import {
  Card, CardHeader, Figure, EmptyState, Skeleton, PageHeader,
  TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, INPUT, LABEL, FOCUS, TEXT } from '@/lib/portalTheme';
import type { UserRole } from '@/lib/types';
import {
  GraduationCap, ShieldCheck, AlertTriangle, Loader2, CheckCircle2, Inbox, FileText,
} from 'lucide-react';

interface Application {
  id: string;
  first_name: string | null;
  middle_name?: string | null;
  last_name: string | null;
  email: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  matric_no: string | null;
  student_number?: string | null;
  auth_user_id?: string | null;
  program: string | null;
  degree_type: string | null;
  faculty: string | null;
  campus: string | null;
  mode?: string | null;
  attendance?: string | null;
  status: string | null;
  intake: string | null;
  admission_year?: string | number | null;
  payment_status?: string | null;
  fee_amount?: string | null;
  fee_currency?: string | null;
  fee_reference?: string | null;
  fee_registered_at: string | null;
  created_at: string | null;
  decided_at?: string | null;
  decision_reason?: string | null;
  /** The Admissions Office's recommendation, which is not a decision. */
  academic_recommendation?: string | null;
  returned_to?: string | null;
  returned_reason?: string | null;
  returned_at?: string | null;
  reopened_reason?: string | null;
  reopened_at?: string | null;
  reopened_from?: string | null;
}

/** One line of the trail, as the desk reads it. */
interface HistoryEntry {
  id: string;
  event: string;
  detail: string | null;
  actor_office: string | null;
  actor_email: string | null;
  metadata: Record<string, unknown> | null;
  /** The trail's own column is `at`, not `created_at`. */
  at: string | null;
}

interface UploadedDocument {
  id: string;
  file_name: string;
  document_type: string | null;
  verified: boolean;
  uploaded_at: string | null;
}

// Module-level: naming it inside the component would rebuild `load` on every
// render, and `load` is a useEffect dependency.
//
// ONE LITERAL, NOT A CONCATENATION. supabase-js infers the row type from the
// column list as a string LITERAL type; splitting it over two lines with `+`
// widens it to `string` and the query silently returns GenericStringError[]
// instead of the row shape. It fails the build rather than at runtime, which is
// the good outcome, but the reason is not obvious from the error.
// eslint-disable-next-line max-len
const COLUMNS = 'id, first_name, middle_name, last_name, email, phone, date_of_birth, gender, nationality, matric_no, student_number, auth_user_id, program, degree_type, faculty, campus, mode, attendance, status, intake, admission_year, payment_status, fee_amount, fee_currency, fee_reference, fee_registered_at, created_at, decided_at, decision_reason, academic_recommendation, returned_to, returned_reason, returned_at, reopened_reason, reopened_at, reopened_from';

/** One line of the dossier. Omitted entirely when there is nothing to say —
 *  an official record showing "Nationality: —" invites the question of what
 *  else is missing. */
function Fact({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v || !String(v).trim()) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-[#8a8194]">{k}</dt>
      <dd className="text-[#33234a] dark:text-[#e4dcf0]">{v}</dd>
    </div>
  );
}

/** The decision the desk is composing, before it is sent. */
interface Draft {
  decision: AcademicDecision;
  reason: string;
  overrideReason: string;
  /** Which office a return goes back to. Only meaningful on a return. */
  returnTo?: ReturnTarget;
}

export default function AcademicAdmissions({ role }: { role?: UserRole }) {
  const [rows, setRows] = useState<Application[] | null>(null);
  const [decided, setDecided] = useState<Application[] | null>(null);
  // Resending resets the applicant's password, so it is confirmed rather than
  // done on one click. The old one stops working the moment it happens.
  const [resending, setResending] = useState<Application | null>(null);
  const [reachable, setReachable] = useState(true);
  const [open, setOpen] = useState<Application | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  // The confirmation stands between the button and the six consequences. It is
  // not ceremony: the action reserves a number, creates an account and issues a
  // signed document, and none of that is undoable by pressing something else.
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  // THE DOSSIER. Fetched when an application is opened rather than with the
  // queue: a hundred rows each carrying their whole history is a great deal of
  // data to draw a five-column table with.
  // Re-evaluation is confirmed and needs a written reason, like an override.
  // A decision put back on the desk without one is indistinguishable from one
  // somebody simply disagreed with.
  const [reopening, setReopening] = useState<Application | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[] | null>(null);

  // The Superadministrator acting here is exercising another office's
  // authority, and the University asked that this be highly visible. It is
  // labelled as an override on screen, recorded as one in the database, and
  // refused without a written reason.
  const isOverride = role === 'superadmin';

  const load = useCallback(async () => {
    const [queue, settled] = await Promise.all([
      supabase
        .from('students')
        .select(COLUMNS)
        .in('status', statesForDesk('academic'))
        .order('fee_registered_at', { ascending: true, nullsFirst: false })
        .limit(100),
      // WHAT THIS DESK HAS ALREADY DECIDED. Its absence is the defect: the
      // Head of Academic Affairs pressed a button and the application left the
      // screen with no way to confirm what had happened to it.
      supabase
        .from('students')
        .select(COLUMNS)
        .in('status', statesForDesk('academic-decided'))
        .order('decided_at', { ascending: false, nullsFirst: false })
        .limit(50),
    ]);
    setReachable(!queue.error && !settled.error);
    setRows(queue.data ?? []);
    setDecided(settled.data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---------------------------------------------------------------------
  // WHAT THIS DESK IS ALLOWED TO SEE, AND ONLY SEE.
  //
  // The complete dossier: who applied, what Finance cleared, what the
  // Registrar verified, what the Admissions Office recommended, which
  // documents arrived, and everything that has happened to the application.
  //
  // READ-ONLY, DELIBERATELY. This screen carries no control that could alter
  // any of it. The fee is Finance's, the verification is the Registrar's, the
  // assessment is the Admissions Office's — this desk decides on what they
  // produced and can return it to them, which is the whole separation.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!open) { setHistory(null); setDocuments(null); return; }
    let cancelled = false;
    void (async () => {
      const [trail, docs] = await Promise.all([
        supabase
          .from('admission_audit_log')
          .select('id, event, detail, actor_office, actor_email, metadata, at')
          .eq('application_id', open.id)
          .order('at', { ascending: true }),
        supabase
          .from('documents')
          .select('id, file_name, document_type, verified, uploaded_at')
          .eq('student_id', open.id)
          .order('uploaded_at', { ascending: true }),
      ]);
      if (cancelled) return;
      // An empty array and a refused read are different things, and the panel
      // says which: null means it could not be read, [] means there are none.
      setHistory(trail.error ? null : ((trail.data ?? []) as HistoryEntry[]));
      setDocuments(docs.error ? null : ((docs.data ?? []) as UploadedDocument[]));
    })();
    return () => { cancelled = true; };
  }, [open]);

  const programmeOf = (a: Application) =>
    courses.find(
      (c) => c.title.toLowerCase() === String(a.program ?? '').toLowerCase()
        || c.code.toLowerCase() === String(a.program ?? '').toLowerCase(),
    );

  const counts = useMemo(() => {
    const r = rows ?? [];
    return {
      pending: r.filter((a) => canDecide(a.status)).length,
      awaitingDocuments: r.filter((a) => a.status === 'documents_required').length,
      reevaluating: r.filter((a) => a.reopened_at).length,
    };
  }, [rows]);

  // ---------------------------------------------------------------------
  // A REOPENED APPLICATION IS NOT A NEW ONE, and mixing them would hide the
  // difference that matters: this one has been decided before, and the reader
  // needs to know that before they read the file rather than after.
  // ---------------------------------------------------------------------
  const fresh = (rows ?? []).filter((a) => !a.reopened_at);
  const reevaluating = (rows ?? []).filter((a) => a.reopened_at);

  /** Retry the issuance for a row in the queue, without opening the detail. */
  async function submitFor(a: Application) {
    await submit(true, a);
  }

  async function submit(retry = false, target?: Application) {
    // `open` is set by the caller in the same tick, so a retry launched from a
    // table row cannot rely on it having been applied yet.
    const subject = target ?? open;
    if (!subject || (!draft && !retry)) return;
    setBusy(true);
    setConfirming(false);
    setResult(null);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;

    const res = await fetch('/api/admissions/decision', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      // THE BROWSER ASKS; IT DOES NOT DECIDE. Nothing here names the approver,
      // the role, the student number or the resulting status — the server reads
      // the caller from the token, re-reads the application, re-checks the
      // programme gate, and determines every one of those itself.
      body: JSON.stringify({
        applicationId: subject.id,
        decision: draft?.decision ?? 'approve',
        reason: draft?.reason.trim() || undefined,
        returnTo: draft?.decision === 'return' ? draft.returnTo : undefined,
        overrideReason: isOverride ? draft?.overrideReason.trim() : undefined,
        retry: retry || undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!json?.ok) {
      // An ISSUANCE that failed is not a refusal — the decision stands and the
      // record says so. Say which step stopped, and that it can be retried.
      if (json?.error === 'issuance-failed') {
        setResult({
          tone: 'bad',
          text: `The decision is recorded, but the University could not ${json.step}: ${json.detail}. `
            + 'The application is marked "Issuance failed" and can be retried from this queue — '
            + 'nothing needs to be corrected by hand.',
        });
        load();
        return;
      }
      // Otherwise the server's refusal, in the words the workflow module holds,
      // so the screen and the route cannot explain it differently.
      const known = DECISION_CHECKS[json?.error as DecisionRefusal];
      setResult({ tone: 'bad', text: known ?? `The decision was refused: ${json?.error ?? 'unknown'}` });
      load();
      return;
    }

    const label = draft ? ACADEMIC_DECISIONS[draft.decision].label : 'Issuance';
    setResult({
      tone: 'ok',
      text: json.emailSent === false
        ? `Recorded. The admission package could not be emailed — student number ${json.studentNumber}, temporary password ${json.password}. Pass these on directly.`
        : `${label} recorded${json.studentNumber ? ` — student number ${json.studentNumber}` : ''}.`,
    });
    setOpen(null);
    setDraft(null);
    load();
  }

  /**
   * Open the letter as it was issued.
   *
   * Fetched with the session token and opened from a blob rather than linked
   * to directly: the route is guarded, and a plain <a href> carries no
   * authorization header, so the link would simply refuse.
   */
  async function viewLetter(a: Application) {
    setResult(null);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch(`/api/admissions/letter?applicationId=${encodeURIComponent(a.id)}`, {
      headers: { authorization: `Bearer ${sess.session?.access_token ?? ''}` },
    }).catch(() => null);
    if (!res?.ok) {
      const json = await res?.json().catch(() => null);
      setResult({ tone: 'bad', text: json?.detail ?? 'The letter could not be opened.' });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    // Released once the new tab has taken it. Revoking immediately would open
    // a blank page.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function resendLetter(a: Application) {
    setBusy(true);
    setResending(null);
    setResult(null);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch('/api/admissions/letter', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sess.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ applicationId: a.id }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);

    if (!json?.ok) {
      setResult({
        tone: 'bad',
        text: json?.password
          // THE PASSWORD HAS ALREADY CHANGED BY THIS POINT. Withholding it
          // because the email failed would leave the student locked out of an
          // account whose new password nobody knows.
          ? `The password was reset but the email did not go (${json.detail}). Pass these on `
            + `directly — ${json.email}, temporary password ${json.password}.`
          : json?.detail ?? 'The letter was not resent.',
      });
      return;
    }
    setResult({
      tone: 'ok',
      text: `The admission package was sent again to ${json.email}`
        + (json.passwordReset ? ', with a new temporary password. The previous one no longer works.' : '.'),
    });
  }

  // A RETURN WITHOUT AN OFFICE IS REFUSED BY THE SERVER, so the button says so
  // before it is pressed rather than after.
  const returnWithoutOffice = !!draft && draft.decision === 'return' && !draft.returnTo;

  async function reopen(a: Application) {
    setBusy(true);
    setResult(null);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch('/api/admissions/reopen', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sess.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ applicationId: a.id, reason: reopenReason.trim() }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    if (!json?.ok) {
      setResult({
        tone: 'bad',
        text: DECISION_CHECKS[json?.error as DecisionRefusal]
          ?? json?.detail ?? 'The application was not reopened.',
      });
      return;
    }
    setReopening(null);
    setReopenReason('');
    setResult({
      tone: 'ok',
      text: json.hadBeenIssued
        // THE PART THAT MUST NOT BE LEFT IMPLICIT. Reopening withdraws
        // nothing: the applicant has been told they are admitted and still
        // has been.
        ? 'Back on the desk for re-evaluation. Nothing has been withdrawn — the letter stands, '
          + 'the account still works, and the applicant has been told they are admitted. If the '
          + 'new decision differs, somebody has to tell them.'
        : 'Back on the desk for re-evaluation. The decision already taken is unchanged and stays '
          + 'on the record.',
    });
    load();
  }

  const overrideTooShort = isOverride && draft
    && ['approve', 'conditional'].includes(draft.decision)
    && draft.overrideReason.trim().length < 20;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admissions approval"
        subtitle="The academic decision. Verification is the Admissions Office's; the fee is Finance's; this desk decides."
      />

      {!reachable && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>The applications could not be read.</strong> The queue below is empty because
          nothing could be fetched, not because there is nothing waiting.
        </div>
      )}

      {isOverride && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" />
          <p>
            <strong>You are acting under administrative override.</strong> This decision belongs to
            the Head of Academic Affairs. Anything you record here is stored as an override, against
            your name, with the reason you give — and the reason is required.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {rows === null ? (
          Array.from({ length: 2 }, (_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-7 w-16" /></Card>
          ))
        ) : (
          <>
            <Figure label="Awaiting your decision" value={counts.pending.toLocaleString()}
              hint="Verified and paid" icon={<Inbox size={16} />}
              tone={counts.pending === 0 ? 'muted' : 'neutral'} />
            <Figure label="Awaiting the applicant" value={counts.awaitingDocuments.toLocaleString()}
              hint="Documents requested" icon={<FileText size={16} />}
              tone={counts.awaitingDocuments === 0 ? 'muted' : 'neutral'} />
            <Figure label="Being looked at again" value={counts.reevaluating.toLocaleString()}
              hint="Decided before" icon={<AlertTriangle size={16} />}
              tone={counts.reevaluating === 0 ? 'muted' : 'neutral'} />
          </>
        )}
      </div>

      {result && (
        <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
          result.tone === 'ok'
            ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border border-red-200 bg-red-50 text-red-800'
        }`}>
          {result.tone === 'ok' ? <CheckCircle2 size={16} className="mt-0.5" /> : <AlertTriangle size={16} className="mt-0.5" />}
          <p>{result.text}</p>
        </div>
      )}

      <Card>
        <CardHeader title="Applications awaiting decision" subtitle="Longest wait first" />
        {rows === null ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : fresh.length === 0 ? (
          <EmptyState
            icon={<GraduationCap size={22} />}
            title="Nothing is waiting"
            description="An application appears here once the Admissions Office has verified it and forwarded it with a recommendation."
          />
        ) : (
          <TableShell>
            <THead>
              <tr>
                <Th>Applicant</Th><Th>Programme</Th><Th>Delivery</Th>
                <Th>Fee</Th><Th>Stage</Th><Th align="right">Action</Th>
              </tr>
            </THead>
            <TBody>
              {fresh.map((a) => {
                const p = programmeOf(a);
                return (
                  <tr key={a.id}>
                    <Td>
                      <span className="font-medium">{[a.first_name, a.last_name].filter(Boolean).join(' ') || '—'}</span>
                      <span className="block text-[11px] text-[#a49bb0]">{a.matric_no}</span>
                    </Td>
                    <Td>{a.program ?? '—'}</Td>
                    {/* The approved delivery mode, from the catalogue. */}
                    <Td>{p ? MODE_LABEL[p.mode] : '—'}</Td>
                    <Td>{a.fee_registered_at ? 'Confirmed' : 'Not confirmed'}</Td>
                    <Td>{a.status}</Td>
                    <Td align="right">
                      {/* AN ISSUANCE THAT STOPPED PART WAY IS RETRIED, NOT
                          RE-DECIDED. The decision was validly taken and is
                          immutable; this resumes underneath it. Before the
                          issuance states existed these applications sat in
                          `approved`, off this queue, and the only way back was
                          editing rows in the SQL editor. */}
                      {canRetryIssuance(a.status) ? (
                        <button
                          onClick={() => { setOpen(a); setDraft(null); setResult(null); submitFor(a); }}
                          disabled={busy}
                          className={`${BTN_PRIMARY} px-3 py-1.5 text-xs`}
                        >
                          Retry issuance
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setOpen(a);
                            setDraft({ decision: 'approve', reason: '', overrideReason: '' });
                            setResult(null);
                          }}
                          className={`${BTN_SECONDARY} px-3 py-1.5 text-xs`}
                        >
                          Review
                        </button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </TableShell>
        )}
      </Card>

      {/* ------------------------------------------------------------------
          RE-EVALUATION. Separate from the ordinary queue on purpose: these
          have been decided before, and the reader needs to know that before
          they open the file rather than after. Each carries what it was
          reopened from and why.
          ------------------------------------------------------------------ */}
      {reevaluating.length > 0 && (
        <Card>
          <CardHeader
            title="Being looked at again"
            subtitle="Decided before, and put back on this desk with a reason"
          />
          <TableShell>
            <THead>
              <tr>
                <Th>Applicant</Th><Th>Programme</Th><Th>Was</Th>
                <Th>Why it is back</Th><Th align="right">Action</Th>
              </tr>
            </THead>
            <TBody>
              {reevaluating.map((a) => (
                <tr key={a.id}>
                  <Td>
                    <span className="font-medium">{[a.first_name, a.last_name].filter(Boolean).join(' ') || '—'}</span>
                    <span className="block text-[11px] text-[#a49bb0]">{a.matric_no}</span>
                  </Td>
                  <Td>{a.program ?? '—'}</Td>
                  <Td>
                    {/* WHAT IT WAS REOPENED FROM. Reopening a rejection and
                        reopening an issued admission are different acts — in
                        the second the applicant has already been told. */}
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      stageChipClass[stages[(a.reopened_from ?? 'unknown') as keyof typeof stages]?.tone ?? 'grey']
                    }`}>
                      {stages[(a.reopened_from ?? 'unknown') as keyof typeof stages]?.label ?? a.reopened_from}
                    </span>
                  </Td>
                  <Td>
                    <span className="block max-w-md leading-relaxed">{a.reopened_reason ?? '—'}</span>
                  </Td>
                  <Td align="right">
                    <button
                      onClick={() => {
                        setOpen(a);
                        setDraft({ decision: 'approve', reason: '', overrideReason: '' });
                        setResult(null);
                      }}
                      className={`${BTN_SECONDARY} px-3 py-1.5 text-xs`}
                    >
                      Review again
                    </button>
                  </Td>
                </tr>
              ))}
            </TBody>
          </TableShell>
        </Card>
      )}

      {/* ------------------------------------------------------------------
          WHAT THIS DESK HAS DECIDED.

          The panel whose absence was the defect. Every outcome this screen can
          produce — issued, rejected, conditional, returned — left the
          application off every queue in the system, so the Head of Academic
          Affairs pressed a button and watched the record disappear with no
          way to confirm what had become of it.
          ------------------------------------------------------------------ */}
      <Card>
        <CardHeader
          title="Decided"
          subtitle="What this desk has already determined, most recent first"
        />
        {decided === null ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : decided.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={22} />}
            title="Nothing decided yet"
            description="Applications you approve, reject, conditionally approve or return appear here."
          />
        ) : (
          <TableShell>
            <THead>
              <tr>
                <Th>Applicant</Th><Th>Programme</Th><Th>Outcome</Th><Th>Decided</Th>
                <Th align="right">Letter</Th>
              </tr>
            </THead>
            <TBody>
              {decided.map((a) => {
                const stage = stages[stageOf(a)];
                return (
                  <tr key={a.id}>
                    <Td>
                      <span className="font-medium">{[a.first_name, a.last_name].filter(Boolean).join(' ') || '—'}</span>
                      <span className="block text-[11px] text-[#a49bb0]">{a.matric_no}</span>
                    </Td>
                    <Td>{a.program ?? '—'}</Td>
                    <Td>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${stageChipClass[stage.tone]}`}>
                        {stage.label}
                      </span>
                    </Td>
                    <Td>
                      {a.decided_at
                        ? new Date(a.decided_at).toLocaleDateString('en-GB',
                          { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </Td>
                    {/* ONLY AN ISSUED ADMISSION HAS A LETTER. A rejection and a
                        return produce no package, so offering the controls for
                        them would be offering something that does not exist. */}
                    <Td align="right">
                      {/* `approved` and `conditional` are the older route's
                          admitted states — it created the account and sent the
                          package, then stopped short of `admission_issued`
                          because that state did not exist yet. Every student
                          admitted before this month is in one of them. */}
                      {['admission_issued', 'enrolled', 'approved', 'conditional']
                        .includes(a.status ?? '') ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => void viewLetter(a)}
                            className={`${BTN_SECONDARY} px-3 py-1.5 text-xs`}
                          >
                            View
                          </button>
                          <button
                            onClick={() => setResending(a)}
                            className={`${BTN_SECONDARY} px-3 py-1.5 text-xs`}
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => { setReopening(a); setReopenReason(''); }}
                            className={`${BTN_SECONDARY} px-3 py-1.5 text-xs`}
                          >
                            Re-evaluate
                          </button>
                        </div>
                      ) : (
                        // A REJECTION AND A RETURN HAVE NO LETTER, but they can
                        // still be looked at again — an appeal upheld is
                        // exactly the case re-evaluation exists for.
                        <button
                          onClick={() => { setReopening(a); setReopenReason(''); }}
                          className={`${BTN_SECONDARY} px-3 py-1.5 text-xs`}
                        >
                          Re-evaluate
                        </button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </TableShell>
        )}
      </Card>

      {/* Resending is confirmed, because it has a consequence the wording of a
          button cannot carry on its own: the applicant's current password
          stops working the moment it happens. */}
      {resending && (
        <Card>
          <CardHeader
            title={`Resend to ${[resending.first_name, resending.last_name].filter(Boolean).join(' ')}`}
            subtitle={resending.email ?? 'no email on this record'}
          />
          <div className="space-y-3 p-5">
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <p>
                The letter goes again exactly as it was issued. A{' '}
                <strong>new temporary password</strong> is set and emailed with it, because the
                original was never stored — so <strong>the password they have now will stop
                working.</strong> If they can already sign in, they do not need this.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void resendLetter(resending)}
                disabled={busy}
                className={BTN_PRIMARY}
              >
                {busy ? 'Sending…' : 'Send it again'}
              </button>
              <button onClick={() => setResending(null)} className={BTN_SECONDARY}>Cancel</button>
            </div>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------------
          RE-EVALUATION. The decision already taken is not edited — it stays on
          the record and whatever is decided next sits beside it. What the
          panel has to say out loud is what reopening does NOT do.
          ------------------------------------------------------------------ */}
      {reopening && (
        <Card>
          <CardHeader
            title={`Look again at ${[reopening.first_name, reopening.last_name].filter(Boolean).join(' ')}`}
            subtitle={`Currently ${stages[stageOf(reopening)].label.toLowerCase()}`}
          />
          <div className="space-y-3 p-5">
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <p>
                This puts the application back on your desk. <strong>The decision already taken is
                not altered</strong> — it stays on the record and whatever you decide next sits
                beside it.
                {(reopening.status === 'admission_issued' || reopening.status === 'enrolled') && (
                  <> <strong>Nothing is withdrawn.</strong> The letter stands, the account still
                  works, and this applicant has already been told they are admitted. If you decide
                  differently, somebody has to tell them.</>
                )}
              </p>
            </div>
            <div>
              <label className={LABEL} htmlFor="reopen-reason">
                Why is it being looked at again? (required, 20 characters)
              </label>
              <textarea
                id="reopen-reason"
                rows={2}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className={`${INPUT} mt-1`}
                placeholder="e.g. The prior award certificate has been reported as forged."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void reopen(reopening)}
                disabled={busy || reopenReason.trim().length < 20}
                className={BTN_PRIMARY}
              >
                {busy ? 'Reopening…' : 'Put it back on the desk'}
              </button>
              <button onClick={() => setReopening(null)} className={BTN_SECONDARY}>Cancel</button>
            </div>
          </div>
        </Card>
      )}

      {/* The decision itself. Deliberately a separate step from the queue: an
          academic decision should not be one click away from a list. */}
      {open && draft && (
        <Card>
          <CardHeader
            title={[open.first_name, open.last_name].filter(Boolean).join(' ') || 'Applicant'}
            subtitle={`${open.program ?? 'No programme named'} · ${programmeOf(open) ? MODE_LABEL[programmeOf(open)!.mode] : 'delivery unknown'} · ${open.campus || 'campus not stated'}`}
            action={
              <button onClick={() => { setOpen(null); setDraft(null); }} className={`${BTN_SECONDARY} px-3 py-1.5 text-xs`}>
                Close
              </button>
            }
          />
          <div className="space-y-4 p-5">
            {/* ------------------------------------------------------------
                THE DOSSIER. Everything the upstream offices produced, and
                nothing this desk can change. The fee is Finance's, the
                verification is the Registrar's, the assessment is the
                Admissions Office's; this desk decides on their work and can
                return it to them.
                ------------------------------------------------------------ */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[#ded6c8] p-4 dark:border-[#3d3349]">
                <p className={LABEL}>Applicant</p>
                <dl className="mt-2 space-y-1 text-xs">
                  <Fact k="Application" v={open.matric_no} />
                  <Fact k="Date of birth" v={open.date_of_birth} />
                  <Fact k="Nationality" v={open.nationality} />
                  <Fact k="Email" v={open.email} />
                  <Fact k="Telephone" v={open.phone} />
                  <Fact k="Applied" v={open.created_at ? new Date(open.created_at).toLocaleDateString('en-GB') : null} />
                </dl>
              </div>

              <div className="rounded-xl border border-[#ded6c8] p-4 dark:border-[#3d3349]">
                <p className={LABEL}>Programme</p>
                <dl className="mt-2 space-y-1 text-xs">
                  <Fact k="Programme" v={[open.degree_type, open.program].filter(Boolean).join(' — ')} />
                  <Fact k="Faculty" v={open.faculty} />
                  <Fact k="Delivery" v={programmeOf(open) ? MODE_LABEL[programmeOf(open)!.mode] : open.mode} />
                  <Fact k="Attendance" v={open.attendance} />
                  <Fact k="Campus" v={open.campus} />
                  <Fact k="Intake" v={open.intake} />
                </dl>
              </div>

              <div className="rounded-xl border border-[#ded6c8] p-4 dark:border-[#3d3349]">
                <p className={LABEL}>Finance — a gate, not an authority</p>
                <dl className="mt-2 space-y-1 text-xs">
                  <Fact k="Fee" v={open.fee_registered_at ? 'Confirmed' : 'Not confirmed'} />
                  <Fact k="Confirmed on" v={open.fee_registered_at ? new Date(open.fee_registered_at).toLocaleDateString('en-GB') : null} />
                  <Fact k="Amount" v={[open.fee_amount, open.fee_currency].filter(Boolean).join(' ')} />
                  <Fact k="Reference" v={open.fee_reference} />
                </dl>
                <p className="mt-2 text-[11px] leading-relaxed text-[#8a8194]">
                  Read only. A discrepancy is returned to Finance; it is not altered here.
                </p>
              </div>

              <div className="rounded-xl border border-[#ded6c8] p-4 dark:border-[#3d3349]">
                <p className={LABEL}>Verification and recommendation</p>
                <dl className="mt-2 space-y-1 text-xs">
                  <Fact k="Registrar's note" v={open.decision_reason} />
                  <Fact k="Admissions Office recommends" v={open.academic_recommendation} />
                  {open.returned_to && (
                    <Fact k="Last returned to" v={`${open.returned_to}${open.returned_reason ? ` — ${open.returned_reason}` : ''}`} />
                  )}
                </dl>
                <p className="mt-2 text-[11px] leading-relaxed text-[#8a8194]">
                  A recommendation, not a decision. This desk is the authority.
                </p>
              </div>
            </div>

            {/* THE DOCUMENTS, listed rather than verified here. */}
            <div>
              <p className={LABEL}>Documents</p>
              {documents === null ? (
                <p className="mt-1 text-xs text-[#8a8194]">They could not be read.</p>
              ) : documents.length === 0 ? (
                <p className="mt-1 text-xs text-[#8a8194]">None uploaded with this application.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-xs">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-2">
                      <FileText size={13} className="shrink-0 text-[#8a8194]" />
                      <span className="text-[#33234a] dark:text-[#e4dcf0]">{d.file_name}</span>
                      {d.document_type && <span className="text-[#8a8194]">· {d.document_type}</span>}
                      <span className={d.verified ? 'text-emerald-700' : 'text-[#8a8194]'}>
                        {d.verified ? '· verified' : '· not verified'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ------------------------------------------------------------
                THE ISSUANCE PIPELINE. Shown once an issuance has been
                attempted, so that a failure says WHERE it stopped rather than
                only that it stopped. Read from the trail and the record — a
                reserved number emits no event, and the email's outcome is only
                in the trail, so neither source alone is complete.
                ------------------------------------------------------------ */}
            {history && history.some((h) => h.event.startsWith('ISSUANCE') || h.event.startsWith('ADMISSION')) && (
              <div>
                <p className={LABEL}>Issuance</p>
                <ol className="mt-2 space-y-1">
                  {issuanceProgress(history, open).map((s) => (
                    <li key={s.step} className="flex items-start gap-2 text-xs">
                      <span className={`mt-[3px] inline-block h-2 w-2 shrink-0 rounded-full ${
                        s.state === 'done' ? 'bg-emerald-500'
                          : s.state === 'failed' ? 'bg-red-500' : 'bg-[#c9c2d2]'
                      }`} />
                      <span>
                        <span className={s.state === 'pending' ? 'text-[#8a8194]' : 'text-[#33234a] dark:text-[#e4dcf0]'}>
                          {s.step}
                        </span>
                        {s.detail && (
                          <span className="mt-0.5 block leading-relaxed text-red-700 dark:text-red-300">
                            {s.detail}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* ------------------------------------------------------------
                EVERYTHING THAT HAS HAPPENED, against the office that did it.
                An audit is not a list of who touched a row; it is a record of
                which authority moved the application, and the office is what
                makes that legible when an account is shared.
                ------------------------------------------------------------ */}
            <div>
              <p className={LABEL}>History</p>
              {history === null ? (
                <p className="mt-1 text-xs text-[#8a8194]">
                  The trail could not be read. It exists from migration 024 onward.
                </p>
              ) : history.length === 0 ? (
                <p className="mt-1 text-xs text-[#8a8194]">
                  Nothing recorded. This application predates the audit trail.
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-xs">
                  {history.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[#8a8194]">
                        {h.at ? new Date(h.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                      <span className="font-medium text-[#33234a] dark:text-[#e4dcf0]">
                        {h.event.toLowerCase().replace(/_/g, ' ')}
                      </span>
                      {h.actor_office && <span className="text-[#8a8194]">· {h.actor_office}</span>}
                      {h.detail && <span className="w-full leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">{h.detail}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className={LABEL}>Academic decision</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(ACADEMIC_DECISIONS) as AcademicDecision[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDraft({ ...draft, decision: d })}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${FOCUS} ${
                      draft.decision === d
                        ? 'bg-[#422e59] text-white'
                        : 'border border-[#ded6c8] bg-white text-[#422e59] hover:bg-[#faf6ee] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]'
                    }`}
                  >
                    {ACADEMIC_DECISIONS[d].label}
                  </button>
                ))}
              </div>
            </div>

            {/* ------------------------------------------------------------
                A RETURN NAMES WHERE IT GOES.

                This desk is the last stage, so a problem found here used to
                have two exits: approve anyway, or reject an applicant who has
                done nothing wrong. An incomplete verification or a fee
                discrepancy is not grounds to refuse somebody a place — it is
                grounds to send the work back to whoever can finish it.
                ------------------------------------------------------------ */}
            {draft.decision === 'return' && (
              <div>
                <p className={LABEL}>Return it to</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {(Object.keys(RETURN_TARGETS) as ReturnTarget[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setDraft({ ...draft, returnTo: t })}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${FOCUS} ${
                        draft.returnTo === t
                          ? 'border-[#422e59] bg-[#422e59] text-white'
                          : 'border-[#ded6c8] bg-white text-[#422e59] hover:bg-[#faf6ee] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]'
                      }`}
                    >
                      <span className="block font-semibold">{RETURN_TARGETS[t].label}</span>
                      <span className={`mt-0.5 block leading-snug ${
                        draft.returnTo === t ? 'text-white/80' : 'text-[#8a8194]'
                      }`}>
                        {RETURN_TARGETS[t].hint}
                      </span>
                    </button>
                  ))}
                </div>
                {!draft.returnTo && (
                  <p className="mt-1 text-[11px] text-[#8a8194]">
                    Choose an office. A return that names nowhere leaves the application sitting
                    with nobody, which is what this replaced.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className={LABEL} htmlFor="decision-reason">
                Reason or comment {draft.decision === 'approve' ? '(optional)' : '(shown to the applicant)'}
              </label>
              <textarea
                id="decision-reason"
                rows={2}
                value={draft.reason}
                onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                className={`${INPUT} mt-1`}
                placeholder="e.g. Applicant satisfies all admission requirements."
              />
            </div>

            {isOverride && ['approve', 'conditional'].includes(draft.decision) && (
              <div>
                <label className={LABEL} htmlFor="override-reason">
                  Why are you deciding this instead of Academic Affairs? (required, 20 characters)
                </label>
                <textarea
                  id="override-reason"
                  rows={2}
                  value={draft.overrideReason}
                  onChange={(e) => setDraft({ ...draft, overrideReason: e.target.value })}
                  className={`${INPUT} mt-1`}
                  placeholder="e.g. Head of Academic Affairs unreachable and the intake closes tomorrow."
                />
              </div>
            )}

            {/* WHAT THE BUTTON WILL DO, before it is pressed. Six consequences
                is too many to leave implied. */}
            {['approve', 'conditional'].includes(draft.decision) && (
              <p className={`text-xs leading-relaxed ${TEXT.muted}`}>
                This records the decision permanently, generates the signed admission letter and its
                annexes, reserves a student number, creates the student&apos;s account, and emails
                the package to {open.email ?? 'the applicant'}.
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-[#f0ece4] pt-4 dark:border-[#2a2333]">
              <button
                onClick={() => (
                  ['approve', 'conditional'].includes(draft.decision) ? setConfirming(true) : submit()
                )}
                disabled={busy || !!overrideTooShort}
                className={draft.decision === 'reject' ? BTN_DANGER : BTN_PRIMARY}
              >
                {busy ? <><Loader2 size={15} className="animate-spin" /> Working…</> : ACADEMIC_DECISIONS[draft.decision].label}
              </button>
              {overrideTooShort && (
                <p className="self-center text-xs text-amber-800">
                  An override needs a reason of at least twenty characters.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------------
          CONFIRM ACADEMIC ADMISSION.

          Six consequences, named, before the button that causes them. The
          University asked for this and it is right: the action reserves a
          number, creates an account and issues a signed document under the
          Head of Academic Affairs' signature, and none of it is undone by
          pressing something else afterwards — a reversal is a second decision,
          permanently beside the first.
          ------------------------------------------------------------------ */}
      {confirming && open && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1f1a27]">
            <h2 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">
              Confirm academic admission
            </h2>
            <p className={`mt-2 text-sm leading-relaxed ${TEXT.body}`}>
              You are approving{' '}
              <strong>{[open.first_name, open.last_name].filter(Boolean).join(' ') || 'this applicant'}</strong>{' '}
              for admission to <strong>{open.program ?? 'the named programme'}</strong>
              {open.intake ? <> for the <strong>{open.intake}</strong> session</> : null}.
            </p>
            <p className={`mt-3 text-xs font-semibold uppercase tracking-[0.12em] ${TEXT.faint}`}>
              This action will
            </p>
            <ul className={`mt-2 space-y-1.5 text-sm ${TEXT.muted}`}>
              {ISSUANCE_STEPS.map((step) => (
                <li key={step} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#c5a55a]" />
                  {step.charAt(0).toUpperCase() + step.slice(1)}
                </li>
              ))}
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#c5a55a]" />
                Record this permanently in the audit trail, against your name and office
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button onClick={() => setConfirming(false)} className={BTN_SECONDARY}>Cancel</button>
              <button onClick={() => submit()} disabled={busy} className={BTN_PRIMARY}>
                {busy ? <><Loader2 size={15} className="animate-spin" /> Working…</> : 'Approve & issue admission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
