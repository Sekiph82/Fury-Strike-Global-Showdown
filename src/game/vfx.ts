import * as Phaser from 'phaser';

import { FIGHTING_UI_ATLAS_TEXTURE_KEY } from './fightingUiAtlas';
import { getFighterEnergyStyle } from './energyStyles';
import { RED_BRAWLER_HADOKEN_PROJECTILE_ANIMATION_KEY } from './redBrawler';
export { getFighterEnergyStyle } from './energyStyles';
export type { FighterEnergyElement, FighterEnergyStyle } from './energyStyles';

/** Render depth for combat VFX: above fighters, below the HUD. */
const VFX_DEPTH = 90;

/** Draws a roster-themed projectile instead of tinting one blue projectile for every fighter. */
export function spawnElementalProjectile(
  scene: Phaser.Scene,
  characterId: string,
  x: number,
  y: number,
  facing: 1 | -1,
  scale: number
): Phaser.GameObjects.Container | Phaser.GameObjects.Sprite {
  if (characterId === 'red-brawler' && scene.textures.exists('red-brawler-hadoken-projectile')) {
    if (!scene.anims.exists(RED_BRAWLER_HADOKEN_PROJECTILE_ANIMATION_KEY)) {
      scene.anims.create({
        key: RED_BRAWLER_HADOKEN_PROJECTILE_ANIMATION_KEY,
        frames: scene.anims.generateFrameNumbers('red-brawler-hadoken-projectile', { start: 0, end: 5 }),
        frameRate: 14,
        repeat: -1
      });
    }
    const authoredProjectile = scene.add.sprite(x, y, 'red-brawler-hadoken-projectile', 0)
      .setDepth(VFX_DEPTH + 2)
      .setScale(scale)
      .setFlipX(facing === -1);
    authoredProjectile.play(RED_BRAWLER_HADOKEN_PROJECTILE_ANIMATION_KEY);
    return authoredProjectile;
  }

  const style = getFighterEnergyStyle(characterId);
  const root = scene.add.container(x, y).setDepth(VFX_DEPTH + 2).setScale(scale);
  const graphic = scene.add.graphics();
  root.add(graphic);
  const g = graphic;
  const point = (px: number, py: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(px * facing, py);
  const moveTo = (px: number, py: number): void => { const p = point(px, py); g.moveTo(p.x, p.y); };
  const lineTo = (px: number, py: number): void => { const p = point(px, py); g.lineTo(p.x, p.y); };
  const triangle = (points: Array<[number, number]>, color: number, alpha = 1): void => {
    g.fillStyle(color, alpha);
    g.fillPoints(points.map(([px, py]) => point(px, py)), true, true);
  };

  // Fallback bolts are stretched along their travel axis so non-Red-Brawler
  // projectiles read as moving energy shots instead of round bombs.
  g.fillStyle(style.primary, 0.24);
  g.fillEllipse(0, 0, 104, 58);
  g.fillStyle(style.primary, 0.92);
  g.fillEllipse(0, 0, 78, 40);
  g.fillStyle(style.secondary, 0.98);
  g.fillEllipse(facing * 9, -1, 48, 27);
  g.fillStyle(0xffffff, 0.92);
  g.fillEllipse(facing * 19, -3, 25, 15);

  if (style.element === 'fire') {
    triangle([[-18, -9], [-47, -19], [-31, 0]], style.secondary);
    triangle([[-18, 7], [-48, 21], [-32, 1]], style.primary);
    triangle([[-11, -2], [-38, -5], [-28, 7]], 0xfff0a0, 0.9);
  } else if (style.element === 'electric') {
    for (let branch = 0; branch < 4; branch += 1) {
      const y0 = -23 + branch * 14;
      g.lineStyle(branch % 2 ? 3 : 5, branch % 2 ? style.secondary : style.primary, 0.98);
      g.beginPath();
      moveTo(-8, y0);
      lineTo(-20, y0 - 8);
      lineTo(-26, y0 + 2);
      lineTo(-42, y0 - 5);
      g.strokePath();
    }
  } else if (style.element === 'wind' || style.element === 'water') {
    for (let ring = 0; ring < 3; ring += 1) {
      const radiusX = 28 + ring * 8;
      const radiusY = 12 + ring * 4;
      const points: Phaser.Math.Vector2[] = [];
      for (let step = 0; step <= 14; step += 1) {
        const angle = (step / 14) * Math.PI * 1.7 + ring * 0.7;
        points.push(point(Math.cos(angle) * radiusX, Math.sin(angle) * radiusY));
      }
      g.lineStyle(ring === 1 ? 5 : 3, ring === 1 ? style.secondary : style.primary, 0.95 - ring * 0.15);
      g.strokePoints(points, false, false);
    }
  } else if (style.element === 'ice') {
    for (let shard = 0; shard < 6; shard += 1) {
      const angle = shard * Math.PI / 3;
      const cx = Math.cos(angle) * 34;
      const cy = Math.sin(angle) * 25;
      triangle([[cx + Math.cos(angle) * 11, cy + Math.sin(angle) * 11], [cx - Math.sin(angle) * 6, cy + Math.cos(angle) * 6], [cx + Math.sin(angle) * 6, cy - Math.cos(angle) * 6]], style.secondary, 0.95);
    }
  }
  return root;
}

/** Element-specific impact burst shared by every fighter's special hit. */
export function spawnElementalImpact(
  scene: Phaser.Scene,
  characterId: string,
  x: number,
  y: number,
  elementOverride?: ReturnType<typeof getFighterEnergyStyle>['element']
): void {
  const fighterStyle = getFighterEnergyStyle(characterId);
  const element = elementOverride ?? fighterStyle.element;
  const palette = {
    fire: [0xff4b1f, 0xffd34f],
    electric: [0x65f044, 0xe4ff72],
    wind: [0x27d8ce, 0xff85c8],
    water: [0x16d9d2, 0xd9ffff],
    ice: [0x8aeaff, 0xffffff]
  } as const;
  const [primary, secondary] = !elementOverride || elementOverride === fighterStyle.element
    ? [fighterStyle.primary, fighterStyle.secondary]
    : palette[element];
  if (element === 'ice' && scene.textures.exists('vfx-ice-impact')) {
    const iceImpact = scene.add.image(x, y, 'vfx-ice-impact')
      .setDepth(VFX_DEPTH + 4)
      .setScale(0.07)
      .setAlpha(0.98);
    scene.tweens.add({
      targets: iceImpact,
      scale: 0.1,
      alpha: 0,
      duration: 560,
      ease: 'Cubic.Out',
      onComplete: () => iceImpact.destroy()
    });
    return;
  }

  const burst = scene.add.container(x, y).setDepth(VFX_DEPTH + 4).setScale(0.55);
  const g = scene.add.graphics();
  burst.add(g);
  g.fillStyle(primary, 0.28).fillCircle(0, 0, 32);
  g.lineStyle(4, secondary, 0.95);
  if (element === 'electric') {
    for (let branch = 0; branch < 6; branch += 1) {
      const angle = branch * Math.PI / 3;
      const x1 = Math.cos(angle) * 11, y1 = Math.sin(angle) * 11;
      const x2 = Math.cos(angle + 0.2) * 25, y2 = Math.sin(angle + 0.2) * 25;
      const x3 = Math.cos(angle - 0.1) * 39, y3 = Math.sin(angle - 0.1) * 39;
      g.beginPath().moveTo(x1, y1).lineTo(x2, y2).lineTo(x3, y3).strokePath();
    }
  } else if (element === 'ice') {
    for (let shard = 0; shard < 8; shard += 1) {
      const angle = shard * Math.PI / 4;
      const cx = Math.cos(angle) * 22, cy = Math.sin(angle) * 22;
      g.fillStyle(secondary, 0.9).fillPoints([
        new Phaser.Math.Vector2(cx + Math.cos(angle) * 15, cy + Math.sin(angle) * 15),
        new Phaser.Math.Vector2(cx - Math.sin(angle) * 6, cy + Math.cos(angle) * 6),
        new Phaser.Math.Vector2(cx + Math.sin(angle) * 6, cy - Math.cos(angle) * 6)
      ], true, true);
    }
  } else if (element === 'water') {
    for (let drop = 0; drop < 7; drop += 1) {
      const angle = drop * Math.PI * 2 / 7;
      g.fillStyle(secondary, 0.9).fillCircle(Math.cos(angle) * 34, Math.sin(angle) * 25, 4 + (drop % 2) * 2);
    }
  } else if (element === 'wind') {
    g.strokeEllipse(0, 0, 56, 30);
    g.strokeEllipse(0, 0, 78, 44);
  } else {
    for (let spark = 0; spark < 8; spark += 1) {
      const angle = spark * Math.PI / 4;
      g.fillStyle(spark % 2 ? secondary : primary, 0.95)
        .fillCircle(Math.cos(angle) * 34, Math.sin(angle) * 27, 4 + spark % 3);
    }
  }
  scene.tweens.add({ targets: burst, scale: 1.25, alpha: 0, duration: element === 'ice' ? 340 : 240, ease: 'Cubic.Out', onComplete: () => burst.destroy() });
}

/** Adds a fast charge trail using the attacking fighter's own elemental palette. */
export function spawnCrusherTrail(scene: Phaser.Scene, characterId: string, x: number, y: number, facing: 1 | -1, travel: number, duration: number): void {
  const style = getFighterEnergyStyle(characterId);
  const trail = scene.add.container(x, y).setDepth(VFX_DEPTH - 2).setScale(facing, 1);
  const rings = scene.add.graphics();
  rings.lineStyle(8, style.primary, 0.95);
  rings.strokeEllipse(0, 0, 115, 54);
  rings.lineStyle(3, style.secondary, 0.95);
  rings.strokeEllipse(0, 0, 91, 34);
  rings.lineStyle(5, style.primary, 0.9);
  rings.beginPath();
  rings.moveTo(-66, -12);
  rings.lineTo(-45, -27);
  rings.lineTo(-30, -7);
  rings.lineTo(-8, -24);
  rings.lineTo(14, 9);
  rings.lineTo(36, -18);
  rings.lineTo(63, 4);
  rings.strokePath();
  trail.add(rings);
  scene.tweens.add({
    targets: trail,
    x: x + facing * travel,
    rotation: facing * Math.PI * 3,
    alpha: 0,
    duration,
    ease: 'Quad.In',
    onComplete: () => trail.destroy()
  });
}

/** Tint/spark colour keyed to the kind of impact. */
export type VfxColor = 'red' | 'gold' | 'blue';

const SPARK_FRAME: Record<VfxColor, string> = {
  red: 'icon-hit-red',
  gold: 'icon-hit-gold',
  blue: 'icon-hit-blue'
};

const FLASH_TINT: Record<VfxColor, number> = {
  red: 0xff5a5a,
  gold: 0xffd24a,
  blue: 0x7ec8ff
};

/**
 * Spawns a short-lived hit spark (an atlas impact icon) at a contact point that
 * pops in, scales up, and fades out. Used when an attack connects.
 * @param scene - The owning scene.
 * @param x - World x of the contact point.
 * @param y - World y of the contact point.
 * @param color - Spark colour (red clean hit, blue blocked, gold finisher).
 * @param scale - Peak display scale of the spark (default 1).
 */
export function spawnHitSpark(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: VfxColor = 'red',
  scale = 1
): void {
  const frame = SPARK_FRAME[color];
  if (!scene.textures.exists(FIGHTING_UI_ATLAS_TEXTURE_KEY)) {
    spawnImpactFlash(scene, x, y, color, 40 * scale);
    return;
  }

  const spark = scene.add
    .image(x, y, FIGHTING_UI_ATLAS_TEXTURE_KEY, frame)
    .setDepth(VFX_DEPTH)
    .setScrollFactor(1)
    .setScale(0.2 * scale)
    .setAngle(Phaser.Math.Between(-30, 30))
    .setAlpha(1);

  scene.tweens.add({
    targets: spark,
    scale: scale,
    alpha: 0,
    duration: 220,
    ease: 'Cubic.Out',
    onComplete: () => spark.destroy()
  });

  spawnImpactFlash(scene, x, y, color, 34 * scale);
}

/**
 * Spawns an expanding ring flash at a point that fades as it grows.
 * @param scene - The owning scene.
 * @param x - World x of the flash centre.
 * @param y - World y of the flash centre.
 * @param color - Flash tint.
 * @param radius - Peak radius in world pixels.
 */
export function spawnImpactFlash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: VfxColor,
  radius = 40
): void {
  const ring = scene.add
    .circle(x, y, radius * 0.3, FLASH_TINT[color], 0.55)
    .setDepth(VFX_DEPTH - 1)
    .setScrollFactor(1);

  scene.tweens.add({
    targets: ring,
    scale: 2.4,
    alpha: 0,
    duration: 260,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy()
  });
}

