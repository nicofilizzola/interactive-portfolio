import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createScene } from '../src/scene.js';
import { visibleHalfHeight } from '../src/camera.js';
import {
  CAMERA_FOV,
  COLORS,
  CUBE_RADIUS,
  CUBE_SIZE,
  ENTRANCE,
  FLOAT,
} from '../src/config.js';
import { entranceState, floatOffset } from '../src/animation.js';
import { centeredComposition, compositionGapPx } from '../src/composition.js';

const VIEWPORTS = [
  [1920, 1080],
  [1440, 900],
  [1000, 1000],
  [390, 844],
  [280, 1000],
  [844, 390],
];

function headingHeightPx(width, height) {
  const fontSize = Math.min(112, Math.max(36, Math.min(0.11 * width, 0.11 * height)));
  return 0.9 * fontSize;
}

function applyTestComposition(view, width, height) {
  const headingHeight = headingHeightPx(width, height);
  const gap = compositionGapPx(width, height, 16);
  const layout = centeredComposition({
    viewportHeight: height,
    headingHeight,
    gap,
    zeroBounds: view.projectCubeBounds({ y: 0 }),
    unitBounds: view.projectCubeBounds({ y: 1 }),
  });
  view.setLandingY(layout.landingY);
  return { headingHeight, gap, layout };
}

describe('createScene', () => {
  it('builds an off-white scene containing the cube', () => {
    const view = createScene(1600, 900);
    expect(view.scene).toBeInstanceOf(THREE.Scene);
    expect(view.scene.background.getHex()).toBe(COLORS.background);
    expect(view.scene.getObjectByName('cube')).toBe(view.cube);
  });

  it('exposes the cube\'s armed-face control alongside the mesh', () => {
    const view = createScene(1600, 900);
    expect(view.scene.getObjectByName('cube')).toBe(view.cube);
    expect(typeof view.setArmedFace).toBe('function');

    view.setArmedFace(2);
    expect(view.cube.material[2].color.getHex()).toBe(COLORS.faceArmed);
    view.setArmedFace(null);
    expect(view.cube.material[2].color.getHex()).toBe(COLORS.face);
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

  it('draws the settled cube at 43–44 percent of the smaller viewport dimension', () => {
    const view = createScene(1600, 900);

    for (const [width, height] of VIEWPORTS) {
      view.resize(width, height);
      const bounds = view.projectCubeBounds();
      const fraction = bounds.width / Math.min(width, height);
      expect(fraction).toBeGreaterThanOrEqual(0.43);
      expect(fraction).toBeLessThanOrEqual(0.45);
    }
  });

  it('centers the neutral heading and cube as one visual group', () => {
    const view = createScene(1600, 900);

    for (const [width, height] of VIEWPORTS) {
      view.resize(width, height);
      const { layout } = applyTestComposition(view, width, height);
      const placed = view.projectCubeBounds({ y: view.landingY });
      const actualCenter = (layout.headingTopPx + placed.bottom) / 2;
      expect(Math.abs(actualCenter - height / 2)).toBeLessThanOrEqual(2);
    }
  });

  it('keeps at least 16 pixels between the fixed heading and the floating cube', () => {
    const view = createScene(1600, 900);

    for (const [width, height] of VIEWPORTS) {
      view.resize(width, height);
      const { headingHeight, layout } = applyTestComposition(view, width, height);
      const headingBottom = layout.headingTopPx + headingHeight;

      for (let degrees = 0; degrees < 360; degrees += 1) {
        const bounds = view.projectCubeBounds({
          y: view.landingY + FLOAT.amplitude,
          yaw: (degrees * Math.PI) / 180,
        });
        expect(bounds.top - headingBottom).toBeGreaterThanOrEqual(16);
      }
    }
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
      applyTestComposition(view, w, h);
      const entranceOpts = { ...ENTRANCE, startY: view.startY, endY: view.landingY };
      const floatOpts = { ...FLOAT, duration: ENTRANCE.duration };

      // Through the overlap the entrance offset and the float's first upward
      // half-cycle are both positive and ADD. The smaller framing and lower
      // landing target pin FLOAT.overlap at 0.65 s for the 280x1000 case.
      let peak = 0;
      const onset = ENTRANCE.duration - FLOAT.overlap;
      for (let i = 0; i <= 2000; i += 1) {
        const t = onset + (i / 2000) * (FLOAT.period / 2);
        const entrance = entranceState(t, entranceOpts);
        const displacement =
          entrance.y - view.landingY + floatOffset(t, floatOpts) * entrance.scale;
        if (displacement > peak) peak = displacement;
      }

      expect(peak).toBeLessThan(FLOAT.amplitude);
    }
  });
});

describe('the dock framing', () => {
  // Derived in the plan's architecture reference. The dock button box and the
  // dock transition target both read these, so they are pinned here.
  const CASES = [
    { w: 1920, h: 1080, silhouette: 64, scale: 0.13790, y: -2.3246 },
    { w: 1440, h: 900, silhouette: 64, scale: 0.16548, y: -2.2630 },
    { w: 1000, h: 1000, silhouette: 64, scale: 0.14893, y: -2.3000 },
    { w: 390, h: 844, silhouette: 62.4, scale: 0.37232, y: -4.8575 },
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
