import Image from 'next/image';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// 08 — THE EXPERIENCE. What studying here actually involves.
//
// ===========================================================================
// A MERGE OF TWO SECTIONS THAT WERE ANSWERING ONE QUESTION
// ===========================================================================
//
// STUDENT LIFE described what a week here looks like for a working adult.
// ONLINE LEARNING described the portal that delivers it. They sat six sections
// apart and between them made a reader assemble one answer from two places:
// what it is like, and how it works.
//
// They are the same question — "what am I actually signing up for" — and it is
// the question that decides whether somebody with a job and a family applies.
// One section now, in the order they would ask it: how it fits a life, then
// what you get, then how to see more.
//
// ===========================================================================
// AND A DUPLICATE THAT SURVIVED EVERY PREVIOUS PASS
// ===========================================================================
//
// The student-life band's second promise was headed "Taught by people who have
// done it" — the SAME SENTENCE, word for word, as the Professionalism panel in
// the convictions triptych. It was identified in the very first analysis of
// this page as the clearest evidence of the repetition problem, and it survived
// six rounds of redesign because both halves kept being edited in isolation and
// neither was ever the section under review.
//
// It is not restated here. The practitioner claim belongs to the motto, where
// it is a conviction; what belongs HERE is the consequence a student actually
// experiences, which is who answers when they ask a question. Same fact,
// different job, no repeated sentence.
// ---------------------------------------------------------------------------

const PROMISES = [
  {
    title: 'Study without leaving your life',
    body:
      'Online, on campus in Buea or Douala, or blended between the two. Most of our students are '
      + 'working adults, ministers and parents, and the timetable is built for people who cannot '
      + 'stop everything for three years.',
  },
  {
    // Deliberately NOT "Taught by people who have done it" — see the header.
    title: 'Your questions reach your lecturer',
    body:
      'You raise a question and the reply comes from the person teaching the course, not from an '
      + 'assistant — including after hours.',
  },
  {
    title: 'Begin the day you are admitted',
    body:
      'Admission is enrolment here. You may start studying from the date of your offer, before any '
      + 'fee is settled, so nobody loses a semester waiting on a transfer to clear.',
  },
];

const PORTAL = [
  'Live and recorded classes',
  'Assignments and submissions',
  'Computer-based examinations',
  'Automatic GPA and transcripts',
  'Fees and payment records',
  'QR-verifiable credentials',
];

export default function StudyHere() {
  return (
    <section
      data-chapter="Studying here"
      aria-labelledby="study-heading"
      className="relative z-10 overflow-hidden bg-white py-24 dark:bg-[#150f1e] sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-20">
          {/* ---- what it is like ------------------------------------------ */}
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold-ink dark:text-brand-gold">
              Studying here
            </p>
            <h2
              id="study-heading"
              className="mt-5 font-heading text-[clamp(1.9rem,4vw,3.1rem)] font-bold leading-[1.1] tracking-[-0.02em] text-brand-purple dark:text-white [text-wrap:balance]"
            >
              Built for people who cannot stop everything.
            </h2>

            <dl className="mt-12">
              {PROMISES.map((p, i) => (
                <div
                  key={p.title}
                  className={`grid gap-x-6 gap-y-2 py-7 sm:grid-cols-[auto_minmax(0,1fr)] ${
                    i > 0 ? 'border-t border-brand-purple/12 dark:border-white/12' : ''
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="font-heading text-[11px] font-bold tracking-[0.34em] text-brand-gold-ink dark:text-brand-gold/80"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <dt className="font-heading text-[19px] font-bold leading-snug text-brand-purple dark:text-white">
                      {p.title}
                    </dt>
                    <dd className="mt-2.5 text-[15px] leading-relaxed text-brand-muted dark:text-white/70">
                      {p.body}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          {/* ---- what you get, over a photograph that breaks the grid ------ */}
          <div className="relative">
            {/* The photograph runs past the right edge of the container on wide
                screens — see the negative right margin. It is a crop of a
                larger scene rather than a picture sized to a slot, which is the
                difference between an image the layout contains and an image the
                layout is built around. */}
            <div className="relative h-64 overflow-hidden sm:h-80 lg:-mr-16 lg:h-[22rem] xl:-mr-24">
              <Image
                src="/images/graduation-2024/grad-2024-registration-desk.jpg"
                alt="Students at the registration desk of ICOF Global University"
                fill
                sizes="(min-width:1024px) 45vw, 100vw"
                quality={82}
                loading="lazy"
                className="object-cover"
                style={{ objectPosition: '50% 42%' }}
              />
              <div aria-hidden="true" className="absolute inset-0 bg-brand-purple/25 mix-blend-multiply" />
            </div>

            <div className="mt-10">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-gold-ink dark:text-brand-gold">
                One portal, everything in it
              </p>
              <ul className="mt-6 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
                {PORTAL.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 text-[14.5px] leading-snug text-brand-muted dark:text-white/70"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold-ink dark:bg-brand-gold"
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/online-learning"
                  className="rounded-full bg-brand-purple px-7 py-3.5 font-heading text-[14.5px] font-bold text-white transition duration-300 hover:bg-brand-purple-dark dark:bg-brand-gold dark:text-brand-purple dark:hover:bg-brand-gold-deep"
                >
                  How online study works
                </Link>
                <Link
                  href="/campus-life"
                  className="group inline-flex items-center gap-2.5 rounded-full border-2 border-brand-purple/25 px-7 py-3.5 font-heading text-[14.5px] font-bold text-brand-purple transition duration-300 hover:border-brand-purple dark:border-white/30 dark:text-white dark:hover:border-brand-gold dark:hover:text-brand-gold"
                >
                  Campus life
                  <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
