// Screenshot tour: starts an autopilot race, teleports the pack along the road (metres past the start) and captures frames.
// Usage: node tests/shots.mjs outDir "s1:speed:cam,s2:speed:cam,..." [query]
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright');
import fs from 'fs';
const outDir = process.argv[2] || 'shots';
const stops = (process.argv[3] || '300:80').split(',').map((x) => { const [s, v, c] = x.split(':'); return { s: +s, v: +(v || 70), c: c || 'chase' }; });
const query = process.argv[4] || '?autotest&seed=TEST42';
const wait = +(process.env.WAIT || 6000);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +(process.env.W || 960), height: +(process.env.H || 540) } });
if (process.env.THREE_DIR) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, (route) => {
    const rel = route.request().url().replace(/^.*\/npm\/three@[^/]+\//, '');
    route.fulfill({ path: `${process.env.THREE_DIR}/${rel}`, contentType: 'application/javascript' });
  });
}
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 400)); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto('http://localhost:8123/index.html' + query);
await page.waitForFunction(() => window.__gameStarted === true, null, { timeout: 120000 });
await page.waitForFunction(() => window.__dbg && window.__dbg().state === 'race', null, { timeout: 180000 });
let i = 0;
for (const st of stops) {
  const info = await page.evaluate(([s, v, c]) => window.__teleport(s, v, c), [st.s, st.v, st.c]);
  if (i === 0) console.log('track', JSON.stringify(info));
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${outDir}/tour${i}.png` });
  const d = await page.evaluate(() => window.__dbg());
  console.log('tour', i, st.s, st.c, 'calls', d.calls, 'tris', d.tris, 'player', JSON.stringify(d.cars[0]));
  i++;
}
console.log('errors', errors.length); errors.slice(0, 20).forEach((e) => console.log(e));
await browser.close();
