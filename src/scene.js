import * as THREE from 'three';
import {
  CAMERA_FOV,
  COLORS,
  CUBE_RADIUS,
  CUBE_SIZE,
  DOCK,
  FIT_MARGIN,
  SETTLE,
} from './config.js';
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

  const { mesh: cube, setArmedFace } = createCube();
  scene.add(cube);

  const framing = {
    width: Math.max(width, 1),
    height: Math.max(height, 1),
    startY: 0,
    landingY: 0,
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
    framing.width = Math.max(nextWidth, 1);
    framing.height = Math.max(nextHeight, 1);
    const aspect = framing.width / framing.height;
    const distance = cameraDistanceForRadius(CUBE_RADIUS * FIT_MARGIN, CAMERA_FOV, aspect);

    camera.aspect = aspect;
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    framing.startY = entranceStartY(distance, CAMERA_FOV, CUBE_RADIUS);

    // The docked cube is a UI control, so it is sized in CSS pixels and the
    // scale is derived — see DOCK in src/config.js for why a fixed scale is
    // wrong. CUBE_SIZE * sqrt(2) is the edge-on silhouette width in world units,
    // which is the pose the cube docks in (src/dock.js snaps the yaw to it).
    const halfHeight = visibleHalfHeight(distance, CAMERA_FOV);
    const pxPerWorldUnit = pixelsPerWorldUnit(distance, CAMERA_FOV, framing.height);
    const silhouettePx = Math.min(
      DOCK.silhouettePx,
      DOCK.maxSilhouetteFraction * Math.min(framing.width, framing.height)
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

  function projectCubeBounds({
    y = 0,
    scale = 1,
    pitch = SETTLE.pitch,
    yaw = SETTLE.yaw,
  } = {}) {
    const half = (CUBE_SIZE * scale) / 2;
    const rotation = new THREE.Euler(pitch, yaw, 0, 'XYZ');
    const point = new THREE.Vector3();
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;

    for (const x of [-half, half]) {
      for (const localY of [-half, half]) {
        for (const z of [-half, half]) {
          point.set(x, localY, z).applyEuler(rotation);
          point.y += y;
          point.project(camera);
          const screenX = ((point.x + 1) * framing.width) / 2;
          const screenY = ((1 - point.y) * framing.height) / 2;
          left = Math.min(left, screenX);
          right = Math.max(right, screenX);
          top = Math.min(top, screenY);
          bottom = Math.max(bottom, screenY);
        }
      }
    }

    return {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2,
    };
  }

  return {
    scene,
    camera,
    cube,
    setArmedFace,
    resize,
    projectCubeBounds,
    setLandingY(value) {
      framing.landingY = value;
    },
    // Getter, not a plain property: resize() changes it, so callers must read it live.
    get startY() {
      return framing.startY;
    },
    get landingY() {
      return framing.landingY;
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
