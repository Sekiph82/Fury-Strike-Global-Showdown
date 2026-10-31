import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { getFighterOrigin, getPlayableRoster, type FighterOrigin } from '../game/fighterOrigins';
import { SCENE_KEYS, type MatchMode } from '../game/types';
import { BaseScene } from './BaseScene';
import { placeNormalizedPortrait } from './portraitLayout';

interface CharacterSelectData { mode: MatchMode; p1CharacterId?: string }
const ROSTER = getPlayableRoster();
const BLUE = 0x32c5ff;
const GOLD = 0xffd35b;

/** World tour character pick followed by an animated random CPU opponent draw. */
export class CharacterSelectScene extends BaseScene {
  private mode: MatchMode = '1vcpu';
  private selected = 0;
  private opponent = -1;
  private locked = false;
  private returningToModes = false;
  private flags: Phaser.GameObjects.Container[] = [];
  private cells: Phaser.GameObjects.Container[] = [];
  private p1Portrait?: Phaser.GameObjects.Image;
  private p2Portrait?: Phaser.GameObjects.Image;
  private p1Name?: Phaser.GameObjects.Text;
  private p1Country?: Phaser.GameObjects.Text;
  private p2Name?: Phaser.GameObjects.Text;
  private p2Country?: Phaser.GameObjects.Text;
  private hint?: Phaser.GameObjects.Text;
  private cursor?: Phaser.GameObjects.Rectangle;
  private opponentCursor?: Phaser.GameObjects.Rectangle;

  constructor() { super(SCENE_KEYS.CharacterSelect); }

  init(data: CharacterSelectData): void {
    this.mode = data?.mode ?? '1vcpu';
    const initial = data?.p1CharacterId ? ROSTER.findIndex((fighter) => fighter.id === data.p1CharacterId) : 0;
    this.selected = initial >= 0 ? initial : 0;
    this.opponent = -1;
    this.locked = false;
    this.returningToModes = false;

    // Phaser reuses Scene instances when they are started again. Clear every
    // reference to display objects from the previous run before create() builds
    // the roster; those objects were destroyed during the previous shutdown.
    this.flags = [];
    this.cells = [];
    this.p1Portrait = undefined;
    this.p2Portrait = undefined;
    this.p1Name = undefined;
    this.p2Name = undefined;
    this.p1Country = undefined;
    this.p2Country = undefined;
    this.hint = undefined;
    this.cursor = undefined;
    this.opponentCursor = undefined;
  }

  create(): void {
    this.markActiveScene(SCENE_KEYS.CharacterSelect);
    this.cameras.main.setBackgroundColor(0x020848);
    this.add.rectangle(1024, 640, 1980, 1200, 0x020848).setStrokeStyle(10, 0x1678d0).setDepth(-2);
    this.createHeading('WORLD TOUR  /  PLAYER SELECT', `${ROSTER.length} FIGHTERS • MOVE OVER A PORTRAIT TO SEE THEIR HOME COUNTRY`);
    this.drawWorldMap();
    this.buildFighterSlots();
    this.buildRosterGrid();
    this.refreshSelection();
    this.hint = this.add.text(1024, 1220, '← → / A D: SELECT FIGHTER     ENTER / SPACE: LOCK IN     ESC: BACK', {
      color: '#b7d6ff', fontFamily: 'monospace', fontSize: '17px', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
    this.input.keyboard?.on('keydown-A', () => this.move(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));
    this.input.keyboard?.on('keydown-D', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.lockPlayer());
    this.input.keyboard?.on('keydown-SPACE', () => this.lockPlayer());
    this.input.keyboard?.on('keydown-ESC', () => this.returnToModeSelect());
    this.input.keyboard?.on('keydown-BACKSPACE', () => this.returnToModeSelect());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
    });
  }

  /** Restart the mode screen cleanly after keyboard navigation back from the roster. */
  private returnToModeSelect(): void {
    if (this.returningToModes) return;
    this.returningToModes = true;
    this.input.keyboard?.removeAllListeners();
    // Defer the switch until the Escape key event finishes dispatching so the
    // destination scene cannot also consume that same keydown as its own Back.
    queueMicrotask(() => {
      if (!this.scene.isActive(SCENE_KEYS.CharacterSelect)) return;
      this.scene.stop(SCENE_KEYS.ModeSelect);
      this.scene.start(SCENE_KEYS.ModeSelect);
    });
  }

