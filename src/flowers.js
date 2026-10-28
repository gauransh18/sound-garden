// Four flowers, four voices. Each flower is a few meshes on shared geometry and materials, so a
// full bed of 128 stays cheap. Higher notes grow taller and shift color, so a tune can be read.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROWS } from './garden.js';
import { mixHex } from './util.js';

export const FLOWERS = [
  { id: 'tulip', name: 'Tulip', sound: 'bell', low: '#f39a3d', high: '#e2457c' },
  { id: 'daisy', name: 'Daisy', sound: 'pluck', low: '#f5c02e', high: '#ef7a2a' },
  { id: 'lavender', name: 'Lavender', sound: 'hum', low: '#7f86e6', high: '#b56bd6' },
  { id: 'mushroom', name: 'Mushroom', sound: 'drum', low: '#c9412c', high: '#f0a24a' },
];

export const flowerColor = (kind, row) => mixHex(FLOWERS[kind].low, FLOWERS[kind].high, row / (ROWS - 1));

const mats = new Map();
function mat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  return mats.get(color);
}

let G = null;
function geometries() {
  if (G) return G;
  const stem = new THREE.CylinderGeometry(0.028, 0.04, 1, 5).translate(0, 0.5, 0);
  const leaf = mergeGeometries([
    new THREE.SphereGeometry(1, 7, 4).scale(0.17, 0.018, 0.06).translate(0.15, 0, 0).rotateZ(0.5),
    new THREE.SphereGeometry(1, 7, 4).scale(0.14, 0.018, 0.05).translate(0.12, 0, 0).rotateZ(0.6).rotateY(Math.PI * 0.9).translate(0, 0.1, 0),
  ]);
  const tulip = new THREE.LatheGeometry(
    [[0, 0], [0.08, 0.015], [0.14, 0.07], [0.16, 0.16], [0.15, 0.25], [0.11, 0.32], [0.05, 0.27], [0, 0.26]].map(
      ([x, y]) => new THREE.Vector2(x, y),
    ),
    6,
  );
  const petals = [];
  for (let k = 0; k < 11; k++) {
    petals.push(
      new THREE.SphereGeometry(1, 7, 3).scale(0.12, 0.016, 0.04).translate(0.14, 0, 0).rotateZ(0.2).rotateY((k / 11) * Math.PI * 2),
    );
  }
  const daisy = mergeGeometries(petals);
  const daisyEye = new THREE.SphereGeometry(0.07, 10, 5).scale(1, 0.55, 1).translate(0, 0.012, 0);
  const buds = [];
  for (let k = 0; k < 8; k++) {
    const r = 0.055 * (1 - k * 0.07);
    const a = k * 2.4;
    buds.push(new THREE.IcosahedronGeometry(r, 0).translate(Math.cos(a) * 0.03, k * 0.06, Math.sin(a) * 0.03));
  }
  const lavender = mergeGeometries(buds);
  const mushStem = new THREE.CylinderGeometry(0.06, 0.08, 1, 7).translate(0, 0.5, 0);
  const cap = new THREE.SphereGeometry(0.27, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.72, 1);
  const gill = new THREE.CircleGeometry(0.27, 12).rotateX(Math.PI / 2);
  const spots = [];
  for (let k = 0; k < 6; k++) {
    const th = (k / 6) * Math.PI * 2 + 0.4;
    const ph = k % 2 ? 0.55 : 0.95;
    spots.push(
      new THREE.SphereGeometry(0.035, 6, 3)
        .scale(1, 0.4, 1)
        .translate(Math.cos(th) * Math.sin(ph) * 0.27, Math.cos(ph) * 0.27 * 0.72, Math.sin(th) * Math.sin(ph) * 0.27),
    );
  }
  spots.push(new THREE.SphereGeometry(0.04, 6, 3).scale(1, 0.4, 1).translate(0, 0.195, 0));
  G = { stem, leaf, tulip, daisy, daisyEye, lavender, mushStem, cap, gill, spots: mergeGeometries(spots) };
  return G;
}

const STEM = '#4f8f36';
const LEAF = '#64a843';

function part(group, geo, color, y = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.y = y;
  m.castShadow = true;
  group.add(m);
  return m;
}

// root sits on the soil and is scaled for grow and squash; pivot sways in the breeze.
export function makeFlower(kind, row) {
  const g = geometries();
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const color = flowerColor(kind, row);
  const lift = row / (ROWS - 1);

  if (kind === 3) {
    const h = 0.16 + lift * 0.08;
    const s = 1 - lift * 0.45;
    part(pivot, g.mushStem, '#f2e6cf').scale.set(s, h, s);
    const top = new THREE.Group();
    top.position.y = h;
    top.scale.setScalar(s);
    pivot.add(top);
    part(top, g.cap, color);
    part(top, g.gill, '#eadcc0');
    part(top, g.spots, '#fff8ea');
  } else {
    const h = (kind === 2 ? 0.5 : 0.42) + lift * 0.42;
    part(pivot, g.stem, STEM).scale.y = h;
    const leaf = part(pivot, g.leaf, LEAF, 0.08 + h * 0.18);
    leaf.rotation.y = row * 1.7;
    if (kind === 0) part(pivot, g.tulip, color, h - 0.02);
    if (kind === 1) {
      const head = new THREE.Group();
      head.position.y = h;
      head.rotation.x = 0.35;
      pivot.add(head);
      part(head, g.daisy, '#fffaf0');
      part(head, g.daisyEye, color);
    }
    if (kind === 2) part(pivot, g.lavender, color, h - 0.04);
  }
  root.traverse((o) => (o.userData.flower = root));
  return { root, pivot, color };
}

// Small picker icons, drawn to match the meshes.
export function flowerIcon(kind) {
  const c = flowerColor(kind, 5);
  const stem = `<path d="M10 18V9" stroke="${STEM}" stroke-width="1.6" stroke-linecap="round"/><path d="M10 15c-2.4-.2-3.6-1.4-4-3 2.2 0 3.5 1 4 3z" fill="${LEAF}"/>`;
  const head = [
    `<path d="M6 4.5c.6 3 1 5 4 5.5 3-.5 3.4-2.5 4-5.5L12 6l-2-2.5L8 6z" fill="${c}"/>`,
    `<g fill="#fffaf0" stroke="rgba(31,42,68,.35)" stroke-width=".5">${[0, 1, 2, 3, 4, 5, 6, 7]
      .map((k) => `<ellipse cx="10" cy="3.4" rx="1.3" ry="2.4" transform="rotate(${k * 45} 10 6.6)"/>`)
      .join('')}</g><circle cx="10" cy="6.6" r="1.8" fill="${c}"/>`,
    `<g fill="${c}">${[0, 1, 2, 3, 4].map((k) => `<circle cx="${10 + (k % 2 ? 0.9 : -0.9)}" cy="${9 - k * 1.5}" r="${1.4 - k * 0.12}"/>`).join('')}</g>`,
    `<path d="M8.6 17.5h2.8l-.3-5.5H8.9z" fill="#f2e6cf"/><path d="M3.5 12.5C3.5 8 6.4 5.5 10 5.5s6.5 2.5 6.5 7z" fill="${c}"/><circle cx="7.4" cy="9.4" r="1" fill="#fff8ea"/><circle cx="11.6" cy="8.2" r="1.1" fill="#fff8ea"/><circle cx="13.6" cy="11" r=".8" fill="#fff8ea"/>`,
  ][kind];
  return `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">${kind === 3 ? '' : stem}${head}</svg>`;
}
