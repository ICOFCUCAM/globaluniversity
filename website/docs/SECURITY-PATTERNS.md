# The Security Patterns of ICOF Global University

*Specification of the named artwork on the university's credentials — for the
Registry, for print suppliers, and for anyone asked in ten years whether a
document presented to them is genuine.*

---

## Why this document exists

An unnamed pattern cannot be ordered from a printer, cited in a verification
procedure, or defended if somebody copies it. "The background" is not a thing
anyone can point at. **"The ICOF Globe Guilloché™, at 30% strength, in brand
purple #422e59"** is an instruction a print shop can follow and a registrar can
check against.

It is also how a security scheme outlives the person who designed it. The
question in ten years will be *"is this the real pattern?"*, and the answer must
live somewhere other than in one designer's memory.

---

## The layers, outside in

| Layer | Name | Role |
|---|---|---|
| 1 | **The ICOF Security Border™** | Border pattern |
| 2 | **Microtext Security Layer** | Hidden authentication |
| 3 | **Fine-Line Guilloché Mesh** | Background linework |
| 4 | **The ICOF Globe Guilloché™** | Primary security pattern — central watermark |
| 5 | **Embossed University Seal** | Official seal (applied by hand) |
| 6 | **UV Security Pass** | Invisible layer, printed copies only |
| 7 | **ICOF Credential Seal** | Cryptographic authentication |

Layers 1–6 are what a reader sees and feels. **Layer 7 is the one that decides
authenticity.** Everything above it exists to make the absence of a check
conspicuous — to raise the cost of a casual forgery and give a registrar
something concrete to look at. None of layers 1–6 stops a determined forger with
a good scanner. Nothing printed does.

---

## 1. The ICOF Globe Guilloché™

**Primary security pattern. The central watermark on every credential.**

The university's composed device, built outside in:

- a **microtext ring** carrying the name, the descriptor and the motto;
- a **register of Central African geometric ornament** — interlocking lozenges,
  nested chevrons, triangle registers, set radially;
- **twelve nodes joined by chords** — the faculties, and the network between
  them;
- **laurel sprigs** at the four cardinal points;
- **the world**, as a flat map on the azimuthal equidistant projection — the
  one on the United Nations emblem — cut at 60°S, with 20°E running straight
  down so Africa sits at the foot;
- **the holder's own ring** — their name and credential number in microtext,
  repeated to fill the circumference;
- the **year of foundation** in roman;
- the **faculty's emblem**.

Seeded from the credential number, so no two documents carry the same figure.
20°E is straight down on every one, so the face of the earth is constant.

### Why the map is flat and not a globe

The projection is **circular by construction** — the pole is the centre, every
meridian a straight radius, every parallel a concentric circle — so it fills a
roundel without a single coastline cropped. A rectangular map squeezed into the
same circle loses its corners, which are Alaska and New Zealand, and a map that
cuts off land to fit its frame reads as a mistake.

It is also the **better security figure**. Its parallels are true circles and
its meridians true radii at even spacing: that is engine-turning, and a hand
copy of it goes wrong at every crossing at once. A sphere's meridians are
ellipses of continuously varying eccentricity, and a hand copy of those drifts
slowly and forgivingly.

### How it is engraved

A flat tint inside an outline reads as a diagram — nobody has ever drawn a map
that way with a burin, and the eye knows it. Two conventions older than printing
are what make an engraved map look like a map:

**Hatching.** The land is not a colour but a texture: close parallel lines cut
at one constant angle, dense enough to read as tone across a room and separable
into lines under a loupe. That is precisely the property a security ground
needs, so it is not decoration bought at a cost.

**Water-lines.** Two or three lines following each coast a little way out, each
fainter than the last. It is what makes a coastline read as a shore rather than
a border, and it is the strongest single signal that a map was drawn rather than
generated. The offsets are true vertex-normal offsets, not the ring scaled about
its centroid — scaling looks right on a circle and wrong on everything else, and
on Eurasia it would push the Atlantic coast out by a centimetre and the
Kamchatka coast by a millimetre.

It is **cut at 60°S**, as the UN emblem is, because on this projection the South
Pole is not a point but the entire outer rim — Antarctica can only be drawn as a
smear round the edge of the disc.

`security.world: 'globe'` restores the orthographic sphere, which shows one
hemisphere and hides the other.

### The holder's ring

Set inside the institutional legend and inside the African register, so the
figure reads outside in: **the university, its ornament, then the person.**

This is the only element of the device that differs between two certificates of
the same award. Everything else is identical on every document the university
issues — which means a device lifted from a genuine scan is a valid device for
any forgery built on it. A ring carrying the holder's name is not: the lifted
ring brings the original holder's name into the copy, where a registrar
comparing it against the conferral printed over it will find the two
disagreeing.

**It is repeated to fill the circumference**, not written once. A legend that
runs a third of the way round and stops looks like a caption; repeated, it is a
course of microtext, which is what it is for. The repeat count is computed from
the measure so the ring is full at any diameter — a fixed count would crowd at
one size and leave a gap at another, and a gap in a microtext course is exactly
where a forger's join would hide.

