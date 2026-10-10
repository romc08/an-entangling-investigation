"""Optional asset preparation, not a game build step. Requires Pillow.

Preserve the supplied artwork; trim only transparent padding, then encode
runtime WebP data URLs so Qollab does not need relative image fetches.
Run from any directory: python dev/package_sprites.py
"""
import base64
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "deviceA": "device 1 transparent.png",
    "deviceB": "device 2 transparent.png",
    "phone": "dial_up_phone transparent.png",
    "notebook": "notebook transparent.png",
    "workbench": "workbench.jpg",
}

output = ROOT / "art"
output.mkdir(exist_ok=True)
for name, source in SOURCES.items():
    with Image.open(ROOT / "sprites" / source) as image:
        if image.mode == "RGBA":
            image = image.crop(image.getchannel("A").getbbox())
        buffer = BytesIO()
        # Lossless sprites keep the supplied pixels and alpha exactly.
        image.save(buffer, format="WEBP", lossless=name != "workbench", quality=90, method=6)
        data = base64.b64encode(buffer.getvalue()).decode("ascii")
        module = f'// Packaged from sprites/{source}; do not edit by hand.\nexport default "data:image/webp;base64,{data}";\n'
        if len(module.encode("utf-8")) >= 2_000_000:
            raise ValueError(f"{name} exceeds the Qollab file budget")
        (output / f"{name}.js").write_text(module, encoding="utf-8")
        print(f"{name}: {image.width} x {image.height}, {len(module):,} bytes")
