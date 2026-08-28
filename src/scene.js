import * as THREE from 'three';
import { CAMERA_FOV, COLORS, CUBE_RADIUS, FIT_MARGIN } from './config.js';
import { cameraDistanceForRadius, entranceStartY } from './camera.js';
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

  const framing = { startY: 0 };

  function resize(nextWidth, nextHeight) {
    const aspect = nextWidth / nextHeight;
    const distance = cameraDistanceForRadius(CUBE_RADIUS * FIT_MARGIN, CAMERA_FOV, aspect);

    camera.aspect = aspect;
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    framing.startY = entranceStartY(distance, CAMERA_FOV, CUBE_RADIUS);
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
  };
}
