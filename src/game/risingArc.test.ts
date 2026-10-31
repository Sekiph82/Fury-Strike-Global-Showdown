import { describe, expect, it } from 'vitest';

import { resolveRisingArc } from './risingArc';

describe('resolveRisingArc', () => {
  it('peaks between frames 4 and 5 for each Shoryuken strength', () => {
    const animationTimeScales = [600 / 700, 600 / 833, 600 / 900] as const;

    animationTimeScales.forEach((timeScale, tier) => {
      const arc = resolveRisingArc(12, 20, timeScale, tier as 0 | 1 | 2);
      const frameReachedAtPeak = arc.peakTimeSeconds * 20 * timeScale;
      const displacementAtPeak = arc.velocityY * arc.peakTimeSeconds +
        0.5 * arc.gravity * arc.peakTimeSeconds * arc.peakTimeSeconds;
      const velocityAtPeak = arc.velocityY + arc.gravity * arc.peakTimeSeconds;

      expect(arc.peakFrame).toBe(4.5);
      expect(frameReachedAtPeak).toBeCloseTo(4.5);
      expect(displacementAtPeak).toBeCloseTo(-arc.peakHeight);
      expect(velocityAtPeak).toBeCloseTo(0);
    });
  });

  it('scales the peak position to shorter custom move sheets', () => {
    const arc = resolveRisingArc(4, 14, 1, 1);

    expect(arc.peakFrame).toBe(1.5);
    expect(arc.peakTimeSeconds * 14).toBeCloseTo(1.5);
    expect(arc.peakHeight).toBe(760);
  });

  it('keeps distinct tiers while giving the strongest Shoryuken more vertical travel', () => {
    const peaks = ([0, 1, 2] as const).map((tier) => resolveRisingArc(12, 20, 1, tier).peakHeight);

    expect(peaks).toEqual([560, 760, 960]);
  });

  it('keeps the Spinning Bird Kick lift below a full Shoryuken arc', () => {
    const peaks = ([0, 1, 2] as const).map((tier) =>
      resolveRisingArc(4, 14, 1, tier, [330, 410, 490]).peakHeight
    );

    expect(peaks).toEqual([330, 410, 490]);
    expect(peaks.every((height) => height < 560)).toBe(true);
  });
});
