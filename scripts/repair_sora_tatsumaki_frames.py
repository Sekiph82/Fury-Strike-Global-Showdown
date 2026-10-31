from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public' / 'assets' / 'sora-keene' / 'special.png'
OUTPUT = ROOT / 'concepts' / 'crop-candidates-v2' / 'sora-keene' / 'tatsumaki-v2'
CELL = 313


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert('RGBA')
    frames = [source.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(4)]
    # The original Tatsumaki strip's third frame is a cluster of miniature
    # duplicates. Use Sora's clean, matching four-pose kick strip instead.
    strip = Image.new('RGBA', (CELL * 4, CELL), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * CELL, 0))
    strip.save(OUTPUT / 'tatsumaki-candidate.png')
    qa = Image.new('RGB', (CELL * 4, CELL), (26, 30, 41))
    draw = ImageDraw.Draw(qa)
    for index, frame in enumerate(frames):
        qa.paste(frame, (index * CELL, 0), frame)
        draw.text((index * CELL + 8, 8), f'frame {index + 1}', fill='white')
    qa.save(OUTPUT / 'qa.png')
    print(f'Wrote {OUTPUT / "tatsumaki-candidate.png"}')
    print(f'Wrote {OUTPUT / "qa.png"}')


if __name__ == '__main__':
    main()
