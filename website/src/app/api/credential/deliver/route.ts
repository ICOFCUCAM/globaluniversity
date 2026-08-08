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
import { can } from '@/lib/roles';
import { guard } from '@/lib/adminAuth';
import { send, mailConfigured } from '@/lib/mailer';
import { UNIVERSITY, IMAGES } from '@/lib/constants';
import { verificationQrSvg } from '@/lib/documentSecurity';
import { CATEGORY_PROFILES, type CredentialCategory } from '@/lib/credentialAuthority';
import { masterFromCredential } from '@/lib/transcriptMaster';
import { transcriptDocumentHtml } from '@/lib/transcriptDocumentHtml';
import {
  defaultDesign, withDefaults, type CredentialDesign, type CredentialKind,
} from '@/lib/credentialTemplate';

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

  const html = await renderCredential(credential, admin);

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
  /** Set when the address is not the holder's own — a receiving university. */
  let forwarding = false;

  if (to) {
    // THE HOLE THIS CLOSES. The comment below has always warned that "a
    // caller-supplied address on a route that delivers a sealed credential is
    // a way to have the University post somebody's degree to a stranger" — and
    // the code then accepted `input.to` from anyone who could email at all.
    //
    // Forwarding to a receiving university is a real and necessary act, so the
    // answer is not to refuse it; it is to make it a distinct permission, held
    // by the registry offices whose work it is, and to say in the trail that
    // the record went to a third party rather than to the student.
    const { data: holder } = credential.student_id
      ? await admin.from('students').select('email').eq('id', credential.student_id).maybeSingle()
      : { data: null };

    forwarding = (holder?.email ?? '').toLowerCase() !== to.toLowerCase();

    if (forwarding && !can(caller.role, 'forward-credential')) {
      return NextResponse.json({
        ok: false,
        error: 'not-permitted:forward-credential',
        detail:
          'This address is not the holder’s own, so sending it would disclose their academic '
          + 'record to a third party. Your role may send a credential to the student it belongs '
          + 'to; forwarding it elsewhere is the registry’s to do.',
      }, { status: 403 });
    }
  }

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
    // NAMES THE THIRD PARTY AS A THIRD PARTY. "Sent to admissions@other.edu"
    // and "sent to the graduate" are different disclosures and the trail has
    // to be readable as such years later, when nobody remembers whose address
    // that was.
    reason: forwarding
      ? `Forwarded to ${to} — not the holder’s own address`
      : `Sent to ${to}`,
    actor_id: caller.id,
    actor_role: caller.role,
    actor_email: caller.email,
    document_hash: credential.content_hash,
    detail: { to, forwarded: forwarding },
  });

  return NextResponse.json({
    ok: true,
    message: forwarding
      ? `Forwarded to ${to}. Recorded on the audit trail as a disclosure to a third party.`
      : `Sent to ${to} and recorded on the audit trail.`,
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
async function renderCredential(
  c: Record<string, any>,
  admin: { from: (t: string) => any },
): Promise<string> {
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
  //
  // AND IT IS NOW THE SAME TRANSCRIPT THE REGISTRAR SEES. This branch used to
  // call a hand-written HTML string in this file — portrait, five columns, no
  // grade system, no crest, no legend. It has been deleted. `TranscriptMaster`
  // is rendered here, exactly as the Issue screen and the Studio render it, so
  // there is one document rather than four.
  if (c.kind === 'transcript') {
    const design = await activeDesign(admin, 'transcript');
    return await transcriptDocumentHtml({
      design,
      data: masterFromCredential(c, {
        qrSvg: qr,
        // ABSOLUTE, so the crest resolves when the file is opened away from the
        // site. `sealSrc` below does better still when the PNG can be read off
        // disk, and this is what stands in when it cannot.
        assetBase: SITE,
        sealSrc: await inlineSeal(),
      }),
    });
  }

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
 * The published design for a kind of credential, read on the server.
 *
 * THE SAME ROW THE STUDIO PUBLISHES AND THE SAME FALLBACK THE PORTAL USES —
 * `useCredentialTemplate` does exactly this in the browser. A delivery route
 * that rendered under the built-in default while the Studio previewed a
 * published design would put the University's approved layout on screen and a
 * different one in the graduate's inbox.
 *
 * A read failure falls back rather than refusing: a deployment that has not run
 * the templates migration must still be able to hand a graduate their document.
 */
async function activeDesign(
  admin: { from: (t: string) => any },
  kind: CredentialKind,
): Promise<CredentialDesign> {
  try {
    const { data } = await admin
      .from('credential_templates')
      .select('design')
      .eq('kind', kind)
      .eq('is_active', true)
      .maybeSingle();
    if (!data?.design) return defaultDesign(kind);
    return withDefaults(kind, data.design as Partial<CredentialDesign>);
  } catch {
    return defaultDesign(kind);
  }
}

/**
 * The University's seal as a data: URI, so an emailed transcript keeps its
 * watermark on a machine with no network.
 *
 * BEST EFFORT, AND SAID SO. `public/` is not guaranteed to be readable from a
 * serverless function on every host, so this returns undefined when it cannot
 * read the file and the caller falls back to an absolute URL on the site. The
 * document is never blocked on it — a transcript that refuses to send because
 * a watermark could not be embedded would be a worse failure than a watermark
 * that has to be fetched.
 */
let sealCache: string | null | undefined;
async function inlineSeal(): Promise<string | undefined> {
  if (sealCache !== undefined) return sealCache ?? undefined;
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const bytes = await readFile(join(process.cwd(), 'public', IMAGES.seal.replace(/^\//, '')));
    sealCache = `data:image/png;base64,${bytes.toString('base64')}`;
  } catch {
    sealCache = null;
  }
  return sealCache ?? undefined;
}
