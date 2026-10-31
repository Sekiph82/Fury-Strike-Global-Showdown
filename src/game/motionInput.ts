import type { FighterSpecialMove, NormalAttackId } from './types';

type MotionDirection = 'down' | 'downForward' | 'forward' | 'downBack' | 'back' | 'up' | 'upForward' | 'upBack';
type Archetype = 'shoto' | 'chun-li' | 'guile' | 'blanka' | 'honda' | 'dhalsim' | 'zangief' | 'balrog' | 'vega' | 'sagat' | 'bison';
const CHARGE_DURATION_MS = 2000;
export interface SpecialRule { label: string; pattern: string; button: 'punch' | 'kick' | 'any'; move: FighterSpecialMove }
type SpecialActivation = { move: FighterSpecialMove; attack: NormalAttackId; label: string };
interface MotionEntry { direction: MotionDirection; at: number }

/** Original-roster fighter -> Champion Edition input archetype. */
export const FIGHTER_SPECIAL_ARCHETYPES: Readonly<Record<string, Archetype>> = {
  'red-brawler': 'shoto', 'green-boxer': 'blanka', 'jiujitsu-fighter': 'zangief',
  'mira-kestrel': 'guile', 'tala-ember': 'sagat', 'nera-volt': 'chun-li',
  'kavi-damar': 'dhalsim', 'zola-nyx': 'vega', 'rook-calder': 'honda',
  'tomas-rill': 'shoto', 'sora-keene': 'chun-li', 'imani-rusk': 'balrog',
  'milo-vance': 'shoto', 'anika-vale': 'vega', 'darius-quell': 'bison'
};

const RULES: Record<Archetype, SpecialRule[]> = {
  shoto: [
    { label: 'Hadouken', pattern: 'qcf', button: 'punch', move: 'hadoken' },
    { label: 'Shoryuken', pattern: 'qcb', button: 'punch', move: 'shoryuken' },
    { label: 'Tatsumaki Senpukyaku', pattern: 'qcb', button: 'kick', move: 'tatsumaki' }
  ],
  'chun-li': [
    { label: 'Hyakuretsukyaku', pattern: 'rapid-kick', button: 'kick', move: 'tatsumaki' },
    { label: 'Spinning Bird Kick', pattern: 'charge-down-up', button: 'kick', move: 'shoryuken' }
  ],
  guile: [
    { label: 'Sonic Boom', pattern: 'charge-back-forward', button: 'punch', move: 'hadoken' },
    { label: 'Flash Kick', pattern: 'charge-down-up', button: 'kick', move: 'shoryuken' }
  ],
  blanka: [
    { label: 'Electric Thunder', pattern: 'rapid-punch', button: 'punch', move: 'hadoken' },
    { label: 'Rolling Attack', pattern: 'charge-back-forward', button: 'punch', move: 'tatsumaki' }
  ],
  honda: [
    { label: 'Hundred Hand Slap', pattern: 'rapid-punch', button: 'punch', move: 'hadoken' },
    { label: 'Sumo Headbutt', pattern: 'charge-back-forward', button: 'punch', move: 'tatsumaki' }
  ],
  dhalsim: [
    { label: 'Yoga Fire', pattern: 'qcf', button: 'punch', move: 'hadoken' },
    { label: 'Yoga Flame', pattern: 'qcb', button: 'punch', move: 'shoryuken' }
  ],
  zangief: [
    { label: 'Spinning Piledriver', pattern: 'rapid-punch', button: 'punch', move: 'shoryuken' },
    { label: 'Double Lariat', pattern: 'triple-punch', button: 'punch', move: 'tatsumaki' }
  ],
  balrog: [
    { label: 'Dash Straight', pattern: 'charge-back-forward', button: 'punch', move: 'tatsumaki' },
    { label: 'Dash Upper', pattern: 'charge-back-forward', button: 'kick', move: 'shoryuken' },
    { label: 'Turn Punch', pattern: 'hold-triple-release', button: 'any', move: 'shoryuken' }
  ],
  vega: [
    { label: 'Rolling Crystal Flash', pattern: 'charge-back-forward', button: 'punch', move: 'tatsumaki' },
    { label: 'Flying Barcelona Attack', pattern: 'charge-down-up', button: 'kick', move: 'shoryuken' },
    { label: 'Izuna Drop', pattern: 'air-directional-followup', button: 'punch', move: 'tatsumaki' },
    { label: 'Backflip', pattern: 'triple-punch', button: 'punch', move: 'shoryuken' }
  ],
  sagat: [
    { label: 'Tiger Shot', pattern: 'qcf', button: 'punch', move: 'hadoken' },
    { label: 'Ground Tiger Shot', pattern: 'qcf', button: 'kick', move: 'hadoken' },
    { label: 'Tiger Uppercut', pattern: 'dp', button: 'punch', move: 'shoryuken' },
    { label: 'Tiger Knee', pattern: 'tiger-knee', button: 'kick', move: 'tatsumaki' }
  ],
  bison: [
    { label: 'Psycho Crusher', pattern: 'charge-back-forward', button: 'punch', move: 'tatsumaki' },
    { label: 'Double Knee Press', pattern: 'charge-back-forward', button: 'kick', move: 'tatsumaki' },
    { label: 'Head Press', pattern: 'charge-down-up', button: 'kick', move: 'shoryuken' },
    { label: 'Somersault Skull Diver', pattern: 'air-followup', button: 'punch', move: 'tatsumaki' }
  ]
};

