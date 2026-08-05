import type { Metadata } from 'next';
import Link from 'next/link';
import PageBanner from '@/components/PageBanner';
import { site, contact } from '@/content/site';
import { contentPages } from '@/content/pages';
import { gradeScale, passMark, refundSchedule, withdrawalRules, paymentTerms, loadRules } from '@/content/regulations';

export const metadata: Metadata = {
  title: 'Student Handbook — ICOF Global University',
  description:
    'Student rights and responsibilities, code of conduct, academic misconduct, fees and withdrawal, complaints and the graduation process at ICOF Global University.',
  alternates: { canonical: '/student-handbook' },
};

const PARTS = [
  { id: 'rights', n: 'I', title: 'Student Rights' },
  { id: 'responsibilities', n: 'II', title: 'Student Responsibilities' },
  { id: 'conduct', n: 'III', title: 'Code of Conduct' },
  { id: 'misconduct', n: 'IV', title: 'Academic Misconduct and Discipline' },
  { id: 'progress', n: 'V', title: 'Study Load, Grades and Progress' },
  { id: 'money', n: 'VI', title: 'Fees, Withdrawal and Refunds' },
  { id: 'complaints', n: 'VII', title: 'Complaints and Appeals' },
  { id: 'graduation', n: 'VIII', title: 'Graduation' },
  { id: 'gaps', n: 'IX', title: 'Sections Still to be Adopted' },
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

function Awaiting({ title, needs }: { title: string; needs: string[] }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-brand-gold/60 bg-brand-cream/70 p-6">
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold-deep">In preparation</p>
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

export default function StudentHandbookPage() {
  const policies = contentPages.find((c) => c.slug === 'policies');
  const conduct = policies?.sections.find((s) => s.heading === 'Code of Conduct');
  const process = policies?.sections.find((s) => s.heading === 'Disciplinary Process');
  const actions = policies?.sections.find((s) => s.heading === 'Range of Disciplinary Actions');
  const dueProcess = policies?.sections.find((s) => s.heading === 'Due Process');

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: 'Student Handbook',
    url: `${site.url}/student-handbook`,
    publisher: { '@id': `${site.url}/#organization` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner
        title="Student Handbook"
        subtitle="What you may expect of the university, and what the university expects of you."
        image="/images/students.jpg"
        eyebrow="For registered students"
      />

      <div className="border-b border-brand-sand bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 py-5 sm:px-6">
          <a href="#contents" className="rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white shadow-lift transition hover:bg-brand-purple-dark">
            Contents
          </a>
          <Link href="/academic-regulations" className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white">
            Academic Regulations
          </Link>
          <Link href="/portal" className="rounded-full border-2 border-brand-sand px-7 py-3 font-heading text-sm font-semibold text-brand-muted transition hover:border-brand-gold hover:text-brand-purple">
            Student Portal
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
          <Part id="rights" n="I" title="Student Rights">
            <P>
              These rights are drawn from commitments the university has already made in its
              policies and in its Student Fees Guide. They are stated here in one place so that a
              student does not have to assemble them from several documents.
            </P>
            <Rules
              items={[
                'To be taught in an environment free from discrimination on grounds of race, gender, sexual orientation, religion, disability or any other protected characteristic.',
                'To be treated with mutual respect, and to study free from harassment and bullying.',
                'To be heard before a disciplinary decision is taken, to present evidence, and to appeal that decision before an independent panel.',
                'To receive a fee statement quarterly, and to be told of any change to fees immediately it is made.',
                'To request a refund of surplus money paid, credited electronically to the paying account.',
                'To withdraw from study and receive the refund set out in Part VI, provided a Withdrawal Form is submitted.',
                'To apply for a bursary, scholarship or funding in the second semester, considered on financial need, academic performance and character.',
                'To receive the same curriculum, assessment and award at either campus — a student in Douala studies the same material as a student in Buea.',
              ]}
            />
          </Part>

          <Part id="responsibilities" n="II" title="Student Responsibilities">
            <Rules
              items={[
                'To uphold honesty in all academic work, and to avoid plagiarism, cheating and every other form of academic dishonesty.',
                'To comply with local and national law, and with the university’s own regulations.',
                'To register by the published date. Registration dates are posted at all university communication centres, and not having seen them does not excuse a late registration.',
                'To meet published payment deadlines, whether or not a fee statement has been received.',
                'To keep the university informed of a correct postal and account address, and to follow up unpaid amounts on your own account.',
                'To submit a Withdrawal Form and await clearance before leaving a programme.',
                'To attend the seminars required by your level of study — two five-day seminars a year at Master’s level, four one-week doctoral seminars a year at doctoral level.',
              ]}
            />
          </Part>

          <Part id="conduct" n="III" title="Code of Conduct">
            {conduct?.paragraphs?.map((p, i) => <P key={i}>{p}</P>)}
            {conduct?.list && <Rules items={conduct.list} />}
          </Part>

          <Part id="misconduct" n="IV" title="Academic Misconduct and Discipline">
            <P>
              Academic integrity is the first obligation in the Code of Conduct. A breach is handled
              through the disciplinary process below.
            </P>
            {process?.list && <Rules items={process.list} />}
            <h3 className="mt-10 font-heading text-xl font-bold text-brand-purple">Range of disciplinary actions</h3>
            {actions?.list && <Rules items={actions.list} />}
          </Part>

          <Part id="progress" n="V" title="Study Load, Grades and Progress">
            <P>
              The pass mark is <strong className="font-semibold text-brand-purple">{passMark}</strong>.
              Grades run from A at {gradeScale[0].range} to F below {passMark}, and the full scale
              with grade points is set out in the{' '}
              <Link href="/academic-regulations#grading" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Academic Regulations
              </Link>
              .
            </P>
            <h3 className="mt-10 font-heading text-xl font-bold text-brand-purple">Study load</h3>
            <ul className="mt-5 space-y-3">
              {loadRules.map((r) => (
                <li key={r.level} className="flex flex-col gap-1 border-l-2 border-brand-sand pl-5 text-[15px] leading-relaxed">
                  <span className="font-heading font-semibold text-brand-purple">{r.level}</span>
                  <span className="text-brand-muted">{r.load}</span>
                </li>
              ))}
            </ul>
          </Part>

          <Part id="money" n="VI" title="Fees, Withdrawal and Refunds">
            <P>
              The terms below are the ones most often relied on. The complete fee schedule, the
              charges payable in addition to tuition and the terms for sponsors are in the{' '}
              <Link href="/academic-regulations#fees" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Academic Regulations
              </Link>
              .
            </P>
            <Rules items={paymentTerms.slice(0, 6)} />
            <h3 className="mt-10 font-heading text-xl font-bold text-brand-purple">Withdrawal</h3>
            <Rules items={withdrawalRules} />
            <h3 className="mt-10 font-heading text-xl font-bold text-brand-purple">Refund schedule</h3>
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
          </Part>

          <Part id="complaints" n="VII" title="Complaints and Appeals">
            <P>
              The university commits to due process in all disciplinary proceedings: the right to be
              heard, the right to present evidence, and the right to appeal before an independent
              panel.
            </P>
            {dueProcess?.paragraphs?.map((p, i) => <P key={i}>{p}</P>)}
            <P>
              Until the procedure below is adopted, a complaint should be raised in writing with the
              faculty responsible for your programme, copied to {contact.email}.
            </P>
            <Awaiting
              title="Formal complaints procedure"
              needs={[
                'The stages of a complaint, and who hears it at each stage',
                'The time limit for bringing a complaint, and for the university to respond',
                'Who sits on the independent appeal panel, and how it is convened',
                'A separate route for complaints about a member of staff',
              ]}
            />
          </Part>

          <Part id="graduation" n="VIII" title="Graduation">
            <P>
              A graduating student with outstanding fees will have a hold placed on transcripts,
              diplomas and degrees until those fees are paid in full. Certificates are charged at
              10,000 FCFA and academic records at 2,000 FCFA; the full list is in the Academic
              Regulations.
            </P>
            <P>
              Doctoral candidates complete all required coursework, pass comprehensive examinations
              and defend the dissertation before a faculty committee.
            </P>
            <Awaiting
              title="Graduation requirements by award"
              needs={[
                'The credit total required for each award',
                'The minimum cumulative GPA required to graduate',
                'Any residency requirement — how much of the award must be taken at ICOF',
                'Degree classification bands: what GPA earns a distinction, merit or pass',
              ]}
            />
          </Part>

          <Part id="gaps" n="IX" title="Sections Still to be Adopted">
            <P>
              A student handbook is only as good as its weakest section, so the ones the university
              has not yet decided are named here rather than filled with plausible text.
            </P>
            <Awaiting
              title="Attendance policy"
              needs={[
                'The minimum attendance required to sit an examination',
                'What happens when a student falls below it',
                'How attendance is recorded for online and distance students',
              ]}
            />
            <Awaiting
              title="Dress code"
              needs={['Whether a dress code applies, and if so its terms', 'Whether the official wear batch and T-shirt in the fee schedule are compulsory']}
            />
            <Awaiting
              title="Student government, clubs and societies"
              needs={[
                'Whether a student government exists, and its constitution',
                'How student representatives are elected and where they sit',
                'What clubs and societies are recognised',
              ]}
            />
            <Awaiting
              title="Examination regulations"
              needs={[
                'Entry conditions and registration deadlines for examinations',
                'Conduct of examinations and the penalties for misconduct',
                'Absence, deferral and resit rules',
                'The conditions under which a supplementary examination is granted',
              ]}
            />
          </Part>
        </div>

        <p className="mt-16 border-t border-brand-sand pt-8 text-center text-sm text-brand-muted">
          {site.name} · Student Handbook · {contact.address} · {contact.email} · {contact.phone}
        </p>
      </div>
    </>
  );
}
