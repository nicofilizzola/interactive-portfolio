# Seamless Idle Handover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the entrance-to-idle-float handover read as one continuous settling instead of
*arrive → hold → twitch*, by ramping the float in with a `smoothStep` amplitude envelope and
starting its clock 0.7 s before the entrance ends.

**Architecture:** Two changes to one pure function. `floatOffset` today is
`amplitude * sin(TAU * max(0, t - 3.5) / period)`, which has two defects: the sine's phase 0
is its steepest point, so the bob's first instant is its fastest (24.5 px/s, first visible
pixel in 0.041 s); and the entrance is visually parked for its last ~0.5 s, so the onset
reads as a second, unrelated event. Change A1 multiplies the sine by
`smoothStep(since / rampDuration)` — `S(0) = 0` **and** `S'(0) = 0`, so position, velocity,
*and* acceleration all start at exactly zero. Change A2 moves the float's time origin from
`duration` to `duration - overlap`, so the bob emerges from the entrance's still-live motion
rather than following its corpse. Nothing else moves: no new files, no change to the
entrance's curves, duration, or landing pose, and `src/main.js` needs no edit at all because
`FLOAT_OPTS` already spreads `FLOAT`.

**Tech Stack:** Three.js 0.185 (WebGL), Vite 8 (dev server + build), Vitest 4 (unit tests),
plain JavaScript ES modules. No new dependencies. No TypeScript.

**Spec:** `docs/specs/2026-08-31-seamless-idle-and-cube-navigation.md`, **Part A only**
(§1 item 1, §3–§6, §17, §18, §19, §20 Part A, §23 Part A). Read it alongside this plan. It
supersedes `docs/review.md`. Part B of that spec (the cube as navigation) is a separate plan,
`docs/plans/2026-08-31-cube-navigation.md`, and shares no code with this one.

**Spec decisions, resolved by the product owner on 2026-08-31:**

| # | Question | Answer |
| --- | --- | --- |
| 21.9 | Part A's overlap | **`0.7` s** — where the entrance goes visually dead, and the largest value that keeps `tests/scene.test.js`'s in-frame bound |
| §4 | Ramp duration | **`1.5` s** — the knee: onset 8.1x slower than today, first upswing still reaches 97% of amplitude |

## Global Constraints

- **Language:** plain JavaScript, ES modules. No TypeScript. No new dependencies — all
  arithmetic is hand-written.
- **Runtime floor:** Node `^20.19.0 || >=22.12.0`. Tests run under Vitest in plain Node —
  no browser, no WebGL, no jsdom.
- **`src/main.js` is the only browser-coupled file, and this plan does not touch it.**
  `FLOAT_OPTS` at `src/main.js:47` is `{ ...FLOAT, duration: ENTRANCE.duration }`, so both new
  `FLOAT` keys reach `floatOffset` with no wiring.
- **Do not touch** `src/camera.js`, `src/math.js`, `src/cube.js`, `src/scene.js`,
  `src/drag.js`, `src/main.js`, `index.html`, `src/style.css`, or `vite.config.js`.
  `tests/scene.test.js` gains one test; `src/scene.js` itself does not change.
- **Do not "also fix" the entrance.** Its position and scale curves (`easeOutCubic`) already
  land with zero velocity and zero acceleration; its spin decay (`easeOutQuart`) already
  lands at zero rev/s with a zero derivative. Duration stays `3.5`, easing choices stay,
  the landing pose stays. Spec §6.
- **Keep `easeOutQuart` as the spin-decay curve.** The `(1 - p)^5 / 5` term in
  `entranceRevolutions` is its antiderivative; changing the easing invalidates the closed
  form and the exact landing pose.
- **The landing pose guarantee is the invariant this work must not break.**
  `entranceRotation(3.5)` must keep returning exactly `SETTLE.yaw` / `SETTLE.pitch`. The
  float moves neither angle — it only writes `position.y` — but Task 3 asserts it explicitly
  because it is the one invariant the previous spec was written to establish.
- **`FLOAT.amplitude` stays `0.08` and `FLOAT.period` stays `5.0`.** The overlap is pinned at
  0.7 s *by* `amplitude`; changing one without re-measuring the other breaks the in-frame bound.
