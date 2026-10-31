from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
GENERATED = Path(r'C:\Users\sekip\.codex\generated_images\01a18314-b09a-7b91-ad56-374223fb4a20')
OUT = ROOT / 'concepts' / 'elemental-special-candidates'
SPECS = {
    'red-brawler': [
        ('hadoken-cast-12.png', 'exec-a8a59a15-e126-41b8-83a2-bab8de523f65.png'),
        ('shoryuken-12.png', 'exec-a3b5541a-1650-460d-8572-14af45a14eab.png'),
        ('tatsumaki-12.png', 'exec-ad4caac6-7652-4f62-a5dd-796012ad6d49.png'),
    ],
    'green-boxer': [
        ('hadoken-12.png', 'exec-f2d25f5e-aa38-45a2-a09a-2bef41158853.png'),
        ('shoryuken-12.png', 'exec-558408a8-d642-4767-b7a9-3d1dca63158d.png'),
        ('tatsumaki-12.png', 'exec-77ec5d02-0347-4b41-b67c-e045eb0a64df.png'),
    ],
    'jiujitsu-fighter': [
        ('hadoken-12.png', 'exec-cbdef8d0-3cad-4a54-b906-0634f8b714ff.png'),
        ('shoryuken-12.png', 'exec-f1dcb5d8-2d34-4a5d-b44c-a0f4f472d74d.png'),
        ('tatsumaki-12.png', 'exec-26593c3e-e4fc-40fd-a3f8-da3f1a680db1.png'),
    ],
}
GRID_SPECS = {
    ('green-boxer', 'hadoken-12.png'): 'exec-af61da99-e3ba-448e-a914-4422a913ac06.png',
    ('green-boxer', 'tatsumaki-12.png'): 'exec-d1fc602a-8065-46bb-8764-35855de2240a.png',
    ('jiujitsu-fighter', 'hadoken-12.png'): 'exec-382ae65b-f34f-42bf-92f6-c2744296d539.png',
    ('jiujitsu-fighter', 'tatsumaki-12.png'): 'exec-4722cdf5-4bab-4895-b2bd-526e7e997668.png',
}
FRAME = (256, 256)


def ordered_components(image: Image.Image) -> list[list[int]]:
    rgba = np.asarray(image.convert('RGBA'))
    labels, count = ndimage.label(rgba[:, :, 3] > 8)
    sizes = np.bincount(labels.ravel())
    rows: list[tuple[float, int]] = []
    for label in range(1, count + 1):
        if sizes[label] < 500:
            continue
        ys, xs = np.where(labels == label)
        rows.append((float(xs.mean()), label))
    rows.sort()
    if len(rows) < 12:
        raise ValueError(f'Expected at least 12 visible sprites, found {len(rows)}')
    anchors = [(index + 0.5) * image.width / 12 for index in range(12)]
    # Dynamic programming partitions left-to-right components into 12 groups.
    # Extra detached energy wisps are joined to their nearest sprite frame.
    m = len(rows)
    dp = [[float('inf')] * (m + 1) for _ in range(13)]
    prev: list[list[int | None]] = [[None] * (m + 1) for _ in range(13)]
    dp[0][0] = 0.0
    for frame in range(1, 13):
        for end in range(frame, m + 1):
            for start in range(frame - 1, end):
                center = sum(x for x, _ in rows[start:end]) / (end - start)
                cost = dp[frame - 1][start] + ((center - anchors[frame - 1]) / image.width) ** 2
                if cost < dp[frame][end]:
                    dp[frame][end] = cost
                    prev[frame][end] = start
    groups: list[list[int]] = [[] for _ in range(12)]
    end = m
    for frame in range(12, 0, -1):
        start = prev[frame][end]
        if start is None:
            raise ValueError('Could not map generated sprites to 12 frames')
        groups[frame - 1] = [label for _, label in rows[start:end]]
        end = start
    return groups


def make_frame(image: Image.Image, labels: list[int]) -> Image.Image:
    rgba = np.asarray(image.convert('RGBA')).copy()
    component_map, _ = ndimage.label(rgba[:, :, 3] > 8)
    keep = np.isin(component_map, labels)
    rgba[~keep] = 0
    isolated = Image.fromarray(rgba, 'RGBA')
    bounds = isolated.getchannel('A').getbbox()
    if bounds is None:
        raise ValueError('Empty generated frame')
    return fit_frame_art(isolated.crop(bounds))


