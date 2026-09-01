import * as THREE from 'three';
import { COLORS, CUBE_SIZE } from './config.js';

// One mesh, one geometry, no edge overlay, no wrapping group — but SIX
// materials, one per BoxGeometry group. Flat shading still carries the whole
// form: each face is a single tone, so the silhouette and the three tonal steps
// between visible faces are the read.
//
// The array is a REQUIREMENT, not polish. At the resting pose the boundary
// between two routes runs exactly down the middle of the cube: at 1920x1080, yaw
// 45, pitch 15, a ray at screen centre hits the -X face and one pixel to the
// right hits +Z. The cube's visual centre is the most natural place to click, and
// clicking it is a coin flip between two sections. That cannot be fixed by
// geometry — the edge IS the resting pose — so it is fixed by telling the viewer
// which face is armed before they commit, which needs per-face colour.
//
// It also makes `intersection.face.materialIndex` correct: Mesh.raycast only
// walks geometry.groups when `material` is an array, so with a single material it
// reports 0 for every hit. src/routes.js still keys on the normal, which is right
// either way. tests/facepick.test.js locks both facts in place.
export function createCube() {
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

  // Six distinct instances, not six references to one: they have to be coloured
  // independently.
  const materials = [];
  for (let index = 0; index < 6; index += 1) {
    materials.push(
      new THREE.MeshStandardMaterial({
        color: COLORS.face,
        roughness: 0.85,
        metalness: 0,
        flatShading: true,
      })
    );
  }

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.name = 'cube';

  let armed = null;

  return {
    mesh,

    // `faceIndex` is a materialIndex (src/routes.js FACE_INDEX_BY_NORMAL), or
    // null to clear. Idempotent, so it is safe to call every frame from the
    // hover pick.
    setArmedFace(faceIndex) {
      if (armed === faceIndex) return;
      if (armed !== null) materials[armed].color.setHex(COLORS.face);
      if (faceIndex !== null) materials[faceIndex].color.setHex(COLORS.faceArmed);
      armed = faceIndex;
    },

    getArmedFace() {
      return armed;
    },
  };
}
