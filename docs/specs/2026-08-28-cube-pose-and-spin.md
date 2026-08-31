# Spec: Cube Entrance Spin and Resting Pose

**Status:** draft — one open decision (§7) must be resolved before this becomes a plan.
**Date:** 2026-08-28
**Supersedes:** `docs/quick_review.md` (the freeform review this was written from).
**Follows:** `docs/plans/2026-08-28-landing-cube.md` (shipped; merged as `8f3ddec`).

## 1. Goal

Three adjustments to the landing cube's rotation, all entrance-spin or post-entrance only:
the entrance should decelerate harder, the cube should arrive at a defined edge-on,
slightly-top-down pose instead of an arbitrary one, and the idle float should turn only
horizontally.

Position, scale, timing, camera framing, colors, materials, and pointer parallax are
unchanged.

## 2. Current behavior (verified)

| Aspect | Today | Where |
| --- | --- | --- |
| Entrance spin | `3.0 -> 0.035` rev/s over 3.5 s, `easeOutQuart` decay | `src/config.js:17-18`, `src/animation.js:12` |
| Yaw (horizontal) | Per-frame accumulator `spinAngle += spinSpeed * 2PI * dt` | `src/main.js:33`, `src/main.js:62` |
| Pitch (vertical) | `spinAngle * SPIN_TILT_RATIO` (0.35), permanently coupled to yaw | `src/config.js:27`, `src/main.js:74` |
| Roll | Always `0` | `src/main.js:76` |
| Resting pose | **None exists.** | — |

Two facts drive this spec:

1. **Nothing targets an arrival pose.** The yaw is an accumulator, so the angle at
   `t = 3.5 s` depends on frame timing. Integrated analytically, today's entrance covers
   **2.198 revolutions**, landing at yaw ≈ 71.3° — neither face-on nor edge-on. The
   review's "one face facing straight at the camera" describes a pose the cube *passes
   through*, not one it holds.
2. **The pitch never stops either.** Because `rotation.x` is a fixed multiple of the yaw,
   the vertical tumble keeps running for as long as the yaw does. This is the root cause
   of review item 3.

## 3. Change 1 — Faster entrance spin, harder deceleration

**Requirement.** Raise the entrance's starting spin speed so the slowdown into the centre
reads as a more abrupt arrest.

**Change.** `ENTRANCE.startSpin`: `3.0` → `5.0` rev/s. `endSpin` unchanged, so the
start:end speed ratio goes from 86:1 to 143:1, and the entrance covers 3.598 revolutions
instead of 2.198.

**Constraint — strobing ceiling.** A cube's yaw has 90° rotational symmetry, so past 45°
of yaw per rendered frame the spin reads as running backwards. Measured against the moment
the cube first enters frame:

- The cube is off-screen until **t ≈ 0.35 s** (0.389 s at 16:9 and 16:10, 0.349 s in
  portrait), by which point the `easeOutQuart` decay has already cut the speed to
  `0.656 * startSpin`.
- That puts the ceiling at **startSpin ≤ 5.7 rev/s** to stay legible on a 30 fps display
  (throttled tab, low-power mode), and **≤ 11.4 rev/s** at 60 fps.

`5.0` sits inside both limits. Treat 5.7 as the hard cap for any later tuning.

**Secondary lever (not specified here).** Steepening the spin decay curve
(`easeOutQuart` → `easeOutQuint`) also sharpens the deceleration without raising peak
speed. Recommendation: ship the `startSpin` change alone — it is one number — and revisit
the curve only if the result still reads as too gentle.

**Acceptance.** The entrance is visibly faster at the top of the screen; the landing pose
(§4) is unaffected by this value.

## 4. Change 2 — Deterministic landing pose: edge-on, tilted 15° down

**Requirement.** At the end of the entrance the cube presents a vertical **edge** to the
camera, not a face, and is pitched so the top face is visible.

**Target pose.** `rotation.x = +15°` (`0.26180` rad), `rotation.y = 45°` (`0.78540` rad,
equivalent modulo 90°), `rotation.z = 0`.

Verified against three's default `XYZ` Euler order at that pose:

