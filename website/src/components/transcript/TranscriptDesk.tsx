'use client';

// ---------------------------------------------------------------------------
// THE TRANSCRIPT DESK.
//
//   Select Academic Year → Select Student        or
//   Enter Student Number → Browse                then
//   Generate Transcript
//
// ---------------------------------------------------------------------------
// TWO WAYS IN, AND NO THIRD
// ---------------------------------------------------------------------------
//
// The University described this screen more precisely than any other, and the
// precision is the point:
//
//   "The Registrar should not type grades, courses, credits or academic
//    information into the transcript. […] This prevents someone from creating
//    an official transcript using information that exists outside the
//    university's authoritative records."
//
// So there is no field on this screen that accepts an academic fact. The only
// thing anybody types is a student number, and the only thing that does is
// FIND somebody. Everything printed comes from the student's record.
//
// ---------------------------------------------------------------------------
// AND NO WORKAROUND WHEN THE STUDENT IS NOT THERE
// ---------------------------------------------------------------------------
//
//   "The system must not provide a workaround such as 'Generate manually.'
//    There should be no manual transcript path for ordinary Registrar users."
//
// A number that finds nobody gets STUDENT NOT FOUND and one route onward: ask
// the Vice-Chancellor or the SuperAdmin. Not a form. The exceptional path is
// on the Issue screen and carries no academic fields either.
//
// This screen could not offer a manual path if it wanted to. 100 refuses a
// generation row that names no student, and the route it calls reads the marks
// from the database rather than accepting them — so "type it in anyway" has
// nowhere to go.
//
// ---------------------------------------------------------------------------
// THE DATE IS NOT A FIELD EITHER
// ---------------------------------------------------------------------------
//
//   "The date should be generated automatically by the system. The Registrar
//    should not manually type the date."
//
// It is a database default, on a row that cannot afterwards be updated.
// ---------------------------------------------------------------------------

import React from 'react';
import {
  Search, FileText, UserRound, AlertTriangle, Mail, Printer, Download, Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { writeDocument } from '@/lib/openDocument';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton,
} from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS } from '@/lib/portalTheme';

interface Student {
  id: string;
  student_number: string | null;
  matric_no: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  program: string | null;
  status: string | null;
  student_status: string | null;
  admission_year: number | null;
  email: string | null;
  administration_id: string | null;
}

// eslint-disable-next-line max-len
const STUDENT = 'id, student_number, matric_no, first_name, middle_name, last_name, program, status, student_status, admission_year, email, administration_id';

const INPUT = 'w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2 text-sm '
  + 'text-[#422e59] placeholder:text-[#a49bb0] dark:border-[#3d3349] dark:bg-[#231c2b] '
  + `dark:text-[#e4dcf0] ${FOCUS}`;

const nameOf = (s: Student) => [s.first_name, s.middle_name, s.last_name]
  .filter(Boolean).join(' ') || '—';

const numberOf = (s: Student) => s.student_number ?? s.matric_no ?? '—';

/**
 * The academic year a student belongs to, as the University writes it.
 *
 * FROM `admission_year`, WHICH IS THE ONLY YEAR A STUDENT ROW CARRIES. It is
 * an integer, so 2025 becomes "2025/2026" — and that is a rendering, not a
 * fact the database holds. 019 records dates separately for exactly this
 * reason and a screen that pretended otherwise would be inventing precision.
 */
const yearLabel = (year: number) => `${year}/${year + 1}`;

