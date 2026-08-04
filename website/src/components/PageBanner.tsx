import Image from 'next/image';

export default function PageBanner({
  title,
  subtitle,
  image,
}: {
  title: string;
  subtitle?: string;
  image: string;
}) {
  return (
    <section className="relative bg-brand-purple py-20 text-center text-white">
      <Image src={image} alt="" fill className="object-cover opacity-20" />
      <h1 className="relative font-heading text-4xl font-extrabold uppercase tracking-wide text-brand-gold sm:text-5xl">
        {title}
      </h1>
      {subtitle && <p className="relative mx-auto mt-4 max-w-2xl px-4 text-white/90">{subtitle}</p>}
    </section>
  );
}
