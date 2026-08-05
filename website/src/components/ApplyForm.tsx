'use client';

import { useEffect, useRef, useState } from 'react';

const DRAFT_KEY = 'iguc-application-draft';

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
  // Fields of study, not award titles — the level is chosen separately above.
  // Theology now teaches seven distinct fields, so an applicant is no longer
  // forced to pick "Ministry" when they mean Christian Leadership or Mission.
  Theology: [
    'Theology',
    'Divinity',
    'Ministry',
    'Christian Leadership',
    'Christian Education',
    'Evangelism and Mission',
    'Black Liberation Theology',
  ],
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

// The review step, grouped the way the form itself is grouped.
//
// It was one undifferentiated list of forty-odd rows, which is how a form dump
// looks rather than how an application looks: no hierarchy, so "Date of birth"
// carried the same weight as "Intended start", and an applicant checking their
// own submission had to read all of it to find one field. Sections mean the eye
// can go straight to the part being checked — and an empty section disappears
// entirely rather than leaving a gap.
const REVIEW_SECTIONS: Array<{ title: string; fields: Array<[string, string]> }> = [
  {
    title: 'Personal details',
    fields: [
      ['gender', 'Gender'], ['dob', 'Date of birth'], ['birth_place', 'Place of birth'],
      ['citizenship', 'Citizenship'], ['native_language', 'Native language'],
      ['religion', 'Religion'], ['marital_status', 'Marital status'], ['spouse_name', 'Spouse'],
    ],
  },
  {
    title: 'Contact',
    fields: [
      ['email', 'Email'], ['phone_mobile', 'Phone'],
      ['address_line1', 'Address'], ['city', 'City'], ['state', 'State / Region'], ['country', 'Country'],
      ['em_name', 'Emergency contact'], ['em_mobile', 'Emergency phone'],
    ],
  },
  {
    title: 'Education',
    fields: [
      ['sec_school', 'Secondary school'], ['sec_level', 'Secondary level'], ['sec_year', 'Year completed'],
      ['post_inst1', 'Institution'], ['post_qual1', 'Qualification'], ['post_year1', 'Graduated'],
      ['post_inst2', 'Institution (2)'], ['post_qual2', 'Qualification (2)'], ['post_year2', 'Graduated (2)'],
    ],
  },
  {
    title: 'Programme applied for',
    fields: [
      ['level', 'Level'], ['field', 'Field'], ['field_other', 'Specialisation'],
      ['planned_major', 'Planned major'], ['campus', 'Campus'], ['mode', 'Mode of study'],
      ['start_when', 'Intended start'], ['financing', 'Financing'], ['financing_explain', 'Financing details'],
    ],
  },
  {
    title: 'Experience and interests',
    fields: [
      ['employment', 'Employment'], ['extracurricular', 'Extracurricular activities'],
      ['talents', 'Talents and awards'], ['community_service', 'Community service'],
    ],
  },
  {
    title: 'Health and circumstances',
    fields: [
      ['illness', 'Serious illness'], ['illness_desc', 'Details'], ['obligations', 'Family or work obligations'],
    ],
  },
  {
    title: 'References',
    fields: [
      ['ref1_name', 'First referee'], ['ref1_phone', 'Phone'],
      ['ref2_name', 'Second referee'], ['ref2_phone', 'Phone'],
    ],
  },
];

interface ReviewSection {
  title: string;
  rows: Array<[string, string]>;
}

// Fields the browser stores as ISO. `2007-08-14` is the date input's storage
// format, not a way of writing a birthday, and printing it back unchanged is
// what makes a summary look like a database row rather than a document.
const DATE_FIELDS = new Set(['dob']);

