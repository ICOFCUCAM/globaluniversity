// Line icons drawn to one spec — 24px box, 1.5 stroke, round caps — so the
// home page reads as a designed system rather than a run of emoji.
// currentColor throughout, so they take the surrounding text colour.

type P = { className?: string };

const base = 'h-full w-full';
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Svg({ className, children }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? base} {...stroke}>
      {children}
    </svg>
  );
}

export function IconCalendar(p: P) {
  return (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
    </Svg>
  );
}

export function IconBook(p: P) {
  return (
    <Svg {...p}>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10a3 3 0 0 1 2 5.2V21a3 3 0 0 0-2-.8H5.5A1.5 1.5 0 0 1 4 18.7Z" />
      <path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H14a3 3 0 0 0-2 5.2V21a3 3 0 0 1 2-.8h4.5a1.5 1.5 0 0 0 1.5-1.5Z" />
    </Svg>
  );
}

export function IconAward(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.5 13.8 7 22l5-2.6L17 22l-1.5-8.2" />
      <path d="m12 6.6.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9.1 8.8l2-.3Z" />
    </Svg>
  );
}

export function IconLaptop(p: P) {
  return (
    <Svg {...p}>
      <rect x="4" y="4.5" width="16" height="11" rx="2" />
      <path d="M2 19h20M9.5 19l.5-1.5h4l.5 1.5" />
    </Svg>
  );
}

export function IconLibrary(p: P) {
  return (
    <Svg {...p}>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 10.5V19M9.7 10.5V19M14.3 10.5V19M19 10.5V19" />
      <path d="M3 19h18M4 22h16" />
    </Svg>
  );
}

export function IconMail(p: P) {
  return (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7.5 7.2 5a2.2 2.2 0 0 0 2.6 0l7.2-5" />
    </Svg>
  );
}

export function IconGlobe(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
    </Svg>
  );
}

export function IconCampus(p: P) {
  return (
    <Svg {...p}>
      <path d="M4 21V9.5L12 4l8 5.5V21" />
      <path d="M2.5 21h19" />
      <path d="M9.5 21v-5.5h5V21" />
      <path d="M8 11h.01M16 11h.01" />
    </Svg>
  );
}

export function IconChapel(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 2v5M9.5 4.2h5" />
      <path d="M5 21V11l7-4 7 4v10" />
      <path d="M3 21h18" />
      <path d="M10 21v-4.5a2 2 0 0 1 4 0V21" />
    </Svg>
  );
}

export function IconSignal(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4" />
      <path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2" />
    </Svg>
  );
}

export const quickIconMap = {
  calendar: IconCalendar,
  book: IconBook,
  award: IconAward,
  laptop: IconLaptop,
  library: IconLibrary,
  mail: IconMail,
} as const;
