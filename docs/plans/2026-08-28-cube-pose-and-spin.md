# Cube Entrance Spin and Resting Pose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the landing cube's entrance spin faster and decelerate harder, land it deterministically on a defined edge-on pose tilted 15 degrees down, and freeze the vertical tumble so the eternal idle float turns horizontally only.

**Architecture:** The per-frame yaw accumulator in `src/main.js` is replaced by a closed-form rotation function in `src/animation.js`. Because the entrance's spin-speed curve (`easeOutQuart` from `startSpin` to `endSpin`) is integrable in closed form, the total revolutions covered by the entrance is a constant, so the rotation can be written *backwards from the target pose*: `yaw(t) = settleYaw - 2PI * revolutionsRemaining(t)`. That lands on the target exactly, at any frame rate, for any `startSpin` — no easing-toward-target, no damping, no accumulator drift. The pitch uses the same remaining-revolutions term scaled by `ENTRANCE_TUMBLE_RATIO`, so it stops dead when the entrance ends. `entranceState()` (position, scale, spin speed) is untouched; `main.js` keeps layering pointer parallax on top of both angles exactly as it does today.

**Tech Stack:** Three.js 0.185 (WebGL), Vite 8 (dev server + build), Vitest 4 (unit tests), plain JavaScript ES modules. No new dependencies. No TypeScript.

**Spec:** `docs/specs/2026-08-28-cube-pose-and-spin.md` — read it alongside this plan. Its one open decision (section 7, how long the edge-on pose lasts) was resolved by the product owner on 2026-08-28: **Option A, "land and drift"** — anchor the pose, keep `endSpin` at `0.035` rev/s. Edge-on is the moment the cube lands on, not a state it holds.

## Global Constraints

- **Language:** plain JavaScript, ES modules. No TypeScript. No new dependencies — the arithmetic is hand-written.
- **Runtime floor:** Node `^20.19.0 || >=22.12.0`.
- **Scope is rotation only.** Position curve, scale curve, the 3.5 s duration, camera framing, colors, materials, background, and the parallax limits/damping/layering are all unchanged. Do not touch `src/camera.js`, `src/cube.js`, `src/scene.js`, `src/parallax.js`, `src/math.js`, `src/style.css`, `index.html`, or `vite.config.js`.
- **`ENTRANCE.endSpin` stays `0.035`.** This is the resolved section-7 decision (Option A). Do not "improve" it.
- **`ENTRANCE.startSpin` becomes `5.0`.** Hard cap for any later tuning is `5.7` rev/s: a cube's yaw has 90-degree rotational symmetry, so past 45 degrees of yaw per rendered frame the spin reads as running backwards, and at 30 fps (throttled tab, low-power mode) `5.7` is where the cube first becomes visible at the legibility limit.
- **Keep `easeOutQuart` as the spin-decay curve.** The `(1 - p)^5 / 5` term in the revolutions integral is its antiderivative; changing the easing invalidates the closed form.
- **Keep three's default `XYZ` Euler order** and keep roll at `0`. With roll `0` the top-face normal is `(0, cos(pitch), sin(pitch))` — independent of yaw — which is what makes the 15-degree tilt read as a steady tilted turntable instead of a wobble. Any other Euler order spins the tilt axis with the cube.
- **`entranceState()` keeps returning `spinSpeed`** even though `main.js` stops consuming it. The existing monotonic-deceleration tests read it, and it documents the curve.
- **Every existing test must keep passing.** `tests/animation.test.js` declares its own `OPTS` literal with `startSpin: 3.0`, so the config bump does not touch it. Do not edit those cases.
- **`prefers-reduced-motion` remains deliberately unhandled.** Do not add a reduced-motion branch.
- **No DOM text, no new pages, routes, content, or 3D objects.**
- **Every task ends with a commit**, Conventional Commits style (`feat:`, `docs:`).

## File Structure

