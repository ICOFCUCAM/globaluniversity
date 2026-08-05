import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import PageBanner from '@/components/PageBanner';
import { site, about, tuition, contact, programs, stats } from '@/content/site';
import { welcomeExcerpt } from '@/content/welcome';
import { facultyList } from '@/content/faculties';
import { courses } from '@/content/courses';
import { contentPages, degreeLevels } from '@/content/pages';
import { gradeScale, passMark } from '@/content/regulations';

export const metadata: Metadata = {
  title: 'University Prospectus — ICOF Global University',
  description:
    'Why ICOF: campuses in Buea and Douala, online learning worldwide, five faculties, degree programmes from certificate to doctorate, student life, admissions, scholarships and fees.',
  alternates: { canonical: '/prospectus' },
};

/**
 * The Yeshiva-style pedagogy is the university's own account of what makes its
 * teaching distinctive, and it belongs at the front of a prospectus rather than
 * buried — it is the one thing here no competing institution can claim.
 */
const YESHIVA = [
  'ICOF Global University incorporates elements of the Jewish Yeshiva style of learning. Rooted in centuries of tradition, this method emphasises interactive dialogue, critical thinking and deep engagement with textual sources.',
  'Through this immersive learning experience, students gain a deeper understanding of their subjects and develop the skills needed for lifelong learning and personal growth.',
];

const WHY = [
  { t: 'A global community', b: 'Students and faculty from around the world engage in collaborative learning and cross-cultural exchange. Wherever you study with us, you are a full member of this university.' },
  { t: 'Instructors who practise what they teach', b: 'Our professors are called instructors because rather than professing knowledge, they have lived it. You receive a personal reply from your instructor, not a teaching assistant.' },
  { t: 'Accredited since 2007', b: 'Continuously accredited by the Ministry of Higher Education of Cameroon, and part of the International Circle of Faith.' },
  { t: 'Built for working adults', b: 'Full-time, part-time, online and distance routes, so a working professional, a minister in post or a parent can study without stopping everything else.' },
  { t: 'Certificate through to doctorate', b: 'A clear ladder in every faculty that offers one, so the first award you take is a step toward the next rather than a dead end.' },
  { t: 'Diversity, by conviction', b: 'Students from all backgrounds, cultures and walks of life are welcomed. Every individual is valued and respected.' },
];

const PARTS = [
  { id: 'why', n: 'I', title: 'Why ICOF' },
  { id: 'campuses', n: 'II', title: 'Campuses and Online Learning' },
  { id: 'faculties', n: 'III', title: 'Faculties' },
  { id: 'programmes', n: 'IV', title: 'Degree Programmes' },
  { id: 'life', n: 'V', title: 'Student Life' },
  { id: 'international', n: 'VI', title: 'International Students' },
  { id: 'admissions', n: 'VII', title: 'Admissions' },
  { id: 'fees', n: 'VIII', title: 'Fees and Scholarships' },
  { id: 'contact', n: 'IX', title: 'Contact' },
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

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-[15px] leading-[1.75] text-brand-muted">{children}</p>;
}

