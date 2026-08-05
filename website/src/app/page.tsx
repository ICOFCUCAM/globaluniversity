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
import { IconCampus, IconChapel, IconGlobe, IconLaptop } from '@/components/Icons';

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

            {/* The quotation mark is positioned, not floated: a float re-flows
                only the first two lines and leaves the paragraph ragged. */}
            <blockquote className="relative mt-8 max-w-2xl pl-10">
              <span
                aria-hidden="true"
                className="absolute -top-5 left-0 select-none font-heading text-[5.5rem] leading-none text-brand-gold/30"
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
            <h2 className="font-heading text-display font-bold text-brand-purple [text-wrap:balance]">
              A university in pursuit of a brighter future
            </h2>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
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
        <div className="grid gap-6 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 120}>
              <article className="group relative h-full overflow-hidden rounded-2xl border border-brand-sand bg-brand-cream p-9 transition duration-500 hover:border-brand-gold hover:shadow-lift">
                {/* Ghost numeral sits behind the copy as a watermark */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-2 -top-6 font-heading text-[7rem] font-bold leading-none text-brand-gold/15 transition duration-700 group-hover:text-brand-gold/25"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="relative">
                  <span aria-hidden="true" className="block h-[3px] w-10 rounded-full bg-brand-gold-deep" />
                  <h3 className="mt-5 font-heading text-xl font-bold leading-snug text-brand-purple [text-wrap:balance]">
                    {p.title}
                  </h3>
                  <p className="mt-3.5 text-sm leading-relaxed text-brand-muted">{p.body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Schools & Faculties */}
      <Section>
        <SectionHeading eyebrow="Academic Community">{homeFaculties.heading}</SectionHeading>
        <p className="mx-auto -mt-5 mb-12 max-w-2xl text-center leading-relaxed text-brand-muted">{homeFaculties.intro}</p>
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {homeFaculties.items.map((f, i) => (
            <Reveal key={f.name} delay={i * 100}>
              <Link
                href="/faculty"
                className="group relative block h-72 overflow-hidden rounded-2xl shadow-lift transition duration-500 hover:-translate-y-1.5 hover:shadow-lift-lg"
              >
                <Image
                  src={f.image}
                  alt=""
                  fill
                  className="object-cover transition duration-[900ms] ease-out group-hover:scale-110"
                  sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
                />
                {/* Two stops rather than one: the name stays legible on light
                    photographs without flattening the image behind it. */}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-purple-dark via-brand-purple-dark/55 to-transparent" />
                <div className="absolute inset-0 bg-brand-purple/0 transition duration-500 group-hover:bg-brand-purple/25" />

                <div className="absolute inset-x-0 bottom-0 p-5">
                  <span
                    aria-hidden="true"
                    className="mb-3 block h-[2px] w-9 origin-left rounded-full bg-brand-gold transition-transform duration-500 group-hover:scale-x-[2.4]"
                  />
                  <h3 className="font-heading text-base font-bold leading-snug text-white [text-wrap:balance]">
                    {f.name}
                  </h3>
                  <span className="mt-2 flex items-center gap-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold opacity-0 transition duration-500 group-hover:opacity-100">
                    Explore
                    <span aria-hidden="true">→</span>
                  </span>
                </div>
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
                className="group flex h-full flex-col overflow-hidden rounded-2xl bg-brand-cream shadow-lift ring-1 ring-brand-sand/70 transition duration-500 hover:-translate-y-1.5 hover:shadow-lift-lg hover:ring-brand-gold"
              >
                <div className="relative h-44 overflow-hidden">
                  <Image
                    src={p.image}
                    alt=""
                    fill
                    className="object-cover transition duration-[900ms] ease-out group-hover:scale-110"
                    sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-purple-dark/55 to-transparent" />
                  {/* Level reads as a credential seal, not body copy */}
                  <span className="absolute left-4 top-4 rounded-full bg-brand-gold px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-purple shadow-sm">
                    {p.level}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-heading text-lg font-bold leading-snug text-brand-purple [text-wrap:balance]">
                    {p.title}
                  </h3>
                  <p className="mt-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-gold-deep">
                    {p.school}
                  </p>
                  <p className="mt-3 flex-1 line-clamp-3 text-sm leading-relaxed text-brand-muted">
                    {p.summary}
                  </p>
                  <span className="mt-5 flex items-center gap-1.5 font-heading text-sm font-semibold text-brand-purple">
                    View program
                    <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5">
                      →
                    </span>
                  </span>
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
              <h3 className="font-heading text-display-sm font-bold text-brand-purple">
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
              <h3 className="font-heading text-display-sm font-bold text-brand-purple">
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: IconCampus, place: 'Buea, Cameroon', tag: 'Main campus', desc: 'Faculties of Theology, Education, Engineering & Technology, and GIBMAS' },
              { Icon: IconChapel, place: 'Douala, Cameroon', tag: 'School of Theology', desc: 'Led by Dr Bongbuen Alando, Director of the School of Theology' },
              { Icon: IconGlobe, place: 'Nigeria', tag: 'PPDI-RC', desc: 'Professional development, applied research and training centre' },
              { Icon: IconLaptop, place: 'Online Worldwide', tag: 'Distance study', desc: 'Full master’s and doctoral programs delivered on every continent' },
            ].map(({ Icon, place, tag, desc }, i) => (
              <Reveal key={place} delay={i * 90}>
                <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.04] p-7 transition duration-500 hover:border-brand-gold/45 hover:bg-white/[0.08]">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold transition duration-500 group-hover:bg-brand-gold group-hover:text-brand-purple">
                    <Icon className="h-6 w-6" />
                  </span>
                  <p className="mt-5 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold/70">
                    {tag}
                  </p>
                  <h3 className="mt-1 font-heading text-lg font-bold text-white">{place}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-white/70">{desc}</p>
                </div>
              </Reveal>
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
            <h2 className="font-heading text-display font-bold text-brand-purple [text-wrap:balance]">
              Your classroom, wherever you are
            </h2>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
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
        <p className="mx-auto -mt-5 mb-12 max-w-2xl text-center leading-relaxed text-brand-muted">{homeFeatures.intro}</p>
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
        <p className="mx-auto -mt-5 mb-12 max-w-2xl text-center leading-relaxed text-brand-muted">
          ICOF Global University is accredited by the Ministry of Higher Education of Cameroon and
          has been continually accredited since 2007, working alongside partner institutions of the
          International Circle of Faith worldwide.
        </p>
        <ul className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-6">
          {partners.map((p, i) => (
            <li key={p.name}>
              <Reveal delay={i * 70}>
                <div
                  title={p.name}
                  className="group flex h-24 w-36 items-center justify-center rounded-xl border border-transparent px-4 transition duration-500 hover:border-brand-sand hover:bg-brand-cream"
                >
                  <div className="relative h-14 w-full opacity-55 grayscale transition duration-500 group-hover:opacity-100 group-hover:grayscale-0">
                    <Image src={p.image} alt={p.name} fill className="object-contain" sizes="144px" />
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>

        {/* The accreditation claim itself, stated plainly rather than left to the logos */}
        <div className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-4 rounded-2xl border border-brand-sand bg-brand-cream px-8 py-6 text-center">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-gold-deep">
            Ministry of Higher Education, Cameroon
          </p>
          <span aria-hidden="true" className="hidden h-4 w-px bg-brand-sand sm:block" />
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-gold-deep">
            Continuously accredited since 2007
          </p>
          <span aria-hidden="true" className="hidden h-4 w-px bg-brand-sand sm:block" />
          <Link
            href="/governance"
            className="font-heading text-sm font-semibold text-brand-purple underline underline-offset-4 hover:text-brand-gold-deep"
          >
            Governance &amp; accreditation
          </Link>
        </div>
      </Section>

      {/* Diary & initiatives — one band. Both halves were dead-end cards before;
          every item now resolves somewhere. */}
      <Section className="bg-white">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          {/* Diary */}
          <div>
            <SectionHeading eyebrow="Mark Your Calendar" align="left">
              University diary
            </SectionHeading>
            <ol className="-mt-4 divide-y divide-brand-sand border-t border-brand-sand">
              {events.map((ev, i) => {
                const date = new Date(ev.date);
                return (
                  <li key={ev.slug}>
                    <Reveal delay={i * 90}>
                      <Link
                        href="/events"
                        className="group flex items-start gap-5 py-6 transition"
                      >
                        {/* Torn-calendar block */}
                        <time
                          dateTime={ev.date}
                          className="flex w-16 shrink-0 flex-col items-center rounded-xl border border-brand-sand bg-brand-cream py-2.5 transition duration-500 group-hover:border-brand-gold group-hover:bg-brand-gold"
                        >
                          <span className="font-heading text-2xl font-bold leading-none text-brand-purple tabular">
                            {date.toLocaleDateString('en-GB', { day: '2-digit' })}
                          </span>
                          <span className="mt-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold-deep transition group-hover:text-brand-purple">
                            {date.toLocaleDateString('en-GB', { month: 'short' })}
                          </span>
                          <span className="font-sans text-[9px] text-brand-muted transition group-hover:text-brand-purple/70">
                            {date.getFullYear()}
                          </span>
                        </time>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-heading text-base font-bold text-brand-purple transition group-hover:text-brand-gold-deep">
                            {ev.title}
                          </h3>
                          <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">{ev.location}</p>
                        </div>
                      </Link>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
            <Link
              href="/events"
              className="mt-7 inline-flex items-center gap-1.5 font-heading text-sm font-semibold text-brand-purple hover:text-brand-gold-deep"
            >
              All events and important dates
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {/* Initiatives */}
          <div>
            <SectionHeading eyebrow="Support the Work" align="left">
              Our initiatives
            </SectionHeading>
            <div className="-mt-4 grid gap-5 sm:grid-cols-3">
              {news.map((n, i) => (
                <Reveal key={n.slug} delay={i * 100}>
                  <Link
                    href={n.href}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl bg-brand-cream shadow-lift ring-1 ring-brand-sand/70 transition duration-500 hover:-translate-y-1.5 hover:shadow-lift-lg hover:ring-brand-gold"
                  >
                    <div className="relative h-36 overflow-hidden">
                      <Image
                        src={n.image}
                        alt=""
                        fill
                        className="object-cover transition duration-[900ms] ease-out group-hover:scale-110"
                        sizes="(min-width:1024px) 20vw, (min-width:640px) 33vw, 100vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-purple-dark/50 to-transparent" />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold-deep">
                        {n.category}
                      </p>
                      <h3 className="mt-1.5 font-heading text-[15px] font-bold leading-snug text-brand-purple [text-wrap:balance]">
                        {n.title}
                      </h3>
                      <p className="mt-2.5 flex-1 line-clamp-4 text-[13px] leading-relaxed text-brand-muted">
                        {n.excerpt}
                      </p>
                      <span className="mt-4 flex items-center gap-1.5 font-heading text-[13px] font-semibold text-brand-purple">
                        Learn more
                        <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5">
                          →
                        </span>
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section>
        <SectionHeading eyebrow="Questions, Answered">Frequently asked questions</SectionHeading>
        <div className="mx-auto max-w-3xl divide-y divide-brand-sand overflow-hidden rounded-2xl border border-brand-sand bg-white">
          {homeFaqs.map((faq) => (
            <details key={faq.question} className="group">
              <summary className="flex cursor-pointer list-none items-start gap-4 px-6 py-5 transition hover:bg-brand-cream">
                <span className="flex-1 font-heading text-[17px] font-semibold leading-snug text-brand-purple">
                  {faq.question}
                </span>
                {/* Plus that becomes a minus — two rules, no icon font, no glyph
                    that renders differently between platforms. */}
                <span
                  aria-hidden="true"
                  className="relative mt-1 h-5 w-5 shrink-0 rounded-full border border-brand-gold-deep/40 text-brand-gold-deep transition duration-300 group-open:rotate-180 group-open:bg-brand-gold-deep"
                >
                  <span className="absolute left-1/2 top-1/2 h-[1.5px] w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition group-open:bg-white" />
                  <span className="absolute left-1/2 top-1/2 h-2.5 w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition duration-300 group-open:scale-y-0" />
                </span>
              </summary>
              <div className="px-6 pb-6 pr-14">
                <p className="text-[15px] leading-relaxed text-brand-muted">{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-brand-muted">
          Still deciding?{' '}
          <Link href="/contact" className="font-semibold text-brand-purple underline underline-offset-4 hover:text-brand-gold-deep">
            Talk to an enrollment representative
          </Link>
          {' '}or{' '}
          <Link href="/admissions" className="font-semibold text-brand-purple underline underline-offset-4 hover:text-brand-gold-deep">
            read the admission requirements
          </Link>
          .
        </p>
      </Section>

      <Cta />
    </>
  );
}
