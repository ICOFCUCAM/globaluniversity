// ---------------------------------------------------------------------------
// THE STANDARD WORDING FOR EACH KIND OF LETTER.
//
// ---------------------------------------------------------------------------
// THE SAME GAP THE APPOINTMENT CONDITIONS HAD
// ---------------------------------------------------------------------------
//
// The Correspondence composer offers seventeen kinds of letter and an empty
// box, and the officer writes every one from nothing. The University made the
// point about appointment letters and it is the same point here: "must I write
// the letter when there could be one in the system?"
//
// ---------------------------------------------------------------------------
// A SKELETON, NOT A LETTER
// ---------------------------------------------------------------------------
//
// What is offered is the SHAPE the University's letters take for that kind —
// what a letter of commendation opens with, what an invitation has to state
// before it is answerable, what a warning must say to be fair. The particulars
// are left as square-bracketed prompts, so what arrives in the box is visibly
// unfinished and cannot be sent as it stands without somebody noticing.
//
// THIS IS WHY THE PROMPTS ARE IN BRACKETS AND NOT BLANK. A blank reads as a
// finished sentence with a word missing; `[the date]` reads as something
// nobody has filled in yet. The composer's objections already refuse a letter
// that is too short, and a bracket left in is the kind of thing the
// Vice-Chancellor catches on the read-back.
//
// ---------------------------------------------------------------------------
// NOTHING HERE IS AN INSTITUTIONAL FACT
// ---------------------------------------------------------------------------
//
// No committee, no policy number, no office the University has not named, no
// date. Every particular is a bracket. The only things stated as fact are the
// University's own name and the address of its verification page, both of
// which it publishes itself.
// ---------------------------------------------------------------------------

import type { LetterKind } from './correspondence';

