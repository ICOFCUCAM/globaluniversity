// ---------------------------------------------------------------------------
// THE HANDBOOK'S FIGURES — drawn, not photographed.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
//   "it should have graphs and drawings etc. dont include picture."
//
// Two instructions. The second removed the graduation plates from this book —
// see `plates()` in prospectus.ts, which now draws them only for the books that
// ask. The first is this file.
//
// ---------------------------------------------------------------------------
// INLINE SVG, AND THE REASON IS THE SAME ONE THE CREST HAS
// ---------------------------------------------------------------------------
//
// Every figure here is SVG written into the page. Not a PNG, not a chart
// library, not a canvas. The book is one self-contained file that has to
// survive being emailed, saved to a phone and opened on a machine with no
// connection — a figure that needs a network request is a grey box in exactly
// the circumstances the book was forwarded for.
//
// It also means the figures are TEXT. They print at the printer's resolution
// rather than at 72dpi, they can be searched, and a reader with a screen reader
// gets the title and the description rather than "image".
//
// ---------------------------------------------------------------------------
// INK, NOT COLOUR
// ---------------------------------------------------------------------------
//
// The University ruled on this while the prospectus was being set: "only the
// front page is color. the rest should not be like first page." So the figures
// are line art in the University's purple and greys on white, the same ink the
// headings and rules already use. No filled colour panels, no chart palette,
// nothing that would make an inner page look like the cover.
//
// It is also the right decision for a document that will be printed in an
// office on a mono laser printer, which is where most of these will be read.
//
// ---------------------------------------------------------------------------
// AND SEVERAL OF THEM ARE DRAWN FROM THE SYSTEM
// ---------------------------------------------------------------------------
//
// The bar charts of what each office holds, and the matrix of restricted
// functions, are computed from `handbookFromTheSystem.ts` — the same generated
// data Part II and Part VIII are built from. A chart drawn from a list somebody
// typed is a second copy of the matrix with a nicer shape, and would go wrong
// the same way.
// ---------------------------------------------------------------------------

import { ROLE_PROFILES, RESTRICTED_TO_THE_TWO } from '@/content/handbookFromTheSystem';

// ---------------------------------------------------------------------------
// 1. THE INK
// ---------------------------------------------------------------------------

const PURPLE = '#422e59';
const DEEP = '#2f2040';
const QUIET = '#5c5366';
const RULE = '#cbbede';
const TINT = '#f6f3fa';
const GOLD = '#b08d2e';

/** The width every figure is drawn against. The text block is 643px. */
const W = 600;

const SERIF = "Georgia, 'Times New Roman', serif";

const esc = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Split a label so it fits a box, at roughly `per` characters a line. */
function wrap(text: string, per: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && (line + ' ' + word).length > per) { lines.push(line); line = word; } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface TextOpts {
  size?: number;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  weight?: number;
  caps?: boolean;
}

function text(x: number, y: number, s: string, o: TextOpts = {}): string {
  const {
    size = 11, fill = PURPLE, anchor = 'middle', weight = 400, caps = false,
  } = o;
  const extra = caps ? ' letter-spacing="1.4" text-transform="uppercase"' : '';
  return `<text x="${x}" y="${y}" font-family="${SERIF}" font-size="${size}" `
    + `fill="${fill}" text-anchor="${anchor}" font-weight="${weight}"${extra}>${esc(s)}</text>`;
}

/** A label of several lines, centred on (x, y) as its middle. */
function lines(x: number, y: number, ls: string[], o: TextOpts = {}): string {
  const size = o.size ?? 11;
  const lead = size * 1.25;
  const top = y - ((ls.length - 1) * lead) / 2;
  return ls.map((l, i) => text(x, top + i * lead + size * 0.35, l, o)).join('');
}

interface BoxOpts {
  fill?: string;
  stroke?: string;
  dash?: boolean;
  radius?: number;
  weight?: number;
}

