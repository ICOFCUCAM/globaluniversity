import type { Metadata } from 'next';
import Link from 'next/link';
import HeroScene from '@/components/home/HeroScene';
import { getPrograms } from '@/lib/data';
import { site } from '@/content/site';
import ScrollRail from '@/components/ScrollRail';
import PathwayLadder from '@/components/home/PathwayLadder';
import FacultyScenes from '@/components/home/FacultyScenes';
import { facultyById, programmesByFaculty } from '@/content/programmeCatalogue';
import StudyHere from '@/components/home/StudyHere';
import ProgrammeTeaser from '@/components/home/ProgrammeTeaser';
import ChancellorWord from '@/components/home/ChancellorWord';
import Triptych from '@/components/home/Triptych';
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

      {/* THE PROOF BAND IS GONE FROM HERE, AND ITS NUMBERS ARE NOT.

          It was a statistics scoreboard on cream, first after the hero, and it
          was one of the three sections the university called not good. The
          position is the most valuable on the page and it was spending it on
          four figures presented to somebody who had not yet been given a reason
          to care how many programmes there are.

          The figures themselves were never the problem — they are the only
          numbers on this site that can be evidenced, all counted by
          institutionalFacts() rather than typed. They now carry the OPAQUE
          middle plane of the triptych, framed by the world map on either side,
          where a reader meets them having already been told what this place
          claims to be. See Triptych.tsx. */}

      {/* The About band is gone. It said the university was born of the
          International Circle of Faith and pointed at /about — which is exactly
          what the fellowship scene directly above it says, at scale, over a
          photograph. Two consecutive sections making one claim is the fault
          this redesign exists to remove. /about is reached from there. */}

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

      {/* A DOORWAY, NOT THE ROOM. The full programme finder — search field,
          three filter groups, live counts and six programmes in full — was the
          most useful interaction on the site and it was the Programs page. A
          homepage that contains another page has stopped being a front door.

          The finder is untouched at /programs. This states the scale, names the
          four disciplines with their real counts, and sends the reader in
          already narrowed. See ProgrammeTeaser.tsx. */}
      <ProgrammeTeaser />

      {/* THE SIGNATURE COMPOSITION. One photograph passing behind three
          blocks — visible, interrupted by an architectural plane of university
          purple carrying the motto, then visible again. It absorbs the
          fellowship band and the convictions, which were making the identity
          claim and the formation claim in two separate places. See
          Triptych.tsx, including the resolution cost it knowingly accepts and
          why it is not built on FixedWindow. Used ONCE on the page: the effect
          becomes ordinary the second time. */}
      <Triptych />

      {/* Chancellor's welcome — the site opened with this on the original iguc.net */}
      {/* The Chancellor's word. The photograph is the room he speaks in — see
          ChancellorWord.tsx and Cinematic.tsx for why the ceremony is the
          ground and his portrait is not. */}
      <ChancellorWord />

      {/* What studying here involves. This is StudentExperience and the Online
          Learning band merged — see StudyHere.tsx, including the verbatim
          duplicate headline that survived six redesigns because both halves
          kept being edited in isolation. */}
      <StudyHere />

      {/* Voices is off the page. It rendered NOTHING: src/content/voices.ts is
          deliberately empty because there are no consented, attributable
          student quotations, and inventing them was refused. A component that
          draws nothing is not a section. It returns when real ones exist. */}

      {/* Research & Innovation */}
      {/* data-on-dark, not just bg-brand-purple. The focus-ring rules in
          globals.css match either, but ScrollRail queries the ATTRIBUTE only —
          so without it the rail drew its dark palette over a purple band and
          the position marker went dark-on-dark for a whole section. */}
      {/* ================================================================
          RESEARCH, AS AN INDEX. No background photograph, no cards.

          It carried a decorative image at 10% opacity under an aurora, a grain
          layer and a seam — four decorative layers behind three bordered tiles.
          The photograph was unrecognisable at that opacity and was doing what
          the faculties background was doing: costing a request and a decode to
          deliver texture nobody could name.

          The three activities are a list of where research happens and who is
          answerable for it. A list wants rows.

          WHAT THIS SECTION STILL REFUSES TO SAY, unchanged. A design brief
          asked for research centre counts, publication figures and
          international collaboration numbers. This university has no
          publications register and no centre register — nothing in this system
          can produce those figures, and a research claim is the one an academic
          reader checks first and hardest. So it names the three activities that
          DO exist, with the person or centre responsible for each, and says
          plainly that the programme is being built. An institution describing
          where its research is going is credible; one publishing a count it
          cannot evidence is finished the first time somebody asks for the list.
          See PENDING_MEASURES in institutionalFacts.ts.
          ================================================================ */}
      <section
        data-chapter="Research"
        data-on-dark=""
        aria-labelledby="research-heading"
        className="relative z-10 bg-brand-purple py-24 text-white sm:py-32"
      >
        <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
            Research &amp; innovation
          </p>
          <h2
            id="research-heading"
            className="mt-7 max-w-3xl font-heading text-[clamp(1.9rem,4vw,3.1rem)] font-bold leading-[1.1] tracking-[-0.02em] [text-wrap:balance]"
          >
            Scholarship in service of society
          </h2>
          <p className="mt-7 max-w-2xl text-[15.5px] leading-relaxed text-white/75">
            Our research programme is young and is being built deliberately — three places, each
            with the council or centre answerable for it.
          </p>

          <ul className="mt-16">
            {[
              {
                t: 'Dissertation Council',
                b: 'Doctoral research examined under Professor Emeritus Arch Bishop Godfred Anyere Tah.',
                href: '/degrees/doctoral',
              },
              {
                t: 'PPDI-RC, Nigeria',
                b: 'Applied research in behavioral therapy, agritech and community development.',
                href: '/ppdirc',
              },
              {
                t: 'Theology & African Society',
                b: 'Faculty publishing where faith meets the social questions facing African communities.',
                href: '/research',
              },
            ].map((r, i) => (
              <li key={r.t}>
                <Link
                  href={r.href}
                  className="group grid items-baseline gap-x-8 gap-y-2 border-t border-white/15 py-8 transition-colors duration-300 hover:border-brand-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-4 focus-visible:ring-offset-brand-purple lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]"
                >
                  <span className="flex items-baseline gap-5">
                    <span
                      aria-hidden="true"
                      className="font-heading text-[11px] font-bold tracking-[0.34em] text-brand-gold/75"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="font-heading text-[clamp(1.35rem,2.4vw,1.9rem)] font-bold leading-tight tracking-[-0.02em] transition-colors duration-300 group-hover:text-brand-gold">
                      {r.t}
                    </span>
                  </span>
                  <span className="text-[14.5px] leading-relaxed text-white/75">{r.b}</span>
                  <span
                    aria-hidden="true"
                    className="font-heading text-xl text-brand-gold/85 transition-all duration-300 group-hover:translate-x-1.5 group-hover:text-brand-gold"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div aria-hidden="true" className="border-t border-white/15" />

          <Link
            href="/research"
            className="group mt-12 inline-flex items-center gap-3 border-b border-brand-gold/40 pb-1 font-heading text-[15px] font-bold text-brand-gold transition duration-300 hover:border-brand-gold hover:text-white"
          >
            Explore research
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </section>

      {/* Admissions + International */}
      {/* CREDENTIAL VERIFICATION IS OFF THE HOMEPAGE, and the question that
          removed it is the one every section should have to answer: who is
          this for?

          The live register is for somebody HOLDING a document — an employer, a
          registrar, an evaluator abroad. That is not who reads a university
          homepage. A prospective student does not want to verify a credential;
          they want to know the one they earn will be verifiable, and that is a
          sentence, not a working form.

          The sentence is already on the page: the statistics band states the
          accreditation in full, names MINESUP, and links to
          /accreditation. Keeping a second section to say it again — with an
          input, a button, three explainer steps and a panel — was the exact
          repetition this redesign has been removing everywhere else, and it
          survived only because the interaction inside it was good.

          A good component in the wrong place is still in the wrong place. The
          register lives at /verify, where somebody who needs it arrives with
          an identifier already in hand. */}

      {/* Where the university physically is. */}
      {/* Campuses and the global network were the same argument told twice —
          3.36 screens to establish one fact. Merged into one scene over the
          university's own flat world; see GlobalPresence.tsx for why the map
          replaced the rotating globe, and what the map is forbidden to show. */}
      <GlobalPresence />

      {/* The Online Learning band is gone, merged upward into StudyHere. It
          asked "how does it work" six sections after the band that asked "what
          is it like" — one question split across a third of the page. */}

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
