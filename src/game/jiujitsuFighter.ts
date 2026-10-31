import type { CharacterDefinition } from './hero';
import { buildFighterCharacter, rect, type FighterActionSpec } from './fighterCharacter';

export const JIUJITSU_FIGHTER_CHARACTER_ID = 'jiujitsu-fighter';

const JIUJITSU_FIGHTER_ACTIONS: FighterActionSpec[] = [
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
    action: 'hit-water',
    label: 'Water Impact',
    file: 'hit-water-6cell.png',
    frames: 6,
    frameWidth: 512,
    frameHeight: 512,
    displayScale: 0.5,
    anchorY: 0.99609375,
    sourceFacing: 'west',
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(144, 56, 224, 408)
  },
  ...(['fire', 'ice', 'wind', 'electric'] as const).map((element): FighterActionSpec => ({
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
    frames: 6,
    frameRate: 14,
    repeat: 0,
    defaultVisual: rect(60, 28, 128, 204),
    attack: { frames: [2, 3], bounds: rect(18, 84, 84, 46) }
  },
  {
    action: 'heavy-kick',
    label: 'Heavy Kick',
    file: 'heavy-kick.png',
    frames: 10,
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(48, 28, 152, 204),
    attack: { frames: [4, 5, 6], bounds: rect(10, 96, 100, 58) }
  },
  {
    action: 'low-sweep',
    label: 'Tide Sweep',
    file: 'moves/low-sweep.png',
    frames: 4,
    frameWidth: 512,
    frameHeight: 512,
    displayScale: 0.5,
    anchorY: 0.99609375,
    sourceFacing: 'west',
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(16, 64, 480, 444),
    attack: { frames: [2], bounds: rect(0, 330, 340, 150) }
  },
  {
    action: 'hadoken',
    label: 'Palm Current',
    file: 'moves/hadoken-12.png',
    frames: 12,
    frameRate: 20,
    repeat: 0,
    defaultVisual: rect(16, 24, 224, 220),
    sourceFacing: 'west',
    // This sheet faces west; point sits between both palms in release frame 3.
    hadoukenSpawnPoint: { x: 58, y: 100 },
    hadoukenReleaseFrame: 3
  },
  {
    action: 'shoryuken',
    label: 'Rising Elbow',
    file: 'moves/shoryuken-12.png',
    frames: 12,
    frameRate: 20,
    repeat: 0,
    defaultVisual: rect(12, 8, 232, 240),
    attack: { frames: [4, 5, 6, 7], bounds: rect(0, 18, 162, 212) }
  },
  {
    action: 'tatsumaki',
    label: 'Spiral Kick',
    file: 'moves/tatsumaki-12.png',
    frames: 12,
    frameRate: 20,
    repeat: 0,
    defaultVisual: rect(12, 24, 232, 220),
    attackSpans: [
      { frames: [3, 4], bounds: rect(0, 92, 172, 112) },
      { frames: [6, 7], bounds: rect(0, 84, 180, 116) },
      { frames: [9, 10], bounds: rect(0, 84, 180, 116) }
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
    defaultVisual: rect(12, 80, 488, 430)
  },
  // Special "Spinarooni": a low capoeira windmill legsweep. The charge coils low
  // with a hand reaching for the floor; the execution whirls the legs through
  // four low rotating hits (the last is the sweeping finisher). Refine bounds in
  // the Character Gym.
  {
    action: 'special-charge',
    label: 'Special Charge',
    file: 'special-charge.png',
    frames: 5,
    frameRate: 14,
    repeat: 0,
    defaultVisual: rect(56, 96, 144, 134)
  },
  {
    action: 'special',
    label: 'Spinarooni',
    file: 'special.png',
    frames: 12,
    frameRate: 16,
    repeat: 0,
    defaultVisual: rect(28, 70, 200, 162),
    // Four windmill hits. Each span is separated by an inactive frame so the hit
    // window re-opens (the engine re-arms a swing only on an inactive->active
    // transition); contiguous frames would otherwise register a single hit. The
    // final single-frame span carries the finisher flag (no attack frame after).
    attackSpans: [
      { frames: [2], bounds: rect(0, 128, 150, 92) },
      { frames: [4], bounds: rect(0, 128, 150, 92) },
      { frames: [6], bounds: rect(0, 128, 150, 92) },
      { frames: [8], bounds: rect(0, 128, 150, 92) }
    ]
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

export const JIUJITSU_FIGHTER_CHARACTER: CharacterDefinition = buildFighterCharacter({
  id: JIUJITSU_FIGHTER_CHARACTER_ID,
  label: 'Akira “Tide” Mori',
  assetRoot: '/assets/jiujitsu-fighter',
  anchorUsage: 'capoeira jiu-jitsu fighter west-facing high-fidelity anchor',
  actions: JIUJITSU_FIGHTER_ACTIONS
});
