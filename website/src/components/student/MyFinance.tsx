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
// THERE IS AN "OUTSTANDING" NOW, AND IT WAS EARNED RATHER THAN GUESSED
// ---------------------------------------------------------------------------
//
// This screen used to refuse to show a balance, and the refusal was right at
// the time: nothing in the database recorded what a student was CHARGED, only
// what had been received. The only way to produce a figure was to take the
// published $12,200, multiply by the years and subtract the payments — a
// number no office in the University had ever agreed, on a screen students act
// on. Somebody pays the wrong amount; somebody is told they are in arrears and
// is not.
//
// 075 changed the fact rather than the policy. The Superadministrator sets a
// fee schedule, Finance raises it against a student, and the balance is now
// arithmetic on rows that somebody at the University typed deliberately.
//
// SO THE RULE IS UNCHANGED AND STILL ENFORCED: a balance is shown only where
// the student has actually been assessed. `has_been_assessed` is the column
// that carries it, and where it is false this screen says "nothing has been
// charged to you yet" rather than "you owe nothing" — which are different
// statements and only one of them is true.
//
// AND NEVER ACROSS CURRENCIES. The account is per currency, because this
// system holds no exchange rate and inventing one would put a wrong number on
// a financial screen.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/portal';
import StudentScreen from './StudentScreen';
import { readMine } from '@/lib/studentReads';
import { tuition } from '@/content/site';
import { Wallet, Receipt, Info } from 'lucide-react';

// eslint-disable-next-line max-len
const COLUMNS = 'student_id, payment_id, reference, amount, currency, purpose, method, received_at, received_on, note';
// eslint-disable-next-line max-len
const ACCOUNT = 'student_id, currency, assessed, waived, payable, paid, outstanding, has_been_assessed, standing';
// eslint-disable-next-line max-len
const CHARGES = 'student_id, assessment_id, session_label, semester, label, category, amount, waived, payable, currency, due_on, waiver_reason, raised_at, overdue';

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

export interface AccountLine {
  currency: string;
  assessed: number;
  waived: number;
  payable: number;
  paid: number;
  outstanding: number;
  has_been_assessed: boolean;
  standing: string;
}

export interface Charge {
  assessment_id: string;
  session_label: string;
  semester: number | null;
  label: string;
  category: string;
  amount: number;
  waived: number;
  payable: number;
  currency: string;
  due_on: string | null;
  waiver_reason: string | null;
  overdue: boolean;
}

