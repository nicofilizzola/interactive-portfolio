import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCube } from '../src/cube.js';
import { COLORS, CUBE_SIZE } from '../src/config.js';

describe('createCube', () => {
  it('returns a group holding exactly one shaded mesh and one edge overlay', () => {
    const cube = createCube();
    expect(cube).toBeInstanceOf(THREE.Group);
    expect(cube.name).toBe('cube');
    expect(cube.children).toHaveLength(2);
    expect(cube.getObjectByName('cube-faces')).toBeInstanceOf(THREE.Mesh);
    expect(cube.getObjectByName('cube-edges')).toBeInstanceOf(THREE.LineSegments);
  });

  it('paints the faces light gray and the edges blue', () => {
    const cube = createCube();
    expect(cube.getObjectByName('cube-faces').material.color.getHex()).toBe(COLORS.face);
    expect(cube.getObjectByName('cube-edges').material.color.getHex()).toBe(COLORS.edge);
  });

  it('flat-shades the faces so each side reads as one geometric plane', () => {
    expect(createCube().getObjectByName('cube-faces').material.flatShading).toBe(true);
  });

  it('offsets the face polygons so the edge lines cannot z-fight', () => {
    const material = createCube().getObjectByName('cube-faces').material;
    expect(material.polygonOffset).toBe(true);
    expect(material.polygonOffsetFactor).toBeGreaterThan(0);
  });

  it('outlines all twelve cube edges', () => {
    const edges = createCube().getObjectByName('cube-edges');
    expect(edges.geometry.getAttribute('position').count).toBe(24);
  });

  it('builds the box at the configured size', () => {
    const geometry = createCube().getObjectByName('cube-faces').geometry;
    expect(geometry.parameters.width).toBe(CUBE_SIZE);
    expect(geometry.parameters.height).toBe(CUBE_SIZE);
    expect(geometry.parameters.depth).toBe(CUBE_SIZE);
  });
});
