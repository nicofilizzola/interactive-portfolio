import { describe, expect, it } from 'vitest';
import { cameraDistanceForRadius, entranceStartY, visibleHalfHeight } from '../src/camera.js';

// tan(45deg / 2) === tan(PI / 8)
const HALF_FOV_TAN = Math.tan(Math.PI / 8);

describe('cameraDistanceForRadius', () => {
  it('is limited by the vertical field of view on a landscape viewport', () => {
    const distance = cameraDistanceForRadius(1.871, 45, 16 / 9);
    expect(distance).toBeCloseTo(1.871 / HALF_FOV_TAN, 4);
  });

  it('is limited by the horizontal field of view on a portrait viewport', () => {
    const aspect = 9 / 16;
    const distance = cameraDistanceForRadius(1.871, 45, aspect);
    expect(distance).toBeCloseTo(1.871 / (HALF_FOV_TAN * aspect), 4);
  });

  it('pulls the camera further back on a portrait viewport', () => {
    const landscape = cameraDistanceForRadius(1.871, 45, 16 / 9);
    const portrait = cameraDistanceForRadius(1.871, 45, 9 / 16);
    expect(portrait).toBeGreaterThan(landscape);
  });

  it('scales linearly with the radius it has to fit', () => {
    const single = cameraDistanceForRadius(1, 45, 1);
    const double = cameraDistanceForRadius(2, 45, 1);
    expect(double).toBeCloseTo(single * 2, 6);
  });
});

describe('visibleHalfHeight', () => {
  it('grows linearly with distance', () => {
    expect(visibleHalfHeight(10, 45)).toBeCloseTo(10 * HALF_FOV_TAN, 6);
    expect(visibleHalfHeight(20, 45)).toBeCloseTo(2 * visibleHalfHeight(10, 45), 6);
  });
});

describe('entranceStartY', () => {
  it('places the whole cube above the top edge of the frame', () => {
    const distance = 5;
    const radius = 1.386;
    const startY = entranceStartY(distance, 45, radius);
    expect(startY).toBeGreaterThan(visibleHalfHeight(distance, 45) + radius);
  });

  it('rises as the camera pulls back', () => {
    expect(entranceStartY(9, 45, 1.386)).toBeGreaterThan(entranceStartY(5, 45, 1.386));
  });
});
