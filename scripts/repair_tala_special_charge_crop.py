from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public' / 'assets' / 'tala-ember' / 'special-charge.png'
OUTPUT = ROOT / 'concepts' / 'crop-candidates-v2' / 'tala-ember' / 'special-charge-v1'
CELL_WIDTH = 328
CELL_HEIGHT = 300


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert('RGBA')
    # The original fire cast spills over the third cell and leaves a stray flame
    # fragment in the fourth. Keep the charge orb, then return to a clean stance.
    selected = [0, 1, 1, 0]
    frames = []
    for index in selected:
        cell = source.crop((index * CELL_WIDTH, 0, (index + 1) * CELL_WIDTH, CELL_HEIGHT))
        rgba = np.array(cell)
        labels, count = ndimage.label(rgba[:, :, 3] > 8)
        sizes = np.bincount(labels.ravel())
        keep = np.zeros_like(labels, dtype=bool)
        for component in range(1, count + 1):
            if sizes[component] >= 2500:
                keep |= labels == component
        rgba[~keep] = 0
        frames.append(Image.fromarray(rgba, 'RGBA'))
    strip = Image.new('RGBA', (CELL_WIDTH * len(frames), CELL_HEIGHT), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * CELL_WIDTH, 0))
    strip.save(OUTPUT / 'special-charge-candidate.png')

    qa = Image.new('RGB', (2 * 420, 2 * 390), (25, 30, 40))
    draw = ImageDraw.Draw(qa)
    for index, frame in enumerate(frames):
        col, row = index % 2, index // 2
        preview = frame.copy()
        preview.thumbnail((392, 342), Image.Resampling.LANCZOS)
        x = col * 420 + (420 - preview.width) // 2
        y = row * 390 + 30 + (342 - preview.height) // 2
        qa.paste(preview, (x, y), preview)
        draw.text((col * 420 + 12, row * 390 + 8), f'Tala charge frame {index + 1}', fill='white')
    qa.save(OUTPUT / 'qa.png')
    print(f'Wrote {OUTPUT / "special-charge-candidate.png"}')
    print(f'Wrote {OUTPUT / "qa.png"}')


if __name__ == '__main__':
    main()
