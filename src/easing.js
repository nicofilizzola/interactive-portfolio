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

// Quintic smoothstep. Both velocity and acceleration are zero at each end, so
// the dock spin settles without the angular-acceleration cutoff of smoothStep.
export function smootherStep(t) {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

// The dock transition's curve. Zero derivative at BOTH ends, and symmetric about
// (0.5, 0.5). The entrance uses easeOutCubic because it arrives already at
// speed; the dock starts from a standstill at screen centre, where an ease-out
// would begin at maximum velocity — the same defect the float's envelope exists
// to remove. The symmetry is what makes `expanding` an exact mirror of
// `shrinking`: run it at 1 - p and the cube retraces its path.
export function easeInOutCubic(t) {
  const x = clamp01(t);
  if (x < 0.5) return 4 * x * x * x;

  const remaining = 2 - 2 * x;
  return 1 - (remaining * remaining * remaining) / 2;
}
