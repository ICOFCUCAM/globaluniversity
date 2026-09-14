'use client';

// ---------------------------------------------------------------------------
// APPOINTMENTS — the board, and the form that creates one.
//
// ---------------------------------------------------------------------------
// WHAT THIS REPLACES
// ---------------------------------------------------------------------------
//
// Nothing, which is the point. The University had no screen for this because it
// had no record: an appointment lived in a word processor file and the letter
// WAS the record. Ask who reports to whom, or whose probation ends this month,
// and the system could not answer.
//
// ---------------------------------------------------------------------------
// THE FIVE COUNTERS ARE NOT DECORATION
// ---------------------------------------------------------------------------
//
// Each answers a question somebody is actually asking. "Letters to issue" is
// work sitting on a desk. "Expiring soon" is the one that earns its place: a
// fixed-term appointment that lapses because nobody noticed is somebody turning
// up to work at an institution that no longer employs them, and until the
// record existed the question could not be asked at all.
//
// THEY ARE COMPUTED IN THE LIBRARY, not here. A screen working them out inline
// would state the rules a second time, differently, and the two would disagree
// the first time a state was added.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost, authedFile } from '@/lib/authedFetch';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, INPUT, LABEL, FOCUS } from '@/lib/portalTheme';
import {
  Plus, Loader2, Check, X, AlertTriangle, Users, FileText, Send, Eye, Trash2, Wand2,
  MessageCircle,
} from 'lucide-react';
import {
  EMPLOYMENT_TYPES, EMPLOYMENT_LABELS, CURRENCIES, SALARY_PERIODS, PERIOD_LABELS,
  ALLOWANCE_KINDS, allowanceLine,
  DEFAULT_CURRENCY, DEFAULT_PERIOD,
  boardStatus, missingFrom, blocked, remunerationLine, probationEnds,
  SOLE_AUTHORITY_ROLES,
  STATE_LABELS,
  type Appointment, type AppointmentState, type Allowance,
} from '@/lib/appointments';
import { FAMILY_LABELS, type PositionFamily } from '@/lib/positions';
import {
  CONDITION_COLUMNS, renderConditions, countConditions, type ConditionClause,
} from '@/lib/appointmentConditions';
import { UNIVERSITY } from '@/lib/constants';
import { writeDocument } from '@/lib/openDocument';
import AwaitingStaffRecord from './AwaitingStaffRecord';

/**
 * A post from the register, for the picker.
 *
 * THE PICKER IS THE WHOLE REASON THIS SCREEN CHANGED. An appointment was
 * created by typing a job title into a box, and `position_id` was never set on
 * any appointment this application has ever made. Everything downstream of the
 * post — the register of wording the letter uses, the job description it names
 * as its own Attachment 1, the standing of the office — hangs off that column,
 * and all of it was unreachable.
 */
interface Post {
  id: string;
  job_code: string;
  title: string;
  family: string;
  unit_name: string | null;
  reports_to: string | null;
  // ---------------------------------------------------------------------
  // THREE THE REGISTER HOLDS AND THIS FORM WAS NOT ASKING FOR.
  //
  // `positions` has carried `duty_station`, `employment_category` and `grade`
  // since 048, and the select below did not name them — so choosing a post
  // filled the title and the unit and left the officer to type the place of
  // duty and the employment type by hand, out of a register that was sitting
  // right there.
  //
  // They are empty on all forty-three posts today, which is why nobody
  // noticed. Selected now so that the day the University fills one in, it
  // reaches the letter instead of being a column nothing reads.
  // ---------------------------------------------------------------------
  duty_station: string | null;
  employment_category: string | null;
  grade: string | null;
  indicative_salary_amount: number | null;
  indicative_salary_currency: string | null;
  indicative_salary_period: string | null;
}

// eslint-disable-next-line max-len
const POSTS = 'id, job_code, title, family, unit_name, reports_to, duty_station, employment_category, grade, indicative_salary_amount, indicative_salary_currency, indicative_salary_period';

// A SINGLE STRING LITERAL. Concatenation makes supabase-js collapse the
// inferred type to GenericStringError[], silently.
// eslint-disable-next-line max-len
const COLUMNS = 'id, full_name, email, phone, postal_address, position_title, position_id, unit_name, faculty, employment_type, start_date, end_date, effective_date, probation_months, place_of_duty, reports_to_name, working_hours, appointing_authority, authority_decided_on, terms, status, drafted_by, authorized_by, issued_at';

type Row = Appointment & {
  id: string;
  issued_at?: string | null;
  email?: string | null;
  phone?: string | null;
  faculty?: string | null;
  position_id?: string | null;
};

// ---------------------------------------------------------------------------
// A LABELLED FIELD — AND WHY IT LIVES OUT HERE.
//
// THIS WAS DEFINED INSIDE THE FORM COMPONENT, AND IT MADE THE FORM UNUSABLE.
// The University: "immediately I type a letter the cursor goes off and the
// window cannot input character."
//
// A component declared inside another is a NEW FUNCTION on every render. React
// compares element types by identity, so on each keystroke it saw a different
// component, threw the whole subtree away — the <input> with it — and built a
// fresh one. The character was kept; the focused element it was typed into no
// longer existed. One letter per click, on every field of the form.
//
// Nothing about the markup was wrong, which is why reading it found nothing.
// The fault was entirely in WHERE the declaration sat.
//
// `src/lib/noNestedComponents.test.mjs` now fails the build on any component
// declared inside another, because this is invisible on inspection and
// obvious the moment somebody types.
// ---------------------------------------------------------------------------

