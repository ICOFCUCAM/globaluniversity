'use client';

// ---------------------------------------------------------------------------
// THE PROGRAMME REGISTER — what the University offers, and how far each one is
// from being ready to offer.
//
// ---------------------------------------------------------------------------
// WHY THIS SCREEN EXISTS
// ---------------------------------------------------------------------------
//
// The University's own words: the Academic section "is currently organized
// around isolated utilities — Courses, Course Registration, Timetable, LMS —
// rather than around the University's actual academic structure."
//
// It read that way because there was nothing to organise around. Until 057 the
// five faculties and forty-one programmes were TypeScript constants compiled
// into the website; nobody could create one, edit one or version one, and no
// screen could list them because there was no list.
//
// This is the first screen in the portal that reads the academic structure as
// DATA. Everything on it is counted from the register: how many courses a
// curriculum has, what it adds up to, and how far that is from what the
// programme claims.
//
// ---------------------------------------------------------------------------
// THE COLUMN THAT MATTERS IS THE GAP
// ---------------------------------------------------------------------------
//
// A programme claiming 180 credits whose curriculum adds to 174 is a programme
// nobody can graduate from, and today that would be discovered by a student in
// their final year. `curriculum_progress` computes it; this prints it; and the
// number is red until it is zero.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, EmptyState, PageHeader, SkeletonRows, TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import { GraduationCap, Search, ArrowRight, AlertTriangle, Plus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { can, type Capability } from '@/lib/roles';
import { authedPost } from '@/lib/authedFetch';
import { FOCUS } from '@/lib/portalTheme';
import type { UserRole } from '@/lib/types';

/** The six the database constrains `programmes.award_level` to. */
const AWARD_LEVELS = ['Certificate', 'Diploma', "Bachelor's", 'Postgraduate Diploma',
  "Master's", 'Doctorate'];

/**
 * The University's own rulings on how long each award runs and what it is
 * worth, offered as starting figures and every one of them editable.
 *
 * The same table migration 072 applied to the twelve programmes that had no
 * credit total. Repeated here rather than imported because this is a FORM
 * DEFAULT and that was a one-off correction: the day the University changes
 * its mind about a Doctorate, the form should offer the new figure and the
 * twelve rows 072 already wrote must not move.
 */
const SHAPE: Record<string, { years: number; credits: number }> = {
  Certificate: { years: 1, credits: 60 },
  Diploma: { years: 1, credits: 120 },
  "Bachelor's": { years: 3, credits: 180 },
  'Postgraduate Diploma': { years: 1, credits: 120 },
  "Master's": { years: 2, credits: 120 },
  Doctorate: { years: 2, credits: 120 },
};

// A SINGLE STRING LITERAL — see the note in every other file that reads through
// supabase-js. Concatenation collapses the inferred row type silently.
// eslint-disable-next-line max-len
const PROGRESS = 'version_id, programme_id, code, award_level, version_label, status, duration_years, semesters_per_year, total_credits, courses_in_curriculum, credits_in_curriculum, credits_against_claim, terms_with_courses, terms_expected';

export interface ProgrammeProgress {
  version_id: string;
  programme_id: string;
  code: string;
  award_level: string;
  version_label: string;
  status: string;
  duration_years: number;
  semesters_per_year: number;
  total_credits: number | null;
  courses_in_curriculum: number;
  credits_in_curriculum: number;
  credits_against_claim: number;
  terms_with_courses: number;
  terms_expected: number;
}

/**
 * A read that answers, or says it could not.
 *
 * ---------------------------------------------------------------------------
 * WHY A TIMEOUT, AND WHY IT IS NOT A SANDBOX WORKAROUND
 * ---------------------------------------------------------------------------
 *
 * This screen was rendered against a database it could not reach and drew its
 * loading skeleton indefinitely. The first fix caught errors — and changed
 * nothing, because the request was not FAILING. It was hanging: supabase-js
 * reports an error when the server answers badly and simply never settles when
 * nothing answers at all.
 *
 * That is not peculiar to a sandbox. A Supabase project that is paused, a
 * network that drops, a DNS failure — every one of them ends here, and every
 * one of them currently renders as "still loading" forever, which is the one
 * outcome that tells the reader nothing and offers them nothing.
 *
 * So a read has a deadline. Fifteen seconds is far longer than any healthy
 * query and far shorter than a person's patience.
 * ---------------------------------------------------------------------------
 */
