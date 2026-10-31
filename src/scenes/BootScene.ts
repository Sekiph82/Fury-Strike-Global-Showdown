import { preloadStarterAssets, registerStarterAnimations } from '../game/assets';
import { registerGeneratedAssets } from '../game/generatedAssets';
import { registerTileAtlasFrames } from '../game/tileAtlas';
import { registerQuestUiAtlasFrames } from '../game/uiAtlas';
import { registerFightingUiAtlasFrames } from '../game/fightingUiAtlas';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

export class BootScene extends BaseScene {
  constructor() {
    super(SCENE_KEYS.Boot);
  }

  preload(): void {
    preloadStarterAssets(this);
    this.load.image('vfx-ice-impact', '/assets/vfx/ice-impact.png');
    this.load.image('vfx-electric-hit-ring', '/assets/vfx/electric-hit-ring.png');
    this.load.image('vfx-ice-hit-shell', '/assets/vfx/ice-hit-shell.png');
    this.load.image('vfx-fire-hit-shell', '/assets/vfx/fire-hit-shell.png');
    this.load.image('vfx-wind-hit-ring', '/assets/vfx/wind-hit-ring.png');
    this.load.image('vfx-water-hit-ring', '/assets/vfx/water-hit-ring.png');
  }

  create(): void {
    this.markActiveScene(SCENE_KEYS.Boot);
    registerGeneratedAssets(this);
    registerTileAtlasFrames(this);
    registerQuestUiAtlasFrames(this);
    registerFightingUiAtlasFrames(this);
    registerStarterAnimations(this);
    this.scene.start(SCENE_KEYS.Splash);
  }
}