- The two visible side faces project equally (`±0.683` on the camera axis), so the
  vertical edge between them sits dead-centre.
- The top-face normal carries `z = +0.259 = sin(15°)` — it leans toward the camera, so the
  top face is visible. **Positive `rotation.x` shows the top face**; negative would show
  the bottom.

**Mechanism.** Replace the per-frame yaw accumulator with a closed-form angle function, so
the arrival angle is exact and frame-rate independent, then anchor the entrance's starting
angle to that target.

Revolutions covered from `0` to `t`, with `p = min(t/D, 1)`, `s0 = startSpin`,
`s1 = endSpin`, `D = duration`:

```
A(t) = D * ( s0 * p + (s1 - s0) * ( p - (1 - (1 - p)^5) / 5 ) )
A(D) = D * ( s0 + (s1 - s0) * 0.8 )
```

Then `startYaw = TARGET_YAW - 2PI * A(D)` (mod 2PI), and:

```
yaw(t)   = startYaw + 2PI * A(min(t, D)) + 2PI * s1 * max(0, t - D)
pitch(t) = TARGET_PITCH - TUMBLE_RATIO * 2PI * ( A(D) - A(min(t, D)) )
```

Both land exactly on target at `t = D`. The starting offset is invisible: the cube is
off-screen for the first ≈0.35 s.

**Rejected alternative.** Easing or damping the rotation toward the target over the last
fraction of the entrance perturbs the spin curve exactly where the eye is watching it
settle, and reintroduces frame-rate sensitivity. The closed form has neither problem and
is cheaper.

**Acceptance.** At `t = D` the pose matches the target to within 1e-9 rad, for every value
of `startSpin` — Change 1 and Change 2 are fully decoupled.

## 5. Change 3 — Idle rotation is horizontal only

**Requirement.** Once settled, the float spin turns the cube horizontally only. No
vertical rotation. Parallax is explicitly unaffected.

**Change.** The vertical tumble becomes an entrance-only effect that terminates on the
Change 2 pitch. For `t >= D`, `rotation.x` is constant at `TARGET_PITCH` and only
`rotation.y` advances (at `endSpin`) — see the `pitch(t)` formula in §4, which freezes
because `A(min(t, D))` stops growing.

Rename `SPIN_TILT_RATIO` → `ENTRANCE_TUMBLE_RATIO` (value `0.35` unchanged); it now shapes
only the entrance tumble, and the old name implies a permanent coupling that no longer
exists.

**Constraint — keep the Euler order.** Keep `cube.rotation.set(pitch, yaw, 0)` on three's
default `XYZ` order. With roll at `0`, the top-face normal works out to
`(0, cos(pitch), sin(pitch))` — **independent of yaw**. Verified numerically at yaw
45/90/135/200/315°: `topNormal.z` holds at `0.2588` throughout. That is what makes the 15°
tilt read as a steady tilted turntable rather than a wobble. Any other Euler order spins
the tilt axis with the cube and the pitch oscillates.

**Parallax layering (unchanged).** `PARALLAX.maxTilt` of `0.09` rad = 5.16°, added on top
of both angles. So the visible pitch breathes between 9.8° and 20.2° as the pointer moves,
around the 15° rest value. `maxOffset`, `tau`, and the `pointerWeight = state.progress`
ramp all stay as they are.

**Acceptance.** `pitch(D) === pitch(D + 60) === pitch(D + 600)`. Pointer movement still
tilts the cube on both axes.

## 6. Config surface

| Key | Today | Proposed |
| --- | --- | --- |
| `ENTRANCE.startSpin` | `3.0` | `5.0` |
| `ENTRANCE.endSpin` | `0.035` | unchanged — **pending §7** |
| `SETTLE.yaw` | — | `Math.PI / 4` (new) |
| `SETTLE.pitch` | — | `(15 * Math.PI) / 180` (new) |
| `SPIN_TILT_RATIO` | `0.35` | renamed `ENTRANCE_TUMBLE_RATIO`, value unchanged |

Everything else in `src/config.js` is untouched.

## 7. Open decision — how long the edge-on pose lasts

