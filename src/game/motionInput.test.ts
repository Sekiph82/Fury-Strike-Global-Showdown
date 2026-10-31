import { describe, expect, it } from 'vitest';
import { FIGHTER_SPECIAL_ARCHETYPES, getFighterSpecialCommands, MotionInputBuffer } from './motionInput';

describe('fighter special move roster mapping', () => {
  it('assigns the Champion Edition command families across all 15 original fighters', () => {
    expect(Object.keys(FIGHTER_SPECIAL_ARCHETYPES)).toHaveLength(15);
    expect(getFighterSpecialCommands('red-brawler').map(({ label }) => label)).toEqual([
      'Hadouken', 'Shoryuken', 'Tatsumaki Senpukyaku'
    ]);
    expect(getFighterSpecialCommands('green-boxer').map(({ label }) => label)).toEqual([
      'Electric Thunder', 'Rolling Attack'
    ]);
    expect(getFighterSpecialCommands('jiujitsu-fighter').map(({ label }) => label)).toEqual([
      'Spinning Piledriver', 'Double Lariat'
    ]);
    expect(getFighterSpecialCommands('mira-kestrel').map(({ label }) => label)).toEqual([
      'Sonic Boom', 'Flash Kick'
    ]);
    expect(getFighterSpecialCommands('tala-ember').map(({ label }) => label)).toEqual([
      'Tiger Shot', 'Ground Tiger Shot', 'Tiger Uppercut', 'Tiger Knee'
    ]);
    expect(getFighterSpecialCommands('nera-volt').map(({ label }) => label)).toEqual([
      'Hyakuretsukyaku', 'Spinning Bird Kick'
    ]);
    expect(getFighterSpecialCommands('kavi-damar').map(({ label }) => label)).toEqual([
      'Yoga Fire', 'Yoga Flame'
    ]);
    expect(getFighterSpecialCommands('zola-nyx').map(({ label }) => label)).toEqual([
      'Rolling Crystal Flash', 'Flying Barcelona Attack', 'Izuna Drop', 'Backflip'
    ]);
    expect(getFighterSpecialCommands('rook-calder').map(({ label }) => label)).toEqual([
      'Hundred Hand Slap', 'Sumo Headbutt'
    ]);
    expect(getFighterSpecialCommands('tomas-rill').map(({ label }) => label)).toEqual([
      'Hadouken', 'Shoryuken', 'Tatsumaki Senpukyaku'
    ]);
    expect(getFighterSpecialCommands('sora-keene').map(({ label }) => label)).toEqual([
      'Hyakuretsukyaku', 'Spinning Bird Kick'
    ]);
    expect(getFighterSpecialCommands('imani-rusk').map(({ label }) => label)).toEqual([
      'Dash Straight', 'Dash Upper', 'Turn Punch'
    ]);
    expect(getFighterSpecialCommands('milo-vance').map(({ label }) => label)).toEqual([
      'Hadouken', 'Shoryuken', 'Tatsumaki Senpukyaku'
    ]);
    expect(getFighterSpecialCommands('anika-vale').map(({ label }) => label)).toEqual([
      'Rolling Crystal Flash', 'Flying Barcelona Attack', 'Izuna Drop', 'Backflip'
    ]);
    expect(getFighterSpecialCommands('darius-quell').map(({ label }) => label)).toEqual([
      'Psycho Crusher', 'Double Knee Press', 'Head Press', 'Somersault Skull Diver'
    ]);
  });
});

