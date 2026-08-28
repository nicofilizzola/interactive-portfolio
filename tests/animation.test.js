import { describe, expect, it } from 'vitest';
import { entranceRevolutions, entranceState } from '../src/animation.js';

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

describe('entranceRevolutions', () => {
  it('has covered nothing at the start of the entrance', () => {
    expect(entranceRevolutions(0, OPTS)).toBe(0);
  });

  it('treats negative elapsed time as the start of the entrance', () => {
    expect(entranceRevolutions(-2, OPTS)).toBe(0);
  });

  it('lands on the analytic total D * (s0 + (s1 - s0) * 0.8)', () => {
    const expected = OPTS.duration * (OPTS.startSpin + (OPTS.endSpin - OPTS.startSpin) * 0.8);
    expect(entranceRevolutions(OPTS.duration, OPTS)).toBeCloseTo(expected, 12);
    expect(entranceRevolutions(OPTS.duration, OPTS)).toBeCloseTo(2.198, 9);
  });

  it('covers 3.598 revolutions at the shipped 5.0 rev/s start speed', () => {
    const fast = { ...OPTS, startSpin: 5.0 };
    expect(entranceRevolutions(fast.duration, fast)).toBeCloseTo(3.598, 9);
  });

  it('increases strictly through the entrance', () => {
    const samples = [0, 0.25, 0.5, 1, 1.75, 2.5, 3, 3.49, 3.5].map((t) =>
      entranceRevolutions(t, OPTS)
    );
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it('stops growing once the entrance is over', () => {
    const total = entranceRevolutions(OPTS.duration, OPTS);
    expect(entranceRevolutions(OPTS.duration + 60, OPTS)).toBe(total);
    expect(entranceRevolutions(600, OPTS)).toBe(total);
  });

  it('front-loads the turns: 94 percent of them happen in the first half', () => {
    const half = entranceRevolutions(OPTS.duration / 2, OPTS);
    const total = entranceRevolutions(OPTS.duration, OPTS);
    expect(half / total).toBeCloseTo(0.9426, 4);
  });
});
