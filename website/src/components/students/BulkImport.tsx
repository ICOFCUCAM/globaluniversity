'use client';

// Bulk student import — paste or upload CSV to register many students at
// once. Built for migrating historic records (e.g. from the legacy
// RosarioSIS system) into the university management system.
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, X, CheckCircle2, AlertTriangle } from 'lucide-react';

const COLUMNS = [
  'matric_no',
  'first_name',
  'last_name',
  'middle_name',
  'email',
  'phone',
  'gender',
  'date_of_birth',
  'nationality',
  'program',
  'degree_type',
  'admission_year',
  'status',
] as const;

const TEMPLATE = `${COLUMNS.join(',')}
IGUC/2024/THE/001,Divine,Ngwa,A,divine@example.com,+237600000000,Male,1998-04-12,Cameroonian,Theology,B.Th.,2024,active`;

/** Minimal CSV parser handling quoted fields. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(cur.trim());
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (cur !== '' || row.length) {
        row.push(cur.trim());
        rows.push(row);
        row = [];
        cur = '';
      }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else cur += c;
  }
  if (cur !== '' || row.length) {
    row.push(cur.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell !== ''));
}

export default function BulkImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);

  function analyse(raw: string) {
    setText(raw);
    setResult(null);
    const rows = parseCsv(raw);
    if (rows.length < 2) {
      setPreview([]);
      setErrors(rows.length ? ['Add at least one data row beneath the header.'] : []);
      return;
    }
    const header = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'));
    const problems: string[] = [];
    for (const required of ['matric_no', 'first_name', 'last_name']) {
      if (!header.includes(required)) problems.push(`Missing required column: ${required}`);
    }
    const records = rows.slice(1).map((r) => {
      const rec: Record<string, string> = {};
      header.forEach((h, i) => {
        if ((COLUMNS as readonly string[]).includes(h) && r[i]) rec[h] = r[i];
      });
      return rec;
    });
    records.forEach((rec, i) => {
      if (!rec.matric_no || !rec.first_name || !rec.last_name) {
        problems.push(`Row ${i + 2}: matric_no, first_name and last_name are all required.`);
      }
    });
    setErrors(problems);
    setPreview(records);
  }

  async function importAll() {
    setBusy(true);
    let ok = 0;
    let failed = 0;
    for (const rec of preview) {
      const payload: Record<string, unknown> = {
        matric_no: rec.matric_no,
        first_name: rec.first_name,
        last_name: rec.last_name,
        middle_name: rec.middle_name ?? null,
        email: rec.email ?? null,
        phone: rec.phone ?? null,
        gender: rec.gender ?? null,
        date_of_birth: rec.date_of_birth || null,
        nationality: rec.nationality ?? null,
        program: rec.program ?? null,
        degree_type: rec.degree_type ?? null,
        admission_year: Number(rec.admission_year) || new Date().getFullYear(),
        status: rec.status || 'active',
      };
      const { error } = await supabase.from('students').insert(payload);
      if (error) failed++;
      else ok++;
    }
    setBusy(false);
    setResult({ ok, failed });
    if (ok > 0) onDone();
  }

  const field =
    'w-full rounded-lg border border-[#ded6c8] dark:border-[#3d3349] bg-gray-50 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">Bulk Import Students</h3>
            <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Paste CSV or upload a file to register many students at once</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="rounded-full bg-gray-100 p-2 text-[#6b6076] dark:text-[#9c93ad]">
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg bg-[#422e59] px-4 py-2 text-sm font-medium text-white hover:bg-[#322244]">
            <Upload size={14} className="mr-1.5 inline" />
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) analyse(await f.text());
              }}
            />
          </label>
          <button onClick={() => analyse(TEMPLATE)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-[#4a4155] dark:text-[#c8c1d4]">
            Load template
          </button>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
            download="iguc-student-import-template.csv"
            className="text-sm font-medium text-[#422e59] underline"
          >
            Download template
          </a>
        </div>

        <textarea
          rows={6}
          className={`${field} font-mono text-xs`}
          placeholder="matric_no,first_name,last_name,email,program,admission_year…"
          value={text}
          onChange={(e) => analyse(e.target.value)}
        />

        {errors.length > 0 && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            <p className="mb-1 flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={13} /> Fix before importing
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              {errors.slice(0, 6).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {preview.length > 0 && errors.length === 0 && (
          <div className="mt-3 max-h-40 overflow-auto rounded-lg border border-[#ece7de] dark:border-[#2e2637]">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {['matric_no', 'first_name', 'last_name', 'program', 'admission_year'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-[#6b6076] dark:text-[#9c93ad]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
                {preview.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 font-mono">{r.matric_no}</td>
                    <td className="px-3 py-1.5">{r.first_name}</td>
                    <td className="px-3 py-1.5">{r.last_name}</td>
                    <td className="px-3 py-1.5">{r.program ?? '—'}</td>
                    <td className="px-3 py-1.5">{r.admission_year ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 size={15} /> Imported {result.ok} student{result.ok === 1 ? '' : 's'}
            {result.failed > 0 && ` · ${result.failed} failed (duplicate matric number or invalid data)`}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">
            {preview.length > 0 ? `${preview.length} record${preview.length === 1 ? '' : 's'} ready` : 'Required: matric_no, first_name, last_name'}
          </p>
          <button
            disabled={busy || preview.length === 0 || errors.length > 0}
            onClick={importAll}
            className="rounded-xl bg-[#422e59] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#322244] disabled:opacity-50"
          >
            {busy ? 'Importing…' : `Import ${preview.length || ''} student${preview.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
