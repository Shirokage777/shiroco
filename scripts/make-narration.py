"""Generates the card narration: spoken audio for every card, with a local AI voice.

The voice is Kokoro (open source, Apache 2.0), run on your own computer with kokoro-onnx, so no
card text is sent anywhere. The audio is card content and belongs with the card data in your
private data repo, never in this public repo.

For each card it writes, into <out>/<card id>/:
  text.mp3       the card's title and text, read when the card is revealed
  option-1.mp3   each option's label and text, read when that option is chosen
  option-2.mp3   ...

Setup (once):
  py -3.12 -m venv <dir>/venv
  <dir>/venv/Scripts/python -m pip install kokoro-onnx soundfile
  download kokoro-v1.0.onnx and voices-v1.0.bin from
  https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0 into <dir>/model

Run:
  <dir>/venv/Scripts/python scripts/make-narration.py <deck.json> <out dir> <model dir> [--force]
Existing clips are kept unless --force is given.
"""

import json
import re
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

VOICE = "am_michael"  # Sean's pick (2026-11-03)
SPEED = 0.95
PAUSE = 0.35  # seconds of silence at the start and end of each clip


def speakable(text: str) -> str:
    # Printed symbols ({weapon}) are read as their word.
    return re.sub(r"\{([a-z0-9-]+)\}", lambda m: m.group(1).replace("-", " "), text)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    if len(args) != 3:
        sys.exit(__doc__)
    deck_path, out_dir, model_dir = (Path(a) for a in args)
    deck = json.loads(deck_path.read_text(encoding="utf-8"))
    kokoro = Kokoro(str(model_dir / "kokoro-v1.0.onnx"), str(model_dir / "voices-v1.0.bin"))

    def write(text: str, path: Path) -> bool:
        if path.exists() and not force:
            return False
        samples, rate = kokoro.create(speakable(text), voice=VOICE, speed=SPEED, lang="en-us")
        silence = [0.0] * int(rate * PAUSE)
        path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(path, [*silence, *samples, *silence], rate, format="MP3", bitrate_mode="VARIABLE", compression_level=0.6)
        return True

    made = 0
    for card in deck["cards"]:
        folder = out_dir / card["id"]
        made += write(f"{card['title']}. {card['text']}", folder / "text.mp3")
        for i, option in enumerate(card["options"], start=1):
            made += write(f"{option['label']}. {option['text']}", folder / f"option-{i}.mp3")
        print(card["id"], flush=True)
    print(f"{made} clips written to {out_dir}")


if __name__ == "__main__":
    main()
