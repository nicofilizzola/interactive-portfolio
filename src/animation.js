import { clamp01, lerp } from './math.js';
import { easeOutCubic, easeOutQuart } from './easing.js';

export function entranceState(elapsed, opts) {
  const progress = clamp01(elapsed / opts.duration);
  const travel = easeOutCubic(progress);
  const spinDecay = easeOutQuart(progress);

  return {
    y: lerp(opts.startY, opts.endY, travel),
    scale: lerp(opts.startScale, opts.endScale, travel),
    spinSpeed: lerp(opts.startSpin, opts.endSpin, spinDecay),
    progress,
    done: progress >= 1,
  };
}

// Revolutions covered from t = 0 to `elapsed`: the exact integral of the
// entrance's spin-speed curve, `lerp(startSpin, endSpin, easeOutQuart(p))`.
// The (1 - p)^5 / 5 term is easeOutQuart's antiderivative, so this is only
// valid while the spin decays on quart — see the plan's Global Constraints.
// Beyond `duration` it returns the constant total; the idle drift is added by
// the caller, not accumulated here.
export function entranceRevolutions(elapsed, opts) {
  const p = clamp01(elapsed / opts.duration);
  const remaining = 1 - p;
  const remainingPow5 = remaining * remaining * remaining * remaining * remaining;
  const eased = p - (1 - remainingPow5) / 5;

  return opts.duration * (opts.startSpin * p + (opts.endSpin - opts.startSpin) * eased);
}

const TAU = Math.PI * 2;

// The entrance rotation, written backwards from the pose it must land on: what
// is left to cover, rather than what has been covered. `remaining` hits exactly
// 0 at `duration`, so the cube arrives on `settleYaw`/`settlePitch` with no
// floating-point slack and no dependence on frame rate or on `startSpin`.
//
// After the entrance `remaining` is pinned at 0: the pitch is frozen on
// `settlePitch` forever and only the yaw advances, at `endSpin`. That is the
// horizontal-only idle float — no branch needed.
//
// `yaw` is deliberately NOT reduced modulo 2PI. The starting value is a large
// negative angle, which is the same pose as its reduced form, and the cube is
// off-screen for the first ~0.35 s regardless; reducing it would break the
// exact landing and make the angle non-monotonic.
export function entranceRotation(elapsed, opts) {
  const total = entranceRevolutions(opts.duration, opts);
  const remaining = total - entranceRevolutions(elapsed, opts);
  const idleRevolutions = Math.max(0, elapsed - opts.duration) * opts.endSpin;

  return {
    yaw: opts.settleYaw - TAU * remaining + TAU * idleRevolutions,
    pitch: opts.settlePitch - opts.tumbleRatio * TAU * remaining,
  };
}

// The idle vertical bob, phased from the end of the entrance rather than from
// page load. `since` is clamped at 0, so this returns exactly 0 for the whole
// entrance and the cube always begins its float moving upward from centre.
// The velocity step at the handover (amplitude * TAU / period = 0.100 u/s
// against an entrance peak of 3.6 u/s) is 2.8% and is deliberately not ramped.
export function floatOffset(elapsed, opts) {
  const since = Math.max(0, elapsed - opts.duration);
  return opts.amplitude * Math.sin((TAU * since) / opts.period);
}
