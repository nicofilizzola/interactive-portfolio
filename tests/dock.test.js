import { describe, expect, it } from 'vitest';
import { contentFade, dockState, fadeOpacity, yawSnapDelta } from '../src/dock.js';
import { DOCK, SETTLE } from '../src/config.js';

const QUARTER = Math.PI / 2;
const OPTS = { dockY: -1.9584, dockScale: 0.11612, yaw: SETTLE.yaw, settleYaw: SETTLE.yaw };

describe('yawSnapDelta', () => {
  it('is zero when the cube is already on a resting pose', () => {
    expect(yawSnapDelta(SETTLE.yaw, SETTLE.yaw)).toBeCloseTo(0, 12);
    for (const k of [-4, -1, 0, 1, 3]) {
      expect(yawSnapDelta(SETTLE.yaw + k * QUARTER, SETTLE.yaw)).toBeCloseTo(0, 12);
    }
  });

  it('takes the shortest signed path, in either direction', () => {
    expect(yawSnapDelta(SETTLE.yaw + 0.1, SETTLE.yaw)).toBeCloseTo(-0.1, 12);
    expect(yawSnapDelta(SETTLE.yaw - 0.1, SETTLE.yaw)).toBeCloseTo(0.1, 12);
    // 57.3 degrees past a resting pose is closer to the NEXT one, 32.7 forward.
    expect(yawSnapDelta(SETTLE.yaw + 1.0, SETTLE.yaw)).toBeCloseTo(QUARTER - 1.0, 12);
  });

  it('never turns more than a quarter of a quarter turn — 45 degrees', () => {
    for (let i = -720; i <= 720; i += 1) {
      const yaw = SETTLE.yaw + (i * Math.PI) / 180;
      expect(Math.abs(yawSnapDelta(yaw, SETTLE.yaw))).toBeLessThanOrEqual(QUARTER / 2 + 1e-12);
    }
  });

  it('lands exactly on a resting pose from anywhere, including +/-180 degrees', () => {
    for (const offset of [Math.PI, -Math.PI, 12.3, -45.6, QUARTER / 2]) {
      const yaw = SETTLE.yaw + offset;
      const landed = yaw + yawSnapDelta(yaw, SETTLE.yaw);
      const turns = (landed - SETTLE.yaw) / QUARTER;
      expect(turns).toBeCloseTo(Math.round(turns), 9);
    }
  });
});

describe('dockState', () => {
  it('starts at the resting pose', () => {
    const state = dockState(0, OPTS);
    expect(state.y).toBe(0);
    expect(state.scale).toBe(1);
    expect(state.yaw).toBeCloseTo(OPTS.yaw, 12);
  });

  it('ends on the dock, at a pose that is an exact quarter turn off settle', () => {
    const dragged = { ...OPTS, yaw: SETTLE.yaw + 1.0 };
    const state = dockState(1, dragged);
    expect(state.y).toBeCloseTo(OPTS.dockY, 12);
    expect(state.scale).toBeCloseTo(OPTS.dockScale, 12);

    const turns = (state.yaw - SETTLE.yaw) / QUARTER;
    expect(turns).toBeCloseTo(Math.round(turns), 9);
  });

  it('clamps progress instead of overshooting the dock', () => {
    expect(dockState(-1, OPTS).y).toBe(0);
    expect(dockState(4, OPTS).y).toBeCloseTo(OPTS.dockY, 12);
  });

  // Expanding is dockState run at 1 - p. easeInOutCubic is symmetric about
  // (0.5, 0.5), so the reverse pass retraces the forward one exactly and the
  // cube never appears to have moved while docked.
  it('is an exact mirror when run backwards', () => {
    for (let i = 0; i <= 20; i += 1) {
      const p = i / 20;
      const forward = dockState(p, OPTS);
      const backward = dockState(1 - p, OPTS);
      expect(forward.y + backward.y).toBeCloseTo(OPTS.dockY, 9);
      expect(forward.scale + backward.scale).toBeCloseTo(1 + OPTS.dockScale, 9);
    }
  });

  // Reopening starts from a yaw that is already snapped, so there is nothing
  // left to turn and the pose holds all the way back to centre.
  it('holds the yaw when reopening from an already-snapped pose', () => {
    const snapped = { ...OPTS, yaw: SETTLE.yaw + 3 * QUARTER };
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      expect(dockState(p, snapped).yaw).toBeCloseTo(snapped.yaw, 12);
    }
  });

  it('moves monotonically down and monotonically smaller', () => {
    let lastY = 1;
    let lastScale = 2;
    for (let i = 0; i <= 100; i += 1) {
      const state = dockState(i / 100, OPTS);
      expect(state.y).toBeLessThan(lastY);
      expect(state.scale).toBeLessThan(lastScale);
      lastY = state.y;
      lastScale = state.scale;
    }
  });
});

describe('contentFade', () => {
  it('holds the content when the route does not change — a dismissal', () => {
    expect(contentFade('work', 'work')).toBe('hold');
    expect(contentFade(null, null)).toBe('hold');
  });

  it('fades in from the landing page and out back to it', () => {
    expect(contentFade(null, 'work')).toBe('in');
    expect(contentFade('work', null)).toBe('out');
  });

  it('cross-fades between two content routes', () => {
    expect(contentFade('work', 'about')).toBe('cross');
  });
});

describe('fadeOpacity', () => {
  const START = DOCK.contentFadeStart;

  it('never moves the content in hold mode', () => {
    for (const p of [0, 0.5, 1]) expect(fadeOpacity('hold', p, START)).toBe(1);
  });

  it('holds the incoming page invisible until the cube has committed', () => {
    expect(fadeOpacity('in', 0, START)).toBe(0);
    expect(fadeOpacity('in', START, START)).toBe(0);
    expect(fadeOpacity('in', 0.7, START)).toBeCloseTo(0.5, 9);
    expect(fadeOpacity('in', 1, START)).toBeCloseTo(1, 9);
  });

  it('is the exact reverse when unmounting', () => {
    expect(fadeOpacity('out', 0, START)).toBeCloseTo(1, 9);
    expect(fadeOpacity('out', 0.3, START)).toBeCloseTo(0.5, 9);
    expect(fadeOpacity('out', 1 - START, START)).toBe(0);
    expect(fadeOpacity('out', 1, START)).toBe(0);
  });

  // This is what makes the mid-transition DOM swap invisible. The single curve
  // the spec proposes gives 0.1667 here, not 0 — see the plan's errata 2.
  it('reaches exactly zero at the midpoint when cross-fading', () => {
    expect(fadeOpacity('cross', 0, START)).toBeCloseTo(1, 9);
    expect(fadeOpacity('cross', 0.5, START)).toBeCloseTo(0, 12);
    expect(fadeOpacity('cross', 1, START)).toBeCloseTo(1, 9);
  });

  it('stays inside [0, 1] for every mode and any progress', () => {
    for (const mode of ['hold', 'in', 'out', 'cross']) {
      for (let i = -10; i <= 110; i += 1) {
        const value = fadeOpacity(mode, i / 100, START);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});
