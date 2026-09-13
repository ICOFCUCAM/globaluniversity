'use client';

// ---------------------------------------------------------------------------
// THE CURRICULUM BUILDER.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "Instead of manually entering semesters as you showed in the first
// screenshot, the academic administrator should be able to construct the
// programme visually… Add course should open a proper course SELECTOR rather
// than creating an isolated course. And the system calculates: Programme total:
// 120 / 120 credits, with warnings if the curriculum is incomplete."
//
// Both halves of that were impossible until 057. A selector needs a catalogue
// of courses that exist independently of any programme; a running total needs
// somewhere to record what a course is worth IN THIS programme. Year, semester
// and core/elective used to live on the COURSE, which is why the same course
// could not be core in one programme and elective in another.
//
// ---------------------------------------------------------------------------
// THE GRID IS DRAWN FROM THE PROGRAMME, NOT FROM THE COURSES
// ---------------------------------------------------------------------------
//
// Every term the programme runs gets a panel, whether or not anything is in it.
// A three-year programme with two semesters a year draws six panels on a
// curriculum with one course in it — so an empty Semester 4 is visible as an
// empty panel rather than as an absence nobody notices.
//
// That is the difference between a builder and a list. A list of what has been
// added cannot show what has not.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { can } from '@/lib/roles';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card, EmptyState, PageHeader, SkeletonRows,
} from '@/components/ui/portal';
import {
  Plus, X, ArrowLeft, AlertTriangle, CheckCircle2, Lock, Search,
} from 'lucide-react';
import { titleOf, within } from './ProgrammeRegister';

// Single string literals — concatenation collapses the inferred row type.
// eslint-disable-next-line max-len
const PROGRESS = 'version_id, programme_id, code, award_level, version_label, status, duration_years, semesters_per_year, total_credits, courses_in_curriculum, credits_in_curriculum, credits_against_claim, terms_with_courses, terms_expected';
const ENTRIES = 'id, course_id, year, semester, requirement, credits';
const COURSES = 'id, code, title, credit_unit';

interface Progress {
  version_id: string; code: string; award_level: string; version_label: string;
  status: string; duration_years: number; semesters_per_year: number;
  total_credits: number | null; courses_in_curriculum: number;
  credits_in_curriculum: number; credits_against_claim: number;
  terms_with_courses: number; terms_expected: number;
}
interface Entry {
  id: string; course_id: string; year: number; semester: number;
  requirement: string; credits: number | null;
}
interface Course { id: string; code: string; title: string; credit_unit: number; }

const REQUIREMENT_LABEL: Record<string, string> = {
  core: 'Core',
  elective: 'Elective',
  'required-elective': 'Required elective',
};

/** The terms a programme runs, drawn whether or not anything sits in them. */
function termsOf(p: Progress): { year: number; semester: number }[] {
  const out: { year: number; semester: number }[] = [];
  for (let y = 1; y <= p.duration_years; y += 1) {
    for (let s = 1; s <= p.semesters_per_year; s += 1) out.push({ year: y, semester: s });
  }
  return out;
}

