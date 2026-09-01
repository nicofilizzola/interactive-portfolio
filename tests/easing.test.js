import { describe, expect, it } from 'vitest';
import { easeOutCubic, easeOutQuart, smoothStep } from '../src/easing.js';

describe('easeOutCubic', () => {
  it('maps the unit interval onto itself', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('decelerates: most of the distance is covered by the halfway point', () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 6);
  });

  it('clamps out-of-range input instead of overshooting', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(4)).toBe(1);
  });
});

describe('easeOutQuart', () => {
  it('maps the unit interval onto itself', () => {
    expect(easeOutQuart(0)).toBe(0);
    expect(easeOutQuart(1)).toBe(1);
  });

  it('decelerates harder than cubic everywhere in between', () => {
    expect(easeOutQuart(0.5)).toBeCloseTo(0.9375, 6);
    expect(easeOutQuart(0.3)).toBeGreaterThan(easeOutCubic(0.3));
  });

  it('clamps out-of-range input instead of overshooting', () => {
    expect(easeOutQuart(-1)).toBe(0);
    expect(easeOutQuart(4)).toBe(1);
  });
});

describe('smoothStep', () => {
  it('maps the unit interval onto itself, symmetric about the midpoint', () => {
    expect(smoothStep(0)).toBe(0);
    expect(smoothStep(1)).toBe(1);
    expect(smoothStep(0.5)).toBe(0.5);
  });

  it('clamps out-of-range input instead of overshooting', () => {
    expect(smoothStep(-1)).toBe(0);
    expect(smoothStep(4)).toBe(1);
  });

  // The whole reason this curve exists rather than a linear ramp: an envelope
  // with a non-zero derivative at 0 only removes the float's position step, not
  // its velocity step.
  it('leaves and arrives with zero slope', () => {
    const h = 1e-6;
    expect((smoothStep(h) - smoothStep(0)) / h).toBeLessThan(1e-4);
    expect((smoothStep(1) - smoothStep(1 - h)) / h).toBeLessThan(1e-4);
  });

  it('rises monotonically', () => {
    let previous = -1;
    for (let i = 0; i <= 100; i += 1) {
      const value = smoothStep(i / 100);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });
});
