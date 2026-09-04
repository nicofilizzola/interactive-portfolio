import * as THREE from 'three';
import './style.css';
import {
  DOCK,
  DRAG,
  ENTRANCE,
  ENTRANCE_TUMBLE_RATIO,
  FLOAT,
  MAX_FRAME_DELTA,
  MAX_PIXEL_RATIO,
  PICK,
  SETTLE,
} from './config.js';
import { entranceRotation, entranceState, floatOffset } from './animation.js';
import { createDragSpin } from './drag.js';
import { createScene } from './scene.js';
import { contentFade, dockSpin, dockState, fadeOpacity, yawSnapDelta } from './dock.js';
import { clamp01 } from './math.js';
import { initialState, reduce } from './navstate.js';
import { createTapTracker, pointerToNdc } from './pick.js';
import {
  faceIndexFromNormal,
  hashForRoute,
  parseHash,
  routeForFaceIndex,
  titleForRoute,
} from './routes.js';
import { renderPage } from './pages.js';
import { createInput } from './input.js';
import {
  completeWelcomeAnimation,
  initialWelcomeState,
  reduceWelcome,
} from './welcome.js';
import { centeredComposition, compositionGapPx } from './composition.js';

const TAU = Math.PI * 2;

// A blank off-white page is the intended degradation when WebGL is unavailable
// (blocklisted driver, exhausted contexts, hardened browser). Reaching it via an
// uncaught throw is not intended, so fail quietly instead. three registers its
// own context-lost/restored handlers.
const root = document.documentElement;
const canvas = document.getElementById('scene');
const page = document.getElementById('page');
const scrim = document.getElementById('scrim');
const dockButton = document.getElementById('dock');
const welcomeHeading = document.getElementById('welcome');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (error) {
  console.error('[landing-cube] WebGL unavailable, leaving the page blank:', error);
}

// `view` is kept whole rather than destructured: startY, dockY, dockScale, and
// dockSilhouettePx are getters that resize() updates.
const view = createScene(window.innerWidth, window.innerHeight);
const timer = new THREE.Timer();
const drag = createDragSpin(DRAG);
const tap = createTapTracker(PICK);
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

// Assembled once: entranceRotation needs the entrance timing and the target pose
// together, and neither changes at runtime.
const ROTATION = {
  duration: ENTRANCE.duration,
  startSpin: ENTRANCE.startSpin,
  endSpin: ENTRANCE.endSpin,
  settleYaw: SETTLE.yaw,
  settlePitch: SETTLE.pitch,
  tumbleRatio: ENTRANCE_TUMBLE_RATIO,
};

// FLOAT carries the bob's shape and its ramp; the phase is anchored to the end of
// the entrance, so floatOffset needs the entrance duration alongside it.
const FLOAT_OPTS = { ...FLOAT, duration: ENTRANCE.duration };

// An unknown hash is corrected before the machine ever sees one, and with
// replaceState rather than a push so the back button cannot bounce between the
// bad hash and its correction. replaceState fires no hashchange, so nothing
// downstream needs to know this happened.
const boot = parseHash(window.location.hash);
if (!boot.known) window.history.replaceState(null, '', hashForRoute(boot.route));

// A deep link, a refresh, or a shared URL lands docked with content already
// mounted and plays no entrance. `elapsed` is pushed past the float's ramp so the
// bob is at its steady state rather than starting from zero under a page that is
// already up.
let elapsed = boot.route === null ? 0 : ENTRANCE.duration + FLOAT.rampDuration;
let nav = initialState(boot.route, elapsed);
let welcomeState = initialWelcomeState(boot.route);

