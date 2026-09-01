# Spec: Seamless Idle Handover, and the Cube as Navigation

**Status:** draft — §21 lists nine decisions, each with a recommended default. Three of them
(§21.1 routing mode, §21.2 what reopening the cube does, §21.5 route set) change the shape
of the deliverable rather than tuning it, and should be answered before planning Part B.
**Date:** 2026-08-31
**Supersedes:** `docs/review.md` (the freeform review this was written from).
**Follows:** `docs/specs/2026-08-31-minimal-cube-and-drag.md` (shipped; merged as `c17409d`).

## 1. Goal

Two items from `docs/review.md`. They are wildly different in size and share no code, so
**they should become two plans, not one.**

| # | Review item | Part | Size | Section |
| --- | --- | --- | --- | --- |
| 1 | The entrance → idle-float handover is too abrupt | A | ~3 files, 1 new easing fn | §3–§6 |
| 2 | The cube becomes the site's navigation: click a face → route; cube docks bottom-centre as a nav button | B | ~10 new files, new architecture | §7–§16 |

Part A is a contained fix to one function and two constants. Part B introduces routing, a
DOM content layer, a state machine, and picking — it is the largest change the project has
had, and it converts the site from a single canvas page into an SPA (§7).

**Part B contradicts `AGENTS.md` in four places.** "Current Scope: One landing page. Nothing
else yet."; the Out-of-Scope entries for "More pages, routes, nav" and "Project/case-study
content"; and the `Page:` decision's "no DOM text". `AGENTS.md` is the spec of record, so the
plan must amend it — see §18.

## 2. Current behavior (verified)

| Aspect | Today | Where |
| --- | --- | --- |
| Idle float | `amplitude * sin(TAU * max(0, t - 3.5) / 5.0)` — no envelope, no overlap | `src/animation.js:63-66` |
| Float handover | Position continuous; velocity steps 0 → 0.1005 u/s at `t = 3.5` | `src/animation.js:60-62` |
| Entrance position/scale | `easeOutCubic`, zero derivative at `p = 1` | `src/animation.js:8-16` |
| Entrance spin | `easeOutQuart`, `4.5 → 0` rev/s, zero derivative at `p = 1` | `src/config.js:19-25` |
| Cube | One `Mesh`, **one** `MeshStandardMaterial` (not an array) | `src/cube.js:10-18` |
| Pointer | `pointerdown/move/up/cancel/lostpointercapture` + `blur`, all feeding `drag` | `src/main.js:112-136` |
| Pointer → click | **None.** No raycaster, no tap discrimination, no `click` handler | — |
| Routing | **None.** One `index.html`, one canvas, no DOM content | `index.html:9-10` |
| Page scroll | `html, body { overflow: hidden }` | `src/style.css:10` |
| Canvas | `#scene` in normal flow at `100vw/100vh`, `pointer-events` default (auto) | `src/style.css:14-23` |

Framing, for the numbers used throughout (`FIT_MARGIN` 1.6, FOV 45):

| Viewport | Camera z | Visible half-height | `startY` | px per world unit | Cube silhouette |
| --- | --- | --- | --- | --- | --- |
| 1920×1080 | 5.352 | 2.217 | 3.803 | 243.6 | 551 px (51.0% of min dim) |
| 1440×900 | 5.352 | 2.217 | 3.803 | 203.0 | 459 px (51.0%) |
| 390×844 | 11.583 | 4.798 | 6.384 | 88.0 | 199 px (51.0%) |

---

# Part A — The idle handover (review item 1)

## 3. What is actually abrupt (measured)

The code comment at `src/animation.js:60-62` argues the handover is fine: the velocity step
is 0.1005 u/s against an entrance peak of 3.259 u/s, i.e. 2.8%. **That framing is wrong,
and it is why the defect survived review.** The comparison that matters is not against the
entrance's peak velocity but against its *terminal* velocity, which is exactly **zero** —
`easeOutCubic` has a zero derivative at `p = 1`. The cube comes to a genuine, total
standstill and then jerks into motion.

Measured on the shipped constants at 1920×1080:

| p | t (s) | y (px from centre) | scale | spin (°/s) | yaw left (°) | \|dy/dt\| (u/s) |
| --- | --- | --- | --- | --- | --- | --- |
| 0.60 | 2.100 | 59.3 | 0.946 | 41.5 | 11.61 | 0.522 |
| 0.70 | 2.450 | 25.0 | 0.977 | 13.1 | 2.76 | 0.293 |
| 0.80 | 2.800 | 7.4 | 0.993 | 2.6 | 0.36 | 0.130 |
| 0.85 | 2.975 | 3.1 | 0.997 | 0.8 | 0.09 | 0.073 |
| 0.90 | 3.150 | 0.9 | 0.999 | 0.2 | 0.01 | 0.033 |
| 1.00 | 3.500 | 0.0 | 1.000 | 0.0 | 0.00 | 0.000 |

Two facts follow, and **the second is the bigger one**:

1. **The float starts at the sine's steepest point.** Phase 0 is where `sin` has maximum
   slope, so the bob's very first instant is its fastest: 24.5 px/s, covering its first
   visible pixel in **0.041 s**. The motion does not begin, it switches on.
2. **The entrance has a dead tail, so the onset reads as a second, unrelated event.** By
   `p = 0.85` (t = 2.98 s) the cube is within 3 px of centre, at 99.7% scale, turning at
   0.8°/s with 0.09° of yaw left — visually parked. It then sits still for the remaining
   **~0.5 s** of the 3.5 s entrance before the bob switches on. The viewer sees *arrive →
   hold → twitch*, three beats, when the intent is one continuous settling.

Fixing only the velocity step (§4) removes the twitch but leaves the dead beat. Both
changes are needed for the transition to read as seamless; §5 is the one the review's "any
other recommendations" clause is asking for.

## 4. Change A1 — Ramp the float in with an amplitude envelope

**Requirement.** The float's velocity at its own onset is zero, so no motion switches on.

