import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';
import Cta from '@/components/Cta';
import {
  accreditationPurpose, eligibleInstitutions, accreditationServices,
  accreditationStandards, accreditationProcess, accreditationBenefits,
  independenceUnaffected, statutoryAuthority, ACCREDITATION_EMAIL,
} from '@/content/accreditation';

export const metadata: Metadata = {
  title: 'Accreditation and Institutional Partnership — ICOF Global University',
  description:
    'ICOF Global University provides institutional accreditation, academic validation, quality assurance and academic partnership services to eligible theological and Christian higher education institutions.',
  alternates: { canonical: '/accreditation' },
};

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
      {items.map((i) => (
        <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-[#4a4058]">
          <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1px] bg-brand-gold-deep" />
          {i}
        </li>
      ))}
    </ul>
  );
}

export default function AccreditationPage() {
  return (
    <>
      <section className="bg-brand-purple py-20 text-white sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
            Office of Accreditation
          </p>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-tight sm:text-5xl [text-wrap:balance]">
            Accreditation and Institutional Partnership
          </h1>
          <div className="mx-auto mt-5 h-[3px] w-16 rounded bg-brand-gold" />
          <p className="mt-6 text-lg text-white/85">Advancing excellence in theological education</p>
        </div>
      </section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="text-[17px] leading-relaxed text-[#4a4058]">
            ICOF Global University is committed to strengthening theological education by promoting
            academic excellence, institutional accountability and leadership development throughout
            Africa and the global Christian community. Alongside its own academic programmes, the
            University provides <strong>institutional accreditation, academic validation, quality
            assurance and academic partnership services</strong> to eligible theological colleges,
            Bible schools, seminaries, ministry training centres and Christian higher education
            institutions.
          </p>
          <p className="mt-5 leading-relaxed text-[#4a4058]">
            Through this framework the University assists institutions in developing internationally
            recognised academic standards while preserving their individual missions, doctrinal
            traditions and denominational identities.
          </p>

          {/* Where the authority comes from, named — or an honest account of what
              this is instead. A page that asserts authority without naming its
              source asserts nothing a ministry or an evaluator can check, and
              those are exactly the readers who will check. */}
          <div className="mt-8 rounded-xl border-l-4 border-brand-gold bg-[#faf7f0] p-5">
            {statutoryAuthority.length > 0 ? (
              <>
                <h2 className="font-heading text-base font-bold text-brand-purple">
                  Authority under which this is offered
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-[#4a4058]">
                  {statutoryAuthority.map((a) => (
                    <li key={a.jurisdiction}>
                      <strong>{a.jurisdiction}</strong> — {a.instrument}, since {a.since}.
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h2 className="font-heading text-base font-bold text-brand-purple">
                  What this is, and what it is not
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#5b5168]">
                  These are academic quality assurance and partnership services offered by one
                  institution to another. They are <strong>not</strong> a substitute for
                  accreditation by a national accrediting agency or a ministry of education, and
                  ICOF Global University does not represent itself as such an agency. Institutions
                  should continue to meet the statutory requirements of the jurisdictions in which
                  they operate.
                </p>
              </>
            )}
          </div>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="mx-auto max-w-3xl">
          <SectionHeading>Our vision</SectionHeading>
          <p className="mt-4 text-center text-[17px] italic leading-relaxed text-[#4a4058]">
            To build a network of academically sound, spiritually vibrant and globally respected
            Christian institutions that equip leaders to serve the Church and society with
            excellence.
          </p>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-4xl">
          <SectionHeading>The purpose of accreditation</SectionHeading>
          <p className="mt-4 leading-relaxed text-[#4a4058]">
            Accreditation is a formal process through which the University evaluates an
            institution&rsquo;s academic quality, governance, faculty qualifications, curriculum,
            student services and operational standards against established benchmarks. Its purpose
            is to:
          </p>
          <Bullets items={accreditationPurpose} />
        </div>
      </Section>

      <Section className="bg-white">
        <div className="mx-auto max-w-4xl">
          <SectionHeading>Who may apply</SectionHeading>
          <p className="mt-4 leading-relaxed text-[#4a4058]">
            Applications are welcomed from institutions in Africa and other regions, provided they
            satisfy the University&rsquo;s eligibility requirements:
          </p>
          <Bullets items={eligibleInstitutions} />
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-5xl">
          <SectionHeading>Services</SectionHeading>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {accreditationServices.map((s) => (
              <article key={s.name} className="rounded-xl border border-[#e6ddcb] bg-white p-5">
                <h3 className="font-heading text-lg font-bold text-brand-purple">{s.name}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#5b5168]">{s.what}</p>
              </article>
            ))}
          </div>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="mx-auto max-w-4xl">
          <SectionHeading>Standards</SectionHeading>
          <p className="mt-4 leading-relaxed text-[#4a4058]">
            Institutions are evaluated against standards covering:
          </p>
          <Bullets items={accreditationStandards} />
          <p className="mt-6 rounded-lg bg-[#faf7f0] p-4 text-sm leading-relaxed text-[#5b5168]">
            Accreditation is based on <strong>evidence and continuous improvement</strong>, not on
            denomination or ecclesiastical affiliation.
          </p>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-5xl">
          <SectionHeading>The process</SectionHeading>
          <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accreditationProcess.map((p) => (
              <li key={p.step} className="rounded-xl border border-[#e6ddcb] bg-white p-5">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold">
                  Step {p.step}
                </p>
                <h3 className="mt-1.5 font-heading text-lg font-bold text-brand-purple">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5b5168]">{p.what}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-2xl font-bold text-brand-purple">Benefits</h2>
            <ul className="mt-5 space-y-2.5">
              {accreditationBenefits.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-[#4a4058]">
                  <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1px] bg-brand-gold-deep" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-heading text-2xl font-bold text-brand-purple">
              Institutional independence
            </h2>
            <p className="mt-4 leading-relaxed text-[#4a4058]">
              The University recognises the diversity of Christian traditions and respects the
              autonomy of partner institutions. Accreditation does not alter an institution&rsquo;s:
            </p>
            <ul className="mt-4 space-y-2">
              {independenceUnaffected.map((i) => (
                <li key={i} className="flex items-start gap-2.5 text-[15px] text-[#4a4058]">
                  <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1px] bg-brand-gold-deep" />
                  {i}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[15px] leading-relaxed text-[#4a4058]">
              It affirms that the institution has demonstrated an appropriate level of academic
              quality, administrative effectiveness and commitment to continuous improvement.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading>Apply for accreditation</SectionHeading>
          <p className="mt-4 leading-relaxed text-[#4a4058]">
            Institutions seeking accreditation or academic partnership are invited to contact the
            Office of Accreditation for a preliminary consultation.
          </p>
          <div className="mt-6 rounded-xl border border-[#e6ddcb] bg-white p-6">
            <p className="font-heading text-lg font-bold text-brand-purple">Office of Accreditation</p>
            <p className="mt-1 text-sm text-[#5b5168]">ICOF Global University</p>
            <Link
              href={`mailto:${ACCREDITATION_EMAIL}`}
              className="mt-3 inline-block font-sans text-sm font-semibold text-brand-purple underline"
            >
              {ACCREDITATION_EMAIL}
            </Link>
          </div>
        </div>
      </Section>

      <Cta />
    </>
  );
}
