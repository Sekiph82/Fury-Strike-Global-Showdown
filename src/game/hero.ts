import type { CharacterBoundsKind, CharacterGymBoundsOverrides, Point, Rect } from './types';
import type { ImageAsset, SpritesheetAsset } from './assets';
import { RED_BRAWLER_CHARACTER } from './redBrawler';
import { GREEN_BOXER_CHARACTER } from './greenBoxer';
import { JIUJITSU_FIGHTER_CHARACTER } from './jiujitsuFighter';
import { MIRA_KESTREL_CHARACTER } from './miraKestrel';
import { TALA_EMBER_CHARACTER } from './talaEmber';
import { NERA_VOLT_CHARACTER } from './neraVolt';
import { KAVI_DAMAR_CHARACTER } from './kaviDamar';
import { ZOLA_NYX_CHARACTER } from './zolaNyx';
import { ROOK_CALDER_CHARACTER } from './rookCalder';
import { TOMAS_RILL_CHARACTER } from './tomasRill';
import { SORA_KEENE_CHARACTER } from './soraKeene';
import { IMANI_RUSK_CHARACTER } from './imaniRusk';
import { MILO_VANCE_CHARACTER } from './miloVance';
import { ANIKA_VALE_CHARACTER } from './anikaVale';
import { DARIUS_QUELL_CHARACTER } from './dariusQuell';

export interface HeroBoundsFrame {
  frame: number;
  /** Source-frame coordinate where the Hadouken projectile centre leaves the joined hands. */
  hadoukenSpawnPoint?: HadoukenSpawnPoint;
  visual: Rect;
  collision: Rect | null;
  hit: Rect | null;
  attack: Rect | null;
  /**
   * The region this pose protects while blocking. Authored on the block
   * animations (upper-body box on block-high, lower-body box on block-low) and
   * null elsewhere. An attack is blocked when its hitbox overlaps the
   * defender's active guard box.
   */
  guard: Rect | null;
}

/** Frame-local coordinate for the projectile's hand-aligned spawn reference. */
export interface HadoukenSpawnPoint extends Point {}

export interface HeroAnimationDefinition {
  id: string;
  characterId: string;
  action: string;
  label: string;
  key: string;
  sheet: SpritesheetAsset;
  frameRate: number;
  repeat: number;
  /** Per-animation sprite scale multiplier for sheets authored at a different resolution. */
  displayScale?: number;
  /** Optional normalized horizontal anchor for an asymmetric source-frame layout. */
  anchorX?: number;
  /** Optional normalized vertical anchor for an animation's source-frame layout. */
  anchorY?: number;
  /** Direction the source artwork faces before runtime mirroring. */
  sourceFacing?: 'east' | 'west';
  /** Authored animation frame where both hands reach the projectile release pose. */
  hadoukenReleaseFrame?: number;
  bounds: HeroBoundsFrame[];
}

export interface CharacterDefinition {
  id: string;
  label: string;
  role: 'player' | 'enemy';
  /** Direction the source artwork faces before runtime mirroring. */
  facing?: 'east' | 'west';
  anchor: { x: number; y: number };
  anchorPixels: { x: number; y: number };
  animations: HeroAnimationDefinition[];
  anchorAsset: ImageAsset;
  portrait: ImageAsset;
  assets: Array<ImageAsset | SpritesheetAsset>;
}

export const CHARACTER_DEFINITIONS: CharacterDefinition[] = [
  RED_BRAWLER_CHARACTER,
  GREEN_BOXER_CHARACTER,
  JIUJITSU_FIGHTER_CHARACTER,
  MIRA_KESTREL_CHARACTER,
  TALA_EMBER_CHARACTER,
  NERA_VOLT_CHARACTER,
  KAVI_DAMAR_CHARACTER,
  ZOLA_NYX_CHARACTER,
  ROOK_CALDER_CHARACTER,
  TOMAS_RILL_CHARACTER,
  SORA_KEENE_CHARACTER,
  IMANI_RUSK_CHARACTER,
  MILO_VANCE_CHARACTER,
  ANIKA_VALE_CHARACTER,
  DARIUS_QUELL_CHARACTER
];

