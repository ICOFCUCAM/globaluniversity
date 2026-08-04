import type { Metadata } from 'next';
import PageBanner from '@/components/PageBanner';
import { Section } from '@/components/Section';
import ApplyForm from '@/components/ApplyForm';

export const metadata: Metadata = {
  title: 'Apply Now — ICOF Global University',
  description:
    'Fill out the free online application to ICOF Global University — certificate, diploma, undergraduate, master’s and doctoral programs.',
};

export default function ApplyPage() {
  return (
    <>
      <PageBanner
        title="Apply Now"
        subtitle="Anything you can dream, you can do — fill out our free online application today."
        image="/images/admission-banner.jpg"
      />
      <Section>
        <div className="mx-auto max-w-3xl">
          <ApplyForm />
        </div>
      </Section>
    </>
  );
}
