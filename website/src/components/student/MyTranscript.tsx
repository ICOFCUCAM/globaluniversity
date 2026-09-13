'use client';

// ---------------------------------------------------------------------------
// ACADEMIC TRANSCRIPT — the student's own official record.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "The student should be able to access an official academic record. Student
// name · Student number · Programme · Award · Faculty · Department · Academic
// history · Courses · Credits · Grades · GPA/CGPA · Academic standing ·
// Graduation status. With: Download Official Transcript. The generated
// document should contain verification information/QR code."
//
// ---------------------------------------------------------------------------
// WHAT A STUDENT WAS BEING GIVEN BEFORE, AND WHY IT WAS WRONG
// ---------------------------------------------------------------------------
//
// Two screens, both the University's rather than theirs.
//
// 'Transcript' opened `TranscriptGenerator` — the screen that ISSUES a
// transcript from a student's record, which is the Registry's act.
// 'Academic records' opened a register of up to five hundred students ordered
// by surname, with a search box over it.
//
// Neither is a student reading their own record. That is what this is.
//
// ---------------------------------------------------------------------------
// UPON REQUEST, AND ONCE
// ---------------------------------------------------------------------------
//
// The University's ruling: "transcript from student must be upon request and
// only one time to be downloaded by student. After which they can only
// request."
//
// So there is no standing download on this page. A student reads their record
// here as often as they like; taking a copy away means the Registry issued
// one, and the copy is released exactly once.
//
// THE ONCE IS NOT ENFORCED BY THIS SCREEN, and could not be. Hiding a button
// after the first press stops nobody: the request can be replayed, and a
// student who wants a second copy needs the back button rather than any
// sophistication. 076 spends the download in the same SQL statement that
// checks it — `where downloaded < downloads_allowed` — so two clicks arriving
// together cannot both succeed. This screen only asks and reports.
//
// AND WHY THE COPY IS SEALED RATHER THAN PRINTED FROM HERE. An official
// transcript carries the University's signature, a content hash and a
// verification code a stranger can check at /verify. Sealing one is done by
// the office holding `design-credentials` — the signing endpoint refuses
// everybody else, because it once did not. A button here that produced an
// unsealed printout would hand students a document that looks exactly like
// the real thing and is not, and employers would believe it.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import StudentScreen from './StudentScreen';
import { readMine } from '@/lib/studentReads';
import { useJourney } from '@/contexts/JourneyContext';
import { termLabel, newestFirst, type ResultRow, type TermRow } from './MyResults';
import { supabase } from '@/lib/supabase';
import { FOCUS } from '@/lib/portalTheme';
import {
  BadgeCheck, Clock, Download, FileText, ShieldCheck,
} from 'lucide-react';
import type { ViewType } from '@/lib/types';

// eslint-disable-next-line max-len
const REQUESTS = 'student_id, pipeline, item_id, kind, subject, status, submitted_at, downloads_allowed, downloaded';

interface TranscriptRequest {
  item_id: string;
  status: string;
  submitted_at: string;
  downloads_allowed: number | null;
  downloaded: number | null;
}

// eslint-disable-next-line max-len
const RESULTS = 'student_id, result_id, course_id, course_code, course_title, credits, academic_year, semester, ca_score, exam_score, total_score, grade, grade_point, quality_points, attempt, status, official, standing, with_whom, approved_at';
// eslint-disable-next-line max-len
const TERMS = 'student_id, academic_year, semester, courses, official_courses, provisional_courses, official_credits, official_quality_points, gpa, cgpa, term_is_official';

