export interface ThrowTravelStep {
  x: number;
  remainingMs: number;
}

/** Resolve the victim's in-air somersault during a throw arc. */
export function resolveThrowRotation(progress: number, direction: 1 | -1): number {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  return direction * Math.sin(clampedProgress * Math.PI) * Math.PI;
}

/** The victim turns into the direction they are launched, away from the thrower. */
export function resolveThrownFacing(_previousFacing: 1 | -1, launchDirection: 1 | -1): 1 | -1 {
  return launchDirection;
}

/** Advances a thrown fighter away from the thrower for the authored travel window. */
export function advanceThrowTravel(
  x: number,
  direction: 1 | -1,
  speed: number,
  remainingMs: number,
  deltaMs: number
): ThrowTravelStep {
  const stepMs = Math.min(Math.max(0, remainingMs), Math.max(0, deltaMs));
  return {
    x: x + direction * speed * (stepMs / 1000),
    remainingMs: Math.max(0, remainingMs - stepMs)
  };
}
