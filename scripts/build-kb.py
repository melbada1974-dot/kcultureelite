#!/usr/bin/env python3
"""Assemble knowledge-base.md from extracted sources with explicit subject labels."""
import sys
from pathlib import Path
from textwrap import dedent

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = Path("/tmp/kb-raw")
OUT = PROJECT_ROOT / "workers/kc-chatbot/knowledge-base.md"

HEADER = dedent("""
    # K-Culture Elite Program — Chatbot Knowledge Base

    This document is the single source of truth for the K-Culture Elite AI
    assistant. It is split into three parts:

    - **Part 1** — K-Culture Elite Program official material (cite directly).
    - **Part 2** — Dongyang University reference material (cite as school
      context, NOT as K-Culture Elite Program brochure).
    - **Part 3** — FAQ & escalation guidance.

    When answering, always attribute facts to the correct subject:
    - "The K-Culture Elite Program offers ..."
    - "Dongyang University, our partner institution, is ..."

    Never promise any downloadable file or brochure; direct follow-up requests
    to global@badaglobal-bli.com or offer an admissions-team callback.
""").strip()

SECTION_MAP = [
    ("Part 1: K-Culture Elite Program", [
        ("Program, Tracks & Curriculum", RAW_DIR / "curriculum.md"),
        ("Faculty (22 members)",         RAW_DIR / "faculty.md"),
    ]),
    ("Part 2: Dongyang University (reference)", [
        ("Official Brochure", RAW_DIR / "dongyang-brochure.md"),
        ("Web Snapshot",      RAW_DIR / "dongyang-web.md"),
    ]),
]

FAQ = dedent("""
    ## Part 3: FAQ & Escalation

    ### 3.1 Escalation targets
    - Personal admissions questions, tuition discounts, contract terms:
      "Please contact our admissions team at global@badaglobal-bli.com."
    - Specific visa/housing questions: escalate to email as above.
    - Questions outside scope (general K-Pop gossip, unrelated topics):
      politely decline and redirect to on-topic help.

    ### 3.2 Lead-capture triggers
    When a visitor expresses concrete interest in a track, admissions process,
    or audition details, offer ONE of:
    - "Would you like our admissions team to reach out with more details?
       Just share your name and email."
    - "Want to be notified when new program updates are announced?"
    Never promise a brochure, PDF, or automated email.

    ### 3.3 Contact
    - Email: global@badaglobal-bli.com
    - Application deadline: 2026-05-31
""").strip()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else "(source missing)\n"


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    parts = [HEADER, ""]
    for part_title, sections in SECTION_MAP:
        parts.append(f"\n## {part_title}\n")
        for sub_title, path in sections:
            parts.append(f"\n### {sub_title}\n")
            parts.append(read(path))
    parts.append("\n")
    parts.append(FAQ)
    parts.append("\n")
    OUT.write_text("\n".join(parts), encoding="utf-8")
    size = OUT.stat().st_size
    print(f"Wrote {OUT} ({size} bytes ≈ {size // 4} tokens rough)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
