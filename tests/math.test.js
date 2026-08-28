import { describe, expect, it } from 'vitest';
import { clamp01, dampTowards, lerp } from '../src/math.js';

describe('clamp01', () => {
  it('passes through values already inside the unit range', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1)).toBe(1);
  });

  it('clamps values outside the unit range', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(9.5)).toBe(1);
  });
});

describe('lerp', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    expect(lerp(2, 10, 0)).toBe(2);
    expect(lerp(2, 10, 1)).toBe(10);
  });

  it('interpolates linearly in between', () => {
    expect(lerp(2, 10, 0.25)).toBe(4);
  });
});

describe('dampTowards', () => {
  it('does not move when no time has passed', () => {
    expect(dampTowards(0, 1, 0.35, 0)).toBe(0);
  });

  it('covers 1 - 1/e of the remaining gap in one time constant', () => {
    expect(dampTowards(0, 1, 0.35, 0.35)).toBeCloseTo(1 - 1 / Math.E, 6);
  });

  it('is symmetric when closing a negative gap', () => {
    expect(dampTowards(1, 0, 0.35, 0.35)).toBeCloseTo(1 / Math.E, 6);
  });

  it('effectively reaches the target for a very large dt', () => {
    expect(dampTowards(0, 1, 0.35, 100)).toBeCloseTo(1, 6);
  });
});
