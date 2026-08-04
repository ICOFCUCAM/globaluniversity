import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import PageBanner from '@/components/PageBanner';
import { Section, SectionHeading } from '@/components/Section';
import Cta from '@/components/Cta';

export const metadata: Metadata = {
  title: 'Study Online — ICOF Global University',
  description:
    'Complete your degree online from anywhere. Live classes, course materials, online exams and transcripts — all in the IGUC student portal.',
};

const STEPS = [
  {
    title: '1 · Apply',
    body: 'Fill out the free online application and choose Online / Distance Learning as your mode of study. Admissions reviews your file and sends your offer.',
  },
  {
    title: '2 · Enroll',
    body: 'Once admitted, your student account is activated in the portal with your courses for the semester already assigned.',
  },
  {
    title: '3 · Learn',
    body: 'Log into your classroom from any device: download course materials, join live classes, complete assignments and sit online assessments.',
  },
  {
    title: '4 · Graduate',
    body: 'Your results, GPA and transcript build up in the same system as you progress — through to graduation and certificate issuance.',
  },
];

const FEATURES = [
  { icon: '📚', title: 'Course Materials', body: 'Lecture notes, readings and resources for every enrolled course, available for download anytime.' },
  { icon: '🎥', title: 'Live Classes', body: 'Scheduled live sessions with your lecturers — attend from anywhere with an internet connection.' },
  { icon: '📈', title: 'Progress Tracking', body: 'See your completion and performance per course, semester GPA and cumulative GPA in real time.' },
  { icon: '📝', title: 'Assignments & Exams', body: 'Submit work and sit assessments online; results flow straight into your academic record.' },
  { icon: '🎓', title: 'Transcripts & Certificates', body: 'Official transcripts generated from the same system that recorded every result.' },
  { icon: '💬', title: 'Direct Lecturer Access', body: 'Raise your virtual hand any time — you get a personal reply from your instructor, not an assistant.' },
];

export default function OnlineLearningPage() {
  return (
    <>
      <PageBanner
        title="Study Online"
        subtitle="Complete your degree online from anywhere — or on campus, depending upon your location."
        image="/images/banner.jpg"
      />

      <Section>
        <SectionHeading>How Online Study Works</SectionHeading>
        <p className="mx-auto mb-10 max-w-3xl text-center text-brand-muted">
          Attending online class is easy — all you need is a reliable internet connection. You simply
          log into your classroom to complete assignments, access course materials and resources and
          interact with faculty and classmates. This is a great solution for students who might have
          a difficult time commuting and for those who learn better independently.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.title} className="rounded-xl border border-brand-sand bg-white p-6 shadow-sm">
              <h3 className="font-heading text-lg font-bold text-brand-purple">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-white">
        <SectionHeading>Your Online Learning System</SectionHeading>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl bg-brand-cream p-6">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-3 font-heading font-bold text-brand-purple">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/portal"
            className="inline-block rounded-full bg-brand-purple px-8 py-3 font-heading font-semibold text-white transition hover:bg-brand-purple-dark"
          >
            Open the Student Portal
          </Link>
        </div>
      </Section>

      <Section>
        <SectionHeading>Programs You Can Study Online</SectionHeading>
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-brand-sand bg-white p-6 shadow-sm">
            <h3 className="font-heading text-lg font-bold text-brand-purple">
              Master’s & Doctoral Programs
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-brand-muted">
              We offer online courses for master’s and doctoral programs — including Master of
              Theology, Master of Divinity, Masters in Evangelism and Mission, Doctor of Philosophy,
              Doctor of Theology and Doctor of Ministry. Our flexible online courses let you work
              towards your degree anywhere, at any time.
            </p>
            <Link href="/degrees/masters-degrees" className="mt-4 inline-block text-sm font-semibold text-brand-gold-deep hover:underline">
              Explore graduate programs →
            </Link>
          </div>
          <div className="rounded-xl border border-brand-sand bg-white p-6 shadow-sm">
            <h3 className="font-heading text-lg font-bold text-brand-purple">
              PPDI-RC Professional Courses
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-brand-muted">
              Short professional development courses — from Digital Business Development to AI for
              Youth Leaders — taught online through the Personal Professional Development Industry
              &amp; Resource Center. Courses are free; certification is available for a small fee.
            </p>
            <Link href="/ppdirc" className="mt-4 inline-block text-sm font-semibold text-brand-gold-deep hover:underline">
              Browse PPDI-RC courses →
            </Link>
          </div>
        </div>
        <div className="relative mx-auto mt-12 h-64 max-w-4xl overflow-hidden rounded-xl shadow-lg">
          <Image src="/images/students.jpg" alt="ICOF Global University students" fill className="object-cover" />
        </div>
      </Section>

      <Cta />
    </>
  );
}
