'use client';

// ---------------------------------------------------------------------------
// MY PROGRAMME — the degree, as the student reads it.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "This should be one of the most important student pages… Award, Duration,
// Credits, Current level, Current semester, Programme status. Then the
// curriculum, year by year and semester by semester, with each course marked:
// Completed, In Progress, Outstanding, Not Yet Available. This gives the
// student a real understanding of their degree."
//
// ---------------------------------------------------------------------------
// IT IS NOT THE PROGRAMME REGISTER WITH A FILTER ON IT
// ---------------------------------------------------------------------------
//
// The Registry's screen lists forty-one programmes and every version of each,
// with credit shortfalls in red and governance buttons down the side. Showing
// a student that screen filtered to one row would be exposing an
// administrative tool, which is precisely what the University said not to do.
//
// This answers a different question. Not "what does the University offer" but
// "what am I reading for, and how far through it am I" — and the answer is
// drawn from the curriculum version THEY were admitted under, which is the
// University's own ruling and the reason 057 put `programme_version_id` on the
// student at all.
//
// ---------------------------------------------------------------------------
// THE FOURTH WORD IS THE ONE THAT NEEDED NEW DATA
// ---------------------------------------------------------------------------
//
// Completed, In Progress and Outstanding all come from the student's results.
// NOT YET AVAILABLE does not: a course is unavailable when nobody is running
// it this term, which is a fact about the OFFERING and not about the student.
//
// Without the distinction, a third-year course a student cannot possibly take
// yet reads as "outstanding" and sends them looking for a register button that
// is not there. 070's `my_curriculum` carries `offered_now` for this.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, EmptyState, PageHeader, SkeletonRows,
} from '@/components/ui/portal';
import {
  AlertTriangle, CheckCircle2, Clock, Circle, CircleDashed, X, GraduationCap,
} from 'lucide-react';
import { within } from '@/components/academic/ProgrammeRegister';
import { courseStanding, meaningOf } from '@/lib/studentJourney';
import { useJourney } from '@/contexts/JourneyContext';
import type { ViewType } from '@/lib/types';

// SINGLE STRING LITERALS — concatenation collapses the inferred row type.
// eslint-disable-next-line max-len
const JOURNEY = 'student_id, full_name, first_name, matric_no, student_number, admission_status, student_status, stage, programme_version_id, programme_code, programme_name, version_label, duration_years, semesters_per_year, credits_required, award_title, year_label, starts_in, term_sequence, term_name, programme_year, credits_earned, credits_registered, credits_against_award, courses_passed, courses_failed, courses_registered, courses_outstanding, cgpa, last_semester_gpa, registered_this_term, credits_this_term, registration_window_recorded, registration_open, registration_opens, registration_closes, graduation_id, conferred_on, classification';
// eslint-disable-next-line max-len
const CURRICULUM = 'student_id, entry_id, course_id, course_code, course_title, year, semester, requirement, credits, grade, grade_point, attempt, state, offered_now, offering_id, offering_status';

export interface Journey {
  student_id: string;
  full_name: string;
  first_name: string | null;
  matric_no: string | null;
  student_number: string | null;
  admission_status: string;
  student_status: string | null;
  stage: string;
  programme_version_id: string | null;
  programme_code: string | null;
  programme_name: string | null;
  version_label: string | null;
  duration_years: number | null;
  semesters_per_year: number | null;
  credits_required: number | null;
  award_title: string | null;
  year_label: string | null;
  starts_in: number | null;
  term_sequence: number | null;
  term_name: string | null;
  programme_year: number | null;
  credits_earned: number;
  credits_registered: number;
  credits_against_award: number | null;
  courses_passed: number;
  courses_failed: number;
  courses_registered: number;
  courses_outstanding: number;
  cgpa: number | null;
  last_semester_gpa: number | null;
  registered_this_term: number;
  credits_this_term: number;
  registration_window_recorded: boolean | null;
  registration_open: boolean | null;
  registration_opens: string | null;
  registration_closes: string | null;
  graduation_id: string | null;
  conferred_on: string | null;
  classification: string | null;
}

