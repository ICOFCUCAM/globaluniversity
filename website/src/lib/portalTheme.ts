// ---------------------------------------------------------------------------
// The portal's visual language.
//
// The management system arrived with eight unrelated gradients — blue, emerald,
// purple, amber, cyan, red, indigo, pink — one per statistic, chosen because
// there were eight statistics. Colour that carries no meaning is noise, and a
// screen where every tile shouts equally has no hierarchy at all. It is the
// single thing that most made this look like a template rather than a
// university's own system.
//
// So colour is spent, not scattered:
//
//   * The brand purple and gold carry identity — masthead, active navigation,
//     primary action. Nothing else uses them.
//   * Status colours carry meaning, and only the meaning already defined in
//     src/lib/status.ts. Green is not "good", it is `approved`.
//   * Everything else is a neutral. Cards are white on a warm grey field with a
//     hairline border, not a shadow — shadows on every card flatten into noise
//     the same way colour does.
//
// The public site's palette is defined in tailwind.config as brand-* and is
// the same purple and gold. A student moving from the prospectus to the portal
// should not feel they have changed institution.
// ---------------------------------------------------------------------------

/** The two identity colours. Everything else defers to them. */
export const BRAND = {
  purple: '#422e59',
  purpleDeep: '#33234a',
  purpleInk: '#241a30',
  gold: '#e9c14a',
  goldDeep: '#c5a55a',
  cream: '#faf6ee',
  sand: '#e8dcc0',
} as const;

/**
 * Surfaces. `page` is the field the cards sit on; keeping it warm rather than
 * blue-grey is what stops the portal feeling like a different product from the
 * prospectus.
 */
export const SURFACE = {
  page: 'bg-[#f7f5f0] dark:bg-[#17131d]',
  card: 'bg-white dark:bg-[#1f1a27]',
  cardBorder: 'border border-[#ece7de] dark:border-[#2e2637]',
  cardHover: 'hover:border-[#d9d0c0] dark:hover:border-[#3d3349]',
  divider: 'divide-[#f0ece4] dark:divide-[#2a2333]',
  inset: 'bg-[#faf8f4] dark:bg-[#241f2c]',
} as const;

/**
 * Dark is a real theme, not an inversion.
 *
 * The toggle in the top bar used to flip a boolean nothing read. Wiring it up
 * without this would have been worse than leaving it dead: hardcoded light
 * colours under a `dark` class produce black text on a near-black card, which
 * is not a preference anyone has. Every token below carries both, so a screen
 * built from tokens is legible in both without knowing which is in force.
 *
 * The identity colours do not invert. Purple stays purple and gold stays gold —
 * a university's colours are not a function of the reader's OS setting.
 */
export const TEXT = {
  heading: 'text-[#422e59] dark:text-[#e4dcf0]',
  body: 'text-[#33234a] dark:text-[#d8d2e2]',
  muted: 'text-[#6b6076] dark:text-[#9c93ad]',
  faint: 'text-[#a49bb0] dark:text-[#7b7289]',
} as const;

/** One card treatment, used everywhere, so cards read as one family. */
export const CARD = `${SURFACE.card} ${SURFACE.cardBorder} rounded-xl`;

/** The interactive card — lifts on hover, but only just. */
export const CARD_INTERACTIVE =
  `${CARD} ${SURFACE.cardHover} transition-colors duration-200`;

/** Section heading above a group of cards. */
export const SECTION_TITLE =
  `font-heading text-base font-bold ${'text-[#422e59] dark:text-[#e4dcf0]'}`;

export const SECTION_SUB = 'text-sm text-[#6b6076] dark:text-[#9c93ad]';

/** Small uppercase label — table headers, stat captions, field labels. */
export const EYEBROW =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8194] dark:text-[#8f869e]';

/**
 * Focus ring. Applied by hand rather than left to the browser default, because
 * the default is a blue halo that belongs to no part of this palette — and
 * because a keyboard user navigating a results screen needs to see where they
 * are without hunting.
 */
export const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35 focus-visible:ring-offset-1 dark:focus-visible:ring-[#c5a55a]/50 dark:focus-visible:ring-offset-[#17131d]';

/** The primary action. There is one per screen. */
export const BTN_PRIMARY =
  `inline-flex items-center justify-center gap-2 rounded-lg bg-[#422e59] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#33234a] disabled:opacity-40 disabled:hover:bg-[#422e59] ${FOCUS}`;

/** Everything else. */
export const BTN_SECONDARY =
  `inline-flex items-center justify-center gap-2 rounded-lg border border-[#ded6c8] bg-white px-4 py-2.5 text-sm font-semibold text-[#422e59] transition-colors hover:bg-[#faf6ee] disabled:opacity-40 dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0] dark:hover:bg-[#2e2637] ${FOCUS}`;

/** Quiet action — inline in a table row, or beside a heading. */
export const BTN_GHOST =
  `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#6b6076] transition-colors hover:bg-[#f2eee6] hover:text-[#422e59] dark:text-[#9c93ad] dark:hover:bg-[#2a2333] dark:hover:text-[#e4dcf0] ${FOCUS}`;

/** Destructive. Distinct from the `rejected` status colour on purpose. */
export const BTN_DANGER =
  `inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-30 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70 ${FOCUS}`;

export const INPUT =
  `w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2 text-sm text-[#33234a] placeholder:text-[#a49bb0] transition-colors focus:border-[#c5a55a] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0] dark:placeholder:text-[#7b7289] ${FOCUS}`;

export const LABEL = 'block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]';

/**
 * Tabular numerals for anything a reader compares down a column — GPAs, fees,
 * credit totals, student numbers. Proportional digits make 1,111 narrower than
 * 8,888, so a column of figures stops lining up and becomes hard to scan.
 */
export const NUMERIC = 'tabular-nums';
