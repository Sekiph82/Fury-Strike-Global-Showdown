from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public' / 'assets' / 'mira-kestrel' / 'skybreaker.png'
OUTPUT = ROOT / 'concepts' / 'crop-candidates-v2' / 'mira-kestrel' / 'skybreaker-grid-v2'
RUNTIME = ROOT / 'public' / 'assets' / 'mira-kestrel' / 'skybreaker-cropped.png'
CELL = 313


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    atlas = Image.open(SOURCE).convert('RGBA')
    # The source packs 12 poses into three ~338px-high rows, with a blank tail.
    # Dividing its full height into thirds cuts across the poses.
    frames = []
    for row in range(3):
        for col in range(4):
            x0, x1 = round(col * atlas.width / 4), round((col + 1) * atlas.width / 4)
            y0, y1 = (0, 338, 674, 1008)[row], (0, 338, 674, 1008)[row + 1]
            cell = atlas.crop((x0, y0, x1, y1))
            rgba = np.array(cell)
            labels, count = ndimage.label(rgba[:, :, 3] > 8)
            sizes = np.bincount(labels.ravel())
            keep = np.zeros_like(labels, dtype=bool)
            for component in range(1, count + 1):
                if sizes[component] >= 1500:
                    keep |= labels == component
            rgba[~keep] = 0
            cell = Image.fromarray(rgba, 'RGBA')
            bbox = cell.getchannel('A').getbbox()
            frame = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
            if bbox:
                artwork = cell.crop(bbox)
                artwork.thumbnail((CELL - 16, CELL - 16), Image.Resampling.LANCZOS)
                frame.alpha_composite(artwork, ((CELL - artwork.width) // 2, (CELL - artwork.height) // 2))
            frames.append(frame)

    strip = Image.new('RGBA', (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        strip.alpha_composite(frame, (i * CELL, 0))
    strip.save(OUTPUT / 'skybreaker-candidate.png')
    qa = Image.new('RGB', (4 * 220, 3 * 246), (25, 30, 40))
    draw = ImageDraw.Draw(qa)
    for i, frame in enumerate(frames):
        col, row = i % 4, i // 4
        thumb = frame.copy()
        thumb.thumbnail((204, 216), Image.Resampling.LANCZOS)
        x, y = col * 220 + (220 - thumb.width) // 2, row * 246 + 24 + (216 - thumb.height) // 2
        qa.paste(thumb, (x, y), thumb)
        draw.text((col * 220 + 8, row * 246 + 5), f'frame {i + 1:02}', fill='white')
    qa.save(OUTPUT / 'qa.png')
    print(f'Wrote {OUTPUT / "skybreaker-candidate.png"} ({strip.width}x{strip.height})')
    print(f'Wrote {OUTPUT / "qa.png"}')


if __name__ == '__main__':
    main()
