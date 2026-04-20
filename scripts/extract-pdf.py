#!/usr/bin/env python3
"""Extract text from a PDF into markdown."""
import sys
from pathlib import Path
from pypdf import PdfReader


def extract_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    lines = [f"# {path.stem}\n"]
    for idx, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if not text:
            continue
        lines.append(f"\n## Page {idx}\n")
        for raw in text.splitlines():
            raw = raw.strip()
            if raw:
                lines.append(raw)
    return "\n".join(lines) + "\n"


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: extract-pdf.py <input.pdf> <output.md>", file=sys.stderr)
        return 1
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    if not src.exists():
        print(f"Not found: {src}", file=sys.stderr)
        return 2
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(extract_pdf(src), encoding="utf-8")
    print(f"Wrote {dst} ({dst.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
