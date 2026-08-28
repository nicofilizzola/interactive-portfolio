# Interactive 3D Portfolio

Minimal, geometric landing page: a single cube enters from off-screen top, grows and slows
into the center over 3.5 seconds, then floats there forever with a gentle spin and a subtle
pointer-follow tilt.

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

- `src/config.js` — every tunable number (timing, sizes, colors, parallax limits). Start here.
- `src/math.js`, `src/easing.js` — numeric helpers.
- `src/animation.js` — the entrance as one pure function of elapsed time.
- `src/camera.js` — framing math: camera distance per aspect ratio, entrance start height.
- `src/cube.js` — the cube: gray flat-shaded faces, thin blue edge outline.
- `src/scene.js` — scene, camera, lights, and viewport fitting.
- `src/parallax.js` — damped pointer offset and tilt.
- `src/main.js` — renderer, DOM events, animation loop. The only browser-coupled file.

Everything except `main.js` is unit-tested in plain Node (no browser, no WebGL); the
renderer is deliberately kept out of `scene.js` to keep it that way.

## Design direction

Very minimal and geometric. Light gray is the primary color; blue appears only as the
cube's edge outline. Deployment is not set up yet — `npm run build` produces a static
`dist/` that can be hosted anywhere.
