import type { Point } from './types';

export interface PointTransform {
  transformPoint(x: number, y: number): Point;
}

const EAST_AUTHORED_MOVE_ACTIONS = new Set([
  'light-punch', 'medium-punch', 'heavy-punch',
  'light-kick', 'medium-kick', 'heavy-kick', 'low-sweep', 'jump-kick',
  'hadoken', 'shoryuken', 'tatsumaki', 'throw', 'special', 'special-charge'
]);

/** Resolve each animation's art convention independently from the fighter's current facing. */
export function resolveAnimationSourceFacing(
  characterId: string,
  action: string,
  explicitFacing?: 'east' | 'west',
  characterFacing?: 'east' | 'west'
): 'east' | 'west' {
  if (explicitFacing) return explicitFacing;
  if (EAST_AUTHORED_MOVE_ACTIONS.has(action)) {
    // Jiu-Jitsu's original punch/move sheets were authored facing west.
    return characterId === 'jiujitsu-fighter' ? 'west' : 'east';
  }
  return characterFacing ?? 'west';
}

/** Returns whether source art must be mirrored to face the opponent. */
export function shouldFlipForFacing(sourceFacing: 'east' | 'west', facing: 1 | -1): boolean {
  return sourceFacing === 'east' ? facing === -1 : facing === 1;
}

/** Converts a source-frame coordinate into the sprite's world coordinates. */
export function transformFramePointToWorld(
  point: Point,
  frameWidth: number,
  displayOriginX: number,
  displayOriginY: number,
  flipped: boolean,
  worldTransform: PointTransform
): Point {
  const mirroredX = flipped ? frameWidth - point.x : point.x;
  return worldTransform.transformPoint(mirroredX - displayOriginX, point.y - displayOriginY);
}

/** Maps an authored source-frame point through a sprite pose into scene coordinates. */
export function transformFramePointAtPose(
  point: Point,
  frameWidth: number,
  frameHeight: number,
  anchorX: number,
  anchorY: number,
  flipped: boolean,
  root: Point,
  scaleX: number,
  scaleY: number,
  rotation = 0
): Point {
  const mirroredX = flipped ? frameWidth - point.x : point.x;
  const localX = (mirroredX - frameWidth * anchorX) * scaleX;
  const localY = (point.y - frameHeight * anchorY) * scaleY;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return {
    x: root.x + localX * cos - localY * sin,
    y: root.y + localX * sin + localY * cos
  };
}