*Set in Studio → Security features → The holder's ring.
`CredentialDesign.security.holderRing`.*

### Four levels of elaboration, by award

| Award | Tier | What is added |
|---|---|---|
| Diploma, certificate | `standard` | Ring, register, globe, the twelve nodes and their chords |
| Bachelor's | `elaborate` | + an inner guilloché collar |
| Master's | `full` | + radiating rays behind the whole figure |
| Doctorate | `supreme` | + a second register of ornament outside the first |

The university's highest award is recognisable as its highest award from across
a room, before a word of it is read. It is the same device throughout, so the
identity holds and only the elaboration changes.

**The ladder starts at the certificate, not below it.** There was a fifth tier
under this one — a bare ring round a globe — and it was removed. The lowest
award the university confers is still one of its awards, and a plain ring is
what every certificate generator on the internet produces: starting there meant
the diploma looked like a template and only the doctorate looked like an
instrument. The floor is now what used to be the middle.

### The band round it

**The ICOF Globe Guilloché™ in Academic Rosette** — the default, and what the
certificate carries.

Two counter-rotated bands of engine-turning surround the device, and the device
is set at 0.66 inside them. The band was on the old watermark and it was the
good part of it: it is what makes a sheet read as a security document at arm's
length. What sat inside it was a stock wireframe globe that said nothing about
this institution, and that is what the device replaces.

The band is the setting; the device is what is set in it. At 0.62 with the band
at 55% strength the engine-turning swamped the figure and the device read as a
detail caught in a web — the eye has to land on the device first.

*Implementation: `deviceInRosette()`. Set `watermark: 'device'` for the device
without the band.*

### Five silhouettes

The tier says how much is worked into the figure. The **silhouette** says what
shape it is struck in, and the two are independent — a certificate and a
doctorate in the same silhouette are one figure at two levels of work.

| Style | What it is |
|---|---|
| **`seal`** | **The university's silhouette.** A struck medallion. The classical answer, chosen from all five drawn on a real certificate. |
| `cartouche` | An engraved oval, as on a bookplate or a share certificate. |
| `shield` | An escutcheon with a chief. The most heraldic, and read as arms before anything on it is legible. |
| `radiant` | Open rather than closed — the rays run past any boundary, so there is no edge for the eye to stop at. |
| `panel` | A banknote vignette: a lozenge of interlace across the width, not a roundel in the middle. |

A closed circle is the obvious form and not automatically the best one. It reads
as a rubber stamp, it repeats the roundness of the QR at the other end of the
sheet, and on a landscape certificate it sits in the middle while both wide
margins do nothing.

*Set in Studio → Security features → Silhouette. `CredentialDesign.security.deviceStyle`.*

### On the African ornament, and what it deliberately is not

The classical rosette is a European engraving tradition — what a Swiss security
printer draws, and what every certificate template on the internet borrows.
Using it as the sole ornament on the credential of this university means the
decoration comes from one continent and the identity from another.

The register is built from the geometric vocabulary that Central and West
African textile and architectural ornament shares.

**It reproduces no specific motif, and that is deliberate.** Adinkra glyphs,
kente patterns and Bamileke wall figures carry meaning, ownership and in some
cases sacred use. Lifting one to decorate a degree certificate would be taking
something that is not the university's to take, and doing it in the name of
authenticity. A geometric family is common property. A symbol is not.

*Implementation: `src/lib/credentialArt.ts` — `africanGlobeOfKnowledge()`*

---

## 2. The ICOF Academic Rosette™

**Alternative central watermark.**

Three counter-rotated bands of hypotrochoids over a 180-spoke radial ground —
the engine-turning used on banknotes and share certificates.

The petal count must be a whole number or the curve never closes and the figure
degenerates into a starburst. One curve is not a rosette: what makes engine
turning look the way it does is a stack of the same curve with the pen offset
stepped each time, so the curves interfere.

**Defends against** hand reproduction: every crossing is determined by the
equation, so a drawn copy goes wrong everywhere at once rather than in one
visible place.

It is the classical figure, it is not specific to this university, and that is
why it is the alternative rather than the default.

*Implementation: `guillocheRosette()`*

---

## 3. The ICOF Security Border™

**Border pattern.**

An engraved gilt frame: an outer fillet, a scroll-and-leaf course, a bead rule,
and a medallion at each corner, over a three-stop gradient. Redrawn as vector
geometry from the university's own first certificate of 2011 — not traced from a
photograph of it.

The gold is three stops rather than a flat fill because **gilt is a gradient**.
That is why a photocopy of a gilded certificate looks obviously wrong: the
copier renders the gradient as one muddy tone.

*Implementation: `ornateFrame()`*

---

## 4. Fine-Line Guilloché Mesh

**Background linework — the paper itself.**

A lattice of fine waves with a miniature globe and the university's initials
worked into every tile, repeated across the sheet.

**Defends against** copying and scanning. Photocopiers dither fine regular
patterns badly, so a copy shows moiré where the original shows an even ground.
Under a loupe the tile resolves into hundreds of small globes.

*Implementation: `securityGround()`*

---

## 5. Microtext Security Layer

**Hidden authentication.**

