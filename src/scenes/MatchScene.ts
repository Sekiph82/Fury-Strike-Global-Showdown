import * as Phaser from 'phaser';

import { Fighter, NEUTRAL_FIGHTER_INPUT, type FighterInput } from '../game/fighter';
import { getAttackProfile, getFighterCombat } from '../game/fighterConfig';
import type { HadoukenSpawnPoint } from '../game/hero';
import { FIGHTER_CHARACTER_DEFINITIONS } from '../game/hero';
import { STAGE_DEFINITIONS } from '../game/stageConfig';
import { MatchHud } from '../game/matchHud';
import { getStageDefinition } from '../game/stageConfig';
import { playSuperCutIn } from '../game/superCutIn';
import { SCENE_KEYS, type AttackProfile, type FighterSpecialMove, type MatchConfig, type NormalAttackId } from '../game/types';
import { spawnHitSpark, type VfxColor } from '../game/vfx';
import { getFighterEnergyStyle, spawnElementalImpact, spawnElementalProjectile } from '../game/vfx';
import { MobileFightControls } from '../game/core/mobileFightControls';
import { formatSpecialCommand, getFighterSpecialCommands, getFighterSpecialStyle, MotionInputBuffer } from '../game/motionInput';
import { advanceHorizontalProjectile } from '../game/projectileMotion';
import { BaseScene } from './BaseScene';

// Stages are authored as full-frame images, but their fighting surfaces do not
// all sit at the bottom edge. Use the visible floor line for the selected stage.
const DEFAULT_GROUND_FRACTION = 0.8;
const EDGE_MARGIN = 170;
const DEPTH_FRONT = 8;
const DEPTH_BACK = 5;

// Fraction of the gap from the screen centre each fighter occupies at spawn.
const SPAWN_OFFSET_FRACTION = 0.18;
// How quickly the camera eases toward the fighters' midpoint (0..1 per frame).
const CAMERA_LERP = 0.14;

const ROUNDS_TO_WIN = 2;
// Seconds on the round clock. When it expires the fighter with more health wins
// (a tie is a draw and replays the round).
const ROUND_SECONDS = 60;
const HUD_DEPTH = 100;
const BANNER_DEPTH = 200;

/** The match's high-level state, driving input gating and the HUD. */
type MatchPhase = 'intro' | 'fighting' | 'roundEnd' | 'matchOver';

interface PlayerKeys {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  crouch: Phaser.Input.Keyboard.Key;
  block: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  attacks: Record<NormalAttackId, Phaser.Input.Keyboard.Key>;
  grab: Phaser.Input.Keyboard.Key;
  special: Phaser.Input.Keyboard.Key;
}

interface Fireball {
  visual: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
  attacker: Fighter;
  direction: 1 | -1;
  x: number;
  y: number;
  age: number;
  speed: number;
  maxAge: number;
  hitSize: number;
  spin: number;
  hitTint: number;
  hitElement?: ReturnType<typeof getFighterEnergyStyle>['element'];
  profile: AttackProfile;
}

/**
 * The versus match: two fighters spawn facing each other and fight a best-of-3
 * (first to {@link ROUNDS_TO_WIN} rounds). Each round runs a "ROUND n / FIGHT!"
 * intro, then live combat — attack boxes vs hurtboxes drive damage, hitstun,
 * knockback, and a knockdown on KO. When the match is decided a game-over
 * overlay offers a rematch or a return to the main menu. P1 is always human;
 * P2 is a simple CPU opponent.
 */
export class MatchScene extends BaseScene {
  private config: MatchConfig = {
    mode: '1vcpu',
    stageId: 'rooftop-twilight',
    p1CharacterId: '',
    p2CharacterId: ''
  };

  private p1!: Fighter;
  private p2!: Fighter;
  private p1Keys!: PlayerKeys;
  private p2Keys!: PlayerKeys;
  private cpu?: CpuController;
  private p1Motion = new MotionInputBuffer();
  private p2Motion = new MotionInputBuffer();
  private touchControls?: MobileFightControls;
  private fireballs: Fireball[] = [];
  private hadoukenSpawnDebug = false;

  private phase: MatchPhase = 'intro';
  private roundNumber = 1;
  private p1Wins = 0;
  private p2Wins = 0;

  private spawnX1 = 0;
  private spawnX2 = 0;

  private stageWorldWidth = 0;
  private maxScroll = 0;

