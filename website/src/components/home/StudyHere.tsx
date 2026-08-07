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

// THREE WORDS AND A LINE EACH.
//
// This carried three full promises at three sentences apiece and a six-item
// list of portal capabilities — live classes, assignments, examinations, GPA,
// fees, credentials. All of it true and all of it the Online Learning page.
//
// A reader on the homepage is not choosing a virtual learning environment.
// They are asking whether a university built for full-time nineteen-year-olds
// has any room for them, and that is answered in three words. The detail is one
// click away, where somebody who has decided to look will actually read it.
const PROMISES = [
  {
    word: 'Flexible',
    body: 'Online, on campus in Buea or Douala, or blended — built for people who cannot stop everything for three years.',
  },
  {
    // Deliberately NOT "Taught by people who have done it" — see the header.
    word: 'Personal',
    body: 'Your questions reach the person teaching the course, not an assistant.',
  },
  {
    word: 'Global',
    body: 'Begin the day you are admitted, from wherever you already are.',
  },
];

export default function StudyHere() {
  return (
    <section
      data-chapter="Studying here"
      aria-labelledby="study-heading"
      className="relative z-10 overflow-hidden bg-white py-24 dark:bg-[#150f1e] sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.85fr)] lg:gap-20">
          {/* ---- what it is like ------------------------------------------ */}
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold-ink dark:text-brand-gold">
              Studying here
            </p>
            <h2
              id="study-heading"
              className="mt-5 font-heading text-[clamp(1.9rem,4vw,3.1rem)] font-bold leading-[1.1] tracking-[-0.02em] text-brand-purple dark:text-white [text-wrap:balance]"
            >
              Designed around your life.
            </h2>

            <dl className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-3">
              {PROMISES.map((p) => (
                <div key={p.word} className="border-t border-brand-purple/15 pt-6 dark:border-white/15">
                  <dt className="font-heading text-[19px] font-bold leading-snug text-brand-purple dark:text-white">
                    {p.word}
                  </dt>
                  <dd className="mt-3 text-[14.5px] leading-relaxed text-brand-muted dark:text-white/70">
                    {p.body}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="/online-learning"
                className="group inline-flex items-center gap-3 border-b border-brand-gold-deep pb-1 font-heading text-[15px] font-bold text-brand-gold-ink transition duration-300 hover:text-brand-purple dark:border-brand-gold/40 dark:text-brand-gold dark:hover:text-white"
              >
                How online study works
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
              <Link
                href="/campus-life"
                className="group inline-flex items-center gap-3 border-b border-brand-purple/25 pb-1 font-heading text-[15px] font-bold text-brand-purple transition duration-300 hover:border-brand-gold-ink hover:text-brand-gold-ink dark:border-white/25 dark:text-white/85 dark:hover:text-brand-gold"
              >
                Campus life
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>

          {/* The photograph, now the whole second cell. It runs past the right
              edge of the container on wide screens — a crop of a larger scene
              rather than a picture sized to a slot. */}
          <div className="relative h-72 overflow-hidden sm:h-96 lg:-mr-16 lg:h-full lg:min-h-[26rem] xl:-mr-24">
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
        </div>
      </div>
    </section>
  );
}
