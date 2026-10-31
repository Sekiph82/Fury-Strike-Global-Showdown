from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public' / 'assets' / 'rook-calder' / 'throw.png'
OUTPUT = ROOT / 'concepts' / 'crop-candidates-v2' / 'rook-calder' / 'throw-v1'
CELL = 313


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert('RGBA')
    frames: list[Image.Image] = []

    for index in range(4):
        cell = source.crop((index * CELL, 0, (index + 1) * CELL, CELL))
        rgba = np.array(cell)
        labels, count = ndimage.label(rgba[:, :, 3] > 8)
        sizes = np.bincount(labels.ravel())
        largest = int(np.argmax(sizes[1:]) + 1) if count else 0
        keep = labels == largest
        rgba[~keep] = 0
        isolated = Image.fromarray(rgba, 'RGBA')
        bbox = isolated.getchannel('A').getbbox()
        frame = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
        if bbox:
            artwork = isolated.crop(bbox)
            artwork.thumbnail((CELL - 28, CELL - 28), Image.Resampling.LANCZOS)
            frame.alpha_composite(artwork, ((CELL - artwork.width) // 2, CELL - 12 - artwork.height))
        frames.append(frame)

    strip = Image.new('RGBA', (CELL * len(frames), CELL), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * CELL, 0))
    strip.save(OUTPUT / 'throw-candidate.png')

    qa = Image.new('RGB', (2 * 420, 2 * 440), (25, 30, 40))
    draw = ImageDraw.Draw(qa)
    for index, frame in enumerate(frames):
        col, row = index % 2, index // 2
        preview = frame.copy()
        preview.thumbnail((392, 392), Image.Resampling.LANCZOS)
        x = col * 420 + (420 - preview.width) // 2
        y = row * 440 + 34 + (392 - preview.height) // 2
        qa.paste(preview, (x, y), preview)
        draw.text((col * 420 + 12, row * 440 + 10), f'Rook throw frame {index + 1}', fill='white')
    qa.save(OUTPUT / 'qa.png')
    print(f'Wrote {OUTPUT / "throw-candidate.png"}')
    print(f'Wrote {OUTPUT / "qa.png"}')


if __name__ == '__main__':
    main()
