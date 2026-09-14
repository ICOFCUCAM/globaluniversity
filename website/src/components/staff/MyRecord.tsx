'use client';

// ---------------------------------------------------------------------------
// MY RECORD — what the University holds about the person reading it.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The University asked what a lecturer's account could do, and the honest
// answer included this: NOTHING ABOUT THEMSELVES. Settings showed four tabs and
// a profile page carrying a name, an email and a role label. No staff number,
// no post, no department, no start date, no appointment letter, no conditions.
//
// The only place a staff number appeared anywhere was an unlabelled subtitle on
// the dashboard masthead.
//
// So the staff record opened for somebody — their number, their post, the
// letter they signed and the terms they accepted — was invisible to the one
// person it is entirely about. Appointments and Correspondence are role-gated
// to the offices, and `lecturer` is in none of those lists.
//
// ---------------------------------------------------------------------------
// AND IT NEEDS NO NEW PERMISSION
// ---------------------------------------------------------------------------
//
// 082's policy on `staff_records` already begins "your own record, always", and
// 041's on `appointment_letters` already admits the appointee where
// `appointments.person_id` is their account — which the staff-record route now
// sets when it opens the record. Both reads here are the ordinary user's own
// session against row-level security, not a route with a service key.
//
// THE LETTER IS THE ARCHIVED BYTES. Not re-rendered from the record: this opens
// exactly what was issued, seal and all, and the browser's own print dialogue
// saves it as a PDF. A second rendering path would be a second answer to "what
// does my letter say".
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { writeDocument } from '@/lib/openDocument';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton,
} from '@/components/ui/portal';
import { BTN_SECONDARY } from '@/lib/portalTheme';
import { IdCard, FileText, AlertTriangle } from 'lucide-react';

interface Record {
  id: string;
  staff_number: string | null;
  full_name: string | null;
  email: string | null;
  position_title: string | null;
  family: string | null;
  faculty: string | null;
  employment_type: string | null;
  started_on: string | null;
  status: string | null;
  appointment_id: string | null;
}

interface Letter {
  id: string;
  reference: string | null;
  version: number | null;
  issued_on: string | null;
  html: string | null;
  sealed: boolean | null;
}

// One literal each — supabase-js reads the row type from it.
// eslint-disable-next-line max-len
const RECORD = 'id, staff_number, full_name, email, position_title, family, faculty, employment_type, started_on, status, appointment_id';
const LETTER = 'id, reference, version, issued_on, html, sealed';

const longDate = (iso: string | null | undefined) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  : '—');

export default function MyRecord() {
  const [record, setRecord] = useState<Record | null | undefined>(undefined);
  const [letter, setLetter] = useState<Letter | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    // THEIR OWN ROW, BY ROW-LEVEL SECURITY. No filter is written here: 082's
    // policy is what decides, and a filter in the screen would be a second
    // answer to the same question.
    const { data } = await supabase.from('staff_records').select(RECORD).maybeSingle();
    const r = (data ?? null) as Record | null;
    setRecord(r);

    if (r?.appointment_id) {
      const { data: l } = await supabase.from('appointment_letters')
        .select(LETTER)
        .eq('appointment_id', r.appointment_id)
        .is('superseded_at', null)
        .maybeSingle();
      setLetter((l ?? null) as Letter | null);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openLetter() {
    // THE TAB IS CLAIMED ON THE CLICK. A browser blocks `window.open` that is
    // not the direct consequence of one, and the bytes are already here, so
    // there is nothing to await between the two.
    const w = window.open('', '_blank');
    if (!letter?.html) { setNote('There is no letter to open.'); return; }
    const ok = writeDocument(w, {
      html: letter.html,
      reference: letter.reference,
      sealed: letter.sealed,
    });
    if (!ok) setNote('Your browser blocked the new tab. Allow pop-ups for this site and try again.');
  }

  if (record === undefined) {
    return <Card className="p-5"><Skeleton className="h-4 w-48" /><Skeleton className="mt-3 h-24 w-full" /></Card>;
  }

  // NOT AN ERROR. Somebody whose record has not been opened yet — or a role
  // that has no staff record at all — should be told which, not shown an empty
  // table that reads as a fault.
  if (!record) {
    return (
      <div className="space-y-6">
        <PageHeader title="My record" subtitle="What the University holds about you as a member of staff" />
        <Card>
          <EmptyState
            icon={<IdCard size={20} />}
            title="You are not on the staff register yet"
            description="A staff record is opened by the Academic Office, the Registrar or the Vice-Chancellor once an appointment has been accepted. Until then there is nothing here to show."
          />
        </Card>
      </div>
    );
  }

  const rows: [string, string][] = [
    ['Staff number', record.staff_number ?? '—'],
    ['Name', record.full_name ?? '—'],
    ['Post', record.position_title ?? '—'],
    ['Faculty or unit', record.faculty ?? '—'],
    ['Employment', record.employment_type ?? '—'],
    ['In post since', longDate(record.started_on)],
    ['Username', record.email ?? '—'],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My record"
        subtitle="What the University holds about you as a member of staff"
      />

      <Card>
        <CardHeader title="Staff record" subtitle={`Your record is ${record.status ?? 'recorded'}`} />
        <dl className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-[#a49bb0]">{k}</dt>
              <dd className="mt-0.5 text-sm font-medium text-[#422e59] dark:text-[#e4dcf0]">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="My letter of appointment"
          subtitle="The document that was issued to you, exactly as it was issued"
        />
        <div className="space-y-3 p-5">
          {note && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> {note}
            </p>
          )}

          {letter ? (
            <>
              <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
                {letter.reference}
                {letter.version && letter.version > 1 ? ` · version ${letter.version}` : ''}
                {letter.issued_on ? ` · issued ${longDate(letter.issued_on)}` : ''}
              </p>
              <button type="button" className={BTN_SECONDARY} onClick={openLetter}>
                <FileText size={14} /> Open my letter
              </button>
              {/* THE CONDITIONS ARE IN THE LETTER, ANNEXED. Said here because
                  an appointee looking for "my conditions of service" should not
                  have to guess that they are pages two onward of the letter. */}
              <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                The conditions of your appointment and your job description are annexed to the
                letter and open with it. Choose <strong>Save as PDF</strong> in the print dialogue
                to keep a copy.
              </p>
            </>
          ) : (
            <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
              No letter of appointment is on your record. If you were appointed through the
              University&rsquo;s own process there should be one — ask the Registrar.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
