import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-heading text-6xl font-extrabold text-brand-purple">404</h1>
      <p className="mt-4 text-brand-muted">The page you are looking for could not be found.</p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-brand-gold px-8 py-3 font-heading font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
      >
        Back to Home
      </Link>
    </section>
  );
}
