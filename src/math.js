export function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function lerp(from, to, t) {
  return from + (to - from) * t;
}

export function dampTowards(current, target, tau, dt) {
  if (tau <= 0) return target;
  return target + (current - target) * Math.exp(-dt / tau);
}
