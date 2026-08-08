// ---------------------------------------------------------------------------
// THE PAPER ONE CANDIDATE ACTUALLY SAW.
//
// Question selection, randomisation, and the marking of objective answers.
//
// ---------------------------------------------------------------------------
// A SHUFFLE THAT IS NOT RECORDED CANNOT BE DEFENDED
// ---------------------------------------------------------------------------
//
// Randomising question and option order is layer 3 of the University's
// anti-cheating model, and it is the layer most often implemented in a way that
// quietly destroys the examination record.
//
// The naive version shuffles with Math.random() at delivery. Three things break
// at once, and none of them shows up until somebody complains:
//
//   THE CANDIDATE REFRESHES and gets a different paper. Their answer to what
//   was question 3 is now against question 7. On a hundred-mark paper this is
//   indistinguishable from a candidate who answered badly.
//
//   THE APPEAL CANNOT BE ANSWERED. "Question 4 was ambiguous" — which question
//   was 4? Nobody knows, because the order was generated and thrown away. The
//   University cannot produce the paper it set.
//
//   THE MARKING IS WRONG whenever options were shuffled too. Option B was the
//   correct answer for this candidate and option D for the next, and a marker
//   comparing against the bank's original index marks both incorrectly.
//
// So: the order is DERIVED FROM A SEED, the seed is recorded on the session at
// first delivery and never changes, and answers are keyed by QUESTION ID rather
// than by position. A refresh reproduces the same paper. An appeal panel five
// years later reproduces the same paper. And the correct option travels with
// the question rather than being looked up by index.
//
// ---------------------------------------------------------------------------
// WHY A SEED RATHER THAN STORING THE ORDER ITSELF
// ---------------------------------------------------------------------------
//
// Both are defensible; the seed is smaller and cannot drift out of step with
// the question set. But the seed alone is not enough — if a question is
// withdrawn from the bank after the sitting, the same seed over a different set
// produces a different paper. So the resolved paper is recorded too, and the
// seed is what makes it reproducible while the sitting is live.
// ---------------------------------------------------------------------------

export interface BankQuestion {
  id: string;
  course?: string;
  topic?: string;
  text: string;
  /** Multiple choice. Empty for a written question. */
  options?: string[];
  /** Index into `options` of the correct one. Undefined for a written question. */
  answer?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Marks this question is worth. Defaults to an even share of the paper. */
  marks?: number;
}

/** One question as this candidate saw it. */
export interface DeliveredQuestion {
  /** THE BANK'S ID. Answers are keyed by this, never by position. */
  id: string;
  /** Where it appeared on this candidate's paper, from 1. */
  number: number;
  text: string;
  /** In the order this candidate saw them. */
  options: string[];
  marks: number;
  /**
   * Which of the SHUFFLED options is correct.
   *
   * TRAVELS WITH THE DELIVERED PAPER, and is stripped before the paper reaches
   * the browser — see `forCandidate`. Keeping it here rather than looking it up
   * against the bank at marking time is what makes per-candidate option
   * shuffling markable at all.
   */
  correct?: number;
}

export interface DeliveredPaper {
  seed: string;
  questions: DeliveredQuestion[];
  totalMarks: number;
}

// ---------------------------------------------------------------------------
// A DETERMINISTIC SHUFFLE
// ---------------------------------------------------------------------------

/**
 * A small, fast, deterministic pseudo-random generator (mulberry32).
 *
 * NOT FOR ANYTHING SECRET. It is used to arrange questions on a page, and its
 * output is reproducible on purpose — that is the entire requirement. Nothing
 * here should ever be used to generate a token, a seal or a credential number,
 * all of which use crypto elsewhere in this system.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 32-bit hash of a string, so a seed can be human-readable. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Fisher–Yates, driven by the seeded generator.
 *
 * DOES NOT MUTATE ITS INPUT. The bank is shared between every candidate sitting
 * the paper; shuffling it in place would give the second candidate an order
 * derived from the first one's, which is neither reproducible nor independent.
 */
