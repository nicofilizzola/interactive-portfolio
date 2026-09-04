export function compositionGapPx(width, height, rootFontPx) {
  const preferred = 0.05 * Math.min(width, height);
  return Math.min(4 * rootFontPx, Math.max(2 * rootFontPx, preferred));
}

export function centeredComposition({
  viewportHeight,
  headingHeight,
  gap,
  zeroBounds,
  unitBounds,
}) {
  const centerSlope = unitBounds.centerY - zeroBounds.centerY;
  if (!Number.isFinite(centerSlope) || Math.abs(centerSlope) < Number.EPSILON) {
    throw new RangeError('Projected cube center must move when world-space Y changes');
  }

  // If two vertical boxes are separated by `gap`, their combined center is
  // half (headingHeight + gap) above the lower box's visual center.
  const targetCubeCenter = viewportHeight / 2 + (headingHeight + gap) / 2;
  const landingY = (targetCubeCenter - zeroBounds.centerY) / centerSlope;
  const cubeTopPx = zeroBounds.top + (unitBounds.top - zeroBounds.top) * landingY;
  const cubeBottomPx =
    zeroBounds.bottom + (unitBounds.bottom - zeroBounds.bottom) * landingY;
  const headingTopPx = cubeTopPx - gap - headingHeight;

  return {
    landingY,
    headingTopPx,
    cubeTopPx,
    cubeBottomPx,
    groupCenterPx: (headingTopPx + cubeBottomPx) / 2,
  };
}
