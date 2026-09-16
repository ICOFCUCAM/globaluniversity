'use client';

// ---------------------------------------------------------------------------
// NATIONAL STAFF — one screen, two chairs.
//
// ---------------------------------------------------------------------------
// WHY THE RECTOR AND HR SHARE A SCREEN
// ---------------------------------------------------------------------------
//
// They are looking at the same list. A Rector sees the people they have put
// forward and where each has got to; HR sees the same rows as a queue to work
// through. Building two screens over one table would mean two places to change
// when the list changes, and the second one is always the one that drifts.
//
// What differs is the ACTIONS, and those are decided by capability rather than
// by which screen somebody opened: `recommend-national-staff` draws the form,
// `draft-appointment` draws Accept and Decline. Somebody who holds both — the
// Superadministrator — sees both, and 099 still refuses them to decide their
// own recommendation, because that rule lives in the database.
//
// ---------------------------------------------------------------------------
// AND WHY ACCEPTING DOES NOT CREATE AN APPOINTMENT
// ---------------------------------------------------------------------------
//
// Accepting means "the University will draft this". The appointment itself is
// drafted on the Appointments board, approved by the Vice-Chancellor and issued
// as a letter — 041's chain, untouched. If this screen created the appointment,
// the Rector's recommendation would have become the draft, and the separation
// 041 exists for would have been spent on the wrong pair of people.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { useAuth } from '@/contexts/AuthContext';
import { can, type Capability } from '@/lib/roles';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from '@/lib/portalTheme';
import {
  AlertTriangle, Check, Clock, Loader2, ThumbsUp, UserPlus, Undo2,
} from 'lucide-react';

interface Recommendation {
  id: string;
  administration_id: string;
  full_name: string;
  email: string | null;
  proposed_position: string;
  rationale: string;
  qualifications: string | null;
  status: string;
  recommended_at: string;
  decision_note: string | null;
}

type Note = { kind: 'ok' | 'bad'; text: string } | null;

const STATUS_SKIN: Record<string, string> = {
  submitted: 'border-amber-300 bg-amber-50 text-amber-800',
  accepted: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  declined: 'border-rose-300 bg-rose-50 text-rose-800',
  appointed: 'border-[#57549a] bg-[#f3f1fa] text-[#322244]',
};

