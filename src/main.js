// Boots the garden: picks up a shared link, wires the picker and controls, and runs the frame loop.
import { createScene } from './scene.js';
import { FLOWERS, flowerColor, flowerIcon } from './flowers.js';
import { BPM, ROWS, cellOf, clampBpm, count, decode, demoCells, encode, rowOf, surpriseCells } from './garden.js';
import { audioRunning, audioTime, playNote, playPull, renderOffline, seq, startAudio, suspendAudio, useVirtualClock } from './music.js';
import { clamp, storage } from './util.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const scene = createScene(canvas);
const SAVED = 'soundgarden:last';
const params = new URLSearchParams(location.search);
const shot = import.meta.env.DEV && params.has('shot');
// ?rec: the capture script drives a stepped clock; what would be heard is logged for the soundtrack
const rec = import.meta.env.DEV && params.has('rec');
const heard = [];
if (rec) useVirtualClock(() => performance.now() / 1000);

/* ---------- which garden ---------- */

function fromHash() {
  let raw = location.hash.slice(1);
  try {
    raw = decodeURIComponent(raw);
  } catch {}
  const g = decode(raw);
  return g && count(g.cells) ? g : null;
}

const linked = fromHash();
const saved = decode(storage.get(SAVED, ''));
// The hash is rewritten on every edit, so a reload of your own garden is not a shared link.
const shared = !!linked && (!saved || encode(linked.cells, linked.bpm) !== encode(saved.cells, saved.bpm));
const first = linked || (saved && count(saved.cells) ? saved : { cells: demoCells(), bpm: BPM.initial });
// One array for the whole session; the sequencer reads it live, so edits are heard on the next sweep.
const cells = first.cells;
let bpm = first.bpm;
seq.cells = cells;
seq.bpm = bpm;
scene.setGarden(cells);

function save() {
  const code = encode(cells, bpm);
  history.replaceState(null, '', count(cells) ? `#${code}` : location.pathname + location.search);
  storage.set(SAVED, code);
}

function replaceGarden(next) {
  cells.set(next);
  scene.setGarden(cells);
  save();
}

/* ---------- toasts ---------- */

function toast(text, action, onAction) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action;
    b.addEventListener('click', () => {
      onAction();
      el.remove();
    });
    el.append(b);
  }
  const box = $('toasts');
  while (box.children.length > 1) box.firstChild.remove();
  box.append(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, action ? 5000 : 2800);
}

/* ---------- flower picker ---------- */

let kind = clamp(Number(storage.get('soundgarden:kind', 0)) | 0, 0, FLOWERS.length - 1);
const seeds = FLOWERS.map((f, k) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'seed';
  b.setAttribute('role', 'radio');
  b.title = `${f.name}: ${f.sound} (${k + 1})`;
  b.innerHTML = `${flowerIcon(k)}<span class="seed-name">${f.name}</span><span class="seed-sound">${f.sound}</span>`;
  b.addEventListener('click', () => pickKind(k, true));
  $('picker').append(b);
  return b;
});

function pickKind(k, audition) {
  kind = k;
  storage.set('soundgarden:kind', k);
  seeds.forEach((b, j) => b.setAttribute('aria-checked', String(j === k)));
  if (audition) startAudio().then(() => playNote(k, 4));
  if (audition && rec) heard.push({ t: audioTime(), kind: k, row: 4 });
}
pickKind(kind, false);

/* ---------- planting ---------- */

let drag = null;

function apply(i) {
  if (drag.mode === 'plant' && cells[i] < 0) {
    cells[i] = kind;
    scene.setFlower(i, kind);
    playNote(kind, rowOf(i));
    if (rec) heard.push({ t: audioTime(), kind, row: rowOf(i) });
  } else if (drag.mode === 'pull' && cells[i] >= 0) {
    cells[i] = -1;
    scene.removeFlower(i);
    playPull();
    if (rec) heard.push({ t: audioTime(), pull: true });
  }
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const i = scene.pick(e.clientX, e.clientY);
  if (i < 0) return;
  startAudio();
  drag = { mode: cells[i] >= 0 ? 'pull' : 'plant', last: i, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
  apply(i);
  scene.hover(-1);
});

canvas.addEventListener('pointermove', (e) => {
  if (drag) {
    if (e.pointerId !== drag.id) return;
    const i = scene.pick(e.clientX, e.clientY, true);
    if (i >= 0 && i !== drag.last) {
      drag.last = i;
      apply(i);
    }
    return;
  }
  if (e.pointerType !== 'mouse') return;
  const i = scene.pick(e.clientX, e.clientY);
  scene.hover(i, i >= 0 && cells[i] < 0 ? flowerColor(kind, rowOf(i)) : '#ffffff');
  canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
});

function endDrag() {
  if (!drag) return;
  drag = null;
  save();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => scene.hover(-1));

/* ---------- controls ---------- */

const playBtn = $('btn-play');
function renderPlay() {
  playBtn.classList.toggle('on', seq.playing);
  playBtn.setAttribute('aria-label', seq.playing ? 'Pause the breeze' : 'Play the breeze');
}

function play() {
  return startAudio().then((ok) => {
    if (!ok) toast('This browser is blocking sound. Tap play to try again.');
    else seq.start();
    renderPlay();
  });
}

function pause() {
  seq.stop();
  renderPlay();
}

playBtn.addEventListener('click', () => (seq.playing ? pause() : play()));

function renderTempo() {
  $('tempo').textContent = bpm;
  $('tempo-down').disabled = bpm <= BPM.min;
  $('tempo-up').disabled = bpm >= BPM.max;
}
function setTempo(v) {
  bpm = clampBpm(v);
  seq.bpm = bpm;
  renderTempo();
  save();
}
$('tempo-down').addEventListener('click', () => setTempo(bpm - BPM.step));
$('tempo-up').addEventListener('click', () => setTempo(bpm + BPM.step));
renderTempo();

