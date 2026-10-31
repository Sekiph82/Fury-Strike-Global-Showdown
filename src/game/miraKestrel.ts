import type { CharacterDefinition } from './hero';
import { buildFighterCharacter, rect, type FighterActionSpec } from './fighterCharacter';

export const MIRA_KESTREL_CHARACTER_ID = 'mira-kestrel';

const CELL = 313;
const VISUAL = rect(26, 8, 262, 300);
const LOW_VISUAL = rect(24, 86, 266, 220);

// The four core-action rows and the three command-special rows were sliced from
// their 4x4 transparent source atlases. Each strip is four 313px cells wide.
const MIRA_KESTREL_ACTIONS: FighterActionSpec[] = [
  { action: 'idle', label: 'Idle', file: 'idle.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: -1, defaultVisual: VISUAL },
  { action: 'walk-forward', label: 'Walk Forward', file: 'walk-forward.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 9, repeat: -1, defaultVisual: VISUAL },
  { action: 'walk-backward', label: 'Walk Backward', file: 'walk-forward.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 9, repeat: -1, defaultVisual: VISUAL },
  { action: 'crouch', label: 'Crouch', file: 'crouch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: 0, defaultVisual: LOW_VISUAL },
  { action: 'jump', label: 'Jump', file: 'shoryuken.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: VISUAL },
  { action: 'block-high', label: 'Block High', file: 'block-high.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: 0, defaultVisual: VISUAL, guard: rect(70, 40, 180, 142) },
  { action: 'block-low', label: 'Block Low', file: 'block-low.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: 0, defaultVisual: LOW_VISUAL, guard: rect(64, 140, 188, 142) },
  { action: 'hit-high', label: 'Hit High', file: 'hit-high.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL },
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
  { action: 'light-punch', label: 'Light Punch', file: 'light-punch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(140, 94, 166, 102) } },
  { action: 'medium-punch', label: 'Medium Punch', file: 'light-punch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(136, 90, 170, 110) } },
  { action: 'heavy-punch', label: 'Heavy Punch', file: 'light-punch.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(128, 84, 180, 120) } },
  { action: 'light-kick', label: 'Light Kick', file: 'heavy-kick.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(144, 126, 162, 112) } },
  { action: 'medium-kick', label: 'Medium Kick', file: 'heavy-kick.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(138, 118, 168, 124) } },
  { action: 'heavy-kick', label: 'Heavy Kick', file: 'heavy-kick.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 10, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(128, 110, 182, 136) } },
  { action: 'low-sweep', label: 'Low Sweep', file: 'tatsumaki.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: LOW_VISUAL, attack: { frames: [2], bounds: rect(30, 166, 276, 96) } },
  { action: 'jump-kick', label: 'Jump Kick', file: 'shoryuken.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(90, 38, 214, 218) } },
  { action: 'hadoken', label: 'Gale Needle', file: 'hadoken.png', sourceFacing: 'east', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, hadoukenSpawnPoint: { x: 216, y: 104 }, hadoukenReleaseFrame: 2 },
  { action: 'shoryuken', label: 'Kestrel Rise', file: 'shoryuken.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(94, 28, 220, 236) } },
  { action: 'tatsumaki', label: 'Cyclone Heel', file: 'tatsumaki.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(24, 88, 282, 166) } },
  { action: 'throw', label: 'Throw', file: 'heavy-kick.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(136, 72, 174, 154) } },
  { action: 'special-charge', label: 'Skybreaker Charge', file: 'hadoken.png', frames: 4, frameWidth: CELL, frameHeight: CELL, frameRate: 12, repeat: 0, defaultVisual: VISUAL },
  {
    action: 'special', label: 'Skybreaker', file: 'skybreaker-cropped.png', frames: 12,
    frameWidth: CELL, frameHeight: CELL, frameRate: 14, repeat: 0, defaultVisual: VISUAL,
    attackSpans: [
      { frames: [3, 4], bounds: rect(70, 42, 240, 224) },
      { frames: [6, 7], bounds: rect(48, 30, 258, 238) },
      { frames: [9, 10], bounds: rect(38, 60, 270, 198) }
    ]
  },
  { action: 'thrown', label: 'Thrown Reaction', file: 'moves/thrown.png', frames: 4, frameWidth: 512, frameHeight: 512, displayScale: 0.5, anchorY: 0.99609375, sourceFacing: 'east', frameRate: 8, repeat: 0, defaultVisual: rect(18, 34, 484, 466) },
  { action: 'knockdown', label: 'Knockdown', file: 'knockdown.png', frames: 1, frameWidth: CELL, frameHeight: CELL, frameRate: 8, repeat: 0, defaultVisual: LOW_VISUAL }
];

export const MIRA_KESTREL_CHARACTER: CharacterDefinition = buildFighterCharacter({
  id: MIRA_KESTREL_CHARACTER_ID,
  label: 'Mira “Kestrel” Voss',
  facing: 'east',
  assetRoot: '/assets/mira-kestrel',
  anchorUsage: 'Mira Kestrel full-body original concept anchor',
  anchorWidth: 1254,
  anchorHeight: 1254,
  portraitWidth: 1254,
  portraitHeight: 1254,
  actions: MIRA_KESTREL_ACTIONS
});
