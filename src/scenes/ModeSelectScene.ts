import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { createSelectionCard, type SelectionCard } from '../game/ui';
import { SCENE_KEYS, type MatchMode } from '../game/types';
import { BaseScene } from './BaseScene';

interface ModeOption {
  mode: MatchMode | 'training';
  title: string;
  subtitle: string;
  texture?: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { mode: '1vcpu', title: '1 VS CPU', subtitle: 'Choose a fighter and face the CPU', texture: 'mode-card-1vcpu' },
  { mode: 'arcade', title: 'ARCADE', subtitle: 'Win a run of CPU fights', texture: 'mode-card-arcade' },
  { mode: 'training', title: 'TRAINING', subtitle: 'Learn every fighter’s special moves', texture: 'mode-card-training' }
];

const ACCENT = 0x38bdf8;

/**
 * First step of the Play flow: select a CPU match, Arcade run, or Training.
 */
export class ModeSelectScene extends BaseScene {
  private cards: SelectionCard[] = [];
  private selectedIndex = 0;
  private transitioning = false;

  constructor() {
    super(SCENE_KEYS.ModeSelect);
  }

  create(): void {
    this.cards = [];
    this.selectedIndex = 0;
    this.transitioning = false;

    this.markActiveScene(SCENE_KEYS.ModeSelect);
    this.cameras.main.setBackgroundColor(0x020617);
    this.createHeading('Select Mode', 'How do you want to play?');

    this.buildCards();
    this.registerInput();
    this.setSelection(0);

    this.createFooterHint('← → / A D to choose • Enter / Space to confirm • Esc to go back');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // Keyboard events are registered on this scene's input plugin. Clear
      // them whenever the mode screen is left so reopening it cannot stack
      // duplicate confirm handlers and start the next scene multiple times.
      this.input.keyboard?.removeAllListeners();
      this.cards.forEach((card) => card.destroy());
      this.cards = [];
    });
  }

  private buildCards(): void {
    const { centerX, centerY } = this.cameras.main;
    const cardWidth = 320;
    const cardHeight = 260;
    const gap = 60;
    const totalWidth = cardWidth * MODE_OPTIONS.length + gap * (MODE_OPTIONS.length - 1);
    const startX = centerX - totalWidth / 2 + cardWidth / 2;

    MODE_OPTIONS.forEach((option, index) => {
      const card = createSelectionCard(this, {
        x: startX + index * (cardWidth + gap),
        y: centerY + 10,
        width: cardWidth,
        height: cardHeight,
        title: option.title,
        subtitle: option.subtitle,
        texture: option.texture,
        imageMaxSize: 168,
        imageOffsetY: -46,
        onHover: () => this.setSelection(index),
        onClick: () => this.confirm(index)
      });

      this.cards.push(card);
    });
  }

  private registerInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    keyboard.on('keydown-LEFT', () => this.moveSelection(-1));
    keyboard.on('keydown-A', () => this.moveSelection(-1));
    keyboard.on('keydown-RIGHT', () => this.moveSelection(1));
    keyboard.on('keydown-D', () => this.moveSelection(1));
    keyboard.on('keydown-ENTER', () => this.confirm(this.selectedIndex));
    keyboard.on('keydown-SPACE', () => this.confirm(this.selectedIndex));
    keyboard.on('keydown-ESC', () => this.returnToMenu());
    keyboard.on('keydown-BACKSPACE', () => this.returnToMenu());
  }

  private moveSelection(direction: number): void {
    const next = Phaser.Math.Wrap(this.selectedIndex + direction, 0, this.cards.length);
    this.setSelection(next);
  }

  private setSelection(index: number): void {
    this.selectedIndex = index;
    this.cards.forEach((card, cardIndex) => card.setSelected(cardIndex === index, ACCENT));
  }

  private confirm(index: number): void {
    if (this.transitioning) return;
    const option = MODE_OPTIONS[index];
    if (!option) return;
    this.transitioning = true;
    this.setSelection(index);
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
    const mode = option.mode;
    // Leave the keyboard dispatch stack before starting the next scene. A
    // zero-delay Phaser timer can stall if its scene clock is paused/reset.
    queueMicrotask(() => {
      if (!this.scene.isActive(SCENE_KEYS.ModeSelect)) return;
      if (mode === 'training') {
        this.scene.start(SCENE_KEYS.Training);
        return;
      }
      this.scene.start(SCENE_KEYS.CharacterSelect, { mode });
    });
  }

  private returnToMenu(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    queueMicrotask(() => {
      if (this.scene.isActive(SCENE_KEYS.ModeSelect)) this.goToMenu();
    });
  }
}
