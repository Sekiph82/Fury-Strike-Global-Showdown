import { FIGHTER_CHARACTER_DEFINITIONS } from './hero';

export interface FighterOrigin {
  country: string;
  code: string;
  flag: 'us' | 'gh' | 'br' | 'fr' | 'in' | 'jp' | 'id' | 'eg' | 'gb' | 'es' | 'ng' | 'au' | 'rs' | 'th' | 'ca';
  slogan: string;
  map: { x: number; y: number };
}

/** Fictional roster origins used by the world tour selection presentation. */
export const FIGHTER_ORIGINS: Record<string, FighterOrigin> = {
  'red-brawler': { country: 'UNITED STATES', code: 'USA', flag: 'us', slogan: 'THE NEXT FIGHT IS ALWAYS MINE.', map: { x: 0.22, y: 0.36 } },
  'green-boxer': { country: 'GHANA', code: 'GHA', flag: 'gh', slogan: 'STAND TALL. HIT HARD.', map: { x: 0.52, y: 0.61 } },
  'jiujitsu-fighter': { country: 'BRAZIL', code: 'BRA', flag: 'br', slogan: 'THE GROUND IS MY TERRITORY.', map: { x: 0.34, y: 0.65 } },
  'mira-kestrel': { country: 'FRANCE', code: 'FRA', flag: 'fr', slogan: 'PRECISION MAKES THE DIFFERENCE.', map: { x: 0.49, y: 0.39 } },
  'tala-ember': { country: 'INDIA', code: 'IND', flag: 'in', slogan: 'LET YOUR SPIRIT BURN BRIGHT.', map: { x: 0.64, y: 0.52 } },
  'nera-volt': { country: 'JAPAN', code: 'JPN', flag: 'jp', slogan: 'ONE STRIKE. NO HESITATION.', map: { x: 0.76, y: 0.39 } },
  'kavi-damar': { country: 'INDONESIA', code: 'IDN', flag: 'id', slogan: 'MOVE WITH THE STORM.', map: { x: 0.77, y: 0.62 } },
  'zola-nyx': { country: 'EGYPT', code: 'EGY', flag: 'eg', slogan: 'THE NIGHT ALWAYS ANSWERS.', map: { x: 0.55, y: 0.47 } },
  'rook-calder': { country: 'SCOTLAND', code: 'SCO', flag: 'gb', slogan: 'IRON WILL. STEADY HANDS.', map: { x: 0.48, y: 0.32 } },
  'tomas-rill': { country: 'SPAIN', code: 'ESP', flag: 'es', slogan: 'EVERY STEP SETS THE RHYTHM.', map: { x: 0.46, y: 0.43 } },
  'sora-keene': { country: 'JAPAN', code: 'JPN', flag: 'jp', slogan: 'RISE HIGHER WITH EVERY ROUND.', map: { x: 0.79, y: 0.36 } },
  'imani-rusk': { country: 'NIGERIA', code: 'NGA', flag: 'ng', slogan: 'COURAGE CARRIES EVERY BLOW.', map: { x: 0.53, y: 0.56 } },
  'milo-vance': { country: 'AUSTRALIA', code: 'AUS', flag: 'au', slogan: 'I CAME TO MAKE SOME NOISE.', map: { x: 0.82, y: 0.76 } },
  'anika-vale': { country: 'SERBIA', code: 'SRB', flag: 'rs', slogan: 'STAY SHARP. NEVER BACK DOWN.', map: { x: 0.54, y: 0.38 } },
  'darius-quell': { country: 'THAILAND', code: 'THA', flag: 'th', slogan: 'POWER IS EARNED EVERY DAY.', map: { x: 0.73, y: 0.52 } }
};

export function getFighterOrigin(characterId: string): FighterOrigin {
  return FIGHTER_ORIGINS[characterId] ?? {
    country: 'WORLD CIRCUIT', code: 'WRL', flag: 'us', slogan: 'FIGHT WITH EVERYTHING YOU HAVE.', map: { x: 0.5, y: 0.5 }
  };
}

export function getPlayableRoster() {
  return FIGHTER_CHARACTER_DEFINITIONS.filter((character) => Boolean(FIGHTER_ORIGINS[character.id]));
}

