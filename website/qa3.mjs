import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const m = await b.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await m.goto('http://localhost:3000/',{waitUntil:'networkidle'});
await m.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=400){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}});
await m.waitForTimeout(1000);
const info = await m.evaluate(()=>[...document.querySelectorAll('a[href]')]
  .filter(e=>{const r=e.getBoundingClientRect();return r.height>0&&r.height<44&&!e.closest('p,li,blockquote,dd');})
  .map(e=>({txt:(e.textContent||'').trim().slice(0,24), parent:e.parentElement?.tagName, section:e.closest('section')?.getAttribute('data-chapter')||'?', stretched:!!e.querySelector('span[aria-hidden]')})));
console.log(JSON.stringify(info));
await b.close();