**Change.** Multiply the sine by a smoothstep envelope. Add to `src/easing.js`:

```js
export function smoothStep(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}
```

and rewrite `floatOffset` (`src/animation.js:63-66`):

```js
export function floatOffset(elapsed, opts) {
  const since = elapsed - (opts.duration - opts.overlap);
  if (since <= 0) return 0;
  const envelope = smoothStep(since / opts.rampDuration);
  return opts.amplitude * envelope * Math.sin((TAU * since) / opts.period);
}
```

`overlap` is §5; set it to 0 and this section stands alone.

**Why smoothstep specifically.** `S(u) = u²(3 − 2u)` has `S(0) = 0` **and** `S'(0) = 0`.
Writing `y = A·S(s/T)·sin(ωs)`, every term of `y'` and `y''` at `s = 0` carries a factor of
either `S(0)`, `S'(0)`, or `sin(0)`, so **position, velocity, and acceleration all start at
exactly zero.** The entrance also arrives with zero velocity and zero acceleration
(`y'' = 6·startY·(1−p)/D² → 0`), so the total vertical motion is **C² across the whole
timeline** — there is no order of derivative at which anything jumps. (It is not C³; the
entrance's third derivative is `−6·startY/D³` on the left and 0 on the right. Nothing
visible depends on C³.)

A plain linear ramp would give `S'(0) = 1/T ≠ 0` and only fix position — the velocity step
would shrink but not vanish. This is the reason to add `smoothStep` rather than reuse an
existing ease.

**Ramp duration.** `rampDuration` = **1.5 s** (0.3 of the float period):

| `rampDuration` | First peak | First peak at | Reaches 1 px |
| --- | --- | --- | --- |
| 1.0 s | 100.0% of A | s = 1.25 s | 0.256 s |
| **1.5 s** | **97.0% of A** | **s = 1.40 s** | **0.334 s** |
| 2.0 s | 81.1% of A | s = 1.58 s | 0.404 s |
| 2.5 s | 64.2% of A | s = 1.66 s | 0.469 s |

1.5 s is the knee: the onset is **8.1× slower** than today (0.334 s vs 0.041 s to the first
visible pixel) while the first upswing still reaches 97% of the amplitude, so the float
does not look like it is warming up for two cycles. Past 2.0 s the first peak is visibly
clipped and the bob reads as inconsistent between its first cycle and its later ones.

**Acceptance.** The bob's first upswing is imperceptible at its start and indistinguishable
from a steady-state cycle by the time it peaks.

## 5. Change A2 — Overlap the float with the entrance tail

**Requirement.** No motionless beat between the entrance and the float.

**Change.** Start the float's clock `overlap` seconds *before* the entrance ends:
`since = elapsed - (duration - overlap)` in §4's code. `FLOAT.overlap` = **0.7 s**.

The two offsets simply sum — both are smooth, so the sum is smooth — and the float emerges
from the entrance's still-live motion instead of following its corpse:

| `overlap` | Float starts at | Entrance still has | Max upward excursion | y at t = 3.5 |
| --- | --- | --- | --- | --- |
| 0.5 s | p = 0.857, t = 3.00 | 2.7 px, 0.7 °/s | 0.0776 u | 2.97 px |
| **0.7 s** | **p = 0.800, t = 2.80** | **7.4 px, 2.6 °/s, 0.36° yaw** | **0.0776 u** | **6.76 px** |
| 1.0 s | p = 0.714, t = 2.50 | 21.6 px, 10.8 °/s | 0.0887 u | 13.73 px |
| 1.4 s | p = 0.600, t = 2.10 | 59.3 px, 41.5 °/s | 0.2434 u | 18.90 px |

0.7 s is chosen to start exactly where the entrance becomes visually dead (§3, `p = 0.80`),
so the overlap costs nothing legible from the entrance and buys the whole dead beat back.

**Constraint — 0.7 s is the largest overlap that keeps the existing in-frame bound.**
`tests/scene.test.js:56` asserts the limiting half-extent exceeds `CUBE_RADIUS +
FLOAT.amplitude`. During the overlap the entrance offset and the float's first (upward)
half-cycle are both positive and add. At 0.7 s the maximum of the sum is **0.0776 u**, still
under `amplitude` = 0.08, so the assertion holds unchanged. At 1.0 s it is 0.0887 u and the
bound must be raised. Do not raise `overlap` past 0.7 s without also widening that bound.

**Consequence — three things stop being exactly zero at `t = 3.5`, deliberately.**

1. `floatOffset(duration)` becomes `0.02774` u (6.76 px), not `0`.
   `tests/animation.test.js:212` and `:239` assert `0` and must be rewritten (§20).
2. The cube's `y` at the end of the entrance is no longer `ENTRANCE.endY`. Nothing depends
   on this; `endY` remains the *entrance's* target, which it still hits exactly.
3. **The landing pose guarantee is untouched.** It is a claim about `yaw` and `pitch`
   (`src/animation.js:47-56`), and the float moves neither. Verify this explicitly in the
   plan — it is the one invariant the previous spec was written to establish.

**Acceptance.** From `t = 2.5 s` onward the cube is never motionless for longer than one
frame, and no observer can name the instant the entrance ends.

## 6. What must not change (already smooth)

Do not "also fix" these; they are correct and the measurements are in §3.

- **The entrance's position and scale curves.** `easeOutCubic` already lands with zero
  velocity and zero acceleration.
- **The spin decay.** `easeOutQuart` already lands at zero rev/s with a zero derivative.
- **The entrance duration, easing choices, and landing pose.** Part A changes none of them.
- **The drag unlock at `t = 3.5`** (`src/main.js:119`). It is an input gate, not motion, and
  moving it earlier would break the exact landing pose. Its abruptness is invisible.

---

# Part B — The cube as navigation (review item 2)

## 7. Derived architecture

The review's sequencing — *"the cube moves to the bottom middle of the screen as an overlay,
through an animation … and at the same time, the new page loads"* — forces three decisions
before any of the interaction can be designed.

