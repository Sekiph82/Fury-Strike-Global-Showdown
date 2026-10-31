import * as Phaser from 'phaser';

import { FIGHTER_CHARACTER_DEFINITIONS } from '../game/hero';
import { formatSpecialCommand, getFighterSpecialCommands, getFighterSpecialStyle, type SpecialRule } from '../game/motionInput';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

const MOVE_PANEL_HEIGHT = 128;

/** A browsable command guide generated directly from the match input rules. */
export class TrainingScene extends BaseScene {
  private selectedIndex = 0;
  private content: Phaser.GameObjects.GameObject[] = [];
  private returningToModes = false;

  constructor() {
    super(SCENE_KEYS.Training);
  }

  create(): void {
    this.returningToModes = false;
    this.markActiveScene(SCENE_KEYS.Training);
    this.cameras.main.setBackgroundColor(0x020617);
    this.createHeading('Training Room', 'Choose a fighter to review their special commands');
    this.renderCharacter();

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-LEFT', () => this.changeFighter(-1));
    keyboard?.on('keydown-A', () => this.changeFighter(-1));
    keyboard?.on('keydown-RIGHT', () => this.changeFighter(1));
    keyboard?.on('keydown-D', () => this.changeFighter(1));
    keyboard?.on('keydown-ESC', () => this.returnToModes());
    keyboard?.on('keydown-BACKSPACE', () => this.returnToModes());
    this.createFooterHint('← / → / A / D: fighter • Esc: mode select');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
      this.clearContent();
    });
  }

  private returnToModes(): void {
    if (this.returningToModes) return;
    this.returningToModes = true;
    this.input.keyboard?.removeAllListeners();
    // Leave the Escape dispatch stack before the destination installs its own
    // keyboard handlers; this does not depend on the scene clock advancing.
    queueMicrotask(() => {
      if (this.scene.isActive(SCENE_KEYS.Training)) this.scene.start(SCENE_KEYS.ModeSelect);
    });
  }

  private changeFighter(direction: number): void {
    this.selectedIndex = Phaser.Math.Wrap(
      this.selectedIndex + direction,
      0,
      FIGHTER_CHARACTER_DEFINITIONS.length
    );
    this.clearContent();
    this.renderCharacter();
  }

  private renderCharacter(): void {
    const character = FIGHTER_CHARACTER_DEFINITIONS[this.selectedIndex];
    if (!character) return;

    const { width, height, centerX, centerY } = this.cameras.main;
    const compact = width < 1450;
    const portraitCardWidth = compact ? Math.min(520, width - 48) : Math.min(520, width * 0.28);
    const portraitCardHeight = compact ? 510 : 660;
    const cardX = compact ? centerX : Math.max(portraitCardWidth / 2 + 32, width * 0.2);
    const cardY = compact ? height * 0.25 : centerY + 16;
    const card = this.add.rectangle(cardX, cardY, portraitCardWidth, portraitCardHeight, 0x0f172a, 1)
      .setStrokeStyle(3, 0x38bdf8, 1);
    this.content.push(card);

    if (this.textures.exists(character.portrait.key)) {
      const portraitSize = compact ? Math.min(360, portraitCardWidth - 48) : Math.min(470, portraitCardWidth - 48);
      const portrait = this.add.image(cardX, cardY - (compact ? 34 : 42), character.portrait.key)
        .setDisplaySize(portraitSize, portraitSize);
      this.content.push(portrait);
    }

    const name = this.add.text(cardX, cardY + (compact ? 174 : 258), character.label, {
      color: '#f8fafc', fontFamily: 'monospace', fontSize: compact ? '21px' : '25px', fontStyle: 'bold',
      align: 'center', wordWrap: { width: 480 }
    }).setOrigin(0.5);
    this.content.push(name);

    const navOffset = Math.min(205, portraitCardWidth / 2 - 42);
    const navY = cardY + (compact ? 218 : 294);
    const previous = this.add.text(cardX - navOffset, navY, '◀', {
      color: '#7dd3fc', fontFamily: 'monospace', fontSize: '34px'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const next = this.add.text(cardX + navOffset, navY, '▶', {
      color: '#7dd3fc', fontFamily: 'monospace', fontSize: '34px'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    previous.on('pointerdown', () => this.changeFighter(-1));
    next.on('pointerdown', () => this.changeFighter(1));
    this.content.push(previous, next);

    const moves = getFighterSpecialCommands(character.id);
    const style = getFighterSpecialStyle(character.id);
    const panelCenterX = compact ? centerX : width * 0.705;
    const panelWidth = compact ? width - 40 : Math.min(1120, width * 0.54);
    const headerY = compact ? cardY + portraitCardHeight / 2 + 38 : 236;
    const header = this.add.text(panelCenterX, headerY, `${character.label.toUpperCase()} • ${style} STYLE`, {
      color: '#facc15', fontFamily: 'monospace', fontSize: compact ? '21px' : '26px', fontStyle: 'bold',
      wordWrap: { width: panelWidth - 24 }, align: 'center'
    }).setOrigin(0.5);
    const keyLegend = this.add.text(panelCenterX, headerY + 42, 'PUNCH  I / O / P     •     KICK  K / L / ;', {
      color: '#7dd3fc', fontFamily: 'monospace', fontSize: compact ? '17px' : '21px', fontStyle: 'bold',
      wordWrap: { width: panelWidth - 24 }, align: 'center'
    }).setOrigin(0.5);
    const directionHint = this.add.text(panelCenterX, headerY + 74, 'SPECIAL COMMANDS • ASSUME FACING RIGHT; REVERSE LEFT / RIGHT WHEN FACING LEFT', {
      color: '#aab6d1', fontFamily: 'monospace', fontSize: compact ? '12px' : '15px',
      wordWrap: { width: panelWidth - 24 }, align: 'center'
    }).setOrigin(0.5);
    this.content.push(header, keyLegend, directionHint);

    const rowCount = Math.max(moves.length, 1);
    const spacing = compact
      ? Math.min(145, (height - headerY - 190) / rowCount)
      : Math.min(145, 570 / rowCount);
    const groupCenterY = compact ? (headerY + height - 92) / 2 + 68 : centerY + 82;
    const startY = groupCenterY - ((rowCount - 1) * spacing) / 2;
    moves.forEach((move, index) => this.renderMove(move, panelCenterX, startY + index * spacing, panelWidth, compact));
  }

  private renderMove(move: SpecialRule, centerX: number, centerY: number, panelWidth: number, compact: boolean): void {
    const panel = this.add.rectangle(centerX, centerY, panelWidth, MOVE_PANEL_HEIGHT, 0x0f172a, 0.97)
      .setStrokeStyle(2, 0x334155, 1);
    const left = centerX - panelWidth / 2 + (compact ? 18 : 28);
    const title = this.add.text(left, centerY - 43, move.label, {
      color: '#f8fafc', fontFamily: 'monospace', fontSize: compact ? '20px' : '23px', fontStyle: 'bold',
      wordWrap: { width: panelWidth - (compact ? 36 : 56) }
    });
    const command = this.add.text(left, centerY - 10, formatSpecialCommand(move), {
      color: '#7dd3fc', fontFamily: 'monospace', fontSize: compact ? '18px' : '20px', fontStyle: 'bold'
    });
    const detail = this.add.text(left, centerY + 25, detailFor(move), {
      color: '#c3cde1', fontFamily: 'monospace', fontSize: compact ? '13px' : '16px',
      wordWrap: { width: panelWidth - (compact ? 36 : 56) }
    });
    this.content.push(panel, title, command, detail);
  }

  private clearContent(): void {
    this.content.forEach((object) => object.destroy());
    this.content = [];
  }
}

function detailFor(move: SpecialRule): string {
  if (move.pattern === 'charge-back-forward' || move.pattern === 'charge-down-up') {
    return 'LIGHT / MEDIUM / HEAVY strength comes from the button you finish with.';
  }
  if (move.pattern === 'rapid-punch' || move.pattern === 'rapid-kick') {
    return 'Keep the taps quick; use any one of the listed attack keys.';
  }
  if (move.pattern === 'air-followup') {
    return 'Perform Head Press first, then use its airborne punch follow-up.';
  }
  if (move.pattern === 'air-directional-followup') {
    return 'Perform Flying Barcelona first; approach the opponent before pressing a direction and punch.';
  }
  if (move.pattern === 'hold-triple-release' || move.pattern === 'triple-punch') {
    return move.pattern === 'triple-punch'
      ? 'Press all three punch keys at the same time.'
      : 'Hold all three punch keys or all three kick keys, then release for Turn Punch.';
  }
  return 'LIGHT / MEDIUM / HEAVY strength comes from I/K, O/L, or P/; respectively.';
}
