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
export const FLOAT = {
  amplitude: 0.08,
  period: 5.0,
};

export const PARALLAX = {
  maxOffset: 0.22,
  maxTilt: 0.09,
  tau: 0.35,
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
