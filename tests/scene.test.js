import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createScene } from '../src/scene.js';
import { visibleHalfHeight } from '../src/camera.js';
import { CAMERA_FOV, COLORS, CUBE_RADIUS, CUBE_SIZE, ENTRANCE, FLOAT } from '../src/config.js';
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

describe('the dock framing', () => {
  // Derived in the plan's architecture reference. The dock button box and the
  // dock transition target both read these, so they are pinned here.
  const CASES = [
    // The plan's reference table lists this row's y as -1.9584, but that value
    // is inconsistent with the same row's own halfHeight (2.2170), dockScale
    // (0.11612), and px/unit (243.58) columns: plugging those into the dock.js
    // derivation gives -1.95758, not -1.9584. Verified independently (see the
    // task-4 report) — a second, undocumented table slip distinct from errata 1.
    { w: 1920, h: 1080, silhouette: 64, scale: 0.11612, y: -1.9576 },
    { w: 1440, h: 900, silhouette: 64, scale: 0.13936, y: -1.9057 },
    // Same slip as the 1920x1080 row above: the table's -1.9312 is inconsistent
    // with its own halfHeight/dockScale/px-per-unit columns, which give -1.93683.
    { w: 1000, h: 1000, silhouette: 64, scale: 0.12542, y: -1.9368 },
    // The 16% cap binds below ~400 px of minimum dimension. The spec's own table
    // omits the cap on this row and reports -4.079; see the plan's errata 1.
    { w: 390, h: 844, silhouette: 62.4, scale: 0.31354, y: -4.0907 },
  ];

  it('derives the dock scale and height from a CSS-pixel size at every aspect', () => {
    const view = createScene(1600, 900);

    for (const expected of CASES) {
      view.resize(expected.w, expected.h);
      expect(view.dockSilhouettePx).toBeCloseTo(expected.silhouette, 4);
      expect(view.dockScale).toBeCloseTo(expected.scale, 4);
      expect(view.dockY).toBeCloseTo(expected.y, 3);
    }
  });

  // The point of deriving the scale rather than reusing ENTRANCE.startScale: a
  // fixed scale draws a 30 px nav button on a phone and an 83 px one on a
  // desktop, because the camera distance varies with aspect ratio.
  it('draws the same physical size everywhere, unlike a fixed scale', () => {
    const view = createScene(1600, 900);

    for (const expected of CASES) {
      view.resize(expected.w, expected.h);
      const drawnPx = CUBE_SIZE * Math.SQRT2 * view.dockScale * view.pxPerWorldUnit;
      expect(drawnPx).toBeCloseTo(expected.silhouette, 3);
    }
  });

  it('leaves the docked cube clear of the bottom edge, float included', () => {
    const view = createScene(1600, 900);

    for (const [w, h] of [[1920, 1080], [1440, 900], [900, 900], [390, 844], [280, 1000]]) {
      view.resize(w, h);
      const halfH = visibleHalfHeight(view.camera.position.z, CAMERA_FOV);
      // Bounding-sphere clearance, so this holds at any pose, plus the docked
      // cube's float — the world amplitude times the dock scale.
      const lowest =
        view.dockY - CUBE_RADIUS * view.dockScale - FLOAT.amplitude * view.dockScale;

      expect(view.dockY).toBeLessThan(0);
      expect(lowest).toBeGreaterThan(-halfH);
    }
  });

  it('re-derives the dock framing on resize, so the getters are read live', () => {
    const view = createScene(1920, 1080);
    const landscapeY = view.dockY;
    const landscapeScale = view.dockScale;

    view.resize(390, 844);

    expect(view.dockY).toBeLessThan(landscapeY);
    expect(view.dockScale).toBeGreaterThan(landscapeScale);
  });
});
