from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public' / 'assets' / 'kavi-damar' / 'special-charge.png'
OUTPUT = ROOT / 'concepts' / 'crop-candidates-v2' / 'kavi-damar' / 'special-charge-v2'
CELL = 313


def clean_frame(frame: Image.Image, minimum: int) -> Image.Image:
    rgba = np.array(frame.convert('RGBA'))
    labels, count = ndimage.label(rgba[:, :, 3] > 8)
    sizes = np.bincount(labels.ravel())
    keep = np.zeros_like(labels, dtype=bool)
    for component in range(1, count + 1):
        if sizes[component] >= minimum:
            keep |= labels == component
    rgba[~keep] = 0
    return Image.fromarray(rgba, 'RGBA')


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SOURCE).convert('RGBA')
    frames = [
        clean_frame(sheet.crop((0, 0, CELL, CELL)), 1000),
        clean_frame(sheet.crop((CELL, 0, CELL * 2, CELL)), 5000),
    ]
    strip = Image.new('RGBA', (CELL * len(frames), CELL), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * CELL, 0))
    strip.save(OUTPUT / 'special-charge-candidate.png')
    qa = Image.new('RGB', (CELL * 2, CELL), (26, 30, 41))
    draw = ImageDraw.Draw(qa)
    for index, frame in enumerate(frames):
        qa.paste(frame, (CELL * index, 0), frame)
        draw.text((CELL * index + 8, 8), f'frame {index + 1}', fill='white')
    qa.save(OUTPUT / 'qa.png')
    print(f'Wrote {OUTPUT / "special-charge-candidate.png"}')
    print(f'Wrote {OUTPUT / "qa.png"}')


if __name__ == '__main__':
    main()
