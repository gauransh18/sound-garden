// The diorama: a painted meadow tile with a garden bed of 16 steps by 8 notes, the flowers and the
// breeze. Time runs left to right across the bed (top to bottom on a portrait screen).
import * as THREE from 'three';
import { COLS, ROWS, colOf, rowOf, cellOf } from './garden.js';
import { makeFlower } from './flowers.js';
import { mulberry32, clamp, easeOutBack, easeInCubic } from './util.js';

export const BG = '#f1eee7';
const TILE = { w: 22, d: 13, h: 0.9 };
const BLOOM = 1.7; // flowers are modelled small; this sizes them to fill a cell
export const cellX = (c) => c - COLS / 2 + 0.5;
export const cellZ = (r) => ROWS / 2 - 0.5 - r;

/* ---------- painted textures ---------- */

const W = 2048;
const H = Math.round((W * TILE.d) / TILE.w);
const PX = W / TILE.w;
const tc = (x, z) => [((x + TILE.w / 2) / TILE.w) * W, ((z + TILE.d / 2) / TILE.d) * H];

const GRASS = ['#7bb846', '#93cb55', '#6aa83c', '#a5d468', '#86c04c', '#b4d86f'];
const SOIL = ['#7d5034', '#946243', '#6f4630', '#a06e4a', '#86583a'];

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function strokes(g, rng, n, cols, x0, y0, w, h, len, width, alpha, angle = -Math.PI / 2, spread = 0.9) {
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + rng() * w;
    const y = y0 + rng() * h;
    const a = angle + (rng() - 0.5) * spread;
    const l = len * (0.6 + rng() * 0.8);
    g.strokeStyle = cols[(rng() * cols.length) | 0];
    g.globalAlpha = alpha * (0.6 + rng() * 0.6);
    g.lineWidth = width * (0.6 + rng() * 0.8);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  g.globalAlpha = 1;
}

