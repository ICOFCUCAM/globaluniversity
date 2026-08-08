// ---------------------------------------------------------------------------
// PRINTING A CREDENTIAL, AND EMAILING IT TO THE STUDENT.
//
// POST { credentialId, action: 'print' | 'email', to? }
//
//   "print credentials, generate digital PDFs and email the final credential
//    directly to the student."
//
// ---------------------------------------------------------------------------
// WHY THIS ROUTE EXISTS AT ALL, AND WHAT IT REPLACES
// ---------------------------------------------------------------------------
//
// The Credential Authority screen drew a Print button and an Email button with
// no handler on either. They rendered, they were clickable, and they did
// nothing — the exact fault this project criticises elsewhere in its own
// comments, shipped in the screen that most needs to be trustworthy. A Registrar
// would have pressed Email at a graduation, seen no error, and assumed the
// graduate had their certificate.
//
// ---------------------------------------------------------------------------
// WHY PRINTING GOES THROUGH THE SERVER RATHER THAN window.print()
// ---------------------------------------------------------------------------
//
// Because printing a sealed document is an auditable act. The University asked
// that "every sensitive credential action must be recorded in an immutable
// audit trail", and PRINT is on its own list of privileges. A browser print
// dialogue leaves no trace anywhere.
//
// So the server renders the document, writes the audit event, and returns the
// HTML for the browser to print. The audit entry is written BEFORE the document
// is returned: if the write fails, nothing is handed over, because a printed
// certificate the register has no record of is precisely the artefact this
// system exists to prevent.
//
// ---------------------------------------------------------------------------
// WHAT VERSION GETS PRINTED
// ---------------------------------------------------------------------------
//
// The one asked for, INCLUDING a superseded one, and it is marked. A registry
// is sometimes required to produce a document as it stood — that is what an
// archive is — and refusing would mean the University could not answer a
// question about its own history. But the print carries a superseded band, so a
// copy of version 1 can never be mistaken for the current award.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { send, mailConfigured } from '@/lib/mailer';
import { UNIVERSITY } from '@/lib/constants';
import { verificationQrSvg } from '@/lib/documentSecurity';
import { CATEGORY_PROFILES, type CredentialCategory } from '@/lib/credentialAuthority';

export const runtime = 'nodejs';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://iguc.net';