// The cube's total yaw as drawn on the last frame. Read when a dock transition
// starts, so it interpolates from where the viewer actually left the cube.
let lastYaw = SETTLE.yaw;
// Yaw folded in by dock transitions (the snap to the nearest resting pose). Kept
// here rather than inside src/drag.js so the drag model stays a pure accumulator
// with no notion of the nav.
let yawOffset = 0;
// Which content fade the transition in flight needs. See src/dock.js contentFade.
let fadeMode = 'hold';
// The cube's total yaw when the transition in flight began. A snapshot, not a
// live read: a coasting drag must not move the target mid-flight.
let transitionYaw = SETTLE.yaw;
// Whole revolutions selected when the current dock transition began. Snapshot
// once so a live reduced-motion preference change cannot alter a turn mid-flight.
let transitionSpin = 0;
// Has the cross-fade's DOM swap happened yet for the transition in flight?
let swapped = false;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function dockDuration() {
  // Motion now gates NAVIGATION rather than decoration: without this clamp a
  // motion-sensitive viewer waits 0.9 s of animation to reach a page, twice per
  // round trip. The entrance's recorded stance (not honored) is left alone.
  return reducedMotion.matches ? DOCK.reducedDuration : DOCK.duration;
}

function applyWelcomeComposition(width, height) {
  const headingHeight = welcomeHeading.getBoundingClientRect().height;
  const rootFontPx = Number.parseFloat(getComputedStyle(root).fontSize);
  const gap = compositionGapPx(width, height, rootFontPx);
  const layout = centeredComposition({
    viewportHeight: height,
    headingHeight,
    gap,
    zeroBounds: view.projectCubeBounds({ y: 0 }),
    unitBounds: view.projectCubeBounds({ y: 1 }),
  });

  view.setLandingY(layout.landingY);
  welcomeHeading.style.top = `${layout.headingTopPx}px`;
}

function applyViewportSize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  // updateStyle is deliberately left ON: three then writes inline px matching the
  // drawing buffer, so the CSS box, the buffer, and the camera aspect agree by
  // construction. Passing `false` here would leave style.css authoritative, and
  // on iOS/Android 100vh is the large (toolbars-hidden) viewport while
  // innerHeight is the visible one — which stretches the cube.
  renderer.setSize(width, height);
  view.resize(width, height);
  applyWelcomeComposition(width, height);
  applyDockButtonBox();
}

// The drawn silhouette can be under the 44 px tap-target floor on a phone (62 px
// at 390 px wide, and smaller on anything narrower), so the button is sized to
// the larger of the two and re-centred over where the cube is actually drawn.
function applyDockButtonBox() {
  const silhouette = view.dockSilhouettePx;
  const size = Math.max(44, silhouette);
  dockButton.style.width = `${size}px`;
  dockButton.style.height = `${size}px`;
  dockButton.style.bottom = `${Math.max(0, DOCK.bottomMarginPx - (size - silhouette) / 2)}px`;
}

function mountContent(route) {
  // Every page is project-authored (src/pages.js), so innerHTML is not a
  // sanitisation question here. It becomes one the moment any of this content
  // comes from outside this repo.
  page.innerHTML = renderPage(route);
  document.title = route === null ? 'Portfolio' : `${titleForRoute(route)} — Portfolio`;
  if (route === null) return;

  // Scroll resets to top on every route change; back/forward restore it, since
  // history.scrollRestoration is left at its default.
  window.scrollTo(0, 0);
  // Standard SPA practice, and cheap: without moving focus a screen-reader user
  // gets no indication that anything happened.
  const heading = page.querySelector('h1');
  if (heading !== null) heading.focus({ preventScroll: true });
}

function applyWelcomeDom() {
  welcomeHeading.dataset.mode = welcomeState.mode;
  const isLandingHeading =
    nav.route === null && (nav.phase === 'entering' || nav.phase === 'resting');
  welcomeHeading.setAttribute('aria-hidden', String(!isLandingHeading));
}

function applyDom() {
  applyWelcomeDom();
  // `overlay` is derived, not stored — it is exactly this. See src/navstate.js.
  const overlay = nav.route !== null && nav.phase === 'resting';
  root.dataset.phase = nav.phase;
  // Only `resting` gets canvas pointer events (style.css), so the full-viewport
  // canvas cannot swallow clicks on the article text underneath.
  root.dataset.scroll =
    nav.phase === 'entering' || nav.phase === 'resting' ? 'locked' : 'free';
  scrim.hidden = !overlay;
  // Removed from the DOM flow entirely when not docked, so it is never a focus
  // stop while the big cube is up.
  dockButton.hidden = nav.phase !== 'docked';
  if (nav.phase !== 'shrinking' && nav.phase !== 'expanding') page.style.opacity = '1';
}

