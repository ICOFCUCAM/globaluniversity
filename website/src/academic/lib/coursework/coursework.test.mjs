// ---------------------------------------------------------------------------
// WORK THAT A PERSON SETS AND A PERSON MARKS.
//
// The important half of this file is what the platform refuses to do. It does
// not mark. Not a draft mark, not a suggested one, not a rubric score "for the
// lecturer to adjust" — because a number a lecturer merely agreed to is a
// number a model gave, and the student would have no way of telling which it
// was. There is no capability for it, no route, and no model call in
// `markWork`.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { load, suite } from '../testkit.mjs';
import { fileURLToPath } from 'node:url';

const { createMemoryStore } = await load('data/memory.ts');
const { DEMO } = await load('data/seed.ts');
const S = await load('service.ts');

const t = suite('Reading, work, and marking');
const fresh = () => createMemoryStore(JSON.parse(JSON.stringify(DEMO)));
const lecturer = { id: 'person-lecturer', role: 'lecturer' };
const student = { id: 'person-student', role: 'student' };
const registry = { id: 'person-registry', role: 'registry' };

t.section('The course library, and the two rights a publisher grants separately');
{
  const store = fresh();

  // WIDENED BY A RULING. This used to set a citation and a note. The
  // University's ruling of 16 September 2026 made an e-book a first-class
  // course resource — title, author, publisher, licence, and READING and
  // DOWNLOADING as separate rights — so the test asks about those instead.
  const reading = await S.setReading(store, lecturer, 'course-biol101', {
    kind: 'chapter',
    title: 'Molecular Biology of the Cell, 6th ed., ch. 14',
    author: 'Alberts et al.',
    description: 'Sections 14.1 and 14.2 only.',
    url: 'https://library.example.test/alberts/14',
    requirement: 'required',
  });
  t.check('the title is kept as they wrote it', reading.title,
    'Molecular Biology of the Cell, 6th ed., ch. 14');
  t.check('…and the author with it', reading.author, 'Alberts et al.');
  t.check('…it is required, because they said so', reading.requirement, 'required');

  // THE DEFAULT THAT MATTERS. A new resource may be read and NOT downloaded:
  // a book wrongly marked read-only is a complaint, one wrongly marked
  // downloadable is a licence breach that cannot be recalled.
  t.check('a new resource may be read', reading.mayRead, true);
  t.check('…and may NOT be downloaded until somebody says so', reading.mayDownload, false);

  t.check('…and is unpublished until they say so', reading.visible, false);
  t.check('…so a student sees nothing yet',
    (await S.readingFor(store, student, 'course-biol101')).length, 0);

  await S.setReading(store, lecturer, 'course-biol101', { ...reading, visible: true });
  t.check('once published, they do',
    (await S.readingFor(store, student, 'course-biol101')).length, 1);

  // AND AN ORDINARY EDIT DOES NOT REASSERT A LICENCE DECISION. A librarian
  // fixing a description must not silently re-state rights they did not set.
  const edited = await S.setReading(store, lecturer, 'course-biol101', {
    ...reading, visible: true, description: 'Sections 14.1 to 14.3.',
  });
  t.check('editing a description leaves the download right alone',
    edited.mayDownload, false);

  // A RESOURCE MUST LEAD SOMEWHERE. 096 refuses one with neither a link nor a
  // file; this is that refusal in words rather than as a constraint name.
  await t.refuses('a resource with nowhere to go is refused',
    () => S.setReading(store, lecturer, 'course-biol101',
      { kind: 'ebook', title: 'A title and nowhere to go' }));

  await t.refuses('a student cannot build the library',
    () => S.setReading(store, student, 'course-biol101',
      { kind: 'link', title: 'My blog', url: 'https://example.test' }));
  await t.refuses('nor can the registry',
    () => S.setReading(store, registry, 'course-biol101',
      { kind: 'link', title: 'A handbook', url: 'https://example.test' }));
}

t.section('Setting work, handing it in, and what a due date decides');
{
  const store = fresh();
  const assignment = await S.setAssignment(store, lecturer, 'course-biol101', {
    title: 'The two stages',
    brief: 'In 800 words, explain why the Calvin cycle is not the dark reaction.',
    marksOutOf: 20,
    dueAt: '2099-01-01T00:00:00.000Z',
  });
  await t.refuses('nothing can be handed in before it is set',
    () => S.submitWork(store, student, assignment.id, 'An essay.'));

  const published = await S.setAssignment(store, lecturer, 'course-biol101', { ...assignment, published: true });
  const handed = await S.submitWork(store, student, published.id, 'The Calvin cycle needs ATP and NADPH…');
  t.check('it is in', handed.studentId, 'person-student');
  t.check('…and not late', handed.late, false);

  const overdue = await S.setAssignment(store, lecturer, 'course-biol101', {
    title: 'Late one', brief: 'Anything.', published: true, dueAt: '2020-01-01T00:00:00.000Z',
  });
  t.check('a late submission says so',
    (await S.submitWork(store, student, overdue.id, 'Sorry.')).late, true);

  await t.refuses('a lecturer does not hand work in',
    () => S.submitWork(store, lecturer, published.id, 'Mine.'));
}

t.section('Marking is a person’s act, with words, and released deliberately');
{
  const store = fresh();
  const assignment = await S.setAssignment(store, lecturer, 'course-biol101', {
    title: 'The two stages', brief: 'Explain.', marksOutOf: 20, published: true,
  });
  const handed = await S.submitWork(store, student, assignment.id, 'An essay.');

  await t.refuses('a student cannot mark their own work',
    () => S.markWork(store, student, handed.id, { mark: 20, feedback: 'Excellent.' }));
  await t.refuses('a mark with no words is refused',
    () => S.markWork(store, lecturer, handed.id, { mark: 14, feedback: '   ' }));

  const marked = await S.markWork(store, lecturer, handed.id, {
    mark: 14, feedback: 'The distinction is right; the evidence is thin in the second half.',
  });
  t.check('the mark carries the name of who gave it', marked.markedByName, 'Dr Amara Okonjo');
  t.check('…and is not released yet', marked.returnedAt, undefined);

  // MARKED IS NOT RETURNED. A lecturer marks a set over an evening and
  // releases them together, so nobody reads theirs early.
  const beforeRelease = (await S.workFor(store, student, assignment.id))[0];
  t.check('the student sees their work', beforeRelease.body, 'An essay.');
  t.check('…and nothing of the marking', [beforeRelease.mark, beforeRelease.feedback], [undefined, undefined]);

  t.check('one is released', await S.returnWork(store, lecturer, assignment.id), 1);
  const afterRelease = (await S.workFor(store, student, assignment.id))[0];
  t.check('…and then they see the mark', afterRelease.mark, 14);
  t.check('…and the words with it',
    afterRelease.feedback, 'The distinction is right; the evidence is thin in the second half.');

  await t.refuses('and marked work is not quietly rewritten',
    () => S.submitWork(store, student, assignment.id, 'A better essay.'));
}

t.section('And the platform never suggests a mark');
{
  // STRUCTURAL, NOT A PROMISE. `markWork` takes the mark from its caller and
  // makes no model call; if one ever appeared here, this check would fail.
  const source = readFileSync(fileURLToPath(new URL('../service.ts', import.meta.url)), 'utf8');
  const markWork = source.slice(source.indexOf('export async function markWork'));
  const body = markWork.slice(0, markWork.indexOf('\nexport '));
  t.check('no model is consulted when marking', /callAs\(|\.complete\(|runTransformation/.test(body), false);
  t.check('…and the mark comes from the caller', /marking\.mark/.test(body), true);
}

t.done();
