'use client';

// ---------------------------------------------------------------------------
// Issuing a degree certificate.
//
// WHAT THIS SCREEN WAS. A specimen. It rendered one hard-coded sample student,
// under a hard-coded 'Bachelor of Science' at a university that does not teach
// one, beside a panel that said "Eligible" for everybody unconditionally and
// measured credits against the number 111 typed into the file. There was no way
// to choose a student, and pressing Download produced a certificate for a person
// who does not exist.
//
// WHAT IT IS NOW. The screen a registrar uses to issue one: choose the graduate,
// see the four checks that decide whether they qualify, and issue — which mints
// a credential number, seals it, and writes it to the register. Until it is
// issued the preview carries SPECIMEN, because until it is issued that is what
// it is.
//
// THE CHECKS ARE SHOWN EVEN WHEN THEY PASS. A registrar signing off a degree
// should see what was checked and what the record said, not a green word. Half
// the value of the panel is on the days it says "cannot be determined".
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getClassification } from '@/lib/grading';
import { PASS_MARK } from '@/lib/grading';
import { useCredentialTemplate } from '@/lib/useCredentialTemplate';
import { assessGraduation, type AwardRule, type GraduationVerdict } from '@/lib/graduation';
import CertificateDocument from './CertificateDocument';
import { Card, PageHeader, EmptyState } from '@/components/ui/portal';
import { BTN_SECONDARY, INPUT, FOCUS } from '@/lib/portalTheme';
import {
  Award, Palette, Check, X, HelpCircle, Loader2, Stamp, Printer, ShieldAlert,
} from 'lucide-react';

interface Candidate {
  id: string;
  student_number: string | null;
  matric_no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  program: string | null;
  degree_type: string | null;
  status: string;
  award_id: string | null;
  admission_conditions: string | null;
}

