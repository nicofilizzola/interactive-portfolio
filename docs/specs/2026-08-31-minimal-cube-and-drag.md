# Spec: Strip Back the Cube, Hand the Spin to the User

**Status:** draft — §13 lists five taste decisions, each with a recommended default. Only
§13.2 (the edge outline) changes what ships in a way the others do not; the plan can
proceed on the defaults if it is not answered.
**Date:** 2026-08-31
**Supersedes:** `docs/review.md` (the freeform review this was written from).
**Follows:** `docs/specs/2026-08-28-cube-pose-and-spin.md` (shipped; merged as `1433cf7`).

## 1. Goal

Five changes from `docs/review.md`, all post-entrance appearance or interaction. Taken
together they invert the page's character: today the cube is a self-playing object the
pointer nudges, and afterwards it is a still object the pointer turns.

| # | Review item | Section |
| --- | --- | --- |
| 1 | Remove the parallax animation entirely | §3 |
| 2 | Make the cube smaller | §4 |
| 3 | Remove the cube's edge colors | §5 |
| 4 | Idle float on Y, no automatic rotation | §6 |
| 5 | Drag horizontally to spin the cube | §7 |

The entrance itself — its 3.5 s duration, its position and scale curves, its easing, its
landing pose — is unchanged, with one induced exception forced by item 2 (§8).

**Two of these items contradict `AGENTS.md` as written.** Item 4 contradicts landing-page
requirement 4 ("Slow float spin go forever after entrance done"), and item 1 contradicts
the recorded parallax decision. `AGENTS.md` is the spec of record, so the plan must amend
it — see §10.

## 2. Current behavior (verified)

| Aspect | Today | Where |
| --- | --- | --- |
| Cube on-screen size | Camera fits a sphere of `CUBE_RADIUS * 1.35`; the edge-on silhouette spans **60.5%** of the smaller viewport dimension | `src/config.js:3`, `src/scene.js:27-28` |
| Edge outline | 12 lines, `#2563eb` blue, 1 device pixel | `src/config.js:9`, `src/cube.js:23-26` |
| Faces | `#d6d8dc`, flat-shaded, `polygonOffset` on so the edges cannot z-fight | `src/cube.js:7-16` |
| Idle rotation | Yaw advances at `endSpin` = 0.035 rev/s forever; pitch frozen at `SETTLE.pitch` | `src/animation.js:51-55` |
| Idle position | Static at `y = 0` | `src/main.js:80-84` |
| Pointer input | `pointermove` → damped parallax: ±0.22 world-unit offset, ±0.09 rad tilt, `tau` 0.35, weighted by `state.progress` | `src/parallax.js`, `src/main.js:100-105` |
| Pointer recentring | `pointerleave` (capture), `pointercancel`, `pointerup`, `blur` all reset to centre | `src/main.js:113-116` |
| Drag | **None.** No `pointerdown`, no pointer capture, no `touch-action` rule | — |

Three facts drive this spec:

1. **`CUBE_SIZE` is not the size knob.** The camera distance is derived from
   `CUBE_RADIUS * FIT_MARGIN` (`src/scene.js:28`), so the camera pulls back in exact
   proportion to any change in `CUBE_SIZE` and the cube's projected size is invariant.
   Changing `CUBE_SIZE` from 1.6 to 1.0 produces a pixel-identical page. **`FIT_MARGIN` is
   the only knob that changes what the viewer sees** (§4).
2. **`endSpin` has two jobs.** It is the terminal value of the entrance's spin-decay curve
   *and* the idle drift rate (`src/animation.js:51`). Item 4 removes the second job. The
   first must survive, or the entrance's deceleration curve changes shape (§6).
3. **Removing parallax does not remove pointer handling.** Item 1 deletes a pointer
   behavior and item 5 adds a different one, so `main.js` keeps a pointer event block —
   it is rewritten, not deleted. `dampTowards` (`src/math.js:11`) survives the deletion of
   its only current caller because the drag momentum reuses it (§7).

