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
  startSpin: 3.0,
  endSpin: 0.035,
};

export const PARALLAX = {
  maxOffset: 0.22,
  maxTilt: 0.09,
  tau: 0.35,
};

export const SPIN_TILT_RATIO = 0.35;
export const MAX_PIXEL_RATIO = 2;
export const MAX_FRAME_DELTA = 0.1;
