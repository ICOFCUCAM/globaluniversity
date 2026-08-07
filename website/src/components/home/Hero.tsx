import { publicCrest } from '@/lib/publicCrest';
import { UNIVERSITY } from '@/lib/constants';
import HeroCopy from './HeroCopy';

// ---------------------------------------------------------------------------
// THE HERO.
//
// ===========================================================================
// WHY THERE IS NO PHOTOGRAPH HERE AT ALL
// ===========================================================================
//
// The first version stretched a photograph across the full width. The second
// kept one in a contained 440px frame. Both were judged poor, and the audit
// says why: the photography cannot carry a hero.
//
//   home-hero.jpg      972 × 729
//   global.jpg         972 × 729
//   students.jpg       968 × 648
//   every 2024 graduation photograph      1080 × 720
//
// Of ninety-seven photographs in this repository, THREE exceed 1600px wide, and
// two of those three are unusable for reasons worse than resolution:
// landing-bg.jpg is stock — hands on a laptop, nowhere in particular — and
// wp/footer-building.jpg is a CAMBRIDGE COLLEGE, an English quadrangle that sat
// in this university's asset folder and on its footer.
//
// Shrinking the frame fixed the sharpness and did not fix the picture. A single
// graduand photographed indoors on a phone, looking down, is a record of an
// occasion. It is not an image an institution leads with, and no crop makes it
// one. The honest conclusion is that this university does not yet own a
// photograph worth putting at the top of its front page.
//
// ===========================================================================
// WHAT IT LEADS WITH INSTEAD
// ===========================================================================
//
// Its own crest — src/lib/publicCrest.ts. Vector, so it is exact at any size on
// any display; a few kilobytes; and the one visual this institution
// unambiguously owns.
//
// A university leading with its own mark rather than with a photograph is not a
// compromise. It is what Oxford, Bologna and Salamanca did for several hundred
// years, and it is what a certificate does today: when an institution has
// something to attest, it puts its mark on it.
//
// ===========================================================================
// AND WHY IT IS *NOT* THE CERTIFICATE'S DEVICE
// ===========================================================================
//
// For one commit it was, and that was wrong. The device from credentialArt.ts is
// the figure struck on every certificate this university issues, and putting it
// on the homepage as INLINE SVG hands it over: select, copy, paste, and a forger
// has the university's engraving at unlimited resolution, exact to the last
// control point, without tracing a single curve. A photograph of a seal has to
// be redrawn. An SVG of one does not.
//
// So the public crest is a different drawing, and the differences are the parts
// that matter — no microtext, no guilloché, no holder ring, no meridian web.
// src/lib/publicArt.test.mjs fails the build if anything under a public route
// imports credentialArt again, because this is exactly the sort of decision a
// later redesign undoes by accident.
//
// WHEN THE PHOTOGRAPHS ARRIVE. One commissioned session — campus, classroom,
// library, faculty teaching, shot at 3000px or wider — and a photograph can
// take the right-hand side back. Until then this is stronger, and it is honest.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SERVER COMPONENT
//
// The crest is pure and deterministic, so it runs ONCE here, on the server, and
// emits a string of SVG. Only the rotating headline is client code — see
// HeroCopy.tsx. Shipping a drawing routine to the browser to produce something
// that never changes is bundle weight spent on the first paint of the busiest
// page on the site.
// ---------------------------------------------------------------------------

const CREST = publicCrest({
  size: 600,
  colour: '#f7dc79',
  name: UNIVERSITY.name.toUpperCase(),
  // The motto is set in readable gold capitals in the column beside this, so
  // repeating it round the band would say the same thing twice. The founding
  // year is the one fact the mark can carry that the copy does not.
  footer: `FOUNDED ${UNIVERSITY.established}`,
  id: 'hero-crest',
});

