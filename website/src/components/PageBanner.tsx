import Image from 'next/image';

export default function PageBanner({ title, image }: { title: string; image: string }) {
  return (
    <section className="relative bg-brand-purple py-20 text-center text-white">
      <Image src={image} alt="" fill className="object-cover opacity-20" />
      <h1 className="relative font-heading text-4xl font-extrabold uppercase tracking-wide text-brand-gold sm:text-5xl">
        {title}
      </h1>
    </section>
  );
}
