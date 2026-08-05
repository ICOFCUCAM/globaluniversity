import Image from 'next/image';
import Link from 'next/link';
import { site } from '@/content/site';
import Crest from './Crest';
import { Aurora, Grain, Seam } from './Atmosphere';

export default function Footer() {
  return (
    <footer className="relative text-white">
      {/* Building background, as on the original site's footer */}
      <Image
        src="/images/wp/footer-building.jpg"
        alt=""
        fill
        loading="lazy"
        quality={55}
        className="object-cover"
        sizes="100vw"
      />
      {/* Same ordering rule as the CTA band: atmosphere first, scrim over it. */}
      <Aurora tone="purple" intensity={0.3} fields={2} />
      <div className="absolute inset-0 bg-brand-purple-dark/90" />
      <Grain opacity={0.05} />
      <Seam />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <Crest size={48} />
            <span className="font-heading font-bold">{site.name}</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/75">{site.description}</p>
        </div>

        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-gold after:mt-3 after:block after:h-[2px] after:w-8 after:rounded-full after:bg-brand-gold/40">
            Explore
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            {site.nav.map((item) => (
              <li key={item.href + item.label}>
                <Link href={item.href} className="inline-block bg-gradient-to-r from-brand-gold to-brand-gold bg-[length:0%_1px] bg-left-bottom bg-no-repeat text-white/80 transition-[background-size,color] duration-300 hover:bg-[length:100%_1px] hover:text-brand-gold">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/courses" className="inline-block bg-gradient-to-r from-brand-gold to-brand-gold bg-[length:0%_1px] bg-left-bottom bg-no-repeat text-white/80 transition-[background-size,color] duration-300 hover:bg-[length:100%_1px] hover:text-brand-gold">
                Course Catalogue
              </Link>
            </li>
            <li>
              <Link href="/research" className="inline-block bg-gradient-to-r from-brand-gold to-brand-gold bg-[length:0%_1px] bg-left-bottom bg-no-repeat text-white/80 transition-[background-size,color] duration-300 hover:bg-[length:100%_1px] hover:text-brand-gold">
                Research
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-gold after:mt-3 after:block after:h-[2px] after:w-8 after:rounded-full after:bg-brand-gold/40">
            Student Portals
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            {site.portals.map((p) => (
              <li key={p.href}>
                <a href={p.href} className="inline-block bg-gradient-to-r from-brand-gold to-brand-gold bg-[length:0%_1px] bg-left-bottom bg-no-repeat text-white/80 transition-[background-size,color] duration-300 hover:bg-[length:100%_1px] hover:text-brand-gold">
                  {p.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-gold after:mt-3 after:block after:h-[2px] after:w-8 after:rounded-full after:bg-brand-gold/40">
            Get in Touch
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li>{site.address}</li>
            <li>
              <a href={`tel:${site.phone.replace(/\s/g, '')}`} className="hover:text-brand-gold">
                {site.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className="hover:text-brand-gold">
                {site.email}
              </a>
            </li>
            <li>
              <a href="mailto:admission@iguc.net" className="hover:text-brand-gold">
                admission@iguc.net
              </a>
            </li>
          </ul>
          <p className="mt-4 text-xs text-white/60">{site.affiliation}</p>
        </div>
      </div>
      <div className="relative border-t border-white/10 py-5 text-center text-xs text-white/60">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href="/apply" className="hover:text-brand-gold">Apply Now</Link>
          <Link href="/portal" className="hover:text-brand-gold">Student Portal</Link>
          <Link href="/verify" className="hover:text-brand-gold">Verify a Credential</Link>
          <Link href="/news" className="hover:text-brand-gold">News</Link>
          <Link href="/careers" className="hover:text-brand-gold">Careers</Link>
          <Link href="/fr" hrefLang="fr" className="hover:text-brand-gold">Français</Link>
          <Link href="/privacy-policy" className="hover:text-brand-gold">Privacy Policy</Link>
        </div>
        <p>© {new Date().getFullYear()} {site.name} · A Global University · Buea · Douala · Nigeria · Online Worldwide</p>
      </div>
    </footer>
  );
}
