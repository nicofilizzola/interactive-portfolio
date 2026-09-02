# Dock Transition Spin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one whole yaw revolution to every dock transition while preserving the existing dock pose, travel path, timing, content fades, routing, and reduced-motion behavior.

**Architecture:** Keep `dockState(progress, opts)` as the pure source of transition position, scale, and yaw. Position and scale remain on `easeInOutCubic`; yaw combines the existing shortest snap with an integer revolution count and runs on quintic `smootherStep`. `src/main.js` snapshots the configured revolution count once at every transition start, passes it into `dockState`, and folds completed shrinking turns into `yawOffset` so numeric and rendered yaw remain aligned.

**Tech Stack:** Three.js 0.185, Vite 8, Vitest 4, plain JavaScript ES modules. No new dependencies.

**Spec:** `docs/specs/2026-09-01-dock-transition-spin.md`. Read it alongside this plan. Product decision on 2026-09-02: **Option B — every transition spins**.

## Global Constraints

- `DOCK.spinRevolutions` is exactly `1` during normal motion and `0` when `prefers-reduced-motion: reduce` matches.
- Every transition that enters `shrinking` or `expanding` uses the same spin selection. This covers S1, S2, S3, S4, E1, and E2 from spec §8.
- Shrinking runs forward through one positive revolution. Expanding remains the exact reverse of `dockState`, so it unwinds one revolution backward.
- Reduced motion keeps the snap but removes the added revolution. Its yaw uses `smootherStep`; “today's snap-only behavior” means the same bounded snap and endpoint, not the old intermediate easing samples.
- Spin affects yaw only. Pitch remains `SETTLE.pitch`; no bottom-face tumble is introduced.
- `DOCK.duration` stays `0.9`, `DOCK.reducedDuration` stays `0.12`, and position/scale stay on `easeInOutCubic`.
- Do not change dock geometry, content fade timing or curves, entrance, idle float, drag behavior, resting pose, routing, phase machine, colors, materials, routes, or content.
- `spinRevolutions` must remain an integer. Whole revolutions preserve the nearest `SETTLE.yaw + k * 90°` dock pose and prevent a phase-boundary jump.
- At `DOCK.duration = 0.9`, one worst-case 405° turn on `smootherStep` must remain below 45° per frame at 30 fps: expected peak is 843.75°/s, or 28.125°/frame.
- Keep pure dock logic free of DOM, WebGL, and config imports. Pass reduced-motion state and configured revolutions into helpers.
- Preserve the existing testing policy: `src/main.js` and `src/input.js` remain browser-coupled and receive no jsdom unit tests. Test the selection and interpolation seams in `tests/dock.test.js`, then verify composition on the live page.
- Current baseline at `5e8c1da`: `npm test` reports 14 files and 209 passing tests; `npm run build` succeeds.
- Preserve unrelated working-tree changes in `docs/review.md` and the untracked spec. Do not stage files outside each task's explicit list.

---

## File Structure

| File | Responsibility | Planned change |
| --- | --- | --- |
| `src/config.js` | Tunable dock values | Add `DOCK.spinRevolutions: 1` with the 30 fps ceiling and duration coupling documented. |
| `src/easing.js` | Shared easing curves | Add quintic `smootherStep`, with zero velocity and acceleration at both endpoints. |
| `src/dock.js` | Pure dock interpolation and transition policy | Put snap plus whole turns on `smootherStep`; add the Option B `dockSpin(reduced, revolutions)` selector. |
| `src/main.js` | Browser composition and animation loop | Snapshot spin per transition, pass it to `dockState`, and fold completed shrinking turns into `yawOffset`. |
| `tests/dock.test.js` | Headless dock behavior tests | Lock whole-turn endpoints, mirroring, monotonic yaw, rate ceiling, travel isolation, and reduced-motion selection. |
| `tests/easing.test.js` | Headless easing tests | Lock `smootherStep` mapping, clamping, symmetry, monotonicity, and zero endpoint velocity/acceleration. |
| `docs/specs/2026-09-01-dock-transition-spin.md` | Feature design source | Mark Option B resolved so future readers do not follow the old recommendation. |
| `AGENTS.md` | Durable project decisions | Replace the obsolete “snap, do not spin” dock decision with the whole-turn design and limits. |
| `README.md` | User-facing project description | Mention that every dock trip spins and expansions unwind. |

