export interface HorizontalProjectileMotion {
  x: number;
  y: number;
  direction: 1 | -1;
  speed: number;
}

/** Advance a projectile laterally while preserving its hand-authored release height. */
export function advanceHorizontalProjectile(
  projectile: HorizontalProjectileMotion,
  deltaMs: number
): Pick<HorizontalProjectileMotion, 'x' | 'y'> {
  return {
    x: projectile.x + projectile.direction * projectile.speed * (deltaMs / 1000),
    y: projectile.y
  };
}
