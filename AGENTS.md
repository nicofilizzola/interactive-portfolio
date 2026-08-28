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

## Open Questions

- Build tooling / dev server (Vite, plain static, framework?) — not decided.
- Exact entrance animation duration + easing curve.
- Does cube react to pointer or scroll after settle?