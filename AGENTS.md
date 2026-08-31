# Interactive 3D Portfolio

Interactive 3D portfolio site. Built with Three.js.

## Design Direction

- **Style:** very minimal, geometric.
- **Primary color:** light gray.
- **Accent color:** blue — use sparingly. Stay minimal.

## Current Scope

One landing page. Nothing else yet.

### Landing Page

Page show one 3D cube float on screen. Cube arrive with entrance animation:

| Aspect | Start | End |
| --- | --- | --- |
| Position | off-screen at the top | centered on screen |
| Scale | quite small | larger — reads as "closer" to the viewer |
| Spin speed | fast | much slower, gentle floating spin |

Requirements:

1. Cube enter from top of screen, spinning.
2. Rotation ease from fast entrance spin down to slow continuous float spin once cube settle in middle.
3. Cube start small, grow through animation — look like it move closer to viewer.
4. Slow float spin go forever after entrance done.

## Tech Stack

- **Three.js** for all 3D render + animation.

## Out of Scope (for now)

- More pages, routes, nav.
- Project/case-study content, about section, contact form.
- Any 3D object other than landing-page cube.

## Decisions (resolved 2026-08-28)

- **Build tooling:** Vite + npm `three`, plain JavaScript (no TypeScript). `npm run dev`, `npm run build`.
- **Entrance:** 3.5s slow cinematic ease-out. Position and scale on ease-out cubic; spin
  speed on ease-out quart (5.0 -> 0.035 rev/s) so the rotation calms just ahead of the
  arrival. 5.0 sits at the ceiling on the start speed rather than comfortably under it:
  the cube's yaw is 90-degree symmetric, so a faster spin reads as running backwards on a
  30 fps display. The limit is set by tall viewports, where the cube enters frame earlier
  — about 6.0 rev/s in landscape but only ~5.1 on a 9:19.5 phone.
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
- **Post-settle interaction:** subtle damped pointer parallax (max 0.22 world-unit offset, max 0.09 rad tilt) layered over the eternal float spin. No scroll interaction.
- **Cube look:** matte light-gray flat-shaded faces (`#d6d8dc`) with a thin blue edge outline (`#2563eb`).
- **Page:** off-white background (`#f7f7f8`), no shadow, no DOM text — canvas only.
- **Reduced motion:** `prefers-reduced-motion` is intentionally not honored for now.
- **Deployment:** not set up. Scope ends at a working dev server and a static production build.