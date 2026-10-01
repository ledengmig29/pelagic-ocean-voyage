"""Build the film's local variable Chinese serif font.

Install once: python -m pip install 'fonttools[woff]'
Run from any directory: python scripts/subset-starry-font.py [--font PATH]
The default source is Windows' Noto Serif SC variable font (SIL OFL 1.1).
Regenerate after changing the film's captions; no network is used by this script.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
# An optional checkout-local install keeps the bundled Python runtime untouched.
LOCAL_TOOLS = ROOT / "out" / "font-tools"
if LOCAL_TOOLS.is_dir():
    sys.path.insert(0, str(LOCAL_TOOLS))

from fontTools import subset
from fontTools.ttLib import TTFont


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--font", type=Path,
        default=Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts/NotoSerifSC-VF.ttf",
    )
    parser.add_argument("--source", type=Path, default=ROOT / "remotion/starry-night.tsx")
    parser.add_argument("--output", type=Path, default=ROOT / "public/fonts/starry-serif.woff2")
    args = parser.parse_args()

    # Include all source literals as well as printable ASCII for stable typography.
    characters = set(args.source.read_text(encoding="utf-8"))
    characters.update(chr(code) for code in range(32, 127))
    font = TTFont(args.font, recalcTimestamp=False)
    supported = set(font.getBestCmap())
    requested = {ord(char) for char in characters if not char.isspace() or char == " "}

    options = subset.Options()
    options.flavor = "woff2"
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.name_legacy = True
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=sorted(requested & supported))
    subsetter.subset(font)

    # Give the modified subset its own family name while retaining OFL metadata.
    names = {
        1: "Starry Serif", 2: "Regular", 3: "StarrySerif-Subset-1.0",
        4: "Starry Serif", 6: "StarrySerif-Regular", 16: "Starry Serif", 17: "Regular",
    }
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding(), errors="replace")
    font.flavor = "woff2"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    font.save(args.output)

    result = TTFont(args.output)
    missing = (requested & supported) - set(result.getBestCmap())
    if missing:
        raise RuntimeError(f"Subset lost requested code points: {sorted(missing)}")
    print(f"Saved {args.output}: {args.output.stat().st_size:,} bytes, {len(result.getBestCmap())} characters")
    if requested - supported:
        print("Source font lacks code points:", ", ".join(f"U+{value:04X}" for value in sorted(requested - supported)))


if __name__ == "__main__":
    main()
