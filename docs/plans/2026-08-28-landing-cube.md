# Landing Cube Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a single landing page where one 3D cube swoops in from off-screen top over 3.5 seconds — growing and slowing as it arrives — then floats in the center forever with a gentle spin and a subtle pointer-follow tilt.

**Architecture:** All animation math lives in small pure modules (`math`, `easing`, `animation`, `camera`, `parallax`) that are unit-tested in plain Node with no browser and no WebGL. Three.js object construction lives in `cube.js` and `scene.js`, which are also headless-testable because renderer creation is deliberately kept out of them. `main.js` is the only file that touches the DOM, the `WebGLRenderer`, and `requestAnimationFrame`: each frame it asks `entranceState()` for the cube's position/scale/spin-speed, asks `parallax.update()` for the pointer offset, applies both to the cube group, and renders. Every tunable number lives in `config.js`.

**Tech Stack:** Three.js (WebGL), Vite (dev server + production build), Vitest (unit tests), plain JavaScript ES modules — no TypeScript, no framework, no animation library (no GSAP/Tween.js; the easing is ~6 lines of arithmetic).

**Spec:** `AGENTS.md` (project scope + design direction). The open questions in that spec were resolved by the product owner on 2026-08-28; the answers are recorded verbatim in Global Constraints below, and Task 9 folds them back into `AGENTS.md`.

## Global Constraints

- **Language:** plain JavaScript, ES modules (`"type": "module"`). No TypeScript.
- **Runtime floors:** Node >= 20, `three` >= 0.160.0, `vite` >= 5, `vitest` >= 1.
- **No dependencies** beyond `three`, `vite`, `vitest`. Easing and damping are hand-written.
- **Style:** very minimal, geometric. Primary color light gray; blue used sparingly, as an accent only.
- **Exact colors:** background `#f7f7f8` (`0xf7f7f8`), cube faces `#d6d8dc` (`0xd6d8dc`), cube edges `#2563eb` (`0x2563eb`). No other colors anywhere.
- **Entrance duration:** 3.5 seconds, slow cinematic ease-out. Position and scale use ease-out cubic; spin speed uses ease-out quart so the rotation calms slightly ahead of the arrival.
- **Entrance channels:** position off-screen top -> center; scale 0.15 -> 1.0; spin 3.0 rev/s -> 0.035 rev/s. The 0.035 rev/s float spin then continues forever.
- **Post-settle interaction:** damped pointer parallax only (max 0.22 world-unit offset, max 0.09 rad tilt). No scroll interaction, no orbit controls, no click handlers.
- **Page content:** canvas only. No DOM text, no nav, no headings — not even a wordmark.
- **No shadows, no ground plane, no post-processing, no textures, no loaded assets.**
- **`prefers-reduced-motion` is intentionally not honored.** Product owner's explicit decision; every visitor gets the full animation. Do not add a reduced-motion branch or media query. (Known accessibility tradeoff, accepted.)
- **Out of scope:** additional pages/routes, project content, contact form, any 3D object other than this cube, deployment/hosting. The plan ends at a working dev server and a passing production build.
- **Every task ends with a commit**, Conventional Commits style (`chore:`, `feat:`, `docs:`).

## File Structure

| File | Responsibility |
| --- | --- |
| `index.html` | Single page: one `<canvas id="scene">` and the module script tag. Nothing else. |
| `package.json` | Scripts (`dev`, `build`, `preview`, `test`) and the three dependencies. |
| `vite.config.js` | Vite defaults plus the Vitest block (node environment, `tests/**`). |
| `.gitignore` | `node_modules`, `dist`. |
| `src/style.css` | Full-bleed canvas, off-white page background, no scrollbars. |
| `src/config.js` | Every tunable constant: sizes, colors, entrance timing, parallax limits. No logic. |
| `src/math.js` | `clamp01`, `lerp`, `dampTowards` — frame-rate-independent numeric helpers. |
| `src/easing.js` | `easeOutCubic`, `easeOutQuart`. |
| `src/animation.js` | `entranceState(elapsed, opts)` — the whole entrance as one pure function of time. |
| `src/camera.js` | Pure framing math: how far back the camera sits for a given aspect, how high off-screen the cube starts. |
| `src/cube.js` | `createCube()` — the gray-faced, blue-edged cube as a `THREE.Group`. |
| `src/scene.js` | `createScene(width, height)` — scene, camera, lights, cube, `resize()`. No `WebGLRenderer`. |
| `src/parallax.js` | `createParallax(config)` — damped pointer state -> offset + tilt. No DOM listeners. |
| `src/main.js` | The only browser-coupled file: renderer, DOM events, animation loop, wiring. |
| `tests/*.test.js` | One test file per pure/headless module. |

Why `scene.js` does not create the renderer: `WebGLRenderer` needs a real GL context and cannot be constructed in Node. Keeping it out of `scene.js` makes scene assembly (camera framing, lights, cube placement) unit-testable, which is where the bugs actually hide.

---

### Task 1: Project scaffold — dev server and production build

Greenfield directory: there is no `package.json`, no `node_modules`, and **no git repository yet**. This task creates the toolchain and proves it end-to-end with an empty off-white page. `src/main.js` here is a deliberate throwaway stub — Task 8 replaces it entirely.

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/style.css`
- Create: `src/config.js`
- Create: `src/main.js` (temporary stub)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `src/config.js` exporting `CUBE_SIZE`, `CUBE_RADIUS`, `FIT_MARGIN`, `CAMERA_FOV`, `COLORS` (`{ background, face, edge }`), `ENTRANCE` (`{ duration, endY, startScale, endScale, startSpin, endSpin }`), `PARALLAX` (`{ maxOffset, maxTilt, tau }`), `SPIN_TILT_RATIO`, `MAX_PIXEL_RATIO`, `MAX_FRAME_DELTA`. npm scripts `dev`, `build`, `preview`, `test`.

- [ ] **Step 1: Initialize the git repository**

```bash
git init
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules
dist
*.local
.DS_Store
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "portfolio-website-3d",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Install dependencies**

