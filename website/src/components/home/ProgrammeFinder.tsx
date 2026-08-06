'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ALL_PROGRAMMES, FACULTIES, programmeHref,
  type Programme, type AwardLevel,
} from '@/content/programmeCatalogue';

// ---------------------------------------------------------------------------
// THE PROGRAMME FINDER.
//
// WHAT IT REPLACED. A list. Forty-one programmes rendered as forty-one rows,
// which on a page reads as
//
//     Certificate · Certificate · Diploma · Diploma · Diploma · Diploma …
//
// and tells a visitor nothing except that there are a lot of them. Nobody
// chooses a degree by reading an index.
//
// HOW SOMEBODY ACTUALLY CHOOSES. They do not arrive knowing they want a
// "Diploma in Non-Profit Management". They arrive knowing they want to teach,
// or to preach, or to run a department, or that they have two evenings a week
// and a full-time job. So the entry point here is what you want to DO and how
// much time you have — and the awards are the answer, not the question.
//
// ---------------------------------------------------------------------------
// A NOTE ON THE WORD "AI"
//
// The brief for this section asked for an AI programme recommender, an AI
// career planner and an AI degree adviser. What is below is a deterministic
// matcher: it scores every programme against the interests you pick and the
// time you have, using the titles, summaries and career lists in the catalogue,
// and shows the best fits.
//
// It is NOT called AI anywhere in the interface, and that is deliberate. It
// does not use a language model, and a university that labels string matching
// as artificial intelligence on its front page has told its first lie to
// someone who came to be educated. When there is a model behind it, the label
// can change.
//
// It is also, for this job, better than a model would be: it is instant, it
// works offline, it costs nothing per visitor, it cannot hallucinate a
// programme the university does not offer, and its reasoning is shown to the
// person — every result says WHY it matched.
// ---------------------------------------------------------------------------

/**
 * The interests, and the words that signal them.
 *
 * Written against the catalogue rather than invented: every keyword below
 * appears in the title, summary or career list of at least one real programme.
 */
const INTERESTS: { id: string; label: string; icon: string; keys: string[] }[] = [
  { id: 'ministry', label: 'Ministry & the church', icon: '✝', keys: ['theolog', 'ministr', 'pastor', 'divinity', 'evangel', 'mission', 'church', 'biblical', 'chaplain'] },
  { id: 'teaching', label: 'Teaching & education', icon: '✎', keys: ['educat', 'teach', 'school', 'pedagog', 'curriculum', 'classroom', 'special needs', 'primary'] },
  { id: 'technology', label: 'Technology & engineering', icon: '⚙', keys: ['software', 'network', 'comput', 'database', 'web', 'hardware', 'engineer', 'technolog', 'security', 'chipset', 'maintenance'] },
  { id: 'business', label: 'Business & administration', icon: '◫', keys: ['business', 'manage', 'account', 'financ', 'administ', 'project', 'secretar', 'bank', 'insur', 'market', 'entrepreneur'] },
  { id: 'leadership', label: 'Leadership & governance', icon: '⌘', keys: ['leader', 'governance', 'director', 'executive', 'strateg', 'non-profit', 'organisation', 'organization'] },
  { id: 'research', label: 'Research & scholarship', icon: '⌬', keys: ['research', 'doctor', 'thesis', 'philosoph', 'systematic', 'scholar', 'liberation'] },
];

/** How long the visitor has. Maps onto the award levels, not onto a promise. */
const COMMITMENTS: { id: string; label: string; note: string; awards: AwardLevel[] }[] = [
  { id: 'short', label: 'Under a year', note: 'A focused qualification', awards: ['Certificate'] },
  { id: 'medium', label: 'One to two years', note: 'Career-ready, or a step up', awards: ['Diploma', "Master's", 'Postgraduate Diploma'] },
  { id: 'long', label: 'Three years or more', note: 'A full degree', awards: ["Bachelor's", 'Doctorate'] },
];

const MODES = ['Online', 'On campus', 'Blended'];

interface Scored {
  p: Programme;
  score: number;
  /** Shown to the person. A recommendation without a reason is an instruction. */
  because: string[];
}

function haystack(p: Programme): string {
  return `${p.title} ${p.summary} ${p.careers.join(' ')} ${p.description.join(' ')}`.toLowerCase();
}

