import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIGHTER_CHARACTER_DEFINITIONS, getCharacterAnimationByAction } from './hero';
import { resolveAnimationSourceFacing, shouldFlipForFacing, transformFramePointAtPose, transformFramePointToWorld } from './spriteCoordinates';

describe('shouldFlipForFacing', () => {
  it('mirrors action art toward the opponent for either authored direction', () => {
    expect(shouldFlipForFacing('east', 1)).toBe(false);
    expect(shouldFlipForFacing('east', -1)).toBe(true);
    expect(shouldFlipForFacing('west', 1)).toBe(true);
    expect(shouldFlipForFacing('west', -1)).toBe(false);
  });
});

describe('resolveAnimationSourceFacing', () => {
  it('treats replacement move sheets as east-facing while preserving authored exceptions', () => {
    expect(resolveAnimationSourceFacing('anika-vale', 'light-punch')).toBe('east');
    expect(resolveAnimationSourceFacing('green-boxer', 'hadoken', 'west')).toBe('west');
    expect(resolveAnimationSourceFacing('jiujitsu-fighter', 'light-punch')).toBe('west');
    expect(resolveAnimationSourceFacing('red-brawler', 'shoryuken')).toBe('east');
    expect(resolveAnimationSourceFacing('anika-vale', 'idle')).toBe('west');
  });
});

describe('transformFramePointToWorld', () => {
  it('maps a frame-authored hand point around the display origin in both facing directions', () => {
    const translate = (x: number, y: number) => ({ x: x + 500, y: y + 700 });
    const handPoint = { x: 208, y: 104 };

    const facingRight = transformFramePointToWorld(handPoint, 256, 128, 243.2, false, { transformPoint: translate });
    const facingLeft = transformFramePointToWorld(handPoint, 256, 128, 243.2, true, { transformPoint: translate });

    expect(facingRight.x).toBe(580);
    expect(facingLeft.x).toBe(420);
    expect(facingRight.y).toBeCloseTo(facingLeft.y);
    expect((facingRight.x + facingLeft.x) / 2).toBe(500);
  });

  it('applies sprite scale and parent translation after accounting for the display origin', () => {
    const transformPoint = (x: number, y: number) => ({ x: x * 0.75 + 320, y: y * 0.75 + 640 });
    const point = transformFramePointToWorld({ x: 208, y: 104 }, 256, 128, 243.2, false, { transformPoint });

    expect(point.x).toBe(380);
    expect(point.y).toBeCloseTo(535.6);
  });
});

describe('transformFramePointAtPose', () => {
  it('keeps the hand height fixed and mirrors the origin-relative point for either facing', () => {
    const point = { x: 208, y: 104 };
    const root = { x: 500, y: 700 };
    const right = transformFramePointAtPose(point, 256, 256, 0.5, 0.95, false, root, 0.75, 0.75);
    const left = transformFramePointAtPose(point, 256, 256, 0.5, 0.95, true, root, 0.75, 0.75);

    expect(right.x).toBe(560);
    expect(left.x).toBe(440);
    expect(right.y).toBeCloseTo(595.6);
    expect(left.y).toBeCloseTo(right.y);
  });

  it('uses the authored sprite rotation around the root point', () => {
    const point = transformFramePointAtPose({ x: 128, y: 0 }, 256, 256, 0.5, 1, false, { x: 200, y: 300 }, 1, 1, Math.PI / 2);

    expect(point.x).toBeCloseTo(456);
    expect(point.y).toBeCloseTo(300);
  });
});

