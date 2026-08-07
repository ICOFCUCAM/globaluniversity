import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
// Phone, light. Checks the small-screen rules and horizontal overflow.
const m = await b.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
const errs=[]; m.on('pageerror',e=>errs.push(String(e).slice(0,120)));
await m.goto('http://localhost:3000/',{waitUntil:'networkidle'});
await m.waitForTimeout(1500);
const over = await m.evaluate(()=>document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('mobile horizontal overflow:', over, 'px (0 = none)');
await m.screenshot({path:'/tmp/claude-0/-home-user/c9453aaa-aaac-5ac4-afe9-8b9092c06b92/scratchpad/m-hero.png'});
// Tap targets under 44 in the finder
await m.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=400){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}});
await m.waitForTimeout(1200);
const small = await m.evaluate(()=>[...document.querySelectorAll('button,a[href]')]
  .filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<44&&!e.closest('p,li,blockquote,dd');}).length);
console.log('interactive elements under 44px (outside prose):', small);
console.log('errors:', errs.length||'none');
await b.close();