export function shuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const rand = mulberry32(hash(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// BUILDING ONE CANDIDATE'S PAPER
// ---------------------------------------------------------------------------

export interface PaperSpec {
  /** How many questions to draw. Undefined means all of them. */
  count?: number;
  randomiseQuestions: boolean;
  randomiseOptions: boolean;
  totalMarks: number;
}

/**
 * The paper this candidate gets.
 *
 * THE SEED IS THE SESSION'S ID. It is unique per candidate per examination,
 * already recorded, and stable across refreshes — so no new column is needed to
 * make the paper reproducible while the sitting is live, and two candidates
 * never receive the same arrangement.
 *
 * A SEPARATE SEED PER QUESTION'S OPTIONS. Using the session seed for all of
 * them would make every question's options permute identically — if the correct
 * answer moved from A to C on question 1, it moved from A to C on every
 * question, which is a pattern a candidate can notice within about three
 * questions.
 */
export function buildPaper(
  bank: readonly BankQuestion[],
  spec: PaperSpec,
  seed: string,
): DeliveredPaper {
  const ordered = spec.randomiseQuestions ? shuffle(bank, seed) : [...bank];
  const drawn = spec.count ? ordered.slice(0, spec.count) : ordered;

  // An even share, unless the question says otherwise. Rounded so the paper
  // still adds up: the remainder goes on the last question rather than being
  // lost, because a paper marked out of 99 when it says 100 is a complaint.
  const even = drawn.length > 0 ? Math.floor(spec.totalMarks / drawn.length) : 0;
  const remainder = spec.totalMarks - even * drawn.length;

  const questions = drawn.map((q, i) => {
    const marks = q.marks ?? (even + (i === drawn.length - 1 ? remainder : 0));

    if (!q.options?.length) {
      return { id: q.id, number: i + 1, text: q.text, options: [], marks };
    }

    if (!spec.randomiseOptions) {
      return {
        id: q.id, number: i + 1, text: q.text,
        options: [...q.options], marks, correct: q.answer,
      };
    }

    // Shuffle the options and follow where the correct one went.
    const paired = q.options.map((text, index) => ({ text, index }));
    const mixed = shuffle(paired, `${seed}:${q.id}`);

    return {
      id: q.id,
      number: i + 1,
      text: q.text,
      options: mixed.map((o) => o.text),
      marks,
      correct: q.answer === undefined ? undefined : mixed.findIndex((o) => o.index === q.answer),
    };
  });

  return {
    seed,
    questions,
    totalMarks: questions.reduce((t, q) => t + q.marks, 0),
  };
}

/**
 * The paper as the browser may see it.
 *
 * THE ANSWER KEY IS STRIPPED HERE AND NOWHERE ELSE. `correct` is on the
 * delivered paper because marking needs it; it must never leave the server,
 * because a paper whose JSON carries the right answers is a paper any candidate
 * can read in the network tab.
 *
 * Written as its own function rather than as a delete inside the route so that
 * there is one place to check, and so a second route delivering papers cannot
 * forget.
 */
export function forCandidate(paper: DeliveredPaper): DeliveredPaper {
  return {
    seed: paper.seed,
    totalMarks: paper.totalMarks,
    questions: paper.questions.map(({ correct, ...rest }) => rest),
  };
}

// ---------------------------------------------------------------------------
// MARKING WHAT CAN BE MARKED
// ---------------------------------------------------------------------------

export interface SubmittedAnswer {
  questionId: string;
  /** The index the candidate chose, on THEIR arrangement of the options. */
  chosen?: number;
  /** A written answer. Never machine-marked. */
  text?: string;
}

export interface AutoMark {
  questionId: string;
  questionNumber: number;
  mark: number;
  outOf: number;
  /** Why this mark, in a sentence the candidate could be shown. */
  note: string;
}

export interface AutoMarkResult {
  marks: AutoMark[];
  /** Questions a person has to mark. */
  forHuman: DeliveredQuestion[];
  total: number;
  outOf: number;
}

/**
 * Mark the objective questions, and set the rest aside for a person.
 *
 * WRITTEN ANSWERS ARE NEVER MACHINE-MARKED, and this function does not attempt
 * it. Automated essay scoring is a real technology and it is not one a
 * university should apply to a degree without saying so loudly to the candidate
 * — so questions with no options come back in `forHuman` rather than receiving
 * a generated mark that an examiner would then be tempted to accept.
 *
 * AN UNANSWERED QUESTION SCORES ZERO AND SAYS SO. Silently omitting it would
 * leave the marks not adding up to the paper's total, and the first person to
 * notice would be a candidate checking their own arithmetic.
 */
export function autoMark(
  paper: DeliveredPaper,
  answers: readonly SubmittedAnswer[],
): AutoMarkResult {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
  const marks: AutoMark[] = [];
  const forHuman: DeliveredQuestion[] = [];

  for (const q of paper.questions) {
    if (!q.options.length || q.correct === undefined) {
      forHuman.push(q);
      continue;
    }

    const given = byQuestion.get(q.id);

    if (given?.chosen === undefined) {
      marks.push({
        questionId: q.id, questionNumber: q.number, mark: 0, outOf: q.marks,
        note: 'No answer was given.',
      });
      continue;
    }

    const right = given.chosen === q.correct;
    marks.push({
      questionId: q.id,
      questionNumber: q.number,
      mark: right ? q.marks : 0,
      outOf: q.marks,
      note: right
        ? 'Correct.'
        // NAMES THE OPTION AS THIS CANDIDATE SAW IT. Telling a candidate the
        // answer was "option C" when their option C was something else is
        // worse than telling them nothing.
        : `Chose “${q.options[given.chosen] ?? '—'}”. The correct answer was “${q.options[q.correct]}”.`,
    });
  }

  return {
    marks,
    forHuman,
    total: marks.reduce((t, m) => t + m.mark, 0),
    outOf: marks.reduce((t, m) => t + m.outOf, 0),
  };
}

/**
 * Is this paper markable without a person at all?
 *
 * USED TO DECIDE WHETHER TO SAY SO. A candidate who sits an all-objective paper
 * can be told their provisional mark; one whose paper has an essay must not be,
 * because the number would be a fraction of their result presented as if it
 * were the whole.
 */
export function fullyObjective(paper: DeliveredPaper): boolean {
  return paper.questions.length > 0
    && paper.questions.every((q) => q.options.length > 0 && q.correct !== undefined);
}
