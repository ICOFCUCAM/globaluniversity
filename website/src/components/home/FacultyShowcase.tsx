import Image from 'next/image';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { FACULTIES, programmesByFaculty } from '@/content/programmeCatalogue';

// ---------------------------------------------------------------------------
// The faculties, as places rather than as a list.
//
// WHAT THIS REPLACED. Four small tiles with a name under each and nowhere to go.
// A faculty is the unit a prospective student actually chooses — they do not
// arrive wanting "a degree", they arrive wanting to teach, or to preach, or to
// build software — and the homepage gave each of them a caption.
//
// WHAT MAKES A CARD WORTH CLICKING. Three things this had none of: a
// photograph large enough to carry an atmosphere, a sentence saying what the
// faculty is FOR rather than what it is called, and a count so the visitor
// knows whether there is enough there for them. The count is read from the
// catalogue, so it cannot disagree with the page it links to.
//
// WHY THE IMAGE SCALES AND THE CARD DOES NOT. Lifting a whole card on hover
// moves the text, which is a small readability cost paid on every mouse
// movement. Scaling only the photograph inside a fixed frame gives the same
// aliveness and the type never moves.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// A NOTE ON ACADEMIC TITLES.
//
// This site used to say, in four places, that "our professors are called
// instructors because rather than professing knowledge, they have lived it."
// It was meant as a compliment to practitioners and it did the opposite of what
// it intended.
//
// It is also contradicted by the university's own roster. Of twenty-five named
// academic and administrative staff on this site, EIGHT already hold the title
// Professor and nine more are Doctors or Bishops. The sentence apologised for
// an absence that is not there.
//
// The point worth keeping — that the people teaching here have practised what
// they teach — is now made as a positive claim about experience, without
// declining a rank the faculty actually hold. Recognised academic ranks are
// used where they apply: Professor, Associate Professor, Senior Lecturer,
// Lecturer, Instructor.
// ---------------------------------------------------------------------------

// THE UNIVERSITY'S OWN PHOTOGRAPHS, NOT STOCK.
//
// These four cards carried the images the WordPress theme shipped with: word
// clouds reading "theology", "management" and "education", and a close-up of a
// circuit board. A word cloud is the least prestigious image an institution can
// put on its own faculty — it says there was no photograph, and by extension
// that there may have been nothing to photograph.
//
// What is here instead is the 2024 congregation: real graduands, real robes,
// people who were actually in the hall. Authentic photography of a modest
// ceremony outranks polished stock of nothing, every time.
//
// THE HONEST LIMITATION, recorded rather than hidden: these are all ceremony
// photographs, so the four faculties are differentiated by their words and not
// by their pictures. Nothing in the library shows engineering being taught, or
// a business seminar, or a classroom. Commissioning one teaching photograph per
// faculty is the single highest-value change available to this page, and it is
// a change only the university can make.
const IMAGES: Record<string, string> = {
  theology: '/images/graduation-2024/grad-2024-doctoral-portrait.jpg',
  education: '/images/graduation-2024/grad-2024-graduands-group.jpg',
  business: '/images/graduation-2024/grad-2024-masters-caps.jpg',
  engineering: '/images/students.jpg',
};

export default function FacultyShowcase() {
  return (
    <section
      data-chapter="Faculties"
      aria-labelledby="faculties-heading"
      className="bg-brand-cream py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold-deep">
              Schools &amp; faculties
            </p>
            <h2
              id="faculties-heading"
              className="mt-4 font-heading text-display font-bold text-brand-purple [text-wrap:balance]"
            >
              Four faculties. One standard.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-brand-muted">
              Our faculty teach what they have practised — in pulpits, classrooms, laboratories and
              boardrooms — and hold the qualifications to examine it. Every faculty is built on that
              double standard: scholarship that has been tested somewhere real.
            </p>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-7 sm:mt-20 sm:grid-cols-2">
          {FACULTIES.map((f, i) => {
            const count = programmesByFaculty(f.id).length;
            return (
              <Reveal key={f.id} delay={i * 90}>
                <article className="group relative h-full overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-brand-sand/70 transition duration-500 hover:shadow-lift-lg hover:ring-brand-gold/40">
                  <div className="relative h-56 overflow-hidden sm:h-60">
                    <Image
                      src={IMAGES[f.id] ?? '/images/campus-global.jpg'}
                      alt=""
                      fill
                      loading="lazy"
                      quality={78}
                      sizes="(min-width:640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.07]"
                    />
                    {/* Warm rather than grey: the palette is purple and gold and
                        a neutral scrim over a photograph reads as a different
                        brand from everything around it. */}
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-purple-dark/85 via-brand-purple-dark/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
                        {count} programme{count === 1 ? '' : 's'}
                      </p>
                      <h3 className="mt-1.5 font-heading text-2xl font-bold leading-tight text-white [text-wrap:balance]">
                        <Link href={`/faculty`} className="transition group-hover:text-brand-gold">
                          <span className="absolute inset-0" aria-hidden="true" />
                          {f.name}
                        </Link>
                      </h3>
                    </div>
                  </div>

                  <div className="p-6 sm:p-7">
                    <p className="text-[15px] italic leading-relaxed text-brand-purple/80">
                      {f.mission}
                    </p>
                    <p className="mt-4 leading-relaxed text-brand-muted">{f.blurb}</p>
                    <p className="mt-6 inline-flex items-center gap-2 font-heading text-sm font-bold text-brand-purple">
                      Explore the faculty
                      <span
                        aria-hidden="true"
                        className="transition-transform duration-300 group-hover:translate-x-1.5"
                      >
                        →
                      </span>
                    </p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
