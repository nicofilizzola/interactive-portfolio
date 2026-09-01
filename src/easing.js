import { clamp01 } from './math.js';

export function easeOutCubic(t) {
  const remaining = 1 - clamp01(t);
  return 1 - remaining * remaining * remaining;
}

export function easeOutQuart(t) {
  const remaining = 1 - clamp01(t);
  return 1 - remaining * remaining * remaining * remaining;
}

// The float's amplitude envelope. S(0) = 0 and S'(0) = 0, so multiplying a sine
// by S(s / T) makes the float's position, velocity, AND acceleration all start
// at exactly zero — the bob does not switch on, it emerges. A linear ramp would
// give S'(0) = 1/T and only fix the position.
export function smoothStep(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}
