'use client';

// ---------------------------------------------------------------------------
// ARCHIVED APPLICATIONS — where an application goes when nobody finished it.
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S REQUEST
// ---------------------------------------------------------------------------
//
//   "STUDENT WHO FAIL IN THE APPLICATION PROCESS AND OR PAY NOT THEIR
//    APPLICATION FEE AND APPLICATION WAS NOT PROCESS, THAT INFORMATION SHOULD
//    SOMEHOW OVER TIME BE DELETED OR REMOVE SOMEWHERE THAN REMAINING ON THE
//    DASHBOARD"
//
// This is the "somewhere". Six rows all reading "Awaiting payment" were filling
// their Students screen, and the register is meant to be a register of
// students.
//
// ---------------------------------------------------------------------------
// IT IS NOT A BIN, AND THE SCREEN HAS TO SAY SO
// ---------------------------------------------------------------------------
//
// Nothing here is deleted and nothing here is scheduled to be. That is the
// single most important thing for this screen to convey, because the word the
// University reached for was "deleted" and the thing they were given is not a
// deletion — there is no Vice-Chancellor in the path, no thirty-day countdown
// and no erasure. An application is simply read here instead of there.
//
// Deletion is a different screen (Deletions), reached from the record itself,
// and it is the Superadministrator's to ask for.
//
// ---------------------------------------------------------------------------
// AND THE ONE LIST THAT IS NOT CLUTTER COMES FIRST
// ---------------------------------------------------------------------------
//
// An application the University was PAID for and never processed is money taken
// for nothing. The University asked for those to age out with the rest, and
// they do — but they are also listed separately, with no age limit, from the
// day the payment was taken. So that list is drawn ABOVE the archive and
// whether or not anything has aged off yet, because a thing that leaves the
// screen quietly is a thing nobody ever answers for.
// ---------------------------------------------------------------------------

import React from 'react';
import {
  Archive, RefreshCw, Undo2, Search, AlertTriangle, Banknote, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { authedPost } from '@/lib/authedFetch';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton,
} from '@/components/ui/portal';
import { BTN_SECONDARY, INPUT } from '@/lib/portalTheme';
import {
  ARCHIVE_AFTER_DAYS, ARCHIVE_REASONS, reasonLabel, reasonNote,
} from '@/lib/applicationArchive';

interface Archived {
  id: string;
  matric_no: string | null;
  student_number: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  program: string | null;
  intake: string | null;
  status: string;
  payment_status: string | null;
  created_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  restored_to_register_at: string | null;
  why: string | null;
  days_idle: number | null;
}

interface Unprocessed {
  id: string;
  matric_no: string | null;
  full_name: string | null;
  email: string | null;
  program: string | null;
  status: string;
  payment_status: string | null;
  fee_reference: string | null;
  fee_amount: string | null;
  fee_currency: string | null;
  fee_registered_at: string | null;
  created_at: string | null;
  days_waiting: number | null;
  already_archived: boolean | null;
}

// eslint-disable-next-line max-len
const ARCHIVE_COLUMNS = 'id, matric_no, student_number, full_name, email, phone, program, intake, status, payment_status, created_at, decided_at, decision_reason, restored_to_register_at, why, days_idle';
// eslint-disable-next-line max-len
const UNPROCESSED_COLUMNS = 'id, matric_no, full_name, email, program, status, payment_status, fee_reference, fee_amount, fee_currency, fee_registered_at, created_at, days_waiting, already_archived';

const when = (iso: string | null) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');

// THE ORDER THE GROUPS ARE DRAWN IN, and it is deliberate: money first, then
// the applicant's own silence, then the University's decisions. A refusal is
// the least interesting thing on this screen — it was decided and recorded.
const GROUP_ORDER: (keyof typeof ARCHIVE_REASONS)[] = [
  'paid-never-processed',
  'documents-never-sent',
  'never-paid',
  'withdrawn',
  'refused',
];

