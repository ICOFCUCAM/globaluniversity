import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import HeroScene from '@/components/home/HeroScene';
import Reveal from '@/components/Reveal';
import { getPrograms } from '@/lib/data';
import { site } from '@/content/site';
import { Aurora, Grain, Seam } from '@/components/Atmosphere';
import KineticText from '@/components/KineticText';
import { SpotlightGroup, SpotlightCard } from '@/components/Spotlight';
import ProgramRibbon from '@/components/ProgramRibbon';
import ScrollRail from '@/components/ScrollRail';
import { IconCampus, IconChapel, IconGlobe, IconLaptop } from '@/components/Icons';
import ProofBand from '@/components/home/ProofBand';
import PathwayLadder from '@/components/home/PathwayLadder';
import FacultyScenes from '@/components/home/FacultyScenes';
import { facultyById, programmesByFaculty } from '@/content/programmeCatalogue';
import StudentExperience from '@/components/home/StudentExperience';
import ProgrammeFinder from '@/components/home/ProgrammeFinder';
import VerificationDemo from '@/components/home/VerificationDemo';
import ChancellorWord from '@/components/home/ChancellorWord';
import GlobalMovement from '@/components/home/GlobalMovement';
import Formation from '@/components/home/Formation';
import FinalScene from '@/components/home/FinalScene';
import GlobalPresence from '@/components/home/GlobalPresence';

// The motto's three words are no longer copy in this file. They live in
// src/components/home/Formation.tsx, which tells them one at a time at the
// size of a title card over photography that changes beneath them, rather
// than as three boxes in a row.

// The homepage's own metadata. The root layout supplies a default title and
// description for every page; the front page deserves its own, because it is
// the one whose search result and social card are seen most and the generic
// template is what appears when somebody shares the university itself.
export const metadata: Metadata = {
  title: `${site.name} — A Global University`,
  description:
    'Accredited degrees in theology, education, technology and business. Two campuses in '
    + 'Cameroon, a centre in Nigeria, and every programme delivered online worldwide. '
    + 'Accredited by the Ministry of Higher Education since 2007.',
  alternates: { canonical: '/' },
  openGraph: {
    title: `${site.name} — A Global University`,
    description:
      'Educating leaders for Africa and the world. Certificate to doctorate, on campus in Buea '
      + 'and Douala or online from anywhere.',
    url: site.url,
    siteName: site.name,
    type: 'website',
  },
};

