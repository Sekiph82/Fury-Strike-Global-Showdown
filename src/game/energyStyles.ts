export type FighterEnergyElement =
  | 'fire'
  | 'electric'
  | 'wind'
  | 'water'
  | 'ice';

export interface FighterEnergyStyle {
  element: FighterEnergyElement;
  primary: number;
  secondary: number;
  spin: number;
}

const ENERGY_STYLES: Record<string, FighterEnergyStyle> = {
  'red-brawler': { element: 'ice', primary: 0x8aeaff, secondary: 0xffffff, spin: 3.5 },
  'green-boxer': { element: 'electric', primary: 0x65f044, secondary: 0xe4ff72, spin: 2.8 },
  'jiujitsu-fighter': { element: 'water', primary: 0x16d9d2, secondary: 0xd9ffff, spin: 2.3 },
  'mira-kestrel': { element: 'wind', primary: 0x27d8ce, secondary: 0xff85c8, spin: 2.6 },
  'tala-ember': { element: 'fire', primary: 0xff541e, secondary: 0xffe66a, spin: 3.4 },
  'nera-volt': { element: 'electric', primary: 0xffd52e, secondary: 0x8afaff, spin: 4.8 },
  'kavi-damar': { element: 'wind', primary: 0xb9f56b, secondary: 0xffd75f, spin: 2.9 },
  'zola-nyx': { element: 'electric', primary: 0xd12aff, secondary: 0xff55b9, spin: 4.2 },
  'rook-calder': { element: 'electric', primary: 0x65f044, secondary: 0xe4ff72, spin: 2.5 },
  'tomas-rill': { element: 'wind', primary: 0x8bea69, secondary: 0xd9fff5, spin: 2.7 },
  'sora-keene': { element: 'ice', primary: 0x8aeaff, secondary: 0xffffff, spin: 3.2 },
  'imani-rusk': { element: 'fire', primary: 0xffbf35, secondary: 0xfff5bd, spin: 3.1 },
  'milo-vance': { element: 'fire', primary: 0xff8b30, secondary: 0xffe89a, spin: 3.6 },
  'anika-vale': { element: 'water', primary: 0xa74cff, secondary: 0xffa2f1, spin: 3.1 },
  'darius-quell': { element: 'electric', primary: 0xff3c7d, secondary: 0xffc247, spin: 5.2 }
};

export function getFighterEnergyStyle(characterId: string): FighterEnergyStyle {
  return ENERGY_STYLES[characterId] ?? { element: 'fire', primary: 0xffd34f, secondary: 0xffffff, spin: 3 };
}
