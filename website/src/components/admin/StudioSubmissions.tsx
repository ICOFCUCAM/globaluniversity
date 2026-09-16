'use client';

// ---------------------------------------------------------------------------
// SUBMISSIONS — the administration's queue, and what it does NOT show.
//
// ---------------------------------------------------------------------------
// THE STEP THIS SCREEN IS
// ---------------------------------------------------------------------------
//
// The University's ruling of 16 September 2026:
//
//     Lecturer submits → Administration reviews/processes → AI transforms →
//     Final academic material → Students
//
// 095 put that stop in the database: nothing runs on a course lecture until an
// office has accepted the submission. This is where an office does it.
//
// ---------------------------------------------------------------------------
// AND IT DELIBERATELY CANNOT SHOW THE LECTURE
// ---------------------------------------------------------------------------
//
// 092 says an office may not read a lecturer's unpublished draft. 095 says an
// office reviews the submission. Both are true because THE REVIEW IS OF THE
// REQUEST, NOT THE WORDS: which course, whose lecture, how long the recording
// is, and therefore what it will cost to transcribe and to voice.
//
// `submissions_for_review` has NO BODY COLUMN — absent, not filtered — so this
// screen could not show the words if somebody added a panel for them. That is
// the point of reading a view rather than the table.
//
// If this screen ever needs to show the content, the answer is not a query
// change here. It is a ruling, and then a policy.
//
// ---------------------------------------------------------------------------
// RETURNING IS NOT REFUSING
// ---------------------------------------------------------------------------
//
// A submission goes back with a note — the file is unusable, the course is
// wrong, the recording is forty seconds long — and the lecturer fixes it and
// submits again. The note is compulsory in the database, and the form says so
// rather than letting somebody press a button that will fail.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { useAuth } from '@/contexts/AuthContext';
import { can, type Capability } from '@/lib/roles';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from '@/lib/portalTheme';
import { AlertTriangle, Check, Clock, Loader2, Undo2 } from 'lucide-react';

interface Submission {
  lecture_id: string;
  course_code: string;
  course_title: string;
  sequence: number;
  title: string;
  abstract: string | null;
  delivered_on: string | null;
  source_minutes: number | null;
  submitted_at: string | null;
  review_state: string;
  review_note: string | null;
  days_waiting: number | null;
  artefacts_so_far: number;
}

/** How long is too long to leave somebody waiting. */
const STALE_AFTER_DAYS = 3;

export default function StudioSubmissions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [returning, setReturning] = useState<string | null>(null);
  const [why, setWhy] = useState('');

  const mayReview = Boolean(user?.role && can(user.role, 'publish-course-material' as Capability));

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('submissions_for_review')
      .select('lecture_id, course_code, course_title, sequence, title, abstract, delivered_on, source_minutes, submitted_at, review_state, review_note, days_waiting, artefacts_so_far')
      .eq('review_state', 'submitted')
      .order('submitted_at');
    setLoading(false);
    if (error) {
      // A MISSING VIEW IS NOT AN EMPTY QUEUE. Reporting "nothing is waiting"
      // when 095 has not been run would tell an office everything is in hand
      // while lecturers wait.
      setNote({
        kind: 'bad',
        text: /does not exist|schema cache/i.test(error.message)
          ? 'Migration 095 has not been run on this database, so there is no submissions queue to '
            + 'read. This is not an empty queue — it is a missing one.'
          : error.message,
      });
      return;
    }
    setRows((data ?? []) as unknown as Submission[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (lectureId: string, to: 'accepted' | 'returned', reason?: string) => {
    setBusy(lectureId); setNote(null);
    const result = await authedPost('/api/studio/submissions', {
      action: to === 'accepted' ? 'accept' : 'return', lectureId, note: reason,
    });
    setBusy(null);
    if (!result.ok) {
      setNote({ kind: 'bad', text: result.error ?? 'It was not recorded.' });
      return;
    }
    setNote({
      kind: 'ok',
      text: to === 'accepted'
        ? 'Accepted. The lecturer can now run the transformations their account is allowed.'
        : 'Sent back, with your note.',
    });
    setReturning(null); setWhy('');
    await load();
  };

  const waiting = useMemo(
    () => rows.filter((r) => (r.days_waiting ?? 0) >= STALE_AFTER_DAYS).length, [rows]);

  if (!mayReview) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={16} className="mr-2 inline" />
          Reviewing submissions belongs to the offices that govern the curriculum.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#57549a]">
          Academic Studio
        </p>
        <h1 className="text-2xl font-semibold text-[#322244]">Submissions</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          A lecturer has submitted a lecture and nothing will run on it until the University
          accepts it. You are deciding whether the work happens — not reading the lecture. The
          words are the lecturer’s and stay theirs until they publish them.
        </p>
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

      {waiting > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <Clock size={16} className="mr-2 inline" />
          {waiting === 1
            ? 'One submission has been waiting more than three days.'
            : `${waiting} submissions have been waiting more than three days.`}
          {' '}Nothing can be transcribed, corrected or voiced until somebody decides.
        </div>
      )}

      {loading && (
        <p className="text-sm text-slate-500">
          <Loader2 size={14} className="mr-2 inline animate-spin" />Reading the queue…
        </p>
      )}

      {!loading && rows.length === 0 && !note && (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Nothing is waiting. When a lecturer submits a lecture it appears here.
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.lecture_id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {row.course_code} · {row.course_title} · Lecture{' '}
                  {String(row.sequence).padStart(2, '0')}
                </p>
                <h2 className="mt-0.5 font-semibold text-[#322244]">{row.title}</h2>
                {row.abstract && (
                  <p className="mt-1 max-w-2xl text-sm text-slate-600">{row.abstract}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {row.source_minutes != null
                    ? `${row.source_minutes} minutes of recording`
                    : 'No recording length recorded'}
                  {row.delivered_on && ` · delivered ${new Date(row.delivered_on).toLocaleDateString()}`}
                  {row.days_waiting != null && ` · waiting ${row.days_waiting} day${row.days_waiting === 1 ? '' : 's'}`}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => void decide(row.lecture_id, 'accepted')}
                  disabled={busy === row.lecture_id}
                  className={BTN_PRIMARY}
                >
                  {busy === row.lecture_id
                    ? <Loader2 size={14} className="animate-spin" />
                    : 'Accept'}
                </button>
                <button
                  onClick={() => { setReturning(row.lecture_id); setWhy(''); }}
                  className={BTN_SECONDARY}
                >
                  <Undo2 size={14} className="mr-1 inline" />Send back
                </button>
              </div>
            </div>

            {returning === row.lecture_id && (
              <div className="mt-3 rounded-lg border border-[#57549a] bg-[#f8f7fc] p-3">
                <label className={LABEL} htmlFor={`why-${row.lecture_id}`}>
                  Why it is going back (at least 10 characters — the database refuses less)
                </label>
                <textarea
                  id={`why-${row.lecture_id}`}
                  className={`${INPUT} mt-1 min-h-[3.5rem]`}
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  placeholder="The recording is forty seconds long — it looks as though the upload was cut short."
                />
                <p className="mt-1 text-xs text-slate-600">
                  The lecturer sees this. A decision nobody explained is one nobody can act on.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => void decide(row.lecture_id, 'returned', why)}
                    disabled={busy === row.lecture_id || why.trim().length < 10}
                    className={BTN_PRIMARY}
                  >
                    Send it back
                  </button>
                  <button onClick={() => setReturning(null)} className={BTN_SECONDARY}>Cancel</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
