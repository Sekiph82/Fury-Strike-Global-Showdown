import type { CharacterDefinition } from './hero';
import { buildFighterCharacter, rect, type FighterActionSpec } from './fighterCharacter';

export const TALA_EMBER_CHARACTER_ID = 'tala-ember';

const CELL_WIDTH = 328;
const CELL_HEIGHT = 300;
const VISUAL = rect(24, 5, 280, 290);
const LOW_VISUAL = rect(24, 82, 280, 210);

const TALA_EMBER_ACTIONS: FighterActionSpec[] = [
  { action: 'idle', label: 'Idle', file: 'idle.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 8, repeat: -1, defaultVisual: VISUAL },
  { action: 'walk-forward', label: 'Walk Forward', file: 'walk-forward.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 9, repeat: -1, defaultVisual: VISUAL },
  { action: 'walk-backward', label: 'Walk Backward', file: 'walk-forward.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 9, repeat: -1, defaultVisual: VISUAL },
  { action: 'crouch', label: 'Crouch', file: 'crouch.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 8, repeat: 0, defaultVisual: LOW_VISUAL },
  // Tala has no standalone jump sheet; use her existing four-frame rising flame
  // animation so the jump action always has a valid, character-matched texture.
  { action: 'jump', label: 'Jump', file: 'flare-lift.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 10, repeat: 0, defaultVisual: VISUAL },
  { action: 'block-high', label: 'Block High', file: 'block-high.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 8, repeat: 0, defaultVisual: VISUAL, guard: rect(70, 34, 190, 150) },
  { action: 'block-low', label: 'Block Low', file: 'block-low.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 8, repeat: 0, defaultVisual: LOW_VISUAL, guard: rect(58, 140, 214, 145) },
  { action: 'hit-high', label: 'Hit High', file: 'hit-high.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 12, repeat: 0, defaultVisual: VISUAL },
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
  { action: 'light-punch', label: 'Light Punch', file: 'light-punch.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(142, 92, 176, 108) } },
  { action: 'medium-punch', label: 'Medium Punch', file: 'light-punch.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(132, 86, 190, 120) } },
  { action: 'heavy-punch', label: 'Heavy Punch', file: 'light-punch.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 10, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(124, 78, 198, 136) } },
  { action: 'light-kick', label: 'Light Kick', file: 'light-kick.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(148, 126, 168, 118) } },
  { action: 'medium-kick', label: 'Medium Kick', file: 'light-kick.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(138, 116, 180, 130) } },
  { action: 'heavy-kick', label: 'Heavy Kick', file: 'light-kick.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 10, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(128, 106, 198, 146) } },
  { action: 'low-sweep', label: 'Low Sweep', file: 'gyre-heel.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 12, repeat: 0, defaultVisual: LOW_VISUAL, attack: { frames: [2], bounds: rect(24, 158, 280, 110) } },
  { action: 'jump-kick', label: 'Jump Kick', file: 'light-kick.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(94, 34, 220, 236) } },
  { action: 'tiger-knee', label: 'Tiger Knee', file: 'moves/tiger-knee.png', frames: 1, frameWidth: 1254, frameHeight: 1254, displayScale: 0.25, anchorX: 0.5, anchorY: 0.98, sourceFacing: 'east', frameRate: 8, repeat: 0, defaultVisual: rect(230, 55, 800, 1160), attack: { frames: [0], bounds: rect(620, 500, 470, 360) } },
  { action: 'hadoken', label: 'Cinder Pulse', file: 'cinder-pulse.png', sourceFacing: 'east', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 12, repeat: 0, defaultVisual: VISUAL, hadoukenSpawnPoint: { x: 207, y: 112 }, hadoukenReleaseFrame: 2 },
  { action: 'shoryuken', label: 'Flare Lift', file: 'flare-lift.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(92, 26, 224, 244) } },
  { action: 'tatsumaki', label: 'Gyre Heel', file: 'gyre-heel.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 14, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(18, 86, 300, 174) } },
  { action: 'throw', label: 'Throw', file: 'light-punch.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 12, repeat: 0, defaultVisual: VISUAL, attack: { frames: [2], bounds: rect(128, 68, 188, 172) } },
    { action: 'special-charge', label: 'Cinder Charge', file: 'special-charge-cropped.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 12, repeat: 0, defaultVisual: VISUAL },
  {
    action: 'special', label: 'Emberstorm', file: 'special.png', frames: 12,
    frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 14, repeat: 0, defaultVisual: VISUAL,
    attackSpans: [
      { frames: [2, 3], bounds: rect(112, 70, 210, 146) },
      { frames: [5, 6], bounds: rect(86, 28, 236, 250) },
      { frames: [8, 9], bounds: rect(20, 84, 298, 184) },
      { frames: [10], bounds: rect(122, 72, 198, 146) }
    ]
  },
  { action: 'thrown', label: 'Thrown', file: 'moves/thrown.png', frames: 4, frameWidth: 512, frameHeight: 512, displayScale: 0.5, anchorY: 0.99609375, sourceFacing: 'east', frameRate: 8, repeat: 0, defaultVisual: rect(12, 60, 488, 440) },
  { action: 'knockdown', label: 'Knockdown', file: 'knockdown.png', frames: 4, frameWidth: CELL_WIDTH, frameHeight: CELL_HEIGHT, frameRate: 10, repeat: 0, defaultVisual: LOW_VISUAL }
];

export const TALA_EMBER_CHARACTER: CharacterDefinition = buildFighterCharacter({
  id: TALA_EMBER_CHARACTER_ID,
  label: 'Tala “Ember” Noor',
  facing: 'east',
  assetRoot: '/assets/tala-ember',
  anchorUsage: 'Tala Ember full-body original concept anchor',
  anchorWidth: 1312,
  anchorHeight: 1199,
  portraitWidth: 850,
  portraitHeight: 820,
  actions: TALA_EMBER_ACTIONS
});