export async function within<T>(work: PromiseLike<T>, seconds = 15): Promise<T> {
  return Promise.race([
    work as Promise<T>,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(
          `The database did not answer within ${seconds} seconds`,
        )),
        seconds * 1000,
      );
    }),
  ]);
}

/** The programme code is the slug the site already uses. This is it, readable. */
export function titleOf(code: string): string {
  return code.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-[#f2eee6] text-[#6b6076] dark:bg-[#2a2333] dark:text-[#9c93ad]',
  department_review: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  faculty_review: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  board_review: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  approved: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  published: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  department_review: 'Department review',
  faculty_review: 'Faculty review',
  board_review: 'With the Vice-Chancellor',
  approved: 'Approved',
  published: 'In force',
  superseded: 'Superseded',
  withdrawn: 'Withdrawn',
};

export default function ProgrammeRegister({
  onOpen,
}: {
  onOpen?: (versionId: string) => void;
}) {
  const [rows, setRows] = useState<ProgrammeProgress[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [award, setAward] = useState('');
  const [creating, setCreating] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  // THE SAME CAPABILITY THAT GUARDS A SCHOOL AND A DEPARTMENT, because a
  // programme is the third level of the same structure. The route checks it
  // too; this only decides whether the button is drawn.
  const { user } = useAuth();
  const mayCreate = can(user?.role as UserRole, 'manage-academic-structure' as Capability);

  // -------------------------------------------------------------------------
  // A FAILED READ IS NOT AN EMPTY REGISTER, AND IT IS NOT A SKELETON FOREVER.
  //
  // The first version of this set `rows` only on success. Rendered against a
  // database it could not reach, it drew its loading skeleton and kept drawing
  // it — no error, no message, nothing to do. That is the worst of the three
  // possible endings, because a spinner reads as "still working".
  //
  // There are three answers and they need three states: the register is empty,
  // the read failed, or it is still loading. This distinguishes them.
  // -------------------------------------------------------------------------
  const load = useCallback(async () => {
    try {
      const { data, error } = await within(supabase
        .from('curriculum_progress')
        .select(PROGRESS)
        .order('code'));
      if (error) { setFailed(error.message); return; }
      setFailed(null);
      setRows((data ?? []) as unknown as ProgrammeProgress[]);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The register could not be read.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const awards = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.award_level))).sort(),
    [rows],
  );

  const shown = (rows ?? []).filter((r) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || r.code.toLowerCase().includes(q);
    return matchesQuery && (!award || r.award_level === award);
  });

  // COUNTED, NOT ASSERTED. Every figure in the summary comes from the rows on
  // screen — the portal has shipped invented dashboard numbers before.
  const withCurriculum = (rows ?? []).filter((r) => r.courses_in_curriculum > 0).length;
  const complete = (rows ?? []).filter(
    (r) => r.courses_in_curriculum > 0 && r.credits_against_claim === 0,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programmes"
        subtitle={failed
          ? 'The register could not be read'
          : rows === null
          ? 'Reading the register…'
          : `${rows.length} programme${rows.length === 1 ? '' : 's'} · `
            + `${withCurriculum} with a curriculum · ${complete} adding up to what they claim`}
        action={mayCreate ? (
          <button
            onClick={() => setCreating(true)}
            className={`flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2 text-sm
                        font-semibold text-white transition hover:bg-[#33234a] ${FOCUS}`}
          >
            <Plus size={15} /> New programme
          </button>
        ) : undefined}
      />

      {/* ------------------------------------------------------------------
          THE BUTTON THAT DID NOT EXIST.

          An audit found that nothing in the portal could create a programme.
          The University's forty-one were seeded by migration 060, and a
          forty-second meant writing SQL by hand — on a system whose whole
          purpose is that the University does not have to.

          It hid because no screen read `programmes` by name: every one went
          through `programme_in_force` or `curriculum_progress`, so the test
          that asks "can anything write what something reads" never had the
          question put to it.
          ------------------------------------------------------------------ */}
      {said && (
        <Card className={`flex items-start gap-3 p-4 ${
          said.ok ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
            : 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
        }`}>
          <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${
            said.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
          }`} />
          <p className={`text-xs leading-relaxed ${
            said.ok ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'
          }`}>
            {said.text}
          </p>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a49bb0] dark:text-[#7b7289]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search programmes…"
              aria-label="Search programmes"
              className="w-full rounded-lg border border-[#ded6c8] bg-gray-50 py-2 pl-9 pr-4 text-sm
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35
                         dark:border-[#3d3349] dark:bg-[#241f2c]"
            />
          </div>
          <select
            value={award}
            onChange={(e) => setAward(e.target.value)}
            aria-label="Filter by award"
            className="rounded-lg border border-[#ded6c8] bg-gray-50 px-3 py-2 text-sm
                       dark:border-[#3d3349] dark:bg-[#241f2c]"
          >
            <option value="">Every award</option>
            {awards.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </Card>

      {failed && (
        <Card>
          <EmptyState
            icon={<AlertTriangle size={20} />}
            title="The register could not be read"
            description={`${failed}. If migration 057 has not been run on this database the table does not exist yet; the Readiness panel in Credentials says which migrations are outstanding.`}
          />
        </Card>
      )}

      {rows === null && !failed && (
        <Card className="overflow-hidden"><SkeletonRows rows={6} cols={5} /></Card>
      )}

      {/* THE REGISTER IS EMPTY UNTIL THE MIGRATIONS RUN, and the difference
          between "no programmes" and "the migration has not been run" is one a
          Superadministrator should not have to guess at. */}
      {rows !== null && !failed && rows.length === 0 && (
        <Card>
          <EmptyState
            icon={<GraduationCap size={20} />}
            title="No programmes in the register"
            description="The academic structure arrives with migration 057 and the University's own programmes with 060. Until those have been run, this register is empty — which is not the same as the University having no programmes."
          />
        </Card>
      )}

      {rows !== null && !failed && rows.length > 0 && (
        <Card className="overflow-hidden">
          <TableShell>
            <THead>
              <tr>
                <Th>Programme</Th>
                <Th>Award</Th>
                <Th>Version</Th>
                <Th>Curriculum</Th>
                <Th>Credits</Th>
                <Th>Terms filled</Th>
                <Th> </Th>
              </tr>
            </THead>
            <TBody>
              {shown.map((r) => (
                <tr key={r.version_id} className="transition-colors hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">
                  <Td>
                    <span className="font-medium text-[#33234a] dark:text-[#e4dcf0]">
                      {titleOf(r.code)}
                    </span>
                    <span className="block text-xs text-[#a49bb0] dark:text-[#7b7289]">
                      {r.duration_years} year{r.duration_years === 1 ? '' : 's'} ·
                      {' '}{r.semesters_per_year} semesters a year
                    </span>
                  </Td>
                  <Td>{r.award_level}</Td>
                  <Td>
                    <span className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${
                      STATUS_TONE[r.status] ?? 'bg-[#f2eee6] text-[#6b6076]'
                    }`}>
                      {r.version_label} · {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </Td>
                  <Td>
                    {r.courses_in_curriculum === 0
                      ? <span className="text-[#a49bb0] dark:text-[#7b7289]">empty</span>
                      : `${r.courses_in_curriculum} courses`}
                  </Td>
                  {/* ------------------------------------------------------
                      THE GAP, AND IT IS THE POINT OF THE TABLE.

                      A programme claiming 180 credits whose curriculum adds to
                      174 cannot be graduated from, and without this column
                      that is found by a student in their final year.
                      ------------------------------------------------------ */}
                  <Td>
                    {r.total_credits === null ? (
                      <span className="text-[#a49bb0] dark:text-[#7b7289]">not stated</span>
                    ) : r.courses_in_curriculum === 0 ? (
                      <span className="text-[#a49bb0] dark:text-[#7b7289]">
                        0 / {r.total_credits}
                      </span>
                    ) : (
                      <span className={r.credits_against_claim === 0
                        ? 'font-medium text-emerald-700 dark:text-emerald-300'
                        : 'font-medium text-red-600 dark:text-red-400'}>
                        {r.credits_in_curriculum} / {r.total_credits}
                        {r.credits_against_claim !== 0 && (
                          <span className="ml-1 text-xs">
                            ({r.credits_against_claim > 0 ? '+' : ''}{r.credits_against_claim})
                          </span>
                        )}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className={r.terms_with_courses === r.terms_expected
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-[#6b6076] dark:text-[#9c93ad]'}>
                      {r.terms_with_courses} of {r.terms_expected}
                    </span>
                  </Td>
                  <Td>
                    {onOpen && (
                      <button
                        onClick={() => onOpen(r.version_id)}
                        className="flex items-center gap-1 text-xs font-medium text-[#422e59]
                                   hover:underline dark:text-[#c8b6e8]"
                      >
                        Curriculum <ArrowRight size={12} />
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </TBody>
          </TableShell>

          {shown.length === 0 && (
            <p className="p-6 text-center text-sm text-[#a49bb0] dark:text-[#7b7289]">
              No programme matches that.
            </p>
          )}
        </Card>
      )}
      {creating && (
        <NewProgramme
          onCancel={() => setCreating(false)}
          onDone={async (text) => {
            setCreating(false);
            setSaid({ ok: true, text });
            await load();
          }}
          onFailed={(text) => setSaid({ ok: false, text })}
        />
      )}
    </div>
  );
}


/**
 * A new programme, and its first version in the same act.
 *
 * A PROGRAMME WITH NO VERSION CANNOT BE TAUGHT. The Academic overview already
 * counts the ones in that state — "38 programmes with no curriculum at all" —
 * and a form that created a thirty-ninth would be adding to the problem this
 * register exists to show. So the duration and the credit total are asked for
 * here and written as a draft version straight away.
 */
function NewProgramme({
  onCancel, onDone, onFailed,
}: {
  onCancel: () => void;
  onDone: (said: string) => void;
  onFailed: (said: string) => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [awardLevel, setAwardLevel] = useState("Bachelor's");
  const [sessionLabel, setSessionLabel] = useState('');
  const [durationYears, setDurationYears] = useState(String(SHAPE["Bachelor's"].years));
  const [totalCredits, setTotalCredits] = useState(String(SHAPE["Bachelor's"].credits));
  const [semestersPerYear, setSemestersPerYear] = useState('2');
  const [busy, setBusy] = useState(false);

  /**
   * The code, suggested from the name.
   *
   * SUGGESTED AND NOT IMPOSED. It appears in the address of the programme's
   * page and in every course code under it, so somebody may want it shorter
   * than the name — but typing it by hand for forty-one programmes is how
   * `master-of-divinty` happens.
   */
  const suggest = (from: string) => from.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);

  const badCode = code !== '' && !/^[a-z][a-z0-9-]{1,31}$/.test(code);
  const ready = name.trim().length >= 3 && !badCode && sessionLabel.trim().length >= 4;

  async function save() {
    setBusy(true);
    const r = await authedPost('/api/academic/structure', {
      action: 'programme-add',
      code: code || suggest(name),
      name: name.trim(),
      awardLevel,
      sessionLabel: sessionLabel.trim(),
      durationYears: Number(durationYears),
      semestersPerYear: Number(semestersPerYear),
      totalCredits: totalCredits === '' ? null : Number(totalCredits),
    });
    setBusy(false);
    if (!r.ok) {
      onFailed(String(r.detail ?? r.error ?? 'The programme was not created.'));
      return;
    }
    onDone(String(r.detail ?? 'The programme was created.'));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog" aria-label="New programme">
      <Card className="my-8 w-full max-w-lg p-6">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-heading text-base font-bold text-[#422e59] dark:text-[#c8b6e8]">
            New programme
          </h2>
          <button onClick={onCancel} aria-label="Close"
            className="rounded-lg p-1.5 text-[#a49bb0] hover:bg-[#f5f1ea] dark:hover:bg-[#2a2333]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Name" help="As the award is written on a certificate.">
            <input value={name} className={INPUT}
              placeholder="Master of Arts in Black Liberation Theology"
              onChange={(e) => {
                setName(e.target.value);
                // Only while the code is still the suggestion — once somebody
                // has typed their own, it stops moving under them.
                if (code === '' || code === suggest(name)) setCode(suggest(e.target.value));
              }} />
          </Field>

          <Field label="Code" help="Appears in the address of the programme’s page.">
            <input value={code} onChange={(e) => setCode(e.target.value)} className={INPUT}
              placeholder="master-of-arts-black-liberation-theology" />
            {badCode && (
              <p className="mt-1 text-[11px] text-[#a07c12]">
                Lower case letters, digits and hyphens, starting with a letter.
              </p>
            )}
          </Field>

          <Field label="Award level" help="Sets the starting duration and credit total below.">
            <select value={awardLevel} className={INPUT}
              onChange={(e) => {
                setAwardLevel(e.target.value);
                const shape = SHAPE[e.target.value];
                if (shape) {
                  setDurationYears(String(shape.years));
                  setTotalCredits(String(shape.credits));
                }
              }}>
              {AWARD_LEVELS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Years">
              <input type="number" min={1} max={10} value={durationYears} className={INPUT}
                onChange={(e) => setDurationYears(e.target.value)} />
            </Field>
            <Field label="Semesters a year">
              <input type="number" min={1} max={3} value={semestersPerYear} className={INPUT}
                onChange={(e) => setSemestersPerYear(e.target.value)} />
            </Field>
            <Field label="Credits">
              <input type="number" min={1} value={totalCredits} className={INPUT}
                onChange={(e) => setTotalCredits(e.target.value)} />
            </Field>
          </div>
          <p className="text-[11px] text-[#a49bb0]">
            These are the University&apos;s own rulings for a {awardLevel}, offered as a starting
            point. Change any of them. Leave the credits blank if the University has not decided —
            blank means undecided, and a zero would mean the award requires nothing.
          </p>

          <Field label="First session" help="The session this version takes effect from.">
            <input value={sessionLabel} onChange={(e) => setSessionLabel(e.target.value)}
              className={INPUT} placeholder="2026/2027" />
          </Field>
        </div>

        <p className="mt-4 rounded-lg bg-[#faf6ee] p-3 text-[11px] leading-relaxed
                      text-[#6b5a2f] dark:bg-[#241f2c] dark:text-[#c3b48f]">
          This creates the programme as a <strong>draft</strong>, closed for admission, with a
          draft version of the shape above. It cannot be taught, timetabled or registered for
          until its curriculum is written in the Curriculum builder.
        </p>

        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onCancel}
            className="text-xs font-medium text-[#6b6076] hover:underline dark:text-[#9c93ad]">
            Cancel
          </button>
          <button onClick={save} disabled={busy || !ready}
            className={`rounded-lg bg-[#422e59] px-4 py-2 text-sm font-semibold text-white
                        transition hover:bg-[#33234a] disabled:opacity-50 ${FOCUS}`}>
            {busy ? 'Creating…' : 'Create programme'}
          </button>
        </div>
      </Card>
    </div>
  );
}

const INPUT = 'w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2 text-sm '
  + 'text-[#33234a] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]';

function Field({
  label, help, children,
}: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">{label}</label>
      <div className="mt-1">{children}</div>
      {help && <p className="mt-1 text-[11px] text-[#a49bb0]">{help}</p>}
    </div>
  );
}
