// ---------------------------------------------------------------------------
// The admission package.
//
// One document, emailed to the applicant's own address the moment the
// Admissions Office admits them. It is the only thing many of them will have
// from the university until they arrive, and for an international applicant it
// is the document they take to an embassy — so it has to stand on its own, with
// nothing assumed and nothing to look up.
//
// HOW IT IS ARRANGED, AND WHY THE ARRANGEMENT IS THE POINT:
//
//   PAGE 1 is the admission letter, and nothing else. The letterhead, the
//   reference, the student's particulars, the offer, and the signature of the
//   Head of Academic Affairs at the foot of that same page.
//
//   PAGES 2 ONWARD are annexes to it, lettered A, B, C…, each starting on a
//   fresh page: the conditions, the terms of study, the fees, the regulations,
//   and what to do next.
//
// The signature used to sit at the end of the whole pack, after the last annex.
// That is wrong, and not only in appearance: a signature at the end of a
// document signs everything above it, so the letter itself carried no signature
// on its own page. Detach page 1 — which is what an embassy, an employer or a
// sponsor will photocopy — and it was an unsigned sheet. The letter is now
// self-contained: the offer, the particulars it is made against, and the
// signature under them, on one page that stands alone.
//
// The letter carries the student's particulars in full — name, date of birth,
// nationality, student number, application number — because it is an identity
// document as much as an offer. A reader has to be able to match the letter to
// the person holding it without another document in hand.
//
// Those same particulars are sealed: a code computed over them with a key only
// the university holds, printed beside the signature, repeated in the watermark
// behind the text and in the running head of every annexe. Change a name on the
// face of the letter and the code stops matching it, the watermark disagrees,
// and the annexes disagree too. See src/lib/documentSecurity.ts, which is
// candid about what this does and does not achieve.
//
// WHAT IS DELIBERATELY NOT IN IT: any figure the university has not published.
// The fee band is described and pointed at the published schedule rather than
// quoted, because a wrong amount in an admission letter is a contractual
// problem, not a typo.
//
// The letter is generated as HTML rather than PDF because no PDF toolchain is
// installed in this deployment, and an HTML letter that prints correctly is
// worth more than a PDF that cannot be produced. It carries print CSS, opens to
// A4, and every recipient can save it to PDF from their browser. If a true PDF
// is needed later, this is the document to render.
// ---------------------------------------------------------------------------

import { UNIVERSITY } from './constants';
import { CREST_DATA_URI } from './crest';
import { sealParticulars, watermarkDataUri, microtext, verificationQrSvg } from './documentSecurity';

/**
 * The public site, for the links printed in the letter.
 *
 * SITE_URL is set in Vercel; the fallback is the university's own domain
 * rather than a placeholder, because this string is printed on a document a
 * graduate may still be holding in ten years.
 */
const SITE = process.env.SITE_URL ?? `https://${UNIVERSITY.website.replace(/^www\./, '')}`;

/**
 * The address on the letterhead and in the footer.
 *
 * Admissions, not the Registrar. A student replying to a query about their
 * admission letter should reach the office that issued it.
 */
const ADMISSIONS_EMAIL = 'admissions@iguc.net';
import { passMark, gradeScale, classificationBands } from '@/content/regulations';

export interface AdmissionPackageInput {
  fullName: string;
  studentNumber: string;
  /**
   * The particulars the letter is made against.
   *
   * Optional because an application may be missing any of them, and a letter
   * with a blank date of birth is better than no letter. Each is omitted from
   * the printed block rather than shown empty — an official document with
   * "Date of birth: —" on it invites the question of what else is missing.
   */
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  programme: string;
  faculty: string;
  level: string;
  campus: string;
  /** 'On campus' | 'Online' | 'Campus and online'. Decides which terms apply. */
  mode: string;
  /** 'Full time' | 'Part time'. Separate from mode — where and how often. */
  attendance?: string;
  intake: string;
  applicationNumber: string;
  conditions?: { requirement: string; dueBy: string }[];
  /**
   * Named so the letter is signed by a person holding an office rather than by
   * "the system". The university signs admission letters as Head of Academic
   * Affairs; the office is fixed, the holder is not, so only the name is passed.
   */
  headOfAdmissions: string;
  /** Affixed to the name on the signature line, e.g. "PhD (Finance), PhD …". */
  postNominals?: string;
  registrar: string;
  issuedOn?: Date;
  portalUrl: string;
  /** Present only when the account is created with the offer. */
  temporaryPassword?: string;
}

const esc = (v: string) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Which sets of terms apply.
 *
 * Three answers, not two. A student admitted for "Campus and online" is bound
 * by both sets, and telling them one set "does not apply to you" would be
 * false — which is what happened while this returned a boolean.
 */
