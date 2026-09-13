'use client';

// ---------------------------------------------------------------------------
// MY FINANCE — what the University has recorded receiving, and nothing more.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "Students need their own financial view. Academic fees — Total, Paid,
// Outstanding. Then: Invoices, Payments, Receipts, Payment history, Fee
// statement, Payment instructions… Importantly, the student can see their
// financial status, but cannot manipulate Finance's authoritative records."
//
// ---------------------------------------------------------------------------
// THERE IS NO "OUTSTANDING" ON THIS SCREEN, AND THAT IS THE HONEST ANSWER
// ---------------------------------------------------------------------------
//
// The University asked for Total, Paid and Outstanding. Two of the three can be
// stated truthfully today and the third cannot.
//
//   PAID          `payments` records every payment received. Real.
//   TOTAL         the published tuition schedule. Real, and quoted below
//                 exactly as the University publishes it on iguc.net/tuition.
//   OUTSTANDING   nothing in this database charges a student anything. There
//                 is no invoice table, no fee assessment, no record of what
//                 THIS student was asked to pay.
//
// The obvious move is to subtract: take $12,200, multiply by the years,
// subtract what was paid. That would put a number on a student's screen that
// no office in the University has ever agreed — and students act on this
// screen. Somebody pays the wrong amount. Somebody is told they are in arrears
// and is not. Somebody is told they are clear and is not, and finds out at
// graduation.
//
// A published price is not an invoice. Full-time and part-time differ,
// dependants change the figure, and none of that is recorded per student.
//
// So this screen shows what was paid, quotes the published schedule as
// published, and says plainly that Finance holds the account. It gains a
// balance the day the University records invoices, and not before.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/portal';
import StudentScreen from './StudentScreen';
import { readMine } from '@/lib/studentReads';
import { tuition } from '@/content/site';
import { Wallet, Receipt, Info } from 'lucide-react';

// eslint-disable-next-line max-len
const COLUMNS = 'student_id, payment_id, reference, amount, currency, purpose, method, received_at, received_on, note';

export interface Payment {
  payment_id: string;
  reference: string | null;
  amount: number;
  currency: string;
  purpose: string | null;
  method: string | null;
  received_at: string;
  received_on: string;
  note: string | null;
}

/** Grouped by currency, because adding dollars to francs is not a total. */
export function totalsByCurrency(rows: Payment[]): { currency: string; total: number }[] {
  const byCur = new Map<string, number>();
  for (const r of rows) {
    byCur.set(r.currency, (byCur.get(r.currency) ?? 0) + Number(r.amount));
  }
  // Array.from rather than spreading the iterator: the project targets a
  // version of JavaScript where spreading a Map iterator needs
  // downlevelIteration, and turning that on for one line changes how every
  // loop in the codebase is compiled.
  return Array.from(byCur.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total);
}

