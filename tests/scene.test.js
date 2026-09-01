import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createScene } from '../src/scene.js';
import { visibleHalfHeight } from '../src/camera.js';
import { CAMERA_FOV, COLORS, CUBE_RADIUS, ENTRANCE, FLOAT } from '../src/config.js';
import { entranceState, floatOffset } from '../src/animation.js';

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

  it('keeps the whole cube inside the frame at every aspect, idle float included', () => {
    const view = createScene(1600, 900);

    for (const [w, h] of [[2133, 1012], [1600, 900], [900, 900], [390, 844], [280, 1000]]) {
      view.resize(w, h);
      const halfH = visibleHalfHeight(view.camera.position.z, CAMERA_FOV);
      const limiting = Math.min(halfH, halfH * (w / h));

      // Worst case is the cube at a corner-on orientation, displaced by the full
      // idle float. Derived from config so tightening FIT_MARGIN fails here.
      expect(limiting).toBeGreaterThan(CUBE_RADIUS + FLOAT.amplitude);
      expect(view.startY).toBeGreaterThan(halfH + CUBE_RADIUS);
    }
  });

  it('keeps the entrance tail plus the overlapping float inside the float bound', () => {
    const view = createScene(1600, 900);

    for (const [w, h] of [[2133, 1012], [1600, 900], [900, 900], [390, 844], [280, 1000]]) {
      view.resize(w, h);
      const entranceOpts = { ...ENTRANCE, startY: view.startY };
      const floatOpts = { ...FLOAT, duration: ENTRANCE.duration };

      // Through the overlap the entrance offset and the float's first upward
      // half-cycle are both positive and ADD. This is the constraint that pins
      // FLOAT.overlap at 0.7 s: raise it, or raise FIT_MARGIN (which raises
      // startY), and this fails before anything visibly leaves the frame.
      let peak = 0;
      const onset = ENTRANCE.duration - FLOAT.overlap;
      for (let i = 0; i <= 2000; i += 1) {
        const t = onset + (i / 2000) * (FLOAT.period / 2);
        const sum = entranceState(t, entranceOpts).y + floatOffset(t, floatOpts);
        if (sum > peak) peak = sum;
      }

      expect(peak).toBeLessThan(FLOAT.amplitude);
    }
  });
});
