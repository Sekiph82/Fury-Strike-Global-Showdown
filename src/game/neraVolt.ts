import type { CharacterDefinition } from './hero';
import { buildFighterCharacter, rect, type FighterActionSpec } from './fighterCharacter';

export const NERA_VOLT_CHARACTER_ID = 'nera-volt';

const CELL = 313;
const VISUAL = rect(22, 7, 270, 298);
const LOW_VISUAL = rect(22, 86, 270, 218);

const NERA_VOLT_ACTIONS: FighterActionSpec[] = [
  { action: 'idle', label: 'Idle', file: 'idle.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: -1, defaultVisual: VISUAL },
  { action: 'walk-forward', label: 'Walk Forward', file: 'walk-forward.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 9, repeat: -1, defaultVisual: VISUAL },
  { action: 'walk-backward', label: 'Walk Backward', file: 'walk-forward.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 9, repeat: -1, defaultVisual: VISUAL },
  { action: 'crouch', label: 'Crouch', file: 'crouch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: 0, defaultVisual: LOW_VISUAL },
  { action: 'jump', label: 'Jump', file: 'jump.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: VISUAL },
  { action: 'block-high', label: 'Block High', file: 'block-high.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: 0, defaultVisual: VISUAL, guard: rect(70, 38, 182, 146) },
  { action: 'block-low', label: 'Block Low', file: 'crouch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: 0, defaultVisual: LOW_VISUAL, guard: rect(56, 146, 204, 142) },
  { action: 'hit-high', label: 'Hit High', file: 'knockdown.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL },
  ...(['fire', 'ice', 'wind', 'electric', 'water'] as const).map((element): FighterActionSpec => ({
    action: `hit-${element}`,
    label: `${element[0].toUpperCase()}${element.slice(1)} Hit Reaction`,
    file: `reactions/hit-${element}.png`,
    frames: 1,
    frameWidth: 512,
    frameHeight: 512,
    displayScale: 0.5,
    anchorY: 0.99609375,
    sourceFacing: 'east',
    frameRate: 12,
    repeat: 0,
    defaultVisual: rect(144, 56, 224, 408)
  })),
  { action: 'light-punch', label: 'Light Punch', file: 'light-punch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(138, 92, 170, 112) } },
  { action: 'medium-punch', label: 'Medium Punch', file: 'light-punch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(132, 86, 178, 122) } },
  { action: 'heavy-punch', label: 'Heavy Punch', file: 'light-punch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(124, 78, 194, 138) } },
  { action: 'light-kick', label: 'Light Kick', file: 'light-kick.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(144, 124, 166, 118) } },
  { action: 'medium-kick', label: 'Medium Kick', file: 'light-kick.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(136, 116, 176, 130) } },
  { action: 'heavy-kick', label: 'Heavy Kick', file: 'light-kick.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(126, 106, 196, 148) } },
  { action: 'hyakuretsukyaku', label: 'Hyakuretsukyaku', file: 'moves/hyakuretsukyaku-6frame.png', frames: 6, frameWidth: 1254, frameHeight: 1254, displayScale: 0.25, anchorX: 0.15, anchorY: 0.98, sourceFacing: 'east', frameRate: 12, repeat: 0, defaultVisual: rect(110, 55, 590, 1160), attack: { frames: [1, 4], bounds: rect(640, 400, 590, 280) } },
  { action: 'low-sweep', label: 'Low Sweep', file: 'dynamo-sweep.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: LOW_VISUAL, attack: { frames: [2], bounds: rect(18, 154, 292, 120) } },
  { action: 'jump-kick', label: 'Jump Kick', file: 'light-kick.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(88, 30, 220, 240) } },
  { action: 'hadoken', label: 'Volt Lance', file: 'volt-lance.png', sourceFacing: 'east', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, hadoukenSpawnPoint: { x: 207, y: 103 }, hadoukenReleaseFrame: 2 },
  { action: 'shoryuken', label: 'Arc Rise', file: 'arc-rise.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(88, 24, 224, 252) } },
  { action: 'tatsumaki', label: 'Dynamo Sweep', file: 'dynamo-sweep.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(16, 80, 298, 188) } },
  { action: 'spinning-bird-kick', label: 'Spinning Bird Kick', file: 'moves/spinning-bird-kick-4.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: rect(16, 8, 281, 300), sourceFacing: 'east', attackSpans: [
    { frames: [1], bounds: rect(126, 42, 180, 162) },
    { frames: [2], bounds: rect(18, 12, 286, 202) }
  ] },
  { action: 'throw', label: 'Throw', file: 'light-punch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(124, 68, 192, 180) } },
  { action: 'special-charge', label: 'Overload Charge', file: 'special-charge.png', frames: 2, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: VISUAL },
  { action: 'special', label: 'Overload', file: 'special.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(36, 48, 276, 226) } },
  { action: 'thrown', label: 'Thrown', file: 'moves/thrown.png', frames: 4, frameWidth: 512, frameHeight: 512, displayScale: 0.5, anchorY: 0.99609375, sourceFacing: 'east', frameRate: 8, repeat: 0, defaultVisual: rect(12, 60, 488, 440) },
  { action: 'knockdown', label: 'Knockdown', file: 'knockdown.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: LOW_VISUAL }
];

export const NERA_VOLT_CHARACTER: CharacterDefinition = buildFighterCharacter({
  id: NERA_VOLT_CHARACTER_ID,
  label: 'Nera “Volt” Sato',
  facing: 'east',
  assetRoot: '/assets/nera-volt',
  anchorUsage: 'Nera Volt full-body original concept anchor',
  anchorWidth: 1216,
  anchorHeight: 1294,
  portraitWidth: 850,
  portraitHeight: 850,
  actions: NERA_VOLT_ACTIONS
});