export default function CurriculumBuilder({
  versionId, onBack,
}: {
  versionId: string;
  onBack?: () => void;
}) {
  const { user } = useAuth();
  const mayEdit = can(user?.role, 'manage-courses');

  const [p, setP] = useState<Progress | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [adding, setAdding] = useState<{ year: number; semester: number } | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // A FAILED READ IS NOT A SKELETON FOREVER — see the same note in
  // ProgrammeRegister. Rendered against a database it cannot reach, the first
  // version of this drew its loading state and never stopped.
  const load = useCallback(async () => {
    try {
    const [prog, ent, crs] = await within(Promise.all([
      supabase.from('curriculum_progress').select(PROGRESS).eq('version_id', versionId).maybeSingle(),
      supabase.from('curriculum_entries').select(ENTRIES).eq('programme_version_id', versionId),
      supabase.from('courses').select(COURSES).order('code').limit(1000),
    ]));
    if (prog.error) { setFailed(prog.error.message); return; }
    setFailed(null);
    setP((prog.data ?? null) as unknown as Progress | null);
    setEntries((ent.data ?? []) as unknown as Entry[]);
    setCourses((crs.data ?? []) as unknown as Course[]);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'This curriculum could not be read.');
    }
  }, [versionId]);

  useEffect(() => { void load(); }, [load]);

  const byId = useMemo(() => {
    const m = new Map<string, Course>();
    for (const c of courses) m.set(c.id, c);
    return m;
  }, [courses]);

  // THE CREDIT THIS PROGRAMME COUNTS, which is the entry's own figure where it
  // has one and the course's otherwise — the same rule `curriculum_progress`
  // applies, so the panel totals and the header total cannot disagree.
  const creditOf = useCallback(
    (e: Entry) => e.credits ?? byId.get(e.course_id)?.credit_unit ?? 0,
    [byId],
  );

  // A CURRICULUM FREEZES WHEN IT IS APPROVED. The route refuses and so does the
  // database; this stops the buttons being offered at all.
  const frozen = !!p && ['approved', 'published', 'superseded'].includes(p.status);
  const editable = mayEdit && !frozen;

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setNote(null);
    const out = await authedPost('/api/academic/curriculum', payload);
    setBusy(false);
    if (!out.ok) {
      setNote({ tone: 'bad', text: String(out.detail ?? out.error ?? 'That did not work.') });
      return false;
    }
    await load();
    return true;
  }

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="This curriculum could not be read"
          description={`${failed}. If migration 057 has not been run on this database the tables do not exist yet.`}
        />
      </Card>
    );
  }
  if (p === null) return <Card className="overflow-hidden"><SkeletonRows rows={6} cols={3} /></Card>;

  const terms = termsOf(p);
  const short = p.total_credits !== null && p.credits_against_claim !== 0;
  const emptyTerms = terms.filter(
    (t) => !entries.some((e) => e.year === t.year && e.semester === t.semester),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={titleOf(p.code)}
        subtitle={`${p.award_level} · ${p.duration_years} year${p.duration_years === 1 ? '' : 's'} · `
          + `${terms.length} semesters · version ${p.version_label}`}
        action={onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl border border-[#ded6c8] px-3 py-2
                       text-sm text-[#6b6076] hover:bg-[#faf8f4]
                       dark:border-[#3d3349] dark:text-[#9c93ad] dark:hover:bg-[#241f2c]"
          >
            <ArrowLeft size={14} /> All programmes
          </button>
        )}
      />

      {/* ------------------------------------------------------------------
          THE RUNNING TOTAL, which is what the University asked for by name:
          "Programme total: 120 / 120 credits, with warnings if the curriculum
          is incomplete."
          ------------------------------------------------------------------ */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#a49bb0] dark:text-[#7b7289]">
              Programme total
            </p>
            <p className={`font-heading text-2xl font-bold tabular-nums ${
              p.total_credits === null ? 'text-[#6b6076] dark:text-[#9c93ad]'
                : short ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-700 dark:text-emerald-300'
            }`}>
              {p.credits_in_curriculum}
              {p.total_credits !== null && <> / {p.total_credits}</>}
              <span className="ml-1 text-sm font-normal">credits</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.total_credits === null && (
              <Warning icon={<AlertTriangle size={14} />}>
                This programme has no credit total recorded, so nothing can be measured against it.
              </Warning>
            )}
            {short && (
              <Warning icon={<AlertTriangle size={14} />} tone="bad">
                {p.credits_against_claim < 0
                  ? `${Math.abs(p.credits_against_claim)} credits short of what this programme claims.`
                  : `${p.credits_against_claim} credits more than this programme claims.`}
              </Warning>
            )}
            {emptyTerms.length > 0 && (
              <Warning icon={<AlertTriangle size={14} />}>
                {emptyTerms.length} of {terms.length} semesters have no courses in them.
              </Warning>
            )}
            {!short && p.total_credits !== null && emptyTerms.length === 0 && (
              <Warning icon={<CheckCircle2 size={14} />} tone="ok">
                Complete: every semester has courses and the credits add up.
              </Warning>
            )}
            {frozen && (
              <Warning icon={<Lock size={14} />}>
                This curriculum has been approved and cannot be changed. A revision is a new version.
              </Warning>
            )}
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------------
          THE CHAIN, AS BUTTONS.

          A builder that cannot approve what it built is half a feature — and
          until this existed `programme_versions` was a table the portal read
          and nothing could write, which is exactly what reachability.test.mjs
          is for. It found this.

          WHO SEES WHICH BUTTON is decided by the route, not here; this only
          decides what is OFFERED. The Vice-Chancellor's signature is the one
          058 requires, and a caller who does not hold that office is refused
          with a sentence naming who does.
          ------------------------------------------------------------------ */}
      {mayEdit && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
            {p.status === 'draft' && 'This curriculum is a draft. Nothing reads it until it is approved and put in force.'}
            {p.status === 'board_review' && 'Sent for approval. It is the Vice-Chancellor who signs a curriculum.'}
            {p.status === 'approved' && 'Approved. Put it in force to make it the curriculum students read.'}
            {p.status === 'published' && 'In force. This is the curriculum students are examined against.'}
            {['superseded', 'withdrawn'].includes(p.status) && 'No longer in force.'}
          </p>
          <div className="flex gap-2">
            {p.status === 'draft' && (
              <button
                onClick={() => act({ action: 'submit', versionId })}
                disabled={busy || p.courses_in_curriculum === 0}
                title={p.courses_in_curriculum === 0
                  ? 'An empty curriculum has nothing to approve.'
                  : undefined}
                className="rounded-xl bg-[#422e59] px-4 py-2 text-sm font-medium text-white
                           hover:bg-[#322244] disabled:opacity-40"
              >
                Send for approval
              </button>
            )}
            {p.status === 'board_review' && (
              <button
                onClick={async () => {
                  const out = await authedPost('/api/academic/curriculum',
                    { action: 'approve', versionId });
                  if (!out.ok) {
                    setNote({ tone: 'bad', text: String(out.detail ?? out.error) });
                  } else if (out.approved === false) {
                    // SIGNED, BUT THE QUORUM IS NOT COMPLETE. The database names
                    // who has still to sign; that sentence is shown rather than
                    // a claim that nothing happened.
                    setNote({ tone: 'ok', text: `Your signature is recorded. ${out.detail ?? ''}` });
                  } else {
                    setNote({ tone: 'ok', text: 'Approved.' });
                  }
                  await load();
                }}
                disabled={busy}
                className="rounded-xl bg-[#422e59] px-4 py-2 text-sm font-medium text-white
                           hover:bg-[#322244] disabled:opacity-40"
              >
                Approve
              </button>
            )}
            {p.status === 'approved' && (
              <button
                onClick={() => act({ action: 'publish', versionId })}
                disabled={busy}
                className="rounded-xl bg-[#422e59] px-4 py-2 text-sm font-medium text-white
                           hover:bg-[#322244] disabled:opacity-40"
              >
                Put in force
              </button>
            )}
          </div>
        </Card>
      )}

      {note && (
        <div className={`rounded-xl border p-3 text-sm ${
          note.tone === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
            : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
        }`}>
          {note.text}
        </div>
      )}

      {/* THE GRID. One panel per term the programme runs — see the header: an
          empty Semester 4 must be visible as an empty panel. */}
      {Array.from({ length: p.duration_years }, (_, i) => i + 1).map((year) => (
        <div key={year} className="space-y-3">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59] dark:text-[#c8b6e8]">
            Year {year}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {terms.filter((t) => t.year === year).map((t) => {
              const inTerm = entries
                .filter((e) => e.year === t.year && e.semester === t.semester)
                .sort((a, b) => (byId.get(a.course_id)?.code ?? '')
                  .localeCompare(byId.get(b.course_id)?.code ?? ''));
              const total = inTerm.reduce((sum, e) => sum + creditOf(e), 0);
              return (
                <Card key={`${t.year}.${t.semester}`} className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">
                      Semester {t.semester}
                    </h3>
                    <span className="text-xs tabular-nums text-[#6b6076] dark:text-[#9c93ad]">
                      {total} credits
                    </span>
                  </div>

                  {inTerm.length === 0 && (
                    <p className="rounded-lg border border-dashed border-[#ded6c8] p-4 text-center
                                  text-xs text-[#a49bb0] dark:border-[#3d3349] dark:text-[#7b7289]">
                      Nothing in this semester yet.
                    </p>
                  )}

                  <ul className="space-y-1.5">
                    {inTerm.map((e) => {
                      const c = byId.get(e.course_id);
                      return (
                        <li key={e.id}
                          className="flex items-center gap-2 rounded-lg bg-[#faf8f4] px-3 py-2
                                     dark:bg-[#241f2c]">
                          <span className="w-20 shrink-0 text-xs font-semibold tabular-nums
                                           text-[#422e59] dark:text-[#c8b6e8]">
                            {c?.code ?? '—'}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-[#33234a] dark:text-[#e4dcf0]">
                            {c?.title ?? 'A course that is no longer in the catalogue'}
                          </span>
                          <span className="shrink-0 text-[11px] text-[#a49bb0] dark:text-[#7b7289]">
                            {REQUIREMENT_LABEL[e.requirement] ?? e.requirement}
                          </span>
                          <span className="w-8 shrink-0 text-right text-xs font-medium tabular-nums
                                           text-[#6b6076] dark:text-[#9c93ad]">
                            {creditOf(e)}
                          </span>
                          {editable && (
                            <button
                              onClick={() => act({ action: 'remove', entryId: e.id })}
                              disabled={busy}
                              aria-label={`Remove ${c?.code ?? 'course'}`}
                              className="shrink-0 rounded p-1 text-[#a49bb0] hover:bg-red-50
                                         hover:text-red-600 dark:hover:bg-red-950/40"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {editable && (
                    <button
                      onClick={() => setAdding(t)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg
                                 border border-dashed border-[#ded6c8] py-2 text-xs font-medium
                                 text-[#6b6076] hover:border-[#422e59] hover:text-[#422e59]
                                 dark:border-[#3d3349] dark:text-[#9c93ad]"
                    >
                      <Plus size={13} /> Add course
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {adding && (
        <CourseSelector
          courses={courses}
          alreadyIn={new Set(entries.map((e) => e.course_id))}
          term={adding}
          busy={busy}
          onClose={() => setAdding(null)}
          onPick={async (courseId, requirement, credits) => {
            const ok = await act({
              action: 'place',
              versionId,
              courseId,
              year: adding.year,
              semester: adding.semester,
              requirement,
              credits,
            });
            if (ok) setAdding(null);
          }}
        />
      )}
    </div>
  );
}

function Warning({
  children, icon, tone = 'warn',
}: {
  children: React.ReactNode; icon: React.ReactNode; tone?: 'warn' | 'bad' | 'ok';
}) {
  const tones = {
    warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
    bad: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200',
  };
  return (
    <span className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${tones[tone]}`}>
      {icon} {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// THE SELECTOR, AND IT IS NOT A CREATE FORM.
//
// The University's objection, exactly: "Add course should open a proper course
// selector rather than creating an isolated course."
//
// The old Course Management screen created a course from a modal and assigned
// it to whichever department happened to have the code 'CS' — so a course made
// while building a curriculum belonged nowhere and appeared in no other
// programme. Here a course is CHOSEN from the catalogue, and one already in
// this curriculum is shown greyed rather than hidden, because hiding it makes
// somebody search for it twice.
// ---------------------------------------------------------------------------
function CourseSelector({
  courses, alreadyIn, term, busy, onClose, onPick,
}: {
  courses: Course[];
  alreadyIn: Set<string>;
  term: { year: number; semester: number };
  busy: boolean;
  onClose: () => void;
  onPick: (courseId: string, requirement: string, credits: number | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [requirement, setRequirement] = useState('core');

  const shown = courses.filter((c) => {
    const q = query.trim().toLowerCase();
    return !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
  }).slice(0, 60);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a course"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white
                   dark:bg-[#1f1a27]"
      >
        <div className="flex items-center justify-between border-b border-[#f0ece4] px-5 py-4
                        dark:border-[#2a2333]">
          <div>
            <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">
              Add a course
            </h3>
            <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
              Year {term.year}, semester {term.semester}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="rounded-lg p-1 hover:bg-[#f2eee6] dark:hover:bg-[#2a2333]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 border-b border-[#f0ece4] px-5 py-3 dark:border-[#2a2333]">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a49bb0]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the course catalogue…"
              aria-label="Search the course catalogue"
              className="w-full rounded-lg border border-[#ded6c8] bg-gray-50 py-2 pl-9 pr-3 text-sm
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35
                         dark:border-[#3d3349] dark:bg-[#241f2c]"
            />
          </div>
          <select
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            aria-label="Requirement"
            className="w-full rounded-lg border border-[#ded6c8] bg-gray-50 px-3 py-2 text-sm
                       dark:border-[#3d3349] dark:bg-[#241f2c]"
          >
            <option value="core">Core — every student must pass it</option>
            <option value="elective">Elective</option>
            <option value="required-elective">Required elective</option>
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {courses.length === 0 && (
            <EmptyState
              title="The course catalogue is empty"
              description="Courses are added in Course Management. A curriculum is built from courses that already exist, so that the same course can sit in more than one programme."
            />
          )}
          {shown.map((c) => {
            const taken = alreadyIn.has(c.id);
            return (
              <button
                key={c.id}
                disabled={taken || busy}
                onClick={() => onPick(c.id, requirement, c.credit_unit)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left
                            ${taken
                              ? 'cursor-not-allowed opacity-45'
                              : 'hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]'}`}
              >
                <span className="w-20 shrink-0 text-xs font-semibold tabular-nums text-[#422e59]
                                 dark:text-[#c8b6e8]">
                  {c.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-[#33234a] dark:text-[#e4dcf0]">
                  {c.title}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-[#6b6076] dark:text-[#9c93ad]">
                  {taken ? 'already in' : `${c.credit_unit} cr`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