interface Entry {
  entry_id: string; course_id: string; course_code: string; course_title: string;
  year: number; semester: number; requirement: string; credits: number;
  grade: string | null; attempt: number | null;
  state: string; offered_now: boolean | null; offering_status: string | null;
}

/** One read, shared by the dashboard and this page. */
export async function readJourney(): Promise<
  { journey: Journey | null; failed: string | null }
> {
  try {
    const { data, error } = await within(
      supabase.from('my_journey').select(JOURNEY).maybeSingle(),
    );
    if (error) return { journey: null, failed: error.message };
    return { journey: (data ?? null) as unknown as Journey | null, failed: null };
  } catch (e) {
    return {
      journey: null,
      failed: e instanceof Error ? e.message : 'Your record could not be read.',
    };
  }
}

export default function MyProgramme({ onNavigate }: { onNavigate?: (v: ViewType) => void }) {
  // ---------------------------------------------------------------------
  // THE JOURNEY COMES FROM THE CONTEXT, NOT FROM A SECOND READ.
  //
  // This screen used to call `readJourney()` for itself. It was correct and
  // it was measurably worse: the portal had already read the same row when
  // the student signed in, so opening this page made a duplicate round trip
  // — and when the database was out of reach, the student watched a blank
  // skeleton for eight seconds before being told something the portal had
  // known since the moment they arrived.
  //
  // Found by rendering it and timing the skeleton, not by reading the code.
  // ---------------------------------------------------------------------
  const { journey, loading: journeyLoading, failed: journeyFailed } = useJourney();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (journeyLoading) return;
    if (journeyFailed) { setFailed(journeyFailed); setLoading(false); return; }
    // The curriculum is this screen's own read — nothing else in the portal
    // needs every course of the degree, so it is not worth holding in context.
    if (journey?.programme_version_id) {
      try {
        const { data } = await within(
          supabase.from('my_curriculum').select(CURRICULUM),
        );
        setEntries((data ?? []) as unknown as Entry[]);
      } catch { setEntries([]); }
    }
    setLoading(false);
  }, [journey?.programme_version_id, journeyLoading, journeyFailed]);

  useEffect(() => { void load(); }, [load]);

  const terms = useMemo(() => {
    const out: { year: number; semester: number }[] = [];
    const years = journey?.duration_years ?? 0;
    const per = journey?.semesters_per_year ?? 2;
    for (let y = 1; y <= years; y += 1) {
      for (let s = 1; s <= per; s += 1) out.push({ year: y, semester: s });
    }
    return out;
  }, [journey?.duration_years, journey?.semesters_per_year]);

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="Your programme could not be read"
          description={`${failed}. If migration 070 has not been run on this database, the view `
            + 'this page reads does not exist yet.'}
        />
      </Card>
    );
  }

  if (loading || journeyLoading) {
    return <Card className="overflow-hidden"><SkeletonRows rows={6} cols={4} /></Card>;
  }

  // ---- NOT A STUDENT, OR NOT YET ON A CURRICULUM ---------------------------
  //
  // THE CASE THIS PAGE MUST NOT GET WRONG. Drawing an empty curriculum for
  // somebody whose application is under review tells them they have a place;
  // drawing "0 / 0 credits" for an enrolled student with no curriculum reads
  // as a finished degree. Both get the stage's own sentence instead.
  if (!journey || !journey.programme_version_id) {
    const meaning = meaningOf(journey?.stage);
    return (
      <Card>
        <EmptyState
          icon={<GraduationCap size={20} />}
          title={journey ? meaning.heading : 'No student record'}
          description={journey
            ? `${meaning.says}${meaning.waitingOn ? ` Waiting on: ${meaning.waitingOn}` : ''}`
            : 'Your account is not linked to a student record. If you have been admitted and '
              + 'this is wrong, write to the Registry.'}
        />
      </Card>
    );
  }

  const j = journey;
  const short = j.credits_against_award !== null && j.credits_against_award < 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={j.programme_name ?? j.programme_code ?? 'Your programme'}
        subtitle={[
          j.award_title,
          j.year_label ? `${j.year_label} · ${j.term_name ?? `Semester ${j.term_sequence}`}` : null,
          j.programme_year ? `Year ${j.programme_year} of ${j.duration_years}` : null,
        ].filter(Boolean).join(' · ')}
      />

      {/* ---- THE PROGRAMME PROFILE, as the University listed it ---- */}
      <Card className="p-5">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Award" value={j.award_title} />
          <Fact label="Duration"
            value={j.duration_years ? `${j.duration_years} year${j.duration_years === 1 ? '' : 's'}` : null} />
          <Fact label="Credits" value={j.credits_required ? String(j.credits_required) : null} />
          <Fact label="Current level"
            value={j.programme_year ? `Year ${j.programme_year}` : null} />
          <Fact label="Current semester"
            value={j.term_name ?? (j.term_sequence ? `Semester ${j.term_sequence}` : null)} />
          <Fact label="Curriculum" value={j.version_label} />
        </dl>
      </Card>

      {/* ---- PROGRESS ---- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          value={j.credits_required === null
            ? String(j.credits_earned)
            : `${j.credits_earned} / ${j.credits_required}`}
          label="Credits earned"
          note={j.credits_required === null
            ? 'Your programme states no total'
            : short
              ? `${Math.abs(j.credits_against_award as number)} still to earn`
              : 'You have the credits for the award'}
          tone={j.credits_required === null ? 'plain' : short ? 'plain' : 'ok'}
        />
        <Figure value={String(j.courses_registered)} label="Courses in progress"
          note={j.credits_this_term ? `${j.credits_this_term} credits this semester` : 'None this semester'} />
        <Figure value={String(j.courses_outstanding)} label="Still to take"
          note={j.courses_outstanding === 0 ? 'Nothing left' : 'Across the whole programme'} />
        <Figure
          value={j.cgpa === null ? '—' : Number(j.cgpa).toFixed(2)}
          label="Cumulative GPA"
          note={j.cgpa === null ? 'No results approved yet' : undefined}
          tone={j.courses_failed > 0 ? 'attention' : 'plain'}
        />
      </div>

      {j.courses_failed > 0 && (
        <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4
                         dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            {j.courses_failed} course{j.courses_failed === 1 ? '' : 's'} you have taken
            {j.courses_failed === 1 ? ' was' : ' were'} not passed. They are marked below and have
            to be repeated before the award — a failed course earns no credits.
          </p>
        </Card>
      )}

      {/* ------------------------------------------------------------------
          THE CURRICULUM, YEAR BY YEAR, SEMESTER BY SEMESTER.

          EVERY TERM OF THE PROGRAMME IS DRAWN, including the ones not reached
          yet. A first-year student seeing Year 2 is seeing their degree; a
          list of only what they have done cannot show what it leads to.
          ------------------------------------------------------------------ */}
      {Array.from({ length: j.duration_years ?? 0 }, (_, i) => i + 1).map((year) => (
        <div key={year} className="space-y-3">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                         dark:text-[#c8b6e8]">
            Year {year}
            {j.programme_year === year && (
              <span className="ml-2 rounded-full bg-[#422e59] px-2 py-0.5 text-[10px]
                               font-medium normal-case tracking-normal text-white">
                You are here
              </span>
            )}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {terms.filter((t) => t.year === year).map((t) => {
              const inTerm = entries
                .filter((e) => e.year === t.year && e.semester === t.semester)
                .sort((a, b) => a.course_code.localeCompare(b.course_code));
              const earned = inTerm.filter((e) => e.state === 'passed')
                .reduce((n, e) => n + Number(e.credits), 0);
              const total = inTerm.reduce((n, e) => n + Number(e.credits), 0);
              return (
                <Card key={`${t.year}.${t.semester}`} className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">
                      Semester {t.semester}
                    </h3>
                    <span className="text-xs tabular-nums text-[#6b6076] dark:text-[#9c93ad]">
                      {earned} / {total} credits
                    </span>
                  </div>
                  {inTerm.length === 0 && (
                    <p className="rounded-lg border border-dashed border-[#ded6c8] p-3 text-center
                                  text-xs text-[#a49bb0] dark:border-[#3d3349]">
                      No courses in this semester of your curriculum.
                    </p>
                  )}
                  <ul className="space-y-1">
                    {inTerm.map((e) => <CourseLine key={e.entry_id} entry={e} />)}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {entries.length === 0 && (j.duration_years ?? 0) > 0 && (
        <Card>
          <EmptyState
            icon={<GraduationCap size={20} />}
            title="Your curriculum has no courses in it yet"
            description={'The University has not yet written the courses into this curriculum. '
              + 'Until it does there is nothing to register for and no progress to show.'}
          />
        </Card>
      )}
    </div>
  );
}

function CourseLine({ entry: e }: { entry: Entry }) {
  // THE FOUR WORDS THE UNIVERSITY ASKED FOR, decided in one place — see
  // `courseStanding` and the note on the fourth of them.
  const standing = courseStanding(e.state, e.offered_now);
  const icon = standing.tone === 'done' ? <CheckCircle2 size={13} className="text-emerald-600" />
    : standing.tone === 'failed' ? <X size={13} className="text-red-600" />
      : standing.tone === 'now' ? <Clock size={13} className="text-[#422e59] dark:text-[#c8b6e8]" />
        : standing.tone === 'todo' ? <Circle size={13} className="text-[#a07c12]" />
          : <CircleDashed size={13} className="text-[#c9c1d2]" />;

  return (
    <li className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
      standing.tone === 'failed' ? 'bg-red-50 dark:bg-red-950/30'
        : standing.tone === 'later' ? 'opacity-60'
          : 'bg-[#faf8f4] dark:bg-[#241f2c]'
    }`}>
      <span className="shrink-0">{icon}</span>
      <span className="w-20 shrink-0 font-semibold text-[#422e59] dark:text-[#c8b6e8]">
        {e.course_code}
      </span>
      <span className="min-w-0 flex-1 truncate text-[#33234a] dark:text-[#e4dcf0]">
        {e.course_title}
      </span>
      {e.attempt !== null && e.attempt > 1 && (
        <span className="shrink-0 text-[10px] text-[#a07c12]">attempt {e.attempt}</span>
      )}
      <span className={`shrink-0 text-[10px] ${
        standing.tone === 'failed' ? 'font-medium text-red-700 dark:text-red-300'
          : standing.tone === 'todo' ? 'text-[#a07c12]'
            : 'text-[#a49bb0]'
      }`}>
        {e.grade ?? standing.label}
      </span>
      <span className="w-5 shrink-0 text-right tabular-nums text-[#6b6076] dark:text-[#9c93ad]">
        {e.credits}
      </span>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[#a49bb0]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
        {/* NOT INVENTED. A programme that states no duration says so rather
            than being given a plausible one. */}
        {value ?? <span className="font-normal text-[#a49bb0]">Not recorded</span>}
      </dd>
    </div>
  );
}

function Figure({
  value, label, note, tone = 'plain',
}: {
  value: string; label: string; note?: string; tone?: 'plain' | 'ok' | 'attention';
}) {
  return (
    <Card className="p-5">
      <p className={`font-heading text-2xl font-bold tabular-nums ${
        tone === 'attention' ? 'text-[#a07c12]'
          : tone === 'ok' ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-[#422e59] dark:text-[#c8b6e8]'
      }`}>
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-[#33234a] dark:text-[#e4dcf0]">{label}</p>
      {note && <p className="mt-0.5 text-[11px] text-[#a49bb0] dark:text-[#7b7289]">{note}</p>}
    </Card>
  );
}