function modeOf(mode: string): 'campus' | 'online' | 'both' {
  const m = (mode ?? '').toLowerCase();
  if (/both|and online|blend|hybrid/.test(m)) return 'both';
  if (/online|distance|odl/.test(m)) return 'online';
  return 'campus';
}

/* ------------------------------------------------------------------ */
/* The terms, held as data so both versions stay in step               */
/* ------------------------------------------------------------------ */

const CAMPUS_TERMS: string[] = [
  'You are expected in person for lectures, seminars and examinations at your registered campus. Attendance is recorded.',
  'Registration is completed in the portal and you may begin studying at once. The Office of the Registrar completes your formalities when you arrive, and you should bring the originals of every document uploaded with your application.',
  'Examinations are sat on campus, under invigilation, on the dates published in the academic calendar. An examination missed without prior approval is recorded as a non-attempt.',
  'A student card is issued at registration and must be carried on campus and produced at every examination.',
  'Accommodation is not allocated by the university. The Office of Student Affairs can advise on lodging near the campus but does not guarantee it.',
  'A change of campus after registration requires the written approval of the Registrar and may affect the fee band that applies to you.',
];

const ONLINE_TERMS: string[] = [
  'Teaching is delivered through the university’s online learning environment. You are responsible for arranging a device and an internet connection sufficient to take part; the university cannot supply either.',
  'Registration is completed in the student portal and you may begin studying at once. Certified copies of every document uploaded with your application must reach the Office of the Registrar before your first examination.',
  'Live sessions are scheduled in West Africa Time (UTC+1). Recordings are made available where a session is recorded, but participation is assessed, and participation carries 20% of the mark in every taught course.',
  'Examinations are taken online under the conditions published for each course. Where an examination requires supervision, you are responsible for meeting the identification requirements set for it.',
  'Continuous assessment deadlines are absolute and are set in West Africa Time. A submission is late by the clock of the learning environment, not the clock where you are.',
  'A transfer to on-campus study requires the written approval of the Registrar and will change the fee band that applies to you.',
];

const COMMON_TERMS: string[] = [
  'This offer is made for the intake stated and is not transferable to another intake without the written approval of the Admissions Office.',
  'This offer is personal to you and cannot be transferred to another person.',
  'The university may withdraw this offer if any information given in your application is found to be false, incomplete or misleading, at any point during your studies or afterwards.',
  'Your place is confirmed by completing registration in the portal. You may begin studying immediately; the fee schedule runs alongside your study rather than before it. An offer not taken up by the end of the registration period lapses.',
];

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const list = (items: string[]) =>
  `<ol class="terms">${items.map((t) => `<li>${t}</li>`).join('')}</ol>`;

/** A particulars row, rendered only when there is something to put in it. */
const row = (k: string, v: string | undefined | null): string =>
  v && String(v).trim()
    ? `<tr><td class="k">${esc(k)}</td><td class="v">${esc(String(v))}</td></tr>`
    : '';

