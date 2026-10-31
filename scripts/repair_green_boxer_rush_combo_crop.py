from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public' / 'assets' / 'green-boxer' / 'rush-combo.png'
OUTPUT = ROOT / 'concepts' / 'crop-candidates-v2' / 'green-boxer' / 'rush-combo-v1'
CELL = 256
FRAMES = 12


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert('RGBA')
    frames: list[Image.Image] = []

    for index in range(FRAMES):
        cell = source.crop((index * CELL, 0, (index + 1) * CELL, CELL))
        rgba = np.array(cell)
        labels, count = ndimage.label(rgba[:, :, 3] > 8)
        sizes = np.bincount(labels.ravel())
        # The fighter and substantial green swipe remain; small disconnected
        # skin/boot fragments at the cell edges belong to neighboring poses.
        keep = np.zeros_like(labels, dtype=bool)
        for component in range(1, count + 1):
            if sizes[component] >= 650:
                keep |= labels == component
        rgba[~keep] = 0
        frames.append(Image.fromarray(rgba, 'RGBA'))

    strip = Image.new('RGBA', (CELL * FRAMES, CELL), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * CELL, 0))
    strip.save(OUTPUT / 'rush-combo-candidate.png')

    qa_cell = 260
    qa = Image.new('RGBA', (4 * qa_cell, 3 * qa_cell), (25, 30, 40, 255))
    draw = ImageDraw.Draw(qa)
    for index, frame in enumerate(frames):
        col, row = index % 4, index // 4
        x, y = col * qa_cell, row * qa_cell
        draw.text((x + 6, y + 5), f'Frame {index + 1}', fill='white')
        qa.alpha_composite(frame, (x + 2, y + 3))
    qa.convert('RGB').save(OUTPUT / 'qa.png')
    print(f'Wrote {OUTPUT / "rush-combo-candidate.png"}')
    print(f'Wrote {OUTPUT / "qa.png"}')


if __name__ == '__main__':
    main()