---

### Task 1: Pure dock spin and configuration

**Files:**

- Modify: `tests/dock.test.js`
- Modify: `tests/easing.test.js`
- Modify: `src/config.js`
- Modify: `src/easing.js`
- Modify: `src/dock.js`

**Interfaces:**

- Consumes: `smootherStep(t) -> number`, `easeInOutCubic(t) -> number`, `yawSnapDelta(yaw, settleYaw) -> radians`, and `DOCK.duration`.
- Produces: `DOCK.spinRevolutions: number`; `dockSpin(reduced: boolean, revolutions: number) -> number`; `dockState(progress, { dockY, dockScale, yaw, settleYaw, spinRevolutions? }) -> { y, scale, yaw }`.
- Invariant: omitted `spinRevolutions` defaults to `0`, keeping existing callers and endpoint tests valid until Task 2 wires the new option.

- [ ] **Step 1: Extend imports and constants in the dock test**

Replace the first two imports and constants in `tests/dock.test.js` with:

```js
import { describe, expect, it } from 'vitest';
import { contentFade, dockSpin, dockState, fadeOpacity, yawSnapDelta } from '../src/dock.js';
import { DOCK, SETTLE } from '../src/config.js';

const TAU = Math.PI * 2;
const QUARTER = Math.PI / 2;
const OPTS = { dockY: -2, dockScale: 0.11612, yaw: SETTLE.yaw, settleYaw: SETTLE.yaw };
```

- [ ] **Step 2: Write failing tests for whole-turn interpolation**

Append these cases inside the existing `describe('dockState', ...)` block, before its closing brace:

```js
  it('lands on a resting pose after zero, one, or two whole revolutions', () => {
    for (const spinRevolutions of [0, 1, 2]) {
      for (let degrees = -720; degrees <= 720; degrees += 1) {
        const state = dockState(1, {
          ...OPTS,
          yaw: SETTLE.yaw + (degrees * Math.PI) / 180,
          spinRevolutions,
        });
        const quarterTurns = (state.yaw - SETTLE.yaw) / QUARTER;
        expect(quarterTurns).toBeCloseTo(Math.round(quarterTurns), 9);
      }
    }
  });

  it('adds exactly the requested whole revolution', () => {
    const withoutSpin = dockState(1, { ...OPTS, yaw: SETTLE.yaw + 0.31 });
    const withSpin = dockState(1, {
      ...OPTS,
      yaw: SETTLE.yaw + 0.31,
      spinRevolutions: 1,
    });

    expect(withSpin.yaw - withoutSpin.yaw).toBeCloseTo(TAU, 12);
  });

  it('mirrors yaw exactly when run backwards with a spin', () => {
    for (const spinRevolutions of [0, 1, 2]) {
      const opts = { ...OPTS, yaw: SETTLE.yaw + 0.31, spinRevolutions };
      const turn = yawSnapDelta(opts.yaw, opts.settleYaw) + TAU * spinRevolutions;

      for (let i = 0; i <= 200; i += 1) {
        const p = i / 200;
        const forward = dockState(p, opts);
        const backward = dockState(1 - p, opts);
        expect(forward.yaw + backward.yaw).toBeCloseTo(2 * opts.yaw + turn, 12);
      }
    }
  });

  it('turns monotonically forward when at least one revolution is requested', () => {
    for (const offset of [-QUARTER / 2, 0, QUARTER / 2]) {
      const opts = { ...OPTS, yaw: SETTLE.yaw + offset, spinRevolutions: 1 };
      let previousYaw = dockState(0, opts).yaw;

      for (let i = 1; i <= 1000; i += 1) {
        const yaw = dockState(i / 1000, opts).yaw;
        expect(yaw).toBeGreaterThanOrEqual(previousYaw - 1e-12);
        previousYaw = yaw;
      }
    }
  });

  it('keeps the worst-case spin below the 30 fps strobing ceiling', () => {
    const opts = {
      ...OPTS,
      yaw: SETTLE.yaw - QUARTER / 2,
      spinRevolutions: 1,
    };
    const sampleDuration = DOCK.duration / 1000;
    let previousYaw = dockState(0, opts).yaw;
    let peakRadiansPerSecond = 0;

    for (let i = 1; i <= 1000; i += 1) {
      const yaw = dockState(i / 1000, opts).yaw;
      peakRadiansPerSecond = Math.max(
        peakRadiansPerSecond,
        Math.abs(yaw - previousYaw) / sampleDuration,
      );
      previousYaw = yaw;
    }

    const peakDegreesPerSecond = (peakRadiansPerSecond * 180) / Math.PI;
    expect(peakDegreesPerSecond).toBeCloseTo(843.75, 2);
    expect(peakDegreesPerSecond / 30).toBeLessThan(45);
  });

  it('does not move position or scale onto the yaw curve', () => {
    for (let i = 0; i <= 100; i += 1) {
      const p = i / 100;
      const withoutSpin = dockState(p, OPTS);
      const withSpin = dockState(p, { ...OPTS, spinRevolutions: 1 });
      expect(withSpin.y).toBe(withoutSpin.y);
      expect(withSpin.scale).toBe(withoutSpin.scale);
    }
  });
```