export async function POST(request: Request) {
  // PRINTING AND EMAILING ARE THE REGISTRAR'S WORK, not only the Authority's.
  // 'issue-credential' is the capability the Registrar already holds for this
  // register; requiring 'amend-issued-credential' would mean only the
  // Vice-Chancellor could hand a graduate their certificate.
  const g = await guard(request, 'issue-credential');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let input: { credentialId?: string; action?: 'print' | 'email'; to?: string };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const action = input.action ?? 'print';
  if (!input.credentialId) {
    return NextResponse.json({ ok: false, error: 'no-credential' }, { status: 400 });
  }

  const { data: credential, error } = await admin
    .from('credentials_issued')
    .select('*, credential_types(name, category, is_academic)')
    .eq('id', input.credentialId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: 'unreadable', detail: error.message }, { status: 500 });
  }
  if (!credential) {
    return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });
  }

  // A REVOKED CREDENTIAL IS NOT PRINTED OR SENT. Viewing and verifying it
  // remain possible — that is what a revoked record is for — but producing a
  // fresh copy of a document the University has withdrawn puts a usable
  // artefact back into the world.
  if (credential.status === 'revoked') {
    return NextResponse.json({
      ok: false,
      error: 'revoked',
      detail:
        'This credential has been revoked and cannot be printed or sent. The register still '
        + 'holds it, and /verify will report the revocation to anyone who asks.',
    }, { status: 409 });
  }

  const html = await renderCredential(credential);

  // -------------------------------------------------------------------------
  // PRINT
  // -------------------------------------------------------------------------
  if (action === 'print') {
    const { error: auditErr } = await admin.from('credential_audit_events').insert({
      credential_id: credential.id,
      credential_ref: credential.credential_id,
      action: 'printed',
      to_version: credential.version ?? 1,
      actor_id: caller.id,
      actor_role: caller.role,
      actor_email: caller.email,
      document_hash: credential.content_hash,
      detail: { superseded: credential.status === 'replaced' },
    });

    // BEFORE, NOT AFTER. See the header.
    if (auditErr) {
      return NextResponse.json({
        ok: false,
        error: 'not-audited',
        detail:
          `The print could not be recorded on the audit trail (${auditErr.message}), so the `
          + 'document has not been produced. A printed certificate with no record of who printed '
          + 'it is what the trail exists to prevent.',
      }, { status: 500 });
    }

    return NextResponse.json({ ok: true, html, message: 'Recorded on the audit trail.' });
  }

  // -------------------------------------------------------------------------
  // EMAIL
  // -------------------------------------------------------------------------
  let to = input.to?.trim();

  if (!to) {
    // FROM THE STUDENT RECORD, not from the request, whenever there is a
    // student record to read. A caller-supplied address on a route that
    // delivers a sealed credential is a way to have the University post
    // somebody's degree to a stranger.
    if (credential.student_id) {
      const { data: student } = await admin
        .from('students')
        .select('email')
        .eq('id', credential.student_id)
        .maybeSingle();
      to = student?.email ?? undefined;
    }
  }

  if (!to) {
    return NextResponse.json({
      ok: false,
      error: 'no-address',
      detail:
        'There is no email address on this student\'s record, and none was given. Add one to '
        + 'the student record rather than typing it here, so the next person does not have to.',
    }, { status: 422 });
  }

  if (!mailConfigured()) {
    return NextResponse.json({
      ok: false,
      error: 'mail-not-configured',
      detail:
        'Outbound mail is not set up on this deployment (SMTP_HOST, SMTP_USER, SMTP_PASS). '
        + 'Nothing has been sent. Print the credential and deliver it another way, or set the '
        + 'variables and try again.',
    }, { status: 503 });
  }

  const holder = credential.holder_name as string;
  const award = (credential.award as string | null) ?? (credential.kind as string);
  const verifyUrl = `${SITE}/verify?id=${encodeURIComponent(credential.credential_id)}`;

  const result = await send({
    to,
    office: 'Office of the Registrar',
    subject: `Your ${award} — ${UNIVERSITY.name} — ${credential.credential_id}`,
    text: coveringLetter({
      holder,
      award,
      reference: credential.credential_id,
      version: credential.version ?? 1,
      superseded: credential.status === 'replaced',
      verifyUrl,
    }),
    attachments: [
      {
        // A FILE THEY KEEP, not a message body. Mail clients rewrite HTML in
        // bodies — they strip backgrounds, resize images and inline their own
        // fonts — and a certificate that renders differently in every inbox is
        // not a document. As an attachment it opens in a browser and prints as
        // designed.
        filename: `${credential.credential_id}-v${credential.version ?? 1}.html`,
        content: html,
        contentType: 'text/html; charset=utf-8',
      },
    ],
  });

  if (!result.sent) {
    return NextResponse.json({
      ok: false,
      error: result.reason,
      detail: `${result.detail} The credential is unaffected and still stands on the register.`,
    }, { status: 502 });
  }

  await admin.from('credential_audit_events').insert({
    credential_id: credential.id,
    credential_ref: credential.credential_id,
    action: 'emailed',
    to_version: credential.version ?? 1,
    reason: `Sent to ${to}`,
    actor_id: caller.id,
    actor_role: caller.role,
    actor_email: caller.email,
    document_hash: credential.content_hash,
    detail: { to },
  });

  return NextResponse.json({
    ok: true,
    message: `Sent to ${to} and recorded on the audit trail.`,
  });
}

// ---------------------------------------------------------------------------