- **The drag unlock at `t = 3.5` (`src/main.js:119`) stays where it is.** It is an input gate,
  not motion, and moving it earlier would break the exact landing pose.

## Known spec errata

- **Spec §4's `rampDuration` table gives "First peak 97.0% of A" for 1.5 s.** The exact value
  is `0.96977 * amplitude`, reached at `s = 1.40 s`. Task 2's test asserts the ratio to 3
  decimal places (tolerance `5e-4`), which the exact value clears; do not assert `0.970` to
  more precision than that.
- **Spec §20.5 asks for a finite-difference check that the second derivative at the float's
  onset is ~0, framed as part of the C² claim.** It is worth having, but be clear about what
  it proves: `A*sin(w*s)` has an inflection at `s = 0` too, so the *unramped* form also has
  zero acceleration there. **The velocity test (§20.4) is the only one that discriminates** —
  it is `~1.3e-9` ramped against `0.1005` unramped. Task 2 keeps both and says so in a
  comment.
- **Spec §5 gives `floatOffset(duration)` as `0.02774`.** Exact value `0.0277430`; assert to
  6 decimal places, not more.

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `src/easing.js` | Numeric easing curves, each clamping its input. | **Modify** — add `smoothStep`. |
| `src/config.js` | Every tunable number. | **Modify** — two new `FLOAT` keys. |
| `src/animation.js` | The entrance and the float as pure functions of elapsed time. | **Modify** — rewrite `floatOffset`; delete the stale comment at `:58-62`. |
| `tests/easing.test.js` | Easing curve properties. | **Modify** — a `smoothStep` block. |
| `tests/animation.test.js` | Entrance and float behaviour. | **Modify** — the whole `floatOffset` describe block, plus one case in `entranceRotation`. |
| `tests/scene.test.js` | Framing and the in-frame bound. | **Modify** — one new test inside the existing file. |
| `AGENTS.md`, `README.md` | Spec of record and orientation. | **Modify** — Task 4. |

No new files. No file is deleted.

---

### Task 1: `smoothStep` — an envelope whose velocity starts at zero

**Files:**
- Modify: `src/easing.js`
- Test: `tests/easing.test.js`

**Interfaces:**
- Consumes: `clamp01` from `src/math.js` (already imported at `src/easing.js:1`).
- Produces: `smoothStep(t) -> number`, exported from `src/easing.js`. Task 2 imports it into
  `src/animation.js`.

**Why this curve and not an existing one.** `S(u) = u^2 * (3 - 2u)` is the only shape needed
here, and the reason is its *derivative*: `S(0) = 0` **and** `S'(0) = 0`. A plain linear ramp
gives `S'(0) = 1/T != 0` and would only fix the float's position at the onset — the velocity
step would shrink but not vanish, which is the whole defect. `easeOutCubic` and
`easeOutQuart` both have a *maximum* derivative at `t = 0`, so neither can be reused.

- [ ] **Step 1: Write the failing test**

Extend the import on `tests/easing.test.js:2`:

```js
import { easeOutCubic, easeOutQuart, smoothStep } from '../src/easing.js';
```

Append to `tests/easing.test.js`:

```js
describe('smoothStep', () => {
  it('maps the unit interval onto itself, symmetric about the midpoint', () => {
    expect(smoothStep(0)).toBe(0);
    expect(smoothStep(1)).toBe(1);
    expect(smoothStep(0.5)).toBe(0.5);
  });

  it('clamps out-of-range input instead of overshooting', () => {
    expect(smoothStep(-1)).toBe(0);
    expect(smoothStep(4)).toBe(1);
  });

  // The whole reason this curve exists rather than a linear ramp: an envelope
  // with a non-zero derivative at 0 only removes the float's position step, not
  // its velocity step.
  it('leaves and arrives with zero slope', () => {
    const h = 1e-6;
    expect((smoothStep(h) - smoothStep(0)) / h).toBeLessThan(1e-4);
    expect((smoothStep(1) - smoothStep(1 - h)) / h).toBeLessThan(1e-4);
  });

  it('rises monotonically', () => {
    let previous = -1;
    for (let i = 0; i <= 100; i += 1) {
      const value = smoothStep(i / 100);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/easing.test.js`