function pickFaceIndex(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const ndc = pointerToNdc(clientX, clientY, rect);
  pointerNdc.set(ndc.x, ndc.y);
  raycaster.setFromCamera(pointerNdc, view.camera);
  // The pick runs outside the render loop, so the world matrix would otherwise be
  // one frame stale.
  view.cube.updateMatrixWorld();

  const hits = raycaster.intersectObject(view.cube, false);
  if (hits.length === 0) return null;
  // The NORMAL, not face.materialIndex: see src/routes.js and
  // tests/facepick.test.js. The normal is correct with or without a material
  // array.
  return faceIndexFromNormal(hits[0].face.normal);
}

function handleTap(clientX, clientY) {
  const faceIndex = pickFaceIndex(clientX, clientY);
  const route = faceIndex === null ? undefined : routeForFaceIndex(faceIndex);
  // A raycast miss is meaningful, not a no-op: it dismisses the open nav. So is a
  // tap on a face with no route — only the unreachable bottom face, handled by
  // the same path rather than special-cased.
  dispatch(route === undefined ? { type: 'missTap' } : { type: 'faceTap', route });
}

function dispatch(event) {
  const previous = nav;
  nav = reduce(nav, { ...event, at: elapsed });

  if (nav.navigate !== null) {
    const target = nav.navigate;
    nav = { ...nav, navigate: null };
    // hashchange is the single source of truth for `route`: set the hash and let
    // the event it fires drive the machine. That is what makes the back button
    // work without a parallel code path.
    window.location.hash = hashForRoute(target);
    return;
  }

  if (nav === previous) return;
  onNavChange(previous, nav);
}

function onNavChange(previous, next) {
  welcomeState = reduceWelcome(welcomeState, previous, next);
  const startedTransition =
    (next.phase === 'shrinking' || next.phase === 'expanding') && previous.phase !== next.phase;
  const endedTransition =
    (previous.phase === 'shrinking' || previous.phase === 'expanding') &&
    previous.phase !== next.phase;

  if (startedTransition) {
    transitionYaw = lastYaw;
    transitionSpin = dockSpin(reducedMotion.matches, DOCK.spinRevolutions);
    swapped = false;
    // Esc, the dock button, and the back button all start a transition with no
    // pointer press, so none of them went through drag.start(). Stop any coast
    // now, or the drag yaw keeps advancing while the transition's own yaw
    // snapshot stays fixed, and the docked pose jumps at the end.
    drag.brake();
    fadeMode = contentFade(previous.route, next.route);
    // 'in' mounts now and fades up. 'cross' holds the outgoing page until the
    // midpoint, where the opacity is exactly 0. 'out' holds it and unmounts when
    // the transition lands. 'hold' never touches the DOM.
    if (fadeMode === 'in') mountContent(next.route);
  }

  if (endedTransition) {
    if (previous.phase === 'shrinking') {
      // Fold the snap and whole turns in ONCE, so lastYaw keeps agreeing
      // numerically with the drawn pose for every later drag and transition.
      // Whole turns look identical but omitting them would leave the two values
      // separated by exactly TAU * transitionSpin.
      yawOffset +=
        yawSnapDelta(transitionYaw, SETTLE.yaw) + TAU * transitionSpin;
      view.setArmedFace(null);
    }
    if ((fadeMode === 'cross' && !swapped) || fadeMode === 'out') mountContent(next.route);
    fadeMode = 'hold';
  }

  // No transition plays for these, so the swap is immediate:
  // - docked -> docked: a history jump between two content routes. The cube is
  //   already docked and stays put; animating it would be a 1.8 s round trip for
  //   a back-button press.
  // - resting -> resting: back to the landing page while the big cube is already
  //   at centre. There is no motion to play, only content to unmount.
  if (previous.phase === next.phase && next.route !== previous.route) {
    mountContent(next.route);
  }

  applyDom();
}

