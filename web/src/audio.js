// Synthesised dice sounds (no audio files needed).
let ctx = null;
let master = null;
let noiseBuf = null;
let last = 0;
export const audio = { enabled: true };

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ensure();
}

/** strength: impact speed, kind: 'dice' (dice hitting each other) or 'floor'. */
export function clack(strength, kind) {
  if (!audio.enabled) return;
  const c = ensure();
  if (!c) return;
  const now = performance.now();
  if (now - last < 25) return;
  last = now;
  const t = c.currentTime;
  const vol = Math.min(1, strength / 14) * (kind === 'dice' ? 0.9 : 0.7);
  const dur = kind === 'dice' ? 0.05 : 0.09;

  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = kind === 'dice' ? 2600 + Math.random() * 1800 : 700 + Math.random() * 500;
  bp.Q.value = kind === 'dice' ? 4 : 1.6;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t, Math.random() * 0.1);
  src.stop(t + dur + 0.02);

  if (kind === 'dice') {
    // Short resonant "tick" of hard plastic.
    const o = c.createOscillator();
    o.frequency.value = 3200 + Math.random() * 1500;
    const og = c.createGain();
    og.gain.setValueAtTime(vol * 0.25, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(og).connect(master);
    o.start(t);
    o.stop(t + 0.04);
  }
}

/** Soft "shake" rattle when a throw starts. */
export function rattle() {
  if (!audio.enabled) return;
  for (let i = 0; i < 6; i++) setTimeout(() => clack(6 + Math.random() * 6, 'dice'), i * 45 + Math.random() * 20);
}
