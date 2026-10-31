import * as Phaser from 'phaser';

import type { AppContext } from './context';
import { FIGHTER_BOUNDS_FIELDS, getAttackProfile, getFighterCombat, getFighterStats } from './fighterConfig';
import {
  findCharacterAnimationKeyByAction,
  getCharacterAnimationByAction,
  getCharacterAnimationDefinition,
  getCharacterDefinition,
  resolveHeroBoundsFrame,
  type CharacterDefinition,
  type HeroAnimationDefinition,
  type HeroBoundsFrame,
  type HadoukenSpawnPoint
} from './hero';
import { getFighterEnergyStyle, spawnChargeAura, spawnCrusherTrail, spawnElementalImpact, spawnRisingEnergy } from './vfx';
import { resolveAnimationSourceFacing, shouldFlipForFacing, transformFramePointAtPose } from './spriteCoordinates';
import { advanceThrowTravel, resolveThrowRotation, resolveThrownFacing } from './throwMotion';
import { isRisingSpecialMove, resolveRisingAnimationAction } from './specialMoveRouting';
import { resolveRisingArc } from './risingArc';
import { hasAttackWindowAfterGap, resolveNormalAttackAction, shouldKnockdownFromSweep } from './attackAnimation';
import type { FighterEnergyElement } from './vfx';
import type {
  AttackKind,
  AttackProfile,
  FighterSpecialMove,
  FighterBoundsVisibility,
  FighterCombat,
  FighterStats,
  Point,
  NormalAttackId,
  Rect
} from './types';

/** Deceleration applied to knockback velocity, in px/s^2. */
const KNOCKBACK_FRICTION = 720;
const THROW_TRAVEL_DURATION_MS = 620;
const THROW_TRAVEL_SPEED = 360;
/** Blockstun duration when an attack is guarded, in seconds. */
const BLOCKSTUN_SECONDS = 0.14;

/** Full meter value; a special requires (and consumes) a full bar. */
const METER_MAX = 100;
/** Meter gained by the attacker when a normal attack lands. */
const METER_GAIN_ON_HIT = 12;
/** Meter gained by the defender when taking a hit. */
const METER_GAIN_ON_TAKE = 7;
/** Meter gained by both sides on a blocked hit. */
const METER_GAIN_ON_BLOCK = 4;
/**
 * After the charge wind-up completes, the fighter holds the charged pose for this
 * long before the special executes — the "super freeze" that lets the cut-in
 * cinematic land before the move launches.
 */
const SUPER_FREEZE_MS = 360;

/**
 * A live attack from a fighter on its current animation frame: the world-space
 * attack rectangle, the resolved damage/knockback/hitstun profile, and a
 * per-swing signature so a single swing only connects once.
 */
export interface ActiveAttack {
  rect: Phaser.Geom.Rectangle;
  profile: AttackProfile;
  signature: number;
  /** True when this is the final hit window of a special (the combo finisher). */
  finisher: boolean;
  sweepKnockdown: boolean;
}

const BOUNDS_ALPHA_ACTIVE = 0.95;
const BOUNDS_ALPHA_INACTIVE = 0.28;

// Frame pixels between the anchor baseline (frame bottom, ~255) and the visible
// feet. Used to seat the ground shadow under the feet rather than the padded
// frame bottom, so fighters don't appear to float above their shadow.
const SHADOW_FOOT_OFFSET = 24;
const ELEMENTAL_REACTION_TEXTURES: Partial<Record<FighterEnergyElement, string>> = {
  fire: 'vfx-fire-hit-shell',
  ice: 'vfx-ice-hit-shell',
  electric: 'vfx-electric-hit-ring',
  wind: 'vfx-wind-hit-ring',
  water: 'vfx-water-hit-ring'
};

const BOUNDS_COLORS: Record<keyof FighterBoundsVisibility, number> = Object.fromEntries(
  FIGHTER_BOUNDS_FIELDS.map((field) => [field.id, Number.parseInt(field.color.slice(1), 16)])
) as Record<keyof FighterBoundsVisibility, number>;

/**
 * A per-frame snapshot of a fighter's intent. Held inputs (`left`, `right`,
 * `crouch`, `block`) describe the current key state; edge inputs (`jump`,
 * `attack`, `throw`, `specialMove`, and `special` are set only on the frame the
 * action was triggered.
 */
export interface FighterInput {
  left: boolean;
  right: boolean;
  crouch: boolean;
  block: boolean;
  jump: boolean;
  attack: NormalAttackId | null;
  throw: boolean;
  specialMove: FighterSpecialMove | null;
  specialStrength: NormalAttackId | null;
  specialName: string | null;
  special: boolean;
}

/** A neutral (no-op) input snapshot. */
export const NEUTRAL_FIGHTER_INPUT: FighterInput = {
  left: false,
  right: false,
  crouch: false,
  block: false,
  jump: false,
  attack: null,
  throw: false,
  specialMove: null,
  specialStrength: null,
  specialName: null,
  special: false
};

interface FighterActionKeys {
  idle: string;
  walkForward: string;
  walkBackward: string;
  crouch: string;
  jump: string;
  blockHigh: string;
  blockLow: string;
  hitHigh: string;
  lightPunch: string;
  mediumPunch: string;
  heavyPunch: string;
  lightKick: string;
  mediumKick: string;
  heavyKick: string;
  lowSweep: string;
  jumpKick: string;
  hadoken: string;
  shoryuken: string;
  tatsumaki: string;
  throwMove: string;
  throwReaction: string;
  specialCharge: string;
  special: string;
  knockdown: string;
}

/**
 * Construction options for a {@link Fighter}: which scene/character to build,
 * where it stands, which way it faces, and its horizontal movement bounds.
 */
export interface FighterOptions {
  scene: Phaser.Scene;
  app: AppContext;
  characterId: string;
  x: number;
  groundY: number;
  facing: 1 | -1;
  minX: number;
  maxX: number;
  depth?: number;
  /**
   * Invoked the moment a meter special begins (the charge wind-up). Hosts use it
   * to trigger the super cut-in cinematic.
   */
  onSpecialStart?: (fighter: Fighter) => void;
  onSpecialMove?: (fighter: Fighter, move: FighterSpecialMove, strength: NormalAttackId, name?: string | null, spawnPoint?: HadoukenSpawnPoint) => void;
}

/**
 * A self-contained, input-driven fighter actor: sprite + ground shadow + a
 * grounded/airborne state machine. The host scene feeds it a {@link FighterInput}
 * each frame, so the same entity backs both human and CPU opponents. Movement
 * and physics stats are read from the persisted fighter balance.
 */
export class Fighter {
  private readonly scene: Phaser.Scene;
  private readonly app: AppContext;
  private readonly character: CharacterDefinition;
  private readonly actionKeys: FighterActionKeys;
  private facing: 1 | -1;
  private minX: number;
  private maxX: number;
  private readonly groundY: number;

  private sprite!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private boundsGraphics!: Phaser.GameObjects.Graphics;
  private hadoukenDebugMarker!: Phaser.GameObjects.Container;
  private hadoukenDebugVisible = false;
  private lastHadoukenSpawnDebugPoint: Point | null = null;
  private depthBase = 5;
  private posX: number;
  private velocityY = 0;
  private grounded = true;
  private throwRotationTimer = 0;
  private throwRotationDuration = 0.62;
  private throwRotationDirection: 1 | -1 = 1;
  private throwTravelRemainingMs = 0;
  private throwTravelDirection: 1 | -1 = 1;
  private locked = false;
  private frozen = true;
  private currentAnimKey = '';
  private currentReverse = false;

  private maxHealth: number;
  private health: number;
  private hitstunTimer = 0;
  private stunIsBlock = false;
  private stunBlockLow = false;
  private hitReactionAction: string | null = null;
  private hitReactionElement: FighterEnergyElement | null = null;
  private hitReactionTintOverride: number | null = null;
  private elementalReactionVisual: Phaser.GameObjects.Image | null = null;
  private elementalReactionVisualElement: FighterEnergyElement | null = null;
  private knockbackVel = 0;
  private defeated = false;
  private attackId = 0;
  private activeAttackKind: AttackKind | null = null;
  private specialMotion: FighterSpecialMove | null = null;
  private specialMoveSpeed = 360;
  private shoryukenGravity = 3000;
  private activeSpecialName: string | null = null;
  private meterSuperActive = false;
  private attackConnected = true;
  // Multi-hit: each contiguous run of attack-active frames is one hit window.
  // When the attack box turns on after being off, a new window opens so the
  // swing can connect again — this is how a special lands several hits.
  private attackActiveLast = false;
  private meter = 0;
  private appliedScale = 0;
  private readonly hasSpecial: boolean;
  private readonly onSpecialStart?: (fighter: Fighter) => void;
  private readonly onSpecialMove?: (fighter: Fighter, move: FighterSpecialMove, strength: NormalAttackId, name?: string | null, spawnPoint?: HadoukenSpawnPoint) => void;

