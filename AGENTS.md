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
- **Entrance:** 3.5s slow cinematic ease-out. Position and scale on ease-out cubic; spin speed on ease-out quart (3.0 -> 0.035 rev/s) so the rotation calms just ahead of the arrival.
- **Post-settle interaction:** subtle damped pointer parallax (max 0.22 world-unit offset, max 0.09 rad tilt) layered over the eternal float spin. No scroll interaction.
- **Cube look:** matte light-gray flat-shaded faces (`#d6d8dc`) with a thin blue edge outline (`#2563eb`).
- **Page:** off-white background (`#f7f7f8`), no shadow, no DOM text — canvas only.
- **Reduced motion:** `prefers-reduced-motion` is intentionally not honored for now.
- **Deployment:** not set up. Scope ends at a working dev server and a static production build.