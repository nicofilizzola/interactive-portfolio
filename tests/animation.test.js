import { describe, expect, it } from 'vitest';
import { entranceState } from '../src/animation.js';

const OPTS = {
  duration: 3.5,
  startY: 4.9,
  endY: 0,
  startScale: 0.15,
  endScale: 1,
  startSpin: 3.0,
  endSpin: 0.035,
};

describe('entranceState', () => {
  it('starts off-screen above center, small, and spinning fast', () => {
    const state = entranceState(0, OPTS);
    expect(state.y).toBeCloseTo(4.9, 6);
    expect(state.scale).toBeCloseTo(0.15, 6);
    expect(state.spinSpeed).toBeCloseTo(3.0, 6);
    expect(state.progress).toBe(0);
    expect(state.done).toBe(false);
  });

  it('ends centered, full size, and barely drifting', () => {
    const state = entranceState(3.5, OPTS);
    expect(state.y).toBeCloseTo(0, 6);
    expect(state.scale).toBeCloseTo(1, 6);
    expect(state.spinSpeed).toBeCloseTo(0.035, 6);
    expect(state.done).toBe(true);
  });

  it('holds the settled state forever after the entrance', () => {
    const state = entranceState(600, OPTS);
    expect(state.y).toBeCloseTo(0, 6);
    expect(state.scale).toBeCloseTo(1, 6);
    expect(state.spinSpeed).toBeCloseTo(0.035, 6);
    expect(state.done).toBe(true);
  });

  it('descends, grows, and slows monotonically', () => {
    const samples = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((t) => entranceState(t, OPTS));
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i].y).toBeLessThan(samples[i - 1].y);
      expect(samples[i].scale).toBeGreaterThan(samples[i - 1].scale);
      expect(samples[i].spinSpeed).toBeLessThan(samples[i - 1].spinSpeed);
    }
  });

  it('decelerates: by the halfway point it is nearly centered', () => {
    const state = entranceState(1.75, OPTS);
    expect(state.progress).toBeCloseTo(0.5, 6);
    expect(state.y).toBeLessThan(OPTS.startY * 0.2);
  });

  it('calms the spin ahead of the arrival', () => {
    const state = entranceState(1.75, OPTS);
    const linearMidSpin = (OPTS.startSpin + OPTS.endSpin) / 2;
    expect(state.spinSpeed).toBeLessThan(linearMidSpin);
  });

  it('treats negative elapsed time as the start of the entrance', () => {
    const state = entranceState(-2, OPTS);
    expect(state.y).toBeCloseTo(4.9, 6);
    expect(state.scale).toBeCloseTo(0.15, 6);
  });
});
