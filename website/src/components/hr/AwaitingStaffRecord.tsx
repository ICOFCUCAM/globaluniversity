'use client';

// ---------------------------------------------------------------------------
// APPOINTMENT → STAFF RECORD → STAFF ACCOUNT.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The University asked: "What about staff accounts, like lecturers and
// professors?"
//
// There were two halves and nothing between them. An appointment was drafted,
// approved, issued and accepted — and then the acceptance page said "Human
// Resources will open your staff record", and somebody opened a different form
// and RETYPED the name, the email, the title and the department. A name typed
// twice is a name that can differ, which is the fault the appointment letter
// exists to prevent, arriving by another road.
//
// ---------------------------------------------------------------------------
// AND THEN THE UNIVERSITY READ THE SCREEN
// ---------------------------------------------------------------------------
//
//   "The appointment has been accepted, but the corresponding staff record has
//    not yet been created. The system is currently showing the appointment in
//    'Awaiting a staff record' and offering 'Open the staff record', even
//    though there is apparently no staff record to open."
//
// THE BUTTON DID CREATE ONE. 082 and the acceptance page use "open a staff
// record" the way a bank opens an account — and that is not what the words say
// to somebody who has not read the migration. The screen offered the phrase on
// rows where no record existed, so the reading was the reasonable one and the
// label was the fault.
//
// It now says what it does, and it says it conditionally:
//
//   no staff record   →  Create staff record
//   staff record, no account  →  Create staff account
//
// ---------------------------------------------------------------------------
// TWO STAGES, BECAUSE THEY ARE TWO DECISIONS
// ---------------------------------------------------------------------------
//
//   "Appointment → Accepted → Create Staff Record → Staff Record → Staff
//    Account. This preserves the distinction between someone who has merely
//    been considered/appointed and someone who has actually entered the
//    university's staff register."
//
// Under the old single act, one click issued a staff number, wrote the register
// row, created a login and opened a teaching record. The state between — on the
// register, cannot yet sign in — could not be expressed at all, and it is
// exactly the state six of the University's appointees were in.
//
// ---------------------------------------------------------------------------
// THE EMAIL, WHICH IS WHAT THE UNIVERSITY ACTUALLY ASKED ABOUT
// ---------------------------------------------------------------------------
//
//   "How do we request their additional information like email from here?
//    this is because email is necessary."
//
// The list used to say "No email recorded — correct the appointment first" and
// offer no way to correct anything: an instruction with no instrument, on a
// disabled button. The form below is the instrument. It arrives pre-filled from
// the appointment and the officer completes what the appointment never
// captured.
//
// IT IS WRITTEN TO THE STAFF RECORD, NOT BACK ONTO THE APPOINTMENT. The
// appointment is a document that was issued, accepted and signed; editing it
// afterwards would make the record disagree with the paper somebody holds. The
// University's ruling says which is live: "the appointment remains part of the
// person's appointment history, while the staff record becomes their ongoing
// institutional staff identity."
//
// THE PASSWORD IS SHOWN ONCE AND ONLY WHERE THE EMAIL FAILED. It is generated
// at the moment the account opens, sent to the appointee, and stored nowhere.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import {
  Card, CardHeader, TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from '@/lib/portalTheme';
import {
  IdCard, CheckCircle2, AlertTriangle, Loader2, UserPlus, KeyRound, X,
} from 'lucide-react';

interface Waiting {
  appointment_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  position_title: string | null;
  unit_name: string | null;
  faculty: string | null;
  employment_type: string | null;
  start_date: string | null;
  family: string | null;
}

interface Registered {
  staff_record_id: string;
  staff_number: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  position_title: string | null;
  faculty: string | null;
  employment_type: string | null;
  started_on: string | null;
  ready: boolean | null;
}

// One literal each — supabase-js reads the row type from it.
// eslint-disable-next-line max-len
const COLUMNS = 'appointment_id, full_name, email, phone, position_title, unit_name, faculty, employment_type, start_date, family';
// eslint-disable-next-line max-len
const REGISTERED = 'staff_record_id, staff_number, full_name, email, phone, position_title, faculty, employment_type, started_on, ready';

const missingRelation = (e: { message?: string; code?: string } | null) => Boolean(e) && (
  /does not exist|could not find/i.test(e?.message ?? '')
  || ['42P01', 'PGRST205'].includes(e?.code ?? '')
);

