import { LANDING_ROUTE } from './routes.js';

// The nav phase machine, as a pure reducer. Modelled explicitly and without the
// DOM because the alternative is a tangle of booleans in main.js, and because
// this way every row of the transition table unit-tests without a browser.
//
// `overlay` from the spec's state shape is deliberately NOT stored: it is
// exactly `route !== null` combined with the phase, so keeping it would be a
// second source of truth for one fact. main.js derives it.
//
// There is ONE clock. `phaseStartedAt` is a reading of main.js's monotonic
// `elapsed`, and each transition's progress is
// (elapsed - phaseStartedAt) / duration. Do not add a second one.
//
// `navigate` is a one-shot instruction to the caller — a route to push onto the
// hash — and never survives into the next reduction. It exists because
// `hashchange` is the single source of truth for `route`: a face tap sets the
// hash, and the hashchange that follows drives the phase. That is what makes the
// back button work without a parallel code path.

export function initialState(route, at = 0) {
  // A deep link, a refresh, or a shared URL starts docked with content already
  // mounted and plays no entrance: there is no prior on-screen position to dock
  // from, and 3.5 s of theatre in front of requested content is wrong.
  if (route !== LANDING_ROUTE) {
    return { phase: 'docked', route, fromRoute: route, phaseStartedAt: at, navigate: null };
  }

  return {
    phase: 'entering',
    route: LANDING_ROUTE,
    fromRoute: LANDING_ROUTE,
    phaseStartedAt: at,
    navigate: null,
  };
}

function moveTo(state, phase, route, at) {
  return { phase, route, fromRoute: state.route, phaseStartedAt: at, navigate: null };
}

// Same state, with any pending `navigate` cleared.
function stay(state) {
  return state.navigate === null ? state : { ...state, navigate: null };
}

export function reduce(state, event) {
  const at = event.at === undefined ? state.phaseStartedAt : event.at;

  if (state.phase === 'entering') {
    // The entrance ignores every input event. A press before it lands would make
    // the yaw at t = duration SETTLE.yaw + userYaw and break the exact landing
    // pose, and there is nothing on screen to navigate from anyway.
    if (event.type !== 'entranceDone') return stay(state);
    return moveTo(state, 'resting', state.route, at);
  }

  // Transitions accept nothing: they are 0.9 s of committed motion.
  if (state.phase === 'shrinking' || state.phase === 'expanding') {
    if (event.type !== 'transitionDone') return stay(state);
    const next = state.phase === 'shrinking' ? 'docked' : 'resting';
    return moveTo(state, next, state.route, at);
  }

  if (state.phase === 'resting') {
    switch (event.type) {
      case 'faceTap':
        // A tap on the route already showing is a dismissal, not a navigation:
        // the hash would not change, so no hashchange would arrive to drive the
        // transition. Close directly, and push nothing.
        if (event.route === state.route) return moveTo(state, 'shrinking', state.route, at);
        // Everything else routes through the hash.
        return { ...state, navigate: event.route };

      case 'missTap':
      case 'escape':
        // Dismissal only exists over content. On the landing page there is
        // nothing to dismiss to.
        if (state.route === LANDING_ROUTE) return stay(state);
        return moveTo(state, 'shrinking', state.route, at);

      case 'hashChange':
        if (event.route === state.route) return stay(state);
        // Back to the landing page while the big cube is already at centre:
        // there is no motion to play, only content to unmount.
        if (event.route === LANDING_ROUTE) {
          return moveTo(state, 'resting', LANDING_ROUTE, at);
        }
        return moveTo(state, 'shrinking', event.route, at);

      default:
        return stay(state);
    }
  }

  // docked. The canvas takes no pointer events here, so no tap can arrive.
  switch (event.type) {
    case 'dockClick':
      return moveTo(state, 'expanding', state.route, at);

    case 'hashChange':
      if (event.route === state.route) return stay(state);
      if (event.route === LANDING_ROUTE) return moveTo(state, 'expanding', LANDING_ROUTE, at);
      // Two content routes: the cube is already docked and stays put. Animating
      // it would be a 1.8 s round trip for a back-button press.
      return moveTo(state, 'docked', event.route, at);

    default:
      return stay(state);
  }
}
