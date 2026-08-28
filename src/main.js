import * as THREE from 'three';
import './style.css';
import {
  ENTRANCE,
  MAX_FRAME_DELTA,
  MAX_PIXEL_RATIO,
  PARALLAX,
  SPIN_TILT_RATIO,
} from './config.js';
import { entranceState } from './animation.js';
import { createParallax } from './parallax.js';
import { createScene } from './scene.js';

// A blank off-white page is the intended degradation when WebGL is unavailable
// (blocklisted driver, exhausted contexts, hardened browser) — the spec allows no
// DOM fallback text. Reaching it via an uncaught throw is not intended, so fail
// quietly instead. three registers its own context-lost/restored handlers.
const canvas = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (error) {
  console.error('[landing-cube] WebGL unavailable, leaving the page blank:', error);
}

// `view` is kept whole rather than destructured: view.startY is a getter that
// resize() updates.
const view = createScene(window.innerWidth, window.innerHeight);
const parallax = createParallax(PARALLAX);
const timer = new THREE.Timer();

let elapsed = 0;
let spinAngle = 0;

function applyViewportSize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  // updateStyle is deliberately left ON: three then writes inline px matching the
  // drawing buffer, so the CSS box, the buffer, and the camera aspect agree by
  // construction. Passing `false` here would leave style.css's 100vw/100vh
  // authoritative, and on iOS/Android 100vh is the large (toolbars-hidden)
  // viewport while innerHeight is the visible one — which stretches the cube.
  renderer.setSize(width, height);
  view.resize(width, height);
}

// Without these the cube keeps a leftover lean forever once the pointer leaves the
// window (second monitor, browser chrome, another app), and on touch a single drag
// offsets it permanently — a touch pointermove never returns to centre. The damping
// makes the ease-back free.
function recentrePointer() {
  parallax.setPointer(0, 0);
}

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), MAX_FRAME_DELTA);
  elapsed += dt;

  const state = entranceState(elapsed, { ...ENTRANCE, startY: view.startY });
  spinAngle += state.spinSpeed * Math.PI * 2 * dt;

  const pointer = parallax.update(dt);
  const pointerWeight = state.progress;

  view.cube.position.set(
    pointer.offsetX * pointerWeight,
    state.y + pointer.offsetY * pointerWeight,
    0
  );
  view.cube.scale.setScalar(state.scale);
  view.cube.rotation.set(
    spinAngle * SPIN_TILT_RATIO + pointer.tiltX * pointerWeight,
    spinAngle + pointer.tiltY * pointerWeight,
    0
  );

  renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}

if (renderer) {
  applyViewportSize();
  window.addEventListener('resize', applyViewportSize);

  window.addEventListener('pointermove', (event) => {
    parallax.setPointer(
      (event.clientX / window.innerWidth) * 2 - 1,
      (event.clientY / window.innerHeight) * 2 - 1
    );
  });

  // pointerleave has bubbles: false, so a default-phase listener on window is never
  // reached. Capture puts window first in the propagation path, so this fires whatever
  // node the browser targets when the pointer exits. (Verified on the live page: only
  // window-with-capture and the target element itself receive it — document in bubble
  // phase does not.) The canvas fills the viewport, so leaving it means leaving the
  // window; if a smaller element is ever added, this would also recentre on leaving it.
  window.addEventListener('pointerleave', recentrePointer, true);
  window.addEventListener('pointercancel', recentrePointer);
  window.addEventListener('pointerup', recentrePointer);
  window.addEventListener('blur', recentrePointer);

  requestAnimationFrame(frame);
}
