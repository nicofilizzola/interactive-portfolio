# Minimal Cube and Drag-to-Spin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invert the landing page's character — strip the cube to a bare gray mesh in a
roomier frame, stop every automatic rotation, replace the pointer-follow parallax with a
gentle vertical float, and hand the horizontal spin to the viewer as a drag with momentum.

**Architecture:** Five independent changes plus one induced retune, all post-entrance
except the framing. Rotation stops being autonomous: `ENTRANCE.endSpin` drops to `0` so
the entrance's existing `easeOutQuart` decay curve terminates at a standstill (its
derivative is zero at `p = 1`, so the arrest is smooth and needs no extra easing), and the
`idleRevolutions` term is deleted from `entranceRotation`. A new pure `floatOffset(elapsed,
opts)` in `src/animation.js` supplies the only remaining autonomous motion, phase-anchored
to the entrance duration so it is exactly `0` until the cube has landed. A new pure
`src/drag.js` — a factory in the same shape as the deleted `src/parallax.js`, no `three`
import, no DOM access — owns the drag model: yaw accumulation, a once-per-frame smoothed
release-velocity estimate, and an exponential coast reusing `dampTowards` from
`src/math.js`. `src/main.js` stays the only browser-coupled file and keeps sole ownership
of the pointer events.

**Tech Stack:** Three.js 0.185 (WebGL), Vite 8 (dev server + build), Vitest 4 (unit tests),
plain JavaScript ES modules. No new dependencies. No TypeScript.

**Spec:** `docs/specs/2026-08-31-minimal-cube-and-drag.md` — read it alongside this plan.
Its `docs/review.md` predecessor is superseded; the previous spec
`docs/specs/2026-08-28-cube-pose-and-spin.md` shipped as `1433cf7` and this work
retroactively overrides its section-7 choice.

**Spec section 13 decisions, resolved by the product owner on 2026-08-31:**

