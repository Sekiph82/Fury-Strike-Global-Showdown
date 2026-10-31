import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { getFighterOrigin, getPlayableRoster } from '../game/fighterOrigins';
import { getCharacterDefinition } from '../game/hero';
import { STAGE_DEFINITIONS } from '../game/stageConfig';
import { SCENE_KEYS, type MatchMode } from '../game/types';
import { BaseScene } from './BaseScene';
import { placeNormalizedPortrait } from './portraitLayout';

interface LevelSelectData { mode: MatchMode; p1CharacterId: string; p2CharacterId: string }
const GOLD = 0xffd34f;
const ROSTER = getPlayableRoster();
const STAGE_LOCATIONS: Record<string, { x: number; y: number }> = {
  'rooftop-twilight': { x: 0.21, y: 0.34 }, 'rooftop-sunset': { x: 0.24, y: 0.37 },
  'harbor-night': { x: 0.47, y: 0.28 }, 'night-market': { x: 0.78, y: 0.58 },
  'abandoned-subway': { x: 0.53, y: 0.32 }, 'storm-skybridge': { x: 0.77, y: 0.39 },
  'mountain-dojo-dawn': { x: 0.76, y: 0.36 }, 'rainy-harbor': { x: 0.79, y: 0.55 },
  'moonlit-greenhouse': { x: 0.49, y: 0.35 }, 'crystal-cavern-arena': { x: 0.65, y: 0.50 }
};

/** Arena select inspired by the reference: portraits, world map and a full stage grid. */
export class LevelSelectScene extends BaseScene {
  private mode: MatchMode = '1vcpu';
  private p1CharacterId = '';
  private p2CharacterId = '';
  private selectedIndex = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private stageCounter?: Phaser.GameObjects.Text;
  private stageTitle?: Phaser.GameObjects.Text;
  private mapMarker?: Phaser.GameObjects.Arc;

  constructor() { super(SCENE_KEYS.LevelSelect); }

  init(data: LevelSelectData): void {
    this.mode = data?.mode ?? '1vcpu';
    this.p1CharacterId = data?.p1CharacterId ?? ROSTER[0].id;
    this.p2CharacterId = data?.p2CharacterId ?? ROSTER[1].id;
    this.selectedIndex = 0;
  }

