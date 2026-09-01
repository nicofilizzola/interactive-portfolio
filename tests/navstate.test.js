import { describe, expect, it } from 'vitest';
import { initialState, reduce } from '../src/navstate.js';

const at = (t) => ({ at: t });

function landing() {
  return initialState(null, 0);
}

// A cube resting at centre with `work` mounted behind it — the nav-overlay state
// that reopening the docked cube produces.
function overlay(route = 'work') {
  let state = initialState(route, 0);
  state = reduce(state, { type: 'dockClick', ...at(10) });
  return reduce(state, { type: 'transitionDone', ...at(11) });
}

describe('initialState', () => {
  it('plays the entrance for the landing page', () => {
    expect(initialState(null, 0)).toEqual({
      phase: 'entering',
      route: null,
      fromRoute: null,
      phaseStartedAt: 0,
      navigate: null,
    });
  });

  // A deep link, a refresh, or a shared URL: no entrance and no dock
  // transition. There is no prior on-screen position to move from, and 3.5 s of
  // theatre in front of requested content is wrong.
  it('starts a deep link docked, with no entrance', () => {
    expect(initialState('about', 5)).toEqual({
      phase: 'docked',
      route: 'about',
      fromRoute: 'about',
      phaseStartedAt: 5,
      navigate: null,
    });
  });
});

describe('entering', () => {
  it('ignores every input event', () => {
    const start = landing();
    for (const type of ['faceTap', 'missTap', 'escape', 'dockClick', 'transitionDone', 'hashChange']) {
      const next = reduce(start, { type, route: 'work', ...at(1) });
      expect(next.phase).toBe('entering');
      expect(next.navigate).toBeNull();
    }
  });

  it('rests when the entrance lands', () => {
    const next = reduce(landing(), { type: 'entranceDone', ...at(3.5) });
    expect(next.phase).toBe('resting');
    expect(next.route).toBeNull();
    expect(next.phaseStartedAt).toBe(3.5);
  });
});

describe('resting on the landing page', () => {
  const resting = () => reduce(landing(), { type: 'entranceDone', ...at(3.5) });

  it('asks the caller to push the hash on a face tap, and does not move yet', () => {
    const next = reduce(resting(), { type: 'faceTap', route: 'work', ...at(4) });
    expect(next.navigate).toBe('work');
    expect(next.phase).toBe('resting');
    expect(next.route).toBeNull();
  });

  it('shrinks when the hashchange arrives', () => {
    const next = reduce(resting(), { type: 'hashChange', route: 'work', ...at(4.1) });
    expect(next.phase).toBe('shrinking');
    expect(next.route).toBe('work');
    expect(next.fromRoute).toBeNull();
    expect(next.phaseStartedAt).toBe(4.1);
    expect(next.navigate).toBeNull();
  });

  it('has nothing to dismiss, so a miss tap and Esc do nothing', () => {
    for (const type of ['missTap', 'escape']) {
      const next = reduce(resting(), { type, ...at(4) });
      expect(next.phase).toBe('resting');
      expect(next.route).toBeNull();
      expect(next.navigate).toBeNull();
    }
  });
});

describe('resting as a nav overlay over a page', () => {
  it('is where reopening the docked cube lands', () => {
    const state = overlay();
    expect(state.phase).toBe('resting');
    expect(state.route).toBe('work');
  });

  // Not a navigation: the hash would not change, so no hashchange would arrive
  // to drive the transition. Close directly, and push nothing.
  it('closes without pushing when the current route\'s face is tapped', () => {
    const next = reduce(overlay(), { type: 'faceTap', route: 'work', ...at(12) });
    expect(next.phase).toBe('shrinking');
    expect(next.route).toBe('work');
    expect(next.fromRoute).toBe('work');
    expect(next.navigate).toBeNull();
  });

  it('pushes the hash when a different route\'s face is tapped', () => {
    const next = reduce(overlay(), { type: 'faceTap', route: 'about', ...at(12) });
    expect(next.navigate).toBe('about');
    expect(next.phase).toBe('resting');
  });

  it('cross-fades when the hashchange for a different route arrives', () => {
    const next = reduce(overlay(), { type: 'hashChange', route: 'about', ...at(12.1) });
    expect(next.phase).toBe('shrinking');
    expect(next.route).toBe('about');
    expect(next.fromRoute).toBe('work');
  });

  it('closes on a miss tap or Esc, and pushes nothing', () => {
    for (const type of ['missTap', 'escape']) {
      const next = reduce(overlay(), { type, ...at(12) });
      expect(next.phase).toBe('shrinking');
      expect(next.route).toBe('work');
      expect(next.navigate).toBeNull();
    }
  });

  // The cube is ALREADY at centre, so there is no motion to play — only the
  // content unmounts. Spec section 11 routes this through `expanding`, which is
  // right for the docked half of that row and wrong here (plan errata 4).
  it('stays resting when history goes back to the landing page', () => {
    const next = reduce(overlay(), { type: 'hashChange', route: null, ...at(12.1) });
    expect(next.phase).toBe('resting');
    expect(next.route).toBeNull();
    expect(next.fromRoute).toBe('work');
  });
});

