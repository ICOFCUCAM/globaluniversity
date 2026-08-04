import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

// Field labels in the order they should appear in the admissions email —
// mirrors the legacy forms/send_form.php layout.
const FIELDS: Array<[string, string]> = [
  ['firstname', 'First name'],
  ['middlename', 'Middle name'],
  ['surname', 'Last name'],
  ['maidenname', 'Maiden name'],
  ['gender', 'Gender'],
  ['dob', 'Date of birth'],
  ['address_line1', 'Address line 1'],
  ['address_line2', 'Address line 2'],
  ['city', 'City'],
  ['state', 'State / Province / Region'],
  ['postal', 'Postal code'],
  ['country', 'Country'],
  ['email', 'Email'],
  ['phone_mobile', 'Phone'],
  ['religion', 'Religion'],
  ['birth_place', 'City and country of birth'],
  ['citizenship', 'Nation of citizenship'],
  ['native_language', 'Native language'],
  ['id_number', 'ID / Passport number'],
  ['place_issue', 'Place of issue'],
  ['marital_status', 'Marital status'],
  ['spouse_name', 'Name of spouse'],
  ['spouse_email', 'Email of spouse'],
  ['spouse_phone', 'Phone of spouse'],
  ['em_name', 'Emergency contact name'],
  ['em_mobile', 'Emergency contact phone'],
  ['em_relationship', 'Relationship to applicant'],
  ['sec_level', 'Secondary education level'],
  ['sec_year', 'Secondary year'],
  ['sec_school', 'Secondary school'],
  ['post_inst1', 'Institution 1'],
  ['post_qual1', 'Certification type 1'],
  ['post_year1', 'Graduation date 1'],
  ['post_inst2', 'Institution 2'],
  ['post_qual2', 'Certification type 2'],
  ['post_year2', 'Graduation date 2'],
  ['extracurricular', 'Extracurricular activities'],
  ['talents', 'Talents and awards'],
  ['community_service', 'Community service work'],
  ['employment', 'Employment'],
  ['level', 'Enrollment for'],
  ['field', 'Specific field / program'],
  ['planned_major', 'Planned major'],
  ['field_other', 'Other / specialization'],
  ['campus', 'Campus'],
  ['start_when', 'Intended start of studies'],
  ['mode', 'Mode of study'],
  ['financing', 'Financing'],
  ['financing_explain', 'Financing details'],
  ['illness', 'Serious illness'],
  ['illness_desc', 'Illness details'],
  ['obligations', 'Family / work obligations'],
  ['ref1_name', 'Reference 1 name'],
  ['ref1_phone', 'Reference 1 phone'],
  ['ref2_name', 'Reference 2 name'],
  ['ref2_phone', 'Reference 2 phone'],
  ['agree', 'Agreed to declaration'],
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
