"""Prepares the CC0 sound files for the web (public/sounds, see public/sounds/SOURCES.md).

Copies the storm wind as it is (full quality; the player crossfades its loop) and re-encodes
the zombie growls to lighter MP3s.

Run (with any Python that has soundfile, e.g. the Kokoro venv from make-narration.py):
  python scripts/prepare-sounds.py <folder with the downloaded originals>
"""

import shutil
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

OUT = Path(__file__).resolve().parent.parent / "public" / "sounds"

# BigSoundBank id -> file name in public/sounds
WIND = {"0153": "storm-wind.mp3"}
ZOMBIES = {f"{2105 + n}": f"zombie-{n}.mp3" for n in range(1, 8)}


def write(path: Path, samples: np.ndarray, rate: int) -> None:
    sf.write(path, samples, rate, format="MP3", bitrate_mode="VARIABLE", compression_level=0.55)
    print(f"{path.name}: {len(samples) / rate:.1f}s, {path.stat().st_size // 1024} KB")


def main() -> None:
    src = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for sid, name in WIND.items():
        # Copied as it is: re-encoding lost the fine detail of the howling wind (Sean, 2026-11-03).
        # The player makes the loop seamless (app/sound.ts).
        shutil.copyfile(src / f"{sid}.mp3", OUT / name)
        print(f"{name}: original, {(OUT / name).stat().st_size // 1024} KB")
    for sid, name in ZOMBIES.items():
        samples, rate = sf.read(src / f"{sid}.mp3")
        write(OUT / name, samples, rate)


if __name__ == "__main__":
    main()
