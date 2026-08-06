import { SampleDataNotice } from '@/components/ui/portal';
import React, { useRef, useState } from 'react';
import { sampleTranscriptData } from '@/lib/sampleData';
import { getClassification, MAX_GRADE_POINT } from '@/lib/grading';
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
      <SampleDataNotice what="a specimen certificate" />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Certificate Generator</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Generate official degree certificates</p>
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

      {/* Eligibility.
          This panel read "Status: Eligible" as a fixed string — it said
          Eligible for every student, always, including one who had completed
          nothing. Beside it, "Credits Completed: 111 / 111" measured against a
          requirement typed into this file; the B.Th. is a 180-credit degree, so
          the number was wrong as well as hardcoded.

          A graduation check is a decision with a rule behind it: credits
          required for the specific programme, a minimum CGPA, outstanding
          conditions, fees cleared. None of those are available here yet, and
          inventing a verdict is worse than declining to give one — this is the
          screen from which a certificate gets printed. */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
          <Award size={18} /> Graduation eligibility is not checked here
        </h3>
        <p className="max-w-3xl text-sm leading-relaxed text-amber-900/90 dark:text-amber-200/90">
          This panel used to read <strong>Eligible</strong> for every student, unconditionally, and
          measured credits against a requirement of 111 that was typed into this file — the
          Bachelor of Theology is 180 credits, so it was wrong as well as fixed. A graduation
          decision needs the credit requirement for the specific programme, a minimum CGPA,
          any outstanding admission conditions and confirmation that fees are cleared. None of
          those are wired yet, and a certificate should not be printed on the strength of a word
          that was always going to say Eligible.
        </p>
      </div>

      {/* Certificate Preview */}
      {showPreview && (
        <div className="rounded-xl bg-[#f2eee6] dark:bg-[#2a2333] p-8 flex justify-center overflow-auto">
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