## 3. Change 1 — Remove pointer parallax

**Requirement.** The pointer no longer offsets or tilts the cube. Item 5's drag is the
only pointer interaction on the page.

**Change.** Delete `src/parallax.js`, `tests/parallax.test.js`, and the `PARALLAX` block in
`src/config.js`. In `src/main.js`, drop the `createParallax` import and instance, the
`parallax.update(dt)` call, `pointerWeight`, the `pointermove` listener, and
`recentrePointer` with its four listeners.

The cube's position and rotation collapse to:

```js
view.cube.position.set(0, state.y + floatOffset(elapsed, FLOAT), 0);
view.cube.scale.setScalar(state.scale);
view.cube.rotation.set(SETTLE.pitch, rotation.yaw + drag.yaw, 0);
```

`entranceState` keeps returning `progress` and `done` — `done` becomes the gate for item 5
(§7), so `progress` is the only field that loses its consumer. Keep it; it is one number
and the existing tests read it.

**Consequence — the page has no ambient response to the pointer.** Combined with item 4,
nothing on the page reacts to the pointer until the viewer presses and drags. §7e covers
the affordance question this raises.

**Acceptance.** Moving the pointer across the page changes nothing. `grep -r parallax src
tests` returns nothing.

## 4. Change 2 — Smaller cube

**Requirement.** The cube occupies less of the screen at rest.

**Change.** `FIT_MARGIN`: `1.35` → **`1.9`**. Nothing else. `CUBE_SIZE` stays at 1.6 (see
§2 fact 1 — changing it would be a no-op that only shifts the world-unit scale of every
other tunable).

`FIT_MARGIN` is the multiple of the cube's bounding-sphere radius that the camera frames,
so it reads directly as "how much room around the cube". Raising it moves the camera back;
`entranceStartY` is derived from the same distance (`src/camera.js:16-19`), so the
off-screen start clearance follows automatically and stays correct.

| `FIT_MARGIN` | Edge-on silhouette, as a fraction of the smaller viewport dimension | Camera z (16:9) | `startY` (16:9) |
| --- | --- | --- | --- |
| 1.35 (today) | 60.5% | 4.516 | 3.456 |
| 1.6 | 51.0% | 5.352 | 3.803 |
| **1.9 (proposed)** | **43.0%** | **6.356** | **4.218** |
| 2.2 | 37.1% | 7.360 | 4.634 |

(Silhouette measured at the resting pose — yaw 45°, pitch 15° — where the cube presents its
face diagonal, `CUBE_SIZE * sqrt(2)`.)

**Constraint — this lowers the entrance's strobing ceiling.** A bigger `FIT_MARGIN` means a
larger `startY`, so the cube crosses into frame *earlier in normalized progress*, when
`easeOutQuart` has cut away less of the peak spin. The shipped `startSpin` of 5.0 is
documented as sitting *at* the ceiling, not under it. See §8 — this is the one place where
item 2 forces a change outside its own scope.

**Acceptance.** The cube reads as clearly smaller at rest. The entrance still starts fully
off-screen at every aspect ratio from 2133×1012 to 280×1000.

## 5. Change 3 — Remove the edge colors

**Requirement.** The cube's edges are no longer blue.

**The ambiguity.** "Remove the cube's edge colors" reads two ways, and they look different:

| | Reading | Result |
| --- | --- | --- |
| **A (recommended)** | The edges lose their *color* — keep the 12-line outline, recolor it neutral | Flat-shaded gray cube with a thin dark-gray outline |
| **B** | The edges go away — delete the outline overlay | Bare flat-shaded gray cube, silhouette and face shading only |

**Recommendation: A**, `COLORS.edge`: `0x2563eb` → **`0x9aa0a6`** (a neutral mid-gray, darker
than the face gray `#d6d8dc` so it still reads as a drawn line).

