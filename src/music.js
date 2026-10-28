// Every sound is synthesized here, no audio files. Voices go through one bus with a little room
// reverb and a compressor, so a full column of flowers doesn't clip.
import { COLS, ROWS, cellOf } from './garden.js';

// C major pentatonic, lowest row first, so any garden is in tune.
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

let ctx = null;
let voiceOut = null;
let noiseBuf = null;
let virtualClock = null; // dev recording only: the breeze follows this instead of the speakers

function build(c = new (window.AudioContext || window.webkitAudioContext)()) {
  ctx = c;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  comp.connect(master).connect(ctx.destination);

  voiceOut = ctx.createGain();
  voiceOut.gain.value = 0.7;
  voiceOut.connect(comp);

  const len = Math.floor(ctx.sampleRate * 2.4);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.26;
  voiceOut.connect(verb).connect(wet).connect(comp);

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const n = noiseBuf.getChannelData(0);
  for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
}

// Call from inside a tap or click: browsers only let audio start from a gesture.
export function startAudio() {
  // iOS mutes Web Audio with the silent switch unless the page asks for playback
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
  try {
    if (!ctx) build();
  } catch {
    return Promise.resolve(false);
  }
  if (ctx.state === 'running') return Promise.resolve(true);
  return ctx.resume().then(
    () => ctx.state === 'running',
    () => false,
  );
}

const audible = () => !!ctx && ctx.state === 'running';
export const audioRunning = () => !!virtualClock || audible();
export const audioTime = () => (virtualClock ? virtualClock() : ctx ? ctx.currentTime : 0);
export const suspendAudio = () => ctx?.suspend().catch(() => {});

/* ---------- voices ---------- */

function env(g, t, attack, decay, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function osc(type, f0, f1, t, attack, decay, peak, into = voiceOut) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + attack + decay * 0.6);
  env(g, t, attack, decay, peak);
  o.connect(g).connect(into);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

function filter(type, freq, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(voiceOut);
  return f;
}

function noise(t, decay, peak, type, freq, q) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const g = ctx.createGain();
  env(g, t, 0.002, decay, peak);
  s.connect(g).connect(filter(type, freq, q));
  s.start(t, Math.random() * 0.5);
  s.stop(t + decay + 0.05);
}

const VOICES = [
  // tulip: a soft bell
  (f, t, v) => {
    osc('sine', f, f, t, 0.004, 1.5, 0.15 * v);
    osc('sine', f * 2.01, f * 2.01, t, 0.003, 0.6, 0.05 * v);
    osc('sine', f * 3.02, f * 3.02, t, 0.002, 0.25, 0.022 * v);
  },
  // daisy: a plucked string
  (f, t, v) => {
    const lp = filter('lowpass', 5000, 2);
    lp.frequency.setValueAtTime(5000, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.3);
    osc('triangle', f, f, t, 0.002, 0.5, 0.24 * v, lp);
    osc('sine', f * 2, f * 2, t, 0.002, 0.18, 0.04 * v);
  },
  // lavender: a low hum an octave down
  (f, t, v) => {
    osc('sawtooth', f / 2, f / 2, t, 0.05, 1.1, 0.07 * v, filter('lowpass', 720, 3));
    osc('sine', f / 2, f / 2, t, 0.04, 1.1, 0.12 * v);
  },
];

// mushroom: a different drum on each row, kicks at the bottom and shakers at the top
const DRUMS = [
  (t, v) => osc('sine', 140, 42, t, 0.003, 0.38, 0.6 * v),
  (t, v) => osc('sine', 190, 60, t, 0.003, 0.3, 0.5 * v),
  (t, v) => osc('sine', 240, 130, t, 0.003, 0.26, 0.36 * v),
  (t, v) => osc('sine', 330, 190, t, 0.003, 0.22, 0.32 * v),
  (t, v) => {
    osc('sine', 820, 800, t, 0.001, 0.07, 0.26 * v);
    osc('triangle', 1640, 1600, t, 0.001, 0.03, 0.08 * v);
  },
  (t, v) => osc('sine', 1180, 1150, t, 0.001, 0.06, 0.22 * v),
  (t, v) => noise(t, 0.08, 0.2 * v, 'highpass', 6500, 0.7),
  (t, v) => noise(t, 0.035, 0.18 * v, 'bandpass', 9000, 1.2),
];

function voice(kind, row, t, v) {
  if (kind === 3) DRUMS[row](t, v);
  else VOICES[kind](SCALE[row], t, v);
}

export function playNote(kind, row, t = audioTime(), v = 1) {
  if (audible()) voice(kind, row, t, v);
}

function pull(t) {
  osc('sine', 520, 260, t, 0.003, 0.09, 0.08);
  noise(t, 0.05, 0.05, 'bandpass', 2400, 2);
}

export function playPull() {
  if (audible()) pull(audioTime());
}

// Dev recording: the page runs on a stepped clock with no sound, and the soundtrack is rendered
// afterwards from a log of what was heard, through the same voices and effects.
export function useVirtualClock(fn) {
  virtualClock = fn;
}

export async function renderOffline(seconds, log) {
  const live = [ctx, voiceOut, noiseBuf];
  const off = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
  build(off);
  for (const e of log) {
    if (e.pull) pull(e.t);
    else voice(e.kind, e.row, e.t, e.v ?? 1);
  }
  const buf = await off.startRendering();
  [ctx, voiceOut, noiseBuf] = live;
  return buf;
}

/* ---------- the breeze: a lookahead clock on audio time ---------- */

const LOOKAHEAD = 0.14;
const TICK_MS = 25;

// Eighth notes: at 100 bpm one sweep of the bed takes 4.8 seconds.
export const seq = {
  bpm: 100,
  playing: false,
  cells: null,
  next: 0,
  nextTime: 0,
  timer: null,
  queue: [], // steps scheduled for the speakers but not yet shown on screen
  current: null,

  stepDur() {
    return 60 / this.bpm / 2;
  },

  start() {
    if (this.playing || !audioRunning()) return;
    this.playing = true;
    this.next = 0;
    this.nextTime = audioTime() + 0.08;
    this.queue.length = 0;
    this.current = null;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  },

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
    this.queue.length = 0;
    this.current = null;
  },

  schedule() {
    const until = audioTime() + LOOKAHEAD;
    while (this.nextTime < until) {
      const step = this.next;
      for (let r = 0; r < ROWS; r++) {
        const k = this.cells[cellOf(step, r)];
        if (k >= 0) playNote(k, r, this.nextTime, 0.85);
      }
      this.queue.push({ step, time: this.nextTime });
      this.nextTime += this.stepDur();
      this.next = (step + 1) % COLS;
    }
  },

  // Hands each step to the screen at the moment it's heard, not when it was scheduled.
  drain(onStep) {
    const t = audioTime();
    while (this.queue.length && this.queue[0].time <= t) {
      this.current = this.queue.shift();
      onStep(this.current.step);
    }
  },

  // The playing step as a float, for the breeze band.
  position() {
    if (!this.current) return null;
    const p = (audioTime() - this.current.time) / this.stepDur();
    return this.current.step + Math.min(Math.max(p, 0), 1);
  },
};
