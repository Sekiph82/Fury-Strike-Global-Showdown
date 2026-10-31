from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from scipy import ndimage

ROWS = ('crouch', 'block-high', 'block-low', 'hit-high')

def isolate_components(cell: Image.Image) -> Image.Image:
    """Drop disconnected neighbor-frame fragments touching an atlas cell edge."""
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
        touches_edge = xs.min() < 2 or xs.max() > cell.width - 3 or ys.min() < 2 or ys.max() > cell.height - 3
        if touches_edge and area < largest * 0.45:
            continue
        keep[label] = True

    rgba[~keep[labels]] = 0
    return Image.fromarray(rgba, 'RGBA')

def crop_atlas(atlas_path: Path, destination: Path, frame_width: int, frame_height: int, qa_path: Path) -> None:
    atlas = Image.open(atlas_path).convert('RGBA')
    if atlas.width < 4 or atlas.height < 4:
        raise ValueError(f'Invalid atlas: {atlas.size}')
    destination.mkdir(parents=True, exist_ok=True)
    qa = Image.new('RGBA', (frame_width * 4, (frame_height + 36) * len(ROWS)), (24, 28, 39, 255))
    draw = ImageDraw.Draw(qa)
    for row, action in enumerate(ROWS):
        strip = Image.new('RGBA', (frame_width * 4, frame_height), (0, 0, 0, 0))
        for col in range(4):
            x0, x1 = round(col * atlas.width / 4), round((col + 1) * atlas.width / 4)
            y0, y1 = round(row * atlas.height / 4), round((row + 1) * atlas.height / 4)
            cell = isolate_components(atlas.crop((x0, y0, x1, y1)))
            bbox = cell.getchannel('A').getbbox()
            if bbox is None:
                raise ValueError(f'Empty cell in {action} frame {col}')
            art = cell.crop(bbox)
            inset_x = max(10, round(frame_width * 0.04))
            inset_y = max(10, round(frame_height * 0.04))
            fit = min((frame_width - inset_x * 2) / art.width, (frame_height - inset_y * 2) / art.height)
            art = art.resize((max(1, round(art.width * fit)), max(1, round(art.height * fit))), Image.Resampling.LANCZOS)
            # Feet stay aligned to a shared baseline; hit reactions keep their vertical center.
            px = (frame_width - art.width) // 2
            py = frame_height - inset_y - art.height if action != 'hit-high' else (frame_height - art.height) // 2
            frame = Image.new('RGBA', (frame_width, frame_height), (0, 0, 0, 0))
            frame.alpha_composite(art, (px, py))
            alpha = frame.getchannel('A')
            if any((
                alpha.crop((0, 0, frame_width, 1)).getbbox(),
                alpha.crop((0, frame_height - 1, frame_width, frame_height)).getbbox(),
                alpha.crop((0, 0, 1, frame_height)).getbbox(),
                alpha.crop((frame_width - 1, 0, frame_width, frame_height)).getbbox()
            )):
                raise ValueError(f'Frame touches crop edge: {action} #{col}')
            strip.alpha_composite(frame, (col * frame_width, 0))
            bg = Image.new('RGBA', frame.size, (24, 28, 39, 255)); bg.alpha_composite(frame)
            qa.alpha_composite(bg, (col * frame_width, row * (frame_height + 36) + 36))
        draw.text((8, row * (frame_height + 36) + 8), f'{action} — four isolated frame crops', fill=(235, 242, 255, 255))
        strip.save(destination / f'{action}.png', optimize=True)
    qa_path.parent.mkdir(parents=True, exist_ok=True)
    qa.convert('RGB').save(qa_path, optimize=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Crop a transparent 4x4 utility atlas into isolated 4-frame strips and a visual QA sheet.')
    parser.add_argument('atlas', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('qa', type=Path)
    parser.add_argument('--frame-width', type=int, required=True)
    parser.add_argument('--frame-height', type=int, required=True)
    args = parser.parse_args()
    crop_atlas(args.atlas, args.destination, args.frame_width, args.frame_height, args.qa)
