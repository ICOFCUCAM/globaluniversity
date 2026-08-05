import Image from 'next/image';

/**
 * Crest — the university seal inside a slowly rotating conic ring.
 *
 * The ring is a single conic-gradient masked to an annulus, turning once a
 * minute. At that speed it is not perceived as motion so much as presence:
 * the mark reads as lit rather than printed. The seal itself never rotates.
 */
export default function Crest({
  size = 44,
  ring = true,
  className = '',
  priority = false,
}: {
  size?: number;
  ring?: boolean;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {ring && (
        <span
          aria-hidden="true"
          className="absolute inset-[-3px] animate-crest rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(247,220,121,0.85) 70deg, rgba(233,193,74,0.35) 130deg, transparent 200deg, transparent 360deg)',
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))',
          }}
        />
      )}
      <Image
        src="/images/site-icon.png"
        alt=""
        width={size}
        height={size}
        priority={priority}
        className="relative rounded-full bg-white/90 p-0.5"
      />
    </span>
  );
}
