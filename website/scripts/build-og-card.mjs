// ---------------------------------------------------------------------------
// BUILD THE SOCIAL CARD.
//
//   npm run build            (once, so the fonts exist in .next/static/media)
//   node scripts/build-og-card.mjs
//   -> public/images/og-home.jpg   1200x630
//
// ===========================================================================
// WHY THIS EXISTS
// ===========================================================================
//
// The homepage had no og:image at all. Every share — WhatsApp, LinkedIn,
// Facebook, Slack, iMessage — rendered as a bare grey card with a title and a
// URL. On a site whose entire redesign is an argument about photography, the
// one picture most people saw first was no picture.
//
// twitter:image did exist, pointing at a 960x720 congregation photograph. That
// is 4:3 against the 1.91:1 every platform crops to, so the top and bottom were
// sliced off wherever the platform chose and nobody controlled what survived.
//
// ===========================================================================
// COMPOSED, NOT CROPPED
// ===========================================================================
//
// A photograph cropped to 1200x630 is a photograph with its head cut off. A
// social card is a piece of design with a fixed frame, and it should be laid
// out for that frame: the conferral photograph on the left with the crest over
// it, the university's purple on the right carrying the name, a gold rule and
// one line of substance.
//
// IT IS GENERATED, NOT DRAWN BY HAND. The fonts come from .next/static/media —
// the actual Fraunces and Inter files next/font downloaded for the site, so the
// card is set in the same faces as the page rather than in a lookalike. The
// colours are the palette's own hexes. Re-run this after a change to either and
// the card follows; hand-made in an image editor it would be stale within a
// month and unrebuildable within a year.
//
// deviceScaleFactor 2, so the file is 2400x1260 and stays sharp on the retina
// displays most people preview links on.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MEDIA = '.next/static/media';

if (!existsSync(MEDIA)) {
  console.error(`No ${MEDIA}. Run \`npm run build\` first — the fonts are downloaded by next/font at build time.`);
  process.exit(1);
}

const fonts = readdirSync(MEDIA).filter((f) => f.endsWith('.woff2'));
const dataUri = (path, mime) => `data:${mime};base64,${readFileSync(path).toString('base64')}`;

const photo = dataUri('public/images/graduation-2024/grad-conferral-handshake.jpg', 'image/jpeg');
const crest = dataUri('public/images/site-icon.png', 'image/png');

// Every face is declared and the stack tries them in order. Which hashed file
// is the serif is not knowable from the filename, and guessing would be a
// silent failure — a card set in the fallback that still looks plausible.
const faces = fonts
  .map((f, i) => `@font-face{font-family:'F${i}';src:url(${dataUri(`${MEDIA}/${f}`, 'font/woff2')}) format('woff2');font-display:block}`)
  .join('');
const stack = fonts.map((_, i) => `'F${i}'`).join(',');

const html = `<style>
${faces}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;display:flex;background:#322244;font-family:${stack},serif;overflow:hidden}
.pic{position:relative;width:56%;height:100%}
.pic img{width:100%;height:100%;object-fit:cover;object-position:46% 52%}
.tint{position:absolute;inset:0;background:rgba(66,46,89,.22);mix-blend-mode:multiply}
.seam{position:absolute;inset:0 0 0 auto;width:180px;background:linear-gradient(to left,#322244,rgba(50,34,68,0))}
.panel{flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 58px 0 20px;color:#fff}
.eyebrow{font-size:16px;letter-spacing:.32em;text-transform:uppercase;color:#f7dc79;font-weight:700;font-family:system-ui,sans-serif}
h1{font-size:58px;line-height:1.03;letter-spacing:-.03em;margin-top:24px;font-weight:700}
.rule{width:84px;height:4px;background:#f7dc79;border-radius:4px;margin:28px 0 24px}
p{font-size:19px;line-height:1.5;color:rgba(255,255,255,.85);font-family:system-ui,sans-serif;max-width:30ch}
.mark{position:absolute;left:44px;top:40px;z-index:2}
.mark img{width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.92);padding:2px}
</style>
<div class="pic"><img src="${photo}"><div class="tint"></div><div class="seam"></div>
  <div class="mark"><img src="${crest}"></div>
</div>
<div class="panel">
  <div class="eyebrow">A Global University</div>
  <h1>ICOF Global<br>University</h1>
  <div class="rule"></div>
  <p>Accredited degrees taught from Cameroon, the USA, Zambia, Nigeria, South Africa and worldwide.</p>
</div>`;

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: 'public/images/og-home.jpg', type: 'jpeg', quality: 90 });
await browser.close();

console.log('public/images/og-home.jpg  1200x630 @2x');
