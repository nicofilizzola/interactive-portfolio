import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createScene } from '../src/scene.js';
import { CUBE_SIZE, SETTLE } from '../src/config.js';
import { faceIndexFromNormal } from '../src/routes.js';
import { pointerToNdc } from '../src/pick.js';

const RECT = { left: 0, top: 0, width: 1920, height: 1080 };

function hitFaceIndex(view, clientX, clientY) {
  const ndc = pointerToNdc(clientX, clientY, RECT);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), view.camera);
  view.cube.updateMatrixWorld();

  const hits = raycaster.intersectObject(view.cube, false);
  return hits.length === 0 ? null : faceIndexFromNormal(hits[0].face.normal);
}

function restingView() {
  const view = createScene(RECT.width, RECT.height);
  view.cube.rotation.set(SETTLE.pitch, SETTLE.yaw, 0);
  return view;
}

describe('the resting pose puts a route boundary at dead screen centre', () => {
  // THIS IS WHY THE ARMED-FACE HIGHLIGHT IS A REQUIREMENT AND NOT POLISH. The
  // cube's visual centre is the most natural place for a viewer to click, and
  // one pixel decides which of two sections they get.
  it('hits -X one pixel left of centre and +Z one pixel right', () => {
    const view = restingView();
    const left = hitFaceIndex(view, 959, 540);
    const right = hitFaceIndex(view, 961, 540);

    expect(left).toBe(1); // -X, screen left, #/writing
    expect(right).toBe(4); // +Z, screen right, #/about
    expect(left).not.toBe(right);
  });

  it('shows the top face at rest, so the primary route is always reachable', () => {
    const view = restingView();
    // Well above centre but inside the silhouette: the top face reads as a
    // narrow band across the upper third of the cube.
    //
    // Sample point re-derived from the shipped framing, per the brief's own
    // instruction not to loosen the assertion if the projected band moved: a
    // pixel sweep of the resting pose at 1920x1080 (x=960) found the +Y band
    // spanning y in [318, 386) before the current geometry/camera fit, not the
    // brief's y=470 (which lands past the band, on -X). y=350 sits at the
    // band's midpoint, 32px clear of either edge, and stays face 2 across
    // x in [900, 1020], so it is not a knife-edge pick.
    expect(hitFaceIndex(view, 960, 350)).toBe(2); // +Y, #/work
  });

  it('misses the cube entirely near the corners of the viewport', () => {
    expect(hitFaceIndex(restingView(), 20, 20)).toBeNull();
  });
});

describe('the bottom face is unreachable by construction', () => {
  // Yaw is applied BEFORE pitch under three's default XYZ Euler order, so a Y
  // rotation leaves the +/-Y normals invariant and the fixed +15 degree pitch
  // decides both of them for every yaw. This is the whole reason materialIndex 3
  // gets no route (src/routes.js). Change the Euler order or the sign of the
  // pitch and this test is what tells you the route table is now wrong.
  it('never turns the -Y normal towards the camera, at any yaw', () => {
    const view = createScene(RECT.width, RECT.height);
    const normal = new THREE.Vector3();
    const toCamera = new THREE.Vector3();

    for (let degrees = 0; degrees < 360; degrees += 1) {
      view.cube.rotation.set(SETTLE.pitch, (degrees * Math.PI) / 180, 0);
      view.cube.updateMatrixWorld();

      normal.set(0, -1, 0).transformDirection(view.cube.matrixWorld);
      toCamera.copy(view.camera.position).sub(view.cube.position).normalize();

      expect(normal.dot(toCamera)).toBeLessThan(0);
    }
  });

  it('always keeps the +Y normal facing the camera, at any yaw', () => {
    const view = createScene(RECT.width, RECT.height);
    const normal = new THREE.Vector3();
    const toCamera = new THREE.Vector3();

    for (let degrees = 0; degrees < 360; degrees += 1) {
      view.cube.rotation.set(SETTLE.pitch, (degrees * Math.PI) / 180, 0);
      view.cube.updateMatrixWorld();

      normal.set(0, 1, 0).transformDirection(view.cube.matrixWorld);
      toCamera.copy(view.camera.position).sub(view.cube.position).normalize();

      expect(normal.dot(toCamera)).toBeGreaterThan(0);
    }
  });

  it('reaches every side face across a full turn of yaw', () => {
    const view = createScene(RECT.width, RECT.height);
    const bounds = view.projectCubeBounds();
    const sampleX = bounds.left + bounds.width * 0.05;
    const reached = new Set();

    for (let degrees = 0; degrees < 360; degrees += 5) {
      view.cube.rotation.set(SETTLE.pitch, SETTLE.yaw + (degrees * Math.PI) / 180, 0);
      const index = hitFaceIndex(view, sampleX, RECT.height / 2);
      if (index !== null) reached.add(index);
    }

    for (const sideFace of [0, 1, 4, 5]) expect(reached.has(sideFace)).toBe(true);
    expect(reached.has(3)).toBe(false);
  });
});

describe('face.materialIndex is only correct with a material array', () => {
  // THE TRAP, KEPT EXECUTABLE. Mesh.raycast only walks geometry.groups when
  // `material` is an array. With a single material, a materialIndex face map
  // routes EVERY face to the same page — code that looks like it works. The
  // normal is right either way, which is why src/routes.js keys on it.
  function hitFromFront(mesh) {
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 5),
      new THREE.Vector3(0, 0, -1)
    );
    return raycaster.intersectObject(mesh, false)[0];
  }

  it('reports 0 for every hit on a single-material mesh', () => {
    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    const hit = hitFromFront(mesh);

    expect(hit.face.materialIndex).toBe(0);
    // The normal still identifies the real face: +Z, materialIndex 4.
    expect(faceIndexFromNormal(hit.face.normal)).toBe(4);
  });

  it('reports the true index once the mesh carries an array', () => {
    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    const materials = [];
    for (let index = 0; index < 6; index += 1) {
      materials.push(new THREE.MeshStandardMaterial());
    }
    const hit = hitFromFront(new THREE.Mesh(geometry, materials));

    expect(hit.face.materialIndex).toBe(4);
    expect(faceIndexFromNormal(hit.face.normal)).toBe(4);
  });

  it('agrees with the shipped cube, which now carries the array', () => {
    const view = createScene(RECT.width, RECT.height);
    view.cube.rotation.set(0, 0, 0);
    view.cube.updateMatrixWorld();
    const hit = hitFromFront(view.cube);

    expect(hit.face.materialIndex).toBe(4);
    expect(faceIndexFromNormal(hit.face.normal)).toBe(4);
  });
});
