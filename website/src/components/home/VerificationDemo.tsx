'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, ScanLine, Fingerprint, Globe2, Loader2, ArrowRight } from 'lucide-react';
import { UNIVERSITY } from '@/lib/constants';
import { partners } from '@/content/site';

// ---------------------------------------------------------------------------
// LIVE CREDENTIAL VERIFICATION.
//
// WHY THIS IS THE SECTION THAT MAKES THE UNIVERSITY LOOK LIKE THE FUTURE.
//
// A brief for this page asked for blockchain verification, digital diplomas,
// live employer verification and academic seals. The remarkable thing is that
// this university already has the substance of all of it, built and working,
// and had it hidden three clicks deep behind a menu.
//
// Every credential issued here carries an identifier sealed with an HMAC over
// the holder, the award, the classification and the date. Anyone — an employer
// in Lagos, a registry in Berlin, a credential evaluator in Toronto — can put
// that identifier into a public page and get an answer, without contacting the
// university, without an account, and without the university being able to
// quietly change what it once attested to.
//
// That is what a blockchain is usually reached for, and it is achieved here
// with a keyed hash and a public endpoint: no chain, no token, no gas, no
// third-party dependency that has to still exist in 2046 when somebody checks
// a degree conferred today. A degree must remain verifiable for a lifetime,
// which is a very long time to depend on a startup.
//
// WHAT THIS COMPONENT DOES. It calls the same endpoint the verification page
// calls, with whatever the visitor types. It is not a simulation and there is
// no canned response: an unknown identifier is reported as unknown, because a
// demonstration that always succeeds proves nothing and would itself be a
// small forgery.
// ---------------------------------------------------------------------------

type Result =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'found'; holder?: string; award?: string; issued?: string; status?: string }
  | { kind: 'unknown' }
  | { kind: 'unconfigured' }
  | { kind: 'error'; message: string };

const STEPS = [
  {
    icon: Fingerprint,
    title: 'Sealed when it is issued',
    body:
      'The holder, the award, the classification and the date are hashed together with a key only '
      + 'the university holds. Change any one of them and the seal no longer matches.',
  },
  {
    icon: ScanLine,
    title: 'Printed on the certificate',
    body:
      'The identifier appears on the document and inside the QR code, so a paper certificate held '
      + 'up to a phone resolves to the same record as the register.',
  },
  {
    icon: Globe2,
    title: 'Checked by anyone, anywhere',
    body:
      'No account, no login, no email to the registry, no fee. An employer on another continent '
      + 'gets the same answer at midnight as the Registrar gets at noon.',
  },
];

