import type { ImageAsset, SpritesheetAsset } from './assets';
import type { CharacterDefinition, HeroAnimationDefinition, HeroBoundsFrame } from './hero';
import type { Rect } from './types';

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

const ASSET_ROOT = '/assets/red-brawler';

export const RED_BRAWLER_CHARACTER_ID = 'red-brawler';

export const RED_BRAWLER_ANIMATION_KEYS = {
  idle: 'red-brawler-idle',
  walkForward: 'red-brawler-walk-forward',
  walkBackward: 'red-brawler-walk-backward',
  crouch: 'red-brawler-crouch',
  jump: 'red-brawler-jump',
  blockHigh: 'red-brawler-block-high',
  blockLow: 'red-brawler-block-low',
  hitHigh: 'red-brawler-hit-high',
  lightPunch: 'red-brawler-light-punch',
  mediumPunch: 'red-brawler-medium-punch',
  heavyPunch: 'red-brawler-heavy-punch',
  lightKick: 'red-brawler-light-kick',
  mediumKick: 'red-brawler-medium-kick',
  heavyKick: 'red-brawler-heavy-kick',
  lowSweep: 'red-brawler-low-sweep',
  jumpKick: 'red-brawler-jump-kick',
  hadoken: 'red-brawler-hadoken',
  shoryuken: 'red-brawler-shoryuken',
  tatsumaki: 'red-brawler-tatsumaki',
  throwMove: 'red-brawler-throw',
  throwReaction: 'red-brawler-thrown',
  specialCharge: 'red-brawler-special-charge',
  special: 'red-brawler-special',
  knockdown: 'red-brawler-knockdown'
} as const;

export const RED_BRAWLER_ANCHOR_ASSET: ImageAsset = {
  kind: 'image',
  key: 'red-brawler-anchor-w',
  url: `${ASSET_ROOT}/anchor-w.png`,
  width: 1024,
  height: 1024,
  usage: 'red-jacket brawler west-facing high-fidelity anchor'
};

export const RED_BRAWLER_PORTRAIT_ASSET: ImageAsset = {
  kind: 'image',
  key: 'red-brawler-portrait',
  url: `${ASSET_ROOT}/portrait.png`,
  width: 1254,
  height: 1254,
  usage: 'red brawler character-select portrait'
};

/**
 * Per-action authoring metadata: spritesheet key, file, frame count, playback
 * rate, a default visual bounding box, and optional attack-active frames.
 */
interface RedBrawlerActionSpec {
  key: string;
  action: string;
  label: string;
  file: string;
  frames: number;
  frameWidth?: number;
  frameHeight?: number;
  displayScale?: number;
  anchorY?: number;
  frameRate: number;
  repeat: number;
  sourceFacing?: 'east' | 'west';
  defaultVisual: Rect;
  attack?: { frames: number[]; bounds: Rect };
  /** Multiple attack windows in one animation (specials); each lands its own hit. */
  attackSpans?: { frames: number[]; bounds: Rect }[];
  guard?: Rect;
  hadoukenSpawnPoint?: { x: number; y: number };
  hadoukenSpawnPoints?: { x: number; y: number }[];
  hadoukenReleaseFrame?: number;
}

