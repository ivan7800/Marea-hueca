"""Empaqueta fuente y juego sin fechas variables ni metadatos Git."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parent.parent
version = json.loads((root / "package.json").read_text())["version"]
name = f"La-Marea-Hueca-v{version}"
paths = [
    ".gitignore", ".github/workflows/pages.yml", "README.md", "CHANGELOG.md",
    "package.json", "package-lock.json", "index.html", "style.css", "tide.svg",
    "La-Marea-Hueca.html"
]
for directory in ["docs", "scripts", "src", "tests", "vendor", "dist"]:
    paths.extend(str(path.relative_to(root)) for path in (root / directory).rglob("*")
                 if path.is_file() and "__pycache__" not in path.parts)

with ZipFile(root / f"{name}.zip", "w") as archive:
    for relative in sorted(paths):
        info = ZipInfo(f"{name}/{relative}", (2026, 11, 14, 0, 0, 0))
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        archive.writestr(info, (root / relative).read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
