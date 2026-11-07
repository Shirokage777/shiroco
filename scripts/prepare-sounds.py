"""Prepares the CC0 sound files for the web (public/sounds, see public/sounds/SOURCES.md).

Copies the storm wind as it is (full quality; the player crossfades its loop) and re-encodes
the zombie growls to lighter MP3s.

Run (with any Python that has soundfile, e.g. the Kokoro venv from make-narration.py):
  python scripts/prepare-sounds.py <folder with the downloaded originals>

The screams (Sean's picks, 2026-11-07) are cut from three Freesound studio originals, one
scream per file, each set to the same loudness as the growls (needs pyloudnorm too):
  python scripts/prepare-sounds.py screams <folder with the three .wav originals>
"""

import shutil
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

OUT = Path(__file__).resolve().parent.parent / "public" / "sounds"

# BigSoundBank id -> file name in public/sounds
WIND = {"0147": "ambience-wind.mp3"}
ZOMBIES = {f"{2105 + n}": f"zombie-{n}.mp3" for n in range(1, 8)}


def write(path: Path, samples: np.ndarray, rate: int) -> None:
    sf.write(path, samples, rate, format="MP3", bitrate_mode="VARIABLE", compression_level=0.55)
    print(f"{path.name}: {len(samples) / rate:.1f}s, {path.stat().st_size // 1024} KB")


# Freesound id -> the screams in that recording, as (start, end) in seconds, found with a
# -40 dB silence detection. Each voice gets its own number: scream-<voice>-<n>.mp3.
SCREAMS = {
    # A man screaming at medium distance in a forest (VanEngelen, LCR on a Schoeps MS set).
    "873718": [(0.58, 2.20), (6.07, 7.93), (10.65, 11.70), (13.80, 16.41), (17.23, 18.96),
               (21.97, 24.64), (29.22, 32.31), (34.48, 36.68), (39.32, 42.15)],
    # An actor's screams of pain and fear (Archeos).
    "325548": [(1.07, 2.98), (4.65, 6.93), (10.31, 12.11), (14.09, 16.40), (19.17, 21.81),
               (24.47, 26.97)],
    # A woman's piercing scream, twice (peridactyloptrix).
    "208893": [(1.18, 2.12), (4.49, 5.92)],
}
SCREAM_LOUDNESS = -21.0  # LUFS, about the growls' level
LEAD, TAIL = 0.08, 0.45  # seconds kept before and after each scream (its breath and room)


def prepare_screams(src: Path) -> None:
    import pyloudnorm

    for voice, (sid, cuts) in enumerate(SCREAMS.items(), start=1):
        (original,) = src.glob(f"{sid}__*.wav")
        samples, rate = sf.read(original, always_2d=True)
        if samples.shape[1] == 3:  # left, centre, right -> stereo
            centre = samples[:, 1] * 0.7071
            samples = np.stack([samples[:, 0] + centre, samples[:, 2] + centre], axis=1)
        meter = pyloudnorm.Meter(rate)
        for n, (start, end) in enumerate(cuts, start=1):
            a = max(0, int((start - LEAD) * rate))
            b = min(len(samples), int((end + TAIL) * rate))
            clip = samples[a:b].copy()
            # Only the volume changes, plus a few milliseconds of fade at the cut so it never clicks.
            clip *= 10 ** ((SCREAM_LOUDNESS - meter.integrated_loudness(clip)) / 20)
            fade_in, fade_out = int(0.005 * rate), int(0.08 * rate)
            clip[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
            clip[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
            peak = np.abs(clip).max()
            if peak > 0.98:  # never clip: a very peaky scream sits a little lower instead
                clip *= 0.98 / peak
            write(OUT / f"scream-{voice}-{n}.mp3", clip, rate)


def main() -> None:
    if sys.argv[1] == "screams":
        return prepare_screams(Path(sys.argv[2]))
    src = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for sid, name in WIND.items():
        # Copied as it is: re-encoding loses the fine detail of the wind (Sean, 2026-11-03).
        # The player makes the loop seamless (app/sound.ts).
        shutil.copyfile(src / f"{sid}.mp3", OUT / name)
        print(f"{name}: original, {(OUT / name).stat().st_size // 1024} KB")
    for sid, name in ZOMBIES.items():
        samples, rate = sf.read(src / f"{sid}.mp3")
        write(OUT / name, samples, rate)


if __name__ == "__main__":
    main()
