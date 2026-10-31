from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public' / 'assets' / 'anika-vale'
OUTPUT = ROOT / 'concepts' / 'crop-candidates-v2' / 'anika-vale' / 'motion-repairs-v1'
CELL = 313


def cells(path: Path) -> list[Image.Image]:
    image = Image.open(path).convert('RGBA')
    return [image.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(image.width // CELL)]


def save_strip(name: str, frames: list[Image.Image]) -> None:
    strip = Image.new('RGBA', (CELL * len(frames), CELL), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * CELL, 0))
    strip.save(OUTPUT / f'{name}-candidate.png')


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    idle = cells(ASSETS / 'idle.png')[0]

    hadoken = cells(ASSETS / 'hadoken.png')
    hadoken[2] = hadoken[1].copy()  # remove the two miniature duplicate poses
    save_strip('hadoken', hadoken[:4])

    shoryuken = cells(ASSETS / 'shoryuken.png')
    shoryuken = [shoryuken[0], shoryuken[1], shoryuken[3], idle]
    save_strip('shoryuken', shoryuken)

    special = cells(ASSETS / 'special.png')
    special[3] = idle.copy()  # the last tile contains two tiny duplicate poses
    save_strip('special', special[:4])

    tatsumaki = cells(ASSETS / 'tatsumaki.png')
    tatsumaki[3] = idle.copy()  # the final tile is an energy-only fragment
    save_strip('tatsumaki', tatsumaki[:4])

    names = ['hadoken', 'shoryuken', 'special', 'tatsumaki']
    qa = Image.new('RGB', (CELL * 4, 4 * 333), (26, 30, 41))
    draw = ImageDraw.Draw(qa)
    for row, name in enumerate(names):
        frames = cells(OUTPUT / f'{name}-candidate.png')
        draw.text((8, row * 333 + 4), name, fill='white')
        for col, frame in enumerate(frames):
            qa.paste(frame, (col * CELL, row * 333 + 20), frame)
    qa.save(OUTPUT / 'qa.png')
    print(f'Wrote {OUTPUT / "qa.png"}')


if __name__ == '__main__':
    main()
