import { describe, expect, it } from 'vitest';
import { easeOutCubic, easeOutQuart } from '../src/easing.js';

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