describe('the transitions', () => {
  const shrinking = () => reduce(overlay(), { type: 'escape', ...at(12) });

  it('docks when the shrink lands', () => {
    const next = reduce(shrinking(), { type: 'transitionDone', ...at(12.9) });
    expect(next.phase).toBe('docked');
    expect(next.route).toBe('work');
    expect(next.phaseStartedAt).toBe(12.9);
  });

  it('ignores every event but transitionDone while shrinking', () => {
    const start = shrinking();
    for (const type of ['faceTap', 'missTap', 'escape', 'dockClick', 'hashChange']) {
      const next = reduce(start, { type, route: 'about', ...at(12.5) });
      expect(next.phase).toBe('shrinking');
      expect(next.navigate).toBeNull();
    }
  });

  it('ignores every event but transitionDone while expanding', () => {
    const start = reduce(initialState('work', 0), { type: 'dockClick', ...at(10) });
    expect(start.phase).toBe('expanding');
    for (const type of ['faceTap', 'missTap', 'escape', 'dockClick', 'hashChange']) {
      const next = reduce(start, { type, route: 'about', ...at(10.5) });
      expect(next.phase).toBe('expanding');
      expect(next.navigate).toBeNull();
    }
  });

  it('rests when the expand lands', () => {
    const start = reduce(initialState('work', 0), { type: 'dockClick', ...at(10) });
    const next = reduce(start, { type: 'transitionDone', ...at(10.9) });
    expect(next.phase).toBe('resting');
    expect(next.route).toBe('work');
  });
});

describe('docked', () => {
  const docked = () => initialState('work', 0);

  it('reopens the big cube over the current page', () => {
    const next = reduce(docked(), { type: 'dockClick', ...at(10) });
    expect(next.phase).toBe('expanding');
    expect(next.route).toBe('work');
    expect(next.fromRoute).toBe('work');
  });

  // Animating this would be a 1.8 s round trip for a back-button press.
  it('swaps content in place when history jumps between two content routes', () => {
    const next = reduce(docked(), { type: 'hashChange', route: 'about', ...at(10) });
    expect(next.phase).toBe('docked');
    expect(next.route).toBe('about');
    expect(next.fromRoute).toBe('work');
    expect(next.navigate).toBeNull();
  });

  it('brings the big cube back up when history goes to the landing page', () => {
    const next = reduce(docked(), { type: 'hashChange', route: null, ...at(10) });
    expect(next.phase).toBe('expanding');
    expect(next.route).toBeNull();
  });

  it('ignores a hashchange for the route it is already on', () => {
    const start = docked();
    const next = reduce(start, { type: 'hashChange', route: 'work', ...at(10) });
    expect(next).toBe(start);
  });

  it('ignores taps — the canvas takes no pointer events while docked', () => {
    for (const type of ['faceTap', 'missTap', 'escape']) {
      expect(reduce(docked(), { type, route: 'about', ...at(10) }).phase).toBe('docked');
    }
  });
});

describe('navigate', () => {
  it('never survives into the next reduction', () => {
    const resting = reduce(landing(), { type: 'entranceDone', ...at(3.5) });
    const asked = reduce(resting, { type: 'faceTap', route: 'work', ...at(4) });
    expect(asked.navigate).toBe('work');

    const after = reduce(asked, { type: 'hashChange', route: 'work', ...at(4.1) });
    expect(after.navigate).toBeNull();
  });
});
