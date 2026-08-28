import { describe, expect, it } from 'vitest';
import { createParallax } from '../src/parallax.js';

const CONFIG = { maxOffset: 0.22, maxTilt: 0.09, tau: 0.35 };

function settle(parallax, steps = 200, dt = 1 / 60) {
  let out = parallax.update(0);
  for (let i = 0; i < steps; i += 1) out = parallax.update(dt);
  return out;
}

describe('createParallax', () => {
  it('is centered before the pointer ever moves', () => {
    const out = createParallax(CONFIG).update(1 / 60);
    expect(out.offsetX).toBe(0);
    expect(out.offsetY).toBe(0);
    expect(out.tiltX).toBe(0);
    expect(out.tiltY).toBe(0);
  });

  it('leans toward the pointer, up to the configured maximum', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(1, 0);
    const out = settle(parallax);
    expect(out.offsetX).toBeCloseTo(CONFIG.maxOffset, 4);
    expect(out.tiltY).toBeCloseTo(CONFIG.maxTilt, 4);
  });

  it('lifts the cube when the pointer is above center', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(0, -1);
    expect(settle(parallax).offsetY).toBeCloseTo(CONFIG.maxOffset, 4);
  });

  it('eases toward the pointer instead of snapping', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(1, 1);
    const firstFrame = parallax.update(1 / 60);
    expect(firstFrame.offsetX).toBeGreaterThan(0);
    expect(firstFrame.offsetX).toBeLessThan(CONFIG.maxOffset * 0.25);
  });

  it('clamps pointer input from outside the viewport', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(50, -50);
    const out = settle(parallax);
    expect(out.offsetX).toBeCloseTo(CONFIG.maxOffset, 4);
    expect(out.offsetY).toBeCloseTo(CONFIG.maxOffset, 4);
  });

  it('does not drift when no time passes', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(1, 1);
    expect(parallax.update(0).offsetX).toBe(0);
  });

  it('returns to center after the pointer comes back', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(1, 1);
    settle(parallax);
    parallax.setPointer(0, 0);
    const out = settle(parallax);
    expect(out.offsetX).toBeCloseTo(0, 4);
    expect(out.offsetY).toBeCloseTo(0, 4);
  });

  it('never leaks negative zero, even from a negative-zero pointer', () => {
    const parallax = createParallax(CONFIG);
    parallax.setPointer(-0, -0);
    const out = parallax.update(1 / 60);

    // dampTowards resolves -0 to +0, which is why only offsetY's unary negation
    // needs normalizing. If dampTowards is ever rewritten, this fails first.
    expect(Object.is(out.offsetX, 0)).toBe(true);
    expect(Object.is(out.offsetY, 0)).toBe(true);
    expect(Object.is(out.tiltX, 0)).toBe(true);
    expect(Object.is(out.tiltY, 0)).toBe(true);
  });
});
