'use client';

// ---------------------------------------------------------------------------
// CREDENTIALS — one place, three areas.
//
// ---------------------------------------------------------------------------
// WHAT THIS REPLACED, AND WHY IT WAS WRONG
// ---------------------------------------------------------------------------
//
// The sidebar carried three entries over one subject:
//
//     Credential studio        design the document        superadmin
//     Credential approvals     sign off a design          three offices
//     Credential authority     the register, amendments   authority + registrar
//
// Three names, none of which tells you which one holds the thing you are
// looking for. "Where do I correct a graduate's name" has an answer — the
// Authority — and no way to work it out from the menu. A Registrar could reach
// two of the three and had no way to know the third existed.
//
// Worse, the first two were the SAME screen under two labels: `studio` appeared
// twice in the navigation with different names for different roles, so search
// found two results that opened the same component.
//
// ---------------------------------------------------------------------------
// WHY A SHELL RATHER THAN A REWRITE
// ---------------------------------------------------------------------------
//
// The Authority is 970 lines and the Studio 1335, and both are correct. The
// duplication was in the NAVIGATION, not in the screens — so the fix belongs in
// the navigation. This composes what exists behind one entry and changes
// neither.
//
// Each area keeps its own tab strip. Flattening fourteen tabs into one row
// would have replaced a menu nobody could navigate with a tab strip nobody
// could navigate.
//
// ---------------------------------------------------------------------------
// THE ROLE SPLIT IS PRESERVED EXACTLY
// ---------------------------------------------------------------------------
//
// Consolidating a menu must not consolidate an authority. An area a role may
// not use is not drawn, and the components underneath still refuse from the
// inside — hiding a tab is courtesy; the check within the component and the
// check in the route are the control.
//
//   Design       the Superadministrator alone. Someone who can redesign a
//                certificate can alter what the University has already
//                attested to.
//   Approvals    the Registrar, the Academic Office and the Vice-Chancellor.
//                Designing and approving are different people, by design.
//   Register     the Authority amends and revokes; the Registrar reaches it to
//                print and email. The screen decides which it draws.
//   Specimens    the Vice-Chancellor and the Superadministrator, and nobody
//                else. THIS LINE USED TO READ "anyone who can reach this
//                screen. There is nothing in a specimen to protect — that is
//                the point of a specimen." The University overruled it on
//                16 September 2026, and the reasoning it replaced was wrong
//                about what a specimen is: it protects no graduate's data,
//                true, but it IS the certificate design — the layout, the
//                security features and the wording, shown to whoever opens
//                it. See migration 101.
// ---------------------------------------------------------------------------

