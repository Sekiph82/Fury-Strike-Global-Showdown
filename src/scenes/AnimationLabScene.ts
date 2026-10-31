import * as Phaser from 'phaser';

import { getCharacterAnimationDefinition, getCharacterDefinition, resolveHeroBoundsFrame } from '../game/hero';
import type { CharacterBoundsKind, CharacterGymBoundsEdit, CharacterGymDebugState } from '../game/types';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

const BOUNDS_COLORS: Record<CharacterBoundsKind, number> = {
  visual: 0x38bdf8,
  collision: 0xfacc15,
  hit: 0x22c55e,
  attack: 0xf43f5e,
  guard: 0xa855f7
};

/** Live sprite-sheet and per-frame box authoring surface driven by the sidebar state. */
export class AnimationLabScene extends BaseScene {
  private fighter!: Phaser.GameObjects.Sprite;
  private overlay!: Phaser.GameObjects.Graphics;
  private elapsedFrame = 0;
  private drag: { pointerX: number; pointerY: number; edit: CharacterGymBoundsEdit } | null = null;

  constructor() {
    super(SCENE_KEYS.AnimationLab);
  }

  create(): void {
    this.markActiveScene(SCENE_KEYS.AnimationLab);
    const { centerX, height } = this.cameras.main;
    this.add.rectangle(centerX, height * 0.78, this.cameras.main.width, height * 0.44, 0x111827);
    this.add.rectangle(centerX, height * 0.56, this.cameras.main.width, 2, 0x334155, 0.8);
    this.createHeading('Character Gym', 'Pick an animation in the sidebar, pause on a frame, and drag its bounds');
    this.fighter = this.add.sprite(centerX, height * 0.82, 'red-brawler-idle', 0)
      .setOrigin(0.5, 255 / 256)
      .setScale(1.55);
    this.overlay = this.add.graphics().setDepth(10);
    this.add.text(24, 130, 'Q: move gizmo   W: scale gizmo   ESC: return to menu', {
      color: '#cbd5e1', fontFamily: 'monospace', fontSize: '14px'
    });

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-Q', (event: KeyboardEvent) => {
      event.preventDefault();
      this.patchGym((gym) => ({ ...gym, gizmoMode: 'translate' }));
    });
    keyboard?.on('keydown-W', (event: KeyboardEvent) => {
      event.preventDefault();
      this.patchGym((gym) => ({ ...gym, gizmoMode: 'scale' }));
    });
    keyboard?.on('keydown-ESC', () => this.goToMenu());
    keyboard?.on('keydown-BACKSPACE', () => this.goToMenu());

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.beginDrag(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.moveDrag(pointer));
    this.input.on('pointerup', () => { this.drag = null; });
    this.input.on('pointerupoutside', () => { this.drag = null; });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.removeAllListeners();
      this.input.removeAllListeners();
    });
  }

  update(_time: number, delta: number): void {
    const gym = this.app.debugStore.getState().characterGym;
    const animation = getCharacterAnimationDefinition(gym.characterId, gym.animationKey);
    if (!gym.paused) {
      this.elapsedFrame += delta * animation.frameRate * gym.playbackSpeed / 1000;
      const frame = Math.floor(this.elapsedFrame) % animation.sheet.frames;
      if (frame !== gym.frame) {
        this.app.debugStore.patchState({ characterGym: { ...gym, frame } });
      }
    } else {
      this.elapsedFrame = gym.frame;
    }

    const frame = Phaser.Math.Clamp(gym.frame, 0, animation.sheet.frames - 1);
    if (this.fighter.texture.key !== animation.sheet.key) {
      this.fighter.setTexture(animation.sheet.key, frame);
    } else {
      this.fighter.setFrame(frame);
    }
    this.fighter.setFlipX(getCharacterDefinition(gym.characterId).facing === 'east');
    this.drawBounds(gym, animation, frame);
  }

  private drawBounds(gym: CharacterGymDebugState, animation: ReturnType<typeof getCharacterAnimationDefinition>, frame: number): void {
    this.overlay.clear();
    const bounds = resolveHeroBoundsFrame(animation, frame, gym.boundsOverrides);
    const frameWidth = animation.sheet.frameWidth;
    const frameHeight = animation.sheet.frameHeight;
    const left = this.fighter.x - this.fighter.displayWidth * this.fighter.originX;
    const top = this.fighter.y - this.fighter.displayHeight * this.fighter.originY;
    const scaleX = this.fighter.displayWidth / frameWidth;
    const scaleY = this.fighter.displayHeight / frameHeight;

    (Object.keys(BOUNDS_COLORS) as CharacterBoundsKind[]).forEach((kind) => {
      const rect = bounds[kind];
      if (!rect) return;
      const localX = this.fighter.flipX ? frameWidth - rect.x - rect.width : rect.x;
      const x = left + localX * scaleX;
      const y = top + rect.y * scaleY;
      const width = rect.width * scaleX;
      const height = rect.height * scaleY;
      const selected = gym.selectedBoundsKind === kind;
      const alpha = selected ? 0.95 : 0.38;
      this.overlay.fillStyle(BOUNDS_COLORS[kind], selected ? 0.14 : 0.06);
      this.overlay.fillRect(x, y, width, height);
      this.overlay.lineStyle(selected ? 3 : 1.5, BOUNDS_COLORS[kind], alpha);
      this.overlay.strokeRect(x, y, width, height);
      if (selected) {
        this.overlay.fillStyle(0xffffff, 1);
        this.overlay.fillCircle(x + width / 2, y + height / 2, 5);
        this.overlay.lineStyle(2, 0xffffff, 0.9);
        this.overlay.lineBetween(x + width / 2 - 14, y + height / 2, x + width / 2 + 14, y + height / 2);
        this.overlay.lineBetween(x + width / 2, y + height / 2 - 14, x + width / 2, y + height / 2 + 14);
      }
    });
  }

  private beginDrag(pointer: Phaser.Input.Pointer): void {
    const state = this.app.debugStore.getState().characterGym;
    const animation = getCharacterAnimationDefinition(state.characterId, state.animationKey);
    const frame = resolveHeroBoundsFrame(animation, state.frame, state.boundsOverrides);
    const bounds = frame[state.selectedBoundsKind] ?? animation.bounds[state.frame]?.visual;
    if (!bounds) return;

    const frameWidth = animation.sheet.frameWidth;
    const left = this.fighter.x - this.fighter.displayWidth * this.fighter.originX;
    const top = this.fighter.y - this.fighter.displayHeight * this.fighter.originY;
    const localX = this.fighter.flipX ? frameWidth - bounds.x - bounds.width : bounds.x;
    const x = left + localX * (this.fighter.displayWidth / frameWidth);
    const y = top + bounds.y * (this.fighter.displayHeight / animation.sheet.frameHeight);
    const rect = new Phaser.Geom.Rectangle(x, y, bounds.width * this.fighter.displayWidth / frameWidth, bounds.height * this.fighter.displayHeight / animation.sheet.frameHeight);
    if (!rect.contains(pointer.worldX, pointer.worldY)) return;

    this.patchGym((gym) => ({ ...gym, paused: true }));
    this.drag = {
      pointerX: pointer.worldX,
      pointerY: pointer.worldY,
      edit: { ...bounds, active: Boolean(frame[state.selectedBoundsKind]) }
    };
  }

  private moveDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.drag || !pointer.isDown) return;
    const gym = this.app.debugStore.getState().characterGym;
    const kind = gym.selectedBoundsKind;
    const dx = (pointer.worldX - this.drag.pointerX) / (this.fighter.displayWidth / 256);
    const dy = (pointer.worldY - this.drag.pointerY) / (this.fighter.displayHeight / 256);
    const next = gym.gizmoMode === 'translate'
      ? { ...this.drag.edit, x: Math.round(this.drag.edit.x + dx), y: Math.round(this.drag.edit.y + dy) }
      : { ...this.drag.edit, width: Math.round(Phaser.Math.Clamp(this.drag.edit.width + dx * 2, 1, 256)), height: Math.round(Phaser.Math.Clamp(this.drag.edit.height + dy * 2, 1, 256)) };
    this.drag.pointerX = pointer.worldX;
    this.drag.pointerY = pointer.worldY;
    this.drag.edit = next;
    const currentFrame = gym.frame;
    this.app.debugStore.patchState({
      characterGym: {
        ...gym,
        boundsOverrides: {
          ...gym.boundsOverrides,
          [gym.animationKey]: {
            ...gym.boundsOverrides[gym.animationKey],
            [currentFrame]: {
              ...gym.boundsOverrides[gym.animationKey]?.[currentFrame],
              [kind]: next
            }
          }
        }
      }
    });
  }

  private patchGym(update: (gym: CharacterGymDebugState) => CharacterGymDebugState): void {
    const state = this.app.debugStore.getState();
    this.app.debugStore.patchState({ characterGym: update(state.characterGym) });
  }
}
