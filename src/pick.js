// Tap-vs-drag discrimination and NDC conversion. Stateful but pure: no three, no
// DOM, no events — main.js owns the listeners and calls in, the same split
// src/drag.js uses.
//
// A face click is a FAILED drag. The same gesture on the same surface already
// means "spin the cube", so a tap is defined negatively and runs on the existing
// pointer plumbing. Do NOT add a `click` listener: click fires after a drag too,
// and its target is the canvas, not a face.
export function createTapTracker({ tapMaxTravelPx, tapMaxDurationMs, tapMaxEntrySpeedRevs }) {
  let gesture = null;

  function stillATap(timeMs) {
    if (gesture === null) return false;
    if (gesture.braked) return false;
    if (gesture.maxTravel > tapMaxTravelPx) return false;
    return timeMs - gesture.startedAt <= tapMaxDurationMs;
  }

  return {
    // `entrySpeedRevs` is the coast speed the press just cancelled, in rev/s, as
    // returned by drag.start(). A press on a coasting cube brakes it, and that
    // brake must not also navigate: the first tap stops the cube, the second one
    // navigates.
    start(x, y, timeMs, entrySpeedRevs) {
      gesture = {
        x,
        y,
        startedAt: timeMs,
        maxTravel: 0,
        braked: entrySpeedRevs > tapMaxEntrySpeedRevs,
      };
    },

    move(x, y) {
      if (gesture === null) return;
      // Straight-line distance from the press point, not cumulative path length,
      // so jitter that returns to the origin still counts as a tap. The furthest
      // point is what is remembered: a gesture that swung wide and came back was
      // a drag.
      const travel = Math.hypot(x - gesture.x, y - gesture.y);
      if (travel > gesture.maxTravel) gesture.maxTravel = travel;
    },

    // Is this gesture still capable of being a tap? Read on pointermove so the
    // armed-face highlight can clear the moment the gesture becomes a drag,
    // rather than waiting for the release.
    candidate(timeMs) {
      return stillATap(timeMs);
    },

    // Consumes the gesture, so the lostpointercapture that follows a pointerup
    // cannot produce a second tap.
    end(timeMs) {
      const tapped = stillATap(timeMs);
      gesture = null;
      return tapped;
    },

    cancel() {
      gesture = null;
    },
  };
}

// Normalised device coordinates from the CANVAS's own box, not from `window`:
// they coincide today but will not if the canvas box ever changes. Y is flipped
// — NDC is +1 at the top, CSS pixels are 0 at the top.
export function pointerToNdc(clientX, clientY, rect) {
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: 1 - ((clientY - rect.top) / rect.height) * 2,
  };
}
