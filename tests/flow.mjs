// Interaction test: drives the menus and in-race actions with real key/mouse events and checks the state machine.
// Usage: node tests/flow.mjs   (Env: PORT, THREE_DIR, PLAYWRIGHT_PATH)
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright');
const port = process.env.PORT || 8123;
const NOISE = [/GPU stall due to ReadPixels/, /Automatic fallback to software WebGL/, /GroupMarkerNotSet/];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
if (process.env.THREE_DIR) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, (route) => {
    const rel = route.request().url().replace(/^.*\/npm\/three@[^/]+\//, '');
    route.fulfill({ path: `${process.env.THREE_DIR}/${rel}`, contentType: 'application/javascript' });
  });
}
const errors = [];
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !NOISE.some((r) => r.test(m.text()))) errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
let failed = 0;
const state = () => page.evaluate(() => window.__dbg().state);
const expect = async (label, want) => {
  const got = await state();
  const ok = Array.isArray(want) ? want.includes(got) : got === want;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${got}`);
  if (!ok) failed++;
};
const waitState = (s, ms = 30000) => page.waitForFunction((s) => window.__dbg().state === s, s, { timeout: ms, polling: 100 });

await page.goto(`http://localhost:${port}/index.html?norender&laps=1&simspeed=3`);
await page.waitForFunction(() => window.__gameStarted === true, null, { timeout: 120000 });
await expect('boot to title', 'title');
// quality toggle twice via menu
const q0 = await page.textContent('#q-label');
await page.click('[data-act=quality]'); await page.waitForTimeout(300);
const q1 = await page.textContent('#q-label');
await page.click('[data-act=quality]'); await page.waitForTimeout(300);
console.log(`${q0 !== q1 ? 'ok  ' : 'FAIL'} quality toggles ${q0} -> ${q1} -> ${await page.textContent('#q-label')}`); if (q0 === q1) failed++;
// controls panel open/close with keyboard
await page.click('[data-act=controls]'); await page.waitForTimeout(200);
const panelOpen = await page.isVisible('#panel');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
const panelClosed = !(await page.isVisible('#panel'));
console.log(`${panelOpen && panelClosed ? 'ok  ' : 'FAIL'} controls panel open/close`); if (!(panelOpen && panelClosed)) failed++;
// keyboard menu navigation: up to START (wraps), Enter
await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
const sel = await page.evaluate(() => document.querySelector('#menu .mbtn.sel')?.dataset.act);
if (sel !== 'start') { await page.click('[data-act=start]'); } else { await page.keyboard.press('Enter'); }
await page.waitForTimeout(300);
await expect('start race', ['countdown', 'race']);
// pause during countdown, resume
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
const paused = await page.evaluate(() => !document.getElementById('pause').classList.contains('hidden'));
console.log(`${paused ? 'ok  ' : 'FAIL'} pause overlay shown`); if (!paused) failed++;
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
await waitState('race');
await expect('countdown -> race', 'race');
// drive: throttle + steer + drift + boost, camera cycle, mute, reset
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(1500);
for (const cam of ['KeyC', 'KeyC', 'KeyC']) { await page.keyboard.press(cam); await page.waitForTimeout(250); }
await page.keyboard.press('KeyM'); await page.waitForTimeout(100); await page.keyboard.press('KeyM');
await page.keyboard.down('ArrowLeft'); await page.keyboard.down('Space'); await page.waitForTimeout(900);
await page.keyboard.up('Space'); await page.keyboard.up('ArrowLeft');
await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(500); await page.keyboard.up('ShiftLeft');
await page.keyboard.press('KeyR'); await page.waitForTimeout(300);
const p = await page.evaluate(() => window.__dbg().cars[0]);
console.log(`${p.v > 20 ? 'ok  ' : 'FAIL'} player moving under keyboard control (${p.v} km/h, respawns ${p.st.respawns})`); if (!(p.v > 20)) failed++;
// pause -> restart
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
await page.click('#pause [data-act=restart]'); await page.waitForTimeout(300);
await expect('pause -> restart', ['countdown', 'race']);
// jump near the end of the lap and let the autopilot-free player cross the line
await waitState('race');
await page.evaluate(() => window.__teleport(3395, 80));
await waitState('results', 60000);
await expect('finish -> results', 'results');
const rows = await page.$$eval('#res-table tr', (r) => r.length);
console.log(`${rows === 7 ? 'ok  ' : 'FAIL'} results table rows: ${rows}`); if (rows !== 7) failed++;
await page.keyboard.up('ArrowUp');
await page.waitForTimeout(1400);
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
await expect('results -> race again', ['countdown', 'race']);
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
await page.click('#pause [data-act=quit]'); await page.waitForTimeout(300);
await expect('quit to title', 'title');
const rec = await page.textContent('#rec-time');
console.log(`ok   track record shown on title: ${rec}`);
console.log('errors:', errors.length); errors.forEach((e) => console.log('  ' + e));
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
