# Interactive 3D Portfolio

Minimal, geometric landing page: a single cube enters from off-screen top, grows and slows
into the center over 3.5 seconds, then holds its pose while a gentle vertical drift ramps in
out of the arrival and continues forever.
Drag it horizontally to spin it; let go mid-swipe and it coasts to a stop.

## Prerequisites

Node `^20.19.0 || >=22.12.0` (the floor comes from Vite 8). Check with `node --version`.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies. |
| `npm run dev` | Start the Vite dev server with hot reload. |
| `npm run build` | Build the static site into `dist/`. |
| `npm run preview` | Serve the built `dist/` locally. |
| `npm test` | Run the unit tests once. |
| `npm run test:watch` | Run the unit tests in watch mode. |

## Layout

- `src/config.js` — every tunable number (timing, sizes, colors, the idle float, the drag
  model, the resting pose). Start here.
- `src/math.js`, `src/easing.js` — numeric helpers.
- `src/animation.js` — the entrance as pure functions of elapsed time: position and scale,
  plus the closed-form yaw and pitch that land the cube on its resting pose, plus the idle
  vertical float.
- `src/camera.js` — framing math: camera distance per aspect ratio, entrance start height.
- `src/cube.js` — the cube: one bare gray flat-shaded mesh, no outline.
- `src/scene.js` — scene, camera, lights, and viewport fitting.
- `src/drag.js` — drag-to-spin: viewport-relative gain, smoothed release velocity, coast.
- `src/main.js` — renderer, DOM events, animation loop. The only browser-coupled file.

Everything except `main.js` is unit-tested in plain Node (no browser, no WebGL); the
renderer is deliberately kept out of `scene.js` to keep it that way.

## Design direction

Very minimal and geometric. Light gray is the primary color; the page is currently fully
achromatic — blue is still the nominated accent but nothing on the page uses it. Deployment
is not set up yet — `npm run build` produces a static `dist/` that can be hosted anywhere.

The cube's entrance ends on a fixed pose: a vertical edge facing the viewer, tilted 15
degrees so the top face shows. From there it holds that pose exactly — nothing rotates on
its own. The only autonomous motion is a gentle vertical bob, which ramps in with a
smoothstep envelope and starts just before the entrance lands, so it emerges from the arrival
rather than switching on after it; every turn of the cube is the viewer's, dragged in by hand.
