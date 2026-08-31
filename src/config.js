export const CUBE_SIZE = 1.6;
export const CUBE_RADIUS = (CUBE_SIZE * Math.sqrt(3)) / 2;
export const FIT_MARGIN = 1.35;
export const CAMERA_FOV = 45;

export const COLORS = {
  background: 0xf7f7f8,
  face: 0xd6d8dc,
  edge: 0x2563eb,
};

export const ENTRANCE = {
  duration: 3.5,
  endY: 0,
  startScale: 0.15,
  endScale: 1,
  // 5.7 rev/s is the hard ceiling: the cube's yaw is 90-degree symmetric, so
  // past 45 degrees of yaw per rendered frame the spin reads as running
  // backwards, and by the time the cube enters frame (~0.35 s) easeOutQuart has
  // already cut the speed to 0.656 of this value. 5.0 stays legible at 30 fps.
  startSpin: 5.0,
  endSpin: 0.035,
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
