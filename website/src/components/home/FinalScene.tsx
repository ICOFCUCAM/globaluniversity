import Link from 'next/link';
import FixedWindow from './FixedWindow';
import { cta } from '@/content/site';

// ---------------------------------------------------------------------------
// THE LAST SCENE — your future starts here.
//
// ===========================================================================
// WHY THIS IS A SEPARATE COMPONENT AND NOT A CHANGE TO Cta
// ===========================================================================
//
// src/components/Cta.tsx closes eighteen pages. Rebuilding it as a
// full-viewport photographic scene would put a 132svh band at the foot of the
// contact page, the privacy notice and every faculty page — which is not a
// closing statement, it is a wall. A homepage earns a cinematic ending because
// the reader has just been taken through a story; a policy page has not earned
// one and should not pretend to.
//
// So Cta is untouched and still closes those eighteen pages. This closes one.
// The words are the same words — cta.title and cta.button come from
// src/content/site.ts, so the university edits its call to action in one place
// and both endings follow.
//
// ===========================================================================
// WHY THE PHOTOGRAPH IS FAMILIES AND NOT A BUILDING
// ===========================================================================
//
// The obvious choice for a closing frame is the campus: a building says
// permanence, and permanence is what an institution wants to project at the
// moment it asks for an application.
//
// It is the wrong argument. Nobody enrols because a university owns a building.
// They enrol because of what happens to a person who finishes — and this
// photograph is exactly that: graduates in doctoral robes standing with the
// families who came to watch, one of them holding flowers somebody brought.
// The reader deciding whether to apply is being shown the end of the road
// rather than the institution that owns it.
//
// It is also, plainly, the university's own 2024 congregation. No stock, no
// borrowed campus, nobody who was not there.
// ---------------------------------------------------------------------------

export default function FinalScene() {
  return (
    <FixedWindow
      src="/images/graduation-2024/grad-2024-graduands-celebrating.jpg"
      alt="Graduates of ICOF Global University with their families after the 2024 congregation"
      anchor="centre"
      focal="50% 34%"
      exposure={0.46}
      height={120}
      chapter="Apply"
    >
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
        11 — Your future
      </p>

      <h2 className="mt-8 font-heading text-[clamp(2.6rem,7vw,5.4rem)] font-bold leading-[1.02] tracking-[-0.03em] text-white [text-wrap:balance]">
        {cta.title}
      </h2>

      <p className="mx-auto mt-8 max-w-2xl text-[15px] leading-relaxed text-white/90 sm:text-lg">
        {cta.text}
      </p>

      <div className="mt-12 flex flex-wrap items-center justify-center gap-5">
        <Link
          href={cta.button.href}
          className="rounded-full bg-brand-gold px-9 py-4 font-heading text-[15px] font-bold text-brand-purple shadow-gold transition duration-300 hover:bg-brand-gold-deep"
        >
          {cta.button.label}
        </Link>
        <Link
          href="/contact"
          className="rounded-full border-2 border-white/55 px-9 py-4 font-heading text-[15px] font-bold text-white transition duration-300 hover:border-brand-gold hover:text-brand-gold"
        >
          Talk to an adviser
        </Link>
      </div>

      {/* The one line of reassurance that belongs at the point of decision, and
          the only place on this page the accreditation is repeated — because a
          reader about to fill in a form is entitled to it here even though the
          claim is made in full further up. */}
      <p className="mt-10 font-sans text-[12.5px] text-white/70">
        Accredited by the Ministry of Higher Education since 2007 · Buea · Douala · Nigeria · Online worldwide
      </p>
    </FixedWindow>
  );
}
