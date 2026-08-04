import Image from 'next/image';
import Link from 'next/link';
import { site } from '@/content/site';

export default function Footer() {
  return (
    <footer className="bg-brand-purple-dark text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/images/site-icon.png"
              alt={`${site.name} crest`}
              width={48}
              height={48}
              className="rounded-full bg-white/90 p-0.5"
            />
            <span className="font-heading font-bold">{site.name}</span>
          </div>
          <p className="mt-4 text-sm text-white/70">{site.affiliation}</p>
        </div>

        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-gold">
            Explore
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            {site.nav.slice(1).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-white/80 hover:text-brand-gold">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-gold">
            Student Portals
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            {site.portals.map((p) => (
              <li key={p.href}>
                <a href={p.href} className="text-white/80 hover:text-brand-gold">
                  {p.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-brand-gold">
            Contact
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li>
              <a href={`mailto:${site.email}`} className="hover:text-brand-gold">
                {site.email}
              </a>
            </li>
            <li>
              <a href={site.url} className="hover:text-brand-gold">
                iguc.net
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {site.name}. All rights reserved.
      </div>
    </footer>
  );
}