export default function TranscriptDesk() {
  const { user } = useAuth();
  const mayIssue = can(user?.role, 'issue-credential');

  const [years, setYears] = React.useState<number[] | null>(null);
  const [year, setYear] = React.useState<number | null>(null);
  const [list, setList] = React.useState<Student[] | null>(null);
  const [filter, setFilter] = React.useState('');

  const [lookup, setLookup] = React.useState('');
  const [notFound, setNotFound] = React.useState<string | null>(null);

  const [chosen, setChosen] = React.useState<Student | null>(null);
  const [hasRecord, setHasRecord] = React.useState<boolean | null>(null);
  const [previous, setPrevious] = React.useState<number>(0);

  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<{
    reference: string; credentialId: string; html: string; version: number;
  } | null>(null);

  // ---- THE YEARS THE UNIVERSITY ACTUALLY HAS ------------------------------
  //
  // Read from the students rather than counted forward from a founding year.
  // A dropdown of every year since the University opened offers the Registrar
  // twenty options, nineteen of which are empty.
  React.useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('students')
        .select('admission_year')
        .not('admission_year', 'is', null)
        .order('admission_year', { ascending: false })
        .limit(2000);
      const seen = [...new Set((data ?? [])
        .map((r) => r.admission_year as number)
        .filter(Boolean))].sort((a, b) => b - a);
      setYears(seen);
      if (seen.length) setYear(seen[0]);
    })();
  }, []);

  // ---- THE STUDENTS OF THAT YEAR -----------------------------------------
  React.useEffect(() => {
    if (year === null) return;
    setList(null);
    void (async () => {
      const { data } = await supabase
        .from('students')
        .select(STUDENT)
        .eq('admission_year', year)
        .order('last_name', { ascending: true })
        .limit(1000);
      setList((data ?? []) as Student[]);
    })();
  }, [year]);

  /** Whether there is anything to build a transcript from. */
  const openStudent = React.useCallback(async (s: Student) => {
    setChosen(s); setIssued(null); setNote(null); setHasRecord(null);
    const { count } = await supabase
      .from('results')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', s.id);
    setHasRecord((count ?? 0) > 0);

    // §14 — how many have been generated before. Shown so that "Transcript
    // #003" is not a surprise on the audit screen afterwards.
    const { count: before } = await supabase
      .from('transcript_issues')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', s.id);
    setPrevious(before ?? 0);
  }, []);

  /** Option B — the student number, and it FINDS somebody or it does not. */
  async function browse() {
    const q = lookup.trim();
    if (!q) return;
    setBusy(true); setNotFound(null); setChosen(null); setIssued(null);
    const { data } = await supabase
      .from('students')
      .select(STUDENT)
      .or(`student_number.eq.${q},matric_no.eq.${q}`)
      .maybeSingle();
    setBusy(false);
    if (!data) { setNotFound(q); return; }
    await openStudent(data as Student);
  }

  async function generate() {
    if (!chosen) return;
    setBusy(true); setNote(null);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/credential/transcript', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session?.session?.access_token ?? ''}`,
      },
      // THE STUDENT, AND NOTHING ELSE. Every mark, credit and classification on
      // the document is read server-side from the database; the seal would
      // otherwise attest to whatever this screen posted.
      body: JSON.stringify({ studentId: chosen.id }),
    });
    const r = await res.json();
    setBusy(false);
    if (!r?.ok) {
      setNote(r?.detail ?? r?.error ?? 'The transcript was not generated.');
      return;
    }
    setIssued({
      reference: r.credential?.credentialId ?? r.credential?.credential_id ?? '',
      credentialId: r.credential?.id ?? '',
      html: r.html ?? '',
      version: r.transcriptVersion ?? previous + 1,
    });
    setPrevious((n) => n + 1);
  }

  async function emailStudent() {
    if (!issued?.credentialId || !chosen?.email) return;
    setBusy(true); setNote(null);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/credential/deliver', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session?.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ credentialId: issued.credentialId, to: chosen.email }),
    });
    const r = await res.json();
    setBusy(false);
    setNote(r?.ok
      ? `Emailed to ${chosen.email}. The send is on the transcript audit.`
      : (r?.detail ?? r?.error ?? 'It was not sent.'));
  }

  function openDocument() {
    const w = window.open('', '_blank');
    if (!issued?.html) { setNote('There is no document to open.'); return; }
    const ok = writeDocument(w, { html: issued.html, reference: issued.reference, sealed: true });
    if (!ok) setNote('Your browser blocked the new tab. Allow pop-ups for this site.');
  }

  if (!mayIssue) {
    return (
      <Card className="p-5">
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
          Generating an official transcript belongs to the Registrar, the Director of Academic
          Affairs, the Vice-Chancellor and the SuperAdmin.
        </p>
      </Card>
    );
  }

  const shown = (list ?? []).filter((s) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return nameOf(s).toLowerCase().includes(q) || numberOf(s).toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transcript"
        subtitle="Choose the year and the student, or enter a student number. The transcript is built from the University’s own record."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---- OPTION A ---------------------------------------------- */}
        <Card>
          <CardHeader title="Browse by year" subtitle="The academic years the register holds" />
          <div className="space-y-3 p-5">
            {years === null && <Skeleton className="h-9 w-full" />}
            {years?.length === 0 && (
              <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
                No student on the register carries an admission year yet.
              </p>
            )}
            {years && years.length > 0 && (
              <>
                <select
                  className={INPUT}
                  value={year ?? ''}
                  onChange={(e) => { setYear(Number(e.target.value)); setChosen(null); }}
                  aria-label="Academic year"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{yearLabel(y)}</option>
                  ))}
                </select>
                <input
                  className={INPUT}
                  placeholder="Scroll, or start typing a name"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label="Filter the list"
                />
                <div className="max-h-64 overflow-y-auto rounded-lg border border-[#ded6c8] dark:border-[#3d3349]">
                  {list === null && <div className="p-3"><Skeleton className="h-4 w-full" /></div>}
                  {list?.length === 0 && (
                    <p className="p-3 text-sm text-[#6b6076] dark:text-[#9c93ad]">
                      No student was admitted in {year !== null ? yearLabel(year) : 'that year'}.
                    </p>
                  )}
                  {shown.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => void openStudent(s)}
                      className={`flex w-full items-baseline justify-between gap-3 border-b border-[#ece7f3] px-3 py-2 text-left text-sm last:border-0 hover:bg-[#faf8fd] dark:border-[#332b3d] dark:hover:bg-[#2a2233] ${FOCUS} ${
                        chosen?.id === s.id ? 'bg-[#f3eefb] dark:bg-[#2a2233]' : ''
                      }`}
                    >
                      <span className="text-[#422e59] dark:text-[#e4dcf0]">{nameOf(s)}</span>
                      <span className="flex-shrink-0 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        {numberOf(s)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        {/* ---- OPTION B ---------------------------------------------- */}
        <Card>
          <CardHeader title="Or enter a student number" subtitle="Straight to the record" />
          <div className="space-y-3 p-5">
            <input
              className={INPUT}
              placeholder="ICOF-UG-2026-00125"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void browse(); }}
              aria-label="Student number"
            />
            <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void browse()}>
              <Search size={14} /> Browse student
            </button>

            {/* -------------------------------------------------------
                STUDENT NOT FOUND, IN THE UNIVERSITY'S OWN WORDS, AND
                WITH NO WAY ONWARD EXCEPT THE RIGHT ONE. No "generate
                manually", no "create record and continue".
                ------------------------------------------------------- */}
            {notFound && (
              <div className="rounded-lg border border-[#f2c3cd] bg-[#fdeaee] p-4">
                <p className="flex items-center gap-2 font-medium text-[#a3283f]">
                  <AlertTriangle size={16} /> Student not found
                </p>
                <p className="mt-2 text-sm text-[#7a2033]">
                  No official student record exists for <strong>{notFound}</strong>. Transcript
                  generation is unavailable.
                </p>
                <p className="mt-2 text-sm text-[#7a2033]">
                  If you have evidence that this student exists, put the case to the
                  Vice-Chancellor or the SuperAdmin from the <strong>Credentials → Issue</strong>
                  {' '}screen. Only they can permit an exception, and it creates no transcript by
                  itself.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ---- THE VERIFICATION SCREEN ---------------------------------- */}
      {chosen && (
        <Card>
          <CardHeader
            title="Student record"
            subtitle="Confirm this is the right student before generating"
          />
          <div className="space-y-4 p-5">
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
              {([
                ['Student number', numberOf(chosen)],
                ['Name', nameOf(chosen)],
                ['Programme', chosen.program ?? '—'],
                ['Admission year', chosen.admission_year ? yearLabel(chosen.admission_year) : '—'],
                ['Status', chosen.student_status ?? chosen.status ?? '—'],
                ['Academic record', hasRecord === null ? 'Checking…'
                  : hasRecord ? 'Available' : 'None recorded'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wide text-[#a49bb0]">{k}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-[#422e59] dark:text-[#e4dcf0]">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            {/* §14 AND §15, SAID BEFORE THE BUTTON IS PRESSED. Generating
                again does not replace, and an officer who expects it to
                should find that out here rather than on the audit screen. */}
            {previous > 0 && (
              <p className="rounded-lg border border-[#ded6c8] bg-[#f8f6fb] px-3 py-2 text-sm text-[#6b6076] dark:border-[#3d3349] dark:bg-[#2a2233] dark:text-[#9c93ad]">
                {previous === 1
                  ? 'One transcript has been generated for this student already.'
                  : `${previous} transcripts have been generated for this student already.`}
                {' '}Generating now creates transcript #{String(previous + 1).padStart(3, '0')};
                the earlier ones stay on the record.
              </p>
            )}

            {hasRecord === false && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                This student has no results on record. A transcript with no courses on it is not a
                transcript, and the University will refuse to seal one.
              </p>
            )}

            {note && (
              <p className="rounded-lg border border-[#ded6c8] bg-[#f8f6fb] px-3 py-2 text-sm text-[#422e59] dark:border-[#3d3349] dark:bg-[#2a2233] dark:text-[#e4dcf0]">
                {note}
              </p>
            )}

            {!issued && (
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={busy || hasRecord !== true}
                onClick={() => void generate()}
              >
                <FileText size={14} /> Generate transcript
              </button>
            )}

            {/* ---- §12 — READY TO EMAIL ------------------------------ */}
            {issued && (
              <div className="space-y-3 rounded-lg border border-[#bfe3ce] bg-[#e7f5ed] p-4">
                <p className="flex items-center gap-2 font-medium text-[#1f7a4d]">
                  <Check size={16} /> Official transcript — ready
                </p>
                <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#1f7a4d]">Reference</dt>
                    <dd className="text-[#1c4d34]">{issued.reference}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#1f7a4d]">Generated</dt>
                    <dd className="text-[#1c4d34]">
                      {new Date().toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[#1f7a4d]">Version</dt>
                    <dd className="text-[#1c4d34]">
                      #{String(issued.version).padStart(3, '0')}
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={BTN_SECONDARY} onClick={openDocument}>
                    <FileText size={14} /> Preview
                  </button>
                  <button type="button" className={BTN_SECONDARY} onClick={openDocument}>
                    <Printer size={14} /> Print
                  </button>
                  {/* DOWNLOAD IS THE PRINT DIALOGUE'S "Save as PDF", the same
                      path every other document in this system uses. A second
                      renderer producing a file would be a second answer to
                      what the transcript says. */}
                  <button type="button" className={BTN_SECONDARY} onClick={openDocument}>
                    <Download size={14} /> Download
                  </button>
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    disabled={busy || !chosen.email}
                    onClick={() => void emailStudent()}
                    title={chosen.email ?? 'This student has no email address on record'}
                  >
                    <Mail size={14} /> Email student
                  </button>
                </div>
                <p className="text-xs text-[#1c4d34]">
                  This generation is on the transcript audit, which the Vice-Chancellor and the
                  SuperAdmin read. It cannot be edited or removed.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {!chosen && !notFound && (
        <Card>
          <EmptyState
            icon={<UserRound size={20} />}
            title="Choose a student"
            description="Select the academic year and pick from the list, or enter a student number and browse straight to the record."
          />
        </Card>
      )}
    </div>
  );
}
