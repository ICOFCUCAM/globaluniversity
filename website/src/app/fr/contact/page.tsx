import type { Metadata } from 'next';
import { IconCampus, IconLaptop, IconLibrary, IconMail, IconSignal } from '@/components/Icons';
import PageBanner from '@/components/PageBanner';
import { Section } from '@/components/Section';
import { fr } from '@/content/fr';

export const metadata: Metadata = {
  title: 'Contact — Université Mondiale ICOF',
  description: fr.contact.intro,
  alternates: { canonical: '/fr/contact', languages: { en: '/contact', fr: '/fr/contact' } },
};

const CARDS = [
  { Icon: IconSignal, label: fr.contact.phoneLabel, value: '+237 675 133 426', href: 'tel:+237675133426' },
  { Icon: IconMail, label: fr.contact.emailLabel, value: 'info@iguc.net', href: 'mailto:info@iguc.net' },
  { Icon: IconLibrary, label: fr.contact.admissionsLabel, value: 'admissions@iguc.net', href: 'mailto:admissions@iguc.net' },
  { Icon: IconMail, label: 'WhatsApp', value: 'Discuter avec nous', href: 'https://wa.me/237675133426' },
  {
    Icon: IconCampus,
    label: fr.contact.addressLabel,
    value: fr.contact.address,
    href: 'https://maps.google.com/?q=Bulu+Blind+Junction+Buea+Cameroon',
  },
  { Icon: IconLaptop, label: fr.common.studentPortal, value: 'Se connecter', href: '/portal' },
];

export default function FrContact() {
  return (
    <>
      <PageBanner title={fr.contact.title} subtitle={fr.contact.subtitle} image="/images/global.jpg" />
      <Section>
        <p className="mx-auto mb-12 max-w-2xl text-center leading-relaxed text-brand-muted">
          {fr.contact.intro}
        </p>
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              className="rounded-2xl border-t-4 border-brand-gold bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <p aria-hidden="true" className=" mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-cream text-brand-purple ring-1 ring-brand-sand"><c.Icon className="h-6 w-6" /></p>
              <h2 className="mt-3 font-heading font-semibold text-brand-purple">{c.label}</h2>
              <span className="mt-2 block text-sm text-brand-gold-deep">{c.value}</span>
            </a>
          ))}
        </div>
      </Section>
    </>
  );
}
