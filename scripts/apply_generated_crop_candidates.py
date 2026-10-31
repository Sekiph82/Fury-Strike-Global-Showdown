from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = ROOT / 'concepts' / 'crop-candidates-v2'
RUNTIME = ROOT / 'public' / 'assets'
BACKUPS = CANDIDATES / 'runtime-originals'
SPECIAL_ALIASES = {
    'kavi-damar': {'hadoken.png': 'monsoon-palm.png', 'shoryuken.png': 'rising-gale.png', 'tatsumaki.png': 'saffron-cyclone.png'},
    'nera-volt': {'hadoken.png': 'volt-lance.png', 'shoryuken.png': 'arc-rise.png', 'tatsumaki.png': 'dynamo-sweep.png'},
    'tala-ember': {'hadoken.png': 'cinder-pulse.png', 'shoryuken.png': 'flare-lift.png', 'tatsumaki.png': 'gyre-heel.png'},
    'zola-nyx': {'hadoken.png': 'prism-pulse.png', 'shoryuken.png': 'comet-vault.png', 'tatsumaki.png': 'night-orbit.png'},
}


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def main() -> None:
    records: list[str] = []
    for source in sorted(CANDIDATES.glob('*/*/*.png')):
        if source.name == 'qa.png':
            continue
        character = source.parts[-3]
        destination = RUNTIME / character / source.name
        source_size = Image.open(source).size
        destinations = []
        if destination.exists():
            destinations.append((destination, source.name))
        alias_name = SPECIAL_ALIASES.get(character, {}).get(source.name)
        if alias_name:
            destinations.append((RUNTIME / character / alias_name, f'{source.name}->{alias_name}'))

        for target, label in destinations:
            if not target.exists():
                continue
            target_size = Image.open(target).size
            if source_size != target_size:
                records.append(f'{character}\t{label}\tSKIPPED-size-mismatch:{target_size}->{source_size}\t{target.relative_to(ROOT)}')
                continue
            backup = BACKUPS / character / target.name
            backup.parent.mkdir(parents=True, exist_ok=True)
            if not backup.exists():
                shutil.copy2(target, backup)
            shutil.copy2(source, target)
            records.append(f'{character}\t{label}\t{digest(source) == digest(target)}\t{target.relative_to(ROOT)}')

    # Tala's 12-frame Emberstorm sheet was assembled from three four-frame
    # moves, but its old atlas export retained unrelated pixels in frames 9-12.
    # Rebuild it directly from the cleaned, frame-aligned runtime strips.
    tala_dir = RUNTIME / 'tala-ember'
    tala_special = tala_dir / 'special.png'
    tala_sources = [tala_dir / name for name in ('cinder-pulse.png', 'flare-lift.png', 'gyre-heel.png')]
    if all(path.exists() for path in tala_sources):
        backup = BACKUPS / 'tala-ember' / 'special.png'
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            shutil.copy2(tala_special, backup)
        frames = [Image.open(path).convert('RGBA') for path in tala_sources]
        strip_w, frame_h = frames[0].size
        frame_w = strip_w // 4
        if all(frame.size == (strip_w, frame_h) for frame in frames):
            combined = Image.new('RGBA', (frame_w * 12, frame_h), (0, 0, 0, 0))
            for strip_index, strip in enumerate(frames):
                combined.alpha_composite(strip, (strip_index * frame_w * 4, 0))
            combined.save(tala_special, optimize=True)
            records.append(f'tala-ember\tspecial-composed-from-clean-moves\t{digest(tala_special)}\t{tala_special.relative_to(ROOT)}')

    report = CANDIDATES / 'applied-runtime-manifest.tsv'
    report.write_text('\n'.join(records) + '\n', encoding='utf-8')
    print(f'Applied {len(records)} candidate strips; byte-identical runtime copies: {sum(row.split(chr(9))[2] == "True" for row in records)}')
    print(f'Original runtime images saved under {BACKUPS}')


if __name__ == '__main__':
    main()