The reason is item 5. Once the viewer can spin the cube by hand, the outline is what makes
the rotation legible — flat face shading alone gives three broad tones that change slowly,
while the edges give the eye something to track through a fast drag. Reading B also makes
the `polygonOffset` block in `src/cube.js:12-15` dead weight, collapses the `cube` `Group`
to a bare `Mesh`, and removes three of the six `cube.test.js` cases.

**Design consequence, under either reading.** Blue is currently the *only* accent on the
page and the edge outline is its only use. After this change the page is entirely
achromatic. `AGENTS.md` says "Accent color: blue — use sparingly", which this reduces to
zero. That is a legitimate reading of "very minimal", but it is a direction change and
`AGENTS.md` must record it (§10).

**Acceptance.** No blue pixel is rendered. Under reading A the outline is still visible
against both the faces and the background at rest.

## 6. Change 4 — Idle is a vertical float, with no rotation

**Requirement.** Once the entrance ends, the cube holds its pose in the centre and drifts
gently up and down. The automatic horizontal spin is gone.

### 6a. Stop the rotation

Two coupled edits:

1. **`ENTRANCE.endSpin`: `0.035` → `0`.** This is the terminal value of the entrance's
   decay curve, so the entrance now decelerates to a genuine standstill instead of to
   12.6°/s. Because `easeOutQuart` has zero derivative at `p = 1`, the arrest is smooth —
   the cube glides to a stop rather than snapping to one. Leaving `endSpin` at 0.035 and
   only deleting the idle term would step the angular velocity from 12.6°/s to 0 in one
   frame at exactly the moment the eye is watching the cube settle.
2. **Delete the `idleRevolutions` term** in `entranceRotation` (`src/animation.js:51,54`).
   With `endSpin = 0` the term is already zero, but the deletion is what makes the
   *intent* explicit and lets `endSpin` be retuned later without resurrecting the drift.

Total entrance revolutions change from 3.598 to `D * startSpin` — 3.150 at the §8
`startSpin` of 4.5. **The landing pose is unaffected**: `entranceRotation` is written
backwards from `settleYaw`, so any revolution count lands on the same pose.

**This retroactively resolves the previous spec's open decision.** `docs/specs/2026-08-28`
§7 asked how long the edge-on pose should last and shipped option A ("land and drift"),
noting edge-on was "a moment, not a resting state". Item 4 makes it the resting state
permanently — a stricter form of option C. Record that in `AGENTS.md`.

### 6b. Add the vertical float

A pure function alongside `entranceState`, in `src/animation.js`:

```js
export function floatOffset(elapsed, opts) {
  const since = Math.max(0, elapsed - opts.duration);
  return opts.amplitude * Math.sin((TAU * since) / opts.period);
}
```

Added to `state.y` in `main.js`. It is exactly `0` throughout the entrance and at the
instant the entrance ends, so there is no positional jump.

**Defaults.** `amplitude` **0.08** world units, `period` **5.0** s.

- Peak-to-peak travel is 0.16 world units = **10% of the cube's edge length**. Defining it
  against the cube rather than the viewport is deliberate: item 2 moves the camera, and a
  viewport-relative amplitude would silently change the read.
- The bob starts at zero displacement but non-zero velocity (`A·2π/T` = 0.100 u/s). The
  entrance arrives with zero vertical velocity (`easeOutCubic` derivative is 0 at `p = 1`),
  so there is a velocity step at `t = D` — of 0.100 u/s against an entrance peak of
  3.6 u/s, i.e. **2.8%**. Below the threshold of visibility; do not add a ramp for it.
- Phase is anchored to `duration`, not to page load, so the cube always begins its float
  moving upward from centre.

**Acceptance.** After settling, the cube moves only up and down; `rotation.y` is constant
absent user input. `floatOffset(t) === 0` for all `t <= duration`.

## 7. Change 5 — Drag to spin horizontally