describe('MotionInputBuffer directional commands', () => {
  function quarterCircle(buffer: MotionInputBuffer, facing: 1 | -1, forward: boolean, now = 0): number {
    buffer.sample(false, false, true, facing, now);
    buffer.sample(forward ? facing === -1 : facing === 1, forward ? facing === 1 : facing === -1, true, facing, now + 80);
    buffer.sample(forward ? facing === -1 : facing === 1, forward ? facing === 1 : facing === -1, false, facing, now + 150);
    return now + 180;
  }

  it('recognizes Hadouken quarter-circle-forward on both sides of the screen', () => {
    for (const facing of [1, -1] as const) {
      const buffer = new MotionInputBuffer();
      const now = quarterCircle(buffer, facing, true);
      expect(buffer.consume('light-punch', now, 'red-brawler')?.label).toBe('Hadouken');
    }
  });

  it('recognizes Yoga Flame quarter-circle-back with punch', () => {
    const buffer = new MotionInputBuffer();
    const now = quarterCircle(buffer, 1, false);
    expect(buffer.consume('light-punch', now, 'kavi-damar')?.label).toBe('Yoga Flame');
  });

  it('recognizes the simplified down-then-forward and down-then-back commands on either facing', () => {
    for (const facing of [1, -1] as const) {
      const forwardBuffer = new MotionInputBuffer();
      forwardBuffer.sample(false, false, true, facing, 0);
      forwardBuffer.sample(facing === -1, facing === 1, false, facing, 80);
      expect(forwardBuffer.consume('light-punch', 100, 'red-brawler')?.label).toBe('Hadouken');

      const backBuffer = new MotionInputBuffer();
      backBuffer.sample(false, false, true, facing, 0);
      backBuffer.sample(facing === 1, facing === -1, false, facing, 80);
      expect(backBuffer.consume('light-punch', 100, 'red-brawler')?.label).toBe('Shoryuken');
    }
  });

  it('keeps Shoryuken on down-back and does not trigger it from down-forward', () => {
    for (const facing of [1, -1] as const) {
      const downBack = new MotionInputBuffer();
      downBack.sample(false, false, true, facing, 0);
      downBack.sample(facing === 1, facing === -1, true, facing, 80);
      expect(downBack.consume('light-punch', 100, 'red-brawler')?.label).toBe('Shoryuken');

      const downForward = new MotionInputBuffer();
      downForward.sample(facing === -1, facing === 1, false, facing, 0);
      downForward.sample(false, false, true, facing, 80);
      downForward.sample(facing === -1, facing === 1, true, facing, 140);
      expect(downForward.consume('light-punch', 160, 'red-brawler')?.label).not.toBe('Shoryuken');
    }
  });

  it('recognizes down-then-back plus kick as Tatsumaki on either facing', () => {
    for (const facing of [1, -1] as const) {
      const buffer = new MotionInputBuffer();
      buffer.sample(false, false, true, facing, 0);
      buffer.sample(facing === 1, facing === -1, false, facing, 80);
      expect(buffer.consume('light-kick', 100, 'red-brawler')?.label).toBe('Tatsumaki Senpukyaku');
    }
  });

  it('requires the full two-second back charge before Sonic Boom', () => {
    const buffer = new MotionInputBuffer();
    buffer.sample(true, false, false, 1, 0);
    buffer.sample(true, false, false, 1, 1999);
    buffer.sample(false, true, false, 1, 2000);
    expect(buffer.consume('medium-punch', 2020, 'mira-kestrel')).toBeNull();

    buffer.sample(true, false, false, 1, 2100);
    buffer.sample(true, false, false, 1, 4100);
    buffer.sample(false, true, false, 1, 4150);
    expect(buffer.consume('medium-punch', 4170, 'mira-kestrel')?.label).toBe('Sonic Boom');
  });

  it('recognizes Chun-Li rapid kicks as Hyakuretsukyaku', () => {
    const buffer = new MotionInputBuffer();
    const activations = [0, 100, 200, 300].map((now) => buffer.consume('light-kick', now, 'nera-volt'));
    expect(activations.at(-1)?.label).toBe('Hyakuretsukyaku');
  });

  it('recognizes Jiu-Jitsu Fighter rapid punches as the Spinning Piledriver command grab', () => {
    const buffer = new MotionInputBuffer();
    const activations = [0, 100, 200, 300].map((now) => buffer.consume('light-punch', now, 'jiujitsu-fighter'));
    expect(activations.at(-1)?.label).toBe('Spinning Piledriver');
  });
});