function box(x: number, y: number, w: number, h: number, label: string, o: BoxOpts = {}): string {
  const {
    fill = '#fff', stroke = PURPLE, dash = false, radius = 4, weight = 1,
  } = o;
  const per = Math.max(8, Math.floor(w / 6.2));
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" `
    + `fill="${fill}" stroke="${stroke}" stroke-width="${weight}"`
    + `${dash ? ' stroke-dasharray="4 3"' : ''}/>`
    + lines(x + w / 2, y + h / 2, wrap(label, per), { size: 10.5, fill: stroke });
}

/** An arrow from (x1,y1) to (x2,y2). Straight; the figures are laid out for it. */
function arrow(x1: number, y1: number, x2: number, y2: number, o: { dash?: boolean; stroke?: string } = {}): string {
  const { dash = false, stroke = QUIET } = o;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" `
    + `stroke-width="1.1"${dash ? ' stroke-dasharray="4 3"' : ''} marker-end="url(#ah)"/>`;
}

/** The arrowhead, defined once per figure. */
const DEFS = `<defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" `
  + `markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${QUIET}"/></marker></defs>`;

/**
 * Wrap the drawing in an <svg>.
 *
 * `role="img"` AND A TITLE, because a figure that a screen reader announces as
 * "image" is a figure that reader does not have. The title is the same sentence
 * printed as the figure's caption, so the two cannot drift.
 */
function svg(height: number, body: string, title: string): string {
  return `<svg viewBox="0 0 ${W} ${height}" width="100%" height="auto" `
    + `role="img" aria-label="${esc(title)}" xmlns="http://www.w3.org/2000/svg">`
    + `<title>${esc(title)}</title>${DEFS}${body}</svg>`;
}


// ---------------------------------------------------------------------------
// 2. THE REUSABLE SHAPES
// ---------------------------------------------------------------------------

/** A left-to-right chain of boxes with arrows between them. */
function chain(ys: number, labels: string[], o: { height?: number; gap?: number } = {}): string {
  const { height = 46, gap = 16 } = o;
  const w = (W - gap * (labels.length - 1)) / labels.length;
  let out = '';
  labels.forEach((l, i) => {
    const x = i * (w + gap);
    out += box(x, ys, w, height, l);
    if (i < labels.length - 1) out += arrow(x + w + 2, ys + height / 2, x + w + gap - 3, ys + height / 2);
  });
  return out;
}

/** A horizontal bar chart. Values are drawn against the largest. */
function bars(
  rows: { label: string; value: number; note?: string }[],
  o: { labelWidth?: number; barHeight?: number; unit?: string } = {},
): { body: string; height: number } {
  const { labelWidth = 190, barHeight = 15, unit = '' } = o;
  const gap = 7;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const track = W - labelWidth - 44;
  let body = '';
  rows.forEach((r, i) => {
    const y = i * (barHeight + gap);
    const len = Math.max(1.5, (r.value / max) * track);
    body += text(labelWidth - 8, y + barHeight - 3.5, r.label, { anchor: 'end', size: 10, fill: QUIET });
    body += `<rect x="${labelWidth}" y="${y}" width="${track}" height="${barHeight}" `
      + `fill="${TINT}" stroke="none"/>`;
    body += `<rect x="${labelWidth}" y="${y}" width="${len}" height="${barHeight}" `
      + `fill="${PURPLE}" stroke="none"/>`;
    body += text(labelWidth + len + 6, y + barHeight - 3.5, `${r.value}${unit}`,
      { anchor: 'start', size: 9.5, fill: QUIET });
  });
  return { body, height: rows.length * (barHeight + gap) };
}


// ---------------------------------------------------------------------------
// 3. THE FIGURES
// ---------------------------------------------------------------------------

