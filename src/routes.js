// The route table, and the only place in src/ where a hash string appears.
// Switching to the History API later is a change to this file alone.

// BoxGeometry's six material groups, in the order three builds them (verified
// against three r185): +X, -X, +Y, -Y, +Z, -Z. Keyed on the comma-joined
// geometry-local face normal, which is exactly one of the six axis unit vectors
// for a box.
//
// Key on the NORMAL, never on `intersection.face.materialIndex` alone:
// Mesh.raycast only walks geometry.groups when `material` is an array, so with a
// single material materialIndex is 0 for every hit — a face map keyed on it
// would silently route every face to the same page. See tests/facepick.test.js.
export const FACE_INDEX_BY_NORMAL = {
  '1,0,0': 0,
  '-1,0,0': 1,
  '0,1,0': 2,
  '0,-1,0': 3,
  '0,0,1': 4,
  '0,0,-1': 5,
};

// The landing page has no content and no hash of its own beyond the root.
export const LANDING_ROUTE = null;
export const LANDING_HASH = '#/';

// THE BOTTOM FACE (-Y, materialIndex 3) GETS NO ROUTE, AND MUST NEVER GET ONE.
// The resting pitch is a fixed +15 degrees and three's Euler order is XYZ, so
// yaw is applied before pitch and leaves the +/-Y normals invariant: sweeping
// all 360 degrees of yaw, -Y is back-facing at every one of them. A sixth
// section here would be an unreachable page. There are FIVE pickable faces.
//
// The top face is the mirror of that fact — always visible, yaw-invariant — so
// it holds the primary section. The four side faces cycle under horizontal drag
// and read as a carousel of peers; they are listed in the order a rightward drag
// brings them round: +Z -> -X -> -Z -> +X.
export const ROUTES = [
  { faceIndex: 2, hash: '#/work', route: 'work', title: 'Work' },
  { faceIndex: 4, hash: '#/about', route: 'about', title: 'About' },
  { faceIndex: 1, hash: '#/writing', route: 'writing', title: 'Writing' },
  { faceIndex: 5, hash: '#/play', route: 'play', title: 'Playground' },
  { faceIndex: 0, hash: '#/contact', route: 'contact', title: 'Contact' },
];

// The raycaster hands back exact axis unit vectors for a box, but rounding costs
// nothing and survives any future non-unit normal.
export function faceIndexFromNormal(normal) {
  const key = `${Math.round(normal.x)},${Math.round(normal.y)},${Math.round(normal.z)}`;
  const index = FACE_INDEX_BY_NORMAL[key];
  return index === undefined ? null : index;
}

// `undefined` means "this face has no route", which is deliberately NOT
// LANDING_ROUTE (null). A tap on an unrouted face must do nothing, not navigate
// home. Only face 3 is unrouted, and it cannot be picked.
export function routeForFaceIndex(faceIndex) {
  const entry = ROUTES.find((candidate) => candidate.faceIndex === faceIndex);
  return entry === undefined ? undefined : entry.route;
}

export function hashForRoute(route) {
  if (route === LANDING_ROUTE) return LANDING_HASH;
  const entry = ROUTES.find((candidate) => candidate.route === route);
  return entry === undefined ? LANDING_HASH : entry.hash;
}

export function titleForRoute(route) {
  if (route === LANDING_ROUTE) return null;
  const entry = ROUTES.find((candidate) => candidate.route === route);
  return entry === undefined ? null : entry.title;
}

// `known` is what tells the caller to correct the URL with replaceState rather
// than push: the back button must not bounce between a bad hash and its fix.
export function parseHash(hash) {
  const raw = typeof hash === 'string' ? hash : '';
  const path = raw.startsWith('#') ? raw.slice(1) : raw;
  if (path === '' || path === '/') return { route: LANDING_ROUTE, known: true };

  const entry = ROUTES.find((candidate) => candidate.hash === `#${path}`);
  if (entry !== undefined) return { route: entry.route, known: true };

  return { route: LANDING_ROUTE, known: false };
}