export default function ArchivedApplications() {
  const { user } = useAuth();
  const mayRestore = can(user?.role, 'restore-archived-application');

  const [rows, setRows] = React.useState<Archived[] | null>(null);
  const [owed, setOwed] = React.useState<Unprocessed[] | null>(null);
  const [q, setQ] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const load = React.useCallback(async () => {
    setRows(null); setOwed(null);
    const [archive, unprocessed] = await Promise.all([
      supabase.from('archived_applications').select(ARCHIVE_COLUMNS)
        .order('days_idle', { ascending: false }).limit(1000),
      supabase.from('applications_paid_and_never_processed').select(UNPROCESSED_COLUMNS)
        .order('days_waiting', { ascending: false }).limit(500),
    ]);
    if (archive.error) setNote({ tone: 'bad', text: archive.error.message });
    setRows((archive.data ?? []) as unknown as Archived[]);
    setOwed((unprocessed.data ?? []) as unknown as Unprocessed[]);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function restore(row: Archived) {
    setBusy(row.id); setNote(null);
    const out = await authedPost('/api/admissions/archive', { action: 'restore', id: row.id });
    setBusy(null);
    setNote({
      tone: out.ok ? 'ok' : 'bad',
      text: String(out.detail ?? out.error ?? 'Nothing happened.'),
    });
    await load();
  }

  // THE SEARCH IS OVER WHAT IS DRAWN, not a second query. The archive is the
  // one register where somebody arrives knowing a name and nothing else —
  // "did so-and-so ever apply here?" — so name, number, email and programme
  // all answer.
  const needle = q.trim().toLowerCase();
  const visible = (rows ?? []).filter((r) => !needle || [
    r.full_name, r.matric_no, r.student_number, r.email, r.program, r.intake,
  ].some((f) => (f ?? '').toLowerCase().includes(needle)));

  const groups = GROUP_ORDER
    .map((key) => ({ key, rows: visible.filter((r) => r.why === key) }))
    .filter((g) => g.rows.length > 0);

  // A REASON THE DATABASE PRODUCED AND THIS FILE HAS NOT BEEN TAUGHT. Drawn
  // rather than dropped: the University has found three gaps in this system by
  // looking at a screen, and a row that silently renders nowhere is a gap
  // nobody can find.
  const unknown = visible.filter(
    (r) => !GROUP_ORDER.includes(r.why as keyof typeof ARCHIVE_REASONS),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Archived applications"
        subtitle={`An application nobody finished leaves the Students register after ${ARCHIVE_AFTER_DAYS} days. Nothing here is deleted`}
      />

      {note && (
        <Card className={`p-4 text-sm ${note.tone === 'ok'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-red-200 bg-red-50 text-red-800'}`}
        >
          <p>{note.text}</p>
        </Card>
      )}

      {/* ==================================================================
          WHAT THIS SCREEN IS, SAID ONCE AND PLAINLY.

          The University asked for this information to be "DELETED OR REMOVE
          SOMEWHERE", and what they were given is the second. Somebody opening
          this screen in two years should not have to work that out.
          ================================================================== */}
      <Card className="p-5">
        <p className="flex items-start gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-[#6b5b8a]" />
          <span>
            <strong className="text-[#422e59] dark:text-[#e4dcf0]">Nothing here is deleted.</strong>
            {' '}
            An application leaves the Students register, the admissions queues and the dashboard
            counts after {ARCHIVE_AFTER_DAYS} days in which nothing further happened to it, and
            is read here instead. It happens by itself — there is no job to run and no button to
            press. The Office of the Registrar can put one back at any time, and the
            {' '}{ARCHIVE_AFTER_DAYS} days then start again.
            {' '}
            An admitted or enrolled student is never archived, at any age, and neither is an
            application still waiting on a University desk.
          </span>
        </p>
      </Card>

      {/* ==================================================================
          MONEY TAKEN FOR NOTHING — ABOVE THE ARCHIVE, AND WITH NO AGE LIMIT.
          ================================================================== */}
      <Card>
        <CardHeader
          title="Paid for, and never processed"
          subtitle="Every age, from the day of the payment. The University holds a fee and the application was never carried to a decision"
          action={(
            <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
              <RefreshCw size={14} /> Refresh
            </button>
          )}
        />
        {owed === null && <div className="p-5"><Skeleton className="h-4 w-2/3" /></div>}
        {owed !== null && owed.length === 0 && (
          <EmptyState
            icon={<Banknote size={20} />}
            title="Nothing is outstanding"
            description="Every application the University has been paid for has been carried to a decision."
          />
        )}
        {owed !== null && owed.length > 0 && (
          <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">
            {owed.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                    {r.full_name || r.matric_no || 'Unnamed application'}
                    <span className="ml-2 text-xs font-normal text-[#6b6076] dark:text-[#9c93ad]">
                      {r.matric_no}
                      {r.program ? ` · ${r.program}` : ''}
                    </span>
                  </p>
                  <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
                    {r.email || 'no email on the application'}
                    {r.fee_reference ? ` · fee ${r.fee_reference}` : ''}
                    {r.fee_amount ? ` · ${r.fee_currency ?? ''} ${r.fee_amount}` : ''}
                  </p>
                  <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    Paid {when(r.fee_registered_at ?? r.created_at)} · still at “{r.status}”
                    {/* AND WHETHER IT HAS ALSO AGED OFF THE REGISTER, because
                        the two lists overlap and the screen should say which
                        side of the ninety days this one is. */}
                    {r.already_archived
                      ? ' · and has left the register — it is in the archive below'
                      : ' · still on the register'}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#fdeaee] px-2.5 py-1 text-xs font-medium text-[#a3283f]">
                  <AlertTriangle size={12} />
                  {r.days_waiting ?? 0} days
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ==================================================================
          THE ARCHIVE ITSELF
          ================================================================== */}
      <Card>
        <CardHeader
          title="The archive"
          subtitle={rows
            ? `${rows.length} application${rows.length === 1 ? '' : 's'} has left the register`
            : 'Reading…'}
          action={(
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9c93ad]"
              />
              <input
                className={`${INPUT} pl-9`}
                placeholder="Name, number, email or programme"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search the archive"
              />
            </div>
          )}
        />

        {rows === null && <div className="p-5"><Skeleton className="h-4 w-2/3" /></div>}

        {rows !== null && rows.length === 0 && (
          <EmptyState
            icon={<Archive size={20} />}
            title="Nothing has aged off the register"
            description={`An application leaves the register after ${ARCHIVE_AFTER_DAYS} days in which nothing happened to it. Nothing has yet.`}
          />
        )}

        {rows !== null && rows.length > 0 && visible.length === 0 && (
          <EmptyState
            icon={<Search size={20} />}
            title="Nothing matches that"
            description="The archive holds applications; try a surname, an application number or an email address."
          />
        )}

        {[...groups, ...(unknown.length > 0
          ? [{ key: 'unclassified' as keyof typeof ARCHIVE_REASONS, rows: unknown }]
          : [])].map((g) => (
            <div key={g.key}>
              <div className="border-y border-[#ece7f3] bg-[#faf8fd] px-5 py-2.5 dark:border-[#332b3d] dark:bg-[#231d2b]">
                <p className="text-sm font-medium text-[#422e59] dark:text-[#e4dcf0]">
                  {reasonLabel(g.key)}
                  <span className="ml-2 text-xs font-normal text-[#6b6076] dark:text-[#9c93ad]">
                    {g.rows.length}
                  </span>
                </p>
                {reasonNote(g.key) && (
                  <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">{reasonNote(g.key)}</p>
                )}
              </div>
              <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">
                {g.rows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                        {r.full_name || r.matric_no || 'Unnamed application'}
                        <span className="ml-2 text-xs font-normal text-[#6b6076] dark:text-[#9c93ad]">
                          {r.matric_no}
                          {r.program ? ` · ${r.program}` : ''}
                          {r.intake ? ` · ${r.intake}` : ''}
                        </span>
                      </p>
                      <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
                        {r.email || 'no email on the application'}
                        {r.phone ? ` · ${r.phone}` : ''}
                      </p>
                      <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        Applied {when(r.created_at)}
                        {r.decided_at ? ` · decided ${when(r.decided_at)}` : ''}
                        {r.restored_to_register_at
                          ? ` · last brought back ${when(r.restored_to_register_at)}`
                          : ''}
                        {' · '}
                        {r.days_idle ?? 0} days idle
                      </p>
                      {/* THE REASON THE UNIVERSITY GAVE, where there is one.
                          A refusal without its reason is half a record, and
                          this is often the only place it is now read. */}
                      {r.decision_reason && (
                        <p className="mt-1 text-xs italic text-[#6b6076] dark:text-[#9c93ad]">
                          “{r.decision_reason}”
                        </p>
                      )}
                    </div>
                    {mayRestore ? (
                      <button
                        type="button"
                        className={BTN_SECONDARY}
                        disabled={busy === r.id}
                        onClick={() => void restore(r)}
                      >
                        <Undo2 size={14} />
                        {busy === r.id ? 'Putting it back…' : 'Put back on the register'}
                      </button>
                    ) : (
                      /* NOT A GREYED-OUT BUTTON. The Admissions Office reads
                         this list and the Registry returns a record to the
                         register; a disabled control that looks like it might
                         work on another day is worse than a sentence. */
                      <span className="self-center text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        The Office of the Registrar puts one back.
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
        ))}
      </Card>
    </div>
  );
}
