'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

// ---------------------------------------------------------------------------
// LIGHT, DARK, OR WHATEVER THE DEVICE SAYS.
//
// THREE STATES, NOT TWO. A plain toggle can only say "light" or "dark", so the
// moment a visitor touches it they have opted out of their operating system
// forever — including out of a schedule that dims at sunset. "System" has to be
// reachable, and it has to be the default.
//
// WHY THE CHOICE IS APPLIED BEFORE REACT RUNS. See the inline script in
// layout.tsx. If the class were added on mount, a visitor with dark mode set
// would get a full-brightness white page for one frame first — the flash of
// wrong theme — which at night is genuinely unpleasant and is the single most
// common way a dark mode is got wrong.
//
// WHY IT REMEMBERS. localStorage, not a cookie: the choice is a display
// preference belonging to one browser, it does not need to reach the server,
// and sending it on every request would put it in the cache key.
// ---------------------------------------------------------------------------

type Choice = 'light' | 'dark' | 'system';

const OPTIONS: { value: Choice; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

export function applyTheme(choice: Choice) {
  const dark =
    choice === 'dark' ||
    (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [choice, setChoice] = useState<Choice>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem('iguc-theme') as Choice | null) ?? 'system';
    setChoice(saved);
    setReady(true);

    // Follow the system while the visitor is on "system" — a laptop that dims
    // at sunset should dim this page too, without a reload.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if ((localStorage.getItem('iguc-theme') ?? 'system') === 'system') applyTheme('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function choose(next: Choice) {
    setChoice(next);
    localStorage.setItem('iguc-theme', next);
    applyTheme(next);
  }

  return (
    <fieldset
      className={`inline-flex items-center gap-0.5 rounded-full border border-white/20 p-0.5 ${className}`}
    >
      <legend className="sr-only">Colour theme</legend>
      {OPTIONS.map(({ value, label, Icon }) => {
        // Before hydration nothing is marked selected. Rendering a guess and
        // correcting it is worse than a half-second of neutrality: it shows the
        // wrong answer to everyone whose choice is not the default.
        const on = ready && choice === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={on}
            title={`${label} theme`}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition duration-300 ${
              on ? 'bg-brand-gold text-brand-purple-dark' : 'text-white/60 hover:text-white'
            }`}
          >
            <Icon size={13} aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </fieldset>
  );
}
