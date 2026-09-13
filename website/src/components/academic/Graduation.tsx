'use client';

// ---------------------------------------------------------------------------
// GRADUATION & AWARDS — the end of the chain.
//
// ---------------------------------------------------------------------------
// WHAT WAS MISSING, AND FOR HOW LONG
// ---------------------------------------------------------------------------
//
// `graduation_records` was created by migration 019, with a careful design:
// the Senate's resolution date is required, a degree cannot be conferred
// before the Senate resolved, and one award is conferred on one student once.
//
// NOTHING HAS EVER READ OR WRITTEN A ROW INTO IT. It is the same fault
// `reachability.test.mjs` exists to catch — a thing that is correct and
// connected to nothing — and it escaped that test only because the test hunts
// tables that are READ and never written. This one was neither.
//
// So the chain the University drew ran
//
//   … Registration → Assessment → Result → Transcript → Graduation
//
// and stopped one short of the end.
//
// ---------------------------------------------------------------------------
// THE SCREEN SHOWS A VERDICT. IT DOES NOT MAKE A DECISION.
// ---------------------------------------------------------------------------
//
// `src/lib/graduation.ts` assesses a candidate against four things: credits,
// cumulative GPA, outstanding admission conditions, and fees. It is the same
// function the Certificate Generator already calls, and it is called here
// rather than reimplemented — a second copy would mean a candidate's
// eligibility depending on which screen asked.
//
// The route runs it AGAIN, server-side, before writing anything. A screen's
// verdict is a claim about what a browser was holding; the row outlives the
// browser by fifty years.
//
// ---------------------------------------------------------------------------
// AND ONE CHECK CAN NEVER BE MET, WHICH THE SCREEN SAYS OUT LOUD
// ---------------------------------------------------------------------------
//
// The University keeps no per-student fee schedule in this system: `payments`
// records what was received and nothing records what was owed. So the fee
// check is UNKNOWN for everybody, always, and no candidate ever fully
// qualifies by computation.
//
// That is not hidden behind a green tick. Every candidate carries the sentence
// that the fee position could not be established here — because "we did not
// look" and "nothing is owed" are different answers, and a screen that blurred
// them would be the one place a degree slipped through on an unpaid account.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { can } from '@/lib/roles';
import { useAuth } from '@/contexts/AuthContext';
import { assessGraduation, type AwardRule, type GraduationVerdict } from '@/lib/graduation';
import {
  Card, EmptyState, PageHeader, SkeletonRows,
} from '@/components/ui/portal';
import {
  AlertTriangle, CheckCircle2, HelpCircle, Search, GraduationCap, Award, X, Scale,
} from 'lucide-react';
import { within } from './ProgrammeRegister';

// A SINGLE STRING LITERAL — concatenation collapses the inferred row type.
// eslint-disable-next-line max-len
const CANDIDATE = 'student_id, matric_no, student_number, full_name, status, student_status, programme_code, programme_name, credits_required, credits_earned, credits_against_award, courses_outstanding, courses_failed, cgpa, award_id, award_code, award_title, award_kind, award_credits_required, min_cgpa, cgpa_confirmed, admission_conditions, graduation_id, senate_approved_on, conferred_on, convocation_on, classification, graduation_number, certificate_credential_id, conferred_despite';

interface Candidate {
  student_id: string;
  matric_no: string | null;
  student_number: string | null;
  full_name: string;
  status: string;
  student_status: string | null;
  programme_code: string | null;
  programme_name: string | null;
  credits_required: number | null;
  credits_earned: number;
  credits_against_award: number | null;
  courses_outstanding: number;
  courses_failed: number;
  cgpa: number | null;
  award_id: string | null;
  award_code: string | null;
  award_title: string | null;
  award_kind: string | null;
  award_credits_required: number | null;
  min_cgpa: number | null;
  cgpa_confirmed: boolean | null;
  admission_conditions: string | null;
  graduation_id: string | null;
  senate_approved_on: string | null;
  conferred_on: string | null;
  convocation_on: string | null;
  classification: string | null;
  graduation_number: string | null;
  certificate_credential_id: string | null;
  conferred_despite: string | null;
}

