// Headless smoke test: loads the game, fails on console errors, optionally waits for a full race.
// Usage: node tests/smoke.mjs [query] [outDir] [maxSeconds]
//   e.g. node tests/smoke.mjs "?autotest&laps=3&norender&simspeed=4" shots 300
// Env: PORT (default 8123), THREE_DIR (serve three.js locally), SHOTS="5,10" (screenshot times), VERBOSE=1
import fs from 'fs';
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright');

const query = process.argv[2] ?? '';
const outDir = process.argv[3] ?? 'shots';
const maxSec = +(process.argv[4] ?? 120);
const port = process.env.PORT || 8123;
const shotsAt = (process.env.SHOTS ?? '').split(',').filter(Boolean).map(Number);
const expectResult = /autotest/.test(query);
// driver chatter from software WebGL, not from the game
const NOISE = [/GPU stall due to ReadPixels/, /Automatic fallback to software WebGL/, /GroupMarkerNotSet/];

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) } });
if (process.env.THREE_DIR) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, (route) => {
    const rel = route.request().url().replace(/^.*\/npm\/three@[^/]+\//, '');
    route.fulfill({ path: `${process.env.THREE_DIR}/${rel}`, contentType: 'application/javascript' });
  });
}
const errors = [];
page.on('console', (m) => {
  if (m.type() !== 'error' && m.type() !== 'warning') return;
  const text = m.text();
  if (NOISE.some((r) => r.test(text))) return;
  errors.push(`[${m.type()}] ${text}`);
  if (process.env.VERBOSE) console.log(`[${m.type()}] ${text}`);
});
page.on('pageerror', (e) => { errors.push('[pageerror] ' + e.message); console.log('[pageerror]', e.message); });

const finish = async (code) => {
  console.log('errors:', errors.length); errors.slice(0, 30).forEach((e) => console.log(e));
  await browser.close();
  process.exit(code);
};

const t0 = Date.now();
await page.goto(`http://localhost:${port}/index.html${query}`);
try {
  await page.waitForFunction(() => window.__gameStarted === true || !!document.getElementById('fatal'), null, { timeout: 120000 });
} catch (e) {
  console.log('start timeout');
  await page.screenshot({ path: `${outDir}/timeout.png` });
  await finish(1);
}
const fatal = await page.evaluate(() => document.getElementById('fatal')?.innerText);
if (fatal) { console.log('FATAL:', fatal); await finish(1); }
console.log('started in', ((Date.now() - t0) / 1000).toFixed(1), 's');

let shotIdx = 0, result = null;
const start = Date.now();
while ((Date.now() - start) / 1000 < maxSec) {
  await page.waitForTimeout(1000);
  const el = (Date.now() - start) / 1000;
  const st = await page.evaluate(() => ({ state: window.__dbg ? window.__dbg() : null, res: window.__raceResult }));
  if (shotIdx < shotsAt.length && el >= shotsAt[shotIdx]) {
    await page.screenshot({ path: `${outDir}/shot${shotIdx}.png` });
    console.log('shot', shotIdx, 'at', el.toFixed(0), st.state && st.state.state);
    shotIdx++;
  }
  if (st.res) { result = st.res; console.log('RESULT', JSON.stringify(st.res)); break; }
}
const final = await page.evaluate(() => (window.__dbg ? window.__dbg() : null));
if (final) {
  console.log('state', final.state, 'raceTime', final.t);
  for (const c of final.cars) console.log(`  ${c.n.padEnd(5)} lap ${c.lap} best ${c.best}s walls ${c.st.walls} respawns ${c.st.respawns} bumps ${c.st.bumps} (side ${c.st.side || 0} rear ${c.st.rear || 0} early ${c.st.early || 0}) air ${c.st.air.toFixed(2)}s`);
}
if (expectResult && !result) { console.log('FAIL: race did not reach the results screen'); await finish(1); }
await finish(errors.length ? 1 : 0);
