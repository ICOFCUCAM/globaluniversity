import Image from 'next/image';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import Parallax from '@/components/Parallax';

// ---------------------------------------------------------------------------
// What it is actually like to study here.
//
// WHY IT EARNS ITS PLACE. Between "here are the faculties" and "apply" there is
// a question nobody was answering: what will my week look like. It is the
// question that decides whether a working adult with a family applies, and it
// is answered by three concrete facts about how this university runs — not by
// adjectives.
//
// Everything stated here is something the site can already substantiate
// elsewhere: the study modes are on every programme page, enrolment-on-offer is
// the admissions rule, and the instructor policy is the faculties page's own
// wording. Nothing invented, because a promise about student life is the
// promise most easily checked by the student living it.
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
    title: 'Taught by people who have done it',
    body:
      'Our instructors are practitioners first. You raise a question and the reply comes from the '
      + 'person teaching the course, not from an assistant — including after hours.',
  },
  {
    title: 'Begin the day you are admitted',
    body:
      'Admission is enrolment here. You may start studying from the date of your offer, before any '
      + 'fee is settled, so nobody loses a semester waiting on a transfer to clear.',
  },
];

export default function StudentExperience() {
  return (
    <section
      data-chapter="Student life"
      aria-labelledby="experience-heading"
      className="overflow-hidden bg-white py-24 dark:bg-[#150f1e] sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          {/* The photograph, with a slow parallax drift. Motion at this scale is
              felt rather than seen, which is the point — a page that moves
              visibly is a page competing with its own text. */}
          <Reveal>
            <Parallax className="relative aspect-[4/5] overflow-hidden rounded-2xl shadow-lift-lg sm:aspect-[5/6]">
              <Image
                src="/images/graduation-2024/grad-2024-graduands-scrolls.jpg"
                alt="Graduands seated at an ICOF Global University ceremony"
                fill
                loading="lazy"
                quality={82}
                sizes="(min-width:1024px) 46vw, 100vw"
                className="scale-[1.12] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-purple-dark/45 via-transparent to-transparent" />
            </Parallax>
          </Reveal>

          <div>
            <Reveal>
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold-deep">
                Student experience
              </p>
              <h2
                id="experience-heading"
                className="mt-4 font-heading text-display font-bold text-brand-purple dark:text-white [text-wrap:balance]"
              >
                Built around the life you already have
              </h2>
              <div className="mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
            </Reveal>

            <ul className="mt-10 space-y-9">
              {PROMISES.map((p, i) => (
                <Reveal key={p.title} delay={120 + i * 100}>
                  <li className="relative border-l-2 border-brand-sand pl-7 transition-colors duration-500 hover:border-brand-gold dark:border-white/12 dark:hover:border-brand-gold">
                    <h3 className="font-heading text-xl font-bold text-brand-purple dark:text-white">{p.title}</h3>
                    <p className="mt-2.5 leading-relaxed text-brand-muted dark:text-white/60">{p.body}</p>
                  </li>
                </Reveal>
              ))}
            </ul>

            <Reveal delay={450}>
              <div className="mt-11 flex flex-wrap gap-4">
                <Link
                  href="/campus-life"
                  className="group inline-flex items-center gap-2.5 rounded-full bg-brand-purple px-8 py-4 font-heading text-[15px] font-bold text-white shadow-lift transition duration-300 hover:bg-brand-purple-dark hover:shadow-lift-lg"
                >
                  Campus life
                  <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </Link>
                <Link
                  href="/online-learning"
                  className="group inline-flex items-center gap-2.5 rounded-full border-2 border-brand-purple px-8 py-4 font-heading text-[15px] font-bold text-brand-purple transition duration-300 hover:bg-brand-purple hover:text-white dark:border-brand-gold dark:text-brand-gold dark:hover:bg-brand-gold dark:hover:text-brand-purple-dark"
                >
                  Studying online
                  <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
