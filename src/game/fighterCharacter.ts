import type { ImageAsset, SpritesheetAsset } from './assets';
import type { CharacterDefinition, HeroAnimationDefinition, HeroBoundsFrame } from './hero';
import type { Point, Rect } from './types';

const FRAME_WIDTH = 256;
const FRAME_HEIGHT = 256;
const SHEET_BASE = {
  kind: 'spritesheet' as const,
  frameWidth: FRAME_WIDTH,
  frameHeight: FRAME_HEIGHT,
  margin: 0,
  spacing: 0
};

const WEST_ANCHOR = { x: 0.5, y: 0.99609375 };
const WEST_ANCHOR_PIXELS = { x: 128, y: 255 };

/**
 * Per-action authoring metadata for a fighter: source spritesheet file, frame
 * count, playback rate, a default visual bounding box, and optional
 * attack-active frames. Bounds are placeholders refined in the Character Gym.
 */
export interface FighterActionSpec {
  action: string;
  label: string;
  file: string;
  /** Overrides the character-wide facing convention for this action sheet. */
  sourceFacing?: 'east' | 'west';
  frames: number;
  /** Scale and anchor overrides for an animation authored at a different cell resolution. */
  displayScale?: number;
  anchorX?: number;
  anchorY?: number;
  frameRate: number;
  repeat: number;
  defaultVisual: Rect;
  /** Source cell size; existing fighter sheets default to 256x256. */
  frameWidth?: number;
  frameHeight?: number;
  attack?: { frames: number[]; bounds: Rect };
  /**
   * Multiple distinct attack windows within one animation (each separated by
   * inactive frames). Used by specials so a single move lands several hits — the
   * combat layer treats every active span as its own connectable hit.
   */
  attackSpans?: { frames: number[]; bounds: Rect }[];
  guard?: Rect;
  /** Frame-local Hadouken origin; kept on each frame so animation timing can drive the projectile. */
  hadoukenSpawnPoint?: Point;
  /** Optional per-frame hand origins for sheets whose hands move during the cast. */
  hadoukenSpawnPoints?: Point[];
  /** Explicit release frame for sheets whose hands-forward pose is not the default frame. */
  hadoukenReleaseFrame?: number;
}

/**
 * Declarative description of a generated fighter: its id/label, where its public
 * spritesheets live, and the ordered action set to register.
 */
export interface FighterCharacterConfig {
  id: string;
  label: string;
  role?: CharacterDefinition['role'];
  /** Direction the authored character art faces before runtime mirroring. */
  facing?: CharacterDefinition['facing'];
  assetRoot: string;
  anchorUsage: string;
  anchorFile?: string;
  anchorWidth?: number;
  anchorHeight?: number;
  portraitFile?: string;
  portraitWidth?: number;
  portraitHeight?: number;
  actions: FighterActionSpec[];
}

/**
 * Build a complete `CharacterDefinition` (anchor + spritesheets + animations
 * with seeded per-frame bounds) for a generated fighter from its config.
 * @param config - The fighter's id, asset root, and per-action specs.
 */
export function buildFighterCharacter(config: FighterCharacterConfig): CharacterDefinition {
  const anchorAsset: ImageAsset = {
    kind: 'image',
    key: `${config.id}-anchor-w`,
    url: `${config.assetRoot}/${config.anchorFile ?? 'anchor-w.png'}`,
    width: config.anchorWidth ?? 1024,
    height: config.anchorHeight ?? 1024,
    usage: config.anchorUsage
  };

  const portrait: ImageAsset = {
    kind: 'image',
    key: `${config.id}-portrait`,
    url: `${config.assetRoot}/${config.portraitFile ?? 'portrait.png'}`,
    width: config.portraitWidth ?? 1254,
    height: config.portraitHeight ?? 1254,
    usage: `${config.label.toLowerCase()} character-select portrait`
  };

  const sheetsBySignature = new Map<string, SpritesheetAsset>();
  const sheetsByAction = new Map<string, SpritesheetAsset>();
  config.actions.forEach((spec) => {
    const frameWidth = spec.frameWidth ?? FRAME_WIDTH;
    const frameHeight = spec.frameHeight ?? FRAME_HEIGHT;
    const signature = `${spec.file}:${frameWidth}x${frameHeight}:${spec.frames}`;
    const existing = sheetsBySignature.get(signature);
    if (existing) {
      sheetsByAction.set(spec.action, existing);
      return;
    }

    const asset = sheet(
      `${config.id}-${spec.file.replace(/[^a-z0-9]+/gi, '-')}-${frameWidth}x${frameHeight}-${spec.frames}`,
      `${config.assetRoot}/${spec.file}`,
      spec.frames,
      frameWidth,
      frameHeight
    );
    sheetsBySignature.set(signature, asset);
    sheetsByAction.set(spec.action, asset);
  });

  const animations: HeroAnimationDefinition[] = config.actions.map((spec) =>
    makeAnimation(config.id, spec, requireActionSheet(sheetsByAction, spec.action))
  );

  return {
    id: config.id,
    label: config.label,
    role: config.role ?? 'player',
    anchor: WEST_ANCHOR,
    anchorPixels: WEST_ANCHOR_PIXELS,
    animations,
    anchorAsset,
    portrait,
    facing: config.facing,
    assets: [anchorAsset, portrait, ...sheetsBySignature.values()]
  };
}

/**
 * Derive the canonical animation key for a fighter action (e.g. `green-boxer-idle`).
 * @param characterId - The owning character id.
 * @param action - The action name.
 */
export function animationKey(characterId: string, action: string): string {
  return `${characterId}-${action}`;
}