- [ ] **Step 3: Write failing tests for Option B and reduced motion**

Add this block between the `dockState` and `contentFade` describe blocks:

```js
describe('dockSpin', () => {
  it('uses the configured revolutions for every normal-motion transition', () => {
    expect(dockSpin(false, 1)).toBe(1);
    expect(dockSpin(false, 2)).toBe(2);
  });

  it('removes every added revolution under reduced motion', () => {
    // At 0.12 s, one smootherStep revolution plus the worst snap would reach
    // 210.9 degrees per frame at 30 fps. Keep only the bounded snap.
    expect(dockSpin(true, DOCK.spinRevolutions)).toBe(0);
  });
});
```

Option B deliberately gives `dockSpin` no route or phase argument: all six transitions enter the same `startedTransition` block in `src/main.js`, and the answer depends only on reduced motion. Adding unused route arguments would create a false policy distinction.

- [ ] **Step 4: Run the focused test and confirm the red state**

Run:

```bash
npm test -- tests/dock.test.js
```

Expected: FAIL during module import because `src/dock.js` does not export `dockSpin`; after temporarily exporting a stub, the new interpolation tests must still fail because `dockState` ignores `spinRevolutions`.

- [ ] **Step 5: Add and verify quintic `smootherStep`**

Add `smootherStep` to the easing test import, then add:

```js
describe('smootherStep', () => {
  it('maps the unit interval onto itself, symmetric about the midpoint', () => {
    expect(smootherStep(0)).toBe(0);
    expect(smootherStep(1)).toBe(1);
    expect(smootherStep(0.5)).toBe(0.5);
    for (let i = 0; i <= 100; i += 1) {
      const p = i / 100;
      expect(smootherStep(p) + smootherStep(1 - p)).toBeCloseTo(1, 12);
    }
  });

  it('clamps out-of-range input instead of overshooting', () => {
    expect(smootherStep(-1)).toBe(0);
    expect(smootherStep(4)).toBe(1);
  });

  it('leaves and arrives with zero slope and zero acceleration', () => {
    const h = 1e-4;
    const startSlope = (smootherStep(h) - smootherStep(0)) / h;
    const endSlope = (smootherStep(1) - smootherStep(1 - h)) / h;
    const startAcceleration =
      (smootherStep(2 * h) - 2 * smootherStep(h) + smootherStep(0)) / (h * h);
    const endAcceleration =
      (smootherStep(1) - 2 * smootherStep(1 - h) + smootherStep(1 - 2 * h)) /
      (h * h);

    expect(startSlope).toBeLessThan(1e-4);
    expect(endSlope).toBeLessThan(1e-4);
    expect(Math.abs(startAcceleration)).toBeLessThan(0.02);
    expect(Math.abs(endAcceleration)).toBeLessThan(0.02);
  });

  it('rises monotonically', () => {
    let previous = -1;
    for (let i = 0; i <= 100; i += 1) {
      const value = smootherStep(i / 100);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });
});
```

