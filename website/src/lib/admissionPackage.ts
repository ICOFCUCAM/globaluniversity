// ---------------------------------------------------------------------------
// The admission package.
//
// One document, emailed to the applicant's own address the moment the
// Admissions Office admits them. It is the only thing many of them will have
// from the university until they arrive, and for an international applicant it
// is the document they take to an embassy — so it has to stand on its own, with
// nothing assumed and nothing to look up.
//
// WHAT IS IN IT, AND WHY EACH PART EARNS ITS PLACE:
//
//   1. The admission letter, signed by the Head of Admissions. The formal
//      offer. Everything else is annexed to it.
//   2. The conditions of the offer — the specific ones attached to this
//      applicant, if any, with dates.
//   3. Terms of study, in two versions: on-campus and online. The applicant's
//      own mode is given first and in full; the other is present but marked,
//      because students transfer between modes and then discover the rules
//      changed underneath them.
//   4. Fees and payment, with the band the applicant falls into named.
//   5. The regulations they are agreeing to: grading, attendance, academic
//      integrity, and the disciplinary and appeals route.
//   6. What to do next, dated.
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
  programme: string;
  faculty: string;
  level: string;
  campus: string;
  /** 'online' | 'campus' — decides which terms are given first. */
  mode: string;
  intake: string;
  applicationNumber: string;
  conditions?: { requirement: string; dueBy: string }[];
  /**
   * Named so the letter is signed by a person holding an office rather than by
   * "the system". The university signs admission letters as Head of Academic
   * Affairs; the office is fixed, the holder is not, so only the name is passed.
   */
  headOfAdmissions: string;
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

