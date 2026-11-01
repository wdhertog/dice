// Built-in skins. Patterns are painted procedurally on a canvas, so no image
// assets are needed. A skin may also use an image: draw it in pattern() with
// ctx.drawImage once it is loaded (see README).

function noise(ctx, w, h, rnd, alpha, count = (w * h) / 40) {
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rnd() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
}

export const builtinSkins = [
  {
    id: 'ruby',
    name: 'Robijn',
    base: '#b5121b',
    ink: '#ffffff',
    material: { roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.25 },
  },
  {
    id: 'sapphire',
    name: 'Saffier',
    base: '#1d4fc4',
    ink: '#ffffff',
    material: { roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.25 },
  },
  {
    id: 'emerald',
    name: 'Smaragd',
    base: '#0f7a4a',
    ink: '#f5e6a8',
    material: { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 },
  },
  {
    id: 'onyx',
    name: 'Onyx & goud',
    base: '#141416',
    ink: '#e2b64a',
    inkMetal: true,
    edge: 'rgba(255,255,255,0.06)',
    pattern(ctx, w, h, rnd) {
      noise(ctx, w, h, rnd, 0.05);
    },
    material: { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 },
  },
  {
    id: 'marble',
    name: 'Marmer',
    base: '#efece6',
    ink: '#1b2a4a',
    pattern(ctx, w, h, rnd) {
      for (let i = 0; i < (w * h) / 9000; i++) {
        ctx.strokeStyle = `rgba(90,90,100,${0.08 + rnd() * 0.2})`;
        ctx.lineWidth = 0.5 + rnd() * 2.5;
        ctx.beginPath();
        let x = rnd() * w;
        let y = rnd() * h;
        ctx.moveTo(x, y);
        for (let s = 0; s < 6; s++) {
          const nx = x + (rnd() - 0.5) * 160;
          const ny = y + (rnd() - 0.3) * 160;
          ctx.quadraticCurveTo(x + (rnd() - 0.5) * 80, y + (rnd() - 0.5) * 80, nx, ny);
          x = nx;
          y = ny;
        }
        ctx.stroke();
      }
    },
    material: { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 },
  },
  {
    id: 'wood',
    name: 'Hout',
    base: '#b27a45',
    ink: '#3a210d',
    pips: true,
    pattern(ctx, w, h, rnd) {
      for (let y = 0; y < h; y += 3) {
        const shade = Math.sin(y * 0.09 + Math.sin(y * 0.013) * 4) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(80,45,15,${0.06 + shade * 0.22})`;
        ctx.fillRect(0, y + Math.sin(y * 0.05) * 2, w, 2 + rnd() * 2);
      }
      noise(ctx, w, h, rnd, 0.05);
    },
    edge: 'rgba(60,30,10,0.35)',
    material: { roughness: 0.7, clearcoat: 0.2 },
  },
  {
    id: 'neon',
    name: 'Neon',
    base: '#0d0f14',
    ink: '#39ff88',
    glow: '#39ff88',
    edge: 'rgba(57,255,136,0.25)',
    material: { roughness: 0.4, clearcoat: 0.8 },
  },
  {
    id: 'galaxy',
    name: 'Sterrenstelsel',
    base: '#120a2e',
    ink: '#ffffff',
    pattern(ctx, w, h, rnd) {
      for (let i = 0; i < (w * h) / 60000 + 4; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = 60 + rnd() * 200;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const hue = 230 + rnd() * 90;
        g.addColorStop(0, `hsla(${hue},80%,55%,0.45)`);
        g.addColorStop(1, `hsla(${hue},80%,40%,0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < (w * h) / 900; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
        const s = rnd() < 0.1 ? 2.5 : 1.2;
        ctx.fillRect(rnd() * w, rnd() * h, s, s);
      }
    },
    edge: 'rgba(255,255,255,0.08)',
    material: { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 },
  },
  {
    id: 'amethyst',
    name: 'Amethist (glas)',
    base: '#8e4dff',
    ink: '#ffffff',
    alpha: 0.6,
    edge: 'rgba(255,255,255,0.25)',
    material: { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.5 },
  },
];
