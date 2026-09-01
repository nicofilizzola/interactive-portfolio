import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCube } from '../src/cube.js';
import { COLORS, CUBE_SIZE } from '../src/config.js';

describe('createCube', () => {
  it('returns one bare mesh — no group, no overlay children', () => {
    const { mesh } = createCube();
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.name).toBe('cube');
    expect(mesh.children).toHaveLength(0);
  });

  // One mesh, one geometry, but SIX materials: per-face colour is what makes the
  // armed-face highlight possible, and the highlight is required because a route
  // boundary runs down the middle of the cube at the resting pose.
  it('carries one material per BoxGeometry group', () => {
    const { mesh } = createCube();
    expect(Array.isArray(mesh.material)).toBe(true);
    expect(mesh.material).toHaveLength(6);
  });

  it('paints every face light gray to begin with', () => {
    for (const material of createCube().mesh.material) {
      expect(material.color.getHex()).toBe(COLORS.face);
    }
  });

  it('flat-shades every face so each side reads as one geometric plane', () => {
    for (const material of createCube().mesh.material) {
      expect(material.flatShading).toBe(true);
      expect(material.metalness).toBe(0);
    }
  });

  it('gives each face its own material instance, not six references to one', () => {
    const { mesh } = createCube();
    expect(new Set(mesh.material).size).toBe(6);
  });

  it('draws no edge lines anywhere in the object', () => {
    let lines = 0;
    createCube().mesh.traverse((child) => {
      if (child.isLine || child.isLineSegments) lines += 1;
    });
    expect(lines).toBe(0);
  });

  it('drops the polygon offset that only existed to protect the edge lines', () => {
    for (const material of createCube().mesh.material) {
      expect(material.polygonOffset).toBe(false);
    }
  });

  it('leaves no edge color in the palette', () => {
    expect(COLORS.edge).toBeUndefined();
  });

  it('builds the box at the configured size', () => {
    const { geometry } = createCube().mesh;
    expect(geometry.parameters.width).toBe(CUBE_SIZE);
    expect(geometry.parameters.height).toBe(CUBE_SIZE);
    expect(geometry.parameters.depth).toBe(CUBE_SIZE);
  });
});

describe('setArmedFace', () => {
  it('lightens exactly one face and leaves the other five alone', () => {
    const { mesh, setArmedFace } = createCube();
    setArmedFace(4);

    expect(mesh.material[4].color.getHex()).toBe(COLORS.faceArmed);
    for (const index of [0, 1, 2, 3, 5]) {
      expect(mesh.material[index].color.getHex()).toBe(COLORS.face);
    }
  });

  it('restores the previous face when the armed face moves', () => {
    const { mesh, setArmedFace } = createCube();
    setArmedFace(4);
    setArmedFace(1);

    expect(mesh.material[1].color.getHex()).toBe(COLORS.faceArmed);
    expect(mesh.material[4].color.getHex()).toBe(COLORS.face);
  });

  it('clears back to a fully neutral cube on null', () => {
    const { mesh, setArmedFace } = createCube();
    setArmedFace(2);
    setArmedFace(null);

    for (const material of mesh.material) {
      expect(material.color.getHex()).toBe(COLORS.face);
    }
  });

  it('reports which face is armed, and starts with none', () => {
    const { setArmedFace, getArmedFace } = createCube();
    expect(getArmedFace()).toBeNull();
    setArmedFace(5);
    expect(getArmedFace()).toBe(5);
    setArmedFace(null);
    expect(getArmedFace()).toBeNull();
  });

  it('is idempotent — re-arming the same face changes nothing', () => {
    const { mesh, setArmedFace } = createCube();
    setArmedFace(0);
    setArmedFace(0);
    expect(mesh.material[0].color.getHex()).toBe(COLORS.faceArmed);
    expect(getArmedCount(mesh)).toBe(1);
  });
});

function getArmedCount(mesh) {
  return mesh.material.filter((material) => material.color.getHex() === COLORS.faceArmed).length;
}
