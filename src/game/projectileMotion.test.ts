import { describe, expect, it } from 'vitest';
import { advanceHorizontalProjectile } from './projectileMotion';

describe('advanceHorizontalProjectile', () => {
  it.each([1, -1] as const)('moves horizontally toward direction %s without changing spawn height', (direction) => {
    const shot = { x: 480, y: 356, direction, speed: 560 };

    const afterFirstStep = advanceHorizontalProjectile(shot, 100);
    const afterSecondStep = advanceHorizontalProjectile({ ...shot, ...afterFirstStep }, 100);

    expect(afterFirstStep.x).toBe(480 + direction * 56);
    expect(afterSecondStep.x).toBe(480 + direction * 112);
    expect(afterFirstStep.y).toBe(356);
    expect(afterSecondStep.y).toBe(356);
  });
});
