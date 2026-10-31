import * as Phaser from 'phaser';

import { getFighterOrigin } from '../game/fighterOrigins';
import { getCharacterDefinition } from '../game/hero';
import { SCENE_KEYS, type MatchConfig } from '../game/types';
import { BaseScene } from './BaseScene';
import { placeNormalizedPortrait } from './portraitLayout';

interface ResultsData { config: MatchConfig; p1Wins: number; p2Wins: number; winner: 1 | 2 }

/** Two-part score and champion presentation; a losing player gets an 8s continue. */
export class ResultsScene extends BaseScene {
  private result!: ResultsData;
  private state: 'score' | 'champion' = 'score';
  private count = 8;
  private countText?: Phaser.GameObjects.Text;
  private countdown?: Phaser.Time.TimerEvent;

  constructor() { super(SCENE_KEYS.Results); }

  init(data: ResultsData): void { this.result = data; this.state = 'score'; this.count = 8; }

  create(): void {
    this.markActiveScene(SCENE_KEYS.Results);
    this.cameras.main.setBackgroundColor(0x03040a);
    this.add.rectangle(1024, 640, 2048, 1280, 0x050713);
    this.showScoreboard();
    this.time.delayedCall(2600, () => this.showChampion());
    this.input.keyboard?.on('keydown-ENTER', () => this.onConfirm());
    this.input.keyboard?.on('keydown-SPACE', () => this.onConfirm());
    this.input.keyboard?.on('keydown-ESC', () => this.returnToMenu());
  }

