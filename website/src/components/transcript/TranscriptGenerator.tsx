import { SampleDataNotice } from '@/components/ui/portal';
import { supabase } from '@/lib/supabase';
import { buildTranscript, canIssueTranscript } from '@/lib/transcript';
import ProduceCredential from '@/components/credentials/ProduceCredential';
import { INPUT, LABEL, FOCUS, BTN_SECONDARY } from '@/lib/portalTheme';
import { useCredentialTemplate } from '@/lib/useCredentialTemplate';
import React, { useEffect, useRef, useState } from 'react';
import TranscriptQR from './TranscriptQR';
import { sampleTranscriptData } from '@/lib/sampleData';
import { UNIVERSITY, IMAGES } from '@/lib/constants';
import { getClassification, MAX_GRADE_POINT } from '@/lib/grading';
import type { TranscriptData } from '@/lib/types';
import { Download, Printer, Eye, FileText, QrCode, Stamp, Loader2, AlertTriangle, Check } from 'lucide-react';

interface Enrolled {
  id: string; matric_no: string; student_number: string | null;
  first_name: string; middle_name: string | null; last_name: string;
  program: string | null; degree_type: string | null; status: string;
}

export default function TranscriptGenerator({ embedded }: { embedded?: boolean } = {}) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  // THE SAMPLE IS THE FALLBACK, NOT THE PRODUCT. This screen used to hold only
  // `sampleTranscriptData` and had no way to choose a student, so it could
  // print a handsome document for a person who does not exist and nothing else.
  const [data, setData] = useState<TranscriptData>(sampleTranscriptData);
  const [students, setStudents] = useState<Enrolled[] | null>(null);
  const [chosen, setChosen] = useState<string>('');
  const [loadingOne, setLoadingOne] = useState(false);
  const [omitted, setOmitted] = useState<{ reason: string; count: number }[]>([]);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{ id: string | null; credentialId: string; sealCode: string } | null>(null);
  const [producing, setProducing] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const isReal = chosen !== '';
  const refusal = isReal ? canIssueTranscript(data) : null;

  useEffect(() => {
    void (async () => {
      const { data: rows, error } = await supabase
        .from('students')
        .select('id, matric_no, student_number, first_name, middle_name, last_name, program, degree_type, status')
        .order('last_name');
      if (error) { setStudents([]); setNote({ tone: 'bad', text: `The register could not be read: ${error.message}` }); return; }
      setStudents((rows ?? []) as Enrolled[]);
    })();
  }, []);

  /** Assemble this student's transcript from their approved marks. */
  async function choose(id: string) {
    setChosen(id);
    setIssued(null);
    setNote(null);
    if (!id) { setData(sampleTranscriptData); setOmitted([]); return; }

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
        setData(sampleTranscriptData);
        return;
      }
      const built = buildTranscript({
        student: { ...s, photo_url: null } as never,
        department: { name: s.program ?? '', faculty: s.program ?? '' } as never,
        results: (rows ?? []) as never,
      });
      setData(built.data);
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
      setNote({
        tone: 'ok',
        text: `Issued as ${res.credential.credentialId} and entered on the register.`
          + (res.credential.auditWarning ? ` ${res.credential.auditWarning}` : ''),
      });
    } finally {
      setIssuing(false);
    }
  }

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
      setNote({ tone: 'ok', text: res.message ?? 'Sent, and recorded on the audit trail.' });
    } finally {
      setProducing(false);
    }
  }
  // The page setup and typeface come from the published transcript design, the
  // same record the certificate reads. Two official documents of one university
  // set in two different faces, because two components each hardcoded their
  // own, is the kind of detail a registrar's office is judged on.
  const template = useCredentialTemplate('transcript');

  function handlePrint() {
    const content = transcriptRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Academic Transcript - ${data.student.matric_no}</title>
          <style>
            @page { size: ${template.design.pageSize} ${template.design.orientation}; margin: 15mm; }
            body { margin: 0; font-family: ${template.design.fontFamily}; }
            /* Backgrounds and rules are the document, not decoration. Without
               this Chrome drops every fill and the seal, and the transcript
               prints as unbranded text nobody would accept as official. */
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            * { box-sizing: border-box; }
            ${getTranscriptStyles()}
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  }

  // Calculate running CGPA
  let runningTotalQP = 0;
  let runningTotalCU = 0;

  return (
    <div className="space-y-6">
      {/* ONLY WHEN IT IS A SPECIMEN. The notice used to be unconditional,
          which meant it would have gone on saying "specimen" over a real
          graduate's record. */}
      {!isReal && <SampleDataNotice what="a specimen transcript" />}

      {!embedded && (
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Transcript Generator</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Generate official academic transcripts</p>
        </div>
      </div>
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
          onProduce={handlePrint}
          onEmail={() => void produce('email')}
        />
      )}

      <div className="flex items-center justify-end">
        <div className="flex gap-2">
          <button onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#f2eee6] text-[#33234a] dark:bg-[#2a2333] dark:text-[#d8d2e2] rounded-xl text-sm font-medium hover:bg-[#e9e3d7] dark:hover:bg-[#332b3d] transition-colors">
            <Eye size={16} /> {showPreview ? 'Hide' : 'Show'} Preview
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors shadow-lg shadow-purple-900/20">
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      {/* Student Info Card */}
      <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-5">
        <div className="flex items-center gap-4">
          <img src={data.student.photo_url || IMAGES.students[0]} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-[#ece7f4]" />
          <div className="flex-1">
            <h3 className="font-bold text-[#33234a] dark:text-[#e4dcf0]">{data.student.last_name} {data.student.first_name} {data.student.middle_name}</h3>
            <p className="text-sm text-[#6b6076] dark:text-[#9c93ad] font-mono">{data.student.matric_no}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{data.student.degree_type} {data.student.program}</p>
            <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{data.department.faculty}</p>
            <div className="mt-1">
              <span className="text-lg font-bold text-[#422e59]">CGPA: {data.cgpa}</span>
              <span className="text-xs text-[#a49bb0] dark:text-[#7b7289] ml-2">({getClassification(data.cgpa)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transcript Preview */}
      {showPreview && (
        <div className="rounded-xl bg-[#f2eee6] dark:bg-[#2a2333] p-8 flex justify-center overflow-auto">
          <div ref={transcriptRef} className="bg-white shadow-2xl" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', fontFamily: "'Times New Roman', Times, serif", position: 'relative' }}>
            {/* Watermark */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)', opacity: 0.04, fontSize: '80px', fontWeight: 'bold', color: '#422e59', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 0 }}>
              {UNIVERSITY.shortName}
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '3px double #422e59', paddingBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '8px' }}>
                  <img src={IMAGES.logo} alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#422e59', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
                      {UNIVERSITY.name}
                    </h1>
                    {/* The seat of the institution, not the campus. A transcript
                        is read abroad, by an admissions office or an employer
                        deciding what the award is worth; it has to name the
                        university that made it. */}
                    <p style={{ fontSize: '11px', color: '#666', margin: '2px 0' }}>{UNIVERSITY.descriptor}</p>
                    <p style={{ fontSize: '10px', color: '#888', margin: '1px 0' }}>{UNIVERSITY.headquarters}</p>
                  </div>
                  <img src={IMAGES.seal} alt="Seal" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#333', margin: '8px 0 0', textTransform: 'uppercase', letterSpacing: '4px' }}>
                  ACADEMIC TRANSCRIPT OF RECORDS
                </h2>
              </div>

              {/* Student Bio */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px', marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
                <div><strong>Name:</strong> {data.student.last_name.toUpperCase()}, {data.student.first_name} {data.student.middle_name}</div>
                <div><strong>Matric Number:</strong> {data.student.matric_no}</div>
                <div><strong>Programme:</strong> {data.student.degree_type} {data.student.program}</div>
                <div><strong>Department:</strong> {data.department.name}</div>
                <div><strong>Faculty:</strong> {data.department.faculty}</div>
                <div><strong>Date of Birth:</strong> {data.student.date_of_birth ? new Date(data.student.date_of_birth).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}</div>
                <div><strong>Admission Year:</strong> {data.student.admission_year}/{data.student.admission_year + 1}</div>
                <div><strong>Nationality:</strong> {data.student.nationality}</div>
                <TranscriptQR student={data.student} />
              </div>

              {/* Academic Records */}
              {data.years.map((year) => {
                return (
                  <div key={year.year} style={{ marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#422e59', margin: '10px 0 5px', textTransform: 'uppercase', borderBottom: '1px solid #422e59', paddingBottom: '3px' }}>
                      Year {year.year} ({data.student.admission_year + year.year - 1}/{data.student.admission_year + year.year} Academic Session)
                    </h3>

                    {year.semesters.map((sem) => {
                      runningTotalQP += sem.totalGradePoints;
                      runningTotalCU += sem.totalCredits;
                      const cgpa = Number((runningTotalQP / runningTotalCU).toFixed(2));

                      return (
                        <div key={sem.semester} style={{ marginBottom: '10px' }}>
                          <h4 style={{ fontSize: '11px', fontWeight: 'bold', color: '#444', margin: '6px 0 4px', textDecoration: 'underline' }}>
                            {sem.semester === 1 ? 'First' : 'Second'} Semester
                          </h4>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#422e59', color: 'white' }}>
                                <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #422e59' }}>Course Code</th>
                                <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #422e59' }}>Course Title</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #422e59' }}>Credit Unit</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #422e59' }}>Grade</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #422e59' }}>Grade Point</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #422e59' }}>Quality Point</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sem.courses.map((course, ci) => (
                                <tr key={ci} style={{ backgroundColor: ci % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                                  <td style={{ padding: '3px 6px', border: '1px solid #ddd', fontWeight: 'bold' }}>{course.code}</td>
                                  <td style={{ padding: '3px 6px', border: '1px solid #ddd' }}>{course.title}</td>
                                  <td style={{ padding: '3px 6px', border: '1px solid #ddd', textAlign: 'center' }}>{course.creditUnit}</td>
                                  <td style={{ padding: '3px 6px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold' }}>{course.grade}</td>
                                  <td style={{ padding: '3px 6px', border: '1px solid #ddd', textAlign: 'center' }}>{course.gradePoint.toFixed(1)}</td>
                                  <td style={{ padding: '3px 6px', border: '1px solid #ddd', textAlign: 'center' }}>{course.qualityPoint.toFixed(1)}</td>
                                </tr>
                              ))}
                              {/* Semester Summary */}
                              <tr style={{ backgroundColor: '#e8eaf6', fontWeight: 'bold' }}>
                                <td colSpan={2} style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'right' }}>Semester Total</td>
                                <td style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'center' }}>{sem.totalCredits}</td>
                                <td colSpan={2} style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'center' }}>GPA: {sem.gpa.toFixed(2)}</td>
                                <td style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'center' }}>{sem.totalGradePoints.toFixed(1)}</td>
                              </tr>
                              <tr style={{ backgroundColor: '#c5cae9', fontWeight: 'bold' }}>
                                <td colSpan={2} style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'right' }}>Cumulative</td>
                                <td style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'center' }}>{runningTotalCU}</td>
                                <td colSpan={2} style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'center' }}>CGPA: {cgpa.toFixed(2)}</td>
                                <td style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'center' }}>{runningTotalQP.toFixed(1)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Summary */}
              <div style={{ marginTop: '15px', padding: '10px', border: '2px solid #422e59', backgroundColor: '#e8eaf6' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div><strong>Total Credits Earned:</strong> {data.totalCredits}</div>
                  <div><strong>Final CGPA:</strong> {data.cgpa.toFixed(2)}/{MAX_GRADE_POINT.toFixed(2)}</div>
                  <div><strong>Classification:</strong> {data.classification}</div>
                </div>
              </div>

              {/* QR Code & Verification */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
                <div style={{ fontSize: '10px', color: '#666' }}>
                  <div style={{ width: '70px', height: '70px', border: '2px solid #422e59', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                    <svg width="50" height="50" viewBox="0 0 50 50">
                      <rect x="0" y="0" width="15" height="15" fill="#422e59"/>
                      <rect x="17" y="0" width="5" height="5" fill="#422e59"/>
                      <rect x="25" y="0" width="5" height="5" fill="#422e59"/>
                      <rect x="35" y="0" width="15" height="15" fill="#422e59"/>
                      <rect x="2" y="2" width="11" height="11" fill="white"/>
                      <rect x="4" y="4" width="7" height="7" fill="#422e59"/>
                      <rect x="37" y="2" width="11" height="11" fill="white"/>
                      <rect x="39" y="4" width="7" height="7" fill="#422e59"/>
                      <rect x="0" y="17" width="5" height="5" fill="#422e59"/>
                      <rect x="8" y="17" width="5" height="5" fill="#422e59"/>
                      <rect x="17" y="17" width="5" height="5" fill="#422e59"/>
                      <rect x="25" y="20" width="5" height="5" fill="#422e59"/>
                      <rect x="35" y="17" width="5" height="5" fill="#422e59"/>
                      <rect x="0" y="25" width="5" height="5" fill="#422e59"/>
                      <rect x="10" y="25" width="5" height="5" fill="#422e59"/>
                      <rect x="20" y="25" width="5" height="5" fill="#422e59"/>
                      <rect x="30" y="25" width="5" height="5" fill="#422e59"/>
                      <rect x="45" y="25" width="5" height="5" fill="#422e59"/>
                      <rect x="0" y="35" width="15" height="15" fill="#422e59"/>
                      <rect x="2" y="37" width="11" height="11" fill="white"/>
                      <rect x="4" y="39" width="7" height="7" fill="#422e59"/>
                      <rect x="17" y="35" width="5" height="5" fill="#422e59"/>
                      <rect x="25" y="35" width="5" height="5" fill="#422e59"/>
                      <rect x="35" y="35" width="5" height="5" fill="#422e59"/>
                      <rect x="45" y="35" width="5" height="5" fill="#422e59"/>
                      <rect x="35" y="45" width="5" height="5" fill="#422e59"/>
                      <rect x="42" y="42" width="8" height="8" fill="#422e59"/>
                    </svg>
                  </div>
                  <p>Scan to verify</p>
                  <p>Ref: TR-{data.student.matric_no.replace(/\//g, '')}-{new Date().getFullYear()}</p>
                </div>

                <div style={{ textAlign: 'center', fontSize: '10px' }}>
                  <div style={{ borderTop: '1px solid #333', width: '180px', paddingTop: '4px', marginBottom: '4px' }}>
                    <strong>{UNIVERSITY.registrar}</strong>
                  </div>
                  <p>Registrar</p>
                </div>

                <div style={{ textAlign: 'center', fontSize: '10px' }}>
                  <div style={{ borderTop: '1px solid #333', width: '180px', paddingTop: '4px', marginBottom: '4px' }}>
                    <strong>{UNIVERSITY.viceChancellor}</strong>
                  </div>
                  <p>Vice Chancellor</p>
                </div>
              </div>

              {/* Footer */}
              <div style={{ marginTop: '15px', textAlign: 'center', fontSize: '9px', color: '#999', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                <p>This transcript is issued without erasure or alteration. Any unauthorized modification renders it invalid.</p>
                <p>Date of Issue: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                <p>{UNIVERSITY.name} · {UNIVERSITY.descriptor} · {UNIVERSITY.headquarters} · {UNIVERSITY.website}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTranscriptStyles(): string {
  return `
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
}
