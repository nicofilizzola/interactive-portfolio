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
