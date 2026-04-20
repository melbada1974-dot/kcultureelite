#!/usr/bin/env python3
"""Crawl a curated list of dyu.ac.kr pages and export combined markdown."""
import sys
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

BASE = "https://www.dyu.ac.kr"

# 초기 시드 — 메인, 학교 소개, 미술/예술/문화 학부 관련
# 2026-04-20 탐색 결과:
# - /intro-2-2/president/ (총장인사말) 등 intro 페이지들은 작동
# - /college/ (학부 전체) 존재
# - /college/art-part/ (예술학부) 존재
# - culture 서브도메인 존재 (http://culture.dyu.ac.kr)
# - 메인 /는 K-Culture 관련 뉴스 포함
SEED_PATHS = [
    "/",  # 메인 페이지 (K-Culture 뉴스 포함)
    "/intro-2-2/president/",  # 총장인사말
    "/intro-2-2/idea/",  # 교육철학/이념
    "/college/",  # 학부 전체 페이지
    "/college/art-part/",  # 예술학부 (연기, 공연영상, 영상미디어)
    "/college/culture-part/",  # 문화예술대학
]

HEADERS = {
    "User-Agent": "KCultureEliteBot/1.0 (+https://kcultureelite.com; contact: global@badaglobal-bli.com)",
    "Accept-Language": "ko,en;q=0.8",
}


def fetch(url: str) -> Optional[str]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            print(f"  ! {r.status_code} {url}", file=sys.stderr)
            return None
        r.encoding = r.apparent_encoding
        return r.text
    except requests.RequestException as e:
        print(f"  ! {e} {url}", file=sys.stderr)
        return None


def clean(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "nav", "footer", "form"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    # 공백 라인 정리
    return "\n".join([ln for ln in (line.strip() for line in text.splitlines()) if ln])


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: crawl-dyu.py <output.md>", file=sys.stderr)
        return 1
    dst = Path(sys.argv[1])
    dst.parent.mkdir(parents=True, exist_ok=True)

    out = ["# Dongyang University — crawled reference (internal use only)\n"]
    for path in SEED_PATHS:
        url = urljoin(BASE, path)
        print(f"Fetching {url}")
        html = fetch(url)
        if not html:
            continue
        out.append(f"\n## Source: {url}\n")
        out.append(clean(html))
        time.sleep(1.0)  # 예의
    dst.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"Wrote {dst} ({dst.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