Run `npm test -- tests/easing.test.js` and confirm RED because the export is missing. Then add
this minimal helper to `src/easing.js`:

```js
// Quintic smoothstep. Both velocity and acceleration are zero at each end, so
// the dock spin settles without the angular-acceleration cutoff of smoothStep.
export function smootherStep(t) {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}
```

Run `npm test -- tests/easing.test.js` again. Expected: PASS.

- [ ] **Step 6: Add the configured revolution count**

In `src/config.js`, add `spinRevolutions` after `reducedDuration`:

```js
export const DOCK = {
  duration: 0.9,
  reducedDuration: 0.12,
  // One whole turn keeps 37.5% headroom below the cube's 45-degree-per-frame
  // strobing ceiling at 30 fps: worst case is a 405-degree turn peaking at
  // 843.75 deg/s, or 28.125 deg/frame. The exact cap is 1.675 revolutions at 0.9 s;
  // shortening duration lowers that cap proportionally, so tune them together.
  spinRevolutions: 1,
  silhouettePx: 64,
  maxSilhouetteFraction: 0.16,
  bottomMarginPx: 24,
  contentFadeStart: 0.4,
};
```

Keep the existing `contentFadeStart` comment immediately above that property.

- [ ] **Step 7: Implement the pure spin selector and split easing curves**

Replace the imports and dock-transition portion of `src/dock.js` through `dockState` with:

```js
import { easeInOutCubic, smootherStep } from './easing.js';
import { clamp01, lerp } from './math.js';

const TAU = Math.PI * 2;
const QUARTER_TURN = Math.PI / 2;

// The shortest signed angle from `yaw` to the nearest settleYaw + k * 90 degrees
// — at most 45 degrees either way. The docked cube must remain edge-on so its
// pose and CSS-pixel silhouette stay exact. A transition may add whole turns to
// this snap; whole turns preserve the same final pose.
export function yawSnapDelta(yaw, settleYaw) {
  const offset = yaw - settleYaw;
  // Wrap the offset into (-45, +45] degrees around the nearest quarter turn.
  const wrapped = offset - QUARTER_TURN * Math.round(offset / QUARTER_TURN);
  return -wrapped;
}

// Option B: every dock transition spins unless reduced motion removes the
// decorative revolution. Route and phase do not affect this policy.
export function dockSpin(reduced, revolutions) {
  return reduced ? 0 : revolutions;
}

// Pure dock transition. Position and scale retain easeInOutCubic. Yaw uses
// smootherStep so velocity and acceleration both reach zero at each end while
// staying below the cube's strobing ceiling. Expanding runs this same function
// at 1 - progress and is an exact backward mirror.
export function dockState(progress, opts) {
  const p = clamp01(progress);
  const travel = easeInOutCubic(p);
  const turn =
    yawSnapDelta(opts.yaw, opts.settleYaw) + TAU * (opts.spinRevolutions ?? 0);

  return {
    // The resting Y is 0 (ENTRANCE.endY); the caller adds the float on top.
    y: lerp(0, opts.dockY, travel),
    scale: lerp(1, opts.dockScale, travel),
    yaw: opts.yaw + turn * smootherStep(p),
  };
}
```

Leave `contentFade` and `fadeOpacity` unchanged.

- [ ] **Step 8: Run focused and full tests**

Run:

```bash
npm test -- tests/dock.test.js
npm test
```

Expected after the approved endpoint-softening follow-up: focused dock tests PASS. Full suite reports 14 passing files and 221 passing tests: 209 existing tests, 8 dock-spin cases, and 4 `smootherStep` cases.

- [ ] **Step 9: Commit the pure behavior**

```bash
git add src/config.js src/dock.js tests/dock.test.js
git commit -m "feat: add dock transition spin"
```

---

### Task 2: Wire every transition through the spin

**Files:**

- Modify: `src/main.js`

**Interfaces:**

- Consumes: `dockSpin(reduced, revolutions)`, `DOCK.spinRevolutions`, and the extended `dockState` options object from Task 1.
- Produces: `transitionSpin: number`, a per-transition snapshot used for interpolation and the shrinking completion fold.
- Transition rule: the common `startedTransition` branch selects spin for S1–S4 and E1–E2. No event-specific or route-specific branches are added.

