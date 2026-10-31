import * as Phaser from 'phaser';

import { Fighter, NEUTRAL_FIGHTER_INPUT, type FighterInput } from '../game/fighter';
import { getFighterStats } from '../game/fighterConfig';
import { getStageDefinition } from '../game/stageConfig';
import { MotionInputBuffer } from '../game/motionInput';
import { SCENE_KEYS, type NormalAttackId } from '../game/types';
import { getFighterEnergyStyle, spawnElementalImpact } from '../game/vfx';
import { BaseScene } from './BaseScene';

/** Fixed-axis sandbox for tuning stats, bounds, attacks, and the training dummy. */
export class FighterPlaygroundScene extends BaseScene {
  private player!: Fighter;
  private dummy!: Fighter;
  private backdrop!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private previousCharacterId = '';
  private attackSignature = -1;
  private dummyHealthFill!: Phaser.GameObjects.Rectangle;
  private dummyHealth = 1;
  private healthRegenTimer = 0;
  private motionInput = new MotionInputBuffer();

  constructor() {
    super(SCENE_KEYS.FighterPlayground);
  }

  create(): void {
    this.markActiveScene(SCENE_KEYS.FighterPlayground);
    const { width, height, centerX } = this.cameras.main;
    const groundY = height * 0.82;
    const stage = getStageDefinition('rooftop-twilight');
    this.backdrop = this.add.image(centerX, groundY, stage.key).setOrigin(0.5, 1).setDisplaySize(width * 1.2, height);
    this.add.rectangle(centerX, groundY, width, height * 0.36, 0x020617, 0.25).setOrigin(0.5, 0);
    this.createHeading('Fighter Playground', 'Move, attack, and tune the selected fighter against a regenerating dummy');
    this.add.rectangle(width - 280, 140, 220, 18, 0x0f172a).setOrigin(0, 0.5).setDepth(90);
    this.dummyHealthFill = this.add.rectangle(width - 278, 140, 216, 12, 0x22c55e).setOrigin(0, 0.5).setDepth(91);
    this.add.text(width - 280, 119, 'TRAINING DUMMY', { color: '#e2e8f0', fontFamily: 'monospace', fontSize: '12px' }).setDepth(91);
    this.createFooterHint('A/D move  W jump  S crouch  I/O/P punch  K/L/; kick  U throw  V super  •  ESC menu');

    this.keys = {};
    const keyboard = this.input.keyboard;
    if (keyboard) {
      const codes = Phaser.Input.Keyboard.KeyCodes;
      const mapping: Record<string, number> = {
        left: codes.A, right: codes.D, crouch: codes.S, jump: codes.W, block: codes.C,
        lightPunch: codes.I, mediumPunch: codes.O, heavyPunch: codes.P,
        lightKick: codes.K, mediumKick: codes.L, heavyKick: codes.SEMICOLON,
        grab: codes.U, special: codes.V
      };
      Object.entries(mapping).forEach(([name, code]) => { this.keys[name] = keyboard.addKey(code); });
      keyboard.on('keydown-ESC', () => this.goToMenu());
      keyboard.on('keydown-BACKSPACE', () => this.goToMenu());
    }
    this.syncFighters();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard?.removeAllListeners());
  }

  update(_time: number, delta: number): void {
    this.syncFighters();
    const seconds = Math.min(0.05, delta / 1000);
    const state = this.app.debugStore.getState().fighterPlayground;
    const stats = getFighterStats(state, state.characterId);
    this.player.setVisualScale(stats.scale);
    this.player.setHorizontalBounds(100, this.cameras.main.width * 0.55);
    this.dummy.setHorizontalBounds(this.cameras.main.width * 0.64, this.cameras.main.width - 100);
    this.player.faceToward(this.dummy.x);
    if (state.fillSpecial) this.player.fillMeter();
    const input = this.readInput(_time);
    this.player.update(seconds, input);
    if (input.throw) this.player.throwTarget(this.dummy);
    this.dummy.update(seconds, NEUTRAL_FIGHTER_INPUT);
    this.resolvePlayerHit();
    this.updateDummyHealth(seconds);
  }

  private syncFighters(): void {
    const state = this.app.debugStore.getState().fighterPlayground;
    if (this.player && this.previousCharacterId === state.characterId) return;
    this.player?.destroy();
    this.dummy?.destroy();
    this.previousCharacterId = state.characterId;
    const { width, height } = this.cameras.main;
    const groundY = height * 0.82;
    const minX = 100;
    const maxX = width - 100;
    this.player = new Fighter({ scene: this, app: this.app, characterId: state.characterId, x: width * 0.28, groundY, facing: 1, minX, maxX, depth: 10 });
    const dummyId = state.characterId === 'jiujitsu-fighter' ? 'green-boxer' : 'jiujitsu-fighter';
    this.dummy = new Fighter({ scene: this, app: this.app, characterId: dummyId, x: width * 0.72, groundY, facing: -1, minX, maxX, depth: 10 });
    this.player.setFrozen(false);
    this.dummy.setFrozen(true);
    this.dummyHealth = 1;
    this.healthRegenTimer = 0;
    this.attackSignature = -1;
    this.backdrop?.setTexture(getStageDefinition('rooftop-twilight').key);
  }

  private readInput(time: number): FighterInput {
    const just = (key: string): boolean => Phaser.Input.Keyboard.JustDown(this.keys[key]);
    const attackEntries: Array<[NormalAttackId, string]> = [
      ['light-punch', 'lightPunch'], ['medium-punch', 'mediumPunch'], ['heavy-punch', 'heavyPunch'],
      ['light-kick', 'lightKick'], ['medium-kick', 'mediumKick'], ['heavy-kick', 'heavyKick']
    ];
    const attack = attackEntries.find(([, key]) => just(key))?.[0] ?? null;
    const left = this.keys.left?.isDown ?? false;
    const right = this.keys.right?.isDown ?? false;
    const crouch = this.keys.crouch?.isDown ?? false;
    const heldAttacks = attackEntries.filter(([, key]) => this.keys[key]?.isDown).map(([id]) => id);
    this.motionInput.sample(left, right, crouch, this.player.facingDirection, time, this.keys.jump?.isDown ?? false, heldAttacks);
    const activation = this.motionInput.consume(attack, time, this.player.characterId, heldAttacks, !this.player.isGrounded,
      Math.abs(this.dummy.x - this.player.x));
    const specialMove = activation?.move ?? null;
    return {
      left,
      right,
      crouch,
      block: this.keys.block?.isDown ?? false,
      jump: !specialMove && just('jump'),
      attack: specialMove ? null : attack,
      throw: just('grab'),
      special: just('special'),
      specialMove,
      specialStrength: specialMove ? activation?.attack ?? attack : null,
      specialName: activation?.label ?? null
    };
  }

  private resolvePlayerHit(): void {
    const attack = this.player.getActiveAttack();
    if (!attack || attack.signature === this.attackSignature) return;
    const hurt = this.dummy.getHurtRect();
    if (hurt && Phaser.Geom.Intersects.RectangleToRectangle(attack.rect, hurt)) {
      const guard = this.dummy.getGuardRect();
      const blocked = guard !== null && Phaser.Geom.Intersects.RectangleToRectangle(attack.rect, guard);
      const element = attack.profile.kind === 'special' ? getFighterEnergyStyle(this.player.characterId).element : undefined;
      const tint = element ? getFighterEnergyStyle(this.player.characterId).primary : undefined;
      this.dummy.applyHit(attack.profile, this.player.facingDirection, blocked, { element, tint });
      this.dummy.flashHit(blocked, tint);
      this.player.registerOffense(blocked, attack.profile.kind === 'special');
      this.dummy.registerDefense(blocked);
      this.attackSignature = attack.signature;
      this.dummyHealth = this.dummy.health01;
      if (this.dummy.isDefeated) {
        this.dummy.resetForRound(this.dummy.x, -1);
        this.dummy.setFrozen(true);
        this.dummyHealth = 1;
      }
      this.healthRegenTimer = 0;
      this.add.circle((attack.rect.centerX + hurt.centerX) / 2, (attack.rect.centerY + hurt.centerY) / 2, 16, blocked ? 0x60a5fa : 0xfbbf24, 0.9)
        .setDepth(95)
        .setBlendMode(Phaser.BlendModes.ADD);
      if (element && !blocked) {
        spawnElementalImpact(this, this.player.characterId, hurt.centerX, hurt.centerY, element);
      }
    }
  }

  private updateDummyHealth(seconds: number): void {
    this.healthRegenTimer += seconds;
    if (this.healthRegenTimer > 0.7 && this.dummyHealth < 1) {
      this.dummy.regenHealth(16 * seconds);
      this.dummyHealth = this.dummy.health01;
    }
    this.dummyHealthFill.width = Math.max(1, 216 * this.dummyHealth);
    this.dummyHealthFill.fillColor = this.dummyHealth < 0.28 ? 0xef4444 : this.dummyHealth < 0.58 ? 0xf59e0b : 0x22c55e;
  }
}
