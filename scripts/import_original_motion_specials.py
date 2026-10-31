"""Import the 12-frame motion-special atlases for Green Boxer and Jiu-Jitsu Fighter."""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
GEN = Path(r"C:\Users\sekip\.codex\generated_images\01a18314-b09a-7b91-ad56-374223fb4a20")
CELL_ATLAS = 362
CELL_GAME = 256

ATLAS_FILES = {
    ("green-boxer", "hadoken"): "exec-1c3adab3-449f-4e37-a529-0b9d57b9187c.png",
    ("green-boxer", "shoryuken"): "exec-6de2cdfd-1b80-460f-95a5-51e8926d3064.png",
    ("green-boxer", "tatsumaki"): "exec-00955d08-90cd-4466-a08c-a9f1110ce608.png",
    ("jiujitsu-fighter", "hadoken"): "exec-6cb7552c-ec85-480f-b034-67e2349df18a.png",
    ("jiujitsu-fighter", "shoryuken"): "exec-e376f69d-0d9b-4939-ac59-010e684c928f.png",
    ("jiujitsu-fighter", "tatsumaki"): "exec-4dca6b23-0367-484d-9500-f2c39966b5f6.png",
}


def isolate_cell(source: Image.Image) -> Image.Image:
    rgba = np.asarray(source.convert("RGBA")).copy()
    labels, count = ndimage.label(rgba[:, :, 3] > 8)
    if count:
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        largest = int(sizes.max())
        keep = np.zeros(count + 1, dtype=bool)
        for label in range(1, count + 1):
            area = int(sizes[label])
            if area < max(80, largest * 0.015):
                continue
            ys, xs = np.where(labels == label)
            touches_edge = xs.min() < 2 or xs.max() > CELL_ATLAS - 3 or ys.min() < 2 or ys.max() > CELL_ATLAS - 3
            if touches_edge and area < largest * 0.45:
                continue
            keep[label] = True
        rgba[~keep[labels]] = 0
    image = Image.fromarray(rgba, "RGBA")
    bbox = image.getchannel("A").getbbox()
    result = Image.new("RGBA", (CELL_GAME, CELL_GAME), (0, 0, 0, 0))
    if bbox:
        image = image.crop(bbox)
        image.thumbnail((236, 236), Image.Resampling.LANCZOS)
        result.alpha_composite(image, ((CELL_GAME - image.width) // 2, CELL_GAME - 6 - image.height))
    return result


PREVIEW_ROW_HEIGHT = 260
preview = Image.new("RGBA", (6 * 128, 6 * PREVIEW_ROW_HEIGHT), (24, 30, 46, 255))
draw = ImageDraw.Draw(preview)
for order, ((fighter, action), filename) in enumerate(ATLAS_FILES.items()):
    atlas = Image.open(GEN / filename).convert("RGBA")
    if atlas.size != (CELL_ATLAS * 4, CELL_ATLAS * 3):
        raise ValueError(f"Unexpected dimensions for {fighter}/{action}: {atlas.size}")
    concept_dir = ROOT / "concepts" / "characters" / fighter
    asset_dir = ROOT / "public" / "assets" / fighter / "moves"
    concept_dir.mkdir(parents=True, exist_ok=True)
    asset_dir.mkdir(parents=True, exist_ok=True)
    atlas.save(concept_dir / f"{action}-12frame-atlas.png")
    strip = Image.new("RGBA", (12 * CELL_GAME, CELL_GAME), (0, 0, 0, 0))
    for row in range(3):
        for col in range(4):
            cell = atlas.crop((col * CELL_ATLAS, row * CELL_ATLAS, (col + 1) * CELL_ATLAS, (row + 1) * CELL_ATLAS))
            strip.alpha_composite(isolate_cell(cell), ((row * 4 + col) * CELL_GAME, 0))
    out = asset_dir / f"{action}-12.png"
    strip.save(out)

    roster_index = 0 if fighter == "green-boxer" else 1
    row_top = (roster_index * 3 + list(("hadoken", "shoryuken", "tatsumaki")).index(action)) * PREVIEW_ROW_HEIGHT
    draw.text((6, row_top + 2), f"{fighter} / {action}", fill=(255, 255, 255, 255))
    for index in range(12):
        frame = strip.crop((index * CELL_GAME, 0, (index + 1) * CELL_GAME, CELL_GAME))
        frame.thumbnail((112, 112), Image.Resampling.LANCZOS)
        x = (index % 6) * 128 + 6
        y = row_top + 24 + (index // 6) * 118
        preview.alpha_composite(frame, (x, y))
    print(f"{fighter}/{action}: {out} ({strip.size})")

preview.save(ROOT / "concepts/characters/original-specials-12frame-preview.png")