- [ ] **Step 1: Import the selector and define the local full-turn constant**

Replace the dock import with:

```js
import { contentFade, dockSpin, dockState, fadeOpacity, yawSnapDelta } from './dock.js';
```

Add this constant after the imports:

```js
const TAU = Math.PI * 2;
```

- [ ] **Step 2: Add the transition spin snapshot**

Immediately after `transitionYaw`, add:

```js
// Whole revolutions selected when the current dock transition began. Snapshot
// once so a live reduced-motion preference change cannot alter a turn mid-flight.
let transitionSpin = 0;
```

- [ ] **Step 3: Select spin for every transition start**

Change the beginning of `if (startedTransition)` to:

```js
  if (startedTransition) {
    transitionYaw = lastYaw;
    transitionSpin = dockSpin(reducedMotion.matches, DOCK.spinRevolutions);
    swapped = false;
```

Because all six transition shapes pass through this branch, Option B needs no changes in `src/navstate.js`.

- [ ] **Step 4: Fold the full shrinking turn into yaw bookkeeping**

Replace the shrinking completion comment and assignment with:

```js
      // Fold the snap and whole turns in ONCE, so lastYaw keeps agreeing
      // numerically with the drawn pose for every later drag and transition.
      // Whole turns look identical but omitting them would leave the two values
      // separated by exactly TAU * transitionSpin.
      yawOffset +=
        yawSnapDelta(transitionYaw, SETTLE.yaw) + TAU * transitionSpin;
```

Do not add a corresponding fold after `expanding`: reverse playback ends at `dockState(0).yaw === transitionYaw`, already matching the center pose.

- [ ] **Step 5: Pass the snapshot into `dockState`**

Extend the transition options in `frame()`:

```js
    const step = dockState(nav.phase === 'shrinking' ? progress : 1 - progress, {
      dockY: view.dockY,
      dockScale: view.dockScale,
      yaw: transitionYaw,
      settleYaw: SETTLE.yaw,
      spinRevolutions: transitionSpin,
    });
```

Update the nearby comment to state that position/scale mirror through `easeInOutCubic` and yaw mirrors through `smootherStep`; both curves are symmetric about `(0.5, 0.5)`.

- [ ] **Step 6: Run automated regression checks**

Run:

```bash
npm test
npm run build
```

Expected: all 14 test files and 221 tests PASS; Vite production build succeeds. No browser test is added for `src/main.js`, preserving the project's explicit browser-boundary policy.

- [ ] **Step 7: Verify all six transition shapes on the live page**

Start the site:

```bash
npm run dev
```

Verify at normal motion:

1. S1: landing face tap to another route shrinks with one forward revolution.
2. E1: dock button expands with one backward revolution.
3. S2: tapping the face for the route already displayed shrinks with one forward revolution and does not add history.
4. E1 then S3: reopen, press `Escape`; shrinking dismissal spins forward and leaves route/history unchanged.
5. E1 then S3: reopen, tap canvas background; shrinking dismissal spins forward and leaves route/history unchanged.
6. S4: while cube is centered over content, change hash/back-forward to another content route; shrinking navigation spins forward.
7. E2: from a docked content route, navigate back to `#/`; expansion unwinds one revolution backward and lands at center without a visible jump.

Also verify the existing non-transition case: back/forward directly between two content routes while already docked remains `docked -> docked`, so no transition and no spin plays.

In DevTools, enable `prefers-reduced-motion: reduce` and repeat one shrinking and one expanding case. Expected: 0.12 s transition, bounded snap only, no full revolution.

At each phase boundary, watch for a one-frame pose jump. Expected: none. Docked silhouette and edge-on pose remain visually unchanged.

- [ ] **Step 8: Commit browser composition**

```bash
git add src/main.js
git commit -m "feat: spin every dock transition"
```

---

### Task 3: Record the selected behavior and finish verification

**Files:**

- Modify: `docs/specs/2026-09-01-dock-transition-spin.md`
- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:**

- Consumes: shipped behavior from Tasks 1–2 and the product owner's Option B decision.
- Produces: durable documentation matching code: all six transitions spin, expansions unwind, and reduced motion suppresses whole revolutions.