// Place each roster's idle feet on the shared ground line. The source sheets
// have different transparent bottom margins, so use the first idle cell's
// measured alpha edge instead of assuming all artists used the same pivot.
const IDLE_FOOT_ANCHORS: Readonly<Record<string, { y: number; cellHeight: number }>> = {
  'red-brawler': { y: 230, cellHeight: 256 },
  'green-boxer': { y: 231, cellHeight: 256 },
  'jiujitsu-fighter': { y: 230, cellHeight: 256 },
  'mira-kestrel': { y: 313, cellHeight: 313 },
  'tala-ember': { y: 288, cellHeight: 300 },
  'nera-volt': { y: 300, cellHeight: 313 },
  'kavi-damar': { y: 300, cellHeight: 313 },
  'zola-nyx': { y: 300, cellHeight: 313 },
  'rook-calder': { y: 300, cellHeight: 313 },
  'tomas-rill': { y: 300, cellHeight: 313 },
  'sora-keene': { y: 300, cellHeight: 313 },
  'imani-rusk': { y: 300, cellHeight: 313 },
  'milo-vance': { y: 300, cellHeight: 313 },
  'anika-vale': { y: 300, cellHeight: 313 },
  'darius-quell': { y: 300, cellHeight: 313 }
};
CHARACTER_DEFINITIONS.forEach((character) => {
  const anchor = IDLE_FOOT_ANCHORS[character.id];
  if (!anchor) return;
  character.anchor.y = anchor.y / anchor.cellHeight;
  character.anchorPixels.y = anchor.y;
});

// Every playable fighter has character-specific elemental reaction artwork in
// its reactions/ folder. Some character declarations predate those assets, so
// add the missing animation descriptors here rather than silently falling back
// to the generic hit pose when an elemental move connects.
const ELEMENTS = ['fire', 'ice', 'wind', 'electric', 'water'] as const;
const ELEMENT_REACTION_FRAME = { width: 512, height: 512 };
const ELEMENT_REACTION_DISPLAY_SCALE = 0.5;

CHARACTER_DEFINITIONS.forEach((character) => {
  const ordinaryHit = character.animations.find((animation) => animation.action === 'hit-high');
  if (!ordinaryHit) return;

  ELEMENTS.forEach((element) => {
    if (character.animations.some((animation) => animation.action === `hit-${element}`)) return;

    const key = `${character.id}-hit-${element}`;
    const sheet: SpritesheetAsset = {
      kind: 'spritesheet',
      key: `${key}-512x512-1`,
      url: `/assets/${character.id}/reactions/hit-${element}.png`,
      frameWidth: ELEMENT_REACTION_FRAME.width,
      frameHeight: ELEMENT_REACTION_FRAME.height,
      frames: 1,
      margin: 0,
      spacing: 0
    };
    const sourceToReactionScale = (ordinaryHit.displayScale ?? 1) / ELEMENT_REACTION_DISPLAY_SCALE;
    const sourceBounds = ordinaryHit.bounds[0];
    const scaleRect = (value: Rect | null): Rect | null => value
      ? {
          x: Math.round(value.x * sourceToReactionScale),
          y: Math.round(value.y * sourceToReactionScale),
          width: Math.round(value.width * sourceToReactionScale),
          height: Math.round(value.height * sourceToReactionScale)
        }
      : null;

    character.animations.push({
      id: key,
      characterId: character.id,
      action: `hit-${element}`,
      label: `${element[0].toUpperCase()}${element.slice(1)} Hit Reaction`,
      key,
      sheet,
      frameRate: 10,
      repeat: 0,
      displayScale: ELEMENT_REACTION_DISPLAY_SCALE,
      anchorY: ordinaryHit.anchorY ?? character.anchor.y,
      sourceFacing: ordinaryHit.sourceFacing ?? character.facing ?? 'west',
      bounds: [{
        frame: 0,
        visual: scaleRect(sourceBounds.visual)!,
        collision: scaleRect(sourceBounds.collision),
        hit: scaleRect(sourceBounds.hit),
        attack: null,
        guard: null
      }]
    });
    character.assets.push(sheet);
  });
});

// Each roster fighter has a dedicated transparent result portrait. These are
// individual files (not frames taken from the combat knockdown sheets).
CHARACTER_DEFINITIONS.forEach((character) => {
  character.assets.push({
    kind: 'image',
    key: `${character.id}-defeated-portrait`,
    url: `/assets/${character.id}/defeated-portrait.png`,
    usage: `${character.label} post-match defeated portrait`
  });
});

