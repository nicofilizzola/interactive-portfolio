# Spec: Spin the Dock Transition

**Status:** approved — Option B selected on 2026-09-02; every transition spins. Quintic
`smootherStep` replaced cubic `smoothStep` after manual review of the first implementation.
**Date:** 2026-09-01
**Supersedes:** `docs/review.md` item 1 (the freeform review this was written from).
**Follows:** `docs/plans/2026-08-31-cube-navigation.md` (shipped; the dock transition this modifies).
**Reverses:** the "snap, do not spin" decision recorded in `src/dock.js:11-13` and `AGENTS.md` — see §2.

## 1. Goal

The cube should **turn** as it travels to the dock, so the trip reads as a move with the
entrance's character rather than a scale-down with a small pose correction.

The travel path, the 0.9 s duration, the position and scale curves, the dock geometry, the
content fade, the entrance, the drag model, and routing are all unchanged. This spec adds
exactly one thing to the transition: yaw.

## 2. What this reverses, and what survives

`src/dock.js:11-13` says, in as many words:

> Snap, do not spin: a multi-revolution turn would be "similar to the appearance animation"
> in the literal sense and wrong here. The entrance's spin is a curtain-raiser; this is a
> 0.9 s UI transition.

The review overrules that aesthetic call, and this spec takes it as settled. What was
bundled into it and **does not** get overruled is the reason the snap exists at all:

> the docked cube should read as a cube (edge-on shows three faces; face-on reads as a flat
> square) and should keep the recorded resting pose.

That constraint is load-bearing — `src/scene.js:50-51` derives `dockScale` from
`CUBE_SIZE * sqrt(2)`, the **edge-on** silhouette width, so a docked cube at any other yaw
is drawn at the wrong pixel size. The spin is therefore admitted only in a form that leaves
the landing pose bit-for-bit identical: a **whole number of revolutions** (§4).

## 3. Current behavior (verified)

`npm test` — 14 files, 209 tests, all passing at `7e0d4df`.

| Aspect | Today | Where |
| --- | --- | --- |
| Transition duration | `0.9 s`, or `0.12 s` under `prefers-reduced-motion` | `src/config.js:93-94`, `src/main.js:103-108` |
| Position + scale | `easeInOutCubic` from centre/1.0 to `dockY`/`dockScale` | `src/dock.js:31-40` |
| Yaw | `opts.yaw + yawSnapDelta(...) * easeInOutCubic(p)` — at most **45°** of turn, total | `src/dock.js:38` |
| Expanding | The same function run at `1 - progress` | `src/main.js:313` |
| Yaw bookkeeping | The snap is folded into `yawOffset` once, at the end of `shrinking` | `src/main.js:238` |
| Transition snapshot | `transitionYaw = lastYaw`, taken when the phase starts | `src/main.js:219` |

Two facts drive this spec:

1. **The transition already owns the yaw.** `dockState` returns it and `src/main.js:322`
   assigns it outright, so there is no new plumbing to build — only a different number to
   return.
2. **The transition is not only a navigation.** `shrinking` also serves *dismissals*
   (`missTap`, `escape`, and a tap on the face already showing — `src/navstate.js:71-80`),
   and `expanding` serves *opening the nav* (`dockClick`). The review describes the
   navigation case. Whether the other three spin is §8.

## 4. Change 1 — a whole-revolution yaw spin

**Requirement.** The cube turns through complete revolutions on the way to the dock, on top
of the snap it already performs.

**Change.** `dockState` gains `opts.spinRevolutions`, and the yaw becomes one term rather
than one term times a curve:

```
turn   = yawSnapDelta(opts.yaw, opts.settleYaw) + TAU * spinRevolutions
yaw(p) = opts.yaw + turn * spinCurve(p)
```

with `spinRevolutions` defaulting to `0`. The snap moves onto the same curve as the spin
(§5) rather than staying on its own: two curves summed have a strictly higher peak rate
(900 °/s versus 843.75 °/s in the worst case) for no gain in legibility, and one curve is one
thing to reason about.

**Why whole revolutions, and not "about a turn and a bit".** Three separate invariants all
require `spinRevolutions` to be an integer:

