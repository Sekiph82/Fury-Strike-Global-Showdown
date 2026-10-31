export interface RisingArc {
  /** Initial upward velocity in world units per second. */
  velocityY: number;
  /** Gravity in world units per second squared. */
  gravity: number;
  /** Animation-frame index at the top of the arc. */
  peakFrame: number;
  /** Time in seconds from launch to the top of the arc. */
  peakTimeSeconds: number;
  /** Vertical travel from launch to the top of the arc. */
  peakHeight: number;
}

// Generic rising move heights. Signature moves can pass their own lower arc
// when their animation art is already tall enough to read on screen.
const TIER_PEAK_HEIGHTS = [560, 760, 960] as const;

/**
 * Resolve a ballistic rise so the peak aligns with the authored animation's
 * early rising pose while preserving distinct light/medium/heavy heights.
 */
export function resolveRisingArc(
  frameCount: number,
  frameRate: number,
  animationTimeScale: number,
  tier: 0 | 1 | 2,
  peakHeights: readonly [number, number, number] = TIER_PEAK_HEIGHTS
): RisingArc {
  const peakFrame = Math.max(1, Math.min(4.5, frameCount * 0.375));
  const peakTimeSeconds = peakFrame / Math.max(1, frameRate * animationTimeScale);
  const peakHeight = peakHeights[tier];

  return {
    velocityY: -(2 * peakHeight) / peakTimeSeconds,
    gravity: (2 * peakHeight) / (peakTimeSeconds * peakTimeSeconds),
    peakFrame,
    peakTimeSeconds,
    peakHeight
  };
}
