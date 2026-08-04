import { Section, SectionHeading } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import { getContact, getSite } from '@/lib/data';

export const metadata = { title: 'Contact' };

export default async function ContactPage() {
  const contact = await getContact();
  const site = await getSite();

  return (
    <>
      <PageBanner title="Contact Us" image="/images/global.jpg" />
      <Section>
        <SectionHeading>{contact.heading}</SectionHeading>
        <p className="mx-auto mb-12 max-w-2xl text-center text-brand-muted">{contact.intro}</p>
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          <div className="rounded-xl border-t-4 border-brand-gold bg-white p-6 text-center shadow-sm">
            <p className="text-3xl">✉️</p>
            <h3 className="mt-3 font-heading font-semibold text-brand-purple">Admissions</h3>
            <a href={`mailto:${contact.email}`} className="mt-2 block text-sm text-brand-gold-deep">
              {contact.email}
            </a>
          </div>
          <div className="rounded-xl border-t-4 border-brand-gold bg-white p-6 text-center shadow-sm">
            <p className="text-3xl">📝</p>
            <h3 className="mt-3 font-heading font-semibold text-brand-purple">Apply Online</h3>
            <a href="/apply" className="mt-2 block text-sm text-brand-gold-deep">
              Free Online Application
            </a>
          </div>
          <div className="rounded-xl border-t-4 border-brand-gold bg-white p-6 text-center shadow-sm">
            <p className="text-3xl">💻</p>
            <h3 className="mt-3 font-heading font-semibold text-brand-purple">E-Learning</h3>
            <a href="/portal" className="mt-2 block text-sm text-brand-gold-deep">
              Student Portal Login
            </a>
          </div>
        </div>
        <div className="mx-auto mt-8 grid max-w-4xl gap-6 sm:grid-cols-3">
          <div className="rounded-xl border-t-4 border-brand-gold bg-white p-6 text-center shadow-sm">
            <p className="text-3xl">📞</p>
            <h3 className="mt-3 font-heading font-semibold text-brand-purple">Call Us 24×7</h3>
            <a href="tel:+237675133426" className="mt-2 block text-sm text-brand-gold-deep">+237 675 133 426</a>
          </div>
          <div className="rounded-xl border-t-4 border-brand-gold bg-white p-6 text-center shadow-sm">
            <p className="text-3xl">💬</p>
            <h3 className="mt-3 font-heading font-semibold text-brand-purple">WhatsApp</h3>
            <a href="https://wa.me/237675133426" className="mt-2 block text-sm text-brand-gold-deep">Chat with us</a>
          </div>
          <div className="rounded-xl border-t-4 border-brand-gold bg-white p-6 text-center shadow-sm">
            <p className="text-3xl">📍</p>
            <h3 className="mt-3 font-heading font-semibold text-brand-purple">Headquarters</h3>
            <a
              href="https://maps.google.com/?q=Bulu+Blind+Junction+Buea+Cameroon"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-sm text-brand-gold-deep"
            >
              Opposite Bulu Blind Junction, Buea-Cameroon
            </a>
          </div>
        </div>
        <p className="mt-10 text-center text-sm text-brand-muted">{site.affiliation}</p>
      </Section>
    </>
  );
}