function formatValue(name: string, value: string): string {
  if (!DATE_FIELDS.has(name)) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  // Constructed as UTC on purpose: `new Date('2007-08-14')` is midnight UTC,
  // which in any timezone west of Greenwich renders as the 13th.
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/** Human-readable file size. 1.4 MB says more than 1468006 does. */
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ApplyForm() {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'unconfigured'>('idle');
  const [review, setReview] = useState<ReviewSection[]>([]);
  const [reviewName, setReviewName] = useState('');
  const [reviewProgramme, setReviewProgramme] = useState('');
  const [appNo, setAppNo] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // The photo the applicant attached, shown back to them rather than left as a
  // filename. A 4x4 photograph goes on a student card and an admission letter;
  // "Alice.jpg" tells them nothing about whether they picked the right file, or
  // whether it is upside down.
  const [photo, setPhoto] = useState<{ url: string; name: string; size: number } | null>(null);
  const [docFile, setDocFile] = useState<{ name: string; size: number } | null>(null);

  // Object URLs are held by the browser until revoked. Without this, every
  // reselection leaks the previous image for the life of the page.
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      if (!file || !file.type.startsWith('image/')) return null;
      return { url: URL.createObjectURL(file), name: file.name, size: file.size };
    });
  }

  // Restore a saved draft so applicants can leave and come back.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
      if (!draft) return;
      for (const [name, value] of Object.entries(draft.fields as Record<string, string>)) {
        const el = form.elements.namedItem(name);
        if (el instanceof RadioNodeList || (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox'))) {
          form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((r) => {
            if (r.value === value) r.checked = true;
          });
        } else if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        ) {
          if (el.type !== 'file') el.value = value;
        }
      }
      if (typeof draft.step === 'number') setStep(Math.min(draft.step, 3));
      setDraftSaved(true);
    } catch {
      /* corrupt draft — ignore */
    }
  }, []);

  function saveDraft(currentStep = step) {
    const form = formRef.current;
    if (!form) return;
    const fields: Record<string, string> = {};
    new FormData(form).forEach((v, k) => {
      if (typeof v === 'string' && v) fields[k] = v;
    });
    delete fields.website;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ fields, step: currentStep }));
      setDraftSaved(true);
    } catch {
      /* storage full/blocked — non-fatal */
    }
  }

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
      const get = (n: string) => String(data.get(n) ?? '').trim();

      // The name and the programme head the summary rather than sitting in a
      // row of their own — they are what identifies the application.
      setReviewName(
        [get('firstname'), get('middlename'), get('surname')].filter(Boolean).join(' '),
      );
      setReviewProgramme(
        [get('level'), get('field_other') || get('field')].filter(Boolean).join(' in '),
      );

      setReview(
        REVIEW_SECTIONS.map((section) => ({
          title: section.title,
          rows: section.fields
            .map(([name, label]) => [label, formatValue(name, get(name))] as [string, string])
            .filter(([, v]) => v),
        })).filter((s) => s.rows.length > 0),
      );
    }
    setStep(next);
    saveDraft(next);
    document.getElementById('apply-form-top')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/apply', { method: 'POST', body: new FormData(e.currentTarget) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setAppNo(data.appNo ?? null);
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        setStatus('sent');
      } else if (res.status === 503) setStatus('unconfigured');
      else setStatus('error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-brand-sand bg-white p-10 text-center shadow-sm">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mx-auto h-10 w-10 text-brand-gold-deep" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 4l9 5.5-9 5.5Z" /><path d="M7 11.8V17c0 1.1 2.2 2 5 2s5-.9 5-2v-5.2M21 9.5V15" /></svg>
        <h2 className="mt-4 font-heading text-2xl font-bold text-brand-purple">Application received!</h2>
        {appNo && (
          <div className="mx-auto mt-5 max-w-sm rounded-lg bg-brand-cream p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
              Your application number
            </p>
            <p className="mt-1 font-heading text-2xl font-extrabold tracking-wider text-brand-purple">
              {appNo}
            </p>
            <p className="mt-2 text-xs text-brand-muted">
              Keep this number — quote it in any correspondence with the admissions office.
            </p>
          </div>
        )}
        <p className="mx-auto mt-5 max-w-md text-brand-muted">
          Thank you for applying to ICOF Global University. Our admissions office will review your
          application and contact you by email or phone.
        </p>
      </div>
    );
  }

  const show = (i: number) => ({ display: step === i ? undefined : 'none' });

  const progress = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div id="apply-form-top">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-brand-muted">
          <span>Application progress</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-sand">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-gold-deep transition-all duration-500"
            style={{ width: `${Math.max(progress, 4)}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs text-brand-muted">
          Takes about 10 minutes.{' '}
          {draftSaved
            ? '✓ Your progress is saved on this device — you can leave and continue later.'
            : 'Your progress saves automatically as you type.'}
        </p>
      </div>

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

      <form
        ref={formRef}
        onSubmit={onSubmit}
        onBlur={() => saveDraft()}
        className="rounded-xl border border-brand-sand bg-white p-6 shadow-sm sm:p-8"
      >
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
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <span className={labelCls}>Passport photograph</span>
              <div className="flex items-start gap-4">
                {/* The 4x4 frame is the proportion the photo will be printed
                    at, so an applicant sees the crop rather than guessing. */}
                <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-brand-sand bg-white">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.url} alt="Your passport photograph" className="h-full w-full object-cover" />
                  ) : (
                    <span className="px-2 text-center text-[10px] uppercase tracking-wide text-brand-muted/70">
                      4&nbsp;&times;&nbsp;4 photo
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    type="file"
                    name="filePhoto"
                    accept=".jpg,.jpeg,.png"
                    onChange={onPhotoChange}
                    className={`${inputCls} file:mr-3 file:rounded file:border-0 file:bg-brand-purple file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white`}
                  />
                  {photo ? (
                    <p className="truncate text-xs text-brand-muted">
                      {photo.name} · {fileSize(photo.size)}
                    </p>
                  ) : (
                    <p className="text-xs text-brand-muted">
                      A head-and-shoulders photograph on a plain background. JPG or PNG.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className={labelCls}>Certificates and supporting documents</span>
              <input
                type="file"
                name="fileID"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.zip"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setDocFile(f ? { name: f.name, size: f.size } : null);
                }}
                className={`${inputCls} file:mr-3 file:rounded file:border-0 file:bg-brand-purple file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white`}
              />
              {docFile ? (
                <p className="truncate text-xs text-brand-muted">
                  {docFile.name} · {fileSize(docFile.size)}
                </p>
              ) : (
                <p className="text-xs text-brand-muted">
                  Transcripts, certificates and identification. Combine several into one PDF or ZIP.
                </p>
              )}
            </div>
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
            Please check every section. Use Back to correct anything before you continue.
          </p>

          {/* Identity band. The photograph, the name and the programme are what
              the application IS; everything below is detail supporting them. */}
          <div className="mt-6 flex flex-wrap items-center gap-5 rounded-xl border border-brand-sand bg-white p-5">
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-cream ring-1 ring-brand-sand">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt="Your passport photograph" className="h-full w-full object-cover" />
              ) : (
                <span className="px-2 text-center text-[10px] uppercase tracking-wide text-brand-muted/70">
                  No photo
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold-deep">
                Application for admission
              </p>
              <p className="mt-1 font-heading text-xl font-bold text-brand-purple">
                {reviewName || 'Your name'}
              </p>
              {reviewProgramme && (
                <p className="mt-0.5 text-sm text-brand-muted">{reviewProgramme}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-brand-muted">
                <span>
                  Photograph:{' '}
                  {photo
                    ? <span className="font-medium text-brand-purple">attached</span>
                    : <span className="font-medium text-red-600">not attached</span>}
                </span>
                <span>
                  Documents:{' '}
                  {docFile
                    ? <span className="font-medium text-brand-purple">{docFile.name}</span>
                    : <span className="font-medium text-red-600">none attached</span>}
                </span>
              </div>
            </div>
          </div>

          {(!photo || !docFile) && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
              You can submit without these, but the Registrar cannot decide your application until
              they arrive. Go back to Uploads, or email them to admission@iguc.net afterwards.
            </p>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {review.map((section) => (
              <section key={section.title} className="rounded-xl border border-brand-sand bg-white">
                <h3 className="border-b border-brand-sand px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-purple">
                  {section.title}
                </h3>
                <dl className="divide-y divide-brand-sand/60">
                  {section.rows.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-4 px-4 py-2">
                      <dt className="text-xs text-brand-muted">{label}</dt>
                      <dd className="break-words text-sm text-brand-purple">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
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
                ? 'Online submission is being set up. Your answers are saved in this browser — please email them to us, or call the admissions office and we will complete your application with you: '
                : 'Something went wrong sending your application. Your answers are saved in this browser, so you can try again — or send them to us directly: '}
              <a href="mailto:admission@iguc.net" className="font-semibold underline">admission@iguc.net</a> ·{' '}
              <a href="tel:+237675133426" className="font-semibold underline">+237 675 133 426</a>.
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
              {status === 'sending' ? 'Submitting…' : 'Submit Application'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