  private showScoreboard(): void {
    const cam = this.cameras.main;
    const p1 = getCharacterDefinition(this.result.config.p1CharacterId);
    const p2 = getCharacterDefinition(this.result.config.p2CharacterId);
    this.add.text(cam.centerX, 125, 'MATCH RESULTS', { color: '#ffe08a', fontFamily: 'monospace', fontSize: '52px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cam.centerX - 420, 250, 'PLAYER 1', { color: '#52ccff', fontFamily: 'monospace', fontSize: '23px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cam.centerX + 420, 250, 'CPU RIVAL', { color: '#ff7e91', fontFamily: 'monospace', fontSize: '23px', fontStyle: 'bold' }).setOrigin(0.5);
    const p1Portrait = this.add.image(cam.centerX - 420, 525, p1.portrait.key);
    const p2Portrait = this.add.image(cam.centerX + 420, 525, p2.portrait.key).setFlipX(true);
    placeNormalizedPortrait(p1Portrait, p1.id, cam.centerX - 420, 525, 350);
    placeNormalizedPortrait(p2Portrait, p2.id, cam.centerX + 420, 525, 350);
    this.add.text(cam.centerX, 480, `${this.result.p1Wins}   —   ${this.result.p2Wins}`, { color: '#fff9e8', fontFamily: 'monospace', fontSize: '88px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 8 }).setOrigin(0.5);
    this.add.text(cam.centerX - 420, 740, `${this.result.p1Wins} ROUNDS WON`, { color: '#b4dfff', fontFamily: 'monospace', fontSize: '24px' }).setOrigin(0.5);
    this.add.text(cam.centerX + 420, 740, `${this.result.p2Wins} ROUNDS WON`, { color: '#ffbdc6', fontFamily: 'monospace', fontSize: '24px' }).setOrigin(0.5);
    this.add.text(cam.centerX, 920, 'FINAL SCORE  /  BEST OF THREE', { color: '#9aa9c9', fontFamily: 'monospace', fontSize: '20px' }).setOrigin(0.5);
    this.add.text(cam.centerX, 1130, 'RESULTS  •  CHAMPION PRESENTATION FOLLOWS', { color: '#d4d9eb', fontFamily: 'monospace', fontSize: '19px' }).setOrigin(0.5);
  }

  private showChampion(): void {
    if (this.state !== 'score') return;
    this.state = 'champion';
    this.children.removeAll(true);
    const cam = this.cameras.main;
    const winnerId = this.result.winner === 1 ? this.result.config.p1CharacterId : this.result.config.p2CharacterId;
    const loserId = this.result.winner === 1 ? this.result.config.p2CharacterId : this.result.config.p1CharacterId;
    const winner = getCharacterDefinition(winnerId);
    const loser = getCharacterDefinition(loserId);
    const playerWon = this.result.winner === 1;
    this.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x02040d);
    this.add.text(cam.centerX, 92, playerWon ? 'YOU ARE THE CHAMPION!' : 'THE CHALLENGER WINS', { color: '#ffd352', fontFamily: 'monospace', fontSize: '48px', fontStyle: 'bold', stroke: '#401620', strokeThickness: 7 }).setOrigin(0.5);
    const winnerPortrait = this.add.image(cam.centerX - 510, 480, winner.portrait.key);
    placeNormalizedPortrait(winnerPortrait, winner.id, cam.centerX - 510, 480, 570);
    this.add.text(cam.centerX - 510, 810, winner.label.toUpperCase(), { color: '#ffe5a8', fontFamily: 'monospace', fontSize: '34px', fontStyle: 'bold', align: 'center', wordWrap: { width: 620 } }).setOrigin(0.5);
    this.add.text(cam.centerX - 510, 865, getFighterOrigin(winnerId).country, { color: '#74d6ff', fontFamily: 'monospace', fontSize: '21px' }).setOrigin(0.5);
    this.add.text(cam.centerX - 510, 940, `“${getFighterOrigin(winnerId).slogan}”`, { color: '#f3d6a1', fontFamily: 'monospace', fontSize: '19px', align: 'center', wordWrap: { width: 720 } }).setOrigin(0.5);

    const defeatedKey = `${loserId}-defeated-portrait`;
    const loserPortrait = this.add.image(cam.centerX + 500, 710, this.textures.exists(defeatedKey) ? defeatedKey : loser.portrait.key)
      .setTint(this.textures.exists(defeatedKey) ? 0xffffff : 0x8a7373).setRotation(-0.08);
    if (this.textures.exists(defeatedKey)) loserPortrait.setDisplaySize(540, 540);
    else placeNormalizedPortrait(loserPortrait, loser.id, cam.centerX + 500, 710, 460);
    this.add.text(cam.centerX + 500, 1030, `DEFEATED  •  ${loser.label.toUpperCase()}`, { color: '#ff8992', fontFamily: 'monospace', fontSize: '21px', align: 'center', wordWrap: { width: 540 } }).setOrigin(0.5);

    if (!playerWon) {
      this.add.rectangle(cam.centerX, 620, 570, 164, 0x07112b, 0.95).setStrokeStyle(6, 0xffd34f).setDepth(18);
      this.countText = this.add.text(cam.centerX, 598, '', { color: '#fff3c6', fontFamily: 'monospace', fontSize: '58px', fontStyle: 'bold', stroke: '#781e2c', strokeThickness: 8 }).setOrigin(0.5).setDepth(19);
      this.add.text(cam.centerX, 665, 'PRESS ENTER / SPACE TO CONTINUE', { color: '#83d5ff', fontFamily: 'monospace', fontSize: '19px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(19);
      this.updateCountdown();
      this.countdown = this.time.addEvent({ delay: 1000, repeat: 7, callback: () => {
        this.count -= 1;
        if (this.count <= 0) { this.returnToMenu(); return; }
        this.updateCountdown();
      }});
    } else {
      const nextText = this.result.config.mode === 'arcade' ? 'NEXT OPPONENT  (N)' : 'REMATCH  (R)';
      this.add.text(cam.centerX, 1085, `${nextText}         MAIN MENU  (ESC)`, { color: '#e5edff', fontFamily: 'monospace', fontSize: '23px', backgroundColor: '#151b32', padding: { x: 18, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onConfirm());
      this.add.text(cam.centerX, 1150, 'PRESS ENTER / SPACE TO CONTINUE', { color: '#83d5ff', fontFamily: 'monospace', fontSize: '19px' }).setOrigin(0.5);
    }
  }

  private updateCountdown(): void { this.countText?.setText(`CONTINUE? ${String(this.count).padStart(2, '0')}`); }

  private onConfirm(): void {
    if (this.state === 'score') { this.showChampion(); return; }
    if (this.result.winner === 2) {
      this.countdown?.remove();
      this.scene.start(SCENE_KEYS.Match, { ...this.result.config, arcadeFight: this.result.config.arcadeFight ?? 0 });
      return;
    }
    if (this.result.config.mode === 'arcade') {
      this.scene.start(SCENE_KEYS.CharacterSelect, { mode: this.result.config.mode, p1CharacterId: this.result.config.p1CharacterId });
      return;
    }
    this.scene.start(SCENE_KEYS.Match, this.result.config);
  }

  private returnToMenu(): void { this.countdown?.remove(); this.scene.start(SCENE_KEYS.MainMenu); }
}

