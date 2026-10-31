import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { getFighterOrigin, getPlayableRoster } from '../game/fighterOrigins';
import { SCENE_KEYS, type MatchMode } from '../game/types';
import { BaseScene } from './BaseScene';
import { placeNormalizedPortrait } from './portraitLayout';

interface VersusData { mode: MatchMode; p1CharacterId: string; p2CharacterId: string }
const ROSTER = getPlayableRoster();

/** Character face-off presentation before arena selection. */
export class VersusScene extends BaseScene {
  private versusConfig!: VersusData;
  private continued = false;

  constructor() { super(SCENE_KEYS.Versus); }

  init(data: VersusData): void { this.versusConfig = data; this.continued = false; }

  create(): void {
    this.markActiveScene(SCENE_KEYS.Versus);
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x03040a);
    this.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x03040a, 1);
    this.add.rectangle(cam.centerX, cam.centerY, cam.width * 0.9, cam.height * 0.72, 0x080d22, 1).setStrokeStyle(4, 0x34314f);
    const p1 = ROSTER.find((fighter) => fighter.id === this.versusConfig.p1CharacterId) ?? ROSTER[0];
    const p2 = ROSTER.find((fighter) => fighter.id === this.versusConfig.p2CharacterId) ?? ROSTER[1];
    const leftPortrait = this.add.image(cam.centerX - 460, cam.centerY - 30, p1.portrait.key).setDepth(2);
    const rightPortrait = this.add.image(cam.centerX + 460, cam.centerY - 30, p2.portrait.key).setFlipX(true).setDepth(2);
    placeNormalizedPortrait(leftPortrait, p1.id, cam.centerX - 460, cam.centerY - 30, 570);
    placeNormalizedPortrait(rightPortrait, p2.id, cam.centerX + 460, cam.centerY - 30, 570);
    this.add.text(cam.centerX - 460, cam.centerY + 332, p1.label.toUpperCase(), { color: '#ffe3a1', fontFamily: 'monospace', fontSize: '38px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
    this.add.text(cam.centerX + 460, cam.centerY + 332, p2.label.toUpperCase(), { color: '#ffe3a1', fontFamily: 'monospace', fontSize: '38px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
    this.add.text(cam.centerX - 460, cam.centerY + 375, `1P  •  ${getFighterOrigin(p1.id).country}`, { color: '#65d2ff', fontFamily: 'monospace', fontSize: '19px' }).setOrigin(0.5);
    this.add.text(cam.centerX + 460, cam.centerY + 375, `CPU  •  ${getFighterOrigin(p2.id).country}`, { color: '#ff8896', fontFamily: 'monospace', fontSize: '19px' }).setOrigin(0.5);
    this.add.text(cam.centerX, cam.centerY - 5, 'VS', { color: '#ffdc54', fontFamily: 'monospace', fontSize: '112px', fontStyle: 'bold', stroke: '#691c2d', strokeThickness: 16 }).setOrigin(0.5).setDepth(5).setScale(0.6);
    this.tweens.add({ targets: this.children.list[this.children.length - 1], scale: 1, duration: 520, ease: 'Back.Out' });
    this.add.text(cam.centerX, cam.height - 72, 'NEXT  •  CHOOSE THE BATTLEFIELD', { color: '#b7d6ff', fontFamily: 'monospace', fontSize: '18px' }).setOrigin(0.5);
    this.input.keyboard?.on('keydown-ENTER', () => this.continueToStage());
    this.input.keyboard?.on('keydown-SPACE', () => this.continueToStage());
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start(SCENE_KEYS.CharacterSelect, { mode: this.versusConfig.mode }));
    this.time.delayedCall(2600, () => this.continueToStage());
    this.input.once('pointerdown', () => this.continueToStage());
  }

  private continueToStage(): void {
    if (this.continued) return;
    this.continued = true;
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
    this.scene.start(SCENE_KEYS.LevelSelect, this.versusConfig);
  }
}
