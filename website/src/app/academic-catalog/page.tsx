// ---------------------------------------------------------------------------
// The Academic Catalog — the university's official academic handbook.
//
// ASSEMBLED, NOT AUTHORED. Almost every section below already existed somewhere
// on this site: the Chancellor's address, the history, the governance roster,
// the faculties, the admission requirements by level, the fee table, the
// disciplinary code, and all thirty-odd programmes with their outcomes. A
// catalog is what you get when those are gathered into one ordered document
// with a contents page. Nothing here is retyped — every section reads from the
// same content module the corresponding public page reads from, so the catalog
// cannot drift out of step with the site.
//
// SECTIONS THAT ARE NOT YET WRITTEN SAY SO. Examination regulations, degree
// classifications, graduation requirements, research ethics and quality
// assurance are matters an Academic Board adopts. Each renders as a short
// notice naming what is required and who must adopt it, rather than as
// plausible text. A student facing an examination board and a reviewer from
// the Ministry are both entitled to rely on this document; inventing its
// regulations would betray exactly the people it exists to serve.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import PageBanner from '@/components/PageBanner';
import { site, about, administration, leadership, lecturers, programs, tuition, admissions } from '@/content/site';
import { chancellor, chancellorBio, viceChancellor } from '@/content/welcome';
import { facultyList } from '@/content/faculties';
import { courses } from '@/content/courses';
import { degreeLevels, contentPages } from '@/content/pages';
import { gradeScale, passMark, specialGrades, gpaRule, refundSchedule, loadRules } from '@/content/regulations';
import { curricula } from '@/content/curricula';

export const metadata: Metadata = {
  title: 'Academic Catalog — ICOF Global University',
  description:
    'The official academic handbook of ICOF Global University: governance, faculties, admission requirements, fees, regulations and the full programme and course catalogue.',
  alternates: { canonical: '/academic-catalog' },
};

const EDITION = '2026 Edition';

/** Parts of the catalog, in the order the university specified them. */
const PARTS = [
  { id: 'welcome', n: 'I', title: 'Welcome' },
  { id: 'university', n: 'II', title: 'The University' },
  { id: 'governance', n: 'III', title: 'Governance' },
  { id: 'faculties', n: 'IV', title: 'Faculties and Schools' },
  { id: 'calendar', n: 'V', title: 'Academic Calendar' },
  { id: 'admission', n: 'VI', title: 'Admission Requirements' },
  { id: 'fees', n: 'VII', title: 'Tuition, Fees and Scholarships' },
  { id: 'regulations', n: 'VIII', title: 'Student and Examination Regulations' },
  { id: 'integrity', n: 'IX', title: 'Academic Integrity and Research Ethics' },
  { id: 'services', n: 'X', title: 'Student Services' },
  { id: 'quality', n: 'XI', title: 'Quality Assurance' },
  { id: 'programmes', n: 'XII', title: 'Programmes and Course Descriptions' },
];

