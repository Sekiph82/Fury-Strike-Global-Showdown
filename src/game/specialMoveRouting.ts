import type { FighterSpecialMove } from './types';

export type RisingAnimationAction = 'shoryuken' | 'tatsumaki' | 'head-press' | 'special' | 'spinning-bird-kick';

const RISING_SPECIAL_NAMES = new Set([
  'Shoryuken',
  'Flash Kick',
  'Spinning Bird Kick',
  'Tiger Uppercut',
  'Head Press'
]);

/**
 * Internal move families are shared by several named moves. Prefer the move's
 * actual command name when deciding whether it should use a rising arc.
 */
export function isRisingSpecialMove(move: FighterSpecialMove, name: string | null): boolean {
  return name === null ? move === 'shoryuken' : RISING_SPECIAL_NAMES.has(name);
}

/** Pick the character-authored pose for named rising moves where a signature sheet exists. */
export function resolveRisingAnimationAction(characterId: string, name: string | null): RisingAnimationAction {
  if (name === 'Head Press' && characterId === 'darius-quell') return 'head-press';
  if (name === 'Flash Kick' && characterId === 'mira-kestrel') return 'special';
  if (name === 'Spinning Bird Kick' && (characterId === 'nera-volt' || characterId === 'sora-keene')) {
    return 'spinning-bird-kick';
  }
  return 'shoryuken';
}