export function getFighterSpecialCommands(characterId: string): readonly SpecialRule[] {
  return RULES[FIGHTER_SPECIAL_ARCHETYPES[characterId] ?? 'shoto'];
}

const STYLE_LABELS: Record<Archetype, string> = {
  shoto: 'SHOTO', 'chun-li': 'CHUN-LI', guile: 'GUILE', blanka: 'BLANKA',
  honda: 'E. HONDA', dhalsim: 'DHALSIM', zangief: 'ZANGIEF', balrog: 'BALROG',
  vega: 'VEGA', sagat: 'SAGAT', bison: 'M. BISON'
};

/** Shared style label and command notation keep Training and match hints in sync. */
export function getFighterSpecialStyle(characterId: string): string {
  return STYLE_LABELS[FIGHTER_SPECIAL_ARCHETYPES[characterId] ?? 'shoto'];
}

export function formatSpecialCommand(rule: SpecialRule): string {
  const buttons = rule.button === 'punch' ? 'P (I/O/P)' : rule.button === 'kick' ? 'K (K/L/;)' : '3P or 3K';
  switch (rule.pattern) {
    case 'qcf': return `↓↘→ + ${buttons}`;
    case 'qcb': return `↓↙← + ${buttons}`;
    case 'dp': return `→ ↓ → + ${buttons}`;
    case 'charge-back-forward': return `← HOLD 2 SEC, THEN → + ${buttons}`;
    case 'charge-down-up': return `↓ HOLD 2 SEC, THEN ↑ + ${buttons}`;
    case 'rapid-punch': return 'P× — RAPID PUNCHES (I/O/P)';
    case 'rapid-kick': return 'K× — RAPID KICKS (K/L/;)';
    case 'triple-punch': return 'PRESS I + O + P TOGETHER';
    case 'hold-triple-release': return 'HOLD I+O+P OR K+L+; FOR 0.4 SEC, THEN RELEASE';
    case 'air-followup': return 'AFTER HEAD PRESS, PRESS P WHILE AIRBORNE NEAR THE OPPONENT';
    case 'air-directional-followup': return 'AFTER FLYING BARCELONA, NEAR OPPONENT IN AIR: ←/→ + P';
    case 'tiger-knee': return `↓ → ↑ + ${buttons}`;
    default: return buttons;
  }
}

/** Shared command parser: quarter-circle, charge, rapid, chord and air follow-up inputs. */
export class MotionInputBuffer {
  private entries: MotionEntry[] = [];
  private previousDirection: MotionDirection | null = null;
  private previousChord = false;
  private backSince: number | null = null;
  private downSince: number | null = null;
  private chargedBackUntil = 0;
  private chargedDownUntil = 0;
  private presses: Array<{ button: 'punch' | 'kick'; at: number }> = [];
  private followupUntil = 0;

  sample(left: boolean, right: boolean, down: boolean, facing: 1 | -1, now: number,
    up = false, heldAttacks: readonly NormalAttackId[] = []): void {
    const toward = facing === 1 ? right && !left : left && !right;
    const back = facing === 1 ? left && !right : right && !left;
    const vertical = up ? 'up' : down ? 'down' : null;
    const direction: MotionDirection | null = vertical
      ? vertical === 'up' ? (toward ? 'upForward' : back ? 'upBack' : 'up') : (toward ? 'downForward' : back ? 'downBack' : 'down')
      : toward ? 'forward' : back ? 'back' : null;

    if (direction && direction !== this.previousDirection) this.entries.push({ direction, at: now });
    this.previousDirection = direction;
    this.entries = this.entries.filter((entry) => now - entry.at <= 1200).slice(-10);
    this.backSince = back ? this.backSince ?? now : null;
    this.downSince = down ? this.downSince ?? now : null;
    // Keep a completed charge through the neutral frames between releasing the
    // held direction and pressing its follow-up direction.
    if (back && this.backSince !== null && now - this.backSince >= CHARGE_DURATION_MS) this.chargedBackUntil = now + 1500;
    if (down && this.downSince !== null && now - this.downSince >= CHARGE_DURATION_MS) this.chargedDownUntil = now + 1500;
    if (now > this.chargedBackUntil) this.chargedBackUntil = 0;
    if (now > this.chargedDownUntil) this.chargedDownUntil = 0;
    const triple = heldAttacks.filter((key) => key.endsWith('punch')).length >= 3 || heldAttacks.filter((key) => key.endsWith('kick')).length >= 3;
    if (triple && !this.previousChord) this.chordSince = now;
    if (!triple && this.previousChord) this.chordReleased = now;
    this.previousChord = triple;
  }

