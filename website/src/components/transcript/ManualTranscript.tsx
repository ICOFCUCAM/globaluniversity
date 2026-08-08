'use client';

// ---------------------------------------------------------------------------
// TRANSCRIBING A RECORD FROM BEFORE THIS SYSTEM.
//
// ---------------------------------------------------------------------------
// WHY THE UNIVERSITY NEEDS THIS
// ---------------------------------------------------------------------------
//
// The University's records are older than its database. A graduate of 2011
// asking for a transcript, or a university abroad asking for one on their
// behalf, cannot be served by deriving it from marks — there are none here to
// derive it from. Somebody has to read the paper register and type it in.
//
// ---------------------------------------------------------------------------
// AND WHY IT IS THE MOST CAREFULLY GUARDED SCREEN IN THE SYSTEM
// ---------------------------------------------------------------------------
//
// Everything the approval chain guarantees is absent here by construction. No
// lecturer submitted these marks, no Head of Department or Dean approved them,
// no moderator saw them. The University is standing behind them on the strength
// of an archive and the person typing.
//
// That is legitimate — it is what a registry does — but a transcribed
// transcript that looks identical to a derived one would be the most dangerous
// document this system could produce. So:
//
//   * the Superadministrator alone reaches this screen, and the route checks
//     again rather than trusting that
//   * the source of the figures is required, and is PRINTED ON THE SHEET
//   * the totals are computed and shown BEFORE sealing, from the same function
//     the derived transcript uses, so the operator sees what they are about to
//     put the University's seal on
//   * `facts.source` is 'transcribed' on the register for ever
//
// The grade point is DERIVED FROM THE GRADE rather than typed. Two free-text
// fields that must agree are two fields that eventually do not, and the
// disagreement is invisible on the printed sheet — the grade reads A and the
// GPA is computed from 3.0.
// ---------------------------------------------------------------------------

import React from 'react';
import { Plus, Trash2, Stamp, Loader2, AlertTriangle, Check, Archive } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { can } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import { GRADING_SCALE } from '@/lib/grading';
import { courses as CATALOGUE } from '@/content/courses';
import { awardKindOf, awardWording } from '@/lib/awards';
import { buildTranscript, canIssueTranscript } from '@/lib/transcript';
import ProduceCredential from '@/components/credentials/ProduceCredential';
import { INPUT, LABEL, FOCUS, CARD, BTN_SECONDARY } from '@/lib/portalTheme';

interface Row {
  key: string;
  code: string;
  title: string;
  creditUnit: string;
  grade: string;
  year: string;
  semester: string;
}

const MIN_SOURCE = 12;

const blank = (n: number): Row => ({
  key: `r${n}`, code: '', title: '', creditUnit: '3',
  grade: GRADING_SCALE[0]?.grade ?? 'A', year: '1', semester: '1',
});

/** The point value the University publishes for this grade. */
function pointFor(grade: string): number {
  return GRADING_SCALE.find((g) => g.grade === grade)?.gradePoint ?? 0;
}

export default function ManualTranscript({ role }: { role?: UserRole }) {
  // Hiding the screen is courtesy; the route checks the capability again.
  if (!can(role, 'transcribe-historical-record')) return null;

  return <Form />;
}