```bash
npm install three
npm install -D vite vitest
```

Expected: `node_modules/` appears, `package-lock.json` is created, `three` resolves to >= 0.160.0.

- [ ] **Step 5: Create `vite.config.js`**

Vitest reads its config from this file. `environment: 'node'` is correct because no test touches the DOM.

```js
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // The bundle is ~525 kB minified (~132 kB gzipped), nearly all of it
    // WebGLRenderer + three's core, and the project scope rules out
    // code-splitting it. Raised so the build stays pristine, but tight enough
    // that a three upgrade or real bundle growth still warns.
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 6: Create `index.html`**

The CSS is imported from `main.js` (the Vite way) rather than linked, so there is no stylesheet tag here.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Portfolio</title>
  </head>
  <body>
    <canvas id="scene"></canvas>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `src/style.css`**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  overflow: hidden;
  background: #f7f7f8;
}

#scene {
  display: block;
  width: 100vw;
  height: 100vh;
}
```

- [ ] **Step 8: Create `src/config.js`**

`CUBE_RADIUS` is half the cube's body diagonal — the radius of the sphere that fully contains the cube at any rotation. Framing against that radius is what stops the corners clipping mid-spin. Spin speeds are in **revolutions per second**; `main.js` converts to radians.

```js
export const CUBE_SIZE = 1.6;
export const CUBE_RADIUS = (CUBE_SIZE * Math.sqrt(3)) / 2;
export const FIT_MARGIN = 1.35;
export const CAMERA_FOV = 45;

export const COLORS = {
  background: 0xf7f7f8,
  face: 0xd6d8dc,
  edge: 0x2563eb,
};

export const ENTRANCE = {
  duration: 3.5,
  endY: 0,
  startScale: 0.15,
  endScale: 1,
  startSpin: 3.0,
  endSpin: 0.035,
};

export const PARALLAX = {
  maxOffset: 0.22,
  maxTilt: 0.09,
  tau: 0.35,
};

export const SPIN_TILT_RATIO = 0.35;
export const MAX_PIXEL_RATIO = 2;
export const MAX_FRAME_DELTA = 0.1;
```

- [ ] **Step 9: Create the temporary `src/main.js` stub**

This only proves Vite + three + WebGL are wired up. Task 8 rewrites the file.

```js
import * as THREE from 'three';
import './style.css';
import { COLORS } from './config.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.background);
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

renderer.render(scene, camera);
console.log('[landing-cube] scaffold OK, three r' + THREE.REVISION);
```

- [ ] **Step 10: Verify the production build**

Run: `npm run build`
Expected: exits 0; writes `dist/index.html` and `dist/assets/*.js`. No errors.

- [ ] **Step 11: Verify the dev server**

Run: `npm run dev`, then open the printed URL (usually `http://localhost:5173`).
Expected: a completely blank off-white (`#f7f7f8`) full-screen page, no scrollbars, and one console line `[landing-cube] scaffold OK, three r<number>`. No errors or warnings. Stop the server once confirmed.

- [ ] **Step 12: Commit**

```bash
git add .gitignore package.json package-lock.json vite.config.js index.html src/style.css src/config.js src/main.js
git commit -m "chore: scaffold vite + three + vitest project"
```

---

### Task 2: Numeric utilities — clamping, interpolation, damping

Five tiny functions everything else is built on. `dampTowards` uses exponential decay rather than the common `current += (target - current) * 0.1`, because the naive version moves at a different speed on a 144 Hz screen than on a 60 Hz one.

**Files:**
- Create: `src/math.js`
- Create: `src/easing.js`
- Test: `tests/math.test.js`
- Test: `tests/easing.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `clamp01(value) -> number`, `lerp(from, to, t) -> number`, `dampTowards(current, target, tau, dt) -> number` from `src/math.js`; `easeOutCubic(t) -> number`, `easeOutQuart(t) -> number` from `src/easing.js`. All take and return plain numbers; `tau` and `dt` are seconds.

- [ ] **Step 1: Write the failing tests for `src/math.js`**

Create `tests/math.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { clamp01, dampTowards, lerp } from '../src/math.js';

describe('clamp01', () => {
  it('passes through values already inside the unit range', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1)).toBe(1);
  });

  it('clamps values outside the unit range', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(9.5)).toBe(1);
  });
});

describe('lerp', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    expect(lerp(2, 10, 0)).toBe(2);
    expect(lerp(2, 10, 1)).toBe(10);
  });

  it('interpolates linearly in between', () => {
    expect(lerp(2, 10, 0.25)).toBe(4);
  });
});

