import Image from 'next/image';
import Link from 'next/link';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import Cta from '@/components/Cta';
import HeroSlider from '@/components/HeroSlider';
import Reveal from '@/components/Reveal';
import { getHomePage, getPrograms } from '@/lib/data';
import { partners } from '@/content/site';
import { chancellor, welcomeExcerpt } from '@/content/welcome';
import { quickIconMap } from '@/components/Icons';
import CountUp from '@/components/CountUp';

const PILLARS = [
  {
    title: 'Faith & Scholarship',
    body: 'Founded within the International Circle of Faith, we unite rigorous academic study with formation in character — nobility, professionalism and godliness.',
  },
  {
    title: 'Access for the Community',
    body: 'As the Community University of Africa, we bring accredited higher education within reach of working adults, ministers and first-generation students across Cameroon and beyond.',
  },
  {
    title: 'Practice Over Theory',
    body: 'Our instructors have lived what they teach. Programs bridge classroom and workplace so that learning is applied from the first semester.',
  },
];

export default async function HomePage() {
  const { heroSlides, quickLinks, stats, about, events, news, homeFeatures, homeFaculties, homeFaqs } =
    await getHomePage();
  const programs = (await getPrograms()).slice(0, 4);

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: homeFaqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      {/* Hero */}
      <HeroSlider slides={heroSlides} />

      {/* Quick links — the six routes most visitors arrive wanting */}
      <nav aria-label="Quick links" className="relative z-10 -mt-10 px-4">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-brand-sand/60 shadow-lift-lg ring-1 ring-brand-purple/5 sm:grid-cols-3 lg:grid-cols-6">
          {quickLinks.map((q) => {
            const Icon = quickIconMap[q.icon as keyof typeof quickIconMap];
            return (
              <Link
                key={q.label}
                href={q.href}
                className="group relative flex flex-col items-center gap-3 bg-white px-3 py-7 text-center transition hover:bg-brand-cream"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-cream text-brand-purple transition duration-300 group-hover:bg-brand-purple group-hover:text-brand-gold">
                  {Icon ? <Icon className="h-[22px] w-[22px]" /> : null}
                </span>
                <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-brand-purple">
                  {q.label}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-6 bottom-0 h-0.5 origin-center scale-x-0 rounded-full bg-brand-gold transition-transform duration-300 group-hover:scale-x-100"
                />
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Chancellor's welcome — the site opened with this on the original iguc.net */}
      <section className="relative overflow-hidden bg-brand-purple-dark py-20 text-white sm:py-24">
        <Image
          src="/images/wp/g-hall.jpg"
          alt=""
          fill
          className="object-cover opacity-[0.14]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-purple-dark via-brand-purple-dark/95 to-brand-purple/85" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-16">
          <Reveal>
            <figure className="relative mx-auto w-56 lg:w-full">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl shadow-lift-lg ring-1 ring-brand-gold/25">
                <Image
                  src={chancellor.image}
                  alt={`${chancellor.name}, Chancellor of ICOF Global University`}
                  fill
                  className="object-cover object-top"
                  sizes="(min-width:1024px) 300px, 224px"
                />
              </div>
              {/* Gold plate, as an inscribed portrait would carry */}
              <figcaption className="absolute -bottom-4 left-1/2 w-[88%] -translate-x-1/2 rounded-lg bg-brand-gold px-4 py-2 text-center shadow-gold">
                <p className="font-heading text-[13px] font-bold leading-tight text-brand-purple">
                  {chancellor.name}
                </p>
                <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-brand-purple/75">
                  Chancellor
                </p>
              </figcaption>
            </figure>
          </Reveal>

          <Reveal delay={120}>
            <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
              Welcome
            </p>
            <h2 className="font-heading text-display font-bold text-white [text-wrap:balance]">
              A word from our Chancellor
            </h2>
            <div className="mt-5 h-[3px] w-16 rounded bg-brand-gold" />

            <blockquote className="mt-8">
              {/* Oversized opening quotation set as decoration, not content */}
              <span
                aria-hidden="true"
                className="float-left -mt-4 mr-3 font-heading text-7xl leading-[0.7] text-brand-gold/40"
              >
                &ldquo;
              </span>
              <p className="text-lg leading-relaxed text-white/90 sm:text-xl">{welcomeExcerpt}</p>
            </blockquote>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <div>
                <p className="font-heading text-lg font-bold text-brand-gold">{chancellor.name}</p>
                <p className="text-sm text-white/65">
                  Presiding Bishop, International Circle of Faith
                </p>
              </div>
              <Link
                href="/welcome"
                className="group inline-flex items-center gap-2 rounded-full border-2 border-brand-gold px-7 py-3 font-heading text-sm font-semibold text-brand-gold transition hover:bg-brand-gold hover:text-brand-purple"
              >
                Read the Full Welcome
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* University overview */}
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>About the University</Eyebrow>
            <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-brand-purple sm:text-[2.6rem]">
              A university in pursuit of a brighter future
            </h2>
            <div className="mt-4 h-[3px] w-16 rounded bg-brand-gold" />
            <p className="mt-6 leading-relaxed text-brand-muted">{about.intro}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/about"
                className="rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white transition hover:bg-brand-purple-dark"
              >
                Our History &amp; Mission
              </Link>
              <Link
                href="/faculty"
                className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
              >
                Leadership &amp; Governance
              </Link>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="relative h-80 overflow-hidden rounded-2xl shadow-xl lg:h-[420px]">
              <Image src={about.image} alt="ICOF Global University ceremony" fill className="object-cover" sizes="(min-width:1024px) 50vw, 100vw" />
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Why choose */}
      <Section className="bg-white">
        <SectionHeading eyebrow="Why ICOF Global University">
          Nobility, professionalism &amp; godliness
        </SectionHeading>
        <div className="grid gap-8 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 120}>
              <div className="h-full rounded-2xl border border-brand-sand bg-brand-cream p-8">
                <span className="font-heading text-4xl font-bold text-brand-gold-deep">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-4 font-heading text-xl font-bold text-brand-purple">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-brand-muted">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Schools & Faculties */}
      <Section>
        <SectionHeading eyebrow="Academic Community">{homeFaculties.heading}</SectionHeading>
        <p className="mx-auto -mt-6 mb-10 max-w-3xl text-center text-brand-muted">{homeFaculties.intro}</p>
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {homeFaculties.items.map((f, i) => (
            <Reveal key={f.name} delay={i * 100}>
              <Link
                href="/faculty"
                className="group block overflow-hidden rounded-2xl border border-brand-sand bg-white text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-36">
                  <Image src={f.image} alt={f.name} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(min-width:1024px) 25vw, 50vw" />
                </div>
                <span className="block p-4 font-heading text-sm font-semibold text-brand-purple">{f.name}</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Programs */}
      <Section className="bg-white">
        <SectionHeading eyebrow="Degrees & Programs">Programs that shape careers</SectionHeading>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {programs.map((p, i) => (
            <Reveal key={p.slug} delay={i * 100}>
              <Link
                href={`/programs/${p.slug}`}
                className="group block h-full overflow-hidden rounded-2xl bg-brand-cream shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-40">
                  <Image src={p.image} alt={p.title} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(min-width:1024px) 25vw, 50vw" />
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-deep">{p.level}</p>
                  <h3 className="mt-1 font-heading font-semibold text-brand-purple">{p.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-brand-muted">{p.summary}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/programs"
            className="inline-block rounded-full border-2 border-brand-purple px-8 py-3 font-heading font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
          >
            Explore the Full Catalog
          </Link>
        </div>
      </Section>

      {/* Research & Innovation */}
      <section className="relative overflow-hidden bg-brand-purple py-20 text-white sm:py-24">
        <Image src="/images/wp/g-decor.jpg" alt="" fill className="object-cover opacity-10" sizes="100vw" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading light eyebrow="Research & Innovation">
            Scholarship in service of society
          </SectionHeading>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                t: 'Dissertation Council',
                b: 'Doctoral research in theology, ministry and counseling is examined by the Dissertation Council under Professor Emeritus Arch Bishop Godfred Anyere Tah, upholding international standards of scholarship.',
                href: '/degrees/doctoral',
              },
              {
                t: 'PPDI-RC, Nigeria',
                b: 'The Personal Professional Development Industry & Resource Center pursues applied research and training in behavioral therapy, agritech, digital business and community development.',
                href: '/ppdirc',
              },
              {
                t: 'Theology & African Society',
                b: 'From liberation theology to criminology, our faculty publish and teach at the intersection of faith and the social questions facing African communities.',
                href: '/research',
              },
            ].map((r, i) => (
              <Reveal key={r.t} delay={i * 120}>
                <Link href={r.href} className="block h-full rounded-2xl border border-white/15 bg-white/5 p-8 backdrop-blur transition hover:border-brand-gold/60 hover:bg-white/10">
                  <h3 className="font-heading text-xl font-bold text-brand-gold">{r.t}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/85">{r.b}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Admissions + International */}
      <Section>
        <div className="grid gap-8 lg:grid-cols-2">
          <Reveal>
            <div className="flex h-full flex-col rounded-2xl border border-brand-sand bg-white p-10 shadow-sm">
              <Eyebrow>Admissions</Eyebrow>
              <h3 className="font-heading text-2xl font-bold text-brand-purple">
                Anything you can dream, you can do
              </h3>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-brand-muted">
                From certificate to doctorate, our enrollment representatives walk with you through
                requirements, transferred coursework and financing. Applications are free, online,
                and reviewed continuously — and our support continues from enrollment to graduation
                and beyond.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/apply" className="rounded-full bg-brand-gold px-6 py-2.5 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-gold-deep">
                  Apply Now
                </Link>
                <Link href="/admissions" className="rounded-full border-2 border-brand-purple px-6 py-2.5 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white">
                  Requirements
                </Link>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="flex h-full flex-col rounded-2xl border border-brand-sand bg-white p-10 shadow-sm">
              <Eyebrow>International Students</Eyebrow>
              <h3 className="font-heading text-2xl font-bold text-brand-purple">
                A global family of learners
              </h3>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-brand-muted">
                Rooted in Buea and Douala, connected worldwide through the International Circle of
                Faith, we welcome students from every nation. English-language study, recognized
                qualifications and online delivery make an IGUC education accessible wherever you
                are.
              </p>
              <div className="mt-6">
                <Link href="/international" className="rounded-full bg-brand-purple px-6 py-2.5 font-heading text-sm font-semibold text-white transition hover:bg-brand-purple-dark">
                  International Admissions
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Global footprint */}
      <section className="bg-brand-purple-dark py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-10 text-center font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
            A Global University
          </p>
          <div className="grid gap-6 text-center sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['🏛️', 'Buea, Cameroon', 'Main campus — faculties of Theology, Education, Engineering & Technology, and GIBMAS'],
              ['⛪', 'Douala, Cameroon', 'School of Theology under Dr Bongbuen Alando'],
              ['🌍', 'Nigeria', 'PPDI-RC — professional development, research and training center'],
              ['💻', 'Online Worldwide', 'Full master’s and doctoral programs delivered to students on every continent'],
            ].map(([icon, place, desc]) => (
              <div key={place} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <span aria-hidden="true" className="text-3xl">{icon}</span>
                <h3 className="mt-3 font-heading text-lg font-bold text-brand-gold">{place}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/80">{desc}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-white/70">
            Connected through the International Circle of Faith — a worldwide fellowship of colleges,
            seminaries and ministries across Africa, the Americas, Europe and Asia — with faculty
            serving from Cameroon, Nigeria and the United States.
          </p>
        </div>
      </section>

      {/* Online learning */}
      <Section className="bg-white">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative h-72 overflow-hidden rounded-2xl shadow-xl lg:h-96">
              <Image src="/images/banner.jpg" alt="Online learning at ICOF Global University" fill className="object-cover" sizes="(min-width:1024px) 50vw, 100vw" />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <Eyebrow>Online Learning</Eyebrow>
            <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-brand-purple sm:text-[2.6rem]">
              Your classroom, wherever you are
            </h2>
            <div className="mt-4 h-[3px] w-16 rounded bg-brand-gold" />
            <p className="mt-6 leading-relaxed text-brand-muted">
              Master&apos;s and doctoral programs delivered fully online, with live classes, course
              materials, assignments and examinations in one student portal — and your results,
              GPA and transcript building automatically as you study.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/online-learning" className="rounded-full bg-brand-gold px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-gold-deep">
                How Online Study Works
              </Link>
              <Link href="/portal" className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white">
                Student Portal
              </Link>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Professional training features */}
      <Section>
        <SectionHeading eyebrow="Professional Formation">{homeFeatures.heading}</SectionHeading>
        <p className="mx-auto -mt-6 mb-10 max-w-3xl text-center text-brand-muted">{homeFeatures.intro}</p>
        <div className="grid gap-8 md:grid-cols-3">
          {homeFeatures.items.map((f, i) => (
            <Reveal key={f.title} delay={i * 120}>
              <div className="h-full rounded-2xl border border-brand-sand bg-white p-8 shadow-sm">
                <h3 className="font-heading text-lg font-bold text-brand-purple">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-brand-muted">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Success in numbers */}
      <section className="relative overflow-hidden bg-brand-purple py-20 text-white">
        {/* Faint engraved rule pattern — texture without another photograph. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, #f7dc79 0 1px, transparent 1px 22px)',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-12 text-center font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
            Student Success
          </p>
          <div className="grid grid-cols-2 gap-y-12 text-center md:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`px-4 ${i > 0 ? 'md:border-l md:border-white/12' : ''} ${
                  i === 2 ? 'border-l-0' : ''
                }`}
              >
                <p className="font-heading text-display-lg font-bold text-brand-gold">
                  <CountUp value={s.value} />
                </p>
                <p className="mt-3 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recognition */}
      <Section className="bg-white">
        <SectionHeading eyebrow="Recognition & Partners">Accreditation you can trust</SectionHeading>
        <p className="mx-auto -mt-6 mb-10 max-w-3xl text-center text-brand-muted">
          ICOF Global University is accredited by the Ministry of Higher Education of Cameroon and
          has been continually accredited since 2007, working alongside partner institutions of the
          International Circle of Faith worldwide.
        </p>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-10">
          {partners.map((p) => (
            <div key={p.name} className="relative h-20 w-32 grayscale transition hover:grayscale-0">
              <Image src={p.image} alt={p.name} fill className="object-contain" sizes="128px" />
            </div>
          ))}
        </div>
      </Section>

      {/* Events */}
      <Section>
        <SectionHeading eyebrow="Mark Your Calendar">Events</SectionHeading>
        <div className="grid gap-8 md:grid-cols-3">
          {events.map((ev, i) => (
            <Reveal key={ev.slug} delay={i * 100}>
              <article className="h-full overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-xl">
                <div className="relative h-44">
                  <Image src={ev.image} alt={ev.title} fill className="object-cover" sizes="(min-width:768px) 33vw, 100vw" />
                  <span className="absolute left-3 top-3 rounded bg-brand-gold px-2 py-1 text-xs font-bold text-brand-purple">
                    {new Date(ev.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-heading font-semibold text-brand-purple">{ev.title}</h3>
                  <p className="mt-2 text-xs text-brand-muted">
                    {new Date(ev.date).toLocaleDateString('en-GB', { dateStyle: 'long' })} · {ev.location}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* News / initiatives */}
      <Section className="bg-white">
        <SectionHeading eyebrow="News & Initiatives">What&apos;s happening</SectionHeading>
        <div className="grid gap-8 md:grid-cols-3">
          {news.map((n, i) => (
            <Reveal key={n.slug} delay={i * 100}>
              <article className="h-full overflow-hidden rounded-2xl bg-brand-cream shadow-sm transition hover:shadow-xl">
                <div className="relative h-44">
                  <Image src={n.image} alt={n.title} fill className="object-cover" sizes="(min-width:768px) 33vw, 100vw" />
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-deep">{n.category}</p>
                  <h3 className="mt-1 font-heading font-semibold text-brand-purple">{n.title}</h3>
                  <p className="mt-2 text-sm text-brand-muted">{n.excerpt}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section>
        <SectionHeading eyebrow="Questions, Answered">Frequently asked questions</SectionHeading>
        <div className="mx-auto max-w-3xl space-y-3">
          {homeFaqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-xl border border-brand-sand bg-white px-5 py-4 open:shadow-md"
            >
              <summary className="cursor-pointer list-none font-heading font-semibold text-brand-purple">
                {faq.question}
                <span aria-hidden="true" className="float-right text-brand-gold-deep transition group-open:rotate-180">⌄</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-brand-muted">{faq.answer}</p>
            </details>
          ))}
        </div>
      </Section>

      <Cta />
    </>
  );
}
