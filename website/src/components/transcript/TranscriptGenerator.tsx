'use client';

// ---------------------------------------------------------------------------
// ISSUING A TRANSCRIPT FROM A STUDENT'S OWN RECORD.
//
// ---------------------------------------------------------------------------
// WHAT THIS SCREEN USED TO DRAW, AND WHY IT IS GONE
// ---------------------------------------------------------------------------
//
// Four hundred lines of inline JSX: a portrait sheet with purple table headers,
// a hand-drawn SVG standing in for a QR code, striped rows, and a summary panel
// in indigo. It was a fifth transcript design, and it was the one people
// actually saw — while the sheet the University spent twelve rounds correcting,
// `TranscriptMaster`, was rendered by nothing at all.
//
// The preview below is now that component, and so is the emailed copy, and so
// is the Studio's design preview. One document.
//
// ---------------------------------------------------------------------------
// THE SINGLE BUTTON AT THE END OF A PROGRAMME
// ---------------------------------------------------------------------------
//
// The University asked for a transcript that is "generated with a single button
// at the end of a study program where all studies information for that program
// is completed". The button existed; nothing offered it. A registrar had to
// know which student had finished and find them in a list of everyone.
//
// So the students whose earned credits meet their award's requirement are now
// gathered at the top of the screen. It is a PROMPT, not a gate — a transcript
// is routinely issued mid-programme, for a visa or a transfer, and this refuses
// nobody. See `programmeProgress`.
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase';
import { buildTranscript, canIssueTranscript, creditsEarned as earnedFrom } from '@/lib/transcript';
import ProduceCredential from '@/components/credentials/ProduceCredential';
import { TranscriptPreview } from '@/components/transcript/TranscriptMaster';
import { programmeProgress, type Progress, type TranscriptMasterData } from '@/lib/transcriptMaster';
import { SPECIMEN_TRANSCRIPT } from '@/lib/transcriptSpecimen';
import { INPUT, LABEL, FOCUS } from '@/lib/portalTheme';
import { useCredentialTemplate } from '@/lib/useCredentialTemplate';
import { PASS_MARK } from '@/lib/grading';
import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Eye, Stamp, Loader2, AlertTriangle, Check, GraduationCap } from 'lucide-react';

interface Enrolled {
  id: string; matric_no: string; student_number: string | null;
  first_name: string; middle_name: string | null; last_name: string;
  program: string | null; degree_type: string | null; status: string;
  award_id: string | null;
}

/** How many result rows the completion sweep will read before giving up. */
const SWEEP_CAP = 5000;

