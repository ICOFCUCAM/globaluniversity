'use client';

// ---------------------------------------------------------------------------
// ACADEMIC RECORDS — one student, one record.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "A student should have one academic record… courses, grades, GPA/CGPA,
// failed courses, repeats, outstanding requirements, academic standing,
// transcript, graduation eligibility."
//
// The transcript already answered half of it — what a student has PASSED. The
// half nobody could answer is the one a student actually asks: WHAT IS LEFT?
//
// ---------------------------------------------------------------------------
// THE SCREEN IS ORGANISED THE WAY THE QUESTION IS ASKED
// ---------------------------------------------------------------------------
//
// Not "here are the results rows". A student thinks in years and semesters,
// and then in courses within them — so the curriculum is drawn as a grid of
// terms, exactly as the Curriculum Builder draws it, with each course carrying
// its own state.
//
// AND EVERY TERM OF THE PROGRAMME IS DRAWN, whether or not the student has
// reached it. A first-year student seeing an empty Year 3 is seeing the truth;
// a list of only what they have done cannot show what is left, which is the
// entire question.
//
// ---------------------------------------------------------------------------
// AN UNAPPROVED MARK IS NOT A PASS, AND THE SCREEN SAYS SO
// ---------------------------------------------------------------------------
//
// 067's view counts only APPROVED results. A mark entered and not yet approved
// leaves the course reading "registered", because a board may yet send it back
// — and telling a student they have finished a course the University has not
// agreed they have finished is the one mistake a record screen must not make.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { can } from '@/lib/roles';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card, EmptyState, PageHeader, SkeletonRows,
} from '@/components/ui/portal';
import {
  AlertTriangle, CheckCircle2, Search, GraduationCap, Clock, X, Circle, ArrowLeft,
} from 'lucide-react';
import { within } from './ProgrammeRegister';

// SINGLE STRING LITERALS — concatenation collapses the inferred row type.
// eslint-disable-next-line max-len
const RECORD = 'student_id, matric_no, student_number, full_name, status, student_status, academic_standing, admission_year, programme_version_id, programme_code, programme_name, version_label, duration_years, semesters_per_year, credits_required, courses_passed, courses_failed, courses_registered, courses_outstanding, credits_earned, credits_registered, credits_against_award, cgpa, last_semester_gpa, last_computed_year, last_computed_semester';
// eslint-disable-next-line max-len
const PROGRESS = 'student_id, entry_id, course_id, course_code, course_title, year, semester, requirement, credits, grade, grade_point, attempt, taken_in_year, taken_in_semester, state';
// eslint-disable-next-line max-len
const TERMS = 'student_id, academic_year, semester, courses_taken, courses_passed, courses_failed, awaiting_result, credits_attempted, credits_earned, gpa, cgpa';

interface Rec {
  student_id: string;
  matric_no: string | null;
  student_number: string | null;
  full_name: string;
  status: string;
  student_status: string | null;
  academic_standing: string | null;
  admission_year: number | null;
  programme_version_id: string | null;
  programme_code: string | null;
  programme_name: string | null;
  version_label: string | null;
  duration_years: number | null;
  semesters_per_year: number | null;
  credits_required: number | null;
  courses_passed: number;
  courses_failed: number;
  courses_registered: number;
  courses_outstanding: number;
  credits_earned: number;
  credits_registered: number;
  credits_against_award: number | null;
  cgpa: number | null;
  last_semester_gpa: number | null;
  last_computed_year: number | null;
  last_computed_semester: number | null;
}
interface Entry {
  student_id: string; entry_id: string; course_id: string;
  course_code: string; course_title: string;
  year: number; semester: number; requirement: string; credits: number;
  grade: string | null; grade_point: number | null; attempt: number | null;
  taken_in_year: number | null; taken_in_semester: number | null;
  state: 'passed' | 'failed' | 'registered' | 'not-taken';
}
interface TermRow {
  student_id: string; academic_year: number; semester: number;
  courses_taken: number; courses_passed: number; courses_failed: number;
  awaiting_result: number; credits_attempted: number; credits_earned: number;
  gpa: number | null; cgpa: number | null;
}

const STATE_LABEL: Record<string, string> = {
  passed: 'Passed',
  failed: 'Failed',
  registered: 'Registered',
  'not-taken': 'Not taken',
};