/** PART I — the hierarchy, as a ladder, from the system's own ranking. */
export function figureHierarchy(): string {
  const ranked = ROLE_PROFILES
    .filter((r) => r.rank !== null)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

  const rowH = 20;
  const top = 40;
  let body = text(0, 14, 'Seniority', { anchor: 'start', size: 9, fill: GOLD, caps: true });
  body += text(W, 14, 'Capabilities held', { anchor: 'end', size: 9, fill: GOLD, caps: true });
  body += `<line x1="0" y1="22" x2="${W}" y2="22" stroke="${RULE}" stroke-width="1"/>`;

  const maxCaps = Math.max(...ranked.map((r) => r.capabilities.length), 1);
  const barX = 330;
  const track = W - barX - 26;

  ranked.forEach((r, i) => {
    const y = top + i * rowH;
    // THE INDENT IS THE RANK. A ladder read down the page, so precedence is
    // visible without reading a number — and the number is there as well,
    // because "third" and "fourth" are a distinction the eye loses.
    const indent = Math.min(i, 9) * 5;
    body += text(8, y, String(r.rank), { anchor: 'start', size: 9, fill: RULE });
    body += text(26 + indent, y, r.label, { anchor: 'start', size: 10.5, fill: PURPLE });
    const len = Math.max(1.5, (r.capabilities.length / maxCaps) * track);
    body += `<rect x="${barX}" y="${y - 8}" width="${len}" height="9" fill="${PURPLE}" opacity="0.72"/>`;
    body += text(barX + len + 5, y, String(r.capabilities.length),
      { anchor: 'start', size: 9, fill: QUIET });
  });

  const h = top + ranked.length * rowH + 20;
  body += `<line x1="0" y1="${h - 14}" x2="${W}" y2="${h - 14}" stroke="${RULE}"/>`;
  body += text(0, h - 3, 'Seniority decides precedence, not permission.',
    { anchor: 'start', size: 9, fill: QUIET });
  return svg(h, body, 'The University’s hierarchy, and how many capabilities each office holds');
}

/** PART I — what the centre keeps, what a nation leads, where the line is. */
export function figureCentreAndNation(): string {
  const body = [
    box(0, 0, W, 34, 'ICOF GLOBAL UNIVERSITY — THE CENTRE', { fill: TINT, stroke: DEEP }),
    box(0, 48, 288, 92,
      'Programmes and curricula · Academic approvals · Results and grading scales '
      + '· Credentials and their templates · Examinations · The student register'),
    box(312, 48, 288, 92,
      'Recruitment and enrolment · Staff recommendations · Operational expenditure '
      + '· The academic community in one country'),
    text(144, 44, 'Never delegated', { size: 9, fill: GOLD, caps: true }),
    text(456, 44, 'Led by a nation', { size: 9, fill: GOLD, caps: true }),
    arrow(144, 34, 144, 46),
    arrow(456, 34, 456, 46),
    // The line itself, named.
    `<line x1="300" y1="44" x2="300" y2="152" stroke="${RULE}" stroke-dasharray="3 3"/>`,
    box(0, 158, W, 30, 'The line is row-level security in the database, not the screens',
      { stroke: QUIET, dash: true }),
  ].join('');
  return svg(196, body, 'What the centre keeps and what a National Administration leads');
}

/** PART II — capabilities per office, as a chart, from the system. */
export function figureCapabilityChart(): string {
  const rows = ROLE_PROFILES
    .filter((r) => r.role !== 'superadmin')
    .sort((a, b) => b.capabilities.length - a.capabilities.length)
    .slice(0, 16)
    .map((r) => ({ label: r.label, value: r.capabilities.length }));

  const { body, height } = bars(rows);
  const head = text(0, 12, 'Capabilities held, by office', { anchor: 'start', size: 9, fill: GOLD, caps: true })
    + `<line x1="0" y1="20" x2="${W}" y2="20" stroke="${RULE}"/>`;
  const foot = text(0, height + 52,
    'The SuperAdmin is omitted: it holds every capability there is, and a bar the width of '
    + 'the page tells nobody anything.', { anchor: 'start', size: 9, fill: QUIET });
  return svg(height + 62,
    `${head}<g transform="translate(0,32)">${body}</g>${foot}`,
    'How many capabilities each office holds');
}