export async function admissionPackageHtml(input: AdmissionPackageInput): Promise<string> {
  const issued = input.issuedOn ?? new Date();
  const issuedLong = issued.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const issuedIso = issued.toISOString().slice(0, 10);

  // The seal is computed here, from the same values that are printed, so the
  // code on the page can never describe a different letter from the one it is
  // printed on. Deriving it in the caller would allow the two to drift.
  const seal = sealParticulars(
    {
      fullName: input.fullName,
      dateOfBirth: input.dateOfBirth,
      studentNumber: input.studentNumber,
      applicationNumber: input.applicationNumber,
      programme: input.programme,
      issuedOn: issuedIso,
    },
    SITE,
  );
  const watermark = watermarkDataUri(input.studentNumber, seal.code);
  // The QR carries the full-strength signature. The printed code beside it is
  // the same seal shortened for a human; this is the one a machine checks.
  const qr = seal.sealed ? await verificationQrSvg(seal.verifyUrl, 84) : '';
  const micro = microtext(input.studentNumber, seal.code);

  const where = modeOf(input.mode);
  const online = where === 'online';
  const both = where === 'both';
  const conditional = (input.conditions?.length ?? 0) > 0;

  // For a student admitted to both, every term applies and nothing is marked
  // as not applying. For the other two, their own terms come first in full and
  // the other set follows, marked.
  const ownTerms = both ? [...CAMPUS_TERMS, ...ONLINE_TERMS] : online ? ONLINE_TERMS : CAMPUS_TERMS;
  const otherTerms = both ? [] : online ? CAMPUS_TERMS : ONLINE_TERMS;
  const ownLabel = both
    ? 'study on campus and online'
    : online ? 'online study' : 'study on campus';
  const otherLabel = online ? 'study on campus' : 'online study';

  // ---------------------------------------------------------------------
  // The annexes, built as a list so they letter themselves.
  //
  // Which annexes exist depends on the offer — a student admitted to both
  // modes gets no "terms for the other mode" — so A, B, C… are assigned from
  // the list rather than written into the headings, where they would go out of
  // step the first time a section was added or dropped.
  // ---------------------------------------------------------------------
  const annexes: { title: string; body: string }[] = [];

  annexes.push({
    title: 'Conditions of this offer',
    body: conditional
      ? `
      <div class="callout warn">
        <strong>This offer is conditional.</strong> You may register and begin study, but the
        following must be completed by the dates given. Each remains on your record until it is
        met, and an unmet condition may lead to your registration being withdrawn.
      </div>
      <table class="details">
        ${input.conditions!.map((c) => `
        <tr>
          <td class="k">${esc(c.requirement)}</td>
          <td class="v">by ${esc(c.dueBy)}</td>
        </tr>`).join('')}
      </table>`
      : `
      <p>This offer is unconditional. No further academic condition is attached to it.</p>
      <p>It remains subject to the general terms in the next annexe, and in particular to the
      accuracy of the information given in your application.</p>`,
  });

  annexes.push({
    title: `Terms of study — ${ownLabel}`,
    body: `
      <p>These are the terms that apply to you, as a student admitted to study
      <strong>${esc(input.mode.toLowerCase())}</strong>${
        input.attendance ? `, ${esc(input.attendance.toLowerCase())}` : ''
      }.${both ? ' You are bound by the campus terms and the online terms, because you will study both ways.' : ''}</p>
      ${list(ownTerms)}
      <h3>General terms, applying to every student</h3>
      ${list(COMMON_TERMS)}`,
  });

  if (!both) {
    annexes.push({
      title: `Terms for ${otherLabel}`,
      body: `
      <div class="muted-block">
        <strong>These do not apply to you at present.</strong> They are included because students
        do transfer between modes, and a student who moves should not discover afterwards that the
        rules changed underneath them. A transfer requires the written approval of the Registrar.
      </div>
      ${list(otherTerms)}`,
    });
  }

  annexes.push({
    title: 'Fees and payment',
    body: `
      <p>
        The university operates two fee bands. Students from Africa and the Global South are
        charged a subsidised rate, funded as scholarship by the International Circle of Faith.
        Students from Europe and North America are charged a higher rate.
      </p>
      <p>
        <strong>All fees are quoted in US dollars, and you do not have to pay in dollars.</strong>
        Payment is made in your own national currency to the ICOF national base in your country,
        which issues your receipt and remits to the university. Ask the national base for the rate
        in force before you pay, and keep the receipt — it is what the Finance Office matches your
        record against. Where no national base has been established, payment is made directly to
        the university by the means published on the Cost &amp; Tuition page.
      </p>
      <p>
        The schedule that applies to your programme, and the instalment terms available on it, are
        published at <strong>${esc(UNIVERSITY.website)}/tuition</strong>. The Finance Office will
        confirm what is due and when. <strong>You may begin studying before any of it is
        settled</strong> — being admitted is what enrols you, not being paid up.
      </p>
      <div class="callout">
        Fees are quoted to you by the Finance Office in writing. No amount is stated in this
        letter, and no member of staff is authorised to agree a different figure with you
        privately. If anyone asks you to pay outside the university's published channels, report
        it to the Office of Admissions at ${esc(ADMISSIONS_EMAIL)}.
      </div>`,
  });

  annexes.push({
    title: 'Academic regulations you are accepting',
    body: `
      <p>By registering you accept the university's academic regulations. The provisions you are
      most likely to need are set out here; the full regulations are published at
      <strong>${esc(UNIVERSITY.website)}/academic-regulations</strong>.</p>

      <h3>Grading and the pass mark</h3>
      <p>The pass mark is <strong>${esc(passMark)}</strong>. Grades are awarded on the following
      scale, and grade points run to 4.00.</p>
      <table class="grade-table">
        <tr><th>Grade</th><th>Range</th><th>Points</th><th>Descriptor</th></tr>
        ${gradeScale.map((g) => `
        <tr><td>${esc(g.grade)}</td><td>${esc(g.range)}</td><td>${esc(g.points)}</td><td>${esc(g.descriptor)}</td></tr>`).join('')}
      </table>

      <h3>Assessment</h3>
      <p>Taught courses are assessed on four components — participation 20%, assignments 30%,
      examinations 30% and presentations 20%. Every component carries a mark, and a component not
      submitted is marked zero.</p>

      <h3>Degree classification</h3>
      <table class="grade-table">
        <tr><th>Classification</th><th>Requires</th></tr>
        ${classificationBands.map((b) => `
        <tr><td>${esc(b.label)}</td><td>${esc(b.basis)} (CGPA ${b.min.toFixed(2)})</td></tr>`).join('')}
      </table>

      <h3>Academic integrity</h3>
      <p>Plagiarism, the fabrication of data, and the submission of work that is not your own are
      academic misconduct. So is presenting work generated by another person or by a machine as
      your own. Misconduct is dealt with under the university's disciplinary process, and a finding
      may result in the cancellation of a mark, of a course, or of your admission.</p>

      <h3>Discipline and appeal</h3>
      <p>Disciplinary matters are heard under the process published in the Student Handbook. You
      have the right to be told the case against you, to answer it, and to appeal a decision to the
      Registrar within fourteen days of being notified of it.</p>`,
  });

  annexes.push({
    title: 'What to do next',
    body: `
      <ol class="terms">
        <li><strong>Sign in to the student portal</strong> at
          <strong>${esc(input.portalUrl)}</strong> using your student number
          ${input.temporaryPassword ? 'and the temporary password sent in the covering email' : 'and the password issued to you'}.
          Change your password immediately on first sign-in. Your password is personal to you and
          must not be shared with anyone, including university staff — no one at the university
          will ever ask you for it.</li>
        <li><strong>Check your particulars</strong> on page 1 of this letter against your
          identity documents. Your name, date of birth and nationality are printed there exactly
          as they will appear on your award. Anything wrong must be corrected before you register.</li>
        <li><strong>Start straight away.</strong> You are enrolled from the date of this letter
          and may begin studying immediately. Teaching does not wait on the fee schedule, and you
          do not need to have paid anything further before you start.</li>
        <li><strong>Register for your courses</strong> in the portal. ${
          online
            ? 'Everything you need is there; nothing has to be done in person before you begin.'
            : 'You can do this from the portal before you arrive, and complete your registration formalities with the Office of the Registrar when you get here.'
        }</li>
        <li><strong>Fees.</strong> The Finance Office will confirm what is due and when. Fees are
          quoted in US dollars and paid in your own national currency to the ICOF national base in
          your country — you do not need to find dollars. Ask them for the rate in force before
          you pay, and keep the receipt.</li>
        ${conditional ? '<li><strong>Meet the conditions in Annexe A</strong> by the dates given.</li>' : ''}
      </ol>
      <p>If anything in this letter is wrong — your name, your date of birth, your programme, your
      campus or your mode of study — reply to the email that carried it <em>before</em> you
      register, and the Office of Admissions will correct it.</p>`,
  });

  const annexeLetter = (i: number) => String.fromCharCode(65 + i);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Admission Package — ${esc(input.fullName)} — ${esc(input.studentNumber)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #f4f1ea; color: #2f2838;
    font-family: Georgia, 'Times New Roman', serif; font-size: 11.5pt; line-height: 1.55;
  }
  .sheet {
    max-width: 190mm; margin: 0 auto; background: #fff; padding: 16mm 16mm 24mm;
    /* The watermark. Tiled behind everything, on every page, carrying this
       student's number and this letter's seal — see documentSecurity.ts for
       what that is for. print-color-adjust is not optional: browsers drop
       background images when printing by default, and a security feature that
       disappears on the printed copy is not a security feature. */
    background-image: url("${watermark}");
    background-repeat: repeat;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Text sits above the watermark, never under it. */
  .letter, .annex, .foot { position: relative; }

  /* The microtext rule: 2.4pt type clipped to one line. Crisp on an original,
     a grey smudge on a photocopy. */
  .microrule {
    overflow: hidden; white-space: nowrap; height: 1.6mm; line-height: 1.6mm;
    font-family: Helvetica, Arial, sans-serif; font-size: 2.4pt; letter-spacing: .2px;
    color: #6b6076; margin: 6px 0 0; user-select: none;
  }
  .microrule-caption {
    font-family: Helvetica, Arial, sans-serif; font-size: 6.5pt; letter-spacing: 1.2px;
    text-transform: uppercase; color: #a79ab6; margin: 2px 0 0;
  }

  /* The seal panel, at the foot of page 1 beside the signature. */
  .sig-row { display: flex; gap: 14px; align-items: flex-end; margin-top: 14px; }
  .sig-row .sig { flex: 1 1 auto; margin-top: 0; }
  .seal-panel {
    flex: 0 0 74mm; border: 1px solid #d9cba4; background: #fdfbf5;
    padding: 8px 10px; font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt;
    line-height: 1.45; color: #6b6076;
    display: flex; gap: 9px; align-items: flex-start;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .seal-panel .words { flex: 1 1 auto; min-width: 0; }
  .seal-panel .qr { flex: 0 0 19mm; }
  .seal-panel .qr svg { display: block; width: 19mm; height: 19mm; }
  .seal-panel .qr-caption {
    font-size: 6pt; letter-spacing: .6px; text-transform: uppercase;
    color: #8a8194; text-align: center; margin: 2px 0 0;
  }
  .seal-panel .h {
    font-size: 6.5pt; font-weight: bold; letter-spacing: 1.6px; text-transform: uppercase;
    color: #8a6d1f; margin: 0 0 4px;
  }
  /* One line, always. A code that wraps mid-group is a code somebody reads
     aloud wrongly. */
  .seal-panel .code {
    font-family: 'Courier New', Courier, monospace; font-size: 9.5pt; font-weight: bold;
    letter-spacing: .4px; color: #422e59; margin: 0 0 4px; white-space: nowrap;
  }
  .seal-panel .url { word-break: break-all; color: #422e59; }
  .seal-panel.unsealed { border-color: #d6b48a; background: #fffaf0; }
  .void-mark {
    font-family: Helvetica, Arial, sans-serif; font-size: 6.5pt; font-weight: bold;
    letter-spacing: 2px; text-transform: uppercase; color: #b45309; margin: 5px 0 0;
  }
  /* The letterhead.
     A solid purple slab with a centred crest was a banner, not a letterhead —
     it read as a web hero pasted onto a document, and it wasted the top third
     of the first page. A university's letterhead is typographic: the name, the
     motto, the office issuing the letter, a rule, and the contact block. It
     prints in one colour if it has to, and it leaves room for the letter.

     No photograph. A campus picture on an admission letter dates the document,
     bloats the file, prints badly in greyscale, and — for a university teaching
     on two campuses and online — tells a student who will never visit Buea
     something untrue about where they are going. */
  .letterhead {
    display: flex; align-items: flex-start; gap: 14px;
    padding: 0 0 8px; border-bottom: 2.5px solid #422e59; margin-bottom: 3px;
  }
  .letterhead .crest { width: 70px; height: 70px; flex: 0 0 70px; object-fit: contain; }
  .letterhead .lockup { flex: 1 1 auto; min-width: 0; padding-top: 2px; padding-right: 8px; }
  .letterhead .name {
    /* No nowrap. It sat the name on one line by pushing it straight through
       the contact block on its right — the two overlapped and both became
       unreadable. The lockup is allowed to wrap; the contact column has a
       fixed width so it cannot be encroached on. */
    margin: 0; font-size: 16pt; line-height: 1.12; font-weight: bold;
    letter-spacing: .8px; color: #422e59; text-transform: uppercase;
  }
  .letterhead .sub {
    margin: 2px 0 0; font-size: 10.5pt; letter-spacing: 3px;
    text-transform: uppercase; color: #6b6076;
  }
  .letterhead .descriptor {
    margin: 3px 0 0; font-family: Helvetica, Arial, sans-serif; font-size: 8pt;
    letter-spacing: 2.4px; text-transform: uppercase; color: #6b6076;
  }
  .letterhead .motto {
    margin: 4px 0 0; font-size: 10.5pt; font-style: italic; color: #8a6d1f;
    letter-spacing: .3px;
  }
  /* Headquarters, email, website.
     The Buea campus address used to sit here. It is the wrong address for this
     document: the letter goes to applicants in a dozen countries, most of whom
     will never see Buea, and it is presented to embassies and employers who
     need to know what institution stands behind it — not which of its campuses
     happens to teach. It names the seat of the institution and its descriptor,
     "The Community University of Africa", so the letterhead reads as what the
     university is rather than where one of its buildings is.

     No telephone number: an admission letter is kept for years, a number
     changes, and a wrong one on a document a graduate is still holding is worse
     than none — and the reply this letter wants is written anyway. */
  .letterhead .contact {
    flex: 0 0 48mm; text-align: right; font-size: 8.5pt; line-height: 1.5; color: #6b6076;
    font-family: Helvetica, Arial, sans-serif; padding-top: 4px;
  }
  /* The thin gold rule under the main one — the university's two colours, in
     the proportion they are used everywhere else. */
  .rule-gold { height: 2px; background: #c5a55a; margin-bottom: 16px; }
  .office-line {
    font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; letter-spacing: 2.5px;
    text-transform: uppercase; color: #422e59; margin: 0 0 14px;
  }
  h2 {
    font-size: 12pt; text-transform: uppercase; letter-spacing: 1.5px;
    color: #422e59; border-bottom: 1px solid #e8dcc0; padding-bottom: 5px; margin: 0 0 10px;
  }
  h3 { font-size: 11pt; color: #422e59; margin: 14px 0 6px; }

  /* The letter is one page and the annexes follow it, each on its own.
     break-after on the letter guarantees the signature is the last thing on
     page 1 even when a long name or an extra particular pushes the block down;
     break-before on each annex keeps them from running together. */
  .letter { break-after: page; }
  .annex { break-before: page; }
  .annex-head {
    display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
    border-bottom: 1px solid #e8dcc0; padding-bottom: 6px; margin-bottom: 14px;
    font-family: Helvetica, Arial, sans-serif; font-size: 8pt; letter-spacing: 2px;
    text-transform: uppercase; color: #8a8194;
  }
  .annex-head .who { text-align: right; }
  .annex h2 { border-bottom: none; padding-bottom: 0; margin-bottom: 12px; font-size: 13pt; }
  .annex .tag {
    display: block; font-family: Helvetica, Arial, sans-serif; font-size: 8pt;
    letter-spacing: 2.5px; color: #8a6d1f; margin-bottom: 3px;
  }
  /* On screen there are no page edges to separate the parts, so the breaks are
     drawn instead. Printing ignores this entirely. */
  @media screen {
    .letter { padding-bottom: 14mm; border-bottom: 1px dashed #ded7c6; margin-bottom: 16mm; }
    .annex + .annex { padding-top: 12mm; border-top: 1px dashed #ded7c6; margin-top: 16mm; }
  }

  .doc-title {
    font-family: Helvetica, Arial, sans-serif; font-size: 12pt; font-weight: bold;
    letter-spacing: 3px; text-transform: uppercase; color: #422e59;
    text-align: center; margin: 4px 0 16px;
  }
  .ref { display: flex; justify-content: space-between; font-size: 9.5pt; color: #6b6076; margin-bottom: 14px; }

  /* The particulars, two columns: who the student is, and what they are
     admitted to. Side by side because a reader checking identity and a reader
     checking the award are looking for different halves of the same block. */
  .particulars { display: flex; gap: 16px; margin: 10px 0 2px; }
  .particulars > div { flex: 1 1 0; min-width: 0; }
  .particulars h3 {
    margin: 0 0 2px; font-family: Helvetica, Arial, sans-serif; font-size: 8pt;
    letter-spacing: 2px; text-transform: uppercase; color: #8a8194; font-weight: bold;
    border-bottom: 1px solid #e8dcc0; padding-bottom: 4px;
  }
  /* Set tight. Fifteen particulars across two columns is a block, not prose,
     and the letter has one page to hold it in along with everything else. */
  .particulars table.details {
    margin-top: 3px; font-size: 9.5pt; line-height: 1.3;
  }
  .particulars table.details td { padding: 1.5px 0; }
  .particulars table.details td.k { width: 46%; }
  /* The index of annexes, set as a run rather than a list. Five annexes stacked
     one per line cost more of page 1 than the letter can spare, and this is a
     contents line, not a section. */
  .annexe-index { font-size: 9.5pt; color: #554c60; }
  .annexe-index b { color: #422e59; }

  /* THE LETTER IS BUDGETED TO ONE PAGE — 987px of printable A4 at 96dpi, after
     the 18mm @page margins. It measures 910px on a typical offer and 967px on
     the worst realistic one (a 49-character name, a 76-character programme, a
     conditional offer, online only). Anything added to page 1 has to come out
     of that headroom, or the signature slides onto page 2 and the letter stops
     being the self-contained sheet the whole arrangement exists to produce.
     scratchpad/stress.mjs measures it. */
  .letter p { margin: 8px 0; }
  .letter .doc-title { margin: 2px 0 10px; }
  .letter .ref { margin-bottom: 10px; }
  table.details { width: 100%; border-collapse: collapse; margin: 10px 0 4px; font-size: 10.5pt; }
  table.details td { padding: 3px 0; vertical-align: top; }
  table.details td.k { color: #6b6076; width: 42%; }
  table.details td.v { font-weight: bold; }
  ol.terms { margin: 6px 0 0; padding-left: 20px; }
  ol.terms li { margin-bottom: 7px; }
  .callout {
    border-left: 3px solid #c5a55a; background: #faf6ee; padding: 10px 14px; margin: 12px 0; font-size: 10.5pt;
  }
  .callout.warn { border-left-color: #b45309; background: #fffbeb; }
  .muted-block { border: 1px solid #e8dcc0; background: #fbfaf7; padding: 10px 14px; margin-top: 10px; font-size: 10pt; color: #554c60; }
  .sig { margin-top: 20px; }
  /* Full width of the signature column rather than a fixed measure: the seal
     panel beside it sets that column's width, and a rule wider than its column
     would run under the panel. */
  .sig .rule { border-top: 1px solid #33234a; width: 100%; padding-top: 5px; }
  .sig .name { font-weight: bold; }
  .sig .office { color: #6b6076; font-size: 10pt; }
  .grade-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 8px; }
  .grade-table th, .grade-table td { border: 1px solid #e8dcc0; padding: 4px 7px; text-align: left; }
  .grade-table th { background: #faf6ee; font-size: 9pt; text-transform: uppercase; letter-spacing: .5px; }
  .foot { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e8dcc0; font-size: 9pt; color: #8a8194; text-align: center; }
  @media print {
    body { background: #fff; }
    /* @page already supplies the margin. Leaving the sheet's own padding on top
       of it double-margined every printed page and pushed the signature off
       page 1 — the one thing the whole arrangement exists to prevent. */
    .sheet { max-width: none; padding: 0; }
  }
</style>
</head>
<body>
<div class="sheet">

  <!-- ==================================================================
       PAGE 1 — THE ADMISSION LETTER
       Self-contained: letterhead, reference, particulars, offer, signature.
       Nothing else goes on this page, and it ends with a page break.
       ================================================================== -->
  <section class="letter">

    <header class="letterhead">
      <img class="crest" src="${CREST_DATA_URI}" alt="${esc(UNIVERSITY.name)} crest">
      <div class="lockup">
        <h1 class="name">${esc(UNIVERSITY.name)}</h1>
        <p class="descriptor">${esc(UNIVERSITY.descriptor)}</p>
        <p class="motto">${esc(UNIVERSITY.motto)}</p>
      </div>
      <div class="contact">
        ${esc(UNIVERSITY.headquarters)}<br>
        ${esc(ADMISSIONS_EMAIL)}<br>
        ${esc(UNIVERSITY.website)}
      </div>
    </header>
    <div class="rule-gold"></div>
    <p class="microrule">${esc(micro)}</p>
    <p class="office-line">Office of Admissions</p>

    <div class="ref">
      <span>Our ref: ${esc(input.applicationNumber)}</span>
      <span>${esc(issuedLong)}</span>
    </div>

    <p class="doc-title">${conditional ? 'Conditional Offer of Admission' : 'Offer of Admission'}</p>

    <p>Dear ${esc(input.fullName)},</p>

    <p>
      Following the assessment of your application by the Office of Admissions, I am pleased to
      offer you ${conditional ? '<strong>conditional admission</strong>' : '<strong>admission</strong>'}
      to ${esc(UNIVERSITY.name)}, on the particulars recorded below. This offer is personal to you.
    </p>

    <div class="particulars">
      <div>
        <h3>The student</h3>
        <table class="details">
          ${row('Full name', input.fullName)}
          ${row('Date of birth', input.dateOfBirth)}
          ${row('Gender', input.gender)}
          ${row('Nationality', input.nationality)}
          ${row('Student number', input.studentNumber)}
          ${row('Application number', input.applicationNumber)}
        </table>
      </div>
      <div>
        <h3>The admission</h3>
        <table class="details">
          ${row('Programme', input.programme)}
          ${row('Faculty', input.faculty)}
          ${row('Level', input.level)}
          ${row('Mode of study', input.mode)}
          ${row('Attendance', input.attendance || 'Full time')}
          ${row('Campus', input.campus)}
          ${row('Intake', input.intake)}
          ${row('Status', conditional ? 'Admitted, conditionally' : 'Admitted')}
        </table>
      </div>
    </div>

    <p>
      Your student number is <strong>${esc(input.studentNumber)}</strong>. It does not change:
      quote it in every communication, on every payment, and to sign in to the portal. The
      particulars above are what will appear on your award — check them against your identity
      documents and tell us before you register if any is wrong.
    </p>

    <p>
      ${conditional
        ? 'Your offer carries conditions, set out in Annexe A. You may register and begin studying now, and you are enrolled from the date of this letter.'
        : 'You are enrolled from the date of this letter and may begin studying at once; teaching does not wait on the fee schedule.'}
      The terms on which the offer is made are annexed to this letter and form part of it:
      <span class="annexe-index">${annexes
        .map((a, i) => `<b>${annexeLetter(i)}</b> ${esc(a.title)}`)
        .join(' &nbsp;·&nbsp; ')}.</span>
    </p>

    <div class="sig-row">
      <div class="sig">
        <p>We look forward to welcoming you to ${esc(UNIVERSITY.name)}.</p>
        <p>Yours sincerely,</p>
        <div class="rule">
          <div class="name">${esc(input.headOfAdmissions)}${
            input.postNominals ? `, ${esc(input.postNominals)}` : ''
          }</div>
          <div class="office">Head of Academic Affairs</div>
          <div class="office">${esc(UNIVERSITY.name)}</div>
        </div>
      </div>

      ${seal.sealed ? `
      <div class="seal-panel">
        <div class="words">
          <p class="h">Document seal</p>
          <p class="code">${esc(seal.code)}</p>
          <p style="margin:0">Sealed over the particulars printed on this page. Alter any of them
          and the seal stops matching.</p>
          <p style="margin:4px 0 0">Or check at <span class="url">${esc(UNIVERSITY.website)}/verify</span></p>
          <p class="void-mark">Void if altered</p>
        </div>
        <div class="qr">
          ${qr}
          <p class="qr-caption">Scan to verify</p>
        </div>
      </div>` : `
      <div class="seal-panel unsealed">
        <div class="words">
          <p class="h">Document seal</p>
          <p><strong>Not sealed.</strong> This copy was produced while the university's signing key
          was unavailable, so it carries no verification code. It is a genuine letter but cannot be
          checked electronically. Ask the Office of Admissions to reissue it.</p>
        </div>
      </div>`}
    </div>

    <p class="microrule">${esc(micro)}</p>
    <p class="microrule-caption">The line above is printed text, not a rule. It is legible on an original and illegible on a copy.</p>

  </section>

  <!-- ==================================================================
       PAGES 2 ONWARD — THE ANNEXES
       Each starts on a fresh page and carries a running head, so a page
       separated from the pack can still be traced to its student.
       ================================================================== -->
  ${annexes.map((a, i) => `
  <section class="annex">
    <div class="annex-head">
      <span>${esc(UNIVERSITY.name)} — Admission Package</span>
      <span class="who">${esc(input.fullName)} · ${esc(input.studentNumber)}${
        seal.sealed ? ` · ${esc(seal.code)}` : ''
      }</span>
    </div>
    <h2>
      <span class="tag">Annexe ${annexeLetter(i)}</span>
      ${esc(a.title)}
    </h2>
    ${a.body}
  </section>`).join('')}

  <div class="foot">
    This admission package was issued electronically on ${esc(issuedLong)} to
    ${esc(input.fullName)}, student number ${esc(input.studentNumber)}, and is valid without a
    handwritten signature. It comprises the admission letter and
    ${annexes.length} annexe${annexes.length === 1 ? '' : 's'}.${
      seal.sealed
        ? ` It is sealed under code <strong>${esc(seal.code)}</strong>, which may be checked at ${esc(UNIVERSITY.website)}/verify or with the Office of Admissions at ${esc(ADMISSIONS_EMAIL)}.`
        : ` Its authenticity may be confirmed with the Office of Admissions at ${esc(ADMISSIONS_EMAIL)}, quoting ${esc(input.applicationNumber)} and ${esc(input.studentNumber)}.`
    }
  </div>

</div>
</body>
</html>`;
}

/** The plain-text covering note the package is attached to. */
export function admissionCoveringText(input: AdmissionPackageInput): string {
  const conditional = (input.conditions?.length ?? 0) > 0;
  return `Dear ${input.fullName},

Your application to ${UNIVERSITY.name} has been assessed by the Office of Admissions,
and I am pleased to tell you that you have been offered${conditional ? ' conditional' : ''} admission.

  Full name        ${input.fullName}${input.dateOfBirth ? `
  Date of birth    ${input.dateOfBirth}` : ''}${input.nationality ? `
  Nationality      ${input.nationality}` : ''}
  Programme        ${input.programme}
  Faculty          ${input.faculty}
  Mode of study    ${input.mode}
  Campus           ${input.campus}
  Intake           ${input.intake}
  Student number   ${input.studentNumber}
  Application no.  ${input.applicationNumber}
${input.temporaryPassword ? `
  Portal           ${input.portalUrl}
  Username         ${input.studentNumber}
  Temporary password  ${input.temporaryPassword}

Please sign in and change your password immediately. Your password is personal to you and
must not be shared with anyone, including university staff.
` : ''}
Your full admission package is attached. Page 1 is the admission letter itself, signed by the
Head of Academic Affairs and carrying your particulars and a document seal; the annexes that
follow set out the conditions of your offer, the terms of study, the fee arrangements, and the
academic regulations you are accepting by registering. Please read it before you register.

Keep the letter as it was sent. It carries a seal computed over your name, date of birth,
student number, application number and programme, so anyone you present it to — an employer, a
sponsor, an embassy — can check it at ${UNIVERSITY.website}/verify. Editing the file, even to
correct something, breaks the seal and makes the letter unverifiable.
${conditional ? `
YOUR OFFER IS CONDITIONAL. The conditions and their dates are set out in the attached package.
You may register and begin study, but each condition remains on your record until it is met.
` : ''}
If anything in the package is wrong — your name, your programme, your campus or your mode of
study — reply to this email before you register and we will correct it.

We look forward to welcoming you.

${input.headOfAdmissions}${input.postNominals ? `, ${input.postNominals}` : ''}
Head of Academic Affairs
${UNIVERSITY.name} — ${UNIVERSITY.descriptor}
${UNIVERSITY.headquarters}`;
}
