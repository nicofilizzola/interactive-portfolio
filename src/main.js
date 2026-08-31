import * as THREE from 'three';
import './style.css';
import {
  ENTRANCE,
  ENTRANCE_TUMBLE_RATIO,
  FLOAT,
  MAX_FRAME_DELTA,
  MAX_PIXEL_RATIO,
  SETTLE,
} from './config.js';
import { entranceRotation, entranceState, floatOffset } from './animation.js';
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
const timer = new THREE.Timer();

// Assembled once: entranceRotation needs the entrance timing and the target
// pose together, and neither changes at runtime.
const ROTATION = {
  duration: ENTRANCE.duration,
  startSpin: ENTRANCE.startSpin,
  endSpin: ENTRANCE.endSpin,
  settleYaw: SETTLE.yaw,
  settlePitch: SETTLE.pitch,
  tumbleRatio: ENTRANCE_TUMBLE_RATIO,
};

// FLOAT carries the bob's shape; the phase is anchored to the end of the
// entrance, so floatOffset needs the entrance duration alongside it.
const FLOAT_OPTS = { ...FLOAT, duration: ENTRANCE.duration };

let elapsed = 0;

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

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), MAX_FRAME_DELTA);
  elapsed += dt;

  const state = entranceState(elapsed, { ...ENTRANCE, startY: view.startY });
  // Closed form, not an accumulator: the cube lands on the exact same pose at
  // any frame rate, and both angles freeze dead when the entrance ends.
  const rotation = entranceRotation(elapsed, ROTATION);

  view.cube.position.set(0, state.y + floatOffset(elapsed, FLOAT_OPTS), 0);
  view.cube.scale.setScalar(state.scale);
  // rotation.pitch, not SETTLE.pitch: the entrance's vertical tumble runs
  // through it and only lands on SETTLE.pitch at t = duration.
  view.cube.rotation.set(rotation.pitch, rotation.yaw, 0);

  renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}

if (renderer) {
  applyViewportSize();
  window.addEventListener('resize', applyViewportSize);

  requestAnimationFrame(frame);
}
