import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const m = await b.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await m.goto('http://localhost:3000/',{waitUntil:'networkidle'});
await m.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=400){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}});
await m.waitForTimeout(1200);
const list = await m.evaluate(()=>[...document.querySelectorAll('button,a[href]')]
  .filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<44&&!e.closest('p,li,blockquote,dd');})
  .map(e=>({tag:e.tagName,h:Math.round(e.getBoundingClientRect().height),disp:getComputedStyle(e).display,txt:(e.textContent||'').trim().slice(0,28),cls:e.className.slice(0,50)})));
console.log(JSON.stringify(list,null,1));
await b.close();
