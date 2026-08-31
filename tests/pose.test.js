import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SETTLE } from '../src/config.js';

// The pose the entrance lands on, as three will actually apply it: default XYZ
// Euler order, roll pinned at 0. The camera sits on +Z looking toward the
// origin, so a normal's z component is how much of that face it shows.
const restPose = () => new THREE.Euler(SETTLE.pitch, SETTLE.yaw, 0, 'XYZ');
const facing = (x, y, z) => new THREE.Vector3(x, y, z).applyEuler(restPose());

describe('the settled cube pose', () => {
  it('is edge-on: yaw is a quarter turn offset by 45 degrees', () => {
    const quarter = Math.PI / 2;
    expect(((SETTLE.yaw % quarter) + quarter) % quarter).toBeCloseTo(Math.PI / 4, 9);
  });

  it('tilts 15 degrees', () => {
    expect(SETTLE.pitch).toBeCloseTo((15 * Math.PI) / 180, 12);
  });

  it('shows the top face rather than the bottom', () => {
    const top = facing(0, 1, 0);
    expect(top.z).toBeGreaterThan(0);
    expect(top.z).toBeCloseTo(Math.sin(SETTLE.pitch), 9);
  });

  it('shows the two side faces equally, so neither reads as "the front"', () => {
    const front = facing(0, 0, 1);
    const left = facing(-1, 0, 0);
    expect(front.z).toBeGreaterThan(0);
    expect(left.z).toBeCloseTo(front.z, 9);
    expect(front.z).toBeCloseTo(Math.cos(SETTLE.pitch) * Math.cos(Math.PI / 4), 9);
  });

  it('puts the edge between those two faces dead centre', () => {
    // The vertical edge shared by the +Z and -X faces runs through the corner
    // direction (-1, 0, 1); dead centre means it lands on x = 0 once rotated.
    expect(facing(-1, 0, 1).x).toBeCloseTo(0, 12);
  });

  it('keeps the tilt constant as the idle drift turns the cube', () => {
    for (const degrees of [45, 90, 135, 200, 315]) {
      const drifted = new THREE.Euler(SETTLE.pitch, (degrees * Math.PI) / 180, 0, 'XYZ');
      const top = new THREE.Vector3(0, 1, 0).applyEuler(drifted);
      expect(top.z).toBeCloseTo(Math.sin(SETTLE.pitch), 9);
    }
  });
});