/** PART II — who checks whom. The separation of duties, drawn. */
export function figureSeparation(): string {
  const pairs: [string, string, string][] = [
    ['HR drafts an appointment', 'The Registrar or VC approves', 'never the drafter'],
    ['The Secretary records an expense', 'The Rector authorises it', 'never the same person'],
    ['A lecturer submits a mark', 'A moderator moderates it', 'never their own marking'],
    ['The Registrar asks for an exception', 'The VC or SuperAdmin permits it', 'never the asker'],
    ['An officer requests a reissue', 'The VC or SuperAdmin authorises', 'never the requester'],
  ];
  const rowH = 52;
  let body = text(0, 12, 'One act, two people', { anchor: 'start', size: 9, fill: GOLD, caps: true })
    + `<line x1="0" y1="20" x2="${W}" y2="20" stroke="${RULE}"/>`;
  pairs.forEach(([a, b, note], i) => {
    const y = 34 + i * rowH;
    body += box(0, y, 246, 34, a);
    body += arrow(250, y + 17, 350, y + 17);
    body += box(354, y, 246, 34, b);
    body += text(300, y + 11, note, { size: 8.5, fill: GOLD });
  });
  const h = 34 + pairs.length * rowH + 16;
  body += text(0, h - 2, 'The system refuses the second act by the first person. It does not warn.',
    { anchor: 'start', size: 9, fill: QUIET });
  return svg(h, body, 'The separation of duties: one act, two people');
}

/** PART III — the admissions pipeline, by the office that acts. */
export function figureAdmissions(): string {
  const lanes = [
    ['Applicant', ['Applies']],
    ['Admissions', ['Receives', 'Verifies documents']],
    ['Academic Affairs', ['Takes the academic decision']],
    ['Finance', ['Clears — a gate, not an authority']],
    ['Registry', ['Issues the letter', 'Opens the student record']],
  ] as [string, string[]][];

  const laneH = 42;
  const labelW = 132;
  let body = '';
  lanes.forEach(([office, steps], i) => {
    const y = i * laneH;
    body += `<rect x="0" y="${y}" width="${W}" height="${laneH - 6}" fill="${i % 2 ? TINT : '#fff'}" stroke="none"/>`;
    body += text(labelW - 10, y + laneH / 2 - 1, office, { anchor: 'end', size: 10, fill: QUIET });
    const w = (W - labelW - (steps.length - 1) * 12) / steps.length;
    steps.forEach((s, j) => {
      body += box(labelW + j * (w + 12), y + 4, w, laneH - 14, s);
    });
    if (i < lanes.length - 1) {
      body += arrow(labelW + 26, y + laneH - 8, labelW + 26, y + laneH + 2);
    }
  });
  const h = lanes.length * laneH + 16;
  body += text(0, h - 2,
    'No single office carries an application from end to end.',
    { anchor: 'start', size: 9, fill: QUIET });
  return svg(h, body, 'The admissions pipeline, by the office that acts at each step');
}

/** PART III — a mark becoming a result. */
export function figureResultChain(): string {
  const steps = ['Submitted', 'Moderated', 'Approved', 'Published'];
  const who = ['the lecturer', 'a moderator', 'the academic office', 'the University'];
  let body = chain(18, steps);
  const gap = 16;
  const w = (W - gap * 3) / 4;
  who.forEach((p, i) => {
    body += text(i * (w + gap) + w / 2, 80, p, { size: 9, fill: QUIET });
  });
  body += text(W / 2, 102, 'Four steps, four different people, and no step is skippable.',
    { size: 9.5, fill: GOLD });
  return svg(112, body, 'How a mark becomes a published result');
}

/** PART III and VIII — the two transcript paths. */
export function figureTranscriptPaths(): string {
  let body = text(0, 12, 'Ordinary', { anchor: 'start', size: 9, fill: GOLD, caps: true });
  body += chain(20, ['Student exists', 'Officer selects', 'System verifies', 'Generate']);
  body += arrow(W / 2, 68, W / 2, 84);
  body += box(150, 88, 300, 28, 'Audit event created · transcript ready', { stroke: QUIET });

  body += text(0, 146, 'Exceptional', { anchor: 'start', size: 9, fill: GOLD, caps: true });
  body += box(0, 154, 180, 38, 'Student not found in the register', { stroke: QUIET, dash: true });
  body += arrow(184, 173, 206, 173);
  body += box(210, 154, 180, 38, 'Officer submits a validation request');
  body += arrow(394, 173, 416, 173);
  body += box(420, 154, 180, 38, 'The VC or SuperAdmin reviews', { fill: TINT });

  body += arrow(470, 192, 470, 214);
  body += arrow(550, 192, 550, 214);
  body += box(410, 218, 110, 30, 'Rejected', { stroke: QUIET, dash: true });
  body += box(530, 218, 70, 30, 'Approved');
  body += arrow(565, 248, 565, 268);
  body += box(360, 272, 240, 30, 'Controlled generation · audit event');

  body += text(0, 300,
    'The approval covers the one student number it named,',
    { anchor: 'start', size: 9, fill: QUIET });
  body += text(0, 314,
    'creates no transcript by itself and creates no student record.',
    { anchor: 'start', size: 9, fill: QUIET });
  return svg(322, body, 'The ordinary and the exceptional transcript paths');
}