function Form() {
  const [holderName, setHolderName] = React.useState('');
  const [studentNumber, setStudentNumber] = React.useState('');
  // CHOSEN FROM THE CATALOGUE, NOT TYPED. A free-text programme is how a
  // sealed University transcript ends up naming a qualification the University
  // does not offer — and unlike a wrong grade, nobody in the registry would
  // notice, because it reads perfectly well.
  const [programme, setProgramme] = React.useState('');
  const [sourceRecord, setSourceRecord] = React.useState('');
  const [rows, setRows] = React.useState<Row[]>([blank(1), blank(2), blank(3)]);
  const [busy, setBusy] = React.useState(false);
  const [producing, setProducing] = React.useState(false);
  const [issued, setIssued] = React.useState<{ id: string | null; credentialId: string; sealCode: string } | null>(null);
  const [note, setNote] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const [nextKey, setNextKey] = React.useState(4);

  // The level follows the programme, and everything else follows the level.
  const chosen = CATALOGUE.find((c) => c.title === programme);
  const kind = programme ? awardKindOf(programme) : null;
  const classified = kind ? awardWording(kind).classified : true;

  /**
   * How many academic years this level runs to.
   *
   * NOT A RULE THE UNIVERSITY HAS PUBLISHED — it bounds the Year field so a
   * Certificate does not offer Year 4, and nothing more. A record that
   * genuinely ran longer is still typeable; the list is a convenience, not a
   * constraint, because the archive is the authority here and not this table.
   */
  const yearsFor = (k: string | null): number => {
    switch (k) {
      case 'certificate': return 1;
      case 'diploma': return 2;
      case 'bachelors': return 4;
      case 'masters': return 2;
      case 'doctorate': return 4;
      default: return 6;
    }
  };
  const maxYear = yearsFor(kind);

  function set(key: string, field: keyof Row, value: string) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  const filled = rows.filter((r) => r.code.trim() && Number(r.creditUnit) > 0);

  // COMPUTED BEFORE SEALING, with the same function the derived transcript
  // uses. An operator who cannot see the GPA until after the document is on the
  // register is being asked to seal a number they have not read.
  const preview = React.useMemo(() => buildTranscript({
    student: { first_name: holderName || 'Unnamed', last_name: '', matric_no: studentNumber } as never,
    department: { name: programme } as never,
    award: programme || undefined,
    results: filled.map((r) => ({
      total_score: null,
      grade: r.grade,
      grade_point: pointFor(r.grade),
      status: 'approved',
      courses: {
        code: r.code.trim(),
        title: r.title.trim() || r.code.trim(),
        credit_unit: Number(r.creditUnit) || 0,
        year: Number(r.year) || 0,
        semester: Number(r.semester) || 0,
      },
    })) as never,
  }), [filled, holderName, studentNumber, programme]);

  const sourceShort = sourceRecord.trim().length < MIN_SOURCE;
  const refusal = filled.length > 0 ? canIssueTranscript(preview.data) : null;
  const blocked = !holderName.trim() || !programme || sourceShort || filled.length === 0 || Boolean(refusal);

  async function issue() {
    setBusy(true);
    setNote(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch('/api/credential/transcript', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.session?.access_token ?? ''}` },
        body: JSON.stringify({
          manual: {
            holderName: holderName.trim(),
            studentNumber: studentNumber.trim() || undefined,
            programme: programme.trim() || undefined,
            sourceRecord: sourceRecord.trim(),
            // The level, so the route applies the same rule about whether a
            // class of award is printed.
            award: programme.trim() || undefined,
            rows: filled.map((r) => ({
              code: r.code.trim(),
              title: r.title.trim(),
              creditUnit: Number(r.creditUnit),
              grade: r.grade,
              gradePoint: pointFor(r.grade),
              year: Number(r.year),
              semester: Number(r.semester),
            })),
          },
        }),
      }).then((r) => r.json()).catch(() => null);

      if (!res?.ok) { setNote({ tone: 'bad', text: res?.detail ?? res?.error ?? 'It could not be issued.' }); return; }
      setIssued({ id: res.credential.id, credentialId: res.credential.credentialId, sealCode: res.credential.sealCode });
      setNote({ tone: 'ok', text: `Transcribed and sealed as ${res.credential.credentialId}. The register records it as transcribed from an archived record, permanently.` });
    } finally {
      setBusy(false);
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
      if (!res?.ok) { setNote({ tone: 'bad', text: res?.detail ?? res?.error ?? 'It could not be produced.' }); return; }
      if (action === 'print' && res.html) {
        const w = window.open('', '_blank');
        if (!w) { setNote({ tone: 'bad', text: 'The browser blocked the print window. Allow pop-ups and try again.' }); return; }
        w.document.write(res.html); w.document.close();
        w.addEventListener('load', () => w.print());
      }
      setNote({ tone: 'ok', text: res.message ?? 'Done, and recorded on the audit trail.' });
    } finally {
      setProducing(false);
    }
  }

  return (
    <div className={`${CARD} p-5`}>
      <h3 className="flex items-center gap-2 font-heading text-base font-bold text-[#422e59] dark:text-[#e4dcf0]">
        <Archive size={17} /> Transcribe a record from before this system
      </h3>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
        For a past year the database never held, or a graduate whose record is on paper. These
        marks did <strong>not</strong> pass through the approval chain, so the transcript will say
        on its face that it was transcribed, and the register will record it as such permanently.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={LABEL}>Holder’s full name *</span>
          <input value={holderName} onChange={(e) => setHolderName(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
        <label className="block">
          <span className={LABEL}>Student number, if there was one</span>
          <input value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
        <label className="block">
          <span className={LABEL}>Programme *</span>
          <select value={programme} onChange={(e) => setProgramme(e.target.value)} className={`${INPUT} mt-1`}>
            <option value="">— choose the award —</option>
            {['Certificate', 'Diploma', 'HND', 'Bachelor', 'Master', 'Doctorate', 'Professional'].map((lvl) => {
              const inLevel = CATALOGUE.filter((c) => c.level === lvl);
              if (inLevel.length === 0) return null;
              return (
                <optgroup key={lvl} label={lvl}>
                  {inLevel.map((c) => <option key={c.code} value={c.title}>{c.title}</option>)}
                </optgroup>
              );
            })}
          </select>
          <span className="mt-1 block text-[11px] leading-relaxed text-[#8a8194]">
            {chosen
              ? `${chosen.level} · ${chosen.faculty}${classified ? '' : ' · not classified'}`
              : 'From the University’s own catalogue, so a transcript cannot name an award it does not offer.'}
          </span>
        </label>
      </div>

      <label className="mt-3 block">
        <span className={LABEL}>Where these figures come from *</span>
        <input
          value={sourceRecord}
          onChange={(e) => setSourceRecord(e.target.value)}
          placeholder="e.g. Registry examination register, volume IV, pages 88–91, session 2010/2011"
          className={`${INPUT} mt-1`}
        />
        <span className="mt-1 block text-[11px] leading-relaxed text-[#8a8194]">
          Printed on the transcript and kept on the register. A sealed document that cannot say
          where its marks came from is worth less than an unsealed one that can.
        </span>
      </label>

      {/* --- The courses ------------------------------------------------- */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-[#6b6076] dark:text-[#9c93ad]">
              <th className="pb-1 pr-2">Code</th>
              <th className="pb-1 pr-2">Title</th>
              <th className="pb-1 pr-2">Credits</th>
              <th className="pb-1 pr-2">Grade</th>
              <th className="pb-1 pr-2">Yr</th>
              <th className="pb-1 pr-2">Sem</th>
              <th className="pb-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="py-1 pr-2"><input aria-label="Course code" value={r.code} onChange={(e) => set(r.key, 'code', e.target.value)} className={`${INPUT} w-24`} /></td>
                <td className="py-1 pr-2"><input aria-label="Course title" value={r.title} onChange={(e) => set(r.key, 'title', e.target.value)} className={`${INPUT} w-full min-w-[12rem]`} /></td>
                <td className="py-1 pr-2"><input aria-label="Credit unit" type="number" min="0" value={r.creditUnit} onChange={(e) => set(r.key, 'creditUnit', e.target.value)} className={`${INPUT} w-16`} /></td>
                <td className="py-1 pr-2">
                  {/* CHOSEN, NOT TYPED, and the point value follows it. Two
                      fields that must agree are two fields that eventually do
                      not, and on a printed transcript the disagreement is
                      invisible. */}
                  <select aria-label="Grade" value={r.grade} onChange={(e) => set(r.key, 'grade', e.target.value)} className={`${INPUT} w-20`}>
                    {GRADING_SCALE.map((g) => <option key={g.grade} value={g.grade}>{g.grade}</option>)}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <select aria-label="Year" value={r.year} onChange={(e) => set(r.key, 'year', e.target.value)} className={`${INPUT} w-16`}>
                    {Array.from({ length: maxYear }, (_, i) => String(i + 1)).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2"><input aria-label="Semester" type="number" min="0" value={r.semester} onChange={(e) => set(r.key, 'semester', e.target.value)} className={`${INPUT} w-14`} /></td>
                <td className="py-1">
                  <button
                    onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}
                    aria-label={`Remove ${r.code || 'this row'}`}
                    className={`rounded-lg p-1.5 text-[#a49bb0] hover:text-red-700 ${FOCUS}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => { setRows((rs) => [...rs, blank(nextKey)]); setNextKey((n) => n + 1); }}
        className={`${BTN_SECONDARY} mt-2 text-[11px]`}
      >
        <Plus size={13} /> Add a course
      </button>

      {/* --- What is about to be sealed ---------------------------------- */}
      {filled.length > 0 && (
        <div className="mt-4 rounded-lg bg-[#f2eee6] p-3 text-sm dark:bg-[#2a2333]">
          <strong className="text-[#422e59] dark:text-[#e4dcf0]">Before sealing:</strong>{' '}
          {filled.length} course{filled.length === 1 ? '' : 's'} ·{' '}
          {preview.data.totalCredits} credits ·{' '}
          CGPA {preview.data.cgpa.toFixed(2)}
          {preview.data.classification
            ? ` · ${preview.data.classification}`
            : kind ? ` · ${kind === 'doctorate' ? 'a doctorate is passed, not classified' : 'this award carries no class'}` : ''}
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

      <div className="mt-4">
        {issued ? (
          <p className="font-mono text-xs text-[#6b6076] dark:text-[#9c93ad]">
            {issued.credentialId} · seal {issued.sealCode}
          </p>
        ) : (
          <>
            <button
              onClick={() => void issue()}
              disabled={busy || blocked}
              className={`inline-flex items-center gap-2 rounded-xl bg-[#422e59] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#322244] disabled:opacity-40 ${FOCUS}`}
            >
              {busy ? <><Loader2 size={15} className="animate-spin" /> Sealing…</> : <><Stamp size={15} /> Transcribe and seal</>}
            </button>
            {/* Names what is missing rather than leaving a dead button. */}
            {blocked && (
              <p className="mt-2 text-[11px] text-[#8a8194]">
                {!holderName.trim() ? 'Give the holder’s full name.'
                  : !programme ? 'Choose the programme, so the level decides how the record is read.'
                  : filled.length === 0 ? 'Add at least one course with a code and a credit unit above zero.'
                    : sourceShort ? 'Say where these figures come from, in at least a dozen characters.'
                      : 'Check the courses above.'}
              </p>
            )}
          </>
        )}
      </div>

      {issued && (
        <div className="mt-4">
          <ProduceCredential
            allowed
            mayEmail={Boolean(issued.id)}
            busy={producing}
            onProduce={() => void produce('print')}
            onEmail={() => void produce('email')}
          />
        </div>
      )}
    </div>
  );
}