export default function AwaitingStaffRecord() {
  const [rows, setRows] = useState<Waiting[] | null>(null);
  const [registered, setRegistered] = useState<Registered[]>([]);
  // WHETHER THE VIEWS ARE THERE AT ALL. 082 creates the first and 104 the
  // second, and until they are run this panel must say so rather than
  // rendering an empty list that reads as "nobody is waiting".
  const [landed, setLanded] = useState(true);
  const [secondStageLanded, setSecondStageLanded] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [handOver, setHandOver] =
    useState<{ who: string; username: string; password: string } | null>(null);

  // THE FORM, OPEN ON ONE APPOINTEE AT A TIME. Pre-filled from the appointment
  // when it opens; what the officer changes is what the appointment lacked.
  const [drafting, setDrafting] = useState<Waiting | null>(null);
  const [form, setForm] = useState({ email: '', phone: '' });

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('appointments_awaiting_staff_record')
      .select(COLUMNS)
      .order('start_date', { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) {
      // A MISSING VIEW IS NOT AN EMPTY LIST. See stateFromError in
      // migrationProbes: 42P01 and PostgREST's schema-cache misses mean the
      // migration has not been run, and anything else is a real failure.
      setLanded(!missingRelation(error));
      setRows([]);
    } else {
      setLanded(true);
      setRows((data ?? []) as Waiting[]);
    }

    const { data: reg, error: regError } = await supabase
      .from('staff_records_awaiting_an_account')
      .select(REGISTERED)
      .order('created_at', { ascending: true })
      .limit(200);
    if (regError) {
      setSecondStageLanded(!missingRelation(regError));
      setRegistered([]);
      return;
    }
    setSecondStageLanded(true);
    setRegistered((reg ?? []) as Registered[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function startDrafting(row: Waiting) {
    setNote(null);
    setHandOver(null);
    setDrafting(row);
    setForm({ email: row.email ?? '', phone: row.phone ?? '' });
  }

  function report(out: Record<string, unknown>, fallback: string) {
    setNote({
      tone: out.ok ? 'ok' : 'bad',
      text: (out.detail as string | undefined) ?? String(out.error ?? fallback),
    });
    return Boolean(out.ok);
  }

  /** Stage one. Nothing about the post is sent — only what reaches the person. */
  async function createRecord() {
    if (!drafting) return;
    setBusy(drafting.appointment_id);
    setNote(null);
    const out = await authedPost('/api/appointments/staff-record', {
      action: 'create',
      id: drafting.appointment_id,
      email: form.email.trim(),
      phone: form.phone.trim(),
    });
    setBusy(null);
    if (report(out, 'Nothing was created.')) setDrafting(null);
    void load();
  }

  /** Stage two, on the record rather than on the appointment. */
  async function createAccount(row: Registered) {
    setBusy(row.staff_record_id);
    setNote(null);
    setHandOver(null);
    const out = await authedPost('/api/appointments/staff-record', {
      action: 'account', staffRecordId: row.staff_record_id,
    });
    setBusy(null);
    report(out, 'No account was opened.');
    // ONLY WHERE THE EMAIL DID NOT GO. The route sends the password back in
    // that one case and in no other.
    if (out.password) {
      setHandOver({
        who: String(row.full_name ?? ''),
        username: String(out.username ?? row.email ?? ''),
        password: String(out.password),
      });
    }
    void load();
  }

  if (rows === null) return null;

  // NOT RENDERED WHEN THERE IS NOTHING TO DO — unless the reason there is
  // nothing to do is that a migration has not been run, which is the one case
  // where silence would be a lie.
  if (landed && secondStageLanded && rows.length === 0 && registered.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Appointment, staff record, staff account"
        subtitle="Three stages. Accepting an appointment does not put anybody on the register, and being on the register is not a login."
      />

      {!landed && (
        <div className="m-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>The staff register is not there yet.</strong> Migration 082 creates it. Until it
          is run, this list cannot be read — which is not the same as nobody waiting.
        </div>
      )}

      {!secondStageLanded && (
        <div className="m-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>The second stage is not there yet.</strong> Migration 104 separates the staff
          record from the staff account and creates the list of people on the register who
          cannot yet sign in. Until it is run, that list cannot be read.
        </div>
      )}

      {note && (
        <div className={`m-5 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
          note.tone === 'ok'
            ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border border-red-200 bg-red-50 text-red-800'
        }`}
        >
          {note.tone === 'ok'
            ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
            : <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />}
          <p>{note.text}</p>
        </div>
      )}

      {/* SHOWN ONCE. The route returns a password only where the welcome email
          could not be sent, and nothing anywhere can show it again. */}
      {handOver && (
        <div className="m-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="mb-1 font-medium">
            The welcome email could not be sent, so give {handOver.who} these directly.
          </p>
          <p className="font-mono text-xs">
            {handOver.username} · {handOver.password}
          </p>
          <p className="mt-1 text-xs">This cannot be shown again.</p>
        </div>
      )}

      {/* ==================================================================
          STAGE ONE — ACCEPTED, NOT YET ON THE REGISTER
          ================================================================== */}
      {rows.length > 0 && (
        <>
          <p className="px-5 pt-1 text-xs font-medium uppercase tracking-wide text-[#a49bb0]">
            Accepted — not yet on the staff register
          </p>

          {/* THE FORM, WHERE THE OFFICER SUPPLIES WHAT THE APPOINTMENT LACKED.
              Everything about the POST is read from the appointment and is not
              editable here: retyping it is the fault the letter exists to
              prevent. */}
          {drafting && (
            <div className="m-5 rounded-xl border border-[#ded6c8] p-4 dark:border-[#3d3349]">
              <p className="mb-1 font-medium text-[#422e59] dark:text-[#e4dcf0]">
                Create a staff record for {drafting.full_name}
              </p>
              <p className="mb-3 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                {drafting.position_title}
                {drafting.faculty ? ` · ${drafting.faculty}` : ''}
                {drafting.employment_type ? ` · ${drafting.employment_type}` : ''}
                {drafting.start_date ? ` · from ${drafting.start_date}` : ''}
                {' · '}the staff number is issued by the University and is not typed here
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="sr-email">Email address</label>
                  <input
                    id="sr-email" className={INPUT} type="email" value={form.email}
                    placeholder="Becomes their username"
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="sr-phone">Telephone</label>
                  <input
                    id="sr-phone" className={INPUT} value={form.phone}
                    placeholder="Optional"
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* SAID ON THE FORM, not discovered afterwards. An address is not
                  needed to be ON the register — it is needed to sign in — and
                  an office still chasing one should put the person on the
                  register today rather than hold the whole thing up. */}
              <p className="mt-3 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                The address is not required to be on the register. It is required for a staff
                account, because it becomes the username and the welcome letter goes to it — so
                a record created without one can be made today and given an account when the
                address arrives.
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button" className={BTN_PRIMARY}
                  disabled={busy === drafting.appointment_id}
                  onClick={() => void createRecord()}
                >
                  {busy === drafting.appointment_id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <IdCard size={14} />}
                  Create staff record
                </button>
                <button
                  type="button" className={BTN_SECONDARY} onClick={() => setDrafting(null)}
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          )}

          <TableShell>
            <THead>
              <tr>
                <Th>Appointee</Th>
                <Th>Post</Th>
                <Th>From</Th>
                <Th>Email</Th>
                <Th> </Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <tr key={r.appointment_id}>
                  <Td>
                    <span className="font-medium">{r.full_name}</span>
                    {r.unit_name && (
                      <span className="block text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        {r.unit_name}
                      </span>
                    )}
                  </Td>
                  <Td>{r.position_title}</Td>
                  <Td>{r.start_date}</Td>
                  <Td>
                    {r.email ?? (
                      <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        None recorded — add it on the form
                      </span>
                    )}
                  </Td>
                  <Td>
                    {/* NEVER DISABLED FOR WANT OF AN EMAIL. That was the fault:
                        a button that refused to open and told the officer to go
                        and correct something, with nothing to correct it with. */}
                    <button
                      type="button" className={BTN_PRIMARY}
                      disabled={busy === r.appointment_id}
                      onClick={() => startDrafting(r)}
                    >
                      {busy === r.appointment_id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <IdCard size={14} />}
                      Create staff record
                    </button>
                  </Td>
                </tr>
              ))}
            </TBody>
          </TableShell>
        </>
      )}

      {/* ==================================================================
          STAGE TWO — ON THE REGISTER, CANNOT YET SIGN IN
          ================================================================== */}
      {registered.length > 0 && (
        <>
          <p className="px-5 pt-4 text-xs font-medium uppercase tracking-wide text-[#a49bb0]">
            On the staff register — no account yet
          </p>
          <TableShell>
            <THead>
              <tr>
                <Th>Staff number</Th>
                <Th>Name</Th>
                <Th>Post</Th>
                <Th>Username</Th>
                <Th> </Th>
              </tr>
            </THead>
            <TBody>
              {registered.map((r) => (
                <tr key={r.staff_record_id}>
                  <Td><span className="font-mono text-xs">{r.staff_number}</span></Td>
                  <Td><span className="font-medium">{r.full_name}</span></Td>
                  <Td>{r.position_title}</Td>
                  <Td>
                    {r.email ?? (
                      <span className="text-xs text-amber-700">
                        No address recorded — an account cannot be opened without one
                      </span>
                    )}
                  </Td>
                  <Td>
                    {/* HERE the button IS conditional on the address, and
                        correctly: 104 refuses the account in the database too,
                        so offering it would be offering a refusal. */}
                    <button
                      type="button" className={BTN_PRIMARY}
                      disabled={busy === r.staff_record_id || !r.ready}
                      onClick={() => void createAccount(r)}
                    >
                      {busy === r.staff_record_id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <KeyRound size={14} />}
                      Create staff account
                    </button>
                  </Td>
                </tr>
              ))}
            </TBody>
          </TableShell>
        </>
      )}

      <p className="px-5 pb-5 pt-3 text-xs text-[#6b6076] dark:text-[#9c93ad]">
        <UserPlus size={12} className="mr-1 inline-block align-[-1px]" />
        Nothing about the post is typed on either stage: the title, faculty, employment type and
        start date all come from the appointment the University approved, and the staff number is
        issued by the University. What an officer supplies is what the appointment never captured.
      </p>
    </Card>
  );
}