export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency, currencyDisplay: 'narrowSymbol',
    }).format(amount);
  } catch {
    // AN UNKNOWN CURRENCY CODE MUST NOT CRASH A FINANCIAL SCREEN. Intl throws
    // on anything that is not a real ISO code, and a typo in one payment row
    // would otherwise blank the whole page.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function MyFinance() {
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { rows: r, failed: f } = await readMine<Payment>(
      'my_finance', COLUMNS, { column: 'received_at', ascending: false },
    );
    setRows(r); setFailed(f); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => totalsByCurrency(rows), [rows]);

  return (
    <StudentScreen
      title="Fees & payments"
      subtitle={rows.length === 0 ? 'What the University has recorded receiving from you'
        : `${rows.length} payment${rows.length === 1 ? '' : 's'} recorded`}
      loading={loading}
      failed={failed}
    >
      <div className="space-y-6">
        {/* ---- WHAT HAS BEEN PAID ---- */}
        <div className="grid gap-4 sm:grid-cols-2">
          {totals.length === 0 ? (
            <Card className="p-5 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-[#a49bb0]">Recorded as paid</p>
              <p className="mt-1 font-heading text-2xl font-bold text-[#422e59] dark:text-[#c8b6e8]">
                Nothing yet
              </p>
              <p className="mt-0.5 text-[11px] text-[#a49bb0]">
                The University has not recorded any payment from you. If you have paid and this is
                wrong, the Finance Office holds the record — ask them under Student services.
              </p>
            </Card>
          ) : totals.map((t) => (
            <Card key={t.currency} className="p-5">
              <p className="text-xs uppercase tracking-wide text-[#a49bb0]">
                Recorded as paid{totals.length > 1 ? ` (${t.currency})` : ''}
              </p>
              <p className="mt-1 font-heading text-2xl font-bold tabular-nums
                            text-[#422e59] dark:text-[#c8b6e8]">
                {money(t.total, t.currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-[#a49bb0]">
                Across {rows.filter((r) => r.currency === t.currency).length} payment
                {rows.filter((r) => r.currency === t.currency).length === 1 ? '' : 's'}
              </p>
            </Card>
          ))}
        </div>

        {/* ------------------------------------------------------------------
            THE SENTENCE THAT REPLACES A BALANCE.

            It is a panel rather than a footnote because it is the most
            important thing on the screen: a student who assumes the absence
            of a balance means they owe nothing is worse off than one who is
            told where to ask.
            ------------------------------------------------------------------ */}
        <Card className="flex items-start gap-3 border-[#c5a55a] p-4">
          <Info size={16} className="mt-0.5 shrink-0 text-[#c5a55a]" />
          <div className="text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
            <p className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">
              This portal does not show a balance, and you should not read one into it.
            </p>
            <p className="mt-1">
              The University&apos;s record of what you have been charged is held by the Finance
              Office, not here. This page shows only what has been recorded as received from you.
              For a statement of your account — what is due and by when — ask Finance under
              Student services.
            </p>
          </div>
        </Card>

        {/* ---- THE PAYMENTS THEMSELVES ---- */}
        {rows.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
              Payment history
            </h2>
            <Card className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
              {rows.map((p) => (
                <div key={p.payment_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <Receipt size={15} className="shrink-0 text-[#c5a55a]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                      {p.purpose ?? 'Payment'}
                    </p>
                    <p className="truncate text-[11px] text-[#a49bb0]">
                      {p.reference ?? 'No reference recorded'}
                      {p.method ? ` · ${p.method}` : ''}
                      {p.note ? ` · ${p.note}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-[#33234a] dark:text-[#e4dcf0]">
                      {money(Number(p.amount), p.currency)}
                    </p>
                    <p className="text-[11px] text-[#a49bb0]">
                      {new Date(`${p.received_on}T00:00:00`).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          </section>
        )}

        {/* ------------------------------------------------------------------
            THE PUBLISHED SCHEDULE.

            QUOTED, NOT COMPUTED. These are the University's own published
            figures from iguc.net/tuition, read from the same content file the
            public page reads — so they cannot drift apart. Not one of them is
            applied to this student, and the heading says so.
            ------------------------------------------------------------------ */}
        <section className="space-y-2">
          <div>
            <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
              The University&apos;s published fees
            </h2>
            <p className="text-[11px] text-[#a49bb0] dark:text-[#7b7289]">
              What the University publishes for everybody. This is not a statement of your own
              account — which of these apply to you depends on how you study, and Finance decides
              that.
            </p>
          </div>
          <Card className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
            {tuition.rows.map((r) => (
              <div key={r.program} className="flex flex-wrap items-baseline justify-between gap-x-6
                                              gap-y-1 px-4 py-2.5">
                <span className="text-sm text-[#33234a] dark:text-[#e4dcf0]">{r.program}</span>
                <span className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{r.fee}</span>
              </div>
            ))}
          </Card>
        </section>

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed
                      text-[#a49bb0] dark:text-[#7b7289]">
          <Wallet size={12} className="mt-0.5 shrink-0" />
          Nothing on this page can be changed from here. Payments are recorded by the Finance
          Office and this is a read-only view of them.
        </p>
      </div>
    </StudentScreen>
  );
}
