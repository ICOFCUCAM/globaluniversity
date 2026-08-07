// ---------------------------------------------------------------------------
// Faculty handbooks — one per faculty, generated.
//
// The university asked for a handbook for every faculty, covering what is
// common to all of that faculty's awards rather than to any single one. Most
// of it already exists: the dean's welcome, the award ladder, the course list,
// the research strengths and the assessment scheme are all published elsewhere
// on this site and are gathered here in the order a registered student needs
// them.
//
// Three sections cannot be generated, and are named rather than invented:
// faculty history, the practicum and ministry requirements, and the chapel
// requirement. A handbook that guessed at a compulsory chapel attendance rule
// would be worse than one that admits the rule has not been set.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageBanner from '@/components/PageBanner';
import { facultyList, getFaculty } from '@/content/faculties';
import { administration, lecturers, programs, site, contact } from '@/content/site';
import { courses } from '@/content/courses';
import { assessmentSchemes, gradeScale, passMark, loadRules } from '@/content/regulations';
import { curricula } from '@/content/curricula';

export function generateStaticParams() {
  return facultyList.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const f = getFaculty(params.slug);
  if (!f) return { title: 'Faculty Handbook — ICOF Global University' };
  return {
    title: `${f.shortName} Faculty Handbook — ICOF Global University`,
    description: `Handbook for students of the ${f.name}: programmes, course descriptions, assessment, research expectations and graduation requirements.`,
    alternates: { canonical: `/faculty/${f.slug}/handbook` },
  };
}

const LEVELS = ['Certificate', 'Diploma', 'Bachelor', 'Master', 'Doctorate'] as const;

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

