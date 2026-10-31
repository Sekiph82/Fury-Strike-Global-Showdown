"""Extract Rook Calder's missing Breakwater Toss animation from its authored atlas."""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
ATLAS_PATH = ROOT / "concepts/characters/rook-calder/special-actions-atlas.png"
OUTPUT_PATH = ROOT / "public/assets/rook-calder/tatsumaki.png"
CELL = 313


def clean_frame(source: Image.Image) -> Image.Image:
    rgba = np.asarray(source.convert("RGBA")).copy()
    labels, count = ndimage.label(rgba[:, :, 3] > 8)
    if count:
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        largest = int(sizes.max())
        keep = np.zeros(count + 1, dtype=bool)
        for label in range(1, count + 1):
            area = int(sizes[label])
            if area < max(80, largest * 0.02):
                continue
            ys, xs = np.where(labels == label)
            touches_edge = xs.min() < 2 or xs.max() > source.width - 3 or ys.min() < 2 or ys.max() > source.height - 3
            if touches_edge and area < largest * 0.5:
                continue
            keep[label] = True
        rgba[~keep[labels]] = 0
    frame = Image.fromarray(rgba, "RGBA")
    bbox = frame.getchannel("A").getbbox()
    output = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    if bbox:
        frame = frame.crop(bbox)
        frame.thumbnail((CELL - 24, CELL - 24), Image.Resampling.LANCZOS)
        output.alpha_composite(frame, ((CELL - frame.width) // 2, CELL - 7 - frame.height))
    return output


atlas = Image.open(ATLAS_PATH).convert("RGBA")
if atlas.width < 4 * 300 or atlas.height < 4 * 280:
    raise ValueError(f"Unexpected Rook special atlas size: {atlas.size}")

strip = Image.new("RGBA", (4 * CELL, CELL), (0, 0, 0, 0))
for column in range(4):
    left = round(column * atlas.width / 4)
    right = round((column + 1) * atlas.width / 4)
    top = round(2 * atlas.height / 4)
    bottom = round(3 * atlas.height / 4)
    strip.alpha_composite(clean_frame(atlas.crop((left, top, right, bottom))), (column * CELL, 0))

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
strip.save(OUTPUT_PATH)
print(f"Wrote {OUTPUT_PATH}: {strip.size}")
