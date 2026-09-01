import { describe, expect, it } from 'vitest';
import { createTapTracker, pointerToNdc } from '../src/pick.js';
import { PICK } from '../src/config.js';

describe('createTapTracker', () => {
  const press = (tracker, entrySpeedRevs = 0) => tracker.start(100, 100, 1000, entrySpeedRevs);

  it('counts a short, still gesture as a tap', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    tracker.move(105, 104); // 6.40 px
    expect(tracker.end(1300)).toBe(true);
  });

  it('rejects a gesture that travels past the threshold', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    tracker.move(109, 100); // 9 px
    expect(tracker.end(1300)).toBe(false);
  });

  it('rejects a long press that never moved', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    tracker.move(103, 103);
    expect(tracker.end(1600)).toBe(false);
  });

  // Straight-line distance from the press point, not cumulative path length, so
  // jitter that returns to the origin still counts as a tap.
  it('measures travel from the origin, so out-and-back is still a tap', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    tracker.move(106, 100);
    tracker.move(100, 100);
    tracker.move(94, 100);
    tracker.move(100, 100);
    expect(tracker.end(1300)).toBe(true);
  });

  it('remembers the furthest point, not the last one', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    tracker.move(140, 100); // well past the threshold
    tracker.move(100, 100); // back to the origin
    expect(tracker.end(1300)).toBe(false);
  });

  // drag.start() zeroes the velocity so a press stops a coasting cube. Left
  // alone, one tap would both brake AND navigate: the first tap must only stop.
  it('rejects a tap that was spent braking a coasting cube', () => {
    const braking = createTapTracker(PICK);
    braking.start(100, 100, 1000, 0.06);
    expect(braking.end(1300)).toBe(false);

    const gentle = createTapTracker(PICK);
    gentle.start(100, 100, 1000, 0.04);
    expect(gentle.end(1300)).toBe(true);
  });

  it('stops being a candidate as soon as the gesture becomes a drag', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    expect(tracker.candidate(1100)).toBe(true);
    tracker.move(120, 100);
    expect(tracker.candidate(1100)).toBe(false);
  });

  it('stops being a candidate once the press outlives the duration limit', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    expect(tracker.candidate(1400)).toBe(true);
    expect(tracker.candidate(1600)).toBe(false);
  });

  it('consumes the gesture, so a second end is never a second tap', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    expect(tracker.end(1300)).toBe(true);
    expect(tracker.end(1300)).toBe(false);
  });

  it('discards the gesture on cancel', () => {
    const tracker = createTapTracker(PICK);
    press(tracker);
    tracker.cancel();
    expect(tracker.candidate(1100)).toBe(false);
    expect(tracker.end(1300)).toBe(false);
  });

  it('ignores moves and ends with no gesture in flight', () => {
    const tracker = createTapTracker(PICK);
    expect(() => tracker.move(10, 10)).not.toThrow();
    expect(tracker.end(1300)).toBe(false);
    expect(tracker.candidate(1300)).toBe(false);
  });
});

describe('pointerToNdc', () => {
  it('maps the centre of the canvas to the origin', () => {
    const rect = { left: 0, top: 0, width: 1920, height: 1080 };
    expect(pointerToNdc(960, 540, rect)).toEqual({ x: 0, y: 0 });
  });

  it('maps the corners to the unit square, with Y flipped', () => {
    const rect = { left: 0, top: 0, width: 1920, height: 1080 };
    expect(pointerToNdc(0, 0, rect)).toEqual({ x: -1, y: 1 });
    expect(pointerToNdc(1920, 1080, rect)).toEqual({ x: 1, y: -1 });
  });

  // The canvas box and the window coincide today, but will not if the canvas
  // ever stops filling the viewport.
  it('works against a rect with a non-zero origin', () => {
    const rect = { left: 200, top: 100, width: 800, height: 400 };
    expect(pointerToNdc(600, 300, rect)).toEqual({ x: 0, y: 0 });
    expect(pointerToNdc(200, 100, rect)).toEqual({ x: -1, y: 1 });
    expect(pointerToNdc(1000, 500, rect)).toEqual({ x: 1, y: -1 });
  });
});
