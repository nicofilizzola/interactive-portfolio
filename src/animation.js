import { clamp01, lerp } from './math.js';
import { easeOutCubic, easeOutQuart, smoothStep } from './easing.js';

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
// Beyond `duration` it returns the constant total, and nothing adds to it.
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
// After the entrance `remaining` is pinned at 0, so BOTH angles are frozen
// forever: the cube holds its landing pose exactly. Every post-entrance
// rotation is the viewer's, added by the caller from src/drag.js — nothing here
// advances on its own.
//
// `yaw` is deliberately NOT reduced modulo 2PI. The starting value is a large
// negative angle, which is the same pose as its reduced form, and the cube is
// off-screen for the first ~0.36 s regardless; reducing it would break the
// exact landing and make the angle non-monotonic.
export function entranceRotation(elapsed, opts) {
  const total = entranceRevolutions(opts.duration, opts);
  const remaining = total - entranceRevolutions(elapsed, opts);

  return {
    yaw: opts.settleYaw - TAU * remaining,
    pitch: opts.settlePitch - opts.tumbleRatio * TAU * remaining,
  };
}

// The idle vertical bob. Two things keep it from reading as an event separate
// from the entrance.
//
// The smoothStep envelope: phase 0 of a sine is its steepest point, so an
// unramped bob's first instant is its fastest. S(0) = 0 and S'(0) = 0, and every
// term of y' and y'' at s = 0 carries a factor of S(0), S'(0), or sin(0), so
// position, velocity, and acceleration all start at exactly zero. The entrance
// also arrives with zero velocity and zero acceleration, so the total vertical
// motion is C^2 across the whole timeline.
//
// `overlap`: the float's clock starts that many seconds BEFORE the entrance
// ends, so the bob emerges from motion that is still live rather than following
// its corpse. See src/config.js for why 0.7 s is a ceiling and not taste.
export function floatOffset(elapsed, opts) {
  const since = elapsed - (opts.duration - opts.overlap);
  if (since <= 0) return 0;

  const envelope = smoothStep(since / opts.rampDuration);
  return opts.amplitude * envelope * Math.sin((TAU * since) / opts.period);
}
