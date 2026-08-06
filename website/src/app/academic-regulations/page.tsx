import type { Metadata } from 'next';
import Link from 'next/link';
import PageBanner from '@/components/PageBanner';
import { site } from '@/content/site';
import {
  gradeScale,
  passMark,
  specialGrades,
  courseClassification,
  gpaRule,
  loadRules,
  doctoralFields,
  assessmentSchemes,
  miscellaneousFees,
  miscellaneousFeesTotal,
  usdConversionRate,
  paymentTerms,
  feeBands,
  feeBandNote,
  sponsorTerms,
  refundSchedule,
  withdrawalRules,
  scholarshipRules,
  sourceNotes,
} from '@/content/regulations';

export const metadata: Metadata = {
  title: 'Academic Regulations — ICOF Global University',
  description:
    'Grading scale, grade points, special grades, course classification, GPA, study loads, assessment weightings, fees, withdrawal and the refund schedule at ICOF Global University.',
  alternates: { canonical: '/academic-regulations' },
};

const PARTS = [
  { id: 'grading', n: 'I', title: 'Grading and Grade Points' },
  { id: 'classification', n: 'II', title: 'Course Classification and GPA' },
  { id: 'load', n: 'III', title: 'Study Load, Seminars and Entry Standards' },
  { id: 'assessment', n: 'IV', title: 'Assessment' },
  { id: 'fees', n: 'V', title: 'Fees and Payment' },
  { id: 'withdrawal', n: 'VI', title: 'Withdrawal and Refunds' },
  { id: 'scholarships', n: 'VII', title: 'Scholarships and Bursaries' },
  { id: 'notes', n: 'VIII', title: 'Editorial Notes on the Source Documents' },
];

