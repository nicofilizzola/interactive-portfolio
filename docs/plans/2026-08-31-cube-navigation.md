# Cube-as-Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the cube into the site's navigation: tap a face to route to that section, the
cube animates continuously from screen centre to a bottom-centre dock as the page arrives, and
the docked cube reopens as a nav overlay over the current page.

**Architecture:** The site becomes a hash-routed SPA with a persistent full-viewport canvas.
A real document navigation would destroy and recreate the WebGL context, restarting the
entrance on every route change, so the route change must never reload the document. Layering,
bottom to top: `<main id="page">` (content, z 0), `<div id="scrim">` (z 1), `<canvas id="scene">`
(fixed, full viewport, z 2), `<button id="dock">` (z 3). The canvas stays full-viewport in
every phase — that is what lets the cube travel from centre to the bottom edge in one
continuous motion — so its `pointer-events` are switched off except while the big cube is up.

Seven new pure modules carry the logic, all unit-testable in plain Node: `routes.js` (the
route table and the face-normal map), `pages.js` (content data plus a pure HTML string
builder), `navstate.js` (`reduce(state, event) -> state`, the whole phase machine),
`pick.js` (tap-vs-drag discrimination and NDC conversion), `dock.js` (dock interpolation, the
shortest-angle yaw snap, and the content fade curves). `src/main.js` stays the only
browser-coupled file and gains the raycaster, the hash listener, and the phase-driven DOM
attributes.

**Tech Stack:** Three.js 0.185 (WebGL + `Raycaster`), Vite 8 (dev server + build), Vitest 4
(unit tests), plain JavaScript ES modules. No new dependencies. No TypeScript. No router
library — the route table is 5 rows.

**Spec:** `docs/specs/2026-08-31-seamless-idle-and-cube-navigation.md`, **Part B only**
(§1 item 2, §7–§18, §19 Part B, §20 Part B, §21, §22, §23 Part B). Read it alongside this
plan. It supersedes `docs/review.md`.

**Depends on:** `docs/plans/2026-08-31-idle-handover.md` (Part A) must be **merged first**.
Task 13 multiplies `floatOffset` by the cube's scale, and Part A's `FLOAT.rampDuration` is
read by this plan's deep-link boot (`elapsed = ENTRANCE.duration + FLOAT.rampDuration`). The
two parts share no other code.

**Spec §21 decisions, resolved by the product owner on 2026-08-31:**

| # | Question | Answer |
| --- | --- | --- |
| 21.1 | Routing mode | **Hash** (`#/work`). Deployment is not set up, and the History API would make a deep link depend on a host rewrite rule that does not exist. Hash routing works identically on `npm run dev`, `npm run preview`, and any static host, with zero config. |
| 21.2 | What reopening the docked cube does | **R2 — a nav overlay over the current page.** Content stays behind a scrim, picking a face navigates, Esc or a background tap re-docks. |
| 21.3 | Dock size and position | **64 px silhouette, 24 px above the bottom edge**, capped at 16% of the smaller viewport dimension. |
| 21.4 | Dock duration | **0.9 s.** |
| 21.5 | Route set | **Five: Work (top face), About (+Z), Writing (−X), Playground (−Z), Contact (+X).** |
| 21.6 | Armed-face highlight | **Neutral lift, `#e4e6ea`.** Blue stays unspent for now; a second pass can try it. |
| 21.7 | `prefers-reduced-motion` | **Honored for the dock transitions only**, clamped to 0.12 s. The entrance's recorded stance is left alone. |
| 21.8 | Tap slop | **8 px / 500 ms.** Expect one round of tuning on a real touch device. |

## Global Constraints

- **Language:** plain JavaScript, ES modules. No TypeScript. **No new dependencies** —
  no router, no state library, no test DOM.
- **Runtime floor:** Node `^20.19.0 || >=22.12.0`. Tests run under Vitest in plain Node —
  **no browser, no WebGL, no jsdom.** three's math and `Raycaster` run headlessly; the
  renderer is deliberately kept out of `src/scene.js` to keep it that way.
- **`src/main.js` is the only browser-coupled file.** `routes.js`, `pages.js`, `navstate.js`,
  `pick.js`, and `dock.js` must not import `three` and must not touch `window`, `document`,
  `location`, `history`, or any event API. `src/scene.js` and `src/cube.js` may import `three`
  but not the DOM. If a new module needs the DOM, the design is wrong.
- **Hash routing, and every route string lives in `src/routes.js`.** No hash literal anywhere
  else in `src/`, so switching to the History API later is a one-file change.
- **`hashchange` is the single source of truth for `route`.** A face tap sets
  `location.hash`; the resulting `hashchange` drives the machine. Never set `nav.route`
  directly from a click — that is what makes the back button work without a parallel code
  path.
- **The bottom face (`materialIndex` 3, −Y) gets no route, now or later.** The resting pitch
  is a fixed +15° and three's Euler order is `XYZ`, so yaw is applied before pitch and leaves
  the ±Y normals invariant: −Y is back-facing at every one of 360° of yaw. A route there
  would be an unreachable page. There are **five** pickable faces, not six.
- **Identify faces by `intersection.face.normal`, never by `intersection.face.materialIndex`
  alone.** `Mesh.raycast` only walks `geometry.groups` when `material` is an array, so with a
  single material `face.materialIndex` is `0` for **every** hit. Task 8 gives the cube a
  six-material array, which makes `materialIndex` correct too — but the normal is right either
  way and is what the code keys on. `tests/facepick.test.js` locks the trap in place.
- **Keep three's default `XYZ` Euler order and roll at `0`.** Any other order makes the 15°
  tilt wobble as the cube turns *and* breaks the bottom-face-unreachable guarantee above.
- **Do not touch** `src/animation.js`, `src/easing.js`'s existing functions, `src/math.js`,
  or `vite.config.js`. `src/easing.js` gains one function; nothing existing in it changes.
- **The entrance is untouched.** No change to its duration (3.5 s), position curve, scale
  curve, spin decay, easing choices, or landing pose. Part B adds no motion before
  `t = 3.5 s`. `entranceRotation(3.5)` must still return exactly `SETTLE.yaw` / `SETTLE.pitch`.
- **`DRAG` is untouched.** No vertical drag, no pinch, no scroll-driven rotation, no
  snap-back. `src/drag.js` gains two members (Task 10) and changes no existing behaviour.
- **No second 3D object, no per-page 3D, no cube-face textures or labels.** The cube is still
  one `Mesh`, one `BoxGeometry`, no wrapping `Group`, no edge outline, no `polygonOffset`.
- **No visible nav text, breadcrumb, or menu.** The `<nav>` in Task 11 is a hidden
  accessibility affordance, not a design element.
- **Content is lorem ipsum**, differentiated enough to verify routing by eye. No real content.
- **Do not shrink the WebGL drawing buffer while docked.** Rendering a full-viewport frame for
  a 64 px cube is wasteful in principle, but the scene is 12 triangles on a flat clear, and a
  smaller canvas would break the transition (the cube travels the full viewport). Measure
  before optimising.
- **Deployment stays out of scope.** Hash routing is chosen specifically so this stays true.

## Known spec errata

Verified against the spec's own numbers while deriving this plan. Each is small; each would
otherwise become a failing test.

1. **§12a's `dockY` row for `390×844` is `−4.079`, computed from the *uncapped* scale
   `0.3216`.** But `maxSilhouetteFraction` 0.16 binds at 390 px (`0.16 × 390 = 62.4 < 64`), so
   the shipped `dockScale` there is `62.4 / (1.6 × √2 × 87.955) = 0.31354`, and `dockY` is
   **`−4.0907`**. §14a's "the 62 px phone case" confirms the cap binds. Task 4's test asserts
   the capped values.
