// The garden: one flower per cell on a 16-step by 8-note bed, and the link format that carries it.
// A cell is row * COLS + col. Row 0 is the lowest note, nearest the viewer.
import { clamp, mulberry32 } from './util.js';

export const COLS = 16;
export const ROWS = 8;
export const KINDS = 4; // tulip, daisy, lavender, mushroom; see flowers.js
export const BPM = { min: 60, max: 160, step: 10, initial: 100 };

export const cellOf = (col, row) => row * COLS + col;
export const colOf = (i) => i % COLS;
export const rowOf = (i) => Math.floor(i / COLS);

export const emptyCells = () => new Int8Array(COLS * ROWS).fill(-1);
export const count = (cells) => cells.reduce((n, k) => n + (k >= 0), 0);
export const clampBpm = (v) =>
  clamp(Math.round((Number(v) || BPM.initial) / BPM.step) * BPM.step, BPM.min, BPM.max);

// Link format: "1.<bpm>.<flowers>", two base64url characters per flower holding kind * 128 + cell.
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function encode(cells, bpm) {
  let s = '';
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] < 0) continue;
    const n = cells[i] * 128 + i;
    s += ABC[n >> 6] + ABC[n & 63];
  }
  return `1.${clampBpm(bpm)}.${s}`;
}

// Never throws: anything it can't read is skipped, and a link it can't read at all returns null.
export function decode(str) {
  const m = /^1\.(\d{1,3})\.([A-Za-z0-9_-]{0,512})$/.exec(String(str || '').trim());
  if (!m) return null;
  const cells = emptyCells();
  for (let k = 0; k + 1 < m[2].length; k += 2) {
    const n = ABC.indexOf(m[2][k]) * 64 + ABC.indexOf(m[2][k + 1]);
    const kind = n >> 7;
    if (kind < KINDS) cells[n & 127] = kind;
  }
  return { cells, bpm: clampBpm(m[1]) };
}

// [col, row, kind] for the garden a first-time visitor finds.
const DEMO = [
  [0, 0, 3], [8, 0, 3], [4, 4, 3], [12, 4, 3], [2, 6, 3], [6, 6, 3], [10, 6, 3], [14, 6, 3],
  [0, 5, 2], [8, 3, 2],
  [0, 7, 0], [3, 5, 0], [7, 6, 0], [11, 5, 0], [14, 3, 0],
  [1, 2, 1], [5, 3, 1], [9, 2, 1], [13, 4, 1],
];

export function demoCells() {
  const cells = emptyCells();
  for (const [c, r, k] of DEMO) cells[cellOf(c, r)] = k;
  return cells;
}

// A random garden that still sounds like a tune: a drum groove, a bass on the downbeats and a
// melody that mostly steps between neighbouring notes.
export function surpriseCells(seed = Date.now()) {
  const rng = mulberry32(seed);
  const cells = emptyCells();
  const melody = rng() < 0.5 ? 0 : 1;
  const other = 1 - melody;
  let row = 3 + Math.floor(rng() * 3);
  for (let c = 0; c < COLS; c++) {
    if (c % 4 === 0 || rng() < 0.35) {
      row = clamp(row + Math.floor(rng() * 5) - 2, 2, ROWS - 1);
      cells[cellOf(c, row)] = melody;
    }
    if (c % 4 === 2 && rng() < 0.6) {
      const r = clamp(row - 2 - Math.floor(rng() * 2), 0, ROWS - 1);
      if (cells[cellOf(c, r)] < 0) cells[cellOf(c, r)] = other;
    }
  }
  const bass = [0, 3, 4, 2][Math.floor(rng() * 4)];
  for (const c of [0, 8]) if (cells[cellOf(c, bass)] < 0) cells[cellOf(c, bass)] = 2;
  const groove = [
    [[0, 0], [8, 0], [4, 4], [12, 4]],
    [[0, 0], [6, 1], [10, 0], [4, 5], [12, 5]],
    [[0, 1], [4, 0], [8, 1], [12, 0], [2, 6], [10, 6]],
  ][Math.floor(rng() * 3)];
  for (const [c, r] of groove) if (cells[cellOf(c, r)] < 0) cells[cellOf(c, r)] = 3;
  for (let c = 1; c < COLS; c += 2) {
    if (rng() < 0.4 && cells[cellOf(c, 6)] < 0) cells[cellOf(c, 6)] = 3;
  }
  return cells;
}