/** PART IV — where a payment goes. */
export function figureMoneyFlow(): string {
  let body = box(210, 0, 180, 34, 'A payment is recorded');
  body += arrow(300, 34, 300, 52);
  body += box(180, 56, 240, 30, 'The database splits it, at that moment', { fill: TINT });

  body += arrow(240, 86, 150, 110);
  body += arrow(360, 86, 450, 110);
  body += box(30, 114, 240, 40, 'To the centre');
  body += box(330, 114, 240, 40, 'To the National Administration');

  body += text(150, 172, 'Registration money: always, in full', { size: 9.5, fill: GOLD });
  body += text(450, 172, 'Tuition: the share the agreement states', { size: 9.5, fill: GOLD });

  body += `<line x1="0" y1="190" x2="${W}" y2="190" stroke="${RULE}"/>`;
  body += text(0, 208, 'to the centre + to the nation = the gross. It is a rule, not a convention.',
    { anchor: 'start', size: 9.5, fill: PURPLE });
  body += text(0, 224,
    'With no agreement in force the whole of it stays with the centre, and the allocation '
    + 'records why.', { anchor: 'start', size: 9, fill: QUIET });
  body += text(0, 238, 'An allocation is never rewritten: a correction is a reversal and a new row.',
    { anchor: 'start', size: 9, fill: QUIET });
  return svg(246, body, 'How a payment is split between the centre and a National Administration');
}

/** PART IV — the purse, as an equation drawn to scale. */
export function figurePurse(): string {
  const track = W - 120;
  const kept = track;
  const spent = track * 0.6;
  let body = text(0, 12, 'The national purse', { anchor: 'start', size: 9, fill: GOLD, caps: true });
  body += text(0, 40, 'Allocated', { anchor: 'start', size: 10, fill: QUIET });
  body += `<rect x="110" y="28" width="${kept}" height="16" fill="${TINT}" stroke="${PURPLE}"/>`;
  body += text(0, 70, 'Authorised', { anchor: 'start', size: 10, fill: QUIET });
  body += `<rect x="110" y="58" width="${spent}" height="16" fill="${PURPLE}" opacity="0.75"/>`;
  body += text(0, 100, 'Available', { anchor: 'start', size: 10, fill: QUIET });
  body += `<rect x="${110 + spent}" y="88" width="${kept - spent}" height="16" fill="none" `
    + `stroke="${PURPLE}" stroke-dasharray="3 3"/>`;
  body += text(W / 2, 128,
    'Computed from the rows, never stored. A stored balance is one that can disagree with them.',
    { size: 9.5, fill: QUIET });
  body += text(W / 2, 146,
    'An administration cannot authorise more than it has been allocated.',
    { size: 9.5, fill: GOLD });
  return svg(154, body, 'The national purse: allocated, less authorised, is available');
}

