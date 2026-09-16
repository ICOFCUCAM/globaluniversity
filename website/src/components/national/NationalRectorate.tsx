'use client';

// ---------------------------------------------------------------------------
// THE NATIONAL RECTORATE — what a Rector sees, and why it is so short a file.
//
// ---------------------------------------------------------------------------
// THIS SCREEN DOES NO SCOPING, DELIBERATELY
// ---------------------------------------------------------------------------
//
// It asks for students, staff and payments the way any other screen does. What
// comes back is one nation's, because 097's row-level security decided that in
// the database — `my_administration()` reads the register and the policies
// compare against it.
//
// So there is no `.eq('administration_id', …)` anywhere below, and there must
// not be. A filter here would look like the thing keeping nations apart, and
// the day somebody removed it nothing would appear to break. The filter is not
// here because it is not this file's job, and a reader should be able to see
// that at a glance.
//
// ---------------------------------------------------------------------------
// AND IT IS HONEST ABOUT A RECTOR OF NOWHERE
// ---------------------------------------------------------------------------
//
// Somebody can hold the `national-rector` role before the University has
// established their administration. `my_administration()` then returns null,
// every policy compares against null, and every list comes back empty — which
// on screen is indistinguishable from "your country has no students yet".
//
// Those are completely different situations, so the screen asks the register
// first and says which one it is.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can, type Capability } from '@/lib/roles';
import { UNIVERSITY } from '@/lib/constants';
import {
  AlertTriangle, GraduationCap, Landmark, Loader2, Users, Wallet,
} from 'lucide-react';

interface Nation {
  id: string;
  country: string;
  name: string;
  status: string;
  agreement_reference: string | null;
}

interface Ledger {
  currency: string | null;
  gross_received: number | null;
  kept_by_the_nation: number | null;
  remitted_to_the_centre: number | null;
  awaiting_an_agreement: number | null;
}

export default function NationalRectorate() {
  const { user } = useAuth();
  // WHAT EACH OFFICE MAY SEE ON THIS ONE SCREEN.
  //
  // The Rector and the Financial Secretary both open it — the nav gates on
  // role alone for that reason — and they do not see the same thing. The
  // Secretary administers the money and has no business counting the nation's
  // students; the Rector leads and sees both.
  const mayLead = can(user?.role, 'lead-national-administration' as Capability);
  const maySeeStudents = can(user?.role, 'view-national-students' as Capability);
  const maySeeMoney = can(user?.role, 'view-national-finance' as Capability);
  const [nation, setNation] = useState<Nation | null | 'none'>(null);
  const [counts, setCounts] = useState<{ students: number; staff: number } | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    // THE REGISTER FIRST. It is readable by every signed-in member of staff —
    // which nations the University operates through is on the prospectus — so
    // this returns a row whether or not the policies will return anything else.
    const { data, error } = await supabase
      .from('national_administrations')
      .select('id, country, name, status, agreement_reference')
      .eq('rector_id', user?.id ?? '')
      .neq('status', 'closed')
      .maybeSingle();

    if (error) {
      setFailed(/does not exist|schema cache/i.test(error.message)
        ? 'Migration 097 has not been run on this database, so there is no register of National '
          + 'Administrations to read. This is not "no administration" — it is a missing one.'
        : error.message);
      return;
    }
    if (!data) { setNation('none'); return; }
    setNation(data as Nation);

    const [{ count: students }, { count: staff }, { data: led }] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('staff_records').select('id', { count: 'exact', head: true }),
      supabase.from('national_ledger')
        .select('currency, gross_received, kept_by_the_nation, remitted_to_the_centre, '
          + 'awaiting_an_agreement')
        .eq('administration_id', (data as Nation).id),
    ]);

    setCounts({ students: students ?? 0, staff: staff ?? 0 });
    const row = (led ?? []).find((r) => (r as unknown as Ledger).currency) as unknown as Ledger | undefined;
    setLedger(row ?? null);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  if (failed) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <AlertTriangle size={16} className="mr-2 inline" />{failed}
        </div>
      </div>
    );
  }

  if (nation === null) {
    return (
      <p className="p-6 text-sm text-slate-500">
        <Loader2 size={14} className="mr-2 inline animate-spin" />Reading the register…
      </p>
    );
  }

  // ---- A RECTOR OF NOWHERE ------------------------------------------------
  if (nation === 'none') {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-[#322244]">National Rectorate</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={16} className="mr-2 inline" />
          <span className="font-medium">No National Administration is registered to you yet.</span>
          <p className="mt-1">
            You hold the office, and the University has not yet established the administration
            you will lead — or has not recorded you as its Rector. Until it does, this screen has
            nothing to show, and that is different from your country having no students.
          </p>
          <p className="mt-1">
            The Superadministrator or the Vice-Chancellor establishes it, under
            Settings → National Administrations.
          </p>
        </div>
      </div>
    );
  }

  const suspended = nation.status === 'suspended';

  return (
    <div className="space-y-6 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#57549a]">
          {UNIVERSITY.name} · National Rectorate
        </p>
        <h1 className="text-2xl font-semibold text-[#322244]">{nation.name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {nation.agreement_reference
            ? `Operating under agreement ${nation.agreement_reference}.`
            : 'No agreement has been recorded for this administration.'}
        </p>
      </header>

      {suspended && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mr-2 inline" />
          This administration’s authority is currently suspended. Its records are intact.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {maySeeStudents && (
        <Tile icon={<Users size={16} />} label="Students"
          value={counts ? counts.students.toLocaleString() : '—'}
          foot="Recruited and enrolled through this administration" />
        )}
        {mayLead && (
        <Tile icon={<GraduationCap size={16} />} label="National staff"
          value={counts ? counts.staff.toLocaleString() : '—'}
          foot="Appointed by the University on this administration’s recommendation" />
        )}
        {maySeeMoney && (
        <Tile icon={<Wallet size={16} />} label="Kept by the nation"
          value={ledger
            ? `${ledger.currency} ${Number(ledger.kept_by_the_nation ?? 0).toLocaleString()}`
            : '—'}
          foot={ledger
            ? `of ${ledger.currency} ${Number(ledger.gross_received ?? 0).toLocaleString()} received`
            : 'No payment has been allocated yet'} />
        )}
        {maySeeMoney && (
        <Tile icon={<Landmark size={16} />} label="Remitted to the centre"
          value={ledger
            ? `${ledger.currency} ${Number(ledger.remitted_to_the_centre ?? 0).toLocaleString()}`
            : '—'}
          foot="Registration is never shared" />
        )}
      </div>

      {/* THE DOOR 098 CLOSES, SAID WHERE THE PERSON AFFECTED WILL SEE IT. */}
      {ledger && Number(ledger.awaiting_an_agreement ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mr-2 inline" />
          {ledger.awaiting_an_agreement} payment(s) went wholly to the centre because no national
          revenue agreement was in force on the day they were received. An agreement approved now
          governs the payments that follow it, not those.
        </div>
      )}

      <p className="max-w-3xl text-xs text-slate-500">
        What appears on this screen is your administration’s and no other’s. That is decided in
        the database by migration 097, not by this page — so a screen the University adds later
        inherits it without anybody having to remember.
      </p>
    </div>
  );
}

function Tile({ icon, label, value, foot }: {
  icon: React.ReactNode; label: string; value: string; foot: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
        {icon}{label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#322244]">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{foot}</p>
    </div>
  );
}
