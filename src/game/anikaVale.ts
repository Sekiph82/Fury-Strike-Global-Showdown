import type { CharacterDefinition } from './hero';
import { buildFighterCharacter, rect, type FighterActionSpec } from './fighterCharacter';

export const ANIKA_VALE_CHARACTER_ID = 'anika-vale';

const CELL = 313;
const VISUAL = rect(20, 7, 276, 299);
const LOW_VISUAL = rect(20, 86, 276, 218);

const ANIKA_VALE_ACTIONS: FighterActionSpec[] = [
  { action: 'idle', label: 'Idle', file: 'idle.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: -1, defaultVisual: VISUAL },
  { action: 'walk-forward', label: 'Walk Forward', file: 'walk-forward.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: -1, defaultVisual: VISUAL },
  { action: 'walk-backward', label: 'Walk Backward', file: 'walk-forward.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: -1, defaultVisual: VISUAL },
  { action: 'crouch', label: 'Crouch', file: 'crouch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: 0, defaultVisual: LOW_VISUAL },
  { action: 'jump', label: 'Jump', file: 'jump.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: VISUAL },
  { action: 'block-high', label: 'Block High', file: 'block-high.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: 0, defaultVisual: VISUAL, guard: rect(68, 34, 186, 152) },
  { action: 'block-low', label: 'Block Low', file: 'crouch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: 0, defaultVisual: LOW_VISUAL, guard: rect(54, 146, 208, 142) },
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
  { action: 'light-punch', label: 'Light Jab', file: 'light-punch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(140, 92, 168, 112) } },
  { action: 'medium-punch', label: 'Medium Jab', file: 'light-punch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(134, 84, 178, 124) } },
  { action: 'heavy-punch', label: 'Heavy Cross', file: 'light-punch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(124, 76, 198, 142) } },
  { action: 'light-kick', label: 'Light Roundhouse', file: 'light-kick.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(146, 122, 164, 122) } },
  { action: 'medium-kick', label: 'Medium Roundhouse', file: 'light-kick.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(136, 114, 176, 134) } },
  { action: 'heavy-kick', label: 'Heavy Roundhouse', file: 'light-kick.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(124, 104, 198, 152) } },
  { action: 'low-sweep', label: 'Low Sweep', file: 'tatsumaki.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: LOW_VISUAL, attack: { frames: [2], bounds: rect(16, 154, 298, 120) } },
  { action: 'jump-kick', label: 'Jump Kick', file: 'light-kick.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(80, 26, 230, 246) } },
  { action: 'hadoken', label: 'Violet Palm', file: 'hadoken.png', sourceFacing: 'east', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, hadoukenSpawnPoint: { x: 207, y: 106 }, hadoukenReleaseFrame: 2 },
  { action: 'shoryuken', label: 'Gold Rise', file: 'shoryuken.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(82, 24, 230, 252) } },
  { action: 'tatsumaki', label: 'Orchid Wheel', file: 'tatsumaki.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(16, 78, 300, 190) } },
  { action: 'throw', label: 'Throw', file: 'light-punch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(126, 68, 190, 178) } },
  { action: 'thrown', label: 'Thrown', file: 'moves/thrown.png', frames: 4, frameWidth: 512, frameHeight: 512, displayScale: 0.5, anchorY: 0.99609375, sourceFacing: 'east', frameRate: 8, repeat: 0, defaultVisual: rect(12, 60, 488, 440) },
  { action: 'special-charge', label: 'Crown Tempo Charge', file: 'special-charge.png', frames: 2, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: VISUAL },
  { action: 'special', label: 'Crown Tempo', file: 'special.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(24, 42, 292, 236) } },
  { action: 'knockdown', label: 'Knockdown', file: 'knockdown.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: LOW_VISUAL }
];

export const ANIKA_VALE_CHARACTER: CharacterDefinition = buildFighterCharacter({
  id: ANIKA_VALE_CHARACTER_ID,
  label: 'Anika “Vale” Petrov',
  facing: 'east',
  assetRoot: '/assets/anika-vale',
  anchorUsage: 'Anika Vale full-body original concept anchor',
  anchorWidth: 850,
  anchorHeight: 850,
  portraitWidth: 850,
  portraitHeight: 850,
  actions: ANIKA_VALE_ACTIONS
});