/** PART V — the studio: submission before generation. */
export function figureStudio(): string {
  let body = chain(16, ['Record or write', 'Submit', 'The University accepts']);
  body += arrow(W / 2, 62, W / 2, 80);
  body += box(90, 84, 420, 30, 'Only now may a model run on it', { fill: TINT });
  body += arrow(200, 114, 160, 134);
  body += arrow(400, 114, 440, 134);
  body += box(20, 138, 260, 34, 'Notes and summaries');
  body += box(320, 138, 260, 34, 'Translation into a course’s languages');
  body += arrow(150, 172, 150, 190);
  body += arrow(450, 172, 450, 190);
  body += box(20, 194, 560, 30,
    'Reviewed and approved by a person before students see it', { stroke: QUIET });
  body += text(0, 240,
    'Submitting and generating are two acts. Nothing is produced from a lecture the '
    + 'University has not accepted,', { anchor: 'start', size: 9, fill: QUIET });
  body += text(0, 254,
    'and nothing produced from it is offered as the University’s until somebody has '
    + 'vouched for it.', { anchor: 'start', size: 9, fill: QUIET });
  return svg(262, body, 'The Academic Studio: a submission is accepted before any model runs');
}

/** PART VI — one University, several nations. */
export function figureNations(): string {
  let body = box(180, 0, 240, 34, 'ICOF Global University', { fill: TINT, stroke: DEEP });
  const cols = ['National Administration', 'National Administration', 'National Administration'];
  const w = 180;
  const gap = 30;
  cols.forEach((c, i) => {
    const x = i * (w + gap);
    body += arrow(300, 34, x + w / 2, 62);
    body += box(x, 66, w, 34, c);
  });
  body += box(0, 116, W, 34,
    'Rector · Students · Faculty · Finance — inside every one of them',
    { stroke: QUIET, dash: true });
  body += text(0, 176,
    'One agreement per country, one Rector per administration, both enforced by the database.',
    { anchor: 'start', size: 9, fill: QUIET });
  body += text(0, 190,
    'The students are the University’s students and the degrees are the '
    + 'University’s degrees.', { anchor: 'start', size: 9, fill: QUIET });
  return svg(198, body, 'One University operating through National Administrations');
}

/** PART VII — the three questions asked on every request. */
export function figureAccessControl(): string {
  const qs = [
    ['Which office is this?', 'The role on the account'],
    ['Does it hold the capability?', 'The matrix in Part II'],
    ['Which rows may they see?', 'Row-level security'],
  ];
  let body = '';
  qs.forEach(([q, a], i) => {
    const x = i * 200;
    body += box(x, 10, 184, 46, q);
    body += text(x + 92, 74, a, { size: 9, fill: QUIET });
    if (i < 2) body += arrow(x + 186, 33, x + 198, 33);
  });
  body += `<line x1="0" y1="92" x2="${W}" y2="92" stroke="${RULE}"/>`;
  body += text(0, 112,
    'The third is a different question from the second, and the distinction matters:',
    { anchor: 'start', size: 9.5, fill: PURPLE });
  body += text(0, 128,
    'row-level security says who MAY read a row. It never says which row is yours.',
    { anchor: 'start', size: 9.5, fill: GOLD });
  return svg(138, body, 'The three questions asked on every request');
}

