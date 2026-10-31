import * as Phaser from 'phaser';

import type { FighterInput } from '../fighter';
import type { NormalAttackId } from '../types';

type TouchAction = 'left' | 'right' | 'down' | 'jump' | 'block' | 'throw' | 'special' | NormalAttackId;

interface TouchButton {
  action: TouchAction;
  pointerId: number | null;
  container: Phaser.GameObjects.Container;
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

const DEPTH = 140;
const DIRECTION_RADIUS = 32;
const ACTION_RADIUS = 25;

/** On-screen controls for a single-player touch match. */
export class MobileFightControls {
  private readonly buttons: TouchButton[] = [];
  private enabled = true;
  private pendingAttack: NormalAttackId | null = null;
  private pendingJump = false;
  private pendingThrow = false;
  private pendingSpecial = false;

  constructor(private readonly scene: Phaser.Scene) {
    scene.input.addPointer(4);
    this.createPad();
    this.createActionButtons();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.buttons.forEach((button) => {
      button.container.setVisible(enabled);
      button.container.disableInteractive();
      if (enabled) button.container.setInteractive({ useHandCursor: false });
      button.pointerId = null;
    });
  }

  readInput(): Partial<FighterInput> {
    const held = (action: TouchAction): boolean => this.buttons.some(
      (button) => button.action === action && button.pointerId !== null
    );
    const input: Partial<FighterInput> = {
      left: held('left'),
      right: held('right'),
      crouch: held('down'),
      block: held('block'),
      jump: this.pendingJump || held('jump'),
      attack: this.pendingAttack,
      throw: this.pendingThrow,
      special: this.pendingSpecial
    };
    this.pendingAttack = null;
    this.pendingJump = false;
    this.pendingThrow = false;
    this.pendingSpecial = false;
    return input;
  }

  destroy(): void {
    this.buttons.forEach(({ container }) => container.destroy(true));
    this.buttons.length = 0;
  }

  private createPad(): void {
    const { height } = this.scene.scale;
    const centerX = 116;
    const centerY = height - 114;
    this.addButton('left', '◀', centerX - 42, centerY, DIRECTION_RADIUS);
    this.addButton('right', '▶', centerX + 42, centerY, DIRECTION_RADIUS);
    this.addButton('jump', '▲', centerX, centerY - 48, DIRECTION_RADIUS);
    this.addButton('down', '▼', centerX, centerY + 48, DIRECTION_RADIUS);
  }

  private createActionButtons(): void {
    const { width, height } = this.scene.scale;
    const columns = [width - 216, width - 150, width - 84];
    const rows = [height - 76, height - 132];
    const attacks: NormalAttackId[] = [
      'light-punch', 'medium-punch', 'heavy-punch',
      'light-kick', 'medium-kick', 'heavy-kick'
    ];
    const labels = ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'];
    attacks.forEach((attack, index) => this.addButton(
      attack,
      labels[index],
      columns[index % 3],
      rows[Math.floor(index / 3)],
      ACTION_RADIUS
    ));

    this.addButton('throw', 'GRAB', width - 218, height - 190, ACTION_RADIUS);
    this.addButton('block', 'GUARD', width - 150, height - 190, ACTION_RADIUS);
    this.addButton('special', 'SUPER', width - 82, height - 190, ACTION_RADIUS);
  }

  private addButton(action: TouchAction, text: string, x: number, y: number, radius: number): void {
    const circle = this.scene.add.circle(0, 0, radius, 0x111827, 0.78)
      .setStrokeStyle(2, 0x7dd3fc, 0.9);
    const label = this.scene.add.text(0, 0, text, {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: radius > 28 ? '22px' : '11px',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    const container = this.scene.add.container(x, y, [circle, label])
      .setSize(radius * 2, radius * 2)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: false });
    const button: TouchButton = { action, pointerId: null, container, circle, label };
    this.buttons.push(button);

    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.enabled || button.pointerId !== null) return;
      button.pointerId = pointer.id;
      circle.setFillStyle(0x0284c7, 0.95);
      this.trigger(action);
    });
    const release = (pointer: Phaser.Input.Pointer): void => {
      if (button.pointerId !== pointer.id) return;
      button.pointerId = null;
      circle.setFillStyle(0x111827, 0.78);
    };
    container.on('pointerup', release);
    container.on('pointerupoutside', release);
  }

  private trigger(action: TouchAction): void {
    if (action.endsWith('punch') || action.endsWith('kick')) {
      this.pendingAttack = action as NormalAttackId;
    } else if (action === 'jump') {
      this.pendingJump = true;
    } else if (action === 'throw') {
      this.pendingThrow = true;
    } else if (action === 'special') {
      this.pendingSpecial = true;
    }
  }
}
