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

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

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
  renderer.setSize(width, height, false);
  view.resize(width, height);
}

applyViewportSize();
window.addEventListener('resize', applyViewportSize);

window.addEventListener('pointermove', (event) => {
  parallax.setPointer(
    (event.clientX / window.innerWidth) * 2 - 1,
    (event.clientY / window.innerHeight) * 2 - 1
  );
});

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

requestAnimationFrame(frame);
