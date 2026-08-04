'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { HeroSlide } from '@/content/site';

export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, [slides.length, paused]);

  return (
    <section
      className="relative overflow-hidden bg-brand-purple text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
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
            className="object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-purple/70 via-brand-purple/55 to-brand-purple-dark/90" />
          <div className="relative mx-auto max-w-4xl px-4 py-32 text-center sm:py-44">
            <h1 className="font-heading text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl [text-wrap:balance]">
              {slide.title}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-gold/95">{slide.text}</p>
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
