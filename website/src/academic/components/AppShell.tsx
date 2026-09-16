'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, BookOpen, GraduationCap, LayoutDashboard, ScrollText, Settings, Sparkles, UserRound , ArrowLeft } from 'lucide-react';
import type { Person } from '@/academic/lib/domain/types';
import { ROLE_LABEL, type Role } from '@/academic/lib/capabilities';
import { direction } from '@/academic/lib/i18n/languages';
import { translator, type UIKey } from '@/academic/lib/i18n/ui';

// ---------------------------------------------------------------------------
// WHAT EVERYBODY HAS, AND WHAT ONLY A TEACHER HAS.
//
// The University, 16 September 2026: "students don't make lectures. so some
// sections would not even be display to the student account."
//
// `Lectures` is the SUBMISSION and PIPELINE screen — write a lecture, upload a
// recording, run a transformation, approve what came back. A student does none
// of those, and showing them the door is worse than useless: it teaches them
// the Studio is something they have not understood, and every click ends in a
// refusal.
//
// WHAT A STUDENT READS IS INSIDE THEIR COURSES, which is where it belongs: the
// published notes, the fifteen-minute audio, the revision set, the reading
// list and the Course AI all hang off a course, not off a lecture they did not
// give.
//
// THIS IS NOT THE SECURITY. `ownership.ts` refuses a student every act on a
// lecture, and 092 refuses them in the database. This is about not offering a
// room nobody may enter — the same reasoning `canReadRecord` already applies
// to "Who did what".
// ---------------------------------------------------------------------------
const NAV = [
  { href: '/', key: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/academic-studio/courses', key: 'nav.courses', icon: GraduationCap },
  { href: '/academic-studio/notifications', key: 'nav.notifications', icon: Bell },
  { href: '/academic-studio/profile', key: 'nav.profile', icon: UserRound },
  { href: '/academic-studio/settings', key: 'nav.settings', icon: Settings },
] as const;

/** Submission and the pipeline. Not a student's, and not offered to one. */
const TEACHING_NAV = [
  { href: '/academic-studio/lectures', key: 'nav.lectures', icon: BookOpen },
] as const;

export function AppShell({
  actor, people, unread = 0, canReadRecord = false, children,
}: {
  actor: { id: string; role: Role; name: string; workingLanguage?: string };
  people: Person[];
  /** How many notifications are waiting. Shown on the bell, nowhere else. */
  unread?: number;
  /**
   * Whether "Who did what" is offered at all. A student who cannot read the
   * record is not shown a door that refuses them: the refusal exists in the
   * service, and the navigation should not advertise a room they may not
   * enter.
   */
  canReadRecord?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // THE CHROME IN THEIR LANGUAGE TOO. French notes under a navigation bar
  // reading "Lectures · Courses · Settings" is a strange thing to hand
  // somebody and call multilingual.
  const t = translator(actor.workingLanguage);
  const dir = direction(actor.workingLanguage ?? 'en');

  return (
    <div className="min-h-screen flex" dir={dir}>
      {/* ------------------------------------------------------------------
          THE PORTAL'S SIDEBAR, NOT THE STUDIO'S.

          The University, 16 September 2026: "opening the studio make one feel
          it is another site with different names. can you make it follow the
          same feelings like the others."

          It was a white sidebar with a blue mark and the words "Lecture
          Studio" — a different product's chrome, reached from inside the
          portal. The portal's own sidebar is deep purple with gold on the
          active row, so this is that: same ground, same active colour, same
          weights. Nothing here is a new design; it is the one next door.
          ------------------------------------------------------------------ */}
      <aside className="w-60 shrink-0 hidden md:flex md:flex-col bg-[#322244] text-white">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#e9c14a]" />
            <span className="font-semibold tracking-tight">Academic Studio</span>
          </div>
          {/* THE POSITIONING, AND IT IS ALSO THE ARCHITECTURE. Each clause is
              enforced somewhere: the lecturer owns the material, the model only
              transforms it, and what a student receives has a name on it. */}
          <p lang="en" dir="ltr" className="mt-1 text-[11px] leading-4 text-white/60">
            Lecturers teach. AI transforms. Students learn.
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {[
            NAV[0],
            // Submission sits directly after the dashboard for somebody who
            // teaches, and does not exist at all for somebody who does not.
            ...(actor.role === 'student' ? [] : TEACHING_NAV),
            ...NAV.slice(1),
            ...(canReadRecord
              ? [{ href: '/academic-studio/audit', key: 'nav.record' as const, icon: ScrollText }]
              : []),
          ].map(({ href, key, icon: Icon }) => {
            const label = t(key as UIKey);
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-white/10 font-semibold text-[#e9c14a]'
                    : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
                {href === '/academic-studio/notifications' && unread > 0 && (
                  <span className="ms-auto rounded-full bg-[#e9c14a] px-1.5 py-0.5 text-[10px] font-semibold text-[#322244]">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ----------------------------------------------------------------
            A WAY BACK.

            The Studio is a tree of real routes rather than a module in the
            portal's switch, so the portal's own sidebar disappears when you
            enter it — and without this the only way out is the browser's back
            button. That is most of what "it feels like another site" is: not
            the colours, the fact that you cannot get home.
            ---------------------------------------------------------------- */}
        <div className="border-t border-white/10 p-3">
          <Link
            href="/portal"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/65 hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to the portal
          </Link>
        </div>

        {/* NOT A LOGIN. The demonstration lets you look through each person's
            eyes, because the ownership rules are only convincing when you can
            watch them refuse you something. */}
        <div className="border-t border-studio-page-line p-3">
          <label className="block text-[11px] uppercase tracking-wide text-studio-ink-faint mb-1">
            {t('nav.viewingAs')}
          </label>
          <select
            // People's names, and role labels that are not translated: a
            // right-to-left select clips the beginning of a left-to-right
            // string, which is how "Joseph Adeyemi" arrives as "seph Adeyemi".
            dir="ltr"
            className="w-full rounded-md border border-studio-page-line bg-white px-2 py-1.5 text-sm"
            value={actor.id}
            onChange={(event) => {
              document.cookie = `academic_actor=${event.target.value}; path=/; max-age=31536000`;
              router.refresh();
            }}
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} — {ROLE_LABEL[person.role]}
              </option>
            ))}
          </select>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
