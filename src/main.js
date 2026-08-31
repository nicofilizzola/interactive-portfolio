import * as THREE from 'three';
import './style.css';
import {
  DRAG,
  ENTRANCE,
  ENTRANCE_TUMBLE_RATIO,
  FLOAT,
  MAX_FRAME_DELTA,
  MAX_PIXEL_RATIO,
  SETTLE,
} from './config.js';
import { entranceRotation, entranceState, floatOffset } from './animation.js';
import { createDragSpin } from './drag.js';
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
const drag = createDragSpin(DRAG);

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
// Read by the pointerdown handler: a press before the entrance lands would make
// the yaw at t = duration SETTLE.yaw + userYaw, breaking the exact landing.
let entranceDone = false;
let activePointerId = null;

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

// Idempotent: pointerup and the lostpointercapture that follows it both land
// here, and blur calls it with no event at all.
function endDrag(event) {
  if (activePointerId === null) return;
  if (event && event.pointerId !== undefined && event.pointerId !== activePointerId) return;

  const pointerId = activePointerId;
  activePointerId = null;
  // The UA fires lostpointercapture after pointerup, so capture is still
  // held here and this release runs on every drag via pointerup (or blur);
  // by the time lostpointercapture re-enters, it's a documented no-op.
  if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  drag.end();
}

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), MAX_FRAME_DELTA);
  elapsed += dt;

  const state = entranceState(elapsed, { ...ENTRANCE, startY: view.startY });
  entranceDone = state.done;
  // Closed form, not an accumulator: the cube lands on the exact same pose at
  // any frame rate, and both angles freeze dead when the entrance ends.
  const rotation = entranceRotation(elapsed, ROTATION);
  // Once per frame, whatever the pointermove event rate was. The viewport
  // minimum is the dimension the camera fits the cube to, so the gain stays
  // proportional to the cube's apparent size.
  const dragYaw = drag.update(dt, Math.min(window.innerWidth, window.innerHeight));

  view.cube.position.set(0, state.y + floatOffset(elapsed, FLOAT_OPTS), 0);
  view.cube.scale.setScalar(state.scale);
  // rotation.pitch, not SETTLE.pitch: the entrance's vertical tumble runs
  // through it and only lands on SETTLE.pitch at t = duration.
  view.cube.rotation.set(rotation.pitch, rotation.yaw + dragYaw, 0);

  renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}

if (renderer) {
  applyViewportSize();
  window.addEventListener('resize', applyViewportSize);

  canvas.addEventListener('pointerdown', (event) => {
    // Primary pointer, left button only: a right- or middle-button drag
    // should not spin the cube, and a right-drag should still open the
    // browser's context menu.
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    // Ignore presses during the entrance (they would break the exact landing
    // pose) and any second finger while a drag is already running.
    if (!entranceDone || activePointerId !== null) return;
    activePointerId = event.pointerId;
    // Capture is what keeps the drag alive once the pointer leaves the window —
    // browser chrome, a second monitor, another app.
    canvas.setPointerCapture(event.pointerId);
    drag.start(event.clientX);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointerId) return;
    drag.move(event.clientX);
  });

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  // Capture survives a lot, but not the tab losing focus mid-drag.
  window.addEventListener('blur', () => endDrag());

  requestAnimationFrame(frame);
}
