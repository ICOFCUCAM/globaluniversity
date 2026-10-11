'use client';

// ---------------------------------------------------------------------------
// WHO IS WATCHING THIS EXAMINATION.
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S DECISION OF 16 SEPTEMBER 2026
// ---------------------------------------------------------------------------
//
//   "`assign-proctor` is kept, not retired, and becomes functional when
//    proctoring is built. `examination_officers` is connected to the
//    examination workflow rather than removed."
//
// ---------------------------------------------------------------------------
// AN APPOINTMENT HERE IS NOT AN ADMINISTRATIVE NOTE
// ---------------------------------------------------------------------------
//
// It is what opens the live room. Before 111, five examination tables had row
// security enabled and no policy — invisible rather than open — so the
// Examiner Console showed an empty hall to every invigilator the University
// has ever had, and said nothing. 111 scopes those reads to this register.
//
// So the screen says so, in as many words, next to the buttons. Somebody
// removing an officer to tidy a list is closing a door.
//
// AND IT DISTINGUISHES WATCHING FROM THE REST. An examination with a chair, an
// examiner and a moderator and no invigilator is an examination nobody is in
// the room for; this panel says that plainly rather than showing three names
// and letting the reader assume.
// ---------------------------------------------------------------------------

import React from 'react';
import { Eye, EyeOff, UserPlus, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { OFFICER_ROLES, officerLabel, officerWatches } from '@/lib/examOfficers';

interface Officer {
  id: string;
  person_id: string;
  role: string;
  assigned_at: string | null;
}

interface Person { id: string; full_name: string | null; email: string | null; role: string }

/** Who may be appointed. A student or an applicant is refused by 111's trigger
 *  regardless; leaving them out of the list means nobody has to find out by
 *  being refused. */
const APPOINTABLE = new Set([
  'exam-officer', 'examiner', 'invigilator', 'moderator', 'lecturer',
  'academic-office', 'hod', 'dean', 'registrar', 'admin', 'superadmin',
]);

export default function ExamOfficers(
  { examinationId, mayAssign }: { examinationId: string; mayAssign: boolean },
) {
  const [officers, setOfficers] = React.useState<Officer[] | null>(null);
  const [people, setPeople] = React.useState<Person[]>([]);
  const [who, setWho] = React.useState('');
  const [what, setWhat] = React.useState('invigilator');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const load = React.useCallback(async () => {
    const [o, p] = await Promise.all([
      supabase.from('examination_officers')
        .select('id, person_id, role, assigned_at')
        .eq('examination_id', examinationId),
      supabase.from('profiles').select('id, full_name, email, role').order('full_name').limit(1000),
    ]);
    setOfficers((o.data ?? []) as unknown as Officer[]);
    setPeople(((p.data ?? []) as unknown as Person[]).filter((x) => APPOINTABLE.has(x.role)));
  }, [examinationId]);

  React.useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key); setNote(null);
    const out = await authedPost('/api/exam/officers', body);
    setBusy(null);
    setNote({
      tone: out.ok ? 'ok' : 'bad',
      text: String(out.detail ?? out.error ?? 'Nothing happened.'),
    });
    await load();
  }

  const named = new Map(people.map((p) => [p.id, p]));
  const watching = (officers ?? []).filter((o) => officerWatches(o.role));

  return (
    <div className="mt-3 rounded-lg border border-[#ece7de] bg-[#faf8f4] p-3 dark:border-[#2e2637] dark:bg-[#241f2c]">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[#422e59] dark:text-[#c8b6e8]">
        {watching.length > 0
          ? <><Eye size={12} /> Watched by {watching.length}</>
          : <><EyeOff size={12} className="text-[#a3283f]" /> Nobody is in the room</>}
        <span className="font-normal text-[#9c93ad]">
          · {(officers ?? []).length} officer{(officers ?? []).length === 1 ? '' : 's'} in all
        </span>
      </p>

      {officers !== null && watching.length === 0 && (
        <p className="mt-1 text-xs text-[#a3283f]">
          {(officers ?? []).length === 0
            ? 'No officer has been appointed, so no one can open the live console for this paper.'
            : 'The officers appointed to this paper mark or check it afterwards. None of them is '
              + 'in the room while it is being sat.'}
        </p>
      )}

      {note && (
        <p className={`mt-2 text-xs ${note.tone === 'ok' ? 'text-emerald-700' : 'text-[#a3283f]'}`}>
          {note.text}
        </p>
      )}

      {officers !== null && officers.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {officers.map((o) => {
            const p = named.get(o.person_id);
            return (
              <li key={o.id}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                  officerWatches(o.role)
                    ? 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300'
                    : 'bg-[#ece7de] text-[#6b6076] dark:bg-[#2e2637] dark:text-[#9c93ad]'}`}
              >
                <span>{p?.full_name ?? p?.email ?? 'Unnamed'} · {officerLabel(o.role)}</span>
                {mayAssign && (
                  <button type="button" aria-label="Remove this officer"
                    disabled={busy === o.id}
                    onClick={() => void act({ action: 'remove', id: o.id }, o.id)}
                    className="text-[#a3283f]">
                    {busy === o.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {mayAssign && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <select value={who} onChange={(e) => setWho(e.target.value)}
            aria-label="Who to appoint"
            className="rounded-lg border border-[#ded6c8] bg-white p-1 text-xs dark:border-[#3d3349] dark:bg-[#241f2c]">
            <option value="">Appoint…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
            ))}
          </select>
          <select value={what} onChange={(e) => setWhat(e.target.value)}
            aria-label="As what"
            className="rounded-lg border border-[#ded6c8] bg-white p-1 text-xs dark:border-[#3d3349] dark:bg-[#241f2c]">
            {OFFICER_ROLES.map((r) => (
              <option key={r.role} value={r.role}>
                {r.label}{r.watches ? ' — in the room' : ''}
              </option>
            ))}
          </select>
          <button type="button" disabled={!who || busy === 'assign'}
            onClick={() => void act(
              { action: 'assign', examinationId, personId: who, role: what }, 'assign',
            )}
            className="flex items-center gap-1 rounded-lg border border-[#ded6c8] px-2 py-1 text-xs font-semibold text-[#422e59] disabled:opacity-40 dark:border-[#3d3349] dark:text-[#e4dcf0]">
            {busy === 'assign' ? <Loader2 size={11} className="animate-spin" /> : <UserPlus size={11} />}
            Appoint
          </button>
          <span className="text-[11px] text-[#9c93ad]">
            An appointment opens the live room for that person, and for this paper only.
          </span>
        </div>
      )}
    </div>
  );
}
