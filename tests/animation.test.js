import { describe, expect, it } from 'vitest';
import { entranceRevolutions, entranceRotation, entranceState } from '../src/animation.js';

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

const TAU = Math.PI * 2;

const ROT_OPTS = {
  duration: 3.5,
  startSpin: 5.0,
  endSpin: 0.035,
  settleYaw: Math.PI / 4,
  settlePitch: (15 * Math.PI) / 180,
  tumbleRatio: 0.35,
};

// Reduce to the cube's 90-degree yaw symmetry: any two angles a multiple of
// PI/2 apart are the same pose, so this is the angle that decides what you see.
function yawModQuarterTurn(angle) {
  const quarter = Math.PI / 2;
  return ((angle % quarter) + quarter) % quarter;
}

describe('entranceRotation', () => {
  it('lands edge-on regardless of how fast the entrance started', () => {
    for (const startSpin of [3, 5, 8]) {
      const opts = { ...ROT_OPTS, startSpin };
      const { yaw } = entranceRotation(opts.duration, opts);
      expect(yawModQuarterTurn(yaw)).toBeCloseTo(Math.PI / 4, 9);
    }
  });

  it('lands on the settle pitch exactly', () => {
    expect(entranceRotation(ROT_OPTS.duration, ROT_OPTS).pitch).toBe(ROT_OPTS.settlePitch);
  });

  it('freezes the vertical tumble once settled', () => {
    const atArrival = entranceRotation(ROT_OPTS.duration, ROT_OPTS).pitch;
    expect(entranceRotation(ROT_OPTS.duration + 60, ROT_OPTS).pitch).toBe(atArrival);
    expect(entranceRotation(ROT_OPTS.duration + 600, ROT_OPTS).pitch).toBe(atArrival);
  });

  it('drifts horizontally at exactly endSpin after the entrance', () => {
    const atArrival = entranceRotation(ROT_OPTS.duration, ROT_OPTS).yaw;
    const tenSecondsLater = entranceRotation(ROT_OPTS.duration + 10, ROT_OPTS).yaw;
    expect(tenSecondsLater - atArrival).toBeCloseTo(10 * ROT_OPTS.endSpin * TAU, 9);
  });

  it('reaches the same landing pose at 30 fps and at 144 fps', () => {
    const sampleAtArrival = (step) => {
      let t = 0;
      while (t < ROT_OPTS.duration) {
        t = Math.min(t + step, ROT_OPTS.duration);
      }
      return entranceRotation(t, ROT_OPTS);
    };
    const slow = sampleAtArrival(1 / 30);
    const fast = sampleAtArrival(1 / 144);
    expect(slow.yaw).toBeCloseTo(fast.yaw, 12);
    expect(slow.pitch).toBeCloseTo(fast.pitch, 12);
    expect(slow.yaw).toBeCloseTo(entranceRotation(ROT_OPTS.duration, ROT_OPTS).yaw, 12);
  });

  it('turns one way only, through the entrance and on into the idle drift', () => {
    const samples = [0, 0.35, 1, 1.75, 2.5, 3.5, 10, 60].map(
      (t) => entranceRotation(t, ROT_OPTS).yaw
    );
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it('tumbles through the entrance before settling', () => {
    const start = entranceRotation(0, ROT_OPTS);
    const mid = entranceRotation(1.75, ROT_OPTS);
    expect(start.pitch).toBeLessThan(mid.pitch);
    expect(mid.pitch).toBeLessThan(ROT_OPTS.settlePitch);
    expect(start.yaw).toBeCloseTo(
      ROT_OPTS.settleYaw - TAU * entranceRevolutions(ROT_OPTS.duration, ROT_OPTS),
      9
    );
  });

  it('holds the pose steady while only the idle drift advances', () => {
    const a = entranceRotation(100, ROT_OPTS);
    const b = entranceRotation(200, ROT_OPTS);
    expect(b.pitch).toBe(a.pitch);
    expect(b.yaw - a.yaw).toBeCloseTo(100 * ROT_OPTS.endSpin * TAU, 9);
  });
});
