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
import {
  awaitingRegistryCode, coursesForProgramme, programmesWithCourses,
} from '@/content/programmeCourses';
import { ectsFor } from '@/content/creditFramework';
import { awardKindOf, awardWording, nominalYears } from '@/lib/awards';
import { buildTranscript, canIssueTranscript } from '@/lib/transcript';
import ProduceCredential from '@/components/credentials/ProduceCredential';
import { TranscriptPreview } from '@/components/transcript/TranscriptMaster';
import { useCredentialTemplate } from '@/lib/useCredentialTemplate';
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

/**
 * The modes the University teaches in, as migration 019 constrains them.
 *
 * THE SCHOOL IS NOT ONLY ONLINE, and the transcript should not read as though
 * it were. The route checks this list again rather than trusting the dropdown.
 */
const STUDY_MODES = [
  { value: 'on-campus', label: 'On-campus' },
  { value: 'online', label: 'Online' },
  { value: 'distance', label: 'Distance' },
  { value: 'blended', label: 'Blended — on-campus and online' },
];

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
  // THE NAME IN THREE PARTS, as the sheet prints it. One box holding
  // "Grace Nalova Meyembi" cannot be split back into Surname / First Names /
  // Middle Name with any certainty — two-word surnames are ordinary — and a
  // wrong split is printed under a seal that cannot be edited afterwards.
  const [surname, setSurname] = React.useState('');
  const [firstNames, setFirstNames] = React.useState('');
  const [middleName, setMiddleName] = React.useState('');
  const [studentNumber, setStudentNumber] = React.useState('');
  // CHOSEN FROM THE CATALOGUE, NOT TYPED. A free-text programme is how a
  // sealed University transcript ends up naming a qualification the University
  // does not offer — and unlike a wrong grade, nobody in the registry would
  // notice, because it reads perfectly well.
  const [programme, setProgramme] = React.useState('');
  const [sourceRecord, setSourceRecord] = React.useState('');
  // The particulars the transcript prints, and the date it bears.
  const [issuedOn, setIssuedOn] = React.useState('');
  const [dateOfBirth, setDateOfBirth] = React.useState('');
  const [placeOfBirth, setPlaceOfBirth] = React.useState('');
  const [sex, setSex] = React.useState('');
  const [studentAddress, setStudentAddress] = React.useState('');
  // HOW THEY STUDIED, and it is not assumed. The University teaches on campus,
  // online and at a distance; a transcript that omits the mode leaves a
  // receiving institution to guess, and one that quietly says "online" states
  // something about the holder that the archive may not support.
  const [modeOfStudy, setModeOfStudy] = React.useState('');
  const [campus, setCampus] = React.useState('');
  const [rows, setRows] = React.useState<Row[]>([blank(1), blank(2), blank(3)]);
  const [busy, setBusy] = React.useState(false);
  const [producing, setProducing] = React.useState(false);
  const [issued, setIssued] = React.useState<{
    id: string | null; credentialId: string; sealCode: string; qrSvg?: string | null;
  } | null>(null);
  const [note, setNote] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const [nextKey, setNextKey] = React.useState(4);

  const holderName = [firstNames, middleName, surname]
    .map((p) => p.trim()).filter(Boolean).join(' ');

  // The published design, so what is typed here previews under the same
  // template the Registrar's screen and the emailed copy use.
  const template = useCredentialTemplate('transcript');

  // The level follows the programme, and everything else follows the level.
  const chosen = CATALOGUE.find((c) => c.title === programme);
  const kind = programme ? awardKindOf(programme) : null;
  const classified = kind ? awardWording(kind).classified : true;

  // The nominal length of this level, from the awards layer rather than a
  // table in this component — the University has ruled on two of them
  // (bachelor 3, doctorate 2) and those rulings belong where the certificate
  // can read them too. It bounds the Year field and refuses nothing: a record
  // that genuinely ran longer, through a repeat or an interruption, is a real
  // thing and the archive is the authority here.
  const maxYear = nominalYears(programme || null);

  function set(key: string, field: keyof Row, value: string) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  // ---------------------------------------------------------------------
  // THE PROGRAMME'S OWN COURSES, RATHER THAN THIRTY-SIX RETYPED LINES.
  //
  // The University publishes the code, the title, the credit value, the year
  // and the semester of every course on its programmes, and this repository
  // carries them. Asking an operator to type them again is not a neutral cost:
  // it is thirty-six chances to put a course on a SEALED University document
  // under a name the University does not use, and nobody in the registry would
  // notice, because it reads perfectly well.
  //
  // THE ARCHIVE SUPPLIES THE GRADES; THE UNIVERSITY SUPPLIES THE COURSES. So
  // the grade column is left exactly as it was — filling that from anywhere
  // but the paper register is the one thing this screen must never do.
  // ---------------------------------------------------------------------
  const schedule = React.useMemo(() => coursesForProgramme(programme), [programme]);
  /** The courses on this schedule the faculty has not yet given a code. */
  const awaiting = React.useMemo(
    () => (schedule ? awaitingRegistryCode(schedule) : []), [schedule]);

  /** Has the operator typed anything into the rows yet? */
  const typedAnything = rows.some((r) => r.code.trim() || r.title.trim());

  function fillFromProgramme() {
    if (!schedule) return;
    let n = nextKey;
    setRows(schedule.courses.map((c) => {
      const key = `r${n}`;
      n += 1;
      return {
        key,
        code: c.code,
        title: c.title,
        // A CREDIT VALUE THE UNIVERSITY HAS NOT STATED IS LEFT BLANK, not set
        // to a common number. The Diploma of Theology's schedule carries no
        // credit values, and inventing 3 would put a figure on a sealed
        // transcript that no committee approved.
        creditUnit: c.credits === null ? '' : String(c.credits),
        // UNTOUCHED. The whole purpose of this screen is that the marks come
        // from the archive.
        grade: GRADING_SCALE[0]?.grade ?? 'A',
        year: String(c.year),
        semester: String(c.semester),
      };
    }));
    setNextKey(n);
  }

  const filled = rows.filter((r) => r.code.trim() && Number(r.creditUnit) > 0);

  // COMPUTED BEFORE SEALING, with the same function the derived transcript
  // uses. An operator who cannot see the GPA until after the document is on the
  // register is being asked to seal a number they have not read.
  const preview = React.useMemo(() => buildTranscript({
    student: {
      first_name: firstNames.trim(),
      middle_name: middleName.trim(),
      last_name: surname.trim(),
      matric_no: studentNumber,
    } as never,
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
  }), [filled, firstNames, middleName, surname, studentNumber, programme]);

  const sourceShort = sourceRecord.trim().length < MIN_SOURCE;
  const refusal = filled.length > 0 ? canIssueTranscript(preview.data) : null;
  const blocked = !surname.trim() || !firstNames.trim() || !programme || sourceShort || filled.length === 0 || Boolean(refusal);

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
            surname: surname.trim(),
            firstNames: firstNames.trim(),
            middleName: middleName.trim(),
            holderName,
            studentNumber: studentNumber.trim() || undefined,
            programme: programme.trim() || undefined,
            sourceRecord: sourceRecord.trim(),
            issuedOn: issuedOn || undefined,
            dateOfBirth: dateOfBirth.trim() || undefined,
            placeOfBirth: placeOfBirth.trim() || undefined,
            sex: sex.trim() || undefined,
            studentAddress: studentAddress.trim() || undefined,
            modeOfStudy: modeOfStudy || undefined,
            campus: campus.trim() || undefined,
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
      setIssued({
        id: res.credential.id,
        credentialId: res.credential.credentialId,
        sealCode: res.credential.sealCode,
        qrSvg: res.credential.qrSvg ?? null,
      });
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
          <span className={LABEL}>Surname *</span>
          <input value={surname} onChange={(e) => setSurname(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
        <label className="block">
          <span className={LABEL}>First names *</span>
          <input value={firstNames} onChange={(e) => setFirstNames(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
        <label className="block">
          <span className={LABEL}>Middle name</span>
          <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
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

      {/* The particulars the sheet prints, and the date it bears. */}
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className={LABEL}>Date of birth</span>
          <input value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} placeholder="16/06/1984" className={`${INPUT} mt-1`} />
        </label>
        <label className="block">
          <span className={LABEL}>Place of birth</span>
          <input value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
        <label className="block">
          <span className={LABEL}>Sex</span>
          <input value={sex} onChange={(e) => setSex(e.target.value)} maxLength={4} className={`${INPUT} mt-1`} />
        </label>
        <label className="block">
          <span className={LABEL}>Study mode</span>
          <select
            value={modeOfStudy}
            onChange={(e) => setModeOfStudy(e.target.value)}
            className={`${INPUT} mt-1`}
          >
            {/* BLANK IS A REAL ANSWER and it is the default. An archive that
                does not record how somebody studied is common, and the sheet
                prints nothing rather than a guess. */}
            <option value="">— not recorded —</option>
            {STUDY_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={LABEL}>Teaching location</span>
          <input
            value={campus}
            onChange={(e) => setCampus(e.target.value)}
            placeholder="the campus that taught the programme"
            className={`${INPUT} mt-1`}
          />
        </label>

        <label className="block">
          <span className={LABEL}>Student address</span>
          <input value={studentAddress} onChange={(e) => setStudentAddress(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
      </div>

      <label className="mt-3 block max-w-xs">
        <span className={LABEL}>Date the transcript bears</span>
        <input
          type="date"
          value={issuedOn}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setIssuedOn(e.target.value)}
          className={`${INPUT} mt-1`}
        />
        {/* BACK-DATING THE DOCUMENT IS NOT BACK-DATING THE REGISTER. A 2011
            graduate's transcript should bear a 2011 date — the University did
            issue them a record then. What must never move is the register's
            own account of when this row was written, and it does not: both
            dates go on the row and into the audit entry. */}
        <span className="mt-1 block text-[11px] leading-relaxed text-[#8a8194]">
          Leave blank for today. A past date is printed on the sheet; the register still records
          when it was actually written, and the audit entry carries both. A future date is refused.
        </span>
      </label>

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

      {/* --- The programme's own courses ---------------------------------- */}
      {programme && (
        <div className="mt-5 rounded-xl border border-[#ece7de] bg-[#faf8f4] p-4 dark:border-[#2e2637] dark:bg-[#241d2e]">
          {schedule ? (
            <>
              <p className="text-xs font-semibold text-[#33234a] dark:text-[#e4dcf0]">
                The University publishes {schedule.courses.length} courses for this programme.
              </p>
              <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                {schedule.source} Filling them in gives you every code, title, year and semester
                from the University&rsquo;s own record{schedule.creditsUnstated
                  ? ' — but not the credit values, because the University has not published them '
                    + 'for this programme, and a figure invented here would be sealed onto the '
                    + 'transcript'
                  : ', and the credit value of each'}.
                {' '}<strong>Everything stays editable</strong>, and the grades are never touched:
                those come from the archive and nowhere else.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={fillFromProgramme}
                  className={`${BTN_SECONDARY} text-xs`}
                >
                  {typedAnything
                    ? `Replace the rows with the ${schedule.courses.length} published courses`
                    : `Fill in the ${schedule.courses.length} published courses`}
                </button>
              </div>

              {/* A WARNING BEFORE WORK IS DESTROYED, not after. Filling replaces
                  every row, and an operator who has typed twenty lines from a
                  paper register must not lose them to a button they pressed to
                  see what it did. */}
              {typedAnything && (
                <p className="mt-1.5 text-[11px] text-[#a07c12]">
                  This replaces the rows you have already typed. Nothing else on the form changes.
                </p>
              )}

              {/* WHICH CODES ARE THE FACULTY'S, AND WHICH ARE STANDING IN.
                  The University's codes belong to the subject — BIS 250 is
                  Bible Doctrine I on every programme — and the operator has the
                  paper archive open in front of them. Naming the courses the
                  faculty has not yet numbered turns a silent guess into a
                  correction somebody can make in the moment. */}
              {awaiting.length > 0 && (
                <p className="mt-2 max-w-3xl rounded-lg border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-2.5 text-[11px] leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                  <strong>{awaiting.length} of these {schedule.courses.length} courses carry a
                  programme code, not a faculty one.</strong>{' '}
                  The University&rsquo;s registry numbers a subject once and every programme uses
                  that number — Bible Doctrine I is BIS 250 on the Diploma and on the Bachelor
                  alike. These {awaiting.length} are subjects the published listings do not yet
                  number, so they stand in with the code from the programme brief:{' '}
                  <span className="font-mono">{awaiting.slice(0, 6).map((c) => c.code).join(', ')}</span>
                  {awaiting.length > 6 && ` and ${awaiting.length - 6} more`}. If the archive shows
                  the faculty code, type it over — nothing here is fixed.
                </p>
              )}
            </>
          ) : (
            /* NO INVENTED LIST. The University has published courses for three
               programmes and not for the rest, and offering a plausible course
               list nobody approved is exactly the failure this screen exists to
               avoid. */
            <p className="max-w-3xl text-[11px] leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
              The University has not published a course schedule for this programme, so there is
              nothing to fill in from — type the courses as the archive records them. Published
              schedules exist for: {programmesWithCourses().join(', ')}.
            </p>
          )}
        </div>
      )}

      {/* --- Does the record add up to the award? -------------------------- */}
      {/* THE ONE FIGURE A READER CHECKS FIRST, and the screen was not showing
          it. The University has ruled that a bachelor's degree is 180 ECTS, a
          diploma 120 and a master's 120 — and a transcribed record that totals
          108 because the credit column was left at its default of 3 looks
          entirely normal on this form and is wrong on a sealed document.
          Shown live, against the University's own ruling for this level. */}
      {programme && filled.length > 0 && (() => {
        const total = filled.reduce((t, r) => t + (Number(r.creditUnit) || 0), 0);
        const required = chosen ? ectsFor(chosen.level) : null;
        const matches = required !== null && total === required;
        return (
          <p className={`mt-4 rounded-lg p-3 text-xs ${
            required === null
              ? 'bg-[#f2eee6] text-[#6b6076] dark:bg-[#2a2333] dark:text-[#9c93ad]'
              : matches
                ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
                : 'border border-[#e9c14a]/40 bg-[#e9c14a]/10 text-[#6b6076] dark:text-[#9c93ad]'
          }`}>
            <strong>{total} credits</strong> across {filled.length} course{filled.length === 1 ? '' : 's'}
            {required === null
              // A DOCTORATE HAS NO CREDIT VALUE and that is the normal state,
              // not a gap. Comparing against nothing and calling it a shortfall
              // would be inventing a requirement.
              ? '. The University states no credit value for this level — a doctorate is examined '
                + 'by thesis — so there is nothing to check this total against.'
              : matches
                ? `. This matches the ${required} the University has ruled for this level.`
                : `, against the ${required} the University has ruled for this level — a `
                  + `difference of ${Math.abs(required - total)}. A record genuinely does differ `
                  + 'sometimes, through transfer credit or a repeated year, and the archive is the '
                  + 'authority here. Nothing is refused; check it before sealing.'}
          </p>
        );
      })()}

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

      {/* --- The sheet itself, as it will be sealed --------------------- */}
      {/* THE OPERATOR SEES THE DOCUMENT BEFORE THE SEAL GOES ON IT. A summary
          line saying "18 courses · CGPA 3.41" is not the same as looking at the
          transcript: a year typed into the wrong field, a course under the
          wrong semester, a name with the surname in the first-names box — all
          of those read perfectly well as a summary and are obvious on the
          sheet. And this is the same component the emailed copy is rendered
          from, so it is the document, not an impression of it. */}
      {filled.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] text-[#8a8194]">
            The sheet as it will be sealed. Nothing is on the register until you press
            Transcribe and seal.
          </p>
          <div className="overflow-auto rounded-xl bg-[#f2eee6] p-4 dark:bg-[#2a2333]">
            <TranscriptPreview
                scale={0.62}
                design={template.design}
                // A SPECIMEN UNTIL IT IS ON THE REGISTER. Once it is sealed the
                // overprint comes off, because what is on screen then IS the
                // document — with its credential number, its seal code and the
                // QR a reader will scan.
                specimen={!issued}
                data={{
                  ...preview.data,
                  studentNumber: studentNumber.trim() || null,
                  dateOfBirth: dateOfBirth.trim() || null,
                  placeOfBirth: placeOfBirth.trim() || null,
                  sex: sex.trim() || null,
                  studentAddress: studentAddress.trim() || null,
                  modeOfStudy: modeOfStudy || null,
                  campus: campus.trim() || null,
                  // ONCE IT IS SEALED, THE PREVIEW IS THE DOCUMENT. Before
                  // that it carries the specimen overprint and no credential
                  // number, which is what it is.
                  credentialId: issued?.credentialId ?? null,
                  sealCode: issued?.sealCode ?? null,
                  qrSvg: issued?.qrSvg ?? null,
                  issuedOn: issuedOn || null,
                  creditsEarned: filled.reduce(
                    (t, r) => (pointFor(r.grade) > 0 ? t + (Number(r.creditUnit) || 0) : t),
                    0,
                  ),
                  transcribedFrom: sourceRecord.trim() || null,
                }}
            />
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
                {!surname.trim() || !firstNames.trim() ? 'Give the holder’s surname and first names.'
                  : !programme ? 'Choose the programme, so the level decides how the record is read.'
                  // A ROW WITH A CODE AND NO CREDIT VALUE IS THE CASE THE FILL
                  // CREATES, for a programme whose credits the University has
                  // not published. "Add at least one course" would send the
                  // operator hunting for a course that is already on screen.
                  : filled.length === 0 && rows.some((r) => r.code.trim())
                    ? 'Every course above needs a credit value. The University has not published '
                      + 'them for this programme, so they come from the archive with the grades.'
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
