# Welcome Reveal and Geist Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a large landing-only `Welcome` heading, center it with a smaller cube as one responsive composition, reveal it after the initial entrance, and adopt locally hosted Geist Sans across the site.

**Architecture:** Keep the heading as persistent HTML outside `#page`, with a pure welcome reducer owning its lifecycle and CSS owning its reveal. A second pure module converts the heading line box, responsive gap, and cube projection into one centered composition; `src/main.js` supplies DOM measurements while `src/scene.js` supplies projection metrics and the live landing Y. Routing and the navigation reducer stay unchanged, and Geist remains a pinned local WOFF2 asset with its OFL license.

**Tech Stack:** Vite 8, plain JavaScript, Vitest 4, HTML/CSS, Three.js 0.185.1, Geist Sans variable WOFF2.

**Spec:** `docs/specs/2026-09-02-welcome-reveal.md`

## Global Constraints

- Copy is exactly `Welcome`, with no punctuation, subtitle, body copy, or visible menu.
- The heading is DOM text, never Three.js geometry, a canvas texture, a sprite, or a raycast target.
- The initial reveal begins at `entranceDone`: `750ms`, `translateY(24px) -> translateY(0)`, opacity `0 -> 1`, bottom-to-top clipping, `cubic-bezier(0.22, 1, 0.36, 1)`, and no delay.
- The heading remains visible and stationary after revealing; it never follows the cube's bob, drag, coast, hover, yaw, or resize-time pose.
- The neutral heading-plus-cube bounds are vertically centered within 2 CSS pixels at every reference viewport.
- The neutral gap is `clamp(2rem, 5vmin, 4rem)` and remains at least 16 CSS pixels through maximum upward float and every horizontal yaw.
- `FIT_MARGIN` is `1.9`; `CUBE_SIZE` and the dock's 64 CSS-pixel target remain unchanged.
- `FLOAT.overlap` is `0.65` seconds so the entrance tail plus float stays below 0.08 world units at the new framing and landing target.
- Departure uses a `200ms` opacity-only fade and cannot delay routing or content mounting.
- Later returns to the landing page show the final state immediately after the landing view reaches `resting`; they never replay the reveal.
- Reduced motion uses a `150ms` opacity-only reveal with no translation or animated clipping. The cube entrance remains unchanged.
- Welcome typography starts at Geist weight `450`, size `clamp(3rem, min(16vw, 16vh), 10rem)`, line-height `0.9`, letter-spacing `-0.045em`, and color `#2a2c30`.
- Geist applies site-wide: copy stays weight `400`, existing content headings stay `500`, and the current system stack remains fallback only.
- Self-host the official Geist v1.7.2 variable WOFF2 and OFL text. Add no npm dependency, font CDN, Google Fonts URL, or JavaScript font loader.
- Preserve the document-first hidden navigation, one relevant `<h1>` per route, content focus management, hash routing, deep links, blank WebGL-failure fallback, and all cube interactions.
- Do not change `src/animation.js`, `src/navstate.js`, `src/input.js`, `src/pages.js`, `src/routes.js`, cube timing, entrance spin, resting yaw/pitch, dock timing, or dock yaw.
- Preserve the user's uncommitted `docs/review.md` change; do not stage or commit it.
- Node remains `^20.19.0 || >=22.12.0`.

---

## File Structure

### Create

- `src/composition.js` — pure responsive gap and centered-stack calculations; touches neither the DOM nor Three.js.
- `tests/composition.test.js` — headless coverage for gap clamping, target placement, and landing-Y conversion.
- `src/welcome.js` — pure welcome presentation reducer; imports route constants only and touches neither the DOM nor Three.js.
- `tests/welcome.test.js` — headless lifecycle coverage for every presentation mode and stale animation completion.
- `public/fonts/Geist-Variable.woff2` — pinned official Geist v1.7.2 variable webfont.
- `public/fonts/OFL.txt` — exact license bundled with Geist v1.7.2.

### Modify

- `index.html:8-30` — add one persistent, default-hidden landing `<h1>` after the document-first navigation and before `#page`.
- `src/style.css:1-15` — declare Geist and apply it globally.
- `src/style.css:49-132` — add welcome layout, visual modes, keyframes, and reduced-motion override without changing canvas hit testing.
- `src/config.js:1-70` — set the approved camera margin and adjusted float overlap.
- `src/scene.js:1-96` — expose projected cube bounds and a live responsive landing Y.
- `src/dock.js:20-43` — interpolate between the supplied landing Y and dock Y.
- `tests/scene.test.js:41-167` — lock the new framing, composition bounds, float overlap, and dock values.
- `tests/dock.test.js:1-183` — lock nonzero landing endpoints and reverse symmetry.
- `src/main.js:14-29` — import the pure welcome lifecycle and composition functions.
- `src/main.js:37-41` — capture the welcome heading element.
- `src/main.js:78-104` — initialize session-local welcome state from the parsed boot route.
- `src/main.js:157-170` — apply visual mode and accessibility semantics.
- `src/main.js:216-264` — reduce welcome state alongside navigation transitions.
- `src/main.js:115-138,278-370` — derive composition placement on boot and resize, feed landing Y to entrance and dock motion, attach animation completion handling, and reveal the element only after renderer setup.
- `AGENTS.md` — record the single visible landing heading and site-wide Geist decision.
- `README.md` — describe the reveal, typography, font assets, and welcome lifecycle module.

---

### Task 1: Build the pure welcome lifecycle

**Files:**

- Create: `src/welcome.js`
- Create: `tests/welcome.test.js`

**Interfaces:**

- Consumes: `LANDING_ROUTE` from `src/routes.js`; navigation snapshots shaped as `{ phase: string, route: string | null }`.
- Produces: `initialWelcomeState(route) -> { mode, initialRevealPending }`.
- Produces: `reduceWelcome(state, previousNav, nextNav) -> state`.
- Produces: `completeWelcomeAnimation(state, completedMode) -> state`.
- `mode` is exactly one of `waiting`, `revealing`, `visible`, `exiting`, or `hidden`.
- `completedMode` is `revealing` or `exiting`; mismatched stale completions return the same state object.

- [ ] **Step 1: Write the failing lifecycle tests**