/**
 * Spawns a special-move charge burst around a fighter: concentric rings that
 * expand outward and fade, telegraphing the wind-up before the move executes.
 * @param scene - The owning scene.
 * @param x - World x of the fighter's centre.
 * @param y - World y of the fighter's centre (roughly mid-body).
 * @param color - Aura colour.
 */
export function spawnChargeAura(scene: Phaser.Scene, x: number, y: number, color: VfxColor = 'gold'): void {
  for (let index = 0; index < 3; index += 1) {
    const ring = scene.add
      .circle(x, y, 18, FLASH_TINT[color], 0)
      .setStrokeStyle(4, FLASH_TINT[color], 0.9)
      .setDepth(VFX_DEPTH - 1)
      .setScrollFactor(1)
      .setScale(1.6);

    scene.tweens.add({
      targets: ring,
      scale: 0.2,
      alpha: 0,
      delay: index * 120,
      duration: 420,
      ease: 'Sine.In',
      onComplete: () => ring.destroy()
    });
  }
}

/** Adds the bright rising trail that follows the Shoryuken launch frames. */
export function spawnRisingEnergy(scene: Phaser.Scene, x: number, y: number, facing: 1 | -1, color = 0xffd24a): void {
  const streaks = scene.add.graphics().setDepth(VFX_DEPTH - 1).setScrollFactor(1);
  const originY = y - 12;
  const side = facing * 1;

  streaks.lineStyle(9, color, 0.95);
  streaks.beginPath();
  streaks.moveTo(x - 34 * side, originY + 72);
  streaks.lineTo(x - 8 * side, originY + 30);
  streaks.lineTo(x - 22 * side, originY - 10);
  streaks.lineTo(x + 4 * side, originY - 62);
  streaks.strokePath();

  streaks.lineStyle(4, 0xfff4c2, 0.95);
  streaks.beginPath();
  streaks.moveTo(x + 28 * side, originY + 56);
  streaks.lineTo(x + 10 * side, originY + 15);
  streaks.lineTo(x + 34 * side, originY - 28);
  streaks.strokePath();

  streaks.lineStyle(3, color, 0.9);
  streaks.beginPath();
  streaks.moveTo(x - 54 * side, originY + 26);
  streaks.lineTo(x - 38 * side, originY - 12);
  streaks.lineTo(x - 50 * side, originY - 48);
  streaks.strokePath();

  scene.tweens.add({
    targets: streaks,
    y: streaks.y - 100,
    alpha: 0,
    duration: 520,
    ease: 'Cubic.Out',
    onComplete: () => streaks.destroy()
  });
}
