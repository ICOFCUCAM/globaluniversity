'use client';

// ---------------------------------------------------------------------------
// ENROLMENT — the Registrar's desk, and the end of the journey.
//
// ---------------------------------------------------------------------------
// WHY THIS SCREEN EXISTS
// ---------------------------------------------------------------------------
//
// `enrolled` has been in the vocabulary since migration 024 and nothing could
// produce it. An issued admission was the last state a student could reach, so
// the University could say it had admitted somebody and could not say whether
// they had ever taken up the place.
//
// That is not bookkeeping. An admitted applicant who never enrols is a place
// that could have gone to somebody else, and until now they sat in the
// register indistinguishable from a student in a lecture.
//
// ---------------------------------------------------------------------------
// WHAT THIS SCREEN IS NOT
// ---------------------------------------------------------------------------
//
// It takes no academic decision and it cannot. Everything here has already
// been decided by the Head of Academic Affairs and issued; this desk records
// what became of the offer. The two controls are factual, not judgemental:
// the student took up the place, or they did not.
//
// WITHDRAWAL IS HERE FOR A REASON. An applicant who wrote to say they no
// longer wanted the place used to be marked `declined` — refused, by the
// Registrar, in the University's own records, having been refused by nobody.
// Recording that correctly belongs with the office that hears it.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { statesForDesk, MIN_WITHDRAW_REASON, DECISION_CHECKS, type DecisionRefusal } from '@/lib/admissionWorkflow';
import { stages, stageOf, stageChipClass } from '@/lib/admissions';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton, Figure,
  TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from '@/lib/portalTheme';
import { UserCheck, AlertTriangle, CheckCircle2, Inbox } from 'lucide-react';

interface Row {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  matric_no: string | null;
  student_number: string | null;
  program: string | null;
  status: string | null;
  decided_at: string | null;
  enrolled_at: string | null;
}

// One literal — supabase-js reads the row type from it. See the note in
// AcademicAdmissions: a concatenation widens it to `string` and the query
// silently returns the wrong type.
// eslint-disable-next-line max-len
const COLUMNS = 'id, first_name, last_name, email, matric_no, student_number, program, status, decided_at, enrolled_at';

