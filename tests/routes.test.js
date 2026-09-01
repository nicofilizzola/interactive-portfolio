import { describe, expect, it } from 'vitest';
import {
  FACE_INDEX_BY_NORMAL,
  LANDING_HASH,
  LANDING_ROUTE,
  ROUTES,
  faceIndexFromNormal,
  hashForRoute,
  parseHash,
  routeForFaceIndex,
  titleForRoute,
} from '../src/routes.js';

describe('the face map', () => {
  it('covers all six BoxGeometry groups, in three\'s order', () => {
    expect(FACE_INDEX_BY_NORMAL).toEqual({
      '1,0,0': 0,
      '-1,0,0': 1,
      '0,1,0': 2,
      '0,-1,0': 3,
      '0,0,1': 4,
      '0,0,-1': 5,
    });
  });

  it('reads a face index off a geometry-local normal', () => {
    expect(faceIndexFromNormal({ x: 0, y: 1, z: 0 })).toBe(2);
    expect(faceIndexFromNormal({ x: 0, y: 0, z: -1 })).toBe(5);
  });

  it('rounds, so floating-point normals off the raycaster still map', () => {
    expect(faceIndexFromNormal({ x: 1e-16, y: 0.9999999, z: -1e-16 })).toBe(2);
  });

  it('returns null for a normal that is not an axis direction', () => {
    expect(faceIndexFromNormal({ x: 0.577, y: 0.577, z: 0.577 })).toBeNull();
  });
});

describe('the route table', () => {
  it('routes five faces and puts Work on the always-visible top face', () => {
    expect(ROUTES).toHaveLength(5);
    expect(ROUTES.find((entry) => entry.faceIndex === 2).route).toBe('work');
  });

  it('gives every routed face index a hash and a title', () => {
    for (const entry of ROUTES) {
      expect(routeForFaceIndex(entry.faceIndex)).toBe(entry.route);
      expect(hashForRoute(entry.route)).toBe(entry.hash);
      expect(titleForRoute(entry.route)).toBe(entry.title);
    }
  });

  it('uses each face index and each hash exactly once', () => {
    expect(new Set(ROUTES.map((entry) => entry.faceIndex)).size).toBe(5);
    expect(new Set(ROUTES.map((entry) => entry.hash)).size).toBe(5);
    expect(new Set(ROUTES.map((entry) => entry.route)).size).toBe(5);
  });

  // The bottom face is back-facing at every one of 360 degrees of yaw, because
  // the pitch is a fixed +15 and the Euler order is XYZ. A route here would be
  // an unreachable page. tests/facepick.test.js proves the geometry claim.
  it('leaves the unreachable bottom face unrouted', () => {
    expect(routeForFaceIndex(3)).toBeUndefined();
    expect(ROUTES.some((entry) => entry.faceIndex === 3)).toBe(false);
  });

  // undefined ("no route") must not collapse into null ("the landing page"), or
  // a tap on an unrouted face would navigate home instead of doing nothing.
  it('keeps "no route" distinct from "the landing route"', () => {
    expect(routeForFaceIndex(3)).not.toBe(LANDING_ROUTE);
    expect(LANDING_ROUTE).toBeNull();
  });
});

describe('parseHash', () => {
  it('treats an empty, bare, or root hash as the landing page', () => {
    for (const raw of ['', '#', '#/']) {
      expect(parseHash(raw)).toEqual({ route: LANDING_ROUTE, known: true });
    }
  });

  it('round-trips every route through its hash', () => {
    for (const entry of ROUTES) {
      expect(parseHash(entry.hash)).toEqual({ route: entry.route, known: true });
      expect(hashForRoute(parseHash(entry.hash).route)).toBe(entry.hash);
    }
  });

  it('falls back to the landing page for an unknown hash, and says so', () => {
    expect(parseHash('#/nonsense')).toEqual({ route: LANDING_ROUTE, known: false });
    expect(parseHash('#/work/extra')).toEqual({ route: LANDING_ROUTE, known: false });
  });

  it('serialises the landing route as the root hash', () => {
    expect(hashForRoute(LANDING_ROUTE)).toBe(LANDING_HASH);
    expect(titleForRoute(LANDING_ROUTE)).toBeNull();
  });
});