const RED_BRAWLER_ACTIONS: RedBrawlerActionSpec[] = [
  {
    key: RED_BRAWLER_ANIMATION_KEYS.idle,
    action: 'idle',
    label: 'Idle',
    file: 'idle.png',
    frames: 12,
    frameRate: 8,
    repeat: -1,
    defaultVisual: rect(76, 28, 104, 204)
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.walkForward,
    action: 'walk-forward',
    label: 'Walk Forward',
    file: 'walk-forward.png',
    frames: 8,
    frameRate: 8,
    repeat: -1,
    defaultVisual: rect(72, 28, 112, 204)
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.walkBackward,
    action: 'walk-backward',
    label: 'Walk Backward',
    file: 'walk-backward.png',
    frames: 8,
    frameRate: 8,
    repeat: -1,
    defaultVisual: rect(72, 28, 112, 204)
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.crouch,
    action: 'crouch',
    label: 'Crouch',
    file: 'crouch.png',
    frames: 5,
    frameRate: 10,
    repeat: 0,
    defaultVisual: rect(72, 104, 112, 126)
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.jump,
    action: 'jump',
    label: 'Jump',
    file: 'jump.png',
    frames: 8,
    frameRate: 10,
    repeat: 0,
    defaultVisual: rect(70, 16, 116, 206)
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.blockHigh,
    action: 'block-high',
    label: 'Block High',
    file: 'block-high.png',
    frames: 4,
    frameRate: 10,
    repeat: 0,
    defaultVisual: rect(76, 28, 104, 204),
    guard: rect(60, 44, 136, 116)
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.blockLow,
    action: 'block-low',
    label: 'Block Low',
    file: 'block-low.png',
    frames: 4,
    frameRate: 10,
    repeat: 0,
    defaultVisual: rect(72, 104, 112, 126),
    guard: rect(60, 110, 136, 120)
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.hitHigh,
    action: 'hit-high',
    label: 'Hit High',
    file: 'hit-high-6cell.png',
    frames: 6,
    sourceFacing: 'east',
    frameWidth: 512,
    frameHeight: 512,
    displayScale: 0.5,
    anchorY: WEST_ANCHOR.y,
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(144, 56, 224, 408)
  },
  ...(['fire', 'ice', 'wind', 'electric', 'water'] as const).map((element): RedBrawlerActionSpec => ({
    key: `red-brawler-hit-${element}`,
    action: `hit-${element}`,
    label: `${element[0].toUpperCase()}${element.slice(1)} Hit Reaction`,
    file: `reactions/hit-${element}.png`,
    frames: 1,
    sourceFacing: 'east',
    frameWidth: 512,
    frameHeight: 512,
    displayScale: 0.5,
    anchorY: WEST_ANCHOR.y,
    frameRate: 10,
    repeat: 0,
    defaultVisual: rect(144, 56, 224, 408)
  })),
  {
    key: RED_BRAWLER_ANIMATION_KEYS.lightPunch,
    action: 'light-punch',
    label: 'Light Punch',
    file: 'moves/punch-light.png',
    frames: 6,
    frameRate: 14,
    repeat: 0,
    defaultVisual: rect(60, 28, 128, 204),
    attack: { frames: [2, 3], bounds: rect(136, 84, 84, 46) }
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.mediumPunch,
    action: 'medium-punch',
    label: 'Medium Punch',
    file: 'moves/punch-medium.png',
    frames: 6,
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(28, 24, 200, 220),
    attack: { frames: [2, 3], bounds: rect(136, 82, 112, 60) }
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.heavyPunch,
    action: 'heavy-punch',
    label: 'Heavy Punch',
    file: 'moves/punch-heavy.png',
    frames: 6,
    frameRate: 10,
    repeat: 0,
    defaultVisual: rect(28, 24, 200, 220),
    attack: { frames: [2, 3], bounds: rect(132, 70, 124, 76) }
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.lightKick,
    action: 'light-kick',
    label: 'Light Kick',
    file: 'moves/kick-light.png',
    frames: 6,
    frameRate: 14,
    repeat: 0,
    defaultVisual: rect(28, 24, 200, 220),
    attack: { frames: [2, 3], bounds: rect(4, 128, 124, 58) }
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.mediumKick,
    action: 'medium-kick',
    label: 'Medium Kick',
    file: 'moves/kick-medium.png',
    frames: 6,
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(28, 24, 200, 220),
    attack: { frames: [2, 3], bounds: rect(0, 108, 132, 72) }
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.heavyKick,
    action: 'heavy-kick',
    label: 'Heavy Kick',
    file: 'moves/kick-heavy.png',
    frames: 6,
    frameRate: 10,
    repeat: 0,
    defaultVisual: rect(28, 24, 200, 220),
    attack: { frames: [2, 3], bounds: rect(0, 78, 136, 102) }
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.lowSweep,
    action: 'low-sweep',
    label: 'Crouching Sweep Kick',
    file: 'moves/kick-sweep.png',
    frames: 6,
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(0, 24, 256, 232),
    attack: { frames: [3], bounds: rect(4, 148, 244, 92) }
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.jumpKick,
    action: 'jump-kick',
    label: 'Airborne Forward Kick',
    file: 'moves/jump-kick.png',
    frames: 6,
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(16, 24, 224, 220),
    attack: { frames: [2, 3, 4], bounds: rect(0, 84, 174, 96) }
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.hadoken,
    action: 'hadoken',
    label: 'Hadoken',
    file: 'moves/hadoken-cast-fire-12-grid.png',
    sourceFacing: 'east',
    frames: 12,
    frameWidth: 384,
    frameHeight: 341,
    displayScale: 0.75,
    anchorY: WEST_ANCHOR.y,
    frameRate: 20,
    repeat: 0,
    defaultVisual: rect(36, 48, 312, 280),
    // Source-frame pixel at the joined palms in release frame 4.
    // Palm center on release frame 4 (hands-forward pose) in the source cell.
    hadoukenSpawnPoint: { x: 295, y: 157 },
    hadoukenReleaseFrame: 4
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.shoryuken,
    action: 'shoryuken',
    label: 'Shoryuken',
    file: 'moves/shoryuken-blue-12.png',
    frames: 12,
    frameWidth: 362,
    frameHeight: 362,
    displayScale: 256 / 362,
    sourceFacing: 'east',
    frameRate: 20,
    repeat: 0,
    defaultVisual: rect(28, 17, 306, 328),
    attack: { frames: [4, 5, 6, 7], bounds: rect(14, 34, 238, 240) }
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.tatsumaki,
    action: 'tatsumaki',
    label: 'Tatsumaki Senpukyaku',
    file: 'moves/tatsumaki-12.png',
    frames: 12,
    frameRate: 20,
    repeat: 0,
    defaultVisual: rect(12, 28, 232, 216),
    attackSpans: [
      { frames: [3, 4], bounds: rect(4, 80, 220, 112) },
      { frames: [6, 7], bounds: rect(0, 72, 224, 124) },
      { frames: [9, 10], bounds: rect(0, 72, 224, 124) }
    ]
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.throwMove,
    action: 'throw',
    label: 'Throw',
    file: 'moves/throw.png',
    frames: 6,
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(24, 20, 208, 224)
  },
  // Special "Cyclone Uppercut": a rising spinning uppercut. The charge is the
  // loaded wind-up; the execution rises through three rotating hits (the last is
  // the launching finisher). Attack spans skip the early load + a transitional
  // frame; refine bounds in the Character Gym.
  {
    key: RED_BRAWLER_ANIMATION_KEYS.specialCharge,
    action: 'special-charge',
    label: 'Special Charge',
    file: 'special-charge.png',
    frames: 5,
    frameRate: 14,
    repeat: 0,
    defaultVisual: rect(64, 80, 128, 150)
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.special,
    action: 'special',
    label: 'Cyclone Uppercut',
    file: 'special.png',
    frames: 12,
    frameRate: 16,
    repeat: 0,
    defaultVisual: rect(36, 20, 184, 212),
    // Three rising hits. Each span is separated by an inactive frame so the hit
    // window re-opens (the engine re-arms a swing only on an inactive->active
    // transition); contiguous frames would otherwise register a single hit.
    // The finisher span is a single frame so it carries the "no frames after"
    // finisher flag.
    attackSpans: [
      { frames: [4, 5], bounds: rect(20, 80, 112, 110) },
      { frames: [7, 8], bounds: rect(20, 48, 112, 120) },
      { frames: [10], bounds: rect(20, 22, 112, 130) }
    ]
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.throwReaction,
    action: 'thrown',
    label: 'Thrown Reaction',
    file: 'moves/thrown.png',
    frames: 4,
    frameWidth: 512,
    frameHeight: 512,
    displayScale: 0.5,
    anchorY: 0.99609375,
    sourceFacing: 'west',
    frameRate: 8,
    repeat: 0,
    defaultVisual: rect(10, 64, 492, 440)
  },
  {
    key: RED_BRAWLER_ANIMATION_KEYS.knockdown,
    action: 'knockdown',
    label: 'Knockdown',
    file: 'knockdown.png',
    frames: 10,
    frameRate: 10,
    repeat: 0,
    defaultVisual: rect(40, 150, 176, 80)
  }
];