function paintTop() {
  const rng = mulberry32(11);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#8cc552';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 80 + rng() * 260;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, GRASS[(rng() * GRASS.length) | 0] + '88');
    grd.addColorStop(1, '#8cc55200');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  strokes(g, rng, 20000, GRASS, 0, 0, W, H, 14, 4, 0.55);

  const [bx0, by0] = tc(-COLS / 2 - 0.3, -ROWS / 2 - 0.3);
  const [bx1, by1] = tc(COLS / 2 + 0.3, ROWS / 2 + 0.3);
  const inBed = (x, y) => x > bx0 - 30 && x < bx1 + 30 && y > by0 - 30 && y < by1 + 50;

  // wildflower specks in the grass, kept off the bed
  for (let i = 0; i < 700; i++) {
    const x = rng() * W;
    const y = rng() * H;
    if (inBed(x, y)) continue;
    g.fillStyle = ['#fffaf0', '#fff1a8', '#f7b6c8', '#c9c2f2'][(rng() * 4) | 0];
    g.globalAlpha = 0.85;
    g.beginPath();
    g.arc(x, y, 2 + rng() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  // the bed: a soft shadow, then soil
  g.fillStyle = 'rgba(52, 80, 28, 0.45)';
  roundRect(g, bx0 - 8, by0 + 2, bx1 - bx0 + 16, by1 - by0 + 18, 44);
  g.fill();
  g.fillStyle = '#8b5a3a';
  roundRect(g, bx0, by0, bx1 - bx0, by1 - by0, 38);
  g.fill();
  g.save();
  roundRect(g, bx0, by0, bx1 - bx0, by1 - by0, 38);
  g.clip();
  strokes(g, rng, 9000, SOIL, bx0, by0, bx1 - bx0, by1 - by0, 16, 5, 0.5, 0, 0.6);
  // a furrow along each note row, ridges between them
  for (let r = 0; r < ROWS; r++) {
    const y = tc(0, cellZ(r))[1];
    g.strokeStyle = '#5e3b25';
    g.globalAlpha = 0.42;
    g.lineWidth = PX * 0.3;
    g.beginPath();
    for (let x = bx0; x <= bx1; x += 24) g.lineTo(x, y + Math.sin(x * 0.02 + r) * 2.5);
    g.stroke();
    const yr = tc(0, cellZ(r) + 0.5)[1];
    g.strokeStyle = '#b8835a';
    g.globalAlpha = 0.32;
    g.lineWidth = PX * 0.1;
    g.beginPath();
    for (let x = bx0; x <= bx1; x += 24) g.lineTo(x, yr + Math.sin(x * 0.03 + r * 2) * 2);
    g.stroke();
  }
  // a faint line every four steps, so the beat is visible
  for (let c = 4; c < COLS; c += 4) {
    const x = tc(cellX(c) - 0.5, 0)[0];
    g.strokeStyle = '#d3a27a';
    g.globalAlpha = 0.3;
    g.lineWidth = PX * 0.06;
    g.setLineDash([PX * 0.16, PX * 0.16]);
    g.beginPath();
    g.moveTo(x, by0);
    g.lineTo(x, by1);
    g.stroke();
  }
  g.setLineDash([]);
  g.restore();
  g.globalAlpha = 1;

  // a pebble in front of every step, a bigger one on each beat
  for (let col = 0; col < COLS; col++) {
    const [x, y] = tc(cellX(col), ROWS / 2 + 0.72);
    const r = (col % 4 === 0 ? 0.16 : 0.1) * PX;
    g.fillStyle = 'rgba(40, 60, 20, 0.35)';
    g.beginPath();
    g.ellipse(x + 3, y + 5, r, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ded8c8';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f6f2e8';
    g.beginPath();
    g.ellipse(x - r * 0.25, y - r * 0.25, r * 0.4, r * 0.28, 0, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function paintSide() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d');
  const bands = [['#6aa83c', 0, 7], ['#5a8d33', 7, 10], ['#8b5d3c', 10, 30], ['#77502f', 30, 46], ['#664427', 46, 64]];
  for (const [col, y0, y1] of bands) {
    g.fillStyle = col;
    g.fillRect(0, y0, 512, y1 - y0);
  }
  const rng = mulberry32(5);
  strokes(g, rng, 500, ['#9a6b47', '#5c3d24', '#835736'], 0, 12, 512, 52, 10, 2, 0.5, 0, 0.3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

function softTexture(draw, w = 128, h = 128) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- decor ---------- */

const flat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

function bush(x, z, s, rng) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const cols = ['#4f9a3a', '#5fae45', '#46883a'];
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(geo, flat(cols[k % 3]));
    const r = s * (0.45 + rng() * 0.3);
    m.scale.set(r, r * 0.85, r);
    m.position.set((rng() - 0.5) * s, r * 0.6, (rng() - 0.5) * s * 0.8);
    m.castShadow = true;
    g.add(m);
  }
  g.position.set(x, 0, z);
  return g;
}

function tree(x, z, s, rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.4, 6).translate(0, 0.7, 0), flat('#7a5236'));
  trunk.castShadow = true;
  g.add(trunk);
  const geo = new THREE.IcosahedronGeometry(1, 1);
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(geo, flat(['#3f8a3a', '#55a046', '#68b04e'][k]));
    const r = 0.75 - k * 0.12;
    m.scale.setScalar(r);
    m.position.set((rng() - 0.5) * 0.5, 1.5 + k * 0.45, (rng() - 0.5) * 0.4);
    m.castShadow = true;
    g.add(m);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  return g;
}

function stone(x, z, s) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), flat('#cfc8b8'));
  m.scale.y = 0.55;
  m.position.set(x, s * 0.25, z);
  m.rotation.y = x * 3;
  m.castShadow = true;
  return m;
}