function Part({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="catalog-part scroll-mt-28 border-t border-brand-sand pt-12">
      <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-brand-gold-deep">Part {n}</p>
      <h2 className="mt-2 font-heading text-3xl font-bold text-brand-purple [text-wrap:balance]">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-10 font-heading text-xl font-bold text-brand-purple first:mt-0">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-[15px] leading-[1.75] text-brand-muted">{children}</p>;
}

function Rules({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-3">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-[15px] leading-relaxed text-brand-muted">
          <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-brand-gold-deep" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border border-brand-sand">
      <table className="w-full min-w-[30rem] text-left text-[15px]">
        <thead className="bg-brand-cream">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-5 py-3 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold-deep">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-sand/70">{children}</tbody>
      </table>
    </div>
  );
}

export default function AcademicRegulationsPage() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: 'Academic Regulations',
    url: `${site.url}/academic-regulations`,
    publisher: { '@id': `${site.url}/#organization` },
    about: { '@type': 'CollegeOrUniversity', name: site.name, url: site.url },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner
        title="Academic Regulations"
        subtitle="Grading, assessment, study load, fees, withdrawal and refunds — the rules a student may rely on."
        image="/images/hall.jpg"
        eyebrow="Nobility, Professionalism and Godliness"
      />

      <div className="border-b border-brand-sand bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 py-5 sm:px-6">
          <a href="#contents" className="rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white shadow-lift transition hover:bg-brand-purple-dark">
            Contents
          </a>
          <Link href="/academic-catalog" className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white">
            Academic Catalog
          </Link>
          <Link href="/tuition" className="rounded-full border-2 border-brand-sand px-7 py-3 font-heading text-sm font-semibold text-brand-muted transition hover:border-brand-gold hover:text-brand-purple">
            Tuition &amp; Fees
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <nav id="contents" className="scroll-mt-28 rounded-2xl border border-brand-sand bg-brand-cream p-7">
          <h2 className="font-heading text-xl font-bold text-brand-purple">Contents</h2>
          <ol className="mt-5 divide-y divide-brand-sand/70">
            {PARTS.map((p) => (
              <li key={p.id}>
                <a href={`#${p.id}`} className="flex items-baseline gap-4 py-2.5 text-[15px] text-brand-muted transition hover:text-brand-purple">
                  <span className="w-8 shrink-0 font-mono text-xs font-bold text-brand-gold-deep">{p.n}</span>
                  <span className="font-heading font-semibold text-brand-purple">{p.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-14 space-y-14">
          <Part id="grading" n="I" title="Grading and Grade Points">
            <P>
              Performance in every course is graded on the scale below. The lowest mark that earns
              credit is <strong className="font-semibold text-brand-purple">{passMark}</strong>; a
              mark below that is recorded as F and carries no grade points.
            </P>
            <Table head={['Grade', 'Descriptor', 'Percentage', 'Grade points']}>
              {gradeScale.map((g) => (
                <tr key={g.grade}>
                  <td className="px-5 py-3 font-heading font-bold text-brand-purple">{g.grade}</td>
                  <td className="px-5 py-3 text-brand-muted">{g.descriptor}</td>
                  <td className="px-5 py-3 tabular text-brand-muted">{g.range}</td>
                  <td className="px-5 py-3 tabular font-semibold text-brand-purple">{g.points}</td>
                </tr>
              ))}
            </Table>
            <P>
              This scale runs in one-third steps from 4.00 and has no 3.67 point. It is the
              university’s own scale and is reproduced exactly; it differs from the common
              four-point scale used elsewhere, and a credential evaluator abroad should read the
              grade points above rather than assume the usual mapping.
            </P>

            <H3>Special grades</H3>
            <Table head={['Code', 'Meaning']}>
              {specialGrades.map((s) => (
                <tr key={s.code}>
                  <td className="w-20 px-5 py-3 font-mono text-sm font-bold text-brand-gold-deep">{s.code}</td>
                  <td className="px-5 py-3 text-brand-muted">{s.meaning}</td>
                </tr>
              ))}
            </Table>
          </Part>

          <Part id="classification" n="II" title="Course Classification and GPA">
            <P>Every course carries one of three classifications.</P>
            <Table head={['Code', 'Classification', 'Meaning']}>
              {courseClassification.map((c) => (
                <tr key={c.code}>
                  <td className="w-20 px-5 py-3 font-mono text-sm font-bold text-brand-gold-deep">{c.code}</td>
                  <td className="px-5 py-3 font-heading font-semibold text-brand-purple">{c.name}</td>
                  <td className="px-5 py-3 text-brand-muted">{c.meaning}</td>
                </tr>
              ))}
            </Table>
            <H3>Grade Point Average</H3>
            <P>{gpaRule}</P>
          </Part>

          <Part id="load" n="III" title="Study Load, Seminars and Entry Standards">
            {loadRules.map((r) => (
              <div key={r.level} className="mt-7 border-l-2 border-brand-sand pl-5 first:mt-0">
                <h3 className="font-heading text-[17px] font-bold text-brand-purple">{r.level}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-brand-muted">{r.load}</p>
                {r.structure && <p className="mt-2 text-[15px] leading-relaxed text-brand-muted">{r.structure}</p>}
                {r.seminars && (
                  <p className="mt-2 text-[15px] leading-relaxed text-brand-muted">
                    <span className="font-semibold text-brand-purple">Seminars: </span>
                    {r.seminars}
                  </p>
                )}
                {r.entry && (
                  <p className="mt-2 text-[15px] leading-relaxed text-brand-muted">
                    <span className="font-semibold text-brand-purple">Entry: </span>
                    {r.entry}
                  </p>
                )}
              </div>
            ))}
            <H3>Doctoral fields</H3>
            <P>
              Ph.D. and Th.D. programmes are offered in {doctoralFields.phdAndThD.join(', ')}. The
              Doctor of Ministry is offered in {doctoralFields.dMin.join(' and ')}.
            </P>
          </Part>

          <Part id="assessment" n="IV" title="Assessment">
            {assessmentSchemes.map((a) => (
              <div key={a.applies} className="mt-8 first:mt-0">
                <h3 className="font-heading text-[17px] font-bold text-brand-purple">{a.applies}</h3>
                <Table head={['Component', 'Weight']}>
                  {a.components.map((c) => (
                    <tr key={c.name}>
                      <td className="px-5 py-3 text-brand-muted">{c.name}</td>
                      <td className="w-24 px-5 py-3 tabular font-semibold text-brand-purple">{c.weight}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            ))}
            <P>
              A supplementary examination attracts a fee; see Part V. The conditions under which a
              supplementary examination is granted have not yet been published — see Part VIII.
            </P>
          </Part>

          <Part id="fees" n="V" title="Fees and Payment">
            <H3>Fee bands</H3>
            <P>
              The university operates two fee bands. Which applies is determined by nationality and
              residence, not by mode of study.
            </P>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {feeBands.map((b) => (
                <div key={b.name} className="rounded-2xl border border-brand-sand bg-brand-cream p-6">
                  <h4 className="font-heading text-[17px] font-bold text-brand-purple">{b.name}</h4>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-brand-muted">{b.appliesTo}</p>
                  <p className="mt-3 text-[15px] leading-relaxed text-brand-muted">{b.basis}</p>
                  <p className="mt-3 text-sm leading-relaxed text-brand-muted">{b.figures}</p>
                  {!b.confirmed && (
                    <p className="mt-4 rounded-lg border border-dashed border-brand-gold/60 bg-white px-3.5 py-2.5 text-[12px] leading-relaxed text-brand-muted">
                      <span className="font-semibold text-brand-purple">To be confirmed. </span>
                      The university has stated the policy for this band but has not yet published
                      its schedule of amounts.
                    </p>
                  )}
                </div>
              ))}
            </div>
            <P>{feeBandNote}</P>

            <H3>Terms of payment</H3>
            <Rules items={paymentTerms} />

            <H3>Fees payable in addition to tuition</H3>
            <P>
              These amounts are the Africa and Global South band. The equivalent schedule for the
              Europe and North America band has not been published.
            </P>
            <P>
              Every fee is quoted in US dollars. The schedule was converted from FCFA at{' '}
              <strong>{usdConversionRate.fcfaPerUsd} FCFA to the dollar</strong>, the rate the
              university has adopted, and each amount is rounded up to a whole multiple of{' '}
              {usdConversionRate.roundedToNearest} dollars so that no fee needs change made on it.
              You pay in your own national currency to the ICOF national base in your country.
            </P>
            <Table head={['Item', 'Amount']}>
              {miscellaneousFees.map((f) => (
                <tr key={f.item}>
                  <td className="px-5 py-3 text-brand-muted">
                    {f.item}
                    {f.optional && (
                      <span className="ml-2 rounded-full bg-brand-cream px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.1em] text-brand-gold-deep">
                        Optional
                      </span>
                    )}
                  </td>
                  <td className="w-44 px-5 py-3 tabular font-semibold text-brand-purple">{f.amount}</td>
                </tr>
              ))}
              <tr className="bg-brand-cream">
                <td className="px-5 py-3 font-heading font-bold text-brand-purple">Total</td>
                <td className="px-5 py-3 tabular font-bold text-brand-purple">{miscellaneousFeesTotal}</td>
              </tr>
            </Table>

            <H3>Sponsored students</H3>
            <Rules items={sponsorTerms} />
          </Part>

          <Part id="withdrawal" n="VI" title="Withdrawal and Refunds">
            <Rules items={withdrawalRules} />
            <H3>Refund schedule</H3>
            <P>Refunds are calculated from the date of enrolment.</P>
            <Table head={['Withdrawal within', 'Refund', 'Applies to']}>
              {refundSchedule.map((r) => (
                <tr key={r.window}>
                  <td className="px-5 py-3 text-brand-muted">{r.window}</td>
                  <td className="w-24 px-5 py-3 tabular font-bold text-brand-purple">{r.refund}</td>
                  <td className="px-5 py-3 text-sm text-brand-muted">{r.covers}</td>
                </tr>
              ))}
            </Table>
          </Part>

          <Part id="scholarships" n="VII" title="Scholarships and Bursaries">
            <Rules items={scholarshipRules} />
            <P>
              See also{' '}
              <Link href="/scholarships" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Scholarships &amp; Financial Aid
              </Link>
              .
            </P>
          </Part>

          <Part id="notes" n="VIII" title="Editorial Notes on the Source Documents">
            <P>
              These regulations are reproduced from the university’s grading system and its Student
              Fees Guide. The following points were found while transcribing them. None has been
              corrected here, because correcting a regulation is the university’s act, not this
              site’s. Each is a question for the Academic Board.
            </P>
            <ol className="mt-7 space-y-5">
              {sourceNotes.map((n, i) => (
                <li key={n.issue} className="rounded-2xl border border-dashed border-brand-gold/60 bg-brand-cream/70 p-6">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold-deep">
                    Note {i + 1}
                  </p>
                  <h3 className="mt-2 font-heading text-[17px] font-bold text-brand-purple">{n.issue}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-brand-muted">{n.detail}</p>
                </li>
              ))}
            </ol>
          </Part>
        </div>

        <p className="mt-16 border-t border-brand-sand pt-8 text-center text-sm text-brand-muted">
          {site.name} · Academic Regulations · {site.address} · {site.email}
          <br />
          Reproduced from the university’s published grading system and Student Fees Guide.
          Fee amounts may be amended by the University Accounts Office.
        </p>
      </div>
    </>
  );
}