/**
 * The verdict for one candidate, from the one function that decides it.
 *
 * NOT REIMPLEMENTED HERE. `assessGraduation` is the same code the Certificate
 * Generator calls and the same code the route calls before it writes. Three
 * copies of a graduation rule is how a student is told they qualify on one
 * screen and do not on another.
 */
function verdictFor(c: Candidate): GraduationVerdict {
  const award: AwardRule | null = c.award_id ? {
    id: c.award_id,
    code: c.award_code ?? '',
    title: c.award_title ?? '',
    kind: c.award_kind ?? '',
    creditsRequired: Number(c.award_credits_required ?? 0),
    minCgpa: Number(c.min_cgpa ?? 0),
    cgpaConfirmed: c.cgpa_confirmed === true,
  } : null;

  // UNPARSEABLE CONDITIONS ARE NOT "NONE". One outstanding item, so the case
  // is looked at rather than waved through.
  let conditions: { requirement: string; dueBy?: string }[] = [];
  try {
    const parsed = c.admission_conditions ? JSON.parse(c.admission_conditions) : [];
    if (Array.isArray(parsed)) conditions = parsed;
  } catch {
    conditions = [{ requirement: 'The recorded admission conditions could not be read' }];
  }

  return assessGraduation({
    award,
    creditsEarned: Number(c.credits_earned ?? 0),
    cgpa: c.cgpa === null ? null : Number(c.cgpa),
    outstandingConditions: conditions,
    // See the file header. Unknown, never zero.
    feeBalance: null,
    status: c.status,
  });
}