/** PART VIII — the restricted functions, as a matrix, from the system. */
export function figureRestrictedMatrix(): string {
  // The offices a reader will look for, in the order the University names them.
  const offices = ['vice-chancellor', 'superadmin', 'registrar', 'academic-office',
    'national-rector', 'lecturer', 'student'];
  const held = new Map(ROLE_PROFILES.map((r) => [r.role, new Set(r.capabilities)]));
  const label = new Map(ROLE_PROFILES.map((r) => [r.role, r.label]));

  // The ones the University ruled on, first, then the rest.
  const ruled = ['view-certificate-template', 'authorise-certificate-reissue',
    'validate-transcript-exception', 'view-transcript-audit'];
  const rows = [...ruled, ...RESTRICTED_TO_THE_TWO.filter((c) => !ruled.includes(c))].slice(0, 14);

  const labelW = 234;
  const colW = (W - labelW) / offices.length;
  const rowH = 19;
  const top = 58;

  let body = '';
  offices.forEach((o, i) => {
    const x = labelW + i * colW + colW / 2;
    const short = (label.get(o) ?? o).replace(' Administrator', '').replace('Director of ', '');
    body += `<g transform="translate(${x},${top - 8}) rotate(-52)">`
      + text(0, 0, short, { anchor: 'start', size: 9, fill: QUIET }) + '</g>';
  });
  body += `<line x1="0" y1="${top}" x2="${W}" y2="${top}" stroke="${RULE}"/>`;

  rows.forEach((cap, i) => {
    const y = top + i * rowH;
    if (i % 2 === 1) {
      body += `<rect x="0" y="${y}" width="${W}" height="${rowH}" fill="${TINT}"/>`;
    }
    body += text(labelW - 10, y + 13, cap.replace(/-/g, ' '),
      { anchor: 'end', size: 9.5, fill: PURPLE });
    offices.forEach((o, j) => {
      const x = labelW + j * colW + colW / 2;
      const yes = held.get(o)?.has(cap);
      body += yes
        ? `<path d="M${x - 4},${y + 9} l3,3.6 l6,-7" fill="none" stroke="${PURPLE}" stroke-width="1.6"/>`
        : `<path d="M${x - 3.4},${y + 6.6} l6.8,6.8 M${x + 3.4},${y + 6.6} l-6.8,6.8" `
          + `stroke="${RULE}" stroke-width="1.3"/>`;
    });
  });

  const h = top + rows.length * rowH + 30;
  body += `<line x1="0" y1="${h - 22}" x2="${W}" y2="${h - 22}" stroke="${RULE}"/>`;
  // NOT A REPEAT OF THE CAPTION. The caption under the figure already says
  // these are read from the matrix; a drawing that spends its last line saying
  // what the sentence beneath it says has wasted the line.
  body += text(0, h - 8,
    'A tick is a capability the office holds. Several of these are the '
    + 'Superadministrator\u2019s alone, and the table shows which.',
    { anchor: 'start', size: 9, fill: QUIET });
  return svg(h, body, 'The restricted institutional functions, and which offices hold them');
}

/** PART VIII — the certificate design as a restricted resource. */
export function figureCertificateGate(): string {
  let body = box(180, 0, 240, 34, 'The certificate template', { fill: TINT, stroke: DEEP });
  body += arrow(300, 34, 300, 52);
  body += box(180, 56, 240, 30, 'Restricted institutional resource');
  body += arrow(260, 86, 160, 112);
  body += arrow(340, 86, 440, 112);
  body += box(60, 116, 200, 32, 'Vice-Chancellor');
  body += box(340, 116, 200, 32, 'SuperAdmin');

  const refused = ['Registrar', 'Director of Academic Affairs', 'National Rector',
    'Lecturer', 'Student'];
  body += `<line x1="0" y1="172" x2="${W}" y2="172" stroke="${RULE}"/>`;
  body += text(0, 190, 'And nobody else', { anchor: 'start', size: 9, fill: GOLD, caps: true });
  refused.forEach((r, i) => {
    const y = 202 + i * 20;
    body += text(20, y, r, { anchor: 'start', size: 10, fill: QUIET });
    body += `<path d="M${W - 26},${y - 8} l7,7 M${W - 19},${y - 8} l-7,7" stroke="${RULE}" stroke-width="1.4"/>`;
  });
  const h = 202 + refused.length * 20 + 34;
  body += text(0, h - 18,
    'Refused in the database, not hidden on a screen: a user without the permission',
    { anchor: 'start', size: 9, fill: QUIET });
  body += text(0, h - 5,
    'receives no certificate-template data at all.', { anchor: 'start', size: 9, fill: QUIET });
  return svg(h, body, 'The certificate template as a restricted resource');
}

