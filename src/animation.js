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