export const RED_BRAWLER_SPRITESHEETS: SpritesheetAsset[] = RED_BRAWLER_ACTIONS.map((spec) =>
  sheet(spec.key, `${ASSET_ROOT}/${spec.file}`, spec.frames, spec.frameWidth, spec.frameHeight)
);

export const RED_BRAWLER_HADOKEN_PROJECTILE: SpritesheetAsset = sheet(
  'red-brawler-hadoken-projectile',
  `${ASSET_ROOT}/moves/hadoken-projectile.png`,
  6
);
export const RED_BRAWLER_HADOKEN_PROJECTILE_ANIMATION_KEY = 'red-brawler-hadoken-projectile-loop';

export const RED_BRAWLER_ANIMATIONS: HeroAnimationDefinition[] = RED_BRAWLER_ACTIONS.map((spec) =>
  makeAnimation(spec)
);

export const RED_BRAWLER_CHARACTER: CharacterDefinition = {
  id: RED_BRAWLER_CHARACTER_ID,
  label: 'Kai “Redline” Mercer',
  role: 'player',
  anchor: WEST_ANCHOR,
  anchorPixels: WEST_ANCHOR_PIXELS,
  animations: RED_BRAWLER_ANIMATIONS,
  anchorAsset: RED_BRAWLER_ANCHOR_ASSET,
  portrait: RED_BRAWLER_PORTRAIT_ASSET,
  assets: [RED_BRAWLER_ANCHOR_ASSET, RED_BRAWLER_PORTRAIT_ASSET, ...RED_BRAWLER_SPRITESHEETS, RED_BRAWLER_HADOKEN_PROJECTILE]
};