**7a. The site must become a single-page app.** A real document navigation destroys and
recreates the WebGL context, so the cube would restart its entrance on every route change
instead of animating continuously into the dock. A persistent canvas across route changes
is only possible if the route change never reloads the document. This rules out separate
`.html` files per page.

**7b. The canvas is a persistent fixed layer; page content is DOM beneath it.** Layering,
bottom to top:

| Layer | Element | z-index | Pointer events |
| --- | --- | --- | --- |
| Content | `<main id="page">` | 0 | auto |
| Scrim | `<div id="scrim">` | 1 | auto only while the nav cube is open over content |
| Cube | `<canvas id="scene">` (fixed, full viewport) | 2 | `auto` when the big cube is up; `none` when docked |
| Dock button | `<button id="dock">` | 3 | auto only when docked |

The canvas stays full-viewport in every phase — that is what lets the cube animate from
screen centre to the bottom edge in one continuous motion. It cannot also swallow clicks on
the article text underneath, hence the `pointer-events` switch, and hence the separate
`<button>` (§14) rather than hit-testing the docked cube through the canvas.

**7c. Hash routing, not the History API.** `#/work`, `#/about`, … Rationale: `AGENTS.md`
records **"Deployment: not set up"**, and the History API would make correct production
behavior depend on a host rewrite rule that does not exist yet — a deep link to `/work` on a
static host 404s. Hash routing works identically on the Vite dev server, `npm run preview`,
and any static host, with zero configuration. Keep every route string in one table
(`src/routes.js`) so switching later is a one-file change. Decision §21.1.

## 8. Routes and the face map

`BoxGeometry`'s six material groups are in a fixed order, verified against three r185:

| `materialIndex` | Face | Reachable? |
| --- | --- | --- |
| 0 | +X (right) | by drag |
| 1 | −X (left) | visible at rest |
| 2 | +Y (top) | **always visible** |
| 3 | −Y (bottom) | **never** |
| 4 | +Z (front) | visible at rest |
| 5 | −Z (back) | by drag |

**The bottom face can never be picked, and the top face can always be picked.** Both follow
from the resting pitch of +15° being fixed and the Euler order being `XYZ` — yaw is applied
before pitch, so yaw leaves the ±Y normals invariant. Verified by sweeping all 360° of yaw:
the −Y normal is back-facing at every one of them, and the top face's projected area varies
only between 18 256 and 19 664 px² (7.9%–8.6% of the silhouette) across a full turn.

**Consequence: there are five pickable faces, not six. Assigning a route to the bottom face
would create an unreachable page.** State this in `src/routes.js` as a comment, or the next
person will add a sixth section.

Pickable area at the resting pose, per face:

| Viewport | −X (screen left) | +Z (screen right) | +Y (top) | Silhouette |
| --- | --- | --- | --- | --- |
| 1920×1080 | 115 780 px² (46.3%) | 114 872 px² (45.9%) | 19 584 px² (7.8%) | 250 236 px² |
| 390×844 | 14 146 px² (43.8%) | 14 127 px² (43.8%) | 4 006 px² (12.4%) | 32 279 px² |

The top face is the smallest target and it is still 4 006 px² (a 63 px square equivalent) on
a 390 px-wide phone, comfortably over the 44 px tap-target guideline. No face needs an
enlarged hit region.

**Proposed route table.** The top face is always visible and yaw-invariant, which makes it
the natural home for the primary section; the four side faces cycle under horizontal drag,
which reads as a carousel of four peers. Names and count are decision §21.5 — the
*structure* (top + four sides = five routes, bottom forbidden) is what this spec fixes.

| Face | `materialIndex` | Hash | Section | Notes |
| --- | --- | --- | --- | --- |
| +Y top | 2 | `#/work` | Work | always visible; the primary section |
| +Z front | 4 | `#/about` | About | visible at rest, screen right |
| −X left | 1 | `#/writing` | Writing | visible at rest, screen left |
| −Z back | 5 | `#/play` | Playground | reached by dragging |
| +X right | 0 | `#/contact` | Contact | reached by dragging |
| −Y bottom | 3 | — | **none** | unreachable by construction |
| — | — | `#/` (and empty) | Landing | no content; the big cube |

Under increasing yaw (a rightward drag) the side faces come round in the order +Z → −X →
−Z → +X, so the table's side rows are in the order the viewer meets them.

## 9. Picking: distinguishing a click from a drag

The same gesture on the same surface already means "spin the cube". A face click is
therefore a *failed* drag, and must be defined negatively.

**9a. Tap test.** On `pointerup`, treat the gesture as a tap iff both hold:

- maximum distance from the `pointerdown` point ≤ **8 CSS px** (`tapMaxTravelPx`), measured
  as straight-line distance from the origin, not cumulative path length, so jitter that
  returns to the origin still counts as a tap;
- press duration ≤ **500 ms** (`tapMaxDurationMs`), so a long press that ends without moving
  is not a navigation.

Only a tap raycasts. This runs entirely on the existing pointer plumbing
(`src/main.js:112-136`); do **not** add a `click` listener — `click` fires after a drag too,
and its target is the canvas, not a face.

**9b. A tap on a coasting cube brakes it and does not navigate.** `drag.start()` already
zeroes the velocity to make a press stop a coasting cube (`src/drag.js:31`), which is
existing intended behavior. Left alone, one tap would both brake and navigate. Require the
pre-press speed to be under **0.05 rev/s** (`tapMaxEntrySpeedRevs`) for a tap to count: the
first tap stops the cube, the second navigates. Implementation: `start(x)` returns the
magnitude of the velocity it cancelled, in rev/s. A one-value return on an existing method,
and directly unit-testable.

**9c. Identify the face by its geometry-local normal, not by `materialIndex`** — unless §10
lands, in which case either works. Verified: **`intersection.face.materialIndex` is `0` for
every hit when the mesh has a single material**, because `Mesh.raycast` only walks
`geometry.groups` when `material` is an array. With today's cube (`src/cube.js:17`) a
`materialIndex` face map would silently route every face to the same page — a bug that looks
like working code. `intersection.face.normal` is the geometry-local normal and is exactly
one of the six axis unit vectors for a box, with or without a material array. Map it:

