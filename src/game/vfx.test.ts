import { describe, expect, it } from 'vitest';
import { getFighterEnergyStyle } from './energyStyles';

describe('fighter elemental styles', () => {
  it('gives Green Boxer the electric impact and hit-reaction family for Electric Thunder', () => {
    expect(getFighterEnergyStyle('green-boxer')).toMatchObject({
      element: 'electric',
      primary: 0x65f044,
      secondary: 0xe4ff72
    });
  });
});
