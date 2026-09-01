import { easeInOutCubic } from './easing.js';
import { clamp01, lerp } from './math.js';

const QUARTER_TURN = Math.PI / 2;

// The shortest signed angle from `yaw` to the nearest settleYaw + k * 90 degrees
// — at most 45 degrees either way. The docked cube should read as a cube
// (edge-on shows three faces; face-on reads as a flat square) and should keep the
// recorded resting pose, but the viewer may have dragged it anywhere.
//
// Snap, do not spin: a multi-revolution turn would be "similar to the appearance
// animation" in the literal sense and wrong here. The entrance's spin is a
// curtain-raiser; this is a 0.9 s UI transition.
export function yawSnapDelta(yaw, settleYaw) {
  const offset = yaw - settleYaw;
  // Wrap the offset into (-45, +45] degrees around the nearest quarter turn.
  const wrapped = offset - QUARTER_TURN * Math.round(offset / QUARTER_TURN);
  return -wrapped;
}

// The dock transition, as a pure function of progress. 0 is the resting pose at
// screen centre; 1 is the docked pose.
//
// EXPANDING IS THIS SAME FUNCTION RUN AT 1 - progress. easeInOutCubic is
// symmetric about (0.5, 0.5), so the reverse pass retraces the forward one
// exactly; and because reopening starts from an already-snapped yaw, the snap
// delta is then 0 and the cube never appears to have moved while docked.
//
// `opts.yaw` is a snapshot taken by the caller when the transition starts, not a
// live read: a coasting drag must not move the target mid-flight.
export function dockState(progress, opts) {
  const eased = easeInOutCubic(clamp01(progress));

  return {
    // The resting Y is 0 (ENTRANCE.endY); the caller adds the float on top.
    y: lerp(0, opts.dockY, eased),
    scale: lerp(1, opts.dockScale, eased),
    yaw: opts.yaw + yawSnapDelta(opts.yaw, opts.settleYaw) * eased,
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
