import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const reqs = [];
p.on('response', r => reqs.push({ url: r.url(), type: r.request().resourceType(), status: r.status() }));
await p.goto('http://127.0.0.1:3111/', { waitUntil: 'networkidle' });
const perf = await p.evaluate(() => {
  const lcp = performance.getEntriesByType('largest-contentful-paint').pop();
  const nav = performance.getEntriesByType('navigation')[0];
  return { dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), lcpEl: lcp ? (lcp.element?.tagName + ' ' + (lcp.url||'').split('/').pop().slice(0,40)) : null };
});
await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=400){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));} window.scrollTo(0,0); });
await p.evaluate(() => Promise.all(Array.from(document.images).filter(i=>!i.complete).map(i=>new Promise(r=>{i.onload=i.onerror=r;}))));
const a11y = await p.evaluate(() => {
  const focusables = [...document.querySelectorAll('a[href],button:not([tabindex="-1"]),input,select,textarea,[tabindex]:not([tabindex="-1"])')];
  const names = focusables.map(e => (e.getAttribute('aria-label') || e.innerText || '').replace(/\s+/g,' ').trim());
  const dupCounts = {};
  names.filter(Boolean).forEach(n => { dupCounts[n] = (dupCounts[n]||0)+1; });
  const dupes = Object.entries(dupCounts).filter(([,c]) => c > 2).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const noName = focusables.filter(e => !(e.getAttribute('aria-label')||e.innerText||'').trim()).map(e=>e.tagName+'.'+String(e.className).slice(0,30)).slice(0,6);
  const landmarks = [...document.querySelectorAll('header,nav,main,footer,aside,[role]')].map(e=>e.tagName.toLowerCase()+(e.getAttribute('role')?'['+e.getAttribute('role')+']':'')).slice(0,14);
  const links = [...document.querySelectorAll('a[href]')];
  const external = links.filter(a=>a.host && a.host !== location.host).map(a=>({t:(a.innerText||a.getAttribute('aria-label')||'').trim().slice(0,24), rel:a.rel, target:a.target}));
  return { focusableCount: focusables.length, dupes, noName, landmarks: [...new Set(landmarks)], external };
});
const words = await p.evaluate(() => {
  const t = document.querySelector('main')?.innerText || document.body.innerText;
  const w = t.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(x=>x.length>4);
  const c = {}; w.forEach(x=>c[x]=(c[x]||0)+1);
  return Object.entries(c).filter(([,n])=>n>=4).sort((a,b)=>b[1]-a[1]).slice(0,14);
});
const bytes = {};
for (const r of reqs) { bytes[r.type] = (bytes[r.type]||0) + 1; }
console.log(JSON.stringify({ perf, requests: bytes, failed: reqs.filter(r=>r.status>=400).map(r=>r.status+' '+r.url.slice(-50)), a11y, repeatedWords: words }, null, 1));
await b.close();