/**
 * Construct a rectangle literal.
 * @param x - Left edge in frame pixels.
 * @param y - Top edge in frame pixels.
 * @param width - Width in pixels.
 * @param height - Height in pixels.
 */
export function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

/**
 * Build a spritesheet asset descriptor with the shared 256x256 frame layout.
 * @param key - Loader/animation key.
 * @param url - Public URL of the spritesheet.
 * @param frames - Frame count in the sheet.
 */
function sheet(
  key: string,
  url: string,
  frames: number,
  frameWidth = FRAME_WIDTH,
  frameHeight = FRAME_HEIGHT
): SpritesheetAsset {
  return { ...SHEET_BASE, key, url, frames, frameWidth, frameHeight };
}

/**
 * Build a hero animation definition from an action spec, seeding placeholder
 * collision/hit boxes from the default visual box and attack boxes on the
 * spec's active frames.
 * @param characterId - The owning character id.
 * @param spec - The action authoring metadata.
 * @param animationSheet - The resolved spritesheet descriptor for this action.
 */
function makeAnimation(
  characterId: string,
  spec: FighterActionSpec,
  animationSheet: SpritesheetAsset
): HeroAnimationDefinition {
  const key = animationKey(characterId, spec.action);
  const attackByFrame = buildAttackByFrame(spec);

  const bounds: HeroBoundsFrame[] = Array.from({ length: spec.frames }, (_, frame) => {
    const spawnPoint = spec.action === 'hadoken'
      ? spec.hadoukenSpawnPoints?.[frame] ?? spec.hadoukenSpawnPoint
      : undefined;

    const frameScaleX = animationSheet.frameWidth / FRAME_WIDTH;
    const frameScaleY = animationSheet.frameHeight / FRAME_HEIGHT;
    const baseVisual = {
      x: spec.defaultVisual.x / frameScaleX,
      y: spec.defaultVisual.y / frameScaleY,
      width: spec.defaultVisual.width / frameScaleX,
      height: spec.defaultVisual.height / frameScaleY
    };

    return {
    frame,
    ...(spawnPoint ? { hadoukenSpawnPoint: { ...spawnPoint } } : {}),
    visual: { ...spec.defaultVisual },
    collision: scaleFrameRect(collisionBounds(baseVisual, FRAME_WIDTH, FRAME_HEIGHT), frameScaleX, frameScaleY),
    hit: scaleFrameRect(hitBounds(baseVisual, FRAME_WIDTH, FRAME_HEIGHT), frameScaleX, frameScaleY),
    attack: attackByFrame.get(frame) ?? null,
    guard: spec.guard ? { ...spec.guard } : null
  };
  });

  return {
    id: key,
    characterId,
    action: spec.action,
    label: spec.label,
    key,
    sheet: animationSheet,
    frameRate: spec.frameRate,
    repeat: spec.repeat,
    ...(spec.displayScale !== undefined ? { displayScale: spec.displayScale } : {}),
    ...(spec.anchorX !== undefined ? { anchorX: spec.anchorX } : {}),
    ...(spec.anchorY !== undefined ? { anchorY: spec.anchorY } : {}),
    ...(spec.sourceFacing ? { sourceFacing: spec.sourceFacing } : {}),
    ...(spec.hadoukenReleaseFrame !== undefined ? { hadoukenReleaseFrame: spec.hadoukenReleaseFrame } : {}),
    bounds
  };
}

function scaleFrameRect(rectangle: Rect, scaleX: number, scaleY: number): Rect {
  return {
    x: Math.round(rectangle.x * scaleX),
    y: Math.round(rectangle.y * scaleY),
    width: Math.round(rectangle.width * scaleX),
    height: Math.round(rectangle.height * scaleY)
  };
}

/**
 * Build a frame -> attack-rect map from an action's single attack window and/or
 * its multi-window `attackSpans` (later spans win on overlapping frames).
 * @param spec - The action authoring metadata.
 */
function buildAttackByFrame(spec: FighterActionSpec): Map<number, Rect> {
  const attackByFrame = new Map<number, Rect>();

  if (spec.attack) {
    spec.attack.frames.forEach((frame) => attackByFrame.set(frame, spec.attack!.bounds));
  }

  (spec.attackSpans ?? []).forEach((span) => {
    span.frames.forEach((frame) => attackByFrame.set(frame, span.bounds));
  });

  return attackByFrame;
}

/**
 * Look up the spritesheet descriptor for an animation key, throwing if missing.
 * @param sheets - Candidate spritesheets.
 * @param key - The animation key to resolve.
 */
function requireActionSheet(sheetsByAction: Map<string, SpritesheetAsset>, action: string): SpritesheetAsset {
  const found = sheetsByAction.get(action);

  if (!found) {
    throw new Error(`Missing fighter spritesheet metadata for action ${action}`);
  }

  return found;
}

/**
 * Derive a centered collision box from a visual box, anchored to the feet.
 * @param visual - The visual bounding box.
 */
function collisionBounds(visual: Rect, frameWidth: number, frameHeight: number): Rect {
  const width = Math.min(58, Math.max(34, Math.round(visual.width * 0.46)));
  const height = Math.max(74, Math.round(visual.height * 0.82));

  return {
    x: Math.round(frameWidth / 2 - width / 2),
    y: Math.round(frameHeight - 26 - height),
    width,
    height
  };
}

/**
 * Derive a slightly padded hurtbox from a visual box.
 * @param visual - The visual bounding box.
 */
function hitBounds(visual: Rect, frameWidth: number, frameHeight: number): Rect {
  return {
    x: Math.max(0, visual.x - 4),
    y: Math.max(0, visual.y + 2),
    width: Math.min(frameWidth, visual.width + 8),
    height: Math.min(frameHeight, visual.height)
  };
}