Expected: FAIL — `smoothStep is not a function` on every case in the new block. The
`easeOutCubic` and `easeOutQuart` blocks still pass.

- [ ] **Step 3: Write minimal implementation**

Append to `src/easing.js`:

```js
// The float's amplitude envelope. S(0) = 0 and S'(0) = 0, so multiplying a sine
// by S(s / T) makes the float's position, velocity, AND acceleration all start
// at exactly zero — the bob does not switch on, it emerges. A linear ramp would
// give S'(0) = 1/T and only fix the position.
export function smoothStep(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/easing.test.js`
Expected: PASS — 4 new cases plus the 6 existing ones.

- [ ] **Step 5: Commit**

```bash
git add src/easing.js tests/easing.test.js
git commit -m "feat: add smoothStep easing for the float's amplitude envelope"
```

---

### Task 2: Ramp the float in with the amplitude envelope

**Files:**
- Modify: `src/config.js:31-38` (the `FLOAT` block, comment included)
- Modify: `src/animation.js:2` (import) and `src/animation.js:58-66` (the comment and `floatOffset`)
- Test: `tests/animation.test.js` — replace the whole `describe('floatOffset', ...)` block, currently `:207-241`

**Interfaces:**
- Consumes: `smoothStep` from Task 1.
- Produces: `floatOffset(elapsed, opts) -> number` keeps its signature. `opts` now also reads
  `opts.rampDuration` and `opts.overlap`. `FLOAT` gains `rampDuration: 1.5` and `overlap: 0`.
  Task 3 changes `overlap` to `0.7` and nothing else.

**Why `overlap: 0` in this task.** The final formula is written once, here, so Task 3 is a
one-number config change plus its tests. With `overlap: 0` the envelope is the only behaviour
change, every existing `floatOffset` assertion about `t <= duration` still holds, and the two
changes stay independently reviewable — which is what spec §4's "set it to 0 and this section
stands alone" is for.

- [ ] **Step 1: Write the failing test**

Replace the whole `describe('floatOffset', ...)` block in `tests/animation.test.js` with this.
`FLOAT_OPTS` now carries all five keys:

