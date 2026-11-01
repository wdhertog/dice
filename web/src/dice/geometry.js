// Polyhedron definitions for all supported dice.
// Faces are computed with a small convex-hull routine, so adding a new die only
// requires a list of vertices.
import * as THREE from 'three';

const PHI = (1 + Math.sqrt(5)) / 2;

export const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

export const DIE_INFO = {
  d4: { sides: 4, radius: 1.3, font: 0.2 },
  d6: { sides: 6, radius: 1.0, font: 0.5 },
  d8: { sides: 8, radius: 1.05, font: 0.36 },
  d10: { sides: 10, radius: 1.0, font: 0.34 },
  d12: { sides: 12, radius: 1.05, font: 0.4 },
  d20: { sides: 20, radius: 1.1, font: 0.3 },
  d100: { sides: 10, radius: 1.0, font: 0.27 },
};

function rawVertices(type) {
  switch (type) {
    case 'd4':
      return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
    case 'd6': {
      const v = [];
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
      return v;
    }
    case 'd8':
      return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    case 'd10':
    case 'd100': {
      // Pentagonal trapezohedron. The ring height is chosen so the kites are planar.
      const c = Math.cos(Math.PI / 5);
      const H = 1.05;
      const z = (H * (1 - c)) / (1 + c);
      const v = [[0, H, 0], [0, -H, 0]];
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        v.push([Math.cos(a), i % 2 === 0 ? z : -z, Math.sin(a)]);
      }
      return v;
    }
    case 'd12': {
      const v = [];
      const p = 1 / PHI;
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
      for (const a of [-1, 1]) {
        for (const b of [-1, 1]) {
          v.push([0, a * p, b * PHI]);
          v.push([a * p, b * PHI, 0]);
          v.push([a * PHI, 0, b * p]);
        }
      }
      return v;
    }
    case 'd20': {
      const v = [];
      for (const a of [-1, 1]) {
        for (const b of [-1, 1]) {
          v.push([0, a, b * PHI]);
          v.push([a, b * PHI, 0]);
          v.push([b * PHI, 0, a]);
        }
      }
      return v;
    }
    default:
      throw new Error(`Onbekende dobbelsteen: ${type}`);
  }
}

// Brute-force convex hull for small point sets. Returns faces with outward normals
// and vertex indices ordered counter-clockwise when viewed from outside.
function hullFaces(verts) {
  const faces = [];
  const n = verts.length;
  const tol = 1e-5;
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        ab.subVectors(verts[j], verts[i]);
        ac.subVectors(verts[k], verts[i]);
        const normal = new THREE.Vector3().crossVectors(ab, ac);
        if (normal.lengthSq() < 1e-10) continue;
        normal.normalize();
        let d = normal.dot(verts[i]);
        let pos = 0;
        let neg = 0;
        for (let m = 0; m < n; m++) {
          const s = normal.dot(verts[m]) - d;
          if (s > tol) pos++;
          else if (s < -tol) neg++;
        }
        if (pos && neg) continue;
        if (pos) {
          normal.negate();
          d = -d;
        }
        if (faces.some((f) => f.normal.dot(normal) > 1 - 1e-6)) continue;
        const members = [];
        for (let m = 0; m < n; m++) if (Math.abs(normal.dot(verts[m]) - d) < tol) members.push(m);
        const center = new THREE.Vector3();
        members.forEach((m) => center.add(verts[m]));
        center.divideScalar(members.length);
        const u = new THREE.Vector3().subVectors(verts[members[0]], center).normalize();
        const w = new THREE.Vector3().crossVectors(normal, u);
        members.sort((a, b) => {
          const da = new THREE.Vector3().subVectors(verts[a], center);
          const db = new THREE.Vector3().subVectors(verts[b], center);
          return Math.atan2(da.dot(w), da.dot(u)) - Math.atan2(db.dot(w), db.dot(u));
        });
        faces.push({ idx: members, normal, center });
      }
    }
  }
  return faces;
}

