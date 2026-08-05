import React, { useRef, useState } from 'react';
import { sampleTranscriptData } from '@/lib/sampleData';
import { getClassification } from '@/lib/grading';
import { useCredentialTemplate } from '@/lib/useCredentialTemplate';
import CertificateDocument from './CertificateDocument';
import { Download, Eye, Award, Palette } from 'lucide-react';

export default function CertificateGenerator() {
  const certRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(true);
  const data = sampleTranscriptData;
  // The design comes from the active published template, not from this file.
  // Only the Superadministrator can change it — see the Credential Studio.
  const template = useCredentialTemplate('certificate');

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
            @page { size: ${template.design.pageSize} ${template.design.orientation}; margin: 0; }
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

      {/* Which design this will print under. Worth stating plainly: two
          certificates issued a week apart can legitimately differ, and the
          version is how anyone later works out why. */}
      <div className="flex items-center gap-2 rounded-xl bg-[#faf6ee] px-4 py-2.5 text-xs text-[#6b5a2f] ring-1 ring-[#e8dcc0]">
        <Palette size={14} />
        {template.loading ? (
          <span>Loading the active design…</span>
        ) : template.isFallback ? (
          <span>
            <strong>Built-in default.</strong> No published design found — run
            <code className="mx-1 rounded bg-white px-1">002_superadmin.sql</code>
            and publish a version in the Credential Studio.
          </span>
        ) : (
          <span>
            Printing under <strong>{template.name}</strong> (design v{template.version}).
            Only the Superadministrator can change this.
          </span>
        )}
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
          <CertificateDocument
            ref={certRef}
            design={template.design}
            version={template.version || undefined}
            data={{
              fullName: `${data.student.last_name.toUpperCase()}, ${data.student.first_name} ${data.student.middle_name ?? ''}`.trim(),
              programme: data.student.program,
              degree: 'Bachelor of Science',
              classification,
              serial: `CERT/${data.student.matric_no.replace(/\//g, '')}`,
            }}
          />
        </div>
      )}

    </div>
  );
}