- **The landing pose.** `TAU * N` is a multiple of the cube's 90° yaw symmetry, so
  `dockState(1).yaw` stays an exact quarter turn off `SETTLE.yaw` for every start yaw.
  Swept over ±720° of start yaw at `N = 0, 1, 2`, the worst deviation from an exact quarter
  turn is **1.8e-15 rad**. A fractional spin docks the cube off-pose and at the wrong
  drawn size, per §2.
- **The `yawOffset` fold.** `src/main.js:238` folds only the snap delta into `yawOffset`,
  so on the first `docked` frame the drawn yaw drops by exactly `TAU * N`. With an integer
  `N` that is the same pose and nothing moves; with a fraction the cube jumps on the frame
  the phase flips.
- **The mirror.** `expanding` re-enters the same function at `1 - p` and lands on
  `dockState(0).yaw === transitionYaw`, which is the yaw the docked cube was already
  drawn at. Verified: `yaw(p) + yaw(1-p) = 2*yaw₀ + turn` to within **3.6e-15 rad** at
  `N = 0, 1, 2`.

**Direction: positive yaw, matching the entrance.** `entranceRotation` returns
`settleYaw - TAU * remaining` with `remaining` falling to 0, so the entrance's yaw
increases. The dock spin uses the same sign. Because `yawSnapDelta` is bounded to ±45°,
the total turn at `N = 1` is always in `(315°, 405°]` — always positive, so the yaw is
**monotonic** through the whole transition and the cube never appears to hesitate or back
up. Verified monotonic from start yaws at −45°, 0°, and +45° off the settle pose.

**Yaw only — no pitch tumble.** The entrance tumbles the pitch as well
(`ENTRANCE_TUMBLE_RATIO`), and copying that here is tempting and wrong. A whole pitch
revolution swings the bottom face through view, and the "the bottom face is unreachable,
so it gets no route" decision rests on the pitch being fixed at +15° outside the entrance;
a fractional tumble does not return to the landing pose at all. Pitch stays
`SETTLE.pitch` for the entire transition, exactly as today.

**Acceptance.** `dockState(1, {...opts, spinRevolutions: N}).yaw` and
`dockState(1, {...opts, spinRevolutions: 0}).yaw` differ by exactly `TAU * N`, and both are
an exact quarter turn off `SETTLE.yaw`.

## 5. Change 2 — the spin runs on `smootherStep`, not `easeInOutCubic`

**The constraint.** The cube's yaw has 90° rotational symmetry, so past **45° of yaw per
rendered frame** the spin reads as running backwards. This is the same ceiling that pins
`ENTRANCE.startSpin` at 4.5 (`src/config.js:22-29`), and it binds harder here: 0.9 s is a
quarter of the entrance's 3.5 s.

**The measurement.** Peak angular rate is `turn * maxSlope(curve) / duration`, at the
curve's steepest point. Worst case is a +45° snap in the same direction as the spin, giving
a 405° total turn. `easeInOutCubic` peaks at slope **3.000** (measured, at p = 0.5);
`smoothStep` peaks at **1.500**; quintic `smootherStep` peaks at **1.875**.

| Curve | Peak slope | Peak rate | °/frame @ 30 fps | °/frame @ 60 fps | Headroom vs 45° |
| --- | --- | --- | --- | --- | --- |
| `easeInOutCubic` | 3.0 | 1350 °/s | **45.00** | 22.50 | **0%** |
| `smoothStep` | 1.5 | 675 °/s | 22.50 | 11.25 | 50% |
| `smootherStep` | 1.875 | 843.75 °/s | 28.125 | 14.0625 | 37.5% |

One revolution on the position/scale curve lands **exactly on the strobing threshold** with
zero headroom. That is not a margin anyone can ship. The first implementation used
`smoothStep`, but manual review found the expanding spin's finish too abrupt even though its
velocity reached zero. Its acceleration does not: `S''(0) = 6` and `S''(1) = -6`.
`smootherStep` fixes the observed cutoff by making both velocity and acceleration zero at
both endpoints while retaining 37.5% strobing headroom.

**It costs one shared easing helper, not a transition branch.** `smootherStep` satisfies
`S(p) + S(1-p) = 1` (so `expanding` remains an exact mirror),
`S'(0) = S'(1) = 0` (zero endpoint velocity), and
`S''(0) = S''(1) = 0` (zero endpoint acceleration). Applying it to both directions keeps one
curve and avoids an expanding-only special case.

