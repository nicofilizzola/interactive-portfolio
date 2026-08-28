import { clamp01 } from './math.js';

export function easeOutCubic(t) {
  const remaining = 1 - clamp01(t);
  return 1 - remaining * remaining * remaining;
}

export function easeOutQuart(t) {
  const remaining = 1 - clamp01(t);
  return 1 - remaining * remaining * remaining * remaining;
}