export default function CertificateGenerator() {
  const template = useCredentialTemplate('certificate');

  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [awards, setAwards] = useState<AwardRule[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [verdict, setVerdict] = useState<GraduationVerdict | null>(null);
  const [cgpa, setCgpa] = useState<number | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{
    credentialId: string; sealCode: string; qrSvg: string; classification: string | null;
  } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const student = candidates?.find((c) => c.id === selectedId) ?? null;
  const award = awards.find((a) => a.id === student?.award_id) ?? null;

  // --- Load the register of candidates -------------------------------------
  useEffect(() => {
    (async () => {
      const [{ data: rows }, { data: aw }] = await Promise.all([
        supabase
          .from('students')
          .select('id, student_number, matric_no, first_name, middle_name, last_name, program, degree_type, status, award_id, admission_conditions')
          .in('status', ['graduated', 'active'])
          .order('last_name'),
        supabase
          .from('awards')
          .select('id, code, title, kind, credits_required, min_cgpa, cgpa_confirmed')
          .eq('active', true),
      ]);
      setCandidates((rows ?? []) as unknown as Candidate[]);
      setAwards(((aw ?? []) as any[]).map((a) => ({
        id: a.id, code: a.code, title: a.title, kind: a.kind,
        creditsRequired: a.credits_required, minCgpa: Number(a.min_cgpa),
        cgpaConfirmed: a.cgpa_confirmed,
      })));
    })();
  }, []);

  // --- Assess the selected candidate ---------------------------------------
  const assess = useCallback(async (c: Candidate) => {
    setAssessing(true);
    setVerdict(null);
    setIssued(null);
    setProblem(null);

    // Credits earned. Passed courses only — a failed course earns none, which
    // is the whole reason this is not simply a count of enrolments.
    const { data: results } = await supabase
      .from('results')
      .select('total_score, courses(credit_unit)')
      .eq('student_id', c.id);
    const creditsEarned = (results ?? []).reduce((sum: number, r: any) => {
      const passed = Number(r.total_score) >= PASS_MARK;
      return passed ? sum + Number(r.courses?.credit_unit ?? 0) : sum;
    }, 0);

    const { data: gpaRow } = await supabase
      .from('semester_gpas')
      .select('cgpa')
      .eq('student_id', c.id)
      .order('academic_year', { ascending: false })
      .order('semester', { ascending: false })
      .limit(1)
      .maybeSingle();
    const cg = gpaRow ? Number((gpaRow as any).cgpa) : null;
    setCgpa(Number.isFinite(cg as number) ? (cg as number) : null);

    let outstanding: { requirement: string; dueBy?: string }[] = [];
    try {
      const parsed = c.admission_conditions ? JSON.parse(c.admission_conditions) : [];
      if (Array.isArray(parsed)) outstanding = parsed;
    } catch {
      // Unparseable conditions are not "none". Reported as one outstanding item
      // so the case is looked at rather than waved through.
      outstanding = [{ requirement: 'The recorded admission conditions could not be read' }];
    }

    setVerdict(assessGraduation({
      award: awards.find((a) => a.id === c.award_id) ?? null,
      creditsEarned,
      cgpa: Number.isFinite(cg as number) ? (cg as number) : null,
      outstandingConditions: outstanding,
      // The university has no per-student fee schedule in this system, so a
      // balance cannot be computed. Reported as unknown rather than as zero:
      // "we did not look" and "nothing is owed" are different answers, and only
      // one of them should let a degree through.
      feeBalance: null,
      status: c.status,
    }));
    setAssessing(false);
  }, [awards]);

  useEffect(() => {
    if (student) void assess(student);
  }, [student, assess]);

  async function issue() {
    if (!student || !award) return;
    setIssuing(true);
    setProblem(null);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      setProblem('Your session has expired. Sign in again to issue.');
      setIssuing(false);
      return;
    }
    const res = await fetch('/api/credential/issue', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        studentId: student.id,
        award: award.title,
        templateVersion: template.version || undefined,
      }),
    }).then((r) => r.json()).catch(() => null);
    setIssuing(false);

    if (!res?.ok) {
      setProblem(res?.detail ?? res?.error ?? 'The credential could not be issued.');
      return;
    }
    setIssued({
      credentialId: res.credential.credentialId,
      sealCode: res.credential.sealCode,
      qrSvg: res.credential.qrSvg,
      classification: res.credential.classification,
    });
  }

  const fullName = student
    ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')
    : '';

  const previewData = useMemo(() => ({
    fullName: fullName || 'Candidate',
    programme: student?.program ?? '',
    degree: award?.title ?? student?.degree_type ?? 'Award',
    classification: issued?.classification
      ?? (cgpa !== null ? getClassification(cgpa) : ''),
    credentialId: issued?.credentialId ?? '',
    sealCode: issued?.sealCode ?? null,
    qrSvg: issued?.qrSvg ?? null,
    registrationNo: student ? `ICOFGU/${award?.code ?? 'GEN'}${new Date().getFullYear()}` : null,
  }), [fullName, student, award, issued, cgpa]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Issue a degree certificate"
        subtitle="Choose the graduate, read the checks, and issue. Issuing writes the credential to the university's register."
      />

      {/* Which design this will print under. Two certificates issued a week
          apart can legitimately differ, and the version is how anyone later
          works out why. */}
      <div className="flex items-center gap-2 rounded-xl bg-[#faf6ee] px-4 py-2.5 text-xs text-[#6b5a2f] ring-1 ring-[#e8dcc0]">
        <Palette size={14} className="shrink-0" />
        {template.loading ? <span>Loading the active design…</span>
          : template.isFallback ? (
            <span><strong>Built-in default.</strong> No published design found — publish one in the Credential Studio.</span>
          ) : (
            <span>Printing under <strong>{template.name}</strong> (design v{template.version}).</span>
          )}
      </div>

      {/* --- Choose the candidate --------------------------------------- */}
      <Card>
        <div className="p-5">
          <label htmlFor="candidate" className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">
            Candidate
          </label>
          {candidates === null ? (
            <p className="mt-2 text-sm text-[#a49bb0]">Loading the register…</p>
          ) : candidates.length === 0 ? (
            <p className="mt-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
              No active or graduated students on the register.
            </p>
          ) : (
            <select
              id="candidate"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className={`${INPUT} mt-1.5`}
            >
              <option value="">Choose a candidate…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.last_name, c.first_name].filter(Boolean).join(', ')}
                  {' — '}{c.student_number ?? c.matric_no}
                  {c.status !== 'graduated' ? ` (${c.status})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {!student ? (
        <EmptyState
          icon={<Award size={20} />}
          title="No candidate chosen"
          description="A certificate is issued to a named graduate against a named award. Choose one above and the checks will run."
        />
      ) : (
        <>
          {/* --- The checks ------------------------------------------- */}
          <Card>
            <div className="p-5">
              <h3 className="flex items-center gap-2 font-heading text-base font-bold text-[#33234a] dark:text-[#e4dcf0]">
                <Award size={17} /> Graduation requirements
              </h3>
              {assessing || !verdict ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-[#a49bb0]">
                  <Loader2 size={14} className="animate-spin" /> Assessing…
                </p>
              ) : (
                <>
                  <p className={`mt-1.5 text-sm leading-relaxed ${
                    verdict.qualifies ? 'text-emerald-700'
                      : verdict.indeterminate ? 'text-amber-800' : 'text-red-700'
                  }`}>
                    {verdict.summary}
                  </p>
                  <ul className="mt-4 space-y-3">
                    {verdict.checks.map((c) => (
                      <li key={c.id} className="flex gap-3">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          c.state === 'met' ? 'bg-emerald-100 text-emerald-700'
                            : c.state === 'unmet' ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}>
                          {c.state === 'met' ? <Check size={12} />
                            : c.state === 'unmet' ? <X size={12} /> : <HelpCircle size={12} />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">
                            {c.label}
                            <span className="ml-2 font-normal text-[#6b6076] dark:text-[#9c93ad]">
                              {c.found}
                            </span>
                          </p>
                          <p className="text-xs text-[#a49bb0]">Requires: {c.required}</p>
                          {c.remedy && (
                            <p className="mt-1 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                              {c.remedy}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Card>

          {problem && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <p>{problem}</p>
            </div>
          )}

          {/* --- Issue ------------------------------------------------- */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                {issued ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-700">
                      Issued and entered on the register.
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      {issued.credentialId} · seal {issued.sealCode}
                    </p>
                  </>
                ) : (
                  <p className="max-w-xl text-sm leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                    Issuing mints a credential number, seals it, and writes it to the register. It
                    cannot be undone — a credential is revoked, never deleted. Until then the
                    preview below carries SPECIMEN, because until then that is what it is.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {issued ? (
                  <button onClick={() => window.print()} className={BTN_SECONDARY}>
                    <Printer size={15} /> Print
                  </button>
                ) : (
                  <button
                    onClick={() => void issue()}
                    disabled={issuing || !verdict?.qualifies}
                    className={`flex items-center gap-2 rounded-xl bg-[#422e59] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#322244] disabled:opacity-40 ${FOCUS}`}
                  >
                    {issuing ? <><Loader2 size={15} className="animate-spin" /> Issuing…</>
                      : <><Stamp size={15} /> Issue certificate</>}
                  </button>
                )}
              </div>
            </div>
          </Card>

          <div className="overflow-auto rounded-xl bg-[#f2eee6] p-6 dark:bg-[#2a2333]">
            <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%' }}>
              <CertificateDocument
                design={template.design}
                version={template.version || undefined}
                data={previewData}
                specimen={!issued}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