function Part({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="catalog-part scroll-mt-28 border-t border-brand-sand pt-12">
      <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-brand-gold-deep">
        Part {n}
      </p>
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

function Bullets({ items }: { items: string[] }) {
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

/**
 * A section the university has still to adopt. Naming what is missing and who
 * must adopt it is more useful — to a student, and to a reviewer — than a
 * confident paragraph nobody has approved.
 */
function AwaitingAdoption({ title, needs, body }: { title: string; needs: string[]; body: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-brand-gold/60 bg-brand-cream/70 p-6">
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold-deep">
        In preparation
      </p>
      <h4 className="mt-2 font-heading text-lg font-bold text-brand-purple">{title}</h4>
      <p className="mt-3 text-[15px] leading-relaxed text-brand-muted">{body}</p>
      <p className="mt-4 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-brand-purple">
        Required to complete this section
      </p>
      <Bullets items={needs} />
    </div>
  );
}

export default function AcademicCatalogPage() {
  const scholarships = contentPages.find((c) => c.slug === 'scholarships');
  const policies = contentPages.find((c) => c.slug === 'policies');
  const codeOfConduct = policies?.sections.find((s) => s.heading === 'Code of Conduct');
  const disciplinary = policies?.sections.find((s) => s.heading === 'Disciplinary Process');
  const dueProcess = policies?.sections.find((s) => s.heading === 'Due Process');
  const values = about.items.find((i) => i.title === 'Our Values');
  const history = about.items.find((i) => i.title === 'Our History');
  const mission = about.items.find((i) => i.title.startsWith('Mission'));
  const accreditation = about.items.find((i) => i.title === 'Accreditation');

  // Programmes grouped by faculty, then by level — the shape a catalog needs.
  const LEVELS = ['Certificate', 'Diploma', 'Bachelor', 'Master', 'Doctorate'] as const;
  const byFaculty = facultyList
    .filter((f) => !f.sharesProvisionWith || f.slug === 'theology-buea')
    .map((f) => ({
      faculty: f,
      levels: LEVELS.map((level) => ({
        level,
        items: programs.filter((p) => p.school === f.programSchool && p.level === level),
      })).filter((l) => l.items.length > 0),
      courses: courses.filter((c) => c.faculty === f.courseFaculty),
    }))
    .filter((g) => g.levels.length > 0);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: `Academic Catalog ${EDITION}`,
    bookEdition: EDITION,
    inLanguage: 'en',
    about: { '@type': 'CollegeOrUniversity', name: site.name, url: site.url },
    publisher: { '@id': `${site.url}/#organization` },
    url: `${site.url}/academic-catalog`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner
        title="Academic Catalog"
        subtitle="The official academic handbook of ICOF Global University — governance, faculties, regulations and the full programme catalogue."
        image="/images/graduation.jpg"
        eyebrow={EDITION}
      />

      <div className="border-b border-brand-sand bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 py-5 sm:px-6">
          <a
            href="#contents"
            className="rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white shadow-lift transition hover:bg-brand-purple-dark"
          >
            Contents
          </a>
          <Link
            href="/documents"
            className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
          >
            All institutional documents
          </Link>
          <Link
            href="/apply"
            className="rounded-full border-2 border-brand-sand px-7 py-3 font-heading text-sm font-semibold text-brand-muted transition hover:border-brand-gold hover:text-brand-purple"
          >
            Apply Now
          </Link>
        </div>
        {/* Printing is how this becomes a PDF. Print CSS drops the chrome. */}
        <p className="pb-5 text-center text-xs text-brand-muted">
          To save this catalog as a PDF, print the page and choose “Save as PDF”.
        </p>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        {/* Contents */}
        <nav id="contents" className="scroll-mt-28 rounded-2xl border border-brand-sand bg-brand-cream p-7">
          <h2 className="font-heading text-xl font-bold text-brand-purple">Contents</h2>
          <ol className="mt-5 divide-y divide-brand-sand/70">
            {PARTS.map((p) => (
              <li key={p.id}>
                <a
                  href={`#${p.id}`}
                  className="flex items-baseline gap-4 py-2.5 text-[15px] text-brand-muted transition hover:text-brand-purple"
                >
                  <span className="w-8 shrink-0 font-mono text-xs font-bold text-brand-gold-deep">{p.n}</span>
                  <span className="font-heading font-semibold text-brand-purple">{p.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-14 space-y-14">
          {/* I — Welcome */}
          <Part id="welcome" n="I" title="Welcome">
            <H3>Welcome from the Chancellor</H3>
            <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl ring-1 ring-brand-sand">
                <Image src={chancellor.image} alt={chancellor.name} fill className="object-cover object-top" sizes="128px" />
              </div>
              <div className="flex-1">
                <p className="font-heading text-lg font-bold text-brand-purple">{chancellor.name}</p>
                <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold-deep">
                  {chancellor.role}
                </p>
                <p className="mt-2 text-sm text-brand-muted">{chancellor.credentials}</p>
              </div>
            </div>
            {chancellor.address.map((p, i) => (
              <P key={i}>{p}</P>
            ))}

            <H3>Welcome from the Vice Chancellor</H3>
            <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl ring-1 ring-brand-sand">
                <Image src={viceChancellor.image} alt={viceChancellor.name} fill className="object-cover object-top" sizes="128px" />
              </div>
              <div className="flex-1">
                <p className="font-heading text-lg font-bold text-brand-purple">{viceChancellor.name}</p>
                <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold-deep">
                  {viceChancellor.role}
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-brand-muted">{viceChancellor.note}</p>
              </div>
            </div>
            <AwaitingAdoption
              title="The Vice Chancellor’s address"
              body="The Chancellor’s address above is published in full. The Vice Chancellor has not yet supplied an address of their own for this catalog."
              needs={['An address from the Vice Chancellor, of comparable length to the Chancellor’s']}
            />
          </Part>

          {/* II — The University */}
          <Part id="university" n="II" title="The University">
            <H3>History</H3>
            <P>{about.intro}</P>
            {history && <P>{history.body}</P>}
            <div className="mt-6">
              {chancellorBio.map((p, i) => (
                <P key={i}>{p}</P>
              ))}
            </div>

            <H3>Vision and Mission</H3>
            <P>{site.description}</P>
            {mission && <P>{mission.body}</P>}

            <H3>Core Values</H3>
            {values && <P>{values.body}</P>}

            <H3>Accreditation</H3>
            {accreditation && <P>{accreditation.body}</P>}
            <P>{site.affiliation}</P>
          </Part>

          {/* III — Governance */}
          <Part id="governance" n="III" title="Governance">
            <P>
              The university is led by the Chancellor, with academic administration under the Vice
              Chancellor, supported by the Academic Director General, the Registrar and the directors
              of the schools. Doctoral work is examined by the Dissertation Council.
            </P>
            <H3>University Leadership</H3>
            <div className="mt-5 overflow-hidden rounded-2xl border border-brand-sand">
              <table className="w-full text-left text-[15px]">
                <thead className="bg-brand-cream">
                  <tr>
                    <th className="px-5 py-3 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold-deep">Name</th>
                    <th className="px-5 py-3 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold-deep">Office</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-sand/70">
                  {leadership.map((m) => (
                    <tr key={m.name}>
                      <td className="px-5 py-3 font-heading font-semibold text-brand-purple">{m.name}</td>
                      <td className="px-5 py-3 text-brand-muted">{m.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <H3>Administration</H3>
            <div className="mt-5 overflow-hidden rounded-2xl border border-brand-sand">
              <table className="w-full text-left text-[15px]">
                <tbody className="divide-y divide-brand-sand/70">
                  {administration.map((m) => (
                    <tr key={m.name}>
                      <td className="px-5 py-3 font-heading font-semibold text-brand-purple">{m.name}</td>
                      <td className="px-5 py-3 text-brand-muted">{m.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P>
              The academic staff roster runs to {lecturers.length} lecturers in addition to the
              officers above; see the <Link href="/faculty" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">Schools &amp; Faculties</Link> pages.
            </P>
            <AwaitingAdoption
              title="Statutory governance bodies"
              body="The Board of Trustees, the University Senate and the Academic Board are named in the university’s planned Statutes. Their composition, powers and reporting lines are governance instruments and take effect when the Board adopts them; they are not drafted here."
              needs={[
                'Composition and terms of reference of the Board of Trustees',
                'Composition and powers of the Senate and the Academic Board',
                'Appointment procedures for academic office',
                'The delegation under which degrees are awarded',
              ]}
            />
          </Part>

          {/* IV — Faculties */}
          <Part id="faculties" n="IV" title="Faculties and Schools">
            {facultyList.map((f) => (
              <div key={f.slug} className="mt-8 first:mt-0">
                <h3 className="font-heading text-lg font-bold text-brand-purple">{f.name}</h3>
                <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold-deep">
                  {f.campus}
                  {f.leadName ? ` · ${f.leadTitle ?? 'Dean'}: ${f.leadName}` : ''}
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-brand-muted">{f.standsFor}</p>
                <p className="mt-2 text-sm text-brand-muted">
                  <Link href={`/faculty/${f.slug}`} className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                    Full faculty entry
                  </Link>
                </p>
              </div>
            ))}
          </Part>

          {/* V — Academic Calendar */}
          <Part id="calendar" n="V" title="Academic Calendar">
            <AwaitingAdoption
              title="Academic calendar"
              body="The university publishes individual dates — graduation, orientation and the opening of admissions — on its Events page, but has not yet adopted a full academic calendar. A catalog cannot state term dates the institution has not set."
              needs={[
                'Semester start and end dates',
                'Registration and late registration windows',
                'Examination periods and resit periods',
                'Public holidays and reading weeks observed',
                'Graduation dates',
              ]}
            />
            <P>
              Dates already announced are listed on the{' '}
              <Link href="/events" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Events
              </Link>{' '}
              page.
            </P>
          </Part>

          {/* VI — Admission */}
          <Part id="admission" n="VI" title="Admission Requirements">
            <P>{admissions.intro}</P>
            {degreeLevels.map((d) => (
              <div key={d.slug} className="mt-8">
                <h3 className="font-heading text-lg font-bold text-brand-purple">{d.title}</h3>
                <Bullets items={d.requirements} />
                <p className="mt-3 text-sm text-brand-muted">
                  <strong className="font-semibold text-brand-purple">International students:</strong>{' '}
                  {d.international}
                </p>
              </div>
            ))}
          </Part>

          {/* VII — Fees */}
          <Part id="fees" n="VII" title="Tuition, Fees and Scholarships">
            <P>{tuition.intro}</P>
            <div className="mt-6 overflow-hidden rounded-2xl border border-brand-sand">
              <table className="w-full text-left text-[15px]">
                <thead className="bg-brand-cream">
                  <tr>
                    <th className="px-5 py-3 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold-deep">Item</th>
                    <th className="px-5 py-3 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold-deep">Fee</th>
                  </tr>
                </thead>
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
            {scholarships && (
              <>
                <H3>Scholarships and Financial Aid</H3>
                {scholarships.sections.flatMap((s, si) =>
                  (s.paragraphs ?? []).map((p, pi) => <P key={`${si}-${pi}`}>{p}</P>),
                )}
              </>
            )}
            <H3>Withdrawal and refunds</H3>
            <P>
              Refunds are calculated from the date of enrolment. A Withdrawal Form must be submitted
              and clearance granted; a student who leaves without one remains liable for the whole
              semester&rsquo;s fees.
            </P>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-brand-sand">
              <table className="w-full min-w-[26rem] text-left text-[15px]">
                <thead className="bg-brand-cream">
                  <tr>
                    <th className="px-5 py-3 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold-deep">Withdrawal within</th>
                    <th className="px-5 py-3 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold-deep">Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-sand/70">
                  {refundSchedule.map((r) => (
                    <tr key={r.window}>
                      <td className="px-5 py-3 text-brand-muted">{r.window}</td>
                      <td className="w-28 px-5 py-3 tabular font-bold text-brand-purple">{r.refund}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P>
              Terms of payment, the charges payable in addition to tuition and the terms for
              sponsors are set out in full in the{' '}
              <Link href="/academic-regulations#fees" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Academic Regulations
              </Link>
              .
            </P>
          </Part>

          {/* VIII — Regulations */}
          <Part id="regulations" n="VIII" title="Student and Examination Regulations">
            <H3>Code of Conduct</H3>
            {codeOfConduct?.paragraphs?.map((p, i) => <P key={i}>{p}</P>)}
            {codeOfConduct?.list && <Bullets items={codeOfConduct.list} />}

            <H3>Disciplinary Process</H3>
            {disciplinary?.list && <Bullets items={disciplinary.list} />}

            <H3>Due Process and Appeals</H3>
            {dueProcess?.paragraphs?.map((p, i) => <P key={i}>{p}</P>)}

            <H3>Grading scale</H3>
            <P>
              The pass mark is {passMark}. Grade points run in one-third steps from 4.00 and the
              scale has no 3.67 point; it is the university&rsquo;s own and should be read as
              printed rather than mapped onto the more common four-point scale.
            </P>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-brand-sand">
              <table className="w-full min-w-[30rem] text-left text-[15px]">
                <thead className="bg-brand-cream">
                  <tr>
                    {['Grade', 'Descriptor', 'Percentage', 'Points'].map((h) => (
                      <th key={h} className="px-5 py-3 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold-deep">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-sand/70">
                  {gradeScale.map((g) => (
                    <tr key={g.grade}>
                      <td className="px-5 py-3 font-heading font-bold text-brand-purple">{g.grade}</td>
                      <td className="px-5 py-3 text-brand-muted">{g.descriptor}</td>
                      <td className="px-5 py-3 tabular text-brand-muted">{g.range}</td>
                      <td className="px-5 py-3 tabular font-semibold text-brand-purple">{g.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P>
              <span className="font-semibold text-brand-purple">Special grades. </span>
              {specialGrades.map((s) => `${s.code} — ${s.meaning.split(' — ')[0]}`).join('; ')}.
            </P>
            <P>{gpaRule}</P>

            <H3>Study load by level</H3>
            <ul className="mt-5 space-y-3">
              {loadRules.map((r) => (
                <li key={r.level} className="border-l-2 border-brand-sand pl-5 text-[15px] leading-relaxed">
                  <span className="font-heading font-semibold text-brand-purple">{r.level}. </span>
                  <span className="text-brand-muted">{r.load}</span>
                </li>
              ))}
            </ul>
            <P>
              The complete regulations — assessment weightings, fees, sponsorship and refunds — are
              published at{' '}
              <Link href="/academic-regulations" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Academic Regulations
              </Link>
              .
            </P>

            <AwaitingAdoption
              title="Examination regulations, graduation requirements and degree classifications"
              body="The grading scale above is adopted and published. What is still missing is the machinery around it: how a student enters an examination, what happens when they miss one, and what final GPA earns which class of award. All three are instruments the Academic Board adopts, and nothing is stated here in their place."
              needs={[
                'Examination entry conditions and registration deadlines',
                'Conduct of examinations, and the definition and penalties of misconduct',
                'Absence, deferral, resit and repeat rules, and when a supplementary examination is granted',
                'Degree classification bands and their names',
                'Credit minimum and residency requirement for each award',
                'Appeal route against an examination board decision',
              ]}
            />
          </Part>

          {/* IX — Integrity */}
          <Part id="integrity" n="IX" title="Academic Integrity and Research Ethics">
            <P>
              Academic integrity is the first obligation in the university’s Code of Conduct:
              honesty in all academic endeavours, with plagiarism, cheating and other forms of
              academic dishonesty prohibited. The disciplinary process above applies to breaches.
            </P>
            <AwaitingAdoption
              title="Research ethics, plagiarism procedure and the use of generative AI"
              body="A prohibition on plagiarism is not the same as a procedure for detecting, hearing and penalising it, and the university has no published position on the use of generative AI in assessed work — a question every student now faces."
              needs={[
                'Research ethics approval route, and the committee that grants it',
                'Plagiarism detection and the hearing procedure that follows a report',
                'The university’s position on generative AI in assessed work',
                'Required citation standard, by faculty',
                'Intellectual property in student and staff work',
              ]}
            />
          </Part>

          {/* X — Services */}
          <Part id="services" n="X" title="Student Services">
            <P>
              Students have access to the student portal for registration, results, transcripts and
              certificates; to the learning management system for course materials, assignments and
              online examinations; and to credential verification for employers. Campus life,
              support services and facilities are described on the{' '}
              <Link href="/campus-life" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Campus Life
              </Link>{' '}
              page.
            </P>
            <AwaitingAdoption
              title="Library and ICT services"
              body="A catalog is expected to describe the library a student may use and the ICT services provided. The university has not supplied either."
              needs={[
                'Library holdings, opening hours and any electronic subscriptions',
                'What ICT provision a registered student receives — accounts, storage, software, support hours',
                'Whether a research repository exists for theses',
                'Disability and learning support provision',
              ]}
            />
          </Part>

          {/* XI — Quality Assurance */}
          <Part id="quality" n="XI" title="Quality Assurance">
            <P>
              The university has been accredited by the Ministry of Higher Education continuously
              since 2007. Doctoral work is examined by the Dissertation Council.
            </P>
            <AwaitingAdoption
              title="Quality assurance framework"
              body="Accreditation by the Ministry is a fact the university can state. A quality assurance framework — how standards are set, monitored and improved — is a separate thing, and is the document an accreditation body reads most closely. It is planned as a manual in its own right."
              needs={[
                'Programme approval route and who signs it off',
                'Course and curriculum review cycles',
                'Whether external examiners are appointed, and their terms of reference',
                'Assessment moderation procedure',
                'Student and lecturer evaluation instruments',
                'Graduate attributes the university claims for its awards',
              ]}
            />
          </Part>

          {/* XII — Programmes */}
          <Part id="programmes" n="XII" title="Programmes and Course Descriptions">
            <P>
              The university offers {programs.length} programmes across {byFaculty.length} faculties
              and {courses.length} courses. Programmes are listed by faculty and by level of award.
            </P>
            {byFaculty.map((g) => (
              <div key={g.faculty.slug} className="mt-12">
                <h3 className="font-heading text-xl font-bold text-brand-purple">{g.faculty.name}</h3>
                {g.faculty.sharesProvisionWith && (
                  <p className="mt-1 text-sm text-brand-muted">
                    Taught at both the Buea and Douala campuses; the same programmes, assessments and
                    awards apply at each.
                  </p>
                )}
                {g.levels.map((l) => (
                  <div key={l.level} className="mt-7">
                    <h4 className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold-deep">
                      {l.level}
                    </h4>
                    <div className="mt-3 space-y-5">
                      {l.items.map((p) => (
                        <div key={p.slug} className="border-l-2 border-brand-sand pl-5">
                          <p className="font-heading text-[17px] font-bold text-brand-purple">{p.title}</p>
                          <p className="mt-2 text-[15px] leading-relaxed text-brand-muted">{p.summary}</p>
                          <p className="mt-2 text-sm text-brand-muted">
                            <span className="font-semibold text-brand-purple">Outcomes: </span>
                            {p.outcomes.join(' · ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {g.courses.length > 0 && (
                  <div className="mt-7">
                    <h4 className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold-deep">
                      Course codes
                    </h4>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-brand-sand">
                      <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-brand-sand/70">
                          {g.courses.map((c) => (
                            <tr key={c.code}>
                              <td className="w-24 px-4 py-2.5 font-mono text-xs font-bold text-brand-gold-deep">{c.code}</td>
                              <td className="px-4 py-2.5 font-heading font-semibold text-brand-purple">{c.title}</td>
                              <td className="px-4 py-2.5 text-right text-xs uppercase tracking-wide text-brand-muted">{c.level}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <AwaitingAdoption
              title="Course descriptions with credit values"
              body={`Course lists with the university\u2019s own codes are now published for ${curricula.length} programmes, and assessment weightings apply across all of them. What is still missing is a credit value against every course, and the reconciliation of the two incompatible B.Th. structures the university has supplied.`}
              needs={[
                'Credit values for the Diploma of Theology, whose fifteen courses are published without them',
                'Year Three of the Bachelor of Theology credit-hour structure',
                'Which structure governs the B.Th. award — 180 ECTS or the credit-hour scheme',
                'Course lists for the remaining awards',
                'Prerequisites and co-requisites',
              ]}
            />
          </Part>
        </div>

        <p className="mt-16 border-t border-brand-sand pt-8 text-center text-sm text-brand-muted">
          {site.name} · Academic Catalog, {EDITION} · {site.address} · {site.email}
          <br />
          Sections marked “In preparation” are pending adoption by the university’s academic
          bodies. This catalog is generated from the university’s published records and updates
          with them.
        </p>
      </div>
    </>
  );
}
