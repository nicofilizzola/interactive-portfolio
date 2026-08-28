function halfFovTan(fovDeg) {
  // fovDeg is the full vertical FOV in degrees; (deg * PI / 360) is half of it in radians.
  return Math.tan((fovDeg * Math.PI) / 360);
}

export function visibleHalfHeight(distance, fovDeg) {
  return halfFovTan(fovDeg) * distance;
}

export function cameraDistanceForRadius(radius, fovDeg, aspect) {
  const halfV = halfFovTan(fovDeg);
  const halfH = halfV * aspect;
  return radius / Math.min(halfV, halfH);
}

export function entranceStartY(distance, fovDeg, radius) {
  // One cube radius of clearance past the top edge, plus a small margin so the cube
  // is fully hidden even with an antialiasing fringe.
  return visibleHalfHeight(distance, fovDeg) + radius + 0.2;
}
