# Interactive 3D Portfolio

Minimal, geometric portfolio. A single cube enters from off-screen top, grows and slows into
the center over 3.5 seconds, then holds its pose while a gentle vertical drift ramps in out of
the arrival. Drag it horizontally to spin it; let go mid-swipe and it coasts to a stop.

The cube is also the navigation. Tap a face and it travels to a bottom-centre dock in one
continuous move while that section's page arrives; press the docked cube and it comes back up
over the page as a nav overlay. Five sections, one per pickable face — the bottom face cannot
be seen at the resting tilt, so it has none. Routing is hash-based, so every deep link works
on a static host with no configuration.

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
  model, the resting pose, the dock, the tap thresholds). Start here.
- `src/math.js`, `src/easing.js` — numeric helpers.
- `src/animation.js` — the entrance as pure functions of elapsed time: position and scale,
  plus the closed-form yaw and pitch that land the cube on its resting pose, plus the idle
  vertical float and its ramp.
- `src/camera.js` — framing math: camera distance per aspect ratio, entrance start height,
  world-units-to-pixels.
- `src/cube.js` — the cube: one flat-shaded gray mesh with six materials, and the armed-face
  control.
- `src/scene.js` — scene, camera, lights, viewport fitting, and the derived dock framing.
- `src/drag.js` — drag-to-spin: viewport-relative gain, smoothed release velocity, coast.
- `src/routes.js` — the route table, the cube-face map, and hash parsing. The only place a
  hash string appears.
- `src/pages.js` — the five sections' content as data, plus a pure HTML string builder.
- `src/navstate.js` — the nav phase machine as `reduce(state, event) -> state`.
- `src/pick.js` — tap-vs-drag discrimination and pointer-to-NDC conversion.
- `src/dock.js` — the dock transition, the yaw snap, and the content fade curves, all as pure
  functions of progress.
- `src/input.js` — the DOM event wiring: pointer, keyboard, hash, and dock-button listeners.
- `src/main.js` — renderer, animation loop, and composition.

Everything except `src/main.js` and `src/input.js` is unit-tested in plain Node (no browser,
no WebGL, no jsdom); the renderer is deliberately kept out of `scene.js` to keep it that way,
and three's math and `Raycaster` run headlessly. `src/main.js` and `src/input.js` are the only
browser-coupled files: the five modules that carry the nav logic — `routes.js`, `pages.js`,
`navstate.js`, `pick.js`, `dock.js` — import neither `three` nor the DOM.

## Design direction

Very minimal and geometric. Light gray is the primary color; the page is currently fully
achromatic — blue is still the nominated accent but nothing on the page uses it. Deployment
is not set up yet — `npm run build` produces a static `dist/` that can be hosted anywhere.

The cube's entrance ends on a fixed pose: a vertical edge facing the viewer, tilted 15 degrees
so the top face shows. From there it holds that pose exactly — nothing rotates on its own. The
only autonomous motion is a gentle vertical bob, which ramps in with a smoothstep envelope and
starts just before the entrance lands, so it emerges from the arrival rather than switching on
after it; every turn of the cube is the viewer's, dragged in by hand.

That resting pose puts the boundary between two sections exactly down the middle of the cube,
so the face under the pointer is lightened to `#e4e6ea` before a click commits. The page is
still fully achromatic — blue remains the nominated accent and nothing uses it. Spending it on
the armed face is the best candidate the project has, and is a deliberate second pass rather
than a default.
