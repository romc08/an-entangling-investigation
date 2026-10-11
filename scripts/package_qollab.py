"""Export prepared runtime files, without oversized source artwork or video.

Run: python scripts/package_qollab.py
This optional upload helper needs only Python's standard library.
"""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def package_project():
    root = Path(__file__).resolve().parents[1]
    files = [root / name for name in (
        "index.html", "main.js", "main.css", "requirements.txt", "README.md",
        "LICENSE", "ART_CREDITS.md",
    )]
    for folder, pattern in (("src", "*.js"), ("assets/art", "*.js"),
                            ("assets/media", "*.js"), ("quantum", "*.py")):
        files.extend(sorted((root / folder).rglob(pattern)))

    # Check original sizes: ZIP compression cannot fix a per-file upload limit.
    for path in files:
        if path.stat().st_size >= 2_000_000:
            raise ValueError(f"Over the upload budget: {path.relative_to(root)}")
    for name in ("main.js", "assets/art/deviceA.js", "assets/art/deviceB.js", "assets/art/phone.js",
                 "assets/art/notebook.js", "assets/art/workbench.js", "assets/art/report.js",
                 "assets/art/evidence1.js", "assets/art/evidence2.js", "assets/art/evidence3.js", "assets/art/evidence4.js",
                 "src/ui.js", "src/desk-cards.js", "src/typewriter.js", "assets/media/intro.js",
                 "quantum/experiments.py", "quantum/analysis.py"):
        if root / name not in files:
            raise ValueError(f"Missing runtime file: {name}")

    destination = root / "dist" / "qollab-upload.zip"
    destination.parent.mkdir(exist_ok=True)
    with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(root).as_posix())
    with ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise ValueError("Archive integrity check failed")

    largest = max(files, key=lambda path: path.stat().st_size)
    print(f"Created {destination}")
    print(f"{len(files)} files; all below 2 MB uncompressed.")
    print(f"Largest: {largest.relative_to(root)} ({largest.stat().st_size:,} bytes)")


if __name__ == "__main__":
    package_project()
