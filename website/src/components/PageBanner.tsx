import Image from 'next/image';
import { Aurora, Grain, LightShaft, Seam } from './Atmosphere';

/**
 * The banner every interior page opens on — nineteen of them.
 *
 * Upgrading this one component carries the design language introduced on the
 * home page across the whole site: the atmosphere stack, the spectral headline
 * clipped to the brand's own two colours, and the luminous seam that joins the
 * band to whatever follows.
 *
 * `eyebrow` is optional and sits above the title as a small gold chip — useful
 * where a page needs to say what kind of thing it is before saying its name.
 */
export default function PageBanner({
  title,
  subtitle,
  image,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  image: string;
  eyebrow?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-brand-purple-dark py-24 text-center text-white sm:py-28">
      <Image
        src={image}
        alt=""
        fill
        priority
        quality={70}
        className="object-cover opacity-25"
        sizes="100vw"
      />
      <Aurora tone="dual" intensity={0.5} fields={2} />
      <LightShaft />
      {/* Scrim goes over the atmosphere, never under it — the aurora's purple
          is lighter than this ground and would wash the band out. */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-purple-dark/85 via-brand-purple/55 to-brand-purple-dark/95" />
      <Grain />
      <Seam flip />

      <div className="relative mx-auto max-w-3xl px-4">
        {eyebrow && (
          <p className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold backdrop-blur-sm">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
            {eyebrow}
          </p>
        )}
        <h1 className="font-heading text-display-lg font-bold text-transparent [text-wrap:balance] [background-image:linear-gradient(175deg,#ffffff_38%,#f7e6b4_78%,#e9c14a_100%)] [background-clip:text] [-webkit-background-clip:text]">
          {title}
        </h1>
        <div className="mx-auto mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
        {subtitle && (
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/85">{subtitle}</p>
        )}
      </div>
    </section>
  );
}
