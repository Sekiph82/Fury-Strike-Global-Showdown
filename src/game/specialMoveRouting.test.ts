import { describe, expect, it } from 'vitest';
import { isRisingSpecialMove, resolveRisingAnimationAction } from './specialMoveRouting';

describe('special move animation routing', () => {
  it('routes named Dash Upper as a forward charge despite its shared internal shoryuken family', () => {
    expect(isRisingSpecialMove('shoryuken', 'Dash Upper')).toBe(false);
  });

  it('keeps the actual rising moves on the rising arc', () => {
    expect(isRisingSpecialMove('shoryuken', 'Shoryuken')).toBe(true);
    expect(isRisingSpecialMove('shoryuken', 'Flash Kick')).toBe(true);
    expect(isRisingSpecialMove('shoryuken', 'Tiger Uppercut')).toBe(true);
  });

  it('preserves the unnamed internal Shoryuken fallback', () => {
    expect(isRisingSpecialMove('shoryuken', null)).toBe(true);
  });

  it('uses each named rising technique’s authored signature animation', () => {
    expect(resolveRisingAnimationAction('mira-kestrel', 'Flash Kick')).toBe('special');
    expect(resolveRisingAnimationAction('nera-volt', 'Spinning Bird Kick')).toBe('spinning-bird-kick');
    expect(resolveRisingAnimationAction('sora-keene', 'Spinning Bird Kick')).toBe('spinning-bird-kick');
    expect(resolveRisingAnimationAction('darius-quell', 'Head Press')).toBe('head-press');
    expect(resolveRisingAnimationAction('red-brawler', 'Shoryuken')).toBe('shoryuken');
  });
});
