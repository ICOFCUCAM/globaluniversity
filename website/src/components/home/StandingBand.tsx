import Image from 'next/image';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { Aurora, Grain, Seam } from '@/components/Atmosphere';
import { partners } from '@/content/site';
import { UNIVERSITY } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Standing — accreditation, quality assurance, and who we work with.
//
// WHY THIS IS A SECTION AND NOT A ROW OF LOGOS. The partner logos were already
// on the homepage, in a strip, with no sentence around them. A strip of logos
// asks the visitor to infer a relationship, and the inference a sceptical
// visitor makes is usually less flattering than the truth. Saying plainly what
// the accreditation IS — and, just as importantly, what it is not — is what
// separates an institution from a website that wants to look like one.
//
// THE CAREFUL WORDING IS DELIBERATE AND WAS ASKED FOR. The university's own
// instruction on the accreditation content was to avoid describing ICOF Global
// University as an accreditation body unless it is legally established and
// recognised to confer accreditation in the relevant jurisdictions. So this
// section says what is true and checkable — accredited BY the Ministry of
// Higher Education since 2007 — and routes everything about the university's
// own partnership programme to the page that explains it properly.
// ---------------------------------------------------------------------------

export default function StandingBand() {
  return (
    <section
      data-chapter="Standing"
      aria-labelledby="standing-heading"
      className="relative overflow-hidden bg-brand-purple-dark py-24 text-white sm:py-32"
    >
      <Image
        src="/images/wp/g-hall.jpg"
        alt=""
        fill
        loading="lazy"
        quality={55}
        sizes="100vw"
        className="object-cover opacity-[0.12]"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-brand-purple-dark via-brand-purple-dark/95 to-brand-purple/80" />
      <Aurora tone="dual" intensity={0.7} />
      <Grain opacity={0.05} />
      <Seam />
      <Seam flip />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-20">
          <Reveal>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
              Accreditation &amp; standing
            </p>
            <h2
              id="standing-heading"
              className="mt-4 font-heading text-display font-bold text-white [text-wrap:balance]"
            >
              Recognised, and able to show it
            </h2>
            <div className="mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />

            <p className="mt-8 text-lg leading-relaxed text-white/85">
              ICOF Global University is accredited by the Ministry of Higher Education of Cameroon
              (MINESUP), and has been continually accredited since {UNIVERSITY.established}.
            </p>
            <p className="mt-5 leading-relaxed text-white/70">
              Every credential we issue carries a sealed identifier that anyone can verify from our
              website without contacting us — an employer, a registry, or an evaluator abroad. A
              degree is only worth what someone else can confirm.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/accreditation"
                className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-brand-gold px-8 py-4 font-heading text-[15px] font-bold text-brand-purple-dark shadow-gold transition duration-300 hover:bg-brand-gold-deep"
              >
                Accreditation &amp; partnership
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
              <Link
                href="/verify"
                className="group inline-flex items-center justify-center gap-2.5 rounded-full border-2 border-white/35 px-8 py-4 font-heading text-[15px] font-bold text-white transition duration-300 hover:border-brand-gold hover:text-brand-gold"
              >
                Verify a credential
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm sm:p-10">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
                Institutional partners
              </p>
              <ul className="mt-8 grid grid-cols-3 items-center gap-x-6 gap-y-8">
                {partners.map((p) => (
                  <li key={p.name} className="flex items-center justify-center">
                    <Image
                      src={p.image}
                      alt={p.name}
                      width={96}
                      height={48}
                      loading="lazy"
                      // Partner marks arrive in every colour there is. Held at a
                      // uniform brightness they read as one row of associates
                      // rather than six competing brands, and they come back to
                      // full colour on hover for anyone actually looking.
                      className="h-10 w-auto object-contain opacity-60 brightness-0 invert transition duration-500 hover:opacity-100 hover:brightness-100 hover:invert-0"
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-9 border-t border-white/10 pt-6 text-[13px] leading-relaxed text-white/55">
                Partnership indicates academic collaboration. It does not imply that any partner
                accredits this university, or that this university accredits them.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
