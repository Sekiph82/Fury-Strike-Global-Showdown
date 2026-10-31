from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public' / 'assets' / 'red-brawler' / 'moves' / 'hadoken-cast-fire-12.png'
OUTPUT = ROOT / 'concepts' / 'crop-candidates-v2' / 'red-brawler' / 'hadoken-orientation-v1'
CELL = 256


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert('RGBA')
    # Later frames 6-11 in the source turn Red Brawler's back to the target.
    # Keep the right-facing charge/cast poses and make a matching recovery.
    frame_indices = [0, 1, 2, 3, 4, 4, 4, 4, 3, 2, 1, 0]
    frames = [source.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in frame_indices]
    strip = Image.new('RGBA', (CELL * len(frames), CELL), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * CELL, 0))
    strip.save(OUTPUT / 'hadoken-candidate.png')

    cols, scale, label = 4, 2, 28
    tile = CELL * scale
    rows = (len(frames) + cols - 1) // cols
    qa = Image.new('RGBA', (cols * tile, rows * (tile + label)), (23, 27, 37, 255))
    draw = ImageDraw.Draw(qa)
    for index, frame in enumerate(frames):
        x, y = (index % cols) * tile, (index // cols) * (tile + label)
        checker = Image.new('RGBA', (CELL, CELL), (36, 40, 48, 255))
        grid = ImageDraw.Draw(checker)
        for gy in range(0, CELL, 32):
            for gx in range(0, CELL, 32):
                if (gx // 32 + gy // 32) % 2:
                    grid.rectangle((gx, gy, gx + 31, gy + 31), fill=(52, 57, 68, 255))
        checker.alpha_composite(frame)
        qa.alpha_composite(checker.resize((tile, tile), Image.Resampling.NEAREST), (x, y + label))
        draw.text((x + 8, y + 6), f'Candidate frame {index + 1:02}', fill='white')
        draw.rectangle((x, y + label, x + tile - 1, y + label + tile - 1), outline=(255, 80, 80, 255), width=2)
    qa.save(OUTPUT / 'qa.png')
    print(f'Wrote {OUTPUT / "hadoken-candidate.png"}')
    print(f'Wrote {OUTPUT / "qa.png"}')


if __name__ == '__main__':
    main()