/**
 * Characters authored with the full fighter action set (they include a
 * `knockdown` action). These are the selectable roster in the Fighter
 * Playground; the Character Gym still lists every character.
 */
export const FIGHTER_CHARACTER_DEFINITIONS: CharacterDefinition[] = CHARACTER_DEFINITIONS.filter(
  (character) => character.animations.some((animation) => animation.action === 'knockdown')
);

/**
 * Resolve a fighter animation key by character + action name, returning null
 * when the character has no animation for that action.
 * @param characterId - The owning character id.
 * @param action - The action name (e.g. `heavy-kick`).
 */
export function findCharacterAnimationKeyByAction(characterId: string, action: string): string | null {
  const character = getCharacterDefinition(characterId);
  const animation = character.animations.find((candidate) => candidate.action === action);

  return animation ? animation.key : null;
}

export const CHARACTER_ANIMATIONS = CHARACTER_DEFINITIONS.flatMap((character) => character.animations);
export const CHARACTER_ASSETS = CHARACTER_DEFINITIONS.flatMap((character) => character.assets);
export const HERO_ASSETS = CHARACTER_ASSETS;

export function getHeroAnimationDefinition(animationKey: string): HeroAnimationDefinition {
  return CHARACTER_ANIMATIONS.find((animation) => animation.key === animationKey) ?? CHARACTER_ANIMATIONS[0];
}

export function getCharacterDefinition(characterId: string): CharacterDefinition {
  return CHARACTER_DEFINITIONS.find((character) => character.id === characterId) ?? CHARACTER_DEFINITIONS[0];
}

export function getCharacterAnimationDefinition(
  characterId: string,
  animationKey: string
): HeroAnimationDefinition {
  const character = getCharacterDefinition(characterId);

  return character.animations.find((animation) => animation.key === animationKey) ?? character.animations[0];
}

export function getCharacterAnimationByAction(characterId: string, action: string): HeroAnimationDefinition {
  const character = getCharacterDefinition(characterId);

  return character.animations.find((animation) => animation.action === action) ?? character.animations[0];
}

export function getCharacterIdForAnimation(animationKey: string): string {
  return getHeroAnimationDefinition(animationKey).characterId;
}

export function isCharacterId(value: unknown): value is string {
  return typeof value === 'string' && CHARACTER_DEFINITIONS.some((character) => character.id === value);
}

export function resolveHeroBoundsFrame(
  animation: HeroAnimationDefinition,
  frameIndex: number,
  overrides: CharacterGymBoundsOverrides
): HeroBoundsFrame {
  const clampedFrame = PhaserClamp(frameIndex, 0, animation.bounds.length - 1);
  const baseFrame = animation.bounds[clampedFrame] ?? animation.bounds[0];
  const frameOverrides = overrides[animation.key]?.[clampedFrame];

  if (!frameOverrides) {
    return baseFrame;
  }

  return {
    frame: clampedFrame,
    visual: frameOverrides.visual ? rectFromEdit(frameOverrides.visual) : baseFrame.visual,
    collision: resolveOptionalBounds('collision', baseFrame, frameOverrides),
    hit: resolveOptionalBounds('hit', baseFrame, frameOverrides),
    attack: resolveOptionalBounds('attack', baseFrame, frameOverrides),
    guard: resolveOptionalBounds('guard', baseFrame, frameOverrides)
  };
}

export function defaultHeroBoundsForActivation(frame: HeroBoundsFrame, kind: CharacterBoundsKind): Rect {
  const currentBounds = frame[kind];

  if (currentBounds) {
    return currentBounds;
  }

  if (kind === 'attack') {
    return rect(28, 86, 76, 48);
  }

  if (kind === 'guard') {
    return rect(64, 48, 128, 112);
  }

  return frame.visual;
}

function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

function rectFromEdit(edit: Rect): Rect {
  return rect(edit.x, edit.y, edit.width, edit.height);
}

function resolveOptionalBounds(
  kind: Exclude<CharacterBoundsKind, 'visual'>,
  baseFrame: HeroBoundsFrame,
  frameOverrides: Partial<Record<CharacterBoundsKind, Rect & { active: boolean }>>
): Rect | null {
  const override = frameOverrides[kind];

  if (!override) {
    return baseFrame[kind];
  }

  return override.active ? rectFromEdit(override) : null;
}

function PhaserClamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