export default function Hero() {
  return (
    <section
      data-on-dark=""
      aria-label="ICOF Global University"
      className="relative isolate overflow-hidden bg-brand-purple-dark text-white"
    >
      {/* ---- the engraved ground, entirely vector ------------------------ */}
      <div aria-hidden="true" className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.30]"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 120% 90% at 20% 14%, rgba(120,102,186,0.55), transparent 60%),'
              + 'radial-gradient(ellipse 100% 80% at 84% 82%, rgba(233,193,74,0.18), transparent 62%),'
              + 'radial-gradient(ellipse 90% 70% at 58% 8%, rgba(64,44,104,0.9), transparent 70%)',
          }}
        />
        {/* Engine-turned rules — the ground the certificate is printed on. */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'repeating-linear-gradient(104deg, #f7dc79 0 1px, transparent 1px 22px)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'repeating-linear-gradient(-104deg, #f7dc79 0 1px, transparent 1px 30px)' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(75%_60%_at_16%_0%,rgba(255,255,255,0.10),transparent_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-brand-purple-dark" />
      </div>

      {/* ---- vertical scale is tied to the VIEWPORT HEIGHT, not just its width
          A fixed py-32 with a 5.2rem headline made this hero 1039px tall. On a
          1280x800 laptop — an ordinary machine, not a small one — that put both
          call-to-action buttons entirely below the fold. The page looked
          handsome and asked for nothing, which is the most expensive kind of
          handsome a homepage can be.
          So the padding, the headline and the crest all clamp against vh as
          well as vw. On a tall display nothing changes; on a short one the
          whole thing compresses until "Begin Your Application" is above the
          fold, which is the one element that has to be. */}
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-[clamp(2.75rem,7vh,7.5rem)] sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,480px)] lg:gap-16">
        <HeroCopy />

        {/* ---- the crest --------------------------------------------------
            Decorative: everything it says — the university's name, the founding
            year — is set in readable type in the column beside it, so a screen
            reader that announced the figure would be reading the same words a
            second time.

            ON A PHONE IT IS A MASTHEAD, NOT A FIGURE. Left at full width it
            became a 390px disc below the buttons: four hundred pixels of
            scrolling between the call to action and the first real content,
            spent on something the reader had already looked at. So on narrow
            screens it moves ABOVE the copy at a modest 200px, where a crest
            over a name is the oldest masthead there is, and only becomes the
            right-hand subject once there is a column to put it in. */}
        <div
          aria-hidden="true"
          className="relative order-first mx-auto w-full max-w-[200px] lg:order-none lg:max-w-[min(520px,58vh)]"
        >
          {/* The dark disc the device is struck on. Gold hairlines on a
              mid-purple field have very little to push against; dropping the
              ground beneath them by a couple of stops is what turns a wire
              drawing into an engraving. It is also why a wax seal is darker
              than the paper it sits on. */}
          <span
            className="absolute inset-[2%] rounded-full"
            style={{
              background:
                'radial-gradient(circle at 50% 46%, rgba(24,12,44,0.92) 0%, rgba(29,16,52,0.78) 52%, rgba(43,28,70,0.22) 78%, transparent 88%)',
            }}
          />

          {/* A slow counter-rotation of the outer glow only. The device itself
              never turns: a crest that spins is a logo animation, and this is a
              seal. */}
          <span
            className="absolute inset-[6%] animate-crest rounded-full opacity-50 blur-2xl"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(247,220,121,0.5) 90deg, rgba(120,102,186,0.55) 200deg, transparent 300deg)',
            }}
          />

          {/* The bloom — one wide, low-opacity shadow, the way struck foil
              catches light at its edges.
              The earlier version stacked a tight 1px shadow under this one to
              thicken hairlines. The crest is drawn in solid forms and heavy
              rules, so there are no hairlines left to thicken and the tight
              shadow only furred the lettering. */}
          <div
            className="relative [&>svg]:h-auto [&>svg]:w-full"
            style={{ filter: 'drop-shadow(0 0 18px rgba(233,193,74,0.20))' }}
            dangerouslySetInnerHTML={{ __html: CREST }}
          />
        </div>
      </div>

      {/* ---- NO SCROLL CUE, AND WHY ---------------------------------------
          A bouncing chevron was built here and then taken out again. The
          quick-links nav below the hero is pulled up over this edge with
          -mt-14, so it already breaks the hero's bottom boundary — the reader
          can see content continuing under the fold, which is the only thing a
          scroll cue is for. The chevron sat underneath that nav, covered, doing
          nothing. Two affordances for one job, and the weaker one on top. */}
    </section>
  );
}
