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
//   Specimens    anyone who can reach this screen. There is nothing in a
//                specimen to protect — that is the point of a specimen.
// ---------------------------------------------------------------------------

import React from 'react';
import { BadgeCheck, Palette, ShieldCheck, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import CredentialAuthority from '@/components/credentials/CredentialAuthority';
import CredentialStudio from '@/components/studio/CredentialStudio';
import SpecimenGallery from '@/components/studio/SpecimenGallery';
import { PageHeader } from '@/components/ui/portal';
import { FOCUS } from '@/lib/portalTheme';

type AreaId = 'register' | 'design' | 'specimens';

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

  const areas: Area[] = React.useMemo(() => {
    const list: Area[] = [];
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
    list.push({
      id: 'specimens',
      label: 'Specimens',
      icon: <BookOpen size={15} />,
      blurb: 'One certificate per level the University confers, in the wording each level requires.',
    });
    return list;
  }, [mayDesign, mayApprove, mayRegister]);

  // Land on the area this role is most likely to have come for: the register if
  // they hold it, otherwise their own work, otherwise the specimen book.
  const [area, setArea] = React.useState<AreaId>(areas[0]?.id ?? 'specimens');

  // A role change mid-session — the demo role switcher does exactly this —
  // could otherwise leave the shell showing an area the new role may not use.
  React.useEffect(() => {
    if (!areas.some((a) => a.id === area)) setArea(areas[0]?.id ?? 'specimens');
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

      {area === 'register' && <CredentialAuthority role={actualRole} embedded />}
      {area === 'design' && <CredentialStudio embedded />}
      {area === 'specimens' && <SpecimenGallery />}
    </div>
  );
}
