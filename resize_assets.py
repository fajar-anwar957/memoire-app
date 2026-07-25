#!/usr/bin/env python3
"""
Resize Memoire image assets for web delivery.

Run from the project root:
    python resize_assets.py

Originals are copied to assets_backup_original/ before anything is changed.
Only JPEGs are touched. PNG icons are left alone.
"""

import shutil
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is not installed. Run:  pip install Pillow")

MAX_WIDTH = 1200
QUALITY = 80

assets = Path(sys.argv[1] if len(sys.argv) > 1 else "static/assets")
if not assets.is_dir():
    sys.exit(f"Folder not found: {assets.resolve()}\nRun this from your project root.")

jpegs = sorted(p for p in assets.iterdir()
               if p.suffix.lower() in {".jpg", ".jpeg"} and p.is_file())

if not jpegs:
    sys.exit(f"No JPEG files found in {assets}")

backup = Path("assets_backup_original")
backup.mkdir(exist_ok=True)

print(f"Found {len(jpegs)} JPEGs in {assets}")
print(f"Backing up originals to {backup}/\n")

before_total = after_total = 0

for path in jpegs:
    before = path.stat().st_size
    before_total += before

    shutil.copy2(path, backup / path.name)

    try:
        with Image.open(path) as img:
            img = ImageOps.exif_transpose(img)   # respect camera rotation
            img = img.convert("RGB")             # drop alpha/CMYK if present
            width, height = img.size

            if width > MAX_WIDTH:
                new_height = round(height * MAX_WIDTH / width)
                img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)

            img.save(path, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    except Exception as exc:
        shutil.copy2(backup / path.name, path)   # restore on failure
        print(f"  SKIPPED {path.name} -> {exc}")
        continue

    after = path.stat().st_size
    after_total += after
    saved = 100 * (1 - after / before) if before else 0
    print(f"  {path.name:<28} {before/1e6:6.2f} MB -> {after/1e6:5.2f} MB  ({saved:4.1f}% smaller)")

print(f"\nTotal: {before_total/1e6:.1f} MB -> {after_total/1e6:.1f} MB")
if before_total:
    print(f"Saved {(before_total - after_total)/1e6:.1f} MB "
          f"({100 * (1 - after_total/before_total):.0f}% reduction)")
print("\nOriginals are in assets_backup_original/ if you need them back.")
