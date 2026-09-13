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
// AND IT DOES NOT OFFER A DOWNLOAD, BECAUSE A DOWNLOAD WOULD BE A FORGERY
// ---------------------------------------------------------------------------
//
// The University asked for "Download Official Transcript", and this screen
// deliberately does not have that button. The reason matters.
//
// An OFFICIAL transcript is a sealed document: it carries the University's
// signature, a content hash and a verification code, and a stranger can check
// it at /verify without contacting anybody. Sealing one is done by the office
// that holds `design-credentials`, and the signing endpoint refuses everybody
// else — it refuses them because it once did not, and an open signing endpoint
// let anybody have the University sign a degree of their choosing.
//
// So a student pressing "download" could only ever be given an UNSEALED
// printout. It would look exactly like the real thing, carry no verification
// code, and be handed to employers who would believe it. The most damaging
// possible outcome of this screen is a document that looks official and is not.
//
// What they get instead is the record itself — everything on it, on screen,
// to read and check — and a request that produces a genuinely sealed one.
// `transcript_requests` and its Registry queue have existed for months for
// exactly this, so the button goes there rather than anywhere new.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import StudentScreen from './StudentScreen';
import { readMine } from '@/lib/studentReads';
import { useJourney } from '@/contexts/JourneyContext';
import { termLabel, newestFirst, type ResultRow, type TermRow } from './MyResults';
import { FOCUS } from '@/lib/portalTheme';
import { BadgeCheck, Clock, FileText, ShieldCheck } from 'lucide-react';
import type { ViewType } from '@/lib/types';

// eslint-disable-next-line max-len
const RESULTS = 'student_id, result_id, course_id, course_code, course_title, credits, academic_year, semester, ca_score, exam_score, total_score, grade, grade_point, quality_points, attempt, status, official, standing, with_whom, approved_at';
// eslint-disable-next-line max-len
const TERMS = 'student_id, academic_year, semester, courses, official_courses, provisional_courses, official_credits, official_quality_points, gpa, cgpa, term_is_official';

export default function MyTranscript({ onNavigate }: { onNavigate?: (v: ViewType) => void }) {
  const { journey, loading: journeyLoading, failed: journeyFailed } = useJourney();
  const [results, setResults] = useState<ResultRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (journeyLoading) return;
    const [r, t] = await Promise.all([
      readMine<ResultRow>('my_results', RESULTS),
      readMine<TermRow>('my_result_terms', TERMS),
    ]);
    setResults(r.rows); setTerms(t.rows);
    setFailed(journeyFailed ?? r.failed ?? t.failed);
    setLoading(false);
  }, [journeyLoading, journeyFailed]);
  useEffect(() => { void load(); }, [load]);

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