Create `tests/welcome.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  completeWelcomeAnimation,
  initialWelcomeState,
  reduceWelcome,
} from '../src/welcome.js';

function nav(phase, route = null) {
  return { phase, route };
}

describe('initialWelcomeState', () => {
  it('waits only when the document boots on the landing route', () => {
    expect(initialWelcomeState(null)).toEqual({
      mode: 'waiting',
      initialRevealPending: true,
    });
  });

  it('starts hidden with no pending reveal on a content deep link', () => {
    expect(initialWelcomeState('work')).toEqual({
      mode: 'hidden',
      initialRevealPending: false,
    });
  });
});

describe('reduceWelcome', () => {
  it('reveals exactly when the initial landing entrance completes', () => {
    const state = initialWelcomeState(null);
    const next = reduceWelcome(state, nav('entering'), nav('resting'));

    expect(next).toEqual({ mode: 'revealing', initialRevealPending: false });
  });

  it('keeps every content state hidden, including the resting nav overlay', () => {
    const state = initialWelcomeState('work');

    expect(reduceWelcome(state, nav('docked', 'work'), nav('expanding', 'work'))).toEqual(
      state,
    );
    expect(reduceWelcome(state, nav('expanding', 'work'), nav('resting', 'work'))).toEqual(
      state,
    );
  });

  it('exits when a visible landing begins shrinking to content', () => {
    const state = { mode: 'visible', initialRevealPending: false };

    expect(reduceWelcome(state, nav('resting'), nav('shrinking', 'work'))).toEqual({
      mode: 'exiting',
      initialRevealPending: false,
    });
  });

  it('settles only the animation that matches the current mode', () => {
    expect(
      completeWelcomeAnimation(
        { mode: 'revealing', initialRevealPending: false },
        'revealing',
      ),
    ).toEqual({ mode: 'visible', initialRevealPending: false });
    expect(
      completeWelcomeAnimation({ mode: 'exiting', initialRevealPending: false }, 'exiting'),
    ).toEqual({ mode: 'hidden', initialRevealPending: false });
  });

  it('ignores a stale animation completion after the mode changed', () => {
    const state = { mode: 'visible', initialRevealPending: false };

    expect(completeWelcomeAnimation(state, 'exiting')).toBe(state);
    expect(completeWelcomeAnimation(state, 'revealing')).toBe(state);
  });

  it('stays hidden during a return expansion, then appears without revealing', () => {
    const state = initialWelcomeState('work');
    const expanding = reduceWelcome(state, nav('docked', 'work'), nav('expanding'));
    const resting = reduceWelcome(expanding, nav('expanding'), nav('resting'));

    expect(expanding).toEqual({ mode: 'hidden', initialRevealPending: false });
    expect(resting).toEqual({ mode: 'visible', initialRevealPending: false });
  });

  it('appears immediately when history restores landing at an already-resting cube', () => {
    const state = initialWelcomeState('work');
    const next = reduceWelcome(state, nav('resting', 'work'), nav('resting'));

    expect(next).toEqual({ mode: 'visible', initialRevealPending: false });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```powershell
npm test -- tests/welcome.test.js
```

Expected: FAIL during module import because `src/welcome.js` does not exist.

- [ ] **Step 3: Implement the minimal pure reducer**

Create `src/welcome.js`:

```js
import { LANDING_ROUTE } from './routes.js';

export function initialWelcomeState(route) {
  const initialRevealPending = route === LANDING_ROUTE;
  return {
    mode: initialRevealPending ? 'waiting' : 'hidden',
    initialRevealPending,
  };
}

export function reduceWelcome(state, previousNav, nextNav) {
  if (nextNav.route !== LANDING_ROUTE) {
    const leavingVisibleLanding =
      previousNav.route === LANDING_ROUTE &&
      (state.mode === 'revealing' || state.mode === 'visible');

    return {
      mode: leavingVisibleLanding ? 'exiting' : 'hidden',
      initialRevealPending: false,
    };
  }

  if (nextNav.phase === 'entering') {
    return { mode: 'waiting', initialRevealPending: state.initialRevealPending };
  }

  if (nextNav.phase !== 'resting') {
    return { mode: 'hidden', initialRevealPending: state.initialRevealPending };
  }

  if (state.initialRevealPending && previousNav.phase === 'entering') {
    return { mode: 'revealing', initialRevealPending: false };
  }

  return { mode: 'visible', initialRevealPending: false };
}

export function completeWelcomeAnimation(state, completedMode) {
  if (state.mode !== completedMode) return state;
  if (completedMode === 'revealing') {
    return { ...state, mode: 'visible' };
  }
  if (completedMode === 'exiting') {
    return { ...state, mode: 'hidden' };
  }
  return state;
}
```

The reducer deliberately does not know animation durations, DOM attributes, Three.js time,
or the URL. `nextNav.route` remains authoritative, and `initialRevealPending` is consumed once.

- [ ] **Step 4: Run focused and full tests**

Run:

```powershell
npm test -- tests/welcome.test.js
npm test
```

Expected: the focused file reports 9 passing tests. The full suite reports 15 passing files
and 230 passing tests: the existing 14 files/221 tests plus the new lifecycle coverage.

- [ ] **Step 5: Commit the pure lifecycle**

```powershell
git add -- src/welcome.js tests/welcome.test.js
git commit -m "feat: add welcome lifecycle"
```

---

### Task 2: Build the pure composition calculations

**Files:**

- Create: `src/composition.js`
- Create: `tests/composition.test.js`

**Interfaces:**

- Produces: `compositionGapPx(width, height, rootFontPx) -> number` implementing `clamp(2rem, 5vmin, 4rem)` in CSS pixels.
- Produces: `centeredComposition({ viewportHeight, headingHeight, gap, zeroBounds, unitBounds }) -> { landingY, headingTopPx, cubeTopPx, cubeBottomPx, groupCenterPx }`.
- `zeroBounds` and `unitBounds` are projected cube bounds at world-space Y values `0` and `1`, each shaped as `{ top, bottom, centerY }` in CSS pixels.
- Invariant: the module imports neither Three.js nor the DOM.

- [ ] **Step 1: Write the failing pure-layout tests**

Create `tests/composition.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { centeredComposition, compositionGapPx } from '../src/composition.js';

describe('compositionGapPx', () => {
  it('implements clamp(2rem, 5vmin, 4rem)', () => {
    expect(compositionGapPx(1920, 1080, 16)).toBe(54);
    expect(compositionGapPx(1000, 1000, 16)).toBe(50);
    expect(compositionGapPx(390, 844, 16)).toBe(32);
    expect(compositionGapPx(280, 1000, 16)).toBe(32);
  });

  it('respects a non-default root font size', () => {
    expect(compositionGapPx(200, 1000, 20)).toBe(40);
    expect(compositionGapPx(2000, 2000, 20)).toBe(80);
  });
});