```js
// local normal -> materialIndex, so one table serves picking and §10's highlight
const FACE_BY_NORMAL = { '1,0,0': 0, '-1,0,0': 1, '0,1,0': 2, '0,-1,0': 3, '0,0,1': 4, '0,0,-1': 5 };
```

**9d. Raycast mechanics.** Build NDC from the canvas's `getBoundingClientRect()`, not from
`window` — they coincide today but will not if the canvas box ever changes. Call
`cube.updateMatrixWorld()` before `intersectObject`, since the tap is handled outside the
render loop and the matrix would otherwise be one frame stale. A raycast miss is meaningful,
not a no-op: it dismisses the open nav (§11).

## 10. Face feedback is required, not polish

**At the resting pose the boundary between two routes runs exactly down the middle of the
cube, and it is a one-pixel switch.** Verified at 1920×1080, yaw 45°, pitch 15°: a ray at
screen centre hits the −X face; one pixel to the right hits +Z. The cube's visual centre is
the most natural place for a viewer to click, and clicking it is a coin flip between two
sections.

This cannot be fixed by geometry — the edge is the whole point of the resting pose
(`AGENTS.md`, *Resting pose*). It has to be fixed by telling the viewer which face is armed
**before** they commit:

- **Hover** (mouse): lighten the face under the pointer. Requires the raycast to run on
  `pointermove` while not dragging — throttle to once per animation frame, reusing the
  existing "record on move, fold on frame" pattern from `src/drag.js:9-13`.
- **Press** (all input types): lighten the pressed face on `pointerdown`, clear it on
  `pointerup`/`pointercancel`. Touch has no hover, so this is the only pre-commit signal
  there — and on touch the finger is already down before the viewer can adjust, which is
  the strongest argument for also keeping the tap-travel threshold generous (§9a).

**This forces the cube's material to become an array of six.** `cube.material` becomes
`[m0…m5]` on the same single `Mesh` (verified working on three r185), so per-face colour is
a one-line change and §9c's `materialIndex` path also becomes available. This contradicts
`AGENTS.md`'s *Cube look* decision ("one bare `Mesh`, no edge outline, no wrapping `Group`")
only on the word *one* — it is still one mesh, one geometry, one draw call per group. Amend
the wording (§18).

**Highlight colour** is decision §21.6. `AGENTS.md` notes blue is the nominated accent and
currently unused anywhere on the page; an armed nav face is the strongest candidate the
project has for spending it sparingly. The conservative default is a neutral lift
(`#e4e6ea` against the `#d6d8dc` face).

## 11. The state machine

Model this explicitly and purely, or it will end up as a tangle of booleans in `main.js`.

**State** = `{ phase, route, overlay, phaseStartedAt }`, where `route` is `null` on the
landing page and `overlay` is true when page content sits behind the big cube.

| Phase | Cube | Content | Canvas pointer events | Accepts |
| --- | --- | --- | --- | --- |
| `entering` | entrance animation | none | none | nothing (existing gate) |
| `resting` | centre, float + drag | hidden (`overlay` false) or behind scrim (true) | auto | drag, face tap, miss-tap (only if `overlay`), Esc (only if `overlay`) |
| `shrinking` | centre → dock | fading in (or cross-fading) | none | nothing |
| `docked` | dock, scaled float, no drag | visible, interactive | none | dock-button click |
| `expanding` | dock → centre | stays (→ `overlay` true) or fades out (→ landing) | none | nothing |

Transitions:

| From | Event | To |
| --- | --- | --- |
| `entering` | `elapsed ≥ ENTRANCE.duration` | `resting` (`overlay` false) |
| `resting` | face tap → route R (≠ current) | `shrinking` R; **push history** |
| `resting`, `overlay` | face tap → the current route | `shrinking` (same route); no history entry |
| `resting`, `overlay` | miss tap or Esc | `shrinking` (same route); no history entry |
| `shrinking` | `elapsed ≥ DOCK.duration` | `docked` |
| `docked` | dock-button click | `expanding` (→ `overlay` true) |
| `expanding` | `elapsed ≥ DOCK.duration` | `resting` |
| `docked`/`resting` | history → landing | `expanding` (→ `overlay` false) |
| `docked` | history → another route | swap content in place; no cube motion |
| any | direct load of a non-landing hash | `docked` immediately; **no entrance** (§15) |

Notes on the non-obvious rows:

- **Dismissal never pushes history.** Opening the nav over a page and closing it again is
  not a navigation; making it one would fill the back stack with no-ops.
- **A history jump between two content routes does not re-run the dock animation.** The cube
  is already docked and stays put; only the content changes. Animating it would be a
  1.8 s round trip for a back-button press.
- Keep a single monotonic `elapsed` (as today, `src/main.js:86`) and store
  `phaseStartedAt`; each transition's progress is `(elapsed − phaseStartedAt) / duration`.
  Do not add a second clock.

Write this as a pure `reduce(state, event) → state` in `src/navstate.js`. It then unit-tests
without a browser, which is the whole reason the project's architecture holds
(`README.md`, *Layout*).

## 12. Dock geometry and the dock transition

**12a. Dock size is a CSS-pixel size, not a scale factor.** The docked cube is a UI control,
so it should be the same physical size everywhere — but a fixed `scale` is not, because the
camera distance varies with aspect ratio:

| Viewport | scale for a 64 px silhouette | What `ENTRANCE.startScale` (0.15) would draw |
| --- | --- | --- |
| 1920×1080 | 0.1161 | 83 px |
| 1440×900 | 0.1393 | 69 px |
| 1000×1000 | 0.1254 | 77 px |
| 390×844 | 0.3216 | **30 px** |

Reusing `startScale` for symmetry with the entrance is tempting and wrong — it would draw a
30 px nav button on a phone and an 83 px one on a desktop. Derive the scale instead:

```
dockScale = min(DOCK.silhouettePx, DOCK.maxSilhouetteFraction * min(w, h))
            / (CUBE_SIZE * sqrt(2) * pxPerWorldUnit)
dockY     = -(visibleHalfHeight - CUBE_RADIUS * dockScale - DOCK.bottomMarginPx / pxPerWorldUnit)
```

`silhouettePx` = **64**, `maxSilhouetteFraction` = **0.16** (only binds below ~400 px of
minimum dimension, where 64 px would start to dominate), `bottomMarginPx` = **24**.
`CUBE_RADIUS * dockScale` uses the bounding sphere, so the clearance is conservative at any
pose. Resulting `dockY`: −1.958 (1920×1080), −1.906 (1440×900), −4.079 (390×844).

Compute both in `scene.js`'s `resize()` and expose them as getters beside `startY`
(`src/scene.js:44-49`) — same pattern, same reason: they change on resize and callers must
read them live.

**12b. Use `easeInOutCubic`, not the entrance's `easeOutCubic`.** The entrance starts
off-screen already at speed, so an ease-*out* is right. The dock starts from a standstill at
screen centre — an ease-out there begins at maximum velocity, which is **exactly the defect
Part A exists to fix.** Add `easeInOutCubic` to `src/easing.js`. Position, scale, and yaw all
run on it, and `expanding` is the same curve reversed.

**12c. Yaw during the dock: snap to the nearest resting pose, do not spin.** The viewer may
have dragged to any yaw. Rotate by the **shortest signed angle** to the nearest
`SETTLE.yaw + k·90°` — at most 45° of turn. Rationale: the docked cube should read as a
cube (edge-on shows three faces; face-on reads as a flat square), and it keeps `AGENTS.md`'s
recorded edge-on pose. `expanding` returns to that same pose, so reopening is exactly
symmetric and the cube never appears to have moved while docked. A multi-revolution spin
would be "similar to the appearance animation" in the literal sense and wrong here: the
entrance's spin is a curtain-raiser, this is a 0.9 s UI transition.

**12d. `DOCK.duration` = 0.9 s.** Long enough to read as one continuous move across the
whole viewport, short enough not to gate navigation. It is not the entrance's 3.5 s.

**12e. The float continues throughout, scaled by the cube's scale.** Multiply
`floatOffset(...)` by the current scale at the call site (`src/main.js:98`) rather than
teaching `floatOffset` about scale. Consequences: the docked cube keeps a proportionally
smaller bob (0.0186 u ≈ 4.5 px peak-to-peak at 1080p — subtle, alive, and clearly a live
object rather than an icon); the amplitude shrinks *smoothly* through `shrinking`, so no
extra handover is needed; and on the landing page nothing changes, since scale is 1 there.
The only measurable effect on Part A is during the entrance overlap, where scale is ≥ 0.993
(§3) — under half a percent.

**12f. Content fades in over the back 60% of `shrinking`** (`DOCK.contentFadeStart` = 0.4),
so the cube visibly commits to moving before the page arrives. When switching routes from
`resting` with `overlay` true, swap the DOM at the transition midpoint, where opacity is 0.
Express the opacity as a pure function of progress so it is testable.

## 13. Content pages

Lorem ipsum, per the review, but **differentiated enough to verify routing by eye**. Each
route's content must carry:

1. an `<h1>` with the section name (also written to `document.title`);
2. a visible copy of its own hash (e.g. a small `#/writing`), so a wrong-face bug is
   unmistakable rather than "the text looks different";
3. a distinct paragraph count (2–5) and distinct lorem text per route.

Store the five pages as data in `src/pages.js` — a `route → { title, blocks }` map plus a
pure `renderPage(route) → HTML string`. Keep the string builder pure and DOM-free so it
unit-tests; `main.js` does the single `innerHTML` assignment. All content is
project-authored, so `innerHTML` is not a sanitisation question here; note it anyway so the
next person adding externally-sourced content sees the boundary.

Styling stays inside the design direction — very minimal, geometric, light gray on the same
`#f7f7f8`: one type scale, a `max-width` measure of ~62ch, generous leading, no rules, no
cards, no colour. The content must not visually compete with the docked cube, which is the
only interactive element on the page.

## 14. The docked cube as a control, and keyboard access

**14a. The dock button.** A real `<button id="dock">`, positioned `fixed` at bottom-centre
over where the cube is drawn, transparent background, no border, `aria-label="Open
navigation"`, minimum 44×44 px regardless of the drawn silhouette (so the 62 px phone case
in §12a stays tappable). It exists only in the `docked` phase — remove it from the DOM or
`hidden` it otherwise, so it is never a focus stop when the big cube is up. It carries the
focus ring; the canvas cannot.

**14b. Face clicking is pointer-only, which leaves keyboard users with no navigation.** A
raycast has no keyboard equivalent. Minimum viable fix: a `<nav>` of five `<a href="#/…">`
links, always in the DOM, visually hidden but focusable (`clip-path` / sr-only, **not**
`display: none`), placed first in the document so it doubles as skip navigation. It is
invisible, so the "canvas only" look is preserved — but it *is* DOM text, so the
`AGENTS.md` decision must be reworded from "no DOM text" to "no visible DOM text on the
landing page" (§18).

**14c. Route-change announcement.** Set `document.title` per route, and after content mounts
move focus to the `<h1>` (`tabindex="-1"`). Standard SPA practice and cheap; without it a
screen-reader user gets no indication that anything happened.

**14d. Esc closes the open nav** (§11). Also required for the pointer case: with the big
cube over content there must be a way out that is not "guess that clicking the background
works".

**14e. `prefers-reduced-motion`.** `AGENTS.md` records it as deliberately unhonored. Part B
changes the stakes: motion now gates *navigation*, not decoration — a motion-sensitive
viewer waits 0.9 s of animation to reach a page, twice per round trip. Recommend honoring it
**for the dock transitions only** (clamp `DOCK.duration` to 0.12 s), leaving the entrance
decision as recorded. One clamp, and it keeps a recorded decision from quietly becoming an
accessibility problem. Decision §21.7.