| File | Change |
| --- | --- |
| `src/animation.js` | Add two pure exports: `entranceRevolutions(elapsed, opts)` (the integral of the spin-speed curve) and `entranceRotation(elapsed, opts)` (`{ yaw, pitch }` in radians). No three.js import — this file stays headless-testable. `entranceState` is unchanged. |
| `src/config.js` | `ENTRANCE.startSpin` `3.0` -> `5.0`; new `SETTLE` block; `SPIN_TILT_RATIO` renamed `ENTRANCE_TUMBLE_RATIO` (value `0.35` unchanged). |
| `src/main.js` | Delete the `spinAngle` accumulator (`:33`, `:62`); read `yaw`/`pitch` from `entranceRotation`; the parallax layering in `rotation.set` (`:73-77`) keeps its exact shape. |
| `tests/animation.test.js` | New `describe` blocks for the two new functions. Existing `entranceState` block untouched. |
| `tests/pose.test.js` | New file. Builds a `THREE.Euler` at the target pose and asserts the geometry actually reads as "vertical edge dead-centre, top face visible" — the only test that needs three. |
| `README.md`, `AGENTS.md` | Record the resting pose and the resolved section-7 decision. |

Why the rotation lives in `animation.js` rather than a new module: it is the same subject as `entranceState` (the entrance as a pure function of elapsed time), it shares the same `opts`-object convention, and `entranceRotation` calls `entranceRevolutions` directly. Files that change together live together.

Why `tests/pose.test.js` is separate from `tests/animation.test.js`: it imports three and asserts about rendered geometry, not about the pure animation math. Keeping `tests/animation.test.js` three-free preserves the "pure modules are tested in plain Node" boundary the codebase already draws.

---

### Task 1: `entranceRevolutions` — the integral of the spin-speed curve

The entrance's spin speed is `lerp(startSpin, endSpin, easeOutQuart(p))` revolutions per second, with `p = clamp01(elapsed / duration)`. This task adds the total number of **revolutions** covered from `t = 0` to `t`, in closed form. Everything else in the plan is built on it.

The derivation, for `s0 = startSpin`, `s1 = endSpin`, `D = duration`:

```
speed(p) = s0 + (s1 - s0) * (1 - (1 - p)^4)

A(t) = integral of speed dt from 0 to t
     = D * integral of speed dp from 0 to p
     = D * ( s0 * p + (s1 - s0) * ( p - (1 - (1 - p)^5) / 5 ) )

A(D) = D * ( s0 + (s1 - s0) * 0.8 )
```

`A(D)` is the constant the whole design hangs on: with `s0 = 5.0`, `s1 = 0.035`, `D = 3.5` it is exactly `3.598` revolutions.

**Files:**
- Modify: `src/animation.js` (append after `entranceState`)
- Test: `tests/animation.test.js` (append a new `describe` block; do not touch the existing one)

