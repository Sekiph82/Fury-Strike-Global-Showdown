import { describe, expect, it } from 'vitest';
import { advanceThrowTravel, resolveThrowRotation, resolveThrownFacing } from './throwMotion';

describe('advanceThrowTravel', () => {
  it.each([1, -1] as const)('moves the defender away in direction %s through the throw arc', (direction) => {
    let x = 480;
    let remainingMs = 620;

    for (let frame = 0; frame < 62; frame += 1) {
      const step = advanceThrowTravel(x, direction, 360, remainingMs, 10);
      x = step.x;
      remainingMs = step.remainingMs;
    }

    expect(x).toBeCloseTo(480 + direction * 223.2);
    expect(remainingMs).toBe(0);
  });

  it('stops at the end of the throw window when a frame delta overruns it', () => {
    expect(advanceThrowTravel(100, 1, 360, 25, 100)).toEqual({ x: 109, remainingMs: 0 });
  });
});

describe('resolveThrownFacing', () => {
  it.each([1, -1] as const)('turns the victim toward launch direction %s', (launchDirection) => {
    const previousFacing = (-launchDirection) as 1 | -1;
    expect(resolveThrownFacing(previousFacing, launchDirection)).toBe(launchDirection);
    expect(resolveThrownFacing(previousFacing, launchDirection)).not.toBe(previousFacing);
  });
});

describe('resolveThrowRotation', () => {
  it.each([1, -1] as const)('performs a directional half-turn for launch direction %s', (direction) => {
    expect(resolveThrowRotation(0, direction)).toBeCloseTo(0);
    expect(resolveThrowRotation(0.5, direction)).toBeCloseTo(direction * Math.PI);
    expect(resolveThrowRotation(1, direction)).toBeCloseTo(0);
  });

  it('clamps progress outside the throw arc', () => {
    expect(resolveThrowRotation(-0.2, 1)).toBeCloseTo(0);
    expect(resolveThrowRotation(1.2, -1)).toBeCloseTo(0);
  });
});
