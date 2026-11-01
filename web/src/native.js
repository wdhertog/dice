// Bridge to the Android wrapper (shake detection, vibration).
// In a normal browser it falls back to DeviceMotion events and the keyboard.
const bridge = window.AndroidBridge;
const listeners = [];

export const native = {
  isAndroid: !!bridge,
  vibrationEnabled: true,
  vibrate(pattern) {
    if (!this.vibrationEnabled) return;
    const p = Array.isArray(pattern) ? pattern : [pattern];
    if (bridge) bridge.vibrate(p.join(','));
    else if (navigator.vibrate) navigator.vibrate(p);
  },
  onShake(fn) {
    listeners.push(fn);
  },
};

function emit(strength) {
  listeners.forEach((fn) => fn(strength));
}

// Called by MainActivity with the peak acceleration in g.
window.__onShake = (g) => emit(Number(g) || 2);

if (!bridge) {
  // Browser fallback: same algorithm as the Android side.
  const peaks = [];
  let lastShake = 0;
  let maxG = 0;
  window.addEventListener('devicemotion', (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    const g = Math.hypot(a.x, a.y, a.z) / 9.81;
    const now = performance.now();
    if (g > 1.9) {
      if (!peaks.length || now - peaks[peaks.length - 1] > 80) peaks.push(now);
      maxG = Math.max(maxG, g);
    }
    while (peaks.length && now - peaks[0] > 900) peaks.shift();
    if (peaks.length >= 2 && now - lastShake > 1200) {
      lastShake = now;
      peaks.length = 0;
      emit(maxG);
      maxG = 0;
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === 'r') {
      e.preventDefault();
      emit(2.5);
    }
  });
}