  private hud!: MatchHud;
  private banner!: Phaser.GameObjects.Text;
  private roundTimeMs = ROUND_SECONDS * 1000;
  private overlay: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.Match);
  }

  init(data: MatchConfig): void {
    if (data) {
      this.config = data;
    }
  }

  create(): void {
    this.cpu = undefined;
    this.p1Motion = new MotionInputBuffer();
    this.p2Motion = new MotionInputBuffer();
    this.fireballs = [];
    this.phase = 'intro';
    this.roundNumber = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.overlay = [];

    this.markActiveScene(SCENE_KEYS.Match);
    this.cameras.main.setBackgroundColor(0x05070d);

    this.buildStage();
    this.spawnFighters();
    this.registerKeys();
    if (this.app.isMobileShell || this.app.debugStore.getState().showTouchControls) {
      this.touchControls = new MobileFightControls(this);
    }
    this.createControlsLegend();

    this.hud = new MatchHud(this, {
      mode: this.config.mode,
      p1CharacterId: this.config.p1CharacterId,
      p2CharacterId: this.config.p2CharacterId,
      roundsToWin: ROUNDS_TO_WIN,
      depth: HUD_DEPTH
    });
    this.hud.slideIn();

    this.banner = this.add
      .text(this.cameras.main.centerX, this.cameras.main.centerY - 40, '', {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontSize: '64px',
        stroke: '#020617',
        strokeThickness: 8
      })
      .setOrigin(0.5)
      .setDepth(BANNER_DEPTH)
      .setScrollFactor(0)
      .setAlpha(0);

    if (this.config.mode === '1vcpu' || this.config.mode === 'arcade') {
      this.cpu = new CpuController();
    }

    this.startRound();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.p1?.destroy();
      this.p2?.destroy();
      this.hud?.destroy();
      this.fireballs.forEach((fireball) => fireball.visual.destroy());
      this.fireballs = [];
    });
  }

  /**
   * Per-frame loop: feeds both fighters their input (only while fighting),
   * keeps them facing each other, resolves hits, checks for a KO, and redraws
   * the HUD.
   * @param time - Phaser clock time in ms.
   * @param delta - Milliseconds since the previous frame.
   */
  update(time: number, delta: number): void {
    const seconds = delta / 1000;
    const fighting = this.phase === 'fighting';

    const p1Input = fighting ? this.readKeys(this.p1Keys, this.p1, this.p1Motion, time, this.p2) : { ...NEUTRAL_FIGHTER_INPUT };
    const p2Input = fighting
      ? this.cpu
        ? this.cpu.update(time)
        : this.readKeys(this.p2Keys, this.p2, this.p2Motion, time)
      : { ...NEUTRAL_FIGHTER_INPUT };

    // CPU occasionally unleashes its special once the meter is charged.
    if (fighting && this.cpu && this.p2.isMeterReady && Phaser.Math.Between(0, 150) === 0) {
      p2Input.special = true;
    }

    this.p1.faceToward(this.p2.x);
    this.p2.faceToward(this.p1.x);

    // The Zangief archetype's rapid-punch command is a command grab, not a
    // generic elemental burst. Resolve it against the opponent before the
    // fighters consume their per-frame special input.
    const resolvePiledriver = (attacker: Fighter, defender: Fighter, input: FighterInput): void => {
      if (!fighting || input.specialName !== 'Spinning Piledriver') return;
      input.specialMove = null;
      input.throw = false;
      if (!attacker.throwTarget(defender)) return;
      attacker.registerOffense(false, false);
      defender.registerDefense(false);
    };
    resolvePiledriver(this.p1, this.p2, p1Input);
    resolvePiledriver(this.p2, this.p1, p2Input);

    if (fighting) {
      if (isActing(p1Input)) {
        this.p1.setDepthBase(DEPTH_FRONT);
        this.p2.setDepthBase(DEPTH_BACK);
      } else if (isActing(p2Input)) {
        this.p2.setDepthBase(DEPTH_FRONT);
        this.p1.setDepthBase(DEPTH_BACK);
      }
    }

    this.p1.update(seconds, p1Input);
    this.p2.update(seconds, p2Input);

    if (fighting && p1Input.throw && this.p1.throwTarget(this.p2)) {
      this.p1.registerOffense(false, false);
      this.p2.registerDefense(false);
    }
    if (fighting && p2Input.throw && this.p2.throwTarget(this.p1)) {
      this.p2.registerOffense(false, false);
      this.p1.registerDefense(false);
    }

    this.resolveBodyCollision();
    this.updateFireballs(delta);

    this.updateCamera(false);

    if (fighting) {
      this.resolveCombat();
      this.checkForKnockout();

      if (this.phase === 'fighting') {
        this.tickRoundTimer(delta);
        this.hud.applyHealth(this.p1.health01, this.p2.health01);
      }
    }

    this.hud.setMeter(this.p1.meter01, this.p2.meter01);
    this.hud.setTime(Math.ceil(this.roundTimeMs / 1000));
    this.hud.updateWins(this.p1Wins, this.p2Wins);
  }

  /**
   * Checks both directions for a connecting hit and applies damage/block this
   * frame. A swing only lands once thanks to the attacker's connect flag.
   */
  private resolveCombat(): void {
    this.tryHit(this.p1, this.p2);
    this.tryHit(this.p2, this.p1);
  }

  private resolveBodyCollision(): void {
    const body1 = this.p1.getBodyRect();
    const body2 = this.p2.getBodyRect();
    if (!body1 || !body2 || !Phaser.Geom.Intersects.RectangleToRectangle(body1, body2)) {
      return;
    }
    const overlap = Math.min(body1.right, body2.right) - Math.max(body1.left, body2.left);
    if (overlap <= 0) {
      return;
    }
    const direction = this.p1.x <= this.p2.x ? -1 : 1;
    const correction = overlap / 2 + 1;
    this.p1.setWorldX(this.p1.x + direction * correction);
    this.p2.setWorldX(this.p2.x - direction * correction);
  }

  private spawnSpecialMove(fighter: Fighter, move: FighterSpecialMove, strength: NormalAttackId, name?: string | null, spawnPoint?: HadoukenSpawnPoint): void {
    if (move !== 'hadoken') {
      return;
    }
    // Projectile creation must be driven by the animation's authored release
    // frame. Falling back to a fighter/root coordinate reintroduces the low,
    // feet-aligned spawn bug this path is designed to prevent.
    if (!spawnPoint) {
      return;
    }
    const direction = fighter.facingDirection;
    const tier = strength.startsWith('light') ? 0 : strength.startsWith('heavy') ? 2 : 1;
    // Keep the light orb readable at normal match zoom while preserving a
    // clear size step between light, medium, and heavy punches.
    const projectileScale = [0.65, 0.95, 1.25][tier];
    const speed = [420, 560, 700][tier];
    const maxAge = [1500, 2100, 2700][tier];
    const hitSize = [38, 54, 72][tier];
    // Start just beyond the palms so the first projectile frame clears the
    // release pose instead of looking like a glowing attachment on the glove.
    const x = spawnPoint.x + direction * 26;
    const y = spawnPoint.y + (name === 'Ground Tiger Shot' ? 64 : 0);
    const authoredBlueHadouken = fighter.characterId === 'red-brawler' && name === 'Hadouken';
    const attackElement = getFighterEnergyStyle(fighter.characterId).element;
    const visual = spawnElementalProjectile(this, fighter.characterId, x, y, direction, projectileScale);
    this.fireballs.push({
      visual,
      attacker: fighter,
      direction,
      x,
      y,
      age: 0,
      speed,
      maxAge,
      hitSize,
      profile: scaleAttackProfile(
        getAttackProfile(getFighterCombat(this.app.debugStore.getState().fighterPlayground, fighter.characterId), 'special'),
        [0.75, 1, 1.3][tier]
      ),
      spin: authoredBlueHadouken ? 0 : getFighterEnergyStyle(fighter.characterId).spin,
      hitTint: authoredBlueHadouken ? 0x68b7ff : getFighterEnergyStyle(fighter.characterId).primary,
      hitElement: attackElement
    });
  }

  private updateFireballs(delta: number): void {
    const seconds = delta / 1000;
    for (let index = this.fireballs.length - 1; index >= 0; index -= 1) {
      const fireball = this.fireballs[index];
      fireball.age += delta;
      const nextPosition = advanceHorizontalProjectile(fireball, delta);
      fireball.x = nextPosition.x;
      fireball.y = nextPosition.y;
      fireball.visual.setPosition(fireball.x, fireball.y).setRotation(fireball.visual.rotation + fireball.direction * fireball.spin * seconds);

      const target = fireball.attacker === this.p1 ? this.p2 : this.p1;
      const hurt = target.getHurtRect();
      const projectileRect = new Phaser.Geom.Rectangle(
        fireball.x - fireball.hitSize / 2,
        fireball.y - fireball.hitSize / 2,
        fireball.hitSize,
        fireball.hitSize
      );
      if (hurt && Phaser.Geom.Intersects.RectangleToRectangle(projectileRect, hurt)) {
        const guard = target.getGuardRect();
        const blocked = guard !== null && Phaser.Geom.Intersects.RectangleToRectangle(projectileRect, guard);
        target.applyHit(fireball.profile, fireball.direction, blocked, { element: fireball.hitElement, tint: fireball.hitTint });
        target.flashHit(blocked, fireball.hitTint);
        fireball.attacker.registerOffense(blocked, false);
        target.registerDefense(blocked);
        const impact = new Phaser.Geom.Rectangle(
          fireball.x - fireball.hitSize / 2,
          fireball.y - fireball.hitSize / 2,
          fireball.hitSize,
          fireball.hitSize
        );
        this.spawnHitFx(projectileRect, impact, blocked, true, false, fireball.attacker.characterId,
          fireball.attacker.characterId === 'red-brawler' ? 'blue' : undefined,
          fireball.hitElement);
        fireball.visual.destroy();
        this.fireballs.splice(index, 1);
        continue;
      }

      if (fireball.age > fireball.maxAge || fireball.x < 0 || fireball.x > this.stageWorldWidth) {
        fireball.visual.destroy();
        this.fireballs.splice(index, 1);
      }
    }
  }

  /**
   * Resolves a single attacker -> defender interaction for the current frame.
   * Blocking is purely geometric: the hit is guarded when the attack box
   * overlaps the defender's active guard box (from its block pose).
   * @param attacker - The fighter whose attack box is tested.
   * @param defender - The fighter whose hurtbox is tested.
   */
  private tryHit(attacker: Fighter, defender: Fighter): void {
    if (defender.isDefeated) {
      return;
    }

    const attack = attacker.getActiveAttack();
    if (!attack) {
      return;
    }

    const hurt = defender.getHurtRect();
    if (!hurt || !Phaser.Geom.Intersects.RectangleToRectangle(attack.rect, hurt)) {
      return;
    }

    const guard = defender.getGuardRect();
    const blocked = guard !== null && Phaser.Geom.Intersects.RectangleToRectangle(attack.rect, guard);
    const isSpecial = attack.profile.kind === 'special';
    const finisher = attack.finisher && !blocked;

    // The combo finisher launches harder and stuns longer than a regular hit.
    const profile = finisher
      ? { ...attack.profile, knockback: attack.profile.knockback * 1.9, hitstun: attack.profile.hitstun * 1.4 }
      : attack.profile;

    const authoredBlueShoryuken = attacker.characterId === 'red-brawler' && attacker.activeSpecialLabel === 'Shoryuken';
    const specialTint = authoredBlueShoryuken ? 0x68b7ff : isSpecial ? getFighterEnergyStyle(attacker.characterId).primary : undefined;
    const element = isSpecial ? getFighterEnergyStyle(attacker.characterId).element : undefined;
    defender.applyHit(profile, attacker.facingDirection, blocked, {
      sweepKnockdown: attack.sweepKnockdown && !blocked,
      element,
      tint: specialTint
    });
    defender.flashHit(blocked, specialTint);
    attacker.markAttackConnected();
    attacker.registerOffense(blocked, attacker.isMeterSuper);
    defender.registerDefense(blocked);

    this.spawnHitFx(attack.rect, hurt, blocked, isSpecial, finisher, attacker.characterId,
      authoredBlueShoryuken ? 'blue' : undefined,
      element);
  }

  /**
   * Spawns the impact spark and camera shake for a connecting hit, scaled up for
   * special hits and the combo finisher.
   * @param attackRect - The attacker's attack box (world space).
   * @param hurtRect - The defender's hurtbox (world space).
   * @param blocked - Whether the hit was guarded.
   * @param isSpecial - Whether the attack was a special move.
   * @param finisher - Whether this is the special's finishing hit.
   */
  private spawnHitFx(
    attackRect: Phaser.Geom.Rectangle,
    hurtRect: Phaser.Geom.Rectangle,
    blocked: boolean,
    isSpecial: boolean,
    finisher: boolean,
    attackerCharacterId: string,
    impactColor?: VfxColor,
    impactElement?: ReturnType<typeof getFighterEnergyStyle>['element']
  ): void {
    const sparkX = (Phaser.Geom.Rectangle.GetCenter(attackRect).x + Phaser.Geom.Rectangle.GetCenter(hurtRect).x) / 2;
    const sparkY = (Phaser.Geom.Rectangle.GetCenter(attackRect).y + Phaser.Geom.Rectangle.GetCenter(hurtRect).y) / 2;

    const color: VfxColor = blocked ? 'blue' : finisher ? 'gold' : impactColor ?? 'red';
    const sparkScale = finisher ? 1.7 : isSpecial ? 1.1 : 0.9;
    spawnHitSpark(this, sparkX, sparkY, color, sparkScale);
    if (isSpecial && (impactColor !== 'blue' || impactElement)) {
      // Place the elemental burst on the defender. The metallic contact spark
      // stays between the two hitboxes, while the elemental reaction belongs
      // to the fighter receiving the attack.
      spawnElementalImpact(
        this,
        attackerCharacterId,
        Phaser.Geom.Rectangle.GetCenter(hurtRect).x,
        Phaser.Geom.Rectangle.GetCenter(hurtRect).y,
        impactElement
      );
    }

    if (finisher) {
      this.cameras.main.shake(220, 0.012);
    } else if (isSpecial) {
      this.cameras.main.shake(blocked ? 60 : 90, blocked ? 0.003 : 0.005);
    } else {
      this.cameras.main.shake(blocked ? 60 : 120, blocked ? 0.003 : 0.006);
    }
  }

  /** Ends the round when either fighter is knocked out. */
  private checkForKnockout(): void {
    if (this.p1.isDefeated) {
      this.endRound(2);
    } else if (this.p2.isDefeated) {
      this.endRound(1);
    }
  }

  /**
   * Counts the round clock down while fighting. When it reaches zero the round
   * is decided on remaining health (a tie replays the round as a draw).
   * @param delta - Milliseconds since the previous frame.
   */
  private tickRoundTimer(delta: number): void {
    this.roundTimeMs = Math.max(0, this.roundTimeMs - delta);

    if (this.roundTimeMs <= 0) {
      this.resolveTimeOut();
    }
  }

  /** Decides a timed-out round by comparing remaining health. */
  private resolveTimeOut(): void {
    const p1 = this.p1.health01;
    const p2 = this.p2.health01;

    if (p1 > p2) {
      this.endRound(1, 'TIME UP', '#facc15');
    } else if (p2 > p1) {
      this.endRound(2, 'TIME UP', '#facc15');
    } else {
      this.drawRound();
    }
  }

  /** Handles a drawn round (timeout with equal health): replays the round. */
  private drawRound(): void {
    if (this.phase !== 'fighting') {
      return;
    }

    this.phase = 'roundEnd';
    this.showBanner('DRAW', '#e2e8f0', 1.1);
    this.time.delayedCall(1100, () => this.startRound());
  }

  /**
   * Places the chosen stage fit to the viewport height, anchored at world x=0,
   * and sets up the scrollable world. The stage's on-screen width becomes the
   * world width; the camera is bounded to it so it can scroll horizontally and
   * stop at the stage ends (producing corners).
   */
  private buildStage(): void {
    const cam = this.cameras.main;
    const stage = getStageDefinition(this.config.stageId);
    const source = this.textures.get(stage.key).getSourceImage();
    const scale = cam.height / (source.height || stage.height);
    this.stageWorldWidth = (source.width || stage.width) * scale;
    this.maxScroll = Math.max(0, this.stageWorldWidth - cam.width);

    this.add.image(0, 0, stage.key).setOrigin(0, 0).setScale(scale).setDepth(0);
    cam.setBounds(0, 0, this.stageWorldWidth, cam.height);
  }

  /** Spawns P1 (left, facing right) and P2 (right, facing left). */
  private spawnFighters(): void {
    const cam = this.cameras.main;
    const groundY = Math.round(cam.height * (getStageDefinition(this.config.stageId).groundYFraction ?? DEFAULT_GROUND_FRACTION));
    const minX = EDGE_MARGIN;
    const maxX = this.stageWorldWidth - EDGE_MARGIN;
    const center = this.stageWorldWidth / 2;
    this.spawnX1 = Math.round(center - cam.width * SPAWN_OFFSET_FRACTION);
    this.spawnX2 = Math.round(center + cam.width * SPAWN_OFFSET_FRACTION);

    this.p1 = new Fighter({
      scene: this,
      app: this.app,
      characterId: this.config.p1CharacterId,
      x: this.spawnX1,
      groundY,
      facing: 1,
      minX,
      maxX,
      depth: DEPTH_FRONT,
      onSpecialStart: (fighter) => playSuperCutIn(this, { characterId: fighter.characterId, side: 'left' }),
      onSpecialMove: (fighter, move, strength, name, point) => this.spawnSpecialMove(fighter, move, strength, name, point)
    });

    this.p2 = new Fighter({
      scene: this,
      app: this.app,
      characterId: this.config.p2CharacterId,
      x: this.spawnX2,
      groundY,
      facing: -1,
      minX,
      maxX,
      depth: DEPTH_BACK,
      onSpecialStart: (fighter) => playSuperCutIn(this, { characterId: fighter.characterId, side: 'right' }),
      onSpecialMove: (fighter, move, strength, name, point) => this.spawnSpecialMove(fighter, move, strength, name, point)
    });
  }

  /**
   * Group-camera tracking: scrolls horizontally to keep both fighters framed
   * around their midpoint, clamped to the stage ends (so it stops at corners),
   * then turns the visible screen edges into movement walls for both fighters.
   * This is what produces the "camera locks until one fighter relents" feel —
   * neither fighter can walk off-screen, so they can only separate as far as the
   * screen is wide.
   * @param snap - When true, jumps to the target scroll instantly (round start)
   *   instead of easing toward it.
   */
  private updateCamera(snap: boolean): void {
    const cam = this.cameras.main;
    const viewWidth = cam.width;
    const midpoint = (this.p1.x + this.p2.x) / 2;
    const targetScroll = Phaser.Math.Clamp(midpoint - viewWidth / 2, 0, this.maxScroll);
    const scrollX = snap ? targetScroll : Phaser.Math.Linear(cam.scrollX, targetScroll, CAMERA_LERP);

    cam.setScroll(scrollX, 0);

    const leftWall = scrollX + EDGE_MARGIN;
    const rightWall = scrollX + viewWidth - EDGE_MARGIN;
    this.p1.setHorizontalBounds(leftWall, rightWall);
    this.p2.setHorizontalBounds(leftWall, rightWall);
  }

  /** Registers the two keyboard control schemes plus the menu shortcut. */
  private registerKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('MatchScene requires keyboard input');
    }

    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.p1Keys = {
      left: keyboard.addKey(codes.A),
      right: keyboard.addKey(codes.D),
      crouch: keyboard.addKey(codes.S),
      block: keyboard.addKey(codes.C),
      jump: keyboard.addKey(codes.W),
      attacks: {
        'light-punch': keyboard.addKey(codes.I),
        'medium-punch': keyboard.addKey(codes.O),
        'heavy-punch': keyboard.addKey(codes.P),
        'light-kick': keyboard.addKey(codes.K),
        'medium-kick': keyboard.addKey(codes.L),
        'heavy-kick': keyboard.addKey(codes.SEMICOLON)
      },
      grab: keyboard.addKey(codes.U),
      special: keyboard.addKey(codes.V)
    };

    this.p2Keys = {
      left: keyboard.addKey(codes.LEFT),
      right: keyboard.addKey(codes.RIGHT),
      crouch: keyboard.addKey(codes.DOWN),
      block: keyboard.addKey(codes.FORWARD_SLASH),
      jump: keyboard.addKey(codes.UP),
      attacks: {
        'light-punch': keyboard.addKey(codes.NUMPAD_ONE),
        'medium-punch': keyboard.addKey(codes.NUMPAD_TWO),
        'heavy-punch': keyboard.addKey(codes.NUMPAD_THREE),
        'light-kick': keyboard.addKey(codes.NUMPAD_FOUR),
        'medium-kick': keyboard.addKey(codes.NUMPAD_FIVE),
        'heavy-kick': keyboard.addKey(codes.NUMPAD_SIX)
      },
      grab: keyboard.addKey(codes.NUMPAD_ZERO),
      special: keyboard.addKey(codes.L)
    };

    keyboard.on('keydown-ESC', () => this.goToMenu());
    keyboard.on('keydown-BACKSPACE', () => this.goToMenu());
    keyboard.on('keydown-R', () => {
      if (this.phase === 'matchOver') {
        this.rematch();
      }
    });
    keyboard.on('keydown-N', () => this.advanceArcade());
    keyboard.on('keydown-B', () => {
      this.hadoukenSpawnDebug = !this.hadoukenSpawnDebug;
      this.p1.setHadoukenDebugVisible(this.hadoukenSpawnDebug);
      this.p2.setHadoukenDebugVisible(this.hadoukenSpawnDebug);
    });
  }

  /**
   * Reads a control scheme into a fighter input snapshot. Held keys map to held
   * inputs; jump/light/heavy use edge detection so they fire once per press.
   * @param keys - The player's resolved keys.
   */
  private readKeys(keys: PlayerKeys, fighter: Fighter, motion: MotionInputBuffer, time: number, target?: Fighter): FighterInput {
    const touch = this.touchControls?.readInput() ?? {};
    const keyboardAttack = (Object.entries(keys.attacks) as [NormalAttackId, Phaser.Input.Keyboard.Key][])
      .find(([, key]) => Phaser.Input.Keyboard.JustDown(key))?.[0] ?? null;
    const attack = keyboardAttack ?? touch.attack ?? null;
    const left = keys.left.isDown || Boolean(touch.left);
    const right = keys.right.isDown || Boolean(touch.right);
    const crouch = keys.crouch.isDown || Boolean(touch.crouch);
    const heldAttacks = (Object.entries(keys.attacks) as [NormalAttackId, Phaser.Input.Keyboard.Key][])
      .filter(([, key]) => key.isDown).map(([id]) => id);
    motion.sample(left, right, crouch, fighter.facingDirection, time, keys.jump.isDown, heldAttacks);
    const activation = motion.consume(attack, time, fighter.characterId, heldAttacks, !fighter.isGrounded,
      target ? Math.abs(target.x - fighter.x) : Number.POSITIVE_INFINITY);
    // Zangief's command-grab is resolved by the shared throw/collision path so
    // the defender gets the real launch, rotation, and knockdown reaction.
    const commandThrow = activation?.label === 'Spinning Piledriver';
    const specialMove = commandThrow ? null : activation?.move ?? null;
    return {
      left,
      right,
      crouch,
      block: keys.block.isDown || Boolean(touch.block),
      jump: !specialMove && (Phaser.Input.Keyboard.JustDown(keys.jump) || Boolean(touch.jump)),
      attack: specialMove || commandThrow ? null : attack,
      throw: !commandThrow && (Phaser.Input.Keyboard.JustDown(keys.grab) || Boolean(touch.throw)),
      specialMove,
      specialStrength: specialMove ? activation?.attack ?? attack : null,
      specialName: activation?.label ?? null,
      special: Phaser.Input.Keyboard.JustDown(keys.special) || Boolean(touch.special)
    };
  }

  /** Draws the control legend at the bottom of the screen. */
  private createControlsLegend(): void {
    const { centerX, height } = this.cameras.main;
    const p1 = 'P1: WASD move/jump/crouch • I/O/P punches • K/L/; kicks • U throw • C block • V super • B spawn-point debug';
    const p2 = 'P2: CPU';
    const moves = getFighterSpecialCommands(this.p1.characterId)
      .map((rule) => `${rule.label}: ${formatSpecialCommand(rule)}`);
    const style = `P1 STYLE: ${getFighterSpecialStyle(this.p1.characterId)}`;

    this.add
      .text(centerX, height - 8, [p1, p2, style, ...moves].join('\n'), {
        color: '#cbd5f5',
        fontFamily: 'monospace',
        fontSize: '10px',
        backgroundColor: 'rgba(2, 6, 23, 0.6)',
        padding: { x: 10, y: 5 },
        align: 'center',
        lineSpacing: 1
      })
      .setOrigin(0.5, 1)
      .setDepth(HUD_DEPTH)
      .setScrollFactor(0);
  }

  /** Resets both fighters to their corners and runs the round intro. */
  private startRound(): void {
    this.phase = 'intro';
    this.roundTimeMs = ROUND_SECONDS * 1000;

    const fullMin = EDGE_MARGIN;
    const fullMax = this.stageWorldWidth - EDGE_MARGIN;
    this.p1.setHorizontalBounds(fullMin, fullMax);
    this.p2.setHorizontalBounds(fullMin, fullMax);

    this.p1.resetForRound(this.spawnX1, 1);
    this.p2.resetForRound(this.spawnX2, -1);
    this.p1.setDepthBase(DEPTH_FRONT);
    this.p2.setDepthBase(DEPTH_BACK);
    this.updateCamera(true);
    this.hud.animateFill();
    this.hud.updateWins(this.p1Wins, this.p2Wins);

    this.showBanner(`ROUND ${this.roundNumber}`, '#f8fafc');

    this.time.delayedCall(900, () => {
      if (this.phase !== 'intro') {
        return;
      }

      this.showBanner('FIGHT!', '#facc15', 1.15);
      this.phase = 'fighting';
      this.p1.setFrozen(false);
      this.p2.setFrozen(false);

      this.time.delayedCall(650, () => this.hideBanner());
    });
  }

  /**
   * Concludes the current round, tallies the win, and either advances to the
   * next round or ends the match.
   * @param winner - Which player won (1 or 2).
   * @param bannerText - The banner to show (defaults to a knockout).
   * @param bannerColor - The banner colour.
   */
  private endRound(winner: 1 | 2, bannerText = 'K.O.', bannerColor = '#f43f5e'): void {
    if (this.phase !== 'fighting') {
      return;
    }

    this.phase = 'roundEnd';

    if (winner === 1) {
      this.p1Wins += 1;
    } else {
      this.p2Wins += 1;
    }

    this.showBanner(bannerText, bannerColor, 1.2);

    this.time.delayedCall(1100, () => {
      const matchOver = this.p1Wins >= ROUNDS_TO_WIN || this.p2Wins >= ROUNDS_TO_WIN;

      if (matchOver) {
        this.endMatch();
      } else {
        this.roundNumber += 1;
        this.startRound();
      }
    });
  }

  /**
   * Shows the game-over overlay with the match winner and rematch / menu options.
   * @param winnerName - The display name of the match winner.
   */
  private endMatch(): void {
    this.phase = 'matchOver';
    this.hideBanner();
    const winner: 1 | 2 = this.p1Wins >= ROUNDS_TO_WIN ? 1 : 2;
    this.scene.start(SCENE_KEYS.Results, {
      config: this.config,
      p1Wins: this.p1Wins,
      p2Wins: this.p2Wins,
      winner
    });
  }

  /** Restarts the match from round 1 with the same configuration. */
  private rematch(): void {
    this.overlay.forEach((object) => object.destroy());
    this.overlay = [];
    this.roundNumber = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.cpu = new CpuController();
    this.startRound();
  }

  private advanceArcade(): void {
    if (this.phase !== 'matchOver' || this.config.mode !== 'arcade' || this.p1Wins < ROUNDS_TO_WIN) {
      return;
    }

    const opponents = FIGHTER_CHARACTER_DEFINITIONS.filter((character) => character.id !== this.config.p1CharacterId);
    if (!opponents.length) return;
    const currentOpponent = opponents.findIndex((character) => character.id === this.config.p2CharacterId);
    const nextOpponent = opponents[(currentOpponent + 1) % opponents.length];
    const currentStage = STAGE_DEFINITIONS.findIndex((stage) => stage.id === this.config.stageId);
    const nextStage = STAGE_DEFINITIONS[(currentStage + 1) % STAGE_DEFINITIONS.length];

    this.scene.restart({
      ...this.config,
      p2CharacterId: nextOpponent.id,
      stageId: nextStage.id,
      arcadeFight: (this.config.arcadeFight ?? 0) + 1
    });
  }

  /**
   * Shows the centre banner with a short pop-in tween.
   * @param text - The banner text.
   * @param color - The text colour.
   * @param peakScale - The scale to settle at (default 1).
   */
  private showBanner(text: string, color: string, peakScale = 1): void {
    this.banner.setText(text).setColor(color).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: this.banner, alpha: 1, scale: peakScale, duration: 260, ease: 'Back.Out' });
  }

  /** Fades the centre banner out. */
  private hideBanner(): void {
    this.tweens.add({ targets: this.banner, alpha: 0, duration: 300 });
  }
}

