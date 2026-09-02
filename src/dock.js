import { easeInOutCubic, smoothStep } from './easing.js';
import { clamp01, lerp } from './math.js';

const TAU = Math.PI * 2;
const QUARTER_TURN = Math.PI / 2;

// The shortest signed angle from `yaw` to the nearest settleYaw + k * 90 degrees
// — at most 45 degrees either way. The docked cube must remain edge-on so its
// pose and CSS-pixel silhouette stay exact. A transition may add whole turns to
// this snap; whole turns preserve the same final pose.
export function yawSnapDelta(yaw, settleYaw) {
  const offset = yaw - settleYaw;
  // Wrap the offset into (-45, +45] degrees around the nearest quarter turn.
  const wrapped = offset - QUARTER_TURN * Math.round(offset / QUARTER_TURN);
  return -wrapped;
}

// Option B: every dock transition spins unless reduced motion removes the
// decorative revolution. Route and phase do not affect this policy.
export function dockSpin(reduced, revolutions) {
  return reduced ? 0 : revolutions;
}

// Pure dock transition. Position and scale retain easeInOutCubic. Yaw uses the
// lower-peak smoothStep curve so one revolution stays well below the cube's
// strobing ceiling. Expanding runs this same function at 1 - progress and is an
// exact backward mirror.
export function dockState(progress, opts) {
  const p = clamp01(progress);
  const travel = easeInOutCubic(p);
  const turn =
    yawSnapDelta(opts.yaw, opts.settleYaw) + TAU * (opts.spinRevolutions ?? 0);

  return {
    // The resting Y is 0 (ENTRANCE.endY); the caller adds the float on top.
    y: lerp(0, opts.dockY, travel),
    scale: lerp(1, opts.dockScale, travel),
    yaw: opts.yaw + turn * smoothStep(p),
  };
}

// Which content fade a transition needs, from the routes on either side of it.
// These are the only four shapes a route pair can take.
export function contentFade(fromRoute, toRoute) {
  // A dismissal: the nav opened over a page and closed again. The content never
  // moves, so touching its opacity at all would be a visible flicker.
  if (fromRoute === toRoute) return 'hold';
  if (fromRoute === null) return 'in';
  if (toRoute === null) return 'out';
  return 'cross';
}

// `contentFadeStart` 0.4 keeps the incoming page invisible for the front 40% of
// the transition, so the cube visibly commits to moving before the page arrives.
//
// 'cross' ignores it and uses |2p - 1|, which is exactly 0 at the midpoint. That
// is what makes the mid-transition DOM swap invisible — the fade-in curve is
// 0.1667 at the midpoint, not 0, so it cannot serve both jobs.
export function fadeOpacity(mode, progress, contentFadeStart) {
  const p = clamp01(progress);

  if (mode === 'hold') return 1;
  if (mode === 'cross') return Math.abs(2 * p - 1);

  if (mode === 'in') {
    if (p <= contentFadeStart) return 0;
    return (p - contentFadeStart) / (1 - contentFadeStart);
  }

  // 'out': the exact reverse of 'in', so a round trip is symmetric.
  if (p >= 1 - contentFadeStart) return 0;
  return 1 - p / (1 - contentFadeStart);
}