describe('centeredComposition', () => {
  const layout = centeredComposition({
    viewportHeight: 1000,
    headingHeight: 100,
    gap: 50,
    zeroBounds: { top: 400, bottom: 600, centerY: 500 },
    unitBounds: { top: 200, bottom: 400, centerY: 300 },
  });

  it('moves the cube visual center below the viewport center', () => {
    expect(layout.landingY).toBeCloseTo(-0.375, 12);
    expect(layout.cubeTopPx).toBeCloseTo(475, 12);
    expect(layout.cubeBottomPx).toBeCloseTo(675, 12);
  });

  it('places the heading exactly one nominal gap above the cube', () => {
    expect(layout.headingTopPx).toBeCloseTo(325, 12);
    expect(layout.cubeTopPx - (layout.headingTopPx + 100)).toBeCloseTo(50, 12);
  });

  it('centers the combined heading and cube bounds', () => {
    expect(layout.groupCenterPx).toBeCloseTo(500, 12);
  });

  it('rejects projection samples with no vertical slope', () => {
    expect(() =>
      centeredComposition({
        viewportHeight: 1000,
        headingHeight: 100,
        gap: 50,
        zeroBounds: { top: 400, bottom: 600, centerY: 500 },
        unitBounds: { top: 400, bottom: 600, centerY: 500 },
      }),
    ).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```powershell
npm test -- tests/composition.test.js
```

Expected: FAIL during module import because `src/composition.js` does not exist.

- [ ] **Step 3: Implement the pure composition module**

Create `src/composition.js`:

```js
export function compositionGapPx(width, height, rootFontPx) {
  const preferred = 0.05 * Math.min(width, height);
  return Math.min(4 * rootFontPx, Math.max(2 * rootFontPx, preferred));
}

export function centeredComposition({
  viewportHeight,
  headingHeight,
  gap,
  zeroBounds,
  unitBounds,
}) {
  const centerSlope = unitBounds.centerY - zeroBounds.centerY;
  if (!Number.isFinite(centerSlope) || Math.abs(centerSlope) < Number.EPSILON) {
    throw new RangeError('Projected cube center must move when world-space Y changes');
  }

  // If two vertical boxes are separated by `gap`, their combined center is
  // half (headingHeight + gap) above the lower box's visual center.
  const targetCubeCenter = viewportHeight / 2 + (headingHeight + gap) / 2;
  const landingY = (targetCubeCenter - zeroBounds.centerY) / centerSlope;
  const cubeTopPx = zeroBounds.top + (unitBounds.top - zeroBounds.top) * landingY;
  const cubeBottomPx =
    zeroBounds.bottom + (unitBounds.bottom - zeroBounds.bottom) * landingY;
  const headingTopPx = cubeTopPx - gap - headingHeight;

  return {
    landingY,
    headingTopPx,
    cubeTopPx,
    cubeBottomPx,
    groupCenterPx: (headingTopPx + cubeBottomPx) / 2,
  };
}
```

- [ ] **Step 4: Run focused and full tests**

Run:

```powershell
npm test -- tests/composition.test.js
npm test
```

Expected: all 6 composition tests pass and the pre-existing suite remains green.

- [ ] **Step 5: Commit the composition calculations**

```powershell
git add -- src/composition.js tests/composition.test.js
git commit -m "feat: calculate welcome composition"
```

---

### Task 3: Add responsive scene and dock anchors

**Files:**

- Modify: `src/config.js:1-70`
- Modify: `src/scene.js:1-96`
- Modify: `src/dock.js:20-43`
- Modify: `tests/scene.test.js:1-167`
- Modify: `tests/dock.test.js:1-183`
- Modify: `tests/camera.test.js:56-65`

**Interfaces:**

- Consumes: `centeredComposition()` and `compositionGapPx()` from Task 2.
- Produces: `view.projectCubeBounds({ y, scale, pitch, yaw }) -> { left, right, top, bottom, width, height, centerX, centerY }`, with CSS-pixel coordinates and settled-pose defaults.
- Produces: `view.setLandingY(number) -> void` and live getter `view.landingY -> number`.
- Changes: `dockState(progress, { restY, dockY, dockScale, yaw, settleYaw, spinRevolutions })`; `restY` is required and replaces hard-coded zero.
- Invariants: `FIT_MARGIN = 1.9`, `FLOAT.overlap = 0.65`, dock CSS-pixel sizing and all rotation/timing constants remain unchanged.

- [ ] **Step 1: Add failing reference-viewport composition tests**

In `tests/scene.test.js`, import the Task 2 functions:

```js
import { centeredComposition, compositionGapPx } from '../src/composition.js';
import { SETTLE } from '../src/config.js';
```

Merge `SETTLE` into the existing config import rather than creating a duplicate import. Add
these helpers and cases near the top of the file:

```js
const VIEWPORTS = [
  [1920, 1080],
  [1440, 900],
  [1000, 1000],
  [390, 844],
  [280, 1000],
  [844, 390],
];

function headingHeightPx(width, height) {
  const fontSize = Math.min(160, Math.max(48, Math.min(0.16 * width, 0.16 * height)));
  return 0.9 * fontSize;
}

function applyTestComposition(view, width, height) {
  const headingHeight = headingHeightPx(width, height);
  const gap = compositionGapPx(width, height, 16);
  const layout = centeredComposition({
    viewportHeight: height,
    headingHeight,
    gap,
    zeroBounds: view.projectCubeBounds({ y: 0 }),
    unitBounds: view.projectCubeBounds({ y: 1 }),
  });
  view.setLandingY(layout.landingY);
  return { headingHeight, gap, layout };
}
```

Add these tests to the `createScene` describe block:

```js
it('draws the settled cube at 43–44 percent of the smaller viewport dimension', () => {
  const view = createScene(1600, 900);

  for (const [width, height] of VIEWPORTS) {
    view.resize(width, height);
    const bounds = view.projectCubeBounds();
    const fraction = bounds.width / Math.min(width, height);
    expect(fraction).toBeGreaterThanOrEqual(0.43);
    expect(fraction).toBeLessThanOrEqual(0.45);
  }
});

it('centers the neutral heading and cube as one visual group', () => {
  const view = createScene(1600, 900);

  for (const [width, height] of VIEWPORTS) {
    view.resize(width, height);
    const { layout } = applyTestComposition(view, width, height);
    const placed = view.projectCubeBounds({ y: view.landingY });
    const actualCenter = (layout.headingTopPx + placed.bottom) / 2;
    expect(Math.abs(actualCenter - height / 2)).toBeLessThanOrEqual(2);
  }
});

it('keeps at least 16 pixels between the fixed heading and the floating cube', () => {
  const view = createScene(1600, 900);

  for (const [width, height] of VIEWPORTS) {
    view.resize(width, height);
    const { headingHeight, layout } = applyTestComposition(view, width, height);
    const headingBottom = layout.headingTopPx + headingHeight;

    for (let degrees = 0; degrees < 360; degrees += 1) {
      const bounds = view.projectCubeBounds({
        y: view.landingY + FLOAT.amplitude,
        yaw: (degrees * Math.PI) / 180,
      });
      expect(bounds.top - headingBottom).toBeGreaterThanOrEqual(16);
    }
  }
});
```

- [ ] **Step 2: Update dock tests for the required resting Y**

Change the shared `OPTS` in `tests/dock.test.js` to:

```js
const OPTS = {
  restY: -0.4,
  dockY: -2,
  dockScale: 0.11612,
  yaw: SETTLE.yaw,
  settleYaw: SETTLE.yaw,
};
```

Update the position assertions in the `dockState` tests:

```js
expect(dockState(0, OPTS).y).toBeCloseTo(OPTS.restY, 12);
expect(dockState(-1, OPTS).y).toBeCloseTo(OPTS.restY, 12);
expect(forward.y + backward.y).toBeCloseTo(OPTS.restY + OPTS.dockY, 9);
```

Leave scale, yaw, content-fade, and strobing assertions unchanged.

- [ ] **Step 3: Run the focused tests and confirm the red state**

Run:

```powershell
npm test -- tests/composition.test.js tests/scene.test.js tests/dock.test.js
```

Expected: composition tests pass; scene tests fail because projection/landing APIs do not
exist, and dock endpoint tests fail because `dockState()` still starts at zero.

- [ ] **Step 4: Apply the approved framing and overlap constants**

In `src/config.js`, make these scoped changes and update their surrounding measured comments:

```js
export const FIT_MARGIN = 1.9;
```

Delete `endY: 0` from `ENTRANCE`; viewport composition now supplies this value at every
call site, so retaining the old constant would create a false second source of truth.

```js
export const FLOAT = {
  amplitude: 0.08,
  period: 5.0,
  rampDuration: 1.5,
  overlap: 0.65,
};
```

Record that `startSpin = 4.5` reaches 42.7 degrees per 30 fps frame in the worst 9:19.5
case at `FIT_MARGIN = 1.9`, and that the new overlap moves onset 50 ms later to keep the
entrance-tail-plus-float peak below 0.08 at 280 × 1000. Record that
`floatOffset(ENTRANCE.duration)` is now `0.0233616`. Do not alter any other constant.

- [ ] **Step 5: Expose projected bounds and the landing anchor from the scene**

In `src/scene.js`, add `SETTLE` to the config import. Extend `framing` with:

```js
    width: Math.max(width, 1),
    height: Math.max(height, 1),
    landingY: 0,
```

At the start of `resize(nextWidth, nextHeight)`, assign the clamped CSS size:

```js
    framing.width = Math.max(nextWidth, 1);
    framing.height = Math.max(nextHeight, 1);
```

Replace the resize calculations' direct uses of `nextWidth` and `nextHeight` with:

```js
    const aspect = framing.width / framing.height;
```

```js
    const pxPerWorldUnit = pixelsPerWorldUnit(distance, CAMERA_FOV, framing.height);
    const silhouettePx = Math.min(
      DOCK.silhouettePx,
      DOCK.maxSilhouetteFraction * Math.min(framing.width, framing.height),
    );
```

Then call `camera.updateMatrixWorld()` after `camera.updateProjectionMatrix()`. Add this
function after `resize()`:

```js
  function projectCubeBounds({
    y = 0,
    scale = 1,
    pitch = SETTLE.pitch,
    yaw = SETTLE.yaw,
  } = {}) {
    const half = (CUBE_SIZE * scale) / 2;
    const rotation = new THREE.Euler(pitch, yaw, 0, 'XYZ');
    const point = new THREE.Vector3();
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;

    for (const x of [-half, half]) {
      for (const localY of [-half, half]) {
        for (const z of [-half, half]) {
          point.set(x, localY, z).applyEuler(rotation);
          point.y += y;
          point.project(camera);
          const screenX = ((point.x + 1) * framing.width) / 2;
          const screenY = ((1 - point.y) * framing.height) / 2;
          left = Math.min(left, screenX);
          right = Math.max(right, screenX);
          top = Math.min(top, screenY);
          bottom = Math.max(bottom, screenY);
        }
      }
    }

    return {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2,
    };
  }
```

Expose these members from the returned view object:

```js
    projectCubeBounds,
    setLandingY(value) {
      framing.landingY = value;
    },
    get landingY() {
      return framing.landingY;
    },
```

Keep the cube mesh untouched; this method projects temporary corner vectors and does not
mutate the scene.

- [ ] **Step 6: Make dock travel start at the responsive landing anchor**

In `src/dock.js`, replace the position line inside `dockState()` with:

```js
    y: lerp(opts.restY, opts.dockY, travel),
```

Update the adjacent comment to say that `restY` is the live centered-composition anchor.
Do not change the scale or yaw expressions.

- [ ] **Step 7: Update numeric dock expectations and the overlap test**

Replace the `CASES` values in the dock-framing section of `tests/scene.test.js` with:

```js
const CASES = [
  { w: 1920, h: 1080, silhouette: 64, scale: 0.13790, y: -2.3246 },
  { w: 1440, h: 900, silhouette: 64, scale: 0.16548, y: -2.2630 },
  { w: 1000, h: 1000, silhouette: 64, scale: 0.14893, y: -2.3000 },
  { w: 390, h: 844, silhouette: 62.4, scale: 0.37232, y: -4.8575 },
];
```

In the entrance-tail test, call `applyTestComposition()` after `view.resize()`, pass
`endY: view.landingY`, measure relative to that endpoint, and include the scale used by the
actual frame loop:

```js
const entranceOpts = { ...ENTRANCE, startY: view.startY, endY: view.landingY };
const floatOpts = { ...FLOAT, duration: ENTRANCE.duration };
let peak = 0;
const onset = ENTRANCE.duration - FLOAT.overlap;
for (let i = 0; i <= 2000; i += 1) {
  const t = onset + (i / 2000) * (FLOAT.period / 2);
  const entrance = entranceState(t, entranceOpts);
  const displacement =
    entrance.y - view.landingY + floatOffset(t, floatOpts) * entrance.scale;
  if (displacement > peak) peak = displacement;
}
expect(peak).toBeLessThan(FLOAT.amplitude);
```

In `tests/camera.test.js`, replace the stale comment tying its representative numeric inputs
to `FIT_MARGIN = 1.6` with:

```js
// Representative camera distances verify the conversion independently of live config.
```

- [ ] **Step 8: Run focused and full tests**

Run:

```powershell
npm test -- tests/composition.test.js tests/scene.test.js tests/dock.test.js
npm test
git diff --check
```

Expected: all focused tests and the full suite pass; `git diff --check` reports no errors.

- [ ] **Step 9: Commit the responsive scene anchors**

```powershell
git add -- src/config.js src/scene.js src/dock.js tests/scene.test.js tests/dock.test.js tests/camera.test.js
git commit -m "feat: center landing composition"
```

---

### Task 4: Self-host Geist and apply it globally

**Files:**

- Create: `public/fonts/Geist-Variable.woff2`
- Create: `public/fonts/OFL.txt`
- Modify: `src/style.css:1-15`

**Interfaces:**

- Consumes: official Geist v1.7.2 release archive at `https://github.com/vercel/geist-font/releases/download/v1.7.2/geist-font-v1.7.2.zip`.
- Produces: CSS family name `Geist`, covering normal variable weights `100 900`.
- Produces: same-origin public asset URL `/fonts/Geist-Variable.woff2`.
- Invariant: `package.json` and `package-lock.json` do not change.

- [ ] **Step 1: Download the pinned official release into a unique temporary directory**

Run from the repository root in PowerShell:

```powershell
$geistTemp = Join-Path ([System.IO.Path]::GetTempPath()) ('geist-v1.7.2-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $geistTemp | Out-Null
$geistZip = Join-Path $geistTemp 'geist-font-v1.7.2.zip'
Invoke-WebRequest -Uri 'https://github.com/vercel/geist-font/releases/download/v1.7.2/geist-font-v1.7.2.zip' -OutFile $geistZip
Expand-Archive -LiteralPath $geistZip -DestinationPath (Join-Path $geistTemp 'release')
```

Expected: the archive expands beneath `$geistTemp/release/geist-font`.

- [ ] **Step 2: Verify the official assets before copying them**

Run:

```powershell
$geistRoot = Join-Path $geistTemp 'release/geist-font'
$geistFont = Join-Path $geistRoot 'Geist/webfonts/Geist[wght].woff2'
$geistLicense = Join-Path $geistRoot 'OFL.txt'
Get-FileHash -Algorithm SHA256 -LiteralPath $geistFont, $geistLicense
```

Expected SHA-256 values:

```text
Geist[wght].woff2  A369FCF5628EA2AA4E1B9E2EC6A5B3624E365BDA588E1F0F2F12B564F728FBB8
OFL.txt            C683BFBCC7E087F5D37A54EF628F10387C451A83DDC459B151403A164AC46C90
```

Stop this task if either checksum differs; do not copy an unverified binary into the repo.

- [ ] **Step 3: Copy the font and license into the public asset tree**

Run:

```powershell
New-Item -ItemType Directory -Path 'public/fonts' -Force | Out-Null
Copy-Item -LiteralPath $geistFont -Destination 'public/fonts/Geist-Variable.woff2'
Copy-Item -LiteralPath $geistLicense -Destination 'public/fonts/OFL.txt'
Get-FileHash -Algorithm SHA256 -LiteralPath 'public/fonts/Geist-Variable.woff2', 'public/fonts/OFL.txt'
```

Expected: the copied files retain the two hashes from Step 2.

- [ ] **Step 4: Declare Geist and replace the global primary family**

Insert this block at the top of `src/style.css`, before the universal reset:

```css
@font-face {
  font-family: 'Geist';
  src: url('/fonts/Geist-Variable.woff2') format('woff2');
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}
```

Replace the current `font` declaration in `html, body` with:

```css
  font: 400 1rem/1.7 'Geist', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```

Do not change the existing `#page h1` weight `500`; the focused hidden navigation links and
dock button inherit Geist automatically.

- [ ] **Step 5: Verify the production asset and same-origin CSS URL**

Run:

```powershell
npm run build
Test-Path 'dist/fonts/Geist-Variable.woff2'
Test-Path 'dist/fonts/OFL.txt'
rg -n "Geist-Variable\.woff2|fonts\.googleapis|fonts\.gstatic" dist/assets -g '*.css'
git diff -- package.json package-lock.json
```

Expected:

- Vite build succeeds.
- Both `Test-Path` calls print `True`.
- Built CSS contains `/fonts/Geist-Variable.woff2` and no Google Fonts domains.
- `git diff` prints nothing for both package files.

- [ ] **Step 6: Commit the font assets and global typography**

```powershell
git add -- public/fonts/Geist-Variable.woff2 public/fonts/OFL.txt src/style.css
git commit -m "feat: self-host Geist typography"
```

---

### Task 5: Render, position, and animate the landing heading

**Files:**

- Modify: `index.html:8-30`
- Modify: `src/style.css:49-132`
- Modify: `src/main.js:14-29,37-41,78-138,157-170,216-264,278-370`

**Interfaces:**

- Consumes: `initialWelcomeState`, `reduceWelcome`, and `completeWelcomeAnimation` from Task 1.
- Consumes: composition functions from Task 2, responsive scene/dock anchors from Task 3,
  and the global `Geist` family from Task 4.
- Produces: persistent element `#welcome` with `data-mode` equal to the pure state mode.
- Produces: inline heading `top` and `view.landingY` derived together on boot and resize.
- Produces: `aria-hidden="false"` only while landing is semantically active in `entering` or `resting`; content and landing expansion use `aria-hidden="true"`.
- Produces: animation names `welcome-reveal`, `welcome-reveal-reduced`, and `welcome-exit`, which the completion handler maps back to `revealing` or `exiting`.

- [ ] **Step 1: Add the persistent, fail-closed heading markup**

In `index.html`, insert this after `</nav>` and before `<main id="page">`:

```html
    <!-- Landing-only DOM heading. It starts hidden so a failed WebGL renderer
         preserves the intended blank off-white fallback; main.js reveals it only
         after renderer setup. Pointer input continues to belong to the canvas. -->
    <h1 id="welcome" hidden>Welcome</h1>
```

Keep the hidden navigation first in the document. Do not place the heading inside `#page`,
because `mountContent()` replaces that element's `innerHTML` on route changes.

- [ ] **Step 2: Add the stable heading layout and visual modes**

Insert the following in `src/style.css` after the `#routes a:focus-visible` block and before
`#page`:

```css
#welcome {
  position: fixed;
  top: 0;
  left: 50%;
  z-index: 3;
  max-width: calc(100vw - 2rem);
  overflow: hidden;
  color: #2a2c30;
  font-size: clamp(3rem, min(16vw, 16vh), 10rem);
  font-weight: 450;
  line-height: 0.9;
  letter-spacing: -0.045em;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  transform: translate(-50%, 24px);
  clip-path: inset(100% 0 0);
}

#welcome[data-mode='waiting'] {
  visibility: visible;
}

#welcome[data-mode='revealing'] {
  visibility: visible;
  animation: welcome-reveal 750ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

#welcome[data-mode='visible'] {
  visibility: visible;
  opacity: 1;
  transform: translate(-50%, 0);
  clip-path: inset(0);
}

#welcome[data-mode='exiting'] {
  visibility: visible;
  animation: welcome-exit 200ms ease-out both;
}

@keyframes welcome-reveal {
  from {
    visibility: visible;
    opacity: 0;
    transform: translate(-50%, 24px);
    clip-path: inset(100% 0 0);
  }

  to {
    visibility: visible;
    opacity: 1;
    transform: translate(-50%, 0);
    clip-path: inset(0);
  }
}

@keyframes welcome-exit {
  from {
    visibility: visible;
    opacity: 1;
    transform: translate(-50%, 0);
    clip-path: inset(0);
  }

  to {
    visibility: visible;
    opacity: 0;
    transform: translate(-50%, 0);
    clip-path: inset(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  #welcome[data-mode='revealing'] {
    transform: translate(-50%, 0);
    clip-path: inset(0);
    animation: welcome-reveal-reduced 150ms ease-out both;
  }
}

@keyframes welcome-reveal-reduced {
  from {
    visibility: visible;
    opacity: 0;
  }

  to {
    visibility: visible;
    opacity: 1;
  }
}
```

The inline `top` written by `src/main.js` replaces the old independent viewport-top anchor.
The `z-index` remains below focused hidden-nav links (`z-index: 4`) and above the canvas
(`z-index: 2`). `pointer-events: none` prevents any change to hover, drag, or raycasting.

- [ ] **Step 3: Import the lifecycle functions and capture the element**

Add this import in `src/main.js` with the other local modules:

```js
import {
  completeWelcomeAnimation,
  initialWelcomeState,
  reduceWelcome,
} from './welcome.js';
import { centeredComposition, compositionGapPx } from './composition.js';
```

Add this DOM lookup after `dockButton`:

```js
const welcomeHeading = document.getElementById('welcome');
```

Immediately after `let nav = initialState(boot.route, elapsed);`, initialize the independent
presentation state:

```js
let welcomeState = initialWelcomeState(boot.route);
```

- [ ] **Step 4: Couple viewport sizing to the centered composition**

Add this function immediately before `applyViewportSize()`:

```js
function applyWelcomeComposition(width, height) {
  const headingHeight = welcomeHeading.getBoundingClientRect().height;
  const rootFontPx = Number.parseFloat(getComputedStyle(root).fontSize);
  const gap = compositionGapPx(width, height, rootFontPx);
  const layout = centeredComposition({
    viewportHeight: height,
    headingHeight,
    gap,
    zeroBounds: view.projectCubeBounds({ y: 0 }),
    unitBounds: view.projectCubeBounds({ y: 1 }),
  });

  view.setLandingY(layout.landingY);
  welcomeHeading.style.top = `${layout.headingTopPx}px`;
}
```

At the end of `applyViewportSize()`, after `view.resize(width, height)`, call the composition
before sizing the dock button:

```js
  applyWelcomeComposition(width, height);
  applyDockButtonBox();
```

In `frame()`, pass the live landing endpoint to the entrance:

```js
  const entrance = entranceState(elapsed, {
    ...ENTRANCE,
    startY: view.startY,
    endY: view.landingY,
  });
```

Pass the same endpoint into `dockState()`:

```js
    const step = dockState(nav.phase === 'shrinking' ? progress : 1 - progress, {
      restY: view.landingY,
      dockY: view.dockY,
      dockScale: view.dockScale,
      yaw: transitionYaw,
      settleYaw: SETTLE.yaw,
      spinRevolutions: transitionSpin,
    });
```

The heading must participate in layout measurement without becoming visible. In the
successful-renderer block, set `welcomeHeading.hidden = false` before the first
`applyViewportSize()` call; base CSS still keeps it visually hidden:

```js
if (renderer) {
  welcomeHeading.hidden = false;
  welcomeHeading.addEventListener('animationend', handleWelcomeAnimationEnd);

  applyViewportSize();
  window.addEventListener('resize', applyViewportSize);

  mountContent(nav.route);
  applyDom();

  input.attach();
  requestAnimationFrame(frame);
}
```

Do not move `hidden = false` outside this block: a renderer failure must preserve the blank
off-white fallback. Do not add per-frame DOM measurement; only boot and resize recalculate
the composition.

- [ ] **Step 5: Apply visual and semantic state from `applyDom()`**

Add this function immediately before `applyDom()`:

```js
function applyWelcomeDom() {
  welcomeHeading.dataset.mode = welcomeState.mode;
  const isLandingHeading =
    nav.route === null && (nav.phase === 'entering' || nav.phase === 'resting');
  welcomeHeading.setAttribute('aria-hidden', String(!isLandingHeading));
}
```

Call it as the first line inside `applyDom()`:

```js
function applyDom() {
  applyWelcomeDom();
```

The initial landing heading is therefore accessible while visually waiting. During content,
the content-nav overlay, and landing expansion it is removed from the accessibility tree.

- [ ] **Step 6: Reduce welcome state with every accepted nav transition**

At the top of `onNavChange(previous, next)`, before calculating `startedTransition`, add:

```js
  welcomeState = reduceWelcome(welcomeState, previous, next);
```

Do not call this from ignored navigation events: `dispatch()` already returns before
`onNavChange()` when `nav === previous`. This preserves the initial pending reveal until a
real transition occurs.

- [ ] **Step 7: Settle CSS animations without accepting stale completions**

Add this function before the `if (renderer)` boot block:

```js
function handleWelcomeAnimationEnd(event) {
  if (event.target !== welcomeHeading) return;

  let completedMode = null;
  if (event.animationName === 'welcome-exit') completedMode = 'exiting';
  if (
    event.animationName === 'welcome-reveal' ||
    event.animationName === 'welcome-reveal-reduced'
  ) {
    completedMode = 'revealing';
  }
  if (completedMode === null) return;

  const next = completeWelcomeAnimation(welcomeState, completedMode);
  if (next === welcomeState) return;
  welcomeState = next;
  applyWelcomeDom();
}
```

The successful-renderer block in Step 4 attaches this listener before the animation can
start. Stale completions remain harmless because `completeWelcomeAnimation()` compares the
completed mode with the current state.

- [ ] **Step 8: Run automated regression checks**

Run:

```powershell
npm test -- tests/welcome.test.js
npm test
npm run build
git diff --check
```

Expected:

- 9 welcome lifecycle tests pass.
- Full suite reports 16 passing test files and 239 passing tests.
- Vite production build succeeds.
- `git diff --check` reports no whitespace errors.

- [ ] **Step 9: Verify the browser lifecycle and semantics**

Start the app:

```powershell
npm run dev
```

Use the local browser and verify this sequence:

1. Load `#/`. Before 3.5 seconds, the element exists with `data-mode="waiting"`, opacity 0,
   and `aria-hidden="false"`.
2. At 3.5 seconds, it changes to `revealing` with no delay. After 750ms it becomes `visible`
   and stays motionless through at least one full 5-second cube bob.
3. Drag and coast the cube through a full yaw. The heading does not move, highlight behavior
   is unchanged, and pointer events still target the canvas.
4. Tap a routed face. The heading immediately gets `aria-hidden="true"`, plays only the
   200ms opacity exit, and does not delay the 0.9-second docking/content transition.
5. Press the docked cube to open the large navigation overlay. `Welcome` remains hidden even
   though the nav phase is `resting`.
6. Return to `#/` with history navigation. It stays hidden through `expanding`, then becomes
   `visible` without a reveal when `resting` begins.
7. Reload `#/`; the initial reveal plays again.
8. Load `#/work` directly, then navigate to `#/`; the first landing visit is immediate after
   expansion, with no initial reveal.
9. Change the hash away from landing before the entrance completes. Reconciliation must not
   paint a one-frame welcome flash over the content route.
10. In the accessibility tree, confirm `Welcome` is the landing `<h1>`, has no live-region
    role, and is excluded whenever a content `<h1>` is relevant. The hidden navigation stays
    first in focus order.
11. Resize once during the entrance and once during shrink/expansion. The live landing target
    updates to the new composition, and transition completion produces no position jump.

Enable `prefers-reduced-motion: reduce`, reload `#/`, and verify the cube entrance is still
3.5 seconds while the welcome uses a 150ms opacity-only reveal with no translation or clip
animation.

- [ ] **Step 10: Verify responsive composition and local font loading**

At each viewport below, let the float reach its upper peak and sweep the cube through 360
degrees of horizontal yaw:

```text
1920 x 1080
1440 x 900
1000 x 1000
390 x 844
280 x 1000
844 x 390
```

For every viewport, inspect screenshots and computed styles. Confirm:

- `Welcome` remains one line, centered, fully on-screen, and visually large.
- The midpoint from the heading's rendered top to the neutral cube's rendered bottom is
  within 2 CSS pixels of the viewport midpoint.
- The neutral gap resolves to `clamp(2rem, 5vmin, 4rem)` and the settled cube spans 43–44%
  of the smaller viewport dimension.
- Its rendered lower edge stays at least 16 CSS pixels above the cube's uppermost rendered
  pixel throughout the yaw/float sweep.
- Computed `font-family` begins with `Geist`; body copy is weight 400, content headings 500,
  and welcome 450.
- The font request is same-origin `/fonts/Geist-Variable.woff2` and no font-CDN request occurs.
- Content pages retain readable wrapping, no horizontal overflow, and their current spacing
  hierarchy.

Use browser request blocking to block `/fonts/Geist-Variable.woff2`, reload, and confirm the
system fallback stays readable without delaying or replaying the welcome. Launch a browser
with WebGL disabled, reload `#/`, and confirm the page remains blank off-white with the
heading's `hidden` attribute intact.

- [ ] **Step 11: Commit the DOM and animation integration**

```powershell
git add -- index.html src/style.css src/main.js
git commit -m "feat: reveal landing welcome"
```

---

### Task 6: Update the spec of record and finish verification

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:**

- Consumes: shipped behavior and verified values from Tasks 1-5.
- Produces: durable project documentation that allows one visible landing heading, records
  its centered composition and lifecycle, records the new framing/overlap values, and names
  self-hosted Geist as the site-wide typeface.

- [ ] **Step 1: Add the landing heading requirement to `AGENTS.md`**

Append this as landing-page requirement 8 after the docked-navigation requirement:

```markdown
8. After the initial entrance finishes, one large DOM heading, `Welcome`, reveals above the
   cube with a 750 ms masked upward fade, then remains visible and motionless. The heading and
   neutral settled cube are vertically centered as one responsive stack with a
   `clamp(2rem, 5vmin, 4rem)` nominal gap. The heading is not a 3D object and never tracks the
   cube's float. It fades out when navigation begins, stays hidden over content and the nav
   overlay, and returns without replaying its reveal.
```

- [ ] **Step 2: Record the amended framing, landing, and float constraints in `AGENTS.md`**

Make these exact decision updates:

- In the landing-page entrance table, change the Position end from `centered on screen` to
  `at the responsive group anchor below viewport center`.
- In the Entrance decision, retain `startSpin = 4.5` and replace the `FIT_MARGIN = 1.6`
  measurements with the `FIT_MARGIN = 1.9` measurements: ceilings `5.54` landscape, `4.92`
  at 9:16, and `4.74` at 9:19.5; the worst shipped rate is `42.7°/frame` at 30 fps.
- In Idle float, change `overlap` from `0.7` to `0.65` seconds, onset progress from `p = 0.80`
  to `p = 0.814`, and record that the 280 × 1000 entrance-tail-plus-float peak is `0.07758`
  world units. Replace the old `floatOffset(3.5) = 0.0277430` consequence with
  `floatOffset(3.5) = 0.0233616`. Remove the obsolete claim that `0.7` is the active ceiling.
- Replace the Cube size decision's `FIT_MARGIN = 1.6` with `FIT_MARGIN = 1.9`, and replace
  the 51% silhouette claim with 43–44% of the smaller viewport dimension.
- Record that the entrance, resting state, and both dock directions read one responsive
  landing Y derived from the heading line box, nominal gap, and projected settled cube.
- In the dock decision, replace the assumption that travel begins at world-space `y = 0`
  with the responsive landing Y; keep `DOCK.silhouettePx = 64` and every dock timing/yaw
  value unchanged.

The rewritten Idle float decision must retain the existing C² onset explanation, amplitude,
period, and smooth-step ramp. Use this replacement for its timing-and-bound paragraph:

```markdown
  The smooth-step amplitude envelope runs for `rampDuration` 1.5 s and starts `overlap`
  0.65 s before the entrance ends, at entrance progress `p = 0.814`. Its zero position and
  first derivative at onset preserve the existing C² handoff; amplitude remains 0.08 world
  units and period remains 5.0 s. With `FIT_MARGIN` 1.9 and the responsive landing Y, the old
  0.7 s overlap would produce a 0.09322-unit entrance-tail-plus-float displacement at
  280 × 1000, beyond the 0.08-unit bound. At 0.65 s the reference matrix peaks at 0.07758.
  Consequently `floatOffset(3.5)` is `0.0233616`, not zero; the neutral composition anchor
  is still defined at zero float while the live cube continues through the overlap.
```

- [ ] **Step 3: Amend the page and typography decisions in `AGENTS.md`**

Replace the sentence beginning `No *visible* DOM text on the landing page` in the Page
decision with:

```markdown
  The landing page has exactly one visible DOM heading, `Welcome`, above the cube. No other
  visible landing copy, nav text, breadcrumbs, or menu is present. The document still carries
  a `<nav>` of five links, visually hidden with `clip-path` but focusable and placed first so
  it doubles as skip navigation. The heading and neutral cube are vertically centered as one
  responsive composition; the heading remains fixed while the cube floats.
```

Add this decision immediately after the Page decision:

```markdown
- **Typography:** Geist Sans is the site-wide primary typeface, self-hosted as the official
  variable WOFF2 under the SIL Open Font License. Body copy remains weight 400, content
  headings remain 500, and the landing `Welcome` uses 450. The existing system stack is a
  loading/error fallback only; the site makes no font-CDN request.
```

In Out of Scope, replace `Visible nav text, breadcrumbs, or a menu` with `Additional visible
landing copy, visible nav text, breadcrumbs, or a menu` so the welcome heading is not
accidentally outlawed.

- [ ] **Step 4: Update `README.md` behavior and project layout**

Replace the README's first paragraph with:

```markdown
Minimal, geometric portfolio. A single cube enters from off-screen top, grows and slows into
a responsive landing anchor below viewport center over 3.5 seconds, then holds its pose while
a gentle vertical drift ramps in out of the arrival. When it lands, a large Geist `Welcome`
heading reveals above it. Their neutral bounds form one vertically centered responsive
composition with a deliberate gap; the heading stays motionless while the cube continues to
float. Later returns show the heading immediately without replaying the reveal. Drag the cube
horizontally to spin it; let go mid-swipe and it coasts to a stop.
```

Add these entries to the Layout list:

```markdown
- `src/welcome.js` — pure presentation lifecycle for the landing heading; it distinguishes
  the true landing route from the large cube used as a content-page nav overlay.
- `src/composition.js` — pure CSS-pixel composition math that centers the heading and
  projected cube together and derives the cube's responsive landing anchor.
- `public/fonts/` — the locally hosted Geist Sans variable WOFF2 and its SIL Open Font
  License.
```

Add this paragraph at the start of Design direction, after its heading:

```markdown
Geist Sans is the site-wide primary typeface, served locally with no font-CDN dependency. The
landing page has one visible DOM heading, `Welcome`; the hidden route navigation remains an
accessibility affordance rather than a visible menu.
```

- [ ] **Step 5: Scan the spec of record for contradictions**

Run:

```powershell
rg -n "no \*visible\* DOM text|No visible DOM text|system-ui.*primary|Visible nav text|FIT_MARGIN.*1\.6|overlap.*0\.7|centered on screen|grows and slows into the center|top: clamp" AGENTS.md README.md docs/specs/2026-09-02-welcome-reveal.md
```

Expected: no stale prohibition, top-anchor instruction, old framing/overlap value, or obsolete
typography claim. The system stack may still appear when explicitly described as a fallback;
the amended spec may mention old values only while explaining why they were replaced.

- [ ] **Step 6: Run final automated verification**

Run:

```powershell
npm test
npm run build
Test-Path 'dist/fonts/Geist-Variable.woff2'
Test-Path 'dist/fonts/OFL.txt'
git diff --check
git status --short
```

Expected:

- 16 test files and 239 tests pass.
- Vite production build succeeds.
- Both public font artifacts are present in `dist/fonts`.
- `git diff --check` prints no errors.
- Status contains only intended task files plus the pre-existing `docs/review.md` change;
  `docs/review.md` remains unstaged.

- [ ] **Step 7: Re-run the final browser acceptance path against the production build**

Run:

```powershell
npm run preview
```

Repeat the Task 5 lifecycle once on desktop normal motion, once at 390 x 844, and once with
reduced motion. Confirm the production build—not only the dev server—loads Geist locally,
centers the neutral heading/cube bounds within 2 CSS pixels with the approved gap, keeps at
least 16 pixels of live clearance, hides the heading from content/nav-overlay states, and
does not replay it on landing return.

- [ ] **Step 8: Commit the documentation**

```powershell
git add -- AGENTS.md README.md
git commit -m "docs: record centered welcome"
```

---

## Final Acceptance Matrix

- [ ] A fresh landing load keeps `Welcome` visually hidden through the full 3.5-second cube
  entrance while exposing it as the landing page's semantic `<h1>`.
- [ ] `entranceDone` starts the 750ms masked upward opacity reveal with no delay.
- [ ] The heading settles completely still and remains visible while the cube floats, drags,
  coasts, and highlights faces independently.
- [ ] The neutral heading-plus-cube bounds are vertically centered within 2 CSS pixels at all
  six reference viewports, with a nominal `clamp(2rem, 5vmin, 4rem)` gap.
- [ ] `FIT_MARGIN = 1.9` draws the settled cube at 43–44% of the smaller viewport dimension
  while leaving `CUBE_SIZE` and the dock's CSS-pixel size unchanged.
- [ ] The stable heading has at least 16 CSS pixels of separation from the cube at all six
  reference viewports, maximum float, and every horizontal yaw.
- [ ] The entrance, resting state, shrink, and expansion use the latest responsive landing Y
  without a phase-boundary jump, including after resize.
- [ ] `FLOAT.overlap = 0.65` retains the pre-settle handoff and keeps the measured combined
  entrance-tail-plus-float displacement below 0.08 world units.
- [ ] The heading never blocks or changes canvas hover, press, drag, tap, or raycasting.
- [ ] Departure immediately removes the heading from the accessibility tree and fades only
  its opacity for 200ms without delaying navigation.
- [ ] Direct content loads, docked pages, content-route transitions, and the large cube nav
  overlay keep `Welcome` hidden.
- [ ] Landing returns stay hidden through expansion and then show the final heading state
  instantly, including the first landing visit after a content deep link.
- [ ] Reloading landing replays the initial reveal; route/history changes do not cause flashes
  or stale animation completions.
- [ ] Reduced motion keeps the cube entrance policy unchanged and replaces the welcome motion
  with a 150ms opacity-only fade.
- [ ] Geist Sans v1.7.2 is served from the site's own `/fonts` path, applies site-wide at the
  specified weights, retains its OFL text, and falls back safely when blocked.
- [ ] No package dependency, font CDN, JavaScript font loader, 3D text, or extra landing copy
  is introduced.
- [ ] The hidden nav remains first and focusable; content routes retain one relevant `<h1>`
  and existing focus management.
- [ ] A WebGL initialization failure retains the blank off-white page and hidden welcome.
- [ ] `AGENTS.md` and `README.md` describe the delivered behavior without contradicting the
  approved spec.
- [ ] `npm test`, `npm run build`, production preview checks, and `git diff --check` succeed.
