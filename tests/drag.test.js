import { describe, expect, it } from 'vitest';
import { createDragSpin } from '../src/drag.js';

const TAU = Math.PI * 2;

const OPTS = {
  revsPerViewport: 1.0,
  releaseTau: 0.5,
  velocityTau: 0.06,
  maxSpeed: 2.5,
};

// Drag at a steady `distance` px per frame for `frames` frames, so the smoothed
// velocity estimate settles on the real drag speed.
function swipe(drag, { distance, frames, dt, viewportMin }) {
  drag.start(0);
  for (let i = 1; i <= frames; i += 1) {
    drag.move(distance * i);
    drag.update(dt, viewportMin);
  }
}

// Total yaw travelled after release, run long enough that the exponential tail
// is negligible (5 s is 10 time constants at releaseTau 0.5).
function coast(drag, { dt, viewportMin }) {
  const before = drag.update(0, viewportMin);
  let last = before;
  for (let t = 0; t < 5; t += dt) {
    last = drag.update(dt, viewportMin);
  }
  return last - before;
}

describe('createDragSpin', () => {
  it('does nothing at all without input', () => {
    const drag = createDragSpin(OPTS);
    expect(drag.update(1 / 60, 1000)).toBe(0);
    expect(drag.update(1 / 30, 1000)).toBe(0);
    expect(drag.update(10, 1000)).toBe(0);
  });

  it('turns exactly revsPerViewport for a drag of one viewport-minimum', () => {
    const drag = createDragSpin(OPTS);
    drag.start(0);
    drag.move(1000);
    expect(drag.update(1 / 60, 1000)).toBeCloseTo(TAU * OPTS.revsPerViewport, 12);
  });

  it('feels the same on a phone and a desktop: equal fractions, equal yaw', () => {
    const phone = createDragSpin(OPTS);
    phone.start(0);
    phone.move(390 * 0.4);
    const phoneYaw = phone.update(1 / 60, 390);

    const desktop = createDragSpin(OPTS);
    desktop.start(0);
    desktop.move(1920 * 0.4);
    const desktopYaw = desktop.update(1 / 60, 1920);

    expect(phoneYaw).toBeCloseTo(desktopYaw, 12);
    expect(phoneYaw).toBeCloseTo(TAU * OPTS.revsPerViewport * 0.4, 12);
  });

  it('carries the face under the finger with the finger: right is positive yaw', () => {
    const drag = createDragSpin(OPTS);
    drag.start(500);
    drag.move(600);
    expect(drag.update(1 / 60, 1000)).toBeGreaterThan(0);

    const back = createDragSpin(OPTS);
    back.start(500);
    back.move(400);
    expect(back.update(1 / 60, 1000)).toBeLessThan(0);
  });

  it('yields the same yaw at 30 fps and at 144 fps for the same pointer path', () => {
    const replay = (dt) => {
      const drag = createDragSpin(OPTS);
      drag.start(0);
      for (const x of [40, 120, 260, 300, 305]) {
        drag.move(x);
        drag.update(dt, 1000);
      }
      return drag.update(dt, 1000);
    };
    expect(replay(1 / 30)).toBeCloseTo(replay(1 / 144), 12);
  });

  it('treats several moves between two frames as one move to the final position', () => {
    const many = createDragSpin(OPTS);
    many.start(0);
    many.move(50);
    many.move(90);
    many.move(120);
    const manyYaw = many.update(1 / 60, 1000);

    const one = createDragSpin(OPTS);
    one.start(0);
    one.move(120);
    const oneYaw = one.update(1 / 60, 1000);

    expect(manyYaw).toBe(oneYaw);
  });

  it('coasts on release: monotonic, decelerating, total ~ omega_0 * releaseTau', () => {
    const dt = 1 / 120;

    const drag = createDragSpin(OPTS);
    swipe(drag, { distance: 8, frames: 60, dt, viewportMin: 1000 });
    drag.end();

    let previous = drag.update(0, 1000);
    let previousStep = Infinity;
    for (let i = 0; i < 240; i += 1) {
      const yaw = drag.update(dt, 1000);
      const step = yaw - previous;
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThan(previousStep);
      previous = yaw;
      previousStep = step;
    }

    // 8 px per 1/120 s = 960 px/s, and the estimate has settled over 0.5 s
    // (8 time constants at velocityTau 0.06), so omega_0 = 960 * gain.
    const omega0 = (960 * TAU * OPTS.revsPerViewport) / 1000;
    const fresh = createDragSpin(OPTS);
    swipe(fresh, { distance: 8, frames: 60, dt, viewportMin: 1000 });
    fresh.end();
    const total = coast(fresh, { dt, viewportMin: 1000 });
    expect(total).toBeGreaterThan(omega0 * OPTS.releaseTau * 0.9);
    expect(total).toBeLessThan(omega0 * OPTS.releaseTau * 1.1);
  });

  it('does not throw the cube when the drag paused before the release', () => {
    const drag = createDragSpin(OPTS);
    const dt = 1 / 60;
    swipe(drag, { distance: 8, frames: 30, dt, viewportMin: 1000 });

    // Hold the pointer still for 0.3 s: five time constants at velocityTau 0.06,
    // so the estimate falls to exp(-5) = 0.67% of the swipe speed.
    for (let t = 0; t < 0.3; t += dt) {
      drag.update(dt, 1000);
    }
    drag.end();

    expect(Math.abs(coast(drag, { dt, viewportMin: 1000 }))).toBeLessThan(TAU * 0.01);
  });

  it('keeps most of the throw when only the last frame was still', () => {
    const dt = 1 / 60;
    const full = createDragSpin(OPTS);
    swipe(full, { distance: 8, frames: 30, dt, viewportMin: 1000 });
    full.end();
    const fullCoast = coast(full, { dt, viewportMin: 1000 });

    const stalled = createDragSpin(OPTS);
    swipe(stalled, { distance: 8, frames: 30, dt, viewportMin: 1000 });
    stalled.update(dt, 1000); // one still frame, then release
    stalled.end();
    const stalledCoast = coast(stalled, { dt, viewportMin: 1000 });

    // exp(-1/60/0.06) = 75.7% of the release speed survives one still frame.
    expect(stalledCoast).toBeGreaterThan(fullCoast * 0.7);
  });

  it('caps the thrown velocity so a flick cannot strobe', () => {
    const drag = createDragSpin(OPTS);
    drag.start(0);
    drag.move(100000);
    drag.update(1 / 60, 1000);
    drag.end();

    // With the cap in place the coast is 1.25 revolutions (7.854 rad); the 5%
    // allowance covers the discrete sum, which overshoots the analytic
    // velocity * releaseTau by (dt/tau) / (1 - exp(-dt/tau)) = 0.84% at 120 fps.
    // Without the cap that single frame would fling it some 4600 rad.
    const total = coast(drag, { dt: 1 / 120, viewportMin: 1000 });
    expect(total).toBeLessThanOrEqual(TAU * OPTS.maxSpeed * OPTS.releaseTau * 1.05);
    expect(total).toBeGreaterThan(TAU * OPTS.maxSpeed * OPTS.releaseTau * 0.9);
  });

  it('treats a zero or negative frame delta as a no-op and never produces NaN', () => {
    const drag = createDragSpin(OPTS);
    drag.start(0);
    drag.move(300);
    expect(drag.update(0, 1000)).toBe(0);
    expect(drag.update(-1, 1000)).toBe(0);
    expect(drag.update(NaN, 1000)).toBe(0);

    const yaw = drag.update(1 / 60, 1000);
    expect(Number.isNaN(yaw)).toBe(false);
    expect(drag.update(0, 1000)).toBe(yaw);
  });

  it('folds in pointer travel that arrived after the last frame', () => {
    const drag = createDragSpin(OPTS);
    drag.start(0);
    drag.update(1 / 60, 1000);
    drag.move(120);
    drag.end();
    expect(drag.update(1 / 60, 1000)).toBeCloseTo(TAU * 0.12, 6);
  });
});