export default function VerificationDemo() {
  const [id, setId] = useState('');
  const [result, setResult] = useState<Result>({ kind: 'idle' });

  async function check(e: React.FormEvent) {
    e.preventDefault();
    const q = id.trim();
    if (!q) return;
    setResult({ kind: 'checking' });
    try {
      const res = await fetch(`/api/credential?number=${encodeURIComponent(q)}`);
      const out = await res.json();
      if (res.status === 503 || out.error === 'credential-secret-not-set') {
        setResult({ kind: 'unconfigured' });
        return;
      }
      if (out.found && out.credential) {
        setResult({
          kind: 'found',
          holder: out.credential.holderName,
          award: out.credential.award,
          issued: out.credential.issuedOn ?? undefined,
          status: out.credential.status,
        });
        return;
      }
      setResult({ kind: 'unknown' });
    } catch (err) {
      setResult({ kind: 'error', message: err instanceof Error ? err.message : 'Network error' });
    }
  }

  return (
    <section
      data-chapter="Recognition"
      aria-labelledby="verify-heading"
      className="relative overflow-hidden bg-[#150f1e] py-24 text-white sm:py-32"
      data-on-dark=""
    >
      {/* A field of fine rules, as on the certificate's engine-turned ground. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.055]"
        style={{ backgroundImage: 'repeating-linear-gradient(112deg, #f7dc79 0 1px, transparent 1px 20px)' }}
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-20">
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
              10 — Recognition you can verify
            </p>
            <h2
              id="verify-heading"
              className="mt-4 font-heading text-display font-bold [text-wrap:balance]"
            >
              Recognised, and able to prove it
            </h2>
            <div className="mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />

            {/* THE ACCREDITATION STATEMENT LIVES HERE NOW, AND ONLY HERE.
                It was the opening of a separate Standing band that sat directly
                above this one. The two were one argument split in half: Standing
                claimed the recognition, this section proved it, and Standing's
                own body copy ended on the sentence "A degree is only worth what
                someone else can confirm" — which was, word for word, this
                section's headline. Two bands, 1.97 screens, and the second
                repeated the first's closing line as its opening one.
                Claim and proof now sit in one place, in that order. */}
            <p className="mt-8 text-lg leading-relaxed text-white/85">
              {UNIVERSITY.name} is accredited by the Ministry of Higher Education of Cameroon
              (MINESUP), and has been continuously accredited since {UNIVERSITY.established}.
            </p>
            <p className="mt-5 text-lg leading-relaxed text-white/80">
              Every certificate and transcript this university issues carries an identifier sealed
              with a cryptographic key. Anyone holding the document can check it against the
              university&rsquo;s own register in a few seconds — and the university cannot quietly
              alter what it once attested to.
            </p>

            <ul className="mt-12 space-y-8">
              {STEPS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-5">
                  <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-heading text-lg font-bold">{title}</h3>
                    <p className="mt-1.5 leading-relaxed text-white/65">{body}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Carried over from the Standing band this section absorbed: the
                route to the full accreditation statement, and the partners.
                The logos are here rather than dropped because they are the one
                thing Standing carried that this section did not already say —
                recognition is a claim, a named partner is a witness to it. */}
            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="/accreditation"
                className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-brand-gold px-8 py-4 font-heading text-[15px] font-bold text-brand-purple-dark shadow-gold transition duration-300 hover:bg-brand-gold-deep"
              >
                Accreditation &amp; partnership
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>

            {partners.length > 0 && (
              <div className="mt-12 border-t border-white/10 pt-9">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
                  Recognised alongside
                </p>
                <ul className="mt-7 grid grid-cols-3 items-center gap-x-6 gap-y-8">
                  {partners.map((p) => (
                    <li key={p.name} className="flex items-center justify-center">
                      <Image
                        src={p.image}
                        alt={p.name}
                        width={96}
                        height={48}
                        className="h-10 w-auto object-contain opacity-60 brightness-0 invert transition duration-500 hover:opacity-100 hover:brightness-100 hover:invert-0"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ---- the working panel --------------------------------------- */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-7 backdrop-blur-sm sm:p-9">
            <h3 className="flex items-center gap-2.5 font-heading text-xl font-bold">
              <ShieldCheck size={20} className="text-brand-gold" aria-hidden="true" />
              Verify a credential
            </h3>
            <p id="cred-id-hint" className="mt-2.5 text-[15px] leading-relaxed text-white/60">
              This is the live register, not a demonstration. Type an identifier from any ICOF
              Global University document — for example IGUC-BTH-26A9-K4X2.
            </p>

            <form onSubmit={check} className="mt-7">
              <label htmlFor="cred-id" className="sr-only">
                Credential identifier
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="cred-id"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="IGUC-BTH-26A9-…"
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="characters"
                  // The identifier alphabet is Crockford minus I, L, O and U, so
                  // it is always upper case. Telling the keyboard that saves a
                  // phone user four shift presses and prevents the lower-case
                  // entry that would fail a lookup for no visible reason.
                  aria-describedby="cred-id-hint"
                  className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0f0a17] px-4 py-3.5 font-mono text-[15px] tracking-wide text-white outline-none transition placeholder:text-white/25 focus:border-brand-gold"
                />
                <button
                  type="submit"
                  disabled={!id.trim() || result.kind === 'checking'}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-6 py-3.5 font-heading text-[15px] font-bold text-brand-purple-dark transition duration-300 ease-enter hover:bg-brand-gold-deep active:scale-[0.98] active:duration-75 disabled:opacity-40"
                >
                  {result.kind === 'checking' && <Loader2 size={16} className="animate-spin" />}
                  Check
                </button>
              </div>
            </form>

            {/* The whole point of this panel is the answer, and the answer
                arrives asynchronously. Without a live region a screen reader
                user presses Check and the page appears not to respond.
                min-h reserves the space so the layout does not jump when the
                result lands — a shift under a button somebody just pressed is
                how a mis-click happens. */}
            <div className="mt-6 min-h-[7rem]" role="status" aria-live="polite" aria-atomic="true">
              {/* white/40 measured 3.77:1 against this panel and needed 4.5. It
                  is 14px, so it gets no large-text allowance — and it is a
                  privacy assurance, which is the last line on the page that
                  should be hard to read. */}
              {result.kind === 'idle' && (
                <p className="text-[14px] leading-relaxed text-white/60">
                  Nothing is stored and nothing is sent to a third party. The check runs against
                  this university&rsquo;s register and nowhere else.
                </p>
              )}

              {result.kind === 'found' && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-5">
                  <p className="flex items-center gap-2 font-heading font-bold text-emerald-300">
                    <ShieldCheck size={17} aria-hidden="true" /> On the register
                  </p>
                  <dl className="mt-3.5 space-y-1.5 text-[15px]">
                    {result.holder && (
                      <div className="flex gap-3">
                        <dt className="w-20 shrink-0 text-white/45">Holder</dt>
                        <dd className="font-semibold">{result.holder}</dd>
                      </div>
                    )}
                    {result.award && (
                      <div className="flex gap-3">
                        <dt className="w-20 shrink-0 text-white/45">Award</dt>
                        <dd>{result.award}</dd>
                      </div>
                    )}
                    {result.issued && (
                      <div className="flex gap-3">
                        <dt className="w-20 shrink-0 text-white/45">Issued</dt>
                        <dd>{result.issued}</dd>
                      </div>
                    )}
                    {result.status && (
                      <div className="flex gap-3">
                        <dt className="w-20 shrink-0 text-white/45">Status</dt>
                        <dd>{result.status}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {result.kind === 'unknown' && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5">
                  <p className="font-heading font-bold text-amber-300">Not on the register</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/65">
                    No credential with that identifier has been issued. Check the characters — the
                    alphabet excludes I, L, O and U so they cannot be confused with 1, 0 and V.
                  </p>
                </div>
              )}

              {result.kind === 'unconfigured' && (
                <div className="rounded-xl border border-white/15 bg-white/[0.06] p-5">
                  <p className="font-heading font-bold text-white/85">Verification is not yet live</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/60">
                    The signing key has not been set on this deployment, so the register cannot
                    answer. It reports this rather than reporting a genuine credential as invalid —
                    which would accuse a graduate of forging their own degree.
                  </p>
                </div>
              )}

              {result.kind === 'error' && (
                <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-5">
                  <p className="font-heading font-bold text-red-300">Could not reach the register</p>
                  <p className="mt-2 text-[14px] text-white/65">{result.message}</p>
                </div>
              )}
            </div>

            <Link
              href="/verify"
              className="group mt-7 inline-flex items-center gap-2 border-t border-white/10 pt-6 font-heading text-sm font-bold text-brand-gold"
            >
              Full verification service
              <ArrowRight size={15} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
