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
    <section className="relative overflow-hidden bg-brand-purple py-24 text-center text-white sm:py-28">
      <Image src={image} alt="" fill className="object-cover opacity-40" sizes="100vw" />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-purple/70 to-brand-purple-dark/90" />
      <div className="relative mx-auto max-w-3xl px-4">
        <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl [text-wrap:balance]">
          {title}
        </h1>
        <div className="mx-auto mt-5 h-[3px] w-16 rounded bg-brand-gold" />
        {subtitle && <p className="mx-auto mt-5 max-w-2xl text-lg text-brand-gold/95">{subtitle}</p>}
      </div>
    </section>
  );
}
