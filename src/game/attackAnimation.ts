import type { AttackKind, NormalAttackId } from './types';

/** Resolve a normal attack's pose without turning light crouch kicks into sweeps. */
export function resolveNormalAttackAction(
  move: NormalAttackId,
  crouching: boolean,
  grounded: boolean
): NormalAttackId | 'jump-kick' | 'low-sweep' {
  if (!grounded && move.endsWith('kick')) return 'jump-kick';
  if (grounded && crouching && move === 'heavy-kick') return 'low-sweep';
  return move;
}

/** A sweep only knocks down when it came from the grounded heavy-kick action. */
export function shouldKnockdownFromSweep(isSweepPose: boolean, attack: AttackKind): boolean {
  return isSweepPose && attack === 'heavy-kick';
}

/** A special hit can re-arm after recovery frames before a later active span. */
export function hasAttackWindowAfterGap(activeFrames: readonly boolean[], currentFrame: number): boolean {
  const nextActiveFrame = activeFrames.findIndex((active, index) => index > currentFrame && active);
  return nextActiveFrame > currentFrame + 1;
}
