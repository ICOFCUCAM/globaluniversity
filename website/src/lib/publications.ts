// ---------------------------------------------------------------------------
// THE VICE-CHANCELLOR'S SHELF — the books the University sends out.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// 16 September 2026, with the whole National Rector prospectus attached:
//
//     "Develope and create this book professionally. it should be stored in
//      the VC archive ready to be forwarded by email, whatsap or any method."
//
// Three requirements, and the third is the one that decides the design.
//
// ---------------------------------------------------------------------------
// "READY TO BE FORWARDED BY ANY METHOD" MEANS THE BOOK HAS AN ADDRESS
// ---------------------------------------------------------------------------
//
// A document that can only be read by somebody signed in to the portal cannot
// be forwarded at all. The Vice-Chancellor sends the prospectus to a professor
// in another country who has no account, will never have one, and is deciding
// whether to apply — and a link that answers "no-token" is not a prospectus,
// it is a locked door with the University's name on it.
//
// So the READING address is public, deliberately, and that is a ruling and not
// an oversight. The prospectus exists to be read by strangers; every fact in it
// is one the University wrote to be published; and it names no person, no
// salary, no student and no country.
//
// WHAT IS NOT PUBLIC is the act of SENDING. Reading the prospectus is open;
// sending it from the University's own address, over the University's name, is
// `issue-correspondence` — the same authority that puts any other words of the
// University's into the world.
//
// ---------------------------------------------------------------------------
// AND "STORED IN THE VC ARCHIVE" MEANS THE TEXT IS NOT IN A DATABASE
// ---------------------------------------------------------------------------
//
// It would have been easy to put the book in a table and call that the archive.
// It would also have been wrong. A prospectus is not a record OF something that
// happened — it is the University's standing statement, the same for every
// recipient, and the thing an archive must guarantee about it is that what was
// sent on Monday is word for word what is sent on Friday.
//
// A row in a table gives the weaker guarantee: whatever it currently says. The
// repository gives the stronger one — the text is reviewed, committed, and
// changes only by a commit somebody can read. `src/content/nationalRector.ts`
// IS the archive copy.
//
// What the database does record is what actually happened: every send, to whom,
// by which officer, over which channel, in `audit_logs`. That is the half a
// repository cannot hold, and it is the half an archive is asked about.
// ---------------------------------------------------------------------------

import { NATIONAL_RECTOR, chaptersInOrder, type Book } from '@/content/nationalRector';
import { SYSTEM_HANDBOOK } from '@/content/systemHandbook';
import { UNIVERSITY } from './constants';

export interface Publication {
  /** What it is called in an address: /publications/national-rector */
  slug: string;
  /** For the shelf. The book carries its own title for the cover. */
  title: string;
  subtitle: string;
  /**
   * What kind of document this is, in the University's own vocabulary.
   *
   * A HANDBOOK IS NOT A PROSPECTUS AND THE SHELF SAYS SO. A prospectus goes to
   * strangers deciding whether to join; a handbook goes to the people already
   * here, and an officer choosing what to forward needs to see the difference
   * before they open it rather than after.
   */
  kind: 'Prospectus' | 'Handbook';
  /** Who it is written for — the first thing an officer choosing what to send needs. */
  audience: string;
  /** What it covers, for somebody who has not read it. */
  summary: string;
  /** The file name a recipient sees when they save it. */
  filename: string;
  book: Book;
}

export const PUBLICATIONS: Publication[] = [
  {
    slug: 'national-rector',
    title: 'The National Rector',
    subtitle: 'A Global University. A National Academic Community. Your Leadership.',
    kind: 'Prospectus',
    audience: 'Academics and educational leaders who may be appointed to lead a National '
      + 'Administration.',
    summary: 'The office of National Rector, the National Administration, student enrollment, '
      + 'staffing, financial administration, academic participation, technology, multilingual '
      + 'learning, institutional governance, development, and the process through which '
      + 'qualified candidates may apply. The application form is at the end.',
    filename: 'ICOF-Global-University-The-National-Rector.html',
    book: NATIONAL_RECTOR,
  },
  {
    slug: 'system-handbook',
    title: 'System Handbook',
    subtitle: 'The authoritative operational reference for the ICOF Global University '
      + 'digital system',
    kind: 'Handbook',
    audience: 'Every authorized user of the system \u2014 the executive offices, the Registry, '
      + 'the academic offices, National Administrations, lecturers and students.',
    summary: 'The institutional reference and the system user guide in one binding: what the '
      + 'University is, every role and what it may and may not do, academic and financial '
      + 'administration, teaching and learning, National Administrations, digital operations, '
      + 'the restricted institutional functions, the student handbook, troubleshooting, and '
      + 'step-by-step instructions for lecturers and students. The parts describing authority '
      + 'are generated from the system itself.',
    filename: 'ICOF-Global-University-System-Handbook.html',
    book: SYSTEM_HANDBOOK,
  },
];

export function publicationBySlug(slug: string): Publication | null {
  return PUBLICATIONS.find((p) => p.slug === slug) ?? null;
}

/** How many chapters, for the shelf to say how substantial it is. */
export function chapterCount(publication: Publication): number {
  return chaptersInOrder(publication.book).length;
}

/**
 * Where a recipient reads it.
 *
 * ABSOLUTE, ALWAYS. This string goes into an email, into a WhatsApp message and
 * into the foot of every printed page, and a relative path in any of those
 * three reaches nobody. `SITE_URL` is set in the deployment; the fallback is the
 * University's own domain rather than a placeholder, for the reason
 * `admissionPackage.ts` gives about the same decision — a wrong address printed
 * on a document the University sent is worse than an ugly one.
 */
export function publicationUrl(slug: string, origin?: string | null): string {
  const base = (origin || process.env.SITE_URL || `https://${UNIVERSITY.website}`)
    .replace(/\/+$/, '');
  return `${base}/publications/${slug}`;
}

/**
 * The channels a publication can go out by.
 *
 * WHAT THEY HAVE IN COMMON AND WHERE THEY PART. All three put the book in
 * somebody's hands. Only one of them can tell the University whether it
 * arrived, and the difference is recorded rather than smoothed over — 079 ruled
 * on exactly this for letters, and a publication does not get a softer rule
 * than a letter.
 */
export const CHANNELS = ['email', 'whatsapp', 'link'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  link: 'A copied link',
};

/**
 * What the University can honestly say it knows, per channel.
 *
 * Shown on the screen beside each button, because an officer who believes
 * WhatsApp confirms delivery will tell a candidate it was delivered.
 */
export const CHANNEL_CERTAINTY: Record<Channel, string> = {
  email: 'The University’s own mail server reports whether it went. The prospectus travels as '
    + 'an attachment and as a link.',
  whatsapp: 'Your own WhatsApp opens with the message ready. The University cannot see whether '
    + 'you then press send, so nothing here will claim it was delivered — only that it was '
    + 'handed over, by you, on this date, to that number.',
  link: 'Nothing is recorded, because nothing has happened yet. The address is on your '
    + 'clipboard.',
};
