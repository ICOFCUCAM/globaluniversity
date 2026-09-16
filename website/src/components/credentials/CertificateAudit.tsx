'use client';

// ---------------------------------------------------------------------------
// CERTIFICATE AUDIT — every certificate the University has issued.
//
// ---------------------------------------------------------------------------
// §7 OF THE CERTIFICATE RULING, WHICH HAD A VIEW AND NO SCREEN
// ---------------------------------------------------------------------------
//
//   "Just as with transcripts, every certificate generation must produce an
//    immutable audit event. […] The VC and SuperAdmin can inspect the complete
//    audit trail."
//
// 101 built `certificate_audit` and nothing read it: the transcript audit was
// built and its certificate twin was not. The system audit found it, and this
// is the other half.
//
// ---------------------------------------------------------------------------
// WHAT IT SHOWS THAT THE REGISTER DOES NOT
// ---------------------------------------------------------------------------
//
// The credential register answers "what has the University issued". This
// answers the questions asked afterwards, which are different:
//
//   Was this certificate a REPLACEMENT, and on whose authority?
//   How many events has it been through since it was issued?
//   Is it still standing, or has it been revoked or superseded?
//
// A certificate that replaced another and a certificate issued twice look
// identical in `credentials_issued` alone. The reissue request is what tells
// them apart, and the view joins it.
//
// ---------------------------------------------------------------------------
// AND THE ROWS ARE THE DATABASE'S TO CHOOSE
// ---------------------------------------------------------------------------
//
// `certificate_audit` is `security_invoker`, so what comes back is what the
// signed-in person may read. 101 added the Vice-Chancellor to the credential
// register — they had never been on it — and opened the append-only event
// trail, which 013 had left with row-level security on and no policy at all,
// readable by nobody.
//
// No filter is written here for that reason, and none should be.
// ---------------------------------------------------------------------------

import React from 'react';
import {
  Award, ShieldAlert, RefreshCw, Stamp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton,
} from '@/components/ui/portal';
import { BTN_SECONDARY } from '@/lib/portalTheme';
import CertificateReissue from '@/components/credentials/CertificateReissue';

interface Row {
  id: string;
  certificate_identifier: string | null;
  kind: string | null;
  student_number: string | null;
  student_name: string | null;
  programme: string | null;
  qualification: string | null;
  classification: string | null;
  issued_at: string | null;
  issued_by_name: string | null;
  issued_by_role: string | null;
  issuance_status: string | null;
  certificate_version: number | null;
  reissue_request_id: string | null;
  reissue_reason: string | null;
  reissue_status: string | null;
  reissue_authorised_by_name: string | null;
  reissue_authorised_at: string | null;
  events: number | null;
  last_action: string | null;
  last_action_at: string | null;
}

// eslint-disable-next-line max-len
const COLUMNS = 'id, certificate_identifier, kind, student_number, student_name, programme, qualification, classification, issued_at, issued_by_name, issued_by_role, issuance_status, certificate_version, reissue_request_id, reissue_reason, reissue_status, reissue_authorised_by_name, reissue_authorised_at, events, last_action, last_action_at';

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

export default function CertificateAudit() {
  const { user } = useAuth();
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setRows(null);
    const { data, error: e } = await supabase
      .from('certificate_audit')
      .select(COLUMNS)
      .order('issued_at', { ascending: false })
      .limit(500);
    if (e) { setError(e.message); setRows([]); return; }
    setError(null);
    setRows((data ?? []) as Row[]);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  // THE REFUSAL FROM THE INSIDE. The capability is the same one that opens the
  // certificate design, because the ruling treats the trail and the template as
  // one restricted institutional asset.
  if (!can(user?.role, 'view-certificate-template')) {
    return (
      <Card className="p-5">
        <p className="flex items-start gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <ShieldAlert size={16} className="mt-0.5 flex-shrink-0 text-[#a3283f]" />
          <span>
            The complete certificate audit is the Vice-Chancellor&rsquo;s and the
            SuperAdmin&rsquo;s. Certificates you issued yourself appear on the credential
            register.
          </span>
        </p>
      </Card>
    );
  }

  const replacements = (rows ?? []).filter((r) => r.reissue_request_id).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificate audit"
        subtitle="Every certificate the University has issued, who issued it, and whether it replaced another"
      />

      <Card>
        <CardHeader
          title="Certificate audit log"
          subtitle={rows
            ? `${rows.length} issued · ${replacements} of them replacements`
            : 'Reading…'}
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
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {rows?.length === 0 && !error && (
          <EmptyState
            icon={<Award size={20} />}
            title="No certificate has been issued yet"
            description="Every issue is recorded here the moment it happens, with the officer who issued it, and the record cannot afterwards be edited or removed by any office."
          />
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[#ded6c8] bg-[#f8f6fb] text-left text-xs uppercase tracking-wide text-[#6b6076] dark:border-[#3d3349] dark:bg-[#2a2233]">
                  <th className="px-5 py-2.5 font-medium">Issued</th>
                  <th className="px-3 py-2.5 font-medium">Graduate</th>
                  <th className="px-3 py-2.5 font-medium">Issued by</th>
                  <th className="px-3 py-2.5 font-medium">Standing</th>
                  <th className="px-3 py-2.5 font-medium">Replacement</th>
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
                        {OFFICE[r.issued_by_role ?? ''] ?? r.issued_by_role ?? '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {/* REVOKED AND REPLACED ARE NOT THE SAME THING, and a
                            reader asking "does this certificate still stand"
                            needs the difference at a glance. */}
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.issuance_status === 'issued'
                            ? 'bg-[#e7f5ed] text-[#1f7a4d]'
                            : r.issuance_status === 'revoked'
                              ? 'bg-[#fdeaee] text-[#a3283f]'
                              : 'bg-[#f8f6fb] text-[#5c5366]'
                        }`}
                        >
                          {r.issuance_status ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[#6b6076] dark:text-[#9c93ad]">
                        {r.reissue_request_id ? (
                          <span className="inline-flex items-center gap-1">
                            <Stamp size={13} /> {r.reissue_reason?.replace(/-/g, ' ')}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>

                    {open === r.id && (
                      <tr className="bg-[#faf8fd] dark:bg-[#231c2b]">
                        <td colSpan={5} className="px-5 py-4">
                          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-3">
                            {([
                              ['Certificate', r.certificate_identifier],
                              ['Kind', r.kind],
                              ['Student number', r.student_number],
                              ['Graduate', r.student_name],
                              ['Programme', r.programme],
                              ['Qualification', r.qualification],
                              ['Classification', r.classification],
                              ['Issued', when(r.issued_at)],
                              ['Issued by', r.issued_by_name],
                              ['Role', OFFICE[r.issued_by_role ?? ''] ?? r.issued_by_role],
                              ['Template version', r.certificate_version],
                              ['Standing', r.issuance_status],
                              ['Events recorded', r.events],
                              ['Last action', r.last_action],
                              ['Last action at', r.last_action_at ? when(r.last_action_at) : null],
                              ['Replaced because', r.reissue_reason?.replace(/-/g, ' ')],
                              ['Replacement authorised by', r.reissue_authorised_by_name],
                              ['Authorised', r.reissue_authorised_at ? when(r.reissue_authorised_at) : null],
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

      {/* §10 beside §7, because the question "was this a replacement" and the
          question "may this one be replaced" are asked by the same two offices
          in the same sitting. */}
      <CertificateReissue />

      <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
        A certificate issue cannot be edited or deleted by any office, including this one. A
        correction supersedes and does not overwrite, so both entries stay readable — the
        question asked later is what the University attested to at the time.
      </p>
    </div>
  );
}
