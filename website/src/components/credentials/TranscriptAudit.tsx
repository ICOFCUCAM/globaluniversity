'use client';

// ---------------------------------------------------------------------------
// TRANSCRIPT AUDIT — every transcript the University has generated.
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S RULING
// ---------------------------------------------------------------------------
//
//   "The Vice-Chancellor and SuperAdmin shall have continuous access to the
//    transcript audit record."
//
//   "Neither the Registrar nor Director of Academic Affairs should be able to
//    erase or alter these records."
//
// The second sentence is not enforced here and could not be: 100 refuses every
// UPDATE and DELETE on `transcript_issues` with a trigger, and writes no update
// or delete policy at all, so a client never reaches the trigger. This screen
// has no control that would attempt one — not because it is polite, but
// because there is nothing for it to call.
//
// ---------------------------------------------------------------------------
// WHY THERE IS NO ROLE LIST IN THE QUERY
// ---------------------------------------------------------------------------
//
// The capability opens the screen. WHICH ROWS COME BACK IS 100's ROW-LEVEL
// SECURITY, and it is not the same answer for everybody: the two offices here
// see all of them, an officer sees what they generated, a national officer
// sees their nation's, a student sees their own. Writing a filter here would
// be a second answer to a question the database already answers — and the
// wrong one, because a screen cannot express "mine" without knowing who is
// asking, which is the bug `myRecordIsMine.test.mjs` exists for.
//
// So this reads `transcript_audit`, which is `security_invoker`, and shows
// what comes back.
// ---------------------------------------------------------------------------

import React from 'react';
import { FileText, ShieldAlert, Mail, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton,
} from '@/components/ui/portal';
import TranscriptExceptions from '@/components/credentials/TranscriptExceptions';
import { BTN_SECONDARY } from '@/lib/portalTheme';

interface Row {
  id: string;
  document_reference: string | null;
  issued_at: string | null;
  version: number | null;
  student_number: string | null;
  student_name: string | null;
  programme: string | null;
  administration_country: string | null;
  issued_by_name: string | null;
  issued_role: string | null;
  path: string | null;
  validated_by_name: string | null;
  validated_at: string | null;
  sends: number | null;
  last_sent_at: string | null;
  last_recipient: string | null;
  delivery_status: string | null;
}

// One literal — supabase-js reads the row type from it.
// eslint-disable-next-line max-len
const COLUMNS = 'id, document_reference, issued_at, version, student_number, student_name, programme, administration_country, issued_by_name, issued_role, path, validated_by_name, validated_at, sends, last_sent_at, last_recipient, delivery_status';

const OFFICE: Record<string, string> = {
  superadmin: 'SuperAdmin',
  admin: 'System Administrator',
  'vice-chancellor': 'Vice-Chancellor',
  registrar: 'Registrar',
  'academic-office': 'Director of Academic Affairs',
};

const when = (iso: string | null | undefined) => (iso
  ? new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  : '—');

