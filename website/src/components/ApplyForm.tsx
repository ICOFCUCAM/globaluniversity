'use client';

import { useRef, useState } from 'react';

// Six steps, matching the original iguc.net application wizard:
// Personal → Academic → Program → Uploads → Review → Declaration
const STEPS = ['Personal', 'Academic', 'Program', 'Uploads', 'Review', 'Declaration'];

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
const groupCls = 'font-heading text-base font-bold text-brand-purple';

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

function Area({ label, name, rows = 2, required = false }: { label: string; name: string; rows?: number; required?: boolean }) {
  return (
    <label className="block space-y-1.5">
      <span className={labelCls}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <textarea name={name} rows={rows} required={required} className={inputCls} />
    </label>
  );
}

function Radios({ label, name, options, required = false }: { label: string; name: string; options: string[]; required?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <span className={labelCls}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2 text-sm text-brand-purple">
          <input type="radio" name={name} value={o} required={required} /> {o}
        </label>
      ))}
    </div>
  );
}

// Labels for the review step, in display order.
const REVIEW_LABELS: Array<[string, string]> = [
  ['firstname', 'First name'], ['middlename', 'Middle name'], ['surname', 'Last name'],
  ['gender', 'Gender'], ['dob', 'Date of birth'], ['email', 'Email'], ['phone_mobile', 'Phone'],
  ['address_line1', 'Address'], ['city', 'City'], ['state', 'State/Region'], ['country', 'Country'],
  ['religion', 'Religion'], ['birth_place', 'City & country of birth'], ['citizenship', 'Nation of citizenship'],
  ['native_language', 'Native language'], ['marital_status', 'Marital status'], ['spouse_name', 'Spouse'],
  ['em_name', 'Emergency contact'], ['em_mobile', 'Emergency phone'],
  ['sec_school', 'Secondary school'], ['sec_level', 'Secondary level'], ['sec_year', 'Secondary year'],
  ['post_inst1', 'Institution 1'], ['post_qual1', 'Certification 1'], ['post_year1', 'Graduation year 1'],
  ['post_inst2', 'Institution 2'], ['post_qual2', 'Certification 2'], ['post_year2', 'Graduation year 2'],
  ['extracurricular', 'Extracurricular activities'], ['talents', 'Talents and awards'],
  ['community_service', 'Community service'], ['employment', 'Employment'],
  ['level', 'Level'], ['field', 'Field'], ['field_other', 'Specialization'], ['planned_major', 'Planned major'],
  ['campus', 'Campus'], ['mode', 'Mode of study'], ['start_when', 'Intended start'],
  ['financing', 'Financing'], ['financing_explain', 'Financing details'],
  ['illness', 'Serious illness'], ['illness_desc', 'Illness details'],
  ['ref1_name', 'Reference 1'], ['ref1_phone', 'Reference 1 phone'],
  ['ref2_name', 'Reference 2'], ['ref2_phone', 'Reference 2 phone'],
];