export default function Enrolment() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [reachable, setReachable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('students')
      .select(COLUMNS)
      .in('status', statesForDesk('enrolment'))
      .order('decided_at', { ascending: true, nullsFirst: false })
      .limit(200);
    setReachable(!error);
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(row: Row, withdraw: boolean) {
    setBusy(true);
    setResult(null);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch('/api/admissions/enrol', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sess.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        applicationId: row.id,
        ...(withdraw ? { withdraw: true, reason: reason.trim() } : {}),
      }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);

    if (!json?.ok) {
      setResult({
        tone: 'bad',
        text: DECISION_CHECKS[json?.error as DecisionRefusal]
          ?? json?.detail ?? 'Nothing was recorded.',
      });
      return;
    }
    const who = [row.first_name, row.last_name].filter(Boolean).join(' ');
    setWithdrawing(null);
    setReason('');
    setResult({
      tone: 'ok',
      text: withdraw
        // SAYING WHAT DID NOT HAPPEN, because a withdrawal that quietly
        // revoked a letter would be a much bigger act than it looks.
        ? `${who} is recorded as withdrawn — not refused.`
          + (json.hadBeenIssued
            ? ' The admission letter and the account still stand; withdrawing does not revoke them.'
            : '')
        : `${who} is enrolled${json.studentNumber ? ` as ${json.studentNumber}` : ''}.`,
    });
    load();
  }

  const awaiting = (rows ?? []).filter((r) => r.status === 'admission_issued');
  const enrolled = (rows ?? []).filter((r) => r.status === 'enrolled');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrolment"
        subtitle="Admissions that have been issued, and whether the student took up the place. Nothing is decided here."
      />

      {!reachable && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>The register could not be read.</strong> The lists below are empty because
          nothing could be fetched, not because nobody has been admitted.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {rows === null ? (
          Array.from({ length: 2 }, (_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-7 w-16" /></Card>
          ))
        ) : (
          <>
            <Figure label="Awaiting enrolment" value={awaiting.length.toLocaleString()}
              hint="Admitted, not yet taken up" icon={<Inbox size={16} />}
              tone={awaiting.length === 0 ? 'muted' : 'neutral'} />
            <Figure label="Enrolled" value={enrolled.length.toLocaleString()}
              hint="Took up the place" icon={<UserCheck size={16} />}
              tone={enrolled.length === 0 ? 'muted' : 'neutral'} />
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

      {/* Withdrawal is confirmed, because it is a statement about a person's
          intentions and it goes on the record under the Registrar's name. */}
      {withdrawing && (
        <Card>
          <CardHeader
            title={`Record a withdrawal — ${[withdrawing.first_name, withdrawing.last_name].filter(Boolean).join(' ')}`}
            subtitle={`Currently ${stages[stageOf(withdrawing)].label.toLowerCase()}`}
          />
          <div className="space-y-3 p-5">
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <p>
                This records that <strong>the applicant stepped away</strong> — it is not a refusal
                by the University, and it must not be used as one. <strong>It revokes
                nothing</strong>: any letter already issued stands and the account still works.
              </p>
            </div>
            <div>
              <label className={LABEL} htmlFor="withdraw-reason">What happened?</label>
              <input
                id="withdraw-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={`${INPUT} mt-1`}
                placeholder="e.g. Accepted a place elsewhere"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void act(withdrawing, true)}
                disabled={busy || reason.trim().length < MIN_WITHDRAW_REASON}
                className={BTN_PRIMARY}
              >
                {busy ? 'Recording…' : 'Record the withdrawal'}
              </button>
              <button onClick={() => setWithdrawing(null)} className={BTN_SECONDARY}>Cancel</button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Awaiting enrolment" subtitle="Admitted longest ago first" />
        {rows === null ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : awaiting.length === 0 ? (
          <EmptyState
            icon={<UserCheck size={22} />}
            title="Nobody is waiting"
            description="An admitted applicant appears here once the Head of Academic Affairs has issued their admission."
          />
        ) : (
          <TableShell>
            <THead>
              <tr>
                <Th>Student</Th><Th>Programme</Th><Th>Admitted</Th><Th align="right">Action</Th>
              </tr>
            </THead>
            <TBody>
              {awaiting.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <span className="font-medium">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</span>
                    <span className="block text-[11px] text-[#a49bb0]">{r.student_number ?? r.matric_no}</span>
                  </Td>
                  <Td>{r.program ?? '—'}</Td>
                  <Td>{r.decided_at ? new Date(r.decided_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => void act(r, false)}
                        disabled={busy}
                        className={`${BTN_PRIMARY} px-3 py-1.5 text-xs`}
                      >
                        Enrol
                      </button>
                      <button
                        onClick={() => { setWithdrawing(r); setReason(''); setResult(null); }}
                        className={`${BTN_SECONDARY} px-3 py-1.5 text-xs`}
                      >
                        Withdrew
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </TBody>
          </TableShell>
        )}
      </Card>

      {enrolled.length > 0 && (
        <Card>
          <CardHeader title="Enrolled" subtitle="Took up the place, most recent first" />
          <TableShell>
            <THead>
              <tr><Th>Student</Th><Th>Programme</Th><Th>Enrolled</Th><Th>State</Th></tr>
            </THead>
            <TBody>
              {[...enrolled].reverse().map((r) => (
                <tr key={r.id}>
                  <Td>
                    <span className="font-medium">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</span>
                    <span className="block text-[11px] text-[#a49bb0]">{r.student_number}</span>
                  </Td>
                  <Td>{r.program ?? '—'}</Td>
                  <Td>{r.enrolled_at ? new Date(r.enrolled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</Td>
                  <Td>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${stageChipClass[stages[stageOf(r)].tone]}`}>
                      {stages[stageOf(r)].label}
                    </span>
                  </Td>
                </tr>
              ))}
            </TBody>
          </TableShell>
        </Card>
      )}
    </div>
  );
}
