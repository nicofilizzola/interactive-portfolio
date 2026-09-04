import { LANDING_ROUTE } from './routes.js';

export function initialWelcomeState(route) {
  const initialRevealPending = route === LANDING_ROUTE;
  return {
    mode: initialRevealPending ? 'waiting' : 'hidden',
    initialRevealPending,
  };
}

export function reduceWelcome(state, previousNav, nextNav) {
  if (nextNav.route !== LANDING_ROUTE) {
    const leavingVisibleLanding =
      previousNav.route === LANDING_ROUTE &&
      (state.mode === 'revealing' || state.mode === 'visible');

    return {
      mode: leavingVisibleLanding ? 'exiting' : 'hidden',
      initialRevealPending: false,
    };
  }

  if (nextNav.phase === 'entering') {
    return { mode: 'waiting', initialRevealPending: state.initialRevealPending };
  }

  if (nextNav.phase !== 'resting') {
    return { mode: 'hidden', initialRevealPending: state.initialRevealPending };
  }

  if (state.initialRevealPending && previousNav.phase === 'entering') {
    return { mode: 'revealing', initialRevealPending: false };
  }

  return { mode: 'visible', initialRevealPending: false };
}

export function completeWelcomeAnimation(state, completedMode) {
  if (state.mode !== completedMode) return state;
  if (completedMode === 'revealing') {
    return { ...state, mode: 'visible' };
  }
  if (completedMode === 'exiting') {
    return { ...state, mode: 'hidden' };
  }
  return state;
}