function labelFor(type, value) {
  if (type === 'd100') return value === 0 ? '00' : String(value);
  return String(value);
}

const cache = new Map();

/**
 * Returns the full description of a die: vertices, faces (with value, label and
 * 2D layout data used by the texture painter) and the atlas grid size.
 */
export function getDieDef(type) {
  if (cache.has(type)) return cache.get(type);
  const info = DIE_INFO[type];
  const raw = rawVertices(type).map((p) => new THREE.Vector3(...p));
  const maxLen = Math.max(...raw.map((v) => v.length()));
  const verts = raw.map((v) => v.multiplyScalar(info.radius / maxLen));
  const faces = hullFaces(verts);
  if (faces.length !== info.sides) throw new Error(`${type}: ${faces.length} vlakken gevonden`);

  // Numbering: opposite faces add up to sides + 1 (d4 has no opposite faces).
  const n = faces.length;
  if (type === 'd4') {
    faces.forEach((f, i) => (f.value = i + 1));
  } else {
    let k = 0;
    for (const f of faces) {
      if (f.value !== undefined) continue;
      const opp = faces.find((g) => g !== f && g.value === undefined && g.normal.dot(f.normal) < -0.999);
      f.value = k + 1;
      if (opp) opp.value = n - k;
      k++;
    }
  }
  if (type === 'd100') faces.forEach((f) => (f.value = f.value === 10 ? 0 : f.value * 10));
  faces.forEach((f) => (f.label = labelFor(type, f.value)));

  // 2D layout of each face in its own plane. "up" points at the vertex furthest
  // from the face center (the apex of the d10 kites, a corner otherwise).
  for (const f of faces) {
    let far = f.idx[0];
    let farDist = -1;
    for (const i of f.idx) {
      const dist = verts[i].distanceTo(f.center);
      if (dist > farDist + 1e-6) {
        farDist = dist;
        far = i;
      }
    }
    const target =
      type === 'd6' // squares: point "up" at an edge so pips line up with the sides
        ? new THREE.Vector3().addVectors(verts[f.idx[0]], verts[f.idx[1]]).multiplyScalar(0.5)
        : verts[far];
    f.up = new THREE.Vector3().subVectors(target, f.center).normalize();
    f.right = new THREE.Vector3().crossVectors(f.up, f.normal).normalize();
    f.pts2d = f.idx.map((i) => {
      const d = new THREE.Vector3().subVectors(verts[i], f.center);
      return [d.dot(f.right), d.dot(f.up)];
    });
    f.r2d = Math.max(...f.pts2d.map(([x, y]) => Math.hypot(x, y)));
  }

  // d4: every vertex shows the value of the face opposite to it, so the number
  // at the top vertex is the result (= value of the face lying on the table).
  if (type === 'd4') {
    for (const f of faces) {
      f.cornerLabels = f.idx.map((vi) => faces.find((g) => !g.idx.includes(vi)).label);
    }
  }

  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const restHeight = Math.max(...faces.map((f) => f.normal.dot(f.center)));
  const def = { type, info, verts, faces, cols, rows, restHeight, readDown: type === 'd4' };
  cache.set(type, def);
  return def;
}

/** Builds a non-indexed BufferGeometry whose UVs point into the face atlas. */
export function buildGeometry(def) {
  const pos = [];
  const nor = [];
  const uv = [];
  const { cols, rows } = def;
  def.faces.forEach((f, fi) => {
    const col = fi % cols;
    const row = Math.floor(fi / cols);
    const k = 0.46 / f.r2d;
    const uvOf = (j) => {
      const [x, y] = f.pts2d[j];
      return [(col + 0.5 + x * k) / cols, 1 - (row + 0.5 - y * k) / rows];
    };
    for (let t = 1; t < f.idx.length - 1; t++) {
      for (const j of [0, t, t + 1]) {
        const v = def.verts[f.idx[j]];
        pos.push(v.x, v.y, v.z);
        nor.push(f.normal.x, f.normal.y, f.normal.z);
        uv.push(...uvOf(j));
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}