export default function MyFinance() {
  const [rows, setRows] = useState<Payment[]>([]);
  const [account, setAccount] = useState<AccountLine[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, a, c] = await Promise.all([
      readMine<Payment>('my_finance', COLUMNS, { column: 'received_at', ascending: false }),
      readMine<AccountLine>('my_fee_account', ACCOUNT),
      readMine<Charge>('my_fee_assessments', CHARGES, { column: 'raised_at', ascending: false }),
    ]);
    setRows(p.rows); setAccount(a.rows); setCharges(c.rows);
    // THE ACCOUNT IS THE ONE THAT MATTERS. If the payments read but the
    // account did not, a screen showing payments alone reads as "nothing is
    // owed" — so any failure fails the whole screen.
    setFailed(p.failed ?? a.failed ?? c.failed);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => totalsByCurrency(rows), [rows]);
  const assessed = useMemo(() => account.filter((a) => a.has_been_assessed), [account]);

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
            THE BALANCE, WHERE THERE IS ONE TO SHOW.

            `has_been_assessed` is what separates the two cases, and they are
            drawn completely differently on purpose: a student who owes
            nothing and a student nobody has charged yet must never read the
            same.
            ------------------------------------------------------------------ */}
        {assessed.length === 0 ? (
          <Card className="flex items-start gap-3 border-[#c5a55a] p-4">
            <Info size={16} className="mt-0.5 shrink-0 text-[#c5a55a]" />
            <div className="text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
              <p className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">
                Nothing has been charged to you yet.
              </p>
              <p className="mt-1">
                That is not the same as owing nothing. The University has not raised any fee
                against your record in this system, so there is no balance to show. The Finance
                Office holds the account — ask them under Student services if you need a
                statement.
              </p>
            </div>
          </Card>
        ) : (
          <section className="space-y-2">
            <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
              Your account
            </h2>
            {assessed.map((a) => (
              <Card key={a.currency} className={`p-5 ${
                a.outstanding > 0 ? 'border-[#c5a55a]' : ''
              }`}>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Line label="Charged" value={money(Number(a.assessed), a.currency)} />
                  {Number(a.waived) > 0 && (
                    <Line label="Waived" value={money(Number(a.waived), a.currency)} />
                  )}
                  <Line label="Paid" value={money(Number(a.paid), a.currency)} />
                  <Line
                    label={Number(a.outstanding) < 0 ? 'In credit' : 'Outstanding'}
                    value={money(Math.abs(Number(a.outstanding)), a.currency)}
                    tone={Number(a.outstanding) > 0 ? 'attention' : 'ok'}
                  />
                </div>
                <p className="mt-3 text-[11px] text-[#a49bb0] dark:text-[#7b7289]">
                  {a.standing === 'paid in full'
                    ? 'Your account is settled in this currency.'
                    : a.standing === 'in credit'
                      ? 'You have paid more than has been charged. Ask Finance about a refund or '
                        + 'carrying it forward.'
                      : 'Payments are recorded by the Finance Office. If you have paid something '
                        + 'that is not shown here, ask them under Student services.'}
                </p>
              </Card>
            ))}
            {/* A PAYMENT IN A CURRENCY NOTHING WAS CHARGED IN. Shown, and shown
                as unapplied, because the alternative is a student seeing a
                full balance beside a payment they know they made. */}
            {account.some((a) => !a.has_been_assessed && Number(a.paid) > 0) && (
              <Card className="flex items-start gap-3 p-4">
                <Info size={15} className="mt-0.5 shrink-0 text-[#c5a55a]" />
                <p className="text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                  Some of your payments are in a currency nothing has been charged in
                  {' ('}
                  {account.filter((a) => !a.has_been_assessed && Number(a.paid) > 0)
                    .map((a) => a.currency).join(', ')}
                  {'). '}
                  They are recorded, and they are not set against the balances above — the
                  University has recorded no exchange rate, so this portal will not invent one.
                  Finance can apply them.
                </p>
              </Card>
            )}
          </section>
        )}

        {/* ---- WHAT WAS CHARGED, LINE BY LINE ---- */}
        {charges.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
              What you have been charged
            </h2>
            <Card className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
              {charges.map((c) => (
                <div key={c.assessment_id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                      {c.label}
                    </p>
                    <p className="truncate text-[11px] text-[#a49bb0]">
                      {c.session_label}
                      {c.semester ? ` · Semester ${c.semester}` : ''}
                      {c.category ? ` · ${c.category}` : ''}
                      {/* A WAIVER IS SHOWN WITH ITS REASON rather than the
                          amount being quietly reduced — see 075. */}
                      {Number(c.waived) > 0 && c.waiver_reason
                        ? ` · waived: ${c.waiver_reason}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums
                                  text-[#33234a] dark:text-[#e4dcf0]">
                      {money(Number(c.payable), c.currency)}
                      {Number(c.waived) > 0 && (
                        <span className="ml-2 text-[11px] font-normal text-[#a49bb0] line-through">
                          {money(Number(c.amount), c.currency)}
                        </span>
                      )}
                    </p>
                    {c.due_on && (
                      <p className={`text-[11px] ${
                        c.overdue ? 'font-medium text-red-700 dark:text-red-300' : 'text-[#a49bb0]'
                      }`}>
                        {c.overdue ? 'was due ' : 'due '}
                        {new Date(`${c.due_on}T00:00:00`).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          </section>
        )}

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

/** One figure of the account. Four of these make a balance a person can read. */
function Line({
  label, value, tone = 'plain',
}: { label: string; value: string; tone?: 'plain' | 'ok' | 'attention' }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[#a49bb0]">{label}</p>
      <p className={`mt-0.5 font-heading text-xl font-bold tabular-nums ${
        tone === 'attention' ? 'text-[#a07c12]'
          : tone === 'ok' ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-[#422e59] dark:text-[#c8b6e8]'
      }`}>
        {value}
      </p>
    </div>
  );
}
