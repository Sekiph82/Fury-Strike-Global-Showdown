import { describe, expect, it } from 'vitest';
import { hasAttackWindowAfterGap, resolveNormalAttackAction, shouldKnockdownFromSweep } from './attackAnimation';

describe('resolveNormalAttackAction', () => {
  it('keeps crouching light and medium kicks as normal attacks', () => {
    expect(resolveNormalAttackAction('light-kick', true, true)).toBe('light-kick');
    expect(resolveNormalAttackAction('medium-kick', true, true)).toBe('medium-kick');
  });

  it('uses the sweep only for a grounded crouching heavy kick', () => {
    expect(resolveNormalAttackAction('heavy-kick', true, true)).toBe('low-sweep');
    expect(resolveNormalAttackAction('heavy-kick', false, true)).toBe('heavy-kick');
  });

  it('preserves airborne kick selection regardless of crouch input', () => {
    expect(resolveNormalAttackAction('light-kick', true, false)).toBe('jump-kick');
    expect(resolveNormalAttackAction('heavy-kick', true, false)).toBe('jump-kick');
  });
});

describe('shouldKnockdownFromSweep', () => {
  it('knocks down only on the heavy sweep and never on light or medium kicks', () => {
    expect(shouldKnockdownFromSweep(true, 'heavy-kick')).toBe(true);
    expect(shouldKnockdownFromSweep(true, 'light-kick')).toBe(false);
    expect(shouldKnockdownFromSweep(true, 'medium-kick')).toBe(false);
    expect(shouldKnockdownFromSweep(false, 'heavy-kick')).toBe(false);
  });
});

describe('hasAttackWindowAfterGap', () => {
  it('keeps a special active through a recovery gap before its next strike', () => {
    expect(hasAttackWindowAfterGap([false, true, false, false, true, false], 1)).toBe(true);
  });

  it('does not split one continuous hit window into repeated hits', () => {
    expect(hasAttackWindowAfterGap([true, true, false], 0)).toBe(false);
  });

  it('does not retain the attack after the final active span', () => {
    expect(hasAttackWindowAfterGap([false, true, false], 1)).toBe(false);
  });
});