```js
describe('floatOffset', () => {
  const FLOAT_OPTS = {
    duration: 3.5,
    amplitude: 0.08,
    period: 5.0,
    rampDuration: 1.5,
    overlap: 0,
  };
  const onset = FLOAT_OPTS.duration - FLOAT_OPTS.overlap;

  it('is exactly zero until its own onset, and exactly zero at it', () => {
    expect(floatOffset(0, FLOAT_OPTS)).toBe(0);
    expect(floatOffset(1.75, FLOAT_OPTS)).toBe(0);
    expect(floatOffset(onset, FLOAT_OPTS)).toBe(0);
  });

  it('treats negative elapsed time as the start of the entrance', () => {
    expect(floatOffset(-2, FLOAT_OPTS)).toBe(0);
  });

  it('starts moving within a millisecond of the onset', () => {
    expect(floatOffset(onset + 0.001, FLOAT_OPTS)).toBeGreaterThan(0);
  });

  // THE TEST THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT. The unramped form's
  // velocity at its onset is amplitude * TAU / period = 0.1005 u/s, which is
  // where the whole "arrive, then twitch" reads from. The envelope's S'(0) = 0
  // drives it to ~1.3e-9.
  it('has zero velocity at the float onset', () => {
    const h = 1e-4;
    const ramped = (floatOffset(onset + h, FLOAT_OPTS) - floatOffset(onset, FLOAT_OPTS)) / h;
    expect(Math.abs(ramped)).toBeLessThan(1e-6);

    const unramped =
      (FLOAT_OPTS.amplitude * Math.sin((2 * Math.PI * h) / FLOAT_OPTS.period)) / h;
    expect(unramped).toBeGreaterThan(0.1);
  });

  // Part of the C^2 claim (spec section 4). Note what it does NOT prove: sin has
  // an inflection at 0, so the unramped form also has zero acceleration here.
  // The velocity case above is the discriminating one.
  it('has zero acceleration at the float onset', () => {
    const h = 1e-4;
    const second =
      (floatOffset(onset + 2 * h, FLOAT_OPTS) -
        2 * floatOffset(onset + h, FLOAT_OPTS) +
        floatOffset(onset, FLOAT_OPTS)) /
      (h * h);
    expect(Math.abs(second)).toBeLessThan(1e-3);
  });

  it('clips its first upswing to 97% of the amplitude, and peaks late', () => {
    // The envelope moves the first peak off the quarter period: 1.40 s past the
    // onset, not 1.25 s, at 0.96977 * amplitude. Tolerance 5e-4 (3 places).
    const firstPeak = floatOffset(onset + 1.4, FLOAT_OPTS);
    expect(firstPeak / FLOAT_OPTS.amplitude).toBeCloseTo(0.97, 3);
    expect(firstPeak).toBeGreaterThan(floatOffset(onset + 1.3, FLOAT_OPTS));
    expect(firstPeak).toBeGreaterThan(floatOffset(onset + 1.5, FLOAT_OPTS));
  });

  it('attenuates the first quarter period by exactly smoothStep(5/6)', () => {
    // smoothStep(1.25 / 1.5) = (25/36) * (4/3) = 100/108, exactly.
    const quarter = onset + FLOAT_OPTS.period / 4;
    expect(floatOffset(quarter, FLOAT_OPTS)).toBeCloseTo(
      FLOAT_OPTS.amplitude * (100 / 108),
      9
    );
  });

  it('still crosses centre at the half period', () => {
    const half = onset + FLOAT_OPTS.period / 2;
    expect(floatOffset(half, FLOAT_OPTS)).toBeCloseTo(0, 9);
  });

  it('reaches full amplitude once the ramp is over', () => {
    // 3.75 s past the onset the envelope has been clamped at 1 for 2.25 s, so
    // the trough is exactly -amplitude.
    const threeQuarters = onset + (3 * FLOAT_OPTS.period) / 4;
    expect(floatOffset(threeQuarters, FLOAT_OPTS)).toBeCloseTo(-FLOAT_OPTS.amplitude, 9);

    const secondCrest = onset + FLOAT_OPTS.period + FLOAT_OPTS.period / 4;
    expect(floatOffset(secondCrest, FLOAT_OPTS)).toBeCloseTo(FLOAT_OPTS.amplitude, 9);
  });

  it('never exceeds the amplitude, out to ten minutes', () => {
    for (let i = 0; i <= 1000; i += 1) {
      const t = (i / 1000) * 600;
      expect(Math.abs(floatOffset(t, FLOAT_OPTS))).toBeLessThanOrEqual(FLOAT_OPTS.amplitude);
    }
  });

  it('is continuous across its onset', () => {
    expect(floatOffset(onset + 1e-9, FLOAT_OPTS)).toBeCloseTo(0, 12);
  });

  it('is a strict generalisation: no ramp and no overlap is the bare sine', () => {
    const bare = { ...FLOAT_OPTS, overlap: 0, rampDuration: 1e-9 };
    for (const s of [0.5, 1.25, 2.5, 3.75, 7.5]) {
      expect(floatOffset(FLOAT_OPTS.duration + s, bare)).toBeCloseTo(
        FLOAT_OPTS.amplitude * Math.sin((2 * Math.PI * s) / FLOAT_OPTS.period),
        9
      );
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/animation.test.js`
Expected: FAIL — `has zero velocity at the float onset` reports roughly `0.1005` for the
ramped value; `clips its first upswing` reports `1` instead of `0.97`; `attenuates the first
quarter period` reports `0.08` instead of `0.0740741`. The `entranceState`,
`entranceRevolutions`, and `entranceRotation` blocks still pass.

- [ ] **Step 3: Write minimal implementation, part 1 — the config**

Replace the whole `FLOAT` block in `src/config.js` (`:31-38`, comment included):

```js
// The idle vertical bob: the page's only autonomous motion once the entrance
// ends. `amplitude` is in world units, deliberately sized against the cube
// (0.16 peak-to-peak = 10% of CUBE_SIZE) rather than against the viewport, so
// that changing FIT_MARGIN does not silently change how large the bob reads.
//
// `rampDuration` is the smoothStep amplitude envelope. It exists because phase 0
// of a sine is its STEEPEST point: unramped, the bob's first instant was its
// fastest (0.1005 u/s, one visible pixel in 0.041 s) and the motion switched on
// rather than beginning. 1.5 s is the knee — the onset is 8.1x slower while the
// first upswing still reaches 97% of the amplitude, so the bob does not look
// like it is warming up for two cycles. Past 2.0 s the first peak is visibly
// clipped and the first cycle reads as a different size from the later ones.
export const FLOAT = {
  amplitude: 0.08,
  period: 5.0,
  rampDuration: 1.5,
  overlap: 0,
};
```