**The problem.** `endSpin` of `0.035` rev/s is 12.6°/s. The cube therefore leaves the
edge-on pose immediately, reaches face-on **3.6 s after arrival**, and cycles between the
two every 7.1 s. Landing on the pose satisfies review item 2 literally, but if the intent
was "edge-on is how the cube looks at rest", the current idle speed undoes it within a few
seconds.

| Option | Behavior | Trade-off |
| --- | --- | --- |
| **A — land and drift** (recommended) | Anchor the pose, keep `endSpin` at `0.035` | Literal reading of items 2 and 3, and of "slow float spin go forever" in `AGENTS.md`. Edge-on is a moment, not a resting state. |
| **B — land and drift slowly** | Anchor the pose, drop `endSpin` to ≈`0.010` rev/s (3.6°/s, 100 s per turn) | Still spins forever; edge-on holds visibly for ≈12 s. Idle motion may read as too static. |
| **C — oscillate** | Replace the continuous idle spin with a slow sine around 45° (e.g. ±10° over ≈20 s) | Fully preserves the pose. Contradicts "spin forever" as written in `AGENTS.md`; needs a spec amendment. |

**Recommendation:** A, then judge it on the live page — if edge-on does not read as the
cube's identity, B is a one-number follow-up.

This decision changes `endSpin` and, for C, the shape of the idle rotation. Resolve it
before writing the plan.

## 8. Implementation notes

| File | Change |
| --- | --- |
| `src/config.js` | `startSpin` bump; new `SETTLE` block; rename `SPIN_TILT_RATIO`. |
| `src/animation.js` | Add a pure `entranceRotation(elapsed, opts)` returning `{ yaw, pitch }` from the closed form. No three.js import — stays headless-testable, matching the existing architecture. |
| `src/main.js` | Drop the `spinAngle` accumulator (`:33`, `:62`); read `yaw`/`pitch` from the pure function; keep the parallax layering in `rotation.set` (`:73-77`) as-is. |
| `tests/animation.test.js` | New cases (§9). Existing `entranceState` cases must keep passing. |
| `README.md`, `AGENTS.md` | Record the resting pose and the §7 decision in the decisions log. |

`entranceState` should keep returning `spinSpeed` even though `main.js` stops consuming it
— the existing monotonic-deceleration tests read it, and it documents the curve.

## 9. Test plan

Plain Node, no browser, no WebGL — same as the existing suite.

1. `A(0) === 0`; `A` strictly increasing over `[0, D]`.
2. `A(D)` equals the analytic constant `D * (s0 + (s1 - s0) * 0.8)`.
3. `yaw(D) mod (PI/2)` is `PI/4` within 1e-9, asserted for `startSpin` of 3, 5, and 8 —
   this is the proof that Change 1 cannot disturb Change 2.
4. `pitch(D)` equals `SETTLE.pitch` exactly.
5. `pitch(D) === pitch(D + 60) === pitch(D + 600)` — the tumble is frozen.
6. `yaw(D + 10) - yaw(D) === 10 * endSpin * 2PI` — idle drift is exactly `endSpin`.
7. Frame-rate independence: sampling at 1/30 s and at 1/144 s steps yields the same
   `yaw(D)`. (The current accumulator fails this; it is the regression this guards.)
8. Sanity on the pose itself: build a `THREE.Object3D` at the target rotation and assert
   `topNormal.z > 0` and that the two visible side-face normals project equally.

## 10. Non-goals

- No change to the parallax limits, damping, or how it layers onto the rotation.
- No change to the position or scale curves, the 3.5 s duration, camera framing, colors,
  materials, or the background.
- `prefers-reduced-motion` remains deliberately unhandled.
- No new pages, routes, content, or 3D objects.

## 11. Acceptance criteria

- [ ] The entrance starts at 5.0 rev/s and reads as a harder deceleration.
- [ ] At the end of the entrance a vertical edge faces the camera and the top face is
      visible (15° down-tilt).
- [ ] The landing pose is identical across frame rates and across `startSpin` values.
- [ ] After settling, only the horizontal rotation advances; the vertical angle is
      constant.
- [ ] Pointer parallax still tilts and offsets the cube exactly as before.
- [ ] `npm test` passes, including the new cases in §9.
- [ ] `npm run build` succeeds.