/**
 * Whether an input represents the fighter actively doing something (moving,
 * jumping, or attacking) this frame — used to decide who draws in front.
 * @param input - The fighter input snapshot to test.
 */
function isActing(input: FighterInput): boolean {
  return input.left || input.right || input.jump || input.attack !== null || input.specialMove !== null || input.throw || input.specialName === 'Spinning Piledriver';
}

function scaleAttackProfile(profile: AttackProfile, multiplier: number): AttackProfile {
  return {
    ...profile,
    damage: Math.max(1, Math.round(profile.damage * multiplier)),
    knockback: Math.round(profile.knockback * multiplier),
    hitstun: Math.round(profile.hitstun * multiplier)
  };
}

/**
 * A placeholder CPU opponent: mostly idle, occasionally performing a short
 * random action (a strike, a hop, or a brief walk/crouch/block). Produces a
 * {@link FighterInput} each frame for the second fighter in 1vCPU matches.
 */
class CpuController {
  private nextDecisionAt = 0;
  private holdUntil = 0;
  private moveDir = 0;
  private holdCrouch = false;
  private holdBlock = false;

  /**
   * Produce the CPU's input for this frame.
   * @param timeMs - The current Phaser clock time in ms.
   */
  update(timeMs: number): FighterInput {
    const input: FighterInput = { ...NEUTRAL_FIGHTER_INPUT };

    if (timeMs >= this.nextDecisionAt) {
      this.decide(timeMs, input);
      this.nextDecisionAt = timeMs + Phaser.Math.Between(700, 1700);
    }

    if (timeMs < this.holdUntil) {
      if (this.moveDir < 0) {
        input.left = true;
      } else if (this.moveDir > 0) {
        input.right = true;
      }
      input.crouch = input.crouch || this.holdCrouch;
      input.block = input.block || this.holdBlock;
    } else {
      this.moveDir = 0;
      this.holdCrouch = false;
      this.holdBlock = false;
    }

    return input;
  }

  /**
   * Choose the CPU's next behaviour, emitting one-shot strikes immediately and
   * scheduling held movement/guard for a short window.
   * @param timeMs - The current Phaser clock time in ms.
   * @param input - The input snapshot to mutate for one-shot edges.
   */
  private decide(timeMs: number, input: FighterInput): void {
    const roll = Math.random();

    if (roll < 0.32) {
      return;
    }
    if (roll < 0.5) {
      input.attack = 'light-punch';
      return;
    }
    if (roll < 0.63) {
      input.attack = 'heavy-kick';
      return;
    }
    if (roll < 0.72) {
      input.jump = true;
      return;
    }
    if (roll < 0.9) {
      this.moveDir = Math.random() < 0.5 ? -1 : 1;
      this.holdUntil = timeMs + Phaser.Math.Between(350, 800);
      return;
    }

    if (Math.random() < 0.5) {
      this.holdCrouch = true;
    } else {
      this.holdBlock = true;
    }
    this.holdUntil = timeMs + Phaser.Math.Between(350, 800);
  }
}