/**
 * Build a spritesheet asset descriptor with the shared 256x256 frame layout.
 */
function sheet(
  key: string,
  url: string,
  frames: number,
  frameWidth = FRAME_WIDTH,
  frameHeight = FRAME_HEIGHT
): SpritesheetAsset {
  return {
    ...SHEET_BASE,
    key,
    url,
    frameWidth,
    frameHeight,
    frames
  };
}

/**
 * Build a hero animation definition from an action spec, deriving placeholder
 * collision/hit boxes from the default visual box and seeding attack boxes on
 * the spec's active frames. Per-frame bounds are meant to be refined in the
 * Character Gym.
 */
function makeAnimation(spec: RedBrawlerActionSpec): HeroAnimationDefinition {
  const attackByFrame = new Map<number, Rect>();

  if (spec.attack) {
    spec.attack.frames.forEach((frame) => attackByFrame.set(frame, spec.attack!.bounds));
  }

  (spec.attackSpans ?? []).forEach((span) => {
    span.frames.forEach((frame) => attackByFrame.set(frame, span.bounds));
  });

  const bounds: HeroBoundsFrame[] = Array.from({ length: spec.frames }, (_, frame) => {
    const spawnPoint = spec.action === 'hadoken'
      ? spec.hadoukenSpawnPoints?.[frame] ?? spec.hadoukenSpawnPoint
      : undefined;
    const frameScaleX = (spec.frameWidth ?? FRAME_WIDTH) / FRAME_WIDTH;
    const frameScaleY = (spec.frameHeight ?? FRAME_HEIGHT) / FRAME_HEIGHT;
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
      collision: scaleFrameRect(collisionBounds(baseVisual), frameScaleX, frameScaleY),
      hit: scaleFrameRect(hitBounds(baseVisual), frameScaleX, frameScaleY),
      attack: attackByFrame.get(frame) ?? null,
      guard: spec.guard ? { ...spec.guard } : null
    };
  });

  return {
    id: spec.key,
    characterId: RED_BRAWLER_CHARACTER_ID,
    action: spec.action,
    label: spec.label,
    key: spec.key,
    sheet: requireSheet(spec.key),
    frameRate: spec.frameRate,
    repeat: spec.repeat,
    ...(spec.displayScale !== undefined ? { displayScale: spec.displayScale } : {}),
    ...(spec.anchorY !== undefined ? { anchorY: spec.anchorY } : {}),
    ...(spec.sourceFacing ? { sourceFacing: spec.sourceFacing } : {}),
    ...(spec.hadoukenReleaseFrame !== undefined ? { hadoukenReleaseFrame: spec.hadoukenReleaseFrame } : {}),
    bounds
  };
}

/**
 * Look up the spritesheet descriptor for an animation key, throwing if missing.
 */
function requireSheet(key: string): SpritesheetAsset {
  const found = RED_BRAWLER_SPRITESHEETS.find((candidate) => candidate.key === key);

  if (!found) {
    throw new Error(`Missing red-brawler spritesheet metadata for ${key}`);
  }

  return found;
}

/**
 * Derive a centered collision box from a visual box, anchored to the feet.
 */
function collisionBounds(visual: Rect): Rect {
  const width = Math.min(58, Math.max(34, Math.round(visual.width * 0.46)));
  const height = Math.max(74, Math.round(visual.height * 0.82));

  return {
    x: Math.round(128 - width / 2),
    y: Math.round(230 - height),
    width,
    height
  };
}

/**
 * Derive a slightly padded hurtbox from a visual box.
 */
function hitBounds(visual: Rect): Rect {
  return {
    x: Math.max(0, visual.x - 4),
    y: Math.max(0, visual.y + 2),
    width: Math.min(FRAME_WIDTH, visual.width + 8),
    height: Math.min(FRAME_HEIGHT, visual.height)
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
 * Construct a rectangle literal.
 */
function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}
