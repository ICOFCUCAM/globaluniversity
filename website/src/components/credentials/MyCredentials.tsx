'use client';

// ---------------------------------------------------------------------------
// The graduate's credential wallet.
//
// THE THIRD FORMAT. A credential now exists in three forms, and they are the
// same credential rather than three documents that could drift apart — all
// three carry one number, and all three resolve to the same row of the register:
//
//   1. The printed parchment, for the ceremony and the frame.
//   2. The document file, printed or saved from the browser at page size, with
//      the security layers forced on.
//   3. This: a page the graduate keeps for life, with a link they can send to
//      an employer who has never heard of this university.
//
// WHY A SHARE LINK RATHER THAN A FILE. A file emailed to an employer proves
// nothing — it is a file, and files are edited. The link resolves against the
// university's own register at the moment the employer opens it, so a
// credential revoked last week shows as revoked today. That is the difference
// between sending someone a copy of a claim and sending them the university's
// answer.
//
// WHAT THIS DELIBERATELY DOES NOT DO:
//
//   No download of a "verified PDF". A PDF carrying a cryptographic signature
//   that a reader will show as trusted needs an X.509 certificate from a
//   recognised authority and a PDF signing toolchain, neither of which this
//   deployment has. Offering a button that produced an unsigned PDF labelled
//   "digitally signed" would be worse than offering nothing.
//
//   No wallet passes, no blockchain anchoring. Both are real things, and both
//   are decisions for the university rather than defaults — see the Studio's
//   "Not built yet".
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

import { Card, PageHeader, EmptyState, SkeletonRows } from '@/components/ui/portal';
import { BTN_SECONDARY, FOCUS } from '@/lib/portalTheme';
import { Award, Link2, Check, ShieldAlert, ExternalLink } from 'lucide-react';

interface CredentialRow {
  id: string;
  credential_id: string;
  kind: string;
  award: string | null;
  classification: string | null;
  programme: string | null;
  issued_at: string;
  status: string;
  revocation_reason: string | null;
  template_version: number | null;
}

export default function MyCredentials() {

  const [rows, setRows] = useState<CredentialRow[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Read under the holder's own RLS policy — `credentials_own` in
    // 004_credential_register.sql matches on the student row linked to this
    // account. A graduate sees their own credentials and nobody else's, and
    // that is enforced by the database rather than by this query.
    const { data, error } = await supabase
      .from('credentials_issued')
      .select('id, credential_id, kind, award, classification, programme, issued_at, status, revocation_reason, template_version')
      .order('issued_at', { ascending: false });
    if (error) {
      setProblem(error.message);
      setRows([]);
      return;
    }
    setRows((data ?? []) as unknown as CredentialRow[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function shareUrl(credentialId: string): string {
    return `${window.location.origin}/verify?id=${encodeURIComponent(credentialId)}`;
  }

  async function copy(credentialId: string) {
    await navigator.clipboard.writeText(shareUrl(credentialId));
    setCopied(credentialId);
    setTimeout(() => setCopied((c) => (c === credentialId ? null : c)), 2500);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="My credentials"
        subtitle="Every award the university has issued to you, and a link you can send to an employer."
      />

      {problem && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <p>Your credentials could not be loaded: {problem}</p>
        </div>
      )}

      {rows === null ? (
        <SkeletonRows rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Award size={20} />}
          title="No credentials yet"
          description={
            'Credentials appear here once the Office of the Registrar has issued them. A degree ' +
            'certificate is issued after graduation is recorded; a transcript on request.'
          }
        />
      ) : (
        <div className="space-y-4">
          {rows.map((c) => {
            const revoked = c.status === 'revoked';
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a6d1f]">
                      {c.kind === 'certificate' ? 'Degree certificate' : c.kind}
                    </p>
                    <h3 className="mt-1 font-heading text-lg font-bold text-[#33234a] dark:text-[#e4dcf0]">
                      {c.award ?? '—'}
                    </h3>
                    {c.classification && (
                      <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{c.classification}</p>
                    )}
                    <dl className="mt-3 space-y-1 text-[13px]">
                      <div className="flex gap-3">
                        <dt className="w-28 shrink-0 text-[#a49bb0]">Number</dt>
                        <dd className="min-w-0 break-all font-mono text-[12px] text-[#33234a] dark:text-[#e4dcf0]">
                          {c.credential_id}
                        </dd>
                      </div>
                      <div className="flex gap-3">
                        <dt className="w-28 shrink-0 text-[#a49bb0]">Issued</dt>
                        <dd className="text-[#33234a] dark:text-[#e4dcf0]">
                          {new Date(c.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </dd>
                      </div>
                    </dl>

                    {revoked && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        <p className="font-semibold">This credential has been revoked.</p>
                        {c.revocation_reason && <p className="mt-1">{c.revocation_reason}</p>}
                        <p className="mt-1.5 text-xs">
                          It no longer stands, and anyone checking the number will be told so.
                          Contact the Office of the Registrar if you believe this is an error.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-auto">
                    <button
                      onClick={() => void copy(c.credential_id)}
                      disabled={revoked}
                      className={`${BTN_SECONDARY} justify-center disabled:opacity-40`}
                    >
                      {copied === c.credential_id
                        ? <><Check size={15} /> Link copied</>
                        : <><Link2 size={15} /> Copy verification link</>}
                    </button>
                    <a
                      href={`/verify?id=${encodeURIComponent(c.credential_id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`${BTN_SECONDARY} justify-center ${FOCUS}`}
                    >
                      <ExternalLink size={15} /> See what an employer sees
                    </a>
                  </div>
                </div>
              </Card>
            );
          })}

          <p className="px-1 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
            The link resolves against the university&apos;s register at the moment it is opened, so
            it always shows the current standing of the award rather than a copy of it. Send the
            link rather than a file: a file proves nothing, because files can be edited.
          </p>
        </div>
      )}
    </div>
  );
}