**Requirement.** The viewer spins the cube about its vertical axis by dragging. Horizontal
only. The feel is the deliverable, not just the wiring.

### 7a. Sensitivity

The gain is defined against **`min(innerWidth, innerHeight)`**, not against a pixel
constant and not against `innerWidth`:

```js
gain = (TAU * DRAG.revsPerViewport) / Math.max(min(innerWidth, innerHeight), 1)   // rad per px
```

The camera fits the cube using `min(halfV, halfH)` (`src/camera.js:13`), so the cube's
on-screen size is proportional to the smaller viewport dimension. Normalizing the drag by
that same dimension makes the gain proportional to the cube's apparent size — the viewer
gets the same degrees-per-cube-width on every device and in both orientations, which is
what "consistent sensitivity" actually means. Normalizing by width instead would make
phones roughly three times twitchier than desktops.

**Default `revsPerViewport`: 1.0** — one full revolution per screen-width of drag.

| Viewport | Gain | Drag needed for a quarter turn |
| --- | --- | --- |
| 1920×1080 | 0.333 °/px | 270 px |
| 1440×900 | 0.400 °/px | 225 px |
| 1024×1366 (tablet) | 0.352 °/px | 256 px |
| 390×844 (phone) | 0.923 °/px | 98 px |

Useful tuning range 0.6–1.5. Lower is heavier and more furniture-like; higher is flickier.

**Direction.** Dragging right increases `rotation.y`. Verified: a point on the front face
at `(0, 0, 1)` maps to `(sin θ, 0, cos θ)` under `rotation.y = θ`, so positive yaw carries
the front face toward screen-right. The face under the finger follows the finger.

### 7b. Momentum

Release throws the cube and it coasts to a stop on an exponential decay, reusing
`dampTowards` from `src/math.js`:

```
omega(t) = omega_0 * exp(-t / releaseTau)      coast angle = omega_0 * releaseTau
```

The coast-angle identity is what makes this tunable: `releaseTau` is literally "how many
seconds of the release speed the cube is still worth".

**Defaults.** `releaseTau` **0.5 s**, `velocityTau` **0.06 s**, `maxSpeed` **2.5 rev/s**.

- **`velocityTau` (0.06 s) solves the pause-then-release fling.** Release velocity is an
  exponentially smoothed estimate sampled once per frame, not the delta of the last
  `pointermove`. A viewer who drags, holds still for three or four frames, then lifts, gets
  a velocity that has already decayed to near zero — no unwanted throw. A viewer who lifts
  mid-swipe gets the full flick.
- **`maxSpeed` (2.5 rev/s) is the strobing cap.** The cube's yaw is 90°-symmetric, so past
  45° of yaw per rendered frame a free spin reads as running backwards — 3.75 rev/s at
  30 fps, 7.5 rev/s at 60 fps. 2.5 leaves headroom on a throttled tab. This is the same
  constraint already documented for `startSpin` in `src/config.js:17-23`, applied to the
  release velocity. It caps the *coast*, not the drag: while the finger is down the cube
  tracks 1:1 at any speed, because a fast swipe there is self-evidently the viewer's doing.
- Maximum coast is therefore `2.5 × 0.5` = **1.25 revolutions**.

### 7c. The drag module

New `src/drag.js`, mirroring `parallax.js`: a pure factory, no `three` import, no DOM
access, headless-testable. `main.js` keeps sole ownership of the events.

```js
createDragSpin({ revsPerViewport, releaseTau, velocityTau, maxSpeed })
  -> { start(x), move(x), end(), update(dt, viewportMin) -> yaw }
```

- `start(x)` latches the press position and zeroes the pending delta.
- `move(x)` records the latest position only. It does **not** integrate — several
  `pointermove` events can fire per frame, and folding them in per event makes the result
  event-rate dependent.