**Interfaces:**
- Consumes: `clamp01` from `src/math.js` (already imported by `animation.js`).
- Produces: `entranceRevolutions(elapsed, opts) -> number` — revolutions covered since `t = 0`, where `opts` is `{ duration, startSpin, endSpin }` (extra keys ignored, so the whole `ENTRANCE` object can be passed). Clamped at both ends: negative `elapsed` returns `0`, `elapsed >= duration` returns the constant `A(D)`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/animation.test.js`. Add `entranceRevolutions` to the existing import at the top of the file — it becomes `import { entranceRevolutions, entranceState } from '../src/animation.js';`

```js
describe('entranceRevolutions', () => {
  it('has covered nothing at the start of the entrance', () => {
    expect(entranceRevolutions(0, OPTS)).toBe(0);
  });

  it('treats negative elapsed time as the start of the entrance', () => {
    expect(entranceRevolutions(-2, OPTS)).toBe(0);
  });

  it('lands on the analytic total D * (s0 + (s1 - s0) * 0.8)', () => {
    const expected = OPTS.duration * (OPTS.startSpin + (OPTS.endSpin - OPTS.startSpin) * 0.8);
    expect(entranceRevolutions(OPTS.duration, OPTS)).toBeCloseTo(expected, 12);
    expect(entranceRevolutions(OPTS.duration, OPTS)).toBeCloseTo(2.198, 9);
  });

  it('covers 3.598 revolutions at the shipped 5.0 rev/s start speed', () => {
    const fast = { ...OPTS, startSpin: 5.0 };
    expect(entranceRevolutions(fast.duration, fast)).toBeCloseTo(3.598, 9);
  });

  it('increases strictly through the entrance', () => {
    const samples = [0, 0.25, 0.5, 1, 1.75, 2.5, 3, 3.49, 3.5].map((t) =>
      entranceRevolutions(t, OPTS)
    );
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it('stops growing once the entrance is over', () => {
    const total = entranceRevolutions(OPTS.duration, OPTS);
    expect(entranceRevolutions(OPTS.duration + 60, OPTS)).toBe(total);
    expect(entranceRevolutions(600, OPTS)).toBe(total);
  });

  it('front-loads the turns: 94 percent of them happen in the first half', () => {
    const half = entranceRevolutions(OPTS.duration / 2, OPTS);
    const total = entranceRevolutions(OPTS.duration, OPTS);
    expect(half / total).toBeCloseTo(0.9426, 4);
  });
});
```

Note on the last case: it is the numeric statement of "the spin calms ahead of the arrival". It pins the *shape* of the decay curve, so if someone swaps `easeOutQuart` for something else, this test is what tells them the closed form in Step 3 no longer matches.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/animation.test.js`

Expected: FAIL. Vitest reports `entranceRevolutions is not a function` (or an import/export error) on every new case. The seven existing `entranceState` cases must still be listed as passing — if any of them fails, you edited something you should not have; revert and retry.

- [ ] **Step 3: Write the implementation**

Append to `src/animation.js`, after `entranceState`:

```js
// Revolutions covered from t = 0 to `elapsed`: the exact integral of the
// entrance's spin-speed curve, `lerp(startSpin, endSpin, easeOutQuart(p))`.
// The (1 - p)^5 / 5 term is easeOutQuart's antiderivative, so this is only
// valid while the spin decays on quart — see the plan's Global Constraints.
// Beyond `duration` it returns the constant total; the idle drift is added by
// the caller, not accumulated here.
export function entranceRevolutions(elapsed, opts) {
  const p = clamp01(elapsed / opts.duration);
  const remaining = 1 - p;
  const remainingPow5 = remaining * remaining * remaining * remaining * remaining;
  const eased = p - (1 - remainingPow5) / 5;

  return opts.duration * (opts.startSpin * p + (opts.endSpin - opts.startSpin) * eased);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/animation.test.js`

Expected: PASS, all cases — the seven pre-existing `entranceState` cases plus the seven new ones.

- [ ] **Step 5: Commit**

```bash
git add src/animation.js tests/animation.test.js
git commit -m "feat: add closed-form entrance revolutions integral"
```

---

### Task 2: `entranceRotation` — the deterministic landing pose

With the revolutions integral in hand, the rotation is written backwards from the target pose instead of forwards from an arbitrary start:

```
remaining(t) = A(D) - A(min(t, D))     // revolutions still to be covered

yaw(t)   = settleYaw   - 2PI * remaining(t) + 2PI * endSpin * max(0, t - D)
pitch(t) = settlePitch - tumbleRatio * 2PI * remaining(t)
```

At `t = D`, `remaining` is exactly `0`, so both angles land on the target with **zero** floating-point error — better than the 1e-9 the spec asks for, and identical for every `startSpin`, which is the proof that the speed change and the pose change are decoupled.

Two consequences worth understanding before you write it:

- **The starting yaw is a large negative number** (about `-21.8` rad with the shipped values), not a value reduced modulo 2PI. That is deliberate: reducing it would buy nothing visually (a rotation of `-21.82` rad and `3.31` rad are the same pose) while costing the exactness at `t = D` and making `yaw` non-monotonic. The cube is off-screen for the first ~0.35 s anyway, so no one sees the start angle.
- **The pitch freezes on its own.** Once `t >= D`, `remaining` is pinned at `0`, so `pitch` is a constant `settlePitch` forever. There is no branch, no `if (done)`. This is the whole of Change 3 in the spec.

**Files:**
- Modify: `src/animation.js` (append after `entranceRevolutions`)
- Test: `tests/animation.test.js` (append a third `describe` block)

**Interfaces:**
- Consumes: `entranceRevolutions(elapsed, opts)` from Task 1.
- Produces: `entranceRotation(elapsed, opts) -> { yaw, pitch }`, both in radians, where `opts` is `{ duration, startSpin, endSpin, settleYaw, settlePitch, tumbleRatio }`. `yaw` increases without bound and is never reduced modulo 2PI. `pitch` is constant at `settlePitch` for `elapsed >= duration`. Roll is not returned — it is always `0` and `main.js` passes the literal.

- [ ] **Step 1: Write the failing tests**

Append to `tests/animation.test.js`. Extend the import to `import { entranceRevolutions, entranceRotation, entranceState } from '../src/animation.js';`

```js
const TAU = Math.PI * 2;

const ROT_OPTS = {
  duration: 3.5,
  startSpin: 5.0,
  endSpin: 0.035,
  settleYaw: Math.PI / 4,
  settlePitch: (15 * Math.PI) / 180,
  tumbleRatio: 0.35,
};

// Reduce to the cube's 90-degree yaw symmetry: any two angles a multiple of
// PI/2 apart are the same pose, so this is the angle that decides what you see.
function yawModQuarterTurn(angle) {
  const quarter = Math.PI / 2;
  return ((angle % quarter) + quarter) % quarter;
}

describe('entranceRotation', () => {
  it('lands edge-on regardless of how fast the entrance started', () => {
    for (const startSpin of [3, 5, 8]) {
      const opts = { ...ROT_OPTS, startSpin };
      const { yaw } = entranceRotation(opts.duration, opts);
      expect(yawModQuarterTurn(yaw)).toBeCloseTo(Math.PI / 4, 9);
    }
  });

  it('lands on the settle pitch exactly', () => {
    expect(entranceRotation(ROT_OPTS.duration, ROT_OPTS).pitch).toBe(ROT_OPTS.settlePitch);
  });

  it('freezes the vertical tumble once settled', () => {
    const atArrival = entranceRotation(ROT_OPTS.duration, ROT_OPTS).pitch;
    expect(entranceRotation(ROT_OPTS.duration + 60, ROT_OPTS).pitch).toBe(atArrival);
    expect(entranceRotation(ROT_OPTS.duration + 600, ROT_OPTS).pitch).toBe(atArrival);
  });

  it('drifts horizontally at exactly endSpin after the entrance', () => {
    const atArrival = entranceRotation(ROT_OPTS.duration, ROT_OPTS).yaw;
    const tenSecondsLater = entranceRotation(ROT_OPTS.duration + 10, ROT_OPTS).yaw;
    expect(tenSecondsLater - atArrival).toBeCloseTo(10 * ROT_OPTS.endSpin * TAU, 9);
  });

  it('reaches the same landing pose at 30 fps and at 144 fps', () => {
    // Ask for the rotation once per simulated frame, so the two rates drive
    // different call sequences: a stateful per-frame accumulator would land
    // somewhere different at each rate, while a closed form cannot.
    const sampleAtArrival = (step) => {
      let t = 0;
      let rotation = entranceRotation(t, ROT_OPTS);
      while (t < ROT_OPTS.duration) {
        t = Math.min(t + step, ROT_OPTS.duration);
        rotation = entranceRotation(t, ROT_OPTS);
      }
      return rotation;
    };
    const slow = sampleAtArrival(1 / 30);
    const fast = sampleAtArrival(1 / 144);
    expect(slow.yaw).toBeCloseTo(fast.yaw, 12);
    expect(slow.pitch).toBeCloseTo(fast.pitch, 12);
    expect(slow.yaw).toBeCloseTo(entranceRotation(ROT_OPTS.duration, ROT_OPTS).yaw, 12);
  });

  it('turns one way only, through the entrance and on into the idle drift', () => {
    const samples = [0, 0.35, 1, 1.75, 2.5, 3.5, 10, 60].map(
      (t) => entranceRotation(t, ROT_OPTS).yaw
    );
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it('tumbles through the entrance before settling', () => {
    const start = entranceRotation(0, ROT_OPTS);
    const mid = entranceRotation(1.75, ROT_OPTS);
    expect(start.pitch).toBeLessThan(mid.pitch);
    expect(mid.pitch).toBeLessThan(ROT_OPTS.settlePitch);
    expect(start.yaw).toBeCloseTo(
      ROT_OPTS.settleYaw - TAU * entranceRevolutions(ROT_OPTS.duration, ROT_OPTS),
      9
    );
  });

  it('holds the pose steady while only the idle drift advances', () => {
    const a = entranceRotation(100, ROT_OPTS);
    const b = entranceRotation(200, ROT_OPTS);
    expect(b.pitch).toBe(a.pitch);
    expect(b.yaw - a.yaw).toBeCloseTo(100 * ROT_OPTS.endSpin * TAU, 9);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/animation.test.js`

Expected: FAIL — `entranceRotation is not a function` on all eight new cases. Task 1's `entranceRevolutions` cases and the original `entranceState` cases still pass.

- [ ] **Step 3: Write the implementation**

Append to `src/animation.js`:

```js
const TAU = Math.PI * 2;

// The entrance rotation, written backwards from the pose it must land on: what
// is left to cover, rather than what has been covered. `remaining` hits exactly
// 0 at `duration`, so the cube arrives on `settleYaw`/`settlePitch` with no
// floating-point slack and no dependence on frame rate or on `startSpin`.
//
// After the entrance `remaining` is pinned at 0: the pitch is frozen on
// `settlePitch` forever and only the yaw advances, at `endSpin`. That is the
// horizontal-only idle float — no branch needed.
//
// `yaw` is deliberately NOT reduced modulo 2PI. The starting value is a large
// negative angle, which is the same pose as its reduced form, and the cube is
// off-screen for the first ~0.35 s regardless; reducing it would break the
// exact landing and make the angle non-monotonic.
export function entranceRotation(elapsed, opts) {
  const total = entranceRevolutions(opts.duration, opts);
  const remaining = total - entranceRevolutions(elapsed, opts);
  const idleRevolutions = Math.max(0, elapsed - opts.duration) * opts.endSpin;

  return {
    yaw: opts.settleYaw - TAU * remaining + TAU * idleRevolutions,
    pitch: opts.settlePitch - opts.tumbleRatio * TAU * remaining,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`

Expected: PASS, whole suite (7 files). `tests/animation.test.js` now holds the original `entranceState` cases plus Task 1's and Task 2's.

- [ ] **Step 5: Commit**

```bash
git add src/animation.js tests/animation.test.js
git commit -m "feat: land the entrance on a deterministic cube pose"
```

---

### Task 3: Wire it up — config, the render loop, and the pose itself

This task ships the change. It moves together on purpose: renaming `SPIN_TILT_RATIO` breaks `main.js`'s import the moment it lands, so config and wiring cannot be separate commits without leaving the build red in between.

The target pose, one more time, so you can check the numbers you are typing:

| Axis | Value | Why |
| --- | --- | --- |
| `rotation.x` (pitch) | `+15 deg` = `0.2617993877991494` rad | Positive tilts the **top** face toward the camera. Negative would show the bottom. |
| `rotation.y` (yaw) | `45 deg` = `Math.PI / 4` | The two visible side faces then project equally (`+/-0.683` on the camera axis), putting the vertical edge between them dead centre. |
| `rotation.z` (roll) | `0` | Non-zero roll makes the top-face normal depend on yaw, and the tilt wobbles as the cube turns. |

**Files:**
- Modify: `src/config.js`
- Modify: `src/main.js:1-11` (imports), `:33` (delete), `:62` (delete), `:73-77` (rotation source)
- Create: `tests/pose.test.js`

**Interfaces:**
- Consumes: `entranceRotation` (Task 2), `entranceState`, `createScene`, `createParallax` — all unchanged in signature.
- Produces: `src/config.js` exports `SETTLE` (`{ yaw, pitch }`, radians) and `ENTRANCE_TUMBLE_RATIO` (number). `SPIN_TILT_RATIO` no longer exists. `ENTRANCE.startSpin` is `5.0`.

- [ ] **Step 1: Write the failing pose test**

Create `tests/pose.test.js`:

```js
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
```

That last case is what justifies the Euler-order constraint: it passes on `XYZ` with roll `0` and fails on orders that carry the tilt axis around with the yaw.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/pose.test.js`

Expected: FAIL — `SETTLE` is undefined, so every case throws on `SETTLE.pitch`.

- [ ] **Step 3: Update the config**

Edit `src/config.js`. Change `startSpin` inside `ENTRANCE`:

```js
export const ENTRANCE = {
  duration: 3.5,
  endY: 0,
  startScale: 0.15,
  endScale: 1,
  // 5.7 rev/s is the hard ceiling: the cube's yaw is 90-degree symmetric, so
  // past 45 degrees of yaw per rendered frame the spin reads as running
  // backwards, and by the time the cube enters frame (~0.35 s) easeOutQuart has
  // already cut the speed to 0.656 of this value. 5.0 stays legible at 30 fps.
  startSpin: 5.0,
  endSpin: 0.035,
};
```

Then replace the `SPIN_TILT_RATIO` line (currently `src/config.js:27`) with:

```js
// The pose the entrance lands on: a vertical edge facing the camera (yaw is a
// quarter turn offset by 45 degrees) with the top face tilted into view.
// Positive pitch shows the top; negative would show the bottom.
export const SETTLE = {
  yaw: Math.PI / 4,
  pitch: (15 * Math.PI) / 180,
};

// Vertical tumble during the entrance only, as a fraction of the yaw covered.
// It terminates on SETTLE.pitch; after the entrance nothing but the yaw moves.
export const ENTRANCE_TUMBLE_RATIO = 0.35;
```

Leave `COLORS`, `PARALLAX`, `CUBE_SIZE`, `CUBE_RADIUS`, `FIT_MARGIN`, `CAMERA_FOV`, `MAX_PIXEL_RATIO`, and `MAX_FRAME_DELTA` exactly as they are.

- [ ] **Step 4: Run the pose test to verify it passes**

Run: `npm test -- tests/pose.test.js`

Expected: PASS, six cases.

- [ ] **Step 5: Verify the rename actually broke `main.js`**

Run: `npm run build`

Expected: FAIL — Vite/Rollup reports that `SPIN_TILT_RATIO` is not exported by `src/config.js`. This is the point: it proves nothing else in the tree still reads the old name, and it is what Step 6 fixes. If the build *succeeds* here, `main.js` was already edited out of order — check `git diff` before continuing.

- [ ] **Step 6: Rewire the render loop**

Edit `src/main.js`. Replace the config import block (`:3-9`) and the animation import (`:10`):

```js
import {
  ENTRANCE,
  ENTRANCE_TUMBLE_RATIO,
  MAX_FRAME_DELTA,
  MAX_PIXEL_RATIO,
  PARALLAX,
  SETTLE,
} from './config.js';
import { entranceRotation, entranceState } from './animation.js';
```

Add the rotation options next to the other module-level setup, just after `const timer = new THREE.Timer();`:

```js
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
```

Delete `let spinAngle = 0;` (`:33`) entirely — keep `let elapsed = 0;`.

In `frame()`, delete the accumulator line `spinAngle += state.spinSpeed * Math.PI * 2 * dt;` (`:62`) and read the rotation instead. The body becomes:

```js
function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), MAX_FRAME_DELTA);
  elapsed += dt;

  const state = entranceState(elapsed, { ...ENTRANCE, startY: view.startY });
  // Closed form, not an accumulator: the cube lands on the exact same pose at
  // any frame rate, and the vertical tumble stops dead when the entrance ends.
  const rotation = entranceRotation(elapsed, ROTATION);

  const pointer = parallax.update(dt);
  const pointerWeight = state.progress;

  view.cube.position.set(
    pointer.offsetX * pointerWeight,
    state.y + pointer.offsetY * pointerWeight,
    0
  );
  view.cube.scale.setScalar(state.scale);
  view.cube.rotation.set(
    rotation.pitch + pointer.tiltX * pointerWeight,
    rotation.yaw + pointer.tiltY * pointerWeight,
    0
  );

  renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}