  create(): void {
    this.markActiveScene(SCENE_KEYS.LevelSelect);
    this.cameras.main.setBackgroundColor(0x06091c);
    this.add.rectangle(1024, 640, 1990, 1190, 0x070c24).setStrokeStyle(4, 0x283f84);
    this.createHeading('WORLD TOUR  /  ARENA SELECT', 'CHOOSE THE BATTLEFIELD');
    this.buildFaceOff();
    this.buildWorldMap();
    this.buildStageGrid();
    this.setSelection(0);
    this.createFooterHint('← → ↑ ↓: browse stages     ENTER / SPACE: confirm     ESC: back');
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1, 0));
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1, 0));
    this.input.keyboard?.on('keydown-UP', () => this.move(0, -1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(0, 1));
    this.input.keyboard?.on('keydown-A', () => this.move(-1, 0));
    this.input.keyboard?.on('keydown-D', () => this.move(1, 0));
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard?.on('keydown-SPACE', () => this.confirm());
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start(SCENE_KEYS.Versus, this.currentData()));
    this.input.keyboard?.on('keydown-BACKSPACE', () => this.scene.start(SCENE_KEYS.Versus, this.currentData()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.cards.forEach((card) => card.destroy()); this.cards = []; });
  }

  private buildFaceOff(): void {
    const p1 = getCharacterDefinition(this.p1CharacterId);
    const p2 = getCharacterDefinition(this.p2CharacterId);
    const panel = (x: number, label: string, fighter: typeof p1, flipped: boolean, color: number): void => {
      this.add.rectangle(x, 355, 330, 344, 0x0b153b, 0.96).setStrokeStyle(3, color);
      this.add.text(x, 203, label, { color: `#${color.toString(16).padStart(6, '0')}`, fontFamily: 'monospace', fontSize: '21px', fontStyle: 'bold' }).setOrigin(0.5);
      const portrait = this.add.image(x, 365, fighter.portrait.key).setDepth(3);
      placeNormalizedPortrait(portrait, fighter.id, x, 365, 254);
      portrait.setFlipX(flipped);
      this.add.text(x, 523, fighter.label.toUpperCase(), { color: '#fff0bf', fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', align: 'center', wordWrap: { width: 310 } }).setOrigin(0.5);
      this.add.text(x, 551, getFighterOrigin(fighter.id).country, { color: '#9bd7ff', fontFamily: 'monospace', fontSize: '14px' }).setOrigin(0.5);
    };
    panel(234, '1P', p1, false, 0x31bdff);
    panel(1814, 'CPU RIVAL', p2, true, 0xff748b);
  }

  private buildWorldMap(): void {
    const centerX = 1024, centerY = 354, width = 900, height = 338;
    this.add.rectangle(centerX, centerY, width + 26, height + 26, 0x08164a).setStrokeStyle(3, 0x2873cf);
    this.add.image(centerX, centerY, 'world-map-pixel').setDisplaySize(width, height).setDepth(2);
    const location = STAGE_LOCATIONS[STAGE_DEFINITIONS[this.selectedIndex].id] ?? getFighterOrigin(this.p1CharacterId).map;
    this.mapMarker = this.add.circle(centerX - width / 2 + location.x * width, centerY - height / 2 + location.y * height, 12, GOLD, 1)
      .setStrokeStyle(4, 0xffffff).setDepth(4);
    this.add.text(centerX, 552, 'WORLD TOUR CIRCUIT', { color: '#fff0a6', fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold' }).setOrigin(0.5);
    this.stageTitle = this.add.text(centerX, 582, '', { color: '#ffffff', fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold' }).setOrigin(0.5);
    this.stageCounter = this.add.text(centerX, 610, '', { color: '#a8c5ef', fontFamily: 'monospace', fontSize: '15px' }).setOrigin(0.5);
  }

  private buildStageGrid(): void {
    const columns = 5, cardW = 314, cardH = 174, gapX = 18, gapY = 13;
    const startX = 1024 - (columns * cardW + (columns - 1) * gapX) / 2 + cardW / 2;
    const startY = 772;
    STAGE_DEFINITIONS.forEach((stage, index) => {
      const x = startX + (index % columns) * (cardW + gapX);
      const y = startY + Math.floor(index / columns) * (cardH + gapY);
      const container = this.add.container(x, y).setDepth(5);
      const bg = this.add.rectangle(0, 0, cardW, cardH, 0x0c1430).setStrokeStyle(3, 0x485475);
      const thumb = this.add.image(0, -18, stage.key).setDisplaySize(cardW - 12, 122);
      const label = this.add.text(0, 57, stage.label.toUpperCase(), { color: '#e8edfb', fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', align: 'center', wordWrap: { width: cardW - 14 } }).setOrigin(0.5);
      container.add([bg, thumb, label]);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => this.setSelection(index));
      bg.on('pointerdown', () => { this.setSelection(index); this.confirm(); });
      this.cards.push(container);
    });
  }

  private move(dx: number, dy: number): void {
    const row = Math.floor(this.selectedIndex / 5), col = this.selectedIndex % 5;
    const nextRow = Phaser.Math.Clamp(row + dy, 0, Math.ceil(STAGE_DEFINITIONS.length / 5) - 1);
    const nextCol = Phaser.Math.Wrap(col + dx, 0, 5);
    this.setSelection(Math.min(nextRow * 5 + nextCol, STAGE_DEFINITIONS.length - 1));
  }

  private setSelection(index: number): void {
    this.selectedIndex = Phaser.Math.Clamp(index, 0, STAGE_DEFINITIONS.length - 1);
    this.cards.forEach((card, i) => {
      const bg = card.list[0] as Phaser.GameObjects.Rectangle;
      const selected = i === this.selectedIndex;
      bg.setFillStyle(selected ? 0x283456 : 0x0c1430).setStrokeStyle(selected ? 5 : 3, selected ? GOLD : 0x485475);
      card.setScale(selected ? 1.035 : 1);
    });
    const stage = STAGE_DEFINITIONS[this.selectedIndex];
    this.stageTitle?.setText(stage.label.toUpperCase());
    this.stageCounter?.setText(`${String(this.selectedIndex + 1).padStart(2, '0')}  /  ${String(STAGE_DEFINITIONS.length).padStart(2, '0')}`);
    const location = STAGE_LOCATIONS[stage.id] ?? getFighterOrigin(this.p1CharacterId).map;
    this.mapMarker?.setPosition(1024 - 450 + location.x * 900, 354 - 169 + location.y * 338);
  }

  private confirm(): void {
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
    this.scene.start(SCENE_KEYS.Match, { ...this.currentData(), stageId: STAGE_DEFINITIONS[this.selectedIndex].id });
  }

  private currentData(): LevelSelectData { return { mode: this.mode, p1CharacterId: this.p1CharacterId, p2CharacterId: this.p2CharacterId }; }
}
