import { describe, expect, it } from 'vitest';
import {
  entranceRevolutions,
  entranceRotation,
  entranceState,
  floatOffset,
} from '../src/animation.js';
import { ENTRANCE, FLOAT } from '../src/config.js';

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

  it('covers 3.150 revolutions at the shipped 4.5 rev/s start and zero end speed', () => {
    const shipped = { ...OPTS, startSpin: 4.5, endSpin: 0 };
    expect(entranceRevolutions(shipped.duration, shipped)).toBeCloseTo(3.15, 9);
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
  startSpin: 4.5,
  endSpin: 0,
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

  it('holds the yaw perfectly still after the entrance', () => {
    const atArrival = entranceRotation(ROT_OPTS.duration, ROT_OPTS).yaw;
    expect(entranceRotation(ROT_OPTS.duration + 60, ROT_OPTS).yaw).toBe(atArrival);
    expect(entranceRotation(ROT_OPTS.duration + 600, ROT_OPTS).yaw).toBe(atArrival);
  });

  it('reaches the same landing pose at 30 fps and at 144 fps', () => {
    // Ask for the rotation once per simulated frame, so the two rates drive
    // different call sequences: a stateful per-frame accumulator would land
    // somewhere different at each rate, while a closed form cannot.
    const sampleAtArrival = (step) => {
      let t = 0;
      let rotation = entranceRotation(t, ROT_OPTS);
      while (t < ROT_OPTS.duration) {
        t = Math.min(t + step, ROT_OPTS.duration);
        rotation = entranceRotation(t, ROT_OPTS);
      }
      return rotation;
    };
    const slow = sampleAtArrival(1 / 30);
    const fast = sampleAtArrival(1 / 144);
    expect(slow.yaw).toBeCloseTo(fast.yaw, 12);
    expect(slow.pitch).toBeCloseTo(fast.pitch, 12);
    expect(slow.yaw).toBeCloseTo(entranceRotation(ROT_OPTS.duration, ROT_OPTS).yaw, 12);
  });

  it('turns one way only through the entrance', () => {
    const samples = [0, 0.35, 1, 1.75, 2.5, 3.5].map(
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

  it('freezes both angles once settled — nothing moves without the viewer', () => {
    const a = entranceRotation(100, ROT_OPTS);
    const b = entranceRotation(200, ROT_OPTS);
    expect(b.pitch).toBe(a.pitch);
    expect(b.yaw).toBe(a.yaw);
  });

  it('lands the exact resting pose — the float moves neither angle', () => {
    const landed = entranceRotation(ROT_OPTS.duration, ROT_OPTS);
    expect(landed.yaw).toBe(ROT_OPTS.settleYaw);
    expect(landed.pitch).toBe(ROT_OPTS.settlePitch);
  });
});

describe('floatOffset', () => {
  const FLOAT_OPTS = {
    duration: 3.5,
    amplitude: 0.08,
    period: 5.0,
    rampDuration: 1.5,
    overlap: 0.7,
  };
  const onset = FLOAT_OPTS.duration - FLOAT_OPTS.overlap;

  it('is exactly zero until its own onset, and exactly zero at it', () => {
    expect(floatOffset(0, FLOAT_OPTS)).toBe(0);
    expect(floatOffset(1.75, FLOAT_OPTS)).toBe(0);
    expect(floatOffset(onset, FLOAT_OPTS)).toBe(0);
  });

  it('treats negative elapsed time as the start of the entrance', () => {
    expect(floatOffset(-2, FLOAT_OPTS)).toBe(0);
  });

  it('starts moving within a millisecond of the onset', () => {
    expect(floatOffset(onset + 0.001, FLOAT_OPTS)).toBeGreaterThan(0);
  });

  // THE TEST THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT. The unramped form's
  // velocity at its onset is amplitude * TAU / period = 0.1005 u/s, which is
  // where the whole "arrive, then twitch" reads from. The envelope's S'(0) = 0
  // drives it to ~1.3e-9.
  it('has zero velocity at the float onset', () => {
    const h = 1e-4;
    const ramped = (floatOffset(onset + h, FLOAT_OPTS) - floatOffset(onset, FLOAT_OPTS)) / h;
    expect(Math.abs(ramped)).toBeLessThan(1e-6);

    const unramped =
      (FLOAT_OPTS.amplitude * Math.sin((2 * Math.PI * h) / FLOAT_OPTS.period)) / h;
    expect(unramped).toBeGreaterThan(0.1);
  });

  // Part of the C^2 claim (spec section 4). Note what it does NOT prove: sin has
  // an inflection at 0, so the unramped form also has zero acceleration here.
  // The velocity case above is the discriminating one.
  it('has zero acceleration at the float onset', () => {
    const h = 1e-4;
    const second =
      (floatOffset(onset + 2 * h, FLOAT_OPTS) -
        2 * floatOffset(onset + h, FLOAT_OPTS) +
        floatOffset(onset, FLOAT_OPTS)) /
      (h * h);
    expect(Math.abs(second)).toBeLessThan(1e-3);
  });

  it('clips its first upswing to 97% of the amplitude, and peaks late', () => {
    // The envelope moves the first peak off the quarter period: 1.40 s past the
    // onset, not 1.25 s, at 0.96977 * amplitude. Tolerance 5e-4 (3 places).
    const firstPeak = floatOffset(onset + 1.4, FLOAT_OPTS);
    expect(firstPeak / FLOAT_OPTS.amplitude).toBeCloseTo(0.97, 3);
    expect(firstPeak).toBeGreaterThan(floatOffset(onset + 1.3, FLOAT_OPTS));
    expect(firstPeak).toBeGreaterThan(floatOffset(onset + 1.5, FLOAT_OPTS));
  });

  it('attenuates the first quarter period by exactly smoothStep(5/6)', () => {
    // smoothStep(1.25 / 1.5) = (25/36) * (4/3) = 100/108, exactly.
    const quarter = onset + FLOAT_OPTS.period / 4;
    expect(floatOffset(quarter, FLOAT_OPTS)).toBeCloseTo(
      FLOAT_OPTS.amplitude * (100 / 108),
      9
    );
  });

  it('still crosses centre at the half period', () => {
    const half = onset + FLOAT_OPTS.period / 2;
    expect(floatOffset(half, FLOAT_OPTS)).toBeCloseTo(0, 9);
  });

  it('reaches full amplitude once the ramp is over', () => {
    // 3.75 s past the onset the envelope has been clamped at 1 for 2.25 s, so
    // the trough is exactly -amplitude.
    const threeQuarters = onset + (3 * FLOAT_OPTS.period) / 4;
    expect(floatOffset(threeQuarters, FLOAT_OPTS)).toBeCloseTo(-FLOAT_OPTS.amplitude, 9);

    const secondCrest = onset + FLOAT_OPTS.period + FLOAT_OPTS.period / 4;
    expect(floatOffset(secondCrest, FLOAT_OPTS)).toBeCloseTo(FLOAT_OPTS.amplitude, 9);
  });

  it('never exceeds the amplitude, out to ten minutes', () => {
    for (let i = 0; i <= 1000; i += 1) {
      const t = (i / 1000) * 600;
      expect(Math.abs(floatOffset(t, FLOAT_OPTS))).toBeLessThanOrEqual(FLOAT_OPTS.amplitude);
    }
  });

  it('is continuous across its onset', () => {
    expect(floatOffset(onset + 1e-9, FLOAT_OPTS)).toBeCloseTo(0, 12);
  });

  it('is a strict generalisation: no ramp and no overlap is the bare sine', () => {
    const bare = { ...FLOAT_OPTS, overlap: 0, rampDuration: 1e-9 };
    for (const s of [0.5, 1.25, 2.5, 3.75, 7.5]) {
      expect(floatOffset(FLOAT_OPTS.duration + s, bare)).toBeCloseTo(
        FLOAT_OPTS.amplitude * Math.sin((2 * Math.PI * s) / FLOAT_OPTS.period),
        9
      );
    }
  });

  it('is already off centre when the entrance ends — the overlap, deliberately', () => {
    // Was exactly 0 before the overlap existed. 0.0277430 u is 6.76 px at
    // 1920x1080. The entrance still lands its own target endY exactly; this is
    // the float sitting on top of it.
    expect(floatOffset(FLOAT_OPTS.duration, FLOAT_OPTS)).toBeCloseTo(0.027743, 6);
  });

  it('starts before the entrance ends, not after', () => {
    expect(onset).toBeCloseTo(2.8, 12);
    expect(onset).toBeLessThan(FLOAT_OPTS.duration);
  });
});

// The FLOAT_OPTS above is a literal, so nothing in that block can catch the
// shipped constants drifting away from the behaviour it asserts. These are the
// cases that pin what the page actually does.
describe('the shipped float configuration', () => {
  const SHIPPED = { ...FLOAT, duration: ENTRANCE.duration };
  const onset = ENTRANCE.duration - FLOAT.overlap;

  it('ramps over 1.5 s and starts 0.65 s before the entrance ends', () => {
    expect(FLOAT.rampDuration).toBe(1.5);
    expect(FLOAT.overlap).toBe(0.65);
  });

  it('leaves the float 0.0233616 u off centre when the entrance ends', () => {
    expect(floatOffset(ENTRANCE.duration, SHIPPED)).toBeCloseTo(0.0233616, 6);
  });

  it('has zero velocity at the shipped onset, so nothing switches on', () => {
    const h = 1e-4;
    const velocity = (floatOffset(onset + h, SHIPPED) - floatOffset(onset, SHIPPED)) / h;
    expect(Math.abs(velocity)).toBeLessThan(1e-6);
  });

  it('overlaps the entrance rather than following it', () => {
    expect(onset).toBeLessThan(ENTRANCE.duration);
    expect(floatOffset(onset, SHIPPED)).toBe(0);
    expect(floatOffset(onset + 0.001, SHIPPED)).toBeGreaterThan(0);
  });
});
