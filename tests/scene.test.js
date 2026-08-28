import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createScene } from '../src/scene.js';
import { visibleHalfHeight } from '../src/camera.js';
import { CAMERA_FOV, COLORS, CUBE_RADIUS, PARALLAX } from '../src/config.js';

describe('createScene', () => {
  it('builds an off-white scene containing the cube', () => {
    const view = createScene(1600, 900);
    expect(view.scene).toBeInstanceOf(THREE.Scene);
    expect(view.scene.background.getHex()).toBe(COLORS.background);
    expect(view.scene.getObjectByName('cube')).toBe(view.cube);
  });

  it('lights the scene with one ambient fill and one key light', () => {
    const lights = createScene(1600, 900).scene.children.filter((child) => child.isLight);
    expect(lights.filter((light) => light.isAmbientLight)).toHaveLength(1);
    expect(lights.filter((light) => light.isDirectionalLight)).toHaveLength(1);
  });

  it('frames the cube head-on from in front of it', () => {
    const view = createScene(1600, 900);
    expect(view.camera.aspect).toBeCloseTo(1600 / 900, 6);
    expect(view.camera.position.x).toBe(0);
    expect(view.camera.position.y).toBe(0);
    expect(view.camera.position.z).toBeGreaterThan(0);
  });

  it('starts the cube above the top edge of the frame', () => {
    const view = createScene(1600, 900);
    expect(view.startY).toBeGreaterThan(0);
  });

  it('pulls back and raises the entrance start when the viewport turns portrait', () => {
    const view = createScene(1600, 900);
    const landscapeZ = view.camera.position.z;
    const landscapeStartY = view.startY;

    view.resize(900, 1600);

    expect(view.camera.aspect).toBeCloseTo(900 / 1600, 6);
    expect(view.camera.position.z).toBeGreaterThan(landscapeZ);
    expect(view.startY).toBeGreaterThan(landscapeStartY);
  });

  it('keeps the whole cube inside the frame at every aspect, parallax included', () => {
    const view = createScene(1600, 900);

    for (const [w, h] of [[2133, 1012], [1600, 900], [900, 900], [390, 844], [280, 1000]]) {
      view.resize(w, h);
      const halfH = visibleHalfHeight(view.camera.position.z, CAMERA_FOV);
      const limiting = Math.min(halfH, halfH * (w / h));

      // Worst case is the cube at a corner-on orientation, pushed fully off-centre
      // by parallax. Derived from config so tightening FIT_MARGIN fails here.
      expect(limiting).toBeGreaterThan(CUBE_RADIUS + PARALLAX.maxOffset);
      expect(view.startY).toBeGreaterThan(halfH + CUBE_RADIUS);
    }
  });
});
