import type * as Phaser from 'phaser';

interface PortraitBounds { sourceWidth: number; sourceHeight: number; x: number; y: number; width: number; height: number }

// Alpha-content rectangles measured from the supplied portrait PNGs. Matching
// the visible figure height avoids transparent padding making fighters look
// different sizes in VS and result screens.
const PORTRAIT_BOUNDS: Record<string, PortraitBounds> = {
  'anika-vale': { sourceWidth: 850, sourceHeight: 850, x: 224, y: 40, width: 506, height: 771 },
  'darius-quell': { sourceWidth: 850, sourceHeight: 850, x: 120, y: 114, width: 696, height: 625 },
  'green-boxer': { sourceWidth: 1254, sourceHeight: 1254, x: 0, y: 0, width: 1252, height: 1253 },
  'imani-rusk': { sourceWidth: 850, sourceHeight: 850, x: 192, y: 0, width: 552, height: 849 },
  'jiujitsu-fighter': { sourceWidth: 1254, sourceHeight: 1254, x: 0, y: 0, width: 1252, height: 1253 },
  'kavi-damar': { sourceWidth: 850, sourceHeight: 850, x: 0, y: 2, width: 848, height: 847 },
  'milo-vance': { sourceWidth: 850, sourceHeight: 850, x: 152, y: 190, width: 652, height: 473 },
  'mira-kestrel': { sourceWidth: 1254, sourceHeight: 1254, x: 284, y: 16, width: 752, height: 1187 },
  'nera-volt': { sourceWidth: 850, sourceHeight: 850, x: 132, y: 8, width: 610, height: 841 },
  'red-brawler': { sourceWidth: 1254, sourceHeight: 1254, x: 0, y: 0, width: 1252, height: 1253 },
  'rook-calder': { sourceWidth: 850, sourceHeight: 850, x: 130, y: 36, width: 670, height: 813 },
  'sora-keene': { sourceWidth: 850, sourceHeight: 850, x: 94, y: 4, width: 718, height: 845 },
  'tala-ember': { sourceWidth: 850, sourceHeight: 820, x: 160, y: 12, width: 626, height: 807 },
  'tomas-rill': { sourceWidth: 850, sourceHeight: 850, x: 120, y: 26, width: 684, height: 823 },
  'zola-nyx': { sourceWidth: 850, sourceHeight: 850, x: 0, y: 8, width: 848, height: 841 }
};

/** Scales by non-transparent figure height and centers the visible artwork. */
export function placeNormalizedPortrait(image: Phaser.GameObjects.Image, characterId: string, centerX: number, centerY: number, figureHeight: number): void {
  const bounds = PORTRAIT_BOUNDS[characterId];
  if (!bounds) {
    image.setDisplaySize(figureHeight, figureHeight).setPosition(centerX, centerY);
    return;
  }
  const scale = figureHeight / bounds.height;
  const contentCenterX = bounds.x + bounds.width / 2;
  const contentCenterY = bounds.y + bounds.height / 2;
  image.setScale(scale).setPosition(
    centerX - (contentCenterX - bounds.sourceWidth / 2) * scale,
    centerY - (contentCenterY - bounds.sourceHeight / 2) * scale
  );
}