/* ---------- scene ---------- */

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);

  scene.add(new THREE.HemisphereLight('#fff8e6', '#6f8f4a', 1.7));
  const sun = new THREE.DirectionalLight('#fff3dc', 2.3);
  sun.position.set(-6, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const side = new THREE.MeshLambertMaterial({ map: paintSide() });
  const top = new THREE.MeshLambertMaterial({ map: paintTop() });
  const tile = new THREE.Mesh(new THREE.BoxGeometry(TILE.w, TILE.h, TILE.d), [side, side, top, side, side, side]);
  tile.position.y = -TILE.h / 2;
  tile.receiveShadow = true;
  scene.add(tile);

  const rng = mulberry32(3);
  for (const [x, z, s] of [[-10, -5.3, 1.1], [9.9, -5.4, 1.2], [-10.1, 5.2, 0.9], [10.2, 4.9, 1], [-10.2, 0.6, 0.7], [10.3, -0.8, 0.75]]) {
    scene.add(bush(x, z, s, rng));
  }
  for (const [x, z, s] of [[-6.5, -5.7, 1], [3.8, -5.8, 0.85], [8.6, -5.6, 0.7]]) scene.add(tree(x, z, s, rng));
  for (const [x, z, s] of [[-9.2, 3.4, 0.22], [9.3, 2.6, 0.18], [-3, 5.6, 0.16], [6.2, 5.8, 0.2], [-8.9, -3.2, 0.15]]) {
    scene.add(stone(x, z, s));
  }

  const garden = new THREE.Group();
  scene.add(garden);

  /* breeze: a light band on the soil at the playing step, and wind streaks drifting with it */
  const bandTex = softTexture((g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }, 128, 8);
  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, ROWS + 0.4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: bandTex, transparent: true, opacity: 0, depthWrite: false, color: '#fff6dc' }),
  );
  band.position.y = 0.012;
  scene.add(band);

  const streakTex = softTexture((g, w, h) => {
    g.lineCap = 'round';
    for (const [y, a, lw] of [[h * 0.42, 0.95, 5], [h * 0.68, 0.6, 3]]) {
      const grd = g.createLinearGradient(0, 0, w, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.7, `rgba(255,255,255,${a})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = grd;
      g.lineWidth = lw;
      g.beginPath();
      for (let x = 8; x < w - 8; x += 4) g.lineTo(x, y + Math.sin(x * 0.035) * h * 0.12);
      g.stroke();
    }
  }, 256, 64);
  const streaks = [];
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: streakTex, transparent: true, opacity: 0, depthWrite: false }));
    s.scale.set(2.6, 0.65, 1);
    s.userData = { z: cellZ(1 + k * 2) + (k % 2 ? 0.3 : -0.2), y: 1.1 + (k % 3) * 0.25, lead: 0.4 + k * 0.35, phase: k * 1.7 };
    scene.add(s);
    streaks.push(s);
  }

  /* hover outline on the cell under the pointer */
  const outlineTex = softTexture((g, w, h) => {
    g.strokeStyle = '#fff';
    g.lineWidth = 7;
    g.setLineDash([16, 10]);
    roundRect(g, 6, 6, w - 12, h - 12, 22);
    g.stroke();
  });
  const outline = new THREE.Mesh(
    new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: outlineTex, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  outline.position.y = 0.015;
  outline.visible = false;
  scene.add(outline);

  /* rings that ripple out from a flower when the breeze plays it */
  const ringGeo = new THREE.RingGeometry(0.26, 0.33, 28).rotateX(-Math.PI / 2);
  const rings = [];
  for (let k = 0; k < 40; k++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false;
    m.position.y = 0.02;
    scene.add(m);
    rings.push({ m, t0: -1 });
  }
  let ringNext = 0;

  const slots = new Array(COLS * ROWS).fill(null);
  const dying = [];
  const now = () => performance.now() / 1000;

  function setFlower(i, kind, delay = 0) {
    if (slots[i]) removeFlower(i, false);
    const f = makeFlower(kind, rowOf(i));
    f.root.position.set(cellX(colOf(i)) + Math.sin(i * 12.9) * 0.06, 0, cellZ(rowOf(i)) + Math.cos(i * 7.3) * 0.06);
    f.root.rotation.y = i * 2.3;
    f.root.scale.setScalar(0.001);
    f.root.userData.cell = i;
    garden.add(f.root);
    slots[i] = { ...f, kind, born: now() + delay, hit: -10, phase: i * 0.77 };
  }

  function removeFlower(i, animate = true) {
    const s = slots[i];
    if (!s) return;
    slots[i] = null;
    if (!animate) {
      garden.remove(s.root);
      return;
    }
    s.died = now();
    s.root.userData.cell = -1;
    dying.push(s);
  }

  function setGarden(cells, stagger = true) {
    for (let i = 0; i < slots.length; i++) {
      if (cells[i] < 0) removeFlower(i, stagger);
      else if (!slots[i] || slots[i].kind !== cells[i]) setFlower(i, cells[i], stagger ? colOf(i) * 0.05 + rowOf(i) * 0.015 : 0);
    }
  }

  function hit(i) {
    const s = slots[i];
    if (!s) return;
    s.hit = now();
    const r = rings[ringNext++ % rings.length];
    r.t0 = s.hit;
    r.m.material.color.set(s.color);
    r.m.position.x = s.root.position.x;
    r.m.position.z = s.root.position.z;
    r.m.visible = true;
  }

  /* ---------- picking ---------- */

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();

  // A flower's head first, so tapping a tall bloom pulls that flower and not the cell behind it.
  function pick(clientX, clientY, groundOnly = false) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!groundOnly) {
      const hits = ray.intersectObjects(garden.children, true);
      for (const h of hits) {
        const cell = h.object.userData.flower?.userData.cell;
        if (cell >= 0) return cell;
      }
    }
    if (!ray.ray.intersectPlane(ground, hitPoint)) return -1;
    const col = Math.floor(hitPoint.x + COLS / 2);
    const row = Math.floor(ROWS / 2 - hitPoint.z);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
    return cellOf(col, row);
  }

  function hover(i, color) {
    outline.visible = i >= 0;
    if (i < 0) return;
    outline.position.x = cellX(colOf(i));
    outline.position.z = cellZ(rowOf(i));
    outline.material.color.set(color);
  }

  /* ---------- camera ---------- */

  let portrait = false;
  const target = new THREE.Vector3(0, 0.2, 0);
  const corners = [];
  for (const x of [-COLS / 2 - 0.4, COLS / 2 + 0.4]) {
    for (const z of [-ROWS / 2 - 0.4, ROWS / 2 + 0.9]) for (const y of [0, 1.6]) corners.push(new THREE.Vector3(x, y, z));
  }
  const v = new THREE.Vector3();

  // Find the closest camera that keeps the whole bed clear of the header and toolbar.
  function fit({ top = 90, bottom = 90 } = {}) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    portrait = w / h < 0.9;
    const elev = portrait ? 1.08 : 0.92;
    const dir = portrait ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    dir.multiplyScalar(Math.cos(elev)).setY(Math.sin(elev));
    // shift the view so the bed sits centered between the header and the toolbar
    const shift = (top - bottom) / 2;
    camera.setViewOffset(w, h, 0, -shift, w, h);
    const lx = 1 - 32 / w;
    const yTop = 1 - (2 * top) / h;
    const yBot = -1 + (2 * bottom) / h;
    let lo = 4;
    let hi = 120;
    for (let k = 0; k < 28; k++) {
      const d = (lo + hi) / 2;
      camera.position.copy(target).addScaledVector(dir, d);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      let ok = true;
      for (const p of corners) {
        v.copy(p).project(camera);
        if (Math.abs(v.x) > lx || v.y > yTop || v.y < yBot) {
          ok = false;
          break;
        }
      }
      if (ok) hi = d;
      else lo = d;
    }
    camera.position.copy(target).addScaledVector(dir, hi);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    for (const s of streaks) s.material.rotation = portrait ? -Math.PI / 2 : 0;
  }

  // Where a cell sits on screen, in CSS pixels. Used by the dev capture script.
  function screenOf(i) {
    v.set(cellX(colOf(i)), 0.05, cellZ(rowOf(i))).project(camera);
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  /* ---------- per frame ---------- */

  let breeze = null;
  let breezeAmt = 0;
  // pos: the playing step as a float, so the band glides between steps. null hides the breeze.
  function setBreeze(pos) {
    breeze = pos;
  }

  function frame(dt) {
    const t = now();
    breezeAmt = clamp(breezeAmt + (breeze == null ? -dt : dt) * 2.5, 0, 1);
    const bx = breeze == null ? band.position.x : cellX(0) + (breeze % COLS);
    const edge = clamp(Math.min(bx - cellX(0) + 1.2, cellX(COLS - 1) + 1.2 - bx), 0, 1);
    band.position.x = bx;
    band.material.opacity = 0.42 * breezeAmt * edge;
    for (const s of streaks) {
      const u = s.userData;
      s.position.set(bx + u.lead, u.y + Math.sin(t * 2 + u.phase) * 0.08, u.z + Math.sin(t * 1.3 + u.phase) * 0.2);
      s.material.opacity = 0.75 * breezeAmt * edge;
    }

    for (const s of slots) {
      if (!s) continue;
      const g = BLOOM * (t < s.born ? 0 : easeOutBack(clamp((t - s.born) / 0.5, 0, 1)));
      const e = Math.exp(-(t - s.hit) * 5);
      const bounce = e * Math.sin((t - s.hit) * 24);
      s.root.scale.set(Math.max(0.001, g * (1 - bounce * 0.08)), Math.max(0.001, g * (1 + bounce * 0.2)), Math.max(0.001, g * (1 - bounce * 0.08)));
      // the breeze blows toward later steps, +x
      s.pivot.rotation.z = Math.sin(t * 1.6 + s.phase) * 0.035 - e * 0.32;
      s.pivot.rotation.x = Math.sin(t * 1.1 + s.phase * 1.7) * 0.025;
    }
    for (let k = dying.length - 1; k >= 0; k--) {
      const s = dying[k];
      const p = clamp((t - s.died) / 0.22, 0, 1);
      s.root.scale.setScalar(Math.max(0.001, BLOOM * (1 - easeInCubic(p))));
      s.root.position.y = p * 0.15;
      if (p >= 1) {
        garden.remove(s.root);
        dying.splice(k, 1);
      }
    }
    for (const r of rings) {
      if (!r.m.visible) continue;
      const p = (t - r.t0) / 0.9;
      if (p >= 1) {
        r.m.visible = false;
        continue;
      }
      r.m.scale.setScalar(1 + p * 2.2);
      r.m.material.opacity = 0.7 * (1 - p) * (1 - p);
    }
    renderer.render(scene, camera);
  }

  return { fit, frame, pick, hover, hit, setFlower, removeFlower, setGarden, setBreeze, screenOf, get portrait() { return portrait; } };
}
