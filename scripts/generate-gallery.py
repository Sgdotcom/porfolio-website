#!/usr/bin/env python3


import json
import pathlib
import re
from datetime import datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]
GALLERY_DIR = ROOT / "assets" / "pictures-of"
OUTPUT_FILE = GALLERY_DIR / "gallery.json"

EXTENSION_TYPES = {
    ".webp": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".png": "image",
    ".gif": "image",
    ".tiff": "image",
    ".mov": "video",
    ".mp4": "video",
    ".avi": "video",
    ".mkv": "video",
}

def format_caption(filename: str) -> str:
    base = pathlib.Path(filename).stem
    words = re.sub(r"[_-]+", " ", base).split()
    if not words:
        return filename
    return " ".join(word.capitalize() for word in words)

def build_gallery():
    if not GALLERY_DIR.exists():
        raise SystemExit(f"Missing assets folder: {GALLERY_DIR}")

    entries = sorted(GALLERY_DIR.iterdir(), key=lambda p: p.name.lower())
    items = []

    for entry in entries:
        if not entry.is_file():
            continue
        typ = EXTENSION_TYPES.get(entry.suffix.lower())
        if not typ:
            continue
        items.append(
            {
                "path": f"assets/pictures-of/{entry.name}",
                "type": typ,
                "caption": format_caption(entry.name),
            }
        )

    payload = {
        "generatedAt": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "items": items,
    }

    OUTPUT_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Saved {len(items)} items to {OUTPUT_FILE}")


if __name__ == "__main__":
    build_gallery()
