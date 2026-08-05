import Image from 'next/image';
import Link from 'next/link';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import Cta from '@/components/Cta';
import HeroSlider from '@/components/HeroSlider';
import Reveal from '@/components/Reveal';
import { getHomePage, getPrograms } from '@/lib/data';
import { partners, site } from '@/content/site';
import { chancellor, welcomeExcerpt } from '@/content/welcome';
import { quickIconMap } from '@/components/Icons';
import CountUp from '@/components/CountUp';
import { Aurora, Grain, Seam } from '@/components/Atmosphere';
import KineticText from '@/components/KineticText';
import { SpotlightGroup, SpotlightCard } from '@/components/Spotlight';
import ProgramRibbon from '@/components/ProgramRibbon';
import ScrollRail from '@/components/ScrollRail';
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
  const allPrograms = await getPrograms();
  const programs = allPrograms.slice(0, 4);
  // Real program titles, deduplicated — the ribbon must never invent a field.
  const ribbon = Array.from(new Map(allPrograms.map((p) => [p.title, p])).values()).map((p) => ({
    label: p.title,
    href: `/programs/${p.slug}`,
  }));

  // One @graph rather than three separate script tags: the university, the
  // questions and the featured programs, cross-referenced by @id so search
  // engines resolve them as one entity instead of three unrelated blobs.
  const homeLd = {
    '@context': 'https://schema.org',
    '@graph': [
      // The university itself is declared once in the root layout; this graph
      // references it by @id instead of emitting a second, competing node.
      {
        '@type': 'WebSite',
        '@id': `${site.url}/#website`,
        url: site.url,
        name: site.name,
        publisher: { '@id': `${site.url}/#organization` },
        inLanguage: 'en',
      },
      {
        '@type': 'FAQPage',
        '@id': `${site.url}/#faq`,
        mainEntity: homeFaqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
      {
        '@type': 'ItemList',
        '@id': `${site.url}/#featured-programs`,
        name: 'Featured programs',
        itemListElement: programs.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Course',
            name: p.title,
            description: p.summary,
            url: `${site.url}/programs/${p.slug}`,
            provider: { '@id': `${site.url}/#organization` },
          },
        })),
      },
      ...events.map((ev) => ({
        '@type': 'Event',
        name: ev.title,
        startDate: ev.date,
        location: { '@type': 'Place', name: ev.location },
        organizer: { '@id': `${site.url}/#organization` },
        eventStatus: 'https://schema.org/EventScheduled',
      })),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeLd) }} />
      <ScrollRail />

      {/* Hero */}
      <HeroSlider slides={heroSlides} />

      {/* Quick links — the six routes most visitors arrive wanting */}
      <nav aria-label="Quick links" className="relative z-10 -mt-14 px-4">
        <SpotlightGroup className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-brand-sand/60 shadow-lift-lg ring-1 ring-brand-purple/5 backdrop-blur-xl sm:grid-cols-3 lg:grid-cols-6">
          {quickLinks.map((q) => {
            const Icon = quickIconMap[q.icon as keyof typeof quickIconMap];
            return (
              <SpotlightCard key={q.label} tone="light">
                <Link
                  href={q.href}
                  className="group relative flex h-full flex-col items-center gap-3 bg-white/95 px-3 py-8 text-center transition duration-300 hover:bg-brand-cream"
                >
                  {/* Icon well lifts and inverts; the glyph itself never scales,
                      so 1.5px strokes stay 1.5px. */}
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-cream text-brand-purple ring-1 ring-brand-sand/60 transition duration-500 group-hover:-translate-y-1 group-hover:bg-brand-purple group-hover:text-brand-gold group-hover:shadow-lift">
                    {Icon ? <Icon className="h-[22px] w-[22px]" /> : null}
                  </span>
                  <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-brand-purple">
                    {q.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-5 bottom-0 h-[3px] origin-center scale-x-0 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold transition-transform duration-500 group-hover:scale-x-100"
                  />
                </Link>
              </SpotlightCard>
            );
          })}
        </SpotlightGroup>
      </nav>

      {/* Chancellor's welcome — the site opened with this on the original iguc.net */}
      <section data-chapter="Welcome" className="relative overflow-hidden bg-brand-purple-dark py-20 text-white sm:py-24">
        <Image
          src="/images/wp/g-hall.jpg"
          alt=""
          fill
          className="object-cover opacity-[0.14]"
          quality={60}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-purple-dark via-brand-purple-dark/95 to-brand-purple/85" />
        <Aurora tone="dual" intensity={0.9} />
        <Grain />
        <Seam />
        <Seam flip />

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
            <KineticText className="font-heading text-display font-bold text-white [text-wrap:balance]">
              A word from our Chancellor
            </KineticText>
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
      <Section chapter="About">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>About the University</Eyebrow>
            <KineticText className="font-heading text-display font-bold text-brand-purple [text-wrap:balance]">
              A university in pursuit of a brighter future
            </KineticText>
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
              <Image
                src={about.image}
                alt="Graduands at an ICOF Global University ceremony"
                fill
                loading="lazy"
                quality={82}
                className="object-cover transition duration-[900ms] ease-out hover:scale-105"
                sizes="(min-width:1024px) 45vw, 100vw"
              />
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Why choose */}
      <Section chapter="Why IGUC" className="bg-white">
        <SectionHeading eyebrow="Why ICOF Global University">
          Nobility, professionalism &amp; godliness
        </SectionHeading>
        <SpotlightGroup className="grid gap-6 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 120}>
              <SpotlightCard className="group h-full overflow-hidden rounded-2xl border border-brand-sand bg-brand-cream p-9 transition duration-500 hover:shadow-lift" tone="light">
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
              </SpotlightCard>
            </Reveal>
          ))}
        </SpotlightGroup>
      </Section>

      {/* Schools & Faculties */}
      <Section chapter="Faculties">
        <SectionHeading eyebrow="Academic Community">{homeFaculties.heading}</SectionHeading>
        <p className="mx-auto -mt-5 mb-12 max-w-2xl text-center leading-relaxed text-brand-muted">{homeFaculties.intro}</p>
        {/* Tiles are staggered vertically at lg — an even row of four reads as
            a contact sheet; an offset row reads as a composition. */}
        <SpotlightGroup className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {homeFaculties.items.map((f, i) => (
            <Reveal key={f.name} delay={i * 100} className={i % 2 === 1 ? 'lg:mt-10' : ''}>
              <SpotlightCard className="h-80 rounded-2xl" tone="dark">
                <Link
                  href="/faculty"
                  className="group relative block h-full overflow-hidden rounded-2xl shadow-lift transition duration-500 hover:-translate-y-2 hover:shadow-lift-lg"
                >
                  <Image
                    src={f.image}
                    alt=""
                    fill
                    loading="lazy"
                    className="object-cover transition duration-[1100ms] ease-out group-hover:scale-[1.14]"
                    sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
                  />
                  {/* Two stops rather than one: the name stays legible on light
                      photographs without flattening the image behind it. */}
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-purple-dark via-brand-purple-dark/50 to-transparent" />
                  {/* Purple wash deepens on hover, gold rim lights from below */}
                  <div className="absolute inset-0 bg-brand-purple/0 transition duration-500 group-hover:bg-brand-purple/30" />
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-gold to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />

                  {/* Index, set as a plate marking */}
                  <span
                    aria-hidden="true"
                    className="absolute right-4 top-4 font-sans text-[10px] font-bold tracking-[0.2em] text-white/35 transition duration-500 group-hover:text-brand-gold"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <span
                      aria-hidden="true"
                      className="mb-3.5 block h-[2px] w-9 origin-left rounded-full bg-brand-gold transition-transform duration-500 group-hover:scale-x-[2.6]"
                    />
                    {/* The name rises to make room for the affordance */}
                    <h3 className="font-heading text-[17px] font-bold leading-snug text-white transition-transform duration-500 group-hover:-translate-y-1 [text-wrap:balance]">
                      {f.name}
                    </h3>
                    <span className="mt-2 flex translate-y-2 items-center gap-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                      Explore
                      <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </Link>
              </SpotlightCard>
            </Reveal>
          ))}
        </SpotlightGroup>
      </Section>

      {/* Programs */}
      <Section chapter="Programs" className="bg-white">
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

      <ProgramRibbon items={ribbon} />

      {/* Research & Innovation */}
      <section data-chapter="Research" className="relative overflow-hidden bg-brand-purple py-20 text-white sm:py-24">
        <Image src="/images/wp/g-decor.jpg" alt="" fill loading="lazy" quality={55} className="object-cover opacity-10" sizes="100vw" />
        <Aurora tone="purple" intensity={0.8} />
        <Grain />
        <Seam />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading light eyebrow="Research & Innovation">
            Scholarship in service of society
          </SectionHeading>
          <SpotlightGroup className="grid gap-8 md:grid-cols-3">
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
                <SpotlightCard className="h-full rounded-2xl" tone="dark">
                <Link
                  href={r.href}
                  className="group relative flex h-full flex-col rounded-2xl border border-white/15 bg-white/5 p-8 backdrop-blur transition duration-500 hover:-translate-y-1 hover:bg-white/[0.08]"
                >
                  <span
                    aria-hidden="true"
                    className="mb-5 block h-[3px] w-9 origin-left rounded-full bg-brand-gold transition-transform duration-500 group-hover:scale-x-[2]"
                  />
                  <h3 className="font-heading text-xl font-bold text-brand-gold [text-wrap:balance]">{r.t}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-white/80">{r.b}</p>
                  <span className="mt-6 flex items-center gap-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-white/50 transition group-hover:text-brand-gold">
                    Read more
                    <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </span>
                </Link>
                </SpotlightCard>
              </Reveal>
            ))}
          </SpotlightGroup>
        </div>
      </section>

      {/* Admissions + International */}
      <Section chapter="Admissions">
        <div className="grid gap-6 lg:grid-cols-2">
          {[
            {
              eyebrow: 'Admissions',
              title: 'Anything you can dream, you can do',
              body:
                'From certificate to doctorate, our enrollment representatives walk with you through requirements, transferred coursework and financing. Applications are free, online, and reviewed continuously — and our support continues from enrollment to graduation and beyond.',
              points: ['Free online application', 'Rolling review', 'Credit for prior study'],
              primary: { label: 'Apply Now', href: '/apply' },
              secondary: { label: 'Requirements', href: '/admissions' },
              image: '/images/wp/g-grads.jpg',
            },
            {
              eyebrow: 'International Students',
              title: 'A global family of learners',
              body:
                'Rooted in Buea and Douala, connected worldwide through the International Circle of Faith, we welcome students from every nation. English-language study, recognized qualifications and online delivery make an IGUC education accessible wherever you are.',
              points: ['Study in English', 'Recognized qualifications', 'Fully online routes'],
              primary: { label: 'International Admissions', href: '/international' },
              secondary: { label: 'Scholarships', href: '/scholarships' },
              image: '/images/global.jpg',
            },
          ].map((c, i) => (
            <Reveal key={c.eyebrow} delay={i * 120}>
              <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-brand-sand bg-white shadow-lift transition duration-500 hover:shadow-lift-lg">
                {/* Photograph reads at a whisper behind the copy and warms on hover */}
                <Image
                  src={c.image}
                  alt=""
                  fill
                  loading="lazy"
                  quality={55}
                  className="object-cover opacity-[0.07] transition duration-700 group-hover:opacity-[0.13] group-hover:scale-105"
                  sizes="(min-width:1024px) 50vw, 100vw"
                />
                <div className="relative flex h-full flex-col p-9 sm:p-10">
                  <Eyebrow>{c.eyebrow}</Eyebrow>
                  <h3 className="font-heading text-display-sm font-bold text-brand-purple [text-wrap:balance]">
                    {c.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-brand-muted">{c.body}</p>

                  <ul className="mt-6 flex flex-1 flex-wrap content-start gap-2">
                    {c.points.map((pt) => (
                      <li
                        key={pt}
                        className="rounded-full border border-brand-sand bg-brand-cream px-3.5 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-purple"
                      >
                        {pt}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      href={c.primary.href}
                      className={`rounded-full px-7 py-3 font-heading text-sm font-semibold transition ${
                        i === 0
                          ? 'bg-brand-gold text-brand-purple shadow-gold hover:bg-brand-gold-deep'
                          : 'bg-brand-purple text-white hover:bg-brand-purple-dark'
                      }`}
                    >
                      {c.primary.label}
                    </Link>
                    <Link
                      href={c.secondary.href}
                      className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
                    >
                      {c.secondary.label}
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Global footprint */}
      <section data-chapter="Global" className="relative overflow-hidden bg-brand-purple-dark py-16 text-white">
        <Aurora tone="dual" intensity={0.75} />
        <Grain />
        <Seam />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-10 text-center font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
            A Global University
          </p>
          <SpotlightGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: IconCampus, place: 'Buea, Cameroon', tag: 'Main campus', desc: 'Faculties of Theology, Education, Engineering & Technology, and GIBMAS' },
              { Icon: IconChapel, place: 'Douala, Cameroon', tag: 'School of Theology', desc: 'Led by Dr Bongbuen Alando, Director of the School of Theology' },
              { Icon: IconGlobe, place: 'Nigeria', tag: 'PPDI-RC', desc: 'Professional development, applied research and training centre' },
              { Icon: IconLaptop, place: 'Online Worldwide', tag: 'Distance study', desc: 'Full master’s and doctoral programs delivered on every continent' },
            ].map(({ Icon, place, tag, desc }, i) => (
              <Reveal key={place} delay={i * 90}>
                <SpotlightCard className="group h-full rounded-2xl border border-white/10 bg-white/[0.04] p-7 transition duration-500 hover:bg-white/[0.08]" tone="dark">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-gold/25 bg-brand-gold/10 text-brand-gold transition duration-500 group-hover:bg-brand-gold group-hover:text-brand-purple">
                    <Icon className="h-6 w-6" />
                  </span>
                  <p className="mt-5 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold/70">
                    {tag}
                  </p>
                  <h3 className="mt-1 font-heading text-lg font-bold text-white">{place}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-white/70">{desc}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </SpotlightGroup>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-white/70">
            Connected through the International Circle of Faith — a worldwide fellowship of colleges,
            seminaries and ministries across Africa, the Americas, Europe and Asia — with faculty
            serving from Cameroon, Nigeria and the United States.
          </p>
        </div>
      </section>

      {/* Online learning */}
      <Section chapter="Online" className="bg-white">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative h-72 overflow-hidden rounded-2xl shadow-xl lg:h-96">
              <Image
                src="/images/banner.jpg"
                alt="A student studying online with ICOF Global University"
                fill
                loading="lazy"
                quality={82}
                className="object-cover"
                sizes="(min-width:1024px) 45vw, 100vw"
              />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <Eyebrow>Online Learning</Eyebrow>
            <KineticText className="font-heading text-display font-bold text-brand-purple [text-wrap:balance]">
              Your classroom, wherever you are
            </KineticText>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
            <p className="mt-6 leading-relaxed text-brand-muted">
              Master&apos;s and doctoral programs delivered fully online, with live classes, course
              materials, assignments and examinations in one student portal — and your results,
              GPA and transcript building automatically as you study.
            </p>

            {/* What the portal actually does, stated as a checklist */}
            <ul className="mt-7 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                'Live and recorded classes',
                'Assignments and submissions',
                'Computer-based examinations',
                'Automatic GPA and transcripts',
                'Fees and payment records',
                'QR-verifiable credentials',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-brand-muted">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-purple"
                  >
                    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>

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
      <Section chapter="Training">
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

      {/* Success in numbers — each figure sits inside its own progress ring,
          so the band reads as instrumentation rather than a row of digits. */}
      <section data-chapter="Impact" className="relative overflow-hidden bg-brand-purple py-24 text-white">
        <Aurora tone="gold" intensity={0.45} />
        <Grain opacity={0.045} />
        <Seam />
        {/* Engraved rule field */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'repeating-linear-gradient(115deg, #f7dc79 0 1px, transparent 1px 22px)' }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-16 text-center font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
            Student Success
          </p>
          <SpotlightGroup className="grid grid-cols-2 gap-x-6 gap-y-14 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 110}>
                <div className="flex flex-col items-center text-center">
                  <div className="relative h-[168px] w-[168px]">
                    {/* Ring: a conic sweep clipped to an annulus. No SVG, no
                        library — one element, one gradient, one mask. */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 animate-ring-in rounded-full"
                      style={{
                        background:
                          'conic-gradient(from -90deg, #f7dc79 0deg, #e9c14a 190deg, rgba(247,220,121,0.10) 250deg, rgba(247,220,121,0.10) 360deg)',
                        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
                        mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
                        animationDelay: `${i * 110}ms`,
                      }}
                    />
                    {/* Inner well */}
                    <div className="absolute inset-[14px] rounded-full border border-white/10 bg-brand-purple-dark/45 backdrop-blur-sm" />
                    {/* Orbiting node, one per ring, phase-shifted */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 animate-orbit"
                      style={{ animationDelay: `${i * -3}s` }}
                    >
                      <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gold shadow-gold" />
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="font-heading text-[2.6rem] font-bold leading-none text-brand-gold">
                        <CountUp value={s.value} />
                      </p>
                    </div>
                  </div>
                  <p className="mt-6 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                    {s.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </SpotlightGroup>
        </div>
      </section>

      {/* Recognition */}
      <Section chapter="Accreditation" className="bg-white">
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
        {/* Stacked rather than inline: at 3-up the link wrapped to a second
            row and left an orphaned divider hanging above it. */}
        <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-brand-sand bg-brand-cream text-center">
          <div className="flex flex-col divide-y divide-brand-sand sm:flex-row sm:divide-x sm:divide-y-0">
            <p className="flex-1 px-6 py-5 font-sans text-[11px] font-semibold uppercase leading-relaxed tracking-[0.16em] text-brand-gold-deep">
              Ministry of Higher&nbsp;Education, Cameroon
            </p>
            <p className="flex-1 px-6 py-5 font-sans text-[11px] font-semibold uppercase leading-relaxed tracking-[0.16em] text-brand-gold-deep">
              Continuously accredited since&nbsp;2007
            </p>
          </div>
          <Link
            href="/governance"
            className="group flex items-center justify-center gap-2 border-t border-brand-sand bg-white px-6 py-4 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
          >
            Governance &amp; accreditation
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </Section>

      {/* Diary & initiatives — one band. Both halves were dead-end cards before;
          every item now resolves somewhere. */}
      <Section chapter="Diary" className="bg-white">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          {/* Diary */}
          <div>
            <SectionHeading eyebrow="Mark Your Calendar" align="left">
              University diary
            </SectionHeading>
            <ol className="relative -mt-4 border-t border-brand-sand">
              {/* Rail: a single gradient line the date blocks sit on */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-6 left-8 top-6 w-px bg-gradient-to-b from-brand-gold via-brand-sand to-transparent"
              />
              {events.map((ev, i) => {
                const date = new Date(ev.date);
                return (
                  <li key={ev.slug} className="relative border-b border-brand-sand last:border-b-0">
                    <Reveal delay={i * 90}>
                      <Link href="/events" className="group relative flex items-start gap-5 py-6">
                        {/* Torn-calendar block */}
                        <time
                          dateTime={ev.date}
                          className="relative z-10 flex w-16 shrink-0 flex-col items-center rounded-xl border border-brand-sand bg-white py-2.5 shadow-sm transition duration-500 group-hover:border-brand-gold group-hover:bg-brand-gold group-hover:shadow-gold"
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
      <Section chapter="Questions">
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