function Field({ id, label, children }: {
  id: string; label: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

export default function Appointments() {
  const { user } = useAuth();
  const mayDraft = can(user?.role, 'draft-appointment');
  const mayApprove = can(user?.role, 'authorize-appointment');
  // WHAT SOMEBODY IS PAID IS NOT ORDINARY INSTITUTIONAL INFORMATION. The
  // screen reads the pay-free view unless the caller holds the authority that
  // sets pay, so a salary is not delivered to a browser that has no business
  // showing it.
  const maySeePay = can(user?.role, 'set-remuneration');
  const mayIssue = can(user?.role, 'issue-appointment-letter');
  // THE OFFICES THAT MAY APPROVE WHAT THEY WROTE. The list lives in the
  // library beside the rule the route applies, so the screen cannot offer the
  // button to somebody the route will refuse.
  const maySoleAuthority = (SOLE_AUTHORITY_ROLES as readonly string[])
    .includes(String(user?.role));
  // THE THIRD BAND OF 056, named here so an empty table can say which of the
  // two empty tables it is. Kept beside the policy it mirrors: these are the
  // roles `appointments_read` lets past without a row-level reason.
  const seesWholeRegister = ['superadmin', 'admin', 'registrar', 'vice-chancellor', 'chancellor']
    .includes(String(user?.role));

  const [rows, setRows] = useState<Row[] | null>(null);
  /**
   * The PDF most recently opened, kept so it can be saved under its own name.
   *
   * NOT REVOKED ON EVERY CHANGE. A blob URL the tab is still showing must stay
   * alive; revoking it would blank the viewer the officer is reading.
   */
  const [lastPdf, setLastPdf] = useState<{ url: string; filename: string } | null>(null);
  /** Why the Superadministrator is reopening an appointee's download window. */
  const [releaseReason, setReleaseReason] = useState('');
  /**
   * The draft being corrected, or null.
   *
   * THE ROW ITSELF, not an id. The form is filled from it, and holding the row
   * means the form can open with what is actually on the record rather than
   * fetching it again and briefly showing an empty form.
   */
  const [editing, setEditing] = useState<Row | null>(null);
  /** The outcome and reason chosen for closing each appointment, by id. */
  const [closing, setClosing] = useState<Record<string, { outcome: string; reason: string }>>({});
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from(maySeePay ? 'appointments' : 'appointments_without_pay')
      .select(COLUMNS)
      .order('start_date', { ascending: false })
      .limit(300);
    setRows((data ?? []) as unknown as Row[]);
  }, [maySeePay]);

  useEffect(() => { void load(); }, [load]);

  // -------------------------------------------------------------------------
  // THE LETTER ACTIONS.
  //
  // SEPARATE FROM `act` because they call a different route under a different
  // capability. Folding them together would have hidden the fact that nothing
  // was calling the letter route at all — which is exactly what happened.
  // -------------------------------------------------------------------------
  async function letter(action: 'issue' | 'email' | 'whatsapp', id: string) {
    setBusy(true);
    setNotice(null);

    // OPENED BEFORE THE AWAIT, AND ONLY FOR WHATSAPP. A browser blocks
    // `window.open` that is not the direct consequence of a click, and the
    // await in the next line is exactly what breaks that chain — so the tab is
    // claimed here, while the click is still the reason it is happening, and
    // pointed at the address once the route hands one back.
    //
    // A popup blocker that refuses even this is handled below: the address is
    // put in the notice so the officer can open it themselves.
    const tab = action === 'whatsapp' ? window.open('', '_blank') : null;

    const out = await authedPost('/api/appointments/letter', { action, id });
    setBusy(false);

    if (!out.ok) {
      tab?.close();
    }

    if (action === 'whatsapp' && out.ok && typeof out.url === 'string') {
      if (tab) tab.location.href = out.url;
      else window.open(out.url, '_blank', 'noopener');
    }

    if (!out.ok) {
      setNotice({
        tone: 'bad',
        text: (out.detail as string | undefined) ?? String(out.error ?? 'That did not work.'),
      });
      return;
    }
    setNotice({
      tone: 'ok',
      text: (out.detail as string | undefined)
        ?? (action === 'issue'
          ? `Issued as ${String(out.reference ?? '')}. The letter is archived exactly as it was `
            + 'produced, and cannot be edited.'
          : 'Sent.'),
    });
    void load();
  }

  /**
   * Generate the letter and show it, without issuing anything.
   *
   * OPENED IN A NEW WINDOW rather than an iframe: the letter carries its own
   * print stylesheet and the whole point of looking at it is to see the pages
   * the appointee will get. `document.write` into a blank window is the one
   * way to render returned HTML with its own styles intact.
   */
  async function preview(id: string) {
    setBusy(true);
    setNotice(null);
    const out = await authedPost('/api/appointments/letter', { action: 'preview', id });
    setBusy(false);

    if (!out.ok || typeof out.html !== 'string') {
      setNotice({
        tone: 'bad',
        text: (out.detail as string | undefined) ?? String(out.error ?? 'The letter could not be produced.'),
      });
      return;
    }
    const w = window.open('', '_blank');
    if (!w) {
      // SAID, NOT SWALLOWED. A blocked pop-up looks exactly like a button that
      // does nothing.
      setNotice({
        tone: 'bad',
        text: 'The preview could not open — your browser blocked the new window. Allow pop-ups '
          + 'for this site and press it again.',
      });
      return;
    }
    // THE PREVIEW IS PRINTABLE TOO — it is the same A4 document, and an
    // officer reading it before approval often wants it on paper. The bar
    // says nothing about a seal, because a preview has none and its own page
    // says so across the top.
    writeDocument(w, { html: out.html });
  }

  /**
   * Open the letter that was actually issued — sealed, referenced, archived.
   *
   * THE TAB IS CLAIMED BEFORE THE AWAIT, like the WhatsApp handover: a browser
   * blocks `window.open` that is not the direct consequence of a click, and
   * awaiting the route is what breaks that chain.
   *
   * AND IT IS WRITTEN, NOT `document.write`-d INTO A BLANK TAB ONLY. Same as
   * the preview, because the archived HTML carries its own print stylesheet —
   * opening it is how somebody prints it or saves it as a PDF.
   */
  async function archived(id: string) {
    setBusy(true);
    setNotice(null);
    const w = window.open('', '_blank');

    // -------------------------------------------------------------------
    // THE PDF FIRST. The University asked for the letter to "open as pdf
    // from the browser and download as pdf", in A4, and that is what this
    // is: the archived document rendered by Chromium against its own
    // `@page { size: A4 }` stylesheet, handed to the tab as a blob so the
    // browser's PDF viewer opens it with its own print and save buttons.
    //
    // FALLING BACK TO THE HTML IS NOT A FAILURE. A deployment without the
    // Chromium pack, or a cold start that ran out of memory, still has the
    // letter — and the HTML copy prints to the identical A4 document
    // through the browser's own dialogue. Losing the PDF must never mean
    // losing access to the letter.
    // -------------------------------------------------------------------
    const asPdf = await authedFile('/api/appointments/letter', { action: 'pdf', id });
    if (asPdf.ok) {
      setBusy(false);
      const url = URL.createObjectURL(asPdf.blob);
      if (w) w.location.href = url; else window.open(url, '_blank', 'noopener');
      setLastPdf({ url, filename: asPdf.filename ?? 'letter.pdf' });
      setNotice({
        tone: 'ok',
        text: 'Opened as a PDF, A4. Use the viewer’s own download button to save it, or '
          + '“Download the PDF” here.',
      });
      return;
    }

    const out = await authedPost('/api/appointments/letter', { action: 'archived', id });
    setBusy(false);

    if (!out.ok || typeof out.html !== 'string') {
      w?.close();
      setNotice({
        tone: 'bad',
        text: (out.detail as string | undefined)
          ?? String(out.error ?? 'The archived letter could not be opened.'),
      });
      return;
    }

    // THE LETTER, WITH A WAY TO PRINT IT OR KEEP A PDF. The document has been
    // typeset for A4 since it was written; nothing had ever offered to print
    // it, so it opened in a bare tab that gave no sign it was finished.
    const opened = writeDocument(w, {
      html: out.html,
      reference: (out.printed as string | undefined) ?? (out.reference as string | undefined),
      sealed: out.sealed as boolean | undefined,
      verifyUrl: `https://${UNIVERSITY.website}/verify`,
    });

    if (!opened) {
      setNotice({
        tone: 'bad',
        text: 'The letter could not open — your browser blocked the new window. Allow pop-ups '
          + 'for this site and press it again.',
      });
      return;
    }

    setNotice({
      tone: 'ok',
      text: `${(out.detail as string | undefined) ?? 'Opened.'} `
        + `A PDF could not be produced on this deployment (${asPdf.error}), so this is the `
        + 'HTML copy — press Print and choose "Save as PDF" for the same A4 document.',
    });
  }

  /**
   * Save the PDF that is already in the browser, under its own name.
   *
   * AN ANCHOR, NOT A SECOND FETCH. The bytes are already here as a blob; the
   * `download` attribute is the only way to control the filename, so a saved
   * letter is called IGUC-HR-APT-2026-0001.pdf rather than a random string.
   */
  function downloadPdf() {
    if (!lastPdf) return;
    const a = document.createElement('a');
    a.href = lastPdf.url;
    a.download = lastPdf.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /**
   * Let the appointee download their letter again, for a further three days.
   *
   * THE SUPERADMINISTRATOR'S ACT AND NOBODY ELSE'S. The route refuses any other
   * role in words; this only draws the button for the one the University named.
   */
  async function release(id: string) {
    setBusy(true);
    setNotice(null);
    const out = await authedPost('/api/appointments/letter', {
      action: 'release', id, reason: releaseReason,
    });
    setBusy(false);
    setNotice({
      tone: out.ok ? 'ok' : 'bad',
      text: (out.detail as string | undefined)
        ?? String(out.error ?? 'That did not work.'),
    });
    if (out.ok) setReleaseReason('');
  }

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sess.session?.access_token ?? ''}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);

    if (!json?.ok) {
      setNotice({
        tone: 'bad',
        text: json?.detail
          ?? json?.missing?.map((m: { message: string }) => m.message).join(' ')
          ?? json?.error ?? 'Nothing was recorded.',
      });
      return null;
    }
    setNotice({ tone: 'ok', text: json.detail ?? 'Saved.' });
    setReason('');
    await load();
    return json;
  }


  if (creating || editing) {
    return (
      <NewAppointment
        // THE SAME FORM, FILLED. A second form for editing would be a second
        // place for every rule about what an appointment needs, and the two
        // would disagree the first time one was touched.
        existing={editing}
        maySetPay={maySeePay}
        maySoleAuthority={maySoleAuthority}
        busy={busy}
        notice={notice}
        onCancel={() => { setCreating(false); setEditing(null); }}
        onSave={async (payload, alsoApprove) => {
          const r = editing
            ? await act({ action: 'edit', id: editing.id, ...payload })
            : await act({ action: 'draft', ...payload });
          if (!r) return;
          // ---------------------------------------------------------------
          // TWO CALLS, AND THE ORDER MATTERS IF THE SECOND FAILS.
          //
          // The appointment is WRITTEN first and approved second. If the
          // approval is refused — a rule this screen does not know about, a
          // dropped connection — the record still exists as a draft and the
          // row's own "Approve on my own authority" button is waiting on it.
          // Nothing the officer typed is lost, which is the whole reason the
          // draft is not held back until the approval succeeds.
          // ---------------------------------------------------------------
          const id = (r.id as string | undefined) ?? editing?.id;
          if (alsoApprove && id) {
            await act({ action: 'decide', id, decision: 'approve' });
          }
          setCreating(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {/* NAMED FOR WHAT IS DONE HERE, not for the subject. Both this
              screen and the dashboard were headed "Appointments", so two
              sidebar entries opened two pages with the same title and a reader
              could not tell from the page which one they were on. */}
          <h1 className="font-heading text-2xl font-bold text-[#422e59] dark:text-[#e9e2f2]">
            Draft &amp; submit
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#6b6076] dark:text-[#9c93ad]">
            The University appoints somebody, a second officer approves it, the letter is
            generated from the record, and the staff account follows. In that order.
          </p>
        </div>
        {mayDraft && (
          <button onClick={() => { setCreating(true); setNotice(null); }} className={BTN_PRIMARY}>
            <Plus size={15} /> New appointment
          </button>
        )}
      </header>

      {/* THE LAST STEP OF THE SENTENCE ABOVE. "…and the staff account follows"
          was a description of something nothing did: an appointee accepted, and
          somebody retyped their particulars into a different form. This is the
          list of who is waiting and the button that reads it all from the
          appointment. It renders nothing when nobody is waiting. */}
      <AwaitingStaffRecord />

      {notice && (
        <p className={`rounded-xl px-4 py-3 text-sm ${notice.tone === 'ok'
          ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>{notice.text}</p>
      )}

      {/* ------------------------------------------------------------------
          THE COUNTERS ARE GONE FROM HERE, AND THAT IS THE FIX.

          This screen carried five — "Pending approval", "Letters to issue",
          "Active appointments" — and the Appointments dashboard beside it in
          the same menu group carries nine, counting the SAME rows under
          different names: "Awaiting VC", "Letters Ready", "Active".

          Two screens counting one thing in two vocabularies is how somebody
          comes to quote a number that does not match the one the officer
          beside them is reading. The dashboard answers "where does everything
          stand"; this screen drafts and submits. One place counts.

          The one counter that was genuinely about work ON THIS SCREEN —
          appointments expiring soon — is on the dashboard too, where it can be
          clicked to see which.
          ------------------------------------------------------------------ */}

      {rows === null && <p className="text-sm text-[#6b6076]">Loading…</p>}

      {/* -------------------------------------------------------------------
          AN EMPTY TABLE MEANS TWO DIFFERENT THINGS AND USED TO SAY ONE.

          Since 056 the appointment register is read in three bands: your own,
          the files on your desk, and — for the Registrar, the Vice-Chancellor
          and the Chancellor — the whole register. An HR officer with nothing
          on their desk and an HR officer looking at a register full of other
          people's work both get zero rows back, because a restricted row
          arrives as an absent row, not as an error.

          Telling both of them "no appointments recorded yet" is a lie to one
          of them, and it is the lie that makes a permission problem look like
          an empty database. Whoever reads it goes looking for the wrong fault.
          ------------------------------------------------------------------- */}
      {rows !== null && rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#ded6c8] p-10 text-center
                        dark:border-[#3d3349]">
          <Users size={22} className="mx-auto mb-3 text-[#a49bb0]" />
          {seesWholeRegister ? (
            <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
              No appointments recorded yet. Staff who predate this system are not listed here —
              they have no appointment behind them, which is exactly what this page now requires.
            </p>
          ) : (
            <>
              <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
                Nothing on your desk. This page shows the appointments you drafted, authorised or
                were named in — not the University&rsquo;s whole register.
              </p>
              <p className="mt-2 text-xs text-[#8a8194] dark:text-[#847b95]">
                The full register is kept by the Registrar.
              </p>
            </>
          )}
        </div>
      )}

      <div className="space-y-3">
        {(rows ?? []).map((a) => {
          const missing = missingFrom(a);
          return (
            <article key={a.id}
              className="rounded-2xl border border-[#e8e2f0] bg-white p-5 dark:border-[#332b3d]
                         dark:bg-[#1c1823]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-base font-bold text-[#422e59]
                                dark:text-[#e9e2f2]">{a.full_name}</p>
                  <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    {a.position_title}
                    {a.unit_name ? ` · ${a.unit_name}` : ''}
                    {' · '}
                    {EMPLOYMENT_LABELS[a.employment_type as keyof typeof EMPLOYMENT_LABELS]
                      ?? a.employment_type}
                    {a.start_date ? ` · from ${a.start_date}` : ''}
                    {a.end_date ? ` to ${a.end_date}` : ''}
                  </p>
                  {/* THE QUESTION THE RECORD EXISTS TO ANSWER, and could not
                      be asked at all while the answer was in a .docx. */}
                  {probationEnds(a) && (
                    <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      Probation ends {probationEnds(a)}
                    </p>
                  )}
                  {maySeePay && remunerationLine(a) && (
                    <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      {remunerationLine(a)}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-[#f2eee6] px-3 py-1 text-xs font-medium
                                 text-[#4a4155] dark:bg-[#2a2333] dark:text-[#c8c1d4]">
                  {boardStatus(a)}
                </span>
              </div>

              {missing.length > 0 && (
                // SAID BEFORE ANYBODY APPROVES IT. All of it at once, so
                // nobody is sent back for the second thing after fixing the
                // first.
                <ul className="mt-3 space-y-1 rounded-lg bg-[#faf6ee] p-3 text-xs
                               text-[#6b5a2f] dark:bg-[#241f2c] dark:text-[#c3b48f]">
                  {missing.map((m) => (
                    <li key={m.key}>{m.blocking ? '' : 'Worth noting: '}{m.message}</li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {/* ------------------------------------------------------
                    READ IT BEFORE DECIDING ANYTHING.

                    Preview was offered only on APPROVED appointments, and it
                    called `generate` — which allocates a reference from the
                    University's register and writes a letter row. So the only
                    way to see a letter was to commit a number to it, and the
                    Vice-Chancellor could not read a document before approving
                    it. The University asked for exactly this.

                    `preview` renders the same letter from the same record,
                    persists nothing, and the page says across the top that it
                    is a draft carrying no reference and no seal.
                    ------------------------------------------------------ */}
                {mayDraft && !blocked(missing) && (
                  <button disabled={busy} className={BTN_GHOST}
                    onClick={() => void preview(a.id)}>
                    <Eye size={14} /> Preview the letter
                  </button>
                )}

                {/* ------------------------------------------------------
                    AND THE ONE THAT WAS ACTUALLY ISSUED.

                    The University: "how can i open the final copy of the
                    letter saved and with all seals and complete".

                    There was no way. Preview renders a FRESH DRAFT from the
                    current record — no reference, no seal, DRAFT across the
                    top. The issued letter sat archived with nothing asking
                    for it.

                    THE TWO ARE NOT INTERCHANGEABLE, which is why this is a
                    second button and not a cleverer first one. 044 stores
                    the exact bytes so the University can say years later what
                    the letter actually said; a preview re-rendered from a
                    record edited since would show something the appointee
                    never received, and would look authoritative doing it.
                    ------------------------------------------------------ */}
                {a.issued_at && mayDraft && (
                  <button disabled={busy} className={BTN_SECONDARY}
                    onClick={() => void archived(a.id)}>
                    <FileText size={14} /> Open the issued letter (PDF)
                  </button>
                )}

                {/* SAVE IT UNDER ITS OWN NAME. The viewer's own download
                    button works, but names the file from the blob; this one
                    calls it IGUC-HR-APT-2026-0001.pdf, which is what somebody
                    filing it needs. Only shown once a PDF is actually in the
                    browser, so it never promises something that is not there. */}
                {a.issued_at && mayDraft && lastPdf && (
                  <button disabled={busy} className={BTN_GHOST}
                    onClick={downloadPdf}>
                    <FileText size={14} /> Download the PDF
                  </button>
                )}

                {/* ------------------------------------------------------
                    RELEASING THE APPOINTEE'S COPY AGAIN.

                    Their own link closes three days after they accept.
                    After that, the University's rule is that only the
                    Superadministrator can let a copy out — so this is the
                    only door that reopens it, and 080 records who opened it
                    and why.

                    SHOWN ONLY TO THE SUPERADMINISTRATOR, because the route
                    refuses everybody else and a button that always refuses
                    is a button that teaches people to ignore refusals.
                    ------------------------------------------------------ */}
                {a.issued_at && String(user?.role) === 'superadmin' && (
                  <>
                    <input value={releaseReason}
                      onChange={(e) => setReleaseReason(e.target.value)}
                      placeholder="Who asked for the letter, and what for"
                      className={`${INPUT} w-72 text-xs`} />
                    <button disabled={busy || releaseReason.trim().length < 10}
                      className={BTN_GHOST}
                      onClick={() => void release(a.id)}>
                      <Send size={14} /> Release their copy for 3 more days
                    </button>
                  </>
                )}

                {/* ---------------------------------------------------------
                    CORRECTING A DRAFT.

                    The University: "can an appointment be re edited and sent.
                    or deleted if it was wrong?"

                    `canEdit` has permitted it since the route was written —
                    a draft is editable, and the route has an `edit` action —
                    and NO SCREEN EVER OFFERED IT. An appointment with a
                    mistyped name or the wrong start date could be created and
                    submitted, and never corrected. The only remedy was to
                    leave the wrong one sitting there and make another.

                    ONLY WHILE IT IS A DRAFT, which is the rule and not a
                    limitation of this button: once a second officer has
                    approved it, editing in place would mean they approved one
                    thing and another went out. After issue the answer is an
                    amendment, which supersedes the letter and keeps both.
                    --------------------------------------------------------- */}
                {a.status === 'draft' && mayDraft && (
                  <button disabled={busy} className={BTN_GHOST}
                    onClick={() => setEditing(a)}>
                    <Wand2 size={14} /> Edit this draft
                  </button>
                )}

                {a.status === 'draft' && mayDraft && !blocked(missing) && (
                  <button disabled={busy} className={BTN_SECONDARY}
                    onClick={() => void act({ action: 'submit', id: a.id })}>
                    Send for approval
                  </button>
                )}

                {/* ---------------------------------------------------------
                    THE SECOND BUTTON, BESIDE THE FIRST.

                    The University asked for it by name: "how come the VC
                    cannot complete an appointment from draft to finished
                    without others. I thought this was fixed" — and then "I
                    think it should have a different button beside draft and
                    submit", and "that extra button should be on superadmin
                    too".

                    It WAS fixed, and it was fixed one step short. Approving
                    your own appointment has been permitted since 055, but
                    only once the appointment was SUBMITTED — and the only
                    route to submitted was a button reading "Send for
                    approval". So an office that needs nobody's approval had
                    to press a button saying it was asking for one.

                    This does the whole thing in a single act, and offers it
                    only to the offices that hold the authority: the
                    Vice-Chancellor, the Chancellor, and the two system
                    accounts. Everybody else sees the ordinary button alone.

                    THE CONTROL IS UNCHANGED. 055's constraint still refuses
                    any self-approval that is not permanently marked as one,
                    and the record will show that one office did both.
                    --------------------------------------------------------- */}
                {a.status === 'draft' && mayDraft && !blocked(missing)
                  && maySoleAuthority && a.drafted_by === user?.id && (
                  <div className="space-y-2">
                    <button disabled={busy} className={BTN_PRIMARY}
                      onClick={() => void act({
                        action: 'decide', id: a.id, decision: 'approve',
                        ...(reason.trim() ? { reason: reason.trim() } : {}),
                      })}>
                      <Check size={14} /> Approve on my own authority
                    </button>
                    <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      Yours to do without a second officer. The record will show permanently
                      that one office both drafted and approved it.
                    </p>
                  </div>
                )}

                {a.status === 'submitted' && mayApprove && (
                  a.drafted_by === user?.id ? (
                    // ---------------------------------------------------
                    // THE OFFICE THAT NEEDS NO SECOND SIGNATURE.
                    //
                    // The University's ruling: "a VC needs no one to approve
                    // its letter, even the superadmin." The appointing
                    // authority approving its own decision is not a breach of
                    // the separation — it IS the authority.
                    //
                    // EVERYBODY ELSE STILL SEES THE REFUSAL, said rather than
                    // hidden, because a button that is simply absent leaves
                    // somebody wondering why.
                    // ---------------------------------------------------
                    maySoleAuthority ? (
                      <div className="space-y-2">
                        <button disabled={busy} className={BTN_PRIMARY}
                          onClick={() => void act({
                            action: 'decide', id: a.id, decision: 'approve',
                            ...(reason.trim() ? { reason: reason.trim() } : {}),
                          })}>
                          <Check size={14} /> Approve on my own authority
                        </button>
                        <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                          You drafted this. Approving it yourself is yours to do, and the record
                          will show permanently that one office did both.
                        </p>
                      </div>
                    ) : (
                      <p className="flex items-center gap-2 rounded-lg bg-[#faf6ee] px-3 py-2
                                    text-xs text-[#6b5a2f] dark:bg-[#241f2c] dark:text-[#c3b48f]">
                        <AlertTriangle size={13} />
                        You drafted this, so somebody else has to approve it. An appointment letter
                        commits the University to paying somebody.
                      </p>
                    )
                  ) : (
                    <>
                      <button disabled={busy} className={BTN_PRIMARY}
                        onClick={() => void act({ action: 'decide', id: a.id, decision: 'approve' })}>
                        <Check size={14} /> Approve
                      </button>
                      <input value={reason} onChange={(e) => setReason(e.target.value)}
                        placeholder="What needs changing" className={`${INPUT} w-64 text-xs`} />
                      <button disabled={busy || reason.trim().length < 12} className={BTN_SECONDARY}
                        onClick={() => void act({
                          action: 'decide', id: a.id, decision: 'return', reason,
                        })}>
                        <X size={14} /> Return it
                      </button>
                    </>
                  )
                )}

                {/* ------------------------------------------------------
                    THE LETTER, WHICH NOTHING COULD ISSUE.

                    /api/appointments/letter has existed for the whole of this
                    system: it generates the document, seals it, archives the
                    exact bytes, records the issue and emails the appointee.
                    No screen called it. An appointment could be drafted, sent
                    for approval and approved — and then the workflow simply
                    stopped, with no button anywhere, because the row sat at
                    `approved` and nothing offered to do the next thing.

                    An appointment system whose central document cannot be
                    produced is a list of intentions.
                    ------------------------------------------------------ */}
                {a.status === 'approved' && mayIssue && (
                  <button disabled={busy} className={BTN_PRIMARY}
                    onClick={() => void letter('issue', a.id)}>
                    <FileText size={14} /> Issue the letter
                  </button>
                )}

                {/* SENDING IS ITS OWN ACT. 042 archives the letter before it
                    goes anywhere, and a failed send leaves the appointment
                    issued and the letter waiting in the outbox rather than
                    rolling anything back. So this is a separate button, and it
                    can be pressed again. */}
                {a.status === 'issued' && mayIssue && (
                  <button disabled={busy} className={BTN_SECONDARY}
                    onClick={() => void letter('email', a.id)}>
                    <Send size={14} /> {a.issued_at ? 'Send it again' : 'Email it to the appointee'}
                  </button>
                )}

                {/* AND BY WHATSAPP, WHICH IS HOW A LETTER ACTUALLY REACHES
                    SOMEBODY HERE. The University asked for it beside the
                    other ways of sending.

                    IT OPENS WHATSAPP; IT DOES NOT SEND. The message carries
                    the reference and the verification address, not the
                    letter — a forwarded file proves nothing about who issued
                    it, and a reference checked on the University's own site
                    proves everything. The record says the letter was handed
                    over and by whom, and never that it was delivered,
                    because nothing here can see that. */}
                {a.status === 'issued' && mayIssue && (
                  <button disabled={busy} className={BTN_SECONDARY}
                    title="Opens WhatsApp with the message ready. It does not send it for you."
                    onClick={() => void letter('whatsapp', a.id)}>
                    <MessageCircle size={14} /> Send by WhatsApp
                  </button>
                )}

                {['issued', 'accepted', 'active'].includes(String(a.status)) && mayDraft && (
                  <>
                    <input value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="What changed" className={`${INPUT} w-64 text-xs`} />
                    <button disabled={busy || reason.trim().length < 12} className={BTN_SECONDARY}
                      onClick={() => void act({ action: 'amend', id: a.id, reason })}>
                      Request an amendment
                    </button>
                  </>
                )}

                {/* ---------------------------------------------------------
                    CLOSING ONE THAT WAS WRONG — AND WHY THERE IS NO DELETE.

                    The University: "or deleted if it was wrong?"

                    There is no delete anywhere in this system and there should
                    not be. An appointment letter commits the University to
                    paying somebody; one that could vanish means the University
                    can never answer "did we appoint this person and then
                    remove the evidence". `close` is the answer, it has been in
                    the route since it was written, and nothing called it.

                    THREE OUTCOMES, NOT ONE, because they are three different
                    facts and the record keeps them apart: the appointee said
                    no, the University took it back, or it ran its course. A
                    single "cancel" would lose which.

                    AND A REASON IS REQUIRED. An appointment that closes with
                    no explanation is the thing the register exists to prevent.
                    --------------------------------------------------------- */}
                {mayApprove && !['declined', 'withdrawn', 'ended'].includes(String(a.status)) && (
                  <>
                    <select value={closing[a.id]?.outcome ?? ''}
                      onChange={(e) => setClosing((c) => ({
                        ...c,
                        [a.id]: { outcome: e.target.value, reason: c[a.id]?.reason ?? '' },
                      }))}
                      className={`${INPUT} w-56 text-xs`}>
                      <option value="">Close this appointment…</option>
                      <option value="declined">The appointee declined it</option>
                      <option value="withdrawn">The University withdraws it</option>
                      <option value="ended">It has run its course</option>
                    </select>

                    {closing[a.id]?.outcome && (
                      <>
                        <input value={closing[a.id]?.reason ?? ''}
                          onChange={(e) => setClosing((c) => ({
                            ...c,
                            [a.id]: { outcome: c[a.id].outcome, reason: e.target.value },
                          }))}
                          placeholder="Why — this goes on the record"
                          className={`${INPUT} w-64 text-xs`} />
                        <button
                          disabled={busy || (closing[a.id]?.reason ?? '').trim().length < 12}
                          className={BTN_SECONDARY}
                          onClick={() => void act({
                            action: 'close',
                            id: a.id,
                            outcome: closing[a.id].outcome,
                            reason: closing[a.id].reason,
                          })}>
                          <X size={14} /> Close it
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// THE FORM
// ---------------------------------------------------------------------------

function NewAppointment({
  existing, maySetPay, maySoleAuthority, busy, notice, onCancel, onSave,
}: {
  maySetPay: boolean;
  /**
   * Whether this officer may approve what they have just written.
   *
   * The Vice-Chancellor, the Chancellor and the two system accounts. It
   * decides whether the SECOND button below is drawn — see the note there.
   */
  maySoleAuthority: boolean;
  busy: boolean;
  notice: { tone: 'ok' | 'bad'; text: string } | null;
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>, alsoApprove: boolean) => void;
  /**
   * A draft being corrected, or absent when this is a new appointment.
   *
   * ONE FORM FOR BOTH. Everything this form knows about what an appointment
   * needs — which fields block a letter, what the post picker fills, how the
   * conditions arrive — would have to be written a second time in a separate
   * editor, and the two would disagree the first time either was touched.
   */
  existing?: Row | null;
}) {
  // FILLED FROM THE RECORD WHERE THERE IS ONE. `useState`'s initialiser runs
  // once, which is what this needs: the officer's typing must not be reset by
  // a re-render carrying the same `existing` row.
  const [f, setF] = useState(() => {
    const e = existing ?? null;
    const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
    return {
      fullName: str(e?.full_name),
      email: str((e as Record<string, unknown> | null)?.email),
      phone: str((e as Record<string, unknown> | null)?.phone),
      postalAddress: str(e?.postal_address),
      positionId: str((e as Record<string, unknown> | null)?.position_id),
      positionTitle: str(e?.position_title),
      unitName: str(e?.unit_name),
      faculty: str((e as Record<string, unknown> | null)?.faculty),
      employmentType: str(e?.employment_type) || 'permanent',
      startDate: str(e?.start_date),
      endDate: str(e?.end_date),
      effectiveDate: str(e?.effective_date),
      probationMonths: str(e?.probation_months),
      placeOfDuty: str(e?.place_of_duty),
      reportsToName: str(e?.reports_to_name),
      workingHours: str(e?.working_hours),
      terms: str(e?.terms),
      salaryAmount: str(e?.salary_amount),
      salaryCurrency: str(e?.salary_currency) || DEFAULT_CURRENCY,
      salaryPeriod: str(e?.salary_period) || DEFAULT_PERIOD,
      appointingAuthority: str(e?.appointing_authority),
      authorityDecidedOn: str(e?.authority_decided_on),
    };
  });

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [allowances, setAllowances] = useState<Allowance[]>([]);

  /**
   * What happened when the chosen post's conditions were looked up.
   *
   * `count` 0 after loading means 078 has not been run, and the screen says so
   * rather than leaving an empty box that looks like a choice somebody made.
   */
  const [conditions, setConditions] = useState<{
    loading: boolean; count: number; filled: boolean; source: string | null;
  } | null>(null);

  // THE REGISTER OF POSTS, READ ONCE. 048 seeds forty-three of them.
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('positions').select(POSTS)
        .eq('status', 'open').order('family').order('title');
      // `status` may not exist on an older database; fall back to everything
      // rather than showing an empty picker, which reads as "no posts exist".
      if (data && data.length > 0) { setPosts(data as unknown as Post[]); return; }
      const { data: all } = await supabase.from('positions').select(POSTS)
        .order('family').order('title');
      setPosts((all ?? []) as unknown as Post[]);
    })();
  }, []);

  /**
   * The first day of next month, as a date input wants it.
   *
   * AN APPOINTMENT RARELY STARTS TODAY. It starts at the beginning of a month,
   * and the one after this is the earliest that is not already half over.
   */
  const firstOfNextMonth = () => {
    const d = new Date();
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return next.toISOString().slice(0, 10);
  };

  /**
   * Fill the ordinary terms, leaving the person alone.
   *
   * ONLY WHAT IS EMPTY. Pressing this after typing half the form must not
   * discard the half that was typed — a convenience that overwrites work is
   * one nobody presses twice.
   */
  function fillFromSample() {
    const start = firstOfNextMonth();
    setF((prev) => ({
      ...prev,
      workingHours: prev.workingHours || '40 hours per week',
      // THE UNIVERSITY'S OWN PUBLISHED ADDRESS, not an invented campus name.
      placeOfDuty: prev.placeOfDuty || UNIVERSITY.address,
      probationMonths: prev.probationMonths || '6',
      startDate: prev.startDate || start,
      effectiveDate: prev.effectiveDate || start,
      // THE OFFICE THE UNIVERSITY HAS RULED MAKES APPOINTMENTS.
      appointingAuthority: prev.appointingAuthority || 'The Vice-Chancellor',
      authorityDecidedOn: prev.authorityDecidedOn || new Date().toISOString().slice(0, 10),
      reportsToName: prev.reportsToName || 'The Vice-Chancellor',
    }));
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  /**
   * Choosing a post fills what the register already knows.
   *
   * FILLED, NOT LOCKED. The unit and the reporting officer come from the post
   * because that is what the post says, and typing them again is how an
   * appointment comes to disagree with the register it was made against. But a
   * particular appointment can legitimately differ — somebody seconded, or
   * reporting to an acting officer — so each stays editable underneath.
   *
   * THE INDICATIVE SALARY IS OFFERED, NEVER IMPOSED. 048 holds it as what the
   * post is usually worth; the University was explicit that the box may be
   * left empty, so it is copied in only when nothing has been typed yet.
   */
  async function choosePost(id: string) {
    const p = (posts ?? []).find((x) => x.id === id);
    if (!p) {
      setF((prev) => ({ ...prev, positionId: '' }));
      setConditions(null);
      return;
    }

    // -----------------------------------------------------------------
    // ONE SELECTION FILLS THE WHOLE LETTER, NOT A THIRD OF IT.
    //
    // The University asked: "must I write the letter when there could be one
    // in the system? At least what you generated should be the minimum with
    // a click."
    //
    // They were right, and the form had TWO half-answers that did not meet.
    // Choosing a post filled the title, the unit and the reporting officer.
    // A separate button filled the ordinary terms — hours, place of duty,
    // probation, dates, authority. Neither filled the four fields that
    // BLOCK the letter, so after using both an officer still faced "Full
    // name is missing… Position is missing… Start date is missing… Place of
    // duty is missing."
    //
    // So choosing a post now does both, in one act, and the order is the
    // point: THE REGISTER'S OWN FACTS WIN, and the ordinary defaults only
    // fill what the register is silent about. A post that records its duty
    // station uses it; the forty-three that do not fall back to the
    // University's published address.
    //
    // WHAT IS STILL NOT FILLED IS THE PERSON. A button that invented a name,
    // an email and an address would produce a letter addressed to nobody.
    // That is the one thing an officer must type, and it is the one thing
    // they should.
    // -----------------------------------------------------------------
    const start = firstOfNextMonth();
    setF((prev) => ({
      ...prev,
      positionId: p.id,
      // ---- WHAT THE POST ITSELF SAYS -------------------------------
      positionTitle: p.title,
      unitName: prev.unitName || (p.unit_name ?? ''),
      reportsToName: prev.reportsToName || (p.reports_to ?? '') || 'The Vice-Chancellor',
      salaryAmount: prev.salaryAmount || (p.indicative_salary_amount != null
        ? String(p.indicative_salary_amount) : ''),
      salaryCurrency: p.indicative_salary_currency ?? prev.salaryCurrency,
      salaryPeriod: p.indicative_salary_period ?? prev.salaryPeriod,
      // The register's own, where it has them; the ordinary default where it
      // has not. `employment_category` is the post's kind of employment —
      // permanent, fixed-term — and is only used when it is one this form
      // knows, so a value nobody anticipated does not silently set the wrong
      // contract.
      employmentType: prev.employmentType !== 'permanent'
        ? prev.employmentType
        : ((EMPLOYMENT_TYPES as readonly string[]).includes(String(p.employment_category))
          ? String(p.employment_category) : prev.employmentType),
      // ---- AND THE TERMS THAT ARE THE SAME FOR EVERY APPOINTMENT ----
      workingHours: prev.workingHours || '40 hours per week',
      // THE UNIVERSITY'S OWN PUBLISHED ADDRESS, not an invented campus name.
      placeOfDuty: prev.placeOfDuty || p.duty_station || UNIVERSITY.address,
      probationMonths: prev.probationMonths || '6',
      startDate: prev.startDate || start,
      effectiveDate: prev.effectiveDate || start,
      // THE OFFICE THE UNIVERSITY HAS RULED MAKES APPOINTMENTS.
      appointingAuthority: prev.appointingAuthority || 'The Vice-Chancellor',
      authorityDecidedOn: prev.authorityDecidedOn || new Date().toISOString().slice(0, 10),
    }));

    // -------------------------------------------------------------------
    // AND THE CONDITIONS THE POST IS APPOINTED ON.
    //
    // 078 holds them per family of posts, overridable post by post, and
    // resolves the inheritance in `position_default_conditions`. The box
    // below was empty before it and stayed empty, which meant every letter
    // the University issued was silent about duration, probation, notice,
    // confidentiality and intellectual property.
    //
    // FILLED, NEVER FORCED. If the officer has already typed conditions,
    // they are left alone — a convenience that discards work is one nobody
    // presses twice. The box stays editable either way: these are the
    // University's standard conditions, read and amended by a human before
    // anybody is bound by them, not a document appended unread.
    // -------------------------------------------------------------------
    setConditions({ loading: true, count: 0, filled: false, source: null });

    const { data, error } = await supabase.from('position_default_conditions')
      .select(CONDITION_COLUMNS).eq('position_id', p.id);

    if (error || !data || data.length === 0) {
      setConditions({ loading: false, count: 0, filled: false, source: null });
      return;
    }

    const rows = data as unknown as ConditionClause[];
    const text = renderConditions(rows);
    // READ, THEN WRITE. Deciding `filled` inside the updater would read a
    // value React has not committed yet, and the notice would say the box was
    // filled on a run where it was not. Nothing else in this handler touches
    // `terms`, so the rendered value is the current one.
    const filled = !f.terms.trim();
    if (filled) setF((prev) => (prev.terms.trim() ? prev : { ...prev, terms: text }));
    setConditions({
      loading: false,
      count: countConditions(rows),
      filled,
      source: rows.some((r) => r.source === 'position') ? 'position' : 'family',
    });
  }

  const asRecord: Appointment = {
    full_name: f.fullName, position_title: f.positionTitle, unit_name: f.unitName,
    employment_type: f.employmentType, start_date: f.startDate, end_date: f.endDate,
    effective_date: f.effectiveDate, place_of_duty: f.placeOfDuty, terms: f.terms,
    reports_to_name: f.reportsToName, postal_address: f.postalAddress,
    probation_months: f.probationMonths ? Number(f.probationMonths) : null,
    salary_amount: f.salaryAmount ? Number(f.salaryAmount) : null,
    salary_currency: f.salaryAmount ? f.salaryCurrency : null,
    salary_period: f.salaryAmount ? f.salaryPeriod : null,
  };
  const missing = missingFrom(asRecord);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#422e59] dark:text-[#e9e2f2]">
          {existing ? 'Correct this draft' : 'New appointment'}
        </h1>
        <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          Saved as a draft. Somebody other than you approves it, and only then is a letter
          generated — nobody is told anything by this screen.
        </p>

        {/* ----------------------------------------------------------------
            START FROM A WORKING DRAFT.

            The University asked why an appointment cannot be made as quickly
            as the specimens were rendered. The answer was that the specimens
            carried a complete record and this form starts empty — fourteen
            fields, most of them the same for every appointment the University
            makes, typed again each time.

            SO IT FILLS THE TERMS AND NOT THE PERSON. The name, the email and
            the address are the only things on this form that are genuinely
            particular to one appointment, and a button that filled those would
            be a button that produces a letter addressed to nobody. Everything
            else — hours, place of duty, probation, the appointing authority,
            a start date at the beginning of next month — is a sensible default
            the officer then corrects.

            NOTHING HERE IS INVENTED. The place of duty is the University's own
            published address; the appointing authority is the office the
            University has ruled makes appointments. Every value is editable
            and the record is a draft nobody has approved.
            ---------------------------------------------------------------- */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={BTN_GHOST} onClick={fillFromSample}>
            <Wand2 size={14} /> Start from a working draft
          </button>
          <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
            Fills the ordinary terms — hours, place of duty, probation, dates, authority — and
            leaves the person to you. Change anything.
          </span>
        </div>
      </header>

      {notice && (
        <p className={`rounded-xl px-4 py-3 text-sm ${notice.tone === 'ok'
          ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>{notice.text}</p>
      )}

      <section className="space-y-4">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                       dark:text-[#c9b6e6]">Person</h2>
        <Field id="a-name" label="Full name">
          <input id="a-name" value={f.fullName} onChange={set('fullName')} className={INPUT} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="a-email" label="Email">
            <input id="a-email" value={f.email} onChange={set('email')} className={INPUT} />
          </Field>
          <Field id="a-phone" label="Phone">
            <input id="a-phone" value={f.phone} onChange={set('phone')} className={INPUT} />
          </Field>
        </div>
        <Field id="a-addr" label="Postal address">
          <input id="a-addr" value={f.postalAddress} onChange={set('postalAddress')} className={INPUT} />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                       dark:text-[#c9b6e6]">Appointment</h2>
        {/* ----------------------------------------------------------------
            THE POST, FROM THE REGISTER.

            This was a text box, and only a text box, for the whole life of
            this system. Typing "Dean of Studies" made an appointment that was
            attached to no post — so the letter had no family to take its
            wording from, no job description to attach, and no standing to
            print. Everything built on top of the register was unreachable
            because of this one field.

            STILL TYPEABLE UNDERNEATH. A post the register does not have yet is
            a real situation, and refusing it would stop the work. But the
            picker is first, and choosing from it is the normal thing.
            ---------------------------------------------------------------- */}
        <Field id="a-post" label="Post (from the register of positions)">
          <select id="a-post" value={f.positionId}
            onChange={(e) => void choosePost(e.target.value)} className={INPUT}>
            <option value="">
              {posts === null ? 'Reading the register…' : 'Not one of the registered posts'}
            </option>
            {Object.entries(
              (posts ?? []).reduce<Record<string, Post[]>>((acc, p) => {
                (acc[p.family] ??= []).push(p);
                return acc;
              }, {}),
            ).map(([family, list]) => (
              <optgroup key={family}
                label={FAMILY_LABELS[family as PositionFamily] ?? family}>
                {list.map((p) => (
                  <option key={p.id} value={p.id}>{p.title} ({p.job_code})</option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
            {f.positionId
              ? 'Filled in from the register, and the rest with the University’s ordinary terms. '
                + 'The letter will take its wording from this post’s family, attach its job '
                + 'description, and print any standing the University has recorded for it. '
                + 'Only the person is left to you — change anything else that is wrong.'
              : 'Choosing a post fills the whole letter: its title, unit and reporting officer '
                + 'from the register, and the ordinary terms — hours, place of duty, probation, '
                + 'dates, authority — leaving only the person. Without one, the letter falls '
                + 'back to the plainest wording and carries no job description.'}
          </p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="a-pos" label="Position, as it is printed on the letter">
            <input id="a-pos" value={f.positionTitle} onChange={set('positionTitle')} className={INPUT} />
          </Field>
          <Field id="a-unit" label="Department or office">
            <input id="a-unit" value={f.unitName} onChange={set('unitName')} className={INPUT} />
          </Field>
          <Field id="a-fac" label="Faculty or school">
            <input id="a-fac" value={f.faculty} onChange={set('faculty')} className={INPUT}
              placeholder="Left empty for a central post" />
          </Field>
          <Field id="a-type" label="Employment type">
            <select id="a-type" value={f.employmentType} onChange={set('employmentType')} className={INPUT}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>{EMPLOYMENT_LABELS[t]}</option>
              ))}
            </select>
          </Field>
          <Field id="a-hours" label="Working hours">
            <input id="a-hours" value={f.workingHours} onChange={set('workingHours')}
              className={INPUT} placeholder="e.g. 40 hours per week" />
          </Field>
          <Field id="a-start" label="Start date">
            <input id="a-start" type="date" value={f.startDate} onChange={set('startDate')} className={INPUT} />
          </Field>
          <Field id="a-end" label="End date">
            <input id="a-end" type="date" value={f.endDate} onChange={set('endDate')} className={INPUT} />
          </Field>
          <Field id="a-eff" label="Effective date">
            <input id="a-eff" type="date" value={f.effectiveDate} onChange={set('effectiveDate')} className={INPUT} />
          </Field>
          <Field id="a-prob" label="Probation (months)">
            <input id="a-prob" type="number" min="0" max="36" value={f.probationMonths}
              onChange={set('probationMonths')} className={INPUT} />
          </Field>
          <Field id="a-rep" label="Reporting officer">
            <input id="a-rep" value={f.reportsToName} onChange={set('reportsToName')} className={INPUT} />
          </Field>
          <Field id="a-place" label="Place of work">
            <input id="a-place" value={f.placeOfDuty} onChange={set('placeOfDuty')}
              className={INPUT} placeholder="e.g. Buea campus" />
          </Field>
        </div>
        {/* ----------------------------------------------------------------
            THE CONDITIONS, WHICH USED TO BE A BOX NOBODY COULD FILL.

            The University: "just with the letter and empty conditions it
            cannot match the sample you generated earlier. At least what you
            generated should be the minimum with a click."

            It is now the minimum with a click. Choosing a post fills this box
            with the University's standard conditions for that family of posts
            — 078 holds them — and every word stays editable.

            TWENTY-TWO CONDITIONS, NOT FOUR LINES. The box is deep enough to
            read them in, because a contract term nobody scrolls to is a
            contract term nobody has read.
            ---------------------------------------------------------------- */}
        <Field id="a-terms" label="Appointment conditions">
          <textarea id="a-terms" rows={14} value={f.terms} onChange={set('terms')}
            className={`${INPUT} font-mono text-xs leading-relaxed`}
            placeholder="Choose a post above and the University’s standard conditions are filled in here." />
        </Field>

        {conditions && !conditions.loading && (
          conditions.count > 0 ? (
            <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
              {conditions.filled
                ? `Filled in with the University’s ${conditions.count} standard conditions for this post`
                : `This post has ${conditions.count} standard conditions. The box already had `
                  + 'wording in it, so it was left alone'}
              {conditions.source === 'position'
                ? ', including the conditions written for this post in particular. '
                : '. '}
              Every word is editable, and nobody is bound by any of it until the letter is
              approved and issued.
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs
                          text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle size={14} className="mt-px shrink-0" />
              <span>
                This post has no standard conditions in the system, so the box above stays
                empty and whatever is typed into it is the whole contract. If migration 078
                has not been run yet, that is why.
              </span>
            </p>
          )
        )}
      </section>

      {/* WHAT SOMEBODY IS PAID IS A SEPARATE AUTHORITY. Not shown at all to a
          role that does not hold it, and the route ignores the fields even if
          they arrive — an HR assistant who may record an appointment should
          not thereby decide a salary. */}
      {maySetPay && (
        <section className="space-y-4">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                         dark:text-[#c9b6e6]">Remuneration</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="a-sal" label="Amount">
              <input id="a-sal" type="number" min="0" value={f.salaryAmount}
                onChange={set('salaryAmount')} className={INPUT} />
            </Field>
            <Field id="a-cur" label="Currency">
              <select id="a-cur" value={f.salaryCurrency} onChange={set('salaryCurrency')} className={INPUT}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field id="a-per" label="Period">
              <select id="a-per" value={f.salaryPeriod} onChange={set('salaryPeriod')} className={INPUT}>
                {SALARY_PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
            Leave the amount blank for an unpaid post. A figure without a currency and a period
            is not something anybody can rely on, so all three go together or none do.
          </p>

          {/* ------------------------------------------------------------
              ALLOWANCES, WHICH NOTHING COULD CREATE.

              047 gave them a table of their own, with each allowance keeping
              its own currency and period so that a monthly salary and an
              annual research allowance are never added into one number. The
              letter reads them and prints a line for each.

              Nothing wrote them. Not this screen, not any route — so every
              letter the University could produce showed a basic salary and
              nothing else, and a housing allowance agreed in a meeting had no
              way into the record at all.
              ------------------------------------------------------------ */}
          <div className="rounded-xl border border-[#e8e2f0] p-4 dark:border-[#332b3d]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#422e59] dark:text-[#e4dcf0]">
                Allowances
              </h3>
              <button type="button" className={BTN_GHOST}
                onClick={() => setAllowances([...allowances, {
                  kind: ALLOWANCE_KINDS[0],
                  amount: 0,
                  currency: f.salaryCurrency,
                  period: f.salaryPeriod,
                } as Allowance])}>
                <Plus size={13} /> Add one
              </button>
            </div>

            {allowances.length === 0 ? (
              <p className="mt-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                None. An appointment with no allowances says nothing about them on the letter —
                it does not print “Allowances: none”, which would be a statement about the terms
                rather than the absence of one.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {allowances.map((al, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <li key={i} className="grid gap-2 sm:grid-cols-[1fr_90px_90px_110px_auto]">
                    <select value={al.kind ?? ALLOWANCE_KINDS[0]} className={INPUT}
                      aria-label="Kind of allowance"
                      onChange={(e) => setAllowances(allowances.map((x, j) =>
                        (j === i ? { ...x, kind: e.target.value } as Allowance : x)))}>
                      {ALLOWANCE_KINDS.map((k) => (
                        <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                      ))}
                    </select>
                    <input type="number" min="0" value={al.amount ?? ''} className={INPUT}
                      aria-label="Amount"
                      onChange={(e) => setAllowances(allowances.map((x, j) =>
                        (j === i ? { ...x, amount: Number(e.target.value) } : x)))} />
                    <select value={al.currency ?? DEFAULT_CURRENCY} className={INPUT}
                      aria-label="Currency"
                      onChange={(e) => setAllowances(allowances.map((x, j) =>
                        (j === i ? { ...x, currency: e.target.value } : x)))}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={al.period ?? DEFAULT_PERIOD} className={INPUT}
                      aria-label="Period"
                      onChange={(e) => setAllowances(allowances.map((x, j) =>
                        (j === i ? { ...x, period: e.target.value } : x)))}>
                      {SALARY_PERIODS.map((p) => (
                        <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
                      ))}
                    </select>
                    <button type="button" className={BTN_GHOST} aria-label="Remove this allowance"
                      onClick={() => setAllowances(allowances.filter((_, j) => j !== i))}>
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* WHAT THE LETTER WILL SAY, in the letter's own words. Built by
                the same function the document uses, so the preview here and
                the printed line cannot drift apart. */}
            {allowances.filter((a) => Number(a.amount ?? 0) > 0).length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                {allowances.filter((a) => Number(a.amount ?? 0) > 0).map((a, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <li key={i}>{allowanceLine(a)}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                       dark:text-[#c9b6e6]">Authority</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="a-auth" label="Appointing authority">
            <input id="a-auth" value={f.appointingAuthority} onChange={set('appointingAuthority')}
              className={INPUT} placeholder="e.g. The University Council" />
          </Field>
          <Field id="a-authdate" label="Date that body decided">
            <input id="a-authdate" type="date" value={f.authorityDecidedOn}
              onChange={set('authorityDecidedOn')} className={INPUT} />
          </Field>
        </div>
        {/* THE DISTINCTION THAT IS EASY TO LOSE. Whoever approves this in the
            portal is recorded automatically and is a different fact from the
            body the letter names. */}
        <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
          This is the body the letter names. Who approves it in this system, and the reference
          number, are recorded by the system itself — an administrator&rsquo;s name does not
          belong where a governing body does.
        </p>
      </section>

      {missing.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-[#faf6ee] p-4 text-xs text-[#6b5a2f]
                       dark:bg-[#241f2c] dark:text-[#c3b48f]">
          {missing.map((m) => (
            <li key={m.key}>{m.blocking ? '' : 'Worth noting: '}{m.message}</li>
          ))}
        </ul>
      )}

      {/* ------------------------------------------------------------------
          TWO WAYS TO FINISH, AND THE UNIVERSITY ASKED FOR THE SECOND BY NAME.

          "How come the VC cannot complete an appointment from draft to
          finished without others" — then "it should have a different button
          beside draft and submit", and "that extra button should be on
          superadmin too".

          The first button saves a draft, which then waits for a second
          officer. That is right for HR and wrong for the appointing
          authority: the Vice-Chancellor approving their own appointment is
          not a breach of the separation, it IS the authority.

          So the second button does the whole thing in one press — writes the
          record and approves it — and it appears only for the offices that
          hold that authority. Everybody else sees one button, as before.

          THE CONTROL IS UNCHANGED. 055's constraint still refuses any
          self-approval that is not permanently marked as one, and the record
          will show that a single office did both.
          ------------------------------------------------------------------ */}
      <div className="flex flex-wrap gap-3">
        <button disabled={busy || blocked(missing)} className={BTN_PRIMARY}
          onClick={() => onSave({
            ...f,
            // ONLY THE ONES WITH A FIGURE. An empty row somebody added and
            // then thought better of is not an allowance of zero.
            allowances: allowances.filter((a) => Number(a.amount ?? 0) > 0),
          }, false)}>
          {busy
            ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
            : (existing ? 'Save the correction' : 'Save as draft')}
        </button>

        {maySoleAuthority && (
          <button disabled={busy || blocked(missing)} className={BTN_PRIMARY}
            onClick={() => onSave({
              ...f,
              allowances: allowances.filter((a) => Number(a.amount ?? 0) > 0),
            }, true)}>
            {busy
              ? <><Loader2 size={15} className="animate-spin" /> Recording…</>
              : <><Check size={15} /> Save and approve on my own authority</>}
          </button>
        )}

        <button onClick={onCancel} className={BTN_SECONDARY}>Cancel</button>
      </div>

      {maySoleAuthority && (
        <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
          <strong>Save as draft</strong> leaves this waiting for a second officer to approve.
          <strong> Save and approve</strong> finishes it now — yours to do without anybody else,
          and the record will show permanently that one office both wrote and approved it.
        </p>
      )}
    </div>
  );
}

/** Re-exported so a navigation label and a status chip cannot drift apart. */
export { STATE_LABELS };
export type { AppointmentState };
