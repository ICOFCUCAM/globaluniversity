'use client';

import { useState } from 'react';

const LEVELS = [
  'Doctor of Philosophy',
  'Doctor of Theology',
  'Master of Arts',
  'Bachelor of Science',
  'Diploma',
  'Certificate',
];

const FIELDS: Record<string, string[]> = {
  Theology: ['Divinity', 'Ministry', 'Theology'],
  Education: ['Primary Education', 'Special Education'],
  Engineering: ['Software Engineering', 'Networking'],
  Business: ['Business Management', 'Project Management'],
};

const inputCls =
  'w-full rounded-lg border border-brand-sand bg-white px-4 py-2.5 text-sm text-brand-purple placeholder:text-brand-muted/60 focus:border-brand-gold-deep focus:outline-none';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-brand-purple';
const legendCls = 'font-heading text-lg font-bold text-brand-purple';

function Field({
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className={labelCls}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <input type={type} name={name} required={required} placeholder={placeholder} className={inputCls} />
    </label>
  );
}

export default function ApplyForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'unconfigured'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/apply', { method: 'POST', body: new FormData(e.currentTarget) });
      if (res.ok) setStatus('sent');
      else if (res.status === 503) setStatus('unconfigured');
      else setStatus('error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-brand-sand bg-white p-10 text-center shadow-sm">
        <p className="text-4xl">🎓</p>
        <h2 className="mt-4 font-heading text-2xl font-bold text-brand-purple">Application received!</h2>
        <p className="mx-auto mt-3 max-w-md text-brand-muted">
          Thank you for applying to ICOF Global University. Our admissions office will review your
          application and contact you by email or phone.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      {/* Personal information */}
      <fieldset className="space-y-4 rounded-xl border border-brand-sand bg-white p-6 shadow-sm">
        <legend className={legendCls}>Personal Information</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Surname" name="surname" required />
          <Field label="First name" name="firstname" required />
          <Field label="Middle name" name="middlename" />
          <Field label="Maiden name (if applicable)" name="maidenname" />
          <Field label="ID / Passport number" name="id_number" />
          <Field label="Place of issue" name="place_issue" />
          <Field label="Date of issue" name="date_issue" type="date" />
          <Field label="Date of birth" name="dob" type="date" required />
        </div>
        <div className="flex flex-wrap items-center gap-6 pt-1">
          <span className={labelCls}>Gender *</span>
          {['Male', 'Female'].map((g) => (
            <label key={g} className="flex items-center gap-2 text-sm text-brand-purple">
              <input type="radio" name="gender" value={g} required /> {g}
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nationality" name="nationality" required />
          <Field label="Tribe" name="tribe" />
        </div>
        {/* Honeypot — hidden from real users */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      </fieldset>

      {/* Contact */}
      <fieldset className="space-y-4 rounded-xl border border-brand-sand bg-white p-6 shadow-sm">
        <legend className={legendCls}>Contact</legend>
        <label className="block space-y-1.5">
          <span className={labelCls}>Address *</span>
          <textarea name="address" required rows={2} className={inputCls} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone (mobile)" name="phone_mobile" type="tel" required />
          <Field label="Phone (work)" name="phone_work" type="tel" />
          <Field label="Email" name="email" type="email" required />
        </div>
      </fieldset>

      {/* Emergency contact */}
      <fieldset className="space-y-4 rounded-xl border border-brand-sand bg-white p-6 shadow-sm">
        <legend className={legendCls}>Emergency Contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="em_name" required />
          <Field label="Mobile" name="em_mobile" type="tel" required />
        </div>
        <label className="block space-y-1.5">
          <span className={labelCls}>Address</span>
          <textarea name="em_address" rows={2} className={inputCls} />
        </label>
      </fieldset>

      {/* Education history */}
      <fieldset className="space-y-4 rounded-xl border border-brand-sand bg-white p-6 shadow-sm">
        <legend className={legendCls}>Education History</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Secondary education level" name="sec_level" placeholder="e.g. GCE A-Level" />
          <Field label="Year completed" name="sec_year" type="number" />
          <Field label="School" name="sec_school" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-deep">Post-secondary (if any)</p>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Institution 1" name="post_inst1" />
          <Field label="Qualification" name="post_qual1" />
          <Field label="Year" name="post_year1" type="number" />
          <Field label="Field of study" name="post_field1" />
          <Field label="Institution 2" name="post_inst2" />
          <Field label="Qualification" name="post_qual2" />
          <Field label="Year" name="post_year2" type="number" />
          <Field label="Field of study" name="post_field2" />
        </div>
      </fieldset>

      {/* Program */}
      <fieldset className="space-y-4 rounded-xl border border-brand-sand bg-white p-6 shadow-sm">
        <legend className={legendCls}>Program</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={labelCls}>Level *</span>
            <select name="level" required className={inputCls} defaultValue="">
              <option value="" disabled>
                Select level
              </option>
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className={labelCls}>Field *</span>
            <select name="field" required className={inputCls} defaultValue="">
              <option value="" disabled>
                Select field
              </option>
              {Object.entries(FIELDS).map(([group, options]) => (
                <optgroup key={group} label={group}>
                  {options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </optgroup>
              ))}
              <option>Other</option>
            </select>
          </label>
        </div>
        <Field label="Other / specialization" name="field_other" />
        <div className="flex flex-wrap items-center gap-6 pt-1">
          <span className={labelCls}>Mode of study *</span>
          {['Full Time', 'Part Time', 'ODL'].map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm text-brand-purple">
              <input type="radio" name="mode" value={m} required /> {m}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Uploads */}
      <fieldset className="space-y-4 rounded-xl border border-brand-sand bg-white p-6 shadow-sm">
        <legend className={legendCls}>Uploads</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={labelCls}>Passport photo</span>
            <input type="file" name="filePhoto" accept=".pdf,.jpg,.jpeg,.png" className={inputCls} />
          </label>
          <label className="block space-y-1.5">
            <span className={labelCls}>ID / certificates</span>
            <input type="file" name="fileID" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.zip" className={inputCls} />
          </label>
        </div>
        <p className="text-xs text-brand-muted">
          Accepted: PDF/JPG/PNG/DOC/DOCX/ZIP · max 4&nbsp;MB total. Larger documents can be emailed to
          admission@iguc.net after you submit.
        </p>
      </fieldset>

      {(status === 'error' || status === 'unconfigured') && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {status === 'unconfigured'
            ? 'Online submission is being set up. Please use our application portal instead: '
            : 'Something went wrong sending your application. Please try again, or use our application portal: '}
          <a href="https://iguc.net/forms/" className="font-semibold underline">
            iguc.net/forms
          </a>{' '}
          — or email <a href="mailto:admission@iguc.net" className="font-semibold underline">admission@iguc.net</a>.
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-full bg-brand-gold px-8 py-4 font-heading text-lg font-bold text-brand-purple transition hover:bg-brand-gold-deep disabled:opacity-60 sm:w-auto"
      >
        {status === 'sending' ? 'Submitting…' : '🎓 Submit Application'}
      </button>
    </form>
  );
}