export default function Graduation() {
  const { user } = useAuth();
  const mayConfer = can(user?.role, 'confer-award');

  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'candidates' | 'conferred'>('candidates');
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await within(
        supabase.from('graduation_candidate').select(CANDIDATE).order('full_name').limit(1000),
      );
      if (error) { setFailed(error.message); setRows([]); return; }
      setFailed(null);
      setRows((data ?? []) as unknown as Candidate[]);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The graduation register could not be read.');
      setRows([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setNote(null);
    const out = await authedPost('/api/academic/graduation', payload);
    setBusy(false);
    if (!out.ok) {
      setNote({ tone: 'bad', text: String(out.detail ?? out.error ?? 'That did not work.') });
      return false;
    }
    setNote({ tone: 'ok', text: String(out.detail ?? 'Done.') });
    await load();
    return true;
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? [])
      .filter((r) => (tab === 'conferred' ? r.graduation_id !== null : r.graduation_id === null))
      .filter((r) => !q
        || r.full_name.toLowerCase().includes(q)
        || (r.matric_no ?? '').toLowerCase().includes(q)
        || (r.award_title ?? '').toLowerCase().includes(q));
  }, [rows, tab, query]);

  const conferredCount = (rows ?? []).filter((r) => r.graduation_id !== null).length;
  const candidateCount = (rows ?? []).filter((r) => r.graduation_id === null).length;
  const open = (rows ?? []).find((r) => r.student_id === openId) ?? null;

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="The graduation register could not be read"
          description={`${failed}. If migrations 067 and 069 have not been run on this database, `
            + 'the views this screen reads do not exist yet.'}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Graduation & awards"
        subtitle="Who qualifies, who has been conferred, and on whose authority."
      />

      {/* ------------------------------------------------------------------
          THE STANDING NOTICE. It is not a warning about a candidate; it is a
          statement about what this system can and cannot establish, and it
          belongs above every verdict rather than inside one.
          ------------------------------------------------------------------ */}
      <Card className="flex items-start gap-3 border-[#ded6c8] bg-[#faf8f4] p-4
                       dark:border-[#3d3349] dark:bg-[#241f2c]">
        <Scale size={16} className="mt-0.5 shrink-0 text-[#6b6076] dark:text-[#9c93ad]" />
        <div className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
          <p className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">
            This screen establishes that a candidate qualifies. The Senate confers.
          </p>
          <p className="mt-1">
            Recording a conferral asks for the day the Senate resolved, because that date is the
            authority for the award — a degree recorded without it says the University granted one
            with no record of deciding to.
          </p>
          <p className="mt-1">
            The fee position cannot be established here: this system records what was received,
            not what was owed. Every candidate below therefore reads as undetermined on fees, and
            that has to be confirmed with the Finance Office rather than read off this page.
          </p>
        </div>
      </Card>

      {note && (
        <div className={`rounded-xl border p-3 text-sm ${
          note.tone === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
            : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
        }`}>
          {note.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-[#ded6c8] p-1 dark:border-[#3d3349]">
          {([
            ['candidates', `Candidates (${candidateCount})`],
            ['conferred', `Conferred (${conferredCount})`],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => { setTab(k); setOpenId(null); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                tab === k
                  ? 'bg-[#422e59] text-white'
                  : 'text-[#6b6076] hover:bg-[#faf8f4] dark:text-[#9c93ad] dark:hover:bg-[#241f2c]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[16rem] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a49bb0]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find by name, matriculation number or award"
            aria-label="Find a candidate"
            className="w-full rounded-xl border border-[#ded6c8] bg-white py-2 pl-9 pr-3 text-sm
                       dark:border-[#3d3349] dark:bg-[#241f2c]"
          />
        </div>
      </div>

      {rows === null && <Card className="overflow-hidden"><SkeletonRows rows={6} cols={4} /></Card>}

      {rows !== null && shown.length === 0 && (
        <Card>
          <EmptyState
            icon={<GraduationCap size={20} />}
            title={tab === 'conferred' ? 'No degree has been conferred yet' : 'No candidates'}
            description={tab === 'conferred'
              ? 'A conferral appears here once it is recorded against the Senate’s resolution.'
              : 'A student becomes a candidate once they are linked to an award. A student with '
                + 'no award has no requirement to be measured against and no title to print.'}
          />
        </Card>
      )}

      <div className="space-y-3">
        {shown.map((c) => (
          <CandidateRow
            key={c.student_id}
            candidate={c}
            open={openId === c.student_id}
            mayConfer={mayConfer}
            busy={busy}
            onToggle={() => setOpenId(openId === c.student_id ? null : c.student_id)}
            onAct={act}
          />
        ))}
      </div>
    </div>
  );
}

function CandidateRow({
  candidate: c, open, mayConfer, busy, onToggle, onAct,
}: {
  candidate: Candidate;
  open: boolean;
  mayConfer: boolean;
  busy: boolean;
  onToggle: () => void;
  onAct: (p: Record<string, unknown>) => Promise<boolean>;
}) {
  const [conferring, setConferring] = useState(false);
  const [rescinding, setRescinding] = useState(false);
  const [reason, setReason] = useState('');
  const verdict = useMemo(() => verdictFor(c), [c]);
  const conferred = c.graduation_id !== null;

  return (
    <Card className="p-0">
      <button
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">
            {c.full_name}
          </span>
          <span className="block text-xs text-[#6b6076] dark:text-[#9c93ad]">
            {c.matric_no ?? c.student_number ?? 'No matriculation number'}
            {c.award_title ? ` · ${c.award_title}` : ' · No award linked'}
          </span>
        </span>

        {conferred ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800
                             dark:bg-emerald-950/50 dark:text-emerald-200">
              Conferred {c.conferred_on}
            </span>
            {c.conferred_despite && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5
                               text-[10px] text-amber-800 dark:border-amber-800
                               dark:bg-amber-950/40 dark:text-amber-200">
                over an unmet requirement
              </span>
            )}
          </span>
        ) : (
          <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
            {c.credits_earned}
            {c.award_credits_required ? ` / ${c.award_credits_required}` : ''} credits
            {c.cgpa !== null && ` · CGPA ${Number(c.cgpa).toFixed(2)}`}
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-[#f0ece4] p-4 dark:border-[#2a2333]">
          {/* ---- THE CONFERRAL, WHERE THERE IS ONE ---- */}
          {conferred && (
            <div className="rounded-xl bg-[#faf8f4] p-4 text-xs dark:bg-[#241f2c]">
              <p className="flex items-center gap-1.5 font-semibold text-[#422e59]
                            dark:text-[#c8b6e8]">
                <Award size={14} /> {c.award_title}
              </p>
              <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <Detail label="Senate resolved" value={c.senate_approved_on} />
                <Detail label="Conferred" value={c.conferred_on} />
                <Detail label="Convocation" value={c.convocation_on} />
                <Detail label="Classification" value={c.classification} />
                <Detail label="Graduation number" value={c.graduation_number} />
                <Detail label="Certificate" value={c.certificate_credential_id} />
              </dl>
              {c.conferred_despite && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2
                              text-amber-800 dark:border-amber-900 dark:bg-amber-950/30
                              dark:text-amber-200">
                  <strong>Conferred over an unmet requirement.</strong> {c.conferred_despite}
                </p>
              )}
            </div>
          )}

          {/* ---- THE FOUR CHECKS ---- */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a49bb0]">
              {conferred ? 'As assessed now' : 'The assessment'}
            </p>
            <ul className="mt-2 space-y-1.5">
              {verdict.checks.map((x) => (
                <li key={x.id}
                  className={`flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg px-3 py-2
                              text-xs ${
                    x.state === 'met'
                      ? 'bg-emerald-50 dark:bg-emerald-950/20'
                      : x.state === 'unmet'
                        ? 'bg-red-50 dark:bg-red-950/20'
                        : 'bg-[#faf8f4] dark:bg-[#241f2c]'
                  }`}>
                  <span className="mt-0.5 shrink-0">
                    {x.state === 'met' ? <CheckCircle2 size={13} className="text-emerald-600" />
                      : x.state === 'unmet' ? <X size={13} className="text-red-600" />
                        : <HelpCircle size={13} className="text-[#a49bb0]" />}
                  </span>
                  <span className="w-28 shrink-0 font-medium text-[#33234a] dark:text-[#e4dcf0]">
                    {x.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[#33234a] dark:text-[#e4dcf0]">{x.found}</span>
                    <span className="block text-[#a49bb0]">Required: {x.required}</span>
                    {x.remedy && (
                      <span className="mt-0.5 block text-[#6b6076] dark:text-[#9c93ad]">
                        {x.remedy}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">{verdict.summary}</p>
          </div>

          {/* ---- AND WHAT MAY BE DONE ABOUT IT ---- */}
          {mayConfer && !conferred && (
            <div>
              {!conferring ? (
                <button
                  onClick={() => setConferring(true)}
                  className="rounded-xl bg-[#422e59] px-4 py-2 text-sm font-medium text-white
                             hover:bg-[#322244]"
                >
                  Record a conferral
                </button>
              ) : (
                <ConferForm
                  candidate={c}
                  unmet={verdict.checks.filter((x) => x.state === 'unmet')}
                  busy={busy}
                  onCancel={() => setConferring(false)}
                  onConfer={async (fields) => {
                    const ok = await onAct({
                      action: 'confer', studentId: c.student_id, ...fields,
                    });
                    if (ok) setConferring(false);
                  }}
                />
              )}
            </div>
          )}

          {mayConfer && conferred && (
            <div>
              {!rescinding ? (
                <button
                  onClick={() => setRescinding(true)}
                  className="text-xs text-red-600 underline dark:text-red-400"
                >
                  Rescind this conferral
                </button>
              ) : (
                <div className="space-y-2 rounded-xl border border-red-200 p-3
                                dark:border-red-900">
                  <p className="text-xs text-red-800 dark:text-red-200">
                    A degree is rescinded when it should not have been conferred. The reason stays
                    in the audit log with the whole of the record it removes.
                  </p>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this conferral being rescinded?"
                    aria-label="Reason for rescinding"
                    className="w-full rounded-lg border border-[#ded6c8] px-3 py-2 text-xs
                               dark:border-[#3d3349] dark:bg-[#241f2c]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const ok = await onAct({
                          action: 'rescind', graduationId: c.graduation_id, reason,
                        });
                        if (ok) { setRescinding(false); setReason(''); }
                      }}
                      disabled={busy || reason.trim().length < 12}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white
                                 hover:bg-red-700 disabled:opacity-40"
                    >
                      Rescind it
                    </button>
                    <button
                      onClick={() => { setRescinding(false); setReason(''); }}
                      className="rounded-lg border border-[#ded6c8] px-3 py-1.5 text-xs
                                 text-[#6b6076] dark:border-[#3d3349] dark:text-[#9c93ad]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ConferForm({
  candidate: c, unmet, busy, onCancel, onConfer,
}: {
  candidate: Candidate;
  unmet: { label: string; required: string; found: string }[];
  busy: boolean;
  onCancel: () => void;
  onConfer: (f: Record<string, unknown>) => void;
}) {
  const [senate, setSenate] = useState('');
  const [conferred, setConferred] = useState('');
  const [convocation, setConvocation] = useState('');
  const [classification, setClassification] = useState('');
  const [number, setNumber] = useState('');
  const [despite, setDespite] = useState('');

  const backwards = Boolean(senate && conferred && conferred < senate);
  const needsReason = unmet.length > 0;
  const ready = senate && conferred && !backwards
    && (!needsReason || despite.trim().length >= 12);

  return (
    <div className="space-y-3 rounded-xl border border-[#ded6c8] p-4 dark:border-[#3d3349]">
      {/* THE SENATE'S DATE FIRST, because it is the authority for everything
          below it, not a detail at the bottom of a form. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="The Senate resolved on">
          <input type="date" value={senate} onChange={(e) => setSenate(e.target.value)}
            className={INPUT} />
          <p className="mt-1 text-[11px] text-[#a49bb0]">
            The authority for the award. Required.
          </p>
        </Field>
        <Field label="Conferred on">
          <input type="date" value={conferred} onChange={(e) => setConferred(e.target.value)}
            className={INPUT} />
        </Field>
      </div>

      {backwards && (
        <p className="text-xs text-red-600 dark:text-red-400">
          A degree cannot be conferred before the Senate resolved to confer it.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Convocation (optional)">
          <input type="date" value={convocation} onChange={(e) => setConvocation(e.target.value)}
            className={INPUT} />
        </Field>
        <Field label="Classification">
          <input value={classification} onChange={(e) => setClassification(e.target.value)}
            placeholder="Pass, Distinction…" className={INPUT} />
        </Field>
        <Field label="Graduation number">
          <input value={number} onChange={(e) => setNumber(e.target.value)}
            placeholder="IGUC/G/2027/0001" className={INPUT} />
        </Field>
      </div>

      {/* ------------------------------------------------------------------
          CONFERRING OVER AN UNMET REQUIREMENT.

          Shown only when there IS one, and then it is not optional. A Senate
          may confer despite a shortfall — an aegrotat award, a case referred
          and resolved — and a University whose system cannot record that
          records it on paper, where no audit will find it.
          ------------------------------------------------------------------ */}
      {needsReason && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3
                        dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
            {c.full_name} does not meet {unmet.length === 1 ? 'a requirement' : `${unmet.length} requirements`}:
          </p>
          <ul className="text-xs text-amber-800 dark:text-amber-200">
            {unmet.map((x) => (
              <li key={x.label}>· {x.label}: {x.found} — required {x.required}</li>
            ))}
          </ul>
          <textarea
            value={despite}
            onChange={(e) => setDespite(e.target.value)}
            rows={3}
            placeholder="On what basis is the Senate conferring anyway?"
            aria-label="Reason for conferring despite an unmet requirement"
            className={INPUT}
          />
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            This stays on the record for as long as the degree stands, and appears beside it
            whenever it is read.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onConfer({
            senateApprovedOn: senate,
            conferredOn: conferred,
            convocationOn: convocation || null,
            classification: classification.trim() || null,
            graduationNumber: number.trim() || null,
            despite: despite.trim() || null,
          })}
          disabled={busy || !ready}
          className="rounded-xl bg-[#422e59] px-4 py-2 text-sm font-medium text-white
                     hover:bg-[#322244] disabled:opacity-40"
        >
          Record the conferral
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-[#ded6c8] px-4 py-2 text-sm text-[#6b6076]
                     dark:border-[#3d3349] dark:text-[#9c93ad]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[#a49bb0]">{label}</dt>
      <dd className="font-medium text-[#33234a] dark:text-[#e4dcf0]">{value ?? '—'}</dd>
    </div>
  );
}

const INPUT = 'w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2 text-xs '
  + 'dark:border-[#3d3349] dark:bg-[#241f2c]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-[#a49bb0]">
        {label}
      </span>
      {children}
    </label>
  );
}