- [ ] **Step 4: Write minimal implementation, part 2 — the function**

Extend the import on `src/animation.js:2`:

```js
import { easeOutCubic, easeOutQuart, smoothStep } from './easing.js';
```

**Delete** the comment at `src/animation.js:58-62` entirely. Do not amend around it: it argues
for the behaviour this change removes, comparing the velocity step against the entrance's
*peak* velocity when the comparison that matters is against its *terminal* velocity, which is
exactly zero. Replace it and `floatOffset` with:

```js
// The idle vertical bob. Two things keep it from reading as an event separate
// from the entrance.
//
// The smoothStep envelope: phase 0 of a sine is its steepest point, so an
// unramped bob's first instant is its fastest. S(0) = 0 and S'(0) = 0, and every
// term of y' and y'' at s = 0 carries a factor of S(0), S'(0), or sin(0), so
// position, velocity, and acceleration all start at exactly zero. The entrance
// also arrives with zero velocity and zero acceleration, so the total vertical
// motion is C^2 across the whole timeline.
//
// `overlap`: the float's clock starts that many seconds BEFORE the entrance
// ends, so the bob emerges from motion that is still live rather than following
// its corpse. See src/config.js for why 0.7 s is a ceiling and not taste.
export function floatOffset(elapsed, opts) {
  const since = elapsed - (opts.duration - opts.overlap);
  if (since <= 0) return 0;

  const envelope = smoothStep(since / opts.rampDuration);
  return opts.amplitude * envelope * Math.sin((TAU * since) / opts.period);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS, whole suite. `tests/scene.test.js` still passes unchanged — with `overlap: 0`
nothing about the in-frame bound has moved yet.

- [ ] **Step 6: Commit**

```bash
git add src/config.js src/animation.js tests/animation.test.js
git commit -m "fix: ramp the idle float in so no motion switches on"
```

---

### Task 3: Overlap the float with the entrance tail

**Files:**
- Modify: `src/config.js` (`FLOAT.overlap`, `0` -> `0.7`)
- Test: `tests/animation.test.js` (the `floatOffset` block's `FLOAT_OPTS`, plus two cases; one case in `entranceRotation`)
- Test: `tests/scene.test.js` (import line `:5`, plus one new test)

**Interfaces:**
- Consumes: `floatOffset` and the `FLOAT` shape from Task 2. No signature changes.
- Produces: nothing new. `FLOAT.overlap` is `0.7`, and `floatOffset(3.5)` is `0.0277430`
  rather than `0`.

**What this buys, and what it costs.** By `p = 0.80` (`t = 2.80 s`) the entrance is within
7.4 px of centre at 99.7% scale, turning at 2.6 deg/s with 0.36 deg of yaw left — visually
parked. It then sits still for the remaining 0.7 s before the bob starts, so the viewer sees
*arrive → hold → twitch*, three beats, where the intent is one continuous settling. Moving
the float's origin to `t = 2.80` costs nothing legible from the entrance and buys the whole
dead beat back.

The cost is that three things stop being exactly zero at `t = 3.5`, deliberately:
`floatOffset(3.5)` becomes `0.0277430` (6.76 px at 1080p); the cube's `y` at the end of the
entrance is no longer `ENTRANCE.endY` (nothing depends on this — `endY` remains the
*entrance's* target, which it still hits exactly); and the old "continuous at `t = duration`"
assertion is void, already replaced in Task 2 by continuity at the real onset.

**Why 0.7 s is the ceiling.** Through the overlap the entrance's offset and the float's first
(upward) half-cycle are both positive and add. Two separate maxima have to stay under
`FLOAT.amplitude` = 0.08:

| Term | Value | Worst case |
| --- | --- | --- |
| Entrance offset at the onset | `startY * (1 - easeOutCubic(0.8))` = `startY * 0.008` | tallest tested viewport `280x1000` gives `startY` 9.503, so **0.0760** |
| The float's own first peak | `0.96977 * amplitude` | **0.0776**, at `t = 4.20`, after the entrance has ended |

Both clear 0.08, the tighter by 3%. At `overlap` 1.0 s the sum reaches 0.0887 and
`tests/scene.test.js:56`'s bound must be widened too. **Do not raise `overlap` past 0.7 s,
and do not raise `FIT_MARGIN` (which raises `startY`), without re-deriving both rows.**

- [ ] **Step 1: Write the failing test**

In `tests/animation.test.js`, change the `floatOffset` block's `FLOAT_OPTS` to the shipped
overlap — one line:

```js
    overlap: 0.7,