/** PART VIII — a transcript is generated again, never replaced. */
export function figureVersions(): string {
  let body = text(0, 12, 'Generating again never replaces',
    { anchor: 'start', size: 9, fill: GOLD, caps: true });
  const vs = [
    ['Transcript #001', 'from the record as it stood then'],
    ['Transcript #002', 'from the record as it stood then'],
    ['Transcript #003', 'from the record as it stands today'],
  ];
  vs.forEach(([t, note], i) => {
    const y = 28 + i * 52;
    body += `<line x1="18" y1="${y + 20}" x2="18" y2="${y + (i === 2 ? 20 : 62)}" stroke="${RULE}"/>`;
    body += `<circle cx="18" cy="${y + 20}" r="4.5" fill="#fff" stroke="${PURPLE}" stroke-width="1.4"/>`;
    body += text(36, y + 16, t, { anchor: 'start', size: 11, fill: PURPLE });
    body += text(36, y + 30, note, { anchor: 'start', size: 9, fill: QUIET });
  });
  body += text(0, 196,
    'Each one stays. The academic record changes over time, and the question to be answered',
    { anchor: 'start', size: 9, fill: QUIET });
  body += text(0, 210,
    'later is what was generated, from what record, by whom and when.',
    { anchor: 'start', size: 9, fill: QUIET });
  body += text(0, 228,
    'No office can edit or delete one — including the two that can read them all.',
    { anchor: 'start', size: 9.5, fill: GOLD });
  return svg(236, body, 'Transcript versions: generating again never replaces');
}

/** PART IX — the student's journey. */
export function figureStudentJourney(): string {
  const stops = ['Apply', 'Admitted', 'Register', 'Learn', 'Assessed', 'Results', 'Graduate'];
  const y = 46;
  let body = text(0, 12, 'A student’s journey', { anchor: 'start', size: 9, fill: GOLD, caps: true });
  body += `<line x1="24" y1="${y}" x2="${W - 24}" y2="${y}" stroke="${RULE}" stroke-width="2"/>`;
  const step = (W - 48) / (stops.length - 1);
  stops.forEach((s, i) => {
    const x = 24 + i * step;
    body += `<circle cx="${x}" cy="${y}" r="6" fill="#fff" stroke="${PURPLE}" stroke-width="1.6"/>`;
    body += text(x, y - 16, s, { size: 10, fill: PURPLE });
  });
  const notes: [number, string][] = [
    [2, 'inside the window'],
    [4, 'marked, moderated'],
    [6, 'certificate issued'],
  ];
  notes.forEach(([i, n]) => {
    body += text(24 + i * step, y + 22, n, { size: 8.5, fill: QUIET });
  });
  body += text(0, y + 54,
    'Each stop is an act by a named office, recorded against the officer who took it.',
    { anchor: 'start', size: 9, fill: QUIET });
  return svg(y + 64, body, 'A student’s journey through the University');
}

/** PART XI — the lecturer's week. */
export function figureLecturerCycle(): string {
  const cx = 300;
  const cy = 118;
  const r = 84;
  const steps = ['Prepare', 'Publish', 'Teach', 'Set work', 'Mark', 'Submit'];
  let body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${RULE}" stroke-dasharray="3 4"/>`;
  steps.forEach((s, i) => {
    const a = (i / steps.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    body += `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="${PURPLE}" stroke-width="1.5"/>`;
    const lx = cx + Math.cos(a) * (r + 34);
    const ly = cy + Math.sin(a) * (r + 22);
    body += text(lx, ly, s, { size: 10.5, fill: PURPLE });
  });
  body += lines(cx, cy, ['Every step is', 'scoped to your', 'own courses'],
    { size: 9.5, fill: QUIET });
  body += text(0, 232,
    'Submitting is not publishing. Your marks go to a moderator, then to the academic office,',
    { anchor: 'start', size: 9, fill: QUIET });
  body += text(0, 246,
    'and the University publishes them.', { anchor: 'start', size: 9, fill: QUIET });
  return svg(254, body, 'The lecturer’s cycle through a course');
}

/** PART XI — what a student does each term. */
export function figureStudentTerm(): string {
  let body = chain(16, ['Check the window', 'Clear fees', 'Register', 'Learn and submit']);
  body += arrow(W / 2, 62, W / 2, 80);
  body += box(140, 84, 320, 30, 'Sit the assessments');
  body += arrow(W / 2, 114, W / 2, 132);
  body += box(140, 136, 320, 30, 'Read the published results', { fill: TINT });
  body += text(0, 190,
    'If registration is open and you cannot register, the reason is almost always',
    { anchor: 'start', size: 9, fill: QUIET });
  body += text(0, 204,
    'financial clearance for the term. My finance says where you stand.',
    { anchor: 'start', size: 9, fill: QUIET });
  return svg(212, body, 'A student’s term, step by step');
}
