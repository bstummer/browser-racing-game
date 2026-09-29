// Headless smoke test: loads the game, captures console errors, takes screenshots.
// Usage: node tests/smoke.mjs [query] [outDir] [maxSeconds]
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright');
import fs from 'fs';
const query = process.argv[2] ?? '';
const outDir = process.argv[3] ?? 'shots';
const maxSec = +(process.argv[4] ?? 120);
const shotsAt = (process.env.SHOTS ?? '').split(',').filter(Boolean).map(Number);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) } });
const errors = [];
// Optional: serve three.js from a local copy (THREE_DIR=/path/to/node_modules/three) instead of the CDN.
if (process.env.THREE_DIR) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, (route) => {
    const rel = route.request().url().replace(/^.*\/npm\/three@[^/]+\//, '');
    route.fulfill({ path: `${process.env.THREE_DIR}/${rel}`, contentType: 'application/javascript' });
  });
}
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { errors.push(`[${m.type()}] ${m.text()}`); if (process.env.VERBOSE) console.log(`[${m.type()}] ${m.text()}`); } });
page.on('pageerror', (e) => { errors.push('[pageerror] ' + e.message); console.log('[pageerror]', e.message); });
const t0 = Date.now();
await page.goto('http://localhost:8123/index.html' + query);
try { await page.waitForFunction(() => window.__gameStarted === true || !!document.getElementById('fatal'), null, { timeout: 120000 }); }
catch (e) { console.log('start timeout'); errors.forEach((x) => console.log(x)); await page.screenshot({ path: `${outDir}/timeout.png` }); await browser.close(); process.exit(1); }
const fatal = await page.evaluate(() => document.getElementById('fatal')?.innerText);
if (fatal) { console.log('FATAL:', fatal); errors.forEach((x) => console.log(x)); await browser.close(); process.exit(1); }
console.log('started in', ((Date.now() - t0) / 1000).toFixed(1), 's');
let shotIdx = 0;
const start = Date.now();
while ((Date.now() - start) / 1000 < maxSec) {
  await page.waitForTimeout(1000);
  const el = (Date.now() - start) / 1000;
  const st = await page.evaluate(() => ({ state: window.__dbg ? window.__dbg() : null, frames: window.__frames, res: window.__raceResult }));
  if (shotIdx < shotsAt.length && el >= shotsAt[shotIdx]) {
    await page.screenshot({ path: `${outDir}/shot${shotIdx}.png` });
    console.log('shot', shotIdx, 'at', el.toFixed(0), JSON.stringify(st.state));
    shotIdx++;
  }
  if (st.res) { console.log('RESULT', JSON.stringify(st.res)); break; }
}
const final = await page.evaluate(() => window.__dbg ? window.__dbg() : null);
console.log('final', JSON.stringify(final));
console.log('errors:', errors.length); errors.slice(0, 30).forEach((e) => console.log(e));
await browser.close();