export default function AcademicRecords() {
  const { user } = useAuth();
  // THE REGISTRY SEES EVERY RECORD. A student sees their own, and the route
  // that would let them see another's does not exist — this screen reads
  // through RLS, which is what decides it.
  const isRegistry = can(user?.role, 'view-registered-students');

  const [records, setRecords] = useState<Rec[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [query, setQuery] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const [loadingOne, setLoadingOne] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await within(
        supabase.from('student_academic_record').select(RECORD).order('full_name').limit(500),
      );
      if (error) { setFailed(error.message); setRecords([]); return; }
      setFailed(null);
      const rows = (data ?? []) as unknown as Rec[];
      setRecords(rows);
      // A STUDENT LOOKING AT THEIR OWN RECORD SEES ONE ROW, and is taken
      // straight into it rather than shown a list of one.
      if (!isRegistry && rows.length === 1) setOpenId(rows[0].student_id);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The academic record could not be read.');
      setRecords([]);
    }
  }, [isRegistry]);

  useEffect(() => { void load(); }, [load]);

  const openOne = useCallback(async (id: string) => {
    setLoadingOne(true);
    try {
      const [pr, tm] = await within(Promise.all([
        supabase.from('student_curriculum_progress').select(PROGRESS).eq('student_id', id),
        supabase.from('student_term_record').select(TERMS).eq('student_id', id)
          .order('academic_year').order('semester'),
      ]));
      setEntries((pr.data ?? []) as unknown as Entry[]);
      setTerms((tm.data ?? []) as unknown as TermRow[]);
    } catch {
      setEntries([]);
      setTerms([]);
    }
    setLoadingOne(false);
  }, []);

  useEffect(() => { if (openId) void openOne(openId); }, [openId, openOne]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records ?? [];
    return (records ?? []).filter((r) =>
      r.full_name.toLowerCase().includes(q)
      || (r.matric_no ?? '').toLowerCase().includes(q)
      || (r.programme_code ?? '').toLowerCase().includes(q));
  }, [records, query]);

  const open = (records ?? []).find((r) => r.student_id === openId) ?? null;

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="The academic record could not be read"
          description={`${failed}. If migration 067 has not been run on this database, the views `
            + 'this screen reads do not exist yet.'}
        />
      </Card>
    );
  }

  // =========================================================================
  // ONE RECORD
  // =========================================================================
  if (open) {
    return (
      <OneRecord
        record={open}
        entries={entries}
        terms={terms}
        loading={loadingOne}
        onBack={isRegistry ? () => { setOpenId(null); setEntries([]); setTerms([]); } : undefined}
      />
    );
  }

  // =========================================================================
  // THE REGISTER
  // =========================================================================
  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic records"
        subtitle="One student, one record: where they are up to in their own curriculum, and how far that is from the award."
      />

      <Card className="p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a49bb0]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a student by name, matriculation number or programme"
            aria-label="Find a student"
            className="w-full rounded-xl border border-[#ded6c8] bg-white py-2 pl-9 pr-3 text-sm
                       dark:border-[#3d3349] dark:bg-[#241f2c]"
          />
        </div>
      </Card>

      {records === null && <Card className="overflow-hidden"><SkeletonRows rows={6} cols={5} /></Card>}

      {records !== null && shown.length === 0 && (
        <Card>
          <EmptyState
            icon={<GraduationCap size={20} />}
            title={query ? 'No student matches that' : 'No academic records yet'}
            description={query
              ? 'Try a name, a matriculation number, or a programme code.'
              : 'A record appears here once a student is enrolled onto a programme version. A '
                + 'student with no programme version has no curriculum to be measured against.'}
          />
        </Card>
      )}

      <div className="space-y-2">
        {shown.map((r) => (
          <button
            key={r.student_id}
            onClick={() => setOpenId(r.student_id)}
            className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border
                       border-[#ece7de] bg-white p-4 text-left hover:border-[#422e59]
                       dark:border-[#2e2637] dark:bg-[#1f1a27]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">
                {r.full_name}
              </span>
              <span className="block text-xs text-[#6b6076] dark:text-[#9c93ad]">
                {r.matric_no ?? r.student_number ?? 'No matriculation number'}
                {r.programme_name ? ` · ${r.programme_name}` : ' · No programme'}
              </span>
            </span>
            <Progress record={r} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** The one-line answer: how far through, and whether it adds up. */
function Progress({ record: r }: { record: Rec }) {
  // NULL IS NOT ZERO. A programme with no credit total stated cannot be
  // measured against, and saying "0 / 0" would read as a complete degree.
  if (r.credits_required === null) {
    return (
      <span className="text-xs text-[#a49bb0]">
        {r.credits_earned} credits earned · the programme states no total
      </span>
    );
  }
  const done = r.credits_earned >= r.credits_required;
  return (
    <span className="flex items-center gap-3">
      <span className={`text-sm font-semibold tabular-nums ${
        done ? 'text-emerald-700 dark:text-emerald-300' : 'text-[#422e59] dark:text-[#c8b6e8]'
      }`}>
        {r.credits_earned} / {r.credits_required}
      </span>
      <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
        {r.cgpa === null ? 'No GPA computed' : `CGPA ${Number(r.cgpa).toFixed(2)}`}
      </span>
    </span>
  );
}

function OneRecord({
  record: r, entries, terms, loading, onBack,
}: {
  record: Rec;
  entries: Entry[];
  terms: TermRow[];
  loading: boolean;
  onBack?: () => void;
}) {
  // EVERY TERM THE PROGRAMME RUNS, drawn whether or not the student has
  // reached it. See the file header: a list of what has been done cannot show
  // what is left.
  const allTerms = useMemo(() => {
    const out: { year: number; semester: number }[] = [];
    const years = r.duration_years ?? 0;
    const per = r.semesters_per_year ?? 2;
    for (let y = 1; y <= years; y += 1) {
      for (let s = 1; s <= per; s += 1) out.push({ year: y, semester: s });
    }
    return out;
  }, [r.duration_years, r.semesters_per_year]);

  const short = r.credits_against_award !== null && r.credits_against_award < 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={r.full_name}
        subtitle={`${r.matric_no ?? r.student_number ?? 'No matriculation number'}`
          + `${r.programme_name ? ` · ${r.programme_name}` : ''}`
          + `${r.version_label ? ` · curriculum ${r.version_label}` : ''}`}
        action={onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl border border-[#ded6c8] px-3 py-2
                       text-sm text-[#6b6076] hover:bg-[#faf8f4]
                       dark:border-[#3d3349] dark:text-[#9c93ad] dark:hover:bg-[#241f2c]"
          >
            <ArrowLeft size={14} /> All records
          </button>
        )}
      />

      {!r.programme_version_id && (
        <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4
                         dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            This student is not attached to a curriculum version, so there is nothing to measure
            their progress against. Until they are, no degree audit can be performed for them and
            no outstanding course can be named.
          </p>
        </Card>
      )}

      {/* ---- THE FOUR FIGURES ---- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          value={r.credits_required === null
            ? String(r.credits_earned)
            : `${r.credits_earned} / ${r.credits_required}`}
          label="Credits earned"
          note={r.credits_required === null
            ? 'The programme states no total'
            : short
              ? `${Math.abs(r.credits_against_award as number)} short of the award`
              : 'The award requirement is met'}
          tone={r.credits_required === null ? 'plain' : short ? 'bad' : 'ok'}
        />
        <Figure
          value={r.cgpa === null ? '—' : Number(r.cgpa).toFixed(2)}
          label="Cumulative GPA"
          note={r.cgpa === null
            ? 'Not computed yet'
            : r.last_computed_year
              ? `As at ${r.last_computed_year} semester ${r.last_computed_semester}`
              : undefined}
        />
        <Figure
          value={String(r.courses_outstanding)}
          label="Courses still to take"
          note={`${r.courses_registered} registered now`}
          tone={r.courses_outstanding === 0 ? 'ok' : 'plain'}
        />
        <Figure
          value={String(r.courses_failed)}
          label="Courses failed"
          note={r.courses_failed === 0 ? 'None' : 'To be repeated'}
          tone={r.courses_failed > 0 ? 'bad' : 'ok'}
        />
      </div>

      {/* ---- ACADEMIC STANDING, WHERE THE RECORD CARRIES ONE ---- */}
      {(r.academic_standing || r.student_status) && (
        <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-xs">
          {r.student_status && (
            <span>
              <span className="text-[#a49bb0]">Status</span>{' '}
              <span className="font-medium text-[#33234a] dark:text-[#e4dcf0]">
                {r.student_status}
              </span>
            </span>
          )}
          {r.academic_standing && (
            <span>
              <span className="text-[#a49bb0]">Academic standing</span>{' '}
              <span className="font-medium text-[#33234a] dark:text-[#e4dcf0]">
                {r.academic_standing}
              </span>
            </span>
          )}
          {r.admission_year && (
            <span>
              <span className="text-[#a49bb0]">Admitted</span>{' '}
              <span className="font-medium text-[#33234a] dark:text-[#e4dcf0]">
                {r.admission_year}
              </span>
            </span>
          )}
        </Card>
      )}

      {loading && <Card className="overflow-hidden"><SkeletonRows rows={5} cols={4} /></Card>}

      {/* ------------------------------------------------------------------
          THE TERMS THE STUDENT HAS ACTUALLY SAT.

          Keyed on the year and semester the course was TAKEN in, not on the
          curriculum's — a student repeating a year takes a Year 1 course in
          their second year, and filing it under Year 1 would show them passing
          a term they were not enrolled in.
          ------------------------------------------------------------------ */}
      {!loading && terms.length > 0 && (
        <Card className="p-5">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                         dark:text-[#c8b6e8]">
            Terms sat
          </h2>
          <ul className="mt-3 space-y-1.5">
            {terms.map((t) => (
              <li key={`${t.academic_year}.${t.semester}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-[#faf8f4]
                           px-3 py-2 text-xs dark:bg-[#241f2c]">
                <span className="w-36 shrink-0 font-medium text-[#33234a] dark:text-[#e4dcf0]">
                  {t.academic_year}/{t.academic_year + 1} · Semester {t.semester}
                </span>
                <span className="tabular-nums text-[#6b6076] dark:text-[#9c93ad]">
                  {t.credits_earned} / {t.credits_attempted} credits
                </span>
                <span className="text-[#6b6076] dark:text-[#9c93ad]">
                  {t.courses_passed} passed
                  {t.courses_failed > 0 && `, ${t.courses_failed} failed`}
                  {t.awaiting_result > 0 && `, ${t.awaiting_result} awaiting a result`}
                </span>
                {t.gpa !== null && (
                  <span className="ml-auto tabular-nums text-[#422e59] dark:text-[#c8b6e8]">
                    GPA {Number(t.gpa).toFixed(2)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------------------------------------------------
          THE CURRICULUM, TERM BY TERM — including the terms not yet reached.
          ------------------------------------------------------------------ */}
      {!loading && r.programme_version_id && (
        <div className="space-y-4">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                         dark:text-[#c8b6e8]">
            The curriculum, and where they are up to
          </h2>
          {Array.from({ length: r.duration_years ?? 0 }, (_, i) => i + 1).map((year) => (
            <div key={year} className="space-y-2">
              <h3 className="text-xs font-semibold text-[#6b6076] dark:text-[#9c93ad]">
                Year {year}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {allTerms.filter((t) => t.year === year).map((t) => {
                  const inTerm = entries
                    .filter((e) => e.year === t.year && e.semester === t.semester)
                    .sort((a, b) => a.course_code.localeCompare(b.course_code));
                  const earned = inTerm
                    .filter((e) => e.state === 'passed')
                    .reduce((n, e) => n + Number(e.credits), 0);
                  const total = inTerm.reduce((n, e) => n + Number(e.credits), 0);
                  return (
                    <Card key={`${t.year}.${t.semester}`} className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">
                          Semester {t.semester}
                        </h4>
                        <span className="text-xs tabular-nums text-[#6b6076] dark:text-[#9c93ad]">
                          {earned} / {total} credits
                        </span>
                      </div>
                      {inTerm.length === 0 && (
                        <p className="rounded-lg border border-dashed border-[#ded6c8] p-3
                                      text-center text-xs text-[#a49bb0] dark:border-[#3d3349]">
                          No courses in this semester of the curriculum.
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
        </div>
      )}
    </div>
  );
}

function CourseLine({ entry: e }: { entry: Entry }) {
  const icon = e.state === 'passed' ? <CheckCircle2 size={13} className="text-emerald-600" />
    : e.state === 'failed' ? <X size={13} className="text-red-600" />
      : e.state === 'registered' ? <Clock size={13} className="text-[#422e59] dark:text-[#c8b6e8]" />
        : <Circle size={13} className="text-[#c9c1d2]" />;

  return (
    <li className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
      e.state === 'failed'
        ? 'bg-red-50 dark:bg-red-950/30'
        : e.state === 'not-taken'
          ? 'opacity-60'
          : 'bg-[#faf8f4] dark:bg-[#241f2c]'
    }`}>
      <span className="shrink-0">{icon}</span>
      <span className="w-20 shrink-0 font-semibold text-[#422e59] dark:text-[#c8b6e8]">
        {e.course_code}
      </span>
      <span className="min-w-0 flex-1 truncate text-[#33234a] dark:text-[#e4dcf0]">
        {e.course_title}
      </span>
      {/* A RESIT IS SHOWN AS ONE. The record carries the attempt, and hiding it
          would make a repeated course indistinguishable from a first pass. */}
      {e.attempt !== null && e.attempt > 1 && (
        <span className="shrink-0 text-[10px] text-[#a07c12]">attempt {e.attempt}</span>
      )}
      <span className="shrink-0 text-[10px] text-[#a49bb0]">
        {e.grade ?? STATE_LABEL[e.state]}
      </span>
      <span className="w-6 shrink-0 text-right tabular-nums text-[#6b6076] dark:text-[#9c93ad]">
        {e.credits}
      </span>
    </li>
  );
}

function Figure({
  value, label, note, tone = 'plain',
}: {
  value: string; label: string; note?: string; tone?: 'plain' | 'ok' | 'bad';
}) {
  return (
    <Card className="p-5">
      <p className={`font-heading text-2xl font-bold tabular-nums ${
        tone === 'bad' ? 'text-red-600 dark:text-red-400'
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