| # | Question | Answer |
| --- | --- | --- |
| 13.1 | Cube size — `FIT_MARGIN` | **`1.6`** (not the spec's proposed 1.9) — the milder shrink, 60.5% -> 51.0% of the smaller viewport dimension |
| 13.2 | Edge outline | **Reading B — delete the outline entirely.** Bare flat-shaded gray mesh, no `LineSegments`, no `Group`, no `polygonOffset`, `COLORS.edge` removed |
| 13.3 | Drag sensitivity | **`revsPerViewport: 1.0`** — one revolution per screen-min-dimension of drag |
| 13.4 | Drags during the entrance | **Ignored** — `pointerdown` is gated on the entrance being done |
| 13.5 | Float amplitude / period | **`0.08` world units / `5.0` s** |

## Global Constraints

- **Language:** plain JavaScript, ES modules. No TypeScript. No new dependencies — all
  arithmetic is hand-written.
- **Runtime floor:** Node `^20.19.0 || >=22.12.0`. Tests run under Vitest in plain Node —
  no browser, no WebGL, no jsdom.
- **`src/main.js` is the only browser-coupled file.** `src/drag.js` must not import `three`
  and must not touch `window`, `document`, or any event API. Every other module stays
  unit-testable in plain Node.
- **Do not touch** `src/camera.js`, `src/math.js`, `src/easing.js`, `index.html`, or
  `vite.config.js`. `src/scene.js` is untouched too — only `tests/scene.test.js` changes.
- **`CUBE_SIZE` stays `1.6`.** It is *not* the size knob: `src/scene.js:28` derives the
  camera distance from `CUBE_RADIUS * FIT_MARGIN`, so the camera pulls back in exact
  proportion to any change in `CUBE_SIZE` and the projected size is invariant. Changing it
  produces a pixel-identical page. **`FIT_MARGIN` is the only knob that changes what the
  viewer sees.**
- **Keep `easeOutQuart` as the spin-decay curve.** The `(1 - p)^5 / 5` term in
  `entranceRevolutions` is its antiderivative; changing the easing invalidates the closed
  form and the exact landing pose.
- **Keep three's default `XYZ` Euler order and roll at `0`.** Any other order makes the
  15-degree tilt wobble as the cube turns.
- **The entrance is otherwise unchanged:** 3.5 s duration, `easeOutCubic` position and
  scale curves, `startScale` 0.15, `SETTLE` pose, `ENTRANCE_TUMBLE_RATIO` 0.35.
  `startSpin` moves only as far as the strobing ceiling requires (Task 2).
- **`entranceState()` keeps returning `spinSpeed` and `progress`** even though `main.js`
  stops consuming either. The existing tests read them and they document the curve.
- **45 degrees of yaw per rendered frame is the hard legibility ceiling.** A cube's yaw is
  90-degree rotationally symmetric, so past that a spin reads as running backwards. The
  reference frame rate is 30 fps (throttled tab, low-power mode), i.e. 3.75 rev/s.
- **`prefers-reduced-motion` remains deliberately unhandled.** Do not add a reduced-motion
  branch. (The float bob is now the page's only autonomous motion, so the exposure is
  smaller than it was, but the decision is unchanged.)
- **No DOM text, no hint text, no icon, no nudge animation, no new pages, routes, content,
  or 3D objects.** No vertical drag, no pinch zoom, no scroll interaction, no click or tap
  behavior, no snap-back to the edge-on pose, no rotation limits.
- **Every task ends with a commit**, Conventional Commits style (`feat:`, `refactor:`,
  `docs:`).

## Known spec errata

Two places in the spec would break the entrance if followed literally. Both are corrected
in this plan; do not "fix" the plan back toward the spec.

1. **Spec section 3's collapsed snippet and section 11's `main.js` row both say the pitch
   becomes the constant `SETTLE.pitch`.** It must stay `rotation.pitch` from
   `entranceRotation`. The pitch equals `SETTLE.pitch` only *after* the entrance; during
   the entrance it carries the vertical tumble (`ENTRANCE_TUMBLE_RATIO`, explicitly
   unchanged by spec section 9). Hard-coding `SETTLE.pitch` would delete the tumble.
2. **Spec section 12 test 8 ("five `update()` calls with no movement... under 1% of a
   revolution") does not hold at `velocityTau` 0.06.** Five frames at 1/60 s decay the
   velocity only to `exp(-0.0833 / 0.06)` = 25% of the release speed, which coasts about
   12% of a revolution. The test in Task 4 holds the pointer still for **0.3 s** instead,
   where the decay is `exp(-5)` = 0.67% and the coast is under 0.4% of a revolution. Same
   intent, arithmetic that actually passes.

## File Structure

| File | Change | Task |
| --- | --- | --- |
| `src/animation.js` | Append pure `floatOffset(elapsed, opts)`; delete the `idleRevolutions` term from `entranceRotation` | 1, 2 |
| `src/config.js` | Add `FLOAT`; `FIT_MARGIN` 1.35 -> 1.6; `startSpin` 5.0 -> 4.5; `endSpin` 0.035 -> 0; rewrite the `startSpin` comment; drop `COLORS.edge`; add `DRAG`; delete `PARALLAX` | 1, 2, 3, 4, 5 |
| `src/cube.js` | Collapse the `Group` + `LineSegments` + `polygonOffset` to a bare flat-shaded `Mesh` named `cube` | 3 |
| `src/drag.js` | **New.** Pure factory `createDragSpin({...}) -> { start, move, end, update }`. No `three`, no DOM | 4 |
| `src/parallax.js` | **Delete** | 5 |
| `src/main.js` | Drop the parallax instance and its five listeners; add `floatOffset` to `y`; add the drag instance and the pointer-capture event block | 5, 6 |
| `src/style.css` | `touch-action: none` (required for touch drags), `cursor: grab` / `:active grabbing` on `#scene` | 6 |
| `tests/animation.test.js` | Add a `floatOffset` block; amend four `entranceRevolutions`/`entranceRotation` cases | 1, 2 |
| `tests/scene.test.js` | `PARALLAX.maxOffset` -> `FLOAT.amplitude` in the framing headroom assertion | 2 |
| `tests/cube.test.js` | Rewritten for a bare `Mesh` | 3 |
| `tests/drag.test.js` | **New.** Ten cases | 4 |
| `tests/parallax.test.js` | **Delete** | 5 |
| `AGENTS.md`, `README.md` | Amend every statement this work contradicts | 7 |

Why `floatOffset` lives in `animation.js` rather than a new module: it is the same subject
as `entranceState` — the cube's motion as a pure function of elapsed time — it shares the
`(elapsed, opts)` convention, and it reuses the file's existing `TAU`. Files that change
together live together.

Why `drag.js` is a new module rather than more of `animation.js`: it is stateful (yaw,
velocity, press latch) where everything in `animation.js` is a pure function of elapsed
time. It replaces `parallax.js` one-for-one in the architecture and keeps the same factory
shape, so `main.js`'s ownership of events is unchanged.

**Task order matters.** Task 1 must precede Task 2 (Task 2's `scene.test.js` amendment
imports `FLOAT`). Task 4 must precede Task 6 (`main.js` imports `createDragSpin`). Task 5
must precede Task 6 (Task 6 edits the `main.js` that Task 5 rewrites).

---

### Task 1: `floatOffset` — the idle vertical bob

The cube's only remaining autonomous motion after this work. A pure sine of the time
*since the entrance ended*, so it is exactly `0` throughout the entrance and at the instant
the entrance ends — no positional jump at the handover.

Nothing is wired up in this task. `main.js` starts calling it in Task 5.

The bob starts at zero displacement but non-zero velocity (`A * 2PI / T` = 0.100 u/s),
while the entrance arrives with zero vertical velocity (`easeOutCubic`'s derivative is 0 at
`p = 1`). That is a velocity step of 0.100 u/s against an entrance peak of 3.6 u/s — 2.8%,
below the threshold of visibility. **Do not add a ramp for it.**

Peak-to-peak travel is `2 * 0.08` = 0.16 world units, which is 10% of the cube's edge
length. Defining the amplitude against the cube rather than the viewport is deliberate:
Task 2 moves the camera, and a viewport-relative amplitude would silently change the read.

**Files:**
- Modify: `src/config.js` (add a `FLOAT` block after `ENTRANCE`)
- Modify: `src/animation.js` (append after `entranceRotation`, so the existing `TAU` at
  `:33` is already initialized above it)
- Test: `tests/animation.test.js` (append a new `describe` block at the end of the file)

**Interfaces:**
- Consumes: the module-level `TAU` already declared in `src/animation.js:33`.
- Produces: `floatOffset(elapsed, opts) -> number` — a world-unit Y offset, where `opts` is
  `{ duration, amplitude, period }`. `duration` is the *entrance* duration, not the float's;
  the float's own cycle length is `period`. Returns `0` for every `elapsed <= duration`,
  including negative `elapsed`.
- Produces: `FLOAT` exported from `src/config.js` as `{ amplitude, period }`. It does **not**
  carry `duration` — `main.js` assembles the call options from `FLOAT` and
  `ENTRANCE.duration`, the same way it already assembles `ROTATION`.

- [ ] **Step 1: Write the failing tests**

Append to the end of `tests/animation.test.js`:

```js
describe('floatOffset', () => {
  const FLOAT_OPTS = { duration: 3.5, amplitude: 0.08, period: 5.0 };

  it('is exactly zero for the whole entrance, so the handover has no jump', () => {
    expect(floatOffset(0, FLOAT_OPTS)).toBe(0);
    expect(floatOffset(1.75, FLOAT_OPTS)).toBe(0);
    expect(floatOffset(FLOAT_OPTS.duration, FLOAT_OPTS)).toBe(0);
  });

  it('treats negative elapsed time as the start of the entrance', () => {
    expect(floatOffset(-2, FLOAT_OPTS)).toBe(0);
  });

  it('rises first: a quarter period past the entrance is the top of the bob', () => {
    const quarter = FLOAT_OPTS.duration + FLOAT_OPTS.period / 4;
    expect(floatOffset(quarter, FLOAT_OPTS)).toBeCloseTo(FLOAT_OPTS.amplitude, 9);
  });

  it('crosses centre at the half period and bottoms out at three quarters', () => {
    const half = FLOAT_OPTS.duration + FLOAT_OPTS.period / 2;
    const threeQuarters = FLOAT_OPTS.duration + (3 * FLOAT_OPTS.period) / 4;
    expect(floatOffset(half, FLOAT_OPTS)).toBeCloseTo(0, 9);
    expect(floatOffset(threeQuarters, FLOAT_OPTS)).toBeCloseTo(-FLOAT_OPTS.amplitude, 9);
  });

  it('never exceeds the amplitude, out to ten minutes', () => {
    for (let i = 0; i <= 1000; i += 1) {
      const t = (i / 1000) * 600;
      expect(Math.abs(floatOffset(t, FLOAT_OPTS))).toBeLessThanOrEqual(FLOAT_OPTS.amplitude);
    }
  });

  it('is continuous across the entrance boundary', () => {
    expect(floatOffset(FLOAT_OPTS.duration + 1e-9, FLOAT_OPTS)).toBeCloseTo(0, 6);
  });
});
```

And extend the import on `tests/animation.test.js:2` to pull in the new function:

```js
import {
  entranceRevolutions,
  entranceRotation,
  entranceState,
  floatOffset,
} from '../src/animation.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/animation.test.js`
Expected: FAIL — `floatOffset is not a function`.

- [ ] **Step 3: Add the `FLOAT` config block**

In `src/config.js`, immediately after the closing `};` of the `ENTRANCE` block:

```js
// The idle vertical bob: the page's only autonomous motion once the entrance
// ends. `amplitude` is in world units, deliberately sized against the cube
// (0.16 peak-to-peak = 10% of CUBE_SIZE) rather than against the viewport, so
// that changing FIT_MARGIN does not silently change how large the bob reads.
export const FLOAT = {
  amplitude: 0.08,
  period: 5.0,
};
```

- [ ] **Step 4: Implement `floatOffset`**

Append to the end of `src/animation.js`:

```js
// The idle vertical bob, phased from the end of the entrance rather than from
// page load. `since` is clamped at 0, so this returns exactly 0 for the whole
// entrance and the cube always begins its float moving upward from centre.
// The velocity step at the handover (amplitude * TAU / period = 0.100 u/s
// against an entrance peak of 3.6 u/s) is 2.8% and is deliberately not ramped.
export function floatOffset(elapsed, opts) {
  const since = Math.max(0, elapsed - opts.duration);
  return opts.amplitude * Math.sin((TAU * since) / opts.period);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tests/animation.test.js`
Expected: PASS, all cases including the pre-existing ones.

- [ ] **Step 6: Commit**

```bash
git add src/config.js src/animation.js tests/animation.test.js
git commit -m "feat: add the idle vertical float offset"
```

---

### Task 2: Retune the entrance — roomier frame, spin decays to a standstill

Three coupled config numbers and one deletion. They are one task because they are
arithmetically chained: `FIT_MARGIN` sets when the cube enters frame, which sets the
ceiling on `startSpin`, and `startSpin` together with `endSpin` sets the total revolution
count that one existing test asserts. Splitting them would leave an intermediate commit
whose entrance strobes on a tall phone.

**Why `endSpin` goes to `0` rather than just deleting the idle term.** `endSpin` has two
jobs today: it is the terminal value of the entrance's spin-decay curve *and* the idle
drift rate. Deleting only the idle term while leaving `endSpin` at 0.035 would step the
angular velocity from 12.6 deg/s to 0 in a single frame at exactly the moment the eye is
watching the cube settle. With `endSpin = 0` the decay curve itself lands on zero, and
because `easeOutQuart` has zero derivative at `p = 1` the cube glides to a stop. The
`idleRevolutions` deletion is then a no-op numerically — it is done anyway so the *intent*
is explicit and so `endSpin` can be retuned later without resurrecting the drift.

**The landing pose is unaffected.** `entranceRotation` is written backwards from
`settleYaw`, so any revolution count lands on the same pose — `tests/animation.test.js:129`
already asserts this across `startSpin` of 3, 5, and 8.

**Why `startSpin` has to move.** A larger `FIT_MARGIN` means a larger `startY`, so the cube
crosses into frame *earlier in normalized progress*, when `easeOutQuart` has cut away less
of the peak spin. Re-measured at `FIT_MARGIN` 1.6 with the entrance's scale ramp included
(the cube is at 15% scale at `t = 0`, so it clears the frame edge far longer than position
alone suggests):

| Viewport | Entry @1.35 -> @1.6 | Yaw/frame @30 fps, `startSpin` 5.0 | 30 fps ceiling on `startSpin` |
| --- | --- | --- | --- |
| 16:9 | 0.388 s -> 0.358 s | 39.0 deg | 5.78 |
| 9:16 | 0.287 s -> 0.258 s | 44.2 deg | 5.10 |
| 9:19.5 phone | 0.254 s -> 0.227 s | **45.9 deg** | **4.90** |

The shipped 5.0 crosses 45 deg/frame on a tall phone. `4.5` puts the worst case at
41.3 deg/frame with headroom at every aspect. (The @1.35 column reproduces `AGENTS.md`'s
recorded figures, which validates the model.)

**Files:**
- Modify: `src/config.js:3` (`FIT_MARGIN`), `src/config.js:17-25` (the comment block,
  `startSpin`, `endSpin`)
- Modify: `src/animation.js:51,54` (delete the `idleRevolutions` term)
- Test: `tests/animation.test.js:83`, `:112-119`, `:147`, `:173`, `:193`
- Test: `tests/scene.test.js:5,56`

**Interfaces:**
- Consumes: `FLOAT` from `src/config.js` (Task 1) — `tests/scene.test.js` imports it.
- Produces: `ENTRANCE.endSpin === 0`, `ENTRANCE.startSpin === 4.5`, `FIT_MARGIN === 1.6`.
  `entranceRotation(elapsed, opts).yaw` is now constant for every `elapsed >= duration`.
  `entranceRevolutions(duration, {...ENTRANCE})` is now `3.15`.

- [ ] **Step 1: Amend the failing tests**

In `tests/animation.test.js`, replace the case at `:83`:

```js
  it('covers 3.150 revolutions at the shipped 4.5 rev/s start and zero end speed', () => {
    const shipped = { ...OPTS, startSpin: 4.5, endSpin: 0 };
    expect(entranceRevolutions(shipped.duration, shipped)).toBeCloseTo(3.15, 9);
  });
```

Replace `ROT_OPTS` at `:112-119` so it mirrors the shipped constants:

```js
const ROT_OPTS = {
  duration: 3.5,
  startSpin: 4.5,
  endSpin: 0,
  settleYaw: Math.PI / 4,
  settlePitch: (15 * Math.PI) / 180,
  tumbleRatio: 0.35,
};
```

Replace the case at `:147` (`drifts horizontally at exactly endSpin after the entrance`):

```js
  it('holds the yaw perfectly still after the entrance', () => {
    const atArrival = entranceRotation(ROT_OPTS.duration, ROT_OPTS).yaw;
    expect(entranceRotation(ROT_OPTS.duration + 60, ROT_OPTS).yaw).toBe(atArrival);
    expect(entranceRotation(ROT_OPTS.duration + 600, ROT_OPTS).yaw).toBe(atArrival);
  });
```

Replace the case at `:173` (`turns one way only, through the entrance and on into the idle
drift`) — it drops its post-entrance samples, because the yaw no longer advances there:

```js
  it('turns one way only through the entrance', () => {
    const samples = [0, 0.35, 1, 1.75, 2.5, 3.5].map(
      (t) => entranceRotation(t, ROT_OPTS).yaw
    );
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });
```

Replace the case at `:193` (`holds the pose steady while only the idle drift advances`):

```js
  it('freezes both angles once settled — nothing moves without the viewer', () => {
    const a = entranceRotation(100, ROT_OPTS);
    const b = entranceRotation(200, ROT_OPTS);
    expect(b.pitch).toBe(a.pitch);
    expect(b.yaw).toBe(a.yaw);
  });
```

In `tests/scene.test.js`, change the import at `:5`:

```js
import { CAMERA_FOV, COLORS, CUBE_RADIUS, FLOAT } from '../src/config.js';
```

and the assertion at `:54-56` — same intent, new source of excursion:

```js
      // Worst case is the cube at a corner-on orientation, displaced by the full
      // idle float. Derived from config so tightening FIT_MARGIN fails here.
      expect(limiting).toBeGreaterThan(CUBE_RADIUS + FLOAT.amplitude);
```

Leave `tests/animation.test.js`'s `OPTS` literal (`:4-12`, `endSpin: 0.035`) alone. The
`entranceState` cases document the curve independently of the shipped constants, and
`entranceState` itself does not change.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL in `tests/animation.test.js` — `holds the yaw perfectly still after the
entrance` and `freezes both angles once settled` both fail, because `entranceRotation`
still adds `idleRevolutions`. The `entranceRevolutions` and `scene` cases already pass
(they are self-contained literals), which is expected.

- [ ] **Step 3: Delete the idle drift from `entranceRotation`**

In `src/animation.js`, delete line 51 and the `+ TAU * idleRevolutions` on line 54, and
rewrite the comment block above the function (`:35-47`) so it no longer promises a drift:

```js
// The entrance rotation, written backwards from the pose it must land on: what
// is left to cover, rather than what has been covered. `remaining` hits exactly
// 0 at `duration`, so the cube arrives on `settleYaw`/`settlePitch` with no
// floating-point slack and no dependence on frame rate or on `startSpin`.
//
// After the entrance `remaining` is pinned at 0, so BOTH angles are frozen
// forever: the cube holds its landing pose exactly. Every post-entrance
// rotation is the viewer's, added by the caller from src/drag.js — nothing here
// advances on its own.
//
// `yaw` is deliberately NOT reduced modulo 2PI. The starting value is a large
// negative angle, which is the same pose as its reduced form, and the cube is
// off-screen for the first ~0.36 s regardless; reducing it would break the
// exact landing and make the angle non-monotonic.
export function entranceRotation(elapsed, opts) {
  const total = entranceRevolutions(opts.duration, opts);
  const remaining = total - entranceRevolutions(elapsed, opts);

  return {
    yaw: opts.settleYaw - TAU * remaining,
    pitch: opts.settlePitch - opts.tumbleRatio * TAU * remaining,
  };
}
```

- [ ] **Step 4: Change the three config numbers**

In `src/config.js`, line 3:

```js
export const FIT_MARGIN = 1.6;
```

and replace the `startSpin`/`endSpin` lines and the whole stale comment block above them
(`:17-25`):

```js
  // 4.5 sits under the ceiling, with headroom. The cube's yaw is 90-degree
  // symmetric, so past 45 degrees of yaw per rendered frame the spin reads as
  // running backwards. The cube enters frame earlier on taller viewports, where
  // easeOutQuart has cut away less of the peak — measured against FIT_MARGIN
  // 1.6 with the scale ramp included, the 30 fps cap is 5.78 in landscape, 5.10
  // at 9:16, and 4.90 on a 9:19.5 phone, where 4.5 lands at 41.3 degrees per
  // frame. Raising FIT_MARGIN lowers every one of those; re-measure the
  // tall-viewport case before touching either number.
  startSpin: 4.5,
  // Zero, not a small drift: the decay curve itself has to terminate at a
  // standstill. easeOutQuart's derivative is 0 at p = 1, so the cube glides to a
  // stop. All post-entrance rotation comes from the viewer's drag.
  endSpin: 0,
```

- [ ] **Step 5: Run the full suite to verify it passes**

Run: `npm test`
Expected: PASS, every file.

- [ ] **Step 6: Verify the entrance in the browser**

Run: `npm run dev`, open the page, reload.
Expected: the cube is visibly smaller at rest than before; the entrance still starts fully
off-screen; the spin decelerates to a complete standstill with no visible snap at 3.5 s;
after that the cube's rotation is dead still (it will still be nudged by the parallax that
is not removed until Task 5 — that is expected here).

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/animation.js tests/animation.test.js tests/scene.test.js
git commit -m "feat: frame the cube smaller and land the entrance at a standstill"
```

---

### Task 3: Strip the cube to a bare gray mesh

Spec section 13.2 reading **B**: the edge outline goes away entirely. The cube becomes a
single flat-shaded `Mesh` — no `LineSegments`, no wrapping `Group`, and no `polygonOffset`
(its only purpose was keeping the edge lines from z-fighting with the faces).

`COLORS.edge` is deleted rather than recolored, so nothing can quietly reintroduce it. Blue
is therefore no longer rendered anywhere on the page; Task 7 records that in `AGENTS.md`.

The mesh must be named `cube`, not `cube-faces` — `tests/scene.test.js:12` looks it up by
that name and `src/main.js` reaches it as `view.cube`.

**Files:**
- Modify: `src/cube.js` (whole file)
- Modify: `src/config.js:6-10` (drop the `edge` key)
- Test: `tests/cube.test.js` (whole file)

**Interfaces:**
- Produces: `createCube() -> THREE.Mesh` named `cube`, with no children. Previously a
  `THREE.Group`. `src/scene.js:17-18` adds it unchanged and `view.cube` is unchanged, so no
  caller edit is needed.
- Produces: `COLORS` is now `{ background, face }` — `COLORS.edge` no longer exists.

- [ ] **Step 1: Rewrite the failing tests**

Replace the whole of `tests/cube.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/cube.test.js`
Expected: FAIL — the first case fails because `createCube()` still returns a
`THREE.Group`.

- [ ] **Step 3: Rewrite `src/cube.js`**

Replace the whole file:

```js
import * as THREE from 'three';
import { COLORS, CUBE_SIZE } from './config.js';

// One bare flat-shaded mesh: no edge overlay, no wrapping group. Flat shading is
// what carries the form — each face is a single tone, so the silhouette and the
// three tonal steps between visible faces are the whole read.
export function createCube() {
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

  const material = new THREE.MeshStandardMaterial({
    color: COLORS.face,
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
  });

  const cube = new THREE.Mesh(geometry, material);
  cube.name = 'cube';
  return cube;
}
```

- [ ] **Step 4: Drop `COLORS.edge`**

In `src/config.js`, the `COLORS` block becomes:

```js
export const COLORS = {
  background: 0xf7f7f8,
  face: 0xd6d8dc,
};
```

- [ ] **Step 5: Run the full suite to verify it passes**

Run: `npm test`
Expected: PASS, every file — including `tests/scene.test.js`, whose
`getObjectByName('cube')` lookup still resolves.

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev`.
Expected: no blue anywhere on the page; the cube reads as three flat gray tones against the
off-white background, with no drawn outline.

- [ ] **Step 7: Commit**

```bash
git add src/cube.js src/config.js tests/cube.test.js
git commit -m "feat: drop the cube's edge outline for a bare flat-shaded mesh"
```

---

### Task 4: `src/drag.js` — the drag-to-spin model

The whole feel of the interaction lives here, and it is entirely headless-testable: no
`three`, no DOM, no events. `main.js` (Task 6) owns the listeners and only ever calls these
four methods.

**Four design points the tests below pin down.**

1. **`move(x)` records; `update(dt, viewportMin)` integrates.** Several `pointermove`
   events can fire per animation frame. Folding each one in as it arrives would make the
   result depend on the browser's event coalescing rate.
2. **The gain is normalized by `min(innerWidth, innerHeight)`, not by width.**
   `src/camera.js:13` fits the cube using `Math.min(halfV, halfH)`, so the cube's apparent
   size is proportional to the *smaller* viewport dimension. Normalizing the drag by the
   same dimension gives the viewer identical degrees-per-cube-width on every device and in
   both orientations. Normalizing by width would make phones roughly three times twitchier
   than desktops.

   ```
   gain = (TAU * revsPerViewport) / max(viewportMin, 1)      // radians per pixel
   ```

   | Viewport | Gain | Drag for a quarter turn |
   | --- | --- | --- |
   | 1920x1080 | 0.333 deg/px | 270 px |
   | 1440x900 | 0.400 deg/px | 225 px |
   | 1024x1366 | 0.352 deg/px | 256 px |
   | 390x844 | 0.923 deg/px | 98 px |

3. **The release velocity is an exponentially smoothed estimate, not the last event's
   delta.** `velocityTau` of 0.06 s means a viewer who drags, holds still for a few frames,
   then lifts gets a velocity that has already collapsed — no unwanted throw. A viewer who
   lifts mid-swipe gets the full flick.
4. **`maxSpeed` caps the coast, not the drag.** While the finger is down the cube tracks
   1:1 at any speed, because a fast swipe there is self-evidently the viewer's doing. The
   cap applies in `end()`, on the thrown velocity, for the same 45-deg/frame reason as
   `startSpin`: 2.5 rev/s is 30 deg/frame at 30 fps, leaving headroom on a throttled tab.
   Maximum coast is therefore `2.5 * 0.5` = 1.25 revolutions, since the exponential coast
   angle is exactly `omega_0 * releaseTau`.

**Direction.** Dragging right increases yaw. A point on the front face at `(0, 0, 1)` maps
to `(sin(theta), 0, cos(theta))` under `rotation.y = theta`, so positive yaw carries the
front face toward screen-right — the face under the finger follows the finger.

**Why `start()` zeroes the velocity.** Pressing a coasting cube should grab it. Without the
reset, a tap on a spinning cube would re-throw it at close to its current speed instead of
stopping it dead. The yaw is untouched, so the grab itself moves nothing.

**Why there is no stop threshold.** The velocity never reaches exactly zero under
exponential decay, and that is fine: it falls below one device pixel of arc within about
2 s, and the update is a handful of flops per frame.

**Files:**
- Create: `src/drag.js`
- Modify: `src/config.js` (add a `DRAG` block after `FLOAT`)
- Test: `tests/drag.test.js` (new)

**Interfaces:**
- Consumes: `dampTowards(current, target, tau, dt)` from `src/math.js:11` — its only caller
  after `src/parallax.js` is deleted in Task 5.
- Produces: `createDragSpin({ revsPerViewport, releaseTau, velocityTau, maxSpeed })`
  returning `{ start(x), move(x), end(), update(dt, viewportMin) }`.
  - `start(x: number) -> void` — latches the press position, clears the pending delta,
    zeroes the velocity.
  - `move(x: number) -> void` — records the latest pointer X. Integrates nothing.
  - `end() -> void` — clears the dragging flag and clamps `|velocity|` to `maxSpeed * TAU`.
  - `update(dt: number, viewportMin: number) -> number` — advances the model by one frame
    and returns the accumulated **yaw in radians**, unwrapped. A `dt <= 0` (or `NaN`) is a
    no-op that returns the current yaw and leaves the velocity untouched.
- Produces: `DRAG` exported from `src/config.js` as
  `{ revsPerViewport, releaseTau, velocityTau, maxSpeed }`, spreadable straight into
  `createDragSpin`.

- [ ] **Step 1: Write the failing tests**

Create `tests/drag.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { createDragSpin } from '../src/drag.js';

const TAU = Math.PI * 2;

const OPTS = {
  revsPerViewport: 1.0,
  releaseTau: 0.5,
  velocityTau: 0.06,
  maxSpeed: 2.5,
};

// Drag at a steady `distance` px per frame for `frames` frames, so the smoothed
// velocity estimate settles on the real drag speed.
function swipe(drag, { distance, frames, dt, viewportMin }) {
  drag.start(0);
  for (let i = 1; i <= frames; i += 1) {
    drag.move(distance * i);
    drag.update(dt, viewportMin);
  }
}

// Total yaw travelled after release, run long enough that the exponential tail
// is negligible (5 s is 10 time constants at releaseTau 0.5).
function coast(drag, { dt, viewportMin }) {
  const before = drag.update(0, viewportMin);
  let last = before;
  for (let t = 0; t < 5; t += dt) {
    last = drag.update(dt, viewportMin);
  }
  return last - before;
}

describe('createDragSpin', () => {
  it('does nothing at all without input', () => {
    const drag = createDragSpin(OPTS);
    expect(drag.update(1 / 60, 1000)).toBe(0);
    expect(drag.update(1 / 30, 1000)).toBe(0);
    expect(drag.update(10, 1000)).toBe(0);
  });

  it('turns exactly revsPerViewport for a drag of one viewport-minimum', () => {
    const drag = createDragSpin(OPTS);
    drag.start(0);
    drag.move(1000);
    expect(drag.update(1 / 60, 1000)).toBeCloseTo(TAU * OPTS.revsPerViewport, 12);
  });

  it('feels the same on a phone and a desktop: equal fractions, equal yaw', () => {
    const phone = createDragSpin(OPTS);
    phone.start(0);
    phone.move(390 * 0.4);
    const phoneYaw = phone.update(1 / 60, 390);

    const desktop = createDragSpin(OPTS);
    desktop.start(0);
    desktop.move(1920 * 0.4);
    const desktopYaw = desktop.update(1 / 60, 1920);

    expect(phoneYaw).toBeCloseTo(desktopYaw, 12);
    expect(phoneYaw).toBeCloseTo(TAU * OPTS.revsPerViewport * 0.4, 12);
  });

  it('carries the face under the finger with the finger: right is positive yaw', () => {
    const drag = createDragSpin(OPTS);
    drag.start(500);
    drag.move(600);
    expect(drag.update(1 / 60, 1000)).toBeGreaterThan(0);

    const back = createDragSpin(OPTS);
    back.start(500);
    back.move(400);
    expect(back.update(1 / 60, 1000)).toBeLessThan(0);
  });

  it('yields the same yaw at 30 fps and at 144 fps for the same pointer path', () => {
    const replay = (dt) => {
      const drag = createDragSpin(OPTS);
      drag.start(0);
      for (const x of [40, 120, 260, 300, 305]) {
        drag.move(x);
        drag.update(dt, 1000);
      }
      return drag.update(dt, 1000);
    };
    expect(replay(1 / 30)).toBeCloseTo(replay(1 / 144), 12);
  });

  it('treats several moves between two frames as one move to the final position', () => {
    const many = createDragSpin(OPTS);
    many.start(0);
    many.move(50);
    many.move(90);
    many.move(120);
    const manyYaw = many.update(1 / 60, 1000);

    const one = createDragSpin(OPTS);
    one.start(0);
    one.move(120);
    const oneYaw = one.update(1 / 60, 1000);

    expect(manyYaw).toBe(oneYaw);
  });

  it('coasts on release: monotonic, decelerating, total ~ omega_0 * releaseTau', () => {
    const dt = 1 / 120;

    const drag = createDragSpin(OPTS);
    swipe(drag, { distance: 8, frames: 60, dt, viewportMin: 1000 });
    drag.end();

    let previous = drag.update(0, 1000);
    let previousStep = Infinity;
    for (let i = 0; i < 240; i += 1) {
      const yaw = drag.update(dt, 1000);
      const step = yaw - previous;
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThan(previousStep);
      previous = yaw;
      previousStep = step;
    }

    // 8 px per 1/120 s = 960 px/s, and the estimate has settled over 0.5 s
    // (8 time constants at velocityTau 0.06), so omega_0 = 960 * gain.
    const omega0 = (960 * TAU * OPTS.revsPerViewport) / 1000;
    const fresh = createDragSpin(OPTS);
    swipe(fresh, { distance: 8, frames: 60, dt, viewportMin: 1000 });
    fresh.end();
    const total = coast(fresh, { dt, viewportMin: 1000 });
    expect(total).toBeGreaterThan(omega0 * OPTS.releaseTau * 0.9);
    expect(total).toBeLessThan(omega0 * OPTS.releaseTau * 1.1);
  });

  it('does not throw the cube when the drag paused before the release', () => {
    const drag = createDragSpin(OPTS);
    const dt = 1 / 60;
    swipe(drag, { distance: 8, frames: 30, dt, viewportMin: 1000 });

    // Hold the pointer still for 0.3 s: five time constants at velocityTau 0.06,
    // so the estimate falls to exp(-5) = 0.67% of the swipe speed.
    for (let t = 0; t < 0.3; t += dt) {
      drag.update(dt, 1000);
    }
    drag.end();

    expect(Math.abs(coast(drag, { dt, viewportMin: 1000 }))).toBeLessThan(TAU * 0.01);
  });

  it('caps the thrown velocity so a flick cannot strobe', () => {
    const drag = createDragSpin(OPTS);
    drag.start(0);
    drag.move(100000);
    drag.update(1 / 60, 1000);
    drag.end();

    // With the cap in place the coast is 1.25 revolutions (7.854 rad); the 5%
    // allowance covers the discrete sum, which overshoots the analytic
    // velocity * releaseTau by (dt/tau) / (1 - exp(-dt/tau)) = 0.84% at 120 fps.
    // Without the cap that single frame would fling it some 4600 rad.
    const total = coast(drag, { dt: 1 / 120, viewportMin: 1000 });
    expect(total).toBeLessThanOrEqual(TAU * OPTS.maxSpeed * OPTS.releaseTau * 1.05);
  });

  it('treats a zero or negative frame delta as a no-op and never produces NaN', () => {
    const drag = createDragSpin(OPTS);
    drag.start(0);
    drag.move(300);
    expect(drag.update(0, 1000)).toBe(0);
    expect(drag.update(-1, 1000)).toBe(0);

    const yaw = drag.update(1 / 60, 1000);
    expect(Number.isNaN(yaw)).toBe(false);
    expect(drag.update(0, 1000)).toBe(yaw);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/drag.test.js`
Expected: FAIL — cannot resolve `../src/drag.js`.

- [ ] **Step 3: Add the `DRAG` config block**

In `src/config.js`, immediately after the `FLOAT` block:

```js
// Drag-to-spin. `revsPerViewport` is measured against min(innerWidth,
// innerHeight) — the same dimension the camera fits the cube to — so the gain
// stays proportional to the cube's apparent size and the feel is identical on a
// phone and a desktop. Useful tuning range is 0.6 (heavy, furniture-like) to
// 1.5 (flicky).
//
// `maxSpeed` caps the released coast only, never the drag itself: 2.5 rev/s is
// 30 degrees of yaw per frame at 30 fps, under the 45-degree limit where the
// cube's 90-degree-symmetric yaw starts reading as running backwards. The coast
// angle is exactly velocity * releaseTau, so the longest possible throw is
// 2.5 * 0.5 = 1.25 revolutions.
export const DRAG = {
  revsPerViewport: 1.0,
  releaseTau: 0.5,
  velocityTau: 0.06,
  maxSpeed: 2.5,
};
```

- [ ] **Step 4: Implement `src/drag.js`**

Create the file:

```js
import { dampTowards } from './math.js';

const TAU = Math.PI * 2;

// Horizontal drag-to-spin with an exponential release coast. Stateful but pure:
// no three, no DOM, no events — main.js owns the listeners and calls in.
//
// The split between move() and update() is deliberate. Several pointermove
// events can fire per animation frame, so folding each one in as it arrives
// would make the total depend on the browser's event coalescing rate. move()
// only records; update() folds the accumulated delta once per frame.
export function createDragSpin({ revsPerViewport, releaseTau, velocityTau, maxSpeed }) {
  let dragging = false;
  let lastApplied = 0; // pointer x already folded into yaw
  let latest = 0; // most recent pointer x reported by move()
  let yaw = 0; // radians, unwrapped
  let velocity = 0; // radians per second

  return {
    start(x) {
      dragging = true;
      lastApplied = x;
      latest = x;
      // Pressing a coasting cube grabs it: without this, a tap would re-throw
      // the cube at its current speed instead of stopping it dead.
      velocity = 0;
    },

    move(x) {
      latest = x;
    },

    end() {
      dragging = false;
      const cap = maxSpeed * TAU;
      if (velocity > cap) velocity = cap;
      else if (velocity < -cap) velocity = -cap;
    },

    // `viewportMin` is min(innerWidth, innerHeight) — the dimension the camera
    // fits the cube to, so the gain tracks the cube's apparent size.
    update(dt, viewportMin) {
      // Also catches NaN: every comparison against NaN is false.
      if (!(dt > 0)) return yaw;

      const gain = (TAU * revsPerViewport) / Math.max(viewportMin, 1);

      if (dragging) {
        const delta = (latest - lastApplied) * gain;
        lastApplied = latest;
        yaw += delta;
        // Smoothed, not the raw per-frame rate: a drag that pauses before the
        // release must not throw the cube.
        velocity = dampTowards(velocity, delta / dt, velocityTau, dt);
      } else {
        yaw += velocity * dt;
        velocity = dampTowards(velocity, 0, releaseTau, dt);
      }

      return yaw;
    },
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tests/drag.test.js`
Expected: PASS, all ten cases.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS, every file. Nothing consumes `drag.js` yet.

- [ ] **Step 7: Commit**

```bash
git add src/drag.js src/config.js tests/drag.test.js
git commit -m "feat: add the drag-to-spin model with a damped release coast"
```

---

### Task 5: Remove the pointer parallax, wire the float

The page loses its ambient pointer response entirely. After this task the cube enters,
stops, and bobs — nothing reacts to the pointer until Task 6 lands the drag. That
intermediate state is intentional and is a legitimate stopping point for review.

`dampTowards` in `src/math.js` survives the deletion of its only current caller because
`src/drag.js` (Task 4) already reuses it. `tests/math.test.js` is untouched.

**Files:**
- Delete: `src/parallax.js`, `tests/parallax.test.js`
- Modify: `src/config.js:28-32` (delete the `PARALLAX` block)
- Modify: `src/main.js` (whole file)

**Interfaces:**
- Consumes: `floatOffset` from `src/animation.js` (Task 1), `FLOAT` from `src/config.js`
  (Task 1).
- Produces: nothing new. `createParallax` and `PARALLAX` no longer exist.

- [ ] **Step 1: Delete the parallax module, its test, and its config**

```bash
git rm src/parallax.js tests/parallax.test.js
```

Then delete the `PARALLAX` block from `src/config.js` (`:28-32`) — the whole
`export const PARALLAX = { ... };` statement.

- [ ] **Step 2: Rewrite `src/main.js`**

Replace the whole file. Note that the pitch stays `rotation.pitch` — the entrance's
vertical tumble runs through it, and it equals `SETTLE.pitch` only after the entrance ends.

```js
import * as THREE from 'three';
import './style.css';
import {
  ENTRANCE,
  ENTRANCE_TUMBLE_RATIO,
  FLOAT,
  MAX_FRAME_DELTA,
  MAX_PIXEL_RATIO,
  SETTLE,
} from './config.js';
import { entranceRotation, entranceState, floatOffset } from './animation.js';
import { createScene } from './scene.js';

// A blank off-white page is the intended degradation when WebGL is unavailable
// (blocklisted driver, exhausted contexts, hardened browser) — the spec allows no
// DOM fallback text. Reaching it via an uncaught throw is not intended, so fail
// quietly instead. three registers its own context-lost/restored handlers.
const canvas = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (error) {
  console.error('[landing-cube] WebGL unavailable, leaving the page blank:', error);
}

// `view` is kept whole rather than destructured: view.startY is a getter that
// resize() updates.
const view = createScene(window.innerWidth, window.innerHeight);
const timer = new THREE.Timer();

// Assembled once: entranceRotation needs the entrance timing and the target
// pose together, and neither changes at runtime.
const ROTATION = {
  duration: ENTRANCE.duration,
  startSpin: ENTRANCE.startSpin,
  endSpin: ENTRANCE.endSpin,
  settleYaw: SETTLE.yaw,
  settlePitch: SETTLE.pitch,
  tumbleRatio: ENTRANCE_TUMBLE_RATIO,
};

// FLOAT carries the bob's shape; the phase is anchored to the end of the
// entrance, so floatOffset needs the entrance duration alongside it.
const FLOAT_OPTS = { ...FLOAT, duration: ENTRANCE.duration };

let elapsed = 0;

function applyViewportSize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  // updateStyle is deliberately left ON: three then writes inline px matching the
  // drawing buffer, so the CSS box, the buffer, and the camera aspect agree by
  // construction. Passing `false` here would leave style.css's 100vw/100vh
  // authoritative, and on iOS/Android 100vh is the large (toolbars-hidden)
  // viewport while innerHeight is the visible one — which stretches the cube.
  renderer.setSize(width, height);
  view.resize(width, height);
}

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), MAX_FRAME_DELTA);
  elapsed += dt;

  const state = entranceState(elapsed, { ...ENTRANCE, startY: view.startY });
  // Closed form, not an accumulator: the cube lands on the exact same pose at
  // any frame rate, and both angles freeze dead when the entrance ends.
  const rotation = entranceRotation(elapsed, ROTATION);

  view.cube.position.set(0, state.y + floatOffset(elapsed, FLOAT_OPTS), 0);
  view.cube.scale.setScalar(state.scale);
  // rotation.pitch, not SETTLE.pitch: the entrance's vertical tumble runs
  // through it and only lands on SETTLE.pitch at t = duration.
  view.cube.rotation.set(rotation.pitch, rotation.yaw, 0);

  renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}

if (renderer) {
  applyViewportSize();
  window.addEventListener('resize', applyViewportSize);

  requestAnimationFrame(frame);
}
```

- [ ] **Step 3: Verify no parallax references remain**

Run: `grep -ri parallax src tests`
Expected: no output.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS, every file. `tests/math.test.js` still passes — `dampTowards` now has
`src/drag.js` as its caller.

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`.
Expected: moving the pointer across the page changes nothing at all. After the entrance the
cube holds its pose perfectly still and drifts gently up and down, forever, with no
positional jump at the 3.5 s handover.

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "refactor: replace the pointer parallax with the idle vertical float"
```

---

### Task 6: Wire the drag into the page

The DOM half of Task 4. `main.js` keeps sole ownership of the events; `drag.js` stays
ignorant of them.

**Pointer capture is what makes a drag that leaves the window keep working.** It replaces
the capture-phase `pointerleave` listener that Task 5 deleted. Capture survives the pointer
crossing into browser chrome, another monitor, or another app — but not the tab losing
focus, hence the `blur` handler.

**`touch-action: none` is not optional polish.** Without it the browser claims a horizontal
drag for its own gesture handling before `pointermove` fires, and on Android a downward drag
triggers pull-to-refresh. `html, body { overflow: hidden }` does not prevent this. Item 5
does not work on touch without this line.

**Drags during the entrance are ignored** (spec section 13.4). Allowing them would make the
yaw at `t = duration` equal `SETTLE.yaw + userYaw`, which breaks the exact-landing guarantee
the previous spec was written to establish. The accepted cost is that a press in the last
half-second of the 3.5 s entrance is silently dropped.

**Affordance is two CSS lines and nothing more.** `cursor: grab` / `grabbing` is in scope;
hint text, icons, and nudge animations are explicitly out (spec section 7e). If the built
page feels inert, the cause is known and the decision was deliberate.

**Files:**
- Modify: `src/main.js` (imports, three module-level variables, one instance, the render
  loop, a new event block)
- Modify: `src/style.css:14-18`

**Interfaces:**
- Consumes: `createDragSpin` from `src/drag.js` and `DRAG` from `src/config.js` (Task 4).
- Produces: nothing importable — this is the application wiring.

- [ ] **Step 1: Add the drag imports and instance to `src/main.js`**

Extend the config import to pull in `DRAG`, and add the module import:

```js
import {
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
```

Directly under `const timer = new THREE.Timer();`:

```js
const drag = createDragSpin(DRAG);
```

- [ ] **Step 2: Add the drag state and fold it into the render loop**

Replace `let elapsed = 0;` with:

```js
let elapsed = 0;
// Read by the pointerdown handler: a press before the entrance lands would make
// the yaw at t = duration SETTLE.yaw + userYaw, breaking the exact landing.
let entranceDone = false;
let activePointerId = null;
```

In `frame()`, set the flag from the state and add the drag's yaw to the entrance yaw:

```js
  const state = entranceState(elapsed, { ...ENTRANCE, startY: view.startY });
  entranceDone = state.done;
  // Closed form, not an accumulator: the cube lands on the exact same pose at
  // any frame rate, and both angles freeze dead when the entrance ends.
  const rotation = entranceRotation(elapsed, ROTATION);
  // Once per frame, whatever the pointermove event rate was. The viewport
  // minimum is the dimension the camera fits the cube to, so the gain stays
  // proportional to the cube's apparent size.
  const dragYaw = drag.update(dt, Math.min(window.innerWidth, window.innerHeight));

  view.cube.position.set(0, state.y + floatOffset(elapsed, FLOAT_OPTS), 0);
  view.cube.scale.setScalar(state.scale);
  // rotation.pitch, not SETTLE.pitch: the entrance's vertical tumble runs
  // through it and only lands on SETTLE.pitch at t = duration.
  view.cube.rotation.set(rotation.pitch, rotation.yaw + dragYaw, 0);
```

- [ ] **Step 3: Add the pointer event block**

Add `endDrag` above `frame()`:

```js
// Idempotent: pointerup and the lostpointercapture that follows it both land
// here, and blur calls it with no event at all.
function endDrag(event) {
  if (activePointerId === null) return;
  if (event && event.pointerId !== undefined && event.pointerId !== activePointerId) return;

  const pointerId = activePointerId;
  activePointerId = null;
  // Already false inside lostpointercapture, so this only fires for blur.
  if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  drag.end();
}
```

and inside the `if (renderer)` block, after the `resize` listener:

```js
  canvas.addEventListener('pointerdown', (event) => {
    // Ignore presses during the entrance (they would break the exact landing
    // pose) and any second finger while a drag is already running.
    if (!entranceDone || activePointerId !== null) return;
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
```

- [ ] **Step 4: Add the touch and cursor rules to `src/style.css`**

Replace the `#scene` rule:

```css
#scene {
  display: block;
  width: 100vw;
  height: 100vh;
  /* Required, not polish: without it the browser claims a horizontal drag for
     its own gesture handling before pointermove fires, and a downward drag
     triggers pull-to-refresh on Android. overflow: hidden does not prevent it. */
  touch-action: none;
  cursor: grab;
}

#scene:active {
  cursor: grabbing;
}
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS, every file. `main.js` is not unit-tested; this confirms nothing else broke.

- [ ] **Step 6: Verify the drag by hand**

Run: `npm run dev`. Check every one of these:

1. Dragging left/right spins the cube horizontally. It does **not** tilt vertically.
2. The face under the cursor moves with the cursor (drag right, the front face goes right).
3. A drag of roughly a screen-min-dimension turns the cube one full revolution.
4. Releasing mid-swipe coasts and eases smoothly to a stop.
5. Dragging, pausing for half a second, then releasing stops dead — no throw.
6. A very fast flick coasts at most about 1.25 revolutions, and never strobes.
7. Press and drag out of the window, keep moving, come back — the cube tracks throughout.
8. Alt-tab away mid-drag, come back — the cube is not stuck to the pointer.
9. Pressing during the first 3.5 s does nothing; pressing after works.
10. The cursor is a grab hand over the canvas, a grabbing fist while pressed.

- [ ] **Step 7: Commit**

```bash
git add src/main.js src/style.css
git commit -m "feat: let the viewer spin the cube by dragging"
```

---

### Task 7: Bring `AGENTS.md` and `README.md` back in line

`AGENTS.md` is the spec of record and this work directly contradicts two of its landing-page
requirements and four of its recorded decisions. Leaving both statements standing is not an
option.

`AGENTS.md` is written in a clipped pidgin register ("Cube enter from top of screen,
spinning"). Match it in the Landing Page section; the Decisions section is written in normal
prose and stays that way.

**Files:**
- Modify: `AGENTS.md` (the entrance table, requirements 2 and 4, five Decisions entries, one
  new Decisions entry, one Design Direction note)
- Modify: `README.md` (the intro paragraph, four Layout lines, the Design direction
  paragraph, the closing paragraph)

**Interfaces:** none — documentation only.

- [ ] **Step 1: Amend the `AGENTS.md` Design Direction section**

The accent-color bullet becomes:

```markdown
- **Accent color:** blue — use sparingly. Stay minimal. (Currently unused: the cube's edge
  outline was blue's only appearance and it is gone. Page is fully achromatic.)
```

- [ ] **Step 2: Amend the `AGENTS.md` Landing Page section**

The entrance table's "Spin speed" row becomes:

```markdown
| Spin speed | fast | stopped — decay curve land on standstill |
```

Requirement 2 becomes:

```markdown
2. Rotation ease from fast entrance spin down to complete stop as cube settle in middle.
```

Requirement 4 becomes — this **replaces** "Slow float spin go forever after entrance done";
do not leave both standing — and a fifth requirement is added:

```markdown
4. After entrance, cube hold pose still and drift gentle up and down forever. All
   horizontal rotation come from viewer drag, none automatic.
5. Viewer drag horizontal to spin cube. Release throw it, cube coast to stop.
```

- [ ] **Step 3: Rewrite the affected `AGENTS.md` Decisions entries**

Replace the *Entrance* entry:

```markdown
- **Entrance:** 3.5s slow cinematic ease-out. Position and scale on ease-out cubic; spin
  speed on ease-out quart (4.5 -> 0 rev/s) so the rotation calms just ahead of the arrival
  and the cube glides to a genuine standstill (ease-out quart has zero derivative at p = 1,
  so nothing snaps). Total 3.150 revolutions. 4.5 sits under the strobing ceiling with
  headroom: the cube's yaw is 90-degree symmetric, so a faster spin reads as running
  backwards on a 30 fps display. The limit is set by tall viewports, where the cube enters
  frame earlier — measured at `FIT_MARGIN` 1.6 the 30 fps cap is 5.78 in landscape, 5.10 at
  9:16, and 4.90 on a 9:19.5 phone, where 4.5 lands at 41.3 degrees per frame.
```

Replace the *Idle rotation* entry entirely, with two entries:

```markdown
- **Idle rotation:** none. Both angles freeze on the landing pose when the entrance ends and
  the cube holds it indefinitely — edge-on is now where it stays, not a moment it passes
  through. This supersedes the 2026-08-28 spec's section-7 option A ("land and drift") and
  its 0.035 rev/s idle drift. The only autonomous motion left on the page is the vertical
  float.
- **Idle float:** vertical only. A sine bob of amplitude 0.08 world units and period 5.0 s,
  phase-anchored to the end of the entrance so it is exactly 0 at the handover and always
  begins moving upward. Peak-to-peak travel is 10% of the cube's edge length — defined
  against the cube, not the viewport, so changing `FIT_MARGIN` does not change how it reads.
```

Replace the *Post-settle interaction* entry:

```markdown
- **Post-settle interaction:** drag horizontally to spin. Gain is 1.0 revolution per
  `min(innerWidth, innerHeight)` of drag — normalized against the same dimension the camera
  fits the cube to, so the felt sensitivity is identical on a phone and a desktop. Release
  throws the cube onto an exponential coast with `releaseTau` 0.5 s (so the coast angle is
  exactly `velocity * 0.5`); the release velocity is a `velocityTau` 0.06 s smoothed
  estimate, so a drag that pauses before the release does not throw; and the thrown velocity
  is capped at 2.5 rev/s, which is 30 degrees per frame at 30 fps. Presses during the
  entrance are ignored, so the landing pose stays exact. No vertical drag, no scroll
  interaction, no snap-back.
```

Replace the *Cube look* entry:

```markdown
- **Cube look:** matte light-gray flat-shaded faces (`#d6d8dc`), nothing else — one bare
  `Mesh`, no edge outline, no wrapping `Group`, no `polygonOffset`. Flat shading carries the
  whole form: the silhouette plus the three tonal steps between visible faces.
```

Add a new entry:

```markdown
- **Cube size is `FIT_MARGIN`, not `CUBE_SIZE`.** The camera distance is derived from
  `CUBE_RADIUS * FIT_MARGIN`, so the camera pulls back in exact proportion to any change in
  `CUBE_SIZE` and the projected size is invariant — changing `CUBE_SIZE` produces a
  pixel-identical page. `FIT_MARGIN` is the multiple of the cube's bounding-sphere radius
  the camera frames, so it reads directly as "how much room around the cube". Set to 1.6:
  the edge-on silhouette spans 51% of the smaller viewport dimension (it was 60.5% at 1.35).
  Raising it also raises `entranceStartY`, which lowers the `startSpin` strobing ceiling —
  re-measure that before changing it.
```

- [ ] **Step 4: Rewrite the affected `README.md` passages**

The intro paragraph:

```markdown
Minimal, geometric landing page: a single cube enters from off-screen top, grows and slows
into the center over 3.5 seconds, then holds its pose and drifts gently up and down forever.
Drag it horizontally to spin it; let go mid-swipe and it coasts to a stop.
```

Four lines in Layout:

```markdown
- `src/config.js` — every tunable number (timing, sizes, colors, the idle float, the drag
  model, the resting pose). Start here.
```

```markdown
- `src/animation.js` — the entrance as pure functions of elapsed time: position and scale,
  plus the closed-form yaw and pitch that land the cube on its resting pose, plus the idle
  vertical float.
```

```markdown
- `src/cube.js` — the cube: one bare gray flat-shaded mesh, no outline.
```

The `src/parallax.js` line is replaced by:

```markdown
- `src/drag.js` — drag-to-spin: viewport-relative gain, smoothed release velocity, coast.
```

The Design direction paragraph:

```markdown
Very minimal and geometric. Light gray is the primary color; the page is currently fully
achromatic — blue is still the nominated accent but nothing on the page uses it. Deployment
is not set up yet — `npm run build` produces a static `dist/` that can be hosted anywhere.
```

The closing paragraph:

```markdown
The cube's entrance ends on a fixed pose: a vertical edge facing the viewer, tilted 15
degrees so the top face shows. From there it holds that pose exactly — nothing rotates on
its own. The only autonomous motion is a gentle vertical bob; every turn of the cube is the
viewer's, dragged in by hand.
```

- [ ] **Step 5: Check nothing contradictory survives**

Run: `grep -niE 'parallax|blue|0\.035|edge outline|5\.0 rev|float spin' AGENTS.md README.md`
Expected: the only hits are the new Design Direction note about blue being unused, the
`README.md` "blue is still the nominated accent" line, and the `AGENTS.md` *Cube look* and
*Idle rotation* entries where the removals are described. Any other hit is a passage that
was missed — fix it.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: record the stripped-back cube and the drag interaction"
```

---

### Task 8: Final verification against the spec's acceptance criteria

No code changes. This is the gate that says the work is done.

**Files:** none modified, unless a check fails.

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: PASS. Confirm `tests/parallax.test.js` is gone and `tests/drag.test.js` reports
ten passing cases.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: exits 0 and writes `dist/`.

- [ ] **Step 3: Check the built page**

Run: `npm run preview`, open the served URL.
Expected: identical behavior to the dev server.

- [ ] **Step 4: Walk the spec's acceptance list**

Tick each item from spec section 15 against the running page:

- [ ] Moving the pointer without pressing changes nothing on the page.
- [ ] The cube is visibly smaller at rest, and still fully off-screen at the entrance start
      at 2133x1012, 1600x900, 900x900, 390x844, and 280x1000 (resize the window, or use
      device emulation).
- [ ] No blue is rendered anywhere on the page.
- [ ] After the entrance the cube's rotation is completely still until the viewer drags it.
- [ ] After the entrance the cube drifts gently up and down, forever.
- [ ] The entrance decelerates to a standstill with no visible snap at t = 3.5 s.
- [ ] Dragging horizontally spins the cube horizontally, at the same felt sensitivity on
      phone and desktop, with the face under the finger following the finger.
- [ ] Releasing mid-swipe coasts and eases to a stop; releasing after a pause does not.
- [ ] A drag works on a real touch device and survives the pointer leaving the window.
- [ ] The entrance spin does not read as running backwards on a 9:19.5 viewport at 30 fps
      (device emulation at 390x844 with CPU throttling, or a real phone).
- [ ] `AGENTS.md` and `README.md` contain no statement contradicted by this work.

- [ ] **Step 5: Commit any fixes**

If anything above failed, fix it, add a test where the suite could have caught it, and
commit. If everything passed there is nothing to commit — the work is done.