A rule that is really a line of 1.9pt type, carrying the university's name, its
descriptor, its motto, and **this credential's own number**, repeated the width
of the sheet.

**Defends against** passing a copy as an original. It is legible under a loupe
and reduces to a grey smear on any photocopy or phone photograph. Because it
carries the credential number, a band lifted from a genuine scan carries the
original's number into the forgery.

*Implementation: `microtextBand()`*

---

## 6. Embossed University Seal

**Official seal — applied by hand, to the hard copy.**

A red foil wafer. The document leaves a clear disc in the middle of the foot for
it: no text, no watermark, no ground, no keyline. **A wafer pressed over printed
artwork sits proud of it and shows a halo of whatever was underneath.**

**What this layer defends against on its own: nothing.** Relief is felt, not
printed. Software cannot produce it and this system does not pretend to — what
it supplies is correctly registered clear space and the artwork for the wafer.
The security is in the physical application, which is the university's to do.

### Where the clear space is

| Setting | What the document leaves |
|---|---|
| `reserved` | A plain clear disc, 36 mm, centred in the foot. Correct, and it reads as an omission until the seal is on it. |
| `device` | **The seal takes the globe's place.** The university's device is struck small at the foot — ring, register, network, laurel, all of it — with the world removed from its middle and a collet struck where it was. The wafer is affixed at the heart of the university's own figure. |
| `printed` | The wafer is drawn. For a copy that will never be sealed by hand — an electronic duplicate, or a specimen. |

On `device` the seat is **44 mm mount, 30 mm clear**, and the mount is drawn
larger in the middle than the globe it replaces: a globe is a subject the
ornament surrounds, a seat is a fitting the ornament must clear.

```
Layer 5 (seal), sealPlacement: device
                 Mount 44 mm, struck. Clear seat 30 mm at its centre.
                 DO NOT PRINT INTO THE SEAT. The collet is the register mark.
```

*Implementation: `waferSeal()`; `CredentialDesign.sealPlacement`*

---

## 7. UV Security Pass

**Invisible layer. Printed copies only.**

Artwork for a second pass in fluorescent ink, supplied as a **separate file** for
the print shop. Black in that file means ink; it carries no visible-pass artwork.

There is **no UV toggle in the Studio and there should not be.** A browser cannot
emit invisible ink and no screen effect is equivalent to it. A switch would imply
the university produces something it does not. It is a specification for
somebody else's machine, and it is offered as a download.

*Implementation: `uvLayerSvg()`; Studio → Printing*

---

## 8. ICOF Credential Seal

**Cryptographic authentication. This is the control that decides.**

An HMAC-SHA256 over the award's canonical particulars, keyed with
`CREDENTIAL_SECRET` — a secret only the university holds — printed as a
twelve-character code and encoded in the QR beside it.

- Alter any sealed particular and the code stops matching.
- The **credential register** behind it says whether the document was ever
  issued, and whether it still stands.
- A credential absent from the register was never issued, whatever it is signed
  with.

The alphabet omits I, L, O and U, because the code is read aloud down a telephone
line and 0/O and 1/I/L is where that goes wrong.

**The QR carries the credential number alone**, not the signed payload. The full
payload encodes as an 87-module symbol, which at the 24mm a certificate can spare
is 0.25mm a module — under the ~0.5mm a phone camera needs off paper. Short, it
is 35 modules and 0.69mm, and it scans.

*Implementation: `src/lib/documentSecurity.ts`;
`docs/migrations/004_credential_register.sql`*

---

## Ordering from a printer

A complete specification for a commercial run:

```
Stock            A4, 297 × 210 mm landscape, cream, minimum 160 gsm
Bleed            3 mm all sides, trim marks supplied in the bleed
Colours          Brand   #422e59
                 Accent  #c5a55a  (frame, rules — gilt gradient, do not flatten)
                 Ink     #241c30
                 Paper   #fffdf5
Layers 1–5       Supplied in the visible-pass artwork
Layer 6 (UV)     Separate file — Studio → Printing → Download UV artwork
Layer 5 (seal)   Clear disc, 36 mm diameter, centred in the foot.
                 DO NOT PRINT INTO IT. The university applies a red foil wafer.
Backgrounds      Must print. The artwork sets print-color-adjust: exact;
                 confirm the RIP is not dropping background layers.
```

---

## On the ™ symbol

It is used here as a **claim of use**, which is what ™ means and all it means.
Anyone may apply it to a mark they are using in trade, without registration.

It is **not ®**, which may only be used for a mark actually registered with an
intellectual-property office. Using ® without a registration is an offence in
most jurisdictions.

If the university wants the stronger protection it must register these names.
Until it does, ™ is the honest symbol and the only one that should appear on
these patterns or in any document describing them.

### What is actually protectable

| | |
|---|---|
| **The names** | As trade marks — once used, and properly once registered. |
| **The artwork** | As copyright, automatically, from the moment it was drawn. |
| **The mathematics** | Not protectable, and never has been. A hypotrochoid is a hypotrochoid. |

That last row is worth sitting with rather than working around. The protection
that matters is **layer 7** — the credential register — which no amount of
copying the pattern gets anybody past.
