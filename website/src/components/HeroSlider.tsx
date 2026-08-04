'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { HeroSlide } from '@/content/site';

export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="relative overflow-hidden bg-brand-purple text-white">
      {slides.map((slide, i) => (
        <div
          key={slide.title}
          className={`transition-opacity duration-1000 ${
            i === current ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'
          }`}
          aria-hidden={i !== current}
        >
          <Image
            src={slide.image}
            alt=""
            fill
            priority={i === 0}
            className="object-cover opacity-25"
          />
          <div className="relative mx-auto max-w-4xl px-4 py-28 text-center sm:py-36">
            <h1 className="font-heading text-4xl font-extrabold uppercase leading-tight tracking-wide text-brand-gold sm:text-6xl">
              {slide.title}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-white/90">{slide.text}</p>
            <Link
              href={slide.cta.href}
              className="mt-10 inline-block rounded-full bg-brand-gold px-8 py-3 font-heading font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
              tabIndex={i === current ? 0 : -1}
            >
              🎓 {slide.cta.label}
            </Link>
          </div>
        </div>
      ))}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {slides.map((s, i) => (
          <button
            key={s.title}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setCurrent(i)}
            className={`h-2.5 rounded-full transition-all ${
              i === current ? 'w-8 bg-brand-gold' : 'w-2.5 bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