  /** Register one newly pressed attack edge; charge and chord release are read from sample state. */
  consume(attack: NormalAttackId | null, now: number, characterId = 'red-brawler', heldAttacks: readonly NormalAttackId[] = [], airborne = false, targetDistance = Number.POSITIVE_INFINITY): SpecialActivation | null {
    if (attack) this.presses.push({ button: attack.endsWith('punch') ? 'punch' : 'kick', at: now });
    this.presses = this.presses.filter((entry) => now - entry.at <= 650).slice(-12);
    const archetype = FIGHTER_SPECIAL_ARCHETYPES[characterId] ?? 'shoto';
    const rules = RULES[archetype];
    const hasButton = (kind: SpecialRule['button']): boolean => kind === 'any' ? Boolean(attack) : Boolean(attack && attack.endsWith(kind));
    const directions = this.entries.map(({ direction }) => direction);
    const matches = (...patterns: string[]): boolean => patterns.some((pattern) => {
      const steps = pattern.split(',');
      return steps.every((step, index) => directions[directions.length - steps.length + index] === step);
    });
    const rapidCount = (kind: 'punch' | 'kick'): number => this.presses.filter((entry) => entry.button === kind).length;
    const wasChordReleased = !this.previousChord && this.chordReleased !== null && now - this.chordReleased < 120;

    for (const rule of rules) {
      let triggered = false;
      if (rule.pattern === 'qcf' && hasButton(rule.button)) triggered = matches('down,downForward,forward');
      else if (rule.pattern === 'qcb' && hasButton(rule.button)) triggered = matches('down,downBack,back');
      else if (rule.pattern === 'dp' && hasButton(rule.button)) triggered = matches('forward,down,forward');
      else if (rule.pattern === 'charge-back-forward' && hasButton(rule.button)) triggered = now <= this.chargedBackUntil && directions.at(-1) === 'forward';
      else if (rule.pattern === 'charge-down-up' && hasButton(rule.button)) triggered = now <= this.chargedDownUntil && directions.at(-1) === 'up';
      else if (rule.pattern === 'rapid-punch' && attack?.endsWith('punch')) triggered = rapidCount('punch') >= 4;
      else if (rule.pattern === 'rapid-kick' && attack?.endsWith('kick')) triggered = rapidCount('kick') >= 4;
      else if (rule.pattern === 'triple-punch' && attack && heldAttacks.filter((key) => key.endsWith('punch')).length >= 3) triggered = true;
      else if (rule.pattern === 'hold-triple-release' && wasChordReleased && now - (this.chordSince ?? now) >= 400) triggered = true;
      else if (rule.pattern === 'air-followup' && attack?.endsWith('punch')) triggered = now <= this.followupUntil && airborne && targetDistance <= 148;
      else if (rule.pattern === 'air-directional-followup' && attack?.endsWith('punch')) {
        triggered = now <= this.followupUntil && airborne && targetDistance <= 148 &&
          (directions.at(-1) === 'forward' || directions.at(-1) === 'back');
      }
      else if (rule.pattern === 'tiger-knee' && hasButton(rule.button)) triggered = matches('down,forward,up');

      if (triggered && (attack || rule.pattern === 'hold-triple-release')) {
        if (rule.pattern === 'charge-down-up' && (archetype === 'vega' || archetype === 'bison')) this.followupUntil = now + 900;
        this.entries = [];
        this.presses = [];
        this.backSince = null;
        this.downSince = null;
        this.chargedBackUntil = 0;
        this.chargedDownUntil = 0;
        this.chordSince = null;
        this.chordReleased = null;
        return { move: rule.move, attack: attack ?? 'heavy-punch', label: rule.label };
      }
    }
    return null;
  }

  private chordSince: number | null = null;
  private chordReleased: number | null = null;
}
