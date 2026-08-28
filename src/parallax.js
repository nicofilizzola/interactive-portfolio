import { dampTowards } from './math.js';

function clampUnit(value) {
  if (value < -1) return -1;
  if (value > 1) return 1;
  return value;
}

export function createParallax({ maxOffset, maxTilt, tau }) {
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };

  return {
    // nx, ny are screen-normalized to [-1, 1]; ny grows downward like clientY.
    setPointer(nx, ny) {
      target.x = clampUnit(nx);
      target.y = clampUnit(ny);
    },

    update(dt) {
      current.x = dampTowards(current.x, target.x, tau, dt);
      current.y = dampTowards(current.y, target.y, tau, dt);

      // Negating a positive zero yields -0, which fails the suite's strict
      // toBe(0) assertions (Vitest's toBe uses Object.is) and would leak -0
      // to callers. `+ 0` normalizes it. Only offsetY negates a possibly-zero
      // value, so only offsetY needs it — do not "tidy" this away.
      return {
        offsetX: current.x * maxOffset,
        offsetY: -current.y * maxOffset + 0,
        tiltX: current.y * maxTilt,
        tiltY: current.x * maxTilt,
      };
    },
  };
}
