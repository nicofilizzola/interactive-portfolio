import { hashForRoute, parseHash } from './routes.js';

// The DOM event wiring for the cube: pointer drag/tap, keyboard escape, the dock
// button, and hash navigation. Kept apart from src/main.js so that file can stay
// the render loop plus composition. This module may touch window/document/
// location/history — that is its job — but it must not import three, must not
// render, and must not read `nav` directly: it asks through `getPhase()`.
export function createInput({
  canvas,
  dockButton,
  view,
  drag,
  tap,
  dispatch,
  pickFaceIndex,
  handleTap,
  getPhase,
}) {
  let activePointerId = null;
  // The most recent hover position, folded once per frame by takeHover(). Mouse
  // only — touch has no hover, and a raycast per pointermove would make the cost
  // depend on the browser's event coalescing rate.
  let hoverAt = null;

  // Idempotent: pointerup and the lostpointercapture that follows it both land
  // here, and blur calls it with no event at all.
  function endDrag(event) {
    if (activePointerId === null) {
      tap.cancel();
      return;
    }
    if (event && event.pointerId !== undefined && event.pointerId !== activePointerId) return;

    const pointerId = activePointerId;
    activePointerId = null;
    // The UA fires lostpointercapture after pointerup, so capture is still held
    // here and this release runs on every drag via pointerup (or blur); by the time
    // lostpointercapture re-enters, it is a documented no-op.
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);

    // ONLY a pointerup can be a tap. pointercancel, lostpointercapture, and blur
    // all discard the gesture. tap.end() consumes it, so the lostpointercapture
    // that follows a pointerup cannot produce a second tap.
    const wasTap = Boolean(event) && event.type === 'pointerup' && tap.end(event.timeStamp);
    if (!wasTap) tap.cancel();

    drag.end();
    view.setArmedFace(null);
    if (wasTap) handleTap(event.clientX, event.clientY);
  }

  function attach() {
    canvas.addEventListener('pointerdown', (event) => {
      // Primary pointer, left button only: a right- or middle-button drag should
      // not spin the cube, and a right-drag should still open the context menu.
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      // Only `resting` accepts a press. During the entrance a press would make the
      // yaw at t = duration SETTLE.yaw + userYaw and break the exact landing pose;
      // during a transition it would fight the interpolation. Also ignores a second
      // finger while a drag is already running.
      if (getPhase() !== 'resting' || activePointerId !== null) return;

      activePointerId = event.pointerId;
      // Capture is what keeps the drag alive once the pointer leaves the window —
      // browser chrome, a second monitor, another app.
      canvas.setPointerCapture(event.pointerId);
      // start() returns the coast speed it just cancelled, in rev/s. A press on a
      // coasting cube brakes it, and that brake must not also navigate: the first
      // tap stops the cube, the second one navigates.
      const brakedRevs = drag.start(event.clientX);
      tap.start(event.clientX, event.clientY, event.timeStamp, brakedRevs);
      // Press feedback is the only pre-commit signal touch has — there is no hover
      // — and it is required, not polish: at the resting pose the boundary between
      // two routes runs exactly down the middle of the cube.
      view.setArmedFace(pickFaceIndex(event.clientX, event.clientY));
    });

    canvas.addEventListener('pointermove', (event) => {
      if (activePointerId === null) {
        // Hover: recorded here, folded once per frame. Touch has no hover, and a
        // touch pointermove with no capture is not a gesture we care about.
        if (event.pointerType === 'mouse' && getPhase() === 'resting') {
          hoverAt = { x: event.clientX, y: event.clientY };
        }
        return;
      }
      if (event.pointerId !== activePointerId) return;

      drag.move(event.clientX);
      tap.move(event.clientX, event.clientY);
      // Past the travel or duration threshold the gesture is a drag, so the pressed
      // face stops being a candidate and the highlight goes immediately rather than
      // waiting for the release.
      if (!tap.candidate(event.timeStamp)) view.setArmedFace(null);
    });

    canvas.addEventListener('pointerleave', () => {
      hoverAt = null;
      if (activePointerId === null) view.setArmedFace(null);
    });

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('lostpointercapture', endDrag);
    // Capture survives a lot, but not the tab losing focus mid-drag.
    window.addEventListener('blur', () => endDrag());

    // Required for the pointer case too: with the big cube over content there must
    // be a way out that is not "guess that clicking the background works".
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') dispatch({ type: 'escape' });
    });

    dockButton.addEventListener('click', () => dispatch({ type: 'dockClick' }));

    window.addEventListener('hashchange', () => {
      const parsed = parseHash(window.location.hash);
      if (!parsed.known) {
        // Replace, not push: the back button must not bounce between a bad hash and
        // its correction. replaceState fires no hashchange, so the machine is driven
        // directly below.
        window.history.replaceState(null, '', hashForRoute(parsed.route));
      }
      dispatch({ type: 'hashChange', route: parsed.route });
    });
  }

  // Read-and-clear in one call, so frame() cannot double-consume a hover position
  // across two checks.
  function takeHover() {
    const hover = hoverAt;
    hoverAt = null;
    return hover;
  }

  function isPointerActive() {
    return activePointerId !== null;
  }

  return { attach, takeHover, isPointerActive };
}
