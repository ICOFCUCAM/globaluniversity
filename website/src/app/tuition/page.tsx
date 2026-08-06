import { Section, SectionHeading } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import Cta from '@/components/Cta';
import { getTuition } from '@/lib/data';

export const metadata = { title: 'Tuition & Costs' };

export default async function TuitionPage() {
  const tuition = await getTuition();

  return (
    <>
      <PageBanner title="Tuition & Costs" image="/images/banner.jpg" />
      <Section>
        <SectionHeading>{tuition.heading}</SectionHeading>
        <p className="mx-auto mb-10 max-w-3xl text-center text-brand-muted">{tuition.intro}</p>
        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-brand-sand bg-white shadow-lift">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-purple text-white">
              <tr>
                <th className="px-6 py-4 font-heading">Program</th>
                <th className="px-6 py-4 font-heading">Tuition</th>
              </tr>
            </thead>
            <tbody>
              {tuition.rows.map((row, i) => (
                <tr key={row.program} className={i % 2 ? 'bg-brand-cream' : ''}>
                  <td className="px-6 py-4 font-medium text-brand-purple">{row.program}</td>
                  <td className="px-6 py-4 text-brand-muted">{row.fee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-brand-muted">{tuition.bands}</p>
        {/* Two things a prospective student most needs to know about money and
            almost never finds: which currency they actually pay in, and whether
            they have to pay before they can start. */}
        <div className="mx-auto mt-8 max-w-3xl space-y-4 rounded-2xl border border-brand-sand bg-white p-6">
          <div>
            <h3 className="font-heading text-sm font-bold text-brand-purple">Paying in your own currency</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">{tuition.currency}</p>
          </div>
          <div className="border-t border-brand-sand pt-4">
            <h3 className="font-heading text-sm font-bold text-brand-purple">When you pay</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">{tuition.whenToPay}</p>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-brand-muted">{tuition.note}</p>
      </Section>
      <Cta />
    </>
  );
}