describe('dampTowards', () => {
  it('does not move when no time has passed', () => {
    expect(dampTowards(0, 1, 0.35, 0)).toBe(0);
  });

  it('covers 1 - 1/e of the remaining gap in one time constant', () => {
    expect(dampTowards(0, 1, 0.35, 0.35)).toBeCloseTo(1 - 1 / Math.E, 6);
  });

  it('is symmetric when closing a negative gap', () => {
    expect(dampTowards(1, 0, 0.35, 0.35)).toBeCloseTo(1 / Math.E, 6);
  });

  it('effectively reaches the target for a very large dt', () => {
    expect(dampTowards(0, 1, 0.35, 100)).toBeCloseTo(1, 6);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/math.test.js`
Expected: FAIL — cannot resolve `../src/math.js`.

- [ ] **Step 3: Write `src/math.js`**

```js
export function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function lerp(from, to, t) {
  return from + (to - from) * t;
}

export function dampTowards(current, target, tau, dt) {
  if (tau <= 0) return target;
  return target + (current - target) * Math.exp(-dt / tau);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/math.test.js`
Expected: PASS — 8 tests.

- [ ] **Step 5: Write the failing tests for `src/easing.js`**

Create `tests/easing.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { easeOutCubic, easeOutQuart } from '../src/easing.js';

describe('easeOutCubic', () => {
  it('maps the unit interval onto itself', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('decelerates: most of the distance is covered by the halfway point', () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 6);
  });

  it('clamps out-of-range input instead of overshooting', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(4)).toBe(1);
  });
});

describe('easeOutQuart', () => {
  it('maps the unit interval onto itself', () => {
    expect(easeOutQuart(0)).toBe(0);
    expect(easeOutQuart(1)).toBe(1);
  });

  it('decelerates harder than cubic everywhere in between', () => {
    expect(easeOutQuart(0.5)).toBeCloseTo(0.9375, 6);
    expect(easeOutQuart(0.3)).toBeGreaterThan(easeOutCubic(0.3));
  });

  it('clamps out-of-range input instead of overshooting', () => {
    expect(easeOutQuart(-1)).toBe(0);
    expect(easeOutQuart(4)).toBe(1);
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run tests/easing.test.js`
Expected: FAIL — cannot resolve `../src/easing.js`.

- [ ] **Step 7: Write `src/easing.js`**

```js
import { clamp01 } from './math.js';

export function easeOutCubic(t) {
  const remaining = 1 - clamp01(t);
  return 1 - remaining * remaining * remaining;
}

export function easeOutQuart(t) {
  const remaining = 1 - clamp01(t);
  return 1 - remaining * remaining * remaining * remaining;
}
```

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS — 2 files, 14 tests.

- [ ] **Step 9: Commit**

```bash
git add src/math.js src/easing.js tests/math.test.js tests/easing.test.js
git commit -m "feat: add numeric and easing utilities"
```

---

### Task 3: Entrance animation state

The entire entrance expressed as one pure function of elapsed time: given a clock reading, it returns where the cube should be. No timelines, no mutable tween objects. This is what makes the animation testable and what makes a mid-entrance browser resize harmless.

Note the deliberate split: **position and scale ride ease-out cubic; spin speed rides ease-out quart.** Quart decays faster, so the rotation has already calmed to a drift by the time the cube reaches center — which is the spec's "rotation ease from fast entrance spin down to slow continuous float spin once cube settle in middle".

**Files:**
- Create: `src/animation.js`
- Test: `tests/animation.test.js`

**Interfaces:**
- Consumes: `clamp01`, `lerp` from `src/math.js`; `easeOutCubic`, `easeOutQuart` from `src/easing.js` (Task 2).
- Produces: `entranceState(elapsed, opts) -> { y, scale, spinSpeed, progress, done }`, where `elapsed` is seconds since page load and `opts` is `{ duration, startY, endY, startScale, endScale, startSpin, endSpin }`. `spinSpeed` is in revolutions per second. `progress` is the clamped 0..1 raw time fraction, not eased.

- [ ] **Step 1: Write the failing test**

Create `tests/animation.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { entranceState } from '../src/animation.js';

const OPTS = {
  duration: 3.5,
  startY: 4.9,
  endY: 0,
  startScale: 0.15,
  endScale: 1,
  startSpin: 3.0,
  endSpin: 0.035,
};

describe('entranceState', () => {
  it('starts off-screen above center, small, and spinning fast', () => {
    const state = entranceState(0, OPTS);
    expect(state.y).toBeCloseTo(4.9, 6);
    expect(state.scale).toBeCloseTo(0.15, 6);
    expect(state.spinSpeed).toBeCloseTo(3.0, 6);
    expect(state.progress).toBe(0);
    expect(state.done).toBe(false);
  });

  it('ends centered, full size, and barely drifting', () => {
    const state = entranceState(3.5, OPTS);
    expect(state.y).toBeCloseTo(0, 6);
    expect(state.scale).toBeCloseTo(1, 6);
    expect(state.spinSpeed).toBeCloseTo(0.035, 6);
    expect(state.done).toBe(true);
  });

  it('holds the settled state forever after the entrance', () => {
    const state = entranceState(600, OPTS);
    expect(state.y).toBeCloseTo(0, 6);
    expect(state.scale).toBeCloseTo(1, 6);
    expect(state.spinSpeed).toBeCloseTo(0.035, 6);
    expect(state.done).toBe(true);
  });

  it('descends, grows, and slows monotonically', () => {
    const samples = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((t) => entranceState(t, OPTS));
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i].y).toBeLessThan(samples[i - 1].y);
      expect(samples[i].scale).toBeGreaterThan(samples[i - 1].scale);
      expect(samples[i].spinSpeed).toBeLessThan(samples[i - 1].spinSpeed);
    }
  });

  it('decelerates: by the halfway point it is nearly centered', () => {
    const state = entranceState(1.75, OPTS);
    expect(state.progress).toBeCloseTo(0.5, 6);
    expect(state.y).toBeLessThan(OPTS.startY * 0.2);
  });

  it('calms the spin ahead of the arrival', () => {
    const state = entranceState(1.75, OPTS);
    const linearMidSpin = (OPTS.startSpin + OPTS.endSpin) / 2;
    expect(state.spinSpeed).toBeLessThan(linearMidSpin);
  });

  it('treats negative elapsed time as the start of the entrance', () => {
    const state = entranceState(-2, OPTS);
    expect(state.y).toBeCloseTo(4.9, 6);
    expect(state.scale).toBeCloseTo(0.15, 6);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/animation.test.js`
Expected: FAIL — cannot resolve `../src/animation.js`.

- [ ] **Step 3: Write `src/animation.js`**

```js
import { clamp01, lerp } from './math.js';
import { easeOutCubic, easeOutQuart } from './easing.js';

export function entranceState(elapsed, opts) {
  const progress = clamp01(elapsed / opts.duration);
  const travel = easeOutCubic(progress);
  const spinDecay = easeOutQuart(progress);

  return {
    y: lerp(opts.startY, opts.endY, travel),
    scale: lerp(opts.startScale, opts.endScale, travel),
    spinSpeed: lerp(opts.startSpin, opts.endSpin, spinDecay),
    progress,
    done: progress >= 1,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/animation.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/animation.js tests/animation.test.js
git commit -m "feat: add entrance animation state function"
```

---

### Task 4: Camera framing math

Two problems solved here. First: a camera with a 45-degree *vertical* FOV at a fixed distance clips the cube's corners on portrait phones, because a portrait viewport is narrower than it is tall — so the camera distance must be derived from whichever axis is tighter. Second: "off-screen at the top" is not a fixed number, because it depends on how far back the camera ended up — so the entrance start height is computed, never hardcoded.

**Files:**
- Create: `src/camera.js`
- Test: `tests/camera.test.js`

**Interfaces:**
- Consumes: nothing — pure trigonometry, no config import, all inputs are parameters.
- Produces: `cameraDistanceForRadius(radius, fovDeg, aspect) -> number`, `visibleHalfHeight(distance, fovDeg) -> number`, `entranceStartY(distance, fovDeg, radius) -> number`. All lengths are world units; `fovDeg` is the full vertical field of view in degrees.

- [ ] **Step 1: Write the failing test**

Create `tests/camera.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { cameraDistanceForRadius, entranceStartY, visibleHalfHeight } from '../src/camera.js';

// tan(45deg / 2) === tan(PI / 8)
const HALF_FOV_TAN = Math.tan(Math.PI / 8);

describe('cameraDistanceForRadius', () => {
  it('is limited by the vertical field of view on a landscape viewport', () => {
    const distance = cameraDistanceForRadius(1.871, 45, 16 / 9);
    expect(distance).toBeCloseTo(1.871 / HALF_FOV_TAN, 4);
  });

  it('is limited by the horizontal field of view on a portrait viewport', () => {
    const aspect = 9 / 16;
    const distance = cameraDistanceForRadius(1.871, 45, aspect);
    expect(distance).toBeCloseTo(1.871 / (HALF_FOV_TAN * aspect), 4);
  });

  it('pulls the camera further back on a portrait viewport', () => {
    const landscape = cameraDistanceForRadius(1.871, 45, 16 / 9);
    const portrait = cameraDistanceForRadius(1.871, 45, 9 / 16);
    expect(portrait).toBeGreaterThan(landscape);
  });

  it('scales linearly with the radius it has to fit', () => {
    const single = cameraDistanceForRadius(1, 45, 1);
    const double = cameraDistanceForRadius(2, 45, 1);
    expect(double).toBeCloseTo(single * 2, 6);
  });
});

describe('visibleHalfHeight', () => {
  it('grows linearly with distance', () => {
    expect(visibleHalfHeight(10, 45)).toBeCloseTo(10 * HALF_FOV_TAN, 6);
    expect(visibleHalfHeight(20, 45)).toBeCloseTo(2 * visibleHalfHeight(10, 45), 6);
  });
});

describe('entranceStartY', () => {
  it('places the whole cube above the top edge of the frame', () => {
    const distance = 5;
    const radius = 1.386;
    const startY = entranceStartY(distance, 45, radius);
    expect(startY).toBeGreaterThan(visibleHalfHeight(distance, 45) + radius);
  });

  it('rises as the camera pulls back', () => {
    expect(entranceStartY(9, 45, 1.386)).toBeGreaterThan(entranceStartY(5, 45, 1.386));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/camera.test.js`
Expected: FAIL — cannot resolve `../src/camera.js`.

- [ ] **Step 3: Write `src/camera.js`**

```js
function halfFovTan(fovDeg) {
  // fovDeg is the full vertical FOV in degrees; (deg * PI / 360) is half of it in radians.
  return Math.tan((fovDeg * Math.PI) / 360);
}

export function visibleHalfHeight(distance, fovDeg) {
  return halfFovTan(fovDeg) * distance;
}

export function cameraDistanceForRadius(radius, fovDeg, aspect) {
  const halfV = halfFovTan(fovDeg);
  const halfH = halfV * aspect;
  return radius / Math.min(halfV, halfH);
}

export function entranceStartY(distance, fovDeg, radius) {
  // One cube radius of clearance past the top edge, plus a small margin so the cube
  // is fully hidden even with an antialiasing fringe.
  return visibleHalfHeight(distance, fovDeg) + radius + 0.2;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/camera.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/camera.js tests/camera.test.js
git commit -m "feat: add camera framing math"
```

---

### Task 5: The cube — gray faces, thin blue edges

The cube is a `THREE.Group` holding two children: a flat-shaded light-gray `Mesh` and a blue `LineSegments` outline of the same box. Grouping them means one `scale`/`rotation`/`position` assignment moves both.

Two details that are easy to get wrong:

1. **z-fighting.** Edge lines sit at exactly the same depth as the face polygons, so they flicker and dash as the cube spins. The fix is `polygonOffset` on the *face* material, which nudges face depth values back a hair, leaving the lines cleanly on top. Do not fix this by scaling the outline up — that produces a visible halo at the corners.
2. **Line width.** `LineBasicMaterial.linewidth` is ignored by nearly every WebGL platform; lines render 1 device pixel wide. That is exactly the "thin blue edges" the spec asks for, so no `Line2`/fat-lines dependency is needed. Do not spend time trying to make them thicker.

**Files:**
- Create: `src/cube.js`
- Test: `tests/cube.test.js`

**Interfaces:**
- Consumes: `COLORS`, `CUBE_SIZE` from `src/config.js` (Task 1).
- Produces: `createCube() -> THREE.Group` named `'cube'`, containing a `THREE.Mesh` named `'cube-faces'` and a `THREE.LineSegments` named `'cube-edges'`.

- [ ] **Step 1: Write the failing test**

Create `tests/cube.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/cube.test.js`
Expected: FAIL — cannot resolve `../src/cube.js`.

- [ ] **Step 3: Write `src/cube.js`**

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/cube.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cube.js tests/cube.test.js
git commit -m "feat: add gray cube with blue edge outline"
```

---

### Task 6: Scene assembly and viewport fitting

Builds the scene graph and owns the framing. `resize(width, height)` recomputes both the camera distance and the entrance start height, so rotating a phone mid-entrance stays correct.

`startY` is exposed as a **getter on the returned object**. Consumers must read `view.startY` each frame rather than destructuring it — destructuring copies the number once and would freeze the pre-resize value.

**Files:**
- Create: `src/scene.js`
- Test: `tests/scene.test.js`

**Interfaces:**
- Consumes: `createCube()` from `src/cube.js` (Task 5); `cameraDistanceForRadius`, `entranceStartY` from `src/camera.js` (Task 4); `CAMERA_FOV`, `COLORS`, `CUBE_RADIUS`, `FIT_MARGIN` from `src/config.js` (Task 1).
- Produces: `createScene(width, height) -> { scene, camera, cube, resize(width, height), startY }` — `scene` is a `THREE.Scene`, `camera` a `THREE.PerspectiveCamera`, `cube` the group from `createCube()`, `startY` a read-only number in world units.

- [ ] **Step 1: Write the failing test**

Create `tests/scene.test.js`:

```js
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createScene } from '../src/scene.js';
import { COLORS } from '../src/config.js';

describe('createScene', () => {
  it('builds an off-white scene containing the cube', () => {
    const view = createScene(1600, 900);
    expect(view.scene).toBeInstanceOf(THREE.Scene);
    expect(view.scene.background.getHex()).toBe(COLORS.background);
    expect(view.scene.getObjectByName('cube')).toBe(view.cube);
  });

  it('lights the scene with one ambient fill and one key light', () => {
    const lights = createScene(1600, 900).scene.children.filter((child) => child.isLight);
    expect(lights.filter((light) => light.isAmbientLight)).toHaveLength(1);
    expect(lights.filter((light) => light.isDirectionalLight)).toHaveLength(1);
  });

  it('frames the cube head-on from in front of it', () => {
    const view = createScene(1600, 900);
    expect(view.camera.aspect).toBeCloseTo(1600 / 900, 6);
    expect(view.camera.position.x).toBe(0);
    expect(view.camera.position.y).toBe(0);
    expect(view.camera.position.z).toBeGreaterThan(0);
  });

  it('starts the cube above the top edge of the frame', () => {
    const view = createScene(1600, 900);
    expect(view.startY).toBeGreaterThan(0);
  });

  it('pulls back and raises the entrance start when the viewport turns portrait', () => {
    const view = createScene(1600, 900);
    const landscapeZ = view.camera.position.z;
    const landscapeStartY = view.startY;

    view.resize(900, 1600);

    expect(view.camera.aspect).toBeCloseTo(900 / 1600, 6);
    expect(view.camera.position.z).toBeGreaterThan(landscapeZ);
    expect(view.startY).toBeGreaterThan(landscapeStartY);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/scene.test.js`
Expected: FAIL — cannot resolve `../src/scene.js`.

- [ ] **Step 3: Write `src/scene.js`**

```js
import * as THREE from 'three';
import { CAMERA_FOV, COLORS, CUBE_RADIUS, FIT_MARGIN } from './config.js';
import { cameraDistanceForRadius, entranceStartY } from './camera.js';
import { createCube } from './cube.js';

export function createScene(width, height) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.background);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 100);

  scene.add(new THREE.AmbientLight(0xffffff, 2.0));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(3, 5, 4);
  scene.add(keyLight);

  const cube = createCube();
  scene.add(cube);

  const framing = { startY: 0 };

  function resize(nextWidth, nextHeight) {
    const aspect = nextWidth / nextHeight;
    const distance = cameraDistanceForRadius(CUBE_RADIUS * FIT_MARGIN, CAMERA_FOV, aspect);

    camera.aspect = aspect;
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    framing.startY = entranceStartY(distance, CAMERA_FOV, CUBE_RADIUS);
  }

  resize(width, height);

  return {
    scene,
    camera,
    cube,
    resize,
    // Getter, not a plain property: resize() changes it, so callers must read it live.
    get startY() {
      return framing.startY;
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/scene.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/scene.js tests/scene.test.js
git commit -m "feat: add scene assembly with responsive framing"
```

---

### Task 7: Damped pointer parallax

Turns a normalized pointer position into a small damped offset and tilt. It holds its own state but touches neither the DOM nor Three.js, so it is fully unit-testable: `main.js` feeds it pointer events and applies its output.

Coordinate convention: `setPointer(nx, ny)` takes screen-normalized values in `[-1, 1]` where `nx = -1` is the left edge and `ny = -1` is the **top** edge (matching browser `clientY`, which grows downward). The returned `offsetY` therefore flips sign, so a pointer above center lifts the cube up.

**Files:**
- Create: `src/parallax.js`
- Test: `tests/parallax.test.js`

**Interfaces:**
- Consumes: `dampTowards` from `src/math.js` (Task 2).
- Produces: `createParallax({ maxOffset, maxTilt, tau }) -> { setPointer(nx, ny), update(dt) -> { offsetX, offsetY, tiltX, tiltY } }`. `offsetX`/`offsetY` are world units, `tiltX`/`tiltY` are radians, `dt` is seconds.

- [ ] **Step 1: Write the failing test**

Create `tests/parallax.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { createParallax } from '../src/parallax.js';

const CONFIG = { maxOffset: 0.22, maxTilt: 0.09, tau: 0.35 };

function settle(parallax, steps = 200, dt = 1 / 60) {
  let out = parallax.update(0);
  for (let i = 0; i < steps; i += 1) out = parallax.update(dt);
  return out;
}

describe('createParallax', () => {
  it('is centered before the pointer ever moves', () => {
    const out = createParallax(CONFIG).update(1 / 60);
    expect(out.offsetX).toBe(0);
    expect(out.offsetY).toBe(0);
    expect(out.tiltX).toBe(0);
    expect(out.tiltY).toBe(0);
  });

  it('leans toward the pointer, up to the configured maximum', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(1, 0);
    const out = settle(parallax);
    expect(out.offsetX).toBeCloseTo(CONFIG.maxOffset, 4);
    expect(out.tiltY).toBeCloseTo(CONFIG.maxTilt, 4);
  });

  it('lifts the cube when the pointer is above center', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(0, -1);
    expect(settle(parallax).offsetY).toBeCloseTo(CONFIG.maxOffset, 4);
  });

  it('eases toward the pointer instead of snapping', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(1, 1);
    const firstFrame = parallax.update(1 / 60);
    expect(firstFrame.offsetX).toBeGreaterThan(0);
    expect(firstFrame.offsetX).toBeLessThan(CONFIG.maxOffset * 0.25);
  });

  it('clamps pointer input from outside the viewport', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(50, -50);
    const out = settle(parallax);
    expect(out.offsetX).toBeCloseTo(CONFIG.maxOffset, 4);
    expect(out.offsetY).toBeCloseTo(CONFIG.maxOffset, 4);
  });

  it('does not drift when no time passes', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(1, 1);
    expect(parallax.update(0).offsetX).toBe(0);
  });

  it('returns to center after the pointer comes back', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(1, 1);
    settle(parallax);
    parallax.setPointer(0, 0);
    const out = settle(parallax);
    expect(out.offsetX).toBeCloseTo(0, 4);
    expect(out.offsetY).toBeCloseTo(0, 4);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/parallax.test.js`
Expected: FAIL — cannot resolve `../src/parallax.js`.

- [ ] **Step 3: Write `src/parallax.js`**

```js
import { dampTowards } from './math.js';

function clampUnit(value) {
  if (value < -1) return -1;
  if (value > 1) return 1;
  return value;
}

export function createParallax({ maxOffset, maxTilt, tau }) {
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };

  return {
    // nx, ny are screen-normalized to [-1, 1]; ny grows downward like clientY.
    setPointer(nx, ny) {
      target.x = clampUnit(nx);
      target.y = clampUnit(ny);
    },

    update(dt) {
      current.x = dampTowards(current.x, target.x, tau, dt);
      current.y = dampTowards(current.y, target.y, tau, dt);

      // Negating a positive zero yields -0, which fails the suite's strict
      // toBe(0) assertions (Vitest's toBe uses Object.is) and would leak -0
      // to callers. `+ 0` normalizes it. Only offsetY negates a possibly-zero
      // value, so only offsetY needs it — do not "tidy" this away.
      return {
        offsetX: current.x * maxOffset,
        offsetY: -current.y * maxOffset + 0,
        tiltX: current.y * maxTilt,
        tiltY: current.x * maxTilt,
      };
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/parallax.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS — 7 files, 46 tests.

- [ ] **Step 6: Commit**

```bash
git add src/parallax.js tests/parallax.test.js
git commit -m "feat: add damped pointer parallax"
```

---

### Task 8: Wire it up — renderer, loop, and the live page

Replaces the Task 1 stub with the real entry point. This is the only file with DOM and WebGL coupling, and the only place the modules meet.

Four things it does that matter:

- **Clamps the frame delta** to `MAX_FRAME_DELTA` (0.1s). Without this, returning to a backgrounded tab delivers one enormous `dt` and the cube jumps a quarter-turn.
- **Converts revolutions to radians** once, at the point of use: `spinAngle += spinSpeed * 2 * PI * dt`. The spin angle accumulates rather than being derived from elapsed time, which is what lets the speed change smoothly without the rotation ever jumping backwards.
- **Tilts the spin axis** via `SPIN_TILT_RATIO`, applying `spinAngle` to Y and `0.35 * spinAngle` to X. A cube spinning on Y alone reads as a flat turntable, and its 90-degree symmetry makes fast spin look like slow spin. The X component breaks both.
- **Fades parallax in with `state.progress`**, so the pointer has no effect at the start of the entrance and full effect once the cube has settled — no branch, no snap at the handoff.

**Files:**
- Modify: `src/main.js` (full rewrite of the Task 1 stub)

**Interfaces:**
- Consumes: `createScene` (Task 6), `createParallax` (Task 7), `entranceState` (Task 3), and `ENTRANCE`, `PARALLAX`, `SPIN_TILT_RATIO`, `MAX_PIXEL_RATIO`, `MAX_FRAME_DELTA` from `src/config.js` (Task 1).
- Produces: nothing importable — this is the entry point.

- [ ] **Step 1: Rewrite `src/main.js`**

```js
import * as THREE from 'three';
import './style.css';
import {
  ENTRANCE,
  MAX_FRAME_DELTA,
  MAX_PIXEL_RATIO,
  PARALLAX,
  SPIN_TILT_RATIO,
} from './config.js';
import { entranceState } from './animation.js';
import { createParallax } from './parallax.js';
import { createScene } from './scene.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

// `view` is kept whole rather than destructured: view.startY is a getter that
// resize() updates.
const view = createScene(window.innerWidth, window.innerHeight);
const parallax = createParallax(PARALLAX);
const timer = new THREE.Timer();

let elapsed = 0;
let spinAngle = 0;

function applyViewportSize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(width, height);
  view.resize(width, height);
}

applyViewportSize();
window.addEventListener('resize', applyViewportSize);

window.addEventListener('pointermove', (event) => {
  parallax.setPointer(
    (event.clientX / window.innerWidth) * 2 - 1,
    (event.clientY / window.innerHeight) * 2 - 1
  );
});

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), MAX_FRAME_DELTA);
  elapsed += dt;

  const state = entranceState(elapsed, { ...ENTRANCE, startY: view.startY });
  spinAngle += state.spinSpeed * Math.PI * 2 * dt;

  const pointer = parallax.update(dt);
  const pointerWeight = state.progress;

  view.cube.position.set(
    pointer.offsetX * pointerWeight,
    state.y + pointer.offsetY * pointerWeight,
    0
  );
  view.cube.scale.setScalar(state.scale);
  view.cube.rotation.set(
    spinAngle * SPIN_TILT_RATIO + pointer.tiltX * pointerWeight,
    spinAngle + pointer.tiltY * pointerWeight,
    0
  );

  renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

- [ ] **Step 2: Confirm the unit tests still pass**

Run: `npm test`
Expected: PASS — 7 files, 46 tests. (`main.js` has no test; it is verified in the browser below.)

- [ ] **Step 3: Verify the entrance animation in the browser**

Run: `npm run dev`, open the printed URL, and hard-reload to watch the entrance from the start.

Expected, against the four spec requirements:
1. The cube enters from the top edge, already spinning — it is not visible at page load.
2. Over roughly 3.5 seconds it descends and decelerates hard into the center; the spin winds down from a fast tumble to an almost-imperceptible drift, and the spin has calmed by the time it stops moving.
3. It starts small and grows to fill roughly half the viewport height, reading as moving toward the viewer.
4. After settling, the gentle spin continues indefinitely (leave it for 30 seconds — a full revolution takes ~28s, so it should still be visibly turning).

Also confirm: faces read as three distinct light-gray values (top brightest, sides darker), edge lines are crisp thin blue and never flicker or dash while spinning, and the console is clean.

If the faces look uniformly white/blown out, lower the directional light intensity in `src/scene.js` from `2.5` to `1.5`; if they look flat gray with no shading difference between sides, raise it to `3.0`. Nothing else should need tuning.

- [ ] **Step 4: Verify pointer parallax**

Move the cursor to each corner of the window after the cube has settled.
Expected: the cube drifts a small amount toward the cursor and tilts slightly, smoothly catching up rather than snapping; the movement is subtle (a couple of percent of the viewport), and the float spin keeps running underneath it. Return the cursor to center and the cube eases back to center. Nothing moves off-screen or gets clipped.

- [ ] **Step 5: Verify responsive framing**

With the dev server running, drag the window from wide to narrow, then use the browser's device toolbar to emulate a portrait phone (e.g. 390x844) and reload.
Expected: the cube stays fully in frame at every size, corners never clipped mid-spin; on portrait the camera is further back so the cube is smaller on screen; the entrance still begins fully off-screen above the top edge. Resizing mid-entrance does not make the cube jump or appear from the side.

- [ ] **Step 6: Verify the production build**

Run: `npm run build` then `npm run preview`, and open the preview URL.
Expected: build exits 0; the previewed page behaves identically to dev — full entrance, float spin, parallax, clean console.

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "feat: wire renderer, animation loop, and pointer input"
```

---

### Task 9: Document the project and record the resolved spec questions

`AGENTS.md` still lists as open the four questions that are now decided and built. Leaving them open invites the next contributor (or agent) to re-litigate settled decisions.

**Files:**
- Create: `README.md`
- Modify: `AGENTS.md` (replace the `## Open Questions` section)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Create `README.md`**

```markdown
# Interactive 3D Portfolio

Minimal, geometric landing page: a single cube enters from off-screen top, grows and slows
into the center over 3.5 seconds, then floats there forever with a gentle spin and a subtle
pointer-follow tilt.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies. |
| `npm run dev` | Start the Vite dev server with hot reload. |
| `npm run build` | Build the static site into `dist/`. |
| `npm run preview` | Serve the built `dist/` locally. |
| `npm test` | Run the unit tests once. |
| `npm run test:watch` | Run the unit tests in watch mode. |

## Layout

- `src/config.js` — every tunable number (timing, sizes, colors, parallax limits). Start here.
- `src/math.js`, `src/easing.js` — numeric helpers.
- `src/animation.js` — the entrance as one pure function of elapsed time.
- `src/camera.js` — framing math: camera distance per aspect ratio, entrance start height.
- `src/cube.js` — the cube: gray flat-shaded faces, thin blue edge outline.
- `src/scene.js` — scene, camera, lights, and viewport fitting.
- `src/parallax.js` — damped pointer offset and tilt.
- `src/main.js` — renderer, DOM events, animation loop. The only browser-coupled file.

Everything except `main.js` is unit-tested in plain Node (no browser, no WebGL); the
renderer is deliberately kept out of `scene.js` to keep it that way.

## Design direction

Very minimal and geometric. Light gray is the primary color; blue appears only as the
cube's edge outline. Deployment is not set up yet — `npm run build` produces a static
`dist/` that can be hosted anywhere.
```

- [ ] **Step 2: Replace the `## Open Questions` section in `AGENTS.md`**

Delete the entire `## Open Questions` section (heading and its three bullets) and put this in its place:

```markdown
## Decisions (resolved 2026-08-28)

- **Build tooling:** Vite + npm `three`, plain JavaScript (no TypeScript). `npm run dev`, `npm run build`.
- **Entrance:** 3.5s slow cinematic ease-out. Position and scale on ease-out cubic; spin speed on ease-out quart (3.0 -> 0.035 rev/s) so the rotation calms just ahead of the arrival.
- **Post-settle interaction:** subtle damped pointer parallax (max 0.22 world-unit offset, max 0.09 rad tilt) layered over the eternal float spin. No scroll interaction.
- **Cube look:** matte light-gray flat-shaded faces (`#d6d8dc`) with a thin blue edge outline (`#2563eb`).
- **Page:** off-white background (`#f7f7f8`), no shadow, no DOM text — canvas only.
- **Reduced motion:** `prefers-reduced-motion` is intentionally not honored for now.
- **Deployment:** not set up. Scope ends at a working dev server and a static production build.
```

- [ ] **Step 3: Verify nothing broke**

Run: `npm test`
Expected: PASS — 7 files, 46 tests.

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: add README and record resolved spec decisions"
```

---

## Verification Summary

After Task 9, all four numbered spec requirements are verifiable:

| Spec requirement | Covered by | Verified by |
| --- | --- | --- |
| 1. Cube enters from top, spinning | Tasks 3, 4, 6, 8 | `tests/animation.test.js` (starts at `startY`, fast spin), `tests/camera.test.js` (`startY` is above the frame), Task 8 Step 3 |
| 2. Spin eases fast -> slow by the time it settles | Task 3 | `tests/animation.test.js` ("calms the spin ahead of the arrival", monotonic slowdown), Task 8 Step 3 |
| 3. Starts small, grows — reads as closer | Tasks 3, 8 | `tests/animation.test.js` (0.15 -> 1.0, monotonic growth), Task 8 Step 3 |
| 4. Slow float spin continues forever | Tasks 3, 8 | `tests/animation.test.js` (`entranceState(600)` still returns `endSpin`), Task 8 Step 3 |
| Minimal geometric style, gray + sparing blue | Tasks 1, 5, 6 | `tests/cube.test.js`, `tests/scene.test.js` (exact color assertions), Task 8 Step 3 |
| One landing page, nothing else | Task 1 | `index.html` contains only a canvas |
| Build tooling decided and working | Task 1 | `npm run build` and `npm run dev` in Task 1 Steps 10-11, Task 8 Step 6 |

## Corrections applied during execution (2026-08-28)

Three code blocks above were corrected after execution found them defective. The full
decision record lives in the execution ledger, not here.

1. **Task 1, `vite.config.js`** — added `build.chunkSizeWarningLimit: 600`. Three.js core
   is ~512 kB minified, which trips Vite's default 500 kB warning on every build. The task
   also requires a pristine build, so the two requirements conflicted as written.
2. **Task 7, `src/parallax.js`** — added `+ 0` to `offsetY` plus an explanatory comment.
   With `current.y === 0`, `-current.y * maxOffset` evaluates to `-0`, and
   `Object.is(-0, 0)` is `false`. Vitest's `toBe` uses `Object.is`, so the prescribed
   code could not pass the prescribed `expect(out.offsetY).toBe(0)` assertion.
3. **Task 8, `src/main.js`** — replaced `THREE.Clock` with `THREE.Timer`. `Clock` is
   deprecated in three r183 and logs a deprecation warning on every page load, which
   contradicts this task's own clean-console acceptance criterion. `Timer` is exported
   from three's core, so no addons dependency was introduced.
4. **Task 8, `src/main.js`** — dropped the `false` from `renderer.setSize(width, height)`.
   The plan mandated `updateStyle: false` so three would not fight `style.css`'s
   `100vw`/`100vh`, but that assumed the CSS was authoritative *and* correct. On iOS
   Safari and Chrome Android `100vh` is the large (toolbars-hidden) viewport while
   `window.innerHeight` — which sizes the drawing buffer and the camera aspect — is the
   visible height, so the framebuffer was stretched by up to ~16% in portrait and the
   pointer mapping was off by the same factor. Letting three write matching inline px
   makes the CSS box, the buffer, and the camera aspect agree by construction.