## 15. Deep links, history, and reload

- **Direct load of `#/work`** (deep link, refresh, or a shared URL) starts in `docked` with
  the content already mounted and **no entrance**. Playing 3.5 s of theatre before showing
  requested content is wrong, and there is no dock transition to play because there is no
  prior on-screen position to move from. Set `elapsed` past the entrance so the float is at
  its steady state.
- **Direct load of `#/` or an empty hash** starts in `entering`, exactly as today.
- **An unknown hash** (`#/nonsense`) redirects to the landing route and replaces the history
  entry, so the back button does not bounce.
- **`hashchange` is the single source of truth for `route`.** Face taps navigate by setting
  `location.hash`, and the resulting `hashchange` drives the state machine. This makes the
  back button work for free instead of needing a parallel code path, and it is why §11's
  transition table is keyed on history events rather than on clicks.
- **Scroll position resets to top on every route change**, and is restored on
  back/forward if `history.scrollRestoration` is left at its default.

## 16. CSS and document changes

- `index.html` gains `<nav>` (§14b), `<main id="page">`, `<div id="scrim">`, and
  `<button id="dock">` around the existing canvas.
- `html, body { overflow: hidden }` (`src/style.css:10`) must go — content pages scroll.
  Replace with `overflow: hidden` applied only while the nav is open over content (a
  `data-phase` attribute on `<html>` is the cleanest hook and doubles for the
  `pointer-events` switching in §7b).
- `#scene` becomes `position: fixed; inset: 0` and loses `100vw/100vh` (`main.js` already
  writes matching inline pixels — see the note at `src/main.js:63-69`, which is why
  `updateStyle` is left on).
- `cursor: grab` stays for the big cube; the dock button gets `cursor: pointer`.
- `touch-action: none` stays on `#scene`, and is harmless in `docked` where the canvas takes
  no pointer events.

## 17. Config surface

| Key | Today | Proposed |
| --- | --- | --- |
| `FLOAT.rampDuration` | — | `1.5` (new, §4) |
| `FLOAT.overlap` | — | `0.7` (new, §5) |
| `FLOAT.amplitude`, `.period` | `0.08`, `5.0` | unchanged |
| `DOCK` | — | `{ duration: 0.9, silhouettePx: 64, maxSilhouetteFraction: 0.16, bottomMarginPx: 24, contentFadeStart: 0.4 }` (new, §12) |
| `PICK` | — | `{ tapMaxTravelPx: 8, tapMaxDurationMs: 500, tapMaxEntrySpeedRevs: 0.05 }` (new, §9) |
| `COLORS.faceArmed` | — | `0xe4e6ea` neutral, or the blue accent (new, §10 / §21.6) |
| `ROUTES` | — | new file `src/routes.js` (§8) |

Unchanged: `CUBE_SIZE`, `CUBE_RADIUS`, `FIT_MARGIN`, `CAMERA_FOV`, `COLORS.background`,
`COLORS.face`, all of `ENTRANCE`, all of `DRAG`, `SETTLE`, `ENTRANCE_TUMBLE_RATIO`,
`MAX_PIXEL_RATIO`, `MAX_FRAME_DELTA`.

**The stale comment at `src/animation.js:60-62`** ("is 2.8% and is deliberately not ramped")
must be deleted, not amended around — it argues for the behavior Part A removes, and §3
explains why its reasoning was wrong.

## 18. Spec-of-record amendments

**`AGENTS.md` — Current Scope / Out of Scope.** "One landing page. Nothing else yet." becomes
the landing page plus five content routes. Delete the Out-of-Scope entries "More pages,
routes, nav" and "Project/case-study content, about section, contact form" — or narrow the
second to "real content" and record that the pages ship as differentiated lorem ipsum.

**`AGENTS.md` — Landing Page requirements.** Requirement 4's "hold pose still and drift
gentle up and down forever" gains the ramp and overlap. Add a requirement for face-click
navigation and the docked nav button.

**`AGENTS.md` — Decisions.**

- *Idle float:* "phase-anchored to the end of the entrance so it is exactly 0 at the
  handover and always begins moving upward" is **no longer true** and is the sentence Part A
  changes. Replace with the envelope + overlap, the C² claim, and the 0.7 s / 0.08 u bound
  from §5.
- *Cube look:* "one bare `Mesh`" → one `Mesh` with a six-material array, and why (§10).
- *Page:* "no DOM text — canvas only" → no *visible* DOM text on the landing page; record
  the hidden nav (§14b).
- *Reduced motion:* update per §21.7.
- **New decision — routing:** hash-based, and the reason (deployment is not set up, §7c).
- **New decision — the bottom face is unreachable** at a fixed +15° pitch, so it gets no
  route (§8). Non-obvious, empirically established, and will be rediscovered otherwise.
- **New decision — `face.materialIndex` requires a material array** (§9c). This one silently
  produces working-looking code that routes every face to the same page.
- **New decision — the resting pose puts a route boundary at screen centre** (§10), which is
  why hover/press feedback is a requirement and not polish.

**`README.md`:** the intro ("holds its pose and drifts gently up and down forever"), the
Layout list (new files: `routes.js`, `navstate.js`, `pick.js`, `pages.js`, `dock.js`), the
"only browser-coupled file" claim (still `main.js` — verify it stays true), and the Design
direction paragraph if blue is spent on the armed face.

## 19. Implementation notes

**Part A** — three files:

| File | Change |
| --- | --- |
| `src/easing.js` | Add `smoothStep`. |
| `src/animation.js` | Rewrite `floatOffset` (§4); delete the stale comment at `:60-62`. |
| `src/config.js` | `FLOAT.rampDuration`, `FLOAT.overlap`. |
| `src/main.js` | None — `FLOAT_OPTS` already spreads `FLOAT` (`:47`). |

**Part B** — new files, all pure and headless-testable except `main.js`:

| File | Role |
| --- | --- |
| `src/routes.js` | Route table, face-normal → `materialIndex` → route map, hash parse/serialise, unknown-hash fallback. |
| `src/navstate.js` | `reduce(state, event) → state`. The §11 machine. No DOM, no three. |
| `src/pick.js` | Tap-vs-drag discrimination (§9a–b) and NDC conversion. No three. |
| `src/dock.js` | Dock/undock interpolation as pure functions of progress; shortest-angle yaw snap (§12c); content-opacity curve (§12f). |
| `src/pages.js` | Route → content data, and `renderPage(route) → string`. |
| `src/cube.js` | Material array of six (§10); `setArmedFace(index \| null)`. |
| `src/scene.js` | `dockScale` and `dockY` getters computed in `resize()` (§12a). |
| `src/camera.js` | Expose `pxPerWorldUnit` (or accept height and return it) for §12a. |
| `src/main.js` | Raycaster; `pointermove` hover; tap detection; `hashchange`; Esc; the dock button; phase-driven `pointer-events` and `data-phase`; content mounting; focus management. |
| `index.html`, `src/style.css` | Per §16. |

`main.js` is already the largest file at 139 lines and will roughly double. If it passes
~250 lines, split the DOM event wiring into `src/input.js` and keep `main.js` as the loop
plus composition — but do not pre-split; the seam is not obvious until the code exists.

## 20. Test plan

Plain Node, no browser, no WebGL — same as the existing suite. three's math and raycaster
run headlessly, as the measurements in this spec demonstrate.

**Part A — amended `tests/animation.test.js`:**

1. `:210-212` — `floatOffset(0)` and `floatOffset(1.75)` stay `0`;
   **`floatOffset(3.5)` becomes `≈ 0.02774`**, not `0` (§5).
2. `:216` — negative `t` still returns `0`.
3. New: `floatOffset(duration − overlap) === 0` exactly, and is `> 0` one millisecond later.
4. New: the velocity at the float's own onset is ~0 — a finite difference across
   `(t₀, t₀ + 1e-4)` is under 1e-6, versus ~0.1 for the unramped form. **This is the test
   that would have caught the original defect.**
