# Interactive 3D Portfolio

Interactive 3D portfolio site. Built with Three.js.

## Design Direction

- **Style:** very minimal, geometric.
- **Primary color:** light gray.
- **Accent color:** blue — use sparingly. Stay minimal. (Currently unused: the cube's edge
  outline was blue's only appearance and it is gone. Page is fully achromatic.)

## Current Scope

One landing page plus five content routes, all served from one document by hash routing. The
content is differentiated lorem ipsum, not real writing.

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
   smooth and start before entrance finish, so no dead beat and no motion switch on. While
   resting, all horizontal rotation come from viewer drag; dock transitions add the only
   automatic post-entrance yaw.
5. Viewer drag horizontal to spin cube. Release throw it, cube coast to stop.
6. Tap a cube face to go to that face's section. Cube shrink and travel to bottom middle of
   screen in one continuous move while page arrive. Five face have route; bottom face never
   reachable, so it get none.
7. Docked cube is nav button. Press it, big cube come back up over current page behind scrim.
   Pick face to go somewhere else, or Esc or tap background to close. Closing is not
   navigation and leave no history entry.
8. After the initial entrance finishes, one large DOM heading, `Welcome`, reveals above the
   cube with a 750 ms masked upward fade, then remains visible and motionless. It is not a 3D
   object and never tracks the cube's float. It fades out when navigation begins, stays hidden
   over content and the nav overlay, and returns without replaying its reveal.

## Tech Stack

- **Three.js** for all 3D render + animation.

## Out of Scope (for now)

- Real content. The five sections ship as differentiated lorem ipsum.
- A sixth section, or any route on the cube's bottom face — it cannot be reached.
- Any 3D object other than the cube. No per-page 3D, no face textures or labels.
- Additional visible landing copy, visible nav text, breadcrumbs, or a menu. The hidden `<nav>` is an accessibility
  affordance, not a design element.
- Page transitions beyond the cube move and a content fade — no slides, no shared-element
  animation between the cube and the page.
- Deployment. Scope ends at a working dev server and a static production build.

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
  the cube holds it indefinitely while resting — edge-on is now where it stays, not a moment
  it passes through. This supersedes the 2026-08-28 spec's section-7 option A ("land and
  drift") and its 0.035 rev/s idle drift. The only autonomous motion while resting is the
  vertical float; dock transitions have their own finite yaw spin.
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
- **Cube look:** matte light-gray flat-shaded faces (`#d6d8dc`) — one `Mesh`, one
  `BoxGeometry`, no edge outline, no wrapping `Group`, no `polygonOffset`. The mesh carries a
  **six-material array**, one per `BoxGeometry` group, so a single face can be lightened to
  `#e4e6ea` when it is the armed nav target. Still one mesh and one draw call per group; flat
  shading still carries the whole form. The array is required rather than cosmetic — see *the
  resting pose puts a route boundary at screen centre* below.
- **Cube size is `FIT_MARGIN`, not `CUBE_SIZE`.** The camera distance is derived from
  `CUBE_RADIUS * FIT_MARGIN`, so the camera pulls back in exact proportion to any change in
  `CUBE_SIZE` and the projected size is invariant — changing `CUBE_SIZE` produces a
  pixel-identical page. `FIT_MARGIN` is the multiple of the cube's bounding-sphere radius
  the camera frames, so it reads directly as "how much room around the cube". Set to 1.6:
  the edge-on silhouette spans 51% of the smaller viewport dimension (it was 60.5% at 1.35).
  Raising it also raises `entranceStartY`, which lowers the `startSpin` strobing ceiling —
  re-measure that before changing it.
- **Page:** off-white background (`#f7f7f8`). The landing page has exactly one visible DOM
  heading, `Welcome`, above the cube. No other visible landing copy, nav text, breadcrumbs, or
  menu is present. The document still carries a `<nav>` of five links, visually hidden with
  `clip-path` but focusable and placed first so it doubles as skip navigation. Content routes
  are ordinary scrolling DOM under a fixed canvas.
- **Typography:** Geist Sans is the site-wide primary typeface, self-hosted as the official
  variable WOFF2 under the SIL Open Font License. Body copy remains weight 400, content
  headings remain 500, and the landing `Welcome` uses 450. The existing system stack is a
  loading/error fallback only; the site makes no font-CDN request.
- **Reduced motion:** `prefers-reduced-motion` is honored **for the dock transitions only**,
  clamped to `DOCK.reducedDuration` 0.12 s. Motion there gates *navigation* rather than
  decoration — unclamped, a motion-sensitive viewer waits 0.9 s of animation to reach a page,
  twice per round trip. The entrance's 3.5 s is still intentionally not honored.
- **Deployment:** not set up. Scope ends at a working dev server and a static production build.
- **Routing:** hash-based (`#/work`), not the History API. Deployment is not set up, and the
  History API would make correct production behavior depend on a host rewrite rule that does
  not exist — a deep link to `/work` on a static host 404s. Hash routing works identically on
  the Vite dev server, `npm run preview`, and any static host, with zero configuration. Every
  route string lives in `src/routes.js`, so switching later is a one-file change.
- **The site is a single-page app, and the canvas is a persistent fixed layer.** A real
  document navigation destroys and recreates the WebGL context, so the cube would restart its
  entrance on every route change instead of animating into the dock. The canvas stays
  full-viewport in every phase — that is what lets the cube travel from centre to the bottom
  edge in one continuous motion — so its `pointer-events` are off except while the big cube is
  up, and the docked cube's control is a separate `<button>` rather than a hit test through the
  canvas.
- **The bottom face is unreachable, so it gets no route.** The resting pitch is a fixed +15°
  and three's Euler order is `XYZ`, so yaw is applied before pitch and leaves the ±Y normals
  invariant: sweeping all 360° of yaw, −Y is back-facing at every one of them, and +Y is
  front-facing at every one. There are **five** pickable faces, not six, and the top face —
  always visible, yaw-invariant — holds the primary section. `tests/facepick.test.js` proves
  both halves.
- **`face.materialIndex` requires a material array.** `Mesh.raycast` only walks
  `geometry.groups` when `material` is an array, so with a single material
  `intersection.face.materialIndex` is `0` for **every** hit — a face map keyed on it would
  silently route every face to the same page, which looks like working code. `src/routes.js`
  keys on `intersection.face.normal`, which is exactly one of the six axis unit vectors either
  way.
- **The resting pose puts a route boundary at screen centre**, which is why hover and press
  feedback are a requirement and not polish. At 1920×1080, yaw 45°, pitch 15°, a ray at screen
  centre hits the −X face and one pixel to the right hits +Z. The cube's visual centre is the
  most natural place to click, and clicking it is a coin flip between two sections. It cannot
  be fixed by geometry — the edge *is* the resting pose — so the armed face is lightened before
  the viewer commits.
- **The dock is a CSS-pixel size, not a scale factor.** Camera distance varies with aspect
  ratio, so a fixed `scale` draws a different physical size on every device: `ENTRANCE.startScale`
  would draw an 83 px nav button on a desktop and 30 px on a phone. `src/scene.js` derives
  `dockScale` from `DOCK.silhouettePx` 64 (capped at 16% of the smaller viewport dimension,
  which binds below ~400 px) and `dockY` from `DOCK.bottomMarginPx` 24, both re-derived on
  resize. Position and scale run on `easeInOutCubic` over `DOCK.duration` 0.9 s. Every
  shrinking or expanding transition also turns through one whole yaw revolution on quintic
  `smootherStep`, plus the shortest snap to `SETTLE.yaw + k·90°`. Whole revolutions preserve
  the edge-on dock pose and exact 64 px silhouette; `smootherStep` brings angular velocity
  and acceleration to zero at both ends and limits the worst 405° turn to 843.75°/s, or
  28.125° per frame at 30 fps. Expanding is the exact backward mirror. Under
  `prefers-reduced-motion`, the added revolution is removed and only the snap remains.
- **Tap versus drag:** a face click is a *failed* drag, defined negatively on the existing
  pointer plumbing — no `click` listener, since `click` fires after a drag too and its target is
  the canvas. A gesture is a tap iff it stays within `PICK.tapMaxTravelPx` 8 px of the press
  point (straight-line, not path length) for at most `PICK.tapMaxDurationMs` 500 ms, and the
  press cancelled less than `PICK.tapMaxEntrySpeedRevs` 0.05 rev/s of coast — so the first tap
  on a coasting cube stops it and the second navigates.
- **`hashchange` is the single source of truth for the route.** Face taps navigate by setting
  `location.hash`; the resulting `hashchange` drives the state machine. The back button then
  works with no parallel code path. An unknown hash is corrected with `replaceState` so the
  back button cannot bounce, and dismissing the open nav pushes nothing — it is not a
  navigation.
- **A deep link plays no entrance.** A direct load of a content hash starts docked with the
  content already mounted: 3.5 s of theatre in front of requested content is wrong, and there
  is no prior on-screen position to dock from. `#/` and an empty hash still play the entrance.
