import { describe, expect, it } from 'vitest';
import {
  completeWelcomeAnimation,
  initialWelcomeState,
  reduceWelcome,
} from '../src/welcome.js';

function nav(phase, route = null) {
  return { phase, route };
}

describe('initialWelcomeState', () => {
  it('waits only when the document boots on the landing route', () => {
    expect(initialWelcomeState(null)).toEqual({
      mode: 'waiting',
      initialRevealPending: true,
    });
  });

  it('starts hidden with no pending reveal on a content deep link', () => {
    expect(initialWelcomeState('work')).toEqual({
      mode: 'hidden',
      initialRevealPending: false,
    });
  });
});

describe('reduceWelcome', () => {
  it('reveals exactly when the initial landing entrance completes', () => {
    const state = initialWelcomeState(null);
    const next = reduceWelcome(state, nav('entering'), nav('resting'));

    expect(next).toEqual({ mode: 'revealing', initialRevealPending: false });
  });

  it('keeps every content state hidden, including the resting nav overlay', () => {
    const state = initialWelcomeState('work');

    expect(reduceWelcome(state, nav('docked', 'work'), nav('expanding', 'work'))).toEqual(
      state,
    );
    expect(reduceWelcome(state, nav('expanding', 'work'), nav('resting', 'work'))).toEqual(
      state,
    );
  });

  it('exits when a visible landing begins shrinking to content', () => {
    const state = { mode: 'visible', initialRevealPending: false };

    expect(reduceWelcome(state, nav('resting'), nav('shrinking', 'work'))).toEqual({
      mode: 'exiting',
      initialRevealPending: false,
    });
  });

  it('settles only the animation that matches the current mode', () => {
    expect(
      completeWelcomeAnimation(
        { mode: 'revealing', initialRevealPending: false },
        'revealing',
      ),
    ).toEqual({ mode: 'visible', initialRevealPending: false });
    expect(
      completeWelcomeAnimation({ mode: 'exiting', initialRevealPending: false }, 'exiting'),
    ).toEqual({ mode: 'hidden', initialRevealPending: false });
  });

  it('ignores a stale animation completion after the mode changed', () => {
    const state = { mode: 'visible', initialRevealPending: false };

    expect(completeWelcomeAnimation(state, 'exiting')).toBe(state);
    expect(completeWelcomeAnimation(state, 'revealing')).toBe(state);
  });

  it('stays hidden during a return expansion, then appears without revealing', () => {
    const state = initialWelcomeState('work');
    const expanding = reduceWelcome(state, nav('docked', 'work'), nav('expanding'));
    const resting = reduceWelcome(expanding, nav('expanding'), nav('resting'));

    expect(expanding).toEqual({ mode: 'hidden', initialRevealPending: false });
    expect(resting).toEqual({ mode: 'visible', initialRevealPending: false });
  });

  it('appears immediately when history restores landing at an already-resting cube', () => {
    const state = initialWelcomeState('work');
    const next = reduceWelcome(state, nav('resting', 'work'), nav('resting'));

    expect(next).toEqual({ mode: 'visible', initialRevealPending: false });
  });

  it('keeps an in-progress exit through the reduced-motion dock completion', () => {
    const exiting = { mode: 'exiting', initialRevealPending: false };
    const shrinking = reduceWelcome(exiting, nav('resting'), nav('shrinking', 'work'));
    const docked = reduceWelcome(shrinking, nav('shrinking', 'work'), nav('docked', 'work'));

    expect(shrinking).toEqual(exiting);
    expect(docked).toEqual(exiting);
  });
});
