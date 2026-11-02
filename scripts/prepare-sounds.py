"""Prepares the CC0 sound files for the web (public/sounds, see public/sounds/SOURCES.md).

Re-encodes the downloaded originals to lighter MP3s and makes the storm wind loop seamlessly:
its last seconds are crossfaded into its start, so playing it on repeat has no audible seam.

Run (with any Python that has soundfile, e.g. the Kokoro venv from make-narration.py):
  python scripts/prepare-sounds.py <folder with the downloaded originals>
"""

import sys
from pathlib import Path

import numpy as np
import soundfile as sf

OUT = Path(__file__).resolve().parent.parent / "public" / "sounds"
FADE = 3.0  # seconds of crossfade at the wind loop's seam

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
        samples, rate = sf.read(src / f"{sid}.mp3", always_2d=True)
        n = int(FADE * rate)
        ramp = np.linspace(0, 1, n)[:, None]
        # The tail fades out over the head fading in; the result starts where it ends.
        head = samples[:n] * ramp + samples[-n:] * (1 - ramp)
        write(OUT / name, np.concatenate([head, samples[n:-n]]), rate)
    for sid, name in ZOMBIES.items():
        samples, rate = sf.read(src / f"{sid}.mp3")
        write(OUT / name, samples, rate)


if __name__ == "__main__":
    main()