interface LetterInput {
  holder: string;
  award: string;
  reference: string;
  version: number;
  superseded: boolean;
  verifyUrl: string;
}

/**
 * What the graduate reads in the message itself.
 *
 * IT EXPLAINS THE VERSION NUMBER IF THERE IS ONE. A graduate who receives
 * "version 2" with no explanation assumes something went wrong and worries
 * about it. One sentence saying the University corrected its own record, and
 * that the earlier copy is superseded, is the difference between a correction
 * and an alarm.
 */
function coveringLetter(i: LetterInput): string {
  const lines = [
    `Dear ${i.holder},`,
    '',
    `Your ${i.award} is attached.`,
    '',
    `Credential number: ${i.reference}`,
  ];

  if (i.version > 1) {
    lines.push(
      '',
      `This is version ${i.version} of your credential. The University corrected its record, and `
      + 'this copy supersedes the one issued previously. Your award itself is unchanged and '
      + 'unaffected; if you have given the earlier copy to anyone, you may wish to send them this '
      + 'one instead.',
    );
  }

  if (i.superseded) {
    lines.push(
      '',
      'Please note: this is an archived copy of a superseded version, produced for your records. '
      + 'It is not the current version of your credential.',
    );
  }

  lines.push(
    '',
    'Anyone can confirm this credential is genuine, without contacting the University, at:',
    i.verifyUrl,
    '',
    'Open the attachment in a web browser to view or print it.',
    '',
    'Office of the Registrar',
    UNIVERSITY.name,
  );

  return lines.join('\n');
}

/**
 * The document itself, as a standalone printable page.
 *
 * SELF-CONTAINED ON PURPOSE. No stylesheet link, no font from a CDN, no image
 * from the site. This file is emailed, saved to a desktop, forwarded, and
 * opened years later on a machine with no network — and a certificate that
 * needs the internet to look like a certificate is not a document.
 */
