from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw
import sys
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from rebuild_generated_roster_crops import isolate_atlas_neighbors

ASSETS = ROOT / 'public' / 'assets'
QA_ROOT = ROOT / 'concepts' / 'crop-candidates-v2' / 'remaining-strips'
MIRA_FILES = ('hadoken.png', 'heavy-kick.png', 'light-punch.png', 'shoryuken.png', 'special-charge.png', 'tatsumaki.png', 'walk-forward.png')


def crop_to_frame(cell: Image.Image, size: tuple[int, int], inset_ratio: float = 0.04) -> Image.Image:
    cell = isolate_atlas_neighbors(cell)
    bbox = cell.getchannel('A').getbbox()
    if bbox is None:
        raise ValueError('Empty sprite frame after connected-component cleanup')
    art = cell.crop(bbox)
    fw, fh = size
    inset_x, inset_y = max(10, round(fw * inset_ratio)), max(10, round(fh * inset_ratio))
    scale = min((fw - 2 * inset_x) / art.width, (fh - 2 * inset_y) / art.height)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.Resampling.LANCZOS)
    frame = Image.new('RGBA', size, (0, 0, 0, 0))
    frame.alpha_composite(art, ((fw - art.width) // 2, fh - inset_y - art.height))
    alpha = frame.getchannel('A')
    if any((
        alpha.crop((0, 0, fw, 1)).getbbox(), alpha.crop((0, fh - 1, fw, fh)).getbbox(),
        alpha.crop((0, 0, 1, fh)).getbbox(), alpha.crop((fw - 1, 0, fw, fh)).getbbox()
    )):
        raise ValueError('Cleaned sprite still touches output crop boundary')
    return frame


def crop_strip(source_path: Path, output_path: Path, frame_size: tuple[int, int], crop_columns: int = 4) -> list[Image.Image]:
    source = Image.open(source_path).convert('RGBA')
    rgba = np.asarray(source).copy()
    labels, count = ndimage.label(rgba[:, :, 3] > 8)
    sizes = np.bincount(labels.ravel())
    component_columns: list[list[int]] = [[] for _ in range(crop_columns)]
    # Keep each connected pose intact when it crosses an equal-width frame line.
    for label in range(1, count + 1):
        if sizes[label] < 100:
            continue
        ys, xs = np.where(labels == label)
        col = min(crop_columns - 1, int(xs.mean() * crop_columns / source.width))
        component_columns[col].append(label)
    frames = []
    for col in range(crop_columns):
        selected = component_columns[col]
        if selected:
            keep = np.isin(labels, selected)
            frame_source = rgba.copy()
            frame_source[~keep] = 0
            frames.append(crop_to_frame(Image.fromarray(frame_source, 'RGBA'), frame_size))
        else:
            left, right = round(col * source.width / crop_columns), round((col + 1) * source.width / crop_columns)
            frames.append(crop_to_frame(source.crop((left, 0, right, source.height)), frame_size))
    strip = Image.new('RGBA', (frame_size[0] * len(frames), frame_size[1]), (0, 0, 0, 0))
    for col, frame in enumerate(frames):
        strip.alpha_composite(frame, (col * frame_size[0], 0))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    strip.save(output_path, optimize=True)
    return frames


def save_qa(rows: list[tuple[str, list[Image.Image]]], frame_size: tuple[int, int], output: Path) -> None:
    fw, fh = frame_size
    title_h = 30
    qa = Image.new('RGBA', (fw * 4, (fh + title_h) * len(rows)), (25, 29, 39, 255))
    draw = ImageDraw.Draw(qa)
    for row, (label, frames) in enumerate(rows):
        draw.text((8, row * (fh + title_h) + 8), f'{label} — frame crop QA', fill=(245, 247, 255, 255))
        for col, frame in enumerate(frames):
            tile = Image.new('RGBA', frame_size, (25, 29, 39, 255))
            tile.alpha_composite(frame)
            qa.alpha_composite(tile, (col * fw, row * (fh + title_h) + title_h))
    output.parent.mkdir(parents=True, exist_ok=True)
    qa.convert('RGB').save(output, optimize=True)


def main() -> None:
    mira_size = (313, 313)
    mira_rows = []
    for name in MIRA_FILES:
        src = ASSETS / 'mira-kestrel' / name
        if not src.exists():
            continue
        out = QA_ROOT / 'mira-kestrel' / name
        frames = crop_strip(src, out, mira_size)
        mira_rows.append((name, frames))
    save_qa(mira_rows, mira_size, QA_ROOT / 'mira-kestrel' / 'qa.png')

    tala_atlas = ROOT / 'concepts' / 'characters' / 'tala-ember' / 'knockdown-atlas.png'
    tala_out = QA_ROOT / 'tala-ember' / 'knockdown.png'
    tala_frames = crop_strip(tala_atlas, tala_out, (328, 300), crop_columns=4)
    save_qa([('knockdown', tala_frames)], (328, 300), QA_ROOT / 'tala-ember' / 'qa.png')

    backups = QA_ROOT / 'runtime-originals'
    applied = []
    for filename in MIRA_FILES:
        target = ASSETS / 'mira-kestrel' / filename
        backup = backups / 'mira-kestrel' / filename
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            backup.write_bytes(target.read_bytes())
        target.write_bytes((QA_ROOT / 'mira-kestrel' / filename).read_bytes())
        applied.append(f'mira-kestrel\t{filename}')
    tala_target = ASSETS / 'tala-ember' / 'knockdown.png'
    tala_backup = backups / 'tala-ember' / 'knockdown.png'
    tala_backup.parent.mkdir(parents=True, exist_ok=True)
    if not tala_backup.exists():
        tala_backup.write_bytes(tala_target.read_bytes())
    tala_target.write_bytes(tala_out.read_bytes())
    applied.append('tala-ember\tknockdown.png')
    (QA_ROOT / 'applied.tsv').write_text('\n'.join(applied) + '\n', encoding='utf-8')
    print(f'Cleaned {sum(len(frames) for _, frames in mira_rows)} Mira frames and {len(tala_frames)} Tala knockdown frames; see {QA_ROOT}')


if __name__ == '__main__':
    main()