export default function TranscriptAudit() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setRows(null);
    const { data, error: e } = await supabase
      .from('transcript_audit')
      .select(COLUMNS)
      .order('issued_at', { ascending: false })
      .limit(500);
    if (e) { setError(e.message); setRows([]); return; }
    setError(null);
    setRows((data ?? []) as Row[]);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  // THE REFUSAL FROM THE INSIDE, as well as the sidebar not drawing the entry.
  if (!can(user?.role, 'view-transcript-audit')) {
    return (
      <Card className="p-5">
        <p className="flex items-start gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <ShieldAlert size={16} className="mt-0.5 flex-shrink-0 text-[#a3283f]" />
          <span>
            The complete transcript audit is the Vice-Chancellor&rsquo;s and the
            SuperAdmin&rsquo;s. Transcripts you generated yourself appear on your own
            credentials screen.
          </span>
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transcript audit"
        subtitle="Every official transcript the University has generated, who generated it, and whether it was afterwards sent"
      />

      <Card>
        <CardHeader
          title="Transcript audit log"
          subtitle={rows ? `${rows.length} generation${rows.length === 1 ? '' : 's'}` : 'Reading…'}
          action={(
            <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
              <RefreshCw size={14} /> Refresh
            </button>
          )}
        />

        {error && (
          <p className="mx-5 mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </p>
        )}

        {rows === null && (
          <div className="space-y-2 p-5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {rows?.length === 0 && !error && (
          <EmptyState
            icon={<FileText size={20} />}
            title="No transcript has been generated yet"
            description="Every generation is recorded here the moment it happens, and the record cannot afterwards be edited or removed by any office."
          />
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[#ded6c8] bg-[#f8f6fb] text-left text-xs uppercase tracking-wide text-[#6b6076] dark:border-[#3d3349] dark:bg-[#2a2233]">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Student</th>
                  <th className="px-3 py-2.5 font-medium">Generated by</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Sent</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr
                      onClick={() => setOpen(open === r.id ? null : r.id)}
                      className="cursor-pointer border-b border-[#ece7f3] hover:bg-[#faf8fd] dark:border-[#332b3d] dark:hover:bg-[#2a2233]"
                    >
                      <td className="whitespace-nowrap px-5 py-2.5 text-[#6b6076] dark:text-[#9c93ad]">
                        {when(r.issued_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                          {r.student_number ?? '—'}
                        </span>
                        <span className="ml-2 text-[#6b6076] dark:text-[#9c93ad]">
                          {r.student_name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[#6b6076] dark:text-[#9c93ad]">
                        {OFFICE[r.issued_role ?? ''] ?? r.issued_role ?? '—'}
                        {r.administration_country ? ` · ${r.administration_country}` : ''}
                      </td>
                      <td className="px-3 py-2.5">
                        {/* §11's two paths, and the exceptional one is marked.
                            A validated transcript is not a worse transcript;
                            it is one the University should be able to find
                            again without reading every row. */}
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.path === 'validated'
                            ? 'bg-[#fdf3e0] text-[#a86a12]'
                            : 'bg-[#e7f5ed] text-[#1f7a4d]'
                        }`}
                        >
                          {r.path === 'validated' ? 'Validated' : 'Generated'}
                        </span>
                        {r.version && r.version > 1 ? (
                          <span className="ml-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                            #{String(r.version).padStart(3, '0')}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-[#6b6076] dark:text-[#9c93ad]">
                        {r.sends ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail size={13} /> {r.delivery_status}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>

                    {open === r.id && (
                      <tr className="bg-[#faf8fd] dark:bg-[#231c2b]">
                        <td colSpan={5} className="px-5 py-4">
                          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-3">
                            {([
                              ['Transcript ID', r.document_reference],
                              ['Student number', r.student_number],
                              ['Student', r.student_name],
                              ['Programme', r.programme],
                              ['National Administration', r.administration_country],
                              ['Issued by', r.issued_by_name],
                              ['Role', OFFICE[r.issued_role ?? ''] ?? r.issued_role],
                              ['Generated', when(r.issued_at)],
                              ['Version', r.version ? `#${String(r.version).padStart(3, '0')}` : null],
                              ['Validated by', r.validated_by_name],
                              ['Validated', r.validated_at ? when(r.validated_at) : null],
                              ['Emailed', r.last_sent_at ? when(r.last_sent_at) : null],
                              ['Recipient', r.last_recipient],
                              ['Delivery', r.delivery_status],
                            ] as [string, string | number | null | undefined][])
                              .filter(([, v]) => v !== null && v !== undefined && v !== '')
                              .map(([k, v]) => (
                                <div key={k}>
                                  <dt className="text-xs uppercase tracking-wide text-[#a49bb0]">{k}</dt>
                                  <dd className="mt-0.5 text-sm text-[#422e59] dark:text-[#e4dcf0]">{v}</dd>
                                </div>
                              ))}
                          </dl>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* §11's second path lives beside the log rather than on its own
          screen, because the question "who generated this" and the question
          "who may generate one for somebody we cannot find" are asked by the
          same two offices, in the same sitting. */}
      <TranscriptExceptions />

      <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
        A generation record cannot be edited or deleted by any office, including this one. If a
        transcript was wrong, the record of it having been generated is the University&rsquo;s
        evidence of that — generating a correct one creates a new version and leaves the first
        in place.
      </p>
    </div>
  );
}
