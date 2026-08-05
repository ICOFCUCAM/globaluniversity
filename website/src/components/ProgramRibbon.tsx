import Link from 'next/link';
import { Seam } from './Atmosphere';

/**
 * ProgramRibbon — a continuously travelling band of program names.
 *
 * The list is duplicated once and the track translated -50%, so the loop is
 * seamless with no JS measuring anything. `[--dur]` lets the caller tune
 * speed; the two rows run at different speeds and opposite directions, which
 * is what stops it reading as a stock ticker.
 *
 * Hovering pauses the track — a moving list you cannot click is hostile.
 */
export default function ProgramRibbon({ items }: { items: { label: string; href: string }[] }) {
  const row = (reverse: boolean, dur: string) => (
    <div className="group flex overflow-hidden" style={{ ['--dur' as string]: dur }}>
      <div
        className={`flex shrink-0 items-center gap-6 pr-6 sm:gap-10 sm:pr-10 ${
          reverse ? 'animate-marquee-rev' : 'animate-marquee'
        } group-hover:[animation-play-state:paused]`}
      >
        {[...items, ...items].map((it, i) => (
          <Link
            key={`${it.label}-${i}`}
            href={it.href}
            aria-hidden={i >= items.length}
            tabIndex={i >= items.length ? -1 : 0}
            className="flex shrink-0 items-center gap-6 font-heading text-lg font-bold text-white/25 transition-colors duration-300 hover:text-brand-gold sm:gap-10 sm:text-[2rem]"
          >
            {it.label}
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-gold/40" />
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <section
      aria-label="Fields of study"
      className="relative overflow-hidden bg-brand-purple-dark py-8 sm:py-12"
      // Feather both ends so names dissolve rather than clip at the edge.
      style={{
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
        maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
      }}
    >
      <Seam />
      <div className="space-y-5">
        {row(false, '52s')}
        {row(true, '68s')}
      </div>
    </section>
  );
}
