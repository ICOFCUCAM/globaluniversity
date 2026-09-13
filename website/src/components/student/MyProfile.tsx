'use client';

// ---------------------------------------------------------------------------
// MY PROFILE — who the University says you are, and what you may change.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "The student should have a proper academic identity. Personal Information ·
// Contact Information · Emergency Contact · Academic Information (student
// number, programme, faculty, department, admission year, academic status,
// study mode) · Account & Security (password, MFA, sessions, notifications).
// Some fields should be editable by the student; authoritative academic fields
// should be controlled by the University."
//
// ---------------------------------------------------------------------------
// THE LINE BETWEEN THE TWO IS THE WHOLE SCREEN
// ---------------------------------------------------------------------------
//
// A phone number is the student's. A programme is not. The difference is not a
// matter of taste: a student who could edit their own programme, award or
// admission year could edit their way into a degree, and every downstream
// screen — the curriculum, the graduation audit, the transcript — would
// believe them.
//
// So the academic block below is READ-ONLY BY CONSTRUCTION. Not disabled
// inputs, which are a client-side suggestion and can be re-enabled by anybody
// who opens developer tools; it is a definition list. There is no form to
// submit, so there is nothing to intercept. Where a student needs one of those
// facts corrected, the screen sends them to the request that exists for it.
//
// ---------------------------------------------------------------------------
// WHAT IS HERE AND WHAT IS STILL IN SETTINGS
// ---------------------------------------------------------------------------
//
// `SettingsPage` already changes a password and edits a phone number, and it
// does both correctly — including the detail that Supabase re-checks the
// session rather than the old password. It is not rebuilt here and it is not
// duplicated: this screen shows the academic identity nothing was showing, and
// links to Settings for the account itself.
//
// MFA and session management are on the University's list and are NOT offered
// here, because this portal does not have them. A panel headed "MFA" with
// nothing behind it tells a student their account has a second factor when it
// does not, which is worse than an honest absence.
// ---------------------------------------------------------------------------

import React from 'react';
import { Card } from '@/components/ui/portal';
import StudentScreen from './StudentScreen';
import { useAuth } from '@/contexts/AuthContext';
import { useJourney } from '@/contexts/JourneyContext';
import { FOCUS } from '@/lib/portalTheme';
import { Lock, ShieldAlert, UserCog } from 'lucide-react';
import type { ViewType } from '@/lib/types';

export default function MyProfile({ onNavigate }: { onNavigate?: (v: ViewType) => void }) {
  const { user } = useAuth();
  const { journey, loading, failed } = useJourney();

  return (
    <StudentScreen
      title="My profile"
      subtitle="Who the University has you down as"
      loading={loading}
      failed={failed}
    >
      <div className="space-y-5">
        {/* ---- PERSONAL, AS THE UNIVERSITY RECORDS IT ---- */}
        <Panel
          title="You"
          note="Your name as it appears on everything the University issues."
        >
          <Fact label="Name" value={journey?.full_name ?? user?.name ?? null} />
          <Fact label="Sign-in address" value={user?.email ?? null} />
        </Panel>

        {/* ------------------------------------------------------------------
            ACADEMIC IDENTITY — READ-ONLY, AND NOT BY BEING DISABLED.

            A definition list, not a form. See the header for why that
            distinction is not pedantry.
            ------------------------------------------------------------------ */}
        <Panel
          title="Academic information"
          note="Held by the University. None of this can be changed from here — if something is
                wrong, ask the Registry and they will correct the record."
        >
          <Fact label="Student number"
            value={journey?.student_number ?? journey?.matric_no ?? null} />
          <Fact label="Programme"
            value={journey?.programme_name ?? journey?.programme_code ?? null} />
          <Fact label="Award" value={journey?.award_title ?? null} />
          <Fact label="Curriculum" value={journey?.version_label ?? null} />
          <Fact label="Year" value={journey?.programme_year
            ? `Year ${journey.programme_year}${journey.duration_years
              ? ` of ${journey.duration_years}` : ''}` : null} />
          <Fact label="Session" value={journey?.year_label ?? null} />
          <Fact label="Academic status" value={standingOf(journey?.stage)} />
          {/* FACULTY, DEPARTMENT, ADMISSION YEAR AND STUDY MODE are on the
              University's list. The journey record does not carry them, and a
              faculty name invented onto somebody's profile is an invented
              institutional fact. They appear here the moment the record
              carries them, and not before. */}
        </Panel>

        {onNavigate && (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                Something above is wrong?
              </p>
              <p className="text-[11px] text-[#a49bb0] dark:text-[#7b7289]">
                The Registry corrects the academic record. Ask them and you will be able to see
                where the request has got to.
              </p>
            </div>
            <button
              onClick={() => onNavigate('student-services')}
              className={`shrink-0 rounded-lg border border-[#ded6c8] px-3 py-1.5 text-xs
                          font-medium text-[#422e59] transition hover:bg-[#f5f1ea]
                          dark:border-[#3d3349] dark:text-[#c8b6e8] dark:hover:bg-[#2a2333] ${FOCUS}`}
            >
              Ask the Registry
            </button>
          </Card>
        )}

        {/* ---- ACCOUNT ---- */}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold
                         text-[#422e59] dark:text-[#c8b6e8]">
            <Lock size={15} /> Account &amp; security
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
            Your password and your contact details are changed in Settings.
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('settings')}
              className={`mt-3 flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2 text-xs
                          font-semibold text-white transition hover:bg-[#33234a] ${FOCUS}`}
            >
              <UserCog size={14} /> Open settings
            </button>
          )}

          {/* THE HONEST ABSENCE. See the header: a panel headed "MFA" with
              nothing behind it tells a student their account is protected in a
              way it is not. */}
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#faf8f4] p-3
                          dark:bg-[#241f2c]">
            <ShieldAlert size={14} className="mt-0.5 shrink-0 text-[#a07c12]" />
            <p className="text-[11px] leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
              This portal does not yet offer two-factor authentication or a list of your active
              sessions. They are not hidden somewhere — they do not exist here, and your account
              is protected by your password alone. Choose one you use nowhere else.
            </p>
          </div>
        </Card>
      </div>
    </StudentScreen>
  );
}

/** The stage, in the words a University uses about a student's standing. */
export function standingOf(stage: string | null | undefined): string | null {
  switch (stage) {
    case 'studying':
    case 'registering': return 'Active';
    case 'awaiting-programme': return 'Enrolled, awaiting curriculum';
    case 'suspended': return 'Suspended';
    case 'withdrawn': return 'Withdrawn';
    case 'graduated': return 'Completed, awaiting conferral';
    case 'alumni': return 'Graduated';
    case 'admitted': return 'Admitted, not yet enrolled';
    case 'deferred': return 'Deferred';
    case 'applying': return 'Applicant';
    default: return null;
  }
}

function Panel({
  title, note, children,
}: { title: string; note: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">{title}</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-[#a49bb0] dark:text-[#7b7289]">{note}</p>
      <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[#a49bb0]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
        {value ?? <span className="font-normal text-[#a49bb0]">Not recorded</span>}
      </dd>
    </div>
  );
}
