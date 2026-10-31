from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = ROOT / 'concepts' / 'elemental-special-candidates'
BACKUPS = CANDIDATES / 'runtime-originals'
MAPPING = {
    ('red-brawler', 'hadoken-cast-12.png'): 'moves/hadoken-cast-fire-12.png',
    ('red-brawler', 'shoryuken-12.png'): 'moves/shoryuken-12.png',
    ('red-brawler', 'tatsumaki-12.png'): 'moves/tatsumaki-12.png',
    ('green-boxer', 'hadoken-12.png'): 'moves/hadoken-12.png',
    ('green-boxer', 'shoryuken-12.png'): 'moves/shoryuken-12.png',
    ('green-boxer', 'tatsumaki-12.png'): 'moves/tatsumaki-12.png',
    ('jiujitsu-fighter', 'shoryuken-12.png'): 'moves/shoryuken-12.png',
    ('jiujitsu-fighter', 'tatsumaki-12.png'): 'moves/tatsumaki-12.png',
}
BACKUP_SOURCE = {
    ('red-brawler', 'hadoken-cast-12.png'): 'moves/hadoken-cast-12.png',
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    BACKUPS.mkdir(parents=True, exist_ok=True)
    rows = ['fighter\tfile\tbackup_sha256\tcandidate_sha256\tinstalled_sha256']
    for (fighter, filename), relative_runtime_path in MAPPING.items():
        candidate = CANDIDATES / fighter / filename
        runtime = ROOT / 'public' / 'assets' / fighter / relative_runtime_path
        original_runtime = ROOT / 'public' / 'assets' / fighter / BACKUP_SOURCE.get((fighter, filename), relative_runtime_path)
        backup_name = Path(BACKUP_SOURCE.get((fighter, filename), relative_runtime_path)).name
        backup = BACKUPS / fighter / backup_name
        if not candidate.is_file() or not original_runtime.is_file():
            raise FileNotFoundError(f'Missing candidate or runtime asset: {candidate} / {original_runtime}')
        if not backup.exists():
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(original_runtime, backup)
        original_hash = sha256(backup)
        candidate_hash = sha256(candidate)
        shutil.copy2(candidate, runtime)
        installed_hash = sha256(runtime)
        if installed_hash != candidate_hash:
            raise IOError(f'Installed hash mismatch for {fighter}/{filename}')
        rows.append(f'{fighter}\t{filename}\t{original_hash}\t{candidate_hash}\t{installed_hash}')
    (BACKUPS / 'manifest.tsv').write_text('\n'.join(rows) + '\n', encoding='utf-8')
    print(f'Installed {len(MAPPING)} reviewed sprite strips; original runtime PNGs are preserved under {BACKUPS}')


if __name__ == '__main__':
    main()
