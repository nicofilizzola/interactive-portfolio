# Interactive 3D Portfolio

Interactive 3D portfolio site. Built with Three.js.

## Design Direction

- **Style:** very minimal, geometric.
- **Primary color:** light gray.
- **Accent color:** blue — use sparingly. Stay minimal. (Currently unused: the cube's edge
  outline was blue's only appearance and it is gone. Page is fully achromatic.)

## Current Scope

One landing page. Nothing else yet.

### Landing Page

Page show one 3D cube float on screen. Cube arrive with entrance animation:

| Aspect | Start | End |
| --- | --- | --- |
| Position | off-screen at the top | centered on screen |
| Scale | quite small | larger — reads as "closer" to the viewer |
| Spin speed | fast | stopped — decay curve land on standstill |

Requirements:

1. Cube enter from top of screen, spinning.
2. Rotation ease from fast entrance spin down to complete stop as cube settle in middle.
3. Cube start small, grow through animation — look like it move closer to viewer.
4. After entrance, cube hold pose still and drift gentle up and down forever. Drift ramp in
   smooth and start before entrance finish, so no dead beat and no motion switch on. All
   horizontal rotation come from viewer drag, none automatic.
5. Viewer drag horizontal to spin cube. Release throw it, cube coast to stop.

## Tech Stack

- **Three.js** for all 3D render + animation.

## Out of Scope (for now)

- More pages, routes, nav.
- Project/case-study content, about section, contact form.
- Any 3D object other than landing-page cube.

## Decisions

- **Build tooling:** Vite + npm `three`, plain JavaScript (no TypeScript). `npm run dev`, `npm run build`.
- **Entrance:** 3.5s slow cinematic ease-out. Position and scale on ease-out cubic; spin
  speed on ease-out quart (4.5 -> 0 rev/s) so the rotation calms just ahead of the arrival
  and the cube glides to a genuine standstill (ease-out quart has zero derivative at p = 1,
  so nothing snaps). Total 3.150 revolutions. 4.5 sits under the strobing ceiling with
  headroom: the cube's yaw is 90-degree symmetric, so a faster spin reads as running
  backwards on a 30 fps display. The limit is set by tall viewports, where the cube enters
  frame earlier — measured at `FIT_MARGIN` 1.6 the 30 fps cap is 5.78 in landscape, 5.10 at
  9:16, and 4.90 on a 9:19.5 phone, where 4.5 lands at 41.3 degrees per frame.
- **Resting pose:** the entrance lands on a defined pose — yaw 45 deg, pitch +15 deg,
  roll 0 — so a vertical edge faces the camera with the top face visible. The rotation is
  a closed-form function of elapsed time rather than a per-frame accumulator, so the
  landing is exact and identical at any frame rate. Keep three's default `XYZ` Euler order
  with roll at 0; any other order makes the tilt wobble as the cube turns.
- **Idle rotation:** none. Both angles freeze on the landing pose when the entrance ends and
  the cube holds it indefinitely — edge-on is now where it stays, not a moment it passes
  through. This supersedes the 2026-08-28 spec's section-7 option A ("land and drift") and
  its 0.035 rev/s idle drift. The only autonomous motion left on the page is the vertical
  float.
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
  ~0.5 s dead beat that made the onset read as a second, unrelated event. Measured at 60 fps,
  the quietest frame after `t = 2.5` went from 0.0001 px (dead still, at `t = 3.483`) to
  0.0043 px at the bob's own trough, and the largest frame-to-frame jerk from 0.408 px at
  exactly `t = 3.500` to 0.027 px.
  **Consequence: `floatOffset(3.5)` is `0.0277430`, not 0**, and the cube's `y` at the end of
  the entrance is no longer `ENTRANCE.endY` (`endY` remains the entrance's own target, which
  it still hits exactly). 0.7 s is a ceiling, not taste: through the overlap the entrance
  offset and the float's first upward half-cycle add, and both the entrance offset at the
  onset (`startY * 0.008`, worst 0.0760 at 280x1000) and the float's own first peak (0.0776)
  must stay under `amplitude` 0.08 — 3.0% of headroom at every tested aspect. At 1.0 s the sum
  is 0.0887 and the in-frame bound in `tests/scene.test.js` must be widened; raising
  `FIT_MARGIN` raises `startY` and eats the same headroom. Peak-to-peak travel is 10% of the
  cube's edge length — defined against the cube, not the viewport, so changing `FIT_MARGIN`
  does not change how it reads. **The landing pose is untouched:** it is a claim about yaw and
  pitch, and the float moves neither.
- **Post-settle interaction:** drag horizontally to spin. Gain is 1.0 revolution per
  `min(innerWidth, innerHeight)` of drag — normalized against the same dimension the camera
  fits the cube to, so the felt sensitivity is identical on a phone and a desktop. Release
  throws the cube onto an exponential coast with `releaseTau` 0.5 s (so the coast angle is
  exactly `velocity * 0.5`); the release velocity is a `velocityTau` 0.06 s smoothed
  estimate, so a drag that pauses before the release does not throw; and the thrown velocity
  is capped at 2.5 rev/s, which is 30 degrees per frame at 30 fps. Presses during the
  entrance are ignored, so the landing pose stays exact. No vertical drag, no scroll
  interaction, no snap-back.
- **Cube look:** matte light-gray flat-shaded faces (`#d6d8dc`), nothing else — one bare
  `Mesh`, no edge outline, no wrapping `Group`, no `polygonOffset`. Flat shading carries the
  whole form: the silhouette plus the three tonal steps between visible faces.
- **Cube size is `FIT_MARGIN`, not `CUBE_SIZE`.** The camera distance is derived from
  `CUBE_RADIUS * FIT_MARGIN`, so the camera pulls back in exact proportion to any change in
  `CUBE_SIZE` and the projected size is invariant — changing `CUBE_SIZE` produces a
  pixel-identical page. `FIT_MARGIN` is the multiple of the cube's bounding-sphere radius
  the camera frames, so it reads directly as "how much room around the cube". Set to 1.6:
  the edge-on silhouette spans 51% of the smaller viewport dimension (it was 60.5% at 1.35).
  Raising it also raises `entranceStartY`, which lowers the `startSpin` strobing ceiling —
  re-measure that before changing it.
- **Page:** off-white background (`#f7f7f8`), no shadow, no DOM text — canvas only.
- **Reduced motion:** `prefers-reduced-motion` is intentionally not honored for now.
- **Deployment:** not set up. Scope ends at a working dev server and a static production build.