export default function ApplyForm() {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'unconfigured'>('idle');
  const [review, setReview] = useState<Array<[string, string]>>([]);
  const formRef = useRef<HTMLFormElement>(null);

  function validateVisible(): boolean {
    const form = formRef.current;
    if (!form) return true;
    const panel = form.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (!panel) return true;
    for (const el of Array.from(panel.querySelectorAll<HTMLInputElement>('input, select, textarea'))) {
      if (!el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    return true;
  }

  function goto(next: number) {
    if (next > step && !validateVisible()) return;
    if (STEPS[next] === 'Review' && formRef.current) {
      const data = new FormData(formRef.current);
      setReview(
        REVIEW_LABELS.map(([name, label]) => [label, String(data.get(name) ?? '').trim()] as [string, string]).filter(
          ([, v]) => v,
        ),
      );
    }
    setStep(next);
    document.getElementById('apply-form-top')?.scrollIntoView({ behavior: 'smooth' });
  }

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

  const show = (i: number) => ({ display: step === i ? undefined : 'none' });

  return (
    <div id="apply-form-top">
      {/* Step indicator */}
      <ol className="mb-10 flex flex-wrap items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full font-heading text-sm font-bold ${
                i < step
                  ? 'bg-brand-gold text-brand-purple'
                  : i === step
                    ? 'bg-brand-purple text-brand-gold ring-2 ring-brand-gold'
                    : 'bg-brand-sand text-brand-muted'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </span>
            <span className={`text-xs font-semibold uppercase tracking-wide ${i === step ? 'text-brand-purple' : 'text-brand-muted'}`}>
              {s}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 hidden h-px w-6 bg-brand-sand sm:block" />}
          </li>
        ))}
      </ol>

      <form ref={formRef} onSubmit={onSubmit} className="rounded-xl border border-brand-sand bg-white p-6 shadow-sm sm:p-8">
        {/* Step 1 — Personal */}
        <div data-step={0} style={show(0)} className="space-y-5">
          <h2 className={groupCls}>Name</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="First" name="firstname" required />
            <Field label="Middle" name="middlename" />
            <Field label="Last" name="surname" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Radios label="Gender" name="gender" options={['Male', 'Female']} required />
            <Field label="Date of birth" name="dob" type="date" required />
            <Field label="Maiden name (if applicable)" name="maidenname" />
          </div>
          <h2 className={groupCls}>Address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address line 1" name="address_line1" required />
            <Field label="Address line 2" name="address_line2" />
            <Field label="City" name="city" required />
            <Field label="State / Province / Region" name="state" />
            <Field label="Postal code" name="postal" />
            <Field label="Country" name="country" required />
          </div>
          <h2 className={groupCls}>Contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" name="email" type="email" required />
            <Field label="Phone" name="phone_mobile" type="tel" required />
          </div>
          <h2 className={groupCls}>Background</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Religion" name="religion" />
            <Field label="City and country of birth" name="birth_place" />
            <Field label="Nation of citizenship" name="citizenship" />
            <Field label="Native language" name="native_language" />
            <Field label="ID / Passport number" name="id_number" />
            <Field label="Place of issue" name="place_issue" />
          </div>
          <h2 className={groupCls}>Marital status</h2>
          <Radios label="Status" name="marital_status" options={['Single', 'Married', 'Widowed', 'Divorced']} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name of spouse (if married)" name="spouse_name" />
            <Field label="Email of spouse" name="spouse_email" type="email" />
            <Field label="Phone of spouse" name="spouse_phone" type="tel" />
          </div>
          <h2 className={groupCls}>Emergency contact</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Full name" name="em_name" required />
            <Field label="Phone" name="em_mobile" type="tel" required />
            <Field label="Relationship to applicant" name="em_relationship" />
          </div>
          {/* Honeypot — hidden from real users */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        </div>

        {/* Step 2 — Academic */}
        <div data-step={1} style={show(1)} className="space-y-5">
          <h2 className={groupCls}>Secondary education</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Level attained (e.g. GCE A-Level)" name="sec_level" />
            <Field label="Year completed" name="sec_year" type="number" />
            <Field label="School" name="sec_school" />
          </div>
          <h2 className={groupCls}>Institutions attended</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name of institution 1" name="post_inst1" />
            <Field label="Certification type" name="post_qual1" />
            <Field label="Graduation / expected date" name="post_year1" />
            <Field label="Name of institution 2" name="post_inst2" />
            <Field label="Certification type" name="post_qual2" />
            <Field label="Graduation / expected date" name="post_year2" />
          </div>
          <h2 className={groupCls}>Experience</h2>
          <Area label="Extracurricular activities" name="extracurricular" />
          <Area label="Talents and awards" name="talents" />
          <Area label="Community service work" name="community_service" />
          <Area label="Employment" name="employment" />
        </div>

        {/* Step 3 — Program */}
        <div data-step={2} style={show(2)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelCls}>Application enrollment for a <span className="text-red-600">*</span></span>
              <select name="level" required className={inputCls} defaultValue="">
                <option value="" disabled>Select level</option>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className={labelCls}>Specific field / program <span className="text-red-600">*</span></span>
              <select name="field" required className={inputCls} defaultValue="">
                <option value="" disabled>Select field</option>
                {Object.entries(FIELDS).map(([group, options]) => (
                  <optgroup key={group} label={group}>
                    {options.map((o) => <option key={o}>{o}</option>)}
                  </optgroup>
                ))}
                <option>Other</option>
              </select>
            </label>
            <Field label="What is your planned major?" name="planned_major" />
            <Field label="Other / specialization" name="field_other" />
            <label className="block space-y-1.5">
              <span className={labelCls}>Which campus do you seek admission?</span>
              <select name="campus" className={inputCls} defaultValue="">
                <option value="" disabled>Select campus</option>
                <option>Buea (Main Campus)</option>
                <option>Douala (School of Theology)</option>
                <option>Online / Distance Learning</option>
              </select>
            </label>
            <Field label="When do you intend to start your studies?" name="start_when" required />
          </div>
          <Radios label="Mode of study" name="mode" options={['Full Time', 'Part Time', 'ODL']} required />
          <Radios label="How do you plan to finance your studies?" name="financing" options={['Self', 'Sponsored']} required />
          <Area label="If sponsored, please explain" name="financing_explain" />
        </div>

        {/* Step 4 — Uploads */}
        <div data-step={3} style={show(3)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={labelCls}>Please attach a 4x4 photo of yourself</span>
              <input type="file" name="filePhoto" accept=".pdf,.jpg,.jpeg,.png" className={inputCls} />
            </label>
            <label className="block space-y-1.5">
              <span className={labelCls}>Attach certificates and other required documents</span>
              <input type="file" name="fileID" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.zip" className={inputCls} />
            </label>
          </div>
          <p className="text-xs text-brand-muted">
            Accepted: PDF/JPG/PNG/DOC/DOCX/ZIP · max 4&nbsp;MB total. Larger documents can be emailed
            to admission@iguc.net after you submit.
          </p>
          <h2 className={groupCls}>Health & circumstances</h2>
          <Radios label="Have you suffered from any serious illness?" name="illness" options={['Yes', 'No']} />
          <Area label="If yes, please indicate / describe" name="illness_desc" />
          <Area label="Family or work obligations we should know about (optional)" name="obligations" />
        </div>

        {/* Step 5 — Review */}
        <div data-step={4} style={show(4)}>
          <h2 className={groupCls}>Review your application</h2>
          <p className="mt-2 text-sm text-brand-muted">
            Please check the information below. Use the Back button to correct anything.
          </p>
          <dl className="mt-6 divide-y divide-brand-sand rounded-lg border border-brand-sand">
            {review.map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 gap-4 px-4 py-2.5 text-sm">
                <dt className="font-semibold text-brand-purple">{label}</dt>
                <dd className="text-brand-muted">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Step 6 — Declaration */}
        <div data-step={5} style={show(5)} className="space-y-5">
          <h2 className={groupCls}>References</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="1) Name" name="ref1_name" required />
            <Field label="Phone number" name="ref1_phone" type="tel" />
            <Field label="2) Name" name="ref2_name" />
            <Field label="Phone number" name="ref2_phone" type="tel" />
          </div>
          <h2 className={groupCls}>Declaration</h2>
          <p className="text-sm leading-relaxed text-brand-muted">
            I certify that the information provided in this application is true and complete to the
            best of my knowledge. I understand that any false or misleading information may result in
            the refusal or cancellation of my admission to ICOF Global University.
          </p>
          <label className="flex items-start gap-3 text-sm text-brand-purple">
            <input type="checkbox" name="agree" value="Yes" required className="mt-1" />
            <span>
              Yes, I understand and agree to the terms listed above. <span className="text-red-600">*</span>
            </span>
          </label>
          {(status === 'error' || status === 'unconfigured') && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {status === 'unconfigured'
                ? 'Online submission is being set up. Please use our application portal instead: '
                : 'Something went wrong sending your application. Please try again, or use our application portal: '}
              <a href="https://iguc.net/forms/" className="font-semibold underline">iguc.net/forms</a> — or email{' '}
              <a href="mailto:admission@iguc.net" className="font-semibold underline">admission@iguc.net</a>.
            </div>
          )}
        </div>

        {/* Wizard controls */}
        <div className="mt-10 flex items-center justify-between border-t border-brand-sand pt-6">
          <button
            type="button"
            onClick={() => goto(step - 1)}
            disabled={step === 0}
            className="rounded-full border-2 border-brand-purple px-6 py-2.5 font-heading font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white disabled:invisible"
          >
            ← Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => goto(step + 1)}
              className="rounded-full bg-brand-gold px-8 py-2.5 font-heading font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
            >
              Next →
            </button>
          ) : (
            <button
              type="submit"
              disabled={status === 'sending'}
              className="rounded-full bg-brand-gold px-8 py-3 font-heading text-lg font-bold text-brand-purple transition hover:bg-brand-gold-deep disabled:opacity-60"
            >
              {status === 'sending' ? 'Submitting…' : '🎓 Submit Application'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
