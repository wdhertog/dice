// Built-in skins. See SKINS.md in the repository root for all options.
import { PATTERNS } from './patterns.js';

export const builtinSkins = [
  { id: 'ruby', name: 'Robijn', base: '#b5121b', ink: '#ffffff' },
  { id: 'sapphire', name: 'Saffier', base: '#1d4fc4', ink: '#ffffff' },
  { id: 'emerald', name: 'Smaragd', base: '#0f7a4a', ink: '#f5e6a8' },
  {
    id: 'onyx',
    name: 'Onyx & goud',
    base: '#141416',
    ink: '#e2b64a',
    inkMetal: true,
    edge: 'rgba(255,255,255,0.06)',
    pattern: PATTERNS.speckle.paint,
  },
  { id: 'marble', name: 'Marmer', base: '#efece6', ink: '#1b2a4a', pattern: PATTERNS.marble.paint, gloss: 0.5 },
  {
    id: 'wood',
    name: 'Hout',
    base: '#b27a45',
    ink: '#3a210d',
    pattern: PATTERNS.wood.paint,
    edge: 'rgba(60,30,10,0.35)',
    gloss: 0.15,
  },
  { id: 'neon', name: 'Neon', base: '#0d0f14', ink: '#39ff88', glow: '#39ff88', edge: 'rgba(57,255,136,0.25)' },
  { id: 'galaxy', name: 'Sterrenstelsel', base: '#120a2e', ink: '#ffffff', pattern: PATTERNS.galaxy.paint, edge: 'rgba(255,255,255,0.08)' },
  { id: 'amethyst', name: 'Amethist (glas)', base: '#8e4dff', ink: '#ffffff', alpha: 0.6, edge: 'rgba(255,255,255,0.25)', gloss: 0.55 },
];
