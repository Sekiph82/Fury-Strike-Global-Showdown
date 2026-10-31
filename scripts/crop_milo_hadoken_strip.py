from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'concepts' / 'elemental-atlas-candidates' / 'milo-vance' / 'hadoken-contained-strip.png'
OUT = ROOT / 'concepts' / 'elemental-atlas-candidates' / 'milo-vance'
FRAME = 313


def main() -> None:
    image = Image.open(SOURCE).convert('RGBA')
    if image.size != (2172, 724):
        raise ValueError(f'Unexpected generated strip size: {image.size}')

    # Hand-marked boundaries sit in the transparent gaps between poses/effects.
    cuts = (0, 500, 1030, 1660, 2172)
    frames: list[Image.Image] = []
    for index, (left, right) in enumerate(zip(cuts, cuts[1:]), start=1):
        crop = image.crop((left, 0, right, image.height))
        rgba = np.asarray(crop).copy()
        labels, _ = ndimage.label(rgba[:, :, 3] > 8)
        sizes = np.bincount(labels.ravel())
        tiny = np.flatnonzero((sizes < 500) & (np.arange(len(sizes)) > 0))
        rgba[np.isin(labels, tiny)] = 0
        crop = Image.fromarray(rgba, 'RGBA')
        bounds = crop.getchannel('A').getbbox()
        if bounds is None:
            raise ValueError(f'Frame {index} has no visible sprite')
        art = crop.crop(bounds)
        scale = min(293 / art.width, 293 / art.height)
        art = art.resize((round(art.width * scale), round(art.height * scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
        frame.alpha_composite(art, ((FRAME - art.width) // 2, FRAME - 5 - art.height))
        alpha = np.asarray(frame.getchannel('A'))
        if max(alpha[0].max(), alpha[-1].max(), alpha[:, 0].max(), alpha[:, -1].max()) > 8:
            raise ValueError(f'Frame {index} touches a sprite-sheet edge')
        frames.append(frame)

    strip = Image.new('RGBA', (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    qa = Image.new('RGB', (1000, 300), (26, 30, 40))
    draw = ImageDraw.Draw(qa)
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME, 0))
        preview = frame.copy()
        preview.thumbnail((235, 260), Image.Resampling.LANCZOS)
        qa.paste(preview.convert('RGB'), (index * 250 + 7, 30), preview.getchannel('A'))
        draw.text((index * 250 + 8, 5), f'Frame {index + 1}', fill='white')

    strip.save(OUT / 'hadoken.png', optimize=True)
    qa.save(OUT / 'hadoken-qa-final.png', optimize=True)
    print(f'Wrote a {len(frames)}-frame {strip.width}x{strip.height} strip and its QA sheet.')


if __name__ == '__main__':
    main()
