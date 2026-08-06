/**
 * Entry requirements for undergraduate and diploma admission.
 *
 * Held here rather than inside pages.ts so a programme page and a level page
 * quote the SAME requirements. They were previously a private constant used by
 * one file, which meant any new page listing requirements would have restated
 * them — and the first time one was edited the site would publish two different
 * answers to "can I get in".
 */
export const UNDERGRAD_ENTRY = [
  'An Advanced Level (A/L) slip or certificate from the Cameroon GCE Board with appropriate points and subjects for the programme chosen, or a comparable qualification from a recognised institution abroad.',
  'A minimum of 3 points as shown on the A/L slip or certificate.',
  'Where the programme requires it, relevant work experience or access to an organisational environment.',
  'Citizenship or permanent residence in the Republic of Cameroon, or a valid approved visa if resident in Cameroon.',
  'No record of expulsion from a previous institution.',
  'Completion of all admission forms, with an official A/L certificate or equivalent.',
];