const input = createInput({
  canvas,
  dockButton,
  view,
  drag,
  tap,
  dispatch,
  pickFaceIndex,
  handleTap,
  getPhase: () => nav.phase,
});

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), MAX_FRAME_DELTA);
  elapsed += dt;

  const entrance = entranceState(elapsed, {
    ...ENTRANCE,
    startY: view.startY,
    endY: view.landingY,
  });
  // Closed form, not an accumulator: the cube lands on the exact same pose at any
  // frame rate, and both angles freeze dead when the entrance ends.
  const rotation = entranceRotation(elapsed, ROTATION);
  // Once per frame, whatever the pointermove event rate was. The viewport minimum
  // is the dimension the camera fits the cube to, so the gain stays proportional
  // to the cube's apparent size.
  const dragYaw = drag.update(dt, Math.min(window.innerWidth, window.innerHeight));

  if (nav.phase === 'entering' && entrance.done) {
    dispatch({ type: 'entranceDone' });
    // The entering phase ignores navigation to protect the landing pose (see
    // src/navstate.js), so a hashchange that arrived mid-entrance was dropped
    // rather than driving the machine. Reconcile against the URL now that the
    // entrance has landed.
    const live = parseHash(window.location.hash).route;
    if (live !== nav.route) dispatch({ type: 'hashChange', route: live });
  }

  // Only while the big cube is up and no drag is running: during a drag the
  // pressed face owns the highlight.
  const hover = input.takeHover();
  if (hover !== null && nav.phase === 'resting' && !input.isPointerActive()) {
    view.setArmedFace(pickFaceIndex(hover.x, hover.y));
  }

  let y = entrance.y;
  let scale = entrance.scale;
  let yaw = rotation.yaw + dragYaw + yawOffset;

  if (nav.phase === 'docked') {
    y = view.dockY;
    scale = view.dockScale;
  } else if (nav.phase === 'shrinking' || nav.phase === 'expanding') {
    const progress = clamp01((elapsed - nav.phaseStartedAt) / dockDuration());
    // Expanding runs the same curves backwards. easeInOutCubic for travel and
    // smootherStep for yaw are both symmetric about (0.5, 0.5), so the reverse
    // pass retraces the forward one exactly.
    const step = dockState(nav.phase === 'shrinking' ? progress : 1 - progress, {
      restY: view.landingY,
      dockY: view.dockY,
      dockScale: view.dockScale,
      yaw: transitionYaw,
      settleYaw: SETTLE.yaw,
      spinRevolutions: transitionSpin,
    });

    y = step.y;
    scale = step.scale;
    yaw = step.yaw;

    page.style.opacity = String(fadeOpacity(fadeMode, progress, DOCK.contentFadeStart));
    // The cross-fade reaches exactly 0 at the midpoint, so the swap is invisible.
    if (fadeMode === 'cross' && !swapped && progress >= 0.5) {
      mountContent(nav.route);
      swapped = true;
    }

    if (progress >= 1) {
      dispatch({ type: 'transitionDone' });
      // A hashchange that arrives mid-transition is ignored by the machine, so
      // reconcile against the URL now that the transition has landed.
      const live = parseHash(window.location.hash).route;
      if (live !== nav.route) dispatch({ type: 'hashChange', route: live });
    }
  }

  lastYaw = yaw;
  view.cube.position.set(0, y + floatOffset(elapsed, FLOAT_OPTS) * scale, 0);
  view.cube.scale.setScalar(scale);
  // rotation.pitch, not SETTLE.pitch: the entrance's vertical tumble runs through
  // it and only lands on SETTLE.pitch at t = duration.
  view.cube.rotation.set(rotation.pitch, yaw, 0);

  renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}

function handleWelcomeAnimationEnd(event) {
  if (event.target !== welcomeHeading) return;

  let completedMode = null;
  if (event.animationName === 'welcome-exit') completedMode = 'exiting';
  if (
    event.animationName === 'welcome-reveal' ||
    event.animationName === 'welcome-reveal-reduced'
  ) {
    completedMode = 'revealing';
  }
  if (completedMode === null) return;

  const next = completeWelcomeAnimation(welcomeState, completedMode);
  if (next === welcomeState) return;
  welcomeState = next;
  applyWelcomeDom();
}

if (renderer) {
  welcomeHeading.hidden = false;
  welcomeHeading.addEventListener('animationend', handleWelcomeAnimationEnd);

  applyViewportSize();
  window.addEventListener('resize', applyViewportSize);

  mountContent(nav.route);
  applyDom();

  input.attach();

  requestAnimationFrame(frame);
}