async function renderCredential(c: Record<string, any>): Promise<string> {
  const verifyUrl = `${SITE}/verify?id=${encodeURIComponent(c.credential_id)}`;
  const qr = await verificationQrSvg(verifyUrl, 104).catch(() => '');

  const type = c.credential_types as { name?: string; category?: string } | null;
  const category = (type?.category ?? 'academic') as CredentialCategory;
  const standing = CATEGORY_PROFILES[category]?.standing ?? '';

  const issued = new Date(c.issued_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const e = (s: unknown) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // A TRANSCRIPT IS NOT A CERTIFICATE AND MUST NOT BE PRINTED AS ONE.
  //
  // This function rendered a landscape certificate for every `kind` on the
  // register. Once transcripts could be issued, that meant the University
  // would email a transcript that said "has been admitted to the degree of"
  // over a document with no marks on it — a sealed, verifiable statement of
  // something the record does not say. Portrait, tabular, and it lists the
  // courses.
  if (c.kind === 'transcript') return renderTranscript(c, qr, issued, e);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${e(c.credential_id)} — ${e(UNIVERSITY.name)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #241a30;
         background: #efece4; display: flex; justify-content: center; padding: 24px; }
  .sheet { width: 297mm; min-height: 210mm; background: #fdfcf8; padding: 18mm 20mm;
           position: relative; box-shadow: 0 2px 24px rgba(0,0,0,.14); }
  @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; } }
  .rule { border: 1.5px solid #b99a3e; padding: 12mm 14mm; min-height: 174mm;
          display: flex; flex-direction: column; }
  .crest { text-align: center; letter-spacing: .22em; text-transform: uppercase;
           font-size: 10pt; color: #6b6076; }
  h1 { font-size: 26pt; text-align: center; margin: 6mm 0 2mm; font-weight: 400;
       letter-spacing: .04em; }
  .sub { text-align: center; font-size: 10.5pt; color: #6b6076; font-style: italic; }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center;
          text-align: center; }
  .lead { font-size: 12pt; color: #4a4256; }
  .name { font-size: 30pt; margin: 4mm 0; letter-spacing: .02em; }
  .award { font-size: 18pt; margin: 3mm 0 1mm; }
  .class { font-size: 12pt; color: #4a4256; font-style: italic; }
  .foot { display: flex; justify-content: space-between; align-items: flex-end;
          gap: 10mm; margin-top: 8mm; font-size: 9pt; color: #6b6076; }
  .sig { border-top: .8pt solid #241a30; padding-top: 2mm; min-width: 55mm;
         text-align: center; }
  .meta { text-align: center; }
  .meta code { font-family: ui-monospace, Menlo, monospace; font-size: 8.5pt; }
  /* THE SUPERSEDED BAND. Loud on purpose — an archived copy that looks like a
     current one is worse than no copy at all. */
  .superseded { position: absolute; inset: 0; display: flex; align-items: center;
                justify-content: center; pointer-events: none; }
  .superseded span { font-size: 46pt; color: rgba(160,40,40,.16); font-weight: bold;
                     transform: rotate(-24deg); letter-spacing: .12em; }
  .standing { text-align: center; font-size: 8.5pt; color: #6b6076; margin-top: 4mm; }
</style></head>
<body><div class="sheet">
  ${c.status === 'replaced' ? '<div class="superseded"><span>SUPERSEDED</span></div>' : ''}
  <div class="rule">
    <div class="crest">${e(UNIVERSITY.name)}</div>
    <h1>${e(type?.name ?? 'Certificate')}</h1>
    <div class="sub">Given under the seal of the University</div>

    <div class="body">
      <p class="lead">This is to certify that</p>
      <p class="name">${e(c.holder_name)}</p>
      <p class="lead">has been admitted to the degree of</p>
      <p class="award">${e(c.award ?? type?.name ?? '')}</p>
      ${c.classification ? `<p class="class">${e(c.classification)}</p>` : ''}
      ${c.programme ? `<p class="lead">in ${e(c.programme)}</p>` : ''}
      <p class="lead" style="margin-top:5mm">Given on ${e(issued)}</p>
      ${standing ? `<p class="standing">${e(standing)}</p>` : ''}
    </div>

    <div class="foot">
      <div class="sig">Vice-Chancellor</div>
      <div class="meta">
        ${qr}
        <div><code>${e(c.credential_id)}</code></div>
        <div>Version ${e(c.version ?? 1)} · verify at ${e(SITE.replace(/^https?:\/\//, ''))}/verify</div>
      </div>
      <div class="sig">Registrar</div>
    </div>
  </div>
</div></body></html>`;
}


/**
 * The transcript, as it is emailed and printed.
 *
 * BUILT FROM THE SNAPSHOT SEALED AT ISSUE — `facts.years` — and never from the
 * live marks. That is the point of sealing it: a transcript reissued in 2031
 * must show what the University said in 2026, not what the database says now.
 * Reading the current results here would make every archived transcript change
 * silently whenever a mark was corrected.
 */
function renderTranscript(
  c: Record<string, any>,
  qr: string,
  issued: string,
  e: (s: unknown) => string,
): string {
  const facts = (c.facts ?? {}) as Record<string, any>;
  const years = Array.isArray(facts.years) ? facts.years : [];

  const rows = years.map((y: any) => (y.semesters ?? []).map((s: any) => `
    <tr class="sem"><td colspan="5">Year ${e(y.year || '—')} · Semester ${e(s.semester || '—')}</td></tr>
    ${(s.courses ?? []).map((k: any) => `
      <tr>
        <td><code>${e(k.code)}</code></td>
        <td>${e(k.title)}</td>
        <td class="n">${e(k.creditUnit)}</td>
        <td class="n">${e(k.grade)}</td>
        <td class="n">${e(Number(k.qualityPoint ?? 0).toFixed(2))}</td>
      </tr>`).join('')}
    <tr class="sub"><td colspan="2">Semester total</td>
      <td class="n">${e(s.totalCredits)}</td><td></td>
      <td class="n">GPA ${e(Number(s.gpa ?? 0).toFixed(2))}</td></tr>
  `).join('')).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${e(c.credential_id)} — Academic Transcript</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #241a30;
         background: #efece4; display: flex; justify-content: center; padding: 20px; }
  .sheet { width: 210mm; min-height: 297mm; background: #fdfcf8; padding: 16mm;
           position: relative; box-shadow: 0 2px 24px rgba(0,0,0,.14); }
  @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; } }
  h1 { font-size: 17pt; text-align: center; margin: 0 0 1mm; letter-spacing: .06em;
       text-transform: uppercase; }
  .crest { text-align: center; letter-spacing: .2em; text-transform: uppercase;
           font-size: 9pt; color: #6b6076; }
  .who { margin: 6mm 0; font-size: 10pt; display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 6mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th, td { padding: 1.6mm 2mm; border-bottom: .4pt solid #ddd6c6; text-align: left; }
  th { font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; color: #6b6076; }
  td.n, th.n { text-align: right; }
  tr.sem td { background: #f2eee6; font-weight: bold; font-size: 8.5pt;
              text-transform: uppercase; letter-spacing: .06em; }
  tr.sub td { font-style: italic; color: #4a4256; }
  .totals { margin-top: 6mm; display: flex; justify-content: space-between;
            border-top: 1.2pt solid #b99a3e; padding-top: 3mm; font-size: 10pt; }
  .foot { margin-top: 8mm; display: flex; justify-content: space-between;
          align-items: flex-end; gap: 8mm; font-size: 8.5pt; color: #6b6076; }
  .sig { border-top: .8pt solid #241a30; padding-top: 2mm; min-width: 50mm; text-align: center; }
  code { font-family: ui-monospace, Menlo, monospace; }
  .superseded { position: absolute; inset: 0; display: flex; align-items: center;
                justify-content: center; pointer-events: none; }
  .superseded span { font-size: 44pt; color: rgba(160,40,40,.16); font-weight: bold;
                     transform: rotate(-24deg); letter-spacing: .12em; }
  .none { text-align: center; font-style: italic; color: #6b6076; padding: 10mm 0; }
</style></head>
<body><div class="sheet">
  ${c.status === 'replaced' ? '<div class="superseded"><span>SUPERSEDED</span></div>' : ''}
  <div class="crest">${e(UNIVERSITY.name)}</div>
  <h1>Academic Transcript of Records</h1>

  <div class="who">
    <div><strong>${e(c.holder_name)}</strong></div>
    <div>Student number: <code>${e(c.student_number ?? '—')}</code></div>
    <div>Programme: ${e(c.programme ?? '—')}</div>
    <div>Issued: ${e(issued)}</div>
  </div>

  <table>
    <thead><tr>
      <th>Code</th><th>Course</th><th class="n">Credits</th>
      <th class="n">Grade</th><th class="n">Quality pts</th>
    </tr></thead>
    <tbody>
      ${rows || '<tr><td colspan="5" class="none">No courses were recorded on this transcript.</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div>Credits attempted: <strong>${e(facts.credits_attempted ?? '—')}</strong></div>
    <div>Credits earned: <strong>${e(facts.credits_earned ?? '—')}</strong></div>
    <div>CGPA: <strong>${e(Number(facts.cgpa ?? 0).toFixed(2))}</strong></div>
    <div>${e(c.classification ?? '')}</div>
  </div>

  <div class="foot">
    <div class="sig">Registrar</div>
    <div style="text-align:center">
      ${qr}
      <div><code>${e(c.credential_id)}</code></div>
      <div>Version ${e(c.version ?? 1)} · verify at ${e(SITE.replace(/^https?:\/\//, ''))}/verify</div>
    </div>
    <div class="sig">Vice-Chancellor</div>
  </div>
</div></body></html>`;
}