**Using a different curve for the rotation than for the travel is the established pattern**,
not a new inconsistency: the entrance already runs position and scale on `easeOutCubic` and
the spin on `easeOutQuart`, for exactly this reason.

**The revolution count.** With `smootherStep` at 0.9 s:

| `spinRevolutions` | Total turn (worst) | Peak rate | °/frame @ 30 fps | Verdict |
| --- | --- | --- | --- | --- |
| 1 | 405° | 843.75 °/s | 28.125 | **Ship this.** 37.5% headroom. |
| 2 | 765° | 1593.75 °/s | 53.125 | Strobes. |
| 3 | 1125° | 2343.75 °/s | 78.125 | Strobes. |

The exact 30 fps cap is **`spinRevolutions` ≤ 1.675**. Set it to **1**.

**One revolution is not timid.** Over 0.9 s it averages **1.111 rev/s** and the worst 405°
turn peaks at **2.344 rev/s** — faster than the entrance's 0.900 rev/s average across its whole 3.15
revolutions. The entrance only feels bigger because it runs four times as long.

**No relief from the shrink.** The spin peaks at p = 0.5, where `easeInOutCubic(0.5) = 0.5`
puts the cube at **55.8%** scale — a 308 px silhouette at 1920×1080, 28.5% of the viewport's
smaller dimension. It is still far too large for aliasing to hide a strobe. The 45° limit
applies at full strength.

**Acceptance.** Sampled at 1/1000 of the transition, the worst-case peak yaw rate is
843.75 °/s ± 0.01, and finite-difference tests show zero endpoint velocity and acceleration.

## 6. Change 3 — reduced motion does not spin

`DOCK.reducedDuration` is 0.12 s. One revolution compressed into it peaks at **210.9° per
frame** at 30 fps — nearly five times the strobing limit, on the code path that exists
specifically to spare motion-sensitive viewers.

**`spinRevolutions` is 0 whenever `prefers-reduced-motion` is set.** The transition falls
back to exactly today's snap-only behavior. This needs no special pleading: the spin is
decoration layered on a transition that already gets the viewer where they asked to go, and
stripping decoration is what the setting means. The existing stance on the entrance's 3.5 s
(deliberately not honored) is unaffected.

## 7. Config surface

| Key | Today | Proposed |
| --- | --- | --- |
| `DOCK.spinRevolutions` | — | `1` (new) |

Everything else in `src/config.js` is untouched. `DOCK.duration`, `DOCK.reducedDuration`,
`DOCK.silhouettePx`, `DOCK.maxSilhouetteFraction`, `DOCK.bottomMarginPx`, and
`DOCK.contentFadeStart` all keep their values and their recorded reasons.

The new key carries the §5 ceiling in its comment, in the style of `ENTRANCE.startSpin`:
1.675 is the 30 fps cap at `DOCK.duration` 0.9 s, and **shortening `duration` lowers it
proportionally** — the two numbers cannot be tuned independently.

## 8. Decision — every transition spins (Option B)

**Resolved on 2026-09-02: Option B.** All six transition shapes use one whole revolution.
Shrinking transitions turn forward; expanding transitions run the exact mirror and unwind
backward. `prefers-reduced-motion` still overrides the choice with zero revolutions.

The review describes one case: a face tap that navigates. Six transition shapes reach
`dockState`, and they are not all navigations.

| # | Trigger | Phase | Route | What it is |
| --- | --- | --- | --- | --- |
| S1 | Face tap on another section | `shrinking` | changes | **Navigation** — the review's case |
| S2 | Face tap on the section already showing | `shrinking` | same | Dismissal |
| S3 | `missTap` / `Escape` over content | `shrinking` | same | Dismissal |
| S4 | `hashchange` to a content route from centre | `shrinking` | changes | **Navigation** (back/forward, deep link) |
| E1 | Dock button pressed | `expanding` | same | Opening the nav |
| E2 | `hashchange` to `#/` while docked | `expanding` | changes | **Navigation** (back to landing) |

