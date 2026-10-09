'use client';

// ---------------------------------------------------------------------------
// /join?t=… — WHERE A NEW MEMBER OF STAFF OPENS THEIR OWN RECORD.
//
// ---------------------------------------------------------------------------
// THE ONLY PAGE IN THIS SYSTEM READ BY SOMEBODY WITH NO ACCOUNT
// ---------------------------------------------------------------------------
//
// Which changes what it has to do. Every other screen can assume the reader
// signed in, so the system already knows them and they already trust it. This
// one arrives on WhatsApp as a link from a number, and the reader's correct
// first instinct is that it might be a fraud.
//
// So it proves itself before it asks for anything: it shows their name, their
// post and their start date — read from the appointment the University
// approved — before there is a single field to fill in. Somebody who was not
// expecting this sees a letter they recognise; somebody who was phished sees a
// name that is not theirs.
//
// AND IT ASKS FOR NOTHING IT DOES NOT NEED. No date of birth, no national
// identity number, no "security questions". An email address, a telephone
// number and a password. The University already holds everything else.
//
// ---------------------------------------------------------------------------
// NOTHING ABOUT THE POST IS EDITABLE, AND NOT BECAUSE IT IS DISABLED
// ---------------------------------------------------------------------------
//
// The particulars are drawn as text, never as inputs, because they are not
// this person's to set — and the route does not read them from the body even
// if something sends them. A disabled input is a field a browser can
// re-enable; a field that was never read is not.
// ---------------------------------------------------------------------------

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck, Loader2, AlertTriangle, CheckCircle2, KeyRound, ArrowRight,
} from 'lucide-react';
import { UNIVERSITY } from '@/lib/constants';
import { MIN_PASSWORD } from '@/lib/invitations';

interface Who {
  fullName: string | null;
  positionTitle: string | null;
  unitName: string | null;
  faculty: string | null;
  employmentType: string | null;
  startDate: string | null;
}

const CARD = 'rounded-2xl border border-[#ded6c8] bg-white p-6 shadow-sm '
  + 'dark:border-[#3d3349] dark:bg-[#231c2b]';
const INPUT = 'w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2.5 text-sm '
  + 'text-[#422e59] placeholder:text-[#a49bb0] focus:outline-none focus:ring-2 '
  + 'focus:ring-[#6b4e8f] dark:border-[#3d3349] dark:bg-[#1b1521] dark:text-[#e4dcf0]';
const LABEL = 'mb-1 block text-xs font-medium uppercase tracking-wide text-[#6b6076] '
  + 'dark:text-[#9c93ad]';

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/appointments/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