export default async function HomePage() {
  // `stats` and `homeFaculties` are no longer read here. The four WordPress
  // statistics they carried are retired — see ProofBand — and the faculty tiles
  // are now built from the catalogue by FacultyShowcase, so the count on the
  // card cannot disagree with the page it links to.
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
      // NO FAQPage HERE ANY MORE, and this is a correctness fix rather than a
      // tidy-up. The FAQ band was removed from this page, and Google's
      // structured-data guidelines require FAQPage markup to describe content
      // that is VISIBLE on the page carrying it. Emitting questions and answers
      // a visitor cannot see is exactly the mismatch that earns a manual action
      // against rich results — and it would have been invisible in every test
      // this repository runs, because the JSON-LD stayed valid and the page
      // stayed correct. The markup belongs on /admissions, with the questions.
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
      // No Event entries either, for the same reason the FAQPage went: the
      // diary band that displayed them is off this page. Structured data
      // describes THIS document; it is not a place to keep announcements the
      // document no longer makes. Both belong on /events.
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeLd) }} />
      <ScrollRail />

      {/* THE HERO.
          No longer a full-bleed photograph. Of ninety-seven images in this
          repository three exceed 1600px wide, and the two that do are stock —
          one of them a Cambridge college. See Hero.tsx for the arithmetic and
          the decision. */}
      <HeroScene />

      {/* The quick-links row is gone. Six routes in a card grid immediately
          under the hero, every one already in the header navigation two lines
          above it — the same destinations offered twice before the reader has
          read a sentence. It cost 0.16 of a screen and taught nobody
          anything. */}

      {/* The proof band. A visitor's second question — after "what is this
          place for" — is "why should I believe you", and nothing answered it
          above the fold. Every figure is computed from the catalogue rather
          than typed; see ProofBand for what was there before and why it had to
          go. */}
      <ProofBand />

      {/* Who this university belongs to, before what it offers. The fellowship
          is the reason "A Global University" is a description rather than an
          aspiration — see GlobalMovement.tsx, including what it refuses to
          claim about ICOF's size. */}
      <GlobalMovement />

      {/* University overview */}
      {/* The About band is gone. It said the university was born of the
          International Circle of Faith and pointed at /about — which is exactly
          what the fellowship scene directly above it says, at scale, over a
          photograph. Two consecutive sections making one claim is the fault
          this redesign exists to remove. /about is reached from there. */}

      {/* The motto, as a scene rather than a specification. Three convictions
          told one at a time over photography that changes beneath them — see
          Formation.tsx for why three boxes in a row was the wrong figure for a
          motto, and why nothing inside it is a link. */}
      <Formation />

      {/* The four disciplines, one at a time at the size of a title card. The
          slugs below are the REAL faculty pages, not the catalogue ids — those
          two datasets use different keys, and the card grid this replaces
          sidestepped the mismatch by linking all four to the index. See
          FacultyScenes.tsx, and facultyLinks.test.mjs, which fails if any of
          these stops resolving to a page. */}
      <FacultyScenes
        faculties={[
          {
            id: 'theology',
            slug: 'theology-buea',
            name: 'Theology',
            mission: facultyById('theology')!.mission,
            count: programmesByFaculty('theology').length,
            src: '/images/graduation-2024/grad-2024-doctoral-portrait.jpg',
            alt: 'A doctoral graduate of ICOF Global University in academic dress',
            focal: '50% 16%',
          },
          {
            id: 'engineering',
            slug: 'engineering-technology',
            name: 'Engineering & Technology',
            mission: facultyById('engineering')!.mission,
            count: programmesByFaculty('engineering').length,
            src: '/images/graduation-2024/grad-2024-award-presentation.jpg',
            alt: 'An award being presented at the ICOF Global University 2024 congregation',
            focal: '50% 30%',
          },
          {
            id: 'business',
            slug: 'gibmas',
            name: 'Business & Management',
            mission: facultyById('business')!.mission,
            count: programmesByFaculty('business').length,
            src: '/images/graduation-2024/grad-2024-masters-caps.jpg',
            alt: "Master's graduates of ICOF Global University in caps and gowns",
            focal: '50% 32%',
          },
          {
            id: 'education',
            slug: 'education',
            name: 'Education',
            mission: facultyById('education')!.mission,
            count: programmesByFaculty('education').length,
            // Was grad-2024-graduands-group.jpg — removed from the homepage at
            // the university's request.
            src: '/images/graduation-2024/grad-2024-academics-seated.jpg',
            alt: 'Academics of ICOF Global University seated at the 2024 congregation',
            focal: '50% 30%',
          },
        ]}
      />

      {/* The ladder. The commonest reason somebody does not apply is believing
          the only door they can reach is the wrong one; this shows the awards
          as one route rather than five unrelated cards. */}
      <PathwayLadder />

      {/* Chancellor's welcome — the site opened with this on the original iguc.net */}
      {/* The Chancellor's word. The photograph is the room he speaks in — see
          ChancellorWord.tsx and Cinematic.tsx for why the ceremony is the
          ground and his portrait is not. */}
      <ChancellorWord />

      {/* What a week here actually looks like — the question that decides
          whether a working adult with a family applies. */}
      <StudentExperience />

      {/* Voices is off the page. It rendered NOTHING: src/content/voices.ts is
          deliberately empty because there are no consented, attributable
          student quotations, and inventing them was refused. A component that
          draws nothing is not a section. It returns when real ones exist. */}

      {/* THE PROGRAMME FINDER.
          This replaced four featured cards and a link to a list of forty-one
          rows. Nobody chooses a degree by reading an index — see the component
          for how somebody actually chooses, and for why nothing here is
          labelled AI. */}
      <ProgrammeFinder />

      {/* Research & Innovation */}
      <section data-chapter="Research" className="relative overflow-hidden bg-brand-purple py-24 text-white sm:py-32">
        <Image src="/images/wp/g-decor.jpg" alt="" fill loading="lazy" quality={55} className="object-cover opacity-10" sizes="100vw" />
        <Aurora tone="purple" intensity={0.8} fields={2} />
        <Grain />
        <Seam />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading light eyebrow="Research &amp; Innovation">
            Scholarship in service of society
          </SectionHeading>
          {/* WHAT THIS SECTION DOES NOT CLAIM.
              A design brief asked for research centre counts, publication
              figures and international collaboration numbers here. This
              university has no publications register and no centre register —
              nothing in this system can produce those figures, and a research
              claim is the one an academic reader checks first and hardest.

              So the section names the three research activities that DO exist,
              with the person or centre responsible for each, and says plainly
              that the programme is being built. An institution describing where
              its research is going is credible; one publishing a count it
              cannot evidence is finished the first time somebody asks for the
              list. See PENDING_MEASURES in institutionalFacts.ts. */}
          <p className="mx-auto -mt-6 mb-14 max-w-2xl text-center leading-relaxed text-white/70">
            Our research programme is young and is being built deliberately. These are the three
            places it is happening now, each with the council or centre answerable for it.
          </p>
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
      <Section chapter="Admissions" className="dark:bg-[#150f1e]">
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
                  <h3 className="font-heading text-display-sm font-bold text-brand-purple dark:text-white [text-wrap:balance]">
                    {c.title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-brand-muted dark:text-white/60">{c.body}</p>

                  <ul className="mt-6 flex flex-1 flex-wrap content-start gap-2">
                    {c.points.map((pt) => (
                      <li
                        key={pt}
                        className="rounded-full border border-brand-sand bg-brand-cream dark:border-white/10 dark:bg-white/[0.04] px-3.5 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-purple"
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

      {/* Accreditation, partners and verification — one section that says what
          the standing IS, rather than a strip of logos asking the visitor to
          infer a relationship. See StandingBand for the wording constraint the
          university asked for. */}
      {/* StandingBand is gone. It claimed the recognition and this section
          proves it — and its closing sentence was, word for word, this
          section's headline. Claim and proof are now one section, in that
          order. See VerificationDemo.tsx. */}

      {/* The university already had cryptographically sealed credentials that
          anyone could verify, hidden three clicks deep. It is the most
          genuinely futuristic thing here, so it is on the front page and it is
          live rather than simulated. */}
      <VerificationDemo />

      {/* Where the university physically is. */}
      {/* Campuses and the global network were the same argument told twice —
          3.36 screens to establish one fact. Merged into one scene over the
          university's own flat world; see GlobalPresence.tsx for why the map
          replaced the rotating globe, and what the map is forbidden to show. */}
      <GlobalPresence />

      {/* Online learning */}
      <Section chapter="Online" className="bg-white dark:bg-[#181121]">
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
            <KineticText className="font-heading text-display font-bold text-brand-purple dark:text-white [text-wrap:balance]">
              Your classroom, wherever you are
            </KineticText>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
            <p className="mt-6 leading-relaxed text-brand-muted dark:text-white/60">
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
                <li key={f} className="flex items-start gap-2.5 text-sm text-brand-muted dark:text-white/60">
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
      {/* THREE SECTIONS REMOVED HERE, AND WHY.

          EXECUTIVE & PROFESSIONAL STUDIES was the densest band on the page —
          216 words per screen — written in verbatim WordPress marketing copy
          ("Build Relevant Skills", "Get The Right Path From The Best Learning
          Platform"), and it contained ZERO links, which made it a genuine dead
          end. It also told the practitioner claim for the third time. Its real
          idea is a study-mode filter in the programme finder above.

          THE DIARY was the weakest band on the page: events and support in one
          box, neither given room. Both have real pages — /events and /support —
          and both are in the footer.

          THE FAQ pre-empted objections a reader has not made yet. A homepage
          should create confidence and lead deeper; answering "what if I cannot
          afford it" before anybody has decided they want it is the posture of a
          page that expects to be doubted. The questions live on /admissions,
          where somebody who has decided goes next. */}

      {/* The last scene. Cta.tsx still closes the other eighteen pages — see
          FinalScene.tsx for why a policy page has not earned a cinematic
          ending, and why the closing photograph is families rather than a
          building. */}
      <FinalScene />
    </>
  );
}