```

`dt` is still used (by `elapsed` and by `parallax.update`), so keep it. `state.spinSpeed` is now unread by `main.js` — that is expected, and `entranceState` still returns it.

Do not touch anything else in the file: the WebGL try/catch, `applyViewportSize`, `recentrePointer`, and all six event listeners stay byte-identical.

- [ ] **Step 7: Run the full suite and the build**

Run: `npm test`

Expected: PASS — 8 test files now (`pose.test.js` is new), every case green, including the untouched `entranceState` cases.

Run: `npm run build`

Expected: exit 0, `dist/` written, no chunk-size warning (the bundle is ~525 kB / ~132 kB gzipped against a 600 kB limit; this change adds a few lines of arithmetic).

- [ ] **Step 8: Confirm it on the live page**

Run: `npm run dev` and open the printed URL. Watch one full entrance (reload to replay it) and check all five:

1. The cube spins visibly faster at the top of the screen than before, and the slowdown into the centre reads as an arrest rather than a fade. The spin never appears to run *backwards*.
2. When it settles, a vertical **edge** points at you — not a flat face.
3. You can see the **top** face. If you are looking at the bottom, the pitch sign is flipped.
4. Leave it alone for ~15 s with the pointer off the window: the cube turns horizontally only. No vertical rocking, no tumble. (It will drift off edge-on and reach face-on about 3.6 s after arrival — that is the intended behavior, decision A.)
5. Move the pointer around: the cube still leans and shifts toward it on both axes, and eases back to centre when the pointer leaves the window.

Stop the dev server when done.

- [ ] **Step 9: Commit**

```bash
git add src/config.js src/main.js tests/pose.test.js
git commit -m "feat: ship the edge-on landing pose and horizontal-only idle spin"
```

---

### Task 4: Record the decisions

The pose and the section-7 answer are product decisions, not implementation detail — they belong in the two files a future reader starts from.

**Files:**
- Modify: `AGENTS.md` (the `## Decisions (resolved 2026-08-28)` list)
- Modify: `README.md` (the `src/animation.js` and `src/config.js` layout bullets, and `## Design direction`)