  constructor(options: FighterOptions) {
    this.scene = options.scene;
    this.app = options.app;
    this.onSpecialStart = options.onSpecialStart;
    this.onSpecialMove = options.onSpecialMove;
    this.character = getCharacterDefinition(options.characterId);
    this.facing = options.facing;
    this.minX = options.minX;
    this.maxX = options.maxX;
    this.groundY = options.groundY;
    this.posX = Phaser.Math.Clamp(options.x, options.minX, options.maxX);
    this.actionKeys = this.resolveActionKeys();
    this.hasSpecial = findCharacterAnimationKeyByAction(this.character.id, 'special') !== null;
    this.maxHealth = this.combat().maxHealth;
    this.health = this.maxHealth;
    this.build(options.depth ?? 5);
  }

  /** The fighter's id. */
  get characterId(): string {
    return this.character.id;
  }

  /** The fighter's display label. */
  get label(): string {
    return this.character.label;
  }

  get activeSpecialLabel(): string | null {
    return this.activeSpecialName;
  }

  /** The fighter's current horizontal centre in world pixels. */
  get x(): number {
    return this.posX;
  }

  /** The direction the fighter is facing (+1 right, -1 left). */
  get facingDirection(): 1 | -1 {
    return this.facing;
  }

  /** The fighter's current health. */
  get health01(): number {
    return this.maxHealth > 0 ? Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1) : 0;
  }

  /** Whether the fighter has been knocked out this round. */
  get isDefeated(): boolean {
    return this.defeated;
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  get worldY(): number {
    return this.sprite.y;
  }

  /** Converts the authored release-frame hand point to scene coordinates. */
  getHadoukenSpawnPoint(frameIndex?: number): Point | null {
    const animation = getCharacterAnimationByAction(this.character.id, 'hadoken');
    const resolvedFrameIndex = frameIndex === undefined
      ? this.hadoukenReleaseFrame(animation)
      : Phaser.Math.Clamp(frameIndex, 0, animation.bounds.length - 1);
    const point = animation.bounds[resolvedFrameIndex]?.hadoukenSpawnPoint;
    if (!point) return null;
    // Use the action's own cell size, anchor, and display scale instead of
    // depending on whichever texture frame/origin Phaser currently exposes.
    return transformFramePointAtPose(
      point,
      animation.sheet.frameWidth,
      animation.sheet.frameHeight,
      animation.anchorX ?? this.character.anchor.x,
      animation.anchorY ?? this.character.anchor.y,
      this.shouldFlipAnimation(this.actionKeys.hadoken),
      { x: this.sprite.x, y: this.sprite.y },
      this.stats().scale * (animation.displayScale ?? 1),
      this.stats().scale * (animation.displayScale ?? 1),
      this.sprite.rotation
    );
  }

  setHadoukenDebugVisible(visible: boolean): void {
    this.hadoukenDebugVisible = visible;
    this.hadoukenDebugMarker.setVisible(visible);
    if (visible) this.updateHadoukenDebugMarker();
  }

  setWorldX(x: number): void {
    this.posX = Phaser.Math.Clamp(x, this.minX, this.maxX);
    this.sprite.x = this.posX;
    this.shadow.x = this.posX;
  }

  /** The fighter's special meter charge (0..1). */
  get meter01(): number {
    return METER_MAX > 0 ? Phaser.Math.Clamp(this.meter / METER_MAX, 0, 1) : 0;
  }

  /** Whether the special meter is full and a special can be performed. */
  get isMeterReady(): boolean {
    return this.hasSpecial && this.meter >= METER_MAX;
  }

  get isMeterSuper(): boolean {
    return this.meterSuperActive;
  }

  /**
   * Adds charge to the special meter (clamped to full). Called by the match when
   * this fighter deals, blocks, or takes a hit.
   * @param amount - Meter points to add.
   */
  gainMeter(amount: number): void {
    if (this.defeated) {
      return;
    }

    this.meter = Phaser.Math.Clamp(this.meter + amount, 0, METER_MAX);
  }

  /**
   * Awards meter for landing an attack. Special moves grant no meter (so they
   * can't refill themselves); normal hits grant more than guarded ones.
   * @param blocked - Whether the attack was guarded by the defender.
   * @param isSpecial - Whether the attack was a special move.
   */
  registerOffense(blocked: boolean, isSpecial: boolean): void {
    if (isSpecial) {
      return;
    }

    this.gainMeter(blocked ? METER_GAIN_ON_BLOCK : METER_GAIN_ON_HIT);
  }

  /**
   * Awards meter for being struck. Taking a clean hit builds more than blocking.
   * @param blocked - Whether the incoming attack was guarded.
   */
  registerDefense(blocked: boolean): void {
    this.gainMeter(blocked ? METER_GAIN_ON_BLOCK : METER_GAIN_ON_TAKE);
  }

  /** Tops the special meter to full (used by the playground's debug fill toggle). */
  fillMeter(): void {
    this.meter = METER_MAX;
  }

  /**
   * Gradually restores health toward full without clearing hitstun/knockback,
   * so a training dummy visibly takes damage and then recovers between hits.
   * @param amount - Health points to restore this tick.
   */
  regenHealth(amount: number): void {
    if (!this.defeated) {
      this.health = Math.min(this.maxHealth, this.health + amount);
    }
  }

  /**
   * Live-updates the display scale (sprite + ground shadow) so playground scale
   * tuning is reflected without rebuilding the fighter.
   * @param scale - The desired display scale.
   */
  setVisualScale(scale: number): void {
    if (this.appliedScale === scale) {
      return;
    }

    this.appliedScale = scale;
    this.sprite.setScale(scale);
    this.shadow.setSize(Math.round(107 * scale), Math.round(24 * scale));
    this.shadow.y = this.groundY - SHADOW_FOOT_OFFSET * scale;
    this.updateShadow();
  }

  /**
   * Sets the base render depth, restacking the sprite, shadow, and bounds
   * overlay together. Used to bring the most recently active fighter in front.
   * @param base - The base depth for the sprite.
   */
  setDepthBase(base: number): void {
    if (this.depthBase === base) {
      return;
    }

    this.depthBase = base;
    this.applyDepths();
  }

  /**
   * Turns the fighter to face a target x (e.g. the opponent), flipping the
   * sprite and — via the shared transform — its bounds. Skipped while mid
   * one-shot action and within a small deadzone to avoid jitter on overlap.
   * @param targetX - The world x the fighter should face toward.
   */
  faceToward(targetX: number): void {
    if (this.locked) {
      return;
    }

    const delta = targetX - this.posX;
    if (Math.abs(delta) < 12) {
      return;
    }

    const desired: 1 | -1 = delta >= 0 ? 1 : -1;
    this.facing = desired;
    this.applySpriteFacing();
  }

  /**
   * Freezes or unfreezes the fighter. While frozen it holds the idle pose and
   * ignores all input (used during the round intro).
   * @param frozen - Whether the fighter should be frozen.
   */
  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }

  /**
   * Updates the fighter's horizontal movement limits and immediately re-clamps
   * the current position into the new range. Used by the match camera to turn
   * the visible screen edges into walls (and the stage ends into corners).
   * @param minX - The leftmost centre the fighter may occupy, in world pixels.
   * @param maxX - The rightmost centre the fighter may occupy, in world pixels.
   */
  setHorizontalBounds(minX: number, maxX: number): void {
    this.minX = minX;
    this.maxX = Math.max(minX, maxX);
    this.posX = Phaser.Math.Clamp(this.posX, this.minX, this.maxX);
    this.sprite.x = this.posX;
    this.shadow.x = this.posX;
  }

  /**
   * The fighter's currently active attack (if any): present only while a strike
   * animation is on an attack-active frame and the swing hasn't connected yet.
   */
  getActiveAttack(): ActiveAttack | null {
    if (this.attackConnected || this.defeated) {
      return null;
    }

    const kind = this.currentAttackKind();
    if (kind === null) {
      return null;
    }

    const animation = this.currentAnimation();
    if (!animation) {
      return null;
    }

    const frameIndex = this.currentFrameIndex(animation);
    const frame = this.resolvedFrame(animation);
    const attackRect = this.resolveActiveAttackRect(animation, frameIndex, frame?.attack ?? null, kind);
    if (!attackRect) {
      return null;
    }

    const finisher = kind === 'special' && !this.hasAttackFrameAfter(animation, frameIndex);

    return {
      rect: this.frameRectToWorld(animation, attackRect),
      profile: getAttackProfile(this.combat(), kind),
      signature: this.attackId,
      finisher,
      sweepKnockdown: shouldKnockdownFromSweep(this.currentAnimKey === this.actionKeys.lowSweep, kind)
    };
  }

  /** Current collision body in world coordinates for blocking unwanted overlap. */
  getBodyRect(): Phaser.Geom.Rectangle | null {
    if (this.defeated) {
      return null;
    }
    const animation = this.currentAnimation();
    if (!animation) {
      return null;
    }
    const frame = this.resolvedFrame(animation);
    const bounds = frame.collision ?? frame.visual;
    return this.frameRectToWorld(animation, bounds);
  }

  /** Whether a throw can currently connect. */
  canBeThrown(): boolean {
    return !this.defeated && this.grounded && this.hitstunTimer <= 0;
  }

  /** Starts the attacker animation and applies a short, unguardable throw arc. */
  throwTarget(target: Fighter): boolean {
    if (this.defeated || !this.grounded || this.locked || !target.canBeThrown() || Math.abs(target.x - this.x) > 132) {
      return false;
    }
    this.startOneShot(this.actionKeys.throwMove, null);
    target.applyThrow(this.facing);
    return true;
  }

  applyThrow(attackerFacing: 1 | -1): void {
    this.health = Math.max(0, this.health - 11);
    this.grounded = false;
    this.velocityY = -this.stats().gravity * (THROW_TRAVEL_DURATION_MS / 2000);
    this.knockbackVel = 0;
    this.throwTravelRemainingMs = THROW_TRAVEL_DURATION_MS;
    this.throwTravelDirection = attackerFacing;
    this.hitstunTimer = THROW_TRAVEL_DURATION_MS / 1000;
    this.throwRotationTimer = THROW_TRAVEL_DURATION_MS / 1000;
    this.throwRotationDuration = THROW_TRAVEL_DURATION_MS / 1000;
    this.throwRotationDirection = attackerFacing;
    this.facing = resolveThrownFacing(this.facing, attackerFacing);
    this.applySpriteFacing();
    this.sprite.setRotation(0);
    this.locked = false;
    this.stunIsBlock = false;
    this.currentAnimKey = '';
    this.hitReactionAction = this.actionKeys.throwReaction;
    this.playState(this.hitReactionAction, false);
    if (this.health <= 0) {
      this.health = 0;
      this.defeated = true;
      this.locked = true;
      this.playState(this.actionKeys.knockdown, false);
    }
  }

  /** Marks the current swing as having connected so it can't hit again. */
  markAttackConnected(): void {
    this.attackConnected = true;
    const animation = this.currentAnimation();
    const frameIndex = animation ? this.currentFrameIndex(animation) : -1;
    const hasLaterHitAfterRecovery = this.activeAttackKind === 'special' && animation !== null &&
      hasAttackWindowAfterGap(animation.bounds.map((frame) => Boolean(frame.attack)), frameIndex);
    if (hasLaterHitAfterRecovery) return;

    this.activeAttackKind = null;
    this.specialMotion = null;
    this.meterSuperActive = false;
  }

  /**
   * Briefly tints the sprite to telegraph an impact (red for a clean hit, blue
   * for a guarded one).
   * @param blocked - Whether the hit was blocked.
   */
  flashHit(blocked: boolean, tintOverride?: number): void {
    this.sprite.setTint(blocked ? 0x93c5fd : tintOverride ?? 0xff7a7a);
    this.scene.time.delayedCall(100, () => this.sprite?.clearTint());
  }

  /**
   * The fighter's current hurtbox in world space (the active frame's hit box,
   * falling back to its visual box), or null when unavailable.
   */
  getHurtRect(): Phaser.Geom.Rectangle | null {
    const animation = this.currentAnimation();
    if (!animation) {
      return null;
    }

    const frame = this.resolvedFrame(animation);
    const rect = frame?.hit ?? frame?.visual;

    return rect ? this.frameRectToWorld(animation, rect) : null;
  }

  /**
   * The fighter's active guard box in world space — the current frame's `guard`
   * rect, present only while a block pose is held (and the fighter isn't
   * defeated). An attack is blocked when its hitbox overlaps this rect; null
   * means the fighter isn't guarding and any connecting attack will hit.
   */
  getGuardRect(): Phaser.Geom.Rectangle | null {
    if (this.defeated) {
      return null;
    }

    const animation = this.currentAnimation();
    if (!animation) {
      return null;
    }

    const frame = this.resolvedFrame(animation);

    return frame?.guard ? this.frameRectToWorld(animation, frame.guard) : null;
  }

  /**
   * Applies a connected hit: blocked hits deal no damage and apply short
   * blockstun + light pushback; unblocked hits deal damage, hitstun, and
   * knockback, triggering a knockdown when health reaches zero.
   * @param profile - The attack profile that landed.
   * @param attackerFacing - The attacker's facing (push direction).
   * @param blocked - Whether the defender guarded the attack.
   */
  applyHit(profile: AttackProfile, attackerFacing: 1 | -1, blocked: boolean, options: { sweepKnockdown?: boolean; element?: FighterEnergyElement; tint?: number } = {}): void {
    if (this.defeated) {
      return;
    }

    if (blocked) {
      this.knockbackVel = attackerFacing * profile.knockback * 0.35;
      this.hitstunTimer = Math.max(this.hitstunTimer, BLOCKSTUN_SECONDS);
      this.stunIsBlock = true;
      this.stunBlockLow = this.currentAnimKey === this.actionKeys.blockLow;
      this.locked = false;
      return;
    }

    this.health = Math.max(0, this.health - profile.damage);
    this.throwTravelRemainingMs = 0;
    this.knockbackVel = attackerFacing * profile.knockback;
    const elementalHitAction = options.element
      ? findCharacterAnimationKeyByAction(this.character.id, `hit-${options.element}`)
      : null;
    this.hitReactionAction = options.sweepKnockdown
      ? this.actionKeys.knockdown
      : elementalHitAction ?? this.actionKeys.hitHigh;
    this.clearElementalReactionVisual();
    this.sprite.x = this.posX;
    this.sprite.clearTint().setRotation(0);
    this.hitReactionElement = options.element ?? null;
    this.hitReactionTintOverride = options.tint ?? null;
    if (options.element === 'ice') {
      // Freeze at the impact pose instead of sliding through the crystal hit.
      this.knockbackVel = 0;
      this.velocityY = 0;
    }
    if (options.element === 'wind') {
      this.velocityY = Math.min(this.velocityY, -210);
      this.grounded = false;
    }
    if (options.element === 'water') this.knockbackVel *= 1.2;

    if (options.sweepKnockdown) {
      this.grounded = false;
      this.velocityY = Math.min(this.velocityY, -190);
      this.throwRotationTimer = 0.5;
      this.throwRotationDuration = 0.5;
      this.throwRotationDirection = (-attackerFacing) as 1 | -1;
    }

    if (this.health <= 0) {
      this.defeated = true;
      this.locked = true;
      this.grounded = true;
      this.stunIsBlock = false;
      this.hitstunTimer = 0;
      this.playState(this.actionKeys.knockdown, false);
      return;
    }

    this.stunIsBlock = false;
    this.locked = false;
    this.hitstunTimer = profile.hitstun / 1000;
    if (options.element === 'ice') this.hitstunTimer = Math.max(this.hitstunTimer, 0.48);
    if (options.element === 'electric') this.hitstunTimer = Math.max(this.hitstunTimer, 0.38);
    if (options.element === 'fire') this.hitstunTimer = Math.max(this.hitstunTimer, 0.34);
    this.currentAnimKey = '';
    this.playState(this.hitReactionAction ?? this.actionKeys.hitHigh, false);
    if (options.element === 'ice') this.sprite.anims.pause();
  }

  /**
   * Resets the fighter for a new round: restores health, repositions and faces,
   * clears combat state, and re-freezes until the round intro releases it.
   * @param x - The spawn x position.
   * @param facing - The spawn facing direction.
   */
  resetForRound(x: number, facing: 1 | -1): void {
    this.posX = Phaser.Math.Clamp(x, this.minX, this.maxX);
    this.facing = facing;
    this.maxHealth = this.combat().maxHealth;
    this.health = this.maxHealth;
    this.velocityY = 0;
    this.grounded = true;
    this.throwRotationTimer = 0;
    this.throwTravelRemainingMs = 0;
    this.sprite?.setRotation(0);
    this.locked = false;
    this.defeated = false;
    this.frozen = true;
    this.hitstunTimer = 0;
    this.hitReactionAction = null;
    this.hitReactionElement = null;
    this.hitReactionTintOverride = null;
    this.clearElementalReactionVisual();
    this.stunIsBlock = false;
    this.stunBlockLow = false;
    this.knockbackVel = 0;
    this.attackConnected = true;
    this.attackActiveLast = false;
    this.meter = 0;
    this.currentAnimKey = '';
    this.currentReverse = false;

    this.sprite.setPosition(this.posX, this.groundY).setFlipX(this.facing === 1);
    this.playState(this.actionKeys.idle, true);
    this.updateShadow();
  }

  /**
   * Advances the fighter one frame.
   * @param seconds - Delta time in seconds.
   * @param input - The intent snapshot for this frame.
   */
  update(seconds: number, input: FighterInput): void {
    // Keep the authored hand point visible in every fighter state, including
    // intro freeze, hitstun, and knockdown early-return paths.
    this.updateHadoukenDebugMarker();

    if (this.defeated) {
      this.playState(this.actionKeys.knockdown, false);
      if (this.throwTravelRemainingMs > 0) this.advanceThrowTravel(seconds);
      else this.applyKnockback(seconds);
      this.advanceVerticalMotion(seconds);
      if (this.hitReactionElement) this.updateElementalReaction();
      this.updateShadow();
      this.drawBoundsOverlay();
      return;
    }

    if (this.frozen) {
      this.playState(this.actionKeys.idle, true);
      this.drawBoundsOverlay();
      return;
    }

    if (this.hitstunTimer > 0) {
      this.hitstunTimer = Math.max(0, this.hitstunTimer - seconds);
      if (this.hitReactionElement === 'ice') {
        this.knockbackVel = 0;
        this.velocityY = 0;
        this.sprite.anims.pause();
        this.updateElementalReaction();
        this.updateShadow();

        if (this.hitstunTimer === 0) {
          this.currentAnimKey = '';
          this.hitReactionAction = null;
          this.hitReactionElement = null;
          this.hitReactionTintOverride = null;
          this.sprite.anims.resume();
          this.sprite.x = this.posX;
          this.sprite.clearTint().setRotation(0);
          this.clearElementalReactionVisual();
        }

        this.drawBoundsOverlay();
        return;
      }
      if (this.throwTravelRemainingMs > 0) this.advanceThrowTravel(seconds);
      else this.applyKnockback(seconds);
      this.advanceVerticalMotion(seconds);
      this.playState(
        this.stunIsBlock
          ? this.stunBlockLow
            ? this.actionKeys.blockLow
            : this.actionKeys.blockHigh
          : this.hitReactionAction ?? this.actionKeys.hitHigh,
        false
      );
      this.updateElementalReaction();
      this.updateShadow();

      if (this.hitstunTimer === 0) {
        this.currentAnimKey = '';
        this.hitReactionAction = null;
        this.hitReactionElement = null;
        this.hitReactionTintOverride = null;
        this.sprite.x = this.posX;
        this.sprite.clearTint().setRotation(0);
        this.clearElementalReactionVisual();
      }

      this.drawBoundsOverlay();
      return;
    }

    if ((this.specialMotion === 'tatsumaki' || this.specialMotion === 'shoryuken') && this.locked) {
      this.setWorldX(this.x + this.facing * this.specialMoveSpeed * seconds);
    }

    if (!this.grounded) {
      this.updateAirborne(seconds, input);
    } else if (!this.locked) {
      this.updateGrounded(seconds, input);
    }

    this.updateAttackWindow();
    this.drawBoundsOverlay();
  }

  /** Destroys the fighter's display objects. */
  destroy(): void {
    this.sprite?.removeAllListeners();
    this.sprite?.destroy();
    this.shadow?.destroy();
    this.boundsGraphics?.destroy();
    this.hadoukenDebugMarker?.destroy();
    this.clearElementalReactionVisual();
  }

  /**
   * Resolves the per-action animation keys for this character, falling back to
   * the first available animation for any missing action.
   */
  private resolveActionKeys(): FighterActionKeys {
    const key = (action: string): string =>
      findCharacterAnimationKeyByAction(this.character.id, action) ?? this.character.animations[0].key;

    return {
      idle: key('idle'),
      walkForward: key('walk-forward'),
      walkBackward: key('walk-backward'),
      crouch: key('crouch'),
      jump: key('jump'),
      blockHigh: key('block-high'),
      blockLow: findCharacterAnimationKeyByAction(this.character.id, 'block-low') ?? key('block-high'),
      hitHigh: key('hit-high'),
      lightPunch: key('light-punch'),
      mediumPunch: findCharacterAnimationKeyByAction(this.character.id, 'medium-punch') ?? key('light-punch'),
      // A fighter without a bespoke heavy-punch sheet must still punch. Using
      // the heavy-kick sheet here made Jiu-Jitsu's P button show a kick whose
      // authored direction differs from its west-facing punch set.
      heavyPunch: findCharacterAnimationKeyByAction(this.character.id, 'heavy-punch') ?? key('light-punch'),
      lightKick: findCharacterAnimationKeyByAction(this.character.id, 'light-kick') ??
        findCharacterAnimationKeyByAction(this.character.id, 'heavy-kick') ?? key('light-punch'),
      mediumKick: findCharacterAnimationKeyByAction(this.character.id, 'medium-kick') ??
        findCharacterAnimationKeyByAction(this.character.id, 'heavy-kick') ?? key('light-punch'),
      heavyKick: findCharacterAnimationKeyByAction(this.character.id, 'heavy-kick') ??
        findCharacterAnimationKeyByAction(this.character.id, 'heavy-punch') ?? key('light-punch'),
      lowSweep: findCharacterAnimationKeyByAction(this.character.id, 'low-sweep') ??
        findCharacterAnimationKeyByAction(this.character.id, 'heavy-kick') ?? key('light-punch'),
      jumpKick: findCharacterAnimationKeyByAction(this.character.id, 'jump-kick') ??
        findCharacterAnimationKeyByAction(this.character.id, 'heavy-kick') ?? key('light-punch'),
      hadoken: findCharacterAnimationKeyByAction(this.character.id, 'hadoken') ?? key('light-punch'),
      shoryuken: findCharacterAnimationKeyByAction(this.character.id, 'shoryuken') ?? key('special'),
      tatsumaki: findCharacterAnimationKeyByAction(this.character.id, 'tatsumaki') ??
        findCharacterAnimationKeyByAction(this.character.id, 'heavy-kick') ?? key('light-punch'),
      throwMove: findCharacterAnimationKeyByAction(this.character.id, 'throw') ??
        findCharacterAnimationKeyByAction(this.character.id, 'heavy-kick') ?? key('light-punch'),
      throwReaction: findCharacterAnimationKeyByAction(this.character.id, 'thrown') ?? key('knockdown'),
      specialCharge: findCharacterAnimationKeyByAction(this.character.id, 'special-charge') ?? key('crouch'),
      special: findCharacterAnimationKeyByAction(this.character.id, 'special') ?? key('heavy-kick'),
      knockdown: key('knockdown')
    };
  }

  /** Current persisted stats for this fighter. */
  private stats(): FighterStats {
    return getFighterStats(this.app.debugStore.getState().fighterPlayground, this.character.id);
  }

  /** Current persisted combat tuning for this fighter. */
  private combat(): FighterCombat {
    return getFighterCombat(this.app.debugStore.getState().fighterPlayground, this.character.id);
  }

  /**
   * The attack kind currently being thrown (`high` = light, `low` = heavy), or
   * null when the fighter isn't mid-strike.
   */
  private currentAttackKind(): AttackKind | null {
    return this.locked ? this.activeAttackKind : null;
  }

  /** The fighter's active animation definition, or null when none is playing. */
  private currentAnimation(): HeroAnimationDefinition | null {
    const animKey = this.sprite.anims.currentAnim?.key ?? this.currentAnimKey;
    if (!animKey) {
      return null;
    }

    return getCharacterAnimationDefinition(this.character.id, animKey);
  }

  /**
   * Advances knockback: slides the fighter by the current knockback velocity and
   * decays it toward zero by friction.
   * @param seconds - Delta time in seconds.
   */
  private applyKnockback(seconds: number): void {
    if (this.knockbackVel === 0) {
      return;
    }

    this.posX = Phaser.Math.Clamp(this.posX + this.knockbackVel * seconds, this.minX, this.maxX);
    this.sprite.x = this.posX;

    const decay = KNOCKBACK_FRICTION * seconds;
    this.knockbackVel =
      this.knockbackVel > 0
        ? Math.max(0, this.knockbackVel - decay)
        : Math.min(0, this.knockbackVel + decay);
  }

  private advanceThrowTravel(seconds: number): void {
    const step = advanceThrowTravel(
      this.posX,
      this.throwTravelDirection,
      THROW_TRAVEL_SPEED,
      this.throwTravelRemainingMs,
      seconds * 1000
    );
    this.throwTravelRemainingMs = step.remainingMs;
    this.setWorldX(step.x);
  }

  private advanceVerticalMotion(seconds: number): void {
    if (this.throwRotationTimer > 0) {
      this.throwRotationTimer = Math.max(0, this.throwRotationTimer - seconds);
      const progress = 1 - this.throwRotationTimer / this.throwRotationDuration;
      this.sprite.setRotation(resolveThrowRotation(progress, this.throwRotationDirection));
      if (this.throwRotationTimer === 0) {
        this.sprite.setRotation(0);
      }
    }
    if (this.grounded) {
      return;
    }
    // Shoryuken's stronger upward arc peaks around animation frames 4–5,
    // then gravity brings the fighter back down through the recovery frame.
    const gravity = this.specialMotion === 'shoryuken' && this.locked
      ? this.shoryukenGravity
      : this.stats().gravity;
    this.velocityY += gravity * seconds;
    if (this.activeSpecialName === 'Head Press' && this.velocityY > 0) this.velocityY = Math.max(this.velocityY, 650);
    const nextY = this.sprite.y + this.velocityY * seconds;
    if (nextY >= this.groundY) {
      this.sprite.y = this.groundY;
      this.velocityY = 0;
      this.grounded = true;
      this.throwRotationTimer = 0;
      this.throwTravelRemainingMs = 0;
      this.sprite.setRotation(0);
      this.activeSpecialName = null;
    } else {
      this.sprite.y = nextY;
    }
    this.updateShadow();
  }

  /**
   * Builds the sprite (feet-anchored, facing the opponent) and ground shadow.
   * @param depth - The display depth for the sprite (shadow renders just under).
   */
  private build(depth: number): void {
    const scale = this.stats().scale;
    this.appliedScale = scale;
    this.depthBase = depth;

    this.shadow = this.scene.add
      .ellipse(
        this.posX,
        this.groundY - SHADOW_FOOT_OFFSET * scale,
        Math.round(107 * scale),
        Math.round(24 * scale),
        0x000000,
        1
      )
      .setAlpha(0.32)
      .setDepth(depth - 1);

    this.sprite = this.scene.add
      .sprite(this.posX, this.groundY, this.actionKeys.idle, 0)
      .setOrigin(0.5, this.character.anchor.y)
      .setScale(scale)
      .setFlipX(this.facing === 1)
      .setDepth(depth);

    this.boundsGraphics = this.scene.add.graphics().setDepth(depth + 45);
    const hadoukenDebugGraphic = this.scene.add.graphics();
    hadoukenDebugGraphic.lineStyle(3, 0x00ffff, 1).strokeCircle(0, 0, 12);
    hadoukenDebugGraphic.lineBetween(-17, 0, 17, 0);
    hadoukenDebugGraphic.lineBetween(0, -17, 0, 17);
    hadoukenDebugGraphic.fillStyle(0xffffff, 1).fillCircle(0, 0, 3);
    this.hadoukenDebugMarker = this.scene.add.container(0, 0, [hadoukenDebugGraphic])
      .setDepth(depth + 46).setVisible(false);

    this.playState(this.actionKeys.idle, true);
  }

  /** Restacks the sprite, shadow, and bounds overlay around the base depth. */
  private applyDepths(): void {
    this.shadow.setDepth(this.depthBase - 1);
    this.sprite.setDepth(this.depthBase);
    this.boundsGraphics.setDepth(this.depthBase + 45);
    this.hadoukenDebugMarker.setDepth(this.depthBase + 46);
  }

  /**
   * Advances the jump arc, allows light air drift, and lands on the ground axis.
   * @param seconds - Delta time in seconds.
   * @param input - The intent snapshot for this frame.
   */
  private updateAirborne(seconds: number, input: FighterInput): void {
    const stats = this.stats();

    const followUpName = input.specialName;
    const canChainAirFollowUp =
      (followUpName === 'Izuna Drop' && this.activeSpecialName === 'Flying Barcelona Attack') ||
      (followUpName === 'Somersault Skull Diver' && this.activeSpecialName === 'Head Press');

    // These two moves are authored as aerial follow-ups in the character move
    // trees. Let them interrupt the locked launch animation while it is airborne.
    if (input.specialMove && canChainAirFollowUp && this.specialMotion === 'shoryuken') {
      this.startSpecialMove(input.specialMove, input.specialStrength ?? 'medium-punch', followUpName);
      return;
    }

    if (!this.locked && input.specialMove) {
      this.startSpecialMove(input.specialMove, input.specialStrength ?? 'medium-punch', input.specialName);
      return;
    }

    // Normal attacks can be started in the air. They reuse each fighter's
    // existing punch/kick animation and authored attack boxes; the jump arc and
    // horizontal air drift continue while the attack plays.
    if (!this.locked && input.attack) {
      this.startNormalAttack(input.attack);
    }

    this.advanceVerticalMotion(seconds);

    const drift = this.horizontalDirection(input);
    if (drift !== 0) {
      this.posX = Phaser.Math.Clamp(this.posX + drift * stats.airDrift * seconds, this.minX, this.maxX);
      this.sprite.x = this.posX;
    }

    this.updateShadow();
  }

  /**
   * Resolves grounded behaviour: one-shot actions first, then held block/crouch,
   * then walking, then idle.
   * @param seconds - Delta time in seconds.
   * @param input - The intent snapshot for this frame.
   */
  private updateGrounded(seconds: number, input: FighterInput): void {
    if (input.specialMove) {
      this.startSpecialMove(input.specialMove, input.specialStrength ?? 'medium-punch', input.specialName);
      return;
    }
    if (input.special && this.isMeterReady) {
      this.startSpecial();
      return;
    }
    if (input.jump) {
      this.startJump();
      return;
    }
    if (input.attack) {
      this.startNormalAttack(input.attack, input.crouch);
      return;
    }
    if (input.block) {
      this.playState(input.crouch ? this.actionKeys.blockLow : this.actionKeys.blockHigh, false);
      return;
    }
    if (input.crouch) {
      this.playState(this.actionKeys.crouch, false);
      return;
    }

    const direction = this.horizontalDirection(input);
    if (direction !== 0) {
      const stats = this.stats();
      this.posX = Phaser.Math.Clamp(this.posX + direction * stats.walkSpeed * seconds, this.minX, this.maxX);
      this.sprite.x = this.posX;
      this.updateShadow();
      this.playWalk(direction === this.facing);
      return;
    }

    this.playState(this.actionKeys.idle, true);
  }

  /**
   * Returns -1 for left, +1 for right, or 0 when neutral/opposed.
   * @param input - The intent snapshot for this frame.
   */
  private horizontalDirection(input: FighterInput): number {
    return (input.right ? 1 : 0) - (input.left ? 1 : 0);
  }

  /**
   * Plays a looping or hold animation, switching only when the state (key or
   * playback direction) changes.
   * @param animKey - The animation key to play.
   * @param loop - Whether the animation should loop.
   * @param reverse - Whether to play the animation in reverse.
   */
  private playState(animKey: string, loop: boolean, reverse = false): void {
    if (this.currentAnimKey === animKey && this.currentReverse === reverse) {
      this.applySpriteFacing();
      return;
    }

    this.currentAnimKey = animKey;
    this.currentReverse = reverse;
    this.applySpriteFacing();

    // ignoreIfPlaying must be false so a forward->reverse switch on the same
    // key (reverse walk) is applied; the guard above prevents per-frame restarts.
    const config: Phaser.Types.Animations.PlayAnimationConfig = { key: animKey, repeat: loop ? -1 : 0 };
    if (reverse) {
      this.sprite.playReverse(config, false);
    } else {
      this.sprite.play(config, false);
    }
  }

  /**
   * Plays the appropriate walk animation. Backward walking uses the dedicated
   * backward animation, or the forward animation played in reverse when the
   * persisted "use reverse walk anims" setting is enabled.
   * @param movingForward - Whether the fighter is walking in its facing direction.
   */
  private playWalk(movingForward: boolean): void {
    if (movingForward) {
      this.playState(this.actionKeys.walkForward, true);
      return;
    }

    const reverseWalk = this.app.debugStore.getState().fighterPlayground.reverseWalk;
    if (reverseWalk) {
      this.playState(this.actionKeys.walkForward, true, true);
      return;
    }

    this.playState(this.actionKeys.walkBackward, true);
  }

  /**
   * Plays a one-shot action that locks input until it completes, then returns
   * to the appropriate grounded or airborne pose.
   * @param animKey - The action animation key to play.
   */
  private startOneShot(animKey: string, attackKind: AttackKind | null): void {
    this.locked = true;
    this.activeAttackKind = attackKind;
    this.specialMotion = null;
    this.meterSuperActive = false;
    this.currentAnimKey = animKey;
    this.currentReverse = false;
    this.applySpriteFacing();
    this.attackId += 1;
    this.attackConnected = false;
    this.attackActiveLast = false;
    this.sprite.play({ key: animKey, repeat: 0 }, true);
    this.sprite.once(`animationcomplete-${animKey}`, () => {
      this.locked = false;
      this.activeAttackKind = null;
      this.meterSuperActive = false;
      this.sprite.anims.timeScale = 1;
      this.currentAnimKey = '';

      if (this.grounded) {
        this.playState(this.actionKeys.idle, true);
      } else {
        this.playState(this.actionKeys.jump, false);
      }
    });
  }

  /**
   * The replacement move sheets are authored facing east; the original idle
   * and locomotion sheets face west. Mirror each source convention toward the
   * opponent so an attack does not visually turn away before connecting.
   */
  private applySpriteFacing(): void {
    this.sprite.setFlipX(this.shouldFlipAnimation(this.currentAnimKey));
    const animation = this.character.animations.find((candidate) => candidate.key === this.currentAnimKey);
    this.sprite
      .setScale(this.stats().scale * (animation?.displayScale ?? 1))
      .setOrigin(animation?.anchorX ?? this.character.anchor.x, animation?.anchorY ?? this.character.anchor.y);
  }

  /** Resolve mirroring from the source convention of a specific action sheet. */
  private shouldFlipAnimation(animationKey: string): boolean {
    const animation = this.character.animations.find((candidate) => candidate.key === animationKey);
    const sourceFacing = resolveAnimationSourceFacing(
      this.character.id,
      animation?.action ?? '',
      animation?.sourceFacing,
      this.character.facing
    );
    return shouldFlipForFacing(sourceFacing, this.facing);
  }

  private startNormalAttack(move: NormalAttackId, crouching = false): void {
    this.activeSpecialName = null;
    const animationKeys: Record<NormalAttackId, string> = {
      'light-punch': this.actionKeys.lightPunch,
      'medium-punch': this.actionKeys.mediumPunch,
      'heavy-punch': this.actionKeys.heavyPunch,
      'light-kick': this.actionKeys.lightKick,
      'medium-kick': this.actionKeys.mediumKick,
      'heavy-kick': this.actionKeys.heavyKick
    };
    const action = resolveNormalAttackAction(move, crouching, this.grounded);
    const animationKey = action === 'jump-kick'
      ? this.actionKeys.jumpKick
      : action === 'low-sweep'
        ? this.actionKeys.lowSweep
        : animationKeys[action];
    this.startOneShot(animationKey, move);
  }

  private startSpecialMove(move: FighterSpecialMove, strength: NormalAttackId, name: string | null = null): void {
    const tier = strength.startsWith('light') ? 0 : strength.startsWith('heavy') ? 2 : 1;
    // Champion Edition Ryu's Shoryuken animation scripts total 42/50/54
    // frames by strength. The authored replacement sheet has 12 frames at
    // 20 fps (600 ms nominal), so use equivalent per-tier playback speeds.
    const animationTimeScale = name === 'Shoryuken'
      ? [600 / 700, 600 / 833, 600 / 900][tier]
      : [1.15, 1, 0.84][tier];
    this.sprite.anims.timeScale = animationTimeScale;
    this.activeSpecialName = name;

    const projectileMove = ['Hadouken', 'Sonic Boom', 'Yoga Fire', 'Tiger Shot', 'Ground Tiger Shot'].includes(name ?? '') || (!name && move === 'hadoken');
    const rapidBurst = [
      'Electric Thunder',
      'Hundred Hand Slap',
      'Hyakuretsukyaku',
      'Double Lariat',
      'Spinning Piledriver'
    ].includes(name ?? '');
    if (projectileMove) {
      this.lastHadoukenSpawnDebugPoint = null;
      this.startOneShot(this.actionKeys.hadoken, null);
      this.sprite.anims.timeScale = animationTimeScale;
      this.queueHadoukenProjectile(move, strength, name);
      return;
    }

    // Yoga Flame is a close, forward-facing flame attack. It must not fall
    // through to the generic Shoryuken branch just because its command uses
    // the `shoryuken` internal move family. Kavi's authored special sheet has
    // the forward-reaching pose and attack-active frames for this move.
    if (name === 'Yoga Flame') {
      this.startOneShot(this.actionKeys.special, 'special');
      this.sprite.anims.timeScale = animationTimeScale;
      return;
    }

    if (rapidBurst || name === 'Turn Punch') {
      spawnElementalImpact(this.scene, this.character.id, this.sprite.x + this.facing * 56, this.sprite.y - 112);
      // Rapid-hand/leg techniques, lariats, and Turn Punch should use the
      // fighter's authored signature sheet. Reusing tatsumaki made these
      // commands visibly play a spinning-kick pose (notably Chun-Li's legs,
      // Honda's hand slap, and Balrog's punch).
      const signatureAction = name === 'Hyakuretsukyaku'
        ? findCharacterAnimationKeyByAction(this.character.id, 'hyakuretsukyaku') ?? this.actionKeys.special
        : this.actionKeys.special;
      this.startOneShot(signatureAction, 'special');
      this.sprite.anims.timeScale = animationTimeScale;
      return;
    }

    if (name === 'Backflip') {
      this.startOneShot(this.actionKeys.jump, null);
      this.velocityY = -440;
      this.specialMoveSpeed = -240;
      this.grounded = false;
      this.specialMotion = 'tatsumaki';
      return;
    }

    if (name === 'Izuna Drop' || name === 'Somersault Skull Diver') {
      this.velocityY = 560;
      this.specialMoveSpeed = [70, 120, 170][tier];
      this.grounded = false;
      const diveAnimation = name === 'Somersault Skull Diver'
        ? findCharacterAnimationKeyByAction(this.character.id, 'somersault-skull-diver') ?? this.actionKeys.tatsumaki
        : this.actionKeys.tatsumaki;
      this.startOneShot(diveAnimation, 'special');
      this.sprite.anims.timeScale = animationTimeScale;
      this.specialMotion = 'tatsumaki';
      return;
    }

    if (name === 'Tiger Knee') {
      // Tiger Knee is a forward jumping knee, not a horizontal spinning kick.
      this.velocityY = [-420, -520, -620][tier];
      this.specialMoveSpeed = [220, 300, 380][tier];
      this.grounded = false;
      const kneeAnimation = findCharacterAnimationKeyByAction(this.character.id, 'tiger-knee') ?? this.actionKeys.jumpKick;
      this.startOneShot(kneeAnimation, 'special');
      this.sprite.anims.timeScale = animationTimeScale;
      this.specialMotion = 'tatsumaki';
      return;
    }

    if (name === 'Dash Upper') {
      // Balrog covers ground with the charge, then uses an uppercut pose.
      this.velocityY = [-320, -400, -480][tier];
      this.specialMoveSpeed = [600, 720, 840][tier];
      this.grounded = false;
      this.startOneShot(this.actionKeys.shoryuken, 'special');
      this.sprite.anims.timeScale = animationTimeScale;
      this.specialMotion = 'tatsumaki';
      return;
    }

    const risingMove = isRisingSpecialMove(move, name);
    if (risingMove && !rapidBurst) {
      const risingTint = this.character.id === 'red-brawler' && name === 'Shoryuken'
        ? 0x3698ff
        : getFighterEnergyStyle(this.character.id).primary;
      spawnRisingEnergy(this.scene, this.sprite.x, this.sprite.y, this.facing, risingTint);
      // Keep the tier-specific peak heights, but time the apex to frame 4–5 on
      // the twelve-frame Shoryuken sheets. Shorter authored sheets use the
      // same proportion of their own timeline so they do not inherit a fixed
      // twelve-frame schedule.
      const risingAction = resolveRisingAnimationAction(this.character.id, name);
      const risingAnimation = getCharacterAnimationByAction(this.character.id, risingAction);
      const risingArc = resolveRisingArc(
        risingAnimation.sheet.frames,
        risingAnimation.frameRate,
        animationTimeScale,
        tier as 0 | 1 | 2,
        name === 'Shoryuken'
          ? [280, 380, 480]
          : name === 'Spinning Bird Kick'
            ? [330, 410, 490]
            : undefined
      );
      this.velocityY = risingArc.velocityY;
      this.shoryukenGravity = risingArc.gravity;
      this.specialMoveSpeed = [140, 190, 240][tier];
      this.grounded = false;
      const risingActionKey = findCharacterAnimationKeyByAction(this.character.id, risingAction) ?? this.actionKeys.shoryuken;
      this.startOneShot(risingActionKey, 'special');
      this.sprite.anims.timeScale = animationTimeScale;
      this.specialMotion = move;
      return;
    }

    const isForwardCharge = [
      'Psycho Crusher', 'Rolling Attack', 'Sumo Headbutt', 'Dash Straight', 'Dash Upper',
      'Rolling Crystal Flash', 'Double Knee Press', 'Tiger Knee'
    ].includes(name ?? '') || this.character.id === 'darius-quell';
    this.velocityY = isForwardCharge ? -180 : [-180, -260, -350][tier];
    this.specialMoveSpeed = isForwardCharge ? [600, 720, 840][tier] : [280, 380, 500][tier];
    if (isForwardCharge) {
      const duration = [360, 310, 275][tier];
      const travel = this.specialMoveSpeed * duration / 1000;
      spawnCrusherTrail(this.scene, this.character.id, this.sprite.x, this.sprite.y - 110, this.facing, travel, duration);
    }
    this.grounded = false;
    const forwardAnimation = name === 'Dash Straight' || name === 'Sumo Headbutt'
      ? this.actionKeys.heavyPunch
      : name === 'Double Knee Press'
        ? this.actionKeys.heavyKick
        : this.actionKeys.tatsumaki;
    this.startOneShot(forwardAnimation, 'special');
    this.sprite.anims.timeScale = animationTimeScale;
    this.specialMotion = move;
    this.onSpecialMove?.(this, move, strength, name);
  }

  private queueHadoukenProjectile(move: FighterSpecialMove, strength: NormalAttackId, name: string | null): void {
    const animation = getCharacterAnimationByAction(this.character.id, 'hadoken');
    const triggerFrame = this.hadoukenReleaseFrame(animation);
    let spawned = false;
    const onFrame = (_animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void => {
      if (spawned || frame.index < triggerFrame) return;
      spawned = true;
      this.sprite.off('animationupdate', onFrame);
      // Use the authored release-frame anchor even if the display animation has
      // already advanced to another frame by the time its callback runs.
      const point = this.getHadoukenSpawnPoint(triggerFrame);
      if (!point) return;
      this.lastHadoukenSpawnDebugPoint = { x: point.x, y: point.y };
      if (this.hadoukenDebugVisible) {
        this.hadoukenDebugMarker.setPosition(point.x, point.y).setVisible(true);
      }
      this.onSpecialMove?.(this, move, strength, name, { x: point.x, y: point.y });
    };
    this.sprite.on('animationupdate', onFrame);
    this.sprite.once(`animationcomplete-${this.actionKeys.hadoken}`, () => this.sprite.off('animationupdate', onFrame));
  }

  /** The hands-forward frame used by both the debug marker and projectile release. */
  private hadoukenReleaseFrame(animation: HeroAnimationDefinition): number {
    const fallback = Math.min(3, Math.max(1, animation.bounds.length - 2));
    return Phaser.Math.Clamp(animation.hadoukenReleaseFrame ?? fallback, 0, animation.bounds.length - 1);
  }

  private updateHadoukenDebugMarker(): void {
    if (!this.hadoukenDebugVisible) return;
    // Keep the marker useful while idle by projecting the release-frame anchor
    // through the Hadouken pose. Once fired, pin it to the actual spawn point.
    if (this.lastHadoukenSpawnDebugPoint) {
      this.hadoukenDebugMarker
        .setPosition(this.lastHadoukenSpawnDebugPoint.x, this.lastHadoukenSpawnDebugPoint.y)
        .setVisible(true);
      return;
    }
    const point = this.getHadoukenSpawnPoint();
    this.hadoukenDebugMarker.setVisible(point !== null);
    if (point) this.hadoukenDebugMarker.setPosition(point.x, point.y);
  }

  private updateElementalReaction(): void {
    if (!this.hitReactionElement && this.hitReactionTintOverride === null) return;
    const time = this.scene.time.now / 1000;
    if (this.hitReactionTintOverride !== null) {
      this.sprite.setTint(this.hitReactionTintOverride);
    } else if (this.hitReactionElement === 'electric') {
      this.sprite.setTint(0x9ffcff).setRotation(Math.sin(time * 92) * 0.075);
      this.sprite.x = this.posX + Math.sin(time * 70) * 3;
    } else if (this.hitReactionElement === 'ice') {
      this.sprite.setTint(0x9eeeff);
    } else if (this.hitReactionElement === 'fire') {
      this.sprite.setTint(Math.sin(time * 46) > 0 ? 0xffa05e : 0xffd3a1);
    } else if (this.hitReactionElement === 'wind') {
      this.sprite.setTint(0xe7fff8);
    } else if (this.hitReactionElement === 'water') {
      this.sprite.setTint(0x8ee7ff);
    }

    this.updateElementalReactionVisual(time);
  }

  /** Adds a transparent impact illustration around the victim while preserving their own hit pose. */
  private updateElementalReactionVisual(time: number): void {
    const element = this.hitReactionElement;
    const texture = element ? ELEMENTAL_REACTION_TEXTURES[element] : undefined;
    if (!element || !texture || !this.scene.textures.exists(texture)) {
      this.clearElementalReactionVisual();
      return;
    }

    if (!this.elementalReactionVisual || this.elementalReactionVisualElement !== element) {
      this.clearElementalReactionVisual();
      this.elementalReactionVisual = this.scene.add.image(0, 0, texture).setOrigin(0.5);
      this.elementalReactionVisualElement = element;
    }

    const visual = this.elementalReactionVisual;
    const fighterWidth = this.sprite.displayWidth;
    const fighterHeight = this.sprite.displayHeight;
    const centerY = this.sprite.y + fighterHeight * (0.5 - this.sprite.originY);
    const verticalShell = element === 'fire' || element === 'ice';
    visual
      .setPosition(this.sprite.x, centerY)
      .setDisplaySize(fighterWidth * (verticalShell ? 1.22 : 1.4), fighterHeight * 1.16)
      .setDepth(this.sprite.depth + 1)
      .setRotation(this.sprite.rotation + (element === 'wind' ? Math.sin(time * 5) * 0.12 : 0));

    if (element === 'electric') {
      visual.setAlpha(0.58 + (Math.sin(time * 72) + 1) * 0.16);
    } else if (element === 'fire') {
      visual.setAlpha(0.48 + (Math.sin(time * 38) + 1) * 0.12);
    } else if (element === 'ice') {
      visual.setAlpha(0.8);
    } else if (element === 'wind') {
      visual.setAlpha(0.42 + (Math.sin(time * 12) + 1) * 0.08);
    } else {
      visual.setAlpha(0.48 + (Math.sin(time * 15) + 1) * 0.08);
    }
  }

  private clearElementalReactionVisual(): void {
    this.elementalReactionVisual?.destroy();
    this.elementalReactionVisual = null;
    this.elementalReactionVisualElement = null;
  }

  /**
   * Performs the meter special: consumes the full meter, plays the charge
   * (wind-up) animation, then chains into the multi-hit execution animation, and
   * finally returns to idle. The execution's attack-active spans each open a new
   * hit window so the move lands a combo.
   */
  private startSpecial(): void {
    this.locked = true;
    this.activeAttackKind = 'special';
    this.meterSuperActive = true;
    this.meter = 0;
    this.currentReverse = false;
    this.attackConnected = true;
    this.attackActiveLast = false;

    this.onSpecialStart?.(this);
    spawnChargeAura(this.scene, this.sprite.x, this.sprite.y - this.sprite.displayHeight * 0.45);

    this.currentAnimKey = this.actionKeys.specialCharge;
    this.sprite.play({ key: this.actionKeys.specialCharge, repeat: 0 }, true);
    this.sprite.once(`animationcomplete-${this.actionKeys.specialCharge}`, () => {
      if (this.defeated) {
        return;
      }

      // Super freeze: hold the charged pose so the cut-in cinematic peaks before
      // the move launches.
      this.scene.time.delayedCall(SUPER_FREEZE_MS, () => {
        if (!this.defeated) {
          this.executeSpecial();
        }
      });
    });
  }

  /**
   * Launches the multi-hit special execution animation after the charge/super
   * freeze, then returns to idle. Each attack-active span opens a fresh hit
   * window so the move lands a combo.
   */
  private executeSpecial(): void {
    this.currentAnimKey = this.actionKeys.special;
    this.activeAttackKind = 'special';
    this.meterSuperActive = true;
    this.attackId += 1;
    this.attackConnected = false;
    this.attackActiveLast = false;
    this.sprite.play({ key: this.actionKeys.special, repeat: 0 }, true);
    this.sprite.once(`animationcomplete-${this.actionKeys.special}`, () => {
      this.locked = false;
      this.activeAttackKind = null;
      this.meterSuperActive = false;
      this.currentAnimKey = '';

      if (this.grounded) {
        this.playState(this.actionKeys.idle, true);
      }
    });
  }

  /**
   * Opens a fresh hit window each time the attack box turns on after being off,
   * so a single animation with several attack-active spans connects once per
   * span (multi-hit specials). Single-span normal attacks are unaffected.
   */
  private updateAttackWindow(): void {
    const active = this.isAttackActiveFrame();

    if (active && !this.attackActiveLast) {
      this.attackConnected = false;
    }

    this.attackActiveLast = active;
  }

  /**
   * Whether the current animation frame has an attack box (independent of
   * whether the current swing has already connected).
   */
  private isAttackActiveFrame(): boolean {
    const kind = this.currentAttackKind();
    if (kind === null) {
      return false;
    }

    const animation = this.currentAnimation();
    if (!animation) {
      return false;
    }

    const frame = this.resolvedFrame(animation);
    return Boolean(this.resolveActiveAttackRect(animation, this.currentFrameIndex(animation), frame.attack, kind));
  }

  private resolveActiveAttackRect(
    animation: HeroAnimationDefinition,
    frameIndex: number,
    authored: Rect | null,
    kind: AttackKind
  ): Rect | null {
    if (kind === 'throw') {
      return null;
    }
    if (kind === 'special') {
      return authored;
    }

    const windows: Record<NormalAttackId, [number, number]> = {
      'light-punch': [0.28, 0.48],
      'medium-punch': [0.38, 0.58],
      'heavy-punch': [0.52, 0.74],
      'light-kick': [0.26, 0.46],
      'medium-kick': [0.4, 0.62],
      'heavy-kick': [0.54, 0.78]
    };
    const normalKind: NormalAttackId = kind === 'high' ? 'light-punch' : kind === 'low' ? 'heavy-kick' : kind;
    const range = windows[normalKind];
    const start = Math.max(1, Math.floor(animation.bounds.length * range[0]));
    const end = Math.max(start, Math.floor(animation.bounds.length * range[1]));
    if (frameIndex < start || frameIndex > end) {
      return null;
    }
    return authored ?? { x: 18, y: 72, width: 104, height: 72 };
  }

  /**
   * Whether any frame after the given index in the animation still has an attack
   * box — used to detect the final hit window of a special (the finisher).
   * @param animation - The active animation.
   * @param frameIndex - The current frame index.
   */
  private hasAttackFrameAfter(animation: HeroAnimationDefinition, frameIndex: number): boolean {
    return animation.bounds.some((frame) => frame.frame > frameIndex && frame.attack !== null);
  }

  /** Launches a jump, playing the jump animation while physics drives the arc. */
  private startJump(): void {
    this.grounded = false;
    this.velocityY = -Math.abs(this.stats().jump);
    this.currentAnimKey = this.actionKeys.jump;
    this.currentReverse = false;
    this.sprite.play({ key: this.actionKeys.jump, repeat: 0 }, true);
  }

  /**
   * Redraws the enabled debug bounds (visual/collision/hit/attack) for the
   * fighter's current animation frame, driven by `debugStore.fighterPlayground.
   * bounds`. Boxes active on the current frame draw solid; boxes only active on
   * other frames draw faint using a representative rect.
   */
  private drawBoundsOverlay(): void {
    this.boundsGraphics.clear();

    const bounds = this.app.debugStore.getState().fighterPlayground.bounds;
    if (FIGHTER_BOUNDS_FIELDS.every((field) => !bounds[field.id])) {
      return;
    }

    const animKey = this.sprite.anims.currentAnim?.key ?? this.currentAnimKey;
    if (!animKey) {
      return;
    }

    const animation = getCharacterAnimationDefinition(this.character.id, animKey);
    if (animation.bounds.length === 0) {
      return;
    }

    const boundsFrame = this.resolvedFrame(animation);

    FIGHTER_BOUNDS_FIELDS.forEach((field) => {
      if (!bounds[field.id]) {
        return;
      }

      const active = boundsFrame[field.id];
      const rect = active ?? this.representativeBoundsRect(animation, field.id);
      if (!rect) {
        return;
      }

      this.strokeBoundsRect(animation, rect, BOUNDS_COLORS[field.id], active ? BOUNDS_ALPHA_ACTIVE : BOUNDS_ALPHA_INACTIVE);
    });
  }

  /**
   * Finds the first frame that defines the given bounds kind, used as a faint
   * placeholder on frames where that kind is inactive.
   * @param animation - The animation whose frames are scanned.
   * @param kind - The bounds kind to look up.
   */
  private representativeBoundsRect(
    animation: HeroAnimationDefinition,
    kind: keyof FighterBoundsVisibility
  ): Rect | null {
    for (const frame of animation.bounds) {
      const rect = frame[kind];
      if (rect) {
        return rect;
      }
    }

    return null;
  }

  /**
   * Strokes (and faintly fills) a frame-local rect in world space, accounting
   * for the fighter's origin, scale, and horizontal flip.
   * @param animation - The active animation (for frame dimensions).
   * @param rect - The frame-local rect to draw.
   * @param color - Stroke/fill colour.
   * @param alpha - Stroke alpha (fill uses a fraction of it).
   */
  private strokeBoundsRect(animation: HeroAnimationDefinition, rect: Rect, color: number, alpha: number): void {
    const world = this.frameRectToWorld(animation, rect);

    this.boundsGraphics.fillStyle(color, alpha * 0.18);
    this.boundsGraphics.fillRect(world.x, world.y, world.width, world.height);
    this.boundsGraphics.lineStyle(2, color, alpha);
    this.boundsGraphics.strokeRect(world.x, world.y, world.width, world.height);
  }

  /**
   * Converts a frame-local rect to a world-space rectangle, accounting for the
   * sprite's origin, scale, and horizontal flip.
   * @param animation - The active animation (for frame dimensions).
   * @param rect - The frame-local rect to convert.
   */
  private frameRectToWorld(animation: HeroAnimationDefinition, rect: Rect): Phaser.Geom.Rectangle {
    const frameWidth = animation.sheet.frameWidth;
    const left = this.sprite.x - this.sprite.displayWidth * this.sprite.originX;
    const top = this.sprite.y - this.sprite.displayHeight * this.sprite.originY;
    const scaleX = this.sprite.displayWidth / frameWidth;
    const scaleY = this.sprite.displayHeight / animation.sheet.frameHeight;
    const localX = this.sprite.flipX ? frameWidth - (rect.x + rect.width) : rect.x;

    return new Phaser.Geom.Rectangle(left + localX * scaleX, top + rect.y * scaleY, rect.width * scaleX, rect.height * scaleY);
  }

  /**
   * Resolves the current frame's bounds with the persisted Character Gym
   * overrides applied, so authored hit/attack/guard boxes drive live combat
   * (not just the gym preview).
   * @param animation - The active animation.
   */
  private resolvedFrame(animation: HeroAnimationDefinition): HeroBoundsFrame {
    const overrides = this.app.debugStore.getState().characterGym.boundsOverrides;

    return resolveHeroBoundsFrame(animation, this.currentFrameIndex(animation), overrides);
  }

  /**
   * Resolves the sprite's current animation frame index, clamped to range.
   * @param animation - The active animation.
   */
  private currentFrameIndex(animation: HeroAnimationDefinition): number {
    const frameName = Number(this.sprite.frame.name);
    const lastFrame = animation.sheet.frames - 1;

    if (Number.isFinite(frameName)) {
      return Phaser.Math.Clamp(frameName, 0, lastFrame);
    }

    return 0;
  }

  /** Keeps the ground shadow under the fighter and shrinks it as they rise. */
  private updateShadow(): void {
    const airborneLift = Phaser.Math.Clamp((this.groundY - this.sprite.y) / 220, 0, 1);

    this.shadow.x = this.posX;
    this.shadow.setScale(1 - airborneLift * 0.45);
    this.shadow.setAlpha(0.32 - airborneLift * 0.18);
  }
}
