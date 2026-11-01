// Procedural background patterns for dice faces. Each painter gets the canvas
// context, its size and a seeded random function, and draws over the base colour.
// Used by the built-in skins and by the in-app skin editor.

function noise(ctx, w, h, rnd, alpha, count = (w * h) / 40) {
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rnd() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
}

export const PATTERNS = {
  none: { name: 'Effen', paint: null },
  speckle: {
    name: 'Spikkels',
    paint(ctx, w, h, rnd) {
      noise(ctx, w, h, rnd, 0.08);
    },
  },
  marble: {
    name: 'Marmer',
    paint(ctx, w, h, rnd) {
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
  },
  wood: {
    name: 'Hout',
    paint(ctx, w, h, rnd) {
      for (let y = 0; y < h; y += 3) {
        const shade = Math.sin(y * 0.09 + Math.sin(y * 0.013) * 4) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(60,30,5,${0.06 + shade * 0.22})`;
        ctx.fillRect(0, y + Math.sin(y * 0.05) * 2, w, 2 + rnd() * 2);
      }
      noise(ctx, w, h, rnd, 0.05);
    },
  },
  galaxy: {
    name: 'Sterren',
    paint(ctx, w, h, rnd) {
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
  },
  swirl: {
    name: 'Wervels',
    paint(ctx, w, h, rnd) {
      for (let i = 0; i < (w * h) / 5000; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.12})`;
        ctx.lineWidth = 2 + rnd() * 6;
        ctx.beginPath();
        ctx.arc(rnd() * w, rnd() * h, 10 + rnd() * 60, rnd() * 6, rnd() * 6 + 2);
        ctx.stroke();
      }
    },
  },
  stripes: {
    name: 'Strepen',
    paint(ctx, w, h) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let x = -h; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 18, 0);
        ctx.lineTo(x + 18 + h, h);
        ctx.lineTo(x + h, h);
        ctx.fill();
      }
    },
  },
};