  /** PixelLab world map with the roster's country markers overlaid. */
  private drawWorldMap(): void {
    const graphics = this.add.graphics().setDepth(1);
    graphics.fillStyle(0x07134a, 0.96).fillRoundedRect(334, 150, 1380, 500, 32);
    graphics.lineStyle(3, 0x1d64b8, 1).strokeRoundedRect(334, 150, 1380, 500, 32);
    graphics.lineStyle(2, 0x124286, 0.7);
    for (let i = 1; i <= 5; i++) graphics.lineBetween(334 + i * 230, 160, 334 + i * 230, 640);
    for (let i = 1; i <= 3; i++) graphics.lineBetween(344, 150 + i * 120, 1704, 150 + i * 120);
    const mapX = 374; const mapY = 160; const mapW = 1300; const mapH = 488;
    this.add.image(1024, 404, 'world-map-pixel').setDisplaySize(mapW, mapH).setDepth(2);
    const unique = new Map<string, { x: number; y: number; flag: FighterOrigin['flag']; country: string }>();
    ROSTER.forEach((fighter) => { const origin = getFighterOrigin(fighter.id); unique.set(origin.code, { x: mapX + origin.map.x * mapW, y: mapY + origin.map.y * mapH, flag: origin.flag, country: origin.code }); });
    for (const [code, point] of unique) {
      const flag = createFlag(this, point.x, point.y, 56, 36, point.flag);
      flag.setDepth(6).setData('country-code', code);
      this.flags.push(flag);
    }
    this.add.text(1024, 628, 'FIGHTERS FROM AROUND THE WORLD', { color: '#fff1aa', fontFamily: 'monospace', fontSize: '17px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(7);
  }

  private buildFighterSlots(): void {
    const side = (x: number, isP1: boolean): void => {
      const panel = this.add.rectangle(x, 865, 320, 350, 0x071538, 0.96).setStrokeStyle(4, isP1 ? BLUE : 0x425276, 1);
      this.add.text(x, 704, isP1 ? '1P' : 'CPU RIVAL', { color: isP1 ? '#55ceff' : '#fb7185', fontFamily: 'monospace', fontSize: '28px', fontStyle: 'bold' }).setOrigin(0.5);
      const portrait = this.add.image(x, 850, ROSTER[0].portrait.key);
      placeNormalizedPortrait(portrait, ROSTER[0].id, x, 850, 285);
      const name = this.add.text(x, 1048, '', { color: '#fff3cc', fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5);
      const country = this.add.text(x, 1080, '', { color: '#91b8e8', fontFamily: 'monospace', fontSize: '15px', align: 'center' }).setOrigin(0.5);
      if (isP1) { this.p1Portrait = portrait; this.p1Name = name; this.p1Country = country; }
      else { this.p2Portrait = portrait; this.p2Name = name; this.p2Country = country; portrait.setVisible(false); }
      panel.setDepth(0);
    };
    side(192, true); side(1856, false);
  }

  private buildRosterGrid(): void {
    const cols = 5, cellW = 174, cellH = 130, gap = 9;
    const startX = 1024 - (cols * cellW + (cols - 1) * gap) / 2 + cellW / 2;
    ROSTER.forEach((fighter, index) => {
      const x = startX + (index % cols) * (cellW + gap);
      const y = 737 + Math.floor(index / cols) * (cellH + 10);
      const container = this.add.container(x, y).setDepth(10);
      const bg = this.add.rectangle(0, 0, cellW, cellH, 0x0b1740, 0.98).setStrokeStyle(2, 0x4e6590);
      const portrait = this.add.image(0, -16, fighter.portrait.key).setDisplaySize(102, 88);
      const label = this.add.text(0, 43, fighter.label.toUpperCase(), { color: '#d8e3f6', fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', align: 'center', wordWrap: { width: cellW - 12 } }).setOrigin(0.5);
      container.add([bg, portrait, label]);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => this.select(index));
      bg.on('pointerdown', () => { this.select(index); this.lockPlayer(); });
      this.cells.push(container);
      if (index === this.selected) this.cursor = this.add.rectangle(x, y, cellW + 6, cellH + 6, 0, 0).setStrokeStyle(5, BLUE).setDepth(11);
    });
  }

  private move(direction: number): void { if (!this.locked) this.select(Phaser.Math.Wrap(this.selected + direction, 0, ROSTER.length)); }

  private select(index: number): void {
    if (this.locked) return;
    this.selected = Phaser.Math.Wrap(index, 0, ROSTER.length);
    this.refreshSelection();
  }

  private refreshSelection(): void {
    const fighter = ROSTER[this.selected];
    const origin = getFighterOrigin(fighter.id);
    if (this.p1Portrait) {
      this.p1Portrait.setTexture(fighter.portrait.key).setVisible(true);
      placeNormalizedPortrait(this.p1Portrait, fighter.id, 192, 850, 285);
    }
    this.p1Name?.setText(fighter.label.toUpperCase());
    this.p1Country?.setText(`${origin.country}  •  ${origin.code}`);
    const selectedCell = this.cells[this.selected];
    if (selectedCell && this.cursor) this.cursor.setPosition(selectedCell.x, selectedCell.y);
    this.cells.forEach((cell, index) => {
      const bg = cell.list[0] as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(index === this.selected ? 0x163f72 : 0x0b1740, 1).setStrokeStyle(index === this.selected ? 3 : 2, index === this.selected ? BLUE : 0x4e6590);
    });
    const activeCode = origin.code;
    this.flags.forEach((flag) => {
      const isActive = flag.getData('country-code') === activeCode;
      flag.setScale(isActive ? 1.25 : 1).setAlpha(isActive ? 1 : 0.78);
      const border = flag.getAt(flag.length - 1) as Phaser.GameObjects.Rectangle;
      border.setStrokeStyle(isActive ? 4 : 2, isActive ? GOLD : 0xdbeafe, 1);
    });
  }

  private lockPlayer(): void {
    if (this.locked) return;
    this.locked = true;
    this.hint?.setText('CPU OPPONENT DRAW  •  SELECTING A RIVAL...').setColor('#ffd35b');
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
    const candidates = ROSTER.map((_, index) => index).filter((index) => index !== this.selected);
    this.opponent = Phaser.Math.RND.pick(candidates);
    let steps = 0;
    const total = 27 + Phaser.Math.Between(0, 10);
    const spin = (): void => {
      if (steps >= total) {
        this.showOpponent();
        this.time.delayedCall(950, () => this.scene.start(SCENE_KEYS.Versus, {
          mode: this.mode, p1CharacterId: ROSTER[this.selected].id, p2CharacterId: ROSTER[this.opponent].id
        }));
        return;
      }
      this.opponent = candidates[(steps * 3 + Phaser.Math.Between(0, 2)) % candidates.length];
      this.showOpponent();
      steps += 1;
      this.time.delayedCall(45 + Math.floor(steps * steps * 0.23), spin);
    };
    spin();
  }

  private showOpponent(): void {
    if (this.opponent < 0) return;
    const fighter = ROSTER[this.opponent];
    const origin = getFighterOrigin(fighter.id);
    if (this.p2Portrait) {
      this.p2Portrait.setTexture(fighter.portrait.key).setVisible(true);
      placeNormalizedPortrait(this.p2Portrait, fighter.id, 1856, 850, 285);
    }
    this.p2Name?.setText(fighter.label.toUpperCase());
    this.p2Country?.setText(`${origin.country}  •  ${origin.code}`);
    this.cells.forEach((cell, index) => {
      const bg = cell.list[0] as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(index === this.selected ? 0x163f72 : index === this.opponent ? 0x642642 : 0x0b1740, 1)
        .setStrokeStyle(index === this.selected || index === this.opponent ? 3 : 2, index === this.selected ? BLUE : index === this.opponent ? 0xfb7185 : 0x4e6590);
    });
    const selectedCell = this.cells[this.opponent];
    if (selectedCell) {
      if (!this.opponentCursor) this.opponentCursor = this.add.rectangle(selectedCell.x, selectedCell.y, 180, 136, 0, 0).setStrokeStyle(5, 0xfb7185).setDepth(12);
      else this.opponentCursor.setPosition(selectedCell.x, selectedCell.y).setVisible(true);
    }
  }
}

type FlagStyle = 'us' | 'gh' | 'br' | 'fr' | 'in' | 'jp' | 'id' | 'eg' | 'gb' | 'es' | 'ng' | 'au' | 'rs' | 'th' | 'ca';

function createFlag(scene: Phaser.Scene, x: number, y: number, width: number, height: number, style: FlagStyle): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const base = scene.add.rectangle(0, 0, width, height, 0xffffff).setStrokeStyle(2, 0xffffff);
  c.add(base);
  const stripe = (color: number, sx: number, sy: number, sw: number, sh: number): void => { c.add(scene.add.rectangle(sx, sy, sw, sh, color)); };
  if (style === 'fr' || style === 'ng' || style === 'ca') {
    const colors = style === 'fr' ? [0x173b8e, 0xffffff, 0xe43d47] : style === 'ng' ? [0x168b55, 0xffffff, 0x168b55] : [0xe43d47, 0xffffff, 0xe43d47];
    colors.forEach((color, i) => stripe(color, -width / 3 + i * width / 3, 0, width / 3, height - 4));
    if (style === 'ca') stripe(0xd92738, 0, 0, 8, 13);
  } else if (style === 'jp') c.add(scene.add.circle(0, 0, height * 0.28, 0xd82035));
  else if (style === 'id') { stripe(0xd82035, 0, -height / 4, width - 4, height / 2); }
  else if (style === 'in') { stripe(0xf18a35, 0, -height / 3, width - 4, height / 3); stripe(0x218b57, 0, height / 3, width - 4, height / 3); c.add(scene.add.circle(0, 0, height * 0.11, 0x244a9b)); }
  else if (style === 'gh') { stripe(0xd92738, 0, -height / 3, width - 4, height / 3); stripe(0xe8c534, 0, 0, width - 4, height / 3); stripe(0x168b55, 0, height / 3, width - 4, height / 3); c.add(scene.add.star(0, 0, 5, 4, 7, 0x101010)); }
  else if (style === 'br') { base.setFillStyle(0x168b55); c.add(scene.add.ellipse(0, 0, width * 0.6, height * 0.68, 0xe8cc38)); c.add(scene.add.circle(0, 0, height * 0.27, 0x2563a8)); }
  else if (style === 'es') { stripe(0xd92738, 0, -height * 0.3, width - 4, height * 0.4); stripe(0xf3ca37, 0, height * 0.14, width - 4, height * 0.44); }
  else if (style === 'rs') { stripe(0xd92738, 0, -height / 3, width - 4, height / 3); stripe(0x244a9b, 0, 0, width - 4, height / 3); stripe(0xffffff, 0, height / 3, width - 4, height / 3); }
  else if (style === 'th') { stripe(0xd92738, 0, -height * 0.36, width - 4, height * 0.28); stripe(0x244a9b, 0, 0, width - 4, height * 0.4); stripe(0xd92738, 0, height * 0.36, width - 4, height * 0.28); }
  else if (style === 'au' || style === 'gb') {
    base.setFillStyle(style === 'au' ? 0x12316b : 0x173b8e);
    stripe(0xffffff, 0, 0, width - 4, 4); stripe(0xd92738, 0, 0, width - 4, 2);
    stripe(0xffffff, 0, 0, 4, height - 4); stripe(0xd92738, 0, 0, 2, height - 4);
    if (style === 'au') c.add(scene.add.star(width * 0.23, height * 0.16, 5, 2, 4, 0xffffff));
  } else {
    base.setFillStyle(0xffffff);
    for (let i = 0; i < 7; i++) stripe(i % 2 ? 0xffffff : 0xd92738, 0, -height / 2 + (i + 0.5) * (height / 7), width - 4, height / 7);
    stripe(0x244a9b, -width * 0.3, -height * 0.2, width * 0.38, height * 0.55);
    if (style === 'us') stripe(0xffffff, -width * 0.3, -height * 0.2, width * 0.22, 2);
  }
  const border = scene.add.rectangle(0, 0, width, height, 0, 0).setStrokeStyle(2, 0xe2e8f0, 1);
  c.add(border);
  return c;
}
