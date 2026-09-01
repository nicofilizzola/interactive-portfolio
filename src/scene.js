import * as THREE from 'three';
import { CAMERA_FOV, COLORS, CUBE_RADIUS, CUBE_SIZE, DOCK, FIT_MARGIN } from './config.js';
import {
  cameraDistanceForRadius,
  entranceStartY,
  pixelsPerWorldUnit,
  visibleHalfHeight,
} from './camera.js';
import { createCube } from './cube.js';

export function createScene(width, height) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.background);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 100);

  scene.add(new THREE.AmbientLight(0xffffff, 2.0));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(3, 5, 4);
  scene.add(keyLight);

  const cube = createCube();
  scene.add(cube);

  const framing = {
    startY: 0,
    dockY: 0,
    dockScale: 1,
    dockSilhouettePx: 0,
    pxPerWorldUnit: 1,
  };

  function resize(nextWidth, nextHeight) {
    // A zero width makes cameraDistanceForRadius return Infinity, which propagates
    // into startY and then NaN into the cube's position; a zero height only yields a
    // degenerate projection. Both are transient (a real resize follows), so clamp
    // rather than branch.
    const aspect = Math.max(nextWidth, 1) / Math.max(nextHeight, 1);
    const distance = cameraDistanceForRadius(CUBE_RADIUS * FIT_MARGIN, CAMERA_FOV, aspect);

    camera.aspect = aspect;
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    framing.startY = entranceStartY(distance, CAMERA_FOV, CUBE_RADIUS);

    // The docked cube is a UI control, so it is sized in CSS pixels and the
    // scale is derived — see DOCK in src/config.js for why a fixed scale is
    // wrong. CUBE_SIZE * sqrt(2) is the edge-on silhouette width in world units,
    // which is the pose the cube docks in (src/dock.js snaps the yaw to it).
    const halfHeight = visibleHalfHeight(distance, CAMERA_FOV);
    const pxPerWorldUnit = pixelsPerWorldUnit(distance, CAMERA_FOV, Math.max(nextHeight, 1));
    const silhouettePx = Math.min(
      DOCK.silhouettePx,
      DOCK.maxSilhouetteFraction * Math.min(Math.max(nextWidth, 1), Math.max(nextHeight, 1))
    );

    framing.pxPerWorldUnit = pxPerWorldUnit;
    framing.dockSilhouettePx = silhouettePx;
    framing.dockScale = silhouettePx / (CUBE_SIZE * Math.SQRT2 * pxPerWorldUnit);
    // The bounding-sphere radius, not the half-edge: the clearance is then
    // conservative at any pose, and it leaves room for the docked cube's scaled
    // float without a second calculation.
    framing.dockY = -(
      halfHeight -
      CUBE_RADIUS * framing.dockScale -
      DOCK.bottomMarginPx / pxPerWorldUnit
    );
  }

  resize(width, height);

  return {
    scene,
    camera,
    cube,
    resize,
    // Getter, not a plain property: resize() changes it, so callers must read it live.
    get startY() {
      return framing.startY;
    },
    get dockY() {
      return framing.dockY;
    },
    get dockScale() {
      return framing.dockScale;
    },
    get dockSilhouettePx() {
      return framing.dockSilhouettePx;
    },
    get pxPerWorldUnit() {
      return framing.pxPerWorldUnit;
    },
  };
}
