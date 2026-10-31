from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
CONCEPTS = ROOT / 'concepts' / 'characters'
ASSETS = ROOT / 'public' / 'assets'
CANDIDATES = ROOT / 'concepts' / 'crop-candidates-v2'
ROWS = {
    'core-actions-atlas.png': ('idle', 'walk-forward', 'light-punch', 'light-kick'),
    'special-actions-atlas.png': ('hadoken', 'shoryuken', 'tatsumaki', 'special'),
    'utility-actions-atlas.png': ('block-high', 'crouch', 'jump', 'knockdown'),
    'utility-actions-atlas-crop-v1.png': ('crouch', 'block-high', 'block-low', 'hit-high'),
}
DEFAULT_CELL = (313, 313)
FRAME_INSET = 0.04


def isolate_atlas_neighbors(cell: Image.Image) -> Image.Image:
    rgba = np.asarray(cell.convert('RGBA')).copy()
    labels, count = ndimage.label(rgba[:, :, 3] > 8)
    if count == 0:
        return Image.new('RGBA', cell.size, (0, 0, 0, 0))

    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    largest = int(sizes.max())
    keep = np.zeros(count + 1, dtype=bool)
    for label in range(1, count + 1):
        area = int(sizes[label])
        if area < max(160, largest * 0.018):
            continue
        ys, xs = np.where(labels == label)
        touches_edge = (
            xs.min() < 2 or xs.max() > cell.width - 3
            or ys.min() < 2 or ys.max() > cell.height - 3
        )
        if touches_edge and area < largest * 0.45:
            continue
        keep[label] = True

    rgba[~keep[labels]] = 0
    return Image.fromarray(rgba, 'RGBA')


def crop_cell(atlas: Image.Image, column: int, row: int, frame_size: tuple[int, int]) -> Image.Image:
    left, right = round(column * atlas.width / 4), round((column + 1) * atlas.width / 4)
    top, bottom = round(row * atlas.height / 4), round((row + 1) * atlas.height / 4)
    # Atlas poses can deliberately spill over the nominal 4x4 tile boundary.
    # Label the complete atlas, then assign each connected pose by its centroid
    # so a fist, hair, or foot crossing a tile edge is not cut off.
    rgba = np.asarray(atlas.convert('RGBA')).copy()
    labels, count = ndimage.label(rgba[:, :, 3] > 8)
    keep = np.zeros(count + 1, dtype=bool)
    sizes = np.bincount(labels.ravel())
    for label in range(1, count + 1):
        if sizes[label] < 160:
            continue
        ys, xs = np.where(labels == label)
        cy, cx = float(ys.mean()), float(xs.mean())
        if left <= cx < right and top <= cy < bottom:
            keep[label] = True
    if not keep.any():
        # Some packed combat strips use uneven layouts and are handled by the
        # legacy per-cell fallback; the generated four-by-four pose atlases
        # use the component-aware path above.
        cell = isolate_atlas_neighbors(atlas.crop((left, top, right, bottom)))
    else:
        rgba[~keep[labels]] = 0
        isolated = Image.fromarray(rgba, 'RGBA')
        component_bounds = isolated.getchannel('A').getbbox()
        cell = isolated.crop(component_bounds) if component_bounds else isolated.crop((left, top, right, bottom))
    bbox = cell.getchannel('A').getbbox()
    if bbox is None:
        raise ValueError(f'Empty source cell row={row} col={column}')

    art = cell.crop(bbox)
    return fit_art(art, frame_size)


def fit_art(art: Image.Image, frame_size: tuple[int, int]) -> Image.Image:
    width, height = frame_size
    inset_x = max(10, round(width * FRAME_INSET))
    inset_y = max(10, round(height * FRAME_INSET))
    scale = min((width - inset_x * 2) / art.width, (height - inset_y * 2) / art.height)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.Resampling.LANCZOS)
    output = Image.new('RGBA', frame_size, (0, 0, 0, 0))
    x = (width - art.width) // 2
    y = height - inset_y - art.height
    output.alpha_composite(art, (x, y))

    alpha = output.getchannel('A')
    if any((
        alpha.crop((0, 0, width, 1)).getbbox(),
        alpha.crop((0, height - 1, width, height)).getbbox(),
        alpha.crop((0, 0, 1, height)).getbbox(),
        alpha.crop((width - 1, 0, width, height)).getbbox(),
    )):
        raise ValueError('Output touches frame edge after padding')
    return output


