export const CUBE_SIZE = 1.6;
export const CUBE_RADIUS = (CUBE_SIZE * Math.sqrt(3)) / 2;
export const FIT_MARGIN = 1.6;
export const CAMERA_FOV = 45;

export const COLORS = {
  background: 0xf7f7f8,
  face: 0xd6d8dc,
};

export const ENTRANCE = {
  duration: 3.5,
  endY: 0,
  startScale: 0.15,
  endScale: 1,
  // 4.5 sits under the ceiling, with headroom. The cube's yaw is 90-degree
  // symmetric, so past 45 degrees of yaw per rendered frame the spin reads as
  // running backwards. The cube enters frame earlier on taller viewports, where
  // easeOutQuart has cut away less of the peak — measured against FIT_MARGIN
  // 1.6 with the scale ramp included, the 30 fps cap is 5.78 in landscape, 5.10
  // at 9:16, and 4.90 on a 9:19.5 phone, where 4.5 lands at 41.3 degrees per
  // frame. Raising FIT_MARGIN lowers every one of those; re-measure the
  // tall-viewport case before touching either number.
  startSpin: 4.5,
  // Zero, not a small drift: the decay curve itself has to terminate at a
  // standstill. easeOutQuart's derivative is 0 at p = 1, so the cube glides to a
  // stop. All post-entrance rotation comes from the viewer's drag.
  endSpin: 0,
};

// The idle vertical bob: the page's only autonomous motion once the entrance
// ends. `amplitude` is in world units, deliberately sized against the cube
// (0.16 peak-to-peak = 10% of CUBE_SIZE) rather than against the viewport, so
// that changing FIT_MARGIN does not silently change how large the bob reads.
//
// `rampDuration` is the smoothStep amplitude envelope. It exists because phase 0
// of a sine is its STEEPEST point: unramped, the bob's first instant was its
// fastest (0.1005 u/s, one visible pixel in 0.041 s) and the motion switched on
// rather than beginning. 1.5 s is the knee — the onset is 8.1x slower while the
// first upswing still reaches 97% of the amplitude, so the bob does not look
// like it is warming up for two cycles. Past 2.0 s the first peak is visibly
// clipped and the first cycle reads as a different size from the later ones.
export const FLOAT = {
  amplitude: 0.08,
  period: 5.0,
  rampDuration: 1.5,
  // The float's clock starts 0.7 s BEFORE the entrance ends. By p = 0.80
  // (t = 2.80 s) the cube is within 7.4 px of centre at 99.7% scale, turning at
  // 2.6 deg/s — visually parked — and it then sat still for the remaining 0.7 s
  // before the bob switched on. The viewer saw arrive / hold / twitch, three
  // beats, where the intent is one continuous settling. The overlap costs
  // nothing legible from the entrance and buys the whole dead beat back.
  //
  // 0.7 is the CEILING, not a taste knob. Through the overlap the entrance
  // offset and the float's first upward half-cycle add, and two maxima have to
  // stay under `amplitude`: the entrance offset at the onset (startY * 0.008,
  // worst 0.0760 at a 280x1000 viewport) and the float's own first peak
  // (0.96977 * amplitude = 0.0776). At 1.0 s the sum reaches 0.0887 and the
  // bound in tests/scene.test.js must be widened too. Raising FIT_MARGIN raises
  // startY and eats the same headroom.
  //
  // Consequence, deliberate: floatOffset(3.5) is 0.0277430, not 0.
  overlap: 0.7,
};

// Drag-to-spin. `revsPerViewport` is measured against min(innerWidth,
// innerHeight) — the same dimension the camera fits the cube to — so the gain
// stays proportional to the cube's apparent size and the feel is identical on a
// phone and a desktop. Useful tuning range is 0.6 (heavy, furniture-like) to
// 1.5 (flicky).
//
// `maxSpeed` caps the released coast only, never the drag itself: 2.5 rev/s is
// 30 degrees of yaw per frame at 30 fps, under the 45-degree limit where the
// cube's 90-degree-symmetric yaw starts reading as running backwards. The coast
// angle is exactly velocity * releaseTau, so the longest possible throw is
// 2.5 * 0.5 = 1.25 revolutions.
export const DRAG = {
  revsPerViewport: 1.0,
  releaseTau: 0.5,
  velocityTau: 0.06,
  maxSpeed: 2.5,
};

// The pose the entrance lands on: a vertical edge facing the camera (yaw is a
// quarter turn offset by 45 degrees) with the top face tilted into view.
// Positive pitch shows the top; negative would show the bottom.
export const SETTLE = {
  yaw: Math.PI / 4,
  pitch: (15 * Math.PI) / 180,
};

// Vertical tumble during the entrance only, as a fraction of the yaw covered.
// It terminates on SETTLE.pitch; after the entrance nothing but the yaw moves.
export const ENTRANCE_TUMBLE_RATIO = 0.35;

export const MAX_PIXEL_RATIO = 2;
export const MAX_FRAME_DELTA = 0.1;