**Interfaces:**
- Consumes: the shipped behavior from Task 3.
- Produces: documentation only. No code, no tests.

- [ ] **Step 1: Update `AGENTS.md`**

In the `## Decisions (resolved 2026-08-28)` list, replace the existing `**Entrance:**` bullet with:

```markdown
- **Entrance:** 3.5s slow cinematic ease-out. Position and scale on ease-out cubic; spin
  speed on ease-out quart (5.0 -> 0.035 rev/s) so the rotation calms just ahead of the
  arrival. 5.7 rev/s is the hard ceiling on the start speed: the cube's yaw is 90-degree
  symmetric, so a faster spin reads as running backwards on a 30 fps display.
```

Then add these two bullets immediately after it:

```markdown
- **Resting pose:** the entrance lands on a defined pose — yaw 45 deg, pitch +15 deg,
  roll 0 — so a vertical edge faces the camera with the top face visible. The rotation is
  a closed-form function of elapsed time rather than a per-frame accumulator, so the
  landing is exact and identical at any frame rate. Keep three's default `XYZ` Euler order
  with roll at 0; any other order makes the tilt wobble as the cube turns.
- **Idle rotation:** horizontal only. The vertical tumble is an entrance effect that
  terminates on the +15 deg pitch. After the entrance only the yaw advances, at
  0.035 rev/s, forever. Edge-on is the moment the cube lands on, not a pose it holds —
  it reaches face-on 3.6s later and returns to edge-on every 7.1s. (Spec section 7,
  option A: "land and drift".) Pointer parallax still tilts both axes on top of this.
```