def build_qa_sheet(action_strips: dict[str, list[Image.Image]], frame_size: tuple[int, int], output: Path) -> None:
    width, height = frame_size
    label_height = 28
    qa = Image.new('RGBA', (width * 4, (height + label_height) * len(action_strips)), (25, 29, 39, 255))
    draw = ImageDraw.Draw(qa)
    for row, (action, frames) in enumerate(action_strips.items()):
        draw.text((8, row * (height + label_height) + 7), f'{action} / four isolated frames', fill=(245, 247, 255, 255))
        y = row * (height + label_height) + label_height
        for column, frame in enumerate(frames):
            tile = Image.new('RGBA', frame_size, (25, 29, 39, 255))
            tile.alpha_composite(frame)
            qa.alpha_composite(tile, (column * width, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    qa.convert('RGB').save(output, optimize=True)


def rebuild_mira_skybreaker() -> str:
    source = ASSETS / 'mira-kestrel' / 'skybreaker.png'
    atlas = Image.open(source).convert('RGBA')
    frame_size = (313, 313)
    frames = [crop_cell(atlas, column, row, frame_size) for row in range(3) for column in range(4)]
    strip = Image.new('RGBA', (frame_size[0] * len(frames), frame_size[1]), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * frame_size[0], 0))

    out_dir = CANDIDATES / 'mira-kestrel' / 'skybreaker-12frame'
    out_dir.mkdir(parents=True, exist_ok=True)
    strip.save(out_dir / 'skybreaker-cropped.png', optimize=True)

    tile = (116, 116)
    label_h = 22
    qa = Image.new('RGBA', (tile[0] * 6, (tile[1] + label_h) * 2), (25, 29, 39, 255))
    draw = ImageDraw.Draw(qa)
    for index, frame in enumerate(frames):
        x, y = (index % 6) * tile[0], (index // 6) * (tile[1] + label_h)
        draw.text((x + 5, y + 4), f'frame {index + 1:02d}', fill=(245, 247, 255, 255))
        preview = frame.copy()
        preview.thumbnail(tile, Image.Resampling.LANCZOS)
        qa.alpha_composite(preview, (x, y + label_h))
    qa.convert('RGB').save(out_dir / 'qa.png', optimize=True)
    return f'mira-kestrel\tskybreaker.png->skybreaker-cropped.png\t{atlas.size}\t{(out_dir / "qa.png").relative_to(ROOT)}'


def main() -> None:
    manifest: list[str] = []
    for character_dir in sorted(CONCEPTS.iterdir()):
        if not character_dir.is_dir():
            continue
        frame_size = DEFAULT_CELL
        if character_dir.name == 'tala-ember':
            frame_size = (328, 300)

        for atlas_name, action_rows in ROWS.items():
            atlas_path = character_dir / atlas_name
            if not atlas_path.exists():
                continue
            atlas = Image.open(atlas_path).convert('RGBA')
            if character_dir.name == 'kavi-damar' and atlas_name == 'utility-actions-atlas.png':
                # Kavi's atlas orders these two rows as jump, then high block.
                action_rows = ('jump', 'crouch', 'block-high', 'knockdown')
            destination = CANDIDATES / character_dir.name / atlas_name.removesuffix('.png')
            destination.mkdir(parents=True, exist_ok=True)
            action_strips: dict[str, list[Image.Image]] = {}
            for row, action in enumerate(action_rows):
                frames = [crop_cell(atlas, column, row, frame_size) for column in range(4)]
                if character_dir.name == 'kavi-damar' and atlas_name == 'utility-actions-atlas.png' and action == 'knockdown':
                    # The first knockdown pose touches the prior row's block
                    # pose in the source atlas, merging their alpha components.
                    # Its own silhouette begins below this explicit boundary.
                    first_region = atlas.crop((0, 960, round(atlas.width / 4), atlas.height))
                    frames[0] = fit_art(isolate_atlas_neighbors(first_region), frame_size)
                strip = Image.new('RGBA', (frame_size[0] * 4, frame_size[1]), (0, 0, 0, 0))
                for column, frame in enumerate(frames):
                    strip.alpha_composite(frame, (column * frame_size[0], 0))
                strip.save(destination / f'{action}.png', optimize=True)
                action_strips[action] = frames
            qa_path = destination / 'qa.png'
            build_qa_sheet(action_strips, frame_size, qa_path)
            manifest.append(f'{character_dir.name}\t{atlas_name}\t{atlas.size}\t{qa_path.relative_to(ROOT)}')

    (CANDIDATES / 'manifest.tsv').write_text('\n'.join(manifest) + '\n', encoding='utf-8')
    manifest.append(rebuild_mira_skybreaker())
    (CANDIDATES / 'manifest.tsv').write_text('\n'.join(manifest) + '\n', encoding='utf-8')
    print(f'Created candidate crops and QA sheets for {len(manifest)} atlas sheets at {CANDIDATES}')


if __name__ == '__main__':
    main()