describe('HadoukenSpawnPoint authoring', () => {
  it('uses Red Brawler’s twelve-frame fire cast and releases from the hands-forward pose', () => {
    const hadouken = getCharacterAnimationByAction('red-brawler', 'hadoken');

    expect(hadouken.sheet.url).toContain('hadoken-cast-fire-12-grid.png');
    expect(hadouken.bounds).toHaveLength(12);
    expect(hadouken.sheet).toMatchObject({ frameWidth: 384, frameHeight: 341 });
    expect(hadouken.displayScale).toBe(0.75);
    expect(hadouken.hadoukenReleaseFrame).toBe(4);
    expect(hadouken.bounds[4].hadoukenSpawnPoint).toEqual({ x: 295, y: 157 });
  });

  it('has a valid frame-local hand point on every roster character', () => {
    for (const fighter of FIGHTER_CHARACTER_DEFINITIONS) {
      const hadouken = getCharacterAnimationByAction(fighter.id, 'hadoken');
      const triggerFrame = hadouken.hadoukenReleaseFrame ?? -1;
      expect(triggerFrame, `${fighter.id} is missing an authored release frame`).toBeGreaterThanOrEqual(0);
      expect(triggerFrame).toBeGreaterThanOrEqual(0);
      expect(triggerFrame).toBeLessThan(hadouken.bounds.length);
      const point = hadouken.bounds[triggerFrame]?.hadoukenSpawnPoint;

      expect(point, `${fighter.id} is missing a release-frame hand point`).toBeDefined();
      expect(point!.x).toBeGreaterThanOrEqual(0);
      expect(point!.x).toBeLessThanOrEqual(hadouken.sheet.frameWidth);
      expect(point!.y).toBeGreaterThanOrEqual(0);
      expect(point!.y).toBeLessThanOrEqual(hadouken.sheet.frameHeight);

      const sourceFacing = hadouken.sourceFacing ?? fighter.facing ?? 'west';
      const transformPoint = (x: number, y: number) => ({ x: x + 500, y: y + 700 });
      const facingRight = transformFramePointToWorld(
        point!,
        hadouken.sheet.frameWidth,
        hadouken.sheet.frameWidth / 2,
        hadouken.sheet.frameHeight,
        shouldFlipForFacing(sourceFacing, 1),
        { transformPoint }
      );
      const facingLeft = transformFramePointToWorld(
        point!,
        hadouken.sheet.frameWidth,
        hadouken.sheet.frameWidth / 2,
        hadouken.sheet.frameHeight,
        shouldFlipForFacing(sourceFacing, -1),
        { transformPoint }
      );

      expect(facingRight.y, `${fighter.id} changed Y when mirrored`).toBeCloseTo(facingLeft.y);
      expect(facingRight.x + facingLeft.x, `${fighter.id} did not mirror around the fighter root`).toBeCloseTo(1000);
    }
  });

  it('anchors projectiles to their authored release-frame hands', () => {
    const expected = [
      { id: 'red-brawler', frame: 4, point: { x: 295, y: 157 } },
      { id: 'green-boxer', frame: 6, point: { x: 112, y: 101 } },
      { id: 'jiujitsu-fighter', frame: 3, point: { x: 58, y: 100 } },
      { id: 'imani-rusk', frame: 2, point: { x: 286, y: 81 } }
    ];

    for (const entry of expected) {
      const hadouken = getCharacterAnimationByAction(entry.id, 'hadoken');
      expect(hadouken.hadoukenReleaseFrame, `${entry.id} release frame`).toBe(entry.frame);
      expect(hadouken.bounds[entry.frame]?.hadoukenSpawnPoint, `${entry.id} hand anchor`).toEqual(entry.point);
    }
  });
});

