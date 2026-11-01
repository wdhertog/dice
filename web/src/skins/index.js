// Skin registry. See SKINS.md in the repository root for how to make skins.
//
// Fields:
//   id, name        unique id and display name
//   base            face colour (CSS colour)
//   ink             colour of numbers / pips
//   gloss           0 = matte, 0.35 = satin (default), 1 = high gloss
//   pattern(ctx, w, h, rnd)  optional painter for the face background
//   image           optional HTMLImageElement drawn on every face
//   edge            colour used to darken face borders (fake bevel)
//   font            CSS font family for numbers
//   pips            draw pips on d6 instead of numbers (default true)
//   inkMetal        numbers are metallic (gold/silver inlay)
//   glow            colour for glowing numbers
//   alpha           0..1 opacity of the die body (numbers stay opaque)
//   material        extra options for THREE.MeshPhysicalMaterial (overrides gloss)

import classic from './classic.js';
import { builtinSkins } from './builtin.js';
import { PATTERNS } from './patterns.js';

const skins = new Map();
const listeners = [];

/** Material settings for a gloss level (0..1). */
export function glossMaterial(g) {
  return {
    roughness: 0.75 - 0.5 * g,
    clearcoat: g * 0.6,
    clearcoatRoughness: 0.6 - 0.45 * g,
  };
}

export function registerSkin(skin) {
  const gloss = skin.gloss ?? 0.35;
  skins.set(skin.id, {
    pips: true,
    edge: 'rgba(0,0,0,0.18)',
    ...skin,
    gloss,
    material: { ...glossMaterial(gloss), ...(skin.material || {}) },
  });
  listeners.forEach((fn) => fn(skin.id));
}

export function unregisterSkin(id) {
  skins.delete(id);
  listeners.forEach((fn) => fn(id));
}

/** Called with the skin id whenever a skin is (re)registered or removed. */
export function onSkinChange(fn) {
  listeners.push(fn);
}

[classic, ...builtinSkins].forEach(registerSkin);

export function getSkin(id) {
  return skins.get(id) || skins.get('classic');
}

export function allSkins() {
  return [...skins.values()];
}

/**
 * Turns a plain (JSON) skin description, as made by the in-app editor, into a
 * skin. Resolves once the optional photo has loaded.
 *   { id, name, base, ink, gloss, pattern: 'marble', inkMetal, glow, alpha, pips, image: dataURL }
 */
export function skinFromData(data) {
  const skin = {
    id: data.id,
    name: data.name || 'Eigen skin',
    base: data.base || '#ffffff',
    ink: data.ink || '#000000',
    gloss: data.gloss ?? 0.35,
    pips: data.pips !== false,
    inkMetal: !!data.inkMetal,
    glow: data.glow ? data.ink : undefined,
    alpha: data.alpha && data.alpha < 1 ? data.alpha : undefined,
    pattern: PATTERNS[data.pattern]?.paint || null,
    custom: true,
    data,
  };
  if (!data.image) return Promise.resolve(skin);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ...skin, image: img });
    img.onerror = () => resolve(skin);
    img.src = data.image;
  });
}
