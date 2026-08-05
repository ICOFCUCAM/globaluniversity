import { SampleDataNotice } from '@/components/ui/portal';
import { useCredentialTemplate } from '@/lib/useCredentialTemplate';
import React, { useRef, useState } from 'react';
import TranscriptQR from './TranscriptQR';
import { sampleTranscriptData } from '@/lib/sampleData';
import { UNIVERSITY, IMAGES } from '@/lib/constants';
import { getClassification } from '@/lib/grading';
import type { TranscriptData } from '@/lib/types';
import { Download, Printer, Eye, FileText, QrCode } from 'lucide-react';

export default function TranscriptGenerator() {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [data] = useState<TranscriptData>(sampleTranscriptData);
  const [showPreview, setShowPreview] = useState(true);
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
      <SampleDataNotice what="a specimen transcript" />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Transcript Generator</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Generate official academic transcripts</p>
        </div>
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
                    <p style={{ fontSize: '11px', color: '#666', margin: '2px 0' }}>{UNIVERSITY.address}</p>
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
                  <div><strong>Final CGPA:</strong> {data.cgpa.toFixed(2)}/5.00</div>
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
                <p>{UNIVERSITY.name} · {UNIVERSITY.address} · {UNIVERSITY.website}</p>
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
