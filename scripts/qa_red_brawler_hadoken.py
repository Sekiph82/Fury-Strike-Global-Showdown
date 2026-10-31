from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public' / 'assets' / 'red-brawler' / 'moves' / 'hadoken-cast.png'
OUTPUT = ROOT / 'concepts' / 'crop-candidates-v2' / 'red-brawler' / 'hadoken-vqa.png'
CELL = 256
SCALE = 2
LABEL = 28
COLS = 4


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SOURCE).convert('RGBA')
    frames = [sheet.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(sheet.width // CELL)]
    tile = CELL * SCALE
    rows = (len(frames) + COLS - 1) // COLS
    qa = Image.new('RGBA', (COLS * tile, rows * (tile + LABEL)), (23, 27, 37, 255))
    draw = ImageDraw.Draw(qa)
    for index, frame in enumerate(frames):
        x, y = (index % COLS) * tile, (index // COLS) * (tile + LABEL)
        checker = Image.new('RGBA', (CELL, CELL), (36, 40, 48, 255))
        grid = ImageDraw.Draw(checker)
        for gy in range(0, CELL, 32):
            for gx in range(0, CELL, 32):
                if (gx // 32 + gy // 32) % 2:
                    grid.rectangle((gx, gy, gx + 31, gy + 31), fill=(52, 57, 68, 255))
        checker.alpha_composite(frame)
        checker = checker.resize((tile, tile), Image.Resampling.NEAREST)
        qa.alpha_composite(checker, (x, y + LABEL))
        draw.text((x + 8, y + 6), f'Hadoken frame {index + 1:02}', fill='white')
        draw.rectangle((x, y + LABEL, x + tile - 1, y + LABEL + tile - 1), outline=(255, 80, 80, 255), width=2)
    qa.save(OUTPUT)
    print(f'Wrote {OUTPUT} ({len(frames)} frames, {sheet.size})')


if __name__ == '__main__':
    main()