/** True when the applicant is studying online rather than on a campus. */
function isOnline(mode: string): boolean {
  return /online|distance|odl/i.test(mode ?? '');
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

function section(title: string, body: string, opts: { pageBreak?: boolean } = {}): string {
  return `
  <section class="pkg-section${opts.pageBreak ? ' page-break' : ''}">
    <h2>${esc(title)}</h2>
    ${body}
  </section>`;
}

const list = (items: string[]) =>
  `<ol class="terms">${items.map((t) => `<li>${t}</li>`).join('')}</ol>`;

export function admissionPackageHtml(input: AdmissionPackageInput): string {
  const issued = input.issuedOn ?? new Date();
  const issuedLong = issued.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const online = isOnline(input.mode);
  const conditional = (input.conditions?.length ?? 0) > 0;

  const ownTerms = online ? ONLINE_TERMS : CAMPUS_TERMS;
  const otherTerms = online ? CAMPUS_TERMS : ONLINE_TERMS;
  const ownLabel = online ? 'online study' : 'study on campus';
  const otherLabel = online ? 'study on campus' : 'online study';

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
    padding: 0 0 10px; border-bottom: 2.5px solid #422e59; margin-bottom: 3px;
  }
  .letterhead .crest { width: 78px; height: 78px; flex: 0 0 78px; object-fit: contain; }
  .letterhead .lockup { flex: 1; min-width: 0; padding-top: 2px; }
  .letterhead .name {
    /* Sized to sit on one line at A4. A university's name broken across two
       lines in its own letterhead is the first thing a reader notices. */
    margin: 0; font-size: 17pt; line-height: 1.1; font-weight: bold;
    letter-spacing: 1px; color: #422e59; text-transform: uppercase;
    white-space: nowrap;
  }
  .letterhead .sub {
    margin: 2px 0 0; font-size: 10.5pt; letter-spacing: 3px;
    text-transform: uppercase; color: #6b6076;
  }
  .letterhead .motto {
    margin: 4px 0 0; font-size: 10.5pt; font-style: italic; color: #8a6d1f;
    letter-spacing: .3px;
  }
  .letterhead .contact {
    flex: 0 0 auto; text-align: right; font-size: 8.5pt; line-height: 1.5; color: #6b6076;
    font-family: Helvetica, Arial, sans-serif; padding-top: 4px;
  }
  /* The thin gold rule under the main one — the university's two colours, in
     the proportion they are used everywhere else. */
  .rule-gold { height: 2px; background: #c5a55a; margin-bottom: 16px; }
  .office-line {
    font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; letter-spacing: 2.5px;
    text-transform: uppercase; color: #422e59; margin: 0 0 14px;
  }
  .body { padding: 0; }
  h2 {
    font-size: 12pt; text-transform: uppercase; letter-spacing: 1.5px;
    color: #422e59; border-bottom: 1px solid #e8dcc0; padding-bottom: 5px; margin: 0 0 10px;
  }
  h3 { font-size: 11pt; color: #422e59; margin: 14px 0 6px; }
  .pkg-section { margin-bottom: 16px; }
  .page-break { break-before: page; }
  .ref { display: flex; justify-content: space-between; font-size: 9.5pt; color: #6b6076; margin-bottom: 14px; }
  table.details { width: 100%; border-collapse: collapse; margin: 10px 0 4px; font-size: 10.5pt; }
  table.details td { padding: 5px 0; vertical-align: top; }
  table.details td.k { color: #6b6076; width: 42%; }
  table.details td.v { font-weight: bold; }
  ol.terms { margin: 6px 0 0; padding-left: 20px; }
  ol.terms li { margin-bottom: 7px; }
  .callout {
    border-left: 3px solid #c5a55a; background: #faf6ee; padding: 10px 14px; margin: 12px 0; font-size: 10.5pt;
  }
  .callout.warn { border-left-color: #b45309; background: #fffbeb; }
  .muted-block { border: 1px solid #e8dcc0; background: #fbfaf7; padding: 10px 14px; margin-top: 10px; font-size: 10pt; color: #554c60; }
  .sig { margin-top: 26px; }
  .sig .rule { border-top: 1px solid #33234a; width: 62mm; padding-top: 5px; }
  .sig .name { font-weight: bold; }
  .sig .office { color: #6b6076; font-size: 10pt; }
  .grade-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 8px; }
  .grade-table th, .grade-table td { border: 1px solid #e8dcc0; padding: 4px 7px; text-align: left; }
  .grade-table th { background: #faf6ee; font-size: 9pt; text-transform: uppercase; letter-spacing: .5px; }
  .foot { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e8dcc0; font-size: 9pt; color: #8a8194; text-align: center; }
  @media print { body { background: #fff; } .sheet { max-width: none; } }
</style>
</head>
<body>
<div class="sheet">

  <header class="letterhead">
    <img class="crest" src="${esc(SITE)}/images/site-icon.png" alt="">
    <div class="lockup">
      <h1 class="name">${esc(UNIVERSITY.name)}</h1>
      <p class="motto">${esc(UNIVERSITY.motto)}</p>
    </div>
    <div class="contact">
      ${esc(UNIVERSITY.address)}<br>
      ${esc(UNIVERSITY.phone)}<br>
      ${esc(ADMISSIONS_EMAIL)}<br>
      ${esc(UNIVERSITY.website)}
    </div>
  </header>
  <div class="rule-gold"></div>
  <p class="office-line">Office of Admissions</p>

  <div class="body">

    <div class="ref">
      <span>Ref: ${esc(input.applicationNumber)}</span>
      <span>${esc(issuedLong)}</span>
    </div>

    ${section(
      conditional ? 'Offer of conditional admission' : 'Offer of admission',
      `
      <p>Dear ${esc(input.fullName)},</p>

      <p>
        Following the assessment of your application, I am pleased to offer you
        ${conditional ? '<strong>conditional admission</strong>' : '<strong>admission</strong>'}
        to ${esc(UNIVERSITY.name)} for the programme set out below.
      </p>

      <table class="details">
        <tr><td class="k">Programme</td><td class="v">${esc(input.programme)}</td></tr>
        <tr><td class="k">Faculty</td><td class="v">${esc(input.faculty)}</td></tr>
        <tr><td class="k">Level</td><td class="v">${esc(input.level)}</td></tr>
        <tr><td class="k">Mode of study</td><td class="v">${esc(input.mode)}</td></tr>
        <tr><td class="k">Campus</td><td class="v">${esc(input.campus)}</td></tr>
        <tr><td class="k">Intake</td><td class="v">${esc(input.intake)}</td></tr>
        <tr><td class="k">Student number</td><td class="v">${esc(input.studentNumber)}</td></tr>
      </table>

      <p>
        Your student number is quoted above. Use it in every communication with the university,
        on every payment, and to sign in to the student portal. It identifies you for the whole of
        your studies and does not change.
      </p>
      `,
    )}

    ${conditional ? section(
      'Conditions of this offer',
      `
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
      </table>
      `,
    ) : `
    <section class="pkg-section">
      <h2>Conditions of this offer</h2>
      <p>This offer is unconditional. No further academic condition is attached to it.</p>
      <p>It remains subject to the general terms in the next section, and in particular to the
      accuracy of the information given in your application.</p>
    </section>`}

    ${section(
      `Terms of study — ${ownLabel}`,
      `
      <p>These are the terms that apply to you, as a student admitted for
      <strong>${esc(input.mode)}</strong> study.</p>
      ${list(ownTerms)}
      <h3>General terms, applying to every student</h3>
      ${list(COMMON_TERMS)}
      `,
      { pageBreak: true },
    )}

    ${section(
      `Terms for ${otherLabel}`,
      `
      <div class="muted-block">
        <strong>These do not apply to you at present.</strong> They are included because students
        do transfer between modes, and a student who moves should not discover afterwards that the
        rules changed underneath them. A transfer requires the written approval of the Registrar.
      </div>
      ${list(otherTerms)}
      `,
    )}

    ${section(
      'Fees and payment',
      `
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
      </div>
      `,
    )}

    ${section(
      'Academic regulations you are accepting',
      `
      <p>By registering you accept the university's academic regulations. The provisions you are
      most likely to need are set out here; the full regulations are published at
      <strong>${esc(UNIVERSITY.website)}/academic-regulations</strong>.</p>

      <h3>Grading and the pass mark</h3>
      <p>The pass mark is <strong>${esc(passMark)}</strong>. Grades are awarded on the following
      scale, and grade points run to ${classificationBands.length ? '4.00' : '4.00'}.</p>
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
      Registrar within fourteen days of being notified of it.</p>
      `,
      { pageBreak: true },
    )}

    ${section(
      'What to do next',
      `
      <ol class="terms">
        <li><strong>Sign in to the student portal</strong> at
          <strong>${esc(input.portalUrl)}</strong> using your student number
          ${input.temporaryPassword ? 'and the temporary password sent in the covering email' : 'and the password issued to you'}.
          Change your password immediately on first sign-in. Your password is personal to you and
          must not be shared with anyone, including university staff — no one at the university
          will ever ask you for it.</li>
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
        ${conditional ? '<li><strong>Meet the conditions above</strong> by the dates given.</li>' : ''}
      </ol>
      <p>If anything in this letter is wrong — your name, your programme, your campus or your mode
      of study — reply to the email that carried it <em>before</em> you register, and the Office of
      Admissions will correct it.</p>
      `,
    )}

    <div class="sig">
      <p>We look forward to welcoming you to ${esc(UNIVERSITY.name)}.</p>
      <p>Yours sincerely,</p>
      <div class="rule">
        <div class="name">${esc(input.headOfAdmissions)}</div>
        <div class="office">Head of Academic Affairs</div>
        <div class="office">${esc(UNIVERSITY.name)}</div>
      </div>
    </div>

    <div class="foot">
      This admission package was issued electronically on ${esc(issuedLong)} and is valid without a
      handwritten signature. Its authenticity may be confirmed with the Office of the Registrar at
      ${esc(ADMISSIONS_EMAIL)}, quoting ${esc(input.applicationNumber)} and
      ${esc(input.studentNumber)}.
    </div>

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

  Programme        ${input.programme}
  Faculty          ${input.faculty}
  Mode of study    ${input.mode}
  Campus           ${input.campus}
  Intake           ${input.intake}
  Student number   ${input.studentNumber}
${input.temporaryPassword ? `
  Portal           ${input.portalUrl}
  Username         ${input.studentNumber}
  Temporary password  ${input.temporaryPassword}

Please sign in and change your password immediately. Your password is personal to you and
must not be shared with anyone, including university staff.
` : ''}
Your full admission package is attached. It contains the admission letter, the conditions of
your offer, the terms of study for your mode and for the other, the fee arrangements, and the
academic regulations you are accepting by registering. Please read it before you register.
${conditional ? `
YOUR OFFER IS CONDITIONAL. The conditions and their dates are set out in the attached package.
You may register and begin study, but each condition remains on your record until it is met.
` : ''}
If anything in the package is wrong — your name, your programme, your campus or your mode of
study — reply to this email before you register and we will correct it.

We look forward to welcoming you.

${input.headOfAdmissions}
Head of Academic Affairs
${UNIVERSITY.name}
${UNIVERSITY.address}`;
}
