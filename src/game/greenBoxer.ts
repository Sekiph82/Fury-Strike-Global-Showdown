import type { CharacterDefinition } from './hero';
import { buildFighterCharacter, rect, type FighterActionSpec } from './fighterCharacter';

export const GREEN_BOXER_CHARACTER_ID = 'green-boxer';

const GREEN_BOXER_ACTIONS: FighterActionSpec[] = [
  {
    action: 'idle',
    label: 'Idle',
    file: 'idle.png',
    frames: 12,
    frameRate: 8,
    repeat: -1,
    defaultVisual: rect(76, 28, 104, 204)
  },
  {
    action: 'walk-forward',
    label: 'Walk Forward',
    file: 'walk-forward.png',
    frames: 8,
    frameRate: 8,
    repeat: -1,
    defaultVisual: rect(72, 28, 112, 204)
  },
  {
    action: 'walk-backward',
    label: 'Walk Backward',
    file: 'walk-backward.png',
    frames: 8,
    frameRate: 8,
    repeat: -1,
    defaultVisual: rect(72, 28, 112, 204)
  },
  {
    action: 'crouch',
    label: 'Crouch',
    file: 'crouch.png',
    frames: 5,
    frameRate: 10,
    repeat: 0,
    defaultVisual: rect(72, 104, 112, 126)
  },
  {
    action: 'jump',
    label: 'Jump',
    file: 'jump.png',
    frames: 8,
    frameRate: 10,
    repeat: 0,
    defaultVisual: rect(70, 16, 116, 206)
  },
  {
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
    action: 'hit-high',
    label: 'Hit High',
    file: 'hit-high.png',
    frames: 6,
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(72, 28, 112, 204)
  },
  {
    action: 'hit-electric',
    label: 'Electric Shock',
    file: 'hit-electric-6cell.png',
    frames: 6,
    frameWidth: 512,
    frameHeight: 512,
    displayScale: 0.5,
    anchorY: 0.99609375,
    sourceFacing: 'east',
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(144, 56, 224, 408)
  },
  ...(['fire', 'ice', 'wind', 'water'] as const).map((element): FighterActionSpec => ({
    action: `hit-${element}`,
    label: `${element[0].toUpperCase()}${element.slice(1)} Hit Reaction`,
    file: `reactions/hit-${element}.png`,
    frames: 1,
    frameWidth: 512,
    frameHeight: 512,
    displayScale: 0.5,
    anchorY: 0.99609375,
    sourceFacing: 'west',
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(144, 56, 224, 408)
  })),
  {
    action: 'light-punch',
    label: 'Light Punch',
    file: 'light-punch.png',
    sourceFacing: 'west',
    frames: 6,
    frameRate: 14,
    repeat: 0,
    defaultVisual: rect(60, 28, 128, 204),
    attack: { frames: [2, 3], bounds: rect(18, 84, 84, 46) }
  },
  {
    action: 'heavy-punch',
    label: 'Heavy Punch',
    file: 'heavy-punch.png',
    sourceFacing: 'west',
    frames: 8,
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(52, 28, 148, 204),
    attack: { frames: [3, 4, 5], bounds: rect(14, 80, 92, 52) }
  },
  ...(['light-kick', 'medium-kick', 'heavy-kick'] as const).map((action, tier): FighterActionSpec => ({
    action,
    label: `${['Light', 'Medium', 'Heavy'][tier]} Kick`,
    file: 'moves/tatsumaki-12.png',
    frames: 12,
    frameWidth: 256,
    frameHeight: 256,
    sourceFacing: 'west',
    frameRate: [18, 16, 14][tier],
    repeat: 0,
    defaultVisual: rect(16, 30, 224, 214),
    attack: {
      frames: [[3], [6], [9]][tier],
      bounds: rect([42, 30, 20][tier], 84, [150, 178, 198][tier], 116)
    }
  })),
  {
    action: 'low-sweep',
    label: 'Wildroot Sweep',
    file: 'moves/low-sweep.png',
    frames: 4,
    frameWidth: 512,
    frameHeight: 512,
    displayScale: 0.5,
    anchorY: 0.99609375,
    sourceFacing: 'west',
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(16, 100, 480, 400),
    attack: { frames: [2], bounds: rect(0, 325, 350, 130) }
  },
  {
    action: 'hadoken',
    label: 'Verdant Shot',
    file: 'moves/hadoken-12.png',
    sourceFacing: 'west',
    frames: 12,
    frameRate: 20,
    repeat: 0,
    defaultVisual: rect(28, 24, 200, 220),
    // This sheet faces west; point is the glove center in release frame 6.
    hadoukenSpawnPoint: { x: 112, y: 101 },
    hadoukenReleaseFrame: 6
  },
  {
    action: 'shoryuken',
    label: 'Crown Breaker',
    file: 'moves/shoryuken-12.png',
    frames: 12,
    frameRate: 20,
    repeat: 0,
    defaultVisual: rect(20, 8, 216, 240),
    attack: { frames: [4, 5, 6, 7], bounds: rect(0, 18, 154, 212) }
  },
  {
    action: 'tatsumaki',
    label: 'Orbit Kick',
    file: 'moves/tatsumaki-12.png',
    frames: 12,
    frameRate: 20,
    repeat: 0,
    defaultVisual: rect(16, 30, 224, 214),
    attackSpans: [
      { frames: [3, 4], bounds: rect(0, 92, 164, 112) },
      { frames: [6, 7], bounds: rect(0, 84, 172, 116) },
      { frames: [9, 10], bounds: rect(0, 84, 172, 116) }
    ]
  },
  // Dedicated 12-frame multi-hit Rush Combo animation.
  {
    action: 'special-charge',
    label: 'Special Charge',
    file: 'crouch.png',
    frames: 5,
    frameRate: 14,
    repeat: 0,
    defaultVisual: rect(72, 104, 112, 126)
  },
  {
    action: 'special',
    label: 'Rush Combo',
    file: 'rush-combo-cropped.png',
    frames: 12,
    frameRate: 16,
    repeat: 0,
    defaultVisual: rect(44, 28, 168, 204),
    attackSpans: [
      { frames: [2], bounds: rect(8, 74, 128, 78) },
      { frames: [5], bounds: rect(4, 70, 140, 84) },
      { frames: [8, 9], bounds: rect(0, 62, 148, 94) },
      { frames: [10], bounds: rect(18, 34, 126, 120) }
    ]
  },
  {
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
    defaultVisual: rect(12, 60, 488, 440)
  },
  {
    action: 'knockdown',
    label: 'Knockdown',
    file: 'knockdown.png',
    frames: 10,
    frameRate: 10,
    repeat: 0,
    defaultVisual: rect(40, 150, 176, 80)
  }
];

export const GREEN_BOXER_CHARACTER: CharacterDefinition = buildFighterCharacter({
  id: GREEN_BOXER_CHARACTER_ID,
  label: 'Kofi “Wildroot” Mensah',
  assetRoot: '/assets/green-boxer',
  anchorUsage: 'green boxer west-facing high-fidelity anchor',
  actions: GREEN_BOXER_ACTIONS
});