2. **§12f says the DOM swap happens "at the transition midpoint, where opacity is 0", but the
   single curve it specifies (`contentFadeStart` 0.4) gives `0.1667` at the midpoint, not 0.**
   Two curves are needed: a *fade-in* for landing → page (the spec's curve), and a
   *cross-fade* for page → page that reaches exactly 0 at `p = 0.5`. Task 5 implements four
   named modes (`in`, `out`, `cross`, `hold`) as one pure function.
3. **§13 asks for "a distinct paragraph count (2–5)" for five routes.** Four values cannot
   cover five routes. Task 2 uses **2, 3, 4, 5, 6**.
4. **§11's transition table row `docked`/`resting` + history → landing → `expanding` is wrong
   for the `resting` half.** From `resting` the cube is *already* at screen centre, so there is
   no motion to play; only the content unmounts. Task 6 keeps the phase at `resting` and
   clears the route. The `docked` half of that row is implemented as written.
5. **§11's `State` includes `overlay`, but `overlay` is exactly `route !== null` combined with
   the phase.** Storing it would be a second source of truth for the same fact. Task 6 derives
   it; `src/main.js` computes `nav.route !== null && nav.phase === 'resting'` where it needs it.
6. **§7b gives the scrim `pointer-events: auto` while the nav is open, but §9d makes a raycast
   miss the dismissal signal.** The canvas sits *above* the scrim and takes pointer events in
   `resting`, so the scrim would never receive one. Task 11 makes the scrim purely visual
   (`pointer-events: none`); miss-taps come from the raycast, per §9d.

**Errata in this plan document itself**, distinct from the spec errata above: four small
mistakes were introduced while *writing this plan* rather than while deriving it from the
spec, and were caught and independently verified during execution, then corrected in place so
the document matches what shipped. (1) The architecture reference table below transcribed the
`1920×1080` and `1000×1000` `dockY` values wrong (`−1.9584` and `−1.9312`); both are
inconsistent with their own row's `halfHeight`/`dockScale`/px-per-unit columns, which give
`−1.9576` and `−1.9368` — Task 4's own test block repeated the same slip and is corrected
alongside it. (2) Task 7's `pointerToNdc` implementation was written as
`-((((clientY - rect.top) / rect.height) * 2) - 1)`, which evaluates to `-0` at screen centre;
`toEqual` distinguishes `-0` from `+0`, so the plan's own centre-point test would have failed
against the plan's own code. The algebraically identical `1 - ((clientY - rect.top) / rect.height) * 2`
ships instead. (3) Task 9's top-face sample point `(960, 470)` was never on the projected +Y
band at 1920×1080 (the band spans `y` in `[318, 386)` at `x = 960`; `y = 470` lands on the −X
face) — corrected to `(960, 350)`, the band's midpoint. (4) Task 5 Step 4 and Task 6 Step 4
each miscounted their own test code's `it()` blocks: 18, not 17, for `dock.test.js`; 23, not
24, for `navstate.test.js`.

## Architecture reference: the numbers, derived

Framing at `FIT_MARGIN` 1.6, FOV 45. `pxPerWorldUnit = viewportHeight / (2 × visibleHalfHeight)`.

| Viewport | Camera z | Half-height | px/unit | Silhouette cap | `dockScale` | `dockY` |
| --- | --- | --- | --- | --- | --- | --- |
| 1920×1080 | 5.3524 | 2.2170 | 243.58 | 64 (cap 172.8) | 0.11612 | −1.9576 |
| 1440×900 | 5.3524 | 2.2170 | 202.97 | 64 (cap 144.0) | 0.13936 | −1.9057 |
| 1000×1000 | 5.3524 | 2.2170 | 225.53 | 64 (cap 160.0) | 0.12542 | −1.9368 |
| 390×844 | 11.5831 | 4.7979 | 87.955 | **62.4** (cap binds) | 0.31354 | −4.0907 |

**Why the dock size is a CSS-pixel size and not a scale factor.** Camera distance varies with
aspect ratio, so a fixed `scale` draws a different physical size on every device. Reusing
`ENTRANCE.startScale` (0.15) for symmetry with the entrance is tempting and wrong: it would
draw an 83 px nav button on a desktop and a **30 px** one on a phone.

The five pickable faces at the resting pose, and their targets:

| Face | `materialIndex` | Hash | Section | Reachable | Area at 1920×1080 | at 390×844 |
| --- | --- | --- | --- | --- | --- | --- |
| +Y top | 2 | `#/work` | Work | **always visible** | 19 584 px² (7.8%) | 4 006 px² (12.4%) |
| +Z front | 4 | `#/about` | About | visible at rest, screen right | 114 872 px² (45.9%) | 14 127 px² (43.8%) |
| −X left | 1 | `#/writing` | Writing | visible at rest, screen left | 115 780 px² (46.3%) | 14 146 px² (43.8%) |
| −Z back | 5 | `#/play` | Playground | by dragging | — | — |
| +X right | 0 | `#/contact` | Contact | by dragging | — | — |
| −Y bottom | 3 | — | **none** | **never** | — | — |

The top face is the smallest target and is still 4 006 px² (a 63 px square) on a 390 px phone,
comfortably over the 44 px tap-target guideline. **No face needs an enlarged hit region.**

Under increasing yaw (a rightward drag) the side faces come round in the order
+Z → −X → −Z → +X, which is the order the table lists them in.

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `src/routes.js` | The route table, the face-normal → `materialIndex` map, hash parse/serialise, unknown-hash fallback. The only place a hash string appears. | **Create** (Task 1) |
| `src/pages.js` | Route → content data, and a pure `renderPage(route) -> string`. No DOM. | **Create** (Task 2) |
| `src/easing.js` | Easing curves. | **Modify** — add `easeInOutCubic` (Task 3) |
| `src/camera.js` | Framing math. | **Modify** — add `pixelsPerWorldUnit` (Task 4) |
| `src/scene.js` | Scene, camera, lights, viewport fitting. | **Modify** — `dockScale` / `dockY` / `dockSilhouettePx` getters; wire `setArmedFace` (Tasks 4, 8) |
| `src/dock.js` | Dock/undock interpolation, the shortest-angle yaw snap, the content fade curves. All pure functions of progress. | **Create** (Task 5) |
| `src/navstate.js` | `reduce(state, event) -> state`. The whole phase machine. No DOM, no three. | **Create** (Task 6) |
| `src/pick.js` | Tap-vs-drag discrimination and NDC conversion. No three. | **Create** (Task 7) |
| `src/cube.js` | The cube: one mesh, six materials, `setArmedFace`. | **Modify** (Task 8) |
| `src/drag.js` | Drag-to-spin. | **Modify** — `start()` returns the cancelled speed; new `brake()` (Task 10) |
| `src/config.js` | Every tunable number. | **Modify** — `DOCK`, `PICK`, `COLORS.faceArmed` (Tasks 3–8, as each lands) |
| `index.html` | Document skeleton: hidden nav, content, scrim, canvas, dock button. | **Modify** (Task 11) |
| `src/style.css` | Layering, the `pointer-events` and scroll switches, content type. | **Modify** (Task 11) |
| `src/main.js` | Renderer, DOM events, the loop, composition. | **Modify** (Tasks 12–14), possibly split (Task 15) |
| `src/input.js` | DOM event wiring, if `main.js` passes ~250 lines. | **Create, conditionally** (Task 15) |
| `tests/routes.test.js`, `tests/navstate.test.js`, `tests/pick.test.js`, `tests/dock.test.js`, `tests/facepick.test.js` | New suites. | **Create** |
| `tests/cube.test.js`, `tests/camera.test.js`, `tests/scene.test.js`, `tests/drag.test.js`, `tests/easing.test.js` | Existing suites. | **Modify** |
| `AGENTS.md`, `README.md` | Spec of record and orientation. | **Modify** (Task 16) |

`tests/math.test.js`, `tests/pose.test.js`, and `tests/animation.test.js` are untouched.

**Task order is dependency order.** Tasks 1–10 are pure modules and their tests, each
independently reviewable with no DOM in sight. Task 11 is the document skeleton. Tasks 12–14
wire `src/main.js` in three passes — routing, then picking, then the animation — so the page
is exercisable end to end after each.

---

### Task 1: `src/routes.js` — the route table and the face map

**Files:**
- Create: `src/routes.js`
- Test: `tests/routes.test.js`

**Interfaces:**
- Consumes: nothing. This module is a leaf.
- Produces:
  - `FACE_INDEX_BY_NORMAL` — `{ '1,0,0': 0, ... }`, keyed on the comma-joined geometry-local normal.
  - `LANDING_ROUTE` = `null`, `LANDING_HASH` = `'#/'`.
  - `ROUTES` — array of `{ faceIndex, hash, route, title }`, five entries.
  - `faceIndexFromNormal(normal) -> number | null` — `normal` is anything with `x`/`y`/`z`.
  - `routeForFaceIndex(faceIndex) -> string | undefined` — **`undefined` means "no route"**,
    which is deliberately *not* the same value as `LANDING_ROUTE` (`null`).
  - `hashForRoute(route) -> string`
  - `titleForRoute(route) -> string | null`
  - `parseHash(hash) -> { route, known }` — `known` is `false` for an unrecognised hash, which
    is what tells `main.js` to `replaceState` rather than push.

- [ ] **Step 1: Write the failing test**

Create `tests/routes.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes.test.js`
Expected: FAIL — `Failed to resolve import "../src/routes.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/routes.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/routes.test.js`
Expected: PASS — 13 cases.

- [ ] **Step 5: Commit**

```bash
git add src/routes.js tests/routes.test.js
git commit -m "feat: add the route table and the cube face map"
```

---

### Task 2: `src/pages.js` — content data and a pure HTML builder

**Files:**
- Create: `src/pages.js`
- Test: `tests/pages.test.js`

**Interfaces:**
- Consumes: `hashForRoute`, `titleForRoute`, `ROUTES`, `LANDING_ROUTE` from `src/routes.js`.
- Produces:
  - `PAGES` — `{ [route]: { title, blocks: string[] } }`, five entries.
  - `renderPage(route) -> string` — the whole `<article>` as an HTML string. Returns `''` for
    `LANDING_ROUTE`. **No DOM access**; `src/main.js` does the single `innerHTML` assignment.

**Why each page carries its own hash on screen.** Lorem that differs only in wording makes a
wrong-face bug read as "the text looks different". A visible `#/writing` under the heading
makes it unmistakable. Three things differentiate each page: the `<h1>`, the printed hash, and
a distinct paragraph count (2, 3, 4, 5, 6 — see errata 3).

- [ ] **Step 1: Write the failing test**

Create `tests/pages.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { PAGES, renderPage } from '../src/pages.js';
import { LANDING_ROUTE, ROUTES, hashForRoute, titleForRoute } from '../src/routes.js';

describe('PAGES', () => {
  it('has a page for every route, and a route for every page', () => {
    expect(Object.keys(PAGES).sort()).toEqual(ROUTES.map((entry) => entry.route).sort());
  });

  it('titles each page the same as its route table entry', () => {
    for (const entry of ROUTES) {
      expect(PAGES[entry.route].title).toBe(titleForRoute(entry.route));
    }
  });

  it('gives every page a distinct paragraph count between 2 and 6', () => {
    const counts = ROUTES.map((entry) => PAGES[entry.route].blocks.length);
    expect(counts.every((count) => count >= 2 && count <= 6)).toBe(true);
    expect(new Set(counts).size).toBe(counts.length);
  });

  it('gives every page distinct text, so a wrong-face bug is visible', () => {
    const firstLines = ROUTES.map((entry) => PAGES[entry.route].blocks[0]);
    expect(new Set(firstLines).size).toBe(firstLines.length);
  });
});

describe('renderPage', () => {
  it('renders the heading, the route\'s own hash, and every paragraph', () => {
    const html = renderPage('writing');
    expect(html).toContain('<h1');
    expect(html).toContain('Writing');
    expect(html).toContain(hashForRoute('writing'));
    for (const block of PAGES.writing.blocks) {
      expect(html).toContain(`<p>${block}</p>`);
    }
  });

  it('makes the heading focusable, so a route change can be announced', () => {
    expect(renderPage('work')).toContain('tabindex="-1"');
  });

  it('renders nothing for the landing page', () => {
    expect(renderPage(LANDING_ROUTE)).toBe('');
    expect(renderPage('nonsense')).toBe('');
  });

  it('is pure: the same route renders identically every time', () => {
    expect(renderPage('about')).toBe(renderPage('about'));
  });

  it('renders each route with its own hash, not another route\'s', () => {
    for (const entry of ROUTES) {
      const html = renderPage(entry.route);
      expect(html).toContain(entry.hash);
      for (const other of ROUTES) {
        if (other.route !== entry.route) expect(html).not.toContain(other.hash);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pages.test.js`
Expected: FAIL — `Failed to resolve import "../src/pages.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/pages.js`:

```js
import { LANDING_ROUTE, hashForRoute, titleForRoute } from './routes.js';

// Lorem ipsum, per the spec — but differentiated enough to verify routing by
// eye. Each page carries its own heading, a visible copy of its own hash, and a
// distinct paragraph count, so a wrong-face bug reads as "wrong page" rather
// than "the text looks different".
export const PAGES = {
  work: {
    title: titleForRoute('work'),
    blocks: [
      'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.',
      'Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae.',
      'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.',
      'Sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.',
      'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.',
      'Sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat.',
    ],
  },
  writing: {
    title: titleForRoute('writing'),
    blocks: [
      'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium.',
      'Voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati.',
      'Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.',
      'Et harum quidem rerum facilis est et expedita distinctio.',
      'Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus.',
    ],
  },
  about: {
    title: titleForRoute('about'),
    blocks: [
      'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae.',
      'Vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.',
      'Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet.',
      'Ut et voluptates repudiandae sint et molestiae non recusandae.',
    ],
  },
  contact: {
    title: titleForRoute('contact'),
    blocks: [
      'Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores.',
      'Alias consequatur aut perferendis doloribus asperiores repellat.',
      'Omnis voluptas assumenda est, omnis dolor repellendus.',
    ],
  },
  play: {
    title: titleForRoute('play'),
    blocks: [
      'Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam.',
      'Nisi ut aliquid ex ea commodi consequatur quis autem vel eum.',
    ],
  },
};

// Pure and DOM-free, so it unit-tests; src/main.js does the single innerHTML
// assignment. Every string here is project-authored, so this is not a
// sanitisation question — it becomes one the moment any content comes from
// outside this repo.
//
// The h1 is focusable (tabindex="-1") so main.js can move focus to it after a
// route change: without that a screen-reader user gets no indication that
// anything happened.
export function renderPage(route) {
  if (route === LANDING_ROUTE) return '';

  const page = PAGES[route];
  if (page === undefined) return '';

  const paragraphs = page.blocks.map((block) => `<p>${block}</p>`).join('\n      ');

  return `<article>
      <h1 tabindex="-1">${page.title}</h1>
      <p class="page-hash">${hashForRoute(route)}</p>
      ${paragraphs}
    </article>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pages.test.js tests/routes.test.js`
Expected: PASS — 9 new cases plus Task 1's 13.

- [ ] **Step 5: Commit**

```bash
git add src/pages.js tests/pages.test.js
git commit -m "feat: add the five content pages as data plus a pure renderer"
```

---

### Task 3: `easeInOutCubic` — a curve that starts from a standstill

**Files:**
- Modify: `src/easing.js`
- Test: `tests/easing.test.js`

**Interfaces:**
- Consumes: `clamp01` from `src/math.js` (already imported at `src/easing.js:1`).
- Produces: `easeInOutCubic(t) -> number`. Task 5 runs the dock's position, scale, and yaw on it.

**Why not the entrance's `easeOutCubic`.** The entrance starts off-screen *already at speed*,
so an ease-out is right for it. The dock starts from a standstill at screen centre — an
ease-out there begins at maximum velocity, which is **exactly the defect Part A exists to
fix**. `easeInOutCubic` has a zero derivative at *both* ends, and it is symmetric about
`(0.5, 0.5)`, which is what makes `expanding` an exact mirror of `shrinking`.

- [ ] **Step 1: Write the failing test**

Extend the import at `tests/easing.test.js:2` to include `easeInOutCubic`, and append:

```js
describe('easeInOutCubic', () => {
  it('maps the unit interval onto itself, through the midpoint', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
  });

  it('clamps out-of-range input instead of overshooting', () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(4)).toBe(1);
  });

  // The reason the dock does not reuse the entrance's easeOutCubic: the dock
  // starts from a standstill, and an ease-out there begins at maximum velocity.
  it('leaves and arrives with zero slope, unlike easeOutCubic', () => {
    const h = 1e-6;
    expect((easeInOutCubic(h) - easeInOutCubic(0)) / h).toBeLessThan(1e-4);
    expect((easeInOutCubic(1) - easeInOutCubic(1 - h)) / h).toBeLessThan(1e-4);
    expect((easeOutCubic(h) - easeOutCubic(0)) / h).toBeGreaterThan(1);
  });

  // This is what makes `expanding` an exact mirror of `shrinking`, so the cube
  // never appears to have moved while docked.
  it('is symmetric about the midpoint', () => {
    for (let i = 0; i <= 100; i += 1) {
      const p = i / 100;
      expect(easeInOutCubic(p) + easeInOutCubic(1 - p)).toBeCloseTo(1, 12);
    }
  });

  it('rises monotonically', () => {
    let previous = -1;
    for (let i = 0; i <= 100; i += 1) {
      const value = easeInOutCubic(i / 100);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/easing.test.js`
Expected: FAIL — `easeInOutCubic is not a function` on all five new cases.

- [ ] **Step 3: Write minimal implementation**

Append to `src/easing.js`:

```js
// The dock transition's curve. Zero derivative at BOTH ends, and symmetric about
// (0.5, 0.5). The entrance uses easeOutCubic because it arrives already at
// speed; the dock starts from a standstill at screen centre, where an ease-out
// would begin at maximum velocity — the same defect the float's envelope exists
// to remove. The symmetry is what makes `expanding` an exact mirror of
// `shrinking`: run it at 1 - p and the cube retraces its path.
export function easeInOutCubic(t) {
  const x = clamp01(t);
  if (x < 0.5) return 4 * x * x * x;

  const remaining = 2 - 2 * x;
  return 1 - (remaining * remaining * remaining) / 2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/easing.test.js`
Expected: PASS — the five new cases plus every existing one (including Part A's `smoothStep`
block).

- [ ] **Step 5: Commit**

```bash
git add src/easing.js tests/easing.test.js
git commit -m "feat: add easeInOutCubic for the dock transition"
```

---

### Task 4: Dock geometry — `pixelsPerWorldUnit`, `dockScale`, `dockY`

**Files:**
- Modify: `src/config.js` (add `DOCK`, `PICK`, `COLORS.faceArmed`)
- Modify: `src/camera.js`
- Modify: `src/scene.js:2-3`, `:20`, `:35`, `:40-49`
- Test: `tests/camera.test.js`, `tests/scene.test.js`

**Interfaces:**
- Consumes: `visibleHalfHeight`, `cameraDistanceForRadius` (existing, `src/camera.js`);
  `CUBE_SIZE`, `CUBE_RADIUS`, `CAMERA_FOV`, `FIT_MARGIN` (existing, `src/config.js`).
- Produces:
  - `pixelsPerWorldUnit(distance, fovDeg, viewportHeightPx) -> number` from `src/camera.js`.
  - `DOCK` in `src/config.js`: `{ duration: 0.9, reducedDuration: 0.12, silhouettePx: 64,
    maxSilhouetteFraction: 0.16, bottomMarginPx: 24, contentFadeStart: 0.4 }`.
  - `PICK` in `src/config.js`: `{ tapMaxTravelPx: 8, tapMaxDurationMs: 500,
    tapMaxEntrySpeedRevs: 0.05 }` — declared here so Task 7 needs no config edit.
  - `COLORS.faceArmed` = `0xe4e6ea`, used by Task 8.
  - Four new **getters** on the object `createScene` returns: `dockScale`, `dockY`,
    `dockSilhouettePx`, `pxPerWorldUnit`. Getters, not plain properties, for the same reason
    `startY` is one (`src/scene.js:45-48`): `resize()` changes them and callers must read them
    live.

**The derivation.**

```
silhouettePx = min(DOCK.silhouettePx, DOCK.maxSilhouetteFraction * min(w, h))
dockScale    = silhouettePx / (CUBE_SIZE * sqrt(2) * pxPerWorldUnit)
dockY        = -(visibleHalfHeight - CUBE_RADIUS * dockScale - DOCK.bottomMarginPx / pxPerWorldUnit)
```

`CUBE_SIZE * sqrt(2)` is the edge-on silhouette width in world units — the pose the cube docks
in, which Task 5 snaps the yaw to. `CUBE_RADIUS * dockScale` uses the **bounding sphere**, so
the bottom clearance is conservative at any pose, which leaves room for the docked cube's
scaled float (Task 14) without a second calculation: at 1080p the clearance is 0.161 u against
a float amplitude of `0.08 * 0.116 = 0.0093` u.

`maxSilhouetteFraction` only binds below ~400 px of minimum dimension, where a flat 64 px would
start to dominate the screen. **It binds at `390x844`** — see errata 1.

- [ ] **Step 1: Write the failing test**

In `tests/camera.test.js`, extend the import from `../src/camera.js` to include
`pixelsPerWorldUnit`, and append:

```js
describe('pixelsPerWorldUnit', () => {
  it('converts world units to CSS pixels at the framing plane', () => {
    // FIT_MARGIN 1.6, FOV 45: landscape camera z is 5.35242, portrait 390x844
    // pulls back to 11.58306. Both are derived in the plan's reference table.
    expect(pixelsPerWorldUnit(5.35242, 45, 1080)).toBeCloseTo(243.58, 1);
    expect(pixelsPerWorldUnit(5.35242, 45, 900)).toBeCloseTo(202.97, 1);
    expect(pixelsPerWorldUnit(11.58306, 45, 844)).toBeCloseTo(87.955, 2);
  });

  it('scales linearly with viewport height and inversely with distance', () => {
    expect(pixelsPerWorldUnit(5, 45, 2000)).toBeCloseTo(2 * pixelsPerWorldUnit(5, 45, 1000), 9);
    expect(pixelsPerWorldUnit(10, 45, 1000)).toBeCloseTo(pixelsPerWorldUnit(5, 45, 1000) / 2, 9);
  });
});
```

In `tests/scene.test.js`, extend the config import at `:5` to add `CUBE_SIZE`, and append:

```js
describe('the dock framing', () => {
  // Derived in the plan's architecture reference. The dock button box and the
  // dock transition target both read these, so they are pinned here.
  const CASES = [
    // The plan's reference table lists this row's y as -1.9584, but that value
    // is inconsistent with the same row's own halfHeight (2.2170), dockScale
    // (0.11612), and px/unit (243.58) columns: plugging those into the dock.js
    // derivation gives -1.95758, not -1.9584. Verified independently (see the
    // task-4 report) — a second, undocumented table slip distinct from errata 1.
    { w: 1920, h: 1080, silhouette: 64, scale: 0.11612, y: -1.9576 },
    { w: 1440, h: 900, silhouette: 64, scale: 0.13936, y: -1.9057 },
    // Same slip as the 1920x1080 row above: the table's -1.9312 is inconsistent
    // with its own halfHeight/dockScale/px-per-unit columns, which give -1.93683.
    { w: 1000, h: 1000, silhouette: 64, scale: 0.12542, y: -1.9368 },
    // The 16% cap binds below ~400 px of minimum dimension. The spec's own table
    // omits the cap on this row and reports -4.079; see the plan's errata 1.
    { w: 390, h: 844, silhouette: 62.4, scale: 0.31354, y: -4.0907 },
  ];

  it('derives the dock scale and height from a CSS-pixel size at every aspect', () => {
    const view = createScene(1600, 900);

    for (const expected of CASES) {
      view.resize(expected.w, expected.h);
      expect(view.dockSilhouettePx).toBeCloseTo(expected.silhouette, 4);
      expect(view.dockScale).toBeCloseTo(expected.scale, 4);
      expect(view.dockY).toBeCloseTo(expected.y, 3);
    }
  });

  // The point of deriving the scale rather than reusing ENTRANCE.startScale: a
  // fixed scale draws a 30 px nav button on a phone and an 83 px one on a
  // desktop, because the camera distance varies with aspect ratio.
  it('draws the same physical size everywhere, unlike a fixed scale', () => {
    const view = createScene(1600, 900);

    for (const expected of CASES) {
      view.resize(expected.w, expected.h);
      const drawnPx = CUBE_SIZE * Math.SQRT2 * view.dockScale * view.pxPerWorldUnit;
      expect(drawnPx).toBeCloseTo(expected.silhouette, 3);
    }
  });

  it('leaves the docked cube clear of the bottom edge, float included', () => {
    const view = createScene(1600, 900);

    for (const [w, h] of [[1920, 1080], [1440, 900], [900, 900], [390, 844], [280, 1000]]) {
      view.resize(w, h);
      const halfH = visibleHalfHeight(view.camera.position.z, CAMERA_FOV);
      // Bounding-sphere clearance, so this holds at any pose, plus the docked
      // cube's float — the world amplitude times the dock scale.
      const lowest =
        view.dockY - CUBE_RADIUS * view.dockScale - FLOAT.amplitude * view.dockScale;

      expect(view.dockY).toBeLessThan(0);
      expect(lowest).toBeGreaterThan(-halfH);
    }
  });

  it('re-derives the dock framing on resize, so the getters are read live', () => {
    const view = createScene(1920, 1080);
    const landscapeY = view.dockY;
    const landscapeScale = view.dockScale;

    view.resize(390, 844);

    expect(view.dockY).toBeLessThan(landscapeY);
    expect(view.dockScale).toBeGreaterThan(landscapeScale);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/camera.test.js tests/scene.test.js`
Expected: FAIL — `pixelsPerWorldUnit is not a function`, and `view.dockSilhouettePx`,
`view.dockScale`, `view.dockY`, `view.pxPerWorldUnit` all `undefined`.

- [ ] **Step 3: Add `DOCK`, `PICK`, and `COLORS.faceArmed` to `src/config.js`**

Replace the `COLORS` block at `:6-9`:

```js
export const COLORS = {
  background: 0xf7f7f8,
  face: 0xd6d8dc,
  // The armed nav face. Neutral, not the nominated blue accent: at the resting
  // pose the boundary between two routes runs down the middle of the cube, so
  // this colour is on screen every time the pointer crosses it, and blue would
  // be the page's only colour and would dominate. Trying blue here is a
  // deliberate second pass, not a default.
  faceArmed: 0xe4e6ea,
};
```

Append `DOCK` and `PICK` after the `FLOAT` block:

```js
// The dock transition, and the docked cube's geometry.
//
// `silhouettePx` is a CSS-PIXEL SIZE, not a scale factor, and that is the whole
// point. The camera distance varies with aspect ratio, so a fixed scale draws a
// different physical size on every device: reusing ENTRANCE.startScale (0.15)
// for symmetry with the entrance would draw an 83 px nav button on a desktop and
// a 30 px one on a phone. src/scene.js derives the scale from this instead.
// `maxSilhouetteFraction` only binds below ~400 px of minimum dimension, where a
// flat 64 px would start to dominate — at 390x844 it caps the silhouette at
// 62.4 px.
//
// `duration` 0.9 s: long enough to read as one continuous move across the whole
// viewport, short enough not to gate navigation. Under ~0.6 s the travel reads
// as a jump; over ~1.2 s navigation feels gated. It is NOT the entrance's 3.5 s
// — that is a curtain-raiser, this is a UI transition.
//
// `reducedDuration` honors prefers-reduced-motion for the dock transitions only.
// Motion here gates NAVIGATION rather than decoration: without the clamp a
// motion-sensitive viewer waits 0.9 s of animation to reach a page, twice per
// round trip. The entrance's recorded stance (not honored) is left alone.
export const DOCK = {
  duration: 0.9,
  reducedDuration: 0.12,
  silhouettePx: 64,
  maxSilhouetteFraction: 0.16,
  bottomMarginPx: 24,
  // Content fades in over the back 60% of the shrink, so the cube visibly
  // commits to moving before the page arrives.
  contentFadeStart: 0.4,
};

// Tap-vs-drag discrimination. A face click is a FAILED drag — the same gesture on
// the same surface already means "spin the cube" — so it is defined negatively.
//
// `tapMaxTravelPx` is straight-line distance from the press point, not cumulative
// path length, so jitter that returns to the origin still counts as a tap. 8 px
// is generous on purpose: on touch the finger is already down before the viewer
// can adjust their aim.
//
// `tapMaxEntrySpeedRevs` keeps a brake from also navigating. drag.start() already
// zeroes the velocity so a press stops a coasting cube; left alone, one tap would
// both brake and navigate. Above this entry speed the tap is spent stopping the
// cube, and the second tap navigates.
export const PICK = {
  tapMaxTravelPx: 8,
  tapMaxDurationMs: 500,
  tapMaxEntrySpeedRevs: 0.05,
};
```

- [ ] **Step 4: Add `pixelsPerWorldUnit` to `src/camera.js`**

Append:

```js
// World units to CSS pixels at the plane the camera frames. The dock's size is
// specified in pixels (DOCK in src/config.js), so this is what converts it into
// the scale and the world-space Y the renderer needs.
export function pixelsPerWorldUnit(distance, fovDeg, viewportHeightPx) {
  return viewportHeightPx / (2 * visibleHalfHeight(distance, fovDeg));
}
```

- [ ] **Step 5: Derive the dock framing in `src/scene.js`**

Replace the two import lines at `:2-3`:

```js
import { CAMERA_FOV, COLORS, CUBE_RADIUS, CUBE_SIZE, DOCK, FIT_MARGIN } from './config.js';
import {
  cameraDistanceForRadius,
  entranceStartY,
  pixelsPerWorldUnit,
  visibleHalfHeight,
} from './camera.js';
```

Replace the `framing` declaration at `:20`:

```js
  const framing = {
    startY: 0,
    dockY: 0,
    dockScale: 1,
    dockSilhouettePx: 0,
    pxPerWorldUnit: 1,
  };
```

Append to the end of `resize()`, after the existing `framing.startY = ...` line at `:35`:

```js
    // The docked cube is a UI control, so it is sized in CSS pixels and the
    // scale is derived — see DOCK in src/config.js for why a fixed scale is
    // wrong. CUBE_SIZE * sqrt(2) is the edge-on silhouette width in world units,
    // which is the pose the cube docks in (src/dock.js snaps the yaw to it).
    const halfHeight = visibleHalfHeight(distance, CAMERA_FOV);
    const pxPerWorldUnit = pixelsPerWorldUnit(distance, CAMERA_FOV, Math.max(nextHeight, 1));
    const silhouettePx = Math.min(
      DOCK.silhouettePx,
      DOCK.maxSilhouetteFraction * Math.min(Math.max(nextWidth, 1), Math.max(nextHeight, 1))
    );

    framing.pxPerWorldUnit = pxPerWorldUnit;
    framing.dockSilhouettePx = silhouettePx;
    framing.dockScale = silhouettePx / (CUBE_SIZE * Math.SQRT2 * pxPerWorldUnit);
    // The bounding-sphere radius, not the half-edge: the clearance is then
    // conservative at any pose, and it leaves room for the docked cube's scaled
    // float without a second calculation.
    framing.dockY = -(
      halfHeight -
      CUBE_RADIUS * framing.dockScale -
      DOCK.bottomMarginPx / pxPerWorldUnit
    );
```

Add the four getters alongside the existing `startY` getter in the returned object:

```js
    get dockY() {
      return framing.dockY;
    },
    get dockScale() {
      return framing.dockScale;
    },
    get dockSilhouettePx() {
      return framing.dockSilhouettePx;
    },
    get pxPerWorldUnit() {
      return framing.pxPerWorldUnit;
    },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS, whole suite. If `derives the dock scale and height` fails on the `390x844` row
reporting `dockScale` near `0.3216` and `dockY` near `-4.079`, the `maxSilhouetteFraction` cap
is not being applied — that is errata 1, and the test's numbers are the correct ones.

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/camera.js src/scene.js tests/camera.test.js tests/scene.test.js
git commit -m "feat: derive the docked cube's scale and height from a pixel size"
```

---

### Task 5: `src/dock.js` — the transition as pure functions of progress

**Files:**
- Create: `src/dock.js`
- Test: `tests/dock.test.js`

**Interfaces:**
- Consumes: `easeInOutCubic` (Task 3), `clamp01` and `lerp` from `src/math.js`.
- Produces:
  - `yawSnapDelta(yaw, settleYaw) -> number` — the shortest signed angle to the nearest
    `settleYaw + k * 90 degrees`. Magnitude never exceeds 45 degrees.
  - `dockState(progress, opts) -> { y, scale, yaw, eased }`, where
    `opts = { dockY, dockScale, yaw, settleYaw }`. `progress` 0 is the resting pose at screen
    centre; 1 is the docked pose. **`expanding` is the same function run at `1 - progress`.**
  - `contentFade(fromRoute, toRoute) -> 'hold' | 'in' | 'out' | 'cross'`.
  - `fadeOpacity(mode, progress, contentFadeStart) -> number`.
- No `three` import, no DOM. `opts.yaw` is a snapshot taken by `src/main.js` at the moment the
  transition starts, so a coasting drag cannot move the target mid-flight.

**Why the yaw snaps rather than spins.** The viewer may have dragged to any yaw. Rotating by
the shortest signed angle to the nearest `SETTLE.yaw + k*90` turns at most 45 degrees and keeps
the recorded edge-on pose: edge-on shows three faces, face-on reads as a flat square. Because
`expanding` runs the identical curve backwards from an already-snapped yaw, the snap delta is
then zero and **reopening is exactly symmetric — the cube never appears to have moved while
docked.** A multi-revolution spin would be "similar to the appearance animation" in the literal
sense and wrong here: the entrance's spin is a curtain-raiser, this is a 0.9 s UI transition.

**Why four fade modes and not one curve.** Spec §12f specifies one curve and also says the DOM
swap happens where opacity is 0. Both cannot hold — see errata 2. The four modes are exactly
the four route-pair shapes: `hold` (same route, a dismissal — the content never moves), `in`
(landing to a page), `out` (a page to landing), `cross` (page to page, which must reach 0 at
the midpoint so the swap is invisible).

- [ ] **Step 1: Write the failing test**

Create `tests/dock.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { contentFade, dockState, fadeOpacity, yawSnapDelta } from '../src/dock.js';
import { DOCK, SETTLE } from '../src/config.js';

const QUARTER = Math.PI / 2;
const OPTS = { dockY: -1.9584, dockScale: 0.11612, yaw: SETTLE.yaw, settleYaw: SETTLE.yaw };

describe('yawSnapDelta', () => {
  it('is zero when the cube is already on a resting pose', () => {
    expect(yawSnapDelta(SETTLE.yaw, SETTLE.yaw)).toBeCloseTo(0, 12);
    for (const k of [-4, -1, 0, 1, 3]) {
      expect(yawSnapDelta(SETTLE.yaw + k * QUARTER, SETTLE.yaw)).toBeCloseTo(0, 12);
    }
  });

  it('takes the shortest signed path, in either direction', () => {
    expect(yawSnapDelta(SETTLE.yaw + 0.1, SETTLE.yaw)).toBeCloseTo(-0.1, 12);
    expect(yawSnapDelta(SETTLE.yaw - 0.1, SETTLE.yaw)).toBeCloseTo(0.1, 12);
    // 57.3 degrees past a resting pose is closer to the NEXT one, 32.7 forward.
    expect(yawSnapDelta(SETTLE.yaw + 1.0, SETTLE.yaw)).toBeCloseTo(QUARTER - 1.0, 12);
  });

  it('never turns more than a quarter of a quarter turn — 45 degrees', () => {
    for (let i = -720; i <= 720; i += 1) {
      const yaw = SETTLE.yaw + (i * Math.PI) / 180;
      expect(Math.abs(yawSnapDelta(yaw, SETTLE.yaw))).toBeLessThanOrEqual(QUARTER / 2 + 1e-12);
    }
  });

  it('lands exactly on a resting pose from anywhere, including +/-180 degrees', () => {
    for (const offset of [Math.PI, -Math.PI, 12.3, -45.6, QUARTER / 2]) {
      const yaw = SETTLE.yaw + offset;
      const landed = yaw + yawSnapDelta(yaw, SETTLE.yaw);
      const turns = (landed - SETTLE.yaw) / QUARTER;
      expect(turns).toBeCloseTo(Math.round(turns), 9);
    }
  });
});

describe('dockState', () => {
  it('starts at the resting pose', () => {
    const state = dockState(0, OPTS);
    expect(state.y).toBe(0);
    expect(state.scale).toBe(1);
    expect(state.yaw).toBeCloseTo(OPTS.yaw, 12);
  });

  it('ends on the dock, at a pose that is an exact quarter turn off settle', () => {
    const dragged = { ...OPTS, yaw: SETTLE.yaw + 1.0 };
    const state = dockState(1, dragged);
    expect(state.y).toBeCloseTo(OPTS.dockY, 12);
    expect(state.scale).toBeCloseTo(OPTS.dockScale, 12);

    const turns = (state.yaw - SETTLE.yaw) / QUARTER;
    expect(turns).toBeCloseTo(Math.round(turns), 9);
  });

  it('clamps progress instead of overshooting the dock', () => {
    expect(dockState(-1, OPTS).y).toBe(0);
    expect(dockState(4, OPTS).y).toBeCloseTo(OPTS.dockY, 12);
  });

  // Expanding is dockState run at 1 - p. easeInOutCubic is symmetric about
  // (0.5, 0.5), so the reverse pass retraces the forward one exactly and the
  // cube never appears to have moved while docked.
  it('is an exact mirror when run backwards', () => {
    for (let i = 0; i <= 20; i += 1) {
      const p = i / 20;
      const forward = dockState(p, OPTS);
      const backward = dockState(1 - p, OPTS);
      expect(forward.y + backward.y).toBeCloseTo(OPTS.dockY, 9);
      expect(forward.scale + backward.scale).toBeCloseTo(1 + OPTS.dockScale, 9);
    }
  });

  // Reopening starts from a yaw that is already snapped, so there is nothing
  // left to turn and the pose holds all the way back to centre.
  it('holds the yaw when reopening from an already-snapped pose', () => {
    const snapped = { ...OPTS, yaw: SETTLE.yaw + 3 * QUARTER };
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      expect(dockState(p, snapped).yaw).toBeCloseTo(snapped.yaw, 12);
    }
  });

  it('moves monotonically down and monotonically smaller', () => {
    let lastY = 1;
    let lastScale = 2;
    for (let i = 0; i <= 100; i += 1) {
      const state = dockState(i / 100, OPTS);
      expect(state.y).toBeLessThan(lastY);
      expect(state.scale).toBeLessThan(lastScale);
      lastY = state.y;
      lastScale = state.scale;
    }
  });
});

describe('contentFade', () => {
  it('holds the content when the route does not change — a dismissal', () => {
    expect(contentFade('work', 'work')).toBe('hold');
    expect(contentFade(null, null)).toBe('hold');
  });

  it('fades in from the landing page and out back to it', () => {
    expect(contentFade(null, 'work')).toBe('in');
    expect(contentFade('work', null)).toBe('out');
  });

  it('cross-fades between two content routes', () => {
    expect(contentFade('work', 'about')).toBe('cross');
  });
});

describe('fadeOpacity', () => {
  const START = DOCK.contentFadeStart;

  it('never moves the content in hold mode', () => {
    for (const p of [0, 0.5, 1]) expect(fadeOpacity('hold', p, START)).toBe(1);
  });

  it('holds the incoming page invisible until the cube has committed', () => {
    expect(fadeOpacity('in', 0, START)).toBe(0);
    expect(fadeOpacity('in', START, START)).toBe(0);
    expect(fadeOpacity('in', 0.7, START)).toBeCloseTo(0.5, 9);
    expect(fadeOpacity('in', 1, START)).toBeCloseTo(1, 9);
  });

  it('is the exact reverse when unmounting', () => {
    expect(fadeOpacity('out', 0, START)).toBeCloseTo(1, 9);
    expect(fadeOpacity('out', 0.3, START)).toBeCloseTo(0.5, 9);
    expect(fadeOpacity('out', 1 - START, START)).toBe(0);
    expect(fadeOpacity('out', 1, START)).toBe(0);
  });

  // This is what makes the mid-transition DOM swap invisible. The single curve
  // the spec proposes gives 0.1667 here, not 0 — see the plan's errata 2.
  it('reaches exactly zero at the midpoint when cross-fading', () => {
    expect(fadeOpacity('cross', 0, START)).toBeCloseTo(1, 9);
    expect(fadeOpacity('cross', 0.5, START)).toBeCloseTo(0, 12);
    expect(fadeOpacity('cross', 1, START)).toBeCloseTo(1, 9);
  });

  it('stays inside [0, 1] for every mode and any progress', () => {
    for (const mode of ['hold', 'in', 'out', 'cross']) {
      for (let i = -10; i <= 110; i += 1) {
        const value = fadeOpacity(mode, i / 100, START);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dock.test.js`
Expected: FAIL — `Failed to resolve import "../src/dock.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/dock.js`:

```js
import { easeInOutCubic } from './easing.js';
import { clamp01, lerp } from './math.js';

const QUARTER_TURN = Math.PI / 2;

// The shortest signed angle from `yaw` to the nearest settleYaw + k * 90 degrees
// — at most 45 degrees either way. The docked cube should read as a cube
// (edge-on shows three faces; face-on reads as a flat square) and should keep the
// recorded resting pose, but the viewer may have dragged it anywhere.
//
// Snap, do not spin: a multi-revolution turn would be "similar to the appearance
// animation" in the literal sense and wrong here. The entrance's spin is a
// curtain-raiser; this is a 0.9 s UI transition.
export function yawSnapDelta(yaw, settleYaw) {
  const offset = yaw - settleYaw;
  // Wrap the offset into (-45, +45] degrees around the nearest quarter turn.
  const wrapped = offset - QUARTER_TURN * Math.round(offset / QUARTER_TURN);
  return -wrapped;
}

// The dock transition, as a pure function of progress. 0 is the resting pose at
// screen centre; 1 is the docked pose.
//
// EXPANDING IS THIS SAME FUNCTION RUN AT 1 - progress. easeInOutCubic is
// symmetric about (0.5, 0.5), so the reverse pass retraces the forward one
// exactly; and because reopening starts from an already-snapped yaw, the snap
// delta is then 0 and the cube never appears to have moved while docked.
//
// `opts.yaw` is a snapshot taken by the caller when the transition starts, not a
// live read: a coasting drag must not move the target mid-flight.
export function dockState(progress, opts) {
  const eased = easeInOutCubic(clamp01(progress));

  return {
    // The resting Y is 0 (ENTRANCE.endY); the caller adds the float on top.
    y: lerp(0, opts.dockY, eased),
    scale: lerp(1, opts.dockScale, eased),
    yaw: opts.yaw + yawSnapDelta(opts.yaw, opts.settleYaw) * eased,
    eased,
  };
}

// Which content fade a transition needs, from the routes on either side of it.
// These are the only four shapes a route pair can take.
export function contentFade(fromRoute, toRoute) {
  // A dismissal: the nav opened over a page and closed again. The content never
  // moves, so touching its opacity at all would be a visible flicker.
  if (fromRoute === toRoute) return 'hold';
  if (fromRoute === null) return 'in';
  if (toRoute === null) return 'out';
  return 'cross';
}

// `contentFadeStart` 0.4 keeps the incoming page invisible for the front 40% of
// the transition, so the cube visibly commits to moving before the page arrives.
//
// 'cross' ignores it and uses |2p - 1|, which is exactly 0 at the midpoint. That
// is what makes the mid-transition DOM swap invisible — the fade-in curve is
// 0.1667 at the midpoint, not 0, so it cannot serve both jobs.
export function fadeOpacity(mode, progress, contentFadeStart) {
  const p = clamp01(progress);

  if (mode === 'hold') return 1;
  if (mode === 'cross') return Math.abs(2 * p - 1);

  if (mode === 'in') {
    if (p <= contentFadeStart) return 0;
    return (p - contentFadeStart) / (1 - contentFadeStart);
  }

  // 'out': the exact reverse of 'in', so a round trip is symmetric.
  if (p >= 1 - contentFadeStart) return 0;
  return 1 - p / (1 - contentFadeStart);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dock.test.js`
Expected: PASS — 18 cases.

- [ ] **Step 5: Commit**

```bash
git add src/dock.js tests/dock.test.js
git commit -m "feat: add the dock transition, yaw snap, and content fade curves"
```

---

### Task 6: `src/navstate.js` — the phase machine as a pure reducer

**Files:**
- Create: `src/navstate.js`
- Test: `tests/navstate.test.js`

**Interfaces:**
- Consumes: `LANDING_ROUTE` from `src/routes.js`.
- Produces:
  - `initialState(route, at) -> state`
  - `reduce(state, event) -> state`
  - `state` = `{ phase, route, fromRoute, phaseStartedAt, navigate }`.
    - `phase` is one of `'entering'`, `'resting'`, `'shrinking'`, `'docked'`, `'expanding'`.
    - `route` is `null` on the landing page, otherwise a route string.
    - `fromRoute` is the route the current phase was entered *from*; `src/main.js` feeds it to
      `contentFade`.
    - `phaseStartedAt` is the value of the monotonic `elapsed` clock when the phase began.
      **There is no second clock.** Progress is `(elapsed - phaseStartedAt) / duration`.
    - `navigate` is a **one-shot instruction to the caller**: `null`, or a route to push onto
      the hash. It never survives into the next reduction.
  - `event` = `{ type, route?, at? }` with `type` one of `'entranceDone'`, `'faceTap'`,
    `'missTap'`, `'escape'`, `'transitionDone'`, `'dockClick'`, `'hashChange'`.
- No `three`, no DOM, no `location`, no `history`. That is what lets the whole machine
  unit-test without a browser.

**Why `overlay` is not stored.** Spec §11 lists it in the state, but it is exactly
`route !== null` combined with the phase, so storing it would be a second source of truth for
one fact — see errata 5. `src/main.js` computes
`nav.route !== null && nav.phase === 'resting'` where it needs it.

**Why a face tap does not set the route.** `hashchange` is the single source of truth for
`route` (spec §15). A tap on a *different* route returns `navigate`, the caller sets
`location.hash`, and the `hashChange` event that follows drives the phase. This is what makes
the back button work for free instead of needing a parallel code path. A tap on the route
*already showing* is the exception: the hash would not change, so no `hashchange` would ever
arrive — that transition is taken directly, and pushes nothing.

**Dismissal never pushes history.** Opening the nav over a page and closing it again is not a
navigation; making it one would fill the back stack with no-ops.

- [ ] **Step 1: Write the failing test**

Create `tests/navstate.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { initialState, reduce } from '../src/navstate.js';

const at = (t) => ({ at: t });

function landing() {
  return initialState(null, 0);
}

// A cube resting at centre with `work` mounted behind it — the nav-overlay state
// that reopening the docked cube produces.
function overlay(route = 'work') {
  let state = initialState(route, 0);
  state = reduce(state, { type: 'dockClick', ...at(10) });
  return reduce(state, { type: 'transitionDone', ...at(11) });
}

describe('initialState', () => {
  it('plays the entrance for the landing page', () => {
    expect(initialState(null, 0)).toEqual({
      phase: 'entering',
      route: null,
      fromRoute: null,
      phaseStartedAt: 0,
      navigate: null,
    });
  });

  // A deep link, a refresh, or a shared URL: no entrance and no dock
  // transition. There is no prior on-screen position to move from, and 3.5 s of
  // theatre in front of requested content is wrong.
  it('starts a deep link docked, with no entrance', () => {
    expect(initialState('about', 5)).toEqual({
      phase: 'docked',
      route: 'about',
      fromRoute: 'about',
      phaseStartedAt: 5,
      navigate: null,
    });
  });
});

describe('entering', () => {
  it('ignores every input event', () => {
    const start = landing();
    for (const type of ['faceTap', 'missTap', 'escape', 'dockClick', 'transitionDone']) {
      const next = reduce(start, { type, route: 'work', ...at(1) });
      expect(next.phase).toBe('entering');
      expect(next.navigate).toBeNull();
    }
  });

  it('rests when the entrance lands', () => {
    const next = reduce(landing(), { type: 'entranceDone', ...at(3.5) });
    expect(next.phase).toBe('resting');
    expect(next.route).toBeNull();
    expect(next.phaseStartedAt).toBe(3.5);
  });
});

describe('resting on the landing page', () => {
  const resting = () => reduce(landing(), { type: 'entranceDone', ...at(3.5) });

  it('asks the caller to push the hash on a face tap, and does not move yet', () => {
    const next = reduce(resting(), { type: 'faceTap', route: 'work', ...at(4) });
    expect(next.navigate).toBe('work');
    expect(next.phase).toBe('resting');
    expect(next.route).toBeNull();
  });

  it('shrinks when the hashchange arrives', () => {
    const next = reduce(resting(), { type: 'hashChange', route: 'work', ...at(4.1) });
    expect(next.phase).toBe('shrinking');
    expect(next.route).toBe('work');
    expect(next.fromRoute).toBeNull();
    expect(next.phaseStartedAt).toBe(4.1);
    expect(next.navigate).toBeNull();
  });

  it('has nothing to dismiss, so a miss tap and Esc do nothing', () => {
    for (const type of ['missTap', 'escape']) {
      const next = reduce(resting(), { type, ...at(4) });
      expect(next.phase).toBe('resting');
      expect(next.route).toBeNull();
      expect(next.navigate).toBeNull();
    }
  });
});

describe('resting as a nav overlay over a page', () => {
  it('is where reopening the docked cube lands', () => {
    const state = overlay();
    expect(state.phase).toBe('resting');
    expect(state.route).toBe('work');
  });

  // Not a navigation: the hash would not change, so no hashchange would arrive
  // to drive the transition. Close directly, and push nothing.
  it('closes without pushing when the current route\'s face is tapped', () => {
    const next = reduce(overlay(), { type: 'faceTap', route: 'work', ...at(12) });
    expect(next.phase).toBe('shrinking');
    expect(next.route).toBe('work');
    expect(next.fromRoute).toBe('work');
    expect(next.navigate).toBeNull();
  });

  it('pushes the hash when a different route\'s face is tapped', () => {
    const next = reduce(overlay(), { type: 'faceTap', route: 'about', ...at(12) });
    expect(next.navigate).toBe('about');
    expect(next.phase).toBe('resting');
  });

  it('cross-fades when the hashchange for a different route arrives', () => {
    const next = reduce(overlay(), { type: 'hashChange', route: 'about', ...at(12.1) });
    expect(next.phase).toBe('shrinking');
    expect(next.route).toBe('about');
    expect(next.fromRoute).toBe('work');
  });

  it('closes on a miss tap or Esc, and pushes nothing', () => {
    for (const type of ['missTap', 'escape']) {
      const next = reduce(overlay(), { type, ...at(12) });
      expect(next.phase).toBe('shrinking');
      expect(next.route).toBe('work');
      expect(next.navigate).toBeNull();
    }
  });

  // The cube is ALREADY at centre, so there is no motion to play — only the
  // content unmounts. Spec section 11 routes this through `expanding`, which is
  // right for the docked half of that row and wrong here (plan errata 4).
  it('stays resting when history goes back to the landing page', () => {
    const next = reduce(overlay(), { type: 'hashChange', route: null, ...at(12.1) });
    expect(next.phase).toBe('resting');
    expect(next.route).toBeNull();
    expect(next.fromRoute).toBe('work');
  });
});

describe('the transitions', () => {
  const shrinking = () => reduce(overlay(), { type: 'escape', ...at(12) });

  it('docks when the shrink lands', () => {
    const next = reduce(shrinking(), { type: 'transitionDone', ...at(12.9) });
    expect(next.phase).toBe('docked');
    expect(next.route).toBe('work');
    expect(next.phaseStartedAt).toBe(12.9);
  });

  it('ignores every event but transitionDone while shrinking', () => {
    const start = shrinking();
    for (const type of ['faceTap', 'missTap', 'escape', 'dockClick', 'hashChange']) {
      const next = reduce(start, { type, route: 'about', ...at(12.5) });
      expect(next.phase).toBe('shrinking');
      expect(next.navigate).toBeNull();
    }
  });

  it('ignores every event but transitionDone while expanding', () => {
    const start = reduce(initialState('work', 0), { type: 'dockClick', ...at(10) });
    expect(start.phase).toBe('expanding');
    for (const type of ['faceTap', 'missTap', 'escape', 'dockClick', 'hashChange']) {
      const next = reduce(start, { type, route: 'about', ...at(10.5) });
      expect(next.phase).toBe('expanding');
      expect(next.navigate).toBeNull();
    }
  });

  it('rests when the expand lands', () => {
    const start = reduce(initialState('work', 0), { type: 'dockClick', ...at(10) });
    const next = reduce(start, { type: 'transitionDone', ...at(10.9) });
    expect(next.phase).toBe('resting');
    expect(next.route).toBe('work');
  });
});

describe('docked', () => {
  const docked = () => initialState('work', 0);

  it('reopens the big cube over the current page', () => {
    const next = reduce(docked(), { type: 'dockClick', ...at(10) });
    expect(next.phase).toBe('expanding');
    expect(next.route).toBe('work');
    expect(next.fromRoute).toBe('work');
  });

  // Animating this would be a 1.8 s round trip for a back-button press.
  it('swaps content in place when history jumps between two content routes', () => {
    const next = reduce(docked(), { type: 'hashChange', route: 'about', ...at(10) });
    expect(next.phase).toBe('docked');
    expect(next.route).toBe('about');
    expect(next.fromRoute).toBe('work');
    expect(next.navigate).toBeNull();
  });

  it('brings the big cube back up when history goes to the landing page', () => {
    const next = reduce(docked(), { type: 'hashChange', route: null, ...at(10) });
    expect(next.phase).toBe('expanding');
    expect(next.route).toBeNull();
  });

  it('ignores a hashchange for the route it is already on', () => {
    const start = docked();
    const next = reduce(start, { type: 'hashChange', route: 'work', ...at(10) });
    expect(next).toBe(start);
  });

  it('ignores taps — the canvas takes no pointer events while docked', () => {
    for (const type of ['faceTap', 'missTap', 'escape']) {
      expect(reduce(docked(), { type, route: 'about', ...at(10) }).phase).toBe('docked');
    }
  });
});

describe('navigate', () => {
  it('never survives into the next reduction', () => {
    const resting = reduce(landing(), { type: 'entranceDone', ...at(3.5) });
    const asked = reduce(resting, { type: 'faceTap', route: 'work', ...at(4) });
    expect(asked.navigate).toBe('work');

    const after = reduce(asked, { type: 'hashChange', route: 'work', ...at(4.1) });
    expect(after.navigate).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/navstate.test.js`
Expected: FAIL — `Failed to resolve import "../src/navstate.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/navstate.js`:

```js
import { LANDING_ROUTE } from './routes.js';

// The nav phase machine, as a pure reducer. Modelled explicitly and without the
// DOM because the alternative is a tangle of booleans in main.js, and because
// this way every row of the transition table unit-tests without a browser.
//
// `overlay` from the spec's state shape is deliberately NOT stored: it is
// exactly `route !== null` combined with the phase, so keeping it would be a
// second source of truth for one fact. main.js derives it.
//
// There is ONE clock. `phaseStartedAt` is a reading of main.js's monotonic
// `elapsed`, and each transition's progress is
// (elapsed - phaseStartedAt) / duration. Do not add a second one.
//
// `navigate` is a one-shot instruction to the caller — a route to push onto the
// hash — and never survives into the next reduction. It exists because
// `hashchange` is the single source of truth for `route`: a face tap sets the
// hash, and the hashchange that follows drives the phase. That is what makes the
// back button work without a parallel code path.

export function initialState(route, at = 0) {
  // A deep link, a refresh, or a shared URL starts docked with content already
  // mounted and plays no entrance: there is no prior on-screen position to dock
  // from, and 3.5 s of theatre in front of requested content is wrong.
  if (route !== LANDING_ROUTE) {
    return { phase: 'docked', route, fromRoute: route, phaseStartedAt: at, navigate: null };
  }

  return {
    phase: 'entering',
    route: LANDING_ROUTE,
    fromRoute: LANDING_ROUTE,
    phaseStartedAt: at,
    navigate: null,
  };
}

function moveTo(state, phase, route, at) {
  return { phase, route, fromRoute: state.route, phaseStartedAt: at, navigate: null };
}

// Same state, with any pending `navigate` cleared.
function stay(state) {
  return state.navigate === null ? state : { ...state, navigate: null };
}

export function reduce(state, event) {
  const at = event.at === undefined ? state.phaseStartedAt : event.at;

  if (state.phase === 'entering') {
    // The entrance ignores every input event. A press before it lands would make
    // the yaw at t = duration SETTLE.yaw + userYaw and break the exact landing
    // pose, and there is nothing on screen to navigate from anyway.
    if (event.type !== 'entranceDone') return stay(state);
    return moveTo(state, 'resting', state.route, at);
  }

  // Transitions accept nothing: they are 0.9 s of committed motion.
  if (state.phase === 'shrinking' || state.phase === 'expanding') {
    if (event.type !== 'transitionDone') return stay(state);
    const next = state.phase === 'shrinking' ? 'docked' : 'resting';
    return moveTo(state, next, state.route, at);
  }

  if (state.phase === 'resting') {
    switch (event.type) {
      case 'faceTap':
        // A tap on the route already showing is a dismissal, not a navigation:
        // the hash would not change, so no hashchange would arrive to drive the
        // transition. Close directly, and push nothing.
        if (event.route === state.route) return moveTo(state, 'shrinking', state.route, at);
        // Everything else routes through the hash.
        return { ...state, navigate: event.route };

      case 'missTap':
      case 'escape':
        // Dismissal only exists over content. On the landing page there is
        // nothing to dismiss to.
        if (state.route === LANDING_ROUTE) return stay(state);
        return moveTo(state, 'shrinking', state.route, at);

      case 'hashChange':
        if (event.route === state.route) return stay(state);
        // Back to the landing page while the big cube is already at centre:
        // there is no motion to play, only content to unmount.
        if (event.route === LANDING_ROUTE) {
          return moveTo(state, 'resting', LANDING_ROUTE, at);
        }
        return moveTo(state, 'shrinking', event.route, at);

      default:
        return stay(state);
    }
  }

  // docked. The canvas takes no pointer events here, so no tap can arrive.
  switch (event.type) {
    case 'dockClick':
      return moveTo(state, 'expanding', state.route, at);

    case 'hashChange':
      if (event.route === state.route) return stay(state);
      if (event.route === LANDING_ROUTE) return moveTo(state, 'expanding', LANDING_ROUTE, at);
      // Two content routes: the cube is already docked and stays put. Animating
      // it would be a 1.8 s round trip for a back-button press.
      return moveTo(state, 'docked', event.route, at);

    default:
      return stay(state);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/navstate.test.js`
Expected: PASS — 23 cases, covering every row of spec §11's transition table.

- [ ] **Step 5: Commit**

```bash
git add src/navstate.js tests/navstate.test.js
git commit -m "feat: add the nav phase machine as a pure reducer"
```

---

### Task 7: `src/pick.js` — tap-vs-drag discrimination and NDC

**Files:**
- Create: `src/pick.js`
- Test: `tests/pick.test.js`

**Interfaces:**
- Consumes: `PICK` from `src/config.js` (added in Task 4) — the caller passes it in.
- Produces:
  - `createTapTracker({ tapMaxTravelPx, tapMaxDurationMs, tapMaxEntrySpeedRevs })` returning
    `{ start(x, y, timeMs, entrySpeedRevs), move(x, y), candidate(timeMs) -> boolean,
    end(timeMs) -> boolean, cancel() }`.
  - `pointerToNdc(clientX, clientY, rect) -> { x, y }` where `rect` is anything with
    `left`, `top`, `width`, `height`.
- No `three`, no DOM. `rect` is passed in as plain numbers.

**A face click is a *failed* drag.** The same gesture on the same surface already means "spin
the cube", so a tap must be defined negatively, and it runs entirely on the existing pointer
plumbing (`src/main.js:112-136`). **Do not add a `click` listener** — `click` fires after a drag
too, and its target is the canvas, not a face.

**`candidate()` exists for the highlight, `end()` for the navigation.** Once the gesture passes
the travel threshold it is a drag, so the armed-face highlight should clear immediately rather
than waiting for the release. Both read the same predicate, so they cannot disagree.

**Why NDC comes from the canvas rect, not `window`.** They coincide today but will not if the
canvas box ever changes.

- [ ] **Step 1: Write the failing test**

Create `tests/pick.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { createTapTracker, pointerToNdc } from '../src/pick.js';
import { PICK } from '../src/config.js';

describe('createTapTracker', () => {
  const press = (tracker, entrySpeedRevs = 0) => tracker.start(100, 100, 1000, entrySpeedRevs);

  it('counts a short, still gesture as a tap', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    tracker.move(105, 104); // 6.40 px
    expect(tracker.end(1300)).toBe(true);
  });

  it('rejects a gesture that travels past the threshold', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    tracker.move(109, 100); // 9 px
    expect(tracker.end(1300)).toBe(false);
  });

  it('rejects a long press that never moved', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    tracker.move(103, 103);
    expect(tracker.end(1600)).toBe(false);
  });

  // Straight-line distance from the press point, not cumulative path length, so
  // jitter that returns to the origin still counts as a tap.
  it('measures travel from the origin, so out-and-back is still a tap', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    tracker.move(106, 100);
    tracker.move(100, 100);
    tracker.move(94, 100);
    tracker.move(100, 100);
    expect(tracker.end(1300)).toBe(true);
  });

  it('remembers the furthest point, not the last one', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    tracker.move(140, 100); // well past the threshold
    tracker.move(100, 100); // back to the origin
    expect(tracker.end(1300)).toBe(false);
  });

  // drag.start() zeroes the velocity so a press stops a coasting cube. Left
  // alone, one tap would both brake AND navigate: the first tap must only stop.
  it('rejects a tap that was spent braking a coasting cube', () => {
    const braking = createTapTracker(PICK);
    braking.start(100, 100, 1000, 0.06);
    expect(braking.end(1300)).toBe(false);

    const gentle = createTapTracker(PICK);
    gentle.start(100, 100, 1000, 0.04);
    expect(gentle.end(1300)).toBe(true);
  });

  it('stops being a candidate as soon as the gesture becomes a drag', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    expect(tracker.candidate(1100)).toBe(true);
    tracker.move(120, 100);
    expect(tracker.candidate(1100)).toBe(false);
  });

  it('stops being a candidate once the press outlives the duration limit', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    expect(tracker.candidate(1400)).toBe(true);
    expect(tracker.candidate(1600)).toBe(false);
  });

  it('consumes the gesture, so a second end is never a second tap', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    expect(tracker.end(1300)).toBe(true);
    expect(tracker.end(1300)).toBe(false);
  });

  it('discards the gesture on cancel', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    tracker.cancel();
    expect(tracker.candidate(1100)).toBe(false);
    expect(tracker.end(1300)).toBe(false);
  });

  it('ignores moves and ends with no gesture in flight', () => {
    const tracker = createTapTracker(PICK);
    expect(() => tracker.move(10, 10)).not.toThrow();
    expect(tracker.end(1300)).toBe(false);
    expect(tracker.candidate(1300)).toBe(false);
  });
});

describe('pointerToNdc', () => {
  it('maps the centre of the canvas to the origin', () => {
    const rect = { left: 0, top: 0, width: 1920, height: 1080 };
    expect(pointerToNdc(960, 540, rect)).toEqual({ x: 0, y: 0 });
  });

  it('maps the corners to the unit square, with Y flipped', () => {
    const rect = { left: 0, top: 0, width: 1920, height: 1080 };
    expect(pointerToNdc(0, 0, rect)).toEqual({ x: -1, y: 1 });
    expect(pointerToNdc(1920, 1080, rect)).toEqual({ x: 1, y: -1 });
  });

  // The canvas box and the window coincide today, but will not if the canvas
  // ever stops filling the viewport.
  it('works against a rect with a non-zero origin', () => {
    const rect = { left: 200, top: 100, width: 800, height: 400 };
    expect(pointerToNdc(600, 300, rect)).toEqual({ x: 0, y: 0 });
    expect(pointerToNdc(200, 100, rect)).toEqual({ x: -1, y: 1 });
    expect(pointerToNdc(1000, 500, rect)).toEqual({ x: 1, y: -1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pick.test.js`
Expected: FAIL — `Failed to resolve import "../src/pick.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/pick.js`:

```js
// Tap-vs-drag discrimination and NDC conversion. Stateful but pure: no three, no
// DOM, no events — main.js owns the listeners and calls in, the same split
// src/drag.js uses.
//
// A face click is a FAILED drag. The same gesture on the same surface already
// means "spin the cube", so a tap is defined negatively and runs on the existing
// pointer plumbing. Do NOT add a `click` listener: click fires after a drag too,
// and its target is the canvas, not a face.
export function createTapTracker({ tapMaxTravelPx, tapMaxDurationMs, tapMaxEntrySpeedRevs }) {
  let gesture = null;

  function stillATap(timeMs) {
    if (gesture === null) return false;
    if (gesture.braked) return false;
    if (gesture.maxTravel > tapMaxTravelPx) return false;
    return timeMs - gesture.startedAt <= tapMaxDurationMs;
  }

  return {
    // `entrySpeedRevs` is the coast speed the press just cancelled, in rev/s, as
    // returned by drag.start(). A press on a coasting cube brakes it, and that
    // brake must not also navigate: the first tap stops the cube, the second one
    // navigates.
    start(x, y, timeMs, entrySpeedRevs) {
      gesture = {
        x,
        y,
        startedAt: timeMs,
        maxTravel: 0,
        braked: entrySpeedRevs > tapMaxEntrySpeedRevs,
      };
    },

    move(x, y) {
      if (gesture === null) return;
      // Straight-line distance from the press point, not cumulative path length,
      // so jitter that returns to the origin still counts as a tap. The furthest
      // point is what is remembered: a gesture that swung wide and came back was
      // a drag.
      const travel = Math.hypot(x - gesture.x, y - gesture.y);
      if (travel > gesture.maxTravel) gesture.maxTravel = travel;
    },

    // Is this gesture still capable of being a tap? Read on pointermove so the
    // armed-face highlight can clear the moment the gesture becomes a drag,
    // rather than waiting for the release.
    candidate(timeMs) {
      return stillATap(timeMs);
    },

    // Consumes the gesture, so the lostpointercapture that follows a pointerup
    // cannot produce a second tap.
    end(timeMs) {
      const tapped = stillATap(timeMs);
      gesture = null;
      return tapped;
    },

    cancel() {
      gesture = null;
    },
  };
}

// Normalised device coordinates from the CANVAS's own box, not from `window`:
// they coincide today but will not if the canvas box ever changes. Y is flipped
// — NDC is +1 at the top, CSS pixels are 0 at the top.
export function pointerToNdc(clientX, clientY, rect) {
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: 1 - ((clientY - rect.top) / rect.height) * 2,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pick.test.js`
Expected: PASS — 14 cases.

- [ ] **Step 5: Commit**

```bash
git add src/pick.js tests/pick.test.js
git commit -m "feat: add tap-vs-drag discrimination and NDC conversion"
```

---

### Task 8: Six materials and `setArmedFace` — face feedback is required, not polish

**Files:**
- Modify: `src/cube.js`
- Modify: `src/scene.js:17-18`, `:40-49`
- Test: `tests/cube.test.js`, `tests/scene.test.js`

**Interfaces:**
- Consumes: `COLORS.face`, `COLORS.faceArmed`, `CUBE_SIZE` from `src/config.js` (Task 4 added
  `faceArmed`).
- Produces:
  - `createCube()` now returns `{ mesh, setArmedFace, getArmedFace }` instead of the bare
    `Mesh`. **This is a breaking change to two callers** — `src/scene.js:17-18` and
    `tests/cube.test.js`.
  - `setArmedFace(faceIndex | null)` — paints exactly one material `COLORS.faceArmed` and
    restores any previously armed one. `null` clears.
  - `view.setArmedFace` on the object `createScene` returns. `view.cube` is still the `Mesh`.

**Why this is a requirement.** **At the resting pose the boundary between two routes runs
exactly down the middle of the cube, and it is a one-pixel switch.** Verified at 1920×1080,
yaw 45°, pitch 15°: a ray at screen centre hits the −X face; one pixel to the right hits +Z.
The cube's visual centre is the most natural place to click, and clicking it is a coin flip
between two sections. This cannot be fixed by geometry — the edge *is* the resting pose
(`AGENTS.md`, *Resting pose*). It has to be fixed by telling the viewer which face is armed
before they commit, which needs per-face colour, which needs a material array.

**It is still one mesh, one geometry, no wrapping `Group`, no edge outline** — one draw call
per group. `AGENTS.md`'s *Cube look* decision is contradicted only on the word *one*, and Task
16 rewords it.

**The array also makes `face.materialIndex` correct**, which Task 9 pins down as an executable
note. The code still keys on the normal.

**Why a factory return rather than methods bolted onto the `Mesh`.** `src/drag.js` and
`src/scene.js` are both factories returning plain objects; attaching methods to a three object
would be the only place in the codebase doing something else.

- [ ] **Step 1: Write the failing test**

Replace `tests/cube.test.js` entirely:

```js
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
```

Append to `tests/scene.test.js`:

```js
  it('exposes the cube\'s armed-face control alongside the mesh', () => {
    const view = createScene(1600, 900);
    expect(view.scene.getObjectByName('cube')).toBe(view.cube);
    expect(typeof view.setArmedFace).toBe('function');

    view.setArmedFace(2);
    expect(view.cube.material[2].color.getHex()).toBe(COLORS.faceArmed);
    view.setArmedFace(null);
    expect(view.cube.material[2].color.getHex()).toBe(COLORS.face);
  });
```

Extend `tests/scene.test.js`'s config import to include `COLORS` (already there) — no change
needed if `COLORS` is already imported at `:5`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cube.test.js tests/scene.test.js`
Expected: FAIL — `createCube().mesh` is `undefined` (it currently returns the `Mesh` itself),
and `view.setArmedFace is not a function`.

- [ ] **Step 3: Rewrite `src/cube.js`**

```js
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
```

- [ ] **Step 4: Update `src/scene.js` for the new return shape**

Replace `:17-18`:

```js
  const { mesh: cube, setArmedFace } = createCube();
  scene.add(cube);
```

Add `setArmedFace` to the returned object, next to `cube`:

```js
    scene,
    camera,
    cube,
    setArmedFace,
    resize,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS, whole suite. `tests/scene.test.js`'s existing
`builds an off-white scene containing the cube` still passes — `view.cube` is still the `Mesh`
and still named `cube`.

- [ ] **Step 6: Confirm the page still looks identical**

Run: `npm run dev` and reload.

Expected: **pixel-identical to before this task.** All six materials start at `COLORS.face`
with the same roughness, metalness, and flat shading, so nothing about the render changes yet.
If the cube looks different, one of the six materials was built with different parameters.

- [ ] **Step 7: Commit**

```bash
git add src/cube.js src/scene.js tests/cube.test.js tests/scene.test.js
git commit -m "feat: give the cube six materials and an armed-face control"
```

---

### Task 9: `tests/facepick.test.js` — lock the geometry facts the design rests on

**Files:**
- Create: `tests/facepick.test.js`

**Interfaces:**
- Consumes: `createScene` (Task 4/8), `faceIndexFromNormal` (Task 1), `pointerToNdc` (Task 7),
  `SETTLE` and `CUBE_SIZE` from `src/config.js`.
- Produces: nothing. **This task adds no source code.** It is three executable notes for three
  empirical facts the whole of Part B rests on, each of which is invisible in the code and will
  otherwise be rediscovered the hard way.

Runs headlessly — three's `Raycaster` needs no WebGL, as the spec's own measurements
demonstrate.

- [ ] **Step 1: Write the test**

Create `tests/facepick.test.js`:

```js
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
    const reached = new Set();

    for (let degrees = 0; degrees < 360; degrees += 5) {
      view.cube.rotation.set(SETTLE.pitch, SETTLE.yaw + (degrees * Math.PI) / 180, 0);
      const index = hitFaceIndex(view, 700, 540);
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
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/facepick.test.js`
Expected: PASS — 9 cases. This task has no red phase: it asserts facts about three and about
code that already exists.

**If `hits -X one pixel left of centre` fails**, do not adjust the pixel offsets to make it
pass. Either the Euler order or `SETTLE` changed, or three's `BoxGeometry` group order changed
— in any of those cases `src/routes.js`'s face map is now wrong and the route table needs
re-deriving.

**If `shows the top face at rest` fails**, the top face's projected band has moved. It varies
only between 18 256 and 19 664 px² across a full turn of yaw (7.9%–8.6% of the silhouette), so
a failure means the pitch or `FIT_MARGIN` changed. Re-derive the sample point from the new
framing rather than loosening the assertion.

- [ ] **Step 3: Commit**

```bash
git add tests/facepick.test.js
git commit -m "test: lock the face-picking geometry the route table depends on"
```

---

### Task 10: `src/drag.js` — report the cancelled coast, and expose a brake

**Files:**
- Modify: `src/drag.js:24-31` (`start`), and add `brake`
- Test: `tests/drag.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `start(x)` now **returns the magnitude of the coast velocity it cancelled, in rev/s.**
    Task 13 passes it to `tap.start` as `entrySpeedRevs`.
  - `brake()` — zeroes the coast velocity without starting a drag. Task 14 calls it when a dock
    transition begins.
- Every existing behaviour is unchanged. `DRAG` is untouched.

**Why `start` returns a value.** `drag.start()` already zeroes the velocity so a press stops a
coasting cube — existing intended behaviour (`src/drag.js:28-30`). Left alone, one tap would
both brake *and* navigate. Returning what was cancelled lets `src/pick.js` require the pre-press
speed to be under `PICK.tapMaxEntrySpeedRevs`: the first tap stops the cube, the second
navigates. A one-value return on an existing method, and directly unit-testable.

**Why `brake` exists.** Esc, the dock button, and the back button all start a dock transition
*without* a pointer press, so none of them go through `start()`. If the cube were coasting when
one of them fired, the drag's yaw would keep advancing through the transition while the
transition's own yaw snapshot stayed fixed — and the docked pose would jump when
`src/main.js` folds the snap delta in. Three lines here instead of teaching `src/drag.js` about
the nav.

- [ ] **Step 1: Write the failing test**

Append to `tests/drag.test.js` (matching its existing `createDragSpin` option object — reuse
whatever constant that file already defines for `DRAG`; the examples below assume it is named
`OPTS`):

```js
describe('start reports the coast it cancelled', () => {
  it('returns zero when the cube was already still', () => {
    const drag = createDragSpin(OPTS);
    expect(drag.start(100)).toBe(0);
  });

  it('returns the cancelled speed in revolutions per second', () => {
    const drag = createDragSpin(OPTS);
    // Throw the cube: 400 px of drag in one 1/60 s frame, then release.
    drag.start(0);
    drag.update(1 / 60, 1000);
    drag.move(400);
    drag.update(1 / 60, 1000);
    drag.end();

    const coasting = drag.update(1 / 60, 1000);
    expect(coasting).not.toBe(0);

    // A press on the coasting cube stops it dead and says how fast it was.
    const cancelledRevs = drag.start(400);
    expect(cancelledRevs).toBeGreaterThan(0);

    // Still means still: another frame adds no yaw.
    const held = drag.update(1 / 60, 1000);
    expect(drag.update(1 / 60, 1000)).toBeCloseTo(held, 12);
  });

  it('reports magnitude, so a leftward throw is not a negative speed', () => {
    const drag = createDragSpin(OPTS);
    drag.start(400);
    drag.update(1 / 60, 1000);
    drag.move(0);
    drag.update(1 / 60, 1000);
    drag.end();
    drag.update(1 / 60, 1000);

    expect(drag.start(0)).toBeGreaterThan(0);
  });
});

describe('brake', () => {
  it('stops a coast without starting a drag', () => {
    const drag = createDragSpin(OPTS);
    drag.start(0);
    drag.update(1 / 60, 1000);
    drag.move(400);
    drag.update(1 / 60, 1000);
    drag.end();

    const before = drag.update(1 / 60, 1000);
    drag.brake();

    // The yaw holds: no coast, and no drag delta from a pointer that never moved.
    expect(drag.update(1 / 60, 1000)).toBeCloseTo(before, 12);
    expect(drag.update(1 / 60, 1000)).toBeCloseTo(before, 12);
  });

  it('is a no-op on a still cube', () => {
    const drag = createDragSpin(OPTS);
    const before = drag.update(1 / 60, 1000);
    drag.brake();
    expect(drag.update(1 / 60, 1000)).toBeCloseTo(before, 12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/drag.test.js`
Expected: FAIL — `start` returns `undefined` (so `toBe(0)` fails), and
`drag.brake is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/drag.js`, replace `start` (`:24-31`) and add `brake` beside it:

```js
    // Returns the coast speed it just cancelled, in rev/s. Pressing a coasting
    // cube grabs it: without the zeroing, a tap would re-throw the cube at its
    // current speed instead of stopping it dead. The RETURN VALUE is what lets
    // the caller tell a brake from a navigation — one tap must not do both, so
    // src/pick.js rejects a tap whose press cancelled more than
    // PICK.tapMaxEntrySpeedRevs.
    start(x) {
      const cancelledRevs = Math.abs(velocity) / TAU;
      dragging = true;
      lastApplied = x;
      latest = x;
      velocity = 0;
      return cancelledRevs;
    },

    // Stop a coast with no pointer involved. Esc, the dock button, and the back
    // button all begin a dock transition without a press, so none of them go
    // through start(); if the cube were coasting, its yaw would keep advancing
    // through the transition while the transition's own yaw snapshot stayed
    // fixed, and the docked pose would jump at the end.
    brake() {
      velocity = 0;
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, whole suite. Every existing `drag.test.js` case still passes — `start`'s side
effects are unchanged and `brake` is new.

- [ ] **Step 5: Commit**

```bash
git add src/drag.js tests/drag.test.js
git commit -m "feat: report the cancelled coast from drag.start and add brake"
```

---

### Task 11: The document skeleton — layers, the hidden nav, and the scroll switch

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: nothing. This task adds no JavaScript.
- Produces the DOM contract Tasks 12–14 wire against:
  - `<nav id="routes">` — five `<a href="#/…">`, first in the document, visually hidden but
    focusable.
  - `<main id="page">` — the content mount point.
  - `<div id="scrim" hidden>` — purely visual.
  - `<canvas id="scene">` — now `position: fixed; inset: 0`.
  - `<button id="dock" hidden>` — the docked cube's control.
  - Two attributes on `<html>`, written by `src/main.js`: `data-phase` (one of the five phase
    names) drives the canvas `pointer-events`; `data-scroll` (`locked` / `free`) drives page
    scrolling.

**The layering, and why the canvas stays full-viewport.**

| Layer | Element | z-index | Pointer events |
| --- | --- | --- | --- |
| Content | `<main id="page">` | 0 | auto |
| Scrim | `<div id="scrim">` | 1 | **none** — see errata 6 |
| Cube | `<canvas id="scene">` | 2 | `auto` only in `resting` |
| Dock button | `<button id="dock">` | 3 | auto, and it only exists while docked |
| Hidden nav | `<nav id="routes">` | 4 | auto when focused |

The canvas is full-viewport in **every** phase — that is what lets the cube animate from screen
centre to the bottom edge in one continuous motion. It therefore cannot also swallow clicks on
the article text underneath, hence the `pointer-events` switch, and hence a separate `<button>`
rather than hit-testing the docked cube through the canvas.

**The scrim takes no pointer events.** Spec §7b gives it `auto` while the nav is open, but §9d
makes a *raycast miss* the dismissal signal, and the canvas sits above the scrim and takes
pointer events in `resting` — so the scrim would never receive one. Purely visual is both
simpler and what §9d actually requires.

**Keyboard access is not optional here.** A raycast has no keyboard equivalent, so face
clicking alone would leave keyboard users with no navigation at all. Five real links, always in
the DOM, `clip-path`-hidden rather than `display: none` (which would remove them from the tab
order), placed first so they double as skip navigation. They are invisible, so the canvas-only
look survives — but they **are** DOM text, and Task 16 rewords `AGENTS.md` accordingly.

- [ ] **Step 1: Replace `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Portfolio</title>
  </head>
  <body>
    <!-- First in the document so it doubles as skip navigation. Visually hidden
         but focusable: a raycast has no keyboard equivalent, so without these
         links keyboard users would have no navigation at all. clip-path, not
         display:none — display:none removes them from the tab order. -->
    <nav id="routes" aria-label="Sections">
      <a href="#/work">Work</a>
      <a href="#/about">About</a>
      <a href="#/writing">Writing</a>
      <a href="#/play">Playground</a>
      <a href="#/contact">Contact</a>
    </nav>
    <main id="page"></main>
    <!-- Purely visual: miss-taps come from the raycast (the canvas sits above
         this and takes the pointer events), so this never needs any of its own. -->
    <div id="scrim" hidden></div>
    <canvas id="scene"></canvas>
    <!-- The docked cube's control. The canvas cannot carry a focus ring, and
         hit-testing a 64 px cube through a full-viewport canvas would mean
         leaving that canvas clickable over the whole page. -->
    <button id="dock" type="button" aria-label="Open navigation" hidden></button>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace `src/style.css`**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  background: #f7f7f8;
  color: #2a2c30;
  font: 400 1rem/1.7 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

/* Scrolling is the content's job now, so the blanket `overflow: hidden` is gone.
   It comes back only while the big cube is up — there is nothing to scroll to
   behind a scrim — and src/main.js owns that policy through one attribute. */
html[data-scroll='locked'],
html[data-scroll='locked'] body {
  overflow: hidden;
}

#routes a {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 4;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  color: inherit;
}

/* Focusable means it must be visible when focused: an invisible focus ring is
   not keyboard access. */
#routes a:focus-visible {
  width: auto;
  height: auto;
  clip-path: none;
  margin: 0.5rem;
  padding: 0.4rem 0.7rem;
  background: #f7f7f8;
  outline: 2px solid #3b6fd6;
  outline-offset: 2px;
}

#page {
  position: relative;
  z-index: 0;
  max-width: 62ch;
  /* The bottom padding keeps the last line clear of the docked cube. */
  margin: 0 auto;
  padding: 14vh 1.5rem 40vh;
}

#page h1 {
  font-size: 1.75rem;
  font-weight: 500;
  letter-spacing: -0.01em;
}

#page h1:focus-visible {
  outline: 2px solid #3b6fd6;
  outline-offset: 4px;
}

#page .page-hash {
  margin-top: 0.35rem;
  color: #8a8d93;
  font-size: 0.8125rem;
}

#page p {
  color: #4a4d53;
}

#page .page-hash + p {
  margin-top: 2.5rem;
}

#page p + p {
  margin-top: 1.1rem;
}

#scrim {
  position: fixed;
  inset: 0;
  z-index: 1;
  background: #f7f7f8;
  opacity: 0.82;
  pointer-events: none;
}

#scene {
  position: fixed;
  inset: 0;
  z-index: 2;
  display: block;
  /* Required, not polish: without it the browser claims a horizontal drag for
     its own gesture handling before pointermove fires, and a downward drag
     triggers pull-to-refresh on Android. overflow: hidden does not prevent it.
     Harmless while docked, where the canvas takes no pointer events at all. */
  touch-action: none;
  cursor: grab;
  /* The canvas is full-viewport in EVERY phase — that is what lets the cube
     animate from centre to the bottom edge in one continuous motion — so it must
     not also swallow clicks on the article text underneath. Only the phase where
     the big cube is up takes pointer events. */
  pointer-events: none;
}

html[data-phase='resting'] #scene {
  pointer-events: auto;
}

html[data-phase='resting'] #scene:active {
  cursor: grabbing;
}

#dock {
  position: fixed;
  left: 50%;
  z-index: 3;
  transform: translateX(-50%);
  /* src/main.js writes width, height, and bottom from the live dock framing;
     these are the floor, so a 62 px drawn cube on a phone stays tappable. */
  min-width: 44px;
  min-height: 44px;
  border: 0;
  background: transparent;
  cursor: pointer;
}

#dock:focus-visible {
  outline: 2px solid #3b6fd6;
  outline-offset: 3px;
  border-radius: 4px;
}
```

- [ ] **Step 3: Verify the page is unchanged and nothing new is visible**

Run: `npm run dev` and reload.

Expected: the landing page looks **exactly as before** — the cube entering, floating, and
draggable. Specifically check:

- [ ] No visible text anywhere on the page.
- [ ] The cube still spins on drag. (`data-phase` is not written yet, so
      `html[data-phase='resting'] #scene { pointer-events: auto }` does not match and the
      canvas takes **no** pointer events. **Drag will be dead until Task 12.** Confirm the
      entrance and float still animate; that is what this step is checking.)
- [ ] Pressing Tab once reveals a "Work" link at the top left with a focus ring; Tab four more
      times walks through About, Writing, Playground, Contact. Each has a visible ring.
- [ ] Pressing Enter on the focused "Work" link changes the URL to `#/work` and nothing else
      happens yet (no listener until Task 12).
- [ ] `npm run build` exits 0.

- [ ] **Step 4: Commit**

```bash
git add index.html src/style.css
git commit -m "feat: add the SPA document skeleton, hidden nav, and layer styles"
```

---

## Tasks 12–14: wiring `src/main.js`

`src/main.js` is the only browser-coupled file, and it roughly doubles. It is wired in three
passes so the page is exercisable end to end after each one, and so a reviewer can reject one
pass while approving its neighbour:

| Pass | Adds | Reachable after it |
| --- | --- | --- |
| **12** | Hash routing, content mounting, the state machine, the dock button, Esc, the phase attributes, deep links | Every route, via the hidden nav links and the back button. Dock transitions are **instant**. |
| **13** | The raycaster, tap detection, hover and press feedback | Tapping a face navigates; dragging still spins; a tap on a coasting cube brakes. |
| **14** | The timed dock transition, the yaw snap fold, the content fades, reduced motion | The cube animates continuously from centre to dock, and back. |

**None of these tasks has a unit test.** `src/main.js` is not unit-tested in this project by
design — the logic it wires lives in the pure modules Tasks 1–10 already tested. Each pass ends
with a scripted manual verification instead, and the checks are specific enough to fail
concretely.

---

### Task 12: `src/main.js` — hash routing, content, and the state machine

**Files:**
- Modify: `src/main.js` (throughout)

**Interfaces:**
- Consumes: `initialState` / `reduce` (Task 6), `parseHash` / `hashForRoute` / `titleForRoute`
  (Task 1), `renderPage` (Task 2), `contentFade` (Task 5), `view.dockY` / `view.dockScale` /
  `view.dockSilhouettePx` / `view.setArmedFace` (Tasks 4, 8), `drag.brake` (Task 10),
  `DOCK` (Task 4).
- Produces: `dispatch(event)`, `mountContent(route)`, `applyDom()`, `onNavChange(previous, next)`,
  and the `nav` / `elapsed` / `lastYaw` / `yawOffset` module state Tasks 13 and 14 build on.

**What is deliberately left instant.** The `shrinking` and `expanding` phases dispatch
`transitionDone` on the frame they begin, so navigation works end to end with no animation yet.
Task 14 replaces that one branch. It is working code with defined behaviour, not a stub.

- [ ] **Step 1: Replace the imports and the module setup at `src/main.js:1-53`**

```js
import * as THREE from 'three';
import './style.css';
import {
  DOCK,
  DRAG,
  ENTRANCE,
  ENTRANCE_TUMBLE_RATIO,
  FLOAT,
  MAX_FRAME_DELTA,
  MAX_PIXEL_RATIO,
  SETTLE,
} from './config.js';
import { entranceRotation, entranceState, floatOffset } from './animation.js';
import { createDragSpin } from './drag.js';
import { createScene } from './scene.js';
import { contentFade } from './dock.js';
import { initialState, reduce } from './navstate.js';
import { hashForRoute, parseHash, titleForRoute } from './routes.js';
import { renderPage } from './pages.js';

// A blank off-white page is the intended degradation when WebGL is unavailable
// (blocklisted driver, exhausted contexts, hardened browser). Reaching it via an
// uncaught throw is not intended, so fail quietly instead. three registers its
// own context-lost/restored handlers.
const root = document.documentElement;
const canvas = document.getElementById('scene');
const page = document.getElementById('page');
const scrim = document.getElementById('scrim');
const dockButton = document.getElementById('dock');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (error) {
  console.error('[landing-cube] WebGL unavailable, leaving the page blank:', error);
}

// `view` is kept whole rather than destructured: startY, dockY, dockScale, and
// dockSilhouettePx are getters that resize() updates.
const view = createScene(window.innerWidth, window.innerHeight);
const timer = new THREE.Timer();
const drag = createDragSpin(DRAG);

// Assembled once: entranceRotation needs the entrance timing and the target pose
// together, and neither changes at runtime.
const ROTATION = {
  duration: ENTRANCE.duration,
  startSpin: ENTRANCE.startSpin,
  endSpin: ENTRANCE.endSpin,
  settleYaw: SETTLE.yaw,
  settlePitch: SETTLE.pitch,
  tumbleRatio: ENTRANCE_TUMBLE_RATIO,
};

// FLOAT carries the bob's shape and its ramp; the phase is anchored to the end of
// the entrance, so floatOffset needs the entrance duration alongside it.
const FLOAT_OPTS = { ...FLOAT, duration: ENTRANCE.duration };

// An unknown hash is corrected before the machine ever sees one, and with
// replaceState rather than a push so the back button cannot bounce between the
// bad hash and its correction. replaceState fires no hashchange, so nothing
// downstream needs to know this happened.
const boot = parseHash(window.location.hash);
if (!boot.known) window.history.replaceState(null, '', hashForRoute(boot.route));

// A deep link, a refresh, or a shared URL lands docked with content already
// mounted and plays no entrance. `elapsed` is pushed past the float's ramp so the
// bob is at its steady state rather than starting from zero under a page that is
// already up.
let elapsed = boot.route === null ? 0 : ENTRANCE.duration + FLOAT.rampDuration;
let nav = initialState(boot.route, elapsed);

let activePointerId = null;
// The cube's total yaw as drawn on the last frame. Read when a dock transition
// starts, so it interpolates from where the viewer actually left the cube.
let lastYaw = SETTLE.yaw;
// Yaw folded in by dock transitions (the snap to the nearest resting pose). Kept
// here rather than inside src/drag.js so the drag model stays a pure accumulator
// with no notion of the nav.
let yawOffset = 0;
// Which content fade the transition in flight needs. See src/dock.js contentFade.
let fadeMode = 'hold';
```

- [ ] **Step 2: Replace `applyViewportSize` and add the DOM helpers**

Replace `applyViewportSize` (`:55-66`) and add four functions after it:

```js
function applyViewportSize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  // updateStyle is deliberately left ON: three then writes inline px matching the
  // drawing buffer, so the CSS box, the buffer, and the camera aspect agree by
  // construction. Passing `false` here would leave style.css authoritative, and
  // on iOS/Android 100vh is the large (toolbars-hidden) viewport while
  // innerHeight is the visible one — which stretches the cube.
  renderer.setSize(width, height);
  view.resize(width, height);
  applyDockButtonBox();
}

// The drawn silhouette can be under the 44 px tap-target floor on a phone (62 px
// at 390 px wide, and smaller on anything narrower), so the button is sized to
// the larger of the two and re-centred over where the cube is actually drawn.
function applyDockButtonBox() {
  const silhouette = view.dockSilhouettePx;
  const size = Math.max(44, silhouette);
  dockButton.style.width = `${size}px`;
  dockButton.style.height = `${size}px`;
  dockButton.style.bottom = `${Math.max(0, DOCK.bottomMarginPx - (size - silhouette) / 2)}px`;
}

function mountContent(route) {
  // Every page is project-authored (src/pages.js), so innerHTML is not a
  // sanitisation question here. It becomes one the moment any of this content
  // comes from outside this repo.
  page.innerHTML = renderPage(route);
  document.title = route === null ? 'Portfolio' : `${titleForRoute(route)} — Portfolio`;
  if (route === null) return;

  // Scroll resets to top on every route change; back/forward restore it, since
  // history.scrollRestoration is left at its default.
  window.scrollTo(0, 0);
  // Standard SPA practice, and cheap: without moving focus a screen-reader user
  // gets no indication that anything happened.
  const heading = page.querySelector('h1');
  if (heading !== null) heading.focus({ preventScroll: true });
}

function applyDom() {
  // `overlay` is derived, not stored — it is exactly this. See src/navstate.js.
  const overlay = nav.route !== null && nav.phase === 'resting';
  root.dataset.phase = nav.phase;
  // Only `resting` gets canvas pointer events (style.css), so the full-viewport
  // canvas cannot swallow clicks on the article text underneath.
  root.dataset.scroll =
    nav.phase === 'entering' || nav.phase === 'resting' ? 'locked' : 'free';
  scrim.hidden = !overlay;
  // Removed from the DOM flow entirely when not docked, so it is never a focus
  // stop while the big cube is up.
  dockButton.hidden = nav.phase !== 'docked';
  if (nav.phase !== 'shrinking' && nav.phase !== 'expanding') page.style.opacity = '1';
}
```

- [ ] **Step 3: Add `dispatch` and `onNavChange`**

```js
function dispatch(event) {
  const previous = nav;
  nav = reduce(nav, { ...event, at: elapsed });

  if (nav.navigate !== null) {
    const target = nav.navigate;
    nav = { ...nav, navigate: null };
    // hashchange is the single source of truth for `route`: set the hash and let
    // the event it fires drive the machine. That is what makes the back button
    // work without a parallel code path.
    window.location.hash = hashForRoute(target);
    return;
  }

  if (nav === previous) return;
  onNavChange(previous, nav);
}

function onNavChange(previous, next) {
  const startedTransition =
    (next.phase === 'shrinking' || next.phase === 'expanding') && previous.phase !== next.phase;
  const endedTransition =
    (previous.phase === 'shrinking' || previous.phase === 'expanding') &&
    previous.phase !== next.phase;

  if (startedTransition) {
    // Esc, the dock button, and the back button all start a transition with no
    // pointer press, so none of them went through drag.start(). Stop any coast
    // now, or the drag yaw keeps advancing while the transition's own yaw
    // snapshot stays fixed, and the docked pose jumps at the end.
    drag.brake();
    fadeMode = contentFade(previous.route, next.route);
    // 'in' mounts now and fades up. 'cross' holds the outgoing page until the
    // midpoint, where the opacity is exactly 0. 'out' holds it and unmounts when
    // the transition lands. 'hold' never touches the DOM.
    if (fadeMode === 'in') mountContent(next.route);
  }

  if (endedTransition) {
    if (fadeMode === 'cross' || fadeMode === 'out') mountContent(next.route);
    if (previous.phase === 'shrinking') view.setArmedFace(null);
    fadeMode = 'hold';
  }

  // No transition plays for these, so the swap is immediate:
  // - docked -> docked: a history jump between two content routes. The cube is
  //   already docked and stays put; animating it would be a 1.8 s round trip for
  //   a back-button press.
  // - resting -> resting: back to the landing page while the big cube is already
  //   at centre. There is no motion to play, only content to unmount.
  if (previous.phase === next.phase && next.route !== previous.route) {
    mountContent(next.route);
  }

  applyDom();
}
```

- [ ] **Step 4: Replace `frame()`**

```js
function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), MAX_FRAME_DELTA);
  elapsed += dt;

  const entrance = entranceState(elapsed, { ...ENTRANCE, startY: view.startY });
  // Closed form, not an accumulator: the cube lands on the exact same pose at any
  // frame rate, and both angles freeze dead when the entrance ends.
  const rotation = entranceRotation(elapsed, ROTATION);
  // Once per frame, whatever the pointermove event rate was. The viewport minimum
  // is the dimension the camera fits the cube to, so the gain stays proportional
  // to the cube's apparent size.
  const dragYaw = drag.update(dt, Math.min(window.innerWidth, window.innerHeight));

  if (nav.phase === 'entering' && entrance.done) dispatch({ type: 'entranceDone' });

  let y = entrance.y;
  let scale = entrance.scale;
  const yaw = rotation.yaw + dragYaw + yawOffset;

  if (nav.phase === 'docked') {
    y = view.dockY;
    scale = view.dockScale;
  } else if (nav.phase === 'shrinking' || nav.phase === 'expanding') {
    // TASK 14 REPLACES THIS BRANCH with the timed transition. Until then the
    // transition is instantaneous, which makes routing exercisable end to end.
    y = nav.phase === 'shrinking' ? view.dockY : 0;
    scale = nav.phase === 'shrinking' ? view.dockScale : 1;
    dispatch({ type: 'transitionDone' });
  }

  lastYaw = yaw;
  view.cube.position.set(0, y + floatOffset(elapsed, FLOAT_OPTS), 0);
  view.cube.scale.setScalar(scale);
  // rotation.pitch, not SETTLE.pitch: the entrance's vertical tumble runs through
  // it and only lands on SETTLE.pitch at t = duration.
  view.cube.rotation.set(rotation.pitch, yaw, 0);

  renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}
```

- [ ] **Step 5: Rewire the listeners and the boot block**

Replace the `if (renderer) { ... }` block at `:108-139` in full. The pointer gate changes from
the old `entranceDone` boolean to `nav.phase !== 'resting'`, which is stricter: it also blocks
presses during a dock transition.

```js
if (renderer) {
  applyViewportSize();
  window.addEventListener('resize', applyViewportSize);

  mountContent(nav.route);
  applyDom();

  canvas.addEventListener('pointerdown', (event) => {
    // Primary pointer, left button only: a right- or middle-button drag should
    // not spin the cube, and a right-drag should still open the context menu.
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    // Only `resting` accepts a press. During the entrance a press would make the
    // yaw at t = duration SETTLE.yaw + userYaw and break the exact landing pose;
    // during a transition it would fight the interpolation. Also ignores a second
    // finger while a drag is already running.
    if (nav.phase !== 'resting' || activePointerId !== null) return;

    activePointerId = event.pointerId;
    // Capture is what keeps the drag alive once the pointer leaves the window —
    // browser chrome, a second monitor, another app.
    canvas.setPointerCapture(event.pointerId);
    drag.start(event.clientX);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointerId) return;
    drag.move(event.clientX);
  });

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  // Capture survives a lot, but not the tab losing focus mid-drag.
  window.addEventListener('blur', () => endDrag());

  // Required for the pointer case too: with the big cube over content there must
  // be a way out that is not "guess that clicking the background works".
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') dispatch({ type: 'escape' });
  });

  dockButton.addEventListener('click', () => dispatch({ type: 'dockClick' }));

  window.addEventListener('hashchange', () => {
    const parsed = parseHash(window.location.hash);
    if (!parsed.known) {
      // Replace, not push: the back button must not bounce between a bad hash and
      // its correction. replaceState fires no hashchange, so the machine is driven
      // directly below.
      window.history.replaceState(null, '', hashForRoute(parsed.route));
    }
    dispatch({ type: 'hashChange', route: parsed.route });
  });

  requestAnimationFrame(frame);
}
```

`endDrag` (`:70-81`) is unchanged in this task.

- [ ] **Step 6: Verify routing end to end**

Run: `npm test` — expected PASS, whole suite (no test in this task, but nothing may regress).

Run: `npm run dev`, then check each:

- [ ] Load `/`. The cube plays its entrance, floats, and **drags to spin again** (`data-phase`
      is now written, so the canvas takes pointer events in `resting`).
- [ ] Tab to the "Work" link and press Enter. The URL becomes `#/work`, the cube jumps to the
      bottom centre at ~64 px, and the Work page appears with an `<h1>Work</h1>` and a visible
      `#/work`.
- [ ] The page scrolls, and the docked cube stays put while it does.
- [ ] Tab reaches the dock button and it shows a focus ring. Press Enter: the big cube comes
      back to centre over the Work page, behind a scrim.
- [ ] Press Esc. The cube returns to the dock and the Work page is interactive again.
- [ ] Navigate `#/work` → `#/about` → `#/writing` via the hidden links, then press Back three
      times. Each step lands on the right page, and the cube stays docked between the two
      content routes.
- [ ] Open the nav (dock button) and dismiss it with Esc **five times**, then press Back once.
      It goes to the previous *route*, not through five no-op entries.
- [ ] Load `#/play` directly and hard-reload. It lands docked with the Playground page up, and
      **no entrance plays**.
- [ ] Load `#/nonsense`. It lands on the landing page with the URL corrected to `#/`, the
      entrance plays, and pressing Back does not bounce back to `#/nonsense`.
- [ ] `document.title` changes per route.
- [ ] Resize the window while docked: the cube and the dock button stay bottom-centre and stay
      the same physical size.
- [ ] `npm run build` exits 0, and `npm run preview` serves `#/work` correctly on a deep link.

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "feat: route the page by hash and mount content per route"
```

---

### Task 13: `src/main.js` — picking, and the armed-face feedback

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `createTapTracker` / `pointerToNdc` (Task 7), `faceIndexFromNormal` /
  `routeForFaceIndex` (Task 1), `PICK` (Task 4), `view.setArmedFace` (Task 8), `drag.start`'s
  return value (Task 10).
- Produces: `pickFaceIndex(clientX, clientY)` and `handleTap(clientX, clientY)`. Task 14 does
  not touch either.

**Hover runs once per animation frame**, reusing the same "record on move, fold on frame" split
`src/drag.js:8-11` uses — several `pointermove` events can fire per frame, and a raycast per
event would make the cost depend on the browser's coalescing rate.

- [ ] **Step 1: Extend the imports**

```js
import { createTapTracker, pointerToNdc } from './pick.js';
import {
  faceIndexFromNormal,
  hashForRoute,
  parseHash,
  routeForFaceIndex,
  titleForRoute,
} from './routes.js';
```

and add `PICK` to the `./config.js` import list.

- [ ] **Step 2: Add the module state and the pick helpers**

Beside the existing `drag` declaration:

```js
const tap = createTapTracker(PICK);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
```

Beside `let activePointerId = null;`:

```js
// The most recent hover position, folded once per frame. Mouse only — touch has
// no hover, and a raycast per pointermove would make the cost depend on the
// browser's event coalescing rate.
let hoverAt = null;
```

After `applyDom()`:

```js
function pickFaceIndex(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const ndc = pointerToNdc(clientX, clientY, rect);
  pointerNdc.set(ndc.x, ndc.y);
  raycaster.setFromCamera(pointerNdc, view.camera);
  // The pick runs outside the render loop, so the world matrix would otherwise be
  // one frame stale.
  view.cube.updateMatrixWorld();

  const hits = raycaster.intersectObject(view.cube, false);
  if (hits.length === 0) return null;
  // The NORMAL, not face.materialIndex: see src/routes.js and
  // tests/facepick.test.js. The normal is correct with or without a material
  // array.
  return faceIndexFromNormal(hits[0].face.normal);
}

function handleTap(clientX, clientY) {
  const faceIndex = pickFaceIndex(clientX, clientY);
  const route = faceIndex === null ? undefined : routeForFaceIndex(faceIndex);
  // A raycast miss is meaningful, not a no-op: it dismisses the open nav. So is a
  // tap on a face with no route — only the unreachable bottom face, handled by
  // the same path rather than special-cased.
  dispatch(route === undefined ? { type: 'missTap' } : { type: 'faceTap', route });
}
```

- [ ] **Step 3: Fold the hover in `frame()`**

Insert immediately after the `entranceDone` dispatch:

```js
  if (hoverAt !== null) {
    // Only while the big cube is up and no drag is running: during a drag the
    // pressed face owns the highlight.
    if (nav.phase === 'resting' && activePointerId === null) {
      view.setArmedFace(pickFaceIndex(hoverAt.x, hoverAt.y));
    }
    hoverAt = null;
  }
```

- [ ] **Step 4: Wire the pointer handlers**

In `pointerdown`, replace `drag.start(event.clientX);` with:

```js
    // start() returns the coast speed it just cancelled, in rev/s. A press on a
    // coasting cube brakes it, and that brake must not also navigate: the first
    // tap stops the cube, the second one navigates.
    const brakedRevs = drag.start(event.clientX);
    tap.start(event.clientX, event.clientY, event.timeStamp, brakedRevs);
    // Press feedback is the only pre-commit signal touch has — there is no hover
    // — and it is required, not polish: at the resting pose the boundary between
    // two routes runs exactly down the middle of the cube.
    view.setArmedFace(pickFaceIndex(event.clientX, event.clientY));
```

Replace the whole `pointermove` handler:

```js
  canvas.addEventListener('pointermove', (event) => {
    if (activePointerId === null) {
      // Hover: recorded here, folded once per frame. Touch has no hover, and a
      // touch pointermove with no capture is not a gesture we care about.
      if (event.pointerType === 'mouse' && nav.phase === 'resting') {
        hoverAt = { x: event.clientX, y: event.clientY };
      }
      return;
    }
    if (event.pointerId !== activePointerId) return;

    drag.move(event.clientX);
    tap.move(event.clientX, event.clientY);
    // Past the travel or duration threshold the gesture is a drag, so the pressed
    // face stops being a candidate and the highlight goes immediately rather than
    // waiting for the release.
    if (!tap.candidate(event.timeStamp)) view.setArmedFace(null);
  });
```

Add a `pointerleave` handler beside the others:

```js
  canvas.addEventListener('pointerleave', () => {
    hoverAt = null;
    if (activePointerId === null) view.setArmedFace(null);
  });
```

- [ ] **Step 5: Replace `endDrag`**

```js
// Idempotent: pointerup and the lostpointercapture that follows it both land
// here, and blur calls it with no event at all.
function endDrag(event) {
  if (activePointerId === null) {
    tap.cancel();
    return;
  }
  if (event && event.pointerId !== undefined && event.pointerId !== activePointerId) return;

  const pointerId = activePointerId;
  activePointerId = null;
  // The UA fires lostpointercapture after pointerup, so capture is still held
  // here and this release runs on every drag via pointerup (or blur); by the time
  // lostpointercapture re-enters, it is a documented no-op.
  if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);

  // ONLY a pointerup can be a tap. pointercancel, lostpointercapture, and blur
  // all discard the gesture. tap.end() consumes it, so the lostpointercapture
  // that follows a pointerup cannot produce a second tap.
  const wasTap = Boolean(event) && event.type === 'pointerup' && tap.end(event.timeStamp);
  if (!wasTap) tap.cancel();

  drag.end();
  view.setArmedFace(null);
  if (wasTap) handleTap(event.clientX, event.clientY);
}
```

- [ ] **Step 6: Verify picking**

Run: `npm test` — expected PASS, whole suite.

Run: `npm run dev`, then check each:

- [ ] Move the mouse across the cube at rest. The face under the pointer lightens, and the
      highlight switches at the vertical edge down the middle. **This is the check that the
      centre coin-flip is now visible before the click.**
- [ ] Move off the cube. The highlight clears.
- [ ] Click the left half of the cube → `#/writing`. Click the right half → `#/about`.
- [ ] Click the top face band → `#/work`.
- [ ] Drag right about a quarter turn, release, wait for the coast to stop, then click the face
      now facing you → `#/play` or `#/contact`. **All five routes are reachable.**
- [ ] Drag 100 px and release. The cube spins and **does not navigate**.
- [ ] Drag 5 px and release quickly. It navigates (that is a tap with slop).
- [ ] Press and hold on a face for a full second without moving, then release. **Nothing
      happens** — a long press is not a navigation.
- [ ] Fling the cube hard, then tap it once while it is still coasting: it **stops** and does
      not navigate. Tap again: it navigates.
- [ ] Click the off-white background beside the cube with the nav open over a page: it
      re-docks, and pushes no history entry.
- [ ] Right-click and middle-click the cube: no navigation; the context menu still opens.
- [ ] On a touch device (or device emulation): tap navigates, drag spins, and there is no
      pull-to-refresh.

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "feat: navigate by tapping a cube face, with pre-commit feedback"
```

---

### Task 14: `src/main.js` — the timed dock transition

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `dockState` / `fadeOpacity` / `yawSnapDelta` (Task 5), `clamp01` from `src/math.js`,
  `DOCK` (Task 4).
- Produces: the finished page. Nothing consumes this task.

**Three things this pass gets right that the instant version did not.**

1. **The yaw snapshot and the offset fold.** The transition interpolates from `transitionYaw`,
   captured once when the phase starts. When `shrinking` lands, the snap delta is folded into
   `yawOffset` *once*, so `rotation.yaw + dragYaw + yawOffset` keeps agreeing with the drawn
   pose for every later drag and every later transition — and `expanding` then starts from an
   already-snapped yaw, so its snap delta is 0 and the cube holds its pose all the way back to
   centre.
2. **The float is multiplied by the cube's scale at the call site**, rather than teaching
   `floatOffset` about scale. The docked cube keeps a proportionally smaller bob (0.0186 u ≈
   4.5 px peak-to-peak at 1080p — subtle, alive, clearly a live object rather than an icon);
   the amplitude shrinks *smoothly* through `shrinking`, so no extra handover is needed; and the
   landing page is unchanged, since scale is 1 there. The only effect on Part A is during the
   entrance overlap, where scale is ≥ 0.993 — under half a percent.
3. **A `hashchange` that arrives mid-transition is ignored by the machine**, so the state could
   disagree with the URL. Reconcile against `location.hash` once the transition lands.

- [ ] **Step 1: Extend the imports**

```js
import { contentFade, dockState, fadeOpacity, yawSnapDelta } from './dock.js';
import { clamp01 } from './math.js';
```

- [ ] **Step 2: Add the transition state and the duration helper**

Beside `let fadeMode = 'hold';`:

```js
// The cube's total yaw when the transition in flight began. A snapshot, not a
// live read: a coasting drag must not move the target mid-flight.
let transitionYaw = SETTLE.yaw;
// Has the cross-fade's DOM swap happened yet for the transition in flight?
let swapped = false;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function dockDuration() {
  // Motion now gates NAVIGATION rather than decoration: without this clamp a
  // motion-sensitive viewer waits 0.9 s of animation to reach a page, twice per
  // round trip. The entrance's recorded stance (not honored) is left alone.
  return reducedMotion.matches ? DOCK.reducedDuration : DOCK.duration;
}
```

- [ ] **Step 3: Update `onNavChange`**

In the `startedTransition` block, add the snapshot and reset the swap flag — insert before
`drag.brake();`:

```js
    transitionYaw = lastYaw;
    swapped = false;
```

In the `endedTransition` block, replace its body with:

```js
    if (previous.phase === 'shrinking') {
      // Fold the snap in ONCE, so lastYaw keeps agreeing with the drawn pose for
      // every later drag and transition — and so `expanding` starts from an
      // already-snapped yaw, where the delta is 0 and the pose holds.
      yawOffset += yawSnapDelta(transitionYaw, SETTLE.yaw);
      view.setArmedFace(null);
    }
    if ((fadeMode === 'cross' && !swapped) || fadeMode === 'out') mountContent(next.route);
    fadeMode = 'hold';
```

- [ ] **Step 4: Replace the transition branch in `frame()`**

Replace the whole `else if (nav.phase === 'shrinking' || nav.phase === 'expanding')` branch:

```js
  } else if (nav.phase === 'shrinking' || nav.phase === 'expanding') {
    const progress = clamp01((elapsed - nav.phaseStartedAt) / dockDuration());
    // Expanding is the same curve run backwards. easeInOutCubic is symmetric
    // about (0.5, 0.5), so the reverse pass retraces the forward one exactly and
    // the cube never appears to have moved while docked.
    const step = dockState(nav.phase === 'shrinking' ? progress : 1 - progress, {
      dockY: view.dockY,
      dockScale: view.dockScale,
      yaw: transitionYaw,
      settleYaw: SETTLE.yaw,
    });

    y = step.y;
    scale = step.scale;
    yaw = step.yaw;

    page.style.opacity = String(fadeOpacity(fadeMode, progress, DOCK.contentFadeStart));
    // The cross-fade reaches exactly 0 at the midpoint, so the swap is invisible.
    if (fadeMode === 'cross' && !swapped && progress >= 0.5) {
      mountContent(nav.route);
      swapped = true;
    }

    if (progress >= 1) {
      dispatch({ type: 'transitionDone' });
      // A hashchange that arrives mid-transition is ignored by the machine, so
      // reconcile against the URL now that the transition has landed.
      const live = parseHash(window.location.hash).route;
      if (live !== nav.route) dispatch({ type: 'hashChange', route: live });
    }
  }
```

`yaw` must become `let yaw = rotation.yaw + dragYaw + yawOffset;` (it was `const` in Task 12).

- [ ] **Step 5: Scale the float**

Replace the position line in `frame()`:

```js
  // The float is multiplied by the cube's scale here rather than taught to
  // floatOffset: the docked cube then keeps a proportionally smaller bob
  // (~4.5 px peak-to-peak at 1080p — alive, not an icon), the amplitude shrinks
  // smoothly through the transition so there is no second handover, and the
  // landing page is unchanged because the scale is 1 there.
  view.cube.position.set(0, y + floatOffset(elapsed, FLOAT_OPTS) * scale, 0);
```

- [ ] **Step 6: Verify the transition**

Run: `npm test` — expected PASS, whole suite.

Run: `npm run dev`, then check each:

- [ ] Click a face. The cube travels **continuously** from centre to the bottom dock over about
      0.9 s, shrinking as it goes. It never disappears, jumps, reloads, or restarts its
      entrance.
- [ ] It starts moving **slowly** — no lurch out of the standstill.
- [ ] The page fades in over the back half of that move, after the cube has visibly committed.
- [ ] Drag the cube to an arbitrary angle, then click a face. The cube turns **at most 45°** on
      the way down and arrives edge-on. It does not spin.
- [ ] Press the dock button. The cube returns to centre along the same path and arrives at the
      **same pose it left in** — it does not appear to have turned while docked.
- [ ] Dock, reopen, and dock again three times. The pose is identical every time and never
      drifts.
- [ ] Watch the docked cube for ten seconds. It bobs gently — a few pixels — and does not read
      as a static icon.
- [ ] With the nav open over Work, click the About face. The Work text fades out, the swap
      happens invisibly at the midpoint, and About fades in as the cube docks.
- [ ] Press Back from a page to the landing page. The cube expands to centre while the content
      fades out.
- [ ] Fling the cube hard, then press Esc while it is still coasting. The cube docks cleanly and
      the docked pose does **not** jump at the end. *(This is `drag.brake()`; without it the
      pose snaps.)*
- [ ] Enable "reduce motion" at the OS level and reload. Route changes take about 0.12 s instead
      of 0.9 s. The entrance is unchanged.
- [ ] `npm run build` exits 0; `npm run preview` serves a deep link and a full click path.

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "feat: animate the cube continuously between centre and its dock"
```

---

### Task 15: Split `src/main.js` if it has outgrown one file

**Files:**
- Create, conditionally: `src/input.js`
- Modify, conditionally: `src/main.js`

**Interfaces:**
- If the split happens: `createInput({ canvas, dockButton, view, drag, tap, dispatch,
  pickFaceIndex, getPhase, onHover }) -> { attach(), detach() }`, and `src/main.js` keeps the
  loop plus composition.

**This task may correctly end in "no change".** Spec §19: *"`main.js` is already the largest
file at 139 lines and will roughly double. If it passes ~250 lines, split the DOM event wiring
into `src/input.js` and keep `main.js` as the loop plus composition — but do not pre-split; the
seam is not obvious until the code exists."* The seam is now named and the code exists, so this
is a measurement, not a judgement call.

- [ ] **Step 1: Measure**

Run: `wc -l src/main.js`

- **250 lines or fewer:** stop. Record the count, skip to Step 4, and commit nothing. A split
  below the threshold is churn.
- **More than 250 lines:** continue.

- [ ] **Step 2: Move the DOM event wiring, and nothing else**

Move into `src/input.js`: the `pointerdown`, `pointermove`, `pointerup`, `pointercancel`,
`lostpointercapture`, `pointerleave`, `keydown`, `blur`, `hashchange`, and dock-button `click`
listeners, plus `endDrag`, plus the `activePointerId` and `hoverAt` state those own.

**Keep in `src/main.js`:** the renderer, `view`, `timer`, `drag`, `tap`, the raycaster,
`frame()`, `dispatch`, `onNavChange`, `mountContent`, `applyDom`, `applyViewportSize`,
`applyDockButtonBox`, `pickFaceIndex`, `handleTap`, `dockDuration`, and all the `nav` / `elapsed`
/ `yawOffset` / `transitionYaw` / `fadeMode` / `swapped` / `lastYaw` state.

**`src/input.js` may touch the DOM** — it is event wiring, so that is its job. It must not
import `three`, must not read `nav` directly (it asks through `getPhase()`), and must not
render. The rule the project actually cares about is that the *pure* modules stay pure; this
split moves browser coupling from one browser-coupled file to a second one, and `README.md`'s
"only browser-coupled file" claim becomes "the only two browser-coupled files" in Task 16.

- [ ] **Step 3: Verify nothing changed behaviourally**

Run: `npm test` — expected PASS, whole suite.

Run: `npm run dev` and re-walk **every** check in Task 13 Step 6 and Task 14 Step 6. A split
that changes behaviour is a failed split; revert rather than debug it.

Run: `wc -l src/main.js src/input.js` and record both counts.

- [ ] **Step 4: Commit (only if the split happened)**

```bash
git add src/main.js src/input.js
git commit -m "refactor: move the DOM event wiring out of main.js"
```

---

### Task 16: Bring `AGENTS.md` and `README.md` back in line

**Files:**
- Modify: `AGENTS.md` (Current Scope, Landing Page, Out of Scope, Decisions)
- Modify: `README.md` (intro, Layout, the browser-coupling claim, Design direction)

**Interfaces:**
- Consumes: everything shipped in Tasks 1–15. Nothing consumes this task.

**`AGENTS.md` is the spec of record, and Part B contradicts it in four places:** *"Current
Scope: One landing page. Nothing else yet."*; the Out-of-Scope entries *"More pages, routes,
nav"* and *"Project/case-study content, about section, contact form"*; and the `Page:`
decision's *"no DOM text"*. Leave any of them and the next reader treats the whole of Part B as
out of scope.

- [ ] **Step 1: Rewrite `AGENTS.md`'s Current Scope**

Replace the `## Current Scope` section's body:

```markdown
One landing page plus five content routes, all served from one document by hash routing. The
content is differentiated lorem ipsum, not real writing.
```

- [ ] **Step 2: Update the Landing Page requirements in `AGENTS.md`**

Append two requirements after requirement 5:

```markdown
6. Tap a cube face to go to that face's section. Cube shrink and travel to bottom middle of
   screen in one continuous move while page arrive. Five face have route; bottom face never
   reachable, so it get none.
7. Docked cube is nav button. Press it, big cube come back up over current page behind scrim.
   Pick face to go somewhere else, or Esc or tap background to close. Closing is not
   navigation and leave no history entry.
```

- [ ] **Step 3: Narrow the Out of Scope list in `AGENTS.md`**

Replace the two contradicted entries. The section becomes:

```markdown
## Out of Scope (for now)

- Real content. The five sections ship as differentiated lorem ipsum.
- A sixth section, or any route on the cube's bottom face — it cannot be reached.
- Any 3D object other than the cube. No per-page 3D, no face textures or labels.
- Visible nav text, breadcrumbs, or a menu. The hidden `<nav>` is an accessibility
  affordance, not a design element.
- Page transitions beyond the cube move and a content fade — no slides, no shared-element
  animation between the cube and the page.
- Deployment. Scope ends at a working dev server and a static production build.
```

- [ ] **Step 4: Update the contradicted Decisions in `AGENTS.md`**

Replace the `Cube look` bullet:

```markdown
- **Cube look:** matte light-gray flat-shaded faces (`#d6d8dc`) — one `Mesh`, one
  `BoxGeometry`, no edge outline, no wrapping `Group`, no `polygonOffset`. The mesh carries a
  **six-material array**, one per `BoxGeometry` group, so a single face can be lightened to
  `#e4e6ea` when it is the armed nav target. Still one mesh and one draw call per group; flat
  shading still carries the whole form. The array is required rather than cosmetic — see *the
  resting pose puts a route boundary at screen centre* below.
```

Replace the `Page` bullet:

```markdown
- **Page:** off-white background (`#f7f7f8`). No *visible* DOM text on the landing page —
  the canvas is the whole landing page. The document does carry a `<nav>` of five links,
  visually hidden with `clip-path` but focusable and placed first so it doubles as skip
  navigation: a raycast has no keyboard equivalent, so without it keyboard users would have
  no navigation at all. Content routes are ordinary scrolling DOM under a fixed canvas.
```

Replace the `Reduced motion` bullet:

```markdown
- **Reduced motion:** `prefers-reduced-motion` is honored **for the dock transitions only**,
  clamped to `DOCK.reducedDuration` 0.12 s. Motion there gates *navigation* rather than
  decoration — unclamped, a motion-sensitive viewer waits 0.9 s of animation to reach a page,
  twice per round trip. The entrance's 3.5 s is still intentionally not honored.
```

- [ ] **Step 5: Add the five new Decisions to `AGENTS.md`**

Append to the `## Decisions` section:

```markdown
- **Routing:** hash-based (`#/work`), not the History API. Deployment is not set up, and the
  History API would make correct production behavior depend on a host rewrite rule that does
  not exist — a deep link to `/work` on a static host 404s. Hash routing works identically on
  the Vite dev server, `npm run preview`, and any static host, with zero configuration. Every
  route string lives in `src/routes.js`, so switching later is a one-file change.
- **The site is a single-page app, and the canvas is a persistent fixed layer.** A real
  document navigation destroys and recreates the WebGL context, so the cube would restart its
  entrance on every route change instead of animating into the dock. The canvas stays
  full-viewport in every phase — that is what lets the cube travel from centre to the bottom
  edge in one continuous motion — so its `pointer-events` are off except while the big cube is
  up, and the docked cube's control is a separate `<button>` rather than a hit test through the
  canvas.
- **The bottom face is unreachable, so it gets no route.** The resting pitch is a fixed +15°
  and three's Euler order is `XYZ`, so yaw is applied before pitch and leaves the ±Y normals
  invariant: sweeping all 360° of yaw, −Y is back-facing at every one of them, and +Y is
  front-facing at every one. There are **five** pickable faces, not six, and the top face —
  always visible, yaw-invariant — holds the primary section. `tests/facepick.test.js` proves
  both halves.
- **`face.materialIndex` requires a material array.** `Mesh.raycast` only walks
  `geometry.groups` when `material` is an array, so with a single material
  `intersection.face.materialIndex` is `0` for **every** hit — a face map keyed on it would
  silently route every face to the same page, which looks like working code. `src/routes.js`
  keys on `intersection.face.normal`, which is exactly one of the six axis unit vectors either
  way.
- **The resting pose puts a route boundary at screen centre**, which is why hover and press
  feedback are a requirement and not polish. At 1920×1080, yaw 45°, pitch 15°, a ray at screen
  centre hits the −X face and one pixel to the right hits +Z. The cube's visual centre is the
  most natural place to click, and clicking it is a coin flip between two sections. It cannot
  be fixed by geometry — the edge *is* the resting pose — so the armed face is lightened before
  the viewer commits.
- **The dock is a CSS-pixel size, not a scale factor.** Camera distance varies with aspect
  ratio, so a fixed `scale` draws a different physical size on every device: `ENTRANCE.startScale`
  would draw an 83 px nav button on a desktop and 30 px on a phone. `src/scene.js` derives
  `dockScale` from `DOCK.silhouettePx` 64 (capped at 16% of the smaller viewport dimension,
  which binds below ~400 px) and `dockY` from `DOCK.bottomMarginPx` 24, both re-derived on
  resize. The dock transition runs on `easeInOutCubic` over `DOCK.duration` 0.9 s, and the yaw
  **snaps** by the shortest signed angle to the nearest `SETTLE.yaw + k·90°` — at most 45° —
  rather than spinning, so the docked cube reads as a cube and reopening is an exact mirror.
- **Tap versus drag:** a face click is a *failed* drag, defined negatively on the existing
  pointer plumbing — no `click` listener, since `click` fires after a drag too and its target is
  the canvas. A gesture is a tap iff it stays within `PICK.tapMaxTravelPx` 8 px of the press
  point (straight-line, not path length) for at most `PICK.tapMaxDurationMs` 500 ms, and the
  press cancelled less than `PICK.tapMaxEntrySpeedRevs` 0.05 rev/s of coast — so the first tap
  on a coasting cube stops it and the second navigates.
- **`hashchange` is the single source of truth for the route.** Face taps navigate by setting
  `location.hash`; the resulting `hashchange` drives the state machine. The back button then
  works with no parallel code path. An unknown hash is corrected with `replaceState` so the
  back button cannot bounce, and dismissing the open nav pushes nothing — it is not a
  navigation.
- **A deep link plays no entrance.** A direct load of a content hash starts docked with the
  content already mounted: 3.5 s of theatre in front of requested content is wrong, and there
  is no prior on-screen position to dock from. `#/` and an empty hash still play the entrance.
```

- [ ] **Step 6: Update `README.md`**

Replace the intro paragraph:

```markdown
Minimal, geometric portfolio. A single cube enters from off-screen top, grows and slows into
the center over 3.5 seconds, then holds its pose while a gentle vertical drift ramps in out of
the arrival. Drag it horizontally to spin it; let go mid-swipe and it coasts to a stop.

The cube is also the navigation. Tap a face and it travels to a bottom-centre dock in one
continuous move while that section's page arrives; press the docked cube and it comes back up
over the page as a nav overlay. Five sections, one per pickable face — the bottom face cannot
be seen at the resting tilt, so it has none. Routing is hash-based, so every deep link works
on a static host with no configuration.
```

Replace the `## Layout` list's tail with the full set:

```markdown
- `src/config.js` — every tunable number (timing, sizes, colors, the idle float, the drag
  model, the resting pose, the dock, the tap thresholds). Start here.
- `src/math.js`, `src/easing.js` — numeric helpers.
- `src/animation.js` — the entrance as pure functions of elapsed time: position and scale,
  plus the closed-form yaw and pitch that land the cube on its resting pose, plus the idle
  vertical float and its ramp.
- `src/camera.js` — framing math: camera distance per aspect ratio, entrance start height,
  world-units-to-pixels.
- `src/cube.js` — the cube: one flat-shaded gray mesh with six materials, and the armed-face
  control.
- `src/scene.js` — scene, camera, lights, viewport fitting, and the derived dock framing.
- `src/drag.js` — drag-to-spin: viewport-relative gain, smoothed release velocity, coast.
- `src/routes.js` — the route table, the cube-face map, and hash parsing. The only place a
  hash string appears.
- `src/pages.js` — the five sections' content as data, plus a pure HTML string builder.
- `src/navstate.js` — the nav phase machine as `reduce(state, event) -> state`.
- `src/pick.js` — tap-vs-drag discrimination and pointer-to-NDC conversion.
- `src/dock.js` — the dock transition, the yaw snap, and the content fade curves, all as pure
  functions of progress.
- `src/main.js` — renderer, DOM events, the animation loop, composition.
```

Replace the paragraph after the Layout list:

```markdown
Everything except `src/main.js` is unit-tested in plain Node (no browser, no WebGL, no jsdom);
the renderer is deliberately kept out of `scene.js` to keep it that way, and three's math and
`Raycaster` run headlessly. `src/main.js` is the only browser-coupled file: the five modules
that carry the nav logic — `routes.js`, `pages.js`, `navstate.js`, `pick.js`, `dock.js` — import
neither `three` nor the DOM.
```

**If Task 15 split the file**, that last sentence becomes:

```markdown
`src/main.js` and `src/input.js` are the only browser-coupled files: the five modules that
carry the nav logic — `routes.js`, `pages.js`, `navstate.js`, `pick.js`, `dock.js` — import
neither `three` nor the DOM.
```

- [ ] **Step 7: Update `README.md`'s Design direction paragraph**

Replace the final paragraph's tail so the armed face is recorded:

```markdown
The cube's entrance ends on a fixed pose: a vertical edge facing the viewer, tilted 15 degrees
so the top face shows. From there it holds that pose exactly — nothing rotates on its own. The
only autonomous motion is a gentle vertical bob, which ramps in with a smoothstep envelope and
starts just before the entrance lands, so it emerges from the arrival rather than switching on
after it; every turn of the cube is the viewer's, dragged in by hand.

That resting pose puts the boundary between two sections exactly down the middle of the cube,
so the face under the pointer is lightened to `#e4e6ea` before a click commits. The page is
still fully achromatic — blue remains the nominated accent and nothing uses it. Spending it on
the armed face is the best candidate the project has, and is a deliberate second pass rather
than a default.
```

- [ ] **Step 8: Verify no contradicted statement is left**

Run:

```bash
grep -rn "One landing page. Nothing else yet\|More pages, routes, nav\|no DOM text\|one bare .Mesh\|intentionally not honored\|only browser-coupled file" AGENTS.md README.md
```

Expected: the only surviving hits are the *reworded* forms — `no visible DOM text`,
`still intentionally not honored` (about the entrance), and either `only browser-coupled file`
or `only two browser-coupled files` depending on Task 15. **Any bare `One landing page. Nothing
else yet`, `More pages, routes, nav`, or `one bare Mesh` is a miss.**

Then run:

```bash
grep -rn "AGENTS.md\|README.md" --include=*.js src/ | head
```

Expected: no output. No source file should reference the docs.

- [ ] **Step 9: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: record the cube as navigation and the SPA architecture"
```

---

### Task 17: Final verification against the spec's Part B acceptance criteria

**Files:** none modified. Verification only.

**Interfaces:**
- Consumes: everything from Tasks 1–16.

- [ ] **Step 1: Full suite**

Run: `npm test`

Expected: PASS. **13 test files** — `animation`, `camera`, `cube`, `dock`, `drag`, `easing`,
`facepick`, `math`, `navstate`, `pages`, `pick`, `pose`, `routes`, `scene`. Paste the summary
line into the task notes; do not report Part B complete without it.

- [ ] **Step 2: Production build and deep-link preview**

Run: `npm run build`
Expected: exits 0 and writes `dist/`.

Run: `npm run preview`, then open the printed URL **with `#/work` appended** and hard-reload.
Expected: the Work page, the cube docked, no entrance. Then walk a full click path and use Back
and Forward. This is the check the dev server cannot make: it confirms hash routing needs no
host configuration, which is the whole reason §21.1 chose it.

- [ ] **Step 3: Walk the spec's Part B acceptance list (§23)**

Check each, and note which check produced the answer:

- [ ] Clicking a face routes to that face's page; the docked cube and the content arrive
      together, as one movement. *(Task 14 Step 6.)*
- [ ] Which face is armed is visible before the click, including at dead screen centre where
      two routes meet. *(Task 13 Step 6, and `tests/facepick.test.js`.)*
- [ ] A horizontal drag still spins the cube and never navigates; a tap navigates; a tap on a
      coasting cube brakes it without navigating. *(Task 13 Step 6, `tests/pick.test.js`,
      `tests/drag.test.js`.)*
- [ ] The cube animates continuously from centre to dock — it never disappears, reloads, or
      restarts its entrance. *(Task 14 Step 6.)*
- [ ] The docked cube reopens the big cube, and the big cube can be dismissed without
      navigating. *(Task 12 Step 6, `tests/navstate.test.js`.)*
- [ ] All five routes are reachable: two by clicking at rest, one on the top face, two after
      dragging. The bottom face has no route and cannot be reached. *(Task 13 Step 6,
      `tests/facepick.test.js`, `tests/routes.test.js`.)*
- [ ] Each page is visibly distinct and shows its own hash. *(`tests/pages.test.js`, and by eye.)*
- [ ] Back and forward move through the visited routes correctly, and dismissing the nav leaves
      no history entries. *(Task 12 Step 6 — the five-dismissals-then-Back check.)*
- [ ] A deep link and a refresh on `#/work` land on the docked state with content, and play no
      entrance. *(Step 2 above.)*
- [ ] An unknown hash lands on the landing page without a back-button bounce. *(Task 12 Step 6.)*
- [ ] Keyboard alone can reach every route, and the dock button is focusable with a visible
      focus ring. *(Task 11 Step 3, Task 12 Step 6.)*
- [ ] Content pages scroll; the cube stays put while they do. *(Task 12 Step 6.)*
- [ ] Works on a real touch device: tap to navigate, drag to spin, no pull-to-refresh.
      *(Step 4 below.)*
- [ ] `AGENTS.md` and `README.md` contain no statement contradicted by this work.
      *(Task 16 Step 8's grep.)*
- [ ] `npm test` passes, including every new and amended case. *(Step 1.)*
- [ ] `npm run build` succeeds and `npm run preview` serves a working deep link. *(Step 2.)*

- [ ] **Step 4: The manual checks the suite cannot cover (spec §20)**

These are judgements, not measurements. Record an actual verdict for each — "not checked" is a
valid answer to report, but silence is not.

- [ ] **Dock/undock feel at 0.9 s.** Spec §21.4 calls this the one number most worth trying
      live. Under ~0.6 s the travel across the viewport reads as a jump; over ~1.2 s navigation
      feels gated. Adjust `DOCK.duration` if it is wrong; nothing else depends on the value.
- [ ] **The hover highlight's legibility at the centre edge.** `#e4e6ea` against `#d6d8dc` is a
      deliberately quiet lift. If it is invisible in normal room light, the alternatives are a
      larger neutral step or spending the blue accent (§21.6) — both one constant.
- [ ] **A real touch device.** Tap versus drag with a fat finger, and whether 8 px of slop is
      enough (§21.8 expects one round of tuning). Too tight and taps get eaten as micro-drags;
      too loose and a slow drag navigates.
- [ ] **iOS scroll jank** with a full-viewport fixed canvas over scrolling content (§7b). If
      scrolling stutters, note it — do **not** start shrinking the drawing buffer, which is an
      explicit non-goal and would break the transition.
- [ ] **Back and forward through a full click path** on a real device, not just device emulation.

- [ ] **Step 5: Confirm the non-goals held**

Run: `git diff --stat main`

Expected new files: `src/routes.js`, `src/pages.js`, `src/navstate.js`, `src/pick.js`,
`src/dock.js`, five new test files, and `src/input.js` only if Task 15's measurement called for
it. Expected modified: `src/config.js`, `src/camera.js`, `src/scene.js`, `src/cube.js`,
`src/drag.js`, `src/easing.js`, `src/main.js`, `index.html`, `src/style.css`, five existing test
files, `AGENTS.md`, `README.md`.

**`src/animation.js`, `src/math.js`, `tests/animation.test.js`, `tests/math.test.js`, and
`tests/pose.test.js` must not appear.** If `src/animation.js` changed, the entrance was touched,
which spec §22 forbids.

Then confirm the purity rule mechanically:

```bash
grep -ln "three\|document\|window\|location\|history" src/routes.js src/pages.js src/navstate.js src/pick.js src/dock.js
```

Expected: no output. Any hit means a pure module reached for the browser and the whole headless
test strategy is compromised.

- [ ] **Step 6: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to decide how to integrate.

---

## Self-review notes

Checked against the spec section by section while writing. Recorded here so an executor knows
what was deliberate.

**Covered:** §7a-c (Tasks 11, 12), §8 (Task 1, Task 9), §9a-d (Tasks 7, 10, 13), §10 (Tasks 8,
9, 13), §11 (Task 6), §12a-f (Tasks 3, 4, 5, 14), §13 (Task 2, Task 11's CSS), §14a-e (Tasks 11,
12, 14), §15 (Tasks 6, 12), §16 (Task 11), §17 (Task 4), §18 (Task 16), §19 (Task 15's
measurement), §20 (every new test file), §21 (the decision table), §22 (Task 17 Step 5), §23
(Task 17 Step 3).

**Deliberate deviations**, each with its reasoning in the task that makes it:

1. `overlay` is derived rather than stored (errata 5, Task 6).
2. `fadeOpacity` has four modes rather than the spec's one curve (errata 2, Task 5).
3. `resting` + history-to-landing stays `resting` rather than going through `expanding`
   (errata 4, Task 6).
4. The scrim takes no pointer events (errata 6, Task 11).
5. `createCube()` returns `{ mesh, setArmedFace, getArmedFace }` rather than a `Mesh` with
   methods attached, matching the factory pattern `src/drag.js` and `src/scene.js` already use
   (Task 8).
6. `src/drag.js` gains `brake()`, which the spec does not mention. Without it, Esc, the dock
   button, and the back button can start a transition while the cube is coasting, and the docked
   pose jumps when the yaw snap is folded in (Task 10).
7. Paragraph counts run 2–6 rather than 2–5 (errata 3, Task 2).
8. `routeForFaceIndex` returns `undefined` for an unrouted face, deliberately distinct from
   `LANDING_ROUTE` (`null`), so a tap on an unrouted face cannot navigate home (Task 1).