describe('Red Brawler blue Shoryuken frames', () => {
  it('uses a bounded transparent 4-by-3 source sheet with the four airborne hit frames', () => {
    const animation = getCharacterAnimationByAction('red-brawler', 'shoryuken');

    expect(animation.sheet.url).toContain('/red-brawler/moves/shoryuken-blue-12.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 362, frameHeight: 362, frames: 12 });
    expect(animation.displayScale).toBeCloseTo(256 / 362);
    expect(animation.sourceFacing).toBe('east');
    expect(animation.bounds.map((frame) => Boolean(frame.attack)))
      .toEqual([false, false, false, false, true, true, true, true, false, false, false, false]);
  });
});

describe('Imani Rusk radiant Shoryuken frames', () => {
  it('uses the separately padded four-pose rising elbow sheet with a shared grounded foot anchor', () => {
    const animation = getCharacterAnimationByAction('imani-rusk', 'shoryuken');

    expect(animation.sheet.url).toContain('/imani-rusk/shoryuken-radiant-4.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 627, frameHeight: 627, frames: 4 });
    expect(animation.displayScale).toBe(0.5);
    expect(animation.anchorY).toBeCloseTo(571 / 627);
    expect(animation.sourceFacing).toBe('east');
    expect(animation.label).toBe('Dash Upper');
    expect(animation.bounds.map((frame) => Boolean(frame.attack))).toEqual([false, false, true, false]);
  });
});

describe('Tomas Rill low sweep', () => {
  it('uses a dedicated four-frame sheet with a hitbox only on the extended sweep frame', () => {
    const animation = getCharacterAnimationByAction('tomas-rill', 'low-sweep');

    expect(animation.sheet.url).toContain('/tomas-rill/low-sweep.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.displayScale).toBe(0.6);
    expect(animation.bounds.map((frame) => Boolean(frame.attack))).toEqual([false, false, true, false]);
  });
});

describe('Tomas Rill twelve-frame Shoryuken', () => {
  it('uses his own green wind uppercut sheet with airborne active frames', () => {
    const animation = getCharacterAnimationByAction('tomas-rill', 'shoryuken');

    expect(animation.sheet.url).toContain('/tomas-rill/rising-uppercut-12.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 362, frameHeight: 362, frames: 12 });
    expect(animation.displayScale).toBeCloseTo(313 / 362);
    expect(animation.sourceFacing).toBe('east');
    expect(animation.bounds.map((frame) => Boolean(frame.attack)))
      .toEqual([false, false, false, false, true, true, true, true, false, false, false, false]);
  });
});

describe('Milo Vance twelve-frame Shoryuken', () => {
  it('uses a clean, east-facing fire uppercut sheet with airborne active frames', () => {
    const animation = getCharacterAnimationByAction('milo-vance', 'shoryuken');

    expect(animation.sheet.url).toContain('/milo-vance/moves/shoryuken-fire-12-aligned.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 362, frameHeight: 362, frames: 12 });
    expect(animation.displayScale).toBe(1.15);
    expect(animation.sourceFacing).toBe('east');
    expect(animation.bounds.map((frame) => Boolean(frame.attack)))
      .toEqual([false, false, false, false, true, true, true, true, false, false, false, false]);
  });
});

describe('Green Boxer low sweep', () => {
  it('uses its own west-authored four-pose art with a single extended-leg hit frame', () => {
    const animation = getCharacterAnimationByAction('green-boxer', 'low-sweep');

    expect(animation.sheet.url).toContain('/green-boxer/moves/low-sweep.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('west');
    expect(animation.bounds.map((frame) => Boolean(frame.attack))).toEqual([false, false, true, false]);
  });
});

describe('Jiu-Jitsu Fighter low sweep', () => {
  it('uses a dedicated west-facing sweep strip and activates only on the extended kick', () => {
    const animation = getCharacterAnimationByAction('jiujitsu-fighter', 'low-sweep');

    expect(animation.sheet.url).toContain('/jiujitsu-fighter/moves/low-sweep.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('west');
    expect(animation.bounds.map((frame) => Boolean(frame.attack))).toEqual([false, false, true, false]);
  });
});

describe('Jiu-Jitsu Fighter throw reaction', () => {
  it('starts with a caught pose and advances through airborne and back-first landing frames', () => {
    const animation = getCharacterAnimationByAction('jiujitsu-fighter', 'thrown');

    expect(animation.sheet.url).toContain('/jiujitsu-fighter/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('west');
    expect(animation.frameRate).toBe(8);
  });
});

describe('Green Boxer throw reaction', () => {
  it('uses an authored four-frame launch and back-first landing sheet', () => {
    const animation = getCharacterAnimationByAction('green-boxer', 'thrown');

    expect(animation.sheet.url).toContain('/green-boxer/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('west');
    expect(animation.frameRate).toBe(8);
  });
});

describe('Red Brawler throw reaction', () => {
  it('plays its dedicated thrown sheet instead of the upright first knockdown pose', () => {
    const animation = getCharacterAnimationByAction('red-brawler', 'thrown');

    expect(animation.sheet.url).toContain('/red-brawler/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('west');
    expect(animation.frameRate).toBe(8);
  });
});

describe('Mira Kestrel throw reaction', () => {
  it('uses her dedicated catch, flight, tumble, and back-fall sprite strip', () => {
    const animation = getCharacterAnimationByAction('mira-kestrel', 'thrown');

    expect(animation.sheet.url).toContain('/mira-kestrel/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.frameRate).toBe(8);
  });
});

describe('Tala Ember throw reaction', () => {
  it('uses a four-pose catch, horizontal launch, tumble, and back-fall strip', () => {
    const animation = getCharacterAnimationByAction('tala-ember', 'thrown');

    expect(animation.sheet.url).toContain('/tala-ember/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(animation.frameRate).toBe(8);
  });
});

describe('Darius Quell throw reaction', () => {
  it('uses a four-pose launch, tumble, and back-fall sprite strip', () => {
    const animation = getCharacterAnimationByAction('darius-quell', 'thrown');

    expect(animation.sheet.url).toContain('/darius-quell/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(animation.frameRate).toBe(8);
  });
});

describe('Anika Vale throw reaction', () => {
  it('uses a four-pose catch, flight, tumble, and grounded reaction strip', () => {
    const animation = getCharacterAnimationByAction('anika-vale', 'thrown');

    expect(animation.sheet.url).toContain('/anika-vale/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(animation.frameRate).toBe(8);
  });
});

describe('Zola Nyx throw reaction', () => {
  it('uses a four-pose catch, flight, tumble, and grounded reaction strip', () => {
    const animation = getCharacterAnimationByAction('zola-nyx', 'thrown');

    expect(animation.sheet.url).toContain('/zola-nyx/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(animation.frameRate).toBe(8);
  });
});

describe('Rook Calder throw reaction', () => {
  it('uses a four-pose horizontal launch and grounded fall strip', () => {
    const animation = getCharacterAnimationByAction('rook-calder', 'thrown');

    expect(animation.sheet.url).toContain('/rook-calder/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(animation.frameRate).toBe(8);
  });
});

describe('Kavi Damar throw reaction', () => {
  it('uses a four-pose horizontal launch and grounded fall strip', () => {
    const animation = getCharacterAnimationByAction('kavi-damar', 'thrown');

    expect(animation.sheet.url).toContain('/kavi-damar/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(animation.frameRate).toBe(8);
  });
});

describe('Imani Rusk throw reaction', () => {
  it('uses a four-pose horizontal launch and coherent backward tumble strip', () => {
    const animation = getCharacterAnimationByAction('imani-rusk', 'thrown');

    expect(animation.sheet.url).toContain('/imani-rusk/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(animation.frameRate).toBe(8);
  });
});

describe('Nera Volt throw reaction', () => {
  it('uses a four-pose horizontal launch and grounded fall strip', () => {
    const animation = getCharacterAnimationByAction('nera-volt', 'thrown');

    expect(animation.sheet.url).toContain('/nera-volt/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(animation.frameRate).toBe(8);
  });
});

describe('Milo Vance throw reaction', () => {
  it('uses a four-pose horizontal launch and grounded fall strip', () => {
    const animation = getCharacterAnimationByAction('milo-vance', 'thrown');

    expect(animation.sheet.url).toContain('/milo-vance/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(animation.frameRate).toBe(8);
  });
});

describe('Sora Keene throw reaction', () => {
  it('uses a four-pose horizontal launch and grounded fall strip', () => {
    const animation = getCharacterAnimationByAction('sora-keene', 'thrown');

    expect(animation.sheet.url).toContain('/sora-keene/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(animation.frameRate).toBe(8);
  });
});

describe('Tomas Rill throw reaction', () => {
  it('uses a four-pose horizontal launch and grounded fall strip', () => {
    const animation = getCharacterAnimationByAction('tomas-rill', 'thrown');

    expect(animation.sheet.url).toContain('/tomas-rill/moves/thrown.png');
    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(animation.frameRate).toBe(8);
  });
});

describe('character roster throw reactions', () => {
  it('provides a dedicated four-frame thrown animation for every playable fighter', () => {
    for (const character of FIGHTER_CHARACTER_DEFINITIONS) {
      const animation = getCharacterAnimationByAction(character.id, 'thrown');

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 4 });
      expect(animation.sheet.url).toContain(`/assets/${character.id}/moves/thrown.png`);
    }
  });
});

describe('character roster elemental reactions', () => {
  it('resolves a character-specific action and sprite sheet for every element on every fighter', () => {
    for (const character of FIGHTER_CHARACTER_DEFINITIONS) {
      for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
        const animation = getCharacterAnimationByAction(character.id, `hit-${element}`);

        expect(animation.action, `${character.id} ${element} reaction`).toBe(`hit-${element}`);
        expect(animation.characterId).toBe(character.id);
        expect(animation.sheet.url).toContain(`/assets/${character.id}/`);
        expect(animation.displayScale).toBe(0.5);
      }
    }
  });
});

describe('Red Brawler hit reaction sheet', () => {
  it('uses six east-authored 512px frames while preserving the existing world hitbox size', () => {
    const animation = getCharacterAnimationByAction('red-brawler', 'hit-high');
    const firstFrame = animation.bounds[0];

    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 6 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(firstFrame.collision).toEqual({ x: 204, y: 126, width: 104, height: 334 });
    expect(firstFrame.hit).toEqual({ x: 136, y: 60, width: 240, height: 408 });
    expect(firstFrame.collision!.width * animation.displayScale!).toBe(52);
    expect(firstFrame.collision!.height * animation.displayScale!).toBe(167);
  });
});

describe('Red Brawler elemental reaction poses', () => {
  it('provides a distinct authored reaction pose for each supported element', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('red-brawler', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.displayScale).toBe(0.5);
      expect(animation.sourceFacing).toBe('east');
    }
  });
});

describe('Green Boxer electric reaction sheet', () => {
  it('uses six east-authored electric poses and keeps the existing world hitbox dimensions', () => {
    const animation = getCharacterAnimationByAction('green-boxer', 'hit-electric');
    const firstFrame = animation.bounds[0];

    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 6 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.5);
    expect(firstFrame.collision).toEqual({ x: 204, y: 126, width: 104, height: 334 });
    expect(firstFrame.hit).toEqual({ x: 136, y: 60, width: 240, height: 408 });
    expect(firstFrame.collision!.width * animation.displayScale!).toBe(52);
    expect(firstFrame.collision!.height * animation.displayScale!).toBe(167);
  });
});

describe('Green Boxer elemental reaction poses', () => {
  it('uses separate west-facing, transparent-ready poses for fire, ice, wind, and water', () => {
    for (const element of ['fire', 'ice', 'wind', 'water']) {
      const animation = getCharacterAnimationByAction('green-boxer', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('west');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Jiujitsu Fighter water reaction sheet', () => {
  it('uses six west-authored 512px frames at half display scale', () => {
    const animation = getCharacterAnimationByAction('jiujitsu-fighter', 'hit-water');

    expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 6 });
    expect(animation.sourceFacing).toBe('west');
    expect(animation.displayScale).toBe(0.5);
    expect(animation.bounds[0].collision).toEqual({ x: 204, y: 126, width: 104, height: 334 });
    expect(animation.bounds[0].hit).toEqual({ x: 136, y: 60, width: 240, height: 408 });
  });
});

describe('Jiujitsu Fighter elemental reaction poses', () => {
  it('provides east/west-correct authored reaction poses for fire, ice, wind, and electricity', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric']) {
      const animation = getCharacterAnimationByAction('jiujitsu-fighter', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('west');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Darius Quell elemental reaction poses', () => {
  it('provides a distinct east-authored reaction for every supported element', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('darius-quell', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('east');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Darius Quell Champion Edition aerial moves', () => {
  it('uses separate crop-safe action sheets and active frames for Head Press and Skull Diver', () => {
    const headPress = getCharacterAnimationByAction('darius-quell', 'head-press');
    const skullDiver = getCharacterAnimationByAction('darius-quell', 'somersault-skull-diver');

    expect(headPress.sheet).toMatchObject({ frameWidth: 627, frameHeight: 627, frames: 4 });
    expect(headPress.sheet.url).toContain('moves/head-press-4frame.png');
    expect(headPress.bounds.map((frame) => Boolean(frame.attack))).toEqual([false, false, true, true]);
    expect(skullDiver.sheet).toMatchObject({ frameWidth: 627, frameHeight: 627, frames: 4 });
    expect(skullDiver.sheet.url).toContain('moves/skull-diver-4frame.png');
    expect(skullDiver.bounds.map((frame) => Boolean(frame.attack))).toEqual([false, true, true, false]);
  });
});

describe('Nera Volt Hyakuretsukyaku pose', () => {
  it('uses a complete four-frame sequence with a planted-foot anchor and forward kick hitbox', () => {
    const animation = getCharacterAnimationByAction('nera-volt', 'hyakuretsukyaku');

    expect(animation.sheet).toMatchObject({ frameWidth: 1254, frameHeight: 1254, frames: 6 });
    expect(animation.sheet.url).toContain('moves/hyakuretsukyaku-6frame.png');
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.25);
    expect(animation.anchorX).toBe(0.15);
    expect(animation.anchorY).toBe(0.98);
    expect(animation.frameRate).toBe(12);
    expect(animation.bounds.map((frame) => Boolean(frame.attack))).toEqual([false, true, false, false, true, false]);
    expect(animation.bounds[1].attack).toEqual({ x: 640, y: 400, width: 590, height: 280 });
    expect(animation.bounds[4].attack).toEqual({ x: 640, y: 400, width: 590, height: 280 });
  });
});

describe('Sora Keene Hyakuretsukyaku animation', () => {
  it('uses two complete transparent poses at the same cell size and activates the kick on both frames', () => {
    const animation = getCharacterAnimationByAction('sora-keene', 'hyakuretsukyaku');

    expect(animation.sheet).toMatchObject({ frameWidth: 1254, frameHeight: 1254, frames: 2 });
    expect(animation.sheet.url).toContain('moves/hyakuretsukyaku.png');
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.25);
    expect(animation.anchorX).toBe(0.15);
    expect(animation.anchorY).toBe(0.98);
    expect(animation.bounds.map((frame) => Boolean(frame.attack))).toEqual([true, true]);
  });
});

describe('Tala Ember Tiger Knee animation', () => {
  it('uses its own complete east-facing knee frame and active hitbox', () => {
    const animation = getCharacterAnimationByAction('tala-ember', 'tiger-knee');

    expect(animation.sheet).toMatchObject({ frameWidth: 1254, frameHeight: 1254, frames: 1 });
    expect(animation.sheet.url).toContain('moves/tiger-knee.png');
    expect(animation.sourceFacing).toBe('east');
    expect(animation.displayScale).toBe(0.25);
    expect(animation.bounds[0].attack).toEqual({ x: 620, y: 500, width: 470, height: 360 });
  });
});

describe('roster animation asset coverage', () => {
  it('has a real image file for every registered animation on every fighter', () => {
    for (const fighter of FIGHTER_CHARACTER_DEFINITIONS) {
      for (const animation of fighter.animations) {
        const localPath = resolve(process.cwd(), 'public', animation.sheet.url.replace(/^\//, ''));
        expect(existsSync(localPath), `${fighter.id}/${animation.action}: ${animation.sheet.url}`).toBe(true);
      }
    }
  });

  it('uses distinct character-specific art for every elemental hit reaction', () => {
    const elements = ['fire', 'ice', 'wind', 'electric', 'water'] as const;
    const reactionAssets = FIGHTER_CHARACTER_DEFINITIONS.flatMap((fighter) =>
      elements.map((element) => {
        const animation = getCharacterAnimationByAction(fighter.id, `hit-${element}`);
        const localPath = resolve(process.cwd(), 'public', animation.sheet.url.replace(/^\//, ''));
        expect(existsSync(localPath), `${fighter.id}/hit-${element}`).toBe(true);
        return {
          fighterId: fighter.id,
          element,
          hash: createHash('sha256').update(readFileSync(localPath)).digest('hex')
        };
      })
    );

    expect(reactionAssets).toHaveLength(FIGHTER_CHARACTER_DEFINITIONS.length * elements.length);
    expect(new Set(reactionAssets.map(({ hash }) => hash)).size).toBe(reactionAssets.length);
  });
});

describe('Nera Volt elemental reaction poses', () => {
  it('provides east-authored poses for all five supported elements', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('nera-volt', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('east');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Spinning Bird Kick character art', () => {
  it.each(['nera-volt', 'sora-keene'])('uses a four-frame dedicated rising kick for %s', (characterId) => {
    const animation = getCharacterAnimationByAction(characterId, 'spinning-bird-kick');

    expect(animation.sheet.url).toContain(`/assets/${characterId}/moves/spinning-bird-kick-4.png`);
    expect(animation.sheet).toMatchObject({ frameWidth: 313, frameHeight: 313, frames: 4 });
    expect(animation.sourceFacing).toBe('east');
    expect(animation.bounds.map((frame) => Boolean(frame.attack))).toEqual([false, true, true, false]);
    expect(existsSync(resolve(process.cwd(), `public${animation.sheet.url}`))).toBe(true);
  });
});

describe('Mira Kestrel elemental reaction poses', () => {
  it('provides east-authored poses for all five supported elements', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('mira-kestrel', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('east');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Tala Ember elemental reaction poses', () => {
  it('provides east-authored poses for all five supported elements', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('tala-ember', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('east');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Zola Nyx elemental reaction poses', () => {
  it('provides east-authored poses for all five supported elements', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('zola-nyx', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('east');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Rook Calder elemental reaction poses', () => {
  it('provides east-authored poses for all five supported elements', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('rook-calder', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('east');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Anika Vale elemental reaction poses', () => {
  it('provides east-authored poses for all five supported elements', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('anika-vale', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('east');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Imani Rusk elemental reaction poses', () => {
  it('provides east-authored poses for all five supported elements', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('imani-rusk', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('east');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Kavi Damar elemental reaction poses', () => {
  it('provides east-authored poses for all five supported elements', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('kavi-damar', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('east');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Milo Vance elemental reaction poses', () => {
  it('provides east-authored poses for all five supported elements', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('milo-vance', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('east');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Sora Keene elemental reaction poses', () => {
  it('provides east-authored poses for all five supported elements', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('sora-keene', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('east');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

describe('Tomas Rill elemental reaction poses', () => {
  it('provides east-authored poses for all five supported elements', () => {
    for (const element of ['fire', 'ice', 'wind', 'electric', 'water']) {
      const animation = getCharacterAnimationByAction('tomas-rill', `hit-${element}`);

      expect(animation.sheet).toMatchObject({ frameWidth: 512, frameHeight: 512, frames: 1 });
      expect(animation.sheet.url).toContain(`reactions/hit-${element}.png`);
      expect(animation.sourceFacing).toBe('east');
      expect(animation.displayScale).toBe(0.5);
    }
  });
});