- [ ] **Step 1: Resolve the spec's open decision**

In `docs/specs/2026-09-01-dock-transition-spin.md`, change the status to:

```markdown
**Status:** approved — Option B selected on 2026-09-02; every transition spins.
```

Change the §8 heading to:

```markdown
## 8. Decision — every transition spins (Option B)
```

Add this paragraph immediately below the heading, before the transition table:

```markdown
**Resolved on 2026-09-02: Option B.** All six transition shapes use one whole revolution.
Shrinking transitions turn forward; expanding transitions run the exact mirror and unwind
backward. `prefers-reduced-motion` still overrides the choice with zero revolutions.
```

Change “Resolve this before writing the plan” to:

```markdown
This decision fixes the helper signature to `dockSpin(reduced, revolutions)`: routes and
phases are irrelevant because every transition receives the same answer.
```

- [ ] **Step 2: Replace the obsolete dock decision in `AGENTS.md`**

Replace the final sentence of the “The dock is a CSS-pixel size” decision, beginning with “The dock transition runs”, with:

```markdown
  resize. Position and scale run on `easeInOutCubic` over `DOCK.duration` 0.9 s. Every
  shrinking or expanding transition also turns through one whole yaw revolution on
  quintic `smootherStep`, plus the shortest snap to `SETTLE.yaw + k·90°`. Whole revolutions
  preserve the edge-on dock pose and exact 64 px silhouette; `smootherStep` brings angular
  velocity and acceleration to zero at both ends and limits the worst 405° turn to
  843.75°/s, or 28.125° per frame at 30 fps. Expanding is the exact backward mirror. Under
  `prefers-reduced-motion`, the added revolution is removed and only the snap remains.
```

- [ ] **Step 3: Update the README navigation description**

Replace the first sentence of the second paragraph in `README.md` with:

```markdown
The cube is also the navigation. Every trip between the large nav pose and the bottom-centre
dock includes one whole yaw revolution: shrinking turns forward and expanding unwinds the
same turn backward. Tap a face and the cube travels to the dock while that section's page
arrives; press the docked cube and it comes back up over the page as a nav overlay.
```

Keep the paragraph's existing five-section, bottom-face, and hash-routing sentences after this replacement.

- [ ] **Step 4: Scan documentation for contradictions and placeholders**

Run:

```bash
rg -n "one open decision|Resolve this before|rather than spinning|TBD|TODO|implement later" docs/specs/2026-09-01-dock-transition-spin.md AGENTS.md README.md
```

Expected: no obsolete decision or placeholder matches. Existing unrelated uses of “snap” may remain only when they describe the snap added to the whole revolution or reduced-motion snap-only behavior.

- [ ] **Step 5: Run final verification**

Run:

```bash
npm test
npm run build
git diff --check
git status --short
```

Expected:

- 14 test files and 221 tests pass.
- Vite production build succeeds.
- `git diff --check` prints no errors.
- Status contains only intended task files plus pre-existing unrelated changes; do not stage `docs/review.md` unless the user separately requests it.

- [ ] **Step 6: Commit documentation**

```bash
git add docs/specs/2026-09-01-dock-transition-spin.md AGENTS.md README.md
git commit -m "docs: record dock transition spin"
```

---

## Final Acceptance Matrix

- [ ] Every S1–S4 shrinking transition makes one positive full revolution plus the bounded snap.
- [ ] Every E1–E2 expanding transition unwinds the exact mirrored revolution backward.
- [ ] Reduced motion uses zero full revolutions and retains the snap endpoint.
- [ ] Dock endpoint remains an exact `SETTLE.yaw + k * 90°` pose for start yaws across ±720°.
- [ ] Dock silhouette, position, scale, pitch, duration, and content fades remain unchanged.
- [ ] Worst-case normal-motion yaw stays below 45° per frame at 30 fps; measured target is 28.125°.
- [ ] Shrinking completion has no numeric or visible yaw discontinuity after folding snap plus whole turns.
- [ ] Expanding completion needs no fold and has no visible discontinuity.
- [ ] Direct `docked -> docked` content history changes still play no transition.
- [ ] `npm test`, `npm run build`, and `git diff --check` succeed.