/** What a letter of that kind opens with, and the shape of what follows. */
const DRAFTS: Record<LetterKind, string> = {
  general: [
    'I write on behalf of ICOF Global University concerning [the matter].',
    '',
    '[Set out the position in full. A reader with no other context should be able to act on '
    + 'this letter without asking a follow-up question.]',
    '',
    '[Say what, if anything, you are asking of the recipient, and by when.]',
    '',
    'Please do not hesitate to write to this office if anything here needs clarifying.',
  ].join('\n'),

  appointment: [
    'I am pleased to inform you that ICOF Global University has appointed you to the post of '
    + '[title], with effect from [date].',
    '',
    'The terms and conditions of your appointment are set out in the letter of appointment '
    + 'issued to you separately, which governs the appointment in full.',
    '',
    'Please confirm your acceptance in writing to this office.',
  ].join('\n'),

  reappointment: [
    'I am pleased to inform you that ICOF Global University has reappointed you to the post of '
    + '[title] for a further term, with effect from [date] and ending on [date].',
    '',
    'The conditions of your appointment continue unchanged except as stated in the letter of '
    + 'appointment issued to you separately.',
    '',
    'Please confirm your acceptance in writing to this office.',
  ].join('\n'),

  promotion: [
    'I am pleased to inform you that ICOF Global University has promoted you to the post of '
    + '[title], with effect from [date].',
    '',
    'This decision recognises [what the promotion is in recognition of].',
    '',
    'The particulars of the post are set out in the letter of appointment issued to you '
    + 'separately.',
  ].join('\n'),

  invitation: [
    'On behalf of ICOF Global University, I have the honour to invite you to [the occasion].',
    '',
    'Date: [date]',
    'Time: [time]',
    'Venue: [venue]',
    '',
    '[Say what the recipient is being invited to do — attend, speak, preside, receive — '
    + 'because an invitation that does not say leaves them unable to prepare or to answer.]',
    '',
    'Kindly confirm your attendance to this office by [date].',
  ].join('\n'),

  commendation: [
    'On behalf of ICOF Global University, I write to commend you for [what was done].',
    '',
    '[Say specifically what it was, and when. A commendation that could have been addressed '
    + 'to anybody is worth less than none.]',
    '',
    'The University is grateful, and this letter is placed on your record.',
  ].join('\n'),

  recommendation: [
    'I write in support of [name], who has been [a member of staff / a student] of ICOF '
    + 'Global University [in what capacity] from [date] to [date].',
    '',
    '[State what you know of them at first hand, and in what capacity you know it. A '
    + 'recommendation is worth what the writer\'s own knowledge is worth.]',
    '',
    'I recommend [name] to you without reservation, and I am glad to answer any question '
    + 'this office can properly answer.',
  ].join('\n'),

  government: [
    'I have the honour to write to you on behalf of ICOF Global University concerning '
    + '[the matter].',
    '',
    '[Set out the position, and the authority under which the University writes.]',
    '',
    '[Say precisely what is being requested, notified or submitted, and by when a reply is '
    + 'needed.]',
    '',
    'Please accept, [Sir or Madam], the assurances of the University\'s highest '
    + 'consideration.',
  ].join('\n'),

  university: [
    'I write on behalf of ICOF Global University concerning [the matter].',
    '',
    '[Set out the position. A letter between institutions is read by somebody with no '
    + 'knowledge of the internal history, so it must stand entirely on its own.]',
    '',
    '[Say what is being proposed or requested, and who at this University will carry it '
    + 'forward.]',
  ].join('\n'),

  partnership: [
    'I write on behalf of ICOF Global University to propose [the partnership].',
    '',
    '[Say what each institution would do, and what each would receive. A proposal that '
    + 'states only the intention leaves the recipient nothing to agree to.]',
    '',
    '[State what is proposed next — a meeting, a memorandum of understanding, a working '
    + 'group — and who would take it forward.]',
    '',
    'Nothing in this letter binds either institution; it is a proposal for discussion.',
  ].join('\n'),

  directive: [
    'This directive is issued by [the office] and takes effect on [date].',
    '',
    '[State what is required, of whom, and from when. A directive that does not name who it '
    + 'binds is an opinion.]',
    '',
    '[State what is to be done if the requirement cannot be met, and who to raise that with.]',
    '',
    'This directive remains in force until it is withdrawn or replaced in writing.',
  ].join('\n'),

  warning: [
    'This letter is a formal warning concerning [the matter].',
    '',
    'What occurred: [state the facts, with dates.]',
    '',
    'Why it is a concern: [state which requirement or expectation was not met.]',
    '',
    'What is required now: [state what must change, and by when.]',
    '',
    'You may respond to this letter in writing to [the office] within [period]. Your response '
    + 'will be placed on the record alongside this letter. If the matter is not resolved, the '
    + 'University may take further action under its disciplinary procedure, under which you '
    + 'would be told the case against you and given a fair opportunity to answer it.',
  ].join('\n'),

  authorization: [
    'This letter authorises [name] to [what is authorised] on behalf of ICOF Global '
    + 'University.',
    '',
    'This authority takes effect on [date] and [ends on [date] / remains in force until '
    + 'withdrawn in writing].',
    '',
    'The limits of this authority are: [state them. An authorisation without limits is one '
    + 'the University cannot later say was exceeded.]',
    '',
    'This authority may be verified with the issuing office using the reference above.',
  ].join('\n'),

  'official-response': [
    'I write in response to your letter of [date] concerning [the matter].',
    '',
    '[Answer what was asked, in the order it was asked. A response that addresses the '
    + 'general subject rather than the questions put is the one that produces a second '
    + 'letter.]',
    '',
    '[If anything cannot be answered, say so and say why, rather than leaving it out.]',
  ].join('\n'),

  'special-assignment': [
    'I write to assign to you the following duty on behalf of ICOF Global University.',
    '',
    'The assignment: [what is to be done.]',
    'Period: from [date] to [date].',
    'Reporting to: [officer].',
    '',
    '[State what authority the assignment carries, and what it does not. An assignment is '
    + 'usually disputed over what the holder was entitled to decide.]',
    '',
    'Your substantive post and its conditions are unaffected except as stated here.',
  ].join('\n'),

  special: [
    'I write on behalf of ICOF Global University concerning [the matter].',
    '',
    '[Set out the position in full.]',
    '',
    '[Say what is being asked or conveyed, and what happens next.]',
  ].join('\n'),

  other: [
    'I write on behalf of ICOF Global University concerning [the matter].',
    '',
    '[Set out the position in full.]',
    '',
    '[Say what is being asked or conveyed, and what happens next.]',
  ].join('\n'),
};

/**
 * The standard opening for a kind of letter, or null where there is none.
 *
 * NULL RATHER THAN AN EMPTY STRING, so a caller cannot fill the box with
 * nothing and report that it filled it.
 */
export function draftFor(kind: string): string | null {
  const text = (DRAFTS as Record<string, string | undefined>)[kind];
  return text && text.trim() ? text : null;
}

/**
 * Does this text still carry an unfilled prompt?
 *
 * THE CHECK THAT MAKES THE BRACKETS SAFE. A skeleton is only a good idea if
 * sending one unfinished is hard, and this is what the composer warns on.
 * Deliberately not a refusal: a letter may legitimately contain a bracket, and
 * a rule that refused one would be wrong at exactly the moment it was
 * inconvenient to argue with.
 */
export function unfilledPrompts(body: string | null | undefined): string[] {
  if (!body) return [];
  return Array.from(String(body).matchAll(/\[([^\]\n]{2,80})\]/g)).map((m) => m[0]);
}
