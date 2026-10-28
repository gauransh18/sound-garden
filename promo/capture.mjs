// Frame-exact capture of Sound Garden: a stepped clock in the page, a scripted cursor, and the
// soundtrack rendered offline from what the page logged as heard.
// usage (with npm run dev running): node promo/capture.mjs <outDir> [preview]
// then encode with the ffmpeg line in the README
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
const PREVIEW = process.argv[3] === 'preview';
const FPS = 30;
const DURATION = 14.2;
const URL = 'http://localhost:5174/?rec#1.110.GAGIE4HEHMFQHiHmHqHu';
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

// [time, target, action]. target is a cell [col, row] or a selector.
const PLAN = [
  [0.35, [3, 5], 'click'],
  [0.95, [6, 7], 'click'],
  [1.55, [9, 5], 'click'],
  [2.15, [11, 6], 'click'],
  [2.75, [14, 4], 'click'],
  [3.45, '.seed:nth-child(2)', 'click'],
  [4.05, [1, 2], 'click'],
  [4.6, [5, 3], 'click'],
  [5.15, [9, 2], 'click'],
  [5.7, [13, 4], 'click'],
  [7.2, [15, 7], 'rest'],
  [12.0, '#btn-share', 'click'],
];
const MOVE = 0.42; // seconds of travel before each target

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--enable-gpu'],
  defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1.5 },
});
const page = await browser.newPage();
await browser.defaultBrowserContext().overridePermissions('http://localhost:5174', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
page.on('dialog', (d) => d.dismiss());
page.on('pageerror', (e) => console.error('pageerror', e.message));

await page.evaluateOnNewDocument(() => {
  let vt = 1000;
  performance.now = () => vt;
  const frames = [];
  const timers = [];
  let id = 1;
  window.requestAnimationFrame = (cb) => (frames.push(cb), id++);
  window.cancelAnimationFrame = () => {};
  window.setTimeout = (cb, ms = 0, ...a) => (timers.push({ at: vt + ms, cb, a, id }), id++);
  window.clearTimeout = (i) => {
    const k = timers.findIndex((t) => t.id === i);
    if (k >= 0) timers.splice(k, 1);
  };
  window.__step = (ms) => {
    vt += ms;
    for (const t of timers.filter((t) => t.at <= vt)) {
      timers.splice(timers.indexOf(t), 1);
      t.cb(...t.a);
    }
    const g = window.__garden;
    if (g?.seq.playing) g.seq.schedule();
    frames.splice(0).forEach((cb) => cb(vt));
    return vt / 1000;
  };
  window.__cursor = (x, y, press) => {
    let el = document.getElementById('__cur');
    if (!el) {
      el = document.createElement('div');
      el.id = '__cur';
      el.innerHTML =
        '<i></i><svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 3l14 8-6.2 1.6L10 19z" fill="#1f2a44" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      el.style.cssText = 'position:fixed;left:0;top:0;z-index:99;pointer-events:none;';
      el.querySelector('svg').style.cssText = 'position:absolute;left:-6px;top:-4px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25))';
      el.querySelector('i').style.cssText =
        'position:absolute;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%;border:2.5px solid #fff;opacity:0;';
      document.body.append(el);
    }
    el.style.transform = `translate(${x}px, ${y}px)`;
    const ring = el.querySelector('i');
    ring.style.opacity = press > 0 ? String(press) : '0';
    ring.style.transform = `scale(${1.4 - press * 0.7})`;
  };
});

await page.goto(URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
// let the bed grow in, off camera
for (let k = 0; k < 60; k++) await page.evaluate(() => window.__step(1000 / 30));

const targets = await page.evaluate((plan) => {
  const g = window.__garden;
  return plan.map(([t, tg, act]) => {
    if (Array.isArray(tg)) return { t, act, ...g.screenOf(tg[1] * 16 + tg[0]) };
    const r = document.querySelector(tg).getBoundingClientRect();
    return { t, act, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
}, PLAN);

const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
let pos = { x: 1000, y: 610 };
const start = { ...pos };
function cursorAt(t) {
  let from = start;
  for (const tg of targets) {
    if (t < tg.t - MOVE) return from;
    if (t < tg.t) {
      const u = ease((t - (tg.t - MOVE)) / MOVE);
      return { x: from.x + (tg.x - from.x) * u, y: from.y + (tg.y - from.y) * u };
    }
    from = tg;
  }
  return from;
}
function pressAt(t) {
  for (const tg of targets) {
    if (tg.act !== 'click') continue;
    const d = t - tg.t;
    if (d >= -0.06 && d < 0.3) return d < 0 ? 1 : 1 - d / 0.3;
  }
  return 0;
}

const t0 = await page.evaluate(() => {
  window.__garden.play();
  return performance.now() / 1000;
});
const total = Math.round(DURATION * FPS);
const fired = new Set();
for (let f = 0; f < total; f++) {
  const t = f / FPS;
  const c = cursorAt(t);
  await page.mouse.move(c.x, c.y);
  for (const tg of targets) {
    if (tg.act === 'click' && !fired.has(tg) && t >= tg.t) {
      fired.add(tg);
      await page.mouse.down();
      await page.mouse.up();
    }
  }
  await page.evaluate((x, y, p) => window.__cursor(x, y, p), c.x, c.y, pressAt(t));
  await page.evaluate(() => window.__step(1000 / 30));
  if (!PREVIEW || f % 30 === 0) {
    await page.screenshot({ path: path.join(OUT, 'frames', `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 93 });
  }
  if (f % 60 === 0) console.log('frame', f, '/', total);
}

const wav = await page.evaluate((a, s) => window.__garden.soundtrack(a, s), t0 + 1 / FPS, DURATION + 0.5);
fs.writeFileSync(path.join(OUT, 'audio.wav'), Buffer.from(wav, 'base64'));
console.log('done', total, 'frames');
await browser.close();
