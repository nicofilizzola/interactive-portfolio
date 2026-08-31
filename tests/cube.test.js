import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCube } from '../src/cube.js';
import { COLORS, CUBE_SIZE } from '../src/config.js';

describe('createCube', () => {
  it('returns one bare mesh — no group, no overlay children', () => {
    const cube = createCube();
    expect(cube).toBeInstanceOf(THREE.Mesh);
    expect(cube.name).toBe('cube');
    expect(cube.children).toHaveLength(0);
  });

  it('paints the faces light gray', () => {
    expect(createCube().material.color.getHex()).toBe(COLORS.face);
  });

  it('flat-shades the faces so each side reads as one geometric plane', () => {
    expect(createCube().material.flatShading).toBe(true);
  });

  it('draws no edge lines anywhere in the object', () => {
    let lines = 0;
    createCube().traverse((child) => {
      if (child.isLine || child.isLineSegments) lines += 1;
    });
    expect(lines).toBe(0);
  });

  it('drops the polygon offset that only existed to protect the edge lines', () => {
    expect(createCube().material.polygonOffset).toBe(false);
  });

  it('leaves no edge color in the palette', () => {
    expect(COLORS.edge).toBeUndefined();
  });

  it('builds the box at the configured size', () => {
    const geometry = createCube().geometry;
    expect(geometry.parameters.width).toBe(CUBE_SIZE);
    expect(geometry.parameters.height).toBe(CUBE_SIZE);
    expect(geometry.parameters.depth).toBe(CUBE_SIZE);
  });
});