import React from 'react';
import { BadgeCheck, Palette, ShieldCheck, BookOpen, Stamp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import CredentialAuthority from '@/components/credentials/CredentialAuthority';
import CredentialStudio from '@/components/studio/CredentialStudio';
import SpecimenGallery from '@/components/studio/SpecimenGallery';
import CertificateGenerator from '@/components/certificate/CertificateGenerator';
import TranscriptGenerator from '@/components/transcript/TranscriptGenerator';
import ManualTranscript from '@/components/transcript/ManualTranscript';
import TranscriptRequestQueue from '@/components/credentials/TranscriptRequestQueue';
import SigningStatus from '@/components/credentials/SigningStatus';
import TranscriptExceptions from '@/components/credentials/TranscriptExceptions';
import CertificateReissue from '@/components/credentials/CertificateReissue';
import { PageHeader } from '@/components/ui/portal';
import { FOCUS } from '@/lib/portalTheme';

type AreaId = 'issue' | 'register' | 'design' | 'specimens';

interface Area {
  id: AreaId;
  label: string;
  icon: React.ReactNode;
  /** One line under the tab strip, so the area says what it is for. */
  blurb: string;
}

export default function CredentialsWorkspace({ role }: { role?: UserRole }) {
  const { user } = useAuth();
  const actualRole = role ?? user?.role;

  const mayDesign = can(actualRole, 'design-credentials');
  const mayApprove = can(actualRole, 'approve-credential-design');
  // The register is reachable by the offices that issue, amend and revoke.
  // CredentialAuthority itself decides which controls it draws for which role.
  const mayRegister = actualRole === 'superadmin'
    || actualRole === 'vice-chancellor'
    || actualRole === 'registrar';

  // Whoever may put the University's name on a document for a named person.
  const mayIssue = can(actualRole, 'issue-credential');

  // The certificate design, the specimen book and the security configuration
  // are one restricted asset under the University's ruling of 16 September
  // 2026, and this is the only question asked about it on this screen.
  const maySeeTheDesign = can(actualRole, 'view-certificate-template');

  const areas: Area[] = React.useMemo(() => {
    const list: Area[] = [];
    // FIRST, BECAUSE IT IS THE JOB. Every other area exists in service of this
    // one: the design decides what the document looks like, the register
    // records what was issued, the specimen book shows the forms. Issuing is
    // the act. It used to live under Records → Certificate, three groups away
    // from everything else about credentials, so somebody standing in the
    // Design tab with a graduate's file open had no route to producing their
    // certificate and no reason to think one existed.
    if (mayIssue) {
      list.push({
        id: 'issue',
        label: 'Issue',
        icon: <Stamp size={15} />,
        blurb: 'Choose a graduate, see the checks that decide whether they qualify, and issue. '
          + 'The document is filled from the record the University already holds.',
      });
    }
    if (mayRegister) {
      list.push({
        id: 'register',
        label: 'Register',
        icon: <BadgeCheck size={15} />,
        blurb: 'Everything the University has issued. Corrections supersede; nothing is overwritten.',
      });
    }
    if (mayDesign || mayApprove) {
      list.push({
        id: 'design',
        // The same area, named for what the role does in it. A designer is not
        // shown a tab called "Approvals" they cannot act in, and an approver is
        // not shown one called "Design" that will refuse them.
        label: mayDesign ? 'Design' : 'Approvals',
        icon: mayDesign ? <Palette size={15} /> : <ShieldCheck size={15} />,
        blurb: mayDesign
          ? 'The document, its security features and its wording. Publishing creates a new version — nothing already issued changes.'
          : 'Designs submitted for the University’s approval. You are one of the three offices that must sign before a design can be published.',
      });
    }
    // -------------------------------------------------------------------
    // THE SPECIMEN BOOK IS NO LONGER ANYBODY'S.
    //
    // This tab used to be pushed unconditionally, on the reasoning written at
    // the head of this file: "anyone who can reach this screen. There is
    // nothing in a specimen to protect — that is the point of a specimen."
    //
    // THE UNIVERSITY HAS OVERRULED THAT, and the reason is not that a
    // specimen leaks a graduate's data — it does not, and never did. It is
    // that the specimen IS the certificate design:
    //
    //   "The official ICOF certificate template, certificate sample,
    //    certificate security configuration and associated institutional
    //    design assets are restricted university resources. Access shall be
    //    limited exclusively to the Vice-Chancellor and SuperAdmin."
    //
    // A specimen of the certificate shows its layout, its security features
    // and its wording to anybody who opens it, which is exactly what a
    // forger needs and exactly what the ruling withdraws. The Registrar and
    // the Academic Office reached this book yesterday and do not today.
    //
    // AND HIDING THE TAB IS THE COURTESY, NOT THE CONTROL — "simply hiding a
    // button is not sufficient" — so 101 refuses the certificate design in
    // the database as well, to this screen's own session.
    // -------------------------------------------------------------------
    if (maySeeTheDesign) {
      list.push({
        id: 'specimens',
        label: 'Specimens',
        icon: <BookOpen size={15} />,
        blurb: 'One certificate per level the University confers, in the wording each level '
          + 'requires. Restricted to the Vice-Chancellor and the Superadministrator.',
      });
    }
    return list;
  }, [mayIssue, mayDesign, mayApprove, mayRegister, maySeeTheDesign]);

  // Land on the area this role is most likely to have come for: the register
  // if they hold it, otherwise their own work.
  //
  // `?? 'specimens'` USED TO BE THE FALLBACK HERE, IN BOTH PLACES, and it was
  // harmless only while every role could open the specimen book. Now that the
  // book is the Vice-Chancellor's and the Superadministrator's, a role with no
  // areas at all would have been handed the one thing the ruling withdraws —
  // by a default written when there was nothing to default into.
  //
  // `null` is the honest fallback: no area, so nothing is drawn.
  const [area, setArea] = React.useState<AreaId | null>(areas[0]?.id ?? null);

  // A role change mid-session — the demo role switcher does exactly this —
  // could otherwise leave the shell showing an area the new role may not use.
  React.useEffect(() => {
    if (!areas.some((a) => a.id === area)) setArea(areas[0]?.id ?? null);
  }, [areas, area]);

  const current = areas.find((a) => a.id === area);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Credentials"
        subtitle="The design, the approval, the register and the specimen book — for every credential the University awards."
      />

      {/* Only drawn when there is a choice. A role with one area gets the area,
          not a tab strip with one tab in it. */}
      {areas.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-[#ded6c8] dark:border-[#3d3349]">
          {areas.map((a) => (
            <button
              key={a.id}
              onClick={() => setArea(a.id)}
              aria-current={area === a.id ? 'page' : undefined}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${FOCUS} ${
                area === a.id
                  ? 'border-[#422e59] text-[#422e59] dark:border-[#c8b6e8] dark:text-[#e4dcf0]'
                  : 'border-transparent text-[#6b6076] hover:text-[#422e59] dark:text-[#9c93ad] dark:hover:text-[#e4dcf0]'
              }`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}

      {current && (
        <p className="max-w-3xl text-sm text-[#6b6076] dark:text-[#9c93ad]">{current.blurb}</p>
      )}

      {area === 'issue' && (
        <div className="space-y-8">
          {/* WHAT STUDENTS HAVE ASKED FOR, ABOVE THE WORK. A request that
              arrives as an email to whoever happens to read it is answered when
              somebody remembers; a queue has a length, and a length is a thing
              an office can be held to. */}
          <TranscriptRequestQueue />

          {/* §7. WHERE THE OFFICER IS WHEN THEY NEED IT. An officer who has
              just searched the register for a student and not found them is
              standing here; sending them to another screen to put the case is
              how a case ends up in an email instead. */}
          <TranscriptExceptions />

          <CertificateGenerator embedded />
          {/* THE TRANSCRIPT IS THE OTHER HALF OF ISSUING, and it was nowhere
              near this screen. It is the document employers and other
              universities ask for most often, and until now the University had
              no record that one had ever been issued. */}
          <div className="border-t border-[#ded6c8] pt-8 dark:border-[#3d3349]">
            <h3 className="font-heading text-base font-bold text-[#422e59] dark:text-[#e4dcf0]">
              Transcript
            </h3>
            <p className="mb-4 mt-1 max-w-3xl text-sm text-[#6b6076] dark:text-[#9c93ad]">
              A transcript is issued to a student who has <em>not</em> finished as well as to a
              graduate — for a visa, a transfer, an employer. It carries the marks that have
              cleared the approval chain, and nothing still under deliberation.
            </p>
            <TranscriptGenerator embedded />

            {/* Drawn only for the Superadministrator, and the route checks
                again. See ManualTranscript for why this is the most carefully
                guarded screen in the system. */}
            <div className="mt-6">
              <ManualTranscript role={actualRole} />
            </div>
          </div>
        </div>
      )}
      {area === 'register' && (
        <div className="space-y-6">
          {/* §10. Beside the register because that is where a graduate's
              certificate is found, and a replacement is always a replacement
              OF something. */}
          <CertificateReissue />
          {/* SIGNING IS OPTIONAL AND FAILS SILENTLY BY DESIGN, which is right —
              and which means an operator who set the key wrongly gets a
              registry that looks entirely normal and signs nothing. The state
              is shown where the register is managed. */}
          <SigningStatus role={actualRole} />
          <CredentialAuthority role={actualRole} embedded />
        </div>
      )}
      {area === 'design' && <CredentialStudio embedded />}
      {/* THE CAPABILITY IS ASKED AGAIN HERE. `area` can only be 'specimens'
          when the tab was built, and building the tab already asked — but the
          two are far enough apart in this file that a later edit can separate
          them, and this is the restricted asset. */}
      {area === 'specimens' && maySeeTheDesign && <SpecimenGallery />}
    </div>
  );
}