- `update(dt, viewportMin)` is the whole model, called once per frame from the render loop:
  - **dragging:** fold `(x - lastApplied) * gain` into `yaw`, then
    `velocity = dampTowards(velocity, delta / dt, velocityTau, dt)`.
  - **released:** `yaw += velocity * dt`, then
    `velocity = dampTowards(velocity, 0, releaseTau, dt)`.
  - Guard `dt <= 0` (leave `velocity` untouched).
- `end()` clears the dragging flag and clamps `|velocity|` to `maxSpeed * TAU`.

`yaw` accumulates without wrapping — same reasoning as `entranceRotation`
(`src/animation.js:44-47`). It is added to the entrance yaw, which after §6a is the
constant `SETTLE.yaw`.

The velocity never reaches exactly zero under exponential decay. That is fine and needs no
threshold: it falls below one device pixel of arc within about 2 s and the update is a
handful of flops per frame.

### 7d. DOM wiring (`main.js`)

- `pointerdown` on the canvas → `canvas.setPointerCapture(event.pointerId)`, record the
  pointer id, `drag.start(event.clientX)`. Ignore the event if a drag is already active
  (second finger) or if the entrance has not finished (§13.4).
- `pointermove` → `drag.move(event.clientX)`, but only for the captured pointer id.
- `pointerup` / `pointercancel` / `lostpointercapture` → `drag.end()`, clear the id.
- `blur` → `drag.end()`. Pointer capture survives a lot, but not the tab losing focus
  mid-drag.
- Pointer capture is what makes a drag that leaves the window keep working — it replaces
  the `pointerleave` capture-phase listener (`src/main.js:107-113`), whose comment can go
  with it.

**`src/style.css` needs `touch-action: none` on `#scene`.** Without it, a horizontal drag
on a touch device is claimed by the browser's own gesture handling before `pointermove`
fires, and on Android a downward drag triggers pull-to-refresh. `html, body { overflow:
hidden }` does not prevent this. This is not optional polish — item 5 does not work on
touch without it.

### 7e. Affordance

With items 1 and 4 both landed, a viewer who never presses sees a near-static page. Nothing
signals that the cube is interactive.

**In scope:** `#scene { cursor: grab }` and `#scene:active { cursor: grabbing }`. Two CSS
lines, no DOM text, consistent with "canvas only".

**Explicitly not in scope:** any hint text, icon, or nudge animation. Flagged here so that
if the built page feels inert, the cause is known and the decision was deliberate.

**Acceptance.** Dragging spins the cube horizontally and only horizontally. Releasing
mid-swipe coasts smoothly to a stop. Dragging, pausing, then releasing stops dead. Drags
work on touch, and continue when the pointer leaves the window. Sensitivity feels the same
on a phone and on a desktop.

## 8. Induced change — `startSpin` versus the strobing ceiling

Not a review item. Item 2 forces it.

`src/config.js:17-23` documents `startSpin = 5.0` as sitting *at* the 30 fps legibility
ceiling, limited by tall viewports where the cube enters frame earliest. Item 2 raises
`startY`, which moves the entry earlier still. Measured with the entrance's scale ramp
included (the cube is at 15% scale at `t = 0`, so it clears the frame edge far longer than
position alone suggests):

| Viewport | Entry time @1.35 → @1.9 | Yaw per frame @30 fps, `startSpin` 5.0 | 30 fps ceiling on `startSpin` |
| --- | --- | --- | --- |
| 16:9 | 0.388 s → 0.328 s | 40.6° | 5.54 |
| 9:16 | 0.287 s → 0.231 s | 45.8° | 4.92 |
| 9:19.5 phone | 0.254 s → 0.201 s | **47.4°** | **4.74** |

(The @1.35 column reproduces `AGENTS.md`'s recorded figures — 0.389 s at 16:9, ~6.0
landscape, ~5.1 at 9:19.5 — which validates the model.)

On a tall phone the shipped `startSpin` of 5.0 crosses 45°/frame and the entrance spin
reads as running backwards on a throttled display.