export default function NationalStaff() {
  const { user } = useAuth();
  const mayRecommend = can(user?.role, 'recommend-national-staff' as Capability);
  const mayDecide = can(user?.role, 'draft-appointment' as Capability);

  const [rows, setRows] = useState<Recommendation[] | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [declining, setDeclining] = useState<string | null>(null);
  const [why, setWhy] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [rationale, setRationale] = useState('');
  const [qualifications, setQualifications] = useState('');

  const load = useCallback(async () => {
    // NO NATION FILTER HERE. 099's policies return the Rector their own
    // administration's rows and HR every administration's, which is exactly
    // what each of them needs. A filter on this page would be a second, weaker
    // copy of a decision the database has already made.
    const { data, error } = await supabase
      .from('national_staff_recommendations')
      .select('id, administration_id, full_name, email, proposed_position, rationale, '
        + 'qualifications, status, recommended_at, decision_note')
      .order('recommended_at', { ascending: false });

    if (error) {
      setNote({
        kind: 'bad',
        text: /does not exist|schema cache/i.test(error.message)
          ? 'Migration 099 has not been run on this database, so there is nowhere to record a '
            + 'recommendation. This is not an empty list — it is a missing table.'
          : error.message,
      });
      setRows([]);
      return;
    }
    setRows((data ?? []) as unknown as Recommendation[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (payload: Record<string, unknown>, said: string) => {
    setBusy(String(payload.id ?? 'new')); setNote(null);
    const result = await authedPost('/api/national/staff', payload);
    setBusy(null);
    if (!result.ok) {
      setNote({ kind: 'bad', text: result.detail ?? result.error ?? 'It was not recorded.' });
      return;
    }
    setNote({ kind: 'ok', text: said });
    setWriting(false); setDeclining(null); setWhy('');
    setFullName(''); setEmail(''); setPosition(''); setRationale(''); setQualifications('');
    await load();
  };

  if (!mayRecommend && !mayDecide) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={16} className="mr-2 inline" />
          Recommending national staff belongs to a National Rector, and deciding a
          recommendation to the offices that draft the University’s appointments.
        </div>
      </div>
    );
  }

  const waiting = (rows ?? []).filter((r) => r.status === 'submitted').length;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#57549a]">
            The National Rector recommends. The University appoints.
          </p>
          <h1 className="text-2xl font-semibold text-[#322244]">National staff</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            A recommendation is not an appointment. It creates no post and binds the University
            to nothing — it asks an office to draft one, which is then approved by the
            Vice-Chancellor and issued as a letter, exactly as every other appointment is.
          </p>
        </div>
        {mayRecommend && (
          <button type="button" className={BTN_PRIMARY}
            onClick={() => { setWriting(true); setNote(null); }}>
            <UserPlus size={14} className="mr-1.5 inline" />Recommend somebody
          </button>
        )}
      </header>

      {note && (
        <div className={`rounded-lg border p-3 text-sm ${note.kind === 'ok'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
          : 'border-rose-300 bg-rose-50 text-rose-900'}`}>
          {note.kind === 'ok' ? <Check size={16} className="mr-2 inline" />
            : <AlertTriangle size={16} className="mr-2 inline" />}
          {note.text}
        </div>
      )}

      {mayDecide && waiting > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <Clock size={16} className="mr-2 inline" />
          {waiting === 1 ? 'One recommendation is waiting for the University.'
            : `${waiting} recommendations are waiting for the University.`}
        </div>
      )}

      {writing && (
        <div className="rounded-lg border border-[#57549a] bg-[#f8f7fc] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="ns-name">Their name</label>
              <input id="ns-name" className={`${INPUT} mt-1`} value={fullName}
                onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="ns-email">Their email (optional)</label>
              <input id="ns-email" type="email" className={`${INPUT} mt-1`} value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="ns-post">The post you are recommending them for</label>
              <input id="ns-post" className={`${INPUT} mt-1`} value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Lecturer in Theology" />
            </div>
            <div>
              <label className={LABEL} htmlFor="ns-quals">Their qualifications (optional)</label>
              <input id="ns-quals" className={`${INPUT} mt-1`} value={qualifications}
                onChange={(e) => setQualifications(e.target.value)} />
            </div>
          </div>
          <label className={`${LABEL} mt-3 block`} htmlFor="ns-why">
            Why them (at least 20 characters — the office that verifies this reads it)
          </label>
          <textarea id="ns-why" className={`${INPUT} mt-1 min-h-[4rem]`} value={rationale}
            onChange={(e) => setRationale(e.target.value)} />
          <p className="mt-1 text-xs text-slate-600">
            Which administration this belongs to is taken from the register, not from this form.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={BTN_PRIMARY}
              disabled={busy === 'new' || fullName.trim().length < 3
                || position.trim().length < 3 || rationale.trim().length < 20}
              onClick={() => void act(
                { action: 'recommend', fullName, email, proposedPosition: position,
                  rationale, qualifications },
                `${fullName.trim()} has been recommended to the University.`)}>
              {busy === 'new' ? <Loader2 size={14} className="mr-1.5 inline animate-spin" /> : null}
              Recommend them
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setWriting(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {rows === null && (
        <p className="text-sm text-slate-500">
          <Loader2 size={14} className="mr-2 inline animate-spin" />Reading the recommendations…
        </p>
      )}

      {rows !== null && rows.length === 0 && !note && (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Nothing has been recommended yet.
        </div>
      )}

      <ul className="space-y-3">
        {(rows ?? []).map((row) => (
          <li key={row.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 max-w-2xl">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-[#322244]">{row.full_name}</h2>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                    STATUS_SKIN[row.status] ?? STATUS_SKIN.submitted}`}>
                    {row.status}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{row.proposed_position}</p>
                {row.qualifications && (
                  <p className="mt-0.5 text-xs text-slate-500">{row.qualifications}</p>
                )}
                <p className="mt-2 text-sm text-slate-600">{row.rationale}</p>
                {row.decision_note && (
                  <p className="mt-2 rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-900">
                    {row.decision_note}
                  </p>
                )}
              </div>

              {mayDecide && row.status === 'submitted' && (
                <div className="flex shrink-0 gap-2">
                  <button type="button" className={BTN_PRIMARY} disabled={busy === row.id}
                    onClick={() => void act({ action: 'accept', id: row.id },
                      `Accepted. Draft ${row.full_name}’s appointment on the Appointments board.`)}>
                    {busy === row.id ? <Loader2 size={14} className="animate-spin" />
                      : <><ThumbsUp size={14} className="mr-1 inline" />Accept</>}
                  </button>
                  <button type="button" className={BTN_SECONDARY}
                    onClick={() => { setDeclining(row.id); setWhy(''); }}>
                    <Undo2 size={14} className="mr-1 inline" />Decline
                  </button>
                </div>
              )}
            </div>

            {row.status === 'accepted' && (
              <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-600">
                The University has undertaken to appoint. The appointment itself is drafted on
                the Appointments board, approved by the Vice-Chancellor and issued as a letter —
                accepting a recommendation does not create one.
              </p>
            )}

            {declining === row.id && (
              <div className="mt-3 rounded-lg border border-[#57549a] bg-[#f8f7fc] p-3">
                <label className={LABEL} htmlFor={`d-${row.id}`}>
                  Why it is not proceeding (at least 10 characters — the database refuses less)
                </label>
                <textarea id={`d-${row.id}`} className={`${INPUT} mt-1 min-h-[3.5rem]`}
                  value={why} onChange={(e) => setWhy(e.target.value)} />
                <p className="mt-1 text-xs text-slate-600">
                  The Rector reads this, and needs to know whether to put somebody else forward.
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" className={BTN_PRIMARY}
                    disabled={busy === row.id || why.trim().length < 10}
                    onClick={() => void act({ action: 'decline', id: row.id, note: why },
                      'Declined, with your reason.')}>
                    Decline it
                  </button>
                  <button type="button" className={BTN_SECONDARY}
                    onClick={() => setDeclining(null)}>Cancel</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
