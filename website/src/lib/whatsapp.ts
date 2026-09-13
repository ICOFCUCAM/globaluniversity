// ---------------------------------------------------------------------------
// SENDING A DOCUMENT BY WHATSAPP.
//
// ---------------------------------------------------------------------------
// WHAT THIS CAN AND CANNOT DO
// ---------------------------------------------------------------------------
//
// It opens the officer's own WhatsApp with a message prepared. It does not
// send anything, it cannot attach the document, and it cannot report whether
// the message was delivered — so nothing here ever writes 'sent'. 079's header
// sets out why that matters: a record asserting a delivery nobody observed is
// evidence against the University that was never true.
//
// WHAT THE MESSAGE CARRIES IS THE REFERENCE AND THE ADDRESS THAT VERIFIES IT.
// This is better than an attachment, not a fallback from one. A PDF forwarded
// through WhatsApp proves nothing about who issued it; a reference checked
// against the University's own verification page proves the document is real
// and has not been altered.
// ---------------------------------------------------------------------------

/**
 * Turn whatever somebody typed into the digits WhatsApp wants.
 *
 * WhatsApp's `wa.me` takes an international number with no `+`, no spaces and
 * no punctuation. People type `+237 6 12 34 56 78`, `(0)612345678` and
 * `237-612-345-678`, all of which mean the same thing.
 *
 * A LEADING ZERO IS A NATIONAL PREFIX AND IS NOT PART OF THE NUMBER. `0612…`
 * dialled from abroad is `…612…` after the country code, and sending to
 * `2370612…` reaches nobody. This strips one leading zero and no more —
 * stripping every leading zero would mangle a number that legitimately starts
 * with one after its country code.
 *
 * Returns null when there is nothing usable, so the caller shows a reason
 * rather than opening WhatsApp on a broken address.
 */
export function whatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d+]/g, '');
  digits = digits.replace(/\+/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  // SHORTER THAN EIGHT DIGITS IS AN EXTENSION OR A TYPO. The shortest real
  // international number is longer than this, and opening WhatsApp on three
  // digits wastes the officer's time in a way that looks like a system fault.
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/**
 * Why a number was refused, in words the officer can act on.
 *
 * NOT "INVALID". An officer told a number is invalid has to guess whether the
 * problem is the number, the field or the system.
 */
export function whyNotWhatsApp(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) {
    return 'There is no phone number on this record, so there is nothing to send to. '
      + 'Add one and it can go by WhatsApp.';
  }
  const digits = String(raw).replace(/[^\d]/g, '');
  if (digits.length < 8) {
    return `“${raw}” is too short to be a number WhatsApp can reach. It needs the country `
      + 'code and the full number — for Cameroon, 237 followed by the nine digits.';
  }
  if (digits.length > 15) {
    return `“${raw}” is longer than any international number. Check it for a doubled country `
      + 'code or an extension that has been run together with it.';
  }
  return null;
}

/**
 * The address that opens WhatsApp with this message prepared.
 *
 * `wa.me` rather than `api.whatsapp.com`: it is the address WhatsApp itself
 * documents, it opens the desktop application where one is installed and the
 * web client where one is not, and it works on a phone without a redirect.
 */
export function whatsappUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** What the University's site is, for a link somebody will click on a phone. */
function siteRoot(website: string): string {
  return /^https?:\/\//.test(website) ? website.replace(/\/$/, '') : `https://${website}`;
}

/**
 * The message that goes with an appointment letter.
 *
 * SIGNED WITH THE UNIVERSITY'S NAME, because a WhatsApp message from an
 * unknown number telling somebody they have been appointed to a post reads
 * like a fraud, and half the reason to send it this way is that it arrives.
 */
export function appointmentMessage(opts: {
  name: string;
  positionTitle: string;
  unitName?: string | null;
  reference: string;
  university: string;
  website: string;
  acceptUrl?: string | null;
}): string {
  const site = siteRoot(opts.website);
  const lines = [
    `Dear ${opts.name},`,
    '',
    `Your letter of appointment as ${opts.positionTitle}`
    + `${opts.unitName ? ` in the ${opts.unitName}` : ''} has been issued by `
    + `${opts.university}.`,
    '',
    `Reference: ${opts.reference}`,
    '',
    `You can read and verify it at ${site}/verify using that reference.`,
  ];
  if (opts.acceptUrl) {
    lines.push('', 'To accept or decline the appointment, open:', opts.acceptUrl);
  }
  lines.push('', opts.university);
  return lines.join('\n');
}

/**
 * The message that goes with an official letter of the University.
 *
 * THE SUBJECT AND NOT THE BODY. An official letter to a ministry may be
 * confidential, long, or both, and pasting it into a WhatsApp message would
 * put the University's correspondence into a chat history it does not control.
 * The message says a letter has been issued and where to read it.
 */
export function correspondenceMessage(opts: {
  name: string;
  subject: string;
  reference: string;
  office: string;
  university: string;
  website: string;
}): string {
  const site = siteRoot(opts.website);
  return [
    `Dear ${opts.name},`,
    '',
    `A letter has been issued to you by the ${opts.office}, ${opts.university}.`,
    '',
    `Subject: ${opts.subject}`,
    `Reference: ${opts.reference}`,
    '',
    `You can read and verify it at ${site}/verify using that reference.`,
    '',
    opts.university,
  ].join('\n');
}