5. New: the second derivative at the onset is ~0 by finite difference (§4's C² claim).
6. `:220-228` — quarter/half/three-quarter peaks must now be measured from
   `duration − overlap` and multiplied by `smoothStep`. Simplest correct rewrite: assert the
   first peak is `0.970 × amplitude` at `t₀ + 1.40 s`.
7. `:231-234` — `|floatOffset| ≤ amplitude` still holds (the envelope only ever attenuates).
8. `:239` — the `t = duration + 1e-9 ≈ 0` continuity case is void; replace with continuity
   at `t₀ = duration − overlap`.
9. New: with `overlap: 0, rampDuration: 1e-9` the function reproduces the old
   `amplitude·sin(...)` — proves the change is a strict generalisation.
10. New: `entranceRotation` is unaffected — `yaw(3.5) === SETTLE.yaw` and
    `pitch(3.5) === SETTLE.pitch` exactly (the §5 invariant).

**Part A — `tests/easing.test.js`:** `smoothStep(0) === 0`, `smoothStep(1) === 1`,
`smoothStep(0.5) === 0.5`, clamping outside [0,1], and `S'(0) === S'(1) === 0` by finite
difference.

**Part A — `tests/scene.test.js:56`:** unchanged, but add an assertion that the maximum of
`entranceY(t) + floatOffset(t)` over the overlap window stays under `FLOAT.amplitude` — that
is the constraint that pins `overlap` at 0.7 s, and it is currently only in this document.

**Part B — new `tests/routes.test.js`:**

11. All six face normals map to a `materialIndex`; all five routed indices map to a hash.
12. **`materialIndex` 3 (−Y) maps to no route** (§8).
13. Hash round-trip; unknown hash → landing; empty hash → landing.
14. Every route in the table has a page in `src/pages.js`, and vice versa.

**Part B — new `tests/navstate.test.js`:** every row of §11's transition table, plus:

15. Dismissing the open nav does not produce a history push.
16. A face tap on the current route while `overlay` closes without pushing.
17. A history jump between two content routes leaves the phase at `docked`.
18. Events are ignored during `shrinking` and `expanding`.
19. `entering` ignores every input event.

**Part B — new `tests/pick.test.js`:**

20. 7 px of travel over 300 ms is a tap; 9 px is not; 7 px over 600 ms is not.
21. Travel is measured from the origin, so out-and-back within 8 px is still a tap.
22. An entry speed of 0.06 rev/s blocks the tap; 0.04 rev/s does not.
23. NDC conversion against a canvas rect with a non-zero origin.

**Part B — new `tests/dock.test.js`:**

24. Progress 0 gives the resting position/scale/yaw; progress 1 gives `dockY`/`dockScale`
    and a yaw that is exactly `SETTLE.yaw + k·90°`.
25. Yaw snap takes the shortest signed path and never turns more than 45°; check both
    directions and the ±180° boundary.
26. `expanding` at progress `p` equals `shrinking` at `1 − p` (exact symmetry).
27. `easeInOutCubic` derivative is 0 at both ends (§12b — the same property Part A is about).
28. Content opacity is 0 for progress ≤ `contentFadeStart` and 1 at progress 1.

**Part B — new `tests/facepick.test.js`** (uses three, still headless):

29. A ray down the camera axis at yaw 45°/pitch 15° hits the −X face, and one pixel right
    hits +Z — locking in the §10 boundary so a regression in Euler order or pose is caught.
30. Sweeping all 360° of yaw, the −Y face is never front-facing (§8).
31. With a **single** material every hit reports `materialIndex: 0`; with the array it
    reports the true index. Locks §9c's trap in place as an executable note.

**Amended `tests/cube.test.js`:** six materials, all `COLORS.face` initially; `setArmedFace`
changes exactly one and clears correctly.

**Unchanged:** `tests/math.test.js`, `tests/camera.test.js`, `tests/pose.test.js`, and the
`entranceState` cases.

**Manual checks the suite cannot cover:** whether the handover now reads as seamless (§3 is
a measurement, not a verdict); dock/undock feel at 0.9 s; the hover highlight's legibility
at the centre edge; a real touch device (tap vs drag with a fat finger, and whether 8 px of
slop is enough); iOS scroll jank with a full-viewport fixed canvas over scrolling content
(§7b); and back/forward through a full click path.

## 21. Decisions to confirm

Ordered by how much they change the deliverable. 1, 2, and 5 should be answered before
planning Part B; the rest have workable defaults.

1. **Routing mode — hash or History API?** (§7c) Recommend **hash**: it is the only option
   that works today, because deployment is not set up and the History API needs a host
   rewrite rule to survive a deep link. Costs a `#` in every URL.
2. **What does reopening the docked cube do?** (§11) Recommend **(R2) it expands over the
   current page as a nav overlay** — content stays behind a scrim, picking a face navigates,
   Esc or a background tap re-docks. This is what "the cube is the main navigation
   mechanism" implies. The simpler **(R1)** is that reopening returns to the landing page and
   unmounts the content; less code, but then the cube is a home button rather than a nav,
   and reaching section B from section A takes two steps.
3. **Dock size and position — 64 px silhouette, 24 px above the bottom edge?** (§12a) Taste.
   The derivation matters more than the number: a fixed `scale` would draw 30 px on a phone
   and 83 px on a desktop.
4. **Dock duration — 0.9 s?** (§12d) Taste, and the one number most worth trying live. Under
   ~0.6 s the travel across the viewport reads as a jump; over ~1.2 s navigation feels gated.
5. **Route set — five sections, with Work on the top face?** (§8) The structure is fixed by
   geometry (top + four sides; the bottom is unreachable), but the count and names are
   yours. Four is also fine — leave the top face routed and drop one side.
6. **Armed-face highlight — neutral lift or the blue accent?** (§10) Recommend starting
   **neutral** (`#e4e6ea`) and trying blue as a second pass. Blue is the nominated accent and
   is currently unused anywhere; an armed nav face is the best candidate the project has for
   spending it, but it is also the page's only colour and will dominate.
7. **Honor `prefers-reduced-motion` for the dock transitions?** (§14e) Recommend **yes**,
   clamped to 0.12 s, leaving the entrance's recorded stance alone. Motion now gates
   navigation rather than decoration, and this is a one-line clamp.
8. **Tap slop — 8 px / 500 ms?** (§9a) Expect one round of tuning on a real touch device.
   Too tight and taps get eaten as micro-drags; too loose and a slow drag navigates.
9. **Part A's overlap — 0.7 s?** (§5) Recommend 0.7 s: it is where the entrance goes
   visually dead *and* the largest value that keeps `tests/scene.test.js:56`'s bound. 0.5 s
   is the conservative alternative; past 0.7 s the in-frame bound must be widened too.

## 22. Non-goals

- No change to the entrance's duration, position curve, scale curve, spin decay, easing
  choices, or landing pose. Part A adds to the float only; Part B adds no motion before
  `t = 3.5 s`.
- No real content. Pages ship as differentiated lorem ipsum (§13).
- No vertical drag, pinch, scroll-driven rotation, or snap-back. `DRAG` is untouched.
- No second 3D object, no per-page 3D, no cube-face textures or labels.
- No page transition beyond the cube move and a content fade — no slides, no shared-element
  animation between the cube and the page.
- No route for the bottom face (§8), now or later.
- No visible nav text, breadcrumb, or menu. The hidden nav (§14b) is an accessibility
  affordance, not a design element.
- No shrinking of the WebGL drawing buffer while docked. Rendering a full-viewport frame for
  a 64 px cube is wasteful in principle but the scene is 12 triangles on a flat clear;
  measure before optimising, and note that a smaller canvas would complicate the transition
  (the cube travels the full viewport). Gate rendering on `document.hidden` and stop there.
- Deployment stays out of scope. §7c is chosen specifically so this stays true.

## 23. Acceptance criteria

**Part A**

- [ ] The bob's onset is imperceptible: no instant at which vertical motion switches on.
- [ ] From `t = 2.5 s` onward the cube is never motionless for more than one frame, and the
      end of the entrance cannot be identified by eye.
- [ ] The finite-difference velocity and acceleration at the float's onset are ~0 (§20.4–5).
- [ ] `entranceRotation(3.5)` still returns exactly `SETTLE.yaw` / `SETTLE.pitch`.
- [ ] The cube never leaves frame at any tested aspect ratio.

**Part B**

- [ ] Clicking a face routes to that face's page; the docked cube and the content arrive
      together, as one movement.
- [ ] Which face is armed is visible before the click, including at dead screen centre where
      two routes meet (§10).
- [ ] A horizontal drag still spins the cube and never navigates; a tap navigates; a tap on
      a coasting cube brakes it without navigating.
- [ ] The cube animates continuously from centre to dock — it never disappears, reloads, or
      restarts its entrance.
- [ ] The docked cube reopens the big cube, and the big cube can be dismissed without
      navigating.
- [ ] All five routes are reachable: two by clicking at rest, one on the top face, two after
      dragging. The bottom face has no route and cannot be reached.
- [ ] Each page is visibly distinct and shows its own hash (§13).
- [ ] Back and forward move through the visited routes correctly, and dismissing the nav
      leaves no history entries.
- [ ] A deep link and a refresh on `#/work` land on the docked state with content, and play
      no entrance.
- [ ] An unknown hash lands on the landing page without a back-button bounce.
- [ ] Keyboard alone can reach every route, and the dock button is focusable with a visible
      focus ring.
- [ ] Content pages scroll; the cube stays put while they do.
- [ ] Works on a real touch device: tap to navigate, drag to spin, no pull-to-refresh.

**Both**

- [ ] `AGENTS.md` and `README.md` contain no statement contradicted by this work (§18).
- [ ] `npm test` passes, including every new and amended case in §20.
- [ ] `npm run build` succeeds and `npm run preview` serves a working deep link.
