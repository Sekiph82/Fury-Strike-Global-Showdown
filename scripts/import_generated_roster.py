from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
GEN = Path(r"C:\Users\sekip\.codex\generated_images\01a18314-b09a-7b91-ad56-374223fb4a20")

FIGHTERS = {
    "milo-vance": {
        "concept": "exec-e43e218f-8258-4e4c-9f0d-7af0bf3d87b3.png",
        "core": "exec-9da45e55-3d27-40f3-b290-9359e6a5bb4f.png",
        "special": "exec-c4d0c861-9613-469d-9dc1-df40e8cff5bb.png",
        "utility": "exec-1365faaf-703d-47ca-9627-9f0e230956fc.png",
    },
    "anika-vale": {
        "concept": "exec-e7a26726-a0ad-4278-a3e7-de009a213dc8.png",
        "core": "exec-db098c3e-91f5-47c0-88c9-609e8b8c86ba.png",
        "special": "exec-692e5fff-138f-4202-969a-e88fe8bb058b.png",
        "utility": "exec-f55a31bc-6032-4322-9685-fc755d4ec5ca.png",
    },
    "darius-quell": {
        "concept": "exec-1fbc95e4-5a54-4a3b-9302-5b3092a5a0f1.png",
        "core": "exec-8736f643-74b8-47c1-8518-b63942da510a.png",
        "special": "exec-2844993c-8e30-4cc5-9ac8-beef46405307.png",
        "utility": "exec-42880b0f-2673-4f61-aa91-f269492e5cff.png",
    },
}

ROWS = {
    "core": ["idle", "walk-forward", "light-punch", "light-kick"],
    "special": ["hadoken", "shoryuken", "tatsumaki", "special"],
    "utility": ["block-high", "crouch", "jump", "knockdown"],
}

CELL = 313

def square_contain(source: Image.Image, size: int) -> Image.Image:
    source = source.convert("RGBA")
    bbox = source.getchannel("A").getbbox()
    if bbox:
        source = source.crop(bbox)
    source.thumbnail((size - 24, size - 24), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(source, ((size - source.width) // 2, (size - source.height) // 2))
    return canvas

def clean_frame(source: Image.Image) -> Image.Image:
    """Remove atlas-neighbor fragments, then fit the complete pose into one frame."""
    rgba = np.asarray(source.convert("RGBA")).copy()
    labels, count = ndimage.label(rgba[:, :, 3] > 8)
    if count:
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        largest = int(sizes.max())
        keep = np.zeros(count + 1, dtype=bool)
        for label in range(1, count + 1):
            area = int(sizes[label])
            if area < max(180, largest * 0.025):
                continue
            ys, xs = np.where(labels == label)
            touches_side = xs.min() < 2 or xs.max() > source.width - 3 or ys.min() < 2 or ys.max() > source.height - 3
            # Adjacent cells sometimes leak in at the sides. Keep a side-touching
            # component only when it is a substantial part of the central pose.
            if touches_side and area < largest * 0.55:
                continue
            keep[label] = True
        rgba[~keep[labels]] = 0
    frame = Image.fromarray(rgba, "RGBA")
    bbox = frame.getbbox()
    output = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    if not bbox:
        return output
    frame = frame.crop(bbox)
    frame.thumbnail((260, 285), Image.Resampling.LANCZOS)
    output.alpha_composite(frame, ((CELL - frame.width) // 2, CELL - 7 - frame.height))
    return output

for fighter, files in FIGHTERS.items():
    concept_dir = ROOT / "concepts" / "characters" / fighter
    asset_dir = ROOT / "public" / "assets" / fighter
    concept_dir.mkdir(parents=True, exist_ok=True)
    asset_dir.mkdir(parents=True, exist_ok=True)
    reference = Image.open(GEN / files["concept"]).convert("RGBA")
    reference.save(concept_dir / "reference.png")
    square_contain(reference, 850).save(asset_dir / "anchor-w.png")
    square_contain(reference.crop((0, 0, reference.width, int(reference.height * 0.62))), 850).save(asset_dir / "portrait.png")

    for atlas_name, actions in ROWS.items():
        atlas = Image.open(GEN / files[atlas_name]).convert("RGBA")
        if atlas.width < CELL * 4 or atlas.height < CELL * 4:
            raise ValueError(f"Atlas too small for 4x4 cells: {fighter}/{atlas_name}: {atlas.size}")
        atlas.save(concept_dir / f"{atlas_name}-actions-atlas.png")
        for row, action in enumerate(actions):
            strip = Image.new("RGBA", (CELL * 4, CELL), (0, 0, 0, 0))
            for col in range(4):
                cell = atlas.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))
                strip.alpha_composite(clean_frame(cell), (col * CELL, 0))
            strip.save(asset_dir / f"{action}.png")

    special_atlas = Image.open(GEN / files["special"]).convert("RGBA")
    charge = Image.new("RGBA", (CELL * 2, CELL), (0, 0, 0, 0))
    for col in range(2):
        charge.alpha_composite(clean_frame(special_atlas.crop((col * CELL, 0, (col + 1) * CELL, CELL))), (col * CELL, 0))
    charge.save(asset_dir / "special-charge.png")

    for key, prompt in {
        "reference": f"Original full-body transparent Vibe Fighter concept art for {fighter.replace('-', ' ').title()}, facing right, no background or text.",
        "core-actions": "Generate a transparent 4x4 fighter atlas. Rows: idle, walk, punch, kick; four animation frames per row.",
        "special-actions": "Generate a transparent 4x4 fighter atlas. Rows: projectile, rising attack, spinning kick, meter super; four animation frames per row.",
        "utility-actions": "Generate a transparent 4x4 fighter atlas. Rows: high block, crouch, jump, knockdown/recovery; four frames per row.",
    }.items():
        (ROOT / "art-prompts" / f"{fighter}-{key}.md").write_text(f"# {fighter.replace('-', ' ').title()} â€” {key.replace('-', ' ').title()}\n\n{prompt}\n", encoding="utf-8")

    print(f"{fighter}: {len(list(asset_dir.glob('*.png')))} runtime PNGs; reference {reference.size}")