export default function ProspectusPage() {
  const international = contentPages.find((c) => c.slug === 'international');
  const campusLifePage = contentPages.find((c) => c.slug === 'campus-life');
  const LEVELS = ['Certificate', 'Diploma', 'Bachelor', 'Master', 'Doctorate'] as const;
  const byLevel = LEVELS.map((level) => ({ level, items: programs.filter((p) => p.level === level) })).filter(
    (l) => l.items.length > 0,
  );

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: 'University Prospectus',
    url: `${site.url}/prospectus`,
    publisher: { '@id': `${site.url}/#organization` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner
        title="University Prospectus"
        subtitle="Where education meets innovation and excellence — the Community University of Africa."
        image="/images/graduates.jpg"
        eyebrow="Prospective students"
      />

      <div className="border-b border-brand-sand bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 py-5 sm:px-6">
          <Link href="/apply" className="rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white shadow-lift transition hover:bg-brand-purple-dark">
            Apply Now
          </Link>
          <Link href="/academic-catalog" className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white">
            Academic Catalog
          </Link>
          <a href="#contents" className="rounded-full border-2 border-brand-sand px-7 py-3 font-heading text-sm font-semibold text-brand-muted transition hover:border-brand-gold hover:text-brand-purple">
            Contents
          </a>
        </div>
        <p className="pb-5 text-center text-xs text-brand-muted">
          To keep a copy, print this page and choose “Save as PDF”.
        </p>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <blockquote className="border-l-2 border-brand-gold/60 pl-6">
          <p className="font-heading text-[21px] font-semibold leading-[1.55] text-brand-purple">{welcomeExcerpt}</p>
          <footer className="mt-3 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold-deep">
            Bishop Bernie L Wade, PhD · Chancellor
          </footer>
        </blockquote>

        <nav id="contents" className="mt-12 scroll-mt-28 rounded-2xl border border-brand-sand bg-brand-cream p-7">
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
          <Part id="why" n="I" title="Why ICOF">
            <P>{about.intro}</P>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {WHY.map((w) => (
                <div key={w.t} className="rounded-2xl border border-brand-sand bg-brand-cream p-6">
                  <h3 className="font-heading text-[17px] font-bold text-brand-purple">{w.t}</h3>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-brand-muted">{w.b}</p>
                </div>
              ))}
            </div>

            <h3 className="mt-12 font-heading text-xl font-bold text-brand-purple">
              The Yeshiva style of learning
            </h3>
            {YESHIVA.map((p, i) => (
              <P key={i}>{p}</P>
            ))}

            <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-brand-sand bg-brand-sand/60 lg:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="bg-white px-5 py-6 text-center">
                  <dd className="font-heading text-2xl font-bold tabular text-brand-purple">{s.value}</dd>
                  <dt className="mt-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold-deep">
                    {s.label}
                  </dt>
                </div>
              ))}
            </dl>
          </Part>

          <Part id="campuses" n="II" title="Campuses and Online Learning">
            <P>
              The university teaches from Buea and Douala in Cameroon, from its resource centre in
              Nigeria, and online to students on every continent.
            </P>
            <P>
              Distance and online students study the same curriculum, sit the same assessments and
              receive the same award as students on campus. Course materials, assignments,
              examinations and transcripts are handled through the student portal.
            </P>
            <P>
              Master&rsquo;s students attend two seminars a year, each of five days at the campus;
              doctoral students attend four one-week seminars a year. These are the points at which
              distance study becomes residential.
            </P>
          </Part>

          <Part id="faculties" n="III" title="Faculties">
            {facultyList.map((f) => (
              <div key={f.slug} className="mt-8 flex flex-col gap-5 first:mt-0 sm:flex-row">
                <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-2xl ring-1 ring-brand-sand sm:w-48">
                  <Image src={f.image} alt="" fill className="object-cover" sizes="(min-width:640px) 12rem, 100vw" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-[17px] font-bold text-brand-purple">{f.name}</h3>
                  <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold-deep">
                    {f.campus}
                  </p>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-brand-muted">{f.standsFor}</p>
                  <Link href={`/faculty/${f.slug}`} className="mt-2 inline-block text-sm font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                    Read more
                  </Link>
                </div>
              </div>
            ))}
          </Part>

          <Part id="programmes" n="IV" title="Degree Programmes">
            <P>
              {programs.length} programmes and {courses.length} courses, from certificate to
              doctorate.
            </P>
            {byLevel.map((l) => (
              <div key={l.level} className="mt-8">
                <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold-deep">
                  {l.level}
                </h3>
                <ul className="mt-3 flex flex-wrap gap-2.5">
                  {l.items.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/programs/${p.slug}`}
                        className="inline-block rounded-full border border-brand-sand bg-white px-4 py-2 font-heading text-sm font-semibold text-brand-purple shadow-sm transition hover:border-brand-gold"
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Part>

          <Part id="life" n="V" title="Student Life">
            {campusLifePage?.sections
              .flatMap((s) => s.paragraphs ?? [])
              .slice(0, 3)
              .map((p, i) => (
                <P key={i}>{p}</P>
              ))}
            <P>
              Theology students also take part in chapel services, prayer retreats, community
              outreach, mission internships, leadership conferences, student theological societies
              and research seminars.
            </P>
          </Part>

          <Part id="international" n="VI" title="International Students">
            {international?.sections
              .flatMap((s) => s.paragraphs ?? [])
              .slice(0, 3)
              .map((p, i) => (
                <P key={i}>{p}</P>
              ))}
            <P>
              Every degree level requires proof of English language proficiency. Applicants holding
              qualifications from outside Cameroon are assessed against the comparable Cameroonian
              qualification.
            </P>
          </Part>

          <Part id="admissions" n="VII" title="Admissions">
            <P>
              Requirements vary by faculty and by degree level. The full list for each level is in
              the{' '}
              <Link href="/academic-catalog#admission" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Academic Catalog
              </Link>
              ; the summary below is the shape of it.
            </P>
            <ul className="mt-6 space-y-4">
              {degreeLevels.map((d) => (
                <li key={d.slug} className="border-l-2 border-brand-sand pl-5">
                  <p className="font-heading text-[16px] font-bold text-brand-purple">{d.title}</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-brand-muted">{d.requirements[0]}</p>
                </li>
              ))}
            </ul>
            <P>
              Applications are made free of charge online. Enrolment representatives will walk
              through the process, clarify requirements, advise on transferring coursework and
              explain the financial commitment.
            </P>
          </Part>

          <Part id="fees" n="VIII" title="Fees and Scholarships">
            <P>{tuition.intro}</P>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-brand-sand">
              <table className="w-full min-w-[28rem] text-left text-[15px]">
                <tbody className="divide-y divide-brand-sand/70">
                  {tuition.rows.map((r) => (
                    <tr key={r.program}>
                      <td className="px-5 py-3 font-heading font-semibold text-brand-purple">{r.program}</td>
                      <td className="px-5 py-3 text-brand-muted">{r.fee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P>{tuition.bands}</P>
            <P>{tuition.note}</P>
            <P>
              Fees payable in addition to tuition, the terms of payment and the refund schedule are
              set out in the{' '}
              <Link href="/academic-regulations#fees" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Academic Regulations
              </Link>
              . The pass mark is {passMark} and grades run from A at {gradeScale[0].range} downward.
            </P>
          </Part>

          <Part id="contact" n="IX" title="Contact">
            <P>
              {contact.address}
              <br />
              {contact.phone} · {contact.email}
              <br />
              Admissions: admissions@iguc.net
            </P>
            <div className="mt-7 flex flex-wrap gap-3 print:hidden">
              <Link href="/apply" className="rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white shadow-lift transition hover:bg-brand-purple-dark">
                Apply Now
              </Link>
              <Link href="/contact" className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white">
                All contact details
              </Link>
            </div>
          </Part>
        </div>

        <p className="mt-16 border-t border-brand-sand pt-8 text-center text-sm text-brand-muted">
          {site.name} · {site.tagline} · {site.affiliation}
        </p>
      </div>
    </>
  );
}
