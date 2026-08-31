import { dampTowards } from './math.js';

const TAU = Math.PI * 2;

// Horizontal drag-to-spin with an exponential release coast. Stateful but pure:
// no three, no DOM, no events — main.js owns the listeners and calls in.
//
// The split between move() and update() is deliberate. Several pointermove
// events can fire per animation frame, so folding each one in as it arrives
// would make the total depend on the browser's event coalescing rate. move()
// only records; update() folds the accumulated delta once per frame.
export function createDragSpin({ revsPerViewport, releaseTau, velocityTau, maxSpeed }) {
  let dragging = false;
  let lastApplied = 0; // pointer x already folded into yaw
  let latest = 0; // most recent pointer x reported by move()
  let yaw = 0; // radians, unwrapped
  let velocity = 0; // radians per second

  return {
    start(x) {
      dragging = true;
      lastApplied = x;
      latest = x;
      // Pressing a coasting cube grabs it: without this, a tap would re-throw
      // the cube at its current speed instead of stopping it dead.
      velocity = 0;
    },

    move(x) {
      latest = x;
    },

    end() {
      dragging = false;
      const cap = maxSpeed * TAU;
      if (velocity > cap) velocity = cap;
      else if (velocity < -cap) velocity = -cap;
    },

    // `viewportMin` is min(innerWidth, innerHeight) — the dimension the camera
    // fits the cube to, so the gain tracks the cube's apparent size.
    update(dt, viewportMin) {
      // Also catches NaN: every comparison against NaN is false.
      if (!(dt > 0)) return yaw;

      const gain = (TAU * revsPerViewport) / Math.max(viewportMin, 1);

      if (dragging) {
        const delta = (latest - lastApplied) * gain;
        lastApplied = latest;
        yaw += delta;
        // Smoothed, not the raw per-frame rate: a drag that pauses before the
        // release must not throw the cube.
        velocity = dampTowards(velocity, delta / dt, velocityTau, dt);
      } else {
        yaw += velocity * dt;
        velocity = dampTowards(velocity, 0, releaseTau, dt);
      }

      return yaw;
    },
  };
}