| Option | Spins | Trade-off |
| --- | --- | --- |
| **A — navigations only** | S1, S4, E2 | Reads the spin as the page-change signature. A dismissal is the viewer saying *never mind*; a flourish rewards a cancel. Opening the nav is a reveal — the cube should come up as the object the viewer left, not perform. **The predicate already exists**: it is `fromRoute !== toRoute`, the same fact `contentFade` keys on. |
| **B — every transition** (selected) | all six | One rule, no exceptions to hold in your head. It deliberately puts a full revolution on `Escape` and on every dock-button opening. |
| **C — shrinking only** | S1–S4 | Matches the review's literal wording. But it splits on the phase rather than on meaning, so a dismissal spins and a back-button navigation does not — the opposite of the distinction that matters. |

**Decision: B.** Product review preferred consistent motion on every trip over using spin as
a page-change-only signature. The pure helper therefore needs no route or phase inputs.

**Consequence of the mirror:** `expanding` runs `dockState(1 - p)`, so E1 and E2 spin
**backwards** — one full turn unwinding. Making them spin forward instead needs a signed
`spinRevolutions`, a direction snapshot in `src/main.js`, and it forfeits the exact-mirror
property that `src/dock.js:24-27` is built on. **Take the mirror.**

This decision fixes the helper signature to `dockSpin(reduced, revolutions)`: routes and
phases are irrelevant because every transition receives the same answer.

## 9. Implementation notes

| File | Change |
| --- | --- |
| `src/config.js` | Add `spinRevolutions: 1` to `DOCK`, with the §5 ceiling (1.675 at 0.9 s) and its coupling to `duration` in the comment. |
| `src/easing.js` | Add quintic `smootherStep`, with zero velocity and acceleration at both endpoints. |
| `src/dock.js` | `dockState` reads `opts.spinRevolutions` (default `0`) and moves yaw onto `smootherStep`. Add pure `dockSpin(reduced, revolutions)`. Rewrite the `yawSnapDelta` header comment. |
| `src/main.js` | Snapshot `transitionSpin` alongside `transitionYaw` at `:219`; pass it into `dockState` at `:313`; extend the fold at `:238` (below). No other change — the phase machine, the fade, and the tap plumbing are all untouched. |
| `tests/dock.test.js` | New cases (§10). Every existing case keeps passing unchanged — verified, see below. |
| `AGENTS.md` | Replace the obsolete snap-only dock decision, and record why the spin is whole-revolution and why the curve differs from the travel's. |
| `README.md` | The "Design direction" paragraph describes the cube holding its pose; add the dock spin to the navigation paragraph. |

**The helper stays out of `src/main.js`.** `src/main.js` and `src/input.js` are the only
files the suite does not cover, by policy. Choosing the revolution count is a real decision
with a real predicate, so it belongs in `src/dock.js` next to `contentFade`, which answers
the same question about the same two routes:

```js
export function dockSpin(fromRoute, toRoute, reduced, revolutions) {
  if (reduced || fromRoute === toRoute) return 0;
  return revolutions;
}
```

`reduced` and `revolutions` are passed in rather than imported, matching how
`fadeOpacity` takes `contentFadeStart` — `src/dock.js` imports no config today and should
not start.

**The `yawOffset` fold.** `src/main.js:238` becomes:

```js
yawOffset += yawSnapDelta(transitionYaw, SETTLE.yaw) + TAU * transitionSpin;
```

Leaving it as-is is *visually* identical — `TAU * N` is a multiple of the 90° symmetry, so
the docked cube is drawn the same either way. But the comment above that line commits to
`lastYaw` agreeing with the drawn pose, and without the extra term it disagrees by exactly
one turn. Fold it. `yawOffset` then grows by 2π per navigation; at 1000 navigations that is
6283 rad, where float64 resolves to ~1e-12 rad. The entrance's yaw already starts at a large
unreduced negative angle on the same reasoning (`src/animation.js:44-47`).

**Nothing is needed at the end of `expanding`.** It lands on `dockState(0).yaw`, which is
`transitionYaw` exactly — already what `rotation.yaw + dragYaw + yawOffset` evaluates to.

## 10. Test plan

Plain Node, no browser, no WebGL — same as the existing suite. Measured values from the
verification run are given so the plan can assert against them.

**No existing test breaks.** All six `dockState` and all four `yawSnapDelta` cases in
`tests/dock.test.js` were re-run against the proposed implementation and pass unchanged:
`opts.spinRevolutions` defaults to `0`, and no existing case samples the yaw mid-transition
with a non-zero snap delta, so moving the snap from `easeInOutCubic` to `smootherStep` is not
observable to them. The change is additive at the unit level; the behavior change comes from
`src/main.js` passing a non-zero count.

