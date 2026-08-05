// Atmosphere — the environmental layer behind dark bands.
//
// Three composable primitives that give the site its own optical signature
// instead of the flat scrims every university template ships with. All three
// are pure CSS: no canvas, no WebGL, no library, nothing to hydrate. They
// animate only `transform` and `opacity`, so they stay on the compositor, and
// the global prefers-reduced-motion rule in globals.css freezes them.

type Tone = 'purple' | 'gold' | 'dual';

/**
 * Aurora — slow-drifting radial colour fields. Reads as light moving through
 * a hall rather than as a gradient overlay.
 */
export function Aurora({
  tone = 'dual',
  intensity = 1,
  fields = 3,
  className = '',
}: {
  tone?: Tone;
  intensity?: number;
  /** Drop to 2 on secondary bands — each field is a separately blurred layer. */
  fields?: 2 | 3;
  className?: string;
}) {
  const colors =
    tone === 'gold'
      ? ['rgba(247,220,121,0.30)', 'rgba(233,193,74,0.22)', 'rgba(247,230,180,0.16)']
      : tone === 'purple'
        ? ['rgba(87,84,154,0.42)', 'rgba(66,46,89,0.34)', 'rgba(179,162,207,0.20)']
        : ['rgba(87,84,154,0.40)', 'rgba(247,220,121,0.20)', 'rgba(179,162,207,0.22)'];

  // content-visibility lets the browser skip painting — and therefore skip
  // animating — these layers entirely while the band is off-screen. Without
  // it every aurora on the page composites on every frame, all the way down.
  const skipOffscreen = {
    contentVisibility: 'auto',
    containIntrinsicSize: '1px 600px',
  } as React.CSSProperties;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={skipOffscreen}
    >
      <div
        className="absolute -left-[15%] -top-[30%] h-[75%] w-[65%] animate-aurora-a rounded-full blur-[80px] will-change-transform"
        style={{ background: colors[0], opacity: intensity }}
      />
      <div
        className="absolute -right-[12%] top-[10%] h-[70%] w-[55%] animate-aurora-b rounded-full blur-[88px] will-change-transform"
        style={{ background: colors[1], opacity: intensity }}
      />
      {fields === 3 && (
        <div
          className="absolute bottom-[-25%] left-[25%] h-[65%] w-[60%] animate-aurora-c rounded-full blur-[92px] will-change-transform"
          style={{ background: colors[2], opacity: intensity }}
        />
      )}
    </div>
  );
}

/**
 * Grain — a single inline SVG fractal-noise tile, tiled by the browser.
 * Roughly 300 bytes, and it is what stops large flat colour fields from
 * banding on cheap panels. Also the difference between "rendered" and "shot".
 */
export function Grain({ opacity = 0.055 }: { opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 mix-blend-overlay"
      style={{
        opacity,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.9'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

/**
 * LightShaft — angled volumetric beams, as through a clerestory window.
 * Used sparingly: the hero and one interior band, never more.
 */
export function LightShaft({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 600px' } as React.CSSProperties}
    >
      {[
        { left: '12%', w: '9rem', delay: '0s', o: 0.11 },
        { left: '67%', w: '12rem', delay: '-8s', o: 0.09 },
      ].map((s) => (
        <div
          key={s.left}
          className="absolute -top-1/4 h-[150%] animate-shaft origin-top"
          style={{
            left: s.left,
            width: s.w,
            animationDelay: s.delay,
            background: `linear-gradient(to bottom, rgba(247,220,121,${s.o}), transparent 72%)`,
            filter: 'blur(16px)',
            transform: 'rotate(14deg)',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Seam — the transition between two bands. A hairline that brightens toward
 * the centre, so sections read as joined panels rather than stacked blocks.
 */
export function Seam({ flip = false }: { flip?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 h-px ${flip ? 'bottom-0' : 'top-0'}`}
      style={{
        background:
          'linear-gradient(90deg, transparent, rgba(247,220,121,0.05) 15%, rgba(247,220,121,0.45) 50%, rgba(247,220,121,0.05) 85%, transparent)',
      }}
    />
  );
}