describe('start reports the coast it cancelled', () => {
  it('returns zero when the cube was already still', () => {
    const drag = createDragSpin(OPTS);
    expect(drag.start(100)).toBe(0);
  });

  it('returns the cancelled speed in revolutions per second', () => {
    const drag = createDragSpin(OPTS);
    // Throw the cube: 400 px of drag in one 1/60 s frame, then release.
    drag.start(0);
    drag.update(1 / 60, 1000);
    drag.move(400);
    drag.update(1 / 60, 1000);
    drag.end();

    const coasting = drag.update(1 / 60, 1000);
    expect(coasting).not.toBe(0);

    // A press on the coasting cube stops it dead and says how fast it was.
    const cancelledRevs = drag.start(400);
    expect(cancelledRevs).toBeGreaterThan(0);

    // Still means still: another frame adds no yaw.
    const held = drag.update(1 / 60, 1000);
    expect(drag.update(1 / 60, 1000)).toBeCloseTo(held, 12);
  });

  it('reports magnitude, so a leftward throw is not a negative speed', () => {
    const drag = createDragSpin(OPTS);
    drag.start(400);
    drag.update(1 / 60, 1000);
    drag.move(0);
    drag.update(1 / 60, 1000);
    drag.end();
    drag.update(1 / 60, 1000);

    expect(drag.start(0)).toBeGreaterThan(0);
  });
});

describe('brake', () => {
  it('stops a coast without starting a drag', () => {
    const drag = createDragSpin(OPTS);
    drag.start(0);
    drag.update(1 / 60, 1000);
    drag.move(400);
    drag.update(1 / 60, 1000);
    drag.end();

    const before = drag.update(1 / 60, 1000);
    drag.brake();

    // The yaw holds: no coast, and no drag delta from a pointer that never moved.
    expect(drag.update(1 / 60, 1000)).toBeCloseTo(before, 12);
    expect(drag.update(1 / 60, 1000)).toBeCloseTo(before, 12);
  });

  it('is a no-op on a still cube', () => {
    const drag = createDragSpin(OPTS);
    const before = drag.update(1 / 60, 1000);
    drag.brake();
    expect(drag.update(1 / 60, 1000)).toBeCloseTo(before, 12);
  });

  // A gesture that outlives its phase (Esc mid-drag, say) must not keep driving
  // the yaw: pointer capture keeps delivering pointermove regardless of what
  // the nav machine is doing, so brake() has to abandon the drag itself, not
  // only the coast.
  it('abandons a drag in flight: movement after brake does not advance the yaw', () => {
    const drag = createDragSpin(OPTS);
    const dt = 1 / 60;

    drag.start(0);
    drag.move(200);
    const before = drag.update(dt, 1000);

    drag.brake();

    drag.move(9000);
    expect(drag.update(dt, 1000)).toBeCloseTo(before, 12);

    drag.end();
    expect(drag.update(dt, 1000)).toBeCloseTo(before, 12);
  });
});