**Change.** `ENTRANCE.startSpin`: `5.0` → **`4.5`**, which puts the worst case at
42.7°/frame with headroom at every aspect. It is one number, it is invisible except in the
first third of a second, and the landing pose is provably independent of it
(`tests/animation.test.js:129-135` asserts this for `startSpin` of 3, 5, and 8).

If §13.1 settles on a `FIT_MARGIN` other than 1.9, re-run this table — the ceiling moves
with it.

## 9. Config surface

| Key | Today | Proposed |
| --- | --- | --- |
| `FIT_MARGIN` | `1.35` | `1.9` (§4) |
| `COLORS.edge` | `0x2563eb` | `0x9aa0a6` (§5, reading A) — or the key is deleted under B |
| `ENTRANCE.startSpin` | `5.0` | `4.5` (§8) |
| `ENTRANCE.endSpin` | `0.035` | `0` (§6a) |
| `PARALLAX` | `{ maxOffset, maxTilt, tau }` | **deleted** (§3) |
| `FLOAT` | — | `{ amplitude: 0.08, period: 5.0 }` (new, §6b) |
| `DRAG` | — | `{ revsPerViewport: 1.0, releaseTau: 0.5, velocityTau: 0.06, maxSpeed: 2.5 }` (new, §7) |

Unchanged: `CUBE_SIZE`, `CUBE_RADIUS`, `CAMERA_FOV`, `COLORS.background`, `COLORS.face`,
`ENTRANCE.duration/endY/startScale/endScale`, `SETTLE`, `ENTRANCE_TUMBLE_RATIO`,
`MAX_PIXEL_RATIO`, `MAX_FRAME_DELTA`.

The stale `startSpin` comment block (`src/config.js:17-23`) must be rewritten against the
new `FIT_MARGIN`, not just left in place with a new number above it.

## 10. Spec-of-record amendments

`AGENTS.md` and `README.md` are wrong in specific, enumerable places after this work. The
plan must fix all of them.

**`AGENTS.md` — Landing Page section:**

- Entrance table, "Spin speed" row: "fast → much slower, gentle floating spin" becomes
  "fast → stopped".
- Requirement 2: "...down to slow continuous float spin once cube settle" → down to a stop.
- Requirement 4: "Slow float spin go forever after entrance done" → **replaced** by the
  vertical float and user-driven rotation. This is the direct contradiction; do not leave
  both statements standing.

**`AGENTS.md` — Decisions section:**

- *Entrance:* spin range `5.0 -> 0.035` → `4.5 -> 0`; the ceiling paragraph re-measured
  against `FIT_MARGIN` 1.9 (§8).
- *Idle rotation:* the whole entry is replaced. Record that the edge-on pose is now held
  indefinitely, and that this supersedes the 2026-08-28 spec's §7 option-A choice.
- *Post-settle interaction:* parallax entry deleted; replace with the drag model and its
  four constants.
- *Cube look:* "thin blue edge outline (`#2563eb`)" → the §5 outcome.
- *Design Direction:* note that blue is currently unused on the page (§5).
- **New decision:** cube size is controlled by `FIT_MARGIN`, and `CUBE_SIZE` is a no-op for
  apparent size (§2 fact 1). This is non-obvious and will be rediscovered otherwise.

