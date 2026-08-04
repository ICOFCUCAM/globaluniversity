import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

// Field labels in the order they should appear in the admissions email —
// mirrors the legacy forms/send_form.php layout.
const FIELDS: Array<[string, string]> = [
  ['surname', 'Surname'],
  ['firstname', 'First name'],
  ['middlename', 'Middle name'],
  ['maidenname', 'Maiden name'],
  ['id_number', 'ID / Passport number'],
  ['place_issue', 'Place of issue'],
  ['date_issue', 'Date of issue'],
  ['dob', 'Date of birth'],
  ['gender', 'Gender'],
  ['nationality', 'Nationality'],
  ['tribe', 'Tribe'],
  ['address', 'Address'],
  ['phone_work', 'Phone (work)'],
  ['phone_mobile', 'Phone (mobile)'],
  ['email', 'Email'],
  ['em_name', 'Emergency contact name'],
  ['em_address', 'Emergency contact address'],
  ['em_mobile', 'Emergency contact mobile'],
  ['sec_level', 'Secondary education level'],
  ['sec_year', 'Secondary year'],
  ['sec_school', 'Secondary school'],
  ['post_inst1', 'Post-secondary institution 1'],
  ['post_qual1', 'Qualification 1'],
  ['post_year1', 'Year 1'],
  ['post_field1', 'Field of study 1'],
  ['post_inst2', 'Post-secondary institution 2'],
  ['post_qual2', 'Qualification 2'],
  ['post_year2', 'Year 2'],
  ['post_field2', 'Field of study 2'],
  ['level', 'Program level'],
  ['field', 'Field'],
  ['field_other', 'Other / specialization'],
  ['mode', 'Mode of study'],
];

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // Vercel request body limit is ~4.5MB

export async function POST(request: Request) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, APPLY_TO } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return NextResponse.json(
      { ok: false, error: 'email-not-configured' },
      { status: 503 },
    );
  }

  const form = await request.formData();

  const surname = String(form.get('surname') ?? '').trim();
  const firstname = String(form.get('firstname') ?? '').trim();
  const applicantEmail = String(form.get('email') ?? '').trim();
  if (!surname || !firstname || !applicantEmail) {
    return NextResponse.json({ ok: false, error: 'missing-required-fields' }, { status: 400 });
  }
  // Honeypot field — real users never fill this.
  if (String(form.get('website') ?? '') !== '') {
    return NextResponse.json({ ok: true });
  }

  const lines = FIELDS.map(([name, label]) => {
    const value = String(form.get(name) ?? '').trim();
    return `${label}: ${value || '—'}`;
  });

  const attachments: { filename: string; content: Buffer }[] = [];
  let totalBytes = 0;
  for (const key of ['filePhoto', 'fileID']) {
    const file = form.get(key);
    if (file instanceof File && file.size > 0) {
      totalBytes += file.size;
      if (totalBytes > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json({ ok: false, error: 'attachments-too-large' }, { status: 413 });
      }
      attachments.push({
        filename: `${key}-${file.name}`.replace(/[^\w.\-]/g, '_'),
        content: Buffer.from(await file.arrayBuffer()),
      });
    }
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 465),
    secure: Number(SMTP_PORT ?? 465) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: `"IGUC Online Application" <${SMTP_USER}>`,
      to: APPLY_TO ?? 'admission@iguc.net',
      replyTo: applicantEmail,
      subject: `New application: ${surname} ${firstname} — ${String(form.get('level') ?? '')} ${String(form.get('field') ?? '')}`,
      text: `A new application was submitted on iguc.net.\n\n${lines.join('\n')}\n`,
      attachments,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'send-failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
