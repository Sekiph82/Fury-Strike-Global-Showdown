from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw
import math
import re

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public' / 'assets'
OUTPUT = ROOT / 'concepts' / 'crop-candidates-v2' / 'runtime-qa'
FIGHTERS = [
    'red-brawler', 'green-boxer', 'jiujitsu-fighter', 'mira-kestrel', 'tala-ember',
    'nera-volt', 'kavi-damar', 'zola-nyx', 'rook-calder', 'tomas-rill',
    'sora-keene', 'imani-rusk', 'milo-vance', 'anika-vale', 'darius-quell'
]
FIGHTER_MODULES = {
    'red-brawler': 'redBrawler', 'green-boxer': 'greenBoxer',
    'jiujitsu-fighter': 'jiujitsuFighter', 'mira-kestrel': 'miraKestrel',
    'tala-ember': 'talaEmber', 'nera-volt': 'neraVolt', 'kavi-damar': 'kaviDamar',
    'zola-nyx': 'zolaNyx', 'rook-calder': 'rookCalder', 'tomas-rill': 'tomasRill',
    'sora-keene': 'soraKeene', 'imani-rusk': 'imaniRusk', 'milo-vance': 'miloVance',
    'anika-vale': 'anikaVale', 'darius-quell': 'dariusQuell'
}
FRAME_SIZES = {name: (256, 256) for name in ('red-brawler', 'green-boxer', 'jiujitsu-fighter')}
FRAME_SIZES.update({'tala-ember': (328, 300)})
FRAME_SIZES.update({name: (313, 313) for name in FIGHTERS if name not in FRAME_SIZES and name != 'tala-ember'})
TILE = (136, 136)
LABEL_H = 26
ACTION_GAP = 5


def tile_frame(frame: Image.Image) -> Image.Image:
    canvas = Image.new('RGBA', TILE, (26, 30, 41, 255))
    art = frame.copy()
    art.thumbnail((TILE[0] - 8, TILE[1] - 8), Image.Resampling.LANCZOS)
    canvas.alpha_composite(art, ((TILE[0] - art.width) // 2, (TILE[1] - art.height) // 2))
    return canvas


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    summaries = []
    for fighter in FIGHTERS:
        width, height = FRAME_SIZES[fighter]
        module = ROOT / 'src' / 'game' / f'{FIGHTER_MODULES[fighter]}.ts'
        source = module.read_text(encoding='utf-8')
        # Only include sheets referenced by the character's animation definitions.
        # Asset folders also contain raw source atlases and rejected experiments;
        # treating those as runtime crops made the QA sheet misleading.
        referenced = set(re.findall(r"file:\s*'([^']+\.png)'", source))
        rows = []
        edge_frames = []
        for path in sorted((ASSETS / fighter).rglob('*.png')):
            relative = path.relative_to(ASSETS / fighter)
            if relative.as_posix() not in referenced:
                continue
            if path.name in ('anchor-w.png', 'portrait.png') or 'preview' in path.stem:
                continue
            image = Image.open(path).convert('RGBA')
            cols = image.width // width
            grid_rows = image.height // height
            if cols == 0 or grid_rows == 0:
                continue
            frames = []
            touched = 0
            for index in range(cols * grid_rows):
                col, row = index % cols, index // cols
                frame = image.crop((col * width, row * height, (col + 1) * width, (row + 1) * height))
                alpha = frame.getchannel('A')
                if any((
                    alpha.crop((0, 0, width, 1)).getbbox(),
                    alpha.crop((0, height - 1, width, height)).getbbox(),
                    alpha.crop((0, 0, 1, height)).getbbox(),
                    alpha.crop((width - 1, 0, width, height)).getbbox(),
                )):
                    touched += 1
                    edge_frames.append((str(relative), index + 1, frame.copy()))
                frames.append(frame)
            rows.append((str(relative), image.size, frames, touched))

        max_lines = max((math.ceil(len(frames) / 6) for _, _, frames, _ in rows), default=1)
        row_heights = [LABEL_H + max(1, math.ceil(len(frames) / 6)) * TILE[1] + ACTION_GAP for _, _, frames, _ in rows]
        sheet = Image.new('RGBA', (6 * TILE[0], sum(row_heights)), (15, 19, 27, 255))
        draw = ImageDraw.Draw(sheet)
        y = 0
        for (label, dimensions, frames, touched), row_height in zip(rows, row_heights):
            status = f'  [EDGE:{touched}]' if touched else ''
            draw.text((8, y + 5), f'{label} {dimensions}  {len(frames)} frames{status}', fill=(255, 215, 110, 255) if touched else (235, 241, 252, 255))
            frame_y = y + LABEL_H
            for index, frame in enumerate(frames):
                line, col = divmod(index, 6)
                tile = tile_frame(frame)
                sheet.alpha_composite(tile, (col * TILE[0], frame_y + line * TILE[1]))
                draw.text((col * TILE[0] + 3, frame_y + line * TILE[1] + 2), str(index + 1), fill=(255, 255, 255, 220))
            y += row_height
        out = OUTPUT / f'{fighter}.png'
        sheet.convert('RGB').save(out, optimize=True)
        if edge_frames:
            edge_columns = 3
            edge_label_h = 24
            edge_rows = math.ceil(len(edge_frames) / edge_columns)
            edge_sheet = Image.new(
                'RGBA',
                (edge_columns * width, edge_rows * (height + edge_label_h)),
                (15, 19, 27, 255)
            )
            edge_draw = ImageDraw.Draw(edge_sheet)
            for edge_index, (relative, frame_index, frame) in enumerate(edge_frames):
                edge_x = (edge_index % edge_columns) * width
                edge_y = (edge_index // edge_columns) * (height + edge_label_h)
                edge_draw.text((edge_x + 3, edge_y + 4), f'{relative} #{frame_index}', fill='white')
                edge_sheet.alpha_composite(frame, (edge_x, edge_y + edge_label_h))
            edge_sheet.convert('RGB').save(OUTPUT / f'{fighter}-edge-runtime.png', optimize=True)
        edge_frames = sum(touched for _, _, _, touched in rows)
        summaries.append(f'{fighter}\t{len(rows)} strips\t{sum(len(frames) for _, _, frames, _ in rows)} frames\t{edge_frames} edge-touching\t{out.relative_to(ROOT)}')
        print(summaries[-1])

    (OUTPUT / 'manifest.tsv').write_text('\n'.join(summaries) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
