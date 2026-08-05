# ICOF Global University — home page design system

The visual language introduced in commits 39–77 of the Vercel migration. It
exists so the home page reads as one designed object rather than a stack of
template sections, and so the next person to touch it knows which lever to pull.

Everything here is CSS. There is no animation library, no canvas, no WebGL and
no third-party design dependency. The whole system adds four small components
and a handful of keyframes.

---

## Principles

1. **Light, not decoration.** The brand's two colours — purple `#422e59`, gold
   `#f7dc79` — are used as light sources: fields that drift behind bands, rims
   that ignite on hover, gradients clipped to letterforms. They are not used as
   flat fills behind boxes.
2. **Motion earns its place.** Every animation is transform or opacity only, so
   it stays on the compositor. Reveals complete inside ~600ms. Ambient loops run
   at 18–60s, slow enough to register as presence rather than movement.
3. **Nothing is hidden from the machine.** Kinetic headings keep every word as
   real text. Decorative layers are `aria-hidden`. Duplicated marquee items are
   removed from the tab order.
4. **It must degrade.** `prefers-reduced-motion` freezes everything. Touch
   devices skip pointer effects. Browsers without `backdrop-filter` get opaque
   surfaces, not unreadable ones.

---

## Components

| Component | What it does | Where |
|---|---|---|
| `Atmosphere.tsx` | `Aurora`, `Grain`, `LightShaft`, `Seam` — the environmental layer behind dark bands | every dark band |
| `KineticText.tsx` | Headings that assemble word by word from beneath their baseline | section headings, CTA |
| `Spotlight.tsx` | `SpotlightGroup` / `SpotlightCard` — cursor-tracked illumination across a card grid | all nine card grids |
| `Magnetic.tsx` | Controls that lean toward an approaching cursor | hero and CTA buttons |
| `Crest.tsx` | The seal inside a slowly rotating conic ring | header, footer |
| `CountUp.tsx` | Figures that count up when scrolled into view | statistics |
| `ScrollRail.tsx` | Live chapter index down the right edge | home page |
| `ProgramRibbon.tsx` | Counter-travelling bands of real program names | between programs and research |
| `Icons.tsx` | Ten line icons, 24px box, 1.5 stroke, `currentColor` | quick links, footprint |

## Tokens

- **Type**: `text-display-sm | display | display-lg | display-xl` — `clamp()`
  scales, no breakpoint jumps. Set the floor for phones, the ceiling for desktop.
- **Elevation**: `shadow-lift`, `shadow-lift-lg`, `shadow-gold`.
- **Motion**: `animate-aurora-a|b|c`, `ken-burns`, `orbit`, `crest`, `ring-in`,
  `shaft`, `marquee`, `marquee-rev`, `sheen`.
- **Utilities** (`globals.css`): `.tabular` for aligned figures, `.rule-gold`
  for the section rule, one gold `:focus-visible` ring site-wide.

---

## Rules learned the hard way

Each of these caused a visible defect that a green build did not catch. They
are recorded because they will recur.

- **Atmosphere goes under the scrim, never over it.** `Aurora`'s purple field
  (`#57549a`) is *lighter* than `brand-purple-dark`. Mounted after the darkening
  overlay it washes the band out. Order: photograph → atmosphere → scrim →
  content. (commit 76)
- **`background-clip: text` cannot cross into `KineticText`.** The words live in
  child inline-blocks, outside the parent's background box, so the glyphs render
  transparent over nothing. Use the `wordClassName` prop. (commit 76)
- **`opacity-0` is not enough to hide a slide.** Add `invisible` and pin it with
  explicit insets, or it paints for a frame before hydration settles. (commit 49)
- **A floated quotation mark only re-flows two lines.** Position it. (commit 49)
- **`data-*` on a React component is dropped.** `Section` needed a real
  `chapter` prop; the first attempt emitted 4 of 14 markers. (commit 66)
- **Only one `h1` per document.** Moving hero copy out of the fading frames
  silently produced four. (commit 58)
- **Blurred layers composite even when off-screen.** Every `Aurora` and
  `LightShaft` wrapper carries `content-visibility: auto`. (commit 75)

---

## Verifying a change

The build passing means almost nothing here. Screenshot the built page:

```bash
npm run build && npm start -- -p 3123
# then drive Playwright against localhost:3123
```

Check, at minimum: no horizontal overflow at 390 / 768 / 1440; exactly one
`h1`; zero emoji in the built HTML; zero animations running under
`reducedMotion: 'reduce'`; and every `[data-kw]` settled at `translateY(0)`.