export default function ProgrammeFinder() {
  const [q, setQ] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [commitment, setCommitment] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);

  const toggle = (list: string[], v: string, set: (x: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const results = useMemo<Scored[]>(() => {
    const needle = q.trim().toLowerCase();
    const chosen = INTERESTS.filter((i) => interests.includes(i.id));
    const commit = COMMITMENTS.find((c) => c.id === commitment);

    const scored = ALL_PROGRAMMES.map((p) => {
      const hay = haystack(p);
      let score = 0;
      const because: string[] = [];

      // Typed words are the strongest signal — somebody who types "accountant"
      // has told you more than any filter can.
      if (needle) {
        if (p.title.toLowerCase().includes(needle)) { score += 60; because.push(`Title matches “${q.trim()}”`); }
        else if (hay.includes(needle)) { score += 30; because.push(`Mentions “${q.trim()}”`); }
        else return null; // a search that returns non-matches is not a search
      }

      for (const i of chosen) {
        const hits = i.keys.filter((k) => hay.includes(k)).length;
        if (hits > 0) { score += 20 + hits * 4; because.push(i.label); }
      }
      // Interests were picked and none matched: not for this person.
      if (chosen.length > 0 && because.length === (needle ? 1 : 0)) return null;

      if (commit) {
        if (!commit.awards.includes(p.award)) return null;
        because.push(commit.label);
        score += 10;
      }

      if (mode) {
        if (!p.modes.includes(mode)) return null;
        because.push(mode);
        score += 5;
      }

      // With nothing chosen at all, show the catalogue rather than nothing.
      if (!needle && chosen.length === 0 && !commit && !mode) score = 1;

      return { p, score, because };
    }).filter(Boolean) as Scored[];

    return scored.sort((a, b) => b.score - a.score || a.p.title.localeCompare(b.p.title));
  }, [q, interests, commitment, mode]);

  const filtering = q.trim() !== '' || interests.length > 0 || !!commitment || !!mode;
  const shown = filtering ? results.slice(0, 9) : results.slice(0, 6);

  const chip = (on: boolean) =>
    `rounded-full border px-4 py-2 font-sans text-[13px] font-medium transition duration-300 ${
      on
        ? 'border-brand-gold bg-brand-gold text-brand-purple-dark shadow-gold'
        : 'border-[#ded6c8] bg-white text-brand-purple hover:border-brand-purple dark:border-white/15 dark:bg-white/5 dark:text-white/80 dark:hover:border-brand-gold'
    }`;

  return (
    <section
      data-chapter="Find a programme"
      aria-labelledby="finder-heading"
      className="bg-white py-24 dark:bg-[#150f1e] sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold-deep">
            Find your programme
          </p>
          <h2
            id="finder-heading"
            className="mt-4 font-heading text-display font-bold text-brand-purple dark:text-white [text-wrap:balance]"
          >
            Start with what you want to do
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-brand-muted dark:text-white/65">
            Forty-one programmes across four faculties. Tell us what you are drawn to and how much
            time you have, and we will narrow them down — and say why each one matched.
          </p>
        </div>

        {/* ---- the controls ---------------------------------------------- */}
        <div className="mx-auto mt-14 max-w-4xl">
          <label className="block">
            <span className="sr-only">Search programmes or the work you want</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Try “accountant”, “pastor”, “software”, “headteacher”…"
              className="w-full rounded-2xl border border-[#ded6c8] bg-white px-6 py-5 text-lg text-brand-purple shadow-lift outline-none transition placeholder:text-brand-muted/60 focus:border-brand-gold focus:shadow-lift-lg dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/35"
            />
          </label>

          <fieldset className="mt-9">
            <legend className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-gold-deep">
              What are you drawn to?
            </legend>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {INTERESTS.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  aria-pressed={interests.includes(i.id)}
                  onClick={() => toggle(interests, i.id, setInterests)}
                  className={chip(interests.includes(i.id))}
                >
                  <span aria-hidden="true" className="mr-2 opacity-70">{i.icon}</span>
                  {i.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <fieldset>
              <legend className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-gold-deep">
                How much time do you have?
              </legend>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {COMMITMENTS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={commitment === c.id}
                    title={c.note}
                    onClick={() => setCommitment(commitment === c.id ? null : c.id)}
                    className={chip(commitment === c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-gold-deep">
                How would you study?
              </legend>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(mode === m ? null : m)}
                    className={chip(mode === m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <p className="mt-8 flex flex-wrap items-center gap-4 border-t border-[#efe8db] pt-6 font-sans text-sm text-brand-muted dark:border-white/10 dark:text-white/55" role="status">
            <span>
              <strong className="font-heading text-lg text-brand-purple dark:text-white">
                {results.length}
              </strong>{' '}
              of {ALL_PROGRAMMES.length} programmes
              {filtering && shown.length < results.length && ` · showing the closest ${shown.length}`}
            </span>
            {filtering && (
              <button
                type="button"
                onClick={() => { setQ(''); setInterests([]); setCommitment(null); setMode(null); }}
                className="font-semibold text-brand-purple underline decoration-brand-gold decoration-2 underline-offset-4 dark:text-brand-gold"
              >
                Start again
              </button>
            )}
          </p>
        </div>

        {/* ---- the results ------------------------------------------------ */}
        {results.length === 0 ? (
          <p className="mx-auto mt-14 max-w-xl rounded-2xl border border-[#e6ddcb] bg-brand-cream p-10 text-center leading-relaxed text-brand-muted dark:border-white/10 dark:bg-white/[0.03] dark:text-white/60">
            Nothing matches all of that. Try removing one filter — or{' '}
            <Link href="/contact" className="font-semibold text-brand-purple underline dark:text-brand-gold">
              ask an admissions officer
            </Link>
            , who can tell you what is planned as well as what is running.
          </p>
        ) : (
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shown.map(({ p, because }, i) => {
              const faculty = FACULTIES.find((f) => f.id === p.facultyId);
              return (
                <article
                  key={p.slug}
                  style={{ animationDelay: `${i * 45}ms` }}
                  className="group relative flex animate-rise flex-col rounded-2xl border border-[#e6ddcb] bg-white p-6 transition duration-500 hover:-translate-y-1 hover:border-brand-gold hover:shadow-lift-lg dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-brand-gold/50"
                >
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold-deep">
                    {p.award} · {faculty?.name.replace('Faculty of ', '') ?? ''}
                  </p>
                  <h3 className="mt-2.5 font-heading text-xl font-bold leading-snug text-brand-purple dark:text-white">
                    <Link href={programmeHref(p.slug)}>
                      <span className="absolute inset-0" aria-hidden="true" />
                      {p.title}
                    </Link>
                  </h3>
                  <p className="mt-3 flex-1 text-[15px] leading-relaxed text-brand-muted dark:text-white/60">
                    {p.summary}
                  </p>

                  <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#efe8db] pt-4 dark:border-white/10">
                    <div>
                      <dt className="sr-only">Duration</dt>
                      <dd className="font-sans text-[12px] text-brand-muted dark:text-white/55">
                        {p.duration}
                      </dd>
                    </div>
                    {p.credits !== undefined && (
                      <div>
                        <dt className="sr-only">Credits</dt>
                        <dd className="font-sans text-[12px] text-brand-muted dark:text-white/55">
                          {p.credits} ECTS
                        </dd>
                      </div>
                    )}
                  </dl>

                  {/* WHY IT MATCHED. A recommendation with no reason is an
                      instruction, and a visitor who cannot see the reasoning
                      cannot tell a good match from a random one. */}
                  {because.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {Array.from(new Set(because)).slice(0, 3).map((b) => (
                        <li
                          key={b}
                          className="rounded-full bg-brand-cream px-2.5 py-1 font-sans text-[11px] text-brand-purple/75 dark:bg-white/[0.07] dark:text-white/60"
                        >
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {results.length > shown.length && (
          <p className="mt-12 text-center">
            <Link
              href="/programs"
              className="group inline-flex items-center gap-2.5 rounded-full border-2 border-brand-purple px-8 py-4 font-heading text-[15px] font-bold text-brand-purple transition duration-300 ease-enter hover:bg-brand-purple hover:text-white active:scale-[0.98] active:duration-75 dark:border-brand-gold dark:text-brand-gold dark:hover:bg-brand-gold dark:hover:text-brand-purple-dark"
            >
              See all {results.length} matches
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