```

Append these two cases inside the same `describe('floatOffset', ...)` block:

```js
  it('is already off centre when the entrance ends — the overlap, deliberately', () => {
    // Was exactly 0 before the overlap existed. 0.0277430 u is 6.76 px at
    // 1920x1080. The entrance still lands its own target endY exactly; this is
    // the float sitting on top of it.
    expect(floatOffset(FLOAT_OPTS.duration, FLOAT_OPTS)).toBeCloseTo(0.027743, 6);
  });

  it('starts before the entrance ends, not after', () => {
    expect(onset).toBeCloseTo(2.8, 12);
    expect(onset).toBeLessThan(FLOAT_OPTS.duration);
  });
```

Add this case to the existing `describe('entranceRotation', ...)` block. It is the invariant
the previous spec was written to establish, asserted here because Part A is the change most
likely to be blamed for breaking it:

```js
  it('lands the exact resting pose — the float moves neither angle', () => {
    const landed = entranceRotation(ROT_OPTS.duration, ROT_OPTS);
    expect(landed.yaw).toBe(ROT_OPTS.settleYaw);
    expect(landed.pitch).toBe(ROT_OPTS.settlePitch);
  });
```

In `tests/scene.test.js`, extend the config import at `:5` and add an animation import:

```js
import { CAMERA_FOV, COLORS, CUBE_RADIUS, ENTRANCE, FLOAT } from '../src/config.js';
import { entranceState, floatOffset } from '../src/animation.js';
```

Then add this test inside the existing `describe('createScene', ...)` block:

```js
  it('keeps the entrance tail plus the overlapping float inside the float bound', () => {
    const view = createScene(1600, 900);

    for (const [w, h] of [[2133, 1012], [1600, 900], [900, 900], [390, 844], [280, 1000]]) {
      view.resize(w, h);
      const entranceOpts = { ...ENTRANCE, startY: view.startY };
      const floatOpts = { ...FLOAT, duration: ENTRANCE.duration };

      // Through the overlap the entrance offset and the float's first upward
      // half-cycle are both positive and ADD. This is the constraint that pins
      // FLOAT.overlap at 0.7 s: raise it, or raise FIT_MARGIN (which raises
      // startY), and this fails before anything visibly leaves the frame.
      let peak = 0;
      const onset = ENTRANCE.duration - FLOAT.overlap;
      for (let i = 0; i <= 2000; i += 1) {
        const t = onset + (i / 2000) * (FLOAT.period / 2);
        const sum = entranceState(t, entranceOpts).y + floatOffset(t, floatOpts);
        if (sum > peak) peak = sum;
      }

      expect(peak).toBeLessThan(FLOAT.amplitude);
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/animation.test.js tests/scene.test.js`
Expected: FAIL — `is already off centre when the entrance ends` reports `0` against
`0.027743`, and `starts before the entrance ends` reports `onset` as `3.5`. The new
`scene.test.js` case *passes* already at `overlap: 0` (the peak is then the entrance offset
alone); it is the guard for this change, not a driver of it.

- [ ] **Step 3: Write minimal implementation**

In `src/config.js`, change `FLOAT.overlap` from `0` to `0.7` and record why:

```js
export const FLOAT = {
  amplitude: 0.08,
  period: 5.0,
  rampDuration: 1.5,
  // The float's clock starts 0.7 s BEFORE the entrance ends. By p = 0.80
  // (t = 2.80 s) the cube is within 7.4 px of centre at 99.7% scale, turning at
  // 2.6 deg/s — visually parked — and it then sat still for the remaining 0.7 s
  // before the bob switched on. The viewer saw arrive / hold / twitch, three
  // beats, where the intent is one continuous settling. The overlap costs
  // nothing legible from the entrance and buys the whole dead beat back.
  //
  // 0.7 is the CEILING, not a taste knob. Through the overlap the entrance
  // offset and the float's first upward half-cycle add, and two maxima have to
  // stay under `amplitude`: the entrance offset at the onset (startY * 0.008,
  // worst 0.0760 at a 280x1000 viewport) and the float's own first peak
  // (0.96977 * amplitude = 0.0776). At 1.0 s the sum reaches 0.0887 and the
  // bound in tests/scene.test.js must be widened too. Raising FIT_MARGIN raises
  // startY and eats the same headroom.
  //
  // Consequence, deliberate: floatOffset(3.5) is 0.0277430, not 0.
  overlap: 0.7,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, whole suite, 8 files. Confirm in the output that `tests/animation.test.js`'s
`floatOffset` block runs 14 cases and `tests/scene.test.js` runs 7.

- [ ] **Step 5: Verify by eye, which the suite cannot do**

Run: `npm run dev`, open the printed URL, and hard-reload.

Watch for: the cube arriving with no pause before the bob; no instant at which the vertical
motion switches on; no identifiable moment where the entrance ends. Then reload at a narrow
window (drag the browser to roughly 400 px wide, then to roughly 300 px) and confirm the cube
never clips the top or bottom edge.

Spec §3 is a measurement, not a verdict — if the transition still reads as two events the
knob is `FLOAT.overlap`, but read the ceiling comment above before raising it past 0.7.

- [ ] **Step 6: Commit**

```bash
git add src/config.js tests/animation.test.js tests/scene.test.js
git commit -m "fix: overlap the idle float with the entrance tail"
```

---

### Task 4: Bring `AGENTS.md` and `README.md` back in line

**Files:**
- Modify: `AGENTS.md` (Landing Page requirement 4; the *Idle float* decision)
- Modify: `README.md` (the intro paragraph; the closing Design direction paragraph)

**Interfaces:**
- Consumes: the shipped constants from Tasks 2 and 3. Nothing consumes this task.

`AGENTS.md` is the spec of record, and its *Idle float* decision currently asserts the exact
sentence this work makes false: *"phase-anchored to the end of the entrance so it is exactly 0
at the handover and always begins moving upward."* It is no longer exactly 0 at the handover.
Leave it and the next reader treats `floatOffset(3.5) = 0.0277` as a bug.

- [ ] **Step 1: Update requirement 4 in `AGENTS.md`**

Replace the Landing Page requirement 4 line with:

```markdown
4. After entrance, cube hold pose still and drift gentle up and down forever. Drift ramp in
   smooth and start before entrance finish, so no dead beat and no motion switch on. All
   horizontal rotation come from viewer drag, none automatic.
```

- [ ] **Step 2: Replace the *Idle float* decision in `AGENTS.md`**

Replace the whole `- **Idle float:**` bullet with:

```markdown
- **Idle float:** vertical only. A sine bob of amplitude 0.08 world units and period 5.0 s,
  multiplied by a `smoothStep` amplitude envelope over `rampDuration` 1.5 s and started
  `overlap` 0.7 s *before* the entrance ends. The envelope has `S(0) = 0` **and**
  `S'(0) = 0`, so the float's position, velocity, and acceleration are all exactly 0 at its
  onset; the entrance also arrives with zero velocity and zero acceleration, so the total
  vertical motion is C² across the whole timeline and there is no order of derivative at
  which anything jumps. (Not C³: the entrance's third derivative is `-6*startY/D³` on the
  left and 0 on the right. Nothing visible depends on C³.) The overlap starts the bob at
  `p = 0.80`, where the entrance is within 7.4 px of centre at 99.7% scale and turning at
  2.6 deg/s — visually parked — so it costs nothing legible from the entrance and removes the
  ~0.5 s dead beat that made the onset read as a second, unrelated event.
  **Consequence: `floatOffset(3.5)` is `0.0277430`, not 0**, and the cube's `y` at the end of
  the entrance is no longer `ENTRANCE.endY` (`endY` remains the entrance's own target, which
  it still hits exactly). 0.7 s is a ceiling, not taste: through the overlap the entrance
  offset and the float's first upward half-cycle add, and both the entrance offset at the
  onset (`startY * 0.008`, worst 0.0760 at 280x1000) and the float's own first peak (0.0776)
  must stay under `amplitude` 0.08. At 1.0 s the sum is 0.0887 and the in-frame bound in
  `tests/scene.test.js` must be widened; raising `FIT_MARGIN` raises `startY` and eats the
  same headroom. Peak-to-peak travel is 10% of the cube's edge length — defined against the
  cube, not the viewport, so changing `FIT_MARGIN` does not change how it reads. **The
  landing pose is untouched:** it is a claim about yaw and pitch, and the float moves neither.
```

- [ ] **Step 3: Update `README.md`**

In the intro paragraph, replace *"then holds its pose and drifts gently up and down forever."*
with:

```markdown
then holds its pose while a gentle vertical drift ramps in out of the arrival and continues
forever.
```

In the closing Design direction paragraph, replace *"The only autonomous motion is a gentle
vertical bob;"* with:

```markdown
The only autonomous motion is a gentle vertical bob, which ramps in with a smoothstep
envelope and starts just before the entrance lands, so it emerges from the arrival rather
than switching on after it;
```

- [ ] **Step 4: Verify no contradicted statement is left**

Run:

```bash
grep -rn "exactly 0 at the handover\|drifts gently up and down forever\|deliberately not ramped\|phase-anchored" AGENTS.md README.md src/
```

Expected: no output. Every one of those phrases described the old behaviour.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: record the float's envelope and entrance overlap"
```

---

### Task 5: Final verification against the spec's Part A acceptance criteria

**Files:** none modified. Verification only.

**Interfaces:**
- Consumes: everything from Tasks 1–4.

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: PASS. 8 test files, 0 failed. Paste the summary line into the task notes — do not
report Part A complete without it.

- [ ] **Step 2: Production build and preview**

Run: `npm run build`
Expected: exits 0 and writes `dist/`.

Run: `npm run preview` and open the printed URL.
Expected: the built page behaves exactly as `npm run dev` did.

- [ ] **Step 3: Walk the spec's Part A acceptance list (§23)**

Check each, and note which check produced the answer:

- [ ] The bob's onset is imperceptible: no instant at which vertical motion switches on.
      *(By eye at `npm run dev`, plus `has zero velocity at the float onset`.)*
- [ ] From `t = 2.5 s` onward the cube is never motionless for more than one frame, and the
      end of the entrance cannot be identified by eye. *(By eye. The entrance is live until
      3.5 s and the float from 2.8 s, so the two windows overlap by 0.7 s.)*
- [ ] The finite-difference velocity and acceleration at the float's onset are ~0.
      *(`has zero velocity at the float onset`, `has zero acceleration at the float onset`.)*
- [ ] `entranceRotation(3.5)` still returns exactly `SETTLE.yaw` / `SETTLE.pitch`.
      *(`lands the exact resting pose — the float moves neither angle`.)*
- [ ] The cube never leaves frame at any tested aspect ratio.
      *(`keeps the entrance tail plus the overlapping float inside the float bound`, the
      existing bound at `tests/scene.test.js:56`, and the narrow-window reload in Task 3.)*
- [ ] `AGENTS.md` and `README.md` contain no statement contradicted by this work.
      *(Task 4 Step 4's grep.)*

- [ ] **Step 4: Confirm the non-goals held**

Run: `git diff --stat main`

Expected: exactly eight files — `src/easing.js`, `src/config.js`, `src/animation.js`,
`tests/easing.test.js`, `tests/animation.test.js`, `tests/scene.test.js`, `AGENTS.md`,
`README.md`. **If `src/main.js`, `src/scene.js`, `src/drag.js`, `src/cube.js`, `index.html`,
or `src/style.css` appears, something exceeded this plan's scope.** Spec §22: no change to the
entrance's duration, position curve, scale curve, spin decay, easing choices, or landing pose.

- [ ] **Step 5: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to decide how to integrate.
