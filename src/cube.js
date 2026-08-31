import * as THREE from 'three';
import { COLORS, CUBE_SIZE } from './config.js';

// One bare flat-shaded mesh: no edge overlay, no wrapping group. Flat shading is
// what carries the form — each face is a single tone, so the silhouette and the
// three tonal steps between visible faces are the whole read.
export function createCube() {
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

  const material = new THREE.MeshStandardMaterial({
    color: COLORS.face,
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
  });

  const cube = new THREE.Mesh(geometry, material);
  cube.name = 'cube';
  return cube;
}
