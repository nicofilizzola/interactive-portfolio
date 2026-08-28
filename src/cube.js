import * as THREE from 'three';
import { COLORS, CUBE_SIZE } from './config.js';

export function createCube() {
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

  const faceMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.face,
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
    // Push face depth back a hair so the edge lines never z-fight with them.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  const faces = new THREE.Mesh(geometry, faceMaterial);
  faces.name = 'cube-faces';

  // linewidth is ignored on WebGL: these render 1 device pixel wide, which is the
  // thin accent line the design calls for.
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: COLORS.edge })
  );
  edges.name = 'cube-edges';

  const group = new THREE.Group();
  group.name = 'cube';
  group.add(faces, edges);
  return group;
}