**`README.md`:** the intro paragraph ("floats there forever with a gentle spin and a subtle
pointer-follow tilt"), the `src/parallax.js` line in Layout (→ `src/drag.js`), the
`src/config.js` line ("parallax limits"), the `src/cube.js` line ("thin blue edge
outline"), the Design direction paragraph ("blue appears only as the cube's edge outline"),
and the closing resting-pose paragraph ("turns horizontally only, at 0.035 rev/s, forever").

## 11. Implementation notes

| File | Change |
| --- | --- |
| `src/config.js` | `FIT_MARGIN`, `COLORS.edge`, `startSpin`, `endSpin`; delete `PARALLAX`; add `FLOAT`, `DRAG`; rewrite the `startSpin` comment. |
| `src/parallax.js` | Delete. |
| `src/drag.js` | New. Pure factory (§7c), no `three`, no DOM. |
| `src/animation.js` | Add `floatOffset`; delete the `idleRevolutions` term from `entranceRotation`. |
| `src/cube.js` | Recolor the edge material (A) or drop the `LineSegments`, the `polygonOffset` block, and the `Group` (B). |
| `src/main.js` | Drop parallax and its five listeners; add the drag instance, `pointerdown`/`move`/`up`/`cancel`/`lostpointercapture`/`blur` with pointer capture; simplify the three transform calls; add `floatOffset` to `y`; pitch becomes the constant `SETTLE.pitch`. |
| `src/style.css` | `touch-action: none` on `#scene` (required); `cursor: grab` / `:active grabbing` (§7e). |
| `src/scene.js`, `src/camera.js`, `src/math.js`, `src/easing.js` | Untouched. |
| `AGENTS.md`, `README.md` | Per §10. |

Architecture is unchanged: every file except `main.js` stays headless-testable, and
`main.js` remains the only browser-coupled file.

## 12. Test plan

Plain Node, no browser, no WebGL — same as the existing suite.

**New — `tests/drag.test.js`:**

1. No input: `update(dt, 1000)` leaves `yaw` at exactly `0` for any `dt`.
2. Gain: a drag of exactly `viewportMin` px yields `yaw === TAU * revsPerViewport`.
3. Viewport-relative: the same *fractional* drag on `viewportMin` 390 and 1920 yields
   identical yaw.
4. Direction: positive Δx yields positive yaw.
5. Frame-rate independence: the same pointer path replayed at 1/30 s and 1/144 s steps
   yields the same total yaw (it is a sum of deltas, so this is exact).
6. Multiple `move()` calls between two `update()` calls behave as one move to the final
   position — the guard against event-rate dependence.
7. Release coast: after `end()`, yaw increases monotonically, velocity decreases
   monotonically, and the total coast approaches `omega_0 * releaseTau` as `dt` shrinks
   (assert within 10% at `dt = 1/120`).
8. Pause-then-release: drag, then five `update()` calls with no movement, then `end()` —
   subsequent coast is under 1% of a revolution.
9. Flick cap: a single huge frame delta leaves `|velocity| <= maxSpeed * TAU` after `end()`.
10. `dt = 0` is a no-op and produces no `NaN`.

**New — `floatOffset` in `tests/animation.test.js`:**

11. `floatOffset(t) === 0` for `t` of 0, 1.75, and `duration`; negative `t` too.
12. Quarter, half, and three-quarter period give `+amplitude`, `~0`, `-amplitude`.
13. `|floatOffset(t)| <= amplitude` across 1000 samples out to `t = 600`.
14. Continuity: `floatOffset(duration + 1e-9)` is within 1e-6 of `0`.

**Amended — `tests/animation.test.js`:**

15. `drifts horizontally at exactly endSpin after the entrance` (`:147`) inverts to
    **`yaw is constant after the entrance`**: `yaw(D) === yaw(D + 60) === yaw(D + 600)`.
16. `holds the pose steady while only the idle drift advances` (`:193`) becomes both angles
    frozen.
17. `turns one way only, through the entrance and on into the idle drift` (`:173`) drops
    its `t > D` samples, or asserts non-decreasing instead of strictly increasing.
18. `covers 3.598 revolutions at the shipped 5.0 rev/s start speed` (`:83`) updates to the
    shipped `startSpin` 4.5 / `endSpin` 0 total of **3.150**.

The `entranceState` cases keep their local `OPTS` (`endSpin: 0.035`) and still pass —
`entranceState` itself does not change. Leave them; they document the curve independently
of the shipped constants.

**Amended — `tests/scene.test.js:56`:** `limiting > CUBE_RADIUS + PARALLAX.maxOffset`
becomes `limiting > CUBE_RADIUS + FLOAT.amplitude`. Same intent — the cube stays in frame
at its worst-case excursion — with the new source of excursion.

**Amended — `tests/cube.test.js`:** the edge-color case (`:19`) asserts the new
`COLORS.edge`; under reading B, `:7-14`, `:19`, `:26-30`, and `:32-35` are deleted or
rewritten for a bare `Mesh`.

**Deleted:** `tests/parallax.test.js`.

**Unchanged:** `tests/math.test.js` (`dampTowards` gains a new caller),
`tests/easing.test.js`, `tests/camera.test.js`, `tests/pose.test.js`.

**Manual checks the suite cannot cover:** drag feel and sensitivity; the touch drag on a
real phone (`touch-action`); the drag continuing outside the window; entrance legibility on
a tall viewport at 30 fps (§8).

## 13. Decisions to confirm

Each has a working default; none blocks the plan.

1. **Cube size — `FIT_MARGIN` 1.9?** (§4) Taste. The table gives 1.6 / 1.9 / 2.2. Changing
   it means re-running §8's ceiling table.
2. **Edge outline — keep it neutral (A) or delete it (B)?** (§5) The only decision that
   changes the deliverable rather than tuning it. Recommend A, because item 5 needs the
   rotation to be legible.
3. **Drag sensitivity — 1.0 rev per viewport?** (§7a) Pure feel; expect one round of live
   tuning in 0.6–1.5.
4. **Drags during the entrance — ignored, or allowed?** Recommend **ignored** (gate
   `pointerdown` on `state.done`). Allowing them means the yaw at `t = D` becomes
   `SETTLE.yaw + userYaw`, which breaks the landing-pose guarantee that the previous spec
   was written to establish. The cost is that a press in the last half-second of the 3.5 s
   entrance is silently dropped.
5. **Float amplitude and period — 0.08 / 5.0 s?** (§6b) Taste. 0.05 / 4 s is tighter and
   quicker; 0.12 / 6 s is a slower, larger swell.

## 14. Non-goals

- No change to the entrance duration, position curve, scale curve, easing functions, or
  landing pose. `startSpin` moves only as far as §8 requires.
- No vertical drag, no pinch zoom, no scroll interaction, no click or tap behavior.
- No snapping the cube back to the edge-on pose after a drag, and no rotation limits.
- No hint text, icon, or nudge animation (§7e).
- `prefers-reduced-motion` remains deliberately unhandled — note that the float bob becomes
  the page's only remaining autonomous motion, so this is a smaller exposure than it was.
- No new pages, routes, content, or 3D objects.
- Deployment stays out of scope.

## 15. Acceptance criteria

- [ ] Moving the pointer without pressing changes nothing on the page.
- [ ] The cube is visibly smaller at rest and still fully off-screen at the entrance start
      on every tested aspect ratio.
- [ ] No blue is rendered anywhere on the page.
- [ ] After the entrance the cube's rotation is completely still until the viewer drags it.
- [ ] After the entrance the cube drifts gently up and down, forever.
- [ ] The entrance decelerates to a standstill with no visible snap at `t = 3.5 s`.
- [ ] Dragging horizontally spins the cube horizontally, at the same felt sensitivity on
      phone and desktop, with the face under the finger following the finger.
- [ ] Releasing mid-swipe coasts and eases to a stop; releasing after a pause does not.
- [ ] A drag works on a touch device and survives the pointer leaving the window.
- [ ] The entrance spin does not read as running backwards on a 9:19.5 viewport at 30 fps.
- [ ] `AGENTS.md` and `README.md` contain no statement contradicted by this work (§10).
- [ ] `npm test` passes, including the new and amended cases in §12.
- [ ] `npm run build` succeeds.
