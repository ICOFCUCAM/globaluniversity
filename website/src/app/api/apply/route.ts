import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { supabase } from '@/lib/supabase';

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
  ['mode', 'Where the applicant will study'],
  ['attendance', 'Attendance (full or part time)'],
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

/**
 * Record the application in the portal database as a student row with
 * status "applicant", so admissions staff review it in Student Management
 * and promote it to "active" on approval.
 */
async function recordApplicant(form: FormData, appNo: string): Promise<boolean> {
  const year = new Date().getFullYear();
  const get = (k: string) => String(form.get(k) ?? '').trim() || null;
  const summary = FIELDS.map(([name, label]) => `${label}: ${get(name) ?? '—'}`).join('\n');
  const { error } = await supabase.from('students').insert({
    matric_no: appNo,
    first_name: get('firstname') ?? '',
    last_name: get('surname') ?? '',
    middle_name: get('middlename'),
    email: get('email'),
    phone: get('phone_mobile'),
    date_of_birth: get('dob'),
    gender: get('gender'),
    nationality: get('citizenship') ?? get('country') ?? 'Cameroonian',
    state_of_origin: get('birth_place'),
    address: [get('address_line1'), get('city'), get('country'), '', '--- FULL APPLICATION ---', summary]
      .filter((x) => x !== null)
      .join('\n'),
    program: get('planned_major') ?? get('field') ?? '',
    degree_type: get('level') ?? '',
    admission_year: year,
    // Stored as columns, not only inside the free-text summary. The admission
    // letter, the fee band and the terms of study all depend on these, and
    // reading them out of a paragraph is not something a letter can do.
    mode: get('mode'),
    attendance: get('attendance'),
    campus: get('campus'),
    intake: get('start_when'),
    faculty: get('field'),
    status: 'applicant',
  });
  return !error;
}

export async function POST(request: Request) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, APPLY_TO, MAIL_FROM } = process.env;

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

  const appNo = `APP-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // Channel 1 — admissions pipeline: store the application in the portal DB.
  const stored = await recordApplicant(form, appNo).catch(() => false);

  // Channel 2 — email to the admissions office (when SMTP is configured).
  let emailed = false;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 465),
      secure: Number(SMTP_PORT ?? 465) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    try {
      await transporter.sendMail({
        from: `"IGUC Online Application" <${MAIL_FROM || SMTP_USER}>`,
        to: APPLY_TO ?? 'admissions@iguc.net',
        replyTo: applicantEmail,
        subject: `New application ${appNo}: ${surname} ${firstname} — ${String(form.get('level') ?? '')} ${String(form.get('field') ?? '')}`,
        text: `A new application was submitted on iguc.net.\n\n${lines.join('\n')}\n`,
        attachments,
      });
      emailed = true;
    } catch {
      emailed = false;
    }
  }

  // The application succeeds if at least one channel captured it.
  if (stored || emailed) {
    return NextResponse.json({ ok: true, stored, emailed, appNo });
  }
  return NextResponse.json({ ok: false, error: 'not-captured' }, { status: 502 });
}
