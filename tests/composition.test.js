import { describe, expect, it } from 'vitest';
import { centeredComposition, compositionGapPx } from '../src/composition.js';

describe('compositionGapPx', () => {
  it('implements clamp(2rem, 5vmin, 4rem)', () => {
    expect(compositionGapPx(1920, 1080, 16)).toBe(54);
    expect(compositionGapPx(1000, 1000, 16)).toBe(50);
    expect(compositionGapPx(390, 844, 16)).toBe(32);
    expect(compositionGapPx(280, 1000, 16)).toBe(32);
  });

  it('respects a non-default root font size', () => {
    expect(compositionGapPx(200, 1000, 20)).toBe(40);
    expect(compositionGapPx(2000, 2000, 20)).toBe(80);
  });
});

describe('centeredComposition', () => {
  const layout = centeredComposition({
    viewportHeight: 1000,
    headingHeight: 100,
    gap: 50,
    zeroBounds: { top: 400, bottom: 600, centerY: 500 },
    unitBounds: { top: 200, bottom: 400, centerY: 300 },
  });

  it('moves the cube visual center below the viewport center', () => {
    expect(layout.landingY).toBeCloseTo(-0.375, 12);
    expect(layout.cubeTopPx).toBeCloseTo(475, 12);
    expect(layout.cubeBottomPx).toBeCloseTo(675, 12);
  });

  it('places the heading exactly one nominal gap above the cube', () => {
    expect(layout.headingTopPx).toBeCloseTo(325, 12);
    expect(layout.cubeTopPx - (layout.headingTopPx + 100)).toBeCloseTo(50, 12);
  });

  it('centers the combined heading and cube bounds', () => {
    expect(layout.groupCenterPx).toBeCloseTo(500, 12);
  });

  it('rejects projection samples with no vertical slope', () => {
    expect(() =>
      centeredComposition({
        viewportHeight: 1000,
        headingHeight: 100,
        gap: 50,
        zeroBounds: { top: 400, bottom: 600, centerY: 500 },
        unitBounds: { top: 400, bottom: 600, centerY: 500 },
      }),
    ).toThrow(RangeError);
  });
});
