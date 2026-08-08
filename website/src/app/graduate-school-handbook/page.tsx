import type { Metadata } from 'next';
import Link from 'next/link';
import PageBanner from '@/components/PageBanner';
import { site, programs } from '@/content/site';
import { doctoralProgrammes, thesisModule, mastersRequirements, graduateSchoolGaps } from '@/content/graduateSchool';
import { loadRules, assessmentSchemes } from '@/content/regulations';

export const metadata: Metadata = {
  title: 'Graduate School Handbook — ICOF Global University',
  description:
    'Admission, coursework, comprehensive examinations, thesis proposal, research methodologies, dissertation and graduation requirements for Master’s and doctoral candidates.',
  alternates: { canonical: '/graduate-school-handbook' },
};

const PARTS = [
  { id: 'admission', n: 'I', title: 'Admission' },
  { id: 'masters', n: 'II', title: 'Master’s Study' },
  { id: 'doctoral', n: 'III', title: 'Doctoral Programmes' },
  { id: 'methods', n: 'IV', title: 'Research Methodologies' },
  { id: 'thesis', n: 'V', title: 'The Thesis' },
  { id: 'gaps', n: 'VI', title: 'Still to be Adopted' },
];

function Part({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="catalog-part scroll-mt-28 border-t border-brand-sand pt-12">
      <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-brand-gold-ink">Part {n}</p>
      <h2 className="mt-2 font-heading text-3xl font-bold text-brand-purple [text-wrap:balance]">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-[15px] leading-[1.75] text-brand-muted">{children}</p>;
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-[15px] leading-relaxed text-brand-muted">
          <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-brand-gold-deep" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Awaiting({ title, needs }: { title: string; needs: string[] }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-brand-gold/60 bg-brand-cream/70 p-6">
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold-ink">In preparation</p>
      <h3 className="mt-2 font-heading text-lg font-bold text-brand-purple">{title}</h3>
      <ul className="mt-4 space-y-2">
        {needs.map((n) => (
          <li key={n} className="flex gap-3 text-[15px] leading-relaxed text-brand-muted">
            <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-brand-gold" />
            <span>{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function GraduateSchoolHandbookPage() {
  const doctoralRule = loadRules.find((r) => r.level.startsWith('Doctorate'));
  const mastersRule = loadRules.find((r) => r.level.startsWith('Master'));
  const mastersScheme = assessmentSchemes.find((a) => a.applies.startsWith('Master'));

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: 'Graduate School Handbook',
    url: `${site.url}/graduate-school-handbook`,
    publisher: { '@id': `${site.url}/#organization` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner
        title="Graduate School Handbook"
        subtitle="For Master’s and doctoral candidates — admission, coursework, comprehensive examinations, the dissertation and the defence."
        image="/images/graduation-2024/grad-2024-doctoral-seated.jpg"
        eyebrow="Postgraduate study"
      />

      <div className="border-b border-brand-sand bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 py-5 sm:px-6">
          <a href="#contents" className="rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white shadow-lift transition hover:bg-brand-purple-dark">
            Contents
          </a>
          <Link href="/academic-regulations" className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white">
            Academic Regulations
          </Link>
          <Link href="/research" className="rounded-full border-2 border-brand-sand px-7 py-3 font-heading text-sm font-semibold text-brand-muted transition hover:border-brand-gold hover:text-brand-purple">
            Research &amp; Innovation
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
                  <span className="w-8 shrink-0 font-mono text-xs font-bold text-brand-gold-ink">{p.n}</span>
                  <span className="font-heading font-semibold text-brand-purple">{p.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-14 space-y-14">
          <Part id="admission" n="I" title="Admission">
            <h3 className="font-heading text-xl font-bold text-brand-purple">Master&rsquo;s admission</h3>
            <List
              items={[
                'A bachelor’s degree in theology, religious studies or a related field.',
                'A minimum GPA as specified by the university — 2.5 on a 4.00 scale for master’s entry.',
                'Academic transcripts, a statement of purpose and letters of recommendation.',
                'An interview may be required.',
              ]}
            />
            <h3 className="mt-10 font-heading text-xl font-bold text-brand-purple">Doctoral admission</h3>
            {doctoralRule?.entry && <P>{doctoralRule.entry}</P>}
            <P>
              Candidates must also become familiar with the university&rsquo;s research
              requirements, and will undertake extensive reading in their field throughout the
              programme.
            </P>
          </Part>

          <Part id="masters" n="II" title="Master’s Study">
            {mastersRule?.load && <P>{mastersRule.load}</P>}
            {mastersRule?.seminars && (
              <P>
                <span className="font-semibold text-brand-purple">Seminars. </span>
                {mastersRule.seminars}
              </P>
            )}
            <h3 className="mt-10 font-heading text-xl font-bold text-brand-purple">Course requirements</h3>
            <List items={mastersRequirements} />
            {mastersScheme && (
              <>
                <h3 className="mt-10 font-heading text-xl font-bold text-brand-purple">Assessment</h3>
                <div className="mt-5 overflow-x-auto rounded-2xl border border-brand-sand">
                  <table className="w-full min-w-[26rem] text-left text-[15px]">
                    <tbody className="divide-y divide-brand-sand/70">
                      {mastersScheme.components.map((c) => (
                        <tr key={c.name}>
                          <td className="px-5 py-3 text-brand-muted">{c.name}</td>
                          <td className="w-24 px-5 py-3 tabular font-semibold text-brand-purple">{c.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <P>
              The Master of Theology thesis is written on a topic in African and Black Hebrew
              theology under a faculty advisor, and must demonstrate original research and
              contribute to academic discourse in the field.
            </P>
          </Part>

          <Part id="doctoral" n="III" title="Doctoral Programmes">
            {doctoralRule?.seminars && (
              <P>
                <span className="font-semibold text-brand-purple">Seminars. </span>
                {doctoralRule.seminars}
              </P>
            )}
            <P>
              The university offers four doctorates in theology. Each follows the same shape —
              coursework, comprehensive examinations, dissertation, defence — but differs in scope
              and in length.
            </P>
            {doctoralProgrammes.map((d) => {
              const prog = programs.find((p) => p.slug === d.programSlug);
              return (
                <div key={d.programSlug} className="mt-12">
                  <h3 className="font-heading text-xl font-bold text-brand-purple">
                    {d.award} <span className="text-brand-gold-ink">({d.abbreviation})</span>
                  </h3>
                  <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold-ink">
                    {d.duration}
                  </p>
                  {d.overview.map((p, i) => (
                    <P key={i}>{p}</P>
                  ))}
                  <P>
                    <span className="font-semibold text-brand-purple">Structure. </span>
                    {d.structure}
                  </P>
                  <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    <div className="rounded-2xl border border-brand-sand bg-brand-cream p-5">
                      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold-ink">
                        Core courses
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {d.coreCourses.map((c) => (
                          <li key={c} className="text-[13px] leading-relaxed text-brand-muted">{c}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-brand-sand bg-white p-5">
                      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold-ink">
                        Elective courses (sample)
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {d.electiveCourses.map((c) => (
                          <li key={c} className="text-[13px] leading-relaxed text-brand-muted">{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <P>
                    <span className="font-semibold text-brand-purple">Comprehensive examinations. </span>
                    {d.comprehensiveExams}
                  </P>
                  <P>
                    <span className="font-semibold text-brand-purple">Dissertation. </span>
                    {d.dissertation}
                  </P>
                  <P>
                    <span className="font-semibold text-brand-purple">Graduation. </span>
                    {d.graduation}
                  </P>
                  {prog && (
                    <p className="mt-3 text-sm">
                      <Link href={`/programs/${prog.slug}`} className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                        Programme page
                      </Link>
                    </p>
                  )}
                </div>
              );
            })}
            <P>
              The Doctor of Ministry is a professional doctorate in Christian Counseling and
              Administration, offered in Practical Theology and Divinity, and is described on its{' '}
              <Link href="/programs/doctor-of-ministry" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                own page
              </Link>
              . Its detailed structure has not been supplied.
            </P>
          </Part>

          <Part id="methods" n="IV" title="Research Methodologies">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold-ink">
              Module {thesisModule.code}
            </p>
            <h3 className="mt-2 font-heading text-xl font-bold text-brand-purple">{thesisModule.title}</h3>
            <P>{thesisModule.description}</P>
            <h4 className="mt-8 font-heading text-lg font-bold text-brand-purple">Module objectives</h4>
            <List items={thesisModule.objectives} />
            {thesisModule.units.map((u) => (
              <div key={u.n} className="mt-9">
                <h4 className="font-heading text-lg font-bold text-brand-purple">
                  Unit {u.n} — {u.title}
                </h4>
                {u.topics.map((t) => (
                  <div key={t.heading} className="mt-4 border-l-2 border-brand-sand pl-5">
                    <p className="font-heading text-[15px] font-semibold text-brand-purple">{t.heading}</p>
                    <ul className="mt-2 space-y-1.5">
                      {t.points.map((pt) => (
                        <li key={pt} className="text-[14px] leading-relaxed text-brand-muted">{pt}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
            <h4 className="mt-10 font-heading text-lg font-bold text-brand-purple">Assessment</h4>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-brand-sand">
              <table className="w-full min-w-[26rem] text-left text-[15px]">
                <tbody className="divide-y divide-brand-sand/70">
                  {thesisModule.assessment.map((a) => (
                    <tr key={a.component}>
                      <td className="px-5 py-3 text-brand-muted">{a.component}</td>
                      <td className="w-24 px-5 py-3 tabular font-semibold text-brand-purple">{a.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h4 className="mt-10 font-heading text-lg font-bold text-brand-purple">Recommended reading</h4>
            <ul className="mt-4 space-y-2">
              {thesisModule.readings.map((r) => (
                <li key={r} className="text-[15px] leading-relaxed text-brand-muted">{r}</li>
              ))}
            </ul>
          </Part>

          <Part id="thesis" n="V" title="The Thesis">
            <P>
              A thesis is structured as introduction, literature review, methodology, results,
              discussion and conclusion, and is judged on clarity, coherence and academic style.
              Referencing follows a recognised citation standard — the module names APA and
              Chicago — and academic integrity is maintained throughout.
            </P>
            <P>
              Doctoral candidates defend the dissertation before a faculty committee. Doctoral work
              at ICOF is examined by the Dissertation Council.
            </P>
            <P>
              A graduating student with outstanding fees will have a hold placed on transcripts,
              diplomas and degrees until those fees are paid. The thesis and dissertation fee is
              USD 45 and above, quoted in US dollars and paid in your own national currency to the
              ICOF national base in your country; see the{' '}
              <Link href="/academic-regulations#fees" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Academic Regulations
              </Link>
              .
            </P>
          </Part>

          <Part id="gaps" n="VI" title="Still to be Adopted">
            <P>
              A research student needs to know who supervises them and what happens at a viva.
              Neither can be inferred from a course list, so both are named here rather than
              filled in.
            </P>
            {graduateSchoolGaps.map((g) => (
              <Awaiting key={g.title} title={g.title} needs={g.needs} />
            ))}
          </Part>
        </div>

        <p className="mt-16 border-t border-brand-sand pt-8 text-center text-sm text-brand-muted">
          {site.name} · Graduate School Handbook · {site.address} · {site.email}
        </p>
      </div>
    </>
  );
}