export default function TranscriptGenerator({ embedded }: { embedded?: boolean } = {}) {
  // THE SPECIMEN IS THE FALLBACK, NOT THE PRODUCT — and it is now built from
  // the University's own Bachelor of Theology rather than a Computer Science
  // programme this institution does not teach.
  const [data, setData] = useState<TranscriptMasterData>(SPECIMEN_TRANSCRIPT);
  const [students, setStudents] = useState<Enrolled[] | null>(null);
  const [chosen, setChosen] = useState<string>('');
  const [loadingOne, setLoadingOne] = useState(false);
  const [omitted, setOmitted] = useState<{ reason: string; count: number }[]>([]);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{ id: string | null; credentialId: string; sealCode: string } | null>(null);
  const [producing, setProducing] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  /** student id -> how far through the programme they are. */
  const [progress, setProgress] = useState<Map<string, Progress> | null>(null);
  const [sweepNote, setSweepNote] = useState<string | null>(null);

  const isReal = chosen !== '';
  const refusal = isReal ? canIssueTranscript(data) : null;

  // The page setup and typeface come from the published transcript design, the
  // same record the certificate reads. Two official documents of one university
  // set in two different faces, because two components each hardcoded their
  // own, is the kind of detail a registrar's office is judged on.
  const template = useCredentialTemplate('transcript');

  useEffect(() => {
    void (async () => {
      const { data: rows, error } = await supabase
        .from('students')
        .select('id, matric_no, student_number, first_name, middle_name, last_name, program, degree_type, status, award_id')
        .order('last_name');
      if (error) { setStudents([]); setNote({ tone: 'bad', text: `The register could not be read: ${error.message}` }); return; }
      setStudents((rows ?? []) as Enrolled[]);
    })();
  }, []);

  // --- Who has finished ----------------------------------------------------
  //
  // ONE SWEEP, NOT ONE QUERY PER STUDENT. And it reports its own limits: if
  // there are more result rows than the sweep read, the queue is suppressed
  // rather than shown incomplete, because a queue that quietly omits the
  // students who have finished is worse than no queue.
  useEffect(() => {
    if (!students || students.length === 0) return;
    void (async () => {
      const [{ data: rows, error, count }, { data: awards }] = await Promise.all([
        supabase
          .from('results')
          .select('student_id, total_score, courses(credit_unit)', { count: 'exact' })
          .in('status', ['approved', 'published'])
          .limit(SWEEP_CAP),
        supabase.from('awards').select('id, credits_required'),
      ]);

      if (error) { setSweepNote(`Completion could not be established: ${error.message}`); return; }
      if ((count ?? 0) > (rows?.length ?? 0)) {
        setSweepNote(
          `There are ${count} approved results and this screen reads ${SWEEP_CAP}, so who has `
          + 'finished cannot be established from one sweep. Choose the student below; issuing is '
          + 'unaffected.',
        );
        return;
      }

      const required = new Map<string, number>();
      for (const a of (awards ?? []) as { id: string; credits_required: number }[]) {
        required.set(a.id, Number(a.credits_required));
      }

      const earned = new Map<string, number>();
      for (const r of (rows ?? []) as unknown as {
        student_id: string; total_score: number | null; courses: { credit_unit: number | null } | null;
      }[]) {
        // PASSED COURSES ONLY. A failed course is attempted and not earned, and
        // counting it would put students in the finished queue who have not.
        if (Number(r.total_score) < PASS_MARK) continue;
        earned.set(r.student_id, (earned.get(r.student_id) ?? 0) + Number(r.courses?.credit_unit ?? 0));
      }

      const map = new Map<string, Progress>();
      for (const s of students) {
        map.set(s.id, programmeProgress({
          creditsEarned: earned.get(s.id) ?? 0,
          creditsRequired: s.award_id ? required.get(s.award_id) ?? null : null,
        }));
      }
      setProgress(map);
      setSweepNote(null);
    })();
  }, [students]);

  const finished = useMemo(
    () => (students ?? []).filter((s) => progress?.get(s.id)?.complete),
    [students, progress],
  );

  /** Assemble this student's transcript from their approved marks. */
  async function choose(id: string) {
    setChosen(id);
    setIssued(null);
    setNote(null);
    if (!id) { setData(SPECIMEN_TRANSCRIPT); setOmitted([]); return; }

    const s = students?.find((x) => x.id === id);
    if (!s) return;
    setLoadingOne(true);
    try {
      const { data: rows, error } = await supabase
        .from('results')
        .select('total_score, grade, grade_point, status, courses(code, title, credit_unit, year, semester)')
        .eq('student_id', id);
      if (error) {
        setNote({ tone: 'bad', text: `The marks could not be read: ${error.message}. Nothing is shown below rather than a partial record.` });
        setData(SPECIMEN_TRANSCRIPT);
        return;
      }
      const built = buildTranscript({
        student: { ...s, photo_url: null } as never,
        department: { name: s.program ?? '', faculty: s.program ?? '' } as never,
        // The programme decides whether a class of award is printed at all — a
        // doctoral candidate's transcript must not carry one.
        award: s.program ?? undefined,
        results: (rows ?? []) as never,
      });
      setData({
        ...built.data,
        studentNumber: s.student_number ?? s.matric_no,
        creditsEarned: earnedFrom((rows ?? []) as never),
        // NOT YET ISSUED, and the sheet says so rather than printing a blank
        // where a credential number belongs.
        credentialId: null,
        version: 1,
      });
      setOmitted(built.omitted);
    } finally {
      setLoadingOne(false);
    }
  }

  async function issue() {
    if (!chosen) return;
    setIssuing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch('/api/credential/transcript', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.session?.access_token ?? ''}` },
        body: JSON.stringify({ studentId: chosen, templateVersion: template.version ?? undefined }),
      }).then((r) => r.json()).catch(() => null);

      if (!res?.ok) { setNote({ tone: 'bad', text: res?.detail ?? res?.error ?? 'It could not be issued.' }); return; }
      setIssued({ id: res.credential.id, credentialId: res.credential.credentialId, sealCode: res.credential.sealCode });
      setData((d) => ({
        ...d,
        credentialId: res.credential.credentialId,
        sealCode: res.credential.sealCode,
        issuedOn: res.credential.issuedOn ?? d.issuedOn,
      }));
      setNote({
        tone: 'ok',
        text: `Issued as ${res.credential.credentialId} and entered on the register.`
          + (res.credential.auditWarning ? ` ${res.credential.auditWarning}` : ''),
      });
    } finally {
      setIssuing(false);
    }
  }

  /**
   * Print or email the sealed document.
   *
   * BOTH GO THROUGH THE SERVER. Printing a sealed credential is an auditable
   * act and a browser print dialogue leaves no trace anywhere — so the route
   * writes the trail, then hands back the HTML it rendered. That HTML is
   * `TranscriptMaster`, the same component previewed below.
   */
  async function produce(action: 'print' | 'email') {
    if (!issued?.id) return;
    setProducing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch('/api/credential/deliver', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.session?.access_token ?? ''}` },
        body: JSON.stringify({ credentialId: issued.id, action }),
      }).then((r) => r.json()).catch(() => null);
      if (!res?.ok) { setNote({ tone: 'bad', text: res?.detail ?? res?.error ?? 'It could not be sent.' }); return; }
      if (action === 'print' && res.html) {
        const w = window.open('', '_blank');
        if (!w) { setNote({ tone: 'bad', text: 'The browser blocked the print window. Allow pop-ups and try again.' }); return; }
        w.document.write(res.html); w.document.close();
        w.addEventListener('load', () => w.print());
      }
      setNote({ tone: 'ok', text: res.message ?? 'Sent, and recorded on the audit trail.' });
    } finally {
      setProducing(false);
    }
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Transcript</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
            Built from the marks that have cleared the approval chain, sealed on the register, and
            produced as paper, a PDF or an email.
          </p>
        </div>
      )}

      {/* --- Who has finished -------------------------------------------- */}
      {finished.length > 0 && (
        <div className="rounded-xl border border-emerald-600/30 bg-emerald-600/5 p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-200">
            <GraduationCap size={16} />
            {finished.length} student{finished.length === 1 ? ' has' : 's have'} completed a programme
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
            Earned credits meet the award’s requirement. This is a prompt, not a graduation
            decision — the Senate confers, and the certificate screen runs the full audit.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {finished.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => void choose(s.id)}
                  className={`rounded-lg border border-emerald-600/40 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-50 dark:bg-[#1f1a27] dark:text-emerald-200 ${FOCUS}`}
                >
                  {s.last_name} {s.first_name} · {progress?.get(s.id)?.percent ?? 100}%
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sweepNote && (
        <p className="rounded-lg border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-3 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          {sweepNote}
        </p>
      )}

      {/* --- Choose the student ------------------------------------------ */}
      <div className="rounded-xl border border-[#ece7de] bg-white p-5 dark:border-[#2e2637] dark:bg-[#1f1a27]">
        <label className={LABEL} htmlFor="transcript-student">Student</label>
        <select
          id="transcript-student"
          value={chosen}
          onChange={(e) => void choose(e.target.value)}
          className={`${INPUT} mt-1 max-w-xl`}
        >
          <option value="">— a specimen, for checking the layout —</option>
          {(students ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.last_name} {s.first_name} · {s.student_number ?? s.matric_no} · {s.program ?? 'no programme recorded'}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#8a8194]">
          {students === null
            ? 'Reading the register…'
            : students.length === 0
              ? 'No students are on the register yet, so only the specimen can be shown.'
              : 'Built from the marks that have cleared the approval chain. Drafts are never printed.'}
        </p>

        {isReal && progress?.get(chosen) && (
          <p className="mt-2 text-[11px] text-[#6b6076] dark:text-[#9c93ad]">
            {progress.get(chosen)!.note}
          </p>
        )}

        {loadingOne && (
          <p className="mt-3 flex items-center gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
            <Loader2 size={14} className="animate-spin" /> Assembling the record…
          </p>
        )}

        {/* WHAT IS NOT ON THIS DOCUMENT. A transcript that silently omits half
            a student's record is the failure this exists to prevent. */}
        {isReal && omitted.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-3 text-xs text-[#6b6076] dark:text-[#9c93ad]">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#a07c12]" />
            <div>
              <strong>Not every result is on this transcript.</strong>
              <ul className="mt-1 list-disc pl-4">
                {omitted.map((o) => <li key={o.reason}>{o.count} {o.reason}</li>)}
              </ul>
            </div>
          </div>
        )}

        {refusal && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {refusal}
          </p>
        )}

        {note && (
          <p role="status" className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-xs ${
            note.tone === 'ok'
              ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
              : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
          }`}>
            {note.tone === 'ok' ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
            {note.text}
          </p>
        )}

        {isReal && !refusal && (
          <div className="mt-4">
            {issued ? (
              <p className="font-mono text-xs text-[#6b6076] dark:text-[#9c93ad]">
                {issued.credentialId} · seal {issued.sealCode}
              </p>
            ) : (
              <button
                onClick={() => void issue()}
                disabled={issuing}
                className={`inline-flex items-center gap-2 rounded-xl bg-[#422e59] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#322244] disabled:opacity-40 ${FOCUS}`}
              >
                {issuing ? <><Loader2 size={15} className="animate-spin" /> Issuing…</> : <><Stamp size={15} /> Issue this transcript</>}
              </button>
            )}
            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-[#8a8194]">
              Issuing seals this record as it stands and writes it to the register, so it can be
              verified by a stranger. If the marks are corrected later, the transcript is reissued
              as a new version — the original is never overwritten.
            </p>
          </div>
        )}
      </div>

      {/* --- Produce it -------------------------------------------------- */}
      {issued && (
        <ProduceCredential
          allowed
          mayEmail={Boolean(issued.id)}
          busy={producing}
          onProduce={() => void produce('print')}
          onEmail={() => void produce('email')}
        />
      )}

      {/* --- The sheet ---------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[#8a8194]">
          {issued
            ? 'The sealed document. Printing it goes through the register and is recorded.'
            : isReal
              ? 'This record has not been sealed. Issue it before producing a copy.'
              : 'A specimen, built from the University’s own Bachelor of Theology.'}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 rounded-xl bg-[#f2eee6] px-4 py-2.5 text-sm font-medium text-[#33234a] transition-colors hover:bg-[#e9e3d7] dark:bg-[#2a2333] dark:text-[#d8d2e2] dark:hover:bg-[#332b3d] ${FOCUS}`}>
            <Eye size={16} /> {showPreview ? 'Hide' : 'Show'} the sheet
          </button>
          {/* UNSEALED COPIES PRINT AS SPECIMENS. A browser print of a record
              that is not on the register would put an unverifiable University
              transcript into the world with no audit entry behind it. */}
          <button
            onClick={() => window.print()}
            disabled={!showPreview}
            className={`flex items-center gap-2 rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#322244] disabled:opacity-40 ${FOCUS}`}>
            <Printer size={16} /> {issued ? 'Print this preview' : 'Print as a specimen'}
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="overflow-auto rounded-xl bg-[#f2eee6] p-6 dark:bg-[#2a2333]">
          <TranscriptPreview
            design={template.design}
            data={data}
            // A SPECIMEN UNTIL IT IS ON THE REGISTER. The overprint is the
            // difference between a preview and a document, and a preview that
            // does not say so is a document.
            specimen={!issued}
          />
        </div>
      )}
    </div>
  );
}