function Join() {
  const params = useSearchParams();
  const token = params.get('t') ?? '';

  const [who, setWho] = React.useState<Who | null>(null);
  const [looking, setLooking] = React.useState(true);
  const [refused, setRefused] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ staffNumber: string; username: string } | null>(null);

  const [form, setForm] = React.useState({ email: '', phone: '', password: '', again: '' });

  React.useEffect(() => {
    let live = true;
    (async () => {
      const out = await post({ action: 'look', token });
      if (!live) return;
      setLooking(false);
      if (out.ok) setWho(out as unknown as Who);
      else setRefused(String(out.detail ?? 'This invitation cannot be used.'));
    })();
    return () => { live = false; };
  }, [token]);

  async function submit() {
    setError(null);
    // CHECKED HERE SO THE READER IS NOT TOLD BY A ROUND TRIP, and checked
    // again on the server, which is the one that counts.
    if (form.password !== form.again) {
      setError('The two passwords are not the same.');
      return;
    }
    if (form.password.length < MIN_PASSWORD) {
      setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setBusy(true);
    const out = await post({
      action: 'claim',
      token,
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
    });
    setBusy(false);
    if (out.ok) {
      setDone({ staffNumber: String(out.staffNumber), username: String(out.username) });
      return;
    }
    setError(String(out.detail ?? 'That did not work.'));
  }

  // ---- DONE -------------------------------------------------------------
  if (done) {
    return (
      <div className={CARD}>
        <p className="flex items-start gap-2 text-[#1f7a4d]">
          <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
          <span className="text-lg font-medium">Your staff record is open.</span>
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className={LABEL}>Staff number</dt>
            <dd className="font-mono text-sm text-[#422e59] dark:text-[#e4dcf0]">
              {done.staffNumber}
            </dd>
          </div>
          <div>
            <dt className={LABEL}>You sign in as</dt>
            <dd className="text-sm text-[#422e59] dark:text-[#e4dcf0]">{done.username}</dd>
          </div>
        </dl>
        <a
          href="/portal"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2.5
            text-sm font-medium text-white hover:bg-[#573c75]"
        >
          Sign in to the portal <ArrowRight size={15} />
        </a>
        <p className="mt-4 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          This link has now been used and will not open again. Nobody at the University can see
          your password — if you forget it, use &ldquo;forgotten your password&rdquo; on the
          sign-in page.
        </p>
      </div>
    );
  }

  if (looking) {
    return (
      <div className={CARD}>
        <p className="flex items-center gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <Loader2 size={16} className="animate-spin" /> Checking your invitation&hellip;
        </p>
      </div>
    );
  }

  // ---- REFUSED ----------------------------------------------------------
  //
  // One message for every reason. See the route: telling somebody which of
  // expired, used or unknown tells somebody guessing which guesses to repeat.
  if (refused || !who) {
    return (
      <div className={CARD}>
        <p className="flex items-start gap-2 text-[#a3283f]">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <span className="font-medium">This invitation cannot be used</span>
        </p>
        <p className="mt-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">{refused}</p>
      </div>
    );
  }

  // ---- THE FORM ---------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* IT PROVES ITSELF BEFORE IT ASKS. Their name and post, read from the
          appointment, above any field at all. */}
      <div className={CARD}>
        <p className={LABEL}>This invitation is for</p>
        <p className="text-xl font-semibold text-[#422e59] dark:text-[#e4dcf0]">
          {who.fullName}
        </p>
        <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          {who.positionTitle}
          {who.unitName ? ` · ${who.unitName}` : ''}
          {who.faculty ? ` · ${who.faculty}` : ''}
        </p>
        <p className="mt-0.5 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          {who.employmentType}
          {who.startDate ? ` · from ${who.startDate}` : ''}
        </p>
        <p className="mt-3 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          If this is not you, please close this page and tell whoever sent you the link.
        </p>
      </div>

      <div className={CARD}>
        <h2 className="text-base font-semibold text-[#422e59] dark:text-[#e4dcf0]">
          How the University reaches you
        </h2>
        <p className="mb-4 mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          These are the only things we need from you. Everything else is already on your letter
          of appointment.
        </p>

        <div className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="j-email">Email address</label>
            <input
              id="j-email" type="email" className={INPUT} value={form.email}
              autoComplete="email"
              placeholder="This becomes the username you sign in with"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="j-phone">Telephone</label>
            <input
              id="j-phone" className={INPUT} value={form.phone} autoComplete="tel"
              placeholder="Optional"
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="j-pw">
              Choose a password — at least {MIN_PASSWORD} characters
            </label>
            <input
              id="j-pw" type="password" className={INPUT} value={form.password}
              autoComplete="new-password"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="j-pw2">And again</label>
            <input
              id="j-pw2" type="password" className={INPUT} value={form.again}
              autoComplete="new-password"
              onChange={(e) => setForm({ ...form, again: e.target.value })}
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50
            px-3 py-2 text-sm text-red-800"
          >
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> {error}
          </p>
        )}

        <button
          type="button" disabled={busy}
          onClick={() => void submit()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2.5
            text-sm font-medium text-white hover:bg-[#573c75] disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          Open my staff record
        </button>

        <p className="mt-4 flex items-start gap-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            Your password is never seen by anybody at the University, and it is not stored
            anywhere it could be read. This link works once and then stops.
          </span>
        </p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-10 sm:py-16">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b4e8f]">
          {UNIVERSITY.name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#422e59] dark:text-[#e4dcf0]">
          Open your staff record
        </h1>
      </header>
      {/* useSearchParams needs a Suspense boundary for the static build. */}
      <Suspense fallback={null}><Join /></Suspense>
    </main>
  );
}
