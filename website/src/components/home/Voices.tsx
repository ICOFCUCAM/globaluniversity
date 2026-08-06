import Image from 'next/image';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { STUDENT_VOICES, ALUMNI_PROFILES, type Voice } from '@/content/voices';

// ---------------------------------------------------------------------------
// Student voices and alumni.
//
// THIS SECTION RENDERS NOTHING UNTIL THERE IS SOMETHING TRUE TO PUT IN IT, and
// that is deliberate rather than unfinished. See src/content/voices.ts: a
// fabricated testimonial is a statement attributed to a person who did not make
// it, published by an institution whose whole product is attribution.
//
// Everything else is done. The layout, the typography, the fallback for a
// person who consents to be quoted but not photographed — all built. Filling in
// two arrays turns the section on.
//
// WHY THE INITIAL FALLBACK RATHER THAN A STOCK PORTRAIT. Because a stock
// photograph attached to a real person's real words is the same lie in a
// different medium, and it is the one visitors detect fastest.
// ---------------------------------------------------------------------------

function VoiceCard({ v, tone }: { v: Voice; tone: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  return (
    <figure
      className={`flex h-full flex-col rounded-2xl p-7 ring-1 transition duration-500 sm:p-8 ${
        dark
          ? 'bg-white/[0.05] ring-white/10 hover:ring-brand-gold/40'
          : 'bg-white shadow-lift ring-brand-sand/70 hover:shadow-lift-lg hover:ring-brand-gold/40 dark:bg-white/[0.04] dark:ring-white/10'
      }`}
    >
      <span
        aria-hidden="true"
        className={`font-heading text-5xl leading-none ${dark ? 'text-brand-gold/40' : 'text-brand-gold/50'}`}
      >
        &ldquo;
      </span>
      <blockquote
        className={`mt-2 flex-1 text-[17px] leading-relaxed ${dark ? 'text-white/85' : 'text-[#4a4058]'}`}
      >
        {v.quote}
      </blockquote>

      <figcaption className="mt-7 flex items-center gap-4">
        {v.image ? (
          <Image
            src={v.image}
            alt=""
            width={52}
            height={52}
            className="h-13 w-13 shrink-0 rounded-full object-cover ring-2 ring-brand-gold/40"
          />
        ) : (
          // No photograph, and no stock one either. Their initials, set in the
          // heading face, read as deliberate rather than missing.
          <span
            aria-hidden="true"
            className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-full font-heading text-base font-bold ring-2 ring-brand-gold/40 ${
              dark ? 'bg-brand-purple text-brand-gold' : 'bg-brand-cream text-brand-purple'
            }`}
          >
            {v.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('')}
          </span>
        )}
        <div className="min-w-0">
          <p className={`font-heading font-bold ${dark ? 'text-white' : 'text-brand-purple'}`}>
            {v.name}
          </p>
          <p className={`text-[13px] ${dark ? 'text-brand-gold' : 'text-brand-gold-deep'}`}>
            {v.award}
          </p>
          {v.now && (
            <p className={`text-[13px] ${dark ? 'text-white/55' : 'text-brand-muted'}`}>{v.now}</p>
          )}
        </div>
      </figcaption>
    </figure>
  );
}

export default function Voices() {
  const students = STUDENT_VOICES;
  const alumni = ALUMNI_PROFILES;
  if (students.length + alumni.length === 0) return null;

  return (
    <section
      data-chapter="Voices"
      aria-labelledby="voices-heading"
      className="bg-brand-cream py-24 dark:bg-[#181121] sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold-deep">
              In their own words
            </p>
            <h2
              id="voices-heading"
              className="mt-4 font-heading text-display font-bold text-brand-purple dark:text-white [text-wrap:balance]"
            >
              A university is judged by its graduates
            </h2>
          </div>
        </Reveal>

        {students.length > 0 && (
          <div className="mt-16 grid gap-7 sm:mt-20 md:grid-cols-2 lg:grid-cols-3">
            {students.map((v, i) => (
              <Reveal key={v.name} delay={i * 90}>
                <VoiceCard v={v} tone="light" />
              </Reveal>
            ))}
          </div>
        )}

        {alumni.length > 0 && (
          <>
            <Reveal>
              <h3 className="mt-20 text-center font-heading text-2xl font-bold text-brand-purple dark:text-white">
                Where our graduates serve
              </h3>
            </Reveal>
            <div className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {alumni.map((v, i) => (
                <Reveal key={v.name} delay={i * 90}>
                  <VoiceCard v={v} tone="light" />
                </Reveal>
              ))}
            </div>
          </>
        )}

        <Reveal delay={300}>
          <p className="mt-14 text-center">
            <Link
              href="/contact"
              className="group inline-flex items-center gap-2.5 rounded-full border-2 border-brand-purple px-8 py-4 font-heading text-[15px] font-bold text-brand-purple transition duration-300 ease-enter hover:bg-brand-purple hover:text-white active:scale-[0.98] active:duration-75 dark:border-brand-gold dark:text-brand-gold dark:hover:bg-brand-gold dark:hover:text-brand-purple-dark"
            >
              Studied here? Tell us your story
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
