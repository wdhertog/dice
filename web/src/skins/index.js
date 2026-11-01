// Skin registry.
//
// A skin describes how a die looks. Add a new skin by calling registerSkin()
// (or adding an entry to the list below). Supported fields:
//
//   id, name        unique id and display name
//   base            face colour (CSS colour)
//   ink             colour of numbers / pips
//   edge            optional colour used to darken face borders (fake bevel)
//   pattern(ctx, w, h, rnd)  optional painter for the face background
//   font            optional CSS font family for numbers
//   pips            draw pips on d6 instead of numbers (default true)
//   material        options passed to THREE.MeshPhysicalMaterial
//   inkMetal        numbers are metallic (gold/silver inlay)
//   glow            colour for glowing numbers (emissive)
//   alpha           0..1 opacity of the die body (numbers stay opaque)

import classic from './classic.js';
import { builtinSkins } from './builtin.js';

const skins = new Map();

export function registerSkin(skin) {
  skins.set(skin.id, { pips: true, edge: 'rgba(0,0,0,0.18)', material: {}, ...skin });
}

[classic, ...builtinSkins].forEach(registerSkin);

export function getSkin(id) {
  return skins.get(id) || skins.get('classic');
}

export function allSkins() {
  return [...skins.values()];
}
