from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
GENERATED = Path(r'C:\Users\sekip\.codex\generated_images\01a18314-b09a-7b91-ad56-374223fb4a20')
OUT = ROOT / 'concepts' / 'elemental-atlas-grid-diagnostic'
CELL = 313
INSET = 10
SPECS = {
    'milo-vance': ('exec-b5024a74-0d6c-42ec-85aa-6e868cb45583.png', ['hadoken.png', 'shoryuken.png', 'tatsumaki.png', 'special.png']),
    'sora-keene': ('exec-cb19c4f7-b238-48f7-88ff-34bb563e92e9.png', ['hadoken.png', 'shoryuken.png', 'tatsumaki.png', 'special.png']),
    'kavi-damar': ('exec-a930eba6-d411-498f-83d8-ae7eb5902526.png', ['hadoken.png', 'shoryuken.png', 'tatsumaki.png', 'special.png']),
    'darius-quell': ('exec-5c1adcac-4ccc-4f61-8c37-7a4661b1196e.png', ['hadoken.png', 'shoryuken.png', 'tatsumaki.png', 'special.png']),
}


def isolate_cell(image: Image.Image, col: int, row: int) -> Image.Image:
    left = round(col * image.width / 4) + INSET
    right = round((col + 1) * image.width / 4) - INSET
    top = round(row * image.height / 4) + INSET
    bottom = round((row + 1) * image.height / 4) - INSET
    tile = image.crop((left, top, right, bottom)).convert('RGBA')
    rgba = np.asarray(tile).copy()
    labels, count = ndimage.label(rgba[:, :, 3] > 8)
    sizes = np.bincount(labels.ravel())
    # Small disconnected specks at generated cell seams are not part of a pose.
    remove = np.flatnonzero((sizes < 24) & (np.arange(len(sizes)) > 0))
    if len(remove):
        rgba[np.isin(labels, remove)] = 0
    tile = Image.fromarray(rgba, 'RGBA')
    bounds = tile.getchannel('A').getbbox()
    if bounds is None:
        raise ValueError(f'Empty cell row={row} col={col}')
    art = tile.crop(bounds)
    scale = min((CELL - 20) / art.width, (CELL - 20) / art.height, 1.0)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.Resampling.LANCZOS)
    frame = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    frame.alpha_composite(art, ((CELL - art.width) // 2, CELL - 5 - art.height))
    alpha = np.asarray(frame.getchannel('A'))
    if max(alpha[0].max(), alpha[-1].max(), alpha[:, 0].max(), alpha[:, -1].max()) > 8:
        raise ValueError(f'Frame touches output edge row={row} col={col}')
    return frame


def main() -> None:
    manifest = ['fighter\taction\tframe\tsource_cell\ttrimmed_bounds']
    for fighter, (source_name, actions) in SPECS.items():
        source = Image.open(GENERATED / source_name).convert('RGBA')
        if source.size != (1254, 1254):
            raise ValueError(f'Unexpected atlas size for {fighter}: {source.size}')
        fighter_dir = OUT / fighter
        fighter_dir.mkdir(parents=True, exist_ok=True)
        qa = Image.new('RGB', (4 * 220, 4 * 245), (27, 31, 43))
        draw = ImageDraw.Draw(qa)
        for row, filename in enumerate(actions):
            strip = Image.new('RGBA', (CELL * 4, CELL), (0, 0, 0, 0))
            for col in range(4):
                frame = isolate_cell(source, col, row)
                strip.alpha_composite(frame, (col * CELL, 0))
                preview = frame.copy()
                preview.thumbnail((200, 200), Image.Resampling.LANCZOS)
                px = col * 220 + (220 - preview.width) // 2
                py = row * 245 + 30 + (200 - preview.height) // 2
                qa.paste(preview.convert('RGB'), (px, py), preview.getchannel('A'))
                draw.text((col * 220 + 6, row * 245 + 6), f'{filename}: frame {col + 1}', fill=(245, 247, 255))
                bounds = frame.getchannel('A').getbbox()
                manifest.append(f'{fighter}\t{filename}\t{col + 1}\t{row + 1},{col + 1}\t{bounds}')
            strip.save(fighter_dir / filename, optimize=True)
        qa.save(fighter_dir / 'qa.png', optimize=True)
    (OUT / 'manifest.tsv').write_text('\n'.join(manifest) + '\n', encoding='utf-8')
    print(f'Created four-frame action strips and frame-by-frame QA under {OUT}')


if __name__ == '__main__':
    main()
