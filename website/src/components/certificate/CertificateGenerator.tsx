import React, { useRef, useState } from 'react';
import { sampleTranscriptData } from '@/lib/sampleData';
import { UNIVERSITY, IMAGES } from '@/lib/constants';
import { getClassification } from '@/lib/grading';
import { Download, Eye, Award } from 'lucide-react';

export default function CertificateGenerator() {
  const certRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(true);
  const data = sampleTranscriptData;

  function handlePrint() {
    const content = certRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Degree Certificate - ${data.student.matric_no}</title>
          <style>
            @page { size: A4 landscape; margin: 0; }
            body { margin: 0; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  }

  const classification = getClassification(data.cgpa);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Certificate Generator</h2>
          <p className="text-sm text-gray-500">Generate official degree certificates</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
            <Eye size={16} /> {showPreview ? 'Hide' : 'Show'} Preview
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors shadow-lg shadow-purple-900/20">
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      {/* Eligibility Check */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Award size={18} className="text-amber-500" /> Graduation Eligibility</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-emerald-50 rounded-lg">
            <p className="text-xs text-emerald-600 font-medium">Credits Completed</p>
            <p className="text-lg font-bold text-emerald-700">{data.totalCredits} / 111</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600 font-medium">Final CGPA</p>
            <p className="text-lg font-bold text-blue-700">{data.cgpa} / 5.00</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-purple-600 font-medium">Classification</p>
            <p className="text-sm font-bold text-purple-700">{classification}</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-600 font-medium">Status</p>
            <p className="text-lg font-bold text-amber-700">Eligible</p>
          </div>
        </div>
      </div>

      {/* Certificate Preview */}
      {showPreview && (
        <div className="bg-gray-100 rounded-xl p-8 flex justify-center overflow-auto">
          <div ref={certRef}>
            <div style={{
              width: '297mm', height: '210mm', padding: '15mm',
              fontFamily: "'Times New Roman', Times, serif",
              position: 'relative', backgroundColor: '#fffff8',
              border: '3px solid #422e59', boxSizing: 'border-box',
              background: 'linear-gradient(135deg, #fffff8 0%, #f5f0e8 100%)',
            }}>
              {/* Decorative Border */}
              <div style={{
                position: 'absolute', top: '8mm', left: '8mm', right: '8mm', bottom: '8mm',
                border: '2px solid #c5a55a', borderRadius: '2px',
              }} />
              <div style={{
                position: 'absolute', top: '10mm', left: '10mm', right: '10mm', bottom: '10mm',
                border: '1px solid #c5a55a',
              }} />

              {/* Watermark */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                opacity: 0.05, zIndex: 0,
              }}>
                <img src={IMAGES.seal} alt="" style={{ width: '200px', height: '200px' }} />
              </div>

              {/* Content */}
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '10mm' }}>
                {/* Logo */}
                <img src={IMAGES.logo} alt="Logo" style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', marginBottom: '10px' }} />

                {/* University Name */}
                <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#422e59', margin: '0', textTransform: 'uppercase', letterSpacing: '4px' }}>
                  {UNIVERSITY.name}
                </h1>
                <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 15px', letterSpacing: '2px' }}>
                  {UNIVERSITY.address}
                </p>

                <div style={{ width: '60px', height: '2px', backgroundColor: '#c5a55a', margin: '5px auto' }} />

                <p style={{ fontSize: '14px', color: '#444', margin: '15px 0 5px', letterSpacing: '3px', textTransform: 'uppercase' }}>
                  This is to certify that
                </p>

                {/* Student Name */}
                <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#422e59', margin: '10px 0', fontStyle: 'italic', borderBottom: '2px solid #c5a55a', paddingBottom: '5px' }}>
                  {data.student.last_name.toUpperCase()}, {data.student.first_name} {data.student.middle_name}
                </h2>

                <p style={{ fontSize: '13px', color: '#444', margin: '8px 0', letterSpacing: '1px' }}>
                  having satisfied the requirements prescribed by the Senate of the University
                </p>
                <p style={{ fontSize: '13px', color: '#444', margin: '4px 0', letterSpacing: '1px' }}>
                  is hereby awarded the degree of
                </p>

                {/* Degree */}
                <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#422e59', margin: '12px 0 5px', textTransform: 'uppercase', letterSpacing: '3px' }}>
                  Bachelor of Science
                </h3>
                <p style={{ fontSize: '16px', color: '#333', margin: '4px 0', fontWeight: 'bold' }}>
                  in {data.student.program}
                </p>

                {/* Classification */}
                <div style={{ margin: '12px 0', padding: '6px 30px', border: '2px solid #c5a55a', display: 'inline-block' }}>
                  <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#422e59', margin: 0, letterSpacing: '2px' }}>
                    {classification.toUpperCase()}
                  </p>
                </div>

                <p style={{ fontSize: '11px', color: '#666', margin: '8px 0' }}>
                  with all the rights, privileges and responsibilities thereunto appertaining
                </p>

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '20px', padding: '0 20mm' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #333', width: '150px', paddingTop: '4px', fontSize: '11px' }}>
                      <strong>{UNIVERSITY.viceChancellor}</strong>
                      <p style={{ margin: '2px 0 0', color: '#666' }}>Vice Chancellor</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <img src={IMAGES.seal} alt="Seal" style={{ width: '60px', height: '60px', opacity: 0.8 }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #333', width: '150px', paddingTop: '4px', fontSize: '11px' }}>
                      <strong>{UNIVERSITY.registrar}</strong>
                      <p style={{ margin: '2px 0 0', color: '#666' }}>Registrar</p>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '10px', color: '#999', marginTop: '10px' }}>
                  Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · Certificate No: CERT/{data.student.matric_no.replace(/\//g, '')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
