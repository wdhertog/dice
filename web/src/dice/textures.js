// Paints face atlases for a die type + skin and builds the material.
import * as THREE from 'three';
import { getDieDef, buildGeometry } from './geometry.js';
import { getSkin, onSkinChange } from '../skins/index.js';

const CELL = 256;

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function facePath(ctx, f, cx, cy, k) {
  ctx.beginPath();
  f.pts2d.forEach(([x, y], i) => {
    const px = cx + x * k;
    const py = cy - y * k;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

const PIPS = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function drawText(ctx, text, x, y, size, font, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.font = `bold ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.04);
  if (text === '6' || text === '9') {
    // Underline so 6 and 9 can be told apart.
    const w = ctx.measureText(text).width;
    ctx.fillRect(-w / 2, size * 0.42, w, Math.max(2, size * 0.07));
  }
  ctx.restore();
}

/** Draws only the numbers/pips with the current fillStyle. */
function paintInk(ctx, def, skin) {
  const font = skin.font || '"Trebuchet MS", "Segoe UI", Roboto, Arial, sans-serif';
  def.faces.forEach((f, fi) => {
    const col = fi % def.cols;
    const row = Math.floor(fi / def.cols);
    const cx = col * CELL + CELL / 2;
    const cy = row * CELL + CELL / 2;
    const k = (0.46 * CELL) / f.r2d;
    if (def.type === 'd4') {
      const size = CELL * def.info.font;
      f.idx.forEach((_, j) => {
        const [x, y] = f.pts2d[j];
        const dx = x * k * 0.55;
        const dy = -y * k * 0.55;
        drawText(ctx, f.cornerLabels[j], cx + dx, cy + dy, size, font, Math.atan2(dx, -dy));
      });
    } else if (def.type === 'd6' && skin.pips) {
      const half = (f.r2d * k) / Math.SQRT2;
      const off = half * 0.5;
      const r = half * 0.16;
      for (const [px, py] of PIPS[f.value]) {
        ctx.beginPath();
        ctx.arc(cx + px * off, cy + py * off, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      let size = CELL * def.info.font;
      if (f.label.length > 1) size *= 0.82;
      // Kites: move the number a little towards the wide part of the face.
      const shift = def.type === 'd10' || def.type === 'd100' ? CELL * 0.06 : 0;
      drawText(ctx, f.label, cx, cy - shift, size, font);
    }
  });
}

function makeCanvas(def) {
  const c = document.createElement('canvas');
  c.width = def.cols * CELL;
  c.height = def.rows * CELL;
  return c;
}

function paintColor(def, skin) {
  const c = makeCanvas(def);
  const ctx = c.getContext('2d');
  ctx.fillStyle = skin.base;
  ctx.fillRect(0, 0, c.width, c.height);
  if (skin.pattern) {
    ctx.save();
    skin.pattern(ctx, c.width, c.height, seeded(def.type.length * 977 + def.faces.length));
    ctx.restore();
  }
  // Optional photo: drawn on every face, cropped to a square ("cover").
  if (skin.image && skin.image.width) {
    const img = skin.image;
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    def.faces.forEach((f, fi) => {
      const x = (fi % def.cols) * CELL;
      const y = Math.floor(fi / def.cols) * CELL;
      ctx.drawImage(img, sx, sy, side, side, x, y, CELL, CELL);
    });
  }
  // Darker borders give the faces a slightly bevelled look.
  if (skin.edge) {
    ctx.strokeStyle = skin.edge;
    ctx.lineJoin = 'round';
    ctx.lineWidth = CELL * 0.05;
    def.faces.forEach((f, fi) => {
      const k = (0.46 * CELL) / f.r2d;
      facePath(ctx, f, (fi % def.cols) * CELL + CELL / 2, Math.floor(fi / def.cols) * CELL + CELL / 2, k);
      ctx.stroke();
    });
  }
  ctx.fillStyle = skin.ink;
  if (skin.glow) {
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = CELL * 0.06;
  }
  paintInk(ctx, def, skin);
  return c;
}

/** Grey-scale mask: background level `bg` (0..1), ink white. */
function paintMask(def, skin, bg) {
  const c = makeCanvas(def);
  const ctx = c.getContext('2d');
  const v = Math.round(bg * 255);
  ctx.fillStyle = `rgb(${v},${v},${v})`;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fff';
  paintInk(ctx, def, skin);
  return c;
}

function tex(canvas, color = false) {
  const t = new THREE.CanvasTexture(canvas);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const geoCache = new Map();
const matCache = new Map();

// Rebuild materials when a skin is edited.
onSkinChange((id) => {
  for (const [key, mat] of matCache) {
    if (key.endsWith(`|${id}`)) {
      [mat.map, mat.metalnessMap, mat.roughnessMap, mat.emissiveMap, mat.alphaMap].forEach((t) => t && t.dispose());
      mat.dispose();
      matCache.delete(key);
    }
  }
});

export function getGeometry(type) {
  if (!geoCache.has(type)) geoCache.set(type, buildGeometry(getDieDef(type)));
  return geoCache.get(type);
}

export function getMaterial(type, skinId) {
  const key = `${type}|${skinId}`;
  if (matCache.has(key)) return matCache.get(key);
  const def = getDieDef(type);
  const skin = getSkin(skinId);
  const opts = {
    map: tex(paintColor(def, skin), true),
    roughness: 0.4,
    metalness: 0,
    ...skin.material,
  };
  if (skin.inkMetal) {
    const m = tex(paintMask(def, skin, 0));
    opts.metalnessMap = m;
    opts.metalness = 1;
    opts.roughnessMap = tex(paintMask(def, skin, 1));
  }
  if (skin.glow) {
    opts.emissiveMap = tex(paintMask(def, skin, 0));
    opts.emissive = new THREE.Color(skin.glow);
    opts.emissiveIntensity = 1.4;
  }
  if (skin.alpha !== undefined && skin.alpha < 1) {
    opts.alphaMap = tex(paintMask(def, skin, skin.alpha));
    opts.transparent = true;
    opts.side = THREE.DoubleSide;
    opts.depthWrite = false;
  }
  const mat = new THREE.MeshPhysicalMaterial(opts);
  matCache.set(key, mat);
  return mat;
}

/** Small preview image of a skin (used in the skin picker). */
export function skinPreview(skinOrId, size = 96) {
  const skin = typeof skinOrId === 'string' ? getSkin(skinOrId) : skinOrId;
  const def = getDieDef('d6');
  const src = paintColor(def, skin);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const fi = def.faces.findIndex((f) => f.value === 5);
  ctx.drawImage(src, (fi % def.cols) * CELL + CELL * 0.17, Math.floor(fi / def.cols) * CELL + CELL * 0.17, CELL * 0.66, CELL * 0.66, 0, 0, size, size);
  return c.toDataURL();
}

/** Preview of one face (the highest value) of the given die type. */
export function facePreview(skinId, type, size = 96) {
  const skin = getSkin(skinId);
  const def = getDieDef(type);
  const src = paintColor(def, skin);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const fi = def.faces.reduce((b, f, i) => (f.value > def.faces[b].value ? i : b), 0);
  const f = def.faces[fi];
  const k = size / CELL;
  ctx.save();
  ctx.scale(k, k);
  facePath(ctx, f, CELL / 2, CELL / 2, (0.46 * CELL) / f.r2d);
  ctx.clip();
  ctx.drawImage(src, (fi % def.cols) * CELL, Math.floor(fi / def.cols) * CELL, CELL, CELL, 0, 0, CELL, CELL);
  ctx.restore();
  return c.toDataURL();
}
