import Image from 'next/image';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { CAMPUSES } from '@/content/institutionalFacts';
import { MapPin, ExternalLink, Globe2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Where the university is.
//
// WHAT THIS REPLACED. A line of place names in the top bar — "Buea · Douala ·
// Nigeria · Online Worldwide" — and nothing else. A prospective student who
// wants to know whether they can physically attend, and what it would look like
// if they did, had no page to go to and no picture to see.
//
// WHY THERE IS NO EMBEDDED GOOGLE MAP. Three reasons and the third decides it.
// An iframe map costs several hundred kilobytes and a third-party connection on
// every homepage load, for something almost nobody interacts with. It cannot be
// styled, so it lands in the middle of a purple-and-gold page as a rectangle of
// Google. And it sets cookies from another origin before the visitor has agreed
// to anything, which for an institution taking applications from the EU is a
// consent problem rather than a design one.
//
// A card with a photograph, the address and a link that opens the map where the
// visitor already has it does the same job, weighs nothing, and matches the
// page it sits in.
//
// NIGERIA IS ABSENT ON PURPOSE. The top bar lists it, but the only Nigerian
// entry anywhere in this system is a partner resource centre, PPDI-RC, and a
// partner is not a campus. Listing it here would tell an applicant they could
// attend somewhere they cannot.
// ---------------------------------------------------------------------------

export default function CampusBand() {
  return (
    <section
      data-chapter="Campuses"
      aria-labelledby="campuses-heading"
      className="bg-white py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold-deep">
              Where we are
            </p>
            <h2
              id="campuses-heading"
              className="mt-4 font-heading text-display font-bold text-brand-purple [text-wrap:balance]"
            >
              Two campuses, and one that travels with you
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-brand-muted">
              Every programme runs on campus, online, or blended between the two. You are not
              choosing a place so much as choosing how much of it you need.
            </p>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-7 sm:mt-20 lg:grid-cols-3">
          {CAMPUSES.map((c, i) => (
            <Reveal key={c.city} delay={i * 100}>
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-brand-sand/70 transition duration-500 hover:shadow-lift-lg hover:ring-brand-gold/40">
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={c.image}
                    alt=""
                    fill
                    loading="lazy"
                    quality={76}
                    sizes="(min-width:1024px) 33vw, 100vw"
                    className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.07]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-purple-dark/85 via-brand-purple-dark/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-5">
                    <span aria-hidden="true" className="mb-1 text-brand-gold">
                      {c.map ? <MapPin size={17} /> : <Globe2 size={17} />}
                    </span>
                    <div>
                      <h3 className="font-heading text-2xl font-bold leading-none text-white">
                        {c.city}
                      </h3>
                      <p className="mt-1 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
                        {c.country}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <p className="font-heading text-[15px] font-bold text-brand-purple">{c.role}</p>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-brand-muted">
                    {c.address}
                  </p>

                  {c.map ? (
                    <a
                      href={c.map}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex items-center gap-2 font-heading text-sm font-bold text-brand-purple transition hover:text-brand-gold-deep"
                    >
                      Open in maps
                      <ExternalLink size={14} aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : (
                    <Link
                      href="/online-learning"
                      className="group/l mt-5 inline-flex items-center gap-2 font-heading text-sm font-bold text-brand-purple transition hover:text-brand-gold-deep"
                    >
                      How online study works
                      <span aria-hidden="true" className="transition-transform duration-300 group-hover/l:translate-x-1">→</span>
                    </Link>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={320}>
          <p className="mt-14 text-center">
            <Link
              href="/campus-life"
              className="group inline-flex items-center gap-2.5 rounded-full bg-brand-purple px-8 py-4 font-heading text-[15px] font-bold text-white shadow-lift transition duration-300 hover:bg-brand-purple-dark hover:shadow-lift-lg"
            >
              Campus life
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