New cases:

1. **The landing pose is untouched.** For `N` in `{0, 1, 2}` and start yaws swept over
   ±720°, `(dockState(1).yaw - SETTLE.yaw) / (PI/2)` is a whole number. Measured worst
   deviation: 1.8e-15.
2. **The spin is exactly whole turns.** `dockState(1, {...opts, spinRevolutions: 1}).yaw`
   minus the `spinRevolutions: 0` result is `TAU`, to 1e-12.
3. **The mirror survives the spin.** `yaw(p) + yaw(1-p) === 2*opts.yaw + turn` for `N` in
   `{0, 1, 2}` across 200 samples. Measured worst error: 3.6e-15. Keep the existing y/scale
   mirror case alongside it.
4. **The yaw is monotonic.** For `N >= 1` from start yaws at −45°, 0°, and +45° off settle,
   `yaw` never decreases across 1000 samples — the spin always dominates the snap.
5. **The strobing ceiling.** Worst case (`N = 1`, +45° snap), sampled at 1/1000: peak
   `|dyaw/dt|` is 843.75 °/s, and `peak / 30` is under 45 °/frame. Assert the bound, not
   just the value, so a later `duration` cut fails here rather than on someone's phone.
6. **Position and scale are not on the new curve.** For every `p` in 0…1 step 0.01,
   `dockState(p, {...opts, spinRevolutions: 1}).y` and `.scale` equal the
   `spinRevolutions: 0` results exactly. This is the guard against the whole change
   leaking into the travel.
7. **`dockSpin`.** Returns 0 when `reduced` is true and `revolutions` otherwise. Routes and
   phases are absent under Option B because every transition spins.
8. **Reduced motion is bounded.** `dockSpin(true, DOCK.spinRevolutions) === 0`, and a note in
   the test names 210.9 °/frame as what it prevents.
9. **The softer endpoint is real.** `smootherStep` maps and clamps `[0, 1]`, stays monotonic
   and symmetric, and has zero finite-difference velocity and acceleration at both ends.

## 11. What to watch on the live page

Three things this spec cannot settle from arithmetic:

- **The armed face flickers past.** The tapped face stays lightened for the whole shrink and
  is cleared at the end (`src/main.js:239`). Under the spin it leaves the front early:
  the cube passes 22.5° of yaw at **t = 0.177 s** and 45° at **t = 0.231 s**. That is
  probably enough for the highlight to have done its confirming job — `smootherStep` is at
  its slowest exactly there — but if it reads as a flicker rather than a confirmation, the
  fix is one line: clear the armed face when the transition starts instead of when it ends.
- **Whether one revolution reads as enough.** If not, 2 is available but leaves only 5.6%
  of strobing headroom (§5) — prefer lengthening `DOCK.duration`, which buys headroom
  instead of spending it, against the 1.2 s "navigation feels gated" bound already recorded
  in `src/config.js:83-86`.
- **The backwards unwind on E2** (§8), if option A or B is taken.

## 12. Non-goals

- No pitch tumble during the transition — see §4.
- No change to `DOCK.duration`, `reducedDuration`, the dock geometry, `contentFadeStart`,
  or the content fade curves.
- No change to the position and scale curves, which stay on `easeInOutCubic`.
- No change to the entrance, the idle float, the drag model, the resting pose, routing, the
  phase machine, colors, or materials.
- No change to `docked -> docked` or `resting -> resting`, which play no transition at all.
- No new routes, pages, content, or 3D objects.

## 13. Acceptance criteria

- [ ] Tapping a face turns the cube a full revolution as it travels to the dock, in the
      same direction as the entrance, arriving at a standstill.
- [ ] The docked cube's pose and drawn size are indistinguishable from today's, from any
      start yaw.
- [ ] The transition never exceeds 45° of yaw per frame at 30 fps — 28.125° worst case.
- [ ] Under `prefers-reduced-motion` the transition is exactly today's snap-only behavior.
- [ ] The §8 decision is implemented, and each of the six rows behaves as its table says.
- [ ] Reopening the nav still returns the cube to centre on the pose it docked at, with no
      visible jump on either phase change.
- [ ] `npm test` passes, including the §10 cases and all 209 existing tests.
- [ ] `npm run build` succeeds.