function Awaiting({ title, body, needs }: { title: string; body: string; needs: string[] }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-brand-gold/60 bg-brand-cream/70 p-6">
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold-ink">In preparation</p>
      <h3 className="mt-2 font-heading text-lg font-bold text-brand-purple">{title}</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-brand-muted">{body}</p>
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

export default function FacultyHandbookPage({ params }: { params: { slug: string } }) {
  const f = getFaculty(params.slug);
  if (!f) notFound();

  const isTheology = f.courseFaculty === 'Faculty of Theology';
  const facultyPrograms = f.programSchool ? programs.filter((p) => p.school === f.programSchool) : [];
  const facultyCourses = f.courseFaculty ? courses.filter((c) => c.faculty === f.courseFaculty) : [];
  const facultyCurricula = curricula.filter((c) => facultyPrograms.some((p) => p.slug === c.programSlug));
  const norm = (s: string) => s.replace(/[,.]/g, '').trim().toLowerCase();
  const lead = f.leadName
    ? [...administration, ...lecturers].find(
        (p) => norm(p.name) === norm(f.leadName!) || norm(p.name).startsWith(norm(f.leadName!)),
      )
    : undefined;

  const ladder = LEVELS.map((level) => ({
    level,
    items: facultyPrograms.filter((p) => p.level === level),
  })).filter((r) => r.items.length > 0);

  const PARTS = [
    { id: 'welcome', n: 'I', title: 'Dean’s Welcome' },
    { id: 'about', n: 'II', title: 'About the Faculty' },
    { id: 'programmes', n: 'III', title: 'Programmes' },
    { id: 'courses', n: 'IV', title: 'Course Descriptions' },
    { id: 'assessment', n: 'V', title: 'Assessment and Grading' },
    ...(isTheology ? [{ id: 'formation', n: 'VI', title: 'Practicum, Ministry and Chapel' }] : []),
    { id: 'research', n: isTheology ? 'VII' : 'VI', title: 'Research Expectations' },
    { id: 'graduation', n: isTheology ? 'VIII' : 'VII', title: 'Graduation Requirements' },
    { id: 'contact', n: isTheology ? 'IX' : 'VIII', title: 'Contact' },
  ];

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: `${f.name} — Faculty Handbook`,
    url: `${site.url}/faculty/${f.slug}/handbook`,
    publisher: { '@id': `${site.url}/#organization` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner
        title={`${f.shortName} Faculty Handbook`}
        subtitle={`For students of the ${f.name} — programmes, assessment, research expectations and graduation.`}
        image={f.image}
        eyebrow={f.campus}
      />

      <div className="border-b border-brand-sand bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 py-5 sm:px-6">
          <a href="#contents" className="rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white shadow-lift transition hover:bg-brand-purple-dark">
            Contents
          </a>
          <Link href={`/faculty/${f.slug}`} className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white">
            Faculty page
          </Link>
          <Link href="/student-handbook" className="rounded-full border-2 border-brand-sand px-7 py-3 font-heading text-sm font-semibold text-brand-muted transition hover:border-brand-gold hover:text-brand-purple">
            Student Handbook
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
          <Part id="welcome" n="I" title="Dean’s Welcome">
            {lead && (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {lead.image && (
                  <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl ring-1 ring-brand-sand">
                    <Image src={lead.image} alt={lead.name} fill className="object-cover object-top" sizes="128px" />
                  </div>
                )}
                <div>
                  <p className="font-heading text-lg font-bold text-brand-purple">{lead.name}</p>
                  <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold-ink">
                    {f.leadTitle ?? lead.role} · {f.shortName}
                  </p>
                </div>
              </div>
            )}
            {f.deansMessage?.map((p, i) => <P key={i}>{p}</P>)}
          </Part>

          <Part id="about" n="II" title="About the Faculty">
            {(f.about ?? f.description).map((p, i) => (
              <P key={i}>{p}</P>
            ))}
            {f.pillars && (
              <>
                <h3 className="mt-10 font-heading text-xl font-bold text-brand-purple">What the faculty stands for</h3>
                <ul className="mt-4 space-y-2.5">
                  {f.pillars.map((p) => (
                    <li key={p} className="flex gap-3 text-[15px] leading-relaxed text-brand-muted">
                      <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-brand-gold-deep" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Awaiting
              title="Faculty history and academic calendar"
              body="A faculty handbook normally opens with the faculty's own history and the year's dates. Neither has been supplied."
              needs={[
                'When the faculty was founded, and by whom',
                'Milestones a student would want to know',
                'Semester dates, registration windows and examination periods for this faculty',
              ]}
            />
          </Part>

          <Part id="programmes" n="III" title="Programmes">
            <P>
              The faculty awards {facultyPrograms.length} programmes across {ladder.length}{' '}
              {ladder.length === 1 ? 'level' : 'levels'}.
            </P>
            {ladder.map((r) => (
              <div key={r.level} className="mt-7">
                <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold-ink">
                  {r.level}
                </h3>
                <ul className="mt-3 space-y-3">
                  {r.items.map((p) => (
                    <li key={p.slug} className="border-l-2 border-brand-sand pl-5">
                      <Link href={`/programs/${p.slug}`} className="font-heading text-[16px] font-bold text-brand-purple underline decoration-brand-gold underline-offset-4">
                        {p.title}
                      </Link>
                      <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">{p.summary}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <h3 className="mt-10 font-heading text-xl font-bold text-brand-purple">Study load</h3>
            <ul className="mt-4 space-y-2.5">
              {loadRules.map((r) => (
                <li key={r.level} className="text-[15px] leading-relaxed">
                  <span className="font-heading font-semibold text-brand-purple">{r.level}. </span>
                  <span className="text-brand-muted">{r.load}</span>
                </li>
              ))}
            </ul>
          </Part>

          <Part id="courses" n="IV" title="Course Descriptions">
            {facultyCurricula.length > 0 ? (
              <>
                <P>
                  Full course lists with the faculty&rsquo;s own codes are published for{' '}
                  {facultyCurricula.length} programme{facultyCurricula.length === 1 ? '' : 's'}.
                </P>
                <ul className="mt-4 space-y-2.5">
                  {facultyCurricula.map((c) => (
                    <li key={c.programSlug} className="text-[15px] leading-relaxed">
                      <Link href={`/programs/${c.programSlug}`} className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                        {c.title}
                      </Link>
                      <span className="text-brand-muted">
                        {' '}— {c.duration}, {c.terms.reduce((n, t) => n + t.courses.length, 0)} courses
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <P>No course list with codes has been supplied for this faculty&rsquo;s programmes yet.</P>
            )}
            <h3 className="mt-10 font-heading text-xl font-bold text-brand-purple">
              Course catalogue ({facultyCourses.length})
            </h3>
            <div className="mt-4 overflow-hidden rounded-2xl border border-brand-sand">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-brand-sand/70">
                  {facultyCourses.map((c) => (
                    <tr key={c.code}>
                      <td className="w-24 px-4 py-2.5 font-mono text-xs font-bold text-brand-gold-ink">{c.code}</td>
                      <td className="px-4 py-2.5 font-heading font-semibold text-brand-purple">{c.title}</td>
                      <td className="px-4 py-2.5 text-right text-xs uppercase tracking-wide text-brand-muted">{c.level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Part>

          <Part id="assessment" n="V" title="Assessment and Grading">
            <P>
              The pass mark is {passMark}, and grades run from A at {gradeScale[0].range} to F.
              The full scale with grade points is in the{' '}
              <Link href="/academic-regulations#grading" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Academic Regulations
              </Link>
              .
            </P>
            {assessmentSchemes.slice(0, 2).map((a) => (
              <div key={a.applies} className="mt-8">
                <h3 className="font-heading text-[17px] font-bold text-brand-purple">{a.applies}</h3>
                <div className="mt-4 overflow-hidden rounded-2xl border border-brand-sand">
                  <table className="w-full text-left text-[15px]">
                    <tbody className="divide-y divide-brand-sand/70">
                      {a.components.map((c) => (
                        <tr key={c.name}>
                          <td className="px-5 py-3 text-brand-muted">{c.name}</td>
                          <td className="w-24 px-5 py-3 tabular font-semibold text-brand-purple">{c.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </Part>

          {isTheology && (
            <Part id="formation" n="VI" title="Practicum, Ministry and Chapel">
              <P>
                Theological formation at ICOF is not confined to the lecture room. Students take
                part in chapel services, prayer retreats, community outreach, mission internships,
                leadership conferences, student theological societies, research seminars, ministry
                practicums and community service.
              </P>
              <P>
                The Bachelor of Ministry carries supervised placement throughout, and the Bachelor
                of Theology includes internships, practicums and service-learning.
              </P>
              <Awaiting
                title="Practicum, ministry and chapel requirements"
                body="What a student must actually do to satisfy these — and whether chapel attendance is compulsory — has not been set. This is the one section of a theology faculty handbook a student is most likely to be assessed against, so nothing is stated in its place."
                needs={[
                  'Practicum hours required by award, and over what period',
                  'How a placement is approved, who supervises it and how it is assessed',
                  'Ministry requirements — what a student must do outside class to qualify',
                  'Whether chapel attendance is compulsory, how often, and how it is recorded',
                  'Whether any of the above carries credit',
                ]}
              />
            </Part>
          )}

          <Part id="research" n={isTheology ? 'VII' : 'VI'} title="Research Expectations">
            {f.researchStrengths && (
              <>
                <P>
                  Research in this faculty concentrates on {f.researchStrengths.length} areas.
                  Students are encouraged to pursue research contributing both to academic
                  scholarship and to practical service.
                </P>
                <ul className="mt-5 flex flex-wrap gap-2.5">
                  {f.researchStrengths.map((r) => (
                    <li key={r} className="rounded-full border border-brand-sand bg-white px-4 py-2 font-sans text-sm text-brand-muted shadow-sm">
                      {r}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <P>
              Research degree candidates should read the{' '}
              <Link href="/graduate-school-handbook" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Graduate School Handbook
              </Link>
              , which sets out admission, comprehensive examinations, research methodologies and
              the dissertation.
            </P>
          </Part>

          <Part id="graduation" n={isTheology ? 'VIII' : 'VII'} title="Graduation Requirements">
            <P>
              A graduating student with outstanding fees will have a hold placed on transcripts,
              diplomas and degrees until those fees are paid in full.
            </P>
            <P>
              Doctoral candidates complete all required coursework, pass comprehensive
              examinations, and defend the dissertation before a faculty committee.
            </P>
            <Awaiting
              title="Credit totals, GPA minimum and classification"
              body="The requirements to graduate from each award in this faculty have not been adopted."
              needs={[
                'Credit total required for each award',
                'Minimum cumulative GPA to graduate',
                'Residency requirement — how much must be taken at ICOF',
                'Degree classification bands and their names',
              ]}
            />
          </Part>

          <Part id="contact" n={isTheology ? 'IX' : 'VIII'} title="Contact">
            <P>
              {f.name}
              <br />
              {f.campus}
              {f.leadName ? ` · ${f.leadTitle ?? 'Dean'}: ${f.leadName}` : ''}
              <br />
              {contact.address}
              <br />
              {contact.phone} · {contact.email}
            </P>
          </Part>
        </div>

        <p className="mt-16 border-t border-brand-sand pt-8 text-center text-sm text-brand-muted">
          {site.name} · {f.name} Handbook · Sections marked “In preparation” are pending adoption.
        </p>
      </div>
    </>
  );
}