Leave the rest of `AGENTS.md` alone — the requirements table at the top still describes the entrance accurately.

- [ ] **Step 2: Update `README.md`**

In `## Layout`, replace the `src/animation.js` bullet with:

```markdown
- `src/animation.js` — the entrance as pure functions of elapsed time: position and scale,
  plus the closed-form yaw and pitch that land the cube on its resting pose.
```

In the same list, replace the `src/config.js` bullet with:

```markdown
- `src/config.js` — every tunable number (timing, sizes, colors, parallax limits, the
  resting pose). Start here.
```

In `## Design direction`, insert this paragraph after the existing first one:

```markdown
The cube's entrance ends on a fixed pose: a vertical edge facing the viewer, tilted 15
degrees so the top face shows. From there it turns horizontally only, at 0.035 rev/s,
forever — the edge-on pose is where it lands, not where it stays.
```

- [ ] **Step 3: Verify the docs match the code**

Run: `grep -n "startSpin\|endSpin\|SETTLE" src/config.js` and re-read the two docs.

Expected: the numbers quoted in `AGENTS.md` and `README.md` are the numbers in `src/config.js` — `startSpin: 5.0`, `endSpin: 0.035`, `SETTLE.yaw = Math.PI / 4` (45 deg), `SETTLE.pitch = (15 * Math.PI) / 180`. Fix any drift before committing.