def fit_frame_art(art: Image.Image) -> Image.Image:
    scale = min((FRAME[0] - 16) / art.width, (FRAME[1] - 20) / art.height)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.Resampling.LANCZOS)
    frame = Image.new('RGBA', FRAME, (0, 0, 0, 0))
    frame.alpha_composite(art, ((FRAME[0] - art.width) // 2, FRAME[1] - 6 - art.height))
    alpha = frame.getchannel('A')
    if any((alpha.crop((0, 0, FRAME[0], 1)).getbbox(), alpha.crop((0, FRAME[1]-1, FRAME[0], FRAME[1])).getbbox(),
            alpha.crop((0, 0, 1, FRAME[1])).getbbox(), alpha.crop((FRAME[0]-1, 0, FRAME[0], FRAME[1])).getbbox())):
        raise ValueError('Output frame touches a crop edge')
    return frame


def make_tile_frame(image: Image.Image, index: int) -> Image.Image:
    left = round(index * image.width / 12)
    right = round((index + 1) * image.width / 12)
    tile = image.crop((left, 0, right, image.height))
    bounds = tile.getchannel('A').getbbox()
    if bounds is None:
        raise ValueError(f'Empty fallback frame {index + 1}')
    return fit_frame_art(tile.crop(bounds))


def make_grid_frames(image: Image.Image) -> list[Image.Image]:
    frames = []
    for index in range(12):
        col, row = index % 4, index // 4
        left = round(col * image.width / 4)
        right = round((col + 1) * image.width / 4)
        top = round(row * image.height / 3)
        bottom = round((row + 1) * image.height / 3)
        # Remove small generation seams at the cell edges without trimming poses.
        inset_x = max(2, round((right - left) * 0.012))
        inset_y = max(2, round((bottom - top) * 0.012))
        tile = image.crop((left + inset_x, top + inset_y, right - inset_x, bottom - inset_y))
        rgba = np.asarray(tile).copy()
        labels, count = ndimage.label(rgba[:, :, 3] > 8)
        sizes = np.bincount(labels.ravel())
        minor = np.flatnonzero((sizes < 700) & (np.arange(len(sizes)) > 0))
        if len(minor):
            rgba[np.isin(labels, minor)] = 0
            tile = Image.fromarray(rgba, 'RGBA')
        bounds = tile.getchannel('A').getbbox()
        if bounds is None:
            raise ValueError(f'Empty generated grid frame {index + 1}')
        frames.append(fit_frame_art(tile.crop(bounds)))
    return frames


def main() -> None:
    records: list[str] = []
    for fighter, specs in SPECS.items():
        qa_rows: list[tuple[str, list[Image.Image]]] = []
        out_dir = OUT / fighter
        out_dir.mkdir(parents=True, exist_ok=True)
        for filename, generated_name in specs:
            source_path = GENERATED / GRID_SPECS[(fighter, filename)] if (fighter, filename) in GRID_SPECS else GENERATED / generated_name
            source = Image.open(source_path).convert('RGBA')
            if (fighter, filename) in GRID_SPECS:
                frames = make_grid_frames(source)
                groups = [[index] for index in range(12)]
            else:
                try:
                    groups = ordered_components(source)
                    frames = [make_frame(source, group) for group in groups]
                except ValueError as error:
                    if 'found 11' not in str(error):
                        raise
                    frames = [make_tile_frame(source, index) for index in range(12)]
                    groups = [[index] for index in range(12)]
            strip = Image.new('RGBA', (FRAME[0] * 12, FRAME[1]), (0, 0, 0, 0))
            for index, frame in enumerate(frames):
                strip.alpha_composite(frame, (index * FRAME[0], 0))
            strip.save(out_dir / filename, optimize=True)
            qa_rows.append((filename, frames))
            records.append(f'{fighter}\t{filename}\t{generated_name}\tcomponents={sum(len(g) for g in groups)}')

        qa = Image.new('RGB', (FRAME[0] * 6, 3 * 300), (25, 29, 39))
        draw = ImageDraw.Draw(qa)
        for row, (label, frames) in enumerate(qa_rows):
            draw.text((6, row * 300 + 4), label, fill=(245, 247, 255))
            for index, frame in enumerate(frames):
                preview = frame.copy()
                preview.thumbnail((112, 112), Image.Resampling.LANCZOS)
                frame_row = index // 6
                x = (index % 6) * 256 + 72
                y = row * 300 + 28 + frame_row * 128 + (112 - preview.height) // 2
                qa.paste(preview.convert('RGB'), (x, y), preview.getchannel('A'))
        qa.save(out_dir / 'qa.png', optimize=True)
    (OUT / 'manifest.tsv').write_text('\n'.join(records) + '\n', encoding='utf-8')
    print(f'Created 9 frame-aligned candidates and QA sheets under {OUT}')


if __name__ == '__main__':
    main()