export default function MyTranscript({ onNavigate }: { onNavigate?: (v: ViewType) => void }) {
  const { journey, loading: journeyLoading, failed: journeyFailed } = useJourney();
  const [results, setResults] = useState<ResultRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [requests, setRequests] = useState<TranscriptRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (journeyLoading) return;
    const [r, t, q] = await Promise.all([
      readMine<ResultRow>('my_results', RESULTS),
      readMine<TermRow>('my_result_terms', TERMS),
      readMine<TranscriptRequest>('my_requests', REQUESTS),
    ]);
    setResults(r.rows); setTerms(t.rows);
    setRequests(q.rows.filter((x) => (x as unknown as { pipeline: string })
      .pipeline === 'transcript'));
    setFailed(journeyFailed ?? r.failed ?? t.failed);
    setLoading(false);
  }, [journeyLoading, journeyFailed]);
  useEffect(() => { void load(); }, [load]);

  /**
   * Spend the one download, if there is one to spend.
   *
   * THE ANSWER COMES FROM THE DATABASE, not from the count this screen is
   * holding. That count may be stale — another tab, another device — and a
   * screen that decided for itself would either refuse a download the student
   * still has or offer one they do not.
   */
  const claim = useCallback(async (requestId: string) => {
    setClaiming(true); setSaid(null);
    const { data, error } = await supabase.rpc('claim_transcript_download', {
      p_request: requestId,
    });
    setClaiming(false);
    if (error) { setSaid({ ok: false, text: error.message }); return; }
    const row = (Array.isArray(data) ? data[0] : data) as
      { granted: boolean; reason: string | null; credential_ref: string | null } | null;
    if (!row?.granted) {
      setSaid({ ok: false, text: row?.reason ?? 'That download could not be released.' });
      await load();
      return;
    }
    setSaid({
      ok: true,
      text: `Released. Your transcript${row.credential_ref ? ` (${row.credential_ref})` : ''} `
        + 'is under My documents, where you can open and verify it. This request has now been '
        + 'used — another copy means another request.',
    });
    await load();
  }, [load]);

  // ---------------------------------------------------------------------
  // ONLY APPROVED RESULTS APPEAR ON A TRANSCRIPT.
  //
  // This is the one screen where the provisional marks 071 introduced must
  // NOT be shown. A transcript is the University's statement of what a
  // student achieved; a provisional mark is a lecturer's submission working
  // its way through moderation. Putting one on a transcript — even labelled
  // — invites it being read as the record, and the record is what an
  // employer and another university act on.
  //
  // My results is where provisional marks belong, and it says so.
  // ---------------------------------------------------------------------
  const official = useMemo(() => results.filter((r) => r.official), [results]);
  const provisional = results.length - official.length;

  const byTerm = useMemo(() => newestFirst(terms).map((t) => ({
    term: t,
    rows: official
      .filter((r) => r.academic_year === t.academic_year && r.semester === t.semester)
      .sort((a, b) => a.course_code.localeCompare(b.course_code)),
  })).filter((g) => g.rows.length > 0), [terms, official]);

  const totalCredits = official.reduce((n, r) => n + Number(r.credits ?? 0), 0);

  return (
    <StudentScreen
      title="Academic transcript"
      subtitle="Your official academic record, as the University holds it"
      loading={loading || journeyLoading}
      failed={failed}
      action={onNavigate ? (
        <button
          onClick={() => onNavigate('my-credentials')}
          className={`flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2 text-sm
                      font-semibold text-white transition hover:bg-[#33234a] ${FOCUS}`}
        >
          <ShieldCheck size={15} /> Request an official transcript
        </button>
      ) : undefined}
    >
      <div className="space-y-5">
        {/* ------------------------------------------------------------------
            THE ONE DOWNLOAD, WHERE THERE IS ONE WAITING.

            Drawn only when the Registry has actually issued a transcript and
            the student has not yet taken it. Once it is spent the panel says
            so and points at a fresh request — the University's "after which
            they can only request", said rather than implied by a missing
            button.
            ------------------------------------------------------------------ */}
        {said && (
          <Card className={`flex items-start gap-3 p-4 ${
            said.ok
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
              : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
          }`}>
            {said.ok
              ? <BadgeCheck size={16} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
              : <Clock size={16} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />}
            <p className={`text-xs leading-relaxed ${
              said.ok ? 'text-emerald-800 dark:text-emerald-200'
                : 'text-amber-800 dark:text-amber-200'
            }`}>
              {said.text}
            </p>
          </Card>
        )}

        {requests.length > 0 && (
          <Card className="p-4">
            <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
              Your transcript requests
            </h2>
            <ul className="mt-2 divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
              {requests.map((q) => {
                const allowed = q.downloads_allowed ?? 0;
                const used = q.downloaded ?? 0;
                const left = Math.max(0, allowed - used);
                const issued = q.status === 'completed' || q.status === 'approved';
                return (
                  <li key={q.item_id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#33234a] dark:text-[#e4dcf0]">
                        Requested {new Date(q.submitted_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </p>
                      <p className="text-[11px] text-[#a49bb0]">
                        {!issued
                          ? `With the Registry \u2014 ${q.status.replace('-', ' ')}`
                          : left > 0
                            ? `Issued. ${left} download${left === 1 ? '' : 's'} waiting for you.`
                            : 'Issued and downloaded. Ask again for another copy.'}
                      </p>
                    </div>
                    {issued && left > 0 && (
                      <button
                        onClick={() => claim(q.item_id)}
                        disabled={claiming}
                        className={`flex shrink-0 items-center gap-2 rounded-lg bg-[#422e59]
                                    px-3 py-1.5 text-xs font-semibold text-white transition
                                    hover:bg-[#33234a] disabled:opacity-50 ${FOCUS}`}
                      >
                        <Download size={13} /> {claiming ? 'Releasing…' : 'Download once'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* ---- WHO THIS RECORD IS ABOUT ---- */}
        <Card className="p-5">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Name" value={journey?.full_name ?? null} />
            <Fact label="Student number"
              value={journey?.student_number ?? journey?.matric_no ?? null} />
            <Fact label="Programme" value={journey?.programme_name ?? journey?.programme_code ?? null} />
            <Fact label="Award" value={journey?.award_title ?? null} />
            <Fact label="Curriculum" value={journey?.version_label ?? null} />
            <Fact
              label="Academic standing"
              value={journey?.stage === 'alumni' ? 'Graduated'
                : journey?.stage === 'suspended' ? 'Suspended'
                  : journey?.stage === 'withdrawn' ? 'Withdrawn'
                    : journey?.student_status === 'active' ? 'In good standing' : null}
            />
          </dl>
          {/* FACULTY AND DEPARTMENT ARE ON THE UNIVERSITY'S LIST and are not
              drawn here, because the journey view does not carry them and
              inventing a faculty name onto somebody's transcript would be
              inventing an institutional fact. They appear the moment the
              record carries them. */}
        </Card>

        {/* ---- THE TOTALS ---- */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Figure
            label="Credits earned"
            value={journey?.credits_required
              ? `${journey.credits_earned} / ${journey.credits_required}`
              : String(journey?.credits_earned ?? totalCredits)}
          />
          <Figure
            label="Cumulative GPA"
            value={journey?.cgpa === null || journey?.cgpa === undefined
              ? '—' : Number(journey.cgpa).toFixed(2)}
          />
          <Figure
            label="Graduation"
            value={journey?.conferred_on ? 'Conferred'
              : journey?.stage === 'graduated' ? 'Awaiting Senate' : 'In progress'}
            small={journey?.classification ?? undefined}
          />
        </div>

        {/* ---- THE ACADEMIC HISTORY ---- */}
        {byTerm.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
              No approved results yet, so there is nothing on your transcript. A mark reaches this
              page only once the Registrar has approved it.
            </p>
          </Card>
        ) : byTerm.map(({ term, rows }) => (
          <section key={`${term.academic_year}-${term.semester}`} className="space-y-2">
            <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
              {termLabel(term.academic_year, term.semester)}
            </h2>
            <TableShell>
              <table className="w-full">
                <THead>
                  <tr>
                    <Th>Course</Th>
                    <Th align="right">Credits</Th>
                    <Th align="right">Grade</Th>
                    <Th align="right">Grade point</Th>
                    <Th align="right">Quality points</Th>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <tr key={r.result_id}>
                      <Td>
                        <span className="font-semibold text-[#422e59] dark:text-[#c8b6e8]">
                          {r.course_code}
                        </span>
                        <span className="ml-2 text-[#6b6076] dark:text-[#9c93ad]">
                          {r.course_title}
                        </span>
                      </Td>
                      <Td align="right">{r.credits ?? '—'}</Td>
                      <Td align="right"><span className="font-semibold">{r.grade ?? '—'}</span></Td>
                      <Td align="right">
                        {r.grade_point === null ? '—' : Number(r.grade_point).toFixed(2)}
                      </Td>
                      <Td align="right">
                        {r.quality_points === null ? '—' : Number(r.quality_points).toFixed(2)}
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </table>
            </TableShell>
            <p className="px-1 text-right text-xs text-[#6b6076] dark:text-[#9c93ad]">
              Semester GPA:{' '}
              <strong className="tabular-nums text-[#33234a] dark:text-[#e4dcf0]">
                {term.gpa === null ? 'not yet published' : Number(term.gpa).toFixed(2)}
              </strong>
            </p>
          </section>
        ))}

        {/* ---- WHAT IS DELIBERATELY NOT ON THIS PAGE ---- */}
        {provisional > 0 && (
          <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4
                           dark:border-amber-900 dark:bg-amber-950/30">
            <Clock size={16} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              {provisional} of your marks {provisional === 1 ? 'is' : 'are'} still provisional and{' '}
              {provisional === 1 ? 'is' : 'are'} not shown here. A transcript carries only what the
              Registrar has approved. You can see the provisional ones under My results.
            </p>
          </Card>
        )}

        <Card className="flex items-start gap-3 p-4">
          <FileText size={16} className="mt-0.5 shrink-0 text-[#c5a55a]" />
          <div className="text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
            <p className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">
              This page is your record. It is not an official transcript.
            </p>
            <p className="mt-1">
              An official transcript is sealed by the University, carries a verification code, and
              can be checked by anyone who receives it. Only the Registry can issue one — so there
              is no download here that would produce an unsealed copy looking like the real thing.
              Request one and it will be issued and sealed properly.
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <BadgeCheck size={12} /> Sealed transcripts appear under My documents, with their
              verification code.
            </p>
          </div>
        </Card>
      </div>
    </StudentScreen>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[#a49bb0]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
        {value ?? <span className="font-normal text-[#a49bb0]">Not recorded</span>}
      </dd>
    </div>
  );
}

function Figure({ label, value, small }: { label: string; value: string; small?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wide text-[#a49bb0]">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold tabular-nums
                    text-[#422e59] dark:text-[#c8b6e8]">
        {value}
      </p>
      {small && <p className="mt-0.5 text-[11px] text-[#a49bb0]">{small}</p>}
    </Card>
  );
}
