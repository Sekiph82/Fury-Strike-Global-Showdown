from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
GEN = Path(r"C:\Users\sekip\.codex\generated_images\01a18314-b09a-7b91-ad56-374223fb4a20")
OUTPUT = ROOT / "public" / "assets" / "red-brawler" / "moves"
CONCEPT = ROOT / "concepts" / "characters" / "red-brawler"
CELL = 362
FRAME = 256

ATLASES = {
    "hadoken-cast": "exec-3766baa7-84a9-4706-8dec-b2463592f7da.png",
    "shoryuken": "exec-c1380fb7-dcbc-4fca-8b90-e84160925021.png",
    "tatsumaki": "exec-2960dd30-47b3-4851-9129-e4ed571eb4d2.png",
}


def clean_cell(cell: Image.Image) -> Image.Image:
    rgba = np.asarray(cell.convert("RGBA")).copy()
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
            touches_edge = xs.min() < 2 or xs.max() > CELL - 3 or ys.min() < 2 or ys.max() > CELL - 3
            if touches_edge and area < largest * 0.45:
                continue
            keep[label] = True
        rgba[~keep[labels]] = 0
    image = Image.fromarray(rgba, "RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        return Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    image = image.crop(bbox)
    image.thumbnail((236, 236), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    frame.alpha_composite(image, ((FRAME - image.width) // 2, FRAME - 6 - image.height))
    return frame


OUTPUT.mkdir(parents=True, exist_ok=True)
CONCEPT.mkdir(parents=True, exist_ok=True)
from PIL import ImageDraw
preview = Image.new("RGBA", (6 * 128, 3 * 148 * 3), (24, 30, 46, 255))
draw = ImageDraw.Draw(preview)
for move, filename in ATLASES.items():
    atlas = Image.open(GEN / filename).convert("RGBA")
    if atlas.size != (CELL * 4, CELL * 3):
        raise ValueError(f"Unexpected atlas dimensions for {move}: {atlas.size}")
    atlas.save(CONCEPT / f"{move}-12frame-atlas.png")
    strip = Image.new("RGBA", (FRAME * 12, FRAME), (0, 0, 0, 0))
    for row in range(3):
        for col in range(4):
            cell = atlas.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))
            strip.alpha_composite(clean_cell(cell), ((row * 4 + col) * FRAME, 0))
    output_name = f"{move}-12.png"
    strip.save(OUTPUT / output_name)
    row_top = list(ATLASES).index(move) * 148 * 3
    draw.text((6, row_top + 2), output_name, fill=(255, 255, 255, 255))
    for index in range(12):
        frame = strip.crop((index * FRAME, 0, (index + 1) * FRAME, FRAME))
        frame.thumbnail((112, 112), Image.Resampling.LANCZOS)
        preview.alpha_composite(frame, ((index % 6) * 128 + 6, row_top + 24 + (index // 6) * 118))
    print(f"{output_name}: {strip.size}; {strip.getchannel('A').getbbox()}")
preview.save(CONCEPT / "12frame-preview.png")