Run: `npm test`

Expected: PASS. Nothing changed in code, but confirm the tree is green before the final commit.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: record the resting pose and the idle-spin decision"
```

---

## Acceptance criteria

Check these off against the shipped branch, not against the plan:

- [ ] The entrance starts at 5.0 rev/s and reads as a harder deceleration.
- [ ] At the end of the entrance a vertical edge faces the camera and the top face is visible (15 deg down-tilt).
- [ ] The landing pose is identical across frame rates and across `startSpin` values (`tests/animation.test.js` asserts both).
- [ ] After settling, only the horizontal rotation advances; the vertical angle is constant.
- [ ] Pointer parallax still tilts and offsets the cube exactly as before, and still eases back to centre when the pointer leaves.
- [ ] `npm test` passes — 8 files, including the new `entranceRevolutions`, `entranceRotation`, and pose cases, and every pre-existing case.
- [ ] `npm run build` succeeds with no warnings.
- [ ] `SPIN_TILT_RATIO` appears nowhere in `src/` or `tests/`.
- [ ] `AGENTS.md` and `README.md` describe the pose and the idle-spin decision.

## Out of scope

Do not do these, even if they look like improvements:

- Changing `endSpin`, or replacing the idle spin with an oscillation (spec section 7 options B and C — both were considered and declined).
- Steepening the spin decay to `easeOutQuint`. It is the spec's named follow-up lever, not part of this change, and it would require re-deriving `entranceRevolutions`.
- Touching the position or scale curves, the 3.5 s duration, camera framing, colors, materials, or the background.
- Changing the parallax limits, damping, or how it layers onto the rotation.
- Adding a `prefers-reduced-motion` branch.
- Adding pages, routes, content, or a second 3D object.
