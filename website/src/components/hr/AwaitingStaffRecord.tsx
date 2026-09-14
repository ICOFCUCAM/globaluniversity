'use client';

// ---------------------------------------------------------------------------
// WHO HAS ACCEPTED AND IS NOT YET ON THE STAFF REGISTER.
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
// This is the list, and the button. Nothing on it is typed: every particular
// comes from the appointment the University already approved.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY RULED
// ---------------------------------------------------------------------------
//
//   AN OFFICER OPENS IT, not the acceptance itself. So this is a list somebody
//   acts on rather than something that happens while nobody is looking.
//
//   THE ACADEMIC OFFICE, THE REGISTRAR AND THE VICE-CHANCELLOR may do it.
//   Before this, only the Superadministrator could create any account at all.
//
//   EVERY APPOINTEE GETS A STAFF NUMBER. The number used to come out of
//   `lecturers`, so a Dean or a Director got an account and no number at all.
//
// THE PASSWORD IS SHOWN ONCE AND ONLY WHERE THE EMAIL FAILED. It is generated
// at the moment the record opens, sent to the appointee, and stored nowhere.
// Where mail is not configured the officer has to be able to hand it over, or
// the account is unreachable — and the screen says plainly that it cannot be
// shown again.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import {
  Card, CardHeader, TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import { BTN_PRIMARY } from '@/lib/portalTheme';
import { IdCard, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface Waiting {
  appointment_id: string;
  full_name: string | null;
  email: string | null;
  position_title: string | null;
  unit_name: string | null;
  faculty: string | null;
  employment_type: string | null;
  start_date: string | null;
  family: string | null;
}

// One literal — supabase-js reads the row type from it.
// eslint-disable-next-line max-len
const COLUMNS = 'appointment_id, full_name, email, position_title, unit_name, faculty, employment_type, start_date, family';

export default function AwaitingStaffRecord() {
  const [rows, setRows] = useState<Waiting[] | null>(null);
  // WHETHER THE VIEW IS THERE AT ALL. 082 creates it, and until the University
  // runs 082 this panel must say so rather than rendering an empty list that
  // reads as "nobody is waiting".
  const [landed, setLanded] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [handOver, setHandOver] = useState<{ who: string; username: string; password: string } | null>(null);

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
      const missing = /does not exist|could not find/i.test(error.message ?? '')
        || ['42P01', 'PGRST205'].includes(error.code ?? '');
      setLanded(!missing);
      setRows([]);
      return;
    }
    setLanded(true);
    setRows((data ?? []) as Waiting[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function open(row: Waiting) {
    setBusy(row.appointment_id);
    setNote(null);
    setHandOver(null);
    const out = await authedPost('/api/appointments/staff-record', {
      action: 'open', id: row.appointment_id,
    });
    setBusy(null);

    if (!out.ok) {
      setNote({
        tone: 'bad',
        text: (out.detail as string | undefined) ?? String(out.error ?? 'Nothing was opened.'),
      });
      return;
    }
    setNote({
      tone: 'ok',
      text: (out.detail as string | undefined) ?? 'The staff record is open.',
    });
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
  // nothing to do is that the migration has not been run, which is the one case
  // where silence would be a lie.
  if (landed && rows.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Awaiting a staff record"
        subtitle="Appointees who have accepted and are not yet on the staff register"
      />

      {!landed && (
        <div className="m-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>The staff register is not there yet.</strong> Migration 082 creates it. Until it
          is run, this list cannot be read — which is not the same as nobody waiting.
        </div>
      )}

      {note && (
        <div className={`m-5 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
          note.tone === 'ok'
            ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border border-red-200 bg-red-50 text-red-800'
        }`}>
          {note.tone === 'ok'
            ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
            : <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />}
          <p>{note.text}</p>
        </div>
      )}

      {/* SHOWN ONCE. The route returns a password only where the welcome email
          could not be sent, and nothing in this system can show it again. */}
      {handOver && (
        <div className="m-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            The welcome email could not be sent, so give {handOver.who} these directly.
          </p>
          <p className="mt-2 font-mono text-[13px]">
            Username: {handOver.username}<br />
            Temporary password: {handOver.password}
          </p>
          <p className="mt-2 text-[12px]">
            This cannot be shown again. It is stored nowhere — if it is lost, they reset their
            password rather than being told it.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <TableShell>
          <THead>
            <tr><Th>Appointee</Th><Th>Post</Th><Th>From</Th><Th>Username</Th><Th /></tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <tr key={r.appointment_id}>
                <Td>
                  <span className="font-medium">{r.full_name ?? '—'}</span>
                  <span className="block text-[11px] text-[#a49bb0]">
                    {[r.unit_name, r.faculty].filter(Boolean).join(' · ')}
                  </span>
                </Td>
                <Td>{r.position_title ?? '—'}</Td>
                <Td>
                  {r.start_date
                    ? new Date(r.start_date).toLocaleDateString('en-GB',
                      { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </Td>
                {/* THE USERNAME IS THEIR EMAIL, so an appointee with none
                    cannot be given an account. Said here rather than on
                    pressing the button. */}
                <Td>
                  {r.email ?? (
                    <span className="text-amber-700">
                      No email recorded — correct the appointment first
                    </span>
                  )}
                </Td>
                <Td>
                  <button type="button" className={BTN_PRIMARY}
                    disabled={busy === r.appointment_id || !r.email}
                    onClick={() => void open(r)}>
                    {busy === r.appointment_id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <IdCard size={14} />}
                    Open the staff record
                  </button>
                </Td>
              </tr>
            ))}
          </TBody>
        </TableShell>
      )}
    </Card>
  );
}