$('btn-surprise').addEventListener('click', () => {
  replaceGarden(surpriseCells());
  if (!seq.playing) play();
});

$('btn-clear').addEventListener('click', () => {
  if (!count(cells)) return;
  const before = cells.slice();
  replaceGarden(cells.map(() => -1));
  toast('Bed cleared.', 'Undo', () => replaceGarden(before));
});

$('btn-share').addEventListener('click', async () => {
  if (!count(cells)) {
    toast('Plant a few flowers first.');
    return;
  }
  save();
  const url = location.href;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: 'Sound Garden', text: 'I planted a tune. Have a listen.', url });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied. Whoever opens it hears your garden.');
  } catch {
    window.prompt('Copy this link:', url);
  }
});

/* ---------- start card ---------- */

const start = $('start');
if (shared) {
  $('start-eyebrow').hidden = false;
  $('start-eyebrow').textContent = 'Someone planted this for you';
  $('start-title').textContent = 'Have a listen';
  $('start-text').textContent = 'Tap to hear it. Then pull a few flowers, plant your own and send it back.';
  $('start-label').textContent = 'Listen';
}

function dismissStart() {
  if (start.classList.contains('out')) return;
  start.classList.add('out');
  setTimeout(() => (start.hidden = true), 400);
  play();
}
start.addEventListener('click', dismissStart);
if (shot || rec) start.hidden = true;
else $('start-go').focus({ preventScroll: true });

/* ---------- links, keys and background tabs ---------- */

window.addEventListener('hashchange', () => {
  const g = fromHash();
  if (!g) return;
  bpm = g.bpm;
  seq.bpm = bpm;
  renderTempo();
  replaceGarden(g.cells);
  toast('Planted the garden from that link.');
});

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea')) return;
  if (e.code === 'Space' && !e.target.closest?.('button')) {
    e.preventDefault();
    if (!start.hidden && !start.classList.contains('out')) dismissStart();
    else seq.playing ? pause() : play();
  }
  const n = Number(e.key);
  if (n >= 1 && n <= FLOWERS.length) pickKind(n - 1, true);
});

// Background tabs throttle timers, which would make the loop stumble, so the breeze rests instead.
let resumeOnShow = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resumeOnShow = seq.playing;
    seq.stop();
    suspendAudio();
  } else if (resumeOnShow) {
    resumeOnShow = false;
    play();
  }
  renderPlay();
});

/* ---------- layout and frame loop ---------- */

const hint = document.querySelector('.brand p');
function fit() {
  if (shot) return scene.fit({ top: 140, bottom: 16 });
  // pitch runs up the screen in landscape and across it in portrait
  const portrait = window.innerWidth / window.innerHeight < 0.9;
  hint.textContent = `Tap the soil to plant, tap a flower to pull it. ${portrait ? 'Further right sings higher.' : 'Higher rows sing higher.'}`;
  const head = document.querySelector('.top').getBoundingClientRect();
  const bar = document.querySelector('.bottom').getBoundingClientRect();
  scene.fit({ top: head.bottom + 14, bottom: window.innerHeight - bar.top + 14 });
}
window.addEventListener('resize', fit);
fit();
document.fonts?.ready.then(fit);

if (shot) document.body.classList.add('shot');
let last = performance.now();
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  if (seq.playing) {
    seq.drain((step) => {
      for (let r = 0; r < ROWS; r++) {
        const k = cells[cellOf(step, r)];
        if (k < 0) continue;
        scene.hit(cellOf(step, r));
        if (rec) heard.push({ t: seq.current.time, kind: k, row: r, v: 0.85 });
      }
    });
  }
  if (shot) {
    scene.setBreeze(6.35);
    if (Math.floor(ts / 900) !== Math.floor((ts - dt * 1000) / 900)) {
      for (let r = 0; r < ROWS; r++) if (cells[cellOf(6, r)] >= 0) scene.hit(cellOf(6, r));
    }
  } else scene.setBreeze(seq.playing ? seq.position() : null);
  scene.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

if (import.meta.env.DEV) window.__garden = { seq, cells, audioRunning };
if (rec) {
  Object.assign(window.__garden, {
    screenOf: scene.screenOf,
    play: () => {
      seq.start();
      renderPlay();
    },
    // The soundtrack from t0 on, as a base64 16-bit stereo WAV.
    async soundtrack(t0, seconds) {
      const log = heard.filter((e) => e.t >= t0 - 0.01).map((e) => ({ ...e, t: Math.max(0, e.t - t0) }));
      const buf = await renderOffline(seconds, log);
      const n = buf.length;
      const out = new DataView(new ArrayBuffer(44 + n * 4));
      const str = (o, t) => [...t].forEach((c, k) => out.setUint8(o + k, c.charCodeAt(0)));
      str(0, 'RIFF');
      out.setUint32(4, 36 + n * 4, true);
      str(8, 'WAVEfmt ');
      out.setUint32(16, 16, true);
      out.setUint16(20, 1, true);
      out.setUint16(22, 2, true);
      out.setUint32(24, buf.sampleRate, true);
      out.setUint32(28, buf.sampleRate * 4, true);
      out.setUint16(32, 4, true);
      out.setUint16(34, 16, true);
      str(36, 'data');
      out.setUint32(40, n * 4, true);
      const ch = [buf.getChannelData(0), buf.getChannelData(1)];
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < 2; c++) out.setInt16(44 + i * 4 + c * 2, clamp(ch[c][i], -1, 1) * 32767, true);
      }
      let bin = '';
      const bytes = new Uint8Array(out.buffer);
      for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return btoa(bin);
    },
  });
}
